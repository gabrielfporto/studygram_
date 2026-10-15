alter table public.exams add column archived boolean not null default false;
alter table public.rotations add column archived boolean not null default false;
alter table public.mistakes add column resolved_at timestamptz;
grant insert,update on public.mistakes to authenticated;
create policy own_insert on public.mistakes for insert to authenticated with check ((select auth.uid())=user_id);
create policy own_update on public.mistakes for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create function public.save_academic_event(p_kind text,p_id uuid,p_title text,p_start timestamptz,p_end timestamptz,p_competencies uuid[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); context_id uuid; comp uuid;
begin
  if owner_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_id is null or p_kind not in ('exam','rotation') or p_kind is null or p_title is null or length(trim(p_title)) not between 1 and 200
    or p_start is null or not isfinite(p_start) or coalesce(cardinality(p_competencies),0) not between 1 and 1000 then raise exception 'INVALID_EVENT'; end if;
  if p_kind='rotation' and (p_end is null or not isfinite(p_end) or p_end<=p_start) then raise exception 'INVALID_RANGE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  foreach comp in array p_competencies loop
    if not exists(select 1 from public.competencies where user_id=owner_id and id=comp and not archived) then raise exception 'INVALID_COMPETENCY'; end if;
  end loop;
  if p_kind='exam' then
    insert into public.exams(id,user_id,title,occurs_at) values(p_id,owner_id,trim(p_title),p_start)
      on conflict(id) do update set title=excluded.title,occurs_at=excluded.occurs_at,archived=false where exams.user_id=owner_id;
    if not found then raise exception 'INVALID_OWNER'; end if;
    delete from public.exam_competencies where user_id=owner_id and exam_id=p_id;
    insert into public.exam_competencies(user_id,exam_id,competency_id) select owner_id,p_id,x from (select distinct unnest(p_competencies) x) c;
  else
    select id into context_id from public.academic_contexts where user_id=owner_id and lower(trim(title))=lower(trim(p_title)) order by id limit 1;
    if context_id is null then insert into public.academic_contexts(user_id,title) values(owner_id,trim(p_title)) returning id into context_id; end if;
    insert into public.rotations(id,user_id,context_id,starts_at,ends_at) values(p_id,owner_id,context_id,p_start,p_end)
      on conflict(id) do update set context_id=excluded.context_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,archived=false where rotations.user_id=owner_id;
    if not found then raise exception 'INVALID_OWNER'; end if;
    insert into public.competency_contexts(user_id,competency_id,context_id) select owner_id,x,context_id from (select distinct unnest(p_competencies) x) c on conflict do nothing;
  end if;
  return p_id;
end $$;
revoke all on function public.save_academic_event(text,uuid,text,timestamptz,timestamptz,uuid[]) from public,anon;
grant execute on function public.save_academic_event(text,uuid,text,timestamptz,timestamptz,uuid[]) to authenticated;

create or replace function public.configure_study(p_goal text, p_timezone text, p_context text, p_rules jsonb)
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
    if not exists(select 1 from public.rotations r where r.user_id=owner_id and r.context_id=v_context_id and r.starts_at<=now() and r.ends_at>now() and not r.archived) then
      update public.rotations set ends_at=greatest(starts_at+interval '1 second',now()) where user_id=owner_id and starts_at<=now() and ends_at>now() and not archived;
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
