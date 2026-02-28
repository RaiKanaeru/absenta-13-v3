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

const mockConnection = {
    execute: mock.fn(),
    beginTransaction: mock.fn(() => Promise.resolve()),
    commit: mock.fn(() => Promise.resolve()),
    rollback: mock.fn(() => Promise.resolve()),
    release: mock.fn()
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
        mockDb.getConnection = mock.fn(() => Promise.resolve(mockConnection));


        // Reset connection mocks
        mockConnection.execute = mock.fn();
        mockConnection.beginTransaction = mock.fn(() => Promise.resolve());
        mockConnection.commit = mock.fn(() => Promise.resolve());
        mockConnection.rollback = mock.fn(() => Promise.resolve());
        mockConnection.release = mock.fn();

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


    describe('batchUpdateMatrix', () => {
        it('should reject invalid hari', async () => {
            req.body = { hari: 'InvalidDay', changes: [{ kelas_id: 1, jam_ke: 1 }] };

            await jadwalController.batchUpdateMatrix(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
            assert.match(res.json.mock.calls[0].arguments[0].error.message, /Hari tidak valid/);
        });

        it('should reject empty changes array', async () => {
            req.body = { hari: 'Senin', changes: [] };

            await jadwalController.batchUpdateMatrix(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
        });

        it('should reject missing changes field', async () => {
            req.body = { hari: 'Senin' };

            await jadwalController.batchUpdateMatrix(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
        });

        it('should successfully perform batch move (delete + insert)', async () => {
            req.body = {
                hari: 'Senin',
                changes: [
                    { kelas_id: 1, jam_ke: 1, action: 'delete' },
                    { kelas_id: 1, jam_ke: 3, mapel_id: 2, guru_id: 3, ruang_id: 4 }
                ]
            };

            mockConnection.execute.mock.mockImplementation(async (query, params) => {
                // Slot lookups (run in batchUpdateMatrix before processing)
                if (query.includes('FROM jam_pelajaran_kelas')) {
                    return [[{ kelas_id: 1, jam_ke: 3, jam_mulai: '09:00', jam_selesai: '09:45' }]];
                }
                if (query.includes('FROM jam_pelajaran WHERE hari')) {
                    return [[{ jam_ke: 3, jam_mulai: '09:00', jam_selesai: '09:45' }]];
                }

                // SELECT existing jadwal for each change (first call = delete slot, second = upsert slot)
                if (query.includes('FROM jadwal WHERE kelas_id') && query.includes('status = "aktif"')) {
                    const jamKe = params ? params[2] : null;
                    if (Number(jamKe) === 1) {
                        // delete slot: existing record found
                        return [[{ id_jadwal: 10, mapel_id: 1, guru_id: 2, ruang_id: 3 }]];
                    }
                    // upsert slot: no existing record → INSERT path
                    return [[]];
                }

                // Soft-delete update
                if (query.includes('UPDATE jadwal SET status')) {
                    return [{ affectedRows: 1 }];
                }

                // Conflict checks (guru, ruang, kelas) — all involve JOINs
                if (query.includes('FROM jadwal j') && (query.includes('guru_id IN') || query.includes('jadwal_guru'))) {
                    return [[]];
                }
                if (query.includes('FROM jadwal j') && query.includes('ruang_id')) {
                    return [[]];
                }
                if (query.includes('FROM jadwal j') && query.includes('kelas_id')) {
                    return [[]];
                }

                // validateGuruMapelMatch
                if (query.includes('FROM guru g')) {
                    return [[]];
                }

                // ensurePrimaryGuru - check existing jadwal_guru rows
                if (query.includes('FROM jadwal_guru WHERE jadwal_id')) {
                    return [[]];
                }

                // INSERT INTO jadwal
                if (query.includes('INSERT INTO jadwal')) {
                    return [{ insertId: 20 }];
                }

                // INSERT INTO jadwal_guru (from ensurePrimaryGuru)
                if (query.includes('INSERT INTO jadwal_guru')) {
                    return [{ insertId: 21 }];
                }

                return [[]];
            });

            await jadwalController.batchUpdateMatrix(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
            const responseData = res.json.mock.calls[0].arguments[0];
            assert.strictEqual(responseData.data.created, 1);
            assert.strictEqual(responseData.data.deleted, 1);
            assert.strictEqual(mockConnection.commit.mock.callCount(), 1);
            assert.strictEqual(mockConnection.rollback.mock.callCount(), 0);
        });

        it('should rollback and return 400 on guru conflict during upsert', async () => {
            req.body = {
                hari: 'Senin',
                changes: [
                    { kelas_id: 1, jam_ke: 2, mapel_id: 2, guru_id: 3, ruang_id: 4 }
                ]
            };

            mockConnection.execute.mock.mockImplementation(async (query, params) => {
                // Slot lookups
                if (query.includes('FROM jam_pelajaran_kelas')) {
                    return [[{ kelas_id: 1, jam_ke: 2, jam_mulai: '08:00', jam_selesai: '08:45' }]];
                }
                if (query.includes('FROM jam_pelajaran WHERE hari')) {
                    return [[{ jam_ke: 2, jam_mulai: '08:00', jam_selesai: '08:45' }]];
                }

                // No existing jadwal for this slot → INSERT path
                if (query.includes('FROM jadwal WHERE kelas_id') && query.includes('status = "aktif"')) {
                    return [[]];
                }

                // Guru conflict: return a conflict row
                if (query.includes('FROM jadwal j') && (query.includes('guru_id IN') || query.includes('jadwal_guru'))) {
                    return [[{ id_jadwal: 5, nama_kelas: '10A', nama_guru: 'Pak Budi' }]];
                }

                return [[]];
            });

            await jadwalController.batchUpdateMatrix(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
            assert.strictEqual(mockConnection.rollback.mock.callCount(), 1);
            assert.strictEqual(mockConnection.commit.mock.callCount(), 0);
        });

        it('should return 400 when jam slot not found (no class or global slot)', async () => {
            req.body = {
                hari: 'Senin',
                changes: [
                    { kelas_id: 1, jam_ke: 99, mapel_id: 2, guru_id: 3, ruang_id: 4 }
                ]
            };

            mockConnection.execute.mock.mockImplementation(async (query) => {
                // No slots for jam_ke 99
                if (query.includes('FROM jam_pelajaran_kelas')) return [[]];
                if (query.includes('FROM jam_pelajaran WHERE hari')) return [[]];

                // No existing jadwal
                if (query.includes('FROM jadwal WHERE kelas_id') && query.includes('status = "aktif"')) {
                    return [[]];
                }

                return [[]];
            });

            await jadwalController.batchUpdateMatrix(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
            assert.strictEqual(mockConnection.rollback.mock.callCount(), 1);
            assert.strictEqual(mockConnection.commit.mock.callCount(), 0);
        });
    });
});
