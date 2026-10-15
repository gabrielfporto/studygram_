-- Eventos e projeções são gravados por serviço transacional, nunca diretamente pelo cliente.
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competency_id uuid not null,
  idempotency_key uuid not null,
  planned_minutes integer check (planned_minutes > 0),
  actual_minutes integer not null check (actual_minutes >= 0),
  started_at timestamptz not null,
  ended_at timestamptz check (ended_at >= started_at),
  method text not null check (method in ('new','reading','recall','questions','case','explanation')),
  status text not null check (status in ('completed','partial','missed')),
  feedback integer check (feedback between 1 and 4),
  notes text check (length(notes) <= 4000),
  unique (user_id, id), unique (user_id, idempotency_key),
  foreign key (user_id, competency_id) references public.competencies(user_id, id),
  check ((status = 'missed' and actual_minutes = 0) or (status <> 'missed' and actual_minutes > 0))
);
create index sessions_comp_date_idx on public.study_sessions(user_id, competency_id, started_at desc);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competency_id uuid not null,
  difficulty double precision not null check (difficulty between 0 and 10),
  stability double precision not null check (stability >= 0 and stability < 'Infinity'::float8),
  last_review timestamptz,
  next_review timestamptz not null,
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  learning_state text not null check (learning_state in ('new','learning','consolidating','maintenance')),
  card jsonb not null check (jsonb_typeof(card) = 'object'),
  algorithm_version text not null,
  revision integer not null default 1 check (revision > 0),
  unique (user_id, id), unique (user_id, competency_id),
  foreign key (user_id, competency_id) references public.competencies(user_id, id)
);
create index reviews_due_idx on public.reviews(user_id, next_review);
create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null,
  session_id uuid not null,
  occurred_at timestamptz not null,
  rating integer not null check (rating between 1 and 4),
  before_card jsonb not null check (jsonb_typeof(before_card) = 'object'),
  after_card jsonb not null check (jsonb_typeof(after_card) = 'object'),
  algorithm_version text not null,
  parameters jsonb not null check (jsonb_typeof(parameters) = 'object'),
  unique (user_id, id), unique (user_id, session_id, review_id),
  foreign key (user_id, review_id) references public.reviews(user_id, id),
  foreign key (user_id, session_id) references public.study_sessions(user_id, id)
);
create index review_events_review_idx on public.review_events(user_id, review_id, occurred_at);
create table public.question_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competency_id uuid not null,
  session_id uuid,
  total integer not null check (total > 0),
  correct integer not null check (correct >= 0 and correct <= total),
  source text,
  occurred_at timestamptz not null,
  unique (user_id, id),
  foreign key (user_id, competency_id) references public.competencies(user_id, id),
  foreign key (user_id, session_id) references public.study_sessions(user_id, id)
);
create index question_sessions_comp_idx on public.question_sessions(user_id, competency_id, occurred_at desc);
create index question_sessions_session_idx on public.question_sessions(user_id, session_id);
create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competency_id uuid not null,
  question_session_id uuid,
  description text not null check (length(trim(description)) between 1 and 4000),
  classification_key text,
  occurred_at timestamptz not null,
  unique (user_id, id),
  foreign key (user_id, competency_id) references public.competencies(user_id, id),
  foreign key (user_id, question_session_id) references public.question_sessions(user_id, id)
);
create index mistakes_comp_idx on public.mistakes(user_id, competency_id, occurred_at desc);
create index mistakes_question_idx on public.mistakes(user_id, question_session_id);

do $$
declare t text;
begin
  foreach t in array array['study_sessions','reviews','review_events','question_sessions','mistakes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
