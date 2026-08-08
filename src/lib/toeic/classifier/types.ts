export interface ParsedQuestion {
  question_number: number;
  part: string;
  question_text: string | null;
  options: string[];
  correct_answer: string | null;
  explanation: string | null;
  group_temp_key: string | null; // Temp key to link to ParsedGroup
  audio_url: string | null;
  image_url: string | null;
}

export interface ParsedGroup {
  group_temp_key: string;
  part: string;
  group_type: string;
  title: string | null;
  instruction: string | null;
  passage: string | null;
  transcript: string | null;
  audio_url: string | null;
  image_url: string | null;
  documents: any[];
}

export interface ParserIssue {
  type: 'ERROR' | 'WARNING' | 'REVIEW';
  message: string;
  question_number?: number;
  group_temp_key?: string;
}

export interface ParsedToeicTestDraft {
  metadata: {
    title: string;
    slug: string;
    test_code: string;
    description: string;
    test_type: 'full' | 'mini';
  };
  questions: ParsedQuestion[];
  groups: ParsedGroup[];
  issues: ParserIssue[];
  summary: {
    detectedQuestions: number;
    partCounts: Record<string, number>;
    missingNumbers: number[];
    duplicateNumbers: number[];
    answersFound: number;
  };
}
