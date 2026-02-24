# Work Plan: Code Quality & Accessibility Refactoring

## TL;DR

> **Quick Summary**: Fix 40+ code smells across Absenta 13 v3 frontend, covering accessibility violations, performance anti-patterns, and maintainability issues identified by static analysis.
> 
> **Deliverables**:
> - 18 files refactored for code quality
> - All nested ternaries flattened to independent statements
> - Context providers memoized to prevent unnecessary re-renders
> - Accessibility roles corrected (presentation, separator, region, group)
> - Array index keys replaced with stable composite keys
> - Optional chaining patterns applied consistently
> - Error handling and stringification improved
> 
> **Estimated Effort**: Medium (4-6 hours)
> **Parallel Execution**: YES — 4 waves with 5-8 tasks each
> **Critical Path**: Wave 1 (Core Utils) → Wave 2 (Contexts/Hooks) → Wave 3 (Views) → Wave 4 (UI Components)

---

## Context

### Original Request
User provided a comprehensive list of code quality issues from static analysis (likely SonarQube), covering:
- Optional chaining opportunities (instead of `&&` checks)
- Nested ternary operations to be extracted into independent statements
- Array index keys to be replaced with stable identifiers
- Context provider values needing `useMemo` for performance
- Accessibility violations (presentation roles, separator roles, missing table headers)
- Unused variables to be removed
- Error stringification fixes

### Research Findings
**Key Patterns Identified:**
1. **FontSizeContext.tsx**: Provider creates new object literal on every render; handlers also recreated each render
2. **apiClient.ts**: 3 nested ternary chains for error message/details selection (lines 113, 122, 124)
3. **HistoryView.tsx**: Uses `siswaIndex` as React key; needs composite key from `nis`, `nama`, `waktu_absen`
4. **shadcn/ui components**: Standard library components with light customization; safe to refactor
5. **BandingAbsenView.tsx**: Manual null checks where optional chaining would be cleaner

### Metis Review
**Identified Gaps** (to be addressed in guardrails):
- Must preserve error message precedence in apiClient (fallback chain is intentional)
- Must preserve localStorage → sessionStorage fallback in authUtils
- Must not change shadcn component APIs (asChild, context contracts)
- Must preserve all existing runtime behavior while improving readability

---

## Work Objectives

### Core Objective
Refactor 40+ code smells across 18 files to improve maintainability, accessibility, and performance without changing runtime behavior.

### Concrete Deliverables
- Refactored `src/components/teacher/*` (3 files)
- Refactored `src/components/ui/*` (11 files)
- Refactored `src/hooks/*` (2 files)
- Refactored `src/utils/*` (5 files)
- Refactored `src/contexts/*` (1 file)
- Refactored `src/lib/*` (1 file)
- Refactored `src/test/mocks/*` (1 file)
- Refactored `vite.config.ts`

### Definition of Done
- [ ] All nested ternaries converted to independent statements
- [ ] All array index keys replaced with stable composite keys
- [ ] All context provider values wrapped in `useMemo`
- [ ] All accessibility roles corrected per WCAG guidelines
- [ ] All optional chaining patterns applied where beneficial
- [ ] All unused variables removed
- [ ] All error stringification normalized
- [ ] TypeScript compilation passes with no new errors
- [ ] All existing functionality verified via QA scenarios

### Must Have
- Zero changes to runtime behavior
- All existing tests continue to pass
- TypeScript strict mode compatibility maintained
- ESLint/prettier compliance

### Must NOT Have (Guardrails)
- **Do NOT** change business logic or data flow
- **Do NOT** alter API contracts or function signatures
- **Do NOT** remove error handling fallbacks
- **Do NOT** change component prop interfaces
- **Do NOT** add new dependencies
- **Do NOT** refactor unrelated code while in a file
- **Do NOT** modify test assertions (only fix mock implementations)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (Vitest for frontend)
- **Automated tests**: NO — Agent-Executed QA only
- **Framework**: N/A
- **QA Method**: Playwright for UI verification, Bash for lint/build checks

### QA Policy
Every task includes agent-executed QA scenarios with evidence saved to `.sisyphus/evidence/`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Utils & Lib):
├── Task 1: apiClient.ts — Flatten nested ternaries [quick]
├── Task 2: authUtils.ts — Handle caught exceptions properly [quick]
├── Task 3: clientExcelExport.ts — Fix stringification + DOM methods [quick]
├── Task 4: printLayouts.ts — Flatten ternary + optional chaining [quick]
├── Task 5: time-utils.ts — Remove unused variables [quick]
└── Task 6: utils.ts — Fix error stringification [quick]

Wave 2 (After Wave 1 — Hooks & Contexts):
├── Task 7: useJadwalSync.ts — Fix error stringification [quick]
├── Task 8: useLetterhead.ts — Prefer default parameters [quick]
├── Task 9: FontSizeContext.tsx — Add useMemo to provider value [quick]
└── Task 10: vite.config.ts — Use node:path prefix [quick]

Wave 3 (After Wave 2 — Teacher Views):
├── Task 11: BandingAbsenView.tsx — Optional chaining + negated conditions [quick]
├── Task 12: HistoryView.tsx — Nested ternary + array index keys [unspecified-high]
└── Task 13: ScheduleListView.tsx — Flatten nested ternary [quick]

Wave 4 (After Wave 3 — UI Components):
├── Task 14: badge.tsx — Mark props as read-only [quick]
├── Task 15: breadcrumb.tsx — Fix presentation roles [quick]
├── Task 16: calendar.tsx — Move component definitions out [unspecified-high]
├── Task 17: carousel.tsx — Add useMemo to provider value [quick]
├── Task 18: chart.tsx — Add useMemo to provider value [quick]
├── Task 19: form.tsx — Add useMemo to provider values [quick]
├── Task 20: input-otp.tsx — Fix separator role [quick]
├── Task 21: report-letterhead.tsx — Fix array index keys [quick]
├── Task 22: table.tsx — Add header row or column guidance [quick]
├── Task 23: toggle-group.tsx — Add useMemo to provider value [quick]
└── Task 24: handlers.ts — Fix empty methods in mocks [quick]

Wave FINAL (After ALL tasks — verification):
├── Task F1: TypeScript compilation check (quick)
├── Task F2: ESLint check (quick)
├── Task F3: Build verification (quick)
└── Task F4: Regression test — Key user flows (unspecified-high)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1-6 | — | 11-13 (Views use Utils) |
| 7-10 | — | 11-13 |
| 11-13 | 1-10 | 14-24 |
| 14-24 | 1-13 | F1-F4 |
| F1-F4 | ALL | — |

---

## TODOs

- [ ] 1. apiClient.ts — Flatten nested ternaries

  **What to do**:
  - Refactor 3 nested ternary chains at lines 113, 122, 124 into independent statements
  - Line 113: Error message selection (errorObj.message → errorInfo.message → errorInfo.error → fallback)
  - Line 122: Error details selection (errorObj.details → errorInfo.details → undefined)
  - Line 124: Details formatting (string vs array join)
  - Use early returns or intermediate variables to flatten
  - Preserve exact precedence order of fallbacks

  **Must NOT do**:
  - Do NOT change fallback precedence or error message selection logic
  - Do NOT alter HTTP_STATUS_MESSAGES usage
  - Do NOT change function signatures

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Understanding of frontend patterns and apiClient usage

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-6)
  - **Blocks**: Tasks 11-13 (Views use apiClient)
  - **Blocked By**: None

  **References**:
  - `src/utils/apiClient.ts:113-124` — Current nested ternary implementations
  - `src/utils/apiClient.ts:HTTP_STATUS_MESSAGES` — Status code mapping constant

  **Acceptance Criteria**:
  - [ ] No nested ternaries remain in error handling logic
  - [ ] All error message fallbacks preserved exactly
  - [ ] TypeScript compilation passes

  **QA Scenarios**:
  ```
  Scenario: Error message fallback chain works correctly
    Tool: Bash
    Preconditions: Code refactored, no compilation errors
    Steps:
      1. Run `npm run build` to verify no TypeScript errors
      2. Check that error handling logic is preserved
    Expected Result: Build succeeds without errors
    Evidence: .sisyphus/evidence/task-1-build-check.txt
  ```

  **Evidence to Capture**:
  - [ ] Build output showing no errors

  **Commit**: YES
  - Message: `refactor(utils): flatten nested ternaries in apiClient`
  - Files: `src/utils/apiClient.ts`

- [ ] 2. authUtils.ts — Handle caught exceptions properly

  **What to do**:
  - Line 60: The try-catch block catches but doesn't properly handle the exception
  - Ensure caught errors are logged with meaningful messages
  - Preserve existing localStorage → sessionStorage fallback behavior
  - Do not change storage access patterns

  **Must NOT do**:
  - Do NOT remove localStorage/sessionStorage fallback logic
  - Do NOT change return types or error surfaces

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-6)
  - **Blocks**: Tasks 11-13
  - **Blocked By**: None

  **References**:
  - `src/utils/authUtils.ts:60` — Exception handling location
  - `src/utils/authUtils.ts:10-79` — Full auth utility patterns

  **Acceptance Criteria**:
  - [ ] Exception at line 60 is properly handled or re-thrown
  - [ ] Error messages are meaningful and actionable
  - [ ] All existing fallback logic preserved

  **QA Scenarios**:
  ```
  Scenario: Auth utilities handle errors gracefully
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build` to verify compilation
      2. Check error handling doesn't swallow exceptions silently
    Expected Result: Build succeeds, error handling improved
    Evidence: .sisyphus/evidence/task-2-auth-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(utils): handle caught exceptions in authUtils`
  - Files: `src/utils/authUtils.ts`

- [ ] 3. clientExcelExport.ts — Fix stringification + DOM methods

  **What to do**:
  - Line 33: Fix `'row[key] ?? ''` stringification — ensure objects don't become '[object Object]'
  - Line 60: Prefer `childNode.remove()` over `parentNode.removeChild(childNode)`
  - Ensure proper type checking before string conversion
  - Use modern DOM API

  **Must NOT do**:
  - Do NOT change export data structure
  - Do NOT alter file download behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-2, 4-6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/utils/clientExcelExport.ts:33` — Stringification issue
  - `src/utils/clientExcelExport.ts:60` — DOM method improvement

  **Acceptance Criteria**:
  - [ ] Object values properly serialized (not '[object Object]')
  - [ ] Modern DOM remove() method used
  - [ ] TypeScript compilation passes

  **QA Scenarios**:
  ```
  Scenario: Excel export handles all data types correctly
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-3-excel-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(utils): fix stringification and DOM methods in clientExcelExport`
  - Files: `src/utils/clientExcelExport.ts`

- [ ] 4. printLayouts.ts — Flatten ternary + optional chaining

  **What to do**:
  - Line 62: Flatten nested ternary for fontWeight selection
    - Current: `typeof line === 'object' ? line.fontWeight : (index === 0 ? 'bold' : 'normal')`
    - Extract into independent statements with early returns or variables
  - Line 376: Apply optional chaining where beneficial
  - Preserve logic: object uses explicit weight, string uses first=bold pattern

  **Must NOT do**:
  - Do NOT change font weight selection logic
  - Do NOT alter print layout rendering

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/utils/printLayouts.ts:62` — Nested ternary location
  - `src/utils/printLayouts.ts:376` — Optional chaining candidate

  **Acceptance Criteria**:
  - [ ] Nested ternary flattened to independent statements
  - [ ] Optional chaining applied where beneficial
  - [ ] Font weight selection logic preserved exactly

  **QA Scenarios**:
  ```
  Scenario: Print layouts render correctly after refactor
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-4-print-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(utils): flatten ternary and apply optional chaining in printLayouts`
  - Files: `src/utils/printLayouts.ts`

- [ ] 5. time-utils.ts — Remove unused variables

  **What to do**:
  - Line 338: Remove unused assignments to `year`, `month`, `day` variables
  - Check if these variables are actually needed or can be removed entirely
  - Ensure no side effects are lost

  **Must NOT do**:
  - Do NOT remove variables that are used elsewhere
  - Do NOT change time calculation logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/lib/time-utils.ts:338` — Unused variables location

  **Acceptance Criteria**:
  - [ ] Unused variables removed
  - [ ] No compilation errors
  - [ ] Time utility functions still work correctly

  **QA Scenarios**:
  ```
  Scenario: Time utilities work after removing unused variables
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-5-time-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(lib): remove unused variables in time-utils`
  - Files: `src/lib/time-utils.ts`

- [ ] 6. utils.ts — Fix error stringification

  **What to do**:
  - Line 10: Fix `'error' will use Object's default stringification format` warning
  - Ensure proper error message extraction (use `getErrorMessage` helper or similar)
  - Handle non-Error objects gracefully

  **Must NOT do**:
  - Do NOT change error handling behavior
  - Do NOT remove existing error fallback logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/lib/utils.ts:10` — Error stringification location

  **Acceptance Criteria**:
  - [ ] Error objects properly stringified
  - [ ] Non-Error objects handled gracefully
  - [ ] No '[object Object]' in error messages

  **QA Scenarios**:
  ```
  Scenario: Error utilities handle all error types
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-6-utils-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(lib): fix error stringification in utils`
  - Files: `src/lib/utils.ts`

- [ ] 7. useJadwalSync.ts — Fix error stringification

  **What to do**:
  - Line 47: Fix `'err' will use Object's default stringification format` warning
  - Use `getErrorMessage` from `@/lib/utils` or implement proper error extraction
  - Ensure non-Error objects produce meaningful messages

  **Must NOT do**:
  - Do NOT change sync logic or timing
  - Do NOT alter the hook's return values

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-10)
  - **Blocks**: None
  - **Blocked By**: Wave 1 completion recommended

  **References**:
  - `src/hooks/useJadwalSync.ts:47` — Error stringification location
  - `src/lib/utils.ts:getErrorMessage` — Helper function to use

  **Acceptance Criteria**:
  - [ ] Error properly stringified using `getErrorMessage`
  - [ ] Non-Error objects handled gracefully
  - [ ] Hook functionality unchanged

  **QA Scenarios**:
  ```
  Scenario: Hook handles errors with proper messages
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-7-hook-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(hooks): fix error stringification in useJadwalSync`
  - Files: `src/hooks/useJadwalSync.ts`

- [ ] 8. useLetterhead.ts — Prefer default parameters

  **What to do**:
  - Line 162: Replace reassignment pattern with default parameters
  - Current likely pattern: `function fn(opts) { opts = opts || {} }`
  - New pattern: `function fn(opts = {})`
  - Preserve all existing functionality

  **Must NOT do**:
  - Do NOT change function signatures in breaking ways
  - Do NOT alter letterhead data loading logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 9-10)
  - **Blocks**: None
  - **Blocked By**: Wave 1 completion recommended

  **References**:
  - `src/hooks/useLetterhead.ts:162` — Reassignment pattern location

  **Acceptance Criteria**:
  - [ ] Reassignment replaced with default parameters
  - [ ] All existing functionality preserved
  - [ ] TypeScript compilation passes

  **QA Scenarios**:
  ```
  Scenario: Hook works with default parameters
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-8-letterhead-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(hooks): use default parameters in useLetterhead`
  - Files: `src/hooks/useLetterhead.ts`

- [ ] 9. FontSizeContext.tsx — Add useMemo to provider value

  **What to do**:
  - Line 88: The context provider creates a new object literal on every render
  - Wrap the value object in `useMemo` with appropriate dependency array
  - Consider stabilizing handler functions with `useCallback` first
  - Current value includes: `fontSize`, `setFontSize`, `increaseFontSize`, `decreaseFontSize`, `resetFontSize`, `getFontSizeClass`

  **Must NOT do**:
  - Do NOT change context API or consumer usage
  - Do NOT alter font size functionality

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7-8, 10)
  - **Blocks**: Tasks 11-13 (Views use FontSizeContext)
  - **Blocked By**: Wave 1 completion recommended

  **References**:
  - `src/contexts/FontSizeContext.tsx:88` — Provider value location
  - `src/contexts/FontSizeContext.tsx:53-79` — Handler functions to stabilize

  **Acceptance Criteria**:
  - [ ] Provider value wrapped in `useMemo`
  - [ ] Handler functions stabilized with `useCallback` (optional but recommended)
  - [ ] Context functionality preserved

  **QA Scenarios**:
  ```
  Scenario: Context provider memoized correctly
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
      3. Check no missing dependencies in useMemo
    Expected Result: Build succeeds, no exhaustive-deps warnings
    Evidence: .sisyphus/evidence/task-9-context-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(contexts): memoize FontSizeContext provider value`
  - Files: `src/contexts/FontSizeContext.tsx`

- [ ] 10. vite.config.ts — Use node:path prefix

  **What to do**:
  - Line 4: Change `import path from 'path'` to `import path from 'node:path'`
  - This is a Node.js best practice for clarity
  - Ensure build still works after change

  **Must NOT do**:
  - Do NOT change any other imports
  - Do NOT alter vite configuration logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7-9)
  - **Blocks**: None
  - **Blocked By**: Wave 1 completion recommended

  **References**:
  - `vite.config.ts:4` — Path import location

  **Acceptance Criteria**:
  - [ ] Import changed to `node:path`
  - [ ] Build still works correctly

  **QA Scenarios**:
  ```
  Scenario: Vite build works with node:path prefix
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify build completes successfully
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-10-vite-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(config): use node:path prefix in vite.config`
  - Files: `vite.config.ts`

- [ ] 11. BandingAbsenView.tsx — Optional chaining + negated conditions

  **What to do**:
  - Line 365: Apply optional chaining (`textarea?.value.trim()` instead of `textarea && textarea.value.trim()`)
  - Line 367: Fix unexpected negated condition (simplify logic)
  - Line 536: Apply optional chaining
  - Line 538: Fix unexpected negated condition
  - Simplify conditionals while preserving exact behavior

  **Must NOT do**:
  - Do NOT change form submission logic
  - Do NOT alter banding response handling

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 12-13)
  - **Blocks**: None
  - **Blocked By**: Wave 1-2 completion

  **References**:
  - `src/components/teacher/BandingAbsenView.tsx:365` — Optional chaining candidate
  - `src/components/teacher/BandingAbsenView.tsx:367` — Negated condition
  - `src/components/teacher/BandingAbsenView.tsx:536` — Optional chaining candidate
  - `src/components/teacher/BandingAbsenView.tsx:538` — Negated condition

  **Acceptance Criteria**:
  - [ ] Optional chaining applied to textarea checks
  - [ ] Negated conditions simplified
  - [ ] Exact behavior preserved

  **QA Scenarios**:
  ```
  Scenario: Banding view works after refactor
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-11-banding-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(teacher): apply optional chaining and fix conditions in BandingAbsenView`
  - Files: `src/components/teacher/BandingAbsenView.tsx`

- [ ] 12. HistoryView.tsx — Nested ternary + array index keys

  **What to do**:
  - Line 178: Extract nested ternary into independent statements
    - Current: `loading ? ... : Object.keys(historyData).length === 0 ? ... : ...`
    - Use early returns or pre-computed render branches
  - Line 268: Replace array index key with stable composite key
    - Use: `${siswa.nis ?? siswa.nama}-${siswa.waktu_absen ?? 'na'}-${siswa.status}`
  - Line 310: Replace array index key in mobile cards
    - Use same composite key strategy

  **Must NOT do**:
  - Do NOT change data fetching logic
  - Do NOT alter history display format
  - Do NOT lose the stable key requirement (must be unique per row)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`absenta-frontend`, `frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 13)
  - **Blocks**: None
  - **Blocked By**: Wave 1-2 completion

  **References**:
  - `src/components/teacher/HistoryView.tsx:178` — Nested ternary location
  - `src/components/teacher/HistoryView.tsx:268` — Array index key (desktop)
  - `src/components/teacher/HistoryView.tsx:310` — Array index key (mobile)

  **Acceptance Criteria**:
  - [ ] Nested ternary flattened to independent statements
  - [ ] Array index keys replaced with composite keys
  - [ ] No duplicate key warnings in console
  - [ ] Table renders correctly with stable keys

  **QA Scenarios**:
  ```
  Scenario: History view renders without key warnings
    Tool: Bash + Browser console check
    Preconditions: Code refactored, app running
    Steps:
      1. Run `npm run build`
      2. Open browser dev console
      3. Navigate to history view
      4. Check for duplicate key warnings
    Expected Result: No key warnings in console
    Evidence: .sisyphus/evidence/task-12-history-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(teacher): flatten ternary and fix keys in HistoryView`
  - Files: `src/components/teacher/HistoryView.tsx`

- [ ] 13. ScheduleListView.tsx — Flatten nested ternary

  **What to do**:
  - Line 68: Extract nested ternary into independent statement
  - Current likely pattern involves conditional rendering logic
  - Flatten while preserving exact display behavior

  **Must NOT do**:
  - Do NOT change schedule display logic
  - Do NOT alter data filtering

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11-12)
  - **Blocks**: None
  - **Blocked By**: Wave 1-2 completion

  **References**:
  - `src/components/teacher/ScheduleListView.tsx:68` — Nested ternary location

  **Acceptance Criteria**:
  - [ ] Nested ternary flattened
  - [ ] Exact rendering behavior preserved

  **QA Scenarios**:
  ```
  Scenario: Schedule list renders correctly
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-13-schedule-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(teacher): flatten nested ternary in ScheduleListView`
  - Files: `src/components/teacher/ScheduleListView.tsx`

- [ ] 14. badge.tsx — Mark props as read-only

  **What to do**:
  - Line 32: Mark component props as read-only using `Readonly<T>` or `readonly` modifiers
  - Ensure TypeScript immutability best practices

  **Must NOT do**:
  - Do NOT change component behavior
  - Do NOT alter styling or variants

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 15-24)
  - **Blocks**: None
  - **Blocked By**: Wave 3 completion

  **References**:
  - `src/components/ui/badge.tsx:32` — Props definition location

  **Acceptance Criteria**:
  - [ ] Props marked as read-only
  - [ ] Component functionality unchanged

  **QA Scenarios**:
  ```
  Scenario: Badge component works with read-only props
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-14-badge-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): mark props as read-only in badge`
  - Files: `src/components/ui/badge.tsx`

- [ ] 15. breadcrumb.tsx — Fix presentation roles

  **What to do**:
  - Line 79: Replace `role="presentation"` with proper accessible element or remove
  - Line 94: Replace `role="presentation"` with proper accessible element or remove
  - Consider using semantic HTML or proper ARIA labels
  - Preserve shadcn component API

  **Must NOT do**:
  - Do NOT change component API (asChild, props)
  - Do NOT alter breadcrumb navigation behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14, 16-24)
  - **Blocks**: None
  - **Blocked By**: Wave 3 completion

  **References**:
  - `src/components/ui/breadcrumb.tsx:79` — BreadcrumbSeparator role
  - `src/components/ui/breadcrumb.tsx:94` — BreadcrumbEllipsis role

  **Acceptance Criteria**:
  - [ ] Presentation roles replaced or properly justified
  - [ ] Accessibility improved
  - [ ] Component API preserved

  **QA Scenarios**:
  ```
  Scenario: Breadcrumb has proper accessibility
    Tool: Bash + Accessibility check
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
      3. Check accessibility tree if possible
    Expected Result: Build succeeds, roles are valid
    Evidence: .sisyphus/evidence/task-15-breadcrumb-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): fix presentation roles in breadcrumb`
  - Files: `src/components/ui/breadcrumb.tsx`

- [ ] 16. calendar.tsx — Move component definitions out

  **What to do**:
  - Lines 55-56: Component definitions inside parent component cause re-creation on every render
  - Move sub-component definitions outside parent component
  - Pass data as props instead of capturing from closure
  - Preserve all functionality

  **Must NOT do**:
  - Do NOT change calendar behavior or date logic
  - Do NOT alter styling

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14-15, 17-24)
  - **Blocks**: None
  - **Blocked By**: Wave 3 completion

  **References**:
  - `src/components/ui/calendar.tsx:55` — Nested component location
  - `src/components/ui/calendar.tsx:56` — Nested component location

  **Acceptance Criteria**:
  - [ ] Components moved outside parent
  - [ ] Data passed as props
  - [ ] Calendar functionality preserved

  **QA Scenarios**:
  ```
  Scenario: Calendar works after component extraction
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-16-calendar-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): move component definitions out in calendar`
  - Files: `src/components/ui/calendar.tsx`

- [ ] 17. carousel.tsx — Add useMemo to provider value

  **What to do**:
  - Line 124: Context provider creates new object on every render
  - Wrap CarouselContext.Provider value in `useMemo`
  - Include dependencies: `carouselRef`, `api`, `opts`, `orientation`, `scrollPrev`, `scrollNext`, `canScrollPrev`, `canScrollNext`
  - Line 135: Fix region role (use `<section aria-label>` or `<section aria-labelledby>`)
  - Line 180: Fix group role (use `<details>`, `<fieldset>`, `<optgroup>`, or `<address>`)

  **Must NOT do**:
  - Do NOT change Embla carousel behavior
  - Do NOT alter component API

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14-16, 18-24)
  - **Blocks**: None
  - **Blocked By**: Wave 3 completion

  **References**:
  - `src/components/ui/carousel.tsx:124` — Provider value location
  - `src/components/ui/carousel.tsx:135` — Region role
  - `src/components/ui/carousel.tsx:180` — Group role

  **Acceptance Criteria**:
  - [ ] Provider value memoized with useMemo
  - [ ] Region role replaced with semantic element
  - [ ] Group role replaced with semantic element

  **QA Scenarios**:
  ```
  Scenario: Carousel performance and accessibility improved
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-17-carousel-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): memoize provider and fix roles in carousel`
  - Files: `src/components/ui/carousel.tsx`

- [ ] 18. chart.tsx — Add useMemo to provider value

  **What to do**:
  - Line 48: Context provider creates new object on every render
  - Wrap value in `useMemo` with appropriate dependencies
  - Preserve chart functionality

  **Must NOT do**:
  - Do NOT change chart rendering logic
  - Do NOT alter Recharts integration

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14-17, 19-24)
  - **Blocks**: None
  - **Blocked By**: Wave 3 completion

  **References**:
  - `src/components/ui/chart.tsx:48` — Provider value location

  **Acceptance Criteria**:
  - [ ] Provider value memoized
  - [ ] Chart functionality preserved

  **QA Scenarios**:
  ```
  Scenario: Chart context provider memoized
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-18-chart-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): memoize provider value in chart`
  - Files: `src/components/ui/chart.tsx`

- [ ] 19. form.tsx — Add useMemo to provider values

  **What to do**:
  - Line 36: FormFieldContext.Provider value needs useMemo
  - Line 83: FormItemContext.Provider value needs useMemo
  - Wrap both value objects in useMemo with proper dependencies
  - Preserve form functionality and React Hook Form integration

  **Must NOT do**:
  - Do NOT change form validation logic
  - Do NOT alter React Hook Form integration

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14-18, 20-24)
  - **Blocks**: None
  - **Blocked By**: Wave 3 completion

  **References**:
  - `src/components/ui/form.tsx:36` — FormFieldContext provider
  - `src/components/ui/form.tsx:83` — FormItemContext provider

  **Acceptance Criteria**:
  - [ ] Both provider values memoized
  - [ ] Form functionality preserved

  **QA Scenarios**:
  ```
  Scenario: Form context providers memoized
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-19-form-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): memoize form context providers`
  - Files: `src/components/ui/form.tsx`

- [ ] 20. input-otp.tsx — Fix separator role

  **What to do**:
  - Line 63: Replace `role="separator"` with `<hr>` element
  - Ensure proper accessibility across devices

  **Must NOT do**:
  - Do NOT change OTP input behavior
  - Do NOT alter styling significantly

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14-19, 21-24)
  - **Blocks**: None
  - **Blocked By**: Wave 3 completion

  **References**:
  - `src/components/ui/input-otp.tsx:63` — Separator role location

  **Acceptance Criteria**:
  - [ ] Separator role replaced with `<hr>`
  - [ ] Accessibility improved

  **QA Scenarios**:
  ```
  Scenario: OTP input has proper separator
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-20-otp-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): use hr element instead of separator role`
  - Files: `src/components/ui/input-otp.tsx`

- [ ] 21. report-letterhead.tsx — Fix array index keys

  **What to do**:
  - Line 79: Replace array index in keys with stable identifier
  - Use composite key if no unique ID available
  - Preserve letterhead rendering

  **Must NOT do**:
  - Do NOT change letterhead content
  - Do NOT alter print layout

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14-20, 22-24)
  - **Blocks**: None
  - **Blocked By**: Wave 3 completion

  **References**:
  - `src/components/ui/report-letterhead.tsx:79` — Array index key location

  **Acceptance Criteria**:
  - [ ] Array index key replaced with stable key
  - [ ] No duplicate key warnings

  **QA Scenarios**:
  ```
  Scenario: Report letterhead renders without key warnings
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-21-letterhead-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): fix array index keys in report-letterhead`
  - Files: `src/components/ui/report-letterhead.tsx`

- [ ] 22. table.tsx — Add header guidance

  **What to do**:
  - Line 10: Table component needs valid header row or column
  - This is a composable component — add documentation/guidance
  - Consider adding default `scope="col"` to TableHead if not present
  - Note: Usage sites should add proper TableHeader/TableHead

  **Must NOT do**:
  - Do NOT force headers on all tables (breaks flexibility)
  - Do NOT change composable API

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14-21, 23-24)
  - **Blocks**: None
  - **Blocked By**: Wave 3 completion

  **References**:
  - `src/components/ui/table.tsx:10` — Table component structure
  - `src/components/ui/table.tsx:19` — TableHeader exists
  - `src/components/ui/table.tsx:69` — TableHead exists

  **Acceptance Criteria**:
  - [ ] TableHead adds `scope="col"` by default (if not already present)
  - [ ] Component remains flexible

  **QA Scenarios**:
  ```
  Scenario: Table component has proper header support
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-22-table-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): add scope attribute to table head`
  - Files: `src/components/ui/table.tsx`

- [ ] 23. toggle-group.tsx — Add useMemo to provider value

  **What to do**:
  - Line 25: Context provider value needs memoization
  - Wrap in `useMemo` with appropriate dependencies
  - Preserve toggle group functionality

  **Must NOT do**:
  - Do NOT change toggle behavior
  - Do NOT alter Radix UI integration

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14-22, 24)
  - **Blocks**: None
  - **Blocked By**: Wave 3 completion

  **References**:
  - `src/components/ui/toggle-group.tsx:25` — Provider value location

  **Acceptance Criteria**:
  - [ ] Provider value memoized
  - [ ] Toggle group works correctly

  **QA Scenarios**:
  ```
  Scenario: Toggle group provider memoized
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm run build`
      2. Verify no TypeScript errors
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-23-toggle-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): memoize toggle-group provider value`
  - Files: `src/components/ui/toggle-group.tsx`

- [ ] 24. handlers.ts — Fix empty methods in mocks

  **What to do**:
  - Line 268: Remove useless constructor or add implementation
  - Line 269: Implement or remove empty `disconnect` method
  - Line 270: Implement or remove empty `observe` method
  - Line 274: Implement or remove empty `unobserve` method
  - These are test mocks — can add minimal stub implementations

  **Must NOT do**:
  - Do NOT remove mock entirely if used by tests
  - Do NOT change mock interface

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14-23)
  - **Blocks**: None
  - **Blocked By**: Wave 3 completion

  **References**:
  - `src/test/mocks/handlers.ts:268` — Useless constructor
  - `src/test/mocks/handlers.ts:269` — Empty disconnect
  - `src/test/mocks/handlers.ts:270` — Empty observe
  - `src/test/mocks/handlers.ts:274` — Empty unobserve

  **Acceptance Criteria**:
  - [ ] Constructor fixed or removed
  - [ ] Empty methods have minimal implementation or are removed
  - [ ] Tests still pass

  **QA Scenarios**:
  ```
  Scenario: Mock handlers work correctly
    Tool: Bash
    Preconditions: Code refactored
    Steps:
      1. Run `npm test` to verify tests still pass
      2. Check no empty method warnings
    Expected Result: Tests pass
    Evidence: .sisyphus/evidence/task-24-mocks-check.txt
  ```

  **Commit**: YES
  - Message: `refactor(test): fix empty methods in mock handlers`
  - Files: `src/test/mocks/handlers.ts`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **TypeScript Compilation Check** — `quick`
  
  Read the plan end-to-end. Run `npm run build` or `tsc --noEmit` to verify:
  - Zero TypeScript compilation errors
  - No type mismatches introduced by refactors
  - All imports resolve correctly
  
  Output: `TypeScript [PASS/FAIL] | Errors [count] | VERDICT: APPROVE/REJECT`

  **QA Scenarios**:
  ```
  Scenario: TypeScript compilation passes
    Tool: Bash
    Preconditions: All tasks completed
    Steps:
      1. Run `npm run build`
      2. Capture all output
      3. Check for "error" keywords
    Expected Result: Zero errors, build succeeds
    Evidence: .sisyphus/evidence/final-ts-check.txt
  ```

- [ ] F2. **ESLint Check** — `quick`
  
  Run `npm run lint` to verify:
  - No new linting errors introduced
  - Code style maintained
  - No unused variables or imports
  
  Output: `ESLint [PASS/FAIL] | Warnings [count] | Errors [count] | VERDICT`

  **QA Scenarios**:
  ```
  Scenario: ESLint passes with no new errors
    Tool: Bash
    Preconditions: All tasks completed
    Steps:
      1. Run `npm run lint`
      2. Check for errors vs warnings
    Expected Result: Zero errors (warnings acceptable)
    Evidence: .sisyphus/evidence/final-lint-check.txt
  ```

- [ ] F3. **Build Verification** — `quick`
  
  Verify production build works:
  - Run `npm run build`
  - Check dist folder is created
  - No build-time errors
  
  Output: `Build [PASS/FAIL] | Output size [MB] | VERDICT`

  **QA Scenarios**:
  ```
  Scenario: Production build succeeds
    Tool: Bash
    Preconditions: All tasks completed
    Steps:
      1. Run `npm run build`
      2. Verify dist/ folder exists
      3. Check for build errors
    Expected Result: Build succeeds, artifacts created
    Evidence: .sisyphus/evidence/final-build-check.txt
  ```

- [ ] F4. **Regression Test — Key User Flows** — `unspecified-high`
  
  Test critical user paths:
  - Login flow (Admin, Guru, Siswa)
  - Attendance input
  - History view
  - Export functionality
  
  Use Playwright or manual verification. Capture screenshots of key screens.
  
  Output: `Flows [N/N pass] | Screenshots captured | VERDICT`

  **QA Scenarios**:
  ```
  Scenario: Critical user flows work after refactoring
    Tool: Playwright (or manual verification)
    Preconditions: App running (npm run dev:full)
    Steps:
      1. Navigate to login page
      2. Login as each role
      3. Access attendance features
      4. View history
      5. Test export functionality
    Expected Result: All flows work, no console errors
    Evidence: .sisyphus/evidence/final-regression/*.png
  ```

---

## Commit Strategy

- **Wave 1**: `refactor(utils): fix code smells in utilities`
  - Files: `src/utils/apiClient.ts`, `src/utils/authUtils.ts`, `src/utils/clientExcelExport.ts`, `src/utils/printLayouts.ts`
  - Pre-commit: `npm run build`
  
- **Wave 2**: `refactor(lib): fix code smells in lib utils`
  - Files: `src/lib/time-utils.ts`, `src/lib/utils.ts`
  - Pre-commit: `npm run build`

- **Wave 3**: `refactor(hooks): fix code smells in hooks`
  - Files: `src/hooks/useJadwalSync.ts`, `src/hooks/useLetterhead.ts`
  - Pre-commit: `npm run build`

- **Wave 4**: `refactor(contexts): memoize FontSizeContext`
  - Files: `src/contexts/FontSizeContext.tsx`
  - Pre-commit: `npm run build`

- **Wave 5**: `refactor(config): use node:path prefix`
  - Files: `vite.config.ts`
  - Pre-commit: `npm run build`

- **Wave 6**: `refactor(teacher): fix code smells in teacher views`
  - Files: `src/components/teacher/BandingAbsenView.tsx`, `src/components/teacher/HistoryView.tsx`, `src/components/teacher/ScheduleListView.tsx`
  - Pre-commit: `npm run build`

- **Wave 7**: `refactor(ui): fix accessibility and performance in UI components`
  - Files: All `src/components/ui/*.tsx` files
  - Pre-commit: `npm run build`

- **Wave 8**: `refactor(test): fix mock handler issues`
  - Files: `src/test/mocks/handlers.ts`
  - Pre-commit: `npm test`

---

## Success Criteria

### Verification Commands
```bash
# TypeScript compilation
npm run build

# Linting
npm run lint

# Testing
npm test

# Dev server smoke test
npm run dev:full &
# Wait for startup, then verify login page loads
```

### Final Checklist
- [ ] All nested ternaries flattened to independent statements
- [ ] All array index keys replaced with stable composite keys
- [ ] All context provider values wrapped in `useMemo`
- [ ] All accessibility roles corrected (presentation, separator, region, group)
- [ ] All optional chaining patterns applied where beneficial
- [ ] All unused variables removed
- [ ] All error stringification normalized
- [ ] TypeScript compilation passes with zero errors
- [ ] ESLint passes with zero errors
- [ ] Production build succeeds
- [ ] Critical user flows verified (login, attendance, history, export)
- [ ] No regression in functionality

### Evidence Locations
- Build logs: `.sisyphus/evidence/task-*-check.txt`
- Screenshots: `.sisyphus/evidence/final-regression/*.png`
- Final verification: `.sisyphus/evidence/final-*.txt`
