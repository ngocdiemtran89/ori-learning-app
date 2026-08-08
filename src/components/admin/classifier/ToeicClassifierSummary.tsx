import React from 'react';
import { ParsedToeicTestDraft } from '../../../lib/toeic/classifier/types';
import { AlertCircle, CheckCircle, Info, FileText } from 'lucide-react';

interface Props {
  draft: ParsedToeicTestDraft;
}

export const ToeicClassifierSummary: React.FC<Props> = ({ draft }) => {
  const s = draft.summary;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className={`p-3 rounded-xl ${s.detectedQuestions === 200 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase">Tổng số câu hỏi</p>
          <p className="text-xl font-extrabold text-slate-900">{s.detectedQuestions} / 200</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className={`p-3 rounded-xl ${s.answersFound === s.detectedQuestions ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          <CheckCircle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase">Đã có đáp án</p>
          <p className="text-xl font-extrabold text-slate-900">{s.answersFound} / {s.detectedQuestions}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className={`p-3 rounded-xl ${s.duplicateNumbers.length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase">Trùng lặp số câu</p>
          <p className="text-xl font-extrabold text-slate-900">{s.duplicateNumbers.length}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className={`p-3 rounded-xl ${draft.issues.filter(i => i.type === 'ERROR').length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
          <Info className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase">Lỗi phân tích</p>
          <p className="text-xl font-extrabold text-slate-900">{draft.issues.filter(i => i.type === 'ERROR').length}</p>
        </div>
      </div>
    </div>
  );
};
