// ============================================================
// Phase P3.5I: TOEIC Content Completeness & Safe String Helpers
// Prevents runtime `.trim is not a function` crashes across Admin UI
// ============================================================

/**
 * Safely trim any value if it is a string or number.
 * Returns empty string for null, undefined, objects, or arrays.
 */
export function safeTrim(val: unknown): string {
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val).trim();
  return '';
}

/**
 * Check if a value is a non-empty string after trimming.
 */
export function hasText(val: unknown): boolean {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Extract clean option string from a string or option object.
 * Handles both plain strings (e.g. "(A) The woman...") and option objects (e.g. { label: "A", text: "..." }).
 */
export function safeOptionText(opt: unknown): string {
  if (!opt) return '';
  if (typeof opt === 'string') return opt.trim();
  if (typeof opt === 'object' && opt !== null) {
    if ('text' in opt && typeof (opt as any).text === 'string') {
      return (opt as any).text.trim();
    }
    if ('text_vi' in opt && typeof (opt as any).text_vi === 'string') {
      return (opt as any).text_vi.trim();
    }
    if ('value' in opt && typeof (opt as any).value === 'string') {
      return (opt as any).value.trim();
    }
  }
  return String(opt).trim();
}

/**
 * Check if an option item contains non-empty text.
 */
export function hasOptionText(opt: unknown): boolean {
  return safeOptionText(opt).length > 0;
}

/**
 * Check if an option item contains real English text (not just "(A)", "(B)", "(C)", "(D)").
 */
export function hasRealOptionText(opt: unknown): boolean {
  const txt = safeOptionText(opt);
  if (!txt) return false;
  return !/^\([A-D]\)$/.test(txt);
}

/**
 * Check if an array contains any item with non-empty text content.
 */
export function hasStringArrayContent(val: unknown): boolean {
  if (!Array.isArray(val)) return false;
  return val.some((item) => hasOptionText(item));
}
