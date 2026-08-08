import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
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
  getAdminGrammarLesson,
  createGrammarLesson,
  updateGrammarLesson,
} from '../lib/supabase/adminGrammar';
import {
  validateGrammarLessonDraft,
  validateGrammarLessonForPublish,
  parseExamples,
  createNewQuestionKey,
  GrammarSectionInput,
  GrammarQuizQuestionInput,
} from '../lib/cms/grammarValidation';
import { slugifyTitle } from '../lib/cms/vocabularyValidation';
import { GrammarLesson } from '../lib/supabase/types';
import { GrammarPreviewModal } from '../components/admin/GrammarPreviewModal';

export const AdminGrammarLessonEditPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(lessonId && lessonId !== 'new');

  const [loading, setLoading] = useState<boolean>(isEditing);
  const [saving, setSaving] = useState<boolean>(false);
  const [originalLesson, setOriginalLesson] = useState<GrammarLesson | null>(null);

  // Metadata Form State
  const [title, setTitle] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [level, setLevel] = useState<string>('foundation');
  const [summary, setSummary] = useState<string>('');
  const [skillTag, setSkillTag] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isPublished, setIsPublished] = useState<boolean>(false);

  // Theory Sections State
  const [sections, setSections] = useState<
    Array<{ section_key: string; heading: string; body: string; examplesText: string }>
  >([]);

  // Quiz Questions State
  const [quiz, setQuiz] = useState<
    Array<{
      question_key: string;
      question: string;
      options: [string, string, string, string];
      answer: string;
      explanation: string;
      is_active: boolean;
      isNewDraft?: boolean;
    }>
  >([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Live Preview Modal state
  const [showPreview, setShowPreview] = useState<boolean>(false);

  useEffect(() => {
    if (isEditing && lessonId) {
      async function loadLesson() {
        setLoading(true);
        const res = await getAdminGrammarLesson(lessonId!);
        if (res.error || !res.data) {
          setFormError(res.error || 'Không tìm thấy bài học ngữ pháp.');
        } else {
          const l = res.data;
          setOriginalLesson(l);
          setTitle(l.title);
          setSlug(l.slug);
          setLevel(l.level || 'foundation');
          setSummary(l.summary || '');
          setSortOrder(l.sort_order || 1);
          setIsPublished(l.is_published);

          const content: any = l.lesson_content || {};
          setSkillTag(content.skill_tag || l.title);

          const secList = (content.sections || []).map((s: any, idx: number) => ({
            section_key: s.section_key || `sec-${idx + 1}-${Date.now()}`,
            heading: s.heading || '',
            body: s.body || '',
            examplesText: Array.isArray(s.examples) ? s.examples.join('\n') : '',
          }));
          setSections(secList);

          const quizList = (content.quiz || []).map((q: any) => ({
            question_key: q.question_key || createNewQuestionKey(),
            question: q.question || '',
            options: (q.options && q.options.length === 4 ? q.options : ['', '', '', '']) as [string, string, string, string],
            answer: q.answer || '',
            explanation: q.explanation || '',
            is_active: q.is_active ?? true,
            isNewDraft: false,
          }));
          setQuiz(quizList);
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
    if (!skillTag || !isEditing) {
      setSkillTag(val.trim());
    }
  };

  // Section handlers
  const handleAddSection = () => {
    setSections((prev) => [
      ...prev,
      {
        section_key: `sec-${prev.length + 1}-${Date.now()}`,
        heading: '',
        body: '',
        examplesText: '',
      },
    ]);
  };

  const handleRemoveSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMoveSection = (idx: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && idx === 0) ||
      (direction === 'down' && idx === sections.length - 1)
    )
      return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newSections = [...sections];
    const temp = newSections[idx];
    newSections[idx] = newSections[targetIdx];
    newSections[targetIdx] = temp;
    setSections(newSections);
  };

  // Quiz handlers
  const handleAddQuestion = () => {
    setQuiz((prev) => [
      ...prev,
      {
        question_key: createNewQuestionKey(),
        question: '',
        options: ['', '', '', ''],
        answer: '',
        explanation: '',
        is_active: true,
        isNewDraft: true,
      },
    ]);
  };

  const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && idx === 0) ||
      (direction === 'down' && idx === quiz.length - 1)
    )
      return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newQuiz = [...quiz];
    const temp = newQuiz[idx];
    newQuiz[idx] = newQuiz[targetIdx];
    newQuiz[targetIdx] = temp;
    setQuiz(newQuiz);
  };

  const handleToggleQuestionActive = (idx: number) => {
    setQuiz((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, is_active: !q.is_active } : q))
    );
  };

  const handleRemoveNewDraftQuestion = (idx: number) => {
    setQuiz((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cmsSections: GrammarSectionInput[] = sections.map((s) => ({
      section_key: s.section_key,
      heading: s.heading,
      body: s.body,
      examples: parseExamples(s.examplesText),
    }));

    const cmsQuiz: GrammarQuizQuestionInput[] = quiz.map((q) => ({
      question_key: q.question_key,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      is_active: q.is_active,
    }));

    const payloadInput = {
      title,
      slug,
      level,
      summary,
      skill_tag: skillTag,
      sort_order: sortOrder,
      sections: cmsSections,
      quiz: cmsQuiz,
    };

    if (isPublished) {
      const pubValidation = validateGrammarLessonForPublish(payloadInput);
      if (!pubValidation.canPublish) {
        setErrors(pubValidation.errors);
        const firstErrKey = Object.keys(pubValidation.errors)[0];
        setFormError(pubValidation.errors[firstErrKey]);
        return;
      }
    } else {
      const draftValidation = validateGrammarLessonDraft(payloadInput);
      if (!draftValidation.isValid) {
        setErrors(draftValidation.errors);
        return;
      }
    }

    setErrors({});
    setSaving(true);

    if (isEditing && lessonId) {
      const res = await updateGrammarLesson(lessonId, {
        title,
        slug,
        level,
        summary,
        skill_tag: skillTag,
        sort_order: sortOrder,
        is_published: isPublished,
        sections: cmsSections,
        quiz: cmsQuiz,
      });

      if (res.error) {
        setFormError(res.error);
        setSaving(false);
      } else {
        navigate('/admin/content/grammar');
      }
    } else {
      const res = await createGrammarLesson({
        title,
        slug,
        level,
        summary,
        skill_tag: skillTag,
        sort_order: sortOrder,
        is_published: isPublished,
        sections: cmsSections,
        quiz: cmsQuiz,
      });

      if (res.error) {
        setFormError(res.error);
        setSaving(false);
      } else {
        navigate('/admin/content/grammar');
      }
    }
  };

  if (loading) {
    return <LoadingState message="Đang tải bài học ngữ pháp..." />;
  }

  const isSlugChangedOnPublished =
    isEditing && originalLesson?.is_published && slug !== originalLesson.slug;

  const origContent: any = originalLesson?.lesson_content || {};
  const isSkillTagChangedOnPublished =
    isEditing &&
    originalLesson?.is_published &&
    skillTag !== (origContent.skill_tag || originalLesson.title);

  const previewSections: GrammarSectionInput[] = sections.map((s) => ({
    heading: s.heading,
    body: s.body,
    examples: parseExamples(s.examplesText),
  }));

  const previewQuiz: GrammarQuizQuestionInput[] = quiz.map((q) => ({
    question_key: q.question_key,
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    is_active: q.is_active,
  }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/admin/content/grammar"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Danh sách Ngữ Pháp
        </NavLink>

        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <Eye className="w-4 h-4" /> Xem Trước Bài Giảng
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            {isEditing ? 'Chỉnh Sửa Bài Học Ngữ Pháp' : 'Tạo Bài Học Ngữ Pháp Mới'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isEditing ? `Chỉnh sửa: ${originalLesson?.title}` : 'Soạn thảo nội dung lý thuyết và câu hỏi trắc nghiệm.'}
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
              Bài học này đã xuất bản. Đổi Slug có thể làm hỏng bookmark đường dẫn của học viên.
            </p>
          </div>
        )}

        {isSkillTagChangedOnPublished && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-2xl space-y-1">
            <div className="flex items-center gap-2 font-extrabold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>CẢNH BÁO THAY ĐỔI KỸ NĂNG PHÂN TÍCH (SKILL TAG)</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Thay đổi kỹ năng phân tích có thể làm dữ liệu tiến độ trước và sau của học viên được nhóm khác nhau.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECTION 1: METADATA */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
              1. Thông Tin Cơ Bản (Metadata)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Tên Bài Học (Title) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Present Simple — Thì Hiện Tại Đơn"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
                {errors.title && <p className="text-[11px] font-bold text-rose-500">{errors.title}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Slug URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: present-simple-foundation"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  <option value="foundation">Foundation (Cơ bản)</option>
                  <option value="intermediate">Intermediate (Trung cấp)</option>
                  <option value="advanced">Advanced (Nâng cao)</option>
                </select>
                {errors.level && <p className="text-[11px] font-bold text-rose-500">{errors.level}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Kỹ Năng Phân Tích (skill_tag) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Present Simple"
                  value={skillTag}
                  onChange={(e) => setSkillTag(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
                {errors.skill_tag && <p className="text-[11px] font-bold text-rose-500">{errors.skill_tag}</p>}
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

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                Tóm Tắt Ngắn (Summary)
              </label>
              <textarea
                rows={2}
                placeholder="Tóm tắt nội dung chính của bài học..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          {/* SECTION 2: THEORY SECTIONS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" /> 2. Phần Lý Thuyết ({sections.length} phần)
              </h3>
              <button
                type="button"
                onClick={handleAddSection}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" /> Thêm Phần Lý Thuyết
              </button>
            </div>

            {errors.sections && <p className="text-xs font-bold text-rose-500">{errors.sections}</p>}

            {sections.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium">
                Chưa có phần lý thuyết nào. Bấm "+ Thêm Phần Lý Thuyết" để bắt đầu.
              </div>
            ) : (
              sections.map((sec, sIdx) => (
                <div key={sec.section_key} className="p-5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3 relative">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-extrabold text-xs text-indigo-700">Phần Lý Thuyết {sIdx + 1}</span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={sIdx === 0}
                        onClick={() => handleMoveSection(sIdx, 'up')}
                        className="p-1 bg-white hover:bg-slate-200 disabled:opacity-30 rounded-lg border border-slate-200 text-slate-600"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={sIdx === sections.length - 1}
                        onClick={() => handleMoveSection(sIdx, 'down')}
                        className="p-1 bg-white hover:bg-slate-200 disabled:opacity-30 rounded-lg border border-slate-200 text-slate-600"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(sIdx)}
                        className="p-1 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 text-rose-600 ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 block">Tiêu đề (Heading)</label>
                    <input
                      type="text"
                      placeholder="VD: 1. Cách dùng thì Hiện Tại Đơn"
                      value={sec.heading}
                      onChange={(e) =>
                        setSections(sections.map((s, i) => (i === sIdx ? { ...s, heading: e.target.value } : s)))
                      }
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 block">Nội dung chi tiết (Body)</label>
                    <textarea
                      rows={3}
                      placeholder="Nhập nội dung giảng giải chi tiết..."
                      value={sec.body}
                      onChange={(e) =>
                        setSections(sections.map((s, i) => (i === sIdx ? { ...s, body: e.target.value } : s)))
                      }
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 block">
                      Ví dụ minh họa (Examples) - <span className="text-slate-400 font-normal">Nhập mỗi câu 1 dòng</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="VD:&#10;The office opens at 8 a.m.&#10;She works in customer service."
                      value={sec.examplesText}
                      onChange={(e) =>
                        setSections(sections.map((s, i) => (i === sIdx ? { ...s, examplesText: e.target.value } : s)))
                      }
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* SECTION 3: QUIZ QUESTIONS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-600" /> 3. Câu Hỏi Trắc Nghiệm ({quiz.length} câu)
              </h3>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" /> Thêm Câu Hỏi Quiz
              </button>
            </div>

            {errors.quiz && <p className="text-xs font-bold text-rose-500">{errors.quiz}</p>}

            {quiz.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium">
                Chưa có câu hỏi trắc nghiệm nào. Bấm "+ Thêm Câu Hỏi Quiz" để tạo câu hỏi.
              </div>
            ) : (
              quiz.map((q, qIdx) => (
                <div
                  key={q.question_key}
                  className={`p-5 rounded-2xl border transition-all space-y-3 ${
                    q.is_active
                      ? 'bg-white border-slate-200 shadow-sm'
                      : 'bg-amber-50/30 border-amber-200 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-indigo-700">Câu Hỏi {qIdx + 1}</span>
                      <span className="font-mono text-[10px] text-slate-400">({q.question_key})</span>
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
                        disabled={qIdx === quiz.length - 1}
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

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 block">Nội dung câu hỏi</label>
                    <input
                      type="text"
                      placeholder="VD: The office ___ at 8 a.m. every day."
                      value={q.question}
                      onChange={(e) =>
                        setQuiz(quiz.map((item, i) => (i === qIdx ? { ...item, question: e.target.value } : item)))
                      }
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  {/* 4 Option Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((optIdx) => (
                      <div key={optIdx} className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block uppercase">
                          Lựa chọn {String.fromCharCode(65 + optIdx)}
                        </label>
                        <input
                          type="text"
                          placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                          value={q.options[optIdx] || ''}
                          onChange={(e) => {
                            const newOpts = [...q.options] as [string, string, string, string];
                            newOpts[optIdx] = e.target.value;
                            setQuiz(
                              quiz.map((item, i) => (i === qIdx ? { ...item, options: newOpts } : item))
                            );
                          }}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Correct Answer Select */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-slate-700 block">Đáp án đúng</label>
                      <select
                        value={q.answer}
                        onChange={(e) =>
                          setQuiz(quiz.map((item, i) => (i === qIdx ? { ...item, answer: e.target.value } : item)))
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
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
                      <label className="text-[11px] font-extrabold text-slate-700 block">Giải thích đáp án</label>
                      <input
                        type="text"
                        placeholder="VD: Chủ ngữ The office là danh từ số ít..."
                        value={q.explanation}
                        onChange={(e) =>
                          setQuiz(quiz.map((item, i) => (i === qIdx ? { ...item, explanation: e.target.value } : item)))
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
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
              className="w-5 h-5 accent-indigo-600 cursor-pointer rounded"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <NavLink
              to="/admin/content/grammar"
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
        <GrammarPreviewModal
          title={title}
          summary={summary}
          level={level}
          sections={previewSections}
          quiz={previewQuiz}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};
