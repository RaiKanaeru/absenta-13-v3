---
description: Run TypeScript type checks without emitting build output
---

Run `npx tsc --noEmit`.

If typecheck fails:
- List errors by file.
- Call out the first real root-cause error when cascades happen.
- Suggest minimal fixes aligned with existing patterns.
