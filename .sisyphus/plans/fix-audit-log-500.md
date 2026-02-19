# Fix Audit Log 500 and Schedule Grid Column Layout

## TL;DR

> **Quick Summary**: Resolve the Audit Log API 500 errors by making `admin_activity_logs` self-healing at controller entry, then fix the Schedule Grid table's KELAS and JAM KE sticky column sizing so labels are readable and aligned during horizontal scroll.
>
> **Deliverables**:
> - Backend fix in `server/controllers/auditLogController.js` for table availability before reads
> - Frontend layout fix in `src/components/admin/schedules/ScheduleGridTable.tsx` for sticky column width/offset consistency
> - Verification evidence for API behavior + UI rendering + regression checks
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 -> Task 3 -> Task 4

---

## Context

### Original Request
User asked to continue immediately (`lanjut`) and complete the pending fixes carefully and in detail:
1. Fix 500 errors on:
   - `GET /api/admin/audit-logs?page=1&limit=10`
   - `GET /api/admin/audit-logs/filters`
2. Fix broken Schedule Grid Editor UI (KELAS and JAM KE columns visually compressed/truncated).

### Interview Summary
**Key Discussions**:
- User explicitly requested continuation with no delay.
- Existing plan only covered audit log fix; current work must be a single unified plan for both backend and frontend issues.
- Prior SonarQube fixes are already done and committed; this plan focuses only on remaining issues.

**Research Findings**:
- `admin_activity_logs` table is missing at runtime, while DDL exists in `server/migrations/create_admin_activity_logs.sql`.
- `server/controllers/auditLogController.js` reads the table directly in both handlers and currently has no table existence safeguard.
- `src/components/admin/schedules/ScheduleGridTable.tsx` uses narrow sticky columns with hardcoded offsets:
  - KELAS header: `min-w-[80px]`
  - JAM KE header/row label: `min-w-[50px]`, `left-[80px]`
  - This likely causes clipping and sticky overlap mismatch with longer class names.

### Metis Review
**Identified Gaps (addressed in this plan)**:
- Add explicit guardrails to avoid scope creep into migration framework and broad grid refactors.
- Validate assumptions via acceptance criteria (concurrent first-hit behavior, API contract stability, sticky alignment while scrolling).
- Add negative-path QA scenarios (auth still enforced, no interaction regression in grid editor).

---

## Work Objectives

### Core Objective
Restore admin audit log page stability and schedule grid visual correctness with minimal, targeted changes that preserve existing API contracts and editing behavior.

### Concrete Deliverables
- `server/controllers/auditLogController.js` updated with table ensure logic and safe read behavior.
- `src/components/admin/schedules/ScheduleGridTable.tsx` updated with synchronized sticky column widths/offsets.
- Verification outputs for API and UI workflows captured under `.sisyphus/evidence/`.

### Definition of Done
- [ ] `/api/admin/audit-logs` and `/api/admin/audit-logs/filters` return non-500 responses under normal authenticated admin access.
- [ ] Audit log response shape remains compatible with `AuditLogView` expectations.
- [ ] KELAS and JAM KE labels are readable (not clipped) and sticky columns remain aligned during horizontal scroll.
- [ ] Grid interactions (click cell, drag-drop, save flow) still work after layout changes.
- [ ] `npx tsc --noEmit`, `npm run build`, and `npm test` pass.

### Must Have
- Controller-scoped self-healing table creation using DDL equivalent to `server/migrations/create_admin_activity_logs.sql`.
- Run-once guard to avoid unnecessary DDL attempts per request.
- Sticky column sizing and offset values updated together (single source of truth in component-level constants).
- Verification includes both happy path and error/negative scenarios.

### Must NOT Have (Guardrails)
- Do not redesign migration architecture or modify global initializer flow.
- Do not change auth middleware flow or route wiring in `server/routes/auditLogRoutes.js`.
- Do not refactor schedule drag-drop/edit business logic outside layout scope.
- Do not modify shared shadcn base UI components (`src/components/ui/*`).
- Do not change API response keys consumed by `src/components/admin/AuditLogView.tsx`.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> Every acceptance criterion must be executable by agent-run commands or browser automation.
> No manual clicking/visual confirmation by human reviewer is required.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: YES (tests-after)
- **Framework**: `vitest` + Node.js test runner via `npm test`

### Agent-Executed QA Scenarios (applies to all tasks)
- API validations executed via Bash (`curl` + response assertions).
- UI validations executed via Playwright (navigation, assertions, screenshots).
- Build/type/test validations executed via Bash commands.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
- Task 1: Backend audit-log self-healing table check
- Task 2: Frontend sticky column width/offset alignment fix

Wave 2 (After Wave 1):
- Task 3: API + UI regression verification scenarios

Wave 3 (After Wave 2):
- Task 4: Full project verification + commit sequence

Critical Path: Task 1 -> Task 3 -> Task 4
Parallel Speedup: backend and frontend implementation can proceed independently in Wave 1.

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4 | 2 |
| 2 | None | 3, 4 | 1 |
| 3 | 1, 2 | 4 | None |
| 4 | 3 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | Task 1: `quick`; Task 2: `visual-engineering` |
| 2 | 3 | `unspecified-high` with `playwright` |
| 3 | 4 | `quick` with `git-master` |

---

## TODOs

- [ ] 1. Add self-healing table availability to audit log controller

  **What to do**:
  - Add module-level guard (`tableEnsured`) and `ensureAuditLogTable()` function in `server/controllers/auditLogController.js`.
  - `ensureAuditLogTable()` must execute `CREATE TABLE IF NOT EXISTS admin_activity_logs (...)` equivalent to migration schema.
  - Call `await ensureAuditLogTable()` at top of both handlers:
    - `getAuditLogs`
    - `getAuditLogFilters`
  - Keep read query behavior intact.
  - Add defensive handling in `logs` mapping so malformed string JSON in `details` cannot crash request path (fallback to original string on parse error).

  **Must NOT do**:
  - Do not alter route authentication or route paths.
  - Do not touch `server/services/system/admin-audit-service.js` write flow.
  - Do not introduce migration runner or startup migration refactor.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single backend file with tightly scoped bug fix.
  - **Skills**: [`git-master`, `awesome-opencode`]
    - `git-master`: keep patch atomic and commit history clean.
    - `awesome-opencode`: leverage workspace conventions quickly.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: no frontend design work in this task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: 3, 4
  - **Blocked By**: None

  **References**:
  - `server/controllers/auditLogController.js:11` - primary handler currently querying table without pre-check.
  - `server/controllers/auditLogController.js:104` - filter handler currently querying table without pre-check.
  - `server/migrations/create_admin_activity_logs.sql:1` - canonical DDL schema to mirror.
  - `server/services/system/admin-audit-service.js:38` - confirms writer expects same table/columns.
  - `src/components/admin/AuditLogView.tsx:148` - filter options response contract (`{ actions, targets }`).
  - `src/components/admin/AuditLogView.tsx:172` - logs response contract (`{ logs, pagination }`).

  **Acceptance Criteria**:
  - [ ] `ensureAuditLogTable()` exists and is called in both handlers.
  - [ ] DDL columns/indexes match migration schema.
  - [ ] Controller does not return 500 due to missing table in normal authenticated use.
  - [ ] `details` parse path cannot throw unhandled error for string payloads.

  **Agent-Executed QA Scenarios**:

  ```bash
  Scenario: Audit logs endpoint self-heals when table check runs
    Tool: Bash (curl + SQL check)
    Preconditions: Backend running; admin auth token available in $ADMIN_TOKEN
    Steps:
      1. Run table existence check:
         mysql -u "$DB_USER" -p"$DB_PASSWORD" -h "$DB_HOST" -D "$DB_NAME" -e "SHOW TABLES LIKE 'admin_activity_logs';"
      2. Call endpoint:
         curl -s -w "\n%{http_code}" "http://localhost:3001/api/admin/audit-logs?page=1&limit=10" -H "Authorization: Bearer $ADMIN_TOKEN"
      3. Assert HTTP status is 200.
      4. Assert JSON has keys: data.logs (array), data.pagination.totalItems (number).
      5. Re-run table existence check and assert table exists.
    Expected Result: Endpoint succeeds and table is available.
    Evidence: .sisyphus/evidence/task-1-audit-logs-self-heal.txt

  Scenario: Audit log filters endpoint returns stable empty-safe shape
    Tool: Bash (curl)
    Preconditions: Backend running; admin auth token available
    Steps:
      1. curl -s -w "\n%{http_code}" "http://localhost:3001/api/admin/audit-logs/filters" -H "Authorization: Bearer $ADMIN_TOKEN"
      2. Assert HTTP status is 200.
      3. Assert response contains data.actions (array) and data.targets (array).
    Expected Result: Non-500 response with stable contract.
    Evidence: .sisyphus/evidence/task-1-audit-filters-contract.txt

  Scenario: Auth guard remains intact (negative)
    Tool: Bash (curl)
    Preconditions: Backend running
    Steps:
      1. curl -s -w "\n%{http_code}" "http://localhost:3001/api/admin/audit-logs?page=1&limit=10"
      2. Assert HTTP status is 401 or 403.
    Expected Result: Unauthorized request is still blocked.
    Evidence: .sisyphus/evidence/task-1-audit-auth-guard.txt
  ```

  **Commit**: YES (groups with Task 3)
  - Message: `fix(audit-log): self-heal admin_activity_logs reads and preserve API contract`
  - Files: `server/controllers/auditLogController.js`
  - Pre-commit: API scenario checks above + `npm test`

---

- [ ] 2. Fix Schedule Grid sticky column readability and alignment

  **What to do**:
  - In `src/components/admin/schedules/ScheduleGridTable.tsx`, introduce shared constants for sticky column widths/offsets.
  - Increase KELAS and JAM KE minimum widths to accommodate real labels (e.g. KELAS >= 132px, JAM KE >= 72px).
  - Apply the same values consistently to:
    - header th cells
    - body sticky td cells
    - left offsets (`left-[...]`) for second sticky column
  - Keep rowSpan/special slot rendering intact.
  - Preserve accessibility and DnD behavior; layout-only changes in this task.

  **Must NOT do**:
  - Do not alter data fetch, save API logic, or drag/drop business rules.
  - Do not change schedule row semantics (MAPEL/RUANG/GURU mapping).
  - Do not touch unrelated admin pages.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI layout tuning with sticky behavior and readability constraints.
  - **Skills**: [`frontend-ui-ux`, `playwright`]
    - `frontend-ui-ux`: maintain clean visual alignment and responsive behavior.
    - `playwright`: validate visual output and interaction behavior automatically.
  - **Skills Evaluated but Omitted**:
    - `git-master`: not needed until commit/finalization step.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: 3, 4
  - **Blocked By**: None

  **References**:
  - `src/components/admin/schedules/ScheduleGridTable.tsx:781` - KELAS sticky header width and z-index.
  - `src/components/admin/schedules/ScheduleGridTable.tsx:782` - JAM KE sticky header left offset and width.
  - `src/components/admin/schedules/ScheduleGridTable.tsx:819` - KELAS sticky body cell.
  - `src/components/admin/schedules/ScheduleGridTable.tsx:827` - JAM KE sticky body cell left offset.
  - `src/components/admin/schedules/ScheduleGridTable.tsx:849` - rowSpan special-cell rendering to keep untouched.
  - `src/components/admin/schedules/ScheduleGridTable.tsx:875` - normal cell interaction area that must not regress.

  **Acceptance Criteria**:
  - [ ] KELAS text and JAM KE text are not clipped in header and body on standard desktop viewport.
  - [ ] Sticky columns remain aligned when horizontal scrolling across all days.
  - [ ] No overlap artifacts between sticky columns and schedule cells.
  - [ ] Existing keyboard/click interaction remains functional.

  **Agent-Executed QA Scenarios**:

  ```text
  Scenario: Sticky columns readable and aligned on grid load
    Tool: Playwright
    Preconditions: Frontend and backend running; admin session authenticated
    Steps:
      1. Navigate to: http://localhost:5173/admin (login if needed)
      2. Open: Grid Editor Jadwal view
      3. Wait for selector: table (timeout 10s)
      4. Assert visible text includes full "KELAS" and "JAM KE" labels in sticky headers
      5. Capture element bounds for first sticky header/body cells and assert second sticky cell x-position equals first cell width offset
      6. Screenshot: .sisyphus/evidence/task-2-grid-sticky-readable.png
    Expected Result: Labels readable and sticky offsets aligned.
    Evidence: .sisyphus/evidence/task-2-grid-sticky-readable.png

  Scenario: Horizontal scroll keeps sticky lock and no overlap
    Tool: Playwright
    Preconditions: Grid table has horizontally scrollable columns
    Steps:
      1. Locate scroll container: div.flex-1.overflow-auto
      2. Scroll horizontally to max right
      3. Assert first two columns remain fixed on left and still readable
      4. Assert no visual clipping on first visible row (`kelas.nama_kelas`, `MAPEL/RUANG/GURU`)
      5. Screenshot: .sisyphus/evidence/task-2-grid-scroll-alignment.png
    Expected Result: Sticky columns stay fixed and clean while content scrolls.
    Evidence: .sisyphus/evidence/task-2-grid-scroll-alignment.png

  Scenario: Cell interaction regression check (negative)
    Tool: Playwright
    Preconditions: Grid loaded
    Steps:
      1. Click first editable schedule cell in MAPEL row
      2. Assert edit dialog opens (`DialogTitle` contains "Edit Jadwal")
      3. Press Escape / close dialog
      4. Drag one palette item onto target cell
      5. Assert draft update toast appears
    Expected Result: Layout changes do not break click/drag workflows.
    Evidence: .sisyphus/evidence/task-2-grid-interaction-regression.png
  ```

  **Commit**: YES (groups with Task 3)
  - Message: `fix(schedule-grid): restore sticky column width alignment for kelas and jam ke`
  - Files: `src/components/admin/schedules/ScheduleGridTable.tsx`
  - Pre-commit: Playwright UI scenarios + `npm run build`

---

- [ ] 3. Run integrated regression checks for both fixes

  **What to do**:
  - Execute API scenarios from Task 1 and UI scenarios from Task 2 in one pass.
  - Validate no new console/runtime errors appear in affected pages.
  - Validate the audit log page can load filters and list with current data state.

  **Must NOT do**:
  - Do not introduce additional feature changes while verifying.
  - Do not skip negative scenarios.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Cross-cutting verification over backend and frontend runtime behavior.
  - **Skills**: [`playwright`, `dev-browser`]
    - `playwright`: deterministic browser assertions and evidence capture.
    - `dev-browser`: resilient browser interactions for admin flows.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: design creation is not needed in verification phase.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 4
  - **Blocked By**: 1, 2

  **References**:
  - `src/components/admin/AuditLogView.tsx:146` - filter request lifecycle.
  - `src/components/admin/AuditLogView.tsx:159` - logs request lifecycle.
  - `server/controllers/auditLogController.js:84` - expected success payload for logs.
  - `server/controllers/auditLogController.js:109` - expected success payload for filters.
  - `src/components/admin/schedules/ScheduleGridTable.tsx:721` - component render root for UI scenario entry.

  **Acceptance Criteria**:
  - [ ] Audit Log page renders without 500 toast/error loops.
  - [ ] Schedule Grid page renders with fixed sticky layout and working interactions.
  - [ ] Evidence artifacts exist for each scenario in `.sisyphus/evidence/`.

  **Agent-Executed QA Scenarios**:

  ```text
  Scenario: Audit log page full flow
    Tool: Playwright
    Preconditions: Authenticated admin session
    Steps:
      1. Navigate to Audit Log page
      2. Wait for table or empty-state row
      3. Assert no destructive error toast appears for audit fetch
      4. Open action filter dropdown and verify options render
      5. Screenshot: .sisyphus/evidence/task-3-audit-page-flow.png
    Expected Result: Page stable; filters and list are functional.
    Evidence: .sisyphus/evidence/task-3-audit-page-flow.png

  Scenario: Browser console cleanliness (targeted)
    Tool: Playwright
    Preconditions: Audit Log and Schedule Grid pages visited
    Steps:
      1. Collect browser console messages at warning+error level
      2. Assert no new runtime errors tied to changed files
      3. Save log snapshot
    Expected Result: No new frontend runtime regressions from planned changes.
    Evidence: .sisyphus/evidence/task-3-console-scan.txt
  ```

  **Commit**: NO

---

- [ ] 4. Final validation and commit sequence

  **What to do**:
  - Run full project verification commands:
    - `npx tsc --noEmit`
    - `npm run build`
    - `npm test`
  - Create commits in logical order (backend then frontend, or single combined if tightly coupled by release decision).
  - Ensure working tree clean after commits.

  **Must NOT do**:
  - Do not skip failing tests/build warnings.
  - Do not push with unverified results.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: deterministic validation and git hygiene workflow.
  - **Skills**: [`git-master`]
    - `git-master`: precise staging/commit message quality and clean history.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: no design work in this step.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: 3

  **References**:
  - `package.json` - canonical scripts for build and test commands.
  - `.sisyphus/evidence/` - expected evidence artifact location.

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` exits 0.
  - [ ] `npm run build` exits 0.
  - [ ] `npm test` exits 0.
  - [ ] Commit(s) created with clear messages and only intended files.

  **Agent-Executed QA Scenarios**:

  ```bash
  Scenario: Full static verification
    Tool: Bash
    Preconditions: Code changes from Tasks 1-3 complete
    Steps:
      1. Run: npx tsc --noEmit
      2. Run: npm run build
      3. Run: npm test
      4. Assert all commands exit with code 0
    Expected Result: No compile/build/test regressions.
    Evidence: .sisyphus/evidence/task-4-full-verification.txt
  ```

  **Commit**: YES
  - Message options:
    - `fix(audit-log): auto-ensure admin_activity_logs on read endpoints`
    - `fix(schedule-grid): align sticky kelas and jam columns to prevent clipping`
  - Files:
    - `server/controllers/auditLogController.js`
    - `src/components/admin/schedules/ScheduleGridTable.tsx`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 (+3 API checks) | `fix(audit-log): auto-ensure admin_activity_logs on read endpoints` | `server/controllers/auditLogController.js` | API scenarios + `npm test` |
| 2 (+3 UI checks) | `fix(schedule-grid): align sticky kelas and jam columns to prevent clipping` | `src/components/admin/schedules/ScheduleGridTable.tsx` | Playwright scenarios + `npm run build` |
| 4 | optional squash or keep atomic commits based on reviewer preference | same as above | full verification trio |

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit
npm run build
npm test
```

### Final Checklist
- [ ] Audit log endpoints no longer 500 due to missing table path.
- [ ] Audit log response shape remains frontend-compatible.
- [ ] KELAS/JAM KE sticky columns are readable and aligned under horizontal scroll.
- [ ] Grid editor interaction flow still works (click, drag, save draft behavior).
- [ ] All verification commands pass.
- [ ] Evidence artifacts captured for API/UI scenarios.
