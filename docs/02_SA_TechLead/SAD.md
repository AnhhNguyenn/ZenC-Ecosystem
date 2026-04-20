# TÀI LIỆU KIẾN TRÚC HỆ THỐNG (SAD - System Architecture Document)

## 1. Sơ Đồ Kiến Trúc Tổng Thể

Hệ thống ZenC AI Ecosystem áp dụng mô hình kiến trúc **Dual Brain Model** nhằm tối ưu hóa thời gian thực (real-time) và năng lực xử lý phân tích chuyên sâu.

### Các Thành Phần Cốt Lõi:
1. **Frontend Layer (Next.js 14/15)**
   - `apps/web-user`: Dành cho học viên.
   - `apps/web-admin`: Dành cho quản trị viên.
   - Sử dụng Zustand cho Global UI State (5%), React Query cho Server State (15%), và Local State cho Component (80%).

2. **Reflex Brain (Gateway Server - NestJS)**
   - Hệ thống phản xạ nhanh xử lý các luồng WebRTC/WebSocket.
   - Giao tiếp trực tiếp với AI Models nhẹ (Google Gemini Native Audio) để đàm thoại với độ trễ < 500ms.
   - Quản lý phiên (Session), tính phí Token, rate limiting, kiểm tra Anti-Prompt Injection.

3. **Deep Brain (AI Worker - Python FastAPI)**
   - Hệ thống não sâu xử lý các tác vụ phân tích nặng (heavy-lifting) nhận lệnh từ RabbitMQ.
   - Gọi Azure Speech để chấm điểm phát âm, gọi LLMs lớn (LLaMA-3, OpenAI) để phân tích ngữ pháp, tính cách.
   - Xử lý thuật toán Spaced Repetition (SM-2) cho việc học từ vựng.

4. **Data Storage & Event Bus**
   - **PostgreSQL:** Dữ liệu Transactional (User profiles, Billing, Progress).
   - **MongoDB:** Dữ liệu Unstructured (Transcripts, AI Highlights, Audit Logs).
   - **Redis:** Pub/Sub (tách biệt Cache), Session State, Leaderboards (Denormalization).
   - **RabbitMQ / Celery:** Event Bus chính cho việc giao tiếp bất đồng bộ giữa Gateway và Worker. Cấu hình bắt buộc DLX (Dead Letter Exchange).
   - **Qdrant:** Vector Database lưu trữ Long-Term Memory (RAG) của người dùng.

## 2. Giải Pháp Mở Rộng & Chịu Tải (Scalability Solutions)
- **WebRTC Scale-Up:** Cấu hình Ingress `nginx.ingress.kubernetes.io/affinity: "cookie"` để duy trì Sticky Sessions.
- **Timeouts & Probes:** Tinh chỉnh `proxy-read-timeout` trên Ingress để tránh rớt kết nối WebSocket của LLM.
- **Connection Pools:** Khi chạy trên K8s thông qua PgBouncer, NestJS `DB_POOL_MAX` phải để mức thấp (VD: 5) và tắt Prepared Statements trong transaction mode.

## 3. Circuit Breaker & Fallbacks
- Bất cứ lời gọi API external nào (LLM, TTS) đều được bọc bởi Circuit Breaker.
- Hệ thống Fallback giữa OpenAI và Gemini tự động xử lý khi một bên bị Rate Limit (429) hoặc Timeout.
- Graceful Degradation: Ở phía client, nếu mic hỏng hoặc WebSocket đứt, ứng dụng lập tức chuyển sang chế độ text-chat fallback.
