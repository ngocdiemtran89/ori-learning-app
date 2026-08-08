import { supabase } from './client';
import { getDueVocabularyItems, getVocabularyReviewedTodayCount, getVietnamTodayStartISO } from './vocabulary';
import { calculateStudyStreak } from '../srs/streak';
import {
  buildDailyStudyPlan,
  calculateUnresolvedMistakes,
  DailyStudyPlan,
  PublishedLessonInfo,
  UserProgressLesson,
} from '../learning/dailyPlan';

export interface LatestQuizAttempt {
  content_type: string;
  content_id: string;
  score: number;
  correct_count: number;
  total_count: number;
  created_at: string;
}

export interface DashboardMetrics {
  dueWordsCount: number;
  completedLessonsCount: number;
  streakDays: number;
  latestQuizAttempt: LatestQuizAttempt | null;
  dailyPlan: DailyStudyPlan;
  recommendedAction: {
    title: string;
    subtitle: string;
    path: string;
    badge: string;
  };
}

/**
 * Fetch real student progress, metrics & Daily Study Plan from Supabase
 */
export async function getStudentDashboardMetrics(
  userId: string,
  studentLevel: string = 'foundation'
): Promise<DashboardMetrics> {
  const todayStartISO = getVietnamTodayStartISO();

  // 1. Concurrent fetching of lightweight metadata required for Dashboard & Daily Plan
  const [
    dueItems,
    vocabReviewedToday,
    { data: completedData },
    { data: completedTodayData },
    { data: inProgressData },
    { data: attemptData },
    { data: questionAttemptsData },
    { data: grammarMeta },
    { data: learningMeta },
  ] = await Promise.all([
    getDueVocabularyItems(userId),
    getVocabularyReviewedTodayCount(userId),
    supabase.from('user_progress').select('content_id').eq('user_id', userId).eq('status', 'completed'),
    supabase
      .from('user_progress')
      .select('content_id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('updated_at', todayStartISO),
    supabase
      .from('user_progress')
      .select('content_type, content_id, status, updated_at')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('question_attempts')
      .select('question_key, content_type, is_correct, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('grammar_lessons')
      .select('id, title, slug, level, sort_order')
      .eq('is_published', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('learning_lessons')
      .select('id, kind, title, slug, level, sort_order')
      .eq('is_published', true)
      .order('sort_order', { ascending: true }),
  ]);

  const dueWordsCount = dueItems.length;
  const completedLessonsCount = completedData?.length || 0;
  const latestQuizAttempt = attemptData as LatestQuizAttempt | null;

  // 2. Process Unresolved Mistakes
  const unresolvedMistakeSummary = calculateUnresolvedMistakes(
    (questionAttemptsData as Array<{ question_key: string; content_type: string; is_correct: boolean; created_at: string }>) || []
  );

  // 3. Process Available Lessons Metadata
  const availableLessons: PublishedLessonInfo[] = [];

  if (grammarMeta) {
    grammarMeta.forEach((g) => {
      availableLessons.push({
        id: g.id,
        kind: 'grammar',
        title: g.title,
        slug: g.slug,
        level: g.level || 'foundation',
        sort_order: g.sort_order,
      });
    });
  }

  if (learningMeta) {
    learningMeta.forEach((l) => {
      availableLessons.push({
        id: l.id,
        kind: l.kind as 'listening' | 'reading',
        title: l.title,
        slug: l.slug,
        level: l.level || 'foundation',
        sort_order: l.sort_order,
      });
    });
  }

  // 4. Resolve In-Progress Lesson details if available
  let inProgressLesson: UserProgressLesson | null = null;
  if (inProgressData) {
    const matched = availableLessons.find((l) => l.id === inProgressData.content_id);
    if (matched) {
      inProgressLesson = {
        content_type: inProgressData.content_type as 'grammar' | 'listening' | 'reading',
        content_id: inProgressData.content_id,
        title: matched.title,
        slug: matched.slug,
        status: 'in_progress',
        last_seen_at: inProgressData.updated_at,
      };
    }
  }

  const completedLessonIdsToday = new Set<string>(
    (completedTodayData || []).map((r) => r.content_id)
  );

  // 5. Build Pure Daily Study Plan
  const dailyPlan = buildDailyStudyPlan({
    vocabularyDueCount: dueWordsCount,
    vocabularyReviewedTodayCount: vocabReviewedToday,
    unresolvedMistakeSummary,
    inProgressLesson,
    recentActivityTypes: latestQuizAttempt ? [latestQuizAttempt.content_type] : [],
    availableLessons,
    completedLessonIdsToday,
    studentLevel,
  });

  // 6. Streak calculation
  const cutoffDateISO = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: reviews }, { data: attempts }] = await Promise.all([
    supabase
      .from('vocabulary_reviews')
      .select('last_reviewed_at')
      .eq('user_id', userId)
      .not('last_reviewed_at', 'is', null)
      .gte('last_reviewed_at', cutoffDateISO)
      .order('last_reviewed_at', { ascending: false }),
    supabase
      .from('quiz_attempts')
      .select('created_at')
      .eq('user_id', userId)
      .not('created_at', 'is', null)
      .gte('created_at', cutoffDateISO)
      .order('created_at', { ascending: false }),
  ]);

  const activityTimestamps: string[] = [];
  if (reviews) {
    for (const r of reviews) {
      if (r.last_reviewed_at) activityTimestamps.push(r.last_reviewed_at);
    }
  }
  if (attempts) {
    for (const a of attempts) {
      if (a.created_at) activityTimestamps.push(a.created_at);
    }
  }

  const streakDays = calculateStudyStreak(activityTimestamps, new Date());

  // 7. Recommendation Action
  let recommendedAction = {
    title: 'Luyện Từ Vựng Flashcards',
    subtitle: 'Bắt đầu học các bộ từ vựng cốt lõi chuẩn đề thi TOEIC.',
    path: '/vocabulary',
    badge: 'Khuyên dùng',
  };

  if (dailyPlan.items.length > 0) {
    const firstIncomplete = dailyPlan.items.find((i) => !i.completed) || dailyPlan.items[0];
    recommendedAction = {
      title: firstIncomplete.title,
      subtitle: firstIncomplete.description || 'Tiếp tục lộ trình học tập hàng ngày.',
      path: firstIncomplete.route,
      badge: firstIncomplete.completed ? 'Hoàn thành' : 'Nhiệm vụ hôm nay',
    };
  }

  return {
    dueWordsCount,
    completedLessonsCount,
    streakDays,
    latestQuizAttempt,
    dailyPlan,
    recommendedAction,
  };
}
