# CHIẾN LƯỢC KIỂM THỬ (TEST STRATEGY)

## 1. Mục Tiêu Kiểm Thử
Đảm bảo hệ thống ZenC Ecosystem ổn định khi chịu tải 10,000 CCU, duy trì độ trễ âm thanh WebRTC dưới 500ms, và đảm bảo tính chính xác 100% trong quá trình tính toán tiền tệ/XP (Không xảy ra lỗi double-spend).

## 2. Các Loại Hình Kiểm Thử (Testing Types)

### 2.1. Functional Testing (Kiểm thử Chức Năng)
- **Kiểm thử WebRTC/WebSocket:** Kiểm tra quá trình tạo phòng, truyền tải voice, tự động reconnect và ngắt kết nối an toàn (Zombie connection cleanup).
- **Kiểm thử API (RESTful):** Kiểm thử luồng đăng ký, đăng nhập, nạp token và hệ thống CRUD khóa học.
- **Kiểm thử Gamification:** Xác minh Leaderboard (Redis) được cập nhật ngay lập tức khi hoàn thành Task, kiểm tra logic nhận XP.

### 2.2. Non-Functional Testing (Kiểm thử Phi Chức Năng)
- **Load / Stress Testing:** Sử dụng công cụ (như k6 hoặc JMeter) để giả lập 10,000 kết nối WebSocket gửi/nhận tín hiệu đồng thời, nhằm đo ngưỡng chịu đựng của Gateway và RabbitMQ Queue.
- **Failover / Fallback Testing:** Ngắt kết nối mạng mô phỏng (Chaos Engineering) giữa Gateway và LLM API. Hệ thống bắt buộc phải tự động fallback sang cơ chế Text-chat mượt mà.
- **Security Testing:** Tấn công giả lập Prompt Injection thông qua input âm thanh/văn bản. Kiểm tra giới hạn Rate Limiting tại các Endpoint Auth để tránh Brute-force/DDoS.

## 3. Môi Trường Kiểm Thử
- **Local (Dev):** Docker Compose (Chạy test tự động qua Jest/PyTest).
- **Staging / UAT (K8s):** Bản sao của cấu hình Production, nối với Sandbox API của Stripe/Apple/Google và LLM API (Gemini/OpenAI).
- **Production (K8s):** Môi trường thực. Tuyệt đối không thực thi các Load Test phá hoại trên Production.

## 4. Công Cụ Sử Dụng
- K6 / JMeter (Load Testing)
- Playwright / Cypress (E2E Frontend Testing)
- Jest (NestJS, React) & PyTest (Python AI Worker)
- Postman (API Testing & Automation)
