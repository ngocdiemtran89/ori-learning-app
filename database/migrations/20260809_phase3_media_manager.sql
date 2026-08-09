-- Create the toeic-media bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'toeic-media', 
  'toeic-media', 
  false,
  104857600, -- 100MB
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg']
)
on conflict (id) do update set 
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg'];

-- Ensure RLS is enabled for storage.objects
alter table storage.objects enable row level security;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists admin_media_insert on storage.objects;
drop policy if exists admin_media_update on storage.objects;
drop policy if exists admin_media_delete on storage.objects;
drop policy if exists student_media_select on storage.objects;

-- Policy 1: Allow authenticated users (Admins) to upload new media
create policy admin_media_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'toeic-media' and public.is_admin());

-- Policy 2: Allow authenticated users (Admins) to replace media
create policy admin_media_update
on storage.objects
for update
to authenticated
using (bucket_id = 'toeic-media' and public.is_admin())
with check (bucket_id = 'toeic-media' and public.is_admin());

-- Policy 3: Allow authenticated users (Admins) to delete media
create policy admin_media_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'toeic-media' and public.is_admin());

-- Policy 4: Allow authenticated users to view/download media
-- (Note: For signed URLs, the backend generates the URL using the user's token or Service Role.
-- Since the frontend handles this via user session, the user must be authenticated)
create policy student_media_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'toeic-media'
  and (
    public.is_admin()
    or (
      public.has_active_access()
      and exists (
        select 1
        from public.toeic_tests t
        where t.is_published = true
          and (
            exists (
              select 1
              from public.toeic_test_questions q
              where q.test_id = t.id
                and q.is_active = true
                and (
                  q.image_url = storage.objects.name
                  or q.audio_url = storage.objects.name
                )
            )
            or
            exists (
              select 1
              from public.toeic_test_groups g
              where g.test_id = t.id
                and g.is_active = true
                and (
                  g.image_url = storage.objects.name
                  or g.audio_url = storage.objects.name
                )
            )
          )
      )
    )
  )
);
