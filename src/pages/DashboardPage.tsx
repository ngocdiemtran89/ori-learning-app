import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  Headphones,
  BookCheck,
  ArrowRight,
  Clock,
  CheckCircle2,
  Play,
  RotateCcw,
  Award,
  Sparkles,
  Flame,
  Bookmark,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { DashboardMetrics, getStudentDashboardMetrics } from '../lib/supabase/dashboard';

export const DashboardPage: React.FC = () => {
  const { user, profile, isActive, isExpired } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadMetrics() {
      if (!user?.id) return;
      const data = await getStudentDashboardMetrics(user.id);
      setMetrics(data);
      setLoading(false);
    }
    loadMetrics();
  }, [user]);

  const studentName = profile?.full_name || user?.email?.split('@')[0] || 'Học viên ORI';
  const studentLevel = profile?.level || 'foundation';

  // Calculate days remaining
  const now = new Date();
  const expiresAt = profile?.access_expires_at ? new Date(profile.access_expires_at) : null;
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const formattedExpiryDate = expiresAt
    ? expiresAt.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : 'Chưa có thông tin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={`Chào mừng học viên ${studentName}!`}
          subtitle={`Trình độ học tập: ${studentLevel.toUpperCase()} • Chuẩn bị bứt phá mục tiêu TOEIC!`}
          badge={`TÀI KHOẢN ${isActive ? 'ACTIVE' : isExpired ? 'EXPIRED' : 'VERIFIED'}`}
        />

        {metrics?.streakDays !== undefined && (
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 text-orange-800 rounded-2xl shadow-sm shrink-0">
            <Flame className={`w-5 h-5 ${metrics.streakDays > 0 ? 'text-orange-500 fill-orange-500 animate-bounce' : 'text-slate-400'}`} />
            <div className="flex flex-col">
              <span className="font-extrabold text-sm leading-tight">
                {metrics.streakDays > 0 ? `🔥 ${metrics.streakDays} ngày học liên tục` : 'Chưa bắt đầu chuỗi học'}
              </span>
              <span className="text-[10px] font-bold text-orange-600 uppercase">Chuỗi học tập</span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingState message="Đang cập nhật tiến độ học tập thực tế từ Supabase..." />
      ) : (
        <>
          {/* 4 Required Real Dashboard Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Từ cần ôn hôm nay */}
            <StatCard
              title="Từ cần ôn hôm nay"
              value={`${metrics?.dueWordsCount ?? 0} từ`}
              subtext={metrics?.dueWordsCount ? 'Cần ôn theo chu kỳ SRS' : 'Đã hoàn thành ôn hôm nay'}
              icon={RotateCcw}
              variant="sky"
            />

            {/* Card 2: Điểm bài tập mới nhất */}
            <StatCard
              title="Điểm mới nhất"
              value={metrics?.latestQuizAttempt ? `${metrics.latestQuizAttempt.score}đ` : 'Chưa làm'}
              subtext={
                metrics?.latestQuizAttempt
                  ? `${metrics.latestQuizAttempt.correct_count}/${metrics.latestQuizAttempt.total_count} câu đúng`
                  : 'Hãy chọn 1 bài để thử sức'
              }
              icon={Award}
              variant="emerald"
            />

            {/* Card 3: Bài tập đã hoàn thành */}
            <StatCard
              title="Bài tập đã hoàn thành"
              value={`${metrics?.completedLessonsCount ?? 0} bài`}
              subtext="Đã lưu vào cơ sở dữ liệu"
              icon={CheckCircle2}
              variant="purple"
            />

            {/* Card 4: Tài khoản còn hiệu lực đến */}
            <StatCard
              title="Tài khoản hiệu lực đến"
              value={formattedExpiryDate}
              subtext={`Còn ${daysRemaining} ngày học`}
              icon={Clock}
              variant="amber"
            />
          </div>

          {/* Deterministic "Học Tiếp" Recommendation Card */}
          {metrics?.recommendedAction && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Play className="w-5 h-5 text-ori-600 fill-current" /> Gợi Ý Bài Học Tiếp Theo
                </h2>
                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-ori-600" /> Tiến độ tối ưu
                </span>
              </div>

              <div className="p-4 bg-sky-50 rounded-xl border border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="px-2 py-0.5 rounded bg-ori-600 text-white text-[10px] font-bold uppercase">
                    {metrics.recommendedAction.badge}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">{metrics.recommendedAction.title}</h3>
                  <p className="text-xs text-slate-500">{metrics.recommendedAction.subtitle}</p>
                </div>

                <div className="flex items-center gap-2">
                  <NavLink
                    to="/notebook"
                    className="px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Bookmark className="w-4 h-4 fill-amber-500" />
                    <span>Sổ Tay Từ Khó</span>
                  </NavLink>

                  <NavLink
                    to={metrics.recommendedAction.path}
                    className="px-4 py-2.5 bg-ori-600 hover:bg-ori-700 text-white font-bold text-xs rounded-xl shadow-md shadow-ori-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shrink-0"
                  >
                    <span>Học ngay</span>
                    <ArrowRight className="w-4 h-4" />
                  </NavLink>
                </div>
              </div>
            </div>
          )}

          {/* 4 Learning Modules Links Grid */}
          <div>
            <h2 className="text-base font-extrabold text-slate-900 mb-3">4 Module Học Tập Chính</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NavLink
                to="/vocabulary"
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-ori-500 shadow-sm hover:shadow-md transition-all group flex items-start justify-between"
              >
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-ori-600 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base group-hover:text-ori-600 transition-colors">
                    1. Vocabulary (Từ vựng)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Học từ vựng Flashcard lặp lại ngắt quãng SRS theo chủ đề TOEIC.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-ori-600 group-hover:translate-x-1 transition-all" />
              </NavLink>

              <NavLink
                to="/grammar"
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 shadow-sm hover:shadow-md transition-all group flex items-start justify-between"
              >
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base group-hover:text-ori-600 transition-colors">
                    2. Grammar (Ngữ pháp)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Các chuyên đề ngữ pháp Part 5 & 6 có bài tập thực hành chấm điểm tự động.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-ori-600 group-hover:translate-x-1 transition-all" />
              </NavLink>

              <NavLink
                to="/listening"
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-purple-500 shadow-sm hover:shadow-md transition-all group flex items-start justify-between"
              >
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base group-hover:text-ori-600 transition-colors">
                    3. Listening (Luyện nghe)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Luyện nghe Part 1 - Part 4 kèm Audio & Transcript giải thích đáp án.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-ori-600 group-hover:translate-x-1 transition-all" />
              </NavLink>

              <NavLink
                to="/reading"
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-500 shadow-sm hover:shadow-md transition-all group flex items-start justify-between"
              >
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <BookCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base group-hover:text-ori-600 transition-colors">
                    4. Reading (Luyện đọc)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Luyện đọc hiểu Part 7 đoạn đơn & đoạn đôi với kỹ thuật làm bài Skimming.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-ori-600 group-hover:translate-x-1 transition-all" />
              </NavLink>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
