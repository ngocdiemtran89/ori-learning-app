import React, { useState } from 'react';
import { X, FileText, HelpCircle } from 'lucide-react';
import { GrammarSectionInput, GrammarQuizQuestionInput } from '../../lib/cms/grammarValidation';

interface GrammarPreviewModalProps {
  title: string;
  summary?: string;
  level?: string;
  sections: GrammarSectionInput[];
  quiz: GrammarQuizQuestionInput[];
  onClose: () => void;
}

export const GrammarPreviewModal: React.FC<GrammarPreviewModalProps> = ({
  title,
  summary,
  sections,
  quiz,
  onClose,
}) => {
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState<boolean>(false);

  const activeQuiz = quiz.filter((q) => q.is_active !== false);

  const handleSelect = (idx: number, opt: string) => {
    if (showResults) return;
    setUserAnswers((prev) => ({ ...prev, [idx]: opt }));
  };

  let correctCount = 0;
  activeQuiz.forEach((q, idx) => {
    if (userAnswers[idx] === q.answer) correctCount++;
  });
  const score = activeQuiz.length > 0 ? Math.round((correctCount / activeQuiz.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl my-8 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase border border-indigo-200">
              XEM TRƯỚC BÀI GIẢNG (PREVIEW - KHÔNG LƯU LỊCH SỬ)
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 mt-1">{title || 'Tiêu đề bài học'}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {summary && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700">
            <strong>Tóm tắt:</strong> {summary}
          </div>
        )}

        {/* Theory Sections */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <FileText className="w-4 h-4 text-indigo-600" /> Lý Thuyết Chuyên Đề ({sections.length} phần)
          </h3>

          {sections.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Chưa có phần lý thuyết nào.</p>
          ) : (
            sections.map((sec, idx) => (
              <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                <h4 className="font-extrabold text-slate-900 text-sm">{sec.heading || `Phần ${idx + 1}`}</h4>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{sec.body}</p>

                {sec.examples && sec.examples.length > 0 && (
                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-indigo-700 block">Ví Dụ Minh Họa:</span>
                    <ul className="list-disc list-inside text-xs text-indigo-950 space-y-0.5 italic">
                      {sec.examples.map((ex, exIdx) => (
                        <li key={exIdx}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Quiz Section */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" /> Bài Tập Trắc Nghiệm ({activeQuiz.length} câu hoạt động)
            </h3>
            {showResults && (
              <span className="px-3 py-1 bg-indigo-600 text-white font-extrabold text-xs rounded-full">
                Điểm xem thử: {score}% ({correctCount}/{activeQuiz.length})
              </span>
            )}
          </div>

          {activeQuiz.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Chưa có câu hỏi trắc nghiệm nào đang hoạt động.</p>
          ) : (
            activeQuiz.map((q, idx) => {
              const selected = userAnswers[idx];
              const isCorrect = selected === q.answer;

              return (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="font-extrabold text-slate-900 text-xs flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{q.question}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(q.options || []).map((opt, optIdx) => {
                      const isOptionSelected = selected === opt;
                      let btnStyle = 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400';

                      if (showResults) {
                        if (opt === q.answer) {
                          btnStyle = 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold';
                        } else if (isOptionSelected && !isCorrect) {
                          btnStyle = 'bg-rose-100 border-rose-500 text-rose-900 font-bold';
                        }
                      } else if (isOptionSelected) {
                        btnStyle = 'bg-indigo-600 text-white border-indigo-600 font-bold';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelect(idx, opt)}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all ${btnStyle}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {showResults && q.explanation && (
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 space-y-0.5">
                      <strong className="block text-[11px] font-extrabold uppercase text-indigo-700">Giải thích:</strong>
                      <span>{q.explanation}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {activeQuiz.length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowResults(!showResults)}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl transition-colors"
              >
                {showResults ? 'Ẩn Đáp Án Xem Thử' : 'Kiểm Tra Đáp Án Xem Thử'}
              </button>

              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Đóng Xem Trước
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
