
## T1 Decisions — 2026-02-19

### D1: Explicit qwen-code-repo exclusion in vitest
- **Decision**: Added `"qwen-code-repo/**"` to `vite.config.ts` test.exclude
- **Rationale**: Even though `configDefaults.exclude` may handle it in current vitest version, explicit exclusion is safer and documents intent. This is harness stabilization, not app behavior change.
- **Risk**: None — qwen-code-repo is an unrelated repo that should never be tested by absenta's vitest.

### D2: Keep baseline evidence as-is (with failures)
- **Decision**: Captured real baseline outputs including failures (test:server EXIT 1, lint EXIT 1)
- **Rationale**: Plan explicitly says "Do NOT hide failing baseline commands; capture real outputs even if failures appear". These are genuine issues for later tasks to fix.

## T2 Execution — 2026-02-19 14:00 UTC

**Task**: Remove unused backend imports in targeted controllers

**Changes Made**:
1. **guruReportsController.js line 6**: Removed unused `sendNotFoundError` import
   - Was imported but never called
   - Kept `sendDatabaseError` and `sendValidationError` (both actively used)

2. **pdfExportController.js line 10**: Removed unused `sendDatabaseError` import  
   - Was imported but never called
   - Kept `sendValidationError` (actively used)

3. **importMasterScheduleController.js**: No changes
   - Plan indicated removing `sendNotFoundError`, but file only imports `sendDatabaseError, sendValidationError`
   - Neither is unused (both are called), so no removals made

**Verification**:
- ✓ Syntax: All files pass `node --check`
- ✓ Regression: `npm run test:server` — 185 tests pass, 0 failures
- ✓ Scope: Git diff confirms only import lines removed, no logic changes
- ✓ Commit: `f94cba75 chore(sonar-backend): remove unused controller imports`

**Evidence**:
- `.sisyphus/evidence/task-2-node-check.txt`
- `.sisyphus/evidence/task-2-diff-scope.txt`
- `.sisyphus/evidence/task-2-regression-summary.txt`

**Status**: COMPLETE ✓

## T6 Decisions — 2026-02-19

### D3: Keep T6 scope strictly non-complex
- **Decision**: Updated only listed non-complex findings in `server/controllers/jadwalController.js`.
- **Applied**: catch naming (`error_`), negated condition readability, and unused declaration removals.
- **Rationale**: Preserve separation from T8-T11 cognitive-complexity refactors and reduce regression risk.

## T4 Execution — 2026-02-19 15:30 UTC

**Task**: Normalize async/await and re-export conventions in middleware + runtime entrypoints

**Changes Made**:

1. **server/middleware/globalErrorMiddleware.js**:
   - **Line 15-17 (import section)**: Converted from re-export shorthand `export { asyncHandler, asyncMiddleware } from '../utils/asyncHandler.js'` to explicit import + named export
   - **Before**:
     ```javascript
     import { ERROR_CODES, AppError, generateRequestId } from '../utils/errorHandler.js';
     import { createLogger } from '../utils/logger.js';
     export { asyncHandler, asyncMiddleware } from '../utils/asyncHandler.js';
     ```
   - **After**:
     ```javascript
     import { ERROR_CODES, AppError, generateRequestId } from '../utils/errorHandler.js';
     import { createLogger } from '../utils/logger.js';
     import { asyncHandler, asyncMiddleware } from '../utils/asyncHandler.js';

     export { asyncHandler, asyncMiddleware };
     ```
   - **Line 219-229 (default export)**: Removed duplicate `asyncHandler, asyncMiddleware` entries from default export object (they are now only in named export)
   - **Rationale**: Makes re-export pattern explicit and testable; prevents duplication; aligns with modern ESM conventions

2. **server/migrations/run_migrations.js**:
   - **Status**: Already compliant with top-level await pattern
   - **Line 55**: Uses `await runMigrations()` — no changes needed
   - **Rationale**: File already follows modern async/await convention

3. **server_modern.js**:
   - **Line 51 (mkdir promise chain)**: Already refactored in previous session to `await mkdir()` inside try-catch
   - **Line 482+ (process event handlers)**: Correctly uses fire-and-forget pattern for async cleanup (callbacks cannot use `await`)
   - **Rationale**: Process event handlers are callback-based; cannot use `await` directly; current pattern is correct

**Verification**:
- ✓ Syntax: All modified files pass `node --check`
- ✓ Re-export compatibility: Named exports (asyncHandler, asyncMiddleware) import and execute correctly
- ✓ Regression: `npm run test:server` — 185 tests pass, 0 failures
- ✓ Startup: Migration/await startup sequence verified

**Evidence Files Created**:
- `.sisyphus/evidence/task-4-reexport-compat.txt` — Re-export import compatibility test
- `.sisyphus/evidence/task-4-migration-await.txt` — Migration/startup verification

**Status**: COMPLETE ✓
