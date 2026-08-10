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

/**
 * Canonical Option Normalizer for TOEIC Questions
 * Safely converts any DB/historical options shape into [string, string, string, string].
 * Supports:
 * - Plain string array: ["years", "space", "beauty", "moisture"]
 * - Object array: [{"label":"A","text":"years"}, ...] or [{"text":"years"}, ...] or [{"value":"years"}, ...]
 * - Letter-key object: {"A":"years", "B":"space", "C":"beauty", "D":"moisture"}
 * - Numeric-key object: {"0":"years", "1":"space", "2":"beauty", "3":"moisture"}
 * - Null / undefined / malformed -> ["", "", "", ""]
 *
 * NEVER calls String(object) directly on a raw object.
 */
export function normalizeToeicOptions(rawInput: any): [string, string, string, string] {
  const result: [string, string, string, string] = ['', '', '', ''];
  if (!rawInput) return result;

  const extractString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
      if (typeof val.text === 'string') return val.text;
      if (typeof val.value === 'string') return val.value;
      if (typeof val.content === 'string') return val.content;
      if (typeof val.option === 'string') return val.option;
      if (typeof val.label === 'string' && val.text) return String(val.text);
      
      const keys = Object.keys(val);
      for (const k of keys) {
        if (k !== 'label' && typeof val[k] === 'string') {
          return val[k];
        }
      }
    }
    return '';
  };

  // Shape 1: Array (string array or object array)
  if (Array.isArray(rawInput)) {
    for (let i = 0; i < 4; i++) {
      if (i < rawInput.length) {
        result[i] = extractString(rawInput[i]);
      }
    }
    return result;
  }

  // Shape 2: Object
  if (typeof rawInput === 'object') {
    const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, a: 0, b: 1, c: 2, d: 3 };
    let foundLetterKey = false;
    for (const [key, val] of Object.entries(rawInput)) {
      const cleanKey = key.trim();
      if (cleanKey in letterMap) {
        foundLetterKey = true;
        result[letterMap[cleanKey]] = extractString(val);
      }
    }
    if (foundLetterKey) return result;

    for (let i = 0; i < 4; i++) {
      const strIdx = String(i);
      if (strIdx in rawInput) {
        result[i] = extractString(rawInput[strIdx]);
      }
    }
    return result;
  }

  return result;
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
