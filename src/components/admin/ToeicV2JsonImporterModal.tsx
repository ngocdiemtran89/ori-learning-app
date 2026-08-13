// ============================================================
// ORI TOEIC Website V2 — Admin GPT JSON Importer Modal
// ============================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileJson, Upload, AlertTriangle, CheckCircle, X, Play, FileCode } from 'lucide-react';
import { V2ValidationReport } from '../../lib/toeicV2/types';
import { validateV2Package } from '../../lib/toeicV2/validatePackage';
import { adaptToCanonicalPackage } from '../../lib/toeicV2/canonicalAdapter';
import { importV2ToeicPackage } from '../../lib/toeicV2/importCoordinator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ToeicV2JsonImporterModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [jsonText, setJsonText] = useState('');
  const [report, setReport] = useState<V2ValidationReport | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedPackage, setParsedPackage] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleParseAndValidate = (text: string) => {
    setJsonText(text);
    setStatusMessage(null);
    if (!text.trim()) {
      setReport(null);
      setParsedPackage(null);
      return;
    }

    try {
      const rawPkg = JSON.parse(text);
      const canonicalPkg = adaptToCanonicalPackage(rawPkg);
      setParsedPackage(canonicalPkg);
      const valReport = validateV2Package(canonicalPkg);
      setReport(valReport);
    } catch (err: any) {
      setParsedPackage(null);
      setReport({
        isValid: false,
        errors: [{ code: 'JSON_SYNTAX_ERROR', message: `Cú pháp JSON không hợp lệ: ${err.message}`, severity: 'error' }],
        warnings: [],
        summary: {
          totalQuestions: 0,
          totalGroups: 0,
          partCounts: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0, P7: 0 },
          hasTranslations: false,
          mediaCount: 0,
          learningUnitsCount: 0,
        },
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleParseAndValidate(content);
    };
    reader.readAsText(file);
  };

  const handleDryRun = () => {
    if (!parsedPackage) return;
    const valReport = validateV2Package(parsedPackage);
    setReport(valReport);
    setStatusMessage(
      valReport.isValid
        ? '✓ Kiểm tra Dry Run THÀNH CÔNG! Gói V2 sẵn sàng để tạo bản nháp (Create DRAFT).'
        : '❌ Kiểm tra Dry Run THẤT BẠI. Vui lòng khắc phục các lỗi bên dưới.'
    );
  };

  const handleCreateDraft = async () => {
    if (!parsedPackage) return;
    setIsProcessing(true);
    setStatusMessage('Đang khởi tạo bản nháp DRAFT...');

    try {
      const res = await importV2ToeicPackage(parsedPackage, {
        isDryRun: false,
        onProgress: (step) => setStatusMessage(step),
      });

      if (res.success && res.testId) {
        setStatusMessage('Tạo DRAFT thành công! Đang chuyển hướng...');
        setTimeout(() => {
          onClose();
          navigate(`/admin/content/test-bank/${res.testId}/edit`);
        }, 1000);
      } else {
        setStatusMessage(`Tạo DRAFT thất bại: ${res.error || 'Lỗi không xác định'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Lỗi: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Import GPT JSON V2 / Import Studio Studio</h3>
              <p className="text-xs text-slate-500">Kiểm duyệt strict 200 câu TOEIC & Xem trước bản nháp DRAFT</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* File Upload Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <label className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-50 font-semibold text-sm transition-colors shadow-sm">
              <Upload className="w-4 h-4" />
              Tải file JSON (V1 / V2 / GPT)
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
            <span className="text-xs text-slate-500">tự động nhận dạng OriToeicPackageV1 & V2 Canonical model</span>
          </div>

          {/* Text Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nội dung JSON V2</label>
            <textarea
              value={jsonText}
              onChange={(e) => handleParseAndValidate(e.target.value)}
              placeholder='Dán nội dung JSON vào đây...'
              className="w-full h-36 p-3 font-mono text-xs bg-slate-900 text-slate-100 rounded-xl border border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Live Validation & Structured Preview Section */}
          {report && (
            <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-blue-600" /> Bản xem trước gói dữ liệu (Import Preview)
              </h4>

              {/* Title & Type */}
              {parsedPackage && (
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                  <span className="font-extrabold text-slate-800">Tiêu đề: {parsedPackage.metadata?.title}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold rounded-md">
                    {parsedPackage.metadata?.test_type || 'full'}
                  </span>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block">TỔNG SỐ CÂU</span>
                  <span className={`font-extrabold ${report.summary.totalQuestions === 200 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {report.summary.totalQuestions} / 200
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block">TỔNG SỐ GROUP</span>
                  <span className="font-extrabold text-slate-800">{report.summary.totalGroups}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block">SONG NGỮ</span>
                  <span className="font-extrabold text-slate-800">{report.summary.hasTranslations ? 'Có dịch VI' : 'Chưa có'}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block">LEARNING UNITS</span>
                  <span className="font-extrabold text-blue-600">{report.summary.learningUnitsCount} mục</span>
                </div>
              </div>

              {/* Part Counts */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 text-xs font-medium">
                <span className="font-bold text-slate-700">Phân bổ Part:</span>
                <span className="font-mono text-slate-900 font-bold">
                  P1:{report.summary.partCounts.P1} P2:{report.summary.partCounts.P2} P3:{report.summary.partCounts.P3} P4:{report.summary.partCounts.P4} P5:{report.summary.partCounts.P5} P6:{report.summary.partCounts.P6} P7:{report.summary.partCounts.P7}
                </span>
              </div>

              {/* Errors Block */}
              {report.errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 max-h-40 overflow-y-auto">
                  <h4 className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Phát hiện {report.errors.length} lỗi không thể bỏ qua (Blockers):
                  </h4>
                  <ul className="text-xs text-red-600 space-y-1 list-disc pl-5">
                    {report.errors.map((err, idx) => (
                      <li key={idx}>{err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Success Banner */}
              {report.isValid && report.errors.length === 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  Bản xem trước hợp lệ! Sẵn sàng để khởi tạo bản nháp (Create DRAFT).
                </div>
              )}
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium rounded-xl">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200/60 rounded-xl text-sm font-medium transition-colors"
          >
            Hủy bỏ
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDryRun}
              disabled={!parsedPackage || isProcessing}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Play className="w-4 h-4" />
              Dry Run (Kiểm tra)
            </button>
            <button
              onClick={handleCreateDraft}
              disabled={!report?.isValid || isProcessing}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center gap-2"
            >
              <FileJson className="w-4 h-4" />
              Xác nhận Tạo bản nháp (Confirm DRAFT)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
