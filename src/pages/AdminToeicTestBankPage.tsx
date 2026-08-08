import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  BookOpen,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
import { LoadingState } from '../components/ui/LoadingState';
import {
  getAdminToeicTests,
  setToeicTestPublished,
  getToeicTestGroups,
  getToeicTestQuestions,
  deleteDraftToeicTest,
  ToeicTestRow,
} from '../lib/supabase/adminTestBank';
import { ToeicTestPreviewModal } from '../components/admin/ToeicTestPreviewModal';

export const AdminToeicTestBankPage: React.FC = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState<ToeicTestRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [testTypeFilter, setTestTypeFilter] = useState<'all' | 'full' | 'mini' | 'custom'>('all');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Preview Modal
  const [previewTest, setPreviewTest] = useState<ToeicTestRow | null>(null);
  const [previewGroups, setPreviewGroups] = useState<any[]>([]);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);

  useEffect(() => {
    loadTests();
  }, [searchQuery, statusFilter, testTypeFilter, page]);

  async function loadTests() {
    setLoading(true);
    setError(null);
    const res = await getAdminToeicTests({
      searchQuery,
      statusFilter,
      testTypeFilter,
      page,
      pageSize: 50,
    });

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setTests(res.data.tests);
      setTotalCount(res.data.totalCount);
      setTotalPages(res.data.totalPages);
    }
    setLoading(false);
  }

  const handleDeleteDraft = async (testId: string, testTitle: string) => {
    if (window.confirm(`Bạn có chắc muốn xóa vĩnh viễn đề nháp này?\n\nĐề thi: ${testTitle}`)) {
      setDeleteLoading(testId);
      const res = await deleteDraftToeicTest(testId);
      setDeleteLoading(null);
      if (res.error) {
        alert(res.error);
      } else {
        alert('Đã xóa thành công.');
        loadTests();
      }
    }
  };

  const handleTogglePublish = async (test: ToeicTestRow) => {
    const nextPublished = !test.is_published;
    const res = await setToeicTestPublished(test.id, nextPublished);
    if (res.error) {
      alert(res.error);
    } else {
      loadTests();
    }
  };

  const handleOpenPreview = async (test: ToeicTestRow) => {
    setPreviewTest(test);
    const [gRes, qRes] = await Promise.all([
      getToeicTestGroups(test.id),
      getToeicTestQuestions(test.id),
    ]);
    setPreviewGroups(gRes.data || []);
    setPreviewQuestions(qRes.data || []);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/admin/content"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại CMS Hub
        </NavLink>
        <div className="flex items-center gap-3">
          <NavLink
            to="/admin/content/test-bank/classify"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-extrabold text-xs rounded-2xl shadow-md flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> Nhập & Phân Loại Đề
          </NavLink>
          <NavLink
            to="/admin/content/test-bank/new"
            className="px-4 py-2.5 bg-ori-600 hover:bg-ori-500 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-ori-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> Tạo Đề Thi Mới
          </NavLink>
        </div>
      </div>

      {/* Page Title */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-2">
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-ori-600" /> Ngân Hàng Đề TOEIC (TOEIC Test Bank Foundation)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Quản lý cấu trúc đề thi TOEIC chuẩn 200 câu (Part 1–7), nhóm audio, passage và câu hỏi relational.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Tìm theo tên đề, slug, mã đề..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-ori-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 shrink-0">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-ori-600"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="published">Đã xuất bản (Published)</option>
              <option value="draft">Bản nháp (Draft)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 shrink-0">Loại đề:</span>
            <select
              value={testTypeFilter}
              onChange={(e) => {
                setTestTypeFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-ori-600"
            >
              <option value="all">Tất cả loại đề</option>
              <option value="full">Full Test (200 câu)</option>
              <option value="mini">Mini Test</option>
              <option value="custom">Custom Test</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tests Table */}
      {loading ? (
        <LoadingState message="Đang tải danh sách đề thi TOEIC..." />
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-3xl">
          {error}
        </div>
      ) : tests.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-500 font-bold">Chưa có đề thi TOEIC nào trong Ngân Hàng Đề.</p>
          <NavLink
            to="/admin/content/test-bank/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-ori-600 text-white font-extrabold text-xs rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4" /> Tạo Đề Thi Đầu Tiên
          </NavLink>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold uppercase">
                <tr>
                  <th className="py-3 px-4">Tên Đề Thi / Slug</th>
                  <th className="py-3 px-4 text-center">Mã Đề</th>
                  <th className="py-3 px-4 text-center">Loại Đề</th>
                  <th className="py-3 px-4 text-center">Số Câu Hỏi</th>
                  <th className="py-3 px-4 text-center">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {tests.map((test) => {
                  const isFull = test.test_type === 'full';
                  const qCount = test.questions_count || 0;
                  const isCompleteFull = isFull && qCount === 200;

                  return (
                    <tr key={test.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-900 block text-sm">{test.title}</span>
                        <span className="font-mono text-[10px] text-slate-400 block">{test.slug}</span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        {test.test_code || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase rounded-full border border-slate-200">
                          {test.test_type || 'full'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-mono font-extrabold px-2 py-0.5 rounded-full text-[11px] ${
                            isCompleteFull
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isFull
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {qCount} {isFull ? '/ 200 câu' : 'câu'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {test.is_published ? (
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase rounded-full">
                            ĐÃ XUẤT BẢN
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase rounded-full">
                            BẢN NHÁP
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/content/test-bank/${test.id}`)}
                            className="flex-1 py-2 text-center bg-slate-100 hover:bg-ori-50 text-slate-700 hover:text-ori-600 font-extrabold rounded-xl transition-colors text-sm"
                          >
                            {test.is_published ? 'Xem Chi Tiết' : 'Tiếp Tục Biên Tập'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenPreview(test)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                            title="Xem trước"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {!test.is_published && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDraft(test.id, test.title)}
                              disabled={deleteLoading === test.id}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors disabled:opacity-50"
                              title="Xóa bản nháp"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleTogglePublish(test)}
                            className={`px-2.5 py-1 text-[11px] font-extrabold rounded-xl border transition-all ${
                              test.is_published
                                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {test.is_published ? 'Hủy XB' : 'Xuất bản'}
                          </button>

                          <NavLink
                            to={`/admin/content/test-bank/${test.id}/edit`}
                            className="px-3 py-1 bg-ori-600 hover:bg-ori-500 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all"
                          >
                            <Edit className="w-3.5 h-3.5" /> Chỉnh sửa
                          </NavLink>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs font-bold text-slate-500">
              <span>Tổng: {totalCount} đề thi</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl"
                >
                  Trang trước
                </button>
                <span>
                  Trang {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl"
                >
                  Trang sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewTest && (
        <ToeicTestPreviewModal
          testTitle={previewTest.title}
          testCode={previewTest.test_code}
          groups={previewGroups}
          questions={previewQuestions}
          onClose={() => setPreviewTest(null)}
        />
      )}
    </div>
  );
};
