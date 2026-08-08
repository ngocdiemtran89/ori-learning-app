import { describe, it, expect } from 'vitest';
import { parseRawToeicTest } from './classifyToeicTest';
import { validateParsedDraftForImport } from './classifierValidation';

describe('Phase 3.5D - Malformed Validation', () => {
  it('Validates question with no options fails closed', () => {
    const rawText = `150. Question with no options
151. Question 151
(A) A
(B) B
(C) C
(D) D
`;

    const draft = parseRawToeicTest(rawText, {
      title: 'Test',
      slug: 'test',
      test_code: 'TEST',
      description: 'Test',
      test_type: 'full'
    });

    const validation = validateParsedDraftForImport(draft);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some(e => e.includes('số lượng hoặc nội dung đáp án (options) không hợp lệ (Câu: 150)'))).toBe(true);

    const q150 = draft.questions.find(q => q.question_number === 150);
    expect(q150?.options.length).toBe(0);
  });
});
