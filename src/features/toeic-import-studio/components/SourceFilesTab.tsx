import React from 'react';
import { Upload, FileText, Music, FileCheck } from 'lucide-react';
import { PdfPreflightReport } from '../types';

interface SourceFilesTabProps {
  listeningPdf: File | null;
  readingPdf: File | null;
  audioFile: File | null;
  audioDuration: number;
  listeningReport: PdfPreflightReport | null;
  readingReport: PdfPreflightReport | null;
  onListeningPdfChange: (file: File) => void;
  onReadingPdfChange: (file: File) => void;
  onAudioFileChange: (file: File) => void;
  onParseLocalPdfs: () => void;
}

export const SourceFilesTab: React.FC<SourceFilesTabProps> = ({
  listeningPdf,
  readingPdf,
  audioFile,
  audioDuration,
  listeningReport,
  readingReport,
  onListeningPdfChange,
  onReadingPdfChange,
  onAudioFileChange,
  onParseLocalPdfs,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <Upload className="w-5 h-5 text-indigo-600" />
          <span>1. TẢI FILE NGUỒN (LOCAL BROWSER ONLY)</span>
        </h2>
        <p className="text-xs text-slate-500">
          Tất cả file được xử lý trực tiếp trong trình duyệt cá nhân của bạn. Không gửi lên Server hay Supabase.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-2">
          {/* Listening PDF Input */}
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-4 text-center space-y-2 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center mx-auto text-lg font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-xs">A. LISTENING PDF</h3>
                <p className="text-[10px] text-slate-500">Q1–100 PDF đề nghe</p>
              </div>
              {listeningPdf ? (
                <div className="bg-sky-50 border border-sky-200 p-2 rounded-xl text-left space-y-0.5">
                  <div className="text-[11px] font-bold text-sky-900 truncate">{listeningPdf.name}</div>
                  <div className="text-[10px] text-sky-700">
                    {(listeningPdf.size / 1024 / 1024).toFixed(2)} MB • {listeningReport ? `${listeningReport.totalPages} trang` : 'Đang đọc...'}
                  </div>
                </div>
              ) : null}
            </div>
            <label className="inline-block px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] rounded-xl cursor-pointer shadow-xs transition-colors mt-2">
              <span>{listeningPdf ? 'Thay PDF' : 'Chọn PDF'}</span>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => e.target.files?.[0] && onListeningPdfChange(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>

          {/* Reading PDF Input */}
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-4 text-center space-y-2 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto text-lg font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-xs">B. READING PDF</h3>
                <p className="text-[10px] text-slate-500">Q101–200 PDF đề đọc</p>
              </div>
              {readingPdf ? (
                <div className="bg-indigo-50 border border-indigo-200 p-2 rounded-xl text-left space-y-0.5">
                  <div className="text-[11px] font-bold text-indigo-900 truncate">{readingPdf.name}</div>
                  <div className="text-[10px] text-indigo-700">
                    {(readingPdf.size / 1024 / 1024).toFixed(2)} MB • {readingReport ? `${readingReport.totalPages} trang` : 'Đang đọc...'}
                  </div>
                </div>
              ) : null}
            </div>
            <label className="inline-block px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] rounded-xl cursor-pointer shadow-xs transition-colors mt-2">
              <span>{readingPdf ? 'Thay PDF' : 'Chọn PDF'}</span>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => e.target.files?.[0] && onReadingPdfChange(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>

          {/* Full Listening MP3 Input */}
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-4 text-center space-y-2 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mx-auto text-lg font-bold">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-xs">C. LISTENING MP3</h3>
                <p className="text-[10px] text-slate-500">1 Audio MP3 duy nhất</p>
              </div>
              {audioFile ? (
                <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-left space-y-0.5">
                  <div className="text-[11px] font-bold text-emerald-900 truncate">{audioFile.name}</div>
                  <div className="text-[10px] text-emerald-700">
                    {(audioFile.size / 1024 / 1024).toFixed(2)} MB • {Math.floor(audioDuration / 60)}m {Math.floor(audioDuration % 60)}s
                  </div>
                </div>
              ) : null}
            </div>
            <label className="inline-block px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] rounded-xl cursor-pointer shadow-xs transition-colors mt-2">
              <span>{audioFile ? 'Thay MP3' : 'Chọn MP3'}</span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => e.target.files?.[0] && onAudioFileChange(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>

          {/* Transcript / Script PDF (OPTIONAL) */}
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-4 text-center space-y-2 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mx-auto text-lg font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-xs">D. SCRIPT PDF</h3>
                <p className="text-[10px] text-slate-500">(Tùy chọn) Transcript</p>
              </div>
            </div>
            <label className="inline-block px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[11px] rounded-xl cursor-pointer transition-colors mt-2">
              <span>Chọn Script</span>
              <input type="file" accept=".pdf,.txt" className="hidden" />
            </label>
          </div>

          {/* Answer Key File / Text (OPTIONAL) */}
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-4 text-center space-y-2 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mx-auto text-lg font-bold">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-xs">E. ANSWER KEY</h3>
                <p className="text-[10px] text-slate-500">(Tùy chọn) Đáp án A-D</p>
              </div>
            </div>
            <label className="inline-block px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[11px] rounded-xl cursor-pointer transition-colors mt-2">
              <span>Chọn Đáp Án</span>
              <input type="file" accept=".txt,.json,.csv" className="hidden" />
            </label>
          </div>
        </div>

        {/* Local Parse Button */}
        {(listeningPdf || readingPdf) && (
          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={onParseLocalPdfs}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm rounded-2xl shadow-md inline-flex items-center gap-2 transition-transform active:scale-95"
            >
              <FileCheck className="w-5 h-5" />
              <span>BẮT ĐẦU BÓC TÁCH NGUỒN CỤC BỘ (LOCAL PARSER)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
