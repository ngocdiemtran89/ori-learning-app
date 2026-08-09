// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - 7-Step Admin Wizard
// ============================================================

import React, { useState } from 'react';
import {
  X,
  FileText,
  FileCode,
  Music,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Loader2,
  Download,
  Layers,
  ArrowRight,
  ArrowLeft,
  Play,
  Sparkles,
} from 'lucide-react';
import JSZip from 'jszip';
import { extractPdfTextItems } from '../../lib/cms/pdfUtils';
import { RawPackageSources, OriToeicPackageV1, ToeicPackageValidationReport } from '../../lib/toeicPackage/types';
import { buildOriToeicPackage } from '../../lib/toeicPackage/packageBuilder';
import { validateToeicPackage } from '../../lib/toeicPackage/validation';
import { importToeicPackage } from '../../lib/toeicPackage/packageImporter';

interface ToeicPackageImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (testId: string) => void;
}

export const ToeicPackageImporterModal: React.FC<ToeicPackageImporterModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);

  // STEP 1 Source Files
  const [testTitle, setTestTitle] = useState('Đề thi TOEIC Mới (Package Import)');
  const [listeningPdfFile, setListeningPdfFile] = useState<File | null>(null);
  const [readingPdfFile, setReadingPdfFile] = useState<File | null>(null);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [bilingualFile, setBilingualFile] = useState<File | null>(null);

  // STEP 2 Processing & Parsed State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [pkg, setPkg] = useState<OriToeicPackageV1 | null>(null);
  const [validationReport, setValidationReport] = useState<ToeicPackageValidationReport | null>(null);

  // STEP 6 Options
  const [showJsonView, setShowJsonView] = useState(false);

  // STEP 7 Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [execProgress, setExecProgress] = useState(0);
  const [execStatus, setExecStatus] = useState('');
  const [createdTestId, setCreatedTestId] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Audio files / ZIP upload in Step 1
  const handleAudioInput = async (files: FileList | File[]) => {
    const list: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.endsWith('.zip')) {
        try {
          const zip = await JSZip.loadAsync(f);
          for (const filename of Object.keys(zip.files)) {
            const entry = zip.files[filename];
            if (!entry.dir) {
              const blob = await entry.async('blob');
              const extractedFile = new File([blob], filename);
              list.push(extractedFile);
            }
          }
        } catch (err) {
          console.error('ZIP extraction error:', err);
        }
      } else {
        list.push(f);
      }
    }
    setAudioFiles(prev => [...prev, ...list]);
  };

  // STEP 2: Extract PDF texts & build package
  const startParsingPackage = async () => {
    setIsProcessing(true);
    setProcessStatus('Đang đọc các file nguồn...');

    try {
      let listeningPdfText = '';
      let readingPdfText = '';
      let answerKeyText = '';
      let transcriptPdfText = '';
      let bilingualJsonText = '';

      if (listeningPdfFile) {
        setProcessStatus('Đang đọc PDF Listening...');
        const items = await extractPdfTextItems(listeningPdfFile);
        listeningPdfText = items.map((i: { text: string }) => i.text).join(' ');
      }

      if (readingPdfFile) {
        setProcessStatus('Đang đọc PDF Reading...');
        const items = await extractPdfTextItems(readingPdfFile);
        readingPdfText = items.map((i: { text: string }) => i.text).join(' ');
      }

      if (answerKeyFile) {
        setProcessStatus('Đang đọc File Đáp Án...');
        if (answerKeyFile.name.endsWith('.pdf')) {
          const items = await extractPdfTextItems(answerKeyFile);
          answerKeyText = items.map((i: { text: string }) => i.text).join(' ');
        } else {
          answerKeyText = await answerKeyFile.text();
        }
      }

      if (transcriptFile) {
        setProcessStatus('Đang đọc Transcript...');
        if (transcriptFile.name.endsWith('.pdf')) {
          const items = await extractPdfTextItems(transcriptFile);
          transcriptPdfText = items.map((i: { text: string }) => i.text).join(' ');
        } else {
          transcriptPdfText = await transcriptFile.text();
        }
      }

      if (bilingualFile) {
        bilingualJsonText = await bilingualFile.text();
      }

      setProcessStatus('Đang tổng hợp Gói Đề TOEIC Hoàn Chỉnh...');

      const rawSources: RawPackageSources = {
        listeningPdfText,
        readingPdfText,
        answerKeyText,
        transcriptPdfText,
        audioFiles,
        bilingualJsonText,
      };

      const builtPkg = buildOriToeicPackage(rawSources, testTitle);
      const report = validateToeicPackage(builtPkg);

      setPkg(builtPkg);
      setValidationReport(report);

      setIsProcessing(false);
      setStep(3); // Advance to Question Review
    } catch (err: any) {
      console.error('Package parse error:', err);
      setProcessStatus(`Lỗi xử lý: ${err.message}`);
      setIsProcessing(false);
    }
  };

  // Run Package Importer (Dry Run or Create Draft)
  const handleExecuteImport = async (dryRun: boolean) => {
    if (!pkg) return;
    setIsExecuting(true);
    setExecError(null);
    setExecProgress(10);

    const res = await importToeicPackage(pkg, {
      isDryRun: dryRun,
      onProgress: (msg, current) => {
        setExecStatus(msg);
        setExecProgress(current);
      },
    });

    setIsExecuting(false);
    if (res.success) {
      if (!dryRun && res.testId) {
        setCreatedTestId(res.testId);
        if (onImportSuccess) onImportSuccess(res.testId);
      }
    } else {
      setExecError(res.error || 'Có lỗi xảy ra trong quá trình xử lý.');
    }
  };

  // Download Package JSON
  const downloadPackageJson = () => {
    if (!pkg) return;
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkg.test.title.replace(/[^a-z0-9]+/gi, '_')}_package.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-ori-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-2xl backdrop-blur-md">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight">IMPORT ĐỀ TOEIC HOÀN CHỈNH</h2>
              <p className="text-xs text-white/80">Tự động đọc PDF, Audio, Đáp Án & chuyển đổi thành Gói Đề TOEIC Standard 200 Câu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WIZARD STEPPERS */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between text-xs font-bold overflow-x-auto gap-2">
          {[
            { s: 1, label: '1. Nguồn Đề' },
            { s: 2, label: '2. Phân Tích' },
            { s: 3, label: '3. 200 Câu' },
            { s: 4, label: '4. Media' },
            { s: 5, label: '5. Đáp Án' },
            { s: 6, label: '6. Preview' },
            { s: 7, label: '7. Tạo Draft' },
          ].map(st => (
            <button
              key={st.s}
              disabled={step < st.s && !pkg}
              onClick={() => setStep(st.s as any)}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                step === st.s
                  ? 'bg-ori-600 text-white shadow-sm font-extrabold'
                  : step > st.s
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-400 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <span>{st.label}</span>
              {step > st.s && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            </button>
          ))}
        </div>

        {/* STEP CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1 — NGUỒN ĐỀ */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5">TÊN ĐỀ THI</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={e => setTestTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-ori-500"
                  placeholder="Nhập tên đề thi TOEIC..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LISTENING PDF */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-2">
                    <FileText className="w-4 h-4 text-ori-600" /> LISTENING PDF
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={e => setListeningPdfFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-ori-50 file:text-ori-700 hover:file:bg-ori-100 cursor-pointer"
                  />
                  {listeningPdfFile && <p className="text-[11px] font-bold text-emerald-600">✓ Đã chọn: {listeningPdfFile.name}</p>}
                </div>

                {/* READING PDF */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-600" /> READING PDF
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={e => setReadingPdfFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                  />
                  {readingPdfFile && <p className="text-[11px] font-bold text-emerald-600">✓ Đã chọn: {readingPdfFile.name}</p>}
                </div>

                {/* ANSWER KEY FILE */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> ĐÁP ÁN (PDF / TXT / CSV / JSON)
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.txt,.csv,.json"
                    onChange={e => setAnswerKeyFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                  {answerKeyFile && <p className="text-[11px] font-bold text-emerald-600">✓ Đã chọn: {answerKeyFile.name}</p>}
                </div>

                {/* TRANSCRIPT FILE */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-purple-600" /> TRANSCRIPT (PDF / TXT - Không bắt buộc)
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={e => setTranscriptFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                  />
                  {transcriptFile && <p className="text-[11px] font-bold text-purple-600">✓ Đã chọn: {transcriptFile.name}</p>}
                </div>
              </div>

              {/* AUDIO & ZIP FOLDER UPLOAD */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-2">
                    <Music className="w-4 h-4 text-amber-600" /> AUDIO / HÌNH ẢNH (CHỌN NHIỀU FILE KHẮP CÁC PHẦN HOẶC FILE ZIP)
                  </span>
                  <span className="text-xs font-bold text-slate-500">Đã chọn: {audioFiles.length} file</span>
                </div>
                <input
                  type="file"
                  multiple
                  accept="audio/*,image/*,.zip"
                  onChange={e => {
                    if (e.target.files?.length) handleAudioInput(e.target.files);
                  }}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                />
              </div>

              {/* BILINGUAL JSON */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                <span className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" /> BILINGUAL JSON (NỘI DUNG SONG NGỮ - KHÔNG BẮT BUỘC)
                </span>
                <input
                  type="file"
                  accept=".json"
                  onChange={e => setBilingualFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                {bilingualFile && <p className="text-[11px] font-bold text-indigo-600">✓ Đã chọn: {bilingualFile.name}</p>}
              </div>
            </div>
          )}

          {/* STEP 2 — PHÂN TÍCH */}
          {step === 2 && (
            <div className="py-12 text-center space-y-6">
              {isProcessing ? (
                <div className="space-y-4">
                  <Loader2 className="w-12 h-12 text-ori-600 animate-spin mx-auto" />
                  <h3 className="text-sm font-extrabold text-slate-800">{processStatus}</h3>
                  <p className="text-xs text-slate-500">Đang trích xuất văn bản PDF, chuẩn hóa cấu trúc 200 câu & gộp media...</p>
                </div>
              ) : (
                <div className="space-y-4 max-w-md mx-auto">
                  <Play className="w-12 h-12 text-ori-600 mx-auto" />
                  <h3 className="text-base font-extrabold text-slate-800">SẴN SÀNG PHÂN TÍCH GÓI NGUỒN</h3>
                  <p className="text-xs text-slate-500 font-medium">Bấm nút bên dưới để hệ thống phân tích client-side toàn bộ tài liệu nguồn mà bạn đã chọn.</p>
                  <button
                    onClick={startParsingPackage}
                    className="px-6 py-3 bg-ori-600 hover:bg-ori-500 text-white font-extrabold text-xs rounded-2xl shadow-lg flex items-center gap-2 mx-auto"
                  >
                    <Sparkles className="w-4 h-4" /> Bắt đầu Phân Tích Đề
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — KIỂM TRA 200 CÂU */}
          {step === 3 && pkg && (
            <div className="space-y-6">
              <div className="bg-slate-100 p-4 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-700">
                <span>CẤU TRÚC ĐỀ NORMALIZE:</span>
                <span className="text-emerald-700 font-extrabold">{pkg.questions.length} / 200 CÂU HỎI HỢP LỆ</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {[
                  { p: 'part1', label: 'Part 1 (Q1–6)', count: pkg.questions.filter(q => q.part === 'part1').length, target: 6 },
                  { p: 'part2', label: 'Part 2 (Q7–31)', count: pkg.questions.filter(q => q.part === 'part2').length, target: 25 },
                  { p: 'part3', label: 'Part 3 (Q32–70)', count: pkg.questions.filter(q => q.part === 'part3').length, target: 39 },
                  { p: 'part4', label: 'Part 4 (Q71–100)', count: pkg.questions.filter(q => q.part === 'part4').length, target: 30 },
                  { p: 'part5', label: 'Part 5 (Q101–130)', count: pkg.questions.filter(q => q.part === 'part5').length, target: 30 },
                  { p: 'part6', label: 'Part 6 (Q131–146)', count: pkg.questions.filter(q => q.part === 'part6').length, target: 16 },
                  { p: 'part7', label: 'Part 7 (Q147–200)', count: pkg.questions.filter(q => q.part === 'part7').length, target: 54 },
                ].map(item => (
                  <div key={item.p} className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between">
                    <span className="font-bold text-slate-700">{item.label}</span>
                    <span className={`px-2 py-0.5 rounded-full font-extrabold text-[11px] ${item.count === item.target ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                      {item.count}/{item.target}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4 — MEDIA */}
          {step === 4 && pkg && (
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase text-slate-700">KẾT QUẢ KHỚP MEDIA GÓI ĐỀ ({pkg.media.length} ITEMS)</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden text-xs max-h-96 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">ĐỐI TƯỢNG</th>
                      <th className="p-3">LOẠI</th>
                      <th className="p-3">TÊN FILE NGUỒN</th>
                      <th className="p-3">TRẠNG THÁI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {pkg.media.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-100/50">
                        <td className="p-3 font-bold text-slate-800">{m.targetNumberOrRange}</td>
                        <td className="p-3 uppercase font-extrabold text-[10px] text-slate-500">{m.mediaType}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">{m.filename}</td>
                        <td className="p-3 font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-extrabold ${m.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : m.status === 'conflict' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 5 — ĐÁP ÁN */}
          {step === 5 && pkg && (
            <div className="space-y-4">
              <div className="bg-slate-100 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-700">
                <span>ĐÃ NHẬP ĐÁP ÁN:</span>
                <span className="text-emerald-700 font-extrabold">{pkg.answers.length} / 200 CÂU</span>
              </div>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-2 max-h-80 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                {pkg.questions.map(q => {
                  const ans = q.correct_answer;
                  return (
                    <div key={q.question_number} className={`p-2 rounded-xl text-xs font-extrabold ${ans ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
                      <div>#{q.question_number}</div>
                      <div className="text-sm font-black">{ans || '-'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 6 — PREVIEW & HEALTH REPORT */}
          {step === 6 && pkg && validationReport && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-100 p-4 rounded-2xl text-xs font-bold">
                <span className="text-slate-800 font-extrabold">TRẠNG THÁI SỨC KHỎE GÓI ĐỀ:</span>
                <div className="flex gap-4">
                  <span className="text-red-600">BLOCKERS: {validationReport.blockers.length}</span>
                  <span className="text-amber-600">WARNINGS: {validationReport.warnings.length}</span>
                  <span className="text-blue-600">INFOS: {validationReport.infos.length}</span>
                </div>
              </div>

              {/* BLOCKERS LIST */}
              {validationReport.blockers.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl space-y-2 text-xs text-red-900">
                  <span className="font-extrabold uppercase flex items-center gap-1.5 text-red-700">
                    <AlertOctagon className="w-4 h-4" /> LỖI NGHỄN KHÔNG THỂ TẠO DRAFT ({validationReport.blockers.length}):
                  </span>
                  <ul className="list-disc list-inside space-y-1 font-bold">
                    {validationReport.blockers.map((b, i) => (
                      <li key={i}>{b.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* WARNINGS LIST */}
              {validationReport.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-2 text-xs text-amber-900">
                  <span className="font-extrabold uppercase flex items-center gap-1.5 text-amber-700">
                    <AlertTriangle className="w-4 h-4" /> CẢNH BÁO MỨC TRUNG BÌNH ({validationReport.warnings.length}):
                  </span>
                  <ul className="list-disc list-inside space-y-1 font-medium">
                    {validationReport.warnings.map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowJsonView(!showJsonView)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl flex items-center gap-2"
                >
                  <FileCode className="w-4 h-4" />
                  {showJsonView ? 'Ẩn JSON Nâng Cao' : 'Xem JSON Nâng Cao (Debug)'}
                </button>

                <button
                  type="button"
                  onClick={downloadPackageJson}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải JSON Package (.json)</span>
                </button>
              </div>

              {showJsonView && (
                <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-80">
                  {JSON.stringify(pkg, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* STEP 7 — TẠO ĐỀ DRAFT */}
          {step === 7 && (
            <div className="space-y-6 py-4">
              {createdTestId ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-3xl text-center space-y-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h3 className="text-base font-extrabold text-emerald-900">ĐỀ ĐÃ ĐƯỢC TẠO Ở TRẠNG THÁI DRAFT KHÔNG XUẤT BẢN KÈM THEO MEDIA!</h3>
                  <p className="text-xs text-emerald-700 font-bold">Mã đề: {createdTestId}</p>
                </div>
              ) : isExecuting ? (
                <div className="py-8 text-center space-y-4">
                  <Loader2 className="w-10 h-10 text-ori-600 animate-spin mx-auto" />
                  <h3 className="text-sm font-extrabold text-slate-800">{execStatus}</h3>
                  <div className="w-full max-w-md bg-slate-200 h-2.5 rounded-full overflow-hidden mx-auto">
                    <div className="bg-ori-600 h-full transition-all duration-300" style={{ width: `${execProgress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* DRY RUN BUTTON */}
                  <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-4 text-center">
                    <Info className="w-10 h-10 text-blue-600 mx-auto" />
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800">CHỈ KIỂM TRA — KHÔNG IMPORT</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1">Chạy thử nghiệm kiểm tra toàn bộ gói đề thi mà không ghi bất kỳ dữ liệu nào vào Supabase DB/Storage.</p>
                    </div>
                    <button
                      onClick={() => handleExecuteImport(true)}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md"
                    >
                      [CHỈ KIỂM TRA — KHÔNG IMPORT]
                    </button>
                  </div>

                  {/* CREATE DRAFT BUTTON */}
                  <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-4 text-center">
                    <Sparkles className="w-10 h-10 text-ori-600 mx-auto" />
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800">TẠO ĐỀ DRAFT TỪ PACKAGE</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1">Tạo một đề thi mới ở trạng thái DRAFT hoàn chỉnh với 200 câu hỏi, groups và upload media lên Supabase Storage.</p>
                    </div>
                    <button
                      onClick={() => handleExecuteImport(false)}
                      disabled={validationReport ? !validationReport.isValidForDraft : false}
                      className="px-5 py-2.5 bg-ori-600 hover:bg-ori-500 text-white font-extrabold text-xs rounded-xl shadow-md disabled:opacity-50"
                    >
                      [TẠO ĐỀ DRAFT TỪ PACKAGE]
                    </button>
                  </div>
                </div>
              )}

              {execError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-800">
                  {execError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* WIZARD FOOTER ACTIONS */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-extrabold">
          <button
            type="button"
            disabled={step === 1 || isProcessing || isExecuting}
            onClick={() => setStep((step - 1) as any)}
            className="px-4 py-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl flex items-center gap-1.5 disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" /> Quay Lại
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl"
            >
              Hủy
            </button>

            {step < 7 && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  if (step === 1) startParsingPackage();
                  else setStep((step + 1) as any);
                }}
                className="px-5 py-2 bg-ori-600 hover:bg-ori-500 text-white rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <span>{step === 1 ? 'Phân Tích Đề' : 'Tiếp Theo'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
