create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  starts_local time not null, ends_local time not null check (ends_local > starts_local),
  daily_cap_minutes integer not null check (daily_cap_minutes between 0 and 720),
  minimum_session_minutes integer not null default 10 check (minimum_session_minutes between 5 and 60),
  max_effort text not null default 'high' check (max_effort in ('low','medium','high')),
  unique (user_id, id)
);
create index availability_weekday_idx on public.availability_rules(user_id, weekday);
create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'google'),
  external_calendar_id text not null,
  last_synced_at timestamptz,
  status text not null check (status in ('connected','expired','disconnected')),
  unique (user_id, id), unique (user_id, provider, external_calendar_id)
);
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.calendar_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  secret_reference text not null,
  sync_token text,
  primary key (user_id, connection_id),
  foreign key (user_id, connection_id) references public.calendar_connections(user_id, id) on delete cascade
);
alter table private.calendar_credentials enable row level security;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.calendar_credentials to service_role;
revoke all on private.calendar_credentials from public, anon, authenticated;
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  external_id text not null,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null check (status in ('busy','free','cancelled')),
  unique (user_id, id), unique (user_id, connection_id, external_id),
  foreign key (user_id, connection_id) references public.calendar_connections(user_id, id) on delete cascade
);
create index calendar_events_interval_idx on public.calendar_events(user_id, starts_at, ends_at);
create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  timezone text not null,
  revision integer not null check (revision > 0),
  capacity_minutes integer not null check (capacity_minutes >= 0),
  engine_version text not null,
  input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, id), unique (user_id, local_date, revision)
);
create table public.daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null, competency_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  method text not null check (method in ('new','recall','questions')),
  priority_score numeric not null check (priority_score between 0 and 100),
  expected_value_per_minute numeric not null check (expected_value_per_minute >= 0),
  explanation jsonb not null check (jsonb_typeof(explanation) = 'object'),
  unique (user_id, id), unique (user_id, plan_id, competency_id),
  foreign key (user_id, plan_id) references public.daily_plans(user_id, id) on delete cascade,
  foreign key (user_id, competency_id) references public.competencies(user_id, id)
);
create index plan_items_comp_idx on public.daily_plan_items(user_id, competency_id);
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  operation text not null, provider text not null, model text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, id), unique (user_id, request_id)
);
create index ai_usage_date_idx on public.ai_usage(user_id, created_at);
create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (name in ('study_session_started','study_session_completed','plan_generated','plan_recalculated','review_completed')),
  occurred_at timestamptz not null default now(),
  -- Não incluir texto de questões, agenda ou observações pessoais.
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  unique (user_id, id)
);
create index product_events_date_idx on public.product_events(user_id, occurred_at);

do $$
declare t text;
begin
  foreach t in array array['availability_rules','calendar_connections','calendar_events','daily_plans','daily_plan_items','ai_usage','product_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
grant insert, update, delete on public.availability_rules to authenticated;
create policy own_insert on public.availability_rules for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_update on public.availability_rules for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_delete on public.availability_rules for delete to authenticated using ((select auth.uid()) = user_id);
