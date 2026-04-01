# KIẾN TRÚC HỆ THỐNG ZEN-C (V2.0: KINH DOANH VÀ BẢO MẬT)

Bản cập nhật kiến trúc này (Phase 1-4) mang tính chất sống còn để dự án sẵn sàng Go-Live, chuyển đổi từ một mô hình Prototype (chạy được) sang một hệ thống **Enterprise-ready** (Thương mại hóa, Bảo mật, Mở rộng, và Chống gian lận).

Dưới đây là sơ đồ luồng dữ liệu (Data Flow) và các biện pháp bảo vệ đã được áp dụng ở tầng hạ tầng.

---

## 1. TẦNG BẢO MẬT & ĐỊNH DANH (SECURITY & ONBOARDING)
- **Zero-Friction Onboarding:** Hỗ trợ đăng nhập nhanh bằng Social Auth (Google / Apple SSO). Server decode trực tiếp Identity Token thay vì tin tưởng mock data.
- **Email / OTP:** Sử dụng Nodemailer gửi OTP.
- **Rate Limit & IP Blacklisting:**
    - Đăng ký & Quên mật khẩu: Giới hạn 3 lượt / 15 phút theo IP hoặc `x-device-id`.
    - WebSocket Voice: Chặn ngay nếu vượt ngưỡng 10 sự kiện âm thanh / giây, Blacklist IP 15 phút nếu có dấu hiệu DoS.
- **Zombie Sessions / JWT Revoke:** Không query Database trên mỗi Request. Sử dụng phiên bản Redis `auth_version` kết hợp JTI Blacklist `jwt_blacklist` để thu hồi JWT ngay tức thì toàn cầu và cục bộ.
- **Data Leak Prevention (Global Exception Filter):** Bắt mọi lỗi 500. Trả về cho User một `errorId` (UUID) và ghi log chi tiết nội bộ, tuyệt đối giấu Stack Trace, SQL schema khi ở môi trường Production.

## 2. HẠ TẦNG KINH DOANH (MONETIZATION & STORAGE)
- **Monetization (Payments):**
    - Hai bảng sổ cái tách biệt: `subscriptions` (quản lý trạng thái gói trả phí) và `transaction_history` (ghi lại Audit log mua hàng).
    - API `POST /payments/verify-receipt` để kích hoạt VIP.
    - API `POST /payments/restore-purchases` tuân thủ Apple Guideline 3.1.1 (Khôi phục giao dịch).
- **Storage (AWS S3/MinIO):**
    - Thay vì truyền tải file Media đi qua Gateway Server, Server sử dụng `@aws-sdk/s3-presigned-post` để cấp URL cho Mobile Upload trực tiếp. Ràng buộc bảo mật qua MIME type (Image, Audio) và `content-length-range` (ví dụ Max 20MB).

## 3. TÍNH NĂNG "KILLER" & AI CORE
- **The "Cambly Killer" (Vision Roleplay):** Mobile App tải ảnh lên S3, truyền `imageUrl` thông qua event WebSocket `vision_context`. Server chuyển đổi ảnh thành `base64` realtime chunk và đút thẳng vào API của Gemini, biến AI thành trợ lý nhận diện thế giới thực.
- **The "ChatGPT Killer" (Long-term Memory via Qdrant):** Khi một phiên hội thoại kéo dài (hoặc chốt sổ), Gateway sẽ không nhồi nguyên cụm Transcript vào Prompts. Nó đẩy event `summarize_long_term_memory` xuống RabbitMQ. Worker (Python) phân tích hội thoại ra một mảng JSON các "Core Facts" và nhúng vào Qdrant/Redis, cung cấp Context "Nhớ dai" cho các session tương lai mà không bị nghẽn Context Window (tràn Token LLM).
- **The "Elsa Killer" (Acoustic Phoneme Scoring):** Hỗ trợ Azure Speech API lấy cấp độ "Phoneme Granularity", trả về cho User từng khẩu hình sai để điều chỉnh.

## 4. HẠ TẦNG VẬN HÀNH & CHỐNG SẬP (STABILITY & DEVOPS)
- **Race Condition (Anti-XP Spam):** Áp dụng cờ Idempotency Key (Redis `SETNX` lock 3600 giây) trong hàm `submitProgressAndCalculateXp`. Lệnh cộng XP chạy thông qua Atomic Update (`increment()`) trong Postgres và `ZINCRBY` trong Redis. Tool spam đồng thời sẽ chỉ nhận lại Fake Success.
- **Tràn RAM (OOM) & Rác Ổ cứng (AI Worker):**
    - File Python dọn rác bộ nhớ bằng `gc.collect()` và xóa con trỏ biến lớn (Audio Bytes) ngay trong block `finally`.
    - Chuẩn bị Class `ManagedTempFile` (Context Manager) để an toàn tự hủy file rác trên ổ cứng (cho FFmpeg/Whisper).
- **LLM Hallucination Firewall:** Bọc bộ Parsing kết quả JSON bằng Regex dọn dẹp Markdown (````json`). Nếu LLM trả về rác, hệ thống tự động Retry một lần với System Prompt cảnh cáo nghiêm khắc.
- **RabbitMQ Dead Letter Queue (DLQ):** Các queue (ví dụ `deep_brain_tasks`) được cấu hình DLX. Các Message lỗi văng exception tại Python Worker sẽ được Requeue. Sau 3 lần thất bại (Dò header `x-death`), message sẽ bị ném thẳng vào DLQ để phòng chống vòng lặp độc hại (Infinite Poison Message Loop) gây 100% CPU.
- **PgBouncer & TypeORM:** Tắt Prepared Statements (`prepared_statement: false`) và set `query_timeout` (10s) để chống lỗi treo Pool DB khi xài PgBouncer Transaction Mode.
- **Graceful Shutdown WebSocket:** Bắt tín hiệu ngắt K8s (`SIGTERM`), lập tức chặn người dùng mới, Gửi event `server_restarting` xuống các App đang mở, chờ 10s để xả Token/Billing đang tính toán trên RAM xuống DB rồi mới tắt server.
