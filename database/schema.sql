-- ORI Learning MVP schema
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('student', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.account_status as enum ('active', 'disabled');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'student',
  status public.account_status not null default 'active',
  level text not null default 'foundation',
  access_start_at timestamptz not null default now(),
  access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and p.role = 'admin'
      and p.status = 'active'
  );
$$;

create or replace function public.has_active_access(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.status = 'active'
      and (p.access_start_at is null or p.access_start_at <= now())
      and (p.access_expires_at is null or p.access_expires_at > now())
  );
$$;

create table if not exists public.vocabulary_decks (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  level text not null,
  is_published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.vocabulary_decks(id) on delete cascade,
  word text not null,
  ipa text,
  part_of_speech text,
  meaning_vi text not null,
  example_en text,
  example_vi text,
  topic text,
  toeic_parts text[] not null default '{}',
  collocations text[] not null default '{}',
  common_mistake text,
  audio_url text,
  is_published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.grammar_lessons (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  level text not null,
  summary text,
  lesson_content jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('listening', 'reading')),
  slug text unique not null,
  title text not null,
  level text not null,
  toeic_part text,
  passage text,
  transcript text,
  audio_url text,
  is_published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  question_text text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text,
  sort_order int not null default 0
);

create table if not exists public.user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('vocabulary_deck','grammar','listening','reading')),
  content_id uuid not null,
  status text not null default 'in_progress' check (status in ('not_started','in_progress','completed')),
  score numeric,
  completed_at timestamptz,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, content_type, content_id)
);

create table if not exists public.vocabulary_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary_items(id) on delete cascade,
  rating text not null default 'good' check (rating in ('again','hard','good','easy')),
  repetitions int not null default 0,
  interval_days int not null default 0,
  ease_factor numeric not null default 2.5,
  next_review_at timestamptz,
  last_reviewed_at timestamptz not null default now(),
  primary key (user_id, vocabulary_id)
);

create table if not exists public.saved_words (
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vocabulary_id)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('grammar','listening','reading','vocabulary')),
  content_id uuid not null,
  score numeric not null,
  correct_count int,
  total_count int,
  answers jsonb,
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, access_expires_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    now() + interval '30 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.vocabulary_decks enable row level security;
alter table public.vocabulary_items enable row level security;
alter table public.grammar_lessons enable row level security;
alter table public.learning_lessons enable row level security;
alter table public.lesson_questions enable row level security;
alter table public.user_progress enable row level security;
alter table public.vocabulary_reviews enable row level security;
alter table public.saved_words enable row level security;
alter table public.quiz_attempts enable row level security;

-- Profiles
drop policy if exists "profile_self_read" on public.profiles;
create policy "profile_self_read" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "admin_profiles_update" on public.profiles;
create policy "admin_profiles_update" on public.profiles
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Paid content: active students or admins
drop policy if exists "active_read_decks" on public.vocabulary_decks;
create policy "active_read_decks" on public.vocabulary_decks
for select to authenticated
using ((is_published and public.has_active_access()) or public.is_admin());

drop policy if exists "active_read_vocab" on public.vocabulary_items;
create policy "active_read_vocab" on public.vocabulary_items
for select to authenticated
using ((is_published and public.has_active_access()) or public.is_admin());

drop policy if exists "active_read_grammar" on public.grammar_lessons;
create policy "active_read_grammar" on public.grammar_lessons
for select to authenticated
using ((is_published and public.has_active_access()) or public.is_admin());

drop policy if exists "active_read_learning_lessons" on public.learning_lessons;
create policy "active_read_learning_lessons" on public.learning_lessons
for select to authenticated
using ((is_published and public.has_active_access()) or public.is_admin());

drop policy if exists "active_read_questions" on public.lesson_questions;
create policy "active_read_questions" on public.lesson_questions
for select to authenticated
using (
  public.is_admin()
  or (
    public.has_active_access()
    and exists (
      select 1 from public.learning_lessons l
      where l.id = lesson_questions.lesson_id and l.is_published
    )
  )
);

-- Progress: own records only + active access. Admin may read.
drop policy if exists "progress_select" on public.user_progress;
create policy "progress_select" on public.user_progress
for select to authenticated
using ((user_id = auth.uid() and public.has_active_access()) or public.is_admin());

drop policy if exists "progress_insert" on public.user_progress;
create policy "progress_insert" on public.user_progress
for insert to authenticated
with check (user_id = auth.uid() and public.has_active_access());

drop policy if exists "progress_update" on public.user_progress;
create policy "progress_update" on public.user_progress
for update to authenticated
using (user_id = auth.uid() and public.has_active_access())
with check (user_id = auth.uid() and public.has_active_access());

-- Vocabulary reviews
drop policy if exists "vocab_reviews_select" on public.vocabulary_reviews;
create policy "vocab_reviews_select" on public.vocabulary_reviews
for select to authenticated
using ((user_id = auth.uid() and public.has_active_access()) or public.is_admin());

drop policy if exists "vocab_reviews_insert" on public.vocabulary_reviews;
create policy "vocab_reviews_insert" on public.vocabulary_reviews
for insert to authenticated
with check (user_id = auth.uid() and public.has_active_access());

drop policy if exists "vocab_reviews_update" on public.vocabulary_reviews;
create policy "vocab_reviews_update" on public.vocabulary_reviews
for update to authenticated
using (user_id = auth.uid() and public.has_active_access())
with check (user_id = auth.uid() and public.has_active_access());

-- Saved words
drop policy if exists "saved_words_select" on public.saved_words;
create policy "saved_words_select" on public.saved_words
for select to authenticated
using ((user_id = auth.uid() and public.has_active_access()) or public.is_admin());

drop policy if exists "saved_words_insert" on public.saved_words;
create policy "saved_words_insert" on public.saved_words
for insert to authenticated
with check (user_id = auth.uid() and public.has_active_access());

drop policy if exists "saved_words_delete" on public.saved_words;
create policy "saved_words_delete" on public.saved_words
for delete to authenticated
using (user_id = auth.uid() and public.has_active_access());

-- Attempts
drop policy if exists "attempts_select" on public.quiz_attempts;
create policy "attempts_select" on public.quiz_attempts
for select to authenticated
using ((user_id = auth.uid() and public.has_active_access()) or public.is_admin());

drop policy if exists "attempts_insert" on public.quiz_attempts;
create policy "attempts_insert" on public.quiz_attempts
for insert to authenticated
with check (user_id = auth.uid() and public.has_active_access());

-- Admin CRUD for content
drop policy if exists "admin_decks_all" on public.vocabulary_decks;
create policy "admin_decks_all" on public.vocabulary_decks
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_vocab_all" on public.vocabulary_items;
create policy "admin_vocab_all" on public.vocabulary_items
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_grammar_all" on public.grammar_lessons;
create policy "admin_grammar_all" on public.grammar_lessons
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_lessons_all" on public.learning_lessons;
create policy "admin_lessons_all" on public.learning_lessons
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_questions_all" on public.lesson_questions;
create policy "admin_questions_all" on public.lesson_questions
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Phase 2.2 Question Attempts
create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('grammar', 'listening', 'reading', 'vocabulary')),
  content_id uuid not null,
  question_key text not null,
  question_id uuid null,
  question_index integer null,
  question_text text not null,
  selected_answer text,
  correct_answer text not null,
  is_correct boolean not null,
  explanation text,
  skill_tag text,
  toeic_part text,
  topic text,
  created_at timestamptz not null default now(),
  constraint question_attempts_attempt_question_key unique (attempt_id, question_key)
);

create index if not exists idx_question_attempts_user_id on public.question_attempts(user_id);
create index if not exists idx_question_attempts_created_at on public.question_attempts(created_at desc);
create index if not exists idx_question_attempts_content on public.question_attempts(content_type, content_id);
create index if not exists idx_question_attempts_is_correct on public.question_attempts(user_id, is_correct);
create index if not exists idx_question_attempts_key on public.question_attempts(user_id, question_key);

alter table public.question_attempts enable row level security;

drop policy if exists "question_attempts_select" on public.question_attempts;
create policy "question_attempts_select" on public.question_attempts
for select to authenticated
using ((user_id = auth.uid() and public.has_active_access()) or public.is_admin());

drop policy if exists "question_attempts_insert" on public.question_attempts;
create policy "question_attempts_insert" on public.question_attempts
for insert to authenticated
with check (user_id = auth.uid() and public.has_active_access());

