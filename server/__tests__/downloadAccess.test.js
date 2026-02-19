/**
 * Download Access Tests
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
    buildDownloadFilename,
    extractUserIdFromFilename,
    isFilenameOwnedByUser,
    isSafeFilename
} from '../utils/downloadAccess.js';

describe('Download Access Utilities', () => {
    it('should build filename with user id', () => {
        const filename = buildDownloadFilename({
            prefix: 'absensi_siswa',
            userId: 42,
            parts: ['2025-01-01', '2025-01-31'],
            timestamp: '2025-01-01T00-00-00-000Z'
        });

        assert.ok(filename.includes('absensi_siswa_u42_2025-01-01_2025-01-31_'));
        assert.ok(filename.endsWith('.xlsx'));
    });

    it('should extract user id from filename', () => {
        const filename = 'absensi_guru_u7_2025-01-01_2025-01-31_2025-01-01T00-00-00-000Z.xlsx';
        assert.strictEqual(extractUserIdFromFilename(filename), 7);
    });

    it('should verify ownership by user id', () => {
        const filename = 'analytics_report_u9_semester_ganjil_2025_2025-01-01T00-00-00-000Z.xlsx';
        assert.strictEqual(isFilenameOwnedByUser(filename, 9), true);
        assert.strictEqual(isFilenameOwnedByUser(filename, 10), false);
    });

    it('should reject unsafe filenames', () => {
        assert.strictEqual(isSafeFilename('../secret.txt'), false);
        assert.strictEqual(isSafeFilename(String.raw`..\secret.txt`), false);
        assert.strictEqual(isSafeFilename('reports/abc.xlsx'), false);
        assert.strictEqual(isSafeFilename('%2e%2e%2fsecret.xlsx'), false);
        assert.strictEqual(isSafeFilename('..%5csecret.xlsx'), false);
        assert.strictEqual(isSafeFilename('report_u1_test.csv'), false);
    });

    it('should allow xlsx extension only', () => {
        assert.strictEqual(isSafeFilename('report_u1_test.xlsx'), true);
        assert.strictEqual(isSafeFilename('report_u1_test.XLSX'), true);
    });
});
