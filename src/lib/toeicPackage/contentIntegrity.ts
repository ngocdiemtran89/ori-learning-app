// ============================================================
// Phase P3.5G: ORI TOEIC Test Package - Content Integrity & Placeholder Detector
// ============================================================

import { OriToeicPackageV1 } from './types';

export interface ContentIntegrityIssue {
  severity: 'BLOCKER' | 'WARNING';
  code:
    | 'PLACEHOLDER_QUESTION_TEXT'
    | 'PLACEHOLDER_OPTION_TEXT'
    | 'PLACEHOLDER_PASSAGE'
    | 'PLACEHOLDER_DOCUMENT'
    | 'EMPTY_QUESTION_TEXT'
    | 'EMPTY_OPTION_TEXT'
    | 'EMPTY_PASSAGE';
  message: string;
  target?: string;
  question_number?: number;
  part?: string;
}

export interface ContentIntegrityReport {
  isContentComplete: boolean;
  totalQuestions: number;
  realContentQuestionsCount: number;
  placeholderQuestionsCount: number;
  blockers: ContentIntegrityIssue[];
  warnings: ContentIntegrityIssue[];
}

export const PLACEHOLDER_PATTERNS = [
  /^question\s+\d+$/i,
  /^option\s+[a-d]$/i,
  /^\([a-d]\)\s*option\s+[a-d]$/i,
  /^passage for questions\s+\d+\s*[-–]\s*\d+$/i,
  /^(single|double|triple)\s+passage\s+content\s+for\s+q\d+\s*[-–]\s*\d+$/i,
  /^single\s+document$/i,
  /^first\s+document$/i,
  /^second\s+document$/i,
  /^third\s+document$/i,
  /^document\s+\d+$/i,
];

export function isPlaceholderString(val?: any): boolean {
  if (!val) return true;
  let str = '';
  if (typeof val === 'string') {
    str = val;
  } else if (typeof val === 'object' && val !== null) {
    str = val.text || val.content || val.title || '';
  } else {
    str = String(val);
  }
  const trimmed = str.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function validateToeicContentIntegrity(pkg: OriToeicPackageV1): ContentIntegrityReport {
  const blockers: ContentIntegrityIssue[] = [];
  const warnings: ContentIntegrityIssue[] = [];
  let realContentCount = 0;
  let placeholderCount = 0;

  // 1. Group-level Passage & Document Placeholder Check
  if (Array.isArray(pkg.groups)) {
    pkg.groups.forEach((g) => {
      const gPart = g.part;
      // Parts 6 & 7 require real passage / document content
      if (['part6', 'part7'].includes(gPart)) {
        if (isPlaceholderString(g.passage)) {
          blockers.push({
            severity: 'BLOCKER',
            code: 'PLACEHOLDER_PASSAGE',
            message: `Nhóm ${gPart.toUpperCase()} (Q${g.start_question}–${g.end_question}) chứa đoạn văn dạng stubs mẫu placeholder ("${g.passage || 'trống'}").`,
            target: `Group Q${g.start_question}–${g.end_question}`,
            part: gPart,
          });
        }

        // Part 7 Document check
        if (gPart === 'part7' && Array.isArray(g.documents)) {
          g.documents.forEach((doc: any, docIdx: number) => {
            const docText = typeof doc === 'string' ? doc : doc?.content || doc?.title || '';
            if (isPlaceholderString(docText)) {
              blockers.push({
                severity: 'BLOCKER',
                code: 'PLACEHOLDER_DOCUMENT',
                message: `Nhóm Part 7 (Q${g.start_question}–${g.end_question}) chứa tài liệu document #${docIdx + 1} dạng stubs mẫu placeholder ("${docText || 'trống'}").`,
                target: `Group Q${g.start_question}–${g.end_question}`,
                part: gPart,
              });
            }
          });
        }
      }
    });
  }

  // 2. Question-level Question Text & Options Placeholder Check
  if (Array.isArray(pkg.questions)) {
    pkg.questions.forEach((q) => {
      const qNum = q.question_number;
      const qPart = q.part;

      // Part 1 & Part 2: Listening questions are heard from audio. Question text may be empty/null, and options may be letter labels.
      if (qPart === 'part1' || qPart === 'part2') {
        realContentCount++;
        return;
      }

      // Printed Parts (Part 3, Part 4, Part 5, Part 6, Part 7)
      let isQPlaceholder = false;

      // Check Question Text
      if (isPlaceholderString(q.question_text)) {
        isQPlaceholder = true;
        blockers.push({
          severity: 'BLOCKER',
          code: 'PLACEHOLDER_QUESTION_TEXT',
          message: `Câu #${qNum} (${qPart.toUpperCase()}) chứa nội dung câu hỏi dạng mẫu placeholder ("${q.question_text || 'trống'}").`,
          target: `Q${qNum}`,
          question_number: qNum,
          part: qPart,
        });
      }

      // Check Options
      const optionsArr = Array.isArray(q.options)
        ? q.options
        : Object.values(q.options || {});

      if (!optionsArr || optionsArr.length < 3) {
        isQPlaceholder = true;
        blockers.push({
          severity: 'BLOCKER',
          code: 'EMPTY_OPTION_TEXT',
          message: `Câu #${qNum} (${qPart.toUpperCase()}) thiếu danh sách lựa chọn A/B/C/D.`,
          target: `Q${qNum}`,
          question_number: qNum,
          part: qPart,
        });
      } else {
        const hasPlaceholderOption = optionsArr.some((optStr) => isPlaceholderString(optStr));
        if (hasPlaceholderOption) {
          isQPlaceholder = true;
          blockers.push({
            severity: 'BLOCKER',
            code: 'PLACEHOLDER_OPTION_TEXT',
            message: `Câu #${qNum} (${qPart.toUpperCase()}) chứa đáp án lựa chọn dạng stubs mẫu placeholder.`,
            target: `Q${qNum}`,
            question_number: qNum,
            part: qPart,
          });
        }
      }

      if (isQPlaceholder) {
        placeholderCount++;
      } else {
        realContentCount++;
      }
    });
  }

  return {
    isContentComplete: blockers.length === 0,
    totalQuestions: pkg.questions ? pkg.questions.length : 0,
    realContentQuestionsCount: realContentCount,
    placeholderQuestionsCount: placeholderCount,
    blockers,
    warnings,
  };
}
