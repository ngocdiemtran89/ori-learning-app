import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import { ArrowLeft, BookOpen, Save, AlertTriangle } from 'lucide-react';
import { LoadingState } from '../components/ui/LoadingState';
import {
  getAdminVocabularyDeck,
  createVocabularyDeck,
  updateVocabularyDeck,
} from '../lib/supabase/adminVocabulary';
import { validateDeckInput, slugifyTitle } from '../lib/cms/vocabularyValidation';
import { VocabularyDeck } from '../lib/supabase/types';

export const AdminVocabularyDeckEditPage: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(deckId && deckId !== 'new');

  const [loading, setLoading] = useState<boolean>(isEditing);
  const [saving, setSaving] = useState<boolean>(false);
  const [originalDeck, setOriginalDeck] = useState<VocabularyDeck | null>(null);

  const [title, setTitle] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [level, setLevel] = useState<string>('foundation');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isPublished, setIsPublished] = useState<boolean>(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing && deckId) {
      async function loadDeck() {
        setLoading(true);
        const res = await getAdminVocabularyDeck(deckId!);
        if (res.error || !res.data) {
          setFormError(res.error || 'Không tìm thấy bộ từ vựng.');
        } else {
          const d = res.data;
          setOriginalDeck(d);
          setTitle(d.title);
          setSlug(d.slug);
          setDescription(d.description || '');
          setLevel(d.level || 'foundation');
          setSortOrder(d.sort_order || 1);
          setIsPublished(d.is_published);
        }
        setLoading(false);
      }
      loadDeck();
    }
  }, [isEditing, deckId]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isEditing || !slug) {
      setSlug(slugifyTitle(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateDeckInput({
      title,
      slug,
      level,
      sort_order: sortOrder,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSaving(true);

    if (isEditing && deckId) {
      const res = await updateVocabularyDeck(deckId, {
        title,
        slug,
        description,
        level,
        sort_order: sortOrder,
        is_published: isPublished,
      });

      if (res.error) {
        setFormError(res.error);
        setSaving(false);
      } else {
        navigate('/admin/content/vocabulary');
      }
    } else {
      const res = await createVocabularyDeck({
        title,
        slug,
        description,
        level,
        sort_order: sortOrder,
        is_published: isPublished,
      });

      if (res.error) {
        setFormError(res.error);
        setSaving(false);
      } else {
        navigate('/admin/content/vocabulary');
      }
    }
  };

  if (loading) {
    return <LoadingState message="Đang tải thông tin bộ từ vựng..." />;
  }

  const isSlugChangedOnPublished =
    isEditing && originalDeck?.is_published && slug !== originalDeck.slug;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <NavLink
          to="/admin/content/vocabulary"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Danh sách Bộ Từ
        </NavLink>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            {isEditing ? 'Chỉnh Sửa Bộ Từ Vựng' : 'Tạo Bộ Từ Vựng Mới'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isEditing
              ? `Cập nhật thông tin bộ từ: ${originalDeck?.title}`
              : 'Tạo mới bộ từ vựng ở dạng Bản nháp (Draft).'}
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
              <span>CẢNH BÁO THAY ĐỔI SLUG BỘ TỪ ĐÃ XUẤT BẢN</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Bộ từ vựng này đã được xuất bản. Việc đổi Slug có thể làm đứt gãy các đường dẫn URL học viên đã lưu bookmark.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 block">
              Tên Bộ Từ Vựng (Title) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="VD: Từ Vựng Cốt Lõi TOEIC 600"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
            />
            {errors.title && <p className="text-[11px] font-bold text-rose-500">{errors.title}</p>}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 block">
              Slug URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="VD: tu-vung-cot-loi-toeic-600"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
            />
            {errors.slug && <p className="text-[11px] font-bold text-rose-500">{errors.slug}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 block">
              Mô Tả Bộ Từ (Description)
            </label>
            <textarea
              rows={3}
              placeholder="Mô tả nội dung trọng tâm của bộ từ vựng này..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
            />
          </div>

          {/* Level & Sort Order Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                Thứ Tự Hiển Thị (Sort Order) <span className="text-rose-500">*</span>
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
              <span className="text-xs font-extrabold text-slate-900 block">Xuất Bản Bộ Từ (Publish Status)</span>
              <p className="text-[11px] text-slate-500 font-medium">
                Nếu chọn Xuất bản, học viên có quyền truy cập sẽ thấy bộ từ vựng này.
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
              to="/admin/content/vocabulary"
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
    </div>
  );
};
