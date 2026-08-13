import React, { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { StagingQuestion } from '../types';

interface QuestionEditorModalProps {
  question: StagingQuestion;
  onSave: (updated: StagingQuestion) => void;
  onClose: () => void;
}

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({ question, onSave, onClose }) => {
  const [formData, setFormData] = useState<StagingQuestion>({ ...question });

  const handleSave = () => {
    onSave({
      ...formData,
      provenance: {
        ...formData.provenance,
        questionTextSource: 'MANUAL',
        optionsSource: 'MANUAL',
        translationSource: 'MANUAL',
      },
      confidence: 1.0,
      status: 'AUTO_OK',
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
              <span>CHỈNH SỬA CÂU Q{formData.questionNumber}</span>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                Part {formData.part}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Nguồn: Page {formData.source.page} ({formData.source.pdf}) • Khung: {formData.groupKey || 'KĐ'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Question Text EN */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 uppercase">
              Văn bản Câu hỏi (Tiếng Anh)
            </label>
            <textarea
              rows={2}
              value={formData.questionText}
              onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
              className="w-full p-3 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Question Text VI */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 uppercase">
              Bản dịch Câu hỏi (Tiếng Việt)
            </label>
            <textarea
              rows={2}
              value={formData.questionVi || ''}
              onChange={(e) => setFormData({ ...formData, questionVi: e.target.value })}
              className="w-full p-3 border border-emerald-300 bg-emerald-50/50 rounded-xl text-sm font-medium text-emerald-950 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Options EN & VI Grid */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <label className="text-xs font-extrabold text-slate-700 uppercase">
              4 Lựa chọn Lời giải (Options A, B, C, D) & Dịch
            </label>

            {(['A', 'B', 'C', 'D'] as const).map((letter) => (
              <div key={letter} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="space-y-1">
                  <span className="text-xs font-black text-indigo-600">Option ({letter}) EN</span>
                  <input
                    type="text"
                    value={formData.options?.[letter] || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        options: { ...formData.options, [letter]: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-black text-emerald-700">Option ({letter}) VI</span>
                  <input
                    type="text"
                    value={formData.optionsVi?.[letter] || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        optionsVi: { ...(formData.optionsVi || {}), [letter]: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-emerald-300 bg-white rounded-lg text-xs font-medium text-emerald-950"
                  />
                </div>
              </div>
            ))}
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
            <span>Lưu câu hỏi (Ghi đè thủ công)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
