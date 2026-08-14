// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Listening Parser
// ============================================================

import { OriPackageQuestion, OriPackageGroup } from './types';

export interface ListeningParseResult {
  questions: OriPackageQuestion[];
  groups: OriPackageGroup[];
}

export function parseListeningPdfText(pdfText: string): ListeningParseResult {
  const questions: OriPackageQuestion[] = [];
  const groups: OriPackageGroup[] = [];

  const cleanText = pdfText || '';

  // 1. PART 1: Q1..Q6
  for (let qNum = 1; qNum <= 6; qNum++) {
    questions.push({
      question_number: qNum,
      part: 'part1',
      question_text: null, // Spoken only; active runner hides text
      options: [
        { label: 'A', text: '(A)' },
        { label: 'B', text: '(B)' },
        { label: 'C', text: '(C)' },
        { label: 'D', text: '(D)' },
      ],
    });
  }

  // 2. PART 2: Q7..Q31
  for (let qNum = 7; qNum <= 31; qNum++) {
    questions.push({
      question_number: qNum,
      part: 'part2',
      question_text: null, // Spoken only; active runner hides text
      options: [
        { label: 'A', text: '(A)' },
        { label: 'B', text: '(B)' },
        { label: 'C', text: '(C)' },
      ],
    });
  }

  // Helper to parse question block text into 3 questions with options A, B, C, D
  const extractQuestionsFromGroupBlock = (
    blockText: string,
    startQ: number,
    endQ: number,
    part: 'part3' | 'part4',
    groupIndex: number
  ): OriPackageQuestion[] => {
    const qList: OriPackageQuestion[] = [];

    for (let qNum = startQ; qNum <= endQ; qNum++) {
      // Look for question line like "32. What is the woman asking about?"
      const qNumRegex = new RegExp(`(?:Q|Question|#)?\\s*${qNum}[\\s.:\\)\\-]+([\\s\\S]*?)(?=(?:Q|Question|#)?\\s*${qNum + 1}[\\s.:\\)\\-]|(A\\)|\\(A\\))|$)`, 'i');
      const match = blockText.match(qNumRegex);
      const qTextRaw = match ? match[1].trim() : `Question ${qNum}`;

      // Options matching
      const options = [
        { label: 'A' as const, text: 'Option A' },
        { label: 'B' as const, text: 'Option B' },
        { label: 'C' as const, text: 'Option C' },
        { label: 'D' as const, text: 'Option D' },
      ];

      const optA = blockText.match(/(?:A\)|[\(]A[\)]|\bA\.)\s*([^\n\r\(A-D]+)/i);
      const optB = blockText.match(/(?:B\)|[\(]B[\)]|\bB\.)\s*([^\n\r\(A-D]+)/i);
      const optC = blockText.match(/(?:C\)|[\(]C[\)]|\bC\.)\s*([^\n\r\(A-D]+)/i);
      const optD = blockText.match(/(?:D\)|[\(]D[\)]|\bD\.)\s*([^\n\r\(A-D]+)/i);

      if (optA) options[0].text = optA[1].trim();
      if (optB) options[1].text = optB[1].trim();
      if (optC) options[2].text = optC[1].trim();
      if (optD) options[3].text = optD[1].trim();

      qList.push({
        question_number: qNum,
        part,
        group_index: groupIndex,
        question_text: qTextRaw || `Question ${qNum}`,
        options,
      });
    }

    return qList;
  };

  // 3. PART 3: 13 Groups (Q32-34 .. Q68-70)
  for (let i = 0; i < 13; i++) {
    const startQ = 32 + i * 3;
    const endQ = startQ + 2;
    const groupIndex = i + 1;

    groups.push({
      group_index: groupIndex,
      part: 'part3',
      group_type: 'conversation',
      start_question: startQ,
      end_question: endQ,
      title: `Part 3 Conversation (Q${startQ}–${endQ})`,
    });

    const groupQs = extractQuestionsFromGroupBlock(cleanText, startQ, endQ, 'part3', groupIndex);
    questions.push(...groupQs);
  }

  // 4. PART 4: 10 Groups (Q71-73 .. Q98-100)
  for (let i = 0; i < 10; i++) {
    const startQ = 71 + i * 3;
    const endQ = startQ + 2;
    const groupIndex = 13 + i + 1;

    groups.push({
      group_index: groupIndex,
      part: 'part4',
      group_type: 'talk',
      start_question: startQ,
      end_question: endQ,
      title: `Part 4 Talk (Q${startQ}–${endQ})`,
    });

    const groupQs = extractQuestionsFromGroupBlock(cleanText, startQ, endQ, 'part4', groupIndex);
    questions.push(...groupQs);
  }

  return {
    questions,
    groups,
  };
}
