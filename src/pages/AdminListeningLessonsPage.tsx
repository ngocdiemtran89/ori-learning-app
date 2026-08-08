import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  Volume2,
  Plus,
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
  getAdminListeningLessons,
  getAdminListeningQuestions,
  setListeningLessonPublished,
  AdminListeningLessonInfo,
  PaginatedListeningLessons,
} from '../lib/supabase/adminListening';
import { ListeningPreviewModal } from '../components/admin/ListeningPreviewModal';
import { LessonQuestion } from '../lib/supabase/learning';

export const AdminListeningLessonsPage: React.FC = () => {
  const [lessonsData, setLessonsData] = useState<PaginatedListeningLessons | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [updatingLessonId, setUpdatingLessonId] = useState<string | null>(null);

  // Filters & Pagination state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [toeicPartFilter, setToeicPartFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [page, setPage] = useState<number>(1);

  // Preview modal state
  const [previewLesson, setPreviewLesson] = useState<AdminListeningLessonInfo | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<LessonQuestion[]>([]);

  const loadData = async (targetPage: number = 1) => {
    setLoading(true);
    setErrorMsg(null);

    const res = await getAdminListeningLessons({
      searchQuery,
      levelFilter,
      toeicPartFilter,
      statusFilter,
      page: targetPage,
      pageSize: 50,
    });

    if (res.error || !res.data) {
      setErrorMsg(res.error || 'Không thể tải danh sách Listening.');
      setLessonsData(null);
    } else {
      setLessonsData(res.data);
      setPage(res.data.page);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData(1);
  }, [levelFilter, toeicPartFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(1);
  };

  const handleOpenPreview = async (lesson: AdminListeningLessonInfo) => {
    const qRes = await getAdminListeningQuestions(lesson.id);
    setPreviewQuestions(qRes.data || []);
    setPreviewLesson(lesson);
  };

  const handleTogglePublish = async (lesson: AdminListeningLessonInfo) => {
    setUpdatingLessonId(lesson.id);
    const nextStatus = !lesson.is_published;
    const res = await setListeningLessonPublished(lesson.id, nextStatus);

    if (res.error) {
      setToastMsg(`Lỗi: ${res.error}`);
    } else {
      let msg = `Đã ${nextStatus ? 'xuất bản' : 'ẩn'} bài Listening "${lesson.title}".`;
      if (res.warnings && res.warnings.length > 0) {
        msg += ` (${res.warnings[0]})`;
      }
      setToastMsg(msg);
      await loadData(page);
    }
    setUpdatingLessonId(null);
    setTimeout(() => setToastMsg(null), 4500);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/admin/content"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại CMS Hub
        </NavLink>

        <NavLink
          to="/admin/content/listening/new"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-purple-600/20 inline-flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" /> Tạo Bài Listening Mới
        </NavLink>
      </div>

      {toastMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-2">
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Volume2 className="w-6 h-6 text-purple-600" /> Quản Lý Listening (Listening CMS)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Soạn thảo bài học luyện nghe theo TOEIC Part 1–4, quản lý file audio, transcript, hình ảnh minh họa và các câu hỏi trắc nghiệm.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-80 relative">
          <input
            type="text"
            placeholder="Tìm theo tên bài hoặc slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Level filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-extrabold text-slate-500">Trình độ:</span>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-600"
            >
              <option value="all">Tất cả</option>
              <option value="foundation">Foundation</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          {/* TOEIC Part filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-extrabold text-slate-500">Part:</span>
            <select
              value={toeicPartFilter}
              onChange={(e) => setToeicPartFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-600"
            >
              <option value="all">Tất cả (Part 1-4)</option>
              <option value="part1">Part 1 (Photos)</option>
              <option value="part2">Part 2 (Question-Response)</option>
              <option value="part3">Part 3 (Conversations)</option>
              <option value="part4">Part 4 (Talks)</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-extrabold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  statusFilter === 'all' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
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
      </div>

      {/* Main List */}
      {loading ? (
        <LoadingState message="Đang tải danh sách bài Listening..." />
      ) : errorMsg ? (
        <EmptyState title="Lỗi tải dữ liệu" description={errorMsg} icon={AlertCircle} />
      ) : !lessonsData || lessonsData.lessons.length === 0 ? (
        <EmptyState
          title="Chưa có bài Listening nào"
          description="Bấm nút 'Tạo Bài Listening Mới' phía trên để soạn bài đầu tiên."
          icon={Volume2}
        />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Bài nghe (Title & Slug)</th>
                  <th className="py-3.5 px-4">TOEIC Part</th>
                  <th className="py-3.5 px-4">Trình độ</th>
                  <th className="py-3.5 px-4">Audio Status</th>
                  <th className="py-3.5 px-4 text-center">Câu hỏi</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4 text-center">Thứ tự</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {lessonsData.lessons.map((lesson) => (
                  <tr key={lesson.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-slate-900 text-sm block">{lesson.title}</span>
                      <span className="font-mono text-[11px] text-slate-400 block">{lesson.slug}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-[11px] font-extrabold uppercase rounded-lg border border-purple-100">
                        {lesson.toeic_part || 'Part 1'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase rounded-lg border border-slate-200">
                        {lesson.level}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[11px]">
                      {lesson.audio_url ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Có Audio
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Chưa có audio</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center text-[11px] font-bold">
                      <span className="text-purple-600">
                        {lesson.active_questions_count} Active
                        {lesson.hidden_questions_count > 0 && (
                          <span className="text-amber-600 ml-1">({lesson.hidden_questions_count} ẩn)</span>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {lesson.is_published ? (
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
                      {lesson.sort_order}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(lesson)}
                        className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-[11px] rounded-lg transition-colors"
                      >
                        Preview
                      </button>

                      <NavLink
                        to={`/admin/content/listening/${lesson.id}/edit`}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors inline-block"
                      >
                        Sửa
                      </NavLink>

                      <button
                        type="button"
                        disabled={updatingLessonId === lesson.id}
                        onClick={() => handleTogglePublish(lesson)}
                        className={`px-2.5 py-1.5 font-extrabold text-[11px] rounded-lg transition-colors disabled:opacity-50 ${
                          lesson.is_published
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {updatingLessonId === lesson.id ? 'Đang xử lý...' : lesson.is_published ? 'Ẩn' : 'Xuất bản'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {lessonsData.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>
                Trang {lessonsData.page} / {lessonsData.totalPages} (Tổng {lessonsData.totalCount} bài)
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={lessonsData.page <= 1}
                  onClick={() => loadData(lessonsData.page - 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Trước
                </button>

                <button
                  disabled={lessonsData.page >= lessonsData.totalPages}
                  onClick={() => loadData(lessonsData.page + 1)}
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
      {previewLesson && (
        <ListeningPreviewModal
          title={previewLesson.title}
          level={previewLesson.level}
          toeic_part={previewLesson.toeic_part || undefined}
          audio_url={previewLesson.audio_url}
          transcript={previewLesson.transcript}
          questions={previewQuestions.map((q) => ({
            id: q.id,
            question_text: q.question_text,
            options: Array.isArray(q.options) ? q.options : [],
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            sort_order: q.sort_order,
            is_active: q.is_active,
            skill_tag: q.skill_tag,
            topic: q.topic,
            image_url: q.image_url,
          }))}
          onClose={() => setPreviewLesson(null)}
        />
      )}
    </div>
  );
};
