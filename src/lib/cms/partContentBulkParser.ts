// ============================================================
// Phase P3.5J: Admin Bulk Import TOEIC Questions By Part Parser
// Parses human text, markdown, JSON, CSV, and PDF text per TOEIC Part (1–7)
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
  options?: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }>;
  correct_answer?: string;
  explanation?: string;
  translation_vi?: string;
  options_vi?: string[];
}

export interface ParsedPartGroup {
  start_question: number;
  end_question: number;
  range: string;
  part: string;
  group_type?: string;
  title?: string;
  instruction?: string;
  passage?: string;
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

export function parsePartContentText(
  input: string,
  targetPart: CanonicalToeicPart
): PartParseResult {
  const normTargetPart = normalizeToeicPart(targetPart);
  const partRange = TOEIC_FULL_TEST_STRUCTURE[normTargetPart];

  const lines = input.split('\n');
  const groups: ParsedPartGroup[] = [];
  const questions: ParsedPartQuestion[] = [];
  const outOfPartErrors: string[] = [];
  const validationErrors: string[] = [];

  let currentGroup: ParsedPartGroup | null = null;
  let currentPassageLines: string[] = [];
  let currentDocs: Array<{ title?: string; content: string }> = [];
  let currentDocContent: string[] = [];

  let currentQuestion: ParsedPartQuestion | null = null;
  let currentQuestionLines: string[] = [];
  let currentQuestionOptions: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }> = [];

  const finalizeQuestion = () => {
    if (!currentQuestion) return;

    if (currentQuestionLines.length > 0) {
      currentQuestion.question_text = currentQuestionLines.join('\n').trim();
    }

    if (currentQuestionOptions.length > 0) {
      currentQuestion.options = currentQuestionOptions;
    }

    // Check if question number is in target Part range
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
    currentQuestionLines = [];
    currentQuestionOptions = [];
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

    if (currentPassageLines.length > 0) {
      currentGroup.passage = currentPassageLines.join('\n').trim();
    }

    groups.push(currentGroup);
    currentGroup = null;
    currentPassageLines = [];
    currentDocs = [];
    currentDocContent = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Ignore horizontal markdown separators
    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      continue;
    }

    // Clean structural Markdown markers (#, ##, **, __)
    const cleanHeader = trimmed
      .replace(/^[#\s]+/, '')
      .replace(/^[\*\_\s]+/, '')
      .replace(/[\*\_\s]+$/, '')
      .trim();

    // Ignore Part metadata headers (e.g. # PART 3, PART 3)
    if (/^(?:PART\s*[1-7]|PHẦN\s*[1-7])$/i.test(cleanHeader)) {
      continue;
    }

    // Check Question Range Header (e.g. ## CÂU 32–34, CÂU 32-34, Q32-34)
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

    // Check Document Header for Part 7 (e.g. DOCUMENT 1, DOCUMENT 2, PASSAGE 1)
    const docMatch = cleanHeader.match(/^(?:DOCUMENT|PASSAGE|BÀI\s*ĐỌC|BẢN\s*VĂN)\s*#?\s*(\d*)\s*:?\s*(.*)$/i);
    if (docMatch && normTargetPart === 'part7' && currentGroup) {
      if (currentDocContent.length > 0 && currentDocs.length > 0) {
        currentDocs[currentDocs.length - 1].content = currentDocContent.join('\n').trim();
        currentDocContent = [];
      }
      const docTitle = docMatch[2]?.trim() || `Document ${docMatch[1] || currentDocs.length + 1}`;
      currentDocs.push({ title: docTitle, content: '' });
      continue;
    }

    // Check Single Question Header (e.g. QUESTION 32, CÂU 32, Q32)
    const qMatch = normalizedHeader.match(/^(?:QUESTION|CÂU|CAU|Q)\s*#?\s*(\d+)\s*:?\s*(.*)$/i);
    if (qMatch) {
      finalizeQuestion();
      const num = parseInt(qMatch[1], 10);
      const initialText = qMatch[2]?.trim() || '';

      currentQuestion = {
        question_number: num,
        part: normTargetPart,
      };
      if (initialText) {
        currentQuestionLines.push(initialText);
      }
      continue;
    }

    // Check Answer Key Line (e.g. ANSWER: B, ĐÁP ÁN: C)
    const ansMatch = cleanHeader.match(/^(?:ANSWER|CORRECT\s*ANSWER|ĐÁP\s*ÁN|DAP\s*AN)\s*:\s*([A-D])/i);
    if (ansMatch && currentQuestion) {
      currentQuestion.correct_answer = ansMatch[1].toUpperCase();
      continue;
    }

    // Check Option Line (e.g. (A) Option text, A. Option text, A) Option text)
    const optMatch = trimmed.match(/^\s*(?:[\(\[]?([A-D])[\)\]\.\:\s]+)(.*)$/i);
    if (optMatch && currentQuestion) {
      const label = optMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      const optText = optMatch[2].replace(/^[\*\_\s]+/, '').replace(/[\*\_\s]+$/, '').trim();
      currentQuestionOptions.push({ label, text: optText });
      continue;
    }

    // Accumulate text content into current Question or Passage/Document
    if (currentQuestion) {
      // Stripping Markdown bold from text line if present
      const cleanLine = trimmed.replace(/^\*\*([A-Za-z0-9\s\u00C0-\u1EF9]+:)\*\*\s*/gi, '$1 ');
      currentQuestionLines.push(cleanLine);
    } else if (currentGroup) {
      if (currentDocs.length > 0) {
        currentDocContent.push(trimmed);
      } else {
        currentPassageLines.push(trimmed);
      }
    }
  }

  finalizeQuestion();
  finalizeGroup();

  // Canonical Group Range Validation
  if (normTargetPart === 'part3') {
    groups.forEach(g => {
      if (!CANONICAL_PART3_GROUPS.includes(g.range)) {
        validationErrors.push(`Nhóm câu hỏi Q${g.range} không thuộc dải chuẩn của Part 3 (VD: 32–34, 35–37...).`);
      }
    });
  } else if (normTargetPart === 'part4') {
    groups.forEach(g => {
      if (!CANONICAL_PART4_GROUPS.includes(g.range)) {
        validationErrors.push(`Nhóm câu hỏi Q${g.range} không thuộc dải chuẩn của Part 4 (VD: 71–73, 74–76...).`);
      }
    });
  } else if (normTargetPart === 'part6') {
    groups.forEach(g => {
      if (!CANONICAL_PART6_GROUPS.includes(g.range)) {
        validationErrors.push(`Nhóm câu hỏi Q${g.range} không thuộc dải chuẩn của Part 6 (VD: 131–134, 135–138...).`);
      }
    });
  }

  // Calculate Summary Metrics
  let hasAnswersCount = 0;
  let invalidOptionCount = 0;

  questions.forEach(q => {
    if (q.correct_answer) hasAnswersCount++;
    const optCount = q.options?.length || 0;
    if (optCount < 3 || optCount > 4) invalidOptionCount++;
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
      hasAnswersCount,
      invalidOptionCount,
    },
  };
}

/**
 * JSON & Auto Parser for Part Content
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
      metrics: { groupCount: 0, questionCount: 0, hasAnswersCount: 0, invalidOptionCount: 0 },
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
  const outOfPartErrors: string[] = [];
  const validationErrors: string[] = [];

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
          passage: g.passage,
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
          options: opts,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          translation_vi: q.translation_vi,
          options_vi: q.options_vi,
        });
      }
    }
  });

  return {
    detectedFormat: 'json',
    targetPart: normTargetPart,
    groups,
    questions,
    outOfPartErrors,
    validationErrors,
    metrics: {
      groupCount: groups.length,
      questionCount: questions.length,
      hasAnswersCount: questions.filter(q => q.correct_answer).length,
      invalidOptionCount: questions.filter(q => (q.options?.length || 0) < 3).length,
    },
  };
}
