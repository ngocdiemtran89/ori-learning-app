import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, LogOut, ChevronLeft, ChevronRight, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { startOrResumeTest, fetchTestContent, fetchAttemptAnswers, saveAnswer, updateAttemptProgress, fetchMyAttempt } from '../lib/supabase/studentToeic';
import type { StudentToeicTestContent, StudentToeicGroup, ToeicTestAttempt } from '../lib/supabase/types';
import { QuestionDisplay } from '../components/toeic/QuestionDisplay';
import { QuestionNavigator } from '../components/toeic/QuestionNavigator';
import { TestTimer } from '../components/toeic/TestTimer';
import { PassageDisplay } from '../components/toeic/PassageDisplay';
import { ListeningMedia } from '../components/toeic/ListeningMedia';

export const ToeicTestRunnerPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  // Core state
  const [content, setContent] = useState<StudentToeicTestContent | null>(null);
  const [attempt, setAttempt] = useState<ToeicTestAttempt | null>(null);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map()); // questionId -> answer
  const [currentQ, setCurrentQ] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(true);
  const [timeExpired, setTimeExpired] = useState(false);

  // Load test content and attempt
  useEffect(() => {
    if (!testId) return;
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      try {
        // 1. Start or resume attempt
        const attemptRes = await startOrResumeTest(testId);
        if (attemptRes.error) {
          setError(attemptRes.error);
          setLoading(false);
          return;
        }

        // 2. Get attempt details
        const myAttempt = await fetchMyAttempt(testId);
        if (cancelled) return;
        if (myAttempt.data) {
          setAttempt(myAttempt.data);
          setCurrentQ(myAttempt.data.current_question_number || 1);
        }

        // 3. Get test content (secure — no correct_answer/explanation)
        const contentRes = await fetchTestContent(testId);
        if (cancelled) return;
        if (contentRes.error) {
          setError(contentRes.error);
          setLoading(false);
          return;
        }
        setContent(contentRes.data);

        // 4. Hydrate saved answers
        if (myAttempt.data) {
          const answersRes = await fetchAttemptAnswers(myAttempt.data.id);
          if (cancelled) return;
          if (answersRes.data) {
            const map = new Map<string, string>();
            answersRes.data.forEach(a => {
              if (a.selected_answer) {
                map.set(a.question_id, a.selected_answer);
              }
            });
            setAnswers(map);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Lỗi hệ thống');
      }
      if (!cancelled) setLoading(false);
    };

    init();
    return () => { cancelled = true; };
  }, [testId]);

  // Questions sorted by question_number
  const sortedQuestions = useMemo(() => {
    if (!content) return [];
    return [...content.questions].sort((a, b) => a.question_number - b.question_number);
  }, [content]);

  // Current question object
  const currentQuestion = useMemo(() => {
    return sortedQuestions.find(q => q.question_number === currentQ) || null;
  }, [sortedQuestions, currentQ]);

  // Current group (for passage/audio context)
  const currentGroup = useMemo((): StudentToeicGroup | null => {
    if (!currentQuestion?.group_id || !content) return null;
    return content.groups.find(g => g.id === currentQuestion.group_id) || null;
  }, [currentQuestion, content]);

  // Answered question numbers set
  const answeredNumbers = useMemo(() => {
    const set = new Set<number>();
    if (!content) return set;
    answers.forEach((_val, qId) => {
      const q = content.questions.find(q => q.id === qId);
      if (q) set.add(q.question_number);
    });
    return set;
  }, [answers, content]);

  // Determine media for current question context
  const mediaContext = useMemo(() => {
    if (!currentQuestion) return { audioUrl: null, imageUrl: null };

    // Question-level media
    let audioUrl = currentQuestion.audio_url;
    let imageUrl = currentQuestion.image_url;

    // Group-level fallback
    if (currentGroup) {
      if (!audioUrl && currentGroup.audio_url) audioUrl = currentGroup.audio_url;
      if (!imageUrl && currentGroup.image_url) imageUrl = currentGroup.image_url;
    }

    return { audioUrl, imageUrl };
  }, [currentQuestion, currentGroup]);

  // Handle answer selection
  const handleSelectAnswer = useCallback(async (answer: string) => {
    if (!currentQuestion || !attempt || timeExpired) return;

    // Optimistic update
    setAnswers(prev => new Map(prev).set(currentQuestion.id, answer));

    // Persist
    const res = await saveAnswer(attempt.id, currentQuestion.id, answer);
    if (res.error) {
      console.error('Save answer error:', res.error);
    }
  }, [currentQuestion, attempt, timeExpired]);

  // Navigation
  const handleNavigate = useCallback((questionNumber: number) => {
    setCurrentQ(questionNumber);
    if (attempt) {
      updateAttemptProgress(attempt.id, questionNumber);
    }
  }, [attempt]);

  const handlePrev = useCallback(() => {
    if (currentQ > 1) handleNavigate(currentQ - 1);
  }, [currentQ, handleNavigate]);

  const handleNext = useCallback(() => {
    if (currentQ < 200) handleNavigate(currentQ + 1);
  }, [currentQ, handleNavigate]);

  // Save & Exit
  const handleSaveAndExit = useCallback(async () => {
    if (attempt) {
      await updateAttemptProgress(attempt.id, currentQ);
    }
    navigate(`/tests/${testId}`);
  }, [attempt, currentQ, testId, navigate]);

  // Time expired
  const handleTimeExpired = useCallback(() => {
    setTimeExpired(true);
  }, []);

  // Show whether current question needs passage/group context
  const showPassage = currentGroup && (currentGroup.passage || (currentGroup.documents && currentGroup.documents.length > 0));
  const showMedia = mediaContext.audioUrl || mediaContext.imageUrl;

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-ori-600 mx-auto" />
          <p className="text-sm text-slate-500 mt-3">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }

  if (error || !content || !attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-bold">{error || 'Không thể tải đề thi'}</p>
          <button
            onClick={() => navigate('/tests')}
            className="mt-4 text-ori-600 font-bold text-sm"
          >
            ← Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-extrabold text-slate-900 truncate max-w-[200px] sm:max-w-none">
              {content.test.title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <TestTimer
              startedAt={attempt.started_at}
              durationMinutes={attempt.duration_minutes}
              onTimeExpired={handleTimeExpired}
            />

            <div className="hidden sm:block text-xs font-bold text-slate-500">
              {answeredNumbers.size}/200
            </div>

            <button
              onClick={() => setNavOpen(!navOpen)}
              className="p-2 text-slate-500 hover:text-ori-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Toggle navigator"
            >
              {navOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>

            <button
              onClick={handleSaveAndExit}
              className="px-3 py-1.5 text-xs font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Lưu & thoát
            </button>
          </div>
        </div>
      </header>

      {/* Time expired overlay */}
      {timeExpired && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm text-center space-y-4">
            <div className="text-4xl">⏰</div>
            <h2 className="text-lg font-extrabold text-slate-900">Thời gian làm bài đã hết</h2>
            <p className="text-sm text-slate-500">
              Bài làm của bạn đã được lưu tự động.
            </p>
            <button
              onClick={() => navigate(`/tests/${testId}`)}
              className="px-6 py-2.5 bg-ori-600 text-white font-extrabold rounded-xl hover:bg-ori-700 transition-colors"
            >
              Quay lại
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Question Area */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {currentQuestion ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Part instruction context */}
              {showPassage && currentGroup && (
                <PassageDisplay group={currentGroup} />
              )}

              {/* Media (image for Part 1, audio for listening parts) */}
              {showMedia && (
                <ListeningMedia
                  audioUrl={mediaContext.audioUrl}
                  imageUrl={mediaContext.imageUrl}
                />
              )}

              {/* Question */}
              <QuestionDisplay
                question={currentQuestion}
                selectedAnswer={answers.get(currentQuestion.id) || null}
                onSelectAnswer={handleSelectAnswer}
                disabled={timeExpired}
              />

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentQ <= 1}
                  className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Câu trước
                </button>

                <span className="text-xs font-bold text-slate-400">
                  {currentQ} / 200
                </span>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentQ >= 200}
                  className="px-4 py-2 text-sm font-bold text-white bg-ori-600 hover:bg-ori-700 rounded-xl flex items-center gap-1 disabled:opacity-40 transition-colors"
                >
                  Câu sau
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">
              Không tìm thấy câu hỏi #{currentQ}
            </div>
          )}
        </main>

        {/* Navigator Sidebar */}
        {navOpen && (
          <aside className="hidden lg:block w-72 border-l border-slate-200 bg-white p-4 overflow-y-auto">
            <QuestionNavigator
              totalQuestions={200}
              currentQuestion={currentQ}
              answeredQuestions={answeredNumbers}
              onNavigate={handleNavigate}
            />
          </aside>
        )}
      </div>
    </div>
  );
};
