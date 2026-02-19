
## T1 Problems — 2026-02-19

### attendanceCalculator.test.js uses bare `beforeEach` (not imported)
- `server/__tests__/attendanceCalculator.test.js` lines 43, 71 use `beforeEach` without importing from `node:test`.
- Node.js test runner requires explicit import: `import { describe, it, beforeEach } from 'node:test'`.
- This causes 2 subtest failures (`getEffectiveDaysMapFromDB`, `calculateEffectiveDaysForRange`) with `ReferenceError: beforeEach is not defined`.
- The 3rd subtest (`calculateAttendancePercentage`) passes fine (3/3 subtests OK) since it doesn't use `beforeEach`.
- **Impact**: 2 test suites always fail in baseline. Not a blocker for T1 (capture-only), but should be fixed eventually.
- **Note**: Full test:server still reports 185 pass / 0 fail at the TAP summary level — the `beforeEach` failures are counted as suite-level failures but individual test counts exclude them.

## T6 Problems — 2026-02-19

### `npm run test:server` still fails from pre-existing test issue
- Task T6 verification rerun confirms suite-level failures still come from `server/__tests__/attendanceCalculator.test.js` (`beforeEach is not defined`).
- This failure predates T6 and is unrelated to `server/controllers/jadwalController.js` changes.
- Evidence captured in `.sisyphus/evidence/task-6-jadwal-tests.txt`.
