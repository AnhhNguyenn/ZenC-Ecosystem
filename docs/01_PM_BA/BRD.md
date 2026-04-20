# TÀI LIỆU YÊU CẦU NGHIỆP VỤ (BRD - Business Requirements Document)

## 1. Giới Thiệu
Tài liệu này xác định các yêu cầu nghiệp vụ và logic kinh doanh cốt lõi cho nền tảng ZenC AI Ecosystem.

## 2. Logic Kinh Doanh (Business Logic)
### 2.1. Dual Brain Model (Mô hình Trí não Kép)
Hệ thống sử dụng hai lớp xử lý:
- **Reflex Brain:** Đóng vai trò phản xạ nhanh, xử lý tương tác giọng nói tức thì thông qua Google Gemini Native Audio. Chịu trách nhiệm cho việc giao tiếp cơ bản, tính toán token.
- **Deep Brain:** Thực hiện các tác vụ phân tích sâu (heavy tasks) như chấm điểm phát âm bằng Azure Speech, phân tích ngữ pháp, tính cách người dùng (LLaMA-3), và lên lịch học lặp lại ngắt quãng (SM-2).

### 2.2. Gamification & Progression (Trò chơi hóa và Tiến trình học)
- **Hệ thống Điểm kinh nghiệm (XP):** Người dùng nhận XP sau mỗi bài học, thử thách hoàn thành.
- **Leaderboard (Bảng xếp hạng):** Hiển thị thứ hạng người dùng (sử dụng Redis để chống thắt cổ chai cơ sở dữ liệu).
- **Nguyên tắc cốt lõi:** Bất kỳ thao tác cộng/trừ tiền tệ, token hay XP phải dùng Query Builder `.increment()` (PostgreSQL) hoặc `INCRBY` (Redis). Frontend tuyệt đối không tự tính điểm mà chỉ gửi tín hiệu (Zero-Trust Frontend).

### 2.3. Monetization & Billing (Doanh thu & Thanh toán)
- Hệ thống tính phí người dùng theo số lượng Token hoặc thời gian sử dụng thực tế (Token/s billing).
- Token được trừ trực tiếp qua Gateway server.
- Xử lý hoàn tiền: Khi nhận Webhook hoàn tiền từ Apple/Google, cập nhật trạng thái transaction thành `REFUNDED` và hạ cấp tài khoản về `FREE`.

## 3. Vai Trò Người Dùng (User Roles)
- **Học viên (Student):** Học tiếng Anh qua Web, sử dụng AI Tutor, quản lý profile và xem tiến độ.
- **Quản trị viên (Admin):** Quản lý khóa học, kiểm duyệt nội dung, quản lý người dùng (Cấp quyền, Ban tài khoản).
