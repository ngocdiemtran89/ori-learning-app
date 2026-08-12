-- ============================================================
-- Phase P3.7: TOEIC Part 7 Structure-First Lock & Safety Foundation
-- NEW MIGRATION — DO NOT ALTER PREVIOUSLY APPLIED MIGRATIONS
-- DO NOT APPLY TO PRODUCTION UNTIL MANUALLY REVIEWED
-- ============================================================

-- 1. ADD STRUCTURE LOCK COLUMNS TO PUBLIC.TOEIC_TESTS
alter table public.toeic_tests
  add column if not exists part7_structure_manifest jsonb null,
  add column if not exists part7_structure_hash text null,
  add column if not exists part7_structure_locked_at timestamptz null;

-- 2. ADMIN RPC: GET PART 7 STRUCTURE STATUS
create or replace function public.admin_get_toeic_part7_structure_status(p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test record;
  v_groups jsonb;
  v_q_count integer;
  v_g_count integer;
  v_current_hash text;
  v_hash_list text[];
  v_status text;
  v_matches_lock boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Access denied: Admin privileges required';
  end if;

  select id, title, is_published, part7_structure_manifest, part7_structure_hash, part7_structure_locked_at
  into v_test
  from public.toeic_tests
  where id = p_test_id;

  if not found then
    raise exception 'Test with ID % not found', p_test_id;
  end if;

  -- Build group details and compute current DB structure hash
  select jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'part', g.part,
      'sort_order', g.sort_order,
      'passage', coalesce(g.passage, ''),
      'documents_count', jsonb_array_length(coalesce(g.documents, '[]'::jsonb)),
      'has_bilingual_units', (g.part7_bilingual_units is not null and jsonb_array_length(g.part7_bilingual_units) > 0),
      'question_numbers', coalesce(qs.q_nums, '[]'::jsonb),
      'question_count', coalesce(qs.q_cnt, 0),
      'min_qn', coalesce(qs.min_qn, 0),
      'max_qn', coalesce(qs.max_qn, 0),
      'has_evidence', coalesce(qs.has_evidence, false)
    ) order by coalesce(qs.min_qn, g.sort_order)
  )
  into v_groups
  from public.toeic_test_groups g
  left join (
    select
      group_id,
      jsonb_agg(question_number order by question_number) as q_nums,
      count(*)::integer as q_cnt,
      min(question_number)::integer as min_qn,
      max(question_number)::integer as max_qn,
      bool_or(evidence is not null and jsonb_array_length(evidence) > 0) as has_evidence
    from public.toeic_test_questions
    where test_id = p_test_id
      and (part = 'part7' or question_number between 147 and 200)
      and is_active = true
    group by group_id
  ) qs on g.id = qs.group_id
  where g.test_id = p_test_id
    and g.part = 'part7'
    and g.is_active = true;

  v_groups := coalesce(v_groups, '[]'::jsonb);
  v_g_count := jsonb_array_length(v_groups);

  select count(*)::integer
  into v_q_count
  from public.toeic_test_questions
  where test_id = p_test_id
    and (part = 'part7' or question_number between 147 and 200)
    and is_active = true;

  -- Compute current structure hash (e.g. 147-148|149-151|...)
  select array_to_string(array_agg(min_qn || '-' || max_qn order by min_qn), '|')
  into v_current_hash
  from (
    select min(question_number) as min_qn, max(question_number) as max_qn
    from public.toeic_test_questions
    where test_id = p_test_id
      and (part = 'part7' or question_number between 147 and 200)
      and is_active = true
    group by group_id
  ) sub;

  v_current_hash := coalesce(v_current_hash, '');

  if v_test.part7_structure_hash is not null and v_test.part7_structure_hash != '' then
    if v_test.part7_structure_hash = v_current_hash then
      v_matches_lock := true;
      v_status := 'LOCKED';
    else
      v_matches_lock := false;
      v_status := 'DRIFT';
    end if;
  else
    v_status := 'UNVERIFIED';
  end if;

  return jsonb_build_object(
    'test_id', v_test.id,
    'test_title', v_test.title,
    'is_published', v_test.is_published,
    'status', v_status,
    'locked_manifest', v_test.part7_structure_manifest,
    'locked_hash', v_test.part7_structure_hash,
    'locked_at', v_test.part7_structure_locked_at,
    'current_structure_hash', v_current_hash,
    'matches_lock', v_matches_lock,
    'group_count', v_g_count,
    'question_count', v_q_count,
    'groups', v_groups
  );
end;
$$;

revoke execute on function public.admin_get_toeic_part7_structure_status(uuid) from public;
revoke execute on function public.admin_get_toeic_part7_structure_status(uuid) from anon;
grant execute on function public.admin_get_toeic_part7_structure_status(uuid) to authenticated;


-- 3. ADMIN RPC: APPLY PART 7 STRUCTURE & LOCK (ATOMIC 2-PHASE)
create or replace function public.admin_apply_toeic_part7_structure(
  p_test_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test record;
  v_manifest jsonb;
  v_groups_payload jsonb;
  v_mapping_payload jsonb;
  v_expected_hash text;
  v_target_hash text;

  v_current_hash text;
  v_q_count integer;
  v_g_count integer;
  v_q_min integer;
  v_q_max integer;

  v_q_fp_before text;
  v_q_fp_after text;
  v_g_fp_before text;
  v_g_fp_after text;

  v_has_bilingual_or_evidence boolean := false;
  v_map_item jsonb;
  v_q_id uuid;
  v_target_group_id uuid;
begin
  -- SECURITY CHECK
  if not public.is_admin() then
    raise exception 'Access denied: Admin privileges required';
  end if;

  if p_test_id is null or p_payload is null then
    raise exception 'Invalid input: test_id and payload are required';
  end if;

  -- 1. READ TEST & PUBLISHED GUARD
  select id, is_published, part7_structure_hash
  into v_test
  from public.toeic_tests
  where id = p_test_id;

  if not found then
    raise exception 'Test with ID % not found', p_test_id;
  end if;

  if v_test.is_published then
    raise exception 'Cannot modify structure on a published test. Unpublish test to Draft first.';
  end if;

  -- Extract payload fields
  v_manifest := p_payload->'manifest';
  v_groups_payload := v_manifest->'groups';
  v_mapping_payload := p_payload->'question_mappings';
  v_expected_hash := p_payload->>'expected_current_structure_hash';
  v_target_hash := p_payload->>'detected_structure_hash';

  if v_manifest is null or v_groups_payload is null or jsonb_array_length(v_groups_payload) = 0 then
    raise exception 'Invalid manifest payload: groups array is required';
  end if;

  -- 2. STALE REPAIR PLAN GUARD
  select array_to_string(array_agg(min_qn || '-' || max_qn order by min_qn), '|')
  into v_current_hash
  from (
    select min(question_number) as min_qn, max(question_number) as max_qn
    from public.toeic_test_questions
    where test_id = p_test_id
      and (part = 'part7' or question_number between 147 and 200)
      and is_active = true
    group by group_id
  ) sub;

  v_current_hash := coalesce(v_current_hash, '');

  if v_expected_hash is not null and v_expected_hash != '' and v_expected_hash != v_current_hash then
    raise exception 'Structure changed since scan (current DB: %, expected: %). Re-scan required.', v_current_hash, v_expected_hash;
  end if;

  -- 3. VALIDATE ACTIVE DB QUESTIONS (REQUIRE EXACT 54 QUESTIONS Q147-200)
  select count(*)::integer, min(question_number)::integer, max(question_number)::integer
  into v_q_count, v_q_min, v_q_max
  from public.toeic_test_questions
  where test_id = p_test_id
    and (part = 'part7' or question_number between 147 and 200)
    and is_active = true;

  if v_q_count != 54 or v_q_min != 147 or v_q_max != 200 then
    raise exception 'Database questions invalid for Part 7 repair: found % questions (min: %, max: %), expected exactly 54 questions Q147-200.', v_q_count, v_q_min, v_q_max;
  end if;

  -- 4. PROTECTED METADATA CHECK (Bilingual units or Evidence)
  select exists (
    select 1 from public.toeic_test_groups
    where test_id = p_test_id and part = 'part7' and is_active = true
      and part7_bilingual_units is not null and jsonb_array_length(part7_bilingual_units) > 0
  ) or exists (
    select 1 from public.toeic_test_questions
    where test_id = p_test_id and (part = 'part7' or question_number between 147 and 200) and is_active = true
      and evidence is not null and jsonb_array_length(evidence) > 0
  ) into v_has_bilingual_or_evidence;

  if v_has_bilingual_or_evidence then
    raise exception 'Cannot apply automated structure repair: target test contains existing bilingual units or evidence metadata. Manual review required.';
  end if;

  -- 5. COMPUTE FINGERPRINTS BEFORE MUTATION
  -- A. Question content fingerprint (excludes group_id)
  select md5(string_agg(
    id::text || '|' || question_number || '|' || part || '|' || coalesce(question_text, '') || '|' ||
    coalesce(translation_vi, '') || '|' || options::text || '|' || coalesce(options_vi::text, '') || '|' ||
    coalesce(correct_answer, '') || '|' || coalesce(audio_url, '') || '|' || coalesce(image_url, '') || '|' || is_active::text,
    ';' order by question_number
  ))
  into v_q_fp_before
  from public.toeic_test_questions
  where test_id = p_test_id and (part = 'part7' or question_number between 147 and 200) and is_active = true;

  -- B. Group content fingerprint (excludes question membership)
  select md5(string_agg(
    id::text || '|' || coalesce(passage, '') || '|' || coalesce(passage_vi, '') || '|' ||
    documents::text || '|' || coalesce(documents_vi::text, '') || '|' || coalesce(part7_bilingual_units::text, ''),
    ';' order by id
  ))
  into v_g_fp_before
  from public.toeic_test_groups
  where test_id = p_test_id and part = 'part7' and is_active = true;

  -- PHASE B: MUTATE QUESTION GROUP ASSIGNMENTS ONLY
  if v_mapping_payload is not null and jsonb_array_length(v_mapping_payload) > 0 then
    for v_map_item in select * from jsonb_array_elements(v_mapping_payload)
    loop
      v_q_id := (v_map_item->>'question_id')::uuid;
      v_target_group_id := (v_map_item->>'target_group_id')::uuid;

      if v_q_id is not null and v_target_group_id is not null then
        update public.toeic_test_questions
        set group_id = v_target_group_id,
            updated_at = now()
        where id = v_q_id and test_id = p_test_id;
      end if;
    end loop;
  end if;

  -- 6. VERIFY FINGERPRINTS AFTER MUTATION
  select md5(string_agg(
    id::text || '|' || question_number || '|' || part || '|' || coalesce(question_text, '') || '|' ||
    coalesce(translation_vi, '') || '|' || options::text || '|' || coalesce(options_vi::text, '') || '|' ||
    coalesce(correct_answer, '') || '|' || coalesce(audio_url, '') || '|' || coalesce(image_url, '') || '|' || is_active::text,
    ';' order by question_number
  ))
  into v_q_fp_after
  from public.toeic_test_questions
  where test_id = p_test_id and (part = 'part7' or question_number between 147 and 200) and is_active = true;

  if v_q_fp_before != v_q_fp_after then
    raise exception 'Security Violation: Question content fingerprint altered during structure repair! Transaction rolled back.';
  end if;

  select md5(string_agg(
    id::text || '|' || coalesce(passage, '') || '|' || coalesce(passage_vi, '') || '|' ||
    documents::text || '|' || coalesce(documents_vi::text, '') || '|' || coalesce(part7_bilingual_units::text, ''),
    ';' order by id
  ))
  into v_g_fp_after
  from public.toeic_test_groups
  where test_id = p_test_id and part = 'part7' and is_active = true;

  if v_g_fp_before != v_g_fp_after then
    raise exception 'Security Violation: Group content fingerprint altered during structure repair! Transaction rolled back.';
  end if;

  -- 7. RECOMPUTE & VERIFY NEW STRUCTURE HASH
  select array_to_string(array_agg(min_qn || '-' || max_qn order by min_qn), '|')
  into v_current_hash
  from (
    select min(question_number) as min_qn, max(question_number) as max_qn
    from public.toeic_test_questions
    where test_id = p_test_id
      and (part = 'part7' or question_number between 147 and 200)
      and is_active = true
    group by group_id
  ) sub;

  v_current_hash := coalesce(v_current_hash, '');

  if v_target_hash is not null and v_target_hash != '' and v_current_hash != v_target_hash then
    raise exception 'Post-repair structure hash mismatch (computed: %, expected: %). Rollback.', v_current_hash, v_target_hash;
  end if;

  -- 8. SAVE LOCK TO TOEIC_TESTS
  update public.toeic_tests
  set part7_structure_manifest = v_manifest,
      part7_structure_hash = v_current_hash,
      part7_structure_locked_at = now(),
      updated_at = now()
  where id = p_test_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Part 7 structure successfully repaired and locked.',
    'locked_hash', v_current_hash,
    'locked_at', now()
  );
end;
$$;

revoke execute on function public.admin_apply_toeic_part7_structure(uuid, jsonb) from public;
revoke execute on function public.admin_apply_toeic_part7_structure(uuid, jsonb) from anon;
grant execute on function public.admin_apply_toeic_part7_structure(uuid, jsonb) to authenticated;
