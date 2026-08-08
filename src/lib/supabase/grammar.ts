import { supabase } from './client';
import { GrammarLesson } from './types';

export interface QuizQuestionItem {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface LessonSectionItem {
  heading: string;
  body: string;
  examples?: string[];
}

export interface GrammarLessonContent {
  sections?: LessonSectionItem[];
  quiz?: QuizQuestionItem[];
}

/**
 * Fetch all published grammar lessons sorted by level and sort_order
 */
export async function getGrammarLessons(): Promise<GrammarLesson[]> {
  const { data, error } = await supabase
    .from('grammar_lessons')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[ORI Grammar] Error fetching lessons:', error.message);
    return [];
  }
  return data as GrammarLesson[];
}

/**
 * Fetch a single grammar lesson by slug or ID
 */
export async function getGrammarLessonBySlug(slug: string): Promise<GrammarLesson | null> {
  const { data, error } = await supabase
    .from('grammar_lessons')
    .select('*')
    .or(`slug.eq.${slug},id.eq.${slug}`)
    .maybeSingle();

  if (error) {
    console.error('[ORI Grammar] Error fetching lesson by slug:', error.message);
    return null;
  }
  return data as GrammarLesson | null;
}

/**
 * Fetch user progress for content_type (e.g. 'grammar')
 */
export async function getUserProgressMap(
  userId: string,
  contentType: 'grammar' | 'vocabulary_deck' | 'listening' | 'reading'
): Promise<Record<string, { status: string; score: number | null }>> {
  const { data, error } = await supabase
    .from('user_progress')
    .select('content_id, status, score')
    .eq('user_id', userId)
    .eq('content_type', contentType);

  if (error) {
    console.error('[ORI Progress] Error fetching user progress:', error.message);
    return {};
  }

  const map: Record<string, { status: string; score: number | null }> = {};
  (data || []).forEach((row) => {
    map[row.content_id] = { status: row.status, score: row.score };
  });

  return map;
}

/**
 * Save a quiz attempt to quiz_attempts table
 */
export async function recordQuizAttempt(
  userId: string,
  contentType: 'grammar' | 'listening' | 'reading' | 'vocabulary',
  contentId: string,
  score: number,
  correctCount: number,
  totalCount: number,
  answers: Record<number, string>
) {
  const { error } = await supabase.from('quiz_attempts').insert({
    user_id: userId,
    content_type: contentType,
    content_id: contentId,
    score,
    correct_count: correctCount,
    total_count: totalCount,
    answers,
  });

  if (error) {
    console.error('[ORI Quiz] Error recording quiz attempt:', error.message);
  }
}

/**
 * Upsert completion status & score to user_progress
 */
export async function updateUserProgress(
  userId: string,
  contentType: 'grammar' | 'listening' | 'reading' | 'vocabulary_deck',
  contentId: string,
  status: 'not_started' | 'in_progress' | 'completed',
  score?: number
) {
  const { error } = await supabase.from('user_progress').upsert({
    user_id: userId,
    content_type: contentType,
    content_id: contentId,
    status,
    score: score ?? null,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
    last_seen_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[ORI Progress] Error updating user progress:', error.message);
  }
}
