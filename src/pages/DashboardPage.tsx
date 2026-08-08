import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  Headphones,
  ArrowRight,
  Clock,
  CheckCircle2,
  RotateCcw,
  Award,
  Flame,
  CalendarCheck,
  Circle,
  Target,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { DashboardMetrics, getStudentDashboardMetrics } from '../lib/supabase/dashboard';
import { LearningAnalysis } from '../lib/learning/weaknessAnalysis';
import { getStudentLearningAnalysis } from '../lib/supabase/analysis';

export const DashboardPage: React.FC = () => {
  const { user, profile, isActive, isExpired } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [analysis, setAnalysis] = useState<LearningAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const studentName = profile?.full_name || user?.email?.split('@')[0] || 'Học viên ORI';
  const studentLevel = profile?.level || 'foundation';

  useEffect(() => {
    async function loadMetrics() {
      if (!user?.id) return;
      const [data, analysisRes] = await Promise.all([
        getStudentDashboardMetrics(user.id, studentLevel),
        getStudentLearningAnalysis(user.id),
      ]);
      setMetrics(data);
      if (analysisRes.data) {
        setAnalysis(analysisRes.data);
      }
      setLoading(false);
    }
    loadMetrics();
  }, [user, studentLevel]);

  // Calculate days remaining
  const now = new Date();
  const expiresAt = profile?.access_expires_at ? new Date(profile.access_expires_at) : null;
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const formattedExpiryDate = expiresAt
    ? expiresAt.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : 'Chưa có thông tin';

  const dailyPlan = metrics?.dailyPlan;
  const isAllCompleted = dailyPlan && dailyPlan.totalItems > 0 && dailyPlan.completedItems === dailyPlan.totalItems;
  const progressPercent = dailyPlan && dailyPlan.totalItems > 0
    ? Math.round((dailyPlan.completedItems / dailyPlan.totalItems) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header & Streak Badge */}
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
        <LoadingState message="Đang cập nhật lộ trình Kế hoạch học tập hàng ngày từ Supabase..." />
      ) : (
        <>
          {/* SECTION: KẾ HOẠCH HÔM NAY (Phase 2.3 Daily Study Plan) */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-6 border border-slate-700/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full border border-indigo-500/30">
                  <CalendarCheck className="w-4 h-4 text-indigo-400" />
                  <span>KẾ HOẠCH HÔM NAY (DAILY STUDY PLAN)</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Hôm nay bạn nên học gì?</h2>
              </div>

              {dailyPlan && (
                <div className="flex flex-col sm:items-end">
                  <div className="text-sm font-extrabold text-indigo-300">
                    {isAllCompleted
                      ? '🎉 Tất cả bài học hôm nay đã hoàn thành!'
                      : `${dailyPlan.completedItems} / ${dailyPlan.totalItems} hoàn thành • Khoảng ${dailyPlan.totalEstimatedMinutes} phút còn lại`}
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full sm:w-48 h-2.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Daily Plan Items Grid */}
            {!dailyPlan || dailyPlan.items.length === 0 ? (
              <div className="p-6 bg-slate-800/60 rounded-2xl text-center text-slate-300 text-xs font-semibold">
                Không có bài học nào cần thiết hôm nay. Hãy nghỉ ngơi hoặc ôn lại từ vựng cũ nhé!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dailyPlan.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between space-y-4 ${
                      item.completed
                        ? 'bg-emerald-950/20 border-emerald-500/30 opacity-80'
                        : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-indigo-500/50 shadow-md'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-700/80 text-slate-300 text-xs font-extrabold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase">
                            {item.type.replace('_', ' ')}
                          </span>
                        </div>

                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" /> ~{item.estimatedMinutes} phút
                        </span>
                      </div>

                      <div className="pt-1">
                        <h3 className={`text-base font-extrabold ${item.completed ? 'line-through text-slate-300' : 'text-white'}`}>
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-slate-400 font-semibold mt-0.5 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-700/40">
                      {item.completed ? (
                        <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-extrabold rounded-xl inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>✓ Hoàn thành</span>
                        </span>
                      ) : (
                        <>
                          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                            <Circle className="w-3 h-3 text-indigo-400 fill-indigo-400/20" /> Chưa làm
                          </span>
                          <NavLink
                            to={item.route}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 inline-flex items-center gap-1.5 transition-all hover:scale-[1.02]"
                          >
                            <span>{item.type === 'continue_lesson' ? '[ TIẾP TỤC ]' : '[ HỌC NGAY ]'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </NavLink>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4 Standard Real Dashboard Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Từ cần ôn hôm nay"
              value={`${metrics?.dueWordsCount ?? 0} từ`}
              subtext={metrics?.dueWordsCount ? 'Cần ôn theo chu kỳ SRS' : 'Đã hoàn thành ôn hôm nay'}
              icon={RotateCcw}
              variant="sky"
            />

            <StatCard
              title="Điểm bài tập mới nhất"
              value={metrics?.latestQuizAttempt ? `${metrics.latestQuizAttempt.score} điểm` : 'Chưa làm'}
              subtext={
                metrics?.latestQuizAttempt
                  ? `${metrics.latestQuizAttempt.correct_count}/${metrics.latestQuizAttempt.total_count} câu đúng`
                  : 'Hãy làm bài tập để ghi điểm'
              }
              icon={Award}
              variant="amber"
            />

            <StatCard
              title="Bài học đã hoàn thành"
              value={`${metrics?.completedLessonsCount ?? 0} bài`}
              subtext="Tiến độ học tập tích lũy"
              icon={CheckCircle2}
              variant="emerald"
            />

            <StatCard
              title="Thời hạn tài khoản"
              value={`${daysRemaining} ngày`}
              subtext={`Hết hạn: ${formattedExpiryDate}`}
              icon={Clock}
              variant={daysRemaining > 7 ? 'purple' : 'amber'}
            />
          </div>

          {/* Compact Analysis Focus Areas Card (Phase 2.4) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-extrabold rounded-full">
                <Target className="w-4 h-4 text-rose-600" />
                <span>CẦN TẬP TRUNG (PHÂN TÍCH HỌC TẬP)</span>
              </div>
              {analysis && analysis.focusAreas && analysis.focusAreas.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {analysis.focusAreas.slice(0, 2).map((item) => (
                    <span
                      key={item.key}
                      className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-extrabold rounded-xl border border-slate-200"
                    >
                      {item.label}: <span className="text-rose-600 font-black">{item.masteryPercent}%</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-semibold pt-1">
                  {analysis?.hasEnoughData
                    ? 'Bạn đang duy trì tỷ lệ làm bài rất tốt trên các chuyên đề!'
                    : 'ORI đang thu thập thêm dữ liệu học tập của bạn.'}
                </p>
              )}
            </div>

            <NavLink
              to="/progress"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md inline-flex items-center justify-center gap-2 transition-all shrink-0"
            >
              <span>[ XEM PHÂN TÍCH ]</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          {/* Core Module Navigation Cards */}
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-ori-600" /> Các Module Học Tập
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Vocabulary */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">Từ Vựng (Vocab)</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      Học từ vựng theo thuật toán lặp lại ngắt quãng SRS, Flashcards kèm phát âm và hình ảnh.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <NavLink
                    to="/vocabulary"
                    className="w-full py-3 bg-sky-50 hover:bg-sky-100 text-sky-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>Vào Học Từ Vựng</span>
                    <ArrowRight className="w-4 h-4" />
                  </NavLink>
                </div>
              </div>

              {/* Card 2: Grammar */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">Ngữ Pháp (Grammar)</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      Chuyên đề ngữ pháp trọng tâm TOEIC, lý thuyết cô đọng kèm bài tập chấm điểm tự động.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <NavLink
                    to="/grammar"
                    className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>Vào Học Ngữ Pháp</span>
                    <ArrowRight className="w-4 h-4" />
                  </NavLink>
                </div>
              </div>

              {/* Card 3: Listening & Reading */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                    <Headphones className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">Luyện Nghe & Đọc</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      Bài luyện Listening & Reading chia theo TOEIC Part, câu hỏi kèm giải thích đáp án chi tiết.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                  <NavLink
                    to="/listening"
                    className="py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>Listening</span>
                  </NavLink>
                  <NavLink
                    to="/reading"
                    className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>Reading</span>
                  </NavLink>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
