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

-- HELPER: EXTRACT PASSAGE TEXT FROM PASSAGE / DOCUMENTS
create or replace function public.part7_get_passage_text(p_passage text, p_documents jsonb)
returns text
language plpgsql immutable
as $$
declare
  v_text text := '';
  v_doc jsonb;
begin
  if p_passage is not null and trim(p_passage) <> '' then
    return p_passage;
  end if;
  
  if p_documents is not null and jsonb_typeof(p_documents) = 'array' then
    for v_doc in select * from jsonb_array_elements(p_documents) loop
      if jsonb_typeof(v_doc) = 'string' then
        v_text := v_text || E'\n\n' || (v_doc#>>'{}');
      elsif jsonb_typeof(v_doc) = 'object' then
        if v_doc->>'title' is not null and trim(v_doc->>'title') <> '' then
          v_text := v_text || E'\n\n' || (v_doc->>'title');
        end if;
        if v_doc->>'content' is not null and trim(v_doc->>'content') <> '' then
          v_text := v_text || E'\n\n' || (v_doc->>'content');
        elsif v_doc->>'text' is not null and trim(v_doc->>'text') <> '' then
          v_text := v_text || E'\n\n' || (v_doc->>'text');
        elsif v_doc->>'body' is not null and trim(v_doc->>'body') <> '' then
          v_text := v_text || E'\n\n' || (v_doc->>'body');
        end if;
      end if;
    end loop;
  end if;
  
  return trim(v_text);
end;
$$;

-- HELPER: NORMALIZE PASSAGE TEXT FOR FINGERPRINTING
create or replace function public.part7_normalize_passage(p_text text)
returns text
language plpgsql immutable
as $$
declare
  v_str text;
begin
  if p_text is null or trim(p_text) = '' then
    return '';
  end if;
  
  -- Replace CRLF/CR with LF
  v_str := regexp_replace(p_text, E'\r\n|\r', E'\n', 'g');
  -- Replace multiple horizontal spaces/tabs in each line with single space
  v_str := regexp_replace(v_str, '[ \t]+', ' ', 'g');
  -- Collapse 3+ newlines into double newlines
  v_str := regexp_replace(v_str, '\n{3,}', E'\n\n', 'g');
  -- Trim whitespace
  return trim(v_str);
end;
$$;

-- HELPER: COMPUTE PASSAGE FINGERPRINT (MD5 32-CHAR LOWERCASE HEX)
create or replace function public.part7_compute_passage_fingerprint(p_passage text, p_documents jsonb)
returns text
language plpgsql immutable
as $$
declare
  v_raw text;
  v_norm text;
begin
  v_raw := public.part7_get_passage_text(p_passage, p_documents);
  v_norm := public.part7_normalize_passage(v_raw);
  if v_norm = '' then
    return '';
  end if;
  return md5(v_norm);
end;
$$;


-- 2. ADMIN RPC: GET PART 7 STRUCTURE STATUS (WITH PASSAGE FINGERPRINT & DRIFT DETECTION)
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
  v_empty_group_cnt integer := 0;
  v_passage_drift_cnt integer := 0;
  v_locked_group_elem jsonb;
  v_locked_g_id text;
  v_locked_g_fp text;
  v_current_g_fp text;
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

  -- Build group details and compute exact DB assignment lock hash
  select jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'part', g.part,
      'sort_order', g.sort_order,
      'passage', coalesce(g.passage, ''),
      'passage_fingerprint', public.part7_compute_passage_fingerprint(g.passage, g.documents),
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

  -- Check structural anomalies
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

  -- Check empty active groups
  select count(*)::integer into v_empty_group_cnt
  from public.toeic_test_groups g
  where g.test_id = p_test_id
    and lower(trim(g.part)) = 'part7'
    and g.is_active is true
    and not exists (
      select 1 from public.toeic_test_questions q
      where q.group_id = g.id and q.is_active is true
    );

  -- Compute exact DB assignment lock hash: "group_uuid_A:147,148|group_uuid_B:149,150,151|..."
  select array_to_string(
    array_agg(group_part order by min_qn),
    '|'
  )
  into v_current_hash
  from (
    select
      min(question_number) as min_qn,
      group_id::text || ':' || string_agg(question_number::text, ',' order by question_number) as group_part
    from public.toeic_test_questions
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and question_number between 147 and 200
      and is_active is true
    group by group_id
  ) sub;

  v_current_hash := coalesce(v_current_hash, '');

  -- Check passage drift between locked manifest and current DB
  if v_test.part7_structure_manifest is not null and jsonb_typeof(v_test.part7_structure_manifest->'groups') = 'array' then
    for v_locked_group_elem in select * from jsonb_array_elements(v_test.part7_structure_manifest->'groups') loop
      v_locked_g_id := v_locked_group_elem->>'targetGroupId';
      v_locked_g_fp := coalesce(v_locked_group_elem->>'passageFingerprint', '');

      if v_locked_g_id is not null and v_locked_g_id != '' then
        select public.part7_compute_passage_fingerprint(passage, documents)
        into v_current_g_fp
        from public.toeic_test_groups
        where id = v_locked_g_id::uuid and is_active is true;

        if v_current_g_fp is null or v_current_g_fp != v_locked_g_fp then
          v_passage_drift_cnt := v_passage_drift_cnt + 1;
        end if;
      end if;
    end loop;
  end if;

  if v_test.part7_structure_hash is not null and v_test.part7_structure_hash != '' then
    if v_missing_cnt > 0 or v_dupe_cnt > 0 or v_q_count != 54 or v_empty_group_cnt > 0 or v_passage_drift_cnt > 0 then
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
    'empty_active_group_count', v_empty_group_cnt,
    'passage_drift_count', v_passage_drift_cnt,
    'groups', v_groups
  );
end;
$$;

revoke execute on function public.admin_get_toeic_part7_structure_status(uuid) from public;
revoke execute on function public.admin_get_toeic_part7_structure_status(uuid) from anon;
grant execute on function public.admin_get_toeic_part7_structure_status(uuid) to authenticated;


-- 3. ADMIN RPC: APPLY PART 7 STRUCTURE & LOCK (WITH PASSAGE FINGERPRINT BINDING VERIFICATION)
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
  v_backend_assignment_hash text;

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
  v_order_num numeric;
  v_start_q_num numeric;
  v_end_q_num numeric;
  v_order integer;
  v_start_q integer;
  v_end_q integer;
  v_qnums_arr jsonb;
  v_target_g_id uuid;
  v_manifest_passage_fp text;
  v_db_passage_fp text;

  v_qnum_elem jsonb;
  v_qnum_num numeric;
  v_qnum integer;
  v_min_in_group integer;
  v_max_in_group integer;
  v_prev_qnum integer;

  v_manifest_qnum_count integer := 0;
  v_manifest_group_count integer := 0;
  v_target_group_ids uuid[] := array[]::uuid[];
  v_manifest_orders integer[] := array[]::integer[];
  v_target_g_record record;

  v_updated_rows integer := 0;
  v_canonical_groups_json jsonb;
  v_canonical_manifest jsonb;
  v_actual_target_qnums jsonb;
  v_expected_target_qnums jsonb;
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

  -- 2. RECOMPUTE & VERIFY CURRENT DB ASSIGNMENT LOCK HASH (STALE PLAN GUARD)
  select array_to_string(
    array_agg(group_part order by min_qn),
    '|'
  )
  into v_current_db_hash
  from (
    select
      min(question_number) as min_qn,
      group_id::text || ':' || string_agg(question_number::text, ',' order by question_number) as group_part
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

  -- 5. STRICT MANIFEST GROUPS VALIDATION & PASSAGE FINGERPRINT MATCHING
  create temp table _manifest_groups (
    group_order integer not null,
    start_q integer not null,
    end_q integer not null,
    target_group_id uuid not null,
    source_header text,
    document_kind text,
    passage_fp text not null,
    qnums jsonb not null
  ) on commit drop;

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

    -- Strict integer JSON type checks
    if jsonb_typeof(v_group_elem->'order') != 'number' or jsonb_typeof(v_group_elem->'startQuestion') != 'number' or jsonb_typeof(v_group_elem->'endQuestion') != 'number' then
      raise exception 'Manifest group numeric fields (order, startQuestion, endQuestion) must be JSON numbers';
    end if;

    v_order_num := (v_group_elem->>'order')::numeric;
    v_start_q_num := (v_group_elem->>'startQuestion')::numeric;
    v_end_q_num := (v_group_elem->>'endQuestion')::numeric;

    if v_order_num != floor(v_order_num) or v_start_q_num != floor(v_start_q_num) or v_end_q_num != floor(v_end_q_num) then
      raise exception 'Manifest group fields (order, startQuestion, endQuestion) must be integers';
    end if;

    v_order := v_order_num::integer;
    v_start_q := v_start_q_num::integer;
    v_end_q := v_end_q_num::integer;
    v_qnums_arr := v_group_elem->'questionNumbers';

    if v_order < 0 then
      raise exception 'Manifest group order must be >= 0';
    end if;

    if v_order = any(v_manifest_orders) then
      raise exception 'Duplicate manifest group order % found', v_order;
    end if;
    v_manifest_orders := array_append(v_manifest_orders, v_order);

    -- Validate passageFingerprint presence and non-emptiness
    v_manifest_passage_fp := coalesce(trim(v_group_elem->>'passageFingerprint'), '');
    if v_manifest_passage_fp = '' then
      raise exception 'Manifest group Q%–% is missing a valid passageFingerprint. Lock rejected.', v_start_q, v_end_q;
    end if;

    if v_qnums_arr is null or jsonb_typeof(v_qnums_arr) != 'array' or jsonb_array_length(v_qnums_arr) = 0 then
      raise exception 'Manifest group questionNumbers must be a non-empty JSON array';
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
    select id, passage, documents into v_target_g_record
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

    -- PASSAGE FINGERPRINT MATCHING: Check DB group passage/documents fingerprint against manifest's passageFingerprint
    v_db_passage_fp := public.part7_compute_passage_fingerprint(v_target_g_record.passage, v_target_g_record.documents);

    if v_db_passage_fp is null or v_db_passage_fp != v_manifest_passage_fp then
      raise exception 'Target group % passage does not match source passage for Q%–%. Re-scan or repair content first.', v_target_g_id, v_start_q, v_end_q;
    end if;

    v_target_group_ids := array_append(v_target_group_ids, v_target_g_id);

    -- Validate questionNumbers for this group
    v_prev_qnum := 0;
    v_min_in_group := 999;
    v_max_in_group := 0;

    for v_qnum_elem in select * from jsonb_array_elements(v_qnums_arr)
    loop
      if jsonb_typeof(v_qnum_elem) != 'number' then
        raise exception 'questionNumbers item must be a JSON number';
      end if;

      v_qnum_num := v_qnum_elem::numeric;
      if v_qnum_num != floor(v_qnum_num) then
        raise exception 'questionNumbers item must be an integer';
      end if;

      v_qnum := v_qnum_num::integer;
      if v_qnum < 147 or v_qnum > 200 then
        raise exception 'Question number Q% in manifest group is out of range Q147-200', v_qnum;
      end if;

      if v_prev_qnum > 0 and v_qnum != v_prev_qnum + 1 then
        raise exception 'Question numbers in manifest group Q%–% are not contiguous (expected Q%, got Q%)', v_start_q, v_end_q, v_prev_qnum + 1, v_qnum;
      end if;

      v_prev_qnum := v_qnum;
      if v_qnum < v_min_in_group then v_min_in_group := v_qnum; end if;
      if v_qnum > v_max_in_group then v_max_in_group := v_qnum; end if;

      insert into _manifest_qnums (qnum, group_order, target_group_id)
      values (v_qnum, v_order, v_target_g_id);

      v_manifest_qnum_count := v_manifest_qnum_count + 1;
    end loop;

    -- Strict range equality check: startQuestion == MIN(qnums) and endQuestion == MAX(qnums)
    if v_start_q != v_min_in_group or v_end_q != v_max_in_group then
      raise exception 'Manifest group range Q%–% does not match questionNumbers MIN/MAX (Q%–%)', v_start_q, v_end_q, v_min_in_group, v_max_in_group;
    end if;

    insert into _manifest_groups (group_order, start_q, end_q, target_group_id, source_header, document_kind, passage_fp, qnums)
    values (
      v_order,
      v_start_q,
      v_end_q,
      v_target_g_id,
      v_group_elem->>'sourceHeader',
      v_group_elem->>'documentKind',
      v_manifest_passage_fp,
      v_qnums_arr
    );
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

  -- Build CANONICAL BACKEND ASSIGNMENT HASH (sorted by start_q ASC)
  select array_to_string(
    array_agg(target_group_id::text || ':' || (
      select string_agg(q_elem::text, ',' order by q_elem::integer)
      from jsonb_array_elements(qnums) q_elem
    ) order by start_q),
    '|'
  )
  into v_backend_assignment_hash
  from _manifest_groups;

  if v_frontend_target_hash != '' and v_frontend_target_hash != v_backend_assignment_hash then
    raise exception 'Frontend target hash (%) does not match backend-derived assignment hash (%).', v_frontend_target_hash, v_backend_assignment_hash;
  end if;

  -- Build CANONICAL MANIFEST JSON (sorted by start_q ASC, excluding untrusted keys)
  select jsonb_agg(
    jsonb_build_object(
      'order', group_order,
      'startQuestion', start_q,
      'endQuestion', end_q,
      'questionNumbers', qnums,
      'targetGroupId', target_group_id,
      'passageFingerprint', passage_fp,
      'sourceHeader', coalesce(source_header, 'Questions ' || start_q || '–' || end_q),
      'documentKind', document_kind
    ) order by start_q
  )
  into v_canonical_groups_json
  from _manifest_groups;

  v_canonical_manifest := jsonb_build_object(
    'version', 1,
    'part', 'part7',
    'startQuestion', 147,
    'endQuestion', 200,
    'questionCount', 54,
    'groupCount', v_manifest_group_count,
    'groups', v_canonical_groups_json
  );

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

  -- 8. VERIFY EXACT TARGET GROUP MEMBERSHIP POST-REPAIR
  for v_target_g_id, v_expected_target_qnums in
    select target_group_id, qnums from _manifest_groups
  loop
    select jsonb_agg(question_number order by question_number)
    into v_actual_target_qnums
    from public.toeic_test_questions
    where test_id = p_test_id
      and group_id = v_target_g_id
      and is_active is true;

    if v_actual_target_qnums is null or v_actual_target_qnums != v_expected_target_qnums then
      raise exception 'Post-repair exact target group membership mismatch for group % (actual: %, expected: %). Rollback.', v_target_g_id, v_actual_target_qnums, v_expected_target_qnums;
    end if;
  end loop;

  -- 9. VERIFY NULL-SAFE FINGERPRINTS AFTER MUTATION
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

  -- 10. RECOMPUTE & VERIFY POST-REPAIR DB ASSIGNMENT LOCK HASH
  select array_to_string(
    array_agg(group_part order by min_qn),
    '|'
  )
  into v_post_repair_hash
  from (
    select
      min(question_number) as min_qn,
      group_id::text || ':' || string_agg(question_number::text, ',' order by question_number) as group_part
    from public.toeic_test_questions
    where test_id = p_test_id
      and lower(trim(part)) = 'part7'
      and question_number between 147 and 200
      and is_active is true
    group by group_id
  ) sub;

  v_post_repair_hash := coalesce(v_post_repair_hash, '');

  if v_post_repair_hash != v_backend_assignment_hash then
    raise exception 'Post-repair assignment hash mismatch (computed: %, backend manifest: %). Rollback.', v_post_repair_hash, v_backend_assignment_hash;
  end if;

  -- 11. SAVE CANONICAL LOCK MANIFEST & ASSIGNMENT HASH TO TOEIC_TESTS
  update public.toeic_tests
  set part7_structure_manifest = v_canonical_manifest,
      part7_structure_hash = v_backend_assignment_hash,
      part7_structure_locked_at = now(),
      updated_at = now()
  where id = p_test_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Part 7 structure successfully repaired and locked.',
    'locked_hash', v_backend_assignment_hash,
    'locked_at', now()
  );
end;
$$;

revoke execute on function public.admin_apply_toeic_part7_structure(uuid, jsonb) from public;
revoke execute on function public.admin_apply_toeic_part7_structure(uuid, jsonb) from anon;
grant execute on function public.admin_apply_toeic_part7_structure(uuid, jsonb) to authenticated;
