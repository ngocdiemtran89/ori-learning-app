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
  fetchLatestAttempt,
  saveToeicWord,
  submitStudentToeicAttempt,
  getStudentToeicAttemptResult,
  getStudentToeicAttemptReview,
  type StudentToeicAttemptReviewPayload,
  type AttemptResultSummary,
} from '../lib/supabase/studentToeic';
import { TOEIC_FULL_TEST_STRUCTURE, type CanonicalToeicPart } from '../lib/toeic/testStructure';
import type { StudentToeicTestContent, StudentToeicGroup, ToeicTestAttempt, ToeicAttemptMode } from '../lib/supabase/types';
import { QuestionDisplay } from '../components/toeic/QuestionDisplay';
import { QuestionNavigator } from '../components/toeic/QuestionNavigator';
import { TestTimer } from '../components/toeic/TestTimer';
import { PassageDisplay } from '../components/toeic/PassageDisplay';
import { Part7StudentWorkspace } from '../components/toeic/Part7StudentWorkspace';
import { ListeningMedia } from '../components/toeic/ListeningMedia';
import { PartPracticeReviewView, ReviewViewErrorBoundary } from '../components/toeic/PartPracticeReviewView';

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
  const [submitStepText, setSubmitStepText] = useState<string>('Đang nộp bài...');
  const [resultSummary, setResultSummary] = useState<AttemptResultSummary | null>(null);
  const [reviewPayload, setReviewPayload] = useState<StudentToeicAttemptReviewPayload | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [fetchingReview, setFetchingReview] = useState(false);

  const loadRunnerData = useCallback(async () => {
    if (!testId) return;
    setLoading(true);
    setError(null);
    setReviewPayload(null);
    setResultSummary(null);
    setReviewError(null);

    try {
      // 1. Check if there is an existing attempt (including submitted)
      const latestAttempt = await fetchLatestAttempt(testId, mode, partNumber);

      if (latestAttempt.data) {
        setAttempt(latestAttempt.data);

        // IF LATEST ATTEMPT IS SUBMITTED, LOAD RESULT/REVIEW
        if (latestAttempt.data.status === 'submitted') {
          const [resultRes, reviewRes] = await Promise.all([
            getStudentToeicAttemptResult(latestAttempt.data.id),
            getStudentToeicAttemptReview(latestAttempt.data.id),
          ]);

          if (resultRes.success && resultRes.data) {
            setResultSummary(resultRes.data);
          }

          if (reviewRes.success && reviewRes.data) {
            setReviewPayload(reviewRes.data);
          } else {
            setReviewError(reviewRes.error || 'Không thể tải bài làm chi tiết.');
          }

          setLoading(false);
          return;
        }

        setCurrentQ(latestAttempt.data.current_question_number || scopeRange.start);
      } else {
        // Create or resume attempt
        const attemptRes = await startOrResumeTest(testId, mode, partNumber);
        if (attemptRes.error) { setError(attemptRes.error); setLoading(false); return; }

        const myAttempt = await fetchMyAttempt(testId, mode, partNumber);
        if (myAttempt.data) {
          setAttempt(myAttempt.data);
          setCurrentQ(myAttempt.data.current_question_number || scopeRange.start);
        }
      }

      const contentRes = await fetchTestContent(testId, mode, partNumber);
      if (contentRes.error) { setError(contentRes.error); setLoading(false); return; }
      setContent(contentRes.data);

      const currentAttemptId = latestAttempt.data?.id;
      if (currentAttemptId) {
        const answersRes = await fetchAttemptAnswers(currentAttemptId);
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
    if (!attempt || submitting) return;
    setSubmitting(true);
    setSubmitStepText('Đang chấm bài...');
    setError(null);
    setReviewError(null);

    try {
      const subRes = await submitStudentToeicAttempt(attempt.id);
      if (!subRes.success || !subRes.data) {
        setError(subRes.error || 'Không thể nộp bài');
        setSubmitting(false);
        setShowSubmitConfirm(false);
        return;
      }

      // 1. Immediately switch attempt status & set score result summary
      const summaryData = subRes.data;
      setResultSummary(summaryData);
      setAttempt(prev => prev ? { ...prev, status: 'submitted', submitted_at: summaryData.submitted_at } : null);
      setShowSubmitConfirm(false);

      // 2. Fetch review payload
      setSubmitStepText('Đang tải kết quả chi tiết...');
      const reviewRes = await getStudentToeicAttemptReview(attempt.id);
      if (reviewRes.success && reviewRes.data) {
        setReviewPayload(reviewRes.data);
      } else {
        setReviewError(reviewRes.error || 'Không thể tải bài xem lại chi tiết.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi nộp bài');
    }
    setSubmitting(false);
  }, [attempt, submitting]);

  // RETRY FETCH REVIEW ONLY (NO DB WRITE)
  const handleRetryFetchReview = useCallback(async () => {
    if (!attempt) return;
    setFetchingReview(true);
    setReviewError(null);
    try {
      const reviewRes = await getStudentToeicAttemptReview(attempt.id);
      if (reviewRes.success && reviewRes.data) {
        setReviewPayload(reviewRes.data);
      } else {
        setReviewError(reviewRes.error || 'Vẫn chưa thể tải phần xem lại.');
      }
    } catch (err: any) {
      setReviewError(err.message || 'Lỗi kết nối khi tải lại bài xem.');
    }
    setFetchingReview(false);
  }, [attempt]);

  // RETAKE EXECUTION
  const handleRetakePart = useCallback(async () => {
    if (!testId) return;
    setLoading(true);
    setReviewPayload(null);
    setResultSummary(null);
    setReviewError(null);
    // Create new attempt
    const res = await startOrResumeTest(testId, mode, partNumber);
    if (res.attemptId) {
      await loadRunnerData();
    } else {
      setLoading(false);
    }
  }, [testId, mode, partNumber, loadRunnerData]);

  const handleTimeExpired = useCallback(() => { setTimeExpired(true); }, []);

  const isListeningPart = currentQuestion ? ['part1', 'part2', 'part3', 'part4'].includes(currentQuestion.part) : false;
  const showPassage = currentGroup && (currentGroup.passage || (currentGroup.documents && currentGroup.documents.length > 0) || currentGroup.instruction);
  const showMedia = Boolean(mediaContext.audioUrl || mediaContext.imageUrl || isListeningPart);
  const hasAudio = Boolean(mediaContext.audioUrl);
  const hasImage = Boolean(mediaContext.imageUrl);

  // Part title for header
  const headerTitle = useMemo(() => {
    if (content?.test?.title) {
      if (isPartMode && partNumber) {
        const key = `part${partNumber}` as CanonicalToeicPart;
        return `${content.test.title} — ${TOEIC_FULL_TEST_STRUCTURE[key]?.nameVi || `Part ${partNumber}`}`;
      }
      return content.test.title;
    }
    return `Part ${partNumber || 1}`;
  }, [content, isPartMode, partNumber]);

  // 1. RENDER REVIEW MODE IF FULL REVIEW PAYLOAD IS LOADED
  if (reviewPayload) {
    return (
      <ReviewViewErrorBoundary onRetry={handleRetryFetchReview}>
        <PartPracticeReviewView
          reviewData={reviewPayload}
          onRetake={handleRetakePart}
          testId={testId!}
        />
      </ReviewViewErrorBoundary>
    );
  }

  // 2. RENDER SCORE RESULT SUMMARY IF ATTEMPT IS SUBMITTED (EVEN IF DETAILED REVIEW FAILS/LOADING)
  if (attempt?.status === 'submitted' || resultSummary) {
    return (
      <ResultSummaryCard
        testTitle={headerTitle}
        partNumber={partNumber}
        resultSummary={resultSummary}
        reviewError={reviewError}
        fetchingReview={fetchingReview}
        onRetryReview={handleRetryFetchReview}
        onRetake={handleRetakePart}
        onBackToTest={() => navigate(`/tests/${testId}`)}
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
                    {submitStepText}
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
            currentQuestion.part === 'part7' && currentGroup ? (
              <Part7StudentWorkspace
                group={currentGroup}
                questions={content?.questions.filter((q: any) => q.group_id === currentGroup.id) || [currentQuestion]}
                isPartMode={isPartMode}
                answers={answers}
                onSelectAnswer={handleSelectAnswer}
                onPrevGroup={handlePrev}
                onNextGroup={handleNext}
                onSubmitTest={() => setShowSubmitConfirm(true)}
                onSaveWord={isPartMode && attempt ? async (word: string, context: string) => {
                  await saveToeicWord(attempt.id, currentQuestion.id, word, context);
                } : undefined}
              />
            ) : (
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Câu trước
                </button>

                {currentQ === scopeRange.end ? (
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirm(true)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    <span>NỘP PART {partNumber || 1}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={currentQ >= scopeRange.end}
                    className="px-4 py-2 bg-ori-600 hover:bg-ori-700 text-white font-bold text-xs rounded-xl disabled:opacity-40 transition-colors flex items-center gap-1"
                  >
                    Câu sau <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            )
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500">Không có câu hỏi.</p>
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

interface ResultSummaryCardProps {
  testTitle: string;
  partNumber: number | null;
  resultSummary: AttemptResultSummary | null;
  reviewError: string | null;
  fetchingReview: boolean;
  onRetryReview: () => void;
  onRetake: () => void;
  onBackToTest: () => void;
}

const ResultSummaryCard: React.FC<ResultSummaryCardProps> = ({
  testTitle,
  partNumber,
  resultSummary,
  reviewError,
  fetchingReview,
  onRetryReview,
  onRetake,
  onBackToTest,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ori-100 text-ori-600 text-3xl mx-auto">
          🏆
        </div>
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            KẾT QUẢ BÀI THI {partNumber ? `— PART ${partNumber}` : ''}
          </h2>
          <h1 className="text-base font-extrabold text-slate-900 mt-1 truncate">{testTitle}</h1>
          {resultSummary && (
            <>
              <p className="text-3xl font-black text-slate-900 mt-3">
                {resultSummary.correct_count} / {resultSummary.total_count} <span className="text-lg font-bold text-slate-500">câu đúng</span>
              </p>
              <div className="mt-1 text-xl font-extrabold text-ori-600">
                {resultSummary.score_percent}%
              </div>
            </>
          )}
        </div>

        {resultSummary && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-center">
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="text-xs font-bold text-emerald-700">✓ Đúng</div>
              <div className="text-xl font-extrabold text-emerald-800">{resultSummary.correct_count}</div>
            </div>
            <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
              <div className="text-xs font-bold text-rose-700">✕ Sai</div>
              <div className="text-xl font-extrabold text-rose-800">{resultSummary.incorrect_count}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-xs font-bold text-slate-600">— Bỏ qua</div>
              <div className="text-xl font-extrabold text-slate-700">{resultSummary.unanswered_count}</div>
            </div>
          </div>
        )}

        {reviewError && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-left text-amber-900 text-xs space-y-2">
            <p className="font-extrabold text-amber-800 flex items-center gap-1.5">
              ⚠️ Đã nộp bài thành công nhưng chưa tải được phần xem lại.
            </p>
            <p className="text-[11px] text-amber-700">{reviewError}</p>
            <button
              type="button"
              onClick={onRetryReview}
              disabled={fetchingReview}
              className="mt-1 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {fetchingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>THỬ TẢI KẾT QUẢ LẠI</span>
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={onRetake}
            className="w-full py-3 bg-ori-600 text-white font-extrabold text-sm rounded-2xl hover:bg-ori-700 shadow-md transition-colors"
          >
            LÀM LẠI PART {partNumber || 1}
          </button>

          <button
            type="button"
            onClick={onBackToTest}
            className="w-full py-2.5 bg-slate-100 text-slate-700 font-bold text-sm rounded-2xl hover:bg-slate-200 transition-colors"
          >
            ← QUAY LẠI CHI TIẾT ĐỀ
          </button>
        </div>
      </div>
    </div>
  );
};
