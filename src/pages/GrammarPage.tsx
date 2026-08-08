import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { ModuleCard } from '../components/ui/ModuleCard';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { GrammarLesson } from '../lib/supabase/types';
import { getGrammarLessons, getUserProgressMap } from '../lib/supabase/grammar';

export const GrammarPage: React.FC = () => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<GrammarLesson[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, { status: string; score: number | null }>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadGrammarData() {
      const data = await getGrammarLessons();
      setLessons(data);

      if (user?.id) {
        const pMap = await getUserProgressMap(user.id, 'grammar');
        setProgressMap(pMap);
      }

      setLoading(false);
    }
    loadGrammarData();
  }, [user]);

  const getStatusBadge = (lessonId: string) => {
    const p = progressMap[lessonId];
    if (!p || p.status === 'not_started') return 'Chưa học';
    if (p.status === 'completed') return `Đã xong ${p.score ? `(${p.score}đ)` : ''}`;
    return 'Đang học';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module Ngữ Pháp TOEIC (Grammar)"
        subtitle="Tổng hợp các chuyên đề ngữ pháp cốt lõi kèm bài tập trắc nghiệm tự động chấm điểm cho Part 5 & Part 6."
      />

      {loading ? (
        <LoadingState message="Đang tải danh sách bài học ngữ pháp từ Supabase..." />
      ) : lessons.length === 0 ? (
        <EmptyState
          title="Chưa có bài học ngữ pháp nào"
          description="Danh sách bài học ngữ pháp hiện chưa được xuất bản hoặc tài khoản của bạn chưa được cấp quyền."
          icon={FileText}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {lessons.map((lesson) => (
            <ModuleCard
              key={lesson.id}
              title={lesson.title}
              description={lesson.summary || 'Chuyên đề ngữ pháp trọng tâm TOEIC'}
              path={`/grammar/${lesson.slug}`}
              icon={FileText}
              badge={getStatusBadge(lesson.id)}
              infoText="Học chuyên đề này"
              color="indigo"
            />
          ))}
        </div>
      )}
    </div>
  );
};
