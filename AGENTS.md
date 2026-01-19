# AGENTS.md — Absenta 13 v3 Developer Guide

## 1. Project Context
**Absenta 13 v3** is a school attendance web application.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI.
- **Backend:** Node.js 18+, Express, ESM (ECMAScript Modules).
- **Database:** MySQL 8+ (via `mysql2` with pool).
- **Infrastructure:** Redis (Queue/Cache), PM2 (Process Manager).

## 2. Development Commands
Use `npm run <command>` in the root directory:

| Task | Command | Description |
|------|---------|-------------|
| **Start Dev** | `npm run dev:full` | Starts both Backend (3001) and Frontend (5173). |
| **Backend Only** | `npm run start:modern` | Starts the Node.js server. |
| **Frontend Only** | `npm run dev` | Starts the Vite dev server. |
| **Build** | `npm run build` | Builds the frontend for production. |
| **Lint** | `npm run lint` | Runs ESLint for code quality. |
| **Setup DB** | `npm run setup-db` | Runs database migrations/seeds. |

## 3. Testing Strategy
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

## 4. Code Style & Standards

### 4.1 Frontend (React + TypeScript)
- **Imports:** ALWAYS use absolute paths alias `@/` defined in `tsconfig.json`.
  - ✅ `import { Button } from "@/components/ui/button"`
  - ❌ `import { Button } from "../../components/ui/button"`
- **Components:** Functional components with typed props. Use PascalCase for filenames.
- **UI & Styling:**
  - Use **Tailwind CSS** utility classes. Avoid inline styles or CSS files.
  - Prefer **Shadcn UI** components located in `@/components/ui/`.
  - Icons: Use `lucide-react`.
- **Data Fetching:**
  - Use the `apiCall` utility from `@/utils/apiClient` for all backend requests.
  - **Error Handling:** Catch errors and display user-friendly messages using `toast` (from `@/hooks/use-toast`). Do NOT use `alert()`.

### 4.2 Backend (Node.js + Express)
- **Module System:** **ESM** is mandatory (`import`/`export`). Do NOT use `require()`.
- **Documentation:** **JSDoc** is mandatory for all Controllers and Service functions.
- **Database Access:**
  - Use the global pool: `globalThis.dbPool`.
  - **Security:** ALWAYS use parameterized queries (`?`) to prevent SQL Injection.
  - ✅ `await globalThis.dbPool.execute('SELECT * FROM users WHERE id = ?', [id])`
- **Error Handling:**
  - Import helpers from `../utils/errorHandler.js`.
  - Use: `sendSuccessResponse`, `sendValidationError`, `sendDatabaseError`, `sendNotFoundError`.
  - Wrap async route handlers to catch errors (or use try/catch blocks that delegate to these helpers).
- **Logging:** Use `createLogger` from `../utils/logger.js` instead of raw `console.log`.

## 5. Agent Protocol & Rules

### 5.1 Precision Protocol (CRITICAL)
1.  **UI Freeze:** **DO NOT** modify UI components (`src/components/ui/*`) or layout structures unless explicitly requested.
2.  **Granular Debugging:** If an Error 500 occurs, you MUST analyze the specific error code/stack trace before applying a fix.
3.  **Global Var Check:** In backend code, acknowledge that `dbPool`, `redisClient`, etc., might be attached to `globalThis`.

### 5.2 Guardrails
- **Secrets:** NEVER hardcode secrets, API keys, or passwords. Use `process.env`.
- **Destructive Actions:** NEVER run `rm -rf`, `DROP TABLE`, or destructive migrations without explicit user confirmation.
- **Production Safety:** If you detect you are running against a production DB, STOP and confirm.

### 5.3 Working Mode
- **Plan Mode:** Analyze files, grep patterns, and propose a plan. Do not edit.
- **Act Mode:** Execute the approved plan. Run tests after significant changes.

## 6. Directory Structure
- `src/` - Frontend source.
  - `components/ui/` - Reusable UI components (buttons, inputs).
  - `pages/` - Route pages.
  - `utils/` - Frontend helpers (`apiClient.ts`).
- `server/` - Backend source.
  - `controllers/` - Request logic.
  - `routes/` - API definitions.
  - `utils/` - Backend helpers (`errorHandler.js`, `logger.js`).
