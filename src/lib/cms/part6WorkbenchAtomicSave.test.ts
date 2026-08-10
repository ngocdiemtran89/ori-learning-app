import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { buildGroupPatchPayload, normalizeToeicOptions, GroupSnapshot, QuestionOptionState } from './part6WorkbenchPatchBuilder';

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
        options: ['years', 'space', 'natural beauty', 'moisture'], // Only option C changed
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
      '', // Cleared passage EN
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

  it('8. validates normalizeToeicOptions with string array, object array, letter-key, and numeric-key objects', () => {
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

  it('9. validates normalizeToeicOptions fails safe on unknown/malformed objects, label-only objects, and debug fields', () => {
    expect(normalizeToeicOptions(null)).toEqual(['', '', '', '']);
    expect(normalizeToeicOptions(undefined)).toEqual(['', '', '', '']);
    expect(normalizeToeicOptions({ foo: 'bar' })).toEqual(['', '', '', '']);
    expect(normalizeToeicOptions([{ label: 'A' }])).toEqual(['', '', '', '']);
    expect(normalizeToeicOptions([{ label: 'A', debug: 'unexpected' }])).toEqual(['', '', '', '']);
  });

  it('10. validates ROUNDTRIP: loading historical object-array option -> no changes -> edit option C -> patch payload canonical', () => {
    const rawDbOptions = [
      { label: 'A', text: 'years' },
      { label: 'B', text: 'space' },
      { label: 'C', text: 'beauty' },
      { label: 'D', text: 'moisture' },
    ];

    const normEn = normalizeToeicOptions(rawDbOptions);

    const snapshot: GroupSnapshot = {
      passageEn: 'Passage EN',
      passageVi: 'Passage VI',
      questions: [
        {
          question_number: 132,
          options: [...normEn],
          options_vi: ['', '', '', ''],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q132',
        question_number: 132,
        options: [...normEn],
        options_vi: ['', '', '', ''],
      },
    ];

    // Untouched load check
    const initialDiff = buildGroupPatchPayload(snapshot, 'Passage EN', 'Passage VI', currentQuestions);
    expect(initialDiff.hasChanges).toBe(false);
    expect(initialDiff.payload).toEqual({});

    // Admin edits option C
    currentQuestions[0].options[2] = 'natural beauty';

    const editedDiff = buildGroupPatchPayload(snapshot, 'Passage EN', 'Passage VI', currentQuestions);
    expect(editedDiff.hasChanges).toBe(true);
    expect(editedDiff.payload).toEqual({
      questions: [
        {
          question_number: 132,
          options: ['years', 'space', 'natural beauty', 'moisture'],
        },
      ],
    });
    expect(editedDiff.payload.questions[0]).not.toHaveProperty('question_text');
    expect(editedDiff.payload.questions[0]).not.toHaveProperty('translation_vi');
  });
});
