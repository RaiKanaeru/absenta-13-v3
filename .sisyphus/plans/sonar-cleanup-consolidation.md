# Sonar Cleanup Consolidation Plan

## TL;DR

> **Quick Summary**: Resolve the full user-listed SonarQube code smells in one coordinated remediation pass, starting with low-risk hygiene fixes, then high-risk cognitive-complexity refactors, and ending with strict regression verification.
>
> **Deliverables**:
> - Sonar-listed smells remediated across backend and frontend target files.
> - Behavioral equivalence evidence for high-complexity refactors.
> - Consolidated verification evidence under `.sisyphus/evidence/`.
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 4 implementation waves + final verification wave
> **Critical Path**: T1 -> T6 -> T9 -> T11 -> T18 -> T20 -> F1-F4

---

## Context

### Original Request
User provided a comprehensive list of open SonarQube findings (minor/major/critical) and asked to remove or refactor all listed issues across backend and frontend modules.

### Interview Summary
**Key Discussions**:
- Scope is the user-listed findings only (no feature additions).
- Work should be delivered as one consolidated plan.
- Test strategy is confirmed as **tests-after** (not strict TDD).

**Research Findings**:
- Test scripts exist: `npm test`, `vitest run`, `node --test server/**/__tests__/**/*.test.js`.
- Backend tests exist across `server/**/__tests__`.
- Hotspot files include `server/controllers/jadwalController.js`, `server/utils/sqlParser.js`, and multiple large React components.
- `vite.config.ts` references `src/setupTests.ts`, which is currently missing and must be stabilized for frontend test reliability.

### Metis Review
**Identified Gaps (addressed in this plan)**:
- Add explicit baseline/stabilization step before refactors.
- Lock guardrails against scope creep (`qwen-code-repo/`, `src/components/ui/*`, unrelated hardening/rearchitecture).
- Require behavior-equivalence checks for high-complexity controller refactors.
- Add explicit Sonar reconciliation step to map each listed finding to a concrete remediation outcome.

---

## Work Objectives

### Core Objective
Remediate all user-listed SonarQube findings with minimal behavioral risk by sequencing low-risk cleanup first, then constrained complexity refactors with automated evidence capture.

### Concrete Deliverables
- Updated code in listed target files only, plus minimal supporting test-harness stabilization if required.
- Evidence artifacts proving test/baseline/regression status and Sonar issue-to-fix mapping.

### Definition of Done
- [ ] Every user-listed finding has a mapped resolution status (`fixed` / `false-positive` / `blocked-with-rationale`).
- [ ] `npm run test:server` passes on final branch.
- [ ] `npm run test:client` passes (after harness stabilization in T1 if needed).
- [ ] `npm run lint` and `npx tsc --noEmit` produce no new errors from touched app files.
- [ ] QA evidence exists for all tasks in `.sisyphus/evidence/`.

### Must Have
- Resolve all listed unused imports/variables, naming conventions, regex/class cleanups, and async/export conventions.
- Reduce all listed cognitive-complexity hotspots to Sonar-acceptable thresholds.
- Preserve runtime behavior and transaction safety in backend controller flows.

### Must NOT Have (Guardrails)
- No edits under `src/components/ui/*` (UI Freeze guardrail).
- No edits under `qwen-code-repo/`.
- No feature additions, schema changes, endpoint contract changes, or unrelated security hardening.
- No broad architectural rewrites (file-boundary reshuffles) while fixing smells.
- No SQL semantic changes unless strictly required by a listed finding.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — verification is agent-executed only.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Frameworks**: Vitest (frontend), Node test runner (backend)

### QA Policy
- Every task includes executable QA scenarios with one happy path and one failure/edge case.
- Evidence file naming: `task-{N}-{scenario-slug}.{ext}` in `.sisyphus/evidence/`.
- UI scenarios use Playwright; backend scenarios use Node tests and curl; CLI/runtime scenarios use Bash/tmux as needed.
- If a listed Playwright selector does not exist, add deterministic `data-testid` attributes only in the touched component for that task, then reuse those selectors in evidence runs.

### Baseline Rule
Before touching high-risk refactors, capture baseline outputs for:
- `npm run test:server`
- `npm run test:client`
- `npx tsc --noEmit`
- `npm run lint`

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 1 (Foundation + low-risk backend hygiene)
T1  Stabilize test harness and capture baselines
T2  Remove backend unused imports (guru/importMasterSchedule/pdfExport)
T3  System services hygiene (initializer/security-system/queue-system)
T4  Async/export conventions (globalErrorMiddleware/run_migrations/server_modern)
T5  Quick controller cleanups (jamPelajaran/siswa)
T6  Jadwal non-complex smells (Set usage, catch naming, unused vars, negation readability)

Wave 2 (Backend high-risk complexity refactors)
T7  Resolve unattributed finding cluster (L42/L46/L92/L152 etc.) and patch source file
T8  Jadwal complexity refactor group A (L264, L713)
T9  Jadwal complexity refactor group B (L954)
T10 Jadwal complexity refactor group C (L1205)
T11 Jadwal complexity refactor group D (L1367)
T12 Utilities complexity pack (importHelper + sqlParser)

Wave 3 (Frontend remediation)
T13 Frontend quick smells (AdminDashboard + Notification components)
T14 BackupManagementView refactor pack
T15 EditProfile + ExcelPreview remediation
T16 ExcelImport + MonitoringDashboard remediation
T17 PresensiSiswaView remediation
T18 Rekap views remediation (guru + generic)

Wave 4 (Controller completion + consolidation)
T19 Monitoring controller complexity/else-branch cleanup
T20 Sonar reconciliation matrix + full regression bundle

Wave FINAL (Independent verification)
F1 Plan compliance audit
F2 Code quality review
F3 Real QA replay of all task scenarios
F4 Scope fidelity check
```

### Dependency Matrix

- T1: blocked by none -> blocks T7-T20
- T2: blocked by none -> blocks T20
- T3: blocked by none -> blocks T20
- T4: blocked by none -> blocks T20
- T5: blocked by none -> blocks T20
- T6: blocked by none -> blocks T8-T11, T20
- T7: blocked by T1 -> blocks T8-T11, T20
- T8: blocked by T1, T6, T7 -> blocks T20
- T9: blocked by T1, T6, T7 -> blocks T20
- T10: blocked by T1, T6, T7 -> blocks T20
- T11: blocked by T1, T6, T7 -> blocks T20
- T12: blocked by T1 -> blocks T20
- T13: blocked by T1 -> blocks T20
- T14: blocked by T1 -> blocks T20
- T15: blocked by T1 -> blocks T20
- T16: blocked by T1 -> blocks T20
- T17: blocked by T1 -> blocks T20
- T18: blocked by T1 -> blocks T20
- T19: blocked by T1 -> blocks T20
- T20: blocked by T2-T19 -> blocks F1-F4

### Agent Dispatch Summary

- Wave 1: T1 `unspecified-high`, T2 `quick`, T3 `unspecified-high`, T4 `quick`, T5 `unspecified-high`, T6 `deep`
- Wave 2: T7 `unspecified-high`, T8 `deep`, T9 `deep`, T10 `deep`, T11 `deep`, T12 `deep`
- Wave 3: T13 `quick`, T14 `visual-engineering`, T15 `visual-engineering`, T16 `visual-engineering`, T17 `visual-engineering`, T18 `visual-engineering`
- Wave 4: T19 `deep`, T20 `unspecified-high`
- Final: F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

- [x] 1. Stabilize frontend test harness and capture baseline checks

  **What to do**:
  - Ensure vitest setup path is valid (`vite.config.ts:63`) by adding `src/setupTests.ts` or aligning config.
  - Capture baseline outputs for `npm run test:server`, `npm run test:client`, `npx tsc --noEmit`, and `npm run lint` into evidence.

  **Must NOT do**:
  - Do not relax lint/type/test rules to force green output.
  - Do not alter app behavior while fixing harness wiring.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (cross-cutting quality gates)
  - **Skills**: `absenta-frontend`, `absenta-backend`
  - **Skills Evaluated but Omitted**: `visual-engineering` (no UI changes needed)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2-T6)
  - **Blocks**: T7-T20
  - **Blocked By**: None

  **References**:
  - `vite.config.ts:63` - Current setup file reference to validate.
  - `package.json:8` - Combined test script used for baseline.
  - `package.json:9` - Frontend test command.
  - `package.json:22` - Backend test command.
  - WHY: These anchors define the baseline gate and reveal harness mismatch early.

  **Acceptance Criteria**:
  - [ ] Baseline evidence files exist for all four commands.
  - [ ] Frontend test harness path resolves without module-not-found errors.

  **QA Scenarios**:

  ```text
  Scenario: Baseline command suite succeeds or reports known baseline clearly
    Tool: Bash
    Preconditions: Repo dependencies installed
    Steps:
      1. Run `npm run test:server` and save output
      2. Run `npm run test:client` and save output
      3. Run `npx tsc --noEmit` and `npm run lint`
    Expected Result: All command outcomes are captured and reproducible for later comparison
    Failure Indicators: Missing output artifacts, command crashes without captured logs
    Evidence: .sisyphus/evidence/task-1-baseline-suite.txt

  Scenario: Missing setup file path is detected as a hard failure
    Tool: Bash
    Preconditions: Verification script available
    Steps:
      1. Run `node -e "import fs from 'node:fs';process.exit(fs.existsSync('src/setupTests.ts')?0:1)"`
      2. Assert non-zero exit if file absent and record reason
    Expected Result: Harness misconfiguration is surfaced before refactor work
    Failure Indicators: Script passes while setup file is missing
    Evidence: .sisyphus/evidence/task-1-missing-setup-check.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-1-baseline-suite.txt`
  - [ ] `.sisyphus/evidence/task-1-missing-setup-check.txt`

  **Commit**: NO

- [x] 2. Remove unused backend imports in targeted controllers

  **What to do**:
  - Remove `EXPORT_HEADERS` unused import in `server/controllers/guruReportsController.js`.
  - Remove `sendNotFoundError` unused import in `server/controllers/importMasterScheduleController.js`.
  - Remove `sendDatabaseError` unused import in `server/controllers/pdfExportController.js`.

  **Must NOT do**:
  - Do not change controller logic or response schemas.
  - Do not reorder unrelated imports outside touched statements.

  **Recommended Agent Profile**:
  - **Category**: `quick` (safe static cleanup)
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `ultrabrain` (no complex reasoning needed)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T3-T6)
  - **Blocks**: T20
  - **Blocked By**: None

  **References**:
  - `server/controllers/guruReportsController.js:33` - Unused `EXPORT_HEADERS` import finding.
  - `server/controllers/importMasterScheduleController.js:6` - Unused `sendNotFoundError` import finding.
  - `server/controllers/pdfExportController.js:10` - Unused `sendDatabaseError` import finding.
  - `server/__tests__/guru.test.js` - Regression signal for guru report-related flows.
  - WHY: Only import lines should move; behavior must remain identical.

  **Acceptance Criteria**:
  - [ ] No removed symbol remains referenced in each file.
  - [ ] Files pass syntax validation and targeted backend tests remain green.

  **QA Scenarios**:

  ```text
  Scenario: Files compile after import cleanup
    Tool: Bash
    Preconditions: T2 edits applied
    Steps:
      1. Run `node --check server/controllers/guruReportsController.js`
      2. Run `node --check server/controllers/importMasterScheduleController.js`
      3. Run `node --check server/controllers/pdfExportController.js`
    Expected Result: All checks return exit code 0
    Failure Indicators: ReferenceError or syntax error after import removal
    Evidence: .sisyphus/evidence/task-2-node-check.txt

  Scenario: Removed symbols are not referenced anymore
    Tool: Bash
    Preconditions: T2 edits applied
    Steps:
      1. Run `git diff -- server/controllers/guruReportsController.js server/controllers/importMasterScheduleController.js server/controllers/pdfExportController.js`
      2. Assert diff only removes unused imports and no logic statements
    Expected Result: Diff shows import-line cleanup only
    Failure Indicators: Logic/handler body changes appear
    Evidence: .sisyphus/evidence/task-2-diff-scope.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-2-node-check.txt`
  - [ ] `.sisyphus/evidence/task-2-diff-scope.txt`

  **Commit**: YES
  - Message: `chore(sonar-backend): remove unused controller imports`
  - Files: `server/controllers/guruReportsController.js`, `server/controllers/importMasterScheduleController.js`, `server/controllers/pdfExportController.js`
  - Pre-commit: `npm run test:server`

- [x] 3. Apply system service hygiene fixes (initializer/security/queue)

  **What to do**:
  - Remove unused `formatWIBTime` import from `server/services/system/initializer.js`.
  - Remove duplicate character-class entries in regexes in `initializer.js` and `security-system.js`.
  - Replace unspecific `new Error()` with `new TypeError()` in `server/services/system/queue-system.js:218` for type-check intent.

  **Must NOT do**:
  - Do not alter security policy behavior or queue retry semantics.
  - Do not widen regex acceptance criteria beyond duplicate cleanup.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (security/system-sensitive cleanup)
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `visual-engineering` (backend-only task)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T4-T6)
  - **Blocks**: T20
  - **Blocked By**: None

  **References**:
  - `server/services/system/initializer.js:9` - Unused import finding.
  - `server/services/system/initializer.js:85` - Duplicate char-class finding.
  - `server/services/system/security-system.js:30` - Duplicate char-class finding.
  - `server/services/system/queue-system.js:218` - TypeError specificity finding.
  - `server/__tests__/queueSystem.test.js` - Queue behavior regression signal.
  - WHY: These are precision cleanups in sensitive system modules.

  **Acceptance Criteria**:
  - [ ] Queue type-check path throws `TypeError` where applicable.
  - [ ] Regex edits do not change expected validation outcomes.
  - [ ] No removed import remains referenced.

  **QA Scenarios**:

  ```text
  Scenario: Queue type validation throws TypeError
    Tool: Bash
    Preconditions: Queue-system fix merged
    Steps:
      1. Run targeted test: `node --test server/**/__tests__/**/*.test.js --test-name-pattern=queue`
      2. If no exact test exists, run a node snippet invoking the type-guard path with invalid type
      3. Assert thrown error name equals `TypeError`
    Expected Result: Type-guard failures are explicit and specific
    Failure Indicators: Generic Error thrown or no throw
    Evidence: .sisyphus/evidence/task-3-typeerror-check.txt

  Scenario: Regex cleanup does not over-accept invalid characters
    Tool: Bash
    Preconditions: Regex updates in initializer/security applied
    Steps:
      1. Execute existing validation tests if present
      2. Run a script with known-invalid samples and capture outcomes
    Expected Result: Invalid samples remain rejected
    Failure Indicators: Previously invalid samples become accepted
    Evidence: .sisyphus/evidence/task-3-regex-regression.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-3-typeerror-check.txt`
  - [ ] `.sisyphus/evidence/task-3-regex-regression.txt`

  **Commit**: YES
  - Message: `fix(system): apply Sonar service hygiene updates`
  - Files: `server/services/system/initializer.js`, `server/services/system/security-system.js`, `server/services/system/queue-system.js`
  - Pre-commit: `npm run test:server`

- [x] 4. Align async/export conventions in middleware and runtime entrypoints

  **What to do**:
  - Convert re-exports in `server/middleware/globalErrorMiddleware.js:186` to `export ... from` style.
  - Refactor `server/migrations/run_migrations.js:55` to top-level await style.
  - Refactor promise-chain patterns in `server_modern.js:51` and `server_modern.js:482` to top-level await style where safe.

  **Must NOT do**:
  - Do not change startup order or migration side effects.
  - Do not alter middleware behavior or exported symbol names.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `ultrabrain` (pattern conversion only)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1-T3, T5-T6)
  - **Blocks**: T20
  - **Blocked By**: None

  **References**:
  - `server/middleware/globalErrorMiddleware.js:186` - Re-export convention findings.
  - `server/migrations/run_migrations.js:55` - Top-level await convention finding.
  - `server_modern.js:51` and `server_modern.js:482` - Promise-chain to await findings.
  - WHY: These are style-consistency updates that still touch boot-critical paths.

  **Acceptance Criteria**:
  - [ ] Exported middleware identifiers remain unchanged for importers.
  - [ ] Migration and server entry still initialize without runtime exceptions.

  **QA Scenarios**:

  ```text
  Scenario: Migration entry executes with top-level await semantics
    Tool: Bash
    Preconditions: No destructive DB operation is triggered in dry-check mode
    Steps:
      1. Run `node --check server/migrations/run_migrations.js`
      2. Run migration script in non-destructive/test environment if available
      3. Capture startup log output
    Expected Result: Script is syntactically valid and startup flow remains deterministic
    Failure Indicators: SyntaxError, unhandled rejection, changed execution order
    Evidence: .sisyphus/evidence/task-4-migration-await.txt

  Scenario: Middleware re-exports remain import-compatible
    Tool: Bash
    Preconditions: Re-export changes applied
    Steps:
      1. Run a node snippet importing `asyncHandler` and `asyncMiddleware`
      2. Assert both imports are defined functions
    Expected Result: Re-export style change is behavior-neutral
    Failure Indicators: Import undefined or runtime import error
    Evidence: .sisyphus/evidence/task-4-reexport-compat.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-4-migration-await.txt`
  - [ ] `.sisyphus/evidence/task-4-reexport-compat.txt`

  **Commit**: YES
  - Message: `chore(runtime): normalize async and re-export conventions`
  - Files: `server/middleware/globalErrorMiddleware.js`, `server/migrations/run_migrations.js`, `server_modern.js`
  - Pre-commit: `npm run test:server`

- [x] 5. Resolve quick controller smells in jamPelajaran and siswa modules

  **What to do**:
  - Remove useless assignment and unused declaration for `daysToInsert` in `server/controllers/jamPelajaranController.js:48`.
  - Extract nested ternary in `server/controllers/siswaController.js:479` to readable independent statement.
  - Remove unused `nis` declaration in `server/controllers/siswaController.js:540`.

  **Must NOT do**:
  - Do not alter API payload shape for siswa endpoints.
  - Do not change jam pelajaran insertion semantics.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `visual-engineering` (no UI task)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1-T4, T6)
  - **Blocks**: T20
  - **Blocked By**: None

  **References**:
  - `server/controllers/jamPelajaranController.js:48` - Unused variable/assignment findings.
  - `server/controllers/siswaController.js:479` - Nested ternary readability finding.
  - `server/controllers/siswaController.js:540` - Unused `nis` finding.
  - `server/__tests__/jamPelajaran.test.js` - Jam pelajaran behavior baseline.
  - `server/__tests__/siswa.test.js` - Siswa behavior baseline.
  - WHY: Cleanup must not alter endpoint behavior.

  **Acceptance Criteria**:
  - [ ] `daysToInsert` and `nis` findings resolved without dead-code side effects.
  - [ ] Ternary extraction keeps returned values unchanged for same inputs.

  **QA Scenarios**:

  ```text
  Scenario: Jam pelajaran and siswa tests remain green after cleanup
    Tool: Bash
    Preconditions: T5 edits applied
    Steps:
      1. Run `node --test server/**/__tests__/**/*.test.js --test-name-pattern=jamPelajaran`
      2. Run `node --test server/**/__tests__/**/*.test.js --test-name-pattern=siswa`
    Expected Result: Existing behavior assertions still pass
    Failure Indicators: Test regressions on changed branches
    Evidence: .sisyphus/evidence/task-5-targeted-tests.txt

  Scenario: Ternary extraction preserves output for edge inputs
    Tool: Bash
    Preconditions: Access to extracted decision logic
    Steps:
      1. Execute script with edge inputs (null/empty/unknown status values)
      2. Compare outputs with pre-change snapshot or expected table
    Expected Result: Output mapping remains unchanged
    Failure Indicators: Any output divergence for equivalent input
    Evidence: .sisyphus/evidence/task-5-ternary-equivalence.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-5-targeted-tests.txt`
  - [ ] `.sisyphus/evidence/task-5-ternary-equivalence.txt`

  **Commit**: YES
  - Message: `fix(controllers): resolve jamPelajaran and siswa Sonar quick smells`
  - Files: `server/controllers/jamPelajaranController.js`, `server/controllers/siswaController.js`
  - Pre-commit: `npm run test:server`

- [x] 6. Apply non-complex Sonar cleanups in jadwalController

  **What to do**:
  - Convert list membership checks to `Set.has()` for `ALLOWED_DAYS` (`line 14`) and `ALLOWED_ACTIVITY_TYPES` (`line 28`).
  - Fix catch parameter naming at `line 324` and `line 345` to `error_` convention.
  - Resolve readability finding for unexpected negated condition at `line 478`.
  - Remove listed useless assignments/unused declarations around `lines 1217-1218`, `1709-1710`, `1769-1770`.

  **Must NOT do**:
  - Do not change transactional behavior, rollback paths, or SQL semantics.
  - Do not merge this task with cognitive-complexity refactors (kept separate in T8-T11).

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `quick` (large file with high regression risk)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T8-T11, T20
  - **Blocked By**: None

  **References**:
  - `server/controllers/jadwalController.js:14`
  - `server/controllers/jadwalController.js:28`
  - `server/controllers/jadwalController.js:324`
  - `server/controllers/jadwalController.js:345`
  - `server/controllers/jadwalController.js:478`
  - `server/controllers/jadwalController.js:1217`
  - `server/controllers/jadwalController.js:1709`
  - `server/controllers/jadwalController.js:1769`
  - `server/__tests__/jadwal.test.js` - Existing behavior baseline.
  - WHY: These are all non-complexity findings in the same high-risk file.

  **Acceptance Criteria**:
  - [ ] All listed non-complex findings in jadwal are resolved.
  - [ ] No behavioral regressions in existing jadwal tests and core endpoint probes.

  **QA Scenarios**:

  ```text
  Scenario: Jadwal baseline tests pass after non-complex cleanups
    Tool: Bash
    Preconditions: T6 changes only (no T8-T11 yet)
    Steps:
      1. Run `node --test server/**/__tests__/**/*.test.js --test-name-pattern=jadwal`
      2. Capture pass/fail and compare with T1 baseline
    Expected Result: No new failures introduced
    Failure Indicators: New jadwal-related test failures
    Evidence: .sisyphus/evidence/task-6-jadwal-tests.txt

  Scenario: Set-based validation still rejects invalid day/activity values
    Tool: Bash (curl)
    Preconditions: Dev server running with test DB
    Steps:
      1. Send request with invalid `hari` value to jadwal endpoint
      2. Send request with invalid `jenis_aktivitas`
      3. Assert validation error status/code and message remain expected
    Expected Result: Invalid values are rejected as before
    Failure Indicators: Invalid values accepted or incorrect error path
    Evidence: .sisyphus/evidence/task-6-validation-guards.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-6-jadwal-tests.txt`
  - [ ] `.sisyphus/evidence/task-6-validation-guards.txt`

  **Commit**: YES
  - Message: `refactor(jadwal): clear non-complex Sonar findings`
  - Files: `server/controllers/jadwalController.js`
  - Pre-commit: `npm run test:server`

- [x] 7. Resolve unattributed finding cluster and map file:line ownership

  **What to do**:
  - Locate the unresolved findings listed without explicit file anchors (L42/L46/L92/L152 cluster with exception handling, escape char, complexity 71, unused `errors`).
  - Produce/update a deterministic mapping table in evidence (`finding-id -> file:line -> remediation`).
  - Apply only the required fixes after exact location confirmation.

  **Must NOT do**:
  - Do not guess file ownership; every patch must be anchored by verified path/line.
  - Do not broaden refactor scope beyond mapped findings.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `quick` (discovery + patch coupling)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T8-T12)
  - **Blocks**: T8-T11, T20
  - **Blocked By**: T1

  **References**:
  - User-provided unattributed findings (L42, L46, L92, L152, L324, L345 cluster).
  - `server/controllers/jadwalController.js` (candidate hotspot file from issue sequence).
  - WHY: Prevents false fixes and guarantees auditability.

  **Acceptance Criteria**:
  - [ ] Every unattributed finding has a concrete `file:line` mapping.
  - [ ] Mapping evidence includes remediation status and linked commit hash.

  **QA Scenarios**:

  ```text
  Scenario: Mapping table is complete and deterministic
    Tool: Bash
    Preconditions: Discovery completed
    Steps:
      1. Generate `task-7-finding-map.md` with all unattributed entries
      2. Verify each entry has file path, line, rule text, and patch reference
      3. Validate no duplicate or missing entries
    Expected Result: 100% coverage of unattributed cluster
    Failure Indicators: Any missing mapping field or unresolved finding
    Evidence: .sisyphus/evidence/task-7-finding-map.md

  Scenario: Applied fixes do not exceed mapped scope
    Tool: Bash
    Preconditions: T7 code edits committed
    Steps:
      1. Run `git diff --name-only HEAD~1..HEAD`
      2. Assert changed files are limited to mapped file set
    Expected Result: No out-of-scope file modifications
    Failure Indicators: Unexpected files in diff
    Evidence: .sisyphus/evidence/task-7-scope-check.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-7-finding-map.md`
  - [ ] `.sisyphus/evidence/task-7-scope-check.txt`

  **Commit**: YES
  - Message: `chore(sonar-map): resolve unattributed finding ownership`
  - Files: mapped file set only
  - Pre-commit: `npm run test:server`

- [x] 8. Refactor jadwal complexity hotspots group A (L264 and L713)

  **What to do**:
  - Refactor function at `server/controllers/jadwalController.js:264` from complexity 16 -> <=15.
  - Refactor function at `server/controllers/jadwalController.js:713` from complexity 19 -> <=15.
  - Prefer extraction of pure helper branches with identical input/output behavior.

  **Must NOT do**:
  - Do not alter endpoint contract or transaction boundaries.
  - Do not mix in unrelated cleanups.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `quick` (complexity refactor risk)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T20
  - **Blocked By**: T1, T6, T7

  **References**:
  - `server/controllers/jadwalController.js:264` - Complexity finding.
  - `server/controllers/jadwalController.js:713` - Complexity finding.
  - `server/__tests__/jadwal.test.js` - Baseline behavior checks.
  - WHY: Keep refactor surgical and behavior-preserving.

  **Acceptance Criteria**:
  - [ ] Both target functions satisfy complexity threshold in Sonar recheck.
  - [ ] Existing jadwal tests and endpoint probes remain equivalent.

  **QA Scenarios**:

  ```text
  Scenario: Functional equivalence after complexity reduction
    Tool: Bash (curl)
    Preconditions: Dev server + fixture data ready
    Steps:
      1. Execute pre-recorded request set for endpoints hitting both functions
      2. Capture response status/body before and after refactor
      3. Diff JSON outputs ignoring non-deterministic timestamps
    Expected Result: Business fields are identical across runs
    Failure Indicators: Value mismatches or changed status codes
    Evidence: .sisyphus/evidence/task-8-equivalence.json

  Scenario: Error path remains stable for invalid payloads
    Tool: Bash (curl)
    Preconditions: Same endpoint set
    Steps:
      1. Send invalid payload cases that trigger branch-heavy validation
      2. Assert same error status and code family as baseline
    Expected Result: Graceful failures unchanged
    Failure Indicators: Crashes, uncaught errors, or altered error semantics
    Evidence: .sisyphus/evidence/task-8-error-paths.json
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-8-equivalence.json`
  - [ ] `.sisyphus/evidence/task-8-error-paths.json`

  **Commit**: YES
  - Message: `refactor(jadwal): reduce complexity hotspots group-a`
  - Files: `server/controllers/jadwalController.js`
  - Pre-commit: `npm run test:server`

- [x] 9. Refactor jadwal complexity hotspot group B (L954)

  **What to do**:
  - Refactor function at `server/controllers/jadwalController.js:954` from complexity 27 -> <=15.
  - Isolate nested decision branches into private helpers with explicit naming.

  **Must NOT do**:
  - Do not alter query parameter semantics or validation boundaries.
  - Do not change response message keys.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `ultrabrain` (focused local refactor)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T20
  - **Blocked By**: T1, T6, T7

  **References**:
  - `server/controllers/jadwalController.js:954` - Critical complexity finding.
  - `server/__tests__/jadwal.test.js` - Existing regression suite.
  - WHY: This branch-heavy function needs strict equivalence validation.

  **Acceptance Criteria**:
  - [ ] Complexity target met for line-954 function.
  - [ ] Endpoint outputs match baseline fixtures.

  **QA Scenarios**:

  ```text
  Scenario: Hotspot-B happy path equivalence
    Tool: Bash (curl)
    Preconditions: Baseline fixture requests prepared
    Steps:
      1. Replay baseline happy-path requests against refactored endpoint
      2. Compare key response fields (`data`, `meta`, `message`) with baseline snapshot
    Expected Result: Field-level parity
    Failure Indicators: Missing fields or value drift
    Evidence: .sisyphus/evidence/task-9-happy-equivalence.json

  Scenario: Hotspot-B failure handling equivalence
    Tool: Bash (curl)
    Preconditions: Invalid and boundary-case payloads available
    Steps:
      1. Replay failure payload set
      2. Assert error code, status, and safe message are unchanged
    Expected Result: Stable and graceful failures
    Failure Indicators: 500 regressions, unhandled exception traces
    Evidence: .sisyphus/evidence/task-9-failure-equivalence.json
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-9-happy-equivalence.json`
  - [ ] `.sisyphus/evidence/task-9-failure-equivalence.json`

  **Commit**: YES
  - Message: `refactor(jadwal): reduce complexity hotspot-b`
  - Files: `server/controllers/jadwalController.js`
  - Pre-commit: `npm run test:server`

- [x] 10. Refactor jadwal complexity hotspot group C (L1205)

  **What to do**:
  - Refactor function at `server/controllers/jadwalController.js:1205` from complexity 37 -> <=15.
  - Keep low-risk unused-variable removals from T6 intact; do not reintroduce dead assignments.

  **Must NOT do**:
  - Do not change authorization/permission branch outcomes.
  - Do not alter transaction rollback placement.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T20
  - **Blocked By**: T1, T6, T7

  **References**:
  - `server/controllers/jadwalController.js:1205` - Critical complexity finding.
  - `server/controllers/jadwalController.js:1217` - Nearby dead-assignment findings to preserve as cleaned.
  - `server/__tests__/jadwal.test.js` - Baseline behavior checks.
  - WHY: Nearby smell clusters increase accidental regression risk.

  **Acceptance Criteria**:
  - [ ] Complexity for the target function is reduced to <=15.
  - [ ] No behavioral deltas for known role/permission branches.

  **QA Scenarios**:

  ```text
  Scenario: Group-C role/permission flows stay equivalent
    Tool: Bash (curl)
    Preconditions: Test users for each role available
    Steps:
      1. Execute identical request set as admin/guru/siswa roles
      2. Compare status/body snapshots with baseline
    Expected Result: Same authorization and data filtering outcomes
    Failure Indicators: Role-based behavior drift
    Evidence: .sisyphus/evidence/task-10-role-equivalence.json

  Scenario: Group-C rollback/error behavior remains graceful
    Tool: Bash (curl)
    Preconditions: Error-triggering payloads prepared
    Steps:
      1. Trigger branch that enters error path
      2. Assert response is controlled (no raw stack), status code unchanged
    Expected Result: Stable controlled failure behavior
    Failure Indicators: Raw stack exposure, status drift, unhandled rejection
    Evidence: .sisyphus/evidence/task-10-error-guards.json
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-10-role-equivalence.json`
  - [ ] `.sisyphus/evidence/task-10-error-guards.json`

  **Commit**: YES
  - Message: `refactor(jadwal): reduce complexity hotspot-c`
  - Files: `server/controllers/jadwalController.js`
  - Pre-commit: `npm run test:server`

- [ ] 11. Refactor jadwal complexity hotspot group D (L1367)

  **What to do**:
  - Refactor function at `server/controllers/jadwalController.js:1367` from complexity 50 -> <=15.
  - Split nested condition branches into named helper units and flatten control flow.

  **Must NOT do**:
  - Do not change response schema fields or error-code taxonomy.
  - Do not combine with unrelated modules.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `unspecified-low` (risk too high)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T20
  - **Blocked By**: T1, T6, T7

  **References**:
  - `server/controllers/jadwalController.js:1367` - Highest-complexity jadwal finding.
  - `server/__tests__/jadwal.test.js` - Existing verification anchor.
  - WHY: This is the most fragile branch cluster in jadwal.

  **Acceptance Criteria**:
  - [ ] Complexity reduced to Sonar threshold.
  - [ ] Happy and failure endpoint contracts remain unchanged.

  **QA Scenarios**:

  ```text
  Scenario: Group-D happy path parity
    Tool: Bash (curl)
    Preconditions: Fixture dataset loaded
    Steps:
      1. Execute canonical successful request suite for affected endpoint(s)
      2. Compare JSON bodies to baseline snapshots
    Expected Result: No semantic output differences
    Failure Indicators: Missing keys, incorrect totals, altered sort/order
    Evidence: .sisyphus/evidence/task-11-happy-parity.json

  Scenario: Group-D invalid input behavior parity
    Tool: Bash (curl)
    Preconditions: Boundary and malformed payload set available
    Steps:
      1. Submit invalid payloads covering each major decision branch
      2. Assert error status and message family remain stable
    Expected Result: Controlled and consistent errors
    Failure Indicators: New 500s or changed validation semantics
    Evidence: .sisyphus/evidence/task-11-invalid-parity.json
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-11-happy-parity.json`
  - [ ] `.sisyphus/evidence/task-11-invalid-parity.json`

  **Commit**: YES
  - Message: `refactor(jadwal): reduce complexity hotspot-d`
  - Files: `server/controllers/jadwalController.js`
  - Pre-commit: `npm run test:server`

- [ ] 12. Resolve utility complexity findings in importHelper and sqlParser

  **What to do**:
  - Convert `ALLOWED_JENIS_AKTIVITAS` checks to `Set.has()` in `server/utils/importHelper.js:195`.
  - Refactor complexity 19 function in `importHelper.js:272` and extract nested ternary at `line 339`.
  - Refactor `server/utils/sqlParser.js` complexity 94 function to <=15 using composable parser phases.

  **Must NOT do**:
  - Do not change parsing output format or accepted SQL dialect subset.
  - Do not alter import helper public API signatures.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `quick` (major parser complexity risk)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T20
  - **Blocked By**: T1

  **References**:
  - `server/utils/importHelper.js:195`
  - `server/utils/importHelper.js:272`
  - `server/utils/importHelper.js:339`
  - `server/utils/sqlParser.js:1`
  - `server/__tests__/formatUtils.test.js` - Existing utility testing style reference.
  - WHY: Utility functions have broad blast radius and need strict equivalence.

  **Acceptance Criteria**:
  - [ ] Set-based and ternary findings in `importHelper.js` resolved.
  - [ ] `sqlParser` complexity finding resolved with parser output unchanged for baseline cases.

  **QA Scenarios**:

  ```text
  Scenario: Parser output parity on representative SQL corpus
    Tool: Bash
    Preconditions: Corpus file with valid statements and expected normalized output
    Steps:
      1. Run parser before/after on the same SQL corpus
      2. Diff normalized outputs and allow only whitespace-insignificant differences
    Expected Result: Semantic parse output parity
    Failure Indicators: Tokenization or structure mismatches
    Evidence: .sisyphus/evidence/task-12-parser-parity.txt

  Scenario: Import helper rejects invalid jenis_aktivitas values
    Tool: Bash
    Preconditions: Invalid value set prepared
    Steps:
      1. Execute helper with invalid activity type samples
      2. Assert rejection path and error messaging consistency
    Expected Result: Invalid values are consistently rejected
    Failure Indicators: Invalid type accepted or wrong error path
    Evidence: .sisyphus/evidence/task-12-importhelper-guards.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-12-parser-parity.txt`
  - [ ] `.sisyphus/evidence/task-12-importhelper-guards.txt`

  **Commit**: YES
  - Message: `refactor(utils): address importHelper and sqlParser Sonar hotspots`
  - Files: `server/utils/importHelper.js`, `server/utils/sqlParser.js`
  - Pre-commit: `npm run test:server`

- [ ] 13. Resolve quick frontend smells in AdminDashboard and Notification components

  **What to do**:
  - Remove unused `useCallback` import in `src/components/AdminDashboard.tsx:1`.
  - Mark props as readonly in `src/components/NotificationBell.tsx:25` and `src/components/NotificationPanel.tsx:56`.

  **Must NOT do**:
  - Do not alter notification interaction behavior.
  - Do not change dashboard render tree beyond import cleanup.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `absenta-frontend`, `vercel-react-best-practices`
  - **Skills Evaluated but Omitted**: `visual-engineering` (no design changes)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T14-T18)
  - **Blocks**: T20
  - **Blocked By**: T1

  **References**:
  - `src/components/AdminDashboard.tsx:1`
  - `src/components/NotificationBell.tsx:25`
  - `src/components/NotificationPanel.tsx:56`
  - `src/contexts/__tests__/FontSizeContext.test.tsx` - Frontend test style reference.
  - WHY: Type-level and import-level cleanup should be behavior neutral.

  **Acceptance Criteria**:
  - [ ] No unused-import warning for `useCallback` in AdminDashboard.
  - [ ] Notification prop types enforce readonly semantics.

  **QA Scenarios**:

  ```text
  Scenario: Frontend type and lint checks pass for touched files
    Tool: Bash
    Preconditions: T13 edits applied
    Steps:
      1. Run `npx tsc --noEmit`
      2. Run `npm run lint`
    Expected Result: No new type/lint errors in touched components
    Failure Indicators: Type assignment failures from readonly conversion
    Evidence: .sisyphus/evidence/task-13-type-lint.txt

  Scenario: Notification components still render with expected props
    Tool: Bash (Vitest)
    Preconditions: Add/update component tests for bell/panel
    Steps:
      1. Run `npm run test:client -- src/components/__tests__/Notification*.test.tsx`
      2. Assert render and callback props still function
    Expected Result: Rendering and interaction tests pass
    Failure Indicators: Broken prop compatibility or runtime render errors
    Evidence: .sisyphus/evidence/task-13-notification-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-13-type-lint.txt`
  - [ ] `.sisyphus/evidence/task-13-notification-tests.txt`

  **Commit**: YES
  - Message: `chore(frontend): fix admin and notification Sonar quick smells`
  - Files: `src/components/AdminDashboard.tsx`, `src/components/NotificationBell.tsx`, `src/components/NotificationPanel.tsx`
  - Pre-commit: `npm run test:client`

- [ ] 14. Refactor BackupManagementView Sonar hotspots

  **What to do**:
  - Reduce function complexity from 28 -> <=15 in `src/components/BackupManagementView.tsx:216`.
  - Replace `parentNode.removeChild(childNode)` with `childNode.remove()` at `line 505`.
  - Extract nested ternaries at `lines 860`, `1245`, and `1246` into explicit statements.

  **Must NOT do**:
  - Do not change backup workflow behavior, API calls, or user-visible flow ordering.
  - Do not modify shared UI primitives under `src/components/ui/*`.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `absenta-frontend`, `vercel-react-best-practices`
  - **Skills Evaluated but Omitted**: `artistry` (no visual redesign required)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T20
  - **Blocked By**: T1

  **References**:
  - `src/components/BackupManagementView.tsx:216`
  - `src/components/BackupManagementView.tsx:505`
  - `src/components/BackupManagementView.tsx:860`
  - `src/components/BackupManagementView.tsx:1245`
  - `src/components/BackupManagementView.tsx:1246`
  - WHY: Multiple smell categories in a single large component require isolated refactor + regression tests.

  **Acceptance Criteria**:
  - [ ] All listed Sonar findings in BackupManagementView are resolved.
  - [ ] Backup actions still render and execute in the same sequence.

  **QA Scenarios**:

  ```text
  Scenario: Backup view happy path remains functional
    Tool: Playwright
    Preconditions: App running; authenticated admin test user
    Steps:
      1. Navigate to `/admin/backup`
      2. Click `[data-testid="backup-refresh-button"]`
      3. Assert `[data-testid="backup-table"]` is visible and row count >= 0
    Expected Result: Backup list loads without UI/runtime errors
    Failure Indicators: Console errors, broken table render, non-responsive action button
    Evidence: .sisyphus/evidence/task-14-backup-happy.png

  Scenario: Backup view handles empty/error state gracefully
    Tool: Playwright
    Preconditions: Stub API to return 500 or empty payload
    Steps:
      1. Navigate to `/admin/backup` with failed fetch response
      2. Assert `[data-testid="backup-error-alert"]` or empty-state container appears
    Expected Result: User-friendly fallback state appears, no crash
    Failure Indicators: White screen, uncaught promise rejection, broken layout
    Evidence: .sisyphus/evidence/task-14-backup-error.png
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-14-backup-happy.png`
  - [ ] `.sisyphus/evidence/task-14-backup-error.png`

  **Commit**: YES
  - Message: `refactor(backup-view): reduce complexity and ternary debt`
  - Files: `src/components/BackupManagementView.tsx`
  - Pre-commit: `npm run test:client`

- [ ] 15. Refactor EditProfile and ExcelPreview component findings

  **What to do**:
  - Reduce complexity in `src/components/EditProfile.tsx:189` from 22 -> <=15.
  - Extract nested ternary in `src/components/ExcelPreview.tsx:232`.
  - Replace array-index keys at `src/components/ExcelPreview.tsx:236` and `:318` with stable keys.

  **Must NOT do**:
  - Do not change profile save payload shape.
  - Do not alter excel preview column ordering semantics.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `absenta-frontend`, `vercel-react-best-practices`
  - **Skills Evaluated but Omitted**: `quick` (complexity + key stability work)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T20
  - **Blocked By**: T1

  **References**:
  - `src/components/EditProfile.tsx:189`
  - `src/components/ExcelPreview.tsx:232`
  - `src/components/ExcelPreview.tsx:236`
  - `src/components/ExcelPreview.tsx:318`
  - WHY: These findings affect render stability and readability in user-facing flows.

  **Acceptance Criteria**:
  - [ ] EditProfile complexity finding resolved.
  - [ ] ExcelPreview uses stable non-index keys in listed locations.
  - [ ] Nested ternary replaced with explicit logic.

  **QA Scenarios**:

  ```text
  Scenario: Edit profile submit flow works after refactor
    Tool: Playwright
    Preconditions: Authenticated user at `/profile/edit`
    Steps:
      1. Fill `[name="nama"]` with `Test User QA`
      2. Click `[data-testid="edit-profile-save"]`
      3. Assert success toast text contains `berhasil`
    Expected Result: Profile update succeeds without runtime errors
    Failure Indicators: Form submit failure or missing success confirmation
    Evidence: .sisyphus/evidence/task-15-editprofile-happy.png

  Scenario: Excel preview renders stable rows for duplicate ordering
    Tool: Playwright
    Preconditions: Upload preview data with repeated rows/order changes
    Steps:
      1. Navigate to excel preview route/component host
      2. Trigger re-sort or filter interaction
      3. Assert row identity remains stable (no flicker/misaligned values)
    Expected Result: Stable rendering across reorder operations
    Failure Indicators: Row value swapping or React key warnings in console
    Evidence: .sisyphus/evidence/task-15-excelpreview-stability.png
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-15-editprofile-happy.png`
  - [ ] `.sisyphus/evidence/task-15-excelpreview-stability.png`

  **Commit**: YES
  - Message: `refactor(profile-excel): resolve complexity and key stability findings`
  - Files: `src/components/EditProfile.tsx`, `src/components/ExcelPreview.tsx`
  - Pre-commit: `npm run test:client`

- [ ] 16. Resolve ExcelImport and MonitoringDashboard frontend findings

  **What to do**:
  - Replace array-index keys in `src/components/ExcelImportView.tsx` at `lines 352`, `569`, `606`.
  - Remove useless assignment `testAlert` at `src/components/MonitoringDashboard.tsx:141`.
  - Extract nested ternaries in MonitoringDashboard at `lines 373`, `409`, `431`, `462`, `486`.

  **Must NOT do**:
  - Do not alter import parsing behavior or monitoring metrics logic.
  - Do not change chart semantics and labels.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `absenta-frontend`, `vercel-react-best-practices`
  - **Skills Evaluated but Omitted**: `artistry` (behavioral cleanup only)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T20
  - **Blocked By**: T1

  **References**:
  - `src/components/ExcelImportView.tsx:352`
  - `src/components/ExcelImportView.tsx:569`
  - `src/components/ExcelImportView.tsx:606`
  - `src/components/MonitoringDashboard.tsx:141`
  - `src/components/MonitoringDashboard.tsx:373`
  - WHY: Both components have Sonar readability/perf smells tied to render correctness.

  **Acceptance Criteria**:
  - [ ] No listed index-key findings remain in ExcelImportView.
  - [ ] MonitoringDashboard ternary/unused-variable findings resolved.

  **QA Scenarios**:

  ```text
  Scenario: Excel import preview list remains stable with sorting/filtering
    Tool: Playwright
    Preconditions: Test file with >= 20 rows uploaded
    Steps:
      1. Navigate to excel import page
      2. Upload test sheet and trigger preview
      3. Apply sort/filter and assert row content alignment remains correct
    Expected Result: Rows keep stable identity with no React key warnings
    Failure Indicators: Misaligned rows, flicker, console key warnings
    Evidence: .sisyphus/evidence/task-16-excelimport-stability.png

  Scenario: Monitoring dashboard fallback branches render correctly
    Tool: Playwright
    Preconditions: API can be stubbed to return partial/empty data
    Steps:
      1. Open monitoring dashboard with partial dataset
      2. Assert fallback blocks (`[data-testid="monitoring-empty-state"]`) show correctly
    Expected Result: No ternary-related render crashes
    Failure Indicators: Undefined access errors or blank widget sections
    Evidence: .sisyphus/evidence/task-16-monitoring-fallback.png
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-16-excelimport-stability.png`
  - [ ] `.sisyphus/evidence/task-16-monitoring-fallback.png`

  **Commit**: YES
  - Message: `refactor(import-monitoring): resolve key and ternary Sonar findings`
  - Files: `src/components/ExcelImportView.tsx`, `src/components/MonitoringDashboard.tsx`
  - Pre-commit: `npm run test:client`

- [ ] 17. Resolve PresensiSiswaView Sonar findings pack

  **What to do**:
  - Replace `parentNode.removeChild(childNode)` with `childNode.remove()` at `line 197`.
  - Simplify optional chain target at `line 386`.
  - Replace index-key usage at `lines 412` and `524`.
  - Extract nested ternaries at `lines 499`, `500`, `501`, `502`.

  **Must NOT do**:
  - Do not alter attendance submission payloads.
  - Do not modify business rules for status transitions.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `absenta-frontend`, `vercel-react-best-practices`
  - **Skills Evaluated but Omitted**: `quick` (multi-smell component pack)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T20
  - **Blocked By**: T1

  **References**:
  - `src/components/PresensiSiswaView.tsx:197`
  - `src/components/PresensiSiswaView.tsx:386`
  - `src/components/PresensiSiswaView.tsx:412`
  - `src/components/PresensiSiswaView.tsx:499`
  - `src/components/PresensiSiswaView.tsx:524`
  - WHY: This component has mixed DOM, key, and readability findings with runtime render impact.

  **Acceptance Criteria**:
  - [ ] All listed PresensiSiswaView findings resolved.
  - [ ] Attendance screen remains functional for submit, refresh, and list display flows.

  **QA Scenarios**:

  ```text
  Scenario: Student attendance happy path still submits correctly
    Tool: Playwright
    Preconditions: Authenticated siswa user on attendance page
    Steps:
      1. Select attendance status from `[data-testid="attendance-status-select"]`
      2. Click `[data-testid="attendance-submit"]`
      3. Assert success banner `[data-testid="attendance-success"]` appears
    Expected Result: Submission succeeds and list refreshes correctly
    Failure Indicators: Submission fails or stale list state
    Evidence: .sisyphus/evidence/task-17-presensi-happy.png

  Scenario: Presensi view handles empty/history edge state gracefully
    Tool: Playwright
    Preconditions: API returns empty attendance history
    Steps:
      1. Load page with empty data fixture
      2. Assert `[data-testid="attendance-empty-state"]` is rendered
    Expected Result: Graceful empty state without runtime errors
    Failure Indicators: Crashes or broken conditional rendering
    Evidence: .sisyphus/evidence/task-17-presensi-empty.png
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-17-presensi-happy.png`
  - [ ] `.sisyphus/evidence/task-17-presensi-empty.png`

  **Commit**: YES
  - Message: `refactor(presensi-siswa): fix dom, key, and ternary Sonar findings`
  - Files: `src/components/PresensiSiswaView.tsx`
  - Pre-commit: `npm run test:client`

- [ ] 18. Resolve Rekap view Sonar findings (guru + generic)

  **What to do**:
  - Remove useless assignments in `src/components/RekapKetidakhadiranGuruView.tsx` at lines `124`, `172`, `177`, `182`, `188`, `198`.
  - Extract nested ternaries in RekapKetidakhadiranGuruView at `lines 367`, `388`, `446`.
  - Extract nested ternaries in `src/components/RekapKetidakhadiranView.tsx` at `lines 491`, `512`, `542`, `553`, `558`.

  **Must NOT do**:
  - Do not alter attendance percentage calculations.
  - Do not change export/report output schema.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `absenta-frontend`, `vercel-react-best-practices`
  - **Skills Evaluated but Omitted**: `artistry` (no visual redesign)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T20
  - **Blocked By**: T1

  **References**:
  - `src/components/RekapKetidakhadiranGuruView.tsx:124`
  - `src/components/RekapKetidakhadiranGuruView.tsx:367`
  - `src/components/RekapKetidakhadiranView.tsx:491`
  - `src/components/RekapKetidakhadiranView.tsx:558`
  - WHY: Mixed dead-code and nested-branch cleanup in reporting UIs.

  **Acceptance Criteria**:
  - [ ] Useless assignments removed with no report value drift.
  - [ ] All listed nested ternaries replaced by explicit statements.

  **QA Scenarios**:

  ```text
  Scenario: Rekap views render and compute totals correctly
    Tool: Playwright
    Preconditions: Rekap data fixture loaded
    Steps:
      1. Navigate to rekap guru view and rekap general view
      2. Assert total cards (`[data-testid="rekap-total-ketidakhadiran"]`) show expected numbers
      3. Trigger date/filter changes and verify recalculation
    Expected Result: Totals and percentages remain consistent with fixture
    Failure Indicators: Total mismatch or conditional render errors
    Evidence: .sisyphus/evidence/task-18-rekap-happy.png

  Scenario: Rekap views handle zero-data range gracefully
    Tool: Playwright
    Preconditions: Date range with no data
    Steps:
      1. Apply no-data date filter
      2. Assert `[data-testid="rekap-empty-state"]` appears in both views
    Expected Result: Clear empty state, no divide-by-zero or NaN display
    Failure Indicators: NaN/Infinity percentages or render crash
    Evidence: .sisyphus/evidence/task-18-rekap-empty.png
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-18-rekap-happy.png`
  - [ ] `.sisyphus/evidence/task-18-rekap-empty.png`

  **Commit**: YES
  - Message: `refactor(rekap-views): clear dead-code and ternary Sonar findings`
  - Files: `src/components/RekapKetidakhadiranGuruView.tsx`, `src/components/RekapKetidakhadiranView.tsx`
  - Pre-commit: `npm run test:client`

- [ ] 19. Refactor monitoringController complexity and else-branch smell

  **What to do**:
  - Reduce complexity from 19 -> <=15 in `server/controllers/monitoringController.js:752`.
  - Rewrite `else { if (...) }` pattern at `line 801` into direct `else if` or guard clause.

  **Must NOT do**:
  - Do not change monitoring metrics aggregation semantics.
  - Do not alter API route contracts consumed by dashboard clients.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `absenta-backend`, `git-master`
  - **Skills Evaluated but Omitted**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T20)
  - **Blocks**: T20
  - **Blocked By**: T1

  **References**:
  - `server/controllers/monitoringController.js:752`
  - `server/controllers/monitoringController.js:801`
  - `src/components/MonitoringDashboard.tsx` - Consumer surface to validate non-breaking API behavior.
  - WHY: Controller and UI consumer must stay aligned after refactor.

  **Acceptance Criteria**:
  - [ ] Complexity target met for line-752 function.
  - [ ] Else-branch smell removed with same behavior.
  - [ ] Monitoring API response shape unchanged for current consumers.

  **QA Scenarios**:

  ```text
  Scenario: Monitoring API happy path parity
    Tool: Bash (curl)
    Preconditions: Server running with monitoring endpoint available
    Steps:
      1. Request monitoring endpoint used by dashboard
      2. Validate required keys exist (`cpu`, `memory`, `requestStats`, etc.)
      3. Compare shape against baseline snapshot
    Expected Result: Same response schema and valid values
    Failure Indicators: Missing keys or changed nesting
    Evidence: .sisyphus/evidence/task-19-monitoring-api-parity.json

  Scenario: Monitoring API error path remains controlled
    Tool: Bash (curl)
    Preconditions: Inject failure condition (e.g., missing data source)
    Steps:
      1. Trigger endpoint under failure fixture
      2. Assert graceful error response (no stack leakage)
    Expected Result: Controlled error status/message
    Failure Indicators: 500 with raw trace or malformed error body
    Evidence: .sisyphus/evidence/task-19-monitoring-api-error.json
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-19-monitoring-api-parity.json`
  - [ ] `.sisyphus/evidence/task-19-monitoring-api-error.json`

  **Commit**: YES
  - Message: `refactor(monitoring): reduce complexity and simplify branching`
  - Files: `server/controllers/monitoringController.js`
  - Pre-commit: `npm run test:server`

- [ ] 20. Build Sonar reconciliation matrix and run full regression bundle

  **What to do**:
  - Create a reconciliation artifact mapping each user-listed finding to resolution (`fixed`, `false-positive`, `deferred-with-reason`).
  - Run full regression bundle (`npm run test:server`, `npm run test:client`, `npx tsc --noEmit`, `npm run lint`).
  - Verify final diff scope only includes planned files.

  **Must NOT do**:
  - Do not close findings without direct evidence.
  - Do not include unplanned files in final remediation branch.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`, `absenta-backend`, `absenta-frontend`
  - **Skills Evaluated but Omitted**: `visual-engineering` (verification-oriented task)

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential finalizer)
  - **Blocks**: F1-F4
  - **Blocked By**: T2-T19

  **References**:
  - User-provided Sonar issue list in current planning thread.
  - `.sisyphus/evidence/task-7-finding-map.md` - Unattributed findings ownership map.
  - `package.json:8`, `package.json:9`, `package.json:22`, `vite.config.ts:63` - Verification command anchors.
  - WHY: This task is the formal closure gate before independent verification agents run.

  **Acceptance Criteria**:
  - [ ] Reconciliation matrix covers 100% of listed findings.
  - [ ] Full regression bundle has no new failures.
  - [ ] Scope diff contains only planned files.

  **QA Scenarios**:

  ```text
  Scenario: Full regression bundle passes with recorded outputs
    Tool: Bash
    Preconditions: All prior tasks completed
    Steps:
      1. Run `npm run test:server`
      2. Run `npm run test:client`
      3. Run `npx tsc --noEmit`
      4. Run `npm run lint`
    Expected Result: No new failures relative to baseline; outputs archived
    Failure Indicators: New failing tests/types/lint errors in touched scope
    Evidence: .sisyphus/evidence/task-20-regression-suite.txt

  Scenario: Final diff scope matches planned files only
    Tool: Bash
    Preconditions: Regression bundle complete
    Steps:
      1. Run `git diff --name-only <baseline-commit>...HEAD`
      2. Compare changed files against planned task file set
    Expected Result: Zero out-of-plan files
    Failure Indicators: Any unplanned file in diff
    Evidence: .sisyphus/evidence/task-20-diff-scope.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-20-regression-suite.txt`
  - [ ] `.sisyphus/evidence/task-20-diff-scope.txt`
  - [ ] `.sisyphus/evidence/task-20-sonar-reconciliation.md`

  **Commit**: YES
  - Message: `chore(sonar): finalize reconciliation and regression validation`
  - Files: reconciliation/evidence and any residual planned fixes
  - Pre-commit: full regression bundle

---

## Final Verification Wave

- [ ] F1. Plan Compliance Audit (`oracle`)
  - Validate every task output against plan requirements and guardrails.
  - Confirm all required evidence files exist and are readable.
  - Output: `Must Have [N/N] | Must NOT Have [N/N] | VERDICT`.

- [ ] F2. Code Quality Review (`unspecified-high`)
  - Run `npm run lint`, `npx tsc --noEmit`, `npm run test:server`, `npm run test:client`.
  - Flag new anti-patterns, `as any` escapes, dead/commented code.
  - Output: `Lint | Types | Tests | Files Reviewed | VERDICT`.

- [ ] F3. Real QA Replay (`unspecified-high` + `playwright`)
  - Re-run all task QA scenarios from evidence definitions.
  - Validate integrated behavior for backend endpoints and affected UI views.
  - Save final replay artifacts under `.sisyphus/evidence/final-qa/`.
  - Output: `Scenarios [N/N] | Integration [N/N] | VERDICT`.

- [ ] F4. Scope Fidelity Check (`deep`)
  - Compare final diff against planned file scope.
  - Reject unplanned modifications and cross-task contamination.
  - Output: `Scope Match [N/N] | Unplanned Changes [0 expected] | VERDICT`.

---

## Commit Strategy

- C1 (Wave 1): `chore(sonar-backend): apply low-risk hygiene fixes`
- C2 (Wave 2): `refactor(jadwal-utils): reduce cognitive complexity hotspots`
- C3 (Wave 3): `refactor(frontend): resolve Sonar maintainability findings`
- C4 (Wave 4): `chore(sonar): finalize monitoring cleanup and reconciliation`
- C5 (Final): `test(verification): attach regression and evidence artifacts`

---

## Success Criteria

### Verification Commands

```bash
npm run test:server
npm run test:client
npx tsc --noEmit
npm run lint
```

### Final Checklist

- [ ] All user-listed findings are mapped to resolution outcomes.
- [ ] No forbidden paths touched (`qwen-code-repo/`, `src/components/ui/*`).
- [ ] No endpoint/schema contract regressions detected.
- [ ] All required QA evidence artifacts exist.
- [ ] Final verification wave returns APPROVE on F1-F4.
