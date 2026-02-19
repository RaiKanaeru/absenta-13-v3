
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
