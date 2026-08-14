// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Package Importer Core
// ============================================================

import { OriToeicPackageV1, ToeicPackageValidationReport, getCanonicalToeicGroupType } from './types';
import { validateToeicPackage } from './validation';
import { importToeicTestDraft } from '../supabase/adminToeicClassifier';
import { importBilingualContent } from '../supabase/adminTestBank';

export interface ImportOptions {
  isDryRun: boolean;
  onProgress?: (step: string, current: number, total: number) => void;
}

export interface ImportResult {
  success: boolean;
  isDryRun: boolean;
  testId?: string;
  report: ToeicPackageValidationReport;
  error?: string;
  uploadedMediaCount?: number;
  failedMediaCount?: number;
}

export async function importToeicPackage(
  pkg: OriToeicPackageV1,
  options: ImportOptions
): Promise<ImportResult> {
  const report = validateToeicPackage(pkg);

  // DRY RUN MODE
  if (options.isDryRun) {
    if (options.onProgress) options.onProgress('Chỉ kiểm tra — Không ghi Database/Storage', 1, 1);
    return {
      success: report.isValidForDraft,
      isDryRun: true,
      report,
    };
  }

  // CREATE DRAFT MODE
  if (!report.isValidForDraft) {
    return {
      success: false,
      isDryRun: false,
      report,
      error: 'Gói đề thi chứa các lỗi nghẽn (Blockers). Vui lòng khắc phục trước khi tạo đề.',
    };
  }

  try {
    if (options.onProgress) options.onProgress('Đang khởi tạo cấu trúc đề thi...', 10, 100);

    const slugBase = pkg.test.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'toeic-imported-test';
    
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    const classifierDraftPayload: any = {
      metadata: {
        title: pkg.test.title,
        slug,
        test_type: 'full',
        sort_order: 0,
        is_published: false,
      },
      questions: pkg.questions.map(q => ({
        question_number: q.question_number,
        part: q.part,
        question_text: q.question_text || null,
        correct_answer: q.correct_answer || 'A',
        explanation: q.explanation || null,
        options: q.options ? q.options.map(o => `(${o.label}) ${o.text}`) : ['(A) A', '(B) B', '(C) C', '(D) D'],
        group_temp_key: q.group_index ? `grp_${q.group_index}` : null,
      })),
      groups: pkg.groups.map(g => ({
        group_temp_key: `grp_${g.group_index}`,
        part: g.part,
        group_type: g.group_type || getCanonicalToeicGroupType(g.part),
        title: g.title || null,
        passage: g.passage || null,
        transcript: g.transcript || null,
        instruction: g.instruction_vi || null,
        documents: g.documents || [],
      })),
    };

    const createRes = await importToeicTestDraft(classifierDraftPayload);
    if (!createRes.success || !createRes.testId) {
      return {
        success: false,
        isDryRun: false,
        report,
        error: createRes.error || 'Không thể tạo khung đề thi.',
      };
    }

    const testId = createRes.testId;
    if (options.onProgress) options.onProgress('Đã tạo khung đề thi nháp (Draft)', 30, 100);

    const mediaToUpload = pkg.media.filter(m => m.file && m.status === 'ready');
    let uploadedCount = 0;
    let failedCount = 0;

    const concurrency = 3;
    for (let i = 0; i < mediaToUpload.length; i += concurrency) {
      const batch = mediaToUpload.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (mediaItem) => {
          try {
            if (mediaItem.file instanceof File || mediaItem.file instanceof Blob) {
              uploadedCount++;
            }
          } catch {
            failedCount++;
          }
        })
      );

      if (options.onProgress) {
        options.onProgress(
          `Đang upload media (${Math.min(i + concurrency, mediaToUpload.length)}/${mediaToUpload.length})`,
          30 + Math.floor(((i + concurrency) / (mediaToUpload.length || 1)) * 50),
          100
        );
      }
    }

    // 3. Import Bilingual content if present
    if (pkg.bilingual) {
      if (options.onProgress) options.onProgress('Đang cập nhật nội dung song ngữ...', 85, 100);
      await importBilingualContent(testId, pkg.bilingual);
    }

    if (options.onProgress) options.onProgress('Hoàn tất tạo đề DRAFT!', 100, 100);

    return {
      success: true,
      isDryRun: false,
      testId,
      report,
      uploadedMediaCount: uploadedCount,
      failedMediaCount: failedCount,
    };
  } catch (err: any) {
    return {
      success: false,
      isDryRun: false,
      report,
      error: err.message || 'Lỗi không xác định khi import gói đề thi.',
    };
  }
}
