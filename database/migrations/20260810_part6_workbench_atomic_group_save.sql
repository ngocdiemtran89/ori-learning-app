-- Migration: 20260810_part6_workbench_atomic_group_save.sql
-- Goal: Atomic Part 6 Group Save RPC with True Patch Semantics
-- Strict: NO ALTER TABLE, NO hard delete, NO structural inserts/deletes.

CREATE OR REPLACE FUNCTION public.admin_update_toeic_part6_group(
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
  v_test record;
  v_group record;
  v_active_q_count integer;
  v_q_min integer;
  v_q_max integer;
  v_valid_range boolean := false;
  v_passage text;
  v_passage_vi text;
  v_q_elem jsonb;
  v_q_num integer;
  v_q_rec record;
  v_options jsonb;
  v_options_vi jsonb;
  v_opts_arr text[];
  v_opts_vi_arr text[];
  v_q_text text;
  v_trans_vi text;
  v_seen_q_nums integer[] := ARRAY[]::integer[];
BEGIN
  -- 1. Authorization Check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin role required.';
  END IF;

  -- 2. Validate Test Existence and Published Status
  SELECT id, is_published INTO v_test
  FROM public.toeic_tests
  WHERE id = p_test_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test not found: %', p_test_id;
  END IF;

  IF v_test.is_published IS TRUE THEN
    RAISE EXCEPTION 'Cannot modify a published test. Unpublish first.';
  END IF;

  -- 3. Validate Group Structure
  SELECT id, test_id, part, is_active, passage, passage_vi INTO v_group
  FROM public.toeic_test_groups
  WHERE id = p_group_id AND test_id = p_test_id AND LOWER(TRIM(part)) = 'part6' AND is_active IS TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active Part 6 group not found for group_id: % in test: %', p_group_id, p_test_id;
  END IF;

  -- 4. Validate Active Questions Count and Range
  SELECT COUNT(*), MIN(question_number), MAX(question_number)
  INTO v_active_q_count, v_q_min, v_q_max
  FROM public.toeic_test_questions
  WHERE test_id = p_test_id AND group_id = p_group_id AND is_active IS TRUE;

  IF v_active_q_count <> 4 THEN
    RAISE EXCEPTION 'Part 6 group must have exactly 4 active questions. Found % for group %', v_active_q_count, p_group_id;
  END IF;

  IF (v_q_min = 131 AND v_q_max = 134) OR
     (v_q_min = 135 AND v_q_max = 138) OR
     (v_q_min = 139 AND v_q_max = 142) OR
     (v_q_min = 143 AND v_q_max = 146) THEN
    v_valid_range := true;
  END IF;

  IF NOT v_valid_range THEN
    RAISE EXCEPTION 'Question range %-% is not a canonical Part 6 range (131-134, 135-138, 139-142, 143-146)', v_q_min, v_q_max;
  END IF;

  -- 5. Patch Semantics for Group Passage (Only update if key is present)
  v_passage := v_group.passage;
  v_passage_vi := v_group.passage_vi;

  IF p_payload ? 'passage' THEN
    IF jsonb_typeof(p_payload -> 'passage') = 'null' THEN
      v_passage := NULL;
    ELSIF jsonb_typeof(p_payload -> 'passage') = 'string' THEN
      v_passage := TRIM(p_payload ->> 'passage');
      IF v_passage = '' THEN v_passage := NULL; END IF;
    ELSE
      RAISE EXCEPTION 'passage must be string or null';
    END IF;
  END IF;

  IF p_payload ? 'passage_vi' THEN
    IF jsonb_typeof(p_payload -> 'passage_vi') = 'null' THEN
      v_passage_vi := NULL;
    ELSIF jsonb_typeof(p_payload -> 'passage_vi') = 'string' THEN
      v_passage_vi := TRIM(p_payload ->> 'passage_vi');
      IF v_passage_vi = '' THEN v_passage_vi := NULL; END IF;
    ELSE
      RAISE EXCEPTION 'passage_vi must be string or null';
    END IF;
  END IF;

  IF (p_payload ? 'passage') OR (p_payload ? 'passage_vi') THEN
    UPDATE public.toeic_test_groups
    SET
      passage = v_passage,
      passage_vi = v_passage_vi,
      updated_at = NOW()
    WHERE id = p_group_id;
  END IF;

  -- 6. Process Questions Array (if supplied)
  IF p_payload ? 'questions' THEN
    IF jsonb_typeof(p_payload -> 'questions') <> 'array' THEN
      RAISE EXCEPTION 'Payload "questions" must be an array';
    END IF;

    FOR v_q_elem IN SELECT * FROM jsonb_array_elements(p_payload -> 'questions')
    LOOP
      IF NOT (v_q_elem ? 'question_number') THEN
        RAISE EXCEPTION 'Question patch element must contain "question_number"';
      END IF;

      v_q_num := (v_q_elem ->> 'question_number')::integer;

      IF v_q_num IS NULL OR v_q_num < v_q_min OR v_q_num > v_q_max THEN
        RAISE EXCEPTION 'Question number % out of group range (%-%)', v_q_num, v_q_min, v_q_max;
      END IF;

      -- Check for duplicate question patch entries
      IF v_q_num = ANY(v_seen_q_nums) THEN
        RAISE EXCEPTION 'Duplicate question patch entry for question %', v_q_num;
      END IF;
      v_seen_q_nums := array_append(v_seen_q_nums, v_q_num);

      -- Fetch existing question record
      SELECT id, question_text, translation_vi, options, options_vi INTO v_q_rec
      FROM public.toeic_test_questions
      WHERE test_id = p_test_id AND group_id = p_group_id AND question_number = v_q_num AND is_active IS TRUE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Question % not found in group %', v_q_num, p_group_id;
      END IF;

      v_q_text := v_q_rec.question_text;
      v_trans_vi := v_q_rec.translation_vi;

      -- Patch options if key exists
      IF v_q_elem ? 'options' THEN
        v_options := v_q_elem -> 'options';
        IF jsonb_typeof(v_options) <> 'array' OR jsonb_array_length(v_options) <> 4 THEN
          RAISE EXCEPTION 'Question % "options" must be an array of exactly 4 strings', v_q_num;
        END IF;

        IF jsonb_typeof(v_options -> 0) <> 'string' OR
           jsonb_typeof(v_options -> 1) <> 'string' OR
           jsonb_typeof(v_options -> 2) <> 'string' OR
           jsonb_typeof(v_options -> 3) <> 'string' THEN
          RAISE EXCEPTION 'Question % "options" elements must all be strings', v_q_num;
        END IF;

        v_opts_arr := ARRAY[
          v_options ->> 0,
          v_options ->> 1,
          v_options ->> 2,
          v_options ->> 3
        ];
      END IF;

      -- Patch options_vi if key exists
      IF v_q_elem ? 'options_vi' THEN
        v_options_vi := v_q_elem -> 'options_vi';
        IF jsonb_typeof(v_options_vi) <> 'array' OR jsonb_array_length(v_options_vi) <> 4 THEN
          RAISE EXCEPTION 'Question % "options_vi" must be an array of exactly 4 strings', v_q_num;
        END IF;

        IF jsonb_typeof(v_options_vi -> 0) <> 'string' OR
           jsonb_typeof(v_options_vi -> 1) <> 'string' OR
           jsonb_typeof(v_options_vi -> 2) <> 'string' OR
           jsonb_typeof(v_options_vi -> 3) <> 'string' THEN
          RAISE EXCEPTION 'Question % "options_vi" elements must all be strings', v_q_num;
        END IF;

        v_opts_vi_arr := ARRAY[
          v_options_vi ->> 0,
          v_options_vi ->> 1,
          v_options_vi ->> 2,
          v_options_vi ->> 3
        ];
      END IF;

      -- Patch question_text if key exists
      IF v_q_elem ? 'question_text' THEN
        IF jsonb_typeof(v_q_elem -> 'question_text') = 'null' THEN
          v_q_text := NULL;
        ELSIF jsonb_typeof(v_q_elem -> 'question_text') = 'string' THEN
          v_q_text := TRIM(v_q_elem ->> 'question_text');
          IF v_q_text = '' THEN v_q_text := NULL; END IF;
        ELSE
          RAISE EXCEPTION 'Question % question_text must be string or null', v_q_num;
        END IF;
      END IF;

      -- Patch translation_vi if key exists
      IF v_q_elem ? 'translation_vi' THEN
        IF jsonb_typeof(v_q_elem -> 'translation_vi') = 'null' THEN
          v_trans_vi := NULL;
        ELSIF jsonb_typeof(v_q_elem -> 'translation_vi') = 'string' THEN
          v_trans_vi := TRIM(v_q_elem ->> 'translation_vi');
          IF v_trans_vi = '' THEN v_trans_vi := NULL; END IF;
        ELSE
          RAISE EXCEPTION 'Question % translation_vi must be string or null', v_q_num;
        END IF;
      END IF;

      -- Execute update on question record
      UPDATE public.toeic_test_questions
      SET
        question_text = v_q_text,
        translation_vi = v_trans_vi,
        options = CASE WHEN v_q_elem ? 'options' THEN to_jsonb(v_opts_arr) ELSE options END,
        options_vi = CASE WHEN v_q_elem ? 'options_vi' THEN to_jsonb(v_opts_vi_arr) ELSE options_vi END,
        updated_at = NOW()
      WHERE id = v_q_rec.id;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'group_id', p_group_id,
    'updated_range', format('%s-%s', v_q_min, v_q_max)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_toeic_part6_group(uuid, uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_toeic_part6_group(uuid, uuid, jsonb) TO authenticated;
