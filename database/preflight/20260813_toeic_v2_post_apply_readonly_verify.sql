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
  tbl.table_name as existing_table,
  case when tbl.table_name is not null then 'PASS: Table exists' else 'FAIL: Table missing' end as result
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


-- VERIFY_02_COLUMNS_AND_APPROVAL_DEFAULTS
-- Verify NOT NULL and DEFAULT FALSE constraints on critical V2 approval columns
select
  'VERIFY_02_COLUMNS_AND_APPROVAL_DEFAULTS' as verify_section,
  cols.table_name,
  cols.column_name,
  cols.is_nullable,
  cols.column_default as raw_column_default,
  case
    when cols.column_name in ('question_id', 'item_id') and cols.is_nullable = 'NO' then 'PASS: NOT NULL'
    when cols.column_name = 'is_approved' and cols.is_nullable = 'NO' and (cols.column_default like '%false%' or cols.column_default = 'false') then 'PASS: NOT NULL DEFAULT FALSE'
    else 'FAIL: Constraint violation'
  end as status
from information_schema.columns cols
where cols.table_schema = 'public'
  and (
    (cols.table_name = 'toeic_question_learning_items' and cols.column_name in ('question_id', 'item_id', 'is_approved')) or
    (cols.table_name = 'toeic_learning_items' and cols.column_name = 'is_approved')
  )
order by cols.table_name, cols.column_name;


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


-- VERIFY_04_POLICY_EXPECTATION_SUMMARY
-- Compact expectation summary verifying presence of required RLS policies and absence of student direct write policies
select
  'VERIFY_04_POLICY_EXPECTATION_SUMMARY' as verify_section,
  req.tablename,
  req.expected_policy,
  req.expected_cmd,
  pol.policyname as actual_policy_name,
  case when pol.policyname is not null then 'PASS: Policy found' else 'FAIL: Policy missing' end as status
from (
  select 'toeic_learning_items' as tablename, 'learning_items_select' as expected_policy, 'SELECT' as expected_cmd
  union all select 'toeic_learning_items', 'admin_learning_items_all', 'ALL'
  union all select 'toeic_question_learning_items', 'question_learning_select', 'SELECT'
  union all select 'toeic_question_learning_items', 'admin_question_learning_all', 'ALL'
  union all select 'toeic_learning_practice_events', 'user_practice_events_select', 'SELECT'
) req
left join pg_policies pol on pol.schemaname = 'public' and pol.tablename = req.tablename and pol.policyname = req.expected_policy;

select
  'VERIFY_04_PRACTICE_NO_DIRECT_WRITE_POLICIES' as verify_section,
  pol.policyname,
  pol.cmd,
  pol.roles,
  case when pol.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL') and (pol.roles @> array['authenticated'::name] or pol.roles @> array['public'::name]) then 'FAIL: Unsafe direct write policy found!' else 'PASS: Safe' end as status
from pg_policies pol
where pol.schemaname = 'public' and pol.tablename = 'toeic_learning_practice_events' and pol.cmd in ('INSERT', 'UPDATE', 'DELETE');


-- VERIFY_05_AUTHORITATIVE_TABLE_PRIVILEGES_MATRIX
-- Authoritative cross-join matrix for 3 V2 tables x 4 roles x 7 privileges using PostgreSQL has_table_privilege
select
  'VERIFY_05_AUTHORITATIVE_TABLE_PRIVILEGES_MATRIX' as verify_section,
  tbl.target_table,
  r.role_name,
  p.priv_type,
  has_table_privilege(r.role_name, 'public.' || tbl.target_table, p.priv_type) as has_privilege,
  case
    when tbl.target_table = 'toeic_learning_practice_events' and r.role_name = 'authenticated' and p.priv_type = 'SELECT' then
      case when has_table_privilege(r.role_name, 'public.' || tbl.target_table, p.priv_type) then 'PASS: Practice History Read' else 'FAIL: Missing read' end
    when tbl.target_table = 'toeic_learning_practice_events' and r.role_name = 'authenticated' and p.priv_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER') then
      case when not has_table_privilege(r.role_name, 'public.' || tbl.target_table, p.priv_type) then 'PASS: Student Direct Write Revoked' else 'FAIL: Direct Student Write Granted!' end
    when r.role_name in ('PUBLIC', 'anon') then
      case when not has_table_privilege(r.role_name, 'public.' || tbl.target_table, p.priv_type) then 'PASS: Unauthenticated Access Revoked' else 'FAIL: Unauthenticated Privilege Present!' end
    else 'INFO'
  end as audit_result
from (
  select 'toeic_learning_items' as target_table
  union all select 'toeic_question_learning_items'
  union all select 'toeic_learning_practice_events'
) tbl
cross join (
  select 'PUBLIC' as role_name
  union all select 'anon'
  union all select 'authenticated'
  union all select 'service_role'
) r
cross join (
  select 'SELECT' as priv_type
  union all select 'INSERT'
  union all select 'UPDATE'
  union all select 'DELETE'
  union all select 'TRUNCATE'
  union all select 'REFERENCES'
  union all select 'TRIGGER'
) p
order by tbl.target_table, r.role_name, p.priv_type;


-- VERIFY_06_RPCS_SIGNATURE_OWNER_AND_SECURITY
-- Verify exact identity arguments, public schema membership, owner, prosecdef, and EMPTY search_path configuration
select
  'VERIFY_06_RPCS_SIGNATURE_OWNER_AND_SECURITY' as verify_section,
  req.target_rpc,
  req.expected_arguments,
  pg_get_function_identity_arguments(fn.oid) as actual_arguments,
  case when pg_get_function_identity_arguments(fn.oid) = req.expected_arguments then 'PASS: Signature matches' else 'FAIL: Signature mismatch' end as signature_match,
  pg_get_userbyid(fn.proowner) as function_owner,
  case when fn.prosecdef then 'PASS: SECURITY DEFINER' else 'FAIL: NOT SECURITY DEFINER' end as security_mode,
  array_to_string(fn.proconfig, ',') as raw_proconfig,
  case
    when array_to_string(fn.proconfig, ',') ~ 'search_path=(|""|'''')($|,)'
         and array_to_string(fn.proconfig, ',') !~ 'search_path=[a-zA-Z0-9_]'
      then 'EMPTY'
    when array_to_string(fn.proconfig, ',') like '%search_path=%' then 'NON_EMPTY'
    else 'MISSING'
  end as search_path_config_value,
  case
    when array_to_string(fn.proconfig, ',') ~ 'search_path=(|""|'''')($|,)'
         and array_to_string(fn.proconfig, ',') !~ 'search_path=[a-zA-Z0-9_]'
      then 'PASS: Empty search_path set'
    else 'FAIL: search_path not empty'
  end as empty_search_path_pass
from (
  select 'admin_import_v2_question_learning_links' as target_rpc, 'links_payload jsonb' as expected_arguments
  union all select 'student_get_safe_v2_practice_questions', 'p_kind text, p_item_key text'
  union all select 'student_check_v2_practice_answer', 'p_question_id uuid, p_item_key text, p_selected_option text'
) req
left join (
  select p.*
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
) fn on fn.proname = req.target_rpc;


-- VERIFY_07_AUTHORITATIVE_RPC_EXECUTE_MATRIX
-- Authoritative cross-join matrix for 3 RPC signatures x 3 roles using PostgreSQL has_function_privilege
select
  'VERIFY_07_AUTHORITATIVE_RPC_EXECUTE_MATRIX' as verify_section,
  rpc.rpc_signature,
  r.role_name,
  has_function_privilege(r.role_name, 'public.' || rpc.rpc_signature, 'EXECUTE') as has_execute,
  case when r.role_name = 'authenticated' then true else false end as expected_execute,
  case
    when has_function_privilege(r.role_name, 'public.' || rpc.rpc_signature, 'EXECUTE') = (case when r.role_name = 'authenticated' then true else false end)
      then 'PASS'
    else 'FAIL: EXECUTE privilege mismatch'
  end as audit_result
from (
  select 'admin_import_v2_question_learning_links(jsonb)' as rpc_signature
  union all select 'student_get_safe_v2_practice_questions(text,text)'
  union all select 'student_check_v2_practice_answer(uuid,text,text)'
) rpc
cross join (
  select 'PUBLIC' as role_name
  union all select 'anon'
  union all select 'authenticated'
) r
order by rpc.rpc_signature, r.role_name;
