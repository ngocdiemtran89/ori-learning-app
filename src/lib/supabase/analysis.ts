import { supabase } from './client';
import {
  analyzeLearningPerformance,
  LearningAnalysis,
  QuestionAttemptForAnalysis,
} from '../learning/weaknessAnalysis';

export interface GetAnalysisResult {
  data: LearningAnalysis | null;
  error: string | null;
}

/**
 * Fetch 90-day recent question_attempts for the current student and perform weakness analysis safely
 */
export async function getStudentLearningAnalysis(userId: string): Promise<GetAnalysisResult> {
  if (!userId || userId.trim() === '') {
    return { data: null, error: null };
  }

  const ninetyDaysAgoISO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Query lightweight selected metadata columns only
  const { data, error } = await supabase
    .from('question_attempts')
    .select('question_key, content_type, is_correct, skill_tag, toeic_part, topic, created_at')
    .eq('user_id', userId)
    .gte('created_at', ninetyDaysAgoISO)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    console.error('[ORI Analysis] Error fetching question_attempts for analysis:', error.message);
    return {
      data: null,
      error: 'Không thể tải phân tích học tập lúc này. Vui lòng thử lại.',
    };
  }

  const attempts = (data || []) as QuestionAttemptForAnalysis[];
  const isTruncated = attempts.length === 2000;
  const analysis = analyzeLearningPerformance(attempts, { isTruncated });

  return { data: analysis, error: null };
}
