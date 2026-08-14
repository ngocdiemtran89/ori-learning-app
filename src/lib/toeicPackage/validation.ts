// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Package Validator
// ============================================================

import { OriToeicPackageV1, ToeicPackageValidationReport, PackageIssue, getCanonicalToeicGroupType } from './types';
import { validateToeicContentIntegrity } from './contentIntegrity';

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
    blockers.push({
      severity: 'BLOCKER',
      code: 'P3_GROUP_COUNT_MISMATCH',
      message: `Part 3 phải có đúng 13 nhóm câu hỏi (hiện tại: ${p3GroupCount}/13).`,
    });
  }

  if (p4GroupCount !== 10) {
    blockers.push({
      severity: 'BLOCKER',
      code: 'P4_GROUP_COUNT_MISMATCH',
      message: `Part 4 phải có đúng 10 nhóm câu hỏi (hiện tại: ${p4GroupCount}/10).`,
    });
  }

  // 2.5 Group Type Validation
  pkg.groups.forEach((g) => {
    const expectedType = getCanonicalToeicGroupType(g.part);
    if (!g.group_type || !g.group_type.trim()) {
      blockers.push({
        severity: 'BLOCKER',
        code: 'MISSING_GROUP_TYPE',
        message: `Nhóm câu Part ${g.part} (Q${g.start_question}–${g.end_question}) chưa có group_type hợp lệ.`,
        target: `Q${g.start_question}–${g.end_question}`,
      });
    } else {
      const actualType = g.group_type.trim().toLowerCase();
      if (
        (g.part === 'part3' && actualType !== 'conversation') ||
        (g.part === 'part4' && actualType !== 'talk') ||
        (g.part === 'part6' && actualType !== 'text_completion') ||
        (g.part === 'part7' && !['reading_set', 'single_passage', 'double_passage', 'triple_passage'].includes(actualType))
      ) {
        blockers.push({
          severity: 'BLOCKER',
          code: 'INVALID_GROUP_TYPE_PAIRING',
          message: `Nhóm câu Part ${g.part} (Q${g.start_question}–${g.end_question}) có group_type '${g.group_type}' không khớp với cấu trúc Production (kỳ vọng '${expectedType}').`,
          target: `Q${g.start_question}–${g.end_question}`,
        });
      }
    }
  });

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

    // Part 2 Special Rule: Q7..Q31 answers MUST be A, B, or C only!
    if (ans.question_number >= 7 && ans.question_number <= 31 && ans.correct_answer === 'D') {
      blockers.push({
        severity: 'BLOCKER',
        code: 'INVALID_PART2_ANSWER_D',
        message: `Câu Part 2 #${ans.question_number} không thể có đáp án "D" (chỉ nhận A, B, C).`,
        target: `Q${ans.question_number}`,
      });
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
    blockers.push({
      severity: 'BLOCKER',
      code: 'MISSING_ANSWERS',
      message: `Còn thiếu đáp án cho ${missingAnswerCount} câu hỏi (cần đủ 200/200 đáp án).`,
    });
  }

  // 4. Media & Image Checks
  let readyMediaCount = 0;
  let p1AudioCount = 0;
  let p2AudioCount = 0;
  let p3GroupAudioCount = 0;
  let p4GroupAudioCount = 0;
  let p1ImageCount = 0;

  // Track media target collisions & physical files
  const p1ImageFiles = new Map<any, number>();

  pkg.media.forEach((m) => {
    if (m.status === 'conflict') {
      blockers.push({
        severity: 'BLOCKER',
        code: 'DUPLICATE_MEDIA_TARGET',
        message: m.error || `Phát hiện nhiều file media cùng gán vào đối tượng ${m.targetNumberOrRange}.`,
        target: m.targetNumberOrRange,
      });
    } else if (m.status === 'ready') {
      readyMediaCount++;
      if (m.mediaType === 'audio') {
        if (m.part === 1) p1AudioCount++;
        else if (m.part === 2) p2AudioCount++;
        else if (m.part === 3) p3GroupAudioCount++;
        else if (m.part === 4) p4GroupAudioCount++;
      } else if (m.mediaType === 'image' && m.part === 1) {
        p1ImageCount++;
        if (m.file) {
          if (p1ImageFiles.has(m.file)) {
            blockers.push({
              severity: 'BLOCKER',
              code: 'DUPLICATE_P1_IMAGE_FILE',
              message: `Hình ảnh Part 1 bị dùng trùng lặp cho ${m.targetNumberOrRange} và Q${p1ImageFiles.get(m.file)}.`,
              target: m.targetNumberOrRange,
            });
          } else {
            const qNum = parseInt(m.targetNumberOrRange.replace(/[^0-9]+/g, ''), 10);
            p1ImageFiles.set(m.file, qNum);
          }
        }
      }
    }
  });

  // Check Part 1 Images Q1..Q6
  let missingImageCount = 0;
  for (let qNum = 1; qNum <= 6; qNum++) {
    const q = qMap.get(qNum);
    const hasImage = Boolean(q?.image_url || q?.local_image_file);
    if (!hasImage) {
      missingImageCount++;
      blockers.push({
        severity: 'BLOCKER',
        code: 'MISSING_P1_IMAGE_QUESTION',
        message: `Thiếu hình ảnh Part 1 cho câu #${qNum} (bấm 'Tự trích ảnh' hoặc 'Cắt từ PDF').`,
        target: `Q${qNum}`,
      });
    }
  }

  // Check Listening Audio completeness (54 physical clips: 6 P1, 25 P2, 13 P3, 10 P4)
  let missingAudioCount = 0;
  if (pkg.test.listening_audio_mode === 'segmented') {
    for (let qNum = 1; qNum <= 6; qNum++) {
      const q = qMap.get(qNum);
      if (!q?.audio_url && !q?.local_audio_file) {
        missingAudioCount++;
        blockers.push({
          severity: 'BLOCKER',
          code: 'MISSING_P1_AUDIO',
          message: `Thiếu file audio Part 1 clip ${qNum < 10 ? '0' : ''}${qNum} → Q${qNum}.`,
          target: `Q${qNum}`,
        });
      }
    }

    for (let qNum = 7; qNum <= 31; qNum++) {
      const q = qMap.get(qNum);
      const localIdx = qNum - 6;
      if (!q?.audio_url && !q?.local_audio_file) {
        missingAudioCount++;
        blockers.push({
          severity: 'BLOCKER',
          code: 'MISSING_P2_AUDIO',
          message: `Thiếu file audio Part 2 clip ${localIdx < 10 ? '0' : ''}${localIdx} → Q${qNum}.`,
          target: `Q${qNum}`,
        });
      }
    }

    pkg.groups.forEach((g) => {
      if (g.part === 'part3' && !g.audio_url && !g.local_audio_file) {
        missingAudioCount++;
        const localIdx = Math.floor((g.start_question - 32) / 3) + 1;
        blockers.push({
          severity: 'BLOCKER',
          code: 'MISSING_P3_AUDIO',
          message: `Thiếu file audio Part 3 nhóm ${localIdx < 10 ? '0' : ''}${localIdx} → Q${g.start_question}–${g.end_question}.`,
          target: `Q${g.start_question}–${g.end_question}`,
        });
      } else if (g.part === 'part4' && !g.audio_url && !g.local_audio_file) {
        missingAudioCount++;
        const localIdx = Math.floor((g.start_question - 71) / 3) + 1;
        blockers.push({
          severity: 'BLOCKER',
          code: 'MISSING_P4_AUDIO',
          message: `Thiếu file audio Part 4 nhóm ${localIdx < 10 ? '0' : ''}${localIdx} → Q${g.start_question}–${g.end_question}.`,
          target: `Q${g.start_question}–${g.end_question}`,
        });
      }
    });
  }

  const totalAudioFiles = p1AudioCount + p2AudioCount + p3GroupAudioCount + p4GroupAudioCount;

  // 5. Numbering Conventions & Ambiguity Validation
  const conventions = (pkg.media as any)?.conventions || {
    p2Convention: 'P2_NONE',
    p3Convention: 'P3_NONE',
    p4Convention: 'P4_NONE',
  };

  if (conventions.p2Convention === 'P2_NUMBERING_AMBIGUOUS') {
    blockers.push({
      severity: 'BLOCKER',
      code: 'P2_NUMBERING_AMBIGUOUS',
      message: 'Không xác định được cách đánh số audio Part 2. Hệ thống hỗ trợ: 1–25 = số clip nội bộ hoặc 7–31 = số câu TOEIC.',
    });
  }
  if (conventions.p3Convention === 'P3_NUMBERING_AMBIGUOUS') {
    blockers.push({
      severity: 'BLOCKER',
      code: 'P3_NUMBERING_AMBIGUOUS',
      message: 'Không xác định được cách đánh số audio Part 3. Hệ thống hỗ trợ: 1–13 = clip nội bộ hoặc 32-34..68-70 = dải câu TOEIC.',
    });
  }
  if (conventions.p4Convention === 'P4_NUMBERING_AMBIGUOUS') {
    blockers.push({
      severity: 'BLOCKER',
      code: 'P4_NUMBERING_AMBIGUOUS',
      message: 'Không xác định được cách đánh số audio Part 4. Hệ thống hỗ trợ: 1–10 = clip nội bộ hoặc 71-73..98-100 = dải câu TOEIC.',
    });
  }

  // Content Integrity & Placeholder Detection
  const contentReport = validateToeicContentIntegrity(pkg);
  if (!contentReport.isContentComplete) {
    contentReport.blockers.forEach((b) => {
      blockers.push({
        severity: b.severity,
        code: b.code,
        message: b.message,
        target: b.target,
      });
    });
  }

  // isValidForDraft is strictly blockers.length === 0
  const isValidForDraft = blockers.length === 0;

  return {
    isValidForDraft,
    blockers,
    warnings,
    infos,
    counts: {
      totalQuestions: pkg.questions.length,
      partCounts,
      totalGroups: pkg.groups.length,
      p3GroupCount,
      p4GroupCount,
      p6GroupCount,
      p7GroupCount,
      totalAnswers: pkg.answers.length,
      p1AudioCount,
      p2AudioCount,
      p3GroupAudioCount,
      p4GroupAudioCount,
      totalAudioFiles,
      p1ImageCount,
      readyMediaCount,
      missingAudioCount,
      missingImageCount,
      missingAnswerCount,
      conventions,
      realContentQuestionsCount: contentReport.realContentQuestionsCount,
      placeholderQuestionsCount: contentReport.placeholderQuestionsCount,
    },
  };
}
