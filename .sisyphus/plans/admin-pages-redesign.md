# Admin Management Pages UX Redesign

## TL;DR

> **Quick Summary**: Redesign all 7 remaining admin management pages + fix Excel import flow to match the modern UX pattern established in ManageRoomsView.tsx (Sheet sidebar forms, stat cards, skeleton loading, sortable columns, AlertDialog confirmations).
> 
> **Deliverables**:
> - 7 redesigned admin page components
> - 1 fixed shared ExcelImportView component
> - Consistent UX across all admin management pages
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 2 waves + final verification
> **Critical Path**: All tasks independent → Wave 1 (4 parallel) → Wave 2 (4 parallel) → Final (3 parallel)

---

## Context

### Original Request
User wants to update all admin management pages because they feel "kurang optimal" (not optimal) and "masih ribet" (still complicated). The rooms page was already redesigned as a proof-of-concept and committed (`55c999c6`).

### Interview Summary
**Key Discussions**:
- Rooms page redesign approved and deployed — serves as the template for all other pages
- All 7 remaining pages need the same UX patterns applied consistently
- Excel import flow is broken UX-wise: after successful import, user is stuck on import page with just a toast

**Research Findings**:
- ManageSubjectsView: Has AlertDialog in JSX BUT also uses `globalThis.confirm` inside `handleDelete` function — double pattern, needs cleanup
- ManageClassesView: Uses `globalThis.confirm` in `handleDelete`, already has AlertDialog wrappers in JSX — remove `globalThis.confirm`
- ManageSchedulesView: Uses bare `confirm()`, has 5 sub-components (ScheduleGridTable, ScheduleGridEditor, BulkAddScheduleView, CloneScheduleView, PreviewJadwalView) — only redesign main list view
- Server-side pagination pages (TeacherAccounts, Students): Must preserve AbortController pattern
- ExcelImportView: `onBack` only called via manual button click, never auto-called after success

### Gap Analysis (Self-conducted — Metis timeout)
**Addressed gaps**:
- Schedule page scope: Only redesign ManageSchedulesView.tsx list view, NOT the 5 sub-components
- Server-side pagination preservation: Tasks explicitly preserve AbortController + pagination params
- Double-confirm pattern: Both ManageSubjectsView AND ManageClassesView have AlertDialog in JSX but also use `globalThis.confirm` in the handler — plan removes the `globalThis.confirm` from handlers since AlertDialog already covers the UX

---

## Work Objectives

### Core Objective
Apply the proven ManageRoomsView.tsx UX pattern to all 7 remaining admin management pages, and fix the shared ExcelImportView post-import navigation flow.

### Concrete Deliverables
- `src/components/ExcelImportView.tsx` — Auto-navigate back after successful import
- `src/components/admin/classes/ManageClassesView.tsx` — Full UX redesign
- `src/components/admin/subjects/ManageSubjectsView.tsx` — Full UX redesign
- `src/components/admin/teachers/ManageTeacherDataView.tsx` — Full UX redesign
- `src/components/admin/students/ManageStudentDataView.tsx` — Full UX redesign
- `src/components/admin/teachers/ManageTeacherAccountsView.tsx` — Full UX redesign
- `src/components/admin/students/ManageStudentsView.tsx` — Full UX redesign
- `src/components/admin/schedules/ManageSchedulesView.tsx` — Partial UX redesign (list view only)

### Definition of Done
- [ ] `npm run build` passes with zero errors
- [ ] All 8 pages load without console errors
- [ ] All pages have consistent UX patterns (stats, Sheet, skeleton, AlertDialog, sortable, footer)
- [ ] Excel import auto-navigates back after success on all pages that use it

### Must Have
- Sheet sidebar form (replace Dialog/inline Card forms)
- Stat cards with `useMemo` computed values at top
- Skeleton loading states (isLoading initialized as `true`)
- Separate `isSaving` state for form submissions
- AlertDialog for ALL delete confirmations (no `globalThis.confirm` or `confirm()`)
- Footer count "Menampilkan X dari Y"
- Status filter tabs with Badge counts (where applicable — pages with status field)
- Sortable table columns with arrow icons
- Import onBack calls fetchData() for auto-refresh
- Desktop Table + Mobile Card responsive views preserved

### Must NOT Have (Guardrails)
- DO NOT modify any sub-components of ManageSchedulesView (ScheduleGridTable, ScheduleGridEditor, BulkAddScheduleView, CloneScheduleView, PreviewJadwalView)
- DO NOT change UI components in `src/components/ui/*`
- DO NOT change backend API routes or controllers
- DO NOT change types in `src/types/dashboard.ts`
- DO NOT switch server-side pagination pages to client-side pagination
- DO NOT add new npm dependencies
- DO NOT add excessive comments or JSDoc to component files
- DO NOT abstract/extract shared utilities across pages (each page is self-contained)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest for frontend)
- **Automated tests**: None for this task (pure UI redesign, no logic changes)
- **Framework**: vitest (available but not used for this task)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Build verification**: `npm run build` must pass
- **TypeScript check**: `npx tsc --noEmit` must pass (or zero new errors)
- **UI verification**: Playwright screenshot of each redesigned page

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start immediately — 4 quick/medium tasks, all independent):
├── Task 1: Fix ExcelImportView post-import UX [quick]
├── Task 2: Redesign ManageClassesView [visual-engineering]
├── Task 3: Redesign ManageSubjectsView [visual-engineering]
└── Task 4: Redesign ManageTeacherDataView [visual-engineering]

Wave 2 (After Wave 1 — 4 medium/complex tasks, all independent):
├── Task 5: Redesign ManageStudentDataView [visual-engineering]
├── Task 6: Redesign ManageTeacherAccountsView [visual-engineering]
├── Task 7: Redesign ManageStudentsView [visual-engineering]
└── Task 8: Redesign ManageSchedulesView [deep]

Wave FINAL (After ALL tasks — verification):
├── Task F1: Build + TypeScript verification [quick]
├── Task F2: Cross-page visual consistency QA [visual-engineering]
└── Task F3: Scope fidelity check [deep]

Critical Path: T1-T4 (parallel) → T5-T8 (parallel) → F1-F3 (parallel)
Parallel Speedup: ~75% faster than sequential
Max Concurrent: 4 (Wave 1 & 2)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| T1 | None | F1-F3 |
| T2 | None | F1-F3 |
| T3 | None | F1-F3 |
| T4 | None | F1-F3 |
| T5 | None | F1-F3 |
| T6 | None | F1-F3 |
| T7 | None | F1-F3 |
| T8 | None | F1-F3 |
| F1 | T1-T8 | — |
| F2 | T1-T8 | — |
| F3 | T1-T8 | — |

### Agent Dispatch Summary

- **Wave 1**: **4** — T1 → `quick`, T2-T4 → `visual-engineering`
- **Wave 2**: **4** — T5-T7 → `visual-engineering`, T8 → `deep`
- **FINAL**: **3** — F1 → `quick`, F2 → `visual-engineering`, F3 → `deep`

---

## TODOs

- [ ] 1. Fix ExcelImportView Post-Import Navigation

  **What to do**:
  - In `src/components/ExcelImportView.tsx`, after successful import (toast with "Import Berhasil"), add auto-navigation back to the list view
  - After the success toast, call `onBack()` with a 2-second delay using `setTimeout(() => onBack(), 2000)` so user can see the success message before navigating away
  - Alternatively, show a prominent success state with a large "Kembali ke Daftar" button that auto-triggers after 3 seconds
  - In ALL parent pages that use ExcelImportView, ensure the `onBack` callback calls `fetchData()` to refresh the list after import (follow the pattern already in ManageRoomsView)
  - Check these parent files for import onBack pattern and fix if needed:
    - `ManageSubjectsView.tsx` line 149: `onBack={() => setShowImport(false)}` — NEEDS fix: add `fetchSubjects()` call
    - `ManageClassesView.tsx` line 122: `onBack={() => setShowImport(false)}` — NEEDS fix: add `fetchClasses()` call
    - `ManageSchedulesView.tsx` line 465: `onBack={() => setShowImport(false)}` — NEEDS fix: add `refreshSchedules()` call
    - `ManageTeacherAccountsView.tsx` — check and fix similarly
    - `ManageStudentsView.tsx` — check and fix similarly
    - `ManageTeacherDataView.tsx` — check and fix similarly
    - `ManageStudentDataView.tsx` — check and fix similarly

  **Must NOT do**:
  - Do NOT change the ExcelImportView props interface
  - Do NOT modify the import API call logic
  - Do NOT change file validation or preview logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/rooms/ManageRoomsView.tsx` — The redesigned onBack pattern: `onBack={() => { setShowImport(false); fetchRooms(); }}`

  **API/Type References**:
  - `src/components/ExcelImportView.tsx` — The shared component (695 lines). Look for the success handling (toast "Import Berhasil") and add auto-navigation

  **Acceptance Criteria**:

  ```
  Scenario: Import auto-navigates back after success
    Tool: Bash (grep)
    Steps:
      1. Search all parent pages for ExcelImportView onBack pattern
      2. Verify each onBack includes fetchData() call (not just setShowImport(false))
      3. Verify ExcelImportView.tsx has setTimeout or auto-navigation after success toast
    Expected Result: All 7+ parent pages call fetch on import back; ExcelImportView auto-navigates
    Evidence: .sisyphus/evidence/task-1-import-fix.txt

  Scenario: Build still passes after changes
    Tool: Bash
    Steps:
      1. Run `npm run build`
    Expected Result: Build successful, zero errors
    Evidence: .sisyphus/evidence/task-1-build.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `fix(import): auto-navigate back after successful Excel import`
  - Files: `src/components/ExcelImportView.tsx` + all parent pages with import
  - Pre-commit: `npm run build`

- [ ] 2. Redesign ManageClassesView

  **What to do**:
  - Rewrite `src/components/admin/classes/ManageClassesView.tsx` (342 lines) following ManageRoomsView template
  - Replace inline Card form → Sheet sidebar slide-in form
  - Add stat cards at top: Total Kelas (computed with `useMemo` from classes array)
  - Add Skeleton loading (change `isLoading` init from `false` to `true`, add Skeleton components for stats and table)
  - Add separate `isSaving` state for form submission (currently reuses `isLoading`)
  - Remove `globalThis.confirm` from `handleDelete` (line 92) — the AlertDialog in JSX already handles confirmation, just remove the `globalThis.confirm` guard and have `handleDelete` do the API call directly (it's called from AlertDialogAction onClick)
  - Add sortable table columns with `handleSort`/`getSortIcon` pattern
  - Add footer "Menampilkan X dari Y kelas"
  - Fix ExcelImportView onBack: `onBack={() => { setShowImport(false); fetchClasses(); }}`
  - Add new imports: Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter from `@/components/ui/sheet`, Skeleton from `@/components/ui/skeleton`, ArrowUpDown/ArrowUp/ArrowDown from lucide-react
  - Preserve: mobile Card view, search functionality

  **Must NOT do**:
  - Do NOT change the Kelas type definition
  - Do NOT add status field (ManageClassesView has no status — only nama_kelas and tingkat)
  - Do NOT add status filter tabs (classes have no status concept)
  - Do NOT change the API endpoints

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/rooms/ManageRoomsView.tsx` — THE template. Copy Sheet pattern, stat cards pattern, skeleton pattern, sortable columns, footer count
  - `src/components/admin/classes/ManageClassesView.tsx` — Current file (342 lines). Form has only `nama_kelas` field. Uses `globalThis.confirm` at line 92. Uses AlertDialog in JSX (lines 256-277)

  **API/Type References**:
  - `src/types/dashboard.ts` — `Kelas` type (has id, nama_kelas, tingkat)
  - API: `GET /api/admin/kelas`, `POST /api/admin/kelas`, `PUT /api/admin/kelas/:id`, `DELETE /api/admin/kelas/:id`

  **Acceptance Criteria**:

  ```
  Scenario: Classes page has Sheet form
    Tool: Bash (grep)
    Steps:
      1. Search ManageClassesView.tsx for "SheetContent"
      2. Verify no inline Card form for add/edit remains
    Expected Result: Sheet component found, no Card form for add/edit
    Evidence: .sisyphus/evidence/task-2-sheet.txt

  Scenario: No globalThis.confirm or confirm() remains
    Tool: Bash (grep)
    Steps:
      1. Search ManageClassesView.tsx for "globalThis.confirm" and "confirm("
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-2-no-confirm.txt

  Scenario: Build passes
    Tool: Bash
    Steps:
      1. Run `npm run build`
    Expected Result: Zero errors
    Evidence: .sisyphus/evidence/task-2-build.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `refactor(admin): redesign classes management page UX`
  - Files: `src/components/admin/classes/ManageClassesView.tsx`
  - Pre-commit: `npm run build`

- [ ] 3. Redesign ManageSubjectsView

  **What to do**:
  - Rewrite `src/components/admin/subjects/ManageSubjectsView.tsx` (459 lines) following ManageRoomsView template
  - Replace inline Card form → Sheet sidebar slide-in form
  - Add stat cards at top: Total Mapel, Mapel Aktif, Mapel Tidak Aktif (computed with `useMemo`)
  - Add Skeleton loading (change `isLoading` init from `false` to `true`, add Skeleton components)
  - Add separate `isSaving` state for form submission
  - Remove `globalThis.confirm` from `handleDelete` handler — the AlertDialog in JSX already handles confirmation, so just have the delete function do the API call directly (it's called from AlertDialogAction onClick)
  - Add status filter tabs (Semua/Aktif/Tidak Aktif) with Badge counts — this page HAS status field (`aktif`/`tidak_aktif`)
  - Add quick status toggle: clicking status badge calls API to toggle between `aktif`/`tidak_aktif`
  - Add sortable table columns with `handleSort`/`getSortIcon` pattern
  - Add footer "Menampilkan X dari Y mata pelajaran"
  - Fix ExcelImportView onBack: `onBack={() => { setShowImport(false); fetchSubjects(); }}`
  - Add new imports: Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription/SheetFooter, Skeleton, ArrowUpDown/ArrowUp/ArrowDown
  - Preserve: mobile Card view, search functionality

  **Must NOT do**:
  - Do NOT change the Subject type definition in `src/types/dashboard.ts`
  - Do NOT change the API endpoints
  - Do NOT change the form fields themselves (nama_mapel, kode_mapel, etc.)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Provides project-specific conventions for React components, Tailwind, Shadcn UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/rooms/ManageRoomsView.tsx` — THE template. Copy Sheet pattern, stat cards (Total/Aktif/Tidak Aktif), skeleton loading, status filter tabs, sortable columns, quick status toggle, footer count
  - `src/components/admin/subjects/ManageSubjectsView.tsx` — Current file (459 lines). Form has nama_mapel, kode_mapel. Uses `globalThis.confirm` in handleDelete handler. Has AlertDialog in JSX. Status field uses `aktif`/`tidak_aktif` values

  **API/Type References**:
  - `src/types/dashboard.ts` — `Subject` type (has id, nama_mapel, kode_mapel, status, etc.)
  - API: `GET /api/admin/mapel`, `POST /api/admin/mapel`, `PUT /api/admin/mapel/:id`, `DELETE /api/admin/mapel/:id`

  **Acceptance Criteria**:

  ```
  Scenario: Subjects page has Sheet form and status filter tabs
    Tool: Bash (grep)
    Steps:
      1. Search ManageSubjectsView.tsx for "SheetContent"
      2. Verify status filter tabs exist (search for "Aktif" Badge)
      3. Verify no inline Card form for add/edit remains
    Expected Result: Sheet found, status tabs found, no Card form for add/edit
    Evidence: .sisyphus/evidence/task-3-sheet.txt

  Scenario: No globalThis.confirm or confirm() remains
    Tool: Bash (grep)
    Steps:
      1. Search ManageSubjectsView.tsx for "globalThis.confirm" and "confirm("
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-3-no-confirm.txt

  Scenario: Build passes
    Tool: Bash
    Steps:
      1. Run `npm run build`
    Expected Result: Zero errors
    Evidence: .sisyphus/evidence/task-3-build.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `refactor(admin): redesign subjects management page UX`
  - Files: `src/components/admin/subjects/ManageSubjectsView.tsx`
  - Pre-commit: `npm run build`

- [ ] 4. Redesign ManageTeacherDataView

  **What to do**:
  - Rewrite `src/components/admin/teachers/ManageTeacherDataView.tsx` (654 lines) following ManageRoomsView template
  - Replace inline Card form → Sheet sidebar slide-in form
  - Add stat cards at top: Total Guru, Guru Aktif, Guru Tidak Aktif (computed with `useMemo`)
  - Add Skeleton loading (change `isLoading` init from `false` to `true`, add Skeleton components)
  - Add separate `isSaving` state for form submission
  - Replace `globalThis.confirm` in `handleDelete` → use AlertDialog pattern exclusively
  - Add status filter tabs (Semua/Aktif/Tidak Aktif) with Badge counts — this page HAS status field (`aktif`/`tidak_aktif`)
  - Add quick status toggle: clicking status badge calls API to toggle status
  - Add sortable table columns with `handleSort`/`getSortIcon` pattern
  - Add footer "Menampilkan X dari Y guru"
  - Fix ExcelImportView onBack: `onBack={() => { setShowImport(false); fetchTeachers(); }}` (verify the actual fetch function name)
  - Add new imports: Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription/SheetFooter, Skeleton, ArrowUpDown/ArrowUp/ArrowDown
  - Preserve: mobile Card view, search functionality

  **Must NOT do**:
  - Do NOT change the TeacherData type definition
  - Do NOT change the API endpoints
  - Do NOT change the form fields (nama, nip, jenis_kelamin, telepon, alamat, etc.)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Provides project-specific conventions for React components, Tailwind, Shadcn UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/rooms/ManageRoomsView.tsx` — THE template. Copy all UX patterns
  - `src/components/admin/teachers/ManageTeacherDataView.tsx` — Current file (654 lines). Has inline Card form with multiple fields (nama, nip, jenis_kelamin, telepon, alamat, status). Uses `globalThis.confirm` for delete. Status uses `aktif`/`tidak_aktif` values

  **API/Type References**:
  - `src/types/dashboard.ts` — `TeacherData` type
  - API: `GET /api/admin/teachers-data`, `POST /api/admin/teachers-data`, `PUT /api/admin/teachers-data/:id`, `DELETE /api/admin/teachers-data/:id`

  **Acceptance Criteria**:

  ```
  Scenario: Teacher data page has Sheet form and status tabs
    Tool: Bash (grep)
    Steps:
      1. Search ManageTeacherDataView.tsx for "SheetContent"
      2. Verify status filter tabs exist
      3. Verify no inline Card form for add/edit remains
    Expected Result: Sheet found, status tabs found, no Card form for add/edit
    Evidence: .sisyphus/evidence/task-4-sheet.txt

  Scenario: No globalThis.confirm or confirm() remains
    Tool: Bash (grep)
    Steps:
      1. Search ManageTeacherDataView.tsx for "globalThis.confirm" and "confirm("
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-4-no-confirm.txt

  Scenario: Build passes
    Tool: Bash
    Steps:
      1. Run `npm run build`
    Expected Result: Zero errors
    Evidence: .sisyphus/evidence/task-4-build.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `refactor(admin): redesign teacher-data management page UX`
  - Files: `src/components/admin/teachers/ManageTeacherDataView.tsx`
  - Pre-commit: `npm run build`

- [ ] 5. Redesign ManageStudentDataView

  **What to do**:
  - Rewrite `src/components/admin/students/ManageStudentDataView.tsx` (706 lines) following ManageRoomsView template
  - Replace inline Card form → Sheet sidebar slide-in form
  - Add stat cards at top: Total Siswa, Siswa Aktif, Siswa Tidak Aktif (computed with `useMemo`)
  - Add Skeleton loading (change `isLoading` init from `false` to `true`, add Skeleton components)
  - Add separate `isSaving` state for form submission
  - Replace `globalThis.confirm` in `handleDelete` → use AlertDialog pattern exclusively
  - Add status filter tabs (Semua/Aktif/Tidak Aktif) with Badge counts — this page HAS status field (`aktif`/`tidak_aktif`)
  - Add quick status toggle: clicking status badge calls API to toggle status
  - Add sortable table columns with `handleSort`/`getSortIcon` pattern
  - Add footer "Menampilkan X dari Y siswa"
  - Fix ExcelImportView onBack: `onBack={() => { setShowImport(false); fetchStudents(); }}` (verify actual fetch function name)
  - Add new imports: Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription/SheetFooter, Skeleton, ArrowUpDown/ArrowUp/ArrowDown
  - Preserve: mobile Card view, search functionality, client-side pagination

  **Must NOT do**:
  - Do NOT change the StudentData type definition
  - Do NOT change the API endpoints
  - Do NOT change the form fields (nama, nis, nisn, jenis_kelamin, telepon, alamat, kelas, etc.)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Provides project-specific conventions for React components, Tailwind, Shadcn UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/rooms/ManageRoomsView.tsx` — THE template. Copy all UX patterns
  - `src/components/admin/students/ManageStudentDataView.tsx` — Current file (706 lines). Has inline Card form with fields (nama, nis, nisn, jenis_kelamin, telepon, alamat, kelas_id, status). Uses `globalThis.confirm` for delete. Status uses `aktif`/`tidak_aktif` values. Uses client-side pagination

  **API/Type References**:
  - `src/types/dashboard.ts` — `StudentData` type
  - API: `GET /api/admin/students-data`, `POST /api/admin/students-data`, `PUT /api/admin/students-data/:id`, `DELETE /api/admin/students-data/:id`

  **Acceptance Criteria**:

  ```
  Scenario: Student data page has Sheet form and status tabs
    Tool: Bash (grep)
    Steps:
      1. Search ManageStudentDataView.tsx for "SheetContent"
      2. Verify status filter tabs exist
      3. Verify no inline Card form for add/edit remains
    Expected Result: Sheet found, status tabs found, no Card form for add/edit
    Evidence: .sisyphus/evidence/task-5-sheet.txt

  Scenario: No globalThis.confirm or confirm() remains
    Tool: Bash (grep)
    Steps:
      1. Search ManageStudentDataView.tsx for "globalThis.confirm" and "confirm("
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-5-no-confirm.txt

  Scenario: Build passes
    Tool: Bash
    Steps:
      1. Run `npm run build`
    Expected Result: Zero errors
    Evidence: .sisyphus/evidence/task-5-build.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `refactor(admin): redesign student-data management page UX`
  - Files: `src/components/admin/students/ManageStudentDataView.tsx`
  - Pre-commit: `npm run build`

- [ ] 6. Redesign ManageTeacherAccountsView

  **What to do**:
  - Rewrite `src/components/admin/teachers/ManageTeacherAccountsView.tsx` (827 lines) following ManageRoomsView template
  - Replace Dialog form → Sheet sidebar slide-in form
  - Add stat cards at top: Total Akun Guru, Akun Aktif, Akun Nonaktif (computed with `useMemo`)
  - Add Skeleton loading (change `isLoading` init from `false` to `true`, add Skeleton components)
  - Add separate `isSaving` state for form submission
  - Replace `globalThis.confirm` in `handleDelete` → use AlertDialog pattern exclusively
  - Add status filter tabs (Semua/Aktif/Nonaktif) with Badge counts — this page HAS status field, but uses `aktif`/`nonaktif` (NOT `tidak_aktif`)
  - Add quick status toggle: clicking status badge calls API to toggle status
  - Add sortable table columns with `handleSort`/`getSortIcon` pattern
  - Add footer "Menampilkan X dari Y akun guru"
  - Fix ExcelImportView onBack to also call fetch
  - **CRITICAL**: This page uses **server-side pagination** with AbortController. MUST preserve this pattern:
    - Keep `page`, `limit`, `search` params sent to backend
    - Keep AbortController for request cancellation
    - Keep `totalPages`, `totalItems` from API response
    - Stat cards should use `totalItems` from server response (NOT computed from local array)
    - Status filter should be sent as a query parameter to the backend (NOT client-side filtered)
  - Add new imports: Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription/SheetFooter, Skeleton, ArrowUpDown/ArrowUp/ArrowDown

  **Must NOT do**:
  - Do NOT switch from server-side pagination to client-side pagination
  - Do NOT remove the AbortController pattern
  - Do NOT change the API endpoints or backend pagination logic
  - Do NOT change the Teacher type definition
  - Do NOT change form fields (username, password, nama, etc.)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Provides project-specific conventions for React components, Tailwind, Shadcn UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/rooms/ManageRoomsView.tsx` — THE template for UX patterns (Sheet, stats, skeleton, sortable, footer)
  - `src/components/admin/teachers/ManageTeacherAccountsView.tsx` — Current file (827 lines). Uses Dialog for form (not inline Card). Uses `globalThis.confirm` for delete. **Has server-side pagination with AbortController** — must preserve this exactly. Status uses `aktif`/`nonaktif` values (different from other pages!)

  **API/Type References**:
  - `src/types/dashboard.ts` — `Teacher` type
  - API: `GET /api/admin/guru?page=1&limit=10&search=...`, `POST /api/admin/guru`, `PUT /api/admin/guru/:id`, `DELETE /api/admin/guru/:id`
  - Server response includes: `{ data: Teacher[], pagination: { page, limit, total, totalPages } }`

  **Acceptance Criteria**:

  ```
  Scenario: Teacher accounts page has Sheet form and preserves server-side pagination
    Tool: Bash (grep)
    Steps:
      1. Search ManageTeacherAccountsView.tsx for "SheetContent"
      2. Verify AbortController still exists
      3. Verify page/limit/search params still sent to API
      4. Verify no inline filtering of full dataset (would indicate client-side switch)
    Expected Result: Sheet found, AbortController preserved, server pagination intact
    Evidence: .sisyphus/evidence/task-6-sheet-pagination.txt

  Scenario: No globalThis.confirm or confirm() remains
    Tool: Bash (grep)
    Steps:
      1. Search ManageTeacherAccountsView.tsx for "globalThis.confirm" and "confirm("
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-6-no-confirm.txt

  Scenario: Build passes
    Tool: Bash
    Steps:
      1. Run `npm run build`
    Expected Result: Zero errors
    Evidence: .sisyphus/evidence/task-6-build.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `refactor(admin): redesign teacher-accounts management page UX`
  - Files: `src/components/admin/teachers/ManageTeacherAccountsView.tsx`
  - Pre-commit: `npm run build`

- [ ] 7. Redesign ManageStudentsView

  **What to do**:
  - Rewrite `src/components/admin/students/ManageStudentsView.tsx` (798 lines) following ManageRoomsView template
  - Replace Dialog form → Sheet sidebar slide-in form
  - Add stat cards at top: Total Akun Siswa, Akun Aktif, Akun Nonaktif (computed with `useMemo`)
  - Add Skeleton loading (change `isLoading` init from `false` to `true`, add Skeleton components)
  - Add separate `isSaving` state for form submission
  - Replace `globalThis.confirm` in `handleDelete` → use AlertDialog pattern exclusively
  - Add status filter tabs (Semua/Aktif/Nonaktif) with Badge counts — this page HAS status field, uses `aktif`/`nonaktif` (same as TeacherAccounts)
  - Add quick status toggle: clicking status badge calls API to toggle status
  - Add sortable table columns with `handleSort`/`getSortIcon` pattern
  - Add footer "Menampilkan X dari Y akun siswa"
  - Fix ExcelImportView onBack to also call fetch
  - **CRITICAL**: This page uses **server-side pagination** with AbortController. MUST preserve this pattern:
    - Keep `page`, `limit`, `search` params sent to backend
    - Keep AbortController for request cancellation
    - Keep `totalPages`, `totalItems` from API response
    - Stat cards should use `totalItems` from server response (NOT computed from local array)
    - Status filter should be sent as a query parameter to the backend (NOT client-side filtered)
  - Add new imports: Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription/SheetFooter, Skeleton, ArrowUpDown/ArrowUp/ArrowDown

  **Must NOT do**:
  - Do NOT switch from server-side pagination to client-side pagination
  - Do NOT remove the AbortController pattern
  - Do NOT change the API endpoints or backend pagination logic
  - Do NOT change the Student type definition
  - Do NOT change form fields (username, password, nama, kelas, etc.)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Provides project-specific conventions for React components, Tailwind, Shadcn UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/rooms/ManageRoomsView.tsx` — THE template for UX patterns
  - `src/components/admin/students/ManageStudentsView.tsx` — Current file (798 lines). Uses Dialog for form. Uses `globalThis.confirm` for delete. **Has server-side pagination with AbortController** — must preserve. Status uses `aktif`/`nonaktif` values
  - `src/components/admin/teachers/ManageTeacherAccountsView.tsx` — Sister page with same server-side pagination pattern. Use as secondary reference for how to adapt the ManageRoomsView UX patterns to server-side paginated pages

  **API/Type References**:
  - `src/types/dashboard.ts` — `Student` type
  - API: `GET /api/admin/students?page=1&limit=10&search=...`, `POST /api/admin/students`, `PUT /api/admin/students/:id`, `DELETE /api/admin/students/:id`
  - Server response includes: `{ data: Student[], pagination: { page, limit, total, totalPages } }`

  **Acceptance Criteria**:

  ```
  Scenario: Students page has Sheet form and preserves server-side pagination
    Tool: Bash (grep)
    Steps:
      1. Search ManageStudentsView.tsx for "SheetContent"
      2. Verify AbortController still exists
      3. Verify page/limit/search params still sent to API
    Expected Result: Sheet found, AbortController preserved, server pagination intact
    Evidence: .sisyphus/evidence/task-7-sheet-pagination.txt

  Scenario: No globalThis.confirm or confirm() remains
    Tool: Bash (grep)
    Steps:
      1. Search ManageStudentsView.tsx for "globalThis.confirm" and "confirm("
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-7-no-confirm.txt

  Scenario: Build passes
    Tool: Bash
    Steps:
      1. Run `npm run build`
    Expected Result: Zero errors
    Evidence: .sisyphus/evidence/task-7-build.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `refactor(admin): redesign student-accounts management page UX`
  - Files: `src/components/admin/students/ManageStudentsView.tsx`
  - Pre-commit: `npm run build`

- [ ] 8. Redesign ManageSchedulesView (Main List Only)

  **What to do**:
  - Partially rewrite `src/components/admin/schedules/ManageSchedulesView.tsx` (1119 lines) — **ONLY the main list/table view**
  - Replace inline Card form → Sheet sidebar slide-in form for adding/editing schedules
  - Add stat cards at top: Total Jadwal, Jadwal Aktif (is_absenable=true), Jadwal Nonaktif (computed with `useMemo`)
  - Add Skeleton loading (change `isLoading` init from `false` to `true`, add Skeleton components)
  - Add separate `isSaving` state for form submission
  - Replace bare `confirm()` calls → use AlertDialog pattern exclusively (this page uses bare `confirm()`, not `globalThis.confirm`)
  - Add status filter tabs (Semua/Bisa Diabsen/Tidak Bisa Diabsen) based on `is_absenable` field — this page uses boolean `is_absenable` instead of string status
  - Add quick toggle for `is_absenable`: clicking badge calls API to toggle
  - Add sortable table columns with `handleSort`/`getSortIcon` pattern
  - Add footer "Menampilkan X dari Y jadwal"
  - Fix ExcelImportView onBack: `onBack={() => { setShowImport(false); refreshSchedules(); }}` (verify actual fetch function name)
  - Add new imports: Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription/SheetFooter, Skeleton, ArrowUpDown/ArrowUp/ArrowDown
  - Preserve: mobile Card view, search, client-side pagination
  - **Preserve ALL sub-component integrations**: The main view renders ScheduleGridTable, ScheduleGridEditor, BulkAddScheduleView, CloneScheduleView, PreviewJadwalView via conditional rendering (showGrid, showEditor, showBulkAdd, showClone, showPreview states). Keep ALL of these untouched — only redesign the default list/table view that shows when none of these sub-views are active

  **Must NOT do**:
  - Do NOT modify ScheduleGridTable.tsx
  - Do NOT modify ScheduleGridEditor.tsx
  - Do NOT modify BulkAddScheduleView.tsx
  - Do NOT modify CloneScheduleView.tsx
  - Do NOT modify PreviewJadwalView.tsx
  - Do NOT change the Schedule type definition
  - Do NOT change the API endpoints
  - Do NOT change the conditional rendering logic for sub-components
  - Do NOT change the form fields (hari, jam_mulai, jam_selesai, kelas_id, mapel_id, guru_id, ruang_id, is_absenable)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`absenta-frontend`]
    - `absenta-frontend`: Provides project-specific conventions for React components, Tailwind, Shadcn UI
  - **Why `deep` instead of `visual-engineering`**: This is the most complex page (1119 lines) with 5 sub-component integrations that must be preserved. Requires careful analysis to modify only the list view without breaking sub-component wiring

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/admin/rooms/ManageRoomsView.tsx` — THE template for UX patterns
  - `src/components/admin/schedules/ManageSchedulesView.tsx` — Current file (1119 lines). Uses inline Card form. Uses bare `confirm()` for delete. Has 5 sub-component integrations via conditional rendering states. Status uses boolean `is_absenable` field (not string). Client-side pagination
  - `src/components/admin/schedules/ScheduleGridTable.tsx` — DO NOT MODIFY. Understand its props interface so you don't break the integration
  - `src/components/admin/schedules/ScheduleGridEditor.tsx` — DO NOT MODIFY. Understand its props interface
  - `src/components/admin/schedules/BulkAddScheduleView.tsx` — DO NOT MODIFY. Understand its props interface
  - `src/components/admin/schedules/CloneScheduleView.tsx` — DO NOT MODIFY. Understand its props interface

  **API/Type References**:
  - `src/types/dashboard.ts` — `Schedule` type (has id, hari, jam_mulai, jam_selesai, kelas_id, mapel_id, guru_id, ruang_id, is_absenable, etc.)
  - API: `GET /api/admin/jadwal`, `POST /api/admin/jadwal`, `PUT /api/admin/jadwal/:id`, `DELETE /api/admin/jadwal/:id`

  **Acceptance Criteria**:

  ```
  Scenario: Schedules page has Sheet form and sub-components still work
    Tool: Bash (grep)
    Steps:
      1. Search ManageSchedulesView.tsx for "SheetContent"
      2. Verify ScheduleGridTable, ScheduleGridEditor, BulkAddScheduleView, CloneScheduleView still referenced
      3. Verify conditional rendering states (showGrid, showEditor, etc.) still exist
    Expected Result: Sheet found, all 5 sub-component integrations preserved
    Evidence: .sisyphus/evidence/task-8-sheet-subcomponents.txt

  Scenario: No bare confirm() or globalThis.confirm remains
    Tool: Bash (grep)
    Steps:
      1. Search ManageSchedulesView.tsx for "confirm(" excluding "AlertDialog" context
      2. Search for "globalThis.confirm"
    Expected Result: Zero matches for bare confirm() calls
    Evidence: .sisyphus/evidence/task-8-no-confirm.txt

  Scenario: Sub-component files are untouched
    Tool: Bash (git)
    Steps:
      1. Run `git diff --name-only` and verify ScheduleGridTable.tsx, ScheduleGridEditor.tsx, BulkAddScheduleView.tsx, CloneScheduleView.tsx, PreviewJadwalView.tsx are NOT listed
    Expected Result: Zero sub-component files modified
    Evidence: .sisyphus/evidence/task-8-no-subcomponent-changes.txt

  Scenario: Build passes
    Tool: Bash
    Steps:
      1. Run `npm run build`
    Expected Result: Zero errors
    Evidence: .sisyphus/evidence/task-8-build.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `refactor(admin): redesign schedules management page UX (list view only)`
  - Files: `src/components/admin/schedules/ManageSchedulesView.tsx`
  - Pre-commit: `npm run build`

---

## Final Verification Wave

- [ ] F1. **Build + TypeScript Verification** — `quick`
  Run `npm run build` and `npx tsc --noEmit`. All must pass with zero errors. Check for any new lint warnings. Compare error count before and after changes.
  Output: `Build [PASS/FAIL] | TSC [PASS/FAIL] | Warnings [count] | VERDICT`

- [ ] F2. **Cross-Page Visual Consistency QA** — `visual-engineering` (+ `playwright` skill)
  Navigate to each of the 8 admin pages via Playwright. For each page: verify stat cards are present, Sheet form opens on "Tambah" click, table columns are sortable (click header), skeleton appears on load, AlertDialog appears on delete click, footer count shows. Take screenshots. Verify mobile responsive view.
  Output: `Pages [8/8 consistent] | Patterns [N/N] | VERDICT`

- [ ] F3. **Scope Fidelity Check** — `deep`
  Read every modified file via `git diff`. Verify: no changes to `src/components/ui/*`, no changes to backend files, no changes to types, no changes to schedule sub-components (ScheduleGridTable, ScheduleGridEditor, BulkAddScheduleView, CloneScheduleView). Check no `globalThis.confirm` or bare `confirm()` remains in any modified file. Check no new npm dependencies added.
  Output: `Files [N modified] | Guardrails [CLEAN/N violations] | Confirm cleanup [CLEAN] | VERDICT`

---

## Commit Strategy

After each wave:
- **Wave 1**: `refactor(admin): redesign classes, subjects, teacher-data pages and fix import UX`
- **Wave 2**: `refactor(admin): redesign student-data, teacher-accounts, students, schedules pages`
- **Final**: No commit needed (verification only)

Files per commit: Only the modified `.tsx` files in that wave.
Pre-commit: `npm run build`

---

## Success Criteria

### Verification Commands
```bash
npm run build        # Expected: Build successful, zero errors
npx tsc --noEmit     # Expected: No new type errors
```

### Final Checklist
- [ ] All 8 admin pages have Sheet sidebar forms
- [ ] All 8 admin pages have stat cards at top
- [ ] All 8 admin pages have Skeleton loading
- [ ] All 8 admin pages have AlertDialog (no confirm/globalThis.confirm)
- [ ] All 8 admin pages have sortable table columns
- [ ] All 8 admin pages have footer count
- [ ] Excel import auto-navigates back after success
- [ ] No changes to UI components, backend, or types
- [ ] `npm run build` passes
