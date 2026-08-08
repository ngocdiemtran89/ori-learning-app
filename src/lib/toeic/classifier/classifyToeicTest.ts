import { ParsedToeicTestDraft, ParsedQuestion, ParserIssue } from './types';
import { parseQuestionBlock } from './questionParser';
import { classifyGroups } from './groupClassifier';
import { parseAnswerKey } from './answerKeyParser';
import { expectedPartForQuestionNumber } from '../testStructure';

export function parseRawToeicTest(
  text: string,
  metadata: ParsedToeicTestDraft['metadata'],
  answerKeyText: string = ''
): ParsedToeicTestDraft {
  const issues: ParserIssue[] = [];
  const questions: ParsedQuestion[] = [];
  
  // Normalize headings in the text so they become their own blocks
  // Support PART 1, PART I, PART ONE, etc.
  const headingPattern = /^[\s\-\*]*(PART\s+(?:[1-7]|I{1,3}V?|VI{1,2}|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN)).*$/gim;
  const normalizedText = text.replace(headingPattern, '\n\n$1\n\n');
  const blocks = normalizedText.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  
  let currentHeading = '';
  let pendingInstruction = '';
  let pendingPassage = '';
  let pendingRangeStart = 0;
  let pendingRangeEnd = 0;
  
  const explicitRanges: Array<{start: number, end: number, instruction: string, passage: string}> = [];

  const parsePartNumber = (val: string): string | null => {
    const v = val.toUpperCase();
    if (['1', 'I', 'ONE'].includes(v)) return 'part1';
    if (['2', 'II', 'TWO'].includes(v)) return 'part2';
    if (['3', 'III', 'THREE'].includes(v)) return 'part3';
    if (['4', 'IV', 'FOUR'].includes(v)) return 'part4';
    if (['5', 'V', 'FIVE'].includes(v)) return 'part5';
    if (['6', 'VI', 'SIX'].includes(v)) return 'part6';
    if (['7', 'VII', 'SEVEN'].includes(v)) return 'part7';
    return null;
  };

  for (const block of blocks) {
    // Check if block is a heading
    const headingMatch = block.match(/^PART\s+([1-7]|I{1,3}V?|VI{1,2}|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN)/i);
    if (headingMatch) {
      const parsedPart = parsePartNumber(headingMatch[1]);
      if (parsedPart) {
        currentHeading = parsedPart;
      }
      continue;
    }

    // Extract explicit Part 6/7 boundary instructions and passage
    const instructionMatch = block.match(/^(Questions?\s+(\d+)\s*-\s*(\d+)\s+refer[^\n]*)(?:\n(.*))?$/is);
    if (instructionMatch) {
       if (pendingRangeStart) {
          explicitRanges.push({ start: pendingRangeStart, end: pendingRangeEnd, instruction: pendingInstruction, passage: pendingPassage.trim() });
       }
       pendingInstruction = instructionMatch[1].trim();
       pendingRangeStart = parseInt(instructionMatch[2], 10);
       pendingRangeEnd = parseInt(instructionMatch[3], 10);
       pendingPassage = instructionMatch[4] ? instructionMatch[4].trim() : '';
       continue;
    }

    const qData = parseQuestionBlock(block);
    if (qData) {
      if (pendingRangeStart) {
          explicitRanges.push({ start: pendingRangeStart, end: pendingRangeEnd, instruction: pendingInstruction, passage: pendingPassage.trim() });
          pendingRangeStart = 0;
          pendingRangeEnd = 0;
          pendingInstruction = '';
          pendingPassage = '';
      }
      
      const { questionNumber, questionText, options } = qData;
      
      const expectedPart = expectedPartForQuestionNumber(questionNumber);
      if (!expectedPart) {
        issues.push({
          type: 'ERROR',
          message: `Câu hỏi số ${questionNumber} nằm ngoài dải (1-200) của một bài Full Test.`,
          question_number: questionNumber
        });
        continue;
      }

      // Check heading conflict
      if (currentHeading && currentHeading !== expectedPart) {
        issues.push({
          type: 'REVIEW',
          message: `Heading và số câu không khớp. Đang ở section ${currentHeading} nhưng câu ${questionNumber} thuộc ${expectedPart}. Số câu được ưu tiên.`,
          question_number: questionNumber
        });
      }

      // Check option counts
      if (expectedPart === 'part2' && options.length !== 3) {
        issues.push({
          type: 'WARNING',
          message: `Part 2 nên có 3 options, nhưng tìm thấy ${options.length} options.`,
          question_number: questionNumber
        });
      } else if (expectedPart !== 'part2' && options.length !== 4) {
         issues.push({
          type: 'WARNING',
          message: `${expectedPart.toUpperCase()} nên có 4 options, nhưng tìm thấy ${options.length} options.`,
          question_number: questionNumber
        });
      }

      // Check for duplicate
      if (questions.some(q => q.question_number === questionNumber)) {
        issues.push({
          type: 'ERROR',
          message: `Trùng lặp số câu hỏi: ${questionNumber}`,
          question_number: questionNumber
        });
      }

      questions.push({
        question_number: questionNumber,
        part: expectedPart,
        question_text: questionText,
        options,
        correct_answer: null,
        explanation: null,
        group_temp_key: null,
        audio_url: null,
        image_url: null
      });
    } else {
      // It's not a heading, not an instruction, and not a question. It must be passage text!
      if (pendingRangeStart) {
         pendingPassage += (pendingPassage ? '\n\n' : '') + block;
      }
    }
  }

  if (pendingRangeStart) {
     explicitRanges.push({ start: pendingRangeStart, end: pendingRangeEnd, instruction: pendingInstruction, passage: pendingPassage.trim() });
  }

  // 2. Parse answer key
  if (answerKeyText) {
    const parsedKeys = parseAnswerKey(answerKeyText);
    for (const q of questions) {
      if (parsedKeys[q.question_number]) {
        // Map raw letter to actual option
        const letter = parsedKeys[q.question_number];
        const matchOpt = q.options.find(o => o.toUpperCase().startsWith(`(${letter})`));
        q.correct_answer = matchOpt || letter;
      }
    }
  }

  // 3. We do group classification
  const groups = classifyGroups(questions, explicitRanges);

  // 4. Add group issues
  groups.forEach(g => {
    if (g.part === 'part6') {
      issues.push({
        type: 'REVIEW',
        message: 'Passage cho Part 6 cần được thêm thủ công.',
        group_temp_key: g.group_temp_key
      });
    }
    if (g.part === 'part7') {
       issues.push({
        type: 'REVIEW',
        message: 'Cấu trúc nhóm của Part 7 (số lượng câu hỏi, đoạn văn) cần được xác nhận bằng tay.',
        group_temp_key: g.group_temp_key
      });
    }
    if (g.part === 'part3' || g.part === 'part4') {
       issues.push({
        type: 'WARNING',
        message: 'Nhóm hội thoại/bài nói cần được tải audio.',
        group_temp_key: g.group_temp_key
      });
    }
  });

  // 5. Calculate summary
  const partCounts: Record<string, number> = {};
  const missingNumbers: number[] = [];
  const duplicateNumbers: number[] = [];
  let answersFound = 0;
  
  const present = new Set<number>();
  questions.forEach(q => {
    if (present.has(q.question_number)) duplicateNumbers.push(q.question_number);
    present.add(q.question_number);
    partCounts[q.part] = (partCounts[q.part] || 0) + 1;
    if (q.correct_answer) answersFound++;
  });

  for (let i = 1; i <= 200; i++) {
    if (!present.has(i)) missingNumbers.push(i);
  }

  // Find questions missing answers
  questions.forEach(q => {
     if (!q.correct_answer) {
       issues.push({
         type: 'WARNING',
         message: `Thiếu đáp án đúng cho câu ${q.question_number}`,
         question_number: q.question_number
       });
     }
  });

  return {
    metadata,
    questions,
    groups,
    issues,
    summary: {
      detectedQuestions: present.size,
      partCounts,
      missingNumbers,
      duplicateNumbers: [...new Set(duplicateNumbers)],
      answersFound
    }
  };
}
