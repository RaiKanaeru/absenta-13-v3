---
description: Development guidelines dan endpoint conventions untuk Absenta 13
---

# ABSENTA 13 - GLOBAL AI RULES

## 1. PROJECT CONTEXT & STRUCTURE

You are working on "Absenta 13", a School Attendance System.

* **Root Structure:**
* `server/`: Node.js/Express Backend (Business logic, Routes, Controllers).
* `src/`: React TypeScript Frontend (Components, Hooks, Services).


* **Key Files:**
* Config: `server/config/exportConfig.js` (Mapping for exports).
* Templates: `server/templates/` (Excel templates location).



## 2. API DEVELOPMENT RULES (STRICT)

* **Naming Convention:** All endpoints MUST follow the pattern: `/api/{role}/{resource}`.
* Roles: `admin`, `guru`, `siswa`, or general (no role).


* **Frontend-First Validation:** Before creating a backend route, YOU MUST CHECK if the frontend is already calling it.
* Command: `grep -r "getApiUrl" src/`.
* Ensure the backend route matches the frontend call exactly.



## 3. CODING STANDARDS & CRITICAL PATHS

* **Import Paths (Anti-Error Module):**
* Pay extreme attention to relative paths.
* Correct: `import { CONFIG } from '../../config/exportConfig.js'` (from services/export).
* Incorrect: `../config` if you are 2 levels deep.


* **CORS:** Manual CORS headers must be placed at the very top of `server_modern.js`. Verify `ALLOWED_ORIGINS` in `.env` includes the frontend domain.

## 4. EXCEL EXPORT GUIDELINES

* **Template Usage:** ALWAYS load templates from `server/templates/excel/`.
* **Formatting:**
* NEVER overwrite cells containing formulas.
* Preserve existing borders and merges.


* **Colors (ARGB):** Use these specific hex codes for styling:
* Header: `FF90EE90` (Light Green)
* Mapel 1: `FFFF6B6B` (Red)
* Mapel 2: `FF4ECDC4` (Teal)
* Empty: `FFF5F5F5` (Light Gray).



## 5. QUALITY GATES (SONARQUBE)

* **Cognitive Complexity:** Max 15 per function. Use Guard Clauses/Early Returns.
* **Nesting Depth:** Max 4 levels. Break down complex logic.
* **Validation:** Always verify your code changes with `analyze_code_snippet` if available.

## 6. DEPLOYMENT CHECKS

If writing deployment scripts, ensure this workflow is respected:

1. `git pull origin main`
2. `docker-compose down` -> `build --no-cache` -> `up -d`
3. `docker logs absenta13-app --tail 50`.