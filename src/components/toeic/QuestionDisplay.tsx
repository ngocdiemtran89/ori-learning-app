import React, { useState, useCallback } from 'react';
import { Globe, Star, Check } from 'lucide-react';
import type { StudentToeicQuestion } from '../../lib/supabase/types';

interface QuestionDisplayProps {
  question: StudentToeicQuestion;
  selectedAnswer: string | null;
  onSelectAnswer: (answer: string) => void;
  disabled?: boolean;
  /** Part practice mode — enables translation + save word */
  isPartMode?: boolean;
  /** Callback to save a word from this question */
  onSaveWord?: (word: string, context: string) => Promise<void>;
}

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  selectedAnswer,
  onSelectAnswer,
  disabled = false,
  isPartMode = false,
  onSaveWord,
}) => {
  const optionLabels = question.part === 'part2' ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
  const [showTranslation, setShowTranslation] = useState(false);
  const [saveWordInput, setSaveWordInput] = useState('');
  const [saveWordOpen, setSaveWordOpen] = useState(false);
  const [wordSaved, setWordSaved] = useState(false);
  const [savingWord, setSavingWord] = useState(false);

  const handleSaveWord = useCallback(async () => {
    if (!saveWordInput.trim() || !onSaveWord) return;
    setSavingWord(true);
    const context = question.question_text || '';
    await onSaveWord(saveWordInput.trim(), context);
    setWordSaved(true);
    setSavingWord(false);
    setTimeout(() => { setWordSaved(false); setSaveWordOpen(false); setSaveWordInput(''); }, 1500);
  }, [saveWordInput, onSaveWord, question.question_text]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-extrabold text-ori-600 bg-ori-50 px-2.5 py-1 rounded-lg">
          Q{question.question_number}
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase">
          {question.part.replace('part', 'Part ')}
        </span>
      </div>

      {question.question_text && (
        <p className="text-sm text-slate-800 font-medium leading-relaxed">
          {question.question_text}
        </p>
      )}

      {/* Translation (Part mode only) */}
      {isPartMode && showTranslation && (
        <div className="text-sm text-slate-500 italic bg-amber-50/60 border border-amber-200/50 rounded-xl px-4 py-2.5 leading-relaxed">
          {question.translation_vi || (
            <span className="text-slate-400 not-italic text-xs">Chưa có bản dịch cho nội dung này.</span>
          )}
        </div>
      )}

      <div className="space-y-2">
        {optionLabels.map((label, idx) => {
          const optionText = question.options?.[idx] || `(${label})`;
          const optionVi = isPartMode && showTranslation && question.options_vi?.[idx];
          const isSelected = selectedAnswer === label;

          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => onSelectAnswer(label)}
              className={`
                w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-150
                flex items-start gap-3 text-sm
                ${isSelected
                  ? 'border-ori-500 bg-ori-50 text-ori-900 shadow-sm shadow-ori-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }
                ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <span className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 transition-colors mt-0.5
                ${isSelected
                  ? 'bg-ori-600 text-white'
                  : 'bg-slate-100 text-slate-500'
                }
              `}>
                {label}
              </span>
              <div className="flex-1">
                <span className="font-medium">{optionText}</span>
                {optionVi && (
                  <span className="block text-xs text-slate-400 italic mt-0.5">{optionVi}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Practice tools: Translation + Save Word (Part mode only) */}
      {isPartMode && (
        <div className="flex items-center gap-2 pt-1">
          {/* Translation toggle */}
          <button
            type="button"
            onClick={() => setShowTranslation(!showTranslation)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
              ${showTranslation
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }
            `}
          >
            <Globe className="w-3.5 h-3.5" />
            {showTranslation ? 'Ẩn bản dịch' : 'Xem bản dịch'}
          </button>

          {/* Save Word */}
          {onSaveWord && (
            <button
              type="button"
              onClick={() => setSaveWordOpen(!saveWordOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <Star className="w-3.5 h-3.5" />
              Lưu từ
            </button>
          )}
        </div>
      )}

      {/* Save Word input panel */}
      {isPartMode && saveWordOpen && onSaveWord && (
        <div className="bg-sky-50/60 border border-sky-200/50 rounded-xl p-3 space-y-2">
          <label className="text-xs font-bold text-sky-700">Nhập từ muốn lưu</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={saveWordInput}
              onChange={(e) => setSaveWordInput(e.target.value)}
              placeholder="postpone, deadline..."
              className="flex-1 px-3 py-2 text-sm border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
              maxLength={100}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveWord()}
            />
            <button
              type="button"
              onClick={handleSaveWord}
              disabled={!saveWordInput.trim() || savingWord || wordSaved}
              className="px-3 py-2 text-xs font-extrabold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {wordSaved ? <><Check className="w-3.5 h-3.5" /> Đã lưu</> : savingWord ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
