
## T1 Learnings — 2026-02-19

### src/setupTests.ts already exists
- The plan noted `vite.config.ts:63` references `src/setupTests.ts` which was "currently missing".
- Investigation confirmed the file EXISTS (72 lines) with: `@testing-library/jest-dom` import, mocks for AuthContext, config/api, authUtils, and use-toast hook.
- No creation or modification was needed. The plan's assumption was outdated.

### Baseline summary
- **test:server**: 185 tests passed, 0 failed (TAP level). 2 suite-level beforeEach failures in attendanceCalculator (see problems.md).
- **test:client**: 10 tests passed, 0 failed, 2 test files. vitest excludes `qwen-code-repo/` via defaults.
- **tsc --noEmit**: Clean pass (exit code 0, no output).
- **lint**: 41 problems (17 errors, 24 warnings), ALL from `qwen-code-repo/`. Zero from Absenta source.

### vitest qwen-code-repo exclusion
- Despite earlier handoff claiming vitest picks up 150+ tests from `qwen-code-repo/`, actual run shows `configDefaults.exclude` handles it. Only `src/` test files are scanned.
- The previous session's observation was likely from a different vitest invocation or configuration state.
- **Belt-and-suspenders fix applied**: Added explicit `"qwen-code-repo/**"` to `vite.config.ts` test.exclude to guarantee exclusion regardless of configDefaults behavior across vitest versions.

### Evidence file integrity
- `task-1-baseline-suite.txt` contains all 4 commands with exit codes:
  - `test:server` EXIT 1 (beforeEach issue)
  - `test:client` VITEST_EXIT_CODE=0 (2 files, 10 tests pass)
  - `tsc --noEmit` EXIT_CODE=0
  - `lint` EXIT_CODE=1 (qwen-code-repo contamination in eslint)
- Post-fix verification appended confirming vitest works correctly.

## T6 Learnings — 2026-02-19

### jadwalController non-complex Sonar cleanups are behavior-neutral
- `ALLOWED_DAYS` and `ALLOWED_ACTIVITY_TYPES` are already `Set` instances and all touched validation call sites use `.has(...)`.
- Catch naming cleanup to `error_` was applied in two local fallback catches (`fetchJamSlotsByClass` and `batchUpdateMatrix` class-slot fallback) without changing fallback behavior.
- Negated branch readability fix (`slot.jenis !== 'pelajaran'`) was inverted to positive-first (`slot.jenis === 'pelajaran'`) with equivalent outcomes.
- Removed unused destructured `keterangan_khusus` declarations from `bulkCreateJadwal`, `createJadwal`, and `updateJadwal`.
- No transaction/rollback or SQL statements were modified.

## T2 Learnings — 2026-02-19

### Requirement statement vs plan mismatch
- The task statement provided to Sisyphus-Junior referenced symbols that don't exist in current code (`EXPORT_HEADERS`).
- Previous T2 execution (commit f94cba75) correctly removed genuinely unused imports (`sendNotFoundError`, `sendDatabaseError`).
- **Pattern**: When task description conflicts with actual code state, grep and lsp tools confirm which is current/correct.

### Import verification pattern
- Always verify imported symbols exist before assuming they're unused: `grep -n "SYMBOL" file.js`
- Always verify imported symbols are used: search for both `import` statements AND usage references
- Multiple Sonar runs may produce stale references; code drift is expected in iterative cleanup work

### Evidence file best practices
- Create `task-N-node-check.txt` for syntax validation (shows exit codes for all target files)
- Create `task-N-diff-scope.txt` with git diff output (proves only imports changed, no logic)
- Include timestamps and clear PASS/FAIL indicators for automated parsing

## T7 Learnings — 2026-02-19

### Unattributed finding mapping technique
- SonarQube findings listed without file anchors (only line numbers) required cross-referencing line content with codebase search.
- All four findings (L42/L46/L92/L152) mapped to `server/controllers/importMasterScheduleController.js` via `grep` matching error patterns to function signatures.
- **Pattern**: When Sonar reports omit file paths, search for the exact code pattern described (e.g., "unused catch variable", "replaceAll with regex") across the codebase.

### replaceAll with regex requires `g` flag
- `String.prototype.replaceAll()` with a regex argument **requires** the `g` flag — omitting it throws a `TypeError`.
- SonarQube rule S6353 flags `replaceAll(/.../g, ...)` as redundant because the `g` flag and `replaceAll` both mean "replace all".
- **Correct fix**: Change to `.replace(/.../g, ...)` (keeps the `g` flag, drops the redundant `replaceAll`).
- **Wrong fix**: Removing the `g` flag from `replaceAll` would cause a runtime error.

### Unused variable vs similarly-named property
- L152: `const errors = [];` was declared but never referenced — the code actually uses `results.errors` (line 238), a property on a different object.
- **Pattern**: Sonar's "unused variable" finding may indicate a forgotten refactor where local tracking was replaced by an object property but the local declaration wasn't cleaned up.

### Complexity deferral rationale
- L92: `importMasterSchedule` has cognitive complexity ~71 (threshold 15). This requires extracting helper functions (row parsing, validation, DB operations).
- Properly belongs to T8-T12 complexity refactor tasks — applying a quick fix would risk introducing bugs in a critical import pipeline.
- **Rule**: Map and document, but defer complexity fixes to dedicated refactor tasks with proper test coverage.


## Task T8 Learnings — 2026-02-19T06:06:58.914Z

- Refactoring high-complexity controller paths is safer when split into staged helpers: input validation, context construction, execution, and final response shaping.
- Preserving endpoint behavior required keeping original validation messages and order, especially for create/update jadwal shared processing.
- Conflict checks remained equivalent by centralizing early-return vs collect mode into a single helper ().

### Task T8 Addendum — 2026-02-19T06:07:13.064Z
- Helper referenced in equivalence note: collectOrReturnConflict (name recorded explicitly).

## Task T9 Learnings — 2026-02-19T06:13:49.740Z

- batchUpdateMatrix complexity drops safely when loop responsibilities are split into helpers: slot resolution, conflict gate, upsert application, and counter mapping.
- Keeping rollback in controller-level flow (instead of helper internals) preserves original transaction ownership and failure semantics.
- Using original request day text in validation messages for per-cell errors keeps client-facing message parity.

## Task T10 Learnings — 2026-02-19T06:19:18.188Z

- bulkCreateJadwal complexity is reduced safely by separating request validation, reference checks, class-map lookup, and per-class creation/conflict handling.
- Keeping beginTransaction/commit/rollback in controller scope preserves transaction ownership while helpers stay side-effect scoped to DB operations only.
- Conflict list enrichment is best extracted into a dedicated helper to keep loop logic linear and maintain exact conflict object schema.

### Task T10 Addendum — 2026-02-19T06:21:47.764Z
- Final hotspot-C refactor is centered on bulkCreateJadwal with extracted guards/helpers and unchanged transaction control points in controller scope.

### Task T10 Correction — 2026-02-19T06:24:07.502Z
- Fixed regression in bulk create helper: undefined  was replaced by explicit  param passed from controller callsite with null fallback to preserve insert semantics.

### Task T10 Correction Addendum — 2026-02-19T06:24:23.749Z
- Corrected note: undefined field name was keterangan_khusus, fixed by passing keteranganKhusus into helper and writing keteranganKhusus ?? null.
