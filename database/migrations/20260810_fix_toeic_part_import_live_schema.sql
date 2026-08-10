-- ============================================================
-- Phase P3.5J Hotfix: Update-Only Schema-Safe TOEIC Part Content Importer RPC
-- Migration: 20260810_fix_toeic_part_import_live_schema.sql
-- Description: Aligns admin_import_toeic_part_content with live Production schema.
--              Update-only strategy: Never references non-existent columns (start_question/end_question on toeic_test_groups).
--              Does NOT create structural records or fake default answers.
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
  v_target_group_id uuid;
  v_group_matches_count int;
  v_groups_updated int := 0;
  v_has_group_content boolean;

  v_q_num int;
  v_q_part text;
  v_existing_q_id uuid;
  v_q_matches_count int;
  v_questions_updated int := 0;
BEGIN
  -- 1. Canonical ORI Admin Security Check
  IF NOT (
    public.is_admin()
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Permission denied: admin role required.';
  END IF;

  -- 2. Validate Part Name
  v_part_name := LOWER(TRIM(p_part));
  IF v_part_name NOT IN ('part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7') THEN
    RAISE EXCEPTION 'Mã Part không hợp lệ: %', p_part;
  END IF;

  -- 3. Check if test exists and is_published status
  SELECT is_published INTO v_test_published
  FROM public.toeic_tests
  WHERE id = p_test_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy đề thi với ID %', p_test_id;
  END IF;

  IF v_test_published = true THEN
    RAISE EXCEPTION 'Đề đang được xuất bản. Unpublish trước khi cập nhật nội dung song ngữ.';
  END IF;

  v_groups := COALESCE(p_payload -> 'groups', '[]'::jsonb);
  v_questions := COALESCE(p_payload -> 'questions', '[]'::jsonb);
  v_import_answers := COALESCE((p_payload ->> 'import_answers')::boolean, false);

  -- 4. Process Groups (Update-Only)
  FOR v_group_elem IN SELECT * FROM jsonb_array_elements(v_groups)
  LOOP
    v_has_group_content := (v_group_elem ? 'transcript') OR (v_group_elem ? 'transcript_vi') 
      OR (v_group_elem ? 'passage') OR (v_group_elem ? 'passage_vi') 
      OR (v_group_elem ? 'documents') OR (v_group_elem ? 'documents_vi')
      OR (v_group_elem ? 'instruction') OR (v_group_elem ? 'instruction_vi')
      OR (v_group_elem ? 'title');

    -- Skip empty group payloads that contain no content fields
    IF NOT v_has_group_content THEN
      CONTINUE;
    END IF;

    v_target_group_id := NULL;

    -- Preference 1: Explicit group.id UUID
    IF (v_group_elem ? 'id') AND (v_group_elem ->> 'id') IS NOT NULL AND TRIM(v_group_elem ->> 'id') <> '' THEN
      SELECT id INTO v_target_group_id
      FROM public.toeic_test_groups
      WHERE id = (v_group_elem ->> 'id')::uuid
        AND test_id = p_test_id
        AND is_active = true;
    END IF;

    -- Preference 2: Range Lookup via existing Question -> Group relationships
    IF v_target_group_id IS NULL THEN
      v_start_q := (v_group_elem ->> 'start_question')::int;
      v_end_q := (v_group_elem ->> 'end_question')::int;

      IF v_start_q IS NOT NULL AND v_end_q IS NOT NULL THEN
        -- Count matches first to prevent ambiguity
        SELECT COUNT(DISTINCT g.id) INTO v_group_matches_count
        FROM public.toeic_test_groups g
        JOIN public.toeic_test_questions q ON q.group_id = g.id
        WHERE g.test_id = p_test_id
          AND g.part = v_part_name
          AND g.is_active = true
          AND q.test_id = p_test_id
          AND q.is_active = true
        GROUP BY g.id
        HAVING MIN(q.question_number) = v_start_q AND MAX(q.question_number) = v_end_q;

        IF COALESCE(v_group_matches_count, 0) > 1 THEN
          RAISE EXCEPTION 'Phát hiện nhiều nhóm bài trùng lặp cho dải câu Q%–%. Vui lòng kiểm tra lại cấu trúc đề.', v_start_q, v_end_q;
        END IF;

        SELECT g.id INTO v_target_group_id
        FROM public.toeic_test_groups g
        JOIN public.toeic_test_questions q ON q.group_id = g.id
        WHERE g.test_id = p_test_id
          AND g.part = v_part_name
          AND g.is_active = true
          AND q.test_id = p_test_id
          AND q.is_active = true
        GROUP BY g.id
        HAVING MIN(q.question_number) = v_start_q AND MAX(q.question_number) = v_end_q;
      END IF;
    END IF;

    -- If group not found, BLOCK! Do NOT insert new group.
    IF v_target_group_id IS NULL THEN
      RAISE EXCEPTION 'Không tìm thấy nhóm bài hiện có phù hợp với dữ liệu import. Vui lòng tạo cấu trúc đề trước khi import nội dung.';
    END IF;

    -- Update Existing Group Content Safely
    UPDATE public.toeic_test_groups
    SET
      title = CASE WHEN (v_group_elem ? 'title') AND (v_group_elem ->> 'title') IS NOT NULL THEN (v_group_elem ->> 'title') ELSE title END,
      instruction = CASE WHEN (v_group_elem ? 'instruction') AND (v_group_elem ->> 'instruction') IS NOT NULL THEN (v_group_elem ->> 'instruction') ELSE instruction END,
      instruction_vi = CASE WHEN (v_group_elem ? 'instruction_vi') AND (v_group_elem ->> 'instruction_vi') IS NOT NULL THEN (v_group_elem ->> 'instruction_vi') ELSE instruction_vi END,
      passage = CASE WHEN (v_group_elem ? 'passage') AND (v_group_elem ->> 'passage') IS NOT NULL THEN (v_group_elem ->> 'passage') ELSE passage END,
      passage_vi = CASE WHEN (v_group_elem ? 'passage_vi') AND (v_group_elem ->> 'passage_vi') IS NOT NULL THEN (v_group_elem ->> 'passage_vi') ELSE passage_vi END,
      transcript = CASE WHEN (v_group_elem ? 'transcript') AND (v_group_elem ->> 'transcript') IS NOT NULL THEN (v_group_elem ->> 'transcript') ELSE transcript END,
      transcript_vi = CASE WHEN (v_group_elem ? 'transcript_vi') AND (v_group_elem ->> 'transcript_vi') IS NOT NULL THEN (v_group_elem ->> 'transcript_vi') ELSE transcript_vi END,
      documents = CASE WHEN (v_group_elem ? 'documents') AND (v_group_elem -> 'documents') IS NOT NULL THEN (v_group_elem -> 'documents') ELSE documents END,
      documents_vi = CASE WHEN (v_group_elem ? 'documents_vi') AND (v_group_elem -> 'documents_vi') IS NOT NULL THEN (v_group_elem -> 'documents_vi') ELSE documents_vi END,
      updated_at = NOW()
    WHERE id = v_target_group_id;

    v_groups_updated := v_groups_updated + 1;
  END LOOP;

  -- 5. Process Questions (Update-Only)
  FOR v_question_elem IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_q_num := (v_question_elem ->> 'question_number')::int;
    v_q_part := COALESCE(v_question_elem ->> 'part', v_part_name);

    IF v_q_part <> v_part_name THEN
      RAISE EXCEPTION 'Câu hỏi Q% có part (% ) không khớp với Part đang import (%).', v_q_num, v_q_part, v_part_name;
    END IF;

    -- Count active questions matching (test_id, question_number)
    SELECT COUNT(*) INTO v_q_matches_count
    FROM public.toeic_test_questions
    WHERE test_id = p_test_id
      AND question_number = v_q_num
      AND is_active = true;

    IF v_q_matches_count = 0 THEN
      RAISE EXCEPTION 'Không tìm thấy câu hỏi Q% trong đề thi. Cấu trúc câu hỏi phải tồn tại trước khi import nội dung.', v_q_num;
    ELSIF v_q_matches_count > 1 THEN
      RAISE EXCEPTION 'Phát hiện nhiều câu hỏi Q% trùng lặp trong đề thi. Vui lòng kiểm tra lại dữ liệu.', v_q_num;
    END IF;

    SELECT id INTO v_existing_q_id
    FROM public.toeic_test_questions
    WHERE test_id = p_test_id
      AND question_number = v_q_num
      AND is_active = true;

    -- Update Existing Question Content Safely
    UPDATE public.toeic_test_questions
    SET
      question_text = CASE WHEN (v_question_elem ? 'question_text') AND (v_question_elem ->> 'question_text') IS NOT NULL THEN (v_question_elem ->> 'question_text') ELSE question_text END,
      translation_vi = CASE WHEN (v_question_elem ? 'translation_vi') AND (v_question_elem ->> 'translation_vi') IS NOT NULL THEN (v_question_elem ->> 'translation_vi') ELSE translation_vi END,
      options = CASE WHEN (v_question_elem ? 'options') AND (v_question_elem -> 'options') IS NOT NULL THEN (v_question_elem -> 'options') ELSE options END,
      options_vi = CASE WHEN (v_question_elem ? 'options_vi') AND (v_question_elem -> 'options_vi') IS NOT NULL THEN (v_question_elem -> 'options_vi') ELSE options_vi END,
      explanation = CASE WHEN (v_question_elem ? 'explanation') AND (v_question_elem ->> 'explanation') IS NOT NULL THEN (v_question_elem ->> 'explanation') ELSE explanation END,
      correct_answer = CASE WHEN v_import_answers = true AND (v_question_elem ? 'correct_answer') AND (v_question_elem ->> 'correct_answer') IS NOT NULL THEN UPPER(TRIM(v_question_elem ->> 'correct_answer')) ELSE correct_answer END,
      updated_at = NOW()
    WHERE id = v_existing_q_id;

    v_questions_updated := v_questions_updated + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'part', v_part_name,
    'groups_updated', v_groups_updated,
    'groups_inserted', 0,
    'questions_updated', v_questions_updated,
    'questions_inserted', 0
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_import_toeic_part_content(uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_import_toeic_part_content(uuid, text, jsonb) TO authenticated;
