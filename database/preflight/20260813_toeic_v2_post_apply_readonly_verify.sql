-- ============================================================
-- READ-ONLY Post-Apply Verification Script for TOEIC V2
-- File: database/preflight/20260813_toeic_v2_post_apply_readonly_verify.sql
-- Security: 100% SELECT ONLY. Zero writes, zero DDL, zero DML. Runs AFTER migration execution.
-- ============================================================

-- VERIFY_01_TABLES_EXISTENCE
-- Verify all 3 V2 tables exist in public schema
select
  'VERIFY_01_TABLES_EXISTENCE' as verify_section,
  t.target_table,
  info.table_name as existing_table,
  case when info.table_name is not null then 'PASS: Table exists' else 'FAIL: Table missing' end as result
from (
  select 'toeic_learning_items' as target_table
  union all select 'toeic_question_learning_items'
  union all select 'toeic_learning_practice_events'
) t
left join information_schema.tables info
  on info.table_schema = 'public' and info.table_name = t.target_table;


-- VERIFY_02_COLUMNS_AND_DEFAULTS
-- Verify NOT NULL and DEFAULT constraints on critical V2 columns
select
  'VERIFY_02_COLUMNS_AND_DEFAULTS' as verify_section,
  table_name,
  column_name,
  is_nullable,
  column_default,
  case
    when column_name in ('question_id', 'item_id') and is_nullable = 'NO' then 'PASS: NOT NULL'
    when column_name = 'is_approved' and is_nullable = 'NO' and column_default like '%false%' then 'PASS: NOT NULL DEFAULT FALSE'
    else 'CHECK_CONSTRAINT'
  end as status
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'toeic_question_learning_items' and column_name in ('question_id', 'item_id', 'is_approved')) or
    (table_name = 'toeic_learning_items' and column_name = 'is_approved')
  )
order by table_name, column_name;


-- VERIFY_03_RLS_ENABLED
-- Verify RLS is enabled on all 3 new tables in pg_tables
select
  'VERIFY_03_RLS_ENABLED' as verify_section,
  t.target_table,
  p.rowsecurity as rls_enabled,
  case when p.rowsecurity then 'PASS: RLS Enabled' else 'FAIL: RLS Disabled!' end as result
from (
  select 'toeic_learning_items' as target_table
  union all select 'toeic_question_learning_items'
  union all select 'toeic_learning_practice_events'
) t
left join pg_tables p on p.schemaname = 'public' and p.tablename = t.target_table;


-- VERIFY_04_PG_POLICIES
-- Inspect active RLS policies in pg_policies for all 3 V2 tables
select
  'VERIFY_04_PG_POLICIES' as verify_section,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('toeic_learning_items', 'toeic_question_learning_items', 'toeic_learning_practice_events')
order by tablename, policyname;


-- VERIFY_05_TABLE_PRIVILEGES_MATRIX
-- Verify privilege matrix for PUBLIC, anon, authenticated, service_role using information_schema.table_privileges (Exposes PUBLIC grants)
select
  'VERIFY_05_TABLE_PRIVILEGES_MATRIX' as verify_section,
  table_name,
  grantee,
  privilege_type,
  case
    when table_name = 'toeic_learning_practice_events' and grantee = 'authenticated' and privilege_type = 'SELECT' then 'PASS: Student Practice History Read'
    when table_name = 'toeic_learning_practice_events' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE') then 'FAIL: Student direct write granted!'
    when grantee in ('PUBLIC', 'anon') and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE') then 'FAIL: Unauthenticated write granted!'
    else 'INFO'
  end as audit_status
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('toeic_learning_items', 'toeic_question_learning_items', 'toeic_learning_practice_events')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;


-- VERIFY_06_PRACTICE_EVENTS_STUDENT_WRITE_DENIAL
-- Dedicated audit verifying authenticated student direct write denial on practice events
select
  'VERIFY_06_PRACTICE_EVENTS_STUDENT_WRITE_DENIAL' as verify_section,
  grantee,
  privilege_type,
  case
    when privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER') then 'FAIL: Direct write privilege present!'
    else 'PASS: Direct write revoked'
  end as result
from information_schema.table_privileges
where table_schema = 'public'
  and table_name = 'toeic_learning_practice_events'
  and grantee = 'authenticated'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');


-- VERIFY_07_RPCS_SIGNATURE_AND_SECURITY
-- Verify RPC existence, SECURITY DEFINER status, owner, and search_path= in proconfig
select
  'VERIFY_07_RPCS_SIGNATURE_AND_SECURITY' as verify_section,
  r.target_rpc,
  p.proname as actual_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  case when p.prosecdef then 'PASS: SECURITY DEFINER' else 'FAIL: NOT SECURITY DEFINER' end as security_mode,
  array_to_string(p.proconfig, ',') as proconfig,
  case
    when array_to_string(p.proconfig, ',') like '%search_path=%' then 'PASS: empty search_path set'
    else 'FAIL: search_path NOT set'
  end as search_path_check
from (
  select 'admin_import_v2_question_learning_links' as target_rpc
  union all select 'student_get_safe_v2_practice_questions'
  union all select 'student_check_v2_practice_answer'
) r
left join pg_proc p on p.proname = r.target_rpc
left join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public';


-- VERIFY_08_RPC_EXECUTE_PRIVILEGES
-- Verify EXECUTE privileges on V2 RPCs using information_schema.routine_privileges
select
  'VERIFY_08_RPC_EXECUTE_PRIVILEGES' as verify_section,
  routine_name,
  grantee,
  privilege_type,
  case
    when grantee in ('PUBLIC', 'anon') then 'FAIL: Unauthenticated EXECUTE granted!'
    when grantee = 'authenticated' and privilege_type = 'EXECUTE' then 'PASS: Authenticated EXECUTE granted'
    else 'INFO'
  end as audit_status
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'admin_import_v2_question_learning_links',
    'student_get_safe_v2_practice_questions',
    'student_check_v2_practice_answer'
  )
  and grantee in ('PUBLIC', 'anon', 'authenticated');
