/**
 * Part 7 Pure Structure Parser (Deterministic - No AI/LLM)
 * Detects reading group boundaries and question blocks strictly from source English headers.
 */

export interface Part7DetectedStructureGroup {
  sourceOrder: number;
  startQuestion: number;
  endQuestion: number;
  questionNumbers: number[];
  sourceHeader: string;
  documentKind?: string;
  passageText?: string;
  passageFingerprint?: string;
  status: 'complete' | 'incomplete' | 'duplicate' | 'overlap' | 'invalid';
  validationError?: string;
}

/**
 * Normalizes passage text conservatively to compute a deterministic fingerprint.
 */
export function computePassageFingerprint(rawPassage: string): string {
  if (!rawPassage) return '';
  const normalized = rawPassage
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ');

  // Compute a simple deterministic Hash (FNV-1a 32-bit hex)
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Parses question candidate numbers (147-200) strictly matching anchored question block syntax:
 * "147.", "147)", "147:" at line/block boundaries.
 * Prevents text numbers like "Room 147", "May 3", "$149" from being recognized as questions.
 */
export function extractQuestionNumbersFromBlock(blockText: string): number[] {
  if (!blockText) return [];
  const numbers: number[] = [];
  const qRegex = /(?:^|\n)\s*(\d{3})\s*[\.\)\:]/gm;
  let match: RegExpExecArray | null;

  while ((match = qRegex.exec(blockText)) !== null) {
    const qNum = parseInt(match[1], 10);
    if (qNum >= 147 && qNum <= 200 && !numbers.includes(qNum)) {
      numbers.push(qNum);
    }
  }

  return numbers.sort((a, b) => a - b);
}

/**
 * Main Deterministic Structure Parser
 */
export function parsePart7StructureFromText(text: string): Part7DetectedStructureGroup[] {
  if (!text || !text.trim()) return [];

  const groups: Part7DetectedStructureGroup[] = [];

  // Header regex: "Questions 147-148 refer to...", "Questions 147–148 refer to...", "Question 147 refers to..."
  // Accepts -, –, —, flexible spacing, case-insensitive
  const headerRegex = /(?:^|\n)\s*(?:Questions?|Câu\s*hỏi|Câu)\s*(\d{3})\s*(?:[–—\-]\s*(\d{3}))?\s*(?:refer\s*to|liên\s*quan\s*đến|dưới\s*đây)?[\s\S]*?(?=(?:\n\s*(?:Questions?|Câu\s*hỏi|Câu)\s*\d{3}|$))/gi;

  const matches: { fullText: string; startQ: number; endQ: number; rawHeader: string; index: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = headerRegex.exec(text)) !== null) {
    const startQ = parseInt(match[1], 10);
    const endQ = match[2] ? parseInt(match[2], 10) : startQ;
    const fullBlock = match[0].trim();
    const rawHeader = match[0].split('\n')[0].trim();

    if (startQ >= 147 && startQ <= 200 && endQ >= startQ && endQ <= 200) {
      matches.push({
        fullText: fullBlock,
        startQ,
        endQ,
        rawHeader,
        index: match.index,
      });
    }
  }

  // Process matched header blocks
  matches.forEach((m, idx) => {
    const expectedNumbers: number[] = [];
    for (let q = m.startQ; q <= m.endQ; q++) {
      expectedNumbers.push(q);
    }

    // Extract actual parsed question numbers from block
    const parsedQNums = extractQuestionNumbersFromBlock(m.fullText);

    // Extract passage text (text before first question block)
    const firstQMatch = /(?:^|\n)\s*(\d{3})\s*[\.\)\:]/m.exec(m.fullText);
    let passageText = m.fullText;
    if (firstQMatch) {
      passageText = m.fullText.substring(0, firstQMatch.index).trim();
    }
    const fingerprint = computePassageFingerprint(passageText);

    // Document Kind detection
    let documentKind = 'Passage';
    const lowerHeader = m.fullText.toLowerCase();
    if (lowerHeader.includes('email') || lowerHeader.includes('e-mail')) documentKind = 'Email';
    else if (lowerHeader.includes('notice')) documentKind = 'Notice';
    else if (lowerHeader.includes('advertisement') || lowerHeader.includes('ad ')) documentKind = 'Advertisement';
    else if (lowerHeader.includes('article')) documentKind = 'Article';
    else if (lowerHeader.includes('letter')) documentKind = 'Letter';
    else if (lowerHeader.includes('chat') || lowerHeader.includes('message')) documentKind = 'Text Message / Chat';

    // Status evaluation
    let status: Part7DetectedStructureGroup['status'] = 'complete';
    let validationError: string | undefined = undefined;

    // Check for out-of-range parsed questions
    const outOfRangeQ = parsedQNums.find((q) => q < m.startQ || q > m.endQ);
    if (outOfRangeQ) {
      status = 'invalid';
      validationError = `Q${outOfRangeQ} nằm ngoài range của header ${m.startQ}–${m.endQ}`;
    } else if (parsedQNums.length < expectedNumbers.length) {
      status = 'incomplete';
      const missing = expectedNumbers.filter((q) => !parsedQNums.includes(q));
      validationError = `Thiếu câu: ${missing.map((q) => `Q${q}`).join(', ')}`;
    }

    groups.push({
      sourceOrder: idx + 1,
      startQuestion: m.startQ,
      endQuestion: m.endQ,
      questionNumbers: parsedQNums.length > 0 ? parsedQNums : expectedNumbers,
      sourceHeader: m.rawHeader,
      documentKind,
      passageText,
      passageFingerprint: fingerprint,
      status,
      validationError,
    });
  });

  return groups;
}
