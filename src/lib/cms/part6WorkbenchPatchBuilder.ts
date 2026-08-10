/**
 * Helper to build TRUE PATCH payloads for Part 6 Manual Workbench.
 * Compares original DB snapshot against current user draft state and emits ONLY changed fields.
 */

export interface QuestionSnapshot {
  question_number: number;
  question_text?: string;
  translation_vi?: string;
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
  question_text?: string;
  translation_vi?: string;
  options: [string, string, string, string];
  options_vi: [string, string, string, string];
}

export interface Part6Range {
  label: string;
  start: number;
  end: number;
}

export interface Part6GroupResolverResult {
  group: any | null;
  questions: any[];
  error?: string;
}

const normalizePart = (val: unknown): string =>
  typeof val === 'string' ? val.trim().toLowerCase() : '';

/**
 * Strict Deterministic Resolver for Part 6 Groups & Questions
 * Derives target group ONLY from exact 4-question membership matching the active canonical range.
 * Zero metadata or positional guessing.
 */
export function resolvePart6GroupForRange(
  existingGroups: any[],
  existingQuestions: any[],
  activeRange: Part6Range
): Part6GroupResolverResult {
  const expectedNumbers = [
    activeRange.start,
    activeRange.start + 1,
    activeRange.start + 2,
    activeRange.end,
  ];

  if (!existingGroups || existingGroups.length === 0) {
    return { group: null, questions: [], error: 'Nhóm câu hỏi đang không khớp dữ liệu. Vui lòng tải lại trang.' };
  }

  // 1. Filter active Part6 questions matching expected canonical numbers
  const rangeQuestions = (existingQuestions || [])
    .filter(q => {
      const isP6 = normalizePart(q.part) === 'part6';
      return isP6 && expectedNumbers.includes(q.question_number) && q.is_active !== false;
    })
    .sort((a, b) => a.question_number - b.question_number);

  // 2. Validate exact 4-question count and numbers
  if (rangeQuestions.length !== 4) {
    return { group: null, questions: rangeQuestions, error: 'Nhóm câu hỏi đang không khớp dữ liệu. Vui lòng tải lại trang.' };
  }

  const qNums = rangeQuestions.map(q => q.question_number);
  const qNumsMatch = expectedNumbers.every((num, idx) => num === qNums[idx]);
  if (!qNumsMatch) {
    return { group: null, questions: rangeQuestions, error: 'Nhóm câu hỏi đang không khớp dữ liệu. Vui lòng tải lại trang.' };
  }

  // 3. Require every question has a valid, non-empty group_id
  const hasInvalidGroupId = rangeQuestions.some(q => !q.group_id || typeof q.group_id !== 'string' || q.group_id.trim() === '');
  if (hasInvalidGroupId) {
    return { group: null, questions: rangeQuestions, error: 'Nhóm câu hỏi đang không khớp dữ liệu. Vui lòng tải lại trang.' };
  }

  // 4. Require exactly ONE distinct group_id across all 4 questions
  const distinctGroupIds = Array.from(new Set(rangeQuestions.map(q => q.group_id.trim())));
  if (distinctGroupIds.length !== 1) {
    return { group: null, questions: rangeQuestions, error: 'Nhóm câu hỏi đang không khớp dữ liệu. Vui lòng tải lại trang.' };
  }

  const derivedGroupId = distinctGroupIds[0];

  // 5. Look up targetGroup in existingGroups using exact group_id and strict part check ONLY
  const targetGroup = existingGroups.find(g => {
    return g.id === derivedGroupId && normalizePart(g.part) === 'part6' && g.is_active !== false;
  }) || null;

  if (!targetGroup) {
    return { group: null, questions: rangeQuestions, error: 'Nhóm câu hỏi đang không khớp dữ liệu. Vui lòng tải lại trang.' };
  }

  return {
    group: targetGroup,
    questions: rangeQuestions,
  };
}

/**
 * Strict Canonical Option Normalizer for TOEIC Questions
 * Safely converts any DB/historical options shape into [string, string, string, string].
 *
 * Supported Shapes (based strictly on repository evidence):
 * A. Plain string array: ["years", "space", "beauty", "moisture"]
 * B. Object array with text: [{"label":"A", "text":"years"}, {"label":"B", "text":"space"}, ...] or [{"text":"years"}, ...]
 *    - If label ("A", "B", "C", "D") exists, maps deterministically to slot 0, 1, 2, 3.
 *    - If label is missing, maps by array position.
 * C. Letter-key object: {"A":"years", "B":"space", "C":"beauty", "D":"moisture"}
 * D. Numeric-key object: {"0":"years", "1":"space", "2":"beauty", "3":"moisture"}
 * E. Null / Undefined / Malformed / Unknown Object -> ["", "", "", ""]
 *
 * STRICT CONSTRAINTS:
 * - NO speculative property guessing (val.value, val.content, val.option, etc. REMOVED).
 * - NO arbitrary string-property fallback looping.
 * - NO label-only text conversion ({"label":"A"} -> "" NOT "A").
 * - NO raw object stringification (never returns "[object Object]").
 */
export function normalizeToeicOptions(rawInput: any): [string, string, string, string] {
  const result: [string, string, string, string] = ['', '', '', ''];
  if (!rawInput) return result;

  const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, a: 0, b: 1, c: 2, d: 3 };

  const extractTextFromItem = (item: any): string => {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string') return item;
    if (typeof item === 'number' || typeof item === 'boolean') return String(item);
    if (typeof item === 'object') {
      if (typeof item.text === 'string') {
        return item.text;
      }
    }
    return '';
  };

  // Shape 1: Array
  if (Array.isArray(rawInput)) {
    for (let i = 0; i < rawInput.length; i++) {
      const item = rawInput[i];
      if (item && typeof item === 'object' && typeof item.label === 'string' && item.label.trim() in letterMap) {
        const slot = letterMap[item.label.trim()];
        result[slot] = extractTextFromItem(item);
      } else if (i < 4) {
        result[i] = extractTextFromItem(item);
      }
    }
    return result;
  }

  // Shape 2: Object
  if (typeof rawInput === 'object') {
    let foundLetterKey = false;
    for (const [key, val] of Object.entries(rawInput)) {
      const cleanKey = key.trim();
      if (cleanKey in letterMap) {
        foundLetterKey = true;
        result[letterMap[cleanKey]] = extractTextFromItem(val);
      }
    }
    if (foundLetterKey) return result;

    for (let i = 0; i < 4; i++) {
      const strIdx = String(i);
      if (strIdx in rawInput) {
        result[i] = extractTextFromItem(rawInput[strIdx]);
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

    // Optional question_text check (only if present in state/snapshot)
    if (curQ.question_text !== undefined && snapQ.question_text !== undefined) {
      const snapQTextTrim = (snapQ.question_text || '').trim();
      const curQTextTrim = (curQ.question_text || '').trim();
      if (curQTextTrim !== snapQTextTrim) {
        qHasChanges = true;
        qPatch.question_text = curQTextTrim !== '' ? curQTextTrim : null;
      }
    }

    // Optional translation_vi check (only if present in state/snapshot)
    if (curQ.translation_vi !== undefined && snapQ.translation_vi !== undefined) {
      const snapTransViTrim = (snapQ.translation_vi || '').trim();
      const curTransViTrim = (curQ.translation_vi || '').trim();
      if (curTransViTrim !== snapTransViTrim) {
        qHasChanges = true;
        qPatch.translation_vi = curTransViTrim !== '' ? curTransViTrim : null;
      }
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
