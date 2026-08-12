import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Save, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import {
  parsePart7BatchBlock,
  buildPart7GroupPatchPayload,
  Part7GroupDraft,
  Part7DocumentDraft,
  Part7QuestionDraft,
} from '../../lib/cms/part7BatchParser';

import { getPart7StructureStatus } from '../../lib/supabase/studentToeic';

export interface Part7BatchWorkbenchModalProps {
  isOpen: boolean;
  onClose: () => void;
  testId: string;
  testTitle?: string;
  existingGroups: any[];
  existingQuestions: any[];
  initialMode?: 'add' | 'update';
  initialTargetGroupId?: string;
  onUpdated: () => void;
}

export const Part7BatchWorkbenchModal: React.FC<Part7BatchWorkbenchModalProps> = ({
  isOpen,
  onClose,
  testId,
  testTitle,
  existingGroups,
  existingQuestions,
  initialMode = 'add',
  initialTargetGroupId,
  onUpdated,
}) => {
  const [mode, setMode] = useState<'add' | 'update'>(initialMode);
  const [textEn, setTextEn] = useState<string>('');
  const [textVi, setTextVi] = useState<string>('');

  const [parsedDrafts, setParsedDrafts] = useState<Part7GroupDraft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rejectedBlocks, setRejectedBlocks] = useState<string[]>([]);
  const [activeDraftIdx, setActiveDraftIdx] = useState<number | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [saveResults, setSaveResults] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [structStatus, setStructStatus] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    setMode(initialMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setSaveResults({});
    setTextEn('');
    setTextVi('');

    if (testId) {
      getPart7StructureStatus(testId).then((res) => {
        if (res.data) setStructStatus(res.data);
      });
    }

    // If opened for a specific single target group
    if (initialTargetGroupId) {
      const targetG = (existingGroups || []).find(g => g.id === initialTargetGroupId);
      const targetQs = (existingQuestions || []).filter(q => q.group_id === initialTargetGroupId).sort((a, b) => a.question_number - b.question_number);

      if (targetG && targetQs.length > 0) {
        const expectedQNums = targetQs.map(q => q.question_number);
        const rangeLabel = `Q${expectedQNums[0]}–${expectedQNums[expectedQNums.length - 1]}`;

        const docs: Part7DocumentDraft[] = (targetG.documents || []).map((d: any) => ({
          type: d.type || 'single_passage',
          title: d.title || '',
          content: d.content || '',
        }));

        const docsVi: Part7DocumentDraft[] = (targetG.documents_vi || []).map((d: any) => ({
          type: d.type || 'single_passage',
          title: d.title || '',
          content: d.content || '',
        }));

        const qDrafts: Part7QuestionDraft[] = targetQs.map(q => ({
          id: q.id,
          question_number: q.question_number,
          question_text: q.question_text || '',
          translation_vi: q.translation_vi || '',
          options: Array.isArray(q.options) && q.options.length === 4 ? [q.options[0], q.options[1], q.options[2], q.options[3]] : ['', '', '', ''],
          options_vi: Array.isArray(q.options_vi) && q.options_vi.length === 4 ? [q.options_vi[0], q.options_vi[1], q.options_vi[2], q.options_vi[3]] : ['', '', '', ''],
        }));

        const singleDraft: Part7GroupDraft = {
          groupId: targetG.id,
          expectedQuestionNumbers: expectedQNums,
          rangeLabel,
          groupType: docs.length === 2 ? 'double_passage' : docs.length >= 3 ? 'triple_passage' : 'single_passage',
          documents: docs,
          documents_vi: docsVi,
          questions: qDrafts,
          units: targetG.part7_bilingual_units || [],
          isComplete: true,
        };

        setParsedDrafts([singleDraft]);
        setActiveDraftIdx(0);
      }
    } else {
      setParsedDrafts([]);
      setActiveDraftIdx(null);
    }
  }, [isOpen, initialMode, initialTargetGroupId, existingGroups, existingQuestions]);

  if (!isOpen) return null;

  const handleParse = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = parsePart7BatchBlock(textEn, textVi, existingGroups, existingQuestions);
    setParsedDrafts(res.groups);
    setWarnings(res.warnings);
    setRejectedBlocks(res.rejectedBlocks);

    if (res.groups.length > 0) {
      setActiveDraftIdx(0);
    }
  };

  const handleSaveValidGroups = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (structStatus?.status === 'DRIFT') {
      setErrorMsg('❌ Cấu trúc DB đã thay đổi sau khi khóa. Vui lòng quét lại cấu trúc trước khi lưu.');
      return;
    }

    const validDrafts = parsedDrafts.filter(d => d.isComplete);
    if (validDrafts.length === 0) {
      setErrorMsg('Không có bài đọc Part 7 hợp lệ để lưu. Vui lòng phân tích và sửa các lỗi trước khi lưu.');
      return;
    }

    setSaving(true);
    const results: Record<string, { success: boolean; error?: string }> = {};
    let successCount = 0;

    for (const draft of validDrafts) {
      const dbG = existingGroups.find(g => g.id === draft.groupId);
      const dbQs = existingQuestions.filter(q => q.group_id === draft.groupId);

      // Check ADD mode protection: if existing group already has content and mode === 'add'
      const hasExistingContent = dbG && dbG.documents && Array.isArray(dbG.documents) && dbG.documents.length > 0;
      if (mode === 'add' && hasExistingContent && !draft.existingDataWarning) {
        draft.existingDataWarning = true;
        results[draft.groupId] = { success: false, error: `${draft.rangeLabel} đã có dữ liệu. Vui lòng chuyển sang mode CẬP NHẬT hoặc bấm xác nhận.` };
        continue;
      }

      const { payload, hasChanges } = buildPart7GroupPatchPayload(dbG, dbQs, draft);

      if (!hasChanges) {
        results[draft.groupId] = { success: true, error: 'Không có thay đổi.' };
        successCount++;
        continue;
      }

      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_update_toeic_part7_group', {
          p_test_id: testId,
          p_group_id: draft.groupId,
          p_payload: payload,
        });

        if (rpcErr) {
          results[draft.groupId] = { success: false, error: rpcErr.message || 'Lỗi DB RPC' };
        } else if (rpcData && rpcData.success !== true) {
          results[draft.groupId] = { success: false, error: rpcData.error || 'Lỗi lưu nhóm' };
        } else {
          results[draft.groupId] = { success: true };
          successCount++;
        }
      } catch (err: any) {
        results[draft.groupId] = { success: false, error: err.message || 'Lỗi kết nối' };
      }
    }

    setSaveResults(results);
    setSaving(false);

    if (successCount > 0) {
      setSuccessMsg(`Đã lưu thành công ${successCount}/${validDrafts.length} bài đọc Part 7!`);
      onUpdated();
    } else {
      setErrorMsg('Không thể lưu nhóm Part 7 nào. Vui lòng kiểm tra thông báo lỗi.');
    }
  };

  const activeDraft = activeDraftIdx !== null && activeDraftIdx < parsedDrafts.length ? parsedDrafts[activeDraftIdx] : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold flex items-center gap-2">
              <span>✍️ PART 7 BATCH WORKBENCH</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-600 font-bold uppercase tracking-wider">
                {mode === 'add' ? '+ NẠP THÊM NỘI DUNG' : '🔄 CẬP NHẬT NỘI DUNG'}
              </span>
            </h3>
            {testTitle && <p className="text-xs text-slate-400 mt-0.5">{testTitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setMode('add')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  mode === 'add' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                + NẠP THÊM
              </button>
              <button
                type="button"
                onClick={() => setMode('update')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  mode === 'update' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                🔄 CẬP NHẬT
              </button>
            </div>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Structure Gating Banners */}
          {structStatus?.status === 'UNVERIFIED' && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>⚠ Hãy quét và khóa cấu trúc Part 7 trước khi nhập nội dung.</span>
            </div>
          )}
          {structStatus?.status === 'DRIFT' && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>❌ Cấu trúc DB đã thay đổi sau khi khóa. Quét lại trước khi tiếp tục.</span>
            </div>
          )}
          {structStatus?.fallback_message && (
            <div className="p-3 bg-slate-100 border border-slate-200 text-slate-700 rounded-2xl flex items-center gap-2 text-[11px] font-semibold">
              <span>ℹ️ {structStatus.fallback_message}</span>
            </div>
          )}

          {/* Notifications */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-2 font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 font-bold">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl space-y-1 font-medium">
              {warnings.map((w, idx) => (
                <div key={idx}>{w}</div>
              ))}
            </div>
          )}

          {rejectedBlocks.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-1 font-medium">
              {rejectedBlocks.map((r, idx) => (
                <div key={idx}>❌ {r}</div>
              ))}
            </div>
          )}

          {/* Paste Inputs Section */}
          {!initialTargetGroupId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                  <span>🇬🇧 DÁN KHỐI PART 7 TIẾNG ANH</span>
                  <span className="text-[10px] font-normal text-slate-500">(Nhiều bài đọc + câu hỏi)</span>
                </label>
                <textarea
                  value={textEn}
                  onChange={(e) => setTextEn(e.target.value)}
                  placeholder="Dán khối nội dung Tiếng Anh...\nQUESTIONS 147-150\n[EMAIL] Notice...\n\n147. What is...?"
                  rows={8}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                  <span>🇻🇳 DÁN KHỐI PART 7 TIẾNG VIỆT</span>
                  <span className="text-[10px] font-normal text-slate-500">(Bản dịch tương ứng)</span>
                </label>
                <textarea
                  value={textVi}
                  onChange={(e) => setTextVi(e.target.value)}
                  placeholder="Dán khối bản dịch Tiếng Việt...\nCÂU 147-150\n[EMAIL] Thông báo...\n\n147. Mục đích...?"
                  rows={8}
                  className="w-full p-3 bg-emerald-50/50 border border-emerald-200 rounded-2xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          {!initialTargetGroupId && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleParse}
                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-extrabold rounded-xl shadow-md flex items-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" /> PHÂN TÍCH NỘI DUNG BATCH
              </button>
            </div>
          )}

          {/* Parsed Group Drafts List */}
          {parsedDrafts.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-800 uppercase tracking-wider text-xs">
                  PHÁT HIỆN {parsedDrafts.length} BÀI ĐỌC
                </h4>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="text-emerald-700">Hợp lệ: {parsedDrafts.filter(d => d.isComplete).length}</span>
                  <span className="text-rose-600">Lỗi: {parsedDrafts.filter(d => !d.isComplete).length}</span>
                </div>
              </div>

              {/* Group Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {parsedDrafts.map((draft, idx) => {
                  const saveRes = saveResults[draft.groupId];
                  const isActive = activeDraftIdx === idx;

                  return (
                    <div
                      key={draft.groupId || idx}
                      onClick={() => setActiveDraftIdx(idx)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isActive
                          ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-200 shadow-md'
                          : draft.isComplete
                          ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          : 'bg-rose-50/50 border-rose-200 hover:border-rose-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-black text-slate-900 text-sm">{draft.rangeLabel}</span>
                        {draft.isComplete ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                            ✅ HOÀN THIỆN
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[10px]">
                            ⚠️ THIẾU
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-600 space-y-0.5">
                        <div>Passages: {draft.documents.length} | Questions: {draft.questions.length}</div>
                        {saveRes && (
                          <div className={`font-bold ${saveRes.success ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {saveRes.success ? '✓ Đã lưu RPC' : `✕ Lỗi: ${saveRes.error}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Draft Detailed Editor */}
              {activeDraft && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl space-y-4 mt-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                        <span>{activeDraft.rangeLabel}</span>
                        <span className="text-xs font-mono font-normal text-slate-500">ID: {activeDraft.groupId.slice(0, 8)}</span>
                      </h4>
                      {activeDraft.validationError && (
                        <p className="text-xs font-bold text-rose-600 mt-0.5">{activeDraft.validationError}</p>
                      )}
                    </div>
                    <div className="text-xs font-extrabold text-slate-600">
                      Loại bài: {activeDraft.groupType}
                    </div>
                  </div>

                  {/* Documents Section */}
                  <div className="space-y-3">
                    <h5 className="font-black text-slate-700 uppercase tracking-wider text-[11px]">Nội Dung Bài Đọc (Passages)</h5>
                    {activeDraft.documents.map((doc, dIdx) => {
                      const docVi = activeDraft.documents_vi && activeDraft.documents_vi[dIdx];
                      return (
                        <div key={dIdx} className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-500 text-xs">Document #{dIdx + 1}</span>
                            <input
                              type="text"
                              value={doc.title || ''}
                              onChange={(e) => {
                                doc.title = e.target.value;
                                setParsedDrafts([...parsedDrafts]);
                              }}
                              placeholder="Tiêu đề EN (Title)..."
                              className="flex-1 px-3 py-1 bg-slate-50 border rounded-lg text-xs"
                            />
                          </div>

                          <textarea
                            value={doc.content}
                            onChange={(e) => {
                              doc.content = e.target.value;
                              setParsedDrafts([...parsedDrafts]);
                            }}
                            placeholder="Nội dung Tiếng Anh..."
                            rows={3}
                            className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono text-xs"
                          />

                          {docVi && (
                            <textarea
                              value={docVi.content}
                              onChange={(e) => {
                                docVi.content = e.target.value;
                                setParsedDrafts([...parsedDrafts]);
                              }}
                              placeholder="Bản dịch Tiếng Việt..."
                              rows={2}
                              className="w-full p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl font-mono text-xs text-emerald-950"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Questions Section */}
                  <div className="space-y-3 pt-2">
                    <h5 className="font-black text-slate-700 uppercase tracking-wider text-[11px]">Danh Sách Câu Hỏi ({activeDraft.questions.length} câu)</h5>
                    <div className="space-y-3">
                      {activeDraft.questions.map((q) => (
                        <div key={q.question_number} className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2">
                          <div className="font-black text-purple-900 text-xs">Q{q.question_number}</div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={q.question_text}
                              onChange={(e) => {
                                q.question_text = e.target.value;
                                setParsedDrafts([...parsedDrafts]);
                              }}
                              placeholder="Thân câu hỏi EN..."
                              className="px-3 py-1.5 bg-slate-50 border rounded-xl font-bold"
                            />
                            <input
                              type="text"
                              value={q.translation_vi}
                              onChange={(e) => {
                                q.translation_vi = e.target.value;
                                setParsedDrafts([...parsedDrafts]);
                              }}
                              placeholder="Dịch thân câu hỏi VI..."
                              className="px-3 py-1.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-emerald-950"
                            />
                          </div>

                          {/* Options grid */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            {['A', 'B', 'C', 'D'].map((letter, optIdx) => (
                              <div key={letter} className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-500 w-4 text-center">{letter}</span>
                                <input
                                  type="text"
                                  value={q.options[optIdx] || ''}
                                  onChange={(e) => {
                                    q.options[optIdx] = e.target.value;
                                    setParsedDrafts([...parsedDrafts]);
                                  }}
                                  placeholder={`Đáp án ${letter} EN...`}
                                  className="w-full px-2.5 py-1 bg-slate-50 border rounded-lg text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 font-extrabold rounded-xl hover:bg-slate-200 transition-colors"
          >
            Đóng
          </button>

          {parsedDrafts.length > 0 && (
            <button
              type="button"
              disabled={saving || parsedDrafts.filter(d => d.isComplete).length === 0}
              onClick={handleSaveValidGroups}
              className="px-6 py-2.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-md flex items-center gap-2 transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? 'ĐANG LƯU DỮ LIỆU RPC...' : `💾 LƯU ${parsedDrafts.filter(d => d.isComplete).length} BÀI HỢP LỆ`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
