// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Answer Key Parser
// ============================================================

import { OriPackageAnswerEntry } from './types';

export interface AnswerKeyParseResult {
  answers: OriPackageAnswerEntry[];
  totalParsed: number;
  duplicateQNums: number[];
  invalidLabelQNums: number[];
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
    };
  }

  // 1. Try parsing JSON format if starts with { or [
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      const answers: OriPackageAnswerEntry[] = [];
      const seen = new Set<number>();
      const duplicateQNums: number[] = [];
      const invalidLabelQNums: number[] = [];

      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          const qNum = item.question_number || item.q || item.question;
          const ans = (item.correct_answer || item.answer || item.ans || '').toString().trim().toUpperCase();
          if (qNum >= 1 && qNum <= 200) {
            if (['A', 'B', 'C', 'D'].includes(ans)) {
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
        });
      } else if (typeof parsed === 'object' && parsed !== null) {
        Object.entries(parsed).forEach(([key, val]) => {
          const qNum = parseInt(key.replace(/[^0-9]+/g, ''), 10);
          const ans = String(val).trim().toUpperCase();
          if (qNum >= 1 && qNum <= 200) {
            if (['A', 'B', 'C', 'D'].includes(ans)) {
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
        });
      }

      return {
        answers,
        totalParsed: answers.length,
        duplicateQNums,
        invalidLabelQNums,
      };
    } catch {
      // Fallback to text parsing if JSON parse fails
    }
  }

  // 2. Text / CSV Regex Parsing
  const answers: OriPackageAnswerEntry[] = [];
  const seen = new Set<number>();
  const duplicateQNums: number[] = [];
  const invalidLabelQNums: number[] = [];

  // Match patterns like:
  // "1. A", "1: A", "1 - A", "Q1. A", "Question 1: A", "1, A", "1,A"
  const pattern = /(?:Q(?:uestion)?\s*)?([0-9]{1,3})[\s.:,\-\/]+([A-Da-dE-Ze-z])/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ansLetter = match[2].toUpperCase();

    if (qNum >= 1 && qNum <= 200) {
      if (['A', 'B', 'C', 'D'].includes(ansLetter)) {
        if (seen.has(qNum)) {
          duplicateQNums.push(qNum);
        } else {
          seen.add(qNum);
          answers.push({
            question_number: qNum,
            correct_answer: ansLetter as 'A' | 'B' | 'C' | 'D',
          });
        }
      } else {
        invalidLabelQNums.push(qNum);
      }
    }
  }

  // Sort answers by question number ascending
  answers.sort((a, b) => a.question_number - b.question_number);

  return {
    answers,
    totalParsed: answers.length,
    duplicateQNums,
    invalidLabelQNums,
  };
}
