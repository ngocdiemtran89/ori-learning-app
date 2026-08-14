import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, FileCheck } from 'lucide-react';
import { FullValidationReport } from '../types';

interface ValidationTabProps {
  report: FullValidationReport;
  onRefreshValidation: () => void;
}

export const ValidationTab: React.FC<ValidationTabProps> = ({ report, onRefreshValidation }) => {
  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <div
        className={`border rounded-3xl p-6 shadow-xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          report.isReadyForDbImport
            ? 'bg-emerald-900 border-emerald-700'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-bold ${
              report.isReadyForDbImport ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            {report.isReadyForDbImport ? <CheckCircle2 className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              {report.isReadyForDbImport
                ? '✅ SẴN SÀNG CHO NHẬP DATABASE (READY FOR DATABASE IMPORT)'
                : '🔴 PHÁT HIỆN LỖI CẤU TRÚC (CẦN SỬA ĐỂ SẴN SÀNG)'}
            </h2>
            <p className="text-xs text-slate-300">
              Kiểm tra tính toàn vẹn 200 câu TOEIC Listening & Reading + Audio cutter timestamps.
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshValidation}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl border border-slate-700 shadow-xs inline-flex items-center gap-2 transition-colors shrink-0"
        >
          <FileCheck className="w-4 h-4" />
          <span>CHẠY KIỂM TRA LẠI</span>
        </button>
      </div>

      {/* Summary Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Listening Summary & Asset Readiness */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span>BÁO CÁO LISTENING & ASSET ASSET (Q1–100)</span>
            </h3>
            <span
              className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                report.listeningComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              CẤU TRÚC: {report.listeningSummary.total} / 100 câu
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-sans font-bold">PART 1</div>
              <div className="font-bold text-slate-900">{report.listeningSummary.part1Count}/6</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-sans font-bold">PART 2</div>
              <div className="font-bold text-slate-900">{report.listeningSummary.part2Count}/25</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-sans font-bold">PART 3</div>
              <div className="font-bold text-slate-900">{report.listeningSummary.part3Count}/39</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-sans font-bold">PART 4</div>
              <div className="font-bold text-slate-900">{report.listeningSummary.part4Count}/30</div>
            </div>
          </div>

          {/* ASSET READINESS & ENRICHMENT BREAKDOWN */}
          <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
            <div className="font-extrabold text-slate-800 uppercase tracking-tight flex items-center justify-between text-[11px]">
              <span>🎯 EXAM READINESS</span>
              <span className={`px-2 py-0.5 rounded font-black ${
                report.isReadyForDbImport ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                FULL TEST: {report.isReadyForDbImport ? 'READY ✅' : 'BLOCKED 🔴'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-center text-[11px]">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <div className="text-[9px] font-extrabold text-slate-500 uppercase">CẤU TRÚC</div>
                <div className="font-black text-slate-900">200 / 200</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <div className="text-[9px] font-extrabold text-slate-500 uppercase">P1 IMAGES</div>
                <div className="font-black text-slate-900">{report.assetSummary?.p1ImagesCount ?? 6}/6</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <div className="text-[9px] font-extrabold text-slate-500 uppercase">P3/P4 GRAPHICS</div>
                <div className="font-black text-slate-900">{report.assetSummary?.p3p4GraphicsCount ?? 5}/5</div>
              </div>
            </div>

            <div className="font-extrabold text-amber-900 uppercase tracking-tight flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
              <span>💡 LEARNING ENRICHMENT (V2)</span>
              <span className={`px-2 py-0.5 rounded font-black ${
                (report.assetSummary?.p2TranscriptsCount ?? 0) === 25 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                P2 STATUS: {(report.assetSummary?.p2TranscriptsCount ?? 0) === 25 ? 'COMPLETE ✅' : 'INCOMPLETE 🟡'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
              <div className="bg-amber-50 p-2 rounded-xl border border-amber-200">
                <div className="text-[9px] font-extrabold text-amber-800 uppercase">P2 TRANSCRIPTS</div>
                <div className="font-black text-amber-900">{report.assetSummary?.p2TranscriptsCount ?? 0}/25</div>
              </div>
              <div className="bg-amber-50 p-2 rounded-xl border border-amber-200">
                <div className="text-[9px] font-extrabold text-amber-800 uppercase">P2 CLASSIFIED</div>
                <div className="font-black text-amber-900">{report.assetSummary?.p2ClassifiedCount ?? 0}/25</div>
              </div>
            </div>
          </div>
        </div>

        {/* Reading Summary */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>BÁO CÁO READING (Q101–200)</span>
            </h3>
            <span
              className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                report.readingComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {report.readingSummary.total} / 100 câu
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-sans font-bold">PART 5</div>
              <div className="font-bold text-slate-900">{report.readingSummary.part5Count}/30</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-sans font-bold">PART 6</div>
              <div className="font-bold text-slate-900">{report.readingSummary.part6Count}/16</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-sans font-bold">PART 7</div>
              <div className="font-bold text-slate-900">{report.readingSummary.part7Count}/54</div>
            </div>
          </div>
        </div>
      </div>

      {/* Errors List */}
      {report.errors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 space-y-3">
          <h3 className="font-extrabold text-rose-900 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>DANH SÁCH LỖI CẤU TRÚC ({report.errors.length} LỖI)</span>
          </h3>
          <ul className="list-disc pl-6 space-y-1 text-xs text-rose-800 font-medium">
            {report.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings List */}
      {report.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 space-y-3">
          <h3 className="font-extrabold text-amber-900 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>THÔNG BÁO CẢNH BÁO ({report.warnings.length} CẢNH BÁO)</span>
          </h3>
          <ul className="list-disc pl-6 space-y-1 text-xs text-amber-800 font-medium">
            {report.warnings.map((warn, idx) => (
              <li key={idx}>{warn}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
