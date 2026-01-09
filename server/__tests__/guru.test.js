/**
 * Guru Validation Tests
 * 
 * Tests for teacher-related validation logic.
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

// ============================================================
// MOCK: Guru Validation Functions
// ============================================================

/**
 * Validate NIP format (10-20 digits)
 */
function validateNIP(nip) {
    if (!nip || typeof nip !== 'string') {
        return { valid: false, error: 'NIP wajib diisi' };
    }
    if (!/^\\d{10,20}$/.test(nip)) {
        return { valid: false, error: 'NIP harus berupa angka 10-20 digit' };
    }
    return { valid: true };
}

/**
 * Validate guru nama (min 2 chars)
 */
function validateNama(nama) {
    if (!nama || typeof nama !== 'string' || nama.trim().length < 2) {
        return { valid: false, error: 'Nama lengkap wajib diisi minimal 2 karakter' };
    }
    return { valid: true };
}

/**
 * Validate guru username format
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
 * Validate teacher status
 */
function validateStatus(status) {
    if (status === undefined || status === null || status === '') {
        return { valid: true }; // Optional, defaults to 'aktif'
    }
    if (!['aktif', 'nonaktif'].includes(status)) {
        return { valid: false, error: 'Status harus aktif atau nonaktif' };
    }
    return { valid: true };
}

/**
 * Validate teacher attendance status
 */
function validateTeacherAttendanceStatus(status) {
    const validStatuses = ['Hadir', 'Tidak Hadir', 'Izin', 'Sakit'];
    if (!validStatuses.includes(status)) {
        return { valid: false, error: `Status tidak valid. Harus: ${validStatuses.join(', ')}` };
    }
    return { valid: true };
}

// ============================================================
// TESTS
// ============================================================

describe('NIP Validation', () => {
    it('should accept valid 18-digit NIP', () => {
        const result = validateNIP('199001012020121001');
        assert.strictEqual(result.valid, true);
    });

    it('should accept valid 10-digit NIP', () => {
        const result = validateNIP('1990010120');
        assert.strictEqual(result.valid, true);
    });

    it('should reject NIP with less than 10 digits', () => {
        const result = validateNIP('123456789');
        assert.strictEqual(result.valid, false);
    });

    it('should reject NIP with more than 20 digits', () => {
        const result = validateNIP('123456789012345678901');
        assert.strictEqual(result.valid, false);
    });

    it('should reject NIP with non-numeric characters', () => {
        const result = validateNIP('19900101ABC');
        assert.strictEqual(result.valid, false);
    });

    it('should reject empty NIP', () => {
        const result = validateNIP('');
        assert.strictEqual(result.valid, false);
    });
});

describe('Guru Nama Validation', () => {
    it('should accept valid name', () => {
        const result = validateNama('Ahmad Syarif');
        assert.strictEqual(result.valid, true);
    });

    it('should accept 2-char name', () => {
        const result = validateNama('AB');
        assert.strictEqual(result.valid, true);
    });

    it('should reject 1-char name', () => {
        const result = validateNama('A');
        assert.strictEqual(result.valid, false);
    });

    it('should reject empty name', () => {
        const result = validateNama('');
        assert.strictEqual(result.valid, false);
    });

    it('should reject whitespace-only name', () => {
        const result = validateNama('   ');
        assert.strictEqual(result.valid, false);
    });
});

describe('Guru Username Validation', () => {
    it('should accept valid lowercase username', () => {
        const result = validateUsername('guru.ahmad');
        assert.strictEqual(result.valid, true);
    });

    it('should accept username with numbers', () => {
        const result = validateUsername('guru123');
        assert.strictEqual(result.valid, true);
    });

    it('should reject username shorter than 4 chars', () => {
        const result = validateUsername('abc');
        assert.strictEqual(result.valid, false);
    });

    it('should reject username with uppercase', () => {
        const result = validateUsername('GuruAhmad');
        assert.strictEqual(result.valid, false);
    });

    it('should reject username with spaces', () => {
        const result = validateUsername('guru ahmad');
        assert.strictEqual(result.valid, false);
    });
});

describe('Guru Status Validation', () => {
    it('should accept aktif', () => {
        const result = validateStatus('aktif');
        assert.strictEqual(result.valid, true);
    });

    it('should accept nonaktif', () => {
        const result = validateStatus('nonaktif');
        assert.strictEqual(result.valid, true);
    });

    it('should accept empty (optional)', () => {
        assert.strictEqual(validateStatus('').valid, true);
        assert.strictEqual(validateStatus(null).valid, true);
    });

    it('should reject invalid status', () => {
        assert.strictEqual(validateStatus('active').valid, false);
        assert.strictEqual(validateStatus('AKTIF').valid, false);
    });
});

describe('Teacher Attendance Status', () => {
    it('should accept Hadir', () => {
        assert.strictEqual(validateTeacherAttendanceStatus('Hadir').valid, true);
    });

    it('should accept Tidak Hadir', () => {
        assert.strictEqual(validateTeacherAttendanceStatus('Tidak Hadir').valid, true);
    });

    it('should accept Izin', () => {
        assert.strictEqual(validateTeacherAttendanceStatus('Izin').valid, true);
    });

    it('should accept Sakit', () => {
        assert.strictEqual(validateTeacherAttendanceStatus('Sakit').valid, true);
    });

    it('should reject invalid status', () => {
        assert.strictEqual(validateTeacherAttendanceStatus('Alpha').valid, false);
        assert.strictEqual(validateTeacherAttendanceStatus('hadir').valid, false);
    });
});

console.log('Run tests with: npm test');
