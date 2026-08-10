/**
 * Deterministic Part 6 Group-Level Block Parser
 * Parses ONE known Part 6 four-question group (e.g. Q131-Q134) from a single pasted text block.
 *
 * Extracts:
 * - passage: everything before the options (preserving inline blank markers like ------- 131.)
 * - questions: array of parsed questions matching [startQuestion ... endQuestion] with [A, B, C, D] options ONLY.
 *
 * TOEIC Part 6 questions do NOT have standalone question stems (question_text is not extracted).
 * Any text surrounding blank markers belongs to the passage.
 */

export interface ParsedGroupQuestion {
  question_number: number;
  options: [string, string, string, string];
}

export interface Part6GroupBlockParseResult {
  passage: string;
  questions: ParsedGroupQuestion[];
  missingQuestionNumbers: number[];
}

export function parsePart6GroupBlock(
  text: string,
  startQuestion: number,
  endQuestion: number
): Part6GroupBlockParseResult {
  const targetNumbers = new Set<number>();
  for (let q = startQuestion; q <= endQuestion; q++) {
    targetNumbers.add(q);
  }

  if (!text || !text.trim()) {
    return {
      passage: '',
      questions: [],
      missingQuestionNumbers: Array.from(targetNumbers),
    };
  }

  let normalized = text.replace(/\r\n/g, '\n').trim();

  // Strip optional PASSAGE: or ĐOẠN VĂN: header label at top
  normalized = normalized.replace(/^(?:PASSAGE|ĐOẠN\s*VĂN|BÀI\s*ĐỌC)\s*[:\.]?\s*\n?/i, '').trim();

  const lines = normalized.split('\n');
  const passageLines: string[] = [];
  const rawQuestionBlocks: Map<number, { lines: string[] }> = new Map();

  let activeQNum: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (activeQNum === null) {
        passageLines.push(rawLine);
      } else {
        const block = rawQuestionBlocks.get(activeQNum);
        if (block) block.lines.push(rawLine);
      }
      continue;
    }

    // Skip range headers if present (e.g., QUESTIONS 131-134, CÂU 131-134)
    if (/^(?:CÂU|CAU|Q|QUESTIONS?)\s*#?\s*\d+\s*-\s*\d+/i.test(trimmed)) {
      continue;
    }

    // Clean line for header check (strip markdown #, *, _)
    const cleanLine = trimmed
      .replace(/^[#\s]+/, '')
      .replace(/^[\*\_\s]+/, '')
      .replace(/[\*\_\s]+$/, '')
      .trim();

    // Check if line is a question header for target range
    let qMatchNum: number | null = null;

    // Must NOT be an inline passage blank marker like ------- 131. or ... ------- 131.
    if (!/^[-–—_]{2,}\s*\d+/i.test(cleanLine) && !/[-–—_]{2,}\s*\d+/i.test(trimmed)) {
      const explicitMatch = cleanLine.match(/^(?:QUESTIONS?|CÂU|CAU)\s*#?\s*(\d{3})\b\s*[:\.]?\s*/i) ||
                            cleanLine.match(/^Q\s*#?\s*(\d{3})\b\s*[:\.]?\s*/i);

      if (explicitMatch) {
        const n = parseInt(explicitMatch[1], 10);
        if (targetNumbers.has(n)) {
          qMatchNum = n;
        }
      } else {
        const bareMatch = cleanLine.match(/^(\d{3})\s*[\.\)]?\s*$/);
        if (bareMatch) {
          const n = parseInt(bareMatch[1], 10);
          if (targetNumbers.has(n)) {
            qMatchNum = n;
          }
        } else {
          // Question header on same line as choice (A) e.g. "131. (A) text"
          const sameLineOptMatch = cleanLine.match(/^(\d{3})\s*[\.\)]?\s*(?=(?:\(?[A-D][\)\.\:\s]))/i);
          if (sameLineOptMatch) {
            const n = parseInt(sameLineOptMatch[1], 10);
            if (targetNumbers.has(n)) {
              qMatchNum = n;
            }
          }
        }
      }
    }

    if (qMatchNum !== null) {
      activeQNum = qMatchNum;
      if (!rawQuestionBlocks.has(activeQNum)) {
        rawQuestionBlocks.set(activeQNum, { lines: [] });
      }
      // If line contains options after header (e.g. 131. (A) closed (B) close ...)
      const textAfterHeader = cleanLine.replace(/^(?:QUESTIONS?|CÂU|CAU|Q)?\s*#?\s*\d{3}\s*[\.\)]?\s*/i, '').trim();
      if (textAfterHeader) {
        rawQuestionBlocks.get(activeQNum)!.lines.push(textAfterHeader);
      }
      continue;
    }

    if (activeQNum !== null) {
      rawQuestionBlocks.get(activeQNum)!.lines.push(rawLine);
    } else {
      passageLines.push(rawLine);
    }
  }

  // Parse options from rawQuestionBlocks
  const questions: ParsedGroupQuestion[] = [];
  const foundQNums = new Set<number>();

  rawQuestionBlocks.forEach((block, qNum) => {
    foundQNums.add(qNum);
    const rawOptionsMap: Map<string, string> = new Map();
    let currentOptionLabel: string | null = null;

    for (const rawLine of block.lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      // Option line check (e.g., (A) Candy, A. Cheese, A) Bread, A: Pasta)
      const optMatch = trimmed.match(/^\s*(?:[\(\[]?([A-D])[\)\]\.\:]\s*|\b([A-D])\.\s+)(.*)$/i);
      if (optMatch) {
        const label = (optMatch[1] || optMatch[2]).toUpperCase();
        const optText = optMatch[3].replace(/^[\*\_\s]+/, '').replace(/[\*\_\s]+$/, '').trim();
        rawOptionsMap.set(label, optText);
        currentOptionLabel = label;
        continue;
      }

      if (currentOptionLabel && rawOptionsMap.has(currentOptionLabel)) {
        const existingOpt = rawOptionsMap.get(currentOptionLabel)!;
        rawOptionsMap.set(currentOptionLabel, `${existingOpt} ${trimmed.trim()}`);
        continue;
      }
    }

    const options: [string, string, string, string] = [
      rawOptionsMap.get('A') || '',
      rawOptionsMap.get('B') || '',
      rawOptionsMap.get('C') || '',
      rawOptionsMap.get('D') || '',
    ];

    questions.push({
      question_number: qNum,
      options,
    });
  });

  questions.sort((a, b) => a.question_number - b.question_number);

  const missingQuestionNumbers = Array.from(targetNumbers).filter(q => !foundQNums.has(q));

  return {
    passage: passageLines.join('\n').trim(),
    questions,
    missingQuestionNumbers,
  };
}
