-- ============================================================
-- Phase P3.6A: Student Full TOEIC Test Runner Foundation
-- HARDENED MIGRATION — Full Test + Practice by Part
-- All student mutations via controlled RPCs
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
  mode text not null default 'full'
    check (mode in ('full', 'part')),
  part_number integer
    check (
      (mode = 'full' and part_number is null) or
      (mode = 'part' and part_number between 1 and 7)
    ),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  submitted_at timestamptz,
  current_question_number integer not null default 1
    check (current_question_number >= 1 and current_question_number <= 200),
  elapsed_seconds integer not null default 0
    check (elapsed_seconds >= 0),
  duration_minutes integer default 120
    check (
      (mode = 'full' and duration_minutes = 120) or
      (mode = 'part' and duration_minutes is null)
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active FULL attempt per user per test
create unique index if not exists idx_one_active_full_attempt
  on public.toeic_test_attempts (user_id, test_id)
  where status = 'in_progress' and mode = 'full';

-- One active PART attempt per user per test per part_number
create unique index if not exists idx_one_active_part_attempt
  on public.toeic_test_attempts (user_id, test_id, part_number)
  where status = 'in_progress' and mode = 'part';

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
--    to ADMIN ONLY — prevents students from reading correct_answer
-- ============================================================
drop policy if exists "admin_toeic_test_questions_select" on public.toeic_test_questions;
create policy "admin_toeic_test_questions_select" on public.toeic_test_questions
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_toeic_test_groups_select" on public.toeic_test_groups;
create policy "admin_toeic_test_groups_select" on public.toeic_test_groups
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_toeic_tests_select" on public.toeic_tests;
create policy "admin_toeic_tests_select" on public.toeic_tests
  for select to authenticated
  using (
    public.is_admin()
    or (is_published = true and public.has_active_access())
  );

-- ============================================================
-- 7. MEDIA AUTHORIZATION HELPER
-- ============================================================
create or replace function public.can_access_toeic_media(p_path text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then return true; end if;
  if auth.uid() is null then return false; end if;
  if not public.has_active_access() then return false; end if;

  if exists (
    select 1 from public.toeic_test_questions q
    join public.toeic_tests t on t.id = q.test_id
    where t.is_published = true and q.is_active = true
      and (q.image_url = p_path or q.audio_url = p_path)
  ) then return true; end if;

  if exists (
    select 1 from public.toeic_test_groups g
    join public.toeic_tests t on t.id = g.test_id
    where t.is_published = true and g.is_active = true
      and (g.image_url = p_path or g.audio_url = p_path)
  ) then return true; end if;

  return false;
end;
$$;

drop policy if exists student_media_select on storage.objects;
create policy student_media_select on storage.objects
  for select to authenticated
  using (bucket_id = 'toeic-media' and public.can_access_toeic_media(name));

-- ============================================================
-- 8. HELPER: part_number to canonical part string
-- ============================================================
create or replace function public._toeic_part_key(p_part_number integer)
returns text
language sql
immutable
as $$
  select 'part' || p_part_number::text;
$$;

-- ============================================================
-- 9. HELPER: question number range for a part
-- ============================================================
create or replace function public._toeic_part_range(p_part_number integer)
returns int4range
language sql
immutable
as $$
  select case p_part_number
    when 1 then int4range(1, 7)      -- Q1-6
    when 2 then int4range(7, 32)     -- Q7-31
    when 3 then int4range(32, 71)    -- Q32-70
    when 4 then int4range(71, 101)   -- Q71-100
    when 5 then int4range(101, 131)  -- Q101-130
    when 6 then int4range(131, 147)  -- Q131-146
    when 7 then int4range(147, 201)  -- Q147-200
  end;
$$;

-- ============================================================
-- 10. HELPER: first question number for a part
-- ============================================================
create or replace function public._toeic_part_start(p_part_number integer)
returns integer
language sql
immutable
as $$
  select case p_part_number
    when 1 then 1   when 2 then 7   when 3 then 32
    when 4 then 71  when 5 then 101 when 6 then 131 when 7 then 147
  end;
$$;

-- ============================================================
-- 11. RPC: start_or_resume_toeic_test (RACE-SAFE, mode-aware)
-- ============================================================
create or replace function public.start_or_resume_toeic_test(
  p_test_id uuid,
  p_mode text default 'full',
  p_part_number integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_attempt_id uuid;
  v_test_published boolean;
  v_start_qn integer;
  v_dur integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_active_access() then
    raise exception 'Access expired or inactive';
  end if;

  -- Validate mode
  if p_mode not in ('full', 'part') then
    raise exception 'Invalid mode (must be full or part)';
  end if;

  if p_mode = 'full' and p_part_number is not null then
    raise exception 'Full mode must not specify part_number';
  end if;

  if p_mode = 'part' then
    if p_part_number is null or p_part_number < 1 or p_part_number > 7 then
      raise exception 'Part mode requires part_number between 1 and 7';
    end if;
  end if;

  -- Check test exists and is published
  select is_published into v_test_published
  from public.toeic_tests where id = p_test_id;

  if v_test_published is null then raise exception 'Test not found'; end if;
  if not v_test_published then raise exception 'Test is not published'; end if;

  -- Determine start question and duration
  if p_mode = 'full' then
    v_start_qn := 1;
    v_dur := 120;
  else
    v_start_qn := public._toeic_part_start(p_part_number);
    v_dur := null; -- Part practice: no server-enforced time limit
  end if;

  -- Try to find existing in-progress attempt
  if p_mode = 'full' then
    select id into v_attempt_id
    from public.toeic_test_attempts
    where user_id = v_user_id and test_id = p_test_id
      and status = 'in_progress' and mode = 'full';
  else
    select id into v_attempt_id
    from public.toeic_test_attempts
    where user_id = v_user_id and test_id = p_test_id
      and status = 'in_progress' and mode = 'part'
      and part_number = p_part_number;
  end if;

  if v_attempt_id is not null then
    update public.toeic_test_attempts
    set last_activity_at = now(), updated_at = now()
    where id = v_attempt_id;

    return jsonb_build_object('attempt_id', v_attempt_id, 'resumed', true);
  end if;

  -- Race-safe INSERT
  begin
    insert into public.toeic_test_attempts
      (user_id, test_id, status, mode, part_number, started_at, last_activity_at,
       current_question_number, duration_minutes)
    values
      (v_user_id, p_test_id, 'in_progress', p_mode, p_part_number, now(), now(),
       v_start_qn, v_dur)
    returning id into v_attempt_id;

    return jsonb_build_object('attempt_id', v_attempt_id, 'resumed', false);
  exception when unique_violation then
    if p_mode = 'full' then
      select id into v_attempt_id
      from public.toeic_test_attempts
      where user_id = v_user_id and test_id = p_test_id
        and status = 'in_progress' and mode = 'full';
    else
      select id into v_attempt_id
      from public.toeic_test_attempts
      where user_id = v_user_id and test_id = p_test_id
        and status = 'in_progress' and mode = 'part'
        and part_number = p_part_number;
    end if;

    update public.toeic_test_attempts
    set last_activity_at = now(), updated_at = now()
    where id = v_attempt_id;

    return jsonb_build_object('attempt_id', v_attempt_id, 'resumed', true);
  end;
end;
$$;

-- ============================================================
-- 12. (MOVED to section 16 — mode-aware translation version)
-- ============================================================

-- ============================================================
-- 13. RPC: save_toeic_answer (scope-aware, non-decreasing elapsed_seconds)
-- ============================================================
create or replace function public.save_toeic_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_answer text,
  p_elapsed_seconds integer default null
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
  v_new_elapsed integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.has_active_access() then raise exception 'Access expired or inactive'; end if;

  -- Verify attempt ownership and status
  select id, test_id, status, mode, part_number, started_at, duration_minutes, elapsed_seconds
  into v_attempt
  from public.toeic_test_attempts
  where id = p_attempt_id and user_id = v_user_id and status = 'in_progress';

  if v_attempt is null then raise exception 'Attempt not found or not in progress'; end if;

  -- Verify parent test is still published
  select is_published into v_test_published
  from public.toeic_tests where id = v_attempt.test_id;
  if v_test_published is not true then raise exception 'Test is no longer published'; end if;

  -- Check timer expiry (full mode only; part mode has no enforced limit)
  if v_attempt.duration_minutes is not null then
    if now() > (v_attempt.started_at + (v_attempt.duration_minutes || ' minutes')::interval) then
      raise exception 'Test time has expired';
    end if;
  end if;

  -- Verify question belongs to the attempt's test and is active
  select id, part, question_number into v_question
  from public.toeic_test_questions
  where id = p_question_id and test_id = v_attempt.test_id and is_active = true;

  if v_question is null then
    raise exception 'Question not found or does not belong to this test';
  end if;

  -- SCOPE CHECK: Part mode must only allow questions in the part range
  if v_attempt.mode = 'part' and v_attempt.part_number is not null then
    if not (v_question.question_number <@ public._toeic_part_range(v_attempt.part_number)) then
      raise exception 'Question is outside the scope of this part attempt';
    end if;
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

  -- Compute non-decreasing elapsed_seconds with anti-corruption cap
  v_new_elapsed := v_attempt.elapsed_seconds;
  if p_elapsed_seconds is not null and p_elapsed_seconds >= 0 then
    if p_elapsed_seconds >= v_attempt.elapsed_seconds then
      if (p_elapsed_seconds - v_attempt.elapsed_seconds) <= 86400 then
        v_new_elapsed := p_elapsed_seconds;
      end if;
    end if;
  end if;

  -- Upsert answer
  insert into public.toeic_test_attempt_answers (attempt_id, question_id, selected_answer, answered_at)
  values (p_attempt_id, p_question_id, p_selected_answer, now())
  on conflict (attempt_id, question_id)
  do update set selected_answer = excluded.selected_answer,
    answered_at = excluded.answered_at, updated_at = now();

  update public.toeic_test_attempts
  set elapsed_seconds = v_new_elapsed,
      last_activity_at = now(), updated_at = now()
  where id = p_attempt_id;

  return jsonb_build_object('saved', true);
end;
$$;

-- ============================================================
-- 14. RPC: update_toeic_attempt_progress
-- ============================================================
create or replace function public.update_toeic_attempt_progress(
  p_attempt_id uuid,
  p_current_question_number integer,
  p_elapsed_seconds integer default null
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
  v_new_elapsed integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.has_active_access() then raise exception 'Access expired or inactive'; end if;

  if p_current_question_number < 1 or p_current_question_number > 200 then
    raise exception 'Question number must be between 1 and 200';
  end if;

  select id, test_id, mode, part_number, started_at, duration_minutes, elapsed_seconds
  into v_attempt
  from public.toeic_test_attempts
  where id = p_attempt_id and user_id = v_user_id and status = 'in_progress';

  if v_attempt is null then raise exception 'Attempt not found or not in progress'; end if;

  select is_published into v_test_published
  from public.toeic_tests where id = v_attempt.test_id;
  if v_test_published is not true then raise exception 'Test is no longer published'; end if;

  if v_attempt.duration_minutes is not null then
    if now() > (v_attempt.started_at + (v_attempt.duration_minutes || ' minutes')::interval) then
      raise exception 'Test time has expired';
    end if;
  end if;

  -- Scope check for part mode
  if v_attempt.mode = 'part' and v_attempt.part_number is not null then
    if not (p_current_question_number <@ public._toeic_part_range(v_attempt.part_number)) then
      raise exception 'Question number is outside the scope of this part attempt';
    end if;
  end if;

  -- Compute non-decreasing elapsed_seconds with anti-corruption cap
  v_new_elapsed := v_attempt.elapsed_seconds;
  if p_elapsed_seconds is not null and p_elapsed_seconds >= 0 then
    if p_elapsed_seconds >= v_attempt.elapsed_seconds then
      if (p_elapsed_seconds - v_attempt.elapsed_seconds) <= 86400 then
        v_new_elapsed := p_elapsed_seconds;
      end if;
    end if;
  end if;

  update public.toeic_test_attempts
  set current_question_number = p_current_question_number,
      elapsed_seconds = v_new_elapsed,
      last_activity_at = now(), updated_at = now()
  where id = p_attempt_id;

  return jsonb_build_object('updated', true, 'elapsed_seconds', v_new_elapsed);
end;
$$;

-- ============================================================
-- 15. TRANSLATION COLUMNS (ALTER existing Production tables)
--     Stored once globally — reused by all students.
--     DO NOT edit P3.5C migration — ALTER here.
-- ============================================================
alter table public.toeic_test_questions
  add column if not exists translation_vi text,
  add column if not exists options_vi jsonb;

alter table public.toeic_test_groups
  add column if not exists instruction_vi text,
  add column if not exists passage_vi text,
  add column if not exists documents_vi jsonb;

-- ============================================================
-- 15b. SAVED WORDS & SYSTEM VOCABULARY — METADATA & SCOPED INDEX
--      Per-user TOEIC context stored on saved_words, not global vocab.
--      System namespace column on vocabulary_items for isolated deduplication.
--      Curated rows: system_namespace = NULL (unconstrained).
--      TOEIC practice rows: system_namespace = 'toeic_practice'.
-- ============================================================
alter table public.vocabulary_items
  add column if not exists system_namespace text null;

alter table public.saved_words
  add column if not exists source_type text,
  add column if not exists source_test_id uuid references public.toeic_tests(id) on delete set null,
  add column if not exists source_question_id uuid references public.toeic_test_questions(id) on delete set null,
  add column if not exists source_part integer,
  add column if not exists context_text text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_saved_words_source_part'
  ) then
    alter table public.saved_words
      add constraint check_saved_words_source_part
      check (source_part is null or (source_part between 1 and 7));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'check_saved_words_context_length'
  ) then
    alter table public.saved_words
      add constraint check_saved_words_context_length
      check (context_text is null or char_length(context_text) <= 500);
  end if;
end $$;

-- Drop previous un-scoped unique index if created
drop index if exists public.idx_toeic_practice_normalized_word;

-- Scoped unique index ONLY for system vocabulary — curated rows (system_namespace IS NULL) are unaffected
create unique index if not exists idx_toeic_practice_normalized_word
  on public.vocabulary_items (system_namespace, lower(trim(word)))
  where system_namespace = 'toeic_practice';

-- ============================================================
-- 16. UPDATE: get_student_toeic_test_content (mode-aware translation)
--     FULL mode: NO translation fields
--     PART mode: include translation fields
--     NEVER returns correct_answer or explanation.
--     STRICT PARAMETER VALIDATION
-- ============================================================
create or replace function public.get_student_toeic_test_content(
  p_test_id uuid,
  p_mode text default 'full',
  p_part_number integer default null
)
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
  v_part_key text;
  v_qn_range int4range;
  v_include_translation boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.has_active_access() then raise exception 'Access expired or inactive'; end if;

  -- STRICT mode validation — no silent fallbacks
  if p_mode not in ('full', 'part') then
    raise exception 'Invalid mode (must be full or part)';
  end if;

  if p_mode = 'full' and p_part_number is not null then
    raise exception 'Full mode must not specify part_number';
  end if;

  if p_mode = 'part' then
    if p_part_number is null or p_part_number < 1 or p_part_number > 7 then
      raise exception 'Part mode requires part_number between 1 and 7';
    end if;
  end if;

  v_include_translation := (p_mode = 'part');

  select jsonb_build_object(
    'id', id, 'title', title, 'test_code', test_code,
    'description', description, 'test_type', test_type
  ) into v_test
  from public.toeic_tests
  where id = p_test_id and is_published = true;

  if v_test is null then raise exception 'Test not found or not published'; end if;

  if p_mode = 'part' and p_part_number is not null then
    v_part_key := public._toeic_part_key(p_part_number);
    v_qn_range := public._toeic_part_range(p_part_number);
  end if;

  -- Groups
  if v_part_key is not null then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sub.id, 'part', sub.part, 'group_type', sub.group_type,
        'title', sub.title, 'instruction', sub.instruction,
        'passage', sub.passage, 'documents', sub.documents,
        'audio_url', sub.audio_url, 'image_url', sub.image_url,
        'instruction_vi', case when v_include_translation then sub.instruction_vi else null end,
        'passage_vi', case when v_include_translation then sub.passage_vi else null end,
        'documents_vi', case when v_include_translation then sub.documents_vi else null end
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
      where g.test_id = p_test_id and g.is_active = true and g.part = v_part_key
    ) sub;
  else
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sub.id, 'part', sub.part, 'group_type', sub.group_type,
        'title', sub.title, 'instruction', sub.instruction,
        'passage', sub.passage, 'documents', sub.documents,
        'audio_url', sub.audio_url, 'image_url', sub.image_url
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
  end if;

  -- Questions
  if v_qn_range is not null then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', q.id, 'group_id', q.group_id,
        'question_number', q.question_number, 'part', q.part,
        'question_text', q.question_text, 'options', q.options,
        'skill_tag', q.skill_tag, 'topic', q.topic,
        'audio_url', q.audio_url, 'image_url', q.image_url,
        'translation_vi', case when v_include_translation then q.translation_vi else null end,
        'options_vi', case when v_include_translation then q.options_vi else null end
      ) order by q.question_number
    ), '[]'::jsonb) into v_questions
    from public.toeic_test_questions q
    where q.test_id = p_test_id and q.is_active = true
      and q.question_number <@ v_qn_range;
  else
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', q.id, 'group_id', q.group_id,
        'question_number', q.question_number, 'part', q.part,
        'question_text', q.question_text, 'options', q.options,
        'skill_tag', q.skill_tag, 'topic', q.topic,
        'audio_url', q.audio_url, 'image_url', q.image_url
      ) order by q.question_number
    ), '[]'::jsonb) into v_questions
    from public.toeic_test_questions q
    where q.test_id = p_test_id and q.is_active = true;
  end if;

  return jsonb_build_object(
    'test', v_test, 'groups', v_groups, 'questions', v_questions
  );
end;
$$;

-- ============================================================
-- 17. RPC: save_toeic_word
--     Reuses existing vocabulary_items + saved_words system.
--     Race-safe system deck creation (slug ON CONFLICT DO NOTHING).
--     Race-safe normalized word deduplication in system_namespace = 'toeic_practice'.
--     Does NOT accept or overwrite student-supplied meaning_vi.
--     Per-user TOEIC context stored on saved_words (source columns).
-- ============================================================
create or replace function public.save_toeic_word(
  p_attempt_id uuid,
  p_question_id uuid,
  p_word text,
  p_context_sentence text default null
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
  v_deck_id uuid;
  v_vocab_id uuid;
  v_normalized_word text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.has_active_access() then raise exception 'Access expired or inactive'; end if;

  -- Validate input
  v_normalized_word := lower(trim(p_word));
  if v_normalized_word = '' or length(v_normalized_word) > 100 then
    raise exception 'Invalid word';
  end if;

  -- Verify attempt: must be part mode, in_progress, owned by user
  select id, test_id, mode, part_number, status
  into v_attempt
  from public.toeic_test_attempts
  where id = p_attempt_id and user_id = v_user_id;

  if v_attempt is null then raise exception 'Attempt not found'; end if;
  if v_attempt.status != 'in_progress' then raise exception 'Attempt not in progress'; end if;
  if v_attempt.mode != 'part' then raise exception 'Save Word is only available in Part Practice mode'; end if;

  -- Verify test published
  select is_published into v_test_published
  from public.toeic_tests where id = v_attempt.test_id;
  if v_test_published is not true then raise exception 'Test is no longer published'; end if;

  -- Verify question belongs to attempt's test and is in scope
  select id, part, question_number into v_question
  from public.toeic_test_questions
  where id = p_question_id and test_id = v_attempt.test_id and is_active = true;

  if v_question is null then raise exception 'Question not found'; end if;

  if not (v_question.question_number <@ public._toeic_part_range(v_attempt.part_number)) then
    raise exception 'Question is outside the scope of this part attempt';
  end if;

  -- Race-safe system deck fetch/creation (NOT published as a public learning deck)
  select id into v_deck_id
  from public.vocabulary_decks
  where slug = 'toeic-practice';

  if v_deck_id is null then
    insert into public.vocabulary_decks (slug, title, description, level, is_published)
    values ('toeic-practice', 'TOEIC Practice', 'Từ vựng lưu từ luyện TOEIC (hệ thống)', 'mixed', false)
    on conflict (slug) do nothing;

    select id into v_deck_id
    from public.vocabulary_decks
    where slug = 'toeic-practice';
  end if;

  -- Race-safe system vocabulary item lookup & insertion (scoped to system_namespace = 'toeic_practice')
  select id into v_vocab_id
  from public.vocabulary_items
  where system_namespace = 'toeic_practice' and lower(trim(word)) = v_normalized_word
  limit 1;

  if v_vocab_id is null then
    begin
      insert into public.vocabulary_items (
        deck_id, word, meaning_vi, example_en, topic, toeic_parts, is_published, system_namespace
      ) values (
        v_deck_id,
        v_normalized_word,
        '',
        '',
        'TOEIC',
        array['part' || v_attempt.part_number],
        true,
        'toeic_practice'
      )
      returning id into v_vocab_id;
    exception when unique_violation then
      select id into v_vocab_id
      from public.vocabulary_items
      where system_namespace = 'toeic_practice' and lower(trim(word)) = v_normalized_word
      limit 1;
    end;
  end if;

  -- Upsert saved_words with per-user TOEIC source context
  -- ON CONFLICT: update source context to most recent explicit save
  insert into public.saved_words (
    user_id, vocabulary_id,
    source_type, source_test_id, source_question_id, source_part, context_text
  ) values (
    v_user_id, v_vocab_id,
    'toeic_test', v_attempt.test_id, p_question_id, v_attempt.part_number,
    left(coalesce(p_context_sentence, ''), 500)
  )
  on conflict (user_id, vocabulary_id) do update set
    source_type = 'toeic_test',
    source_test_id = excluded.source_test_id,
    source_question_id = excluded.source_question_id,
    source_part = excluded.source_part,
    context_text = excluded.context_text;

  return jsonb_build_object(
    'saved', true,
    'vocabulary_id', v_vocab_id,
    'word', v_normalized_word
  );
end;
$$;

-- ============================================================
-- 18. EXECUTE PRIVILEGE CONTROL
-- ============================================================
revoke execute on function public.start_or_resume_toeic_test(uuid, text, integer) from public;
revoke execute on function public.start_or_resume_toeic_test(uuid, text, integer) from anon;
grant execute on function public.start_or_resume_toeic_test(uuid, text, integer) to authenticated;

revoke execute on function public.get_student_toeic_test_content(uuid, text, integer) from public;
revoke execute on function public.get_student_toeic_test_content(uuid, text, integer) from anon;
grant execute on function public.get_student_toeic_test_content(uuid, text, integer) to authenticated;

revoke execute on function public.save_toeic_answer(uuid, uuid, text, integer) from public;
revoke execute on function public.save_toeic_answer(uuid, uuid, text, integer) from anon;
grant execute on function public.save_toeic_answer(uuid, uuid, text, integer) to authenticated;

revoke execute on function public.update_toeic_attempt_progress(uuid, integer, integer) from public;
revoke execute on function public.update_toeic_attempt_progress(uuid, integer, integer) from anon;
grant execute on function public.update_toeic_attempt_progress(uuid, integer, integer) to authenticated;

revoke execute on function public.can_access_toeic_media(text) from public;
revoke execute on function public.can_access_toeic_media(text) from anon;
grant execute on function public.can_access_toeic_media(text) to authenticated;

revoke execute on function public.save_toeic_word(uuid, uuid, text, text) from public;
revoke execute on function public.save_toeic_word(uuid, uuid, text, text) from anon;
grant execute on function public.save_toeic_word(uuid, uuid, text, text) to authenticated;


