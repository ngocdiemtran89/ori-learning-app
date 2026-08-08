import { describe, it, expect } from 'vitest';
import {
  validateImportLimits,
  parseImportFileContent,
  validateVocabularyImportRecord,
  validateLessonImportRecord,
  checkInFileDuplicates,
  MAX_IMPORT_FILE_SIZE_BYTES,
  MAX_IMPORT_RECORD_COUNT,
} from './importValidation';
import { parseCsvContent } from './parseCsv';

describe('Phase 3.5 — Bulk Content Import Center Validation Tests', () => {
  it('CASE A & B: File size (>5MB) and record count (>1000) limit checks', () => {
    const sizeErr = validateImportLimits(MAX_IMPORT_FILE_SIZE_BYTES + 1024, 10);
    expect(sizeErr).toContain('vượt quá giới hạn cho phép');

    const countErr = validateImportLimits(1024, MAX_IMPORT_RECORD_COUNT + 1);
    expect(countErr).toContain('vượt quá giới hạn tối đa');

    const validLimits = validateImportLimits(1024, 500);
    expect(validLimits).toBeNull();
  });

  it('CASE C: Invalid JSON parsing', () => {
    const res = parseImportFileContent('{ invalid json ', 'grammar', 'json');
    expect(res.parseErrors.length).toBeGreaterThan(0);
    expect(res.parseErrors[0]).toContain('Lỗi cú pháp JSON');
  });

  it('CASE D & J: In-file duplicate detection (Word & Slug)', () => {
    const vocabRecords = [
      validateVocabularyImportRecord({ word: 'appointment', meaning_vi: 'cuộc hẹn', ipa: '/əˈpɔɪnt.mənt/', example_en: 'I have an appointment.' }, 1),
      validateVocabularyImportRecord({ word: 'Appointment', meaning_vi: 'lịch hẹn', ipa: '/əˈpɔɪnt.mənt/', example_en: 'I have an appointment.' }, 2),
    ];
    const checkedVocab = checkInFileDuplicates(vocabRecords, 'vocabulary');
    expect(checkedVocab[0].status).toBe('VALID');
    expect(checkedVocab[1].status).toBe('CONFLICT');
    expect(checkedVocab[1].errors[0].message).toContain('Trùng lặp dữ liệu');

    const grammarRecords = [
      validateLessonImportRecord({ title: 'T1', slug: 'present-simple', level: 'foundation' }, 1, 'grammar'),
      validateLessonImportRecord({ title: 'T2', slug: 'present-simple', level: 'foundation' }, 2, 'grammar'),
    ];
    const checkedGrammar = checkInFileDuplicates(grammarRecords, 'grammar');
    expect(checkedGrammar[0].status).toBe('VALID');
    expect(checkedGrammar[1].status).toBe('CONFLICT');
  });

  it('CASE E & F: Forced Draft and Untrusted Database IDs stripping', () => {
    const raw = {
      id: 'hacker-uuid-123',
      user_id: 'user-999',
      word: 'implement',
      meaning_vi: 'thực thi',
      is_published: true, // Attempt auto-publish
    };
    const rec = validateVocabularyImportRecord(raw, 1);
    expect(rec.data.is_published).toBe(false); // FORCED DRAFT
    expect(rec.warnings.some((w) => w.field === 'is_published')).toBe(true);

    const lessonRaw = {
      id: 'legacy-lesson-id',
      lesson_id: 'legacy-lesson-id',
      title: 'Grammar Test',
      slug: 'grammar-test-slug',
      level: 'foundation',
      is_published: true,
    };
    const lessonRec = validateLessonImportRecord(lessonRaw, 1, 'grammar');
    expect(lessonRec.data.is_published).toBe(false);
    expect((lessonRec.data as any).id).toBeUndefined();
    expect((lessonRec.data as any).lesson_id).toBeUndefined();
  });

  it('CASE G, H, I: RFC 4180 CSV parsing (quoted commas) and pipe array delimiters', () => {
    const csvStr = `word,ipa,part_of_speech,meaning_vi,example_en,example_vi,topic,toeic_parts,collocations
"appointment","/əˈpɔɪnt.mənt/","noun","cuộc hẹn, lịch hẹn","I have an appointment.","Tôi có lịch hẹn.",Business,"part2|part5","make an appointment|schedule an appointment"`;

    const parsedCsv = parseCsvContent(csvStr);
    expect(parsedCsv.rows).toHaveLength(1);
    expect(parsedCsv.rows[0].meaning_vi).toBe('cuộc hẹn, lịch hẹn');

    const rec = validateVocabularyImportRecord(parsedCsv.rows[0], 1);
    expect(rec.status).toBe('VALID');
    expect(rec.data.toeic_parts).toEqual(['part2', 'part5']);
    expect(rec.data.collocations).toEqual(['make an appointment', 'schedule an appointment']);
  });

  it('CASE L, M: Valid Grammar JSON import plan', () => {
    const rawGrammar = {
      title: 'Thì Hiện Tại Đơn',
      slug: 'grammar-present-simple-import',
      level: 'foundation',
      summary: 'Tóm tắt',
      sections: [{ heading: 'H1', body: 'B1' }],
      quiz: [{ question: 'Q1?', options: ['A', 'B', 'C', 'D'], answer: 'A' }],
    };
    const rec = validateLessonImportRecord(rawGrammar, 1, 'grammar');
    expect(rec.status).toBe('VALID');
    expect(rec.data.is_published).toBe(false);
  });

  it('CASE P, Q: Listening Part 2 (3 options vs 4 options)', () => {
    const part2Valid = {
      title: 'Listening Part 2 #1',
      slug: 'listening-part2-import-1',
      level: 'foundation',
      toeic_part: 'part2',
      audio_url: 'https://example.com/audio.mp3',
      questions: [{ question_text: 'Where?', options: ['A', 'B', 'C'], correct_answer: 'A' }],
    };
    const recValid = validateLessonImportRecord(part2Valid, 1, 'listening');
    expect(recValid.status).toBe('VALID');

    const part2Invalid = {
      title: 'Listening Part 2 #2',
      slug: 'listening-part2-import-2',
      level: 'foundation',
      toeic_part: 'part2',
      audio_url: 'https://example.com/audio.mp3',
      questions: [{ question_text: 'Where?', options: ['A', 'B', 'C', 'D'], correct_answer: 'A' }],
    };
    const recInvalid = validateLessonImportRecord(part2Invalid, 2, 'listening');
    expect(recInvalid.status).toBe('ERROR');
  });

  it('CASE T, U, V, W: Reading Part 5, 6, 7, 2 validation', () => {
    // Part 5 no passage -> valid draft (T)
    const part5 = {
      title: 'Reading Part 5',
      slug: 'reading-part5-import',
      level: 'foundation',
      toeic_part: 'part5',
      passage: '',
      questions: [{ question_text: 'Q?', options: ['A', 'B', 'C', 'D'], correct_answer: 'A' }],
    };
    expect(validateLessonImportRecord(part5, 1, 'reading').status).toBe('VALID');

    // Part 6 no passage -> warning (U)
    const part6NoPassage = {
      title: 'Reading Part 6',
      slug: 'reading-part6-import',
      level: 'intermediate',
      toeic_part: 'part6',
      passage: '',
      questions: [{ question_text: 'Q?', options: ['A', 'B', 'C', 'D'], correct_answer: 'A' }],
    };
    const recPart6 = validateLessonImportRecord(part6NoPassage, 2, 'reading');
    expect(recPart6.status).toBe('WARNING');
    expect(recPart6.warnings[0].field).toBe('passage');

    // Part 7 valid passage -> valid (V)
    const part7Valid = {
      title: 'Reading Part 7',
      slug: 'reading-part7-import',
      level: 'advanced',
      toeic_part: 'part7',
      passage: 'Passage text...',
      questions: [{ question_text: 'Q?', options: ['A', 'B', 'C', 'D'], correct_answer: 'A' }],
    };
    expect(validateLessonImportRecord(part7Valid, 3, 'reading').status).toBe('VALID');

    // Reading Part 2 -> error (W)
    const readingPart2 = {
      title: 'Reading Part 2',
      slug: 'reading-part2-invalid',
      level: 'foundation',
      toeic_part: 'part2',
    };
    expect(validateLessonImportRecord(readingPart2, 4, 'reading').status).toBe('ERROR');
  });

  it('Phase 3.5B — Preservation of Educational Text (- + =)', () => {
    const csvStr = `word,ipa,part_of_speech,meaning_vi,example_en,example_vi
"- Please contact reception.",/ipa/,noun,"- Vui lòng liên hệ tân lễ.","+ VAT applies","=SUM(A1:A2)"`;

    const parsed = parseCsvContent(csvStr);
    expect(parsed.rows[0].word).toBe('- Please contact reception.');
    expect(parsed.rows[0].example_en).toBe('+ VAT applies');
    expect(parsed.rows[0].example_vi).toBe('=SUM(A1:A2)');
  });
});
