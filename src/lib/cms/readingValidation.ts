/**
 * Pure Validation Helpers for Phase 3.4 Reading CMS
 */

import { isValidSlug } from './vocabularyValidation';
import {
  executeSafeQuestionReplacement,
  shouldRotateLearningQuestionIdentity,
  QuestionReplacementDeps,
} from './learningQuestionReplacement';

export {
  executeSafeQuestionReplacement,
  shouldRotateLearningQuestionIdentity,
  type QuestionReplacementDeps,
};

export type HistoryCheckStatus = 'YES' | 'NO' | 'ERROR';

export interface HistoryCheckResult {
  hasHistory: boolean;
  status: HistoryCheckStatus;
  error: string | null;
}

/**
 * Pure decision helper for combining history queries into a safe HistoryCheckResult.
 * Safety Default: If any query errored, returns status: 'ERROR', hasHistory: true.
 */
export function combineHistoryQueryResults(results: Array<{ dataCount: number; error: any }>): HistoryCheckResult {
  for (const r of results) {
    if (r.error) {
      return {
        hasHistory: true,
        status: 'ERROR',
        error: 'Không thể kiểm tra lịch sử học viên lúc này. Thay đổi này chưa được thực hiện để bảo vệ dữ liệu tiến độ.',
      };
    }
  }

  const totalCount = results.reduce((acc, r) => acc + (r.dataCount || 0), 0);
  if (totalCount > 0) {
    return {
      hasHistory: true,
      status: 'YES',
      error: null,
    };
  }

  return {
    hasHistory: false,
    status: 'NO',
    error: null,
  };
}

export const VALID_READING_TOEIC_PARTS = ['part5', 'part6', 'part7'] as const;
export type ReadingToeicPart = (typeof VALID_READING_TOEIC_PARTS)[number];

export interface ReadingQuestionInput {
  id?: string;
  lesson_id?: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation?: string | null;
  sort_order?: number;
  is_active?: boolean;
  skill_tag?: string | null;
  topic?: string | null;
  image_url?: string | null;
}

export interface ReadingLessonCMSInput {
  title: string;
  slug: string;
  level: string;
  toeic_part: string;
  passage?: string | null;
  sort_order?: number;
  questions?: ReadingQuestionInput[];
}

export interface ReadingValidationResult {
  isValid: boolean;
  canPublish: boolean;
  errors: Record<string, string>;
  warnings: string[];
}

/**
 * Normalize single TOEIC Reading Part string (e.g. 'Part 5', 'part 5', '5' -> 'part5')
 */
export function normalizeReadingToeicPart(part: string | null | undefined): string {
  if (!part) return '';
  const clean = part.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (clean.includes('part5') || clean === '5') return 'part5';
  if (clean.includes('part6') || clean === '6') return 'part6';
  if (clean.includes('part7') || clean === '7') return 'part7';
  return clean;
}

/**
 * Detects material passage changes between original and edited text
 */
export function hasMaterialPassageChange(
  origPassage: string | null | undefined,
  editedPassage: string | null | undefined
): boolean {
  const normOrig = (origPassage || '').trim().replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
  const normEdit = (editedPassage || '').trim().replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
  return normOrig !== normEdit;
}

/**
 * Validate single Reading question input
 */
export function validateReadingQuestion(input: ReadingQuestionInput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.question_text || !input.question_text.trim()) {
    errors.push('Nội dung câu hỏi không được để trống.');
  }

  const rawOptions = Array.isArray(input.options) ? input.options : [];
  const cleanOptions = rawOptions.map((o) => (o || '').trim());

  if (cleanOptions.length !== 4 || cleanOptions.some((o) => o === '')) {
    errors.push('Câu hỏi Reading phải có đủ 4 lựa chọn A, B, C, D không được để trống.');
  }

  const uniqueOptions = new Set(cleanOptions);
  if (uniqueOptions.size < cleanOptions.length) {
    errors.push('Các lựa chọn đáp án không được trùng lặp.');
  }

  const cleanAnswer = (input.correct_answer || '').trim();
  if (!cleanAnswer) {
    errors.push('Vui lòng chọn đáp án đúng.');
  } else if (!cleanOptions.includes(cleanAnswer)) {
    errors.push('Đáp án đúng phải trùng khớp hoàn toàn với một trong các lựa chọn đáp án.');
  }

  if (typeof input.sort_order === 'number') {
    if (input.sort_order < 0 || !Number.isInteger(input.sort_order)) {
      errors.push('Thứ tự câu hỏi phải là số nguyên không âm.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Reading Lesson Draft
 */
export function validateReadingLessonDraft(input: ReadingLessonCMSInput): ReadingValidationResult {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  if (!input.title || !input.title.trim()) {
    errors.title = 'Tên bài học Reading không được để trống.';
  }

  if (!input.slug || !isValidSlug(input.slug)) {
    errors.slug = 'Slug URL không hợp lệ (chỉ dùng chữ cái thường, số và dấu gạch ngang).';
  }

  const validLevels = ['foundation', 'intermediate', 'advanced'];
  if (!input.level || !validLevels.includes(input.level.toLowerCase().trim())) {
    errors.level = 'Trình độ phải là Foundation, Intermediate, hoặc Advanced.';
  }

  const normPart = normalizeReadingToeicPart(input.toeic_part);
  if (!VALID_READING_TOEIC_PARTS.includes(normPart as any)) {
    errors.toeic_part = 'Reading chỉ chấp nhận TOEIC Part 5, Part 6, hoặc Part 7.';
  }

  if (typeof input.sort_order === 'number') {
    if (input.sort_order < 0 || !Number.isInteger(input.sort_order)) {
      errors.sort_order = 'Thứ tự bài học phải là số nguyên không âm.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    canPublish: false,
    errors,
    warnings,
  };
}

/**
 * Validate Reading Lesson For Publish
 */
export function validateReadingLessonForPublish(input: ReadingLessonCMSInput): ReadingValidationResult {
  const draftResult = validateReadingLessonDraft(input);
  const errors = { ...draftResult.errors };
  const warnings = [...draftResult.warnings];

  const normPart = normalizeReadingToeicPart(input.toeic_part);
  const cleanPassage = (input.passage || '').trim();

  // Part 6 & Part 7 require non-empty passage
  if ((normPart === 'part6' || normPart === 'part7') && !cleanPassage) {
    errors.passage = `Bài Reading ${normPart.toUpperCase()} yêu cầu nội dung đoạn văn (passage) trước khi xuất bản.`;
  }

  const questions = input.questions || [];
  const activeQuestions = questions.filter((q) => q.is_active !== false);

  if (activeQuestions.length === 0) {
    errors.questions = 'Bài học phải có ít nhất 1 câu hỏi đang hoạt động (active) để xuất bản.';
  } else {
    for (let i = 0; i < activeQuestions.length; i++) {
      const qVal = validateReadingQuestion(activeQuestions[i]);
      if (!qVal.isValid) {
        errors.questions = `Câu hỏi thứ ${i + 1} không hợp lệ: ${qVal.errors[0]}`;
        break;
      }
    }
  }

  if (activeQuestions.length > 0 && activeQuestions.length < 5) {
    warnings.push('Bài có ít hơn 5 câu hỏi. ORI có thể cần thêm dữ liệu trước khi phân tích chính xác.');
  }

  const canPublish = Object.keys(errors).length === 0;

  return {
    isValid: canPublish,
    canPublish,
    errors,
    warnings,
  };
}
