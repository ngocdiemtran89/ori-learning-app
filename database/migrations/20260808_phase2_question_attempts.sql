-- Migration: Create question_attempts table for Phase 2.2 Question-Level History & Wrong Answer Notebook
-- Date: 2026-08-08

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('grammar', 'listening', 'reading', 'vocabulary')),
  content_id uuid not null,
  question_key text not null,
  question_id uuid null,
  question_index integer null,
  question_text text not null,
  selected_answer text,
  correct_answer text not null,
  is_correct boolean not null,
  explanation text,
  skill_tag text,
  toeic_part text,
  topic text,
  created_at timestamptz not null default now(),
  constraint question_attempts_attempt_question_key unique (attempt_id, question_key)
);

-- Indexes for fast query performance
create index if not exists idx_question_attempts_user_id on public.question_attempts(user_id);
create index if not exists idx_question_attempts_created_at on public.question_attempts(created_at desc);
create index if not exists idx_question_attempts_content on public.question_attempts(content_type, content_id);
create index if not exists idx_question_attempts_is_correct on public.question_attempts(user_id, is_correct);
create index if not exists idx_question_attempts_key on public.question_attempts(user_id, question_key);

-- Enable RLS
alter table public.question_attempts enable row level security;

-- RLS Policies
create policy "question_attempts_select" on public.question_attempts
  for select using (
    (user_id = auth.uid() and public.has_active_access())
    or public.is_admin()
  );

create policy "question_attempts_insert" on public.question_attempts
  for insert with check (
    user_id = auth.uid()
    and public.has_active_access()
  );
