/**
 * ORI FULL TOEIC IMPORT STUDIO — Data Contracts & Types (Phase 1)
 */

export type FieldProvenance = 'LOCAL' | 'CHATGPT' | 'OCR_LOCAL' | 'MANUAL';

export type QuestionStatus = 'AUTO_OK' | 'REVIEW' | 'ERROR';

export type PdfTextStatus = 'TEXT_OK' | 'LOW_TEXT' | 'IMAGE_ONLY' | 'TEXT_ERROR';

export type PdfRenderStatus = 'NOT_RENDERED' | 'RENDERING' | 'READY' | 'RENDER_ERROR';

export interface PdfPagePreflight {
  pageNumber: number;

  extractedText: string;
  normalizedText: string;
  ocrText?: string;

  charCount: number;
  wordCount: number;

  status: PdfTextStatus; // for backwards compatibility
  textStatus: PdfTextStatus;
  renderStatus: PdfRenderStatus;

  activeTextSource: 'PDF_TEXT' | 'OCR_TEXT' | 'MANUAL';

  warnings: string[];
  textError?: string;
  renderError?: string;
}

export interface PdfPreflightReport {
  fileName: string;
  totalPages: number;
  pagesWithText: number;
  lowTextPages: number;
  imageOnlyPages: number;
  textErrorPages: number;
  renderErrorPages: number;
  imageOrEmptyPages: number; // for backwards compatibility
  pages: PdfPagePreflight[];
}

export interface StagingQuestion {
  questionNumber: number; // 1 - 200
  part: 1 | 2 | 3 | 4 | 5 | 6 | 7;

  questionText: string;
  questionVi?: string;

  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };

  optionsVi?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };

  correctAnswer?: 'A' | 'B' | 'C' | 'D';

  groupKey?: string; // e.g. "P3-Q32-34", "P7-Q147-148"

  source: {
    pdf: 'listening' | 'reading' | 'script' | 'manual';
    page: number;
  };

  provenance: {
    questionTextSource: FieldProvenance;
    optionsSource: FieldProvenance;
    translationSource: FieldProvenance;
    groupSource: FieldProvenance;
  };

  confidence: number; // 0.0 to 1.0
  status: QuestionStatus;
  warnings: string[];
}

export interface StagingGroup {
  groupKey: string;
  part: 3 | 4 | 6 | 7;

  startQuestion: number;
  endQuestion: number;

  instruction?: string;
  passage?: string;
  passageVi?: string;

  documents?: { title?: string; content?: string; type?: string }[];

  sourcePages: number[];
  provenance: FieldProvenance;
  confidence: number;
  warnings: string[];
}

export interface AudioSegment {
  id: string;
  part: 1 | 2 | 3 | 4;
  startQuestion: number;
  endQuestion: number;
  label: string;
  startSeconds: number;
  endSeconds: number;
}

export interface OriFullToeicImportSchema {
  schemaVersion: 1;

  test: {
    title: string;
    description?: string;
  };

  sourceCoverage: {
    listeningPages: number[];
    readingPages: number[];
    unhandledListeningPages: number[];
    unhandledReadingPages: number[];
  };

  questions: StagingQuestion[];
  groups: StagingGroup[];
  audioSegments: AudioSegment[];
  warnings: string[];

  metadata: {
    totalQuestions: number;
    listeningCount: number;
    readingCount: number;
    createdAt: string;
    isReadyForDbImport: boolean;
  };
}

export interface FullValidationReport {
  isReadyForDbImport: boolean;
  listeningComplete: boolean;
  readingComplete: boolean;

  listeningSummary: {
    part1Count: number;
    part2Count: number;
    part3Count: number;
    part4Count: number;
    total: number;
  };

  readingSummary: {
    part5Count: number;
    part6Count: number;
    part7Count: number;
    total: number;
  };

  pageCoverageSummary: {
    listeningTotal: number;
    listeningHandled: number;
    readingTotal: number;
    readingHandled: number;
    unhandledPages: string[];
  };

  errors: string[];
  warnings: string[];
}

export interface ChatGptBatchPacket {
  batchIndex: number;
  totalBatches: number;
  sourceType: 'listening' | 'reading' | 'script';
  startPage: number;
  endPage: number;
  promptText: string;
  requiresVision: boolean;
}
