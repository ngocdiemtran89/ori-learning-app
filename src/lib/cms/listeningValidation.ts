/**
 * Pure Validation Helpers for Phase 3.3 Listening CMS
 */

import { isValidSlug } from './vocabularyValidation';

/**
 * Normalize single TOEIC Part string (e.g. 'Part 2', 'part 2', '2' -> 'part2')
 */
export function normalizeToeicPart(part: string | null | undefined): string {
  if (!part) return '';
  const clean = part.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (clean.includes('part1') || clean === '1') return 'part1';
  if (clean.includes('part2') || clean === '2') return 'part2';
  if (clean.includes('part3') || clean === '3') return 'part3';
  if (clean.includes('part4') || clean === '4') return 'part4';
  if (clean.includes('part5') || clean === '5') return 'part5';
  if (clean.includes('part6') || clean === '6') return 'part6';
  if (clean.includes('part7') || clean === '7') return 'part7';
  return clean;
}

export interface ListeningQuestionInput {
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

export interface ListeningLessonCMSInput {
  title: string;
  slug: string;
  level: string;
  toeic_part: string;
  audio_url?: string | null;
  transcript?: string | null;
  sort_order: number;
  questions: ListeningQuestionInput[];
}

/**
 * Valid Listening TOEIC parts (part1, part2, part3, part4)
 */
export const VALID_LISTENING_TOEIC_PARTS = ['part1', 'part2', 'part3', 'part4'] as const;

/**
 * Get expected option count based on TOEIC Part (Part 2 uses 3 options; Parts 1, 3, 4 use 4 options)
 */
export function expectedOptionCountForToeicPart(toeicPart: string): number {
  const norm = normalizeToeicPart(toeicPart);
  if (norm === 'part2') return 3;
  return 4;
}

/**
 * Detect material question edits that require key/ID rotation on published questions.
 * Material changes: question_text, options list/order, or correct_answer.
 * Non-material changes: explanation, skill_tag, topic, image_url, sort_order, is_active.
 */
export function shouldRotateLearningQuestionIdentity(
  original: ListeningQuestionInput,
  edited: ListeningQuestionInput
): boolean {
  if (!original || !original.id) return false;

  const qChanged = (original.question_text || '').trim() !== (edited.question_text || '').trim();
  const ansChanged = (original.correct_answer || '').trim() !== (edited.correct_answer || '').trim();

  const origOpts = (Array.isArray(original.options) ? original.options : []).map((o) => o.trim()).join('|||');
  const editOpts = (Array.isArray(edited.options) ? edited.options : []).map((o) => o.trim()).join('|||');
  const optsChanged = origOpts !== editOpts;

  return qChanged || ansChanged || optsChanged;
}

/**
 * Validate individual Listening question
 */
export function validateListeningQuestion(
  q: ListeningQuestionInput,
  toeicPart: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const expectedCount = expectedOptionCountForToeicPart(toeicPart);
  const normPart = normalizeToeicPart(toeicPart);

  if (!q.question_text || !q.question_text.trim()) {
    errors.push('Nội dung câu hỏi không được để trống.');
  }

  const opts = Array.isArray(q.options) ? q.options : [];
  if (opts.length !== expectedCount) {
    errors.push(`TOEIC ${normPart.toUpperCase()} yêu cầu chính xác ${expectedCount} lựa chọn.`);
  } else {
    const trimmedOpts = opts.map((o) => o.trim());
    if (trimmedOpts.some((o) => !o)) {
      errors.push('Các lựa chọn không được để trống.');
    }
    const uniqueOpts = new Set(trimmedOpts);
    if (uniqueOpts.size !== trimmedOpts.length) {
      errors.push('Các lựa chọn không được trùng lặp.');
    }
    if (q.correct_answer && !trimmedOpts.includes(q.correct_answer.trim())) {
      errors.push('Đáp án đúng phải trùng khớp với 1 trong các lựa chọn.');
    }
  }

  if (!q.correct_answer || !q.correct_answer.trim()) {
    errors.push('Chưa chọn đáp án đúng.');
  }

  // TOEIC Part 1 requires image_url for active question
  if (normPart === 'part1' && (!q.image_url || !q.image_url.trim())) {
    errors.push('TOEIC Part 1 yêu cầu URL hình ảnh (image_url) cho câu hỏi.');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate Listening lesson draft input
 */
export function validateListeningLessonDraft(input: ListeningLessonCMSInput): {
  isValid: boolean;
  errors: Record<string, string>;
} {
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

  const normPart = normalizeToeicPart(input.toeic_part);
  if (!VALID_LISTENING_TOEIC_PARTS.includes(normPart as any)) {
    errors.toeic_part = 'Listening chỉ chấp nhận TOEIC Part 1, Part 2, Part 3, hoặc Part 4.';
  }

  if (typeof input.sort_order !== 'number' || !Number.isInteger(input.sort_order) || input.sort_order < 0) {
    errors.sort_order = 'Thứ tự hiển thị phải là số nguyên lớn hơn hoặc bằng 0.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate Listening lesson for Publishing
 */
export function validateListeningLessonForPublish(input: ListeningLessonCMSInput): {
  canPublish: boolean;
  errors: Record<string, string>;
  warnings: string[];
} {
  const draftValidation = validateListeningLessonDraft(input);
  const errors: Record<string, string> = { ...draftValidation.errors };
  const warnings: string[] = [];

  if (!input.audio_url || !input.audio_url.trim()) {
    errors.audio_url = 'Bài Listening phải có URL file âm thanh (Audio URL) trước khi xuất bản.';
  }

  const activeQuestions = (input.questions || []).filter((q) => q.is_active !== false);

  if (activeQuestions.length === 0) {
    errors.questions = 'Cần ít nhất 1 câu hỏi trắc nghiệm đang hoạt động (Active) trước khi xuất bản.';
  } else {
    for (let i = 0; i < activeQuestions.length; i++) {
      const qVal = validateListeningQuestion(activeQuestions[i], input.toeic_part);
      if (!qVal.isValid) {
        errors.questions = `Câu hỏi thứ ${i + 1} chưa hợp lệ: ${qVal.errors.join(' ')}`;
        break;
      }
    }

    if (activeQuestions.length < 5) {
      warnings.push(
        `Bài có ít hơn 5 câu hỏi (${activeQuestions.length}/5). ORI có thể cần thêm dữ liệu trước khi phân tích chính xác.`
      );
    }
  }

  return {
    canPublish: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}
