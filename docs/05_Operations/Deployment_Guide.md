# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG (DEPLOYMENT GUIDE)

## 1. Yêu Cầu Hạ Tầng (Infrastructure Prerequisites)
- Node.js >= 18.x
- Python >= 3.10
- Môi trường Container: Docker & Docker Compose cho phát triển cục bộ. Kubernetes (K8s) cho Production.

## 2. Triển Khai Môi Trường Phát Triển (Local Development)

**Bước 1: Thiết Lập Biến Môi Trường**
Copy file `.env.example` thành `.env` tại thư mục gốc và điền các API Key cần thiết (OpenAI, Gemini, v.v.).
```bash
cp .env.example .env
```

**Bước 2: Khởi động Dịch Vụ Cơ Sở (Databases & Brokers)**
Khởi động cơ sở dữ liệu PostgreSQL, MongoDB, Redis, RabbitMQ và Qdrant thông qua Docker Compose.
```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Bước 3: Cài Đặt Dependencies**
Dự án sử dụng NPM Workspace. Để tránh lỗi xung đột (ví dụ React 19 / Next 15), sử dụng cờ sau:
```bash
npm install --legacy-peer-deps
```

**Bước 4: Chạy Các Services Lõi (Sử dụng 3 terminal khác nhau)**
- **Terminal 1 - Gateway (NestJS):**
  ```bash
  npm run start:dev --prefix apps/gateway-server
  ```
- **Terminal 2 - AI Worker (Python):**
  ```bash
  cd apps/ai-worker
  python -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  python main.py
  ```
- **Terminal 3 - Frontend Web User (Next.js):**
  ```bash
  npm run dev --prefix apps/web-user
  ```
  *(Để chạy trang Quản trị, đổi prefix thành `apps/web-admin`)*

## 3. Hướng Dẫn Triển Khai Production (Kubernetes)

**1. Bảo mật Secrets (Bắt Buộc)**
KHÔNG được mount file `.env` thô hoặc đưa vào bên trong Docker Image. Khởi tạo K8s Secrets thông qua lệnh:
```bash
kubectl create secret generic zenc-secrets-prod --from-env-file=.env -n zenc-production
```
Trong file Deployment (`deployment.yaml`), sử dụng `envFrom`:
```yaml
envFrom:
  - secretRef:
      name: zenc-secrets-prod
```

**2. Cấu Hình Nginx Ingress**
Để tránh việc chặn lưu lượng WebSocket, đảm bảo bạn thiết lập đủ giới hạn (nhất là đối với người dùng chung IP/NAT):
```yaml
nginx.ingress.kubernetes.io/limit-connections: "200"
nginx.ingress.kubernetes.io/affinity: "cookie"
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
```

**3. Postgres PgBouncer**
Giữ giới hạn kết nối thấp để tránh Zombie Connections:
- `DB_POOL_MAX: "5"`
- Vô hiệu hóa Prepared Statements trong chế độ Transaction.
- Thêm `statement_timeout: 10000` và `query_timeout: 10000`.

**4. Liveness Probes / Health Checks**
- Mọi pod bắt buộc phải chạy "/health" endpoint.
- Deep health check phải làm ít nhất 1 thao tác như query `SELECT 1` (Postgres) hoặc Ping Redis. Nếu timeout, K8s sẽ tự restart pod để loại bỏ Zombie Pod.
