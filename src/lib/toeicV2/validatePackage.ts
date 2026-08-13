// ============================================================
// ORI TOEIC Website V2 — Strict Package Validator
// ============================================================

import {
  CanonicalToeicImportPackage,
  ToeicPart,
  V2ValidationError,
  V2ValidationReport,
} from './types';
import { adaptToCanonicalPackage } from './canonicalAdapter';

export function validateV2Package(rawPkg: any): V2ValidationReport {
  const errors: V2ValidationError[] = [];
  const warnings: V2ValidationError[] = [];

  let pkg: CanonicalToeicImportPackage;
  try {
    pkg = adaptToCanonicalPackage(rawPkg);
  } catch (err: any) {
    return {
      isValid: false,
      errors: [{ code: 'ADAPTER_ERROR', message: `Lỗi cấu trúc dữ liệu JSON: ${err.message}`, severity: 'error' }],
      warnings: [],
      summary: {
        totalQuestions: 0,
        totalGroups: 0,
        partCounts: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0, P7: 0 },
        hasTranslations: false,
        mediaCount: 0,
        learningUnitsCount: 0,
      },
    };
  }

  const questions = pkg.questions || [];
  const groups = pkg.groups || [];

  const partCounts: Record<ToeicPart, number> = {
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
    P5: 0,
    P6: 0,
    P7: 0,
  };

  let mediaCount = 0;
  let hasTranslations = false;

  const addError = (code: string, message: string, question_number?: number, group_key?: string) => {
    errors.push({ code, message, question_number, group_key, severity: 'error' });
  };

  // 1. Metadata check
  if (!pkg.metadata?.title?.trim()) {
    addError('METADATA_NO_TITLE', 'Tiêu đề đề thi không được để trống.');
  }

  // 2. Deep Base64 / Data URI check in all fields
  const checkMediaUrl = (url: string | null | undefined, contextStr: string) => {
    if (!url) return;
    if (url.startsWith('data:') || url.includes('base64,')) {
      addError('BASE64_MEDIA_BLOCKED', `Không chấp nhận URL media dạng base64/data URI tại ${contextStr}.`);
    } else {
      mediaCount++;
    }
  };

  questions.forEach((q) => {
    checkMediaUrl(q.audio_url, `Câu ${q.question_number} audio`);
    checkMediaUrl(q.image_url, `Câu ${q.question_number} image`);
    if (q.translation_vi) hasTranslations = true;
  });

  groups.forEach((g) => {
    checkMediaUrl(g.audio_url, `Group ${g.group_key} audio`);
    checkMediaUrl(g.image_url, `Group ${g.group_key} image`);
    
    // Check nested documents
    if (Array.isArray(g.documents)) {
      g.documents.forEach((doc: any, dIdx: number) => {
        if (typeof doc === 'string' && (doc.startsWith('data:') || doc.includes('base64,'))) {
          addError('BASE64_MEDIA_BLOCKED', `Group ${g.group_key} document #${dIdx + 1} chứa base64.`);
        } else if (typeof doc === 'object' && doc !== null) {
          const docStr = JSON.stringify(doc);
          if (docStr.includes('data:image') || docStr.includes('base64,')) {
            addError('BASE64_MEDIA_BLOCKED', `Group ${g.group_key} document #${dIdx + 1} chứa base64.`);
          }
        }
      });
    }
  });

  // 3. Question Count & Duplicate / Missing check
  if (questions.length !== 200) {
    addError('INVALID_QUESTION_COUNT', `Tổng số câu hỏi phải đúng 200 (hiện tại: ${questions.length}).`);
  }

  const questionMap = new Map<number, typeof questions[0]>();
  const duplicateNumbers = new Set<number>();
  const cueTargets = new Set<string>();

  questions.forEach((q) => {
    const qNum = q.question_number;
    if (questionMap.has(qNum)) {
      duplicateNumbers.add(qNum);
      addError('DUPLICATE_QUESTION_NUMBER', `Trùng lặp câu hỏi số ${qNum}.`, qNum);
    } else {
      questionMap.set(qNum, q);
    }

    if (q.cue_target) {
      if (cueTargets.has(q.cue_target)) {
        addError('DUPLICATE_CUE_TARGET', `Trùng lặp cue target "${q.cue_target}".`, qNum);
      } else {
        cueTargets.add(q.cue_target);
      }
    }
  });

  // Check missing question numbers from 1 to 200
  for (let num = 1; num <= 200; num++) {
    if (!questionMap.has(num)) {
      addError('MISSING_QUESTION_NUMBER', `Thiếu câu hỏi số ${num}.`, num);
    }
  }

  // 4. Part range & mapping validation
  questions.forEach((q) => {
    const qNum = q.question_number;
    let expectedPart: ToeicPart | null = null;

    if (qNum >= 1 && qNum <= 6) expectedPart = 'P1';
    else if (qNum >= 7 && qNum <= 31) expectedPart = 'P2';
    else if (qNum >= 32 && qNum <= 70) expectedPart = 'P3';
    else if (qNum >= 71 && qNum <= 100) expectedPart = 'P4';
    else if (qNum >= 101 && qNum <= 130) expectedPart = 'P5';
    else if (qNum >= 131 && qNum <= 146) expectedPart = 'P6';
    else if (qNum >= 147 && qNum <= 200) expectedPart = 'P7';

    if (expectedPart) {
      partCounts[expectedPart]++;
      if (q.part !== expectedPart) {
        addError(
          'WRONG_PART_MAPPING',
          `Câu ${qNum} thuộc phạm vi ${expectedPart} nhưng có part "${q.part}".`,
          qNum
        );
      }
    }

    // Part 2 Special Rules (A-C only, no D answer)
    if (q.part === 'P2' || expectedPart === 'P2') {
      if (q.correct_answer === 'D') {
        addError('P2_NO_D_ANSWER', `Câu Part 2 (câu ${qNum}) không được phép có đáp án D.`, qNum);
      }

      if (Array.isArray(q.options) && q.options.length > 3) {
        const fourth = q.options[3];
        if (fourth && String(fourth).trim() !== '') {
          addError('P2_FOUR_OPTIONS_BLOCKED', `Câu Part 2 (câu ${qNum}) không được phép chứa lựa chọn thứ 4 (D).`, qNum);
        }
      }
    }
  });

  // Check strict part counts
  const expectedPartCounts: Record<ToeicPart, number> = {
    P1: 6,
    P2: 25,
    P3: 39,
    P4: 30,
    P5: 30,
    P6: 16,
    P7: 54,
  };

  (Object.keys(expectedPartCounts) as ToeicPart[]).forEach((part) => {
    if (partCounts[part] !== expectedPartCounts[part]) {
      addError(
        'INVALID_PART_TOTAL',
        `Part ${part} yêu cầu đúng ${expectedPartCounts[part]} câu (hiện có ${partCounts[part]}).`
      );
    }
  });

  // 5. Group Validation
  const groupMap = new Map<string, typeof groups[0]>();
  const groupQuestionsMap = new Map<string, number[]>();

  groups.forEach((g) => {
    if (!g.group_key) {
      addError('MISSING_GROUP_KEY', 'Nhóm câu hỏi bị thiếu group_key.');
      return;
    }
    if (groupMap.has(g.group_key)) {
      addError('DUPLICATE_GROUP_KEY', `Trùng lặp group_key "${g.group_key}".`, undefined, g.group_key);
    } else {
      groupMap.set(g.group_key, g);
      groupQuestionsMap.set(g.group_key, []);
    }
  });

  // Associate questions with groups
  questions.forEach((q) => {
    if (q.group_key) {
      if (!groupMap.has(q.group_key)) {
        addError(
          'UNRESOLVED_GROUP_KEY',
          `Câu ${q.question_number} tham chiếu tới group_key "${q.group_key}" không tồn tại.`,
          q.question_number,
          q.group_key
        );
      } else {
        groupQuestionsMap.get(q.group_key)?.push(q.question_number);
      }
    } else {
      if (['P3', 'P4', 'P6', 'P7'].includes(q.part)) {
        addError(
          'QUESTION_MISSING_GROUP',
          `Câu ${q.question_number} thuộc ${q.part} phải được gán nhóm (group_key).`,
          q.question_number
        );
      }
    }
  });

  // Check Group range & counts
  // P3: 13 groups x 3 questions
  const p3Groups = groups.filter((g) => g.part === 'P3');
  if (p3Groups.length !== 13) {
    addError('P3_GROUP_COUNT', `Part 3 phải có đúng 13 nhóm (hiện có ${p3Groups.length}).`);
  }
  p3Groups.forEach((g) => {
    const assigned = groupQuestionsMap.get(g.group_key) || [];
    if (assigned.length !== 3) {
      addError(
        'P3_GROUP_SIZE',
        `Nhóm Part 3 "${g.group_key}" phải chứa đúng 3 câu hỏi (hiện có ${assigned.length}).`,
        undefined,
        g.group_key
      );
    }
  });

  // P4: 10 groups x 3 questions
  const p4Groups = groups.filter((g) => g.part === 'P4');
  if (p4Groups.length !== 10) {
    addError('P4_GROUP_COUNT', `Part 4 phải có đúng 10 nhóm (hiện có ${p4Groups.length}).`);
  }
  p4Groups.forEach((g) => {
    const assigned = groupQuestionsMap.get(g.group_key) || [];
    if (assigned.length !== 3) {
      addError(
        'P4_GROUP_SIZE',
        `Nhóm Part 4 "${g.group_key}" phải chứa đúng 3 câu hỏi (hiện có ${assigned.length}).`,
        undefined,
        g.group_key
      );
    }
  });

  // P6: 4 groups x 4 questions
  const p6Groups = groups.filter((g) => g.part === 'P6');
  if (p6Groups.length !== 4) {
    addError('P6_GROUP_COUNT', `Part 6 phải có đúng 4 nhóm (hiện có ${p6Groups.length}).`);
  }
  p6Groups.forEach((g) => {
    const assigned = groupQuestionsMap.get(g.group_key) || [];
    if (assigned.length !== 4) {
      addError(
        'P6_GROUP_SIZE',
        `Nhóm Part 6 "${g.group_key}" phải chứa đúng 4 câu hỏi (hiện có ${assigned.length}).`,
        undefined,
        g.group_key
      );
    }
  });

  const learningUnitsCount = (pkg.learning_units?.length || 0) +
    questions.reduce((acc, q) => acc + (q.learning_units?.length || 0), 0);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalQuestions: questions.length,
      totalGroups: groups.length,
      partCounts,
      hasTranslations,
      mediaCount,
      learningUnitsCount,
    },
  };
}
