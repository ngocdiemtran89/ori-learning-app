/**
 * Pure Validation Engine for Phase 3.5C TOEIC Test Bank
 */

import { isValidSlug } from './vocabularyValidation';
import {
  normalizeToeicPart,
  isQuestionNumberValidForPart,
  expectedOptionCountForPart,
  expectedFullTestQuestionCount,
  CANONICAL_TOEIC_PARTS,
} from '../toeic/testStructure';

export { normalizeToeicPart };

export interface ToeicTestInput {
  id?: string;
  title: string;
  slug: string;
  test_code?: string | null;
  description?: string | null;
  test_type?: 'full' | 'mini' | 'custom';
  status?: string;
  sort_order?: number;
  is_published?: boolean;
}

export interface ToeicTestGroupInput {
  id?: string;
  test_id?: string;
  part: string;
  group_type: string;
  title?: string | null;
  instruction?: string | null;
  passage?: string | null;
  transcript?: string | null;
  audio_url?: string | null;
  image_url?: string | null;
  documents?: any[];
  sort_order?: number;
  is_active?: boolean;
}

export interface ToeicTestQuestionInput {
  id?: string;
  test_id?: string;
  group_id?: string | null;
  question_number: number;
  part: string;
  question_text?: string | null;
  options: string[];
  correct_answer: string;
  explanation?: string | null;
  skill_tag?: string | null;
  topic?: string | null;
  difficulty?: string | null;
  audio_url?: string | null;
  image_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * Validate Test header draft input
 */
export function validateToeicTestDraft(input: ToeicTestInput): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.title || !input.title.trim()) {
    errors.title = 'Tên đề thi không được để trống.';
  }

  if (!input.slug || !input.slug.trim()) {
    errors.slug = 'Slug URL không được để trống.';
  } else if (!isValidSlug(input.slug)) {
    errors.slug = 'Slug chỉ chứa chữ cái thường (a-z), chữ số (0-9) và dấu gạch ngang đơn.';
  }

  if (typeof input.sort_order !== 'undefined' && (typeof input.sort_order !== 'number' || !Number.isInteger(input.sort_order) || input.sort_order < 0)) {
    errors.sort_order = 'Thứ tự sắp xếp phải là số nguyên lớn hơn hoặc bằng 0.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate Test Group input
 */
export function validateToeicTestGroup(input: ToeicTestGroupInput): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  const normPart = normalizeToeicPart(input.part);
  if (!CANONICAL_TOEIC_PARTS.includes(normPart)) {
    errors.push('TOEIC Part không hợp lệ.');
  }

  if (!input.group_type || !input.group_type.trim()) {
    errors.push('Loại nhóm (group_type) không được để trống.');
  }

  if ((normPart === 'part6' || normPart === 'part7') && input.documents && !Array.isArray(input.documents)) {
    errors.push('Danh sách tài liệu (documents) phải là mảng hợp lệ.');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate individual Test Question input
 */
export function validateToeicTestQuestion(input: ToeicTestQuestionInput): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof input.question_number !== 'number' || !Number.isInteger(input.question_number) || input.question_number < 1 || input.question_number > 200) {
    errors.push('Số thứ tự câu hỏi (question_number) phải từ 1 đến 200.');
  }

  const normPart = normalizeToeicPart(input.part);
  if (!isQuestionNumberValidForPart(input.question_number, normPart)) {
    errors.push(`Câu hỏi số ${input.question_number} không thuộc dải câu hỏi quy định của ${normPart.toUpperCase()}.`);
  }

  const expectedOpts = expectedOptionCountForPart(normPart);
  const opts = Array.isArray(input.options) ? input.options.map((o) => String(o || '').trim()) : [];

  if (opts.length !== expectedOpts) {
    errors.push(`${normPart.toUpperCase()} yêu cầu chính xác ${expectedOpts} lựa chọn đáp án.`);
  } else {
    if (opts.some((o) => !o)) {
      errors.push('Các lựa chọn đáp án không được để trống.');
    }
    const uniqueOpts = new Set(opts);
    if (uniqueOpts.size !== opts.length) {
      errors.push('Các lựa chọn đáp án không được trùng lặp.');
    }
    const ans = (input.correct_answer || '').trim().toUpperCase();
    const validLetters = expectedOpts === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
    
    if (!validLetters.includes(ans)) {
      errors.push(`Đáp án đúng phải là một trong các giá trị hợp lệ (${validLetters.join('/')}).`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Check if a question material edit occurs (should rotate identity for safety)
 */
export function shouldRotateTestQuestionIdentity(
  original: ToeicTestQuestionInput,
  edited: ToeicTestQuestionInput
): boolean {
  const qChanged = (original.question_text || '').trim() !== (edited.question_text || '').trim();
  const ansChanged = (original.correct_answer || '').trim() !== (edited.correct_answer || '').trim();

  const origOpts = (Array.isArray(original.options) ? original.options : []).map((o) => String(o || '').trim()).join('|||');
  const editOpts = (Array.isArray(edited.options) ? edited.options : []).map((o) => String(o || '').trim()).join('|||');
  const optsChanged = origOpts !== editOpts;

  return qChanged || ansChanged || optsChanged;
}

/**
 * Full Test Publish Validation (STRICT 200-question check for Full Tests)
 */
export function validateToeicTestForPublish(
  test: ToeicTestInput,
  groups: ToeicTestGroupInput[],
  questions: ToeicTestQuestionInput[]
): { isValid: boolean; errors: string[]; missingNumbers: number[] } {
  const errors: string[] = [];
  const missingNumbers: number[] = [];

  const draftVal = validateToeicTestDraft(test);
  if (!draftVal.isValid) {
    Object.values(draftVal.errors).forEach((e) => errors.push(e));
  }

  const activeQs = questions.filter((q) => q.is_active !== false);

  // Check duplicate question numbers
  const numSet = new Set<number>();
  activeQs.forEach((q) => {
    if (numSet.has(q.question_number)) {
      errors.push(`Trùng lặp số thứ tự câu hỏi #${q.question_number}.`);
    }
    numSet.add(q.question_number);
  });

  // Validate structural soundness of all active questions
  activeQs.forEach((q) => {
    const qVal = validateToeicTestQuestion(q);
    if (!qVal.isValid) {
      qVal.errors.forEach((e) => errors.push(`Câu #${q.question_number}: ${e}`));
    }
    
    // Group part consistency & Media validation
    if (q.group_id) {
      const g = groups.find(grp => grp.id === q.group_id);
      if (g) {
        if (normalizeToeicPart(g.part) !== normalizeToeicPart(q.part)) {
          errors.push(`Câu #${q.question_number}: Part của câu hỏi (${q.part}) không khớp với Part của nhóm (${g.part}).`);
        }
      }
    }

    const normPart = normalizeToeicPart(q.part);
    const g = q.group_id ? groups.find(grp => grp.id === q.group_id) : null;
    
    if (normPart === 'part1') {
      if (!q.image_url && (!g || !g.image_url)) {
        errors.push(`Câu #${q.question_number} (Part 1): Thiếu hình ảnh (cần có ở cấp độ câu hỏi hoặc nhóm).`);
      }
    } else if (normPart === 'part2') {
      if (!q.audio_url && (!g || !g.audio_url)) {
        errors.push(`Câu #${q.question_number} (Part 2): Thiếu audio (cần có ở cấp độ câu hỏi hoặc nhóm).`);
      }
    } else if (normPart === 'part3' || normPart === 'part4') {
      if (!g || !g.audio_url) {
        errors.push(`Câu #${q.question_number} (${normPart.toUpperCase()}): Nhóm cha bắt buộc phải có audio.`);
      }
    }
  });

  // Strict check for full test (must have all 200 questions)
  if (test.test_type === 'full' || !test.test_type) {
    for (let i = 1; i <= expectedFullTestQuestionCount(); i++) {
      if (!numSet.has(i)) {
        missingNumbers.push(i);
      }
    }

    if (missingNumbers.length > 0) {
      errors.push(`Đề thi Full Test chưa hoàn thiện (còn thiếu ${missingNumbers.length} câu hỏi). Hãy bổ sung đầy đủ 200 câu từ câu 1 đến 200 trước khi xuất bản.`);
    }
  }

  return { isValid: errors.length === 0, errors, missingNumbers };
}
