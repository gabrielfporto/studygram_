-- Source history never manufactures sessions, objective evidence or FSRS cards.
alter table public.competencies add column notion_source jsonb
  check (notion_source is null or jsonb_typeof(notion_source) = 'object');

create function public.content_identity(value text) returns text language sql immutable strict
set search_path = '' as $$
  select trim(regexp_replace(lower(regexp_replace(normalize(value, NFD), U&'[\0300-\036f]', '', 'g')), '\s+', ' ', 'g'));
$$;
revoke all on function public.content_identity(text) from public, anon;
grant execute on function public.content_identity(text) to authenticated, service_role;
create index study_areas_import_idx on public.study_areas(user_id, public.content_identity(title));
create index topics_import_idx on public.topics(user_id, area_id, public.content_identity(title));
create index competencies_import_idx on public.competencies(user_id, topic_id, public.content_identity(title));

create function public.import_schedule(p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); item jsonb; source jsonb; v_area_id uuid; v_topic_id uuid;
  v_competency_id uuid; v_context_id uuid; context_title text; inserted_count int := 0; skipped_count int := 0; flag text;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Lista inválida'; end if;
  if jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Importe entre 1 e 1000 assuntos'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  for item in select * from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(item) is distinct from 'object' or
      jsonb_typeof(item->'area') is distinct from 'string' or length(trim(item->>'area')) not between 1 and 200 or
      jsonb_typeof(item->'topic') is distinct from 'string' or length(trim(item->>'topic')) not between 1 and 200 or
      jsonb_typeof(item->'title') is distinct from 'string' or length(trim(item->>'title')) not between 1 and 200 or
      jsonb_typeof(item->'importance') is distinct from 'number' or
      (item->>'importance')::numeric not between 0 and 1 then raise exception 'Conteúdo inválido'; end if;
    source := item->'source';
    if jsonb_typeof(source) is distinct from 'object' then raise exception 'Histórico inválido'; end if;
    foreach flag in array array['priming','studied','questions','retrieval','preserveDate'] loop
      if jsonb_typeof(source->flag) is distinct from 'boolean' then raise exception 'Etapa inválida'; end if;
    end loop;
    foreach flag in array array['status','rotation','originalImportance'] loop
      if jsonb_typeof(source->flag) is distinct from 'string' or length(source->>flag)>200 then raise exception 'Histórico inválido'; end if;
    end loop;
    if source->'nextStudy' is distinct from 'null'::jsonb then
      if jsonb_typeof(source->'nextStudy') is distinct from 'string' or (source->>'nextStudy') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data inválida'; end if;
      perform (source->>'nextStudy')::date;
    end if;
    if exists(select 1 from public.competencies c join public.topics t on t.user_id=c.user_id and t.id=c.topic_id
      join public.study_areas a on a.user_id=t.user_id and a.id=t.area_id
      where c.user_id=owner_id and public.content_identity(a.title)=public.content_identity(item->>'area')
      and public.content_identity(t.title)=public.content_identity(item->>'topic')
      and public.content_identity(c.title)=public.content_identity(item->>'title')) then
      skipped_count := skipped_count+1; continue;
    end if;
    select a.id into v_area_id from public.study_areas a where a.user_id=owner_id and not a.archived
      and public.content_identity(a.title)=public.content_identity(item->>'area') order by a.id limit 1;
    if v_area_id is null then insert into public.study_areas(user_id,title) values(owner_id,trim(item->>'area')) returning id into v_area_id; end if;
    select t.id into v_topic_id from public.topics t where t.user_id=owner_id and t.area_id=v_area_id and not t.archived
      and public.content_identity(t.title)=public.content_identity(item->>'topic') order by t.id limit 1;
    if v_topic_id is null then insert into public.topics(user_id,area_id,title) values(owner_id,v_area_id,trim(item->>'topic')) returning id into v_topic_id; end if;
    insert into public.competencies(user_id,topic_id,title,importance,notion_source)
      values(owner_id,v_topic_id,trim(item->>'title'),(item->>'importance')::numeric,source) returning id into v_competency_id;
    for context_title in select trim(v) from regexp_split_to_table(source->>'rotation', ',') v where length(trim(v))>0 loop
      select a.id into v_context_id from public.academic_contexts a where a.user_id=owner_id and public.content_identity(a.title)=public.content_identity(context_title) order by a.id limit 1;
      if v_context_id is null then insert into public.academic_contexts(user_id,title) values(owner_id,context_title) returning id into v_context_id; end if;
      insert into public.competency_contexts(user_id,competency_id,context_id) values(owner_id,v_competency_id,v_context_id) on conflict do nothing;
    end loop;
    inserted_count := inserted_count+1;
  end loop;
  return jsonb_build_object('inserted',inserted_count,'skipped',skipped_count);
end $$;
revoke all on function public.import_schedule(jsonb) from public, anon;
grant execute on function public.import_schedule(jsonb) to authenticated;
