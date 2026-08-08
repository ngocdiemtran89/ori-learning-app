-- Migration: 20260808_phase3_grammar_no_delete.sql
-- Description: Replace FOR ALL admin policy on grammar_lessons with explicit INSERT and UPDATE policies (NO DELETE POLICY)

drop policy if exists "admin_grammar_all" on public.grammar_lessons;
drop policy if exists "admin_grammar_insert" on public.grammar_lessons;
drop policy if exists "admin_grammar_update" on public.grammar_lessons;

create policy "admin_grammar_insert" on public.grammar_lessons
for insert to authenticated
with check (public.is_admin());

create policy "admin_grammar_update" on public.grammar_lessons
for update to authenticated
using (public.is_admin()) with check (public.is_admin());
