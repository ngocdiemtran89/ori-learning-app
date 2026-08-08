import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import { ArrowLeft, BookOpen, Save, Eye, Volume2, AlertTriangle } from 'lucide-react';
import { LoadingState } from '../components/ui/LoadingState';
import {
  getAdminVocabularyItem,
  getAdminVocabularyDeck,
  createVocabularyItem,
  updateVocabularyItem,
} from '../lib/supabase/adminVocabulary';
import {
  validateVocabularyItemInput,
  parseCollocations,
  normalizeToeicParts,
} from '../lib/cms/vocabularyValidation';
import { VocabularyItem, VocabularyDeck } from '../lib/supabase/types';
import { VocabularyPreviewModal } from '../components/admin/VocabularyPreviewModal';

export const AdminVocabularyItemEditPage: React.FC = () => {
  const { deckId: paramDeckId, wordId } = useParams<{ deckId?: string; wordId?: string }>();
  const navigate = useNavigate();

  const isEditing = Boolean(wordId && wordId !== 'new');

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [targetDeckId, setTargetDeckId] = useState<string>(paramDeckId || '');
  const [deckInfo, setDeckInfo] = useState<VocabularyDeck | null>(null);

  // Form State
  const [word, setWord] = useState<string>('');
  const [ipa, setIpa] = useState<string>('');
  const [partOfSpeech, setPartOfSpeech] = useState<string>('noun');
  const [meaningVi, setMeaningVi] = useState<string>('');
  const [exampleEn, setExampleEn] = useState<string>('');
  const [exampleVi, setExampleVi] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [selectedToeicParts, setSelectedToeicParts] = useState<string[]>([]);
  const [collocationsText, setCollocationsText] = useState<string>('');
  const [commonMistake, setCommonMistake] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isPublished, setIsPublished] = useState<boolean>(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Live Preview Modal state
  const [showPreview, setShowPreview] = useState<boolean>(false);

  useEffect(() => {
    async function loadForm() {
      setLoading(true);

      if (isEditing && wordId) {
        const res = await getAdminVocabularyItem(wordId);
        if (res.error || !res.data) {
          setFormError(res.error || 'Không tìm thấy thông tin từ vựng.');
        } else {
          const w = res.data;
          setTargetDeckId(w.deck_id);
          setWord(w.word);
          setIpa(w.ipa || '');
          setPartOfSpeech(w.part_of_speech || 'noun');
          setMeaningVi(w.meaning_vi);
          setExampleEn(w.example_en || '');
          setExampleVi(w.example_vi || '');
          setTopic(w.topic || '');
          setSelectedToeicParts(w.toeic_parts || []);
          setCollocationsText((w.collocations || []).join('\n'));
          setCommonMistake(w.common_mistake || '');
          setAudioUrl(w.audio_url || '');
          setSortOrder(w.sort_order || 1);
          setIsPublished(w.is_published);

          // fetch deck info
          const deckRes = await getAdminVocabularyDeck(w.deck_id);
          if (deckRes.data) setDeckInfo(deckRes.data);
        }
      } else if (paramDeckId) {
        setTargetDeckId(paramDeckId);
        const deckRes = await getAdminVocabularyDeck(paramDeckId);
        if (deckRes.data) setDeckInfo(deckRes.data);
      }

      setLoading(false);
    }
    loadForm();
  }, [isEditing, wordId, paramDeckId]);

  const handleToeicPartToggle = (partKey: string) => {
    if (selectedToeicParts.includes(partKey)) {
      setSelectedToeicParts(selectedToeicParts.filter((p) => p !== partKey));
    } else {
      setSelectedToeicParts([...selectedToeicParts, partKey]);
    }
  };

  const handlePlayAudioTest = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => alert('Không thể phát file âm thanh URL này.'));
    } else if (word && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateVocabularyItemInput({
      word,
      meaning_vi: meaningVi,
      deck_id: targetDeckId,
      sort_order: sortOrder,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSaving(true);

    const collocations = parseCollocations(collocationsText);
    const toeic_parts = normalizeToeicParts(selectedToeicParts);

    if (isEditing && wordId) {
      const res = await updateVocabularyItem(wordId, {
        deck_id: targetDeckId,
        word,
        ipa,
        part_of_speech: partOfSpeech,
        meaning_vi: meaningVi,
        example_en: exampleEn,
        example_vi: exampleVi,
        topic,
        toeic_parts,
        collocations,
        common_mistake: commonMistake,
        audio_url: audioUrl,
        sort_order: sortOrder,
        is_published: isPublished,
      });

      if (res.error) {
        setFormError(res.error);
        setSaving(false);
      } else {
        navigate(`/admin/content/vocabulary/decks/${targetDeckId}`);
      }
    } else {
      const res = await createVocabularyItem({
        deck_id: targetDeckId,
        word,
        ipa,
        part_of_speech: partOfSpeech,
        meaning_vi: meaningVi,
        example_en: exampleEn,
        example_vi: exampleVi,
        topic,
        toeic_parts,
        collocations,
        common_mistake: commonMistake,
        audio_url: audioUrl,
        sort_order: sortOrder,
        is_published: isPublished,
      });

      if (res.error) {
        setFormError(res.error);
        setSaving(false);
      } else {
        navigate(`/admin/content/vocabulary/decks/${targetDeckId}`);
      }
    }
  };

  if (loading) {
    return <LoadingState message="Đang tải thông tin từ vựng..." />;
  }

  const previewObject: Partial<VocabularyItem> = {
    word,
    ipa,
    part_of_speech: partOfSpeech,
    meaning_vi: meaningVi,
    example_en: exampleEn,
    example_vi: exampleVi,
    collocations: parseCollocations(collocationsText),
    common_mistake: commonMistake,
    audio_url: audioUrl,
  };

  const toeicPartOptions = [
    { key: 'part1', label: 'Part 1' },
    { key: 'part2', label: 'Part 2' },
    { key: 'part3', label: 'Part 3' },
    { key: 'part4', label: 'Part 4' },
    { key: 'part5', label: 'Part 5' },
    { key: 'part6', label: 'Part 6' },
    { key: 'part7', label: 'Part 7' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <NavLink
          to={`/admin/content/vocabulary/decks/${targetDeckId}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Bộ Từ ({deckInfo?.title || 'Deck'})
        </NavLink>

        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <Eye className="w-4 h-4" /> Xem Trước Thẻ Flashcard
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            {isEditing ? 'Chỉnh Sửa Từ Vựng' : 'Thêm Từ Vựng Mới'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Bộ từ: <strong className="text-slate-800">{deckInfo?.title}</strong>
          </p>
        </div>

        {formError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Word & Meaning Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                Từ Vựng Tiếng Anh (Word) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: appointment"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              {errors.word && <p className="text-[11px] font-bold text-rose-500">{errors.word}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                Nghĩa Tiếng Việt (Meaning VI) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: cuộc hẹn, sự bổ nhiệm"
                value={meaningVi}
                onChange={(e) => setMeaningVi(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              {errors.meaning_vi && <p className="text-[11px] font-bold text-rose-500">{errors.meaning_vi}</p>}
            </div>
          </div>

          {/* IPA & Part of Speech */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                Phiên Âm IPA
              </label>
              <input
                type="text"
                placeholder="VD: /əˈpɔɪnt.mənt/"
                value={ipa}
                onChange={(e) => setIpa(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                Từ Loại (Part of Speech)
              </label>
              <select
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                <option value="noun">Danh từ (noun)</option>
                <option value="verb">Động từ (verb)</option>
                <option value="adjective">Tính từ (adjective)</option>
                <option value="adverb">Phó từ (adverb)</option>
                <option value="phrase">Cụm từ (phrase)</option>
                <option value="preposition">Giới từ (preposition)</option>
                <option value="conjunction">Liên từ (conjunction)</option>
              </select>
            </div>
          </div>

          {/* Example EN & VI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                Ví Dụ Tiếng Anh (Example EN)
              </label>
              <textarea
                rows={2}
                placeholder="VD: I made an appointment with the doctor."
                value={exampleEn}
                onChange={(e) => setExampleEn(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                Dịch Ví Dụ (Example VI)
              </label>
              <textarea
                rows={2}
                placeholder="VD: Tôi đã hẹn gặp bác sĩ."
                value={exampleVi}
                onChange={(e) => setExampleVi(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          {/* Collocations */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 block">
              Cụm Từ Thường Gặp (Collocations) - <span className="text-slate-400 font-normal">Nhập mỗi cụm 1 dòng</span>
            </label>
            <textarea
              rows={3}
              placeholder="VD:&#10;make an appointment&#10;schedule an appointment&#10;cancel an appointment"
              value={collocationsText}
              onChange={(e) => setCollocationsText(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
            />
          </div>

          {/* TOEIC Parts Controlled Checkboxes */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 block">
              Phần Thi TOEIC Thường Gặp (TOEIC Parts)
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {toeicPartOptions.map((part) => {
                const isSelected = selectedToeicParts.includes(part.key);
                return (
                  <button
                    key={part.key}
                    type="button"
                    onClick={() => handleToeicPartToggle(part.key)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {part.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Common Mistake & Topic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                Lỗi Thường Gặp (Common Mistake)
              </label>
              <input
                type="text"
                placeholder="VD: Nhầm lẫn với 'assignation'"
                value={commonMistake}
                onChange={(e) => setCommonMistake(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                Chủ Đề (Topic)
              </label>
              <input
                type="text"
                placeholder="VD: Business, Medical, Office"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          {/* Audio URL & Sort Order */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                URL Âm Thanh (Audio URL)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://..."
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                />
                <button
                  type="button"
                  onClick={handlePlayAudioTest}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <Volume2 className="w-4 h-4 text-indigo-600" /> Nghe Thử
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                Thứ Tự (Sort Order) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              {errors.sort_order && <p className="text-[11px] font-bold text-rose-500">{errors.sort_order}</p>}
            </div>
          </div>

          {/* Publish Checkbox */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold text-slate-900 block">Xuất Bản Từ Vựng (Publish Status)</span>
              <p className="text-[11px] text-slate-500 font-medium">
                Từ vựng chỉ xuất hiện trong ứng dụng của học viên khi được Đã xuất bản.
              </p>
            </div>
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="w-5 h-5 accent-indigo-600 cursor-pointer rounded"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <NavLink
              to={`/admin/content/vocabulary/decks/${targetDeckId}`}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              Hủy Trỏ Về
            </NavLink>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : isEditing ? 'Lưu Thay Đổi' : 'Lưu Bản Nháp'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Live Preview Modal */}
      {showPreview && (
        <VocabularyPreviewModal
          item={previewObject}
          deckTitle={deckInfo?.title}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};
