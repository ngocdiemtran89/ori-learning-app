import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Copy,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { PdfPreflightReport, PdfPagePreflight } from '../types';
import { loadPdfDocument } from '../../../lib/cms/pdfUtils';
import { renderPdfPageToCanvasSafe } from '../pdf/pdfPreflight';

interface PdfPreflightTabProps {
  listeningReport: PdfPreflightReport | null;
  readingReport: PdfPreflightReport | null;
  listeningPdf: File | null;
  readingPdf: File | null;
  onPromoteOcrText?: (pageNum: number, ocrText: string, sourceType: 'listening' | 'reading') => void;
}

export const PdfPreflightTab: React.FC<PdfPreflightTabProps> = ({
  listeningReport,
  readingReport,
  listeningPdf,
  readingPdf,
  onPromoteOcrText,
}) => {
  const [activeReportType, setActiveReportType] = useState<'listening' | 'reading'>('reading');
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [activeTextTab, setActiveTextTab] = useState<'pdf' | 'ocr'>('pdf');

  // Render & Canvas State
  const [canvasLoading, setCanvasLoading] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // OCR State
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // UI Toggles
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocCache = useRef<{ file: File | null; pdfDoc: any }>({ file: null, pdfDoc: null });

  const currentReport = activeReportType === 'listening' ? listeningReport : readingReport;
  const currentFile = activeReportType === 'listening' ? listeningPdf : readingPdf;

  const selectedPageObj: PdfPagePreflight | undefined = currentReport?.pages.find(
    (p) => p.pageNumber === selectedPageNum
  );

  // Safely load and cache PDF.js document when current file changes
  useEffect(() => {
    if (!currentFile) {
      pdfDocCache.current = { file: null, pdfDoc: null };
      return;
    }

    let isMounted = true;
    loadPdfDocument(currentFile)
      .then((res) => {
        if (isMounted) {
          pdfDocCache.current = { file: currentFile, pdfDoc: res.pdfDoc };
        }
      })
      .catch((err) => {
        console.error('Failed to load PDF document cache:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [currentFile]);

  // Lazy render selected PDF page to canvas safely
  useEffect(() => {
    if (!currentFile || !selectedPageNum || !canvasRef.current) return;

    let isCancelled = false;
    setCanvasLoading(true);
    setRenderError(null);

    const performRender = async () => {
      try {
        let pdfDoc = pdfDocCache.current.pdfDoc;
        if (!pdfDoc || pdfDocCache.current.file !== currentFile) {
          const loaded = await loadPdfDocument(currentFile);
          pdfDoc = loaded.pdfDoc;
          pdfDocCache.current = { file: currentFile, pdfDoc };
        }

        if (isCancelled || !canvasRef.current) return;
        await renderPdfPageToCanvasSafe(pdfDoc, selectedPageNum, canvasRef.current, 1.5);

        if (!isCancelled) {
          setCanvasLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('PDF Page render error:', err);
          setRenderError(err?.message || 'Không thể render trang PDF này.');
          setCanvasLoading(false);
        }
      }
    };

    performRender();

    return () => {
      isCancelled = true;
    };
  }, [currentFile, selectedPageNum]);

  // Client-Side Local OCR via Tesseract.js (Lazy Loaded)
  const handleRunLocalOcr = async () => {
    if (!canvasRef.current || !selectedPageObj) return;

    setOcrLoading(true);
    setOcrProgress(0);
    setOcrError(null);

    try {
      // Dynamic import to keep initial bundle lightweight
      const Tesseract = await import('tesseract.js');
      const canvas = canvasRef.current;

      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress) {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const ret = await worker.recognize(canvas);
      await worker.terminate();

      const recognizedText = ret.data.text.trim();
      selectedPageObj.ocrText = recognizedText;
      setActiveTextTab('ocr');
      setOcrLoading(false);
    } catch (err: any) {
      console.error('Local OCR execution error:', err);
      setOcrError(`Lỗi OCR: ${err?.message || err}`);
      setOcrLoading(false);
    }
  };

  const handlePromoteOcrText = () => {
    if (selectedPageObj?.ocrText && onPromoteOcrText) {
      onPromoteOcrText(selectedPageNum, selectedPageObj.ocrText, activeReportType);
      selectedPageObj.activeTextSource = 'OCR_TEXT';
      alert(`Đã áp dụng chữ OCR cho Trang ${selectedPageNum} vào Local Parser!`);
    }
  };

  const handleDownloadPageImage = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeReportType}-page-${String(selectedPageNum).padStart(3, '0')}.png`;
    a.click();
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const isImageOnlyPdf = currentReport && currentReport.totalPages > 0 && currentReport.pagesWithText === 0;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>2. KIỂM TRA PHÁT HIỆN TRANG PDF (PDF PREFLIGHT)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Kiểm tra khả năng trích xuất chữ, dạng ảnh scan & phân loại độ phủ nguồn PDF.
            </p>
          </div>

          {/* Toggle Listening / Reading Report */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl font-extrabold text-xs">
            <button
              onClick={() => {
                setActiveReportType('listening');
                setSelectedPageNum(1);
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeReportType === 'listening'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Listening PDF ({listeningReport?.totalPages || 0} trang)
            </button>
            <button
              onClick={() => {
                setActiveReportType('reading');
                setSelectedPageNum(1);
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeReportType === 'reading'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reading PDF ({readingReport?.totalPages || 0} trang)
            </button>
          </div>
        </div>

        {/* Coverage Summary Stats */}
        {currentReport ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">TỔNG SỐ TRANG</div>
                <div className="text-xl font-extrabold text-slate-900">{currentReport.totalPages}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold text-emerald-600 uppercase">CHỮ TỐT (TEXT OK)</div>
                <div className="text-xl font-extrabold text-emerald-600">{currentReport.pagesWithText}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold text-amber-600 uppercase">ÍT CHỮ (LOW TEXT)</div>
                <div className="text-xl font-extrabold text-amber-600">{currentReport.lowTextPages}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold text-rose-600 uppercase">IMAGE ONLY</div>
                <div className="text-xl font-extrabold text-rose-600">{currentReport.imageOnlyPages || currentReport.imageOrEmptyPages}</div>
              </div>
            </div>

            {/* Prominent Image-Only PDF Banner */}
            {isImageOnlyPdf && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>
                    ⚠ PDF này không có text layer (100% trang là scan / image-only). Hãy sử dụng IMAGE MODE hoặc ChatGPT Vision!
                  </span>
                </div>
                <button
                  onClick={handleDownloadPageImage}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-xs shrink-0 transition-colors inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>TẢI ẢNH TRANG HIỆN TẠI</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            Chưa tải file PDF cho phần này. Vui lòng quay lại Tab 1 để chọn file.
          </div>
        )}
      </div>

      {/* Main Dual Workspace */}
      {currentReport && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Grid: Page Coverage List (4 col) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3 flex flex-col max-h-[700px]">
            <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider px-1">
              BẢN ĐỒ DỮ LIỆU TRANG ({currentReport.totalPages})
            </h3>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {currentReport.pages.map((p) => {
                const isSelected = p.pageNumber === selectedPageNum;
                const status = p.textStatus || p.status;
                return (
                  <button
                    key={p.pageNumber}
                    onClick={() => setSelectedPageNum(p.pageNumber)}
                    className={`w-full text-left p-3 rounded-2xl border text-xs transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 font-extrabold text-indigo-950'
                        : 'bg-slate-50 border-slate-100 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 text-[11px]">P.{p.pageNumber}</span>
                      <span>Trang {p.pageNumber}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400">{p.charCount || (p as any).textCharCount || 0}c</span>
                      {status === 'TEXT_OK' && (
                        <span title="Chữ tốt">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </span>
                      )}
                      {status === 'LOW_TEXT' && (
                        <span title="Ít chữ">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        </span>
                      )}
                      {status === 'IMAGE_ONLY' && (
                        <span title="Dạng ảnh - Cần ChatGPT Vision">
                          <XCircle className="w-4 h-4 text-rose-500" />
                        </span>
                      )}
                      {status === 'TEXT_ERROR' && (
                        <span title="Lỗi trích xuất chữ">
                          <AlertCircle className="w-4 h-4 text-purple-600" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Dual Preview: Rendered Canvas (4 col) vs Extracted Text & OCR (4 col) */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Center Canvas Preview */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  <span>ẢNH TRANG PDF (P.{selectedPageNum})</span>
                </span>

                <button
                  onClick={handleDownloadPageImage}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>TẢI ẢNH</span>
                </button>
              </div>

              <div className="flex-1 flex items-center justify-center min-h-[420px] bg-slate-900/5 rounded-2xl p-2 overflow-auto">
                {canvasLoading ? (
                  <div className="text-xs text-slate-500 font-bold animate-pulse flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Đang render trang PDF...</span>
                  </div>
                ) : renderError ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 text-center space-y-2">
                    <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
                    <div className="font-extrabold">Không thể render trang này</div>
                    <div className="text-[11px] text-rose-600 font-mono">{renderError}</div>
                  </div>
                ) : null}

                <canvas
                  ref={canvasRef}
                  className={`max-w-full h-auto border border-slate-200 rounded-xl shadow-md ${
                    canvasLoading || renderError ? 'hidden' : 'block'
                  }`}
                />
              </div>
            </div>

            {/* Right Extracted Text & Local OCR */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3 flex flex-col">
              {/* Header Tabs */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    onClick={() => setActiveTextTab('pdf')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      activeTextTab === 'pdf' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    PDF Text ({selectedPageObj?.charCount || (selectedPageObj as any)?.textCharCount || 0}c)
                  </button>
                  <button
                    onClick={() => setActiveTextTab('ocr')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      activeTextTab === 'ocr' ? 'bg-white text-purple-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    OCR Text {selectedPageObj?.ocrText ? `(${selectedPageObj.ocrText.length}c)` : ''}
                  </button>
                </div>

                <button
                  onClick={() =>
                    handleCopyText(
                      activeTextTab === 'ocr'
                        ? selectedPageObj?.ocrText || ''
                        : selectedPageObj?.normalizedText || selectedPageObj?.extractedText || (selectedPageObj as any)?.text || ''
                    )
                  }
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copySuccess ? 'ĐÃ COPY!' : 'COPY'}</span>
                </button>
              </div>

              {/* Warnings */}
              {selectedPageObj?.warnings && selectedPageObj.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 font-medium space-y-0.5">
                  {selectedPageObj.warnings.map((w, i) => (
                    <div key={i}>⚠ {w}</div>
                  ))}
                </div>
              )}

              {/* Local OCR CTA */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <button
                  onClick={handleRunLocalOcr}
                  disabled={ocrLoading}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-300 text-white font-extrabold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{ocrLoading ? `ĐANG OCR (${ocrProgress}%)...` : '🔎 OCR TRANG NÀY (LOCAL)'}</span>
                </button>

                {selectedPageObj?.ocrText && (
                  <button
                    onClick={handlePromoteOcrText}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    🟢 DÙNG OCR TEXT
                  </button>
                )}
              </div>

              {ocrError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800">
                  {ocrError}
                </div>
              )}

              {/* Text Display */}
              <div className="flex-1 bg-slate-900 rounded-2xl p-4 text-slate-200 text-xs font-mono whitespace-pre-wrap overflow-y-auto max-h-[400px] custom-scrollbar leading-relaxed">
                {activeTextTab === 'ocr'
                  ? selectedPageObj?.ocrText || '[Chưa thực hiện OCR cho trang này. Nhấp "OCR TRANG NÀY" ở trên]'
                  : selectedPageObj?.normalizedText || selectedPageObj?.extractedText || (selectedPageObj as any)?.text || '[Không tìm thấy chữ trích xuất trên trang này]'}
              </div>

              {/* Developer / Debug Accordion */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-700 flex items-center justify-between w-full"
                >
                  <span>Chi tiết kỹ thuật (Developer / Debug)</span>
                  {showDebugPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showDebugPanel && selectedPageObj && (
                  <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[10px] text-slate-700 space-y-1">
                    <div>pageNumber: {selectedPageObj.pageNumber}</div>
                    <div>charCount: {selectedPageObj.charCount || (selectedPageObj as any).textCharCount || 0}</div>
                    <div>wordCount: {selectedPageObj.wordCount || 0}</div>
                    <div>textStatus: {selectedPageObj.textStatus || selectedPageObj.status}</div>
                    <div>renderStatus: {selectedPageObj.renderStatus}</div>
                    <div>activeTextSource: {selectedPageObj.activeTextSource}</div>
                    {selectedPageObj.textError && <div className="text-rose-600">textError: {selectedPageObj.textError}</div>}
                    {renderError && <div className="text-rose-600">renderError: {renderError}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
