-- ============================================================
-- Migration: 20260813_toeic_v2_learning_and_practice.sql
-- Description: Adds ORI TOEIC Website V2 Learning Items, Question Linkages, Practice Events & Safe Practice RPCs
-- Security: Hardened SECURITY DEFINER RPCs with search_path = '', schema qualification, RLS, REVOKE/GRANT, Two-Phase Link Authorization & Direct Student Table Write Revocation.
-- Invariants: Preserves legacy toeic_test_questions.difficulty TEXT; uses difficulty_level SMALLINT
-- ============================================================

-- 1. Create Learning Items Registry (with Item-level Approval)
create table if not exists public.toeic_learning_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('grammar', 'vocabulary', 'collocation', 'paraphrase')),
  item_key text unique not null,
  title text not null,
  definition text null,
  example text null,
  difficulty_level smallint not null default 3 check (difficulty_level between 1 and 5),
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_toeic_learning_items_kind on public.toeic_learning_items(kind);
create index if not exists idx_toeic_learning_items_key on public.toeic_learning_items(item_key);
create index if not exists idx_toeic_learning_items_approved on public.toeic_learning_items(is_approved);

alter table public.toeic_learning_items enable row level security;

-- RLS for toeic_learning_items: Only approved items can be viewed by active students
drop policy if exists "learning_items_select" on public.toeic_learning_items;
create policy "learning_items_select" on public.toeic_learning_items
for select to authenticated
using (public.is_admin() or (is_approved = true and public.has_active_access()));

drop policy if exists "admin_learning_items_all" on public.toeic_learning_items;
create policy "admin_learning_items_all" on public.toeic_learning_items
for all to authenticated
using (public.is_admin())
with check (public.is_admin());


-- 2. Create Question <-> Learning Item Junction Table (Non-Nullable Foreign Keys)
create table if not exists public.toeic_question_learning_items (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.toeic_tests(id) on delete cascade,
  question_id uuid not null references public.toeic_test_questions(id) on delete cascade,
  question_number integer not null,
  item_id uuid not null references public.toeic_learning_items(id) on delete cascade,
  item_key text not null,
  ai_suggested boolean not null default true,
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_id, question_number, item_key)
);

create index if not exists idx_q_learning_test on public.toeic_question_learning_items(test_id);
create index if not exists idx_q_learning_key on public.toeic_question_learning_items(item_key);
create index if not exists idx_q_learning_approved on public.toeic_question_learning_items(is_approved);

alter table public.toeic_question_learning_items enable row level security;

-- RLS for toeic_question_learning_items
drop policy if exists "question_learning_select" on public.toeic_question_learning_items;
create policy "question_learning_select" on public.toeic_question_learning_items
for select to authenticated
using (
  public.is_admin() or
  (
    is_approved = true and
    exists (select 1 from public.toeic_tests t where t.id = test_id and t.is_published = true) and
    exists (select 1 from public.toeic_learning_items item where item.id = item_id and item.is_approved = true) and
    public.has_active_access()
  )
);

drop policy if exists "admin_question_learning_all" on public.toeic_question_learning_items;
create policy "admin_question_learning_all" on public.toeic_question_learning_items
for all to authenticated
using (public.is_admin())
with check (public.is_admin());


-- 3. Create Student Practice Events Table
create table if not exists public.toeic_learning_practice_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  question_id uuid not null references public.toeic_test_questions(id) on delete cascade,
  selected_option text not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_practice_events_user on public.toeic_learning_practice_events(user_id);
create index if not exists idx_practice_events_key on public.toeic_learning_practice_events(item_key);

alter table public.toeic_learning_practice_events enable row level security;

-- TABLE PRIVILEGES: Explicitly revoke direct INSERT/UPDATE/DELETE from public, anon, authenticated
-- Only SECURITY DEFINER RPC (student_check_v2_practice_answer) can INSERT practice events!
revoke all on table public.toeic_learning_practice_events from public, anon;
revoke insert, update, delete on table public.toeic_learning_practice_events from authenticated;
grant select on table public.toeic_learning_practice_events to authenticated;
grant all on table public.toeic_learning_practice_events to service_role;

-- RLS: Students can ONLY SELECT THEIR OWN events (auth.uid() = user_id). DIRECT INSERT IS DENIED.
drop policy if exists "user_practice_events_select" on public.toeic_learning_practice_events;
create policy "user_practice_events_select" on public.toeic_learning_practice_events
for select to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "user_practice_events_insert" on public.toeic_learning_practice_events;
-- Intentionally NO insert policy for authenticated students. Direct INSERT fails under RLS + REVOKE!


-- 4. RPC: Admin Importing Learning Links (Two-Phase Validation-Before-Mutation)
create or replace function public.admin_import_v2_question_learning_links(links_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link jsonb;
  v_test_id uuid;
  v_q_num integer;
  v_item_key text;
  v_ai_suggested boolean;
  v_q_id uuid;
  v_item_id uuid;
  v_test_exists boolean;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin access required';
  end if;

  if jsonb_typeof(links_payload) != 'array' then
    raise exception 'Invalid payload: expected array of links';
  end if;

  -- PHASE A: VALIDATE ALL LINKS BEFORE ANY MUTATION
  for v_link in select * from jsonb_array_elements(links_payload) loop
    v_test_id := (v_link->>'test_id')::uuid;
    v_q_num := (v_link->>'question_number')::integer;
    v_item_key := trim(coalesce(v_link->>'item_key', ''));

    if v_test_id is null or v_q_num is null or v_item_key = '' then
      raise exception 'Invalid link payload item: missing test_id, question_number, or item_key';
    end if;

    -- Validate test exists
    select exists(select 1 from public.toeic_tests where id = v_test_id) into v_test_exists;
    if not v_test_exists then
      raise exception 'Import failed: Test % does not exist', v_test_id;
    end if;

    -- Validate question exists
    select id into v_q_id
    from public.toeic_test_questions
    where test_id = v_test_id and question_number = v_q_num;

    if v_q_id is null then
      raise exception 'Import failed: Question #% not found in test %', v_q_num, v_test_id;
    end if;

    -- Validate learning item exists
    select id into v_item_id
    from public.toeic_learning_items
    where item_key = v_item_key;

    if v_item_id is null then
      raise exception 'Import failed: Learning item "%" not found', v_item_key;
    end if;
  end loop;

  -- PHASE B: MUTATE (UPSERT) LINKS
  for v_link in select * from jsonb_array_elements(links_payload) loop
    v_test_id := (v_link->>'test_id')::uuid;
    v_q_num := (v_link->>'question_number')::integer;
    v_item_key := trim(v_link->>'item_key');
    v_ai_suggested := coalesce((v_link->>'ai_suggested')::boolean, true);

    select id into v_q_id
    from public.toeic_test_questions
    where test_id = v_test_id and question_number = v_q_num;

    select id into v_item_id
    from public.toeic_learning_items
    where item_key = v_item_key;

    insert into public.toeic_question_learning_items (
      test_id, question_id, question_number, item_id, item_key, ai_suggested, is_approved
    )
    values (
      v_test_id, v_q_id, v_q_num, v_item_id, v_item_key, v_ai_suggested, false
    )
    on conflict (test_id, question_number, item_key) do update
    set
      question_id = excluded.question_id,
      item_id = excluded.item_id,
      updated_at = now();
  end loop;

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.admin_import_v2_question_learning_links(jsonb) from public;
revoke execute on function public.admin_import_v2_question_learning_links(jsonb) from anon;
grant execute on function public.admin_import_v2_question_learning_links(jsonb) to authenticated;


-- 5. Safe Student Practice Questions Fetch RPC (Enforces p_kind, item join & structural invariants)
create or replace function public.student_get_safe_v2_practice_questions(
  p_kind text,
  p_item_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_questions jsonb;
  v_clean_kind text;
  v_clean_key text;
begin
  if not (public.is_admin() or public.has_active_access()) then
    raise exception 'Unauthorized: Active student subscription required';
  end if;

  v_clean_kind := lower(trim(coalesce(p_kind, '')));
  v_clean_key := trim(coalesce(p_item_key, ''));

  if v_clean_kind not in ('grammar', 'vocabulary', 'collocation', 'paraphrase') then
    raise exception 'Invalid practice kind parameter';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'question_id', q.id,
      'test_id', q.test_id,
      'question_number', q.question_number,
      'part', q.part,
      'question_text', q.question_text,
      'options', q.options,
      'audio_url', coalesce(q.audio_url, g.audio_url),
      'image_url', coalesce(q.image_url, g.image_url),
      'group_title', g.title,
      'group_passage', g.passage,
      'documents', g.documents
      -- SECURITY INVARIANT: DOES NOT RETURN correct_answer, explanation, transcript
    )
  ), '[]'::jsonb)
  into v_questions
  from public.toeic_question_learning_items link
  join public.toeic_test_questions q on q.id = link.question_id
  join public.toeic_tests t on t.id = q.test_id
  join public.toeic_learning_items item on item.id = link.item_id
  left join public.toeic_test_groups g on g.id = q.group_id
  where link.item_key = v_clean_key
    and item.item_key = v_clean_key
    and item.kind = v_clean_kind
    and link.test_id = q.test_id
    and link.question_number = q.question_number
    and link.is_approved = true
    and item.is_approved = true
    and t.is_published = true
    and q.is_active = true;

  return v_questions;
end;
$$;

revoke execute on function public.student_get_safe_v2_practice_questions(text, text) from public;
revoke execute on function public.student_get_safe_v2_practice_questions(text, text) from anon;
grant execute on function public.student_get_safe_v2_practice_questions(text, text) to authenticated;


-- 6. Safe Student Answer Check & Progress Recorder RPC (Strict Relational Authorization & Option Validation)
create or replace function public.student_check_v2_practice_answer(
  p_question_id uuid,
  p_item_key text,
  p_selected_option text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correct_answer text;
  v_q_explanation text;
  v_q_transcript text;
  v_g_transcript text;
  v_final_transcript text;
  v_q_part text;
  v_q_options jsonb;
  v_is_correct boolean;
  v_user_id uuid;
  v_clean_opt text;
  v_clean_key text;
begin
  if not (public.is_admin() or public.has_active_access()) then
    raise exception 'Unauthorized: Active student subscription required';
  end if;

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: User identity unverified';
  end if;

  v_clean_opt := upper(trim(coalesce(p_selected_option, '')));
  v_clean_key := trim(coalesce(p_item_key, ''));

  if v_clean_opt not in ('A', 'B', 'C', 'D') then
    raise exception 'Invalid option selected';
  end if;

  -- HARDENED AUTHORIZED RELATIONAL LOOKUP WITH STRUCTURAL INVARIANTS
  select
    upper(trim(q.correct_answer)),
    q.explanation,
    q.transcript,
    g.transcript,
    q.part,
    q.options
  into
    v_correct_answer,
    v_q_explanation,
    v_q_transcript,
    v_g_transcript,
    v_q_part,
    v_q_options
  from public.toeic_question_learning_items link
  join public.toeic_test_questions q on q.id = link.question_id
  join public.toeic_tests t on t.id = q.test_id
  join public.toeic_learning_items item on item.id = link.item_id
  left join public.toeic_test_groups g on g.id = q.group_id
  where q.id = p_question_id
    and link.question_id = p_question_id
    and link.test_id = q.test_id
    and link.question_number = q.question_number
    and link.item_key = v_clean_key
    and item.item_key = v_clean_key
    and link.is_approved = true
    and item.is_approved = true
    and t.is_published = true
    and q.is_active = true;

  -- Generic rejection if relational authorization fails (avoids information disclosure)
  if v_correct_answer is null then
    raise exception 'Practice question is unavailable';
  end if;

  -- VALIDATE OPTION BY ACTUAL QUESTION PART
  if lower(v_q_part) in ('p2', 'part2') or v_q_part = '2' then
    if v_clean_opt not in ('A', 'B', 'C') then
      raise exception 'Invalid option selected for Part 2 question';
    end if;
  else
    if v_clean_opt not in ('A', 'B', 'C', 'D') then
      raise exception 'Invalid option selected';
    end if;
  end if;

  v_is_correct := (v_clean_opt = v_correct_answer);

  -- Record practice event bound strictly to auth.uid()
  insert into public.toeic_learning_practice_events (
    user_id, item_key, question_id, selected_option, is_correct
  )
  values (
    v_user_id, v_clean_key, p_question_id, v_clean_opt, v_is_correct
  );

  v_final_transcript := coalesce(v_q_transcript, v_g_transcript);

  -- Only NOW return correct_answer, explanation & transcript after server-side check
  return jsonb_build_object(
    'success', true,
    'is_correct', v_is_correct,
    'correct_answer', v_correct_answer,
    'explanation', v_q_explanation,
    'transcript', v_final_transcript
  );
end;
$$;

revoke execute on function public.student_check_v2_practice_answer(uuid, text, text) from public;
revoke execute on function public.student_check_v2_practice_answer(uuid, text, text) from anon;
grant execute on function public.student_check_v2_practice_answer(uuid, text, text) to authenticated;
