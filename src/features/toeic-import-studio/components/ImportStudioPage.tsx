import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  Upload,
  FileText,
  Bot,
  Table,
  Headphones,
  CheckCircle2,
  Download,
  ShieldCheck,
  Zap,
  Save,
  Trash2,
} from 'lucide-react';
import {
  StagingQuestion,
  StagingGroup,
  AudioSegment,
  PdfPreflightReport,
  FullValidationReport,
} from '../types';
import { processPdfPreflight } from '../pdf/pdfPreflight';
import { parseLocalPdfPages } from '../parser/localToeicParser';
import { mergeHybridPayload } from '../hybrid/hybridMerge';
import { validateFullToeicImport } from '../validation/validateFullToeic';
import { saveStagingDraft, loadStagingDraft, clearStagingDraft } from '../staging/stagingStore';

import { SourceFilesTab } from './SourceFilesTab';
import { PdfPreflightTab } from './PdfPreflightTab';
import { ChatGptHybridTab } from './ChatGptHybridTab';
import { StagingTableTab } from './StagingTableTab';
import { AudioTab } from './AudioTab';
import { ValidationTab } from './ValidationTab';
import { ExportTab } from './ExportTab';

export const ImportStudioPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [draftId] = useState<string>('ori-toeic-test-1');
  const [testTitle, setTestTitle] = useState<string>('ORI Full TOEIC Test 2026');

  // Source Files State
  const [listeningPdf, setListeningPdf] = useState<File | null>(null);
  const [readingPdf, setReadingPdf] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // PDF Preflight Reports State
  const [listeningReport, setListeningReport] = useState<PdfPreflightReport | null>(null);
  const [readingReport, setReadingReport] = useState<PdfPreflightReport | null>(null);

  // Staging Questions, Groups, Audio State
  const [questions, setQuestions] = useState<StagingQuestion[]>([]);
  const [groups, setGroups] = useState<StagingGroup[]>([]);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);

  const [notification, setNotification] = useState<string | null>(null);

  // Auto load draft on mount
  useEffect(() => {
    const draft = loadStagingDraft(draftId);
    if (draft) {
      setQuestions(draft.questions || []);
      setGroups(draft.groups || []);
      setAudioSegments(draft.audioSegments || []);
      if (draft.testTitle) setTestTitle(draft.testTitle);
      setNotification('Đã tự động khôi phục bản nháp từ bộ nhớ trình duyệt!');
    }
  }, [draftId]);

  // Auto save draft on state changes
  useEffect(() => {
    if (questions.length > 0 || groups.length > 0) {
      saveStagingDraft({
        draftId,
        testTitle,
        questions,
        groups,
        audioSegments,
        lastUpdated: new Date().toISOString(),
      });
    }
  }, [questions, groups, audioSegments, draftId, testTitle]);

  // Validation Report Memo
  const validationReport: FullValidationReport = useMemo(() => {
    return validateFullToeicImport(
      questions,
      groups,
      audioSegments,
      listeningReport?.totalPages || 0,
      listeningReport?.pages.map((p) => p.pageNumber) || [],
      readingReport?.totalPages || 0,
      readingReport?.pages.map((p) => p.pageNumber) || []
    );
  }, [questions, groups, audioSegments, listeningReport, readingReport]);

  // Handle PDF Preflight Loading
  const handleListeningPdfChange = async (file: File) => {
    setListeningPdf(file);
    try {
      const rep = await processPdfPreflight(file);
      setListeningReport(rep);
    } catch (e: any) {
      alert(`Lỗi đọc PDF Listening: ${e?.message || e}`);
    }
  };

  const handleReadingPdfChange = async (file: File) => {
    setReadingPdf(file);
    try {
      const rep = await processPdfPreflight(file);
      setReadingReport(rep);
    } catch (e: any) {
      alert(`Lỗi đọc PDF Reading: ${e?.message || e}`);
    }
  };

  const handleAudioFileChange = (file: File) => {
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => {
      setAudioDuration(tempAudio.duration);
    };
  };

  // Run Local Deterministic Parser
  const handleParseLocalPdfs = () => {
    let newQuestions: StagingQuestion[] = [...questions];
    let newGroups: StagingGroup[] = [...groups];

    if (listeningReport) {
      const res = parseLocalPdfPages(listeningReport.pages, 'listening');
      const merged = mergeHybridPayload(newQuestions, newGroups, res.questions, res.groups);
      newQuestions = merged.questions;
      newGroups = merged.groups;
    }

    if (readingReport) {
      const res = parseLocalPdfPages(readingReport.pages, 'reading');
      const merged = mergeHybridPayload(newQuestions, newGroups, res.questions, res.groups);
      newQuestions = merged.questions;
      newGroups = merged.groups;
    }

    setQuestions(newQuestions);
    setGroups(newGroups);
    setNotification('Đã bóc tách dữ liệu cục bộ từ PDF thành công!');
    setActiveTab(4); // Jump to Staging Table
  };

  // Import ChatGPT JSON Payload
  const handleImportChatGptJson = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);

      const importedQuestions: StagingQuestion[] = Array.isArray(parsed.questions)
        ? parsed.questions.map((q: any) => ({
            questionNumber: Number(q.questionNumber),
            part: Number(q.part) as any,
            questionText: String(q.questionText || ''),
            questionVi: q.questionVi ? String(q.questionVi) : undefined,
            options: {
              A: String(q.options?.A || ''),
              B: String(q.options?.B || ''),
              C: String(q.options?.C || ''),
              D: String(q.options?.D || ''),
            },
            optionsVi: q.optionsVi
              ? {
                  A: q.optionsVi.A ? String(q.optionsVi.A) : undefined,
                  B: q.optionsVi.B ? String(q.optionsVi.B) : undefined,
                  C: q.optionsVi.C ? String(q.optionsVi.C) : undefined,
                  D: q.optionsVi.D ? String(q.optionsVi.D) : undefined,
                }
              : undefined,
            correctAnswer: q.correctAnswer,
            groupKey: q.groupKey ? String(q.groupKey) : undefined,
            source: {
              pdf: q.sourcePage ? 'reading' : 'manual',
              page: Number(q.sourcePage || 1),
            },
            provenance: {
              questionTextSource: 'CHATGPT',
              optionsSource: 'CHATGPT',
              translationSource: 'CHATGPT',
              groupSource: 'CHATGPT',
            },
            confidence: Number(q.confidence || 0.95),
            status: 'AUTO_OK',
            warnings: Array.isArray(q.warnings) ? q.warnings : [],
          }))
        : [];

      const importedGroups: StagingGroup[] = Array.isArray(parsed.groups)
        ? parsed.groups.map((g: any) => ({
            groupKey: String(g.groupKey),
            part: Number(g.part) as any,
            startQuestion: Number(g.startQuestion),
            endQuestion: Number(g.endQuestion),
            instruction: g.instruction ? String(g.instruction) : undefined,
            passage: g.passage ? String(g.passage) : undefined,
            passageVi: g.passageVi ? String(g.passageVi) : undefined,
            documents: Array.isArray(g.documents) ? g.documents : [],
            sourcePages: Array.isArray(g.sourcePages) ? g.sourcePages : [1],
            provenance: 'CHATGPT',
            confidence: Number(g.confidence || 0.95),
            warnings: Array.isArray(g.warnings) ? g.warnings : [],
          }))
        : [];

      const res = mergeHybridPayload(questions, groups, importedQuestions, importedGroups);
      setQuestions(res.questions);
      setGroups(res.groups);
      setNotification(`Đã gộp ${importedQuestions.length} câu hỏi từ ChatGPT vào Staging!`);
    } catch (e: any) {
      alert(`Lỗi đọc dữ liệu JSON ChatGPT: ${e?.message || e}`);
    }
  };

  const handleUpdateQuestion = (updated: StagingQuestion) => {
    setQuestions((prev) => prev.map((q) => (q.questionNumber === updated.questionNumber ? updated : q)));
  };

  const handleUpdateGroup = (updated: StagingGroup) => {
    setGroups((prev) => prev.map((g) => (g.groupKey === updated.groupKey ? updated : g)));
  };

  const handleClearDraft = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bản nháp hiện tại không?')) {
      clearStagingDraft(draftId);
      setQuestions([]);
      setGroups([]);
      setAudioSegments([]);
      setNotification('Đã xóa bản nháp khỏi trình duyệt.');
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Header & Safety Badges */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center text-2xl shadow-inner">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                <span>🧰 ORI FULL TOEIC IMPORT STUDIO</span>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Phase 1 Hybrid
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Xử lý PDF cục bộ + ChatGPT Hybrid + Staging Q1–200 + Mốc Audio. Không cần API Key!
              </p>
            </div>
          </div>
        </div>

        {/* Safety Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-extrabold rounded-xl inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> BROWSER LOCAL ONLY
          </span>
          <span className="px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[11px] font-extrabold rounded-xl inline-flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> NO AI API COST
          </span>
          <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[11px] font-extrabold rounded-xl inline-flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> NO DATABASE WRITE
          </span>
          <button
            onClick={handleClearDraft}
            className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 rounded-xl border border-slate-700 transition-colors ml-2"
            title="Xóa bản nháp"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 text-xs text-indigo-300 flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 7 Workflow Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 bg-slate-900 p-2 rounded-2xl border border-slate-800 text-xs font-bold text-slate-300">
        {[
          { id: 1, label: '1. SOURCE FILES', icon: Upload },
          { id: 2, label: '2. PREFLIGHT', icon: FileText },
          { id: 3, label: '3. CHATGPT', icon: Bot },
          { id: 4, label: `4. STAGING (${questions.length})`, icon: Table },
          { id: 5, label: '5. AUDIO', icon: Headphones },
          { id: 6, label: '6. VALIDATE', icon: CheckCircle2 },
          { id: 7, label: '7. EXPORT', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white font-extrabold shadow-md'
                  : 'hover:bg-slate-800 hover:text-white text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Render */}
      {activeTab === 1 && (
        <SourceFilesTab
          listeningPdf={listeningPdf}
          readingPdf={readingPdf}
          audioFile={audioFile}
          audioDuration={audioDuration}
          listeningReport={listeningReport}
          readingReport={readingReport}
          onListeningPdfChange={handleListeningPdfChange}
          onReadingPdfChange={handleReadingPdfChange}
          onAudioFileChange={handleAudioFileChange}
          onParseLocalPdfs={handleParseLocalPdfs}
        />
      )}

      {activeTab === 2 && (
        <PdfPreflightTab
          listeningReport={listeningReport}
          readingReport={readingReport}
          listeningPdf={listeningPdf}
          readingPdf={readingPdf}
        />
      )}

      {activeTab === 3 && (
        <ChatGptHybridTab
          listeningReport={listeningReport}
          readingReport={readingReport}
          listeningPdf={listeningPdf}
          readingPdf={readingPdf}
          onImportChatGptJson={handleImportChatGptJson}
        />
      )}

      {activeTab === 4 && (
        <StagingTableTab
          questions={questions}
          groups={groups}
          onUpdateQuestion={handleUpdateQuestion}
          onUpdateGroup={handleUpdateGroup}
        />
      )}

      {activeTab === 5 && (
        <AudioTab
          audioFile={audioFile}
          audioDuration={audioDuration}
          audioSegments={audioSegments}
          onUpdateSegments={(segs) => setAudioSegments(segs)}
        />
      )}

      {activeTab === 6 && (
        <ValidationTab
          report={validationReport}
          onRefreshValidation={() => setNotification('Đã làm mới kết quả kiểm tra!')}
        />
      )}

      {activeTab === 7 && (
        <ExportTab
          testTitle={testTitle}
          questions={questions}
          groups={groups}
          audioSegments={audioSegments}
          validationReport={validationReport}
        />
      )}
    </div>
  );
};
