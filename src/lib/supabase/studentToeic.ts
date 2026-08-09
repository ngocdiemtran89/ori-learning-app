/**
 * P3.6A Student TOEIC Test Runner — Supabase Client Layer
 *
 * All student-facing data access for TOEIC tests.
 * NEVER exposes correct_answer or explanation to the browser.
 */

import { supabase } from './client';
import type {
  PublishedToeicTest,
  ToeicTestAttempt,
  ToeicTestAttemptAnswer,
  StudentToeicTestContent,
} from './types';

// ============================================================
// TEST LIBRARY
// ============================================================

/** Fetch all published TOEIC tests visible to students */
export async function fetchPublishedTests(): Promise<{ data: PublishedToeicTest[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('toeic_tests')
    .select('id, title, test_code, description, test_type, is_published')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data as PublishedToeicTest[], error: null };
}

// ============================================================
// ATTEMPT MANAGEMENT
// ============================================================

/** Start or resume a TOEIC test attempt (atomic RPC) */
export async function startOrResumeTest(testId: string): Promise<{ attemptId: string; resumed: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('start_or_resume_toeic_test', {
    p_test_id: testId,
  });

  if (error) return { attemptId: '', resumed: false, error: error.message };
  return {
    attemptId: data.attempt_id,
    resumed: data.resumed,
  };
}

/** Fetch the student's in-progress attempt for a specific test */
export async function fetchMyAttempt(testId: string): Promise<{ data: ToeicTestAttempt | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('toeic_test_attempts')
    .select('*')
    .eq('user_id', user.id)
    .eq('test_id', testId)
    .eq('status', 'in_progress')
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as ToeicTestAttempt | null, error: null };
}

/** Update attempt progress (current question, last activity) */
export async function updateAttemptProgress(
  attemptId: string,
  currentQuestionNumber: number
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('toeic_test_attempts')
    .update({
      current_question_number: currentQuestionNumber,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', attemptId);

  return { error: error?.message || null };
}

// ============================================================
// SECURE TEST CONTENT (NO correct_answer / explanation)
// ============================================================

/** Fetch test content via secure RPC — NEVER includes correct_answer or explanation */
export async function fetchTestContent(testId: string): Promise<{ data: StudentToeicTestContent | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_student_toeic_test_content', {
    p_test_id: testId,
  });

  if (error) return { data: null, error: error.message };
  return { data: data as StudentToeicTestContent, error: null };
}

// ============================================================
// ANSWER MANAGEMENT
// ============================================================

/** Fetch all saved answers for an attempt */
export async function fetchAttemptAnswers(attemptId: string): Promise<{ data: ToeicTestAttemptAnswer[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('toeic_test_attempt_answers')
    .select('id, attempt_id, question_id, selected_answer, answered_at')
    .eq('attempt_id', attemptId);

  if (error) return { data: null, error: error.message };
  return { data: data as ToeicTestAttemptAnswer[], error: null };
}

/** Save an answer via secure RPC (validates ownership, status, canonical answer) */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  selectedAnswer: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('save_toeic_answer', {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_answer: selectedAnswer,
  });

  return { error: error?.message || null };
}
