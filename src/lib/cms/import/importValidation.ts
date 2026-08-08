/**
 * Import Validation & Preflight Engine for Phase 3.5 Bulk Import Center
 * Reuses existing CMS validation logic.
 * STRICT RULE: ALL IMPORTED CONTENT IS FORCED DRAFT (is_published = false).
 */

import {
  ImportContentType,
  ImportFileFormat,
  ImportParsedRecord,
  ImportRowError,
  ImportRowWarning,
} from './types';
import { parseCsvContent } from './parseCsv';
import { parseJsonContent } from './parseJson';
import { isValidSlug, normalizeToeicParts } from '../vocabularyValidation';
import { validateGrammarLessonDraft } from '../grammarValidation';
import { validateListeningLessonDraft, validateListeningQuestion } from '../listeningValidation';
import { validateReadingLessonDraft, validateReadingQuestion } from '../readingValidation';

export const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMPORT_RECORD_COUNT = 1000; // 1000 records max

/**
 * Validate file size and record count limits
 */
export function validateImportLimits(fileSize: number, recordCount: number): string | null {
  if (fileSize > MAX_IMPORT_FILE_SIZE_BYTES) {
    return `Kích thước file (${(fileSize / (1024 * 1024)).toFixed(1)} MB) vượt quá giới hạn cho phép (tối đa 5 MB).`;
  }
  if (recordCount > MAX_IMPORT_RECORD_COUNT) {
    return `Số lượng bản ghi (${recordCount}) vượt quá giới hạn tối đa (1000 bản ghi mỗi lượt nhập).`;
  }
  return null;
}

/**
 * Parse raw file content based on content type and format
 */
export function parseImportFileContent(
  content: string,
  contentType: ImportContentType,
  format: ImportFileFormat
): { rawRecords: any[]; parseErrors: string[] } {
  if (format === 'csv') {
    if (contentType !== 'vocabulary') {
      return {
        rawRecords: [],
        parseErrors: [`Định dạng CSV hiện tại chỉ hỗ trợ cho loại nội dung Từ Vựng (Vocabulary). Với ${contentType}, vui lòng sử dụng file JSON.`],
      };
    }
    const csvResult = parseCsvContent(content);
    return { rawRecords: csvResult.rows, parseErrors: csvResult.errors };
  }

  const jsonResult = parseJsonContent(content);
  return { rawRecords: jsonResult.records, parseErrors: jsonResult.errors };
}

/**
 * Build Import Plan for Vocabulary records
 */
export function validateVocabularyImportRecord(
  raw: any,
  rowIndex: number
): ImportParsedRecord {
  const errors: ImportRowError[] = [];
  const warnings: ImportRowWarning[] = [];

  const word = (raw.word || '').trim();
  const meaning_vi = (raw.meaning_vi || raw.meaning || '').trim();
  const ipa = (raw.ipa || '').trim();
  const part_of_speech = (raw.part_of_speech || raw.pos || '').trim();
  const example_en = (raw.example_en || raw.example || '').trim();
  const example_vi = (raw.example_vi || '').trim();
  const topic = (raw.topic || '').trim();
  const common_mistake = (raw.common_mistake || '').trim();
  const audio_url = (raw.audio_url || '').trim();
  const sort_order = typeof raw.sort_order === 'number' ? raw.sort_order : parseInt(raw.sort_order, 10) || rowIndex + 1;

  // Process array fields (pipe-delimited for CSV or array for JSON)
  let toeic_parts: string[] = [];
  if (Array.isArray(raw.toeic_parts)) {
    toeic_parts = normalizeToeicParts(raw.toeic_parts);
  } else if (typeof raw.toeic_parts === 'string') {
    toeic_parts = normalizeToeicParts(raw.toeic_parts.split('|'));
  }

  let collocations: string[] = [];
  if (Array.isArray(raw.collocations)) {
    collocations = raw.collocations.map((c: any) => String(c || '').trim()).filter(Boolean);
  } else if (typeof raw.collocations === 'string') {
    collocations = raw.collocations.split('|').map((c: string) => c.trim()).filter(Boolean);
  }

  // Required validations
  if (!word) {
    errors.push({ field: 'word', message: 'Từ vựng (word) không được để trống.', value: raw.word });
  }

  if (!meaning_vi) {
    errors.push({ field: 'meaning_vi', message: 'Nghĩa tiếng Việt (meaning_vi) không được để trống.', value: raw.meaning_vi });
  }

  // Warnings
  if (!ipa) {
    warnings.push({ field: 'ipa', message: 'Thiếu phiên âm IPA.' });
  }
  if (!example_en) {
    warnings.push({ field: 'example_en', message: 'Thiếu ví dụ câu tiếng Anh.' });
  }

  if (raw.is_published === true || raw.is_published === 'true') {
    warnings.push({ field: 'is_published', message: 'Nội dung nhập hàng loạt luôn được lưu dưới dạng bản nháp.' });
  }

  const cleanData = {
    word,
    ipa,
    part_of_speech,
    meaning_vi,
    example_en,
    example_vi,
    topic,
    toeic_parts,
    collocations,
    common_mistake,
    audio_url,
    sort_order,
    is_published: false, // FORCED DRAFT
  };

  let status = errors.length > 0 ? 'ERROR' : warnings.length > 0 ? 'WARNING' : 'VALID';

  return {
    rowIndex,
    status: status as any,
    data: cleanData,
    errors,
    warnings,
    selected: status !== 'ERROR',
  };
}

/**
 * Build Import Plan for Grammar / Listening / Reading records
 */
export function validateLessonImportRecord(
  raw: any,
  rowIndex: number,
  contentType: 'grammar' | 'listening' | 'reading'
): ImportParsedRecord {
  const errors: ImportRowError[] = [];
  const warnings: ImportRowWarning[] = [];

  const title = (raw.title || '').trim();
  const slug = (raw.slug || '').trim();
  const level = (raw.level || 'foundation').trim().toLowerCase();
  const sort_order = typeof raw.sort_order === 'number' ? raw.sort_order : parseInt(raw.sort_order, 10) || rowIndex + 1;

  if (raw.is_published === true || raw.is_published === 'true') {
    warnings.push({ field: 'is_published', message: 'Nội dung nhập hàng loạt luôn được lưu dưới dạng bản nháp.' });
  }

  if (!title) {
    errors.push({ field: 'title', message: 'Tên bài học (title) không được để trống.' });
  }

  if (!slug || !isValidSlug(slug)) {
    errors.push({ field: 'slug', message: 'Slug URL không hợp lệ (chỉ dùng chữ thường, số và dấu gạch ngang).' });
  }

  if (contentType === 'grammar') {
    const val = validateGrammarLessonDraft({
      title,
      slug,
      level,
      sort_order,
      summary: raw.summary,
      skill_tag: raw.skill_tag,
      sections: raw.sections,
      quiz: raw.quiz,
    });
    if (!val.isValid) {
      Object.entries(val.errors).forEach(([field, msg]) => {
        errors.push({ field, message: msg });
      });
    }
  } else if (contentType === 'listening') {
    const toeic_part = (raw.toeic_part || 'part1').trim().toLowerCase();
    const val = validateListeningLessonDraft({
      title,
      slug,
      level,
      toeic_part,
      audio_url: raw.audio_url,
      transcript: raw.transcript,
      sort_order,
      questions: raw.questions,
    });
    if (!val.isValid) {
      Object.entries(val.errors).forEach(([field, msg]) => {
        errors.push({ field, message: msg });
      });
    }
    if (!raw.audio_url) {
      warnings.push({ field: 'audio_url', message: 'Thiếu Audio URL. Bạn cần bổ sung audio trước khi xuất bản.' });
    }

    // Validate structural question soundness
    if (Array.isArray(raw.questions)) {
      raw.questions.forEach((q: any, qIdx: number) => {
        const qVal = validateListeningQuestion(q, toeic_part);
        if (!qVal.isValid) {
          qVal.errors.forEach((errMsg) => {
            errors.push({ field: `questions[${qIdx}]`, message: errMsg });
          });
        }
      });
    }
  } else if (contentType === 'reading') {
    const toeic_part = (raw.toeic_part || 'part5').trim().toLowerCase();
    const val = validateReadingLessonDraft({
      title,
      slug,
      level,
      toeic_part,
      passage: raw.passage,
      sort_order,
      questions: raw.questions,
    });
    if (!val.isValid) {
      Object.entries(val.errors).forEach(([field, msg]) => {
        errors.push({ field, message: msg });
      });
    }
    if ((toeic_part === 'part6' || toeic_part === 'part7') && (!raw.passage || !raw.passage.trim())) {
      warnings.push({ field: 'passage', message: 'Thiếu đoạn văn (passage). Cần bổ sung đoạn văn trước khi xuất bản.' });
    }

    // Validate structural question soundness
    if (Array.isArray(raw.questions)) {
      raw.questions.forEach((q: any, qIdx: number) => {
        const qVal = validateReadingQuestion(q);
        if (!qVal.isValid) {
          qVal.errors.forEach((errMsg) => {
            errors.push({ field: `questions[${qIdx}]`, message: errMsg });
          });
        }
      });
    }
  }

  const cleanData = {
    ...raw,
    title,
    slug,
    level,
    sort_order,
    is_published: false, // FORCED DRAFT
  };

  // Strip imported IDs to prevent history impersonation
  delete cleanData.id;
  delete cleanData.user_id;
  delete cleanData.deck_id;
  delete cleanData.lesson_id;

  let status = errors.length > 0 ? 'ERROR' : warnings.length > 0 ? 'WARNING' : 'VALID';

  return {
    rowIndex,
    status: status as any,
    data: cleanData,
    errors,
    warnings,
    selected: status !== 'ERROR',
  };
}

/**
 * Preflight in-file duplicate detection
 */
export function checkInFileDuplicates<T = any>(
  records: ImportParsedRecord<T>[],
  contentType: ImportContentType
): ImportParsedRecord<T>[] {
  const seenKeys = new Set<string>();

  return records.map((rec) => {
    if (rec.status === 'ERROR') return rec;

    let key = '';
    if (contentType === 'vocabulary') {
      key = ((rec.data as any).word || '').trim().toLowerCase();
    } else {
      key = ((rec.data as any).slug || '').trim().toLowerCase();
    }

    if (key && seenKeys.has(key)) {
      const err: ImportRowError = {
        field: contentType === 'vocabulary' ? 'word' : 'slug',
        message: `Trùng lặp dữ liệu "${key}" ngay trong file nhập.`,
      };
      return {
        ...rec,
        status: 'CONFLICT',
        errors: [...rec.errors, err],
        selected: false,
      };
    }

    if (key) seenKeys.add(key);
    return rec;
  });
}
