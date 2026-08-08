/**
 * Pure Validation & Format Helpers for Phase 3.1 Vocabulary CMS
 */

export function slugifyTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // trim hyphens
    .trim();
}

export function parseCollocations(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function normalizeToeicParts(parts: string[] | null | undefined): string[] {
  if (!parts || !Array.isArray(parts)) return [];
  const validParts = new Set(['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7']);
  const result: string[] = [];

  for (const raw of parts) {
    if (!raw) continue;
    const clean = raw.toLowerCase().trim().replace(/\s+/g, '');
    let canonical = clean;
    if (/^[1-7]$/.test(clean)) {
      canonical = `part${clean}`;
    }
    if (validParts.has(canonical) && !result.includes(canonical)) {
      result.push(canonical);
    }
  }

  return result.sort();
}

export interface DeckValidationInput {
  title: string;
  slug: string;
  level: string;
  sort_order: number;
}

export interface VocabularyItemValidationInput {
  word: string;
  meaning_vi: string;
  deck_id: string;
  sort_order: number;
}

export function validateDeckInput(input: DeckValidationInput): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.title || !input.title.trim()) {
    errors.title = 'Tên bộ từ vựng không được để trống.';
  }

  if (!input.slug || !input.slug.trim()) {
    errors.slug = 'Slug không được để trống.';
  } else if (!/^[a-z0-9-]+$/.test(input.slug.trim())) {
    errors.slug = 'Slug chỉ được chứa chữ cái thường (a-z), chữ số (0-9) và dấu gạch ngang (-).';
  }

  if (!input.level || !input.level.trim()) {
    errors.level = 'Trình độ không được để trống.';
  }

  if (typeof input.sort_order !== 'number' || isNaN(input.sort_order) || input.sort_order < 0) {
    errors.sort_order = 'Thứ tự hiển thị phải là số nguyên lớn hơn hoặc bằng 0.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateVocabularyItemInput(
  input: VocabularyItemValidationInput
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.word || !input.word.trim()) {
    errors.word = 'Từ vựng (Word) không được để trống.';
  }

  if (!input.meaning_vi || !input.meaning_vi.trim()) {
    errors.meaning_vi = 'Nghĩa tiếng Việt không được để trống.';
  }

  if (!input.deck_id || !input.deck_id.trim()) {
    errors.deck_id = 'Bộ từ vựng (Deck) không được để trống.';
  }

  if (typeof input.sort_order !== 'number' || isNaN(input.sort_order) || input.sort_order < 0) {
    errors.sort_order = 'Thứ tự hiển thị phải là số nguyên lớn hơn hoặc bằng 0.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
