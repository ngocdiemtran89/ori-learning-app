import { describe, it, expect } from 'vitest';
import { parseQuestionBlock } from './questionParser';
import { parseAnswerKey } from './answerKeyParser';
import { parseRawToeicTest } from './classifyToeicTest';

describe('Phase 3.5D — TOEIC Classifier Tests', () => {
  it('CASE: Question Numbers parsing', () => {
    expect(parseQuestionBlock('1. What is this?\n(A) A\n(B) B\n(C) C\n(D) D')?.questionNumber).toBe(1);
    expect(parseQuestionBlock('Question 31 What?\n(A) A\n(B) B\n(C) C')?.questionNumber).toBe(31);
    expect(parseQuestionBlock('32) Hello\n(A) A\n(B) B\n(C) C\n(D) D')?.questionNumber).toBe(32);
    expect(parseQuestionBlock('Q71 Talk\n(A) A\n(B) B\n(C) C\n(D) D')?.questionNumber).toBe(71);
    expect(parseQuestionBlock('101. Fill\n(A) A\n(B) B\n(C) C\n(D) D')?.questionNumber).toBe(101);
    expect(parseQuestionBlock('146) Text\n(A) A\n(B) B\n(C) C\n(D) D')?.questionNumber).toBe(146);
    expect(parseQuestionBlock('147. Passage\n(A) A\n(B) B\n(C) C\n(D) D')?.questionNumber).toBe(147);
    expect(parseQuestionBlock('200. End\n(A) A\n(B) B\n(C) C\n(D) D')?.questionNumber).toBe(200);
    
    // Invalid 0 and 201
    expect(parseQuestionBlock('0. Invalid\n(A) A\n(B) B\n(C) C\n(D) D')).toBeNull();
    expect(parseQuestionBlock('201. Invalid\n(A) A\n(B) B\n(C) C\n(D) D')).toBeNull();

    // False positive protection
    expect(parseQuestionBlock('15 people attended the meeting.')).toBeNull();
    expect(parseQuestionBlock('Question 15 people attended.')).toBeTruthy(); // "Question 15" works
  });

  it('CASE: Options parsing', () => {
    const q = parseQuestionBlock('10. Question text here\n(A) Option A\nB. Option B\nC) Option C\n[D] Option D');
    expect(q?.options).toEqual([
      '(A) Option A',
      '(B) Option B',
      '(C) Option C',
      '(D) Option D'
    ]);
  });

  it('CASE: Answer Key parsing', () => {
    const text = `
      1 A
      2.C
      3-D
      101 B
      201 E
    `;
    const keys = parseAnswerKey(text);
    expect(keys[1]).toBe('A');
    expect(keys[2]).toBe('C');
    expect(keys[3]).toBe('D');
    expect(keys[101]).toBe('B');
    expect(keys[201]).toBeUndefined(); // Out of bounds
  });

  it('CASE: Heading conflict detection', () => {
    const text = `
      PART 6
      147. What?
      (A) A
      (B) B
      (C) C
      (D) D
    `;
    const draft = parseRawToeicTest(text, { title: 'Test', slug: 't', test_code: '', description: '', test_type: 'full' });
    
    // It should classify as part7 because 147 belongs to part7.
    expect(draft.questions[0].part).toBe('part7');
    
    // Should flag a heading conflict review issue
    const conflictIssue = draft.issues.find(i => i.message.includes('Heading và số câu không khớp'));
    expect(conflictIssue).toBeDefined();
  });

  it('CASE: Grouping logic', () => {
    // We mock a test with 32-34 and 131-134
    const text = `
      32. A
      (A) A
      (B) B
      (C) C
      (D) D

      33. B
      (A) A
      (B) B
      (C) C
      (D) D

      34. C
      (A) A
      (B) B
      (C) C
      (D) D

      131. A
      (A) A
      (B) B
      (C) C
      (D) D

      132. B
      (A) A
      (B) B
      (C) C
      (D) D

      133. C
      (A) A
      (B) B
      (C) C
      (D) D

      134. D
      (A) A
      (B) B
      (C) C
      (D) D
    `;
    const draft = parseRawToeicTest(text, { title: 'Test', slug: 't', test_code: '', description: '', test_type: 'full' });
    
    // 32-34 should be grouped together
    const q32 = draft.questions.find(q => q.question_number === 32);
    const q33 = draft.questions.find(q => q.question_number === 33);
    const q34 = draft.questions.find(q => q.question_number === 34);
    
    expect(q32?.group_temp_key).toBeTruthy();
    expect(q32?.group_temp_key).toBe(q33?.group_temp_key);
    expect(q33?.group_temp_key).toBe(q34?.group_temp_key);
    
    // 131-134 should be grouped together
    const q131 = draft.questions.find(q => q.question_number === 131);
    const q132 = draft.questions.find(q => q.question_number === 132);
    expect(q131?.group_temp_key).toBeTruthy();
    expect(q131?.group_temp_key).toBe(q132?.group_temp_key);
  });
});
