# AGENTS.md — Absenta 13 v3 Developer Guide

## 1. Project Context
**Absenta 13 v3** is a school attendance web application.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI.
- **Backend:** Node.js 18+, Express, ESM (ECMAScript Modules).
- **Database:** MySQL 8+ (via `mysql2` with pool).
- **Infrastructure:** Docker, Redis (Queue/Cache), Nginx (Reverse Proxy).

## 2. Docker Commands (Production)
This project is **Docker-only**. Use these commands:

| Task | Command | Description |
|------|---------|-------------|
| **Build** | `docker-compose build` | Build all containers |
| **Start** | `docker-compose up -d` | Start all services |
| **Stop** | `docker-compose down` | Stop all services |
| **Restart App** | `docker-compose restart app` | Restart Node.js backend |
| **View Logs** | `docker-compose logs -f app` | View backend logs |
| **Rebuild** | `docker-compose up -d --build` | Rebuild and start |

### Container Architecture
```
absenta13-nginx   (port 28080) --> Frontend + Proxy
absenta13-app     (port 28081) --> Node.js Backend
absenta13-mysql   (internal)   --> MySQL Database
absenta13-redis   (internal)   --> Redis Cache
```

## 3. Development Commands (Local)
For local development without Docker:

| Task | Command | Description |
|------|---------|-------------|
| **Start Dev** | `npm run dev:full` | Starts Backend (3001) + Frontend (5173) |
| **Backend Only** | `npm run start:modern` | Starts the Node.js server |
| **Frontend Only** | `npm run dev` | Starts the Vite dev server |
| **Build** | `npm run build` | Builds the frontend |
| **Lint** | `npm run lint` | Runs ESLint |
| **Test CORS** | `npm run test:cors` | Test CORS configuration |

## 4. Testing Strategy
**Frameworks:** `vitest` (Frontend) and Node.js native test runner (Backend).

### Running Tests
- **Run All Tests:**
  ```bash
  npm test
  ```

- **Run Single Frontend Test (Unit/Component):**
  ```bash
  npx vitest run src/path/to/test-file.test.tsx
  ```

- **Run Single Backend Test (Integration/Unit):**
  ```bash
  node --test server/path/to/test-file.test.js
  ```

## 5. Code Style & Standards

### 5.1 Frontend (React + TypeScript)
- **Imports:** ALWAYS use absolute paths alias `@/` defined in `tsconfig.json`.
  - `import { Button } from "@/components/ui/button"`
  - `import { Button } from "../../components/ui/button"`
- **Components:** Functional components with typed props. Use PascalCase for filenames.
- **UI & Styling:**
  - Use **Tailwind CSS** utility classes. Avoid inline styles or CSS files.
  - Prefer **Shadcn UI** components located in `@/components/ui/`.
  - Icons: Use `lucide-react`.
- **Data Fetching:**
  - Use the `apiCall` utility from `@/utils/apiClient` for all backend requests.
  - **Error Handling:** Catch errors and display user-friendly messages using `toast` (from `@/hooks/use-toast`). Do NOT use `alert()`.

### 5.2 Backend (Node.js + Express)
- **Module System:** **ESM** is mandatory (`import`/`export`). Do NOT use `require()`.
- **Documentation:** **JSDoc** is mandatory for all Controllers and Service functions.
- **Database Access:**
  - Use the global pool: `globalThis.dbPool`.
  - **Security:** ALWAYS use parameterized queries (`?`) to prevent SQL Injection.
  - `await globalThis.dbPool.execute('SELECT * FROM users WHERE id = ?', [id])`
- **Error Handling:**
  - Import helpers from `../utils/errorHandler.js`.
  - Use: `sendSuccessResponse`, `sendValidationError`, `sendDatabaseError`, `sendNotFoundError`.
  - Wrap async route handlers to catch errors (or use try/catch blocks that delegate to these helpers).
- **Logging:** Use `createLogger` from `../utils/logger.js` instead of raw `console.log`.

## 6. Agent Protocol & Rules

### 6.1 Precision Protocol (CRITICAL)
1.  **UI Freeze:** **DO NOT** modify UI components (`src/components/ui/*`) or layout structures unless explicitly requested.
2.  **Granular Debugging:** If an Error 500 occurs, you MUST analyze the specific error code/stack trace before applying a fix.
3.  **Global Var Check:** In backend code, acknowledge that `dbPool`, `redisClient`, etc., might be attached to `globalThis`.

### 6.2 Guardrails
- **Secrets:** NEVER hardcode secrets, API keys, or passwords. Use `process.env`.
- **Destructive Actions:** NEVER run `rm -rf`, `DROP TABLE`, or destructive migrations without explicit user confirmation.
- **Production Safety:** If you detect you are running against a production DB, STOP and confirm.

### 6.3 Working Mode
- **Plan Mode:** Analyze files, grep patterns, and propose a plan. Do not edit.
- **Act Mode:** Execute the approved plan. Run tests after significant changes.

## 7. Directory Structure & Documentation
- `src/` - Frontend source (components, pages, contexts, hooks).
- `server/` - Backend source (routes, controllers, services, middleware, utils, config).
- `server/services/export/` - Excel/PDF export builders and schemas.
- `database/` - SQL schema, migrations, seeds, reference data.
- `docs/` - Documentation.

## 8. Troubleshooting Guides

### 8.1 CORS Errors
Jika muncul error CORS seperti:
```
Access to fetch at 'https://api.absenta13.my.id/api/...' from origin 
'https://absenta13.my.id' has been blocked by CORS policy
```

**Quick Fix:**
1. Pastikan origin ada di `ALLOWED_ORIGINS` di `docker-compose.yml`
2. Restart container: `docker-compose restart app`
3. Test dengan: `bash scripts/test-cors.sh production`

**Full Guide:** Lihat `docs/CORS-TROUBLESHOOTING.md`

**Debug Endpoint:** `GET /api/debug/cors` - menampilkan info CORS saat ini.

### 8.2 Common Production Issues

| Error | Kemungkinan Penyebab | Quick Fix |
|-------|---------------------|-----------|
| CORS Error | Origin tidak di whitelist | Update `ALLOWED_ORIGINS` di `docker-compose.yml` |
| 502 Bad Gateway | Node.js crash | `docker-compose restart app` |
| 504 Gateway Timeout | Query terlalu lama | `docker-compose logs app` untuk cek |
| Container not starting | Error startup | `docker-compose logs app --tail 100` |

### 8.3 Useful Docker Commands

```bash
# View all container status
docker-compose ps

# View app logs (live)
docker-compose logs -f app

# Restart specific container
docker-compose restart app

# Rebuild and restart
docker-compose up -d --build app

# Enter container shell
docker exec -it absenta13-app sh

# View MySQL logs
docker-compose logs mysql

# Full restart (all services)
docker-compose down && docker-compose up -d
```
