import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import type { StudentToeicGroup } from '../../lib/supabase/types';
import { buildPart6BilingualSegments } from '../../lib/toeic/part6BilingualAligner';

interface PassageDisplayProps {
  group: StudentToeicGroup;
  /** Part practice mode — enables translation */
  isPartMode?: boolean;
}

/**
 * Helper to render segment text with high-contrast blank badges (────── [ 131 ])
 */
function renderSegmentTextWithMarkers(text: string): React.ReactNode {
  if (!text) return null;

  // Regex to match blank markers like ------- 131, ------- [CÂU 131], ------- 131., [CÂU 131], etc.
  const markerRegex = /(?:-------?|--------?|\[\s*(?:CÂU|CAU)?\s*)?(\d{3})\b(?:\s*\])?(?:\.|\b)/gi;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = markerRegex.exec(text)) !== null) {
    const qNum = parseInt(match[1], 10);
    if (qNum >= 131 && qNum <= 146) {
      // Push text before match
      if (match.index > lastIdx) {
        parts.push(text.substring(lastIdx, match.index));
      }

      // Push styled badge
      parts.push(
        <span
          key={`badge-${match.index}-${qNum}`}
          className="inline-flex items-center gap-1 mx-1.5 px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-xs shadow-sm ring-2 ring-rose-200"
        >
          ────── [&nbsp;{qNum}&nbsp;]
        </span>
      );

      lastIdx = markerRegex.lastIndex;
    }
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}

export const PassageDisplay: React.FC<PassageDisplayProps> = ({ group, isPartMode = false }) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [part6ViewMode, setPart6ViewMode] = useState<'bilingual' | 'english_only'>('bilingual');

  // Listening groups (Part 3 / Part 4) MUST NOT render conversation/talk spoken transcripts
  if (group.part === 'part3' || group.part === 'part4') {
    if (!group.instruction) return null;
    return (
      <div className="text-xs font-bold text-slate-500 italic bg-slate-100/80 rounded-xl p-3">
        {group.instruction}
      </div>
    );
  }

  // Part 7 structured documents
  if (group.documents && Array.isArray(group.documents) && group.documents.length > 0) {
    const docsVi = (group.documents_vi && Array.isArray(group.documents_vi)) ? group.documents_vi : [];
    const bilingualUnits = Array.isArray((group as any).part7_bilingual_units) ? (group as any).part7_bilingual_units : [];

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
          const docUnits = bilingualUnits.filter((u: any) => u && u.document_index === idx);

          return (
            <div
              key={idx}
              className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4.5 space-y-3 shadow-xs"
            >
              {group.documents!.length > 1 && (
                <div className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider bg-amber-100/80 px-2 py-0.5 rounded w-fit">
                  Document {idx + 1}{doc.type ? ` — ${doc.type}` : ''}
                </div>
              )}

              {/* Render persisted bilingual units if available & in bilingual mode */}
              {isPartMode && showTranslation && docUnits.length > 0 ? (
                <div className="space-y-3">
                  {docUnits.map((unit: any, uIdx: number) => (
                    <div key={uIdx} className="space-y-1 border-b border-amber-200/50 pb-2 last:border-b-0 last:pb-0">
                      {unit.en && (
                        <div className="text-sm font-semibold text-slate-900 leading-relaxed flex items-start gap-2">
                          <span className="bg-slate-800 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider shrink-0 mt-0.5">
                            🇬🇧 EN
                          </span>
                          <span>{unit.en}</span>
                        </div>
                      )}
                      {unit.vi && (
                        <div className="text-sm font-medium text-emerald-950 bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2.5 leading-relaxed flex items-start gap-2">
                          <span className="bg-emerald-800 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider shrink-0 mt-0.5">
                            🇻🇳 VI
                          </span>
                          <span>{unit.vi}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {doc.title && (
                    <div className="text-sm font-extrabold text-slate-900">
                      {doc.title}
                    </div>
                  )}
                  <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {doc.content}
                  </div>

                  {/* Fallback Document-level translation */}
                  {isPartMode && showTranslation && docVi && (
                    <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-1.5">
                      {docVi.title && (
                        <div className="text-xs font-bold text-emerald-900">{docVi.title}</div>
                      )}
                      <div className="text-xs font-medium text-emerald-950 bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
                        {docVi.content || <span className="text-slate-400">Chưa có bản dịch.</span>}
                      </div>
                    </div>
                  )}
                </>
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
              inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-xs
              ${showTranslation
                ? 'bg-amber-200 text-amber-900 hover:bg-amber-300'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }
            `}
          >
            <Globe className="w-3.5 h-3.5" />
            {showTranslation ? 'Ẩn bản dịch đoạn văn' : 'Xem bản dịch đoạn văn (Song ngữ)'}
          </button>
        )}
      </div>
    );
  }

  // Dedicated High-Contrast Interleaved Renderer for Part 6
  if (group.part === 'part6' || (typeof group.part === 'string' && group.part.toLowerCase() === 'part6')) {
    const segments = buildPart6BilingualSegments(group.passage || '', group.passage_vi || '');

    return (
      <div className="space-y-4">
        {group.instruction && (
          <div className="text-xs font-bold text-slate-500 italic">
            {group.instruction}
          </div>
        )}

        <div className="bg-slate-900/5 border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-sm">
          {/* Header & Mode Switch */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-800"></span>
              {(group as any).start_question && (group as any).end_question
                ? `CÂU ${(group as any).start_question}–${(group as any).end_question}`
                : (group.title || 'TOEIC PART 6 PASSAGE')}
            </div>

            {/* Mode switch for learning/bilingual mode */}
            {isPartMode && group.passage_vi && (
              <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPart6ViewMode('bilingual')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    part6ViewMode === 'bilingual'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🌐 SONG NGỮ
                </button>
                <button
                  type="button"
                  onClick={() => setPart6ViewMode('english_only')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    part6ViewMode === 'english_only'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🇬🇧 ENGLISH ONLY
                </button>
              </div>
            )}
          </div>

          {/* Interleaved Segment Blocks */}
          <div className="space-y-4">
            {segments.map((seg, idx) => {
              const showViForSeg = isPartMode && part6ViewMode === 'bilingual' && Boolean(seg.vi);

              if (seg.isTitle) {
                return (
                  <div key={seg.id || idx} className="border-b border-slate-200/80 pb-3 space-y-1.5">
                    <div className="text-base font-black text-slate-900 leading-snug">
                      {seg.en}
                    </div>
                    {showViForSeg && (
                      <div className="text-sm font-bold text-emerald-950 bg-emerald-50/90 rounded-lg px-3 py-1.5 border border-emerald-200/60 leading-snug">
                        {seg.vi}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={seg.id || idx} className="border-b border-slate-200/60 pb-3.5 space-y-2 last:border-b-0 last:pb-0">
                  {/* English Row */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-slate-800 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
                        🇬🇧 EN
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 leading-relaxed pl-0.5">
                      {renderSegmentTextWithMarkers(seg.en)}
                    </div>
                  </div>

                  {/* Vietnamese Row */}
                  {showViForSeg && (
                    <div className="space-y-1 bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-emerald-800 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
                          🇻🇳 VI
                        </span>
                      </div>
                      <div className="text-sm font-medium text-emerald-950 leading-relaxed">
                        {renderSegmentTextWithMarkers(seg.vi)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Single reading passage fallback
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
