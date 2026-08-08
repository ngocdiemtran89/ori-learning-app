# Kiến trúc kỹ thuật

## Frontend
React + TypeScript + Vite + Tailwind CSS.

## Backend
Supabase:
- Auth
- PostgreSQL
- Row Level Security
- Storage nếu cần audio protected

## Hosting
Netlify.

## Data boundary

### Public
- logo
- landing/login assets
- 1-2 bài demo nếu ORI muốn cho học thử
- UI constants

### Protected
- vocabulary đầy đủ
- grammar lessons
- listening questions/transcripts
- reading passages/questions
- user progress
- saved words
- quiz attempts
- profiles

## Tại sao paid content không để JSON public
Frontend bundle và file public có thể bị tải trực tiếp. UI lock không phải access control.
Paid content phải được database policy kiểm tra trước khi trả dữ liệu.

## Route đề xuất
/
 /login
 /dashboard
 /vocabulary
 /vocabulary/:deckId
 /grammar
 /grammar/:lessonId
 /listening
 /listening/:lessonId
 /reading
 /reading/:lessonId
 /account
 /expired
 /admin
 /admin/students

## Folder đề xuất
src/
  app/
  components/
  features/
    auth/
    dashboard/
    vocabulary/
    grammar/
    listening/
    reading/
    admin/
  lib/
    supabase/
  hooks/
  types/
  styles/

## Security
- anon/publishable key được phép ở client
- service_role key tuyệt đối không được nằm client
- mọi protected table bật RLS
- admin check bằng database policy, không chỉ check UI
