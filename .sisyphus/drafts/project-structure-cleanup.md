# Draft: Project Structure Cleanup — Absenta 13 v3

## Problem Statement
Proyek memiliki 96 entries di root directory (seharusnya ~20), duplikasi backend di 3 lokasi, migrations di 3 lokasi, dan frontend yang belum terstruktur feature-based.

## Current State Analysis

### ROOT (96 entries → target ~20)
**Junk Files (DELETE):**
- 21x .log files (dev_server*.log, backend.log, frontend.log, diagnostic.log, dll)
- 9x fix scripts (fix_all.js, fix_error.cjs, fix_keys.cjs, fix_render.cjs, fix_schedules*.js, fix_sort.js)
- Temp/backup: opencode.json.backup-*, opencode.json.bak-*, opencode.json.old
- backup-settings.json, git_status_output.txt, git_status_utf8.txt
- tmp-logo-check.xlsx, tmp-logo-check-wide.xlsx
- "# Untitled spreadsheet - Google Spreadsh.txt"
- nul (empty Windows artifact)
- custom-schedules.json, create_admin.js

**Misplaced Files (MOVE):**
- server_modern.js → server/index.js
- 404.html, 502.html → docker/nginx/
- create_admin.js → scripts/

**Empty/Unused Dirs (EVALUATE):**
- docs-site/ — empty Docusaurus
- archives/ — possibly empty
- backend/migrations/ — empty
- .ruff_cache/ — Python cache (not a Python project)
- debug_logs/ — should be in logs/

### BACKEND (3 locations → 1)
| Location | Contents |
|----------|----------|
| `server/` | 31 controllers, 31 routes, services, middleware, config — THE MAIN CODE |
| `backend/` | export builders, letterhead utils, schemas — SHOULD MERGE INTO server/ |
| `server/backend/` | 1 file (excelStreamingBuilder.js) — REDUNDANT |

### MIGRATIONS (3 locations → 1)
| Location | Files |
|----------|-------|
| `migrations/` (root) | 5 SQL files |
| `database/migrations/` | 3 SQL files |
| `server/migrations/` | 2 SQL + 1 JS runner |
→ All should consolidate to `database/migrations/`

### FRONTEND (src/) Issues
1. Duplikasi pages: `src/components/pages/` AND `src/pages/`
2. ~20 view components flat di `src/components/` root
3. Types tersebar di 4 lokasi
4. Service layer hampir kosong
5. Domain components di `src/components/ui/` (Shadcn folder)
6. 1 .js file in TypeScript project

### DATABASE
- Multiple old SQL dumps di `database/`
- seeds/ vs seeders/ membingungkan

## Proposed Target Structure
(Pending user preference on approach)

## Open Questions
1. Pendekatan bertahap (wave-by-wave) vs big-bang?
2. Frontend: reorganize ke features/ atau cukup rapikan?
3. docs-site/, .storybook/, archives/ masih dipakai?
