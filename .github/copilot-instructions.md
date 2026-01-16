# Absenta13 - AI Coding Agent Instructions

## Project Overview
Absenta13 is a **school attendance management system** (Sistem Absensi Digital) built with React/TypeScript frontend, Node.js/Express backend, MySQL database, and Redis caching. Supports multi-role access: **Admin**, **Guru** (Teacher), **Siswa** (Student).

## Architecture

```
Frontend (React+Vite:5173) ←→ Backend (Express:3001) ←→ MySQL:3306
                                     ↓
                               Redis:6379 (caching)
```

- **Frontend**: `src/` - React 18, TypeScript, TailwindCSS, shadcn/ui components
- **Backend**: `server/` - Express routes/controllers/services/middleware
- **Entry point**: `server_modern.js` - loads all routes, initializes systems (cache, queue, security)

## Critical Conventions

### Backend Structure
- **Routes** → **Controllers** → **Services** pattern
- Routes: `server/routes/{entity}Routes.js` - thin, delegates to controllers
- Controllers: `server/controllers/{entity}Controller.js` - handles HTTP, validation
- Services: `server/services/` - business logic, database operations

### Error Handling
Use standardized error utilities from [server/utils/errorHandler.js](server/utils/errorHandler.js):
```javascript
import { sendErrorResponse, sendSuccessResponse, AppError, ERROR_CODES } from '../utils/errorHandler.js';

// In controller
sendSuccessResponse(res, data, 'Data berhasil diambil');
sendErrorResponse(res, error, ERROR_CODES.DB_NOT_FOUND);
```

### Logging
Use structured logger from [server/utils/logger.js](server/utils/logger.js):
```javascript
import { createLogger } from '../utils/logger.js';
const logger = createLogger('ModuleName');
logger.info('Operation started', { context });
logger.error('Failed', error, { details });
```

### Time/Timezone
All times use WIB (Asia/Jakarta, UTC+7). Use utilities from [server/utils/timeUtils.js](server/utils/timeUtils.js):
```javascript
import { getWIBTime, formatWIBTime, getHariFromDate, HARI_INDONESIA } from '../utils/timeUtils.js';
```

### Authentication
- JWT-based auth with `authenticateToken` middleware from [server/middleware/auth.js](server/middleware/auth.js)
- Role check: `requireRole(['admin', 'guru'])` middleware
- Token from `Authorization: Bearer <token>` header or `token` cookie

### Frontend Components
- UI components use **shadcn/ui** in `src/components/ui/`
- Use `cn()` from [src/lib/utils.ts](src/lib/utils.ts) for className merging
- API calls via config from [src/config/api.ts](src/config/api.ts): `getApiUrl('/api/endpoint')`

## Attendance Logic (Domain-Specific)
See [docs/ATTENDANCE_LOGIC_README.md](docs/ATTENDANCE_LOGIC_README.md) for full details.

**Key rules:**
- **Hadir statuses**: `'Hadir'`, `'Dispen'`, `'Terlambat'` - count as present
- **Tidak Hadir (Student)**: `'Sakit'`, `'Izin'`, `'Alpa'` - count as absent
- **Dispen ≠ absent** - it's school-approved absence, doesn't hurt attendance rate

## Developer Commands

```bash
# Development
npm run dev:full          # Start both frontend + backend concurrently
npm run dev               # Frontend only (Vite)
npm run start:modern      # Backend only

# Testing
npm test                  # Run all tests (Vitest + Node test runner)
npm run test:server       # Backend tests only

# Production
npm run build             # Build frontend
npm run deploy:setup      # Install prod deps + build
npm run start:pm2:prod    # Start with PM2
```

## Database
- MySQL 8.0 with connection pooling
- Schema in `database/absenta13.sql`
- Migrations: `migrations/` and `database/migrations/`
- Use parameterized queries (SQL injection protection built-in)

## Caching Strategy
Redis caching via [server/services/system/cache-system.js](server/services/system/cache-system.js):
- `analytics:` - 1 hour TTL
- `schedules:` - 2 hours TTL  
- `students:`, `classes:`, `teachers:` - 4 hours TTL
- `attendance:` - 30 minutes TTL

## Environment Variables
Required in `.env`:
```env
DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
JWT_SECRET          # REQUIRED in production (min 32 chars)
REDIS_HOST, REDIS_PORT
PORT=3001
```

## Test Files
- Backend: `server/__tests__/*.test.js` - use Node.js test runner
- Frontend: `src/**/__tests__/` - use Vitest with jsdom
- Pattern: describe/it blocks with assert (backend) or expect (frontend)

## File Naming
- Backend JS: `camelCase.js` (e.g., `authController.js`, `timeUtils.js`)
- Frontend TSX: `PascalCase.tsx` for components, `camelCase.ts` for utilities
- Routes: `{entity}Routes.js` matching controller naming
