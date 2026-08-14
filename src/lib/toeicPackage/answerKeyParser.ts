// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Answer Key Parser
// ============================================================

import { OriPackageAnswerEntry } from './types';

export interface AnswerKeyParseResult {
  answers: OriPackageAnswerEntry[];
  totalParsed: number;
  duplicateQNums: number[];
  invalidLabelQNums: number[];
  part2InvalidDQNums: number[];
  error?: string;
}

export function parseAnswerKeyText(rawText: string): AnswerKeyParseResult {
  const text = rawText.trim();
  if (!text) {
    return {
      answers: [],
      totalParsed: 0,
      duplicateQNums: [],
      invalidLabelQNums: [],
      part2InvalidDQNums: [],
    };
  }

  const answers: OriPackageAnswerEntry[] = [];
  const seen = new Set<number>();
  const duplicateQNums: number[] = [];
  const invalidLabelQNums: number[] = [];
  const part2InvalidDQNums: number[] = [];

  // Helper to register answer safely
  const addAnswer = (qNum: number, ansStr: string) => {
    const ans = ansStr.trim().toUpperCase();
    if (qNum >= 1 && qNum <= 200) {
      if (['A', 'B', 'C', 'D'].includes(ans)) {
        if (qNum >= 7 && qNum <= 31 && ans === 'D') {
          part2InvalidDQNums.push(qNum);
        }

        if (seen.has(qNum)) {
          duplicateQNums.push(qNum);
        } else {
          seen.add(qNum);
          answers.push({ question_number: qNum, correct_answer: ans as any });
        }
      } else if (ans) {
        invalidLabelQNums.push(qNum);
      }
    }
  };

  // 1. Try parsing JSON format if starts with { or [
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);

      // A. Check root answerKey object if present (e.g. ORI combined answer JSON)
      if (parsed && typeof parsed.answerKey === 'object' && parsed.answerKey !== null) {
        Object.entries(parsed.answerKey).forEach(([key, val]) => {
          const qNum = parseInt(key.replace(/[^0-9]+/g, ''), 10);
          if (!isNaN(qNum)) {
            addAnswer(qNum, String(val));
          }
        });
      }
      // B. Check sections.listening.answerKey and sections.reading.answerKey
      else if (parsed && typeof parsed.sections === 'object' && parsed.sections !== null) {
        if (parsed.sections.listening?.answerKey) {
          Object.entries(parsed.sections.listening.answerKey).forEach(([key, val]) => {
            const qNum = parseInt(key.replace(/[^0-9]+/g, ''), 10);
            if (!isNaN(qNum)) addAnswer(qNum, String(val));
          });
        }
        if (parsed.sections.reading?.answerKey) {
          Object.entries(parsed.sections.reading.answerKey).forEach(([key, val]) => {
            const qNum = parseInt(key.replace(/[^0-9]+/g, ''), 10);
            if (!isNaN(qNum)) addAnswer(qNum, String(val));
          });
        }
      }
      // C. Check array of { question_number, correct_answer }
      else if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          const qNum = item.question_number || item.q || item.question;
          const ans = (item.correct_answer || item.answer || item.ans || '').toString();
          if (qNum) addAnswer(qNum, ans);
        });
      }
      // D. Check key-value pairs object { "1": "A", "2": "B", ... }
      else if (typeof parsed === 'object' && parsed !== null) {
        Object.entries(parsed).forEach(([key, val]) => {
          const qNum = parseInt(key.replace(/[^0-9]+/g, ''), 10);
          if (!isNaN(qNum)) addAnswer(qNum, String(val));
        });
      }

      if (answers.length > 0) {
        answers.sort((a, b) => a.question_number - b.question_number);
        return {
          answers,
          totalParsed: answers.length,
          duplicateQNums,
          invalidLabelQNums,
          part2InvalidDQNums,
        };
      }
    } catch {
      // Fallback to text parsing if JSON parse fails
    }
  }

  // 2. Text / CSV Regex Parsing
  const pattern = /(?:Q(?:uestion)?\s*)?([0-9]{1,3})[\s.:,\-\/]+([A-Da-dE-Ze-z])/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ansLetter = match[2];
    addAnswer(qNum, ansLetter);
  }

  answers.sort((a, b) => a.question_number - b.question_number);

  return {
    answers,
    totalParsed: answers.length,
    duplicateQNums,
    invalidLabelQNums,
    part2InvalidDQNums,
  };
}
