-- Identidade, catálogo e contexto. Nenhum dado de demonstração em produção.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'America/Bahia',
  goal text not null default '',
  preferences jsonb not null default '{}' check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default now()
);

create table public.study_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  archived boolean not null default false,
  unique (user_id, id)
);
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  archived boolean not null default false,
  unique (user_id, id),
  foreign key (user_id, area_id) references public.study_areas(user_id, id)
);
create index topics_area_idx on public.topics(user_id, area_id);
create table public.competencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  importance numeric not null default 0.5 check (importance between 0 and 1),
  manual_priority numeric not null default 0 check (manual_priority between 0 and 1),
  effort text not null default 'medium' check (effort in ('low','medium','high')),
  new_minutes integer not null default 30 check (new_minutes between 25 and 90),
  review_minutes integer not null default 20 check (review_minutes between 10 and 45),
  archived boolean not null default false,
  unique (user_id, id),
  foreign key (user_id, topic_id) references public.topics(user_id, id)
);
create index competencies_topic_idx on public.competencies(user_id, topic_id);
create table public.academic_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  unique (user_id, id)
);
create table public.competency_contexts (
  user_id uuid not null references auth.users(id) on delete cascade,
  competency_id uuid not null,
  context_id uuid not null,
  primary key (user_id, competency_id, context_id),
  foreign key (user_id, competency_id) references public.competencies(user_id, id),
  foreign key (user_id, context_id) references public.academic_contexts(user_id, id)
);
create index competency_contexts_context_idx on public.competency_contexts(user_id, context_id);
create table public.rotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  unique (user_id, id),
  foreign key (user_id, context_id) references public.academic_contexts(user_id, id)
);
create index rotations_start_idx on public.rotations(user_id, starts_at);
create index rotations_context_idx on public.rotations(user_id, context_id);
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  occurs_at timestamptz not null,
  unique (user_id, id)
);
create index exams_date_idx on public.exams(user_id, occurs_at);
create table public.exam_competencies (
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null,
  competency_id uuid not null,
  primary key (user_id, exam_id, competency_id),
  foreign key (user_id, exam_id) references public.exams(user_id, id),
  foreign key (user_id, competency_id) references public.competencies(user_id, id)
);
create index exam_competencies_comp_idx on public.exam_competencies(user_id, competency_id);

do $$
declare t text;
begin
  foreach t in array array['profiles','study_areas','topics','competencies','academic_contexts',
    'competency_contexts','rotations','exams','exam_competencies'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
    execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
