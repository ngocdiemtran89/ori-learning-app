-- ============================================================
-- READ-ONLY Production Preflight Inspection Script for TOEIC V2
-- File: database/preflight/20260813_toeic_v2_production_readonly_preflight.sql
-- Security: 100% SELECT ONLY. Zero writes, zero DDL, zero DML. Safe to run on Production.
-- ============================================================

-- PREFLIGHT_01_V2_TABLE_EXISTENCE
-- Verify whether V2 tables already exist in public schema (Explicit public subquery join)
select
  'PREFLIGHT_01_V2_TABLE_EXISTENCE' as check_section,
  t.target_table,
  tbl.table_name as existing_table_name,
  case when tbl.table_name is not null then 'EXISTS (UNEXPECTED BEFORE MIGRATION)' else 'ABSENT (EXPECTED)' end as status
from (
  select 'toeic_learning_items' as target_table
  union all select 'toeic_question_learning_items'
  union all select 'toeic_learning_practice_events'
) t
left join (
  select table_name
  from information_schema.tables
  where table_schema = 'public'
) tbl on tbl.table_name = t.target_table;


-- PREFLIGHT_01_RPC_EXISTENCE
-- Verify whether V2 RPCs already exist in public schema (Explicit public schema subquery join)
select
  'PREFLIGHT_01_RPC_EXISTENCE' as check_section,
  r.target_rpc,
  fn.proname as existing_routine_name,
  pg_get_function_identity_arguments(fn.oid) as existing_arguments,
  case when fn.proname is not null then 'EXISTS (UNEXPECTED BEFORE MIGRATION)' else 'ABSENT (EXPECTED)' end as status
from (
  select 'admin_import_v2_question_learning_links' as target_rpc
  union all select 'student_get_safe_v2_practice_questions'
  union all select 'student_check_v2_practice_answer'
) r
left join (
  select p.*
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
) fn on fn.proname = r.target_rpc;


-- PREFLIGHT_02_REQUIRED_FUNCTIONS
-- Inspect required legacy helper functions strictly in public schema (Owner, signature, security definer)
select
  'PREFLIGHT_02_REQUIRED_FUNCTIONS' as check_section,
  r.target_function,
  fn.proname as actual_name,
  pg_get_function_identity_arguments(fn.oid) as arguments,
  pg_get_userbyid(fn.proowner) as function_owner,
  case when fn.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security_mode,
  case when fn.proname is not null then 'FOUND (EXPECTED)' else 'MISSING (CRITICAL)' end as status
from (
  select 'is_admin' as target_function
  union all select 'has_active_access'
  union all select 'admin_create_toeic_test_with_content'
) r
left join (
  select p.*
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
) fn on fn.proname = r.target_function;


-- PREFLIGHT_03_CANONICAL_COLUMNS_CONTRACT
-- Explicit check for required V2 dependency columns in canonical tables (Surfaces MISSING if absent)
select
  'PREFLIGHT_03_CANONICAL_COLUMNS_CONTRACT' as check_section,
  req.target_table,
  req.required_column,
  cols.data_type as actual_data_type,
  cols.is_nullable,
  case when cols.column_name is not null then 'PRESENT' else 'MISSING' end as status
from (
  select 'toeic_tests' as target_table, 'id' as required_column
  union all select 'toeic_tests', 'status'
  union all select 'toeic_tests', 'is_published'
  union all select 'toeic_test_questions', 'id'
  union all select 'toeic_test_questions', 'test_id'
  union all select 'toeic_test_questions', 'question_number'
  union all select 'toeic_test_questions', 'part'
  union all select 'toeic_test_questions', 'group_id'
  union all select 'toeic_test_questions', 'question_text'
  union all select 'toeic_test_questions', 'options'
  union all select 'toeic_test_questions', 'correct_answer'
  union all select 'toeic_test_questions', 'explanation'
  union all select 'toeic_test_questions', 'transcript'
  union all select 'toeic_test_questions', 'audio_url'
  union all select 'toeic_test_questions', 'image_url'
  union all select 'toeic_test_questions', 'is_active'
  union all select 'toeic_test_groups', 'id'
  union all select 'toeic_test_groups', 'title'
  union all select 'toeic_test_groups', 'passage'
  union all select 'toeic_test_groups', 'transcript'
  union all select 'toeic_test_groups', 'documents'
  union all select 'toeic_test_groups', 'audio_url'
  union all select 'toeic_test_groups', 'image_url'
) req
left join information_schema.columns cols
  on cols.table_schema = 'public' and cols.table_name = req.target_table and cols.column_name = req.required_column
order by req.target_table, req.required_column;


-- PREFLIGHT_04_PART_DISTRIBUTION
-- READ-ONLY inspection of part representations for ALL questions and PUBLISHED+ACTIVE questions separately (Type-safe lower(part::text))
select
  'PREFLIGHT_04_PART_DISTRIBUTION_ALL' as check_section,
  lower(part::text) as part_text,
  count(*) as question_count
from public.toeic_test_questions
group by lower(part::text)
union all
select
  'PREFLIGHT_04_PART_DISTRIBUTION_PUBLISHED_ACTIVE' as check_section,
  lower(q.part::text) as part_text,
  count(*) as question_count
from public.toeic_test_questions q
join public.toeic_tests t on t.id = q.test_id
where t.is_published = true and q.is_active = true
group by lower(q.part::text)
order by check_section, part_text;


-- PREFLIGHT_05_OPTIONS_TYPE_AND_LENGTH_DISTRIBUTION
-- READ-ONLY inspection of options JSON types and array length distribution per Part (Type-safe lower(part::text))
select
  'PREFLIGHT_05_OPTIONS_TYPE_AND_LENGTH_DISTRIBUTION' as check_section,
  lower(part::text) as part_text,
  jsonb_typeof(to_jsonb(options)) as options_type,
  case
    when jsonb_typeof(to_jsonb(options)) = 'array' then jsonb_array_length(to_jsonb(options))::text
    when jsonb_typeof(to_jsonb(options)) = 'object' then 'object_keys'
    else 'none'
  end as array_length_or_shape,
  count(*) as question_count
from public.toeic_test_questions
group by lower(part::text), jsonb_typeof(to_jsonb(options)), array_length_or_shape
order by part_text, options_type;


-- PREFLIGHT_06_OPTIONS_OBJECT_KEY_DISTRIBUTION
-- READ-ONLY deterministic aggregation of sorted object keys per Part (Zero text/answers exposed)
select
  'PREFLIGHT_06_OPTIONS_OBJECT_KEY_DISTRIBUTION' as check_section,
  part_text,
  keys_summary,
  count(*) as question_count
from (
  select
    lower(q.part::text) as part_text,
    q.id,
    (select string_agg(k, ',' order by k) from jsonb_object_keys(to_jsonb(q.options)) k) as keys_summary
  from public.toeic_test_questions q
  where jsonb_typeof(to_jsonb(q.options)) = 'object'
) sub
group by part_text, keys_summary
order by part_text, keys_summary;


-- PREFLIGHT_07_ARRAY_LABEL_CONSISTENCY
-- READ-ONLY structural classification of array option label patterns per Part (Zero text/answers exposed)
select
  'PREFLIGHT_07_ARRAY_LABEL_CONSISTENCY' as check_section,
  part_text,
  array_length,
  canonical_label_order,
  count(*) as question_count
from (
  select
    lower(q.part::text) as part_text,
    jsonb_array_length(to_jsonb(q.options)) as array_length,
    case
      when jsonb_array_length(to_jsonb(q.options)) = 3
           and (to_jsonb(q.options)->>0) ~* '^\s*\([A]\)'
           and (to_jsonb(q.options)->>1) ~* '^\s*\([B]\)'
           and (to_jsonb(q.options)->>2) ~* '^\s*\([C]\)'
        then 'A,B,C'
      when jsonb_array_length(to_jsonb(q.options)) = 4
           and (to_jsonb(q.options)->>0) ~* '^\s*\([A]\)'
           and (to_jsonb(q.options)->>1) ~* '^\s*\([B]\)'
           and (to_jsonb(q.options)->>2) ~* '^\s*\([C]\)'
           and (to_jsonb(q.options)->>3) ~* '^\s*\([D]\)'
        then 'A,B,C,D'
      when jsonb_array_length(to_jsonb(q.options)) = 3
           and (to_jsonb(q.options)->>0) ~* '^\s*A[\.\)]'
           and (to_jsonb(q.options)->>1) ~* '^\s*B[\.\)]'
           and (to_jsonb(q.options)->>2) ~* '^\s*C[\.\)]'
        then 'A,B,C'
      when jsonb_array_length(to_jsonb(q.options)) = 4
           and (to_jsonb(q.options)->>0) ~* '^\s*A[\.\)]'
           and (to_jsonb(q.options)->>1) ~* '^\s*B[\.\)]'
           and (to_jsonb(q.options)->>2) ~* '^\s*C[\.\)]'
           and (to_jsonb(q.options)->>3) ~* '^\s*D[\.\)]'
        then 'A,B,C,D'
      else 'UNKNOWN_LABEL_SHAPE'
    end as canonical_label_order
  from public.toeic_test_questions q
  where jsonb_typeof(to_jsonb(q.options)) = 'array'
) sub
group by part_text, array_length, canonical_label_order
order by part_text, array_length, canonical_label_order;


-- PREFLIGHT_08_NULL_MALFORMED_OPTIONS_COUNTS
-- Explicit counts per Part for null options, malformed types, empty collections, and length bounds
select
  'PREFLIGHT_08_NULL_MALFORMED_OPTIONS_COUNTS' as check_section,
  lower(part::text) as part_text,
  count(case when options is null then 1 end) as null_options_count,
  count(case when options is not null and jsonb_typeof(to_jsonb(options)) not in ('array', 'object') then 1 end) as malformed_type_count,
  count(case when jsonb_typeof(to_jsonb(options)) = 'array' and jsonb_array_length(to_jsonb(options)) = 0 then 1 end) as empty_array_count,
  count(case when jsonb_typeof(to_jsonb(options)) = 'object' and to_jsonb(options) = '{}'::jsonb then 1 end) as empty_object_count,
  count(case when jsonb_typeof(to_jsonb(options)) = 'array' and (jsonb_array_length(to_jsonb(options)) < 1 or jsonb_array_length(to_jsonb(options)) > 4) then 1 end) as length_out_of_bounds_count
from public.toeic_test_questions
group by lower(part::text)
order by part_text;


-- PREFLIGHT_09_STRUCTURAL_INTEGRITY
-- READ-ONLY checks for NULL identifiers, QNUM bounds, and duplicate (test_id, question_number) keys
select
  'PREFLIGHT_09_STRUCTURAL_NULLS_AND_BOUNDS' as check_section,
  count(case when test_id is null then 1 end) as null_test_id_count,
  count(case when question_number is null then 1 end) as null_question_number_count,
  count(case when part is null then 1 end) as null_part_count,
  count(case when question_number < 1 or question_number > 200 then 1 end) as qnum_out_of_range_count
from public.toeic_test_questions;

select
  'PREFLIGHT_09_DUPLICATE_KEYS' as check_section,
  test_id,
  question_number,
  count(*) as duplicate_count
from public.toeic_test_questions
group by test_id, question_number
having count(*) > 1;


-- PREFLIGHT_10_PRIVILEGES_AUDIT
-- READ-ONLY inspection using information_schema.table_privileges (Exposes PUBLIC grants correctly)
select
  'PREFLIGHT_10_PRIVILEGES_AUDIT' as check_section,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('toeic_tests', 'toeic_test_questions', 'toeic_test_groups')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;


-- PREFLIGHT_11_FINAL_SUMMARY
-- READ-ONLY aggregate summary counts for pre-migration decision support
select
  'PREFLIGHT_11_FINAL_SUMMARY' as check_section,
  (
    select count(*)
    from (
      select 'toeic_tests' as target_table, 'id' as required_column
      union all select 'toeic_tests', 'status'
      union all select 'toeic_tests', 'is_published'
      union all select 'toeic_test_questions', 'id'
      union all select 'toeic_test_questions', 'test_id'
      union all select 'toeic_test_questions', 'question_number'
      union all select 'toeic_test_questions', 'part'
      union all select 'toeic_test_questions', 'group_id'
      union all select 'toeic_test_questions', 'question_text'
      union all select 'toeic_test_questions', 'options'
      union all select 'toeic_test_questions', 'correct_answer'
      union all select 'toeic_test_questions', 'explanation'
      union all select 'toeic_test_questions', 'transcript'
      union all select 'toeic_test_questions', 'audio_url'
      union all select 'toeic_test_questions', 'image_url'
      union all select 'toeic_test_questions', 'is_active'
      union all select 'toeic_test_groups', 'id'
      union all select 'toeic_test_groups', 'title'
      union all select 'toeic_test_groups', 'passage'
      union all select 'toeic_test_groups', 'transcript'
      union all select 'toeic_test_groups', 'documents'
      union all select 'toeic_test_groups', 'audio_url'
      union all select 'toeic_test_groups', 'image_url'
    ) req
    left join information_schema.columns cols
      on cols.table_schema = 'public' and cols.table_name = req.target_table and cols.column_name = req.required_column
    where cols.column_name is null
  ) as missing_required_columns,

  (
    select count(*)
    from information_schema.tables
    where table_schema = 'public' and table_name in ('toeic_learning_items', 'toeic_question_learning_items', 'toeic_learning_practice_events')
  ) as unexpected_v2_objects_already_existing,

  (
    select count(*)
    from (
      select test_id, question_number
      from public.toeic_test_questions
      group by test_id, question_number
      having count(*) > 1
    ) dup
  ) as duplicate_question_keys,

  (
    select count(*)
    from public.toeic_test_questions
    where options is null
       or jsonb_typeof(to_jsonb(options)) not in ('array', 'object')
       or (jsonb_typeof(to_jsonb(options)) = 'array' and jsonb_array_length(to_jsonb(options)) = 0)
       or (jsonb_typeof(to_jsonb(options)) = 'object' and to_jsonb(options) = '{}'::jsonb)
       or (jsonb_typeof(to_jsonb(options)) = 'array' and (jsonb_array_length(to_jsonb(options)) < 1 or jsonb_array_length(to_jsonb(options)) > 4))
  ) as malformed_options,

  (
    select count(*)
    from public.toeic_test_questions
    where lower(part::text) not in ('p1','p2','p3','p4','p5','p6','p7','part1','part2','part3','part4','part5','part6','part7','1','2','3','4','5','6','7')
  ) as unsupported_part_shapes;
