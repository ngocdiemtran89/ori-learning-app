import { supabase } from './client';
import { LearningLesson, ContentKind } from './types';

export interface LessonQuestion {
  id: string;
  lesson_id: string;
  question_text: string;
  options: string[] | Record<string, string>;
  correct_answer: string;
  explanation: string | null;
  sort_order: number;
}

/**
 * Fetch all published learning lessons by kind ('listening' | 'reading')
 */
export async function getLearningLessons(kind: ContentKind): Promise<LearningLesson[]> {
  const { data, error } = await supabase
    .from('learning_lessons')
    .select('*')
    .eq('kind', kind)
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error(`[ORI Learning] Error fetching ${kind} lessons:`, error.message);
    return [];
  }
  return data as LearningLesson[];
}

/**
 * Fetch a single learning lesson by slug or ID
 */
export async function getLearningLessonBySlug(slug: string): Promise<LearningLesson | null> {
  const { data, error } = await supabase
    .from('learning_lessons')
    .select('*')
    .or(`slug.eq.${slug},id.eq.${slug}`)
    .maybeSingle();

  if (error) {
    console.error('[ORI Learning] Error fetching lesson by slug:', error.message);
    return null;
  }
  return data as LearningLesson | null;
}

/**
 * Fetch all questions for a given lesson ID
 */
export async function getLessonQuestions(lessonId: string): Promise<LessonQuestion[]> {
  const { data, error } = await supabase
    .from('lesson_questions')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[ORI Questions] Error fetching questions:', error.message);
    return [];
  }

  // Normalize options array / object
  const normalized = (data || []).map((row) => {
    let opts: string[] = [];
    if (Array.isArray(row.options)) {
      opts = row.options as string[];
    } else if (typeof row.options === 'object' && row.options !== null) {
      opts = Object.values(row.options as Record<string, string>);
    }
    return {
      ...row,
      options: opts,
    };
  });

  return normalized as LessonQuestion[];
}
