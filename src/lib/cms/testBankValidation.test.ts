import { describe, it, expect } from 'vitest';
import {
  expectedPartForQuestionNumber,
  isQuestionNumberValidForPart,
} from '../toeic/testStructure';
import {
  validateToeicTestGroup,
  validateToeicTestQuestion,
  validateToeicTestForPublish,
  shouldRotateTestQuestionIdentity,
} from './testBankValidation';
import * as adminTestBank from '../supabase/adminTestBank';

describe('Phase 3.5C — TOEIC Test Bank Validation & Structure Tests', () => {
  it('CASE A-G: Question Number Range Mapping (Parts 1 to 7)', () => {
    expect(expectedPartForQuestionNumber(3)).toBe('part1');
    expect(isQuestionNumberValidForPart(3, 'part1')).toBe(true);

    expect(expectedPartForQuestionNumber(15)).toBe('part2');
    expect(isQuestionNumberValidForPart(15, 'part2')).toBe(true);

    expect(expectedPartForQuestionNumber(50)).toBe('part3');
    expect(isQuestionNumberValidForPart(50, 'part3')).toBe(true);

    expect(expectedPartForQuestionNumber(85)).toBe('part4');
    expect(isQuestionNumberValidForPart(85, 'part4')).toBe(true);

    expect(expectedPartForQuestionNumber(120)).toBe('part5');
    expect(isQuestionNumberValidForPart(120, 'part5')).toBe(true);

    expect(expectedPartForQuestionNumber(140)).toBe('part6');
    expect(isQuestionNumberValidForPart(140, 'part6')).toBe(true);

    expect(expectedPartForQuestionNumber(175)).toBe('part7');
    expect(isQuestionNumberValidForPart(175, 'part7')).toBe(true);
  });

  it('CASE H & I: Invalid Question Numbers (0 and 201)', () => {
    expect(expectedPartForQuestionNumber(0)).toBeNull();
    expect(isQuestionNumberValidForPart(0, 'part1')).toBe(false);

    expect(expectedPartForQuestionNumber(201)).toBeNull();
    expect(isQuestionNumberValidForPart(201, 'part7')).toBe(false);
  });

  it('CASE J: Duplicate Question Number Detection', () => {
    const test = { title: 'TOEIC Full 1', slug: 'toeic-full-1', test_type: 'full' as const };
    const questions = [
      { question_number: 1, part: 'part1', options: ['A', 'B', 'C', 'D'], correct_answer: 'A' },
      { question_number: 1, part: 'part1', options: ['A', 'B', 'C', 'D'], correct_answer: 'B' },
    ];
    const pubVal = validateToeicTestForPublish(test, [], questions);
    expect(pubVal.isValid).toBe(false);
    expect(pubVal.errors.some((e) => e.includes('Trùng lặp số thứ tự'))).toBe(true);
  });

  it('CASE K & L: Part 2 Option Count (3 options) vs Other Parts (4 options)', () => {
    // Part 2 with 3 options -> Valid
    const p2Val = validateToeicTestQuestion({
      question_number: 10,
      part: 'part2',
      options: ['(A) Option A', '(B) Option B', '(C) Option C'],
      correct_answer: '(A) Option A',
    });
    expect(p2Val.isValid).toBe(true);

    // Part 2 with 4 options -> Invalid
    const p2Invalid = validateToeicTestQuestion({
      question_number: 10,
      part: 'part2',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
    });
    expect(p2Invalid.isValid).toBe(false);

    // Part 5 with 4 options -> Valid
    const p5Val = validateToeicTestQuestion({
      question_number: 105,
      part: 'part5',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
    });
    expect(p5Val.isValid).toBe(true);
  });

  it('CASE M: Correct Answer Must Exist in Options', () => {
    const invalidAns = validateToeicTestQuestion({
      question_number: 105,
      part: 'part5',
      options: ['(A) Alpha', '(B) Beta', '(C) Gamma', '(D) Delta'],
      correct_answer: '(E) Epsilon',
    });
    expect(invalidAns.isValid).toBe(false);
    expect(invalidAns.errors[0]).toContain('Đáp án đúng phải nằm trong danh sách các lựa chọn');
  });

  it('CASE N: Part 7 Documents Array Data Accepted', () => {
    const groupVal = validateToeicTestGroup({
      part: 'part7',
      group_type: 'reading_set',
      documents: [
        { document_type: 'email', title: 'HR Email', body: 'Please read this.' },
        { document_type: 'notice', title: 'Schedule Change', body: 'Effective tomorrow.' },
      ],
    });
    expect(groupVal.isValid).toBe(true);
  });

  it('CASE O & P: Full Test Completeness Validation (<200 incomplete vs 200 complete)', () => {
    const test = { title: 'TOEIC Full 1', slug: 'toeic-full-1', test_type: 'full' as const };

    // 1 question -> Incomplete (O)
    const partialQs = [
      { question_number: 1, part: 'part1', options: ['A', 'B', 'C', 'D'], correct_answer: 'A' },
    ];
    const pubIncomplete = validateToeicTestForPublish(test, [], partialQs);
    expect(pubIncomplete.isValid).toBe(false);
    expect(pubIncomplete.missingNumbers.length).toBe(199);

    // Construct full 200 questions -> Complete (P)
    const fullQs: any[] = [];
    for (let i = 1; i <= 200; i++) {
      const part = expectedPartForQuestionNumber(i)!;
      const opts = part === 'part2' ? ['(A) Opt 1', '(B) Opt 2', '(C) Opt 3'] : ['(A) Opt 1', '(B) Opt 2', '(C) Opt 3', '(D) Opt 4'];
      fullQs.push({
        question_number: i,
        part,
        options: opts,
        correct_answer: opts[0],
      });
    }

    const pubComplete = validateToeicTestForPublish(test, [], fullQs);
    expect(pubComplete.isValid).toBe(true);
    expect(pubComplete.missingNumbers.length).toBe(0);
  });

  it('CASE R & S: Non-material vs Material Identity Rotation Detection', () => {
    const origQ = {
      question_number: 101,
      part: 'part5',
      question_text: 'Original question text?',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
      explanation: 'Old explanation',
    };

    // Non-material edit (explanation/skill_tag) -> shouldRotate = false (R)
    const nonMaterialEdit = { ...origQ, explanation: 'New explanation' };
    expect(shouldRotateTestQuestionIdentity(origQ, nonMaterialEdit)).toBe(false);

    // Material edit (question_text) -> shouldRotate = true (S)
    const materialEdit = { ...origQ, question_text: 'Edited question text?' };
    expect(shouldRotateTestQuestionIdentity(origQ, materialEdit)).toBe(true);
  });

  it('CASE T: No Delete Mutations Exported in adminTestBank.ts', () => {
    const exportedKeys = Object.keys(adminTestBank);
    const deleteFuncs = exportedKeys.filter((k) => k.toLowerCase().includes('delete'));
    expect(deleteFuncs).toEqual([]);
  });
});
