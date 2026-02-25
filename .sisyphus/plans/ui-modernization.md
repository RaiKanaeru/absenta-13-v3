# UI Modernization Plan: User Management, Master Data, and System Admin

## Objective
Modernize the user interface of the Admin Dashboard using modern `shadcn/ui` patterns, specifically integrating `@tanstack/react-table` for powerful data tables. Ensure forms for adding and editing records retain the `Sheet` (sidebar) pattern but are updated with cleaner layouts.

## Scope
1. **User Management:**
   - Tambah Akun Guru (`src/components/admin/teachers/ManageTeacherAccountsView.tsx`)
   - Data Guru (`src/components/admin/teachers/ManageTeacherDataView.tsx`)
   - Tambah Akun Siswa (`src/components/admin/students/ManageStudentsView.tsx`)
   - Data Siswa (`src/components/admin/students/ManageStudentDataView.tsx`)
2. **Academic Master Data:**
   - Naik Kelas (`src/components/admin/students/StudentPromotionView.tsx`)
   - Mata Pelajaran (`src/components/admin/subjects/ManageSubjectsView.tsx`)
   - Kelas (`src/components/admin/classes/ManageClassesView.tsx`)
   - Jadwal (`src/components/admin/schedules/ManageSchedulesView.tsx`)
   - Ruang Kelas (`src/components/admin/rooms/ManageRoomsView.tsx`)
3. **System Administration:**
   - Backup & Archive (`src/components/admin/BackupManagementView.tsx`)
   - System Monitoring (`src/components/admin/MonitoringDashboard.tsx`)
   - Restorasi Backup (`src/components/admin/SimpleRestoreView.tsx`)
   - Kop Laporan (`src/components/admin/settings/ReportLetterheadSettings.tsx`)

## Technical Approach
1. **DataTable Foundation (Hybrid Pagination):**
   - Install `@tanstack/react-table`.
   - Create a reusable `src/components/ui/data-table.tsx` component.
   - **CRITICAL GUARDRAIL:** The DataTable must support *both* manual (server-side) and automatic (client-side) pagination. Large entities (Students) currently use server-side pagination and must remain so to prevent memory/performance issues. Smaller master data (Classes, Rooms) can use client-side.
   - Implement column visibility toggle, and global search filtering where applicable.
   - **Mobile Support:** Add a `renderMobileRow` prop to `DataTable` to preserve the existing `lg:hidden` card views, as standard tables break on small screens.
2. **View Modernization:**
   - For each view listed above, replace the basic `Table` and manual map logic with the new `<DataTable />`.
   - Define type-safe `ColumnDef` arrays for each entity.
   - Move actions (Edit/Delete) into a standard dropdown menu (`dropdown-menu` component) in an "Actions" column to clean up the UI.
3. **Form Refinement (Incremental):**
   - Retain the `Sheet` layout for CRUD operations.
   - **CRITICAL GUARDRAIL:** Existing forms use manual `useState` and validation, *not* `react-hook-form` or `zod`. Do NOT attempt a massive migration to RHF/Zod across 13+ views. Focus strictly on *visual modernization*—better spacing, utilizing Shadcn input/label components properly, and organizing long forms into sections.
4. **Dashboard/Monitoring Refresh:**
   - Enhance the `MonitoringDashboard.tsx` with modern card layouts and cleaner typography.
   - Update `BackupManagementView.tsx` and `SimpleRestoreView.tsx` lists to use the new `DataTable`.

## Task Breakdown

### Phase 1: Foundation
- [ ] Ensure required Shadcn components are installed (`dropdown-menu`, `checkbox`, `input`, `select`, etc.).
- [ ] Run `npm install @tanstack/react-table`.
- [ ] Create `src/components/ui/data-table.tsx` with hybrid pagination support and a `renderMobileRow` prop.

### Phase 2: Template Migration (Prioritized to establish pattern)
- [ ] Modernize `ManageClassesView.tsx` (Simple CRUD, client-side table test).
- [ ] Modernize `ManageStudentsView.tsx` (Complex CRUD, server-side pagination test).

### Phase 3: Rollout (User Management & Master Data)
- [ ] Update `ManageTeacherAccountsView.tsx`.
- [ ] Update `ManageTeacherDataView.tsx`.
- [ ] Update `ManageStudentDataView.tsx`.
- [ ] Update `StudentPromotionView.tsx`.
- [ ] Update `ManageSubjectsView.tsx`.
- [ ] Update `ManageSchedulesView.tsx` (Handle complex filters and Grid View carefully).
- [ ] Update `ManageRoomsView.tsx`.

### Phase 4: System Admin
- [ ] Update `BackupManagementView.tsx`.
- [ ] Update `MonitoringDashboard.tsx` (Focus on Card layouts).
- [ ] Update `SimpleRestoreView.tsx`.
- [ ] Update `ReportLetterheadSettings.tsx`.

## Constraints & Rules
- Do NOT modify backend code or API endpoints.
- Maintain server-side pagination where currently implemented.
- Do not migrate forms to `react-hook-form`; modernize visuals only.
- Adhere strictly to the project's Precision Protocol (no UI freeze violations unless explicitly requested, use `@/` alias).
- Ensure existing Excel Import logic and components still function properly.