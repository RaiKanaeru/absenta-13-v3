/**
 * Jadwal Controller
 * Menangani manajemen jadwal, dukungan multi-guru, dan query jadwal harian
 */

import { sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { getDayNameWIB } from '../utils/timeUtils.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Jadwal');

// ================================================
// FUNGSI PEMBANTU (HELPER FUNCTIONS)
// ================================================

/**
 * Memeriksa apakah dua rentang waktu tumpang tindih (overlap)
 * @param {string} start1 - Jam mulai rentang 1 (HH:MM)
 * @param {string} end1 - Jam selesai rentang 1 (HH:MM)
 * @param {string} start2 - Jam mulai rentang 2 (HH:MM)
 * @param {string} end2 - Jam selesai rentang 2 (HH:MM)
 * @returns {boolean} True jika rentang waktu overlap
 */
function isTimeOverlap(start1, end1, start2, end2) {
    return start1 < end2 && start2 < end1;
}

/**
 * Validasi format waktu 24 jam (HH:MM)
 * @param {string} timeString - String waktu untuk divalidasi
 * @returns {boolean} True jika format valid
 */
function validateTimeFormat(timeString) {
    if (!timeString || typeof timeString !== 'string') {
        return false;
    }
    const timeRegex = /^([01]?\d|2[0-3]):[0-5]\d$/;
    return timeRegex.test(timeString.trim());
}

/**
 * Validasi logika waktu (jam selesai harus setelah jam mulai)
 * @param {string} startTime - Jam mulai (HH:MM)
 * @param {string} endTime - Jam selesai (HH:MM)
 * @returns {{valid: boolean, error?: string}} Hasil validasi
 */
function validateTimeLogic(startTime, endTime) {
    if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
        return { valid: false, error: 'Format waktu tidak valid. Gunakan format 24 jam (HH:MM)' };
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
        return { valid: false, error: 'Jam selesai harus setelah jam mulai' };
    }

    return { valid: true };
}

/**
 * Konversi string waktu ke menit sejak tengah malam
 * @param {string} timeString - Waktu dalam format HH:MM
 * @returns {number} Menit sejak tengah malam
 */
function timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Helper function untuk build query jadwal yang standar untuk semua role
 * @param {string} role - Role pengguna (admin/guru)
 * @param {number|null} guruId - ID guru (jika role guru)
 * @returns {{query: string, params: Array}} Query SQL dan parameter
 */
function buildJadwalQuery(role = 'admin', guruId = null) {
    const baseQuery = `
        SELECT 
            j.id_jadwal as id,
            j.kelas_id, j.mapel_id, j.guru_id, j.ruang_id,
            j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai, j.status,
            j.jenis_aktivitas, j.is_absenable, j.keterangan_khusus, j.is_multi_guru,
            k.nama_kelas,
            COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
            COALESCE(g.nama, 'Sistem') as nama_guru,
            rk.kode_ruang, rk.nama_ruang, rk.lokasi,
            GROUP_CONCAT(CONCAT(jg2.guru_id, ':', g2.nama) ORDER BY jg2.is_primary DESC SEPARATOR '||') as guru_list
        FROM jadwal j
        JOIN kelas k ON j.kelas_id = k.id_kelas
        LEFT JOIN mapel m ON j.mapel_id = m.id_mapel  
        LEFT JOIN guru g ON j.guru_id = g.id_guru
        LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
        LEFT JOIN jadwal_guru jg2 ON j.id_jadwal = jg2.jadwal_id
        LEFT JOIN guru g2 ON jg2.guru_id = g2.id_guru
        WHERE j.status = 'aktif'
    `;

    let whereClause = '';
    let params = [];

    if (role === 'guru' && guruId) {
        whereClause = ' AND (j.guru_id = ? OR jg2.guru_id = ?)';
        params = [guruId, guruId];
    }

    const orderBy = `
        GROUP BY j.id_jadwal
        ORDER BY 
            FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'),
            j.jam_ke, k.nama_kelas
    `;

    return { query: baseQuery + whereClause + orderBy, params };
}

/**
 * Check conflict for a single teacher
 */
async function checkSingleTeacherConflict(guruId, hari, jam_mulai, jam_selesai, excludeJadwalId) {
    const conflictQuery = `
        SELECT j.id_jadwal, j.hari, j.jam_mulai, j.jam_selesai, j.keterangan_khusus, 
               COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
               k.nama_kelas
        FROM jadwal j
        LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
        JOIN kelas k ON j.kelas_id = k.id_kelas
        WHERE j.guru_id = ? AND j.hari = ? AND j.status = 'aktif'
        AND (
            (j.jam_mulai < ? AND j.jam_selesai > ?) OR
            (j.jam_mulai < ? AND j.jam_selesai > ?) OR
            (j.jam_mulai >= ? AND j.jam_selesai <= ?)
        )
        ${excludeJadwalId ? 'AND j.id_jadwal != ?' : ''}
    `;

    const params = excludeJadwalId
        ? [guruId, hari, jam_mulai, jam_selesai, jam_selesai, jam_mulai, jam_mulai, jam_selesai, excludeJadwalId]
        : [guruId, hari, jam_mulai, jam_selesai, jam_selesai, jam_mulai, jam_mulai, jam_selesai];

    const [conflicts] = await globalThis.dbPool.execute(conflictQuery, params);
    
    if (conflicts.length > 0) {
        const conflict = conflicts[0];
        return {
            hasConflict: true,
            guruId: guruId,
            conflict: {
                jadwal_id: conflict.id_jadwal,
                hari: conflict.hari,
                jam_mulai: conflict.jam_mulai,
                jam_selesai: conflict.jam_selesai,
                mata_pelajaran: conflict.nama_mapel,
                kelas: conflict.nama_kelas
            }
        };
    }
    return { hasConflict: false };
}

/**
 * Validasi konflik jadwal guru
 * @param {Array<number>} guruIds - Array ID Guru
 * @param {string} hari - Hari (Senin, Selasa, dst)
 * @param {string} jam_mulai - Jam mulai (HH:MM)
 * @param {string} jam_selesai - Jam selesai (HH:MM)
 * @param {number|null} excludeJadwalId - ID Jadwal untuk dikecualikan (saat update)
 * @returns {Promise<{hasConflict: boolean, guruId?: number, conflict?: Object}>} Hasil validasi konflik
 */
async function validateScheduleConflicts(guruIds, hari, jam_mulai, jam_selesai, excludeJadwalId = null) {
    for (const guruId of guruIds) {
        const result = await checkSingleTeacherConflict(guruId, hari, jam_mulai, jam_selesai, excludeJadwalId);
        if (result.hasConflict) {
            return result;
        }
    }

    return { hasConflict: false };
}

/**
 * Validate that all guru IDs exist in database
 * @returns {Object} { valid: boolean, invalidIds?: number[], error?: string }
 */
async function validateGuruIdsExist(guruIds) {
    if (!guruIds || guruIds.length === 0) return { valid: true };
    
    const validGuruIds = guruIds.filter(id => id && !Number.isNaN(Number(id)) && id > 0);
    if (validGuruIds.length === 0) {
        return { valid: false, error: 'Tidak ada guru yang valid dipilih' };
    }

    const placeholders = validGuruIds.map(() => '?').join(',');
    const [existingGurus] = await globalThis.dbPool.execute(
        `SELECT id_guru FROM guru WHERE id_guru IN (${placeholders})`,
        validGuruIds
    );

    if (existingGurus.length !== validGuruIds.length) {
        const existingIds = new Set(existingGurus.map(g => g.id_guru));
        const invalidIds = validGuruIds.filter(id => !existingIds.has(id));
        return { 
            valid: false, 
            invalidIds,
            error: `Guru dengan ID ${invalidIds.join(', ')} tidak ditemukan di database`
        };
    }

    return { valid: true, validGuruIds };
}

/**
 * Validasi required fields for jadwal based on activity type
 */
function validateJadwalFields(data, jenisAktivitas, guruIds) {
    const { kelas_id, mapel_id, hari, jam_ke, jam_mulai, jam_selesai } = data;

    if (jenisAktivitas === 'pelajaran') {
        if (!kelas_id || !mapel_id || !hari || !jam_ke || !jam_mulai || !jam_selesai) {
            return { valid: false, error: 'Semua field wajib diisi untuk jadwal pelajaran' };
        }
        if (guruIds.length === 0) {
            return { valid: false, error: 'Minimal satu guru harus dipilih untuk jadwal pelajaran' };
        }
    } else if (!kelas_id || !hari || !jam_mulai || !jam_selesai) {
        return { valid: false, error: 'Kelas, hari, dan waktu wajib diisi' };
    }

    return { valid: true };
}

/**
 * Check class schedule conflicts
 */
async function checkClassConflicts(kelas_id, hari, jam_mulai, jam_selesai, excludeJadwalId = null) {
    let query = `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
         WHERE kelas_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran'`;
    const params = [kelas_id, hari];

    if (excludeJadwalId) {
        query += ' AND id_jadwal != ?';
        params.push(excludeJadwalId);
    }

    const [conflicts] = await globalThis.dbPool.execute(query, params);

    for (const conflict of conflicts) {
        if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
            return { 
                hasConflict: true, 
                error: `Kelas sudah memiliki jadwal pelajaran pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`
            };
        }
    }

    return { hasConflict: false };
}

/**
 * Check room schedule conflicts
 */
async function checkRoomConflicts(ruang_id, hari, jam_mulai, jam_selesai, excludeJadwalId = null) {
    if (!ruang_id) return { hasConflict: false };

    let query = `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
         WHERE ruang_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran'`;
    const params = [ruang_id, hari];

    if (excludeJadwalId) {
        query += ' AND id_jadwal != ?';
        params.push(excludeJadwalId);
    }

    const [conflicts] = await globalThis.dbPool.execute(query, params);

    for (const conflict of conflicts) {
        if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
            return { 
                hasConflict: true, 
                error: `Ruang sudah digunakan pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`
            };
        }
    }

    return { hasConflict: false };
}

/**
 * Insert guru relations for a jadwal (batch insert)
 */
async function insertJadwalGuru(jadwalId, guruIds) {
    const validGuruIds = guruIds.filter(id => id && !Number.isNaN(Number(id)) && id > 0);
    if (validGuruIds.length === 0) return;

    const values = validGuruIds.map((id, i) => [jadwalId, id, i === 0 ? 1 : 0]);
    const placeholders = values.map(() => '(?, ?, ?)').join(', ');
    const flatValues = values.flat();
    
    await globalThis.dbPool.execute(
        `INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES ${placeholders}`,
        flatValues
    );
}

/**
 * Check if guru is available on a specific day (from MASTER GURU HARIAN)
 * @param {number} guruId - ID Guru
 * @param {string} hari - Hari (Senin, Selasa, dst)
 * @returns {Promise<{available: boolean, nama?: string, error?: string}>}
 */
async function checkGuruAvailability(guruId, hari) {
    // Skip check for system entities (Guru MANDIRI, etc.)
    const [guruCheck] = await globalThis.dbPool.execute(
        `SELECT nama, is_system_entity FROM guru WHERE id_guru = ?`,
        [guruId]
    );
    
    if (guruCheck.length === 0) {
        return { available: false, error: 'Guru tidak ditemukan' };
    }
    
    const guru = guruCheck[0];
    
    // System entities are always available
    if (guru.is_system_entity) {
        return { available: true, nama: guru.nama, isSystem: true };
    }
    
    // Check availability table
    const [availability] = await globalThis.dbPool.execute(
        `SELECT is_available, keterangan FROM guru_availability 
         WHERE guru_id = ? AND hari = ? AND tahun_ajaran = (
             SELECT setting_value FROM app_settings WHERE setting_key = 'TAHUN_AJARAN_AKTIF' LIMIT 1
         )`,
        [guruId, hari]
    );
    
    // If no record, assume available (default behavior)
    if (availability.length === 0) {
        return { available: true, nama: guru.nama };
    }
    
    const record = availability[0];
    if (!record.is_available) {
        return { 
            available: false, 
            nama: guru.nama,
            error: `${guru.nama} tidak tersedia pada hari ${hari}` + (record.keterangan ? ` (${record.keterangan})` : '')
        };
    }
    
    return { available: true, nama: guru.nama };
}

/**
 * Check if ruang is bound to specific mapel (Lab binding)
 * @param {number} ruangId - ID Ruang
 * @param {number} mapelId - ID Mapel
 * @returns {Promise<{valid: boolean, warning?: string}>}
 */
async function checkRuangMapelBinding(ruangId, mapelId) {
    if (!ruangId || !mapelId) return { valid: true };
    
    // Check if this room has exclusive bindings
    const [bindings] = await globalThis.dbPool.execute(
        `SELECT rmb.*, rk.kode_ruang, m.nama_mapel 
         FROM ruang_mapel_binding rmb
         JOIN ruang_kelas rk ON rmb.ruang_id = rk.id_ruang
         JOIN mapel m ON rmb.mapel_id = m.id_mapel
         WHERE rmb.ruang_id = ? AND rmb.is_exclusive = 1`,
        [ruangId]
    );
    
    if (bindings.length === 0) return { valid: true }; // No binding restrictions
    
    // Check if the mapel is in the allowed list
    const allowedMapelIds = bindings.map(b => b.mapel_id);
    if (!allowedMapelIds.includes(mapelId)) {
        const allowedMapels = bindings.map(b => b.nama_mapel).join(', ');
        return { 
            valid: false, 
            warning: `Ruang ${bindings[0].kode_ruang} hanya untuk mapel: ${allowedMapels}`
        };
    }
    
    return { valid: true };
}

/**
 * Validate all guru availability for a given day
 * @param {Array<number>} guruIds - Array of guru IDs
 * @param {string} hari - Day name
 * @returns {Promise<{allAvailable: boolean, unavailable?: Array}>}
 */
async function validateAllGuruAvailability(guruIds, hari) {
    const unavailable = [];
    
    for (const guruId of guruIds) {
        const result = await checkGuruAvailability(guruId, hari);
        if (!result.available) {
            unavailable.push({ guruId, nama: result.nama, error: result.error });
        }
    }
    
    return {
        allAvailable: unavailable.length === 0,
        unavailable
    };
}

/**
 * Skip conflict check for system entities
 * @param {number} guruId - ID Guru
 * @returns {Promise<boolean>} True if should skip conflict check
 */
async function isSystemEntity(guruId) {
    const [result] = await globalThis.dbPool.execute(
        `SELECT is_system_entity FROM guru WHERE id_guru = ?`,
        [guruId]
    );
    return result.length > 0 && result[0].is_system_entity === 1;
}

/**
 * Normalize guru IDs from various input formats to array
 */
function normalizeGuruIds(guru_ids, guru_id) {
    if (guru_ids && guru_ids.length > 0) return guru_ids;
    if (guru_id) return [guru_id];
    return [];
}

/**
 * Unified validation and processing logic for jadwal (Refactored to reduce complexity)
 */
async function processJadwalData(data, logger, { excludeId = null } = {}) {
    const { jam_mulai, jam_selesai, jenis_aktivitas = 'pelajaran', guru_ids, guru_id, kelas_id, mapel_id, hari, jam_ke, ruang_id } = data;

    // 1. Time Validation
    const timeValidation = validateTimeLogic(jam_mulai, jam_selesai);
    if (!timeValidation.valid) {
        logger.validationFail('time', { jam_mulai, jam_selesai }, timeValidation.error);
        return { success: false, error: timeValidation.error };
    }

    // 2. Normalize Guru IDs
    const finalGuruIds = normalizeGuruIds(guru_ids, guru_id);

    // 3. Required Fields
    const fieldValidation = validateJadwalFields(
        { kelas_id, mapel_id, hari, jam_ke, jam_mulai, jam_selesai },
        jenis_aktivitas,
        finalGuruIds
    );
    if (!fieldValidation.valid) {
        logger.validationFail('required_fields', null, fieldValidation.error);
        return { success: false, error: fieldValidation.error };
    }

    // 4. Guru Existence (only for pelajaran)
    if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
        const guruValidation = await validateGuruIdsExist(finalGuruIds);
        if (!guruValidation.valid) {
            logger.validationFail('guru_ids', guruValidation.invalidIds, guruValidation.error);
            return { success: false, error: guruValidation.error };
        }
    }

    // 5. Conflicts
    if (jenis_aktivitas === 'pelajaran') {
        const conflictResult = await checkAllScheduleConflicts({
            kelas_id, hari, jam_mulai, jam_selesai, ruang_id,
            guruIds: finalGuruIds,
            excludeJadwalId: excludeId
        });
        if (conflictResult.hasConflict) {
            logger.validationFail(`${conflictResult.type}_conflict`, null, conflictResult.error);
            return { success: false, error: conflictResult.error };
        }
    }

    return {
        success: true,
        finalGuruIds,
        finalMapelId: jenis_aktivitas === 'pelajaran' ? mapel_id : null,
        primaryGuruId: (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) ? finalGuruIds[0] : null,
        isMultiGuru: finalGuruIds.length > 1
    };
}

/**
 * Check all schedule conflicts (class, teacher, room) in one call
 * @returns {Object} { hasConflict: boolean, error?: string, type?: string }
 */
async function checkAllScheduleConflicts(params) {
    const { kelas_id, hari, jam_mulai, jam_selesai, ruang_id, guruIds, excludeJadwalId } = params;

    // Check class conflicts
    const classConflict = await checkClassConflicts(kelas_id, hari, jam_mulai, jam_selesai, excludeJadwalId);
    if (classConflict.hasConflict) {
        return { hasConflict: true, error: classConflict.error, type: 'class' };
    }

    // Check teacher conflicts
    if (guruIds && guruIds.length > 0) {
        const teacherConflict = await validateScheduleConflicts(guruIds, hari, jam_mulai, jam_selesai, excludeJadwalId);
        if (teacherConflict.hasConflict) {
            const { guruId, conflict } = teacherConflict;
            const errorMsg = `Guru dengan ID ${guruId} sudah memiliki jadwal bentrok: ${conflict.mata_pelajaran} di ${conflict.kelas} pada ${conflict.hari} ${conflict.jam_mulai}-${conflict.jam_selesai}`;
            return { hasConflict: true, error: errorMsg, type: 'teacher' };
        }
    }

    // Check room conflicts
    const roomConflict = await checkRoomConflicts(ruang_id, hari, jam_mulai, jam_selesai, excludeJadwalId);
    if (roomConflict.hasConflict) {
        return { hasConflict: true, error: roomConflict.error, type: 'room' };
    }

    return { hasConflict: false };
}

// ================================================
// CONTROLLER FUNCTIONS
// ================================================

// ================================================
// FUNGSI CONTROLLER (CONTROLLER FUNCTIONS)
// ================================================

/**
 * Mengambil semua jadwal pelajaran
 * GET /api/jadwal
 * @returns {Array} Daftar jadwal lengkap
 */
export const getJadwal = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetJadwal', {});

    try {
        const { query, params } = buildJadwalQuery('admin');
        const [rows] = await globalThis.dbPool.execute(query, params);

        log.success('GetJadwal', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('getJadwal', error);
        return sendDatabaseError(res, error, 'Gagal memuat jadwal');
    }
};

/**
 * Membuat jadwal pelajaran baru
 * POST /api/jadwal
 * @param {Object} req.body - Data jadwal (kelas_id, mapel_id, hari, jam, dll)
 * @returns {Object} Data jadwal yang baru dibuat
 */
export const createJadwal = async (req, res) => {
    const log = logger.withRequest(req, res);
    const {
        kelas_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai,
        jenis_aktivitas = 'pelajaran', is_absenable = true, keterangan_khusus = null
    } = req.body;

    log.requestStart('CreateJadwal', { kelas_id, mapel_id, hari, jam_ke });

    try {
        const result = await processJadwalData(req.body, log);
        if (!result.success) {
            return sendValidationError(res, result.error);
        }

        const { finalGuruIds, finalMapelId, primaryGuruId, isMultiGuru } = result;

        const [insertResult] = await globalThis.dbPool.execute(
            `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus, is_multi_guru)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?)`,
            [kelas_id, finalMapelId, primaryGuruId, ruang_id || null, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable ? 1 : 0, keterangan_khusus, isMultiGuru ? 1 : 0]
        );

        const jadwalId = insertResult.insertId;

        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            await insertJadwalGuru(jadwalId, finalGuruIds);
        }

        log.success('CreateJadwal', { jadwalId, hari, jam_ke, guruCount: finalGuruIds.length });
        return sendSuccessResponse(res, { id: jadwalId }, 'Jadwal berhasil ditambahkan', 201);
    } catch (error) {
        log.dbError('createJadwal', error);
        return sendDatabaseError(res, error, 'Gagal menambahkan jadwal');
    }
};

/**
 * Memperbarui jadwal pelajaran
 * PUT /api/jadwal/:id
 * @param {string} req.params.id - ID Jadwal
 * @param {Object} req.body - Data jadwal update
 * @returns {Object} Konfirmasi update
 */
export const updateJadwal = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const {
        kelas_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai,
        jenis_aktivitas = 'pelajaran', is_absenable = true, keterangan_khusus = null
    } = req.body;

    log.requestStart('UpdateJadwal', { id, kelas_id, hari, jam_ke });

    try {
        const result = await processJadwalData(req.body, log, { excludeId: id });
        if (!result.success) {
            return sendValidationError(res, result.error);
        }

        const { finalGuruIds, finalMapelId, primaryGuruId, isMultiGuru } = result;

        const [updateResult] = await globalThis.dbPool.execute(
            `UPDATE jadwal 
             SET kelas_id = ?, mapel_id = ?, guru_id = ?, ruang_id = ?, hari = ?, jam_ke = ?, jam_mulai = ?, jam_selesai = ?, jenis_aktivitas = ?, is_absenable = ?, keterangan_khusus = ?, is_multi_guru = ?
             WHERE id_jadwal = ?`,
            [kelas_id, finalMapelId, primaryGuruId, ruang_id || null, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable ? 1 : 0, keterangan_khusus, isMultiGuru ? 1 : 0, id]
        );

        if (updateResult.affectedRows === 0) {
            log.warn('UpdateJadwal - not found', { id });
            return sendNotFoundError(res, 'Jadwal tidak ditemukan');
        }

        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            await globalThis.dbPool.execute('DELETE FROM jadwal_guru WHERE jadwal_id = ?', [id]);
            
            // Using batch insert logic from helper logic used in createJadwal (manual implementation here for consistency with original or use insertJadwalGuru)
            // Original code used a specific block. Let's reuse insertJadwalGuru which handles validation inside.
            await insertJadwalGuru(id, finalGuruIds);
        }

        log.success('UpdateJadwal', { id, hari, jam_ke });
        return sendSuccessResponse(res, null, 'Jadwal berhasil diperbarui');
    } catch (error) {
        log.dbError('updateJadwal', error, { id });
        return sendDatabaseError(res, error, 'Gagal memperbarui jadwal');
    }
};

/**
 * Menghapus jadwal pelajaran
 * DELETE /api/jadwal/:id
 * @param {string} req.params.id - ID Jadwal
 * @returns {Object} Konfirmasi penghapusan
 */
export const deleteJadwal = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;

    log.requestStart('DeleteJadwal', { id });

    try {
        const [result] = await globalThis.dbPool.execute(
            'DELETE FROM jadwal WHERE id_jadwal = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            log.warn('DeleteJadwal - not found', { id });
            return sendNotFoundError(res, 'Jadwal tidak ditemukan');
        }

        log.success('DeleteJadwal', { id });
        return sendSuccessResponse(res, null, 'Jadwal berhasil dihapus');
    } catch (error) {
        log.dbError('deleteJadwal', error, { id });
        return sendDatabaseError(res, error, 'Gagal menghapus jadwal');
    }
};

// ================================================
// MANAJEMEN JADWAL MULTI-GURU
// ================================================

/**
 * Mengambil daftar guru dalam satu jadwal
 * GET /api/jadwal/:id/guru
 * @param {string} req.params.id - ID Jadwal
 * @returns {Array} Daftar guru yang mengajar di jadwal ini
 */
export const getJadwalGuru = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;

    log.requestStart('GetJadwalGuru', { id });

    try {
        const [rows] = await globalThis.dbPool.execute(`
            SELECT jg.id, jg.guru_id, jg.is_primary, g.nama, g.nip, g.mata_pelajaran
            FROM jadwal_guru jg
            JOIN guru g ON jg.guru_id = g.id_guru
            WHERE jg.jadwal_id = ?
            ORDER BY jg.is_primary DESC, g.nama ASC
        `, [id]);

        log.success('GetJadwalGuru', { count: rows.length, jadwalId: id });
        res.json(rows);
    } catch (error) {
        log.dbError('getJadwalGuru', error, { id });
        return sendDatabaseError(res, error, 'Gagal memuat guru jadwal');
    }
};

/**
 * Menambahkan guru ke jadwal (Team Teaching)
 * POST /api/jadwal/:id/guru
 * @param {string} req.params.id - ID Jadwal
 * @param {string} req.body.guru_id - ID Guru
 * @returns {Object} Konfirmasi
 */
export const addJadwalGuru = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { guru_id } = req.body;
    const jadwal_id = req.params.id;

    log.requestStart('AddJadwalGuru', { jadwal_id, guru_id });

    try {
        // Check if guru already in jadwal
        const [exists] = await globalThis.dbPool.execute(
            'SELECT id FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guru_id]
        );

        if (exists.length > 0) {
            log.validationFail('guru_id', guru_id, 'Already in schedule');
            return sendDuplicateError(res, 'Guru sudah ditambahkan ke jadwal ini');
        }

        // Insert guru
        await globalThis.dbPool.execute(
            'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, 0)',
            [jadwal_id, guru_id]
        );

        // Update is_multi_guru flag
        const [guruCount] = await globalThis.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
            [jadwal_id]
        );

        if (guruCount[0].count > 1) {
            await globalThis.dbPool.execute(
                'UPDATE jadwal SET is_multi_guru = 1 WHERE id_jadwal = ?',
                [jadwal_id]
            );
        }

        log.success('AddJadwalGuru', { jadwal_id, guru_id });
        return sendSuccessResponse(res, null, 'Guru berhasil ditambahkan ke jadwal');
    } catch (error) {
        log.dbError('addJadwalGuru', error, { jadwal_id, guru_id });
        return sendDatabaseError(res, error, 'Gagal menambahkan guru ke jadwal');
    }
};

/**
 * Menghapus guru dari jadwal
 * DELETE /api/jadwal/:id/guru/:guruId
 * @param {string} req.params.id - ID Jadwal
 * @param {string} req.params.guruId - ID Guru
 * @returns {Object} Konfirmasi
 */
export const removeJadwalGuru = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id: jadwal_id, guruId } = req.params;

    log.requestStart('RemoveJadwalGuru', { jadwal_id, guruId });

    try {
        // Check if primary guru
        const [guru] = await globalThis.dbPool.execute(
            'SELECT is_primary FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guruId]
        );

        if (guru.length > 0 && guru[0].is_primary === 1) {
            const [count] = await globalThis.dbPool.execute(
                'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
                [jadwal_id]
            );

            if (count[0].count === 1) {
                log.validationFail('primary_guru', guruId, 'Cannot remove last guru');
                return sendValidationError(res, 'Tidak bisa menghapus guru terakhir');
            }
        }

        // Delete guru
        await globalThis.dbPool.execute(
            'DELETE FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guruId]
        );

        // Update is_multi_guru flag
        const [guruCount] = await globalThis.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
            [jadwal_id]
        );

        if (guruCount[0].count <= 1) {
            await globalThis.dbPool.execute(
                'UPDATE jadwal SET is_multi_guru = 0 WHERE id_jadwal = ?',
                [jadwal_id]
            );
        }

        log.success('RemoveJadwalGuru', { jadwal_id, guruId });
        return sendSuccessResponse(res, null, 'Guru berhasil dihapus dari jadwal');
    } catch (error) {
        log.dbError('removeJadwalGuru', error, { jadwal_id, guruId });
        return sendDatabaseError(res, error, 'Gagal menghapus guru dari jadwal');
    }
};

// ================================================
// JADWAL HARI INI
// ================================================

/**
 * Mengambil jadwal hari ini untuk guru atau siswa
 * GET /api/jadwal/today
 * @returns {Array} Daftar jadwal hari ini
 */
export const getJadwalToday = async (req, res) => {
    const log = logger.withRequest(req, res);
    const todayDayName = getDayNameWIB();

    log.requestStart('GetJadwalToday', { role: req.user.role, day: todayDayName });

    try {
        let query = '';
        let params = [];

        if (req.user.role === 'guru') {
            const guruId = req.user.guru_id;
            if (!guruId) {
                log.validationFail('guru_id', null, 'Not found in token');
                return sendValidationError(res, 'guru_id tidak ditemukan pada token pengguna');
            }
            
            query = `
                SELECT j.*, k.nama_kelas, COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel
                FROM jadwal j
                JOIN kelas k ON j.kelas_id = k.id_kelas
                LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
                WHERE j.hari = ? AND j.status = 'aktif'
                  AND (j.guru_id = ? OR EXISTS (
                      SELECT 1 FROM jadwal_guru jg 
                      WHERE jg.jadwal_id = j.id_jadwal AND jg.guru_id = ?
                  ))
                ORDER BY j.jam_ke
            `;
            params = [todayDayName, guruId, guruId];
        } else if (req.user.role === 'siswa') {
            query = `
                SELECT j.*, COALESCE(g.nama, 'Sistem') as nama_guru, COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel
                FROM jadwal j
                LEFT JOIN guru g ON j.guru_id = g.id_guru
                LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
                WHERE j.kelas_id = ? AND j.hari = ? AND j.status = 'aktif'
                ORDER BY j.jam_ke
            `;
            params = [req.user.kelas_id, todayDayName];
        }

        const [rows] = await globalThis.dbPool.execute(query, params);

        log.success('GetJadwalToday', { count: rows.length, role: req.user.role, day: todayDayName });
        return sendSuccessResponse(res, rows);

    } catch (error) {
        log.dbError('getJadwalToday', error, { role: req.user.role });
        return sendDatabaseError(res, error, 'Gagal memuat jadwal hari ini');
    }
};

// ================================================
// BULK OPERATIONS
// ================================================

/**
 * Bulk create jadwal - Tambah jadwal yang sama ke beberapa kelas
 * POST /api/jadwal/bulk
 * @param {Array<number>} req.body.kelas_ids - Array ID kelas target
 * @param {number} req.body.mapel_id - ID Mata Pelajaran
 * @param {Array<number>} req.body.guru_ids - Array ID Guru
 * @param {string} req.body.hari - Hari
 * @param {string} req.body.jam_mulai - Jam mulai
 * @param {string} req.body.jam_selesai - Jam selesai
 * @param {number} req.body.jam_ke - Jam ke
 * @returns {Object} Hasil bulk insert
 */
export const bulkCreateJadwal = async (req, res) => {
    const log = logger.withRequest(req, res);
    const {
        kelas_ids,
        mapel_id,
        guru_ids = [],
        ruang_id,
        hari,
        jam_mulai,
        jam_selesai,
        jam_ke,
        jenis_aktivitas = 'pelajaran',
        is_absenable = true,
        keterangan_khusus = null
    } = req.body;

    log.requestStart('BulkCreateJadwal', { kelas_ids, mapel_id, hari, jam_ke });

    // Validation
    if (!kelas_ids || !Array.isArray(kelas_ids) || kelas_ids.length === 0) {
        return sendValidationError(res, 'Minimal satu kelas harus dipilih');
    }

    // Time validation
    const timeValidation = validateTimeLogic(jam_mulai, jam_selesai);
    if (!timeValidation.valid) {
        return sendValidationError(res, timeValidation.error);
    }

    // Guru validation
    const finalGuruIds = normalizeGuruIds(guru_ids, null);
    if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length === 0) {
        return sendValidationError(res, 'Minimal satu guru harus dipilih untuk jadwal pelajaran');
    }

    if (jenis_aktivitas === 'pelajaran') {
        const guruValidation = await validateGuruIdsExist(finalGuruIds);
        if (!guruValidation.valid) {
            return sendValidationError(res, guruValidation.error);
        }
    }

    try {
        const results = { success: [], failed: [] };
        const primaryGuruId = finalGuruIds.length > 0 ? finalGuruIds[0] : null;
        const isMultiGuru = finalGuruIds.length > 1;
        const finalMapelId = jenis_aktivitas === 'pelajaran' ? mapel_id : null;
        const finalRuangId = ruang_id === 'none' || !ruang_id ? null : ruang_id;

        for (const kelas_id of kelas_ids) {
            try {
                // Check conflicts for this class
                if (jenis_aktivitas === 'pelajaran') {
                    const conflictResult = await checkAllScheduleConflicts({
                        kelas_id,
                        hari,
                        jam_mulai,
                        jam_selesai,
                        ruang_id: finalRuangId,
                        guruIds: finalGuruIds,
                        excludeJadwalId: null
                    });

                    if (conflictResult.hasConflict) {
                        // Get class name for error message
                        const [[kelasInfo]] = await globalThis.dbPool.execute(
                            'SELECT nama_kelas FROM kelas WHERE id_kelas = ?', [kelas_id]
                        );
                        results.failed.push({
                            kelas_id,
                            kelas_name: kelasInfo?.nama_kelas || `ID ${kelas_id}`,
                            error: conflictResult.error
                        });
                        continue;
                    }
                }

                // Insert jadwal
                const [insertResult] = await globalThis.dbPool.execute(
                    `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus, is_multi_guru)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?)`,
                    [kelas_id, finalMapelId, primaryGuruId, finalRuangId, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable ? 1 : 0, keterangan_khusus, isMultiGuru ? 1 : 0]
                );

                const jadwalId = insertResult.insertId;

                // Insert guru relations
                if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
                    await insertJadwalGuru(jadwalId, finalGuruIds);
                }

                results.success.push({ kelas_id, jadwal_id: jadwalId });
            } catch (error) {
                results.failed.push({ kelas_id, error: error.message });
            }
        }

        log.success('BulkCreateJadwal', { 
            success: results.success.length, 
            failed: results.failed.length 
        });

        return sendSuccessResponse(res, results, 
            `Berhasil menambahkan ${results.success.length} jadwal, ${results.failed.length} gagal`
        );
    } catch (error) {
        log.dbError('bulkCreateJadwal', error);
        return sendDatabaseError(res, error, 'Gagal menambahkan jadwal massal');
    }
};

/**
 * Clone jadwal - Salin semua jadwal dari satu kelas ke kelas lain
 * POST /api/jadwal/clone
 * @param {number} req.body.source_kelas_id - ID kelas sumber
 * @param {Array<number>} req.body.target_kelas_ids - Array ID kelas target
 * @param {boolean} req.body.include_guru - Salin guru atau tidak
 * @param {boolean} req.body.include_ruang - Salin ruang atau tidak
 * @returns {Object} Hasil clone
 */
export const cloneJadwal = async (req, res) => {
    const log = logger.withRequest(req, res);
    const {
        source_kelas_id,
        target_kelas_ids,
        include_guru = true,
        include_ruang = true
    } = req.body;

    log.requestStart('CloneJadwal', { source_kelas_id, target_kelas_ids });

    // Validation
    if (!source_kelas_id) {
        return sendValidationError(res, 'Kelas sumber harus dipilih');
    }
    if (!target_kelas_ids || !Array.isArray(target_kelas_ids) || target_kelas_ids.length === 0) {
        return sendValidationError(res, 'Minimal satu kelas target harus dipilih');
    }

    try {
        // Get source schedules
        const [sourceSchedules] = await globalThis.dbPool.execute(`
            SELECT j.*, GROUP_CONCAT(jg.guru_id) as all_guru_ids
            FROM jadwal j
            LEFT JOIN jadwal_guru jg ON j.id_jadwal = jg.jadwal_id
            WHERE j.kelas_id = ? AND j.status = 'aktif'
            GROUP BY j.id_jadwal
        `, [source_kelas_id]);

        if (sourceSchedules.length === 0) {
            return sendValidationError(res, 'Kelas sumber tidak memiliki jadwal');
        }

        const results = { success: [], failed: [], total_created: 0 };

        for (const target_kelas_id of target_kelas_ids) {
            // Skip if target is same as source
            if (target_kelas_id === source_kelas_id) continue;

            let classSuccess = 0;
            let classFailed = 0;

            for (const schedule of sourceSchedules) {
                try {
                    const newRuangId = include_ruang ? schedule.ruang_id : null;
                    const newGuruId = include_guru ? schedule.guru_id : null;
                    const isMultiGuru = include_guru ? schedule.is_multi_guru : 0;

                    // Insert cloned jadwal
                    const [insertResult] = await globalThis.dbPool.execute(
                        `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus, is_multi_guru)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?)`,
                        [target_kelas_id, schedule.mapel_id, newGuruId, newRuangId, schedule.hari, schedule.jam_ke, schedule.jam_mulai, schedule.jam_selesai, schedule.jenis_aktivitas, schedule.is_absenable, schedule.keterangan_khusus, isMultiGuru]
                    );

                    const newJadwalId = insertResult.insertId;

                    // Clone guru relations if include_guru
                    if (include_guru && schedule.all_guru_ids) {
                        const guruIds = schedule.all_guru_ids.split(',').map(Number).filter(id => id > 0);
                        if (guruIds.length > 0) {
                            await insertJadwalGuru(newJadwalId, guruIds);
                        }
                    }

                    classSuccess++;
                    results.total_created++;
                } catch (error) {
                    classFailed++;
                    log.warn('CloneJadwal - schedule failed', { 
                        source_jadwal_id: schedule.id_jadwal, 
                        target_kelas_id, 
                        error: error.message 
                    });
                }
            }

            // Get class name
            const [[kelasInfo]] = await globalThis.dbPool.execute(
                'SELECT nama_kelas FROM kelas WHERE id_kelas = ?', [target_kelas_id]
            );

            if (classFailed === 0) {
                results.success.push({ 
                    kelas_id: target_kelas_id, 
                    kelas_name: kelasInfo?.nama_kelas,
                    count: classSuccess 
                });
            } else {
                results.failed.push({ 
                    kelas_id: target_kelas_id, 
                    kelas_name: kelasInfo?.nama_kelas,
                    success: classSuccess, 
                    failed: classFailed 
                });
            }
        }

        log.success('CloneJadwal', { 
            total_created: results.total_created,
            success_classes: results.success.length,
            failed_classes: results.failed.length
        });

        return sendSuccessResponse(res, results, 
            `Berhasil menyalin ${results.total_created} jadwal ke ${results.success.length} kelas`
        );
    } catch (error) {
        log.dbError('cloneJadwal', error);
        return sendDatabaseError(res, error, 'Gagal menyalin jadwal');
    }
};

/**
 * Check conflicts for bulk operations
 * POST /api/jadwal/check-conflicts
 * @param {Array<number>} req.body.kelas_ids - Array ID kelas
 * @param {Array<number>} req.body.guru_ids - Array ID guru
 * @param {string} req.body.hari - Hari
 * @param {string} req.body.jam_mulai - Jam mulai
 * @param {string} req.body.jam_selesai - Jam selesai
 * @returns {Object} List of conflicts
 */
export const checkBulkConflicts = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kelas_ids, guru_ids = [], hari, jam_mulai, jam_selesai } = req.body;

    log.requestStart('CheckBulkConflicts', { kelas_ids, guru_ids, hari });

    try {
        const conflicts = [];

        for (const kelas_id of kelas_ids) {
            // Check class conflict
            const classConflict = await checkClassConflicts(kelas_id, hari, jam_mulai, jam_selesai);
            if (classConflict.hasConflict) {
                const [[kelasInfo]] = await globalThis.dbPool.execute(
                    'SELECT nama_kelas FROM kelas WHERE id_kelas = ?', [kelas_id]
                );
                conflicts.push({
                    kelas_id,
                    kelas_name: kelasInfo?.nama_kelas || `ID ${kelas_id}`,
                    conflict_type: 'class',
                    message: classConflict.error
                });
            }
        }

        // Check teacher conflicts (only once, applies to all classes)
        if (guru_ids && guru_ids.length > 0) {
            const teacherConflict = await validateScheduleConflicts(guru_ids, hari, jam_mulai, jam_selesai);
            if (teacherConflict.hasConflict) {
                const { guruId, conflict } = teacherConflict;
                const [[guruInfo]] = await globalThis.dbPool.execute(
                    'SELECT nama FROM guru WHERE id_guru = ?', [guruId]
                );
                conflicts.push({
                    kelas_id: null,
                    kelas_name: 'Semua kelas',
                    conflict_type: 'teacher',
                    message: `Guru ${guruInfo?.nama || guruId} sudah memiliki jadwal di ${conflict.kelas} pada jam tersebut`
                });
            }
        }

    log.success('CheckBulkConflicts', { conflict_count: conflicts.length });
        return sendSuccessResponse(res, { conflicts });
    } catch (error) {
        log.dbError('checkBulkConflicts', error);
        return sendDatabaseError(res, error, 'Gagal memeriksa konflik');
    }
};

/**
 * Import master schedule from CSV
 * POST /api/jadwal/import-master
 * @param {Object} req.file - Uploaded CSV file
 * @returns {Object} Import results
 */
export const importMasterSchedule = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('ImportMasterSchedule');

    if (!req.file) {
        return sendValidationError(res, 'File CSV wajib diupload');
    }

    try {
        const result = await processMasterScheduleImport(req.file.path);
        log.success('ImportMasterSchedule', result);
        return sendSuccessResponse(res, result, 'Jadwal master berhasil diimport');
    } catch (error) {
        log.error('ImportMasterSchedule', error);
        return sendServerError(res, error, 'Gagal mengimport jadwal master');
    }
};

// ================================================
// NEW API: Jam Pelajaran (Time Slots)
// ================================================

/**
 * Get jam pelajaran for a specific day or all days
 * GET /api/jadwal/jam-pelajaran?hari=Senin&tahun_ajaran=2025/2026
 */
export const getJamPelajaran = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { hari, tahun_ajaran = '2025/2026' } = req.query;

    log.requestStart('GetJamPelajaran', { hari, tahun_ajaran });

    try {
        let query = `SELECT * FROM jam_pelajaran WHERE tahun_ajaran = ?`;
        const params = [tahun_ajaran];

        if (hari) {
            query += ` AND hari = ?`;
            params.push(hari);
        }

        query += ` ORDER BY FIELD(hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'), jam_ke`;

        const [rows] = await globalThis.dbPool.execute(query, params);

        log.success('GetJamPelajaran', { count: rows.length });
        return sendSuccessResponse(res, rows);
    } catch (error) {
        log.dbError('getJamPelajaran', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data jam pelajaran');
    }
};

// ================================================
// NEW API: Guru Availability
// ================================================

/**
 * Get guru availability for schedule planning
 * GET /api/jadwal/guru-availability?hari=Senin
 */
export const getGuruAvailabilityList = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { hari, tahun_ajaran = '2025/2026' } = req.query;

    log.requestStart('GetGuruAvailability', { hari, tahun_ajaran });

    try {
        let query = `
            SELECT g.id_guru, g.nama, g.nip, g.is_system_entity,
                   COALESCE(ga.is_available, 1) as is_available,
                   ga.keterangan
            FROM guru g
            LEFT JOIN guru_availability ga ON g.id_guru = ga.guru_id 
                AND ga.tahun_ajaran = ?
                ${hari ? 'AND ga.hari = ?' : ''}
            WHERE g.status = 'aktif'
            ORDER BY g.is_system_entity DESC, g.nama
        `;

        const params = hari ? [tahun_ajaran, hari] : [tahun_ajaran];
        const [rows] = await globalThis.dbPool.execute(query, params);

        log.success('GetGuruAvailability', { count: rows.length });
        return sendSuccessResponse(res, rows);
    } catch (error) {
        log.dbError('getGuruAvailabilityList', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data ketersediaan guru');
    }
};

/**
 * Check single guru availability for a day
 * POST /api/jadwal/check-guru-availability
 */
export const checkGuruAvailabilityApi = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { guru_id, hari } = req.body;

    log.requestStart('CheckGuruAvailability', { guru_id, hari });

    if (!guru_id || !hari) {
        return sendValidationError(res, 'guru_id dan hari wajib diisi');
    }

    try {
        const result = await checkGuruAvailability(guru_id, hari);
        log.success('CheckGuruAvailability', result);
        return sendSuccessResponse(res, result);
    } catch (error) {
        log.dbError('checkGuruAvailabilityApi', error);
        return sendDatabaseError(res, error, 'Gagal memeriksa ketersediaan guru');
    }
};

// ================================================
// NEW API: App Settings
// ================================================

/**
 * Get app settings by category or key
 * GET /api/settings?category=schedule&key=EMPTY_SLOT_POLICY
 */
export const getAppSettings = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { category, key } = req.query;

    log.requestStart('GetAppSettings', { category, key });

    try {
        let query = `SELECT * FROM app_settings WHERE 1=1`;
        const params = [];

        if (category) {
            query += ` AND category = ?`;
            params.push(category);
        }
        if (key) {
            query += ` AND setting_key = ?`;
            params.push(key);
        }

        const [rows] = await globalThis.dbPool.execute(query, params);

        // Parse JSON values
        const parsed = rows.map(row => ({
            ...row,
            setting_value: typeof row.setting_value === 'string' 
                ? JSON.parse(row.setting_value) 
                : row.setting_value
        }));

        log.success('GetAppSettings', { count: parsed.length });
        return sendSuccessResponse(res, parsed);
    } catch (error) {
        log.dbError('getAppSettings', error);
        return sendDatabaseError(res, error, 'Gagal mengambil pengaturan');
    }
};

// ================================================
// NEW API: Bulk Update Guru Availability
// ================================================

/**
 * Bulk update guru availability
 * POST /api/jadwal/guru-availability/bulk
 */
export const bulkUpdateGuruAvailability = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { updates } = req.body;

    log.requestStart('BulkUpdateGuruAvailability', { count: updates?.length });

    if (!updates || !Array.isArray(updates)) {
        return sendValidationError(res, 'updates array wajib diisi');
    }

    try {
        let updatedCount = 0;

        for (const update of updates) {
            const { guru_id, hari, is_available, keterangan, tahun_ajaran = '2025/2026' } = update;

            if (!guru_id || !hari) continue;

            await globalThis.dbPool.execute(`
                INSERT INTO guru_availability (guru_id, hari, is_available, keterangan, tahun_ajaran)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    is_available = VALUES(is_available),
                    keterangan = VALUES(keterangan)
            `, [guru_id, hari, is_available ? 1 : 0, keterangan || null, tahun_ajaran]);

            updatedCount++;
        }

        log.success('BulkUpdateGuruAvailability', { updated: updatedCount });
        return sendSuccessResponse(res, { updated: updatedCount });
    } catch (error) {
        log.dbError('bulkUpdateGuruAvailability', error);
        return sendDatabaseError(res, error, 'Gagal update ketersediaan guru');
    }
};

// ================================================
// NEW API: Matrix Schedule (Grid Editor)
// ================================================

/**
 * Get schedule data in matrix format for grid editor
 * GET /api/jadwal/matrix?hari=Senin&tingkat=XII&jurusan=rpl
 */
export const getMatrixSchedule = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { hari = 'Senin', tingkat, jurusan, tahun_ajaran = '2025/2026' } = req.query;

    log.requestStart('GetMatrixSchedule', { hari, tingkat, jurusan });

    try {
        // 1. Get jam slots for the day
        const [jamSlots] = await globalThis.dbPool.execute(`
            SELECT jam_ke, jenis, label, jam_mulai, jam_selesai, durasi_menit
            FROM jam_pelajaran
            WHERE hari = ? AND tahun_ajaran = ?
            ORDER BY jam_ke
        `, [hari, tahun_ajaran]);

        // 2. Get filtered classes
        let kelasQuery = `SELECT id_kelas as id, nama_kelas, tingkat FROM kelas WHERE status = 'aktif'`;
        const kelasParams = [];

        if (tingkat) {
            kelasQuery += ` AND tingkat = ?`;
            kelasParams.push(tingkat);
        }
        if (jurusan) {
            kelasQuery += ` AND LOWER(nama_kelas) LIKE ?`;
            kelasParams.push(`%${jurusan.toLowerCase()}%`);
        }

        kelasQuery += ` ORDER BY tingkat, nama_kelas`;
        const [kelasList] = await globalThis.dbPool.execute(kelasQuery, kelasParams);

        // 3. Get schedules for the day
        const kelasIds = kelasList.map(k => k.id);
        if (kelasIds.length === 0) {
            return sendSuccessResponse(res, { hari, jam_slots: jamSlots, rows: [] });
        }

        const placeholders = kelasIds.map(() => '?').join(',');
        const [schedules] = await globalThis.dbPool.execute(`
            SELECT 
                j.id_jadwal as id, j.kelas_id, j.jam_ke,
                j.mapel_id, j.guru_id, j.ruang_id,
                j.jenis_aktivitas, j.keterangan_khusus,
                m.kode_mapel, m.nama_mapel,
                g.nama as nama_guru,
                SUBSTRING(g.nama, 1, 4) as kode_guru,
                rk.kode_ruang
            FROM jadwal j
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            WHERE j.kelas_id IN (${placeholders}) 
              AND j.hari = ? 
              AND j.status = 'aktif'
        `, [...kelasIds, hari]);

        // 4. Build matrix structure
        const scheduleMap = {};
        for (const s of schedules) {
            if (!scheduleMap[s.kelas_id]) scheduleMap[s.kelas_id] = {};
            scheduleMap[s.kelas_id][s.jam_ke] = {
                id: s.id,
                mapel_id: s.mapel_id,
                guru_id: s.guru_id,
                ruang_id: s.ruang_id,
                kode_mapel: s.kode_mapel || s.keterangan_khusus,
                nama_mapel: s.nama_mapel || s.keterangan_khusus,
                kode_guru: s.kode_guru,
                nama_guru: s.nama_guru,
                kode_ruang: s.kode_ruang,
                jenis_aktivitas: s.jenis_aktivitas
            };
        }

        const rows = kelasList.map(kelas => ({
            kelas_id: kelas.id,
            nama_kelas: kelas.nama_kelas,
            tingkat: kelas.tingkat,
            cells: scheduleMap[kelas.id] || {}
        }));

        log.success('GetMatrixSchedule', { kelas_count: rows.length, schedule_count: schedules.length });
        return sendSuccessResponse(res, {
            hari,
            tahun_ajaran,
            jam_slots: jamSlots,
            rows
        });
    } catch (error) {
        log.dbError('getMatrixSchedule', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data matrix jadwal');
    }
};

/**
 * Batch update schedules from grid editor
 * POST /api/jadwal/matrix/update
 */
export const updateMatrixSchedule = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { hari, changes } = req.body;

    log.requestStart('UpdateMatrixSchedule', { hari, change_count: changes?.length });

    if (!hari || !changes || !Array.isArray(changes)) {
        return sendValidationError(res, 'hari dan changes array wajib diisi');
    }

    try {
        const results = { created: 0, updated: 0, deleted: 0, errors: [] };

        // Pre-fetch jam info (optimization)
        const [jamSlots] = await globalThis.dbPool.execute(
            'SELECT jam_ke, jam_mulai, jam_selesai FROM jam_pelajaran WHERE hari = ?',
            [hari]
        );
        const jamMap = jamSlots.reduce((map, slot) => {
            map[slot.jam_ke] = { start: slot.jam_mulai, end: slot.jam_selesai };
            return map;
        }, {});

        // Process changes in transaction-like loop
        for (const change of changes) {
            const { kelas_id, jam_ke, action } = change;

            if (!kelas_id || jam_ke === undefined) {
                results.errors.push({ change, error: 'kelas_id dan jam_ke wajib' });
                continue;
            }

            try {
                if (action === 'delete') {
                    await deleteSchedule(kelas_id, hari, jam_ke);
                    results.deleted++;
                } else {
                    const result = await upsertSchedule(change, hari, jamMap[jam_ke]);
                    if (result.type === 'created') results.created++;
                    else if (result.type === 'updated') results.updated++;
                }
            } catch (err) {
                results.errors.push({ change, error: err.message });
            }
        }

        log.success('UpdateMatrixSchedule', results);
        return sendSuccessResponse(res, results);
    } catch (error) {
        log.dbError('updateMatrixSchedule', error);
        return sendDatabaseError(res, error, 'Gagal update matrix jadwal');
    }
};

// --- Helper Functions for UpdateMatrixSchedule ---

async function deleteSchedule(kelas_id, hari, jam_ke) {
    await globalThis.dbPool.execute(
        'DELETE FROM jadwal WHERE kelas_id = ? AND hari = ? AND jam_ke = ?',
        [kelas_id, hari, jam_ke]
    );
}

async function upsertSchedule(change, hari, jamInfo) {
    const { kelas_id, jam_ke, mapel_id, guru_id, ruang_id, jenis_aktivitas = 'pelajaran' } = change;
    const defaultTime = { start: '07:00', end: '07:45' };
    const time = jamInfo || defaultTime;

    // Check existing
    const [existing] = await globalThis.dbPool.execute(
        'SELECT id_jadwal FROM jadwal WHERE kelas_id = ? AND hari = ? AND jam_ke = ?',
        [kelas_id, hari, jam_ke]
    );

    if (existing.length > 0) {
        await globalThis.dbPool.execute(
            `UPDATE jadwal SET mapel_id = ?, guru_id = ?, ruang_id = ?, jenis_aktivitas = ?, jam_mulai = ?, jam_selesai = ?
             WHERE id_jadwal = ?`,
            [mapel_id, guru_id, ruang_id, jenis_aktivitas, time.start, time.end, existing[0].id_jadwal]
        );
        return { type: 'updated' };
    } else {
        await globalThis.dbPool.execute(
            `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?)`,
            [kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, time.start, time.end, jenis_aktivitas]
        );
        return { type: 'created' };
    }
}

/**
 * Check conflicts for a guru on a specific day/time
 * GET /api/jadwal/matrix/check-conflict?guru_id=1&hari=Senin&jam_ke=2&exclude_kelas_id=5
 */
export const checkMatrixConflict = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { guru_id, hari, jam_ke, exclude_kelas_id } = req.query;

    if (!guru_id || !hari || jam_ke === undefined) {
        return sendValidationError(res, 'guru_id, hari, dan jam_ke wajib diisi');
    }

    try {
        // Check if guru is system entity
        const isSystem = await isSystemEntity(Number(guru_id));
        if (isSystem) {
            return sendSuccessResponse(res, { has_conflict: false, is_system: true });
        }

        // Check for conflicts
        let query = `
            SELECT j.id_jadwal, k.nama_kelas, m.nama_mapel
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            WHERE j.guru_id = ? AND j.hari = ? AND j.jam_ke = ? AND j.status = 'aktif'
        `;
        const params = [guru_id, hari, jam_ke];

        if (exclude_kelas_id) {
            query += ` AND j.kelas_id != ?`;
            params.push(exclude_kelas_id);
        }

        const [conflicts] = await globalThis.dbPool.execute(query, params);

        log.success('CheckMatrixConflict', { has_conflict: conflicts.length > 0 });
        return sendSuccessResponse(res, {
            has_conflict: conflicts.length > 0,
            conflicts: conflicts.map(c => ({
                jadwal_id: c.id_jadwal,
                kelas: c.nama_kelas,
                mapel: c.nama_mapel
            }))
        });
    } catch (error) {
        log.dbError('checkMatrixConflict', error);
        return sendDatabaseError(res, error, 'Gagal cek konflik');
    }
};
