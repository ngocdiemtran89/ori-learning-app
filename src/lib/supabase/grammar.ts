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

export interface QuestionAttemptInput {
  attempt_id: string;
  user_id: string;
  content_type: 'grammar' | 'listening' | 'reading' | 'vocabulary';
  content_id: string;
  question_key: string;
  question_id?: string | null;
  question_index?: number | null;
  question_text: string;
  selected_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation?: string | null;
  skill_tag?: string | null;
  toeic_part?: string | null;
  topic?: string | null;
}

/**
 * Save a quiz attempt to quiz_attempts table and return created attempt_id
 */
export async function recordQuizAttempt(
  userId: string,
  contentType: 'grammar' | 'listening' | 'reading' | 'vocabulary',
  contentId: string,
  score: number,
  correctCount: number,
  totalCount: number,
  answers: Record<number | string, string>
): Promise<{ attemptId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert({
      user_id: userId,
      content_type: contentType,
      content_id: contentId,
      score,
      correct_count: correctCount,
      total_count: totalCount,
      answers,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ORI Quiz] Error recording quiz attempt:', error.message);
    return { attemptId: null, error: error.message };
  }

  return { attemptId: data?.id || null, error: null };
}

/**
 * Record detailed question attempts for a quiz submission
 */
export async function recordQuestionAttempts(
  questionAttempts: QuestionAttemptInput[]
): Promise<{ success: boolean; error: string | null }> {
  if (!questionAttempts || questionAttempts.length === 0) {
    return { success: true, error: null };
  }

  const { error } = await supabase.from('question_attempts').insert(questionAttempts);

  if (error) {
    console.error('[ORI Quiz] Error recording question attempts:', error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
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
