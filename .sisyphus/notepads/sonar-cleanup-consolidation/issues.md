
## T1 Issues — 2026-02-19

### qwen-code-repo contamination
- `qwen-code-repo/` is an unrelated project directory inside the repo.
- `npm run lint` (`eslint .`) scans it and reports 41 problems (17 errors, 24 warnings), ALL from `qwen-code-repo/` files. Zero lint errors from actual Absenta source code.
- Previous handoff noted vitest also scanned it, but current run shows vitest's `configDefaults.exclude` filters it out — only 2 Absenta test files ran (10 tests, all passed).
- ESLint flat config does NOT exclude `qwen-code-repo/` — this inflates lint baselines.
- **Impact**: Lint baseline shows EXIT_CODE=1 due to qwen-code-repo errors, NOT Absenta errors.
- **Recommendation**: Add `qwen-code-repo/` to eslint ignores (out of scope for T1, document only).
