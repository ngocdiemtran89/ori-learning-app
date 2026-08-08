import { ParsedToeicTestDraft } from './types';

export function validateParsedDraftForImport(draft: ParsedToeicTestDraft): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Metadata check
  if (!draft.metadata.title) errors.push('Tên đề thi không được để trống.');
  if (!draft.metadata.slug) errors.push('Slug đề thi không được để trống.');

  // Check 200 questions
  if (draft.metadata.test_type === 'full') {
    if (draft.summary.detectedQuestions < 200) {
      // In phase 3.5D it says: 
      // "Since Test Bank draft can be incomplete, it is acceptable to import incomplete Draft if database-required fields are valid."
      // So we will NOT block on missing questions for a DRAFT import.
    }
  }

  // Check critical duplicate numbers
  if (draft.summary.duplicateNumbers.length > 0) {
    errors.push(`Trùng lặp số thứ tự câu hỏi: ${draft.summary.duplicateNumbers.join(', ')}`);
  }

  // Database requirements:
  // - correct_answer cannot be null
  // - part must be valid
  // - option count must match what the database might strictly require, though technically JSONB accepts anything.
  // We will enforce correct_answer required.
  const missingAns = draft.questions.filter(q => !q.correct_answer);
  if (missingAns.length > 0) {
    errors.push(`Vẫn còn ${missingAns.length} câu hỏi chưa có đáp án đúng. Vui lòng cập nhật đáp án trước khi Nhập (Database yêu cầu trường này).`);
  }

  // Check that all question parts match expected
  // In `classifyToeicTest` we assigned expectedPart based on `question_number`. 
  // If user edited question_number manually in review UI, we should enforce re-calculation. We'll assume the UI re-calculates.
  const invalidParts = draft.questions.filter(q => !['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7'].includes(q.part));
  if (invalidParts.length > 0) {
     errors.push('Tồn tại câu hỏi có phân loại Part không hợp lệ.');
  }

  // Enforce option counts and non-empty options
  const invalidOptions = draft.questions.filter(q => {
    const expectedCount = q.part === 'part2' ? 3 : 4;
    if (q.options.length !== expectedCount) return true;
    return q.options.some(opt => typeof opt !== 'string' || opt.trim() === '');
  });

  if (invalidOptions.length > 0) {
    const invalidNumbers = invalidOptions.map(q => q.question_number).join(', ');
    errors.push(`Tồn tại câu hỏi có số lượng hoặc nội dung đáp án (options) không hợp lệ (Câu: ${invalidNumbers}). Vui lòng cập nhật.`);
  }

  // Also enforce missing question_number
  const missingNum = draft.questions.filter(q => !q.question_number || typeof q.question_number !== 'number');
  if (missingNum.length > 0) {
    errors.push('Tồn tại câu hỏi bị thiếu số thứ tự câu (question_number).');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
