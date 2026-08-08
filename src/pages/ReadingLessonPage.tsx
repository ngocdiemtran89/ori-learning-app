import React, { useEffect, useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  Send,
  FileText,
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

export const ReadingLessonPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user } = useAuth();

  const [lesson, setLesson] = useState<LearningLesson | null>(null);
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Quiz state
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [scoreResult, setScoreResult] = useState<{ score: number; correct: number; total: number } | null>(null);

  useEffect(() => {
    async function loadReadingLesson() {
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
      setLoading(false);
    }
    loadReadingLesson();
  }, [lessonId]);

  if (loading) {
    return <LoadingState message="Đang tải bài luyện đọc từ Supabase..." />;
  }

  if (!lesson) {
    return (
      <div className="space-y-6">
        <NavLink
          to="/reading"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách Luyện đọc
        </NavLink>
        <EmptyState
          title="Không tìm thấy bài luyện đọc"
          description="Bài đọc này hiện chưa xuất bản hoặc tài khoản của bạn chưa được cấp quyền."
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
      await recordQuizAttempt(user.id, 'reading', lesson.id, finalScore, correctCount, totalCount, userAnswers);
      await updateUserProgress(user.id, 'reading', lesson.id, 'completed', finalScore);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back Link & Header */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/reading"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Danh sách Luyện đọc
        </NavLink>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold uppercase">
          {lesson.toeic_part ? `Part ${lesson.toeic_part.replace('part', '')}` : 'Reading'}
        </span>
      </div>

      {/* Lesson Passage Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{lesson.title}</h1>
          <p className="text-xs text-slate-500 mt-1">Trình độ: {lesson.level}</p>
        </div>

        {/* Passage Box */}
        {lesson.passage && (
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" /> Văn Bản Bài Đọc (Passage)
            </h3>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono leading-relaxed text-slate-800 whitespace-pre-line">
              {lesson.passage}
            </div>
          </div>
        )}

        {/* Questions Section */}
        {questions.length > 0 && (
          <div className="space-y-6 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-600" />
                Câu Hỏi Đọc Hiểu ({questions.length} câu)
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
                        : 'bg-emerald-50/30 border-emerald-100'
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

                        let optBtnStyle = 'bg-white border-slate-200 text-slate-800 hover:border-emerald-400';
                        if (isSubmitted) {
                          if (isAnswerOption) {
                            optBtnStyle = 'bg-emerald-500 text-white border-emerald-600 font-bold';
                          } else if (isWrongSelection) {
                            optBtnStyle = 'bg-rose-500 text-white border-rose-600 font-bold';
                          } else {
                            optBtnStyle = 'bg-slate-100 border-slate-200 text-slate-400 opacity-60';
                          }
                        } else if (isSelected) {
                          optBtnStyle = 'bg-emerald-600 text-white border-emerald-600 shadow-md';
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
                        <strong className="text-emerald-700">Giải thích:</strong> {q.explanation}
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
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <Send className="w-4 h-4" /> Nộp Bài Luyện Đọc & Xem Kết Quả
              </button>
            ) : (
              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-emerald-700 font-extrabold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Đã hoàn thành và lưu tiến độ học tập!
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
