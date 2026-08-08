-- Migration: 20260808_phase3_vocab_no_delete.sql
-- Description: Enforce Parent-Child publish security & block hard DELETE on vocabulary_decks and vocabulary_items in RLS

-- 1. Update Student Read Policy for vocabulary items (require published parent deck)
drop policy if exists "active_read_vocab" on public.vocabulary_items;
create policy "active_read_vocab" on public.vocabulary_items
for select to authenticated
using (
  (
    is_published 
    and public.has_active_access() 
    and exists (
      select 1 from public.vocabulary_decks d 
      where d.id = vocabulary_items.deck_id 
      and d.is_published = true
    )
  ) 
  or public.is_admin()
);

-- 2. Replace broad FOR ALL admin policies with explicit INSERT and UPDATE policies (NO DELETE POLICY)
drop policy if exists "admin_decks_all" on public.vocabulary_decks;
drop policy if exists "admin_decks_insert" on public.vocabulary_decks;
drop policy if exists "admin_decks_update" on public.vocabulary_decks;

create policy "admin_decks_insert" on public.vocabulary_decks
for insert to authenticated
with check (public.is_admin());

create policy "admin_decks_update" on public.vocabulary_decks
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_vocab_all" on public.vocabulary_items;
drop policy if exists "admin_vocab_insert" on public.vocabulary_items;
drop policy if exists "admin_vocab_update" on public.vocabulary_items;

create policy "admin_vocab_insert" on public.vocabulary_items
for insert to authenticated
with check (public.is_admin());

create policy "admin_vocab_update" on public.vocabulary_items
for update to authenticated
using (public.is_admin()) with check (public.is_admin());
