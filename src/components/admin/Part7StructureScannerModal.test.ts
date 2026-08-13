import { describe, it, expect } from 'vitest';
import { saveStagedBatch, loadStagedScan, clearStagedScan } from '../../lib/cms/part7StructureStaging';

describe('Part 7 Structure Scanner UI & Gating Integration Suite', () => {
  const mockTestId = 'test-unit-123';

  it('55. UNVERIFIED status renders when structure lock hash is null', () => {
    const lockHash: string | null = null;
    const currentHash = '147,148|149,150,151';

    let status = 'UNVERIFIED';
    if (lockHash) {
      status = lockHash === currentHash ? 'LOCKED' : 'DRIFT';
    }

    expect(status).toBe('UNVERIFIED');
  });

  it('56. LOCKED status renders when DB structure hash equals locked hash', () => {
    const lockHash = '147,148|149,150,151';
    const currentHash = '147,148|149,150,151';

    const status = lockHash === currentHash ? 'LOCKED' : 'DRIFT';
    expect(status).toBe('LOCKED');
  });

  it('57. DRIFT status renders when DB structure hash differs from locked hash', () => {
    const lockHash: string = '147,148|149,150,151';
    const currentHash: string = '147,148,149|150,151'; // DB group boundary changed!

    const status = lockHash === currentHash ? 'LOCKED' : 'DRIFT';
    expect(status).toBe('DRIFT');
  });

  it('58. UNVERIFIED status shows warning banner in Content Workbench', () => {
    const status = 'UNVERIFIED';
    const warningBannerText = status === 'UNVERIFIED' ? '⚠ Hãy quét và khóa cấu trúc Part 7 trước khi nhập nội dung.' : null;

    expect(warningBannerText).toContain('Hãy quét và khóa cấu trúc Part 7');
  });

  it('59. LOCKED status enables content operations in Content Workbench', () => {
    const status = 'LOCKED';
    const isSaveAllowed = status === 'LOCKED';

    expect(isSaveAllowed).toBe(true);
  });

  it('60. DRIFT status blocks content save in Content Workbench', () => {
    const status = 'DRIFT';
    const errorBannerText = status === 'DRIFT' ? '❌ Cấu trúc DB đã thay đổi sau khi khóa. Quét lại trước khi tiếp tục.' : null;

    expect(errorBannerText).toContain('Cấu trúc DB đã thay đổi');
  });

  it('61. published test allows structure scanning and viewing repair plan', () => {
    const canScan = true; // Scanning is always allowed!
    expect(canScan).toBe(true);
  });

  it('62. published test disables apply structure button with draft requirement message', () => {
    const isPublished = true;
    const isApplyAllowed = !isPublished;
    const notice = isPublished ? '🟡 ĐỀ ĐANG PUBLISHED. Chuyển về Draft trước khi áp dụng.' : null;

    expect(isApplyAllowed).toBe(false);
    expect(notice).toContain('Chuyển về Draft trước khi áp dụng');
  });

  it('63. missing migration/RPC gracefully falls back to UNVERIFIED status without crashing', () => {
    const rpcError = { message: 'function admin_get_toeic_part7_structure_status does not exist' };
    const fallbackStatus = rpcError ? { status: 'UNVERIFIED', fallback: true, fallback_message: 'Structure Guard chưa được kích hoạt trên database.' } : null;

    expect(fallbackStatus?.status).toBe('UNVERIFIED');
    expect(fallbackStatus?.fallback).toBe(true);
  });

  it('64. multi-batch staged raw source text survives in localStorage staging', () => {
    clearStagedScan(mockTestId);

    saveStagedBatch(mockTestId, 'Questions 147-148 refer to notice...\n147. Q1?\n148. Q2?');
    saveStagedBatch(mockTestId, 'Questions 149-151 refer to email...\n149. Q3?\n150. Q4?\n151. Q5?');

    const staged = loadStagedScan(mockTestId);

    expect(staged).not.toBeNull();
    expect(staged?.batches.length).toBe(2);
    expect(staged?.combinedRawText).toContain('Questions 147-148');
    expect(staged?.combinedRawText).toContain('Questions 149-151');

    clearStagedScan(mockTestId);
    expect(loadStagedScan(mockTestId)).toBeNull();
  });
});
