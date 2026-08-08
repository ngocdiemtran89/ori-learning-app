import { describe, it, expect } from 'vitest';
import * as cmsValidationModule from './vocabularyValidation';
import {
  validateVocabularyItemInput,
  validateDeckInput,
  parseCollocations,
  normalizeToeicParts,
  slugifyTitle,
} from './vocabularyValidation';

describe('Phase 3.1 — Vocabulary CMS Pure Validation & Helpers', () => {
  it('CASE A: Empty word -> validation fails', () => {
    const res = validateVocabularyItemInput({
      word: '',
      meaning_vi: 'cuộc hẹn',
      deck_id: 'deck-1',
      sort_order: 1,
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.word).toBeDefined();
  });

  it('CASE B: Empty meaning_vi -> validation fails', () => {
    const res = validateVocabularyItemInput({
      word: 'appointment',
      meaning_vi: '  ',
      deck_id: 'deck-1',
      sort_order: 1,
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.meaning_vi).toBeDefined();
  });

  it('CASE C: Valid word + meaning_vi -> validation passes', () => {
    const res = validateVocabularyItemInput({
      word: 'appointment',
      meaning_vi: 'cuộc hẹn',
      deck_id: 'deck-1',
      sort_order: 1,
    });
    expect(res.isValid).toBe(true);
    expect(Object.keys(res.errors).length).toBe(0);
  });

  it('CASE D: Collocations textarea parsing -> trims empty lines & converts to array', () => {
    const text = 'make an appointment\nschedule an appointment\n\n  cancel an appointment  \n';
    const parsed = parseCollocations(text);
    expect(parsed).toEqual([
      'make an appointment',
      'schedule an appointment',
      'cancel an appointment',
    ]);
  });

  it('CASE E: TOEIC parts normalization -> converts variants to canonical part1..part7', () => {
    const raw = ['Part 2', 'part 5', '5', 'invalid_part'];
    const canonical = normalizeToeicParts(raw);
    expect(canonical).toEqual(['part2', 'part5']);
  });

  it('CASE F: Invalid negative sort_order -> validation fails', () => {
    const res = validateDeckInput({
      title: 'Vocabulary Deck',
      slug: 'vocab-deck',
      level: 'foundation',
      sort_order: -5,
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.sort_order).toBeDefined();
  });

  it('CASE G: Slug normalization & validation', () => {
    expect(slugifyTitle('Từ vựng Cốt Lõi TOEIC! ')).toBe('tu-vung-cot-loi-toeic');

    const validRes = validateDeckInput({
      title: 'Test Deck',
      slug: 'test-deck-1',
      level: 'foundation',
      sort_order: 1,
    });
    expect(validRes.isValid).toBe(true);

    const invalidSlugRes = validateDeckInput({
      title: 'Test Deck',
      slug: 'Invalid Slug!',
      level: 'foundation',
      sort_order: 1,
    });
    expect(invalidSlugRes.isValid).toBe(false);
    expect(invalidSlugRes.errors.slug).toBeDefined();
  });

  it('NO HARD DELETE CONFIRMATION: Verify vocabulary validation module exposes NO delete mutations', () => {
    // Architectural check confirming no delete mutation exported
    expect((cmsValidationModule as any).deleteVocabularyItem).toBeUndefined();
    expect((cmsValidationModule as any).deleteVocabularyDeck).toBeUndefined();
  });
});
