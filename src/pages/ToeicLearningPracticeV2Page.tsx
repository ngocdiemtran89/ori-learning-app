// ============================================================
// ORI TOEIC Website V2 — Student Practice Page
// ============================================================

import React, { useEffect, useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, BookOpen, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { ListeningMedia } from '../components/toeic/ListeningMedia';
import { PassageDisplay } from '../components/toeic/PassageDisplay';

interface PracticeQuestion {
  question_id: string;
  test_id: string;
  question_number: number;
  part: string;
  question_text: string | null;
  options: string[] | Record<string, string>;
  audio_url: string | null;
  image_url: string | null;
  group_title: string | null;
  group_passage: string | null;
  documents: any[];
}

interface AnswerResult {
  is_correct: boolean;
  correct_answer: string;
  explanation: string | null;
  transcript: string | null;
}

export const ToeicLearningPracticeV2Page: React.FC = () => {
  const { kind, key } = useParams<{ kind: string; key: string }>();
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuestions() {
      if (!key) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcErr } = await supabase.rpc('student_get_safe_v2_practice_questions', {
          p_kind: kind || 'vocabulary',
          p_item_key: key,
        });

        if (rpcErr) {
          setError(`Lỗi tải câu hỏi: ${rpcErr.message}`);
        } else if (data) {
          setQuestions(data);
        }
      } catch (err: any) {
        setError(err.message || 'Có lỗi xảy ra khi kết nối server.');
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [kind, key]);

  const currentQ = questions[currentIndex];

  const handleSelectOption = async (optionLabel: string) => {
    if (result || checking || !currentQ || !key) return;
    setSelectedOption(optionLabel);
    setChecking(true);

    try {
      const { data, error: rpcErr } = await supabase.rpc('student_check_v2_practice_answer', {
        p_question_id: currentQ.question_id,
        p_item_key: key,
        p_selected_option: optionLabel,
      });

      if (rpcErr) {
        setError(`Lỗi kiểm tra đáp án: ${rpcErr.message}`);
      } else if (data && data.success) {
        setResult({
          is_correct: data.is_correct,
          correct_answer: data.correct_answer,
          explanation: data.explanation,
          transcript: data.transcript,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi gửi câu trả lời.');
    } finally {
      setChecking(false);
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setResult(null);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-sm">Đang tải câu hỏi luyện tập...</div>;
  }

  if (error || questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-4 my-8">
        <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Chưa có câu hỏi luyện tập nào</h2>
        <p className="text-xs text-slate-500">{error || 'Chưa có câu hỏi nào được duyệt cho chủ điểm kiến thức này.'}</p>
        <NavLink
          to="/toeic/learn"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-ori-600 text-white rounded-xl font-bold text-xs"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại thư viện kiến thức
        </NavLink>
      </div>
    );
  }

  // Formatting options array
  const rawOptions = currentQ.options;
  let optionList: { label: string; text: string }[] = [];

  if (Array.isArray(rawOptions)) {
    optionList = rawOptions.map((opt, idx) => {
      const defaultLabel = String.fromCharCode(65 + idx);
      const str = String(opt || '').trim();
      const match = str.match(/^\(?([A-D])\)?[\.\:\s\)\-]+(.*)$/i);
      if (match) {
        return { label: match[1].toUpperCase(), text: match[2].trim() };
      }
      return { label: defaultLabel, text: str };
    });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/toeic/learn"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Thư viện kiến thức V2
        </NavLink>
        <span className="text-xs font-extrabold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
          Câu {currentIndex + 1} / {questions.length}
        </span>
      </div>

      {/* Main Practice Container */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        {/* Passage / Audio Display */}
        {(currentQ.audio_url || currentQ.group_passage || currentQ.documents?.length > 0) && (
          <div className="space-y-4 pb-6 border-b border-slate-100">
            {currentQ.audio_url && (
              <ListeningMedia
                audioUrl={currentQ.audio_url}
                imageUrl={currentQ.image_url}
                part={currentQ.part}
              />
            )}
            {currentQ.group_passage && (
              <PassageDisplay
                group={{
                  id: 'grp_practice',
                  test_id: currentQ.test_id,
                  part: currentQ.part,
                  group_type: currentQ.part.toLowerCase(),
                  title: currentQ.group_title,
                  passage: currentQ.group_passage,
                  documents: currentQ.documents || [],
                  created_at: '',
                  updated_at: '',
                  sort_order: 0,
                  is_active: true,
                } as any}
                isPartMode={true}
              />
            )}
          </div>
        )}

        {/* Question Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-ori-600 text-white font-extrabold text-xs rounded-xl shadow-xs">
              Câu #{currentQ.question_number}
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl uppercase">
              Part {currentQ.part}
            </span>
          </div>

          {currentQ.question_text && (
            <h3 className="text-base font-extrabold text-slate-900 leading-relaxed">
              {currentQ.question_text}
            </h3>
          )}

          {currentQ.image_url && (
            <img
              src={currentQ.image_url}
              alt={`Hình ảnh câu ${currentQ.question_number}`}
              className="max-h-72 object-contain rounded-2xl border border-slate-200"
            />
          )}
        </div>

        {/* Options List */}
        <div className="space-y-3 pt-2">
          {optionList.map((opt) => {
            const isSelected = selectedOption === opt.label;
            const isCorrect = result?.correct_answer === opt.label;
            const isWrong = result && isSelected && !isCorrect;

            let btnClass = 'bg-slate-50 border-slate-200 hover:border-ori-500 hover:bg-ori-50/50 text-slate-800';
            if (result) {
              if (isCorrect) {
                btnClass = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-extrabold';
              } else if (isWrong) {
                btnClass = 'bg-rose-50 border-rose-500 text-rose-900 font-extrabold';
              } else {
                btnClass = 'bg-slate-50 border-slate-100 opacity-60 text-slate-400';
              }
            }

            return (
              <button
                key={opt.label}
                onClick={() => handleSelectOption(opt.label)}
                disabled={!!result || checking}
                className={`w-full p-4 rounded-2xl border text-left text-sm font-semibold transition-all flex items-start justify-between gap-3 ${btnClass}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isCorrect
                        ? 'bg-emerald-600 text-white'
                        : isWrong
                        ? 'bg-rose-600 text-white'
                        : isSelected
                        ? 'bg-ori-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="pt-0.5">{opt.text}</span>
                </div>

                {result && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                {result && isWrong && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Result Explanation Panel */}
        {result && (
          <div
            className={`p-6 rounded-2xl border space-y-3 ${
              result.is_correct ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-extrabold text-sm">
              {result.is_correct ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-emerald-800">Chính xác! Đáp án đúng là ({result.correct_answer})</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <span className="text-rose-800">Chưa chính xác. Đáp án đúng là ({result.correct_answer})</span>
                </>
              )}
            </div>

            {result.explanation && (
              <div className="text-xs text-slate-700 space-y-1">
                <strong className="block text-slate-900">Giải thích chi tiết:</strong>
                <p className="leading-relaxed">{result.explanation}</p>
              </div>
            )}

            {result.transcript && (
              <div className="text-xs text-slate-700 space-y-1 pt-2 border-t border-slate-200/50">
                <strong className="block text-slate-900">Transcript bài nghe:</strong>
                <p className="italic bg-white/60 p-3 rounded-xl border border-slate-200/40 leading-relaxed">
                  {result.transcript}
                </p>
              </div>
            )}

            {/* Next Button */}
            {currentIndex < questions.length - 1 && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleNextQuestion}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md"
                >
                  Câu tiếp theo <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
