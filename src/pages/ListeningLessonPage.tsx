import React, { useEffect, useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  Send,
  Lock,
  Volume2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LearningLesson } from '../lib/supabase/types';
import {
  getLearningLessonBySlug,
  getLessonQuestions,
  LessonQuestion,
} from '../lib/supabase/learning';
import { recordQuizAttempt, updateUserProgress } from '../lib/supabase/grammar';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';

export const ListeningLessonPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user } = useAuth();

  const [lesson, setLesson] = useState<LearningLesson | null>(null);
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Quiz state
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [scoreResult, setScoreResult] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);

  useEffect(() => {
    async function loadListeningLesson() {
      if (!lessonId) return;

      setLoading(true);
      const lessonData = await getLearningLessonBySlug(lessonId);
      setLesson(lessonData);

      if (lessonData) {
        const qData = await getLessonQuestions(lessonData.id);
        setQuestions(qData);
      }

      setUserAnswers({});
      setIsSubmitted(false);
      setScoreResult(null);
      setShowTranscript(false);
      setLoading(false);
    }
    loadListeningLesson();
  }, [lessonId]);

  if (loading) {
    return <LoadingState message="Đang tải bài luyện nghe từ Supabase..." />;
  }

  if (!lesson) {
    return (
      <div className="space-y-6">
        <NavLink
          to="/listening"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-purple-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách Luyện nghe
        </NavLink>
        <EmptyState
          title="Không tìm thấy bài luyện nghe"
          description="Bài nghe này hiện chưa xuất bản hoặc tài khoản của bạn chưa được cấp quyền."
        />
      </div>
    );
  }

  const handleSelectAnswer = (qIndex: number, optionValue: string) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [qIndex]: optionValue,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (isSubmitted || questions.length === 0) return;

    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correct_answer) {
        correctCount++;
      }
    });

    const totalCount = questions.length;
    const finalScore = Math.round((correctCount / totalCount) * 100);

    setScoreResult({ score: finalScore, correct: correctCount, total: totalCount });
    setIsSubmitted(true);

    if (user?.id) {
      await recordQuizAttempt(user.id, 'listening', lesson.id, finalScore, correctCount, totalCount, userAnswers);
      await updateUserProgress(user.id, 'listening', lesson.id, 'completed', finalScore);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back Link & Header */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/listening"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-purple-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Danh sách Luyện nghe
        </NavLink>
        <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-bold uppercase">
          {lesson.toeic_part ? `Part ${lesson.toeic_part.replace('part', '')}` : 'Listening'}
        </span>
      </div>

      {/* Lesson Title Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{lesson.title}</h1>
          <p className="text-xs text-slate-500 mt-1">Trình độ: {lesson.level}</p>
        </div>

        {/* Audio Player Component (Rendered only when audio_url exists or fallback audio notice) */}
        {lesson.audio_url ? (
          <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center gap-4 shadow-lg">
            <audio controls src={lesson.audio_url} className="w-full">
              Trình duyệt của bạn không hỗ trợ phát Audio.
            </audio>
          </div>
        ) : (
          <div className="bg-purple-950 text-white p-5 rounded-2xl flex items-center gap-4 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
              <Volume2 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-purple-200">Audio Luyện Nghe Mô Phỏng (Demo Audio)</div>
              <p className="text-xs text-purple-300">
                Vui lòng lắng nghe câu hỏi và lựa chọn phương án bên dưới.
              </p>
            </div>
          </div>
        )}

        {/* Questions Section */}
        {questions.length > 0 ? (
          <div className="space-y-6 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-600" />
                Câu Hỏi Luyện Nghe ({questions.length} câu)
              </h2>
              {scoreResult && (
                <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-xs rounded-full flex items-center gap-1.5">
                  <Award className="w-4 h-4" /> Kết quả: {scoreResult.correct}/{scoreResult.total} câu ({scoreResult.score}đ)
                </div>
              )}
            </div>

            <div className="space-y-6">
              {questions.map((q, qIdx) => {
                const selectedOption = userAnswers[qIdx];
                const isCorrect = isSubmitted && selectedOption === q.correct_answer;

                return (
                  <div
                    key={q.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isSubmitted
                        ? isCorrect
                          ? 'bg-emerald-50/50 border-emerald-300'
                          : 'bg-rose-50/50 border-rose-300'
                        : 'bg-purple-50/30 border-purple-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="font-bold text-slate-900 text-sm">
                        Câu {qIdx + 1}: {q.question_text}
                      </p>
                      {isSubmitted &&
                        (isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold">
                      {(q.options as string[]).map((opt, optIdx) => {
                        const isSelected = selectedOption === opt;
                        const isAnswerOption = isSubmitted && opt === q.correct_answer;
                        const isWrongSelection = isSubmitted && isSelected && opt !== q.correct_answer;

                        let optBtnStyle = 'bg-white border-slate-200 text-slate-800 hover:border-purple-400';
                        if (isSubmitted) {
                          if (isAnswerOption) {
                            optBtnStyle = 'bg-emerald-500 text-white border-emerald-600 font-bold';
                          } else if (isWrongSelection) {
                            optBtnStyle = 'bg-rose-500 text-white border-rose-600 font-bold';
                          } else {
                            optBtnStyle = 'bg-slate-100 border-slate-200 text-slate-400 opacity-60';
                          }
                        } else if (isSelected) {
                          optBtnStyle = 'bg-purple-600 text-white border-purple-600 shadow-md';
                        }

                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleSelectAnswer(qIdx, opt)}
                            disabled={isSubmitted}
                            className={`p-3 rounded-xl border text-left transition-all ${optBtnStyle}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {isSubmitted && q.explanation && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-700">
                        <strong className="text-purple-700">Giải thích:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!isSubmitted ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={Object.keys(userAnswers).length === 0}
                className="w-full py-3.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <Send className="w-4 h-4" /> Nộp Bài Luyện Nghe & Xem Điểm Số
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Transcript Section (Revealed ONLY after submission as requested) */}
        {lesson.transcript && (
          <div className="pt-6 border-t border-slate-200">
            {!isSubmitted ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-800 font-medium">
                <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Transcript dịch nghĩa sẽ tự động mở sau khi bạn hoàn thành và nộp bài nghe.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="w-full p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-extrabold text-xs rounded-xl flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    Transcript Nội Dung Bài Nghe & Dịch Nghĩa
                  </span>
                  <span>{showTranscript ? 'Ẩn Transcript ▲' : 'Xem Transcript ▼'}</span>
                </button>

                {showTranscript && (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono leading-relaxed text-slate-800 space-y-2">
                    <p className="font-bold text-purple-900 not-mono">Transcript Chi Tiết:</p>
                    <p className="whitespace-pre-line">{lesson.transcript}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
