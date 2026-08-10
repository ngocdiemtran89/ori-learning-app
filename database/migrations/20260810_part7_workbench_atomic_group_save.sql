-- Migration: Part 7 Workbench Atomic Group Save RPC & Bilingual Units Storage
-- File: database/migrations/20260810_part7_workbench_atomic_group_save.sql

-- Add nullable part7_bilingual_units column to toeic_test_groups if not exists
ALTER TABLE public.toeic_test_groups
ADD COLUMN IF NOT EXISTS part7_bilingual_units jsonb DEFAULT NULL;

-- Function: admin_update_toeic_part7_group
CREATE OR REPLACE FUNCTION public.admin_update_toeic_part7_group(
  p_test_id uuid,
  p_group_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_published boolean;
  v_group_exists boolean;
  v_group_part text;
  v_q_elem jsonb;
  v_q_num int;
  v_q_id uuid;
  v_opts jsonb;
  v_opts_vi jsonb;
BEGIN
  -- 1. Admin Authentication Check
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Admin privileges required.');
  END IF;

  -- 2. Published Protection Check
  SELECT is_published INTO v_is_published
  FROM public.toeic_tests
  WHERE id = p_test_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Test not found.');
  END IF;

  IF v_is_published IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify a published test. Unpublish first.');
  END IF;

  -- 3. Group Validation
  SELECT true, part INTO v_group_exists, v_group_part
  FROM public.toeic_test_groups
  WHERE id = p_group_id AND test_id = p_test_id;

  IF NOT v_group_exists OR LOWER(TRIM(v_group_part)) <> 'part7' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target group does not exist or is not a Part 7 group.');
  END IF;

  -- 4. Update Group Fields (patch semantics)
  IF p_payload ? 'documents' THEN
    UPDATE public.toeic_test_groups
    SET documents = CASE
      WHEN jsonb_typeof(p_payload->'documents') = 'null' THEN NULL
      ELSE p_payload->'documents'
    END,
    updated_at = NOW()
    WHERE id = p_group_id;
  END IF;

  IF p_payload ? 'documents_vi' THEN
    UPDATE public.toeic_test_groups
    SET documents_vi = CASE
      WHEN jsonb_typeof(p_payload->'documents_vi') = 'null' THEN NULL
      ELSE p_payload->'documents_vi'
    END,
    updated_at = NOW()
    WHERE id = p_group_id;
  END IF;

  IF p_payload ? 'part7_bilingual_units' THEN
    UPDATE public.toeic_test_groups
    SET part7_bilingual_units = CASE
      WHEN jsonb_typeof(p_payload->'part7_bilingual_units') = 'null' THEN NULL
      ELSE p_payload->'part7_bilingual_units'
    END,
    updated_at = NOW()
    WHERE id = p_group_id;
  END IF;

  IF p_payload ? 'group_type' THEN
    UPDATE public.toeic_test_groups
    SET group_type = p_payload->>'group_type',
    updated_at = NOW()
    WHERE id = p_group_id;
  END IF;

  -- 5. Update Questions
  IF p_payload ? 'questions' AND jsonb_typeof(p_payload->'questions') = 'array' THEN
    FOR v_q_elem IN SELECT * FROM jsonb_array_elements(p_payload->'questions')
    LOOP
      v_q_num := (v_q_elem->>'question_number')::int;

      -- Validate question belongs to target group
      SELECT id INTO v_q_id
      FROM public.toeic_test_questions
      WHERE test_id = p_test_id
        AND group_id = p_group_id
        AND question_number = v_q_num
        AND LOWER(TRIM(part)) = 'part7';

      IF v_q_id IS NULL THEN
        RAISE EXCEPTION 'Question number % does not belong to Part 7 group %.', v_q_num, p_group_id;
      END IF;

      -- Update question_text
      IF v_q_elem ? 'question_text' THEN
        UPDATE public.toeic_test_questions
        SET question_text = CASE
          WHEN jsonb_typeof(v_q_elem->'question_text') = 'null' THEN NULL
          ELSE v_q_elem->>'question_text'
        END,
        updated_at = NOW()
        WHERE id = v_q_id;
      END IF;

      -- Update translation_vi
      IF v_q_elem ? 'translation_vi' THEN
        UPDATE public.toeic_test_questions
        SET translation_vi = CASE
          WHEN jsonb_typeof(v_q_elem->'translation_vi') = 'null' THEN NULL
          ELSE v_q_elem->>'translation_vi'
        END,
        updated_at = NOW()
        WHERE id = v_q_id;
      END IF;

      -- Update options
      IF v_q_elem ? 'options' THEN
        v_opts := v_q_elem->'options';
        IF jsonb_typeof(v_opts) <> 'array' OR jsonb_array_length(v_opts) <> 4 THEN
          RAISE EXCEPTION 'Options for question % must be a JSON array of exactly 4 strings.', v_q_num;
        END IF;

        UPDATE public.toeic_test_questions
        SET options = v_opts,
        updated_at = NOW()
        WHERE id = v_q_id;
      END IF;

      -- Update options_vi
      IF v_q_elem ? 'options_vi' THEN
        v_opts_vi := v_q_elem->'options_vi';
        IF jsonb_typeof(v_opts_vi) <> 'array' OR jsonb_array_length(v_opts_vi) <> 4 THEN
          RAISE EXCEPTION 'Options_vi for question % must be a JSON array of exactly 4 strings.', v_q_num;
        END IF;

        UPDATE public.toeic_test_questions
        SET options_vi = v_opts_vi,
        updated_at = NOW()
        WHERE id = v_q_id;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'group_id', p_group_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Security Grants
REVOKE EXECUTE ON FUNCTION public.admin_update_toeic_part7_group(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_toeic_part7_group(uuid, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_toeic_part7_group(uuid, uuid, jsonb) TO authenticated;
