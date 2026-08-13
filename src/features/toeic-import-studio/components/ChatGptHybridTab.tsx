import React, { useState } from 'react';
import { Bot, Copy, Download, Upload, CheckCircle2, AlertCircle, FileCode, Sparkles } from 'lucide-react';
import { PdfPreflightReport, ChatGptBatchPacket } from '../types';
import { generateMasterPrompt, generateBatchPackets } from '../pdf/packetGenerator';

interface ChatGptHybridTabProps {
  listeningReport: PdfPreflightReport | null;
  readingReport: PdfPreflightReport | null;
  onImportChatGptJson: (jsonStr: string) => void;
}

export const ChatGptHybridTab: React.FC<ChatGptHybridTabProps> = ({
  listeningReport,
  readingReport,
  onImportChatGptJson,
}) => {
  const [activeSource, setActiveSource] = useState<'reading' | 'listening'>('reading');
  const [batchSize, setBatchSize] = useState<number>(5);
  const [copiedMasterPrompt, setCopiedMasterPrompt] = useState<boolean>(false);
  const [copiedBatchIndex, setCopiedBatchIndex] = useState<number | null>(null);

  const [pastedJson, setPastedJson] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccessMessage, setParseSuccessMessage] = useState<string | null>(null);

  const currentReport = activeSource === 'listening' ? listeningReport : readingReport;

  const packets: ChatGptBatchPacket[] = currentReport
    ? generateBatchPackets(currentReport.pages, activeSource, batchSize)
    : [];

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
              Copy gói dữ liệu gửi cho ChatGPT bên ngoài → Dán lại kết quả JSON chuẩn ORI. Không tốn phí API!
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
      </div>

      {/* Grid: 2 Columns (Left: Packet Generator, Right: JSON Paste & Upload) */}
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

          {/* Packets List */}
          {packets.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {packets.map((pkt) => (
                <div
                  key={pkt.batchIndex}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                        <span>Gói #{pkt.batchIndex} / {pkt.totalBatches}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          (Trang {pkt.startPage} → {pkt.endPage})
                        </span>
                      </div>
                      {pkt.requiresVision && (
                        <div className="text-[10px] font-bold text-rose-600">
                          ⚠ Có trang scan/ảnh — Cần tải ảnh lên ChatGPT Vision
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyBatch(pkt)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedBatchIndex === pkt.batchIndex ? 'ĐÃ COPY!' : 'COPY PROMPT'}</span>
                      </button>

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
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl inline-flex items-center gap-1 transition-colors"
                        title="Tải gói về file .txt"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>.TXT</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
