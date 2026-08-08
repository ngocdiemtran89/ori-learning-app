/**
 * Admin Student Progress Data Access Layer (Phase 2.6)
 * Safely fetches target student learning activity from Supabase for Admin view.
 */

import { supabase } from './client';
import { Profile } from './types';
import { PublishedLessonInfo } from '../learning/dailyPlan';
import { analyzeLearningPerformance } from '../learning/weaknessAnalysis';
import { buildLearningRecommendations } from '../learning/recommendationEngine';
import {
  summarizeStudentProgress,
  AdminStudentProgressSummary,
} from '../learning/studentProgressSummary';

export async function getAdminStudentProgress(
  studentId: string
): Promise<{ data: AdminStudentProgressSummary | null; error: string | null }> {
  if (!studentId) {
    return { data: null, error: 'Mã học viên không hợp lệ.' };
  }

  const ninetyDaysAgoISO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      profileRes,
      vocabRes,
      quizRes,
      questionRes,
      progressRes,
      grammarMetaRes,
      learningMetaRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', studentId).maybeSingle(),
      supabase
        .from('vocabulary_reviews')
        .select('last_reviewed_at')
        .eq('user_id', studentId)
        .not('last_reviewed_at', 'is', null),
      supabase
        .from('quiz_attempts')
        .select('content_type, score, correct_count, total_count, created_at')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('question_attempts')
        .select('question_key, content_type, is_correct, skill_tag, toeic_part, topic, created_at')
        .eq('user_id', studentId)
        .gte('created_at', ninetyDaysAgoISO)
        .order('created_at', { ascending: true })
        .limit(2000),
      supabase
        .from('user_progress')
        .select('content_type, content_id, status, completed_at, last_seen_at')
        .eq('user_id', studentId),
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

    if (profileRes.error) {
      console.error('[ORI Admin] Error fetching student profile:', profileRes.error.message);
      return { data: null, error: 'Không thể truy cập dữ liệu học viên lúc này.' };
    }

    if (!profileRes.data) {
      return { data: null, error: 'Không tìm thấy thông tin học viên trong hệ thống.' };
    }

    const studentProfile = profileRes.data as Profile;
    const vocabularyReviews = vocabRes.data || [];
    const quizAttempts = quizRes.data || [];
    const questionAttempts = questionRes.data || [];
    const userProgress = progressRes.data || [];

    // Process published lessons metadata
    const publishedGrammarLessons: PublishedLessonInfo[] = (grammarMetaRes.data || []).map((g) => ({
      id: g.id,
      kind: 'grammar',
      title: g.title,
      slug: g.slug,
      level: g.level || 'foundation',
      sort_order: g.sort_order,
    }));

    const publishedLearningLessons: PublishedLessonInfo[] = (learningMetaRes.data || []).map((l) => ({
      id: l.id,
      kind: l.kind as 'listening' | 'reading',
      title: l.title,
      slug: l.slug,
      level: l.level || 'foundation',
      sort_order: l.sort_order,
      toeic_part: l.toeic_part,
    }));

    const completedLessonIds = new Set<string>(
      userProgress.filter((p) => p.status === 'completed').map((p) => p.content_id)
    );

    const inProgress = userProgress.find((p) => p.status === 'in_progress');

    // Run Pure Weakness Analysis for target student
    const analysis = analyzeLearningPerformance(questionAttempts);

    // Run Pure Recommendation Engine for target student with target student's level
    const recommendations = buildLearningRecommendations({
      analysis,
      studentLevel: studentProfile.level || 'foundation',
      publishedGrammarLessons,
      publishedLearningLessons,
      inProgressLessonId: inProgress?.content_id,
      recentlyCompletedLessonIds: completedLessonIds,
    });

    // Run Pure Summary Engine
    const summary = summarizeStudentProgress({
      studentProfile,
      vocabularyReviews,
      quizAttempts,
      questionAttempts,
      userProgress,
      analysis,
      recommendations,
    });

    return { data: summary, error: null };
  } catch (err: any) {
    console.error('[ORI Admin] Unexpected exception in getAdminStudentProgress:', err);
    return { data: null, error: 'Đã xảy ra lỗi không xác định khi tải tiến độ học viên.' };
  }
}
