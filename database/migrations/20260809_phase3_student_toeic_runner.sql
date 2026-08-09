-- ============================================================
-- Phase P3.6A: Student Full TOEIC Test Runner Foundation
-- HARDENED MIGRATION — all student mutations via controlled RPCs
-- ============================================================
-- Tables: toeic_test_attempts, toeic_test_attempt_answers
-- RPCs:   start_or_resume_toeic_test, get_student_toeic_test_content,
--         save_toeic_answer, update_toeic_attempt_progress,
--         can_access_toeic_media
-- ============================================================

-- ============================================================
-- 1. ATTEMPT TABLE
-- ============================================================
create table if not exists public.toeic_test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_id uuid not null references public.toeic_tests(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'abandoned')),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  submitted_at timestamptz,
  current_question_number integer not null default 1
    check (current_question_number >= 1 and current_question_number <= 200),
  elapsed_seconds integer not null default 0
    check (elapsed_seconds >= 0),
  duration_minutes integer not null default 120
    check (duration_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_one_active_attempt
  on public.toeic_test_attempts (user_id, test_id)
  where status = 'in_progress';

create index if not exists idx_attempts_user on public.toeic_test_attempts (user_id);
create index if not exists idx_attempts_test on public.toeic_test_attempts (test_id);

-- ============================================================
-- 2. ATTEMPT ANSWERS TABLE
-- ============================================================
create table if not exists public.toeic_test_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.toeic_test_attempts(id) on delete cascade,
  question_id uuid not null references public.toeic_test_questions(id) on delete cascade,
  selected_answer text check (selected_answer in ('A', 'B', 'C', 'D')),
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_unique_attempt_answer
  on public.toeic_test_attempt_answers (attempt_id, question_id);

create index if not exists idx_answers_attempt on public.toeic_test_attempt_answers (attempt_id);

-- ============================================================
-- 3. REVOKE DIRECT TABLE MUTATIONS FOR STUDENTS
--    All student writes go through controlled RPCs.
-- ============================================================
revoke insert, update, delete on public.toeic_test_attempts from anon, authenticated;
revoke insert, update, delete on public.toeic_test_attempt_answers from anon, authenticated;

-- ============================================================
-- 4. RLS — ATTEMPTS (SELECT only)
-- ============================================================
alter table public.toeic_test_attempts enable row level security;

drop policy if exists student_attempts_select on public.toeic_test_attempts;
drop policy if exists student_attempts_insert on public.toeic_test_attempts;
drop policy if exists student_attempts_update on public.toeic_test_attempts;
drop policy if exists admin_attempts_select on public.toeic_test_attempts;

create policy student_attempts_select on public.toeic_test_attempts
  for select to authenticated
  using (user_id = auth.uid());

create policy admin_attempts_select on public.toeic_test_attempts
  for select to authenticated
  using (public.is_admin());

-- ============================================================
-- 5. RLS — ATTEMPT ANSWERS (SELECT only)
-- ============================================================
alter table public.toeic_test_attempt_answers enable row level security;

drop policy if exists student_answers_select on public.toeic_test_attempt_answers;
drop policy if exists student_answers_insert on public.toeic_test_attempt_answers;
drop policy if exists student_answers_update on public.toeic_test_attempt_answers;
drop policy if exists admin_answers_select on public.toeic_test_attempt_answers;

create policy student_answers_select on public.toeic_test_attempt_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.toeic_test_attempts
      where id = attempt_id and user_id = auth.uid()
    )
  );

create policy admin_answers_select on public.toeic_test_attempt_answers
  for select to authenticated
  using (public.is_admin());

-- ============================================================
-- 6. TIGHTEN toeic_test_questions / toeic_test_groups SELECT
--    to ADMIN ONLY — students get content via safe RPC only.
--    This prevents students from reading correct_answer/explanation
--    via direct PostgREST queries.
--
--    NOTE: We do NOT edit the already-applied P3.5C migration.
--    We drop and recreate the policies here.
-- ============================================================

-- Questions: admin-only SELECT
drop policy if exists "admin_toeic_test_questions_select" on public.toeic_test_questions;
create policy "admin_toeic_test_questions_select" on public.toeic_test_questions
  for select to authenticated
  using (public.is_admin());

-- Groups: admin-only SELECT
drop policy if exists "admin_toeic_test_groups_select" on public.toeic_test_groups;
create policy "admin_toeic_test_groups_select" on public.toeic_test_groups
  for select to authenticated
  using (public.is_admin());

-- Tests: keep published test metadata readable by students (for library/overview)
drop policy if exists "admin_toeic_tests_select" on public.toeic_tests;
create policy "admin_toeic_tests_select" on public.toeic_tests
  for select to authenticated
  using (
    public.is_admin()
    or (is_published = true and public.has_active_access())
  );

-- ============================================================
-- 7. MEDIA AUTHORIZATION HELPER
--    Replaces direct question/group SELECT in P3.5E storage policy.
--    Returns boolean only — NEVER exposes answer data.
-- ============================================================
create or replace function public.can_access_toeic_media(p_path text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Admin always has access
  if public.is_admin() then
    return true;
  end if;

  -- Student checks
  if auth.uid() is null then
    return false;
  end if;

  if not public.has_active_access() then
    return false;
  end if;

  -- Check if path is referenced by an active question in a published test
  if exists (
    select 1
    from public.toeic_test_questions q
    join public.toeic_tests t on t.id = q.test_id
    where t.is_published = true
      and q.is_active = true
      and (q.image_url = p_path or q.audio_url = p_path)
  ) then
    return true;
  end if;

  -- Check if path is referenced by an active group in a published test
  if exists (
    select 1
    from public.toeic_test_groups g
    join public.toeic_tests t on t.id = g.test_id
    where t.is_published = true
      and g.is_active = true
      and (g.image_url = p_path or g.audio_url = p_path)
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- Update P3.5E storage student SELECT policy to use the helper
-- (We don't edit the applied P3.5E migration file — we replace policy here)
drop policy if exists student_media_select on storage.objects;
create policy student_media_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'toeic-media'
  and public.can_access_toeic_media(name)
);

-- ============================================================
-- 8. RPC: start_or_resume_toeic_test (RACE-SAFE)
-- ============================================================
create or replace function public.start_or_resume_toeic_test(p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_attempt_id uuid;
  v_test_published boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_active_access() then
    raise exception 'Access expired or inactive';
  end if;

  select is_published into v_test_published
  from public.toeic_tests
  where id = p_test_id;

  if v_test_published is null then
    raise exception 'Test not found';
  end if;

  if not v_test_published then
    raise exception 'Test is not published';
  end if;

  -- Try to find existing in-progress attempt
  select id into v_attempt_id
  from public.toeic_test_attempts
  where user_id = v_user_id
    and test_id = p_test_id
    and status = 'in_progress';

  if v_attempt_id is not null then
    update public.toeic_test_attempts
    set last_activity_at = now(), updated_at = now()
    where id = v_attempt_id;

    return jsonb_build_object(
      'attempt_id', v_attempt_id,
      'resumed', true
    );
  end if;

  -- Race-safe: INSERT with ON CONFLICT on partial unique index
  -- If a concurrent call already inserted, we catch it and return the existing.
  begin
    insert into public.toeic_test_attempts (user_id, test_id, status, started_at, last_activity_at)
    values (v_user_id, p_test_id, 'in_progress', now(), now())
    returning id into v_attempt_id;

    return jsonb_build_object(
      'attempt_id', v_attempt_id,
      'resumed', false
    );
  exception when unique_violation then
    -- Concurrent insert won the race — find and return the existing attempt
    select id into v_attempt_id
    from public.toeic_test_attempts
    where user_id = v_user_id
      and test_id = p_test_id
      and status = 'in_progress';

    update public.toeic_test_attempts
    set last_activity_at = now(), updated_at = now()
    where id = v_attempt_id;

    return jsonb_build_object(
      'attempt_id', v_attempt_id,
      'resumed', true
    );
  end;
end;
$$;

-- ============================================================
-- 9. RPC: get_student_toeic_test_content
--    NEVER returns correct_answer or explanation.
--    Groups ordered by MIN(active child question_number).
-- ============================================================
create or replace function public.get_student_toeic_test_content(p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_test jsonb;
  v_groups jsonb;
  v_questions jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_active_access() then
    raise exception 'Access expired or inactive';
  end if;

  select jsonb_build_object(
    'id', id,
    'title', title,
    'test_code', test_code,
    'description', description,
    'test_type', test_type
  ) into v_test
  from public.toeic_tests
  where id = p_test_id and is_published = true;

  if v_test is null then
    raise exception 'Test not found or not published';
  end if;

  -- Groups ordered by MIN(active child question_number)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sub.id,
      'part', sub.part,
      'group_type', sub.group_type,
      'title', sub.title,
      'instruction', sub.instruction,
      'passage', sub.passage,
      'documents', sub.documents,
      'audio_url', sub.audio_url,
      'image_url', sub.image_url
    ) order by sub.min_qn, sub.sort_order
  ), '[]'::jsonb) into v_groups
  from (
    select g.*,
      coalesce(
        (select min(q.question_number)
         from public.toeic_test_questions q
         where q.group_id = g.id and q.is_active = true),
        g.sort_order * 1000
      ) as min_qn
    from public.toeic_test_groups g
    where g.test_id = p_test_id and g.is_active = true
  ) sub;

  -- Questions — EXCLUDING correct_answer AND explanation
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'group_id', q.group_id,
      'question_number', q.question_number,
      'part', q.part,
      'question_text', q.question_text,
      'options', q.options,
      'skill_tag', q.skill_tag,
      'topic', q.topic,
      'audio_url', q.audio_url,
      'image_url', q.image_url
    ) order by q.question_number
  ), '[]'::jsonb) into v_questions
  from public.toeic_test_questions q
  where q.test_id = p_test_id and q.is_active = true;

  return jsonb_build_object(
    'test', v_test,
    'groups', v_groups,
    'questions', v_questions
  );
end;
$$;

-- ============================================================
-- 10. RPC: save_toeic_answer
--     Validates ownership, in-progress, active access, published
--     test, canonical answer, timer expiry.
-- ============================================================
create or replace function public.save_toeic_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_attempt record;
  v_question record;
  v_test_published boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_active_access() then
    raise exception 'Access expired or inactive';
  end if;

  -- Verify attempt ownership and status
  select id, test_id, status, started_at, duration_minutes
  into v_attempt
  from public.toeic_test_attempts
  where id = p_attempt_id
    and user_id = v_user_id
    and status = 'in_progress';

  if v_attempt is null then
    raise exception 'Attempt not found or not in progress';
  end if;

  -- Verify parent test is still published
  select is_published into v_test_published
  from public.toeic_tests
  where id = v_attempt.test_id;

  if v_test_published is not true then
    raise exception 'Test is no longer published';
  end if;

  -- Check timer expiry
  if now() > (v_attempt.started_at + (v_attempt.duration_minutes || ' minutes')::interval) then
    raise exception 'Test time has expired';
  end if;

  -- Verify question belongs to the attempt's test and is active
  select id, part into v_question
  from public.toeic_test_questions
  where id = p_question_id
    and test_id = v_attempt.test_id
    and is_active = true;

  if v_question is null then
    raise exception 'Question not found or does not belong to this test';
  end if;

  -- Validate canonical answer
  if p_selected_answer is not null then
    if v_question.part = 'part2' then
      if p_selected_answer not in ('A', 'B', 'C') then
        raise exception 'Invalid answer for Part 2 (must be A, B, or C)';
      end if;
    else
      if p_selected_answer not in ('A', 'B', 'C', 'D') then
        raise exception 'Invalid answer (must be A, B, C, or D)';
      end if;
    end if;
  end if;

  -- Upsert answer
  insert into public.toeic_test_attempt_answers (attempt_id, question_id, selected_answer, answered_at)
  values (p_attempt_id, p_question_id, p_selected_answer, now())
  on conflict (attempt_id, question_id)
  do update set
    selected_answer = excluded.selected_answer,
    answered_at = excluded.answered_at,
    updated_at = now();

  -- Update attempt activity
  update public.toeic_test_attempts
  set last_activity_at = now(), updated_at = now()
  where id = p_attempt_id;

  return jsonb_build_object('saved', true);
end;
$$;

-- ============================================================
-- 11. RPC: update_toeic_attempt_progress
--     Controlled progress update — ONLY permitted fields.
-- ============================================================
create or replace function public.update_toeic_attempt_progress(
  p_attempt_id uuid,
  p_current_question_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_attempt record;
  v_test_published boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_active_access() then
    raise exception 'Access expired or inactive';
  end if;

  -- Validate question number range
  if p_current_question_number < 1 or p_current_question_number > 200 then
    raise exception 'Question number must be between 1 and 200';
  end if;

  -- Verify attempt ownership and status
  select id, test_id, started_at, duration_minutes
  into v_attempt
  from public.toeic_test_attempts
  where id = p_attempt_id
    and user_id = v_user_id
    and status = 'in_progress';

  if v_attempt is null then
    raise exception 'Attempt not found or not in progress';
  end if;

  -- Verify parent test remains published
  select is_published into v_test_published
  from public.toeic_tests
  where id = v_attempt.test_id;

  if v_test_published is not true then
    raise exception 'Test is no longer published';
  end if;

  -- Check timer expiry
  if now() > (v_attempt.started_at + (v_attempt.duration_minutes || ' minutes')::interval) then
    raise exception 'Test time has expired';
  end if;

  -- Update ONLY permitted fields
  update public.toeic_test_attempts
  set current_question_number = p_current_question_number,
      last_activity_at = now(),
      updated_at = now()
  where id = p_attempt_id;

  return jsonb_build_object('updated', true);
end;
$$;

-- ============================================================
-- 12. EXECUTE PRIVILEGE CONTROL
-- ============================================================
revoke execute on function public.start_or_resume_toeic_test(uuid) from public;
revoke execute on function public.start_or_resume_toeic_test(uuid) from anon;
grant execute on function public.start_or_resume_toeic_test(uuid) to authenticated;

revoke execute on function public.get_student_toeic_test_content(uuid) from public;
revoke execute on function public.get_student_toeic_test_content(uuid) from anon;
grant execute on function public.get_student_toeic_test_content(uuid) to authenticated;

revoke execute on function public.save_toeic_answer(uuid, uuid, text) from public;
revoke execute on function public.save_toeic_answer(uuid, uuid, text) from anon;
grant execute on function public.save_toeic_answer(uuid, uuid, text) to authenticated;

revoke execute on function public.update_toeic_attempt_progress(uuid, integer) from public;
revoke execute on function public.update_toeic_attempt_progress(uuid, integer) from anon;
grant execute on function public.update_toeic_attempt_progress(uuid, integer) to authenticated;

revoke execute on function public.can_access_toeic_media(text) from public;
revoke execute on function public.can_access_toeic_media(text) from anon;
grant execute on function public.can_access_toeic_media(text) to authenticated;
