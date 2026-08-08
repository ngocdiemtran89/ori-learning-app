import React, { useEffect, useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  Volume2,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { VocabularyDeck, VocabularyItem, ReviewRating } from '../lib/supabase/types';
import {
  getVocabularyDeckBySlug,
  getVocabularyItems,
  getSavedWordIds,
  toggleSaveWord,
  recordVocabularyReview,
} from '../lib/supabase/vocabulary';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';

export const VocabularyDeckPage: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { user } = useAuth();

  const [deck, setDeck] = useState<VocabularyDeck | null>(null);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastReviewFeedback, setLastReviewFeedback] = useState<string | null>(null);

  useEffect(() => {
    async function loadDeckData() {
      if (!deckId) return;

      const deckData = await getVocabularyDeckBySlug(deckId);
      setDeck(deckData);

      if (deckData) {
        const itemData = await getVocabularyItems(deckData.id);
        setItems(itemData);
      }

      if (user?.id) {
        const saved = await getSavedWordIds(user.id);
        setSavedSet(saved);
      }

      setLoading(false);
    }
    loadDeckData();
  }, [deckId, user]);

  const currentItem = items[currentIndex];
  const isSaved = currentItem ? savedSet.has(currentItem.id) : false;

  const playAudio = (wordText: string, audioUrl?: string | null) => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => playSpeechSynthesis(wordText));
    } else {
      playSpeechSynthesis(wordText);
    }
  };

  const playSpeechSynthesis = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleToggleSave = async () => {
    if (!user?.id || !currentItem) return;
    const res = await toggleSaveWord(user.id, currentItem.id);
    if (res.success) {
      const newSet = new Set(savedSet);
      if (res.isSaved) {
        newSet.add(currentItem.id);
      } else {
        newSet.delete(currentItem.id);
      }
      setSavedSet(newSet);
    }
  };

  const handleRating = async (rating: ReviewRating) => {
    if (!user?.id || !currentItem) return;

    const nextState = await recordVocabularyReview(user.id, currentItem.id, rating);
    if (nextState) {
      const labels = {
        again: 'Ôn lại ngay hôm nay',
        hard: `Đã lưu (ôn lại sau ${nextState.interval_days} ngày)`,
        good: `Tốt (ôn lại sau ${nextState.interval_days} ngày)`,
        easy: `Dễ (ôn lại sau ${nextState.interval_days} ngày)`,
      };
      setLastReviewFeedback(`Đã chấm: ${labels[rating]}`);
      setTimeout(() => setLastReviewFeedback(null), 3000);
    }

    // Auto advance to next card
    if (currentIndex < items.length - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  if (loading) {
    return <LoadingState message="Đang tải thẻ Flashcards từ Supabase..." />;
  }

  if (!deck || items.length === 0) {
    return (
      <div className="space-y-6">
        <NavLink
          to="/vocabulary"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách Deck
        </NavLink>
        <EmptyState
          title="Không tìm thấy thẻ từ vựng"
          description="Bộ từ vựng này hiện chưa có thẻ hoặc bạn chưa được cấp quyền đọc."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/vocabulary"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Danh sách Decks
        </NavLink>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-sky-50 text-ori-600 text-xs font-bold rounded-full uppercase">
            {deck.title}
          </span>
        </div>
      </div>

      {/* Progress & Card Position Indicator */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
        <span>
          Thẻ {currentIndex + 1} / {items.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSave}
            className={`p-2 rounded-full transition-colors ${
              isSaved
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-slate-100 text-slate-400 hover:text-slate-600'
            }`}
            title={isSaved ? 'Đã lưu vào từ khó' : 'Lưu từ khó'}
          >
            {isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Interactive 3D Flip Flashcard */}
      <div className="perspective-1000 min-h-[320px]">
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className={`w-full min-h-[320px] bg-white rounded-3xl border-2 p-8 shadow-xl cursor-pointer transition-all duration-300 flex flex-col justify-between ${
            isFlipped
              ? 'border-indigo-400 bg-gradient-to-b from-white to-indigo-50/30'
              : 'border-slate-200 hover:border-ori-400'
          }`}
        >
          {/* FRONT SIDE */}
          {!isFlipped ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 my-auto">
              <span className="px-3 py-1 bg-sky-50 text-ori-600 rounded-full text-xs font-bold uppercase tracking-wider">
                {currentItem.part_of_speech || 'noun'}
              </span>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                {currentItem.word}
              </h2>

              {currentItem.ipa && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    playAudio(currentItem.word, currentItem.audio_url);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-ori-50 text-slate-600 hover:text-ori-600 rounded-full text-sm font-semibold transition-colors cursor-pointer"
                  title="Bấm để nghe phát âm"
                >
                  <span>{currentItem.ipa}</span>
                  <Volume2 className="w-4 h-4 text-ori-600" />
                </div>
              )}

              <p className="text-xs text-slate-400 font-semibold pt-4 flex items-center gap-1">
                <RotateCw className="w-3.5 h-3.5" /> Chạm / Click thẻ để xem nghĩa & ví dụ
              </p>
            </div>
          ) : (
            /* BACK SIDE */
            <div className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-indigo-600 uppercase">
                    {currentItem.word} ({currentItem.part_of_speech})
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playAudio(currentItem.word, currentItem.audio_url);
                    }}
                    className="p-1.5 text-ori-600 hover:bg-sky-50 rounded-full"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Nghĩa tiếng Việt
                  </div>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">
                    {currentItem.meaning_vi}
                  </div>
                </div>

                {currentItem.example_en && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                    <div className="font-bold text-slate-700">Ví dụ minh họa:</div>
                    <p className="text-slate-800 italic">"{currentItem.example_en}"</p>
                    {currentItem.example_vi && (
                      <p className="text-slate-500">→ {currentItem.example_vi}</p>
                    )}
                  </div>
                )}

                {currentItem.collocations && currentItem.collocations.length > 0 && (
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-slate-500">Cụm từ thường gặp (Collocations):</div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentItem.collocations.map((col, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-sky-50 text-ori-700 font-semibold rounded text-[11px]"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SRS Rating Bar & Navigation (Thumb-friendly) */}
      <div className="space-y-3">
        {lastReviewFeedback && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {lastReviewFeedback}
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => handleRating('again')}
            className="py-3 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold rounded-xl border border-rose-200 transition-all active:scale-95 text-center"
          >
            Again
            <span className="block text-[10px] font-semibold text-rose-500">Hôm nay</span>
          </button>

          <button
            onClick={() => handleRating('hard')}
            className="py-3 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-extrabold rounded-xl border border-amber-200 transition-all active:scale-95 text-center"
          >
            Hard
            <span className="block text-[10px] font-semibold text-amber-500">1 ngày</span>
          </button>

          <button
            onClick={() => handleRating('good')}
            className="py-3 px-2 bg-sky-50 hover:bg-sky-100 text-ori-700 text-xs font-extrabold rounded-xl border border-sky-200 transition-all active:scale-95 text-center"
          >
            Good
            <span className="block text-[10px] font-semibold text-ori-500">3 ngày</span>
          </button>

          <button
            onClick={() => handleRating('easy')}
            className="py-3 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-extrabold rounded-xl border border-emerald-200 transition-all active:scale-95 text-center"
          >
            Easy
            <span className="block text-[10px] font-semibold text-emerald-500">7 ngày</span>
          </button>
        </div>

        {/* Prev / Next Navigation Controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 disabled:opacity-40 flex items-center gap-1.5 hover:bg-slate-50"
          >
            <ChevronLeft className="w-4 h-4" /> Thẻ trước
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === items.length - 1}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 disabled:opacity-40 flex items-center gap-1.5 hover:bg-slate-50"
          >
            Thẻ tiếp <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
