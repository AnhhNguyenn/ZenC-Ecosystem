# ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS - Software Requirements Specification)

## 1. Yêu Cầu Chức Năng (Functional Requirements)

### 1.1. Ứng Dụng Web Học Viên (Web-User)
- Cung cấp giao diện luyện nói WebRTC với AI Tutor.
- Hiển thị bảng điều khiển cá nhân (Dashboard) bao gồm tiến độ học tập và thông số XP.
- Tích hợp Gamification (micro-interactions như vibrate/confetti).
- Hỗ trợ Social Login (SSO).
- Giao diện có khả năng xử lý fallback mượt mà: nếu WebRTC hỏng, tự động chuyển sang text-chat.

### 1.2. Ứng Dụng Quản Trị (Web-Admin)
- Cung cấp tính năng thêm/sửa/xóa bài học, nội dung (CMS).
- Quản lý người dùng, xem lịch sử học tập.
- Hiển thị Analytics Dashboard về token, doanh thu, thời lượng hệ thống hoạt động.

### 1.3. Gateway (Reflex Brain)
- Xử lý xác thực người dùng và Quản lý phiên (Session Management).
- Khởi tạo kết nối WebSocket với thời gian phản hồi cực thấp.
- Trừ token người dùng theo thời gian thực.
- Cung cấp Rate Limiting chặt chẽ cho API.

### 1.4. Worker (Deep Brain)
- Nhận xử lý dữ liệu nặng qua RabbitMQ (không dùng Pub/Sub cho các dữ liệu quan trọng).
- Tích hợp Azure Speech để đánh giá phát âm.
- Lưu trữ và phân tích lịch sử đàm thoại dài hạn vào vector database (Qdrant).

## 2. Yêu Cầu Phi Chức Năng (Non-Functional Requirements)

### 2.1. Hiệu Năng & Khả năng Mở rộng (Performance & Scalability)
- Độ trễ End-to-End Audio: < 500ms.
- Số lượng Concurrent Users (CCU): Lên tới 10,000.
- Hệ thống cần hỗ trợ Kubernetes, tự động scale theo tải.

### 2.2. Độ Tin Cậy & Phục Hồi (Reliability & Availability)
- **Circuit Breaker:** Các kết nối với LLM ngoài (OpenAI, Gemini) phải có Circuit Breaker để fallback khi đối tác sập.
- **No Zombie Pods:** Cấu hình Health check liên tục (Deep Health Check) qua `/health` để K8s tự dọn dẹp các service "chết lâm sàng".
- **Zero Data Loss:** Message queue phải có Dead Letter Exchange (DLX) đối phó với lỗi xử lý.

### 2.3. Bảo Mật (Security)
- Quản lý secret qua K8s Secrets (`envFrom: secretRef`), không lưu `.env` trong Docker Image.
- Chống Prompt Injection thông qua bước kiểm tra tiền xử lý bằng Gemini 1.5 Flash (fail-closed timeout 1.5s).
- Chống WebSocket DoS bằng cách đặt Timeout khắt khe cho kết nối.
- Sử dụng RBAC để quản lý quyền hạn Admin.
