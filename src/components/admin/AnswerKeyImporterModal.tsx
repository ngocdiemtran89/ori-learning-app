import React, { useState, useMemo } from 'react';
import {
  X,
  UploadCloud,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ListChecks,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { parseAnswerKeyText } from '../../lib/toeicPackage/answerKeyParser';
import { extractPdfTextItems } from '../../lib/cms/pdfUtils';
import { importToeicAnswerKey } from '../../lib/supabase/adminTestBank';
import { CANONICAL_TOEIC_PARTS, TOEIC_FULL_TEST_STRUCTURE } from '../../lib/toeic/testStructure';

interface AnswerKeyImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  testId: string;
  testTitle: string;
  isPublished: boolean;
  existingQuestions?: Array<{
    id?: string;
    question_number?: number;
    part?: string;
    correct_answer?: string;
    options?: any[];
  }>;
  onUpdated: () => void;
}

type ImportMode = 'full' | 'partial';

interface ParsedComparisonItem {
  questionNumber: number;
  part: string;
  currentAnswer: string;
  newAnswer: string | null;
  status: 'changed' | 'unchanged' | 'missing' | 'invalid';
  errorMessage?: string;
}

// React Error Boundary to prevent app-wide white screens
export class AnswerKeyErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onClose: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AnswerKeyImporterModal ErrorBoundary caught exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <h3 className="text-base font-extrabold text-slate-900">
              Không thể mở công cụ Import Answer Key
            </h3>
            <p className="text-xs text-slate-500">
              {this.state.error?.message || 'Đã xảy ra lỗi giao diện khi tải bộ import đáp án.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onClose();
              }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const AnswerKeyImporterModal: React.FC<AnswerKeyImporterModalProps> = ({
  isOpen,
  onClose,
  testId,
  testTitle,
  isPublished,
  existingQuestions = [],
  onUpdated,
}) => {
  const [importMode, setImportMode] = useState<ImportMode>('full');
  const [inputText, setInputText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [showCurrentOverview, setShowCurrentOverview] = useState(false);

  // Execution state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessResult, setSubmitSuccessResult] = useState<{
    updatedCount: number;
    unchangedCount: number;
    totalReceived: number;
  } | null>(null);

  if (!isOpen) return null;

  // Ultra-safe array normalization
  const safeQuestions = Array.isArray(existingQuestions)
    ? existingQuestions.filter(q => q && typeof q === 'object')
    : [];
  const loadedQuestionsCount = safeQuestions.length;

  // Handle file select (PDF, TXT, CSV, JSON)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPdfError(null);
    setIsReadingFile(true);

    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const items = await extractPdfTextItems(file);
        const fullText = (items || []).map(i => i?.text || '').join(' ');
        if (!fullText.trim()) {
          setPdfError(
            'Không thể đọc chữ từ PDF này. Vui lòng dùng PDF có text, TXT, CSV, JSON hoặc Paste đáp án.'
          );
          setInputText('');
        } else {
          setInputText(fullText);
        }
      } else {
        const text = await file.text();
        setInputText(text || '');
      }
    } catch (err: any) {
      setPdfError(err?.message || 'Lỗi khi đọc file PDF/văn bản.');
      setInputText('');
    }
    setIsReadingFile(false);
  };

  // Drag & drop support
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPdfError(null);
    setIsReadingFile(true);

    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const items = await extractPdfTextItems(file);
        const fullText = (items || []).map(i => i?.text || '').join(' ');
        if (!fullText.trim()) {
          setPdfError(
            'Không thể đọc chữ từ PDF này. Vui lòng dùng PDF có text, TXT, CSV, JSON hoặc Paste đáp án.'
          );
          setInputText('');
        } else {
          setInputText(fullText);
        }
      } else {
        const text = await file.text();
        setInputText(text || '');
      }
    } catch (err: any) {
      setPdfError(err?.message || 'Lỗi khi đọc file.');
      setInputText('');
    }
    setIsReadingFile(false);
  };

  // Parsed answer map from input text
  const parsedRawMap = useMemo(() => {
    if (!inputText || !inputText.trim()) return new Map<number, string>();
    try {
      const res = parseAnswerKeyText(inputText);
      const map = new Map<number, string>();
      if (res && Array.isArray(res.answers)) {
        res.answers.forEach(item => {
          if (item && typeof item.question_number === 'number' && item.correct_answer) {
            map.set(item.question_number, String(item.correct_answer).toUpperCase());
          }
        });
      }
      return map;
    } catch (err) {
      console.warn('parseAnswerKeyText exception handled silently:', err);
      return new Map<number, string>();
    }
  }, [inputText]);

  // Build 200 comparison items
  const comparisonItems = useMemo((): ParsedComparisonItem[] => {
    const items: ParsedComparisonItem[] = [];

    for (let qNum = 1; qNum <= 200; qNum++) {
      const qExist = safeQuestions.find(q => q && q.question_number === qNum);
      const currentAnswer = qExist?.correct_answer || 'A';
      const part = qExist?.part || 'part1';
      const newAnswer = parsedRawMap.get(qNum) || null;

      let status: ParsedComparisonItem['status'] = 'unchanged';
      let errorMessage: string | undefined;

      if (newAnswer) {
        if (!['A', 'B', 'C', 'D'].includes(newAnswer)) {
          status = 'invalid';
          errorMessage = `Đáp án ${newAnswer} không hợp lệ (chỉ chấp nhận A, B, C, D)`;
        } else if (currentAnswer !== newAnswer) {
          status = 'changed';
        } else {
          status = 'unchanged';
        }
      } else {
        if (importMode === 'full') {
          status = 'missing';
          errorMessage = 'Thiếu đáp án cho câu này';
        } else {
          status = 'unchanged';
        }
      }

      items.push({
        questionNumber: qNum,
        part,
        currentAnswer,
        newAnswer,
        status,
        errorMessage,
      });
    }

    return items;
  }, [safeQuestions, parsedRawMap, importMode]);

  // Statistics counters
  const stats = useMemo(() => {
    const totalParsed = parsedRawMap?.size || 0;
    const changed = comparisonItems.filter(i => i.status === 'changed').length;
    const unchanged = comparisonItems.filter(i => i.status === 'unchanged').length;
    const missing = comparisonItems.filter(i => i.status === 'missing').length;
    const invalid = comparisonItems.filter(i => i.status === 'invalid').length;

    const hasBlockers = invalid > 0 || (importMode === 'full' && (missing > 0 || totalParsed < 200));

    return {
      totalParsed,
      changed,
      unchanged,
      missing,
      invalid,
      hasBlockers,
    };
  }, [comparisonItems, parsedRawMap, importMode]);

  // Confirm Submit to Database via Atomic RPC
  const handleExecuteImport = async () => {
    if (isPublished) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const validPayload = comparisonItems
      .filter(item => (importMode === 'full' ? true : item.newAnswer !== null))
      .map(item => ({
        question_number: item.questionNumber,
        correct_answer: item.newAnswer || item.currentAnswer,
      }));

    const res = await importToeicAnswerKey(testId, validPayload, importMode);

    if (!res.success) {
      setSubmitError(res.error || 'Cập nhật thất bại');
      setIsSubmitting(false);
      setShowConfirmModal(false);
      return;
    }

    setSubmitSuccessResult({
      updatedCount: res.updated_count || 0,
      unchangedCount: res.unchanged_count || 0,
      totalReceived: res.total_received || 0,
    });
    setIsSubmitting(false);
    setShowConfirmModal(false);
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* MODAL HEADER */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-3xl">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-ori-600" />
              IMPORT ANSWER KEY — {testTitle || 'TOEIC Test'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cập nhật đáp án đúng (A/B/C/D) cho 200 câu hỏi trong đề thi
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* PUBLISHED WARNING BANNER */}
          {isPublished && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-sm">Đề thi đang được Xuất bản (Published)</p>
                <p className="mt-0.5 text-amber-800">
                  Bạn vẫn có thể tải file, phân tích và kiểm tra Answer Key, nhưng phải <strong>Unpublish</strong> đề thi trước khi thực hiện cập nhật đáp án vào cơ sở dữ liệu.
                </p>
              </div>
            </div>
          )}

          {/* QUESTIONS LOADING INDICATOR */}
          {loadedQuestionsCount < 200 ? (
            <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-ori-600" />
                <span>Đang tải dữ liệu câu hỏi hiện tại... ({loadedQuestionsCount}/200 câu)</span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Đã tải đủ {loadedQuestionsCount}/200 câu hiện tại của đề thi
              </span>
              <button
                type="button"
                onClick={() => setShowCurrentOverview(!showCurrentOverview)}
                className="text-ori-600 hover:text-ori-700 flex items-center gap-1 text-[11px] font-extrabold"
              >
                {showCurrentOverview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showCurrentOverview ? 'Ẩn Answer Key hiện tại' : 'Xem Answer Key hiện tại'}
              </button>
            </div>
          )}

          {/* COLLAPSIBLE CURRENT ANSWER KEY OVERVIEW */}
          {showCurrentOverview && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 text-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-700 uppercase tracking-wide">
                  ĐÁP ÁN HIỆN TẠI TRONG CƠ SỞ DỮ LIỆU (200 CÂU)
                </h4>
                <span className="text-[11px] font-bold text-slate-400">Xem dạng đọc</span>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {CANONICAL_TOEIC_PARTS.map(pKey => {
                  const struct = TOEIC_FULL_TEST_STRUCTURE[pKey];
                  const partQs = safeQuestions.filter(
                    q => q && typeof q.question_number === 'number' && q.question_number >= struct.startNumber && q.question_number <= struct.endNumber
                  );

                  return (
                    <div key={pKey} className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="font-extrabold text-slate-800 text-[11px]">
                        {struct.nameVi} (Câu #{struct.startNumber}–#{struct.endNumber})
                      </div>
                      <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                        {partQs.map((q, idx) => (
                          <div key={q.id || `q-${q.question_number || idx}`} className="bg-slate-50 border border-slate-200 rounded p-1 text-center">
                            <div className="text-[9px] text-slate-400 font-bold">#{q.question_number || idx + 1}</div>
                            <div className="text-xs font-black text-slate-900">{q.correct_answer || '—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUCCESS SCREEN */}
          {submitSuccessResult ? (
            <div className="text-center py-8 space-y-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                ✓
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">ANSWER KEY UPDATED</h3>
                <p className="text-sm font-bold text-emerald-600 mt-1">200 / 200 câu thi đã đồng bộ đáp án chuẩn</p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                  <div className="text-xs font-bold text-emerald-700">Đã cập nhật</div>
                  <div className="text-2xl font-black text-emerald-800">{submitSuccessResult.updatedCount}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <div className="text-xs font-bold text-slate-600">Giữ nguyên</div>
                  <div className="text-2xl font-black text-slate-800">{submitSuccessResult.unchangedCount}</div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-ori-600 text-white font-extrabold text-xs rounded-xl hover:bg-ori-700 transition-colors shadow-md"
                >
                  Quay lại Test Bank
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: MODE & FILE INPUT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* MODE SELECTION */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wide">
                    CHẾ ĐỘ IMPORT
                  </span>

                  <div className="space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-xl bg-white border border-slate-200 hover:border-ori-400 transition-colors">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'full'}
                        onChange={() => setImportMode('full')}
                        className="mt-0.5 text-ori-600 focus:ring-ori-500"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">Thay toàn bộ Answer Key Q1–Q200 (Khuyên dùng)</div>
                        <div className="text-[11px] text-slate-500">Yêu cầu file có đầy đủ 200 đáp án chuẩn</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-xl bg-white border border-slate-200 hover:border-ori-400 transition-colors">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'partial'}
                        onChange={() => setImportMode('partial')}
                        className="mt-0.5 text-ori-600 focus:ring-ori-500"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">Chỉ cập nhật những câu có trong file</div>
                        <div className="text-[11px] text-slate-500">Giữ nguyên các câu còn lại</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* UPLOAD / DRAG DROP */}
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wide">
                      NGUỒN ĐÁP ÁN (FILE HOẶC DRAG & DROP)
                    </span>
                    {fileName && <span className="text-[11px] font-bold text-ori-600 truncate max-w-[120px]">{fileName}</span>}
                  </div>

                  <label className="py-3 px-4 bg-white border-2 border-dashed border-slate-300 hover:border-ori-500 rounded-xl cursor-pointer text-xs font-bold text-slate-700 flex flex-col items-center justify-center gap-1.5 transition-colors text-center">
                    <UploadCloud className="w-6 h-6 text-ori-600" />
                    <span>Chọn file hoặc Kéo thả vào đây</span>
                    <span className="text-[10px] text-slate-400 font-medium">(Hỗ trợ: PDF, TXT, CSV, JSON)</span>
                    <input
                      type="file"
                      accept=".pdf,.txt,.csv,.json"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  {pdfError && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-bold">
                      {pdfError}
                    </div>
                  )}

                  {isReadingFile && (
                    <div className="text-xs text-ori-600 font-bold flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Đang đọc nội dung file...
                    </div>
                  )}
                </div>
              </div>

              {/* DIRECT TEXT PASTE AREA */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700">HOẶC PASTE ĐÁP ÁN TRỰC TIẾP (TEXTAREA):</label>
                  <span className="text-[11px] text-slate-400">Ví dụ: 1. A | Q1:A | 1,A | JSON</span>
                </div>
                <textarea
                  value={inputText}
                  onChange={e => { setInputText(e.target.value); setFileName(null); }}
                  placeholder="Dán đáp án vào đây...&#10;1. A&#10;2. B&#10;3. C&#10;...&#10;200. D"
                  rows={4}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-ori-500 focus:bg-white transition-all"
                />
              </div>

              {/* STATS SUMMARY BAR */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500">Đọc được</div>
                  <div className="text-lg font-black text-slate-900">{stats.totalParsed} / 200</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
                  <div className="text-[10px] font-bold text-amber-700">Sẽ thay đổi</div>
                  <div className="text-lg font-black text-amber-800">{stats.changed}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-600">Không đổi</div>
                  <div className="text-lg font-black text-slate-700">{stats.unchanged}</div>
                </div>
                <div className={`p-3 rounded-2xl border ${
                  stats.hasBlockers ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <div className={`text-[10px] font-bold ${stats.hasBlockers ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {stats.hasBlockers ? 'Lỗi / Thiếu' : 'Trạng thái'}
                  </div>
                  <div className={`text-lg font-black ${stats.hasBlockers ? 'text-rose-800' : 'text-emerald-800'}`}>
                    {stats.hasBlockers ? stats.missing + stats.invalid : 'Sẵn sàng'}
                  </div>
                </div>
              </div>

              {/* PREVIEW TABLE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                    XEM TRƯỚC SỰ THAY ĐỔI (PREVIEW TABLE)
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400">Hiển thị 200 câu</span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-600 font-extrabold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">CÂU</th>
                        <th className="p-2.5">ĐÁP ÁN HIỆN TẠI</th>
                        <th className="p-2.5">ĐÁP ÁN MỚI</th>
                        <th className="p-2.5">TRẠNG THÁI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparisonItems.map(item => (
                        <tr
                          key={item.questionNumber}
                          className={
                            item.status === 'changed'
                              ? 'bg-amber-50/50'
                              : item.status === 'missing' || item.status === 'invalid'
                              ? 'bg-rose-50/50'
                              : ''
                          }
                        >
                          <td className="p-2.5 font-bold text-slate-900">Câu {item.questionNumber}</td>
                          <td className="p-2.5 font-extrabold text-slate-600">{item.currentAnswer}</td>
                          <td className="p-2.5 font-extrabold text-ori-600">
                            {item.newAnswer || '—'}
                          </td>
                          <td className="p-2.5 font-bold">
                            {item.status === 'changed' && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded-md font-extrabold">
                                Sẽ thay đổi
                              </span>
                            )}
                            {item.status === 'unchanged' && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-md">
                                Không đổi
                              </span>
                            )}
                            {item.status === 'missing' && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] rounded-md font-extrabold">
                                Thiếu đáp án
                              </span>
                            )}
                            {item.status === 'invalid' && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] rounded-md font-extrabold">
                                Không hợp lệ
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        {!submitSuccessResult && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-3xl flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl hover:bg-slate-300 transition-colors"
            >
              Hủy bỏ
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={isPublished || stats.hasBlockers || stats.totalParsed === 0}
              className="px-6 py-2.5 bg-ori-600 text-white font-extrabold text-xs rounded-xl hover:bg-ori-700 disabled:opacity-40 flex items-center gap-2 shadow-md transition-colors"
              title={isPublished ? 'Cần unpublish đề thi trước khi lưu' : ''}
            >
              <span>XÁC NHẬN CẬP NHẬT ANSWER KEY</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* CONFIRMATION DIALOG MODAL */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-center animate-in fade-in zoom-in-95 duration-150">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                ⚠️
              </div>

              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Xác nhận cập nhật Answer Key
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Bạn sắp cập nhật đáp án chuẩn của <span className="font-extrabold text-slate-900">{stats.totalParsed}</span> câu hỏi.<br />
                  • <strong className="text-amber-700">{stats.changed}</strong> câu sẽ thay đổi đáp án.<br />
                  • <strong className="text-slate-700">{stats.unchanged}</strong> câu giữ nguyên.
                </p>
                <p className="text-[11px] text-rose-600 font-extrabold mt-3 p-2 bg-rose-50 rounded-xl border border-rose-100">
                  Thao tác này ảnh hưởng trực tiếp đến việc chấm điểm các bài thi trong tương lai.
                </p>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold">
                  {submitError}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors"
                >
                  HỦY
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-ori-600 hover:bg-ori-700 text-white font-extrabold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang cập nhật...
                    </>
                  ) : (
                    'CẬP NHẬT ANSWER KEY'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Safe Export Wrapped in Error Boundary
export const SafeAnswerKeyImporterModal: React.FC<AnswerKeyImporterModalProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <AnswerKeyErrorBoundary onClose={props.onClose}>
      <AnswerKeyImporterModal {...props} />
    </AnswerKeyErrorBoundary>
  );
};
