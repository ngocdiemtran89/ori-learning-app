import { describe, it, expect } from 'vitest';
import { parseRawToeicTest } from './classifyToeicTest';
import { validateParsedDraftForImport } from './classifierValidation';
import { buildToeicTestRpcPayload } from '../../supabase/adminToeicClassifier';

describe('Phase 3.5D - Full 200-Question Validation', () => {
  it('Validates a perfect 200 question fixture', () => {
    let rawText = '';
    // Generate 200 questions
    for (let i = 1; i <= 6; i++) {
      rawText += `${i}. Photo\n(A) A\n(B) B\n(C) C\n(D) D\n\n`;
    }
    for (let i = 7; i <= 31; i++) {
      rawText += `${i}. Question\n(A) A\n(B) B\n(C) C\n\n`;
    }
    for (let i = 32; i <= 149; i++) {
      rawText += `${i}. Question\n(A) A\n(B) B\n(C) C\n(D) D\n\n`;
    }
    rawText += `150. Question (A) A (B) B (C) C (D) D\n\n`; // Inline options
    for (let i = 151; i <= 200; i++) {
      rawText += `${i}. Question\n(A) A\n(B) B\n(C) C\n(D) D\n\n`;
    }

    const draft = parseRawToeicTest(rawText, {
      title: 'Test',
      slug: 'test',
      test_code: 'TEST',
      description: 'Test',
      test_type: 'full'
    });

    // Mock correct_answer
    draft.questions.forEach(q => q.correct_answer = 'A');

    const validation = validateParsedDraftForImport(draft);
    expect(validation.isValid).toBe(true);
    expect(draft.questions.length).toBe(200);

    const payload = buildToeicTestRpcPayload(draft);
    expect(payload.questionsPayload.length).toBe(200);

    const questionNumbers = new Set<number>();

    payload.questionsPayload.forEach(q => {
      // unique question_number
      expect(questionNumbers.has(q.question_number)).toBe(false);
      questionNumbers.add(q.question_number);

      // valid correct_answer
      expect(q.correct_answer).toBe('A');

      // correct option count
      const expectedCount = (q.question_number >= 7 && q.question_number <= 31) ? 3 : 4;
      expect(q.options.length).toBe(expectedCount);

      // every option non-empty
      expect(q.options.every(o => typeof o === 'string' && o.length > 0)).toBe(true);
    });

    const q150 = payload.questionsPayload.find(q => q.question_number === 150);
    expect(q150).toBeDefined();
    
    const q151 = payload.questionsPayload.find(q => q.question_number === 151);
    expect(q151).toBeDefined();

    const q152 = payload.questionsPayload.find(q => q.question_number === 152);
    expect(q152).toBeDefined();
  });
});
