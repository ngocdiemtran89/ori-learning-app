import React, { useEffect, useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  Target,
  AlertCircle,
  Compass,
  CheckCircle2,
  History,
  ShieldCheck,
  Edit2,
} from 'lucide-react';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { EditStudentModal } from '../components/admin/EditStudentModal';
import { getAdminStudentProgress } from '../lib/supabase/adminProgress';
import { AdminStudentProgressSummary } from '../lib/learning/studentProgressSummary';

export const AdminStudentProgressPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const [summary, setSummary] = useState<AdminStudentProgressSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);

  const fetchProgress = async () => {
    if (!studentId) return;
    setLoading(true);
    setErrorMsg(null);

    const res = await getAdminStudentProgress(studentId);
    if (res.error) {
      setErrorMsg(res.error);
      setSummary(null);
    } else {
      setSummary(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProgress();
  }, [studentId]);

  if (loading) {
    return <LoadingState message="Đang tải tiến độ học tập của học viên..." />;
  }

  if (errorMsg || !summary || !summary.studentProfile) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <NavLink
          to="/admin/students"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Danh sách Học viên
        </NavLink>
        <EmptyState
          title="Không tìm thấy tiến độ học viên"
          description={errorMsg || 'Mã học viên không tồn tại trong hệ thống.'}
          icon={AlertCircle}
        />
      </div>
    );
  }

  const p = summary.studentProfile;
  const isExpired = p.access_expires_at ? new Date(p.access_expires_at) <= new Date() : false;

  const daysRemaining = p.access_expires_at
    ? Math.max(0, Math.ceil((new Date(p.access_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 999;

  const formattedExpiryDate = p.access_expires_at
    ? new Date(p.access_expires_at).toLocaleDateString('vi-VN')
    : 'Không thời hạn';

  const signalBadgeColor =
    summary.activitySignal === 'recent'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : summary.activitySignal === 'idle_few_days'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <NavLink
          to="/admin/students"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Danh sách Học viên
        </NavLink>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Báo Cáo Admin
          </span>
          <button
            onClick={() => setShowEditModal(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-ori-50 text-slate-700 hover:text-ori-600 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Quản Lý Tài Khoản
          </button>
        </div>
      </div>

      {/* SECTION 1: ACCOUNT SUMMARY HEADER */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-extrabold text-xl">
              {p.full_name?.charAt(0) || 'H'}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
                {p.full_name || 'Học viên ORI'}
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {p.id}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="px-3 py-1 bg-slate-800 text-indigo-300 text-xs font-extrabold uppercase rounded-lg border border-slate-700">
              Trình độ: {p.level || 'foundation'}
            </span>

            {p.status === 'active' ? (
              isExpired ? (
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-extrabold rounded-lg">
                  Đã hết hạn ({formattedExpiryDate})
                </span>
              ) : (
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold rounded-lg">
                  Hoạt động (Còn {daysRemaining} ngày)
                </span>
              )
            ) : (
              <span className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-extrabold rounded-lg">
                Tài khoản bị khóa
              </span>
            )}
          </div>
        </div>

        {/* Activity Signal Badge */}
        <div className={`p-4 rounded-2xl border ${signalBadgeColor} space-y-1.5 min-w-[200px]`}>
          <span className="text-[10px] font-extrabold uppercase tracking-wider block">Tín Hiệu Hoạt Động</span>
          <span className="text-sm font-extrabold block">{summary.activitySignalText}</span>
          <p className="text-[11px] opacity-80 font-medium">
            {summary.lastActivityAt
              ? `Lần cuối: ${new Date(summary.lastActivityAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
              : 'Chưa có hoạt động'}
          </p>
        </div>
      </div>

      {/* SECTION 2: 7-DAY ACTIVITY METRICS */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" /> 7 Ngày Gần Đây (Vietnam Time)
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 block">Ngày Học</span>
            <span className="text-2xl font-extrabold text-indigo-600 block">{summary.studyDaysLast7} / 7</span>
            <span className="text-[11px] text-slate-400 font-medium block">Số ngày có ôn bài</span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 block">Câu Đã Trả Lời</span>
            <span className="text-2xl font-extrabold text-slate-900 block">{summary.questionAttemptsLast7}</span>
            <span className="text-[11px] text-slate-400 font-medium block">Tổng lượt làm câu hỏi</span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 block">Bài Luyện Hoàn Thành</span>
            <span className="text-2xl font-extrabold text-slate-900 block">{summary.quizAttemptsLast7}</span>
            <span className="text-[11px] text-slate-400 font-medium block">Lượt nộp bài quiz</span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 block">Từ Vựng Đã Ôn</span>
            <span className="text-2xl font-extrabold text-amber-600 block">{summary.vocabularyItemsReviewedLast7}</span>
            <span className="text-[11px] text-slate-400 font-medium block">Số từ đã ôn SRS</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: CURRENT MASTERY & PROGRESS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-extrabold rounded-full">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              <span>MỨC ĐỘ HIỆN TẠI</span>
            </div>
            <h3 className="text-3xl font-extrabold text-slate-900 pt-2">
              {summary.currentMasteryPercent !== null ? `${summary.currentMasteryPercent}%` : 'Chưa đủ dữ liệu'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Dựa trên {summary.uniqueQuestionsAnalyzed} câu hỏi khác nhau đã thực hành trong 90 ngày.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-extrabold rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>BÀI HỌC TÍCH LŨY</span>
            </div>
            <div className="flex items-baseline gap-4 pt-2">
              <div>
                <span className="text-3xl font-extrabold text-emerald-600">{summary.completedLessonsTotal}</span>
                <span className="text-xs font-bold text-slate-500 ml-1">đã xong</span>
              </div>
              <div>
                <span className="text-xl font-extrabold text-slate-700">{summary.inProgressLessonsTotal}</span>
                <span className="text-xs font-bold text-slate-400 ml-1">đang học</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-extrabold rounded-full">
              <Target className="w-3.5 h-3.5 text-amber-600" />
              <span>LỖI CHƯA KHẮC PHỤC</span>
            </div>
            <h3 className="text-3xl font-extrabold text-amber-600 pt-2">
              {summary.unresolvedMistakes} câu
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Các câu trả lời sai gần nhất chưa làm lại đúng trong Sổ lỗi sai.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: FOCUS AREAS & SYSTEM RECOMMENDATIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Focus Areas */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-rose-600" /> Cần Tập Trung (Focus Areas)
          </h2>

          {summary.focusAreas.length === 0 ? (
            <p className="text-xs text-slate-500 font-medium py-4 text-center bg-slate-50 rounded-2xl">
              Học viên chưa có chủ đề yếu nổi bật hoặc chưa đủ 5 câu hỏi thực hành.
            </p>
          ) : (
            <div className="space-y-3">
              {summary.focusAreas.map((fa, i) => (
                <div key={i} className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 block">{fa.label}</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {fa.uniqueQuestionCount} câu khác nhau • {fa.unresolvedCount} lỗi
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-rose-600">{fa.masteryPercent}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Recommendations */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-600" /> Gợi Ý Của Hệ Thống (System Recommendations)
          </h2>

          {summary.recommendations.length === 0 ? (
            <p className="text-xs text-slate-500 font-medium py-4 text-center bg-slate-50 rounded-2xl">
              Chưa đủ dữ liệu để tạo gợi ý cá nhân hóa cho học viên.
            </p>
          ) : (
            <div className="space-y-3">
              {summary.recommendations.map((rec, i) => (
                <div key={i} className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900">{i + 1}. {rec.title}</span>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">~{rec.estimatedMinutes}m</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Lý do: {rec.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5: RECENT QUIZ TIMELINE */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-600" /> Lịch Sử Nộp Bài Quiz Gần Đây (10 bài mới nhất)
        </h2>

        {summary.recentQuizTimeline.length === 0 ? (
          <p className="text-xs text-slate-500 font-medium py-6 text-center bg-slate-50 rounded-2xl">
            Học viên chưa nộp bài quiz nào.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-4">Loại bài</th>
                  <th className="py-2.5 px-4">Kết quả làm đúng</th>
                  <th className="py-2.5 px-4">Điểm số</th>
                  <th className="py-2.5 px-4 text-right">Thời gian nộp (VN Time)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {summary.recentQuizTimeline.map((q, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 uppercase">
                      {q.content_type}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-semibold">
                      {q.correct_count ?? 0} / {q.total_count ?? 0} câu
                    </td>
                    <td className="py-3 px-4 font-extrabold text-indigo-600">
                      {q.score !== null ? `${q.score}%` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 font-medium">
                      {new Date(q.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for editing student account details */}
      {showEditModal && (
        <EditStudentModal
          student={summary.studentProfile}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchProgress();
          }}
        />
      )}
    </div>
  );
};
