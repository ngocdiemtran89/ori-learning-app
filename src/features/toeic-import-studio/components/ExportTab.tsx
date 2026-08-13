import React from 'react';
import { Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { StagingQuestion, StagingGroup, AudioSegment, FullValidationReport, OriFullToeicImportSchema } from '../types';

interface ExportTabProps {
  testTitle: string;
  questions: StagingQuestion[];
  groups: StagingGroup[];
  audioSegments: AudioSegment[];
  validationReport: FullValidationReport;
}

export const ExportTab: React.FC<ExportTabProps> = ({
  testTitle,
  questions,
  groups,
  audioSegments,
  validationReport,
}) => {
  const handleExportFullJson = () => {
    if (!validationReport.isReadyForDbImport) {
      if (
        !window.confirm(
          'Dữ liệu hiện tại vẫn còn một số cảnh báo/lỗi cấu trúc. Bạn có chắc chắn muốn xuất file JSON không?'
        )
      ) {
        return;
      }
    }

    const payload: OriFullToeicImportSchema = {
      schemaVersion: 1,
      test: {
        title: testTitle || 'ORI Full TOEIC Test 2026',
      },
      sourceCoverage: {
        listeningPages: [],
        readingPages: [],
        unhandledListeningPages: [],
        unhandledReadingPages: [],
      },
      questions,
      groups,
      audioSegments,
      warnings: validationReport.warnings,
      metadata: {
        totalQuestions: questions.length,
        listeningCount: questions.filter((q) => q.part <= 4).length,
        readingCount: questions.filter((q) => q.part > 4).length,
        createdAt: new Date().toISOString(),
        isReadyForDbImport: validationReport.isReadyForDbImport,
      },
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanTitle = (testTitle || 'ori-full-toeic').toLowerCase().replace(/\s+/g, '-');
    link.href = url;
    link.download = `${cleanTitle}-import-v1.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto text-3xl shadow-inner">
          <Download className="w-8 h-8" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h2 className="text-xl font-extrabold text-slate-900">
            7. XUẤT FILE CHUẨN HOÁ ORI FULL TOEIC TEST (JSON V1)
          </h2>
          <p className="text-xs text-slate-500">
            Xuất toàn bộ 200 câu hỏi, nhóm bài đọc, bản dịch và mốc thời gian audio thành 1 file JSON duy nhất để lưu trữ hoặc nạp vào Database ở Phase 2.
          </p>
        </div>

        {/* Validation Status Preview */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            {validationReport.isReadyForDbImport ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span className="font-bold text-slate-800">
              Trạng thái sẵn sàng Database:
            </span>
          </div>
          <span
            className={`font-black px-2.5 py-0.5 rounded-full ${
              validationReport.isReadyForDbImport
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {validationReport.isReadyForDbImport ? 'SẴN SÀNG ✅' : 'CẦN XEM XÉT 🟡'}
          </span>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleExportFullJson}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-2xl shadow-lg inline-flex items-center gap-2 transition-transform active:scale-95"
          >
            <Download className="w-5 h-5" />
            <span>📤 EXPORT ORI FULL TEST JSON (v1)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
