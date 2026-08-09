-- ============================================================
-- Phase P3.5H: Admin Answer Key Import for Existing TOEIC Test
-- MIGRATION FILE: 20260809_phase3_toeic_answer_key_import.sql
-- ============================================================
-- Functions:
--   1. admin_import_toeic_answer_key(uuid, jsonb, text)
-- ============================================================

create or replace function public.admin_import_toeic_answer_key(
  p_test_id uuid,
  p_answers jsonb,
  p_mode text default 'full'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test_published boolean;
  v_total_received integer := 0;
  v_updated_count integer := 0;
  v_unchanged_count integer := 0;
  v_item jsonb;
  v_q_num integer;
  v_new_ans text;
  v_curr_ans text;
  v_q_id uuid;
begin
  -- 1. Security check: Admin only
  if not public.is_admin() then
    raise exception 'Permission denied: admin only';
  end if;

  -- 2. Published check: Cannot mutate published test
  select is_published into v_test_published
  from public.toeic_tests
  where id = p_test_id;

  if v_test_published is null then
    raise exception 'Test not found';
  end if;

  if v_test_published is true then
    raise exception 'Cannot update answer key on published test. Unpublish test first.';
  end if;

  -- 3. Input validation
  v_total_received := jsonb_array_length(p_answers);

  if p_mode = 'full' and v_total_received <> 200 then
    raise exception 'Full mode requires exactly 200 answers (received %)', v_total_received;
  end if;

  -- 4. Atomic batch update
  for v_item in select * from jsonb_array_elements(p_answers)
  loop
    v_q_num := (v_item->>'question_number')::integer;
    v_new_ans := upper(trim(v_item->>'correct_answer'));

    if v_q_num is null or v_q_num < 1 or v_q_num > 200 then
      raise exception 'Invalid question number: %', v_item->>'question_number';
    end if;

    if v_new_ans not in ('A', 'B', 'C', 'D') then
      raise exception 'Invalid answer label for question %: %', v_q_num, v_new_ans;
    end if;

    select id, correct_answer into v_q_id, v_curr_ans
    from public.toeic_test_questions
    where test_id = p_test_id and question_number = v_q_num and is_active = true;

    if v_q_id is null then
      raise exception 'Question % not found or inactive in target test', v_q_num;
    end if;

    -- Update correct answer if changed
    if v_curr_ans is distinct from v_new_ans then
      update public.toeic_test_questions
      set correct_answer = v_new_ans,
          updated_at = now()
      where id = v_q_id;

      v_updated_count := v_updated_count + 1;
    else
      v_unchanged_count := v_unchanged_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'total_received', v_total_received,
    'updated_count', v_updated_count,
    'unchanged_count', v_unchanged_count
  );
end;
$$;

-- Permissions
revoke execute on function public.admin_import_toeic_answer_key(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_import_toeic_answer_key(uuid, jsonb, text) to authenticated;
