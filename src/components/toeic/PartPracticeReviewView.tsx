import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ListFilter,
  Volume2,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import type { StudentToeicAttemptReviewPayload, ReviewQuestionItem, ReviewGroupItem } from '../../lib/supabase/studentToeic';
import { ListeningMedia } from './ListeningMedia';
import { PassageDisplay } from './PassageDisplay';

interface PartPracticeReviewViewProps {
  reviewData: StudentToeicAttemptReviewPayload;
  onRetake: () => void;
  testId: string;
}

export class ReviewViewErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry?: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onRetry?: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PartPracticeReviewView ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center space-y-4 max-w-lg mx-auto my-8">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            ⚠️
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Kết quả đã được ghi nhận, nhưng phần xem lại gặp lỗi
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              {this.state.error?.message || 'Không thể hiển thị chi tiết câu hỏi.'}
            </p>
          </div>
          {this.props.onRetry && (
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onRetry?.();
              }}
              className="px-5 py-2.5 bg-ori-600 hover:bg-ori-700 text-white font-extrabold text-xs rounded-xl transition-colors shadow-sm"
            >
              Thử tải xem lại
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

type FilterType = 'all' | 'wrong' | 'correct' | 'unanswered';

export const PartPracticeReviewView: React.FC<PartPracticeReviewViewProps> = ({
  reviewData,
  onRetake,
  testId,
}) => {
  const navigate = useNavigate();
  const { test, attempt, result, questions, groups } = reviewData;

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(true);

  const partNumber = attempt.part_number;

  // Questions filtered by tab
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (activeFilter === 'correct') return q.is_correct;
      if (activeFilter === 'wrong') return q.student_answer && !q.is_correct;
      if (activeFilter === 'unanswered') return !q.student_answer;
      return true;
    });
  }, [questions, activeFilter]);

  const currentQuestion: ReviewQuestionItem | undefined = filteredQuestions[currentQIndex] || filteredQuestions[0];

  const currentGroup: ReviewGroupItem | undefined = useMemo(() => {
    if (!currentQuestion?.group_id) return undefined;
    return groups.find(g => g.id === currentQuestion.group_id);
  }, [currentQuestion, groups]);

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

  const isListeningPart = currentQuestion ? ['part1', 'part2', 'part3', 'part4'].includes(currentQuestion.part) : false;

  const computedScript = useMemo(() => {
    if (!currentQuestion) return null;
    if (currentQuestion.transcript) return currentQuestion.transcript;
    if (currentGroup?.transcript) return currentGroup.transcript;

    if (['part1', 'part2'].includes(currentQuestion.part)) {
      const hasRealOptionsText = currentQuestion.options?.some(
        opt => opt.text && !/^\([A-D]\)$/.test(opt.text.trim())
      );

      if (hasRealOptionsText || currentQuestion.question_text) {
        const lines: string[] = [];
        if (currentQuestion.question_text && currentQuestion.part === 'part2') {
          lines.push(`Prompt: ${currentQuestion.question_text}`);
        }
        if (currentQuestion.options) {
          currentQuestion.options.forEach(opt => {
            if (opt.text) lines.push(`(${opt.label}) ${opt.text.replace(/^\([A-D]\)\s*/, '')}`);
          });
        }
        return lines.join('\n');
      }
    }
    return null;
  }, [currentQuestion, currentGroup]);

  const computedScriptVi = useMemo(() => {
    if (!currentQuestion) return null;
    if (currentQuestion.transcript_vi) return currentQuestion.transcript_vi;
    if (currentGroup?.transcript_vi) return currentGroup.transcript_vi;

    if (['part1', 'part2'].includes(currentQuestion.part)) {
      const lines: string[] = [];
      if (currentQuestion.translation_vi) {
        lines.push(currentQuestion.translation_vi);
      }
      if (currentQuestion.options_vi && Array.isArray(currentQuestion.options_vi)) {
        currentQuestion.options_vi.forEach((optVi, idx) => {
          const label = String.fromCharCode(65 + idx);
          lines.push(`(${label}) ${optVi}`);
        });
      }
      if (lines.length > 0) return lines.join('\n');
    }
    return null;
  }, [currentQuestion, currentGroup]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/tests/${testId}`)}
              className="p-2 text-slate-500 hover:text-ori-600 hover:bg-slate-100 rounded-xl transition-colors"
              title="Quay lại chi tiết đề"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 truncate">
                {test.title} — {partNumber ? `Part ${partNumber}` : 'Full Test'} (Xem lại)
              </h1>
              <p className="text-[11px] text-slate-500 font-semibold">
                Đã nộp bài • Kết quả: {result.correct_count}/{result.total_count} câu đúng ({result.score_percent}%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSummaryModal(true)}
              className="px-3 py-1.5 text-xs font-bold text-ori-700 bg-ori-50 hover:bg-ori-100 rounded-xl transition-colors"
            >
              Xem tổng quan
            </button>
            <button
              onClick={onRetake}
              className="px-3 py-1.5 text-xs font-bold text-white bg-ori-600 hover:bg-ori-700 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Làm lại Part {partNumber}
            </button>
          </div>
        </div>
      </header>

      {/* SUMMARY OVERLAY MODAL */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ori-100 text-ori-600 text-2xl font-black mb-1">
              🏆
            </div>
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">KẾT QUẢ PART {partNumber}</h2>
              <p className="text-3xl font-black text-slate-900 mt-1">
                {result.correct_count} / {result.total_count} <span className="text-lg font-bold text-slate-500">câu đúng</span>
              </p>
              <div className="mt-2 text-xl font-extrabold text-ori-600">
                {result.score_percent}%
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-center">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="text-xs font-bold text-emerald-700">✓ Đúng</div>
                <div className="text-xl font-extrabold text-emerald-800">{result.correct_count}</div>
              </div>
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <div className="text-xs font-bold text-rose-700">✕ Sai</div>
                <div className="text-xl font-extrabold text-rose-800">{result.incorrect_count}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-xs font-bold text-slate-600">— Bỏ qua</div>
                <div className="text-xl font-extrabold text-slate-700">{result.unanswered_count}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => setShowSummaryModal(false)}
                className="w-full py-3 bg-ori-600 text-white font-extrabold text-sm rounded-2xl hover:bg-ori-700 shadow-md transition-colors"
              >
                XEM LẠI {result.total_count} CÂU HỎI
              </button>
              <button
                onClick={onRetake}
                className="w-full py-2.5 bg-slate-100 text-slate-700 font-bold text-sm rounded-2xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                LÀM LẠI PART {partNumber}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN REVIEW BODY */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full min-w-0">
        <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* FILTER TABS */}
          <div className="flex items-center justify-between bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <ListFilter className="w-4 h-4 text-slate-400 ml-2 mr-1" />
              <button
                onClick={() => { setActiveFilter('all'); setCurrentQIndex(0); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                  activeFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                TẤT CẢ ({result.total_count})
              </button>
              <button
                onClick={() => { setActiveFilter('wrong'); setCurrentQIndex(0); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                  activeFilter === 'wrong' ? 'bg-rose-600 text-white' : 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                }`}
              >
                CÂU SAI ({result.incorrect_count})
              </button>
              <button
                onClick={() => { setActiveFilter('correct'); setCurrentQIndex(0); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                  activeFilter === 'correct' ? 'bg-emerald-600 text-white' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                }`}
              >
                CÂU ĐÚNG ({result.correct_count})
              </button>
              <button
                onClick={() => { setActiveFilter('unanswered'); setCurrentQIndex(0); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                  activeFilter === 'unanswered' ? 'bg-slate-600 text-white' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                }`}
              >
                CHƯA TRẢ LỜI ({result.unanswered_count})
              </button>
            </div>

            <div className="text-xs font-bold text-slate-500 mr-2">
              Hiển thị {filteredQuestions.length} câu
            </div>
          </div>

          {currentQuestion ? (
            <div className={currentQuestion.part === 'part1' ? "w-full max-w-full space-y-6 min-w-0" : "max-w-2xl mx-auto space-y-6"}>
              {/* GROUP PASSAGE OR DOCUMENTS (IF AVAILABLE) */}
              {currentGroup && (currentGroup.passage || (currentGroup.documents && currentGroup.documents.length > 0) || currentGroup.instruction) && (
                <PassageDisplay
                  group={currentGroup as unknown as import('../../lib/supabase/types').StudentToeicGroup}
                  isPartMode={true}
                />
              )}

              {/* FOR PARTS 2-7: TOP MEDIA PLAYER */}
              {currentQuestion.part !== 'part1' && (mediaContext.audioUrl || mediaContext.imageUrl || isListeningPart) && (
                <ListeningMedia
                  audioUrl={mediaContext.audioUrl || null}
                  imageUrl={mediaContext.imageUrl || null}
                  part={currentQuestion.part}
                  isAudioRequired={isListeningPart}
                  cueStartMs={mediaContext.cueStartMs}
                  cueEndMs={mediaContext.cueEndMs}
                />
              )}

              {/* PART 1 COMPARISON LAYOUT VS PARTS 2-7 STANDARD LAYOUT */}
              {currentQuestion.part === 'part1' ? (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-5 items-start w-full min-w-0">
                  {/* LEFT COLUMN: PHOTOGRAPH + COMPACT AUDIO (STICKY ON DESKTOP) */}
                  <div className="lg:sticky lg:top-20 space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                    <ListeningMedia
                      audioUrl={null}
                      imageUrl={mediaContext.imageUrl || null}
                      part="part1"
                      isAudioRequired={false}
                      showImage={true}
                      showAudio={false}
                    />
                    <ListeningMedia
                      audioUrl={mediaContext.audioUrl || null}
                      imageUrl={null}
                      part="part1"
                      isAudioRequired={true}
                      cueStartMs={mediaContext.cueStartMs}
                      cueEndMs={mediaContext.cueEndMs}
                      showImage={false}
                      showAudio={true}
                      compactAudio={true}
                    />
                  </div>

                  {/* RIGHT COLUMN: QUESTION + BILINGUAL OPTIONS + EXPLANATION */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 min-w-0 w-full">
                    {/* QUESTION HEADER & BADGES */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <span className="text-base font-extrabold text-slate-900">
                        Câu {currentQuestion.question_number}
                      </span>
                      <div>
                        {currentQuestion.student_answer ? (
                          currentQuestion.is_correct ? (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ĐÚNG
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-extrabold rounded-full flex items-center gap-1">
                              <XCircle className="w-4 h-4 text-rose-600" />
                              SAI
                            </span>
                          )
                        ) : (
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-extrabold rounded-full flex items-center gap-1">
                            <AlertCircle className="w-4 h-4 text-slate-400" />
                            CHƯA TRẢ LỜI
                          </span>
                        )}
                      </div>
                    </div>

                    {/* QUESTION TEXT */}
                    {currentQuestion.question_text && (
                      <p className="text-xs font-bold text-slate-700 leading-relaxed break-words whitespace-normal">
                        {currentQuestion.question_text}
                      </p>
                    )}

                    {/* INLINE BILINGUAL OPTION CARDS */}
                    <div className="space-y-2.5 w-full min-w-0">
                      {(currentQuestion.options || [
                        { label: 'A', text: 'Option A' },
                        { label: 'B', text: 'Option B' },
                        { label: 'C', text: 'Option C' },
                        { label: 'D', text: 'Option D' },
                      ]).map((opt, idx) => {
                        const isSelected = currentQuestion.student_answer === opt.label;
                        const isCorrect = currentQuestion.correct_answer === opt.label;

                        let optionBg = 'bg-slate-50 border-slate-200 text-slate-700';
                        let badge = null;

                        if (isCorrect && isSelected) {
                          optionBg = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-extrabold ring-1 ring-emerald-400';
                          badge = (
                            <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                              ✓ Đáp án đúng • Bạn đã chọn
                            </span>
                          );
                        } else if (isCorrect) {
                          optionBg = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-extrabold ring-1 ring-emerald-400';
                          badge = (
                            <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                              ✓ Đáp án đúng
                            </span>
                          );
                        } else if (isSelected) {
                          optionBg = 'bg-rose-50 border-rose-300 text-rose-900 font-extrabold';
                          badge = (
                            <span className="text-[11px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                              ✕ Bạn chọn
                            </span>
                          );
                        }

                        const optVi = Array.isArray(currentQuestion.options_vi)
                          ? currentQuestion.options_vi[idx]
                          : null;

                        return (
                          <div
                            key={opt.label}
                            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 transition-all w-full min-w-0 ${optionBg}`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className={`w-6 h-6 shrink-0 rounded-lg font-black text-xs flex items-center justify-center border mt-0.5 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : isSelected
                                  ? 'bg-rose-600 text-white border-rose-600'
                                  : 'bg-white text-slate-600 border-slate-300'
                              }`}>
                                {opt.label}
                              </span>
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="text-xs font-semibold leading-snug break-words whitespace-normal">{opt.text}</span>
                                {optVi && typeof optVi === 'string' && optVi.trim().length > 0 && (
                                  <span className="text-[11px] text-slate-500 italic leading-snug break-words whitespace-normal">
                                    {optVi}
                                  </span>
                                )}
                              </div>
                            </div>
                            {badge && <div className="shrink-0 self-start sm:self-auto">{badge}</div>}
                          </div>
                        );
                      })}
                    </div>

                    {/* EXPLANATION BLOCK (IF PRESENT) */}
                    {currentQuestion.explanation && (
                      <div className="pt-3 border-t border-slate-100 space-y-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-700 uppercase">
                          <BookOpen className="w-3.5 h-3.5 text-ori-600" />
                          GIẢI THÍCH CHI TIẾT
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed break-words">
                          {currentQuestion.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* PARTS 2-7 STANDARD REVIEW CARD */
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-base font-extrabold text-slate-900">
                      Câu {currentQuestion.question_number}
                    </span>

                    <div>
                      {currentQuestion.student_answer ? (
                        currentQuestion.is_correct ? (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ĐÚNG
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-extrabold rounded-full flex items-center gap-1">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            SAI
                          </span>
                        )
                      ) : (
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-extrabold rounded-full flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-slate-400" />
                          CHƯA TRẢ LỜI
                        </span>
                      )}
                    </div>
                  </div>

                  {currentQuestion.question_text && (
                    <p className="text-sm font-bold text-slate-800 leading-relaxed">
                      {currentQuestion.question_text}
                    </p>
                  )}

                  <div className="space-y-2.5">
                    {(currentQuestion.options || [
                      { label: 'A', text: 'Option A' },
                      { label: 'B', text: 'Option B' },
                      { label: 'C', text: 'Option C' },
                      { label: 'D', text: 'Option D' },
                    ]).map((opt, idx) => {
                      const isSelected = currentQuestion.student_answer === opt.label;
                      const isCorrect = currentQuestion.correct_answer === opt.label;

                      let optionBg = 'bg-slate-50 border-slate-200 text-slate-700';
                      let badge = null;

                      if (isCorrect && isSelected) {
                        optionBg = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-extrabold ring-1 ring-emerald-400';
                        badge = (
                          <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                            ✓ Đáp án đúng • Bạn đã chọn
                          </span>
                        );
                      } else if (isCorrect) {
                        optionBg = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-extrabold ring-1 ring-emerald-400';
                        badge = (
                          <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                            ✓ Đáp án đúng
                          </span>
                        );
                      } else if (isSelected) {
                        optionBg = 'bg-rose-50 border-rose-300 text-rose-900 font-extrabold';
                        badge = (
                          <span className="text-xs font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                            ✕ Bạn chọn
                          </span>
                        );
                      }

                      const optVi = Array.isArray(currentQuestion.options_vi)
                        ? currentQuestion.options_vi[idx]
                        : null;

                      return (
                        <div
                          key={opt.label}
                          className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${optionBg}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`w-7 h-7 shrink-0 rounded-lg font-black text-xs flex items-center justify-center border mt-0.5 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : isSelected
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}>
                              {opt.label}
                            </span>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-semibold leading-snug">{opt.text}</span>
                              {optVi && typeof optVi === 'string' && optVi.trim().length > 0 && (
                                <span className="text-xs text-slate-500 italic leading-snug">
                                  {optVi}
                                </span>
                              )}
                            </div>
                          </div>
                          {badge}
                        </div>
                      );
                    })}
                  </div>

                  {isListeningPart && currentQuestion.part !== 'part1' && (
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                        <Volume2 className="w-4 h-4 text-ori-600" />
                        LISTENING SCRIPT (BẢN DỊCH & THOẠI)
                      </div>

                      {computedScript ? (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs leading-relaxed space-y-2">
                          <div className="font-bold text-slate-800 whitespace-pre-line">
                            {computedScript}
                          </div>

                          {computedScriptVi && (
                            <div className="pt-2 border-t border-slate-200 text-slate-600 italic whitespace-pre-line">
                              {computedScriptVi}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 text-amber-800 text-xs font-medium rounded-xl border border-amber-200">
                          Chưa có script cho nội dung này.
                        </div>
                      )}
                    </div>
                  )}

                  {currentQuestion.translation_vi && currentQuestion.part !== 'part1' && (
                    <div className="pt-4 border-t border-slate-100 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 uppercase">
                        <BookOpen className="w-4 h-4 text-ori-600" />
                        DỊCH CÂU HỎI & ĐÁP ÁN
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-line">
                        {currentQuestion.translation_vi}
                      </div>
                    </div>
                  )}

                  {currentQuestion.explanation && (
                    <div className="pt-4 border-t border-slate-100 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 uppercase">
                        <BookOpen className="w-4 h-4 text-ori-600" />
                        GIẢI THÍCH CHI TIẾT
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                        {currentQuestion.explanation}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* NAVIGATION FOOTER */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQIndex === 0}
                  className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Câu trước
                </button>

                <span className="text-xs font-bold text-slate-400">
                  {currentQIndex + 1} / {filteredQuestions.length}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentQIndex(prev => Math.min(filteredQuestions.length - 1, prev + 1))}
                  disabled={currentQIndex >= filteredQuestions.length - 1}
                  className="px-4 py-2 text-sm font-bold text-white bg-ori-600 hover:bg-ori-700 rounded-xl flex items-center gap-1 disabled:opacity-40 transition-colors"
                >
                  Câu sau
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">
              Không có câu hỏi phù hợp với bộ lọc.
            </div>
          )}
        </main>

        {/* QUESTION NAVIGATOR GRID WITH COLOR CODES */}
        <aside className="hidden lg:block w-72 border-l border-slate-200 bg-white p-4 overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">
              DANH SÁCH CÂU HỎI
            </h3>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q) => {
                const isCurrent = currentQuestion?.id === q.id;
                let bgClass = 'bg-slate-100 text-slate-600 border-slate-200';

                if (q.student_answer) {
                  if (q.is_correct) {
                    bgClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold';
                  } else {
                    bgClass = 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold';
                  }
                }

                if (isCurrent) {
                  bgClass += ' ring-2 ring-ori-600 ring-offset-1';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setActiveFilter('all');
                      const idx = questions.findIndex(item => item.id === q.id);
                      if (idx !== -1) setCurrentQIndex(idx);
                    }}
                    className={`h-9 rounded-xl border text-xs font-bold transition-all flex items-center justify-center ${bgClass}`}
                  >
                    {q.question_number}
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300 inline-block"></span>
                <span>Câu đúng</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-300 inline-block"></span>
                <span>Câu sai</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200 inline-block"></span>
                <span>Chưa trả lời</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
