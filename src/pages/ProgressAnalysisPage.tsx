import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  TrendingUp,
  Target,
  ArrowRight,
  BarChart3,
  Compass,
  Clock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { LearningRecommendations } from '../lib/learning/recommendationEngine';
import { getStudentDashboardMetrics } from '../lib/supabase/dashboard';

export const ProgressAnalysisPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [recommendations, setRecommendations] = useState<LearningRecommendations | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const studentLevel = profile?.level || 'foundation';

  useEffect(() => {
    async function loadData() {
      if (!user?.id) return;
      setLoading(true);
      setFetchError(null);

      const metrics = await getStudentDashboardMetrics(user.id, studentLevel);
      if (metrics.fetchError) {
        setFetchError(metrics.fetchError);
      } else {
        setRecommendations(metrics.recommendations);
      }
      setLoading(false);
    }
    loadData();
  }, [user, studentLevel]);

  if (loading) {
    return <LoadingState message="Đang phân tích dữ liệu học tập 90 ngày gần nhất từ Supabase..." />;
  }

  if (fetchError) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          title="Phân tích học tập"
          subtitle="Đánh giá điểm mạnh và các chủ đề cần cải thiện dựa trên lịch sử luyện tập"
        />
        <EmptyState
          title="Không thể tải phân tích học tập"
          description={fetchError}
        />
      </div>
    );
  }

  const recList = recommendations?.recommendations || [];
  const hasPersonalizedData = recommendations?.hasPersonalizedData || false;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <PageHeader
        title="Phân tích học tập"
        subtitle="Dữ liệu đánh giá điểm mạnh, chủ đề cần tập trung và gợi ý bài học cá nhân hóa dựa trên 90 ngày luyện tập"
        badge="DỮ LIỆU THỰC TẾ"
      />

      {/* SECTION 1: OVERALL MASTERY CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/30 flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full border border-indigo-500/30">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span>MỨC ĐỘ HIỆN TẠI (CURRENT MASTERY)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {hasPersonalizedData ? `${recList[0]?.masteryPercent ?? 60}%` : 'Chưa đủ dữ liệu'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              {hasPersonalizedData
                ? `Mức độ làm đúng câu hỏi dựa trên các câu khác nhau bạn đã thực hành trong 90 ngày qua.`
                : 'Bạn cần hoàn thành ít nhất 5 câu hỏi khác nhau để hệ thống tính toán mức độ làm chủ và gợi ý bài học cá nhân hóa.'}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-700/60 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Trình độ tài khoản: <strong className="text-indigo-300 uppercase">{studentLevel}</strong></span>
            <NavLink to="/dashboard" className="text-xs font-extrabold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              <span>Xem Kế Hoạch Hàng Ngày</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Sổ Lỗi Sai (Mistakes)</h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Khắc phục lại các câu làm sai gần đây để nâng cao điểm mức độ làm chủ.
              </p>
            </div>
          </div>

          <NavLink
            to="/mistakes"
            className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <span>Đến Sổ Lỗi Sai</span>
            <ArrowRight className="w-4 h-4" />
          </NavLink>
        </div>
      </div>

      {/* SECTION 2: ORI GỢI Ý BẠN HỌC TIẾP (RECOMMENDED FOR YOU - Phase 2.5) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-600" /> ORI Gợi Ý Bạn Học Tiếp (Recommendations)
          </h2>
          <span className="text-xs text-slate-500 font-medium">Tối đa 3 đề xuất cá nhân hóa</span>
        </div>

        {!hasPersonalizedData || recList.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">ORI cần thêm một chút dữ liệu học tập để cá nhân hóa bài tiếp theo.</p>
            <p className="text-xs text-slate-500">
              Hãy hoàn thành thêm bài tập trong Kế hoạch hàng ngày để ORI kích hoạt gợi ý chính xác nhất.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recList.map((rec, idx) => (
              <div
                key={rec.id}
                className="bg-white rounded-3xl p-6 border border-indigo-100 shadow-md hover:shadow-lg transition-all flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase border border-indigo-200">
                      ĐỀ XUẤT {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" /> ~{rec.estimatedMinutes} phút
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{rec.title}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      Lý do: {rec.description}
                    </p>
                  </div>
                </div>

                <NavLink
                  to={rec.route}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
                >
                  <span>[ HỌC NGAY ]</span>
                  <ArrowRight className="w-4 h-4" />
                </NavLink>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: MODULE OVERVIEW & QUICK ACTIONS */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" /> Tổng Quan Các Kỹ Năng
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <span className="font-extrabold text-sm text-slate-900 block">Ngữ Pháp</span>
            <p className="text-xs text-slate-500 font-medium">Chuyên đề ngữ pháp trọng tâm theo trình độ</p>
            <NavLink to="/grammar" className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-600 hover:underline pt-2">
              <span>Đến Ngữ Pháp</span> <ArrowRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <span className="font-extrabold text-sm text-slate-900 block">Luyện Nghe</span>
            <p className="text-xs text-slate-500 font-medium">Bài luyện nghe TOEIC Part 1 - Part 4</p>
            <NavLink to="/listening" className="inline-flex items-center gap-1 text-xs font-extrabold text-purple-600 hover:underline pt-2">
              <span>Đến Luyện Nghe</span> <ArrowRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <span className="font-extrabold text-sm text-slate-900 block">Luyện Đọc</span>
            <p className="text-xs text-slate-500 font-medium">Bài luyện đọc TOEIC Part 5 - Part 7</p>
            <NavLink to="/reading" className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-600 hover:underline pt-2">
              <span>Đến Luyện Đọc</span> <ArrowRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
};
