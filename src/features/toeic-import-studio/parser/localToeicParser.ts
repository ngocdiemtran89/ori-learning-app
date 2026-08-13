/**
 * Deterministic Local TOEIC Structure & Text Parser
 */

import { StagingQuestion, StagingGroup } from '../types';

export interface LocalParseResult {
  questions: StagingQuestion[];
  groups: StagingGroup[];
  parsedPagesCount: number;
  warnings: string[];
}

export function parsePartFromQuestionNumber(qNum: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (qNum >= 1 && qNum <= 6) return 1;
  if (qNum >= 7 && qNum <= 31) return 2;
  if (qNum >= 32 && qNum <= 70) return 3;
  if (qNum >= 71 && qNum <= 100) return 4;
  if (qNum >= 101 && qNum <= 130) return 5;
  if (qNum >= 131 && qNum <= 146) return 6;
  return 7; // 147-200
}

export function parseLocalPdfPages(
  pagesText: Array<{
    pageNumber: number;
    text?: string;
    extractedText?: string;
    normalizedText?: string;
    ocrText?: string;
    activeTextSource?: string;
  }>,
  defaultPdfType: 'listening' | 'reading'
): LocalParseResult {
  const questionsMap = new Map<number, StagingQuestion>();
  const groupsMap = new Map<string, StagingGroup>();
  const warnings: string[] = [];

  pagesText.forEach((p) => {
    const pageNumber = p.pageNumber;
    const isOcr = p.activeTextSource === 'OCR_TEXT' && p.ocrText;
    const text = isOcr ? p.ocrText! : (p.normalizedText || p.extractedText || p.text || '');
    const provenanceSource = isOcr ? 'OCR_LOCAL' : 'LOCAL';

    if (!text || text.trim().length === 0) return;

    // 1. Detect Group Headers ("Questions X–Y refer to...", "Question X refers to...")
    const groupHeaderRegex = /Questions?\s*(\d{1,3})\s*(?:[–—]|to|-)\s*(\d{1,3})\s*refer\s*to\s*([^.\n]+)/gi;
    let groupMatch: RegExpExecArray | null;

    while ((groupMatch = groupHeaderRegex.exec(text)) !== null) {
      const startQ = parseInt(groupMatch[1], 10);
      const endQ = parseInt(groupMatch[2], 10);

      if (startQ >= 1 && endQ <= 200 && startQ <= endQ) {
        const part = parsePartFromQuestionNumber(startQ);
        const groupKey = `P${part}-Q${startQ}-${endQ}`;

        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, {
            groupKey,
            part: part as 3 | 4 | 6 | 7,
            startQuestion: startQ,
            endQuestion: endQ,
            instruction: groupMatch[0],
            passage: '',
            sourcePages: [pageNumber],
            provenance: 'LOCAL',
            confidence: 0.95,
            warnings: [],
          });
        } else {
          const existing = groupsMap.get(groupKey)!;
          if (!existing.sourcePages.includes(pageNumber)) {
            existing.sourcePages.push(pageNumber);
          }
        }
      }
    }

    // 2. Detect Question blocks ("147. What is...", "147) ...", "147: ...")
    const questionRegex = /(?:^|\n|\s)(\d{1,3})\s*[\.:\)]\s*([^\n]+(?:\n(?!\d{1,3}\s*[\.:\)])[^\n]+)*)/g;
    let qMatch: RegExpExecArray | null;

    while ((qMatch = questionRegex.exec(text)) !== null) {
      const qNum = parseInt(qMatch[1], 10);
      if (qNum >= 1 && qNum <= 200) {
        const part = parsePartFromQuestionNumber(qNum);
        const rawContent = qMatch[2].trim();

        // Extract Options (A), (B), (C), (D)
        const options = { A: '', B: '', C: '', D: '' };
        const optionRegex = /\(([A-D])\)\s*([^\(\n]+)/gi;
        let optMatch: RegExpExecArray | null;

        while ((optMatch = optionRegex.exec(rawContent)) !== null) {
          const letter = optMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
          options[letter] = optMatch[2].trim();
        }

        // Clean question text by stripping option lines
        const cleanQuestionText = rawContent.split(/\([A-D]\)/i)[0].trim();

        // Find associated group key if applicable
        let groupKey: string | undefined = undefined;
        for (const g of groupsMap.values()) {
          if (qNum >= g.startQuestion && qNum <= g.endQuestion) {
            groupKey = g.groupKey;
            break;
          }
        }

        if (!questionsMap.has(qNum)) {
          questionsMap.set(qNum, {
            questionNumber: qNum,
            part,
            questionText: cleanQuestionText,
            options,
            groupKey,
            source: {
              pdf: defaultPdfType,
              page: pageNumber,
            },
            provenance: {
              questionTextSource: provenanceSource as any,
              optionsSource: provenanceSource as any,
              translationSource: provenanceSource as any,
              groupSource: provenanceSource as any,
            },
            confidence: 0.85,
            status: 'AUTO_OK',
            warnings: [],
          });
        }
      }
    }
  });

  return {
    questions: Array.from(questionsMap.values()).sort((a, b) => a.questionNumber - b.questionNumber),
    groups: Array.from(groupsMap.values()).sort((a, b) => a.startQuestion - b.startQuestion),
    parsedPagesCount: pagesText.length,
    warnings,
  };
}
