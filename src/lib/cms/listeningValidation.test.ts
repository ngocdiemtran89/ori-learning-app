import { describe, it, expect } from 'vitest';
import * as listeningCmsModule from './listeningValidation';
import {
  expectedOptionCountForToeicPart,
  shouldRotateLearningQuestionIdentity,
  validateListeningQuestion,
  validateListeningLessonDraft,
  validateListeningLessonForPublish,
} from './listeningValidation';

describe('Phase 3.3 — Listening CMS Pure Validation & Stable Identity Tests', () => {
  it('A-D: Expected option count per TOEIC Part', () => {
    expect(expectedOptionCountForToeicPart('part1')).toBe(4);
    expect(expectedOptionCountForToeicPart('part2')).toBe(3);
    expect(expectedOptionCountForToeicPart('part3')).toBe(4);
    expect(expectedOptionCountForToeicPart('part4')).toBe(4);
  });

  it('E: Part 5 -> invalid Listening lesson (toeic_part)', () => {
    const res = validateListeningLessonDraft({
      title: 'Invalid Listening',
      slug: 'invalid-listening',
      level: 'foundation',
      toeic_part: 'part5',
      sort_order: 1,
      questions: [],
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.toeic_part).toContain('Part 1, Part 2, Part 3, hoặc Part 4');
  });

  it('F: Part 1 active question missing image_url -> publish invalid', () => {
    const res = validateListeningLessonForPublish({
      title: 'Part 1 Photo',
      slug: 'part1-photo',
      level: 'foundation',
      toeic_part: 'part1',
      audio_url: 'https://example.com/audio.mp3',
      sort_order: 1,
      questions: [
        {
          id: 'q1',
          question_text: 'Look at the picture',
          options: ['A', 'B', 'C', 'D'],
          correct_answer: 'A',
          image_url: '', // Missing image URL for Part 1
          is_active: true,
        },
      ],
    });
    expect(res.canPublish).toBe(false);
    expect(res.errors.questions).toContain('Part 1 yêu cầu URL hình ảnh');
  });

  it('G: Part 2 with 3 valid unique options -> valid', () => {
    const qVal = validateListeningQuestion(
      {
        question_text: 'Where is the meeting?',
        options: ['In Room 302', 'Tomorrow morning', 'Yes, it is'],
        correct_answer: 'In Room 302',
      },
      'part2'
    );
    expect(qVal.isValid).toBe(true);
  });

  it('H: Duplicate options -> invalid', () => {
    const qVal = validateListeningQuestion(
      {
        question_text: 'Where is the meeting?',
        options: ['In Room 302', 'In Room 302', 'Tomorrow morning'],
        correct_answer: 'In Room 302',
      },
      'part2'
    );
    expect(qVal.isValid).toBe(false);
    expect(qVal.errors[0]).toContain('không được trùng lặp');
  });

  it('I: Correct answer not in options -> invalid', () => {
    const qVal = validateListeningQuestion(
      {
        question_text: 'Where is the meeting?',
        options: ['In Room 302', 'Tomorrow morning', 'Yes, it is'],
        correct_answer: 'Next week',
      },
      'part2'
    );
    expect(qVal.isValid).toBe(false);
    expect(qVal.errors[0]).toContain('Đáp án đúng phải trùng khớp');
  });

  it('J: Negative or decimal sort_order -> invalid', () => {
    const resNegative = validateListeningLessonDraft({
      title: 'Test',
      slug: 'test-slug',
      level: 'foundation',
      toeic_part: 'part1',
      sort_order: -1,
      questions: [],
    });
    expect(resNegative.isValid).toBe(false);

    const resDecimal = validateListeningLessonDraft({
      title: 'Test',
      slug: 'test-slug',
      level: 'foundation',
      toeic_part: 'part1',
      sort_order: 1.5,
      questions: [],
    });
    expect(resDecimal.isValid).toBe(false);
  });

  it('K-O: Material Edit vs Non-Material Edit Identity Rotation', () => {
    const original = {
      id: 'uuid-1234',
      question_text: 'What is the topic of the conversation?',
      options: ['Budget', 'Schedule', 'Hiring', 'Marketing'],
      correct_answer: 'Budget',
      explanation: 'Explanation V1',
      sort_order: 0,
      is_active: true,
    };

    // Reorder (K) & Explanation edit (L) -> Should NOT rotate identity
    const explanationEdit = { ...original, explanation: 'Explanation V2', sort_order: 5 };
    expect(shouldRotateLearningQuestionIdentity(original, explanationEdit)).toBe(false);

    // Question text edit (M) -> SHOULD rotate identity
    const textEdit = { ...original, question_text: 'What are they discussing?' };
    expect(shouldRotateLearningQuestionIdentity(original, textEdit)).toBe(true);

    // Answer edit (N) -> SHOULD rotate identity
    const answerEdit = { ...original, correct_answer: 'Schedule' };
    expect(shouldRotateLearningQuestionIdentity(original, answerEdit)).toBe(true);

    // Option edit (O) -> SHOULD rotate identity
    const optionEdit = { ...original, options: ['Budget', 'Schedule', 'Sales', 'Marketing'] };
    expect(shouldRotateLearningQuestionIdentity(original, optionEdit)).toBe(true);
  });

  it('Phase 3.3B — CASE A: Replacement insert fails', async () => {
    let oldIsActive = true;
    const res = await listeningCmsModule.executeSafeQuestionReplacement({
      insertInactiveNew: async () => ({ data: null, error: 'DB Network Error' }),
      hideOld: async () => {
        oldIsActive = false;
        return { error: null };
      },
      activateNew: async () => ({ data: { id: 'new' }, error: null }),
      restoreOld: async () => ({ error: null }),
    });

    expect(res.error).toBe('Không thể lưu thay đổi câu hỏi. Nội dung cũ vẫn được giữ an toàn.');
    expect(oldIsActive).toBe(true); // Old question remains untouched!
  });

  it('Phase 3.3B — CASE B: Replacement inserted inactive, hiding old fails', async () => {
    let oldIsActive = true;
    let newIsActive = false;

    const res = await listeningCmsModule.executeSafeQuestionReplacement({
      insertInactiveNew: async () => ({ data: { id: 'new-uuid' }, error: null }),
      hideOld: async () => ({ error: 'Lock Error' }),
      activateNew: async () => {
        newIsActive = true;
        return { data: { id: 'new-uuid' }, error: null };
      },
      restoreOld: async () => ({ error: null }),
    });

    expect(res.error).toBe('Không thể lưu thay đổi câu hỏi. Nội dung cũ vẫn được giữ an toàn.');
    expect(oldIsActive).toBe(true); // Old stays active
    expect(newIsActive).toBe(false); // New stays inactive
  });

  it('Phase 3.3B — CASE C: All 6 steps succeed (Clean Replacement)', async () => {
    let oldIsActive = true;
    let newIsActive = false;

    const res = await listeningCmsModule.executeSafeQuestionReplacement({
      insertInactiveNew: async () => ({ data: { id: 'new-uuid' }, error: null }),
      hideOld: async () => {
        oldIsActive = false;
        return { error: null };
      },
      activateNew: async (newId) => {
        newIsActive = true;
        return { data: { id: newId, is_active: true }, error: null };
      },
      restoreOld: async () => ({ error: null }),
    });

    expect(res.error).toBeNull();
    expect(res.data).toEqual({ id: 'new-uuid', is_active: true });
    expect(oldIsActive).toBe(false); // Old inactive
    expect(newIsActive).toBe(true); // New active
  });

  it('Phase 3.3B — CASE D: New activation fails, old restoration succeeds', async () => {
    let oldIsActive = false;

    const res = await listeningCmsModule.executeSafeQuestionReplacement({
      insertInactiveNew: async () => ({ data: { id: 'new-uuid' }, error: null }),
      hideOld: async () => {
        oldIsActive = false;
        return { error: null };
      },
      activateNew: async () => ({ data: null, error: 'Activation Error' }),
      restoreOld: async () => {
        oldIsActive = true;
        return { error: null };
      },
    });

    expect(res.error).toBe('Không thể kích hoạt câu hỏi mới. Nội dung cũ vẫn được giữ an toàn.');
    expect(oldIsActive).toBe(true); // Old successfully restored to active!
  });

  it('R: NO DELETE MUTATION EXPOSED: Confirm Listening validation module has no delete exports', () => {
    expect((listeningCmsModule as any).deleteListeningLesson).toBeUndefined();
    expect((listeningCmsModule as any).deleteLessonQuestion).toBeUndefined();
  });
});
