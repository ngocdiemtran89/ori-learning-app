import React, { useState } from 'react';
import { ParsedToeicTestDraft, ParsedQuestion } from '../../../lib/toeic/classifier/types';
import { expectedPartForQuestionNumber } from '../../../lib/toeic/testStructure';
import { AlertCircle } from 'lucide-react';

interface Props {
  draft: ParsedToeicTestDraft;
  onUpdateDraft: (newDraft: ParsedToeicTestDraft) => void;
}

export const ToeicClassifierPartReview: React.FC<Props> = ({ draft, onUpdateDraft }) => {
  const [activePart, setActivePart] = useState<string>('part1');

  const parts = ['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7'];

  const handleQuestionChange = (qIndex: number, field: keyof ParsedQuestion, value: any) => {
    const newQuestions = [...draft.questions];
    newQuestions[qIndex] = { ...newQuestions[qIndex], [field]: value };
    
    // Auto-recalculate part if question_number changes
    if (field === 'question_number') {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        const expected = expectedPartForQuestionNumber(num);
        if (expected) {
           newQuestions[qIndex].part = expected;
        }
      }
    }
    
    onUpdateDraft({ ...draft, questions: newQuestions });
  };

  const currentQuestions = draft.questions.filter(q => q.part === activePart).sort((a, b) => a.question_number - b.question_number);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2 overflow-x-auto">
        {parts.map(part => (
          <button
            key={part}
            onClick={() => setActivePart(part)}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
              activePart === part
                ? 'border-ori-600 text-ori-600 bg-ori-50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {part.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {currentQuestions.length === 0 ? (
          <p className="text-xs text-slate-500 font-medium italic">Không có câu hỏi nào thuộc phần này.</p>
        ) : (
          currentQuestions.map(q => {
            const globalIndex = draft.questions.findIndex(orig => orig === q);
            return (
              <div key={globalIndex} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex gap-4 items-start">
                  <div className="w-20 shrink-0">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Số câu</label>
                    <input 
                      type="number" 
                      value={q.question_number || ''} 
                      onChange={(e) => handleQuestionChange(globalIndex, 'question_number', e.target.value)}
                      className="w-full p-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:border-ori-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500">Nội dung câu hỏi</label>
                    <textarea 
                      value={q.question_text || ''} 
                      onChange={(e) => handleQuestionChange(globalIndex, 'question_text', e.target.value)}
                      className="w-full p-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:border-ori-500 focus:outline-none"
                      rows={2}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-24">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 w-4">{String.fromCharCode(65 + oIdx)}.</span>
                      <input 
                        type="text" 
                        value={opt} 
                        onChange={(e) => {
                          const newOpts = [...q.options];
                          newOpts[oIdx] = e.target.value;
                          handleQuestionChange(globalIndex, 'options', newOpts);
                        }}
                        className="flex-1 p-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:border-ori-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 pl-24 pt-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-500">Đáp án đúng:</label>
                    <select 
                      value={q.correct_answer || ''}
                      onChange={(e) => handleQuestionChange(globalIndex, 'correct_answer', e.target.value)}
                      className={`p-2 text-xs font-bold rounded-xl border focus:outline-none focus:border-ori-500 ${!q.correct_answer ? 'border-rose-300 bg-rose-50 text-rose-700' : 'bg-white border-slate-200 text-slate-900'}`}
                    >
                      <option value="">-- Chọn đáp án --</option>
                      {q.options.map((opt, oIdx) => {
                        const letter = String.fromCharCode(65 + oIdx);
                        return <option key={oIdx} value={opt}>({letter})</option>;
                      })}
                    </select>
                  </div>
                  {!q.correct_answer && (
                    <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Bắt buộc
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
