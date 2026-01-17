/**
 * Jam Pelajaran Controller
 * CRUD operations for dynamic jam pelajaran per kelas
 * 
 * API Endpoints:
 * - GET  /api/admin/jam-pelajaran          - Get all (grouped by kelas)
 * - GET  /api/admin/jam-pelajaran/:kelasId - Get for specific class
 * - POST /api/admin/jam-pelajaran/:kelasId - Bulk upsert
 * - POST /api/admin/jam-pelajaran/copy     - Copy to other classes
 * - GET  /api/admin/jam-pelajaran/default  - Get default template
 * - DELETE /api/admin/jam-pelajaran/:kelasId - Reset to default
 */

import { 
    sendDatabaseError, 
    sendValidationError, 
    sendNotFoundError,
    sendSuccessResponse
} from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

// Create module logger
const logger = createLogger('JamPelajaran');

// Constants
const MIN_JAM_KE = 1;
const MAX_JAM_KE = 15;
const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const DEFAULT_JAM_PELAJARAN = [
    { jam_ke: 1, jam_mulai: '06:30', jam_selesai: '07:15', keterangan: null },
    { jam_ke: 2, jam_mulai: '07:15', jam_selesai: '08:00', keterangan: null },
    { jam_ke: 3, jam_mulai: '08:00', jam_selesai: '08:45', keterangan: null },
    { jam_ke: 4, jam_mulai: '08:45', jam_selesai: '09:30', keterangan: null },
    { jam_ke: 5, jam_mulai: '09:45', jam_selesai: '10:30', keterangan: 'Setelah Istirahat 1' },
    { jam_ke: 6, jam_mulai: '10:30', jam_selesai: '11:15', keterangan: null },
    { jam_ke: 7, jam_mulai: '11:15', jam_selesai: '12:00', keterangan: null },
    { jam_ke: 8, jam_mulai: '12:00', jam_selesai: '12:45', keterangan: null },
    { jam_ke: 9, jam_mulai: '13:00', jam_selesai: '13:45', keterangan: 'Setelah Istirahat 2' },
    { jam_ke: 10, jam_mulai: '13:45', jam_selesai: '14:30', keterangan: null }
];

/** SQL query to get class name by ID (S1192 duplicate literal fix) */
const SQL_GET_KELAS_NAME = 'SELECT nama_kelas FROM kelas WHERE id_kelas = ?';

async function executeJamPelajaranUpsert(kelasId, jam) {
    const daysToInsert = jam.hari ? [jam.hari] : ['Senin', 'Selasa', 'Rabu', 'Kamis']; // Default to Mon-Thu if generic
    
    // We execute insert for each day to ensure schedule exists for lookup
    for (const hari of daysToInsert) {
        await globalThis.dbPool.execute(`
            INSERT INTO jam_pelajaran (kelas_id, hari, jam_ke, jam_mulai, jam_selesai, label)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                jam_mulai = VALUES(jam_mulai),
                jam_selesai = VALUES(jam_selesai),
                label = VALUES(label),
                updated_at = CURRENT_TIMESTAMP
        `, [kelasId, hari, jam.jam_ke, jam.jam_mulai, jam.jam_selesai, jam.keterangan || jam.label || null]);
    }
}

/**
 * Validate time format (HH:MM or HH:MM:SS)
 */
function isValidTimeFormat(time) {
    return TIME_REGEX.test(time);
}

/**
 * Validate time logic (mulai < selesai)
 */
function isValidTimeRange(jamMulai, jamSelesai) {
    const start = jamMulai.replaceAll(':', '');
    const end = jamSelesai.replaceAll(':', '');
    return Number.parseInt(start) < Number.parseInt(end);
}

/**
 * Validate a single jam pelajaran entry
 * @param {Object} jam - The jam pelajaran object
 * @param {number} jamIndex - 1-based index for error messages
 * @param {Set} seenJamKe - Set of already seen jam_ke values
 * @param {Array} errors - Array to push errors to
 */
function validateJamPelajaranEntry(jam, jamIndex, seenJamKe, errors) {
    // Required fields check
    if (!jam.jam_ke) {
        errors.push({ index: jamIndex, field: 'jam_ke', message: 'Nomor jam wajib diisi' });
    }
    if (!jam.jam_mulai) {
        errors.push({ index: jamIndex, field: 'jam_mulai', message: 'Waktu mulai wajib diisi' });
    }
    if (!jam.jam_selesai) {
        errors.push({ index: jamIndex, field: 'jam_selesai', message: 'Waktu selesai wajib diisi' });
    }
    
    // Skip further validation if required fields missing
    if (!jam.jam_ke || !jam.jam_mulai || !jam.jam_selesai) return;
    
    // jam_ke range check
    if (jam.jam_ke < MIN_JAM_KE || jam.jam_ke > MAX_JAM_KE) {
        errors.push({ 
            index: jamIndex, 
            field: 'jam_ke', 
            value: jam.jam_ke,
            message: `Nomor jam harus antara ${MIN_JAM_KE} dan ${MAX_JAM_KE}` 
        });
    }
    
    // Duplicate jam_ke check
    if (seenJamKe.has(jam.jam_ke)) {
        errors.push({ 
            index: jamIndex, 
            field: 'jam_ke', 
            value: jam.jam_ke,
            message: `Jam ke-${jam.jam_ke} terduplikat dalam data` 
        });
    }
    seenJamKe.add(jam.jam_ke);
    
    // Time format validation
    if (!isValidTimeFormat(jam.jam_mulai)) {
        errors.push({ 
            index: jamIndex, 
            field: 'jam_mulai', 
            value: jam.jam_mulai,
            message: 'Format waktu mulai tidak valid (gunakan HH:MM)' 
        });
    }
    if (!isValidTimeFormat(jam.jam_selesai)) {
        errors.push({ 
            index: jamIndex, 
            field: 'jam_selesai', 
            value: jam.jam_selesai,
            message: 'Format waktu selesai tidak valid (gunakan HH:MM)' 
        });
    }
    
    // Time range validation
    if (isValidTimeFormat(jam.jam_mulai) && isValidTimeFormat(jam.jam_selesai)) {
        if (!isValidTimeRange(jam.jam_mulai, jam.jam_selesai)) {
            errors.push({ 
                index: jamIndex, 
                field: 'jam_selesai', 
                value: `${jam.jam_mulai} - ${jam.jam_selesai}`,
                message: 'Waktu selesai harus lebih besar dari waktu mulai' 
            });
        }
    }
}

/**
 * Get all jam pelajaran for a specific kelas
 * GET /api/admin/jam-pelajaran/:kelasId
 */
export const getJamPelajaranByKelas = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kelasId } = req.params;
    
    log.requestStart('GetByKelas', { kelasId });
    
    try {
        // Validate kelasId
        if (!kelasId || Number.isNaN(Number.parseInt(kelasId))) {
            log.validationFail('kelasId', kelasId, 'Invalid or missing kelas ID');
            return sendValidationError(res, 'ID kelas tidak valid', { field: 'kelasId', value: kelasId });
        }
        
        const [rows] = await globalThis.dbPool.execute(`
            SELECT jp.*, k.nama_kelas
            FROM jam_pelajaran jp
            JOIN kelas k ON jp.kelas_id = k.id_kelas
            WHERE jp.kelas_id = ?
            ORDER BY jp.jam_ke ASC
        `, [kelasId]);
        
        log.success('GetByKelas', { kelasId, count: rows.length });
        
        // Map label to keterangan for FE compatibility
        const mappedRows = rows.map(row => ({
            ...row,
            keterangan: row.label || row.keterangan
        }));

        return sendSuccessResponse(res, mappedRows, `Berhasil mengambil ${rows.length} jam pelajaran`);
        
    } catch (error) {
        log.dbError('query', error, { kelasId });
        return sendDatabaseError(res, error, 'Gagal mengambil data jam pelajaran');
    }
};

/**
 * Get jam pelajaran for all kelas (for export/overview)
 * GET /api/admin/jam-pelajaran
 */
export const getAllJamPelajaran = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetAll');
    
    try {
        const [rows] = await globalThis.dbPool.execute(`
            SELECT jp.*, k.nama_kelas, k.tingkat
            FROM jam_pelajaran jp
            JOIN kelas k ON jp.kelas_id = k.id_kelas
            WHERE jp.status = 'aktif' AND k.status = 'aktif'
            ORDER BY k.tingkat, k.nama_kelas, jp.jam_ke ASC
        `);
        
        // Group by kelas
        const grouped = rows.reduce((acc, row) => {
            if (!acc[row.kelas_id]) {
                acc[row.kelas_id] = {
                    kelas_id: row.kelas_id,
                    nama_kelas: row.nama_kelas,
                    tingkat: row.tingkat,
                    jam_pelajaran: []
                };
            }
            acc[row.kelas_id].jam_pelajaran.push({
                id: row.id,
                jam_ke: row.jam_ke,
                jam_mulai: row.jam_mulai,
                jam_selesai: row.jam_selesai,
                keterangan: row.label || row.keterangan, // Map label to keterangan for FE compatibility
                hari: row.hari
            });
            return acc;
        }, {});
        
        const result = Object.values(grouped);
        log.success('GetAll', { kelasCount: result.length, totalEntries: rows.length });
        return sendSuccessResponse(res, result, `Berhasil mengambil jam pelajaran untuk ${result.length} kelas`);
        
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil semua data jam pelajaran');
    }
};

/**
 * Create or update jam pelajaran for a kelas (bulk upsert)
 * POST /api/admin/jam-pelajaran/:kelasId
 * Body: { jam_pelajaran: [{ jam_ke, jam_mulai, jam_selesai, keterangan? }] }
 */
export const upsertJamPelajaran = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kelasId } = req.params;
    const { jam_pelajaran } = req.body;
    const startTime = Date.now();
    
    log.requestStart('Upsert', { kelasId, itemCount: jam_pelajaran?.length || 0 });
    
    try {
        // === VALIDATION ===
        
        // Validate kelasId
        if (!kelasId || Number.isNaN(Number.parseInt(kelasId))) {
            log.validationFail('kelasId', kelasId, 'Invalid or missing kelas ID');
            return sendValidationError(res, 'ID kelas tidak valid', { field: 'kelasId', value: kelasId });
        }
        
        // Validate jam_pelajaran array
        if (!jam_pelajaran) {
            log.validationFail('jam_pelajaran', null, 'Missing in request body');
            return sendValidationError(res, 'Data jam_pelajaran wajib diisi', { field: 'jam_pelajaran', expected: 'array' });
        }
        
        if (!Array.isArray(jam_pelajaran)) {
            log.validationFail('jam_pelajaran', typeof jam_pelajaran, 'Not an array');
            return sendValidationError(res, 'Data jam_pelajaran harus berupa array', { 
                field: 'jam_pelajaran', 
                received: typeof jam_pelajaran, 
                expected: 'array' 
            });
        }
        
        if (jam_pelajaran.length === 0) {
            log.validationFail('jam_pelajaran', 0, 'Empty array');
            return sendValidationError(res, 'Data jam_pelajaran tidak boleh kosong', { 
                field: 'jam_pelajaran', 
                received: 0, 
                expected: '1 or more items' 
            });
        }
        
        // Verify kelas exists
        const [kelas] = await globalThis.dbPool.execute(
            'SELECT id_kelas, nama_kelas FROM kelas WHERE id_kelas = ?',
            [kelasId]
        );
        
        if (kelas.length === 0) {
            log.warn('Kelas not found', { kelasId });
            return sendNotFoundError(res, `Kelas dengan ID ${kelasId} tidak ditemukan`);
        }
        
        const kelasName = kelas[0].nama_kelas;
        log.debug('Validating entries', { kelas: kelasName, count: jam_pelajaran.length });
        
        // Validate each jam pelajaran entry
        const errors = [];
        const seenJamKe = new Set();
        
        for (let i = 0; i < jam_pelajaran.length; i++) {
            validateJamPelajaranEntry(jam_pelajaran[i], i + 1, seenJamKe, errors);
        }
        
        if (errors.length > 0) {
            log.warn('Validation failed', { errorCount: errors.length, errors: errors.slice(0, 3) });
            return sendValidationError(res, `Terdapat ${errors.length} kesalahan validasi`, { errors });
        }
        
        // === DATABASE UPSERT ===
        log.debug('Starting upsert operation', { count: jam_pelajaran.length });
        
        let upsertedCount = 0;
        for (const jam of jam_pelajaran) {
            await executeJamPelajaranUpsert(kelasId, jam);
            upsertedCount++;
        }
        
        log.timed('Upsert', startTime, { kelasId, kelasName, upsertedCount });
        return sendSuccessResponse(res, { 
            upsertedCount, 
            kelasId: Number.parseInt(kelasId),
            kelasName 
        }, `Berhasil menyimpan ${upsertedCount} jam pelajaran untuk kelas ${kelasName}`);
        
    } catch (error) {
        log.dbError('upsert', error, { kelasId });
        return sendDatabaseError(res, error, 'Gagal menyimpan jam pelajaran');
    }
};

/**
 * Delete jam pelajaran for a specific kelas (reset to default)
 * DELETE /api/admin/jam-pelajaran/:kelasId
 */
export const deleteJamPelajaranByKelas = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kelasId } = req.params;
    
    log.requestStart('Delete', { kelasId });
    
    try {
        // Validate kelasId
        if (!kelasId || Number.isNaN(Number.parseInt(kelasId))) {
            log.validationFail('kelasId', kelasId, 'Invalid or missing kelas ID');
            return sendValidationError(res, 'ID kelas tidak valid', { field: 'kelasId', value: kelasId });
        }
        
        // Get kelas name for logging
        const [kelas] = await globalThis.dbPool.execute(
            SQL_GET_KELAS_NAME,
            [kelasId]
        );
        const kelasName = kelas.length > 0 ? kelas[0].nama_kelas : `ID ${kelasId}`;
        
        const [result] = await globalThis.dbPool.execute(
            'DELETE FROM jam_pelajaran WHERE kelas_id = ?',
            [kelasId]
        );
        
        log.success('Delete', { kelasId, kelasName, deletedCount: result.affectedRows });
        return sendSuccessResponse(res, { 
            deletedCount: result.affectedRows,
            kelasId: Number.parseInt(kelasId),
            kelasName
        }, `Berhasil menghapus ${result.affectedRows} jam pelajaran dari kelas ${kelasName}`);
        
    } catch (error) {
        log.dbError('delete', error, { kelasId });
        return sendDatabaseError(res, error, 'Gagal menghapus jam pelajaran');
    }
};

/**
 * Copy jam pelajaran from one kelas to another
 * POST /api/admin/jam-pelajaran/copy
 * Body: { sourceKelasId, targetKelasIds: [] }
 */
export const copyJamPelajaran = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { sourceKelasId, targetKelasIds } = req.body;
    const startTime = Date.now();
    
    log.requestStart('Copy', { sourceKelasId, targetCount: targetKelasIds?.length || 0 });
    
    try {
        // === VALIDATION ===
        
        if (!sourceKelasId) {
            log.validationFail('sourceKelasId', null, 'Missing source kelas ID');
            return sendValidationError(res, 'ID kelas sumber wajib diisi', { field: 'sourceKelasId' });
        }
        
        if (!targetKelasIds) {
            log.validationFail('targetKelasIds', null, 'Missing target kelas IDs');
            return sendValidationError(res, 'ID kelas tujuan wajib diisi', { field: 'targetKelasIds' });
        }
        
        if (!Array.isArray(targetKelasIds)) {
            log.validationFail('targetKelasIds', typeof targetKelasIds, 'Not an array');
            return sendValidationError(res, 'ID kelas tujuan harus berupa array', { 
                field: 'targetKelasIds', 
                received: typeof targetKelasIds 
            });
        }
        
        if (targetKelasIds.length === 0) {
            log.validationFail('targetKelasIds', 0, 'Empty array');
            return sendValidationError(res, 'Minimal pilih satu kelas tujuan', { field: 'targetKelasIds' });
        }
        
        // Check if source kelas has jam pelajaran
        const [sourceJam] = await globalThis.dbPool.execute(
            'SELECT jam_ke, jam_mulai, jam_selesai, keterangan FROM jam_pelajaran WHERE kelas_id = ? ORDER BY jam_ke',
            [sourceKelasId]
        );
        
        if (sourceJam.length === 0) {
            log.warn('Source kelas has no jam pelajaran', { sourceKelasId });
            return sendNotFoundError(res, 'Kelas sumber tidak memiliki konfigurasi jam pelajaran');
        }
        
        // Get source kelas name
        const [sourceKelas] = await globalThis.dbPool.execute(
            SQL_GET_KELAS_NAME,
            [sourceKelasId]
        );
        const sourceKelasName = sourceKelas.length > 0 ? sourceKelas[0].nama_kelas : `ID ${sourceKelasId}`;
        
        // === COPY OPERATION ===
        log.debug('Starting copy operation', { source: sourceKelasName, jamCount: sourceJam.length, targetCount: targetKelasIds.length });
        
        let copiedCount = 0;
        const copiedTo = [];
        
        for (const targetId of targetKelasIds) {
            // Get target kelas name
            const [targetKelas] = await globalThis.dbPool.execute(
                SQL_GET_KELAS_NAME,
                [targetId]
            );
            
            if (targetKelas.length === 0) {
                log.warn('Target kelas not found, skipping', { targetId });
                continue;
            }
            
            for (const jam of sourceJam) {
                await executeJamPelajaranUpsert(targetId, jam);
            }
            
            copiedTo.push(targetKelas[0].nama_kelas);
            copiedCount++;
        }
        
        log.timed('Copy', startTime, { sourceKelas: sourceKelasName, copiedToCount: copiedCount, jamCount: sourceJam.length });
        return sendSuccessResponse(res, { 
            copiedToCount: copiedCount,
            jamCount: sourceJam.length,
            sourceKelas: sourceKelasName,
            targetKelas: copiedTo
        }, `Berhasil menyalin ${sourceJam.length} jam pelajaran dari ${sourceKelasName} ke ${copiedCount} kelas`);
        
    } catch (error) {
        log.dbError('copy', error, { sourceKelasId, targetKelasIds });
        return sendDatabaseError(res, error, 'Gagal menyalin jam pelajaran');
    }
};

/**
 * Get default jam pelajaran template (for new kelas or reset)
 * GET /api/admin/jam-pelajaran/default
 */
export const getDefaultJamPelajaran = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetDefault');
    
    const defaultJam = DEFAULT_JAM_PELAJARAN;
    
    log.success('GetDefault', { count: defaultJam.length });
    return sendSuccessResponse(res, defaultJam, `Template default ${defaultJam.length} jam pelajaran`);
};

/**
 * Seed global jam pelajaran data (Emergency/Init)
 * POST /api/admin/jam-pelajaran/seed
 */
/**
 * Helper to seed default data directly (internal use)
 */
export const seedDefaultJamPelajaranData = async () => {
    const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    
    const JAM_SLOTS_NORMAL = [
        { jam_ke: 0, mulai: '07:00', selesai: '07:15', jenis: 'upacara', label: 'LITERASI (Senin Upacara)', durasi: 15 },
        { jam_ke: 1, mulai: '07:15', selesai: '08:00', jenis: 'pelajaran', durasi: 45 },
        { jam_ke: 2, mulai: '08:00', selesai: '08:45', jenis: 'pelajaran', durasi: 45 },
        { jam_ke: 3, mulai: '08:45', selesai: '09:30', jenis: 'pelajaran', durasi: 45 },
        { jam_ke: 4, mulai: '09:30', selesai: '10:15', jenis: 'pelajaran', durasi: 45 },
        { jam_ke: 5, mulai: '10:15', selesai: '10:30', jenis: 'istirahat', label: 'ISTIRAHAT 1', durasi: 15 },
        { jam_ke: 6, mulai: '10:30', selesai: '11:15', jenis: 'pelajaran', durasi: 45 },
        { jam_ke: 7, mulai: '11:15', selesai: '12:00', jenis: 'pelajaran', durasi: 45 },
        { jam_ke: 8, mulai: '12:00', selesai: '12:30', jenis: 'istirahat', label: 'ISTIRAHAT 2 (SHOLAT)', durasi: 30 },
        { jam_ke: 9, mulai: '12:30', selesai: '13:15', jenis: 'pelajaran', durasi: 45 },
        { jam_ke: 10, mulai: '13:15', selesai: '14:00', jenis: 'pelajaran', durasi: 45 },
        { jam_ke: 11, mulai: '14:00', selesai: '14:45', jenis: 'pelajaran', durasi: 45 },
        { jam_ke: 12, mulai: '14:45', selesai: '15:30', jenis: 'pelajaran', durasi: 45 },
    ];

    const JAM_SLOTS_JUMAT = [
        { jam_ke: 0, mulai: '07:00', selesai: '07:15', jenis: 'upacara', label: 'LITERASI/QURAN', durasi: 15 },
        { jam_ke: 1, mulai: '07:15', selesai: '07:50', jenis: 'pelajaran', durasi: 35 },
        { jam_ke: 2, mulai: '07:50', selesai: '08:25', jenis: 'pelajaran', durasi: 35 },
        { jam_ke: 3, mulai: '08:25', selesai: '09:00', jenis: 'pelajaran', durasi: 35 },
        { jam_ke: 4, mulai: '09:00', selesai: '09:35', jenis: 'pelajaran', durasi: 35 },
        { jam_ke: 5, mulai: '09:35', selesai: '09:50', jenis: 'istirahat', label: 'ISTIRAHAT 1', durasi: 15 },
        { jam_ke: 6, mulai: '09:50', selesai: '10:25', jenis: 'pelajaran', durasi: 35 },
        { jam_ke: 7, mulai: '10:25', selesai: '11:00', jenis: 'pelajaran', durasi: 35 },
        { jam_ke: 8, mulai: '11:00', selesai: '13:00', jenis: 'istirahat', label: 'SHOLAT JUMAT', durasi: 120 },
        { jam_ke: 9, mulai: '13:00', selesai: '13:40', jenis: 'pelajaran', durasi: 40 },
        { jam_ke: 10, mulai: '13:40', selesai: '14:20', jenis: 'pelajaran', durasi: 40 },
    ];

    let count = 0;
    // Transactional could be better but generic logic here
    await globalThis.dbPool.execute('TRUNCATE TABLE jam_pelajaran');
    
    for (const hari of DAYS) {
        const slots = hari === 'Jumat' ? JAM_SLOTS_JUMAT : JAM_SLOTS_NORMAL;
        for (const slot of slots) {
            await globalThis.dbPool.execute(
                `INSERT INTO jam_pelajaran 
                (hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [hari, slot.jam_ke, slot.mulai, slot.selesai, slot.durasi, slot.jenis, slot.label || null]
            );
            count++;
        }
    }
    return count;
};

/**
 * Seed global jam pelajaran data (Emergency/Init)
 * POST /api/admin/jam-pelajaran/seed
 */
export const seedGlobalJamPelajaran = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('SeedGlobal');

    try {
        const count = await seedDefaultJamPelajaranData();
        log.success('SeedGlobal', { count });
        return sendSuccessResponse(res, { count }, `Berhasil seed ${count} data jam pelajaran`);
    } catch (error) {
        log.dbError('seed', error);
        return sendDatabaseError(res, error, 'Gagal seed jam pelajaran');
    }
};
