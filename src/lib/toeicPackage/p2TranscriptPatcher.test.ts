// ============================================================
// Phase P3.5G: Part 2 Audio Transcript Patcher Unit & Integration Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { buildOriToeicPackage } from './packageBuilder';
import { validateAndPatchPart2Transcripts } from './p2TranscriptPatcher';
import { classifyPart2Question } from '../toeicV2/part2Classifier';
import { RawPackageSources } from './types';

describe('Part 2 Audio Transcript Patcher & Classifier Integration Suite', () => {
  const mockRawSources: RawPackageSources = {
    listeningPdfText: 'PART 1 ... PART 2 ... PART 3 ... PART 4 ...',
    readingPdfText: 'PART 5 ... PART 6 ... PART 7 ...',
    answerKeyText: Array.from({ length: 200 }, (_, i) => `${i + 1}. A`).join('\n'),
    audioFiles: [],
    part1PdfCroppedImages: {},
  };

  it('F & G. P2 empty questionText allows Full Test to PASS, but classifier returns NEEDS_TRANSCRIPT when empty', () => {
    const pkg = buildOriToeicPackage(mockRawSources, 'Test P2');
    const q7 = pkg.questions.find((q) => q.question_number === 7);

    expect(q7?.question_text).toBeFalsy(); // Empty question_text allowed for Full Test P2

    const classification = classifyPart2Question({
      question_number: 7,
      part: 'part2',
      transcript: q7?.question_text,
    });

    expect(classification.approval_status).toBe('NEEDS_TRANSCRIPT');
  });

  it('H. Valid P2 transcript for Q7 imports successfully and classifies WHEN prompt', () => {
    const pkg = buildOriToeicPackage(mockRawSources, 'Test P2 Valid');

    const validPayload = {
      source: 'P2_AUDIO_TRANSCRIPT',
      questions: [
        {
          questionNumber: 7,
          promptText: 'When will the new manager arrive?',
          responses: {
            A: 'At the main entrance.',
            B: 'Sometime this afternoon.',
            C: 'Yes, she manages it.',
          },
        },
      ],
    };

    const res = validateAndPatchPart2Transcripts(pkg, JSON.stringify(validPayload));

    expect(res.success).toBe(true);
    expect(res.patchedCount).toBe(1);
    expect(res.classifications[7].question_type).toBe('WHEN');
    expect(res.classifications[7].primary_topic).toBe('TIME_SCHEDULE');

    // SECURITY CHECK: active question_text must NOT be mutated into transcript during exam
    const patchedQ7 = res.patchedPkg.questions.find((q) => q.question_number === 7);
    expect(patchedQ7?.question_text).toBeFalsy();
    expect(patchedQ7?.transcript).toBe('When will the new manager arrive?');
  });

  it('I. P2 transcript containing Choice D is REJECTED', () => {
    const pkg = buildOriToeicPackage(mockRawSources, 'Test P2 Choice D');

    const payloadWithD = {
      questions: [
        {
          questionNumber: 7,
          promptText: 'Where is the meeting room?',
          responses: {
            A: 'On the second floor.',
            B: 'At 3 PM.',
            C: 'Yes, it is.',
            D: 'Choice D is invalid in Part 2',
          },
        },
      ],
    };

    const res = validateAndPatchPart2Transcripts(pkg, JSON.stringify(payloadWithD));

    expect(res.success).toBe(false);
    expect(res.errors.some((e) => e.includes('lựa chọn D'))).toBe(true);
  });

  it('J. Duplicate P2 question numbers in transcript packet are REJECTED', () => {
    const pkg = buildOriToeicPackage(mockRawSources, 'Test P2 Duplicate');

    const duplicatePayload = {
      questions: [
        {
          questionNumber: 7,
          promptText: 'When is the event?',
          responses: { A: 'A', B: 'B', C: 'C' },
        },
        {
          questionNumber: 7,
          promptText: 'Duplicate Q7 item',
          responses: { A: 'A', B: 'B', C: 'C' },
        },
      ],
    };

    const res = validateAndPatchPart2Transcripts(pkg, JSON.stringify(duplicatePayload));

    expect(res.success).toBe(false);
    expect(res.errors.some((e) => e.includes('bị lặp lại'))).toBe(true);
  });

  it('K. Q32 present in P2 transcript packet is REJECTED', () => {
    const pkg = buildOriToeicPackage(mockRawSources, 'Test P2 Q32');

    const outOfBoundsPayload = {
      questions: [
        {
          questionNumber: 32,
          promptText: 'Q32 belongs to Part 3',
          responses: { A: 'A', B: 'B', C: 'C' },
        },
      ],
    };

    const res = validateAndPatchPart2Transcripts(pkg, JSON.stringify(outOfBoundsPayload));

    expect(res.success).toBe(false);
    expect(res.errors.some((e) => e.includes('nằm ngoài phạm vi Part 2'))).toBe(true);
  });

  it('L, M, N, O. Part 2 classifier correctly classifies WHEN, REQUEST, and STATEMENT prompts', () => {
    const whenRes = classifyPart2Question({
      question_number: 8,
      part: 'part2',
      transcript: 'When is the deadline for the report?',
      responses: { A: 'Tomorrow morning.', B: 'Yes.', C: 'By email.' },
    });
    expect(whenRes.question_type).toBe('WHEN');

    const reqRes = classifyPart2Question({
      question_number: 9,
      part: 'part2',
      transcript: 'Could you please pass me the folder?',
      responses: { A: 'Sure, here you go.', B: 'Yes, I did.', C: 'No thanks.' },
    });
    expect(reqRes.question_type).toBe('REQUEST');

    const stmtRes = classifyPart2Question({
      question_number: 10,
      part: 'part2',
      transcript: 'The printer on the third floor is out of paper.',
      responses: { A: 'I will load some right now.', B: 'Yes, it printer.', C: 'At noon.' },
    });
    expect(stmtRes.question_type).toBe('STATEMENT');
  });

  it('P, Q, R. Post-submission / review security check: active exam displays audio choices only, transcript accessible via script property', () => {
    const pkg = buildOriToeicPackage(mockRawSources, 'Test P2 Security');

    const validPayload = {
      questions: [
        {
          questionNumber: 15,
          promptText: 'Who will lead the orientation session?',
          responses: { A: 'Ms. Davis.', B: 'Room 302.', C: 'It was great.' },
        },
      ],
    };

    const res = validateAndPatchPart2Transcripts(pkg, JSON.stringify(validPayload));
    const q15 = res.patchedPkg.questions.find((q) => q.question_number === 15);

    // Active test question_text must remain empty so exam renders audio player + (A) (B) (C) buttons
    expect(q15?.question_text).toBeFalsy();
    // Transcript is attached to .transcript property for post-submission review
    expect(q15?.transcript).toBe('Who will lead the orientation session?');
  });
});
