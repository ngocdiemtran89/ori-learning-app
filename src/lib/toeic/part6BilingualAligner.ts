/**
 * Deterministic Frontend Helper for Student TOEIC Part 6 Interleaved Bilingual Passage Rendering
 *
 * Pairs English passage segments with corresponding Vietnamese translations.
 * Uses blank markers (131, 132, 133, 134, etc.) as primary anchor signals.
 * Never drops or alters text. Zero AI/API calls. Zero DB modifications.
 */

export interface Part6BilingualSegment {
  id: string;
  en: string;
  vi: string;
  questionNumbers: number[];
  isTitle?: boolean;
}

/**
 * Extracts Part 6 blank numbers (131..146) from a string snippet.
 */
export function extractBlankNumbers(text: string): number[] {
  if (!text) return [];
  const numbers = new Set<number>();

  // Match patterns like ------- 131, ------- [CÂU 131], ------- 131., [CÂU 131], ------- [131]
  const regex = /(?:-------?|--------?|\[\s*(?:CÂU|CAU)?\s*)?(\d{3})\b/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (num >= 131 && num <= 146) {
      numbers.add(num);
    }
  }

  return Array.from(numbers).sort((a, b) => a - b);
}

/**
 * Helper to split text by sentences while preserving blank markers with their sentence.
 */
function splitIntoSentenceUnits(text: string): string[] {
  if (!text || text.trim() === '') return [];

  // Split by newlines or sentence boundaries (., !, ?) that are followed by space and uppercase/marker
  const lines = text.split(/\r?\n+/).map(l => l.trim()).filter(Boolean);
  const units: string[] = [];

  for (const line of lines) {
    // If line contains multiple sentences without breaking blank markers
    const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z0-9\-])/).map(s => s.trim()).filter(Boolean);
    units.push(...sentences);
  }

  return units.length > 0 ? units : [text.trim()];
}

/**
 * Builds interleaved bilingual segments for Part 6 passage.
 */
export function buildPart6BilingualSegments(
  passageEn: string,
  passageVi?: string | null
): Part6BilingualSegment[] {
  const cleanEn = (passageEn || '').trim();
  const cleanVi = (passageVi || '').trim();

  if (!cleanEn && !cleanVi) return [];

  // Handle missing EN or missing VI fallback gracefully
  if (!cleanVi) {
    return [
      {
        id: 'seg-en-only',
        en: cleanEn,
        vi: '',
        questionNumbers: extractBlankNumbers(cleanEn),
      },
    ];
  }

  if (!cleanEn) {
    return [
      {
        id: 'seg-vi-only',
        en: '',
        vi: cleanVi,
        questionNumbers: extractBlankNumbers(cleanVi),
      },
    ];
  }

  // Split into paragraphs first
  const parasEn = cleanEn.split(/\r?\n\r?\n+/).map(p => p.trim()).filter(Boolean);
  const parasVi = cleanVi.split(/\r?\n\r?\n+/).map(p => p.trim()).filter(Boolean);

  const segments: Part6BilingualSegment[] = [];

  // Check if paragraph 0 is a Title in EN (no blank markers, short string <= 120 chars, no ending period or starts with header hint)
  let enBodyParas = [...parasEn];
  let viBodyParas = [...parasVi];

  if (parasEn.length > 0) {
    const p0En = parasEn[0];
    const p0EnBlanks = extractBlankNumbers(p0En);
    const isP0EnTitle = p0EnBlanks.length === 0 && p0En.length <= 120 && (!p0En.endsWith('.') || p0En.toLowerCase().startsWith('passage:') || p0En.toLowerCase().startsWith('questions '));

    if (isP0EnTitle) {
      const p0Vi = parasVi.length > 0 ? parasVi[0] : '';
      segments.push({
        id: 'seg-title-0',
        en: p0En,
        vi: p0Vi,
        questionNumbers: [],
        isTitle: true,
      });

      enBodyParas = parasEn.slice(1);
      if (p0Vi) {
        viBodyParas = parasVi.slice(1);
      }
    }
  }

  // Process body paragraphs with blank-anchored pairing
  const unitsEn: { text: string; blanks: number[] }[] = [];
  for (const p of enBodyParas) {
    const subUnits = splitIntoSentenceUnits(p);
    for (const u of subUnits) {
      unitsEn.push({ text: u, blanks: extractBlankNumbers(u) });
    }
  }

  const unitsVi: { text: string; blanks: number[] }[] = [];
  for (const p of viBodyParas) {
    const subUnits = splitIntoSentenceUnits(p);
    for (const u of subUnits) {
      unitsVi.push({ text: u, blanks: extractBlankNumbers(u) });
    }
  }

  // Try blank-anchored matching
  const usedViIndices = new Set<number>();

  for (let i = 0; i < unitsEn.length; i++) {
    const uEn = unitsEn[i];
    let matchedViIdx = -1;

    // 1. If uEn has blank markers, find first unused uVi with exact matching blank markers
    if (uEn.blanks.length > 0) {
      matchedViIdx = unitsVi.findIndex((uVi, idx) => {
        if (usedViIndices.has(idx)) return false;
        return uEn.blanks.some(b => uVi.blanks.includes(b));
      });
    }

    // 2. If no blank marker or no blank match, pick next unused uVi if sequence fits
    if (matchedViIdx === -1 && i < unitsVi.length && !usedViIndices.has(i)) {
      // Ensure uVi at index i does NOT belong to a different blank marker
      const candidateVi = unitsVi[i];
      if (candidateVi.blanks.length === 0 || uEn.blanks.length === 0 || uEn.blanks.some(b => candidateVi.blanks.includes(b))) {
        matchedViIdx = i;
      }
    }

    if (matchedViIdx !== -1) {
      usedViIndices.add(matchedViIdx);
      const uVi = unitsVi[matchedViIdx];
      const combinedBlanks = Array.from(new Set([...uEn.blanks, ...uVi.blanks])).sort((a, b) => a - b);
      segments.push({
        id: `seg-body-${i}`,
        en: uEn.text,
        vi: uVi.text,
        questionNumbers: combinedBlanks,
      });
    } else {
      segments.push({
        id: `seg-body-${i}`,
        en: uEn.text,
        vi: '',
        questionNumbers: uEn.blanks,
      });
    }
  }

  // Append any remaining unused VI units so NO text is ever lost
  for (let j = 0; j < unitsVi.length; j++) {
    if (!usedViIndices.has(j)) {
      const uVi = unitsVi[j];
      segments.push({
        id: `seg-vi-remaining-${j}`,
        en: '',
        vi: uVi.text,
        questionNumbers: uVi.blanks,
      });
    }
  }

  return segments;
}
