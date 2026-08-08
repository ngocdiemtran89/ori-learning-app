/**
 * Data Layer for Phase 3.5C TOEIC Test Bank Admin CMS
 * STRICT RULE: NO HARD DELETE (.delete() is strictly forbidden).
 */

import { supabase } from './client';
import {
  ToeicTestInput,
  ToeicTestGroupInput,
  ToeicTestQuestionInput,
  validateToeicTestDraft,
  validateToeicTestGroup,
  validateToeicTestQuestion,
  normalizeToeicPart,
} from '../cms/testBankValidation';

export interface ToeicTestRow {
  id: string;
  title: string;
  slug: string;
  test_code: string | null;
  description: string | null;
  test_type: string;
  status: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  questions_count?: number;
}

export interface GetToeicTestsOptions {
  searchQuery?: string;
  statusFilter?: 'all' | 'published' | 'draft';
  testTypeFilter?: 'all' | 'full' | 'mini' | 'custom';
  page?: number;
  pageSize?: number;
}

export interface PaginatedToeicTests {
  tests: ToeicTestRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function sanitizeSearchQuery(query: string): string {
  return query.replace(/[,()%]/g, '').trim();
}

/**
 * Fetch paginated TOEIC tests for Admin CMS
 */
export async function getAdminToeicTests(
  options: GetToeicTestsOptions = {}
): Promise<{ data: PaginatedToeicTests | null; error: string | null }> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabase
      .from('toeic_tests')
      .select('*', { count: 'exact' });

    if (options.statusFilter === 'published') {
      query = query.eq('is_published', true);
    } else if (options.statusFilter === 'draft') {
      query = query.eq('is_published', false);
    }

    if (options.testTypeFilter && options.testTypeFilter !== 'all') {
      query = query.eq('test_type', options.testTypeFilter);
    }

    if (options.searchQuery && options.searchQuery.trim()) {
      const clean = sanitizeSearchQuery(options.searchQuery);
      if (clean) {
        query = query.or(`title.ilike.%${clean}%,slug.ilike.%${clean}%,test_code.ilike.%${clean}%`);
      }
    }

    query = query.order('sort_order', { ascending: true }).order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('[ORI TestBank] Error fetching tests:', error.message);
      return { data: null, error: 'Không thể tải danh sách đề thi.' };
    }

    const tests = (data || []) as ToeicTestRow[];

    // Fetch question counts
    if (tests.length > 0) {
      const testIds = tests.map((t) => t.id);
      const { data: qCounts } = await supabase
        .from('toeic_test_questions')
        .select('test_id')
        .in('test_id', testIds)
        .eq('is_active', true);

      if (qCounts) {
        const countMap: Record<string, number> = {};
        qCounts.forEach((q) => {
          countMap[q.test_id] = (countMap[q.test_id] || 0) + 1;
        });
        tests.forEach((t) => {
          t.questions_count = countMap[t.id] || 0;
        });
      }
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      data: { tests, totalCount, page, pageSize, totalPages },
      error: null,
    };
  } catch (err: any) {
    console.error('[ORI TestBank] Exception fetching tests:', err);
    return { data: null, error: 'Lỗi khi tải danh sách đề thi.' };
  }
}

/**
 * Fetch a single TOEIC test header
 */
export async function getAdminToeicTest(testId: string): Promise<{ data: ToeicTestRow | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('toeic_tests')
      .select('*')
      .eq('id', testId)
      .maybeSingle();

    if (error || !data) {
      return { data: null, error: 'Không tìm thấy đề thi.' };
    }
    return { data: data as ToeicTestRow, error: null };
  } catch (err: any) {
    return { data: null, error: 'Lỗi khi lấy thông tin đề thi.' };
  }
}

/**
 * Create a new TOEIC test
 */
export async function createToeicTest(input: ToeicTestInput): Promise<{ data: ToeicTestRow | null; error: string | null }> {
  const val = validateToeicTestDraft(input);
  if (!val.isValid) {
    const firstErr = Object.values(val.errors)[0];
    return { data: null, error: firstErr };
  }

  try {
    const { data: existing } = await supabase
      .from('toeic_tests')
      .select('id')
      .eq('slug', input.slug.trim())
      .maybeSingle();

    if (existing) {
      return { data: null, error: `Slug "${input.slug}" đã tồn tại.` };
    }

    const { data, error } = await supabase
      .from('toeic_tests')
      .insert({
        title: input.title.trim(),
        slug: input.slug.trim(),
        test_code: input.test_code?.trim() || null,
        description: input.description?.trim() || null,
        test_type: input.test_type || 'full',
        status: input.status || 'draft',
        sort_order: input.sort_order ?? 0,
        is_published: input.is_published ?? false,
      })
      .select('*')
      .single();

    if (error) {
      return { data: null, error: 'Không thể tạo đề thi mới.' };
    }
    return { data: data as ToeicTestRow, error: null };
  } catch (err: any) {
    return { data: null, error: 'Lỗi khi tạo đề thi.' };
  }
}

/**
 * Update existing TOEIC test
 */
export async function updateToeicTest(
  testId: string,
  input: ToeicTestInput
): Promise<{ data: ToeicTestRow | null; error: string | null }> {
  const val = validateToeicTestDraft(input);
  if (!val.isValid) {
    const firstErr = Object.values(val.errors)[0];
    return { data: null, error: firstErr };
  }

  try {
    const { data: existing } = await supabase
      .from('toeic_tests')
      .select('id')
      .eq('slug', input.slug.trim())
      .neq('id', testId)
      .maybeSingle();

    if (existing) {
      return { data: null, error: `Slug "${input.slug}" đã tồn tại.` };
    }

    const { data, error } = await supabase
      .from('toeic_tests')
      .update({
        title: input.title.trim(),
        slug: input.slug.trim(),
        test_code: input.test_code?.trim() || null,
        description: input.description?.trim() || null,
        test_type: input.test_type || 'full',
        status: input.status || 'draft',
        sort_order: input.sort_order ?? 0,
        is_published: input.is_published ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', testId)
      .select('*')
      .single();

    if (error) {
      return { data: null, error: 'Không thể cập nhật đề thi.' };
    }
    return { data: data as ToeicTestRow, error: null };
  } catch (err: any) {
    return { data: null, error: 'Lỗi khi cập nhật đề thi.' };
  }
}

/**
 * Set test published status
 */
export async function setToeicTestPublished(
  testId: string,
  is_published: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const status = is_published ? 'published' : 'ready';
    const { error } = await supabase
      .from('toeic_tests')
      .update({ is_published, status, updated_at: new Date().toISOString() })
      .eq('id', testId);

    if (error) {
      return { success: false, error: 'Không thể cập nhật trạng thái xuất bản.' };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: 'Lỗi khi cập nhật trạng thái test bank.' };
  }
}

/**
 * Delete a draft TOEIC test (Phase 3.5D)
 */
export async function deleteDraftToeicTest(testId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_delete_draft_toeic_test', {
      p_test_id: testId
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('deleteDraftToeicTest testId:', testId);
      console.log('deleteDraftToeicTest RPC data:', data);
      console.log('deleteDraftToeicTest RPC error:', error);
    }

    if (error) {
      return { success: false, error: `Lỗi Database: ${error.message}` };
    }

    if (!data || data.success !== true) {
      return { success: false, error: data?.error || 'Lỗi không xác định từ Database.' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi hệ thống khi xóa đề nháp.' };
  }
}


/**
 * Fetch all groups for a TOEIC test
 */
export async function getToeicTestGroups(testId: string): Promise<{ data: any[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('toeic_test_groups')
      .select('*')
      .eq('test_id', testId)
      .order('sort_order', { ascending: true });

    if (error) {
      return { data: null, error: 'Không thể tải danh sách nhóm câu hỏi.' };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: 'Lỗi khi tải nhóm câu hỏi.' };
  }
}

/**
 * Save / Update a TOEIC Test Group
 */
export async function saveToeicTestGroup(
  testId: string,
  input: ToeicTestGroupInput
): Promise<{ data: any | null; error: string | null }> {
  const val = validateToeicTestGroup(input);
  if (!val.isValid) {
    return { data: null, error: val.errors[0] };
  }

  try {
    const payload = {
      test_id: testId,
      part: normalizeToeicPart(input.part),
      group_type: input.group_type.trim(),
      title: input.title?.trim() || null,
      instruction: input.instruction?.trim() || null,
      passage: input.passage?.trim() || null,
      transcript: input.transcript?.trim() || null,
      audio_url: input.audio_url?.trim() || null,
      image_url: input.image_url?.trim() || null,
      documents: Array.isArray(input.documents) ? input.documents : [],
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { data, error } = await supabase
        .from('toeic_test_groups')
        .update(payload)
        .eq('id', input.id)
        .select('*')
        .single();

      if (error) return { data: null, error: 'Không thể cập nhật nhóm câu hỏi.' };
      return { data, error: null };
    }

    const { data, error } = await supabase
      .from('toeic_test_groups')
      .insert(payload)
      .select('*')
      .single();

    if (error) return { data: null, error: 'Không thể tạo nhóm câu hỏi mới.' };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: 'Lỗi khi lưu nhóm câu hỏi.' };
  }
}

/**
 * Toggle group active status (is_active = false hides without deleting)
 */
export async function setToeicTestGroupActive(
  groupId: string,
  is_active: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('toeic_test_groups')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', groupId);

    if (error) return { success: false, error: 'Không thể đổi trạng thái nhóm câu hỏi.' };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: 'Lỗi khi đổi trạng thái nhóm.' };
  }
}

/**
 * Fetch all questions for a TOEIC test
 */
export async function getToeicTestQuestions(testId: string): Promise<{ data: any[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('toeic_test_questions')
      .select('*')
      .eq('test_id', testId)
      .order('question_number', { ascending: true });

    if (error) {
      return { data: null, error: 'Không thể tải danh sách câu hỏi.' };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: 'Lỗi khi tải danh sách câu hỏi.' };
  }
}

/**
 * Save / Update a TOEIC Test Question
 */
export async function saveToeicTestQuestion(
  testId: string,
  input: ToeicTestQuestionInput
): Promise<{ data: any | null; error: string | null }> {
  const val = validateToeicTestQuestion(input);
  if (!val.isValid) {
    return { data: null, error: val.errors[0] };
  }

  try {
    const normPart = normalizeToeicPart(input.part);
    const options = Array.isArray(input.options) ? input.options.map((o) => String(o || '').trim()) : [];
    const payload = {
      test_id: testId,
      group_id: input.group_id || null,
      question_number: input.question_number,
      part: normPart,
      question_text: input.question_text?.trim() || null,
      options,
      correct_answer: input.correct_answer.trim(),
      explanation: input.explanation?.trim() || null,
      skill_tag: input.skill_tag?.trim() || null,
      topic: input.topic?.trim() || null,
      difficulty: input.difficulty?.trim() || null,
      audio_url: input.audio_url?.trim() || null,
      image_url: input.image_url?.trim() || null,
      sort_order: input.sort_order ?? input.question_number,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    if (input.is_active !== false) {
      let query = supabase
        .from('toeic_test_questions')
        .select('id')
        .eq('test_id', testId)
        .eq('question_number', input.question_number)
        .eq('is_active', true);
      
      if (input.id) {
        query = query.neq('id', input.id);
      }
      const { data: existingNum } = await query.maybeSingle();

      if (existingNum) {
        return { data: null, error: `Số thứ tự câu hỏi #${input.question_number} đang hoạt động đã tồn tại trong đề thi này.` };
      }
    }

    if (input.id) {
      const { data, error } = await supabase
        .from('toeic_test_questions')
        .update(payload)
        .eq('id', input.id)
        .select('*')
        .single();

      if (error) return { data: null, error: 'Không thể cập nhật câu hỏi.' };
      return { data, error: null };
    }

    const { data, error } = await supabase
      .from('toeic_test_questions')
      .insert(payload)
      .select('*')
      .single();

    if (error) return { data: null, error: 'Không thể tạo câu hỏi mới.' };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: 'Lỗi khi lưu câu hỏi.' };
  }
}

/**
 * Toggle question active status (is_active = false hides without deleting)
 */
export async function setToeicTestQuestionActive(
  questionId: string,
  is_active: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (is_active) {
      const { data: q } = await supabase.from('toeic_test_questions').select('test_id, question_number').eq('id', questionId).single();
      if (q) {
        const { data: existing } = await supabase.from('toeic_test_questions')
          .select('id')
          .eq('test_id', q.test_id)
          .eq('question_number', q.question_number)
          .eq('is_active', true)
          .neq('id', questionId)
          .maybeSingle();
        if (existing) {
          return { success: false, error: 'Đề đã có một câu đang hoạt động với số câu này.' };
        }
      }
    }

    const { error } = await supabase
      .from('toeic_test_questions')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', questionId);

    if (error) return { success: false, error: 'Không thể đổi trạng thái câu hỏi.' };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: 'Lỗi khi đổi trạng thái câu hỏi.' };
  }
}
