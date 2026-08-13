// ============================================================
// ORI TOEIC Website V2 — TypeScript Interfaces & Types
// ============================================================

export type ToeicPart = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7';
export type CorrectAnswer = 'A' | 'B' | 'C' | 'D';
export type LearningKind = 'grammar' | 'vocabulary' | 'collocation' | 'paraphrase';

export interface V2LearningUnit {
  kind: LearningKind;
  item_key: string;
  title: string;
  definition?: string;
  example?: string;
  difficulty_level?: number; // 1-5
  ai_suggested?: boolean;
}

export interface V2Question {
  question_number: number;
  part: ToeicPart;
  question_text?: string | null;
  options: string[] | Record<string, string>;
  correct_answer: CorrectAnswer;
  explanation?: string | null;
  group_key?: string | null;
  audio_url?: string | null;
  image_url?: string | null;
  cue_target?: string | null;
  learning_units?: V2LearningUnit[];
}

export interface V2Group {
  group_key: string;
  part: ToeicPart;
  title?: string | null;
  instruction?: string | null;
  passage?: string | null;
  transcript?: string | null;
  audio_url?: string | null;
  image_url?: string | null;
  documents?: any[] | null;
  question_range?: [number, number];
}

export interface OriToeicV2Package {
  metadata: {
    title: string;
    slug?: string;
    test_code?: string;
    description?: string;
    test_type?: string;
    is_published?: boolean;
    status?: string;
  };
  groups: V2Group[];
  questions: V2Question[];
  learning_units?: V2LearningUnit[];
}

export interface V2ValidationError {
  code: string;
  message: string;
  question_number?: number;
  group_key?: string;
  severity: 'error' | 'warning';
}

export interface V2ValidationReport {
  isValid: boolean;
  errors: V2ValidationError[];
  warnings: V2ValidationError[];
  summary: {
    totalQuestions: number;
    totalGroups: number;
    partCounts: Record<ToeicPart, number>;
  };
}
