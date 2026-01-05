/**
 * Auth Login Tests
 * 
 * Tests for authentication login logic.
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

// ============================================================
// MOCK: Auth Functions
// ============================================================

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Check if IP is locked out
 */
function checkLoginAttempts(attempts, now = Date.now()) {
    if (!attempts) {
        return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };
    }
    
    // Check lockout
    if (attempts.lockedUntil && now < attempts.lockedUntil) {
        const remainingMs = attempts.lockedUntil - now;
        return {
            allowed: false,
            locked: true,
            remainingMs,
            message: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(remainingMs / 60000)} menit`
        };
    }
    
    // Reset if lockout expired
    if (attempts.lockedUntil && now >= attempts.lockedUntil) {
        return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };
    }
    
    return { 
        allowed: true, 
        remaining: MAX_LOGIN_ATTEMPTS - attempts.count 
    };
}

/**
 * Record failed attempt
 */
function recordFailedAttempt(attempts, now = Date.now()) {
    if (!attempts) {
        return { count: 1, lastAttempt: now };
    }
    
    const newCount = attempts.count + 1;
    
    if (newCount >= MAX_LOGIN_ATTEMPTS) {
        return {
            count: newCount,
            lastAttempt: now,
            lockedUntil: now + LOCKOUT_DURATION
        };
    }
    
    return {
        count: newCount,
        lastAttempt: now
    };
}

/**
 * Validate login credentials format
 */
function validateLoginInput(username, password) {
    const errors = [];
    
    if (!username || typeof username !== 'string' || username.trim() === '') {
        errors.push('Username wajib diisi');
    }
    
    if (!password || typeof password !== 'string' || password.trim() === '') {
        errors.push('Password wajib diisi');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate JWT token format (basic check)
 */
function validateTokenFormat(token) {
    if (!token || typeof token !== 'string') {
        return { valid: false, error: 'Token tidak ada' };
    }
    
    // JWT has 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
        return { valid: false, error: 'Format token tidak valid' };
    }
    
    return { valid: true };
}

// ============================================================
// TESTS
// ============================================================

describe('Login Attempts - Lockout Logic', () => {
    it('should allow first attempt', () => {
        const result = checkLoginAttempts(null);
        assert.strictEqual(result.allowed, true);
        assert.strictEqual(result.remaining, 5);
    });

    it('should track remaining attempts', () => {
        const attempts = { count: 3, lastAttempt: Date.now() };
        const result = checkLoginAttempts(attempts);
        assert.strictEqual(result.allowed, true);
        assert.strictEqual(result.remaining, 2);
    });

    it('should lock after max attempts', () => {
        const now = Date.now();
        const attempts = { 
            count: 5, 
            lastAttempt: now,
            lockedUntil: now + LOCKOUT_DURATION 
        };
        const result = checkLoginAttempts(attempts, now);
        assert.strictEqual(result.allowed, false);
        assert.strictEqual(result.locked, true);
    });

    it('should unlock after lockout expires', () => {
        const past = Date.now() - LOCKOUT_DURATION - 1000;
        const attempts = { 
            count: 5, 
            lastAttempt: past,
            lockedUntil: past + LOCKOUT_DURATION 
        };
        const result = checkLoginAttempts(attempts, Date.now());
        assert.strictEqual(result.allowed, true);
    });
});

describe('Record Failed Attempt', () => {
    it('should create new attempt record', () => {
        const result = recordFailedAttempt(null);
        assert.strictEqual(result.count, 1);
        assert.ok(result.lastAttempt);
    });

    it('should increment count', () => {
        const attempts = { count: 2, lastAttempt: Date.now() - 1000 };
        const result = recordFailedAttempt(attempts);
        assert.strictEqual(result.count, 3);
    });

    it('should set lockout at max attempts', () => {
        const attempts = { count: 4, lastAttempt: Date.now() - 1000 };
        const result = recordFailedAttempt(attempts);
        assert.strictEqual(result.count, 5);
        assert.ok(result.lockedUntil);
    });
});

describe('Login Input Validation', () => {
    it('should accept valid credentials', () => {
        const result = validateLoginInput('admin', 'password123');
        assert.strictEqual(result.valid, true);
    });

    it('should reject empty username', () => {
        const result = validateLoginInput('', 'password123');
        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.includes('Username wajib diisi'));
    });

    it('should reject empty password', () => {
        const result = validateLoginInput('admin', '');
        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.includes('Password wajib diisi'));
    });

    it('should reject both empty', () => {
        const result = validateLoginInput('', '');
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.errors.length, 2);
    });
});

describe('JWT Token Format Validation', () => {
    it('should accept valid JWT format', () => {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
        const result = validateTokenFormat(token);
        assert.strictEqual(result.valid, true);
    });

    it('should reject token with wrong parts', () => {
        const result = validateTokenFormat('invalid.token');
        assert.strictEqual(result.valid, false);
    });

    it('should reject empty token', () => {
        const result = validateTokenFormat('');
        assert.strictEqual(result.valid, false);
    });

    it('should reject null token', () => {
        const result = validateTokenFormat(null);
        assert.strictEqual(result.valid, false);
    });
});

console.log('Run tests with: npm test');
