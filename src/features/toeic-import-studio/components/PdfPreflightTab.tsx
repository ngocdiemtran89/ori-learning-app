import React, { useState, useEffect, useRef } from 'react';
import { FileText, Copy, Image as ImageIcon, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { PdfPreflightReport, PdfPagePreflight } from '../types';
import { getPdfPageCanvas } from '../pdf/pdfPreflight';

interface PdfPreflightTabProps {
  listeningReport: PdfPreflightReport | null;
  readingReport: PdfPreflightReport | null;
  listeningPdf: File | null;
  readingPdf: File | null;
}

export const PdfPreflightTab: React.FC<PdfPreflightTabProps> = ({
  listeningReport,
  readingReport,
  listeningPdf,
  readingPdf,
}) => {
  const [activeReportType, setActiveReportType] = useState<'listening' | 'reading'>('reading');
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [canvasLoading, setCanvasLoading] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const currentReport = activeReportType === 'listening' ? listeningReport : readingReport;
  const currentFile = activeReportType === 'listening' ? listeningPdf : readingPdf;

  const selectedPageObj: PdfPagePreflight | undefined = currentReport?.pages.find(
    (p) => p.pageNumber === selectedPageNum
  );

  // Render Canvas preview when page changes
  useEffect(() => {
    if (!currentFile || !selectedPageNum) return;

    let isMounted = true;
    setCanvasLoading(true);

    getPdfPageCanvas(currentFile, selectedPageNum, 1.2)
      .then((canvas) => {
        if (!isMounted || !canvasContainerRef.current) return;
        canvasContainerRef.current.innerHTML = '';
        canvas.className = 'max-w-full h-auto border border-slate-200 rounded-xl shadow-xs';
        canvasContainerRef.current.appendChild(canvas);
        setCanvasLoading(false);
      })
      .catch((err) => {
        console.error('Failed to render PDF page preview canvas:', err);
        setCanvasLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentFile, selectedPageNum]);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Summary */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>2. KHIỂM TRA PHÁT HIỆN TRANG PDF (PDF PREFLIGHT)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Kiểm tra độ trích xuất chữ thực tế trên từng trang PDF trước khi gửi cho ChatGPT.
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
              <div className="text-[10px] font-bold text-rose-600 uppercase">DẠNG ẢNH / RỖNG</div>
              <div className="text-xl font-extrabold text-rose-600">{currentReport.imageOrEmptyPages}</div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            Chưa tải file PDF cho phần này. Vui lòng quay lại Tab 1 để chọn file.
          </div>
        )}
      </div>

      {/* Main Page Coverage Map & Dual Preview */}
      {currentReport && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Grid: Page Coverage List (4 col) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3 flex flex-col max-h-[700px]">
            <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider px-1">
              BẢN ĐỒ DỮ LIỆU CÁC TRANG ({currentReport.totalPages})
            </h3>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {currentReport.pages.map((p) => {
                const isSelected = p.pageNumber === selectedPageNum;
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
                      <span className="text-[10px] font-mono text-slate-400">{p.textCharCount}c</span>
                      {p.status === 'TEXT_OK' && <span title="Chữ tốt"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></span>}
                      {p.status === 'LOW_TEXT' && <span title="Ít chữ"><AlertTriangle className="w-4 h-4 text-amber-500" /></span>}
                      {(p.status === 'IMAGE_LIKELY' || p.status === 'EMPTY') && (
                        <span title="Cần ChatGPT Vision"><XCircle className="w-4 h-4 text-rose-500" /></span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Dual Preview: Canvas Image (4 col) vs Extracted Text (4 col) */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rendered PDF Page Image */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  <span>ẢNH TRANG PDF (P.{selectedPageNum})</span>
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl p-2 overflow-auto">
                {canvasLoading ? (
                  <div className="text-xs text-slate-400 font-bold animate-pulse">Đang render trang PDF...</div>
                ) : (
                  <div ref={canvasContainerRef} className="flex justify-center" />
                )}
              </div>
            </div>

            {/* Extracted Text Details */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>CHỮ TRÍCH XUẤT ({selectedPageObj?.textCharCount || 0} ký tự)</span>
                </span>
                <button
                  onClick={() => handleCopyText(selectedPageObj?.text || '')}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copySuccess ? 'ĐÃ COPY!' : 'COPY CHỮ'}</span>
                </button>
              </div>

              {selectedPageObj?.warnings && selectedPageObj.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 font-medium space-y-0.5">
                  {selectedPageObj.warnings.map((w, i) => (
                    <div key={i}>⚠ {w}</div>
                  ))}
                </div>
              )}

              <div className="flex-1 bg-slate-900 rounded-2xl p-4 text-slate-200 text-xs font-mono whitespace-pre-wrap overflow-y-auto max-h-[500px] custom-scrollbar leading-relaxed">
                {selectedPageObj?.text || '[Không tìm thấy chữ trích xuất trên trang này]'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
