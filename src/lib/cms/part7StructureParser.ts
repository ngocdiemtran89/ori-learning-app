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
 * Normalizes passage text7N (preserves case, strips extra whitespace/newlines)
 */
export function normalizePassageText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts raw passage text from a string or document array
 */
export function extractPassageText(passage?: string | null, documents?: any[]): string {
  if (passage && passage.trim().length > 0) {
    return passage.trim();
  }
  if (Array.isArray(documents) && documents.length > 0) {
    const parts: string[] = [];
    for (const doc of documents) {
      if (typeof doc === 'string' && doc.trim()) {
        parts.push(doc.trim());
      } else if (typeof doc === 'object' && doc !== null) {
        if (doc.title && typeof doc.title === 'string' && doc.title.trim()) {
          parts.push(doc.title.trim());
        }
        const body = doc.content || doc.text || doc.body;
        if (body && typeof body === 'string' && body.trim()) {
          parts.push(body.trim());
        }
      }
    }
    return parts.join('\n\n').trim();
  }
  return '';
}

/**
 * Standard 32-char MD5 implementation for client-server 100% hash parity.
 */
export function md5(input: string): string {
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }

  function bitRotateLeft(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt));
  }

  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  const utf8 = unescape(encodeURIComponent(input));
  const bin: number[] = Array(Math.ceil((utf8.length + 9) / 64) * 16).fill(0);
  for (let i = 0; i < utf8.length; i++) {
    bin[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << ((i % 4) * 8);
  }
  bin[utf8.length >> 2] |= 0x80 << ((utf8.length % 4) * 8);
  bin[bin.length - 2] = utf8.length * 8;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < bin.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;

    a = md5ff(a, b, c, d, bin[i], 7, -680876936);
    d = md5ff(d, a, b, c, bin[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, bin[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, bin[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, bin[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, bin[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, bin[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, bin[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, bin[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, bin[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, bin[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, bin[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, bin[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, bin[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, bin[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, bin[i + 15], 22, 1236535329);

    a = md5gg(a, b, c, d, bin[i + 1], 5, -358537222);
    d = md5gg(d, a, b, c, bin[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, bin[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, bin[i], 20, -373897302);
    a = md5gg(a, b, c, d, bin[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, bin[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, bin[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, bin[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, bin[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, bin[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, bin[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, bin[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, bin[i + 13], 5, -144468057);
    d = md5gg(d, a, b, c, bin[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, bin[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, bin[i + 12], 20, -1926607734);

    a = md5hh(a, b, c, d, bin[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, bin[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, bin[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, bin[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, bin[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, bin[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, bin[i + 7], 16, -1554976322);
    b = md5hh(b, c, d, a, bin[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, bin[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, bin[i], 11, -358537222);
    c = md5hh(c, d, a, b, bin[i + 5], 16, -722521979);
    b = md5hh(b, c, d, a, bin[i + 10], 23, 76029189);
    a = md5hh(a, b, c, d, bin[i + 15], 4, -640364409);
    d = md5hh(d, a, b, c, bin[i + 4], 11, -421815835);
    c = md5hh(c, d, a, b, bin[i + 9], 16, 530742520);
    b = md5hh(b, c, d, a, bin[i + 14], 23, -995338651);

    a = md5ii(a, b, c, d, bin[i], 6, -198630844);
    d = md5ii(d, a, b, c, bin[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, bin[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, bin[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, bin[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, bin[i + 3], 10, -1894980156);
    c = md5ii(c, d, a, b, bin[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, bin[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, bin[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, bin[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, bin[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, bin[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, bin[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, bin[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, bin[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, bin[i + 9], 21, -343485551);

    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  const hexDigits: string[] = [];
  for (const n of [a, b, c, d]) {
    for (let j = 0; j < 4; j++) {
      const byteVal = (n >> (j * 8)) & 0xff;
      hexDigits.push(byteVal.toString(16).padStart(2, '0'));
    }
  }
  return hexDigits.join('');
}

/**
 * Computes a 32-character MD5 hash of the normalized passage text.
 */
export function computePassageFingerprint(rawPassage?: string | null, documents?: any[]): string {
  const text = extractPassageText(rawPassage, documents);
  const normalized = normalizePassageText(text);
  if (!normalized) return '';
  return md5(normalized);
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
