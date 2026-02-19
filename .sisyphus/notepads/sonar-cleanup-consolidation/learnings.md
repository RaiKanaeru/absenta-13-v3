
## Task T15 Learnings — 2026-02-19

### EditProfile Refactoring
- **Hook Extraction**: Moving form state, validation, and submission logic to a custom hook (`useEditProfileForm`) is highly effective for reducing component complexity.
- **Component Extraction**: Splitting large JSX blocks into smaller, focused components (`RoleSpecificFieldsTop`, `RoleSpecificFieldsBottom`, `PasswordChangeForm`) improves readability and maintainability.
- **Complexity Reduction**: `EditProfile.tsx` complexity dropped significantly (from 22 to minimal) by delegating logic.
- **Testing**: Mocking the custom hook or its dependencies (apiCall, use-toast) is crucial for unit testing the component in isolation.

### ExcelPreview Refactoring
- **Stable Keys**: Replacing array index keys with unique IDs (or stable content-based keys) prevents rendering issues and satisfies Sonar rules.
- **Helper Extraction**: Extracting complex rendering logic (like `LetterheadSection`) simplifies the main component and makes it easier to test.
- **Nested Ternary Fix**: Extracting logic into a component naturally resolves nested ternary issues by allowing early returns or cleaner `if/else` blocks.

### General React Refactoring Patterns
- **Separation of Concerns**: Logic -> Hook, UI -> Components.
- **File Structure**: `Component.tsx`, `Component.components.tsx`, `hooks/useComponentLogic.ts` is a solid pattern for complex components.
- **Verification**: Always verify with ESLint and Tests after refactoring to ensure no regressions.

## Task T20 Learnings — 2026-02-19 (Final Consolidation)

### Reconciliation Process
- **Pre-resolved findings dominate**: 23 of 56 total findings (41%) were already fixed in prior commits before the Sonar cleanup plan began. Always check baseline state before planning work.
- **False positives exist**: 2 findings (3.5%) were false positives — `error.index` is a data property not an array index, and `testAlert` is a backend export misattributed to frontend.
- **Scope discipline works**: Zero unplanned files modified across 15 commits. Mapping each file change to a task number prevents scope creep.

### Regression Suite
- **Node.js test runner quirk**: `beforeEach` is not available in `describe` scope in Node.js native test runner — must use `test.beforeEach` or restructure. This is a pre-existing issue in attendanceCalculator tests, not a regression.
- **Test count improvement**: Frontend tests grew from 10 → 13 (+30%) with targeted smoke tests for refactored components.
- **Clean gates**: All 4 verification gates (test:server, test:client, tsc --noEmit, lint) pass clean consistently.

### Overall Sonar Cleanup Metrics
- 56 findings addressed across 20 tasks (T1-T20)
- 29 actively fixed, 23 pre-resolved, 2 false-positive, 0 deferred
- Largest single refactor: jadwalController.js (5 tasks, complexity 50→≤15)
- Largest single rewrite: sqlParser.js (complexity 94→~5)
- Net code delta: +16,687 / -2,152 lines (growth from extracted helper/companion files and evidence)
