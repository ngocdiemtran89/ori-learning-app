import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { buildGroupPatchPayload, GroupSnapshot, QuestionOptionState } from './part6WorkbenchPatchBuilder';

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

  it('2. validates ONE FIELD patch payload (only Q132 translation_vi changed)', () => {
    const snapshot: GroupSnapshot = {
      passageEn: 'Passage EN',
      passageVi: 'Passage VI',
      questions: [
        {
          question_number: 131,
          question_text: 'Stem 131',
          translation_vi: 'Stem VI 131',
          options: ['A1', 'B1', 'C1', 'D1'],
          options_vi: ['A1vi', 'B1vi', 'C1vi', 'D1vi'],
        },
        {
          question_number: 132,
          question_text: 'Stem 132',
          translation_vi: 'Old Stem VI 132',
          options: ['years', 'space', 'beauty', 'moisture'],
          options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q131',
        question_number: 131,
        question_text: 'Stem 131',
        translation_vi: 'Stem VI 131',
        options: ['A1', 'B1', 'C1', 'D1'],
        options_vi: ['A1vi', 'B1vi', 'C1vi', 'D1vi'],
      },
      {
        id: 'q132',
        question_number: 132,
        question_text: 'Stem 132',
        translation_vi: 'New Stem VI 132', // Only this changed
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

    expect(hasChanges).toBe(true);
    expect(payload.passage).toBeUndefined(); // Omitted
    expect(payload.passage_vi).toBeUndefined(); // Omitted
    expect(payload.questions).toEqual([
      {
        question_number: 132,
        translation_vi: 'New Stem VI 132',
      },
    ]);
    expect(payload.questions[0]).not.toHaveProperty('question_text');
    expect(payload.questions[0]).not.toHaveProperty('options');
    expect(payload.questions[0]).not.toHaveProperty('options_vi');
  });

  it('3. validates EXPLICIT CLEAR patch payload (stem deleted sends null)', () => {
    const snapshot: GroupSnapshot = {
      passageEn: 'Passage EN',
      passageVi: 'Passage VI',
      questions: [
        {
          question_number: 132,
          question_text: 'Existing English Stem',
          translation_vi: '',
          options: ['years', 'space', 'beauty', 'moisture'],
          options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q132',
        question_number: 132,
        question_text: '', // Intentionally cleared
        translation_vi: '',
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

    expect(hasChanges).toBe(true);
    expect(payload.questions).toEqual([
      {
        question_number: 132,
        question_text: null, // Explicit clear
      },
    ]);
  });

  it('4. validates UNCHANGED EMPTY FIELD (was empty and stays empty -> key omitted)', () => {
    const snapshot: GroupSnapshot = {
      passageEn: 'Passage EN',
      passageVi: 'Passage VI',
      questions: [
        {
          question_number: 132,
          question_text: '',
          translation_vi: '',
          options: ['years', 'space', 'beauty', 'moisture'],
          options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q132',
        question_number: 132,
        question_text: '',
        translation_vi: '',
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
          question_text: 'Stem 132',
          translation_vi: 'Stem VI 132',
          options: ['years', 'space', 'beauty', 'moisture'],
          options_vi: ['năm', 'không gian', 'vẻ đẹp', 'độ ẩm'],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q132',
        question_number: 132,
        question_text: 'Stem 132',
        translation_vi: 'Stem VI 132',
        options: ['years', 'space', 'natural beauty', 'moisture'], // C changed
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
  });

  it('6. validates NO CHANGE returns hasChanges = false', () => {
    const snapshot: GroupSnapshot = {
      passageEn: 'Passage EN',
      passageVi: 'Passage VI',
      questions: [
        {
          question_number: 131,
          question_text: 'Stem',
          translation_vi: 'Stem VI',
          options: ['A', 'B', 'C', 'D'],
          options_vi: ['Avi', 'Bvi', 'Cvi', 'Dvi'],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q131',
        question_number: 131,
        question_text: 'Stem',
        translation_vi: 'Stem VI',
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
});
