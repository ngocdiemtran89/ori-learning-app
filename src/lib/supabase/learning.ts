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

export interface MistakeQuestionAttempt {
  id: string;
  attempt_id: string;
  user_id: string;
  content_type: 'grammar' | 'listening' | 'reading' | 'vocabulary';
  content_id: string;
  question_key: string;
  question_id: string | null;
  question_index: number | null;
  question_text: string;
  selected_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation: string | null;
  skill_tag: string | null;
  toeic_part: string | null;
  topic: string | null;
  created_at: string;
}

export interface MistakeNotebookItem {
  question_key: string;
  content_type: 'grammar' | 'listening' | 'reading' | 'vocabulary';
  content_id: string;
  wrong_count: number;
  latest_attempt: MistakeQuestionAttempt;
  latest_wrong_at: string;
  is_resolved: boolean;
}

/**
 * Fetch and process student's wrong answer notebook items from question_attempts
 */
export async function getMistakeNotebookItems(userId: string): Promise<MistakeNotebookItem[]> {
  const { data, error } = await supabase
    .from('question_attempts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    console.error('[ORI Notebook] Error fetching question attempts:', error?.message);
    return [];
  }

  const map = new Map<string, {
    wrong_count: number;
    latest_attempt: MistakeQuestionAttempt;
    latest_wrong_at: string;
  }>();

  for (const row of data as MistakeQuestionAttempt[]) {
    const key = row.question_key;
    const existing = map.get(key);

    let wrongCount = existing ? existing.wrong_count : 0;
    let latestWrongAt = existing ? existing.latest_wrong_at : row.created_at;

    if (!row.is_correct) {
      wrongCount++;
      latestWrongAt = row.created_at;
    }

    map.set(key, {
      wrong_count: wrongCount,
      latest_attempt: row,
      latest_wrong_at: latestWrongAt,
    });
  }

  const results: MistakeNotebookItem[] = [];

  for (const [key, entry] of map.entries()) {
    // Only include questions that have been answered wrong at least once
    if (entry.wrong_count > 0) {
      const isResolved = entry.latest_attempt.is_correct === true;
      results.push({
        question_key: key,
        content_type: entry.latest_attempt.content_type,
        content_id: entry.latest_attempt.content_id,
        wrong_count: entry.wrong_count,
        latest_attempt: entry.latest_attempt,
        latest_wrong_at: entry.latest_wrong_at,
        is_resolved: isResolved,
      });
    }
  }

  // Sort by latest_wrong_at descending
  return results.sort((a, b) => new Date(b.latest_wrong_at).getTime() - new Date(a.latest_wrong_at).getTime());
}
