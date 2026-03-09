import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { invalidateUserSessions } from '../utils/authHelpers.js';

describe('Auth Helpers - invalidateUserSessions', () => {
    let mockRedis;

    beforeEach(() => {
        // Reset mocks
        mockRedis = {
            set: mock.fn(),
            smembers: mock.fn(),
            pipeline: mock.fn(() => ({
                del: mock.fn(),
                exec: mock.fn()
            }))
        };

        // Setup global cache system
        globalThis.cacheSystem = {
            isConnected: true,
            redis: mockRedis
        };
    });

    it('should set valid_after and clear tokens when connected', async () => {
        mockRedis.smembers.mock.mockImplementationOnce(() => ['hash1', 'hash2']);
        
        const result = await invalidateUserSessions(123);
        
        assert.equal(result, true);
        assert.equal(mockRedis.set.mock.calls.length, 1);
        assert.equal(mockRedis.set.mock.calls[0].arguments[0], 'user_token_valid_after:123');
        assert.equal(mockRedis.smembers.mock.calls.length, 1);
        assert.equal(mockRedis.pipeline.mock.calls.length, 1);
    });

    it('should fail-open if redis is disconnected', async () => {
        globalThis.cacheSystem.isConnected = false;
        
        const result = await invalidateUserSessions(123);
        
        assert.equal(result, true);
        assert.equal(mockRedis.set.mock.calls.length, 0);
    });

    it('should fail-open if redis throws an error', async () => {
        mockRedis.set.mock.mockImplementationOnce(() => { throw new Error('Redis down'); });
        
        const result = await invalidateUserSessions(123);
        
        assert.equal(result, true);
    });
});
