import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Loader2, BookCheck } from 'lucide-react';
import { fetchPublishedTests, fetchMyAttempt, startOrResumeTest, fetchAttemptAnswers } from '../lib/supabase/studentToeic';
import type { PublishedToeicTest, ToeicTestAttempt } from '../lib/supabase/types';

export const ToeicTestOverviewPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<PublishedToeicTest | null>(null);
  const [attempt, setAttempt] = useState<ToeicTestAttempt | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;
    const load = async () => {
      setLoading(true);
      // Fetch test info
      const testsRes = await fetchPublishedTests();
      if (testsRes.data) {
        const found = testsRes.data.find(t => t.id === testId);
        setTest(found || null);
      }

      // Check existing attempt
      const attemptRes = await fetchMyAttempt(testId);
      if (attemptRes.data) {
        setAttempt(attemptRes.data);
        // Count answered questions
        const answersRes = await fetchAttemptAnswers(attemptRes.data.id);
        if (answersRes.data) {
          setAnsweredCount(answersRes.data.filter(a => a.selected_answer).length);
        }
      }
      setLoading(false);
    };
    load();
  }, [testId]);

  const handleStart = async () => {
    if (!testId) return;
    setStarting(true);
    setError(null);
    const res = await startOrResumeTest(testId);
    if (res.error) {
      setError(res.error);
      setStarting(false);
    } else {
      navigate(`/tests/${testId}/take`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Đang tải...
      </div>
    );
  }

  if (!test) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <p className="text-slate-500">Đề thi không tồn tại hoặc chưa được xuất bản.</p>
        <Link to="/tests" className="text-ori-600 font-bold text-sm mt-4 inline-block">
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link to="/tests" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-ori-600 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Danh sách đề thi
      </Link>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-ori-600 to-sky-400 flex items-center justify-center text-white shadow-md">
            <BookCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-slate-900">{test.title}</h1>
            {test.test_code && (
              <span className="inline-block mt-1 text-[10px] font-bold text-ori-600 bg-ori-50 px-2 py-0.5 rounded-md uppercase">
                {test.test_code}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase">Tổng câu hỏi</div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">200</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase">Thời gian</div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">120 phút</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase">Listening</div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">Part 1–4</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase">Reading</div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">Part 5–7</div>
          </div>
        </div>

        {attempt && (
          <div className="bg-ori-50 border border-ori-200 rounded-xl p-4 text-sm">
            <div className="font-extrabold text-ori-700">Bạn đang có bài thi đang làm</div>
            <div className="text-ori-600 mt-1">
              {answeredCount} / 200 câu đã trả lời
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-bold">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="w-full py-3.5 px-6 bg-gradient-to-r from-ori-600 to-sky-500 text-white font-extrabold rounded-xl shadow-lg shadow-ori-300/30 hover:shadow-xl hover:scale-[1.01] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {starting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {attempt ? 'Tiếp tục làm bài' : 'Bắt đầu làm bài'}
        </button>
      </div>
    </div>
  );
};
