-- ============================================================
-- Phase P3.6A: Student Full TOEIC Test Runner Foundation
-- ============================================================
-- Tables: toeic_test_attempts, toeic_test_attempt_answers
-- RPCs:   start_or_resume_toeic_test, get_student_toeic_test_content, save_toeic_answer
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
  current_question_number integer not null default 1,
  elapsed_seconds integer not null default 0,
  duration_minutes integer not null default 120,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active in-progress attempt per user per test
create unique index if not exists idx_one_active_attempt
  on public.toeic_test_attempts (user_id, test_id)
  where status = 'in_progress';

-- Lookup indexes
create index if not exists idx_attempts_user on public.toeic_test_attempts (user_id);
create index if not exists idx_attempts_test on public.toeic_test_attempts (test_id);

-- ============================================================
-- 2. ATTEMPT ANSWERS TABLE
-- ============================================================
create table if not exists public.toeic_test_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.toeic_test_attempts(id) on delete cascade,
  question_id uuid not null references public.toeic_test_questions(id) on delete cascade,
  selected_answer text,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One answer per question per attempt
create unique index if not exists idx_unique_attempt_answer
  on public.toeic_test_attempt_answers (attempt_id, question_id);

create index if not exists idx_answers_attempt on public.toeic_test_attempt_answers (attempt_id);

-- ============================================================
-- 3. RLS — ATTEMPTS
-- ============================================================
alter table public.toeic_test_attempts enable row level security;

drop policy if exists student_attempts_select on public.toeic_test_attempts;
drop policy if exists student_attempts_insert on public.toeic_test_attempts;
drop policy if exists student_attempts_update on public.toeic_test_attempts;
drop policy if exists admin_attempts_select on public.toeic_test_attempts;

-- Students see only their own attempts
create policy student_attempts_select on public.toeic_test_attempts
  for select to authenticated
  using (user_id = auth.uid());

-- Students can insert only their own attempts for published tests
create policy student_attempts_insert on public.toeic_test_attempts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.has_active_access()
    and exists (
      select 1 from public.toeic_tests
      where id = test_id and is_published = true
    )
  );

-- Students can update only their own in-progress attempts
create policy student_attempts_update on public.toeic_test_attempts
  for update to authenticated
  using (user_id = auth.uid() and status = 'in_progress')
  with check (user_id = auth.uid());

-- Admin can view all attempts
create policy admin_attempts_select on public.toeic_test_attempts
  for select to authenticated
  using (public.is_admin());

-- ============================================================
-- 4. RLS — ATTEMPT ANSWERS
-- ============================================================
alter table public.toeic_test_attempt_answers enable row level security;

drop policy if exists student_answers_select on public.toeic_test_attempt_answers;
drop policy if exists student_answers_insert on public.toeic_test_attempt_answers;
drop policy if exists student_answers_update on public.toeic_test_attempt_answers;
drop policy if exists admin_answers_select on public.toeic_test_attempt_answers;

-- Students can read answers for their own attempts
create policy student_answers_select on public.toeic_test_attempt_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.toeic_test_attempts
      where id = attempt_id and user_id = auth.uid()
    )
  );

-- Students can insert answers only for their own in-progress attempts
create policy student_answers_insert on public.toeic_test_attempt_answers
  for insert to authenticated
  with check (
    exists (
      select 1 from public.toeic_test_attempts
      where id = attempt_id
        and user_id = auth.uid()
        and status = 'in_progress'
    )
  );

-- Students can update answers only for their own in-progress attempts
create policy student_answers_update on public.toeic_test_attempt_answers
  for update to authenticated
  using (
    exists (
      select 1 from public.toeic_test_attempts
      where id = attempt_id
        and user_id = auth.uid()
        and status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1 from public.toeic_test_attempts
      where id = attempt_id
        and user_id = auth.uid()
        and status = 'in_progress'
    )
  );

-- Admin can view all answers
create policy admin_answers_select on public.toeic_test_attempt_answers
  for select to authenticated
  using (public.is_admin());

-- ============================================================
-- 5. RPC: start_or_resume_toeic_test
-- ============================================================
create or replace function public.start_or_resume_toeic_test(p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_attempt_id uuid;
  v_test_published boolean;
begin
  -- Get authenticated user
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Check active access
  if not public.has_active_access() then
    raise exception 'Access expired or inactive';
  end if;

  -- Check test is published
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
    -- Resume: update last_activity_at
    update public.toeic_test_attempts
    set last_activity_at = now(), updated_at = now()
    where id = v_attempt_id;

    return jsonb_build_object(
      'attempt_id', v_attempt_id,
      'resumed', true
    );
  end if;

  -- Create new attempt
  insert into public.toeic_test_attempts (user_id, test_id, status, started_at, last_activity_at)
  values (v_user_id, p_test_id, 'in_progress', now(), now())
  returning id into v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'resumed', false
  );
end;
$$;

-- ============================================================
-- 6. RPC: get_student_toeic_test_content
--    NEVER returns correct_answer or explanation
-- ============================================================
create or replace function public.get_student_toeic_test_content(p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_test jsonb;
  v_groups jsonb;
  v_questions jsonb;
begin
  -- Auth checks
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_active_access() then
    raise exception 'Access expired or inactive';
  end if;

  -- Get test metadata (only if published)
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

  -- Get active groups (safe fields only)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'part', g.part,
      'group_type', g.group_type,
      'title', g.title,
      'instruction', g.instruction,
      'passage', g.passage,
      'documents', g.documents,
      'audio_url', g.audio_url,
      'image_url', g.image_url
    ) order by g.sort_order, g.created_at
  ), '[]'::jsonb) into v_groups
  from public.toeic_test_groups g
  where g.test_id = p_test_id and g.is_active = true;

  -- Get active questions — EXCLUDING correct_answer AND explanation
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
-- 7. RPC: save_toeic_answer
--    Validates ownership, in-progress status, canonical answer
-- ============================================================
create or replace function public.save_toeic_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_attempt record;
  v_question record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
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

  -- Check if time has expired
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
