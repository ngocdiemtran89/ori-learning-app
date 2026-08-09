import { describe, it, expect } from 'vitest';
import {
  getToeicGroupQuestionRange,
  sortGroupsByQuestionRange,
  getMediaCompleteness,
} from './mediaCompleteness';
import { ToeicTestGroupInput, ToeicTestQuestionInput } from '../cms/testBankValidation';

// Helper to create a minimal question
function makeQ(overrides: Partial<ToeicTestQuestionInput> & { question_number: number; part: string }): ToeicTestQuestionInput {
  return {
    id: `q-${overrides.question_number}`,
    question_text: '',
    correct_answer: 'A',
    options: ['A', 'B', 'C', 'D'],
    is_active: true,
    ...overrides,
  } as ToeicTestQuestionInput;
}

// Helper to create a minimal group
function makeG(overrides: Partial<ToeicTestGroupInput> & { id: string; part: string }): ToeicTestGroupInput {
  return {
    title: '',
    is_active: true,
    ...overrides,
  } as ToeicTestGroupInput;
}

describe('getToeicGroupQuestionRange', () => {
  it('returns correct range for a 3-question group', () => {
    const questions = [
      makeQ({ question_number: 32, part: 'part3', group_id: 'g1' }),
      makeQ({ question_number: 33, part: 'part3', group_id: 'g1' }),
      makeQ({ question_number: 34, part: 'part3', group_id: 'g1' }),
    ];
    const range = getToeicGroupQuestionRange('g1', questions);
    expect(range.min).toBe(32);
    expect(range.max).toBe(34);
    expect(range.label).toBe('Q32–34');
  });

  it('returns single-number label for a group with one question', () => {
    const questions = [
      makeQ({ question_number: 42, part: 'part3', group_id: 'g2' }),
    ];
    const range = getToeicGroupQuestionRange('g2', questions);
    expect(range.min).toBe(42);
    expect(range.max).toBe(42);
    expect(range.label).toBe('Q42');
  });

  it('ignores inactive questions in range calculation', () => {
    const questions = [
      makeQ({ question_number: 32, part: 'part3', group_id: 'g1', is_active: true }),
      makeQ({ question_number: 33, part: 'part3', group_id: 'g1', is_active: false }),
      makeQ({ question_number: 34, part: 'part3', group_id: 'g1', is_active: true }),
    ];
    const range = getToeicGroupQuestionRange('g1', questions);
    expect(range.min).toBe(32);
    expect(range.max).toBe(34);
    expect(range.label).toBe('Q32–34');
  });

  it('returns "Group" fallback when no active questions exist', () => {
    const questions = [
      makeQ({ question_number: 32, part: 'part3', group_id: 'g1', is_active: false }),
    ];
    const range = getToeicGroupQuestionRange('g1', questions);
    expect(range.label).toBe('Group');
    expect(range.min).toBe(Infinity);
  });
});

describe('sortGroupsByQuestionRange', () => {
  it('sorts Part 3 groups by minimum question number ascending', () => {
    const questions = [
      makeQ({ question_number: 65, part: 'part3', group_id: 'g-late' }),
      makeQ({ question_number: 66, part: 'part3', group_id: 'g-late' }),
      makeQ({ question_number: 67, part: 'part3', group_id: 'g-late' }),
      makeQ({ question_number: 32, part: 'part3', group_id: 'g-early' }),
      makeQ({ question_number: 33, part: 'part3', group_id: 'g-early' }),
      makeQ({ question_number: 34, part: 'part3', group_id: 'g-early' }),
      makeQ({ question_number: 50, part: 'part3', group_id: 'g-mid' }),
      makeQ({ question_number: 51, part: 'part3', group_id: 'g-mid' }),
      makeQ({ question_number: 52, part: 'part3', group_id: 'g-mid' }),
    ];
    const groups = [
      makeG({ id: 'g-late', part: 'part3' }),
      makeG({ id: 'g-early', part: 'part3' }),
      makeG({ id: 'g-mid', part: 'part3' }),
    ];
    const sorted = sortGroupsByQuestionRange(groups, questions);
    expect(sorted[0].id).toBe('g-early');
    expect(sorted[1].id).toBe('g-mid');
    expect(sorted[2].id).toBe('g-late');
  });

  it('sorts Part 4 groups by minimum question number ascending', () => {
    const questions = [
      makeQ({ question_number: 98, part: 'part4', group_id: 'g4-last' }),
      makeQ({ question_number: 99, part: 'part4', group_id: 'g4-last' }),
      makeQ({ question_number: 100, part: 'part4', group_id: 'g4-last' }),
      makeQ({ question_number: 71, part: 'part4', group_id: 'g4-first' }),
      makeQ({ question_number: 72, part: 'part4', group_id: 'g4-first' }),
      makeQ({ question_number: 73, part: 'part4', group_id: 'g4-first' }),
    ];
    const groups = [
      makeG({ id: 'g4-last', part: 'part4' }),
      makeG({ id: 'g4-first', part: 'part4' }),
    ];
    const sorted = sortGroupsByQuestionRange(groups, questions);
    expect(sorted[0].id).toBe('g4-first');
    expect(sorted[1].id).toBe('g4-last');
  });

  it('does not mutate the original array', () => {
    const questions = [
      makeQ({ question_number: 50, part: 'part3', group_id: 'b' }),
      makeQ({ question_number: 32, part: 'part3', group_id: 'a' }),
    ];
    const groups = [
      makeG({ id: 'b', part: 'part3' }),
      makeG({ id: 'a', part: 'part3' }),
    ];
    const sorted = sortGroupsByQuestionRange(groups, questions);
    expect(groups[0].id).toBe('b'); // original unchanged
    expect(sorted[0].id).toBe('a'); // sorted copy
  });
});

describe('getMediaCompleteness — group labels', () => {
  it('missing Part 3 group labels use Qxx–yy format, not UUID', () => {
    const questions = [
      makeQ({ question_number: 35, part: 'part3', group_id: 'g-miss' }),
      makeQ({ question_number: 36, part: 'part3', group_id: 'g-miss' }),
      makeQ({ question_number: 37, part: 'part3', group_id: 'g-miss' }),
    ];
    const groups = [
      makeG({ id: 'g-miss', part: 'part3', audio_url: null as any }),
    ];
    const m = getMediaCompleteness(groups, questions);
    expect(m.part3Audio.missing).toContain('Q35–37');
    // Must NOT contain a UUID
    expect(m.part3Audio.missing.some(x => typeof x === 'string' && x.includes('-') && x.length > 10)).toBe(false);
  });

  it('missing Part 4 group labels use Qxx–yy format, not UUID', () => {
    const questions = [
      makeQ({ question_number: 71, part: 'part4', group_id: 'g4-miss' }),
      makeQ({ question_number: 72, part: 'part4', group_id: 'g4-miss' }),
      makeQ({ question_number: 73, part: 'part4', group_id: 'g4-miss' }),
    ];
    const groups = [
      makeG({ id: 'g4-miss', part: 'part4', audio_url: null as any }),
    ];
    const m = getMediaCompleteness(groups, questions);
    expect(m.part4Audio.missing).toContain('Q71–73');
    expect(m.part4Audio.missing.some(x => typeof x === 'string' && x.includes('-') && x.length > 10)).toBe(false);
  });

  it('completeness counts remain unchanged', () => {
    // 6 Part 1 questions, 25 Part 2 questions, 13 Part 3 groups, 10 Part 4 groups
    const questions: ToeicTestQuestionInput[] = [];
    const groups: ToeicTestGroupInput[] = [];

    // Part 1: Q1–6
    for (let i = 1; i <= 6; i++) {
      questions.push(makeQ({ question_number: i, part: 'part1', image_url: 'img' as any, audio_url: 'aud' as any }));
    }
    // Part 2: Q7–31
    for (let i = 7; i <= 31; i++) {
      questions.push(makeQ({ question_number: i, part: 'part2', group_id: `g2-${i}`, audio_url: 'aud' as any }));
    }
    // Part 3: 13 groups of 3 questions each (Q32–70)
    for (let g = 0; g < 13; g++) {
      const gId = `g3-${g}`;
      groups.push(makeG({ id: gId, part: 'part3', audio_url: 'aud' as any }));
      for (let q = 0; q < 3; q++) {
        questions.push(makeQ({ question_number: 32 + g * 3 + q, part: 'part3', group_id: gId }));
      }
    }
    // Part 4: 10 groups of 3 questions each (Q71–100)
    for (let g = 0; g < 10; g++) {
      const gId = `g4-${g}`;
      groups.push(makeG({ id: gId, part: 'part4', audio_url: 'aud' as any }));
      for (let q = 0; q < 3; q++) {
        questions.push(makeQ({ question_number: 71 + g * 3 + q, part: 'part4', group_id: gId }));
      }
    }

    const m = getMediaCompleteness(groups, questions);
    expect(m.part1Images.expected).toBe(6);
    expect(m.part2Audio.expected).toBe(25);
    expect(m.part3Audio.expected).toBe(13);
    expect(m.part4Audio.expected).toBe(10);
    expect(m.publishReady).toBe(true);
  });
});
