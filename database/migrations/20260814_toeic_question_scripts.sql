-- ============================================================
-- Migration Proposal (UNAPPLIED): 20260814_toeic_question_scripts.sql
-- Description: Unifies structured question scripts (Part 2 audio transcripts, bilingual script responses)
-- Security: Hardened SECURITY DEFINER RPCs, strict admin-only RLS, Revoke public privileges.
-- IMPORTANT: THIS MIGRATION IS A STATIC PROPOSAL FILE. DO NOT APPLY AUTOMATICALLY TO PRODUCTION DB.
-- ============================================================

-- 1. Table: public.toeic_question_scripts
create table if not exists public.toeic_question_scripts (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.toeic_test_questions(id) on delete cascade,
  script_type text not null default 'P2_AUDIO_TRANSCRIPT',
  prompt_text text not null check (char_length(trim(prompt_text)) > 0),
  responses jsonb not null default '{}'::jsonb,
  translation jsonb null,
  source text not null default 'CHATGPT_HYBRID',
  confidence numeric not null default 1.0 check (confidence >= 0.0 and confidence <= 1.0),
  review_status text not null default 'NEEDS_REVIEW' check (review_status in ('NEEDS_REVIEW', 'APPROVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_question_script_type unique (question_id, script_type),
  constraint check_responses_format check (
    jsonb_typeof(responses) = 'object' and
    responses ? 'A' and
    responses ? 'B' and
    responses ? 'C' and
    not (responses ? 'D')
  )
);

create index if not exists idx_toeic_question_scripts_question on public.toeic_question_scripts(question_id);
create index if not exists idx_toeic_question_scripts_type on public.toeic_question_scripts(script_type);
create index if not exists idx_toeic_question_scripts_status on public.toeic_question_scripts(review_status);

alter table public.toeic_question_scripts enable row level security;

-- Deterministic REVOKE ALL reset for public, anon, authenticated
revoke all on table public.toeic_question_scripts from public, anon, authenticated;
grant select, insert, update, delete on table public.toeic_question_scripts to authenticated;
grant all on table public.toeic_question_scripts to service_role;

-- RLS: Admin-only policy for toeic_question_scripts. Students gain access ONLY via safe review RPC post-submission!
drop policy if exists "admin_toeic_question_scripts_all" on public.toeic_question_scripts;
create policy "admin_toeic_question_scripts_all" on public.toeic_question_scripts
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 2. Admin Upsert RPC for Question Script
create or replace function public.admin_upsert_toeic_question_script(
  p_question_id uuid,
  p_prompt_text text,
  p_responses jsonb,
  p_script_type text default 'P2_AUDIO_TRANSCRIPT',
  p_translation jsonb default null,
  p_source text default 'CHATGPT_HYBRID',
  p_confidence numeric default 1.0,
  p_review_status text default 'APPROVED'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_script_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Permission denied: admin access required';
  end if;

  if p_responses ? 'D' then
    raise exception 'Invalid Part 2 responses: Choice D is not allowed in Part 2';
  end if;

  insert into public.toeic_question_scripts (
    question_id,
    script_type,
    prompt_text,
    responses,
    translation,
    source,
    confidence,
    review_status,
    updated_at
  )
  values (
    p_question_id,
    p_script_type,
    trim(p_prompt_text),
    p_responses,
    p_translation,
    p_source,
    p_confidence,
    p_review_status,
    now()
  )
  on conflict (question_id, script_type)
  do update set
    prompt_text = excluded.prompt_text,
    responses = excluded.responses,
    translation = excluded.translation,
    source = excluded.source,
    confidence = excluded.confidence,
    review_status = excluded.review_status,
    updated_at = now()
  returning id into v_script_id;

  return jsonb_build_object(
    'success', true,
    'script_id', v_script_id
  );
end;
$$;

revoke all on function public.admin_upsert_toeic_question_script from public, anon, authenticated;
grant execute on function public.admin_upsert_toeic_question_script to authenticated;
grant execute on function public.admin_upsert_toeic_question_script to service_role;
