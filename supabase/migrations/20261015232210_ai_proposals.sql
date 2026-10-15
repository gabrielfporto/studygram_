alter table public.ai_usage add column status text not null default 'completed' check(status in ('pending','completed','failed'));
alter table public.ai_usage add column cache_key text;
alter table public.ai_usage add column result jsonb;
create index ai_usage_cache_idx on public.ai_usage(user_id,cache_key,created_at desc);
create index ai_usage_global_date_idx on public.ai_usage(created_at);

-- Exclusivo do servidor: reserva atômica antes de chamar o provedor.
create function public.reserve_ai_request(p_user uuid,p_request uuid,p_operation text,p_model text,p_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.ai_usage; cutoff timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
  if p_user is null or p_request is null or p_operation not in ('log','contents','error','recall') or p_operation is null
    or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_model is null or length(p_model) not between 1 and 100 then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended('studygram-ai-quota',0));
  update public.ai_usage set result=null where user_id=p_user and created_at<now()-interval '24 hours' and result is not null;
  select * into existing from public.ai_usage where user_id=p_user and request_id=p_request;
  if found then
    if existing.cache_key is distinct from p_hash then raise exception 'REQUEST_MISMATCH'; end if;
    return jsonb_build_object('status',case when existing.status='completed' and existing.result is not null then 'cached' else existing.status end,'result',existing.result);
  end if;
  select * into existing from public.ai_usage where user_id=p_user and cache_key=p_hash and status='completed' and result is not null and created_at>=now()-interval '24 hours' order by created_at desc limit 1;
  if found then return jsonb_build_object('status','cached','result',existing.result); end if;
  if exists(select 1 from public.ai_usage where user_id=p_user and cache_key=p_hash and status='pending' and created_at>now()-interval '2 minutes') then return jsonb_build_object('status','pending'); end if;
  if (select count(*) from public.ai_usage where user_id=p_user and created_at>=cutoff)>=10
    or (select count(*) from public.ai_usage where created_at>=cutoff)>=100
    or (select count(*) from public.ai_usage where user_id=p_user and created_at>=now()-interval '1 minute')>=3 then raise exception 'AI_LIMIT'; end if;
  insert into public.ai_usage(user_id,request_id,operation,provider,model,input_tokens,output_tokens,status,cache_key)
    values(p_user,p_request,p_operation,'openai',p_model,0,0,'pending',p_hash);
  return jsonb_build_object('status','reserved');
end $$;
revoke all on function public.reserve_ai_request(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,uuid,text,text,text) to service_role;
