import { describe, it, expect } from 'vitest';
import { parseRawToeicTest } from './classifyToeicTest';
import { validateParsedDraftForImport } from './classifierValidation';
import { buildToeicTestRpcPayload } from '../../supabase/adminToeicClassifier';
import { parseAnswerKey } from './answerKeyParser';

describe('Phase 3.5D - Canonical Answer Validation', () => {
  it('CASE 1: Full 200 Fixture Regression with Answer Key', () => {
    let rawText = '';
    // Generate 200 questions
    for (let i = 1; i <= 6; i++) {
      rawText += `${i}. Photo\n(A) A\n(B) B\n(C) C\n(D) D\n\n`;
    }
    for (let i = 7; i <= 31; i++) {
      rawText += `${i}. Question\n(A) A\n(B) B\n(C) C\n\n`;
    }
    for (let i = 32; i <= 200; i++) {
      rawText += `${i}. Question\n(A) A\n(B) B\n(C) C\n(D) D\n\n`;
    }

    let answerKeyText = 'Answer Key:\n';
    for (let i = 1; i <= 200; i++) {
      answerKeyText += `${i} A\n`;
    }

    const draft = parseRawToeicTest(rawText, {
      title: 'Test',
      slug: 'test',
      test_code: 'TEST',
      description: 'Test',
      test_type: 'full'
    }, answerKeyText);

    const validation = validateParsedDraftForImport(draft);
    expect(validation.isValid).toBe(true);

    const payload = buildToeicTestRpcPayload(draft);
    expect(payload.questionsPayload.length).toBe(200);

    for (const q of payload.questionsPayload) {
      expect(q.correct_answer).toBe('A');
      const expectedCount = (q.question_number >= 7 && q.question_number <= 31) ? 3 : 4;
      expect(q.options.length).toBe(expectedCount);
      expect(q.options.every(o => typeof o === 'string' && o.length > 0)).toBe(true);
    }
  });

  it('CASE 2: Mixed Answer-Key Test', () => {
    let rawText = `
1. Q1\n(A) Opt\n(B) Opt\n(C) Opt\n(D) Opt
2. Q2\n(A) Opt\n(B) Opt\n(C) Opt\n(D) Opt
3. Q3\n(A) Opt\n(B) Opt\n(C) Opt\n(D) Opt
4. Q4\n(A) Opt\n(B) Opt\n(C) Opt\n(D) Opt
`;

    let answerKeyText = `
Answer Key:
1 A
2 B
3 C
4 D
`;

    const draft = parseRawToeicTest(rawText, {
      title: 'Test',
      slug: 'test',
      test_code: 'TEST',
      description: 'Test',
      test_type: 'full'
    }, answerKeyText);

    expect(draft.questions[0].correct_answer).toBe('A');
    expect(draft.questions[1].correct_answer).toBe('B');
    expect(draft.questions[2].correct_answer).toBe('C');
    expect(draft.questions[3].correct_answer).toBe('D');
  });

  it('CASE 3: Format Normalization Tests (Valid)', () => {
    const text = `1 A\n2 (B)\n3 C.\n4 d`;
    const keys = parseAnswerKey(text);
    expect(keys[1]).toBe('A');
    expect(keys[2]).toBe('B');
    expect(keys[3]).toBe('C');
    expect(keys[4]).toBe('D');
  });

  it('CASE 4: Format Normalization Tests (Invalid)', () => {
    let rawText = `
1. Q1\n(A) Opt\n(B) Opt\n(C) Opt\n(D) Opt
2. Q2\n(A) Opt\n(B) Opt\n(C) Opt\n(D) Opt
3. Q3\n(A) Opt\n(B) Opt\n(C) Opt\n(D) Opt
4. Q4\n(A) Opt\n(B) Opt\n(C) Opt\n(D) Opt
`;

    let answerKeyText = `
Answer Key:
1 E
2 AB
3 option A
4 empty
`;
    const draft = parseRawToeicTest(rawText, {
      title: 'Test',
      slug: 'test',
      test_code: 'TEST',
      description: 'Test',
      test_type: 'full'
    }, answerKeyText);

    const validation = validateParsedDraftForImport(draft);
    expect(validation.isValid).toBe(false);
  });
});
