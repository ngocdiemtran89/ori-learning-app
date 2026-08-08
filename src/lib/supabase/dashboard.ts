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
import { analyzeLearningPerformance } from '../learning/weaknessAnalysis';
import { buildLearningRecommendations, LearningRecommendations } from '../learning/recommendationEngine';

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
  recommendations: LearningRecommendations;
  fetchError?: string | null;
  recommendedAction: {
    title: string;
    subtitle: string;
    path: string;
    badge: string;
  };
}

/**
 * Fetch real student progress, metrics & Daily Study Plan safely from Supabase
 */
export async function getStudentDashboardMetrics(
  userId: string,
  studentLevel: string = 'foundation'
): Promise<DashboardMetrics> {
  const todayStartISO = getVietnamTodayStartISO();
  let fetchErrorMsg: string | null = null;

  const [
    dueItems,
    vocabReviewedToday,
    completedRes,
    completedTodayRes,
    inProgressRes,
    attemptRes,
    questionAttemptsRes,
    grammarMetaRes,
    learningMetaRes,
  ] = await Promise.all([
    getDueVocabularyItems(userId),
    getVocabularyReviewedTodayCount(userId),
    supabase.from('user_progress').select('content_id').eq('user_id', userId).eq('status', 'completed'),
    supabase
      .from('user_progress')
      .select('content_id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', todayStartISO),
    supabase
      .from('user_progress')
      .select('content_type, content_id, status, last_seen_at')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('last_seen_at', { ascending: false })
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
      .select('question_key, content_type, is_correct, skill_tag, toeic_part, topic, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('grammar_lessons')
      .select('id, title, slug, level, sort_order')
      .eq('is_published', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('learning_lessons')
      .select('id, kind, title, slug, level, sort_order, toeic_part')
      .eq('is_published', true)
      .order('sort_order', { ascending: true }),
  ]);

  if (completedRes.error) console.error('[ORI Dashboard] Error fetching completed user_progress:', completedRes.error.message);
  if (completedTodayRes.error) console.error('[ORI Dashboard] Error fetching completedToday user_progress:', completedTodayRes.error.message);
  if (inProgressRes.error) console.error('[ORI Dashboard] Error fetching inProgress user_progress:', inProgressRes.error.message);
  if (attemptRes.error) console.error('[ORI Dashboard] Error fetching latest quiz_attempt:', attemptRes.error.message);
  if (questionAttemptsRes.error) console.error('[ORI Dashboard] Error fetching question_attempts:', questionAttemptsRes.error.message);
  if (grammarMetaRes.error) console.error('[ORI Dashboard] Error fetching grammar_lessons metadata:', grammarMetaRes.error.message);
  if (learningMetaRes.error) console.error('[ORI Dashboard] Error fetching learning_lessons metadata:', learningMetaRes.error.message);

  if (completedRes.error || grammarMetaRes.error || learningMetaRes.error) {
    fetchErrorMsg = 'Không thể kết nối đến dữ liệu học tập. Vui lòng tải lại trang.';
  }

  const dueWordsCount = dueItems.length;
  const completedLessonsCount = completedRes.data?.length || 0;
  const latestQuizAttempt = (attemptRes.data as LatestQuizAttempt | null) || null;

  const rawQuestionAttempts = (questionAttemptsRes.data as Array<{ question_key: string; content_type: string; is_correct: boolean; skill_tag?: string; toeic_part?: string; topic?: string; created_at: string }>) || [];

  // Process Unresolved Mistakes
  const unresolvedMistakeSummary = calculateUnresolvedMistakes(rawQuestionAttempts);

  // Process Published Lessons Metadata
  const availableLessons: PublishedLessonInfo[] = [];
  const publishedGrammarLessons: PublishedLessonInfo[] = [];
  const publishedLearningLessons: PublishedLessonInfo[] = [];

  if (grammarMetaRes.data) {
    grammarMetaRes.data.forEach((g) => {
      const item: PublishedLessonInfo = {
        id: g.id,
        kind: 'grammar',
        title: g.title,
        slug: g.slug,
        level: g.level || 'foundation',
        sort_order: g.sort_order,
      };
      availableLessons.push(item);
      publishedGrammarLessons.push(item);
    });
  }

  if (learningMetaRes.data) {
    learningMetaRes.data.forEach((l) => {
      const item: PublishedLessonInfo = {
        id: l.id,
        kind: l.kind as 'listening' | 'reading',
        title: l.title,
        slug: l.slug,
        level: l.level || 'foundation',
        sort_order: l.sort_order,
        toeic_part: l.toeic_part,
      };
      availableLessons.push(item);
      publishedLearningLessons.push(item);
    });
  }

  // Resolve In-Progress Lesson details
  let inProgressLesson: UserProgressLesson | null = null;
  if (inProgressRes.data) {
    const matched = availableLessons.find((l) => l.id === inProgressRes.data!.content_id);
    if (matched) {
      inProgressLesson = {
        content_type: inProgressRes.data.content_type as 'grammar' | 'listening' | 'reading',
        content_id: inProgressRes.data.content_id,
        title: matched.title,
        slug: matched.slug,
        status: 'in_progress',
        last_seen_at: inProgressRes.data.last_seen_at,
      };
    }
  }

  const completedLessonIds = new Set<string>(
    (completedRes.data || []).map((r) => r.content_id)
  );

  const completedLessonIdsToday = new Set<string>(
    (completedTodayRes.data || []).map((r) => r.content_id)
  );

  // Process Weakness Analysis & Recommendations
  const analysis = analyzeLearningPerformance(rawQuestionAttempts);
  const recommendations = buildLearningRecommendations({
    analysis,
    studentLevel,
    publishedGrammarLessons,
    publishedLearningLessons,
    inProgressLessonId: inProgressLesson?.content_id,
    recentlyCompletedLessonIds: completedLessonIds,
  });

  // Build Pure Daily Study Plan with primary recommendation slot
  const dailyPlan = buildDailyStudyPlan({
    vocabularyDueCount: dueWordsCount,
    vocabularyReviewedTodayCount: vocabReviewedToday,
    unresolvedMistakeSummary,
    inProgressLesson,
    recentActivityTypes: latestQuizAttempt ? [latestQuizAttempt.content_type] : [],
    availableLessons,
    completedLessonIdsToday,
    studentLevel,
    primaryRecommendation: recommendations.primaryRecommendation,
  });

  // Streak calculation
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

  // Recommended Action
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
    recommendations,
    fetchError: fetchErrorMsg,
    recommendedAction,
  };
}
