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
  v_import_answers boolean := false;
  v_group_elem jsonb;
  v_question_elem jsonb;
  
  v_start_q int;
  v_end_q int;
  v_part_name text;
  v_target_group_id uuid;
  v_group_matches_count int;
  v_groups_updated int := 0;
  v_has_group_content boolean;

  v_existing_docs jsonb;
  v_existing_docs_vi jsonb;
  v_effective_docs jsonb;
  v_effective_docs_vi jsonb;
  v_doc_idx int;
  v_doc_en_type text;
  v_doc_vi_type text;

  v_q_num int;
  v_q_part text;
  v_existing_q_id uuid;
  v_q_matches_count int;
  v_final_correct text;
  v_questions_updated int := 0;
BEGIN
  -- 1. Canonical ORI Admin Security Check
  IF NOT (
    public.is_admin()
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Permission denied: admin role required.';
  END IF;

  -- 2. Root Payload Shape Validation
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload phải là một đối tượng JSON.';
  END IF;

  IF (p_payload ? 'groups') AND (p_payload -> 'groups') IS NOT NULL AND jsonb_typeof(p_payload -> 'groups') <> 'array' THEN
    RAISE EXCEPTION 'Trường "groups" trong payload phải là một mảng JSON.';
  END IF;

  IF (p_payload ? 'questions') AND (p_payload -> 'questions') IS NOT NULL AND jsonb_typeof(p_payload -> 'questions') <> 'array' THEN
    RAISE EXCEPTION 'Trường "questions" trong payload phải là một mảng JSON.';
  END IF;

  -- Controlled import_answers Validation
  IF (p_payload ? 'import_answers') AND (p_payload -> 'import_answers') IS NOT NULL THEN
    IF jsonb_typeof(p_payload -> 'import_answers') <> 'boolean' THEN
      RAISE EXCEPTION 'Trường "import_answers" phải là kiểu boolean (true/false).';
    END IF;
    v_import_answers := (p_payload ->> 'import_answers')::boolean;
  END IF;

  -- 3. Validate Part Name
  v_part_name := LOWER(TRIM(p_part));
  IF v_part_name NOT IN ('part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7') THEN
    RAISE EXCEPTION 'Mã Part không hợp lệ: %', p_part;
  END IF;

  -- 4. Check if test exists and is_published status
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

  -- 5. Process Groups (Update-Only)
  FOR v_group_elem IN SELECT * FROM jsonb_array_elements(v_groups)
  LOOP
    -- Note: Exclude synthetic title alone from group mutation trigger
    v_has_group_content := (v_group_elem ? 'transcript') OR (v_group_elem ? 'transcript_vi') 
      OR (v_group_elem ? 'passage') OR (v_group_elem ? 'passage_vi') 
      OR (v_group_elem ? 'documents') OR (v_group_elem ? 'documents_vi')
      OR (v_group_elem ? 'instruction') OR (v_group_elem ? 'instruction_vi');

    -- Skip empty group payloads that contain no content fields
    IF NOT v_has_group_content THEN
      CONTINUE;
    END IF;

    v_target_group_id := NULL;

    -- Preference 1: Explicit group.id UUID with PART & TEST_ID validation
    IF (v_group_elem ? 'id') AND (v_group_elem ->> 'id') IS NOT NULL AND TRIM(v_group_elem ->> 'id') <> '' THEN
      SELECT id INTO v_target_group_id
      FROM public.toeic_test_groups
      WHERE id = (v_group_elem ->> 'id')::uuid
        AND test_id = p_test_id
        AND part = v_part_name
        AND is_active = true;

      IF v_target_group_id IS NULL THEN
        RAISE EXCEPTION 'Nhóm bài ID % không thuộc % của đề thi hiện tại hoặc không hoạt động.', (v_group_elem ->> 'id'), UPPER(v_part_name);
      END IF;
    END IF;

    -- Preference 2: Derived Table Range Lookup
    IF v_target_group_id IS NULL THEN
      IF (v_group_elem ? 'start_question') IS FALSE OR (v_group_elem ->> 'start_question') IS NULL OR TRIM(v_group_elem ->> 'start_question') = ''
         OR (v_group_elem ? 'end_question') IS FALSE OR (v_group_elem ->> 'end_question') IS NULL OR TRIM(v_group_elem ->> 'end_question') = '' THEN
        RAISE EXCEPTION 'Thiếu start_question hoặc end_question để tìm kiếm nhóm bài.';
      END IF;

      BEGIN
        v_start_q := (v_group_elem ->> 'start_question')::int;
        v_end_q := (v_group_elem ->> 'end_question')::int;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Giá trị dải câu hỏi (%–%) không hợp lệ.', (v_group_elem ->> 'start_question'), (v_group_elem ->> 'end_question');
      END;

      SELECT COUNT(*) INTO v_group_matches_count
      FROM (
        SELECT g.id
        FROM public.toeic_test_groups g
        JOIN public.toeic_test_questions q ON q.group_id = g.id
        WHERE g.test_id = p_test_id
          AND g.part = v_part_name
          AND g.is_active = true
          AND q.test_id = p_test_id
          AND q.is_active = true
        GROUP BY g.id
        HAVING MIN(q.question_number) = v_start_q AND MAX(q.question_number) = v_end_q
      ) matching_groups;

      IF v_group_matches_count > 1 THEN
        RAISE EXCEPTION 'Phát hiện nhiều nhóm bài trùng lặp cho dải câu Q%–%. Vui lòng kiểm tra lại cấu trúc đề.', v_start_q, v_end_q;
      ELSIF v_group_matches_count = 1 THEN
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
      RAISE EXCEPTION 'Không tìm thấy nhóm bài hiện có phù hợp cho dải câu Q%–%. Vui lòng tạo cấu trúc đề trước khi import nội dung.', COALESCE(v_start_q, 0), COALESCE(v_end_q, 0);
    END IF;

    -- Part 7 Document Structure & Partial-Update Validation
    IF v_part_name = 'part7' THEN
      IF (v_group_elem ? 'documents') AND (v_group_elem -> 'documents') IS NOT NULL AND jsonb_typeof(v_group_elem -> 'documents') <> 'array' THEN
        RAISE EXCEPTION 'Trường documents trong nhóm bài phải là một mảng JSON.';
      END IF;

      IF (v_group_elem ? 'documents_vi') AND (v_group_elem -> 'documents_vi') IS NOT NULL AND jsonb_typeof(v_group_elem -> 'documents_vi') <> 'array' THEN
        RAISE EXCEPTION 'Trường documents_vi trong nhóm bài phải là một mảng JSON.';
      END IF;

      SELECT documents, documents_vi INTO v_existing_docs, v_existing_docs_vi
      FROM public.toeic_test_groups
      WHERE id = v_target_group_id;

      v_effective_docs := CASE WHEN (v_group_elem ? 'documents') AND (v_group_elem -> 'documents') IS NOT NULL THEN (v_group_elem -> 'documents') ELSE v_existing_docs END;
      v_effective_docs_vi := CASE WHEN (v_group_elem ? 'documents_vi') AND (v_group_elem -> 'documents_vi') IS NOT NULL THEN (v_group_elem -> 'documents_vi') ELSE v_existing_docs_vi END;

      IF v_effective_docs IS NOT NULL AND v_effective_docs_vi IS NOT NULL 
         AND jsonb_typeof(v_effective_docs) = 'array' AND jsonb_typeof(v_effective_docs_vi) = 'array' THEN
        IF jsonb_array_length(v_effective_docs) <> jsonb_array_length(v_effective_docs_vi) THEN
          RAISE EXCEPTION 'Số lượng tài liệu EN (%) và VI (%) trong Part 7 không khớp nhau.', jsonb_array_length(v_effective_docs), jsonb_array_length(v_effective_docs_vi);
        END IF;

        IF jsonb_array_length(v_effective_docs) > 0 THEN
          FOR v_doc_idx IN 0 .. (jsonb_array_length(v_effective_docs) - 1)
          LOOP
            IF jsonb_typeof(v_effective_docs -> v_doc_idx) <> 'object' THEN
              RAISE EXCEPTION 'Tài liệu EN tại vị trí % phải là một đối tượng JSON.', v_doc_idx + 1;
            END IF;

            IF jsonb_typeof(v_effective_docs_vi -> v_doc_idx) <> 'object' THEN
              RAISE EXCEPTION 'Tài liệu VI tại vị trí % phải là một đối tượng JSON.', v_doc_idx + 1;
            END IF;

            v_doc_en_type := (v_effective_docs -> v_doc_idx) ->> 'type';
            v_doc_vi_type := (v_effective_docs_vi -> v_doc_idx) ->> 'type';

            IF v_doc_en_type IS NOT NULL AND TRIM(v_doc_en_type) <> '' THEN
              IF v_doc_vi_type IS NULL OR TRIM(v_doc_vi_type) = '' THEN
                RAISE EXCEPTION 'Tài liệu VI tại vị trí % thiếu loại tài liệu (type: %).', v_doc_idx + 1, v_doc_en_type;
              ELSIF LOWER(TRIM(v_doc_en_type)) <> LOWER(TRIM(v_doc_vi_type)) THEN
                RAISE EXCEPTION 'Loại tài liệu tại vị trí % không khớp (EN: %, VI: %).', v_doc_idx + 1, v_doc_en_type, v_doc_vi_type;
              END IF;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;

    -- Update Existing Group Content Safely
    UPDATE public.toeic_test_groups
    SET
      title = CASE WHEN (v_group_elem ? 'title') AND (v_group_elem ->> 'title') IS NOT NULL THEN (v_group_elem ->> 'title') ELSE title END,
      instruction = CASE WHEN (v_group_elem ? 'instruction') AND (v_group_elem ->> 'instruction') IS NOT NULL THEN (v_group_elem ->> 'instruction') ELSE instruction END,
      instruction_vi = CASE WHEN (v_group_elem ? 'instruction_vi') AND (v_group_elem ->> 'instruction_vi') IS NOT NULL THEN (v_group_elem ->> 'instruction_vi') ELSE instruction_vi END,
      passage = CASE WHEN (v_group_elem ? 'passage') AND (v_group_elem -> 'passage') IS NOT NULL THEN (v_group_elem ->> 'passage') ELSE passage END,
      passage_vi = CASE WHEN (v_group_elem ? 'passage_vi') AND (v_group_elem -> 'passage_vi') IS NOT NULL THEN (v_group_elem ->> 'passage_vi') ELSE passage_vi END,
      transcript = CASE WHEN (v_group_elem ? 'transcript') AND (v_group_elem -> 'transcript') IS NOT NULL THEN (v_group_elem ->> 'transcript') ELSE transcript END,
      transcript_vi = CASE WHEN (v_group_elem ? 'transcript_vi') AND (v_group_elem -> 'transcript_vi') IS NOT NULL THEN (v_group_elem ->> 'transcript_vi') ELSE transcript_vi END,
      documents = CASE WHEN (v_group_elem ? 'documents') AND (v_group_elem -> 'documents') IS NOT NULL THEN (v_group_elem -> 'documents') ELSE documents END,
      documents_vi = CASE WHEN (v_group_elem ? 'documents_vi') AND (v_group_elem -> 'documents_vi') IS NOT NULL THEN (v_group_elem -> 'documents_vi') ELSE documents_vi END,
      updated_at = NOW()
    WHERE id = v_target_group_id;

    v_groups_updated := v_groups_updated + 1;
  END LOOP;

  -- 6. Process Questions (Update-Only)
  FOR v_question_elem IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    IF (v_question_elem ? 'question_number') IS FALSE 
       OR (v_question_elem ->> 'question_number') IS NULL 
       OR TRIM(v_question_elem ->> 'question_number') = '' THEN
      RAISE EXCEPTION 'Thiếu question_number trong dữ liệu câu hỏi.';
    END IF;

    BEGIN
      v_q_num := (v_question_elem ->> 'question_number')::int;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Giá trị question_number không hợp lệ: %', (v_question_elem ->> 'question_number');
    END;
    
    -- Validate Explicit Payload Part if Supplied
    IF (v_question_elem ? 'part') AND (v_question_elem ->> 'part') IS NOT NULL AND TRIM(v_question_elem ->> 'part') <> '' THEN
      IF LOWER(TRIM(v_question_elem ->> 'part')) <> v_part_name THEN
        RAISE EXCEPTION 'Câu Q% có part (% ) không khớp với Part đang import (%).', v_q_num, (v_question_elem ->> 'part'), UPPER(v_part_name);
      END IF;
    END IF;

    -- Validate Canonical Question Range per Part
    IF v_part_name = 'part1' AND (v_q_num < 1 OR v_q_num > 6) THEN
      RAISE EXCEPTION 'Câu Q% không thuộc Part 1 (Dải chuẩn: Q1–6).', v_q_num;
    ELSIF v_part_name = 'part2' AND (v_q_num < 7 OR v_q_num > 31) THEN
      RAISE EXCEPTION 'Câu Q% không thuộc Part 2 (Dải chuẩn: Q7–31).', v_q_num;
    ELSIF v_part_name = 'part3' AND (v_q_num < 32 OR v_q_num > 70) THEN
      RAISE EXCEPTION 'Câu Q% không thuộc Part 3 (Dải chuẩn: Q32–70).', v_q_num;
    ELSIF v_part_name = 'part4' AND (v_q_num < 71 OR v_q_num > 100) THEN
      RAISE EXCEPTION 'Câu Q% không thuộc Part 4 (Dải chuẩn: Q71–100).', v_q_num;
    ELSIF v_part_name = 'part5' AND (v_q_num < 101 OR v_q_num > 130) THEN
      RAISE EXCEPTION 'Câu Q% không thuộc Part 5 (Dải chuẩn: Q101–130).', v_q_num;
    ELSIF v_part_name = 'part6' AND (v_q_num < 131 OR v_q_num > 146) THEN
      RAISE EXCEPTION 'Câu Q% không thuộc Part 6 (Dải chuẩn: Q131–146).', v_q_num;
    ELSIF v_part_name = 'part7' AND (v_q_num < 147 OR v_q_num > 200) THEN
      RAISE EXCEPTION 'Câu Q% không thuộc Part 7 (Dải chuẩn: Q147–200).', v_q_num;
    END IF;

    -- Type-Safe Options Shape Validation if Supplied
    IF (v_question_elem ? 'options') AND (v_question_elem -> 'options') IS NOT NULL THEN
      IF jsonb_typeof(v_question_elem -> 'options') <> 'array' THEN
        RAISE EXCEPTION 'Trường options cho câu Q% phải là một mảng JSON.', v_q_num;
      ELSIF jsonb_array_length(v_question_elem -> 'options') <> 4 THEN
        RAISE EXCEPTION 'Danh sách lựa chọn EN cho câu Q% không hợp lệ (yêu cầu đúng 4 đáp án A, B, C, D).', v_q_num;
      END IF;
    END IF;

    IF (v_question_elem ? 'options_vi') AND (v_question_elem -> 'options_vi') IS NOT NULL THEN
      IF jsonb_typeof(v_question_elem -> 'options_vi') <> 'array' THEN
        RAISE EXCEPTION 'Trường options_vi cho câu Q% phải là một mảng JSON.', v_q_num;
      ELSIF jsonb_array_length(v_question_elem -> 'options_vi') <> 4 THEN
        RAISE EXCEPTION 'Danh sách lựa chọn VI cho câu Q% không hợp lệ (yêu cầu đúng 4 đáp án A, B, C, D).', v_q_num;
      END IF;
    END IF;

    -- Check Existing Active Question & Verify DB question.part Matches v_part_name
    SELECT COUNT(*) INTO v_q_matches_count
    FROM public.toeic_test_questions
    WHERE test_id = p_test_id
      AND question_number = v_q_num
      AND part = v_part_name
      AND is_active = true;

    IF v_q_matches_count = 0 THEN
      RAISE EXCEPTION 'Không tìm thấy câu hỏi Q% (thuộc %) trong đề thi. Cấu trúc câu hỏi phải tồn tại trước khi import nội dung.', v_q_num, UPPER(v_part_name);
    ELSIF v_q_matches_count > 1 THEN
      RAISE EXCEPTION 'Phát hiện nhiều câu hỏi Q% trùng lặp trong đề thi. Vui lòng kiểm tra lại dữ liệu.', v_q_num;
    END IF;

    SELECT id INTO v_existing_q_id
    FROM public.toeic_test_questions
    WHERE test_id = p_test_id
      AND question_number = v_q_num
      AND part = v_part_name
      AND is_active = true;

    -- Validate Answer Key when import_answers = true
    v_final_correct := NULL;
    IF v_import_answers = true AND (v_question_elem ? 'correct_answer') AND (v_question_elem ->> 'correct_answer') IS NOT NULL THEN
      v_final_correct := UPPER(TRIM(v_question_elem ->> 'correct_answer'));
      IF v_final_correct NOT IN ('A', 'B', 'C', 'D') THEN
        RAISE EXCEPTION 'Đáp án cho câu Q% không hợp lệ: % (chỉ chấp nhận A, B, C, D).', v_q_num, (v_question_elem ->> 'correct_answer');
      END IF;
    END IF;

    -- Update Existing Question Content Safely
    UPDATE public.toeic_test_questions
    SET
      question_text = CASE WHEN (v_question_elem ? 'question_text') AND (v_question_elem ->> 'question_text') IS NOT NULL THEN (v_question_elem ->> 'question_text') ELSE question_text END,
      translation_vi = CASE WHEN (v_question_elem ? 'translation_vi') AND (v_question_elem ->> 'translation_vi') IS NOT NULL THEN (v_question_elem ->> 'translation_vi') ELSE translation_vi END,
      options = CASE WHEN (v_question_elem ? 'options') AND (v_question_elem -> 'options') IS NOT NULL THEN (v_question_elem -> 'options') ELSE options END,
      options_vi = CASE WHEN (v_question_elem ? 'options_vi') AND (v_question_elem -> 'options_vi') IS NOT NULL THEN (v_question_elem -> 'options_vi') ELSE options_vi END,
      explanation = CASE WHEN (v_question_elem ? 'explanation') AND (v_question_elem ->> 'explanation') IS NOT NULL THEN (v_question_elem ->> 'explanation') ELSE explanation END,
      correct_answer = COALESCE(v_final_correct, correct_answer),
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
