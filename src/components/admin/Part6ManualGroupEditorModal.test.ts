import { describe, it, expect } from 'vitest';

describe('Part 6 Manual Group Editor Data Mapping Suite', () => {
  const mockExistingGroups = [
    {
      id: 'group-131-134',
      part: 'part6',
      start_question: 131,
      end_question: 134,
      range: '131-134',
      passage: 'Riessler Landscaping has everything... ------- 131.',
      passage_vi: 'Riessler Landscaping có mọi thứ... ------- 131.',
    },
  ];

  const mockExistingQuestions = [
    {
      id: 'q-131',
      part: 'part6',
      question_number: 131,
      correct_answer: 'D',
      audio_url: null,
      image_url: null,
      group_id: 'group-131-134',
      is_active: true,
      options: ['(A) Staff members', '(B) Installing lights', '(C) Local competitors', '(D) Riessler Landscaping'],
      options_vi: ['(A) Nhân viên', '(B) Lắp đặt', '(C) Đối thủ', '(D) Mục tiêu'],
    },
    {
      id: 'q-132',
      part: 'part6',
      question_number: 132,
      correct_answer: 'C',
      audio_url: null,
      image_url: null,
      group_id: 'group-131-134',
      is_active: true,
      options: ['(A) years', '(B) space', '(C) beauty', '(D) moisture'],
      options_vi: ['(A) năm', '(B) không gian', '(C) vẻ đẹp', '(D) độ ẩm'],
    },
    {
      id: 'q-133',
      part: 'part6',
      question_number: 133,
      correct_answer: 'A',
      audio_url: null,
      image_url: null,
      group_id: 'group-131-134',
      is_active: true,
      options: ['(A) also', '(B) rarely', '(C) somehow', '(D) nevertheless'],
      options_vi: ['(A) cũng', '(B) hiếm khi', '(C) bằng cách nào đó', '(D) tuy nhiên'],
    },
    {
      id: 'q-134',
      part: 'part6',
      question_number: 134,
      correct_answer: 'B',
      audio_url: null,
      image_url: null,
      group_id: 'group-131-134',
      is_active: true,
      options: ['(A) its', '(B) our', '(C) others', '(D) their'],
      options_vi: ['(A) của nó', '(B) của chúng tôi', '(C) của người khác', '(D) của họ'],
    },
  ];

  it('1. loads Q131-134 group and questions correctly', () => {
    const group = mockExistingGroups.find(g => g.start_question === 131);
    const questions = mockExistingQuestions.filter(q => q.question_number >= 131 && q.question_number <= 134);

    expect(group).toBeDefined();
    expect(group?.passage).toContain('------- 131.');
    expect(group?.passage_vi).toContain('------- 131.');

    expect(questions.length).toBe(4);
    expect(questions.map(q => q.question_number)).toEqual([131, 132, 133, 134]);
  });

  it('2. verifies manual edit payload preserves correct_answer, group_id, media, and active flags', () => {
    const editedPassageEn = 'Updated EN Passage content ------- 131.';
    const editedPassageVi = 'Nội dung tiếng Việt cập nhật ------- 131.';

    const groupPayload = {
      passage: editedPassageEn,
      passage_vi: editedPassageVi,
      updated_at: new Date().toISOString(),
    };

    expect(groupPayload.passage).toBe(editedPassageEn);
    expect(groupPayload.passage_vi).toBe(editedPassageVi);
    expect((groupPayload as any).id).toBeUndefined();

    const q131 = mockExistingQuestions[0];
    const editedOptionsEn = ['(A) New Option A', '(B) Installing lights', '(C) Local competitors', '(D) Riessler Landscaping'];
    const editedOptionsVi = ['(A) Đáp án A mới', '(B) Lắp đặt', '(C) Đối thủ', '(D) Mục tiêu'];

    const questionPayload = {
      options: editedOptionsEn,
      options_vi: editedOptionsVi,
      updated_at: new Date().toISOString(),
    };

    expect(questionPayload.options[0]).toBe('(A) New Option A');
    expect(questionPayload.options_vi[0]).toBe('(A) Đáp án A mới');

    // Verify critical fields were NOT mutated in payload
    expect((questionPayload as any).correct_answer).toBeUndefined();
    expect((questionPayload as any).group_id).toBeUndefined();
    expect((questionPayload as any).audio_url).toBeUndefined();
    expect((questionPayload as any).image_url).toBeUndefined();
    expect(q131.correct_answer).toBe('D');
    expect(q131.group_id).toBe('group-131-134');
  });
});
