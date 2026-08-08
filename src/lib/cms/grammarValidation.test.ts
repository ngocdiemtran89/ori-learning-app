import { describe, it, expect } from 'vitest';
import * as grammarCmsModule from './grammarValidation';
import {
  ensureLegacyQuestionKeys,
  createNewQuestionKey,
  shouldRotateGrammarQuestionKey,
  validateGrammarQuestion,
  validateGrammarLessonForPublish,
  parseExamples,
  GrammarQuizQuestionInput,
} from './grammarValidation';

describe('Phase 3.2 — Grammar CMS Pure Validation & Stable Question Identity', () => {
  it('CASE 29 — Legacy question keys: Assigns stable keys grammar:{lessonId}:{index} without changing on reorder', () => {
    const lessonId = 'lesson-123';
    const legacyQuiz: GrammarQuizQuestionInput[] = [
      { question: 'Question A', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { question: 'Question B', options: ['1', '2', '3', '4'], answer: '1' },
    ];

    // CMS loads existing content
    const withKeys = ensureLegacyQuestionKeys(lessonId, legacyQuiz);
    expect(withKeys[0].question_key).toBe('grammar:lesson-123:0');
    expect(withKeys[1].question_key).toBe('grammar:lesson-123:1');

    // Admin reorders Question B to first position, Question A to second position
    const reordered = [withKeys[1], withKeys[0]];

    // Keys MUST remain unchanged after reorder!
    expect(reordered[0].question_key).toBe('grammar:lesson-123:1');
    expect(reordered[1].question_key).toBe('grammar:lesson-123:0');
  });

  it('CASE 30 — Material Edit vs Explanation Edit: Key Rotation Detector', () => {
    const original = {
      question_key: 'grammar:lesson-123:0',
      question: 'She ___ to school.',
      options: ['go', 'goes', 'going', 'gone'],
      answer: 'goes',
      explanation: 'Giải thích cũ',
    };

    // 1. Explanation change ONLY -> should NOT rotate key
    const explanationEdit = { ...original, explanation: 'Giải thích mới chi tiết hơn' };
    expect(shouldRotateGrammarQuestionKey(original, explanationEdit)).toBe(false);

    // 2. Question text change -> SHOULD rotate key
    const questionTextEdit = { ...original, question: 'He ___ to school every day.' };
    expect(shouldRotateGrammarQuestionKey(original, questionTextEdit)).toBe(true);

    // 3. Option change -> SHOULD rotate key
    const optionEdit = { ...original, options: ['go', 'goes', 'walks', 'gone'] };
    expect(shouldRotateGrammarQuestionKey(original, optionEdit)).toBe(true);

    // 4. Correct answer change -> SHOULD rotate key
    const answerEdit = { ...original, answer: 'go' };
    expect(shouldRotateGrammarQuestionKey(original, answerEdit)).toBe(true);
  });

  it('CASE 31 — Hidden Questions (is_active = false) in Publish Validation', () => {
    const q1 = {
      question_key: 'q1',
      question: 'Question 1',
      options: ['A', 'B', 'C', 'D'],
      answer: 'A',
      is_active: false, // Hidden
    };
    const q2 = {
      question_key: 'q2',
      question: 'Question 2',
      options: ['A', 'B', 'C', 'D'],
      answer: 'A',
      is_active: true, // Active
    };

    const res = validateGrammarLessonForPublish({
      title: 'Present Simple',
      slug: 'present-simple',
      level: 'foundation',
      skill_tag: 'Present Simple',
      sort_order: 1,
      sections: [{ heading: 'Theory 1', body: 'Body 1', examples: [] }],
      quiz: [q1, q2],
    });

    expect(res.canPublish).toBe(true);
    // Active count is 1 (< 5), should generate warning
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.warnings[0]).toContain('Bài có ít hơn 5 câu hỏi');
  });

  it('CASE 21 — Quiz Question Validation: Validates options count, duplicates, and answer match', () => {
    // Missing options
    const invalidOptCount = validateGrammarQuestion({
      question: 'Test?',
      options: ['A', 'B'],
      answer: 'A',
    });
    expect(invalidOptCount.isValid).toBe(false);

    // Duplicate options
    const duplicateOpts = validateGrammarQuestion({
      question: 'Test?',
      options: ['A', 'A', 'B', 'C'],
      answer: 'A',
    });
    expect(duplicateOpts.isValid).toBe(false);
    expect(duplicateOpts.errors[0]).toContain('không được trùng lặp');

    // Answer not in options
    const invalidAnswer = validateGrammarQuestion({
      question: 'Test?',
      options: ['A', 'B', 'C', 'D'],
      answer: 'E',
    });
    expect(invalidAnswer.isValid).toBe(false);

    // Valid question
    const validQ = validateGrammarQuestion({
      question: 'Test?',
      options: ['A', 'B', 'C', 'D'],
      answer: 'A',
    });
    expect(validQ.isValid).toBe(true);
  });

  it('CASE 10 — Examples line parsing', () => {
    const parsed = parseExamples('The office opens at 8 a.m.\n\nShe works in customer service.  \n');
    expect(parsed).toEqual(['The office opens at 8 a.m.', 'She works in customer service.']);
  });

  it('CASE 4 — New question key generator', () => {
    const key1 = createNewQuestionKey();
    const key2 = createNewQuestionKey();
    expect(key1).toMatch(/^grammar:/);
    expect(key1).not.toBe(key2);
  });

  it('NO HARD DELETE CONFIRMATION: Verify Grammar validation module exposes NO delete mutations', () => {
    expect((grammarCmsModule as any).deleteGrammarLesson).toBeUndefined();
  });
});
