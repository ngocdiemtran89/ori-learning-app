import React, { useEffect, useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Edit2,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import {
  getAdminVocabularyDeck,
  getAdminVocabularyItems,
  setVocabularyItemPublished,
  PaginatedVocabularyItems,
} from '../lib/supabase/adminVocabulary';
import { VocabularyDeck, VocabularyItem } from '../lib/supabase/types';
import { VocabularyPreviewModal } from '../components/admin/VocabularyPreviewModal';

export const AdminVocabularyItemsPage: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();

  const [deck, setDeck] = useState<VocabularyDeck | null>(null);
  const [itemsData, setItemsData] = useState<PaginatedVocabularyItems | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters & Pagination state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [page, setPage] = useState<number>(1);

  // Preview Modal state
  const [previewItem, setPreviewItem] = useState<VocabularyItem | null>(null);

  const loadData = async (targetPage: number = 1) => {
    if (!deckId) return;
    setLoading(true);
    setErrorMsg(null);

    const [deckRes, itemsRes] = await Promise.all([
      getAdminVocabularyDeck(deckId),
      getAdminVocabularyItems(deckId, {
        searchQuery,
        statusFilter,
        page: targetPage,
        pageSize: 50,
      }),
    ]);

    if (deckRes.error || !deckRes.data) {
      setErrorMsg(deckRes.error || 'Không tìm thấy bộ từ vựng.');
    } else {
      setDeck(deckRes.data);
    }

    if (itemsRes.error || !itemsRes.data) {
      setItemsData(null);
    } else {
      setItemsData(itemsRes.data);
      setPage(itemsRes.data.page);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData(1);
  }, [deckId, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(1);
  };

  const handleTogglePublish = async (item: VocabularyItem) => {
    const nextStatus = !item.is_published;
    const res = await setVocabularyItemPublished(item.id, nextStatus);

    if (res.error) {
      setToastMsg(`Lỗi: ${res.error}`);
    } else {
      setToastMsg(`Đã ${nextStatus ? 'xuất bản' : 'ẩn'} từ "${item.word}".`);
      loadData(page);
    }
    setTimeout(() => setToastMsg(null), 3500);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/admin/content/vocabulary"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Danh sách Bộ Từ
        </NavLink>

        {deckId && (
          <div className="flex items-center gap-2">
            <NavLink
              to={`/admin/content/vocabulary/decks/${deckId}/edit`}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" /> Chỉnh Sửa Bộ Từ
            </NavLink>

            <NavLink
              to={`/admin/content/vocabulary/decks/${deckId}/words/new`}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 inline-flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Thêm Từ Mới
            </NavLink>
          </div>
        )}
      </div>

      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      {deck && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">{deck.title}</h1>
              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase rounded-lg border border-slate-200">
                {deck.level}
              </span>
              {deck.is_published ? (
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase rounded-full border border-emerald-200">
                  ĐÃ XUẤT BẢN
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-extrabold uppercase rounded-full border border-amber-200">
                  BẢN NHÁP
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {deck.description || 'Chưa có mô tả bộ từ.'}
            </p>
          </div>

          <div className="shrink-0 text-right font-mono text-xs text-slate-500">
            Tổng số từ: <strong className="text-indigo-600 text-sm font-extrabold">{itemsData?.totalCount || 0}</strong>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-80 relative">
          <input
            type="text"
            placeholder="Tìm theo từ vựng hoặc nghĩa Tiếng Việt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-extrabold w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter('published')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'published' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Đã xuất bản
            </button>
            <button
              onClick={() => setStatusFilter('draft')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'draft' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Bản nháp
            </button>
          </div>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <LoadingState message="Đang tải danh sách từ vựng..." />
      ) : errorMsg ? (
        <EmptyState title="Lỗi tải dữ liệu" description={errorMsg} icon={AlertCircle} />
      ) : !itemsData || itemsData.items.length === 0 ? (
        <EmptyState
          title="Không tìm thấy từ vựng nào"
          description="Thêm từ vựng mới hoặc thay đổi từ khóa tìm kiếm."
          icon={BookOpen}
        />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Từ vựng (Word)</th>
                  <th className="py-3.5 px-4">Phiên âm / Loại</th>
                  <th className="py-3.5 px-4">Nghĩa Tiếng Việt</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4 text-center">Thứ tự</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {itemsData.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-slate-900 text-sm">{item.word}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      <div>{item.ipa || '-'}</div>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase">{item.part_of_speech || 'noun'}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {item.meaning_vi}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.is_published ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase rounded-full border border-emerald-200">
                          ĐÃ XUẤT BẢN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-extrabold uppercase rounded-full border border-amber-200">
                          BẢN NHÁP
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold">
                      {item.sort_order}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[11px] rounded-lg transition-colors"
                      >
                        Preview
                      </button>

                      <NavLink
                        to={`/admin/content/vocabulary/words/${item.id}/edit`}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors inline-block"
                      >
                        Sửa
                      </NavLink>

                      <button
                        type="button"
                        onClick={() => handleTogglePublish(item)}
                        className={`px-2.5 py-1.5 font-extrabold text-[11px] rounded-lg transition-colors ${
                          item.is_published
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {item.is_published ? 'Ẩn' : 'Xuất bản'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {itemsData.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>
                Trang {itemsData.page} / {itemsData.totalPages} (Tổng {itemsData.totalCount} từ)
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={itemsData.page <= 1}
                  onClick={() => loadData(itemsData.page - 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Trước
                </button>

                <button
                  disabled={itemsData.page >= itemsData.totalPages}
                  onClick={() => loadData(itemsData.page + 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg flex items-center gap-1 transition-colors"
                >
                  Sau <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <VocabularyPreviewModal
          item={previewItem}
          deckTitle={deck?.title}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
};
