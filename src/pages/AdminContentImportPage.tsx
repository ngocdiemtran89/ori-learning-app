import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Download,
  BookOpen,
  Headphones,
  FileCode,
  Sparkles,
  Layers,
} from 'lucide-react';
import { LoadingState } from '../components/ui/LoadingState';
import { getAdminVocabularyDecks } from '../lib/supabase/adminVocabulary';
import { VocabularyDeck } from '../lib/supabase/types';
import {
  ImportContentType,
  ImportFileFormat,
  ImportParsedRecord,
  ImportPlan,
  ImportExecutionResult,
} from '../lib/cms/import/types';
import {
  parseImportFileContent,
  validateImportLimits,
  validateVocabularyImportRecord,
  validateLessonImportRecord,
  checkInFileDuplicates,
} from '../lib/cms/import/importValidation';
import {
  VOCABULARY_CSV_TEMPLATE,
  GRAMMAR_JSON_TEMPLATE,
  LISTENING_JSON_TEMPLATE,
  READING_JSON_TEMPLATE,
  downloadTemplateFile,
} from '../lib/cms/import/importTemplates';
import {
  preflightDatabaseDuplicates,
  executeImportPlan,
} from '../lib/supabase/adminImport';

export const AdminContentImportPage: React.FC = () => {
  const navigate = useNavigate();

  // Step 1 & 2: Selection state
  const [contentType, setContentType] = useState<ImportContentType>('vocabulary');
  const [fileFormat, setFileFormat] = useState<ImportFileFormat>('csv');

  // Decks state for Vocabulary import
  const [decks, setDecks] = useState<VocabularyDeck[]>([]);
  const [targetDeckId, setTargetDeckId] = useState<string>('');
  const [loadingDecks, setLoadingDecks] = useState<boolean>(false);

  // File parsing & Plan state
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);

  // Execution state
  const [importing, setImporting] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportExecutionResult | null>(null);

  const [copiedTemplate, setCopiedTemplate] = useState<boolean>(false);

  // Load Decks when Vocabulary is selected
  useEffect(() => {
    if (contentType === 'vocabulary') {
      async function loadDecks() {
        setLoadingDecks(true);
        const res = await getAdminVocabularyDecks();
        if (res.data) {
          setDecks(res.data);
          if (res.data.length > 0) {
            setTargetDeckId(res.data[0].id);
          }
        }
        setLoadingDecks(false);
      }
      loadDecks();
    }
  }, [contentType]);

  // Adjust format based on content type
  const handleContentTypeChange = (type: ImportContentType) => {
    setContentType(type);
    setImportPlan(null);
    setImportResult(null);
    setParseError(null);
    if (type !== 'vocabulary') {
      setFileFormat('json');
    }
  };

  // Handle local File Selection & Preflight
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRawFile(file);
    setParseError(null);
    setImportPlan(null);
    setImportResult(null);

    // Limit check 1: File size limit (5MB)
    const limitErr = validateImportLimits(file.size, 0);
    if (limitErr && limitErr.includes('Kích thước')) {
      setParseError(limitErr);
      return;
    }

    setParsing(true);

    try {
      const text = await file.text();
      const { rawRecords, parseErrors } = parseImportFileContent(text, contentType, fileFormat);

      if (parseErrors.length > 0) {
        setParseError(parseErrors[0]);
        setParsing(false);
        return;
      }

      // Limit check 2: Record count limit (1000)
      const recLimitErr = validateImportLimits(file.size, rawRecords.length);
      if (recLimitErr && recLimitErr.includes('bản ghi')) {
        setParseError(recLimitErr);
        setParsing(false);
        return;
      }

      // Local Validation
      let initialRecords: ImportParsedRecord[] = [];
      if (contentType === 'vocabulary') {
        initialRecords = rawRecords.map((r, idx) => validateVocabularyImportRecord(r, idx + 1));
      } else {
        initialRecords = rawRecords.map((r, idx) => validateLessonImportRecord(r, idx + 1, contentType));
      }

      // Check in-file duplicates
      const afterInFileCheck = checkInFileDuplicates(initialRecords, contentType);

      // Preflight Database Duplicates
      const finalRecords = await preflightDatabaseDuplicates(contentType, afterInFileCheck, targetDeckId);

      // Calculate Summary
      const summary = {
        totalRecords: finalRecords.length,
        validCount: finalRecords.filter((r) => r.status === 'VALID').length,
        warningCount: finalRecords.filter((r) => r.status === 'WARNING').length,
        errorCount: finalRecords.filter((r) => r.status === 'ERROR').length,
        conflictCount: finalRecords.filter((r) => r.status === 'CONFLICT').length,
        selectedCount: finalRecords.filter((r) => r.selected).length,
      };

      setImportPlan({
        contentType,
        fileFormat,
        records: finalRecords,
        summary,
      });
    } catch (err: any) {
      setParseError(`Không thể đọc file: ${err.message}`);
    }

    setParsing(false);
  };

  const handleToggleSelectRow = (index: number) => {
    if (!importPlan) return;
    const updated = importPlan.records.map((r) => {
      if (r.rowIndex === index) {
        return { ...r, selected: !r.selected };
      }
      return r;
    });

    const selectedCount = updated.filter((r) => r.selected).length;
    setImportPlan({
      ...importPlan,
      records: updated,
      summary: { ...importPlan.summary, selectedCount },
    });
  };

  const handleSelectAllValid = (selected: boolean) => {
    if (!importPlan) return;
    const updated = importPlan.records.map((r) => {
      if (r.status === 'VALID' || r.status === 'WARNING') {
        return { ...r, selected };
      }
      return r;
    });

    const selectedCount = updated.filter((r) => r.selected).length;
    setImportPlan({
      ...importPlan,
      records: updated,
      summary: { ...importPlan.summary, selectedCount },
    });
  };

  const handleExecuteImport = async () => {
    if (!importPlan || importing) return;

    setImporting(true);
    setProgressMsg('Đang khởi tạo dữ liệu nhập...');

    const res = await executeImportPlan(importPlan, targetDeckId, (current, total) => {
      setProgressMsg(`Đang nhập ${current} / ${total} bản ghi...`);
    });

    setImportResult(res);
    setImporting(false);
  };

  const handleDownloadTemplate = () => {
    if (contentType === 'vocabulary') {
      downloadTemplateFile('ori-vocabulary-template.csv', VOCABULARY_CSV_TEMPLATE, 'text/csv;charset=utf-8;');
    } else if (contentType === 'grammar') {
      downloadTemplateFile('ori-grammar-template.json', GRAMMAR_JSON_TEMPLATE, 'application/json;');
    } else if (contentType === 'listening') {
      downloadTemplateFile('ori-listening-template.json', LISTENING_JSON_TEMPLATE, 'application/json;');
    } else if (contentType === 'reading') {
      downloadTemplateFile('ori-reading-template.json', READING_JSON_TEMPLATE, 'application/json;');
    }
  };

  const handleCopyTemplate = () => {
    let t = VOCABULARY_CSV_TEMPLATE;
    if (contentType === 'grammar') t = GRAMMAR_JSON_TEMPLATE;
    if (contentType === 'listening') t = LISTENING_JSON_TEMPLATE;
    if (contentType === 'reading') t = READING_JSON_TEMPLATE;

    navigator.clipboard.writeText(t);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  const getRedirectPath = () => {
    if (contentType === 'vocabulary') return `/admin/content/vocabulary/decks/${targetDeckId}`;
    if (contentType === 'grammar') return '/admin/content/grammar';
    if (contentType === 'listening') return '/admin/content/listening';
    return '/admin/content/reading';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/admin/content"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại CMS Hub
        </NavLink>
      </div>

      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-2">
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Upload className="w-6 h-6 text-ori-600" /> Nhập Nội Dung Hàng Loạt (Bulk Content Import Center)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Nhập từ vựng, bài ngữ pháp, bài nghe và đọc từ file CSV hoặc JSON. Tất cả nội dung nhập đều được bảo vệ tự động ở dạng <strong className="text-slate-700">BẢN NHÁP (DRAFT)</strong>.
        </p>
      </div>

      {/* STEP 1: Select Content Type */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
          1. Chọn Loại Nội Dung Cần Nhập
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => handleContentTypeChange('vocabulary')}
            className={`p-4 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all ${
              contentType === 'vocabulary'
                ? 'bg-blue-50/60 border-blue-500 text-blue-900 font-bold shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs block">Từ Vựng (Vocabulary)</span>
              <span className="text-[10px] text-slate-400 font-medium">Hỗ trợ CSV / JSON</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleContentTypeChange('grammar')}
            className={`p-4 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all ${
              contentType === 'grammar'
                ? 'bg-indigo-50/60 border-indigo-500 text-indigo-900 font-bold shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs block">Ngữ Pháp (Grammar)</span>
              <span className="text-[10px] text-slate-400 font-medium">Hỗ trợ JSON</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleContentTypeChange('listening')}
            className={`p-4 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all ${
              contentType === 'listening'
                ? 'bg-purple-50/60 border-purple-500 text-purple-900 font-bold shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs block">Luyện Nghe (Listening)</span>
              <span className="text-[10px] text-slate-400 font-medium">Hỗ trợ JSON</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleContentTypeChange('reading')}
            className={`p-4 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all ${
              contentType === 'reading'
                ? 'bg-emerald-50/60 border-emerald-500 text-emerald-900 font-bold shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs block">Luyện Đọc (Reading)</span>
              <span className="text-[10px] text-slate-400 font-medium">Hỗ trợ JSON</span>
            </div>
          </button>
        </div>

        {/* Target Deck Selection for Vocabulary */}
        {contentType === 'vocabulary' && (
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 block">
              Chọn Bộ Từ Vựng Mục Tiêu (Target Deck) <span className="text-rose-500">*</span>
            </label>
            {loadingDecks ? (
              <span className="text-xs text-slate-400">Đang tải danh sách bộ từ vựng...</span>
            ) : decks.length === 0 ? (
              <p className="text-xs text-rose-500 font-bold">Chưa có bộ từ vựng nào. Vui lòng tạo bộ từ vựng trước.</p>
            ) : (
              <select
                value={targetDeckId}
                onChange={(e) => setTargetDeckId(e.target.value)}
                className="w-full sm:w-96 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-ori-600"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.slug})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* STEP 2: Format & Template Download */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-extrabold text-slate-900">2. Đấu Nối Định Dạng & File Mẫu</h3>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyTemplate}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedTemplate ? 'Đã Sao Chép!' : 'Sao Chép Mẫu'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-ori-50 hover:bg-ori-100 text-ori-700 font-extrabold text-xs rounded-xl flex items-center gap-1 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Tải File Mẫu
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="text-slate-500">Định dạng file:</span>
          {contentType === 'vocabulary' && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={fileFormat === 'csv'}
                onChange={() => setFileFormat('csv')}
                className="accent-ori-600"
              />
              <span>CSV (Comma Separated Values)</span>
            </label>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="json"
              checked={fileFormat === 'json'}
              onChange={() => setFileFormat('json')}
              className="accent-ori-600"
            />
            <span>JSON (Structured JavaScript Object Notation)</span>
          </label>
        </div>
      </div>

      {/* STEP 3: File Upload Zone */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
          3. Tải File Dữ Liệu Lên
        </h3>

        <div className="border-2 border-dashed border-slate-200 hover:border-ori-500 rounded-3xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer relative">
          <input
            type="file"
            accept={fileFormat === 'csv' ? '.csv' : '.json'}
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-ori-50 text-ori-600 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <span className="text-sm font-extrabold text-slate-900 block">
                {rawFile ? rawFile.name : `Bấm để chọn file ${fileFormat.toUpperCase()}`}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Tối đa 5 MB • Tối đa 1000 bản ghi mỗi đợt nhập
              </span>
            </div>
          </div>
        </div>

        {parsing && <LoadingState message="Đang phân tích và kiểm tra tính hợp lệ của file..." />}

        {parseError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}
      </div>

      {/* STEP 4: PREVIEW & CONFIRMATION */}
      {importPlan && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                4. Xem Trước & Kiểm Tra Trước Khi Nhập (Import Plan Preview)
              </h3>
              <p className="text-xs text-slate-500">
                Kiểm tra danh sách bản ghi. Chỉ các bản ghi được tích chọn Hợp lệ / Cảnh báo mới được lưu dưới dạng bản nháp.
              </p>
            </div>

            <button
              type="button"
              disabled={importing || importPlan.summary.selectedCount === 0}
              onClick={handleExecuteImport}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all shrink-0"
            >
              <CheckCircle2 className="w-4.5 h-4.5" />
              <span>
                {importing
                  ? 'Đang Nhập Dữ Liệu...'
                  : `NHẬP ${importPlan.summary.selectedCount} BẢN GHI HỢP LỆ (DRAFT)`}
              </span>
            </button>
          </div>

          {progressMsg && (
            <div className="p-4 bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold rounded-2xl flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 animate-spin" />
              <span>{progressMsg}</span>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Tổng bản ghi</span>
              <span className="text-lg font-extrabold text-slate-900">{importPlan.summary.totalRecords}</span>
            </div>
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <span className="text-[10px] font-extrabold text-emerald-700 uppercase block">Hợp lệ</span>
              <span className="text-lg font-extrabold text-emerald-800">{importPlan.summary.validCount}</span>
            </div>
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
              <span className="text-[10px] font-extrabold text-amber-700 uppercase block">Cảnh báo</span>
              <span className="text-lg font-extrabold text-amber-800">{importPlan.summary.warningCount}</span>
            </div>
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl">
              <span className="text-[10px] font-extrabold text-rose-700 uppercase block">Lỗi</span>
              <span className="text-lg font-extrabold text-rose-800">{importPlan.summary.errorCount}</span>
            </div>
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl">
              <span className="text-[10px] font-extrabold text-purple-700 uppercase block">Trùng dữ liệu</span>
              <span className="text-lg font-extrabold text-purple-800">{importPlan.summary.conflictCount}</span>
            </div>
          </div>

          {/* Select all controls */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSelectAllValid(true)}
                className="text-ori-600 hover:underline"
              >
                Chọn tất cả bản ghi hợp lệ
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => handleSelectAllValid(false)}
                className="text-slate-400 hover:underline"
              >
                Bỏ chọn tất cả
              </button>
            </div>
            <span>Đã chọn: {importPlan.summary.selectedCount} bản ghi</span>
          </div>

          {/* Records Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold uppercase sticky top-0 bg-white z-10">
                <tr>
                  <th className="py-3 px-3 text-center">Chọn</th>
                  <th className="py-3 px-3">Dòng #</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3">Nội dung (Title/Word & Slug)</th>
                  <th className="py-3 px-3">Chi tiết Lỗi / Cảnh báo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {importPlan.records.map((rec) => {
                  const canSelect = rec.status === 'VALID' || rec.status === 'WARNING';
                  const titleOrWord = rec.data.word || rec.data.title || 'Nội dung';
                  const subKey = rec.data.meaning_vi || rec.data.slug || '';

                  return (
                    <tr key={rec.rowIndex} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          disabled={!canSelect}
                          checked={rec.selected}
                          onChange={() => handleToggleSelectRow(rec.rowIndex)}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer disabled:opacity-30"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 font-bold">{rec.rowIndex}</td>
                      <td className="py-2.5 px-3">
                        {rec.status === 'VALID' && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase rounded-full">
                            HỢP LỆ
                          </span>
                        )}
                        {rec.status === 'WARNING' && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase rounded-full">
                            CẢNH BÁO
                          </span>
                        )}
                        {rec.status === 'ERROR' && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold uppercase rounded-full">
                            LỖI
                          </span>
                        )}
                        {rec.status === 'CONFLICT' && (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold uppercase rounded-full">
                            TRÙNG DỮ LIỆU
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 block">{titleOrWord}</span>
                        {subKey && <span className="font-mono text-[10px] text-slate-400 block">{subKey}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        {rec.errors.map((e, idx) => (
                          <div key={idx} className="text-rose-600 font-bold flex items-center gap-1">
                            <XCircle className="w-3 h-3 shrink-0" />
                            <span>
                              [{e.field}]: {e.message}
                            </span>
                          </div>
                        ))}
                        {rec.warnings.map((w, idx) => (
                          <div key={idx} className="text-amber-700 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>
                              [{w.field}]: {w.message}
                            </span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 5: RESULTS DISPLAY */}
      {importResult && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
            <h3 className="text-base font-extrabold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Nhập Hoàn Tất!
            </h3>
            <p className="text-xs text-emerald-800 font-medium">
              Đã xử lý {importResult.totalProcessed} bản ghi: <strong>{importResult.successCount} thành công</strong> (0 bị xuất bản tự động). Tất cả được lưu dưới dạng <strong className="uppercase">Bản Nháp</strong>.
            </p>
          </div>

          {importResult.failedCount > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs">
              <span className="font-extrabold text-rose-800 block">Danh Sách Lỗi Trong Quá Trình Nhập:</span>
              <ul className="list-disc list-inside text-rose-700 font-medium space-y-1">
                {importResult.errors.map((err, idx) => (
                  <li key={idx}>
                    Dòng {err.rowIndex}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(getRedirectPath())}
              className="px-5 py-2.5 bg-ori-600 hover:bg-ori-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-ori-600/20 transition-all"
            >
              Xem Nội Dung Vừa Nhập (CMS)
            </button>

            <NavLink
              to="/admin/content"
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              Quay Lại CMS Hub
            </NavLink>
          </div>
        </div>
      )}
    </div>
  );
};
