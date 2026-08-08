import { supabase } from './client';
import { VocabularyDeck, VocabularyItem, ReviewRating } from './types';
import { calculateSRSNextReview, SRSItemState } from '../srs/sm2';

/**
 * Fetch all published vocabulary decks
 */
export async function getVocabularyDecks(): Promise<VocabularyDeck[]> {
  const { data, error } = await supabase
    .from('vocabulary_decks')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[ORI Vocab] Error fetching decks:', error.message);
    return [];
  }
  return data as VocabularyDeck[];
}

/**
 * Fetch a single vocabulary deck by slug or ID
 */
export async function getVocabularyDeckBySlug(deckIdentifier: string): Promise<VocabularyDeck | null> {
  const { data, error } = await supabase
    .from('vocabulary_decks')
    .select('*')
    .or(`slug.eq.${deckIdentifier},id.eq.${deckIdentifier}`)
    .maybeSingle();

  if (error) {
    console.error('[ORI Vocab] Error fetching deck:', error.message);
    return null;
  }
  return data as VocabularyDeck | null;
}

/**
 * Fetch all published vocabulary items for a given deck ID
 */
export async function getVocabularyItems(deckId: string): Promise<VocabularyItem[]> {
  const { data, error } = await supabase
    .from('vocabulary_items')
    .select('*')
    .eq('deck_id', deckId)
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[ORI Vocab] Error fetching items:', error.message);
    return [];
  }
  return data as VocabularyItem[];
}

/**
 * Fetch vocabulary items due today for a specific user based on SRS review state
 */
export async function getDueVocabularyItems(userId: string): Promise<VocabularyItem[]> {
  const now = new Date().toISOString();

  // Query reviews due for this user
  const { data: reviews, error: reviewErr } = await supabase
    .from('vocabulary_reviews')
    .select('vocabulary_id')
    .eq('user_id', userId)
    .lte('next_review_at', now);

  if (reviewErr) {
    console.error('[ORI Vocab] Error fetching due reviews:', reviewErr.message);
    return [];
  }

  if (!reviews || reviews.length === 0) {
    return [];
  }

  const vocabIds = reviews.map((r) => r.vocabulary_id);

  const { data: items, error: itemErr } = await supabase
    .from('vocabulary_items')
    .select('*')
    .in('id', vocabIds)
    .eq('is_published', true);

  if (itemErr) {
    console.error('[ORI Vocab] Error fetching due items:', itemErr.message);
    return [];
  }

  return items as VocabularyItem[];
}

/**
 * Fetch set of saved word IDs for a given user
 */
export async function getSavedWordIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('saved_words')
    .select('vocabulary_id')
    .eq('user_id', userId);

  if (error) {
    console.error('[ORI Vocab] Error fetching saved words:', error.message);
    return new Set();
  }

  return new Set((data || []).map((row) => row.vocabulary_id));
}

export interface ToggleSaveResult {
  success: boolean;
  isSaved: boolean;
  error: string | null;
}

/**
 * Toggle save / unsave a word in saved_words
 */
export async function toggleSaveWord(
  userId: string,
  vocabularyId: string
): Promise<ToggleSaveResult> {
  // Check if already saved
  const { data: existing } = await supabase
    .from('saved_words')
    .select('vocabulary_id')
    .eq('user_id', userId)
    .eq('vocabulary_id', vocabularyId)
    .maybeSingle();

  if (existing) {
    // Delete
    const { error: delErr } = await supabase
      .from('saved_words')
      .delete()
      .eq('user_id', userId)
      .eq('vocabulary_id', vocabularyId);

    if (delErr) {
      console.error('[ORI Vocab] Error unsaving word:', delErr.message);
      return { success: false, isSaved: true, error: delErr.message };
    }
    return { success: true, isSaved: false, error: null }; // Now unsaved
  } else {
    // Insert
    const { error: insErr } = await supabase.from('saved_words').insert({
      user_id: userId,
      vocabulary_id: vocabularyId,
    });

    if (insErr) {
      console.error('[ORI Vocab] Error saving word:', insErr.message);
      return { success: false, isSaved: false, error: insErr.message };
    }
    return { success: true, isSaved: true, error: null }; // Now saved
  }
}

/**
 * Record a SRS rating review for a vocabulary item
 */
export async function recordVocabularyReview(
  userId: string,
  vocabularyId: string,
  rating: ReviewRating
): Promise<SRSItemState | null> {
  // Fetch current review state if exists
  const { data: current } = await supabase
    .from('vocabulary_reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('vocabulary_id', vocabularyId)
    .maybeSingle();

  const nextState = calculateSRSNextReview(current as SRSItemState | undefined, rating);

  const { error } = await supabase.from('vocabulary_reviews').upsert({
    user_id: userId,
    vocabulary_id: vocabularyId,
    rating,
    repetitions: nextState.repetitions,
    interval_days: nextState.interval_days,
    ease_factor: nextState.ease_factor,
    next_review_at: nextState.next_review_at,
    last_reviewed_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[ORI Vocab] Error saving review state:', error.message);
    return null;
  }

  return nextState;
}
