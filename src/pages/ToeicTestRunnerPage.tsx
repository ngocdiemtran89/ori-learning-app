import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogOut, ChevronLeft, ChevronRight, PanelRightOpen, PanelRightClose, Send, AlertTriangle } from 'lucide-react';
import {
  startOrResumeTest,
  fetchTestContent,
  fetchAttemptAnswers,
  saveAnswer,
  updateAttemptProgress,
  fetchMyAttempt,
  saveToeicWord,
  submitStudentToeicAttempt,
  getStudentToeicAttemptReview,
  type StudentToeicAttemptReviewPayload,
} from '../lib/supabase/studentToeic';
import { TOEIC_FULL_TEST_STRUCTURE, type CanonicalToeicPart } from '../lib/toeic/testStructure';
import type { StudentToeicTestContent, StudentToeicGroup, ToeicTestAttempt, ToeicAttemptMode } from '../lib/supabase/types';
import { QuestionDisplay } from '../components/toeic/QuestionDisplay';
import { QuestionNavigator } from '../components/toeic/QuestionNavigator';
import { TestTimer } from '../components/toeic/TestTimer';
import { PassageDisplay } from '../components/toeic/PassageDisplay';
import { ListeningMedia } from '../components/toeic/ListeningMedia';
import { PartPracticeReviewView } from '../components/toeic/PartPracticeReviewView';

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

  // Submit & Review State
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewPayload, setReviewPayload] = useState<StudentToeicAttemptReviewPayload | null>(null);

  const loadRunnerData = useCallback(async () => {
    if (!testId) return;
    setLoading(true);
    setError(null);
    setReviewPayload(null);

    try {
      const attemptRes = await startOrResumeTest(testId, mode, partNumber);
      if (attemptRes.error) { setError(attemptRes.error); setLoading(false); return; }

      const myAttempt = await fetchMyAttempt(testId, mode, partNumber);
      if (myAttempt.data) {
        setAttempt(myAttempt.data);

        // IF ATTEMPT IS ALREADY SUBMITTED, LOAD REVIEW PAYLOAD
        if (myAttempt.data.status === 'submitted') {
          const reviewRes = await getStudentToeicAttemptReview(myAttempt.data.id);
          if (reviewRes.success && reviewRes.data) {
            setReviewPayload(reviewRes.data);
            setLoading(false);
            return;
          }
        }

        setCurrentQ(myAttempt.data.current_question_number || scopeRange.start);
      }

      const contentRes = await fetchTestContent(testId, mode, partNumber);
      if (contentRes.error) { setError(contentRes.error); setLoading(false); return; }
      setContent(contentRes.data);

      if (myAttempt.data) {
        const answersRes = await fetchAttemptAnswers(myAttempt.data.id);
        if (answersRes.data) {
          const map = new Map<string, string>();
          answersRes.data.forEach(a => {
            if (a.selected_answer) map.set(a.question_id, a.selected_answer);
          });
          setAnswers(map);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi hệ thống');
    }
    setLoading(false);
  }, [testId, mode, partNumber, scopeRange.start]);

  useEffect(() => {
    loadRunnerData();
  }, [loadRunnerData]);

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
    if (!currentQuestion || !attempt || timeExpired || attempt.status === 'submitted') return;
    setAnswers(prev => new Map(prev).set(currentQuestion.id, answer));
    const res = await saveAnswer(attempt.id, currentQuestion.id, answer, isPartMode ? localElapsedSeconds : undefined);
    if (res.error) console.error('Save answer error:', res.error);
  }, [currentQuestion, attempt, timeExpired, isPartMode, localElapsedSeconds]);

  const handleNavigate = useCallback((questionNumber: number) => {
    if (questionNumber < scopeRange.start || questionNumber > scopeRange.end) return;
    setCurrentQ(questionNumber);
    if (attempt && attempt.status !== 'submitted') {
      updateAttemptProgress(attempt.id, questionNumber, isPartMode ? localElapsedSeconds : undefined);
    }
  }, [attempt, scopeRange, isPartMode, localElapsedSeconds]);

  const handlePrev = useCallback(() => {
    if (currentQ > scopeRange.start) handleNavigate(currentQ - 1);
  }, [currentQ, handleNavigate, scopeRange.start]);

  const handleNext = useCallback(() => {
    if (currentQ < scopeRange.end) handleNavigate(currentQ + 1);
  }, [currentQ, handleNavigate, scopeRange.end]);

  const handleSaveAndExit = useCallback(async () => {
    if (attempt && attempt.status !== 'submitted') {
      await updateAttemptProgress(attempt.id, currentQ, isPartMode ? localElapsedSeconds : undefined);
    }
    navigate(`/tests/${testId}`);
  }, [attempt, currentQ, testId, navigate, isPartMode, localElapsedSeconds]);

  // SUBMIT EXECUTION
  const handleConfirmSubmit = useCallback(async () => {
    if (!attempt) return;
    setSubmitting(true);
    try {
      const subRes = await submitStudentToeicAttempt(attempt.id);
      if (!subRes.success) {
        setError(subRes.error || 'Không thể nộp bài');
        setSubmitting(false);
        setShowSubmitConfirm(false);
        return;
      }

      const reviewRes = await getStudentToeicAttemptReview(attempt.id);
      if (reviewRes.success && reviewRes.data) {
        setReviewPayload(reviewRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi nộp bài');
    }
    setSubmitting(false);
    setShowSubmitConfirm(false);
  }, [attempt]);

  // RETAKE EXECUTION
  const handleRetakePart = useCallback(async () => {
    if (!attempt || !testId) return;
    setLoading(true);
    // Submit status is already 'submitted', calling startOrResumeTest creates a NEW attempt
    await loadRunnerData();
  }, [attempt, testId, loadRunnerData]);

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

  // RENDER REVIEW MODE IF SUBMITTED
  if (reviewPayload) {
    return (
      <PartPracticeReviewView
        reviewData={reviewPayload}
        onRetake={handleRetakePart}
        testId={testId!}
      />
    );
  }

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

  const answeredCount = answeredNumbers.size;
  const remainingCount = scopeTotal - answeredCount;
  const isComplete = answeredCount === scopeTotal;

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
              {answeredCount}/{scopeTotal}
            </div>

            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="px-3 py-1.5 text-xs font-extrabold text-white bg-ori-600 hover:bg-ori-700 rounded-lg flex items-center gap-1 transition-colors shadow-sm"
              title="Nộp bài luyện tập"
            >
              <Send className="w-3.5 h-3.5" />
              Nộp bài
            </button>

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

      {/* CONFIRMATION SUBMIT MODAL */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl max-w-md w-full text-center space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-ori-100 text-ori-600 mb-1">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Xác nhận nộp {isPartMode && partNumber ? `Part ${partNumber}` : 'bài thi'}
              </h2>
              {isComplete ? (
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Bạn đã trả lời <span className="font-bold text-slate-900">{answeredCount}/{scopeTotal}</span> câu.<br />
                  Bạn có chắc chắn muốn nộp bài ngay bây giờ?
                </p>
              ) : (
                <div className="mt-2 p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-sm text-left flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Bài làm chưa hoàn thành</p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Bạn đã trả lời <span className="font-bold">{answeredCount}/{scopeTotal}</span> câu. còn <span className="font-bold text-rose-700">{remainingCount}</span> câu chưa trả lời.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm rounded-2xl transition-colors"
              >
                QUAY LẠI
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="flex-1 py-3 bg-ori-600 hover:bg-ori-700 text-white font-extrabold text-sm rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang nộp...
                  </>
                ) : (
                  'NỘP BÀI'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {timeExpired && !isPartMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm text-center space-y-4">
            <div className="text-4xl">⏰</div>
            <h2 className="text-lg font-extrabold text-slate-900">Thời gian làm bài đã hết</h2>
            <p className="text-sm text-slate-500">Bài làm của bạn đã được lưu tự động.</p>
            <button
              onClick={handleConfirmSubmit}
              className="px-6 py-2.5 bg-ori-600 text-white font-extrabold rounded-xl hover:bg-ori-700 transition-colors"
            >
              Nộp bài ngay
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

                {currentQ < scopeRange.end ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-4 py-2 text-sm font-bold text-white bg-ori-600 hover:bg-ori-700 rounded-xl flex items-center gap-1 transition-colors"
                  >
                    Câu sau
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirm(true)}
                    className="px-5 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 transition-colors shadow-md animate-pulse"
                  >
                    <Send className="w-4 h-4" />
                    NỘP {isPartMode && partNumber ? `PART ${partNumber}` : 'BÀI'}
                  </button>
                )}
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
