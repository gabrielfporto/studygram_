-- Funções de configuração usam RLS do próprio usuário.
create function public.import_topic(p_area text, p_topic text, p_titles text[], p_importance numeric default 0.5, p_context uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); area_id uuid; topic_id uuid; v_title text; competency_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if coalesce(array_length(p_titles,1),0) not between 1 and 30 then raise exception 'Informe entre 1 e 30 competências'; end if;
  select id into area_id from public.study_areas where user_id=owner_id and title=trim(p_area) and not archived limit 1;
  if area_id is null then
    insert into public.study_areas(user_id,title) values(owner_id,trim(p_area)) returning id into area_id;
  end if;
  insert into public.topics(user_id,area_id,title) values(owner_id,area_id,trim(p_topic)) returning id into topic_id;
  foreach v_title in array p_titles loop
    insert into public.competencies(user_id,topic_id,title,importance) values(owner_id,topic_id,trim(v_title),p_importance) returning id into competency_id;
    if p_context is not null then
      insert into public.competency_contexts(user_id,competency_id,context_id) values(owner_id,competency_id,p_context);
    end if;
  end loop;
  return topic_id;
end $$;
revoke all on function public.import_topic(text,text,text[],numeric,uuid) from public, anon;
grant execute on function public.import_topic(text,text,text[],numeric,uuid) to authenticated;

create function public.configure_study(p_goal text, p_timezone text, p_context text, p_rules jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); v_context_id uuid; rule jsonb;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Fuso inválido'; end if;
  if jsonb_typeof(p_rules)<>'array' or jsonb_array_length(p_rules)<>7 then raise exception 'Informe os sete dias'; end if;
  if (select count(distinct (v->>'weekday')::int) from jsonb_array_elements(p_rules) v)<>7 then raise exception 'Dias duplicados'; end if;
  insert into public.profiles(user_id,goal,timezone) values(owner_id,left(p_goal,1000),p_timezone)
    on conflict(user_id) do update set goal=excluded.goal, timezone=excluded.timezone;
  if length(trim(p_context))>0 then
    select id into v_context_id from public.academic_contexts where user_id=owner_id and title=trim(p_context) limit 1;
    if v_context_id is null then
      insert into public.academic_contexts(user_id,title) values(owner_id,trim(p_context)) returning id into v_context_id;
    end if;
    -- Encerra o contexto anterior; mantém o histórico.
    if not exists(select 1 from public.rotations r where r.user_id=owner_id and r.context_id=v_context_id and r.starts_at<=now() and r.ends_at>now()) then
      update public.rotations set ends_at=greatest(starts_at+interval '1 second',now()) where user_id=owner_id and ends_at>now();
      insert into public.rotations(user_id,context_id,starts_at,ends_at) values(owner_id,v_context_id,now(),now()+interval '1 year');
    end if;
  end if;
  delete from public.availability_rules where user_id=owner_id;
  for rule in select * from jsonb_array_elements(p_rules) loop
    insert into public.availability_rules(user_id,weekday,starts_local,ends_local,daily_cap_minutes,max_effort)
      values(owner_id,(rule->>'weekday')::int,(rule->>'start')::time,(rule->>'end')::time,(rule->>'minutes')::int,rule->>'effort');
  end loop;
end $$;
revoke all on function public.configure_study(text,text,text,jsonb) from public, anon;
grant execute on function public.configure_study(text,text,text,jsonb) to authenticated;

-- Apenas a Edge Function autenticada chama esta função; sem SECURITY DEFINER.
create function public.commit_study_session(p_user uuid, p_input jsonb, p_expected_revision integer, p_memory jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare session_id uuid; v_competency_id uuid := (p_input->>'competencyId')::uuid;
  current_revision integer; review_id uuid; before_card jsonb; after_card jsonb;
begin
  -- Serializa gravações por usuário, incluindo tentativas simultâneas com a mesma chave.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  select id into session_id from public.study_sessions
    where user_id=p_user and idempotency_key=(p_input->>'idempotencyKey')::uuid;
  if session_id is not null then return jsonb_build_object('id',session_id,'duplicate',true); end if;
  if not exists(select 1 from public.competencies where user_id=p_user and id=v_competency_id and not archived) then raise exception 'Competência indisponível'; end if;
  select r.id,r.revision,r.card into review_id,current_revision,before_card from public.reviews r
    where r.user_id=p_user and r.competency_id=v_competency_id for update;
  if coalesce(current_revision,0) <> p_expected_revision then raise exception 'REVISION_CONFLICT'; end if;
  insert into public.study_sessions(user_id,competency_id,idempotency_key,actual_minutes,planned_minutes,started_at,ended_at,method,status,feedback,notes)
    values(p_user,v_competency_id,(p_input->>'idempotencyKey')::uuid,(p_input->>'actualMinutes')::int,
      (p_input->>'plannedMinutes')::int,(p_input->>'startedAt')::timestamptz,(p_input->>'endedAt')::timestamptz,
      p_input->>'method',p_input->>'status',(p_input->>'feedback')::int,p_input->>'notes') returning id into session_id;
  if (p_input->>'total')::int>0 and p_input->>'status'<>'missed' then
    insert into public.question_sessions(user_id,competency_id,session_id,total,correct,occurred_at)
      values(p_user,v_competency_id,session_id,(p_input->>'total')::int,(p_input->>'correct')::int,(p_input->>'endedAt')::timestamptz);
  end if;
  if p_memory is not null then
    after_card := p_memory->'card';
    insert into public.reviews(user_id,competency_id,difficulty,stability,last_review,next_review,reps,lapses,learning_state,card,algorithm_version,revision)
      values(p_user,v_competency_id,(after_card->>'difficulty')::float8,(after_card->>'stability')::float8,
        (after_card->>'last_review')::timestamptz,(after_card->>'due')::timestamptz,(after_card->>'reps')::int,
        (after_card->>'lapses')::int,p_memory->>'state',after_card,p_memory->>'version',1)
      on conflict(user_id,competency_id) do update set difficulty=excluded.difficulty,stability=excluded.stability,
        last_review=excluded.last_review,next_review=excluded.next_review,reps=excluded.reps,lapses=excluded.lapses,
        learning_state=excluded.learning_state,card=excluded.card,algorithm_version=excluded.algorithm_version,revision=public.reviews.revision+1
      returning id into review_id;
    insert into public.review_events(user_id,review_id,session_id,occurred_at,rating,before_card,after_card,algorithm_version,parameters)
      values(p_user,review_id,session_id,(p_input->>'endedAt')::timestamptz,(p_memory->>'rating')::int,
        coalesce(before_card,p_memory->'before'),after_card,p_memory->>'version',p_memory->'parameters');
  end if;
  insert into public.product_events(user_id,name) values(p_user,'study_session_completed');
  return jsonb_build_object('id',session_id,'duplicate',false,'nextReview',after_card->>'due');
end $$;
revoke all on function public.commit_study_session(uuid,jsonb,integer,jsonb) from public, anon, authenticated;
grant execute on function public.commit_study_session(uuid,jsonb,integer,jsonb) to service_role;
