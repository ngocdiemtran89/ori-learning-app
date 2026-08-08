import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, RotateCcw } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { ModuleCard } from '../components/ui/ModuleCard';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { VocabularyDeck } from '../lib/supabase/types';
import { getVocabularyDecks } from '../lib/supabase/vocabulary';

export const VocabularyPage: React.FC = () => {
  const [decks, setDecks] = useState<VocabularyDeck[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDecks() {
      const data = await getVocabularyDecks();
      setDecks(data);
      setLoading(false);
    }
    loadDecks();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module Từ Vựng TOEIC (Vocabulary)"
        subtitle="Chọn bộ từ vựng (Deck) bên dưới để học Flashcards theo thuật toán lặp lại khoảng cách SRS."
        action={
          <NavLink
            to="/vocabulary/review-today"
            className="px-4 py-2.5 bg-ori-600 hover:bg-ori-700 text-white font-bold text-xs rounded-xl shadow-md shadow-ori-600/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Ôn hôm nay (SRS Due)</span>
          </NavLink>
        }
      />

      {loading ? (
        <LoadingState message="Đang tải danh sách bộ từ vựng từ cơ sở dữ liệu Supabase..." />
      ) : decks.length === 0 ? (
        <EmptyState
          title="Chưa có bộ từ vựng nào"
          description="Danh sách bộ từ vựng hiện chưa có bài học được xuất bản hoặc tài khoản của bạn chưa được cấp quyền."
          icon={BookOpen}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {decks.map((deck) => (
            <ModuleCard
              key={deck.id}
              title={deck.title}
              description={deck.description || 'Bộ từ vựng chuẩn đề thi TOEIC'}
              path={`/vocabulary/${deck.slug}`}
              icon={BookOpen}
              badge={deck.level}
              infoText="Học Flashcard này"
              color="ori"
            />
          ))}
        </div>
      )}
    </div>
  );
};
