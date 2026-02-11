---
description: Review code changes for quality and security
---

Review the current uncommitted changes (or the file specified in $ARGUMENTS):

1. Run `git diff` to see all changes
2. Analyze for:
   - Security issues (SQL injection, XSS, hardcoded secrets)
   - Performance concerns
   - Code style violations per AGENTS.md
   - Missing error handling
   - TypeScript type issues
3. Provide a summary of findings with severity levels
4. Suggest specific fixes if issues found

Do NOT modify any files during review.
