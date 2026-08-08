/**
 * Pure Validation & Format Helpers for Phase 3.2 Grammar CMS
 */

import { isValidSlug } from './vocabularyValidation';

export interface GrammarSectionInput {
  section_key?: string;
  heading: string;
  body: string;
  examples: string[];
}

export interface GrammarQuizQuestionInput {
  question_key?: string;
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  is_active?: boolean;
}

export interface GrammarLessonCMSInput {
  title: string;
  slug: string;
  level: string;
  summary?: string;
  skill_tag: string;
  sort_order: number;
  sections: GrammarSectionInput[];
  quiz: GrammarQuizQuestionInput[];
}

/**
 * Parse line-separated text into array of trimmed strings
 */
export function parseExamples(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Generate a new stable UUID question key for newly created CMS questions
 */
export function createNewQuestionKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `grammar:${crypto.randomUUID()}`;
  }
  return `grammar:q-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Assign stable legacy question keys (grammar:{lessonId}:{index}) for existing content lacking question_key
 */
export function ensureLegacyQuestionKeys<T extends GrammarQuizQuestionInput>(
  lessonId: string,
  quiz: T[]
): T[] {
  if (!Array.isArray(quiz)) return [];
  return quiz.map((q, idx) => ({
    ...q,
    question_key: q.question_key || `grammar:${lessonId}:${idx}`,
    is_active: q.is_active ?? true,
    options: Array.isArray(q.options) ? q.options : [],
  }));
}

/**
 * Determine if question_key should be rotated due to material content change.
 * Material changes: question text, options list/order, or correct answer.
 * Non-material changes (Explanation, is_active toggle, reordering): DO NOT rotate key.
 */
export function shouldRotateGrammarQuestionKey(
  original: GrammarQuizQuestionInput,
  edited: GrammarQuizQuestionInput
): boolean {
  if (!original) return false;

  const qChanged = (original.question || '').trim() !== (edited.question || '').trim();
  const ansChanged = (original.answer || '').trim() !== (edited.answer || '').trim();

  const origOptions = (original.options || []).map((o) => o.trim()).join('|||');
  const editOptions = (edited.options || []).map((o) => o.trim()).join('|||');
  const optChanged = origOptions !== editOptions;

  return qChanged || ansChanged || optChanged;
}

/**
 * Validate an individual active Grammar quiz question
 */
export function validateGrammarQuestion(q: GrammarQuizQuestionInput): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!q.question || !q.question.trim()) {
    errors.push('Nội dung câu hỏi không được để trống.');
  }

  if (!Array.isArray(q.options) || q.options.length !== 4) {
    errors.push('Câu hỏi phải có chính xác 4 lựa chọn (Options).');
  } else {
    const trimmedOpts = q.options.map((o) => o.trim());
    if (trimmedOpts.some((o) => !o)) {
      errors.push('Các lựa chọn không được để trống.');
    }
    const uniqueOpts = new Set(trimmedOpts);
    if (uniqueOpts.size !== trimmedOpts.length) {
      errors.push('Các lựa chọn không được trùng lặp.');
    }
    if (q.answer && !trimmedOpts.includes(q.answer.trim())) {
      errors.push('Đáp án đúng phải trùng khớp với 1 trong 4 lựa chọn.');
    }
  }

  if (!q.answer || !q.answer.trim()) {
    errors.push('Chưa chọn đáp án đúng.');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate Grammar lesson draft input
 */
export function validateGrammarLessonDraft(input: GrammarLessonCMSInput): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.title || !input.title.trim()) {
    errors.title = 'Tên bài học không được để trống.';
  }

  if (!input.slug || !input.slug.trim()) {
    errors.slug = 'Slug không được để trống.';
  } else if (!isValidSlug(input.slug)) {
    errors.slug = 'Slug chỉ chứa chữ cái thường (a-z), chữ số (0-9) và dấu gạch ngang đơn.';
  }

  if (!input.level || !input.level.trim()) {
    errors.level = 'Trình độ không được để trống.';
  }

  if (typeof input.sort_order !== 'number' || !Number.isInteger(input.sort_order) || input.sort_order < 0) {
    errors.sort_order = 'Thứ tự hiển thị phải là số nguyên lớn hơn hoặc bằng 0.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate Grammar lesson for Publishing
 */
export function validateGrammarLessonForPublish(input: GrammarLessonCMSInput): {
  canPublish: boolean;
  errors: Record<string, string>;
  warnings: string[];
} {
  const draftValidation = validateGrammarLessonDraft(input);
  const errors: Record<string, string> = { ...draftValidation.errors };
  const warnings: string[] = [];

  if (!input.skill_tag || !input.skill_tag.trim()) {
    errors.skill_tag = 'Kỹ năng phân tích (skill_tag) không được để trống khi xuất bản.';
  }

  // Require at least 1 non-empty theory section
  const validSections = (input.sections || []).filter(
    (s) => s.heading && s.heading.trim() && s.body && s.body.trim()
  );
  if (validSections.length === 0) {
    errors.sections = 'Cần ít nhất 1 phần lý thuyết (có tiêu đề và nội dung) trước khi xuất bản.';
  }

  // Count active quiz questions
  const activeQuestions = (input.quiz || []).filter((q) => q.is_active !== false);

  if (activeQuestions.length === 0) {
    errors.quiz = 'Cần ít nhất 1 câu hỏi trắc nghiệm đang hoạt động (Active) trước khi xuất bản.';
  } else {
    // Validate each active quiz question
    for (let i = 0; i < activeQuestions.length; i++) {
      const qVal = validateGrammarQuestion(activeQuestions[i]);
      if (!qVal.isValid) {
        errors.quiz = `Câu hỏi thứ ${i + 1} chưa hợp lệ: ${qVal.errors.join(' ')}`;
        break;
      }
    }

    if (activeQuestions.length < 5) {
      warnings.push(
        `Bài có ít hơn 5 câu hỏi (${activeQuestions.length}/5). ORI có thể cần thêm dữ liệu trước khi phân tích chính xác nội dung này.`
      );
    }
  }

  return {
    canPublish: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}
