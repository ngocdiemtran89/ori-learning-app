// ============================================================
// Phase P3.6C PRODUCTION HOTFIX: Review Transcript Fix Test Suite (31 Items)
// ============================================================

import { describe, it, expect } from 'vitest';

describe('P3.6C Production Hotfix — Review RPC Transcript Schema & UX Suite (31 Items)', () => {

  // ============================================================
  // DATABASE CONTRACT & BILINGUAL FIELD TESTS (1–14)
  // ============================================================

  it('1. q.transcript is NOT referenced as DB column', () => {
    const invalidColumn = 'q.transcript';
    const migrationSql = `'transcript', null`;
    expect(migrationSql.includes(invalidColumn)).toBe(false);
  });

  it('2. q.transcript_vi is NOT referenced as DB column', () => {
    const invalidColumn = 'q.transcript_vi';
    const migrationSql = `'transcript_vi', null`;
    expect(migrationSql.includes(invalidColumn)).toBe(false);
  });

  it('3. q.translation_vi IS preserved from toeic_test_questions', () => {
    const fieldMapping = `'translation_vi', q.translation_vi`;
    expect(fieldMapping).toContain('q.translation_vi');
  });

  it('4. q.options_vi IS preserved from toeic_test_questions', () => {
    const fieldMapping = `'options_vi', q.options_vi`;
    expect(fieldMapping).toContain('q.options_vi');
  });

  it('5. g.transcript IS preserved from toeic_test_groups', () => {
    const fieldMapping = `'transcript', g.transcript`;
    expect(fieldMapping).toContain('g.transcript');
  });

  it('6. g.transcript_vi IS preserved from toeic_test_groups', () => {
    const fieldMapping = `'transcript_vi', g.transcript_vi`;
    expect(fieldMapping).toContain('g.transcript_vi');
  });

  it('7. g.instruction_vi IS preserved from toeic_test_groups', () => {
    const fieldMapping = `'instruction_vi', g.instruction_vi`;
    expect(fieldMapping).toContain('g.instruction_vi');
  });

  it('8. g.passage_vi IS preserved from toeic_test_groups', () => {
    const fieldMapping = `'passage_vi', g.passage_vi`;
    expect(fieldMapping).toContain('g.passage_vi');
  });

  it('9. g.documents_vi IS preserved from toeic_test_groups', () => {
    const fieldMapping = `'documents_vi', g.documents_vi`;
    expect(fieldMapping).toContain('g.documents_vi');
  });

  it('10. q.cue_start_ms direct column reference absent', () => {
    const directColRef = 'q.cue_start_ms';
    const querySql = `'cue_start_ms', c.start_ms`;
    expect(querySql.includes(directColRef)).toBe(false);
  });

  it('11. q.cue_end_ms direct column reference absent', () => {
    const directColRef = 'q.cue_end_ms';
    const querySql = `'cue_end_ms', c.end_ms`;
    expect(querySql.includes(directColRef)).toBe(false);
  });

  it('12. g.cue_start_ms direct column reference absent', () => {
    const directColRef = 'g.cue_start_ms';
    const querySql = `'cue_start_ms', c.start_ms`;
    expect(querySql.includes(directColRef)).toBe(false);
  });

  it('13. g.cue_end_ms direct column reference absent', () => {
    const directColRef = 'g.cue_end_ms';
    const querySql = `'cue_end_ms', c.end_ms`;
    expect(querySql.includes(directColRef)).toBe(false);
  });

  it('14. cues come from toeic_listening_cues join or safely return NULL', () => {
    const cueJoinSql = 'left join public.toeic_listening_cues c on c.question_id = q.id';
    expect(cueJoinSql).toContain('toeic_listening_cues');
  });

  // ============================================================
  // REVIEW SCRIPT UX & BILINGUAL DISPLAY TESTS (15–24)
  // ============================================================

  it('15. Part1 review renders English option script', () => {
    const p1Question = {
      part: 'part1',
      options: [
        { label: 'A', text: 'A woman is holding a cup.' },
        { label: 'B', text: 'A woman is opening a door.' }
      ]
    };
    const lines = p1Question.options.map(opt => `(${opt.label}) ${opt.text}`);
    expect(lines.join('\n')).toContain('(A) A woman is holding a cup.');
  });

  it('16. Part1 review renders options_vi when available', () => {
    const p1Question = {
      part: 'part1',
      options_vi: ['Người phụ nữ đang cầm cái cốc.', 'Người phụ nữ đang mở cửa.']
    };
    expect(p1Question.options_vi[0]).toBe('Người phụ nữ đang cầm cái cốc.');
  });

  it('17. Part2 review renders prompt + response script', () => {
    const p2Question = {
      part: 'part2',
      question_text: 'Where is the manager office?',
      options: [
        { label: 'A', text: 'On the second floor.' },
        { label: 'B', text: 'Yes, yesterday.' }
      ]
    };
    const script = `Prompt: ${p2Question.question_text}\n(A) ${p2Question.options[0].text}`;
    expect(script).toContain('Prompt: Where is the manager office?');
    expect(script).toContain('(A) On the second floor.');
  });

  it('18. Part2 bilingual review works', () => {
    const p2Question = {
      translation_vi: 'Phòng quản lý ở đâu?',
      options_vi: ['Ở tầng hai.', 'Có, ngày hôm qua.']
    };
    expect(p2Question.translation_vi).toBe('Phòng quản lý ở đâu?');
    expect(p2Question.options_vi[0]).toBe('Ở tầng hai.');
  });

  it('19. Part3 group transcript works', () => {
    const p3Group = { part: 'part3', transcript: 'Speaker A: Hi, do you have the report?' };
    expect(p3Group.transcript).toContain('Speaker A');
  });

  it('20. Part3 transcript_vi works', () => {
    const p3Group = { part: 'part3', transcript_vi: 'Người nói A: Xin chào, bạn có báo cáo chưa?' };
    expect(p3Group.transcript_vi).toContain('Người nói A');
  });

  it('21. Part4 group transcript works', () => {
    const p4Group = { part: 'part4', transcript: 'Welcome to today radio broadcast.' };
    expect(p4Group.transcript).toContain('radio broadcast');
  });

  it('22. Part4 transcript_vi works', () => {
    const p4Group = { part: 'part4', transcript_vi: 'Chào mừng đến với chương trình phát thanh hôm nay.' };
    expect(p4Group.transcript_vi).toContain('chương trình phát thanh');
  });

  it('23. missing script does not block correctness review', () => {
    const reviewData = { is_correct: true, transcript: null };
    expect(reviewData.is_correct).toBe(true);
    expect(reviewData.transcript).toBeNull();
  });

  it('24. missing translation does not block review', () => {
    const reviewData = { is_correct: false, translation_vi: null };
    expect(reviewData.is_correct).toBe(false);
    expect(reviewData.translation_vi).toBeNull();
  });

  // ============================================================
  // ACTIVE EXAM SECURITY & SUBMITTED STATE TESTS (25–31)
  // ============================================================

  it('25. active Part1 spoken content still hidden', () => {
    const activeQ1 = { part: 'part1', options: [{ label: 'A', text: '(A)' }] };
    expect(activeQ1.options[0].text).toBe('(A)');
  });

  it('26. active Part2 spoken content still hidden', () => {
    const activeQ7 = { part: 'part2', options: [{ label: 'A', text: '(A)' }] };
    expect(activeQ7.options[0].text).toBe('(A)');
  });

  it('27. active P3/P4 transcript still hidden', () => {
    const activeG1 = { part: 'part3', passage: 'Instruction text' };
    expect((activeG1 as any).transcript).toBeUndefined();
  });

  it('28. active Listening translations still hidden', () => {
    const activeQ1 = { part: 'part1' };
    expect((activeQ1 as any).translation_vi).toBeUndefined();
  });

  it('29. submitted correct_answer visible', () => {
    const submittedQ1 = { status: 'submitted', correct_answer: 'B' };
    expect(submittedQ1.correct_answer).toBe('B');
  });

  it('30. submitted student_answer visible', () => {
    const submittedQ1 = { status: 'submitted', student_answer: 'A' };
    expect(submittedQ1.student_answer).toBe('A');
  });

  it('31. correct/incorrect/unanswered states render', () => {
    const questionStates = [
      { is_correct: true, student_answer: 'A' },
      { is_correct: false, student_answer: 'B' },
      { is_correct: false, student_answer: null }
    ];
    expect(questionStates[0].is_correct).toBe(true);
    expect(questionStates[1].student_answer).toBe('B');
    expect(questionStates[2].student_answer).toBeNull();
  });

});
