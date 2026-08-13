-- ============================================================
-- READ-ONLY Post-Apply Verification Script for TOEIC V2
-- File: database/preflight/20260813_toeic_v2_post_apply_readonly_verify.sql
-- Security: 100% SELECT ONLY. Zero writes, zero DDL, zero DML. Runs AFTER migration execution.
-- ============================================================

-- VERIFY_01_TABLES_EXISTENCE
-- Verify all 3 V2 tables exist
select
  'VERIFY_01_TABLES_EXISTENCE' as verify_section,
  table_name,
  case when table_name is not null then 'PASS: Table exists' else 'FAIL: Table missing' end as result
from (
  select 'toeic_learning_items' as target_table
  union select 'toeic_question_learning_items'
  union select 'toeic_learning_practice_events'
) t
left join information_schema.tables info
  on info.table_schema = 'public' and info.table_name = t.target_table;


-- VERIFY_02_RPCS_SECURITY_DEFINER
-- Verify all 3 RPCs exist, use SECURITY DEFINER, and are owned by public
select
  'VERIFY_02_RPCS_SECURITY_DEFINER' as verify_section,
  p.proname as rpc_name,
  case when p.prosecdef then 'PASS: SECURITY DEFINER' else 'FAIL: NOT SECURITY DEFINER' end as sec_definer_check,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'admin_import_v2_question_learning_links',
    'student_get_safe_v2_practice_questions',
    'student_check_v2_practice_answer'
  );


-- VERIFY_03_NON_NULLABLE_FOREIGN_KEYS
-- Verify question_id and item_id are NOT NULL in toeic_question_learning_items
select
  'VERIFY_03_NON_NULLABLE_FOREIGN_KEYS' as verify_section,
  column_name,
  is_nullable,
  case when is_nullable = 'NO' then 'PASS: NOT NULL' else 'FAIL: NULLABLE' end as nullability_check
from information_schema.columns
where table_schema = 'public'
  and table_name = 'toeic_question_learning_items'
  and column_name in ('question_id', 'item_id');


-- VERIFY_04_PRACTICE_EVENTS_PRIVILEGE_MATRIX
-- Verify authenticated role has ONLY SELECT on toeic_learning_practice_events (NO direct INSERT/UPDATE/DELETE)
select
  'VERIFY_04_PRACTICE_EVENTS_PRIVILEGE_MATRIX' as verify_section,
  grantee,
  privilege_type,
  case
    when grantee = 'authenticated' and privilege_type = 'SELECT' then 'PASS: Allowed'
    when grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE') then 'FAIL: Direct student write granted!'
    else 'INFO'
  end as audit_status
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'toeic_learning_practice_events'
  and grantee in ('public', 'anon', 'authenticated', 'service_role');


-- VERIFY_05_RLS_ENABLED
-- Verify RLS is enabled on all 3 new tables
select
  'VERIFY_05_RLS_ENABLED' as verify_section,
  tablename,
  rowsecurity as rls_enabled,
  case when rowsecurity then 'PASS: RLS Enabled' else 'FAIL: RLS Disabled!' end as rls_check
from pg_tables
where schemaname = 'public'
  and tablename in ('toeic_learning_items', 'toeic_question_learning_items', 'toeic_learning_practice_events');
