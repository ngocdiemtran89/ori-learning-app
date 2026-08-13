// ============================================================
// ORI TOEIC Website V2 — Student Weakness Panel
// ============================================================

import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Target, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';

interface WeaknessItem {
  item_key: string;
  total_attempts: number;
  correct_attempts: number;
  accuracy: number;
  item_title?: string;
  kind?: string;
}

export const ToeicWeaknessV2Panel: React.FC = () => {
  const [weaknesses, setWeaknesses] = useState<WeaknessItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPracticeStats() {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        const { data, error } = await supabase
          .from('toeic_learning_practice_events')
          .select('item_key, is_correct, toeic_learning_items(title, kind)')
          .eq('user_id', user.user.id);

        if (error) {
          console.error(error);
          return;
        }

        if (data) {
          const statsMap = new Map<string, { total: number; correct: number; title?: string; kind?: string }>();

          data.forEach((row: any) => {
            const key = row.item_key;
            const current = statsMap.get(key) || {
              total: 0,
              correct: 0,
              title: row.toeic_learning_items?.title || key,
              kind: row.toeic_learning_items?.kind || 'vocabulary',
            };

            current.total += 1;
            if (row.is_correct) current.correct += 1;
            statsMap.set(key, current);
          });

          const list: WeaknessItem[] = Array.from(statsMap.entries()).map(([key, s]) => ({
            item_key: key,
            total_attempts: s.total,
            correct_attempts: s.correct,
            accuracy: Math.round((s.correct / s.total) * 100),
            item_title: s.title,
            kind: s.kind,
          }));

          // Sort by lowest accuracy first
          list.sort((a, b) => a.accuracy - b.accuracy);
          setWeaknesses(list.slice(0, 5));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadPracticeStats();
  }, []);

  if (loading || weaknesses.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">Điểm Cần Cải Thiện V2</h3>
            <p className="text-xs text-slate-500">Phân tích từ lịch sử luyện tập của bạn</p>
          </div>
        </div>
        <NavLink
          to="/toeic/learn"
          className="text-xs font-bold text-ori-600 hover:text-ori-700 flex items-center gap-1"
        >
          Ngân hàng kiến thức <ArrowRight className="w-3.5 h-3.5" />
        </NavLink>
      </div>

      <div className="space-y-2">
        {weaknesses.map((item) => (
          <div
            key={item.item_key}
            className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100"
          >
            <div className="flex items-center gap-2.5">
              {item.accuracy < 60 ? (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
              <div>
                <span className="font-bold text-slate-800 text-xs block">{item.item_title}</span>
                <span className="text-[10px] text-slate-400 uppercase font-medium">{item.kind}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs font-extrabold text-slate-900 block">{item.accuracy}%</span>
                <span className="text-[10px] text-slate-400 block">{item.correct_attempts}/{item.total_attempts} đúng</span>
              </div>
              <NavLink
                to={`/toeic/learn/${item.kind || 'vocabulary'}/${item.item_key}`}
                className="px-3 py-1.5 bg-ori-600 hover:bg-ori-700 text-white rounded-xl font-bold text-[11px] transition-colors"
              >
                Luyện tiếp
              </NavLink>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
