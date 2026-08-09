-- ============================================================
-- Phase P3.5F: TOEIC Bulk Media, Dual Listening Source & Bilingual Foundation
-- NEW MIGRATION — EDITED FOR FINAL EXAM-INTEGRITY PATCH
-- DO NOT ALTER PREVIOUSLY APPLIED MIGRATIONS (P3.5, P3.6A)
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

-- RLS — ADMIN ONLY ACCESS TO CUES TABLE DIRECTLY
alter table public.toeic_listening_cues enable row level security;

drop policy if exists admin_cues_all on public.toeic_listening_cues;
drop policy if exists student_cues_select on public.toeic_listening_cues;

create policy admin_cues_all on public.toeic_listening_cues
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke select, insert, update, delete on public.toeic_listening_cues from public, anon;

-- ============================================================
-- 4. RPC: admin_set_toeic_listening_mode
-- ============================================================
create or replace function public.admin_set_toeic_listening_mode(
  p_test_id uuid,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_test record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.is_admin() then raise exception 'Unauthorized: Admin access required'; end if;

  select id, is_published into v_test
  from public.toeic_tests where id = p_test_id;

  if v_test is null then raise exception 'Test not found'; end if;

  if v_test.is_published then
    raise exception 'Cannot change listening audio mode on a published test. Please unpublish first.';
  end if;

  if p_mode not in ('segmented', 'single_track') then
    raise exception 'Invalid listening mode (must be segmented or single_track)';
  end if;

  update public.toeic_tests
  set listening_audio_mode = p_mode, updated_at = now()
  where id = p_test_id;

  return jsonb_build_object('success', true, 'mode', p_mode);
end;
$$;

revoke execute on function public.admin_set_toeic_listening_mode(uuid, text) from public, anon;
grant execute on function public.admin_set_toeic_listening_mode(uuid, text) to authenticated;

-- ============================================================
-- 5. RPC: admin_upload_toeic_listening_track_path
-- ============================================================
create or replace function public.admin_upload_toeic_listening_track_path(
  p_test_id uuid,
  p_audio_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_test record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.is_admin() then raise exception 'Unauthorized: Admin access required'; end if;

  if p_audio_url is null or trim(p_audio_url) = '' then
    raise exception 'p_audio_url must be non-null and non-empty';
  end if;

  select id, is_published, listening_audio_url into v_test
  from public.toeic_tests where id = p_test_id;

  if v_test is null then raise exception 'Test not found'; end if;

  if v_test.is_published then
    raise exception 'Cannot upload listening track on a published test. Please unpublish first.';
  end if;

  update public.toeic_tests
  set listening_audio_mode = 'single_track',
      listening_audio_url = p_audio_url,
      updated_at = now()
  where id = p_test_id;

  return jsonb_build_object('success', true, 'path', p_audio_url);
end;
$$;

revoke execute on function public.admin_upload_toeic_listening_track_path(uuid, text) from public, anon;
grant execute on function public.admin_upload_toeic_listening_track_path(uuid, text) to authenticated;

-- ============================================================
-- 6. RPC: admin_upsert_toeic_listening_cues (REQUIRES ACTIVE TARGETS)
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
  v_test record;
  v_item jsonb;
  v_q_id uuid;
  v_g_id uuid;
  v_start_ms integer;
  v_end_ms integer;
  v_q record;
  v_g record;
  v_count integer := 0;
  v_uniq_q integer;
  v_tot_q integer;
  v_uniq_g integer;
  v_tot_g integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.is_admin() then raise exception 'Unauthorized: Admin access required'; end if;

  select id, is_published into v_test
  from public.toeic_tests where id = p_test_id;

  if v_test is null then raise exception 'Test not found'; end if;

  if v_test.is_published then
    raise exception 'Cannot modify listening cues on a published test. Please unpublish first.';
  end if;

  if jsonb_typeof(p_cues) != 'array' then
    raise exception 'Payload must be a JSON array of cue objects';
  end if;

  -- 1. SERVER-SIDE DUPLICATE TARGET CHECK
  select count(distinct q_id), count(q_id)
  into v_uniq_q, v_tot_q
  from (
    select (elem->>'question_id')::uuid as q_id
    from jsonb_array_elements(p_cues) elem
    where elem->>'question_id' is not null
  ) sub;

  if v_tot_q > v_uniq_q then
    raise exception 'Duplicate question_id target in cue payload';
  end if;

  select count(distinct g_id), count(g_id)
  into v_uniq_g, v_tot_g
  from (
    select (elem->>'group_id')::uuid as g_id
    from jsonb_array_elements(p_cues) elem
    where elem->>'group_id' is not null
  ) sub;

  if v_tot_g > v_uniq_g then
    raise exception 'Duplicate group_id target in cue payload';
  end if;

  -- 2. PROCESS AND VALIDATE EACH CUE ITEM
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
      select id, test_id, part, is_active into v_q
      from public.toeic_test_questions
      where id = v_q_id and is_active = true;

      if v_q is null or v_q.test_id != p_test_id then
        raise exception 'Target question does not exist, is inactive, or does not belong to this test';
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
      select id, test_id, part, is_active into v_g
      from public.toeic_test_groups
      where id = v_g_id and is_active = true;

      if v_g is null or v_g.test_id != p_test_id then
        raise exception 'Target group does not exist, is inactive, or does not belong to this test';
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

revoke execute on function public.admin_upsert_toeic_listening_cues(uuid, jsonb) from public, anon;
grant execute on function public.admin_upsert_toeic_listening_cues(uuid, jsonb) to authenticated;

-- ============================================================
-- 7. RPC: admin_import_toeic_bilingual_content (REQUIRES ACTIVE DIRECT TARGETS & TYPE MATCH)
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
  v_src_opts_len integer;
  v_vi_opts_len integer;
  v_src_docs_len integer;
  v_vi_docs_len integer;
  v_start_q integer;
  v_end_q integer;
  v_match_count integer;
  v_i integer;
  v_src_doc jsonb;
  v_vi_doc jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.is_admin() then raise exception 'Unauthorized: Admin access required'; end if;

  if not exists (select 1 from public.toeic_tests where id = p_test_id) then
    raise exception 'Test not found';
  end if;

  -- 1. QUESTIONS SERVER-SIDE VALIDATION & ATOMIC UPDATE
  if p_payload->'questions' is not null and jsonb_typeof(p_payload->'questions') = 'array' then
    for v_item in select * from jsonb_array_elements(p_payload->'questions')
    loop
      v_q_id := case when v_item->>'id' is not null then (v_item->>'id')::uuid else null end;
      
      if v_q_id is null and v_item->>'question_number' is not null then
        select count(*) into v_match_count
        from public.toeic_test_questions
        where test_id = p_test_id and question_number = (v_item->>'question_number')::integer and is_active = true;

        if v_match_count = 0 then
          raise exception 'No active question found for question_number %', (v_item->>'question_number')::integer;
        elsif v_match_count > 1 then
          raise exception 'Ambiguous target for question_number %', (v_item->>'question_number')::integer;
        end if;

        select id into v_q_id
        from public.toeic_test_questions
        where test_id = p_test_id and question_number = (v_item->>'question_number')::integer and is_active = true;
      end if;

      if v_q_id is null then
        raise exception 'Bilingual question target not found or question_number missing';
      end if;

      select id, test_id, part, options, is_active into v_q
      from public.toeic_test_questions where id = v_q_id and is_active = true;

      if v_q is null or v_q.test_id != p_test_id then
        raise exception 'Target question % not found, inactive, or does not belong to this test', v_q_id;
      end if;

      if v_item->'options_vi' is not null then
        if jsonb_typeof(v_item->'options_vi') != 'array' then
          raise exception 'options_vi must be a JSON array for question %', v_q.id;
        end if;

        v_src_opts_len := jsonb_array_length(v_q.options);
        v_vi_opts_len := jsonb_array_length(v_item->'options_vi');

        if v_vi_opts_len != v_src_opts_len then
          raise exception 'options_vi count (%s) does not match source options count (%s) for question %s',
            v_vi_opts_len, v_src_opts_len, v_q.id;
        end if;
      end if;

      update public.toeic_test_questions set
        translation_vi = coalesce(v_item->>'translation_vi', translation_vi),
        options_vi = case when v_item->'options_vi' is not null then v_item->'options_vi' else options_vi end,
        updated_at = now()
      where id = v_q_id;

      v_q_count := v_q_count + 1;
    end loop;
  end if;

  -- 2. GROUPS SERVER-SIDE VALIDATION & ATOMIC UPDATE
  if p_payload->'groups' is not null and jsonb_typeof(p_payload->'groups') = 'array' then
    for v_item in select * from jsonb_array_elements(p_payload->'groups')
    loop
      v_g_id := case when v_item->>'id' is not null then (v_item->>'id')::uuid else null end;

      if v_g_id is null and v_item->>'start_question' is not null and v_item->>'end_question' is not null then
        v_start_q := (v_item->>'start_question')::integer;
        v_end_q := (v_item->>'end_question')::integer;

        -- DETERMINISTIC GROUP RANGE MATCH CHECK
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

        if v_match_count = 0 then
          raise exception 'No active group found for question range %-%', v_start_q, v_end_q;
        elsif v_match_count > 1 then
          raise exception 'Ambiguous group range %-% (matches multiple active groups)', v_start_q, v_end_q;
        end if;

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

      if v_g_id is null then
        raise exception 'Bilingual group target not found for range';
      end if;

      select id, test_id, part, documents, is_active into v_g
      from public.toeic_test_groups where id = v_g_id and is_active = true;

      if v_g is null or v_g.test_id != p_test_id then
        raise exception 'Target group % not found, inactive, or does not belong to this test', v_g_id;
      end if;

      if v_item->>'transcript_vi' is not null and v_g.part not in ('part3', 'part4') then
        raise exception 'transcript_vi is only allowed for Part 3 and Part 4 groups';
      end if;

      if v_item->>'passage_vi' is not null and v_g.part != 'part6' then
        raise exception 'passage_vi is only allowed for Part 6 groups';
      end if;

      if v_item->'documents_vi' is not null then
        if v_g.part != 'part7' then
          raise exception 'documents_vi is only allowed for Part 7 groups';
        end if;
        if jsonb_typeof(v_item->'documents_vi') != 'array' then
          raise exception 'documents_vi must be a JSON array for group %', v_g.id;
        end if;

        v_src_docs_len := coalesce(jsonb_array_length(v_g.documents), 0);
        v_vi_docs_len := jsonb_array_length(v_item->'documents_vi');

        if v_vi_docs_len != v_src_docs_len then
          raise exception 'documents_vi count (%s) does not match source documents count (%s) for group %s',
            v_vi_docs_len, v_src_docs_len, v_g.id;
        end if;

        -- STRICT DOCUMENT ELEMENT OBJECT & SHAPE CHECK
        for v_i in 0 .. (v_vi_docs_len - 1)
        loop
          v_src_doc := v_g.documents->v_i;
          v_vi_doc := v_item->'documents_vi'->v_i;

          if jsonb_typeof(v_vi_doc) != 'object' then
            raise exception 'documents_vi element at index % must be a JSON object', v_i;
          end if;

          if jsonb_typeof(v_src_doc) != 'object' then
            raise exception 'source document element at index % is invalid', v_i;
          end if;

          -- IF SOURCE HAS TYPE, TRANSLATED DOCUMENT MUST ALSO HAVE TYPE AND MATCH SOURCE TYPE
          if v_src_doc->>'type' is not null then
            if v_vi_doc->>'type' is null or v_vi_doc->>'type' != v_src_doc->>'type' then
              raise exception 'documents_vi element at index % missing or mismatched structural type (% vs required %)',
                v_i, coalesce(v_vi_doc->>'type', 'NULL'), v_src_doc->>'type';
            end if;
          end if;
        end loop;
      end if;

      update public.toeic_test_groups set
        instruction_vi = coalesce(v_item->>'instruction_vi', instruction_vi),
        passage_vi = coalesce(v_item->>'passage_vi', passage_vi),
        documents_vi = case when v_item->'documents_vi' is not null then v_item->'documents_vi' else documents_vi end,
        transcript_vi = coalesce(v_item->>'transcript_vi', transcript_vi),
        updated_at = now()
      where id = v_g_id;

      v_g_count := v_g_count + 1;
    end loop;
  end if;

  return jsonb_build_object('success', true, 'updated_questions', v_q_count, 'updated_groups', v_g_count);
end;
$$;

revoke execute on function public.admin_import_toeic_bilingual_content(uuid, jsonb) from public, anon;
grant execute on function public.admin_import_toeic_bilingual_content(uuid, jsonb) to authenticated;

-- ============================================================
-- 8. EXTEND CAN_ACCESS_TOEIC_MEDIA FOR SINGLE TRACK AUDIO
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
      and t.listening_audio_mode = 'single_track'
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
-- 9. UPDATE: get_student_toeic_test_content (SANITY & INTEGRITY HARDENED ACTIVE RUNNER)
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
    'listening_audio_url', case
      when v_test.listening_audio_mode = 'single_track' and (p_mode = 'full' or (p_mode = 'part' and p_part_number <= 4)) then v_test.listening_audio_url
      else null
    end
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
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then v_test.listening_audio_url
          else sub.audio_url
        end,
        'image_url', sub.image_url,
        'cue_start_ms', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then sub.cue_start_ms
          else null
        end,
        'cue_end_ms', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then sub.cue_end_ms
          else null
        end,
        'instruction_vi', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') then null
          when v_include_translation then sub.instruction_vi
          else null
        end,
        'passage_vi', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') then null
          when v_include_translation then sub.passage_vi
          else null
        end,
        'documents_vi', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') then null
          when v_include_translation then sub.documents_vi
          else null
        end
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
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then v_test.listening_audio_url
          else sub.audio_url
        end,
        'image_url', sub.image_url,
        'cue_start_ms', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then sub.cue_start_ms
          else null
        end,
        'cue_end_ms', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then sub.cue_end_ms
          else null
        end
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
        'question_text', case
          when sub.part in ('part1', 'part2') then null
          else sub.question_text
        end,
        'options', case
          when sub.part = 'part1' then jsonb_build_array('(A)', '(B)', '(C)', '(D)')
          when sub.part = 'part2' then jsonb_build_array('(A)', '(B)', '(C)')
          else sub.options
        end,
        'skill_tag', sub.skill_tag, 'topic', sub.topic,
        'audio_url', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then v_test.listening_audio_url
          else sub.audio_url
        end,
        'image_url', sub.image_url,
        'cue_start_ms', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then sub.cue_start_ms
          else null
        end,
        'cue_end_ms', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then sub.cue_end_ms
          else null
        end,
        'translation_vi', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') then null
          when v_include_translation then sub.translation_vi
          else null
        end,
        'options_vi', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') then null
          when v_include_translation then sub.options_vi
          else null
        end
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
        'question_text', case
          when sub.part in ('part1', 'part2') then null
          else sub.question_text
        end,
        'options', case
          when sub.part = 'part1' then jsonb_build_array('(A)', '(B)', '(C)', '(D)')
          when sub.part = 'part2' then jsonb_build_array('(A)', '(B)', '(C)')
          else sub.options
        end,
        'skill_tag', sub.skill_tag, 'topic', sub.topic,
        'audio_url', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then v_test.listening_audio_url
          else sub.audio_url
        end,
        'image_url', sub.image_url,
        'cue_start_ms', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then sub.cue_start_ms
          else null
        end,
        'cue_end_ms', case
          when sub.part in ('part1', 'part2', 'part3', 'part4') and v_test.listening_audio_mode = 'single_track' then sub.cue_end_ms
          else null
        end
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
