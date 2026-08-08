import { supabase } from './client';
import { getDueVocabularyItems } from './vocabulary';
import { calculateStudyStreak } from '../srs/streak';

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
  recommendedAction: {
    title: string;
    subtitle: string;
    path: string;
    badge: string;
  };
}

/**
 * Fetch real student progress & metrics from Supabase
 */
export async function getStudentDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  // 1. Fetch due vocabulary count
  const dueItems = await getDueVocabularyItems(userId);
  const dueWordsCount = dueItems.length;

  // 2. Fetch completed lessons count
  const { data: completedData } = await supabase
    .from('user_progress')
    .select('content_id')
    .eq('user_id', userId)
    .eq('status', 'completed');

  const completedLessonsCount = completedData?.length || 0;

  // 3. Fetch latest quiz attempt
  const { data: attemptData } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestQuizAttempt = attemptData as LatestQuizAttempt | null;

  // 4. Combine activity timestamps from BOTH vocabulary_reviews AND quiz_attempts (180-day cutoff window)
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

  // Calculate pure streak in Asia/Ho_Chi_Minh timezone
  const streakDays = calculateStudyStreak(activityTimestamps, new Date());

  // 5. Deterministic Phase 1 Recommendation (No AI API)
  let recommendedAction = {
    title: 'Luyện Từ Vựng Flashcards',
    subtitle: 'Bắt đầu học các bộ từ vựng cốt lõi chuẩn đề thi TOEIC.',
    path: '/vocabulary',
    badge: 'Khuyên dùng',
  };

  if (dueWordsCount > 0) {
    recommendedAction = {
      title: `Ôn Tập ${dueWordsCount} Từ Vựng Đến Hạn`,
      subtitle: 'Bạn có các từ vựng đến hạn SRS cần ôn lại hôm nay.',
      path: '/vocabulary/review-today',
      badge: 'SRS Due Today',
    };
  } else if (latestQuizAttempt) {
    if (latestQuizAttempt.content_type === 'grammar') {
      recommendedAction = {
        title: 'Chuyên Đề Ngữ Pháp Tiếp Theo',
        subtitle: `Lần làm bài gần nhất: ${latestQuizAttempt.score}đ. Tiếp tục chuyên đề mới.`,
        path: '/grammar',
        badge: 'Học tiếp',
      };
    } else if (latestQuizAttempt.content_type === 'listening') {
      recommendedAction = {
        title: 'Luyện Bài Đọc Reading Part 7',
        subtitle: 'Cân bằng kỹ năng Đọc hiểu sau bài luyện Nghe.',
        path: '/reading',
        badge: 'Cân bằng kỹ năng',
      };
    }
  }

  return {
    dueWordsCount,
    completedLessonsCount,
    streakDays,
    latestQuizAttempt,
    recommendedAction,
  };
}
