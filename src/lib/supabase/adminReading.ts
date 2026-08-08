/**
 * Admin Reading CMS Data Layer (Phase 3.4)
 * Data mutations and queries for Reading Lessons & Questions.
 * STRICT RULE: NO HARD DELETE MUTATIONS EXPOSED.
 */

import { supabase } from './client';
import { LearningLesson } from './types';
import { LessonQuestion } from './learning';
import {
  shouldRotateLearningQuestionIdentity,
  validateReadingLessonForPublish,
  normalizeReadingToeicPart,
  executeSafeQuestionReplacement,
  combineHistoryQueryResults,
  HistoryCheckResult,
  ReadingLessonCMSInput,
  ReadingQuestionInput,
} from '../cms/readingValidation';

export interface AdminReadingLessonInfo extends LearningLesson {
  active_questions_count: number;
  hidden_questions_count: number;
}

export interface GetReadingLessonsOptions {
  searchQuery?: string;
  levelFilter?: string;
  toeicPartFilter?: string;
  statusFilter?: 'all' | 'published' | 'draft';
  page?: number;
  pageSize?: number;
}

export interface PaginatedReadingLessons {
  lessons: AdminReadingLessonInfo[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateReadingLessonInput {
  title: string;
  slug: string;
  level: string;
  toeic_part: string;
  passage?: string | null;
  sort_order?: number;
  is_published?: boolean;
}

export interface UpdateReadingLessonInput {
  title?: string;
  slug?: string;
  level?: string;
  toeic_part?: string;
  passage?: string | null;
  sort_order?: number;
  is_published?: boolean;
}

function sanitizeSearchQuery(query: string): string {
  return query.replace(/[,()%]/g, '').trim();
}

/**
 * Check if a Reading lesson has ANY learning history in:
 * 1. question_attempts (content_type = 'reading', content_id = lessonId)
 * 2. quiz_attempts (content_type = 'reading', content_id = lessonId)
 * 3. user_progress (content_type = 'reading', content_id = lessonId)
 *
 * Safety default: If ANY query fails, returns status: 'ERROR', hasHistory: true.
 */
export async function hasReadingLessonLearningHistory(
  lessonId: string
): Promise<HistoryCheckResult> {
  try {
    const [qAttRes, quizAttRes, progRes] = await Promise.all([
      supabase.from('question_attempts').select('id').eq('content_type', 'reading').eq('content_id', lessonId).limit(1),
      supabase.from('quiz_attempts').select('id').eq('content_type', 'reading').eq('content_id', lessonId).limit(1),
      supabase.from('user_progress').select('id').eq('content_type', 'reading').eq('content_id', lessonId).limit(1),
    ]);

    const results = [
      { dataCount: qAttRes.data ? qAttRes.data.length : 0, error: qAttRes.error },
      { dataCount: quizAttRes.data ? quizAttRes.data.length : 0, error: quizAttRes.error },
      { dataCount: progRes.data ? progRes.data.length : 0, error: progRes.error },
    ];

    return combineHistoryQueryResults(results);
  } catch (err: any) {
    console.error('[ORI CMS] Exception checking reading lesson learning history:', err);
    return {
      hasHistory: true,
      status: 'ERROR',
      error: 'Không thể kiểm tra lịch sử học viên lúc này. Thay đổi này chưa được thực hiện để bảo vệ dữ liệu tiến độ.',
    };
  }
}

// Export alias for backward compatibility
export const hasReadingLessonHistory = hasReadingLessonLearningHistory;

/**
 * Check if a specific question UUID has historical question_attempts
 * Safety default: If query errors, returns hasHistory = true!
 */
export async function hasQuestionHistory(
  questionId: string
): Promise<{ hasHistory: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('question_attempts')
      .select('id')
      .or(`question_id.eq.${questionId},question_key.eq.${questionId}`)
      .limit(1);

    if (error) {
      console.error('[ORI CMS] Error checking question history:', error.message);
      return { hasHistory: true, error: 'Không thể xác minh lịch sử câu hỏi.' };
    }

    return { hasHistory: (data && data.length > 0) || false, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception checking question history:', err);
    return { hasHistory: true, error: 'Lỗi khi kiểm tra lịch sử câu hỏi.' };
  }
}

/**
 * Fetch paginated Reading Lessons for Admin CMS (kind = 'reading' ONLY)
 */
export async function getAdminReadingLessons(
  options: GetReadingLessonsOptions = {}
): Promise<{ data: PaginatedReadingLessons | null; error: string | null }> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabase
      .from('learning_lessons')
      .select('*', { count: 'exact' })
      .eq('kind', 'reading');

    if (options.statusFilter === 'published') {
      query = query.eq('is_published', true);
    } else if (options.statusFilter === 'draft') {
      query = query.eq('is_published', false);
    }

    if (options.levelFilter && options.levelFilter !== 'all') {
      query = query.eq('level', options.levelFilter.toLowerCase());
    }

    if (options.toeicPartFilter && options.toeicPartFilter !== 'all') {
      query = query.eq('toeic_part', normalizeReadingToeicPart(options.toeicPartFilter));
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
      console.error('[ORI CMS] Error fetching reading lessons:', error.message);
      return { data: null, error: 'Không thể tải danh sách bài học Reading.' };
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

    const lessons: AdminReadingLessonInfo[] = lessonsRaw.map((l) => ({
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
    console.error('[ORI CMS] Exception fetching reading lessons:', err);
    return { data: null, error: 'Lỗi kết nối khi tải danh sách Reading.' };
  }
}

/**
 * Fetch a single Reading Lesson by ID or Slug (kind = 'reading')
 */
export async function getAdminReadingLesson(
  idOrSlug: string
): Promise<{ data: LearningLesson | null; error: string | null }> {
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    let query = supabase.from('learning_lessons').select('*').eq('kind', 'reading');

    if (isUUID) {
      query = query.eq('id', idOrSlug);
    } else {
      query = query.eq('slug', idOrSlug);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('[ORI CMS] Error fetching reading lesson:', error.message);
      return { data: null, error: 'Không thể tải bài học Reading.' };
    }

    return { data: (data as LearningLesson) || null, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception fetching reading lesson:', err);
    return { data: null, error: 'Lỗi không xác định khi tải bài học.' };
  }
}

/**
 * Fetch ALL questions (active and hidden) for a Reading lesson for Admin CMS
 */
export async function getAdminReadingQuestions(
  lessonId: string
): Promise<{ data: LessonQuestion[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('lesson_questions')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[ORI CMS] Error fetching reading questions:', error.message);
      return { data: null, error: 'Không thể tải danh sách câu hỏi.' };
    }

    return { data: (data as LessonQuestion[]) || [], error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception fetching reading questions:', err);
    return { data: null, error: 'Lỗi không xác định khi tải câu hỏi.' };
  }
}

/**
 * Create a new Reading Lesson (kind = 'reading', default draft: is_published = false)
 */
export async function createReadingLesson(
  input: CreateReadingLessonInput
): Promise<{ data: LearningLesson | null; error: string | null }> {
  try {
    const payload = {
      kind: 'reading' as const,
      title: input.title.trim(),
      slug: input.slug.trim(),
      level: input.level.trim().toLowerCase(),
      toeic_part: normalizeReadingToeicPart(input.toeic_part),
      passage: input.passage ? input.passage.trim() : null,
      sort_order: input.sort_order ?? 0,
      is_published: input.is_published ?? false,
    };

    const { data, error } = await supabase
      .from('learning_lessons')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[ORI CMS] Error creating reading lesson:', error.message);
      if (error.message.includes('unique constraint') || error.message.includes('slug')) {
        return { data: null, error: 'Slug này đã tồn tại trên hệ thống. Vui lòng chọn slug khác.' };
      }
      return { data: null, error: 'Không thể tạo bài học Reading mới.' };
    }

    return { data: data as LearningLesson, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception creating reading lesson:', err);
    return { data: null, error: 'Đã xảy ra lỗi khi tạo bài học.' };
  }
}

/**
 * Update an existing Reading Lesson
 */
export async function updateReadingLesson(
  lessonId: string,
  input: UpdateReadingLessonInput
): Promise<{ data: LearningLesson | null; error: string | null }> {
  try {
    const payload: Record<string, any> = {};

    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.slug !== undefined) payload.slug = input.slug.trim();
    if (input.level !== undefined) payload.level = input.level.trim().toLowerCase();
    if (input.toeic_part !== undefined) payload.toeic_part = normalizeReadingToeicPart(input.toeic_part);
    if (input.passage !== undefined) payload.passage = input.passage ? input.passage.trim() : null;
    if (input.sort_order !== undefined) payload.sort_order = input.sort_order;
    if (input.is_published !== undefined) payload.is_published = input.is_published;

    const { data, error } = await supabase
      .from('learning_lessons')
      .update(payload)
      .eq('id', lessonId)
      .eq('kind', 'reading')
      .select('*')
      .single();

    if (error) {
      console.error('[ORI CMS] Error updating reading lesson:', error.message);
      if (error.message.includes('unique constraint') || error.message.includes('slug')) {
        return { data: null, error: 'Slug này đã tồn tại trên hệ thống. Vui lòng chọn slug khác.' };
      }
      return { data: null, error: 'Không thể cập nhật bài học Reading.' };
    }

    return { data: data as LearningLesson, error: null };
  } catch (err: any) {
    console.error('[ORI CMS] Exception updating reading lesson:', err);
    return { data: null, error: 'Đã xảy ra lỗi khi cập nhật bài học.' };
  }
}

/**
 * Save / Update a Reading Question
 * If material changes occur on a published lesson question (shouldRotateLearningQuestionIdentity),
 * uses 6-step safe replacement orchestrator.
 */
export async function saveReadingQuestion(
  lessonId: string,
  isLessonPublished: boolean,
  input: ReadingQuestionInput
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
      const { data: origQ } = await supabase
        .from('lesson_questions')
        .select('*')
        .eq('id', input.id)
        .maybeSingle();

      if (origQ && shouldRotateLearningQuestionIdentity(origQ as any, input)) {
        const qHist = await hasQuestionHistory(input.id);
        const mustRotate = qHist.hasHistory || isLessonPublished || Boolean(qHist.error);

        if (mustRotate) {
          return executeSafeQuestionReplacement({
          insertInactiveNew: async () => {
            const { data: newQ, error: insErr } = await supabase
              .from('lesson_questions')
              .insert({
                lesson_id: lessonId,
                question_text,
                options,
                correct_answer,
                explanation,
                sort_order,
                is_active: false,
                skill_tag,
                topic,
                image_url,
              })
              .select('*')
              .single();
            return { data: newQ, error: insErr };
          },
          hideOld: async () => {
            const { error: hideErr } = await supabase
              .from('lesson_questions')
              .update({ is_active: false })
              .eq('id', input.id!);
            return { error: hideErr };
          },
          activateNew: async (newId: string) => {
            const { data: actQ, error: actErr } = await supabase
              .from('lesson_questions')
              .update({ is_active: true })
              .eq('id', newId)
              .select('*')
              .single();
            return { data: actQ, error: actErr };
          },
          restoreOld: async () => {
            const { error: recErr } = await supabase
              .from('lesson_questions')
              .update({ is_active: true })
              .eq('id', input.id!);
            return { error: recErr };
          },
        });
        }
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
    console.error('[ORI CMS] Exception saving reading question:', err);
    return { data: null, error: 'Lỗi không xác định khi lưu câu hỏi.' };
  }
}

/**
 * Toggle active status of a question (is_active = false hides without deleting history)
 */
export async function setReadingQuestionActive(
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
export async function saveReadingQuestionOrder(
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
 * Toggle Reading Lesson published status (Validates before publishing!)
 */
export async function setReadingLessonPublished(
  lessonId: string,
  is_published: boolean
): Promise<{ success: boolean; error: string | null; warnings?: string[] }> {
  try {
    if (is_published) {
      const { data: lesson, error: fetchErr } = await getAdminReadingLesson(lessonId);
      if (fetchErr || !lesson) {
        return { success: false, error: 'Không tìm thấy bài Reading để xuất bản.' };
      }

      const { data: questions } = await getAdminReadingQuestions(lessonId);

      const cmsInput: ReadingLessonCMSInput = {
        title: lesson.title,
        slug: lesson.slug,
        level: lesson.level,
        toeic_part: lesson.toeic_part || 'part5',
        passage: lesson.passage,
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

      const validation = validateReadingLessonForPublish(cmsInput);

      if (!validation.canPublish) {
        const firstErrKey = Object.keys(validation.errors)[0];
        return { success: false, error: validation.errors[firstErrKey] };
      }

      const { error } = await supabase
        .from('learning_lessons')
        .update({ is_published })
        .eq('id', lessonId);

      if (error) {
        return { success: false, error: 'Không thể xuất bản bài Reading.' };
      }

      return { success: true, error: null, warnings: validation.warnings };
    }

    const { error } = await supabase
      .from('learning_lessons')
      .update({ is_published })
      .eq('id', lessonId);

    if (error) {
      return { success: false, error: 'Không thể ẩn bài Reading.' };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: 'Lỗi không xác định khi xuất bản bài Reading.' };
  }
}
