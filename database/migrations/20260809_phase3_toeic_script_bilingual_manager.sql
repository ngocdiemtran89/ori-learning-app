-- ============================================================
-- Phase P3.5I: Admin Script & Bilingual Content Manager RPC
-- Description: Atomic server-side update of English scripts, prompts, options, explanations & Vietnamese translations
-- Target Tables: toeic_test_questions, toeic_test_groups
-- Security: SECURITY DEFINER, SET search_path = '', auth.uid() admin check, published test protection
-- ============================================================

create or replace function public.admin_import_toeic_learning_content(
  p_test_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_test record;
  v_item jsonb;
  v_q_id uuid;
  v_g_id uuid;
  v_q_count integer := 0;
  v_g_count integer := 0;
  v_q record;
  v_g record;
  v_start_q integer;
  v_end_q integer;
  v_match_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.is_admin() then raise exception 'Unauthorized: Admin access required'; end if;

  select id, is_published into v_test
  from public.toeic_tests where id = p_test_id;

  if v_test is null then
    raise exception 'Test not found';
  end if;

  if v_test.is_published then
    raise exception 'Cannot update script or bilingual content on a published test. Please unpublish first.';
  end if;

  -- 1. QUESTIONS ATOMIC UPDATE
  if p_payload->'questions' is not null and jsonb_typeof(p_payload->'questions') = 'array' then
    for v_item in select * from jsonb_array_elements(p_payload->'questions')
    loop
      v_q_id := case when v_item->>'id' is not null then (v_item->>'id')::uuid else null end;

      if v_q_id is null and v_item->>'question_number' is not null then
        select count(*) into v_match_count
        from public.toeic_test_questions
        where test_id = p_test_id and question_number = (v_item->>'question_number')::integer and is_active = true;

        if v_match_count = 1 then
          select id into v_q_id
          from public.toeic_test_questions
          where test_id = p_test_id and question_number = (v_item->>'question_number')::integer and is_active = true;
        end if;
      end if;

      if v_q_id is not null then
        select id, test_id into v_q
        from public.toeic_test_questions where id = v_q_id and test_id = p_test_id;

        if v_q is not null then
          update public.toeic_test_questions set
            question_text = coalesce(v_item->>'question_text', question_text),
            options = case when v_item->'options' is not null then v_item->'options' else options end,
            translation_vi = case when v_item->>'translation_vi' is not null then v_item->>'translation_vi' else translation_vi end,
            options_vi = case when v_item->'options_vi' is not null then v_item->'options_vi' else options_vi end,
            explanation = case when v_item->>'explanation' is not null then v_item->>'explanation' else explanation end,
            updated_at = now()
          where id = v_q_id;

          v_q_count := v_q_count + 1;
        end if;
      end if;
    end loop;
  end if;

  -- 2. GROUPS ATOMIC UPDATE
  if p_payload->'groups' is not null and jsonb_typeof(p_payload->'groups') = 'array' then
    for v_item in select * from jsonb_array_elements(p_payload->'groups')
    loop
      v_g_id := case when v_item->>'id' is not null then (v_item->>'id')::uuid else null end;

      if v_g_id is null and v_item->>'start_question' is not null and v_item->>'end_question' is not null then
        v_start_q := (v_item->>'start_question')::integer;
        v_end_q := (v_item->>'end_question')::integer;

        select count(*) into v_match_count
        from public.toeic_test_groups g
        where g.test_id = p_test_id and g.is_active = true
          and (
            select min(q.question_number) from public.toeic_test_questions q
            where q.group_id = g.id and q.is_active = true
          ) = v_start_q
          and (
            select max(q.question_number) from public.toeic_test_questions q
            where q.group_id = g.id and q.is_active = true
          ) = v_end_q;

        if v_match_count = 1 then
          select g.id into v_g_id
          from public.toeic_test_groups g
          where g.test_id = p_test_id and g.is_active = true
            and (
              select min(q.question_number) from public.toeic_test_questions q
              where q.group_id = g.id and q.is_active = true
            ) = v_start_q
            and (
              select max(q.question_number) from public.toeic_test_questions q
              where q.group_id = g.id and q.is_active = true
            ) = v_end_q;
        end if;
      end if;

      if v_g_id is not null then
        select id, test_id into v_g
        from public.toeic_test_groups where id = v_g_id and test_id = p_test_id;

        if v_g is not null then
          update public.toeic_test_groups set
            transcript = case when v_item->>'transcript' is not null then v_item->>'transcript' else transcript end,
            transcript_vi = case when v_item->>'transcript_vi' is not null then v_item->>'transcript_vi' else transcript_vi end,
            instruction = case when v_item->>'instruction' is not null then v_item->>'instruction' else instruction end,
            instruction_vi = case when v_item->>'instruction_vi' is not null then v_item->>'instruction_vi' else instruction_vi end,
            passage = case when v_item->>'passage' is not null then v_item->>'passage' else passage end,
            passage_vi = case when v_item->>'passage_vi' is not null then v_item->>'passage_vi' else passage_vi end,
            documents = case when v_item->'documents' is not null then v_item->'documents' else documents end,
            documents_vi = case when v_item->'documents_vi' is not null then v_item->'documents_vi' else documents_vi end,
            updated_at = now()
          where id = v_g_id;

          v_g_count := v_g_count + 1;
        end if;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'success', true,
    'updated_questions', v_q_count,
    'updated_groups', v_g_count
  );
end;
$$;

revoke execute on function public.admin_import_toeic_learning_content(uuid, jsonb) from public, anon;
grant execute on function public.admin_import_toeic_learning_content(uuid, jsonb) to authenticated;
