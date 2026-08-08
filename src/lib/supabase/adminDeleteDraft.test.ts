import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { deleteDraftToeicTest } from './adminTestBank';
import { supabase } from './client';

vi.mock('./client', () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

describe('Admin Delete Draft TOEIC Test Frontend API', () => {
  it('correct UUID sent as p_test_id', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: { success: true }, error: null });
    await deleteDraftToeicTest('123e4567-e89b-12d3-a456-426614174000');
    expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_draft_toeic_test', { p_test_id: '123e4567-e89b-12d3-a456-426614174000' });
  });

  it('RPC transport error shown', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: null, error: { message: 'Network error' } });
    const res = await deleteDraftToeicTest('uuid');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Network error');
  });

  it('data.success=false shown as failure', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: { success: false, error: 'Cannot delete published tests' }, error: null });
    const res = await deleteDraftToeicTest('uuid');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Cannot delete published tests');
  });
  
  it('data.success=true returns success true', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: { success: true }, error: null });
    const res = await deleteDraftToeicTest('uuid');
    expect(res.success).toBe(true);
  });
});

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
  });
});
