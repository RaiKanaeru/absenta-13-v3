# Draft: Audit Log 500 and Schedule Grid UI Fixes

## Requirements (confirmed)
- User wants continuation immediately ("lanjut") with no delay.
- Fix 500 errors on Audit Log page endpoints:
  - GET /api/admin/audit-logs?page=1&limit=10
  - GET /api/admin/audit-logs/filters
- Fix broken Schedule Grid Editor UI where KELAS and JAM KE columns are visually compressed/truncated.
- Work must be detailed and careful to avoid typos and runtime errors.
- Keep compatibility with existing architecture and coding conventions.

## Technical Decisions
- Keep one unified plan for both issues (backend API + frontend layout) in a single plan file.
- Use self-healing table creation strategy in `auditLogController.js` via `ensureTable()` and run-once flag.
- For grid layout, adjust table header/body minimum widths and sticky offsets together to avoid overlap mismatch.
- Preserve recent accessibility fixes (keyboard support) unless direct regression evidence appears.

## Research Findings
- Root cause of audit 500: `admin_activity_logs` table missing in DB runtime.
- Migration SQL exists at `server/migrations/create_admin_activity_logs.sql` but is not auto-run by initializer.
- Current controller (`auditLogController.js`) queries missing table in two handlers.
- Grid table currently uses narrow min widths (`KELAS min-w-[80px]`, `JAM KE min-w-[50px]`) and hardcoded sticky left offsets (`left-0`, `left-[80px]`), likely causing visible truncation under current data lengths.

## Scope Boundaries
- INCLUDE:
  - Audit Log backend self-healing table creation fix.
  - Schedule Grid Editor column width/sticky alignment fix.
  - Verification strategy (tsc/build/tests + targeted scenario checks).
- EXCLUDE:
  - Broad migration framework redesign.
  - Unrelated admin module refactors.
  - Shadcn core UI component modifications.

## Test Strategy Decision
- Infrastructure exists: YES.
- Automated tests: YES (tests-after for this bugfix scope).
- Agent-Executed QA scenarios: mandatory for both backend/API and frontend/UI flows.

## Metis Review Findings
- Guardrails to add:
  - Keep backend changes scoped to `server/controllers/auditLogController.js`.
  - Preserve API response contracts expected by `src/components/admin/AuditLogView.tsx`.
  - Keep frontend scope limited to width/sticky alignment classes in `src/components/admin/schedules/ScheduleGridTable.tsx`.
- Scope-creep risks to avoid:
  - Building a full migration framework.
  - Refactoring broad DnD/edit/save logic in schedule grid.
  - Touching unrelated audit write-path services.
- Assumptions to validate in plan acceptance criteria:
  - Concurrent first-hit requests should not fail.
  - `details` JSON parsing should not introduce new 500 paths.
  - Grid remains readable at common desktop zoom levels and while horizontally scrolling.

## Open Questions
- No blocking question for plan generation.
- If visual requirements differ from current screenshots, user can annotate during plan review.
