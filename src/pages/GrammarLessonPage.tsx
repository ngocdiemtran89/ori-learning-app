import React, { useEffect, useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  HelpCircle,
  CheckCircle2,
  XCircle,
  BookOpen,
  Award,
  ArrowRight,
  Send,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GrammarLesson } from '../lib/supabase/types';
import {
  getGrammarLessonBySlug,
  getGrammarLessons,
  recordQuizAttempt,
  recordQuestionAttempts,
  updateUserProgress,
  GrammarLessonContent,
  QuizQuestionItem,
} from '../lib/supabase/grammar';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';

export const GrammarLessonPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user } = useAuth();

  const [lesson, setLesson] = useState<GrammarLesson | null>(null);
  const [allLessons, setAllLessons] = useState<GrammarLesson[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Quiz state
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [scoreResult, setScoreResult] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  useEffect(() => {
    async function loadLessonData() {
      if (!lessonId) return;

      setLoading(true);
      setFetchError(null);

      const res = await getGrammarLessonBySlug(lessonId);
      const lessonsList = await getGrammarLessons();

      if (res.error) {
        setFetchError(res.error);
        setLesson(null);
      } else {
        setLesson(res.data);
      }

      setAllLessons(lessonsList);
      setUserAnswers({});
      setIsSubmitted(false);
      setScoreResult(null);
      setLoading(false);
    }
    loadLessonData();
  }, [lessonId]);

  if (loading) {
    return <LoadingState message="Đang tải bài học ngữ pháp từ Supabase..." />;
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <NavLink
          to="/grammar"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách Ngữ pháp
        </NavLink>
        <EmptyState
          title="Không thể tải bài học"
          description={fetchError}
        />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="space-y-6">
        <NavLink
          to="/grammar"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách Ngữ pháp
        </NavLink>
        <EmptyState
          title="Không tìm thấy bài học ngữ pháp"
          description="Bài học này hiện không tồn tại hoặc tài khoản của bạn chưa được cấp quyền."
        />
      </div>
    );
  }

  const content = (lesson.lesson_content as unknown as GrammarLessonContent) || {};
  const sections = content.sections || [];
  const quiz = content.quiz || [];

  const handleSelectAnswer = (qIndex: number, optionValue: string) => {
    if (isSubmitted) return; // Lock after submission
    setUserAnswers((prev) => ({
      ...prev,
      [qIndex]: optionValue,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (isSubmitted || isSubmitting || quiz.length === 0) return;

    setIsSubmitting(true);
    setSyncWarning(null);

    let correctCount = 0;
    quiz.forEach((q, idx) => {
      if (userAnswers[idx] === q.answer) {
        correctCount++;
      }
    });

    const totalCount = quiz.length;
    const finalScore = Math.round((correctCount / totalCount) * 100);

    setScoreResult({ score: finalScore, correct: correctCount, total: totalCount });
    setIsSubmitted(true);

    if (user?.id) {
      const attemptRes = await recordQuizAttempt(
        user.id,
        'grammar',
        lesson.id,
        finalScore,
        correctCount,
        totalCount,
        userAnswers
      );

      if (attemptRes.attemptId) {
        const qAttempts = quiz.map((q: QuizQuestionItem, idx: number) => {
          const selected = userAnswers[idx] || null;
          return {
            attempt_id: attemptRes.attemptId!,
            user_id: user.id,
            content_type: 'grammar' as const,
            content_id: lesson.id,
            question_key: `grammar:${lesson.id}:${idx}`,
            question_index: idx,
            question_text: q.question,
            selected_answer: selected,
            correct_answer: q.answer,
            is_correct: selected === q.answer,
            explanation: q.explanation || null,
            skill_tag: lesson.title,
            toeic_part: 'part5',
          };
        });

        const qRes = await recordQuestionAttempts(qAttempts);
        if (!qRes.success) {
          setSyncWarning('Kết quả bài tập đã lưu, nhưng chi tiết câu sai chưa được ghi nhận vào Sổ lỗi sai.');
        }
      }

      await updateUserProgress(user.id, 'grammar', lesson.id, 'completed', finalScore);
    }
    setIsSubmitting(false);
  };

  // Find next lesson slug
  const currentIdx = allLessons.findIndex((l) => l.id === lesson.id);
  const nextLesson = currentIdx !== -1 && currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back Link & Header */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/grammar"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Danh sách Chuyên đề Ngữ pháp
        </NavLink>
        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase">
          {lesson.level}
        </span>
      </div>

      {/* Main Lesson Content Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {lesson.title}
          </h1>
          {lesson.summary && <p className="text-sm text-slate-500 mt-2">{lesson.summary}</p>}
        </div>

        {/* Structured Lesson Sections */}
        {sections.length > 0 && (
          <div className="space-y-6 pt-4 border-t border-slate-100">
            {sections.map((sec, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="text-base font-extrabold text-indigo-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  {sec.heading}
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {sec.body}
                </p>

                {sec.examples && sec.examples.length > 0 && (
                  <div className="space-y-1 pl-3 border-l-2 border-indigo-400 text-xs text-slate-600 italic">
                    <span className="font-bold text-indigo-700 not-italic">Ví dụ minh họa:</span>
                    {sec.examples.map((ex, exIdx) => (
                      <p key={exIdx}>• {ex}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Embedded Quiz Section */}
        {quiz.length > 0 && (
          <div className="pt-6 border-t border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                Bài Tập Thực Hành Trắc Nghiệm ({quiz.length} câu)
              </h2>
              {scoreResult && (
                <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-xs rounded-full flex items-center gap-1.5">
                  <Award className="w-4 h-4" /> Kết quả: {scoreResult.correct}/{scoreResult.total} câu ({scoreResult.score}đ)
                </div>
              )}
            </div>

            <div className="space-y-6">
              {quiz.map((q: QuizQuestionItem, qIdx: number) => {
                const selectedOption = userAnswers[qIdx];
                const isCorrect = isSubmitted && selectedOption === q.answer;

                return (
                  <div
                    key={qIdx}
                    className={`p-5 rounded-2xl border transition-all ${
                      isSubmitted
                        ? isCorrect
                          ? 'bg-emerald-50/50 border-emerald-300'
                          : 'bg-rose-50/50 border-rose-300'
                        : 'bg-indigo-50/30 border-indigo-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="font-bold text-slate-900 text-sm">
                        Câu {qIdx + 1}: {q.question}
                      </p>
                      {isSubmitted &&
                        (isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold">
                      {q.options.map((opt: string, optIdx: number) => {
                        const isSelected = selectedOption === opt;
                        const isAnswerOption = isSubmitted && opt === q.answer;
                        const isWrongSelection = isSubmitted && isSelected && opt !== q.answer;

                        let optBtnStyle = 'bg-white border-slate-200 text-slate-800 hover:border-indigo-400';
                        if (isSubmitted) {
                          if (isAnswerOption) {
                            optBtnStyle = 'bg-emerald-500 text-white border-emerald-600 font-bold';
                          } else if (isWrongSelection) {
                            optBtnStyle = 'bg-rose-500 text-white border-rose-600 font-bold';
                          } else {
                            optBtnStyle = 'bg-slate-100 border-slate-200 text-slate-400 opacity-60';
                          }
                        } else if (isSelected) {
                          optBtnStyle = 'bg-indigo-600 text-white border-indigo-600 shadow-md';
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

                    {/* Explanation Reveal After Submission */}
                    {isSubmitted && q.explanation && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-700">
                        <strong className="text-indigo-700">Giải thích chi tiết:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quiz Action Buttons */}
            {syncWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl">
                ⚠️ {syncWarning}
              </div>
            )}

            {!isSubmitted ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={isSubmitting || Object.keys(userAnswers).length === 0}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <Send className="w-4 h-4" /> {isSubmitting ? 'Đang nộp bài...' : 'Nộp Bài Tập & Chấm Điểm'}
              </button>
            ) : (
              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-emerald-700 font-extrabold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Đã lưu kết quả bài tập thành công!
                </span>

                {nextLesson && (
                  <NavLink
                    to={`/grammar/${nextLesson.slug}`}
                    className="px-4 py-2.5 bg-ori-600 hover:bg-ori-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                  >
                    <span>Học tiếp chuyên đề sau</span>
                    <ArrowRight className="w-4 h-4" />
                  </NavLink>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
