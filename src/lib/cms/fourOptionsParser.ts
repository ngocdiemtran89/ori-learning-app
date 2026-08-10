/**
 * Deterministic Four-Option Parser for Bulk Option Pasting
 * Parses 4 choices (A, B, C, D) from a pasted block of text.
 * Supports:
 * - (A) text (B) text (C) text (D) text
 * - A. text / B. text / C. text / D. text
 * - A) text / B) text / C) text / D) text
 * - A: text / B: text / C: text / D: text
 * - Multiline option text (lines wrapping under the same choice)
 * - 4 plain non-empty lines (line 1 -> A, line 2 -> B, line 3 -> C, line 4 -> D)
 *
 * NO dependency on TOEIC database, RPC, or Part 6 document parser.
 */

export function parseFourOptions(text: string): [string, string, string, string] | null {
  if (!text || !text.trim()) return null;

  const normalizedInput = text.replace(/\r\n/g, '\n').trim();

  // Helper to find starting position of label A, B, C, D
  const findMarker = (src: string, label: 'A' | 'B' | 'C' | 'D') => {
    // Regex matching markers like (A), [A], A., A), A:
    const pattern = new RegExp(`(?:^|\\s)(?:[\\(\\[]?${label}[\\)\\]\\.\\:]|\\b${label}[\\.\\:\\)])\\s*`, 'i');
    const match = src.match(pattern);
    if (!match || typeof match.index !== 'number') return null;

    // Calculate match offset relative to src
    const leadingWsMatch = match[0].match(/^\s+/);
    const leadingWsLen = leadingWsMatch ? leadingWsMatch[0].length : 0;
    const startIndex = match.index + leadingWsLen;
    const fullMatchLength = match[0].length - leadingWsLen;

    return {
      startIndex,
      endIndex: startIndex + fullMatchLength,
    };
  };

  const mA = findMarker(normalizedInput, 'A');
  const mB = findMarker(normalizedInput, 'B');
  const mC = findMarker(normalizedInput, 'C');
  const mD = findMarker(normalizedInput, 'D');

  // If all 4 markers are found in strictly sequential order: A < B < C < D
  if (mA && mB && mC && mD && mA.startIndex < mB.startIndex && mB.startIndex < mC.startIndex && mC.startIndex < mD.startIndex) {
    const rawA = normalizedInput.slice(mA.endIndex, mB.startIndex);
    const rawB = normalizedInput.slice(mB.endIndex, mC.startIndex);
    const rawC = normalizedInput.slice(mC.endIndex, mD.startIndex);
    const rawD = normalizedInput.slice(mD.endIndex);

    const clean = (val: string) => val.split('\n').map(l => l.trim()).filter(Boolean).join(' ').trim();

    return [clean(rawA), clean(rawB), clean(rawC), clean(rawD)];
  }

  // Fallback: 4 plain non-empty lines
  const lines = normalizedInput.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 4) {
    // Strip leading marker if present on each line (e.g. "1. text")
    const cleanLine = (l: string) => l.replace(/^(?:[\(\[]?[A-D1-4][\)\.\:]\]?\s*)+/i, '').trim();
    return [cleanLine(lines[0]), cleanLine(lines[1]), cleanLine(lines[2]), cleanLine(lines[3])];
  }

  return null;
}
