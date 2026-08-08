import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Admin Delete Draft TOEIC Test Migration Security', () => {
  it('Verifies hardened security definer requirements in the migration file', () => {
    const migrationPath = path.resolve(__dirname, '../../../database/migrations/20260808_phase3_delete_draft_test.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql.toLowerCase()).toContain('security definer');
    expect(sql.toLowerCase()).toContain('set search_path = pg_catalog');
    expect(sql.toLowerCase()).toContain('public.is_admin()');
    expect(sql.toLowerCase()).toContain("status is distinct from 'draft'");
    expect(sql.toLowerCase()).toContain('is_published is distinct from false');
    expect(sql.toLowerCase()).toContain('for update');
    
    // Revoke and Grant rules
    expect(sql.toLowerCase()).toContain('revoke execute on function public.admin_delete_draft_toeic_test(uuid) from public');
    expect(sql.toLowerCase()).toContain('revoke execute on function public.admin_delete_draft_toeic_test(uuid) from anon');
    expect(sql.toLowerCase()).toContain('grant execute on function public.admin_delete_draft_toeic_test(uuid) to authenticated');

    // Ensure NO general RLS policy was added for DELETE on toeic_tests
    expect(sql.toLowerCase()).not.toContain('create policy');
    expect(sql.toLowerCase()).not.toContain('for delete');
  });
});
