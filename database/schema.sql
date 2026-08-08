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
  sort_order int not null default 0,
  is_active boolean not null default true,
  skill_tag text,
  topic text,
  image_url text
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
using (
  (
    is_published 
    and public.has_active_access() 
    and exists (
      select 1 from public.vocabulary_decks d 
      where d.id = vocabulary_items.deck_id 
      and d.is_published = true
    )
  ) 
  or public.is_admin()
);

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
    is_active = true
    and public.has_active_access()
    and exists (
      select 1 from public.learning_lessons l
      where l.id = lesson_questions.lesson_id and l.is_published = true
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

-- Admin Insert/Update (NO DELETE POLICY) for Decks & Vocabulary Items
drop policy if exists "admin_decks_all" on public.vocabulary_decks;
drop policy if exists "admin_decks_insert" on public.vocabulary_decks;
drop policy if exists "admin_decks_update" on public.vocabulary_decks;

create policy "admin_decks_insert" on public.vocabulary_decks
for insert to authenticated
with check (public.is_admin());

create policy "admin_decks_update" on public.vocabulary_decks
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_vocab_all" on public.vocabulary_items;
drop policy if exists "admin_vocab_insert" on public.vocabulary_items;
drop policy if exists "admin_vocab_update" on public.vocabulary_items;

create policy "admin_vocab_insert" on public.vocabulary_items
for insert to authenticated
with check (public.is_admin());

create policy "admin_vocab_update" on public.vocabulary_items
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_grammar_all" on public.grammar_lessons;
drop policy if exists "admin_grammar_insert" on public.grammar_lessons;
drop policy if exists "admin_grammar_update" on public.grammar_lessons;

create policy "admin_grammar_insert" on public.grammar_lessons
for insert to authenticated
with check (public.is_admin());

create policy "admin_grammar_update" on public.grammar_lessons
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_lessons_all" on public.learning_lessons;
drop policy if exists "admin_lessons_insert" on public.learning_lessons;
drop policy if exists "admin_lessons_update" on public.learning_lessons;

create policy "admin_lessons_insert" on public.learning_lessons
for insert to authenticated
with check (public.is_admin());

create policy "admin_lessons_update" on public.learning_lessons
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_questions_all" on public.lesson_questions;
drop policy if exists "admin_questions_insert" on public.lesson_questions;
drop policy if exists "admin_questions_update" on public.lesson_questions;

create policy "admin_questions_insert" on public.lesson_questions
for insert to authenticated
with check (public.is_admin());

create policy "admin_questions_update" on public.lesson_questions
for update to authenticated
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

-- Phase 3.5: Atomic Listening/Reading Bulk Import RPC
create or replace function public.admin_create_learning_lesson_with_questions(
  lesson_payload jsonb,
  questions_payload jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_lesson_id uuid;
  v_kind text;
  v_slug text;
  v_title text;
  v_level text;
  v_toeic_part text;
  v_passage text;
  v_transcript text;
  v_audio_url text;
  v_sort_order int;
  v_created_lesson record;
  v_question jsonb;
  v_inserted_questions_count int := 0;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin privileges required.';
  end if;

  v_kind := lower(trim(coalesce(lesson_payload->>'kind', '')));
  if v_kind not in ('listening', 'reading') then
    raise exception 'Invalid lesson kind: must be listening or reading.';
  end if;

  v_slug := trim(coalesce(lesson_payload->>'slug', ''));
  if v_slug = '' then
    raise exception 'Lesson slug cannot be empty.';
  end if;

  if exists (select 1 from public.learning_lessons where slug = v_slug) then
    raise exception 'Conflict: Lesson slug % already exists.', v_slug;
  end if;

  v_title := trim(coalesce(lesson_payload->>'title', ''));
  v_level := lower(trim(coalesce(lesson_payload->>'level', 'foundation')));
  v_toeic_part := lower(trim(coalesce(lesson_payload->>'toeic_part', '')));

  if v_kind = 'listening' and v_toeic_part not in ('part1', 'part2', 'part3', 'part4') then
    raise exception 'Invalid TOEIC Part % for Listening lesson.', v_toeic_part;
  end if;
  if v_kind = 'reading' and v_toeic_part not in ('part5', 'part6', 'part7') then
    raise exception 'Invalid TOEIC Part % for Reading lesson.', v_toeic_part;
  end if;
  v_passage := coalesce(lesson_payload->>'passage', null);
  v_transcript := coalesce(lesson_payload->>'transcript', null);
  v_audio_url := coalesce(lesson_payload->>'audio_url', null);
  v_sort_order := coalesce((lesson_payload->>'sort_order')::int, 0);

  insert into public.learning_lessons (
    kind,
    slug,
    title,
    level,
    toeic_part,
    passage,
    transcript,
    audio_url,
    is_published,
    sort_order
  ) values (
    v_kind,
    v_slug,
    v_title,
    v_level,
    v_toeic_part,
    v_passage,
    v_transcript,
    v_audio_url,
    false, -- ALWAYS FORCED DRAFT
    v_sort_order
  )
  returning * into v_created_lesson;

  v_lesson_id := v_created_lesson.id;

  if jsonb_typeof(questions_payload) = 'array' then
    for v_question in select * from jsonb_array_elements(questions_payload)
    loop
      insert into public.lesson_questions (
        lesson_id,
        question_text,
        options,
        correct_answer,
        explanation,
        sort_order,
        is_active,
        skill_tag,
        topic,
        image_url
      ) values (
        v_lesson_id,
        trim(coalesce(v_question->>'question_text', '')),
        coalesce(v_question->'options', '[]'::jsonb),
        trim(coalesce(v_question->>'correct_answer', '')),
        coalesce(v_question->>'explanation', null),
        coalesce((v_question->>'sort_order')::int, v_inserted_questions_count),
        true,
        coalesce(v_question->>'skill_tag', null),
        coalesce(v_question->>'topic', null),
        coalesce(v_question->>'image_url', null)
      );
      v_inserted_questions_count := v_inserted_questions_count + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'lesson_id', v_lesson_id,
    'slug', v_slug,
    'questions_count', v_inserted_questions_count
  );
end;
$$;

-- Explicit least-privilege RPC execution permissions
revoke execute on function public.admin_create_learning_lesson_with_questions(jsonb, jsonb) from public;
revoke execute on function public.admin_create_learning_lesson_with_questions(jsonb, jsonb) from anon;
grant execute on function public.admin_create_learning_lesson_with_questions(jsonb, jsonb) to authenticated;

-- Phase 3.5C: TOEIC Test Bank Foundation Tables (toeic_tests, toeic_test_groups, toeic_test_questions)

create table if not exists public.toeic_tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  test_code text null,
  description text null,
  test_type text not null default 'full',
  status text not null default 'draft',
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_toeic_tests_published on public.toeic_tests(is_published);
create index if not exists idx_toeic_tests_sort on public.toeic_tests(sort_order);

alter table public.toeic_tests enable row level security;

drop policy if exists "admin_toeic_tests_select" on public.toeic_tests;
create policy "admin_toeic_tests_select" on public.toeic_tests
for select to authenticated
using (public.is_admin() or (is_published = true and public.has_active_access()));

drop policy if exists "admin_toeic_tests_insert" on public.toeic_tests;
create policy "admin_toeic_tests_insert" on public.toeic_tests
for insert to authenticated
with check (public.is_admin());

drop policy if exists "admin_toeic_tests_update" on public.toeic_tests;
create policy "admin_toeic_tests_update" on public.toeic_tests
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.toeic_test_groups (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.toeic_tests(id) on delete cascade,
  part text not null,
  group_type text not null,
  title text null,
  instruction text null,
  passage text null,
  transcript text null,
  audio_url text null,
  image_url text null,
  documents jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_toeic_test_groups_test on public.toeic_test_groups(test_id);
create index if not exists idx_toeic_test_groups_part on public.toeic_test_groups(part);
create index if not exists idx_toeic_test_groups_sort on public.toeic_test_groups(sort_order);

alter table public.toeic_test_groups enable row level security;

drop policy if exists "admin_toeic_test_groups_select" on public.toeic_test_groups;
create policy "admin_toeic_test_groups_select" on public.toeic_test_groups
for select to authenticated
using (
  public.is_admin() or
  (
    is_active = true and
    exists (select 1 from public.toeic_tests t where t.id = test_id and t.is_published = true) and
    public.has_active_access()
  )
);

drop policy if exists "admin_toeic_test_groups_insert" on public.toeic_test_groups;
create policy "admin_toeic_test_groups_insert" on public.toeic_test_groups
for insert to authenticated
with check (public.is_admin());

drop policy if exists "admin_toeic_test_groups_update" on public.toeic_test_groups;
create policy "admin_toeic_test_groups_update" on public.toeic_test_groups
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.toeic_test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.toeic_tests(id) on delete cascade,
  group_id uuid null references public.toeic_test_groups(id) on delete set null,
  question_number integer not null,
  part text not null,
  question_text text null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text null,
  skill_tag text null,
  topic text null,
  difficulty text null,
  audio_url text null,
  image_url text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_toeic_test_questions_active_num on public.toeic_test_questions(test_id, question_number) where is_active = true;

create index if not exists idx_toeic_test_questions_test on public.toeic_test_questions(test_id);
create index if not exists idx_toeic_test_questions_group on public.toeic_test_questions(group_id);
create index if not exists idx_toeic_test_questions_part on public.toeic_test_questions(part);
create index if not exists idx_toeic_test_questions_num on public.toeic_test_questions(test_id, question_number);

alter table public.toeic_test_questions enable row level security;

drop policy if exists "admin_toeic_test_questions_select" on public.toeic_test_questions;
create policy "admin_toeic_test_questions_select" on public.toeic_test_questions
for select to authenticated
using (
  public.is_admin() or
  (
    is_active = true and
    exists (select 1 from public.toeic_tests t where t.id = test_id and t.is_published = true) and
    (group_id is null or exists (select 1 from public.toeic_test_groups g where g.id = group_id and g.is_active = true)) and
    public.has_active_access()
  )
);

drop policy if exists "admin_toeic_test_questions_insert" on public.toeic_test_questions;
create policy "admin_toeic_test_questions_insert" on public.toeic_test_questions
for insert to authenticated
with check (public.is_admin());

drop policy if exists "admin_toeic_test_questions_update" on public.toeic_test_questions;
create policy "admin_toeic_test_questions_update" on public.toeic_test_questions
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

