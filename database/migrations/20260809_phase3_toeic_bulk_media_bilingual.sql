-- ============================================================
-- Phase P3.5F: TOEIC Bulk Media, Dual Listening Source & Bilingual Foundation
-- NEW MIGRATION — DO NOT ALTER PREVIOUSLY APPLIED MIGRATIONS
-- ============================================================

-- ============================================================
-- 1. TOEIC TESTS — DUAL LISTENING MODE COLUMNS
-- ============================================================
alter table public.toeic_tests
  add column if not exists listening_audio_mode text not null default 'segmented'
    check (listening_audio_mode in ('segmented', 'single_track')),
  add column if not exists listening_audio_url text null;

-- ============================================================
-- 2. TOEIC TEST GROUPS — TRANSCRIPT TRANSLATION COLUMN
-- ============================================================
alter table public.toeic_test_groups
  add column if not exists transcript_vi text null;

-- ============================================================
-- 3. TOEIC LISTENING CUES TABLE
-- ============================================================
create table if not exists public.toeic_listening_cues (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.toeic_tests(id) on delete cascade,
  question_id uuid null references public.toeic_test_questions(id) on delete cascade,
  group_id uuid null references public.toeic_test_groups(id) on delete cascade,
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms > start_ms),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (question_id is not null and group_id is null) or
    (question_id is null and group_id is not null)
  )
);

create unique index if not exists idx_unique_cue_question
  on public.toeic_listening_cues (question_id)
  where question_id is not null;

create unique index if not exists idx_unique_cue_group
  on public.toeic_listening_cues (group_id)
  where group_id is not null;

create index if not exists idx_cues_test on public.toeic_listening_cues (test_id);
create index if not exists idx_cues_question on public.toeic_listening_cues (question_id);
create index if not exists idx_cues_group on public.toeic_listening_cues (group_id);

-- RLS
alter table public.toeic_listening_cues enable row level security;

drop policy if exists admin_cues_all on public.toeic_listening_cues;
drop policy if exists student_cues_select on public.toeic_listening_cues;

create policy admin_cues_all on public.toeic_listening_cues
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy student_cues_select on public.toeic_listening_cues
  for select to authenticated
  using (
    exists (
      select 1 from public.toeic_tests t
      where t.id = test_id and t.is_published = true
    )
  );

-- ============================================================
-- 4. RPC: admin_upsert_toeic_listening_cues
-- ============================================================
create or replace function public.admin_upsert_toeic_listening_cues(
  p_test_id uuid,
  p_cues jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_item jsonb;
  v_q_id uuid;
  v_g_id uuid;
  v_start_ms integer;
  v_end_ms integer;
  v_q record;
  v_g record;
  v_count integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.is_admin() then raise exception 'Unauthorized: Admin access required'; end if;

  if not exists (select 1 from public.toeic_tests where id = p_test_id) then
    raise exception 'Test not found';
  end if;

  if jsonb_typeof(p_cues) != 'array' then
    raise exception 'Payload must be a JSON array of cue objects';
  end if;

  for v_item in select * from jsonb_array_elements(p_cues)
  loop
    v_q_id := case when v_item->>'question_id' is not null then (v_item->>'question_id')::uuid else null end;
    v_g_id := case when v_item->>'group_id' is not null then (v_item->>'group_id')::uuid else null end;
    v_start_ms := (v_item->>'start_ms')::integer;
    v_end_ms := (v_item->>'end_ms')::integer;

    if v_start_ms is null or v_end_ms is null or v_start_ms < 0 or v_end_ms <= v_start_ms then
      raise exception 'Invalid cue timestamps (start_ms must be >= 0 and end_ms > start_ms)';
    end if;

    if (v_q_id is null and v_g_id is null) or (v_q_id is not null and v_g_id is not null) then
      raise exception 'Cue must target exactly one of question_id or group_id';
    end if;

    if v_q_id is not null then
      select id, test_id, part into v_q
      from public.toeic_test_questions
      where id = v_q_id;

      if v_q is null or v_q.test_id != p_test_id then
        raise exception 'Target question does not belong to this test';
      end if;

      if v_q.part not in ('part1', 'part2') then
        raise exception 'Question cue target must be Part 1 or Part 2';
      end if;

      insert into public.toeic_listening_cues (test_id, question_id, group_id, start_ms, end_ms, updated_at)
      values (p_test_id, v_q_id, null, v_start_ms, v_end_ms, now())
      on conflict (question_id) do update set
        start_ms = excluded.start_ms,
        end_ms = excluded.end_ms,
        updated_at = now();
    else
      select id, test_id, part into v_g
      from public.toeic_test_groups
      where id = v_g_id;

      if v_g is null or v_g.test_id != p_test_id then
        raise exception 'Target group does not belong to this test';
      end if;

      if v_g.part not in ('part3', 'part4') then
        raise exception 'Group cue target must be Part 3 or Part 4';
      end if;

      insert into public.toeic_listening_cues (test_id, question_id, group_id, start_ms, end_ms, updated_at)
      values (p_test_id, null, v_g_id, v_start_ms, v_end_ms, now())
      on conflict (group_id) do update set
        start_ms = excluded.start_ms,
        end_ms = excluded.end_ms,
        updated_at = now();
    end if;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('success', true, 'count', v_count);
end;
$$;

revoke execute on function public.admin_upsert_toeic_listening_cues(uuid, jsonb) from public;
revoke execute on function public.admin_upsert_toeic_listening_cues(uuid, jsonb) from anon;
grant execute on function public.admin_upsert_toeic_listening_cues(uuid, jsonb) to authenticated;

-- ============================================================
-- 5. RPC: admin_import_toeic_bilingual_content
-- ============================================================
create or replace function public.admin_import_toeic_bilingual_content(
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
  v_item jsonb;
  v_q_id uuid;
  v_g_id uuid;
  v_q_count integer := 0;
  v_g_count integer := 0;
  v_q record;
  v_g record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.is_admin() then raise exception 'Unauthorized: Admin access required'; end if;

  if not exists (select 1 from public.toeic_tests where id = p_test_id) then
    raise exception 'Test not found';
  end if;

  -- Questions bilingual update
  if p_payload->'questions' is not null and jsonb_typeof(p_payload->'questions') = 'array' then
    for v_item in select * from jsonb_array_elements(p_payload->'questions')
    loop
      v_q_id := (v_item->>'id')::uuid;
      if v_q_id is null then
        select id into v_q_id
        from public.toeic_test_questions
        where test_id = p_test_id and question_number = (v_item->>'question_number')::integer;
      end if;

      if v_q_id is not null then
        select id, test_id into v_q
        from public.toeic_test_questions where id = v_q_id;

        if v_q is not null and v_q.test_id = p_test_id then
          update public.toeic_test_questions set
            translation_vi = coalesce(v_item->>'translation_vi', translation_vi),
            options_vi = case when v_item->'options_vi' is not null then v_item->'options_vi' else options_vi end,
            updated_at = now()
          where id = v_q_id;
          v_q_count := v_q_count + 1;
        end if;
      end if;
    end loop;
  end if;

  -- Groups bilingual update
  if p_payload->'groups' is not null and jsonb_typeof(p_payload->'groups') = 'array' then
    for v_item in select * from jsonb_array_elements(p_payload->'groups')
    loop
      v_g_id := (v_item->>'id')::uuid;

      if v_g_id is not null then
        select id, test_id into v_g
        from public.toeic_test_groups where id = v_g_id;

        if v_g is not null and v_g.test_id = p_test_id then
          update public.toeic_test_groups set
            instruction_vi = coalesce(v_item->>'instruction_vi', instruction_vi),
            passage_vi = coalesce(v_item->>'passage_vi', passage_vi),
            documents_vi = case when v_item->'documents_vi' is not null then v_item->'documents_vi' else documents_vi end,
            transcript_vi = coalesce(v_item->>'transcript_vi', transcript_vi),
            updated_at = now()
          where id = v_g_id;
          v_g_count := v_g_count + 1;
        end if;
      end if;
    end loop;
  end if;

  return jsonb_build_object('success', true, 'updated_questions', v_q_count, 'updated_groups', v_g_count);
end;
$$;

revoke execute on function public.admin_import_toeic_bilingual_content(uuid, jsonb) from public;
revoke execute on function public.admin_import_toeic_bilingual_content(uuid, jsonb) from anon;
grant execute on function public.admin_import_toeic_bilingual_content(uuid, jsonb) to authenticated;

-- ============================================================
-- 6. EXTEND CAN_ACCESS_TOEIC_MEDIA FOR SINGLE TRACK AUDIO
-- ============================================================
create or replace function public.can_access_toeic_media(p_path text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then return true; end if;
  if auth.uid() is null then return false; end if;
  if not public.has_active_access() then return false; end if;

  -- 1. Check published single_track listening audio
  if exists (
    select 1 from public.toeic_tests t
    where t.is_published = true
      and t.listening_audio_url = p_path
  ) then return true; end if;

  -- 2. Check question media
  if exists (
    select 1 from public.toeic_test_questions q
    join public.toeic_tests t on t.id = q.test_id
    where t.is_published = true and q.is_active = true
      and (q.image_url = p_path or q.audio_url = p_path)
  ) then return true; end if;

  -- 3. Check group media
  if exists (
    select 1 from public.toeic_test_groups g
    join public.toeic_tests t on t.id = g.test_id
    where t.is_published = true and g.is_active = true
      and (g.image_url = p_path or g.audio_url = p_path)
  ) then return true; end if;

  return false;
end;
$$;

-- ============================================================
-- 7. UPDATE: get_student_toeic_test_content (DUAL LISTENING SUPPORT)
-- ============================================================
create or replace function public.get_student_toeic_test_content(
  p_test_id uuid,
  p_mode text default 'full',
  p_part_number integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_test record;
  v_test_json jsonb;
  v_groups jsonb;
  v_questions jsonb;
  v_part_key text;
  v_qn_range int4range;
  v_include_translation boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.has_active_access() then raise exception 'Access expired or inactive'; end if;

  if p_mode not in ('full', 'part') then
    raise exception 'Invalid mode (must be full or part)';
  end if;

  if p_mode = 'full' and p_part_number is not null then
    raise exception 'Full mode must not specify part_number';
  end if;

  if p_mode = 'part' then
    if p_part_number is null or p_part_number < 1 or p_part_number > 7 then
      raise exception 'Part mode requires part_number between 1 and 7';
    end if;
  end if;

  v_include_translation := (p_mode = 'part');

  select id, title, test_code, description, test_type, is_published,
         listening_audio_mode, listening_audio_url
  into v_test
  from public.toeic_tests
  where id = p_test_id and is_published = true;

  if v_test is null then raise exception 'Test not found or not published'; end if;

  v_test_json := jsonb_build_object(
    'id', v_test.id, 'title', v_test.title, 'test_code', v_test.test_code,
    'description', v_test.description, 'test_type', v_test.test_type,
    'listening_audio_mode', v_test.listening_audio_mode,
    'listening_audio_url', v_test.listening_audio_url
  );

  if p_mode = 'part' and p_part_number is not null then
    v_part_key := public._toeic_part_key(p_part_number);
    v_qn_range := public._toeic_part_range(p_part_number);
  end if;

  -- Groups
  if v_part_key is not null then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sub.id, 'part', sub.part, 'group_type', sub.group_type,
        'title', sub.title, 'instruction', sub.instruction,
        'passage', sub.passage, 'documents', sub.documents,
        'audio_url', case
          when v_test.listening_audio_mode = 'single_track' then coalesce(sub.audio_url, v_test.listening_audio_url)
          else sub.audio_url
        end,
        'image_url', sub.image_url,
        'cue_start_ms', sub.cue_start_ms,
        'cue_end_ms', sub.cue_end_ms,
        'instruction_vi', case when v_include_translation then sub.instruction_vi else null end,
        'passage_vi', case when v_include_translation then sub.passage_vi else null end,
        'documents_vi', case when v_include_translation then sub.documents_vi else null end
      ) order by sub.min_qn, sub.sort_order
    ), '[]'::jsonb) into v_groups
    from (
      select g.*,
        c.start_ms as cue_start_ms,
        c.end_ms as cue_end_ms,
        coalesce(
          (select min(q.question_number)
           from public.toeic_test_questions q
           where q.group_id = g.id and q.is_active = true),
          g.sort_order * 1000
        ) as min_qn
      from public.toeic_test_groups g
      left join public.toeic_listening_cues c on c.group_id = g.id
      where g.test_id = p_test_id and g.is_active = true and g.part = v_part_key
    ) sub;
  else
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sub.id, 'part', sub.part, 'group_type', sub.group_type,
        'title', sub.title, 'instruction', sub.instruction,
        'passage', sub.passage, 'documents', sub.documents,
        'audio_url', case
          when v_test.listening_audio_mode = 'single_track' then coalesce(sub.audio_url, v_test.listening_audio_url)
          else sub.audio_url
        end,
        'image_url', sub.image_url,
        'cue_start_ms', sub.cue_start_ms,
        'cue_end_ms', sub.cue_end_ms
      ) order by sub.min_qn, sub.sort_order
    ), '[]'::jsonb) into v_groups
    from (
      select g.*,
        c.start_ms as cue_start_ms,
        c.end_ms as cue_end_ms,
        coalesce(
          (select min(q.question_number)
           from public.toeic_test_questions q
           where q.group_id = g.id and q.is_active = true),
          g.sort_order * 1000
        ) as min_qn
      from public.toeic_test_groups g
      left join public.toeic_listening_cues c on c.group_id = g.id
      where g.test_id = p_test_id and g.is_active = true
    ) sub;
  end if;

  -- Questions
  if v_qn_range is not null then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sub.id, 'group_id', sub.group_id,
        'question_number', sub.question_number, 'part', sub.part,
        'question_text', sub.question_text, 'options', sub.options,
        'skill_tag', sub.skill_tag, 'topic', sub.topic,
        'audio_url', case
          when v_test.listening_audio_mode = 'single_track' then coalesce(sub.audio_url, v_test.listening_audio_url)
          else sub.audio_url
        end,
        'image_url', sub.image_url,
        'cue_start_ms', sub.cue_start_ms,
        'cue_end_ms', sub.cue_end_ms,
        'translation_vi', case when v_include_translation then sub.translation_vi else null end,
        'options_vi', case when v_include_translation then sub.options_vi else null end
      ) order by sub.question_number
    ), '[]'::jsonb) into v_questions
    from (
      select q.*,
        c.start_ms as cue_start_ms,
        c.end_ms as cue_end_ms
      from public.toeic_test_questions q
      left join public.toeic_listening_cues c on c.question_id = q.id
      where q.test_id = p_test_id and q.is_active = true
        and q.question_number <@ v_qn_range
    ) sub;
  else
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sub.id, 'group_id', sub.group_id,
        'question_number', sub.question_number, 'part', sub.part,
        'question_text', sub.question_text, 'options', sub.options,
        'skill_tag', sub.skill_tag, 'topic', sub.topic,
        'audio_url', case
          when v_test.listening_audio_mode = 'single_track' then coalesce(sub.audio_url, v_test.listening_audio_url)
          else sub.audio_url
        end,
        'image_url', sub.image_url,
        'cue_start_ms', sub.cue_start_ms,
        'cue_end_ms', sub.cue_end_ms
      ) order by sub.question_number
    ), '[]'::jsonb) into v_questions
    from (
      select q.*,
        c.start_ms as cue_start_ms,
        c.end_ms as cue_end_ms
      from public.toeic_test_questions q
      left join public.toeic_listening_cues c on c.question_id = q.id
      where q.test_id = p_test_id and q.is_active = true
    ) sub;
  end if;

  return jsonb_build_object(
    'test', v_test_json, 'groups', v_groups, 'questions', v_questions
  );
end;
$$;
