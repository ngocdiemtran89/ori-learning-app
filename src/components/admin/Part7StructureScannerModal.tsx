import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  Lock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Plus,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { parsePart7StructureFromText } from '../../lib/cms/part7StructureParser';
import { buildPart7StructureManifest, ManifestValidationResult } from '../../lib/cms/part7StructureManifest';
import { compareStructureWithDatabase, Part7RepairPlan, DbGroupInfo, DbQuestionInfo } from '../../lib/cms/part7StructureComparison';
import { loadStagedScan, saveStagedBatch, clearStagedScan, Part7StagedScanState } from '../../lib/cms/part7StructureStaging';
import { applyPart7Structure } from '../../lib/supabase/studentToeic';

export interface Part7StructureScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  testId: string;
  testTitle: string;
  isPublished: boolean;
  existingQuestions: any[];
  existingGroups: any[];
  onUpdated: () => void;
}

export const Part7StructureScannerModal: React.FC<Part7StructureScannerModalProps> = ({
  isOpen,
  onClose,
  testId,
  testTitle,
  isPublished,
  existingQuestions,
  existingGroups,
  onUpdated,
}) => {
  const [pasteInput, setPasteInput] = useState('');
  const [stagedState, setStagedState] = useState<Part7StagedScanState | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [showConfirmApply, setShowConfirmApply] = useState(false);

  // Load staged scan on open
  useEffect(() => {
    if (isOpen && testId) {
      const staged = loadStagedScan(testId);
      setStagedState(staged);
    }
  }, [isOpen, testId]);

  // Combined raw source text from staged state or current input
  const combinedRawText = useMemo(() => {
    if (stagedState && stagedState.combinedRawText) {
      return stagedState.combinedRawText;
    }
    return pasteInput;
  }, [stagedState, pasteInput]);

  // 1. Detect groups from English source text
  const detectedGroups = useMemo(() => {
    if (!combinedRawText.trim()) return [];
    return parsePart7StructureFromText(combinedRawText);
  }, [combinedRawText]);

  // 2. Build canonical manifest & validate Q147-200 completeness
  const manifestResult: ManifestValidationResult = useMemo(() => {
    return buildPart7StructureManifest(detectedGroups);
  }, [detectedGroups]);

  // Prepare DB groups & questions format for comparison
  const dbGroupsFormatted: DbGroupInfo[] = useMemo(() => {
    const p7Groups = (existingGroups || []).filter((g) => g.part === 'part7' && g.is_active !== false);
    return p7Groups.map((g) => {
      const qInG = (existingQuestions || []).filter((q) => q.group_id === g.id && q.is_active !== false);
      const qNums = qInG.map((q) => q.question_number).sort((a, b) => a - b);
      return {
        id: g.id,
        part: g.part,
        sort_order: g.sort_order || 0,
        passage: g.passage || '',
        question_numbers: qNums,
        min_qn: qNums.length > 0 ? qNums[0] : 0,
        max_qn: qNums.length > 0 ? qNums[qNums.length - 1] : 0,
        has_bilingual_units: Array.isArray(g.part7_bilingual_units) && g.part7_bilingual_units.length > 0,
        has_evidence: qInG.some((q) => Array.isArray(q.evidence) && q.evidence.length > 0),
      };
    });
  }, [existingGroups, existingQuestions]);

  const dbQuestionsFormatted: DbQuestionInfo[] = useMemo(() => {
    const p7Qs = (existingQuestions || []).filter(
      (q) => (q.part === 'part7' || (q.question_number >= 147 && q.question_number <= 200)) && q.is_active !== false
    );
    return p7Qs.map((q) => ({
      id: q.id,
      question_number: q.question_number,
      group_id: q.group_id,
    }));
  }, [existingQuestions]);

  // 3. Compare with DB & build Repair Plan
  const repairPlan: Part7RepairPlan | null = useMemo(() => {
    if (!manifestResult.isValid || !manifestResult.manifest) return null;
    return compareStructureWithDatabase(manifestResult.manifest, dbGroupsFormatted, dbQuestionsFormatted, isPublished);
  }, [manifestResult, dbGroupsFormatted, dbQuestionsFormatted, isPublished]);

  // Add Batch action
  const handleAddBatch = useCallback(() => {
    if (!pasteInput.trim()) return;
    const newState = saveStagedBatch(testId, pasteInput.trim());
    setStagedState(newState);
    setPasteInput('');
  }, [testId, pasteInput]);

  // Clear Staged Draft action
  const handleClearStaging = useCallback(() => {
    clearStagedScan(testId);
    setStagedState(null);
    setPasteInput('');
  }, [testId]);

  // Apply & Lock Execution
  const handleConfirmApplyLock = useCallback(async () => {
    if (!repairPlan || !repairPlan.isApplyAllowed || !manifestResult.manifest) return;
    setApplying(true);
    setApplyError(null);
    setApplySuccess(null);

    const payload = {
      manifest: manifestResult.manifest,
      question_mappings: repairPlan.questionMappings,
      expected_current_structure_hash: repairPlan.expectedCurrentStructureHash,
      detected_structure_hash: repairPlan.detectedStructureHash,
    };

    try {
      const res = await applyPart7Structure(testId, payload);
      if (res.success) {
        setApplySuccess('🔒 Đã áp dụng sửa cấu trúc và khóa Part 7 thành công!');
        clearStagedScan(testId);
        onUpdated();
        setTimeout(() => {
          setShowConfirmApply(false);
          onClose();
        }, 1500);
      } else {
        setApplyError(res.error || 'Không thể áp dụng sửa cấu trúc');
      }
    } catch (err: any) {
      setApplyError(err.message || 'Lỗi áp dụng cấu trúc');
    } finally {
      setApplying(false);
    }
  }, [repairPlan, manifestResult, testId, onUpdated, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER BAR */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-xl">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>QUÉT CẤU TRÚC ĐỀ PART 7</span>
                <span className="text-xs font-normal text-purple-300 bg-purple-950/80 px-2.5 py-0.5 rounded-md border border-purple-800">
                  SOURCE-FIRST
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Đề: <strong className="text-slate-200">{testTitle}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
          {/* PUBLISHED WARNING BANNER */}
          {isPublished && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-semibold flex items-start gap-2.5 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-amber-900">🟡 ĐỀ ĐANG Ở TRẠNG THÁI PUBLISHED</p>
                <p className="mt-0.5 text-amber-800">
                  Bạn có thể dán văn bản để quét và xem Repair Plan. Để thực hiện áp dụng sửa cấu trúc và khóa Part 7, hãy chuyển trạng thái đề về <strong>Draft</strong> trước.
                </p>
              </div>
            </div>
          )}

          {/* 1. MULTI-BATCH SOURCE INPUT AREA */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-600" />
                Văn Bản Nguồn Tiếng Anh (English Source Input)
              </h3>

              {stagedState && stagedState.batches.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                    Đã nạp {stagedState.batches.length} batch
                  </span>
                  <button
                    type="button"
                    onClick={handleClearStaging}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa bản nháp quét
                  </button>
                </div>
              )}
            </div>

            <textarea
              rows={5}
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              placeholder="Dán nội dung Part 7 Tiếng Anh tại đây (ví dụ: 'Questions 147–148 refer to the following notice...'). Có thể nạp thành nhiều batch..."
              className="w-full p-3.5 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-slate-50/50"
            />

            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-[11px] text-slate-500 italic">
                💡 Scanner tự động nhận diện tiêu đề dạng <code className="font-bold text-slate-700">Questions 147–148 refer to...</code> làm chuẩn cấu trúc.
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddBatch}
                  disabled={!pasteInput.trim()}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ NẠP THÊM BATCH</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. STRUCTURE DETECTED METRICS SUMMARY */}
          {combinedRawText.trim() !== '' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs text-center">
                  <div className="text-[11px] font-extrabold text-slate-500 uppercase">Số câu phát hiện</div>
                  <div className={`text-2xl font-black mt-1 ${manifestResult.totalQuestionsFound === 54 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {manifestResult.totalQuestionsFound} <span className="text-xs text-slate-400 font-bold">/ 54</span>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs text-center">
                  <div className="text-[11px] font-extrabold text-slate-500 uppercase">Số nhóm bài đọc</div>
                  <div className="text-2xl font-black text-purple-700 mt-1">
                    {detectedGroups.length} <span className="text-xs text-slate-400 font-bold">groups</span>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs text-center">
                  <div className="text-[11px] font-extrabold text-slate-500 uppercase">Thiếu / Trùng</div>
                  <div className={`text-2xl font-black mt-1 ${manifestResult.missingQuestions.length === 0 && manifestResult.duplicateQuestions.length === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {manifestResult.missingQuestions.length} <span className="text-xs text-slate-400 font-bold">thiếu</span> / {manifestResult.duplicateQuestions.length} <span className="text-xs text-slate-400 font-bold">trùng</span>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs text-center">
                  <div className="text-[11px] font-extrabold text-slate-500 uppercase">Trạng Thái Manifest</div>
                  <div className="mt-1">
                    {manifestResult.isValid ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-900 font-extrabold text-xs rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> SẴN SÀNG KHÓA
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-900 font-extrabold text-xs rounded-full">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-700" /> CẤU TRÚC CHƯA ĐỦ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* DETECTED ERRORS OR WARNINGS */}
              {manifestResult.errors.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs space-y-1.5">
                  <p className="font-extrabold flex items-center gap-1.5 text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    Phát hiện {manifestResult.errors.length} lỗi cấu trúc:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-rose-800 pl-2">
                    {manifestResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* DETECTED SOURCE GROUPS CARDS */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Danh Sách Bài Đọc Phát Hiện Nguồn ({detectedGroups.length} groups)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {detectedGroups.map((g, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border space-y-1.5 transition-all ${
                        g.status === 'complete'
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : 'border-amber-300 bg-amber-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">
                          Q{g.startQuestion}–{g.endQuestion}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                          {g.questionNumbers.length} câu
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate font-mono">{g.sourceHeader}</p>
                      {g.validationError && (
                        <p className="text-[10px] text-rose-700 font-bold mt-1">⚠️ {g.validationError}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. SIDE-BY-SIDE DIFF: SOURCE vs DATABASE COMPARISON & REPAIR PLAN */}
          {repairPlan && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    So Sánh Cấu Trúc Nguồn (Source) vs Cơ Sở Dữ Liệu (Database)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hash hiện tại DB: <code className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{repairPlan.expectedCurrentStructureHash || 'CHƯA CÓ'}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                    Cần di chuyển: <strong className="text-purple-700">{repairPlan.totalMovedQuestions} câu</strong>
                  </span>
                </div>
              </div>

              {/* COMPARISON TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-extrabold">
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">NGUỒN (SOURCE)</th>
                      <th className="py-2.5 px-3 text-center">→</th>
                      <th className="py-2.5 px-3">DATABASE HIỆN TẠI</th>
                      <th className="py-2.5 px-3">PASSAGE TEXT</th>
                      <th className="py-2.5 px-3 text-right">TRẠNG THÁI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {repairPlan.groupComparisons.map((item) => (
                      <tr key={item.order} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-extrabold text-slate-400">#{item.order}</td>
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-slate-900 text-xs">{item.sourceRange}</div>
                          <div className="text-[11px] text-purple-700 font-semibold">{item.sourceDocumentKind}</div>
                        </td>
                        <td className="py-3 px-3 text-center text-slate-400">→</td>
                        <td className="py-3 px-3">
                          {item.dbRange ? (
                            <div>
                              <div className="font-extrabold text-slate-900">{item.dbRange}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                                {item.targetGroupId}
                              </div>
                            </div>
                          ) : (
                            <span className="text-rose-600 font-bold italic">Không khớp UUID</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {item.passageStatus === 'PASSAGE_MATCH' && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-extrabold text-[10px] rounded border border-emerald-200">
                              ✓ PASSAGE MATCH
                            </span>
                          )}
                          {item.passageStatus === 'PASSAGE_DIFFERENT' && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-900 font-extrabold text-[10px] rounded border border-amber-200">
                              ⚠️ KHÁC BÀI ĐỌC
                            </span>
                          )}
                          {item.passageStatus === 'PASSAGE_EMPTY' && (
                            <span className="text-[10px] text-slate-400 font-bold">— TRỐNG</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {item.status === 'MATCH' && (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> MATCH
                            </span>
                          )}
                          {item.status === 'RANGE_MISMATCH' && (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" /> LECH DẢI CÂU
                            </span>
                          )}
                          {item.status === 'MEMBERSHIP_MISMATCH' && (
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-900 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-700" /> SAI THÀNH VIÊN
                            </span>
                          )}
                          {item.status === 'PASSAGE_MISMATCH' && (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" /> CẦN RE-ALIGN
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOVED QUESTIONS DETAIL PREVIEW */}
              {repairPlan.totalMovedQuestions > 0 && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-purple-950 text-xs space-y-2">
                  <p className="font-extrabold text-purple-900 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-purple-700" />
                    Chi tiết {repairPlan.totalMovedQuestions} câu sẽ được di chuyển group_id:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {repairPlan.groupComparisons.flatMap((g) =>
                      g.movedQuestions.map((mq, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-white border border-purple-200 text-purple-900 font-extrabold text-[11px] rounded-lg shadow-2xs"
                        >
                          Q{mq.questionNumber} → Group {g.sourceRange}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {applyError && (
            <div className="p-4 bg-rose-100 border border-rose-300 text-rose-900 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-700 shrink-0" />
              <span>{applyError}</span>
            </div>
          )}

          {applySuccess && (
            <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-extrabold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>{applySuccess}</span>
            </div>
          )}
        </div>

        {/* MODAL FOOTER BAR */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {repairPlan?.blockReason && (
              <span className="font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
                {repairPlan.blockReason}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmApply(true)}
              disabled={!repairPlan || !repairPlan.isApplyAllowed || applying}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>🔒 ÁP DỤNG CẤU TRÚC & KHÓA PART 7</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION DIALOG MODAL */}
      {showConfirmApply && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-xl font-bold">
              🔒
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Xác nhận áp dụng & Khóa Cấu Trúc Part 7?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Hành động này sẽ cập nhật <strong className="text-slate-900">{repairPlan?.totalMovedQuestions} câu hỏi</strong> về đúng group_id theo văn bản nguồn và lưu mã Hash cấu trúc. Nội dung câu hỏi và Answer Key hoàn toàn không bị ảnh hưởng.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmApply(false)}
                disabled={applying}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmApplyLock}
                disabled={applying}
                className="flex-1 py-2.5 bg-emerald-600 text-white font-extrabold text-xs rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                {applying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  'XÁC NHẬN KHÓA'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
