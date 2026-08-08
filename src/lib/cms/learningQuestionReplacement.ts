/**
 * Shared 6-Step Safe Question Replacement Orchestrator (Phase 3.3B & 3.4)
 * Prevents questions from being lost or orphaned during network failures or partial database errors.
 * Reused by both Listening CMS and Reading CMS.
 */

export interface QuestionReplacementDeps {
  insertInactiveNew: () => Promise<{ data: { id: string } | null; error: any }>;
  hideOld: () => Promise<{ error: any }>;
  activateNew: (newId: string) => Promise<{ data: any; error: any }>;
  restoreOld: () => Promise<{ error: any }>;
}

export async function executeSafeQuestionReplacement(
  deps: QuestionReplacementDeps
): Promise<{ data: any | null; error: string | null }> {
  // Step 1 & 2: Insert replacement question as inactive
  const insRes = await deps.insertInactiveNew();
  if (insRes.error || !insRes.data || !insRes.data.id) {
    return {
      data: null,
      error: 'Không thể lưu thay đổi câu hỏi. Nội dung cũ vẫn được giữ an toàn.',
    };
  }

  const newId = insRes.data.id;

  // Step 3 & 4: Hide old question
  const hideRes = await deps.hideOld();
  if (hideRes.error) {
    // Old stays active, new stays inactive -> safely report failure
    return {
      data: null,
      error: 'Không thể lưu thay đổi câu hỏi. Nội dung cũ vẫn được giữ an toàn.',
    };
  }

  // Step 5: Activate new replacement question
  const actRes = await deps.activateNew(newId);
  if (actRes.error || !actRes.data) {
    // Step 5 failed -> Attempt recovery: restore old question as active
    const recRes = await deps.restoreOld();
    if (!recRes.error) {
      return {
        data: null,
        error: 'Không thể kích hoạt câu hỏi mới. Nội dung cũ vẫn được giữ an toàn.',
      };
    }
    return {
      data: null,
      error: 'Lỗi nghiêm trọng khi cập nhật trạng thái câu hỏi. Vui lòng tải lại trang.',
    };
  }

  // Step 6: Success!
  return { data: actRes.data, error: null };
}

/**
 * Determines if question changes are material (question_text, options, correct_answer),
 * requiring a new UUID for historical question_attempts accuracy.
 */
export function shouldRotateLearningQuestionIdentity(
  original: { question_text: string; options: string[] | Record<string, string>; correct_answer: string },
  edited: { question_text: string; options: string[]; correct_answer: string }
): boolean {
  const origText = (original.question_text || '').trim();
  const editText = (edited.question_text || '').trim();
  if (origText !== editText) return true;

  const origAns = (original.correct_answer || '').trim();
  const editAns = (edited.correct_answer || '').trim();
  if (origAns !== editAns) return true;

  const origOpts = Array.isArray(original.options)
    ? original.options.map((o) => (o || '').trim())
    : typeof original.options === 'object' && original.options !== null
    ? Object.values(original.options).map((o) => String(o || '').trim())
    : [];

  const editOpts = (edited.options || []).map((o) => (o || '').trim());

  if (origOpts.length !== editOpts.length) return true;
  for (let i = 0; i < origOpts.length; i++) {
    if (origOpts[i] !== editOpts[i]) return true;
  }

  return false;
}
