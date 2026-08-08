/**
 * Admin Import Service Layer for Phase 3.5 Bulk Content Import Center
 * Preflight database duplicate checking & Create-Only Batch Writing.
 * STRICT RULE: CREATE-ONLY (No update, no delete, no upsert). ALL content is FORCED DRAFT.
 */

import { supabase } from './client';
import {
  ImportContentType,
  ImportExecutionResult,
  ImportParsedRecord,
  ImportPlan,
} from '../cms/import/types';

/**
 * Perform bounded batch duplicate check against existing database records
 */
export async function preflightDatabaseDuplicates(
  contentType: ImportContentType,
  records: ImportParsedRecord[],
  targetDeckId?: string
): Promise<ImportParsedRecord[]> {
  try {
    if (contentType === 'vocabulary') {
      if (!targetDeckId) return records;

      const words = records
        .filter((r) => r.status !== 'ERROR' && r.data.word)
        .map((r) => r.data.word.trim().toLowerCase());

      if (words.length === 0) return records;

      const { data: existing, error } = await supabase
        .from('vocabulary_items')
        .select('word')
        .eq('deck_id', targetDeckId)
        .in('word', words);

      if (!error && existing && existing.length > 0) {
        const existingWordSet = new Set(existing.map((item) => item.word.trim().toLowerCase()));

        return records.map((rec) => {
          if (rec.status === 'ERROR') return rec;
          const w = (rec.data.word || '').trim().toLowerCase();
          if (existingWordSet.has(w)) {
            return {
              ...rec,
              status: 'CONFLICT',
              errors: [
                ...rec.errors,
                { field: 'word', message: `Từ vựng "${rec.data.word}" đã tồn tại trong bộ từ vựng này.` },
              ],
              selected: false,
            };
          }
          return rec;
        });
      }
    } else {
      const slugs = records
        .filter((r) => r.status !== 'ERROR' && r.data.slug)
        .map((r) => r.data.slug.trim().toLowerCase());

      if (slugs.length === 0) return records;

      const { data: existing, error } = await supabase
        .from('learning_lessons')
        .select('slug')
        .eq('kind', contentType)
        .in('slug', slugs);

      if (!error && existing && existing.length > 0) {
        const existingSlugSet = new Set(existing.map((item) => item.slug.trim().toLowerCase()));

        return records.map((rec) => {
          if (rec.status === 'ERROR') return rec;
          const s = (rec.data.slug || '').trim().toLowerCase();
          if (existingSlugSet.has(s)) {
            return {
              ...rec,
              status: 'CONFLICT',
              errors: [
                ...rec.errors,
                { field: 'slug', message: `Slug URL "${rec.data.slug}" đã tồn tại trên hệ thống.` },
              ],
              selected: false,
            };
          }
          return rec;
        });
      }
    }

    return records;
  } catch (err: any) {
    console.error('[ORI CMS] Exception in preflight database duplicates:', err);
    return records;
  }
}

/**
 * Execute Import Plan — Create-Only Batch Writing
 */
export async function executeImportPlan(
  plan: ImportPlan,
  targetDeckId?: string,
  onProgress?: (current: number, total: number) => void
): Promise<ImportExecutionResult> {
  const selectedRecords = plan.records.filter((r) => r.selected && r.status !== 'ERROR' && r.status !== 'CONFLICT');
  const totalProcessed = selectedRecords.length;

  if (totalProcessed === 0) {
    return {
      totalProcessed: 0,
      successCount: 0,
      failedCount: 0,
      errors: [{ rowIndex: 0, error: 'Không có bản ghi hợp lệ nào được chọn để nhập.' }],
      details: [],
    };
  }

  let successCount = 0;
  let failedCount = 0;
  const errors: Array<{ rowIndex: number; error: string }> = [];
  const details: any[] = [];

  if (plan.contentType === 'vocabulary') {
    if (!targetDeckId) {
      return {
        totalProcessed: 0,
        successCount: 0,
        failedCount: 0,
        errors: [{ rowIndex: 0, error: 'Vui lòng chọn Bộ từ vựng mục tiêu trước khi nhập.' }],
        details: [],
      };
    }

    // Vocabulary Batch Insert (100 per chunk)
    const chunkSize = 100;
    for (let i = 0; i < selectedRecords.length; i += chunkSize) {
      const chunk = selectedRecords.slice(i, i + chunkSize);
      const payload = chunk.map((r) => ({
        deck_id: targetDeckId,
        word: r.data.word.trim(),
        ipa: r.data.ipa ? r.data.ipa.trim() : null,
        part_of_speech: r.data.part_of_speech ? r.data.part_of_speech.trim() : null,
        meaning_vi: r.data.meaning_vi.trim(),
        example_en: r.data.example_en ? r.data.example_en.trim() : null,
        example_vi: r.data.example_vi ? r.data.example_vi.trim() : null,
        topic: r.data.topic ? r.data.topic.trim() : null,
        toeic_parts: Array.isArray(r.data.toeic_parts) ? r.data.toeic_parts : [],
        collocations: Array.isArray(r.data.collocations) ? r.data.collocations : [],
        common_mistake: r.data.common_mistake ? r.data.common_mistake.trim() : null,
        audio_url: r.data.audio_url ? r.data.audio_url.trim() : null,
        sort_order: r.data.sort_order ?? 0,
        is_published: false, // FORCED DRAFT
      }));

      const { data, error } = await supabase
        .from('vocabulary_items')
        .insert(payload)
        .select('*');

      if (error) {
        chunk.forEach((r) => {
          failedCount++;
          errors.push({ rowIndex: r.rowIndex, error: error.message });
        });
      } else {
        successCount += chunk.length;
        if (data) details.push(...data);
      }

      if (onProgress) {
        onProgress(Math.min(i + chunkSize, selectedRecords.length), selectedRecords.length);
      }
    }
  } else if (plan.contentType === 'grammar') {
    // Grammar Lesson Insert
    for (let i = 0; i < selectedRecords.length; i++) {
      const r = selectedRecords[i];
      const payload = {
        kind: 'grammar' as const,
        title: r.data.title.trim(),
        slug: r.data.slug.trim(),
        level: r.data.level.trim().toLowerCase(),
        sort_order: r.data.sort_order ?? 0,
        is_published: false, // FORCED DRAFT
        lesson_content: {
          summary: r.data.summary || '',
          skill_tag: r.data.skill_tag || r.data.title,
          sections: (r.data.sections || []).map((s: any, idx: number) => ({
            key: `section_${Date.now()}_${idx}`,
            heading: s.heading || '',
            body: s.body || '',
            examples: Array.isArray(s.examples) ? s.examples : [],
          })),
          quiz: (r.data.quiz || []).map((q: any, idx: number) => ({
            key: `q_${Date.now()}_${idx}`,
            question: q.question || '',
            options: Array.isArray(q.options) ? q.options : [],
            answer: q.answer || '',
            explanation: q.explanation || '',
          })),
        },
      };

      const { data, error } = await supabase
        .from('learning_lessons')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        failedCount++;
        errors.push({ rowIndex: r.rowIndex, error: error.message });
      } else {
        successCount++;
        if (data) details.push(data);
      }

      if (onProgress) {
        onProgress(i + 1, selectedRecords.length);
      }
    }
  } else {
    // Listening / Reading Atomic RPC Insert
    for (let i = 0; i < selectedRecords.length; i++) {
      const r = selectedRecords[i];
      const lessonPayload = {
        kind: plan.contentType,
        title: r.data.title.trim(),
        slug: r.data.slug.trim(),
        level: r.data.level.trim().toLowerCase(),
        toeic_part: r.data.toeic_part,
        passage: r.data.passage || null,
        transcript: r.data.transcript || null,
        audio_url: r.data.audio_url || null,
        sort_order: r.data.sort_order ?? 0,
      };

      const questionsPayload = (r.data.questions || []).map((q: any, qIdx: number) => ({
        question_text: (q.question_text || '').trim(),
        options: Array.isArray(q.options) ? q.options.map((o: any) => String(o || '').trim()) : [],
        correct_answer: (q.correct_answer || '').trim(),
        explanation: q.explanation ? String(q.explanation).trim() : null,
        sort_order: typeof q.sort_order === 'number' ? q.sort_order : qIdx,
        skill_tag: q.skill_tag ? String(q.skill_tag).trim() : null,
        topic: q.topic ? String(q.topic).trim() : null,
        image_url: q.image_url ? String(q.image_url).trim() : null,
      }));

      // Call Atomic RPC
      const { data, error } = await supabase.rpc('admin_create_learning_lesson_with_questions', {
        lesson_payload: lessonPayload,
        questions_payload: questionsPayload,
      });

      if (error) {
        // Fallback: If RPC fails or is pending migration, fallback to sequential inserts
        console.warn('[ORI CMS] Atomic RPC unavailable or failed. Falling back to sequential inserts:', error.message);
        
        const { data: fallbackLesson, error: lErr } = await supabase
          .from('learning_lessons')
          .insert({
            ...lessonPayload,
            is_published: false,
          })
          .select('*')
          .single();

        if (lErr || !fallbackLesson) {
          failedCount++;
          errors.push({ rowIndex: r.rowIndex, error: lErr?.message || 'Không thể tạo bài học.' });
        } else {
          if (questionsPayload.length > 0) {
            const qInsertPayload = questionsPayload.map((q: any) => ({
              lesson_id: fallbackLesson.id,
              ...q,
              is_active: true,
            }));
            await supabase.from('lesson_questions').insert(qInsertPayload);
          }
          successCount++;
          details.push(fallbackLesson);
        }
      } else {
        successCount++;
        if (data) details.push(data);
      }

      if (onProgress) {
        onProgress(i + 1, selectedRecords.length);
      }
    }
  }

  return {
    totalProcessed,
    successCount,
    failedCount,
    errors,
    details,
  };
}
