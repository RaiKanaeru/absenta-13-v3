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
    sendSuccessResponse,
    ERROR_CODES,
    AppError
} from '../utils/errorHandler.js';

// Constants
const MIN_JAM_KE = 1;
const MAX_JAM_KE = 15;
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

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
    const start = jamMulai.replace(/:/g, '');
    const end = jamSelesai.replace(/:/g, '');
    return parseInt(start) < parseInt(end);
}

/**
 * Get all jam pelajaran for a specific kelas
 * GET /api/admin/jam-pelajaran/:kelasId
 */
export const getJamPelajaranByKelas = async (req, res) => {
    const { kelasId } = req.params;
    const requestId = res.locals?.requestId || `jp-${Date.now()}`;
    
    console.log(`📋 [${requestId}] Get Jam Pelajaran | Kelas ID: ${kelasId}`);
    
    try {
        // Validate kelasId
        if (!kelasId || isNaN(parseInt(kelasId))) {
            console.log(`⚠️ [${requestId}] Invalid kelas ID: ${kelasId}`);
            return sendValidationError(res, 'ID kelas tidak valid', { field: 'kelasId', value: kelasId });
        }
        
        const [rows] = await global.dbPool.execute(`
            SELECT jp.*, k.nama_kelas
            FROM jam_pelajaran jp
            JOIN kelas k ON jp.kelas_id = k.id_kelas
            WHERE jp.kelas_id = ?
            ORDER BY jp.jam_ke ASC
        `, [kelasId]);
        
        console.log(`✅ [${requestId}] Found ${rows.length} jam pelajaran for kelas ${kelasId}`);
        return sendSuccessResponse(res, rows, `Berhasil mengambil ${rows.length} jam pelajaran`);
        
    } catch (error) {
        console.error(`❌ [${requestId}] Database error:`, error.message);
        return sendDatabaseError(res, error, 'Gagal mengambil data jam pelajaran');
    }
};

/**
 * Get jam pelajaran for all kelas (for export/overview)
 * GET /api/admin/jam-pelajaran
 */
export const getAllJamPelajaran = async (req, res) => {
    const requestId = res.locals?.requestId || `jp-${Date.now()}`;
    
    console.log(`📋 [${requestId}] Get All Jam Pelajaran`);
    
    try {
        const [rows] = await global.dbPool.execute(`
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
                keterangan: row.keterangan
            });
            return acc;
        }, {});
        
        const result = Object.values(grouped);
        console.log(`✅ [${requestId}] Found ${result.length} kelas with jam pelajaran, total ${rows.length} entries`);
        return sendSuccessResponse(res, result, `Berhasil mengambil jam pelajaran untuk ${result.length} kelas`);
        
    } catch (error) {
        console.error(`❌ [${requestId}] Database error:`, error.message);
        return sendDatabaseError(res, error, 'Gagal mengambil semua data jam pelajaran');
    }
};

/**
 * Create or update jam pelajaran for a kelas (bulk upsert)
 * POST /api/admin/jam-pelajaran/:kelasId
 * Body: { jam_pelajaran: [{ jam_ke, jam_mulai, jam_selesai, keterangan? }] }
 */
export const upsertJamPelajaran = async (req, res) => {
    const { kelasId } = req.params;
    const { jam_pelajaran } = req.body;
    const requestId = res.locals?.requestId || `jp-${Date.now()}`;
    
    console.log(`💾 [${requestId}] Upsert Jam Pelajaran | Kelas ID: ${kelasId} | Items: ${jam_pelajaran?.length || 0}`);
    
    try {
        // === VALIDATION ===
        
        // Validate kelasId
        if (!kelasId || isNaN(parseInt(kelasId))) {
            console.log(`⚠️ [${requestId}] Invalid kelas ID: ${kelasId}`);
            return sendValidationError(res, 'ID kelas tidak valid', { field: 'kelasId', value: kelasId });
        }
        
        // Validate jam_pelajaran array
        if (!jam_pelajaran) {
            console.log(`⚠️ [${requestId}] Missing jam_pelajaran in request body`);
            return sendValidationError(res, 'Data jam_pelajaran wajib diisi', { field: 'jam_pelajaran', expected: 'array' });
        }
        
        if (!Array.isArray(jam_pelajaran)) {
            console.log(`⚠️ [${requestId}] jam_pelajaran is not an array: ${typeof jam_pelajaran}`);
            return sendValidationError(res, 'Data jam_pelajaran harus berupa array', { 
                field: 'jam_pelajaran', 
                received: typeof jam_pelajaran, 
                expected: 'array' 
            });
        }
        
        if (jam_pelajaran.length === 0) {
            console.log(`⚠️ [${requestId}] jam_pelajaran array is empty`);
            return sendValidationError(res, 'Data jam_pelajaran tidak boleh kosong', { 
                field: 'jam_pelajaran', 
                received: 0, 
                expected: '1 or more items' 
            });
        }
        
        // Verify kelas exists
        const [kelas] = await global.dbPool.execute(
            'SELECT id_kelas, nama_kelas FROM kelas WHERE id_kelas = ?',
            [kelasId]
        );
        
        if (kelas.length === 0) {
            console.log(`⚠️ [${requestId}] Kelas not found: ${kelasId}`);
            return sendNotFoundError(res, `Kelas dengan ID ${kelasId} tidak ditemukan`);
        }
        
        const kelasName = kelas[0].nama_kelas;
        console.log(`📝 [${requestId}] Validating ${jam_pelajaran.length} jam pelajaran for kelas "${kelasName}"`);
        
        // Validate each jam pelajaran entry
        const errors = [];
        const seenJamKe = new Set();
        
        for (let i = 0; i < jam_pelajaran.length; i++) {
            const jam = jam_pelajaran[i];
            const jamIndex = i + 1;
            
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
            if (!jam.jam_ke || !jam.jam_mulai || !jam.jam_selesai) continue;
            
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
        
        if (errors.length > 0) {
            console.log(`⚠️ [${requestId}] Validation failed with ${errors.length} errors`);
            return sendValidationError(res, `Terdapat ${errors.length} kesalahan validasi`, { errors });
        }
        
        // === DATABASE UPSERT ===
        console.log(`💾 [${requestId}] Upserting ${jam_pelajaran.length} jam pelajaran...`);
        
        let upsertedCount = 0;
        for (const jam of jam_pelajaran) {
            await global.dbPool.execute(`
                INSERT INTO jam_pelajaran (kelas_id, jam_ke, jam_mulai, jam_selesai, keterangan)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    jam_mulai = VALUES(jam_mulai),
                    jam_selesai = VALUES(jam_selesai),
                    keterangan = VALUES(keterangan),
                    updated_at = CURRENT_TIMESTAMP
            `, [kelasId, jam.jam_ke, jam.jam_mulai, jam.jam_selesai, jam.keterangan || null]);
            upsertedCount++;
        }
        
        console.log(`✅ [${requestId}] Successfully saved ${upsertedCount} jam pelajaran for kelas "${kelasName}"`);
        return sendSuccessResponse(res, { 
            upsertedCount, 
            kelasId: parseInt(kelasId),
            kelasName 
        }, `Berhasil menyimpan ${upsertedCount} jam pelajaran untuk kelas ${kelasName}`);
        
    } catch (error) {
        console.error(`❌ [${requestId}] Database error:`, error.message);
        return sendDatabaseError(res, error, 'Gagal menyimpan jam pelajaran');
    }
};

/**
 * Delete jam pelajaran for a specific kelas (reset to default)
 * DELETE /api/admin/jam-pelajaran/:kelasId
 */
export const deleteJamPelajaranByKelas = async (req, res) => {
    const { kelasId } = req.params;
    const requestId = res.locals?.requestId || `jp-${Date.now()}`;
    
    console.log(`🗑️ [${requestId}] Delete Jam Pelajaran | Kelas ID: ${kelasId}`);
    
    try {
        // Validate kelasId
        if (!kelasId || isNaN(parseInt(kelasId))) {
            console.log(`⚠️ [${requestId}] Invalid kelas ID: ${kelasId}`);
            return sendValidationError(res, 'ID kelas tidak valid', { field: 'kelasId', value: kelasId });
        }
        
        // Get kelas name for logging
        const [kelas] = await global.dbPool.execute(
            'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
            [kelasId]
        );
        const kelasName = kelas.length > 0 ? kelas[0].nama_kelas : `ID ${kelasId}`;
        
        const [result] = await global.dbPool.execute(
            'DELETE FROM jam_pelajaran WHERE kelas_id = ?',
            [kelasId]
        );
        
        console.log(`✅ [${requestId}] Deleted ${result.affectedRows} jam pelajaran for kelas "${kelasName}"`);
        return sendSuccessResponse(res, { 
            deletedCount: result.affectedRows,
            kelasId: parseInt(kelasId),
            kelasName
        }, `Berhasil menghapus ${result.affectedRows} jam pelajaran dari kelas ${kelasName}`);
        
    } catch (error) {
        console.error(`❌ [${requestId}] Database error:`, error.message);
        return sendDatabaseError(res, error, 'Gagal menghapus jam pelajaran');
    }
};

/**
 * Copy jam pelajaran from one kelas to another
 * POST /api/admin/jam-pelajaran/copy
 * Body: { sourceKelasId, targetKelasIds: [] }
 */
export const copyJamPelajaran = async (req, res) => {
    const { sourceKelasId, targetKelasIds } = req.body;
    const requestId = res.locals?.requestId || `jp-${Date.now()}`;
    
    console.log(`📋 [${requestId}] Copy Jam Pelajaran | Source: ${sourceKelasId} | Targets: ${targetKelasIds?.length || 0}`);
    
    try {
        // === VALIDATION ===
        
        if (!sourceKelasId) {
            console.log(`⚠️ [${requestId}] Missing sourceKelasId`);
            return sendValidationError(res, 'ID kelas sumber wajib diisi', { field: 'sourceKelasId' });
        }
        
        if (!targetKelasIds) {
            console.log(`⚠️ [${requestId}] Missing targetKelasIds`);
            return sendValidationError(res, 'ID kelas tujuan wajib diisi', { field: 'targetKelasIds' });
        }
        
        if (!Array.isArray(targetKelasIds)) {
            console.log(`⚠️ [${requestId}] targetKelasIds is not an array: ${typeof targetKelasIds}`);
            return sendValidationError(res, 'ID kelas tujuan harus berupa array', { 
                field: 'targetKelasIds', 
                received: typeof targetKelasIds 
            });
        }
        
        if (targetKelasIds.length === 0) {
            console.log(`⚠️ [${requestId}] targetKelasIds is empty`);
            return sendValidationError(res, 'Minimal pilih satu kelas tujuan', { field: 'targetKelasIds' });
        }
        
        // Check if source kelas has jam pelajaran
        const [sourceJam] = await global.dbPool.execute(
            'SELECT jam_ke, jam_mulai, jam_selesai, keterangan FROM jam_pelajaran WHERE kelas_id = ? ORDER BY jam_ke',
            [sourceKelasId]
        );
        
        if (sourceJam.length === 0) {
            console.log(`⚠️ [${requestId}] No jam pelajaran found for source kelas ${sourceKelasId}`);
            return sendNotFoundError(res, 'Kelas sumber tidak memiliki konfigurasi jam pelajaran');
        }
        
        // Get source kelas name
        const [sourceKelas] = await global.dbPool.execute(
            'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
            [sourceKelasId]
        );
        const sourceKelasName = sourceKelas.length > 0 ? sourceKelas[0].nama_kelas : `ID ${sourceKelasId}`;
        
        // === COPY OPERATION ===
        console.log(`💾 [${requestId}] Copying ${sourceJam.length} jam from "${sourceKelasName}" to ${targetKelasIds.length} kelas...`);
        
        let copiedCount = 0;
        const copiedTo = [];
        
        for (const targetId of targetKelasIds) {
            // Get target kelas name
            const [targetKelas] = await global.dbPool.execute(
                'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
                [targetId]
            );
            
            if (targetKelas.length === 0) {
                console.log(`⚠️ [${requestId}] Target kelas ${targetId} not found, skipping...`);
                continue;
            }
            
            for (const jam of sourceJam) {
                await global.dbPool.execute(`
                    INSERT INTO jam_pelajaran (kelas_id, jam_ke, jam_mulai, jam_selesai, keterangan)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        jam_mulai = VALUES(jam_mulai),
                        jam_selesai = VALUES(jam_selesai),
                        keterangan = VALUES(keterangan),
                        updated_at = CURRENT_TIMESTAMP
                `, [targetId, jam.jam_ke, jam.jam_mulai, jam.jam_selesai, jam.keterangan]);
            }
            
            copiedTo.push(targetKelas[0].nama_kelas);
            copiedCount++;
        }
        
        console.log(`✅ [${requestId}] Successfully copied jam pelajaran to ${copiedCount} kelas: ${copiedTo.join(', ')}`);
        return sendSuccessResponse(res, { 
            copiedToCount: copiedCount,
            jamCount: sourceJam.length,
            sourceKelas: sourceKelasName,
            targetKelas: copiedTo
        }, `Berhasil menyalin ${sourceJam.length} jam pelajaran dari ${sourceKelasName} ke ${copiedCount} kelas`);
        
    } catch (error) {
        console.error(`❌ [${requestId}] Database error:`, error.message);
        return sendDatabaseError(res, error, 'Gagal menyalin jam pelajaran');
    }
};

/**
 * Get default jam pelajaran template (for new kelas or reset)
 * GET /api/admin/jam-pelajaran/default
 */
export const getDefaultJamPelajaran = async (req, res) => {
    const requestId = res.locals?.requestId || `jp-${Date.now()}`;
    
    console.log(`📋 [${requestId}] Get Default Jam Pelajaran Template`);
    
    const defaultJam = [
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
    
    console.log(`✅ [${requestId}] Returning default template with ${defaultJam.length} jam pelajaran`);
    return sendSuccessResponse(res, defaultJam, `Template default ${defaultJam.length} jam pelajaran`);
};
