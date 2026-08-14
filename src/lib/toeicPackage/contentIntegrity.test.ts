// ============================================================
// Phase P3.5G: Content Integrity & Placeholder Gate Unit Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { validateToeicContentIntegrity } from './contentIntegrity';
import { validateToeicPackage } from './validation';
import { importToeicPackage } from './packageImporter';
import { OriToeicPackageV1 } from './types';
import { extractLearningUnitsFromV2Package } from '../toeicV2/extractLearningUnits';

describe('Content Integrity & Placeholder Gate Suite', () => {
  it('A. P1 null / empty question_text is ALLOWED (heard in audio)', () => {
    const pkg: OriToeicPackageV1 = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Test P1', listening_audio_mode: 'segmented' },
      questions: [
        {
          question_number: 1,
          part: 'part1',
          question_text: '',
          options: [
            { label: 'A', text: '(A)' },
            { label: 'B', text: '(B)' },
            { label: 'C', text: '(C)' },
            { label: 'D', text: '(D)' },
          ],
          correct_answer: 'A',
        },
      ],
      groups: [],
      answers: [{ question_number: 1, correct_answer: 'A' }],
      media: [],
    };

    const report = validateToeicContentIntegrity(pkg);
    expect(report.isContentComplete).toBe(true);
    expect(report.blockers.length).toBe(0);
  });

  it('B. P2 null / empty question_text is ALLOWED for canonical Full Test (heard in audio)', () => {
    const pkg: OriToeicPackageV1 = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Test P2', listening_audio_mode: 'segmented' },
      questions: [
        {
          question_number: 7,
          part: 'part2',
          question_text: undefined,
          options: [
            { label: 'A', text: '(A)' },
            { label: 'B', text: '(B)' },
            { label: 'C', text: '(C)' },
          ],
          correct_answer: 'B',
        },
      ],
      groups: [],
      answers: [{ question_number: 7, correct_answer: 'B' }],
      media: [],
    };

    const report = validateToeicContentIntegrity(pkg);
    expect(report.isContentComplete).toBe(true);
    expect(report.blockers.length).toBe(0);
  });

  it('C. P3 "Question 32" produces BLOCKER', () => {
    const pkg: OriToeicPackageV1 = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Test P3', listening_audio_mode: 'segmented' },
      questions: [
        {
          question_number: 32,
          part: 'part3',
          question_text: 'Question 32',
          options: [
            { label: 'A', text: 'Option A' },
            { label: 'B', text: 'Option B' },
            { label: 'C', text: 'Option C' },
            { label: 'D', text: 'Option D' },
          ],
          correct_answer: 'C',
        },
      ],
      groups: [],
      answers: [{ question_number: 32, correct_answer: 'C' }],
      media: [],
    };

    const report = validateToeicContentIntegrity(pkg);
    expect(report.isContentComplete).toBe(false);
    expect(report.blockers.some((b) => b.code === 'PLACEHOLDER_QUESTION_TEXT')).toBe(true);
  });

  it('D. P3 "Option A" produces BLOCKER', () => {
    const pkg: OriToeicPackageV1 = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Test P3 Option', listening_audio_mode: 'segmented' },
      questions: [
        {
          question_number: 32,
          part: 'part3',
          question_text: 'What will the woman do next?',
          options: [
            { label: 'A', text: 'Option A' },
            { label: 'B', text: 'Option B' },
            { label: 'C', text: 'Option C' },
            { label: 'D', text: 'Option D' },
          ],
          correct_answer: 'A',
        },
      ],
      groups: [],
      answers: [{ question_number: 32, correct_answer: 'A' }],
      media: [],
    };

    const report = validateToeicContentIntegrity(pkg);
    expect(report.isContentComplete).toBe(false);
    expect(report.blockers.some((b) => b.code === 'PLACEHOLDER_OPTION_TEXT')).toBe(true);
  });

  it('E. P4 placeholder produces BLOCKER', () => {
    const pkg: OriToeicPackageV1 = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Test P4', listening_audio_mode: 'segmented' },
      questions: [
        {
          question_number: 71,
          part: 'part4',
          question_text: 'Question 71',
          options: [
            { label: 'A', text: 'Call the office' },
            { label: 'B', text: 'Email manager' },
            { label: 'C', text: 'Leave early' },
            { label: 'D', text: 'Wait inside' },
          ],
          correct_answer: 'B',
        },
      ],
      groups: [],
      answers: [{ question_number: 71, correct_answer: 'B' }],
      media: [],
    };

    const report = validateToeicContentIntegrity(pkg);
    expect(report.isContentComplete).toBe(false);
    expect(report.blockers.some((b) => b.code === 'PLACEHOLDER_QUESTION_TEXT')).toBe(true);
  });

  it('F. P5 Question 101 + Option A produces BLOCKER', () => {
    const pkg: OriToeicPackageV1 = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Test P5 Placeholder', listening_audio_mode: 'segmented' },
      questions: [
        {
          question_number: 101,
          part: 'part5',
          question_text: 'Question 101',
          options: [
            { label: 'A', text: 'Option A' },
            { label: 'B', text: 'Option B' },
            { label: 'C', text: 'Option C' },
            { label: 'D', text: 'Option D' },
          ],
          correct_answer: 'D',
        },
      ],
      groups: [],
      answers: [{ question_number: 101, correct_answer: 'D' }],
      media: [],
    };

    const report = validateToeicContentIntegrity(pkg);
    expect(report.isContentComplete).toBe(false);
    expect(report.blockers.length).toBeGreaterThan(0);
  });

  it('G. P6 placeholder passage produces BLOCKER', () => {
    const pkg: OriToeicPackageV1 = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Test P6 Passage', listening_audio_mode: 'segmented' },
      questions: [],
      groups: [
        {
          group_index: 101,
          start_question: 131,
          end_question: 134,
          part: 'part6',
          group_type: 'text_completion',
          passage: 'Passage for questions 131-134',
        },
      ],
      answers: [],
      media: [],
    };

    const report = validateToeicContentIntegrity(pkg);
    expect(report.isContentComplete).toBe(false);
    expect(report.blockers.some((b) => b.code === 'PLACEHOLDER_PASSAGE')).toBe(true);
  });

  it('H. P7 "Single Document" / "Single Passage content for Q147-148" produces BLOCKER', () => {
    const pkg: OriToeicPackageV1 = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Test P7 Document', listening_audio_mode: 'segmented' },
      questions: [],
      groups: [
        {
          group_index: 201,
          start_question: 147,
          end_question: 148,
          part: 'part7',
          group_type: 'reading_set',
          passage: 'Single Passage content for Q147–148',
          documents: [{ title: 'Doc 1', content: 'Single Document' }],
        },
      ],
      answers: [],
      media: [],
    };

    const report = validateToeicContentIntegrity(pkg);
    expect(report.isContentComplete).toBe(false);
    expect(report.blockers.some((b) => b.code === 'PLACEHOLDER_PASSAGE' || b.code === 'PLACEHOLDER_DOCUMENT')).toBe(true);
  });

  it('I. Real natural Reading content passes content integrity check', () => {
    const pkg: OriToeicPackageV1 = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Real Test 5', listening_audio_mode: 'segmented' },
      questions: [
        {
          question_number: 101,
          part: 'part5',
          question_text: 'The company plans to _____ its main headquarters to Chicago next month.',
          options: [
            { label: 'A', text: 'relocate' },
            { label: 'B', text: 'relocation' },
            { label: 'C', text: 'relocates' },
            { label: 'D', text: 'relocating' },
          ],
          correct_answer: 'A',
        },
      ],
      groups: [
        {
          group_index: 201,
          start_question: 147,
          end_question: 148,
          part: 'part7',
          group_type: 'reading_set',
          passage: 'Dear Employees, Please be aware that the main lobby will be closed for maintenance tomorrow from 8 AM to 5 PM.',
          documents: [{ title: 'Notice', content: 'Dear Employees, Please be aware that the main lobby will be closed for maintenance tomorrow from 8 AM to 5 PM.' }],
        },
      ],
      answers: [{ question_number: 101, correct_answer: 'A' }],
      media: [],
    };

    const report = validateToeicContentIntegrity(pkg);
    expect(report.isContentComplete).toBe(true);
    expect(report.blockers.length).toBe(0);
  });

  it('J. 200 structurally valid questions with placeholders sets isValidForDraft = false', () => {
    const questions: any[] = [];
    for (let i = 1; i <= 200; i++) {
      let part = 'part1';
      if (i >= 7 && i <= 31) part = 'part2';
      else if (i >= 32 && i <= 70) part = 'part3';
      else if (i >= 71 && i <= 100) part = 'part4';
      else if (i >= 101 && i <= 130) part = 'part5';
      else if (i >= 131 && i <= 146) part = 'part6';
      else if (i >= 147 && i <= 200) part = 'part7';

      questions.push({
        question_number: i,
        part,
        question_text: i <= 31 ? '' : `Question ${i}`,
        options: i <= 31 ? [{ label: 'A', text: '(A)' }, { label: 'B', text: '(B)' }, { label: 'C', text: '(C)' }] : [{ label: 'A', text: 'Option A' }, { label: 'B', text: 'Option B' }, { label: 'C', text: 'Option C' }, { label: 'D', text: 'Option D' }],
        correct_answer: 'A',
      });
    }

    const pkg: OriToeicPackageV1 = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Test 200 Stubs', listening_audio_mode: 'segmented' },
      questions,
      groups: [],
      answers: Array.from({ length: 200 }, (_, idx) => ({ question_number: idx + 1, correct_answer: 'A' as const })),
      media: [],
    };

    const report = validateToeicPackage(pkg);
    expect(report.isValidForDraft).toBe(false);
    expect(report.blockers.length).toBeGreaterThan(0);
  });

  it('K. importToeicPackage called with placeholder package is BLOCKED BEFORE RPC', async () => {
    const pkg: OriToeicPackageV1 = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Test Placeholder Import', listening_audio_mode: 'segmented' },
      questions: [
        {
          question_number: 101,
          part: 'part5',
          question_text: 'Question 101',
          options: [
            { label: 'A', text: 'Option A' },
            { label: 'B', text: 'Option B' },
            { label: 'C', text: 'Option C' },
            { label: 'D', text: 'Option D' },
          ],
          correct_answer: 'A',
        },
      ],
      groups: [],
      answers: [{ question_number: 101, correct_answer: 'A' }],
      media: [],
    };

    const result = await importToeicPackage(pkg, { isDryRun: false });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Gói đề thi chứa các lỗi nghẽn');
  });

  it('M. Part 5 classifier does not classify placeholder content', () => {
    const pkg: any = {
      schema_version: 'ori.toeic.package.v1',
      test: { title: 'Test', listening_audio_mode: 'segmented' },
      questions: [
        {
          question_number: 101,
          part: 'part5',
          question_text: 'Question 101',
          options: [
            { label: 'A', text: 'Option A' },
            { label: 'B', text: 'Option B' },
            { label: 'C', text: 'Option C' },
            { label: 'D', text: 'Option D' },
          ],
          correct_answer: 'A',
        },
      ],
    };

    const data = extractLearningUnitsFromV2Package(pkg);
    expect(data.links.some((l) => l.question_number === 101)).toBe(false);
  });
});
