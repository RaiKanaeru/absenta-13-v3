/**
 * Centralized Database Configuration
 * Replaces globalThis.dbPool for more reliable dependency management
 */
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DB');

let pool = null;

export const setPool = (newPool) => {
    pool = newPool;
    logger.info('Database pool registered in centralized config');
};

export const getPool = () => {
    if (!pool) {
        const err = new Error('Database pool not initialized. Check server startup sequence.');
        logger.error('Accessing uninitialized DB pool', err);
        throw err;
    }
    return pool;
};

// Default export acts as a direct proxy to the underlying pool
// This allows drop-in replacement for `globalThis.dbPool` usage
const db = {
    execute: async (...args) => {
        const pool = getPool();
        if (!pool) throw new Error('DB_POOL_NOT_READY: Database connection pool is not initialized.');
        return pool.execute(...args);
    },
    query: async (...args) => getPool().query(...args),
    getConnection: async () => getPool().getConnection(),
    end: async () => getPool().end(),
    // Forward other potential methods/properties if needed
    get pool() { return getPool(); }
};

export default db;
