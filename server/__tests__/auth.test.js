/**
 * Auth Controller Tests
 * 
 * Basic test setup for authentication module.
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';

// Mock rate limiting logic (extracted from authController for testing)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkLoginAttempts(ip) {
    const attempts = loginAttempts.get(ip);
    if (!attempts) return { allowed: true, count: 0 };
    
    if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
        loginAttempts.delete(ip);
        return { allowed: true, count: 0 };
    }
    
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
        const remainingMs = attempts.lockedUntil - Date.now();
        return { 
            allowed: false, 
            count: attempts.count,
            remainingTime: Math.ceil(remainingMs / 1000),
            remainingMinutes: Math.ceil(remainingMs / 60000)
        };
    }
    
    return { allowed: true, count: attempts.count };
}

function recordFailedAttempt(ip) {
    const attempts = loginAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
        attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
    }
    
    loginAttempts.set(ip, attempts);
    return attempts;
}

function resetLoginAttempts(ip) {
    loginAttempts.delete(ip);
}

// ============================================================
// TESTS
// ============================================================

describe('Rate Limiting', () => {
    beforeEach(() => {
        loginAttempts.clear();
    });

    afterEach(() => {
        loginAttempts.clear();
    });

    it('should allow first login attempt', () => {
        const result = checkLoginAttempts('192.168.1.1');
        assert.strictEqual(result.allowed, true);
        assert.strictEqual(result.count, 0);
    });

    it('should track failed attempts', () => {
        const ip = '192.168.1.2';
        recordFailedAttempt(ip);
        recordFailedAttempt(ip);
        
        const result = checkLoginAttempts(ip);
        assert.strictEqual(result.allowed, true);
        assert.strictEqual(result.count, 2);
    });

    it('should lock after max attempts', () => {
        const ip = '192.168.1.3';
        
        for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
            recordFailedAttempt(ip);
        }
        
        const result = checkLoginAttempts(ip);
        assert.strictEqual(result.allowed, false);
        assert.strictEqual(result.count, MAX_LOGIN_ATTEMPTS);
    });

    it('should reset attempts on success', () => {
        const ip = '192.168.1.4';
        recordFailedAttempt(ip);
        recordFailedAttempt(ip);
        
        resetLoginAttempts(ip);
        
        const result = checkLoginAttempts(ip);
        assert.strictEqual(result.allowed, true);
        assert.strictEqual(result.count, 0);
    });
});

describe('Time Validation', () => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    function validateTimeFormat(timeString) {
        if (!timeString || typeof timeString !== 'string') return false;
        return timeRegex.test(timeString.trim());
    }

    it('should validate correct time formats', () => {
        assert.strictEqual(validateTimeFormat('07:00'), true);
        assert.strictEqual(validateTimeFormat('23:59'), true);
        assert.strictEqual(validateTimeFormat('00:00'), true);
    });

    it('should reject invalid time formats', () => {
        assert.strictEqual(validateTimeFormat('25:00'), false);
        assert.strictEqual(validateTimeFormat('12:60'), false);
        assert.strictEqual(validateTimeFormat('invalid'), false);
        assert.strictEqual(validateTimeFormat(''), false);
        assert.strictEqual(validateTimeFormat(null), false);
    });
});

console.log('Run tests with: node --test server/__tests__/auth.test.js');
