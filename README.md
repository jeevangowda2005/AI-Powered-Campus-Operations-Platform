# AI-Powered Campus Operations Platform

An enterprise-grade full-stack platform for campus facility management, automated request routing, and AI-assisted operations.

---

## Technical Architecture & Stack

### Frontend
- **Framework**: React.js (v18)
- **Build Tool**: Vite
- **State & Auth**: React Context API (`AuthContext`)
- **Routing**: React Router (v6) with `ProtectedRoute` guards
- **HTTP Client**: Axios (with Request JWT interceptors & 401 response handling)
- **Icons**: Lucide React

### Backend & Queue Infrastructure
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **AI Intelligence**: Official `@google/genai` SDK (Google Gemini API: `gemini-2.5-flash`)
- **Background Queue**: BullMQ (v6) on Redis (v6+)
- **Redis Client**: ioredis (v6)
- **Authentication**: JSON Web Tokens (`jsonwebtoken`)
- **Security**: Password hashing via `bcryptjs` (10 salt rounds)
- **Database ORM**: Prisma ORM (v5)
- **Database**: PostgreSQL (v14+)
- **Utilities**: dotenv, CORS

---

## Sprint 5: Asynchronous Background AI Architecture & Workflow

```text
Student → Express API (POST /api/requests)
                ↓
    Create Request in PostgreSQL (aiProcessingStatus = PENDING)
                ↓
    Enqueue BullMQ Job (ai-processing, jobId = ai-<requestId>)
                ↓
    Return Immediate API Response (HTTP 201, < 2000ms)
                ↓
     BullMQ AI Worker Process (npm run worker)
                ↓
    Fetch Request from PostgreSQL & set aiProcessingStatus = PROCESSING
                ↓
     Gemini AI Analysis & Similarity Detection
                ↓
    Save Advisory Results & set aiProcessingStatus = COMPLETED / FAILED
```

> [!IMPORTANT]
> **Sprint 5 Background Processing Guarantees**:
> 1. **Immediate API Response**: `POST /api/requests` does NOT block or wait for Gemini AI analysis.
> 2. **AI Advisory Safety**: `category` and `priority` are user choices. Background AI only populates `aiCategory`, `aiPriority`, `aiPriorityReason`, `aiProcessedAt`, and `RequestSimilarity`. AI NEVER modifies final request fields or ticket lifecycle status (`OPEN` → `ASSIGNED` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`).
> 3. **Redis Failure Fallback**: If Redis is offline, requests are still stored safely in PostgreSQL, HTTP 201 is returned with `aiJobQueued: false`, and the API does not crash.
> 4. **Retries & Failure Handling**: Up to 3 job attempts with exponential backoff (`AI_JOB_BACKOFF_MS = 5000`). `aiProcessingStatus` becomes `FAILED` only after all retries exhaust.

---

## Environment Configuration

### Backend (`server/.env`)
```env
PORT=5001
NODE_ENV=development
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/campus_ops"
CLIENT_URL="http://localhost:5173"
JWT_SECRET="super-secret-jwt-key-campus-ops-2026"
JWT_EXPIRES_IN="7d"

# AI Intelligence Layer Configuration
AI_API_KEY="your-gemini-api-key"
AI_MODEL="gemini-2.5-flash"
SIMILARITY_THRESHOLD=0.80

# Redis & BullMQ Configuration (Sprint 5)
REDIS_URL="redis://localhost:6379"
AI_QUEUE_NAME="ai-processing"
AI_JOB_ATTEMPTS=3
AI_JOB_BACKOFF_MS=5000
```

---

## AI Endpoints & Statuses

### AI Processing Status (`aiProcessingStatus`)
- `PENDING`: Request created, background AI job enqueued.
- `PROCESSING`: Worker is currently analyzing request with Gemini AI.
- `COMPLETED`: AI classification, priority analysis, and similarity completed.
- `FAILED`: All 3 worker retries exhausted (AI key missing or service error).

### Endpoints

| Endpoint | Method | Role Allowed | Description |
| :--- | :--- | :--- | :--- |
| `/api/requests` | `POST` | `STUDENT` | Create request & enqueue background AI job |
| `/api/ai/classify/:requestId` | `POST` | `STUDENT`, `STAFF`, `ADMIN` | Manual/on-demand AI category classification |
| `/api/ai/suggest-priority/:requestId` | `POST` | `STUDENT`, `STAFF`, `ADMIN` | Manual/on-demand AI priority suggestion |
| `/api/ai/similar/:requestId` | `GET` | `STUDENT`, `STAFF`, `ADMIN` | Retrieve duplicate/similar requests (threshold ≥ 80%) |
| `/api/ai/resolution/:requestId` | `POST` | `STAFF`, `ADMIN` ONLY | Generate step-by-step resolution guidance |
| `/api/health` | `GET` | Public | System health check (includes DB & Redis status) |

---

## Sprint 6: Real-Time Socket.IO System

- **Authentication**: Socket handshakes authenticate via JWT in `socket.handshake.auth.token`. Missing or invalid tokens reject connections.
- **Server Room Scoping**: Sockets join server-enforced rooms: `user:{userId}`, `role:{role}`, `department:{departmentId}`.
- **Worker Bridge**: The background AI worker publishes state transitions to Redis Pub/Sub (`socket-events`), which Express relays to authorized rooms.
- **Event-Driven UI**: Frontend polling (`setInterval`) is eliminated. Dashboards listen to `request.created`, `request.status.updated`, `request.assigned`, and `request.ai.updated`.

---

## Sprint 7: Role-Based Dashboards & Analytics

- **Analytics Endpoints**:
  - `GET /api/analytics/student`: Student's personal request statistics, priority breakdown, and recent history. Derived strictly from JWT identity (`req.user.id`).
  - `GET /api/analytics/staff`: Staff department operational metrics (total, open, assigned, in progress, resolved, high/critical priority), priority/category breakdowns, active queue, and recent activity. Department is derived strictly from DB user record (`prisma.user.findUnique`). Frontend query parameters or body inputs are completely ignored.
  - `GET /api/analytics/admin`: System-wide analytics including summary metrics, status distribution, category distribution, department workload, AI processing summary, time-series request trend, and validated pagination (`page >= 1`, `limit <= 100`).
- **Filters**: Admin analytics supports `dateRange` (`today`, `last7days`, `last30days`, `thismonth`, `custom`), `departmentId`, `category`, `status`, and `priority`.
- **Charts**: Admin and Staff dashboards render responsive SVG visualizations (Pie/Donut, Bar, Line charts) powered by `Recharts`.
- **Scoped Event Refetches**: Socket.IO event listeners check event metadata (`studentId`, `departmentId`, `assignedStaffId`) so components only refetch analytics when the event directly impacts that user or department.

---

## Installation & Running

1. **Install Dependencies**:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. **Run Prisma Migration**:
   ```bash
   cd server
   npm run prisma:migrate
   ```

3. **Start Redis Server**:
   ```bash
   redis-server
   ```

4. **Start Express API Backend**:
   ```bash
   cd server
   npm run dev
   ```

5. **Start AI Worker Process (Separate Terminal)**:
   ```bash
   cd server
   npm run worker
   ```

6. **Start Frontend Client**:
   ```bash
   cd client
   npm run dev
   ```

7. **Run End-to-End Test Suites**:
   ```bash
   # Sprint 7 Dashboards & Analytics Audit Test
   node test-sprint7.js

   # Sprint 6 Real-Time Socket.IO Audit Test
   node test-sprint6.js

   # Sprint 5 Redis + BullMQ Audit Test
   node test-sprint5.js

   # Sprint 1-4 Core Regression Audit Test
   node server/test-e2e.js

   # Frontend Production Build
   cd client && npm run build
   ```

