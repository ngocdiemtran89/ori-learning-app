import React, { useState } from 'react';
import { X, Volume2, RotateCw, AlertTriangle, Lightbulb } from 'lucide-react';
import { VocabularyItem } from '../../lib/supabase/types';

interface VocabularyPreviewModalProps {
  item: Partial<VocabularyItem>;
  deckTitle?: string;
  onClose: () => void;
}

export const VocabularyPreviewModal: React.FC<VocabularyPreviewModalProps> = ({
  item,
  deckTitle = 'Bộ Từ Vựng',
  onClose,
}) => {
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.audio_url) {
      const audio = new Audio(item.audio_url);
      audio.play().catch(() => {});
    } else if (item.word && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(item.word);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6 sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase border border-indigo-200">
              XEM TRƯỚC BẢN NHÁP (PREVIEW)
            </span>
            <h3 className="text-sm font-extrabold text-slate-900 mt-1">{deckTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Flashcard Box */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className={`cursor-pointer min-h-[300px] rounded-3xl p-6 border transition-all flex flex-col justify-between ${
            isFlipped
              ? 'bg-slate-900 text-white border-slate-800 shadow-xl'
              : 'bg-gradient-to-br from-indigo-50 via-white to-sky-50 border-indigo-200 shadow-md hover:shadow-lg'
          }`}
        >
          {!isFlipped ? (
            /* FRONT CARD */
            <div className="flex flex-col items-center justify-center text-center my-auto space-y-3">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                {item.part_of_speech || 'noun'}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                {item.word || 'word'}
              </h2>
              {item.ipa && (
                <span className="text-sm font-semibold text-slate-500 font-mono">
                  {item.ipa}
                </span>
              )}

              <button
                type="button"
                onClick={handlePlayAudio}
                className="mt-2 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-md shadow-indigo-600/20 transition-all inline-flex items-center gap-2 text-xs font-bold"
              >
                <Volume2 className="w-4 h-4" />
                <span>Phát Âm</span>
              </button>
            </div>
          ) : (
            /* BACK CARD */
            <div className="space-y-4 my-auto">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-indigo-400 block tracking-wider">
                  NGHĨA TIẾNG VIỆT
                </span>
                <h3 className="text-xl font-extrabold text-white mt-0.5">
                  {item.meaning_vi || 'Nghĩa tiếng Việt'}
                </h3>
              </div>

              {(item.example_en || item.example_vi) && (
                <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-1">
                  {item.example_en && (
                    <p className="text-xs font-semibold text-indigo-200 italic">
                      "{item.example_en}"
                    </p>
                  )}
                  {item.example_vi && (
                    <p className="text-xs text-slate-400">
                      {item.example_vi}
                    </p>
                  )}
                </div>
              )}

              {item.collocations && item.collocations.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-400 block flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" /> Cụm từ hay gặp (Collocations)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.collocations.map((col, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-slate-800 text-slate-200 text-[11px] rounded-lg border border-slate-700 font-medium">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {item.common_mistake && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-rose-200">Lỗi thường gặp:</strong>
                    <span>{item.common_mistake}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-200/20 flex items-center justify-between text-[11px] font-bold opacity-75">
            <span>{isFlipped ? 'Mặt sau (Nghĩa)' : 'Mặt trước (Từ)'}</span>
            <span className="flex items-center gap-1 text-indigo-500">
              <RotateCw className="w-3.5 h-3.5" /> Click để lật thẻ
            </span>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
          >
            Đóng Xem Trước
          </button>
        </div>
      </div>
    </div>
  );
};
