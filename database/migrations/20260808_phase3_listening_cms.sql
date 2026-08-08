-- Migration: 20260808_phase3_listening_cms.sql
-- Description: Add lightweight question metadata (is_active, skill_tag, topic, image_url), enforce student active question filtering, and replace broad FOR ALL admin policies on learning_lessons & lesson_questions with INSERT and UPDATE policies (NO DELETE POLICY).

-- 1. Add metadata columns to lesson_questions if not existing
alter table public.lesson_questions add column if not exists is_active boolean not null default true;
alter table public.lesson_questions add column if not exists skill_tag text null;
alter table public.lesson_questions add column if not exists topic text null;
alter table public.lesson_questions add column if not exists image_url text null;

-- 2. Update Student Read Policy on lesson_questions (enforce is_active = true and published parent lesson)
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

-- 3. Replace broad FOR ALL admin policy on learning_lessons with explicit INSERT and UPDATE policies (NO DELETE POLICY)
drop policy if exists "admin_lessons_all" on public.learning_lessons;
drop policy if exists "admin_lessons_insert" on public.learning_lessons;
drop policy if exists "admin_lessons_update" on public.learning_lessons;

create policy "admin_lessons_insert" on public.learning_lessons
for insert to authenticated
with check (public.is_admin());

create policy "admin_lessons_update" on public.learning_lessons
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- 4. Replace broad FOR ALL admin policy on lesson_questions with explicit INSERT and UPDATE policies (NO DELETE POLICY)
drop policy if exists "admin_questions_all" on public.lesson_questions;
drop policy if exists "admin_questions_insert" on public.lesson_questions;
drop policy if exists "admin_questions_update" on public.lesson_questions;

create policy "admin_questions_insert" on public.lesson_questions
for insert to authenticated
with check (public.is_admin());

create policy "admin_questions_update" on public.lesson_questions
for update to authenticated
using (public.is_admin()) with check (public.is_admin());
