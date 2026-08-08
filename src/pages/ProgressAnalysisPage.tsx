import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  TrendingUp,
  Target,
  ArrowRight,
  AlertCircle,
  BarChart3,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { LearningAnalysis } from '../lib/learning/weaknessAnalysis';
import { getStudentLearningAnalysis } from '../lib/supabase/analysis';

export const ProgressAnalysisPage: React.FC = () => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<LearningAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalysis() {
      if (!user?.id) return;
      setLoading(true);
      setFetchError(null);

      const res = await getStudentLearningAnalysis(user.id);
      if (res.error) {
        setFetchError(res.error);
        setAnalysis(null);
      } else {
        setAnalysis(res.data);
      }
      setLoading(false);
    }
    loadAnalysis();
  }, [user]);

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

  const hasEnoughData = analysis && analysis.hasEnoughData;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <PageHeader
        title="Phân tích học tập"
        subtitle="Dữ liệu đánh giá điểm mạnh và các chủ đề cần tập trung dựa trên 90 ngày luyện tập gần nhất"
        badge="DỮ LIỆU THỰC TẾ"
      />

      {analysis?.analysisTruncated && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Phân tích được tối ưu dựa trên 2,000 câu hỏi luyện tập gần đây nhất của bạn.</span>
        </div>
      )}

      {/* SECTION 1: OVERALL MASTERY CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/30 flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full border border-indigo-500/30">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span>MỨC ĐỘ HIỆN TẠI (CURRENT MASTERY)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {hasEnoughData ? `${analysis.overallMasteryPercent}%` : 'Chưa đủ dữ liệu'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              {hasEnoughData
                ? `Mức độ làm đúng câu hỏi dựa trên ${analysis.uniqueQuestions} câu khác nhau bạn đã thực hành.`
                : 'Bạn cần hoàn thành ít nhất 5 câu hỏi khác nhau để hệ thống bắt đầu tính tỷ lệ phần trăm mức độ làm chủ.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/60">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tổng số lượt làm</span>
              <span className="text-lg font-extrabold text-white">{analysis?.totalAttempts ?? 0} lượt</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Số câu hỏi khác nhau</span>
              <span className="text-lg font-extrabold text-indigo-300">{analysis?.uniqueQuestions ?? 0} câu</span>
            </div>
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

      {/* SECTION 2: FOCUS AREAS (CẦN TẬP TRUNG) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-rose-500" /> Chủ Đề Cần Tập Trung (Focus Areas)
          </h2>
          <span className="text-xs text-slate-500 font-medium">Tối đa 3 nội dung ưu tiên</span>
        </div>

        {!analysis?.focusAreas || analysis.focusAreas.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">Chưa có chủ đề nào ở mức cần tập trung 🎉</p>
            <p className="text-xs text-slate-500">
              Hãy tiếp tục luyện tập thêm các chuyên đề bài tập để ORI phân tích chính xác các điểm cần cải thiện.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analysis.focusAreas.map((stat) => (
              <div
                key={`${stat.dimension}-${stat.key}`}
                className="bg-white rounded-2xl p-5 border border-rose-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-extrabold uppercase">
                      {stat.dimension.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-extrabold text-rose-600">
                      {stat.masteryPercent}% hiện tại
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 pt-1">{stat.label}</h3>

                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Làm đúng: {stat.correctLatestCount} / {stat.uniqueQuestionCount} câu</div>
                    {stat.unresolvedCount > 0 && (
                      <div className="text-rose-600 font-bold">{stat.unresolvedCount} câu chưa khắc phục</div>
                    )}
                  </div>
                </div>

                <NavLink
                  to="/mistakes"
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>[ LUYỆN LẠI ]</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </NavLink>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: MODULE OVERVIEW (TỔNG QUAN THEO KỸ NĂNG) */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" /> Tổng Quan Theo Kỹ Năng (Modules)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {['grammar', 'listening', 'reading', 'vocabulary'].map((moduleKey) => {
            const stat = analysis?.modules.find((m) => m.key.toLowerCase() === moduleKey);
            const label = moduleKey === 'grammar' ? 'Ngữ pháp' : moduleKey === 'listening' ? 'Luyện nghe' : moduleKey === 'reading' ? 'Luyện đọc' : 'Từ vựng';
            const uCount = stat?.uniqueQuestionCount ?? 0;
            const hasData = uCount >= 5;

            return (
              <div key={moduleKey} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">{label}</span>
                  <span className="text-xs font-extrabold text-indigo-600">
                    {hasData ? `${stat?.masteryPercent}%` : 'Chưa đủ dữ liệu'}
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${hasData ? stat?.masteryPercent ?? 0 : 0}%` }}
                  />
                </div>

                <div className="text-[11px] text-slate-500 font-semibold flex justify-between">
                  <span>{uCount} câu đã luyện</span>
                  <span>{hasData ? stat?.status.toUpperCase() : 'Ít hơn 5 câu'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: TOEIC PART ANALYSIS */}
      {analysis?.toeicParts && analysis.toeicParts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-600" /> Phân Tích Theo TOEIC Part
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {analysis.toeicParts.map((stat) => (
              <div key={stat.key} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">{stat.label}</span>
                  <span className="text-xs font-extrabold text-purple-600">
                    {stat.uniqueQuestionCount >= 5 ? `${stat.masteryPercent}%` : 'Chưa đủ dữ liệu'}
                  </span>
                </div>

                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full transition-all duration-500"
                    style={{ width: `${stat.uniqueQuestionCount >= 5 ? stat.masteryPercent : 0}%` }}
                  />
                </div>

                <div className="text-[11px] text-slate-500 font-medium flex justify-between">
                  <span>{stat.uniqueQuestionCount} câu khác nhau</span>
                  <span>{stat.correctLatestCount} câu làm đúng</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: SKILLS BREAKDOWN */}
      {analysis?.skills && analysis.skills.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" /> Chi Tiết Chuyên Đề / Kỹ Năng
          </h2>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {analysis.skills.map((stat) => (
                <div key={stat.key} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-sm text-slate-900 block">{stat.label}</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {stat.uniqueQuestionCount} câu đã luyện • {stat.unresolvedCount} câu chưa khắc phục
                    </span>
                  </div>

                  <span className={`px-3 py-1 rounded-xl text-xs font-extrabold ${
                    stat.uniqueQuestionCount < 5
                      ? 'bg-slate-200 text-slate-600'
                      : stat.masteryPercent >= 80
                      ? 'bg-emerald-100 text-emerald-800'
                      : stat.masteryPercent >= 60
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {stat.uniqueQuestionCount >= 5 ? `${stat.masteryPercent}%` : 'Chưa đủ dữ liệu'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
