# HƯỚNG DẪN SỬ DỤNG (USER MANUAL)

## 1. Dành cho Học viên (Web-User)

### Đăng ký / Đăng nhập
- Truy cập vào trang chủ. Bạn có thể đăng ký bằng Email hoặc sử dụng tài khoản Google/Apple (Social Login/SSO) để truy cập nhanh chóng. Hệ thống tự động xác thực email của bạn nếu dùng SSO.

### Bắt đầu buổi học (AI Voice Tutor)
1. Đảm bảo bạn đã cấp quyền sử dụng Microphone (Mic) cho trình duyệt.
2. Chọn bài học hoặc khóa học đang theo dõi.
3. Bấm vào nút "Bắt đầu cuộc gọi" để kết nối với AI.
4. Trò chuyện tự nhiên với gia sư ảo. Nếu gặp sự cố với microphone hoặc mạng bị chập chờn, giao diện sẽ tự động chuyển sang tính năng **Text-Chat** để không gián đoạn quá trình học.
5. Sau buổi học, bạn có thể xem lại bản dịch, các điểm ngữ pháp (Highlights) và nhận Điểm kinh nghiệm (XP) cho nỗ lực của mình.

### Quản lý Hồ sơ & Token
- Tại Bảng điều khiển (Dashboard), bạn có thể kiểm tra số lượng Token còn lại, hạng của bạn trên Bảng xếp hạng, và các từ vựng cần ôn tập theo lịch (Spaced Repetition).

---

## 2. Dành cho Quản trị viên (Web-Admin)

### Quản lý Nội dung (CMS)
- Đăng nhập bằng tài khoản được phân quyền Admin.
- Truy cập menu **Khóa Học (Courses)** để Thêm / Sửa / Xóa bài học. Mọi dữ liệu sửa đổi đều được tự động lưu phiên bản trên MongoDB.

### Quản lý Người dùng & Thanh toán
- **Người dùng:** Bạn có thể xem lịch sử học tập của học viên, tạm khóa hoặc ban tài khoản đối với những người dùng vi phạm nguyên tắc.
- **Thanh toán:** Đối với các trường hợp người dùng gửi yêu cầu Refund từ Apple/Google, hệ thống sẽ tự động cập nhật trạng thái transaction thành "REFUNDED" và hạ cấp tài khoản. Bạn có thể tra cứu hóa đơn này trong menu "Transactions".
