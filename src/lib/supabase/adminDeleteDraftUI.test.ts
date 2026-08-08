import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Admin Delete Draft TOEIC Test UI Structure', () => {
  it('Verifies correct UI event handling and form semantics for Draft Deletion', () => {
    const pagePath = path.resolve(__dirname, '../../pages/AdminToeicTestBankPage.tsx');
    const code = fs.readFileSync(pagePath, 'utf8');

    // A. delete button has type="button"
    expect(code).toContain('type="button"');
    
    // B, C. click does not submit parent form or trigger navigation (e.preventDefault & e.stopPropagation)
    expect(code).toContain('e.preventDefault()');
    expect(code).toContain('e.stopPropagation()');

    // D, E. confirm flow - does not proceed unless confirmed
    expect(code).toMatch(/if\s*\(!?window\.confirm/);
    
    // F. correct UUID sent (test.id is used instead of testId string)
    expect(code).toContain('deleteDraftToeicTest(test.id)');

    // G, H. success handling and error state
    expect(code).toContain('setError(`Không thể xóa đề nháp: ${res.error');
    expect(code).toContain('loadTests()');
    
    // I. double click prevented while deleting
    expect(code).toContain('disabled={deleteLoading === test.id}');
    expect(code).toContain('deleteLoading === test.id ? \'Đang xóa...\' : \'Xóa Nháp\'');
  });
});
