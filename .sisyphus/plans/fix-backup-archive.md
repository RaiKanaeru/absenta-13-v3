# Fix Backup & Archive System

## TL;DR
> **Quick Summary**: Fix critical bugs in the Backup & Archive system including timezone evaluation errors, memory leaks with timers, broken cleanup logic, missing compression dependency, and UI display issues.
> 
> **Deliverables**:
> - Fix timezone parsing in custom schedule creation/evaluation (enforce WIB).
> - Fix `BackupSystem` timer leaks and missing reloads on schedule changes.
> - Fix `custom-schedules.json` to update `lastRun` after execution.
> - Fix UI date display formatting in `BackupManagementView.tsx`.
> - Add `archiver` dependency and enable compression for custom schedules.
> - Fix `fs.unlink()` crash in `cleanupOldBackups()` and orphaned files in `deleteBackup()`.
> - Pin timezone to `Asia/Jakarta` for `node-cron` scheduled tasks.
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4

---

## Context

### Original Request
"kenapa belum jalan?Backup & Archivecoba lakukan pengecekan secara detail dan rinci.lakukan inpeksi detail,lalu perbaiki banyak hal dan penyesuaian lain nya.agar sesuai dan berjalan sesuai fungsi nya."

### Interview Summary
**Key Discussions**:
- The user observed a custom schedule that should have run at 10:47 WIB but didn't run, while the UI displayed an incorrect time "22 Februari 2026 pukul 07.00 🕒 10:47".
- The system evaluates schedules using the server's local timezone (UTC), causing a 7-hour delay for WIB users.

### Metis Review
**Identified Gaps** (addressed):
- Scheduled backups (`createScheduledBackup`) never call `compressBackup`.
- After a custom schedule executes, its `lastRun` state is never updated in the JSON file.
- `cron` tasks are not pinned to WIB timezone.
- `archiver` is missing from `package.json`.
- `deleteBackup` orphans `.zip` files.

---

## Work Objectives

### Core Objective
Ensure the Backup & Archive system functions reliably, runs at the exact scheduled WIB time, correctly compresses backups, and properly cleans up old files without crashing or leaving orphans.

### Concrete Deliverables
- Updated `backup-system.js` with correct timezone handling, timer management, and cleanup logic.
- Updated `backupController.js` to trigger schedule reloads and correctly parse dates.
- Updated `BackupManagementView.tsx` with proper date formatting.
- `archiver` added to dependencies.

### Definition of Done
- [ ] A custom schedule executes at the exact configured WIB time.
- [ ] UI displays the date without the "07.00" time artifact.
- [ ] Deleting a backup removes both the folder and its `.zip` file.
- [ ] Compression works for all backup types.

### Must Have
- All time parsing must explicitly enforce `+07:00` (WIB) or `Asia/Jakarta`.
- All `setTimeout` timers must be cleared before re-evaluating.

### Must NOT Have (Guardrails)
- Do not remove existing valid data from `custom-schedules.json`.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: None
- **QA Policy**: Every task MUST include agent-executed QA scenarios.

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 1 (Backend Core Fixes):
├── Task 1: Install Dependencies & Fix UI Display [quick]
├── Task 2: Fix BackupSystem Timezones, Timers, and State [deep]
└── Task 3: Fix Controllers to Reload Schedules [quick]

Wave 2 (File Operations & Compression):
└── Task 4: Fix File Cleanup, Deletion, and Compression [deep]

Wave FINAL (Verification):
├── Task F1: Plan compliance audit
├── Task F2: Code quality review
├── Task F3: Scope fidelity check
```

- [ ] 1. Install Dependencies & Fix UI Display [quick]

  **What to do**:
  - Run `npm install archiver` to fix the missing dependency.
  - In `src/components/BackupManagementView.tsx`:
    - Import `formatDateOnly` from `../lib/time-utils`.
    - Change `{formatDate(schedule.date)}` (line ~346) to `{formatDateOnly(schedule.date)}`.
    - Change `{nextSchedule ? formatDate(\`\${nextSchedule.date}T\${nextSchedule.time}\`) : ''}` (line ~430) to `{nextSchedule ? \`\${formatDateOnly(nextSchedule.date)} pukul \${nextSchedule.time}\` : ''}`.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single dependency installation and minor UI string formatting fixes.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: To correctly update React components and manage imports.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `package.json` - Needs `archiver` dependency.
  - `src/components/BackupManagementView.tsx:340-350` - Schedule rendering logic.
  - `src/components/BackupManagementView.tsx:420-440` - Next schedule rendering logic.
  - `src/lib/time-utils.ts` - Source of `formatDateOnly`.

  **Acceptance Criteria**:
  - [ ] `archiver` is present in `package.json`.
  - [ ] UI date uses `formatDateOnly(schedule.date)` instead of `formatDate(schedule.date)`.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Verify UI display of custom schedule
    Tool: interactive_bash
    Preconditions: System is running.
    Steps:
      1. Run `npm run dev:full` in background or verify it's running.
      2. Grep `formatDateOnly` in `src/components/BackupManagementView.tsx` to verify the code change.
    Expected Result: Code contains the correct function call without `pukul 07.00` bug.
    Evidence: .sisyphus/evidence/task-1-ui-fix.txt
  ```

- [ ] 2. Fix BackupSystem Timezones, Timers, and State [deep]

  **What to do**:
  - In `server/services/system/backup-system.js`:
    - In `loadCustomSchedules()`: 
      - Before evaluating schedules, clear existing timers: `if (this._customScheduleTimers) { this._customScheduleTimers.forEach(t => clearTimeout(t)); } this._customScheduleTimers = [];`
      - Fix timezone parsing: `const scheduledTime = new Date(\`\${schedule.date}T\${schedule.time}:00+07:00\`).getTime();`
      - Inside the `setTimeout` callback, after `await this.createScheduledBackup(schedule);`, add code to update the schedule's `lastRun` property in `custom-schedules.json` to `new Date().toISOString()` and then reload schedules.
    - In `setupAutomatedBackup()`:
      - Add timezone to cron jobs: `{ timezone: "Asia/Jakarta" }` as the 3rd argument to `cron.schedule(..., { timezone: 'Asia/Jakarta' })`.
    - In `createScheduledBackup(schedule)`:
      - Add compression support by copying the logic from `createSemesterBackup`: `if (this.backupConfig.compressionEnabled) { await this.compressBackup(backupDir, backupId); }`

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex state management, timezone logic, and timer manipulation requiring careful verification.
  - **Skills**: [`absenta-backend`]
    - `absenta-backend`: Node.js backend logic and timers.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `server/services/system/backup-system.js:280-320` - `loadCustomSchedules` logic.
  - `server/services/system/backup-system.js:200-230` - `setupAutomatedBackup` cron logic.
  - `server/services/system/backup-system.js:370-420` - `createScheduledBackup` missing compression.

  **Acceptance Criteria**:
  - [ ] Timers are cleared before being set in `loadCustomSchedules()`.
  - [ ] Custom schedules evaluate using `+07:00`.
  - [ ] `lastRun` is updated in `custom-schedules.json` after execution.
  - [ ] Cron jobs explicitly use `Asia/Jakarta` timezone.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Verify timer and timezone logic
    Tool: Bash
    Preconditions: None
    Steps:
      1. Use `cat` to read `server/services/system/backup-system.js` and verify `+07:00` is present in `loadCustomSchedules`.
      2. Verify `clearTimeout` is called.
      3. Verify `cron.schedule` includes timezone configuration.
    Expected Result: All required code changes are present.
    Evidence: .sisyphus/evidence/task-2-backup-system.txt
  ```

- [ ] 3. Fix Controllers to Reload Schedules [quick]

  **What to do**:
  - In `server/controllers/backupController.js`:
    - In `createCustomSchedule`, `updateCustomSchedule`, `deleteCustomSchedule`, `runCustomSchedule`:
      - After calling `await writeCustomSchedules(schedules);`, add `if (globalThis.backupSystem) { await globalThis.backupSystem.loadCustomSchedules(); }`.
    - Ensure time evaluation in `createCustomSchedule`'s validation uses `new Date(\`\${date}T\${time}:00+07:00\`)` to avoid UTC local time bugs.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: straightforward code modification in controllers.
  - **Skills**: [`absenta-backend`]
    - `absenta-backend`: Node.js Express controllers.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `server/controllers/backupController.js:1400-1520` - Schedule controllers.

  **Acceptance Criteria**:
  - [ ] Controller correctly triggers reload of timers.
  - [ ] Date validation enforces WIB.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Verify schedule reload
    Tool: Bash
    Preconditions: System is running
    Steps:
      1. Send POST to `/api/admin/custom-schedules` using curl with valid date.
      2. Verify the server logs indicate `Loaded X custom backup schedule(s)`.
    Expected Result: Timers are reloaded immediately on change.
    Evidence: .sisyphus/evidence/task-3-controller-reload.txt
  ```

- [ ] 4. Fix File Cleanup, Deletion, and Compression [deep]

  **What to do**:
  - In `server/services/system/backup-system.js`:
    - In `cleanupOldBackups()`: Replace `fs.unlink(filePath)` with `fs.rm(filePath, { recursive: true, force: true })` since it needs to delete both directories and files.
    - In `deleteBackup(backupId)`: Do not `return` immediately if it's a folder. Instead, store the result of `await fs.rm(folderPath)` and then continue the loop over `possibleFiles` to ensure orphaned `.zip`, `.sql`, `.tar.gz` files are also removed using `fs.unlink`.
  
  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Manipulating filesystem deleting functions, requires high precision to avoid data loss.
  - **Skills**: [`absenta-backend`]
    - `absenta-backend`: Node.js file system API.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `server/services/system/backup-system.js:1690-1730` - `cleanupOldBackups` method.
  - `server/services/system/backup-system.js:2020-2070` - `deleteBackup` method.

  **Acceptance Criteria**:
  - [ ] Directories are successfully deleted by cleanup without throwing `EISDIR`.
  - [ ] Deleting a backup cleans both folder and zip file.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Verify delete folder and zip
    Tool: Bash
    Preconditions: A backup exists.
    Steps:
      1. Use curl to trigger manual backup creation.
      2. Verify folder and `.zip` exist in `/backups`.
      3. Use curl to call delete API endpoint.
      4. `ls backups` to verify neither folder nor `.zip` exists.
    Expected Result: No orphaned zip files remain.
    Evidence: .sisyphus/evidence/task-4-delete-orphan.txt
  ```

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. Verify timezone fixes are implemented. Check evidence files exist.
  Output: `VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run lint`. Review all changed files.
  Output: `VERDICT`

- [ ] F3. **Scope Fidelity Check** — `deep`
  Verify 1:1 compliance with the plan.
  Output: `VERDICT`

---

## Success Criteria

### Final Checklist
- [ ] All "Must Have" present
- [ ] Timers are cleared correctly
- [ ] Archiver installed
