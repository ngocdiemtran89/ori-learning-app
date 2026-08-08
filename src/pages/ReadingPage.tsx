import React, { useEffect, useState } from 'react';
import { BookCheck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { ModuleCard } from '../components/ui/ModuleCard';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { LearningLesson } from '../lib/supabase/types';
import { getLearningLessons } from '../lib/supabase/learning';
import { getUserProgressMap } from '../lib/supabase/grammar';

export const ReadingPage: React.FC = () => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<LearningLesson[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, { status: string; score: number | null }>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadReadingData() {
      const data = await getLearningLessons('reading');
      setLessons(data);

      if (user?.id) {
        const pMap = await getUserProgressMap(user.id, 'reading');
        setProgressMap(pMap);
      }

      setLoading(false);
    }
    loadReadingData();
  }, [user]);

  const getStatusBadge = (lessonId: string, part?: string | null) => {
    const p = progressMap[lessonId];
    const partTag = part ? `Part ${part.replace('part', '')}` : 'Reading';
    if (!p || p.status === 'not_started') return partTag;
    if (p.status === 'completed') return `Đã xong (${p.score ? `${p.score}đ` : '100%'})`;
    return `${partTag} • Đang học`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module Luyện Đọc TOEIC (Reading)"
        subtitle="Rèn luyện kỹ năng đọc hiểu Skimming & Scanning cho Part 7 đoạn đơn, đoạn đôi & đoạn ba."
      />

      {loading ? (
        <LoadingState message="Đang tải bài luyện đọc từ Supabase..." />
      ) : lessons.length === 0 ? (
        <EmptyState
          title="Chưa có bài luyện đọc nào"
          description="Danh sách bài luyện đọc hiện chưa được xuất bản hoặc tài khoản của bạn chưa được cấp quyền."
          icon={BookCheck}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {lessons.map((lesson) => (
            <ModuleCard
              key={lesson.id}
              title={lesson.title}
              description={`Bài đọc hiểu Part ${lesson.toeic_part ? lesson.toeic_part.replace('part', '') : '7'} trình độ ${lesson.level}`}
              path={`/reading/${lesson.slug}`}
              icon={BookCheck}
              badge={getStatusBadge(lesson.id, lesson.toeic_part)}
              infoText="Luyện bài đọc ngay"
              color="emerald"
            />
          ))}
        </div>
      )}
    </div>
  );
};
