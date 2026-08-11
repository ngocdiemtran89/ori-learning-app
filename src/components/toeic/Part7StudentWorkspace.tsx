import React, { useState, useRef, useMemo } from 'react';
import {
  Globe,
  Highlighter,
  FileText,
  ChevronLeft,
  ChevronRight,
  Send,
  BookOpen,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { StudentToeicQuestion, StudentToeicGroup } from '../../lib/supabase/types';

export interface Part7StudentWorkspaceProps {
  group: StudentToeicGroup;
  questions: StudentToeicQuestion[];
  isPartMode: boolean; // true = practice/bilingual mode; false = full/mock exam (English ONLY)
  answers: Map<string, string>;
  onSelectAnswer: (questionId: string, answer: string) => void;
  onPrevGroup?: () => void;
  onNextGroup?: () => void;
  onSubmitTest?: () => void;
  groupIndex?: number;
  totalGroups?: number;
  onSaveWord?: (word: string, context: string) => Promise<void>;
}

/** Fail-safe Error Boundary component to prevent Part 7 rendering crashes from blanking the page */
export class Part7ErrorBoundary extends React.Component<
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
    console.error('Part7ErrorBoundary caught render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center space-y-4 max-w-md mx-auto my-12 shadow-lg">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            <AlertTriangle className="w-7 h-7 text-rose-600" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900">
              Không thể hiển thị bài đọc này
            </h3>
            <p className="text-xs text-slate-600">
              Vui lòng tải lại trang hoặc chuyển sang bài tiếp theo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onRetry) {
                this.props.onRetry();
              } else {
                window.location.reload();
              }
            }}
            className="px-5 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-extrabold text-xs rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tải lại trang</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Safe string converter for option content (handles objects, nulls, numbers gracefully) */
function getOptionText(opt: any): string {
  if (opt == null) return '';
  if (typeof opt === 'string') return opt;
  if (typeof opt === 'number' || typeof opt === 'boolean') return String(opt);
  if (typeof opt === 'object') {
    return opt.text || opt.content || opt.value || opt.label || JSON.stringify(opt);
  }
  return String(opt);
}

const Part7StudentWorkspaceView: React.FC<Part7StudentWorkspaceProps> = ({
  group,
  questions,
  isPartMode,
  answers,
  onSelectAnswer,
  onPrevGroup,
  onNextGroup,
  onSubmitTest,
  groupIndex = 1,
  totalGroups = 1,
  onSaveWord,
}) => {
  // Mode States (Bilingual & Evidence toggles active ONLY in Practice/Part mode)
  const [showBilingual, setShowBilingual] = useState<boolean>(true);
  const [showEvidence, setShowEvidence] = useState<boolean>(false);
  const [selectedEvidenceQNum, setSelectedEvidenceQNum] = useState<number | null>(null);

  // Active Mobile View Tab
  const [mobileTab, setMobileTab] = useState<'document' | 'questions'>('document');

  // Word Saving State
  const [saveWordInput, setSaveWordInput] = useState<string>('');
  const [saveWordOpen, setSaveWordOpen] = useState<boolean>(false);
  const [savingWord, setSavingWord] = useState<boolean>(false);
  const [wordSaved, setWordSaved] = useState<boolean>(false);

  // Refs for smooth scrolling to evidence units
  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const unitRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const isMockExam = !isPartMode; // Security guard: Mock exam = English ONLY!

  // Documents Normalization (Fallback from group.documents to group.passage)
  const docs = useMemo(() => {
    if (!group) return [];
    if (group.documents && Array.isArray(group.documents) && group.documents.length > 0) {
      return group.documents.map((d: any) => {
        if (typeof d === 'string') return { content: d, title: '', type: '' };
        if (typeof d === 'object' && d !== null) {
          return {
            content: typeof d.content === 'string' ? d.content : (d.text || d.passage || ''),
            title: typeof d.title === 'string' ? d.title : '',
            type: typeof d.type === 'string' ? d.type : '',
          };
        }
        return { content: String(d || ''), title: '', type: '' };
      });
    }
    if (group.passage && typeof group.passage === 'string' && group.passage.trim().length > 0) {
      return [{ content: group.passage, title: group.title || '', type: '' }];
    }
    return [];
  }, [group]);

  // Documents VI Normalization (Fallback from group.documents_vi to group.passage_vi)
  const docsVi = useMemo(() => {
    if (!group) return [];
    if (group.documents_vi && Array.isArray(group.documents_vi) && group.documents_vi.length > 0) {
      return group.documents_vi.map((d: any) => {
        if (typeof d === 'string') return { content: d, title: '', type: '' };
        if (typeof d === 'object' && d !== null) {
          return {
            content: typeof d.content === 'string' ? d.content : (d.text || d.passage || ''),
            title: typeof d.title === 'string' ? d.title : '',
            type: typeof d.type === 'string' ? d.type : '',
          };
        }
        return { content: String(d || ''), title: '', type: '' };
      });
    }
    if (group.passage_vi && typeof group.passage_vi === 'string' && group.passage_vi.trim().length > 0) {
      return [{ content: group.passage_vi, title: group.title || '', type: '' }];
    }
    return [];
  }, [group]);

  // Optional Bilingual Units (Safely handle null/undefined)
  const bilingualUnits: any[] = useMemo(() => {
    if (!group) return [];
    const units = (group as any).part7_bilingual_units;
    return Array.isArray(units) ? units : [];
  }, [group]);

  // Development Integrity Guard (Filter questions to ensure q.group_id === group.id)
  const sortedQs = useMemo(() => {
    const valid = Array.isArray(questions) ? questions.filter(Boolean) : [];
    const matched = valid.filter((q) => {
      if (group && group.id && q.group_id && q.group_id !== group.id) {
        console.warn(`Part7IntegrityGuard: Filtered question Q${q.question_number} (group_id ${q.group_id}) from group ${group.id}`);
        return false;
      }
      return true;
    });
    return [...matched].sort((a, b) => (a.question_number || 0) - (b.question_number || 0));
  }, [questions, group]);

  const firstQ = sortedQs[0]?.question_number || 147;
  const lastQ = sortedQs[sortedQs.length - 1]?.question_number || 150;
  const rangeLabel = sortedQs.length > 0 ? `Câu ${firstQ}–${lastQ}` : 'Nhóm đọc Part 7';

  const handleScrollToEvidence = (qNum: number, unitIdx?: number) => {
    setSelectedEvidenceQNum(qNum);
    setShowEvidence(true);

    if (unitIdx !== undefined) {
      const key = `unit-${unitIdx}`;
      const el = unitRefs.current.get(key);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleSaveWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveWordInput.trim() || !onSaveWord) return;

    setSavingWord(true);
    try {
      await onSaveWord(saveWordInput.trim(), group.passage || docs[0]?.content || '');
      setWordSaved(true);
      setTimeout(() => {
        setSaveWordInput('');
        setWordSaved(false);
        setSaveWordOpen(false);
      }, 1500);
    } catch {
      // ignore
    } finally {
      setSavingWord(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-full bg-slate-100 rounded-3xl overflow-hidden shadow-xl border border-slate-200">
      {/* 1. TOP HEADER TOOLBAR (Compact, High-Contrast) */}
      <div className="px-5 py-2.5 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2 rounded-t-3xl border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-purple-600 font-extrabold text-[11px] rounded-full uppercase tracking-wider text-white shadow-xs">
            PART 7 READING WORKSPACE
          </span>
          <span className="font-extrabold text-sm text-slate-200">
            {rangeLabel} <span className="text-slate-400 font-normal">({sortedQs.length} câu hỏi)</span>
          </span>
          <span className="text-xs text-slate-400 font-mono">
            Nhóm {groupIndex}/{totalGroups}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Practice/Part Mode Controls (Hidden in Mock Exam Mode) */}
          {!isMockExam && (
            <>
              <button
                type="button"
                onClick={() => setShowBilingual(!showBilingual)}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  showBilingual
                    ? 'bg-amber-400 text-amber-950 hover:bg-amber-300'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>🌐 SONG NGỮ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowEvidence(!showEvidence);
                  if (showEvidence) setSelectedEvidenceQNum(null);
                }}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  showEvidence
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Highlighter className="w-3.5 h-3.5" />
                <span>🖍 DẪN CHỨNG</span>
              </button>
            </>
          )}

          {/* Mobile Tab Switcher */}
          <div className="md:hidden flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setMobileTab('document')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                mobileTab === 'document' ? 'bg-purple-600 text-white' : 'text-slate-400'
              }`}
            >
              📖 BÀI ĐỌC
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('questions')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                mobileTab === 'questions' ? 'bg-purple-600 text-white' : 'text-slate-400'
              }`}
            >
              ❓ CÂU HỎI ({sortedQs.length})
            </button>
          </div>
        </div>
      </div>

      {/* 2. SPLIT WORKSPACE BODY (DESKTOP 58% / 42% WITH INDEPENDENT SCROLL) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden relative">
        {/* LEFT PANEL: READING DOCUMENTS (58% Desktop Width, High Legibility White Background) */}
        <div
          ref={leftPanelRef}
          className={`
            md:col-span-7 lg:col-span-7 p-6 overflow-y-auto border-r border-slate-200 bg-white space-y-6 pointer-events-auto
            ${mobileTab === 'document' ? 'block' : 'hidden md:block'}
          `}
          style={{ maxHeight: 'calc(100vh - 110px)' }}
        >
          {group?.instruction && (
            <div className="text-xs font-bold text-slate-600 bg-slate-100/90 p-3.5 rounded-2xl border border-slate-200">
              {group.instruction}
              {!isMockExam && showBilingual && group.instruction_vi && (
                <div className="text-slate-500 mt-1 font-normal">{group.instruction_vi}</div>
              )}
            </div>
          )}

          {/* Fallback if no documents or passage */}
          {docs.length === 0 && (
            <div className="p-6 bg-amber-50/80 border border-amber-200 rounded-2xl text-center text-xs font-bold text-amber-900 italic space-y-1">
              <p>Nội dung bài đọc của nhóm này chưa khớp. Vui lòng báo quản trị viên.</p>
            </div>
          )}

          {/* Render Documents */}
          {docs.map((doc: any, docIdx: number) => {
            const docVi = docsVi[docIdx] as any;
            const docUnits = bilingualUnits.filter((u: any) => u && u.document_index === docIdx);

            return (
              <div
                key={docIdx}
                className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm"
              >
                {/* Document Type Badge */}
                {docs.length > 1 && (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider shadow-xs">
                    <FileText className="w-3.5 h-3.5 text-purple-400" />
                    <span>Document {docIdx + 1}{doc.type ? ` — ${doc.type}` : ''}</span>
                  </div>
                )}

                {/* Structured Interleaved Bilingual Units */}
                {!isMockExam && showBilingual && docUnits.length > 0 ? (
                  <div className="space-y-3.5">
                    {docUnits.map((unit: any, uIdx: number) => {
                      const unitKey = `unit-${uIdx}`;
                      const isEvidenceHighlighted =
                        (!isMockExam && showEvidence) ||
                        (selectedEvidenceQNum !== null &&
                          sortedQs.some((q) => {
                            if (q.question_number !== selectedEvidenceQNum) return false;
                            const evList = Array.isArray(q.evidence) ? q.evidence : [];
                            return evList.some((ev: any) => ev.document_index === docIdx && (ev.order === uIdx || ev.unit_id === unit.unit_id));
                          }));

                      const unitEnText = typeof unit.en === 'string' ? unit.en : (unit.en ? String(unit.en) : '');
                      const unitViText = typeof unit.vi === 'string' ? unit.vi : (unit.vi ? String(unit.vi) : '');

                      return (
                        <div
                          key={uIdx}
                          ref={(el) => unitRefs.current.set(unitKey, el)}
                          className={`
                            p-3.5 rounded-2xl transition-all space-y-1.5 pointer-events-auto
                            ${isEvidenceHighlighted
                              ? 'bg-amber-100/90 border-2 border-amber-500 ring-4 ring-amber-200/80 shadow-md'
                              : 'border border-slate-100 hover:border-slate-300'
                            }
                          `}
                        >
                          {unitEnText && (
                            <div className="text-[15px] font-medium text-slate-900 leading-relaxed flex items-start gap-2.5">
                              <span className="bg-slate-900 text-white font-black text-[10px] px-1.5 py-0.5 rounded tracking-wider shrink-0 mt-0.5 select-none">
                                🇬🇧 EN
                              </span>
                              <span className="font-serif">{unitEnText}</span>
                            </div>
                          )}

                          {unitViText && (
                            <div className="text-sm font-medium text-emerald-950 bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2.5 leading-relaxed flex items-start gap-2.5">
                              <span className="bg-emerald-800 text-white font-black text-[10px] px-1.5 py-0.5 rounded tracking-wider shrink-0 mt-0.5 select-none">
                                🇻🇳 VI
                              </span>
                              <span>{unitViText}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Standard / Mock Exam High-Legibility Document View */
                  <div className="space-y-3">
                    {doc.title && (
                      <h4 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">{doc.title}</h4>
                    )}
                    <div className="text-[15px] text-slate-900 leading-relaxed whitespace-pre-wrap font-serif tracking-normal">
                      {doc.content}
                    </div>

                    {/* Fallback VI Translation in Practice Mode if bilingual units absent */}
                    {!isMockExam && showBilingual && docVi && (
                      <div className="mt-4 pt-3.5 border-t border-slate-200">
                        {docVi.title && <h5 className="text-xs font-bold text-emerald-900 mb-1">{docVi.title}</h5>}
                        <div className="text-sm font-medium text-emerald-950 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-3.5 leading-relaxed whitespace-pre-wrap">
                          {docVi.content}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT PANEL: QUESTIONS LIST (42% Desktop Width, Independent Scroll) */}
        <div
          className={`
            md:col-span-5 lg:col-span-5 p-6 overflow-y-auto bg-slate-50 space-y-6 pointer-events-auto
            ${mobileTab === 'questions' ? 'block' : 'hidden md:block'}
          `}
          style={{ maxHeight: 'calc(100vh - 110px)' }}
        >
          {sortedQs.length === 0 && (
            <div className="p-6 bg-white border border-slate-200 rounded-3xl text-center text-xs font-bold text-slate-500 italic">
              Chưa có câu hỏi cho nhóm đọc này.
            </div>
          )}

          {sortedQs.map((q) => {
            const selectedOpt = answers?.get ? (answers.get(q.id) || null) : null;
            const isAnswered = selectedOpt !== null;
            const hasEvidence = Array.isArray(q.evidence) && q.evidence.length > 0;

            return (
              <div
                key={q.id}
                className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow pointer-events-auto"
              >
                {/* Question Header & Evidence Toggle Button */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-purple-700 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                      {q.question_number}
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm">Câu {q.question_number}</span>
                  </div>

                  {!isMockExam && hasEvidence && (
                    <button
                      type="button"
                      onClick={() => handleScrollToEvidence(q.question_number)}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[11px] rounded-xl flex items-center gap-1 transition-all shadow-xs cursor-pointer pointer-events-auto"
                    >
                      <Highlighter className="w-3.5 h-3.5 text-amber-700" />
                      <span>Dẫn chứng Q{q.question_number}</span>
                    </button>
                  )}
                </div>

                {/* Question Stem (EN + VI) */}
                <div className="space-y-1.5">
                  <p className="text-[16px] font-extrabold text-slate-900 leading-snug">{q.question_text}</p>
                  {!isMockExam && showBilingual && q.translation_vi && (
                    <p className="text-xs font-semibold text-emerald-800 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-100">
                      🇻🇳 {q.translation_vi}
                    </p>
                  )}
                </div>

                {/* 4 Interactive Answer Option Buttons (A/B/C/D) */}
                <div className="space-y-2.5 pt-1 pointer-events-auto">
                  {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                    const rawOptEn = Array.isArray(q.options) ? q.options[optIdx] : '';
                    const rawOptVi = !isMockExam && showBilingual && Array.isArray(q.options_vi) ? q.options_vi[optIdx] : '';
                    
                    const optEn = getOptionText(rawOptEn);
                    const optVi = getOptionText(rawOptVi);
                    const isSelected = selectedOpt === letter;

                    // Option Styling logic
                    let btnStyle = 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 hover:border-slate-300';
                    let badgeStyle = 'bg-slate-200 text-slate-700';

                    if (isSelected) {
                      if (!isMockExam && isAnswered) {
                        // Practice Mode immediate feedback
                        if (letter === q.correct_answer) {
                          btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-300 font-bold shadow-xs';
                          badgeStyle = 'bg-emerald-600 text-white';
                        } else {
                          btnStyle = 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-300 font-bold shadow-xs';
                          badgeStyle = 'bg-rose-600 text-white';
                        }
                      } else {
                        // Mock Exam / Practice Selected before answer reveal
                        btnStyle = 'border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-300 font-bold shadow-xs';
                        badgeStyle = 'bg-purple-700 text-white';
                      }
                    } else if (!isMockExam && isAnswered && letter === q.correct_answer) {
                      // Highlight correct choice in practice mode if wrong selected
                      btnStyle = 'border-emerald-400 bg-emerald-50/60 text-emerald-950 font-bold';
                      badgeStyle = 'bg-emerald-600 text-white';
                    }

                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => onSelectAnswer(q.id, letter)}
                        className={`w-full min-h-[44px] p-3.5 rounded-2xl border-2 transition-all flex items-start gap-3 text-left cursor-pointer pointer-events-auto select-none ${btnStyle}`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${badgeStyle}`}>
                          {letter}
                        </span>

                        <div className="flex-1 space-y-0.5">
                          <span className="text-sm font-semibold leading-relaxed block">{optEn || `(${letter})`}</span>
                          {optVi && (
                            <span className="text-xs font-medium text-emerald-800 block italic">{optVi}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. BOTTOM STICKY CONTROL TOOLBAR */}
      <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between flex-wrap gap-3 text-xs font-extrabold pointer-events-auto">
        <div className="flex items-center gap-3">
          {/* Word Saving Popup Button */}
          {onSaveWord && !isMockExam && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setSaveWordOpen(!saveWordOpen)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>📖 TRA / LƯU TỪ VỰNG</span>
              </button>

              {saveWordOpen && (
                <form
                  onSubmit={handleSaveWordSubmit}
                  className="absolute left-0 bottom-12 z-30 p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xl w-72 space-y-2.5 pointer-events-auto"
                >
                  <label className="font-extrabold text-slate-800 block">Lưu từ vào sổ tay Part 7:</label>
                  <input
                    type="text"
                    value={saveWordInput}
                    onChange={(e) => setSaveWordInput(e.target.value)}
                    placeholder="Nhập từ Tiếng Anh..."
                    className="w-full px-3 py-1.5 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSaveWordOpen(false)}
                      className="px-3 py-1 border rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingWord || !saveWordInput.trim()}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      {savingWord ? 'Đang lưu...' : wordSaved ? '✓ Đã lưu!' : 'Lưu Sổ Tay'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Group Navigation */}
        <div className="flex items-center gap-2">
          {onPrevGroup && (
            <button
              type="button"
              onClick={onPrevGroup}
              disabled={groupIndex <= 1}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Nhóm trước
            </button>
          )}

          {onNextGroup && groupIndex < totalGroups ? (
            <button
              type="button"
              onClick={onNextGroup}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Nhóm tiếp theo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            onSubmitTest && (
              <button
                type="button"
                onClick={onSubmitTest}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>NỘP BÀI THI</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export const Part7StudentWorkspace: React.FC<Part7StudentWorkspaceProps> = (props) => (
  <Part7ErrorBoundary>
    <Part7StudentWorkspaceView {...props} />
  </Part7ErrorBoundary>
);
