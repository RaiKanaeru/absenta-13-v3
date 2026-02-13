import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import * as jadwalController from '../controllers/jadwalController.js';
import { setPool } from '../config/db.js';

// Mock objects
const req = {
    body: {},
    params: {},
    user: {},
    query: {}
};

const res = {
    json: mock.fn(),
    status: mock.fn(() => res),
    send: mock.fn(),
    setHeader: mock.fn()
};

// Mock Database
const mockDb = {
    execute: mock.fn()
};

describe('Jadwal Controller', () => {
    beforeEach(() => {
        // Reset mocks before each test
        req.body = {};
        req.params = {};
        req.query = {};
        
        // Re-create mocks
        res.json = mock.fn();
        res.status = mock.fn(() => res);
        res.send = mock.fn();
        
        mockDb.execute = mock.fn();
        setPool(mockDb);
    });

    describe('Helper Logic Validation (via createJadwal)', () => {
        it('should reject invalid time format', async () => {
            req.body = {
                kelas_id: 1, mapel_id: 1, hari: 'Senin', jam_ke: 1,
                jam_mulai: '25:00', jam_selesai: '08:00', // Invalid hour
                jenis_aktivitas: 'pelajaran', guru_ids: [1]
            };

            await jadwalController.createJadwal(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
            assert.match(res.json.mock.calls[0].arguments[0].error.message, /Format waktu tidak valid/);
        });

        it('should reject if end time is before start time', async () => {
            req.body = {
                kelas_id: 1, mapel_id: 1, hari: 'Senin', jam_ke: 1,
                jam_mulai: '08:00', jam_selesai: '07:00', // Logic error
                jenis_aktivitas: 'pelajaran', guru_ids: [1]
            };

            await jadwalController.createJadwal(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
            assert.match(res.json.mock.calls[0].arguments[0].error.message, /Jam selesai harus setelah jam mulai/);
        });
    });

    describe('getJadwal', () => {
        it('should return all schedules', async () => {
            const mockRows = [{ id: 1, hari: 'Senin', mapel: 'Matematika' }];
            mockDb.execute.mock.mockImplementation(() => Promise.resolve([mockRows]));

            await jadwalController.getJadwal(req, res);

            assert.strictEqual(mockDb.execute.mock.callCount(), 1);
            assert.strictEqual(res.json.mock.calls[0].arguments[0], mockRows);
        });

        it('should handle database errors', async () => {
            mockDb.execute.mock.mockImplementation(() => Promise.reject(new Error('DB Error')));

            await jadwalController.getJadwal(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
            // Check error object structure from errorHandler
            assert.match(res.json.mock.calls[0].arguments[0].error.message, /Gagal memuat jadwal/);
        });
    });

    describe('createJadwal', () => {
        it('should create valid schedule', async () => {
             req.body = {
                kelas_id: 1, mapel_id: 1, current_guru_id: 1, guru_ids: [1], 
                hari: 'Senin', jam_ke: 1,
                jam_mulai: '07:00', jam_selesai: '08:00',
                jenis_aktivitas: 'pelajaran'
            };

            // Mock implementation sequence...
            mockDb.execute.mock.mockImplementation(async (query) => {
                if (query.includes('FROM jam_pelajaran')) return [[{ jam_ke: 1 }]];
                if (query.includes('FROM kelas WHERE id_kelas = ?')) return [[{ id_kelas: 1 }]];
                if (query.includes('FROM mapel WHERE id_mapel = ?')) return [[{ id_mapel: 1 }]];
                if (query.includes('FROM guru WHERE id_guru IN')) return [[{ id_guru: 1 }]];
                if (query.includes('FROM jadwal') && query.includes('kelas_id = ?')) return [[]]; // No class conflict
                if (query.includes('FROM jadwal') && query.includes('guru_id = ?')) return [[]]; // No teacher conflict
                if (query.includes('INSERT INTO jadwal')) return [{ insertId: 10 }];
                if (query.includes('INSERT INTO jadwal_guru')) return [{}];
                return [[]]; 
            });

            await jadwalController.createJadwal(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 201);
            assert.deepStrictEqual(res.json.mock.calls[0].arguments[0].data, { id: 10 });
        });

        it('should fail if missing required fields', async () => {
            req.body = {
                // Missing fields but valid time to pass time check
                jam_mulai: '07:00', 
                jam_selesai: '08:00',
                jenis_aktivitas: 'pelajaran'
            };

            await jadwalController.createJadwal(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
            assert.match(res.json.mock.calls[0].arguments[0].error.message, /Semua field wajib diisi/);
        });
    });

    describe('deleteJadwal', () => {
        it('should delete existing schedule', async () => {
            req.params.id = 1;
            mockDb.execute.mock.mockImplementation(() => Promise.resolve([{ affectedRows: 1 }]));

            await jadwalController.deleteJadwal(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
            assert.strictEqual(res.json.mock.calls[0].arguments[0].message, 'Jadwal berhasil dihapus');
        });

        it('should return 404 if not found', async () => {
            req.params.id = 999;
            mockDb.execute.mock.mockImplementation(() => Promise.resolve([{ affectedRows: 0 }]));

            await jadwalController.deleteJadwal(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 404);
        });
    });
});
