import React from 'react';
import { ParserIssue } from '../../../lib/toeic/classifier/types';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface Props {
  issues: ParserIssue[];
}

export const ToeicClassifierIssuePanel: React.FC<Props> = ({ issues }) => {
  if (issues.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
      <h3 className="text-sm font-extrabold text-slate-900">Vấn đề phát hiện ({issues.length})</h3>
      
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {issues.map((issue, idx) => {
          const isError = issue.type === 'ERROR';
          const isWarning = issue.type === 'WARNING';
          
          return (
            <div key={idx} className={`p-3 rounded-xl border flex gap-3 ${
              isError ? 'bg-rose-50 border-rose-200 text-rose-800' :
              isWarning ? 'bg-amber-50 border-amber-200 text-amber-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              {isError && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {isWarning && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
              {!isError && !isWarning && <Info className="w-4 h-4 shrink-0 mt-0.5" />}
              
              <div>
                <p className="text-xs font-bold mb-0.5">
                  {isError ? 'Lỗi' : isWarning ? 'Cảnh báo' : 'Cần xác nhận'}
                  {issue.question_number ? ` (Câu ${issue.question_number})` : ''}
                </p>
                <p className="text-[11px] font-medium opacity-90">{issue.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
