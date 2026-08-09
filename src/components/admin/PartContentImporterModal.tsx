// ============================================================
// Phase P3.5J Revised: Admin Bulk Import TOEIC Questions By Part Modal (Bilingual EN + VI)
// Supports AUTO, PDF, TXT/Paste, JSON, CSV & Markdown formats
// ============================================================

import React, { useState, useMemo } from 'react';
import {
  X,
  UploadCloud,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  FileText,
  Sparkles,
  BookOpen,
  Save,
  Globe,
} from 'lucide-react';
import { importToeicPartContent } from '../../lib/supabase/adminTestBank';
import { extractPdfTextItems } from '../../lib/cms/pdfUtils';
import {
  autoParsePartContentInput,
  PartParseResult,
} from '../../lib/cms/partContentBulkParser';
import { CanonicalToeicPart, TOEIC_FULL_TEST_STRUCTURE } from '../../lib/toeic/testStructure';

export class PartContentErrorBoundary extends React.Component<
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
    console.error('PartContentImporterModal ErrorBoundary caught exception:', error, errorInfo);
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
              Không thể mở công cụ Import Nội Dung Part Song Ngữ
            </h3>
            <p className="text-xs text-slate-500">
              {this.state.error?.message || 'Đã xảy ra lỗi giao diện khi tải bộ import nội dung.'}
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

export interface PartContentImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  testId: string;
  testTitle: string;
  isPublished: boolean;
  targetPart: CanonicalToeicPart;
  existingQuestions?: any[];
  existingGroups?: any[];
  onUpdated: () => void;
}

type ImportSourceTab = 'auto' | 'txt' | 'pdf' | 'json' | 'csv';

export const PartContentImporterModalContent: React.FC<PartContentImporterModalProps> = ({
  onClose,
  testId,
  testTitle,
  isPublished,
  targetPart,
  existingQuestions = [],
  existingGroups: _existingGroups = [],
  onUpdated,
}) => {
  const normPart = targetPart || 'part3';
  const partInfo = TOEIC_FULL_TEST_STRUCTURE[normPart];

  const [activeTab, setActiveTab] = useState<ImportSourceTab>('auto');
  const [importMode, setImportMode] = useState<'full' | 'partial'>('full');
  const [inputText, setInputText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [importAnswers, setImportAnswers] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle PDF file upload
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsReadingFile(true);
    setPdfError(null);

    try {
      const textItems = await extractPdfTextItems(file);
      const extractedText = textItems.map(item => item.text).join(' ');
      if (!extractedText || extractedText.trim().length === 0) {
        setPdfError('PDF này không có lớp chữ có thể đọc tự động (PDF scan hoặc ảnh). Vui lòng chọn tệp PDF dạng Text hoặc dùng dạng Văn bản/Paste.');
        setInputText('');
      } else {
        setInputText(extractedText);
      }
    } catch (err: any) {
      setPdfError(`Không thể đọc PDF: ${err.message || 'Lỗi xử lý file PDF'}`);
      setInputText('');
    } finally {
      setIsReadingFile(false);
    }
  };

  // Perform parse
  const parseResult: PartParseResult = useMemo(() => {
    return autoParsePartContentInput(inputText, normPart);
  }, [inputText, normPart]);

  // Existing Questions map by question_number
  const existingQMap = useMemo(() => {
    const map = new Map<number, any>();
    (existingQuestions || []).forEach(q => {
      if (q && typeof q.question_number === 'number') {
        map.set(q.question_number, q);
      }
    });
    return map;
  }, [existingQuestions]);

  const hasExistingAnswers = useMemo(() => {
    return (existingQuestions || []).some(q => q && q.correct_answer && q.part === normPart);
  }, [existingQuestions, normPart]);

  // Save changes via atomic RPC
  const handleSaveImport = async () => {
    if (isPublished) {
      alert('Đề đang được xuất bản. Unpublish trước khi cập nhật nội dung song ngữ.');
      return;
    }

    if (parseResult.questions.length === 0 && parseResult.groups.length === 0) {
      alert('Không tìm thấy nội dung câu hỏi hoặc nhóm bài nào để lưu.');
      return;
    }

    if (parseResult.outOfPartErrors.length > 0) {
      alert(`Có câu hỏi không thuộc ${normPart.toUpperCase()}. Vui lòng kiểm tra lại trước khi lưu.`);
      return;
    }

    setSaving(true);
    setServerError(null);

    const payload = {
      import_answers: importAnswers,
      questions: parseResult.questions,
      groups: parseResult.groups,
    };

    const res = await importToeicPartContent(testId, normPart, payload);

    if (!res.success) {
      setServerError(res.error || 'Đã xảy ra lỗi khi lưu dữ liệu Part.');
    } else {
      setSuccessMsg(`Đã cập nhật thành công ${res.questions_updated || 0} câu hỏi, tạo mới ${res.questions_inserted || 0} câu hỏi, cập nhật ${res.groups_updated || 0} nhóm bài song ngữ.`);
      onUpdated();
      setTimeout(() => {
        onClose();
      }, 1200);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
        {/* MODAL HEADER */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-black bg-ori-600 text-white rounded-md uppercase flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" /> {normPart.toUpperCase()}
              </span>
              <h2 className="text-base font-extrabold text-slate-900">
                Import Nội Dung {partInfo.nameVi} — SONG NGỮ (EN + VI)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Đề thi: <strong className="text-slate-800">{testTitle}</strong> (Q{partInfo.startNumber}–{partInfo.endNumber})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SOURCE SELECTION TABS & MODE SELECTOR */}
        <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('auto')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all ${
                activeTab === 'auto' ? 'bg-ori-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> ⚡ AUTO (Tự Động)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('txt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all ${
                activeTab === 'txt' ? 'bg-ori-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Văn Bản / Paste
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pdf')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all ${
                activeTab === 'pdf' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📄 Tệp PDF (Text)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all ${
                activeTab === 'json' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {'{ }'} JSON
            </button>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setImportMode('full')}
                className={`px-2.5 py-1 rounded-lg transition-all ${importMode === 'full' ? 'bg-white shadow-xs text-ori-700 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ● Song Ngữ Đầy Đủ
              </button>
              <button
                type="button"
                onClick={() => setImportMode('partial')}
                className={`px-2.5 py-1 rounded-lg transition-all ${importMode === 'partial' ? 'bg-white shadow-xs text-ori-700 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ○ Cập Nhật Một Phần
              </button>
            </div>

            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={importAnswers}
                onChange={(e) => setImportAnswers(e.target.checked)}
                className="w-4 h-4 text-ori-600 rounded border-slate-300 focus:ring-ori-500"
              />
              <span>Cập nhật Answer Key</span>
            </label>
          </div>
        </div>

        {/* INPUT & PREVIEW CONTAINER */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isPublished && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Đề đang được xuất bản. Bạn có thể xem trước nội dung bên dưới nhưng cần Unpublish trước khi cập nhật nội dung song ngữ.</span>
            </div>
          )}

          {hasExistingAnswers && !importAnswers && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium rounded-xl">
              ℹ️ Đề hiện đã có Answer Key. Mặc định hệ thống giữ nguyên đáp án đúng để tránh ghi đè nhầm. Tích chọn "Cập nhật Answer Key" nếu muốn cập nhật từ file này.
            </div>
          )}

          {/* PDF FILE INPUT */}
          {activeTab === 'pdf' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <label className="cursor-pointer text-xs font-extrabold text-purple-700 hover:underline">
                  Bấm vào đây để chọn tệp PDF đề thi {normPart.toUpperCase()} Song Ngữ
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                </label>
                {fileName && <p className="text-xs text-slate-600 font-bold mt-1">Đã chọn: {fileName}</p>}
              </div>
              {isReadingFile && (
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-purple-700">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang trích xuất văn bản từ PDF...
                </div>
              )}
              {pdfError && (
                <div className="p-3 bg-rose-50 text-rose-800 text-xs font-bold rounded-xl border border-rose-200">
                  {pdfError}
                </div>
              )}
            </div>
          )}

          {/* TEXT AREA INPUT */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-slate-700 flex items-center justify-between">
              <span>Nội dung nguồn Song Ngữ ({normPart.toUpperCase()})</span>
              <span className="text-[11px] text-slate-400 font-normal">Hỗ trợ Markdown, TXT, JSON, CÂU 32-34...</span>
            </label>
            <textarea
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Dán nội dung ${normPart.toUpperCase()} Song Ngữ tại đây...\n\nVí dụ:\nCÂU ${partInfo.startNumber}–${partInfo.startNumber + 2}\nSCRIPT TIẾNG ANH\nW: ...\nM: ...\nBẢN DỊCH TIẾNG VIỆT\nNữ: ...\nNam: ...\n\nCÂU ${partInfo.startNumber}\nQUESTION EN\nWhat are the speakers discussing?\nQUESTION VI\nHai người đang thảo luận về điều gì?\n(A) A new food product\nVI: Một sản phẩm thực phẩm mới\n(B) A restaurant opening\nVI: Việc khai trương nhà hàng\n(C) A marketing campaign\nVI: Một chiến dịch tiếp thị\n(D) A price increase\nVI: Việc tăng giá`}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 focus:outline-none focus:border-ori-600 leading-relaxed"
            />
          </div>

          {/* PARSE METRICS SUMMARY */}
          {inputText.trim().length > 0 && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-extrabold uppercase text-slate-700 tracking-wide flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-ori-600" />
                  KẾT QUẢ PHÂN TÍCH SONG NGỮ (PREVIEW)
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  Định dạng nhận diện: <strong className="text-slate-900 uppercase">{parseResult.detectedFormat}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Nhóm câu</span>
                  <span className="text-sm font-black text-slate-800">{parseResult.metrics.groupCount}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Câu EN</span>
                  <span className="text-sm font-black text-ori-600">{parseResult.metrics.hasQuestionEnCount} / {parseResult.metrics.questionCount}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Câu VI</span>
                  <span className="text-sm font-black text-indigo-600">{parseResult.metrics.hasQuestionViCount} / {parseResult.metrics.questionCount}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Đáp án VI</span>
                  <span className="text-sm font-black text-purple-600">{parseResult.metrics.hasOptionsViCount} / {parseResult.metrics.questionCount}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Thoại EN/VI</span>
                  <span className="text-sm font-black text-emerald-600">{parseResult.metrics.hasTranscriptEnCount} / {parseResult.metrics.hasTranscriptViCount}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Lỗi Part</span>
                  <span className={`text-sm font-black ${parseResult.outOfPartErrors.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {parseResult.outOfPartErrors.length}
                  </span>
                </div>
              </div>

              {parseResult.outOfPartErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl space-y-1">
                  {parseResult.outOfPartErrors.map((err, idx) => (
                    <div key={idx}>⚠️ {err}</div>
                  ))}
                </div>
              )}

              {parseResult.validationErrors.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-xl space-y-1">
                  {parseResult.validationErrors.map((warn, idx) => (
                    <div key={idx}>⚠️ {warn}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DETECTED BILINGUAL GROUPS & QUESTIONS PREVIEW LIST */}
          {parseResult.questions.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">
                DANH SÁCH CÂU HỎI SONG NGỮ ({parseResult.questions.length} CÂU)
              </h4>

              <div className="space-y-3">
                {parseResult.questions.map((q) => {
                  const existing = existingQMap.get(q.question_number);
                  const isUpdate = Boolean(existing);

                  return (
                    <div
                      key={q.question_number}
                      className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">
                            Câu {q.question_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md ${
                              isUpdate ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isUpdate ? 'Sẽ cập nhật' : 'Sẽ tạo mới'}
                          </span>
                        </div>

                        {q.correct_answer && (
                          <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-[11px] rounded-md">
                            Đáp án: {q.correct_answer}
                          </span>
                        )}
                      </div>

                      {/* QUESTION EN & VI */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-[10px] font-black uppercase text-ori-600 block mb-0.5">QUESTION EN</span>
                          <p className="font-bold text-slate-900 leading-snug">{q.question_text || '(Chưa có nội dung EN)'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-indigo-600 block mb-0.5">BẢN DỊCH VI</span>
                          <p className="font-medium text-slate-700 italic leading-snug">{q.translation_vi || '(Chưa có bản dịch VI)'}</p>
                        </div>
                      </div>

                      {/* OPTIONS EN & VI */}
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt, idx) => {
                            const optVi = q.options_vi && q.options_vi[idx] ? q.options_vi[idx] : null;

                            return (
                              <div
                                key={opt.label}
                                className={`p-2.5 rounded-xl border text-[11px] font-medium space-y-1 ${
                                  q.correct_answer === opt.label
                                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                                    : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <div className="flex items-start gap-1.5">
                                  <span className="font-black text-slate-900 shrink-0">({opt.label})</span>
                                  <span className="break-words min-w-0 flex-1">{opt.text}</span>
                                </div>
                                {optVi && (
                                  <div className="pl-4 text-indigo-700 font-normal italic text-[10.5px]">
                                    → {optVi}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {serverError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl">
              {serverError}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition-colors"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleSaveImport}
            disabled={saving || isPublished || parseResult.questions.length === 0 || parseResult.outOfPartErrors.length > 0}
            className="px-6 py-2.5 bg-ori-600 hover:bg-ori-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 disabled:opacity-40 transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Đang Lưu Nội Dung Song Ngữ...
              </>
            ) : isPublished ? (
              'ĐÃ XUẤT BẢN - CHỈ XEM NỘI DUNG'
            ) : (
              <>
                <Save className="w-4 h-4" /> Lưu Nội Dung Song Ngữ {normPart.toUpperCase()} ({parseResult.questions.length} câu)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const SafePartContentImporterModal: React.FC<PartContentImporterModalProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <PartContentErrorBoundary onClose={props.onClose}>
      <PartContentImporterModalContent {...props} />
    </PartContentErrorBoundary>
  );
};
