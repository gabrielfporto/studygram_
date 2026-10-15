-- Only free/busy intervals are stored. OAuth tokens remain in the browser's memory.
alter table public.calendar_connections add column display_name text check(length(display_name)<=200);
alter table public.calendar_connections add column sync_range_start timestamptz;
alter table public.calendar_connections add column sync_range_end timestamptz;
alter table public.calendar_connections add constraint calendar_sync_range_check
  check(sync_range_end is null or sync_range_end>sync_range_start);

do $$ declare t text; begin
  foreach t in array array['calendar_connections','calendar_events'] loop
    execute format('grant insert,update,delete on public.%I to authenticated',t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',t);
    execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
    execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid())=user_id)',t);
  end loop;
end $$;

create function public.save_calendar_snapshot(p_snapshot jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); v_from timestamptz; v_to timestamptz; calendar jsonb; block jsonb;
  v_connection uuid; v_start timestamptz; v_end timestamptz;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_snapshot) is distinct from 'object' or
    jsonb_typeof(p_snapshot->'calendars') is distinct from 'array' or jsonb_typeof(p_snapshot->'busy') is distinct from 'array' then raise exception 'Agenda inválida'; end if;
  if jsonb_array_length(p_snapshot->'calendars') not between 1 and 10 or jsonb_array_length(p_snapshot->'busy')>10000 then raise exception 'Limite de agendas ou intervalos excedido'; end if;
  v_from:=(p_snapshot->>'from')::timestamptz; v_to:=(p_snapshot->>'to')::timestamptz;
  if v_from is null or v_to is null or not isfinite(v_from) or not isfinite(v_to) or v_to<=v_from or v_to-v_from>interval '31 days' then raise exception 'Intervalo inválido'; end if;
  if (select count(distinct v->>'id') from jsonb_array_elements(p_snapshot->'calendars') v)<>jsonb_array_length(p_snapshot->'calendars') then raise exception 'Agendas repetidas'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  delete from public.calendar_events where user_id=owner_id;
  update public.calendar_connections set status='disconnected',sync_range_start=null,sync_range_end=null where user_id=owner_id;
  for calendar in select * from jsonb_array_elements(p_snapshot->'calendars') loop
    if jsonb_typeof(calendar->'id') is distinct from 'string' or length(calendar->>'id') not between 1 and 1024 or
      jsonb_typeof(calendar->'name') is distinct from 'string' or length(calendar->>'name')>200 then raise exception 'Agenda inválida'; end if;
    insert into public.calendar_connections(user_id,provider,external_calendar_id,display_name,status,last_synced_at,sync_range_start,sync_range_end)
      values(owner_id,'google',calendar->>'id',calendar->>'name','connected',now(),v_from,v_to)
      on conflict(user_id,provider,external_calendar_id) do update set display_name=excluded.display_name,status='connected',last_synced_at=excluded.last_synced_at,sync_range_start=v_from,sync_range_end=v_to;
  end loop;
  for block in select * from jsonb_array_elements(p_snapshot->'busy') loop
    select c.id into v_connection from public.calendar_connections c where c.user_id=owner_id and c.status='connected' and c.external_calendar_id=block->>'calendarId';
    if v_connection is null then raise exception 'Intervalo de agenda não selecionada'; end if;
    v_start:=(block->>'start')::timestamptz;v_end:=(block->>'end')::timestamptz;
    if v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end) or v_end<=v_start or v_start<v_from or v_end>v_to then raise exception 'Intervalo ocupado inválido'; end if;
    insert into public.calendar_events(user_id,connection_id,external_id,title,starts_at,ends_at,status)
      values(owner_id,v_connection,md5(v_start::text||'/'||v_end::text),null,v_start,v_end,'busy') on conflict(user_id,connection_id,external_id) do nothing;
  end loop;
  return jsonb_build_object('calendars',jsonb_array_length(p_snapshot->'calendars'),'intervals',jsonb_array_length(p_snapshot->'busy'));
end $$;
revoke all on function public.save_calendar_snapshot(jsonb) from public,anon;
grant execute on function public.save_calendar_snapshot(jsonb) to authenticated;

create function public.disconnect_calendar() returns void language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid();begin
  if owner_id is null then raise exception 'Authentication required';end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  delete from public.calendar_events where user_id=owner_id;
  update public.calendar_connections set status='disconnected',last_synced_at=null,sync_range_start=null,sync_range_end=null where user_id=owner_id;
end $$;
revoke all on function public.disconnect_calendar() from public,anon;
grant execute on function public.disconnect_calendar() to authenticated;
