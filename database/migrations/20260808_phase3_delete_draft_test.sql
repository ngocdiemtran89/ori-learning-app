-- Phase 3.5D: Safe Delete for Draft TOEIC Tests

create or replace function public.admin_delete_draft_toeic_test(p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_test record;
begin
  -- 1. Security Check
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Permission denied');
  end if;

  -- 2. Verify target exists and is draft
  select id, status, is_published into v_test
  from public.toeic_tests
  where id = p_test_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Test not found');
  end if;

  if v_test.status is distinct from 'draft'
     or v_test.is_published is distinct from false then
    return jsonb_build_object(
      'success', false,
      'error', 'Cannot delete published or non-draft tests'
    );
  end if;

  -- FUTURE HOOK: Verify no attempt history exists before deletion if/when student attempts are recorded

  -- 3. Atomic deletion
  delete from public.toeic_test_questions where test_id = p_test_id;
  delete from public.toeic_test_groups where test_id = p_test_id;
  delete from public.toeic_tests where id = p_test_id;

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.admin_delete_draft_toeic_test(uuid) from public;
revoke execute on function public.admin_delete_draft_toeic_test(uuid) from anon;
grant execute on function public.admin_delete_draft_toeic_test(uuid) to authenticated;
