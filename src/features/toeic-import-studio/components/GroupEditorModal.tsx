import React, { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { StagingGroup } from '../types';

interface GroupEditorModalProps {
  group: StagingGroup;
  onSave: (updated: StagingGroup) => void;
  onClose: () => void;
}

export const GroupEditorModal: React.FC<GroupEditorModalProps> = ({ group, onSave, onClose }) => {
  const [formData, setFormData] = useState<StagingGroup>({ ...group });

  const handleSave = () => {
    onSave({
      ...formData,
      provenance: 'MANUAL',
      confidence: 1.0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span>CHỈNH SỬA NHÓM/BÀI ĐỌC ({formData.groupKey})</span>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                Part {formData.part}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Phạm vi: Q{formData.startQuestion}–{formData.endQuestion}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Question Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-700 uppercase">Câu Bắt đầu</label>
              <input
                type="number"
                value={formData.startQuestion}
                onChange={(e) => setFormData({ ...formData, startQuestion: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-700 uppercase">Câu Kết thúc</label>
              <input
                type="number"
                value={formData.endQuestion}
                onChange={(e) => setFormData({ ...formData, endQuestion: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold"
              />
            </div>
          </div>

          {/* Instruction */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 uppercase">Tiêu đề nhóm / Instruction</label>
            <input
              type="text"
              value={formData.instruction || ''}
              onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium"
              placeholder="Questions 147-148 refer to the following email."
            />
          </div>

          {/* Passage EN */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 uppercase">Nội dung bài đọc (Passage EN)</label>
            <textarea
              rows={6}
              value={formData.passage || ''}
              onChange={(e) => setFormData({ ...formData, passage: e.target.value })}
              className="w-full p-3 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          {/* Passage VI */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 uppercase">Bản dịch bài đọc (Passage VI)</label>
            <textarea
              rows={4}
              value={formData.passageVi || ''}
              onChange={(e) => setFormData({ ...formData, passageVi: e.target.value })}
              className="w-full p-3 border border-emerald-300 bg-emerald-50/50 rounded-xl text-sm font-medium text-emerald-950 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl shadow-sm inline-flex items-center gap-1.5 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Lưu nhóm bài đọc</span>
          </button>
        </div>
      </div>
    </div>
  );
};
