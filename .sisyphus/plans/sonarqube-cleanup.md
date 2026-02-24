# SonarQube Code Smell Cleanup — Absenta 13 v3

## TL;DR

> **Quick Summary**: Fix ~63 SonarQube code smell issues across ~25 JS/TS/TSX files through pure refactoring — zero behavior changes. Organized into 7 parallel execution waves by risk level, from zero-risk mechanical fixes to complex cognitive complexity refactoring.
> 
> **Deliverables**:
> - All Critical cognitive complexity issues resolved (9 functions refactored to CC ≤ 15)
> - All Major issues resolved (nested ternaries, unused assignments, inner components, optional chaining)
> - All Minor convention issues resolved (unused imports, Number.parseInt, export...from, etc.)
> - Zero new test failures, zero build errors
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 7 waves
> **Critical Path**: Wave 0 (baseline) → Wave 1 (mechanical) → Wave 2 (ternary/components) → Wave 3 (reports) → Wave 4 (backend CC) → Wave 5 (seeder CC) → Wave FINAL

---

## Context

### Original Request
Fix all ~90 SonarQube code smell issues flagged in the Absenta 13 v3 codebase. These span Critical (cognitive complexity, duplicated literals), Major (nested ternaries, unused assignments, inner components), and Minor (convention, unused imports, error handling) severity levels.

### Interview Summary
**Key Discussions**:
- Fix ALL issues (Critical + Major + Minor) — user chose comprehensive cleanup
- SKIP SQL files (absenta13.sql, seed_jam_pelajaran.sql) — literal duplication in SQL is natural, mark as won't-fix
- Pure refactoring only — preserve exact existing behavior for all cognitive complexity refactors
- Refactoring strategy: extract helper functions, reduce nesting via early returns, no structural redesigns

**Research Findings**:
- Backend controllers have 7 functions with CC 16-71. Decomposition plans identified specific helpers to extract for each.
- Seeder files (CC:59, CC:110) can be decomposed into shared utilities + per-file helpers, with common patterns between files.
- Frontend inner components (6 total in LiveStudent/TeacherAttendanceView) can safely be extracted — no parent scope dependencies.
- Nested ternaries express badge/status styling — extract to descriptively-named helper functions.
- Some StudentDashboard.tsx state assignments appear unused but need `lsp_find_references` verification before removal.

### Metis Review
**Identified Gaps** (addressed):
- Per-wave build/test verification mandatory — added to each wave
- `lsp_find_references` required before removing any variable/import to confirm unused
- Object stringification fixes need per-site inspection — cannot blindly add `.toString()`
- Auth controller CC refactor is highest risk — extract minimum code necessary
- Must NOT touch `src/components/ui/*` files per AGENTS.md
- Must NOT add new dependencies not already in the project
- Must NOT refactor beyond what SonarQube flagged

---

## Work Objectives

### Core Objective
Eliminate all ~63 SonarQube code smell issues in JS/TS/TSX files through pure syntax and structure refactoring, preserving exact existing behavior.

### Concrete Deliverables
- 9 functions refactored to CC ≤ 15 (from CC 16-110)
- 8 nested ternary operations extracted to helper functions
- 6 inner components moved outside parent functions
- 7 unused assignments removed
- 12 object stringification issues fixed
- ~20 convention/minor issues fixed
- All existing tests still passing

### Definition of Done
- [x] `npm run build` exits with code 0
- [x] `npm test` shows same pass count as baseline (no regressions)
- [x] `npm run lint` shows no new errors vs baseline
- [ ] SonarQube rescan shows 0 open code smell issues (excluding SQL won't-fix)

### Must Have
- Every fix is a pure refactoring — no behavior changes
- Per-wave verification (build + test) after each wave
- `lsp_find_references` check before removing any variable/import
- Exact same return values for all ternary refactors

### Must NOT Have (Guardrails)
- NO touching files in `src/components/ui/*` — per AGENTS.md UI Freeze
- NO touching SQL files (`database/*.sql`, `database/seeds/*.sql`)
- NO changing any logic, API contracts, or user-visible behavior
- NO adding new dependencies or utility files not already in the project
- NO refactoring beyond what SonarQube flagged (no "while we're here" improvements)
- NO reformatting surrounding code — follow existing code style in each file
- NO restructuring entire functions for CC fixes — extract minimum necessary helpers

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest for frontend, Node.js test runner for backend)
- **Automated tests**: Tests-after (run existing test suites to verify no regressions)
- **Framework**: vitest (frontend), node --test (backend)
- **Strategy**: Each wave runs `npm run build && npm test` after completion

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Backend JS**: Use Bash — `npm run build`, `npm test`, verify no new lint errors
- **Frontend TSX**: Use Bash — `npm run build` (TypeScript compilation catches type errors)
- **All tasks**: Before removing any variable/import, use `lsp_find_references` to confirm unused

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (Sequential — baseline capture):
└── Task 1: Capture build/lint/test baseline [quick]

Wave 1 (After Wave 0 — zero-risk mechanical fixes, 7 PARALLEL):
├── Task 2: BackupManagementView mechanical fixes [quick]
├── Task 3: SimpleRestoreView cleanup [quick]
├── Task 4: StudentDashboard unused assignments [quick]
├── Task 5: EditProfile + ExcelPreview cleanup [quick]
├── Task 6: globalErrorMiddleware re-export [quick]
├── Task 7: importMasterScheduleController minor fixes [quick]
└── Task 8: Unused imports cleanup (3 files) [quick]

Wave 2 (After Wave 1 — ternary + component extraction, 6 PARALLEL):
├── Task 9: BackupManagementView nested ternaries [quick]
├── Task 10: AuditLogView full cleanup (8 issues) [unspecified-high]
├── Task 11: LiveSummaryView nested ternaries [quick]
├── Task 12: BandingAbsenManager nested ternary [quick]
├── Task 13: LiveStudentAttendanceView components + stringification [unspecified-high]
└── Task 14: LiveTeacherAttendanceView components + stringification [unspecified-high]

Wave 3 (After Wave 2 — report views, 4 PARALLEL):
├── Task 15: AnalyticsDashboardView full cleanup [quick]
├── Task 16: AttendanceTrendChart + BandingAbsenReportView [quick]
├── Task 17: ReportsView + TeacherAttendanceSummaryView [quick]
└── Task 18: LiveStudent/TeacherAttendanceView remaining [quick]

Wave 4 (After Wave 3 — backend CC refactoring, 5 PARALLEL):
├── Task 19: absensiController CC:21→≤15 [unspecified-high]
├── Task 20: authController CC:16→≤15 [unspecified-high]
├── Task 21: importMasterScheduleController CC:71→≤15 [deep]
├── Task 22: jadwalController 3 functions CC refactor [deep]
└── Task 23: sqlParser CC:26→≤15 [unspecified-high]

Wave 5 (After Wave 4 — seeder CC refactoring, 2 PARALLEL):
├── Task 24: seed_dummy_full.js CC:59→≤15 [deep]
└── Task 25: seed_dummy_range.js CC:110→≤15 [deep]

Wave FINAL (After ALL — 4 PARALLEL review agents):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
├── Task F3: Real manual QA [unspecified-high]
└── Task F4: Scope fidelity check [deep]

Critical Path: T1 → T2-8 → T9-14 → T15-18 → T19-23 → T24-25 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 7 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2-8 | 0 |
| 2-8 | 1 | 9-14 | 1 |
| 9-14 | 2-8 | 15-18 | 2 |
| 15-18 | 9-14 | 19-23 | 3 |
| 19-23 | 15-18 | 24-25 | 4 |
| 24-25 | 19-23 | F1-F4 | 5 |
| F1-F4 | 24-25 | — | FINAL |

### Agent Dispatch Summary

- **Wave 0**: **1** — T1 → `quick`
- **Wave 1**: **7** — T2-T8 → `quick`
- **Wave 2**: **6** — T9,T11,T12 → `quick`; T10,T13,T14 → `unspecified-high`
- **Wave 3**: **4** — T15-T18 → `quick`
- **Wave 4**: **5** — T19-T20 → `unspecified-high`; T21-T22 → `deep`; T23 → `unspecified-high`
- **Wave 5**: **2** — T24-T25 → `deep`
- **FINAL**: **4** — F1 → `oracle`; F2-F3 → `unspecified-high`; F4 → `deep`

---

## TODOs

- [x] 1. Capture Build/Lint/Test Baseline

  **What to do**:
  - Run `npm run build` and capture exit code + output
  - Run `npm run lint` and capture warnings/errors count
  - Run `npm test` and capture pass/fail counts
  - Save all outputs to `.sisyphus/evidence/task-1-baseline.txt`
  - This baseline will be used to verify zero regressions after each wave

  **Must NOT do**:
  - Do NOT edit any files
  - Do NOT install any packages

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 0 (solo)
  - **Blocks**: Tasks 2-8
  - **Blocked By**: None

  **References**:
  - `package.json` — test/build/lint scripts defined here

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Capture baseline metrics
    Tool: Bash
    Preconditions: Clean working directory, dependencies installed
    Steps:
      1. Run `npm run build` — capture exit code
      2. Run `npm run lint 2>&1` — capture output, count errors/warnings
      3. Run `npm test 2>&1` — capture output, count pass/fail
      4. Write all outputs to `.sisyphus/evidence/task-1-baseline.txt`
    Expected Result: File created with build/lint/test baseline data
    Failure Indicators: Any command hangs >5min, file not created
    Evidence: .sisyphus/evidence/task-1-baseline.txt
  ```

  **Commit**: NO

---

- [x] 2. BackupManagementView Mechanical Fixes

  **What to do**:
  - `src/components/BackupManagementView.helpers.ts` L1: Remove unused import of `getErrorMessage`
    - Use `lsp_find_references` first to confirm it's unused
    - Delete the import statement
  - `src/components/BackupManagementView.tsx` L788: Change `parseInt(...)` to `Number.parseInt(...)`
  - `src/components/BackupManagementView.tsx` L806: Change `parseInt(...)` to `Number.parseInt(...)`

  **Must NOT do**:
  - Do NOT change any logic or functionality
  - Do NOT modify surrounding code

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3-8)
  - **Blocks**: Task 9
  - **Blocked By**: Task 1

  **References**:
  - `src/components/BackupManagementView.helpers.ts:1` — unused import location
  - `src/components/BackupManagementView.tsx:788,806` — parseInt locations

  **Acceptance Criteria**:
  - [ ] `getErrorMessage` import removed from helpers.ts
  - [ ] Both `parseInt` → `Number.parseInt` in .tsx

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify unused import removal and parseInt fix
    Tool: Bash
    Preconditions: Task 1 baseline captured
    Steps:
      1. Use lsp_find_references on getErrorMessage to confirm unused
      2. Remove import, change parseInt to Number.parseInt
      3. Run `npm run build` — assert exit code 0
      4. Grep for `getErrorMessage` in helpers.ts — assert 0 matches
      5. Grep for `parseInt(` in BackupManagementView.tsx — assert 0 matches (only Number.parseInt)
    Expected Result: Build passes, no remaining raw parseInt or unused import
    Failure Indicators: Build fails, getErrorMessage still imported
    Evidence: .sisyphus/evidence/task-2-mechanical-fixes.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `refactor: fix minor SonarQube code smells (mechanical fixes)`
  - Files: `src/components/BackupManagementView.helpers.ts`, `src/components/BackupManagementView.tsx`

---

- [x] 3. SimpleRestoreView Cleanup

  **What to do**:
  - `src/components/SimpleRestoreView.tsx` L25: Remove unused `onLogout` from props interface/destructuring
    - Use `lsp_find_references` first to confirm it's not used in the component
  - `src/components/SimpleRestoreView.tsx` L153, L162, L180: Fix empty catch blocks
    - Add `console.error('Operation failed:', error instanceof Error ? error.message : String(error))` or `// intentionally empty` comment depending on context
  - `src/components/SimpleRestoreView.tsx` L585, L592, L593: Remove unnecessary type assertions
    - Remove redundant `as Type` where receiver already accepts the type

  **Must NOT do**:
  - Do NOT change error handling behavior — just ensure catch blocks aren't empty
  - Do NOT change the onLogout prop at call sites — just remove from component definition

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 4-8)
  - **Blocks**: Tasks 9-14
  - **Blocked By**: Task 1

  **References**:
  - `src/components/SimpleRestoreView.tsx:25` — unused onLogout prop
  - `src/components/SimpleRestoreView.tsx:153,162,180` — empty catch blocks
  - `src/components/SimpleRestoreView.tsx:585,592,593` — unnecessary assertions

  **Acceptance Criteria**:
  - [ ] `onLogout` removed from props interface
  - [ ] All 3 empty catch blocks have proper error handling or explicit comment
  - [ ] All 3 unnecessary type assertions removed

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify SimpleRestoreView cleanup
    Tool: Bash
    Preconditions: Task 1 baseline captured
    Steps:
      1. Use lsp_find_references on onLogout prop to confirm unused within component
      2. Apply all fixes
      3. Run `npm run build` — assert exit code 0
      4. Grep for empty catch blocks `catch.*{\\s*}` in file — assert 0 matches
    Expected Result: Build passes, all issues resolved
    Failure Indicators: Build fails, type errors from removing assertions
    Evidence: .sisyphus/evidence/task-3-simplerestore-cleanup.txt

  Scenario: Verify no behavior change in catch blocks
    Tool: Bash
    Preconditions: Fixes applied
    Steps:
      1. Read each catch block — verify error is logged or explicitly commented
      2. Verify no new throw statements added (preserve behavior)
    Expected Result: Catch blocks have content but don't change error flow
    Failure Indicators: New throw statements, behavior-changing code
    Evidence: .sisyphus/evidence/task-3-catch-verification.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Files: `src/components/SimpleRestoreView.tsx`

- [x] 4. StudentDashboard Unused Assignments + useState

  **What to do**:
  - `src/components/StudentDashboard.tsx` L623: Remove useless assignment to `setSiswaId`
    - Use `lsp_find_references` to verify setter is truly unused
  - L624: Remove useless assignment to `setKelasInfo`
    - Use `lsp_find_references` to verify setter is truly unused
  - L727: Remove useless assignment to `jadwalData`
  - L735: Remove useless assignment to `siswaInfo`
  - L743: Remove useless assignment to `riwayatItemsPerPage`
  - L699: Fix useState call that is not destructured into value + setter pair
  - For each: if the variable IS used elsewhere, keep it and only remove the dead assignment. If the entire useState is unused, remove the state entirely.

  **Must NOT do**:
  - Do NOT remove variables that are actually used — verify with `lsp_find_references` first
  - Do NOT change component rendering logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-3, 5-8)
  - **Blocks**: Tasks 9-14
  - **Blocked By**: Task 1

  **References**:
  - `src/components/StudentDashboard.tsx:623-743` — all flagged lines
  - SonarQube rules: S1854 (useless assignment), S6754 (useState destructuring)

  **Acceptance Criteria**:
  - [ ] All confirmed-unused assignments removed
  - [ ] useState properly destructured at L699
  - [ ] Build passes with zero TypeScript errors

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify unused assignment removal
    Tool: Bash
    Preconditions: Task 1 baseline captured
    Steps:
      1. For each flagged variable, run lsp_find_references
      2. Remove only confirmed-unused assignments
      3. Run `npm run build` — assert exit code 0
      4. Run `npm test` — assert same pass count as baseline
    Expected Result: Build + tests pass, dead code removed
    Failure Indicators: Build fails (variable was actually used), test regression
    Evidence: .sisyphus/evidence/task-4-student-dashboard.txt

  Scenario: Verify useState destructuring
    Tool: Bash
    Preconditions: Fix applied
    Steps:
      1. Read line 699 — verify useState is destructured as `const [value, setter] = useState(...)`
      2. Run `npm run build` — assert exit code 0
    Expected Result: Proper destructuring, build passes
    Failure Indicators: TypeScript error from incorrect destructuring
    Evidence: .sisyphus/evidence/task-4-usestate-fix.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Files: `src/components/StudentDashboard.tsx`

---

- [x] 5. EditProfile + ExcelPreview Cleanup

  **What to do**:
  - `src/components/EditProfile.components.tsx` L10: Remove unused `userData` PropType
    - Use `lsp_find_references` to confirm prop is never used
  - `src/components/EditProfile.components.tsx` L23: Remove unused `errors` PropType
    - Use `lsp_find_references` to confirm prop is never used
  - `src/components/ExcelPreview.tsx` L10: Replace inline union type with a type alias
    - Extract the union type at L10 to a named type alias above the component

  **Must NOT do**:
  - Do NOT change component behavior
  - Do NOT modify call sites of these components

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-4, 6-8)
  - **Blocks**: Tasks 9-14
  - **Blocked By**: Task 1

  **References**:
  - `src/components/EditProfile.components.tsx:10,23` — unused props
  - `src/components/ExcelPreview.tsx:10` — inline union type

  **Acceptance Criteria**:
  - [ ] Unused props removed from interface
  - [ ] Union type extracted to named alias
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify prop and type cleanup
    Tool: Bash
    Preconditions: Task 1 baseline
    Steps:
      1. Use lsp_find_references on userData and errors props
      2. Remove confirmed unused props
      3. Extract union type to named alias
      4. Run `npm run build` — assert exit code 0
    Expected Result: Build passes, props removed, type alias created
    Failure Indicators: Build fails (prop was used at call site)
    Evidence: .sisyphus/evidence/task-5-editprofile-excelpreview.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Files: `src/components/EditProfile.components.tsx`, `src/components/ExcelPreview.tsx`

---

- [x] 6. globalErrorMiddleware Re-export Fix

  **What to do**:
  - `server/middleware/globalErrorMiddleware.js` L19: Convert import+re-export pattern to `export...from` syntax
    - Change `import { asyncHandler } from '...'; export { asyncHandler };` → `export { asyncHandler } from '...';`
    - Same for `asyncMiddleware`

  **Must NOT do**:
  - Do NOT change any middleware logic
  - Do NOT change the exported API surface

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-backend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-5, 7-8)
  - **Blocks**: Tasks 9-14
  - **Blocked By**: Task 1

  **References**:
  - `server/middleware/globalErrorMiddleware.js:19` — re-export pattern

  **Acceptance Criteria**:
  - [ ] Both re-exports use `export { X } from '...'` syntax
  - [ ] Backend still starts and imports work

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify re-export syntax
    Tool: Bash
    Preconditions: Task 1 baseline
    Steps:
      1. Apply export...from syntax
      2. Run `npm run build` — assert exit code 0
      3. Grep for `export.*from` in file — assert matches
    Expected Result: Build passes, clean re-export syntax
    Failure Indicators: Import resolution error at runtime
    Evidence: .sisyphus/evidence/task-6-reexport.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Files: `server/middleware/globalErrorMiddleware.js`

---

- [x] 7. importMasterScheduleController Minor Fixes

  **What to do**:
  - `server/controllers/importMasterScheduleController.js` L42: Fix empty catch — add proper error handling or explicit comment
  - L46: Change `.replace()` to `.replaceAll()` (ES2021+)
  - L321: Rename catch parameter `dataErr` to `error_`
  - L342: Rename catch parameter `dbErr` to `error_`

  **Must NOT do**:
  - Do NOT change the import/parsing logic (CC refactor is Task 21)
  - Do NOT change error handling behavior — just add content to empty catch and rename params

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-backend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-6, 8)
  - **Blocks**: Task 21 (CC refactor depends on minor fixes being done first)
  - **Blocked By**: Task 1

  **References**:
  - `server/controllers/importMasterScheduleController.js:42,46,321,342` — all flagged lines

  **Acceptance Criteria**:
  - [ ] Empty catch at L42 has content
  - [ ] `.replace()` → `.replaceAll()`
  - [ ] Both catch params renamed to `error_`
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify minor controller fixes
    Tool: Bash
    Preconditions: Task 1 baseline
    Steps:
      1. Apply all 4 fixes
      2. Run `npm run build` — assert exit code 0
      3. Grep for `dataErr` and `dbErr` in file — assert 0 matches
      4. Grep for `.replace(` (without All) in file — assert 0 matches at L46
    Expected Result: Build passes, all convention issues fixed
    Failure Indicators: Syntax error from replaceAll (Node <15), build fail
    Evidence: .sisyphus/evidence/task-7-import-controller-minor.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Files: `server/controllers/importMasterScheduleController.js`

---

- [x] 8. Unused Imports + Variable Cleanup (3 files)

  **What to do**:
  - `src/components/admin/dashboard/LiveSummaryView.tsx` L12: Remove unused import of `HardDrive`
  - `src/components/admin/reports/LiveStudentAttendanceView.tsx` L7: Remove unused import of `AlertCircle`
  - `server/controllers/jadwalController.js` L1948: Remove unused variable `jenis_aktivitas`
  - For each: use `lsp_find_references` to confirm unused before removing

  **Must NOT do**:
  - Do NOT remove imports that are actually used elsewhere in the file

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`, `absenta-backend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-7)
  - **Blocks**: Tasks 9-14
  - **Blocked By**: Task 1

  **References**:
  - `src/components/admin/dashboard/LiveSummaryView.tsx:12` — HardDrive import
  - `src/components/admin/reports/LiveStudentAttendanceView.tsx:7` — AlertCircle import
  - `server/controllers/jadwalController.js:1948` — jenis_aktivitas variable

  **Acceptance Criteria**:
  - [ ] All 3 unused imports/variables removed
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify unused import removal
    Tool: Bash
    Preconditions: Task 1 baseline
    Steps:
      1. lsp_find_references for HardDrive, AlertCircle, jenis_aktivitas
      2. Remove confirmed unused imports/variables
      3. Run `npm run build` — assert exit code 0
    Expected Result: Build passes, unused code removed
    Failure Indicators: Build fails (import was actually used)
    Evidence: .sisyphus/evidence/task-8-unused-imports.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Files: `src/components/admin/dashboard/LiveSummaryView.tsx`, `src/components/admin/reports/LiveStudentAttendanceView.tsx`, `server/controllers/jadwalController.js`

- [x] 9. BackupManagementView Nested Ternaries

  **What to do**:
  - `src/components/BackupManagementView.tsx` L916: Extract nested ternary to a helper function or const variable
  - L928: Extract `schedule.enabled ? (schedule.lastRun ? "secondary" : "default") : "outline"` to `getScheduleBadgeVariant(schedule)`
  - L929: Extract `schedule.lastRun ? 'Selesai' : (schedule.enabled ? 'Aktif' : 'Nonaktif')` to `getScheduleBadgeText(schedule)`
  - Define these helpers above the component or as local const functions inside the component body (before JSX return)

  **Must NOT do**:
  - Do NOT change the actual values returned — exact same strings for every condition path
  - Do NOT move helpers to separate files

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 10-14)
  - **Blocks**: Tasks 15-18
  - **Blocked By**: Task 2 (same file was modified)

  **References**:
  - `src/components/BackupManagementView.tsx:916,928,929` — nested ternary locations

  **Acceptance Criteria**:
  - [ ] All 3 nested ternaries replaced with helper function calls
  - [ ] Helper functions defined with descriptive names
  - [ ] Exact same values returned for all branches
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify ternary extraction preserves values
    Tool: Bash
    Preconditions: Task 2 completed (same file)
    Steps:
      1. Extract ternaries to named helpers
      2. Run `npm run build` — assert exit code 0
      3. Grep for nested ternary pattern `? .* ? .* :` at lines 916-930 — assert 0 matches
      4. Verify helper functions exist with descriptive names
    Expected Result: Build passes, no nested ternaries remain
    Failure Indicators: TypeScript type error, wrong return type
    Evidence: .sisyphus/evidence/task-9-backup-ternaries.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `refactor: extract nested ternaries and inner components`
  - Files: `src/components/BackupManagementView.tsx`

---

- [x] 10. AuditLogView Full Cleanup (8 issues)

  **What to do**:
  - `src/components/admin/AuditLogView.tsx` L62: Fix empty catch — add error logging
  - L95: Fix empty catch — add error logging
  - L109: Fix object stringification `value` — use `typeof value === 'object' ? JSON.stringify(value) : String(value)`
  - L110: Same fix for `value` stringification
  - L125: Mark component props as read-only (add `Readonly<>` wrapper to props type)
  - L148: Use optional chain expression `?.` instead of `&&` pattern
  - L176: Use optional chain expression `?.` instead of `&&` pattern
  - L396: Extract nested ternary to helper function

  **Must NOT do**:
  - Do NOT change the audit log data fetching or rendering logic
  - Do NOT restructure the component

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 8 issues across one file requires careful coordination
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9, 11-14)
  - **Blocks**: Tasks 15-18
  - **Blocked By**: Tasks 2-8

  **References**:
  - `src/components/admin/AuditLogView.tsx:62,95,109,110,125,148,176,396` — all flagged lines

  **Acceptance Criteria**:
  - [ ] Both empty catches have error handling content
  - [ ] Both object stringification issues use proper serialization
  - [ ] Props type wrapped with `Readonly<>`
  - [ ] Both `&&` patterns replaced with optional chaining `?.`
  - [ ] Nested ternary at L396 extracted to helper
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify all 8 AuditLogView fixes
    Tool: Bash
    Preconditions: Wave 1 completed
    Steps:
      1. Apply all 8 fixes in file
      2. Run `npm run build` — assert exit code 0
      3. Grep for empty catch `catch.*{\\s*}` — assert 0 matches
      4. Verify Readonly<> wrapper on props type
    Expected Result: Build passes, all 8 issues resolved
    Failure Indicators: Type error from Readonly, optional chain changes behavior
    Evidence: .sisyphus/evidence/task-10-auditlog-cleanup.txt

  Scenario: Verify object stringification safety
    Tool: Bash
    Preconditions: Fixes applied
    Steps:
      1. Read L109-110 — verify objects are properly serialized
      2. Ensure template literals don't produce [object Object]
    Expected Result: Objects use JSON.stringify or property access
    Failure Indicators: Still contains raw object interpolation
    Evidence: .sisyphus/evidence/task-10-stringify-check.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Files: `src/components/admin/AuditLogView.tsx`

---

- [x] 11. LiveSummaryView Nested Ternaries

  **What to do**:
  - `src/components/admin/dashboard/LiveSummaryView.tsx` L99: Extract nested ternary for health status background color
  - L104: Extract nested ternary for icon color
  - L113: Extract nested ternary for text color
  - Create a single `getHealthStatusStyles(status: string)` helper that returns an object with `{ bg, icon, text }` properties:
    ```
    const getHealthStatusStyles = (status: string) => ({
      bg: status === 'healthy' ? "bg-emerald-..." : status === 'warning' ? "bg-amber-..." : "bg-rose-...",
      icon: ...,
      text: ...
    });
    ```
  - Replace all 3 inline ternaries with `styles.bg`, `styles.icon`, `styles.text`

  **Must NOT do**:
  - Do NOT change the CSS class values — exact same Tailwind classes
  - Do NOT change component structure

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-10, 12-14)
  - **Blocks**: Tasks 15-18
  - **Blocked By**: Task 8 (same file had unused import removed)

  **References**:
  - `src/components/admin/dashboard/LiveSummaryView.tsx:99,104,113` — ternary locations
  - Research finding: ternaries express 3-state health styling (healthy/warning/error)

  **Acceptance Criteria**:
  - [ ] All 3 nested ternaries replaced with helper function usage
  - [ ] Helper returns exact same Tailwind class strings
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify health status style extraction
    Tool: Bash
    Preconditions: Task 8 completed (same file)
    Steps:
      1. Create getHealthStatusStyles helper
      2. Replace 3 inline ternaries with helper usage
      3. Run `npm run build` — assert exit code 0
      4. Verify helper covers all 3 states: healthy, warning, error/default
    Expected Result: Build passes, no nested ternaries at L99-113
    Failure Indicators: Missing style variant, TypeScript error
    Evidence: .sisyphus/evidence/task-11-livesummary-ternaries.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Files: `src/components/admin/dashboard/LiveSummaryView.tsx`

---

- [x] 12. BandingAbsenManager Nested Ternary

  **What to do**:
  - `src/components/admin/banding/BandingAbsenManager.tsx` L254: Extract nested ternary into helper function or const variable with descriptive name

  **Must NOT do**:
  - Do NOT change the ternary's return values
  - Do NOT restructure the component

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-11, 13-14)
  - **Blocks**: Tasks 15-18
  - **Blocked By**: Tasks 2-8

  **References**:
  - `src/components/admin/banding/BandingAbsenManager.tsx:254` — nested ternary

  **Acceptance Criteria**:
  - [ ] Nested ternary extracted to named variable/function
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify ternary extraction
    Tool: Bash
    Preconditions: Wave 1 completed
    Steps:
      1. Extract ternary to descriptive const or helper
      2. Run `npm run build` — assert exit code 0
    Expected Result: Build passes, no nested ternary at L254
    Failure Indicators: TypeScript error
    Evidence: .sisyphus/evidence/task-12-banding-ternary.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Files: `src/components/admin/banding/BandingAbsenManager.tsx`

---

- [x] 13. LiveStudentAttendanceView Inner Components + Stringification

  **What to do**:
  - `src/components/admin/reports/LiveStudentAttendanceView.tsx` L133: Move `AttendanceStats` component outside parent function
  - L187: Move `AttendanceProgress` component outside parent function
  - L269: Move `Pagination` component outside parent function
  - All 3 components receive data via props and have NO parent scope dependencies — safe to extract
  - Define proper TypeScript interfaces for their props
  - L375: Fix `value ?? ''` object stringification — use proper serialization
  - L395: Fix `error` object stringification — use `error instanceof Error ? error.message : String(error)`

  **Must NOT do**:
  - Do NOT change component rendering behavior
  - Do NOT create separate files — keep in same file, just move outside parent function
  - Do NOT change the data flow (props must remain the same)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Extracting 3 inner components requires careful prop typing
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-12, 14)
  - **Blocks**: Tasks 15-18
  - **Blocked By**: Task 8 (same file had unused import removed)

  **References**:
  - `src/components/admin/reports/LiveStudentAttendanceView.tsx:133,187,269` — inner components
  - `src/components/admin/reports/LiveStudentAttendanceView.tsx:375,395` — stringification
  - Research finding: All 3 inner components are pure functional — no closures on parent state

  **Acceptance Criteria**:
  - [ ] All 3 components defined at module level (outside parent function)
  - [ ] Props interfaces defined for each extracted component
  - [ ] Both stringification issues fixed
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify component extraction
    Tool: Bash
    Preconditions: Task 8 completed (same file)
    Steps:
      1. Define props interfaces for AttendanceStats, AttendanceProgress, Pagination
      2. Move all 3 components outside parent function
      3. Pass required data as typed props
      4. Run `npm run build` — assert exit code 0
    Expected Result: Build passes, components at module level
    Failure Indicators: Missing prop, type error, closure reference error
    Evidence: .sisyphus/evidence/task-13-livestudent-extraction.txt

  Scenario: Verify stringification fixes
    Tool: Bash
    Preconditions: Components extracted
    Steps:
      1. Fix value serialization at L375
      2. Fix error serialization at L395
      3. Grep for raw object interpolation — assert 0 matches
    Expected Result: No [object Object] risk
    Failure Indicators: Still contains raw object in template literal
    Evidence: .sisyphus/evidence/task-13-stringify.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Files: `src/components/admin/reports/LiveStudentAttendanceView.tsx`

---

- [x] 14. LiveTeacherAttendanceView Inner Components + Stringification

  **What to do**:
  - `src/components/admin/reports/LiveTeacherAttendanceView.tsx` L126: Move `TeacherAttendanceStats` component outside parent function
  - L183: Move `TeacherAttendanceProgress` component outside parent function
  - L259: Move `TeacherPagination` component outside parent function
  - All 3 components are pure functional with prop-based data flow — safe to extract
  - Define proper TypeScript interfaces for their props
  - L368: Fix `value ?? ''` object stringification
  - L389: Fix `error` object stringification

  **Must NOT do**:
  - Do NOT change component rendering behavior
  - Do NOT create separate files — keep in same file
  - Do NOT change the data flow

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Mirror of Task 13 — same pattern, different file
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-13)
  - **Blocks**: Tasks 15-18
  - **Blocked By**: Tasks 2-8

  **References**:
  - `src/components/admin/reports/LiveTeacherAttendanceView.tsx:126,183,259` — inner components
  - `src/components/admin/reports/LiveTeacherAttendanceView.tsx:368,389` — stringification
  - Research finding: Same pattern as LiveStudentAttendanceView — pure functional, no closures

  **Acceptance Criteria**:
  - [ ] All 3 components defined at module level
  - [ ] Props interfaces defined
  - [ ] Both stringification issues fixed
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify teacher view component extraction
    Tool: Bash
    Preconditions: Wave 1 completed
    Steps:
      1. Define props interfaces for TeacherAttendanceStats, TeacherAttendanceProgress, TeacherPagination
      2. Move all 3 outside parent function
      3. Fix both stringification issues
      4. Run `npm run build` — assert exit code 0
    Expected Result: Build passes, all 5 issues resolved
    Failure Indicators: Missing prop, type error
    Evidence: .sisyphus/evidence/task-14-liveteacher-extraction.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Files: `src/components/admin/reports/LiveTeacherAttendanceView.tsx`

- [x] 15. AnalyticsDashboardView Full Cleanup

  **What to do**:
  - `src/components/admin/reports/AnalyticsDashboardView.tsx` L31: Remove useless assignment to `processingNotif`
    - Use `lsp_find_references` to confirm assignment is dead
  - L42: Fix unexpected negated condition — invert the if/else branches to use positive condition
    - Change `if (!condition) { A } else { B }` → `if (condition) { B } else { A }`
  - L80: Fix `error` object stringification — use `error instanceof Error ? error.message : String(error)`
  - L90: Remove useless assignment to `handlePermissionRequest`
    - Use `lsp_find_references` to confirm dead
  - L113: Fix empty catch block — add error logging or explicit `// intentionally empty` comment

  **Must NOT do**:
  - Do NOT change the analytics data flow or permission logic
  - Do NOT restructure the component

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-18)
  - **Blocks**: Tasks 19-23
  - **Blocked By**: Tasks 9-14

  **References**:
  - `src/components/admin/reports/AnalyticsDashboardView.tsx:31,42,80,90,113` — all flagged lines
  - SonarQube rules: S1854 (useless assignment), S1751 (negated condition), S6551 (object stringify), S2486 (empty catch)

  **Acceptance Criteria**:
  - [ ] Both useless assignments removed
  - [ ] Negated condition inverted
  - [ ] Error stringification fixed
  - [ ] Empty catch has content
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify AnalyticsDashboardView cleanup
    Tool: Bash
    Preconditions: Wave 2 completed
    Steps:
      1. Use lsp_find_references for processingNotif and handlePermissionRequest
      2. Apply all 5 fixes
      3. Run `npm run build` — assert exit code 0
      4. Run `npm test` — assert same pass count as baseline
    Expected Result: Build + tests pass, all 5 issues resolved
    Failure Indicators: Variable was actually used, negation inversion changes logic
    Evidence: .sisyphus/evidence/task-15-analytics-cleanup.txt

  Scenario: Verify negated condition fix preserves logic
    Tool: Bash
    Preconditions: Fix applied
    Steps:
      1. Read the if/else at L42 — verify branches were swapped correctly
      2. Confirm positive condition now in the `if`, former `else` body now in `if`
    Expected Result: Same logic, just inverted condition with swapped branches
    Failure Indicators: Only condition flipped without swapping branches
    Evidence: .sisyphus/evidence/task-15-negation-check.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `refactor: fix report view code smells`
  - Files: `src/components/admin/reports/AnalyticsDashboardView.tsx`

---

- [x] 16. AttendanceTrendChart + BandingAbsenReportView Stringification

  **What to do**:
  - `src/components/admin/reports/AttendanceTrendChart.tsx` L87: Fix `err` object stringification
    - Use `err instanceof Error ? err.message : String(err)` pattern
  - `src/components/admin/reports/BandingAbsenReportView.tsx` L82: Fix `error` object stringification
  - L114: Fix `error` object stringification
  - L419: Fix array index used as React key
    - Replace `index` key with a stable unique identifier from the data (e.g., `item.id` or a composite key)
    - If no unique ID exists, use a composite key like `${item.field1}-${item.field2}`

  **Must NOT do**:
  - Do NOT change chart rendering or report data logic
  - Do NOT remove the key prop — replace with stable identifier

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15, 17-18)
  - **Blocks**: Tasks 19-23
  - **Blocked By**: Tasks 9-14

  **References**:
  - `src/components/admin/reports/AttendanceTrendChart.tsx:87` — err stringification
  - `src/components/admin/reports/BandingAbsenReportView.tsx:82,114,419` — error stringify + array key

  **Acceptance Criteria**:
  - [ ] All 3 error stringification issues use instanceof pattern
  - [ ] Array index key replaced with stable identifier
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify stringification and key fixes
    Tool: Bash
    Preconditions: Wave 2 completed
    Steps:
      1. Apply error stringification fixes in both files
      2. Find stable key for array at L419 — read the data shape to identify unique field
      3. Replace index key with stable identifier
      4. Run `npm run build` — assert exit code 0
    Expected Result: Build passes, no raw object interpolation, no index keys
    Failure Indicators: Key is not unique (causes React warning), type error
    Evidence: .sisyphus/evidence/task-16-trend-banding-fixes.txt

  Scenario: Verify array key stability
    Tool: Bash
    Preconditions: Fix applied
    Steps:
      1. Grep for `key={.*index` in BandingAbsenReportView.tsx — assert 0 matches
      2. Verify new key uses a data property
    Expected Result: No array index as key
    Failure Indicators: Still using numeric index
    Evidence: .sisyphus/evidence/task-16-key-check.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Files: `src/components/admin/reports/AttendanceTrendChart.tsx`, `src/components/admin/reports/BandingAbsenReportView.tsx`

---

- [x] 17. ReportsView + TeacherAttendanceSummaryView Minor Fixes

  **What to do**:
  - `src/components/admin/reports/ReportsView.tsx` L73: Fix `error` object stringification
    - Use `error instanceof Error ? error.message : String(error)` pattern
  - `src/components/admin/reports/TeacherAttendanceSummaryView.tsx` L152: Use optional chain expression
    - Replace `obj && obj.prop` with `obj?.prop`

  **Must NOT do**:
  - Do NOT change report view logic or data fetching
  - Do NOT change what happens when error/null — just the access syntax

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15-16, 18)
  - **Blocks**: Tasks 19-23
  - **Blocked By**: Tasks 9-14

  **References**:
  - `src/components/admin/reports/ReportsView.tsx:73` — error stringification
  - `src/components/admin/reports/TeacherAttendanceSummaryView.tsx:152` — optional chain

  **Acceptance Criteria**:
  - [ ] Error stringification uses instanceof pattern
  - [ ] Optional chain replaces `&&` access pattern
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify report view fixes
    Tool: Bash
    Preconditions: Wave 2 completed
    Steps:
      1. Apply both fixes
      2. Run `npm run build` — assert exit code 0
    Expected Result: Build passes, both issues resolved
    Failure Indicators: Optional chain changes null behavior
    Evidence: .sisyphus/evidence/task-17-reports-fixes.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Files: `src/components/admin/reports/ReportsView.tsx`, `src/components/admin/reports/TeacherAttendanceSummaryView.tsx`

---

- [x] 18. LiveStudent/TeacherAttendanceView Remaining Stringification

  **What to do**:
  - `src/components/admin/reports/LiveStudentAttendanceView.tsx` L112: Fix `error` object stringification (if not already done in Task 13)
  - `src/components/admin/reports/LiveTeacherAttendanceView.tsx` L106: Fix `error` object stringification (if not already done in Task 14)
  - Check both files for any remaining object stringification issues missed by Tasks 13/14
  - Use `error instanceof Error ? error.message : String(error)` pattern

  **Must NOT do**:
  - Do NOT redo work from Tasks 13/14 — only fix remaining issues
  - Do NOT change error handling flow

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15-17)
  - **Blocks**: Tasks 19-23
  - **Blocked By**: Tasks 13, 14 (same files)

  **References**:
  - `src/components/admin/reports/LiveStudentAttendanceView.tsx:112` — remaining stringify
  - `src/components/admin/reports/LiveTeacherAttendanceView.tsx:106` — remaining stringify

  **Acceptance Criteria**:
  - [ ] All remaining error stringification issues resolved in both files
  - [ ] Build passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify remaining stringification
    Tool: Bash
    Preconditions: Tasks 13, 14 completed
    Steps:
      1. Check both files for any raw error/object interpolation
      2. Apply instanceof pattern where needed
      3. Run `npm run build` — assert exit code 0
      4. Grep for template literals containing `error` without .message — assert 0 matches
    Expected Result: Zero object stringification risk in either file
    Failure Indicators: Missed occurrence
    Evidence: .sisyphus/evidence/task-18-remaining-stringify.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Files: `src/components/admin/reports/LiveStudentAttendanceView.tsx`, `src/components/admin/reports/LiveTeacherAttendanceView.tsx`

- [x] 19. absensiController CC:21→≤15

  **What to do**:
  - `server/controllers/absensiController.js` L545: Refactor `submitStudentAttendance` function (CC:21 → ≤15)
  - **Decomposition strategy** (from research):
    1. Extract validation logic (~L559-581) into `validateAttendanceRequest(req)` — handles required fields, schedule existence, date validation
    2. Extract attendance data processing (~L583-634) into `processAttendanceData(attendance, existingMap, targetDate, currentTime)` — handles parsing, classification, operation prep
    3. Extract database operations (~L636-670) into `executeAttendanceOperations(connection, updates, inserts, isMultiGuru, ...)` — handles batch inserts/updates and multi-guru sync
  - Use early returns for validation failures to reduce nesting
  - Keep helpers in the same file, defined above the main function

  **Must NOT do**:
  - Do NOT change the attendance submission behavior or API contract
  - Do NOT change database queries — only extract them into helpers
  - Do NOT change the transaction handling logic
  - Do NOT restructure beyond what's needed to bring CC ≤ 15

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Backend controller with database transactions — needs careful extraction
  - **Skills**: [`absenta-backend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 20-23)
  - **Blocks**: Tasks 24-25
  - **Blocked By**: Tasks 15-18

  **References**:
  - `server/controllers/absensiController.js:545-670` — full function scope
  - Research finding: Complexity from deep nesting with try/catch inside transaction, multiple validation checks, and attendance data processing loop with nested conditionals
  - `server/utils/errorHandler.js` — existing error response helpers (sendSuccessResponse, sendValidationError, etc.)

  **Acceptance Criteria**:
  - [ ] `submitStudentAttendance` CC ≤ 15
  - [ ] 2-3 extracted helper functions with descriptive names
  - [ ] Build passes
  - [ ] `npm test` passes — same count as baseline
  - [ ] Attendance submission still works (verified by existing tests)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify CC reduction preserves behavior
    Tool: Bash
    Preconditions: Wave 3 completed
    Steps:
      1. Read current function to understand full logic
      2. Extract helpers following decomposition strategy
      3. Run `npm run build` — assert exit code 0
      4. Run `npm test` — assert same pass count as baseline
      5. Verify function signature unchanged (same req, res params)
    Expected Result: Build + tests pass, CC reduced, same API behavior
    Failure Indicators: Test failure in attendance tests, runtime error
    Evidence: .sisyphus/evidence/task-19-absensi-cc.txt

  Scenario: Verify extracted helpers are correct
    Tool: Bash
    Preconditions: Refactoring complete
    Steps:
      1. Read each extracted helper — verify it handles the same logic as original inline code
      2. Verify no dangling variables (all references still resolve)
      3. Verify transaction boundaries are preserved (connection passed to helpers)
    Expected Result: Helpers mirror original logic exactly
    Failure Indicators: Variable not defined, connection not passed to helper
    Evidence: .sisyphus/evidence/task-19-helper-verification.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `refactor: reduce cognitive complexity in backend controllers`
  - Files: `server/controllers/absensiController.js`

---

- [x] 20. authController CC:16→≤15

  **What to do**:
  - `server/controllers/authController.js` L247: Refactor `login` function (CC:16 → ≤15)
  - **HIGHEST RISK TASK** — this is authentication logic. Extract MINIMUM necessary.
  - **Decomposition strategy** (from research):
    1. Extract lockout checking (~L256-270) into `checkAndHandleLockout(username, clientId, clientIP)` — returns lockout status
    2. OR extract user data enrichment (~L349-383) into `enrichUserData(user)` — fetches role-specific additional data
  - Only ONE extraction should be needed to drop CC from 16 to ≤15. Pick the simplest one.
  - Prefer extracting `enrichUserData` — it's lower risk than lockout logic

  **Must NOT do**:
  - Do NOT change authentication flow or JWT token generation
  - Do NOT change password verification logic
  - Do NOT change lockout behavior
  - Do NOT restructure the entire function — extract ONE helper to bring CC from 16 to ≤15
  - Do NOT change error responses or status codes

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Authentication code — highest risk, minimum intervention required
  - **Skills**: [`absenta-backend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 19, 21-23)
  - **Blocks**: Tasks 24-25
  - **Blocked By**: Tasks 15-18

  **References**:
  - `server/controllers/authController.js:247-383` — full login function
  - Research finding: CC:16, only 1 point over limit. Multiple lockout checks + role-specific data fetching. Extract ONE chunk.
  - Metis directive: "Extract the minimum code necessary to bring CC from 16 to ≤15. MUST NOT restructure the entire function."

  **Acceptance Criteria**:
  - [ ] `login` function CC ≤ 15
  - [ ] Only ONE helper extracted (minimum intervention)
  - [ ] Build passes
  - [ ] All tests pass — especially auth-related tests
  - [ ] Login flow unchanged

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify minimal CC reduction in auth
    Tool: Bash
    Preconditions: Wave 3 completed
    Steps:
      1. Read login function — identify smallest extractable block
      2. Extract ONE helper (prefer enrichUserData)
      3. Run `npm run build` — assert exit code 0
      4. Run `npm test` — assert same pass count as baseline
      5. Verify login function signature unchanged
    Expected Result: Build + tests pass, CC reduced by exactly enough
    Failure Indicators: Auth test failure, different response shape
    Evidence: .sisyphus/evidence/task-20-auth-cc.txt

  Scenario: Verify auth behavior preservation
    Tool: Bash
    Preconditions: Refactoring complete
    Steps:
      1. Verify JWT generation code untouched
      2. Verify password check code untouched
      3. Verify lockout check code untouched (if not the extracted part)
      4. Verify response shape matches original
    Expected Result: Zero auth logic changes
    Failure Indicators: Changed JWT payload, different error codes
    Evidence: .sisyphus/evidence/task-20-auth-behavior.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Files: `server/controllers/authController.js`

---

- [x] 21. importMasterScheduleController CC:71→≤15

  **What to do**:
  - `server/controllers/importMasterScheduleController.js` L92: Refactor `importMasterSchedule` function (CC:71 → ≤15)
  - This is the MOST COMPLEX function — requires significant decomposition
  - **Decomposition strategy** (from research):
    1. Extract Excel parsing (~L106-220) into `parseScheduleFromExcel(workbook)` — handles header detection, day ranges, raw data extraction
    2. Extract data validation/resolution (~L259-330) into `resolveScheduleData(scheduleData, conn)` — handles class/mapel/guru/ruang name-to-ID resolution
    3. Extract DB persistence (~L330-380) into `persistScheduleRecords(resolvedData, conn)` — batch insertion with conflict resolution
    4. Extract header/column mapping logic into `detectDayColumns(headerRow)` — identifies which columns map to which days
    5. Extract row parsing into `parseScheduleRow(row, dayColumnMap)` — parses a single data row
  - Use early returns for validation failures
  - Keep all helpers in the same file

  **Must NOT do**:
  - Do NOT change the import file format support (Excel/CSV)
  - Do NOT change database schema or queries — only extract them
  - Do NOT change error collection behavior
  - Do NOT change the response format

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: CC:71 → ≤15 requires deep decomposition of complex parsing logic
  - **Skills**: [`absenta-backend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 19-20, 22-23)
  - **Blocks**: Tasks 24-25
  - **Blocked By**: Task 7 (minor fixes in same file done first)

  **References**:
  - `server/controllers/importMasterScheduleController.js:92-380` — full function
  - Research finding: Extremely complex Excel parsing with nested loops, day header detection, column mapping, schedule data processing with multiple validation layers, transaction handling
  - Task 7 already fixed minor issues (empty catch, replaceAll, param naming) in same file

  **Acceptance Criteria**:
  - [ ] `importMasterSchedule` CC ≤ 15
  - [ ] 4-5 extracted helper functions with descriptive names
  - [ ] Build passes
  - [ ] Tests pass
  - [ ] Excel import still works correctly

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify deep CC reduction
    Tool: Bash
    Preconditions: Task 7 completed (minor fixes in same file)
    Steps:
      1. Read full function to map logic flow
      2. Extract helpers following decomposition strategy
      3. Run `npm run build` — assert exit code 0
      4. Run `npm test` — assert same pass count as baseline
      5. Verify main function reads linearly (parse → validate → resolve → persist)
    Expected Result: Build + tests pass, CC dramatically reduced
    Failure Indicators: Test failure, parsing error, missing column detection
    Evidence: .sisyphus/evidence/task-21-import-cc.txt

  Scenario: Verify parsing logic preserved
    Tool: Bash
    Preconditions: Refactoring complete
    Steps:
      1. Verify parseScheduleFromExcel handles same header formats
      2. Verify resolveScheduleData does same name-to-ID lookups
      3. Verify error collection pattern unchanged
    Expected Result: Same import behavior, cleaner code structure
    Failure Indicators: Different error messages, missing day detection
    Evidence: .sisyphus/evidence/task-21-parsing-check.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Files: `server/controllers/importMasterScheduleController.js`

---

- [x] 22. jadwalController 3 Functions CC Refactor

  **What to do**:
  - `server/controllers/jadwalController.js` L264: Refactor `checkAllScheduleConflicts` (CC:16 → ≤15)
    - Extract individual conflict checkers: `checkGuruConflicts()`, `checkRoomConflicts()`, `checkClassConflicts()`
    - Extract SQL overlap condition builder: `buildOverlapCondition(hari, jam_mulai, jam_selesai)`
  - L713: Refactor `processJadwalData` (CC:19 → ≤15)
    - Extract input normalization into `normalizeJadwalInput(payload)`
    - Extract reference validation into `validateJadwalReferences(kelasId, mapelId, ruangId, guruIds)`
  - L954: Refactor `batchUpdateMatrix` (CC:27 → ≤15)
    - Extract individual change processing into `processBatchChange(change, connection, ...)`
    - Extract slot resolution into `resolveJamSlot(change, classSlotMap, globalSlotMap)`
    - Extract batch validation into `validateBatchChanges(changes, normalizedHari)`

  **Must NOT do**:
  - Do NOT change schedule conflict detection logic
  - Do NOT change the batch update API contract
  - Do NOT change database queries — only extract into helpers
  - Do NOT change validation rules

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 3 functions to decompose in one file, complex schedule logic
  - **Skills**: [`absenta-backend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 19-21, 23)
  - **Blocks**: Tasks 24-25
  - **Blocked By**: Task 8 (unused variable removed from same file)

  **References**:
  - `server/controllers/jadwalController.js:264` — checkAllScheduleConflicts (CC:16)
  - `server/controllers/jadwalController.js:713` — processJadwalData (CC:19)
  - `server/controllers/jadwalController.js:954` — batchUpdateMatrix (CC:27)
  - Research finding: Conflict checks have similar patterns (guru/room/class) ideal for extraction. processJadwalData has layered validation. batchUpdateMatrix has nested loop processing.

  **Acceptance Criteria**:
  - [ ] All 3 functions have CC ≤ 15
  - [ ] 6-8 extracted helper functions total
  - [ ] Build passes
  - [ ] Tests pass
  - [ ] Schedule CRUD operations still work

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify jadwalController CC reduction
    Tool: Bash
    Preconditions: Task 8 completed (same file)
    Steps:
      1. Read all 3 functions to understand logic flow
      2. Extract helpers for each function following decomposition strategy
      3. Run `npm run build` — assert exit code 0
      4. Run `npm test` — assert same pass count as baseline
    Expected Result: Build + tests pass, all 3 functions CC ≤ 15
    Failure Indicators: Conflict detection broken, batch update fails
    Evidence: .sisyphus/evidence/task-22-jadwal-cc.txt

  Scenario: Verify conflict detection preserved
    Tool: Bash
    Preconditions: Refactoring complete
    Steps:
      1. Verify checkGuruConflicts, checkRoomConflicts, checkClassConflicts each check same SQL conditions
      2. Verify overlap condition builder uses same time comparison logic
      3. Verify batch validation checks same constraints
    Expected Result: Same conflict detection behavior
    Failure Indicators: Different SQL conditions, missing conflict type
    Evidence: .sisyphus/evidence/task-22-conflict-check.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Files: `server/controllers/jadwalController.js`

---

- [x] 23. sqlParser CC:26→≤15

  **What to do**:
  - `server/utils/sqlParser.js` L213: Refactor `splitSqlStatements` function (CC:26 → ≤15)
  - **Decomposition strategy** (from research):
    1. Extract character processing logic into `processCharacter(state, char, nextChar)` — handles one character with all parsing modes (quote, comment, delimiter)
    2. Extract quote handling into `handleQuoteState(state, char)` — manages single/double quote escaping
    3. Extract comment handling into `handleCommentState(state, char, nextChar)` — manages line/block comments
    4. Extract statement finalization into `finalizeStatement(state)` — handles remaining content and trimming
  - This is a state machine parser — each state transition becomes a helper function

  **Must NOT do**:
  - Do NOT change SQL parsing behavior — same statements must be produced
  - Do NOT change delimiter detection logic
  - Do NOT change the function's public API (input/output)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: State machine parser — complex but well-isolated, no DB dependencies
  - **Skills**: [`absenta-backend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 19-22)
  - **Blocks**: Tasks 24-25
  - **Blocked By**: Tasks 15-18

  **References**:
  - `server/utils/sqlParser.js:213` — splitSqlStatements function
  - Research finding: Complex state machine with multiple parsing modes. Each character checked against multiple conditions (in quote, in comment, delimiter match). Decompose by extracting state handlers.

  **Acceptance Criteria**:
  - [ ] `splitSqlStatements` CC ≤ 15
  - [ ] 3-4 extracted state handler functions
  - [ ] Build passes
  - [ ] Tests pass (especially any SQL import tests)
  - [ ] Same SQL parsing output for all inputs

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify SQL parser CC reduction
    Tool: Bash
    Preconditions: Wave 3 completed
    Steps:
      1. Read state machine logic to map all state transitions
      2. Extract state handlers (quote, comment, delimiter, normal)
      3. Run `npm run build` — assert exit code 0
      4. Run `npm test` — assert same pass count as baseline
    Expected Result: Build + tests pass, CC ≤ 15
    Failure Indicators: SQL parsing produces different results, state leak
    Evidence: .sisyphus/evidence/task-23-sqlparser-cc.txt

  Scenario: Verify parsing correctness
    Tool: Bash
    Preconditions: Refactoring complete
    Steps:
      1. Verify function handles: quoted strings, line comments (--), block comments (/* */), custom delimiters
      2. Verify same statements array returned for sample SQL
    Expected Result: Parser handles all SQL edge cases identically
    Failure Indicators: Missing statement, broken quote handling
    Evidence: .sisyphus/evidence/task-23-parser-correctness.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Files: `server/utils/sqlParser.js`

- [x] 24. seed_dummy_full.js CC:59→≤15

  **What to do**:
  - `database/seeders/seed_dummy_full.js` L91: Refactor main seeding function (CC:59 → ≤15)
  - **Decomposition strategy** (from research):
    1. Extract `cleanupTables(connection)` — handles FK checks and TRUNCATE operations
    2. Extract `seedRooms(connection, roomData)` — inserts room data, returns room IDs
    3. Extract `seedMapel(connection, mapelData)` — inserts subjects, returns {id, kode} array
    4. Extract `seedKelas(connection, kelasData)` — inserts classes, returns class IDs
    5. Extract `seedGuruAndUsers(connection, guruNames, mapelIds)` — creates users and teachers
    6. Extract `generateSchedule(connection, kelasIds, mapelIds, guruIds, slotsByDay)` — core scheduling algorithm
    7. Further decompose `generateSchedule` into:
       - `isTeacherBusy(busyTeachers, hari, jam, guruId)` / `markTeacherBusy(...)`
       - `isRoomBusy(busyRooms, hari, jam, roomId)` / `markRoomBusy(...)`
       - `selectTeacherForSlot(eligibleTeachers, busyTeachers, hari, jam)`
       - `selectRoomForClass(kelasId, roomIds, busyRooms, hari, jam)`
  - Keep ALL helpers in the same file

  **Must NOT do**:
  - Do NOT change the seeding data or output — same dummy data must be generated
  - Do NOT create shared utility files (no new files)
  - Do NOT change the database schema or table operations
  - Do NOT change random selection algorithms

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: CC:59 requires deep decomposition with 7+ helpers, complex scheduling logic
  - **Skills**: [`absenta-backend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 25)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 19-23

  **References**:
  - `database/seeders/seed_dummy_full.js:91` — main function start
  - Research finding: 3-level nested loops (classes → days → slots) with DB ops, teacher/room availability checking, inline conflict resolution. Main function does: cleanup → seed rooms → seed subjects → seed classes → seed teachers → generate schedule.

  **Acceptance Criteria**:
  - [ ] Main function CC ≤ 15
  - [ ] Each extracted helper CC ≤ 15
  - [ ] 7+ helpers with descriptive names
  - [ ] Build passes
  - [ ] Seeder still runs and produces valid data (verified by running `node database/seeders/seed_dummy_full.js --dry-run` if dry-run flag exists, otherwise verify build only)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify seeder CC reduction
    Tool: Bash
    Preconditions: Wave 4 completed
    Steps:
      1. Read full function to map data flow
      2. Extract helpers following decomposition strategy (7+ functions)
      3. Run `npm run build` — assert exit code 0
      4. Run `npm test` — assert same pass count as baseline
      5. Verify main function is now a linear orchestrator: cleanup → seed → generate
    Expected Result: Build + tests pass, CC dramatically reduced
    Failure Indicators: Helper missing parameter, variable scope issue
    Evidence: .sisyphus/evidence/task-24-seed-full-cc.txt

  Scenario: Verify scheduling logic preserved
    Tool: Bash
    Preconditions: Refactoring complete
    Steps:
      1. Verify isTeacherBusy/markTeacherBusy handle same data structure
      2. Verify selectTeacherForSlot uses same filtering logic
      3. Verify conflict resolution produces same outcome
    Expected Result: Same scheduling behavior
    Failure Indicators: Double-booked teachers/rooms (conflict resolution broken)
    Evidence: .sisyphus/evidence/task-24-schedule-check.txt
  ```

  **Commit**: YES (groups with Wave 5)
  - Message: `refactor: reduce cognitive complexity in database seeders`
  - Files: `database/seeders/seed_dummy_full.js`

---

- [x] 25. seed_dummy_range.js CC:110→≤15

  **What to do**:
  - `database/seeders/seed_dummy_range.js` L208: Refactor main function (CC:110 → ≤15)
  - This is the HIGHEST CC function in the entire codebase — requires extensive decomposition
  - **Decomposition strategy** (from research):
    1. Extract `loadReferenceData(connection)` — loads mapel, kelas, ruang, max IDs
    2. Extract `seedJamPelajaran(connection, config, includeSaturdays, tahunAjaran)` — inserts time slots
    3. Extract `seedRuangKelas(connection, classCount, existingSet)` — inserts classrooms
    4. Extract `seedKelas(connection, classCount, runTag, existingSet)` — inserts classes
    5. Extract `seedGuruUsersAndData(connection, teacherCount, runTag, maxGuruId, mapelFinal)` — creates guru users + records
    6. Extract `seedSiswaUsersAndData(connection, kelasFinal, studentsPerClass, runTag, maxSiswaId)` — creates siswa users + records
    7. Extract `seedJadwalAndRelated(connection, kelasFinal, mapelFinal, guruMapel, ruangFinal, targetDays, jamByDay)` — creates jadwal + bindings
    8. Extract `generateAbsensiData(connection, startDate, endDate, kelasFinal, jadwalByClassDay, siswaByClass, includeSaturdays)` — core attendance generation
    9. Further decompose `generateAbsensiData`:
       - `isSchoolDay(date, includeSaturdays)`
       - `pickWeighted(statusOptions)` — weighted random selection utility
       - `generateAbsensiForSchedule(sched, siswaList, dateStr, statusGuru, siswaPencatat)` — per-schedule attendance
       - `batchInsertAbsensi(connection, siswaBatch, guruBatch)` — chunked batch insert
  - Keep ALL helpers in the same file

  **Must NOT do**:
  - Do NOT change the seeding data structure or output
  - Do NOT create shared utility files
  - Do NOT change database operations or batch insert logic
  - Do NOT change weighted random selection algorithms
  - Do NOT change date range iteration logic

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: CC:110 — highest in entire codebase. Requires 10+ helper extractions with 4-level nesting decomposition
  - **Skills**: [`absenta-backend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 24)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 19-23

  **References**:
  - `database/seeders/seed_dummy_range.js:208` — main function start
  - Research finding: 4-level nested loops (dates → classes → schedules → students), date manipulation, weighted random status generation, complex batch insertion with chunking, multiple data structure transformations. Follows pattern: load refs → seed infrastructure → seed users → generate schedule → generate attendance.
  - `database/seeders/seed_dummy_full.js` — Task 24 uses similar pattern. Consider using same helper naming conventions for consistency.

  **Acceptance Criteria**:
  - [ ] Main function CC ≤ 15
  - [ ] Each extracted helper CC ≤ 15
  - [ ] 10+ helpers with descriptive names
  - [ ] Build passes
  - [ ] Tests pass

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify deepest CC reduction
    Tool: Bash
    Preconditions: Wave 4 completed
    Steps:
      1. Read full function to map 4-level nesting structure
      2. Extract helpers following decomposition strategy (10+ functions)
      3. Run `npm run build` — assert exit code 0
      4. Run `npm test` — assert same pass count as baseline
      5. Verify main function is linear orchestrator
    Expected Result: Build + tests pass, CC reduced from 110 to ≤15
    Failure Indicators: Variable scope issues, missing parameters, batch insert broken
    Evidence: .sisyphus/evidence/task-25-seed-range-cc.txt

  Scenario: Verify attendance generation preserved
    Tool: Bash
    Preconditions: Refactoring complete
    Steps:
      1. Verify isSchoolDay handles weekends and Saturday config correctly
      2. Verify pickWeighted uses same weighted random algorithm
      3. Verify batchInsertAbsensi uses same chunk size and INSERT syntax
      4. Verify date iteration covers same range
    Expected Result: Same attendance data generation behavior
    Failure Indicators: Missing dates, wrong status distribution, batch insert failure
    Evidence: .sisyphus/evidence/task-25-attendance-check.txt
  ```

  **Commit**: YES (groups with Wave 5)
  - Files: `database/seeders/seed_dummy_range.js`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan. Verify all 9 CC-flagged functions now have CC ≤ 15. Verify all nested ternaries eliminated. Verify all unused variables removed.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run build` + `npm run lint` + `npm test`. Review all changed files for: new `as any`/`@ts-ignore`, empty catches without comments, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify each extracted helper function has a descriptive name. Verify no file in `src/components/ui/*` was modified.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start dev server with `npm run dev:full`. Use Playwright to navigate to: login page, admin dashboard, attendance page, schedule management, reports page, student dashboard, backup management, audit log. Verify each page loads without console errors. Take screenshots as evidence. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Pages [N/N load] | Console Errors [N] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance: no UI component changes, no SQL changes, no behavior changes. Detect cross-task contamination. Flag unaccounted changes. Verify total SonarQube issue reduction matches target.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

After each wave, create one commit:
- Wave 0: No commit (baseline only)
- Wave 1: `refactor: fix minor SonarQube code smells (mechanical fixes)` — all files from tasks 2-8
- Wave 2: `refactor: extract nested ternaries and inner components` — all files from tasks 9-14
- Wave 3: `refactor: fix report view code smells` — all files from tasks 15-18
- Wave 4: `refactor: reduce cognitive complexity in backend controllers` — all files from tasks 19-23
- Wave 5: `refactor: reduce cognitive complexity in database seeders` — all files from tasks 24-25

Pre-commit for each: `npm run build && npm test`

---

## Success Criteria

### Verification Commands
```bash
npm run build   # Expected: exit code 0, no errors
npm test        # Expected: same pass count as baseline, 0 failures
npm run lint    # Expected: no new errors vs baseline
```

### Final Checklist
- [x] All 9 CC-flagged functions refactored to CC ≤ 15
- [x] All 8 nested ternary operations extracted
- [x] All 6 inner components moved outside parent functions
- [x] All 7 unused assignments removed
- [x] All 12 object stringification issues fixed
- [x] All ~20 convention/minor issues fixed
- [x] No files in `src/components/ui/*` modified
- [x] No SQL files modified
- [x] No behavior changes — all existing tests pass
- [x] Build succeeds, lint clean, tests green
