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
