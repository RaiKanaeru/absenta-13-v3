# SonarQube Code Smells Cleanup v2 — Absenta 13 v3

## TL;DR

> **Quick Summary**: Fix all ~80 SonarQube code smells across database seeders, backend controllers, and frontend components. Includes converting a SQL seed file to JS, fixing a conditional execution bug, reducing function parameters and cognitive complexity, and cleaning up frontend patterns (nested ternaries, object stringification, accessibility, unused code).
> 
> **Deliverables**:
> - 3 database seeder/seed files refactored (params reduced, complexity decomposed, SQL→JS conversion)
> - 3 backend controllers refactored (bug fix, params reduced, complexity decomposed)
> - ~15 frontend components cleaned (code smells eliminated)
> - Zero new SonarQube code smells introduced
> 
> **Estimated Effort**: Medium (~4-5 hours agent time)
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Any Wave 1 task → Wave 2 → Task 12 (build verify) → Final Verification

---

## Context

### Original Request
Fix all ~80 SonarQube code smells reported across the Absenta 13 v3 codebase. Issues range from Critical (cognitive complexity, duplicated literals) to Minor (unused imports, type assertions).

### Interview Summary
**Key Discussions**:
- **SQL seed strategy**: User chose to convert `seed_jam_pelajaran.sql` to a JS seeder file with constants, matching existing seeder patterns
- **Bug treatment**: `importMasterScheduleController.js` L39 conditional execution issue treated as a bug fix, not just a style fix
- **Test strategy**: No automated tests — agent-executed QA only (build verification, lint)
- **Scope**: ALL issues including Minor severity

**Research Findings**:
- `allocateScheduleSlot` has 9 params: `(connection, kelasId, day, slot, mapelIds, guruIds, roomIds, busyTeachers, busyRooms)` → group into context object
- `classifyAttendanceEntries` has 8 params: `(attendanceEntries, existingMap, notes, waktuAbsen, scheduleId, targetDate, guruId, log)` → group into context object
- `parseSettingValue` in importMasterScheduleController has try/catch with unconditional return after it — SonarQube flags "This line will not be executed conditionally; only the first statement will be"
- `checkAllScheduleConflicts` in jadwalController has cognitive complexity 16 (limit 15) — coordinates 3 conflict checks
- seed_dummy_range.js L723 has cognitive complexity 31 (limit 15) — needs major decomposition
- importMasterScheduleController L208 has cognitive complexity 22 (limit 15) — needs decomposition
- Frontend patterns found via code inspection:
  - Nested ternary at `BackupManagementView.tsx:934` — loading ? spinner : empty ? message : content
  - Nested ternary at `PreviewJadwalView.tsx:191-193` — multi-condition filter description with nested template literals
  - Nested ternaries at `LiveSummaryView.tsx:93-97`
  - Object stringification: `AuditLogView.tsx:111-112` already handles it with `typeof value === 'object' ? JSON.stringify(value) : String(value)` in rendering but not in the title attribute
  - Unused `transform` from `useDraggable` in `DragPalette.tsx:34`
  - Missing optional chaining: `ManageStudentDataView.tsx:218-220` uses `student.nama && student.nama.toLowerCase()` pattern
  - `ScheduleGridTable.tsx:130-134` has 5 unused interface props (kelas, rowType, rowIdx, day, slot) in `ScheduleCellRenderParams`
  - `ScheduleGridEditor.tsx:553` uses `role="button"` on `<td>` — should use proper `<button>` element
  - `ScheduleGridEditor.tsx:670` and `ScheduleGridTable.tsx:1052` use `role="menu"` div without `tabIndex`
  - `StudentDashboard.tsx:699` already properly destructures useState as `[, setSiswaStatusData]`
  - `StudentDashboard.tsx:727` `jadwalData` assigned via useMemo but flagged as unused assignment
  - `StudentDashboard.tsx:735` `siswaInfo` assigned via useState but flagged as unused
  - `AttendanceView.tsx:56` `setMaxDate` is unused setter
  - `StudentPromotionView.tsx:4` unused import of `Input`
  - `StudentDashboardComponents.tsx:8` unused import of `getErrorMessage`
  - `StudentDashboardComponents.tsx:13` re-export style should use `export...from`

---

## Work Objectives

### Core Objective
Eliminate all ~80 SonarQube code smells to achieve a clean SonarQube dashboard for Absenta 13 v3, improving maintainability and code quality.

### Concrete Deliverables
- Refactored database seeders (2 JS files + 1 new JS seeder replacing SQL)
- Refactored backend controllers (3 files)
- Cleaned frontend components (~15 files)

### Definition of Done
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes (or existing lint issues don't increase)
- [ ] All previously reported SonarQube issues are resolved
- [ ] No new SonarQube code smells introduced
- [ ] Application still starts and functions (verified via agent QA)

### Must Have
- All Critical issues resolved (cognitive complexity, duplicated literals)
- All Major issues resolved (too many params, nested ternaries, missing optional chaining, unused assignments, accessibility)
- All Minor issues resolved (unused imports/props, type assertions, re-export style, object stringification)
- Bug fix for importMasterScheduleController.js L39 conditional execution

### Must NOT Have (Guardrails)
- **NO UI/UX changes** — visual appearance must remain identical
- **NO behavior changes** except the L39 bug fix — all refactors must be behavior-preserving
- **NO new dependencies** — use existing libraries only
- **NO touching Shadcn UI components** in `src/components/ui/*`
- **NO architectural changes** — file structure stays the same (except new JS seed file)
- **NO over-abstraction** — keep refactors minimal and focused on the specific SonarQube issue
- **NO modifying database schema** — only seed data handling changes
- **NO deleting the SQL seed file** — keep it as reference, add JS seeder alongside

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest + node --test)
- **Automated tests**: None (user chose no tests for code smell fixes)
- **Agent QA**: Every task verified via build check + TypeScript check + specific pattern grep

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Backend JS**: Use Bash — `node -e "import('./path')"` to verify module loads
- **Frontend TSX**: Use Bash — `npx tsc --noEmit` to verify TypeScript compiles
- **All**: Use Bash — grep for removed/fixed patterns, `npm run build`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — independent file-level fixes, MAX PARALLEL):
├── Task 1: Convert seed_jam_pelajaran.sql to JS seeder [unspecified-high]
├── Task 2: Fix importMasterScheduleController.js (bug + complexity) [deep]
├── Task 3: Reduce allocateScheduleSlot params in seed_dummy_full.js [quick]
├── Task 4: Reduce seed_dummy_range.js cognitive complexity [deep]
├── Task 5: Reduce classifyAttendanceEntries params in absensiController.js [quick]
├── Task 6: Reduce jadwalController.js cognitive complexity [quick]
└── Task 7: Frontend batch A — Report views object stringification (~8 files) [quick]

Wave 2 (After Wave 1 — more frontend, MAX PARALLEL):
├── Task 8: Frontend batch B — Schedule components (ternaries, a11y, props) [unspecified-high]
├── Task 9: Frontend batch C — Student/Teacher data views (optional chaining, unused) [quick]
├── Task 10: Frontend batch D — Dashboard + Backup + Attendance views [quick]
└── Task 11: Frontend batch E — Misc fixes (re-exports, type aliases, minor) [quick]

Wave 3 (After Wave 2 — build verification):
└── Task 12: Full build + TypeScript + lint verification [quick]

Wave FINAL (After ALL tasks — 4 parallel review agents):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Full build + pattern verification (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Any Wave 1 task → Task 12 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 7 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1-7 | None | 12 |
| 8-11 | None | 12 |
| 12 | 1-11 | F1-F4 |
| F1-F4 | 12 | Done |

### Agent Dispatch Summary

- **Wave 1**: **7 tasks** — T1 → `unspecified-high`, T2 → `deep`, T3 → `quick`, T4 → `deep`, T5 → `quick`, T6 → `quick`, T7 → `quick`
- **Wave 2**: **4 tasks** — T8 → `unspecified-high`, T9 → `quick`, T10 → `quick`, T11 → `quick`
- **Wave 3**: **1 task** — T12 → `quick`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [ ] 1. Convert seed_jam_pelajaran.sql to JS Seeder

  **What to do**:
  - Create a new file `database/seeders/seed_jam_pelajaran.js` that generates the same data as the SQL file
  - Define constants for repeated literals: `TAHUN_AJARAN = '2025/2026'`, day names (`SENIN`, `SELASA`, etc.), slot types (`pelajaran`, `istirahat`, `pembiasaan`, `piket`)
  - Define a data-driven structure: an array of objects per day, each containing `{ hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label }`
  - Use the existing seeder pattern from `seed_dummy_full.js` — get a DB connection, use `INSERT ... ON DUPLICATE KEY UPDATE`
  - Keep the SQL file as-is for reference (do NOT delete it)
  - The JS seeder must produce byte-identical database state to the SQL file

  **Must NOT do**:
  - Do NOT delete or modify `database/seeds/seed_jam_pelajaran.sql`
  - Do NOT change the database schema
  - Do NOT add any npm dependencies

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Data transformation task requiring careful mapping of SQL to JS while preserving exact semantics
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-7)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `database/seeders/seed_dummy_full.js` — Existing JS seeder pattern: how to get DB connection, execute queries, use async/await
  - `database/seeders/seed_dummy_range.js` — Another seeder pattern showing CONFIG constants and data-driven approach

  **Source Data Reference**:
  - `database/seeds/seed_jam_pelajaran.sql` — The SQL to convert. Contains INSERT statements with columns: `(id, hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label, tahun_ajaran, created_at, updated_at)`. Uses `ON DUPLICATE KEY UPDATE`. Has ~60 rows across 6 days (Senin-Sabtu).

  **SonarQube Issues Addressed**:
  - ~25 "Define a constant instead of duplicating this literal" issues at various lines in `seed_jam_pelajaran.sql`

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: JS seeder file loads without errors
    Tool: Bash
    Preconditions: Node.js available, database/seeders/ directory exists
    Steps:
      1. Run: node -e "import('./database/seeders/seed_jam_pelajaran.js').then(() => console.log('LOAD_OK')).catch(e => console.error('LOAD_FAIL', e.message))"
      2. Assert output contains "LOAD_OK"
    Expected Result: Module loads without syntax or import errors
    Failure Indicators: "LOAD_FAIL", SyntaxError, or import error in output
    Evidence: .sisyphus/evidence/task-1-module-load.txt

  Scenario: Constants defined for previously-duplicated literals
    Tool: Bash (grep)
    Preconditions: database/seeders/seed_jam_pelajaran.js exists
    Steps:
      1. Run: grep -c "'2025/2026'" database/seeders/seed_jam_pelajaran.js
      2. Assert count is 0 or 1 (used only in constant definition)
      3. Run: grep -E "const (TAHUN_AJARAN|DAYS|SLOT_TYPES)" database/seeders/seed_jam_pelajaran.js
      4. Assert constants are defined
    Expected Result: Literal '2025/2026' appears at most once (in const definition), not scattered across data rows
    Failure Indicators: '2025/2026' appears more than 2 times without a constant
    Evidence: .sisyphus/evidence/task-1-constants-check.txt

  Scenario: SQL file is NOT deleted
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: test -f database/seeds/seed_jam_pelajaran.sql && echo "SQL_EXISTS" || echo "SQL_MISSING"
      2. Assert output is "SQL_EXISTS"
    Expected Result: Original SQL file still exists
    Failure Indicators: "SQL_MISSING"
    Evidence: .sisyphus/evidence/task-1-sql-preserved.txt
  ```

  **Commit**: YES
  - Message: `fix(seeds): convert seed_jam_pelajaran.sql to JS seeder with constants`
  - Files: `database/seeders/seed_jam_pelajaran.js`
  - Pre-commit: `node -e "import('./database/seeders/seed_jam_pelajaran.js')"`

- [ ] 2. Fix importMasterScheduleController.js — Bug Fix + Cognitive Complexity

  **What to do**:
  - **BUG FIX at L39**: Fix `parseSettingValue` function. SonarQube says "This line will not be executed conditionally; only the first statement will be." The issue is the try/catch structure where the conditional `if (typeof parsed === 'string') return parsed;` only covers one case, and the final `return raw.replaceAll(/(^")|(""$)/g, '')` executes unconditionally. Restructure to make the logic explicit:
    ```js
    function parseSettingValue(raw) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') return parsed;
        return String(parsed); // Handle non-string JSON values explicitly
      } catch {
        return raw.replaceAll(/(^")|(""$)/g, ''); // Only strip quotes for non-JSON values
      }
    }
    ```
  - **COGNITIVE COMPLEXITY at L208**: Reduce from 22 to ≤15. Identify the high-complexity function at L208 and decompose it by extracting helper functions for distinct logical blocks (e.g., validation, parsing, transformation steps). Use early returns to flatten nested conditions.

  **Must NOT do**:
  - Do NOT change the external API (route handlers, exports)
  - Do NOT modify other controllers
  - Do NOT change error response formats

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Bug fix requires careful analysis of conditional logic, complexity reduction requires understanding control flow
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-7)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `server/controllers/importMasterScheduleController.js:39` — The `parseSettingValue` function with the conditional execution bug
  - `server/controllers/importMasterScheduleController.js:208` — The function with cognitive complexity 22

  **SonarQube Issues Addressed**:
  - L39: "This line will not be executed conditionally; only the first statement will be" (Major, CWE)
  - L208: "Refactor this function to reduce its Cognitive Complexity from 22 to the 15 allowed" (Critical, brain-overload)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Module loads without errors after refactor
    Tool: Bash
    Preconditions: Node.js available
    Steps:
      1. Run: node -e "import('./server/controllers/importMasterScheduleController.js').then(() => console.log('LOAD_OK')).catch(e => console.error('LOAD_FAIL', e.message))"
      2. Assert output contains "LOAD_OK"
    Expected Result: Module loads without errors
    Failure Indicators: "LOAD_FAIL", SyntaxError, or import error
    Evidence: .sisyphus/evidence/task-2-module-load.txt

  Scenario: parseSettingValue no longer has unconditional return after try/catch
    Tool: Bash (grep)
    Preconditions: File has been modified
    Steps:
      1. Read the parseSettingValue function from the file
      2. Verify the return statement is INSIDE the try or catch blocks, not after them
      3. Grep for the function and verify structure
    Expected Result: All return paths are within explicit conditional branches (try/catch)
    Failure Indicators: A return statement exists at the same indentation level after the try/catch closing brace
    Evidence: .sisyphus/evidence/task-2-conditional-fix.txt

  Scenario: Cognitive complexity function is decomposed
    Tool: Bash (grep)
    Preconditions: File has been modified
    Steps:
      1. Count nesting depth in the refactored function at L208 area
      2. Verify new helper functions exist
      3. Run: grep -c "function " server/controllers/importMasterScheduleController.js
      4. Compare with baseline (should have more functions after decomposition)
    Expected Result: The previously-complex function is split into smaller helpers, reducing nesting
    Failure Indicators: Single monolithic function still exists with deep nesting
    Evidence: .sisyphus/evidence/task-2-complexity-reduction.txt
  ```

  **Commit**: YES
  - Message: `fix(controllers): fix conditional execution bug and reduce complexity in importMasterScheduleController`
  - Files: `server/controllers/importMasterScheduleController.js`
  - Pre-commit: `node -e "import('./server/controllers/importMasterScheduleController.js')"`

- [ ] 3. Reduce allocateScheduleSlot Parameters in seed_dummy_full.js

  **What to do**:
  - Refactor `allocateScheduleSlot` from 9 parameters to ≤7 by introducing a context object
  - Current signature: `async function allocateScheduleSlot(connection, kelasId, day, slot, mapelIds, guruIds, roomIds, busyTeachers, busyRooms)`
  - New signature: `async function allocateScheduleSlot(connection, kelasId, day, slot, dataLists, trackers)` where:
    - `dataLists = { mapelIds, guruIds, roomIds }` — data arrays
    - `trackers = { busyTeachers, busyRooms }` — conflict tracking maps
  - Update ALL call sites of this function within the same file to pass the new grouped objects
  - Verify internal usage of the parameters still works after regrouping

  **Must NOT do**:
  - Do NOT change the scheduling logic or algorithm
  - Do NOT change what data gets inserted into the database
  - Do NOT modify other files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward parameter grouping with find-and-replace at call sites
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-2, 4-7)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `database/seeders/seed_dummy_full.js:405` — The `allocateScheduleSlot` function definition with 9 params
  - Search for `allocateScheduleSlot(` in the same file to find all call sites

  **SonarQube Issues Addressed**:
  - L405: "Async function 'allocateScheduleSlot' has too many parameters (9). Maximum allowed is 7." (Major, brain-overload)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Function signature has ≤7 parameters
    Tool: Bash (grep)
    Preconditions: File has been modified
    Steps:
      1. Run: grep -A1 "async function allocateScheduleSlot" database/seeders/seed_dummy_full.js
      2. Count parameters in the signature (comma-separated args)
      3. Assert count ≤ 7
    Expected Result: Function has 6 parameters: (connection, kelasId, day, slot, dataLists, trackers)
    Failure Indicators: More than 7 comma-separated parameters in the signature
    Evidence: .sisyphus/evidence/task-3-param-count.txt

  Scenario: Module still loads correctly
    Tool: Bash
    Preconditions: Node.js available
    Steps:
      1. Run: node -e "import('./database/seeders/seed_dummy_full.js').then(() => console.log('LOAD_OK')).catch(e => console.error('LOAD_FAIL', e.message))"
      2. Assert output contains "LOAD_OK"
    Expected Result: No syntax errors after refactoring
    Failure Indicators: "LOAD_FAIL" or any error
    Evidence: .sisyphus/evidence/task-3-module-load.txt
  ```

  **Commit**: YES
  - Message: `refactor(seeds): reduce allocateScheduleSlot params via context object`
  - Files: `database/seeders/seed_dummy_full.js`
  - Pre-commit: `node -e "import('./database/seeders/seed_dummy_full.js')"`

- [ ] 4. Reduce seed_dummy_range.js Cognitive Complexity (31 → ≤15)

  **What to do**:
  - Identify the function at L723 with cognitive complexity 31 and decompose it
  - Extract logical blocks into named helper functions. Likely candidates:
    - Date/time calculation logic → `calculateDateRange()`
    - Loop body for generating per-student entries → `generateStudentAttendance()`
    - Status determination logic → `determineAttendanceStatus()`
    - Nested conditionals → flatten with early returns or guard clauses
  - Ensure each extracted function has a clear, descriptive name and single responsibility
  - The overall behavior must remain identical — same data generated, same DB operations

  **Must NOT do**:
  - Do NOT change what data gets seeded
  - Do NOT change the function's external interface (if it's exported/called elsewhere)
  - Do NOT modify other files

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complexity 31→15 is a major decomposition requiring understanding of control flow and data dependencies
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-7)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `database/seeders/seed_dummy_range.js:723` — The function with cognitive complexity 31
  - `database/seeders/seed_dummy_full.js` — Reference for seeder helper function patterns

  **SonarQube Issues Addressed**:
  - L723: "Refactor this function to reduce its Cognitive Complexity from 31 to the 15 allowed" (Critical, brain-overload)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Module loads without errors after decomposition
    Tool: Bash
    Preconditions: Node.js available
    Steps:
      1. Run: node -e "import('./database/seeders/seed_dummy_range.js').then(() => console.log('LOAD_OK')).catch(e => console.error('LOAD_FAIL', e.message))"
      2. Assert output contains "LOAD_OK"
    Expected Result: Module loads successfully
    Failure Indicators: "LOAD_FAIL", SyntaxError
    Evidence: .sisyphus/evidence/task-4-module-load.txt

  Scenario: Function is decomposed into smaller helpers
    Tool: Bash (grep)
    Preconditions: File has been modified
    Steps:
      1. Run: grep -c "function " database/seeders/seed_dummy_range.js (count total functions)
      2. Compare with original count — should increase by 2-4 new helper functions
      3. Verify the original function now calls these helpers
    Expected Result: The complex function is split into 3-5 smaller functions, each with clear names
    Failure Indicators: Original function still has deep nesting (4+ levels) or same line count
    Evidence: .sisyphus/evidence/task-4-decomposition.txt
  ```

  **Commit**: YES
  - Message: `refactor(seeds): decompose seed_dummy_range to reduce cognitive complexity`
  - Files: `database/seeders/seed_dummy_range.js`
  - Pre-commit: `node -e "import('./database/seeders/seed_dummy_range.js')"`

- [ ] 5. Reduce classifyAttendanceEntries Parameters in absensiController.js

  **What to do**:
  - Refactor `classifyAttendanceEntries` from 8 parameters to ≤7 by introducing a context object
  - Current signature: `function classifyAttendanceEntries(attendanceEntries, existingMap, notes, waktuAbsen, scheduleId, targetDate, guruId, log)`
  - New signature: `function classifyAttendanceEntries(attendanceEntries, existingMap, context)` where:
    - `context = { notes, waktuAbsen, scheduleId, targetDate, guruId, log }` — groups the contextual metadata
  - Update ALL call sites of this function within the file to pass the context object
  - Inside the function, destructure: `const { notes, waktuAbsen, scheduleId, targetDate, guruId, log } = context;`

  **Must NOT do**:
  - Do NOT change attendance classification logic
  - Do NOT change the return value structure `{ updates, inserts, processedStudents }`
  - Do NOT modify other controllers

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward parameter grouping, same pattern as Task 3
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6-7)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `server/controllers/absensiController.js:599` — The function definition with 8 params
  - Search for `classifyAttendanceEntries(` in the file to find call sites

  **SonarQube Issues Addressed**:
  - L599: "Function 'classifyAttendanceEntries' has too many parameters (8). Maximum allowed is 7." (Major, brain-overload)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Function signature has ≤7 parameters
    Tool: Bash (grep)
    Preconditions: File has been modified
    Steps:
      1. Run: grep -A1 "function classifyAttendanceEntries" server/controllers/absensiController.js
      2. Count parameters — should be 3 (attendanceEntries, existingMap, context)
    Expected Result: Function has 3 parameters after grouping
    Failure Indicators: More than 7 parameters in signature
    Evidence: .sisyphus/evidence/task-5-param-count.txt

  Scenario: Module loads without errors
    Tool: Bash
    Preconditions: Node.js available
    Steps:
      1. Run: node -e "import('./server/controllers/absensiController.js').then(() => console.log('LOAD_OK')).catch(e => console.error('LOAD_FAIL', e.message))"
    Expected Result: "LOAD_OK"
    Failure Indicators: "LOAD_FAIL"
    Evidence: .sisyphus/evidence/task-5-module-load.txt
  ```

  **Commit**: YES (groups with Task 6)
  - Message: `refactor(controllers): reduce classifyAttendanceEntries params and jadwalController complexity`
  - Files: `server/controllers/absensiController.js`, `server/controllers/jadwalController.js`

- [ ] 6. Reduce jadwalController.js Cognitive Complexity (16 → ≤15)

  **What to do**:
  - The function `checkAllScheduleConflicts` at L269 has cognitive complexity 16 (limit is 15)
  - This is a minor reduction (16→15). Likely fix: extract one nested conditional into a helper function, or use early returns to flatten one level of nesting
  - The function coordinates 3 conflict checks (guru, room, class). Consider extracting the conflict aggregation logic into a small helper
  - Alternatively, convert a nested `if-else` into an early return pattern

  **Must NOT do**:
  - Do NOT change conflict detection logic
  - Do NOT change the return value structure
  - Do NOT modify other controllers

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Minor complexity reduction (16→15), likely a single early-return refactor
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5, 7)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `server/controllers/jadwalController.js:269` — The `checkAllScheduleConflicts` function with complexity 16

  **SonarQube Issues Addressed**:
  - L269: "Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed" (Critical, brain-overload)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Module loads without errors
    Tool: Bash
    Preconditions: Node.js available
    Steps:
      1. Run: node -e "import('./server/controllers/jadwalController.js').then(() => console.log('LOAD_OK')).catch(e => console.error('LOAD_FAIL', e.message))"
    Expected Result: "LOAD_OK"
    Failure Indicators: "LOAD_FAIL"
    Evidence: .sisyphus/evidence/task-6-module-load.txt

  Scenario: Nesting reduced in checkAllScheduleConflicts
    Tool: Bash (grep)
    Preconditions: File has been modified
    Steps:
      1. Read the checkAllScheduleConflicts function
      2. Verify maximum nesting depth is reduced (fewer nested if/for/while blocks)
      3. Check for extracted helper functions or early returns
    Expected Result: Function has reduced nesting, possibly with a new helper function
    Failure Indicators: Same nesting depth as original
    Evidence: .sisyphus/evidence/task-6-complexity.txt
  ```

  **Commit**: YES (groups with Task 5)
  - Message: `refactor(controllers): reduce classifyAttendanceEntries params and jadwalController complexity`
  - Files: `server/controllers/jadwalController.js`

- [ ] 7. Frontend Batch A — Report Views Object Stringification Fixes

  **What to do**:
  Fix all `'value' will use Object's default stringification format ('[object Object]')` issues across report view files. The fix pattern is: when interpolating a value into a string (template literal, JSX text, or string concatenation), ensure objects are properly stringified.

  **Fix pattern**: Where `value` or `error` is used in string context, wrap with:
  - `typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)` for display
  - Or use `String(value)` if the value should never be an object
  - Or use `error instanceof Error ? error.message : String(error)` for error objects

  **Files and lines to fix**:
  1. `src/components/admin/reports/AnalyticsDashboardView.tsx:79` — `error` in string context
  2. `src/components/admin/reports/AnalyticsDashboardView.tsx:89` — remove unused `handlePermissionRequest` assignment
  3. `src/components/admin/reports/AnalyticsDashboardView.tsx:111` — empty catch handler (add `console.error(e)` or proper error handling)
  4. `src/components/admin/reports/AttendanceTrendChart.tsx:86` — `err` in string context
  5. `src/components/admin/reports/BandingAbsenReportView.tsx:81,114` — `error` in string context (2 instances)
  6. `src/components/admin/reports/LiveStudentAttendanceView.tsx:341,397,417` — `error`/`value` in string context (3 instances)
  7. `src/components/admin/reports/LiveTeacherAttendanceView.tsx:328,386,407` — `error`/`value` in string context (3 instances)
  8. `src/components/admin/reports/ReportsView.tsx:73` — `error` in string context
  9. `src/components/admin/schedules/ScheduleGridTable.tsx:515` — `error` in string context
  10. `src/components/admin/students/ManageStudentsView.tsx:190` — `errorDetails` in string context
  11. `src/components/admin/teachers/ManageTeacherAccountsView.tsx:205` — `errorDetails` in string context

  **Must NOT do**:
  - Do NOT change UI layout or visual output
  - Do NOT change error handling flow
  - Do NOT add try/catch where none exists

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Repetitive mechanical fixes across files — same pattern applied everywhere
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-6)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/AuditLogView.tsx:111-112` — ALREADY CORRECT pattern: `typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)` — use this as the reference pattern for fixing other files

  **SonarQube Issues Addressed**:
  - ~15 instances of "'value/error/errorDetails' will use Object's default stringification format ('[object Object]')" (Minor)
  - 1 instance of unused assignment (Major) — `handlePermissionRequest` at AnalyticsDashboardView.tsx:89
  - 1 instance of empty catch handler (Minor) — AnalyticsDashboardView.tsx:111

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: No remaining [object Object] risk patterns in report views
    Tool: Bash (grep)
    Preconditions: All 11 files modified
    Steps:
      1. For each modified file, grep for template literal interpolation patterns
      2. Verify that any `error` or `value` variable used in string context is wrapped with proper stringification
      3. Run: npx tsc --noEmit to verify TypeScript compiles
    Expected Result: All object stringification risks resolved, TypeScript still compiles
    Failure Indicators: TypeScript errors or remaining raw object interpolation
    Evidence: .sisyphus/evidence/task-7-stringification.txt

  Scenario: Frontend builds successfully
    Tool: Bash
    Preconditions: All files modified
    Steps:
      1. Run: npm run build
      2. Assert exit code 0
    Expected Result: Build succeeds
    Failure Indicators: Build fails with errors in modified files
    Evidence: .sisyphus/evidence/task-7-build.txt
  ```

  **Commit**: YES
  - Message: `fix(frontend): resolve object stringification and error handling in report views`
  - Files: All 11 files listed above

- [ ] 8. Frontend Batch B — Schedule Components (Ternaries, Accessibility, Unused Props)

  **What to do**:
  Fix code smells in schedule-related components. This batch covers 4 files with various issues:

  **ScheduleGridEditor.tsx** (5 issues):
  - L553: Replace `role="button"` on `<td>` element. The `<td>` already has `onClick`, `tabIndex={0}`, and `onKeyDown` handlers, so it already IS acting as a button. Change `role="button"` to use semantic markup OR keep the `<td>` and add `aria-label` for accessibility. Since this is a schedule grid cell, keeping `<td>` with proper ARIA attributes is preferable to changing the DOM structure.
  - L670: Add `tabIndex={0}` to the `<div role="menu">` element so it's focusable
  - L78: Mark component props as `Readonly<Props>` (if not already)

  **ScheduleGridTable.tsx** (9 issues):
  - L130-134: Remove unused props `kelas`, `rowType`, `rowIdx`, `day`, `slot` from `ScheduleCellRenderParams` interface. Check if these are used anywhere first — if NOT used, remove from the interface.
  - L160: Mark component props as `Readonly<Props>`
  - L213: Mark component props as `Readonly<Props>`
  - L515: Fix `error` object stringification (same pattern as Task 7)
  - L1052: Add `tabIndex={0}` to the `<div role="menu">` element

  **PreviewJadwalView.tsx** (6 issues):
  - L57: Use optional chaining — `shouldShowMultiGuru` function already uses `guruList && guruList.includes('||')` which is fine since it's a type guard, but check if SonarQube specifically flags it
  - L104: Replace `parentNode.removeChild(childNode)` with `childNode.remove()`
  - L191-193: Extract nested ternary into helper variable or function. Current code builds `emptyDescription` with nested ternary + nested template literal. Extract into a dedicated `getEmptyDescription(schedules, filter)` function.
  - L579: Fix negated condition — invert the `if (!condition)` to `if (condition)` and swap branches

  **GuruAvailabilityView.tsx** (3 issues):
  - L53: Remove unnecessary type assertion (e.g., `as SomeType` where the value is already that type)
  - L57: Remove unnecessary type assertion
  - L201: Refactor code to not nest functions more than 4 levels deep — extract inner function(s)

  **Must NOT do**:
  - Do NOT change the visual appearance of the schedule grid
  - Do NOT change drag-and-drop functionality
  - Do NOT remove functional props (only remove props that are defined but never used)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple diverse fix types across 4 complex components — requires careful per-file analysis
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-11)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/schedules/ScheduleGridEditor.tsx:548-562` — The `<td>` with `role="button"`, `onClick`, `tabIndex`, `onKeyDown`
  - `src/components/admin/schedules/ScheduleGridEditor.tsx:668-678` — Context menu `<div role="menu">` without tabIndex
  - `src/components/admin/schedules/ScheduleGridTable.tsx:125-135` — `ScheduleCellRenderParams` interface with unused props
  - `src/components/admin/schedules/ScheduleGridTable.tsx:1050-1059` — Another context menu `<div role="menu">`
  - `src/components/admin/schedules/PreviewJadwalView.tsx:186-200` — Nested ternary building `emptyDescription`
  - `src/components/admin/schedules/GuruAvailabilityView.tsx:53,57` — Unnecessary type assertions
  - `src/components/admin/schedules/GuruAvailabilityView.tsx:201` — Deep nesting (>4 levels)

  **SonarQube Issues Addressed**:
  - L553 ScheduleGridEditor: "Use `<button>` instead of the 'button' role" (Major, accessibility)
  - L670 ScheduleGridEditor: "Elements with 'menu' role must be focusable" (Major, accessibility)
  - L78 ScheduleGridEditor: "Mark props as read-only" (Minor)
  - L130-134 ScheduleGridTable: 5x "PropType is defined but prop is never used" (Minor)
  - L160,213 ScheduleGridTable: "Mark props as read-only" (Minor)
  - L515 ScheduleGridTable: Object stringification (Minor)
  - L1052 ScheduleGridTable: "Elements with 'menu' role must be focusable" (Major, accessibility)
  - L57 PreviewJadwalView: Optional chaining (Major)
  - L104 PreviewJadwalView: "Prefer childNode.remove()" (Major)
  - L191-193 PreviewJadwalView: Nested ternary + nested template literal (Major, 4 issues)
  - L579 PreviewJadwalView: Negated condition (Minor)
  - L53,57 GuruAvailabilityView: Unnecessary assertions (Minor)
  - L201 GuruAvailabilityView: Nesting depth >4 (Critical)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All 4 schedule component files compile
    Tool: Bash
    Preconditions: All 4 files modified
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert no new TypeScript errors in these 4 files
    Expected Result: TypeScript compilation succeeds
    Failure Indicators: TypeScript errors in ScheduleGridEditor, ScheduleGridTable, PreviewJadwalView, or GuruAvailabilityView
    Evidence: .sisyphus/evidence/task-8-tsc.txt

  Scenario: Accessibility attributes are correct
    Tool: Bash (grep)
    Preconditions: Files modified
    Steps:
      1. Grep for `role="menu"` in ScheduleGridEditor.tsx and ScheduleGridTable.tsx
      2. Verify each has `tabIndex={0}` on the same element
      3. Grep for `role="button"` in ScheduleGridEditor.tsx — should be gone or replaced
    Expected Result: All menu roles have tabIndex, button role issue resolved
    Failure Indicators: `role="menu"` without tabIndex, or `role="button"` on `<td>`
    Evidence: .sisyphus/evidence/task-8-a11y.txt

  Scenario: No nested ternaries remain in PreviewJadwalView
    Tool: Bash (grep)
    Preconditions: File modified
    Steps:
      1. Search for the pattern `? ... ? ...` (nested ternary) in PreviewJadwalView.tsx
      2. Verify the emptyDescription logic uses a helper function or if/else instead
    Expected Result: No nested ternary in the emptyDescription computation
    Failure Indicators: Nested `?` operators on same assignment
    Evidence: .sisyphus/evidence/task-8-ternary.txt
  ```

  **Commit**: YES
  - Message: `fix(frontend): fix schedule component a11y, nested ternaries, and unused props`
  - Files: `src/components/admin/schedules/ScheduleGridEditor.tsx`, `src/components/admin/schedules/ScheduleGridTable.tsx`, `src/components/admin/schedules/PreviewJadwalView.tsx`, `src/components/admin/schedules/GuruAvailabilityView.tsx`

- [ ] 9. Frontend Batch C — Student/Teacher Data Views (Optional Chaining, Unused Code)

  **What to do**:
  Fix code smells in student and teacher management views:

  **ManageStudentDataView.tsx** (3 issues):
  - L218-220: Replace `student.nama && student.nama.toLowerCase()` pattern with optional chaining: `student.nama?.toLowerCase()`. Apply to all 3 lines (nama, nis, nama_kelas).

  **ManageTeacherDataView.tsx** (4 issues):
  - L54: Replace inline union type with a type alias. E.g., `type TeacherStatus = 'aktif' | 'nonaktif';`
  - L187-189: Replace `x && x.method()` with optional chaining `x?.method()` (3 instances)

  **ManageTeacherAccountsView.tsx** (3 issues):
  - L205: Fix `errorDetails` object stringification (same pattern as Task 7)
  - L278: Remove unnecessary type assertion `as SomeType` where type is already known
  - L280: Remove unnecessary type assertion

  **StudentPromotionView.tsx** (2 issues):
  - L4: Remove unused import of `Input` from `@/components/ui/input`
  - L280: Replace `x && x.method()` with optional chaining `x?.method()`

  **ManageStudentsView.tsx** (1 issue):
  - L190: Fix `errorDetails` object stringification

  **DragPalette.tsx** (3 issues):
  - L34: Remove unused `transform` from `useDraggable` destructuring — change `{ attributes, listeners, setNodeRef, transform, isDragging }` to `{ attributes, listeners, setNodeRef, isDragging }`
  - L99: Replace `t.nip && t.nip.includes(term)` with `t.nip?.includes(term)`
  - L110: Replace `s.kode_mapel && s.kode_mapel.toLowerCase().includes(term)` with `s.kode_mapel?.toLowerCase().includes(term)`

  **Must NOT do**:
  - Do NOT change filtering/search logic behavior
  - Do NOT change data display or table layouts
  - Do NOT modify UI components

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical fixes — optional chaining, remove unused imports/vars, stringification
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 10-11)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/students/ManageStudentDataView.tsx:215-222` — `student.nama && student.nama.toLowerCase().includes(searchLower)` pattern
  - `src/components/admin/schedules/DragPalette.tsx:34` — `const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({...})`
  - `src/components/admin/schedules/DragPalette.tsx:93-113` — Filter patterns with `&&` instead of `?.`
  - `src/components/admin/students/StudentPromotionView.tsx:4` — `import { Input } from "@/components/ui/input"` (unused)

  **SonarQube Issues Addressed**:
  - L218-220 ManageStudentDataView: 3x "Prefer optional chain expression" (Major)
  - L54 ManageTeacherDataView: "Replace union type with type alias" (Minor)
  - L187-189 ManageTeacherDataView: 3x "Prefer optional chain expression" (Major)
  - L205 ManageTeacherAccountsView: Object stringification (Minor)
  - L278,280 ManageTeacherAccountsView: 2x Unnecessary type assertion (Minor)
  - L540 ManageTeacherAccountsView: Nested ternary (Major)
  - L4 StudentPromotionView: Unused import (Minor)
  - L280 StudentPromotionView: Optional chaining (Major)
  - L190 ManageStudentsView: Object stringification (Minor)
  - L34 DragPalette: Unused assignment (Major)
  - L99,110 DragPalette: 2x Optional chaining (Major)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All files compile after changes
    Tool: Bash
    Preconditions: All 6 files modified
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert no new TypeScript errors in these files
    Expected Result: TypeScript compilation succeeds
    Failure Indicators: TypeScript errors in any modified file
    Evidence: .sisyphus/evidence/task-9-tsc.txt

  Scenario: Optional chaining applied correctly
    Tool: Bash (grep)
    Preconditions: Files modified
    Steps:
      1. Grep for `student.nama && student.nama.` in ManageStudentDataView.tsx — should be gone
      2. Grep for `student.nama?.` — should exist
      3. Grep for `t.nip && t.nip.` in DragPalette.tsx — should be gone
    Expected Result: All `x && x.method()` patterns replaced with `x?.method()`
    Failure Indicators: Old `&&` chaining pattern still present
    Evidence: .sisyphus/evidence/task-9-optional-chain.txt

  Scenario: Unused import removed
    Tool: Bash (grep)
    Preconditions: StudentPromotionView.tsx modified
    Steps:
      1. Grep for `import { Input }` in StudentPromotionView.tsx — should be gone
      2. Verify no other code references `Input` in the file
    Expected Result: Input import removed
    Failure Indicators: Import still present
    Evidence: .sisyphus/evidence/task-9-unused-import.txt
  ```

  **Commit**: YES
  - Message: `fix(frontend): add optional chaining and remove unused code in student/teacher views`
  - Files: All 6 files listed above

- [ ] 10. Frontend Batch D — Dashboard, Backup, and Attendance Views

  **What to do**:
  Fix code smells in dashboard, backup management, and attendance views:

  **LiveSummaryView.tsx** (3 issues):
  - L93, L95, L97: Extract nested ternary operations into independent statements. These are likely status-based conditional renderings. Extract each into a helper variable or function:
    ```tsx
    // Before:
    {condition1 ? valueA : condition2 ? valueB : valueC}
    // After:
    const displayValue = getDisplayValue(condition1, condition2);
    {displayValue}
    ```

  **BackupManagementView.tsx** (1 issue):
  - L934: Extract nested ternary into independent statement. Current code: `loadingStates.schedules ? spinner : customSchedules.length === 0 ? emptyState : content`. Extract into a helper function:
    ```tsx
    function renderScheduleContent(loading, schedules) {
      if (loading) return <Spinner />;
      if (schedules.length === 0) return <EmptyState />;
      return <ScheduleList />;
    }
    ```

  **StudentDashboard.tsx** (3 issues):
  - L699: `useState` not destructured properly — SonarQube says "useState call is not destructured into value + setter pair". Current code is `const [, setSiswaStatusData] = useState(...)` which IS properly destructured (unused value is valid). Check if the entire useState can be removed if `setSiswaStatusData` is also unused elsewhere.
  - L727: Remove useless assignment to `jadwalData` — if `jadwalData` (a useMemo) is not used in the JSX or elsewhere, remove it entirely
  - L735: Remove useless assignment to `siswaInfo` — if `siswaInfo` state is not read anywhere, remove the useState entirely (keep `setSiswaInfo` if it's called)

  **AttendanceView.tsx** (2 issues):
  - L56: Remove useless `setMaxDate` — change `const [maxDate, setMaxDate] = useState(...)` to `const [maxDate] = useState(...)` since setter is unused
  - L359: Extract nested ternary into independent statement
  - L489: "Do not use Array index in keys" — replace `key={index}` with a stable unique key from the data

  **Must NOT do**:
  - Do NOT change what data is displayed
  - Do NOT change attendance submission logic
  - Do NOT change backup functionality

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical ternary extraction and unused variable cleanup
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-9, 11)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/dashboard/LiveSummaryView.tsx:88-102` — Card layout with summary stats
  - `src/components/BackupManagementView.tsx:930-939` — Nested ternary: loading → empty → content
  - `src/components/StudentDashboard.tsx:693-742` — State declarations area with unused vars
  - `src/components/teacher/AttendanceView.tsx:52-61` — Date state declarations

  **SonarQube Issues Addressed**:
  - L93,95,97 LiveSummaryView: 3x "Extract nested ternary" (Major)
  - L934 BackupManagementView: "Extract nested ternary" (Major)
  - L699 StudentDashboard: "useState not destructured" (Minor)
  - L727 StudentDashboard: "Useless assignment to jadwalData" (Major)
  - L735 StudentDashboard: "Useless assignment to siswaInfo" (Major)
  - L56 AttendanceView: "Useless assignment to setMaxDate" (Major)
  - L359 AttendanceView: "Extract nested ternary" (Major)
  - L489 AttendanceView: "Do not use Array index in keys" (Major)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All files compile after changes
    Tool: Bash
    Preconditions: All 4 files modified
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert no new TypeScript errors
    Expected Result: TypeScript compilation succeeds
    Failure Indicators: TypeScript errors in modified files
    Evidence: .sisyphus/evidence/task-10-tsc.txt

  Scenario: No nested ternaries remain in modified files
    Tool: Bash (grep)
    Preconditions: Files modified
    Steps:
      1. Check LiveSummaryView.tsx lines 90-100 for nested ternary patterns
      2. Check BackupManagementView.tsx around L934 for nested ternary
      3. Verify extracted helper functions or if/else blocks exist instead
    Expected Result: All nested ternaries replaced with explicit logic
    Failure Indicators: Pattern `? ... ? ...` still present in the flagged areas
    Evidence: .sisyphus/evidence/task-10-ternary.txt

  Scenario: Unused variables removed
    Tool: Bash (grep)
    Preconditions: Files modified
    Steps:
      1. Grep for unused `setMaxDate` in AttendanceView.tsx — should be removed from destructuring
      2. Verify jadwalData usage in StudentDashboard.tsx — should be used or removed
    Expected Result: No unused assignments remain
    Failure Indicators: Unused variable still assigned
    Evidence: .sisyphus/evidence/task-10-unused.txt
  ```

  **Commit**: YES
  - Message: `fix(frontend): extract nested ternaries in dashboard and backup views`
  - Files: `src/components/admin/dashboard/LiveSummaryView.tsx`, `src/components/BackupManagementView.tsx`, `src/components/StudentDashboard.tsx`, `src/components/teacher/AttendanceView.tsx`

- [ ] 11. Frontend Batch E — Misc Fixes (Re-exports, Type Aliases, Minor Cleanup)

  **What to do**:
  Fix remaining minor code smells across miscellaneous files:

  **StudentDashboardComponents.tsx** (4 issues):
  - L8: Remove unused import of `getErrorMessage` from `@/lib/utils`
  - L13: Change re-export style from:
    ```tsx
    import type { BandingAbsen, BandingStatusAsli, BandingStatusDiajukan } from './types';
    export type { BandingAbsen, BandingStatusAsli, BandingStatusDiajukan };
    ```
    To:
    ```tsx
    export type { BandingAbsen, BandingStatusAsli, BandingStatusDiajukan } from './types';
    ```
    (3 re-export issues — BandingAbsen, BandingStatusAsli, BandingStatusDiajukan)

  **ManageTeacherAccountsView.tsx** (1 additional issue — if not already covered in T9):
  - L540: Extract nested ternary operation into independent statement

  **Must NOT do**:
  - Do NOT change component behavior
  - Do NOT break existing imports from other files that consume these re-exports

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Trivial mechanical fixes — import cleanup, re-export syntax change
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-10)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/student/StudentDashboardComponents.tsx:1-14` — Import block with unused import and re-export pattern
  - `src/components/admin/teachers/ManageTeacherAccountsView.tsx:540` — Nested ternary

  **SonarQube Issues Addressed**:
  - L8 StudentDashboardComponents: "Remove unused import of 'getErrorMessage'" (Minor)
  - L13 StudentDashboardComponents: 3x "Use export...from to re-export" (Minor, convention)
  - L540 ManageTeacherAccountsView: "Extract nested ternary" (Major)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Files compile and imports still work
    Tool: Bash
    Preconditions: Files modified
    Steps:
      1. Run: npx tsc --noEmit
      2. Verify no import resolution errors
      3. Grep for `getErrorMessage` in StudentDashboardComponents.tsx — should not be imported
    Expected Result: TypeScript compiles, re-exports work
    Failure Indicators: Import errors or TypeScript errors
    Evidence: .sisyphus/evidence/task-11-tsc.txt

  Scenario: Re-export uses correct syntax
    Tool: Bash (grep)
    Preconditions: StudentDashboardComponents.tsx modified
    Steps:
      1. Grep for "export type.*from './types'" in StudentDashboardComponents.tsx
      2. Verify the import-then-re-export pattern is replaced with direct re-export
    Expected Result: `export type { ... } from './types'` syntax used
    Failure Indicators: Separate import + export lines for these types
    Evidence: .sisyphus/evidence/task-11-reexport.txt
  ```

  **Commit**: YES
  - Message: `fix(frontend): cleanup re-exports, type aliases, and minor code smells`
  - Files: `src/components/student/StudentDashboardComponents.tsx`, `src/components/admin/teachers/ManageTeacherAccountsView.tsx`

- [ ] 12. Full Build + TypeScript + Lint Verification

  **What to do**:
  - Run `npm run build` to verify the entire frontend builds
  - Run `npx tsc --noEmit` to verify TypeScript has no new errors
  - Run `npm run lint` to verify no new lint issues
  - Verify all backend JS files load: `node -e "import('./server/controllers/importMasterScheduleController.js'); import('./server/controllers/absensiController.js'); import('./server/controllers/jadwalController.js');"`
  - If any issues found, identify which task introduced them and report

  **Must NOT do**:
  - Do NOT fix any issues — only report them
  - Do NOT modify any files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Run 3-4 commands and report results
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential — depends on all Wave 1+2 tasks)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 1-11

  **References**:
  - `package.json` — Build and lint scripts

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full build succeeds
    Tool: Bash
    Preconditions: All Tasks 1-11 completed
    Steps:
      1. Run: npm run build
      2. Assert exit code 0
      3. Run: npx tsc --noEmit
      4. Assert exit code 0 (or baseline-equivalent errors)
      5. Run: npm run lint
      6. Assert exit code 0 (or no increase from baseline)
    Expected Result: All 3 commands succeed
    Failure Indicators: Any command fails
    Evidence: .sisyphus/evidence/task-12-build.txt

  Scenario: Backend modules load
    Tool: Bash
    Preconditions: Backend files modified
    Steps:
      1. Run: node -e "Promise.all([import('./server/controllers/importMasterScheduleController.js'), import('./server/controllers/absensiController.js'), import('./server/controllers/jadwalController.js')]).then(() => console.log('ALL_OK')).catch(e => console.error('FAIL', e.message))"
      2. Assert "ALL_OK"
    Expected Result: All 3 controllers load without errors
    Failure Indicators: "FAIL" or any error
    Evidence: .sisyphus/evidence/task-12-backend.txt
  ```

  **Commit**: NO (verification only)

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read changed files, check SonarQube patterns removed). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit` + `npm run lint` + `npm run build`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify no NEW SonarQube patterns introduced.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | TypeScript [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Full Build + Pattern Verification** — `unspecified-high`
  Run `npm run build` to verify frontend builds. Run `npm run start:modern` briefly to verify backend starts. Grep all changed files for the specific patterns that were supposed to be fixed (nested ternaries `? ... ? ...`, `[object Object]` risk patterns, unused vars, `role="button"` on non-button elements, `role="menu"` without tabIndex). Verify each pattern is gone.
  Output: `Build [PASS/FAIL] | Backend Start [PASS/FAIL] | Patterns Removed [N/N] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance (no UI changes, no behavior changes except L39 bug fix, no new deps). Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Commit 1**: `fix(seeds): convert seed_jam_pelajaran.sql to JS seeder with constants` — T1
- **Commit 2**: `fix(controllers): fix conditional execution bug and reduce complexity in importMasterScheduleController` — T2
- **Commit 3**: `refactor(seeds): reduce allocateScheduleSlot params via context object` — T3
- **Commit 4**: `refactor(seeds): decompose seed_dummy_range to reduce cognitive complexity` — T4
- **Commit 5**: `refactor(controllers): reduce classifyAttendanceEntries params and jadwalController complexity` — T5+T6
- **Commit 6**: `fix(frontend): resolve object stringification in report views` — T7
- **Commit 7**: `fix(frontend): fix schedule component a11y, nested ternaries, and unused props` — T8
- **Commit 8**: `fix(frontend): add optional chaining and remove unused code in student/teacher views` — T9
- **Commit 9**: `fix(frontend): extract nested ternaries in dashboard and backup views` — T10
- **Commit 10**: `fix(frontend): cleanup re-exports, type aliases, and minor code smells` — T11

---

## Success Criteria

### Verification Commands
```bash
npm run build          # Expected: Build succeeds with zero errors
npx tsc --noEmit       # Expected: Zero TypeScript errors (or no increase)
npm run lint           # Expected: Pass (or no increase in lint errors)
```

### Final Checklist
- [ ] All ~80 SonarQube code smells resolved
- [ ] `npm run build` succeeds
- [ ] No new code smells introduced
- [ ] No UI/UX changes
- [ ] No behavior changes (except L39 bug fix)
- [ ] No new dependencies added
- [ ] Application starts successfully
