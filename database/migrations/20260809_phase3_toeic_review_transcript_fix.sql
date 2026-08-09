-- ============================================================
-- Phase 3.6C Production Hotfix: Fix get_student_toeic_attempt_review Column References
-- Description: Fixes RPC error "column q.transcript does not exist" by selecting only existing table columns
-- Target Tables: toeic_test_questions (no q.transcript column), toeic_test_groups (g.transcript exists)
-- Security: SECURITY DEFINER, SET search_path = '', auth.uid() owner check, status = 'submitted' check
-- ============================================================

create or replace function public.get_student_toeic_attempt_review(
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_attempt record;
  v_test record;
  v_part_prefix text;
  v_questions jsonb;
  v_groups jsonb;
  v_total_questions integer := 0;
  v_answered_count integer := 0;
  v_correct_count integer := 0;
  v_incorrect_count integer := 0;
  v_unanswered_count integer := 0;
  v_score_percent integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.has_active_access() then raise exception 'Access expired or inactive'; end if;

  select id, test_id, user_id, status, mode, part_number, started_at, submitted_at, elapsed_seconds
  into v_attempt
  from public.toeic_test_attempts
  where id = p_attempt_id;

  if v_attempt is null then raise exception 'Attempt not found'; end if;
  if v_attempt.user_id <> v_user_id and not public.is_admin() then raise exception 'Permission denied'; end if;
  if v_attempt.status <> 'submitted' then raise exception 'Attempt is not submitted'; end if;

  select id, title, test_code, listening_audio_mode, listening_audio_url
  into v_test
  from public.toeic_tests
  where id = v_attempt.test_id;

  if v_attempt.mode = 'part' then
    v_part_prefix := 'part' || v_attempt.part_number::text;
  end if;

  -- Build questions review payload using ONLY existing columns on toeic_test_questions
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'question_number', q.question_number,
      'part', q.part,
      'group_id', q.group_id,
      'question_text', q.question_text,
      'options', q.options,
      'options_vi', null,
      'student_answer', a.selected_answer,
      'correct_answer', q.correct_answer,
      'is_correct', (a.selected_answer is not null and a.selected_answer = q.correct_answer),
      'explanation', q.explanation,
      'translation_vi', null,
      'transcript', null,
      'transcript_vi', null,
      'image_url', q.image_url,
      'audio_url', q.audio_url,
      'cue_start_ms', null,
      'cue_end_ms', null
    ) order by q.question_number
  ), '[]'::jsonb)
  into v_questions
  from public.toeic_test_questions q
  left join public.toeic_test_attempt_answers a on a.question_id = q.id and a.attempt_id = v_attempt.id
  where q.test_id = v_attempt.test_id
    and q.is_active = true
    and (v_attempt.mode = 'full' or q.part = v_part_prefix);

  -- Build groups review payload using ONLY existing columns on toeic_test_groups (g.transcript exists)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'part', g.part,
      'title', g.title,
      'instruction', g.instruction,
      'instruction_vi', null,
      'passage', g.passage,
      'passage_vi', null,
      'transcript', g.transcript,
      'transcript_vi', null,
      'audio_url', g.audio_url,
      'image_url', g.image_url,
      'documents', g.documents,
      'documents_vi', null,
      'cue_start_ms', null,
      'cue_end_ms', null
    ) order by g.sort_order, g.created_at
  ), '[]'::jsonb)
  into v_groups
  from public.toeic_test_groups g
  where g.test_id = v_attempt.test_id
    and (v_attempt.mode = 'full' or g.part = v_part_prefix);

  -- Calculate summary metrics
  select count(*) into v_total_questions
  from public.toeic_test_questions
  where test_id = v_attempt.test_id and is_active = true
    and (v_attempt.mode = 'full' or part = v_part_prefix);

  select count(*) into v_answered_count
  from public.toeic_test_attempt_answers a
  join public.toeic_test_questions q on q.id = a.question_id
  where a.attempt_id = v_attempt.id and a.selected_answer is not null
    and (v_attempt.mode = 'full' or q.part = v_part_prefix);

  select count(*) into v_correct_count
  from public.toeic_test_attempt_answers a
  join public.toeic_test_questions q on q.id = a.question_id
  where a.attempt_id = v_attempt.id
    and a.selected_answer is not null
    and a.selected_answer = q.correct_answer
    and (v_attempt.mode = 'full' or q.part = v_part_prefix);

  v_unanswered_count := greatest(0, v_total_questions - v_answered_count);
  v_incorrect_count := greatest(0, v_answered_count - v_correct_count);
  if v_total_questions > 0 then
    v_score_percent := round((v_correct_count::numeric / v_total_questions::numeric) * 100);
  end if;

  return jsonb_build_object(
    'test', jsonb_build_object(
      'id', v_test.id,
      'title', v_test.title,
      'test_code', v_test.test_code,
      'listening_audio_mode', v_test.listening_audio_mode,
      'listening_audio_url', v_test.listening_audio_url
    ),
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'mode', v_attempt.mode,
      'part_number', v_attempt.part_number,
      'status', v_attempt.status,
      'submitted_at', v_attempt.submitted_at,
      'elapsed_seconds', v_attempt.elapsed_seconds
    ),
    'result', jsonb_build_object(
      'total_count', v_total_questions,
      'answered_count', v_answered_count,
      'unanswered_count', v_unanswered_count,
      'correct_count', v_correct_count,
      'incorrect_count', v_incorrect_count,
      'score_percent', v_score_percent
    ),
    'questions', v_questions,
    'groups', v_groups
  );
end;
$$;

revoke execute on function public.get_student_toeic_attempt_review(uuid) from public;
grant execute on function public.get_student_toeic_attempt_review(uuid) to authenticated;
