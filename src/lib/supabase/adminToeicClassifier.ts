import { supabase } from './client';
import { ParsedToeicTestDraft } from '../toeic/classifier/types';

export function buildToeicTestRpcPayload(draft: ParsedToeicTestDraft) {
  const testPayload = {
    title: draft.metadata.title,
    slug: draft.metadata.slug,
    test_code: draft.metadata.test_code,
    description: draft.metadata.description,
    test_type: draft.metadata.test_type
  };

  const groupsPayload = draft.groups.map(g => ({
    group_temp_key: g.group_temp_key,
    part: g.part,
    group_type: g.group_type,
    title: g.title,
    instruction: g.instruction,
    passage: g.passage,
    transcript: g.transcript,
    audio_url: g.audio_url,
    image_url: g.image_url,
    documents: g.documents
  }));

  const questionsPayload = draft.questions.map(q => ({
    group_temp_key: q.group_temp_key,
    question_number: q.question_number,
    part: q.part,
    question_text: q.question_text,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    audio_url: q.audio_url,
    image_url: q.image_url
  }));

  return { testPayload, groupsPayload, questionsPayload };
}

export async function importToeicTestDraft(
  draft: ParsedToeicTestDraft
): Promise<{ success: boolean; testId?: string; error?: string }> {
  try {
    // 1. Slug pre-flight check
    const slug = draft.metadata.slug;
    const { data: existing } = await supabase
      .from('toeic_tests')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return { success: false, error: `Slug "${slug}" đã tồn tại. Vui lòng chọn slug khác.` };
    }

    // 2. Prepare payloads using pure function
    const { testPayload, groupsPayload, questionsPayload } = buildToeicTestRpcPayload(draft);

    // 3. Call Atomic RPC
    const { data, error } = await supabase.rpc('admin_create_toeic_test_with_content', {
      test_payload: testPayload,
      groups_payload: groupsPayload,
      questions_payload: questionsPayload
    });

    if (error) {
      if (error.message.includes('function admin_create_toeic_test_with_content') || error.code === 'PGRST202') {
         return { success: false, error: 'Chức năng nhập đề TOEIC chưa được cấu hình đầy đủ trên hệ thống.' };
      }
      return { success: false, error: `Lỗi import Database: ${error.message}` };
    }

    if (data && data.success) {
      return { success: true, testId: data.test_id };
    }

    return { success: false, error: 'Lỗi không xác định khi import.' };

  } catch (err: any) {
    return { success: false, error: err.message || 'Có lỗi xảy ra.' };
  }
}
