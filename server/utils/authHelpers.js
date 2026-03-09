import { createLogger } from './logger.js';

const logger = createLogger('AuthHelpers');

/**
 * Invalidates all active sessions for a specific user.
 * 
 * This function:
 * 1. Sets a 'valid_after' timestamp in Redis to invalidate current access tokens.
 * 2. Deletes all refresh tokens associated with the user from Redis.
 * 
 * Gracefully degrades if Redis is disconnected.
 * 
 * @param {string|number} userId - The ID of the user whose sessions should be invalidated.
 * @returns {Promise<boolean>} - Returns true if invalidation was attempted (even if skipped due to Redis being down).
 */
export const invalidateUserSessions = async (userId) => {
  try {
    const cache = globalThis.cacheSystem;
    
    // Check if cache system is available and connected
    if (!cache?.isConnected || !cache?.redis) {
      logger.warn(`Skipping session invalidation for user ${userId}: Cache system disconnected`);
      return true; // Fail-open graceful degradation
    }

    const redis = cache.redis;
    const now = Math.floor(Date.now() / 1000);
    const validAfterKey = `user_token_valid_after:${userId}`;
    const refreshTokensSetKey = `user_refresh_tokens:${userId}`;

    // 1. Set the valid_after timestamp (valid for 30 days)
    await redis.set(validAfterKey, now, 'EX', 30 * 24 * 60 * 60);

    // 2. Fetch all refresh token hashes for this user
    const tokenHashes = await redis.smembers(refreshTokensSetKey);

    if (tokenHashes && tokenHashes.length > 0) {
      const pipeline = redis.pipeline();
      
      // Delete each individual refresh token key
      tokenHashes.forEach(hash => {
        pipeline.del(`rt:${hash}`);
      });
      
      // Delete the set containing the hashes
      pipeline.del(refreshTokensSetKey);
      
      await pipeline.exec();
    }

    logger.info(`Successfully invalidated all sessions for user ${userId}`);
    return true;
  } catch (error) {
    logger.error(`Error invalidating sessions for user ${userId}:`, error);
    return true; // Fail-open: don't crash the request if invalidation fails
  }
};
