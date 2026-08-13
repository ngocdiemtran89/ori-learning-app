// ============================================================
// ORI TOEIC Website V2 — Option Normalizer Utility
// ============================================================

/**
 * Normalizes input options into standard formatted strings array:
 * ["(A) textA", "(B) textB", "(C) textC", "(D) textD"]
 * 
 * Invariants:
 * - Does NOT strip 'B' or letters from plain text (e.g., 'Beta' remains 'Beta').
 * - Preserves plain strings intact.
 * - Handles array of strings or key-value objects.
 */
export function normalizeToeicOptions(
  inputOptions: string[] | Record<string, string> | null | undefined,
  part?: string
): string[] {
  if (!inputOptions) {
    if (part === 'P2') {
      return ['(A) Option A', '(B) Option B', '(C) Option C'];
    }
    return ['(A) Option A', '(B) Option B', '(C) Option C', '(D) Option D'];
  }

  let rawList: { label: string; text: string }[] = [];

  if (Array.isArray(inputOptions)) {
    const labels = ['A', 'B', 'C', 'D'];
    rawList = inputOptions.map((opt, idx) => {
      const defaultLabel = labels[idx] || String.fromCharCode(65 + idx);
      const strOpt = String(opt || '').trim();
      
      // Match pattern (A) text, A. text, A) text
      const match = strOpt.match(/^\(?([A-D])\)?[\.\:\s\)\-]+(.*)$/i);
      if (match) {
        return {
          label: match[1].toUpperCase(),
          text: match[2].trim(),
        };
      }
      
      return {
        label: defaultLabel,
        text: strOpt,
      };
    });
  } else if (typeof inputOptions === 'object') {
    const keys = Object.keys(inputOptions).sort();
    rawList = keys.map((key) => {
      const cleanLabel = key.replace(/[^A-Za-z]/g, '').toUpperCase() || 'A';
      const textVal = String(inputOptions[key] || '').trim();
      
      const match = textVal.match(/^\(?([A-D])\)?[\.\:\s\)\-]+(.*)$/i);
      if (match) {
        return {
          label: match[1].toUpperCase(),
          text: match[2].trim(),
        };
      }

      return {
        label: cleanLabel,
        text: textVal,
      };
    });
  }

  // Map to (A) text format
  return rawList.map((item) => `(${item.label}) ${item.text}`);
}
