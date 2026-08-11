-- Migration: Part 7 Workbench Atomic Group Save RPC, Bilingual Units & Evidence Security Hardening
-- File: database/migrations/20260810_part7_workbench_atomic_group_save.sql

-- Add nullable part7_bilingual_units column to toeic_test_groups if not exists
ALTER TABLE public.toeic_test_groups
ADD COLUMN IF NOT EXISTS part7_bilingual_units jsonb DEFAULT NULL;

-- Add nullable evidence column to toeic_test_questions if not exists
ALTER TABLE public.toeic_test_questions
ADD COLUMN IF NOT EXISTS evidence jsonb DEFAULT NULL;

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
  v_key text;
  v_allowed_keys text[] := ARRAY['documents', 'documents_vi', 'part7_bilingual_units', 'questions'];
  
  v_docs jsonb;
  v_docs_vi jsonb;
  v_units jsonb;
  v_effective_units jsonb;
  v_existing_units jsonb;
  
  v_doc_elem jsonb;
  v_unit_elem jsonb;
  v_unit_id text;
  v_unit_ids text[] := ARRAY[]::text[];
  
  v_q_elem jsonb;
  v_q_num int;
  v_q_id uuid;
  v_seen_q_nums int[] := ARRAY[]::int[];
  v_opts jsonb;
  v_opts_vi jsonb;
  v_opt_item jsonb;
  
  v_ev jsonb;
  v_ev_item jsonb;
  v_ev_unit_id text;
  
  v_existing_q record;
BEGIN
  -- 1. Admin Authentication Check
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Admin privileges required.');
  END IF;

  -- 2. Validate Payload Top-Level Structure
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payload must be a non-null JSON object.');
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_payload)
  LOOP
    IF NOT (v_key = ANY(v_allowed_keys)) THEN
      RETURN jsonb_build_object('success', false, 'error', format('Unsupported top-level key: %s', v_key));
    END IF;
  END LOOP;

  -- 3. Published Protection Check
  SELECT is_published INTO v_is_published
  FROM public.toeic_tests
  WHERE id = p_test_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Test not found.');
  END IF;

  IF v_is_published IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify a published test. Unpublish first.');
  END IF;

  -- 4. Active Target Group Check
  SELECT true, part, part7_bilingual_units INTO v_group_exists, v_group_part, v_existing_units
  FROM public.toeic_test_groups
  WHERE id = p_group_id AND test_id = p_test_id AND (is_active IS NOT FALSE);

  IF NOT v_group_exists OR LOWER(TRIM(v_group_part)) <> 'part7' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target group does not exist, is inactive, or is not Part 7.');
  END IF;

  -- 5. Validate documents / documents_vi
  IF p_payload ? 'documents' THEN
    v_docs := p_payload->'documents';
    IF jsonb_typeof(v_docs) <> 'null' THEN
      IF jsonb_typeof(v_docs) <> 'array' THEN
        RETURN jsonb_build_object('success', false, 'error', 'documents must be null or a JSON array.');
      END IF;
      FOR v_doc_elem IN SELECT * FROM jsonb_array_elements(v_docs)
      LOOP
        IF jsonb_typeof(v_doc_elem) <> 'object' THEN
          RETURN jsonb_build_object('success', false, 'error', 'Each document must be a JSON object.');
        END IF;
        IF NOT (v_doc_elem ? 'content') OR jsonb_typeof(v_doc_elem->'content') <> 'string' THEN
          RETURN jsonb_build_object('success', false, 'error', 'Document content must be a non-null string.');
        END IF;
        IF (v_doc_elem ? 'type') AND jsonb_typeof(v_doc_elem->'type') <> 'string' THEN
          RETURN jsonb_build_object('success', false, 'error', 'Document type must be a string.');
        END IF;
        IF (v_doc_elem ? 'title') AND jsonb_typeof(v_doc_elem->'title') <> 'string' THEN
          RETURN jsonb_build_object('success', false, 'error', 'Document title must be a string.');
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF p_payload ? 'documents_vi' THEN
    v_docs_vi := p_payload->'documents_vi';
    IF jsonb_typeof(v_docs_vi) <> 'null' THEN
      IF jsonb_typeof(v_docs_vi) <> 'array' THEN
        RETURN jsonb_build_object('success', false, 'error', 'documents_vi must be null or a JSON array.');
      END IF;
      FOR v_doc_elem IN SELECT * FROM jsonb_array_elements(v_docs_vi)
      LOOP
        IF jsonb_typeof(v_doc_elem) <> 'object' THEN
          RETURN jsonb_build_object('success', false, 'error', 'Each documents_vi item must be a JSON object.');
        END IF;
        IF NOT (v_doc_elem ? 'content') OR jsonb_typeof(v_doc_elem->'content') <> 'string' THEN
          RETURN jsonb_build_object('success', false, 'error', 'documents_vi content must be a non-null string.');
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- 6. Validate part7_bilingual_units
  IF p_payload ? 'part7_bilingual_units' THEN
    v_units := p_payload->'part7_bilingual_units';
    IF jsonb_typeof(v_units) <> 'null' THEN
      IF jsonb_typeof(v_units) <> 'array' THEN
        RETURN jsonb_build_object('success', false, 'error', 'part7_bilingual_units must be null or a JSON array.');
      END IF;
      FOR v_unit_elem IN SELECT * FROM jsonb_array_elements(v_units)
      LOOP
        IF jsonb_typeof(v_unit_elem) <> 'object' THEN
          RETURN jsonb_build_object('success', false, 'error', 'Each unit in part7_bilingual_units must be a JSON object.');
        END IF;
        IF NOT (v_unit_elem ? 'unit_id') OR jsonb_typeof(v_unit_elem->'unit_id') <> 'string' OR TRIM(v_unit_elem->>'unit_id') = '' THEN
          RETURN jsonb_build_object('success', false, 'error', 'Each unit must have a non-empty unit_id string.');
        END IF;
        
        v_unit_id := TRIM(v_unit_elem->>'unit_id');
        IF v_unit_id = ANY(v_unit_ids) THEN
          RETURN jsonb_build_object('success', false, 'error', format('Duplicate unit_id in part7_bilingual_units: %s', v_unit_id));
        END IF;
        v_unit_ids := array_append(v_unit_ids, v_unit_id);

        IF NOT (v_unit_elem ? 'document_index') OR jsonb_typeof(v_unit_elem->'document_index') <> 'number' OR (v_unit_elem->>'document_index')::int < 0 THEN
          RETURN jsonb_build_object('success', false, 'error', 'unit document_index must be an integer >= 0.');
        END IF;
        IF NOT (v_unit_elem ? 'order') OR jsonb_typeof(v_unit_elem->'order') <> 'number' OR (v_unit_elem->>'order')::int < 0 THEN
          RETURN jsonb_build_object('success', false, 'error', 'unit order must be an integer >= 0.');
        END IF;
        IF NOT (v_unit_elem ? 'kind') OR jsonb_typeof(v_unit_elem->'kind') <> 'string' OR TRIM(v_unit_elem->>'kind') = '' THEN
          RETURN jsonb_build_object('success', false, 'error', 'unit kind must be a non-empty string.');
        END IF;
        IF NOT (v_unit_elem ? 'en') OR jsonb_typeof(v_unit_elem->'en') <> 'string' THEN
          RETURN jsonb_build_object('success', false, 'error', 'unit en must be a string.');
        END IF;
        IF NOT (v_unit_elem ? 'vi') OR jsonb_typeof(v_unit_elem->'vi') <> 'string' THEN
          RETURN jsonb_build_object('success', false, 'error', 'unit vi must be a string.');
        END IF;
      END LOOP;
    END IF;
    v_effective_units := v_units;
  ELSE
    v_effective_units := v_existing_units;
    IF jsonb_typeof(v_effective_units) = 'array' THEN
      FOR v_unit_elem IN SELECT * FROM jsonb_array_elements(v_effective_units)
      LOOP
        v_unit_ids := array_append(v_unit_ids, TRIM(v_unit_elem->>'unit_id'));
      END LOOP;
    END IF;
  END IF;

  -- 7. Update Group Fields
  IF p_payload ? 'documents' THEN
    UPDATE public.toeic_test_groups
    SET documents = CASE WHEN jsonb_typeof(p_payload->'documents') = 'null' THEN NULL ELSE p_payload->'documents' END,
        updated_at = NOW()
    WHERE id = p_group_id;
  END IF;

  IF p_payload ? 'documents_vi' THEN
    UPDATE public.toeic_test_groups
    SET documents_vi = CASE WHEN jsonb_typeof(p_payload->'documents_vi') = 'null' THEN NULL ELSE p_payload->'documents_vi' END,
        updated_at = NOW()
    WHERE id = p_group_id;
  END IF;

  IF p_payload ? 'part7_bilingual_units' THEN
    UPDATE public.toeic_test_groups
    SET part7_bilingual_units = CASE WHEN jsonb_typeof(p_payload->'part7_bilingual_units') = 'null' THEN NULL ELSE p_payload->'part7_bilingual_units' END,
        updated_at = NOW()
    WHERE id = p_group_id;
  END IF;

  -- 8. Validate and Update Questions
  IF p_payload ? 'questions' THEN
    IF jsonb_typeof(p_payload->'questions') <> 'array' THEN
      RETURN jsonb_build_object('success', false, 'error', 'questions must be a JSON array.');
    END IF;

    FOR v_q_elem IN SELECT * FROM jsonb_array_elements(p_payload->'questions')
    LOOP
      IF jsonb_typeof(v_q_elem) <> 'object' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Each question entry must be a JSON object.');
      END IF;

      IF NOT (v_q_elem ? 'question_number') OR jsonb_typeof(v_q_elem->'question_number') <> 'number' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Question entry requires an integer question_number.');
      END IF;

      v_q_num := (v_q_elem->>'question_number')::int;
      IF v_q_num = ANY(v_seen_q_nums) THEN
        RETURN jsonb_build_object('success', false, 'error', format('Duplicate question_number in questions array: %s', v_q_num));
      END IF;
      v_seen_q_nums := array_append(v_seen_q_nums, v_q_num);

      SELECT id INTO v_q_id
      FROM public.toeic_test_questions
      WHERE test_id = p_test_id
        AND group_id = p_group_id
        AND question_number = v_q_num
        AND LOWER(TRIM(part)) = 'part7'
        AND (is_active IS NOT FALSE);

      IF v_q_id IS NULL THEN
        RAISE EXCEPTION 'Question number % does not belong to active Part 7 group %.', v_q_num, p_group_id;
      END IF;

      -- Validate question_text
      IF v_q_elem ? 'question_text' THEN
        IF jsonb_typeof(v_q_elem->'question_text') <> 'null' AND jsonb_typeof(v_q_elem->'question_text') <> 'string' THEN
          RETURN jsonb_build_object('success', false, 'error', format('question_text for Q%s must be a string or null.', v_q_num));
        END IF;

        UPDATE public.toeic_test_questions
        SET question_text = CASE WHEN jsonb_typeof(v_q_elem->'question_text') = 'null' THEN NULL ELSE v_q_elem->>'question_text' END,
            updated_at = NOW()
        WHERE id = v_q_id;
      END IF;

      -- Validate translation_vi
      IF v_q_elem ? 'translation_vi' THEN
        IF jsonb_typeof(v_q_elem->'translation_vi') <> 'null' AND jsonb_typeof(v_q_elem->'translation_vi') <> 'string' THEN
          RETURN jsonb_build_object('success', false, 'error', format('translation_vi for Q%s must be a string or null.', v_q_num));
        END IF;

        UPDATE public.toeic_test_questions
        SET translation_vi = CASE WHEN jsonb_typeof(v_q_elem->'translation_vi') = 'null' THEN NULL ELSE v_q_elem->>'translation_vi' END,
            updated_at = NOW()
        WHERE id = v_q_id;
      END IF;

      -- Validate options
      IF v_q_elem ? 'options' THEN
        v_opts := v_q_elem->'options';
        IF jsonb_typeof(v_opts) <> 'array' OR jsonb_array_length(v_opts) <> 4 THEN
          RETURN jsonb_build_object('success', false, 'error', format('Options for Q%s must be a JSON array of exactly 4 strings.', v_q_num));
        END IF;
        FOR v_opt_item IN SELECT * FROM jsonb_array_elements(v_opts)
        LOOP
          IF jsonb_typeof(v_opt_item) <> 'string' THEN
            RETURN jsonb_build_object('success', false, 'error', format('Every option element for Q%s must be a string.', v_q_num));
          END IF;
        END LOOP;

        UPDATE public.toeic_test_questions
        SET options = v_opts, updated_at = NOW()
        WHERE id = v_q_id;
      END IF;

      -- Validate options_vi
      IF v_q_elem ? 'options_vi' THEN
        v_opts_vi := v_q_elem->'options_vi';
        IF jsonb_typeof(v_opts_vi) <> 'array' OR jsonb_array_length(v_opts_vi) <> 4 THEN
          RETURN jsonb_build_object('success', false, 'error', format('options_vi for Q%s must be a JSON array of exactly 4 strings.', v_q_num));
        END IF;
        FOR v_opt_item IN SELECT * FROM jsonb_array_elements(v_opts_vi)
        LOOP
          IF jsonb_typeof(v_opt_item) <> 'string' THEN
            RETURN jsonb_build_object('success', false, 'error', format('Every options_vi element for Q%s must be a string.', v_q_num));
          END IF;
        END LOOP;

        UPDATE public.toeic_test_questions
        SET options_vi = v_opts_vi, updated_at = NOW()
        WHERE id = v_q_id;
      END IF;

      -- Validate evidence
      IF v_q_elem ? 'evidence' THEN
        v_ev := v_q_elem->'evidence';
        IF jsonb_typeof(v_ev) <> 'null' THEN
          IF jsonb_typeof(v_ev) <> 'array' THEN
            RETURN jsonb_build_object('success', false, 'error', format('evidence for Q%s must be null or a JSON array.', v_q_num));
          END IF;
          FOR v_ev_item IN SELECT * FROM jsonb_array_elements(v_ev)
          LOOP
            IF jsonb_typeof(v_ev_item) <> 'object' OR NOT (v_ev_item ? 'unit_id') THEN
              RETURN jsonb_build_object('success', false, 'error', format('Each evidence item for Q%s must be an object with unit_id.', v_q_num));
            END IF;
            v_ev_unit_id := TRIM(v_ev_item->>'unit_id');
            IF NOT (v_ev_unit_id = ANY(v_unit_ids)) THEN
              RETURN jsonb_build_object('success', false, 'error', format('Evidence unit_id "%s" in Q%s does not exist in bilingual units of this group.', v_ev_unit_id, v_q_num));
            END IF;
          END LOOP;
        END IF;

        UPDATE public.toeic_test_questions
        SET evidence = CASE WHEN jsonb_typeof(v_ev) = 'null' THEN NULL ELSE v_ev END,
            updated_at = NOW()
        WHERE id = v_q_id;
      END IF;
    END LOOP;
  END IF;

  -- 9. Check Dangling Evidence Protection if Units updated without updating questions
  IF (p_payload ? 'part7_bilingual_units') AND NOT (p_payload ? 'questions') THEN
    FOR v_existing_q IN SELECT id, question_number, evidence FROM public.toeic_test_questions WHERE group_id = p_group_id AND evidence IS NOT NULL AND jsonb_typeof(evidence) = 'array'
    LOOP
      FOR v_ev_item IN SELECT * FROM jsonb_array_elements(v_existing_q.evidence)
      LOOP
        v_ev_unit_id := TRIM(v_ev_item->>'unit_id');
        IF NOT (v_ev_unit_id = ANY(v_unit_ids)) THEN
          RETURN jsonb_build_object('success', false, 'error', format('Updating units leaves dangling evidence unit_id "%s" in Q%s.', v_ev_unit_id, v_existing_q.question_number));
        END IF;
      END LOOP;
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
