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

  it('2. validates normalizeToeicOptions with object-array historical DB options (Production shape)', () => {
    const dbOptions = [
      { label: 'A', text: 'years' },
      { label: 'B', text: 'space' },
      { label: 'C', text: 'beauty' },
      { label: 'D', text: 'moisture' },
    ];
    const dbOptionsVi = [
      { label: 'A', text: 'năm' },
      { label: 'B', text: 'không gian' },
      { label: 'C', text: 'vẻ đẹp' },
      { label: 'D', text: 'độ ẩm' },
    ];

    const normEn = normalizeToeicOptions(dbOptions);
    const normVi = normalizeToeicOptions(dbOptionsVi);

    expect(normEn).toEqual(['years', 'space', 'beauty', 'moisture']);
    expect(normVi).toEqual(['năm', 'không gian', 'vẻ đẹp', 'độ ẩm']);
  });

  it('3. validates normalizeToeicOptions with letter-key and numeric-key objects', () => {
    const letterKey = { A: 'years', B: 'space', C: 'beauty', D: 'moisture' };
    const numericKey = { '0': 'years', '1': 'space', '2': 'beauty', '3': 'moisture' };

    expect(normalizeToeicOptions(letterKey)).toEqual(['years', 'space', 'beauty', 'moisture']);
    expect(normalizeToeicOptions(numericKey)).toEqual(['years', 'space', 'beauty', 'moisture']);
    expect(normalizeToeicOptions(null)).toEqual(['', '', '', '']);
  });

  it('4. validates ROUNDTRIP: loading historical object-array option -> no changes -> edit option C -> patch payload canonical', () => {
    const rawDbOptions = [
      { label: 'A', text: 'years' },
      { label: 'B', text: 'space' },
      { label: 'C', text: 'beauty' },
      { label: 'D', text: 'moisture' },
    ];

    // Load boundary normalization
    const normEn = normalizeToeicOptions(rawDbOptions);

    const snapshot: GroupSnapshot = {
      passageEn: 'Passage EN',
      passageVi: 'Passage VI',
      questions: [
        {
          question_number: 132,
          question_text: '',
          translation_vi: '',
          options: [...normEn],
          options_vi: ['', '', '', ''],
        },
      ],
    };

    const currentQuestions: QuestionOptionState[] = [
      {
        id: 'q132',
        question_number: 132,
        question_text: '',
        translation_vi: '',
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
  });

  it('5. validates ONE FIELD patch payload (only Q132 translation_vi changed)', () => {
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
        translation_vi: 'New Stem VI 132',
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
    expect(payload.passage).toBeUndefined();
    expect(payload.passage_vi).toBeUndefined();
    expect(payload.questions).toEqual([
      {
        question_number: 132,
        translation_vi: 'New Stem VI 132',
      },
    ]);
  });

  it('6. validates EXPLICIT CLEAR patch payload (stem deleted sends null)', () => {
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

    expect(hasChanges).toBe(true);
    expect(payload.questions).toEqual([
      {
        question_number: 132,
        question_text: null,
      },
    ]);
  });
});
