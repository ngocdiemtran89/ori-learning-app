/**
 * Pure Student Progress Summary Engine for ORI Learning (Phase 2.6)
 * Deterministic summary of student activity, mastery, weaknesses, and recommendations for Admin view.
 */

import { PerformanceStat, LearningAnalysis } from './weaknessAnalysis';
import { LearningRecommendations, LearningRecommendation } from './recommendationEngine';
import { Profile } from '../supabase/types';
import { calculateUnresolvedMistakes } from './dailyPlan';

export interface RawStudentProgressData {
  studentProfile: Profile | null;
  vocabularyReviews: Array<{ last_reviewed_at: string | null }>;
  quizAttempts: Array<{
    content_type: string;
    score: number | null;
    correct_count: number | null;
    total_count: number | null;
    created_at: string;
  }>;
  questionAttempts: Array<{
    question_key: string;
    content_type: string;
    is_correct: boolean;
    skill_tag?: string;
    toeic_part?: string;
    topic?: string;
    created_at: string;
  }>;
  userProgress: Array<{
    content_type: string;
    content_id: string;
    status: string;
    completed_at?: string | null;
    last_seen_at?: string | null;
  }>;
  analysis: LearningAnalysis;
  recommendations: LearningRecommendations;
}

export interface AdminStudentProgressSummary {
  studentProfile: Profile | null;

  // 7-day metrics (Vietnam calendar days: Asia/Ho_Chi_Minh)
  studyDaysLast7: number;
  questionAttemptsLast7: number;
  quizAttemptsLast7: number;
  vocabularyItemsReviewedLast7: number;

  // Mastery & Analysis
  currentMasteryPercent: number | null;
  uniqueQuestionsAnalyzed: number;
  unresolvedMistakes: number;
  unresolvedByCategory: Record<string, number>;

  // Progress Counts
  completedLessonsTotal: number;
  inProgressLessonsTotal: number;

  // Timestamps & Signals
  lastActivityAt: string | null;
  activitySignal: 'recent' | 'idle_few_days' | 'idle_week' | 'no_data';
  activitySignalText: string;

  // Focus & Recommendations
  focusAreas: PerformanceStat[];
  recommendations: LearningRecommendation[];

  // Recent timeline (max 10)
  recentQuizTimeline: Array<{
    content_type: string;
    score: number | null;
    correct_count: number | null;
    total_count: number | null;
    created_at: string;
  }>;
}

/**
 * Convert ISO string or Date object into YYYY-MM-DD string in Asia/Ho_Chi_Minh timezone
 */
export function getVietnamDateKey(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Get array of YYYY-MM-DD keys for the 7-day Vietnam window (today + 6 previous days)
 */
export function getVietnam7DayWindowKeys(referenceDate: Date = new Date()): string[] {
  const keys: string[] = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  for (let i = 0; i < 7; i++) {
    const d = new Date(referenceDate.getTime() - i * msPerDay);
    keys.push(getVietnamDateKey(d));
  }
  return keys;
}

/**
 * Pure function to summarize student progress metrics for Admin view
 */
export function summarizeStudentProgress(
  data: RawStudentProgressData,
  now: Date = new Date()
): AdminStudentProgressSummary {
  const windowKeys = new Set(getVietnam7DayWindowKeys(now));

  // 1. Study Days Last 7 (deduplicated Vietnam dates from vocabulary reviews & quiz attempts)
  const studyDates = new Set<string>();

  data.vocabularyReviews.forEach((r) => {
    const dateKey = getVietnamDateKey(r.last_reviewed_at);
    if (dateKey && windowKeys.has(dateKey)) {
      studyDates.add(dateKey);
    }
  });

  data.quizAttempts.forEach((q) => {
    const dateKey = getVietnamDateKey(q.created_at);
    if (dateKey && windowKeys.has(dateKey)) {
      studyDates.add(dateKey);
    }
  });

  const studyDaysLast7 = studyDates.size;

  // 2. Question Attempts Last 7
  let questionAttemptsLast7 = 0;
  data.questionAttempts.forEach((q) => {
    const dateKey = getVietnamDateKey(q.created_at);
    if (dateKey && windowKeys.has(dateKey)) {
      questionAttemptsLast7++;
    }
  });

  // 3. Quiz Attempts Last 7
  let quizAttemptsLast7 = 0;
  data.quizAttempts.forEach((q) => {
    const dateKey = getVietnamDateKey(q.created_at);
    if (dateKey && windowKeys.has(dateKey)) {
      quizAttemptsLast7++;
    }
  });

  // 4. Vocabulary Items Reviewed Last 7
  let vocabularyItemsReviewedLast7 = 0;
  data.vocabularyReviews.forEach((r) => {
    const dateKey = getVietnamDateKey(r.last_reviewed_at);
    if (dateKey && windowKeys.has(dateKey)) {
      vocabularyItemsReviewedLast7++;
    }
  });

  // 5. Last Activity Timestamp & Activity Signal
  let latestMs = 0;
  let lastActivityAt: string | null = null;

  const checkTimestamp = (ts: string | null | undefined) => {
    if (!ts) return;
    const ms = new Date(ts).getTime();
    if (!isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      lastActivityAt = ts;
    }
  };

  data.vocabularyReviews.forEach((r) => checkTimestamp(r.last_reviewed_at));
  data.quizAttempts.forEach((q) => checkTimestamp(q.created_at));
  data.questionAttempts.forEach((q) => checkTimestamp(q.created_at));
  data.userProgress.forEach((p) => {
    checkTimestamp(p.last_seen_at);
    checkTimestamp(p.completed_at);
  });

  let activitySignal: 'recent' | 'idle_few_days' | 'idle_week' | 'no_data' = 'no_data';
  let activitySignalText = 'Chưa có dữ liệu học tập';

  if (lastActivityAt && latestMs > 0) {
    const diffDays = (now.getTime() - latestMs) / (1000 * 60 * 60 * 24);
    if (diffDays <= 2.5) {
      activitySignal = 'recent';
      activitySignalText = 'Hoạt động gần đây';
    } else if (diffDays <= 6.5) {
      activitySignal = 'idle_few_days';
      activitySignalText = 'Chưa học vài ngày';
    } else {
      activitySignal = 'idle_week';
      activitySignalText = 'Chưa có hoạt động trong 7 ngày';
    }
  }

  // 6. Unresolved Mistakes
  const mistakeSummary = calculateUnresolvedMistakes(data.questionAttempts);

  // 7. Progress Totals
  const completedLessonsTotal = data.userProgress.filter((p) => p.status === 'completed').length;
  const inProgressLessonsTotal = data.userProgress.filter((p) => p.status === 'in_progress').length;

  // 8. Recent Quiz Timeline (max 10)
  const sortedQuizzes = [...data.quizAttempts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const recentQuizTimeline = sortedQuizzes.slice(0, 10);

  return {
    studentProfile: data.studentProfile,
    studyDaysLast7,
    questionAttemptsLast7,
    quizAttemptsLast7,
    vocabularyItemsReviewedLast7,

    currentMasteryPercent: data.analysis.overallMasteryPercent,
    uniqueQuestionsAnalyzed: data.analysis.uniqueQuestions,
    unresolvedMistakes: mistakeSummary.totalUnresolved,
    unresolvedByCategory: mistakeSummary.byCategory,

    completedLessonsTotal,
    inProgressLessonsTotal,

    lastActivityAt,
    activitySignal,
    activitySignalText,

    focusAreas: data.analysis.focusAreas || [],
    recommendations: data.recommendations.recommendations || [],

    recentQuizTimeline,
  };
}
