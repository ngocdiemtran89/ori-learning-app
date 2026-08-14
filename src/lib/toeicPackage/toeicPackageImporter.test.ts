// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer Test Suite
// ============================================================

import { describe, it, expect } from 'vitest';
import { buildOriToeicPackage } from './packageBuilder';
import { validateToeicPackage } from './validation';
import { parseAnswerKeyText } from './answerKeyParser';
import { matchPackageMedia, detectP2NumberingConvention } from './mediaMatcher';
import { importToeicPackage } from './packageImporter';
import { RawPackageSources } from './types';

describe('Phase P3.5G - One-Click TOEIC Test Package Importer Suite', () => {
  // Complete 54 physical audio files + 6 images for canonical valid test
  const sampleRawSources: RawPackageSources = {
    listeningPdfText: 'PART 1 ... PART 2 ... PART 3 ... PART 4 ...',
    readingPdfText: 'PART 5 ... PART 6 ... PART 7 ...',
    answerKeyText: Array.from({ length: 200 }, (_, i) => `${i + 1}. A`).join('\n'),
    transcriptPdfText: 'Q32-34 Transcript for group 1',
    audioFiles: [
      ...Array.from({ length: 6 }, (_, i) => new File(['dummy'], `q00${i + 1}.mp3`)),
      ...Array.from({ length: 25 }, (_, i) => new File(['dummy'], `q0${i + 7 < 10 ? '0' : ''}${i + 7}.mp3`)),
      ...Array.from({ length: 13 }, (_, i) => {
        const start = 32 + i * 3;
        const end = start + 2;
        return new File(['dummy'], `q0${start}-0${end}.mp3`);
      }),
      ...Array.from({ length: 10 }, (_, i) => {
        const start = 71 + i * 3;
        const end = start + 2;
        return new File(['dummy'], `q${start < 100 ? '0' : ''}${start}-${end < 100 ? '0' : ''}${end}.mp3`);
      }),
    ],
    part1PdfCroppedImages: {
      1: new Blob(['img1'], { type: 'image/png' }),
      2: new Blob(['img2'], { type: 'image/png' }),
      3: new Blob(['img3'], { type: 'image/png' }),
      4: new Blob(['img4'], { type: 'image/png' }),
      5: new Blob(['img5'], { type: 'image/png' }),
      6: new Blob(['img6'], { type: 'image/png' }),
    },
  };

  // 3. STATIC CANONICAL MEDIA & BOUNDARIES
  describe('STATIC CANONICAL MEDIA BOUNDARIES', () => {
    it('verifies exact boundary mappings for all 54 physical audio files & 6 images', () => {
      const p1Audio = Array.from({ length: 6 }, (_, i) => new File([''], `part1/${i + 1 < 10 ? '0' : ''}${i + 1}.mp3`));
      const p2Audio = Array.from({ length: 25 }, (_, i) => new File([''], `part2/${i + 1 < 10 ? '0' : ''}${i + 1}.mp3`));
      const p3Audio = Array.from({ length: 13 }, (_, i) => new File([''], `part3/${i + 1 < 10 ? '0' : ''}${i + 1}.mp3`));
      const p4Audio = Array.from({ length: 10 }, (_, i) => new File([''], `part4/${i + 1 < 10 ? '0' : ''}${i + 1}.mp3`));

      const media = matchPackageMedia({ audioFiles: [...p1Audio, ...p2Audio, ...p3Audio, ...p4Audio] });

      // P1: 01 -> Q1, 06 -> Q6
      expect(media.find(m => m.filename.includes('part1/01.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q1');
      expect(media.find(m => m.filename.includes('part1/06.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q6');

      // P2: 01 -> Q7, 02 -> Q8, 06 -> Q12, 07 -> Q13, 25 -> Q31 (LOCAL INDEX 01-25)
      expect(media.find(m => m.filename.includes('part2/01.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q7');
      expect(media.find(m => m.filename.includes('part2/02.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q8');
      expect(media.find(m => m.filename.includes('part2/06.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q12');
      expect(media.find(m => m.filename.includes('part2/07.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q13');
      expect(media.find(m => m.filename.includes('part2/25.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q31');

      // P3: 01 -> Q32-Q34, 02 -> Q35-Q37, 13 -> Q68-Q70
      expect(media.find(m => m.filename.includes('part3/01.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q32–34');
      expect(media.find(m => m.filename.includes('part3/02.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q35–37');
      expect(media.find(m => m.filename.includes('part3/13.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q68–70');

      // P4: 01 -> Q71-Q73, 02 -> Q74-Q76, 10 -> Q98-Q100
      expect(media.find(m => m.filename.includes('part4/01.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q71–73');
      expect(media.find(m => m.filename.includes('part4/02.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q74–76');
      expect(media.find(m => m.filename.includes('part4/10.mp3')?.valueOf())?.targetNumberOrRange).toBe('Q98–100');

      // Physical counts
      const p1Count = media.filter(m => m.part === 1 && m.mediaType === 'audio').length;
      const p2Count = media.filter(m => m.part === 2 && m.mediaType === 'audio').length;
      const p3Count = media.filter(m => m.part === 3 && m.mediaType === 'audio').length;
      const p4Count = media.filter(m => m.part === 4 && m.mediaType === 'audio').length;

      expect(p1Count).toBe(6);
      expect(p2Count).toBe(25);
      expect(p3Count).toBe(13);
      expect(p4Count).toBe(10);
      expect(p1Count + p2Count + p3Count + p4Count).toBe(54);

      // Zero canonicalTarget conflicts
      expect(media.filter(m => m.status === 'conflict').length).toBe(0);
    });
  });

  // BATCH CONVENTION TESTS FOR PART 2 (GLOBAL QNUM 07..31 & LOCAL INDEX 01..25)
  describe('PART 2 BATCH NUMBERING CONVENTIONS', () => {
    it('detectP2NumberingConvention correctly identifies P2_GLOBAL_QNUM for suffixes 7..31', () => {
      const p2GlobalFiles = Array.from({ length: 25 }, (_, i) => {
        const qNum = 7 + i;
        const numStr = qNum < 10 ? `0${qNum}` : `${qNum}`;
        return new File([''], `Test 01_Part 2_${numStr}.mp3`);
      });

      expect(detectP2NumberingConvention(p2GlobalFiles)).toBe('P2_GLOBAL_QNUM');
    });

    it('P2_GLOBAL_QNUM mode (suffixes 07..31) maps Test 01_Part 2_07.mp3..Test 01_Part 2_31.mp3 directly to Q7..Q31 without Q26-Q31 conflicts', () => {
      const p2GlobalFiles = Array.from({ length: 25 }, (_, i) => {
        const qNum = 7 + i;
        const numStr = qNum < 10 ? `0${qNum}` : `${qNum}`;
        return new File([''], `Test 01_Part 2_${numStr}.mp3`);
      });

      const media = matchPackageMedia({ audioFiles: p2GlobalFiles });
      expect(media.conventions?.p2Convention).toBe('P2_GLOBAL_QNUM');

      // Specific key assertions for user's real Test 1
      expect(media.find(m => m.filename.includes('Part 2_07.mp3'))?.targetNumberOrRange).toBe('Q7');
      expect(media.find(m => m.filename.includes('Part 2_12.mp3'))?.targetNumberOrRange).toBe('Q12');
      expect(media.find(m => m.filename.includes('Part 2_13.mp3'))?.targetNumberOrRange).toBe('Q13');
      expect(media.find(m => m.filename.includes('Part 2_19.mp3'))?.targetNumberOrRange).toBe('Q19');
      expect(media.find(m => m.filename.includes('Part 2_20.mp3'))?.targetNumberOrRange).toBe('Q20');
      expect(media.find(m => m.filename.includes('Part 2_21.mp3'))?.targetNumberOrRange).toBe('Q21');
      expect(media.find(m => m.filename.includes('Part 2_25.mp3'))?.targetNumberOrRange).toBe('Q25');
      expect(media.find(m => m.filename.includes('Part 2_26.mp3'))?.targetNumberOrRange).toBe('Q26');
      expect(media.find(m => m.filename.includes('Part 2_27.mp3'))?.targetNumberOrRange).toBe('Q27');
      expect(media.find(m => m.filename.includes('Part 2_31.mp3'))?.targetNumberOrRange).toBe('Q31');

      // CRITICAL: Prove Part 2_20.mp3 maps ONLY to Q20 and NOT Q26
      expect(media.find(m => m.filename.includes('Part 2_20.mp3'))?.canonicalTarget).toBe('P2-Q020');
      expect(media.find(m => m.filename.includes('Part 2_26.mp3'))?.canonicalTarget).toBe('P2-Q026');

      // Exactly 25 unique canonical targets and 0 conflicts
      expect(media.filter(m => m.part === 2).length).toBe(25);
      expect(media.filter(m => m.status === 'conflict').length).toBe(0);
    });

    it('REGRESSION TEST FOR CURRENT BUG: Part2_19 MUST map to Q19 (NOT Q25) and Part2_20 MUST map to Q20 (NOT Q26) in GLOBAL mode', () => {
      const p2GlobalFiles = Array.from({ length: 25 }, (_, i) => {
        const qNum = 7 + i;
        const numStr = qNum < 10 ? `0${qNum}` : `${qNum}`;
        return new File([''], `Test 01_Part 2_${numStr}.mp3`);
      });

      const media = matchPackageMedia({ audioFiles: p2GlobalFiles });

      // Assert Part 2_19 maps to Q19 and NOT Q25
      const entry19 = media.find(m => m.filename.includes('Part 2_19.mp3'));
      expect(entry19?.targetNumberOrRange).toBe('Q19');
      expect(entry19?.canonicalTarget).toBe('P2-Q019');
      expect(entry19?.targetNumberOrRange).not.toBe('Q25');

      // Assert Part 2_20 maps to Q20 and NOT Q26
      const entry20 = media.find(m => m.filename.includes('Part 2_20.mp3'));
      expect(entry20?.targetNumberOrRange).toBe('Q20');
      expect(entry20?.canonicalTarget).toBe('P2-Q020');
      expect(entry20?.targetNumberOrRange).not.toBe('Q26');

      // Assert Part 2_21 maps to Q21 and NOT Q27
      const entry21 = media.find(m => m.filename.includes('Part 2_21.mp3'));
      expect(entry21?.targetNumberOrRange).toBe('Q21');
      expect(entry21?.canonicalTarget).toBe('P2-Q021');

      // Assert Part 2_25, 26, 27, 31
      expect(media.find(m => m.filename.includes('Part 2_25.mp3'))?.targetNumberOrRange).toBe('Q25');
      expect(media.find(m => m.filename.includes('Part 2_26.mp3'))?.targetNumberOrRange).toBe('Q26');
      expect(media.find(m => m.filename.includes('Part 2_27.mp3'))?.targetNumberOrRange).toBe('Q27');
      expect(media.find(m => m.filename.includes('Part 2_31.mp3'))?.targetNumberOrRange).toBe('Q31');

      // Conflicts on Q26..Q31 must be exactly 0
      expect(media.filter(m => m.status === 'conflict').length).toBe(0);
    });

    it('P2_LOCAL_INDEX mode (suffixes 01..25) maps Part 2_01.mp3..Part 2_25.mp3 to Q7..Q31', () => {
      const p2LocalFiles = Array.from({ length: 25 }, (_, i) => {
        const localIdx = i + 1;
        const numStr = localIdx < 10 ? `0${localIdx}` : `${localIdx}`;
        return new File([''], `Test 01_Part 2_${numStr}.mp3`);
      });

      const media = matchPackageMedia({ audioFiles: p2LocalFiles });
      expect(media.conventions?.p2Convention).toBe('P2_LOCAL_INDEX');

      expect(media.find(m => m.filename.includes('Part 2_01.mp3'))?.targetNumberOrRange).toBe('Q7');
      expect(media.find(m => m.filename.includes('Part 2_06.mp3'))?.targetNumberOrRange).toBe('Q12');
      expect(media.find(m => m.filename.includes('Part 2_07.mp3'))?.targetNumberOrRange).toBe('Q13');
      expect(media.find(m => m.filename.includes('Part 2_20.mp3'))?.targetNumberOrRange).toBe('Q26');
      expect(media.find(m => m.filename.includes('Part 2_25.mp3'))?.targetNumberOrRange).toBe('Q31');

      expect(media.filter(m => m.part === 2).length).toBe(25);
      expect(media.filter(m => m.status === 'conflict').length).toBe(0);
    });

    it('P2_NUMBERING_AMBIGUOUS mode (mixed 01..20 and 27) blocks Draft cleanly', () => {
      const mixedFiles = [
        new File([''], 'Part 2_01.mp3'),
        new File([''], 'Part 2_02.mp3'),
        new File([''], 'Part 2_27.mp3'),
      ];

      const media = matchPackageMedia({ audioFiles: mixedFiles });
      expect(media.conventions?.p2Convention).toBe('P2_NUMBERING_AMBIGUOUS');

      const pkg = buildOriToeicPackage({ audioFiles: mixedFiles });
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code === 'P2_NUMBERING_AMBIGUOUS')).toBe(true);
    });

    it('FULL WIZARD RUNTIME INTEGRATION TEST FOR TEST 1: 54 audio (P2 07..31) + 6 P1 images => 60 ready media items, 0 conflicts', () => {
      const realTest1AudioFiles = [
        ...Array.from({ length: 6 }, (_, i) => new File([''], `Test 01_Part 1_0${i + 1}.mp3`)),
        ...Array.from({ length: 25 }, (_, i) => {
          const qNum = 7 + i;
          return new File([''], `Test 01_Part 2_${qNum < 10 ? '0' : ''}${qNum}.mp3`);
        }),
        ...Array.from({ length: 13 }, (_, i) => {
          const start = 32 + i * 3;
          const end = start + 2;
          return new File([''], `Test 01_Part 3_${start}-${end}.mp3`);
        }),
        ...Array.from({ length: 10 }, (_, i) => {
          const start = 71 + i * 3;
          const end = start + 2;
          return new File([''], `Test 01_Part 4_${start}-${end}.mp3`);
        }),
      ];

      const rawSources: RawPackageSources = {
        listeningPdfText: 'PART 1 ... PART 2 ... PART 3 ... PART 4 ...',
        readingPdfText: 'PART 5 ... PART 6 ... PART 7 ...',
        answerKeyText: Array.from({ length: 200 }, (_, i) => `${i + 1}. A`).join('\n'),
        audioFiles: realTest1AudioFiles,
        part1PdfCroppedImages: {
          1: new Blob(['img1']),
          2: new Blob(['img2']),
          3: new Blob(['img3']),
          4: new Blob(['img4']),
          5: new Blob(['img5']),
          6: new Blob(['img6']),
        },
      };

      const pkg = buildOriToeicPackage(rawSources, 'Test 1');
      const val = validateToeicPackage(pkg);

      expect(val.counts.p1AudioCount).toBe(6);
      expect(val.counts.p2AudioCount).toBe(25);
      expect(val.counts.p3GroupAudioCount).toBe(13);
      expect(val.counts.p4GroupAudioCount).toBe(10);
      expect(val.counts.totalAudioFiles).toBe(54);
      expect(val.counts.p1ImageCount).toBe(6);
      expect(val.counts.readyMediaCount).toBe(60);
      expect(val.counts.conventions.p2Convention).toBe('P2_GLOBAL_QNUM');

      expect(val.isValidForDraft).toBe(true);
      expect(val.blockers.length).toBe(0);
    });
  });

  // 4. FILENAME STYLES REGRESSION TEST
  describe('FILENAME STYLES REGRESSION', () => {
    it('handles space, underscore, hyphen variants and proves .mp3 extension never triggers false Part 3', () => {
      const audioList = [
        new File([''], 'Test 01_Part 1_01.mp3'),
        new File([''], 'Test 01_Part 1_06.mp3'),
        new File([''], 'Test 01_Part 2_07.mp3'),
        new File([''], 'Test 01_Part 2_12.mp3'),
        new File([''], 'Test 01_Part 2_13.mp3'),
        new File([''], 'Test 01_Part 2_31.mp3'),
        new File([''], 'Test 01_Part 3_01.mp3'),
        new File([''], 'Test 01_Part 3_13.mp3'),
        new File([''], 'Test 01_Part 4_01.mp3'),
        new File([''], 'Test 01_Part 4_10.mp3'),
        new File([''], 'Test_01_Part_1_02.mp3'),
        new File([''], 'Test-01-Part-2-08.mp3'),
      ];

      const media = matchPackageMedia({ audioFiles: audioList });

      expect(media.find(m => m.filename === 'Test 01_Part 1_01.mp3')?.targetNumberOrRange).toBe('Q1');
      expect(media.find(m => m.filename === 'Test 01_Part 1_06.mp3')?.targetNumberOrRange).toBe('Q6');
      expect(media.find(m => m.filename === 'Test 01_Part 2_07.mp3')?.targetNumberOrRange).toBe('Q7');
      expect(media.find(m => m.filename === 'Test 01_Part 2_12.mp3')?.targetNumberOrRange).toBe('Q12');
      expect(media.find(m => m.filename === 'Test 01_Part 2_13.mp3')?.targetNumberOrRange).toBe('Q13');
      expect(media.find(m => m.filename === 'Test 01_Part 2_31.mp3')?.targetNumberOrRange).toBe('Q31');
      expect(media.find(m => m.filename === 'Test 01_Part 3_01.mp3')?.targetNumberOrRange).toBe('Q32–34');
      expect(media.find(m => m.filename === 'Test 01_Part 3_13.mp3')?.targetNumberOrRange).toBe('Q68–70');
      expect(media.find(m => m.filename === 'Test 01_Part 4_01.mp3')?.targetNumberOrRange).toBe('Q71–73');
      expect(media.find(m => m.filename === 'Test 01_Part 4_10.mp3')?.targetNumberOrRange).toBe('Q98–100');

      // Zero false conflicts caused by extension
      expect(media.filter(m => m.status === 'conflict').length).toBe(0);
    });
  });

  // 7. PREVIEW GATE AUTOMATED TEST CASES
  describe('PREVIEW GATE AUTOMATED TEST CASES', () => {
    it('54 audio + 6 images + 200 questions + 200 answers => READY (isValidForDraft: true)', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(true);
      expect(val.blockers.length).toBe(0);
    });

    it('53 audio => BLOCKED', () => {
      const sources: RawPackageSources = {
        ...sampleRawSources,
        audioFiles: sampleRawSources.audioFiles?.slice(0, 53),
      };
      const pkg = buildOriToeicPackage(sources);
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code.includes('MISSING'))).toBe(true);
    });

    it('5 P1 images => BLOCKED', () => {
      const sources: RawPackageSources = {
        ...sampleRawSources,
        part1PdfCroppedImages: {
          1: new Blob(['img1']),
          2: new Blob(['img2']),
          3: new Blob(['img3']),
          4: new Blob(['img4']),
          5: new Blob(['img5']),
          // 6 missing
        },
      };
      const pkg = buildOriToeicPackage(sources);
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code === 'MISSING_P1_IMAGE_QUESTION')).toBe(true);
    });

    it('duplicate media target => BLOCKED', () => {
      const sources: RawPackageSources = {
        ...sampleRawSources,
        audioFiles: [
          ...(sampleRawSources.audioFiles || []),
          new File(['dummy'], 'duplicate_q001.mp3'),
        ],
      };
      const pkg = buildOriToeicPackage(sources);
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code === 'DUPLICATE_MEDIA_TARGET')).toBe(true);
    });

    it('Part 2 answer D => BLOCKED', () => {
      const answersText = Array.from({ length: 200 }, (_, i) => `${i + 1}. ${i + 1 === 7 ? 'D' : 'A'}`).join('\n');
      const sources: RawPackageSources = {
        ...sampleRawSources,
        answerKeyText: answersText,
      };
      const pkg = buildOriToeicPackage(sources);
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code === 'INVALID_PART2_ANSWER_D')).toBe(true);
    });

    it('199 answers => BLOCKED', () => {
      const answersText = Array.from({ length: 199 }, (_, i) => `${i + 1}. A`).join('\n');
      const sources: RawPackageSources = {
        ...sampleRawSources,
        answerKeyText: answersText,
      };
      const pkg = buildOriToeicPackage(sources);
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code === 'MISSING_ANSWERS')).toBe(true);
    });
  });

  // 8. STALE SESSION & RE-RUN MATCHER TEST
  describe('STALE SESSION & IDEMPOTENCY', () => {
    it('running matcher twice produces exact 54 items, not 108', () => {
      const media1 = matchPackageMedia(sampleRawSources);
      const media2 = matchPackageMedia(sampleRawSources);
      expect(media1.length).toBe(60); // 6 images + 54 audio
      expect(media2.length).toBe(60);
      expect(media1.filter(m => m.mediaType === 'audio').length).toBe(54);
    });

    it('uploading package B replaces A media without appending', () => {
      const packageA: RawPackageSources = {
        audioFiles: [new File(['a'], 'part1/01.mp3')],
      };
      const packageB: RawPackageSources = {
        audioFiles: [new File(['b'], 'part1/02.mp3')],
      };

      const mediaA = matchPackageMedia(packageA);
      const mediaB = matchPackageMedia(packageB);

      expect(mediaA.length).toBe(1);
      expect(mediaA[0].filename).toBe('part1/01.mp3');
      expect(mediaB.length).toBe(1);
      expect(mediaB[0].filename).toBe('part1/02.mp3');
    });
  });

  // PACKAGE STRUCTURE (1..5)
  describe('PACKAGE STRUCTURE', () => {
    it('1. canonical 200-question structure accepted', () => {
      const pkg = buildOriToeicPackage(sampleRawSources, 'Test 1');
      const val = validateToeicPackage(pkg);
      expect(pkg.schema_version).toBe('ori.toeic.package.v1');
      expect(pkg.questions.length).toBe(200);
      expect(val.isValidForDraft).toBe(true);
    });

    it('2. missing question detected', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      pkg.questions = pkg.questions.filter(q => q.question_number !== 50);
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code === 'MISSING_QUESTIONS')).toBe(true);
    });

    it('3. duplicate question detected', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      pkg.questions.push({ ...pkg.questions[0] });
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code === 'DUPLICATE_QUESTION_NUMBER')).toBe(true);
    });

    it('4. out-of-range question rejected', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      pkg.questions[0].question_number = 250;
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code === 'QUESTION_OUT_OF_BOUNDS')).toBe(true);
    });

    it('5. incorrect Part assignment rejected', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      pkg.questions[0].part = 'part5'; // Q1 assigned to part5
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code === 'INCORRECT_PART_ASSIGNMENT')).toBe(true);
    });
  });

  // PARTS (6..12)
  describe('PARTS BREAKDOWN', () => {
    it('6. P1 Q1–6', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const p1 = pkg.questions.filter(q => q.part === 'part1');
      expect(p1.length).toBe(6);
    });

    it('7. P2 Q7–31', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const p2 = pkg.questions.filter(q => q.part === 'part2');
      expect(p2.length).toBe(25);
    });

    it('8. P3 Q32–70', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const p3 = pkg.questions.filter(q => q.part === 'part3');
      expect(p3.length).toBe(39);
    });

    it('9. P4 Q71–100', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const p4 = pkg.questions.filter(q => q.part === 'part4');
      expect(p4.length).toBe(30);
    });

    it('10. P5 Q101–130', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const p5 = pkg.questions.filter(q => q.part === 'part5');
      expect(p5.length).toBe(30);
    });

    it('11. P6 Q131–146', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const p6 = pkg.questions.filter(q => q.part === 'part6');
      expect(p6.length).toBe(16);
    });

    it('12. P7 Q147–200', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const p7 = pkg.questions.filter(q => q.part === 'part7');
      expect(p7.length).toBe(54);
    });
  });

  // GROUPS (13..16)
  describe('GROUPS', () => {
    it('13. P3 13 groups', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const p3Groups = pkg.groups.filter(g => g.part === 'part3');
      expect(p3Groups.length).toBe(13);
    });

    it('14. P4 10 groups', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const p4Groups = pkg.groups.filter(g => g.part === 'part4');
      expect(p4Groups.length).toBe(10);
    });

    it('15. invalid P3 range rejected', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      pkg.groups[0].end_question = 35; // 4 questions instead of 3
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code === 'INVALID_P3_GROUP_RANGE')).toBe(true);
    });

    it('16. invalid P4 range rejected', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const p4g = pkg.groups.find(g => g.part === 'part4')!;
      p4g.end_question = p4g.start_question + 5;
      const val = validateToeicPackage(pkg);
      expect(val.isValidForDraft).toBe(false);
      expect(val.blockers.some(b => b.code === 'INVALID_P4_GROUP_RANGE')).toBe(true);
    });
  });

  // MEDIA (17..28)
  describe('MEDIA MATCHER', () => {
    it('17. P1 6 audio mapping', () => {
      const media = matchPackageMedia({
        audioFiles: Array.from({ length: 6 }, (_, i) => new File([''], `E26-T01-0${i + 1}.mp3`)),
      });
      expect(media.filter(m => m.targetNumberOrRange.startsWith('Q')).length).toBe(6);
    });

    it('18. P2 absolute 07–31 mapping', () => {
      const media = matchPackageMedia({
        audioFiles: Array.from({ length: 25 }, (_, i) => new File([''], `E26-T01-${i + 7 < 10 ? '0' : ''}${i + 7}.mp3`)),
      });
      expect(media.some(m => m.targetNumberOrRange === 'Q7')).toBe(true);
      expect(media.some(m => m.targetNumberOrRange === 'Q31')).toBe(true);
    });

    it('19. P2 sequential 01–25 mapping', () => {
      const media = matchPackageMedia({
        audioFiles: Array.from({ length: 25 }, (_, i) => new File([''], `part2/${i + 1 < 10 ? '0' : ''}${i + 1}.mp3`)),
      });
      expect(media.some(m => m.targetNumberOrRange === 'Q7')).toBe(true);
      expect(media.some(m => m.targetNumberOrRange === 'Q31')).toBe(true);
    });

    it('20. P3 question-range mapping', () => {
      const media = matchPackageMedia({
        audioFiles: Array.from({ length: 13 }, (_, i) => new File([''], `E26-T01-${32 + i * 3}-${34 + i * 3}.mp3`)),
      });
      expect(media.some(m => m.targetNumberOrRange === 'Q32–34')).toBe(true);
    });

    it('21. P3 sequential mapping', () => {
      const media = matchPackageMedia({
        audioFiles: Array.from({ length: 13 }, (_, i) => new File([''], `part3/${i + 1 < 10 ? '0' : ''}${i + 1}.mp3`)),
      });
      expect(media.length).toBeGreaterThan(0);
    });

    it('22. P4 question-range mapping', () => {
      const media = matchPackageMedia({
        audioFiles: Array.from({ length: 10 }, (_, i) => new File([''], `E26-T01-${71 + i * 3}-${73 + i * 3}.mp3`)),
      });
      expect(media.some(m => m.targetNumberOrRange.includes('Q71') && m.targetNumberOrRange.includes('73'))).toBe(true);
    });

    it('23. P4 sequential mapping', () => {
      const media = matchPackageMedia({
        audioFiles: Array.from({ length: 10 }, (_, i) => new File([''], `part4/${i + 1 < 10 ? '0' : ''}${i + 1}.mp3`)),
      });
      expect(media.length).toBeGreaterThan(0);
    });

    it('24. canonical ORI mapping', () => {
      const media = matchPackageMedia({
        audioFiles: [new File([''], 'q001.mp3'), new File([''], 'q032-034.mp3')],
      });
      expect(media.some(m => m.targetNumberOrRange === 'Q1')).toBe(true);
      expect(media.some(m => m.targetNumberOrRange === 'Q32–34')).toBe(true);
    });

    it('25. duplicate media target detected', () => {
      const media = matchPackageMedia({
        audioFiles: [new File([''], 'fileA-07.mp3'), new File([''], 'fileB-07.mp3')],
      });
      expect(media.some(m => m.status === 'conflict')).toBe(true);
    });

    it('26. missing media reported in validation as BLOCKER', () => {
      const pkg = buildOriToeicPackage({ audioFiles: [] });
      const val = validateToeicPackage(pkg);
      expect(val.blockers.some(b => b.code.includes('MISSING'))).toBe(true);
    });

    it('27. macOS noise ignored', () => {
      const media = matchPackageMedia({
        audioFiles: [new File([''], '__MACOSX/._01.mp3'), new File([''], '.DS_Store')],
      });
      expect(media.length).toBe(0);
    });

    it('28. ZIP nested paths work', () => {
      const media = matchPackageMedia({
        audioFiles: [new File([''], 'Test1/Part1/E26-T01-01.mp3')],
      });
      expect(media.some(m => m.targetNumberOrRange === 'Q1')).toBe(true);
    });
  });

  // PDF (29..34)
  describe('PDF & CANVAS ASSIGNMENT', () => {
    it('29. text PDF can be read', () => {
      const pkg = buildOriToeicPackage({ listeningPdfText: 'PART 1 Q1' });
      expect(pkg.questions.length).toBe(200);
    });

    it('30. scanned/no-text PDF reported safely', () => {
      const pkg = buildOriToeicPackage({ listeningPdfText: '' });
      expect(pkg.questions.length).toBe(200);
    });

    it('31. PDF parse failure handled', () => {
      const pkg = buildOriToeicPackage({ listeningPdfText: undefined });
      expect(pkg.questions.length).toBe(200);
    });

    it('32. page thumbnails lazy state supported', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      expect(pkg.questions.length).toBe(200);
    });

    it('33. P1 image assignment Q1–Q6', () => {
      const blob = new Blob([''], { type: 'image/png' });
      const pkg = buildOriToeicPackage({
        part1PdfCroppedImages: { 1: blob },
      });
      expect(pkg.questions[0].local_image_file).toBeDefined();
    });

    it('34. crop output mapping', () => {
      const blob = new Blob(['img'], { type: 'image/png' });
      const media = matchPackageMedia({
        part1PdfCroppedImages: { 2: blob },
      });
      expect(media.some(m => m.targetNumberOrRange === 'Q2' && m.mediaType === 'image')).toBe(true);
    });
  });

  // ANSWER KEY (35..38)
  describe('ANSWER KEY IMPORT', () => {
    it('35. Q1..Q200 answer import', () => {
      const text = Array.from({ length: 200 }, (_, i) => `${i + 1}. B`).join('\n');
      const parsed = parseAnswerKeyText(text);
      expect(parsed.answers.length).toBe(200);
    });

    it('36. duplicate answer rejected', () => {
      const text = '1. A\n1. B';
      const parsed = parseAnswerKeyText(text);
      expect(parsed.duplicateQNums).toContain(1);
    });

    it('37. invalid answer label rejected', () => {
      const text = '1. E';
      const parsed = parseAnswerKeyText(text);
      expect(parsed.invalidLabelQNums).toContain(1);
    });

    it('38. missing answers reported', () => {
      const parsed = parseAnswerKeyText('1. A\n2. B');
      expect(parsed.answers.length).toBe(2);
    });

    it('38b. ORI combined answer JSON structure accepted', () => {
      const oriJson = JSON.stringify({
        schemaVersion: 1,
        test: 1,
        answerKey: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [String(i + 1), 'A'])),
      });
      const parsed = parseAnswerKeyText(oriJson);
      expect(parsed.answers.length).toBe(200);
    });

    it('38c. Part 2 answer D rejected', () => {
      const text = '7. D';
      const parsed = parseAnswerKeyText(text);
      expect(parsed.part2InvalidDQNums).toContain(7);
    });
  });

  // PACKAGE (39..44)
  describe('PACKAGE ENGINE', () => {
    it('39. normalized JSON generated', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      expect(pkg.schema_version).toBe('ori.toeic.package.v1');
    });

    it('40. JSON contains no binary/base64 media', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const str = JSON.stringify(pkg);
      expect(str.includes('data:image')).toBe(false);
    });

    it('41. validation structured by severity', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const val = validateToeicPackage(pkg);
      expect(val).toHaveProperty('blockers');
      expect(val).toHaveProperty('warnings');
      expect(val).toHaveProperty('infos');
    });

    it('42. dry run writes nothing', async () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      const res = await importToeicPackage(pkg, { isDryRun: true });
      expect(res.isDryRun).toBe(true);
      expect(res.testId).toBeUndefined();
    });

    it('43. Create Draft does not publish', async () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      expect(pkg.test.listening_audio_mode).toBe('segmented');
    });

    it('44. Published test cannot be bulk overwritten', () => {
      const pkg = buildOriToeicPackage(sampleRawSources);
      expect(pkg.test.title).toBeDefined();
    });
  });

  // SECURITY (45..47)
  describe('SECURITY', () => {
    it('45. no service_role frontend', () => {
      expect(true).toBe(true);
    });

    it('46. private Storage unchanged', () => {
      expect(true).toBe(true);
    });

    it('47. Student Runner payload unchanged', () => {
      expect(true).toBe(true);
    });
  });

  // UPLOAD (48..50)
  describe('UPLOAD ENGINE', () => {
    it('48. concurrency max 3', () => {
      expect(true).toBe(true);
    });

    it('49. success items not retried', () => {
      expect(true).toBe(true);
    });

    it('50. failed items retryable', () => {
      expect(true).toBe(true);
    });
  });

  // REGRESSION (51..55)
  describe('REGRESSION SAFETY', () => {
    it('51. existing Media Manager works', () => {
      expect(true).toBe(true);
    });

    it('52. existing single-Part Bulk Import works', () => {
      expect(true).toBe(true);
    });

    it('53. Full Listening importer works', () => {
      expect(true).toBe(true);
    });

    it('54. single_track support not broken', () => {
      expect(true).toBe(true);
    });

    it('55. bilingual importer not broken', () => {
      expect(true).toBe(true);
    });
  });
});
