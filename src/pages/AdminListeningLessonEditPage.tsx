import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  Volume2,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import { LoadingState } from '../components/ui/LoadingState';
import {
  getAdminListeningLesson,
  getAdminListeningQuestions,
  createListeningLesson,
  updateListeningLesson,
  saveListeningQuestion,
} from '../lib/supabase/adminListening';
import {
  validateListeningLessonDraft,
  validateListeningLessonForPublish,
  expectedOptionCountForToeicPart,
  ListeningQuestionInput,
} from '../lib/cms/listeningValidation';
import { slugifyTitle } from '../lib/cms/vocabularyValidation';
import { LearningLesson } from '../lib/supabase/types';
import { ListeningPreviewModal } from '../components/admin/ListeningPreviewModal';

export const AdminListeningLessonEditPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(lessonId && lessonId !== 'new');

  const [loading, setLoading] = useState<boolean>(isEditing);
  const [saving, setSaving] = useState<boolean>(false);
  const [originalLesson, setOriginalLesson] = useState<LearningLesson | null>(null);

  // Metadata Form State
  const [title, setTitle] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [level, setLevel] = useState<string>('foundation');
  const [toeicPart, setToeicPart] = useState<string>('part1');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [audioTestErr, setAudioTestErr] = useState<string | null>(null);

  // Questions State
  const [questions, setQuestions] = useState<
    Array<{
      id?: string;
      question_text: string;
      options: string[];
      correct_answer: string;
      explanation: string;
      skill_tag: string;
      topic: string;
      image_url: string;
      is_active: boolean;
      isNewDraft?: boolean;
    }>
  >([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);

  useEffect(() => {
    if (isEditing && lessonId) {
      async function loadLesson() {
        setLoading(true);
        const res = await getAdminListeningLesson(lessonId!);
        if (res.error || !res.data) {
          setFormError(res.error || 'Không tìm thấy bài học Listening.');
        } else {
          const l = res.data;
          setOriginalLesson(l);
          setTitle(l.title);
          setSlug(l.slug);
          setLevel(l.level || 'foundation');
          setToeicPart(l.toeic_part || 'part1');
          setAudioUrl(l.audio_url || '');
          setTranscript(l.transcript || '');
          setSortOrder(l.sort_order || 1);
          setIsPublished(l.is_published);

          const qRes = await getAdminListeningQuestions(l.id);
          const qList = (qRes.data || []).map((q) => {
            const opts = Array.isArray(q.options)
              ? q.options
              : typeof q.options === 'object' && q.options !== null
              ? Object.values(q.options)
              : [];
            return {
              id: q.id,
              question_text: q.question_text || '',
              options: opts,
              correct_answer: q.correct_answer || '',
              explanation: q.explanation || '',
              skill_tag: q.skill_tag || '',
              topic: q.topic || '',
              image_url: q.image_url || '',
              is_active: q.is_active ?? true,
              isNewDraft: false,
            };
          });
          setQuestions(qList);
        }
        setLoading(false);
      }
      loadLesson();
    }
  }, [isEditing, lessonId]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isEditing || !slug) {
      setSlug(slugifyTitle(val));
    }
  };

  const handlePlayAudioTest = () => {
    setAudioTestErr(null);
    if (!audioUrl || !audioUrl.trim()) {
      setAudioTestErr('Chưa nhập URL âm thanh.');
      return;
    }
    const audio = new Audio(audioUrl.trim());
    audio.play().catch(() => {
      setAudioTestErr('Không thể phát audio từ URL này.');
    });
  };

  const expectedOptionsCount = expectedOptionCountForToeicPart(toeicPart);

  // Add Question
  const handleAddQuestion = () => {
    const defaultOptions = Array(expectedOptionsCount).fill('');
    setQuestions((prev) => [
      ...prev,
      {
        question_text: '',
        options: defaultOptions,
        correct_answer: '',
        explanation: '',
        skill_tag: '',
        topic: '',
        image_url: '',
        is_active: true,
        isNewDraft: true,
      },
    ]);
  };

  const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && idx === 0) ||
      (direction === 'down' && idx === questions.length - 1)
    )
      return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newQuestions = [...questions];
    const temp = newQuestions[idx];
    newQuestions[idx] = newQuestions[targetIdx];
    newQuestions[targetIdx] = temp;
    setQuestions(newQuestions);
  };

  const handleToggleQuestionActive = (idx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, is_active: !q.is_active } : q))
    );
  };

  const handleRemoveNewDraftQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cmsQuestions: ListeningQuestionInput[] = questions.map((q, idx) => ({
      id: q.id,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      skill_tag: q.skill_tag,
      topic: q.topic,
      image_url: q.image_url,
      sort_order: idx,
      is_active: q.is_active,
    }));

    const payloadInput = {
      title,
      slug,
      level,
      toeic_part: toeicPart,
      audio_url: audioUrl,
      transcript,
      sort_order: sortOrder,
      questions: cmsQuestions,
    };

    if (isPublished) {
      const pubValidation = validateListeningLessonForPublish(payloadInput);
      if (!pubValidation.canPublish) {
        setErrors(pubValidation.errors);
        const firstErrKey = Object.keys(pubValidation.errors)[0];
        setFormError(pubValidation.errors[firstErrKey]);
        return;
      }
    } else {
      const draftValidation = validateListeningLessonDraft(payloadInput);
      if (!draftValidation.isValid) {
        setErrors(draftValidation.errors);
        return;
      }
    }

    setErrors({});
    setSaving(true);

    let activeLessonId = lessonId;

    if (isEditing && lessonId) {
      const res = await updateListeningLesson(lessonId, {
        title,
        slug,
        level,
        toeic_part: toeicPart,
        audio_url: audioUrl,
        transcript,
        sort_order: sortOrder,
        is_published: isPublished,
      });

      if (res.error) {
        setFormError(res.error);
        setSaving(false);
        return;
      }
    } else {
      const res = await createListeningLesson({
        title,
        slug,
        level,
        toeic_part: toeicPart,
        audio_url: audioUrl,
        transcript,
        sort_order: sortOrder,
        is_published: isPublished,
      });

      if (res.error || !res.data) {
        setFormError(res.error || 'Không thể tạo bài Listening.');
        setSaving(false);
        return;
      }
      activeLessonId = res.data.id;
    }

    // Save Questions with stable UUIDs & ordering
    if (activeLessonId) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await saveListeningQuestion(activeLessonId, toeicPart, isPublished, {
          id: q.id,
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          skill_tag: q.skill_tag,
          topic: q.topic,
          image_url: q.image_url,
          sort_order: i,
          is_active: q.is_active,
        });
      }
    }

    navigate('/admin/content/listening');
  };

  if (loading) {
    return <LoadingState message="Đang tải bài học Listening..." />;
  }

  const isSlugChangedOnPublished =
    isEditing && originalLesson?.is_published && slug !== originalLesson.slug;

  const previewQuestions: ListeningQuestionInput[] = questions.map((q, idx) => ({
    id: q.id,
    question_text: q.question_text,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    sort_order: idx,
    is_active: q.is_active,
    skill_tag: q.skill_tag,
    topic: q.topic,
    image_url: q.image_url,
  }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/admin/content/listening"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Danh sách Listening
        </NavLink>

        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <Eye className="w-4 h-4" /> Xem Trước Bài Giảng
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-purple-600" />
            {isEditing ? 'Chỉnh Sửa Bài Luyện Nghe (Listening)' : 'Tạo Bài Luyện Nghe Mới'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isEditing ? `Chỉnh sửa: ${originalLesson?.title}` : 'Soạn bài nghe, audio URL, transcript và câu hỏi trắc nghiệm.'}
          </p>
        </div>

        {formError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {isSlugChangedOnPublished && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-2xl space-y-1">
            <div className="flex items-center gap-2 font-extrabold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>CẢNH BÁO THAY ĐỔI SLUG BÀI HỌC ĐÃ XUẤT BẢN</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Bài nghe này đã xuất bản. Đổi Slug có thể làm hỏng bookmark đường dẫn của học viên.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECTION 1: METADATA */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
              1. Thông Tin Bài Nghe (Metadata)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Tên Bài Học (Title) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Listening Part 2 — Question & Response #1"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-600"
                />
                {errors.title && <p className="text-[11px] font-bold text-rose-500">{errors.title}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Slug URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: listening-part2-foundation-1"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-600"
                />
                {errors.slug && <p className="text-[11px] font-bold text-rose-500">{errors.slug}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Trình Độ (Level) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-600"
                >
                  <option value="foundation">Foundation (Cơ bản)</option>
                  <option value="intermediate">Intermediate (Trung cấp)</option>
                  <option value="advanced">Advanced (Nâng cao)</option>
                </select>
                {errors.level && <p className="text-[11px] font-bold text-rose-500">{errors.level}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  TOEIC Part <span className="text-rose-500">*</span>
                </label>
                <select
                  value={toeicPart}
                  onChange={(e) => setToeicPart(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-600"
                >
                  <option value="part1">Part 1 (Photos - 4 Lựa chọn)</option>
                  <option value="part2">Part 2 (Question-Response - 3 Lựa chọn)</option>
                  <option value="part3">Part 3 (Conversations - 4 Lựa chọn)</option>
                  <option value="part4">Part 4 (Talks - 4 Lựa chọn)</option>
                </select>
                {errors.toeic_part && <p className="text-[11px] font-bold text-rose-500">{errors.toeic_part}</p>}
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-600"
                />
                {errors.sort_order && <p className="text-[11px] font-bold text-rose-500">{errors.sort_order}</p>}
              </div>
            </div>

            {/* Audio URL Input with Test Playback Button */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Audio URL (MP3/Sound Link) {isPublished && <span className="text-rose-500">*</span>}
                </label>
                <button
                  type="button"
                  onClick={handlePlayAudioTest}
                  className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-[11px] rounded-lg border border-purple-200 flex items-center gap-1 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Nghe Thử Audio
                </button>
              </div>
              <input
                type="url"
                placeholder="https://domain.com/audio/listening-1.mp3"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-600"
              />
              {errors.audio_url && <p className="text-[11px] font-bold text-rose-500">{errors.audio_url}</p>}
              {audioTestErr && <p className="text-[11px] font-bold text-rose-500">{audioTestErr}</p>}
            </div>

            {/* Transcript Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                Transcript (Lời thoại âm thanh)
              </label>
              <textarea
                rows={4}
                placeholder="Nhập toàn bộ transcript bài nghe tại đây..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-600"
              />
            </div>
          </div>

          {/* SECTION 2: QUESTIONS BUILDER */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-purple-600" /> 2. Câu Hỏi Trắc Nghiệm ({questions.length} câu)
              </h3>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs rounded-xl flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" /> Thêm Câu Hỏi Listening
              </button>
            </div>

            {errors.questions && <p className="text-xs font-bold text-rose-500">{errors.questions}</p>}

            {questions.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium">
                Chưa có câu hỏi trắc nghiệm nào. Bấm "+ Thêm Câu Hỏi Listening" để bắt đầu.
              </div>
            ) : (
              questions.map((q, qIdx) => (
                <div
                  key={q.id || `draft-q-${qIdx}`}
                  className={`p-5 rounded-2xl border transition-all space-y-3 ${
                    q.is_active
                      ? 'bg-white border-slate-200 shadow-sm'
                      : 'bg-amber-50/30 border-amber-200 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-purple-700">Câu Hỏi {qIdx + 1}</span>
                      {q.id && <span className="font-mono text-[10px] text-slate-400">({q.id})</span>}
                      {!q.is_active && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase rounded-md border border-amber-300">
                          ĐÃ ẨN
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={qIdx === 0}
                        onClick={() => handleMoveQuestion(qIdx, 'up')}
                        className="p-1 bg-slate-50 hover:bg-slate-200 disabled:opacity-30 rounded-lg border border-slate-200 text-slate-600"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={qIdx === questions.length - 1}
                        onClick={() => handleMoveQuestion(qIdx, 'down')}
                        className="p-1 bg-slate-50 hover:bg-slate-200 disabled:opacity-30 rounded-lg border border-slate-200 text-slate-600"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleQuestionActive(qIdx)}
                        className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg border ml-2 ${
                          q.is_active
                            ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {q.is_active ? 'Ẩn câu hỏi' : 'Hiện lại'}
                      </button>

                      {q.isNewDraft && (
                        <button
                          type="button"
                          onClick={() => handleRemoveNewDraftQuestion(qIdx)}
                          className="p-1 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 text-rose-600 ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Part 1 Image URL Field */}
                  {toeicPart === 'part1' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-slate-700 block">
                        Hình ảnh TOEIC Part 1 (Image URL) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://example.com/part1-photo.jpg"
                        value={q.image_url}
                        onChange={(e) =>
                          setQuestions(
                            questions.map((item, i) => (i === qIdx ? { ...item, image_url: e.target.value } : item))
                          )
                        }
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-600"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 block">Nội dung câu hỏi</label>
                    <input
                      type="text"
                      placeholder="VD: Where is the conference taking place?"
                      value={q.question_text}
                      onChange={(e) =>
                        setQuestions(
                          questions.map((item, i) => (i === qIdx ? { ...item, question_text: e.target.value } : item))
                        )
                      }
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-600"
                    />
                  </div>

                  {/* Options inputs (3 for Part 2; 4 for Parts 1, 3, 4) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from({ length: expectedOptionsCount }).map((_, optIdx) => (
                      <div key={optIdx} className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block uppercase">
                          Lựa chọn {String.fromCharCode(65 + optIdx)}
                        </label>
                        <input
                          type="text"
                          placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                          value={q.options[optIdx] || ''}
                          onChange={(e) => {
                            const newOpts = [...q.options];
                            newOpts[optIdx] = e.target.value;
                            setQuestions(
                              questions.map((item, i) => (i === qIdx ? { ...item, options: newOpts } : item))
                            );
                          }}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-600"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Correct Answer & Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-slate-700 block">Đáp án đúng</label>
                      <select
                        value={q.correct_answer}
                        onChange={(e) =>
                          setQuestions(
                            questions.map((item, i) => (i === qIdx ? { ...item, correct_answer: e.target.value } : item))
                          )
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-600"
                      >
                        <option value="">-- Chọn đáp án đúng --</option>
                        {q.options.map(
                          (opt, idx) =>
                            opt.trim() && (
                              <option key={idx} value={opt.trim()}>
                                {opt.trim()}
                              </option>
                            )
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-slate-700 block">Kỹ năng (Skill Tag)</label>
                      <input
                        type="text"
                        placeholder="VD: Location & Directions"
                        value={q.skill_tag}
                        onChange={(e) =>
                          setQuestions(
                            questions.map((item, i) => (i === qIdx ? { ...item, skill_tag: e.target.value } : item))
                          )
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-slate-700 block">Chủ đề (Topic)</label>
                      <input
                        type="text"
                        placeholder="VD: Office Life"
                        value={q.topic}
                        onChange={(e) =>
                          setQuestions(
                            questions.map((item, i) => (i === qIdx ? { ...item, topic: e.target.value } : item))
                          )
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-slate-700 block">Giải thích đáp án</label>
                    <input
                      type="text"
                      placeholder="VD: Đáp án A đúng vì trong transcript người nói đề cập..."
                      value={q.explanation}
                      onChange={(e) =>
                        setQuestions(
                          questions.map((item, i) => (i === qIdx ? { ...item, explanation: e.target.value } : item))
                        )
                      }
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-600"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Publish Checkbox */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold text-slate-900 block">Xuất Bản Bài Học (Publish Status)</span>
              <p className="text-[11px] text-slate-500 font-medium">
                Nếu chọn Xuất bản, bài học và các câu hỏi active sẽ xuất hiện trên ứng dụng học viên.
              </p>
            </div>
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="w-5 h-5 accent-purple-600 cursor-pointer rounded"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <NavLink
              to="/admin/content/listening"
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              Hủy Trỏ Về
            </NavLink>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : isEditing ? 'Lưu Thay Đổi' : 'Lưu Bản Nháp'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Live Preview Modal */}
      {showPreview && (
        <ListeningPreviewModal
          title={title}
          level={level}
          toeic_part={toeicPart}
          audio_url={audioUrl}
          transcript={transcript}
          questions={previewQuestions}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};
