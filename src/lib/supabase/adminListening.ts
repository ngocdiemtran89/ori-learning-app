/**
 * Admin Listening CMS Data Layer (Phase 3.3)
 * Data mutations and queries for Listening Lessons & Questions.
 * STRICT RULE: NO HARD DELETE MUTATIONS EXPOSED.
 */

import { supabase } from './client';
import { LearningLesson } from './types';
import { LessonQuestion } from './learning';
import {
  shouldRotateLearningQuestionIdentity,
  validateListeningLessonForPublish,
  normalizeToeicPart,
  ListeningLessonCMSInput,
  ListeningQuestionInput,
} from '../cms/listeningValidation';

export interface AdminListeningLessonInfo extends LearningLesson {
  active_questions_count: number;
  hidden_questions_count: number;
}

export interface GetListeningLessonsOptions {
  searchQuery?: string;
  levelFilter?: string;
  toeicPartFilter?: string;
  statusFilter?: 'all' | 'published' | 'draft';
  page?: number;
  pageSize?: number;
}

export interface PaginatedListeningLessons {
  lessons: AdminListeningLessonInfo[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateListeningLessonInput {
  title: string;
  slug: string;
  level: string;
  toeic_part: string;
  audio_url?: string | null;
  transcript?: string | null;
  sort_order?: number;
  is_published?: boolean;
}

export interface UpdateListeningLessonInput {
  title?: string;
  slug?: string;
  level?: string;
  toeic_part?: string;
  audio_url?: string | null;
  transcript?: string | null;
  sort_order?: number;
  is_published?: boolean;
}

function sanitizeSearchQuery(query: string): string {
  return query.replace(/[,()%]/g, '').trim();
}

/**
 * Fetch paginated Listening Lessons for Admin CMS (kind = 'listening' ONLY)
 */
export async function getAdminListeningLessons(
  options: GetListeningLessonsOptions = {}
): Promise<{ data: PaginatedListeningLessons | null; error: string | null }> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabase
      .from('learning_lessons')
      .select('*', { count: 'exact' })
      .eq('kind', 'listening');

    if (options.statusFilter === 'published') {
      query = query.eq('is_published', true);
    } else if (options.statusFilter === 'draft') {
      query = query.eq('is_published', false);
    }

    if (options.levelFilter && options.levelFilter !== 'all') {
      query = query.eq('level', options.levelFilter.toLowerCase());
    }

    if (options.toeicPartFilter && options.toeicPartFilter !== 'all') {
      query = query.eq('toeic_part', normalizeToeicPart(options.toeicPartFilter));
    }

    const cleanSearch = options.searchQuery ? sanitizeSearchQuery(options.searchQuery) : '';
    if (cleanSearch) {
      const q = `%${cleanSearch.toLowerCase()}%`;
      query = query.or(`title.ilike.${q},slug.ilike.${q}`);
    }

    query = query
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })
      .range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('[ORI CMS] Error fetching listening lessons:', error.message);
      return { data: null, error: 'Không thể tải danh sách bài học Listening.' };
    }

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const lessonsRaw = (data as LearningLesson[]) || [];

    // Fetch question counts per lesson
    const lessonIds = lessonsRaw.map((l) => l.id);
    let qCountsMap: Record<string, { active: number; hidden: number }> = {};

    if (lessonIds.length > 0) {
      const { data: qData, error: qErr } = await supabase
        .from('lesson_questions')
        .select('lesson_id, is_active')
        .in('lesson_id', lessonIds);

      if (!qErr && qData) {
        for (const row of qData) {
          const lId = row.lesson_id;
          if (!qCountsMap[lId]) qCountsMap[lId] = { active: 0, hidden: 0 };
          if (row.is_active !== false) {
            qCountsMap[lId].active++;
          } else {
            qCountsMap[lId].hidden++;
          }
        }
      }
    }

    const lessons: AdminListeningLessonInfo[] = lessonsRaw.map((l) => ({
      ...l,
      active_questions_count: qCountsMap[l.id]?.active || 0,
      hidden_questions_count: qCountsMap[l.id]?.hidden || 0,
    }));

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
    console.error('[ORI CMS] Exception fetching listening lessons:', err);
    return { data: null, error: 'Lỗi kết nối khi tải danh sách Listening.' };
  }
}

/**
 * Fetch a single Listening Lesson by ID or Slug (kind = 'listening')
 */
export async function getAdminListeningLesson(
  idOrSlug: string
): Promise<{ data: LearningLesson | null; error: string | null }> {
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    let query = supabase.from('learning_lessons').select('*').eq('kind', 'listening');

    if (isUUID) {
      query = query.eq('id', idOrSlug);
    } else {
      query = query.eq('slug', idOrSlug);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('[ORI CMS] Error fetching listening lesson:', error.message);
      return { data: null, error: 'Không thể tải bài học Listening.' };
    }

    return { data: (data as LearningLesson) || null, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception fetching listening lesson:', err);
    return { data: null, error: 'Lỗi không xác định khi tải bài học.' };
  }
}

/**
 * Fetch ALL questions (active and hidden) for a Listening lesson for Admin CMS
 */
export async function getAdminListeningQuestions(
  lessonId: string
): Promise<{ data: LessonQuestion[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('lesson_questions')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[ORI CMS] Error fetching listening questions:', error.message);
      return { data: null, error: 'Không thể tải danh sách câu hỏi.' };
    }

    return { data: (data as LessonQuestion[]) || [], error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception fetching listening questions:', err);
    return { data: null, error: 'Lỗi không xác định khi tải câu hỏi.' };
  }
}

/**
 * Create a new Listening Lesson (kind = 'listening', default draft: is_published = false)
 */
export async function createListeningLesson(
  input: CreateListeningLessonInput
): Promise<{ data: LearningLesson | null; error: string | null }> {
  try {
    const payload = {
      kind: 'listening' as const,
      title: input.title.trim(),
      slug: input.slug.trim(),
      level: input.level.trim().toLowerCase(),
      toeic_part: normalizeToeicPart(input.toeic_part),
      audio_url: input.audio_url?.trim() || null,
      transcript: input.transcript?.trim() || null,
      sort_order: input.sort_order ?? 0,
      is_published: input.is_published ?? false,
    };

    const { data, error } = await supabase
      .from('learning_lessons')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[ORI CMS] Error creating listening lesson:', error.message);
      if (error.message.includes('unique constraint') || error.message.includes('slug')) {
        return { data: null, error: 'Slug này đã tồn tại trên hệ thống. Vui lòng chọn slug khác.' };
      }
      return { data: null, error: 'Không thể tạo bài học Listening mới.' };
    }

    return { data: data as LearningLesson, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception creating listening lesson:', err);
    return { data: null, error: 'Đã xảy ra lỗi khi tạo bài học.' };
  }
}

/**
 * Update an existing Listening Lesson
 */
export async function updateListeningLesson(
  lessonId: string,
  input: UpdateListeningLessonInput
): Promise<{ data: LearningLesson | null; error: string | null }> {
  try {
    const payload: Record<string, any> = {};

    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.slug !== undefined) payload.slug = input.slug.trim();
    if (input.level !== undefined) payload.level = input.level.trim().toLowerCase();
    if (input.toeic_part !== undefined) payload.toeic_part = normalizeToeicPart(input.toeic_part);
    if (input.audio_url !== undefined) payload.audio_url = input.audio_url ? input.audio_url.trim() : null;
    if (input.transcript !== undefined) payload.transcript = input.transcript ? input.transcript.trim() : null;
    if (input.sort_order !== undefined) payload.sort_order = input.sort_order;
    if (input.is_published !== undefined) payload.is_published = input.is_published;

    const { data, error } = await supabase
      .from('learning_lessons')
      .update(payload)
      .eq('id', lessonId)
      .eq('kind', 'listening')
      .select('*')
      .single();

    if (error) {
      console.error('[ORI CMS] Error updating listening lesson:', error.message);
      if (error.message.includes('unique constraint') || error.message.includes('slug')) {
        return { data: null, error: 'Slug này đã tồn tại trên hệ thống. Vui lòng chọn slug khác.' };
      }
      return { data: null, error: 'Không thể cập nhật bài học Listening.' };
    }

    return { data: data as LearningLesson, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception updating listening lesson:', err);
    return { data: null, error: 'Đã xảy ra lỗi khi cập nhật bài học.' };
  }
}

/**
 * Save / Update a Listening Question
 * If material changes occur on a published lesson question (shouldRotateLearningQuestionIdentity),
 * sets old question is_active = false and inserts a new question row to preserve question history.
 */
export async function saveListeningQuestion(
  lessonId: string,
  _toeicPart: string,
  isLessonPublished: boolean,
  input: ListeningQuestionInput
): Promise<{ data: LessonQuestion | null; error: string | null }> {
  try {
    const options = Array.isArray(input.options) ? input.options.map((o) => o.trim()) : [];
    const question_text = input.question_text.trim();
    const correct_answer = input.correct_answer.trim();
    const explanation = input.explanation?.trim() || null;
    const skill_tag = input.skill_tag?.trim() || null;
    const topic = input.topic?.trim() || null;
    const image_url = input.image_url?.trim() || null;
    const sort_order = input.sort_order ?? 0;
    const is_active = input.is_active ?? true;

    if (input.id) {
      // Fetch existing question to check for material edit
      const { data: origQ } = await supabase
        .from('lesson_questions')
        .select('*')
        .eq('id', input.id)
        .maybeSingle();

      if (origQ && isLessonPublished && shouldRotateLearningQuestionIdentity(origQ as any, input)) {
        // MATERIAL EDIT ON PUBLISHED QUESTION -> HIDE OLD, INSERT NEW QUESTION (Preserves historical ID)
        await supabase
          .from('lesson_questions')
          .update({ is_active: false })
          .eq('id', input.id);

        const { data: newQ, error: insErr } = await supabase
          .from('lesson_questions')
          .insert({
            lesson_id: lessonId,
            question_text,
            options,
            correct_answer,
            explanation,
            sort_order,
            is_active: true,
            skill_tag,
            topic,
            image_url,
          })
          .select('*')
          .single();

        if (insErr) {
          return { data: null, error: 'Không thể tạo câu hỏi thay thế.' };
        }
        return { data: newQ as LessonQuestion, error: null };
      }

      // Non-material edit or unpublished lesson -> update in-place
      const { data: updatedQ, error: updErr } = await supabase
        .from('lesson_questions')
        .update({
          question_text,
          options,
          correct_answer,
          explanation,
          sort_order,
          is_active,
          skill_tag,
          topic,
          image_url,
        })
        .eq('id', input.id)
        .select('*')
        .single();

      if (updErr) {
        return { data: null, error: 'Không thể cập nhật câu hỏi.' };
      }
      return { data: updatedQ as LessonQuestion, error: null };
    }

    // New question insertion
    const { data: insertedQ, error: insErr } = await supabase
      .from('lesson_questions')
      .insert({
        lesson_id: lessonId,
        question_text,
        options,
        correct_answer,
        explanation,
        sort_order,
        is_active,
        skill_tag,
        topic,
        image_url,
      })
      .select('*')
      .single();

    if (insErr) {
      return { data: null, error: 'Không thể thêm câu hỏi mới.' };
    }
    return { data: insertedQ as LessonQuestion, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception saving listening question:', err);
    return { data: null, error: 'Lỗi không xác định khi lưu câu hỏi.' };
  }
}

/**
 * Toggle active status of a question (is_active = false hides without deleting history)
 */
export async function setListeningQuestionActive(
  questionId: string,
  is_active: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('lesson_questions')
      .update({ is_active })
      .eq('id', questionId);

    if (error) {
      return { success: false, error: 'Không thể thay đổi trạng thái câu hỏi.' };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: 'Lỗi khi đổi trạng thái câu hỏi.' };
  }
}

/**
 * Save question sort orders (Updates sort_order without changing question UUIDs)
 */
export async function saveListeningQuestionOrder(
  orders: Array<{ id: string; sort_order: number }>
): Promise<{ success: boolean; error: string | null }> {
  try {
    for (const item of orders) {
      await supabase
        .from('lesson_questions')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id);
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: 'Không thể lưu thứ tự câu hỏi.' };
  }
}

/**
 * Toggle Listening Lesson published status (Validates before publishing!)
 */
export async function setListeningLessonPublished(
  lessonId: string,
  is_published: boolean
): Promise<{ success: boolean; error: string | null; warnings?: string[] }> {
  try {
    if (is_published) {
      const { data: lesson, error: fetchErr } = await getAdminListeningLesson(lessonId);
      if (fetchErr || !lesson) {
        return { success: false, error: 'Không tìm thấy bài Listening để xuất bản.' };
      }

      const { data: questions } = await getAdminListeningQuestions(lessonId);

      const cmsInput: ListeningLessonCMSInput = {
        title: lesson.title,
        slug: lesson.slug,
        level: lesson.level,
        toeic_part: lesson.toeic_part || 'part1',
        audio_url: lesson.audio_url,
        transcript: lesson.transcript,
        sort_order: lesson.sort_order,
        questions: (questions || []).map((q: any) => ({
          id: q.id,
          question_text: q.question_text,
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          sort_order: q.sort_order,
          is_active: q.is_active,
          skill_tag: q.skill_tag,
          topic: q.topic,
          image_url: q.image_url,
        })),
      };

      const validation = validateListeningLessonForPublish(cmsInput);

      if (!validation.canPublish) {
        const firstErrKey = Object.keys(validation.errors)[0];
        return { success: false, error: validation.errors[firstErrKey] };
      }

      const { error } = await supabase
        .from('learning_lessons')
        .update({ is_published })
        .eq('id', lessonId);

      if (error) {
        return { success: false, error: 'Không thể xuất bản bài Listening.' };
      }

      return { success: true, error: null, warnings: validation.warnings };
    }

    const { error } = await supabase
      .from('learning_lessons')
      .update({ is_published })
      .eq('id', lessonId);

    if (error) {
      return { success: false, error: 'Không thể ẩn bài Listening.' };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: 'Lỗi không xác định khi xuất bản bài Listening.' };
  }
}
