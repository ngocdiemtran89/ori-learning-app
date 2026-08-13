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

-- 2. ADMIN RPC: GET PART 7 STRUCTURE STATUS (EXACT-MEMBERSHIP HASH)
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
  v_status text;
  v_matches_lock boolean := false;
  v_missing_cnt integer := 0;
  v_dupe_cnt integer := 0;
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

  -- Build group details and compute exact-membership DB structure hash
  select jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'part', g.part,
      'sort_order', g.sort_order,
      'passage', coalesce(g.passage, ''),
      'documents_count', case
        when g.documents is not null and jsonb_typeof(g.documents) = 'array' then jsonb_array_length(g.documents)
        else 0
      end,
      'has_bilingual_units', (
        g.part7_bilingual_units is not null
        and jsonb_typeof(g.part7_bilingual_units) = 'array'
        and jsonb_array_length(g.part7_bilingual_units) > 0
      ),
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
      bool_or(
        evidence is not null
        and jsonb_typeof(evidence) = 'array'
        and jsonb_array_length(evidence) > 0
      ) as has_evidence
    from public.toeic_test_questions
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and question_number between 147 and 200
      and is_active is true
    group by group_id
  ) qs on g.id = qs.group_id
  where g.test_id = p_test_id
    and lower(trim(g.part)) = 'part7'
    and g.is_active is true;

  v_groups := coalesce(v_groups, '[]'::jsonb);
  v_g_count := jsonb_array_length(v_groups);

  select count(*)::integer
  into v_q_count
  from public.toeic_test_questions
  where test_id = p_test_id
    and lower(trim(part)) = 'part7'
    and question_number between 147 and 200
    and is_active is true;

  -- Check structural anomalies (missing or duplicate question numbers)
  select count(*)::integer into v_missing_cnt
  from generate_series(147, 200) expected_q
  where not exists (
    select 1 from public.toeic_test_questions
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and question_number = expected_q
      and is_active is true
  );

  select coalesce(sum(cnt - 1), 0)::integer into v_dupe_cnt
  from (
    select question_number, count(*) as cnt
    from public.toeic_test_questions
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and question_number between 147 and 200
      and is_active is true
    group by question_number
    having count(*) > 1
  ) dupes;

  -- Compute exact-membership DB structure hash: "147,148|149,150,151|..."
  select array_to_string(
    array_agg(q_list order by min_qn),
    '|'
  )
  into v_current_hash
  from (
    select
      min(question_number) as min_qn,
      string_agg(question_number::text, ',' order by question_number) as q_list
    from public.toeic_test_questions
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and question_number between 147 and 200
      and is_active is true
    group by group_id
  ) sub;

  v_current_hash := coalesce(v_current_hash, '');

  if v_test.part7_structure_hash is not null and v_test.part7_structure_hash != '' then
    if v_missing_cnt > 0 or v_dupe_cnt > 0 or v_q_count != 54 then
      v_matches_lock := false;
      v_status := 'DRIFT';
    elsif v_test.part7_structure_hash = v_current_hash then
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
    'missing_question_count', v_missing_cnt,
    'duplicate_question_count', v_dupe_cnt,
    'groups', v_groups
  );
end;
$$;

revoke execute on function public.admin_get_toeic_part7_structure_status(uuid) from public;
revoke execute on function public.admin_get_toeic_part7_structure_status(uuid) from anon;
grant execute on function public.admin_get_toeic_part7_structure_status(uuid) to authenticated;


-- 3. ADMIN RPC: APPLY PART 7 STRUCTURE & LOCK (ATOMIC 2-PHASE + STRICT SERVER-SIDE MANIFEST VALIDATION)
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
  v_expected_hash text;
  v_frontend_target_hash text;
  v_backend_manifest_hash text;

  v_current_db_hash text;
  v_post_repair_hash text;
  v_q_count integer;
  v_q_distinct integer;
  v_q_min integer;
  v_q_max integer;
  v_missing_q_cnt integer;
  v_active_db_group_cnt integer;

  v_q_fp_before text;
  v_q_fp_after text;
  v_g_fp_before text;
  v_g_fp_after text;

  v_has_bilingual_or_evidence boolean := false;

  v_group_elem jsonb;
  v_order integer;
  v_start_q integer;
  v_end_q integer;
  v_qnums_arr jsonb;
  v_target_g_id uuid;

  v_qnum_elem jsonb;
  v_qnum integer;
  v_prev_qnum integer;

  v_manifest_qnum_count integer := 0;
  v_manifest_group_count integer := 0;
  v_target_group_ids uuid[] := array[]::uuid[];
  v_target_g_record record;

  v_updated_rows integer := 0;
  v_group_hash_parts text[] := array[]::text[];
  v_group_q_string text;
begin
  -- SECURITY CHECK
  if not public.is_admin() then
    raise exception 'Access denied: Admin privileges required';
  end if;

  if p_test_id is null or p_payload is null or jsonb_typeof(p_payload) != 'object' then
    raise exception 'Invalid input: p_test_id and p_payload JSON object are required';
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
  if v_manifest is null or jsonb_typeof(v_manifest) != 'object' then
    raise exception 'Invalid payload: manifest JSON object is required';
  end if;

  v_groups_payload := v_manifest->'groups';
  if v_groups_payload is null or jsonb_typeof(v_groups_payload) != 'array' or jsonb_array_length(v_groups_payload) = 0 then
    raise exception 'Invalid manifest payload: groups JSON array is required';
  end if;

  v_expected_hash := coalesce(trim(p_payload->>'expected_current_structure_hash'), '');
  if v_expected_hash = '' then
    raise exception 'Invalid payload: expected_current_structure_hash is required for stale-plan protection.';
  end if;

  v_frontend_target_hash := coalesce(trim(p_payload->>'detected_structure_hash'), '');

  -- 2. RECOMPUTE & VERIFY CURRENT DB EXACT-MEMBERSHIP STRUCTURE HASH (STALE PLAN GUARD)
  select array_to_string(
    array_agg(q_list order by min_qn),
    '|'
  )
  into v_current_db_hash
  from (
    select
      min(question_number) as min_qn,
      string_agg(question_number::text, ',' order by question_number) as q_list
    from public.toeic_test_questions
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and question_number between 147 and 200
      and is_active is true
    group by group_id
  ) sub;

  v_current_db_hash := coalesce(v_current_db_hash, '');

  if v_current_db_hash != v_expected_hash then
    raise exception 'Structure changed since scan (current DB: %, expected: %). Re-scan required.', v_current_db_hash, v_expected_hash;
  end if;

  -- 3. VALIDATE ACTIVE DB QUESTION SET EXACTLY (Q147-200, NO MISSING, NO DUPES)
  select
    count(*)::integer,
    count(distinct question_number)::integer,
    min(question_number)::integer,
    max(question_number)::integer
  into v_q_count, v_q_distinct, v_q_min, v_q_max
  from public.toeic_test_questions
  where test_id = p_test_id
    and lower(trim(part)) = 'part7'
    and question_number between 147 and 200
    and is_active is true;

  if v_q_count != 54 or v_q_distinct != 54 or v_q_min != 147 or v_q_max != 200 then
    raise exception 'Database active questions invalid for Part 7 repair: found % questions (distinct: %, min: %, max: %), expected exactly 54 unique questions Q147-200.', v_q_count, v_q_distinct, v_q_min, v_q_max;
  end if;

  select count(*)::integer into v_missing_q_cnt
  from generate_series(147, 200) expected_q
  where not exists (
    select 1 from public.toeic_test_questions
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and question_number = expected_q
      and is_active is true
  );

  if v_missing_q_cnt > 0 then
    raise exception 'Database is missing % active Part 7 questions in range Q147-200.', v_missing_q_cnt;
  end if;

  -- 4. VALIDATE DB GROUP COUNT & MANIFEST GROUP COUNT MATCH
  select count(*)::integer
  into v_active_db_group_cnt
  from public.toeic_test_groups
  where test_id = p_test_id
    and lower(trim(part)) = 'part7'
    and is_active is true;

  v_manifest_group_count := jsonb_array_length(v_groups_payload);

  if v_active_db_group_cnt != v_manifest_group_count then
    raise exception 'Group count mismatch: active DB group count (%) does not equal manifest group count (%). Automatic repair disabled.', v_active_db_group_cnt, v_manifest_group_count;
  end if;

  -- 5. STRICT MANIFEST GROUPS VALIDATION & BACKEND HASH DERIVATION
  -- Temporary table to track parsed manifest question numbers
  create temp table _manifest_qnums (
    qnum integer primary key,
    group_order integer not null,
    target_group_id uuid not null
  ) on commit drop;

  v_manifest_qnum_count := 0;

  for v_group_elem in select * from jsonb_array_elements(v_groups_payload)
  loop
    if jsonb_typeof(v_group_elem) != 'object' then
      raise exception 'Manifest group item must be a JSON object';
    end if;

    v_order := (v_group_elem->>'order')::integer;
    v_start_q := (v_group_elem->>'startQuestion')::integer;
    v_end_q := (v_group_elem->>'endQuestion')::integer;
    v_qnums_arr := v_group_elem->'questionNumbers';

    if v_order is null or v_start_q is null or v_end_q is null or v_qnums_arr is null or jsonb_typeof(v_qnums_arr) != 'array' or jsonb_array_length(v_qnums_arr) = 0 then
      raise exception 'Manifest group missing required fields (order, startQuestion, endQuestion, questionNumbers)';
    end if;

    if v_start_q < 147 or v_end_q > 200 or v_end_q < v_start_q then
      raise exception 'Manifest group Q%–% is out of range Q147-200', v_start_q, v_end_q;
    end if;

    -- Extract targetGroupId
    begin
      v_target_g_id := (v_group_elem->>'targetGroupId')::uuid;
    exception when others then
      raise exception 'Invalid targetGroupId format for manifest group Q%–%', v_start_q, v_end_q;
    end;

    if v_target_g_id is null then
      raise exception 'Manifest group Q%–% missing targetGroupId', v_start_q, v_end_q;
    end if;

    -- Validate targetGroupId exists in DB, belongs to p_test_id, part='part7', and is_active=true
    select id into v_target_g_record
    from public.toeic_test_groups
    where id = v_target_g_id
      and test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and is_active is true;

    if not found then
      raise exception 'targetGroupId % for manifest group Q%–% is invalid or does not belong to active Part 7 groups of test %', v_target_g_id, v_start_q, v_end_q, p_test_id;
    end if;

    if v_target_g_id = any(v_target_group_ids) then
      raise exception 'Duplicate targetGroupId % found in manifest payload', v_target_g_id;
    end if;

    v_target_group_ids := array_append(v_target_group_ids, v_target_g_id);

    -- Validate questionNumbers for this group
    v_group_q_string := '';
    v_prev_qnum := 0;

    for v_qnum_elem in select * from jsonb_array_elements(v_qnums_arr)
    loop
      v_qnum := v_qnum_elem::integer;
      if v_qnum < v_start_q or v_qnum > v_end_q then
        raise exception 'Question number Q% in manifest group Q%–% is out of group declared range', v_qnum, v_start_q, v_end_q;
      end if;

      if v_prev_qnum > 0 then
        if v_qnum != v_prev_qnum + 1 then
          raise exception 'Question numbers in manifest group Q%–% are not contiguous (expected Q%, got Q%)', v_start_q, v_end_q, v_prev_qnum + 1, v_qnum;
        end if;
        v_group_q_string := v_group_q_string || ',' || v_qnum::text;
      else
        v_group_q_string := v_qnum::text;
      end if;

      v_prev_qnum := v_qnum;

      insert into _manifest_qnums (qnum, group_order, target_group_id)
      values (v_qnum, v_order, v_target_g_id);

      v_manifest_qnum_count := v_manifest_qnum_count + 1;
    end loop;

    v_group_hash_parts := array_append(v_group_hash_parts, v_group_q_string);
  end loop;

  -- Validate manifest question numbers cover exactly Q147-200 (54 total)
  if v_manifest_qnum_count != 54 then
    raise exception 'Manifest contains % questions, expected exactly 54 questions Q147-200.', v_manifest_qnum_count;
  end if;

  select count(*)::integer into v_missing_q_cnt
  from generate_series(147, 200) expected_q
  where not exists (
    select 1 from _manifest_qnums where qnum = expected_q
  );

  if v_missing_q_cnt > 0 then
    raise exception 'Manifest is missing % questions in range Q147-200.', v_missing_q_cnt;
  end if;

  -- Compute canonical backend manifest exact-membership structure hash
  v_backend_manifest_hash := array_to_string(v_group_hash_parts, '|');

  if v_frontend_target_hash != '' and v_frontend_target_hash != v_backend_manifest_hash then
    raise exception 'Frontend target hash (%) does not match backend-derived manifest hash (%).', v_frontend_target_hash, v_backend_manifest_hash;
  end if;

  -- 6. NULL-SAFE PROTECTED METADATA CHECK (Bilingual units or Evidence)
  select exists (
    select 1 from public.toeic_test_groups
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and is_active is true
      and part7_bilingual_units is not null
      and jsonb_typeof(part7_bilingual_units) = 'array'
      and jsonb_array_length(part7_bilingual_units) > 0
  ) or exists (
    select 1 from public.toeic_test_questions
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and question_number between 147 and 200
      and is_active is true
      and evidence is not null
      and jsonb_typeof(evidence) = 'array'
      and jsonb_array_length(evidence) > 0
  ) into v_has_bilingual_or_evidence;

  if v_has_bilingual_or_evidence then
    raise exception 'Cannot apply automated structure repair: target test contains existing bilingual units or evidence metadata. Manual review required.';
  end if;

  -- 7. NULL-SAFE FINGERPRINTS BEFORE MUTATION
  -- Question protected content fingerprint (excludes group_id & updated_at)
  select md5(string_agg(
    coalesce(id::text, '') || '|' ||
    coalesce(question_number::text, '') || '|' ||
    coalesce(part, '') || '|' ||
    coalesce(question_text, '') || '|' ||
    coalesce(translation_vi, '') || '|' ||
    coalesce(options::text, '') || '|' ||
    coalesce(options_vi::text, '') || '|' ||
    coalesce(correct_answer, '') || '|' ||
    coalesce(audio_url, '') || '|' ||
    coalesce(image_url, '') || '|' ||
    coalesce(is_active::text, ''),
    ';' order by question_number
  ))
  into v_q_fp_before
  from public.toeic_test_questions
  where test_id = p_test_id
    and lower(trim(part)) = 'part7'
    and question_number between 147 and 200
    and is_active is true;

  -- Group protected content fingerprint (excludes question membership)
  select md5(string_agg(
    coalesce(id::text, '') || '|' ||
    coalesce(part, '') || '|' ||
    coalesce(is_active::text, '') || '|' ||
    coalesce(passage, '') || '|' ||
    coalesce(passage_vi, '') || '|' ||
    coalesce(documents::text, '') || '|' ||
    coalesce(documents_vi::text, '') || '|' ||
    coalesce(part7_bilingual_units::text, ''),
    ';' order by id
  ))
  into v_g_fp_before
  from public.toeic_test_groups
  where test_id = p_test_id
    and lower(trim(part)) = 'part7'
    and is_active is true;

  -- PHASE B: MUTATE QUESTION GROUP ASSIGNMENTS SERVER-SIDE (QNUM -> TARGET_GROUP_ID)
  v_updated_rows := 0;

  for v_qnum, v_target_g_id in
    select qnum, target_group_id from _manifest_qnums order by qnum
  loop
    update public.toeic_test_questions
    set group_id = v_target_g_id,
        updated_at = now()
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and question_number = v_qnum
      and is_active is true;

    if not found then
      raise exception 'Failed to update question Q% to target group %', v_qnum, v_target_g_id;
    end if;

    v_updated_rows := v_updated_rows + 1;
  end loop;

  if v_updated_rows != 54 then
    raise exception 'Regrouping updated % rows, expected exactly 54.', v_updated_rows;
  end if;

  -- 8. VERIFY NULL-SAFE FINGERPRINTS AFTER MUTATION
  select md5(string_agg(
    coalesce(id::text, '') || '|' ||
    coalesce(question_number::text, '') || '|' ||
    coalesce(part, '') || '|' ||
    coalesce(question_text, '') || '|' ||
    coalesce(translation_vi, '') || '|' ||
    coalesce(options::text, '') || '|' ||
    coalesce(options_vi::text, '') || '|' ||
    coalesce(correct_answer, '') || '|' ||
    coalesce(audio_url, '') || '|' ||
    coalesce(image_url, '') || '|' ||
    coalesce(is_active::text, ''),
    ';' order by question_number
  ))
  into v_q_fp_after
  from public.toeic_test_questions
  where test_id = p_test_id
    and lower(trim(part)) = 'part7'
    and question_number between 147 and 200
    and is_active is true;

  if v_q_fp_before != v_q_fp_after then
    raise exception 'Security Violation: Question content fingerprint altered during structure repair! Transaction rolled back.';
  end if;

  select md5(string_agg(
    coalesce(id::text, '') || '|' ||
    coalesce(part, '') || '|' ||
    coalesce(is_active::text, '') || '|' ||
    coalesce(passage, '') || '|' ||
    coalesce(passage_vi, '') || '|' ||
    coalesce(documents::text, '') || '|' ||
    coalesce(documents_vi::text, '') || '|' ||
    coalesce(part7_bilingual_units::text, ''),
    ';' order by id
  ))
  into v_g_fp_after
  from public.toeic_test_groups
  where test_id = p_test_id
    and lower(trim(part)) = 'part7'
    and is_active is true;

  if v_g_fp_before != v_g_fp_after then
    raise exception 'Security Violation: Group content fingerprint altered during structure repair! Transaction rolled back.';
  end if;

  -- 9. RECOMPUTE & VERIFY POST-REPAIR DB EXACT-MEMBERSHIP STRUCTURE HASH
  select array_to_string(
    array_agg(q_list order by min_qn),
    '|'
  )
  into v_post_repair_hash
  from (
    select
      min(question_number) as min_qn,
      string_agg(question_number::text, ',' order by question_number) as q_list
    from public.toeic_test_questions
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and question_number between 147 and 200
      and is_active is true
    group by group_id
  ) sub;

  v_post_repair_hash := coalesce(v_post_repair_hash, '');

  if v_post_repair_hash != v_backend_manifest_hash then
    raise exception 'Post-repair structure hash mismatch (computed: %, backend manifest: %). Rollback.', v_post_repair_hash, v_backend_manifest_hash;
  end if;

  -- 10. SAVE LOCK TO TOEIC_TESTS
  update public.toeic_tests
  set part7_structure_manifest = v_manifest,
      part7_structure_hash = v_backend_manifest_hash,
      part7_structure_locked_at = now(),
      updated_at = now()
  where id = p_test_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Part 7 structure successfully repaired and locked.',
    'locked_hash', v_backend_manifest_hash,
    'locked_at', now()
  );
end;
$$;

revoke execute on function public.admin_apply_toeic_part7_structure(uuid, jsonb) from public;
revoke execute on function public.admin_apply_toeic_part7_structure(uuid, jsonb) from anon;
grant execute on function public.admin_apply_toeic_part7_structure(uuid, jsonb) to authenticated;
