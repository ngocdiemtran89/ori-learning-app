/**
 * Types and Interfaces for Phase 3.5 Bulk Content Import Center
 */

export type ImportContentType = 'vocabulary' | 'grammar' | 'listening' | 'reading';
export type ImportFileFormat = 'csv' | 'json';
export type ImportRowStatus = 'VALID' | 'WARNING' | 'ERROR' | 'CONFLICT';

export interface ImportRowError {
  field: string;
  message: string;
  value?: any;
}

export interface ImportRowWarning {
  field: string;
  message: string;
  value?: any;
}

export interface ImportParsedRecord<T = any> {
  rowIndex: number;
  status: ImportRowStatus;
  data: T;
  errors: ImportRowError[];
  warnings: ImportRowWarning[];
  selected?: boolean;
}

export interface ImportPlanSummary {
  totalRecords: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  conflictCount: number;
  selectedCount: number;
}

export interface ImportPlan<T = any> {
  contentType: ImportContentType;
  fileFormat: ImportFileFormat;
  records: ImportParsedRecord<T>[];
  summary: ImportPlanSummary;
}

export interface ImportExecutionResult {
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ rowIndex: number; error: string }>;
  details: any[];
}
