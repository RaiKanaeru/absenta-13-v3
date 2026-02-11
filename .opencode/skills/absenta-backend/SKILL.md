---
name: absenta-backend
description: Backend development skill for Absenta 13 v3. Use this when working on Node.js/Express backend code, API endpoints, database queries, or server-side logic. Triggers on tasks involving server/, controllers, routes, database operations.
license: MIT
metadata:
  author: absenta-team
  version: "1.0.0"
---

# Absenta Backend Development Skill

Guidelines for backend development in Absenta 13 v3 school attendance system.

## When to Apply

Reference these guidelines when:
- Creating or modifying API endpoints in `server/routes/`
- Writing controller logic in `server/controllers/`
- Working with MySQL database via `globalThis.dbPool`
- Implementing authentication or authorization logic
- Writing backend tests

## Critical Rules

### ESM Only
```javascript
// Correct
import express from 'express';
import { createLogger } from '../utils/logger.js';

// Incorrect - NEVER use CommonJS
const express = require('express'); // FORBIDDEN
```

### Database Access
```javascript
// Always use parameterized queries
const [rows] = await globalThis.dbPool.execute(
  'SELECT * FROM users WHERE id = ? AND status = ?',
  [userId, 'active']
);

// NEVER concatenate user input
const query = `SELECT * FROM users WHERE id = ${userId}`; // SQL INJECTION RISK
```

### Error Handling
```javascript
import { 
  sendSuccessResponse, 
  sendValidationError, 
  sendDatabaseError, 
  sendNotFoundError 
} from '../utils/errorHandler.js';

export async function getUser(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return sendValidationError(res, 'User ID is required');
    }
    
    const [rows] = await globalThis.dbPool.execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return sendNotFoundError(res, 'User not found');
    }
    
    return sendSuccessResponse(res, rows[0]);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
}
```

### Logging
```javascript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('UserController');

logger.info('User created', { userId: user.id });
logger.error('Failed to create user', { error: error.message });

// NEVER use console.log in production code
console.log('Debug'); // Use logger instead
```

### JSDoc Documentation
```javascript
/**
 * Get attendance records for a student
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
export async function getStudentAttendance(req, res) {
  // Implementation
}
```

## File Structure

```
server/
├── controllers/     # Business logic
├── routes/          # API route definitions
├── middleware/      # Express middleware
├── utils/           # Helpers (errorHandler.js, logger.js)
└── config/          # Configuration files
```

## Common Patterns

### Route Definition
```javascript
// server/routes/users.js
import express from 'express';
import { getUser, createUser, updateUser } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/:id', authMiddleware, getUser);
router.post('/', authMiddleware, createUser);
router.put('/:id', authMiddleware, updateUser);

export default router;
```

### Pagination
```javascript
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 10;
const offset = (page - 1) * limit;

const [rows] = await globalThis.dbPool.execute(
  'SELECT * FROM students ORDER BY name LIMIT ? OFFSET ?',
  [limit, offset]
);

const [[{ total }]] = await globalThis.dbPool.execute(
  'SELECT COUNT(*) as total FROM students'
);

return sendSuccessResponse(res, {
  data: rows,
  pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
});
```
