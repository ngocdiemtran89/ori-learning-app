// ============================================================
// ORI TOEIC Website V2 — Learning Review Panel
// ============================================================

import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';

interface Props {
  testId: string;
}

interface LearningLinkItem {
  id: string;
  question_number: number;
  item_key: string;
  ai_suggested: boolean;
  is_approved: boolean;
  item?: {
    kind: string;
    title: string;
    definition: string;
    example: string;
    difficulty_level: number;
  };
}

export const ToeicLearningReviewPanel: React.FC<Props> = ({ testId }) => {
  const [links, setLinks] = useState<LearningLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKind, setActiveKind] = useState<string>('all');

  const fetchLearningLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('toeic_question_learning_items')
        .select(`
          id,
          question_number,
          item_key,
          ai_suggested,
          is_approved,
          toeic_learning_items!inner(kind, title, definition, example, difficulty_level)
        `)
        .eq('test_id', testId)
        .order('question_number', { ascending: true });

      if (error) {
        console.error('Error fetching learning links:', error);
      } else if (data) {
        const formatted = data.map((d: any) => ({
          id: d.id,
          question_number: d.question_number,
          item_key: d.item_key,
          ai_suggested: d.ai_suggested,
          is_approved: d.is_approved,
          item: d.toeic_learning_items,
        }));
        setLinks(formatted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (testId) fetchLearningLinks();
  }, [testId]);

  const handleToggleApprove = async (linkId: string, currentApproved: boolean) => {
    try {
      const { error } = await supabase
        .from('toeic_question_learning_items')
        .update({ is_approved: !currentApproved, updated_at: new Date().toISOString() })
        .eq('id', linkId);

      if (!error) {
        setLinks((prev) =>
          prev.map((l) => (l.id === linkId ? { ...l, is_approved: !currentApproved } : l))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredLinks = links.filter((l) => {
    if (activeKind === 'all') return true;
    return l.item?.kind === activeKind;
  });

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        Đang tải điểm kiến thức V2...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Duyệt điểm kiến thức V2 (Learning Units)
          </h3>
          <p className="text-xs text-slate-500">
            Các điểm ngữ pháp, từ vựng, collocation & paraphrase tự động trích xuất từ đề thi
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {['all', 'grammar', 'vocabulary', 'collocation', 'paraphrase'].map((kind) => (
            <button
              key={kind}
              onClick={() => setActiveKind(kind)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                activeKind === kind
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {kind === 'all' ? 'Tất cả' : kind}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      {filteredLinks.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
          Chưa có điểm kiến thức V2 nào thuộc danh mục này.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLinks.map((link) => (
            <div
              key={link.id}
              className={`p-4 rounded-xl border transition-all ${
                link.is_approved
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-md">
                    Câu {link.question_number}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-medium text-[10px] uppercase rounded-md">
                    {link.item?.kind}
                  </span>
                  {link.ai_suggested && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      <Sparkles className="w-3 h-3" /> AI
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleToggleApprove(link.id, link.is_approved)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                    link.is_approved
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {link.is_approved ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" /> Đã duyệt
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" /> Chờ duyệt
                    </>
                  )}
                </button>
              </div>

              <h4 className="font-bold text-slate-800 text-sm">{link.item?.title}</h4>
              {link.item?.definition && (
                <p className="text-xs text-slate-600 mt-1">{link.item.definition}</p>
              )}
              {link.item?.example && (
                <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  "{link.item.example}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
