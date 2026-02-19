# Plan: SonarQube Code Smell Cleanup (Absenta 13 v3)

## TL;DR

> **Quick Summary**: Systematic cleanup of 22 files to resolve SonarQube code smells (Cognitive Complexity, Accessibility, Unused Variables, Redundant Types).
> 
> **Deliverables**: 
> - Refactored React components with reduced complexity.
> - Improved accessibility via semantic HTML.
> - Cleaner code via removal of redundant assertions and unused vars.
> - New Vitest unit tests for extracted sub-components.
> 
> **Estimated Effort**: Large (22 files, 13k+ LOC)
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Wave 1 Scaffolding → Wave 2 Dashboard Refactors → Wave 3 Admin Views → Wave 4 Schedule Logic → Wave 5 Final QA

---

## Context

### Original Request
Fix a large list of SonarQube issues across multiple components (StudentDashboard, ScheduleGrid, etc.).

### Interview Summary
**Key Decisions**:
- **Error Handling**: Use `toast.error` for silent catch blocks EXCEPT where intentionally suppressed.
- **Accessibility**: Swap `role="button"` for semantic `<button>` (using wrappers for structural tags like `<td>`).
- **Refactoring**: Extract sub-components for files >1,000 lines to solve complexity (S3776).
- **Test Strategy**: Tests-after approach (post-refactor verification).

### Metis Review
**Identified Gaps (addressed)**:
- **UI Freeze**: Hard freeze on `src/components/ui/*`.
- **A11y Safety**: Do not break table structures (`<td>`) when adding buttons.
- **Side Effect Safety**: Verified that extraction doesn't change execution order of side effects in ternaries.
- **State Ownership**: Extraction will use props only; no state lifting or re-owning.

---

## Work Objectives

### Core Objective
Achieve "A" rating in SonarQube for Maintainability and Reliability across 22 target files.

### Concrete Deliverables
- Refactored components in `src/components/admin/*` and `src/components/schedules/*`.
- Extracted sub-components in `src/components/student/` and `src/components/teacher/`.
- Updated test suite with at least 5 new component tests.

### Definition of Done
- [ ] No SonarQube warnings for S3776, S1854, S2486 in target files.
- [ ] `npm run build` and `npm run lint` pass.
- [ ] All new Vitest tests pass.

### Must Have
- Semantic `<button>` elements for all interactive actions.
- Explicit error feedback for previously silent API failures.
- Cognitive complexity per function < 15.

### Must NOT Have (Guardrails)
- **NO** modifications to business logic or attendance calculation rules.
- **NO** changes to `src/components/ui/*`.
- **NO** state ownership changes during extraction.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest + Node test runner)
- **Automated tests**: Tests-after
- **Framework**: Vitest for Frontend, Node:test for Backend utilities.

### QA Policy
Every task includes agent-executed QA scenarios using Playwright (for UI/A11y) and Vitest (for logic).

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately — Scaffolding + Small Fixes):
├── Task 1: Scaffolding (Mock setup for component tests)
├── Task 2: Simple Smells (AuditLogView, ReportsView - unused imports/vars)
└── Task 3: Redundant Assertions (ScheduleGridEditor, GlobalEventView)

Wave 2 (Dashboard Refactors — Complexity focus):
├── Task 4: StudentDashboard.tsx (Function extraction)
├── Task 5: LiveStudentAttendanceView.tsx (Sub-component extraction)
└── Task 6: LiveTeacherAttendanceView.tsx (Sub-component extraction)

Wave 3 (Admin Views — A11y + Error Handling):
├── Task 7: SimpleRestoreView.tsx (A11y + Catch blocks)
├── Task 8: BandingAbsenManager.tsx (Complexity + Ternaries)
└── Task 9: AnalyticsDashboardView.tsx (Unused vars + Error handling)

Wave 4 (Schedule Logic — High Complexity):
├── Task 10: ScheduleGridTable.tsx (Cognitive complexity reduction)
├── Task 11: PreviewJadwalView.tsx (Cognitive complexity reduction)
└── Task 12: ManageSchedulesView.tsx (Sub-component extraction)

Wave 5 (Final Verification — Independent review):
├── Task 13: Full Integration Test Run
├── Task 14: Accessibility Audit (Playwright)
└── Task 15: Final SonarQube Sync

---

## TODOs

- [x] 1. Scaffolding: Mock Setup for Component Tests

  **What to do**:
  - Create `src/test/mocks/handlers.ts` for common API calls (`useAuth`, `apiCall`).
  - Configure Vitest to use these mocks in `src/setupTests.ts`.
  - This unblocks "Tests-after" for all subsequent tasks.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Acceptance Criteria**:
  - [ ] `npm test` still passes for existing tests.
  - [ ] Example test `src/components/__tests__/SmokeTest.test.tsx` renders without auth errors.

  **QA Scenario**:
    Scenario: Verify test scaffolding
    Tool: Bash
    Steps:
      1. Run `npm test src/components/__tests__/SmokeTest.test.tsx`
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-1-scaffolding.txt

- [x] 2. Simple Smells: AuditLogView, ReportsView (Unused imports/vars)

  **What to do**:
  - Fix AuditLogView.tsx: Remove unused `CardHeader`, `CardTitle`, `Calendar`.
  - Fix ReportsView.tsx: Handle `error` stringification in `toast.error(error.toString())`.
  - Fix StudentDashboard.tsx: Remove unused variables `setSiswaId`, `setKelasInfo`, `jadwalData`, etc.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Acceptance Criteria**:
  - [ ] No ESLint warnings for unused variables in target files.
  - [ ] `npm run lint` passes.

  **QA Scenario**:
    Scenario: Verify lint cleanliness
    Tool: Bash
    Steps:
      1. Run `npx eslint src/components/admin/AuditLogView.tsx`
    Expected Result: No "unused" warnings.
    Evidence: .sisyphus/evidence/task-2-lint.txt

- [x] 3. Dashboard Refactor: StudentDashboard.tsx (Complexity focus)

  **What to do**:
  - Extract the large `render` function logic into sub-component files in `src/components/student/`.
  - **Target**: Extract "Attendance Summary" and "Recent History" sections.
  - **Rule**: Pass state via props; do not move `useState` hooks out of the main `StudentDashboard`.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`absenta-frontend`]

  **Acceptance Criteria**:
  - [ ] File size reduced by at least 300 lines.
  - [ ] Component still renders all data correctly.
  - [ ] No regression in Tab switching behavior.

  **QA Scenario**:
    Scenario: Verify Student Dashboard functionality
    Tool: Playwright
    Steps:
      1. Login as Student.
      2. Navigate to Dashboard.
      3. Verify attendance summary and history tabs are visible.
    Expected Result: Data displays correctly; no console errors.
    Evidence: .sisyphus/evidence/task-3-student-dashboard.png

- [x] 4. Admin Views: SimpleRestoreView.tsx (A11y + Error Handling)

  **What to do**:
  - Convert `role="button"` elements to `<button>` tags.
  - Update `catch` blocks (L153, L162, L180) to use `toast.error` for visibility.
  - Fix "redundant type assertions" on L578, L585, L586.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`absenta-frontend`]

  **Acceptance Criteria**:
  - [ ] Interactive elements are focusable via Tab.
  - [ ] Type assertions removed without TS errors.

  **QA Scenario**:
    Scenario: Verify accessibility in Restore View
    Tool: Playwright
    Steps:
      1. Navigate to Restore View.
      2. Press Tab key to focus buttons.
      3. Verify focused elements have visible outlines.
    Expected Result: Buttons are focusable and accessible.
    Evidence: .sisyphus/evidence/task-4-a11y.png

- [x] 5. Schedule Logic: ScheduleGridEditor.tsx & Table (Complexity)

  **What to do**:
  - **ScheduleGridEditor.tsx**: Surgical a11y fix. Wrap contents of `<td role="button">` in a `<button type="button" className="appearance-none bg-transparent ...">`.
  - **ScheduleGridTable.tsx**: Extract the heavy nested functions (L832) into a utility file or separate sub-components to reduce cognitive complexity (S3776).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`absenta-frontend`]

  **Acceptance Criteria**:
  - [ ] Schedule grid still supports drag-and-drop.
  - [ ] Nested function complexity reduced to < 15.

  **QA Scenario**:
    Scenario: Verify Schedule Grid D&D
    Tool: Playwright
    Steps:
      1. Open Schedule Grid.
      2. Drag an item from palette to a grid cell.
    Expected Result: Drop succeeds and UI updates.
    Evidence: .sisyphus/evidence/task-5-dnd.png

- [x] 6. Final Logic Review: PreviewJadwalView.tsx

  **What to do**:
  - Refactor the main function (L74) to reduce Cognitive Complexity from 31 to < 15.
  - Split the "render logic" for different view modes (Day vs Week) into separate functions/components.
  - Fix redundant template literals on L447.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
  - **Skills**: [`absenta-frontend`]

  **Acceptance Criteria**:
  - [ ] Cognitive complexity < 15.
  - [ ] No regression in Day/Week view toggling.

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  Verify no changes to `src/components/ui/*` and no business logic drift.

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run lint` and `npm run build`.

- [x] F3. **Real Manual QA** — `unspecified-high`
  Execute all QA scenarios for dashboards and admin views.

---

## Success Criteria

### Verification Commands
```bash
npm run lint
npm run test:client
npm run build
```
