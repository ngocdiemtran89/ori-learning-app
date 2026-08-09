import { describe, it, expect } from 'vitest';
import { parseRawToeicTest } from './classifyToeicTest';
import { buildToeicTestRpcPayload } from '../../supabase/adminToeicClassifier';

describe('Real Path Integration Test', () => {
  it('CASE 7: Real Path Integration Test', () => {
    const rawText = `
150. Why is the office closed?
(A) For repairs
(B) For training
(C) For a holiday
(D) For a meeting
`;

    const answerKeyText = `
Answer Key:
150 A
`;

    const metadata = {
      title: 'Test',
      slug: 'test',
      test_code: 'TEST',
      description: 'Test',
      test_type: 'full' as const
    };

    // Exactly what AdminToeicClassifierPage calls:
    const draft = parseRawToeicTest(rawText, metadata, answerKeyText);

    // Exactly what AdminToeicClassifierPage calls before RPC:
    const { questionsPayload } = buildToeicTestRpcPayload(draft);

    const q150 = questionsPayload.find(q => q.question_number === 150);
    expect(q150).toBeDefined();
    expect(q150?.question_number).toBe(150);
    expect(q150?.correct_answer).toBe('A');
    expect(q150?.correct_answer).not.toBe('(A) For repairs');
  });

  it('CASE 8: Full 200 Real-Path Test', () => {
    let rawText = '';
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

    const { questionsPayload } = buildToeicTestRpcPayload(draft);

    expect(questionsPayload.length).toBe(200);

    for (const q of questionsPayload) {
      expect(q.correct_answer).toBe('A');
    }

    const canonicalAnswersCount = questionsPayload.filter(q => ['A', 'B', 'C', 'D'].includes(q.correct_answer || '')).length;
    expect(canonicalAnswersCount).toBe(200);
  });
});
