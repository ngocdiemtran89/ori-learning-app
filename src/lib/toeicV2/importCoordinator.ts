// ============================================================
// ORI TOEIC Website V2 — Import Coordinator
// ============================================================

import { V2ValidationReport } from './types';
import { adaptToCanonicalPackage } from './canonicalAdapter';
import { validateV2Package } from './validatePackage';
import { createCoreDraftFromV2 } from './draftAdapter';
import { extractLearningUnitsFromV2Package } from './extractLearningUnits';
import { buildLearningImportPayload } from './buildLearningImportPayload';
import { supabase } from '../supabase/client';

export interface V2ImportOptions {
  isDryRun: boolean;
  onProgress?: (step: string, current: number, total: number) => void;
}

export type V2ImportStatusCode = 'FULL_SUCCESS' | 'CORE_IMPORTED' | 'FAILED';

export interface V2ImportResult {
  success: boolean;
  statusCode: V2ImportStatusCode;
  isDryRun: boolean;
  testId?: string;
  report: V2ValidationReport;
  learningImportSuccess?: boolean;
  learningImportError?: string;
  error?: string;
}

export async function saveV2LearningUnits(
  testId: string,
  rawPkg: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const pkg = adaptToCanonicalPackage(rawPkg);
    const extracted = extractLearningUnitsFromV2Package(pkg);
    if (extracted.items.length === 0) {
      return { success: true };
    }

    const { itemsPayload, linksPayload } = buildLearningImportPayload(testId, extracted);

    // Idempotent upsert items into toeic_learning_items
    const { error: itemsErr } = await supabase
      .from('toeic_learning_items')
      .upsert(itemsPayload, { onConflict: 'item_key' });

    if (itemsErr) {
      return { success: false, error: `Lỗi lưu Learning Items: ${itemsErr.message}` };
    }

    // Insert links into toeic_question_learning_items
    const { error: linksErr } = await supabase.rpc('admin_import_v2_question_learning_links', {
      links_payload: linksPayload,
    });

    if (linksErr) {
      return { success: false, error: `Lỗi liên kết Learning Items: ${linksErr.message}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi không xác định khi lưu Learning Units.' };
  }
}

export async function importV2ToeicPackage(
  rawPkg: any,
  options: V2ImportOptions
): Promise<V2ImportResult> {
  const report = validateV2Package(rawPkg);

  // 1. Dry Run check
  if (options.isDryRun) {
    if (options.onProgress) options.onProgress('Kiểm tra định dạng (Dry Run)...', 100, 100);
    return {
      success: report.isValid,
      statusCode: report.isValid ? 'FULL_SUCCESS' : 'FAILED',
      isDryRun: true,
      report,
    };
  }

  // 2. Validation Blocker check
  if (!report.isValid) {
    return {
      success: false,
      statusCode: 'FAILED',
      isDryRun: false,
      report,
      error: 'Gói đề thi V2 chứa lỗi không thể khởi tạo.',
    };
  }

  const pkg = adaptToCanonicalPackage(rawPkg);

  // 3. Create Core DRAFT
  if (options.onProgress) options.onProgress('Đang tạo khung đề thi DRAFT...', 30, 100);
  const coreRes = await createCoreDraftFromV2(pkg);

  if (!coreRes.success || !coreRes.testId) {
    return {
      success: false,
      statusCode: 'FAILED',
      isDryRun: false,
      report,
      error: coreRes.error || 'Tạo khung đề thi DRAFT thất bại.',
    };
  }

  const testId = coreRes.testId;
  if (options.onProgress) options.onProgress('Đã tạo khung đề thi DRAFT thành công!', 60, 100);

  // 4. Import Learning Units (INVARIANT: if learning import fails, DO NOT delete core DRAFT)
  if (options.onProgress) options.onProgress('Đang trích xuất & lưu điểm kiến thức V2...', 80, 100);
  const learningRes = await saveV2LearningUnits(testId, pkg);

  if (!learningRes.success) {
    if (options.onProgress) options.onProgress('Đã tạo đề DRAFT (Có cảnh báo lỗi Learning Units)', 100, 100);
    return {
      success: true, // Core draft WAS created successfully
      statusCode: 'CORE_IMPORTED',
      isDryRun: false,
      testId,
      report,
      learningImportSuccess: false,
      learningImportError: learningRes.error,
    };
  }

  if (options.onProgress) options.onProgress('Hoàn tất Import V2!', 100, 100);
  return {
    success: true,
    statusCode: 'FULL_SUCCESS',
    isDryRun: false,
    testId,
    report,
    learningImportSuccess: true,
  };
}
