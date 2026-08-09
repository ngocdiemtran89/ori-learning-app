import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import type { StudentToeicGroup } from '../../lib/supabase/types';

interface PassageDisplayProps {
  group: StudentToeicGroup;
  /** Part practice mode — enables translation */
  isPartMode?: boolean;
}

export const PassageDisplay: React.FC<PassageDisplayProps> = ({ group, isPartMode = false }) => {
  const [showTranslation, setShowTranslation] = useState(false);

  // Part 7 structured documents
  if (group.documents && Array.isArray(group.documents) && group.documents.length > 0) {
    const docsVi = (group.documents_vi && Array.isArray(group.documents_vi)) ? group.documents_vi : [];

    return (
      <div className="space-y-4">
        {group.instruction && (
          <div className="text-xs font-bold text-slate-500 italic">
            {group.instruction}
            {showTranslation && group.instruction_vi && (
              <div className="text-slate-400 mt-1 not-italic">{group.instruction_vi}</div>
            )}
          </div>
        )}
        {group.documents.map((doc: any, idx: number) => {
          const docVi = docsVi[idx] as any;
          return (
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

              {/* Document-level translation */}
              {showTranslation && docVi && (
                <div className="mt-2 pt-2 border-t border-amber-200/60">
                  {docVi.title && (
                    <div className="text-xs font-bold text-slate-500 italic">{docVi.title}</div>
                  )}
                  <div className="text-xs text-slate-500 italic leading-relaxed whitespace-pre-wrap mt-1">
                    {docVi.content || <span className="text-slate-400 not-italic">Chưa có bản dịch.</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Translation toggle for documents */}
        {isPartMode && (
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
            {showTranslation ? 'Ẩn bản dịch đoạn văn' : 'Xem bản dịch đoạn văn'}
          </button>
        )}
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
            {showTranslation && group.instruction_vi && (
              <div className="text-slate-400 mt-1 not-italic">{group.instruction_vi}</div>
            )}
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

          {/* Passage translation */}
          {showTranslation && (
            <div className="mt-3 pt-3 border-t border-amber-200/60">
              <div className="text-xs text-slate-500 italic leading-relaxed whitespace-pre-wrap">
                {group.passage_vi || <span className="text-slate-400 not-italic">Chưa có bản dịch cho nội dung này.</span>}
              </div>
            </div>
          )}
        </div>

        {isPartMode && (
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
            {showTranslation ? 'Ẩn bản dịch đoạn văn' : 'Xem bản dịch đoạn văn'}
          </button>
        )}
      </div>
    );
  }

  // Instruction-only group
  if (group.instruction) {
    return (
      <div className="text-xs font-bold text-slate-500 italic">
        {group.instruction}
        {showTranslation && group.instruction_vi && (
          <div className="text-slate-400 mt-1 not-italic">{group.instruction_vi}</div>
        )}
        {isPartMode && (
          <button
            type="button"
            onClick={() => setShowTranslation(!showTranslation)}
            className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Globe className="w-3 h-3" />
            {showTranslation ? 'Ẩn' : 'Dịch'}
          </button>
        )}
      </div>
    );
  }

  return null;
};
