/**
 * P3.6A Student TOEIC Test Runner — Supabase Client Layer
 *
 * Supports FULL TEST and PRACTICE BY PART modes.
 * NEVER exposes correct_answer or explanation to the browser.
 */

import { supabase } from './client';
import type {
  PublishedToeicTest,
  ToeicTestAttempt,
  ToeicTestAttemptAnswer,
  StudentToeicTestContent,
  ToeicAttemptMode,
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

/** Start or resume a TOEIC test attempt (atomic RPC, mode-aware) */
export async function startOrResumeTest(
  testId: string,
  mode: ToeicAttemptMode = 'full',
  partNumber: number | null = null,
): Promise<{ attemptId: string; resumed: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('start_or_resume_toeic_test', {
    p_test_id: testId,
    p_mode: mode,
    p_part_number: partNumber,
  });

  if (error) return { attemptId: '', resumed: false, error: error.message };
  return {
    attemptId: data.attempt_id,
    resumed: data.resumed,
  };
}

/** Fetch the student's in-progress attempt for a specific test + mode */
export async function fetchMyAttempt(
  testId: string,
  mode: ToeicAttemptMode = 'full',
  partNumber: number | null = null,
): Promise<{ data: ToeicTestAttempt | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  let query = supabase
    .from('toeic_test_attempts')
    .select('*')
    .eq('user_id', user.id)
    .eq('test_id', testId)
    .eq('status', 'in_progress')
    .eq('mode', mode);

  if (mode === 'part' && partNumber !== null) {
    query = query.eq('part_number', partNumber);
  } else {
    query = query.is('part_number', null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data as ToeicTestAttempt | null, error: null };
}

/** Fetch ALL in-progress attempts for a test (for overview page) */
export async function fetchAllMyAttempts(
  testId: string,
): Promise<{ data: ToeicTestAttempt[] | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('toeic_test_attempts')
    .select('*')
    .eq('user_id', user.id)
    .eq('test_id', testId)
    .eq('status', 'in_progress');

  if (error) return { data: null, error: error.message };
  return { data: data as ToeicTestAttempt[], error: null };
}

/** Update attempt progress via controlled RPC (only permitted fields) */
export async function updateAttemptProgress(
  attemptId: string,
  currentQuestionNumber: number,
  elapsedSeconds?: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('update_toeic_attempt_progress', {
    p_attempt_id: attemptId,
    p_current_question_number: currentQuestionNumber,
    p_elapsed_seconds: elapsedSeconds ?? null,
  });

  return { error: error?.message || null };
}

// ============================================================
// SECURE TEST CONTENT (NO correct_answer / explanation)
// ============================================================

/** Fetch test content via secure RPC — mode-aware filtering */
export async function fetchTestContent(
  testId: string,
  mode: ToeicAttemptMode = 'full',
  partNumber: number | null = null,
): Promise<{ data: StudentToeicTestContent | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_student_toeic_test_content', {
    p_test_id: testId,
    p_mode: mode,
    p_part_number: partNumber,
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

/** Save an answer via secure RPC (validates ownership, status, scope, canonical answer) */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  selectedAnswer: string | null,
  elapsedSeconds?: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('save_toeic_answer', {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_answer: selectedAnswer,
    p_elapsed_seconds: elapsedSeconds ?? null,
  });

  return { error: error?.message || null };
}

// ============================================================
// VOCABULARY — SAVE WORD FROM TOEIC PRACTICE
// ============================================================

/** Save a word from TOEIC Practice into existing Saved Words system (Part mode only) */
export async function saveToeicWord(
  attemptId: string,
  questionId: string,
  word: string,
  contextSentence?: string,
): Promise<{ saved: boolean; word?: string; error?: string }> {
  const { data, error } = await supabase.rpc('save_toeic_word', {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_word: word,
    p_context_sentence: contextSentence || null,
  });

  if (error) return { saved: false, error: error.message };
  return { saved: true, word: data?.word };
}

// ============================================================
// P3.6B + P3.6C SUBMIT, SCORING & REVIEW
// ============================================================

export interface AttemptResultSummary {
  attempt_id: string;
  test_id?: string;
  test_title?: string;
  mode: ToeicAttemptMode;
  part_number: number | null;
  status: string;
  submitted_at: string;
  elapsed_seconds: number;
  total_count: number;
  answered_count: number;
  unanswered_count: number;
  correct_count: number;
  incorrect_count: number;
  score_percent: number;
}

export interface ReviewQuestionItem {
  id: string;
  question_number: number;
  part: string;
  group_id?: string | null;
  question_text?: string | null;
  options?: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }>;
  options_vi?: string[];
  student_answer?: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation?: string | null;
  translation_vi?: string | null;
  transcript?: string | null;
  transcript_vi?: string | null;
  image_url?: string | null;
  audio_url?: string | null;
  cue_start_ms?: number | null;
  cue_end_ms?: number | null;
}

export interface ReviewGroupItem {
  id: string;
  part: string;
  title?: string | null;
  instruction?: string | null;
  instruction_vi?: string | null;
  passage?: string | null;
  passage_vi?: string | null;
  transcript?: string | null;
  transcript_vi?: string | null;
  audio_url?: string | null;
  image_url?: string | null;
  documents?: Array<{ title?: string; content: string }>;
  documents_vi?: string[];
  cue_start_ms?: number | null;
  cue_end_ms?: number | null;
}

export interface StudentToeicAttemptReviewPayload {
  test: {
    id: string;
    title: string;
    test_code?: string | null;
    listening_audio_mode?: 'segmented' | 'single_track';
    listening_audio_url?: string | null;
  };
  attempt: {
    id: string;
    mode: ToeicAttemptMode;
    part_number: number | null;
    status: string;
    submitted_at: string;
    elapsed_seconds: number;
  };
  result: {
    total_count: number;
    answered_count: number;
    unanswered_count: number;
    correct_count: number;
    incorrect_count: number;
    score_percent: number;
  };
  questions: ReviewQuestionItem[];
  groups: ReviewGroupItem[];
}

/** Atomic submission of a TOEIC attempt (scores answers on server, idempotent) */
export async function submitStudentToeicAttempt(
  attemptId: string
): Promise<{ success: boolean; data?: AttemptResultSummary; error?: string }> {
  const { data, error } = await supabase.rpc('submit_student_toeic_attempt', {
    p_attempt_id: attemptId,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as AttemptResultSummary };
}

/** Fetch scoring result summary of a submitted attempt */
export async function getStudentToeicAttemptResult(
  attemptId: string
): Promise<{ success: boolean; data?: AttemptResultSummary; error?: string }> {
  const { data, error } = await supabase.rpc('get_student_toeic_attempt_result', {
    p_attempt_id: attemptId,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as AttemptResultSummary };
}

/** Fetch secure post-submit review payload for a submitted attempt (only owner + submitted) */
export async function getStudentToeicAttemptReview(
  attemptId: string
): Promise<{ success: boolean; data?: StudentToeicAttemptReviewPayload; error?: string }> {
  const { data, error } = await supabase.rpc('get_student_toeic_attempt_review', {
    p_attempt_id: attemptId,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as StudentToeicAttemptReviewPayload };
}

