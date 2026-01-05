/**
 * Jadwal Controller
 * Menangani manajemen jadwal, dukungan multi-guru, dan query jadwal harian
 */

import dotenv from 'dotenv';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { getDayNameWIB } from '../utils/timeUtils.js';
import { createLogger } from '../utils/logger.js';

dotenv.config();

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
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
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

        const [conflicts] = await global.dbPool.execute(conflictQuery, params);

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
        const [rows] = await global.dbPool.execute(query, params);

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
        kelas_id, mapel_id, guru_id, guru_ids, ruang_id, hari, jam_ke, jam_mulai, jam_selesai,
        jenis_aktivitas = 'pelajaran', is_absenable = true, keterangan_khusus = null
    } = req.body;

    log.requestStart('CreateJadwal', { kelas_id, mapel_id, hari, jam_ke });

    try {
        // Validasi format jam 24 jam
        const timeValidation = validateTimeLogic(jam_mulai, jam_selesai);
        if (!timeValidation.valid) {
            log.validationFail('time', { jam_mulai, jam_selesai }, timeValidation.error);
            return sendValidationError(res, timeValidation.error);
        }

        const finalGuruIds = guru_ids && guru_ids.length > 0 ? guru_ids : (guru_id ? [guru_id] : []);

        log.debug('Multi-Guru validation', { finalGuruIds, guru_ids_original: guru_ids });

        // Validasi guru_ids sebelum insert (untuk aktivitas pelajaran)
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            const validGuruIds = finalGuruIds.filter(id => id && !isNaN(id) && id > 0);

            if (validGuruIds.length === 0) {
                log.validationFail('guru_ids', finalGuruIds, 'No valid guru selected');
                return sendValidationError(res, 'Tidak ada guru yang valid dipilih');
            }

            // Validasi apakah guru_ids benar-benar ada di database
            const placeholders = validGuruIds.map(() => '?').join(',');
            const [existingGurus] = await global.dbPool.execute(
                `SELECT id_guru, nama FROM guru WHERE id_guru IN (${placeholders})`,
                validGuruIds
            );

            if (existingGurus.length !== validGuruIds.length) {
                const existingIds = existingGurus.map(g => g.id_guru);
                const invalidIds = validGuruIds.filter(id => !existingIds.includes(id));
                log.validationFail('guru_ids', invalidIds, 'Guru not found');
                return sendValidationError(res, `Guru dengan ID ${invalidIds.join(', ')} tidak ditemukan di database`);
            }
        }

        // Validation berbeda untuk aktivitas khusus
        if (jenis_aktivitas === 'pelajaran') {
            if (!kelas_id || !mapel_id || !hari || !jam_ke || !jam_mulai || !jam_selesai) {
                log.validationFail('required_fields', null, 'Missing required fields');
                return sendValidationError(res, 'Semua field wajib diisi untuk jadwal pelajaran');
            }
            if (finalGuruIds.length === 0) {
                log.validationFail('guru', null, 'Guru required');
                return sendValidationError(res, 'Minimal satu guru harus dipilih untuk jadwal pelajaran');
            }
        } else {
            if (!kelas_id || !hari || !jam_mulai || !jam_selesai) {
                log.validationFail('required_fields', null, 'Missing required fields');
                return sendValidationError(res, 'Kelas, hari, dan waktu wajib diisi');
            }
        }

        const finalMapelId = jenis_aktivitas === 'pelajaran' ? mapel_id : null;
        let primaryGuruId = null;
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            const validGuruIds = finalGuruIds.filter(id => id && !isNaN(id) && id > 0);
            if (validGuruIds.length > 0) {
                primaryGuruId = validGuruIds[0];
            }
        }

        // Check conflicts hanya untuk aktivitas yang membutuhkan ruang/guru
        if (jenis_aktivitas === 'pelajaran') {
            // Check class conflicts
            const [classConflicts] = await global.dbPool.execute(
                `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                 WHERE kelas_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran'`,
                [kelas_id, hari]
            );

            for (const conflict of classConflicts) {
                if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                    log.validationFail('class_conflict', { hari, jam_mulai, jam_selesai }, 'Class already scheduled');
                    return sendValidationError(res, `Kelas sudah memiliki jadwal pelajaran pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`);
                }
            }

            // Validate teacher schedule conflicts
            if (finalGuruIds.length > 0) {
                const conflictValidation = await validateScheduleConflicts(finalGuruIds, hari, jam_mulai, jam_selesai);

                if (conflictValidation.hasConflict) {
                    const { guruId, conflict } = conflictValidation;
                    log.validationFail('teacher_conflict', { guruId, conflict }, 'Teacher schedule conflict');
                    return sendValidationError(res, `Guru dengan ID ${guruId} sudah memiliki jadwal bentrok: ${conflict.mata_pelajaran} di ${conflict.kelas} pada ${conflict.hari} ${conflict.jam_mulai}-${conflict.jam_selesai}`);
                }
            }

            // Check room conflicts
            if (ruang_id) {
                const [roomConflicts] = await global.dbPool.execute(
                    `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                     WHERE ruang_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran'`,
                    [ruang_id, hari]
                );

                for (const conflict of roomConflicts) {
                    if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                        log.validationFail('room_conflict', { ruang_id, hari }, 'Room already in use');
                        return sendValidationError(res, `Ruang sudah digunakan pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`);
                    }
                }
            }
        }

        // Insert jadwal dengan guru utama
        const [result] = await global.dbPool.execute(
            `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus, is_multi_guru)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?)`,
            [kelas_id, finalMapelId, primaryGuruId, ruang_id || null, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable ? 1 : 0, keterangan_khusus, finalGuruIds.length > 1 ? 1 : 0]
        );

        const jadwalId = result.insertId;

        // Insert semua guru ke jadwal_guru (batch insert for performance)
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            const validGuruIds = finalGuruIds.filter(id => id && !isNaN(id) && id > 0);
            if (validGuruIds.length > 0) {
                const values = validGuruIds.map((id, i) => [jadwalId, id, i === 0 ? 1 : 0]);
                const placeholders = values.map(() => '(?, ?, ?)').join(', ');
                const flatValues = values.flat();
                await global.dbPool.execute(
                    `INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES ${placeholders}`,
                    flatValues
                );
            }
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
        kelas_id, mapel_id, guru_id, guru_ids, ruang_id, hari, jam_ke, jam_mulai, jam_selesai,
        jenis_aktivitas = 'pelajaran', is_absenable = true, keterangan_khusus = null
    } = req.body;

    log.requestStart('UpdateJadwal', { id, kelas_id, hari, jam_ke });

    try {
        // Validasi format jam 24 jam
        const timeValidation = validateTimeLogic(jam_mulai, jam_selesai);
        if (!timeValidation.valid) {
            log.validationFail('time', { jam_mulai, jam_selesai }, timeValidation.error);
            return sendValidationError(res, timeValidation.error);
        }

        const finalGuruIds = guru_ids && guru_ids.length > 0 ? guru_ids : (guru_id ? [guru_id] : []);
        const isMultiGuru = finalGuruIds.length > 1;

        // Validation berbeda untuk aktivitas khusus
        if (jenis_aktivitas === 'pelajaran') {
            if (!kelas_id || !mapel_id || !hari || !jam_ke || !jam_mulai || !jam_selesai) {
                log.validationFail('required_fields', null, 'Missing required fields');
                return sendValidationError(res, 'Semua field wajib diisi untuk jadwal pelajaran');
            }
            if (finalGuruIds.length === 0) {
                log.validationFail('guru', null, 'Guru required');
                return sendValidationError(res, 'Minimal satu guru harus dipilih untuk jadwal pelajaran');
            }
        } else {
            if (!kelas_id || !hari || !jam_mulai || !jam_selesai) {
                log.validationFail('required_fields', null, 'Missing required fields');
                return sendValidationError(res, 'Kelas, hari, dan waktu wajib diisi');
            }
        }

        const finalMapelId = jenis_aktivitas === 'pelajaran' ? mapel_id : null;
        const finalGuruId = jenis_aktivitas === 'pelajaran' ? (finalGuruIds.length > 0 ? finalGuruIds[0] : null) : null;

        // Check conflicts hanya untuk aktivitas yang membutuhkan ruang/guru
        if (jenis_aktivitas === 'pelajaran') {
            // Check class conflicts (excluding current schedule)
            const [classConflicts] = await global.dbPool.execute(
                `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                 WHERE kelas_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran' AND id_jadwal != ?`,
                [kelas_id, hari, id]
            );

            for (const conflict of classConflicts) {
                if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                    log.validationFail('class_conflict', { hari }, 'Class already scheduled');
                    return sendValidationError(res, `Kelas sudah memiliki jadwal pelajaran pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`);
                }
            }

            // Validate teacher schedule conflicts (excluding current schedule)
            if (finalGuruIds.length > 0) {
                const conflictValidation = await validateScheduleConflicts(finalGuruIds, hari, jam_mulai, jam_selesai, id);

                if (conflictValidation.hasConflict) {
                    const { guruId, conflict } = conflictValidation;
                    log.validationFail('teacher_conflict', { guruId }, 'Teacher conflict');
                    return sendValidationError(res, `Guru dengan ID ${guruId} sudah memiliki jadwal bentrok: ${conflict.mata_pelajaran} di ${conflict.kelas} pada ${conflict.hari} ${conflict.jam_mulai}-${conflict.jam_selesai}`);
                }
            }

            // Check room conflicts
            if (ruang_id) {
                const [roomConflicts] = await global.dbPool.execute(
                    `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                     WHERE ruang_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran' AND id_jadwal != ?`,
                    [ruang_id, hari, id]
                );

                for (const conflict of roomConflicts) {
                    if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                        log.validationFail('room_conflict', { ruang_id }, 'Room conflict');
                        return sendValidationError(res, `Ruang sudah digunakan pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`);
                    }
                }
            }
        }

        const [result] = await global.dbPool.execute(
            `UPDATE jadwal 
             SET kelas_id = ?, mapel_id = ?, guru_id = ?, ruang_id = ?, hari = ?, jam_ke = ?, jam_mulai = ?, jam_selesai = ?, jenis_aktivitas = ?, is_absenable = ?, keterangan_khusus = ?, is_multi_guru = ?
             WHERE id_jadwal = ?`,
            [kelas_id, finalMapelId, finalGuruId, ruang_id || null, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable ? 1 : 0, keterangan_khusus, isMultiGuru ? 1 : 0, id]
        );

        if (result.affectedRows === 0) {
            log.warn('UpdateJadwal - not found', { id });
            return sendNotFoundError(res, 'Jadwal tidak ditemukan');
        }

        // Update jadwal_guru table untuk multi-guru schedules (batch insert for performance)
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            // Hapus relasi lama
            await global.dbPool.execute('DELETE FROM jadwal_guru WHERE jadwal_id = ?', [id]);

            // Tambahkan relasi baru dengan batch insert
            const validGuruIds = finalGuruIds.filter(gid => gid && !isNaN(gid) && gid > 0);
            if (validGuruIds.length > 0) {
                const values = validGuruIds.map((gid, i) => [id, gid, i === 0 ? 1 : 0]);
                const placeholders = values.map(() => '(?, ?, ?)').join(', ');
                const flatValues = values.flat();
                await global.dbPool.execute(
                    `INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES ${placeholders}`,
                    flatValues
                );
            }
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
        const [result] = await global.dbPool.execute(
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
        const [rows] = await global.dbPool.execute(`
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
        const [exists] = await global.dbPool.execute(
            'SELECT id FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guru_id]
        );

        if (exists.length > 0) {
            log.validationFail('guru_id', guru_id, 'Already in schedule');
            return sendDuplicateError(res, 'Guru sudah ditambahkan ke jadwal ini');
        }

        // Insert guru
        await global.dbPool.execute(
            'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, 0)',
            [jadwal_id, guru_id]
        );

        // Update is_multi_guru flag
        const [guruCount] = await global.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
            [jadwal_id]
        );

        if (guruCount[0].count > 1) {
            await global.dbPool.execute(
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
        const [guru] = await global.dbPool.execute(
            'SELECT is_primary FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guruId]
        );

        if (guru.length > 0 && guru[0].is_primary === 1) {
            const [count] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
                [jadwal_id]
            );

            if (count[0].count === 1) {
                log.validationFail('primary_guru', guruId, 'Cannot remove last guru');
                return sendValidationError(res, 'Tidak bisa menghapus guru terakhir');
            }
        }

        // Delete guru
        await global.dbPool.execute(
            'DELETE FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guruId]
        );

        // Update is_multi_guru flag
        const [guruCount] = await global.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
            [jadwal_id]
        );

        if (guruCount[0].count <= 1) {
            await global.dbPool.execute(
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

        const [rows] = await global.dbPool.execute(query, params);

        log.success('GetJadwalToday', { count: rows.length, role: req.user.role, day: todayDayName });
        return sendSuccessResponse(res, rows);

    } catch (error) {
        log.dbError('getJadwalToday', error, { role: req.user.role });
        return sendDatabaseError(res, error, 'Gagal memuat jadwal hari ini');
    }
};
