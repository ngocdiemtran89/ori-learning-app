import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Volume2, CheckCircle2, RotateCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { VocabularyItem, ReviewRating } from '../lib/supabase/types';
import { getDueVocabularyItems, recordVocabularyReview } from '../lib/supabase/vocabulary';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';

export const VocabularyReviewTodayPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [completed, setCompleted] = useState<boolean>(false);

  useEffect(() => {
    async function loadDueItems() {
      if (!user?.id) return;
      const dueData = await getDueVocabularyItems(user.id);
      setItems(dueData);
      setLoading(false);
    }
    loadDueItems();
  }, [user]);

  const currentItem = items[currentIndex];

  const playAudio = (wordText: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(wordText);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleRating = async (rating: ReviewRating) => {
    if (!user?.id || !currentItem) return;

    await recordVocabularyReview(user.id, currentItem.id, rating);

    if (currentIndex < items.length - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCompleted(true);
    }
  };

  if (loading) {
    return <LoadingState message="Đang tìm các từ vựng đến hạn cần ôn hôm nay..." />;
  }

  if (completed || items.length === 0) {
    return (
      <div className="space-y-6 max-w-md mx-auto text-center">
        <NavLink
          to="/vocabulary"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách Vocabulary
        </NavLink>

        <EmptyState
          title="Không có từ nào đến hạn ôn hôm nay!"
          description="Bạn đã hoàn thành xuất sắc toàn bộ các bài ôn tập SRS hôm nay. Hãy quay lại vào ngày mai nhé!"
          icon={CheckCircle2}
          action={
            <NavLink
              to="/vocabulary"
              className="px-4 py-2.5 bg-ori-600 text-white font-bold text-xs rounded-xl shadow-md inline-flex items-center gap-2"
            >
              <span>Học bộ từ vựng mới</span>
            </NavLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <NavLink
          to="/vocabulary"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Danh sách Decks
        </NavLink>
        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full flex items-center gap-1">
          <RotateCcw className="w-3.5 h-3.5" /> Ôn tập SRS Hôm Nay ({currentIndex + 1}/{items.length})
        </span>
      </div>

      {/* Flip Card Component */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className={`w-full min-h-[320px] bg-white rounded-3xl border-2 p-8 shadow-xl cursor-pointer transition-all duration-300 flex flex-col justify-between ${
          isFlipped
            ? 'border-amber-400 bg-gradient-to-b from-white to-amber-50/30'
            : 'border-slate-200 hover:border-amber-400'
        }`}
      >
        {!isFlipped ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 my-auto">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold uppercase">
              {currentItem.part_of_speech || 'word'}
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900">{currentItem.word}</h2>
            {currentItem.ipa && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  playAudio(currentItem.word);
                }}
                className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-semibold cursor-pointer"
              >
                <span>{currentItem.ipa}</span>
                <Volume2 className="w-4 h-4 text-ori-600" />
              </div>
            )}
            <p className="text-xs text-slate-400 font-semibold pt-4 flex items-center gap-1">
              <RotateCw className="w-3.5 h-3.5" /> Chạm / Click để kiểm tra đáp án
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-extrabold text-amber-700 uppercase border-b pb-2">
                {currentItem.word} ({currentItem.part_of_speech})
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Nghĩa tiếng Việt</div>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {currentItem.meaning_vi}
                </div>
              </div>
              {currentItem.example_en && (
                <div className="bg-slate-50 p-3 rounded-xl border text-xs">
                  <strong>Ví dụ:</strong> "{currentItem.example_en}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rating Bar */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => handleRating('again')}
          className="py-3 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold rounded-xl border border-rose-200"
        >
          Again
        </button>
        <button
          onClick={() => handleRating('hard')}
          className="py-3 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-extrabold rounded-xl border border-amber-200"
        >
          Hard
        </button>
        <button
          onClick={() => handleRating('good')}
          className="py-3 px-2 bg-sky-50 hover:bg-sky-100 text-ori-700 text-xs font-extrabold rounded-xl border border-sky-200"
        >
          Good
        </button>
        <button
          onClick={() => handleRating('easy')}
          className="py-3 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-extrabold rounded-xl border border-emerald-200"
        >
          Easy
        </button>
      </div>
    </div>
  );
};
