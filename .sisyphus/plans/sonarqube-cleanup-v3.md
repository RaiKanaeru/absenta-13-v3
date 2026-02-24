# SonarQube Code Smells Cleanup V3

## TL;DR

> **Quick Summary**: Fix remaining SonarQube code smells reported by the user across 10 files.
> **Deliverables**: Updated TypeScript/TSX files.
> **Estimated Effort**: Quick
> **Parallel Execution**: YES - 1 wave

---

## Context

User provided a list of SonarQube code smells to fix:
1. StudentDashboard.tsx - unused/undestructured useState
2. ManageClassesView.tsx - array index as key
3. ManageSchedulesView.tsx - unused import, cognitive complexity, missing exception handling, array index as key, nested ternaries, unnecessary type assertion, nested functions
4. ManageStudentDataView.tsx - unnecessary type assertion, array index as key, nested ternaries
5. ManageStudentsView.tsx - cognitive complexity, array index as key, nested ternaries
6. ManageSubjectsView.tsx - array index as key
7. ManageTeacherAccountsView.tsx - cognitive complexity, array index as key, nested ternaries
8. ManageTeacherDataView.tsx - unnecessary type assertion, array index as key, nested ternaries
9. ui/table.tsx - table accessibility
10. clientExcelExport.ts - object stringification

---

## Verification Strategy
- `npm run build`
- `npx tsc --noEmit`

---

## Execution Strategy

All fixes in a single deep task or multiple quick tasks.

---

## TODOs

- [ ] 1. Fix all Code Smells
  **What to do**: Apply fixes for all listed SonarQube issues in the files.
  **Agent**: `deep`
  **QA**: Build and TSC pass.

---

## Final Verification Wave

- [ ] F1. Build and Lint

## Commit Strategy
`fix: resolve remaining sonarqube code smells`