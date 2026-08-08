import React, { useState } from 'react';
import { X, Volume2, HelpCircle, FileText, AlertCircle } from 'lucide-react';
import { ListeningQuestionInput } from '../../lib/cms/listeningValidation';

interface ListeningPreviewModalProps {
  title: string;
  level?: string;
  toeic_part?: string;
  audio_url?: string | null;
  transcript?: string | null;
  questions: ListeningQuestionInput[];
  onClose: () => void;
}

export const ListeningPreviewModal: React.FC<ListeningPreviewModalProps> = ({
  title,
  audio_url,
  transcript,
  questions,
  onClose,
}) => {
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState<boolean>(false);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const activeQuestions = questions.filter((q) => q.is_active !== false);

  const handlePlayAudio = () => {
    setAudioError(null);
    if (!audio_url) {
      setAudioError('Chưa có URL âm thanh.');
      return;
    }
    const audio = new Audio(audio_url);
    audio.play().catch(() => {
      setAudioError('Không thể phát audio từ URL này.');
    });
  };

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
      <div className="bg-white w-full max-w-3xl my-8 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-extrabold uppercase border border-purple-200">
              XEM TRƯỚC BÀI NGHE (PREVIEW - KHÔNG LƯU LỊCH SỬ)
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 mt-1">{title || 'Tiêu đề bài nghe'}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audio Player & Controls */}
        <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-2xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handlePlayAudio}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-purple-600/20 inline-flex items-center gap-2 transition-all"
            >
              <Volume2 className="w-4 h-4" /> Nghe Thử Audio
            </button>

            {transcript && (
              <button
                type="button"
                onClick={() => setShowTranscript(!showTranscript)}
                className="px-3.5 py-2 bg-white hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 flex items-center gap-1.5 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>{showTranscript ? 'Ẩn Transcript' : 'Xem Transcript'}</span>
              </button>
            )}
          </div>

          {audioError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{audioError}</span>
            </div>
          )}

          {showTranscript && transcript && (
            <div className="p-3.5 bg-white border border-purple-200 rounded-xl text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line">
              <strong className="block text-[11px] font-extrabold uppercase text-purple-700 mb-1">Transcript:</strong>
              {transcript}
            </div>
          )}
        </div>

        {/* Questions Section */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-purple-600" /> Câu Hỏi Trắc Nghiệm ({activeQuestions.length} câu)
            </h3>
            {showResults && (
              <span className="px-3 py-1 bg-purple-600 text-white font-extrabold text-xs rounded-full">
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
                  {/* Image preview for Part 1 or visual questions */}
                  {q.image_url && (
                    <div className="max-w-xs mx-auto rounded-xl overflow-hidden border border-slate-200 bg-white p-2">
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
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{q.question_text}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(q.options || []).map((opt, optIdx) => {
                      const isOptionSelected = selected === opt;
                      let btnStyle = 'bg-white border-slate-200 text-slate-700 hover:border-purple-400';

                      if (showResults) {
                        if (opt === q.correct_answer) {
                          btnStyle = 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold';
                        } else if (isOptionSelected && !isCorrect) {
                          btnStyle = 'bg-rose-100 border-rose-500 text-rose-900 font-bold';
                        }
                      } else if (isOptionSelected) {
                        btnStyle = 'bg-purple-600 text-white border-purple-600 font-bold';
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
                    <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-900 space-y-0.5">
                      <strong className="block text-[11px] font-extrabold uppercase text-purple-700">Giải thích:</strong>
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
                className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs rounded-xl transition-colors"
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
