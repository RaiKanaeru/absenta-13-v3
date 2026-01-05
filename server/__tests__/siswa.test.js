/**
 * Siswa Validation Tests
 * 
 * Tests for student-related validation logic.
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

// ============================================================
// MOCK: Siswa Validation Functions
// ============================================================

/**
 * Validate NIS format (8-15 digits)
 */
function validateNIS(nis) {
    if (!nis || typeof nis !== 'string') {
        return { valid: false, error: 'NIS wajib diisi' };
    }
    if (!/^\d{8,15}$/.test(nis)) {
        return { valid: false, error: 'NIS harus berupa angka 8-15 digit' };
    }
    return { valid: true };
}

/**
 * Validate username format
 */
function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Username wajib diisi' };
    }
    if (!/^[a-z0-9._-]{4,30}$/.test(username)) {
        return { 
            valid: false, 
            error: 'Username harus 4-30 karakter, hanya huruf kecil, angka, titik, underscore, dan strip' 
        };
    }
    return { valid: true };
}

/**
 * Validate email format (optional field)
 */
function validateEmail(email) {
    if (email === undefined || email === null || email === '') {
        return { valid: true }; // Optional field
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { valid: false, error: 'Format email tidak valid' };
    }
    return { valid: true };
}

/**
 * Validate password (min 6 chars)
 */
function validatePassword(password, isUpdate = false) {
    if (!isUpdate && (!password || typeof password !== 'string' || password.length < 6)) {
        return { valid: false, error: 'Password wajib diisi minimal 6 karakter' };
    }
    if (isUpdate && password !== undefined && password !== null && password !== '' && 
        (typeof password !== 'string' || password.length < 6)) {
        return { valid: false, error: 'Password minimal 6 karakter' };
    }
    return { valid: true };
}

/**
 * Validate jenis kelamin
 */
function validateJenisKelamin(jk) {
    if (jk === undefined || jk === null || jk === '') {
        return { valid: true }; // Optional
    }
    if (!['L', 'P'].includes(jk)) {
        return { valid: false, error: 'Jenis kelamin harus L atau P' };
    }
    return { valid: true };
}

// ============================================================
// TESTS
// ============================================================

describe('NIS Validation', () => {
    it('should accept valid 10-digit NIS', () => {
        const result = validateNIS('1234567890');
        assert.strictEqual(result.valid, true);
    });

    it('should accept valid 8-digit NIS', () => {
        const result = validateNIS('12345678');
        assert.strictEqual(result.valid, true);
    });

    it('should accept valid 15-digit NIS', () => {
        const result = validateNIS('123456789012345');
        assert.strictEqual(result.valid, true);
    });

    it('should reject NIS with less than 8 digits', () => {
        const result = validateNIS('1234567');
        assert.strictEqual(result.valid, false);
    });

    it('should reject NIS with more than 15 digits', () => {
        const result = validateNIS('1234567890123456');
        assert.strictEqual(result.valid, false);
    });

    it('should reject NIS with non-numeric characters', () => {
        const result = validateNIS('12345abc');
        assert.strictEqual(result.valid, false);
    });

    it('should reject empty NIS', () => {
        const result = validateNIS('');
        assert.strictEqual(result.valid, false);
    });
});

describe('Username Validation', () => {
    it('should accept valid lowercase username', () => {
        const result = validateUsername('john.doe');
        assert.strictEqual(result.valid, true);
    });

    it('should accept username with underscore', () => {
        const result = validateUsername('john_doe_123');
        assert.strictEqual(result.valid, true);
    });

    it('should reject username shorter than 4 chars', () => {
        const result = validateUsername('abc');
        assert.strictEqual(result.valid, false);
    });

    it('should reject username with uppercase', () => {
        const result = validateUsername('JohnDoe');
        assert.strictEqual(result.valid, false);
    });

    it('should reject username with spaces', () => {
        const result = validateUsername('john doe');
        assert.strictEqual(result.valid, false);
    });
});

describe('Email Validation', () => {
    it('should accept valid email', () => {
        const result = validateEmail('test@example.com');
        assert.strictEqual(result.valid, true);
    });

    it('should accept empty email (optional)', () => {
        assert.strictEqual(validateEmail('').valid, true);
        assert.strictEqual(validateEmail(null).valid, true);
        assert.strictEqual(validateEmail(undefined).valid, true);
    });

    it('should reject invalid email format', () => {
        assert.strictEqual(validateEmail('notanemail').valid, false);
        assert.strictEqual(validateEmail('missing@domain').valid, false);
    });
});

describe('Password Validation', () => {
    it('should accept password with 6+ chars on create', () => {
        const result = validatePassword('password123', false);
        assert.strictEqual(result.valid, true);
    });

    it('should reject short password on create', () => {
        const result = validatePassword('12345', false);
        assert.strictEqual(result.valid, false);
    });

    it('should allow empty password on update', () => {
        const result = validatePassword('', true);
        assert.strictEqual(result.valid, true);
    });

    it('should reject short password on update if provided', () => {
        const result = validatePassword('abc', true);
        assert.strictEqual(result.valid, false);
    });
});

describe('Jenis Kelamin Validation', () => {
    it('should accept L', () => {
        assert.strictEqual(validateJenisKelamin('L').valid, true);
    });

    it('should accept P', () => {
        assert.strictEqual(validateJenisKelamin('P').valid, true);
    });

    it('should accept empty (optional)', () => {
        assert.strictEqual(validateJenisKelamin('').valid, true);
        assert.strictEqual(validateJenisKelamin(null).valid, true);
    });

    it('should reject invalid value', () => {
        assert.strictEqual(validateJenisKelamin('M').valid, false);
        assert.strictEqual(validateJenisKelamin('laki').valid, false);
    });
});

console.log('Run tests with: npm test');
