-- ============================================================
-- READ-ONLY Production Preflight Inspection Script for TOEIC V2
-- File: database/preflight/20260813_toeic_v2_production_readonly_preflight.sql
-- Security: 100% SELECT ONLY. Zero writes, zero DDL, zero DML. Safe to run on Production.
-- ============================================================

-- PREFLIGHT_01_V2_OBJECT_EXISTENCE
-- Verify whether V2 tables & RPCs already exist in Production
select
  'PREFLIGHT_01_V2_OBJECT_EXISTENCE' as check_section,
  table_name,
  case when table_name is not null then 'EXISTS (EXPECTED: ABSENT)' else 'ABSENT (EXPECTED)' end as status
from (
  select 'toeic_learning_items' as target_table
  union select 'toeic_question_learning_items'
  union select 'toeic_learning_practice_events'
) t
left join information_schema.tables info
  on info.table_schema = 'public' and info.table_name = t.target_table;

select
  'PREFLIGHT_01_RPC_EXISTENCE' as check_section,
  routine_name,
  case when routine_name is not null then 'EXISTS (EXPECTED: ABSENT)' else 'ABSENT (EXPECTED)' end as status
from (
  select 'admin_import_v2_question_learning_links' as target_rpc
  union select 'student_get_safe_v2_practice_questions'
  union select 'student_check_v2_practice_answer'
) r
left join information_schema.routines info
  on info.routine_schema = 'public' and info.routine_name = r.target_rpc;


-- PREFLIGHT_02_CANONICAL_COLUMNS
-- Inspect canonical table schema columns and data types in Production
select
  'PREFLIGHT_02_CANONICAL_COLUMNS' as check_section,
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('toeic_tests', 'toeic_test_questions', 'toeic_test_groups')
order by table_name, ordinal_position;


-- PREFLIGHT_03_REQUIRED_FUNCTIONS
-- Inspect existing helper function signatures and security definer status
select
  'PREFLIGHT_03_REQUIRED_FUNCTIONS' as check_section,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security_mode
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_admin', 'has_active_access', 'admin_create_toeic_test_with_content');


-- PREFLIGHT_04_PART_SHAPES
-- READ-ONLY inspection of DISTINCT part representations in toeic_test_questions
select
  'PREFLIGHT_04_PART_SHAPES' as check_section,
  part,
  count(*) as question_count
from public.toeic_test_questions
group by part
order by part;


-- PREFLIGHT_05_OPTIONS_SHAPES
-- READ-ONLY inspection of options JSON shapes and key counts per Part
select
  'PREFLIGHT_05_OPTIONS_SHAPES' as check_section,
  part,
  jsonb_typeof(options) as options_type,
  count(*) as count,
  count(case when options is null then 1 end) as null_options_count
from public.toeic_test_questions
group by part, jsonb_typeof(options)
order by part;


-- PREFLIGHT_06_DUPLICATES
-- READ-ONLY check for duplicate (test_id, question_number) in existing canonical questions
select
  'PREFLIGHT_06_DUPLICATES' as check_section,
  test_id,
  question_number,
  count(*) as duplicate_count
from public.toeic_test_questions
group by test_id, question_number
having count(*) > 1;


-- PREFLIGHT_07_PRIVILEGES
-- READ-ONLY inspection of table privileges for roles anon, authenticated, service_role
select
  'PREFLIGHT_07_PRIVILEGES' as check_section,
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('toeic_tests', 'toeic_test_questions', 'toeic_test_groups')
  and grantee in ('public', 'anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;


-- PREFLIGHT_08_FINAL_CHECKS
-- Read-only summary count of published tests and active questions
select
  'PREFLIGHT_08_FINAL_CHECKS' as check_section,
  (select count(*) from public.toeic_tests where is_published = true) as published_tests_count,
  (select count(*) from public.toeic_test_questions where is_active = true) as active_questions_count;
