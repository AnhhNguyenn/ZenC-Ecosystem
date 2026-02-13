# ZenC Ecosystem – Development Guide & Standard Processes

> **Status:** Active
> **Last Updated:** 2026-02-13

This document outlines the **Standard Operating Procedures (SOP)** for developing, testing, and deploying the ZenC Ecosystem.

---

## 1. Project Structure (Monorepo)

The project is organized as a monorepo containing all services and applications.

```
ZenC-Ecosystem/
├── apps/
│   ├── gateway-server/   # Backend API (NestJS) - Port 3000
│   ├── ai-worker/        # AI Processing (Python/FastAPI) - Port 8000
│   ├── web-user/         # User Frontend (Next.js 14) - Port 3001
│   └── web-admin/        # Admin Dashboard (Next.js 14) - Port 3002
├── docker-compose.yml    # Orchestration
└── README.md             # Entry point
```

---

## 2. Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker & Docker Compose
- PostgreSQL & Redis (provided via Docker)

### Quick Start (Dev Mode)

1.  **Start Infrastructure** (DB, Redis, Vector DB):

    ```bash
    docker-compose up -d postgres redis qdrant
    ```

2.  **Start Backend (Gateway)**:

    ```bash
    cd apps/gateway-server
    npm install
    npm run start:dev
    ```

3.  **Start Frontends**:
    - **User App**:
      ```bash
      cd apps/web-user
      npm install
      npm run dev
      ```
    - **Admin App**:
      ```bash
      cd apps/web-admin
      npm install
      npm run dev
      ```

---

## 3. Frontend Standards (Web)

We use **Next.js 14 (App Router)** with **TypeScript** and **SCSS Modules**.

### 3.1 Styling Convention (SCSS)

- **No Tailwind**: Use pure SCSS modules.
- **File Naming**: `Component.module.scss`.
- **Variables**: Import from `@/styles/variables.scss`.
- **Structure**:

  ```scss
  .container {
    // Layout properties
    display: flex;
    padding: var(--spacing-4);

    // Visual properties
    background-color: var(--bg-surface);
    border-radius: var(--radius-md);
  }
  ```

### 3.2 State Management

- **Global Client State**: Use `zustand`.
- **Server State**: Use `@tanstack/react-query` for API data.
- **Forms**: Use `react-hook-form` + `zod` for validation.

### 3.3 Component Architecture

- **`components/ui`**: Atomic, reusable components (Button, Input, Card). Dumb components mostly.
- **`components/layout`**: Structural components (Sidebar, Header).
- **`features/`**: Domain-specific logic and complex UI (e.g., `features/voice`, `features/auth`).

---

## 4. Backend Standards (NestJS)

We use **NestJS** with **TypeORM**.

### 4.1 Architecture

- **Modules**: Group related features (e.g., `AuthModule`, `UserModule`).
- **Controllers**: Handle HTTP/WebSocket requests. **Thin controllers**.
- **Services**: Business logic. **Fat services**.
- **DTOs**: Data Transfer Objects for ALL inputs. Use `class-validator`.

### 4.2 Security

- **Guards**: Use `JwtAuthGuard` or `RolesGuard` or `ApiKeyGuard`.
- **Interceptors**: Use `UserInterceptor` to attach user context.

---

## 5. Deployment Process

We use **Docker** for consistent deployment.

### 5.1 Build & Run

To run the entire stack in production mode:

```bash
docker-compose up --build -d
```

### 5.2 Environment Variables

Ensure `.env` file is present in root and passed to containers.

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `GEMINI_API_KEY`

### 5.3 Scaling

Services are stateless (except DB/Redis).

```bash
docker-compose up -d --scale gateway-server=3
```

---

## 6. Git Workflow

1.  **Branching**: `feature/feature-name`, `fix/bug-name`.
2.  **Commits**: Conventional Commits (e.g., `feat: add voice visualizer`, `fix: resolve socket latency`).
3.  **PR Reviews**: Mandatory for merging into `main`.

---

**End of Guide**
