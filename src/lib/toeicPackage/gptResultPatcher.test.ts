// ============================================================
// Phase P3.5G: GPT Result Patcher & Complete Import Integration Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { buildOriToeicPackage } from './packageBuilder';
import { validateToeicPackage } from './validation';
import { patchOriToeicPackageWithGptResult } from './gptResultPatcher';
import { RawPackageSources } from './types';

describe('GPT Result Patcher & Complete Import Integration Suite', () => {
  const mockRawSources: RawPackageSources = {
    listeningPdfText: 'PART 1 ... PART 2 ... PART 3 ... PART 4 ...', // PDF scan placeholder generators
    readingPdfText: 'PART 5 ... PART 6 ... PART 7 ...',
    answerKeyText: Array.from({ length: 200 }, (_, i) => `${i + 1}. A`).join('\n'),
    audioFiles: [],
    part1PdfCroppedImages: {},
  };

  it('A & B. Scanned/Image-only PDF builds structural 200/200 but content is incomplete (placeholder count = 169)', () => {
    const pkg = buildOriToeicPackage(mockRawSources, 'Test 1 Scanned');
    const val = validateToeicPackage(pkg);

    expect(pkg.questions.length).toBe(200);
    expect(val.counts.realContentQuestionsCount).toBe(31);
    expect(val.counts.placeholderQuestionsCount).toBe(169);
    expect(val.isValidForDraft).toBe(false);
  });

  it('D & E. Merging Reading GPT result Q101-Q200 patches Reading content while P3/P4 remain placeholders', () => {
    const pkg = buildOriToeicPackage(mockRawSources, 'Test 1');

    const readingGptPayload = {
      schemaVersion: 1,
      questions: Array.from({ length: 100 }, (_, i) => {
        const qNum = 101 + i;
        let part = 'part5';
        if (qNum >= 131 && qNum <= 146) part = 'part6';
        if (qNum >= 147 && qNum <= 200) part = 'part7';
        return {
          questionNumber: qNum,
          part,
          questionText: `Real extracted reading question text for Q${qNum}`,
          options: {
            A: `Choice A for Q${qNum}`,
            B: `Choice B for Q${qNum}`,
            C: `Choice C for Q${qNum}`,
            D: `Choice D for Q${qNum}`,
          },
          correctAnswer: 'A',
        };
      }),
      groups: [
        {
          startQuestion: 131,
          endQuestion: 134,
          passage: 'Real Part 6 article passage text content for Q131-134...',
        },
        {
          startQuestion: 147,
          endQuestion: 148,
          passage: 'Real Part 7 notice passage text for Q147-148...',
          documents: [{ title: 'Notice', content: 'Real Part 7 notice content' }],
        },
      ],
    };

    const res = patchOriToeicPackageWithGptResult(pkg, JSON.stringify(readingGptPayload));

    expect(res.success).toBe(true);
    expect(res.patchedQuestionsCount).toBe(100);
    expect(res.report.counts.realContentQuestionsCount).toBe(131); // 31 + 100
    expect(res.report.counts.placeholderQuestionsCount).toBe(69); // P3 (39) + P4 (30) = 69 remain
    expect(res.report.isValidForDraft).toBe(false); // Still blocked by P3/P4
  });

  it('F & G. Merging Listening P3/P4 GPT result after Reading completes all 200/200 real content', () => {
    const pkg = buildOriToeicPackage(mockRawSources, 'Test 1');

    // 1. Merge Reading
    const readingPayload = {
      questions: Array.from({ length: 100 }, (_, i) => ({
        questionNumber: 101 + i,
        questionText: `Real Reading Q${101 + i}`,
        options: { A: 'A', B: 'B', C: 'C', D: 'D' },
      })),
      groups: [
        { startQuestion: 131, endQuestion: 134, passage: 'Real P6 passage' },
        { startQuestion: 135, endQuestion: 138, passage: 'Real P6 passage 2' },
        { startQuestion: 139, endQuestion: 142, passage: 'Real P6 passage 3' },
        { startQuestion: 143, endQuestion: 146, passage: 'Real P6 passage 4' },
        ...[
          [147, 148], [149, 150], [151, 152], [153, 154],
          [155, 157], [158, 160], [161, 163],
          [164, 167], [168, 171], [172, 175],
          [176, 180], [181, 185],
          [186, 190], [191, 195], [196, 200]
        ].map(([startQ, endQ]) => ({
          startQuestion: startQ,
          endQuestion: endQ,
          passage: `Real P7 passage for Q${startQ}-${endQ}`,
          documents: [{ title: 'Doc 1', content: `Real P7 content Q${startQ}-${endQ}` }],
        })),
      ],
    };

    const res1 = patchOriToeicPackageWithGptResult(pkg, JSON.stringify(readingPayload));

    // 2. Merge Listening P3/P4 (Q32-Q100: 69 questions)
    const listeningPayload = {
      questions: Array.from({ length: 69 }, (_, i) => ({
        questionNumber: 32 + i,
        questionText: `Real Listening printed question text Q${32 + i}?`,
        options: { A: 'Option choice A', B: 'Option choice B', C: 'Option choice C', D: 'Option choice D' },
      })),
    };

    const res2 = patchOriToeicPackageWithGptResult(res1.patchedPkg, JSON.stringify(listeningPayload));

    expect(res2.success).toBe(true);
    expect(res2.report.counts.realContentQuestionsCount).toBe(200);
    expect(res2.report.counts.placeholderQuestionsCount).toBe(0);
  });

  it('H, I, J. GPT merge preserves answers, media, group_type, and question numbers', () => {
    const pkg = buildOriToeicPackage(mockRawSources, 'Test 1 Preservation');

    // Set specific answer and media on Q101 before merge
    pkg.answers = Array.from({ length: 200 }, (_, i) => ({ question_number: i + 1, correct_answer: 'B' as const }));
    const originalAnswers = [...pkg.answers];
    const originalGroupTypes = pkg.groups.map((g) => ({ group_index: g.group_index, group_type: g.group_type }));

    const patchPayload = {
      questions: [
        {
          questionNumber: 101,
          questionText: 'Patched Real Q101',
          options: { A: 'X', B: 'Y', C: 'Z', D: 'W' },
        },
      ],
    };

    const res = patchOriToeicPackageWithGptResult(pkg, JSON.stringify(patchPayload));

    expect(res.patchedPkg.answers).toEqual(originalAnswers);
    res.patchedPkg.groups.forEach((g) => {
      const orig = originalGroupTypes.find((x) => x.group_index === g.group_index);
      expect(g.group_type).toBe(orig?.group_type);
    });
  });

  it('K & L. Malformed JSON or invalid question numbers are handled safely without crashing', () => {
    const pkg = buildOriToeicPackage(mockRawSources, 'Test 1 Malformed');

    const invalidJsonRes = patchOriToeicPackageWithGptResult(pkg, 'NOT_VALID_JSON');
    expect(invalidJsonRes.success).toBe(false);
    expect(invalidJsonRes.errors[0]).toContain('Lỗi cú pháp JSON');

    const outOfBoundsPayload = {
      questions: [{ questionNumber: 999, questionText: 'Out of bounds' }],
    };

    const outOfBoundsRes = patchOriToeicPackageWithGptResult(pkg, JSON.stringify(outOfBoundsPayload));
    expect(outOfBoundsRes.success).toBe(true);
    expect(outOfBoundsRes.warnings.length).toBeGreaterThan(0);
  });
});
