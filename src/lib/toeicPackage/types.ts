// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Types & Schema
// ============================================================

export type ListeningAudioMode = 'segmented' | 'single_track';

export interface OriPackageTestMeta {
  title: string;
  slug?: string;
  test_code?: string;
  description?: string;
  source_label?: string;
  listening_audio_mode: ListeningAudioMode;
}

export interface OriPackageOption {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
  text_vi?: string;
}

export interface OriPackageQuestion {
  question_number: number; // 1..200
  part: 'part1' | 'part2' | 'part3' | 'part4' | 'part5' | 'part6' | 'part7';
  group_index?: number | null; // index of group if in group
  question_text?: string | null; // printed question text
  options?: OriPackageOption[];
  correct_answer?: 'A' | 'B' | 'C' | 'D' | null;
  explanation?: string | null;
  image_url?: string | null;
  audio_url?: string | null;
  transcript?: string | null;
  translation_vi?: string | null;
  local_image_file?: File | Blob | null;
  local_audio_file?: File | null;
}

export interface OriPackageGroup {
  group_index: number;
  part: 'part3' | 'part4' | 'part6' | 'part7';
  start_question: number;
  end_question: number;
  title?: string | null;
  passage?: string | null;
  passage_vi?: string | null;
  audio_url?: string | null;
  transcript?: string | null;
  instruction_vi?: string | null;
  documents?: Array<{
    title?: string;
    content: string;
  }>;
  local_audio_file?: File | null;
  local_image_file?: File | null;
}

export interface OriPackageAnswerEntry {
  question_number: number;
  correct_answer: 'A' | 'B' | 'C' | 'D';
}

export interface OriPackageMediaEntry {
  id: string;
  targetType: 'question' | 'group' | 'single_track';
  targetNumberOrRange: string; // e.g. "Q1", "Q32-34"
  canonicalTarget: string; // e.g. "P1-Q001", "P2-Q007", "P3-Q032-034", "P4-Q071-073", "P1-IMG-Q001"
  part?: number; // 1..4
  localIndex?: number;
  mediaType: 'image' | 'audio';
  file?: File | Blob;
  filename: string;
  status: 'ready' | 'invalid' | 'conflict' | 'skip';
  error?: string;
}

export interface OriPackageBilingualPayload {
  questions?: Array<{
    question_number: number;
    translation_vi?: string;
    options_vi?: string[];
  }>;
  groups?: Array<{
    start_question: number;
    end_question: number;
    instruction_vi?: string;
    passage_vi?: string;
    documents_vi?: string[];
  }>;
}

export interface OriToeicPackageV1 {
  schema_version: 'ori.toeic.package.v1';
  test: OriPackageTestMeta;
  questions: OriPackageQuestion[];
  groups: OriPackageGroup[];
  answers: OriPackageAnswerEntry[];
  media: OriPackageMediaEntry[];
  bilingual?: OriPackageBilingualPayload;
}

export interface PackageIssue {
  severity: 'BLOCKER' | 'WARNING' | 'INFO';
  code: string;
  message: string;
  target?: string;
}

export type P2NumberingConvention = 'P2_GLOBAL_QNUM' | 'P2_LOCAL_INDEX' | 'P2_NUMBERING_AMBIGUOUS' | 'P2_NONE';
export type P3NumberingConvention = 'P3_RANGE' | 'P3_LOCAL_INDEX' | 'P3_GLOBAL_STARTQ' | 'P3_NUMBERING_AMBIGUOUS' | 'P3_NONE';
export type P4NumberingConvention = 'P4_RANGE' | 'P4_LOCAL_INDEX' | 'P4_GLOBAL_STARTQ' | 'P4_NUMBERING_AMBIGUOUS' | 'P4_NONE';

export interface PackageMediaConventions {
  p2Convention: P2NumberingConvention;
  p3Convention: P3NumberingConvention;
  p4Convention: P4NumberingConvention;
}

export interface ToeicPackageValidationReport {
  isValidForDraft: boolean;
  blockers: PackageIssue[];
  warnings: PackageIssue[];
  infos: PackageIssue[];
  counts: {
    totalQuestions: number;
    partCounts: Record<string, number>;
    totalGroups: number;
    p3GroupCount: number;
    p4GroupCount: number;
    p6GroupCount: number;
    p7GroupCount: number;
    totalAnswers: number;
    p1AudioCount: number; // /6
    p2AudioCount: number; // /25
    p3GroupAudioCount: number; // /13
    p4GroupAudioCount: number; // /10
    totalAudioFiles: number; // /54
    p1ImageCount: number; // /6
    readyMediaCount: number;
    missingAudioCount: number;
    missingImageCount: number;
    missingAnswerCount: number;
    conventions: PackageMediaConventions;
  };
}

export interface RawPackageSources {
  listeningPdfText?: string;
  readingPdfText?: string;
  answerKeyText?: string;
  transcriptPdfText?: string;
  audioFiles?: File[];
  part1PdfCroppedImages?: Record<number, File | Blob>; // Q1..Q6
  bilingualJsonText?: string;
}
