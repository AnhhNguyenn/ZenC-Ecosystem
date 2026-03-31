# V14 Enterprise Architecture Manifesto

Welcome to the ZenC Ecosystem frontend project. To maintain a $10M+ SaaS-grade architecture over years of development, all contributors MUST adhere to the following strict guidelines.

## 1. The 10 Golden Rules of Execution
1. **Progressive Complexity Rollout:** We layer in complexity (SEO, Feature Flags, Rate-Limited Analytics queues) exactly when needed, not before.
2. **Strict Naming & Structure Conventions:** 
   - Files: `user.api.ts`, `user.service.ts`, `useUser.ts`, `UserCard.tsx`.
   - Folders: Feature-sliced (`feature-name/components/`, `hooks/`, `services/`).
3. **The 80/15/5 State Rule:** Do NOT abuse Zustand.
   - 80% Local State (Components)
   - 15% Server State (React Query via central `queryKeys.ts`)
   - 5% Global UI State (Zustand: Sidebar toggles, Theme).
4. **Early Error Logging:** Sentry/LogRocket initializations must catch API/UI traps immediately.
5. **Strict Bundle Size Control:** `const Chart = dynamic(() => import('./Chart'))`. Any heavy library MUST be lazy-loaded. 
6. **Max Component Size Limit:** If a `.tsx` file exceeds **300 lines**, strictly refactor and split it.
7. **UX Consistency > UI Beauty:** A predictable dashboard is a fast dashboard. Use the exact same button placements, card paddings (`20px`), and skeleton patterns globally.
8. **Real SEO Content Strategy:** Public paths only. `/blog`, `/guides`, `/lessons`.
9. **Graceful Voice Degradation:** The AI Voice module is highly volatile. If the mic is blocked, websocket drops, or encoding fails, it MUST instantly degrade to a text-chat fallback.
10. **Docs as Code:** If you build a core pattern, document it here.

## 2. API Layer & Isolation
- Code MUST flow: `Component` -> `Hook` -> `Service` -> `API`. A component calling `axios.get` directly for complex data is a fireable offense. Simple, isolated fetch arrays (like `/health`) are permitted in hooks.
- **Layered Error Boundaries:** `AppErrorBoundary` -> `LayoutErrorBoundary` -> `FeatureErrorBoundary`. A crashing widget should never crash the page.

If you don't know, ask. Don't break the architecture.

---

## 3. Backend Architecture (NestJS Gateway)

### 3.1 Dual-Brain Pedagogical System

Hai AI provider chạy song song, phân vai rõ ràng:

| Provider | Vai trò | Khi nào kích hoạt |
|----------|---------|------------------|
| **Gemini Live** (Alex) | Hội thoại tự nhiên, phát âm, giao tiếp thông thường | Mặc định |
| **OpenAI Realtime** (Sarah) | Giảng giải ngữ pháp sâu, phân tích lỗi sai | Failover khi Gemini lỗi |
| **Deep Brain** (LLama-3 via Groq) | Phân loại intent `STUDY` vs `CHAT` trước khi route | Mỗi transcript đủ độ dài |

**Intent Classification flow:**
```
User speaks → STT → classifyIntent() [Groq, <1500ms] → CHAT (Gemini) or STUDY (Deep Brain queue)
```

### 3.2 Database & Storage Architecture (Phase G)

Chúng ta sử dụng kiến trúc **Dual Database** để tối ưu hiệu suất và tiết kiệm chi phí lưu trữ:

| Database | Loại | Data được lưu | Vai trò |
|----------|------|---------------|---------|
| **PostgreSQL 15+** | Relational | Users, Billing, Scores, Metadata | Dữ liệu cấu trúc tĩnh, yêu cầu tính toàn vẹn (ACID) cao. |
| **MongoDB 6+** | Document | Transcripts, Highlights, ChangeLogs | Dữ liệu unstructured/JSON lớn. Tránh phình to bảng Postgres. |
| **Qdrant** | Vector | Content Embeddings, Lesson Plans | Lưu trữ Vector phục vụ RAG (Retrieval-Augmented Generation). |

*Lưu ý: Mọi Entity liên quan tới Document Storage phải có trường tham chiếu (vd: `conversationId`) nối giữa Postgres và MongoDB.*

### 3.3 RabbitMQ — Queue Architecture (Phase G)

**Cấm dùng Redis làm queue!** Redis chỉ được phép dùng cho:
- Rate Limiting (`INCR` + `EXPIRE`)
- Session lookup O(1) (`HSET`/`HGET`)
- User Profile cache (TTL 24h)
- Socket.io multi-pod Pub/Sub adapter

**RabbitMQ queues (durable: true):**

| Queue | Publisher | Consumer | Nội dung |
|-------|-----------|----------|---------|
| `deep_brain_tasks` | `VoiceGateway` (NestJS) | `RabbitMQConsumer` (Python) | `{sessionId, userId, question, taskType}` |
| `post_session_eval` | `VoiceGateway` (NestJS) | `RabbitMQConsumer` (Python) | Full transcript để chấm điểm cuối buổi |

**Retry strategy:** `nack(requeue=True)` on failure → tự động requeue. Dead Letter Queue (DLQ) cần setup thêm nếu muốn giới hạn retry count.

### 3.4 WebSocket Event Handlers (voice.gateway.ts)

Tất cả `@SubscribeMessage` handlers phải có:
```typescript
if (!data) return;                    // Null guard — bắt buộc
try { ... } catch (err) { ... }       // Crash isolation — bắt buộc
```

### 3.5 Provider Failover Rules

- Max **2 lần** switch Gemini ↔ OpenAI per session (`switchAttempts` map).
- Mutex guard `isSwitching` ngăn concurrent duplicate failover.
- Failover inject **20 dòng transcript gần nhất** từ Redis để AI mới không mất context.

### 3.6 Security Rules (Phase F)

- **JWT Refresh Token**: `crypto.sha256(token)` → `bcrypt.hash()`. KHÔNG bao giờ bcrypt raw JWT (truncation attack).
- **Session cleanup**: Cron mỗi giờ xóa sessions có `endTime IS NULL` và `startTime < 2h trước` (zombie sessions).
- **Audio limits**: Tối đa `4KB / 15 EPS` per socket. Vượt quá → kill connection.
- **Deep Brain queue cap**: `LTRIM` giới hạn 10,000 tasks trong Redis (legacy) / RabbitMQ tự quản lý.

---

## 4. Hardware Requirements & Deployment Strategy (Phase G)

ZenC AI được thiết kế theo kiến trúc Microservices và Cloud-Native (Docker/K8s). Toàn bộ sức mạnh tính toán AI nặng nhất (LLM, Voice, Text-to-Speech) đã được **đẩy lên các Cloud APIs** (Gemini, Groq, ElevenLabs).

Do đó, hệ thống **KHÔNG CẦN CHẠY AI CỤC BỘ** và **TUYỆT ĐỐI KHÔNG CẦN THUÊ SERVER CÓ GPU (VGA)**. Việc thuê máy có GPU (như RTX 3060Ti, GTX 1080) là vô cùng lãng phí vì GPU sẽ ở mức 0% Usage.

### 4.1. Cấu hình Server Đề Xuất (Dành cho VPS/Cloud Server)

Bắt buộc sử dụng hệ điều hành **Linux (Ubuntu 22.04 LTS hoặc 24.04 LTS)** để chạy Docker Native với hiệu năng I/O tốt nhất. KHÔNG sử dụng Windows Server để chạy production.

| Môi trường | Loại Server | OS | CPU | RAM | Storage | Ghi chú |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dev / Staging (PoC)** | Single VPS | Ubuntu 22.04 | 4 Cores | 8GB - 16GB | 50GB NVMe | Đủ gánh toàn bộ DB (Postgres, Mongo, Redis, RMQ) + 2 Backend + 2 Frontend qua `docker-compose.dev.yml`. Chịu tải ~100-200 CCU. |
| **Production (K8s Base)** | Cluster (3 Nodes) | Ubuntu 22.04 | 8 Cores/Node | 16GB/Node | 100GB/Node | High Availability. MongoDB chạy Replica Set (3 nodes). Postgres chạy Master/Slave. |

### 4.2. Khuyến nghị Tối Ưu Chi Phí (Hybrid Cloud)
Để tiết kiệm chi phí tối đa trong giai đoạn đầu ra mắt (Go-to-Market):
1.  **Frontend (Web-User, Web-Admin):** Deploy miễn phí 100% lên Vercel (hoặc Netlify) tận dụng Edge CDN toàn cầu.
2.  **Database:** Sử dụng các dịch vụ Managed DB miễn phí hoặc giá rẻ (MongoDB Atlas M0 Free, Supabase cho Postgres, Upstash cho Redis).
3.  **Backend (Gateway & Worker):** Thuê 1 VPS Linux tầm trung (giá rẻ, không GPU) chạy Docker, kết nối URI tới các Database bên ngoài. (VPS chỉ tốn RAM chạy ứng dụng, không tốn RAM chạy Database).

## 5. Kubernetes Production Layout (Phase G)

```
k8s/
├── 01-namespaces.yaml       # zenc-production, zenc-monitoring
├── 04-api-deployment.yaml   # api-pool: 100–300 pods, 1 vCPU limit
├── 05-worker-deployment.yaml # worker-pool: 50–200 pods
├── 06-ai-deployment.yaml    # ai-gpu-pool: NVIDIA GPU, 32Gi RAM (Deprecated - Không còn dùng Model Local)
├── 08-hpa.yaml              # HPA: CPU + RMQ queue depth metrics
├── 09-ingress.yaml          # NGINX: 50 RPS, 15s timeout, circuit breaker
└── 10-pgbouncer.yaml        # PgBouncer: 5000 clients → 100 PG connections
```

**Multi-Region Failover:** Việt Nam → Singapore → Tokyo (Cloudflare DNS, 60s TTL)

