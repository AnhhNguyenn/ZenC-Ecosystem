# CÔNG NGHỆ SỬ DỤNG (TECH STACK)

## 1. Môi Trường Phát Triển Chug (Monorepo)
- **Node.js:** >= 18.x
- **Python:** >= 3.10
- **Package Manager:** NPM Workspaces (Sử dụng cờ `--legacy-peer-deps` để giải quyết xung đột React 19/Next 15).
- **Hạ Tầng Local:** Docker & Docker Compose.

## 2. Lớp Frontend (`apps/web-user`, `apps/web-admin`)
- **Framework:** Next.js 14/15 (App Router).
- **State Management:**
  - Zustand (Dành cho Global UI State).
  - TanStack Query v5+ (Dành cho Server State, Data Fetching).
- **Styling:** SCSS Modules (Quy định: Không sử dụng Tailwind).
- **Forms & Validation:** React Hook Form + Zod.
- **Animations:** Framer Motion.
- **Bảng Biểu (Admin):** TanStack Table, Recharts.

## 3. Lớp Backend Gateway (`apps/gateway-server`)
- **Framework:** NestJS.
- **Real-time:** Socket.io + WebSockets (ws).
- **ORM / ODM:** TypeORM (Postgres) & Mongoose (MongoDB).
- **Bộ Nhớ Đệm:** Redis (Tách riêng biệt instance cho Pub/Sub và Caching).

## 4. Lớp AI Worker (`apps/ai-worker`)
- **Ngôn ngữ / Framework:** Python + FastAPI.
- **Background Jobs:** Celery.
- **AI Libraries:** Langchain, OpenAI SDK, Google Generative AI SDK, Azure Cognitive Services.

## 5. Lớp Dữ Liệu & Hàng Đợi (Databases & Message Brokers)
- **RDBMS:** PostgreSQL (Billing, Users, Progress).
- **NoSQL:** MongoDB (Transcripts, AI Data).
- **Vector DB:** Qdrant (Long-term Memory / RAG).
- **In-Memory Store:** Redis.
- **Message Broker:** RabbitMQ.

## 6. Lớp Môi Trường & Triển Khai (DevOps & Deployment)
- **Containerization:** Docker.
- **Orchestration:** Kubernetes (K8s) với Ingress Nginx.
- **Bảo Mật:** Kubernetes Secrets.
- **Monitoring/Tracing:** Sentry, LogRocket.
