# Plan: Project Structure Cleanup — Absenta 13 v3

## Context
Absenta 13 v3 (React 18 + TypeScript + Vite + Express + MySQL + Docker) memiliki struktur folder yang berantakan setelah evolusi development panjang. Root directory memiliki 96 entries (seharusnya ~20), backend code tersebar di 3 lokasi, migrations di 3 lokasi, dan frontend belum terorganisir dengan baik.

## Approach
**Wave-by-wave** — 6 wave berurutan, setiap wave di-test independen sebelum lanjut ke wave berikutnya. Tidak ada perubahan logika kode — hanya pemindahan/penghapusan file dan update import paths.

## Critical Risks (from Metis Analysis)
1. **`__dirname` path resolution** — File di `backend/export/` menggunakan `__dirname` + `../..` untuk resolve ke project root. Pindah lokasi = path salah = PDF/Excel rusak tanpa error.
2. **Atomic startup chain** — 5 file mereferensi `server_modern.js`. Semua HARUS update di wave yang sama.
3. **Dynamic import** — `reportsController.js:810` menggunakan `await import()` yang tidak terdeteksi static analysis.
4. **Migration duplicates** — 2 pasang file migration kemungkinan duplikat, harus di-diff sebelum hapus.

## Global QA (Run After EVERY Wave)
```bash
# 1. Frontend build
npm run build
# Assert: exit code 0

# 2. TypeScript type-check
npx tsc --noEmit
# Assert: exit code 0

# 3. All tests pass
npm test
# Assert: exit code 0

# 4. ESLint
npm run lint
# Assert: exit code 0
```

---

## Wave 1: Root Directory Cleanup + Entry Point Move
**Goal**: Bersihkan 40+ file sampah dari root, pindahkan entry point ke `server/index.js`, hapus direktori yang tidak dipakai.
**Risk**: 🔴 HIGH — Entry point move mempengaruhi startup chain.
**Files touched**: ~50 files delete/move, 5 files edit.

### Task 1.1: Delete Junk Files from Root
**Action**: DELETE semua file berikut dari root directory.

**Log files (21 files):**
```
backend.log
frontend.log
diagnostic.log
dev_server.log
dev_server_2.log
dev_server_3.log
dev_server_4.log
dev_server_new.log
dev_server_restart.log
dev_server_restart_2.log
dev_server_restart_3.log
dev_server_restart_4.log
dev_server_restart_5.log
dev_server_restart_6.log
dev_server_restart_7.log
dev_server_restart_8.log
lint_output.log
test_output.log
test-output.log
```

**Fix scripts (9 files):**
```
fix_all.js
fix_error.cjs
fix_keys.cjs
fix_render.cjs
fix_schedules.cjs
fix_schedules.js
fix_schedules2.js
fix_schedules3.js
fix_sort.js
```

**Temp/Backup files:**
```
opencode.json.backup-20260206_141933
opencode.json.bak-2026-02-07T10-35-50-844Z
opencode.json.old
backup-settings.json
git_status_output.txt
git_status_utf8.txt
tmp-logo-check.xlsx
tmp-logo-check-wide.xlsx
"# Untitled spreadsheet - Google Spreadsh.txt"
nul
custom-schedules.json
```

**QA**: Verify no git-tracked files were deleted: `git status` should show only deletions of untracked files or files already in `.gitignore`.

### Task 1.2: Move Misplaced Root Files
**Actions**:
1. Move `create_admin.js` → `scripts/create_admin.js`
2. Move `404.html` → `docker/nginx/404.html`
3. Move `502.html` → `docker/nginx/502.html`

**QA**: Verify files exist at new locations. These files are currently not wired into nginx config, so no functional impact.

### Task 1.3: Move Entry Point — server_modern.js → server/index.js
**This is the most critical task in Wave 1. All 5 references MUST update atomically.**

**Step 1**: Copy `server_modern.js` to `server/index.js`

**Step 2**: Inside `server/index.js`, rewrite ALL import paths. Change prefix `./server/` to `./`:
```javascript
// BEFORE (8 imports):
import { setupAppRoutes } from './server/routes/appRoutes.js';
// AFTER:
import { setupAppRoutes } from './routes/appRoutes.js';
```
Use `ast_grep_replace` with pattern `import $VAR from './server/$REST'` → `import $VAR from './$REST'` lang=javascript on file `server/index.js`.

Also check for any `require('./server/...')` patterns (unlikely in ESM but verify).

**Step 3**: Fix relative path for `uploadDir`. Find the line that sets `uploadDir` (likely `'public/uploads'` or similar) and change to:
```javascript
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
```

**Step 4**: Update `package.json` — change 3 scripts:
```json
"start": "node server/index.js",
"start:modern": "node server/index.js",
"start:pm2": "node server/index.js"
```
Also DELETE the broken script: `"setup-db": "node setup-database-modern.js"` (file doesn't exist).

**Step 5**: Update `ecosystem.config.cjs`:
```javascript
script: './server/index.js',
```

**Step 6**: Update `Dockerfile`:
- DELETE the line `COPY server_modern.js ./` (line ~55) — it's redundant because `COPY server ./server` already copies everything.
- Verify CMD still works via PM2 → ecosystem.config.cjs → server/index.js chain.

**Step 7**: Delete the original `server_modern.js` from root.

**QA (Wave 1 specific)**:
```bash
# PM2 config validates
node -e "const c=require('./ecosystem.config.cjs');const s=c.apps[0].script;if(!s.includes('server/index.js')){console.error('FAIL:',s);process.exit(1)};console.log('OK:',s)"

# Docker build succeeds
docker-compose build --no-cache app
```

### Task 1.4: Delete Unused Directories
**Actions**:
1. DELETE `docs-site/` — empty Docusaurus, confirmed unused
2. DELETE `.storybook/` — Storybook config
3. DELETE `archives/` — empty, already gitignored
4. DELETE `.ruff_cache/` — Python linter cache, not a Python project
5. DELETE `backend/migrations/` — empty directory
6. DELETE `debug_logs/` — should use `logs/` instead
7. DELETE `docker/storybook/` — Storybook Docker config, no longer needed
8. DELETE `scripts/__pycache__/` — Python bytecode cache, not a Python project

**When deleting `.storybook/`**, also update `package.json`:
- Remove scripts: `"storybook"` and `"build-storybook"`
- Remove 8 devDependencies: `@storybook/addon-essentials`, `@storybook/addon-interactions`, `@storybook/addon-links`, `@storybook/blocks`, `@storybook/react`, `@storybook/react-vite`, `@storybook/test`, `storybook`
- Run `npm install` after to update lockfile.

**QA**: `npm run build` and `npm test` pass.

---

## Wave 2: Backend Consolidation (3 locations → 1)
**Goal**: Merge `backend/` dan `server/backend/` ke dalam `server/`. Semua backend code di satu tempat.
**Risk**: 🔴 HIGH — `__dirname` paths dan cross-references.
**Files touched**: ~15 files move, ~12 files edit.

### Task 2.1: Fix __dirname Paths IN-PLACE (Before Moving!)
**CRITICAL**: Do this BEFORE moving any files. Convert all `__dirname` relative path to `process.cwd()` based paths.

**File 1: `backend/utils/letterheadService.js` (line ~8)**
```javascript
// BEFORE:
const PUBLIC_ROOT = path.resolve(__dirname, '..', '..', 'public');
// AFTER:
const PUBLIC_ROOT = path.join(process.cwd(), 'public');
```

**File 2: `backend/export/pdfBuilder.js` (line ~20)**
```javascript
// BEFORE:
const FONT_DIR = path.resolve(__dirname, '..', '..', 'node_modules', 'pdfmake', 'fonts', 'Roboto');
// AFTER:
const FONT_DIR = path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto');
```

**File 3: `backend/export/excelBuilder.js` (line ~7-8)**
Same pattern — find any `__dirname` + `..` chain and replace with `process.cwd()` based path.

**File 4: `backend/utils/letterheadManager.js` (line ~10)**
```javascript
// BEFORE:
const configPath = path.join(__dirname, '../config/report-letterhead.json');
// AFTER:
// This file appears to be DEAD CODE (0 imports found). Mark for deletion in Task 2.3.
```

**QA**: After this task (before any moves), run existing tests to confirm nothing broke:
```bash
npm test
```

### Task 2.2: Move backend/export/ → server/services/export/
**Steps**:
1. Move `backend/export/excelBuilder.js` → `server/services/export/excelBuilder.js`
2. Move `backend/export/excelStreamingBuilder.js` → `server/services/export/excelStreamingBuilder.js`
3. Move `backend/export/pdfBuilder.js` → `server/services/export/pdfBuilder.js`
4. Move `backend/export/pdfHelpers.js` → `server/services/export/pdfHelpers.js`
5. Move `backend/export/schemas/` → `server/services/export/schemas/` (all 10 files)

**Internal cross-refs within moved files** (fix after move):
- `pdfBuilder.js` imports `../utils/letterheadService.js` → change to `../../utils/letterheadService.js` (will point to `server/utils/letterheadService.js` after Task 2.4)
- `excelBuilder.js` imports `../utils/letterheadService.js` → same fix

### Task 2.3: Move backend/utils/ → server/utils/ (or server/services/)
**Steps**:
1. Move `backend/utils/letterheadService.js` → `server/utils/letterheadService.js`
2. DELETE `backend/utils/letterheadManager.js` — confirmed dead code (0 imports in entire codebase). Verify once more with `grep -r "letterheadManager" .` before deleting.
3. Move `backend/config/report-letterhead.json` → `server/config/report-letterhead.json`

**Fix letterheadService.js internal import** (if any reference to `../config/`):
```javascript
// After move, the config path should use process.cwd():
const configPath = path.join(process.cwd(), 'server', 'config', 'report-letterhead.json');
// OR relative from new location:
const configPath = path.join(__dirname, '..', 'config', 'report-letterhead.json');
```

### Task 2.4: Move backend/scripts/ → server/scripts/
**Steps**:
1. Move `backend/scripts/auditTimezoneData.js` → `server/scripts/auditTimezoneData.js`
2. Move `backend/scripts/initLetterhead.js` → `server/scripts/initLetterhead.js`

Fix any internal imports if they reference `../../server/` or `../../backend/`.

### Task 2.5: Update All Cross-References in server/
**These 8 imports in server/ files reference `../../backend/` and must be updated.**

Use `ast_grep_search` pattern `import $VAR from '../../backend/$REST'` (lang=javascript, paths=["server/"]) to find all references, then update each:

| File | Old Import | New Import |
|------|-----------|------------|
| `server/utils/exportHelpers.js:6` | `../../backend/utils/letterheadService.js` | `./letterheadService.js` |
| `server/utils/exportHelpers.js:7` | `../../backend/export/excelBuilder.js` | `../services/export/excelBuilder.js` |
| `server/controllers/exportController.js:38` | `../../backend/utils/letterheadService.js` | `../utils/letterheadService.js` |
| `server/controllers/letterheadController.js:10` | `../../backend/utils/letterheadService.js` | `../utils/letterheadService.js` |
| `server/controllers/reportsController.js:8` | `../../backend/utils/letterheadService.js` | `../utils/letterheadService.js` |
| `server/controllers/pdfExportController.js:11` | `../../backend/export/pdfBuilder.js` | `../services/export/pdfBuilder.js` |
| `server/controllers/pdfExportController.js:12` | `../../backend/export/pdfHelpers.js` | `../services/export/pdfHelpers.js` |
| `server/controllers/pdfExportController.js:13` | `../../backend/utils/letterheadService.js` | `../utils/letterheadService.js` |

**CRITICAL — Dynamic import at `server/controllers/reportsController.js:810`**:
```javascript
// BEFORE:
const { ... } = await import('../../backend/export/excelStreamingBuilder.js');
// AFTER:
const { ... } = await import('../services/export/excelStreamingBuilder.js');
```
This won't be caught by static analysis tools. Must manually find and fix.

### Task 2.6: Delete Orphaned Files & Empty Directories
1. DELETE `server/backend/export/excelStreamingBuilder.js` — orphaned, different version from the one in `backend/export/`, zero imports found.
2. DELETE `server/backend/export/` directory
3. DELETE `server/backend/` directory
4. DELETE `backend/` directory (should be empty after all moves)

**QA (Wave 2 specific)**:
```bash
# Verify export module loads without __dirname errors
node -e "import('./server/services/export/pdfBuilder.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"
node -e "import('./server/services/export/excelBuilder.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"
node -e "import('./server/utils/letterheadService.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"

# Full test suite
npm test
npm run build
```

---

## Wave 3: Migration Consolidation (3 locations → 1)
**Goal**: Semua migration files di `database/migrations/` dengan naming convention konsisten.
**Risk**: 🟡 MEDIUM — Possible duplicate migrations.
**Files touched**: ~11 files move, 1 file edit.

### Task 3.1: Diff Suspected Duplicate Migrations
**Before moving anything**, compare these suspected duplicates:

**Pair 1**:
- `migrations/20250130_create_admin_activity_logs.sql`
- `server/migrations/create_admin_activity_logs.sql`

**Pair 2**:
- `migrations/20260219_add_report_covering_indexes.sql`
- `database/migrations/003_add_report_covering_indexes.sql`

Use `diff` or read both files and compare content. If identical or functionally equivalent, keep only one copy. If different, keep the most recent/complete version.

**Decision rule**: Keep the version that appears most complete and well-tested. When in doubt, keep the root `migrations/` version (it has date-prefixed names).

### Task 3.2: Consolidate All Migrations into database/migrations/
**Target naming convention**: `NNN_description.sql` (sequential numbers).

Move and rename to `database/migrations/`:
```
001_schedule_enhancement.sql          ← already exists in database/migrations/
002_jam_pelajaran_kelas.sql           ← already exists in database/migrations/
003_add_report_covering_indexes.sql   ← already exists (or merged from duplicate)
004_create_jam_pelajaran.sql          ← from migrations/20241214_create_jam_pelajaran.sql
005_create_attendance_settings.sql    ← from migrations/20241218_create_attendance_settings.sql
006_add_siswa_pencatat.sql            ← from migrations/20241219_add_siswa_pencatat_to_absensi_siswa.sql
007_create_admin_activity_logs.sql    ← from migrations/ or server/migrations/ (after diff)
008_kalender_akademik.sql             ← from server/migrations/006_kalender_akademik.sql
```

### Task 3.3: Move Migration Runner
Move `server/migrations/run_migrations.js` → `database/migrations/run_migrations.js`

Fix the `.env` path inside:
```javascript
// BEFORE:
dotenv.config({ path: path.join(__dirname, '../../.env') });
// AFTER:
dotenv.config({ path: path.join(process.cwd(), '.env') });
```

### Task 3.4: Delete Empty Migration Directories
1. DELETE `migrations/` (root) — empty after moves
2. DELETE `server/migrations/` — empty after moves

**QA**: `npm test` passes. Verify migration runner works:
```bash
node database/migrations/run_migrations.js --dry-run
```
(If --dry-run isn't supported, just verify the script loads without error.)

---

## Wave 4: Frontend Tidying
**Goal**: Fix duplikasi, konsolidasi types, bersihkan domain components dari ui/.
**Risk**: 🟡 MEDIUM — Import path changes.
**Files touched**: ~10 files move/delete, ~15 files edit.

### Task 4.1: Resolve Page Duplication
**Current state**:
- `src/pages/NotFound.tsx` — NOT imported anywhere (dead code)
- `src/components/pages/NotFoundPage.tsx` — imported via barrel in `App.tsx` ✓
- `src/components/pages/ServerErrorPage.tsx` — imported via barrel ✓
- `src/components/pages/UnauthorizedPage.tsx` — imported via barrel ✓

**Actions**:
1. Verify `src/pages/NotFound.tsx` is truly unused: `grep -r "NotFound" src/ --include="*.tsx" --include="*.ts"` — ensure only `NotFoundPage` references appear, not `NotFound` from `src/pages/`.
2. DELETE `src/pages/NotFound.tsx` if confirmed dead.
3. Keep `src/components/pages/` as-is (it's properly organized with barrel export, imported by App.tsx).

**DO NOT** merge `src/components/pages/` into `src/pages/` — the barrel import pattern in App.tsx works correctly.

### Task 4.2: Move Domain Components Out of Shadcn UI Folder
**Files to move from `src/components/ui/` to `src/components/shared/`:**

| File | Used By | Action |
|------|---------|--------|
| `font-size-control.tsx` | 3 dashboards | MOVE to `src/components/shared/` |
| `time-input.tsx` | 2 schedule views | MOVE to `src/components/shared/` |
| `report-letterhead.tsx` | 0 imports found | Verify dead → DELETE |
| `report-summary.tsx` | 0 imports found | Verify dead → DELETE |

**After moving**, update imports using `ast_grep_replace`:
```
// Pattern: import { FontSizeControl } from '@/components/ui/font-size-control'
// Replace: import { FontSizeControl } from '@/components/shared/font-size-control'
```

Same for `time-input`.

**IMPORTANT**: DO NOT modify any actual Shadcn UI components (button, input, select, etc.) — per AGENTS.md "UI Freeze" rule.

### Task 4.3: Consolidate Scattered Types
**Current locations**:
- `src/types/auth.ts` ✓ (keep)
- `src/types/dashboard.ts` ✓ (keep)
- `src/types/school.ts` ✓ (keep)
- `src/components/admin/types/adminTypes.ts` — Move to `src/types/admin.ts`
- `src/components/teacher/types.ts` — Move to `src/types/teacher.ts`
- `src/components/student/types.ts` — Move to `src/types/student.ts`

**After moving**, update imports. Use `ast_grep_search` to find all references:
- `from '../types/adminTypes'` or `from './types/adminTypes'` → `from '@/types/admin'`
- `from './types'` (in teacher/) → `from '@/types/teacher'`
- `from './types'` (in student/) → `from '@/types/student'`

Delete empty `src/components/admin/types/` directory after move.

### Task 4.4: Convert .js to .ts
Rename `src/utils/absentaExportSystem.js` → `src/utils/absentaExportSystem.ts`

Add TypeScript type annotations to the file. At minimum, add parameter types and return types to exported functions. If complex, use `any` temporarily with `// TODO: type properly` comments.

Update any imports if they use the `.js` extension explicitly.

### Task 4.5: Organize Flat View Components
**Move large view components from `src/components/` root to their feature folders:**

| Component | Target |
|-----------|--------|
| `AdminDashboard.tsx` | `src/components/admin/AdminDashboard.tsx` |
| `MonitoringDashboard.tsx` | `src/components/admin/MonitoringDashboard.tsx` |
| `BackupManagementView.tsx` + `.helpers.ts` | `src/components/admin/BackupManagementView.tsx` + `.helpers.ts` |
| `JamPelajaranConfig.tsx` | `src/components/admin/JamPelajaranConfig.tsx` |
| `ExcelImportView.tsx` | `src/components/admin/ExcelImportView.tsx` |
| `ExcelPreview.tsx` + `.components.tsx` | `src/components/admin/ExcelPreview.tsx` + `.components.tsx` |
| `RekapKetidakhadiranView.tsx` | `src/components/admin/reports/RekapKetidakhadiranView.tsx` |
| `RekapKetidakhadiranGuruView.tsx` | `src/components/admin/reports/RekapKetidakhadiranGuruView.tsx` |
| `PresensiSiswaView.tsx` | `src/components/admin/reports/PresensiSiswaView.tsx` |
| `TeacherDashboard.tsx` | `src/components/teacher/TeacherDashboard.tsx` |
| `StudentDashboard.tsx` | `src/components/student/StudentDashboard.tsx` |
| `EditProfile.tsx` + `.components.tsx` | `src/components/shared/EditProfile.tsx` + `.components.tsx` |
| `ReportHeader.tsx` | `src/components/shared/ReportHeader.tsx` |
| `ReportLetterheadSettings.tsx` | `src/components/admin/settings/ReportLetterheadSettings.tsx` |
| `InitLetterheadButton.tsx` | `src/components/admin/settings/InitLetterheadButton.tsx` |
| `SimpleLetterheadInit.tsx` | `src/components/admin/settings/SimpleLetterheadInit.tsx` |
| `SimpleRestoreView.tsx` | `src/components/admin/SimpleRestoreView.tsx` |
| `NotificationBell.tsx` | `src/components/shared/NotificationBell.tsx` |
| `NotificationPanel.tsx` | `src/components/shared/NotificationPanel.tsx` |

**Shared/layout components to keep at `src/components/` root:**
- `ProtectedRoute.tsx` ← stays (app-level routing guard)
- `ErrorBoundary.tsx` ← stays (app-level error boundary)
- `LoginForm.tsx` ← stays (used by LoginPage)
- `mode-toggle.tsx` ← stays (global theme toggle)
- `theme-provider.tsx` ← stays (global provider)

**After moving**, update ALL imports using `ast_grep_replace` or `lsp_find_references` per moved component. This is the largest batch of import updates — proceed file by file.

**QA**:
```bash
npm run build   # Must succeed — catches broken imports
npx tsc --noEmit  # Type check
npm test
```

---

## Wave 5: Database & Docs Cleanup
**Goal**: Clean up database directory, clarify seed structure, remove data files from docs/.
**Risk**: 🟢 LOW — No code changes.
**Files touched**: ~8 files delete/move.

### Task 5.1: Clean Up Old SQL Dumps
DELETE from `database/`:
```
absenta13 (7).sql        ← old numbered dump
absenta13_complete.sql   ← superseded
absenta13v1.sql          ← old version
test_detection_backup.sql ← test artifact
```

**KEEP**: `database/absenta13.sql` — referenced by `docker-compose.yml` as MySQL init script.

### Task 5.2: Consolidate Seeds
1. Move `database/seed_dummy_data.sql` → `database/seeders/seed_dummy_data.sql`
2. Keep `database/seeders/` as canonical location for all seed scripts (JS + SQL)
3. Keep `database/seeds/seed_jam_pelajaran.sql` in place (or move to seeders/) — small enough to leave.

### Task 5.3: Clean Up Docs
Move CSV data files OUT of `docs/` to `database/reference-data/`:
```
docs/jadwal mapel - JADWAL.csv → database/reference-data/jadwal-mapel.csv
docs/JADWAL PELAJARAN 2025-2026 (REVISI 2) (1) - JADWAL.csv → database/reference-data/jadwal-pelajaran-2025-2026.csv
docs/PRESENSI SISWA 2025-2026 edit1 - Short NIS.csv → database/reference-data/presensi-siswa-2025-2026.csv
docs/REKAP KETIDAKHADIRAN GURU 2025-2026 - REKAP GURU.csv → database/reference-data/rekap-guru-2025-2026.csv
```

Keep in `docs/`:
- `SYSTEM-ARCHITECTURE.md` ✓
- `OPENCODE-GUIDE.md` ✓
- `CORS-TROUBLESHOOTING.md` ✓

**QA**: No code changes, so just verify `npm run build` still passes.

---

## Wave 6: Gitignore Update + Documentation Refresh
**Goal**: Prevent future clutter, update docs to reflect new structure.
**Risk**: 🟢 LOW
**Files touched**: 4 files edit.

### Task 6.1: Update .gitignore
Add these patterns to `.gitignore`:
```gitignore
# Fix/utility scripts (one-off, shouldn't be committed)
fix_*.js
fix_*.cjs

# Temp files
*.xlsx
nul
custom-schedules.json
backup-settings.json
.wakatime-heartbeat.txt

# Backup/old config files
opencode.json.*

# Debug artifacts
git_status_*.txt
debug_logs/

# Python cache (not a Python project)
.ruff_cache/

# Storybook (removed)
.storybook/

# Reference data (optional — depends on if you want these tracked)
# database/reference-data/
```

### Task 6.2: Update AGENTS.md Directory Structure
Update the "Directory Structure" section in `AGENTS.md` to reflect the new structure:
```
- `src/` - Frontend source.
- `server/` - Backend source (routes, controllers, services, middleware, utils, config).
- `server/services/export/` - Excel/PDF export builders and schemas.
- `database/` - SQL schema, migrations, seeds.
- `docs/` - Documentation.
- `scripts/` - Utility scripts.
- `docker/` - Docker configurations (nginx, etc.).
```

Remove references to:
- `backend/` directory (merged into `server/`)
- `server_modern.js` (now `server/index.js`)

### Task 6.3: Update README.md
Update the "Struktur Project" section to match the new structure.
Update the "Quick Start" section: change `node server_modern.js` to `node server/index.js`.
Update the "Deployment Guide" section: same change.

### Task 6.4: Update .github/copilot-instructions.md
Update references to `server_modern.js` → `server/index.js`.
Remove mention of `backend/` directory.

### Task 6.5: Evaluate Dockerfile Optimization (Optional)
**Line 71 in Dockerfile**: `COPY --from=builder /app/src ./src`
This copies the entire frontend source to the production container, but NO backend file imports from `src/`. 
**Action**: Comment it out and test Docker build. If it works, delete the line. If something breaks, restore it and add a comment explaining why it's needed.

**QA**:
```bash
npm run build
npm test
docker-compose build --no-cache app
```

---

## Final Verification Wave
After all 6 waves complete, run full verification:

```bash
# 1. Clean build
rm -rf dist/ && npm run build

# 2. Type check
npx tsc --noEmit

# 3. Full test suite
npm test

# 4. Lint
npm run lint

# 5. Server starts successfully
node server/index.js &
sleep 5
curl -s http://localhost:3001/api/health
kill %1

# 6. Docker full build
docker-compose build --no-cache

# 7. Verify no dangling imports
grep -r "../../backend/" server/ --include="*.js"
# Assert: 0 results

# 8. Verify no reference to old entry point
grep -r "server_modern" . --include="*.js" --include="*.json" --include="*.cjs" --include="*.yml" --include="*.md" --exclude-dir=node_modules --exclude-dir=.git
# Assert: 0 results
```

## Target Directory Structure (After All Waves)
```
absenta-13-v3/
├── .github/                    # CI/CD workflows
├── .vscode/                    # Editor settings
├── database/                   # All database files
│   ├── absenta13.sql           # Main schema (Docker init)
│   ├── migrations/             # ALL migrations (consolidated)
│   │   ├── 001_schedule_enhancement.sql
│   │   ├── ...
│   │   └── run_migrations.js
│   ├── seeders/                # JS seed scripts
│   └── reference-data/         # CSV reference data
├── docker/                     # Docker configs
│   └── nginx/                  # Nginx config + error pages
├── docs/                       # Documentation (MD only)
│   ├── SYSTEM-ARCHITECTURE.md
│   ├── OPENCODE-GUIDE.md
│   └── CORS-TROUBLESHOOTING.md
├── public/                     # Static assets
├── scripts/                    # Utility/maintenance scripts
├── server/                     # ALL backend code
│   ├── index.js                # Entry point (was server_modern.js)
│   ├── config/                 # DB, export, template configs
│   ├── controllers/            # 31 controllers
│   ├── middleware/              # Auth, error, rate limit
│   ├── routes/                 # 31 route files
│   ├── services/               # Business logic
│   │   ├── export/             # Excel/PDF builders + schemas
│   │   │   └── schemas/        # 10 export schemas
│   │   └── system/             # Cache, queue, monitoring, etc.
│   ├── scripts/                # Server utility scripts
│   ├── templates/              # Excel templates
│   ├── utils/                  # Utilities + letterheadService
│   └── __tests__/              # Backend tests
├── src/                        # Frontend
│   ├── App.tsx                 # Router + providers
│   ├── main.tsx                # Entry point
│   ├── components/             # UI components
│   │   ├── admin/              # Admin feature components
│   │   │   ├── dashboard/
│   │   │   ├── reports/
│   │   │   ├── settings/
│   │   │   ├── ...
│   │   │   └── AdminDashboard.tsx
│   │   ├── teacher/            # Teacher feature components
│   │   ├── student/            # Student feature components
│   │   ├── shared/             # Shared domain components
│   │   ├── pages/              # Error pages (barrel export)
│   │   ├── ui/                 # Shadcn UI ONLY
│   │   ├── ErrorBoundary.tsx   # App-level
│   │   ├── ProtectedRoute.tsx  # App-level
│   │   ├── LoginForm.tsx       # Login
│   │   ├── mode-toggle.tsx     # Theme
│   │   └── theme-provider.tsx  # Theme
│   ├── config/                 # API config
│   ├── contexts/               # Auth, FontSize contexts
│   ├── hooks/                  # Custom hooks
│   ├── lib/                    # Utility wrappers
│   ├── pages/                  # Route pages
│   ├── services/               # API services
│   ├── types/                  # ALL TypeScript types
│   └── utils/                  # Utility functions
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── ecosystem.config.cjs
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── AGENTS.md
└── README.md
```

**Root: ~20 files (down from 96)**
