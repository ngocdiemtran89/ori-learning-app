import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Loader2, BookCheck, Headphones, BookOpen } from 'lucide-react';
import { fetchPublishedTests, fetchAllMyAttempts, startOrResumeTest, fetchAttemptAnswers } from '../lib/supabase/studentToeic';
import { TOEIC_FULL_TEST_STRUCTURE, type CanonicalToeicPart } from '../lib/toeic/testStructure';
import type { PublishedToeicTest, ToeicTestAttempt } from '../lib/supabase/types';

const PART_INFO: { part: number; key: CanonicalToeicPart; icon: 'listen' | 'read' }[] = [
  { part: 1, key: 'part1', icon: 'listen' },
  { part: 2, key: 'part2', icon: 'listen' },
  { part: 3, key: 'part3', icon: 'listen' },
  { part: 4, key: 'part4', icon: 'listen' },
  { part: 5, key: 'part5', icon: 'read' },
  { part: 6, key: 'part6', icon: 'read' },
  { part: 7, key: 'part7', icon: 'read' },
];

export const ToeicTestOverviewPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<PublishedToeicTest | null>(null);
  const [attempts, setAttempts] = useState<ToeicTestAttempt[]>([]);
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [startingMode, setStartingMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;
    const load = async () => {
      setLoading(true);
      const testsRes = await fetchPublishedTests();
      if (testsRes.data) {
        setTest(testsRes.data.find(t => t.id === testId) || null);
      }

      const attemptsRes = await fetchAllMyAttempts(testId);
      if (attemptsRes.data) {
        setAttempts(attemptsRes.data);
        const counts: Record<string, number> = {};
        await Promise.all(attemptsRes.data.map(async (att) => {
          const res = await fetchAttemptAnswers(att.id);
          counts[att.id] = res.data?.filter(a => a.selected_answer).length || 0;
        }));
        setAnswerCounts(counts);
      }
      setLoading(false);
    };
    load();
  }, [testId]);

  const fullAttempt = attempts.find(a => a.mode === 'full');
  const partAttempt = (partNum: number) => attempts.find(a => a.mode === 'part' && a.part_number === partNum);

  const handleStartFull = useCallback(async () => {
    if (!testId) return;
    setStartingMode('full');
    setError(null);
    const res = await startOrResumeTest(testId, 'full');
    if (res.error) { setError(res.error); setStartingMode(null); }
    else navigate(`/tests/${testId}/take?mode=full`);
  }, [testId, navigate]);

  const handleStartPart = useCallback(async (partNum: number) => {
    if (!testId) return;
    setStartingMode(`part-${partNum}`);
    setError(null);
    const res = await startOrResumeTest(testId, 'part', partNum);
    if (res.error) { setError(res.error); setStartingMode(null); }
    else navigate(`/tests/${testId}/take?mode=part&part=${partNum}`);
  }, [testId, navigate]);

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
        <Link to="/tests" className="text-ori-600 font-bold text-sm mt-4 inline-block">← Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <Link to="/tests" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-ori-600">
        <ArrowLeft className="w-4 h-4" />
        Danh sách đề thi
      </Link>

      {/* Test Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-ori-600 to-sky-400 flex items-center justify-center text-white shadow-md">
          <BookCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{test.title}</h1>
          {test.test_code && (
            <span className="inline-block mt-1 text-[10px] font-bold text-ori-600 bg-ori-50 px-2 py-0.5 rounded-md uppercase">
              {test.test_code}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-bold">{error}</div>
      )}

      {/* ================================================ */}
      {/* A. FULL TEST */}
      {/* ================================================ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          📝 Full TOEIC Listening & Reading
        </h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase">Câu hỏi</div>
            <div className="text-lg font-extrabold text-slate-900">200</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase">Thời gian</div>
            <div className="text-lg font-extrabold text-slate-900">120'</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase">Part</div>
            <div className="text-lg font-extrabold text-slate-900">1–7</div>
          </div>
        </div>

        {fullAttempt && (
          <div className="bg-ori-50 border border-ori-200 rounded-xl p-3 text-sm">
            <div className="font-extrabold text-ori-700">Đang làm</div>
            <div className="text-ori-600">{answerCounts[fullAttempt.id] || 0} / 200 câu đã trả lời</div>
          </div>
        )}

        <button
          type="button"
          onClick={handleStartFull}
          disabled={startingMode !== null}
          className="w-full py-3 px-6 bg-gradient-to-r from-ori-600 to-sky-500 text-white font-extrabold rounded-xl shadow-lg shadow-ori-300/30 hover:shadow-xl hover:scale-[1.01] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {startingMode === 'full' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
          {fullAttempt ? 'Tiếp tục Full Test' : 'Bắt đầu Full Test'}
        </button>
      </div>

      {/* ================================================ */}
      {/* B. PRACTICE BY PART */}
      {/* ================================================ */}
      <div className="space-y-3">
        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          🎯 Luyện theo Part
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PART_INFO.map(({ part, key, icon }) => {
            const range = TOEIC_FULL_TEST_STRUCTURE[key];
            const att = partAttempt(part);
            const answered = att ? (answerCounts[att.id] || 0) : 0;

            return (
              <div key={part} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  {icon === 'listen'
                    ? <Headphones className="w-4 h-4 text-sky-500" />
                    : <BookOpen className="w-4 h-4 text-emerald-500" />
                  }
                  <span className="text-sm font-extrabold text-slate-900">{range.nameVi}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {range.expectedCount} câu · Q{range.startNumber}–{range.endNumber}
                </div>

                {att && (
                  <div className="text-xs text-ori-600 font-bold">
                    {answered} / {range.expectedCount} đã trả lời
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleStartPart(part)}
                  disabled={startingMode !== null}
                  className="w-full py-2 px-4 text-sm font-extrabold text-ori-700 bg-ori-50 border border-ori-200 rounded-xl hover:bg-ori-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {startingMode === `part-${part}`
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Play className="w-4 h-4" />
                  }
                  {att ? 'Tiếp tục' : 'Bắt đầu luyện'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
