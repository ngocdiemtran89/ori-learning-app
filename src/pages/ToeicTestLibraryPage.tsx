import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookCheck, ArrowRight, Loader2 } from 'lucide-react';
import { fetchPublishedTests } from '../lib/supabase/studentToeic';
import type { PublishedToeicTest } from '../lib/supabase/types';

export const ToeicTestLibraryPage: React.FC = () => {
  const [tests, setTests] = useState<PublishedToeicTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetchPublishedTests();
      if (res.error) {
        setError(res.error);
      } else {
        setTests(res.data || []);
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-ori-600 to-sky-400 flex items-center justify-center text-white shadow-md">
            <BookCheck className="w-5 h-5" />
          </div>
          Thi thử TOEIC
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Chọn đề thi để bắt đầu luyện tập với đề thi TOEIC đầy đủ 200 câu.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Đang tải danh sách đề thi...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-bold">
          Lỗi: {error}
        </div>
      )}

      {!loading && !error && tests.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">
          Chưa có đề thi nào được xuất bản.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tests.map(test => (
          <Link
            key={test.id}
            to={`/tests/${test.id}`}
            className="group block p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-ori-300 transition-all duration-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-ori-600 transition-colors">
                  {test.title}
                </h3>
                {test.test_code && (
                  <span className="inline-block mt-1 text-[10px] font-bold text-ori-600 bg-ori-50 px-2 py-0.5 rounded-md uppercase">
                    {test.test_code}
                  </span>
                )}
                <div className="mt-3 text-xs text-slate-500 space-y-0.5">
                  <div>📝 200 câu hỏi</div>
                  <div>🎧 Listening: 100 câu (Part 1–4)</div>
                  <div>📖 Reading: 100 câu (Part 5–7)</div>
                  <div>⏱ 120 phút</div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-ori-500 transition-colors mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
