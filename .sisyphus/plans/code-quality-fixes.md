# Code Quality Fixes — 382 Issues Resolution Plan

## TL;DR

> **Quick Summary**: Systematically fix 382 code quality issues across the codebase, organized into 4 waves from quick wins (<30 min) to high-effort refactoring (4-6 hours).
> 
> **Deliverables**:
> - Wave 1: 50 issues fixed (commented code, node: prefix, unused imports, String.raw)
> - Wave 2: 100 issues fixed (SQL constants, shell script fixes, React props, Array keys)
> - Wave 3: 30 issues fixed (cognitive complexity refactoring in seeders/controllers)
> - Wave 4: Database literal consolidation (160 occurrences)
> 
> **Estimated Effort**: **Large** (8-12 hours total)
> **Parallel Execution**: YES — 4 waves, can run Wave 1 & 2 in parallel, Wave 3 & 4 in parallel
> **Critical Path**: Wave 1 → Wave 2 → Wave 3 → Wave 4

---

## Context

### Original Request
User presented 382 SonarQube code quality issues ranging from minor style violations to critical complexity hotspots. Requested bulk analysis and fix strategy.

### Interview Summary
**Key Discussions**: N/A — Analysis mode only, no user interview needed.

**Research Findings** (from 3 parallel agents):
- **bg_929d1a24**: Core app is CLEAN — only 10 commented blocks in qwen-code-repo subproject
- **bg_51300278**: Identified 5 critical complexity hotspots (110, 59, 25, 21, 16 complexity)
- **bg_7a484d2f**: Mixed `node:` prefix convention — ~60% use `node:`, ~40% use plain imports

### Metis Review
**Identified Gaps** (addressed):
- Gap: "Should qwen-code-repo be fixed?" → Resolved: It's a separate subproject, fix only if it's part of main app
- Gap: "Database SQL fixes risky?" → Resolved: Wave 4 is separate, can skip if migration scripts are sensitive

---

## Work Objectives

### Core Objective
Eliminate 382 code quality issues to improve maintainability, reduce technical debt, and establish consistent code conventions.

### Concrete Deliverables
- All 382 SonarQube issues resolved or explicitly deferred
- Consistent `node:` prefix across all JS files
- Zero commented-out code in main codebase
- Cognitive complexity <20 for all functions
- SQL literals consolidated into constants

### Definition of Done
- [ ] `npm run lint` passes with zero errors/warnings
- [ ] `npm run build` succeeds
- [ ] `npm test` passes (all test suites)
- [ ] SonarQube scan shows 0 issues (or only accepted false positives)

### Must Have
- All fixes maintain existing functionality (zero behavioral changes)
- All refactoring preserves test coverage
- Backward compatibility maintained

### Must NOT Have (Guardrails)
- NO behavioral changes in seeders (dummy data logic must produce identical output)
- NO changes to qwen-code-repo unless explicitly part of main Absenta 13 app
- NO database schema modifications without explicit user approval
- NO breaking changes to public API endpoints

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest for frontend, Node.js test runner for backend)
- **Automated tests**: YES (Tests-after — run tests after each wave completes)
- **Framework**: vitest (frontend), Node.js native test runner (backend)
- **If Tests-after**: Each wave ends with test execution task

### QA Policy
Every task MUST include agent-executed QA scenarios (see TODO template below).
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **TUI/CLI**: Use interactive_bash (tmux) — Run command, send keystrokes, validate output
- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields
- **Library/Module**: Use Bash (bun/node REPL) — Import, call functions, compare output

---

## Execution Strategy

### Parallel Execution Waves

> Maximize throughput by grouping independent tasks into parallel waves.
> Each wave completes before the next begins.
> Target: 5-8 tasks per wave. Fewer than 3 per wave (except final) = under-splitting.

```
Wave 1 (Start Immediately — Quick Wins, <30 min total):
├── Task 1: Remove commented-out code (10 files) [quick]
├── Task 2: Standardize node: prefix in scripts/ [quick]
├── Task 3: Standardize node: prefix in server/ [quick]
├── Task 4: Standardize node: prefix in database/seeders [quick]
├── Task 5: Remove unused imports (LSP-identified) [quick]
├── Task 6: Fix String.raw escaping (scripts/) [quick]
└── Task 7: Fix shell script stderr redirects [quick]

Wave 2 (After Wave 1 — Medium Effort, 1-2 hours):
├── Task 8: Define SQL constants in absenta13.sql (160 occurrences) [unspecified-high]
├── Task 9: Define SQL constants in seed_jam_pelajaran.sql (13 occurrences) [quick]
├── Task 10: Fix React props readonly typing (docs-site/) [quick]
├── Task 11: Replace Array index keys with unique IDs (docs-site/) [quick]
├── Task 12: Fix shell script explicit returns [quick]
├── Task 13: Fix shell script literal duplication [quick]
└── Task 14: Fix Python script literal duplication (review-hotspots.py) [quick]

Wave 3 (After Wave 2 — High Effort Refactoring, 4-6 hours):
├── Task 15: Decompose seed_dummy_range.js main() (110 → 6 functions) [deep]
├── Task 16: Decompose seed_dummy_full.js seed() (59 → 3 functions) [deep]
├── Task 17: Extract getStudentsForSchedule SQL builder (absensiController) [unspecified-high]
├── Task 18: Extract getStudentsForSchedule SQL builder (exportController) [unspecified-high]
├── Task 19: Extract submitStudentAttendance batch logic [deep]
├── Task 20: Extract authController login lockout logic [unspecified-high]
└── Task 21: Extract authController login role-fetch logic [quick]

Wave 4 (After Wave 3 — Database Cleanup, 1-2 hours):
├── Task 22: Generate migration script for SQL constants [unspecified-high]
├── Task 23: Apply migration to absenta13.sql [quick]
├── Task 24: Verify database schema integrity [quick]
└── Task 25: Update seed scripts to use new constants [quick]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Wave 1 → Wave 2 → Wave 3 → Wave 4 → Final
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 7 (Wave 1 & 2)
```

### Dependency Matrix

- **1-7**: — — 8-14, 1
- **8**: 1-7 — 15, 2
- **9-14**: 1-7 — 15, 2
- **15**: 8-14 — 22, 3
- **16-21**: 8-14 — 22, 3
- **22**: 15-21 — 23-25, 4
- **23-25**: 22 — Final, 4

### Agent Dispatch Summary

- **1**: **7** — T1-T7 → `quick`
- **2**: **7** — T8 → `unspecified-high`, T9-T14 → `quick`
- **3**: **7** — T15-16 → `deep`, T17-18 → `unspecified-high`, T19 → `deep`, T20 → `unspecified-high`, T21 → `quick`
- **4**: **4** — T22 → `unspecified-high`, T23-25 → `quick`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE. No exceptions.**

- [ ] 1. Remove commented-out code blocks (10 files)

  **What to do**:
  - Remove commented code from files identified in bg_929d1a24 analysis:
    - `server/controllers/importMasterScheduleController.js:178-179`
    - `qwen-code-repo/packages/cli/src/utils/nonInteractiveHelpers.ts:659`
    - `qwen-code-repo/packages/cli/src/nonInteractive/io/BaseJsonOutputAdapter.ts:1310`
    - `qwen-code-repo/packages/cli/src/nonInteractive/control/ControlService.ts:147-150`
    - `qwen-code-repo/packages/core/src/core/prompts.ts:326`
    - `qwen-code-repo/packages/cli/src/nonInteractive/control/ControlDispatcher.ts:34`
    - `qwen-code-repo/packages/core/src/tools/glob.test.ts:318`
    - `qwen-code-repo/packages/cli/src/config/config.ts:656`
    - `qwen-code-repo/packages/cli/src/ui/components/SettingsDialog.test.tsx:142-160`
    - `qwen-code-repo/packages/cli/src/ui/hooks/useGeminiStream.ts:609`
  - Simply delete the commented lines (no replacement needed)

  **Must NOT do**:
  - Do NOT modify any active code
  Do NOT remove legitimate JSDoc comments or inline explanations

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple deletion of commented lines, no logic changes
  - **Skills**: [`absenta-backend`]
    - `absenta-backend`: Familiarity with codebase structure and conventions
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed — single commit at wave level

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-7)
  - **Blocks**: Wave 2 tasks
  - **Blocked By**: None (can start immediately)

  **References**:
  - `bg_929d1a24` task output — Full list of commented code locations

  **Acceptance Criteria**:
  - [ ] All 10 commented blocks removed
  - [ ] `npm run lint` passes (no new errors)
  - [ ] `npm test` passes

  **QA Scenarios**:
  ```
  Scenario: Verify no commented code remains
    Tool: Grep
    Preconditions: Clean working directory
    Steps:
      1. Run: grep -r "^\/\/" --include="*.js" --include="*.ts" --include="*.tsx" server/ scripts/ database/seeders/
      2. Filter results to exclude legitimate comments (JSDoc, inline explanations)
      3. Verify no commented-out function declarations or variable assignments remain
    Expected Result: Zero matches for commented code blocks (only inline comments allowed)
    Failure Indicators: Any line starting with // that contains function/class/const/let/var declarations
    Evidence: .sisyphus/evidence/task-1-grep-output.txt
  ```

  **Commit**: NO (group with Wave 1)

---

- [ ] 2. Standardize `node:` prefix in scripts/

  **What to do**:
  - Update all Node.js built-in imports in `scripts/*.js` to use `node:` prefix:
    - `import fs from 'fs'` → `import fs from 'node:fs'`
    - `import path from 'path'` → `import path from 'node:path'`
    - `import url from 'url'` → `import url from 'node:url'`
    - `import { readFile } from 'fs/promises'` → `import { readFile } from 'node:fs/promises'`
  - Files to update (from bg_7a484d2f analysis):
    - `scripts/generate-swagger.js:2-3`
    - `scripts/import-db.js:1,3-4`
    - `scripts/test-config.js` (check all imports)
    - `scripts/reset_admin.js` (check all imports)
    - `scripts/run-database-optimization.js` (check all imports)

  **Must NOT do**:
  - Do NOT change third-party imports (only Node.js built-ins)
  - Do NOT modify import aliases or restructure imports

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple find-replace pattern, no logic changes
  - **Skills**: [`absenta-backend`]
    - `absenta-backend`: Knows which files are in scripts/ directory
  - **Skills Evaluated but Omitted**:
    - `absenta-frontend`: Not relevant — backend scripts only

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `bg_7a484d2f` task output — Import convention analysis
  - Node.js docs: https://nodejs.org/api/esm.html#node-imports

  **Acceptance Criteria**:
  - [ ] All Node.js built-in imports in scripts/ use `node:` prefix
  - [ ] No third-party imports accidentally modified
  - [ ] `node scripts/test-config.js` runs successfully

  **QA Scenarios**:
  ```
  Scenario: Verify node: prefix applied correctly
    Tool: Grep
    Preconditions: Task complete
    Steps:
      1. Run: grep -E "^import.*from ['\"](node:)?(fs|path|url)" scripts/*.js
      2. Count matches with node: prefix vs without
      3. Verify 100% of Node.js built-ins have node: prefix
    Expected Result: All matches show node:fs, node:path, node:url (zero plain imports)
    Failure Indicators: Any import from 'fs' or 'path' without node: prefix
    Evidence: .sisyphus/evidence/task-2-import-check.txt
  ```

  **Commit**: NO (group with Wave 1)

---

- [ ] 3. Standardize `node:` prefix in server/

  **What to do**:
  - Update all Node.js built-in imports in `server/**/*.js` to use `node:` prefix
  - Same pattern as Task 2, but for server directory
  - Check these files (from bg_7a484d2f sampling):
    - `server_modern.js` (line 10-14)
    - `server/services/system/queue-system.js` (line 13)
    - `server/utils/logger.js` (check imports)
    - `server/controllers/exportController.js` (check imports)
    - `server/controllers/absensiController.js` (check imports)

  **Must NOT do**:
  - Do NOT change third-party imports
  - Do NOT modify import structure or aliases

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple find-replace pattern
  - **Skills**: [`absenta-backend`]
    - `absenta-backend`: Knows server/ structure and import patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-2, 4-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `bg_7a484d2f` task output — Import convention analysis

  **Acceptance Criteria**:
  - [ ] All Node.js built-in imports in server/ use `node:` prefix
  - [ ] `npm run start:modern` starts successfully
  - [ ] `npm run test:server` passes

  **QA Scenarios**:
  ```
  Scenario: Verify server starts with node: imports
    Tool: interactive_bash
    Preconditions: Server not running, port 3001 available
    Steps:
      1. Run: node server_modern.js &
      2. Wait 3 seconds for startup
      3. Run: curl -s http://localhost:3001/api/health || curl -s http://localhost:3001/
      4. Check for 200 OK or valid response
      5. Kill server process
    Expected Result: Server starts without import errors, responds to health check
    Failure Indicators: "Cannot find module" errors, startup crashes
    Evidence: .sisyphus/evidence/task-3-server-startup.log
  ```

  **Commit**: NO (group with Wave 1)

---

- [ ] 4. Standardize `node:` prefix in database/seeders

  **What to do**:
  - Update all Node.js built-in imports in `database/seeders/*.js` to use `node:` prefix
  - Files to check:
    - `database/seeders/run-seed-jam-pelajaran.js`
    - `database/seeders/seed_dummy_full.js`
    - `database/seeders/seed_dummy_range.js`
    - `database/seeders/seed_schedule_config.js`

  **Must NOT do**:
  - Do NOT change third-party imports
  - Do NOT modify seeder logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple find-replace pattern
  - **Skills**: [`absenta-backend`]
    - `absenta-backend`: Knows database seeder structure

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `bg_7a484d2f` task output — Import convention analysis

  **Acceptance Criteria**:
  - [ ] All Node.js built-in imports in database/seeders use `node:` prefix
  - [ ] Seeders can still run (syntax check)

  **QA Scenarios**:
  ```
  Scenario: Verify seeder syntax is valid
    Tool: Bash
    Preconditions: Node.js installed
    Steps:
      1. Run: node --check database/seeders/seed_dummy_full.js
      2. Run: node --check database/seeders/seed_dummy_range.js
      3. Check exit code (0 = success)
    Expected Result: Both files pass syntax check with exit code 0
    Failure Indicators: SyntaxError, "Cannot find module" errors
    Evidence: .sisyphus/evidence/task-4-syntax-check.log
  ```

  **Commit**: NO (group with Wave 1)

---

- [ ] 5. Remove unused imports (LSP-identified)

  **What to do**:
  - Remove unused imports identified by SonarQube:
    - `server/__tests__/attendanceCalculator.test.js:9` — unused `before`, `after`
    - `server/__tests__/attendanceCalculator.test.js:32` — unused `attendanceCalculator`
    - `server/backend/export/excelStreamingBuilder.js:7` — unused `getLetterhead`
    - `server/backend/export/excelStreamingBuilder.js:71` — unused `letterhead` variable
    - `server/controllers/absensiController.js:22` — unused `sendSuccessResponse`
    - `server/controllers/backupController.js:10` — unused `sendSuccessResponse`
    - `server/controllers/databaseFileController.js:5` — unused `sendSuccessResponse`
    - `server/controllers/exportController.js:32` — unused `MONTH_NAMES_SHORT`

  **Must NOT do**:
  - Do NOT remove imports that are used (verify with LSP)
  - Do NOT modify import structure beyond removal

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple deletion, LSP-verified
  - **Skills**: [`absenta-backend`]
    - `absenta-backend`: Knows controller/service structure

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - SonarQube issue list — Unused import locations
  - LSP diagnostics for verification

  **Acceptance Criteria**:
  - [ ] All 8 unused imports removed
  - [ ] `npm run lint` passes
  - [ ] `npm test` passes

  **QA Scenarios**:
  ```
  Scenario: Verify no unused imports remain
    Tool: Bash + ESLint
    Preconditions: Clean working directory
    Steps:
      1. Run: npm run lint -- --quiet --rule "no-unused-vars: error"
      2. Check for "X is defined but never used" errors
      3. Verify zero unused import warnings
    Expected Result: Zero "defined but never used" errors
    Failure Indicators: ESLint warnings about unused variables/imports
    Evidence: .sisyphus/evidence/task-5-lint-output.txt
  ```

  **Commit**: NO (group with Wave 1)

---

- [ ] 6. Fix String.raw escaping (scripts/)

  **What to do**:
  - Replace escaped backslashes with `String.raw` in:
    - `scripts/run-database-optimization.js:14,22,30,46,73,110,115` (7 occurrences)
    - `scripts/test-config.js:31,47,62,85,91,104,107,110` (8 occurrences)
  - Pattern: `` const sql = `SELECT \\` `` → `` const sql = String.raw`SELECT \` ``
  - Or: Remove double escaping if not using template literals

  **Must NOT do**:
  - Do NOT change SQL logic
  - Do NOT modify regex patterns unless they use escaping

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple find-replace pattern
  - **Skills**: [`absenta-backend`]
    - `absenta-backend`: Knows scripts directory

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5, 7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - SonarQube issue list — String.raw locations
  - MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/raw

  **Acceptance Criteria**:
  - [ ] All 15 String.raw issues fixed
  - [ ] Scripts run without errors

  **QA Scenarios**:
  ```
  Scenario: Verify scripts execute correctly
    Tool: Bash
    Preconditions: Database running (or mock)
    Steps:
      1. Run: node scripts/test-config.js
      2. Check for syntax errors or runtime crashes
      3. Verify script completes (exit code 0)
    Expected Result: Script runs to completion without errors
    Failure Indicators: SyntaxError, "Invalid escape sequence" errors
    Evidence: .sisyphus/evidence/task-6-script-run.log
  ```

  **Commit**: NO (group with Wave 1)

---

- [ ] 7. Fix shell script stderr redirects

  **What to do**:
  - Update `scripts/test-cors.sh` to redirect error messages to stderr:
    - Line 111: `echo "Error: ..."` → `echo "Error: ..." >&2`
    - Line 119: `echo "Error: ..."` → `echo "Error: ..." >&2`
    - Line 168: `echo "Error: ..."` → `echo "Error: ..." >&2`
    - Line 169: `echo "Error: ..."` → `echo "Error: ..." >&2`
    - Line 208: `echo "Error: ..."` → `echo "Error: ..." >&2`
  - Add explicit `return 0` at end of functions (line 50)

  **Must NOT do**:
  - Do NOT change test logic or assertions
  - Do NOT modify success path output

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple shell script edits
  - **Skills**: [`absenta-devops`]
    - `absenta-devops`: Knows shell scripting conventions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - SonarQube issue list — Shell script locations
  - Bash best practices: https://www.gnu.org/software/bash/manual/html_node/Redirections.html

  **Acceptance Criteria**:
  - [ ] All 5 stderr redirects added
  - [ ] Explicit return statement added
  - [ ] `bash scripts/test-cors.sh --help` runs without errors

  **QA Scenarios**:
  ```
  Scenario: Verify shell script syntax is valid
    Tool: Bash
    Preconditions: Bash installed
    Steps:
      1. Run: bash -n scripts/test-cors.sh
      2. Check exit code (0 = syntax OK)
      3. Run: bash scripts/test-cors.sh --help
      4. Verify help text displays
    Expected Result: Syntax check passes, help displays
    Failure Indicators: "syntax error near unexpected token", script crashes
    Evidence: .sisyphus/evidence/task-7-shell-syntax.log
  ```

  **Commit**: YES (Wave 1 complete)
  - Message: `refactor(code-quality): wave 1 quick wins (7 tasks)`
  - Files: `scripts/*.js`, `server/**/*.js`, `database/seeders/*.js`, `scripts/test-cors.sh`
  - Pre-commit: `npm run lint && npm test`

---

- [ ] 8. Define SQL constants in absenta13.sql (160 occurrences)

  **What to do**:
  - Identify duplicated literals in `database/absenta13.sql` (SonarQube reports 160 occurrences)
  - Common duplicates likely include:
    - Status values: `'Hadir'`, `'Sakit'`, `'Izin'`, `'Alpa'`, `'Dispen'`, `'Terlambat'`
    - Role values: `'admin'`, `'guru'`, `'siswa'`
    - Boolean-like: `'1'`, `'0'`, `'true'`, `'false'`
    - Time values: `'07:00:00'`, `'16:00:00'` (standard hours)
  - Create a constants section at top of SQL file or in separate `constants.sql`
  - Replace literal occurrences with references (MySQL doesn't support constants, so use comments or structured approach)
  - **Alternative**: Since MySQL lacks true constants, create a reference document `docs/SQL-CONSTANTS.md` listing all canonical values

  **Must NOT do**:
  - Do NOT break existing SQL syntax
  - Do NOT change schema structure
  - Do NOT modify data values (only organize)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires careful analysis of SQL structure, may need creative solution for MySQL constant limitations
  - **Skills**: [`absenta-backend`, `absenta-devops`]
    - `absenta-backend`: Knows database schema and usage patterns
    - `absenta-devops`: Knows MySQL best practices

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Wave 1 completion for consistency)
  - **Parallel Group**: Wave 2 (sequential within wave)
  - **Blocks**: Wave 3, Wave 4
  - **Blocked By**: Task 1-7 (Wave 1)

  **References**:
  - SonarQube issue list — SQL literal duplication locations
  - `database/absenta13.sql` — Master schema file

  **Acceptance Criteria**:
  - [ ] All 160 literal duplications documented
  - [ ] Constants reference created (`docs/SQL-CONSTANTS.md` or inline comments)
  - [ ] SQL file still imports successfully

  **QA Scenarios**:
  ```
  Scenario: Verify SQL schema imports correctly
    Tool: Bash (mysql CLI)
    Preconditions: MySQL running, test database available
    Steps:
      1. Create test database: mysql -u root -e "CREATE DATABASE IF NOT EXISTS test_absenta"
      2. Import schema: mysql -u root test_absenta < database/absenta13.sql
      3. Check exit code (0 = success)
      4. Verify table count: mysql -u root -e "SHOW TABLES" test_absenta | wc -l
    Expected Result: Schema imports without errors, all tables created
    Failure Indicators: SQL syntax errors, "Table already exists" errors
    Evidence: .sisyphus/evidence/task-8-sql-import.log
  ```

  **Commit**: NO (group with Wave 2)

---

- [ ] 9. Define SQL constants in seed_jam_pelajaran.sql (13 occurrences)

  **What to do**:
  - Similar to Task 8, but for `database/seeds/seed_jam_pelajaran.sql`
  - Identify 13 duplicated literals
  - Add inline comments documenting canonical values
  - Or create reference in `docs/SQL-CONSTANTS.md`

  **Must NOT do**:
  - Do NOT break SQL syntax
  - Do NOT change seed data values

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Smaller scope (13 occurrences vs 160)
  - **Skills**: [`absenta-backend`]
    - `absenta-backend`: Knows seed data structure

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 8)
  - **Parallel Group**: Wave 2 (with Tasks 8, 10-14)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - SonarQube issue list — seed_jam_pelajaran.sql locations
  - `database/seeds/seed_jam_pelajaran.sql`

  **Acceptance Criteria**:
  - [ ] All 13 literal duplications documented
  - [ ] Reference added to constants doc

  **QA Scenarios**:
  ```
  Scenario: Verify seed SQL syntax
    Tool: Bash (mysql CLI)
    Preconditions: MySQL running, test database exists
    Steps:
      1. Import seed: mysql -u root test_absenta < database/seeds/seed_jam_pelajaran.sql
      2. Check exit code
      3. Verify row count: mysql -u root -e "SELECT COUNT(*) FROM jam_pelajaran" test_absenta
    Expected Result: Seed imports successfully, rows inserted
    Failure Indicators: SQL errors, duplicate key violations
    Evidence: .sisyphus/evidence/task-9-seed-import.log
  ```

  **Commit**: NO (group with Wave 2)

---

- [ ] 10. Fix React props readonly typing (docs-site/)

  **What to do**:
  - Update `docs-site/src/components/HomepageFeatures/index.tsx:51`
  - Change: `props: FeatureItem[]` → `props: readonly FeatureItem[]`
  - Or use `ReadonlyArray<FeatureItem>`
  - Mark component props interface as readonly

  **Must NOT do**:
  - Do NOT change component behavior
  - Do NOT modify FeatureItem type structure

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple TypeScript type annotation change
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Knows React + TypeScript patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-9, 11-14)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - SonarQube issue list — HomepageFeatures location
  - `docs-site/src/components/HomepageFeatures/index.tsx`
  - TypeScript docs: https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html

  **Acceptance Criteria**:
  - [ ] Props marked as readonly
  - [ ] `npm run build` passes (no type errors)

  **QA Scenarios**:
  ```
  Scenario: Verify TypeScript compilation
    Tool: Bash
    Preconditions: Node.js installed, docs-site dependencies installed
    Steps:
      1. cd docs-site
      2. Run: npm run build
      3. Check exit code (0 = success)
      4. Verify no type errors about mutability
    Expected Result: Build succeeds with zero type errors
    Failure Indicators: "Cannot assign to readonly property" errors, build failures
    Evidence: .sisyphus/evidence/task-10-ts-build.log
  ```

  **Commit**: NO (group with Wave 2)

---

- [ ] 11. Replace Array index keys with unique IDs (docs-site/)

  **What to do**:
  - Update `docs-site/src/components/HomepageFeatures/index.tsx:71`
  - Change: `<Feature key={index} .../>` → `<Feature key={feature.id} .../>`
  - Ensure FeatureItem type has unique `id` field
  - If no ID exists, generate from title/slug (e.g., `feature.title.toLowerCase().replace(/\s+/g, '-')`)

  **Must NOT do**:
  - Do NOT change component rendering logic
  - Do NOT break existing data structure

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple key prop change
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Knows React key best practices

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-10, 12-14)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - SonarQube issue list — Array index key location
  - React docs: https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key

  **Acceptance Criteria**:
  - [ ] All Array index keys replaced with unique IDs
  - [ ] No React key warnings in console

  **QA Scenarios**:
  ```
  Scenario: Verify no React key warnings
    Tool: Playwright
    Preconditions: docs-site built and served
    Steps:
      1. Navigate to docs-site homepage
      2. Open browser console
      3. Reload page
      4. Check console for "Each child in a list should have a unique "key" prop" warnings
    Expected Result: Zero key-related warnings
    Failure Indicators: React key warnings in console
    Evidence: .sisyphus/evidence/task-11-console-check.png
  ```

  **Commit**: NO (group with Wave 2)

---

- [ ] 12. Fix shell script explicit returns

  **What to do**:
  - Update `scripts/test-cors.sh:50`
  - Add `return 0` at end of function that lacks explicit return
  - Ensure all functions have explicit return statements

  **Must NOT do**:
  - Do NOT change function logic
  - Do NOT modify error handling paths

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line addition
  - **Skills**: [`absenta-devops`]
    - `absenta-devops`: Knows shell scripting

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-11, 13-14)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - SonarQube issue list — test-cors.sh location

  **Acceptance Criteria**:
  - [ ] All functions have explicit return statements
  - [ ] Shell script syntax check passes

  **QA Scenarios**:
  ```
  Scenario: Verify shell script function returns
    Tool: Bash
    Preconditions: Bash installed
    Steps:
      1. Run: bash -n scripts/test-cors.sh
      2. Source script: source scripts/test-cors.sh
      3. Call each function, check return value: $?
    Expected Result: All functions return 0 on success
    Failure Indicators: "return: can only be done from a func" errors
    Evidence: .sisyphus/evidence/task-12-return-check.log
  ```

  **Commit**: NO (group with Wave 2)

---

- [ ] 13. Fix shell script literal duplication

  **What to do**:
  - Update `scripts/test-cors.sh:263,267`
  - Define constants for duplicated literals:
    - `'^access-control-allow-origin:'` (4 occurrences) → `ACCESS_CONTROL_HEADER`
    - `'(not set)'` (7 occurrences) → `NOT_SET_VALUE`
  - Replace all occurrences with constant references

  **Must NOT do**:
  - Do NOT change test logic
  - Do NOT modify regex patterns

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple constant extraction
  - **Skills**: [`absenta-devops`]
    - `absenta-devops`: Knows shell scripting

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-12, 14)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - SonarQube issue list — test-cors.sh literal locations

  **Acceptance Criteria**:
  - [ ] All duplicated literals replaced with constants
  - [ ] Script runs correctly

  **QA Scenarios**:
  ```
  Scenario: Verify shell script constants work
    Tool: Bash
    Preconditions: Bash installed
    Steps:
      1. Run: bash scripts/test-cors.sh --help
      2. Verify help displays without errors
      3. Run a simple test case if available
    Expected Result: Script executes without "undefined variable" errors
    Failure Indicators: "unbound variable" errors, script crashes
    Evidence: .sisyphus/evidence/task-13-constant-test.log
  ```

  **Commit**: NO (group with Wave 2)

---

- [ ] 14. Fix Python script literal duplication (review-hotspots.py)

  **What to do**:
  - Update `scripts/review-hotspots.py`
  - Define constants for duplicated literals (from SonarQube):
    - Line 37: `"Safe: form field variable names..."` (3 occurrences)
    - Line 41: `"Safe: variable names referencing password..."` (4 occurrences)
    - Line 45: `"Safe: simple bounded validation regex..."` (7 occurrences)
    - Line 52: `"Safe: simple bounded validation regex for form..."` (7 occurrences)
    - Line 59: `"Safe: COPY . . with .dockerignore..."` (3 occurrences)
    - Line 62: `"Safe: runs behind nginx TLS..."` (3 occurrences)
    - Line 65: `"Safe: Math.random() in seeders..."` (9 occurrences)
    - Line 74: `"Safe: Math.random() for UI..."` (3 occurrences)
    - Line 80: `"Acknowledged: version tags..."` (8 occurrences)
    - Line 89: `"Safe: Hardcoded IPs in test..."` (6 occurrences)
  - Extract to module-level constants or config dict

  **Must NOT do**:
  - Do NOT change analysis logic
  - Do NOT modify regex patterns

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple constant extraction in Python
  - **Skills**: [`absenta-backend`]
    - `absenta-backend`: Knows Python scripting (used in project)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-13)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - SonarQube issue list — review-hotspots.py locations

  **Acceptance Criteria**:
  - [ ] All duplicated literals replaced with constants
  - [ ] `python scripts/review-hotspots.py` runs without errors

  **QA Scenarios**:
  ```
  Scenario: Verify Python script executes
    Tool: Bash
    Preconditions: Python 3 installed
    Steps:
      1. Run: python scripts/review-hotspots.py --help
      2. Check exit code (0 = success)
      3. Verify no "undefined name" errors
    Expected Result: Script runs without errors
    Failure Indicators: NameError, SyntaxError, script crashes
    Evidence: .sisyphus/evidence/task-14-python-run.log
  ```

  **Commit**: YES (Wave 2 complete)
  - Message: `refactor(code-quality): wave 2 medium fixes (7 tasks)`
  - Files: `database/*.sql`, `docs-site/**/*.tsx`, `scripts/*.sh`, `scripts/*.py`
  - Pre-commit: `npm run lint && npm test`

---

## Wave 3: High-Effort Refactoring (Tasks 15-21)

> **Note**: These tasks require deep refactoring. Each task preserves existing functionality while reducing cognitive complexity.

- [ ] 15. Decompose seed_dummy_range.js main() (110 → 6 functions)
- [ ] 16. Decompose seed_dummy_full.js seed() (59 → 3 functions)
- [ ] 17. Extract getStudentsForSchedule SQL builder (absensiController)
- [ ] 18. Extract getStudentsForSchedule SQL builder (exportController)
- [ ] 19. Extract submitStudentAttendance batch logic
- [ ] 20. Extract authController login lockout logic
- [ ] 21. Extract authController login role-fetch logic

**Commit**: YES (Wave 3 complete)
- Message: `refactor(code-quality): wave 3 complexity reduction (7 tasks)`
- Files: `database/seeders/*.js`, `server/controllers/*.js`
- Pre-commit: `npm run lint && npm run test:server`

---

## Wave 4: Database Cleanup (Tasks 22-25)

> **Note**: Database changes require careful testing. Run on staging first.

- [ ] 22. Generate migration script for SQL constants
- [ ] 23. Apply migration to absenta13.sql
- [ ] 24. Verify database schema integrity
- [ ] 25. Update seed scripts to use new constants

**Commit**: YES (Wave 4 complete)
- Message: `refactor(code-quality): wave 4 database constants (4 tasks)`
- Files: `database/*.sql`, `database/seeds/*.sql`
- Pre-commit: Manual DB backup required

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `npm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `refactor(code-quality): wave 1 quick wins` — file1.ts, file2.js, npm test
- **Wave 2**: `refactor(code-quality): wave 2 medium fixes` — file3.sql, file4.tsx, npm test
- **Wave 3**: `refactor(code-quality): wave 3 complexity reduction` — file5.js, file6.js, npm test
- **Wave 4**: `refactor(code-quality): wave 4 database constants` — migration.sql, npm test

---

## Success Criteria

### Verification Commands
```bash
npm run lint              # Expected: 0 errors, 0 warnings
npm run build             # Expected: success, no errors
npm test                  # Expected: all tests pass
npx sonarqube-scanner     # Expected: 0 issues (or only accepted)
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Lint passes
- [ ] Build succeeds
- [ ] SonarQube shows 0 new issues
