import React, { useState, useRef } from 'react';
import {
  Globe,
  Highlighter,
  FileText,
  ChevronLeft,
  ChevronRight,
  Send,
  BookOpen,
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

export const Part7StudentWorkspace: React.FC<Part7StudentWorkspaceProps> = ({
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

  // Documents & Units
  const docs = group.documents && Array.isArray(group.documents) ? group.documents : [];
  const docsVi = group.documents_vi && Array.isArray(group.documents_vi) ? group.documents_vi : [];
  const bilingualUnits: any[] = Array.isArray((group as any).part7_bilingual_units) ? (group as any).part7_bilingual_units : [];

  // Question Range Label
  const sortedQs = [...questions].sort((a, b) => a.question_number - b.question_number);
  const firstQ = sortedQs[0]?.question_number || 147;
  const lastQ = sortedQs[sortedQs.length - 1]?.question_number || 150;
  const rangeLabel = `Câu ${firstQ}–${lastQ}`;

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
      {/* 1. TOP HEADER TOOLBAR */}
      <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-purple-600 font-extrabold text-xs rounded-full uppercase tracking-wider text-white shadow-xs">
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
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
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
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
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

      {/* 2. SPLIT WORKSPACE BODY (DESKTOP: 2 INDEPENDENT SCROLL PANELS) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden relative">
        {/* LEFT PANEL: READING DOCUMENTS (52% Desktop Width) */}
        <div
          ref={leftPanelRef}
          className={`
            md:col-span-6 lg:col-span-6 p-5 overflow-y-auto border-r border-slate-200 bg-white space-y-5
            ${mobileTab === 'document' ? 'block' : 'hidden md:block'}
          `}
          style={{ maxHeight: 'calc(100vh - 160px)' }}
        >
          {group.instruction && (
            <div className="text-xs font-bold text-slate-600 bg-slate-100/90 p-3 rounded-2xl border border-slate-200">
              {group.instruction}
              {!isMockExam && showBilingual && group.instruction_vi && (
                <div className="text-slate-500 mt-1 font-normal">{group.instruction_vi}</div>
              )}
            </div>
          )}

          {/* Render Documents */}
          {docs.map((doc: any, docIdx: number) => {
            const docVi = docsVi[docIdx] as any;
            const docUnits = bilingualUnits.filter((u: any) => u && u.document_index === docIdx);

            return (
              <div
                key={docIdx}
                className="bg-amber-50/60 border border-amber-200 rounded-3xl p-5 space-y-4 shadow-xs"
              >
                {/* Document Type Badge */}
                {docs.length > 1 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-200/80 text-amber-950 font-extrabold text-[11px] uppercase tracking-wider">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Document {docIdx + 1}{doc.type ? ` — ${doc.type}` : ''}</span>
                  </div>
                )}

                {/* Structured Interleaved Bilingual Units */}
                {!isMockExam && showBilingual && docUnits.length > 0 ? (
                  <div className="space-y-3">
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

                      return (
                        <div
                          key={uIdx}
                          ref={(el) => unitRefs.current.set(unitKey, el)}
                          className={`
                            p-3 rounded-2xl transition-all space-y-1.5
                            ${isEvidenceHighlighted
                              ? 'bg-amber-100 border-2 border-amber-400 ring-4 ring-amber-200/60 shadow-md'
                              : 'border border-amber-100 hover:border-amber-200'
                            }
                          `}
                        >
                          {unit.en && (
                            <div className="text-sm font-semibold text-slate-900 leading-relaxed flex items-start gap-2">
                              <span className="bg-slate-900 text-white font-black text-[10px] px-1.5 py-0.5 rounded tracking-wider shrink-0 mt-0.5">
                                🇬🇧 EN
                              </span>
                              <span>{unit.en}</span>
                            </div>
                          )}

                          {unit.vi && (
                            <div className="text-sm font-medium text-emerald-950 bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2.5 leading-relaxed flex items-start gap-2">
                              <span className="bg-emerald-800 text-white font-black text-[10px] px-1.5 py-0.5 rounded tracking-wider shrink-0 mt-0.5">
                                🇻🇳 VI
                              </span>
                              <span>{unit.vi}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Standard / Mock Exam English-Only Document View */
                  <div className="space-y-2">
                    {doc.title && (
                      <h4 className="text-base font-extrabold text-slate-900">{doc.title}</h4>
                    )}
                    <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-serif">
                      {doc.content}
                    </div>

                    {/* Fallback VI Translation in Practice Mode if bilingual units absent */}
                    {!isMockExam && showBilingual && docVi && (
                      <div className="mt-4 pt-3 border-t border-amber-200/80">
                        {docVi.title && <h5 className="text-xs font-bold text-emerald-900">{docVi.title}</h5>}
                        <div className="text-xs font-medium text-emerald-950 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-3 leading-relaxed whitespace-pre-wrap">
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

        {/* RIGHT PANEL: QUESTIONS LIST (48% Desktop Width, Independent Scroll) */}
        <div
          className={`
            md:col-span-6 lg:col-span-6 p-5 overflow-y-auto bg-slate-50 space-y-6
            ${mobileTab === 'questions' ? 'block' : 'hidden md:block'}
          `}
          style={{ maxHeight: 'calc(100vh - 160px)' }}
        >
          {sortedQs.map((q) => {
            const selectedOpt = answers.get(q.id) || null;
            const isAnswered = selectedOpt !== null;
            const hasEvidence = Array.isArray(q.evidence) && q.evidence.length > 0;

            return (
              <div
                key={q.id}
                className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow"
              >
                {/* Question Header & Evidence Toggle Button */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-purple-700 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                      {q.question_number}
                    </span>
                    <span className="font-extrabold text-slate-800 text-sm">Câu {q.question_number}</span>
                  </div>

                  {!isMockExam && hasEvidence && (
                    <button
                      type="button"
                      onClick={() => handleScrollToEvidence(q.question_number)}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[11px] rounded-xl flex items-center gap-1 transition-all shadow-xs"
                    >
                      <Highlighter className="w-3.5 h-3.5 text-amber-700" />
                      <span>Dẫn chứng Q{q.question_number}</span>
                    </button>
                  )}
                </div>

                {/* Question Stem (EN + VI) */}
                <div className="space-y-1.5">
                  <p className="text-sm font-extrabold text-slate-900 leading-snug">{q.question_text}</p>
                  {!isMockExam && showBilingual && q.translation_vi && (
                    <p className="text-xs font-semibold text-emerald-800 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-100">
                      🇻🇳 {q.translation_vi}
                    </p>
                  )}
                </div>

                {/* 4 Answer Options (A/B/C/D) */}
                <div className="space-y-2.5 pt-1">
                  {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                    const optEn = Array.isArray(q.options) ? q.options[optIdx] : '';
                    const optVi = !isMockExam && showBilingual && Array.isArray(q.options_vi) ? q.options_vi[optIdx] : '';
                    const isSelected = selectedOpt === letter;

                    // Option Styling logic
                    let btnStyle = 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 hover:border-slate-300';
                    let badgeStyle = 'bg-slate-200 text-slate-700';

                    if (isSelected) {
                      if (!isMockExam && isAnswered) {
                        // Practice Mode immediate feedback
                        if (letter === q.correct_answer) {
                          btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-200 font-bold';
                          badgeStyle = 'bg-emerald-600 text-white';
                        } else {
                          btnStyle = 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-200 font-bold';
                          badgeStyle = 'bg-rose-600 text-white';
                        }
                      } else {
                        // Mock Exam / Practice Selected before answer
                        btnStyle = 'border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-200 font-bold';
                        badgeStyle = 'bg-purple-600 text-white';
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
                        className={`w-full p-3.5 rounded-2xl border-2 transition-all flex items-start gap-3 text-left ${btnStyle}`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${badgeStyle}`}>
                          {letter}
                        </span>

                        <div className="flex-1 space-y-0.5">
                          <span className="text-xs font-semibold leading-relaxed block">{optEn || `(${letter})`}</span>
                          {optVi && (
                            <span className="text-[11px] font-medium text-emerald-800 block italic">{optVi}</span>
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
      <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between flex-wrap gap-3 text-xs font-extrabold">
        <div className="flex items-center gap-3">
          {/* Word Saving Popup Button */}
          {onSaveWord && !isMockExam && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setSaveWordOpen(!saveWordOpen)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span>📖 TRA / LƯU TỪ VỰNG</span>
              </button>

              {saveWordOpen && (
                <form
                  onSubmit={handleSaveWordSubmit}
                  className="absolute left-0 bottom-12 z-30 p-3 bg-white border border-slate-200 rounded-2xl shadow-xl w-72 space-y-2"
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
                      className="px-3 py-1 border rounded-lg text-slate-600 hover:bg-slate-100"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingWord || !saveWordInput.trim()}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
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
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Nhóm trước
            </button>
          )}

          {onNextGroup && groupIndex < totalGroups ? (
            <button
              type="button"
              onClick={onNextGroup}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1"
            >
              <span>Nhóm tiếp theo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            onSubmitTest && (
              <button
                type="button"
                onClick={onSubmitTest}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition-colors flex items-center gap-1.5"
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
