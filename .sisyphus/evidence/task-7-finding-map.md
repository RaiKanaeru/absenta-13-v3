# Task 7 — Unattributed Finding Cluster: Deterministic Mapping

## Date: 2026-02-19

## Target File
**`server/controllers/importMasterScheduleController.js`**

All four unattributed findings (L42, L46, L92, L152) are confirmed to belong to this single file.

## Finding Map

| Finding ID | File | Line | Sonar Rule | Description | Remediation | Status |
|------------|------|------|------------|-------------|-------------|--------|
| L42 | `server/controllers/importMasterScheduleController.js` | 42 | S2486 (unused catch variable) | `catch (error)` — `error` variable is declared but never used in the catch block body (only a comment exists) | Rename `error` to `_error` to signal intentional discard | **FIXED** |
| L46 | `server/controllers/importMasterScheduleController.js` | 46 | S6353 (replaceAll with regex should use replace) | `raw.replaceAll(/(^")|("$)/g, '')` — `replaceAll()` with a regex that has `g` flag is redundant; `replace()` with `/g` achieves the same result more idiomatically | Changed `replaceAll(/.../g, '')` to `replace(/.../g, '')` | **FIXED** |
| L92 | `server/controllers/importMasterScheduleController.js` | 92 | S3776 (cognitive complexity) | `importMasterSchedule` function has cognitive complexity ~71 (threshold: 15) | Deferred to complexity refactor wave (not in T7 scope — T7 is mapping + non-complexity fixes only) | **MAPPED — DEFERRED** |
| L152 | `server/controllers/importMasterScheduleController.js` | 152 | S1481 (unused local variable) | `const errors = [];` declared but never read or modified. The code uses `results.errors` (line 238) instead | Remove the unused `errors` declaration | **FIXED** |

## Verification Method
- Each line was located via `grep` and `read` tool against the file
- No guessing — every finding anchored to verified `file:line`
- L324/L345 references in the plan are jadwalController findings (already handled in T6), NOT part of the L42/L46/L92/L152 cluster

## Scope of Code Changes
Only `server/controllers/importMasterScheduleController.js` is modified. Three fixes applied:
1. L42: `catch (error)` → `catch (_error)`
2. L46: `raw.replaceAll(/(^")|("$)/g, '')` → `raw.replace(/(^")|("$)/g, '')`
3. L152: Remove `const errors = [];`

L92 (complexity 71) is mapped but deferred — complexity reduction requires extracting helpers from the main function, which is a T8-T12 scope task, not T7.
