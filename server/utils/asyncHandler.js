/**
 * Async Handler Wrapper for Express Routes
 * 
 * Wraps async route handlers to automatically catch promise rejections
 * and pass them to Express error middleware.
 * 
 * Usage:
 * ```javascript
 * import { asyncHandler } from '../utils/asyncHandler.js';
 * 
 * router.get('/route', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json(data);
 * }));
 * ```
 * 
 * Benefits:
 * - Eliminates repetitive try-catch blocks in route handlers
 * - Ensures all async errors are caught and passed to global error middleware
 * - Cleaner, more readable route definitions
 */

/**
 * Wraps an async function to catch errors and pass them to next()
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Higher-order function for async middleware
 * Similar to asyncHandler but explicitly for middleware patterns
 * @param {Function} fn - Async middleware function
 * @returns {Function} Express middleware function
 */
export const asyncMiddleware = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
