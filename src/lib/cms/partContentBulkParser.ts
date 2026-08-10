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

  let currentDocs: Array<{ title?: string; content: string }> = [];
  let currentDocContent: string[] = [];

  let currentQuestion: SingleLanguageQuestion | null = null;
  let rawQuestionTextLines: string[] = [];
  let rawExplanationLines: string[] = [];
  let rawOptionsMap: Map<string, string> = new Map();
  let inExplanation = false;

  const finalizeQuestion = () => {
    if (!currentQuestion) return;

    if (rawQuestionTextLines.length > 0) {
      currentQuestion.text = rawQuestionTextLines.join('\n').trim();
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

    // Check Question Range Header (e.g. ## CÂU 32–34, CÂU 32-34)
    const normalizedHeader = cleanHeader.replace(/[\u2013\u2014–—~]/g, '-');
    const rangeMatch = normalizedHeader.match(/^(?:CÂU|CAU|Q|QUESTION)\s*#?\s*(\d+)\s*-\s*(\d+)/i);
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

    // Check Part 7 Document Header (e.g. DOCUMENT 1)
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

    // Check Single Question Header (e.g. CÂU 32, QUESTION 32, Q32)
    const qMatch = normalizedHeader.match(/^(?:QUESTION|CÂU|CAU)\s*#?\s*(\d+)\b\s*[:\.]?\s*(.*)$/i) ||
                   normalizedHeader.match(/^Q\s*#?\s*(\d+)\b\s*[:\.]?\s*$/i);
    if (qMatch) {
      finalizeQuestion();
      const num = parseInt(qMatch[1], 10);
      const initialText = qMatch[2]?.trim() || '';

      ensureAutoGroup(num);

      currentQuestion = {
        question_number: num,
        part: normTargetPart,
      };
      if (initialText) {
        rawQuestionTextLines.push(initialText);
      }
      continue;
    }

    // Check Explanation Header
    if (currentQuestion) {
      const isExplanationHeader = /^(?:EXPLANATION|GIẢI\s*THÍCH|LỜI\s*GIẢI)$/i.test(cleanHeader);
      if (isExplanationHeader) {
        inExplanation = true;
        continue;
      }

      // Check Option line (e.g. (A) Candy,  (B) Cheese, A. Bread, A) Pasta, A: Candy)
      const optMatch = trimmed.match(/^\s*(?:[\(\[]?([A-D])[\)\]\.\:\s]+)(.*)$/i);
      if (optMatch) {
        const label = optMatch[1].toUpperCase();
        const optText = optMatch[2].replace(/^[\*\_\s]+/, '').replace(/[\*\_\s]+$/, '').trim();
        rawOptionsMap.set(label, optText);
        continue;
      }
    }

    // Accumulate content
    if (currentQuestion) {
      const cleanLine = trimmed.replace(/^\*\*([A-Za-z0-9\s\u00C0-\u1EF9]+:)\*\*\s*/gi, '$1 ');
      if (inExplanation) {
        rawExplanationLines.push(cleanLine);
      } else {
        rawQuestionTextLines.push(cleanLine);
      }
    } else if (currentGroup) {
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

  let enTranscriptParsed = { groups: [] as SingleLanguageGroup[] };
  let viTranscriptParsed = { groups: [] as SingleLanguageGroup[] };
  if (enTranscriptInput && enTranscriptInput.trim()) {
    enTranscriptParsed = parseSingleLanguagePartText(enTranscriptInput, 'en', normTargetPart);
  }
  if (viTranscriptInput && viTranscriptInput.trim()) {
    viTranscriptParsed = parseSingleLanguagePartText(viTranscriptInput, 'vi', normTargetPart);
  }

  const outOfPartErrors = Array.from(new Set([...enParsed.outOfPartErrors, ...viParsed.outOfPartErrors]));
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
      passage: gEn?.passage,
      passage_vi: gVi?.passage,
      documents: gEn?.documents,
      documents_vi: gVi?.documents,
    });
  });

  // Match Questions Strictly by Question Number
  const qNumSet = new Set<number>();
  enParsed.questions.forEach(q => qNumSet.add(q.question_number));
  viParsed.questions.forEach(q => qNumSet.add(q.question_number));

  const sortedQNums = Array.from(qNumSet).sort((a, b) => a - b);
  const questions: ParsedPartQuestion[] = [];

  sortedQNums.forEach(qNum => {
    const qEn = enParsed.questions.find(q => q.question_number === qNum);
    const qVi = viParsed.questions.find(q => q.question_number === qNum);

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
  let hasQuestionEnCount = 0;
  let hasQuestionViCount = 0;
  let hasOptionsEnCount = 0;
  let hasOptionsViCount = 0;
  let hasAnswersCount = 0;
  let invalidOptionCount = 0;

  questions.forEach(q => {
    if (q.question_text) hasQuestionEnCount++;
    if (q.translation_vi) hasQuestionViCount++;
    if (q.options && q.options.length > 0) hasOptionsEnCount++;
    if (q.options_vi && q.options_vi.some(v => v)) hasOptionsViCount++;
    if (q.correct_answer) hasAnswersCount++;
    const optCount = q.options?.length || 0;
    if (optCount < 3 || optCount > 4) invalidOptionCount++;
  });

  let hasTranscriptEnCount = 0;
  let hasTranscriptViCount = 0;
  groups.forEach(g => {
    if (g.transcript || g.passage || (g.documents && g.documents.length > 0)) hasTranscriptEnCount++;
    if (g.transcript_vi || g.passage_vi || (g.documents_vi && g.documents_vi.length > 0)) hasTranscriptViCount++;
  });

  return {
    detectedFormat: 'txt',
    targetPart: normTargetPart,
    groups,
    questions,
    outOfPartErrors,
    validationErrors,
    metrics: {
      groupCount: groups.length,
      questionCount: questions.length,
      hasQuestionEnCount,
      hasQuestionViCount,
      hasOptionsEnCount,
      hasOptionsViCount,
      hasTranscriptEnCount,
      hasTranscriptViCount,
      hasAnswersCount,
      invalidOptionCount,
    },
  };
}

export function parsePartContentText(
  input: string,
  targetPart: CanonicalToeicPart
): PartParseResult {
  return parseSeparateBilingualPartContent(input, '', targetPart);
}

/**
 * JSON & Auto Parser for Bilingual Part Content
 */
export function autoParsePartContentInput(
  input: string,
  targetPart: CanonicalToeicPart
): PartParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      detectedFormat: 'txt',
      targetPart,
      groups: [],
      questions: [],
      outOfPartErrors: [],
      validationErrors: ['Vui lòng nhập hoặc dán nội dung.'],
      metrics: {
        groupCount: 0,
        questionCount: 0,
        hasQuestionEnCount: 0,
        hasQuestionViCount: 0,
        hasOptionsEnCount: 0,
        hasOptionsViCount: 0,
        hasTranscriptEnCount: 0,
        hasTranscriptViCount: 0,
        hasAnswersCount: 0,
        invalidOptionCount: 0,
      },
    };
  }

  // Try JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const obj = JSON.parse(trimmed);
      const parsedObj = parsePartJsonObject(obj, targetPart);
      if (parsedObj.questions.length > 0 || parsedObj.groups.length > 0) {
        return parsedObj;
      }
    } catch {
      // Fallback to text
    }
  }

  return parsePartContentText(trimmed, targetPart);
}

function parsePartJsonObject(obj: any, targetPart: CanonicalToeicPart): PartParseResult {
  const normTargetPart = normalizeToeicPart(targetPart);
  const groups: ParsedPartGroup[] = [];
  const questions: ParsedPartQuestion[] = [];

  const rawQuestions = Array.isArray(obj.questions) ? obj.questions : Array.isArray(obj) ? obj : [];
  const rawGroups = Array.isArray(obj.groups) ? obj.groups : [];

  rawGroups.forEach((g: any) => {
    if (g && typeof g === 'object') {
      const start = parseInt(g.start_question || g.startQuestion, 10);
      const end = parseInt(g.end_question || g.endQuestion, 10);
      if (!isNaN(start) && !isNaN(end)) {
        groups.push({
          start_question: start,
          end_question: end,
          range: `${start}-${end}`,
          part: normTargetPart,
          group_type: g.group_type,
          title: g.title,
          instruction: g.instruction,
          instruction_vi: g.instruction_vi,
          passage: g.passage,
          passage_vi: g.passage_vi,
          transcript: g.transcript,
          transcript_vi: g.transcript_vi,
          documents: Array.isArray(g.documents) ? g.documents : [],
          documents_vi: Array.isArray(g.documents_vi) ? g.documents_vi : [],
        });
      }
    }
  });

  rawQuestions.forEach((q: any) => {
    if (q && typeof q === 'object') {
      const num = parseInt(q.question_number || q.number, 10);
      if (!isNaN(num)) {
        const opts = Array.isArray(q.options)
          ? q.options.map((o: any, idx: number) => {
              if (typeof o === 'string') {
                return { label: String.fromCharCode(65 + idx) as any, text: o };
              }
              return { label: (o.label || String.fromCharCode(65 + idx)) as any, text: o.text || '' };
            })
          : [];

        questions.push({
          question_number: num,
          part: normTargetPart,
          question_text: q.question_text,
          translation_vi: q.translation_vi,
          options: opts,
          options_vi: q.options_vi,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
        });
      }
    }
  });

  return {
    detectedFormat: 'json',
    targetPart: normTargetPart,
    groups,
    questions,
    outOfPartErrors: [],
    validationErrors: [],
    metrics: {
      groupCount: groups.length,
      questionCount: questions.length,
      hasQuestionEnCount: questions.filter(q => q.question_text).length,
      hasQuestionViCount: questions.filter(q => q.translation_vi).length,
      hasOptionsEnCount: questions.filter(q => q.options && q.options.length > 0).length,
      hasOptionsViCount: questions.filter(q => q.options_vi && q.options_vi.some(v => v)).length,
      hasTranscriptEnCount: groups.filter(g => g.transcript || g.passage || (g.documents && g.documents.length > 0)).length,
      hasTranscriptViCount: groups.filter(g => g.transcript_vi || g.passage_vi || (g.documents_vi && g.documents_vi.length > 0)).length,
      hasAnswersCount: questions.filter(q => q.correct_answer).length,
      invalidOptionCount: questions.filter(q => (q.options?.length || 0) < 3).length,
    },
  };
}
