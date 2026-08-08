import React, { useState } from 'react';
import { X, BookOpen, HelpCircle } from 'lucide-react';
import { ReadingQuestionInput } from '../../lib/cms/readingValidation';

interface ReadingPreviewModalProps {
  title: string;
  passage?: string | null;
  questions: ReadingQuestionInput[];
  onClose: () => void;
}

export const ReadingPreviewModal: React.FC<ReadingPreviewModalProps> = ({
  title,
  passage,
  questions,
  onClose,
}) => {
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState<boolean>(false);

  const activeQuestions = questions.filter((q) => q.is_active !== false);

  const handleSelect = (idx: number, opt: string) => {
    if (showResults) return;
    setUserAnswers((prev) => ({ ...prev, [idx]: opt }));
  };

  let correctCount = 0;
  activeQuestions.forEach((q, idx) => {
    if (userAnswers[idx] === q.correct_answer) correctCount++;
  });
  const score = activeQuestions.length > 0 ? Math.round((correctCount / activeQuestions.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl my-8 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase border border-blue-200">
              XEM TRƯỚC BÀI READING (PREVIEW - KHÔNG LƯU LỊCH SỬ)
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 mt-1">{title || 'Tiêu đề bài đọc'}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Passage Display (Safe Plain Text Rendering with pre-wrap) */}
        {passage && passage.trim() && (
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <h3 className="text-xs font-extrabold uppercase text-slate-500 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-600" /> Đoạn Văn Bài Đọc (Reading Passage)
            </h3>
            <div className="text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-wrap font-sans bg-white p-4 rounded-xl border border-slate-100 shadow-2xs max-h-72 overflow-y-auto">
              {passage.trim()}
            </div>
          </div>
        )}

        {/* Questions Section */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" /> Câu Hỏi Trắc Nghiệm ({activeQuestions.length} câu)
            </h3>
            {showResults && (
              <span className="px-3 py-1 bg-blue-600 text-white font-extrabold text-xs rounded-full">
                Điểm xem thử: {score}% ({correctCount}/{activeQuestions.length})
              </span>
            )}
          </div>

          {activeQuestions.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Chưa có câu hỏi trắc nghiệm nào đang hoạt động.</p>
          ) : (
            activeQuestions.map((q, idx) => {
              const selected = userAnswers[idx];
              const isCorrect = selected === q.correct_answer;

              return (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  {/* Optional Image */}
                  {q.image_url && (
                    <div className="max-w-md mx-auto rounded-xl overflow-hidden border border-slate-200 bg-white p-2">
                      <img
                        src={q.image_url}
                        alt={`Question ${idx + 1}`}
                        className="w-full h-auto object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  <div className="font-extrabold text-slate-900 text-xs flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{q.question_text}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(q.options || []).map((opt, optIdx) => {
                      const isOptionSelected = selected === opt;
                      let btnStyle = 'bg-white border-slate-200 text-slate-700 hover:border-blue-400';

                      if (showResults) {
                        if (opt === q.correct_answer) {
                          btnStyle = 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold';
                        } else if (isOptionSelected && !isCorrect) {
                          btnStyle = 'bg-rose-100 border-rose-500 text-rose-900 font-bold';
                        }
                      } else if (isOptionSelected) {
                        btnStyle = 'bg-blue-600 text-white border-blue-600 font-bold';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelect(idx, opt)}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all ${btnStyle}`}
                        >
                          <span className="font-extrabold mr-1.5">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {showResults && q.explanation && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-0.5">
                      <strong className="block text-[11px] font-extrabold uppercase text-blue-700">Giải thích:</strong>
                      <span>{q.explanation}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {activeQuestions.length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowResults(!showResults)}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs rounded-xl transition-colors"
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
