// ============================================================
// ORI TOEIC Website V2 — Student Learning Bank Page
// ============================================================

import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Sparkles, Search, ArrowRight, Award } from 'lucide-react';
import { supabase } from '../lib/supabase/client';

interface LearningItem {
  id: string;
  kind: string;
  item_key: string;
  title: string;
  definition: string;
  example: string;
  difficulty_level: number;
}

export const ToeicLearningBankV2Page: React.FC = () => {
  const [items, setItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKind, setSelectedKind] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    async function loadLearningBank() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('toeic_learning_items')
          .select('*')
          .order('title', { ascending: true });

        if (error) {
          console.error(error);
        } else if (data) {
          setItems(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadLearningBank();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesKind = selectedKind === 'all' || item.kind === selectedKind;
    const matchesSearch =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.definition && item.definition.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesKind && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-ori-600 to-blue-700 rounded-3xl p-8 text-white shadow-xl shadow-ori-600/15 space-y-3">
        <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-amber-300" /> Ngân Hàng Kiến Thức ORI V2
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">Thư Viện Điểm Kiến Thức TOEIC</h1>
        <p className="text-sm text-blue-100 max-w-2xl">
          Tổng hợp các chủ điểm Ngữ pháp, Từ vựng chuyên sâu, Collocation và Paraphrase được trích xuất từ đề thi TOEIC thật.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-extrabold w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'grammar', label: 'Ngữ pháp' },
            { id: 'vocabulary', label: 'Từ vựng' },
            { id: 'collocation', label: 'Collocation' },
            { id: 'paraphrase', label: 'Paraphrase' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedKind(tab.id)}
              className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                selectedKind === tab.id
                  ? 'bg-white text-ori-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Tìm kiếm chủ điểm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-ori-600"
          />
        </div>
      </div>

      {/* Grid of Items */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Đang tải ngân hàng kiến thức...</div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 text-sm">
          Chưa có kiến thức nào phù hợp với bộ lọc.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-extrabold text-[10px] uppercase rounded-lg border border-blue-100">
                    {item.kind}
                  </span>
                  <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                    <Award className="w-3.5 h-3.5" /> Level {item.difficulty_level || 3}
                  </div>
                </div>
                <h3 className="text-base font-extrabold text-slate-900">{item.title}</h3>
                {item.definition && <p className="text-xs text-slate-600 leading-relaxed">{item.definition}</p>}
                {item.example && (
                  <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                    "{item.example}"
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Luyện tập câu hỏi liên quan</span>
                <NavLink
                  to={`/toeic/learn/${item.kind}/${item.item_key}`}
                  className="px-4 py-2 bg-ori-600 hover:bg-ori-700 text-white rounded-xl font-extrabold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  Luyện tập <ArrowRight className="w-3.5 h-3.5" />
                </NavLink>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
