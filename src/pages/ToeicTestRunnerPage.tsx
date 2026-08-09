import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogOut, ChevronLeft, ChevronRight, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { startOrResumeTest, fetchTestContent, fetchAttemptAnswers, saveAnswer, updateAttemptProgress, fetchMyAttempt, saveToeicWord } from '../lib/supabase/studentToeic';
import { TOEIC_FULL_TEST_STRUCTURE, type CanonicalToeicPart } from '../lib/toeic/testStructure';
import type { StudentToeicTestContent, StudentToeicGroup, ToeicTestAttempt, ToeicAttemptMode } from '../lib/supabase/types';
import { QuestionDisplay } from '../components/toeic/QuestionDisplay';
import { QuestionNavigator } from '../components/toeic/QuestionNavigator';
import { TestTimer } from '../components/toeic/TestTimer';
import { PassageDisplay } from '../components/toeic/PassageDisplay';
import { ListeningMedia } from '../components/toeic/ListeningMedia';

export const ToeicTestRunnerPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Mode from URL
  const mode = (searchParams.get('mode') || 'full') as ToeicAttemptMode;
  const partNumber = searchParams.get('part') ? parseInt(searchParams.get('part')!, 10) : null;
  const isPartMode = mode === 'part' && partNumber !== null;

  // Scope boundaries
  const scopeRange = useMemo(() => {
    if (!isPartMode) return { start: 1, end: 200 };
    const key = `part${partNumber}` as CanonicalToeicPart;
    const range = TOEIC_FULL_TEST_STRUCTURE[key];
    return range ? { start: range.startNumber, end: range.endNumber } : { start: 1, end: 200 };
  }, [isPartMode, partNumber]);

  const scopeTotal = scopeRange.end - scopeRange.start + 1;

  // Core state
  const [content, setContent] = useState<StudentToeicTestContent | null>(null);
  const [attempt, setAttempt] = useState<ToeicTestAttempt | null>(null);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [currentQ, setCurrentQ] = useState(scopeRange.start);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(true);
  const [timeExpired, setTimeExpired] = useState(false);

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      try {
        const attemptRes = await startOrResumeTest(testId, mode, partNumber);
        if (attemptRes.error) { setError(attemptRes.error); setLoading(false); return; }

        const myAttempt = await fetchMyAttempt(testId, mode, partNumber);
        if (cancelled) return;
        if (myAttempt.data) {
          setAttempt(myAttempt.data);
          setCurrentQ(myAttempt.data.current_question_number || scopeRange.start);
        }

        const contentRes = await fetchTestContent(testId, mode, partNumber);
        if (cancelled) return;
        if (contentRes.error) { setError(contentRes.error); setLoading(false); return; }
        setContent(contentRes.data);

        if (myAttempt.data) {
          const answersRes = await fetchAttemptAnswers(myAttempt.data.id);
          if (cancelled) return;
          if (answersRes.data) {
            const map = new Map<string, string>();
            answersRes.data.forEach(a => {
              if (a.selected_answer) map.set(a.question_id, a.selected_answer);
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
  }, [testId, mode, partNumber, scopeRange.start]);

  const sortedQuestions = useMemo(() => {
    if (!content) return [];
    return [...content.questions].sort((a, b) => a.question_number - b.question_number);
  }, [content]);

  const currentQuestion = useMemo(() => {
    return sortedQuestions.find(q => q.question_number === currentQ) || null;
  }, [sortedQuestions, currentQ]);

  const currentGroup = useMemo((): StudentToeicGroup | null => {
    if (!currentQuestion?.group_id || !content) return null;
    return content.groups.find(g => g.id === currentQuestion.group_id) || null;
  }, [currentQuestion, content]);

  const answeredNumbers = useMemo(() => {
    const set = new Set<number>();
    if (!content) return set;
    answers.forEach((_val, qId) => {
      const q = content.questions.find(q => q.id === qId);
      if (q) set.add(q.question_number);
    });
    return set;
  }, [answers, content]);

  const [localElapsedSeconds, setLocalElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (attempt) {
      setLocalElapsedSeconds(attempt.elapsed_seconds || 0);
    }
  }, [attempt]);

  const mediaContext = useMemo(() => {
    if (!currentQuestion) return { audioUrl: null, imageUrl: null, cueStartMs: null, cueEndMs: null };
    let audioUrl = currentQuestion.audio_url;
    let imageUrl = currentQuestion.image_url;
    let cueStartMs = currentQuestion.cue_start_ms ?? null;
    let cueEndMs = currentQuestion.cue_end_ms ?? null;
    if (currentGroup) {
      if (!audioUrl && currentGroup.audio_url) audioUrl = currentGroup.audio_url;
      if (!imageUrl && currentGroup.image_url) imageUrl = currentGroup.image_url;
      if (cueStartMs == null && currentGroup.cue_start_ms != null) cueStartMs = currentGroup.cue_start_ms;
      if (cueEndMs == null && currentGroup.cue_end_ms != null) cueEndMs = currentGroup.cue_end_ms;
    }
    return { audioUrl, imageUrl, cueStartMs, cueEndMs };
  }, [currentQuestion, currentGroup]);

  const handleSelectAnswer = useCallback(async (answer: string) => {
    if (!currentQuestion || !attempt || timeExpired) return;
    setAnswers(prev => new Map(prev).set(currentQuestion.id, answer));
    const res = await saveAnswer(attempt.id, currentQuestion.id, answer, isPartMode ? localElapsedSeconds : undefined);
    if (res.error) console.error('Save answer error:', res.error);
  }, [currentQuestion, attempt, timeExpired, isPartMode, localElapsedSeconds]);

  const handleNavigate = useCallback((questionNumber: number) => {
    if (questionNumber < scopeRange.start || questionNumber > scopeRange.end) return;
    setCurrentQ(questionNumber);
    if (attempt) updateAttemptProgress(attempt.id, questionNumber, isPartMode ? localElapsedSeconds : undefined);
  }, [attempt, scopeRange, isPartMode, localElapsedSeconds]);

  const handlePrev = useCallback(() => {
    if (currentQ > scopeRange.start) handleNavigate(currentQ - 1);
  }, [currentQ, handleNavigate, scopeRange.start]);

  const handleNext = useCallback(() => {
    if (currentQ < scopeRange.end) handleNavigate(currentQ + 1);
  }, [currentQ, handleNavigate, scopeRange.end]);

  const handleSaveAndExit = useCallback(async () => {
    if (attempt) await updateAttemptProgress(attempt.id, currentQ, isPartMode ? localElapsedSeconds : undefined);
    navigate(`/tests/${testId}`);
  }, [attempt, currentQ, testId, navigate, isPartMode, localElapsedSeconds]);

  const handleTimeExpired = useCallback(() => { setTimeExpired(true); }, []);

  const isListeningPart = currentQuestion ? ['part1', 'part2', 'part3', 'part4'].includes(currentQuestion.part) : false;
  const showPassage = currentGroup && (currentGroup.passage || (currentGroup.documents && currentGroup.documents.length > 0) || currentGroup.instruction);
  const showMedia = Boolean(mediaContext.audioUrl || mediaContext.imageUrl || isListeningPart);
  const hasAudio = Boolean(mediaContext.audioUrl);
  const hasImage = Boolean(mediaContext.imageUrl);

  // Part title for header
  const headerTitle = useMemo(() => {
    if (!content) return '';
    if (isPartMode && partNumber) {
      const key = `part${partNumber}` as CanonicalToeicPart;
      return `${content.test.title} — ${TOEIC_FULL_TEST_STRUCTURE[key]?.nameVi || `Part ${partNumber}`}`;
    }
    return content.test.title;
  }, [content, isPartMode, partNumber]);

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
          <button onClick={() => navigate('/tests')} className="mt-4 text-ori-600 font-bold text-sm">
            ← Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-sm font-extrabold text-slate-900 truncate max-w-[240px] sm:max-w-none">
            {headerTitle}
          </h1>

          <div className="flex items-center gap-3">
            <TestTimer
              startedAt={attempt.started_at}
              durationMinutes={attempt.duration_minutes}
              onTimeExpired={handleTimeExpired}
              isStopwatch={isPartMode}
              initialElapsedSeconds={attempt.elapsed_seconds || 0}
              onElapsedTick={(sec) => setLocalElapsedSeconds(sec)}
            />

            <div className="hidden sm:block text-xs font-bold text-slate-500">
              {answeredNumbers.size}/{scopeTotal}
            </div>

            <button
              onClick={() => setNavOpen(!navOpen)}
              className="p-2 text-slate-500 hover:text-ori-600 hover:bg-slate-100 rounded-lg transition-colors"
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

      {timeExpired && !isPartMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm text-center space-y-4">
            <div className="text-4xl">⏰</div>
            <h2 className="text-lg font-extrabold text-slate-900">Thời gian làm bài đã hết</h2>
            <p className="text-sm text-slate-500">Bài làm của bạn đã được lưu tự động.</p>
            <button
              onClick={() => navigate(`/tests/${testId}`)}
              className="px-6 py-2.5 bg-ori-600 text-white font-extrabold rounded-xl hover:bg-ori-700 transition-colors"
            >
              Quay lại
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {currentQuestion ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {showPassage && currentGroup && <PassageDisplay group={currentGroup} isPartMode={isPartMode} />}
              {showMedia && (
                <ListeningMedia
                  audioUrl={mediaContext.audioUrl}
                  imageUrl={mediaContext.imageUrl}
                  part={currentQuestion.part}
                  isAudioRequired={isListeningPart}
                  cueStartMs={mediaContext.cueStartMs}
                  cueEndMs={mediaContext.cueEndMs}
                />
              )}

              <QuestionDisplay
                question={currentQuestion}
                selectedAnswer={answers.get(currentQuestion.id) || null}
                onSelectAnswer={handleSelectAnswer}
                disabled={timeExpired && !isPartMode}
                isPartMode={isPartMode}
                hasAudio={hasAudio}
                hasImage={hasImage}
                onSaveWord={isPartMode && attempt ? async (word: string, context: string) => {
                  await saveToeicWord(attempt.id, currentQuestion.id, word, context);
                } : undefined}
              />

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentQ <= scopeRange.start}
                  className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Câu trước
                </button>

                <span className="text-xs font-bold text-slate-400">
                  {currentQ} / {scopeRange.end}
                </span>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentQ >= scopeRange.end}
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

        {navOpen && (
          <aside className="hidden lg:block w-72 border-l border-slate-200 bg-white p-4 overflow-y-auto">
            <QuestionNavigator
              totalQuestions={scopeTotal}
              currentQuestion={currentQ}
              answeredQuestions={answeredNumbers}
              onNavigate={handleNavigate}
              partFilter={isPartMode ? partNumber : null}
            />
          </aside>
        )}
      </div>
    </div>
  );
};
