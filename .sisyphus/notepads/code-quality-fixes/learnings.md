# Learnings — Code Quality Fixes

## 2026-02-19 Session Start
- Plan has 39 tasks across 4 waves + final verification
- Wave 1: 7 quick wins (parallel) — commented code, node: prefix, unused imports, String.raw, shell scripts
- Wave 2: 7 medium effort (parallel) — SQL constants, React props, shell script constants, Python constants
- Wave 3: 7 high effort — cognitive complexity refactoring in seeders/controllers
- Wave 4: 4 database cleanup — migration scripts
- GUARDRAIL: qwen-code-repo is a SEPARATE subproject — skip unless explicitly part of main app
- Only 1 commented code block in main codebase: server/controllers/importMasterScheduleController.js:178-179
