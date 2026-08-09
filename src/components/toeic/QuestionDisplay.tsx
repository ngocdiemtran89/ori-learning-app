import React from 'react';
import type { StudentToeicQuestion } from '../../lib/supabase/types';

interface QuestionDisplayProps {
  question: StudentToeicQuestion;
  selectedAnswer: string | null;
  onSelectAnswer: (answer: string) => void;
  disabled?: boolean;
}

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  selectedAnswer,
  onSelectAnswer,
  disabled = false,
}) => {
  const optionLabels = question.part === 'part2' ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];

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

      <div className="space-y-2">
        {optionLabels.map((label, idx) => {
          const optionText = question.options?.[idx] || `(${label})`;
          const isSelected = selectedAnswer === label;

          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => onSelectAnswer(label)}
              className={`
                w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-150
                flex items-center gap-3 text-sm
                ${isSelected
                  ? 'border-ori-500 bg-ori-50 text-ori-900 shadow-sm shadow-ori-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }
                ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <span className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 transition-colors
                ${isSelected
                  ? 'bg-ori-600 text-white'
                  : 'bg-slate-100 text-slate-500'
                }
              `}>
                {label}
              </span>
              <span className="font-medium">{optionText}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
