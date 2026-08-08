import React, { useEffect, useState } from 'react';
import { Headphones } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { ModuleCard } from '../components/ui/ModuleCard';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { LearningLesson } from '../lib/supabase/types';
import { getLearningLessons } from '../lib/supabase/learning';
import { getUserProgressMap } from '../lib/supabase/grammar';

export const ListeningPage: React.FC = () => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<LearningLesson[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, { status: string; score: number | null }>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadListeningData() {
      const data = await getLearningLessons('listening');
      setLessons(data);

      if (user?.id) {
        const pMap = await getUserProgressMap(user.id, 'listening');
        setProgressMap(pMap);
      }

      setLoading(false);
    }
    loadListeningData();
  }, [user]);

  const getStatusBadge = (lessonId: string, part?: string | null) => {
    const p = progressMap[lessonId];
    const partTag = part ? `Part ${part.replace('part', '')}` : 'Listening';
    if (!p || p.status === 'not_started') return partTag;
    if (p.status === 'completed') return `Đã xong (${p.score ? `${p.score}đ` : '100%'})`;
    return `${partTag} • Đang học`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module Luyện Nghe TOEIC (Listening)"
        subtitle="Luyện nghe theo từng Part với hệ thống Audio giọng chuẩn ETS và Transcript giải thích chi tiết."
      />

      {loading ? (
        <LoadingState message="Đang tải bài luyện nghe từ Supabase..." />
      ) : lessons.length === 0 ? (
        <EmptyState
          title="Chưa có bài luyện nghe nào"
          description="Danh sách bài luyện nghe hiện chưa được xuất bản hoặc tài khoản của bạn chưa được cấp quyền."
          icon={Headphones}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {lessons.map((lesson) => (
            <ModuleCard
              key={lesson.id}
              title={lesson.title}
              description={`Luyện nghe TOEIC ${lesson.toeic_part ? `Part ${lesson.toeic_part.replace('part', '')}` : ''} trình độ ${lesson.level}`}
              path={`/listening/${lesson.slug}`}
              icon={Headphones}
              badge={getStatusBadge(lesson.id, lesson.toeic_part)}
              infoText="Luyện nghe ngay"
              color="purple"
            />
          ))}
        </div>
      )}
    </div>
  );
};
