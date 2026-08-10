/**
 * Helper to build persisted translation units for Part 7 reading documents.
 * Pairs English units with Vietnamese units.
 * Supports titles, fields, sentences, chat lines, and paragraphs.
 * Zero text loss fallback guarantee.
 */

export interface Part7BilingualUnit {
  document_index: number;
  order: number;
  kind: 'title' | 'sentence' | 'paragraph' | 'chat' | 'table' | 'field';
  en: string;
  vi: string;
}

export function buildPart7BilingualUnits(
  documentsEn: Array<{ type?: string; title?: string; content: string }>,
  documentsVi?: Array<{ type?: string; title?: string; content: string }> | null
): Part7BilingualUnit[] {
  if (!documentsEn || !Array.isArray(documentsEn) || documentsEn.length === 0) {
    return [];
  }

  const units: Part7BilingualUnit[] = [];

  for (let docIdx = 0; docIdx < documentsEn.length; docIdx++) {
    const docEn = documentsEn[docIdx];
    const docVi = documentsVi && Array.isArray(documentsVi) && documentsVi.length > docIdx ? documentsVi[docIdx] : null;

    let order = 0;

    // Title unit
    if (docEn.title || (docVi && docVi.title)) {
      units.push({
        document_index: docIdx,
        order: order++,
        kind: 'title',
        en: docEn.title || '',
        vi: docVi?.title || '',
      });
    }

    // Content units
    const contentEn = (docEn.content || '').trim();
    const contentVi = (docVi?.content || '').trim();

    if (!contentEn && !contentVi) continue;

    if (!contentVi) {
      units.push({
        document_index: docIdx,
        order: order++,
        kind: 'paragraph',
        en: contentEn,
        vi: '',
      });
      continue;
    }

    const linesEn = contentEn.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const linesVi = contentVi.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // If counts match line-by-line (email fields, chat lines, schedule lines, or paragraphs)
    if (linesEn.length === linesVi.length && linesEn.length > 0) {
      for (let i = 0; i < linesEn.length; i++) {
        const lEn = linesEn[i];
        const lVi = linesVi[i];
        const kind = lEn.includes(':') ? 'field' : (lEn.includes('[') || lEn.includes(']')) ? 'chat' : 'sentence';

        units.push({
          document_index: docIdx,
          order: order++,
          kind,
          en: lEn,
          vi: lVi,
        });
      }
    } else {
      // Conservative paragraph fallback
      const parasEn = contentEn.split(/\r?\n\r?\n+/).map(p => p.trim()).filter(Boolean);
      const parasVi = contentVi.split(/\r?\n\r?\n+/).map(p => p.trim()).filter(Boolean);

      if (parasEn.length === parasVi.length && parasEn.length > 0) {
        for (let i = 0; i < parasEn.length; i++) {
          units.push({
            document_index: docIdx,
            order: order++,
            kind: 'paragraph',
            en: parasEn[i],
            vi: parasVi[i],
          });
        }
      } else {
        // Full document content fallback (zero text loss)
        units.push({
          document_index: docIdx,
          order: order++,
          kind: 'paragraph',
          en: contentEn,
          vi: contentVi,
        });
      }
    }
  }

  return units;
}
