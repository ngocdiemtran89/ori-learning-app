-- Migration: 20260808_phase3_toeic_classifier.sql
-- Description: Phase 3.5D — Automatic TOEIC Test Classifier RPC

create or replace function public.admin_create_toeic_test_with_content(
  test_payload jsonb,
  groups_payload jsonb,
  questions_payload jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_test_id uuid;
  v_slug text;
  v_group jsonb;
  v_question jsonb;
  v_group_uuid uuid;
  v_temp_key text;
  v_group_mapping jsonb := '{}'::jsonb;
  v_group_parts jsonb := '{}'::jsonb;
begin
  -- 1. Security Check
  if not public.is_admin() then
    raise exception 'Unauthorized: Only admins can import TOEIC tests';
  end if;

  -- 2. Payload Shape Validation
  if jsonb_typeof(test_payload) != 'object' then
    raise exception 'test_payload must be a JSON object';
  end if;
  if jsonb_typeof(groups_payload) != 'array' then
    raise exception 'groups_payload must be a JSON array';
  end if;
  if jsonb_typeof(questions_payload) != 'array' then
    raise exception 'questions_payload must be a JSON array';
  end if;

  -- 3. Extract Slug and Pre-flight Check
  v_slug := test_payload->>'slug';
  if v_slug is null or trim(v_slug) = '' then
    raise exception 'slug must be a non-empty string';
  end if;
  v_slug := trim(v_slug);

  if exists (select 1 from public.toeic_tests where slug = v_slug) then
    raise exception 'Conflict: A test with slug "%" already exists', v_slug;
  end if;

  -- 4. Insert Test
  -- Force status = 'draft' and is_published = false to ensure safety
  insert into public.toeic_tests (
    title,
    slug,
    test_code,
    description,
    test_type,
    status,
    is_published,
    sort_order
  ) values (
    test_payload->>'title',
    v_slug,
    test_payload->>'test_code',
    test_payload->>'description',
    coalesce(test_payload->>'test_type', 'full'),
    'draft',
    false,
    coalesce((test_payload->>'sort_order')::integer, 0)
  ) returning id into v_test_id;

  -- 5. Insert Groups and Build Temp-Key Mapping
  if jsonb_typeof(groups_payload) = 'array' then
    for v_group in select * from jsonb_array_elements(groups_payload)
    loop
      v_temp_key := v_group->>'group_temp_key';
      if v_temp_key is null or trim(v_temp_key) = '' then
        raise exception 'group_temp_key must be non-empty';
      end if;

      if v_group_mapping ? v_temp_key then
        raise exception 'Duplicate group_temp_key: %', v_temp_key;
      end if;
      
      insert into public.toeic_test_groups (
        test_id,
        part,
        group_type,
        title,
        instruction,
        passage,
        transcript,
        audio_url,
        image_url,
        documents,
        sort_order,
        is_active
      ) values (
        v_test_id,
        v_group->>'part',
        v_group->>'group_type',
        v_group->>'title',
        v_group->>'instruction',
        v_group->>'passage',
        v_group->>'transcript',
        v_group->>'audio_url',
        v_group->>'image_url',
        coalesce(v_group->'documents', '[]'::jsonb),
        coalesce((v_group->>'sort_order')::integer, 0),
        true
      ) returning id into v_group_uuid;

      if v_temp_key is not null then
        v_group_mapping := jsonb_set(v_group_mapping, array[v_temp_key], to_jsonb(v_group_uuid));
        v_group_parts := jsonb_set(v_group_parts, array[v_temp_key], to_jsonb(v_group->>'part'));
      end if;
    end loop;
  end if;

  -- 6. Insert Questions
  if jsonb_typeof(questions_payload) = 'array' then
    for v_question in select * from jsonb_array_elements(questions_payload)
    loop
      if (v_question->>'question_number') is null then
        raise exception 'question_number is required';
      end if;
      if (v_question->>'part') is null then
        raise exception 'part is required';
      end if;
      if jsonb_typeof(v_question->'options') != 'array' then
        raise exception 'options must be a JSON array';
      end if;
      if (v_question->>'correct_answer') is null then
        raise exception 'correct_answer is required';
      end if;

      v_temp_key := v_question->>'group_temp_key';
      v_group_uuid := null;
      
      if v_temp_key is not null then
        v_group_uuid := (v_group_mapping->>v_temp_key)::uuid;
        if v_group_uuid is null then
           raise exception 'Invalid group_temp_key referenced: %', v_temp_key;
        end if;
        if (v_question->>'part') != (v_group_parts->>v_temp_key) then
           raise exception 'Question part (%) does not match group part (%) for group_temp_key: %',
             v_question->>'part', v_group_parts->>v_temp_key, v_temp_key;
        end if;
      end if;

      insert into public.toeic_test_questions (
        test_id,
        group_id,
        question_number,
        part,
        question_text,
        options,
        correct_answer,
        explanation,
        skill_tag,
        topic,
        difficulty,
        audio_url,
        image_url,
        sort_order,
        is_active
      ) values (
        v_test_id,
        v_group_uuid,
        (v_question->>'question_number')::integer,
        v_question->>'part',
        v_question->>'question_text',
        coalesce(v_question->'options', '[]'::jsonb),
        v_question->>'correct_answer',
        v_question->>'explanation',
        v_question->>'skill_tag',
        v_question->>'topic',
        v_question->>'difficulty',
        v_question->>'audio_url',
        v_question->>'image_url',
        coalesce((v_question->>'sort_order')::integer, 0),
        true
      );
    end loop;
  end if;

  return jsonb_build_object('success', true, 'test_id', v_test_id);
end;
$$;

-- Secure Execute Permissions
revoke execute on function public.admin_create_toeic_test_with_content(jsonb, jsonb, jsonb) from public;
revoke execute on function public.admin_create_toeic_test_with_content(jsonb, jsonb, jsonb) from anon;
grant execute on function public.admin_create_toeic_test_with_content(jsonb, jsonb, jsonb) to authenticated;
