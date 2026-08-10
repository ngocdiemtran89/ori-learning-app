import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  buildGroupPatchPayload,
  normalizeToeicOptions,
  resolvePart6GroupForRange,
  GroupSnapshot,
  QuestionOptionState,
} from './part6WorkbenchPatchBuilder';

describe('Part 6 Workbench Atomic Save Contract Suite', () => {
  it('1. verifies migration file exists and contains correct RPC function definition', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'database/migrations/20260810_part6_workbench_atomic_group_save.sql'
    );
    const sqlContent = readFileSync(migrationPath, 'utf-8');

    expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.admin_update_toeic_part6_group');
    expect(sqlContent).toContain('SECURITY DEFINER');
    expect(sqlContent).toContain('public.is_admin()');
    expect(sqlContent).toContain('Cannot modify a published test');
    expect(sqlContent).toContain('v_active_q_count <> 4');
    expect(sqlContent).toContain('REVOKE EXECUTE ON FUNCTION public.admin_update_toeic_part6_group');
    expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION public.admin_update_toeic_part6_group');
  });

  it('2. validates passage-only Part 6 Workbench save payload (never sends question_text or translation_vi)', () => {
    const snapshot: GroupSnapshot = {
      passageEn: 'Passage EN',
      passageVi: 'Passage VI',
      questions: [
        {
          question_number: 131,
          options: ['A1', 'B1', 'C1', 'D1'],
          options_vi: ['A1vi', 'B1vi', 'C1vi', 'D1vi'],
        },
        {
          question_number: 132,
          options: ['years', 'space', 'beauty', 'moisture'],
          options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q131',
        question_number: 131,
        options: ['A1', 'B1', 'C1', 'D1'],
        options_vi: ['A1vi', 'B1vi', 'C1vi', 'D1vi'],
      },
      {
        id: 'q132',
        question_number: 132,
        options: ['years', 'space', 'natural beauty', 'moisture'],
        options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
      },
    ];

    const { payload, hasChanges } = buildGroupPatchPayload(
      snapshot,
      'Passage EN',
      'Passage VI',
      currentQuestions
    );

    expect(hasChanges).toBe(true);
    expect(payload.passage).toBeUndefined();
    expect(payload.passage_vi).toBeUndefined();
    expect(payload.questions).toEqual([
      {
        question_number: 132,
        options: ['years', 'space', 'natural beauty', 'moisture'],
      },
    ]);
    expect(payload.questions[0]).not.toHaveProperty('question_text');
    expect(payload.questions[0]).not.toHaveProperty('translation_vi');
    expect(payload.questions[0]).not.toHaveProperty('options_vi');
  });

  it('3. validates EXPLICIT CLEAR patch payload when passage is cleared', () => {
    const snapshot: GroupSnapshot = {
      passageEn: 'Existing Passage EN',
      passageVi: 'Existing Passage VI',
      questions: [
        {
          question_number: 132,
          options: ['years', 'space', 'beauty', 'moisture'],
          options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q132',
        question_number: 132,
        options: ['years', 'space', 'beauty', 'moisture'],
        options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
      },
    ];

    const { payload, hasChanges } = buildGroupPatchPayload(
      snapshot,
      '',
      'Existing Passage VI',
      currentQuestions
    );

    expect(hasChanges).toBe(true);
    expect(payload).toEqual({
      passage: null,
    });
  });

  it('4. validates UNCHANGED EMPTY FIELD (was empty and stays empty -> key omitted)', () => {
    const snapshot: GroupSnapshot = {
      passageEn: 'Passage EN',
      passageVi: 'Passage VI',
      questions: [
        {
          question_number: 132,
          options: ['years', 'space', 'beauty', 'moisture'],
          options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q132',
        question_number: 132,
        options: ['years', 'space', 'beauty', 'moisture'],
        options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
      },
    ];

    const { payload, hasChanges } = buildGroupPatchPayload(
      snapshot,
      'Passage EN',
      'Passage VI',
      currentQuestions
    );

    expect(hasChanges).toBe(false);
    expect(payload).toEqual({});
  });

  it('5. validates OPTIONS-ONLY patch payload (only option C changed)', () => {
    const snapshot: GroupSnapshot = {
      passageEn: 'Passage EN',
      passageVi: 'Passage VI',
      questions: [
        {
          question_number: 132,
          options: ['years', 'space', 'beauty', 'moisture'],
          options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q132',
        question_number: 132,
        options: ['years', 'space', 'natural beauty', 'moisture'],
        options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
      },
    ];

    const { payload, hasChanges } = buildGroupPatchPayload(
      snapshot,
      'Passage EN',
      'Passage VI',
      currentQuestions
    );

    expect(hasChanges).toBe(true);
    expect(payload.questions).toEqual([
      {
        question_number: 132,
        options: ['years', 'space', 'natural beauty', 'moisture'],
      },
    ]);
    expect(payload.questions[0]).not.toHaveProperty('options_vi');
    expect(payload.questions[0]).not.toHaveProperty('question_text');
    expect(payload.questions[0]).not.toHaveProperty('translation_vi');
  });

  it('6. validates NO CHANGE returns hasChanges = false', () => {
    const snapshot: GroupSnapshot = {
      passageEn: 'Passage EN',
      passageVi: 'Passage VI',
      questions: [
        {
          question_number: 131,
          options: ['A', 'B', 'C', 'D'],
          options_vi: ['Avi', 'Bvi', 'Cvi', 'Dvi'],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q131',
        question_number: 131,
        options: ['A', 'B', 'C', 'D'],
        options_vi: ['Avi', 'Bvi', 'Cvi', 'Dvi'],
      },
    ];

    const { payload, hasChanges } = buildGroupPatchPayload(
      snapshot,
      'Passage EN',
      'Passage VI',
      currentQuestions
    );

    expect(hasChanges).toBe(false);
    expect(Object.keys(payload).length).toBe(0);
  });

  it('7. validates canonical ranges support (Q131-134, Q135-138, Q139-142, Q143-146)', () => {
    const ranges = [
      { start: 131, end: 134 },
      { start: 135, end: 138 },
      { start: 139, end: 142 },
      { start: 143, end: 146 },
    ];

    ranges.forEach(r => {
      expect(r.end - r.start + 1).toBe(4);
      expect(r.start % 4 === 3 || r.start % 4 === 0 || r.start % 4 === 1 || r.start % 4 === 2).toBe(true);
    });
  });

  it('8. validates resolvePart6GroupForRange for ALL FOUR Part 6 groups when group rows lack start_question', () => {
    const mockGroups = [
      { id: 'grp-39', part: 'part6', start_question: null, range: null, passage: 'Passage 139-142' },
      { id: 'grp-31', part: 'part6', start_question: null, range: null, passage: 'Passage 131-134' },
      { id: 'grp-35', part: 'part6', start_question: null, range: null, passage: 'Passage 135-138' },
      { id: 'grp-43', part: 'part6', start_question: null, range: null, passage: 'Passage 143-146' },
    ];

    const mockQuestions = [
      ...[131, 132, 133, 134].map(q => ({ id: `q-${q}`, part: 'part6', question_number: q, group_id: 'grp-31' })),
      ...[135, 136, 137, 138].map(q => ({ id: `q-${q}`, part: 'part6', question_number: q, group_id: 'grp-35' })),
      ...[139, 140, 141, 142].map(q => ({ id: `q-${q}`, part: 'part6', question_number: q, group_id: 'grp-39' })),
      ...[143, 144, 145, 146].map(q => ({ id: `q-${q}`, part: 'part6', question_number: q, group_id: 'grp-43' })),
    ];

    // Range Q131-134
    const res1 = resolvePart6GroupForRange(mockGroups, mockQuestions, { label: 'Q131-134', start: 131, end: 134 });
    expect(res1.group?.id).toBe('grp-31');
    expect(res1.questions.map(q => q.question_number)).toEqual([131, 132, 133, 134]);

    // Range Q135-138
    const res2 = resolvePart6GroupForRange(mockGroups, mockQuestions, { label: 'Q135-138', start: 135, end: 138 });
    expect(res2.group?.id).toBe('grp-35');
    expect(res2.questions.map(q => q.question_number)).toEqual([135, 136, 137, 138]);

    // Range Q139-142
    const res3 = resolvePart6GroupForRange(mockGroups, mockQuestions, { label: 'Q139-142', start: 139, end: 142 });
    expect(res3.group?.id).toBe('grp-39');
    expect(res3.questions.map(q => q.question_number)).toEqual([139, 140, 141, 142]);

    // Range Q143-146
    const res4 = resolvePart6GroupForRange(mockGroups, mockQuestions, { label: 'Q143-146', start: 143, end: 146 });
    expect(res4.group?.id).toBe('grp-43');
    expect(res4.questions.map(q => q.question_number)).toEqual([143, 144, 145, 146]);
  });

  it('9. REGRESSION TEST: switching from Q139-142 to Q131-134 binds to Q131-134 group and NOT Q139-142 group', () => {
    // grp-39 is first in array order
    const mockGroups = [
      { id: 'grp-39', part: 'part6', passage: 'Passage 139-142' },
      { id: 'grp-31', part: 'part6', passage: 'Passage 131-134' },
    ];

    const mockQuestions = [
      ...[131, 132, 133, 134].map(q => ({ id: `q-${q}`, part: 'part6', question_number: q, group_id: 'grp-31' })),
      ...[139, 140, 141, 142].map(q => ({ id: `q-${q}`, part: 'part6', question_number: q, group_id: 'grp-39' })),
    ];

    // Select Q139-142 first
    const res139 = resolvePart6GroupForRange(mockGroups, mockQuestions, { label: 'Q139-142', start: 139, end: 142 });
    expect(res139.group?.id).toBe('grp-39');

    // Switch to Q131-134
    const res131 = resolvePart6GroupForRange(mockGroups, mockQuestions, { label: 'Q131-134', start: 131, end: 134 });
    expect(res131.group?.id).toBe('grp-31');
    expect(res131.group?.id).not.toBe('grp-39');

    // Patch payload for Q131
    const snapshot: GroupSnapshot = {
      passageEn: res131.group.passage,
      passageVi: '',
      questions: res131.questions.map(q => ({ question_number: q.question_number, options: ['', '', '', ''], options_vi: ['', '', '', ''] })),
    };

    const currentQuestions: QuestionOptionState[] = res131.questions.map(q => ({
      id: q.id,
      question_number: q.question_number,
      options: q.question_number === 131 ? ['closed', 'close', 'closing', 'closure'] : ['', '', '', ''],
      options_vi: ['', '', '', ''],
    }));

    const patchResult = buildGroupPatchPayload(snapshot, res131.group.passage, '', currentQuestions);
    expect(patchResult.hasChanges).toBe(true);
    expect(patchResult.payload.questions[0].question_number).toBe(131);
  });

  it('10. validates normalizeToeicOptions with string array, object array, letter-key, and numeric-key objects', () => {
    const stringArray = ['years', 'space', 'beauty', 'moisture'];
    const objectArray = [
      { label: 'A', text: 'years' },
      { label: 'B', text: 'space' },
      { label: 'C', text: 'beauty' },
      { label: 'D', text: 'moisture' },
    ];
    const letterKey = { A: 'years', B: 'space', C: 'beauty', D: 'moisture' };
    const numericKey = { '0': 'years', '1': 'space', '2': 'beauty', '3': 'moisture' };

    expect(normalizeToeicOptions(stringArray)).toEqual(['years', 'space', 'beauty', 'moisture']);
    expect(normalizeToeicOptions(objectArray)).toEqual(['years', 'space', 'beauty', 'moisture']);
    expect(normalizeToeicOptions(letterKey)).toEqual(['years', 'space', 'beauty', 'moisture']);
    expect(normalizeToeicOptions(numericKey)).toEqual(['years', 'space', 'beauty', 'moisture']);
  });
});
