/**
 * Admin Vocabulary CMS Data Layer (Phase 3.1B)
 * Data mutations and queries for Vocabulary Decks and Items.
 * STRICT RULE: NO HARD DELETE MUTATIONS EXPOSED.
 */

import { supabase } from './client';
import { VocabularyDeck, VocabularyItem } from './types';
import { canPublishDeck, canPublishVocabularyItem } from '../cms/vocabularyValidation';

export interface AdminDeckInfo extends VocabularyDeck {
  total_words_count: number;
  published_words_count: number;
}

export interface CreateDeckInput {
  title: string;
  slug: string;
  description?: string;
  level: string;
  sort_order: number;
  is_published?: boolean;
}

export interface UpdateDeckInput {
  title?: string;
  slug?: string;
  description?: string;
  level?: string;
  sort_order?: number;
  is_published?: boolean;
}

export interface CreateVocabularyItemInput {
  deck_id: string;
  word: string;
  ipa?: string;
  part_of_speech?: string;
  meaning_vi: string;
  example_en?: string;
  example_vi?: string;
  topic?: string;
  toeic_parts?: string[];
  collocations?: string[];
  common_mistake?: string;
  audio_url?: string;
  sort_order?: number;
  is_published?: boolean;
}

export interface UpdateVocabularyItemInput {
  deck_id?: string;
  word?: string;
  ipa?: string;
  part_of_speech?: string;
  meaning_vi?: string;
  example_en?: string;
  example_vi?: string;
  topic?: string;
  toeic_parts?: string[];
  collocations?: string[];
  common_mistake?: string;
  audio_url?: string;
  sort_order?: number;
  is_published?: boolean;
}

/**
 * Fetch all Vocabulary Decks with word count summaries for Admin view
 */
export async function getAdminVocabularyDecks(): Promise<{ data: AdminDeckInfo[]; error: string | null }> {
  try {
    const [decksRes, wordsRes] = await Promise.all([
      supabase
        .from('vocabulary_decks')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true }),
      supabase
        .from('vocabulary_items')
        .select('deck_id, is_published'), // Only minimal 2 columns for efficiency
    ]);

    if (decksRes.error) {
      console.error('[ORI CMS] Error fetching decks:', decksRes.error.message);
      return { data: [], error: 'Không thể tải danh sách bộ từ vựng từ cơ sở dữ liệu.' };
    }

    // Explicit error check for words count query to prevent silent 0 counts
    if (wordsRes.error) {
      console.error('[ORI CMS] Error fetching vocabulary item counts:', wordsRes.error.message);
      return { data: [], error: 'Không thể tải đầy đủ thống kê bộ từ vựng.' };
    }

    const words = wordsRes.data || [];
    const countMap = new Map<string, { total: number; published: number }>();

    for (const w of words) {
      const existing = countMap.get(w.deck_id) || { total: 0, published: 0 };
      existing.total++;
      if (w.is_published) existing.published++;
      countMap.set(w.deck_id, existing);
    }

    const data: AdminDeckInfo[] = (decksRes.data as VocabularyDeck[]).map((deck) => {
      const counts = countMap.get(deck.id) || { total: 0, published: 0 };
      return {
        ...deck,
        total_words_count: counts.total,
        published_words_count: counts.published,
      };
    });

    return { data, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception fetching decks:', err);
    return { data: [], error: 'Đã xảy ra lỗi khi kết nối Supabase.' };
  }
}

/**
 * Fetch a single deck by ID
 */
export async function getAdminVocabularyDeck(
  deckId: string
): Promise<{ data: VocabularyDeck | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('vocabulary_decks')
      .select('*')
      .eq('id', deckId)
      .maybeSingle();

    if (error) {
      console.error('[ORI CMS] Error fetching deck:', error.message);
      return { data: null, error: 'Không thể tải thông tin bộ từ vựng.' };
    }

    return { data: (data as VocabularyDeck | null), error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception fetching deck:', err);
    return { data: null, error: 'Lỗi không xác định khi tải bộ từ vựng.' };
  }
}

/**
 * Create a new Vocabulary Deck (default draft: is_published = false)
 */
export async function createVocabularyDeck(
  input: CreateDeckInput
): Promise<{ data: VocabularyDeck | null; error: string | null }> {
  try {
    const payload = {
      title: input.title.trim(),
      slug: input.slug.trim(),
      description: input.description?.trim() || null,
      level: input.level.trim().toLowerCase(),
      sort_order: input.sort_order ?? 0,
      is_published: input.is_published ?? false,
    };

    const { data, error } = await supabase
      .from('vocabulary_decks')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[ORI CMS] Error creating deck:', error.message);
      if (error.message.includes('unique constraint') || error.message.includes('slug')) {
        return { data: null, error: 'Slug này đã tồn tại trên hệ thống. Vui lòng chọn slug khác.' };
      }
      return { data: null, error: 'Không thể tạo bộ từ vựng mới.' };
    }

    return { data: data as VocabularyDeck, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception creating deck:', err);
    return { data: null, error: 'Đã xảy ra lỗi khi tạo bộ từ vựng.' };
  }
}

/**
 * Update an existing Vocabulary Deck
 */
export async function updateVocabularyDeck(
  deckId: string,
  input: UpdateDeckInput
): Promise<{ data: VocabularyDeck | null; error: string | null }> {
  try {
    const payload: Record<string, any> = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.slug !== undefined) payload.slug = input.slug.trim();
    if (input.description !== undefined) payload.description = input.description.trim() || null;
    if (input.level !== undefined) payload.level = input.level.trim().toLowerCase();
    if (input.sort_order !== undefined) payload.sort_order = input.sort_order;
    if (input.is_published !== undefined) payload.is_published = input.is_published;

    const { data, error } = await supabase
      .from('vocabulary_decks')
      .update(payload)
      .eq('id', deckId)
      .select('*')
      .single();

    if (error) {
      console.error('[ORI CMS] Error updating deck:', error.message);
      if (error.message.includes('unique constraint') || error.message.includes('slug')) {
        return { data: null, error: 'Slug này đã tồn tại trên hệ thống. Vui lòng chọn slug khác.' };
      }
      return { data: null, error: 'Không thể cập nhật bộ từ vựng.' };
    }

    return { data: data as VocabularyDeck, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception updating deck:', err);
    return { data: null, error: 'Đã xảy ra lỗi khi cập nhật bộ từ vựng.' };
  }
}

/**
 * Toggle Deck published status (Blocks publishing empty decks!)
 */
export async function setVocabularyDeckPublished(
  deckId: string,
  is_published: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (is_published) {
      // Validate deck data & published words count before allowing publish
      const [deckRes, wordsRes] = await Promise.all([
        supabase.from('vocabulary_decks').select('*').eq('id', deckId).maybeSingle(),
        supabase.from('vocabulary_items').select('id').eq('deck_id', deckId).eq('is_published', true),
      ]);

      if (deckRes.error || !deckRes.data) {
        return { success: false, error: 'Không tìm thấy bộ từ vựng để xuất bản.' };
      }

      const publishedWordsCount = (wordsRes.data || []).length;
      const validation = canPublishDeck(deckRes.data, publishedWordsCount);

      if (!validation.canPublish) {
        return { success: false, error: validation.error };
      }
    }

    const { error } = await supabase
      .from('vocabulary_decks')
      .update({ is_published })
      .eq('id', deckId);

    if (error) {
      console.error('[ORI CMS] Error toggling deck published status:', error.message);
      return { success: false, error: 'Không thể thay đổi trạng thái xuất bản bộ từ vựng.' };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception in setVocabularyDeckPublished:', err);
    return { success: false, error: 'Lỗi không xác định khi thay đổi trạng thái bộ từ.' };
  }
}

export interface GetItemsOptions {
  searchQuery?: string;
  statusFilter?: 'all' | 'published' | 'draft';
  page?: number;
  pageSize?: number;
}

export interface PaginatedVocabularyItems {
  items: VocabularyItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Sanitize search input to prevent PostgREST expression breakage
 */
function sanitizeSearchQuery(query: string): string {
  return query.replace(/[,()%]/g, '').trim();
}

/**
 * Fetch paginated vocabulary items for a deck with search & status filters
 */
export async function getAdminVocabularyItems(
  deckId: string,
  options: GetItemsOptions = {}
): Promise<{ data: PaginatedVocabularyItems | null; error: string | null }> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabase
      .from('vocabulary_items')
      .select('*', { count: 'exact' })
      .eq('deck_id', deckId);

    if (options.statusFilter === 'published') {
      query = query.eq('is_published', true);
    } else if (options.statusFilter === 'draft') {
      query = query.eq('is_published', false);
    }

    const cleanSearch = options.searchQuery ? sanitizeSearchQuery(options.searchQuery) : '';
    if (cleanSearch) {
      const q = `%${cleanSearch.toLowerCase()}%`;
      query = query.or(`word.ilike.${q},meaning_vi.ilike.${q}`);
    }

    query = query
      .order('sort_order', { ascending: true })
      .order('word', { ascending: true })
      .range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('[ORI CMS] Error fetching vocabulary items:', error.message);
      return { data: null, error: 'Không thể tải danh sách từ vựng.' };
    }

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return {
      data: {
        items: (data as VocabularyItem[]) || [],
        totalCount,
        page,
        pageSize,
        totalPages,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[ORI CMS] Exception fetching vocabulary items:', err);
    return { data: null, error: 'Lỗi kết nối khi tải danh sách từ vựng.' };
  }
}

/**
 * Fetch a single Vocabulary Item by ID
 */
export async function getAdminVocabularyItem(
  wordId: string
): Promise<{ data: VocabularyItem | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('vocabulary_items')
      .select('*')
      .eq('id', wordId)
      .maybeSingle();

    if (error) {
      console.error('[ORI CMS] Error fetching word:', error.message);
      return { data: null, error: 'Không thể tải thông tin từ vựng.' };
    }

    return { data: data as VocabularyItem | null, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception fetching word:', err);
    return { data: null, error: 'Lỗi không xác định khi tải từ vựng.' };
  }
}

/**
 * Create a new Vocabulary Item (default draft: is_published = false)
 */
export async function createVocabularyItem(
  input: CreateVocabularyItemInput
): Promise<{ data: VocabularyItem | null; error: string | null }> {
  try {
    const payload = {
      deck_id: input.deck_id,
      word: input.word.trim(),
      ipa: input.ipa?.trim() || null,
      part_of_speech: input.part_of_speech?.trim() || null,
      meaning_vi: input.meaning_vi.trim(),
      example_en: input.example_en?.trim() || null,
      example_vi: input.example_vi?.trim() || null,
      topic: input.topic?.trim() || null,
      toeic_parts: input.toeic_parts || [],
      collocations: input.collocations || [],
      common_mistake: input.common_mistake?.trim() || null,
      audio_url: input.audio_url?.trim() || null,
      sort_order: input.sort_order ?? 0,
      is_published: input.is_published ?? false,
    };

    const { data, error } = await supabase
      .from('vocabulary_items')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[ORI CMS] Error creating word:', error.message);
      return { data: null, error: 'Không thể tạo từ vựng mới.' };
    }

    return { data: data as VocabularyItem, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception creating word:', err);
    return { data: null, error: 'Đã xảy ra lỗi khi lưu từ vựng.' };
  }
}

/**
 * Update an existing Vocabulary Item
 */
export async function updateVocabularyItem(
  wordId: string,
  input: UpdateVocabularyItemInput
): Promise<{ data: VocabularyItem | null; error: string | null }> {
  try {
    const payload: Record<string, any> = {};
    if (input.deck_id !== undefined) payload.deck_id = input.deck_id;
    if (input.word !== undefined) payload.word = input.word.trim();
    if (input.ipa !== undefined) payload.ipa = input.ipa.trim() || null;
    if (input.part_of_speech !== undefined) payload.part_of_speech = input.part_of_speech.trim() || null;
    if (input.meaning_vi !== undefined) payload.meaning_vi = input.meaning_vi.trim();
    if (input.example_en !== undefined) payload.example_en = input.example_en.trim() || null;
    if (input.example_vi !== undefined) payload.example_vi = input.example_vi.trim() || null;
    if (input.topic !== undefined) payload.topic = input.topic.trim() || null;
    if (input.toeic_parts !== undefined) payload.toeic_parts = input.toeic_parts;
    if (input.collocations !== undefined) payload.collocations = input.collocations;
    if (input.common_mistake !== undefined) payload.common_mistake = input.common_mistake.trim() || null;
    if (input.audio_url !== undefined) payload.audio_url = input.audio_url.trim() || null;
    if (input.sort_order !== undefined) payload.sort_order = input.sort_order;
    if (input.is_published !== undefined) payload.is_published = input.is_published;

    const { data, error } = await supabase
      .from('vocabulary_items')
      .update(payload)
      .eq('id', wordId)
      .select('*')
      .single();

    if (error) {
      console.error('[ORI CMS] Error updating word:', error.message);
      return { data: null, error: 'Không thể cập nhật từ vựng.' };
    }

    return { data: data as VocabularyItem, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception updating word:', err);
    return { data: null, error: 'Đã xảy ra lỗi khi cập nhật từ vựng.' };
  }
}

/**
 * Toggle Vocabulary Item published status (Validates before publishing!)
 */
export async function setVocabularyItemPublished(
  wordId: string,
  is_published: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (is_published) {
      const { data: word, error: fetchErr } = await supabase
        .from('vocabulary_items')
        .select('*')
        .eq('id', wordId)
        .maybeSingle();

      if (fetchErr || !word) {
        return { success: false, error: 'Không tìm thấy từ vựng để xuất bản.' };
      }

      const validation = canPublishVocabularyItem(word);
      if (!validation.canPublish) {
        return { success: false, error: validation.error };
      }
    }

    const { error } = await supabase
      .from('vocabulary_items')
      .update({ is_published })
      .eq('id', wordId);

    if (error) {
      console.error('[ORI CMS] Error toggling word published status:', error.message);
      return { success: false, error: 'Không thể thay đổi trạng thái xuất bản của từ vựng.' };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception in setVocabularyItemPublished:', err);
    return { success: false, error: 'Lỗi không xác định khi xuất bản từ vựng.' };
  }
}
