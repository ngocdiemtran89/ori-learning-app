import { describe, it, expect } from 'vitest';
import * as cmsValidationModule from './vocabularyValidation';
import {
  validateDeckInput,
  parseCollocations,
  normalizeToeicParts,
  isValidSlug,
  canPublishDeck,
  canPublishVocabularyItem,
} from './vocabularyValidation';

describe('Phase 3.1B — Vocabulary CMS Pure Validation & Helpers', () => {
  it('CASE A: slug "toeic-foundation" -> valid', () => {
    expect(isValidSlug('toeic-foundation')).toBe(true);
  });

  it('CASE B: slug "toeic foundation" (with space) -> invalid', () => {
    expect(isValidSlug('toeic foundation')).toBe(false);
  });

  it('CASE C: slug "TOEIC-foundation" (uppercase) -> invalid', () => {
    expect(isValidSlug('TOEIC-foundation')).toBe(false);
  });

  it('CASE D: slug "toeic--foundation" (double hyphens) -> invalid', () => {
    expect(isValidSlug('toeic--foundation')).toBe(false);
    expect(isValidSlug('-toeic-foundation')).toBe(false);
    expect(isValidSlug('toeic-foundation-')).toBe(false);
  });

  it('CASE E: sort_order = 1.5 -> invalid integer', () => {
    const res = validateDeckInput({
      title: 'Vocabulary Deck',
      slug: 'vocab-deck',
      level: 'foundation',
      sort_order: 1.5,
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.sort_order).toBeDefined();
  });

  it('CASE F: sort_order = 0 -> valid integer', () => {
    const res = validateDeckInput({
      title: 'Vocabulary Deck',
      slug: 'vocab-deck',
      level: 'foundation',
      sort_order: 0,
    });
    expect(res.isValid).toBe(true);
  });

  it('CASE G: deck publish with zero published words -> BLOCKED', () => {
    const res = canPublishDeck(
      { title: 'Deck 1', slug: 'deck-1', level: 'foundation', sort_order: 1 },
      0 // publishedWordsCount = 0
    );
    expect(res.canPublish).toBe(false);
    expect(res.error).toBe('Bạn cần xuất bản ít nhất 1 từ trước khi xuất bản bộ từ.');
  });

  it('CASE H: valid deck + >=1 published word -> may publish', () => {
    const res = canPublishDeck(
      { title: 'Deck 1', slug: 'deck-1', level: 'foundation', sort_order: 1 },
      3 // publishedWordsCount = 3
    );
    expect(res.canPublish).toBe(true);
    expect(res.error).toBeNull();
  });

  it('CASE I: word publish missing meaning -> BLOCKED', () => {
    const res = canPublishVocabularyItem({
      word: 'appointment',
      meaning_vi: '  ',
      deck_id: 'deck-1',
      sort_order: 1,
    });
    expect(res.canPublish).toBe(false);
    expect(res.error).toContain('Nghĩa tiếng Việt không được để trống');
  });

  it('CASE J: collocations parsing & TOEIC parts normalization', () => {
    const parsedCollocations = parseCollocations('make an appointment\nschedule an appointment');
    expect(parsedCollocations).toEqual(['make an appointment', 'schedule an appointment']);

    const canonicalParts = normalizeToeicParts(['Part 1', 'part 5']);
    expect(canonicalParts).toEqual(['part1', 'part5']);
  });

  it('CASE K: NO HARD DELETE CONFIRMATION in module architecture', () => {
    expect((cmsValidationModule as any).deleteVocabularyItem).toBeUndefined();
    expect((cmsValidationModule as any).deleteVocabularyDeck).toBeUndefined();
  });
});
