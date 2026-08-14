// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Reading Parser
// ============================================================

import { OriPackageQuestion, OriPackageGroup } from './types';

export interface ReadingParseResult {
  questions: OriPackageQuestion[];
  groups: OriPackageGroup[];
}

export function parseReadingPdfText(pdfText: string): ReadingParseResult {
  const questions: OriPackageQuestion[] = [];
  const groups: OriPackageGroup[] = [];

  const cleanText = pdfText || '';

  // 1. PART 5: Q101..Q130 (30 questions)
  for (let qNum = 101; qNum <= 130; qNum++) {
    // Attempt match question line: "101. Mr. Smith decided to ... (A) ..."
    const qNumRegex = new RegExp(`(?:Q|Question|#)?\\s*${qNum}[\\s.:\\)\\-]+([\\s\\S]*?)(?=(?:Q|Question|#)?\\s*${qNum + 1}[\\s.:\\)\\-]|PART|$)`, 'i');
    const match = cleanText.match(qNumRegex);
    const rawBlock = match ? match[1].trim() : `Question ${qNum}`;

    const options = [
      { label: 'A' as const, text: 'Option A' },
      { label: 'B' as const, text: 'Option B' },
      { label: 'C' as const, text: 'Option C' },
      { label: 'D' as const, text: 'Option D' },
    ];

    const optA = rawBlock.match(/(?:A\)|[\(]A[\)]|\bA\.)\s*([^\n\r\(A-D]+)/i);
    const optB = rawBlock.match(/(?:B\)|[\(]B[\)]|\bB\.)\s*([^\n\r\(A-D]+)/i);
    const optC = rawBlock.match(/(?:C\)|[\(]C[\)]|\bC\.)\s*([^\n\r\(A-D]+)/i);
    const optD = rawBlock.match(/(?:D\)|[\(]D[\)]|\bD\.)\s*([^\n\r\(A-D]+)/i);

    if (optA) options[0].text = optA[1].trim();
    if (optB) options[1].text = optB[1].trim();
    if (optC) options[2].text = optC[1].trim();
    if (optD) options[3].text = optD[1].trim();

    const firstOptIdx = rawBlock.search(/(?:A\)|[\(]A[\)]|\bA\.)/i);
    const qText = firstOptIdx > 0 ? rawBlock.substring(0, firstOptIdx).trim() : rawBlock;

    questions.push({
      question_number: qNum,
      part: 'part5',
      question_text: qText || `Question ${qNum}`,
      options,
    });
  }

  // 2. PART 6: Q131..Q146 (4 groups of 4 questions)
  for (let i = 0; i < 4; i++) {
    const startQ = 131 + i * 4;
    const endQ = startQ + 3;
    const groupIndex = 100 + i + 1;

    groups.push({
      group_index: groupIndex,
      part: 'part6',
      group_type: 'text_completion',
      start_question: startQ,
      end_question: endQ,
      title: `Part 6 Passage (Q${startQ}–${endQ})`,
      passage: `Passage for questions ${startQ}-${endQ}`,
    });

    for (let qNum = startQ; qNum <= endQ; qNum++) {
      questions.push({
        question_number: qNum,
        part: 'part6',
        group_index: groupIndex,
        question_text: `Question ${qNum}`,
        options: [
          { label: 'A', text: 'Option A' },
          { label: 'B', text: 'Option B' },
          { label: 'C', text: 'Option C' },
          { label: 'D', text: 'Option D' },
        ],
      });
    }
  }

  // 3. PART 7: Q147..Q200 (Passage groups)
  // Standard TOEIC Part 7 breakdown:
  // Q147-148 (2), Q149-150 (2), Q151-152 (2), Q153-154 (2), Q155-157 (3), Q158-160 (3), Q161-163 (3), Q164-167 (4), Q168-171 (4), Q172-175 (4)
  // Double: Q176-180 (5), Q181-185 (5)
  // Triple: Q186-190 (5), Q191-195 (5), Q196-200 (5)
  const part7Ranges: Array<[number, number]> = [
    [147, 148], [149, 150], [151, 152], [153, 154],
    [155, 157], [158, 160], [161, 163],
    [164, 167], [168, 171], [172, 175],
    [176, 180], [181, 185],
    [186, 190], [191, 195], [196, 200]
  ];

  part7Ranges.forEach(([startQ, endQ], idx) => {
    const groupIndex = 200 + idx + 1;
    const isDouble = startQ >= 176 && endQ <= 185;
    const isTriple = startQ >= 186 && endQ <= 200;

    let docTypeLabel = 'Single Passage';
    if (isDouble) docTypeLabel = 'Double Passage';
    if (isTriple) docTypeLabel = 'Triple Passage';

    groups.push({
      group_index: groupIndex,
      part: 'part7',
      group_type: 'reading_set',
      start_question: startQ,
      end_question: endQ,
      title: `Part 7 ${docTypeLabel} (Q${startQ}–${endQ})`,
      passage: `${docTypeLabel} content for Q${startQ}–${endQ}`,
      documents: isTriple
        ? [
            { title: 'Document 1', content: 'First Document' },
            { title: 'Document 2', content: 'Second Document' },
            { title: 'Document 3', content: 'Third Document' },
          ]
        : isDouble
        ? [
            { title: 'Document 1', content: 'First Document' },
            { title: 'Document 2', content: 'Second Document' },
          ]
        : [
            { title: 'Document 1', content: 'Single Document' },
          ],
    });

    for (let qNum = startQ; qNum <= endQ; qNum++) {
      questions.push({
        question_number: qNum,
        part: 'part7',
        group_index: groupIndex,
        question_text: `Question ${qNum}`,
        options: [
          { label: 'A', text: 'Option A' },
          { label: 'B', text: 'Option B' },
          { label: 'C', text: 'Option C' },
          { label: 'D', text: 'Option D' },
        ],
      });
    }
  });

  return {
    questions,
    groups,
  };
}
