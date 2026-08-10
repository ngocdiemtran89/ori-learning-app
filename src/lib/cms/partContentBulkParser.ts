// ============================================================
// Phase P3.5J Redesign: Admin Bulk Import TOEIC Questions By Part Parser
// Supports Separate EN / VI Panels, Strict Matching by Question Number, & Single-Pass Bilingual Updates
// ============================================================

import {
  TOEIC_FULL_TEST_STRUCTURE,
  normalizeToeicPart,
  CanonicalToeicPart,
} from '../toeic/testStructure';

export interface ParsedPartQuestion {
  question_number: number;
  part: string;
  question_text?: string;
  translation_vi?: string;
  options?: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }>;
  options_vi?: string[];
  correct_answer?: string;
  explanation?: string;
}

export interface ParsedPartGroup {
  start_question: number;
  end_question: number;
  range: string;
  part: string;
  group_type?: string;
  title?: string;
  instruction?: string;
  instruction_vi?: string;
  passage?: string;
  passage_vi?: string;
  transcript?: string;
  transcript_vi?: string;
  documents?: Array<{ title?: string; content: string }>;
  documents_vi?: Array<{ title?: string; content: string }>;
}

export interface PartParseResult {
  detectedFormat: 'json' | 'csv' | 'txt';
  targetPart: CanonicalToeicPart;
  groups: ParsedPartGroup[];
  questions: ParsedPartQuestion[];
  outOfPartErrors: string[];
  validationErrors: string[];
  metrics: {
    groupCount: number;
    questionCount: number;
    hasQuestionEnCount: number;
    hasQuestionViCount: number;
    hasOptionsEnCount: number;
    hasOptionsViCount: number;
    hasTranscriptEnCount: number;
    hasTranscriptViCount: number;
    hasAnswersCount: number;
    invalidOptionCount: number;
  };
}

export const CANONICAL_PART3_GROUPS = [
  '32-34', '35-37', '38-40', '41-43', '44-46', '47-49',
  '50-52', '53-55', '56-58', '59-61', '62-64', '65-67', '68-70'
];

export const CANONICAL_PART4_GROUPS = [
  '71-73', '74-76', '77-79', '80-82', '83-85', '86-88',
  '89-91', '92-94', '95-97', '98-100'
];

export const CANONICAL_PART6_GROUPS = [
  '131-134', '135-138', '139-142', '143-146'
];

export interface SingleLanguageQuestion {
  question_number: number;
  part: string;
  text?: string;
  options?: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }>;
  explanation?: string;
}

export interface SingleLanguageGroup {
  start_question: number;
  end_question: number;
  range: string;
  part: string;
  transcript?: string;
  passage?: string;
  documents?: Array<{ title?: string; content: string }>;
}

export function parseSingleLanguagePartText(
  input: string,
  _lang: 'en' | 'vi',
  targetPart: CanonicalToeicPart
): { groups: SingleLanguageGroup[]; questions: SingleLanguageQuestion[]; outOfPartErrors: string[] } {
  const normTargetPart = normalizeToeicPart(targetPart);
  const partRange = TOEIC_FULL_TEST_STRUCTURE[normTargetPart];

  const lines = input.split('\n');
  const groups: SingleLanguageGroup[] = [];
  const questions: SingleLanguageQuestion[] = [];
  const outOfPartErrors: string[] = [];

  let currentGroup: SingleLanguageGroup | null = null;
  let rawGroupLines: string[] = [];
  let inQuestionSectionForGroup = false;

  let currentDocs: Array<{ title?: string; content: string }> = [];
  let currentDocContent: string[] = [];

  let currentQuestion: SingleLanguageQuestion | null = null;
  let rawQuestionTextLines: string[] = [];
  let rawExplanationLines: string[] = [];
  let rawOptionsMap: Map<string, string> = new Map();
  let currentOptionLabel: string | null = null;
  let inExplanation = false;

  const finalizeQuestion = () => {
    if (!currentQuestion) return;

    if (rawQuestionTextLines.length > 0) {
      const textVal = rawQuestionTextLines.join('\n').trim();
      if (textVal) {
        currentQuestion.text = textVal;
      }
    }
    if (rawExplanationLines.length > 0) {
      currentQuestion.explanation = rawExplanationLines.join('\n').trim();
    }

    if (rawOptionsMap.size > 0) {
      const opts: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }> = [];
      ['A', 'B', 'C', 'D'].forEach(lbl => {
        if (rawOptionsMap.has(lbl)) {
          opts.push({ label: lbl as any, text: rawOptionsMap.get(lbl)! });
        }
      });
      if (opts.length > 0) currentQuestion.options = opts;
    }

    if (
      currentQuestion.question_number < partRange.startNumber ||
      currentQuestion.question_number > partRange.endNumber
    ) {
      outOfPartErrors.push(
        `Câu hỏi Q${currentQuestion.question_number} không thuộc ${normTargetPart.toUpperCase()} (Dải câu hỏi: Q${partRange.startNumber}–${partRange.endNumber}).`
      );
    } else {
      questions.push(currentQuestion);
    }

    currentQuestion = null;
    rawQuestionTextLines = [];
    rawExplanationLines = [];
    rawOptionsMap = new Map();
    currentOptionLabel = null;
    inExplanation = false;
  };

  const finalizeGroup = () => {
    if (!currentGroup) return;

    if (currentDocContent.length > 0 && currentDocs.length > 0) {
      currentDocs[currentDocs.length - 1].content = currentDocContent.join('\n').trim();
      currentDocContent = [];
    }

    if (currentDocs.length > 0) {
      currentGroup.documents = currentDocs;
    }

    if (rawGroupLines.length > 0) {
      if (normTargetPart === 'part3' || normTargetPart === 'part4') {
        currentGroup.transcript = rawGroupLines.join('\n').trim();
      } else if (normTargetPart === 'part6') {
        currentGroup.passage = rawGroupLines.join('\n').trim();
      }
    }

    groups.push(currentGroup);
    currentGroup = null;
    rawGroupLines = [];
    currentDocs = [];
    currentDocContent = [];
    inQuestionSectionForGroup = false;
  };

  const ensureAutoGroup = (qNum: number) => {
    if (normTargetPart === 'part5' || normTargetPart === 'part7') return;

    let start = qNum;
    let end = qNum;

    if (normTargetPart === 'part3' && qNum >= 32 && qNum <= 70) {
      start = Math.floor((qNum - 32) / 3) * 3 + 32;
      end = start + 2;
    } else if (normTargetPart === 'part4' && qNum >= 71 && qNum <= 100) {
      start = Math.floor((qNum - 71) / 3) * 3 + 71;
      end = start + 2;
    } else if (normTargetPart === 'part6' && qNum >= 131 && qNum <= 146) {
      start = Math.floor((qNum - 131) / 4) * 4 + 131;
      end = start + 3;
    } else {
      return;
    }

    const rangeStr = `${start}-${end}`;

    if (currentGroup && currentGroup.range === rangeStr) {
      return;
    }

    const existingG = groups.find(g => g.range === rangeStr);
    if (existingG) {
      currentGroup = existingG;
    } else {
      finalizeGroup();
      currentGroup = {
        start_question: start,
        end_question: end,
        range: rangeStr,
        part: normTargetPart,
      };
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) continue;

    const cleanHeader = trimmed
      .replace(/^[#\s]+/, '')
      .replace(/^[\*\_\s]+/, '')
      .replace(/[\*\_\s]+$/, '')
      .trim();

    if (/^(?:PART\s*[1-7]|PHẦN\s*[1-7])$/i.test(cleanHeader)) continue;

    // 1. Check Question Range Header (e.g. QUESTIONS 131-134, QUESTIONS 131 TO 134, CÂU 32–34)
    const normalizedHeader = cleanHeader.replace(/[\u2013\u2014–—~]/g, '-').replace(/\bTO\b/gi, '-');
    const rangeMatch = normalizedHeader.match(/^(?:CÂU|CAU|Q|QUESTIONS?)\s*#?\s*(\d+)\s*-\s*(\d+)/i);
    if (rangeMatch) {
      finalizeQuestion();
      finalizeGroup();

      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);

      currentGroup = {
        start_question: start,
        end_question: end,
        range: `${start}-${end}`,
        part: normTargetPart,
      };
      continue;
    }

    // 2. Check Part 7 Document Header (e.g. DOCUMENT 1)
    if (currentGroup) {
      const docMatch = cleanHeader.match(/^(?:DOCUMENT|PASSAGE|BÀI\s*ĐỌC|BẢN\s*VĂN)\s*#?\s*(\d*)\s*[-–—:]?\s*(.*)$/i);
      if (docMatch && normTargetPart === 'part7') {
        const docNum = docMatch[1] || `${currentDocs.length + 1}`;
        const docTitle = `Document ${docNum}`;
        if (currentDocContent.length > 0 && currentDocs.length > 0) {
          currentDocs[currentDocs.length - 1].content = currentDocContent.join('\n').trim();
          currentDocContent = [];
        }
        currentDocs.push({ title: docTitle, content: '' });
        continue;
      }
    }

    // 3. Check Single Question Header (e.g. CÂU 32, QUESTION 32, Q32, 131., 131)
    let qNumMatch: number | null = null;
    let initialQText = '';

    const explicitQMatch = normalizedHeader.match(/^(?:QUESTIONS?|CÂU|CAU)\s*#?\s*(\d+)\b\s*[:\.]?\s*$/i) ||
                           normalizedHeader.match(/^Q\s*#?\s*(\d+)\b\s*[:\.]?\s*$/i) ||
                           normalizedHeader.match(/^(?:QUESTIONS?|CÂU|CAU)\s*#?\s*(\d+)\b\s*[:\.]?\s+(.*)$/i);

    if (explicitQMatch) {
      qNumMatch = parseInt(explicitQMatch[1], 10);
      initialQText = explicitQMatch[2]?.trim() || '';
    } else {
      // Standalone bare question number (e.g. "131." or "131" or "131)")
      const bareQMatch = trimmed.match(/^\s*(\d{1,3})\s*[\.\)]?\s*$/);
      if (bareQMatch) {
        const n = parseInt(bareQMatch[1], 10);
        if (n >= partRange.startNumber && n <= partRange.endNumber) {
          qNumMatch = n;
        }
      }
    }

    if (qNumMatch !== null) {
      if (currentQuestion && currentQuestion.question_number === qNumMatch) {
        if (initialQText) {
          rawQuestionTextLines.push(initialQText);
        }
        continue;
      }

      finalizeQuestion();
      inQuestionSectionForGroup = true;

      ensureAutoGroup(qNumMatch);

      currentQuestion = {
        question_number: qNumMatch,
        part: normTargetPart,
      };
      if (initialQText) {
        rawQuestionTextLines.push(initialQText);
      }
      continue;
    }

    // 4. Check Explanation Header
    if (currentQuestion) {
      const isExplanationHeader = /^(?:EXPLANATION|GIẢI\s*THÍCH|LỜI\s*GIẢI)$/i.test(cleanHeader);
      if (isExplanationHeader) {
        inExplanation = true;
        currentOptionLabel = null;
        continue;
      }

      // 5. Check Option line (e.g. (A) Candy, (B) Cheese, A. Bread, A) Pasta, A: Candy)
      const optMatch = trimmed.match(/^\s*(?:[\(\[]?([A-D])[\)\]\.\:]\s*|\b([A-D])\.\s+)(.*)$/i);
      if (optMatch) {
        const label = (optMatch[1] || optMatch[2]).toUpperCase();
        const optText = optMatch[3].replace(/^[\*\_\s]+/, '').replace(/[\*\_\s]+$/, '').trim();
        rawOptionsMap.set(label, optText);
        currentOptionLabel = label;
        continue;
      }

      // 6. Multiline Option Continuation vs Question Text
      if (currentOptionLabel && rawOptionsMap.has(currentOptionLabel) && !inExplanation) {
        const existingOpt = rawOptionsMap.get(currentOptionLabel)!;
        rawOptionsMap.set(currentOptionLabel, `${existingOpt} ${trimmed.trim()}`);
        continue;
      }
    }

    // 7. Accumulate Passage/Transcript or Question Content
    if (currentQuestion) {
      const cleanLine = trimmed.replace(/^\*\*([A-Za-z0-9\s\u00C0-\u1EF9]+:)\*\*\s*/gi, '$1 ');
      if (inExplanation) {
        rawExplanationLines.push(cleanLine);
      } else {
        rawQuestionTextLines.push(cleanLine);
      }
    } else if (currentGroup && !inQuestionSectionForGroup) {
      const cleanLine = trimmed.replace(/^\*\*([A-Za-z0-9\s\u00C0-\u1EF9]+:)\*\*\s*/gi, '$1 ');
      if (normTargetPart === 'part7') {
        currentDocContent.push(cleanLine);
      } else {
        rawGroupLines.push(cleanLine);
      }
    }
  }

  finalizeQuestion();
  finalizeGroup();

  return { groups, questions, outOfPartErrors };
}

export function parseSeparateBilingualPartContent(
  enInput: string,
  viInput: string,
  targetPart: CanonicalToeicPart,
  enTranscriptInput?: string,
  viTranscriptInput?: string
): PartParseResult {
  const normTargetPart = normalizeToeicPart(targetPart);

  const enParsed = parseSingleLanguagePartText(enInput, 'en', normTargetPart);
  const viParsed = parseSingleLanguagePartText(viInput, 'vi', normTargetPart);

  let enTranscriptParsed = { groups: [] as SingleLanguageGroup[], questions: [] as SingleLanguageQuestion[], outOfPartErrors: [] as string[] };
  let viTranscriptParsed = { groups: [] as SingleLanguageGroup[], questions: [] as SingleLanguageQuestion[], outOfPartErrors: [] as string[] };
  if (enTranscriptInput && enTranscriptInput.trim()) {
    enTranscriptParsed = parseSingleLanguagePartText(enTranscriptInput, 'en', normTargetPart);
  }
  if (viTranscriptInput && viTranscriptInput.trim()) {
    viTranscriptParsed = parseSingleLanguagePartText(viTranscriptInput, 'vi', normTargetPart);
  }

  const outOfPartErrors = Array.from(new Set([
    ...enParsed.outOfPartErrors,
    ...viParsed.outOfPartErrors,
    ...enTranscriptParsed.outOfPartErrors,
    ...viTranscriptParsed.outOfPartErrors,
  ]));
  const validationErrors: string[] = [];

  // Match Groups by Range
  const groupRangeSet = new Set<string>();
  enParsed.groups.forEach(g => groupRangeSet.add(g.range));
  viParsed.groups.forEach(g => groupRangeSet.add(g.range));
  enTranscriptParsed.groups.forEach(g => groupRangeSet.add(g.range));
  viTranscriptParsed.groups.forEach(g => groupRangeSet.add(g.range));

  const groups: ParsedPartGroup[] = [];

  groupRangeSet.forEach(rangeStr => {
    const [start, end] = rangeStr.split('-').map(Number);
    const gEn = enParsed.groups.find(g => g.range === rangeStr);
    const gVi = viParsed.groups.find(g => g.range === rangeStr);
    const gTrEn = enTranscriptParsed.groups.find(g => g.range === rangeStr);
    const gTrVi = viTranscriptParsed.groups.find(g => g.range === rangeStr);

    groups.push({
      start_question: start,
      end_question: end,
      range: rangeStr,
      part: normTargetPart,
      transcript: gTrEn?.transcript || gEn?.transcript,
      transcript_vi: gTrVi?.transcript || gVi?.transcript,
      passage: gEn?.passage || gTrEn?.passage,
      passage_vi: gVi?.passage || gTrVi?.passage,
      documents: gEn?.documents,
      documents_vi: gVi?.documents,
    });
  });

  // Match Questions Strictly by Question Number across ALL input panels
  const qNumSet = new Set<number>();
  enParsed.questions.forEach(q => qNumSet.add(q.question_number));
  viParsed.questions.forEach(q => qNumSet.add(q.question_number));
  enTranscriptParsed.questions.forEach(q => qNumSet.add(q.question_number));
  viTranscriptParsed.questions.forEach(q => qNumSet.add(q.question_number));

  const sortedQNums = Array.from(qNumSet).sort((a, b) => a - b);
  const questions: ParsedPartQuestion[] = [];

  sortedQNums.forEach(qNum => {
    const qEn = enParsed.questions.find(q => q.question_number === qNum) || enTranscriptParsed.questions.find(q => q.question_number === qNum);
    const qVi = viParsed.questions.find(q => q.question_number === qNum) || viTranscriptParsed.questions.find(q => q.question_number === qNum);

    const optsViArr = qVi?.options
      ? ['A', 'B', 'C', 'D'].map(lbl => qVi.options?.find(o => o.label === lbl)?.text || '')
      : undefined;

    questions.push({
      question_number: qNum,
      part: normTargetPart,
      question_text: qEn?.text,
      translation_vi: qVi?.text,
      options: qEn?.options,
      options_vi: optsViArr,
      explanation: qEn?.explanation || qVi?.explanation,
    });
  });

  // Calculate Metrics
  const metrics = {
    groupCount: groups.length,
    questionCount: questions.length,
    hasQuestionEnCount: questions.filter(q => q.question_text || (q.options && q.options.length > 0)).length,
    hasQuestionViCount: questions.filter(q => q.translation_vi || (q.options_vi && q.options_vi.some(v => Boolean(v)))).length,
    hasOptionsEnCount: questions.filter(q => q.options && q.options.length === 4).length,
    hasOptionsViCount: questions.filter(q => q.options_vi && q.options_vi.length === 4).length,
    hasTranscriptEnCount: groups.filter(g => g.transcript || g.passage).length,
    hasTranscriptViCount: groups.filter(g => g.transcript_vi || g.passage_vi).length,
    hasAnswersCount: questions.filter(q => q.correct_answer).length,
    invalidOptionCount: questions.filter(q => q.options && q.options.length !== 4).length,
  };

  return {
    detectedFormat: 'txt',
    targetPart: normTargetPart,
    groups,
    questions,
    outOfPartErrors,
    validationErrors,
    metrics,
  };
}

export function autoParsePartContentInput(
  input: string,
  targetPart: CanonicalToeicPart
): PartParseResult {
  const normTargetPart = normalizeToeicPart(targetPart);

  // Detect bilingual split headers like "TIẾNG ANH", "TIẾNG VIỆT"
  const viHeaderRegex = /(?:^|\n)\s*(?:---|\*\*\*|___)?\s*(?:BẢN\s*DỊCH\s*TIẾNG\s*VIỆT|TIẾNG\s*VIỆT|VIETNAMESE|BẢN\s*DỊCH)\s*(?:---|\*\*\*|___)?\s*(?:\n|$)/i;
  const match = input.match(viHeaderRegex);

  if (match && typeof match.index === 'number') {
    const enText = input.substring(0, match.index).replace(/(?:^|\n)\s*(?:---|\*\*\*|___)?\s*(?:TIẾNG\s*ANH|ENGLISH)\s*(?:---|\*\*\*|___)?\s*(?:\n|$)/gi, '\n').trim();
    const viText = input.substring(match.index + match[0].length).trim();
    return parseSeparateBilingualPartContent(enText, viText, normTargetPart);
  }

  // Single panel parse
  return parseSeparateBilingualPartContent(input, '', normTargetPart);
}
