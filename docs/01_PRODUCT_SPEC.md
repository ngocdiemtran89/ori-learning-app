# ORI Learning — Product Spec

## Mục tiêu
Xây cổng học tập dành cho học viên ORI TOEIC, truy cập bằng tài khoản có thời hạn.

## Nhóm người dùng

### Student
- đăng nhập
- xem thời hạn tài khoản
- học nội dung được cấp
- lưu tiến độ
- lưu từ khó
- làm quiz
- xem kết quả

### Admin
- xem học viên
- chỉnh level
- chỉnh ngày bắt đầu / hết hạn
- khóa / mở tài khoản
- xem tiến độ cơ bản

## Module
1. Dashboard
2. Vocabulary
3. Grammar
4. Listening
5. Reading
6. Account
7. Admin

## Level dự kiến
- foundation: Mất gốc → 400
- intermediate: 400 → 550
- upper: 550 → 650+

## Quy tắc truy cập
Student được truy cập paid content khi:
- đã login
- profile.status = active
- access_expires_at > now()

Nếu không:
- không query được paid content ở database
- UI đưa về trang Expired/Access denied

## Non-goals Pha 1
- thanh toán online
- AI tự publish nội dung
- social/community
- chat realtime
- gamification phức tạp
- app mobile native
- video hosting nặng
