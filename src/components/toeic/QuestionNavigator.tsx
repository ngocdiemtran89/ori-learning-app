import React from 'react';
import { TOEIC_FULL_TEST_STRUCTURE, CANONICAL_TOEIC_PARTS } from '../../lib/toeic/testStructure';

interface QuestionNavigatorProps {
  totalQuestions: number;
  currentQuestion: number;
  answeredQuestions: Set<number>;
  onNavigate: (questionNumber: number) => void;
}

export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  currentQuestion,
  answeredQuestions,
  onNavigate,
}) => {
  return (
    <div className="space-y-3">
      <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
        Điều hướng câu hỏi
      </div>
      <div className="text-sm font-bold text-slate-700">
        {answeredQuestions.size} / 200 đã trả lời
      </div>
      {CANONICAL_TOEIC_PARTS.map(partKey => {
        const range = TOEIC_FULL_TEST_STRUCTURE[partKey];
        const numbers: number[] = [];
        for (let i = range.startNumber; i <= range.endNumber; i++) {
          numbers.push(i);
        }

        return (
          <div key={partKey} className="space-y-1.5">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase">
              {range.nameVi}
            </div>
            <div className="flex flex-wrap gap-1">
              {numbers.map(num => {
                const isCurrent = num === currentQuestion;
                const isAnswered = answeredQuestions.has(num);

                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => onNavigate(num)}
                    className={`
                      w-8 h-8 rounded-lg text-[10px] font-bold transition-all duration-100
                      flex items-center justify-center
                      ${isCurrent
                        ? 'bg-ori-600 text-white shadow-md shadow-ori-300 scale-110'
                        : isAnswered
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }
                    `}
                    title={`Câu ${num}`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
