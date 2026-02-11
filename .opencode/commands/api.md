---
description: Create a new API endpoint
---

Create a new API endpoint for `$ARGUMENTS`:

1. Create route in `server/routes/`
2. Create controller in `server/controllers/`
3. Follow project conventions:
   - Use ESM imports
   - Add JSDoc documentation
   - Use `globalThis.dbPool` for database
   - Use parameterized queries
   - Use error handlers from `../utils/errorHandler.js`
   - Use `createLogger` for logging
4. Register route in main router
