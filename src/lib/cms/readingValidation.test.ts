import { describe, it, expect } from 'vitest';
import * as readingCmsModule from './readingValidation';
import {
  validateReadingQuestion,
  validateReadingLessonDraft,
  validateReadingLessonForPublish,
  hasMaterialPassageChange,
  executeSafeQuestionReplacement,
  shouldRotateLearningQuestionIdentity,
} from './readingValidation';

describe('Phase 3.4 — Reading CMS Pure Validation & History Protection Tests', () => {
  it('CASE A: Part 5 no passage + 4-option valid questions -> publish valid', () => {
    const res = validateReadingLessonForPublish({
      title: 'Grammar & Vocabulary Part 5 #1',
      slug: 'part5-foundation-1',
      level: 'foundation',
      toeic_part: 'part5',
      passage: '',
      sort_order: 1,
      questions: [
        {
          question_text: 'The manager suggested _____ a new procedure.',
          options: ['implementing', 'implement', 'implementation', 'implemented'],
          correct_answer: 'implementing',
          sort_order: 0,
          is_active: true,
        },
      ],
    });
    expect(res.canPublish).toBe(true);
    expect(res.warnings).toHaveLength(1); // < 5 questions warning
  });

  it('CASE B: Part 5 with 3 options -> invalid', () => {
    const qVal = validateReadingQuestion({
      question_text: 'The meeting was postponed _____ next week.',
      options: ['until', 'for', 'during'], // 3 options
      correct_answer: 'until',
    });
    expect(qVal.isValid).toBe(false);
    expect(qVal.errors[0]).toContain('đủ 4 lựa chọn A, B, C, D');
  });

  it('CASE C: Part 6 empty passage -> publish invalid', () => {
    const res = validateReadingLessonForPublish({
      title: 'Text Completion Part 6 #1',
      slug: 'part6-intermediate-1',
      level: 'intermediate',
      toeic_part: 'part6',
      passage: '   ', // Empty passage
      sort_order: 1,
      questions: [
        {
          question_text: 'Refer to sentence [1].',
          options: ['however', 'therefore', 'moreover', 'otherwise'],
          correct_answer: 'however',
          sort_order: 0,
          is_active: true,
        },
      ],
    });
    expect(res.canPublish).toBe(false);
    expect(res.errors.passage).toContain('yêu cầu nội dung đoạn văn');
  });

  it('CASE D: Part 6 passage + valid questions -> valid', () => {
    const res = validateReadingLessonForPublish({
      title: 'Text Completion Part 6 #2',
      slug: 'part6-intermediate-2',
      level: 'intermediate',
      toeic_part: 'part6',
      passage: 'Dear Customers, Thank you for your continued support...',
      sort_order: 1,
      questions: [
        {
          question_text: 'Refer to sentence [1].',
          options: ['however', 'therefore', 'moreover', 'otherwise'],
          correct_answer: 'however',
          sort_order: 0,
          is_active: true,
        },
      ],
    });
    expect(res.canPublish).toBe(true);
  });

  it('CASE E: Part 7 empty passage -> publish invalid', () => {
    const res = validateReadingLessonForPublish({
      title: 'Reading Comprehension Part 7 #1',
      slug: 'part7-advanced-1',
      level: 'advanced',
      toeic_part: 'part7',
      passage: null, // Empty passage
      sort_order: 1,
      questions: [
        {
          question_text: 'What is the main purpose of the email?',
          options: ['To confirm an order', 'To request funding', 'To invite a guest', 'To hire staff'],
          correct_answer: 'To confirm an order',
          sort_order: 0,
          is_active: true,
        },
      ],
    });
    expect(res.canPublish).toBe(false);
    expect(res.errors.passage).toContain('yêu cầu nội dung đoạn văn');
  });

  it('CASE F: Part 7 passage + valid questions -> valid', () => {
    const res = validateReadingLessonForPublish({
      title: 'Reading Comprehension Part 7 #2',
      slug: 'part7-advanced-2',
      level: 'advanced',
      toeic_part: 'part7',
      passage: 'MEMORANDUM\nTo: All Employees\nFrom: Executive Committee...',
      sort_order: 1,
      questions: [
        {
          question_text: 'What is the main purpose of the memo?',
          options: ['To announce policy', 'To request funding', 'To invite a guest', 'To hire staff'],
          correct_answer: 'To announce policy',
          sort_order: 0,
          is_active: true,
        },
      ],
    });
    expect(res.canPublish).toBe(true);
  });

  it('CASE G: Reading Part 2 -> invalid TOEIC Part', () => {
    const res = validateReadingLessonDraft({
      title: 'Invalid Reading Part',
      slug: 'invalid-part',
      level: 'foundation',
      toeic_part: 'part2', // Listening part
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.toeic_part).toContain('Reading chỉ chấp nhận TOEIC Part 5, Part 6, hoặc Part 7');
  });

  it('CASE H: Duplicate options -> invalid', () => {
    const qVal = validateReadingQuestion({
      question_text: 'Choose correct option:',
      options: ['Option A', 'Option B', 'Option A', 'Option D'], // Duplicate Option A
      correct_answer: 'Option A',
    });
    expect(qVal.isValid).toBe(false);
    expect(qVal.errors[0]).toContain('trùng lặp');
  });

  it('CASE I: Correct answer not in options -> invalid', () => {
    const qVal = validateReadingQuestion({
      question_text: 'Choose correct option:',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_answer: 'Option E',
    });
    expect(qVal.isValid).toBe(false);
    expect(qVal.errors[0]).toContain('Đáp án đúng phải trùng khớp');
  });

  it('CASE J: Negative or decimal sort_order -> invalid', () => {
    const res = validateReadingLessonDraft({
      title: 'Test',
      slug: 'test-slug',
      level: 'foundation',
      toeic_part: 'part5',
      sort_order: -2,
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.sort_order).toContain('số nguyên không âm');
  });

  it('CASE K-O: Material Edit vs Non-Material Edit Identity Rotation', () => {
    const original = {
      id: 'uuid-reading-1',
      question_text: 'What is the main topic of the passage?',
      options: ['Budget', 'Schedule', 'Hiring', 'Marketing'],
      correct_answer: 'Budget',
      explanation: 'Explanation V1',
      sort_order: 0,
      is_active: true,
    };

    // Reorder (K) & Explanation edit (L) -> Should NOT rotate identity
    const reorderAndExp = { ...original, explanation: 'Explanation V2', sort_order: 3 };
    expect(shouldRotateLearningQuestionIdentity(original, reorderAndExp)).toBe(false);

    // Question text edit (M) -> SHOULD rotate identity
    const textEdit = { ...original, question_text: 'What is the primary topic?' };
    expect(shouldRotateLearningQuestionIdentity(original, textEdit)).toBe(true);

    // Answer edit (N) -> SHOULD rotate identity
    const answerEdit = { ...original, correct_answer: 'Schedule' };
    expect(shouldRotateLearningQuestionIdentity(original, answerEdit)).toBe(true);

    // Option edit (O) -> SHOULD rotate identity
    const optionEdit = { ...original, options: ['Budget', 'Timeline', 'Hiring', 'Marketing'] };
    expect(shouldRotateLearningQuestionIdentity(original, optionEdit)).toBe(true);
  });

  it('CASE P & Q: Material Passage Change Detection', () => {
    const origPassage = 'A company announced a new project today.';
    const editedMaterial = 'A hotel announced a new project today.';
    const editedWhitespaceOnly = '   A company announced a new project today.\n  ';

    expect(hasMaterialPassageChange(origPassage, editedMaterial)).toBe(true);
    expect(hasMaterialPassageChange(origPassage, editedWhitespaceOnly)).toBe(false);
  });

  it('Phase 3.4B — CASE A-E: 3-Table History Decision Combinations', () => {
    // Case A: question_attempt exists
    const resA = readingCmsModule.combineHistoryQueryResults([
      { dataCount: 1, error: null },
      { dataCount: 0, error: null },
      { dataCount: 0, error: null },
    ]);
    expect(resA.hasHistory).toBe(true);
    expect(resA.status).toBe('YES');

    // Case B: quiz_attempt exists (legacy student)
    const resB = readingCmsModule.combineHistoryQueryResults([
      { dataCount: 0, error: null },
      { dataCount: 1, error: null },
      { dataCount: 0, error: null },
    ]);
    expect(resB.hasHistory).toBe(true);
    expect(resB.status).toBe('YES');

    // Case C: user_progress exists
    const resC = readingCmsModule.combineHistoryQueryResults([
      { dataCount: 0, error: null },
      { dataCount: 0, error: null },
      { dataCount: 1, error: null },
    ]);
    expect(resC.hasHistory).toBe(true);
    expect(resC.status).toBe('YES');

    // Case D: none exist
    const resD = readingCmsModule.combineHistoryQueryResults([
      { dataCount: 0, error: null },
      { dataCount: 0, error: null },
      { dataCount: 0, error: null },
    ]);
    expect(resD.hasHistory).toBe(false);
    expect(resD.status).toBe('NO');

    // Case E: one query errors -> ERROR (safety default blocks operation)
    const resE = readingCmsModule.combineHistoryQueryResults([
      { dataCount: 0, error: null },
      { dataCount: 0, error: 'DB Timeout' },
      { dataCount: 0, error: null },
    ]);
    expect(resE.hasHistory).toBe(true);
    expect(resE.status).toBe('ERROR');
    expect(resE.error).toContain('Không thể kiểm tra lịch sử học viên lúc này');
  });

  it('Phase 3.4B — CASE M-P: Unpublished Lesson Historical Question Identity Protection', () => {
    const originalQ = {
      id: 'uuid-unpub-1',
      question_text: 'What is the main topic?',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
    };
    const editedText = { ...originalQ, question_text: 'What is the primary topic?' };
    const editedExpOnly = { ...originalQ, explanation: 'Updated explanation' };

    // Material edit on question with history -> MUST rotate even if lesson is unpublished (Case M)
    const isMaterial = shouldRotateLearningQuestionIdentity(originalQ, editedText);
    expect(isMaterial).toBe(true);

    // Non-material explanation edit -> Same UUID (Case O)
    const isMaterialExp = shouldRotateLearningQuestionIdentity(originalQ, editedExpOnly);
    expect(isMaterialExp).toBe(false);
  });

  it('Safe Question Replacement Orchestration (Cases A-D)', async () => {
    // Case A: Insert fails -> old active
    let oldActive = true;
    let resA = await executeSafeQuestionReplacement({
      insertInactiveNew: async () => ({ data: null, error: 'DB error' }),
      hideOld: async () => {
        oldActive = false;
        return { error: null };
      },
      activateNew: async () => ({ data: { id: 'n' }, error: null }),
      restoreOld: async () => ({ error: null }),
    });
    expect(resA.error).toContain('Nội dung cũ vẫn được giữ an toàn');
    expect(oldActive).toBe(true);

    // Case C: Success
    let newActive = false;
    let resC = await executeSafeQuestionReplacement({
      insertInactiveNew: async () => ({ data: { id: 'new-r-uuid' }, error: null }),
      hideOld: async () => {
        oldActive = false;
        return { error: null };
      },
      activateNew: async (id) => {
        newActive = true;
        return { data: { id, is_active: true }, error: null };
      },
      restoreOld: async () => ({ error: null }),
    });
    expect(resC.error).toBeNull();
    expect(oldActive).toBe(false);
    expect(newActive).toBe(true);
  });

  it('NO DELETE MUTATION EXPOSED: Confirm Reading validation module has no delete exports', () => {
    expect((readingCmsModule as any).deleteReadingLesson).toBeUndefined();
    expect((readingCmsModule as any).deleteReadingQuestion).toBeUndefined();
  });
});
