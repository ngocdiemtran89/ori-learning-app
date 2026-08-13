import React, { useState } from 'react';
import {
  Bot,
  Copy,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Sparkles,
  Archive,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';
import JSZip from 'jszip';
import { PdfPreflightReport, ChatGptBatchPacket } from '../types';
import { generateMasterPrompt, generateBatchPackets } from '../pdf/packetGenerator';
import { loadPdfDocument } from '../../../lib/cms/pdfUtils';
import { PDF_PAGE_RENDER_SCALE } from '../constants';

interface ChatGptHybridTabProps {
  listeningReport: PdfPreflightReport | null;
  readingReport: PdfPreflightReport | null;
  listeningPdf?: File | null;
  readingPdf?: File | null;
  onImportChatGptJson: (jsonStr: string) => void;
}

export interface RenderedBatchImage {
  pageNumber: number;
  filename: string;
  blob: Blob;
}

export async function renderBatchImages(
  file: File,
  startPage: number,
  endPage: number,
  scale: number = PDF_PAGE_RENDER_SCALE,
  onProgress?: (current: number, total: number) => void
): Promise<RenderedBatchImage[]> {
  const { pdfDoc } = await loadPdfDocument(file);
  const results: RenderedBatchImage[] = [];
  const totalPagesToRender = endPage - startPage + 1;

  for (let p = startPage; p <= endPage; p++) {
    if (onProgress) {
      onProgress(results.length + 1, totalPagesToRender);
    }

    try {
      const page = await pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error(`Không thể khởi tạo Canvas context cho Trang ${p}.`);
      }

      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png', 0.95)
      );

      if (!blob) {
        throw new Error(`Không thể tạo ảnh PNG từ Canvas cho Trang ${p}.`);
      }

      const filename = `page-${String(p).padStart(3, '0')}.png`;
      results.push({
        pageNumber: p,
        filename,
        blob,
      });
    } catch (err: any) {
      console.error(`Error rendering page ${p}:`, err);
      throw new Error(`Thiếu ảnh Trang ${p}: ${err?.message || err}. Không tạo FULL PACK.`);
    }
  }

  if (results.length !== totalPagesToRender) {
    throw new Error(`Thiếu ảnh trang (chỉ tạo được ${results.length}/${totalPagesToRender} ảnh). Không tạo FULL PACK.`);
  }

  return results;
}

export const ChatGptHybridTab: React.FC<ChatGptHybridTabProps> = ({
  listeningReport,
  readingReport,
  listeningPdf,
  readingPdf,
  onImportChatGptJson,
}) => {
  const [activeSource, setActiveSource] = useState<'reading' | 'listening'>('reading');
  const [batchSize, setBatchSize] = useState<number>(5);

  const [copiedMasterPrompt, setCopiedMasterPrompt] = useState<boolean>(false);
  const [copiedBatchIndex, setCopiedBatchIndex] = useState<number | null>(null);

  // Batch Image & Zip Export State
  const [exportingBatchIndex, setExportingBatchIndex] = useState<number | null>(null);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [exportStatusMessage, setExportStatusMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [pastedJson, setPastedJson] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccessMessage, setParseSuccessMessage] = useState<string | null>(null);

  const currentReport = activeSource === 'listening' ? listeningReport : readingReport;
  const currentFile = activeSource === 'listening' ? listeningPdf : readingPdf;

  const packets: ChatGptBatchPacket[] = currentReport
    ? generateBatchPackets(currentReport.pages, activeSource, batchSize)
    : [];

  const isImageOnlyPdf = currentReport && currentReport.totalPages > 0 && currentReport.pagesWithText === 0;

  const handleCopyMasterPrompt = () => {
    navigator.clipboard.writeText(generateMasterPrompt());
    setCopiedMasterPrompt(true);
    setTimeout(() => setCopiedMasterPrompt(false), 2500);
  };

  const handleCopyBatch = (packet: ChatGptBatchPacket) => {
    const fullText = generateMasterPrompt() + '\n\n' + packet.promptText;
    navigator.clipboard.writeText(fullText);
    setCopiedBatchIndex(packet.batchIndex);
    setTimeout(() => setCopiedBatchIndex(null), 2000);
  };

  const handleDownloadBatchImages = async (packet: ChatGptBatchPacket) => {
    if (!currentFile) {
      alert(`Vui lòng chọn file ${activeSource.toUpperCase()} PDF ở Tab 1 trước khi tải ảnh.`);
      return;
    }

    setExportingBatchIndex(packet.batchIndex);
    setExportError(null);
    setExportStatusMessage(null);

    try {
      const images = await renderBatchImages(
        currentFile,
        packet.startPage,
        packet.endPage,
        1.5,
        (curr, total) => setExportProgress({ current: curr, total })
      );

      images.forEach((img) => {
        const url = URL.createObjectURL(img.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeSource}-${img.filename}`;
        a.click();
        URL.revokeObjectURL(url);
      });

      setExportStatusMessage(`Đã xuất thành công ${images.length}/${images.length} ảnh trang PDF!`);
    } catch (err: any) {
      console.error('Failed to download batch images:', err);
      setExportError(err?.message || 'Lỗi khi tạo ảnh trang PDF.');
    } finally {
      setExportingBatchIndex(null);
      setExportProgress(null);
    }
  };

  const handleDownloadFullPackZip = async (packet: ChatGptBatchPacket) => {
    if (!currentFile) {
      alert(`Vui lòng chọn file ${activeSource.toUpperCase()} PDF ở Tab 1 trước khi tải gói FULL PACK.`);
      return;
    }

    setExportingBatchIndex(packet.batchIndex);
    setExportError(null);
    setExportStatusMessage(null);

    try {
      const images = await renderBatchImages(
        currentFile,
        packet.startPage,
        packet.endPage,
        1.5,
        (curr, total) => setExportProgress({ current: curr, total })
      );

      const zip = new JSZip();

      // 1. Canonical Prompt as prompt.md
      const promptContent = generateMasterPrompt() + '\n\n' + packet.promptText;
      zip.file('prompt.md', promptContent);

      // 2. Completeness Manifest
      const manifest = {
        schemaVersion: 1,
        source: activeSource,
        batchNumber: packet.batchIndex,
        totalBatches: packet.totalBatches,
        pages: Array.from({ length: packet.endPage - packet.startPage + 1 }, (_, i) => packet.startPage + i),
        imageFiles: images.map((img) => img.filename),
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      // 3. Image Files
      images.forEach((img) => {
        zip.file(img.filename, img.blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      const startP = String(packet.startPage).padStart(3, '0');
      const endP = String(packet.endPage).padStart(3, '0');
      const batchNum = String(packet.batchIndex).padStart(2, '0');
      a.download = `ori-${activeSource}-chatgpt-batch-${batchNum}-pages-${startP}-${endP}.zip`;
      a.click();
      URL.revokeObjectURL(zipUrl);

      setExportStatusMessage(`Đã xuất gói 📦 FULL PACK .ZIP (${images.length} ảnh + prompt.md + manifest.json) thành công!`);
    } catch (err: any) {
      console.error('Failed to export full pack zip:', err);
      setExportError(err?.message || 'Lỗi khi tạo gói ZIP FULL PACK.');
    } finally {
      setExportingBatchIndex(null);
      setExportProgress(null);
    }
  };

  const handleProcessPastedJson = () => {
    if (!pastedJson.trim()) {
      setParseError('Vui lòng dán nội dung JSON từ ChatGPT vào ô bên dưới.');
      return;
    }
    try {
      JSON.parse(pastedJson);
      onImportChatGptJson(pastedJson);
      setParseError(null);
      setParseSuccessMessage('Đã gộp JSON từ ChatGPT thành công vào hệ thống Staging!');
      setPastedJson('');
    } catch (err: any) {
      setParseError(`JSON không hợp lệ: ${err?.message || err}`);
      setParseSuccessMessage(null);
    }
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setPastedJson(text);
        try {
          JSON.parse(text);
          onImportChatGptJson(text);
          setParseError(null);
          setParseSuccessMessage(`Đã gộp file JSON ${file.name} thành công!`);
        } catch (err: any) {
          setParseError(`File JSON không hợp lệ: ${err?.message || err}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              <Bot className="w-6 h-6 text-indigo-400" />
              <span>3. QUY TRÌNH CHATGPT HYBRID (ZERO AI API COST)</span>
            </h2>
            <p className="text-xs text-slate-400">
              Xuất trọn gói ZIP (ảnh + prompt) cho ChatGPT Vision → Dán lại JSON chuẩn ORI. Không tốn phí API!
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyMasterPrompt}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md inline-flex items-center gap-2 transition-transform active:scale-95 shrink-0"
          >
            <Copy className="w-4 h-4" />
            <span>{copiedMasterPrompt ? 'ĐÃ COPY MASTER PROMPT!' : 'COPY ORI CHATGPT MASTER PROMPT'}</span>
          </button>
        </div>

        {/* Master Workflow Instructions */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 text-xs space-y-2">
          <div className="font-extrabold text-indigo-300 uppercase tracking-wider text-[11px]">
            💡 HƯỚNG DẪN QUY TRÌNH 6 BƯỚC NẠP ĐỀ CHATGPT HYBRID
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300 text-[11px] leading-relaxed">
            <div>1. Bấm <b>📦 FULL PACK</b> để tải ZIP (ảnh + prompt)</div>
            <div>2. Giải nén file .zip trên máy tính</div>
            <div>3. Tải ảnh + prompt.md lên ChatGPT Vision</div>
            <div>4. Copy mã JSON do ChatGPT trả về</div>
            <div>5. Dán mã JSON vào ô bên phải</div>
            <div>6. Bấm <b>GỘP DỮ LIỆU VÀO STAGING</b></div>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: PACKET GENERATOR (6 COL) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>📦 TẠO GÓI GỬI CHATGPT (BATCH PACKET GENERATOR)</span>
            </h3>
          </div>

          {/* Controls: Source & Batch Size */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
            <div className="flex items-center gap-1.5 font-bold">
              <span>Nguồn:</span>
              <button
                onClick={() => setActiveSource('reading')}
                className={`px-3 py-1 rounded-lg ${
                  activeSource === 'reading' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                Reading PDF
              </button>
              <button
                onClick={() => setActiveSource('listening')}
                className={`px-3 py-1 rounded-lg ${
                  activeSource === 'listening' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                Listening PDF
              </button>
            </div>

            <div className="flex items-center gap-1.5 font-bold">
              <span>Kích thước gói:</span>
              {[3, 5, 10].map((sz) => (
                <button
                  key={sz}
                  onClick={() => setBatchSize(sz)}
                  className={`px-2.5 py-1 rounded-lg ${
                    batchSize === sz ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {sz} trang
                </button>
              ))}
            </div>
          </div>

          {/* Prominent Image-Only PDF Notification */}
          {isImageOnlyPdf && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-900 flex items-center gap-2.5 font-bold">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>
                PDF scan: Cần gửi ảnh trang cho ChatGPT Vision. Khuyên dùng nút 📦 FULL PACK bên dưới!
              </span>
            </div>
          )}

          {/* Export Status Messages */}
          {exportStatusMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-900 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{exportStatusMessage}</span>
            </div>
          )}

          {exportError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-900 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {/* Packets List */}
          {packets.length > 0 ? (
            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1 custom-scrollbar">
              {packets.map((pkt) => {
                const pageCount = pkt.endPage - pkt.startPage + 1;
                const isExporting = exportingBatchIndex === pkt.batchIndex;

                return (
                  <div
                    key={pkt.batchIndex}
                    className={`bg-slate-50 border rounded-2xl p-4 space-y-3 transition-colors ${
                      isImageOnlyPdf || pkt.requiresVision
                        ? 'border-indigo-200 bg-indigo-50/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                          <span>Gói #{pkt.batchIndex} / {pkt.totalBatches}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            (Trang {pkt.startPage} → {pkt.endPage})
                          </span>
                        </div>
                        {(pkt.requiresVision || isImageOnlyPdf) && (
                          <div className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                            <span>⚠ Có trang scan/ảnh — Cần ChatGPT Vision</span>
                          </div>
                        )}
                      </div>

                      {/* Export Progress Indicator */}
                      {isExporting && exportProgress && (
                        <div className="text-xs text-indigo-700 font-extrabold flex items-center gap-1.5 animate-pulse">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang tạo ảnh {exportProgress.current}/{exportProgress.total}...</span>
                        </div>
                      )}
                    </div>

                    {/* Self-contained Action Buttons (Requirement 9) */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
                      {/* 1. COPY PROMPT */}
                      <button
                        onClick={() => handleCopyBatch(pkt)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] rounded-xl shadow-xs inline-flex items-center gap-1 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedBatchIndex === pkt.batchIndex ? 'ĐÃ COPY!' : 'COPY PROMPT'}</span>
                      </button>

                      {/* 2. .TXT PROMPT */}
                      <button
                        onClick={() => {
                          const fullText = generateMasterPrompt() + '\n\n' + pkt.promptText;
                          const blob = new Blob([fullText], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `ori-toeic-batch-${pkt.batchIndex}-pages-${pkt.startPage}-${pkt.endPage}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-[11px] rounded-xl inline-flex items-center gap-1 transition-colors"
                        title="Tải prompt về file .txt"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>.TXT</span>
                      </button>

                      {/* 3. TẢI X ẢNH */}
                      <button
                        onClick={() => handleDownloadBatchImages(pkt)}
                        disabled={exportingBatchIndex !== null}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold text-[11px] rounded-xl inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                        title={`Tải lẻ ${pageCount} ảnh PNG`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>🖼 TẢI {pageCount} ẢNH</span>
                      </button>

                      {/* 4. FULL PACK (PRIMARY ACTION FOR IMAGE PDFS) */}
                      <button
                        onClick={() => handleDownloadFullPackZip(pkt)}
                        disabled={exportingBatchIndex !== null}
                        className={`px-3.5 py-1.5 font-extrabold text-[11px] rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all ${
                          isImageOnlyPdf || pkt.requiresVision
                            ? 'bg-purple-600 hover:bg-purple-500 text-white ring-2 ring-purple-400/30'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        } disabled:opacity-50`}
                        title="Tải trọn gói ZIP (chứa prompt.md + manifest.json + các ảnh PNG)"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>📦 FULL PACK</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl">
              Chưa có dữ liệu PDF preflight cho nguồn này. Vui lòng tải file ở Tab 1.
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PASTE & UPLOAD CHATGPT JSON (6 COL) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-600" />
              <span>📋 NHẬP KẾT QUẢ JSON TỪ CHATGPT</span>
            </h3>
            <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl cursor-pointer transition-colors inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>Tải file JSON</span>
              <input type="file" accept=".json" onChange={handleJsonFileUpload} className="hidden" />
            </label>
          </div>

          {parseError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {parseSuccessMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{parseSuccessMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <textarea
              rows={12}
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              placeholder="Dán mã JSON trả về từ ChatGPT vào đây (ví dụ: { &quot;schemaVersion&quot;: 1, &quot;questions&quot;: [...] })..."
              className="w-full p-4 border border-slate-300 rounded-2xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-900 text-emerald-400 placeholder:text-slate-600"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleProcessPastedJson}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md inline-flex items-center gap-2 transition-transform active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>GỘP DỮ LIỆU VÀO STAGING STORE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
