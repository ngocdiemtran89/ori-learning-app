import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowLeft,
  Filter,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GrammarLesson, LearningLesson } from '../lib/supabase/types';
import {
  getMistakeNotebookItems,
  getLearningLessons,
  MistakeNotebookItem,
} from '../lib/supabase/learning';
import { getGrammarLessons } from '../lib/supabase/grammar';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';

export const MistakesPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<MistakeNotebookItem[]>([]);
  const [slugMap, setSlugMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [activeTab, setActiveTab] = useState<'unresolved' | 'resolved'>('unresolved');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');

  useEffect(() => {
    async function loadNotebookData() {
      if (!user?.id) return;

      setLoading(true);
      const mistakeItems = await getMistakeNotebookItems(user.id);
      setItems(mistakeItems);

      // Fetch lesson slugs map to resolve [ HỌC LẠI ] links
      const [grammarList, listeningList, readingList] = await Promise.all([
        getGrammarLessons(),
        getLearningLessons('listening'),
        getLearningLessons('reading'),
      ]);

      const map: Record<string, string> = {};
      grammarList.forEach((l: GrammarLesson) => (map[l.id] = l.slug));
      listeningList.forEach((l: LearningLesson) => (map[l.id] = l.slug));
      readingList.forEach((l: LearningLesson) => (map[l.id] = l.slug));
      setSlugMap(map);

      setLoading(false);
    }
    loadNotebookData();
  }, [user]);

  // Derived Summary Stats
  const unresolvedCount = items.filter((i) => !i.is_resolved).length;
  const resolvedCount = items.filter((i) => i.is_resolved).length;
  const totalWrongAttempts = items.reduce((sum, i) => sum + i.wrong_count, 0);

  // Filtered List
  const filteredItems = items.filter((i) => {
    const matchesTab = activeTab === 'resolved' ? i.is_resolved : !i.is_resolved;
    const matchesType = contentTypeFilter === 'all' || i.content_type === contentTypeFilter;
    return matchesTab && matchesType;
  });

  const getSourcePath = (contentType: string, contentId: string) => {
    const slug = slugMap[contentId] || contentId;
    switch (contentType) {
      case 'grammar':
        return `/grammar/${slug}`;
      case 'listening':
        return `/listening/${slug}`;
      case 'reading':
        return `/reading/${slug}`;
      case 'vocabulary':
        return `/vocabulary`;
      default:
        return '/dashboard';
    }
  };

  const formatVietnamDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Tổng quan
        </NavLink>
        <span className="px-3 py-1 bg-rose-50 text-rose-700 text-xs font-extrabold rounded-full flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> Sổ Lỗi Sai ({unresolvedCount} chưa khắc phục)
        </span>
      </div>

      <PageHeader
        title="Sổ Lỗi Sai (Wrong Answer Notebook)"
        subtitle="Hệ thống tự động tổng hợp tất cả các câu làm sai để bạn xem lại và luyện tập đến khi thành thạo."
      />

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Chưa khắc phục</div>
            <div className="text-2xl font-extrabold text-rose-900 mt-0.5">{unresolvedCount} câu</div>
          </div>
          <XCircle className="w-8 h-8 text-rose-500 opacity-80" />
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Đã khắc phục</div>
            <div className="text-2xl font-extrabold text-emerald-900 mt-0.5">{resolvedCount} câu</div>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-80" />
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Tổng lượt làm sai</div>
            <div className="text-2xl font-extrabold text-amber-900 mt-0.5">{totalWrongAttempts} lần</div>
          </div>
          <RotateCcw className="w-8 h-8 text-amber-500 opacity-80" />
        </div>
      </div>

      {/* Status Tabs & Content Filter Controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-extrabold">
            <button
              onClick={() => setActiveTab('unresolved')}
              className={`px-4 py-2 rounded-lg transition-all ${
                activeTab === 'unresolved'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chưa khắc phục ({unresolvedCount})
            </button>
            <button
              onClick={() => setActiveTab('resolved')}
              className={`px-4 py-2 rounded-lg transition-all ${
                activeTab === 'resolved'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đã khắc phục ({resolvedCount})
            </button>
          </div>

          {/* Module Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold text-slate-600">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'grammar', label: 'Grammar' },
              { id: 'listening', label: 'Listening' },
              { id: 'reading', label: 'Reading' },
              { id: 'vocabulary', label: 'Vocabulary' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setContentTypeFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  contentTypeFilter === f.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Notebook Items Grid */}
      {loading ? (
        <LoadingState message="Đang tải dữ liệu Sổ lỗi sai từ Supabase..." />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'unresolved'
              ? 'Tuyệt vời! Bạn không có câu sai nào chưa khắc phục.'
              : 'Chưa có câu nào trong danh sách đã khắc phục.'
          }
          description="Hãy tiếp tục làm bài tập trắc nghiệm ở các Module để hệ thống tự động ghi nhận và phân tích."
          icon={HelpCircle}
        />
      ) : (
        <div className="space-y-4 max-w-3xl mx-auto">
          {filteredItems.map((item) => {
            const latest = item.latest_attempt;
            const sourceUrl = getSourcePath(item.content_type, item.content_id);

            return (
              <div
                key={item.question_key}
                className={`bg-white rounded-3xl p-6 border shadow-sm transition-all space-y-4 ${
                  item.is_resolved
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : 'border-rose-200 hover:border-rose-300'
                }`}
              >
                {/* Card Top Meta Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-extrabold uppercase text-[10px]">
                      {item.content_type}
                    </span>
                    {latest.skill_tag && (
                      <span className="font-extrabold text-slate-700 text-xs">
                        {latest.skill_tag}
                      </span>
                    )}
                    {latest.toeic_part && (
                      <span className="px-2 py-0.5 bg-sky-50 text-ori-700 text-[10px] font-bold rounded uppercase">
                        {latest.toeic_part.replace('part', 'Part ')}
                      </span>
                    )}
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      item.is_resolved
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.is_resolved ? 'Đã khắc phục' : 'Chưa khắc phục'}
                  </span>
                </div>

                {/* Question Text */}
                <div className="font-bold text-slate-900 text-sm leading-relaxed">
                  {latest.question_text}
                </div>

                {/* Answers Comparison Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-0.5">
                    <div className="text-[10px] uppercase font-bold text-rose-600">Bạn chọn:</div>
                    <div className="font-extrabold text-xs flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{latest.selected_answer || 'Chưa chọn đáp án'}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-0.5">
                    <div className="text-[10px] uppercase font-bold text-emerald-600">Đáp án đúng:</div>
                    <div className="font-extrabold text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{latest.correct_answer}</span>
                    </div>
                  </div>
                </div>

                {/* Explanation Box */}
                {latest.explanation && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    <strong className="text-indigo-900">Giải thích chi tiết:</strong> {latest.explanation}
                  </div>
                )}

                {/* Card Footer: History Stats & Action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="text-slate-500 font-semibold space-x-3 text-[11px]">
                    <span>
                      Sai: <strong className="text-rose-600 font-extrabold">{item.wrong_count} lần</strong>
                    </span>
                    <span>•</span>
                    <span>Lần sai gần nhất: {formatVietnamDate(item.latest_wrong_at)}</span>
                  </div>

                  <NavLink
                    to={sourceUrl}
                    className="px-3.5 py-2 bg-ori-600 hover:bg-ori-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all hover:scale-[1.02]"
                  >
                    <span>[ HỌC LẠI ]</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </NavLink>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
