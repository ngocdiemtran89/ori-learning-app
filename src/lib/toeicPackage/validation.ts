// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Package Validator
// ============================================================

import { OriToeicPackageV1, ToeicPackageValidationReport, PackageIssue } from './types';

export function validateToeicPackage(pkg: OriToeicPackageV1): ToeicPackageValidationReport {
  const blockers: PackageIssue[] = [];
  const warnings: PackageIssue[] = [];
  const infos: PackageIssue[] = [];

  const partCounts: Record<string, number> = {
    part1: 0,
    part2: 0,
    part3: 0,
    part4: 0,
    part5: 0,
    part6: 0,
    part7: 0,
  };

  // 1. Question Number & Part Bounds Validation
  const seenQNums = new Set<number>();
  const qMap = new Map<number, typeof pkg.questions[0]>();

  pkg.questions.forEach((q) => {
    if (q.question_number < 1 || q.question_number > 200) {
      blockers.push({
        severity: 'BLOCKER',
        code: 'QUESTION_OUT_OF_BOUNDS',
        message: `Câu hỏi #${q.question_number} nằm ngoài phạm vi 1–200.`,
        target: `Q${q.question_number}`,
      });
      return;
    }

    if (seenQNums.has(q.question_number)) {
      blockers.push({
        severity: 'BLOCKER',
        code: 'DUPLICATE_QUESTION_NUMBER',
        message: `Phát hiện câu hỏi trùng lặp số câu #${q.question_number}.`,
        target: `Q${q.question_number}`,
      });
      return;
    }

    seenQNums.add(q.question_number);
    qMap.set(q.question_number, q);
    if (q.part in partCounts) {
      partCounts[q.part]++;
    }

    // Part boundary enforcement
    const qNum = q.question_number;
    let expectedPart = '';
    if (qNum >= 1 && qNum <= 6) expectedPart = 'part1';
    else if (qNum >= 7 && qNum <= 31) expectedPart = 'part2';
    else if (qNum >= 32 && qNum <= 70) expectedPart = 'part3';
    else if (qNum >= 71 && qNum <= 100) expectedPart = 'part4';
    else if (qNum >= 101 && qNum <= 130) expectedPart = 'part5';
    else if (qNum >= 131 && qNum <= 146) expectedPart = 'part6';
    else if (qNum >= 147 && qNum <= 200) expectedPart = 'part7';

    if (q.part !== expectedPart) {
      blockers.push({
        severity: 'BLOCKER',
        code: 'INCORRECT_PART_ASSIGNMENT',
        message: `Câu #${qNum} thuộc ${q.part} không đúng với cấu trúc TOEIC chuẩn (${expectedPart}).`,
        target: `Q${qNum}`,
      });
    }

    // Reading Parts content checks (P5, P6, P7)
    if (['part5', 'part6', 'part7'].includes(q.part)) {
      if (!q.question_text || !q.question_text.trim()) {
        blockers.push({
          severity: 'BLOCKER',
          code: 'MISSING_QUESTION_TEXT',
          message: `Câu #${qNum} (${q.part}) thiếu nội dung câu hỏi.`,
          target: `Q${qNum}`,
        });
      }
      if (!q.options || q.options.length < 3) {
        blockers.push({
          severity: 'BLOCKER',
          code: 'MISSING_OPTIONS',
          message: `Câu #${qNum} (${q.part}) thiếu các lựa chọn A/B/C/D.`,
          target: `Q${qNum}`,
        });
      }
    }
  });

  // Check 200 complete questions
  const missingQNums: number[] = [];
  for (let i = 1; i <= 200; i++) {
    if (!seenQNums.has(i)) {
      missingQNums.push(i);
    }
  }

  if (missingQNums.length > 0) {
    blockers.push({
      severity: 'BLOCKER',
      code: 'MISSING_QUESTIONS',
      message: `Thiếu ${missingQNums.length} câu hỏi trong đề: ${missingQNums.slice(0, 10).join(', ')}${missingQNums.length > 10 ? '...' : ''}`,
    });
  }

  // 2. Group Validation
  let p3GroupCount = 0;
  let p4GroupCount = 0;
  let p6GroupCount = 0;
  let p7GroupCount = 0;

  pkg.groups.forEach((g) => {
    if (g.part === 'part3') {
      p3GroupCount++;
      if (g.end_question - g.start_question !== 2) {
        blockers.push({
          severity: 'BLOCKER',
          code: 'INVALID_P3_GROUP_RANGE',
          message: `Nhóm Part 3 Q${g.start_question}–${g.end_question} không phải đúng 3 câu.`,
          target: `Q${g.start_question}–${g.end_question}`,
        });
      }
    } else if (g.part === 'part4') {
      p4GroupCount++;
      if (g.end_question - g.start_question !== 2) {
        blockers.push({
          severity: 'BLOCKER',
          code: 'INVALID_P4_GROUP_RANGE',
          message: `Nhóm Part 4 Q${g.start_question}–${g.end_question} không phải đúng 3 câu.`,
          target: `Q${g.start_question}–${g.end_question}`,
        });
      }
    } else if (g.part === 'part6') {
      p6GroupCount++;
    } else if (g.part === 'part7') {
      p7GroupCount++;
    }
  });

  if (p3GroupCount !== 13) {
    warnings.push({
      severity: 'WARNING',
      code: 'P3_GROUP_COUNT_MISMATCH',
      message: `Part 3 có ${p3GroupCount}/13 nhóm câu hỏi.`,
    });
  }

  if (p4GroupCount !== 10) {
    warnings.push({
      severity: 'WARNING',
      code: 'P4_GROUP_COUNT_MISMATCH',
      message: `Part 4 có ${p4GroupCount}/10 nhóm câu hỏi.`,
    });
  }

  // 3. Answer Key Validation
  const seenAnsQNums = new Set<number>();
  const ansMap = new Map<number, 'A' | 'B' | 'C' | 'D'>();

  pkg.answers.forEach((ans) => {
    if (seenAnsQNums.has(ans.question_number)) {
      blockers.push({
        severity: 'BLOCKER',
        code: 'DUPLICATE_ANSWER_KEY',
        message: `Phát hiện 2 đáp án trùng lặp cho câu #${ans.question_number}.`,
        target: `Q${ans.question_number}`,
      });
      return;
    }

    if (!['A', 'B', 'C', 'D'].includes(ans.correct_answer)) {
      blockers.push({
        severity: 'BLOCKER',
        code: 'INVALID_ANSWER_LABEL',
        message: `Đáp án "${ans.correct_answer}" tại câu #${ans.question_number} không hợp lệ.`,
        target: `Q${ans.question_number}`,
      });
      return;
    }

    seenAnsQNums.add(ans.question_number);
    ansMap.set(ans.question_number, ans.correct_answer);
  });

  let missingAnswerCount = 0;
  for (let i = 1; i <= 200; i++) {
    if (!ansMap.has(i)) {
      missingAnswerCount++;
    }
  }

  if (missingAnswerCount > 0) {
    warnings.push({
      severity: 'WARNING',
      code: 'MISSING_ANSWERS',
      message: `Còn thiếu đáp án cho ${missingAnswerCount} câu hỏi.`,
    });
  }

  // 4. Media & Image Checks
  let readyMediaCount = 0;
  let missingAudioCount = 0;
  let missingImageCount = 0;

  pkg.media.forEach((m) => {
    if (m.status === 'conflict') {
      blockers.push({
        severity: 'BLOCKER',
        code: 'DUPLICATE_MEDIA_TARGET',
        message: `Phát hiện nhiều file media cùng gán vào đối tượng ${m.targetNumberOrRange}.`,
        target: m.targetNumberOrRange,
      });
    } else if (m.status === 'ready' || m.status === 'skip') {
      readyMediaCount++;
    }
  });

  // Check Part 1 Images Q1..Q6
  for (let qNum = 1; qNum <= 6; qNum++) {
    const q = qMap.get(qNum);
    const hasImage = Boolean(q?.image_url || q?.local_image_file);
    if (!hasImage) {
      missingImageCount++;
    }
  }

  if (missingImageCount > 0) {
    warnings.push({
      severity: 'WARNING',
      code: 'MISSING_P1_IMAGES',
      message: `Thiếu ${missingImageCount} hình ảnh Part 1.`,
    });
  }

  // Check Audio Q1..Q100
  if (pkg.test.listening_audio_mode === 'segmented') {
    for (let qNum = 1; qNum <= 31; qNum++) {
      const q = qMap.get(qNum);
      if (!q?.audio_url && !q?.local_audio_file) {
        missingAudioCount++;
      }
    }
    // Groups Q32-70 & Q71-100
    pkg.groups.forEach((g) => {
      if ((g.part === 'part3' || g.part === 'part4') && !g.audio_url && !g.local_audio_file) {
        missingAudioCount++;
      }
    });

    if (missingAudioCount > 0) {
      warnings.push({
        severity: 'WARNING',
        code: 'MISSING_LISTENING_AUDIO',
        message: `Thiếu ${missingAudioCount} file audio Listening.`,
      });
    }
  }

  // 5. Bilingual Info
  let missingViCount = 0;
  pkg.questions.forEach((q) => {
    if (!q.translation_vi) missingViCount++;
  });
  if (missingViCount > 0) {
    infos.push({
      severity: 'INFO',
      code: 'MISSING_VIETNAMESE_TRANSLATIONS',
      message: `Còn ${missingViCount} câu chưa có bản dịch tiếng Việt.`,
    });
  }

  const isValidForDraft = blockers.length === 0;

  return {
    isValidForDraft,
    blockers,
    warnings,
    infos,
    counts: {
      totalQuestions: seenQNums.size,
      partCounts,
      totalGroups: pkg.groups.length,
      p3GroupCount,
      p4GroupCount,
      p6GroupCount,
      p7GroupCount,
      totalAnswers: seenAnsQNums.size,
      readyMediaCount,
      missingAudioCount,
      missingImageCount,
      missingAnswerCount,
    },
  };
}
