# Issues - sonar-cleanup
## [2026-02-19T05:20:41+00:00] Task: baseline-issues
- Boulder had duplicate session id entry; deduplicated before execution.
- Existing unrelated LSP errors present in `src/contexts/__tests__/FontSizeContext.test.tsx` (button type prop).

## [2026-02-19T12:31:00+00:00] Task 1: Fetch Mock Network Error - FIXED

### Issue Description
Test "test environment has fetch mock" was attempting real network call to localhost:3001, causing ECONNREFUSED.
- Root cause: `setupTests.ts` was refactored but `setupCommonMocks()` from handlers.ts was removed
- Result: `globalThis.fetch` was not mocked, falling back to real network call
- Impact: Test 4 (fetch mock test) failed intermittently depending on server availability

### Root Cause
- `setupTests.ts` removed imports from `src/test/mocks/handlers.ts`
- Fetch global was not being stubbed with vi.fn()
- Other mocks (AuthContext, config/api, authUtils, toast) were inlined directly

### Fix Applied
1. **Added fetch mock to setupTests.ts** (lines 7-20):
   - Created vi.fn() stub that returns successful Response
   - Applies to all endpoints by default (no routing needed for smoke test)
   - Ensures no real network calls occur

2. **Restored "test environment has fetch mock" test** in SmokeTest.test.tsx:
   - Now calls mocked fetch (returns immediately, no network)
   - Verifies mock is initialized and working
   - Deterministic: no dependency on server being available

### Verification
✅ 6/6 smoke tests pass (was 5, added fetch mock test)
✅ Test runs in 95ms (no network delay)
✅ No LSP diagnostics errors
✅ fetch mock prevents accidental real API calls in subsequent tests

### Pattern: Fetch Mocking
For future tests, this pattern in setupTests prevents network issues:
```typescript
globalThis.fetch = vi.fn(async (url: string, options?: RequestInit) => {
  return new Response(JSON.stringify({...}), { status: 200, headers: {...} });
});
```

