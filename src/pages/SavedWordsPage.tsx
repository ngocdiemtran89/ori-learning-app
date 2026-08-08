import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Bookmark, Volume2, Trash2, BookOpen, RotateCw, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { VocabularyItem } from '../lib/supabase/types';
import { supabase } from '../lib/supabase/client';
import { toggleSaveWord } from '../lib/supabase/vocabulary';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';

export const SavedWordsPage: React.FC = () => {
  const { user } = useAuth();
  const [savedItems, setSavedItems] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [flippedMap, setFlippedMap] = useState<Record<string, boolean>>({});

  const loadSavedWords = async () => {
    if (!user?.id) return;

    setLoading(true);
    const { data: savedRows, error: savedErr } = await supabase
      .from('saved_words')
      .select('vocabulary_id')
      .eq('user_id', user.id);

    if (savedErr || !savedRows || savedRows.length === 0) {
      setSavedItems([]);
      setLoading(false);
      return;
    }

    const vocabIds = savedRows.map((r) => r.vocabulary_id);

    const { data: items, error: itemErr } = await supabase
      .from('vocabulary_items')
      .select('*')
      .in('id', vocabIds);

    if (!itemErr && items) {
      setSavedItems(items as VocabularyItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSavedWords();
  }, [user]);

  const handleUnsave = async (itemId: string) => {
    if (!user?.id) return;
    await toggleSaveWord(user.id, itemId);
    setSavedItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const playAudio = (wordText: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(wordText);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleFlip = (itemId: string) => {
    setFlippedMap((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <NavLink
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Tổng quan
        </NavLink>
        <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-extrabold rounded-full flex items-center gap-1">
          <Bookmark className="w-3.5 h-3.5 fill-current" /> Sổ Tay Từ Khó ({savedItems.length} từ)
        </span>
      </div>

      <PageHeader
        title="Sổ Tay Từ Khó Đã Lưu (Saved Words)"
        subtitle="Danh sách các từ vựng bạn đã bookmark để ôn lại mọi lúc."
      />

      {loading ? (
        <LoadingState message="Đang tải danh sách từ vựng đã lưu từ Supabase..." />
      ) : savedItems.length === 0 ? (
        <EmptyState
          title="Chưa có từ nào trong Sổ tay từ khó"
          description="Khi học Flashcards từ vựng, bấm biểu tượng Bookmark để lưu những từ cần ôn tập thêm vào đây nhé!"
          icon={Bookmark}
          action={
            <NavLink
              to="/vocabulary"
              className="px-4 py-2.5 bg-ori-600 text-white font-bold text-xs rounded-xl shadow-md inline-flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Học Từ Vựng Ngay</span>
            </NavLink>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedItems.map((item) => {
            const isFlipped = !!flippedMap[item.id];

            return (
              <div
                key={item.id}
                onClick={() => toggleFlip(item.id)}
                className={`bg-white rounded-2xl p-5 border-2 cursor-pointer transition-all duration-300 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md ${
                  isFlipped ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200 hover:border-ori-400'
                }`}
              >
                {!isFlipped ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 bg-sky-50 text-ori-600 text-[10px] font-extrabold uppercase rounded-full">
                        {item.part_of_speech || 'word'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnsave(item.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Bỏ lưu khỏi sổ tay"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-center py-2">
                      <h3 className="text-2xl font-extrabold text-slate-900">{item.word}</h3>
                      {item.ipa && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playAudio(item.word);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-ori-600 font-semibold mt-1"
                        >
                          <span>{item.ipa}</span>
                          <Volume2 className="w-3.5 h-3.5 text-ori-600" />
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 font-semibold text-center flex items-center justify-center gap-1 pt-2 border-t border-slate-100">
                      <RotateCw className="w-3 h-3" /> Click để xem nghĩa & ví dụ
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-extrabold text-amber-700 uppercase">
                        {item.word} ({item.part_of_speech})
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnsave(item.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title="Bỏ lưu khỏi sổ tay"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Nghĩa tiếng Việt</div>
                      <div className="text-sm font-extrabold text-slate-900 mt-0.5">{item.meaning_vi}</div>
                    </div>

                    {item.example_en && (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                        <strong className="text-slate-700">Ví dụ:</strong> "{item.example_en}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
