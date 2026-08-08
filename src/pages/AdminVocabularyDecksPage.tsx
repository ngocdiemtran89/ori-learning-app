import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowLeft, BookOpen, Plus, Edit2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import {
  getAdminVocabularyDecks,
  setVocabularyDeckPublished,
  AdminDeckInfo,
} from '../lib/supabase/adminVocabulary';

export const AdminVocabularyDecksPage: React.FC = () => {
  const [decks, setDecks] = useState<AdminDeckInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchDecks = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await getAdminVocabularyDecks();
    if (res.error) {
      setErrorMsg(res.error);
      setDecks([]);
    } else {
      setDecks(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  const [updatingDeckId, setUpdatingDeckId] = useState<string | null>(null);

  const handleTogglePublish = async (deck: AdminDeckInfo) => {
    setUpdatingDeckId(deck.id);
    const nextStatus = !deck.is_published;
    const res = await setVocabularyDeckPublished(deck.id, nextStatus);

    if (res.error) {
      setToastMsg(`Lỗi: ${res.error}`);
    } else {
      setToastMsg(`Đã ${nextStatus ? 'xuất bản' : 'ẩn'} bộ từ vựng "${deck.title}".`);
      await fetchDecks();
    }
    setUpdatingDeckId(null);
    setTimeout(() => setToastMsg(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/admin/content"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại CMS Hub
        </NavLink>

        <NavLink
          to="/admin/content/vocabulary/decks/new"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 inline-flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" /> Tạo Bộ Từ Mới
        </NavLink>
      </div>

      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-2">
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600" /> Quản Lý Bộ Từ Vựng (Vocabulary Decks)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Danh sách các bộ từ vựng trong hệ thống. Quản lý trạng thái xuất bản (Draft/Published) và chỉnh sửa metadata.
        </p>
      </div>

      {loading ? (
        <LoadingState message="Đang tải danh sách bộ từ vựng..." />
      ) : errorMsg ? (
        <EmptyState title="Không thể tải bộ từ vựng" description={errorMsg} icon={AlertCircle} />
      ) : decks.length === 0 ? (
        <EmptyState
          title="Chưa có bộ từ vựng nào"
          description="Bấm nút 'Tạo Bộ Từ Mới' phía trên để khởi tạo bộ từ đầu tiên."
          icon={BookOpen}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className={`bg-white rounded-3xl p-6 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                deck.is_published ? 'border-slate-200 shadow-sm' : 'border-amber-200 bg-amber-50/20'
              }`}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-base text-slate-900">{deck.title}</span>

                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase rounded-lg border border-slate-200">
                    {deck.level}
                  </span>

                  {deck.is_published ? (
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase rounded-full border border-emerald-200">
                      ĐÃ XUẤT BẢN
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-extrabold uppercase rounded-full border border-amber-200">
                      BẢN NHÁP (DRAFT)
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 font-medium">
                  {deck.description || 'Chưa có mô tả'}
                </p>

                <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 font-mono">
                  <span>Slug: <strong className="text-slate-700 font-normal">{deck.slug}</strong></span>
                  <span>|</span>
                  <span>Thứ tự: <strong className="text-slate-700 font-normal">{deck.sort_order}</strong></span>
                  <span>|</span>
                  <span className="text-indigo-600 font-bold">
                    {deck.total_words_count} từ ({deck.published_words_count} xuất bản)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <NavLink
                  to={`/admin/content/vocabulary/decks/${deck.id}`}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Eye className="w-4 h-4" /> Xem Từ ({deck.total_words_count})
                </NavLink>

                <NavLink
                  to={`/admin/content/vocabulary/decks/${deck.id}/edit`}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Sửa
                </NavLink>

                <button
                  type="button"
                  disabled={updatingDeckId === deck.id}
                  onClick={() => handleTogglePublish(deck)}
                  className={`px-3.5 py-2 text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                    deck.is_published
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {updatingDeckId === deck.id ? (
                    'Đang xử lý...'
                  ) : deck.is_published ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" /> Ẩn Bài
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Xuất Bản
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
