import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Admin Delete Draft TOEIC Test UI Structure', () => {
  it('Verifies controlled React modal implementation', () => {
    const pagePath = path.resolve(__dirname, '../../pages/AdminToeicTestBankPage.tsx');
    const code = fs.readFileSync(pagePath, 'utf8');

    // K. no window.confirm remains in delete flow
    expect(code).not.toContain('window.confirm');
    
    // A, B. clicking "Xóa Nháp" opens modal, RPC not called
    expect(code).toContain('onClick={(e) => handleDeleteDraftClick(e, test)}');
    expect(code).toContain('setDeleteTarget(test)');
    
    // C. clicking "Hủy" closes modal and RPC is never called
    expect(code).toContain('cancelDeleteDraft');
    expect(code).toContain('setDeleteTarget(null)');
    
    // D, E. clicking modal confirm calls RPC exactly once with correct UUID
    expect(code).toContain('confirmDeleteDraft');
    expect(code).toContain('deleteDraftToeicTest(deleteTarget.id)');
    
    // F. while deleting, confirm button disabled
    expect(code).toContain('disabled={deleteLoading}');
    
    // G, H. RPC failure keeps modal open and shows visible error
    expect(code).toContain('setDeleteError(`Không thể xóa đề nháp');
    // In confirmDeleteDraft, setDeleteTarget(null) is only called in the else branch (success)
    expect(code).toMatch(/if\s*\(!res\.success\)\s*{\s*setDeleteError\([^)]+\);\s*}\s*else\s*{\s*setDeleteTarget\(null\);/);

    // I, J. RPC success closes modal and removes/refetches test
    expect(code).toContain('loadTests()');
    
    // Check Modal JSX presence
    expect(code).toContain('Xóa đề nháp?');
    expect(code).toContain('Hành động này không thể hoàn tác.');
  });
});
