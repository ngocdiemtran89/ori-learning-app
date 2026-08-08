-- Migration: 20260808_phase3_toeic_test_bank.sql
-- Description: Phase 3.5C — Relational TOEIC Test Bank Foundation (toeic_tests, toeic_test_groups, toeic_test_questions)

-- 1. Table: toeic_tests
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

-- 2. Table: toeic_test_groups
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

-- 3. Table: toeic_test_questions
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
  updated_at timestamptz not null default now(),
  constraint toeic_test_questions_number_unique unique (test_id, question_number)
);

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
