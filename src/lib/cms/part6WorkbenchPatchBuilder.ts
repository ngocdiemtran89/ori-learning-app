/**
 * Helper to build TRUE PATCH payloads for Part 6 Manual Workbench.
 * Compares original DB snapshot against current user draft state and emits ONLY changed fields.
 */

export interface QuestionSnapshot {
  question_number: number;
  question_text: string;
  translation_vi: string;
  options: [string, string, string, string];
  options_vi: [string, string, string, string];
}

export interface GroupSnapshot {
  passageEn: string;
  passageVi: string;
  questions: QuestionSnapshot[];
}

export interface QuestionOptionState {
  id: string;
  question_number: number;
  question_text: string;
  translation_vi: string;
  options: [string, string, string, string];
  options_vi: [string, string, string, string];
}

export function buildGroupPatchPayload(
  snapshot: GroupSnapshot,
  currentPassageEn: string,
  currentPassageVi: string,
  currentQuestions: QuestionOptionState[]
): { payload: Record<string, any>; hasChanges: boolean } {
  const payload: Record<string, any> = {};
  let hasChanges = false;

  // Passage EN check
  const snapPassageEnTrim = snapshot.passageEn.trim();
  const curPassageEnTrim = currentPassageEn.trim();
  if (curPassageEnTrim !== snapPassageEnTrim) {
    hasChanges = true;
    payload.passage = curPassageEnTrim !== '' ? curPassageEnTrim : null;
  }

  // Passage VI check
  const snapPassageViTrim = snapshot.passageVi.trim();
  const curPassageViTrim = currentPassageVi.trim();
  if (curPassageViTrim !== snapPassageViTrim) {
    hasChanges = true;
    payload.passage_vi = curPassageViTrim !== '' ? curPassageViTrim : null;
  }

  // Questions check
  const questionPatches: Record<string, any>[] = [];

  for (const curQ of currentQuestions) {
    const snapQ = snapshot.questions.find(sq => sq.question_number === curQ.question_number);
    if (!snapQ) continue;

    const qPatch: Record<string, any> = {
      question_number: curQ.question_number,
    };
    let qHasChanges = false;

    // question_text check
    const snapQTextTrim = snapQ.question_text.trim();
    const curQTextTrim = curQ.question_text.trim();
    if (curQTextTrim !== snapQTextTrim) {
      qHasChanges = true;
      qPatch.question_text = curQTextTrim !== '' ? curQTextTrim : null;
    }

    // translation_vi check
    const snapTransViTrim = snapQ.translation_vi.trim();
    const curTransViTrim = curQ.translation_vi.trim();
    if (curTransViTrim !== snapTransViTrim) {
      qHasChanges = true;
      qPatch.translation_vi = curTransViTrim !== '' ? curTransViTrim : null;
    }

    // options (EN) check
    const optsChanged = curQ.options.some((opt, i) => opt !== snapQ.options[i]);
    if (optsChanged) {
      qHasChanges = true;
      qPatch.options = [...curQ.options];
    }

    // options_vi check
    const optsViChanged = curQ.options_vi.some((opt, i) => opt !== snapQ.options_vi[i]);
    if (optsViChanged) {
      qHasChanges = true;
      qPatch.options_vi = [...curQ.options_vi];
    }

    if (qHasChanges) {
      hasChanges = true;
      questionPatches.push(qPatch);
    }
  }

  if (questionPatches.length > 0) {
    payload.questions = questionPatches;
  }

  return { payload, hasChanges };
}
