-- Migration: 20260808_phase3_bulk_import.sql
-- Description: Adds atomic RPC admin_create_learning_lesson_with_questions for bulk Listening and Reading import.

create or replace function public.admin_create_learning_lesson_with_questions(
  lesson_payload jsonb,
  questions_payload jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_lesson_id uuid;
  v_kind text;
  v_slug text;
  v_title text;
  v_level text;
  v_toeic_part text;
  v_passage text;
  v_transcript text;
  v_audio_url text;
  v_sort_order int;
  v_created_lesson record;
  v_question jsonb;
  v_inserted_questions_count int := 0;
begin
  -- 1. Explicit admin check
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin privileges required.';
  end if;

  v_kind := lower(trim(coalesce(lesson_payload->>'kind', '')));
  if v_kind not in ('listening', 'reading') then
    raise exception 'Invalid lesson kind: must be listening or reading.';
  end if;

  v_slug := trim(coalesce(lesson_payload->>'slug', ''));
  if v_slug = '' then
    raise exception 'Lesson slug cannot be empty.';
  end if;

  -- 2. Reject existing slug conflict
  if exists (select 1 from public.learning_lessons where slug = v_slug) then
    raise exception 'Conflict: Lesson slug % already exists.', v_slug;
  end if;

  v_title := trim(coalesce(lesson_payload->>'title', ''));
  v_level := lower(trim(coalesce(lesson_payload->>'level', 'foundation')));
  v_toeic_part := lower(trim(coalesce(lesson_payload->>'toeic_part', '')));

  -- Validate TOEIC part against kind
  if v_kind = 'listening' and v_toeic_part not in ('part1', 'part2', 'part3', 'part4') then
    raise exception 'Invalid TOEIC Part % for Listening lesson.', v_toeic_part;
  end if;
  if v_kind = 'reading' and v_toeic_part not in ('part5', 'part6', 'part7') then
    raise exception 'Invalid TOEIC Part % for Reading lesson.', v_toeic_part;
  end if;

  v_passage := coalesce(lesson_payload->>'passage', null);
  v_transcript := coalesce(lesson_payload->>'transcript', null);
  v_audio_url := coalesce(lesson_payload->>'audio_url', null);
  v_sort_order := coalesce((lesson_payload->>'sort_order')::int, 0);

  -- 3. Insert learning_lessons row (forces is_published = false)
  insert into public.learning_lessons (
    kind,
    slug,
    title,
    level,
    toeic_part,
    passage,
    transcript,
    audio_url,
    is_published,
    sort_order
  ) values (
    v_kind,
    v_slug,
    v_title,
    v_level,
    v_toeic_part,
    v_passage,
    v_transcript,
    v_audio_url,
    false, -- ALWAYS FORCED DRAFT
    v_sort_order
  )
  returning * into v_created_lesson;

  v_lesson_id := v_created_lesson.id;

  -- 4. Insert lesson_questions rows
  if jsonb_typeof(questions_payload) = 'array' then
    for v_question in select * from jsonb_array_elements(questions_payload)
    loop
      insert into public.lesson_questions (
        lesson_id,
        question_text,
        options,
        correct_answer,
        explanation,
        sort_order,
        is_active,
        skill_tag,
        topic,
        image_url
      ) values (
        v_lesson_id,
        trim(coalesce(v_question->>'question_text', '')),
        coalesce(v_question->'options', '[]'::jsonb),
        trim(coalesce(v_question->>'correct_answer', '')),
        coalesce(v_question->>'explanation', null),
        coalesce((v_question->>'sort_order')::int, v_inserted_questions_count),
        true,
        coalesce(v_question->>'skill_tag', null),
        coalesce(v_question->>'topic', null),
        coalesce(v_question->>'image_url', null)
      );
      v_inserted_questions_count := v_inserted_questions_count + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'lesson_id', v_lesson_id,
    'slug', v_slug,
    'questions_count', v_inserted_questions_count
  );
end;
$$;

-- Explicit least-privilege RPC execution permissions
revoke execute on function public.admin_create_learning_lesson_with_questions(jsonb, jsonb) from public;
revoke execute on function public.admin_create_learning_lesson_with_questions(jsonb, jsonb) from anon;
grant execute on function public.admin_create_learning_lesson_with_questions(jsonb, jsonb) to authenticated;
