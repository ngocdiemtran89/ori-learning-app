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

  it('CASE: classify headings and ignore instructions', () => {
    const rawTest = `
PART 2

7. Question 7
(A) A
(B) B
(C) C

PART 5

101. Question 101
(A) A
(B) B
(C) C
(D) D

PART 7

Questions 147-149 refer to the following email.

147. Question 147
(A) A
(B) B
(C) C
(D) D
    `;
    const draft = parseRawToeicTest(rawTest, { title: 'Test', slug: 't', test_code: 't', description: '', test_type: 'full' });
    
    expect(draft.questions.length).toBe(3);
    
    // Check headings
    const q7 = draft.questions.find(q => q.question_number === 7);
    const q101 = draft.questions.find(q => q.question_number === 101);
    const q147 = draft.questions.find(q => q.question_number === 147);
    
    expect(q7?.part).toBe('part2');
    expect(q101?.part).toBe('part5');
    expect(q147?.part).toBe('part7');

    // Make sure no heading conflicts are generated for these
    expect(draft.issues.some(i => i.question_number === 7 && i.message.includes('Heading'))).toBe(false);
    expect(draft.issues.some(i => i.question_number === 101 && i.message.includes('Heading'))).toBe(false);
    expect(draft.issues.some(i => i.question_number === 147 && i.message.includes('Heading'))).toBe(false);
  });

  it('CASE: parse explicit Part 7 range with passage', () => {
    const rawTest = `
PART 7

Questions 147-149 refer to the following email.

To: All Employees
From: Human Resources
Subject: Training Session

A customer-service training session will be held next Monday at 9:00 A.M.
in Conference Room B. Employees should arrive ten minutes early and bring
their employee identification cards.

147. When will the training session take place?
(A) This Friday
(B) Next Monday
(C) Next Tuesday
(D) Next month

148. Where will the session be held?
(A) Conference Room A
(B) Conference Room B
(C) The cafeteria
(D) The main lobby

149. What should employees bring?
(A) A laptop
(B) A printed schedule
(C) An identification card
(D) A training manual
    `;

    const draft = parseRawToeicTest(rawTest, { title: 'Test', slug: 't', test_code: 't', description: '', test_type: 'full' });
    
    expect(draft.questions.length).toBe(3);
    expect(draft.groups.length).toBe(1);
    
    const group = draft.groups[0];
    expect(group.group_type).toBe('reading_set');
    expect(group.title).toBe('Questions 147-149');
    expect(group.instruction).toBe('Questions 147-149 refer to the following email.');
    expect(group.passage).toContain('To: All Employees');
    expect(group.passage).toContain('bring\ntheir employee identification cards.');
    
    expect(draft.questions[0].question_number).toBe(147);
    expect(draft.questions[1].question_number).toBe(148);
    expect(draft.questions[2].question_number).toBe(149);
    
    expect(draft.questions[0].group_temp_key).toBe(group.group_temp_key);
    expect(draft.questions[1].group_temp_key).toBe(group.group_temp_key);
    expect(draft.questions[2].group_temp_key).toBe(group.group_temp_key);
  });
});


