import React from 'react';
import type { StudentToeicGroup } from '../../lib/supabase/types';

interface PassageDisplayProps {
  group: StudentToeicGroup;
}

export const PassageDisplay: React.FC<PassageDisplayProps> = ({ group }) => {
  // Part 7 structured documents
  if (group.documents && Array.isArray(group.documents) && group.documents.length > 0) {
    return (
      <div className="space-y-4">
        {group.instruction && (
          <div className="text-xs font-bold text-slate-500 italic">
            {group.instruction}
          </div>
        )}
        {group.documents.map((doc: any, idx: number) => (
          <div
            key={idx}
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2"
          >
            {group.documents!.length > 1 && (
              <div className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">
                Document {idx + 1}{doc.type ? ` — ${doc.type}` : ''}
              </div>
            )}
            {doc.title && (
              <div className="text-sm font-extrabold text-slate-900">
                {doc.title}
              </div>
            )}
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {doc.content}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Part 6 / single passage
  if (group.passage) {
    return (
      <div className="space-y-3">
        {group.instruction && (
          <div className="text-xs font-bold text-slate-500 italic">
            {group.instruction}
          </div>
        )}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          {group.title && (
            <div className="text-sm font-extrabold text-slate-900 mb-2">
              {group.title}
            </div>
          )}
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {group.passage}
          </div>
        </div>
      </div>
    );
  }

  // Instruction-only group
  if (group.instruction) {
    return (
      <div className="text-xs font-bold text-slate-500 italic">
        {group.instruction}
      </div>
    );
  }

  return null;
};
