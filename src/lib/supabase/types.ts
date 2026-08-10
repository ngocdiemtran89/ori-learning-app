export type UserRole = 'student' | 'admin';
export type AccountStatus = 'active' | 'disabled';
export type ContentKind = 'listening' | 'reading';
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  status: AccountStatus;
  level: string;
  access_start_at: string;
  access_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VocabularyDeck {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string;
  is_published: boolean;
  sort_order: number;
  created_at: string;
}

export interface VocabularyItem {
  id: string;
  deck_id: string;
  word: string;
  ipa: string | null;
  part_of_speech: string | null;
  meaning_vi: string;
  example_en: string | null;
  example_vi: string | null;
  topic: string | null;
  toeic_parts: string[];
  collocations: string[];
  common_mistake: string | null;
  audio_url: string | null;
  is_published: boolean;
  system_namespace?: string | null;
  sort_order: number;
  created_at: string;
}

export interface GrammarLesson {
  id: string;
  slug: string;
  title: string;
  level: string;
  summary: string | null;
  lesson_content: Record<string, unknown>;
  is_published: boolean;
  sort_order: number;
  created_at: string;
}

export interface LearningLesson {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  level: string;
  toeic_part: string | null;
  passage: string | null;
  transcript: string | null;
  audio_url: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
}

// ============================================================
// P3.6A Student TOEIC Test Runner Types
// ============================================================

export type ToeicAttemptStatus = 'in_progress' | 'submitted' | 'abandoned';
export type ToeicAttemptMode = 'full' | 'part';

export interface ToeicTestAttempt {
  id: string;
  user_id: string;
  test_id: string;
  status: ToeicAttemptStatus;
  mode: ToeicAttemptMode;
  part_number: number | null;
  started_at: string;
  last_activity_at: string;
  submitted_at: string | null;
  current_question_number: number;
  elapsed_seconds: number;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface ToeicTestAttemptAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_answer: string | null;
  answered_at: string;
}

/** Safe student question — NEVER contains correct_answer or explanation */
export interface StudentToeicQuestion {
  id: string;
  group_id: string | null;
  question_number: number;
  part: string;
  question_text: string | null;
  options: string[];
  skill_tag: string | null;
  topic: string | null;
  audio_url: string | null;
  image_url: string | null;
  // Translation (part mode only — null in full mode)
  translation_vi?: string | null;
  options_vi?: string[] | null;
  correct_answer?: string | null;
  evidence?: any[] | null;
  // Dual listening cues (single_track mode)
  cue_start_ms?: number | null;
  cue_end_ms?: number | null;
}

export interface StudentToeicGroup {
  id: string;
  part: string;
  group_type: string;
  title: string | null;
  instruction: string | null;
  passage: string | null;
  documents: any[] | null;
  audio_url: string | null;
  image_url: string | null;
  // Translation (part mode only — null in full mode)
  instruction_vi?: string | null;
  passage_vi?: string | null;
  documents_vi?: any[] | null;
  transcript_vi?: string | null;
  part7_bilingual_units?: any[] | null;
  // Dual listening cues (single_track mode)
  cue_start_ms?: number | null;
  cue_end_ms?: number | null;
}

export interface StudentToeicTestMeta {
  id: string;
  title: string;
  test_code: string | null;
  description: string | null;
  test_type: string;
  listening_audio_mode?: 'segmented' | 'single_track';
  listening_audio_url?: string | null;
}

export interface StudentToeicTestContent {
  test: StudentToeicTestMeta;
  groups: StudentToeicGroup[];
  questions: StudentToeicQuestion[];
}

export interface PublishedToeicTest {
  id: string;
  title: string;
  test_code: string | null;
  description: string | null;
  test_type: string;
  is_published: boolean;
  listening_audio_mode?: 'segmented' | 'single_track';
  listening_audio_url?: string | null;
}

export interface ToeicListeningCue {
  id: string;
  test_id: string;
  question_id: string | null;
  group_id: string | null;
  start_ms: number;
  end_ms: number;
  created_at?: string;
  updated_at?: string;
}
