-- NLE Review LMS: initial schema
-- Run this as one migration in a new Supabase project.

create type public.user_role as enum ('learner', 'instructor', 'admin', 'superadmin');
create type public.category_kind as enum ('subject', 'topic', 'subtopic', 'folder');
create type public.question_status as enum ('draft', 'published', 'archived');
create type public.question_difficulty as enum ('easy', 'medium', 'hard');
create type public.cognitive_level as enum ('remember', 'understand', 'apply', 'analyze');
create type public.classification_status as enum ('unclassified', 'auto', 'reviewed');
create type public.quiz_mode as enum ('instant', 'practice', 'classic', 'board');
create type public.attempt_status as enum ('active', 'submitted', 'abandoned');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role public.user_role not null default 'learner',
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  accent_color text not null default 'green',
  font_scale numeric(3,2) not null default 1 check (font_scale between 0.80 and 1.40),
  reduced_motion boolean not null default false,
  default_quiz_size integer not null default 20 check (default_quiz_size between 1 and 200),
  shuffle_questions boolean not null default true,
  shuffle_choices boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (char_length(slug) between 1 and 140),
  kind public.category_kind not null default 'folder',
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

create unique index categories_unique_sibling_name
  on public.categories (
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  category_id uuid not null references public.categories(id) on delete restrict,
  question_text text not null check (char_length(question_text) > 0),
  explanation text not null default '',
  difficulty public.question_difficulty,
  cognitive_level public.cognitive_level,
  classification_confidence numeric(4,3)
    check (classification_confidence between 0 and 1),
  classification_status public.classification_status not null default 'unclassified',
  source text,
  status public.question_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 4),
  choice_text text not null,
  is_correct boolean not null default false,
  sort_order integer not null,
  unique (question_id, sort_order),
  unique (question_id, label)
);

create table public.question_assets (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  choice_id uuid references public.question_choices(id) on delete cascade,
  storage_path text not null unique,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode public.quiz_mode not null default 'instant',
  status public.attempt_status not null default 'active',
  title text,
  configuration jsonb not null default '{}'::jsonb,
  total_questions integer not null check (total_questions > 0),
  answered_count integer not null default 0 check (answered_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  score_percent numeric(5,2) not null default 0 check (score_percent between 0 and 100),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  check (answered_count <= total_questions),
  check (correct_count <= answered_count)
);

create table public.quiz_attempt_items (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  position integer not null check (position > 0),
  question_snapshot jsonb not null,
  choices_snapshot jsonb not null,
  correct_choice_ids uuid[] not null,
  selected_choice_ids uuid[],
  explanation_snapshot text not null default '',
  is_correct boolean,
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  answered_at timestamptz,
  unique (attempt_id, position),
  check (
    (answered_at is null and is_correct is null and selected_choice_ids is null)
    or
    (answered_at is not null and is_correct is not null and selected_choice_ids is not null)
  )
);

create table public.user_question_stats (
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  times_seen integer not null default 0 check (times_seen >= 0),
  times_correct integer not null default 0 check (times_correct >= 0),
  times_wrong integer not null default 0 check (times_wrong >= 0),
  total_response_time_ms bigint not null default 0 check (total_response_time_ms >= 0),
  last_result_correct boolean,
  current_correct_streak integer not null default 0 check (current_correct_streak >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id),
  check (times_correct + times_wrong = times_seen)
);

create index categories_parent_sort_idx on public.categories(parent_id, sort_order);
create index questions_category_status_idx on public.questions(category_id, status);
create index questions_cognitive_level_idx on public.questions(cognitive_level);
create index question_choices_question_sort_idx on public.question_choices(question_id, sort_order);
create index quiz_attempts_user_started_idx on public.quiz_attempts(user_id, started_at desc);
create index quiz_attempts_user_status_idx on public.quiz_attempts(user_id, status);
create index quiz_attempt_items_attempt_position_idx on public.quiz_attempt_items(attempt_id, position);
create index quiz_attempt_items_question_idx on public.quiz_attempt_items(question_id);
create index user_question_stats_wrong_idx on public.user_question_stats(user_id, times_wrong desc);
create index user_question_stats_last_seen_idx on public.user_question_stats(user_id, last_seen_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();
create trigger user_question_stats_set_updated_at
  before update on public.user_question_stats
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Learner'
    )
  );
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role from public.profiles where id = (select auth.uid())),
    'learner'::public.user_role
  );
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.categories enable row level security;
alter table public.questions enable row level security;
alter table public.question_choices enable row level security;
alter table public.question_assets enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_items enable row level security;
alter table public.user_question_stats enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.question_choices to authenticated;
grant select, insert, update, delete on public.question_assets to authenticated;
grant select on public.quiz_attempts to authenticated;
grant select on public.quiz_attempt_items to authenticated;
grant select on public.user_question_stats to authenticated;

create policy "users read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or public.current_user_role() in ('admin', 'superadmin'));
create policy "users update own display name"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "users read own preferences"
  on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users create own preferences"
  on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users update own preferences"
  on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "staff manage categories"
  on public.categories for all to authenticated
  using (public.current_user_role() in ('instructor', 'admin', 'superadmin'))
  with check (public.current_user_role() in ('instructor', 'admin', 'superadmin'));
create policy "staff manage questions"
  on public.questions for all to authenticated
  using (public.current_user_role() in ('instructor', 'admin', 'superadmin'))
  with check (public.current_user_role() in ('instructor', 'admin', 'superadmin'));
create policy "staff manage choices"
  on public.question_choices for all to authenticated
  using (public.current_user_role() in ('instructor', 'admin', 'superadmin'))
  with check (public.current_user_role() in ('instructor', 'admin', 'superadmin'));
create policy "staff manage assets"
  on public.question_assets for all to authenticated
  using (public.current_user_role() in ('instructor', 'admin', 'superadmin'))
  with check (public.current_user_role() in ('instructor', 'admin', 'superadmin'));

create policy "users read own attempts"
  on public.quiz_attempts for select to authenticated
  using ((select auth.uid()) = user_id or public.current_user_role() in ('admin', 'superadmin'));

create policy "users read submitted attempt items"
  on public.quiz_attempt_items for select to authenticated
  using (
    exists (
      select 1
      from public.quiz_attempts attempt
      where attempt.id = quiz_attempt_items.attempt_id
        and (
          (attempt.user_id = (select auth.uid()) and attempt.status = 'submitted')
          or public.current_user_role() in ('admin', 'superadmin')
        )
    )
  );

create policy "users read own question stats"
  on public.user_question_stats for select to authenticated
  using ((select auth.uid()) = user_id or public.current_user_role() in ('admin', 'superadmin'));

comment on table public.quiz_attempt_items is
  'Immutable question and choice snapshots preserve historical quiz results after question edits.';
comment on column public.questions.legacy_id is
  'Original Firestore document ID used for idempotent JSONL imports.';
