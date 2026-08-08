/**
 * Admin Grammar CMS Data Layer (Phase 3.2)
 * Data mutations and queries for Grammar Lessons.
 * STRICT RULE: NO HARD DELETE MUTATIONS EXPOSED.
 */

import { supabase } from './client';
import { GrammarLesson } from './types';
import {
  ensureLegacyQuestionKeys,
  shouldRotateGrammarQuestionKey,
  createNewQuestionKey,
  validateGrammarLessonForPublish,
  GrammarLessonCMSInput,
  GrammarQuizQuestionInput,
} from '../cms/grammarValidation';

export interface AdminGrammarLessonInfo extends GrammarLesson {
  sections_count: number;
  active_quiz_count: number;
  hidden_quiz_count: number;
  skill_tag: string;
}

export interface GetGrammarLessonsOptions {
  searchQuery?: string;
  levelFilter?: string;
  statusFilter?: 'all' | 'published' | 'draft';
  page?: number;
  pageSize?: number;
}

export interface PaginatedGrammarLessons {
  lessons: AdminGrammarLessonInfo[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateGrammarLessonInput {
  title: string;
  slug: string;
  level: string;
  summary?: string;
  skill_tag?: string;
  sort_order?: number;
  is_published?: boolean;
  sections?: any[];
  quiz?: any[];
}

export interface UpdateGrammarLessonInput {
  title?: string;
  slug?: string;
  level?: string;
  summary?: string;
  skill_tag?: string;
  sort_order?: number;
  is_published?: boolean;
  sections?: any[];
  quiz?: any[];
}

/**
 * Sanitize search input to prevent PostgREST syntax errors
 */
function sanitizeSearchQuery(query: string): string {
  return query.replace(/[,()%]/g, '').trim();
}

/**
 * Fetch paginated Grammar Lessons with counts for Admin CMS view
 */
export async function getAdminGrammarLessons(
  options: GetGrammarLessonsOptions = {}
): Promise<{ data: PaginatedGrammarLessons | null; error: string | null }> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabase
      .from('grammar_lessons')
      .select('*', { count: 'exact' });

    if (options.statusFilter === 'published') {
      query = query.eq('is_published', true);
    } else if (options.statusFilter === 'draft') {
      query = query.eq('is_published', false);
    }

    if (options.levelFilter && options.levelFilter !== 'all') {
      query = query.eq('level', options.levelFilter.toLowerCase());
    }

    const cleanSearch = options.searchQuery ? sanitizeSearchQuery(options.searchQuery) : '';
    if (cleanSearch) {
      const q = `%${cleanSearch.toLowerCase()}%`;
      query = query.or(`title.ilike.${q},summary.ilike.${q},slug.ilike.${q}`);
    }

    query = query
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })
      .range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('[ORI CMS] Error fetching grammar lessons:', error.message);
      return { data: null, error: 'Không thể tải danh sách bài học ngữ pháp.' };
    }

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const lessons: AdminGrammarLessonInfo[] = ((data as GrammarLesson[]) || []).map((l) => {
      const content: any = l.lesson_content || {};
      const sections = Array.isArray(content.sections) ? content.sections : [];
      const quiz = Array.isArray(content.quiz) ? content.quiz : [];

      const activeQuiz = quiz.filter((q: any) => q.is_active !== false);
      const hiddenQuiz = quiz.filter((q: any) => q.is_active === false);

      return {
        ...l,
        skill_tag: String(content.skill_tag || l.title),
        sections_count: sections.length,
        active_quiz_count: activeQuiz.length,
        hidden_quiz_count: hiddenQuiz.length,
      };
    });

    return {
      data: {
        lessons,
        totalCount,
        page,
        pageSize,
        totalPages,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[ORI CMS] Exception fetching grammar lessons:', err);
    return { data: null, error: 'Lỗi kết nối khi tải danh sách ngữ pháp.' };
  }
}

/**
 * Fetch a single Grammar Lesson by ID or Slug
 */
export async function getAdminGrammarLesson(
  idOrSlug: string
): Promise<{ data: GrammarLesson | null; error: string | null }> {
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    let query = supabase.from('grammar_lessons').select('*');

    if (isUUID) {
      query = query.eq('id', idOrSlug);
    } else {
      query = query.eq('slug', idOrSlug);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('[ORI CMS] Error fetching grammar lesson:', error.message);
      return { data: null, error: 'Không thể tải bài học ngữ pháp.' };
    }

    if (!data) return { data: null, error: null };

    const lesson = data as GrammarLesson;
    const content: any = lesson.lesson_content || {};

    // Ensure legacy question keys exist on loaded lesson content
    const quizWithKeys = ensureLegacyQuestionKeys(lesson.id, Array.isArray(content.quiz) ? content.quiz : []);
    const normalizedContent = {
      ...content,
      skill_tag: content.skill_tag || lesson.title,
      sections: Array.isArray(content.sections) ? content.sections : [],
      quiz: quizWithKeys,
    };

    return {
      data: {
        ...lesson,
        lesson_content: normalizedContent,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[ORI CMS] Exception fetching grammar lesson:', err);
    return { data: null, error: 'Lỗi không xác định khi tải bài học.' };
  }
}

/**
 * Create a new Grammar Lesson (Default draft: is_published = false)
 */
export async function createGrammarLesson(
  input: CreateGrammarLessonInput
): Promise<{ data: GrammarLesson | null; error: string | null }> {
  try {
    const title = input.title.trim();
    const slug = input.slug.trim();
    const skill_tag = (input.skill_tag || title).trim();

    // Process sections
    const sections = (input.sections || []).map((s: any, idx: number) => ({
      section_key: s.section_key || `sec-${idx + 1}-${Date.now()}`,
      heading: (s.heading || '').trim(),
      body: (s.body || '').trim(),
      examples: Array.isArray(s.examples) ? s.examples : [],
    }));

    // Process quiz questions with stable keys
    const quiz = (input.quiz || []).map((q: any) => ({
      question_key: q.question_key || createNewQuestionKey(),
      question: (q.question || '').trim(),
      options: Array.isArray(q.options) ? q.options.map((o: string) => o.trim()) : [],
      answer: (q.answer || '').trim(),
      explanation: (q.explanation || '').trim() || undefined,
      is_active: q.is_active ?? true,
    }));

    const lesson_content = {
      skill_tag,
      sections,
      quiz,
    };

    const payload = {
      title,
      slug,
      summary: input.summary?.trim() || null,
      level: input.level.trim().toLowerCase(),
      sort_order: input.sort_order ?? 0,
      is_published: input.is_published ?? false,
      lesson_content,
    };

    const { data, error } = await supabase
      .from('grammar_lessons')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[ORI CMS] Error creating grammar lesson:', error.message);
      if (error.message.includes('unique constraint') || error.message.includes('slug')) {
        return { data: null, error: 'Slug này đã tồn tại trên hệ thống. Vui lòng chọn slug khác.' };
      }
      return { data: null, error: 'Không thể tạo bài học ngữ pháp mới.' };
    }

    return { data: data as GrammarLesson, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception creating grammar lesson:', err);
    return { data: null, error: 'Đã xảy ra lỗi khi tạo bài học ngữ pháp.' };
  }
}

/**
 * Update an existing Grammar Lesson with material change key rotation detector
 */
export async function updateGrammarLesson(
  lessonId: string,
  input: UpdateGrammarLessonInput
): Promise<{ data: GrammarLesson | null; error: string | null }> {
  try {
    // Load existing lesson to compare questions for material edits
    const currentRes = await getAdminGrammarLesson(lessonId);
    if (currentRes.error || !currentRes.data) {
      return { data: null, error: 'Không tìm thấy bài học ngữ pháp cần cập nhật.' };
    }

    const currentLesson = currentRes.data;
    const currentContent: any = currentLesson.lesson_content || {};
    const currentQuiz: GrammarQuizQuestionInput[] = Array.isArray(currentContent.quiz) ? currentContent.quiz : [];
    const currentMap = new Map<string, GrammarQuizQuestionInput>();
    for (const q of currentQuiz) {
      if (q.question_key) currentMap.set(q.question_key, q);
    }

    const title = input.title !== undefined ? input.title.trim() : currentLesson.title;
    const slug = input.slug !== undefined ? input.slug.trim() : currentLesson.slug;
    const skill_tag = input.skill_tag !== undefined ? input.skill_tag.trim() : (currentContent.skill_tag || title);

    // Process sections
    const rawSections = input.sections !== undefined ? input.sections : currentContent.sections;
    const sections = (Array.isArray(rawSections) ? rawSections : []).map((s: any, idx: number) => ({
      section_key: s.section_key || `sec-${idx + 1}-${Date.now()}`,
      heading: (s.heading || '').trim(),
      body: (s.body || '').trim(),
      examples: Array.isArray(s.examples) ? s.examples : [],
    }));

    // Process quiz with material edit key rotation
    const rawQuiz = input.quiz !== undefined ? input.quiz : currentQuiz;
    const newQuizInput = Array.isArray(rawQuiz) ? rawQuiz : [];

    const quiz = newQuizInput.map((q: any) => {
      let question_key = q.question_key || createNewQuestionKey();

      if (currentLesson.is_published && q.question_key && currentMap.has(q.question_key)) {
        const originalQ = currentMap.get(q.question_key)!;
        if (shouldRotateGrammarQuestionKey(originalQ, q)) {
          // Material content change on published question -> ROTATE KEY to preserve history
          question_key = createNewQuestionKey();
        }
      }

      return {
        question_key,
        question: (q.question || '').trim(),
        options: Array.isArray(q.options) ? q.options.map((o: string) => o.trim()) : [],
        answer: (q.answer || '').trim(),
        explanation: (q.explanation || '').trim() || undefined,
        is_active: q.is_active ?? true,
      };
    });

    const lesson_content = {
      skill_tag,
      sections,
      quiz,
    };

    const payload: Record<string, any> = {
      lesson_content,
    };

    if (input.title !== undefined) payload.title = title;
    if (input.slug !== undefined) payload.slug = slug;
    if (input.summary !== undefined) payload.summary = input.summary.trim() || null;
    if (input.level !== undefined) payload.level = input.level.trim().toLowerCase();
    if (input.sort_order !== undefined) payload.sort_order = input.sort_order;
    if (input.is_published !== undefined) payload.is_published = input.is_published;

    const { data, error } = await supabase
      .from('grammar_lessons')
      .update(payload)
      .eq('id', lessonId)
      .select('*')
      .single();

    if (error) {
      console.error('[ORI CMS] Error updating grammar lesson:', error.message);
      if (error.message.includes('unique constraint') || error.message.includes('slug')) {
        return { data: null, error: 'Slug này đã tồn tại trên hệ thống. Vui lòng chọn slug khác.' };
      }
      return { data: null, error: 'Không thể cập nhật bài học ngữ pháp.' };
    }

    return { data: data as GrammarLesson, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception updating grammar lesson:', err);
    return { data: null, error: 'Đã xảy ra lỗi khi cập nhật bài học.' };
  }
}

/**
 * Toggle Grammar Lesson published status (Validates before publishing!)
 */
export async function setGrammarLessonPublished(
  lessonId: string,
  is_published: boolean
): Promise<{ success: boolean; error: string | null; warnings?: string[] }> {
  try {
    if (is_published) {
      const { data: lesson, error: fetchErr } = await getAdminGrammarLesson(lessonId);

      if (fetchErr || !lesson) {
        return { success: false, error: 'Không tìm thấy bài học ngữ pháp để xuất bản.' };
      }

      const content: any = lesson.lesson_content || {};
      const cmsInput: GrammarLessonCMSInput = {
        title: lesson.title,
        slug: lesson.slug,
        level: lesson.level,
        skill_tag: String(content.skill_tag || lesson.title),
        sort_order: lesson.sort_order,
        sections: Array.isArray(content.sections) ? content.sections : [],
        quiz: Array.isArray(content.quiz) ? content.quiz : [],
      };

      const validation = validateGrammarLessonForPublish(cmsInput);

      if (!validation.canPublish) {
        const firstErrKey = Object.keys(validation.errors)[0];
        return { success: false, error: validation.errors[firstErrKey] };
      }

      const { error } = await supabase
        .from('grammar_lessons')
        .update({ is_published })
        .eq('id', lessonId);

      if (error) {
        console.error('[ORI CMS] Error toggling publish status:', error.message);
        return { success: false, error: 'Không thể xuất bản bài học ngữ pháp.' };
      }

      return { success: true, error: null, warnings: validation.warnings };
    }

    const { error } = await supabase
      .from('grammar_lessons')
      .update({ is_published })
      .eq('id', lessonId);

    if (error) {
      console.error('[ORI CMS] Error toggling publish status:', error.message);
      return { success: false, error: 'Không thể ẩn bài học ngữ pháp.' };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception in setGrammarLessonPublished:', err);
    return { success: false, error: 'Lỗi không xác định khi thay đổi trạng thái xuất bản.' };
  }
}
