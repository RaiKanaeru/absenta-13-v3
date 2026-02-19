# Decisions - sonar-cleanup
## [2026-02-19T05:20:41+00:00] Task: execution-strategy
- Continue `sonar-cleanup` plan from task 1 (scaffolding).
- Keep scope to listed files; no edits under `src/components/ui/*`.

## [2026-02-19T12:25:00+00:00] Task 1: Scaffolding - No Changes Needed

### Decision: Use Existing Scaffolding
The test scaffolding was already complete:
- setupTests.ts ✅
- handlers.ts ✅  
- SmokeTest.test.tsx ✅ (verification test passing)

**No edits made** - verification only.

### Rationale
- Smoke test demonstrates all mocks work correctly
- Auth context, fetch, apiCall, toast mocks all operational
- Test isolation via beforeEach/afterEach proven in FontSizeContext test
- Ready to proceed with Task 2 (Simple Smells)

## [2026-02-19T12:31:00+00:00] Task 1: Fetch Mock Fix - Minimal Scope

### Changes Made
1. **setupTests.ts**: Added fetch global mock (14 lines)
   - Replaces removed setupCommonMocks() call
   - Ensures no real network calls in tests
   - Returns `{ status: 200 }` response for all endpoints

2. **SmokeTest.test.tsx**: Restored fetch mock verification test (7 lines)
   - Now tests mocked fetch, not real network
   - Verifies mock is wired correctly in setupTests
   - Deterministic: no external dependencies

### Why This Scope
- Minimal changes to fix exact issue
- No modifications to unrelated components
- Preserved existing test structure and intent
- Did NOT modify handlers.ts (factory functions retained for future use)
- Did NOT modify plan file (read-only)

### Files Touched
- ✏️ src/setupTests.ts (modified: added fetch mock)
- ✏️ src/components/__tests__/SmokeTest.test.tsx (modified: added fetch mock test back)

### Verification
- ✅ 6/6 smoke tests pass
- ✅ No LSP errors
- ✅ Fetch mock prevents accidental real API calls
- ✅ Ready for Task 2


## [2026-02-19T13:45:00+00:00] Task 2: Simple Smells Cleanup - Execution

### Scope Clarification (Plan vs Code)
Plan specified removal of unused items, but manual inspection revealed:
- **AuditLogView.tsx**: No unused imports to remove (CardHeader, CardTitle, Calendar not imported there)
- **ReportsView.tsx**: Error handling already safe (line 73 has proper stringification)
- **StudentDashboard.tsx**: Only `jadwalData` memoized hook was truly unused

### Decision: Conservative Removal
Removed **only** the verified unused item:
- `src/components/StudentDashboard.tsx` lines 726-730: Unused memoized `jadwalData` useMemo hook

### Why Not Remove setSiswaId, setKelasInfo?
1. **setSiswaId** is referenced 30+ times throughout the file in useEffect/callback dependencies
2. **setKelasInfo** is used at line 1665 (passed to child component)
3. Both are actively used, despite plan specification

### Why Remove jadwalData?
1. Declared at lines 727-730 as memoized value
2. Never referenced anywhere in the component
3. Local scope variables with same name used instead (lines 1171, 1380)
4. Safe removal with zero side effects

### Files Touched
- ✏️ src/components/StudentDashboard.tsx (1 edit: removed unused useMemo)

### Verification
```bash
npx eslint src/components/admin/AuditLogView.tsx \
           src/components/admin/reports/ReportsView.tsx \
           src/components/StudentDashboard.tsx
# Result: ✅ No errors, no warnings
```

### Quality Gates Passed
- ✅ ESLint verification: 0 issues
- ✅ No TypeScript errors
- ✅ No functional regressions (removed code was unused)
- ✅ Scope remained tight to 3 target files


## [2026-02-19T13:02:00+00:00] Task 3: StudentDashboard Refactor - Verification

### Decision: Verify Previously Completed Work
Task 3 (extract Attendance Summary and Recent History UI sections into subcomponents) was already fully implemented in a prior session. This session verified correctness rather than re-implementing.

### What Was Done (Prior Session)
- Removed ~616 lines of duplicate local definitions from `StudentDashboard.tsx` (1736 → 1120 lines)
- 19 local component/type/utility definitions that shadowed already-imported extracted modules were deleted
- `renderInitialLoadingState()` / `renderErrorState()` replaced with `<InitialLoadingState />` / `<ErrorState />` JSX
- Unused imports cleaned up after duplicate removal

### Why No Edits This Session
- File was already in the correct state
- All extracted modules in `src/components/student/` were already wired correctly
- Imports on lines 12-21 already resolve to the right modules

### Constraints Maintained
- ✅ All state ownership remains in `StudentDashboard` (no moved hooks)
- ✅ Behavior equivalent — presentational extraction only
- ✅ Side-effect order unchanged
- ✅ Absolute imports (`@/`) used in extracted files
- ✅ No modifications to `.sisyphus/plans/sonar-cleanup.md`
- ✅ No modifications to `src/components/ui/*`
- ✅ No new dependencies added

### Verification
- ✅ LSP diagnostics: 0 errors
- ✅ `npm run build`: Success
- ✅ `npx vitest run`: 10/10 tests pass
- ✅ File size: 1120 lines (target was ~1100, achieved)


## [2026-02-19] Task 4: SimpleRestoreView.tsx - Decisions

### Decision: No A11y changes needed
- `role="button"` was not present in the file. The interactive drop zone was already a `<button type="button">`. Confirmed safe — no structural changes needed.

### Decision: Add toast to XHR inner catch blocks
- Added `toast({ variant: "destructive", ... })` to the 3 inner XHR catch blocks (parse-on-success, parse-on-failure, outer XHR setup error) and the `xhr.addEventListener('error')` handler.
- Kept `setError(...)` state calls intact so inline Alert component still shows.
- Dual feedback: both inline Alert + toast for visibility on all failure paths.

### Decision: Fix `backup.id!` via extracted local variable
- Introduced `const backupId = backup?.id ?? ''` per map iteration.
- Replaced all three `backup.id!` usages with `backupId`.
- This removes SonarQube S2637 (unnecessary assertion) without changing runtime behavior — empty string is a valid falsy guard for `has()` and `toggleSelectId`.

### Decision: Leave `downloadSingleBackup` catch unchanged
- Plan rule: "Use toast.error EXCEPT where intentionally suppressed."
- Comment `// Individual download failure is non-critical` marks this as intentional.

## Decision: Semantic Button Wrapper for Table Cell Interaction

**Context**: SonarQube flagged non-semantic `role="button"` on `<td>` elements in ScheduleGridEditor grid.

**Solution Chosen**: Inner `<button type="button">` wrapper approach
- **Rationale**: Semantically correct, preserves table structure, maintains keyboard interaction
- **Why not**: Re-render as list/div grid (would break existing drag-drop integration)
- **Trade-offs**: Adds one wrapper div, but no performance impact (already inside DroppableCell)

**Accessibility Win**:
- ✅ Native button semantics (Enter/Space work automatically)
- ✅ Screen readers announce as "button" not generic "cell"
- ✅ Focus ring visible + styled consistently
- ✅ Drag-drop still works (internal to button)

**Code Quality**:
- ✅ ESLint clean
- ✅ No breaking changes to data flow
- ✅ Visual styling preserved
- ✅ One-file change (atomic)


## [2026-02-19] Task 5: ScheduleGridTable.tsx - Complexity Reduction Decisions

### Decision: Pure function helpers over useCallback hooks
- buildScheduleCellFromEdit, createEmptyCell, updateClassScheduleCell, deleteClassScheduleCell, upsertPendingChange, getCellBackgroundColor are all pure functions defined outside the component.
- Rationale: They have no dependency on component state — they receive all data as parameters. This avoids unnecessary re-renders and keeps the helpers testable in isolation.

### Decision: Extract sub-components for grid cell variants
- SpecialEventCell and NormalScheduleCell are small function components defined in the same file.
- Rationale: Reduces JSX nesting depth from 4→2 levels. Each cell type has distinct structure (rowSpan vs droppable). Extracting makes the grid loop readable.
- Did NOT extract to separate files to keep atomic single-file scope per task requirements.

### Decision: DragOverlayContent component
- Extracted the DragOverlay inline JSX (22 LOC) into a DragOverlayContent component.
- This eliminates duplicated teacher/subject display logic that already existed in DraggableItem.

### Decision: Preserve existing handleDragEnd useCallback dependencies
- Kept the same dependency array for handleDragEnd callback.
- The new helpers (upsertPendingChange, updateClassScheduleCell) are pure functions outside the component, so they don't need to be in dependency arrays.

### Scope
- Only ScheduleGridTable.tsx modified (atomic task scope)
- No API payload changes, no new dependencies, no UI modifications
- All DnD behavior preserved (DroppableCell, useDraggable, DndContext)

## [2026-02-19T13:25:04] Task 6: PreviewJadwalView.tsx - Complexity Refactor Decisions

### Decision: Extract render branches into helper components in the same file
- Added `ScheduleEmptyState`, `ScheduleMatrixView`, and `ScheduleGridView` above `PreviewJadwalView`.
- Kept extraction in-file (no new modules) to satisfy atomic single-file refactor scope.
- Main component now delegates schedule-body rendering through `renderScheduleContent()`.

### Decision: Keep data/behavior logic unchanged
- Filtering, sorting, export, print, and preview handlers were left intact.
- Matrix and grid JSX content was moved as-is into helpers (same classes, same labels, same conditional rendering).
- Multi-guru rendering behavior remains unchanged in both matrix and grid views.

### Decision: Resolve redundant nested template literal path
- Replaced inline nested template literal in empty-state message with `getEmptyScheduleMessage(...)` + precomputed labels.
- Text output remains equivalent for all combinations of `filter.kelas` and `filter.hari`.

### Verification
- ✅ LSP diagnostics clean for `src/components/admin/schedules/PreviewJadwalView.tsx`
- ✅ `npx eslint src/components/admin/schedules/PreviewJadwalView.tsx`
- ✅ `npm run build`
