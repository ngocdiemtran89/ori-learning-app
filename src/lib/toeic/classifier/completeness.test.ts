import { describe, it, expect } from 'vitest';
import { parseRawToeicTest } from './classifyToeicTest';
import { buildToeicTestRpcPayload } from '../../supabase/adminToeicClassifier';
import { getPartSummary } from '../testStructure';

describe('Phase 3.5D - Completeness & Options Regression', () => {
  it('CASE: Empty options fallback and completeness calculation', () => {
    const rawText = `
PART 7

Questions 150-152 refer to the following email.
This is the email.

150. Question 150 (A) 1 (B) 2 (C) 3 (D) 4
151. Question 151
(A) 1
(B) 2
(C) 3
(D) 4
152. Question 152 (A) 1 (B) 2 (C) 3 (D) 4
    `;

    const draft = parseRawToeicTest(rawText, {
      title: 'Test',
      slug: 'test',
      test_code: 'TEST',
      description: 'Test',
      test_type: 'full'
    });

    const payload = buildToeicTestRpcPayload(draft);

    const q150 = payload.questionsPayload.find(q => q.question_number === 150);
    const q151 = payload.questionsPayload.find(q => q.question_number === 151);
    const q152 = payload.questionsPayload.find(q => q.question_number === 152);

    // Options must not be padded! Q150 has inline, Q151 has lines, Q152 has inline.
    expect(q150?.options.length).toBe(4);
    expect(q151?.options.length).toBe(4);
    expect(q152?.options.length).toBe(4);

    expect(q152?.options[0]).toBe('(A) 1');

    // Simulate database questions
    const mockDbQuestions = payload.questionsPayload.map(q => ({
      ...q,
      is_active: true // all newly imported are active
    }));

    // Add a duplicate inactive question to test completeness logic
    mockDbQuestions.push({
      ...q151!,
      is_active: false
    });

    const summary = getPartSummary(mockDbQuestions);
    const activeCount = new Set(mockDbQuestions.filter(q => q.is_active !== false).map(q => q.question_number)).size;

    // We only have 3 active unique questions (150, 151, 152)
    expect(activeCount).toBe(3);
    
    // Part 7 expects 54 questions, we have 3.
    expect(summary.part7.count).toBe(3);
    expect(summary.part7.missing.length).toBe(51);
    expect(summary.part7.isComplete).toBe(false);
  });
});
