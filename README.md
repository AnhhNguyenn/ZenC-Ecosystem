# 🌟 ZenC AI Ecosystem - V14 Enterprise Edition

ZenC là nền tảng học tiếng Anh giao tiếp AI thời gian thực (Real-time AI English Tutoring) cấp độ Enterprise. Hệ thống được xây dựng trên kiến trúc **Dual Brain Model** (Reflex Brain & Deep Brain) kết hợp **Gamification** gây nghiện, sẵn sàng chịu tải 10.000+ CCU với độ trễ âm thanh siêu thấp (<500ms).

---

## 🏗️ Kiến Trúc Hệ Thống (Architecture)

ZenC được chia thành các phân hệ lõi (Monorepo):

1.  **Reflex Brain (Gateway Server)** - `apps/gateway-server/`:
    *   **Công nghệ:** NestJS, Socket.io, TypeORM (PostgreSQL), Mongoose (MongoDB), Redis.
    *   **Vai trò:** Xử lý kết nối WebRTC/WebSocket thời gian thực, Rate Limiting, Billing (Token/s), Fallback Circuit Breaker (OpenAI ↔ Gemini).
2.  **Deep Brain (AI Worker)** - `apps/ai-worker/` (Python):
    *   **Công nghệ:** FastAPI, Celery/RabbitMQ, Qdrant (Vector DB).
    *   **Vai trò:** Nhận Message từ RabbitMQ xử lý Heavy-task: Chấm điểm phát âm (Azure Speech), Phân tích tính cách (LLaMA-3), Spaced Repetition (SM-2).
3.  **Hệ Thống Web (Frontend)** - `apps/web-user/` & `apps/web-admin/`:
    *   **Công nghệ:** Next.js 14/15, Zustand, React Query, SCSS Modules, Framer Motion.
    *   **Vai trò:** Giao diện học viên (Web-User) tích hợp gamification, micro-interactions (vibrate/confetti) và SEO Programmatic. Giao diện Admin (Web-Admin) quản lý nội dung, user.

> 📚 **Tài liệu Chi tiết:** Toàn bộ Blueprint, WebRTC Scale-up Plan, và nguyên tắc Design System nằm trong thư mục `/docs`. **Bắt buộc đọc `docs/architecture.md` trước khi code.**

---

## 🚀 Hướng Dẫn Cài Đặt (Local Development)

### 1. Yêu cầu hệ thống (Prerequisites)
*   Node.js >= 18.x
*   Python >= 3.10
*   Docker & Docker Compose (cho Database, Redis, RabbitMQ)
*   Tài khoản API Key: OpenAI, Google Gemini, Azure Speech (Tùy chọn)

### 2. Thiết lập Môi trường (Environment Setup)
Copy file `.env.example` thành `.env` tại thư mục gốc và điền các API Key cần thiết.
```bash
cp .env.example .env
```
*(Tham khảo `docs/development-guide.md` để biết chi tiết các biến môi trường).*

### 3. Khởi động Hạ tầng (Infrastructure)
Khởi động cơ sở dữ liệu Postgres, MongoDB, Redis, RabbitMQ và Qdrant qua Docker:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 4. Cài đặt Dependencies (Workspace)
Dự án sử dụng npm workspace. Do có sự xung đột peer dependencies của React 19 / Next 15 ở một số package, bắt buộc dùng cờ `--legacy-peer-deps`:
```bash
npm install --legacy-peer-deps
```

---

## 💻 Hướng Dẫn Chạy Dự Án (Run Services)

Để hệ thống hoạt động hoàn chỉnh, bạn cần chạy song song 3 services lõi. Mở 3 terminal riêng biệt:

### Terminal 1: Chạy Gateway Server (NestJS)
Reflex Brain xử lý WebSocket và API chính.
```bash
npm run start:dev --prefix apps/gateway-server
```

### Terminal 2: Chạy Deep Brain Worker (Python)
Lưu ý: Bạn cần tạo Virtual Environment (`venv`) trước khi chạy.
```bash
cd apps/ai-worker
python -m venv venv
source venv/bin/activate  # (Trên Windows: venv\Scripts\activate)
pip install -r requirements.txt
python main.py
```

### Terminal 3: Chạy Web User (Next.js)
Frontend cho học viên (Cổng 3001).
```bash
npm run dev --prefix apps/web-user
```
*(Nếu cần chạy trang Quản trị Admin, đổi thành `--prefix apps/web-admin`)*

---

## 🛠️ Quy Trình Code & Commit (Standards)

Hệ thống quản lý hàng chục nghìn kết nối realtime và tính toán tiền tệ (Tokens), vì vậy yêu cầu kỷ luật cực cao:
1.  **Atomic Operations:** Mọi logic cộng trừ tiền, điểm kinh nghiệm (XP) bắt buộc dùng Query Builder `.increment()` (Postgres) hoặc `INCRBY` (Redis) để chống Race Condition.
2.  **Zero-Trust Frontend:** Frontend tuyệt đối không tự tính điểm. Chỉ gửi tín hiệu submit kèm hash, Backend trả về kết quả.
3.  **Circuit Breaker & Fallback:** Bất kỳ external API nào (LLM, TTS) cũng phải đi qua Circuit Breaker để tránh tắc nghẽn event-loop khi đối tác sập.
4.  **No Zombie Pods:** Cấu hình timeout chặt chẽ (Ping/Pong) và Deep Health Check `/health` để K8s tự động dọn dẹp các tiến trình chết lâm sàng.
5.  **Dual Database Architecture:** PostgreSQL được dùng cho transaction/relational data (billing, progress, user profiles). MongoDB được dùng riêng cho các dữ liệu unstructured/document (transcripts, AI highlights, audit change snapshots).
6.  **K8s Security & Secrets Management:** TUYỆT ĐỐI không nhúng file `.env` vào image Docker hoặc mount thô bạo (raw mount) trên Production. Bạn phải tạo **Kubernetes Secret** chứa tất cả Key (JWT, Mongo URI, LLM Keys...) bằng lệnh:
    `kubectl create secret generic zenc-secrets-prod --from-env-file=.env -n zenc-production`
    Và sử dụng `envFrom: secretRef` trong các file Deployment.

> 💣 Hệ thống vừa được gỡ bỏ 12 "Quả bom nổ chậm" liên quan đến kiến trúc (Tham khảo lịch sử Commit). Mọi PR mới phải tuân thủ nghiêm ngặt chuẩn định tuyến, Error handling bằng Queue (RabbitMQ DLX) và Caching phân tách (Pub/Sub vs Cache).

> 💎 **Hệ thống hiện tại đã cập nhật Kiến trúc V2 (Go-Live Ready):** Bao gồm tích hợp **Social Login SSO**, chống **Prompt Injection**, **WebSocket DoS**, dọn dẹp **OOM/Temp File**, quản lý **Zombie Sessions**, phòng chống **Race Conditions** qua Idempotency Keys, **Denormalization Leaderboard** qua Redis, lưu trữ S3 **Presigned POST**, và **Sliding Window Summarization** cho LLM Context Window. Xem chi tiết tại `docs/ARCHITECTURE_V2_MIGRATION.md`.

---
**Happy Coding! Chúc bạn xây dựng ZenC Ecosystem thành công rực rỡ!** 🚀
