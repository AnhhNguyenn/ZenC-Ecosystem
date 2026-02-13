# ZenC AI Ecosystem – Master Technical Specification (v6.6 – Web Expansion)

**Project Owner:** ZenC Holdings
**Status:** Execution Ready
**Strictness:** Extreme – No Architectural Deviations
**Mission:** Build a complete, production‑grade real‑time AI English Tutoring Platform with adaptive intelligence, strong security, and scalable infrastructure.

---

# 1. Architecture Overview – Dual Brain Model

## 1.1 Reflex Brain – Gateway (NestJS)

**Responsibilities**

- Real‑time Voice Input/Output
- Authentication & Session Management
- Billing / Token Accounting
- Redis Caching
- Proactive Greeting on Connect
- Safety Guardrails & Rate Limiting

**Technology**

- NestJS
- Socket.io + ws
- Redis
- Google Gemini Native Audio (WebSocket)

**Performance KPI**

- End‑to‑End Audio Latency < **500ms**

---

## 1.2 Deep Brain – Worker (Python)

**Responsibilities**

- Grammar & Pronunciation Analysis
- RAG (Retrieval Augmented Generation)
- Spaced Repetition Scheduler (SuperMemo‑2)
- Learning Analytics
- Long‑Term Memory Persistence

**Technology**

- FastAPI
- Celery
- Redis Pub/Sub
- Qdrant Vector Database

---

## 1.3 Web Frontend – User Portal (`apps/web-user`)

**Responsibilities**

- Immersive Voice Practice Interface (WebRTC/WebSocket)
- Learning Dashboard & Progress Tracking
- Daily Challenges & Exercises
- Subscription Management

**Technology**

- **Framework:** Next.js 14 (App Router)
- **Styling:** **SCSS Modules** (Pure CSS, No Tailwind)
- **State:** Zustand + TanStack Query
- **Validation:** Zod + React Hook Form
- **Security:** Middleware, CSP Headers

---

## 1.4 Web Frontend – Admin & CMS (`apps/web-admin`)

**Responsibilities**

- User Management (Ban/Grant)
- Content Management System (CMS) for Courses
- Analytics Dashboard (Recharts)
- System Audit Logs

**Technology**

- **Framework:** Next.js 14 (App Router)
- **Styling:** **SCSS Modules** (Admin Theme)
- **Tables:** TanStack Table
- **Charts:** Recharts

---

## 1.5 Event Bus – Nervous System

**Redis Pub/Sub** connects Gateway and Worker asynchronously.
Gateway must **never block** waiting for Deep Brain.

---

# 2. Monorepo Structure

```
ZenC‑Ecosystem/
├── apps/
│   ├── gateway‑server/
│   ├── ai‑worker/
│   ├── web‑user/         # [NEW]
│   └── web‑admin/        # [NEW]
├── packages/
│   └── shared‑types
├── infra/
│   ├── docker
│   ├── database
│   └── docs
├── docker‑compose.yml
├── DEVELOPMENT_GUIDE.md  # [NEW] Standard Process
└── README.md
```

---

# 3. Infrastructure Services

| Service    | Port | Role                       |
| ---------- | ---- | -------------------------- |
| SQL Server | 1433 | Persistent Data            |
| Redis      | 6379 | Cache, Rate Limit, Pub/Sub |
| Qdrant     | 6333 | Vector Knowledge Base      |
| Gateway    | 3000 | Reflex Brain               |
| Worker     | 8000 | Deep Brain                 |
| Web User   | 3001 | Learner Portal             |
| Web Admin  | 3002 | Management Console         |

---

# 4. Database Schema (UUID Strict)

## 4.1 Users

- UserID (UUID, PK)
- Email (Unique, Indexed)
- PasswordHash (Bcrypt)
- Tier (FREE / PRO / UNLIMITED)
- TokenBalance (Atomic Update)
- Status (ACTIVE / LOCKED / BANNED)
- IsDeleted (Soft Delete)
- DeletedAt

---

## 4.2 UserProfiles

- UserID (FK, Unique)
- CurrentLevel (A1–C2)
- ConfidenceScore (0.0–1.0)
- VnSupportEnabled
- SpeakingSpeedMultiplier (0.8–1.2)

---

## 4.3 Sessions

- SessionID
- UserID
- StartTime
- EndTime
- TotalTokensConsumed
- ClientIP
- DeviceFingerprint

---

## 4.4 UserMistakes

- MistakeID
- UserID
- OriginalSentence
- CorrectedSentence
- GrammarRuleID
- NextReviewAt

---

## 4.5 AdminAuditLogs

- LogID
- AdminID
- TargetUserID
- Action
- Reason
- Timestamp

---

# 5. Gateway Core Logic

## 5.1 Audio Pipeline

- Protocol: WebSocket (socket.io)
- Format: PCM 16‑bit / 16kHz / Mono
- Jitter Buffer: Size 3
- **RAM Streaming Only** – No Disk Writes

---

## 5.2 Proactive Greeting

**Event:** `client_connected`
Gateway checks Redis `daily_review:{userId}` and user profile → generates greeting → streams audio immediately before user speaks.

---

## 5.3 Adaptive Prompt Switch

```
confidence < 0.4  → explain in Vietnamese
confidence > 0.8  → natural English only
else              → balanced mode
```

---

## 5.4 Anti‑Abuse

- Multi‑Login Kick via Redis active_session
- Token Watchdog (>500 tokens/min anomaly pause)
- Tier‑Based Rate Limits

---

## 5.5 God Mode Admin API

`PATCH /admin/users/:id/grant`
Actions: update Tier/Tokens → write AdminAuditLogs → invalidate Redis cache immediately.

---

# 6. Deep Brain Logic

## 6.1 Asynchronous Grammar Analysis

Triggered by `session_ended_event` via Redis Pub/Sub.
Worker analyzes transcript and updates UserMistakes.

---

## 6.2 Spaced Repetition Scheduler

Algorithm: **SuperMemo‑2**
Daily Cron pushes due mistakes to Redis list `daily_review:{userId}`.

---

## 6.3 RAG Engine

- Ingest Curriculum PDFs
- Chunk 512 tokens
- Embed (`text‑embedding‑004`)
- Store in Qdrant
- Inject retrieved context into Gemini prompts

---

# 7. Frontend UI/UX (User App)

## 7.1 Global Theme (SCSS Variables)

- Primary: Indigo 600
- Secondary: Cyan 500
- Visual Style: Clean, Modern, Premium

## 7.2 Magic Mic

- Reactive Visualizer (Listening/Thinking/Speaking states)
- CSS Animations (No heavy JS canvas unless needed)

---

# 8. Coding & Documentation Standards

- Strict TypeScript (No `any`)
- Python Pydantic Models
- SCSS Modules for Styling (No Global CSS pollution)
- Mandatory JSDoc/Docstrings
- Try/Catch All Async Functions
- Structured Error Logging

---

# 9. Security Layer

- JWT + Refresh Token Rotation
- Email Verification
- Password Policy ≥ 8 chars
- HTTPS / WSS Only
- AES‑256 Encryption at Rest
- CSRF & XSS Protection (Admin Panel)
- Soft Delete Strategy
- **Next.js Middleware** for Route Protection
- **Zod** Input Validation

---

# 10. Observability & Monitoring

**Metrics**

- Active Connections
- Audio Latency
- Token Usage per Session
- Queue Lengths

**Stack:** Prometheus + Grafana + Loki

---

# 11. Backup & Disaster Recovery

**SQL Server**

- Full Backup: Daily
- Incremental: Hourly
- Retention: 14 Days

**Qdrant** Snapshot: Every 24h

RPO: 1 Hour
RTO: 2 Hours

---

# 12. Feature Flags

```
FEATURE_PROACTIVE_GREETING
FEATURE_RAG_ENABLED
FEATURE_VN_HINT
FEATURE_AUDIO_RECORDING
```

---

# 13. API Versioning

- `/api/v1/...`
- 90‑Day Deprecation Policy

---

# 14. Queue Isolation

- analysis_queue
- billing_queue
- notification_queue
- vector_queue

---

# 15. Rate Limit by Tier

| Tier  | Requests/min | Voice Minutes/day |
| ----- | ------------ | ----------------- |
| FREE  | 20           | 15                |
| PRO   | 60           | 120               |
| ADMIN | 120          | Unlimited         |

---

# 16. Model Fallback Strategy

If Gemini fails:

1. Retry 2 Times
2. Switch to Text Mode Response

---

# 17. Legal / Compliance Endpoints

- Export User Data
- Delete All User Data (GDPR)

---

# 18. Future Multi‑Region Scalability

- SQL Read Replicas
- Geo DNS Routing
- Stateless Gateway Pods

---

# 19. Execution Phases

1. Infrastructure Setup
2. Gateway Core
3. Adaptive Logic & Admin APIs
4. Worker Integration
5. Web Frontend (User + Admin)
6. Monitoring & Backup
7. Security Hardening

---

**Result:** This specification defines a scalable, secure, memory‑aware AI tutoring platform ready for production deployment, team handover, and enterprise audit.
