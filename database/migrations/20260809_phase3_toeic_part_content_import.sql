-- ============================================================
-- Phase P3.5J: Admin Atomic TOEIC Part Content Importer RPC
-- Migration: 20260809_phase3_toeic_part_content_import.sql
-- Function: public.admin_import_toeic_part_content
-- Atomic transaction to upsert groups & questions for a specific TOEIC Part.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_import_toeic_part_content(
  p_test_id uuid,
  p_part text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_test_published boolean;
  v_groups jsonb;
  v_questions jsonb;
  v_import_answers boolean;
  v_group_elem jsonb;
  v_question_elem jsonb;
  
  v_start_q int;
  v_end_q int;
  v_part_name text;
  v_g_type text;
  v_existing_group_id uuid;
  v_target_group_id uuid;
  v_groups_updated int := 0;
  v_groups_inserted int := 0;

  v_q_num int;
  v_q_part text;
  v_existing_q_id uuid;
  v_existing_q_correct text;
  v_final_correct text;
  v_questions_updated int := 0;
  v_questions_inserted int := 0;
BEGIN
  -- 1. Check permissions (Admin check)
  IF NOT (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') IN ('admin', 'service_role')
    OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') IN ('admin', 'service_role')
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required.';
  END IF;

  -- 2. Check if test exists and is_published status
  SELECT is_published INTO v_test_published
  FROM public.toeic_tests
  WHERE id = p_test_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test not found with ID %', p_test_id;
  END IF;

  IF v_test_published = true THEN
    RAISE EXCEPTION 'Unpublish đề trước khi cập nhật nội dung câu hỏi.';
  END IF;

  v_groups := COALESCE(p_payload -> 'groups', '[]'::jsonb);
  v_questions := COALESCE(p_payload -> 'questions', '[]'::jsonb);
  v_import_answers := COALESCE((p_payload ->> 'import_answers')::boolean, false);
  v_part_name := LOWER(TRIM(p_part));

  -- 3. Process Groups
  FOR v_group_elem IN SELECT * FROM jsonb_array_elements(v_groups)
  LOOP
    v_start_q := (v_group_elem ->> 'start_question')::int;
    v_end_q := (v_group_elem ->> 'end_question')::int;
    v_g_type := COALESCE(v_group_elem ->> 'group_type', 
      CASE 
        WHEN v_part_name = 'part1' THEN 'photo'
        WHEN v_part_name = 'part2' THEN 'question_response'
        WHEN v_part_name = 'part3' THEN 'conversation'
        WHEN v_part_name = 'part4' THEN 'talk'
        WHEN v_part_name = 'part5' THEN 'standalone'
        WHEN v_part_name = 'part6' THEN 'text_completion'
        WHEN v_part_name = 'part7' THEN 'reading_set'
        ELSE 'standalone'
      END
    );

    -- Find existing group by (test_id, part, start_question, end_question)
    SELECT id INTO v_existing_group_id
    FROM public.toeic_test_groups
    WHERE test_id = p_test_id
      AND part = v_part_name
      AND start_question = v_start_q
      AND end_question = v_end_q
    LIMIT 1;

    IF v_existing_group_id IS NOT NULL THEN
      -- Update existing group
      UPDATE public.toeic_test_groups
      SET
        group_type = v_g_type,
        title = COALESCE(v_group_elem ->> 'title', title),
        instruction = COALESCE(v_group_elem ->> 'instruction', instruction),
        instruction_vi = COALESCE(v_group_elem ->> 'instruction_vi', instruction_vi),
        passage = COALESCE(v_group_elem ->> 'passage', passage),
        passage_vi = COALESCE(v_group_elem ->> 'passage_vi', passage_vi),
        transcript = COALESCE(v_group_elem ->> 'transcript', transcript),
        transcript_vi = COALESCE(v_group_elem ->> 'transcript_vi', transcript_vi),
        documents = CASE WHEN (v_group_elem ? 'documents') THEN (v_group_elem -> 'documents') ELSE documents END,
        documents_vi = CASE WHEN (v_group_elem ? 'documents_vi') THEN (v_group_elem -> 'documents_vi') ELSE documents_vi END,
        updated_at = NOW()
      WHERE id = v_existing_group_id;

      v_groups_updated := v_groups_updated + 1;
    ELSE
      -- Insert new group
      INSERT INTO public.toeic_test_groups (
        test_id,
        part,
        start_question,
        end_question,
        group_type,
        title,
        instruction,
        instruction_vi,
        passage,
        passage_vi,
        transcript,
        transcript_vi,
        documents,
        documents_vi,
        is_active
      ) VALUES (
        p_test_id,
        v_part_name,
        v_start_q,
        v_end_q,
        v_g_type,
        v_group_elem ->> 'title',
        v_group_elem ->> 'instruction',
        v_group_elem ->> 'instruction_vi',
        v_group_elem ->> 'passage',
        v_group_elem ->> 'passage_vi',
        v_group_elem ->> 'transcript',
        v_group_elem ->> 'transcript_vi',
        COALESCE(v_group_elem -> 'documents', '[]'::jsonb),
        COALESCE(v_group_elem -> 'documents_vi', '[]'::jsonb),
        true
      );

      v_groups_inserted := v_groups_inserted + 1;
    END IF;
  END LOOP;

  -- 4. Process Questions
  FOR v_question_elem IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_q_num := (v_question_elem ->> 'question_number')::int;
    v_q_part := COALESCE(v_question_elem ->> 'part', v_part_name);

    -- Find matching group_id for this question if it belongs to a group
    SELECT id INTO v_target_group_id
    FROM public.toeic_test_groups
    WHERE test_id = p_test_id
      AND part = v_q_part
      AND start_question <= v_q_num
      AND end_question >= v_q_num
    LIMIT 1;

    -- Find existing question by (test_id, question_number)
    SELECT id, correct_answer INTO v_existing_q_id, v_existing_q_correct
    FROM public.toeic_test_questions
    WHERE test_id = p_test_id
      AND question_number = v_q_num;

    IF v_import_answers = true AND (v_question_elem ? 'correct_answer') AND (v_question_elem ->> 'correct_answer') IS NOT NULL THEN
      v_final_correct := UPPER(TRIM(v_question_elem ->> 'correct_answer'));
    ELSE
      v_final_correct := v_existing_q_correct;
    END IF;

    IF v_existing_q_id IS NOT NULL THEN
      -- Update existing question
      UPDATE public.toeic_test_questions
      SET
        group_id = COALESCE(v_target_group_id, group_id),
        part = v_q_part,
        question_text = COALESCE(v_question_elem ->> 'question_text', question_text),
        options = CASE WHEN (v_question_elem ? 'options') THEN (v_question_elem -> 'options') ELSE options END,
        options_vi = CASE WHEN (v_question_elem ? 'options_vi') THEN (v_question_elem -> 'options_vi') ELSE options_vi END,
        translation_vi = COALESCE(v_question_elem ->> 'translation_vi', translation_vi),
        explanation = COALESCE(v_question_elem ->> 'explanation', explanation),
        correct_answer = COALESCE(v_final_correct, correct_answer),
        updated_at = NOW()
      WHERE id = v_existing_q_id;

      v_questions_updated := v_questions_updated + 1;
    ELSE
      -- Insert new question
      INSERT INTO public.toeic_test_questions (
        test_id,
        group_id,
        question_number,
        part,
        question_text,
        options,
        options_vi,
        translation_vi,
        explanation,
        correct_answer,
        is_active
      ) VALUES (
        p_test_id,
        v_target_group_id,
        v_q_num,
        v_q_part,
        v_question_elem ->> 'question_text',
        COALESCE(v_question_elem -> 'options', '[]'::jsonb),
        v_question_elem -> 'options_vi',
        v_question_elem ->> 'translation_vi',
        v_question_elem ->> 'explanation',
        COALESCE(v_final_correct, 'A'),
        true
      );

      v_questions_inserted := v_questions_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'part', v_part_name,
    'groups_updated', v_groups_updated,
    'groups_inserted', v_groups_inserted,
    'questions_updated', v_questions_updated,
    'questions_inserted', v_questions_inserted
  );
END;
$$;
