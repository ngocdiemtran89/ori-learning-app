// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - 7-Step Admin Wizard
// ============================================================

import React, { useState, useEffect } from 'react';
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
  Crop,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import JSZip from 'jszip';
import { extractPdfTextItems } from '../../lib/cms/pdfUtils';
import { RawPackageSources, OriToeicPackageV1, ToeicPackageValidationReport, OriPackageMediaEntry } from '../../lib/toeicPackage/types';
import { buildOriToeicPackage } from '../../lib/toeicPackage/packageBuilder';
import { validateToeicPackage } from '../../lib/toeicPackage/validation';
import { importToeicPackage } from '../../lib/toeicPackage/packageImporter';
import { extractPart1ImagesFromPdf, Part1ExtractedImage } from '../../lib/toeicPackage/part1ImageExtractor';
import { matchPackageMedia } from '../../lib/toeicPackage/mediaMatcher';
import { Part1PdfCropModal } from './Part1PdfCropModal';

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

  // Part 1 Image Management
  const [part1CroppedMap, setPart1CroppedMap] = useState<Record<number, File | Blob>>({});
  const [part1ExtractedMeta, setPart1ExtractedMeta] = useState<Record<number, Part1ExtractedImage>>({});
  const [isExtractingImages, setIsExtractingImages] = useState(false);

  // PDF Crop Modal State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropTargetQNum, setCropTargetQNum] = useState<number>(1);

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

  useEffect(() => {
    if (!pkg) return;
    const media = matchPackageMedia({
      audioFiles,
      part1PdfCroppedImages: part1CroppedMap,
    });

    const questionsCopy = pkg.questions.map((q) => ({ ...q }));
    const groupsCopy = pkg.groups.map((g) => ({ ...g }));

    media.forEach((m: OriPackageMediaEntry) => {
      if (m.file) {
        if (m.targetType === 'question') {
          const qNum = parseInt(m.targetNumberOrRange.replace(/[^0-9]+/g, ''), 10);
          const q = questionsCopy.find((x) => x.question_number === qNum);
          if (q) {
            if (m.mediaType === 'image') q.local_image_file = m.file;
            if (m.mediaType === 'audio') q.local_audio_file = m.file as File;
          }
        } else if (m.targetType === 'group') {
          const match = m.targetNumberOrRange.match(/([0-9]+)[–\-]([0-9]+)/);
          if (match) {
            const startQ = parseInt(match[1], 10);
            const endQ = parseInt(match[2], 10);
            const g = groupsCopy.find((x) => x.start_question === startQ && x.end_question === endQ);
            if (g && m.mediaType === 'audio') {
              g.local_audio_file = m.file as File;
            }
          }
        }
      }
    });

    const updatedPkg: OriToeicPackageV1 = {
      ...pkg,
      questions: questionsCopy,
      groups: groupsCopy,
      media,
    };

    const report = validateToeicPackage(updatedPkg);
    setPkg(updatedPkg);
    setValidationReport(report);
  }, [audioFiles, part1CroppedMap]);

  if (!isOpen) return null;

  // Reset entire import session to clean state
  const handleResetSession = () => {
    setTestTitle('Đề thi TOEIC Mới (Package Import)');
    setListeningPdfFile(null);
    setReadingPdfFile(null);
    setAnswerKeyFile(null);
    setTranscriptFile(null);
    setAudioFiles([]);
    setBilingualFile(null);
    setPart1CroppedMap({});
    setPart1ExtractedMeta({});
    setPkg(null);
    setValidationReport(null);
    setStep(1);
    setCreatedTestId(null);
    setExecError(null);
  };

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
    setAudioFiles(list);
  };

  // Trigger Automatic Part 1 Image Extraction
  const handleAutoExtractPart1Images = async (fileToUse?: File) => {
    const pdfToUse = fileToUse || listeningPdfFile;
    if (!pdfToUse) return;

    setIsExtractingImages(true);
    try {
      const extracted = await extractPart1ImagesFromPdf(pdfToUse);
      setPart1ExtractedMeta(extracted);
      
      const newCroppedMap: Record<number, File | Blob> = { ...part1CroppedMap };
      Object.values(extracted).forEach((item) => {
        if (item.blob && !newCroppedMap[item.questionNumber]) {
          newCroppedMap[item.questionNumber] = item.blob;
        }
      });
      setPart1CroppedMap(newCroppedMap);
    } catch (err) {
      console.error('Part 1 auto extraction failed:', err);
    } finally {
      setIsExtractingImages(false);
    }
  };

  // Handle manual crop save
  const handleCropSaved = (qNum: number, croppedBlob: Blob) => {
    setPart1CroppedMap((prev) => ({ ...prev, [qNum]: croppedBlob }));
    setPart1ExtractedMeta((prev) => ({
      ...prev,
      [qNum]: {
        questionNumber: qNum,
        blob: croppedBlob,
        filename: `p1_q${qNum}_manual_crop.png`,
        width: 400,
        height: 300,
        provenance: 'MANUAL_CROP',
        status: 'AUTO_EXTRACTED',
      },
    }));
  };

  // Handle manual upload for single Q1..Q6 image
  const handleManualImageUpload = (qNum: number, file: File) => {
    setPart1CroppedMap((prev) => ({ ...prev, [qNum]: file }));
    setPart1ExtractedMeta((prev) => ({
      ...prev,
      [qNum]: {
        questionNumber: qNum,
        blob: file,
        filename: file.name,
        width: 400,
        height: 300,
        provenance: 'MANUAL_UPLOAD',
        status: 'AUTO_EXTRACTED',
      },
    }));
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

        // Auto extract Part 1 images if not yet extracted
        if (Object.keys(part1CroppedMap).length < 6) {
          setProcessStatus('Đang tự động trích xuất 6 hình ảnh Part 1...');
          await handleAutoExtractPart1Images(listeningPdfFile);
        }
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
        part1PdfCroppedImages: part1CroppedMap,
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

    // Strict Gate Enforcement: Re-validate before execution
    const latestReport = validateToeicPackage(pkg);
    setValidationReport(latestReport);

    if (!dryRun && !latestReport.isValidForDraft) {
      setExecError('Không thể tạo Draft: Gói đề thi còn vướng lỗi BLOCKER nghiêm trọng.');
      return;
    }

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
              <p className="text-xs text-white/80">Tự động đọc PDF, Audio, Đáp Án & chuẩn hóa cấu trúc 200 câu chuẩn TOEIC</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetSession}
              title="Xóa phiên import hiện tại để bắt đầu mới"
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5 text-white"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Session
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-2">
                      <FileText className="w-4 h-4 text-ori-600" /> LISTENING PDF
                    </span>
                    {listeningPdfFile && (
                      <button
                        onClick={() => handleAutoExtractPart1Images()}
                        disabled={isExtractingImages}
                        className="px-2.5 py-1 bg-ori-100 hover:bg-ori-200 text-ori-800 text-[11px] font-extrabold rounded-lg flex items-center gap-1"
                      >
                        {isExtractingImages ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        <span>Tự trích ảnh Part 1</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      setListeningPdfFile(file);
                      if (file) handleAutoExtractPart1Images(file);
                    }}
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
                    <Music className="w-4 h-4 text-amber-600" /> AUDIO / HÌNH ẢNH LISTENING (CHỌN CÁC FILE HOẶC ZIP)
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

          {/* STEP 4 — MEDIA & PART 1 IMAGES */}
          {step === 4 && pkg && validationReport && (
            <div className="space-y-6">
              {/* GROUPED MEDIA SUMMARY HEADER */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center text-xs">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col justify-between">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase">P1 AUDIO</div>
                  <div className="text-base font-black text-slate-800">{validationReport.counts.p1AudioCount} / 6</div>
                  <div className="text-[9px] text-slate-400 font-bold">Clip 01–06</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col justify-between">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase">P2 AUDIO</div>
                  <div className="text-base font-black text-slate-800">{validationReport.counts.p2AudioCount} / 25</div>
                  <div className="text-[9px] font-extrabold text-ori-700">
                    {validationReport.counts.conventions?.p2Convention === 'P2_GLOBAL_QNUM' && 'Theo số câu TOEIC (Q7-Q31)'}
                    {validationReport.counts.conventions?.p2Convention === 'P2_LOCAL_INDEX' && 'Theo clip nội bộ (01-25)'}
                    {validationReport.counts.conventions?.p2Convention === 'P2_NUMBERING_AMBIGUOUS' && '⚠️ Không xác định'}
                    {(!validationReport.counts.conventions?.p2Convention || validationReport.counts.conventions?.p2Convention === 'P2_NONE') && 'Chưa có file'}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col justify-between">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase">P3 GROUPS</div>
                  <div className="text-base font-black text-slate-800">{validationReport.counts.p3GroupAudioCount} / 13</div>
                  <div className="text-[9px] font-extrabold text-ori-700">
                    {validationReport.counts.conventions?.p3Convention === 'P3_RANGE' && 'Dải câu TOEIC (Q32-34)'}
                    {validationReport.counts.conventions?.p3Convention === 'P3_LOCAL_INDEX' && 'Theo clip nội bộ (01-13)'}
                    {validationReport.counts.conventions?.p3Convention === 'P3_GLOBAL_STARTQ' && 'Số câu bắt đầu (Q32..)'}
                    {validationReport.counts.conventions?.p3Convention === 'P3_NUMBERING_AMBIGUOUS' && '⚠️ Không xác định'}
                    {(!validationReport.counts.conventions?.p3Convention || validationReport.counts.conventions?.p3Convention === 'P3_NONE') && 'Chưa có file'}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col justify-between">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase">P4 GROUPS</div>
                  <div className="text-base font-black text-slate-800">{validationReport.counts.p4GroupAudioCount} / 10</div>
                  <div className="text-[9px] font-extrabold text-ori-700">
                    {validationReport.counts.conventions?.p4Convention === 'P4_RANGE' && 'Dải câu TOEIC (Q71-73)'}
                    {validationReport.counts.conventions?.p4Convention === 'P4_LOCAL_INDEX' && 'Theo clip nội bộ (01-10)'}
                    {validationReport.counts.conventions?.p4Convention === 'P4_GLOBAL_STARTQ' && 'Số câu bắt đầu (Q71..)'}
                    {validationReport.counts.conventions?.p4Convention === 'P4_NUMBERING_AMBIGUOUS' && '⚠️ Không xác định'}
                    {(!validationReport.counts.conventions?.p4Convention || validationReport.counts.conventions?.p4Convention === 'P4_NONE') && 'Chưa có file'}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col justify-between">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase">TỔNG AUDIO</div>
                  <div className={`text-base font-black ${validationReport.counts.totalAudioFiles === 54 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {validationReport.counts.totalAudioFiles} / 54
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold">54 file audio chuẩn</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col justify-between">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase">P1 IMAGES</div>
                  <div className={`text-base font-black ${validationReport.counts.p1ImageCount === 6 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {validationReport.counts.p1ImageCount} / 6
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold">Tổng media = {validationReport.counts.readyMediaCount}</div>
                </div>
              </div>

              {/* PART 1 IMAGE MANAGER SECTION */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-ori-600" /> QUẢN LÝ 6 HÌNH ẢNH PART 1 (Q1–Q6)
                  </span>
                  <div className="flex gap-2">
                    {listeningPdfFile && (
                      <button
                        onClick={() => handleAutoExtractPart1Images()}
                        disabled={isExtractingImages}
                        className="px-3 py-1.5 bg-ori-600 hover:bg-ori-500 text-white text-xs font-extrabold rounded-xl flex items-center gap-1 shadow-sm"
                      >
                        {isExtractingImages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Tự trích ảnh từ PDF</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((qNum) => {
                    const imgBlob = part1CroppedMap[qNum];
                    const meta = part1ExtractedMeta[qNum];
                    const imgUrl = imgBlob ? URL.createObjectURL(imgBlob) : null;

                    return (
                      <div key={qNum} className="bg-white border border-slate-200 p-3 rounded-2xl space-y-2 flex flex-col justify-between text-center">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-black text-slate-800">
                            <span>Q{qNum}</span>
                            {meta?.provenance && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-extrabold uppercase">
                                {meta.provenance.replace('PDF_', '').replace('_', ' ')}
                              </span>
                            )}
                          </div>

                          {imgUrl ? (
                            <div className="h-24 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center p-1">
                              <img src={imgUrl} alt={`Q${qNum}`} className="max-h-full max-w-full object-contain rounded-lg" />
                            </div>
                          ) : (
                            <div className="h-24 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-[10px] text-slate-400 font-medium p-2">
                              <span>Thiếu hình Q{qNum}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 pt-1">
                          <button
                            onClick={() => {
                              setCropTargetQNum(qNum);
                              setCropModalOpen(true);
                            }}
                            className="w-full py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] rounded-lg flex items-center justify-center gap-1"
                          >
                            <Crop className="w-3 h-3 text-ori-600" /> Cắt từ PDF
                          </button>

                          <label className="block w-full py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] rounded-lg cursor-pointer">
                            <span>Tải ảnh</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleManualImageUpload(qNum, e.target.files[0]);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MEDIA MATCHING DETAILED TABLE */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold uppercase text-slate-700">KẾT QUẢ KHỚP MEDIA GÓI ĐỀ ({pkg.media.length} ITEMS)</h3>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden text-xs max-h-80 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px]">
                      <tr>
                        <th className="p-3">CANONICAL TARGET</th>
                        <th className="p-3">ĐỐI TƯỢNG</th>
                        <th className="p-3">LOẠI</th>
                        <th className="p-3">TÊN FILE NGUỒN</th>
                        <th className="p-3">TRẠNG THÁI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {pkg.media.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-100/50">
                          <td className="p-3 font-mono font-bold text-ori-700">{m.canonicalTarget || m.targetNumberOrRange}</td>
                          <td className="p-3 font-bold text-slate-800">{m.targetNumberOrRange}</td>
                          <td className="p-3 uppercase font-extrabold text-[10px] text-slate-500">{m.mediaType}</td>
                          <td className="p-3 font-mono text-[11px] text-slate-600">{m.filename}</td>
                          <td className="p-3 font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-extrabold ${m.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : m.status === 'conflict' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                              {m.status}
                            </span>
                            {m.error && <p className="text-[10px] text-red-600 font-normal mt-0.5">{m.error}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                  const isPart2D = q.question_number >= 7 && q.question_number <= 31 && ans === 'D';
                  return (
                    <div key={q.question_number} className={`p-2 rounded-xl text-xs font-extrabold ${isPart2D ? 'bg-red-200 text-red-900 border border-red-400' : ans ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
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
              {/* COMPACT GATE HEADER SUMMARY */}
              <div className="bg-slate-800 text-white p-5 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-2xl ${validationReport.isValidForDraft ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {validationReport.isValidForDraft ? <CheckCircle2 className="w-6 h-6" /> : <AlertOctagon className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm uppercase tracking-wide">TRẠNG THÁI SỨC KHỎE GÓI ĐỀ THI</h3>
                      <p className={`text-xs font-black ${validationReport.isValidForDraft ? 'text-emerald-400' : 'text-red-400'}`}>
                        {validationReport.isValidForDraft ? 'READY TO CREATE DRAFT (ĐỦ ĐIỀU KIỆN TẠO DRAFT)' : 'BLOCKED — FIX REQUIRED (CÓ LỖI BLOCKER NGHỄN)'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs font-bold">
                    <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-xl">BLOCKERS: {validationReport.blockers.length}</span>
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-xl">WARNINGS: {validationReport.warnings.length}</span>
                  </div>
                </div>

                {/* ASSET COMPLEteness GRID */}
                <div className="grid grid-cols-2 md:grid-cols-8 gap-2 text-center text-[11px] font-bold pt-2 border-t border-slate-700">
                  <div className="bg-slate-700/60 p-2 rounded-xl">CÂU HỎI: {validationReport.counts.totalQuestions}/200</div>
                  <div className="bg-slate-700/60 p-2 rounded-xl">ĐÁP ÁN: {validationReport.counts.totalAnswers}/200</div>
                  <div className="bg-slate-700/60 p-2 rounded-xl">P1 IMAGES: {validationReport.counts.p1ImageCount}/6</div>
                  <div className="bg-slate-700/60 p-2 rounded-xl">P1 AUDIO: {validationReport.counts.p1AudioCount}/6</div>
                  <div className="bg-slate-700/60 p-2 rounded-xl">P2 AUDIO: {validationReport.counts.p2AudioCount}/25</div>
                  <div className="bg-slate-700/60 p-2 rounded-xl">P3 AUDIO: {validationReport.counts.p3GroupAudioCount}/13</div>
                  <div className="bg-slate-700/60 p-2 rounded-xl">P4 AUDIO: {validationReport.counts.p4GroupAudioCount}/10</div>
                  <div className="bg-slate-700/60 p-2 rounded-xl">TỔNG AUDIO: {validationReport.counts.totalAudioFiles}/54</div>
                </div>
              </div>

              {/* BLOCKERS LIST */}
              {validationReport.blockers.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl space-y-2 text-xs text-red-900">
                  <span className="font-extrabold uppercase flex items-center gap-1.5 text-red-700">
                    <AlertOctagon className="w-4 h-4" /> LỖI NGHỄN BLOCKER THẮT NÚT ({validationReport.blockers.length}):
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
                    <AlertTriangle className="w-4 h-4" /> CẢNH BÁO KHÔNG NGHỄN ({validationReport.warnings.length}):
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
                  {showJsonView ? 'Ẩn JSON Nâng Cao' : 'Xem JSON Nâng Cao (Debug mediaAssignments)'}
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
                  {JSON.stringify(
                    {
                      ...pkg,
                      mediaAssignments: pkg.media.map(m => ({
                        sourceFile: m.filename,
                        part: m.part,
                        localIndex: m.localIndex,
                        targetType: m.targetType,
                        targetNumberOrRange: m.targetNumberOrRange,
                        canonicalTarget: m.canonicalTarget,
                        status: m.status,
                      })),
                    },
                    null,
                    2
                  )}
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
                      className="px-5 py-2.5 bg-ori-600 hover:bg-ori-500 text-white font-extrabold text-xs rounded-xl shadow-md disabled:opacity-40"
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

      {/* CROP MODAL */}
      <Part1PdfCropModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        pdfFile={listeningPdfFile}
        targetQuestionNumber={cropTargetQNum}
        onCropSaved={handleCropSaved}
      />
    </div>
  );
};
