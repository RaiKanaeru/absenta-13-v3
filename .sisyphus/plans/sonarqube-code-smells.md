# Fix SonarQube Code Smells — Frontend Cleanup

## TL;DR

> **Quick Summary**: Fix ~80 SonarQube-reported code smells across 28 frontend React/TypeScript files. All fixes are behavior-preserving — no functional changes. Includes 2 Critical refactors (cognitive complexity reduction).
> 
> **Deliverables**: Clean SonarQube scan with zero open code smells in listed files
> - All nested ternaries extracted to readable variables/functions
> - Error objects properly stringified (no `[object Object]`)
> - Optional chaining applied where SonarQube flagged
> - Unnecessary type assertions removed
> - Accessibility improvements (semantic HTML)
> - Context provider values memoized
> - Array index keys replaced with stable keys
> - Unused imports/code removed
> - 2 Critical: PreviewJadwalView cognitive complexity reduced, ScheduleGridTable nesting flattened
> 
> **Estimated Effort**: Medium (~3-4 hours total, parallelized to ~1.5 hours)
> **Parallel Execution**: YES — 5 waves
> **Critical Path**: Wave 1 (shared patterns) → Wave 2 (admin/schedules) → Wave 3 (admin/students+teachers) → Wave 4 (student+teacher) → Wave 5 (UI components + verification)

---

## Context

### Original Request
User provided a comprehensive SonarQube scan report listing ~80 code smells across 28 frontend files. Issues range from Minor to Critical severity, covering patterns like nested ternaries, improper error stringification, missing optional chaining, unnecessary type assertions, accessibility violations, and more.

### Interview Summary
**Key Discussions**:
- **UI Freeze Override**: User explicitly authorized fixing UI components (`src/components/ui/*`) despite AGENTS.md UI Freeze rule — scoped ONLY to the specific SonarQube issues listed
- **Critical Refactors Included**: Both Critical issues (PreviewJadwalView cognitive complexity 31→15, ScheduleGridTable nesting >4 levels) are in scope
- **Verification Strategy**: Build check only (`tsc --noEmit` + lint) — no unit tests required

**Research Findings**:
- PreviewJadwalView.tsx L74: Function has cognitive complexity 31 (allowed: 15) — requires extracting sub-functions
- ScheduleGridTable.tsx L829: Functions nested >4 levels deep — requires restructuring render logic
- Error stringification is a pervasive pattern across student/teacher management views

### Metis Review
**Identified Gaps** (addressed):
- **Error stringification pattern**: Need a consistent approach — use `error instanceof Error ? error.message : String(error)` pattern throughout
- **Scope creep risk**: Agent must ONLY fix listed SonarQube issues, no "while I'm here" improvements
- **Cognitive complexity reduction**: Must preserve exact same behavior — extract helper functions, don't restructure logic
- **Shadcn UI components**: These are typically generated code — fixes should be minimal and targeted
- **Array index keys**: Need stable alternative keys — use item IDs or content-derived keys where available

---

## Work Objectives

### Core Objective
Resolve all ~80 open SonarQube code smell findings across the listed 28 frontend files while preserving 100% of existing behavior.

### Concrete Deliverables
- 28 frontend files modified with targeted code smell fixes
- Zero regressions: `tsc --noEmit` passes, `npm run lint` passes, `npm run build` succeeds

### Definition of Done
- [ ] `npx tsc --noEmit` exits with code 0
- [ ] `npm run lint` exits with code 0  
- [ ] `npm run build` completes successfully
- [ ] Re-running SonarQube scan on modified files shows 0 remaining open code smells for the listed issues

### Must Have
- Every SonarQube issue from the report addressed
- Behavior-preserving changes only
- Consistent error stringification pattern across all files

### Must NOT Have (Guardrails)
- ❌ NO functional/behavioral changes — only code quality improvements
- ❌ NO "while I'm here" fixes beyond the listed SonarQube issues
- ❌ NO new dependencies added
- ❌ NO restructuring of component APIs or props interfaces
- ❌ NO changes to files NOT listed in the SonarQube report
- ❌ NO modification of test files
- ❌ AI slop: NO excessive comments explaining obvious fixes, NO over-abstraction

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **Automated tests**: None (build check only per user decision)
- **Framework**: N/A
- **Verification**: `tsc --noEmit` + `npm run lint` + `npm run build`

### QA Policy
Every task MUST run build verification after changes.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **All tasks**: Use Bash — Run `npx tsc --noEmit` and `npm run lint` after each batch of changes
- **Final verification**: Run `npm run build` to confirm production build succeeds

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — error util + shared patterns):
├── Task 1: Create error stringification utility helper [quick]
├── Task 2: Fix ManageSchedulesView.tsx + CloneScheduleView.tsx + GlobalEventView.tsx [quick]

Wave 2 (Admin Schedules — heaviest files):
├── Task 3: Fix BulkAddScheduleView.tsx (3 issues) [quick]
├── Task 4: Fix DragPalette.tsx (4 issues) [quick]
├── Task 5: Fix GuruAvailabilityView.tsx (3 issues) [quick]
├── Task 6: Fix PreviewJadwalView.tsx — CRITICAL cognitive complexity reduction [deep]
├── Task 7: Fix ScheduleGridEditor.tsx (3 issues) [quick]
├── Task 8: Fix ScheduleGridTable.tsx — CRITICAL nesting depth + other issues [deep]

Wave 3 (Admin Students + Teachers — parallel batch):
├── Task 9: Fix ManageStudentDataView.tsx (7 issues) [quick]
├── Task 10: Fix ManageStudentsView.tsx (4 issues) [quick]
├── Task 11: Fix StudentPromotionView.tsx (2 issues) [quick]
├── Task 12: Fix ManageTeacherAccountsView.tsx (10 issues) [quick]
├── Task 13: Fix ManageTeacherDataView.tsx (7 issues) [quick]

Wave 4 (Student + Teacher views — parallel batch):
├── Task 14: Fix StudentDashboardComponents.tsx (4 issues) [quick]
├── Task 15: Fix student/utils.ts (1 issue) [quick]
├── Task 16: Fix AttendanceView.tsx (3 issues) [quick]
├── Task 17: Fix BandingAbsenView.tsx (3 issues) [quick]
├── Task 18: Fix HistoryView.tsx (8 issues) [quick]
├── Task 19: Fix RiwayatBandingAbsenView.tsx (2 issues) [quick]
├── Task 20: Fix ScheduleListView.tsx (2 issues) [quick]

Wave 5 (UI Components + theme-provider + Final Verification):
├── Task 21: Fix theme-provider.tsx (3 issues) [quick]
├── Task 22: Fix badge.tsx + breadcrumb.tsx (5 issues) [quick]
├── Task 23: Fix calendar.tsx + carousel.tsx + chart.tsx + form.tsx (7 issues) [quick]
├── Task 24: Full build verification [quick]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Build + lint verification (unspecified-high)
├── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Tasks 3-8 → Tasks 9-13 → Tasks 14-20 → Tasks 21-24 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 6 (Waves 3 & 4)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20 | 1 |
| 2 | — | — | 1 |
| 3-8 | 1 | 24 | 2 |
| 9-13 | 1 | 24 | 3 |
| 14-20 | 1 | 24 | 4 |
| 21-23 | — | 24 | 5 |
| 24 | 3-23 | F1-F4 | 5 |
| F1-F4 | 24 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: **2** — T1 → `quick`, T2 → `quick`
- **Wave 2**: **6** — T3-T5,T7 → `quick`, T6,T8 → `deep`
- **Wave 3**: **5** — T9-T13 → `quick`
- **Wave 4**: **7** — T14-T20 → `quick`
- **Wave 5**: **4** — T21-T24 → `quick`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## Pre-Work Baseline (MANDATORY — execute BEFORE any task)

> **Every implementation agent MUST establish a baseline before making changes.**

```bash
# Run these and record output BEFORE any modifications:
npx tsc --noEmit 2>&1 | tail -20    # Record: current error count
npm run lint 2>&1 | tail -20        # Record: current warning count  
npm run build 2>&1 | tail -20       # Record: build status
```

Save baseline to `.sisyphus/evidence/baseline-pre-work.txt`. All post-change verification compares against this baseline.

**Note**: `tsconfig.json` has `strict: false` and `strictNullChecks: false`. This means:
- Removing type assertions is safe — won't introduce new type errors
- `noUnusedLocals: false` — unused imports won't be caught by `tsc`, only by `eslint`
- Optional chaining additions are behavior-safe at compile time

---

## TODOs

- [ ] 1. Create error stringification utility pattern

  **What to do**:
  - Establish a consistent error stringification pattern to replace all `${error}` usages that produce `[object Object]`
  - The pattern is: `error instanceof Error ? error.message : String(error)` 
  - This can be a small inline utility or just a pattern to apply. Given the number of occurrences (~15), create a tiny helper in `src/lib/utils.ts`:
    ```typescript
    export function getErrorMessage(error: unknown): string {
      if (error instanceof Error) return error.message;
      return String(error);
    }
    ```
  - Import and use this in all files that have the `[object Object]` stringification issue

  **Must NOT do**:
  - Do NOT change error handling logic (try/catch structure, toast calls, etc.)
  - Do NOT modify what happens on error — only how the error message is extracted for display

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single utility function creation — trivial scope
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Knows project conventions and import patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 3-20 (all tasks that fix error stringification)
  - **Blocked By**: None

  **References**:
  - `src/lib/utils.ts` — Existing utility file where `cn()` is defined; add `getErrorMessage` here
  - `src/components/admin/schedules/BulkAddScheduleView.tsx:201` — Example of the problem: `${error}` in template literal
  - `src/components/admin/schedules/ScheduleGridTable.tsx:501` — Another example

  **WHY Each Reference Matters**:
  - `utils.ts` is the canonical location for shared utilities; adding here follows existing patterns
  - The BulkAddScheduleView and ScheduleGridTable lines show the exact pattern to search for and replace

  **Acceptance Criteria**:
  - [ ] `getErrorMessage` function exists in `src/lib/utils.ts`
  - [ ] Function handles `Error` instances, strings, and unknown objects

  **QA Scenarios**:
  ```
  Scenario: Utility function exists and is importable
    Tool: Bash
    Preconditions: File saved
    Steps:
      1. Run `npx tsc --noEmit`
      2. Grep for `getErrorMessage` in `src/lib/utils.ts`
    Expected Result: tsc passes, function found
    Evidence: .sisyphus/evidence/task-1-util-created.txt

  Scenario: No regressions in existing utils
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit` — confirm zero new errors
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt
  ```

  **Commit**: YES (groups with Task 2 — Wave 1)
  - Message: `refactor(utils): add getErrorMessage helper for safe error stringification`
  - Files: `src/lib/utils.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 2. Fix ManageSchedulesView.tsx + CloneScheduleView.tsx + GlobalEventView.tsx (minor issues)

  **What to do**:
  - **ManageSchedulesView.tsx L1**: Remove unused import of `useCallback`
  - **CloneScheduleView.tsx L126**: Remove unnecessary type assertion (e.g., `value as string` where `value` is already `string`)
  - **GlobalEventView.tsx L119**: Remove unnecessary type assertion
  - **GlobalEventView.tsx L178**: Remove unnecessary type assertion

  **Must NOT do**:
  - Do NOT restructure component logic
  - Do NOT change any imports beyond the unused one

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 4 trivial single-line fixes across 3 files
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Understands TypeScript assertion patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/admin/schedules/ManageSchedulesView.tsx:1` — Unused `useCallback` import
  - `src/components/admin/schedules/CloneScheduleView.tsx:126` — Unnecessary `as` type assertion
  - `src/components/admin/schedules/GlobalEventView.tsx:119` — Unnecessary `as` type assertion
  - `src/components/admin/schedules/GlobalEventView.tsx:178` — Unnecessary `as` type assertion

  **WHY Each Reference Matters**:
  - L1 of ManageSchedulesView: `useCallback` is imported but never used — simply remove from import destructuring
  - L126 of CloneScheduleView and L119/L178 of GlobalEventView: Type assertions that add no value because the expression is already the asserted type

  **Acceptance Criteria**:
  - [ ] `useCallback` no longer imported in ManageSchedulesView.tsx
  - [ ] No `as` type assertions at the specified lines in CloneScheduleView and GlobalEventView
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Unused import removed
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Grep for `useCallback` in ManageSchedulesView.tsx
      2. Run `npx tsc --noEmit`
    Expected Result: useCallback not found in imports, tsc passes
    Evidence: .sisyphus/evidence/task-2-unused-import.txt

  Scenario: Type assertions removed without breakage
    Tool: Bash
    Preconditions: Changes applied  
    Steps:
      1. Run `npx tsc --noEmit`
      2. Confirm no new type errors in CloneScheduleView.tsx or GlobalEventView.tsx
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-2-tsc-check.txt
  ```

  **Commit**: YES (groups with Task 1 — Wave 1)
  - Message: `refactor(schedules): remove unused import and unnecessary type assertions`
  - Files: `src/components/admin/schedules/ManageSchedulesView.tsx`, `src/components/admin/schedules/CloneScheduleView.tsx`, `src/components/admin/schedules/GlobalEventView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 3. Fix BulkAddScheduleView.tsx (3 issues)

  **What to do**:
  - **L64**: Replace `string.match(regex)` with `RegExp.exec(string)` pattern — change from `value.match(/pattern/)` to `(/pattern/).exec(value)`
  - **L201**: Replace `${error}` with `${getErrorMessage(error)}` — import `getErrorMessage` from `@/lib/utils`
  - **L415**: Replace array index key (`key={index}`) with a stable key. Look at the data being mapped — use a unique identifier from the item (e.g., `item.id`, `item.name`, or derive from content). If no stable key exists, combine multiple fields: `key={\`${item.field1}-${item.field2}\`}`

  **Must NOT do**:
  - Do NOT change regex logic or validation behavior
  - Do NOT change error handling flow
  - Do NOT restructure the mapped list

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 3 targeted single-line fixes
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Knows project import conventions

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 4, 5, 6, 7, 8)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 24
  - **Blocked By**: Task 1 (needs getErrorMessage)

  **References**:
  - `src/components/admin/schedules/BulkAddScheduleView.tsx:64` — `match()` → `exec()` conversion
  - `src/components/admin/schedules/BulkAddScheduleView.tsx:201` — Error stringification
  - `src/components/admin/schedules/BulkAddScheduleView.tsx:415` — Array index key
  - `src/lib/utils.ts` — Import `getErrorMessage` from here

  **WHY Each Reference Matters**:
  - L64: SonarQube prefers `RegExp.exec()` over `String.match()` for clarity and consistent API
  - L201: Template literal `${error}` will print `[object Object]` — use getErrorMessage
  - L415: React array index keys cause reconciliation bugs on reorder/filter — need stable keys

  **Acceptance Criteria**:
  - [ ] L64 uses `RegExp.exec()` instead of `.match()`
  - [ ] L201 uses `getErrorMessage(error)` instead of `${error}`
  - [ ] L415 uses a stable key instead of array index
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: RegExp.exec pattern applied
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Grep for `.match(` in BulkAddScheduleView.tsx near line 64
      2. Grep for `.exec(` in BulkAddScheduleView.tsx near line 64
    Expected Result: .match( not found near L64, .exec( found
    Evidence: .sisyphus/evidence/task-3-regex.txt

  Scenario: Build still passes
    Tool: Bash
    Preconditions: All changes applied
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-3-tsc.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `refactor(schedules): fix code smells in BulkAddScheduleView`
  - Files: `src/components/admin/schedules/BulkAddScheduleView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 4. Fix DragPalette.tsx (4 issues)

  **What to do**:
  - **L12**: Remove commented-out code block
  - **L35**: Remove useless assignment to variable `transform` — the variable is assigned but its value is never used. Either remove the assignment or use the variable
  - **L95**: Replace `obj && obj.prop` with optional chaining `obj?.prop`
  - **L106**: Replace `obj && obj.prop` with optional chaining `obj?.prop`

  **Must NOT do**:
  - Do NOT change drag-and-drop behavior or logic
  - Do NOT restructure the component

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 4 straightforward single-line fixes
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Understands component patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 3, 5, 6, 7, 8)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/admin/schedules/DragPalette.tsx:12` — Commented-out code to remove
  - `src/components/admin/schedules/DragPalette.tsx:35` — Useless assignment to `transform`
  - `src/components/admin/schedules/DragPalette.tsx:95` — Optional chaining candidate
  - `src/components/admin/schedules/DragPalette.tsx:106` — Optional chaining candidate

  **WHY Each Reference Matters**:
  - L12: Dead code — remove entirely
  - L35: Variable assigned but never read — either the assignment result is unused or the variable should be used downstream
  - L95, L106: `foo && foo.bar` pattern should be `foo?.bar` for readability

  **Acceptance Criteria**:
  - [ ] No commented-out code at L12
  - [ ] No useless `transform` assignment at L35
  - [ ] Optional chaining used at L95 and L106
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 4 issues fixed
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
      2. Grep for `// ` blocks near L12 in DragPalette.tsx to confirm commented code removed
      3. Grep for `?.` usage near L95 and L106
    Expected Result: tsc passes, optional chaining present
    Evidence: .sisyphus/evidence/task-4-dragpalette.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `refactor(schedules): fix code smells in DragPalette`
  - Files: `src/components/admin/schedules/DragPalette.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 5. Fix GuruAvailabilityView.tsx (3 issues)

  **What to do**:
  - **L52**: Remove unnecessary type assertion — expression already has the asserted type
  - **L56**: Remove unnecessary type assertion — expression already has the asserted type
  - **L238**: Extract nested ternary operation into a variable with descriptive name. Pattern:
    ```typescript
    // Before: condition1 ? value1 : condition2 ? value2 : value3
    // After:
    const displayValue = condition2 ? value2 : value3;
    // Then use: condition1 ? value1 : displayValue
    // OR use early returns / if-else blocks before the JSX
    ```

  **Must NOT do**:
  - Do NOT change the logic of which values are displayed
  - Do NOT restructure component flow

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 3 targeted fixes, well-defined patterns
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Understands TypeScript assertion patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 3, 4, 6, 7, 8)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/admin/schedules/GuruAvailabilityView.tsx:52` — Unnecessary type assertion
  - `src/components/admin/schedules/GuruAvailabilityView.tsx:56` — Unnecessary type assertion
  - `src/components/admin/schedules/GuruAvailabilityView.tsx:238` — Nested ternary to extract

  **WHY Each Reference Matters**:
  - L52/L56: With `strict: false`, these assertions add no value — remove `as Type` cast
  - L238: Nested ternary reduces readability — extract inner ternary to named variable

  **Acceptance Criteria**:
  - [ ] No `as` type assertions at L52 and L56
  - [ ] Nested ternary at L238 extracted to variable
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 3 issues fixed
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-5-guru-availability.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `refactor(schedules): fix code smells in GuruAvailabilityView`
  - Files: `src/components/admin/schedules/GuruAvailabilityView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 6. Fix PreviewJadwalView.tsx — CRITICAL cognitive complexity reduction (8 issues)

  **What to do**:
  - **L58**: Replace `document.body.removeChild(link)` with `link.remove()` (modern DOM API)
  - **L74**: **CRITICAL** — Refactor function starting at L74 to reduce cognitive complexity from 31 to ≤15. Strategy:
    - Extract nested ternary operations at L445, L447, L466 into named variables BEFORE the JSX return
    - Extract the matrix view section (L466+) into a separate `MatrixView` component
    - Extract the grid view section into a separate `GridView` component
    - Use early returns for edge cases
    - Each extracted function/component should handle one concern
    - **PRESERVE ALL EXISTING BEHAVIOR** — this is extract-only, no logic changes
  - **L378**: Replace `obj && obj.prop` with optional chaining `obj?.prop`
  - **L445**: Extract nested ternary into variable
  - **L447**: Extract nested ternary into variable + refactor nested template literals
  - **L466**: Extract nested ternary into variable

  **Must NOT do**:
  - ❌ Do NOT restructure the data flow, hooks, or event handlers
  - ❌ Do NOT change what is displayed or how — only HOW the code is organized
  - ❌ Do NOT modify the export interface or component props
  - ❌ Do NOT add new state, effects, or change the component API
  - ❌ Do NOT "improve" logic while extracting — copy exactly

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Critical refactor requiring careful extraction without behavior changes. Cognitive complexity reduction from 31→15 needs thoughtful decomposition.
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Understands React component patterns and project conventions

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 3, 4, 5, 7, 8)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/admin/schedules/PreviewJadwalView.tsx:58` — `removeChild` → `.remove()`
  - `src/components/admin/schedules/PreviewJadwalView.tsx:74-590` — Main component function with complexity 31
  - `src/components/admin/schedules/PreviewJadwalView.tsx:378` — Optional chaining candidate
  - `src/components/admin/schedules/PreviewJadwalView.tsx:443-448` — Nested ternary for empty state
  - `src/components/admin/schedules/PreviewJadwalView.tsx:445-466` — Nested ternaries and template literals

  **WHY Each Reference Matters**:
  - L58: Modern DOM API is cleaner and has universal browser support
  - L74-590: The cognitive complexity of 31 (limit 15) comes from nested conditionals in JSX — must extract sub-components
  - L378: Standard optional chaining improvement
  - L443-466: These nested ternaries are the primary complexity drivers — extracting them to variables is the simplest path to reducing complexity

  **Acceptance Criteria**:
  - [ ] `link.remove()` used instead of `removeChild` at L58
  - [ ] Optional chaining at L378
  - [ ] All nested ternaries extracted to named variables
  - [ ] Nested template literals simplified
  - [ ] Cognitive complexity of main component ≤ 15 (measurable by SonarQube)
  - [ ] `npx tsc --noEmit` passes
  - [ ] Extracted components render same output as before

  **QA Scenarios**:
  ```
  Scenario: Build passes after critical refactor
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
      2. Run `npm run build`
    Expected Result: Both exit code 0
    Evidence: .sisyphus/evidence/task-6-preview-jadwal-build.txt

  Scenario: No behavior change — component renders same output
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit` to confirm type safety
      2. Grep for exported component name to confirm API unchanged
      3. Count extracted sub-components/functions to verify decomposition happened
    Expected Result: tsc passes, export name matches, sub-components exist
    Evidence: .sisyphus/evidence/task-6-preview-jadwal-structure.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `refactor(schedules): reduce cognitive complexity in PreviewJadwalView`
  - Files: `src/components/admin/schedules/PreviewJadwalView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 7. Fix ScheduleGridEditor.tsx (3 issues)

  **What to do**:
  - **L77**: Mark component props as read-only — change `interface/type Props { ... }` to `Readonly<Props>` or add `readonly` modifier to each prop. Example: `const Component = ({ prop1, prop2 }: Readonly<ComponentProps>) => {`
  - **L527**: Replace `role="button"` with semantic `<button>` element. Convert the element (likely a `<div>` or `<span>`) to a `<button>` tag, keeping all existing styles and handlers. Add `type="button"` to prevent form submission.
  - **L644**: Fix `role="menu"` element to be focusable — add `tabIndex={0}` to the element, or replace with semantic `<menu>` or `<ul role="menu">` element

  **Must NOT do**:
  - Do NOT change click handlers or behavior
  - Do NOT restructure the component layout
  - Do NOT add new ARIA attributes beyond what's needed

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 3 well-defined fixes with clear patterns
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Understands React and accessibility patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 3, 4, 5, 6, 8)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/admin/schedules/ScheduleGridEditor.tsx:77` — Props interface to make read-only
  - `src/components/admin/schedules/ScheduleGridEditor.tsx:527` — `role="button"` element to convert to `<button>`
  - `src/components/admin/schedules/ScheduleGridEditor.tsx:644` — `role="menu"` needs focusability

  **WHY Each Reference Matters**:
  - L77: Readonly props prevents accidental mutation and signals immutability intent
  - L527: Semantic `<button>` provides keyboard accessibility (Enter/Space) automatically
  - L644: Interactive roles must be focusable for keyboard navigation

  **Acceptance Criteria**:
  - [ ] Props interface uses `Readonly<>` wrapper
  - [ ] L527 uses `<button>` element instead of `role="button"`
  - [ ] L644 menu element is focusable (has `tabIndex` or uses semantic element)
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 3 issues fixed
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
      2. Grep for `role="button"` in ScheduleGridEditor.tsx near L527
      3. Grep for `Readonly` in ScheduleGridEditor.tsx
    Expected Result: tsc passes, no role="button" near L527, Readonly found in props
    Evidence: .sisyphus/evidence/task-7-schedule-grid-editor.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `refactor(schedules): fix accessibility and props in ScheduleGridEditor`
  - Files: `src/components/admin/schedules/ScheduleGridEditor.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 8. Fix ScheduleGridTable.tsx — CRITICAL nesting depth + other issues (5 issues)

  **What to do**:
  - **L146**: Mark component props as read-only — wrap with `Readonly<>`
  - **L199**: Mark component props as read-only — wrap with `Readonly<>`
  - **L501**: Replace `${error}` with `${getErrorMessage(error)}` — import from `@/lib/utils`
  - **L829**: **CRITICAL** — Reduce function nesting depth from >4 levels to ≤4. The deep nesting comes from triple-nested table rendering: classes → ROW_TYPES → days → jamSlots. Strategy:
    - Extract the inner rendering logic (days × jamSlots × rowTypes) into a separate `ClassScheduleRows` component
    - The extracted component receives `kelas`, `matrixData`, `ROW_TYPES`, and needed callbacks as props
    - Keep the DnD context wrapping correct — the extracted component must still be inside the DnD provider
    - **PRESERVE ALL DRAG-AND-DROP BEHAVIOR** — verify DnD context boundaries are maintained
  - **L1035**: Fix `role="menu"` element to be focusable — add `tabIndex={0}` or use semantic element

  **Must NOT do**:
  - ❌ Do NOT change drag-and-drop logic or DnD provider hierarchy
  - ❌ Do NOT modify the table structure (rows, columns, spans)
  - ❌ Do NOT change state management or callbacks
  - ❌ Do NOT reduce file size as a goal — only reduce nesting depth
  - ❌ Do NOT add new memoization to cells

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Critical nesting depth refactor in a complex 1092-line file with DnD. Requires careful extraction while preserving drag-drop context hierarchy.
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Understands React component patterns and DnD context

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 3, 4, 5, 6, 7)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 24
  - **Blocked By**: Task 1 (needs getErrorMessage)

  **References**:
  - `src/components/admin/schedules/ScheduleGridTable.tsx:146` — Props to make read-only
  - `src/components/admin/schedules/ScheduleGridTable.tsx:199` — Props to make read-only
  - `src/components/admin/schedules/ScheduleGridTable.tsx:501` — Error stringification
  - `src/components/admin/schedules/ScheduleGridTable.tsx:808-893` — Deep nesting area (classes → ROW_TYPES → days → slots)
  - `src/components/admin/schedules/ScheduleGridTable.tsx:1035` — Menu role focusability
  - `src/lib/utils.ts` — Import `getErrorMessage` from here

  **WHY Each Reference Matters**:
  - L146/L199: Two sub-components within this file have mutable props interfaces
  - L501: Error in catch block stringified as `[object Object]`
  - L808-893: The nesting depth exceeds 4 levels — this is the critical zone requiring extraction. Already uses `DraggableItem` and `DroppableCell` sub-components, so the pattern of extraction is established
  - L1035: Menu element needs keyboard accessibility

  **Acceptance Criteria**:
  - [ ] Props at L146 and L199 use `Readonly<>` wrapper
  - [ ] L501 uses `getErrorMessage(error)` instead of `${error}`
  - [ ] Function nesting depth at L829 area reduced to ≤ 4 levels
  - [ ] Extracted component still renders inside DnD provider
  - [ ] L1035 menu element is focusable
  - [ ] `npx tsc --noEmit` passes
  - [ ] `npm run build` succeeds

  **QA Scenarios**:
  ```
  Scenario: Build passes after critical nesting refactor
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
      2. Run `npm run build`
    Expected Result: Both exit code 0
    Evidence: .sisyphus/evidence/task-8-schedule-grid-table-build.txt

  Scenario: DnD context not broken by extraction
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Grep for DnD-related imports (Draggable, Droppable) in ScheduleGridTable.tsx
      2. Verify extracted component is rendered within DnD context boundary
      3. Run `npx tsc --noEmit` to confirm type safety
    Expected Result: DnD imports present, context maintained, tsc passes
    Evidence: .sisyphus/evidence/task-8-dnd-context-check.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `refactor(schedules): reduce nesting depth in ScheduleGridTable + fix code smells`
  - Files: `src/components/admin/schedules/ScheduleGridTable.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 9. Fix ManageStudentDataView.tsx (7 issues)

  **What to do**:
  - **L61**: Replace `${error}` with `${getErrorMessage(error)}` — import from `@/lib/utils`
  - **L71**: Replace `${error}` with `${getErrorMessage(error)}`
  - **L155**: Replace `${error}` with `${getErrorMessage(error)}`
  - **L193**: Replace `${error}` with `${getErrorMessage(error)}`
  - **L201**: Replace `obj && obj.prop` with optional chaining `obj?.prop`
  - **L202**: Replace `obj && obj.prop` with optional chaining `obj?.prop`
  - **L203**: Replace `obj && obj.prop` with optional chaining `obj?.prop`

  **Must NOT do**:
  - Do NOT change error handling flow or toast messages
  - Do NOT restructure component

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 7 mechanical single-line fixes with consistent patterns
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 10, 11, 12, 13)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 24
  - **Blocked By**: Task 1 (needs getErrorMessage)

  **References**:
  - `src/components/admin/students/ManageStudentDataView.tsx:61,71,155,193` — Error stringification (4 occurrences)
  - `src/components/admin/students/ManageStudentDataView.tsx:201,202,203` — Optional chaining (3 occurrences)
  - `src/lib/utils.ts` — Import `getErrorMessage`

  **WHY Each Reference Matters**:
  - L61/71/155/193: Error objects in template literals produce `[object Object]` — use getErrorMessage
  - L201-203: Three consecutive lines with `&&` guard pattern — replace with `?.`

  **Acceptance Criteria**:
  - [ ] All 4 error stringification lines use `getErrorMessage(error)`
  - [ ] All 3 optional chaining lines use `?.`
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 7 issues fixed
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-9-student-data.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `refactor(students): fix code smells in ManageStudentDataView`
  - Files: `src/components/admin/students/ManageStudentDataView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 10. Fix ManageStudentsView.tsx (4 issues)

  **What to do**:
  - **L114**: Replace `${error}` with `${getErrorMessage(error)}`
  - **L188**: Replace `${errorDetails}` with `${getErrorMessage(errorDetails)}` (note: variable name is `errorDetails`)
  - **L191**: Replace `${error}` with `${getErrorMessage(error)}`
  - **L284**: Replace `${error}` with `${getErrorMessage(error)}`

  **Must NOT do**:
  - Do NOT change error handling flow or toast messages

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 9, 11, 12, 13)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 24
  - **Blocked By**: Task 1

  **References**:
  - `src/components/admin/students/ManageStudentsView.tsx:114,188,191,284` — Error stringification
  - `src/lib/utils.ts` — Import `getErrorMessage`

  **Acceptance Criteria**:
  - [ ] All 4 error/errorDetails stringification lines fixed
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 4 issues fixed
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-10-manage-students.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `refactor(students): fix error stringification in ManageStudentsView`
  - Files: `src/components/admin/students/ManageStudentsView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 11. Fix StudentPromotionView.tsx (2 issues)

  **What to do**:
  - **L4**: Remove unused import of `Input` — remove from import destructuring
  - **L256**: Replace `obj && obj.prop` with optional chaining `obj?.prop`

  **Must NOT do**:
  - Do NOT change component logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 9, 10, 12, 13)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/admin/students/StudentPromotionView.tsx:4` — Unused `Input` import
  - `src/components/admin/students/StudentPromotionView.tsx:256` — Optional chaining candidate

  **Acceptance Criteria**:
  - [ ] `Input` no longer imported
  - [ ] Optional chaining at L256
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Both issues fixed
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-11-student-promotion.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `refactor(students): remove unused import and add optional chaining in StudentPromotionView`
  - Files: `src/components/admin/students/StudentPromotionView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 12. Fix ManageTeacherAccountsView.tsx (10 issues)

  **What to do**:
  - **L116**: Replace `${error}` with `${getErrorMessage(error)}`
  - **L197**: Replace `${errorDetails}` with `${getErrorMessage(errorDetails)}`
  - **L204**: Replace `${error}` with `${getErrorMessage(error)}`
  - **L247**: Replace inline union type with a type alias — extract the union to a named type above the component:
    ```typescript
    type StatusType = 'active' | 'inactive' | 'all'; // or whatever the union is
    ```
  - **L270**: Remove unnecessary type assertion
  - **L272**: Remove unnecessary type assertion
  - **L293**: Replace `${error}` with `${getErrorMessage(error)}`
  - **L532**: Extract nested ternary into variable
  - **L661**: Extract nested ternary into variable
  - **L782**: Extract nested ternary into variable

  **Must NOT do**:
  - Do NOT change error handling flow
  - Do NOT restructure render logic
  - Do NOT change the meaning of the union type

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 10 issues but all are mechanical single-line patterns
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 9, 10, 11, 13)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 24
  - **Blocked By**: Task 1

  **References**:
  - `src/components/admin/teachers/ManageTeacherAccountsView.tsx:116,197,204,293` — Error stringification (4 occurrences)
  - `src/components/admin/teachers/ManageTeacherAccountsView.tsx:247` — Union type to extract
  - `src/components/admin/teachers/ManageTeacherAccountsView.tsx:270,272` — Unnecessary type assertions
  - `src/components/admin/teachers/ManageTeacherAccountsView.tsx:532,661,782` — Nested ternaries
  - `src/lib/utils.ts` — Import `getErrorMessage`

  **WHY Each Reference Matters**:
  - Error lines: Same `[object Object]` pattern as other files
  - L247: Inline union types reduce readability — extract to named alias
  - L270/272: With `strict: false`, assertions add no type safety value
  - L532/661/782: Nested ternaries in JSX — extract inner conditions to named variables

  **Acceptance Criteria**:
  - [ ] All 4 error stringification lines use `getErrorMessage`
  - [ ] Union type at L247 extracted to named type alias
  - [ ] Type assertions at L270/272 removed
  - [ ] Nested ternaries at L532/661/782 extracted
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 10 issues fixed
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-12-teacher-accounts.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `refactor(teachers): fix 10 code smells in ManageTeacherAccountsView`
  - Files: `src/components/admin/teachers/ManageTeacherAccountsView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 13. Fix ManageTeacherDataView.tsx (7 issues)

  **What to do**:
  - **L31**: Replace inline union type with a type alias
  - **L56**: Replace `${error}` with `${getErrorMessage(error)}`
  - **L122**: Replace `${error}` with `${getErrorMessage(error)}`
  - **L156**: Replace `${error}` with `${getErrorMessage(error)}`
  - **L164**: Replace `obj && obj.prop` with optional chaining `obj?.prop`
  - **L165**: Replace `obj && obj.prop` with optional chaining `obj?.prop`
  - **L166**: Replace `obj && obj.prop` with optional chaining `obj?.prop`

  **Must NOT do**:
  - Do NOT change error handling flow
  - Do NOT change the meaning of the union type

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 9, 10, 11, 12)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 24
  - **Blocked By**: Task 1

  **References**:
  - `src/components/admin/teachers/ManageTeacherDataView.tsx:31` — Union type to extract
  - `src/components/admin/teachers/ManageTeacherDataView.tsx:56,122,156` — Error stringification
  - `src/components/admin/teachers/ManageTeacherDataView.tsx:164,165,166` — Optional chaining
  - `src/lib/utils.ts` — Import `getErrorMessage`

  **Acceptance Criteria**:
  - [ ] Union type at L31 extracted to named alias
  - [ ] All 3 error stringification lines use `getErrorMessage`
  - [ ] All 3 optional chaining lines use `?.`
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 7 issues fixed
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-13-teacher-data.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `refactor(teachers): fix code smells in ManageTeacherDataView`
  - Files: `src/components/admin/teachers/ManageTeacherDataView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 14. Fix StudentDashboardComponents.tsx (4 issues)

  **What to do**:
  - **L12**: Change `import { BandingAbsen } ... export { BandingAbsen }` to `export { BandingAbsen } from '...'` — use direct re-export syntax
  - **L12**: Same for `BandingStatusAsli` — use `export { BandingStatusAsli } from '...'`
  - **L12**: Same for `BandingStatusDiajukan` — use `export { BandingStatusDiajukan } from '...'`
  - **L311**: Replace array index key (`key={index}`) with a stable key derived from the item's data

  **Must NOT do**:
  - Do NOT change what is exported
  - Do NOT restructure the component

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 15-20)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/student/StudentDashboardComponents.tsx:12` — Re-export pattern (3 items)
  - `src/components/student/StudentDashboardComponents.tsx:311` — Array index key

  **WHY Each Reference Matters**:
  - L12: Import-then-export can be simplified to `export...from` for cleaner barrel exports
  - L311: Array index keys cause React reconciliation issues when list is filtered/reordered

  **Acceptance Criteria**:
  - [ ] Re-exports use `export { X } from '...'` syntax
  - [ ] Array index key replaced with stable key
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 4 issues fixed
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-14-student-dashboard.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `refactor(student): fix re-exports and array key in StudentDashboardComponents`
  - Files: `src/components/student/StudentDashboardComponents.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 15. Fix student/utils.ts (1 issue)

  **What to do**:
  - **L92**: Fix error stringification — `'(data.error as { message?: unknown }).message || fallback'` will produce `[object Object]` if `.message` is an object. Replace with safe stringification: ensure the message is converted to string via `String(...)` or `getErrorMessage(...)` pattern.

  **Must NOT do**:
  - Do NOT change error handling logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 14, 16-20)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/student/utils.ts:92` — Error stringification with type assertion

  **Acceptance Criteria**:
  - [ ] L92 safely converts error message to string
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Issue fixed
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-15-student-utils.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `refactor(student): fix error stringification in utils`
  - Files: `src/components/student/utils.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 16. Fix AttendanceView.tsx (3 issues)

  **What to do**:
  - **L41**: Remove useless assignment to variable `setMaxDate` — the variable is destructured from a hook but never used. Remove from destructuring.
  - **L343**: Extract nested ternary operation into variable
  - **L473**: Replace array index key with stable key

  **Must NOT do**:
  - Do NOT change attendance submission logic
  - Do NOT restructure component

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 14, 15, 17-20)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/teacher/AttendanceView.tsx:41` — Unused `setMaxDate` destructured variable
  - `src/components/teacher/AttendanceView.tsx:343` — Nested ternary
  - `src/components/teacher/AttendanceView.tsx:473` — Array index key

  **Acceptance Criteria**:
  - [ ] `setMaxDate` removed from destructuring
  - [ ] Nested ternary at L343 extracted
  - [ ] Array index key at L473 replaced
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 3 issues fixed
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-16-attendance.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `refactor(teacher): fix code smells in AttendanceView`
  - Files: `src/components/teacher/AttendanceView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 17. Fix BandingAbsenView.tsx (3 issues)

  **What to do**:
  - **L191**: Extract nested ternary into variable
  - **L264**: Extract nested ternary into variable
  - **L394**: Extract nested ternary into variable

  **Must NOT do**:
  - Do NOT change banding/appeal logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 14-16, 18-20)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/teacher/BandingAbsenView.tsx:191,264,394` — Nested ternaries

  **Acceptance Criteria**:
  - [ ] All 3 nested ternaries extracted to variables
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 3 issues fixed
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-17-banding-absen.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `refactor(teacher): extract nested ternaries in BandingAbsenView`
  - Files: `src/components/teacher/BandingAbsenView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 18. Fix HistoryView.tsx (8 issues)

  **What to do**:
  - **L156**: Extract nested ternary into variable
  - **L207**: Extract nested ternary into variable
  - **L250**: Replace array index key with stable key
  - **L263**: Extract nested ternary into variable
  - **L264**: Extract nested ternary into variable
  - **L299**: Replace array index key with stable key
  - **L308**: Extract nested ternary into variable
  - **L309**: Extract nested ternary into variable

  **Must NOT do**:
  - Do NOT change history display logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 8 issues but all are the same 2 patterns: ternary extraction and key replacement
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 14-17, 19, 20)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/teacher/HistoryView.tsx:156,207,263,264,308,309` — Nested ternaries (6 occurrences)
  - `src/components/teacher/HistoryView.tsx:250,299` — Array index keys (2 occurrences)

  **Acceptance Criteria**:
  - [ ] All 6 nested ternaries extracted
  - [ ] Both array index keys replaced with stable keys
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 8 issues fixed
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-18-history.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `refactor(teacher): fix nested ternaries and array keys in HistoryView`
  - Files: `src/components/teacher/HistoryView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 19. Fix RiwayatBandingAbsenView.tsx (2 issues)

  **What to do**:
  - **L263**: Extract nested ternary into variable
  - **L266**: Extract nested ternary into variable

  **Must NOT do**:
  - Do NOT change appeal history logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 14-18, 20)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/teacher/RiwayatBandingAbsenView.tsx:263,266` — Nested ternaries

  **Acceptance Criteria**:
  - [ ] Both nested ternaries extracted
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Both issues fixed
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-19-riwayat-banding.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `refactor(teacher): extract nested ternaries in RiwayatBandingAbsenView`
  - Files: `src/components/teacher/RiwayatBandingAbsenView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 20. Fix ScheduleListView.tsx (2 issues)

  **What to do**:
  - **L33**: Extract nested ternary into variable
  - **L114**: Extract nested ternary into variable

  **Must NOT do**:
  - Do NOT change schedule display logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 14-19)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/teacher/ScheduleListView.tsx:33,114` — Nested ternaries

  **Acceptance Criteria**:
  - [ ] Both nested ternaries extracted
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Both issues fixed
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-20-schedule-list.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `refactor(teacher): extract nested ternaries in ScheduleListView`
  - Files: `src/components/teacher/ScheduleListView.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 21. Fix theme-provider.tsx (3 issues)

  **What to do**:
  - **L23**: Mark component props as read-only — wrap with `Readonly<>`
  - **L34**: Replace `window` with `globalThis` for portability
  - **L39**: Replace `window` with `globalThis` for portability

  **Must NOT do**:
  - Do NOT change theme switching logic
  - Do NOT modify the existing `useMemo` wrapping (already correct)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 22, 23)
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/theme-provider.tsx:23` — Props to make read-only
  - `src/components/theme-provider.tsx:34,39` — `window` → `globalThis`

  **WHY Each Reference Matters**:
  - L23: Readonly props is a React best practice — signals immutability
  - L34/39: `globalThis` is the portable modern equivalent of `window` — works in SSR, Workers, etc.

  **Acceptance Criteria**:
  - [ ] Props use `Readonly<>`
  - [ ] `window` replaced with `globalThis` at L34 and L39
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 3 issues fixed
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-21-theme-provider.txt
  ```

  **Commit**: YES (groups with Wave 5)
  - Message: `refactor(theme): readonly props and globalThis in theme-provider`
  - Files: `src/components/theme-provider.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 22. Fix badge.tsx + breadcrumb.tsx (5 issues)

  **What to do**:
  - **badge.tsx L30**: Remove redundant `undefined` type or `?` optional specifier — only one is needed. If the prop is `prop?: Type | undefined`, change to `prop?: Type`
  - **badge.tsx L33**: Mark component props as read-only — wrap with `Readonly<>`
  - **breadcrumb.tsx L64**: Replace `role="link"` with semantic `<a>` element — use `<a href=...>` instead
  - **breadcrumb.tsx L80**: Replace `role="presentation"` with `<img alt="">` or remove the role if element is decorative
  - **breadcrumb.tsx L95**: Replace `role="presentation"` with `<img alt="">` or remove the role if element is decorative

  **Must NOT do**:
  - Do NOT change component APIs or visual appearance
  - Do NOT add new features or styling

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 21, 23)
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/ui/badge.tsx:30` — Redundant undefined type
  - `src/components/ui/badge.tsx:33` — Props to make read-only
  - `src/components/ui/breadcrumb.tsx:64` — `role="link"` → semantic `<a>`
  - `src/components/ui/breadcrumb.tsx:80,95` — `role="presentation"` → semantic element

  **WHY Each Reference Matters**:
  - Badge L30: `?` already implies `| undefined` — having both is redundant
  - Badge L33: Readonly props best practice
  - Breadcrumb: ARIA roles should use semantic HTML equivalents for full accessibility support

  **Acceptance Criteria**:
  - [ ] Redundant `undefined` removed from badge props
  - [ ] Badge props use `Readonly<>`
  - [ ] Breadcrumb uses semantic HTML instead of ARIA roles
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 5 issues fixed
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-22-badge-breadcrumb.txt
  ```

  **Commit**: YES (groups with Wave 5)
  - Message: `refactor(ui): fix code smells in badge and breadcrumb components`
  - Files: `src/components/ui/badge.tsx`, `src/components/ui/breadcrumb.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 23. Fix calendar.tsx + carousel.tsx + chart.tsx + form.tsx (7 issues)

  **What to do**:
  - **calendar.tsx L55**: Move component definition out of parent component — extract inline component to module scope. If it references parent state, pass as props.
  - **calendar.tsx L56**: Same — move component definition out of parent
  - **carousel.tsx L123**: Wrap context provider value in `useMemo` — the value object is recreated every render. Wrap with `useMemo(() => ({ ...values }), [dep1, dep2, ...])`
  - **carousel.tsx L135**: Replace `role="region"` with semantic `<section aria-label="...">` element
  - **carousel.tsx L180**: Replace `role="group"` with semantic `<fieldset>`, `<details>`, or `<address>` element
  - **chart.tsx L48**: Wrap context provider value in `useMemo`
  - **form.tsx L36**: Wrap context provider value in `useMemo`
  - **form.tsx L80**: Wrap context provider value in `useMemo`

  **⚠️ IMPORTANT NOTE**: These are Shadcn UI generated components. Fixes should be minimal and targeted. Do NOT restructure beyond the specific SonarQube issue. The useMemo wrapping is straightforward — wrap the existing value object. For calendar component extraction, move the exact function to module scope.

  **Must NOT do**:
  - ❌ Do NOT restructure Shadcn component APIs
  - ❌ Do NOT change component visual behavior
  - ❌ Do NOT add useCallback to functions unless they are in useMemo dependency arrays
  - ❌ Do NOT "improve" Shadcn patterns — minimal fixes only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: All fixes are well-defined patterns in small UI components
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 21, 22)
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 24
  - **Blocked By**: None

  **References**:
  - `src/components/ui/calendar.tsx:55,56` — Inline component definitions
  - `src/components/ui/carousel.tsx:123` — Context value memoization
  - `src/components/ui/carousel.tsx:135` — `role="region"` → semantic element
  - `src/components/ui/carousel.tsx:180` — `role="group"` → semantic element
  - `src/components/ui/chart.tsx:48` — Context value memoization
  - `src/components/ui/form.tsx:36,80` — Context value memoization (2 occurrences)

  **WHY Each Reference Matters**:
  - Calendar L55/56: Components defined inside render create new instances every render — move to module scope
  - Carousel/Chart/Form context values: Without useMemo, every render creates a new object reference, causing all consumers to re-render unnecessarily
  - Carousel roles: Semantic HTML provides better accessibility than ARIA roles

  **Acceptance Criteria**:
  - [ ] Calendar components extracted to module scope
  - [ ] All context provider values wrapped in `useMemo`
  - [ ] Carousel uses semantic HTML elements instead of roles
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: All 7 issues fixed in UI components
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. Run `npx tsc --noEmit`
      2. Run `npm run build`
    Expected Result: Both exit code 0
    Evidence: .sisyphus/evidence/task-23-ui-components.txt

  Scenario: useMemo correctly wrapping context values
    Tool: Bash
    Steps:
      1. Grep for `useMemo` in carousel.tsx, chart.tsx, form.tsx
      2. Confirm useMemo wraps the value prop of each Provider
    Expected Result: useMemo found wrapping context values
    Evidence: .sisyphus/evidence/task-23-usememo-check.txt
  ```

  **Commit**: YES (groups with Wave 5)
  - Message: `refactor(ui): fix context memoization and accessibility in calendar, carousel, chart, form`
  - Files: `src/components/ui/calendar.tsx`, `src/components/ui/carousel.tsx`, `src/components/ui/chart.tsx`, `src/components/ui/form.tsx`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 24. Full build verification — all waves complete

  **What to do**:
  - Run comprehensive build verification after ALL tasks 1-23 are complete
  - Execute: `npx tsc --noEmit`, `npm run lint`, `npm run build`
  - If any fail, identify which task introduced the failure and fix
  - Save all verification output as evidence

  **Must NOT do**:
  - Do NOT make new code changes — only verify
  - If verification fails, report the failure for the responsible task to fix

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure verification — just running commands
  - **Skills**: [`absenta-frontend`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after all Wave 1-5 tasks)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 1-23

  **References**:
  - `package.json` — Build/lint scripts
  - `tsconfig.json` — TypeScript config

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` exits 0
  - [ ] `npm run lint` exits 0
  - [ ] `npm run build` exits 0

  **QA Scenarios**:
  ```
  Scenario: Full build verification passes
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit` — capture full output
      2. Run `npm run lint` — capture full output
      3. Run `npm run build` — capture full output
    Expected Result: All 3 exit code 0
    Evidence: .sisyphus/evidence/task-24-full-build.txt

  Scenario: No new warnings introduced
    Tool: Bash
    Steps:
      1. Compare lint output with pre-existing baseline
      2. Confirm no NEW warnings (existing ones are acceptable)
    Expected Result: Zero new warnings
    Evidence: .sisyphus/evidence/task-24-lint-comparison.txt
  ```

  **Commit**: NO (verification only)

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run `npx tsc --noEmit`). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit` + `npm run lint` + `npm run build`. Review all changed files for: remaining SonarQube patterns not fixed, `as any`/`@ts-ignore` introduced, empty catches, console.log in prod. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Build + Lint Verification** — `unspecified-high`
  Start from clean state. Run `npx tsc --noEmit`, capture output. Run `npm run lint`, capture output. Run `npm run build`, capture output. All must pass with zero errors. Save to `.sisyphus/evidence/final-build/`.
  Output: `TSC [PASS/FAIL] | Lint [PASS/FAIL] | Build [PASS/FAIL] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git diff). Verify 1:1 — everything in spec was fixed, nothing beyond spec was changed. Check no functional logic was altered. Flag unaccounted changes. Verify only files from the SonarQube report were touched.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | Behavior [PRESERVED/CHANGED] | VERDICT`

---

## Commit Strategy

- **Per-wave commits** after verification passes:
  - Wave 1: `refactor(utils): add error stringification helper + fix minor schedule issues`
  - Wave 2: `refactor(schedules): fix SonarQube code smells in schedule views`
  - Wave 3: `refactor(students,teachers): fix SonarQube code smells in admin data views`
  - Wave 4: `refactor(student,teacher): fix SonarQube code smells in student/teacher views`
  - Wave 5: `refactor(ui,theme): fix SonarQube code smells in UI components`

Pre-commit: `npx tsc --noEmit && npm run lint`

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit          # Expected: exits 0, no type errors
npm run lint              # Expected: exits 0, no lint errors
npm run build             # Expected: exits 0, production build succeeds
```

### Final Checklist
- [ ] All ~80 SonarQube code smells from report addressed
- [ ] Zero type errors introduced
- [ ] Zero lint errors introduced
- [ ] Production build succeeds
- [ ] No behavioral/functional changes
- [ ] Only files from the SonarQube report were modified
