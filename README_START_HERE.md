# ORI Learning — Bắt đầu tại đây

Bộ file này dùng để xây website học viên ORI bằng Google Antigravity theo từng pha, hạn chế việc AI sửa lung tung hoặc xây quá nhiều tính năng cùng lúc.

## Stack đã chốt

- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS
- Router: React Router
- Backend/Auth/Database: Supabase
- Hosting: Vercel
- Git: GitHub
- Coding agent: Google Antigravity
- Nội dung trả phí: lưu trong Supabase và bảo vệ bằng RLS
- Nội dung demo miễn phí: có thể nằm trong source code
- Audio: giai đoạn đầu dùng file nén nhỏ; ưu tiên Supabase Storage khi cần bảo vệ

## Nguyên tắc quan trọng

1. Không xây cả website trong một prompt.
2. Mỗi pha phải chạy được trước khi sang pha tiếp theo.
3. Mỗi thay đổi lớn phải commit Git.
4. Không bao giờ đưa SUPABASE_SERVICE_ROLE_KEY vào frontend.
5. Phải bật RLS cho bảng chứa dữ liệu học viên và nội dung trả phí.
6. Tài khoản hết hạn phải bị khóa ở cả UI lẫn database policy.
7. Không clone code hoặc dữ liệu có bản quyền từ website khác.
8. Mobile-first vì đa số học viên dùng điện thoại.
9. Giao diện ORI: xanh dương sáng + trắng, sạch, dễ đọc, hiện đại.
10. Pha 1 chỉ làm những gì cần để học viên thật có thể đăng nhập và học.

## Trình tự thực hiện

### BƯỚC 0 — Tạo tài khoản
Bạn cần:
- Google Antigravity
- GitHub
- Supabase
- Vercel

Không cần mua domain ngay. Dùng domain miễn phí của Vercel (*.vercel.app) trước.

### BƯỚC 1 — Tạo thư mục project
Tạo một folder mới trên máy:
`ori-learning`

Copy toàn bộ các file trong bộ kit này vào folder đó.

Mở Google Antigravity:
- New Project
- Add Folder
- chọn folder `ori-learning`
- Create

### BƯỚC 2 — Cho Antigravity đọc luật dự án
Trong Agent, gửi nội dung file:
`prompts/00_MASTER_CONTEXT.md`

Sau đó yêu cầu Agent đọc:
- `docs/01_PRODUCT_SPEC.md`
- `docs/02_ARCHITECTURE.md`
- `.agents/rules/ori-learning.md`

Không cho Agent code ngay nếu nó chưa tóm tắt đúng kiến trúc.

### BƯỚC 3 — Bootstrap frontend
Chạy prompt:
`prompts/01_BOOTSTRAP_FRONTEND.md`

Kết quả cần đạt:
- app chạy local
- có route
- có layout
- responsive mobile
- chưa cần Supabase

### BƯỚC 4 — Dựng UI shell
Chạy:
`prompts/02_BUILD_UI_SHELL.md`

Kiểm tra:
- Login
- Dashboard
- Vocabulary
- Grammar
- Listening
- Reading
- Account
- Expired screen
- 404

Chưa kết nối database.

### BƯỚC 5 — Tạo Supabase
Trong Supabase:
1. Create new project
2. Lưu Project URL
3. Lưu Publishable/Anon key
4. Không dùng Service Role key ở frontend
5. Mở SQL Editor
6. chạy `database/schema.sql`
7. chạy `database/seed.sql`

### BƯỚC 6 — Kết nối Supabase
Copy `.env.example` thành `.env.local`

Điền:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Chạy prompt:
`prompts/03_CONNECT_SUPABASE.md`

### BƯỚC 7 — Login + quyền truy cập theo tháng
Chạy:
`prompts/04_AUTH_AND_EXPIRY.md`

Test đủ 4 trường hợp:
1. chưa login
2. login + active
3. login + expired
4. login + disabled

### BƯỚC 8 — Vocabulary
Chạy:
`prompts/05_VOCABULARY_MVP.md`

MVP cần có:
- danh sách deck
- flashcard
- lật card
- IPA
- nghĩa
- ví dụ
- dịch
- Again / Hard / Good / Easy
- Saved word
- Review today
- progress

### BƯỚC 9 — Grammar
Chạy:
`prompts/06_GRAMMAR_MVP.md`

MVP:
- danh sách chủ đề
- bài học
- ví dụ
- quiz
- chấm điểm
- lưu lần làm

### BƯỚC 10 — Listening + Reading
Chạy:
`prompts/07_LISTENING_READING_MVP.md`

Chỉ làm một bài mẫu hoàn chỉnh cho mỗi module trước.
Không nhập hàng trăm bài cho đến khi luồng học đã ổn.

### BƯỚC 11 — Dashboard
Chạy:
`prompts/08_DASHBOARD_PROGRESS.md`

Dashboard phải tính từ dữ liệu thật:
- từ cần ôn hôm nay
- bài đã hoàn thành
- điểm gần nhất
- học tiếp
- ngày hết hạn

### BƯỚC 12 — Admin cơ bản
Chạy:
`prompts/09_ADMIN_MVP.md`

Admin giai đoạn đầu:
- xem học viên
- chỉnh level
- chỉnh start date
- chỉnh expiry date
- active / disable
- xem progress cơ bản

Không làm CMS nội dung lớn ở pha đầu.

### BƯỚC 13 — Security + test
Chạy:
`prompts/10_SECURITY_AND_TEST.md`

Không deploy trước khi:
- RLS test pass
- expired user không đọc được paid content
- student không xem được trang admin
- không có secret key trong source
- npm build pass

### BƯỚC 14 — GitHub
Yêu cầu Antigravity:
- initialize Git nếu chưa có
- tạo `.gitignore`
- commit
- kết nối GitHub repo private
- push

Không commit `.env.local`.

### BƯỚC 15 — Deploy Vercel
Chạy:
`prompts/11_DEPLOY_NETLIFY.md` (Triển khai GitHub → Vercel → Supabase)

Sau deploy:
- thêm env variables trên Vercel Dashboard (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- cấu hình SPA rewrite (vercel.json)
- cập nhật Supabase Auth Site URL và Redirect URLs
- test login trên production

### BƯỚC 16 — Nhập nội dung thật
Sau khi hệ thống ổn:
- chuẩn hóa Vocabulary
- Grammar
- Listening
- Reading

Dùng cấu trúc trong:
`docs/03_CONTENT_MODEL.md`

Không nhập nội dung ồ ạt trước khi schema được chốt.

### BƯỚC 17 — Pha 2
Sau khi học viên thật dùng ổn:
- SRS tốt hơn
- wrong answer notebook
- recommendation engine
- streak
- bài học đề xuất
- báo cáo giáo viên

Prompt:
`prompts/12_PHASE_2_LEARNING_ENGINE.md`

### BƯỚC 18 — Pha 3
- CMS nội dung
- import CSV/JSON
- duyệt bài
- xuất bản / ẩn bài
- phân quyền giáo viên

Prompt:
`prompts/13_PHASE_3_CMS.md`

### BƯỚC 19 — Pha 4 AI
Chỉ làm sau khi data model ổn.
AI đề xuất:
- câu hỏi mới
- ví dụ mới
- bài luyện theo lỗi
- lộ trình học tiếp

ORI duyệt trước khi publish.

Prompt:
`prompts/14_PHASE_4_AI.md`

## Khi Antigravity báo lỗi

Không gửi prompt kiểu "fix everything".

Copy cho ChatGPT:
1. ảnh lỗi
2. error text
3. file Antigravity vừa sửa
4. prompt bạn vừa dùng

Sau đó dùng prompt sửa lỗi nhỏ, giới hạn phạm vi.

## Mục tiêu hoàn thành Pha 1

Một học viên thật có thể:
1. đăng nhập
2. thấy ngày hết hạn
3. học Vocabulary
4. học Grammar
5. làm 1 Listening
6. làm 1 Reading
7. progress được lưu
8. hết hạn thì nội dung bị khóa thật
