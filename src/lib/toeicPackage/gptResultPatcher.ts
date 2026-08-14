// ============================================================
// Phase P3.5G: ORI TOEIC Test Package - GPT Result Patcher & Merger
// ============================================================

import { OriToeicPackageV1, OriPackageQuestion, OriPackageGroup, ToeicPackageValidationReport } from './types';
import { isPlaceholderString } from './contentIntegrity';
import { validateToeicPackage } from './validation';

export interface PatchOriPackageResult {
  success: boolean;
  patchedPkg: OriToeicPackageV1;
  patchedQuestionsCount: number;
  patchedGroupsCount: number;
  errors: string[];
  warnings: string[];
  report: ToeicPackageValidationReport;
}

export function patchOriToeicPackageWithGptResult(
  currentPkg: OriToeicPackageV1,
  gptJsonText: string
): PatchOriPackageResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let patchedQCount = 0;
  let patchedGCount = 0;

  let parsedJson: any = null;
  try {
    let cleanJson = gptJsonText.trim();
    // Strip markdown ```json code blocks if present
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    parsedJson = JSON.parse(cleanJson);
  } catch (err: any) {
    return {
      success: false,
      patchedPkg: currentPkg,
      patchedQuestionsCount: 0,
      patchedGroupsCount: 0,
      errors: [`Lỗi cú pháp JSON từ kết quả ChatGPT: ${err?.message || 'JSON không hợp lệ'}`],
      warnings: [],
      report: validateToeicPackage(currentPkg),
    };
  }

  // Extract questions array and groups array from parsedJson
  let rawQuestions: any[] = [];
  let rawGroups: any[] = [];

  if (Array.isArray(parsedJson)) {
    rawQuestions = parsedJson;
  } else if (typeof parsedJson === 'object' && parsedJson !== null) {
    if (Array.isArray(parsedJson.questions)) {
      rawQuestions = parsedJson.questions;
    }
    if (Array.isArray(parsedJson.groups)) {
      rawGroups = parsedJson.groups;
    }
  }

  if (rawQuestions.length === 0 && rawGroups.length === 0) {
    return {
      success: false,
      patchedPkg: currentPkg,
      patchedQuestionsCount: 0,
      patchedGroupsCount: 0,
      errors: ['Không tìm thấy danh sách câu hỏi (questions) hoặc nhóm (groups) trong mã JSON cung cấp.'],
      warnings: [],
      report: validateToeicPackage(currentPkg),
    };
  }

  // Clone currentPkg deeply to avoid mutating state before validation
  const patchedQuestions: OriPackageQuestion[] = currentPkg.questions.map((q) => ({
    ...q,
    options: Array.isArray(q.options) ? q.options.map((opt) => ({ ...opt })) : q.options,
  }));

  const patchedGroups: OriPackageGroup[] = currentPkg.groups.map((g) => ({
    ...g,
    documents: Array.isArray(g.documents) ? g.documents.map((d) => ({ ...d })) : g.documents,
  }));

  const qMap = new Map<number, OriPackageQuestion>();
  patchedQuestions.forEach((q) => qMap.set(q.question_number, q));

  // 1. MERGE QUESTIONS
  rawQuestions.forEach((impQ: any) => {
    const qNum = parseInt(impQ.questionNumber || impQ.question_number, 10);
    if (isNaN(qNum) || qNum < 1 || qNum > 200) {
      warnings.push(`Bỏ qua câu hỏi có số thứ tự không hợp lệ: ${impQ.questionNumber || impQ.question_number}`);
      return;
    }

    const targetQ = qMap.get(qNum);
    if (!targetQ) {
      warnings.push(`Không tìm thấy vị trí cho câu hỏi #${qNum} trong cấu trúc 200 câu.`);
      return;
    }

    // Do NOT patch P1/P2 question text or options if they are heard-only
    if (targetQ.part === 'part1' || targetQ.part === 'part2') {
      return;
    }

    let modified = false;

    // Question Text
    const rawQText = impQ.questionText || impQ.question_text;
    if (rawQText && typeof rawQText === 'string' && !isPlaceholderString(rawQText)) {
      targetQ.question_text = rawQText.trim();
      modified = true;
    }

    // Question Vietnamese Translation
    const rawQVi = impQ.questionVi || impQ.translation_vi || impQ.question_vi;
    if (rawQVi && typeof rawQVi === 'string') {
      targetQ.translation_vi = rawQVi.trim();
    }

    // Explanation
    if (impQ.explanation && typeof impQ.explanation === 'string') {
      targetQ.explanation = impQ.explanation.trim();
    }

    // Options
    const rawOpts = impQ.options;
    if (rawOpts) {
      const newOpts: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }> = [];

      if (Array.isArray(rawOpts)) {
        rawOpts.forEach((opt: any) => {
          if (typeof opt === 'string' && !isPlaceholderString(opt)) {
            const labelMatch = opt.match(/^\s*[\(\[]?([A-D])[\)\]\.]?\s*(.*)$/i);
            if (labelMatch) {
              newOpts.push({
                label: labelMatch[1].toUpperCase() as any,
                text: labelMatch[2].trim(),
              });
            }
          } else if (typeof opt === 'object' && opt !== null) {
            const label = (opt.label || opt.key || '').toUpperCase();
            const text = (opt.text || opt.value || '').trim();
            if (['A', 'B', 'C', 'D'].includes(label) && !isPlaceholderString(text)) {
              newOpts.push({ label: label as any, text });
            }
          }
        });
      } else if (typeof rawOpts === 'object') {
        (['A', 'B', 'C', 'D'] as const).forEach((label) => {
          const text = rawOpts[label];
          if (typeof text === 'string' && !isPlaceholderString(text)) {
            newOpts.push({ label, text: text.trim() });
          }
        });
      }

      if (newOpts.length >= 3) {
        targetQ.options = newOpts;
        modified = true;
      }
    }

    if (modified) {
      patchedQCount++;
    }
  });

  // 2. MERGE GROUPS (Part 6 & Part 7 Passages/Documents)
  rawGroups.forEach((impG: any) => {
    const startQ = parseInt(impG.startQuestion || impG.start_question, 10);
    const endQ = parseInt(impG.endQuestion || impG.end_question, 10);

    if (isNaN(startQ) || isNaN(endQ) || startQ > endQ) {
      return;
    }

    // Find group in patchedGroups that overlaps or matches start_question
    const targetG = patchedGroups.find(
      (g) => g.start_question === startQ && g.end_question === endQ
    );

    if (targetG) {
      let modified = false;

      // Passage
      const rawPassage = impG.passage || impG.passage_text;
      if (rawPassage && typeof rawPassage === 'string' && !isPlaceholderString(rawPassage)) {
        targetG.passage = rawPassage.trim();
        modified = true;
      }

      // Title / Instruction
      if (impG.instruction || impG.title) {
        targetG.title = (impG.instruction || impG.title || '').trim();
      }

      // Documents (Part 7)
      if (Array.isArray(impG.documents) && impG.documents.length > 0) {
        const validDocs = impG.documents
          .map((d: any) => {
            const content = typeof d === 'string' ? d : d.content || d.text || '';
            const title = typeof d === 'object' && d !== null ? d.title : 'Document';
            if (content && !isPlaceholderString(content)) {
              return { title, content: content.trim() };
            }
            return null;
          })
          .filter(Boolean) as Array<{ title?: string; content: string }>;

        if (validDocs.length > 0) {
          targetG.documents = validDocs;
          modified = true;
        }
      }

      if (modified) {
        patchedGCount++;
      }
    }
  });

  // Construct updated package
  const patchedPkg: OriToeicPackageV1 = {
    ...currentPkg,
    questions: patchedQuestions,
    groups: patchedGroups,
  };

  // Re-run complete package validation & content integrity check
  const report = validateToeicPackage(patchedPkg);

  return {
    success: true,
    patchedPkg,
    patchedQuestionsCount: patchedQCount,
    patchedGroupsCount: patchedGCount,
    errors,
    warnings,
    report,
  };
}
