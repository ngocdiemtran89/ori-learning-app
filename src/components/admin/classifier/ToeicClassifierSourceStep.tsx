import React, { useState } from 'react';
import { extractTextFromFile } from '../../../lib/toeic/classifier/extractSource';
import { Upload } from 'lucide-react';

interface Props {
  onSourceExtracted: (text: string, answerKeyText: string) => void;
}

export const ToeicClassifierSourceStep: React.FC<Props> = ({ onSourceExtracted }) => {
  const [sourceText, setSourceText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isAnswer: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File không được vượt quá 10MB.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const text = await extractTextFromFile(file);
      if (isAnswer) {
        setAnswerText(text);
      } else {
        setSourceText(text);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
    // Reset file input
    e.target.value = '';
  };

  const handleNext = () => {
    if (!sourceText.trim()) {
      setError('Vui lòng nhập hoặc tải lên nội dung đề thi.');
      return;
    }
    onSourceExtracted(sourceText, answerText);
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900 mb-2">Bước 1: Nguồn Dữ Liệu</h2>
        <p className="text-xs text-slate-500 font-medium">Nhập text thô hoặc tải lên file (.txt, .docx, .pdf) để hệ thống tự động phân tích.</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-900">
            Nội dung đề thi (Bắt buộc)
          </label>
          <div className="flex items-center gap-3">
            <label className="flex-1 cursor-pointer">
              <div className="px-4 py-2 border-2 border-dashed border-slate-300 rounded-xl hover:border-ori-500 hover:bg-ori-50 transition-colors flex items-center justify-center gap-2">
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-600">Tải File Đề Thi</span>
              </div>
              <input type="file" accept=".txt,.docx,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, false)} />
            </label>
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            className="w-full h-64 p-4 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-ori-500 focus:ring-1 focus:ring-ori-500"
            placeholder="Hoặc dán nội dung text thô của đề thi vào đây..."
          />
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-900">
            Đáp án (Tùy chọn)
          </label>
          <div className="flex items-center gap-3">
            <label className="flex-1 cursor-pointer">
              <div className="px-4 py-2 border-2 border-dashed border-slate-300 rounded-xl hover:border-ori-500 hover:bg-ori-50 transition-colors flex items-center justify-center gap-2">
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-600">Tải File Đáp Án</span>
              </div>
              <input type="file" accept=".txt,.docx,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, true)} />
            </label>
          </div>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            className="w-full h-64 p-4 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-ori-500 focus:ring-1 focus:ring-ori-500"
            placeholder="Dán nội dung đáp án (vd: 1 A\n2 B\n3 C)..."
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={loading}
          className="px-6 py-2.5 bg-ori-600 hover:bg-ori-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          {loading ? 'Đang phân tích...' : 'Phân Tích Dữ Liệu'}
        </button>
      </div>
    </div>
  );
};
