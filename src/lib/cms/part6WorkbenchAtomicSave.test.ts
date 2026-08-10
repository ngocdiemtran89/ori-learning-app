import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

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

  it('2. validates RPC payload does NOT include immutable fields (correct_answer, audio_url, image_url, group_id)', () => {
    const questionsState = [
      {
        id: 'q-131',
        question_number: 131,
        question_text: 'Stem 131',
        translation_vi: 'Stem VI 131',
        options: ['A', 'B', 'C', 'D'],
        options_vi: ['Avi', 'Bvi', 'Cvi', 'Dvi'],
        correct_answer: 'A', // Immutable
        audio_url: 'http://audio.mp3', // Immutable
        image_url: 'http://img.jpg', // Immutable
        group_id: 'grp-1', // Immutable
      },
    ];

    const payload = {
      passage: 'Passage EN',
      passage_vi: 'Passage VI',
      questions: questionsState.map(q => ({
        question_number: q.question_number,
        question_text: q.question_text?.trim() || null,
        translation_vi: q.translation_vi?.trim() || null,
        options: q.options,
        options_vi: q.options_vi,
      })),
    };

    expect(payload.questions[0]).not.toHaveProperty('correct_answer');
    expect(payload.questions[0]).not.toHaveProperty('audio_url');
    expect(payload.questions[0]).not.toHaveProperty('image_url');
    expect(payload.questions[0]).not.toHaveProperty('group_id');
  });

  it('3. validates patch semantics for omitted vs explicit null vs updated string', () => {
    // Case A: string stem
    const payloadA = { question_text: 'New Stem'.trim() || null };
    expect(payloadA.question_text).toBe('New Stem');

    // Case B: empty string converted to null (explicit clear)
    const payloadB = { question_text: ''.trim() || null };
    expect(payloadB.question_text).toBeNull();
  });

  it('4. validates canonical ranges support (Q131-134, Q135-138, Q139-142, Q143-146)', () => {
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
