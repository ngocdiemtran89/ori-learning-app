// ============================================================
// Phase P3.5I: Admin Script & Bilingual Content Manager Modal
// ============================================================

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  BookOpen,
  Volume2,
  Save,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { importToeicLearningContent } from '../../lib/supabase/adminTestBank';
import { autoDetectAndParseScriptInput, ParsedScriptItem } from '../../lib/cms/scriptBulkParser';

export class ScriptBilingualErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose?: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onClose?: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ScriptBilingualErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <h3 className="text-base font-extrabold text-slate-900">
              Không thể tải giao diện Quản Lý Script & Song Ngữ
            </h3>
            <p className="text-xs text-slate-600">
              {this.state.error?.message || 'Đã xảy ra lỗi hệ thống khi mở modal.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onClose?.();
              }}
              className="px-5 py-2.5 bg-slate-900 text-white font-extrabold text-xs rounded-xl hover:bg-slate-800 transition-colors"
            >
              Đóng Cửa Sổ
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface ScriptBilingualManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  testId: string;
  testTitle: string;
  isPublished: boolean;
  existingQuestions: any[];
  existingGroups?: any[];
  onUpdated?: () => void;
}

type MainTab = 'listening' | 'reading' | 'bulk_import';
type ListeningSubTab = 'part1' | 'part2' | 'part3' | 'part4';
type ReadingSubTab = 'part5' | 'part6' | 'part7';

export const ScriptBilingualManagerModalContent: React.FC<ScriptBilingualManagerModalProps> = ({
  onClose,
  testId,
  testTitle,
  isPublished,
  existingQuestions = [],
  existingGroups = [],
  onUpdated,
}) => {
  const safeQuestions = Array.isArray(existingQuestions) ? existingQuestions : [];
  const safeGroups = Array.isArray(existingGroups) ? existingGroups : [];

  // Tab states
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('listening');
  const [listeningTab, setListeningTab] = useState<ListeningSubTab>('part1');
  const [readingTab, setReadingTab] = useState<ReadingSubTab>('part5');

  // Editable local state maps
  const [editedQuestions, setEditedQuestions] = useState<Map<string, any>>(() => {
    const map = new Map<string, any>();
    safeQuestions.forEach(q => {
      map.set(q.id || `q-${q.question_number}`, {
        id: q.id,
        question_number: q.question_number,
        part: q.part,
        question_text: q.question_text || '',
        options: Array.isArray(q.options) ? q.options.map((o: any) => ({ ...o })) : [],
        translation_vi: q.translation_vi || '',
        options_vi: Array.isArray(q.options_vi) ? [...q.options_vi] : [],
        explanation: q.explanation || '',
      });
    });
    return map;
  });

  const [editedGroups, setEditedGroups] = useState<Map<string, any>>(() => {
    const map = new Map<string, any>();
    safeGroups.forEach(g => {
      map.set(g.id || `g-${g.part}-${g.title}`, {
        id: g.id,
        part: g.part,
        title: g.title || '',
        instruction: g.instruction || '',
        instruction_vi: g.instruction_vi || '',
        passage: g.passage || '',
        passage_vi: g.passage_vi || '',
        transcript: g.transcript || '',
        transcript_vi: g.transcript_vi || '',
        documents: Array.isArray(g.documents) ? g.documents.map((d: any) => ({ ...d })) : [],
        documents_vi: Array.isArray(g.documents_vi) ? g.documents_vi.map((d: any) => ({ ...d })) : [],
      });
    });
    return map;
  });

  // Bulk import states
  const [bulkInputText, setBulkInputText] = useState('');
  const [bulkFormat, setBulkFormat] = useState<'auto' | 'json' | 'csv' | 'txt' | 'pdf'>('auto');
  const [parsedItems, setParsedItems] = useState<ParsedScriptItem[]>([]);
  const [detectedFormatName, setDetectedFormatName] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // COMPLETENESS DASHBOARD CALCULATIONS
  const completeness = useMemo(() => {
    let p1Script = 0, p1Vi = 0;
    let p2Script = 0, p2Vi = 0;
    let p3En = 0, p3Vi = 0;
    let p4En = 0, p4Vi = 0;
    let p5Vi = 0, p6Vi = 0, p7Vi = 0;

    safeQuestions.forEach(q => {
      const qState = editedQuestions.get(q.id || `q-${q.question_number}`);
      if (!qState) return;

      if (q.part === 'part1') {
        const hasRealEn = qState.options?.some((o: any) => o.text && !/^\([A-D]\)$/.test(o.text.trim()));
        if (hasRealEn) p1Script++;
        if (qState.options_vi?.some((v: string) => v && v.trim().length > 0)) p1Vi++;
      } else if (q.part === 'part2') {
        const hasRealEn = qState.question_text || qState.options?.some((o: any) => o.text && !/^\([A-D]\)$/.test(o.text.trim()));
        if (hasRealEn) p2Script++;
        if (qState.translation_vi || qState.options_vi?.some((v: string) => v && v.trim().length > 0)) p2Vi++;
      } else if (q.part === 'part5') {
        if (qState.translation_vi || qState.options_vi?.some((v: string) => v && v.trim().length > 0)) p5Vi++;
      } else if (q.part === 'part6') {
        if (qState.translation_vi) p6Vi++;
      } else if (q.part === 'part7') {
        if (qState.translation_vi) p7Vi++;
      }
    });

    safeGroups.forEach(g => {
      const gState = editedGroups.get(g.id || `g-${g.part}-${g.title}`);
      if (!gState) return;

      if (g.part === 'part3') {
        if (gState.transcript?.trim()) p3En++;
        if (gState.transcript_vi?.trim()) p3Vi++;
      } else if (g.part === 'part4') {
        if (gState.transcript?.trim()) p4En++;
        if (gState.transcript_vi?.trim()) p4Vi++;
      }
    });

    return {
      p1Script, p1Vi,
      p2Script, p2Vi,
      p3En, p3Vi,
      p4En, p4Vi,
      p5Vi, p6Vi, p7Vi,
    };
  }, [safeQuestions, safeGroups, editedQuestions, editedGroups]);

  // HANDLERS FOR EDITING QUESTIONS
  const updateQuestionState = (qId: string, updates: Partial<any>) => {
    setEditedQuestions(prev => {
      const next = new Map(prev);
      const existing = next.get(qId) || {};
      next.set(qId, { ...existing, ...updates });
      return next;
    });
  };

  const updateGroupState = (gId: string, updates: Partial<any>) => {
    setEditedGroups(prev => {
      const next = new Map(prev);
      const existing = next.get(gId) || {};
      next.set(gId, { ...existing, ...updates });
      return next;
    });
  };

  // SAVE ALL CHANGES VIA RPC
  const handleSaveContent = async () => {
    if (isPublished) {
      setStatusMessage({ type: 'error', text: 'Unpublish đề trước khi cập nhật Script / Song ngữ.' });
      return;
    }

    setSavingDraft(true);
    setStatusMessage(null);

    const questionUpdates: any[] = [];
    editedQuestions.forEach((val) => {
      questionUpdates.push({
        id: val.id,
        question_number: val.question_number,
        question_text: val.question_text || null,
        options: val.options,
        translation_vi: val.translation_vi || null,
        options_vi: val.options_vi?.length ? val.options_vi : null,
        explanation: val.explanation || null,
      });
    });

    const groupUpdates: any[] = [];
    editedGroups.forEach((val) => {
      groupUpdates.push({
        id: val.id,
        transcript: val.transcript || null,
        transcript_vi: val.transcript_vi || null,
        instruction: val.instruction || null,
        instruction_vi: val.instruction_vi || null,
        passage: val.passage || null,
        passage_vi: val.passage_vi || null,
        documents: val.documents,
        documents_vi: val.documents_vi?.length ? val.documents_vi : null,
      });
    });

    const res = await importToeicLearningContent(testId, {
      questions: questionUpdates,
      groups: groupUpdates,
    });

    setSavingDraft(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Đã lưu thành công! (Cập nhật ${res.updated_questions} câu hỏi, ${res.updated_groups} nhóm).`
      });
      onUpdated?.();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Lỗi khi lưu Script & Song ngữ.' });
    }
  };

  // BULK IMPORT PARSER
  const handleParseBulkInput = () => {
    setStatusMessage(null);
    setDetectedFormatName(null);

    const result = autoDetectAndParseScriptInput(bulkInputText, bulkFormat);
    setParsedItems(result.items);
    setDetectedFormatName(result.userFriendlyMessage || null);

    if (result.counters.errorsCount > 0 && result.items.length === 0) {
      setStatusMessage({
        type: 'error',
        text: result.userFriendlyMessage || 'JSON không hợp lệ.'
      });
    } else {
      setStatusMessage({
        type: 'success',
        text: `${result.userFriendlyMessage || 'Đã phân tích thành công'}. (Nhận diện ${result.counters.questionCount} câu, ${result.counters.groupCount} nhóm).`
      });
    }
  };

  const handleApplyParsedItems = () => {
    parsedItems.forEach(item => {
      if (item.targetType === 'question' && item.number) {
        const q = safeQuestions.find(q => q.question_number === item.number);
        if (q) {
          updateQuestionState(q.id || `q-${q.question_number}`, {
            ...(item.options && { options: item.options }),
            ...(item.options_vi && { options_vi: item.options_vi }),
            ...(item.question_text && { question_text: item.question_text }),
            ...(item.translation_vi && { translation_vi: item.translation_vi }),
            ...(item.explanation && { explanation: item.explanation }),
          });
        }
      } else if (item.targetType === 'group' && item.range) {
        const [startStr, endStr] = item.range.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        const g = safeGroups.find(g => {
          const qNums = safeQuestions.filter(q => q.group_id === g.id).map(q => q.question_number);
          return Math.min(...qNums) === start && Math.max(...qNums) === end;
        });
        if (g) {
          updateGroupState(g.id || `g-${g.part}-${g.title}`, {
            ...(item.transcript && { transcript: item.transcript }),
            ...(item.transcript_vi && { transcript_vi: item.transcript_vi }),
          });
        }
      }
    });
    setStatusMessage({ type: 'success', text: `Đã áp dụng ${parsedItems.length} mục vào bản nháp. Bấm "Lưu Thay Đổi" để hoàn tất.` });
    setParsedItems([]);
  };

  // RENDER QUESTION CARD FOR PART 1
  const renderPart1Card = (q: any) => {
    const qState = editedQuestions.get(q.id || `q-${q.question_number}`);
    if (!qState) return null;

    return (
      <div key={q.id || q.question_number} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="font-extrabold text-sm text-ori-700">Câu #{q.question_number} (Part 1)</span>
          {q.image_url && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">Có ảnh</span>}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-ori-600" />
            SCRIPT TIẾNG ANH (4 ĐÁP ÁN NÓI)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {['A', 'B', 'C', 'D'].map((label, idx) => {
              const currentOpt = qState.options[idx] || { label, text: '' };
              return (
                <div key={label} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="font-extrabold text-xs text-slate-700 w-5">({label})</span>
                  <input
                    type="text"
                    value={currentOpt.text || ''}
                    onChange={(e) => {
                      const nextOpts = [...(qState.options || [])];
                      nextOpts[idx] = { label, text: e.target.value };
                      updateQuestionState(qState.id || `q-${q.question_number}`, { options: nextOpts });
                    }}
                    placeholder={`Nội dung lời nói câu (${label})`}
                    className="flex-1 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ori-500"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-ori-600" />
            BẢN DỊCH TIẾNG VIỆT (4 ĐÁP ÁN)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {['A', 'B', 'C', 'D'].map((label, idx) => {
              const currentVi = qState.options_vi?.[idx] || '';
              return (
                <div key={label} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="font-extrabold text-xs text-slate-700 w-5">({label})</span>
                  <input
                    type="text"
                    value={currentVi}
                    onChange={(e) => {
                      const nextVi = [...(qState.options_vi || ['', '', '', ''])];
                      nextVi[idx] = e.target.value;
                      updateQuestionState(qState.id || `q-${q.question_number}`, { options_vi: nextVi });
                    }}
                    placeholder={`Bản dịch Tiếng Việt (${label})`}
                    className="flex-1 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ori-500"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // RENDER QUESTION CARD FOR PART 2
  const renderPart2Card = (q: any) => {
    const qState = editedQuestions.get(q.id || `q-${q.question_number}`);
    if (!qState) return null;

    return (
      <div key={q.id || q.question_number} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="font-extrabold text-sm text-ori-700">Câu #{q.question_number} (Part 2)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Prompt / Câu hỏi (English)</label>
            <input
              type="text"
              value={qState.question_text || ''}
              onChange={(e) => updateQuestionState(qState.id || `q-${q.question_number}`, { question_text: e.target.value })}
              placeholder="Ví dụ: When will the meeting start?"
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-ori-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Dịch Prompt (Tiếng Việt)</label>
            <input
              type="text"
              value={qState.translation_vi || ''}
              onChange={(e) => updateQuestionState(qState.id || `q-${q.question_number}`, { translation_vi: e.target.value })}
              placeholder="Ví dụ: Cuộc họp sẽ bắt đầu khi nào?"
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-ori-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700">3 Đáp Án Nói (English & Tiếng Việt)</label>
          {['A', 'B', 'C'].map((label, idx) => {
            const currentEn = qState.options[idx]?.text || '';
            const currentVi = qState.options_vi?.[idx] || '';
            return (
              <div key={label} className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-slate-700">({label}) EN</span>
                  <input
                    type="text"
                    value={currentEn}
                    onChange={(e) => {
                      const nextOpts = [...(qState.options || [])];
                      nextOpts[idx] = { label, text: e.target.value };
                      updateQuestionState(qState.id || `q-${q.question_number}`, { options: nextOpts });
                    }}
                    placeholder={`Lời nói (${label}) EN`}
                    className="flex-1 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-slate-700">({label}) VI</span>
                  <input
                    type="text"
                    value={currentVi}
                    onChange={(e) => {
                      const nextVi = [...(qState.options_vi || ['', '', ''])];
                      nextVi[idx] = e.target.value;
                      updateQuestionState(qState.id || `q-${q.question_number}`, { options_vi: nextVi });
                    }}
                    placeholder={`Dịch (${label}) VI`}
                    className="flex-1 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // RENDER GROUP CARD FOR PART 3 & PART 4
  const renderPart34GroupCard = (g: any) => {
    const gState = editedGroups.get(g.id || `g-${g.part}-${g.title}`);
    if (!gState) return null;

    const groupQuestions = safeQuestions.filter(q => q.group_id === g.id);
    const minQ = Math.min(...groupQuestions.map(q => q.question_number));
    const maxQ = Math.max(...groupQuestions.map(q => q.question_number));

    return (
      <div key={g.id || g.title} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="font-extrabold text-sm text-ori-700">
            Nhóm Q{minQ}–Q{maxQ} ({g.part?.toUpperCase()})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-ori-600" />
              TRANSCRIPT — ENGLISH
            </label>
            <textarea
              rows={6}
              value={gState.transcript || ''}
              onChange={(e) => updateGroupState(gState.id || `g-${g.part}-${g.title}`, { transcript: e.target.value })}
              placeholder="Nhập toàn bộ hội thoại / bài nói tiếng Anh..."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-ori-500 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-ori-600" />
              BẢN DỊCH — VIETNAMESE
            </label>
            <textarea
              rows={6}
              value={gState.transcript_vi || ''}
              onChange={(e) => updateGroupState(gState.id || `g-${g.part}-${g.title}`, { transcript_vi: e.target.value })}
              placeholder="Nhập bản dịch tiếng Việt tương ứng..."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-ori-500 font-mono"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-50 rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* MODAL HEADER */}
        <div className="p-5 bg-white border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-ori-600" />
              SCRIPT & SONG NGỮ — {testTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý lời thoại tiếng Anh và bản dịch song ngữ Tiếng Việt cho học viên xem lại post-submit.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveContent}
              disabled={savingDraft || isPublished}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{savingDraft ? 'Đang lưu...' : 'LƯU SCRIPT & SONG NGỮ'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PUBLISHED WARNING BANNER */}
        {isPublished && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-2 text-amber-800 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Đề thi đang ở trạng thái Xuất Bản (Published). Xem & chỉnh sửa bản nháp khả thi, nhưng nút Lưu sẽ bị khóa. Unpublish đề trước khi cập nhật dữ liệu.</span>
          </div>
        )}

        {/* STATUS MESSAGE */}
        {statusMessage && (
          <div className={`px-6 py-2.5 border-b text-xs font-extrabold flex items-center gap-2 ${
            statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* COMPLETENESS METRICS DASHBOARD */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center text-xs">
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="font-bold text-slate-600">Part 1 Script</div>
            <div className="font-extrabold text-ori-600">{completeness.p1Script}/6 EN • {completeness.p1Vi}/6 VI</div>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="font-bold text-slate-600">Part 2 Script</div>
            <div className="font-extrabold text-ori-600">{completeness.p2Script}/25 EN • {completeness.p2Vi}/25 VI</div>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="font-bold text-slate-600">Part 3 Group</div>
            <div className="font-extrabold text-ori-600">{completeness.p3En}/13 EN • {completeness.p3Vi}/13 VI</div>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="font-bold text-slate-600">Part 4 Group</div>
            <div className="font-extrabold text-ori-600">{completeness.p4En}/10 EN • {completeness.p4Vi}/10 VI</div>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="font-bold text-slate-600">Part 5 Dịch</div>
            <div className="font-extrabold text-ori-600">{completeness.p5Vi}/30 VI</div>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="font-bold text-slate-600">Part 6 Dịch</div>
            <div className="font-extrabold text-ori-600">{completeness.p6Vi}/16 VI</div>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="font-bold text-slate-600">Part 7 Dịch</div>
            <div className="font-extrabold text-ori-600">{completeness.p7Vi}/54 VI</div>
          </div>
        </div>

        {/* MAIN NAVIGATION TABS */}
        <div className="px-6 bg-white border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveMainTab('listening')}
              className={`py-3 px-4 text-xs font-extrabold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeMainTab === 'listening' ? 'border-ori-600 text-ori-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Volume2 className="w-4 h-4" /> LISTENING (PART 1–4)
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab('reading')}
              className={`py-3 px-4 text-xs font-extrabold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeMainTab === 'reading' ? 'border-ori-600 text-ori-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <BookOpen className="w-4 h-4" /> READING (PART 5–7)
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab('bulk_import')}
              className={`py-3 px-4 text-xs font-extrabold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeMainTab === 'bulk_import' ? 'border-ori-600 text-ori-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Upload className="w-4 h-4" /> BULK IMPORT (PDF/TXT/CSV/JSON)
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeMainTab === 'listening' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
                {(['part1', 'part2', 'part3', 'part4'] as ListeningSubTab[]).map(pt => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setListeningTab(pt)}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors ${
                      listeningTab === pt ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {pt.toUpperCase()}
                  </button>
                ))}
              </div>

              {listeningTab === 'part1' && (
                <div className="space-y-4">
                  {safeQuestions.filter(q => q.part === 'part1').map(renderPart1Card)}
                </div>
              )}

              {listeningTab === 'part2' && (
                <div className="space-y-4">
                  {safeQuestions.filter(q => q.part === 'part2').map(renderPart2Card)}
                </div>
              )}

              {listeningTab === 'part3' && (
                <div className="space-y-4">
                  {safeGroups.filter(g => g.part === 'part3').map(renderPart34GroupCard)}
                </div>
              )}

              {listeningTab === 'part4' && (
                <div className="space-y-4">
                  {safeGroups.filter(g => g.part === 'part4').map(renderPart34GroupCard)}
                </div>
              )}
            </div>
          )}

          {activeMainTab === 'reading' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
                {(['part5', 'part6', 'part7'] as ReadingSubTab[]).map(pt => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setReadingTab(pt)}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors ${
                      readingTab === pt ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {pt.toUpperCase()}
                  </button>
                ))}
              </div>

              {readingTab === 'part5' && (
                <div className="space-y-4">
                  {safeQuestions.filter(q => q.part === 'part5').map(q => {
                    const qState = editedQuestions.get(q.id || `q-${q.question_number}`);
                    if (!qState) return null;

                    return (
                      <div key={q.id || q.question_number} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                        <div className="font-extrabold text-xs text-ori-700">Câu #{q.question_number} (Part 5)</div>
                        <div className="text-xs text-slate-800 font-bold">{q.question_text}</div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Dịch Tiếng Việt câu hỏi (`translation_vi`)</label>
                          <input
                            type="text"
                            value={qState.translation_vi || ''}
                            onChange={(e) => updateQuestionState(qState.id || `q-${q.question_number}`, { translation_vi: e.target.value })}
                            placeholder="Nhập bản dịch Tiếng Việt cho câu hỏi..."
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Giải thích chi tiết (`explanation`)</label>
                          <textarea
                            rows={2}
                            value={qState.explanation || ''}
                            onChange={(e) => updateQuestionState(qState.id || `q-${q.question_number}`, { explanation: e.target.value })}
                            placeholder="Nhập phần giải thích ngữ pháp/từ vựng..."
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(readingTab === 'part6' || readingTab === 'part7') && (
                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
                  Hiển thị nhóm bài đọc Part {readingTab === 'part6' ? '6' : '7'} ({safeGroups.filter(g => g.part === readingTab).length} nhóm bài). Bản dịch đoạn văn & câu hỏi được lưu nguyên vẹn theo cấu trúc đoạn.
                </div>
              )}
            </div>
          )}

          {activeMainTab === 'bulk_import' && (
            <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-ori-600" />
                  BULK IMPORT NỘI DUNG SCRIPT & SONG NGỮ
                </h3>

                <div className="flex items-center gap-2">
                  {(['auto', 'json', 'csv', 'txt', 'pdf'] as const).map(fmt => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => {
                        setBulkFormat(fmt);
                        setStatusMessage(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-colors ${
                        bulkFormat === fmt ? 'bg-ori-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {fmt === 'auto' ? '⚡ AUTO' : fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={10}
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  placeholder={`Dán nội dung script tiếng Anh / bản dịch tiếng Việt tại đây (tự động nhận diện format TXT, JSON, CSV)...\n\nFormat mẫu:\nCÂU 1\n\nSCRIPT TIẾNG ANH\n(A) Statement A\n(B) Statement B\n\nBẢN DỊCH TIẾNG VIỆT\n(A) Lời dịch A...`}
                  className="w-full text-xs p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-1 focus:ring-ori-500"
                />
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleParseBulkInput}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-colors"
                  >
                    PHÂN TÍCH DỮ LIỆU INPUT
                  </button>

                  {bulkFormat === 'json' && statusMessage?.type === 'error' && (
                    <button
                      type="button"
                      onClick={() => {
                        setBulkFormat('auto');
                        const res = autoDetectAndParseScriptInput(bulkInputText, 'auto');
                        setParsedItems(res.items);
                        setDetectedFormatName(res.userFriendlyMessage || null);
                        setStatusMessage({
                          type: 'success',
                          text: 'ORI nhận thấy nội dung này là văn bản thường, không phải JSON. Đã tự chuyển sang chế độ TXT.'
                        });
                      }}
                      className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>THỬ NHẬN DIỆN TỰ ĐỘNG</span>
                    </button>
                  )}
                </div>

                {parsedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyParsedItems}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors"
                  >
                    ÁP DỤNG {parsedItems.length} MỤC VÀO BẢN NHÁP
                  </button>
                )}
              </div>

              {parsedItems.length > 0 && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 max-h-72 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-extrabold text-slate-800">
                      KẾT QUẢ PHÂN TÍCH INPUT ({parsedItems.length} mục)
                    </div>
                    {detectedFormatName && (
                      <span className="text-[11px] font-bold text-ori-700 bg-ori-50 px-2 py-0.5 rounded-md border border-ori-200">
                        {detectedFormatName}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {parsedItems.map((item, idx) => {
                      const hasEn = Boolean(item.options?.length || item.question_text || item.transcript);
                      const hasVi = Boolean(item.options_vi?.length || item.translation_vi || item.transcript_vi);

                      return (
                        <div key={idx} className="text-xs p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-xs">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-slate-900">
                              {item.targetType === 'question' ? `Câu #${item.number}` : `Nhóm ${item.range}`}
                            </span>
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className={hasEn ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                                Script EN {hasEn ? '✓' : '✗'}
                              </span>
                              <span className={hasVi ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                                Bản dịch VI {hasVi ? '✓' : '✗'}
                              </span>
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono text-[10px]">
                                Target: {item.targetType === 'question' ? `Q${item.number} → q.options / q.options_vi` : `Q${item.range} → g.transcript`}
                              </span>
                            </div>
                          </div>

                          {/* Quick summary snippet */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                            <div>
                              <strong className="text-slate-700">EN:</strong>{' '}
                              {item.options ? item.options.map(o => `(${o.label}) ${o.text}`).join(' ') : (item.question_text || item.transcript || 'Chưa có')}
                            </div>
                            <div>
                              <strong className="text-slate-700">VI:</strong>{' '}
                              {item.options_vi ? item.options_vi.map((v, i) => `(${String.fromCharCode(65+i)}) ${v}`).join(' ') : (item.translation_vi || item.transcript_vi || 'Chưa có')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const SafeScriptBilingualManagerModal: React.FC<ScriptBilingualManagerModalProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <ScriptBilingualErrorBoundary onClose={props.onClose}>
      <ScriptBilingualManagerModalContent {...props} />
    </ScriptBilingualErrorBoundary>
  );
};
