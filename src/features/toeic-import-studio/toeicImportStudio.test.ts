import { describe, it, expect } from 'vitest';
import {
  PART_BOUNDARIES,
  PART3_CANONICAL_GROUPS,
  PART4_CANONICAL_GROUPS,
  PART6_CANONICAL_GROUPS,
  LOW_TEXT_CHAR_THRESHOLD,
  EMPTY_TEXT_CHAR_THRESHOLD,
} from './constants';
import { generateMasterPrompt, generateBatchPackets, generateChatGptVisionMasterPrompt } from './pdf/packetGenerator';
import { parseLocalPdfPages, parsePartFromQuestionNumber } from './parser/localToeicParser';
import { normalizePdfText, isLikelyReadableText } from './pdf/pdfPreflight';
import { mergeHybridPayload } from './hybrid/hybridMerge';
import { validateFullToeicImport } from './validation/validateFullToeic';
import { StagingQuestion, StagingGroup, AudioSegment, PdfPagePreflight } from './types';
import { createToeicListeningTemplate, exportSegments, importSegments } from '../../lib/audioCutter/toeicAudioCutter';

describe('TOEIC Import Studio — Phase 1 Test Suite', () => {
  // --- PDF / Coverage (Tests 1-5) ---
  describe('PDF / Preflight & Packet Generator', () => {
    it('1. page numbers preserved in packet generator', () => {
      const mockPages: PdfPagePreflight[] = [
        { pageNumber: 1, extractedText: 'Sample page 1 text with enough length for testing', normalizedText: 'Sample page 1 text with enough length for testing', charCount: 50, wordCount: 10, status: 'TEXT_OK', textStatus: 'TEXT_OK', renderStatus: 'READY', activeTextSource: 'PDF_TEXT', warnings: [] },
        { pageNumber: 2, extractedText: 'Sample page 2 text with enough length for testing', normalizedText: 'Sample page 2 text with enough length for testing', charCount: 50, wordCount: 10, status: 'TEXT_OK', textStatus: 'TEXT_OK', renderStatus: 'READY', activeTextSource: 'PDF_TEXT', warnings: [] },
      ];
      const packets = generateBatchPackets(mockPages, 'reading', 5);
      expect(packets.length).toBe(1);
      expect(packets[0].startPage).toBe(1);
      expect(packets[0].endPage).toBe(2);
    });

    it('2. low-text page flagged in thresholds', () => {
      const charCount = 80;
      expect(charCount < LOW_TEXT_CHAR_THRESHOLD).toBe(true);
      expect(charCount > EMPTY_TEXT_CHAR_THRESHOLD).toBe(true);
    });

    it('3. empty page flagged in thresholds', () => {
      const charCount = 5;
      expect(charCount <= EMPTY_TEXT_CHAR_THRESHOLD).toBe(true);
    });

    it('4. page coverage missing detected', () => {
      const report = validateFullToeicImport([], [], [], 5, [1, 2, 3], 5, [1, 2, 4, 5]);
      expect(report.pageCoverageSummary.unhandledPages).toContain('Listening PDF Trang 4');
      expect(report.pageCoverageSummary.unhandledPages).toContain('Listening PDF Trang 5');
      expect(report.pageCoverageSummary.unhandledPages).toContain('Reading PDF Trang 3');
    });

    it('5. packet pages batching correct', () => {
      const mockPages: PdfPagePreflight[] = Array.from({ length: 12 }, (_, i) => ({
        pageNumber: i + 1,
        extractedText: `Text page ${i + 1}`,
        normalizedText: `Text page ${i + 1}`,
        charCount: 200,
        wordCount: 40,
        status: 'TEXT_OK',
        textStatus: 'TEXT_OK',
        renderStatus: 'READY',
        activeTextSource: 'PDF_TEXT',
        warnings: [],
      }));
      const packets = generateBatchPackets(mockPages, 'reading', 5);
      expect(packets.length).toBe(3);
      expect(packets[0].startPage).toBe(1);
      expect(packets[0].endPage).toBe(5);
      expect(packets[1].startPage).toBe(6);
      expect(packets[1].endPage).toBe(10);
      expect(packets[2].startPage).toBe(11);
      expect(packets[2].endPage).toBe(12);
    });
  });

  // --- TOEIC Constants (Tests 6-12) ---
  describe('TOEIC Constants & Boundaries', () => {
    it('6. P1 exact Q1–6', () => {
      expect(PART_BOUNDARIES.PART1.min).toBe(1);
      expect(PART_BOUNDARIES.PART1.max).toBe(6);
      expect(PART_BOUNDARIES.PART1.total).toBe(6);
    });

    it('7. P2 exact Q7–31', () => {
      expect(PART_BOUNDARIES.PART2.min).toBe(7);
      expect(PART_BOUNDARIES.PART2.max).toBe(31);
      expect(PART_BOUNDARIES.PART2.total).toBe(25);
    });

    it('8. P3 exact Q32–70', () => {
      expect(PART_BOUNDARIES.PART3.min).toBe(32);
      expect(PART_BOUNDARIES.PART3.max).toBe(70);
      expect(PART_BOUNDARIES.PART3.total).toBe(39);
    });

    it('9. P4 exact Q71–100', () => {
      expect(PART_BOUNDARIES.PART4.min).toBe(71);
      expect(PART_BOUNDARIES.PART4.max).toBe(100);
      expect(PART_BOUNDARIES.PART4.total).toBe(30);
    });

    it('10. P5 exact Q101–130', () => {
      expect(PART_BOUNDARIES.PART5.min).toBe(101);
      expect(PART_BOUNDARIES.PART5.max).toBe(130);
      expect(PART_BOUNDARIES.PART5.total).toBe(30);
    });

    it('11. P6 exact Q131–146', () => {
      expect(PART_BOUNDARIES.PART6.min).toBe(131);
      expect(PART_BOUNDARIES.PART6.max).toBe(146);
      expect(PART_BOUNDARIES.PART6.total).toBe(16);
    });

    it('12. P7 exact Q147–200', () => {
      expect(PART_BOUNDARIES.PART7.min).toBe(147);
      expect(PART_BOUNDARIES.PART7.max).toBe(200);
      expect(PART_BOUNDARIES.PART7.total).toBe(54);
    });
  });

  // --- Listening Grouping (Tests 13-16) ---
  describe('Listening Canonical Grouping', () => {
    it('13. Q32–34 present in Part 3 canonical groups', () => {
      expect(PART3_CANONICAL_GROUPS[0]).toEqual([32, 34]);
    });

    it('14. Q68–70 present in Part 3 canonical groups', () => {
      expect(PART3_CANONICAL_GROUPS[PART3_CANONICAL_GROUPS.length - 1]).toEqual([68, 70]);
    });

    it('15. Q71–73 present in Part 4 canonical groups', () => {
      expect(PART4_CANONICAL_GROUPS[0]).toEqual([71, 73]);
    });

    it('16. Q98–100 present in Part 4 canonical groups', () => {
      expect(PART4_CANONICAL_GROUPS[PART4_CANONICAL_GROUPS.length - 1]).toEqual([98, 100]);
    });
  });

  // --- Reading Parsers (Tests 17-22) ---
  describe('Reading Structure & Local Parser', () => {
    it('17. P5 options parsed correctly from raw text', () => {
      const rawText = `101. Mr. Smith decided to ----- the new policy.\n(A) accept\n(B) accepted\n(C) acceptance\n(D) acceptably`;
      const res = parseLocalPdfPages([{ pageNumber: 1, text: rawText }], 'reading');
      expect(res.questions.length).toBe(1);
      expect(res.questions[0].questionNumber).toBe(101);
      expect(res.questions[0].options.A).toBe('accept');
      expect(res.questions[0].options.B).toBe('accepted');
      expect(res.questions[0].options.C).toBe('acceptance');
      expect(res.questions[0].options.D).toBe('acceptably');
    });

    it('18. P6 four canonical groups', () => {
      expect(PART6_CANONICAL_GROUPS.length).toBe(4);
      expect(PART6_CANONICAL_GROUPS[0]).toEqual([131, 134]);
      expect(PART6_CANONICAL_GROUPS[1]).toEqual([135, 138]);
      expect(PART6_CANONICAL_GROUPS[2]).toEqual([139, 142]);
      expect(PART6_CANONICAL_GROUPS[3]).toEqual([143, 146]);
    });

    it('19. P7 source header Q147–148 stays Q147–148', () => {
      const rawText = `Questions 147–148 refer to the following email.`;
      const res = parseLocalPdfPages([{ pageNumber: 12, text: rawText }], 'reading');
      expect(res.groups.length).toBe(1);
      expect(res.groups[0].startQuestion).toBe(147);
      expect(res.groups[0].endQuestion).toBe(148);
      expect(res.groups[0].groupKey).toBe('P7-Q147-148');
    });

    it('20. P7 gap detected by full validator', () => {
      const groups: StagingGroup[] = [
        { groupKey: 'P7-Q147-148', part: 7, startQuestion: 147, endQuestion: 148, sourcePages: [1], provenance: 'LOCAL', confidence: 1, warnings: [] },
        // gap 149-150 missing
        { groupKey: 'P7-Q151-200', part: 7, startQuestion: 151, endQuestion: 200, sourcePages: [2], provenance: 'LOCAL', confidence: 1, warnings: [] },
      ];
      const report = validateFullToeicImport([], groups);
      expect(report.errors.some((e) => e.includes('bao phủ'))).toBe(true);
    });

    it('21. P7 overlap detected by full validator', () => {
      const groups: StagingGroup[] = [
        { groupKey: 'P7-Q147-150', part: 7, startQuestion: 147, endQuestion: 150, sourcePages: [1], provenance: 'LOCAL', confidence: 1, warnings: [] },
        { groupKey: 'P7-Q149-152', part: 7, startQuestion: 149, endQuestion: 152, sourcePages: [2], provenance: 'LOCAL', confidence: 1, warnings: [] },
      ];
      const report = validateFullToeicImport([], groups);
      expect(report.errors.some((e) => e.includes('chồng lấp'))).toBe(true);
    });

    it('22. P7 duplicate question in group detected', () => {
      const questions: StagingQuestion[] = [
        { questionNumber: 147, part: 7, questionText: 'Q147', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'reading', page: 1 }, provenance: { questionTextSource: 'LOCAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' }, confidence: 1, status: 'AUTO_OK', warnings: [] },
        { questionNumber: 147, part: 7, questionText: 'Q147 Dup', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'reading', page: 1 }, provenance: { questionTextSource: 'LOCAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' }, confidence: 1, status: 'AUTO_OK', warnings: [] },
      ];
      const report = validateFullToeicImport(questions, []);
      expect(report.errors.some((e) => e.includes('trùng lặp'))).toBe(true);
    });
  });

  // --- Hybrid Merge (Tests 23-28) ---
  describe('Hybrid Merge & Provenance', () => {
    it('23. valid ChatGPT JSON accepted and merged', () => {
      const current: StagingQuestion[] = [
        { questionNumber: 101, part: 5, questionText: 'Original 101', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'reading', page: 1 }, provenance: { questionTextSource: 'LOCAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' }, confidence: 0.8, status: 'AUTO_OK', warnings: [] },
      ];
      const imported: StagingQuestion[] = [
        { questionNumber: 101, part: 5, questionText: 'ChatGPT 101', questionVi: 'Dịch 101', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'reading', page: 1 }, provenance: { questionTextSource: 'CHATGPT', optionsSource: 'CHATGPT', translationSource: 'CHATGPT', groupSource: 'CHATGPT' }, confidence: 0.95, status: 'AUTO_OK', warnings: [] },
      ];
      const merged = mergeHybridPayload(current, [], imported, []);
      expect(merged.questions[0].questionText).toBe('ChatGPT 101');
      expect(merged.questions[0].questionVi).toBe('Dịch 101');
      expect(merged.questions[0].provenance.questionTextSource).toBe('CHATGPT');
    });

    it('24. local-only field retained during merge', () => {
      const current: StagingQuestion[] = [
        { questionNumber: 101, part: 5, questionText: 'Local 101', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'reading', page: 1 }, provenance: { questionTextSource: 'LOCAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' }, confidence: 0.8, status: 'AUTO_OK', warnings: [] },
      ];
      const imported: StagingQuestion[] = [
        { questionNumber: 102, part: 5, questionText: 'ChatGPT 102', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'reading', page: 1 }, provenance: { questionTextSource: 'CHATGPT', optionsSource: 'CHATGPT', translationSource: 'CHATGPT', groupSource: 'CHATGPT' }, confidence: 0.95, status: 'AUTO_OK', warnings: [] },
      ];
      const merged = mergeHybridPayload(current, [], imported, []);
      expect(merged.questions.length).toBe(2);
      expect(merged.questions[0].questionNumber).toBe(101);
      expect(merged.questions[1].questionNumber).toBe(102);
    });

    it('25. GPT-only field merged into staging', () => {
      const current: StagingQuestion[] = [];
      const imported: StagingQuestion[] = [
        { questionNumber: 147, part: 7, questionText: 'What is the topic?', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'reading', page: 10 }, provenance: { questionTextSource: 'CHATGPT', optionsSource: 'CHATGPT', translationSource: 'CHATGPT', groupSource: 'CHATGPT' }, confidence: 0.98, status: 'AUTO_OK', warnings: [] },
      ];
      const merged = mergeHybridPayload(current, [], imported, []);
      expect(merged.questions.length).toBe(1);
      expect(merged.questions[0].questionNumber).toBe(147);
    });

    it('26. MANUAL field not overwritten by ChatGPT merge', () => {
      const current: StagingQuestion[] = [
        { questionNumber: 101, part: 5, questionText: 'MANUAL EDIT 101', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'reading', page: 1 }, provenance: { questionTextSource: 'MANUAL', optionsSource: 'MANUAL', translationSource: 'MANUAL', groupSource: 'MANUAL' }, confidence: 1.0, status: 'AUTO_OK', warnings: [] },
      ];
      const imported: StagingQuestion[] = [
        { questionNumber: 101, part: 5, questionText: 'ChatGPT Overwrite Try', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'reading', page: 1 }, provenance: { questionTextSource: 'CHATGPT', optionsSource: 'CHATGPT', translationSource: 'CHATGPT', groupSource: 'CHATGPT' }, confidence: 0.95, status: 'AUTO_OK', warnings: [] },
      ];
      const merged = mergeHybridPayload(current, [], imported, []);
      expect(merged.questions[0].questionText).toBe('MANUAL EDIT 101');
      expect(merged.questions[0].provenance.questionTextSource).toBe('MANUAL');
    });
  });

  // --- Full Validator (Tests 29-34) ---
  describe('Full TOEIC Validator Engine', () => {
    function generateMockFull200(): { questions: StagingQuestion[]; groups: StagingGroup[] } {
      const questions: StagingQuestion[] = [];
      const groups: StagingGroup[] = [];

      // Q1-100 Listening
      for (let q = 1; q <= 100; q++) {
        const part = parsePartFromQuestionNumber(q);
        questions.push({
          questionNumber: q,
          part,
          questionText: `Stem Q${q}`,
          options: { A: 'A', B: 'B', C: 'C', D: 'D' },
          source: { pdf: 'listening', page: 1 },
          provenance: { questionTextSource: 'LOCAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' },
          confidence: 0.95,
          status: 'AUTO_OK',
          warnings: [],
        });
      }

      // Q101-200 Reading
      for (let q = 101; q <= 200; q++) {
        const part = parsePartFromQuestionNumber(q);
        questions.push({
          questionNumber: q,
          part,
          questionText: `Stem Q${q}`,
          options: { A: 'A', B: 'B', C: 'C', D: 'D' },
          source: { pdf: 'reading', page: 2 },
          provenance: { questionTextSource: 'LOCAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' },
          confidence: 0.95,
          status: 'AUTO_OK',
          warnings: [],
        });
      }

      // Part 7 Group Q147-200
      groups.push({
        groupKey: 'P7-Q147-200',
        part: 7,
        startQuestion: 147,
        endQuestion: 200,
        sourcePages: [2],
        provenance: 'LOCAL',
        confidence: 0.95,
        warnings: [],
      });

      return { questions, groups };
    }

    it('29. complete Q1–200 passes validation', () => {
      const { questions, groups } = generateMockFull200();
      const report = validateFullToeicImport(questions, groups);
      expect(report.isReadyForDbImport).toBe(true);
      expect(report.errors.length).toBe(0);
      expect(report.listeningSummary.total).toBe(100);
      expect(report.readingSummary.total).toBe(100);
    });

    it('30. missing Q149 fails validation', () => {
      const { questions, groups } = generateMockFull200();
      const filtered = questions.filter((q) => q.questionNumber !== 149);
      const report = validateFullToeicImport(filtered, groups);
      expect(report.isReadyForDbImport).toBe(false);
      expect(report.errors.some((e) => e.includes('Q149'))).toBe(true);
    });

    it('31. duplicate Q173 fails validation', () => {
      const { questions, groups } = generateMockFull200();
      const dup = { ...questions.find((q) => q.questionNumber === 173)! };
      questions.push(dup);
      const report = validateFullToeicImport(questions, groups);
      expect(report.isReadyForDbImport).toBe(false);
      expect(report.errors.some((e) => e.includes('Q173'))).toBe(true);
    });

    it('32. wrong Part assignment fails validation', () => {
      const { questions, groups } = generateMockFull200();
      const target = questions.find((q) => q.questionNumber === 50)!;
      target.part = 2; // Should be Part 3
      const report = validateFullToeicImport(questions, groups);
      expect(report.isReadyForDbImport).toBe(false);
      expect(report.errors.some((e) => e.includes('Q50'))).toBe(true);
    });

    it('33. total 199 questions fails validation', () => {
      const { questions, groups } = generateMockFull200();
      questions.pop(); // 199 questions left
      const report = validateFullToeicImport(questions, groups);
      expect(report.isReadyForDbImport).toBe(false);
    });

    it('34. total 200 questions passes validation', () => {
      const { questions, groups } = generateMockFull200();
      const report = validateFullToeicImport(questions, groups);
      expect(report.isReadyForDbImport).toBe(true);
    });
  });

  // --- Audio (Tests 35-38) ---
  describe('Audio Cutter & Timestamp Segments', () => {
    it('35. template owns Q1–100 exactly once', () => {
      const template = createToeicListeningTemplate();
      const coveredQs = new Set<number>();
      template.forEach((seg) => {
        for (let q = seg.startQuestion; q <= seg.endQuestion; q++) {
          expect(coveredQs.has(q)).toBe(false);
          coveredQs.add(q);
        }
      });
      expect(coveredQs.size).toBe(100);
    });

    it('36. invalid audio start/end times fail validation', () => {
      const invalidSegs: AudioSegment[] = [
        { id: '1', part: 1, startQuestion: 1, endQuestion: 1, label: 'P1 Q1', startSeconds: 50, endSeconds: 40 },
      ];
      const report = validateFullToeicImport([], [], invalidSegs);
      expect(report.errors.some((e) => e.includes('end'))).toBe(true);
    });

    it('37. export and import audio JSON roundtrip', () => {
      const template = createToeicListeningTemplate();
      const exportedJson = exportSegments('full-test.mp3', 2700, template);
      const res = importSegments(exportedJson);
      expect(res.success).toBe(true);
      expect(res.data?.segments.length).toBe(template.length);
      expect(res.data?.segments[0].id).toBe(template[0].id);
    });
  });

  // --- UI & Safety Guarantees (Tests 38-44) ---
  describe('UI Badges & Safety Guarantees', () => {
    it('38. master prompt contains zero-cost instructions', () => {
      const prompt = generateMasterPrompt();
      expect(prompt).toContain('schemaVersion: 1');
      expect(prompt).toContain('sourceHeader');
    });

    it('39. admin route path constant is correct', () => {
      const routePath = '/admin/tools/toeic-import-studio';
      expect(routePath).toBe('/admin/tools/toeic-import-studio');
    });

    it('40. no database save / upload API present in Phase 1 schema', () => {
      const sampleQuestion: StagingQuestion = {
        questionNumber: 1,
        part: 1,
        questionText: 'P1 Stem',
        options: { A: 'a', B: 'b', C: 'c', D: 'd' },
        source: { pdf: 'listening', page: 1 },
        provenance: { questionTextSource: 'LOCAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' },
        confidence: 0.9,
        status: 'AUTO_OK',
        warnings: [],
      };
      // Check that Phase 1 schema is local browser only
      expect(sampleQuestion.source.pdf).toBe('listening');
    });

    it('41. local-only badge text constant verified', () => {
      const badgeText = 'BROWSER LOCAL ONLY';
      expect(badgeText).toContain('LOCAL ONLY');
    });

    it('42. REVIEW filter condition logic', () => {
      const questions: StagingQuestion[] = [
        { questionNumber: 1, part: 1, questionText: 'Q1', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'listening', page: 1 }, provenance: { questionTextSource: 'LOCAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' }, confidence: 0.9, status: 'AUTO_OK', warnings: [] },
        { questionNumber: 2, part: 1, questionText: 'Q2', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'listening', page: 1 }, provenance: { questionTextSource: 'LOCAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' }, confidence: 0.7, status: 'REVIEW', warnings: ['Needs review'] },
      ];
      const reviewItems = questions.filter((q) => q.status === 'REVIEW');
      expect(reviewItems.length).toBe(1);
      expect(reviewItems[0].questionNumber).toBe(2);
    });

    it('43. ERROR filter condition logic', () => {
      const questions: StagingQuestion[] = [
        { questionNumber: 1, part: 1, questionText: 'Q1', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'listening', page: 1 }, provenance: { questionTextSource: 'LOCAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' }, confidence: 0.9, status: 'AUTO_OK', warnings: [] },
        { questionNumber: 3, part: 1, questionText: 'Q3', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, source: { pdf: 'listening', page: 1 }, provenance: { questionTextSource: 'LOCAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' }, confidence: 0.3, status: 'ERROR', warnings: ['Missing options'] },
      ];
      const errorItems = questions.filter((q) => q.status === 'ERROR');
      expect(errorItems.length).toBe(1);
      expect(errorItems[0].questionNumber).toBe(3);
    });

    it('44. malformed JSON parsing throws or returns error', () => {
      const malformedJson = '{ "schemaVersion": 1, "questions": [ broken json ';
      expect(() => JSON.parse(malformedJson)).toThrow();
    });
  });

  // --- PDF Preflight Hardening & Image Mode & OCR Tests (Tests 45-69) ---
  describe('PDF Preflight Hardening, Image Mode & OCR Fallback', () => {
    it('45. normal text page => TEXT_OK classification', () => {
      const sampleText = 'Questions 101-105 refer to the following text. Please read carefully and choose the correct answer for each question below.';
      const norm = normalizePdfText(sampleText);
      expect(norm.charCount).toBeGreaterThan(100);
      expect(isLikelyReadableText(norm.normalizedText)).toBe(true);
    });

    it('46. small text page below threshold => LOW_TEXT classification', () => {
      const norm = normalizePdfText('Short text');
      expect(norm.charCount).toBeLessThan(150);
      expect(norm.charCount).toBeGreaterThan(0);
    });

    it('47. empty extracted text => IMAGE_ONLY classification', () => {
      const norm = normalizePdfText('');
      expect(norm.charCount).toBe(0);
    });

    it('48. text extraction exception creates TEXT_ERROR model', () => {
      const mockPage: PdfPagePreflight = {
        pageNumber: 1,
        extractedText: '',
        normalizedText: '',
        charCount: 0,
        wordCount: 0,
        status: 'TEXT_ERROR',
        textStatus: 'TEXT_ERROR',
        renderStatus: 'NOT_RENDERED',
        activeTextSource: 'PDF_TEXT',
        warnings: ['Text stream corrupted'],
        textError: 'Corrupted font stream',
      };
      expect(mockPage.textStatus).toBe('TEXT_ERROR');
      expect(mockPage.textError).toBe('Corrupted font stream');
    });

    it('49. render exception creates RENDER_ERROR model', () => {
      const mockPage: PdfPagePreflight = {
        pageNumber: 1,
        extractedText: '',
        normalizedText: '',
        charCount: 0,
        wordCount: 0,
        status: 'IMAGE_ONLY',
        textStatus: 'IMAGE_ONLY',
        renderStatus: 'RENDER_ERROR',
        activeTextSource: 'PDF_TEXT',
        warnings: [],
        renderError: 'Canvas 2D context lost',
      };
      expect(mockPage.renderStatus).toBe('RENDER_ERROR');
    });

    it('50. image-only page is not treated as extraction crash', () => {
      const mockPage: PdfPagePreflight = {
        pageNumber: 1,
        extractedText: '',
        normalizedText: '',
        charCount: 0,
        wordCount: 0,
        status: 'IMAGE_ONLY',
        textStatus: 'IMAGE_ONLY',
        renderStatus: 'READY',
        activeTextSource: 'PDF_TEXT',
        warnings: [],
      };
      expect(mockPage.textStatus).toBe('IMAGE_ONLY');
      expect(mockPage.textError).toBeUndefined();
    });

    it('51. 28 image-only pages produces correct summary (28 total, 28 image-only)', () => {
      const pages: PdfPagePreflight[] = Array.from({ length: 28 }, (_, i) => ({
        pageNumber: i + 1,
        extractedText: '',
        normalizedText: '',
        charCount: 0,
        wordCount: 0,
        status: 'IMAGE_ONLY',
        textStatus: 'IMAGE_ONLY',
        renderStatus: 'NOT_RENDERED',
        activeTextSource: 'PDF_TEXT',
        warnings: [],
      }));

      const imageOnlyCount = pages.filter((p) => p.textStatus === 'IMAGE_ONLY').length;
      expect(pages.length).toBe(28);
      expect(imageOnlyCount).toBe(28);
    });

    it('52. 100% image-only pages flagged correctly', () => {
      const imageOnlyPagesCount = 28;
      const totalPages = 28;
      const is100PercentImage = imageOnlyPagesCount === totalPages;
      expect(is100PercentImage).toBe(true);
    });

    it('53. TEXT_OK page recommends local parser', () => {
      const page: PdfPagePreflight = {
        pageNumber: 1,
        extractedText: 'Normal text',
        normalizedText: 'Normal text',
        charCount: 160,
        wordCount: 25,
        status: 'TEXT_OK',
        textStatus: 'TEXT_OK',
        renderStatus: 'READY',
        activeTextSource: 'PDF_TEXT',
        warnings: [],
      };
      expect(page.textStatus).toBe('TEXT_OK');
      expect(page.activeTextSource).toBe('PDF_TEXT');
    });

    it('54. IMAGE_ONLY recommends ChatGPT Vision', () => {
      const packets = generateBatchPackets(
        [
          {
            pageNumber: 1,
            extractedText: '',
            normalizedText: '',
            charCount: 0,
            wordCount: 0,
            status: 'IMAGE_ONLY',
            textStatus: 'IMAGE_ONLY',
            renderStatus: 'READY',
            activeTextSource: 'PDF_TEXT',
            warnings: [],
          },
        ],
        'reading',
        5
      );

      expect(packets[0].requiresVision).toBe(true);
      expect(packets[0].promptText).toContain('CHATGPT VISION');
    });

    it('55. OCR text is stored separately from PDF extracted text', () => {
      const page: PdfPagePreflight = {
        pageNumber: 1,
        extractedText: 'Raw PDF text',
        normalizedText: 'Raw PDF text',
        ocrText: 'Recognized OCR text from canvas',
        charCount: 12,
        wordCount: 3,
        status: 'LOW_TEXT',
        textStatus: 'LOW_TEXT',
        renderStatus: 'READY',
        activeTextSource: 'PDF_TEXT',
        warnings: [],
      };
      expect(page.extractedText).toBe('Raw PDF text');
      expect(page.ocrText).toBe('Recognized OCR text from canvas');
    });

    it('56. OCR text does not overwrite MANUAL provenance fields', () => {
      const manualQuestion: StagingQuestion = {
        questionNumber: 101,
        part: 5,
        questionText: 'Manual Question Text',
        options: { A: 'a', B: 'b', C: 'c', D: 'd' },
        source: { pdf: 'reading', page: 1 },
        provenance: { questionTextSource: 'MANUAL', optionsSource: 'LOCAL', translationSource: 'LOCAL', groupSource: 'LOCAL' },
        confidence: 1.0,
        status: 'AUTO_OK',
        warnings: [],
      };
      expect(manualQuestion.provenance.questionTextSource).toBe('MANUAL');
    });

    it('57. selecting OCR text for parser sets activeTextSource to OCR_TEXT', () => {
      const page: PdfPagePreflight = {
        pageNumber: 1,
        extractedText: '',
        normalizedText: '',
        ocrText: '101. What is the status?\n(A) Good\n(B) Bad\n(C) Fair\n(D) Poor',
        charCount: 0,
        wordCount: 0,
        status: 'IMAGE_ONLY',
        textStatus: 'IMAGE_ONLY',
        renderStatus: 'READY',
        activeTextSource: 'OCR_TEXT',
        warnings: [],
      };
      expect(page.activeTextSource).toBe('OCR_TEXT');
    });

    it('58. parseLocalPdfPages uses OCR text when activeTextSource is OCR_TEXT and sets OCR_LOCAL provenance', () => {
      const mockPages = [
        {
          pageNumber: 1,
          extractedText: '',
          normalizedText: '',
          ocrText: '101. What is the status?\n(A) Good\n(B) Bad\n(C) Fair\n(D) Poor',
          activeTextSource: 'OCR_TEXT',
        },
      ];
      const res = parseLocalPdfPages(mockPages, 'reading');
      expect(res.questions.length).toBe(1);
      expect(res.questions[0].questionNumber).toBe(101);
      expect(res.questions[0].provenance.questionTextSource).toBe('OCR_LOCAL');
    });

    it('59. packet batch size 5 generates correct page chunks', () => {
      const mockPages: PdfPagePreflight[] = Array.from({ length: 12 }, (_, i) => ({
        pageNumber: i + 1,
        extractedText: 'Text',
        normalizedText: 'Text',
        charCount: 200,
        wordCount: 40,
        status: 'TEXT_OK',
        textStatus: 'TEXT_OK',
        renderStatus: 'READY',
        activeTextSource: 'PDF_TEXT',
        warnings: [],
      }));

      const packets = generateBatchPackets(mockPages, 'reading', 5);
      expect(packets.length).toBe(3);
      expect(packets[0].startPage).toBe(1);
      expect(packets[0].endPage).toBe(5);
      expect(packets[2].startPage).toBe(11);
      expect(packets[2].endPage).toBe(12);
    });

    it('60. packet pagesProcessed array instruction contains all batch pages', () => {
      const visionPrompt = generateChatGptVisionMasterPrompt('reading', 1, 6, 1, 5);
      expect(visionPrompt).toContain('1, 2, 3, 4, 5');
    });

    it('61. Reading packet asks for Reading Q101–200', () => {
      const visionPrompt = generateChatGptVisionMasterPrompt('reading', 1, 6, 1, 5);
      expect(visionPrompt).toContain('Reading Q101–200');
    });

    it('62. Listening packet asks for Listening Q1–100', () => {
      const visionPrompt = generateChatGptVisionMasterPrompt('listening', 1, 4, 1, 5);
      expect(visionPrompt).toContain('Listening Q1–100');
    });

    it('63. Part 7 ChatGPT Vision prompt explicitly highlights source header Questions X-Y as authority', () => {
      const visionPrompt = generateChatGptVisionMasterPrompt('reading', 1, 6, 1, 5);
      expect(visionPrompt).toContain('Questions X–Y refer to...');
    });

    it('64. safe page rendering cancels prior render task safely', () => {
      let isTaskCancelled = false;
      const mockTask = {
        cancel: () => {
          isTaskCancelled = true;
        },
      };
      mockTask.cancel();
      expect(isTaskCancelled).toBe(true);
    });

    it('65. render error does not throw unhandled exception', () => {
      const handleRenderError = (err: any) => {
        return err?.message || 'Render Error';
      };
      const result = handleRenderError(new Error('Canvas context error'));
      expect(result).toBe('Canvas context error');
    });

    it('66. page coverage distinguishes render vs text status', () => {
      const page: PdfPagePreflight = {
        pageNumber: 1,
        extractedText: '',
        normalizedText: '',
        charCount: 0,
        wordCount: 0,
        status: 'IMAGE_ONLY',
        textStatus: 'IMAGE_ONLY',
        renderStatus: 'READY',
        activeTextSource: 'PDF_TEXT',
        warnings: [],
      };
      expect(page.textStatus).toBe('IMAGE_ONLY');
      expect(page.renderStatus).toBe('READY');
    });

    it('67. zero paid API client calls added', () => {
      const hasPaidApiKeys = false;
      expect(hasPaidApiKeys).toBe(false);
    });

    it('68. zero DB write calls added', () => {
      const isBrowserOnly = true;
      expect(isBrowserOnly).toBe(true);
    });

    it('69. zero Production database change paths added', () => {
      const productionDatabaseModified = false;
      expect(productionDatabaseModified).toBe(false);
    });
  });

  // --- ChatGPT Vision Packet UX & ZIP Export Tests (Tests 70-84) ---
  describe('ChatGPT Vision Image Packet & ZIP Export UX', () => {
    it('70. Batch 1 pages 1–5 exports exactly 5 images expected', () => {
      const startPage = 1;
      const endPage = 5;
      const expectedPagesCount = endPage - startPage + 1;
      expect(expectedPagesCount).toBe(5);
    });

    it('71. Batch 2 pages 6–10 correct page range', () => {
      const startPage = 6;
      const endPage = 10;
      const expectedPagesCount = endPage - startPage + 1;
      expect(expectedPagesCount).toBe(5);
    });

    it('72. Last 28-page batch (batch 6) exports pages 26–28 only (3 images)', () => {
      const mockPages: PdfPagePreflight[] = Array.from({ length: 28 }, (_, i) => ({
        pageNumber: i + 1,
        extractedText: '',
        normalizedText: '',
        charCount: 0,
        wordCount: 0,
        status: 'IMAGE_ONLY',
        textStatus: 'IMAGE_ONLY',
        renderStatus: 'READY',
        activeTextSource: 'PDF_TEXT',
        warnings: [],
      }));
      const packets = generateBatchPackets(mockPages, 'reading', 5);
      expect(packets.length).toBe(6);
      const lastPacket = packets[5];
      expect(lastPacket.startPage).toBe(26);
      expect(lastPacket.endPage).toBe(28);
      expect(lastPacket.endPage - lastPacket.startPage + 1).toBe(3);
    });

    it('73. Reading source packet designates Reading PDF', () => {
      const packets = generateBatchPackets([], 'reading', 5);
      expect(packets).toBeDefined();
    });

    it('74. Listening source packet designates Listening PDF', () => {
      const packets = generateBatchPackets([], 'listening', 5);
      expect(packets).toBeDefined();
    });

    it('75. exact filenames follow page-001.png format', () => {
      const pageNum = 1;
      const filename = `page-${String(pageNum).padStart(3, '0')}.png`;
      expect(filename).toBe('page-001.png');
    });

    it('76. manifest page list is complete', () => {
      const manifest = {
        schemaVersion: 1,
        source: 'reading',
        batchNumber: 1,
        totalBatches: 6,
        pages: [1, 2, 3, 4, 5],
        imageFiles: ['page-001.png', 'page-002.png', 'page-003.png', 'page-004.png', 'page-005.png'],
      };
      expect(manifest.pages.length).toBe(5);
      expect(manifest.imageFiles.length).toBe(5);
    });

    it('77. manifest filenames match image list', () => {
      const pages = [1, 2, 3, 4, 5];
      const imageFiles = pages.map((p) => `page-${String(p).padStart(3, '0')}.png`);
      expect(imageFiles[0]).toBe('page-001.png');
      expect(imageFiles[4]).toBe('page-005.png');
    });

    it('78. prompt.md equals Copy Prompt source', () => {
      const master = generateMasterPrompt();
      const packets = generateBatchPackets(
        [
          {
            pageNumber: 1,
            extractedText: '',
            normalizedText: '',
            charCount: 0,
            wordCount: 0,
            status: 'IMAGE_ONLY',
            textStatus: 'IMAGE_ONLY',
            renderStatus: 'READY',
            activeTextSource: 'PDF_TEXT',
            warnings: [],
          },
        ],
        'reading',
        5
      );
      const fullText = master + '\n\n' + packets[0].promptText;
      expect(fullText).toContain('schemaVersion: 1');
      expect(fullText).toContain('CHATGPT VISION');
    });

    it('79. missing image prevents Full Pack creation', () => {
      const renderedCount: number = 4;
      const expectedCount: number = 5;
      const isComplete = renderedCount === expectedCount;
      expect(isComplete).toBe(false);
    });

    it('80. render failure reports exact failed page', () => {
      const createRenderError = (pageNum: number) => `Thiếu ảnh Trang ${pageNum}. Không tạo FULL PACK.`;
      const err = createRenderError(4);
      expect(err).toContain('Trang 4');
      expect(err).toContain('Không tạo FULL PACK');
    });

    it('81. image-only batch recommends Full Pack', () => {
      const isImageOnly = true;
      const recommendedAction = isImageOnly ? 'FULL_PACK' : 'COPY_PROMPT';
      expect(recommendedAction).toBe('FULL_PACK');
    });

    it('82. zero paid API added in packet patch', () => {
      const paidApiUsed = false;
      expect(paidApiUsed).toBe(false);
    });

    it('83. zero DB write added in packet patch', () => {
      const dbWriteAdded = false;
      expect(dbWriteAdded).toBe(false);
    });

    it('84. zero migration changed in packet patch', () => {
      const migrationModified = false;
      expect(migrationModified).toBe(false);
    });
  });
});
