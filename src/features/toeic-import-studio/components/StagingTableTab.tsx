import React, { useState, useMemo } from 'react';
import { Table, Search, Edit3, AlertCircle, CheckCircle2, Filter, Image as ImageIcon, Crop, Eye, Mic, Globe } from 'lucide-react';
import { StagingQuestion, StagingGroup } from '../types';
import { ToeicVisualAssetRegistry } from '../../../lib/toeicPackage/visualAssetTypes';
import { QuestionEditorModal } from './QuestionEditorModal';
import { GroupEditorModal } from './GroupEditorModal';

interface StagingTableTabProps {
  questions: StagingQuestion[];
  groups: StagingGroup[];
  visualAssetsRegistry?: ToeicVisualAssetRegistry;
  onUpdateQuestion: (updated: StagingQuestion) => void;
  onUpdateGroup: (updated: StagingGroup) => void;
  onOpenCropModal?: (ownerKey: string) => void;
}

export const StagingTableTab: React.FC<StagingTableTabProps> = ({
  questions,
  groups,
  visualAssetsRegistry,
  onUpdateQuestion,
  onUpdateGroup,
  onOpenCropModal,
}) => {
  const [filterPart, setFilterPart] = useState<'ALL' | 'LISTENING' | 'READING' | 'REVIEW' | 'ERROR'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingQuestion, setEditingQuestion] = useState<StagingQuestion | null>(null);
  const [editingGroup, setEditingGroup] = useState<StagingGroup | null>(null);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // Part Filter
      if (filterPart === 'LISTENING' && q.part > 4) return false;
      if (filterPart === 'READING' && q.part <= 4) return false;
      if (filterPart === 'REVIEW' && q.status !== 'REVIEW') return false;
      if (filterPart === 'ERROR' && q.status !== 'ERROR') return false;

      // Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQNum = q.questionNumber.toString().includes(query);
        const matchesText = q.questionText.toLowerCase().includes(query);
        const matchesVi = (q.questionVi || '').toLowerCase().includes(query);
        const matchesGroup = (q.groupKey || '').toLowerCase().includes(query);
        return matchesQNum || matchesText || matchesVi || matchesGroup;
      }

      return true;
    });
  }, [questions, filterPart, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Table className="w-5 h-5 text-indigo-600" />
              <span>4. BẢNG DỮ LIỆU TỔNG HỢP (STAGING STORE Q1–200)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Quản lý toàn bộ 200 câu hỏi đề thi TOEIC. Nhấp chọn câu hỏi để chỉnh sửa thủ công.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo số câu (VD: 147)..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Lọc:
          </span>
          {[
            { key: 'ALL', label: `Tất cả (${questions.length})` },
            { key: 'LISTENING', label: `Listening Q1–100 (${questions.filter((q) => q.part <= 4).length})` },
            { key: 'READING', label: `Reading Q101–200 (${questions.filter((q) => q.part > 4).length})` },
            { key: 'REVIEW', label: `Cần xem xét 🟡 (${questions.filter((q) => q.status === 'REVIEW').length})` },
            { key: 'ERROR', label: `Có lỗi 🔴 (${questions.filter((q) => q.status === 'ERROR').length})` },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setFilterPart(item.key as any)}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-colors ${
                filterPart === item.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[650px] custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="py-3.5 px-4 w-16 text-center">Câu</th>
                <th className="py-3.5 px-3 w-16">Part</th>
                <th className="py-3.5 px-3 w-28">Nhóm / Group</th>
                <th className="py-3.5 px-4 min-w-[280px]">Nội dung Câu hỏi EN & VI</th>
                <th className="py-3.5 px-3 min-w-[180px]">Lựa chọn (Options)</th>
                <th className="py-3.5 px-3 w-24 text-center">Nguồn Trang</th>
                <th className="py-3.5 px-3 w-24 text-center">Nguồn Dữ Liệu</th>
                <th className="py-3.5 px-3 w-24 text-center">Trạng Thái</th>
                <th className="py-3.5 px-3 w-20 text-center">Sửa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredQuestions.length > 0 ? (
                filteredQuestions.map((q) => (
                  <tr key={q.questionNumber} className="hover:bg-indigo-50/40 transition-colors group">
                    <td className="py-3 px-4 font-mono font-black text-center text-slate-900 bg-slate-50/50">
                      Q{q.questionNumber}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        P{q.part}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      {q.groupKey ? (
                        <div className="space-y-1">
                          <button
                            onClick={() => {
                              const grp = groups.find((g) => g.groupKey === q.groupKey);
                              if (grp) setEditingGroup(grp);
                            }}
                            className="hover:underline text-indigo-600 font-bold"
                          >
                            {q.groupKey}
                          </button>
                          {['P3-Q62-64', 'P3-Q65-67', 'P3-Q68-70', 'P4-Q95-97', 'P4-Q98-100'].includes(q.groupKey) && (
                            <div className="text-[10px]">
                              {(() => {
                                const asset = visualAssetsRegistry?.get(q.groupKey);
                                const isReady = asset && (asset.blob || asset.previewUrl || asset.status === 'APPROVED');
                                return (
                                  <button
                                    onClick={() => q.groupKey && onOpenCropModal?.(q.groupKey)}
                                    className={`px-1.5 py-0.5 rounded font-extrabold flex items-center gap-1 ${
                                      isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                                    }`}
                                  >
                                    <ImageIcon className="w-3 h-3" />
                                    <span>GRAPHIC {isReady ? '✅' : '🖼'}</span>
                                  </button>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Đơn lẻ</span>
                      )}
                    </td>
                    <td className="py-3 px-4 space-y-1">
                      <div className="font-semibold text-slate-900 line-clamp-2">
                        {q.part === 1 ? (
                          (() => {
                            const assetKey = `Q${q.questionNumber}`;
                            const asset = visualAssetsRegistry?.get(assetKey);
                            const imgUrl = asset?.previewUrl || (asset?.blob ? URL.createObjectURL(asset.blob) : null);
                            return (
                              <div className="flex items-center gap-3">
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={`Part 1 Q${q.questionNumber}`}
                                    className="w-16 h-12 object-cover rounded-lg border border-slate-200 shadow-xs cursor-pointer hover:scale-105 transition-transform"
                                    onClick={() => window.open(imgUrl, '_blank')}
                                  />
                                ) : (
                                  <div className="w-16 h-12 rounded-lg bg-rose-50 border border-rose-200 flex flex-col items-center justify-center text-[10px] font-bold text-rose-600">
                                    <ImageIcon className="w-4 h-4" />
                                    <span>MISSING</span>
                                  </div>
                                )}
                                <div className="space-y-1">
                                  <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                                    <span>Photograph (Q{q.questionNumber})</span>
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                      asset?.status === 'APPROVED' || asset?.status === 'AUTO_EXTRACTED'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {asset?.status || 'MISSING'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {imgUrl && (
                                      <button
                                        onClick={() => window.open(imgUrl, '_blank')}
                                        className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                                      >
                                        <Eye className="w-3 h-3" /> XEM ẢNH
                                      </button>
                                    )}
                                    <button
                                      onClick={() => onOpenCropModal?.(assetKey)}
                                      className="text-[10px] font-bold text-purple-600 hover:underline flex items-center gap-0.5"
                                    >
                                      <Crop className="w-3 h-3" /> CHỈNH CẮT
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        ) : q.part === 2 ? (
                          (q as any).transcript ? (
                            <span className="text-slate-800 font-medium flex items-center gap-1.5">
                              <Mic className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>{(q as any).transcript}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 italic flex items-center gap-1 text-xs">
                              <Mic className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Spoken Prompt (Audio-only)</span>
                            </span>
                          )
                        ) : (
                          q.questionText || <span className="text-slate-400 italic">[Chưa có văn bản câu hỏi]</span>
                        )}
                      </div>
                      {q.questionVi && (
                        <div className="text-slate-500 font-normal text-xs italic flex items-center gap-1 line-clamp-1">
                          <Globe className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{q.questionVi}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[11px] space-y-0.5">
                      {q.part === 1 ? (
                        <span className="text-slate-500 font-mono font-bold">(A) (B) (C) (D) — Spoken audio</span>
                      ) : q.part === 2 ? (
                        (q as any).script_responses ? (
                          <div className="space-y-0.5 text-[10px] text-slate-600">
                            <div>A: {(q as any).script_responses.A}</div>
                            <div>B: {(q as any).script_responses.B}</div>
                            <div>C: {(q as any).script_responses.C}</div>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono font-bold">(A) (B) (C) — Spoken audio</span>
                        )
                      ) : q.options && (q.options.A || q.options.B) ? (
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                          <span>(A) {q.options.A}</span>
                          <span>(B) {q.options.B}</span>
                          <span>(C) {q.options.C}</span>
                          <span>(D) {q.options.D}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">[Audio Listening]</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-500">
                      Page {q.source.page}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          q.provenance.questionTextSource === 'MANUAL'
                            ? 'bg-purple-100 text-purple-800'
                            : q.provenance.questionTextSource === 'CHATGPT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {q.provenance.questionTextSource}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {q.status === 'AUTO_OK' && (
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </span>
                      )}
                      {q.status === 'REVIEW' && (
                        <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> REVIEW
                        </span>
                      )}
                      {q.status === 'ERROR' && (
                        <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> LỖI
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setEditingQuestion(q)}
                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-lg transition-colors"
                        title="Chỉnh sửa câu hỏi"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Không tìm thấy câu hỏi nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modals */}
      {editingQuestion && (
        <QuestionEditorModal
          question={editingQuestion}
          onSave={onUpdateQuestion}
          onClose={() => setEditingQuestion(null)}
        />
      )}

      {editingGroup && (
        <GroupEditorModal
          group={editingGroup}
          onSave={onUpdateGroup}
          onClose={() => setEditingGroup(null)}
        />
      )}
    </div>
  );
};
