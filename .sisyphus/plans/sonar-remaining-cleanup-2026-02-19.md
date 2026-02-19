# Sonar Remaining Cleanup Plan (2026-02-19)

## TL;DR

> **Quick Summary**: Close remaining open Sonar items from the provided list using low-risk mechanical fixes first, then controlled refactors for high-complexity files, with strict regression gates after each wave.
>
> **Deliverables**:
> - Updated backend/frontend/script/SQL files for still-open findings only
> - Verified clean results on lint + typecheck + build + tests
> - Clear closure map: fixed vs already-fixed vs intentionally deferred
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 implementation waves + final verification wave
> **Critical Path**: Baseline audit -> high-risk refactors -> full verification

---

## Context

### Original Request
Continue until complete (`lanjut`) on the long Sonar issue list, with high accuracy and minimal breakage.

### Interview Summary
**Key Discussions**:
- Continue from prior cleanup batches without stopping.
- Keep behavior unchanged for mechanical fixes.
- Validate every batch with strong verification.
- Prioritize complexity refactors first for the next wave; SQL giant-file cleanup remains in a later dedicated wave.

**Research Findings**:
- Many items from the pasted list are already fixed in current tree.
- Remaining risk-heavy scope is concentrated in large seeders/controllers and SQL duplicate-literal findings.

### Metis Review
**Identified Gaps** (addressed in this plan):
- Missing explicit guardrails for Sonar-excluded paths and regression safety.
- Missing baseline verification and per-wave quality gates.
- Scope creep risk around opportunistic refactors.
- Missing precise acceptance criteria for each task.

---

## Work Objectives

### Core Objective
Resolve all still-open Sonar issues from the supplied list in one pass, while preserving behavior and preventing regressions.

### Concrete Deliverables
- Updated target files with only issue-relevant changes.
- Open-item closure report mapped by file and rule.
- Green verification: lint, typecheck, build, test.

### Definition of Done
- [ ] Every listed issue is classified as `fixed-now`, `already-fixed`, or `deferred-with-reason`.
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` passes.
- [ ] `npm test` passes.

### Must Have
- Fix only issues still present in current code.
- Keep public behavior/API unchanged unless issue explicitly requires otherwise.
- Run verification after each wave and at end.

### Must NOT Have (Guardrails)
- No opportunistic architecture rewrites beyond listed Sonar scope.
- No signature-breaking changes to controller exports/routes.
- No edits to unrelated modules "while nearby".
- No unresolved lint/type/test failures left behind.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — all checks are command/tool executed by the agent.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: YES (tests-after each wave)
- **Framework**: `vitest` + `node --test`
- **Primary gates**: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test`

### QA Policy
- Frontend/UI checks: lint + build + spot interaction checks where impacted.
- Backend checks: unit/integration tests + endpoint smoke where impacted.
- SQL/scripts checks: syntax/runner checks and dry-run validations where applicable.
- Evidence location: `.sisyphus/evidence/task-{N}-{scenario}.{ext}`

---

## Execution Strategy

### Parallel Execution Waves

Wave 0 (Baseline/Preparation):
- Establish current baseline and open-item map from provided list.

Wave 1 (Low-risk mechanical, high parallel):
- Unused imports/vars, naming conventions, String.raw/readability, explicit SQL ordering.

Wave 2 (Medium-risk mechanical):
- Remaining top-level-await/promise-chain cleanups and duplicated-literal consolidations in script/test helper files.

Wave 3 (High-risk refactors):
- Complexity reduction in large seeders/controllers still flagged.

Wave 4 (SQL-heavy dedup):
- Large duplicate-literal cleanup in SQL files with import/seed compatibility protection.

Wave FINAL (Independent parallel review):
- Compliance audit, code quality audit, scenario QA, scope fidelity audit.

### Dependency Matrix

- T1-T3: none -> unblock T4-T10
- T4-T7: depend on T1 baseline map
- T8-T10: depend on T1 + T4-T7 for stability checks
- F1-F4: depend on all T1-T10

### Agent Dispatch Summary

- Wave 0: `deep` / `unspecified-high`
- Wave 1: `quick` / `unspecified-low`
- Wave 2: `quick` / `unspecified-high`
- Wave 3: `deep` / `ultrabrain`
- Wave 4: `unspecified-high` / `writing`
- Final: `oracle`, `deep`, `unspecified-high`

---

## TODOs

### Wave 0 / Wave 1 (baseline + low risk)

- [ ] 1. Build authoritative open-issue baseline map from the pasted list

  **What to do**:
  - Parse the pasted Sonar list into a normalized table (`file`, `rule`, `line`, `severity`, `status`).
  - Verify each listed item against current code and classify as `still_present`, `already_fixed`, or `defer_with_reason`.
  - Save baseline artifact as `.sisyphus/evidence/task-1-sonar-baseline.md`.

  **Must NOT do**:
  - Do not edit source code in this task.
  - Do not assume old scan state without current-file proof.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: high-context audit and dedup of a large issue list.
  - **Skills**: `awesome-opencode`, `absenta-backend`
    - `awesome-opencode`: efficient repo-wide discovery/query patterns.
    - `absenta-backend`: aligns findings with existing backend conventions.
  - **Skills Evaluated but Omitted**:
    - `absenta-frontend`: not primary here because this is a cross-stack audit task.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 0 (sequential prerequisite)
  - **Blocks**: 2, 3, 4, 5, 6, 7-15
  - **Blocked By**: None

  **References**:
  - `create_admin.js` - verify top-level-await item closure.
  - `database/seeders/seed_dummy_full.js` - verify complexity and import-style findings.
  - `database/seeders/seed_dummy_range.js` - verify complexity and async-entry findings.
  - `database/absenta13.sql` - verify duplicate-literal findings in static dump.
  - `database/seeds/seed_jam_pelajaran.sql` - verify duplicate-literal and `ORDER BY ... ASC` findings.

  **Acceptance Criteria**:
  - [ ] Baseline file exists and includes every pasted issue row.
  - [ ] Every row has explicit status and evidence path.
  - [ ] No ambiguous rows without `defer_with_reason` note.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Build baseline map (happy path)
    Tool: Bash + Read/Grep
    Preconditions: Working tree available
    Steps:
      1. Generate normalized issue table from pasted list into .sisyphus/evidence/task-1-sonar-baseline.md
      2. For each row, verify file+line pattern from current code and set status
      3. Re-read artifact and assert all rows have status field
    Expected Result: Complete baseline map with 100% rows classified
    Failure Indicators: Missing rows, empty status, no evidence reference
    Evidence: .sisyphus/evidence/task-1-sonar-baseline.md

  Scenario: Detect unresolved ambiguity (negative path)
    Tool: Bash + Grep
    Preconditions: Baseline generated
    Steps:
      1. Search artifact for rows lacking status or evidence marker
      2. Assert count is 0
    Expected Result: No incomplete baseline entries
    Evidence: .sisyphus/evidence/task-1-sonar-baseline-validation.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-1-sonar-baseline.md`
  - [ ] `task-1-sonar-baseline-validation.txt`

  **Commit**: NO

- [ ] 2. Close still-open async/import style items in scripts/seed entrypoints

  **What to do**:
  - Fix remaining top-level-await/promise-chain style issues still present in:
    - `scripts/import-db.js`
    - `scripts/reset_admin.js` (re-check; keep only if still flagged)
    - `database/seeders/seed_dummy_range.js` (entrypoint style only)
    - `database/seeders/seed_schedule_config.js` (entrypoint style only)
  - Keep runtime behavior identical.

  **Must NOT do**:
  - Do not refactor business logic in this task.
  - Do not touch unrelated script output formatting.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: mechanical entrypoint cleanup.
  - **Skills**: `absenta-backend`, `awesome-opencode`
    - `absenta-backend`: script style aligns with backend ESM conventions.
    - `awesome-opencode`: quickly locate exact stale patterns.
  - **Skills Evaluated but Omitted**:
    - `absenta-frontend`: not relevant to script entrypoint cleanup.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 3, 4, 5, 6)
  - **Blocks**: 13, 15
  - **Blocked By**: 1

  **References**:
  - `scripts/import-db.js` - currently uses async wrapper `run()` pattern.
  - `scripts/reset_admin.js` - compare with top-level-await style already used in other scripts.
  - `database/seeders/seed_dummy_range.js` - entrypoint/catch style near file end.
  - `database/seeders/seed_schedule_config.js` - entrypoint style and error exit convention.

  **Acceptance Criteria**:
  - [ ] No remaining promise-chain/legacy async-entry pattern in targeted files.
  - [ ] `node --check` passes for each changed JS file.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Async/import style validation (happy path)
    Tool: Bash
    Preconditions: Target files updated
    Steps:
      1. Run node --check on each changed file
      2. Grep each file for .then/.catch entrypoint chain and old wrapper usage
      3. Assert zero matches for targeted anti-patterns
    Expected Result: Syntax valid and style anti-patterns removed
    Failure Indicators: node --check error or pattern still present
    Evidence: .sisyphus/evidence/task-2-async-style-check.txt

  Scenario: Guard against behavioral drift (negative path)
    Tool: Bash
    Preconditions: Files changed
    Steps:
      1. Run one representative script in dry environment (no destructive action)
      2. Verify expected startup log and non-zero exit on intentional invalid input
    Expected Result: Error handling still works and exits correctly
    Evidence: .sisyphus/evidence/task-2-dry-run.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-2-async-style-check.txt`
  - [ ] `task-2-dry-run.txt`

  **Commit**: YES
  - Message: `fix(scripts): normalize async entrypoint style`

- [ ] 3. Remove remaining unused backend imports/vars (group A)

  **What to do**:
  - Resolve still-open unused import/var findings in:
    - `server/backend/export/excelStreamingBuilder.js`
    - `server/controllers/absensiController.js`
  - Preserve all exported API behavior.

  **Must NOT do**:
  - Do not alter response shape or business logic.
  - Do not change route wiring.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: localized mechanical cleanup across two files.
  - **Skills**: `absenta-backend`
    - `absenta-backend`: ensures consistency with error/logging patterns and controller style.
  - **Skills Evaluated but Omitted**:
    - `awesome-opencode`: not required for small, localized edits.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2, 4, 5, 6)
  - **Blocks**: 15
  - **Blocked By**: 1

  **References**:
  - `server/backend/export/excelStreamingBuilder.js` - check unused `getLetterhead` import and destructuring leftovers.
  - `server/controllers/absensiController.js` - verify `sendSuccessResponse` and status-set usage are fully consistent.

  **Acceptance Criteria**:
  - [ ] No unused import/variable warnings remain in targeted files.
  - [ ] `npm run lint` passes for targeted files.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Lint clean for group A (happy path)
    Tool: Bash
    Preconditions: Group A files changed
    Steps:
      1. Run eslint on both files
      2. Run node --check on both files
      3. Assert zero errors/warnings for unused bindings
    Expected Result: Files are clean and syntactically valid
    Failure Indicators: any no-unused-vars/no-unused-imports lint errors
    Evidence: .sisyphus/evidence/task-3-lint-group-a.txt

  Scenario: API smoke sanity (negative path)
    Tool: Bash (curl)
    Preconditions: Dev server running
    Steps:
      1. Hit one absensi endpoint with invalid payload
      2. Assert controlled validation error response (not 500)
    Expected Result: Error handling unchanged after cleanup
    Evidence: .sisyphus/evidence/task-3-api-smoke-error.json
  ```

  **Evidence to Capture**:
  - [ ] `task-3-lint-group-a.txt`
  - [ ] `task-3-api-smoke-error.json`

  **Commit**: YES
  - Message: `fix(backend): remove unused imports group-a`

- [ ] 4. Remove remaining unused backend imports/vars and catch naming (group B)

  **What to do**:
  - Resolve still-open smells in:
    - `server/controllers/backupController.js`
    - `server/controllers/databaseFileController.js`
  - Ensure catch-variable naming and fallback handling satisfy style rules.

  **Must NOT do**:
  - Do not change backup/restore semantics.
  - Do not alter security validation paths.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: focused mechanical cleanup in two controllers.
  - **Skills**: `absenta-backend`
    - `absenta-backend`: needed for safe backup/database controller conventions.
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: unnecessary for straightforward cleanup.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2, 3, 5, 6)
  - **Blocks**: 15
  - **Blocked By**: 1

  **References**:
  - `server/controllers/backupController.js` - catch naming and exception handling around manual delete fallback.
  - `server/controllers/databaseFileController.js` - verify unused import cleanup and file-exec path behavior.

  **Acceptance Criteria**:
  - [ ] Lint passes without unused-import/catch-style complaints in both files.
  - [ ] Backup delete fallback path still returns structured result.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Backup/database lint validation (happy path)
    Tool: Bash
    Preconditions: Group B files changed
    Steps:
      1. Run eslint on both files
      2. Run node --check on both files
      3. Assert no style/unused errors
    Expected Result: Mechanical issues resolved with valid syntax
    Failure Indicators: lint/style violations remain
    Evidence: .sisyphus/evidence/task-4-lint-group-b.txt

  Scenario: Fallback branch behavior (negative path)
    Tool: Bash (node test harness or curl)
    Preconditions: Controlled non-existing backup id
    Steps:
      1. Trigger delete with invalid backup id
      2. Assert graceful failure object/response (no crash)
    Expected Result: Structured error path preserved
    Evidence: .sisyphus/evidence/task-4-fallback-negative.json
  ```

  **Evidence to Capture**:
  - [ ] `task-4-lint-group-b.txt`
  - [ ] `task-4-fallback-negative.json`

  **Commit**: YES
  - Message: `fix(backend): remove unused imports group-b`

- [ ] 5. Remove remaining unused import/test smells (group C)

  **What to do**:
  - Resolve still-open listed items in:
    - `server/controllers/exportController.js`
    - `server/__tests__/attendanceCalculator.test.js`
    - `server/__tests__/downloadAccess.test.js`
  - Keep test intent unchanged.

  **Must NOT do**:
  - Do not weaken assertions to force pass.
  - Do not modify export endpoint behavior for this task.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: low-risk cleanup across one controller and two tests.
  - **Skills**: `absenta-backend`
    - `absenta-backend`: ensures export controller contracts remain stable.
  - **Skills Evaluated but Omitted**:
    - `writing`: no documentation-centric output.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2, 3, 4, 6)
  - **Blocks**: 15
  - **Blocked By**: 1

  **References**:
  - `server/controllers/exportController.js` - unused constant/import findings (`MONTH_NAMES_SHORT`).
  - `server/__tests__/attendanceCalculator.test.js` - unused imports and numeric-literal style.
  - `server/__tests__/downloadAccess.test.js` - `String.raw` readability for path-escape case.

  **Acceptance Criteria**:
  - [ ] Controller/tests lint clean.
  - [ ] Backend test suite still passes.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Targeted tests remain green (happy path)
    Tool: Bash
    Preconditions: Group C files changed
    Steps:
      1. Run node --test for attendance/download test files
      2. Run eslint on exportController + those tests
      3. Assert all pass
    Expected Result: Same functional test outcomes, cleaner code
    Failure Indicators: changed test behavior or lint failures
    Evidence: .sisyphus/evidence/task-5-tests-and-lint.txt

  Scenario: Export controller smoke (negative path)
    Tool: Bash (curl)
    Preconditions: Dev server running
    Steps:
      1. Call one export endpoint with invalid parameters
      2. Assert controlled 4xx response and stable error shape
    Expected Result: No 500 due to cleanup changes
    Evidence: .sisyphus/evidence/task-5-export-negative.json
  ```

  **Evidence to Capture**:
  - [ ] `task-5-tests-and-lint.txt`
  - [ ] `task-5-export-negative.json`

  **Commit**: YES
  - Message: `fix(backend-tests): resolve remaining unused/import smells`

- [ ] 6. Resolve script readability/duplication smells in operational tooling

  **What to do**:
  - Resolve remaining listed readability/duplication items in:
    - `scripts/review-hotspots.py`
    - `scripts/run-database-optimization.js`
    - `scripts/test-config.js`
  - Prefer constants/extracted literals and plain logs without escaped newline noise.

  **Must NOT do**:
  - Do not alter API calls or review semantics in `review-hotspots.py`.
  - Do not change operational behavior of optimization/test scripts.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: pure maintainability cleanup in scripts.
  - **Skills**: `awesome-opencode`
    - `awesome-opencode`: useful for repetitive literal consolidation patterns.
  - **Skills Evaluated but Omitted**:
    - `absenta-frontend`: unrelated to script maintenance.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2, 3, 4, 5)
  - **Blocks**: 15
  - **Blocked By**: 1

  **References**:
  - `scripts/review-hotspots.py` - repeated SAFE comment literals.
  - `scripts/run-database-optimization.js` - escaped newline string patterns.
  - `scripts/test-config.js` - escaped newline string patterns.

  **Acceptance Criteria**:
  - [ ] Duplicate literal findings reduced by introducing constants.
  - [ ] No `\n`-escape readability findings remain in targeted scripts.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Script lint/syntax check (happy path)
    Tool: Bash
    Preconditions: Scripts updated
    Steps:
      1. Run python -m py_compile scripts/review-hotspots.py
      2. Run node --check scripts/run-database-optimization.js scripts/test-config.js
      3. Grep for escaped newline anti-patterns in both JS scripts
    Expected Result: Syntax valid and anti-pattern removed
    Failure Indicators: compile/check errors or anti-pattern still present
    Evidence: .sisyphus/evidence/task-6-script-checks.txt

  Scenario: Behavior parity sample (negative path)
    Tool: Bash
    Preconditions: Safe dry environment
    Steps:
      1. Run scripts with non-destructive mode/expected missing-env
      2. Assert failure messages remain informative and process exits expectedly
    Expected Result: No behavior regression in script control flow
    Evidence: .sisyphus/evidence/task-6-script-behavior.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-6-script-checks.txt`
  - [ ] `task-6-script-behavior.txt`

  **Commit**: YES
  - Message: `chore(scripts): resolve readability and duplicate literals`

### Wave 2 (high-risk complexity refactors)

- [ ] 7. Reduce complexity in `database/seeders/seed_dummy_full.js` (part 1: extraction and orchestration)

  **What to do**:
  - Extract orchestration sub-functions from `seed()` (cleanup, jam seed, mapel seed, kelas seed).
  - Keep SQL statements and insertion order equivalent.
  - Preserve output logs and final result semantics.

  **Must NOT do**:
  - Do not alter seeded data shape/content rules.
  - Do not alter table names or schema assumptions.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: high cognitive complexity refactor with behavior preservation.
  - **Skills**: `absenta-backend`
    - `absenta-backend`: seeder/data-layer refactor safety and conventions.
  - **Skills Evaluated but Omitted**:
    - `quick`: insufficient for large multi-stage refactor.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 sequential start
  - **Blocks**: 8, 15
  - **Blocked By**: 1

  **References**:
  - `database/seeders/seed_dummy_full.js` - current monolithic `seed()` flow.
  - `database/seeders/seed_schedule_config.js` - reference for structured seeder sub-step style.

  **Acceptance Criteria**:
  - [ ] Main seeder flow split into clear helper units.
  - [ ] Static analyzer complexity on `seed()` reduced versus baseline.
  - [ ] Seeding behavior parity retained.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Seeder behavior parity (happy path)
    Tool: Bash
    Preconditions: Local DB seeded test environment ready
    Steps:
      1. Run node database/seeders/seed_dummy_full.js
      2. Query key table counts (ruang_kelas, mapel, kelas, guru, jadwal)
      3. Compare against expected non-zero ranges and integrity checks
    Expected Result: Seeder completes successfully with consistent data shape
    Failure Indicators: runtime exception, FK failures, zero critical tables
    Evidence: .sisyphus/evidence/task-7-seeder-full-parity.txt

  Scenario: Refactor safety under rerun (negative path)
    Tool: Bash
    Preconditions: DB already contains seeded data
    Steps:
      1. Re-run full seeder
      2. Assert idempotent-safe behavior where designed (no crash)
    Expected Result: Controlled rerun behavior without catastrophic failure
    Evidence: .sisyphus/evidence/task-7-seeder-full-rerun.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-7-seeder-full-parity.txt`
  - [ ] `task-7-seeder-full-rerun.txt`

  **Commit**: YES
  - Message: `refactor(seeder): split seed_dummy_full orchestration`

- [ ] 8. Reduce complexity in `database/seeders/seed_dummy_full.js` (part 2: schedule generation and conflict logic)

  **What to do**:
  - Extract teacher/room conflict checks and schedule allocation loops into dedicated helpers.
  - Keep assignment algorithm and constraints unchanged.

  **Must NOT do**:
  - Do not change assignment randomness distribution intentionally.
  - Do not change conflict-prevention semantics.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: dense nested loops and constraint logic.
  - **Skills**: `absenta-backend`
    - `absenta-backend`: DB transaction and scheduling logic safety.
  - **Skills Evaluated but Omitted**:
    - `writing`: no doc-centric output.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (depends on 7)
  - **Blocks**: 15
  - **Blocked By**: 7

  **References**:
  - `database/seeders/seed_dummy_full.js` - schedule generation section and busy-teacher/room maps.

  **Acceptance Criteria**:
  - [ ] Complexity of scheduling block reduced below threshold target.
  - [ ] No teacher/room collision regressions in sampled output.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Collision-free scheduling check (happy path)
    Tool: Bash + SQL
    Preconditions: Seeder run completed
    Steps:
      1. Query jadwal grouped by (hari,jam_ke,guru_id) and (hari,jam_ke,ruang_id)
      2. Assert no duplicates per collision domain where constraint expected
    Expected Result: No invalid collision duplicates in target domains
    Failure Indicators: duplicate groups count > 1
    Evidence: .sisyphus/evidence/task-8-collision-check.sql.txt

  Scenario: Error handling on constrained environment (negative path)
    Tool: Bash
    Preconditions: Limited room set / constrained sample
    Steps:
      1. Run with constrained config
      2. Assert graceful skip/continue behavior instead of crash
    Expected Result: Controlled degradation with informative logs
    Evidence: .sisyphus/evidence/task-8-constrained-run.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-8-collision-check.sql.txt`
  - [ ] `task-8-constrained-run.txt`

  **Commit**: YES
  - Message: `refactor(seeder): simplify schedule conflict logic`

- [ ] 9. Reduce complexity in `database/seeders/seed_dummy_range.js` (part 1: preparation + master data)

  **What to do**:
  - Extract setup blocks (mapel/kelas/guru/siswa/jam/jadwal scaffolding) into composable helpers.
  - Keep runTag naming, insert order, and existing field mappings unchanged.

  **Must NOT do**:
  - Do not change generated identifier formats.
  - Do not modify table column mapping semantics.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: very long seeder pipeline with many dependencies.
  - **Skills**: `absenta-backend`
    - `absenta-backend`: critical for preserving schema interactions.
  - **Skills Evaluated but Omitted**:
    - `quick`: insufficient for this complexity level.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 11, 12 where independent)
  - **Blocks**: 10, 15
  - **Blocked By**: 1

  **References**:
  - `database/seeders/seed_dummy_range.js` - pre-attendance pipeline and helper functions.
  - `database/seeds/seed_jam_pelajaran.sql` - baseline jam semantics to preserve.

  **Acceptance Criteria**:
  - [ ] Main function complexity reduced via helper extraction.
  - [ ] Seeded entities preserve expected cardinality relationships.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Range seeder preparation parity (happy path)
    Tool: Bash + SQL
    Preconditions: DB test target available
    Steps:
      1. Run node database/seeders/seed_dummy_range.js
      2. Validate counts and key FK relationships for kelas/guru/siswa/jadwal
    Expected Result: Seeder completes and relational integrity holds
    Failure Indicators: FK errors, missing key entities, empty expected tables
    Evidence: .sisyphus/evidence/task-9-range-prep-parity.txt

  Scenario: Invalid config handling (negative path)
    Tool: Bash
    Preconditions: Override env with invalid count values
    Steps:
      1. Execute seeder with intentionally bad env values
      2. Assert controlled failure message and non-zero exit
    Expected Result: Predictable validation/failure behavior
    Evidence: .sisyphus/evidence/task-9-range-invalid-config.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-9-range-prep-parity.txt`
  - [ ] `task-9-range-invalid-config.txt`

  **Commit**: YES
  - Message: `refactor(seeder): split seed_dummy_range preparation`

- [ ] 10. Reduce complexity in `database/seeders/seed_dummy_range.js` (part 2: attendance/archive/banding pipeline)

  **What to do**:
  - Extract attendance generation loops, archive copy logic, and banding generation into isolated helpers.
  - Keep weighted-status logic and batch insert behavior unchanged.

  **Must NOT do**:
  - Do not change status probabilities.
  - Do not change archive cutoff semantics.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: nested loops + probabilistic generation + batching logic.
  - **Skills**: `absenta-backend`
    - `absenta-backend`: preserves table contracts and batch insert safety.
  - **Skills Evaluated but Omitted**:
    - `writing`: no prose/documentation objective.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (depends on 9)
  - **Blocks**: 15
  - **Blocked By**: 9

  **References**:
  - `database/seeders/seed_dummy_range.js` - section from attendance generation through archive/banding inserts.

  **Acceptance Criteria**:
  - [ ] Complexity reduced with clear helper boundaries.
  - [ ] Generated attendance/banding record patterns remain consistent.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Attendance and archive generation parity (happy path)
    Tool: Bash + SQL
    Preconditions: Seeder run with default config
    Steps:
      1. Execute seeder
      2. Query absensi_siswa, absensi_guru, archive tables, and pengajuan_banding_absen counts
      3. Assert non-zero, expected relational coherence
    Expected Result: Pipeline produces coherent data without regression
    Failure Indicators: missing archives, empty banding, insert failures
    Evidence: .sisyphus/evidence/task-10-range-attendance-parity.txt

  Scenario: Batch boundary handling (negative path)
    Tool: Bash
    Preconditions: Increase generated rows near chunk boundary
    Steps:
      1. Run with env values that force multiple chunk flushes
      2. Assert no partial insert crash and final completion log
    Expected Result: Chunked inserts remain robust
    Evidence: .sisyphus/evidence/task-10-range-batch-boundary.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-10-range-attendance-parity.txt`
  - [ ] `task-10-range-batch-boundary.txt`

  **Commit**: YES
  - Message: `refactor(seeder): split range attendance pipeline`

- [ ] 11. Reduce complexity in `server/controllers/absensiController.js` target function

  **What to do**:
  - Identify the still-flagged function around the reported line area.
  - Extract validation/decision branches into focused helpers while preserving response shape and error codes.

  **Must NOT do**:
  - Do not change endpoint contract, messages, or status-code behavior.
  - Do not remove permission checks.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: controller refactor with security-sensitive branching.
  - **Skills**: `absenta-backend`
    - `absenta-backend`: required for safe controller/error-handler integration.
  - **Skills Evaluated but Omitted**:
    - `quick`: insufficient for branch-heavy logic.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 9)
  - **Blocks**: 15
  - **Blocked By**: 1

  **References**:
  - `server/controllers/absensiController.js` - target high-complexity function and nearby helper patterns.
  - `server/utils/errorHandler.js` - preserve existing error response semantics.

  **Acceptance Criteria**:
  - [ ] Complexity warning closed for targeted function.
  - [ ] Existing tests and endpoint behavior remain stable.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Endpoint behavior parity (happy path)
    Tool: Bash (curl)
    Preconditions: Dev server + test auth context
    Steps:
      1. Call affected absensi endpoint with valid payload
      2. Assert response success schema and expected fields
      3. Compare key fields with pre-refactor baseline
    Expected Result: Same success behavior as baseline
    Failure Indicators: changed payload shape or unexpected status code
    Evidence: .sisyphus/evidence/task-11-absensi-happy.json

  Scenario: Validation/permission error parity (negative path)
    Tool: Bash (curl)
    Preconditions: Invalid payload or unauthorized class context
    Steps:
      1. Trigger validation and permission failure branches
      2. Assert identical status code class and message contract
    Expected Result: Controlled errors preserved
    Evidence: .sisyphus/evidence/task-11-absensi-negative.json
  ```

  **Evidence to Capture**:
  - [ ] `task-11-absensi-happy.json`
  - [ ] `task-11-absensi-negative.json`

  **Commit**: YES
  - Message: `refactor(absensi): reduce controller branch complexity`

- [ ] 12. Reduce complexity in `server/controllers/authController.js` target function

  **What to do**:
  - Refactor the still-flagged function around reported complexity line.
  - Replace nested conditional branches with extracted helpers and explicit guard clauses.

  **Must NOT do**:
  - Do not change lockout thresholds, captcha trigger policy, or login semantics.
  - Do not alter token/session outputs.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: auth flow changes require strict behavior parity.
  - **Skills**: `absenta-backend`
    - `absenta-backend`: auth-controller and security policy consistency.
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: unnecessary if refactor remains localized.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 9, 11)
  - **Blocks**: 15
  - **Blocked By**: 1

  **References**:
  - `server/controllers/authController.js` - lockout/captcha/login branch logic.
  - `server/__tests__/auth.test.js` - baseline behavioral expectations.

  **Acceptance Criteria**:
  - [ ] Complexity warning closed for targeted auth function.
  - [ ] Auth tests still pass without behavior drift.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Login flow parity (happy path)
    Tool: Bash (curl)
    Preconditions: Known valid account credentials in test env
    Steps:
      1. Submit valid login request
      2. Assert success status, token/session fields, and expected metadata
    Expected Result: Same successful login behavior as baseline
    Failure Indicators: missing token/cookie/field or changed status code
    Evidence: .sisyphus/evidence/task-12-auth-happy.json

  Scenario: Lockout/captcha branch parity (negative path)
    Tool: Bash (curl)
    Preconditions: Repeated invalid login attempts
    Steps:
      1. Trigger failed attempts to threshold
      2. Assert lockout/captcha response remains consistent
    Expected Result: No regression in security branch behavior
    Evidence: .sisyphus/evidence/task-12-auth-negative.json
  ```

  **Evidence to Capture**:
  - [ ] `task-12-auth-happy.json`
  - [ ] `task-12-auth-negative.json`

  **Commit**: YES
  - Message: `refactor(auth): reduce complexity without policy changes`

### Wave 3 (SQL duplication + closure)

- [ ] 13. Reduce duplicate-literal smells in `database/seeds/seed_jam_pelajaran.sql`

  **What to do**:
  - Introduce SQL variables for repeated constants (for example: `@TAHUN_AJARAN`, repeated labels where safe).
  - Preserve inserted row semantics and deterministic order.
  - Keep explicit `ASC` in final ordering clause.

  **Must NOT do**:
  - Do not change slot timing values.
  - Do not alter unique key behavior or upsert semantics.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: SQL script normalization with compatibility constraints.
  - **Skills**: `absenta-backend`
    - `absenta-backend`: required for DB compatibility and seeding safety.
  - **Skills Evaluated but Omitted**:
    - `quick`: SQL regression risk is non-trivial.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 14)
  - **Blocks**: 15
  - **Blocked By**: 1

  **References**:
  - `database/seeds/seed_jam_pelajaran.sql` - repeated literals and ordering clause.
  - `database/seeders/run-seed-jam-pelajaran.js` - execution expectations for this seed data.

  **Acceptance Criteria**:
  - [ ] Duplicate-literal hotspots reduced for this SQL seed file.
  - [ ] SQL file executes successfully and yields expected aggregate summary per day.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: SQL seed execution parity (happy path)
    Tool: Bash (mysql client)
    Preconditions: Test database available
    Steps:
      1. Execute seed_jam_pelajaran.sql on test DB
      2. Run verification query grouped by hari
      3. Assert slot counts and jenis distribution are as expected
    Expected Result: Same seed output semantics with cleaner SQL constants
    Failure Indicators: SQL error or mismatched counts
    Evidence: .sisyphus/evidence/task-13-seed-sql-verify.txt

  Scenario: Re-run idempotence check (negative path)
    Tool: Bash (mysql client)
    Preconditions: Seed already applied once
    Steps:
      1. Re-apply SQL seed
      2. Assert no duplicate explosion due to upsert logic
    Expected Result: Controlled update behavior
    Evidence: .sisyphus/evidence/task-13-seed-sql-rerun.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-13-seed-sql-verify.txt`
  - [ ] `task-13-seed-sql-rerun.txt`

  **Commit**: YES
  - Message: `refactor(sql): deduplicate jam_pelajaran seed literals`

- [ ] 14. Resolve `database/absenta13.sql` duplicate-literal findings with generated-artifact policy

  **What to do**:
  - Apply safe strategy for large SQL dump findings:
    - Treat `database/absenta13.sql` as generated artifact.
    - Route duplicate-literal handling through Sonar scope configuration or documented exclusion policy.
  - Do not hand-edit massive dump literals unless policy explicitly requires it.

  **Must NOT do**:
  - Do not manually refactor thousands of dump literals in-place.
  - Do not break dump import compatibility.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: policy/config-focused resolution with minimal code risk.
  - **Skills**: `awesome-opencode`
    - `awesome-opencode`: efficient policy/config pattern references.
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: not needed for policy-level update.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 13)
  - **Blocks**: 15
  - **Blocked By**: 1

  **References**:
  - `database/absenta13.sql` - static dump target with high duplicate-literal count.
  - `sonar-project.properties` - source/exclusion boundary for Sonar analysis.
  - `docs/` operational docs - place policy note if required.

  **Acceptance Criteria**:
  - [ ] Sonar no longer reports duplicate-literal noise from generated dump artifact.
  - [ ] Dump import workflow remains unchanged.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Sonar scope policy validation (happy path)
    Tool: Bash
    Preconditions: sonar config updated/documented
    Steps:
      1. Run static check to confirm absenta13.sql scope/exclusion policy is active
      2. Re-run Sonar scan or issue query
      3. Assert dump-file duplicate-literal issues are no longer open
    Expected Result: Generated artifact noise removed from open issue set
    Failure Indicators: same duplicate-literal issues remain open
    Evidence: .sisyphus/evidence/task-14-sonar-scope-check.txt

  Scenario: Dump import compatibility (negative path)
    Tool: Bash
    Preconditions: Test DB available
    Steps:
      1. Import database/absenta13.sql into test DB
      2. Assert import completes and key tables are present
    Expected Result: Policy/config change does not affect import usability
    Evidence: .sisyphus/evidence/task-14-dump-import-check.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-14-sonar-scope-check.txt`
  - [ ] `task-14-dump-import-check.txt`

  **Commit**: YES
  - Message: `chore(sonar): apply generated-dump issue policy`

- [ ] 15. Execute closure verification and produce final issue-closure matrix

  **What to do**:
  - Re-run full gates (`lint`, `tsc`, `build`, `test`).
  - Reconcile final Sonar issue state against Task 1 baseline.
  - Produce `.sisyphus/evidence/task-15-closure-matrix.md` with `fixed-now`, `already-fixed`, `deferred` buckets.

  **Must NOT do**:
  - Do not mark unresolved issues as fixed.
  - Do not skip failed gate outputs.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: final reconciliation across multiple waves and outputs.
  - **Skills**: `absenta-backend`, `awesome-opencode`
    - `absenta-backend`: interpret backend regressions correctly.
    - `awesome-opencode`: efficient matrix generation workflow.
  - **Skills Evaluated but Omitted**:
    - `writing`: not primary; this is verification-driven.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 final task
  - **Blocks**: Final Verification Wave (F1-F4)
  - **Blocked By**: 2-14

  **References**:
  - `.sisyphus/evidence/task-1-sonar-baseline.md` - baseline for closure reconciliation.
  - `sonar-project.properties` - verify final scope assumptions.

  **Acceptance Criteria**:
  - [ ] All global quality gates pass.
  - [ ] Closure matrix completed and traceable to baseline.
  - [ ] No unresolved task without explicit defer reason.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Full gate pass (happy path)
    Tool: Bash
    Preconditions: All implementation tasks complete
    Steps:
      1. Run npm run lint
      2. Run npx tsc --noEmit
      3. Run npm run build
      4. Run npm test
    Expected Result: All commands exit 0
    Failure Indicators: any non-zero exit or broken artifact
    Evidence: .sisyphus/evidence/task-15-full-gates.txt

  Scenario: Closure reconciliation integrity (negative path)
    Tool: Bash + Read
    Preconditions: Baseline and final findings available
    Steps:
      1. Cross-check each baseline row against final state
      2. Assert no row left unclassified
    Expected Result: 100% issue rows classified with evidence
    Evidence: .sisyphus/evidence/task-15-closure-matrix.md
  ```

  **Evidence to Capture**:
  - [ ] `task-15-full-gates.txt`
  - [ ] `task-15-closure-matrix.md`

  **Commit**: YES
  - Message: `chore(sonar): finalize closure matrix and verification`

---

## Final Verification Wave (MANDATORY)

- [ ] F1. **Plan Compliance Audit** — `oracle`
  - Verify every Must Have / Must NOT Have against actual diff.
  - Ensure evidence artifacts exist for all task scenarios.

- [ ] F2. **Code Quality Review** — `unspecified-high`
  - Run lint + typecheck + tests, inspect for anti-pattern leftovers.

- [ ] F3. **Real QA Execution** — `unspecified-high`
  - Execute all QA scenarios from tasks and save evidence under `.sisyphus/evidence/final-qa/`.

- [ ] F4. **Scope Fidelity Check** — `deep`
  - Validate no out-of-scope changes and no missing in-scope deliverables.

---

## Commit Strategy

- Batch commits per wave with focused messages (`fix(sonar): ...`, `refactor(seeders): ...`, `chore(scripts): ...`).
- Never combine high-risk refactor with unrelated mechanical edits in one commit.

---

## Success Criteria

### Verification Commands
```bash
npm run lint
npx tsc --noEmit
npm run build
npm test
```

### Final Checklist
- [ ] All still-open Sonar items in scope are closed or explicitly deferred with reason.
- [ ] All quality gates pass.
- [ ] No behavioral regression introduced.
