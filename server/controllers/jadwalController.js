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
 * Validate required fields for jadwal based on activity type
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
// MATRIX GRID FUNCTIONS (For Schedule Grid Editor)
// ================================================

// 7. Helper: Basic data fetchers for matrix
const fetchJamSlotsByDay = async () => {
    const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const [allJamSlots] = await globalThis.dbPool.execute(
        `SELECT hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label
         FROM jam_pelajaran 
         ORDER BY FIELD(hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'), jam_ke`
    );

    const jamSlotsByDay = {};
    for (const hari of HARI_LIST) {
        jamSlotsByDay[hari] = allJamSlots.filter(s => s.hari === hari);
    }
    return { jamSlotsByDay, HARI_LIST, hasData: allJamSlots.length > 0 };
};

const fetchClassesByTingkat = async (tingkat) => {
    let kelasQuery = 'SELECT id_kelas, nama_kelas FROM kelas WHERE status = "aktif"';
    const kelasParams = [];
    if (tingkat && tingkat !== 'all') {
        kelasQuery += ' AND nama_kelas LIKE ?';
        kelasParams.push(`${tingkat}%`);
    }
    kelasQuery += ' ORDER BY nama_kelas';
    const [classes] = await globalThis.dbPool.execute(kelasQuery, kelasParams);
    return classes;
};

const fetchAllSchedules = async () => {
    const [allSchedules] = await globalThis.dbPool.execute(
        `SELECT 
            j.id_jadwal, j.kelas_id, j.hari, j.jam_ke, 
            j.mapel_id, j.guru_id, j.ruang_id,
            j.jenis_aktivitas, j.keterangan_khusus,
            COALESCE(m.kode_mapel, LEFT(j.keterangan_khusus, 6)) as kode_mapel,
            COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
            m.warna as mapel_color,
            COALESCE(g.kode_guru, 'SYS') as kode_guru,
            COALESCE(g.nama, 'Sistem') as nama_guru,
            COALESCE(rk.kode_ruang, '') as kode_ruang,
            rk.nama_ruang
         FROM jadwal j
         LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
         LEFT JOIN guru g ON j.guru_id = g.id_guru
         LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
         WHERE j.status = 'aktif'`
    );
    return allSchedules;
};

const fetchMultiGuruMap = async () => {
    const [multiGuruData] = await globalThis.dbPool.execute(
        `SELECT jg.jadwal_id, jg.guru_id, g.nama as nama_guru, g.kode_guru
         FROM jadwal_guru jg
         JOIN guru g ON jg.guru_id = g.id_guru
         WHERE jg.is_primary = 0`
    );

    const multiGuruMap = {};
    for (const mg of multiGuruData) {
        if (!multiGuruMap[mg.jadwal_id]) multiGuruMap[mg.jadwal_id] = [];
        multiGuruMap[mg.jadwal_id].push({
            guru_id: mg.guru_id,
            nama_guru: mg.nama_guru,
            kode_guru: mg.kode_guru
        });
    }
    return multiGuruMap;
};

// 8. Helper: Build single schedule cell
const buildCellData = (sched, multiGuruMap) => {
    // Build guru list (primary + additional)
    const guruList = [{
        guru_id: sched.guru_id,
        nama_guru: sched.nama_guru,
        kode_guru: sched.kode_guru
    }];
    
    // Add multi-guru if exists
    if (multiGuruMap[sched.id_jadwal]) {
        guruList.push(...multiGuruMap[sched.id_jadwal]);
    }

    return {
        id: sched.id_jadwal,
        mapel: sched.kode_mapel || sched.nama_mapel,
        mapel_id: sched.mapel_id,
        nama_mapel: sched.nama_mapel,
        ruang: sched.kode_ruang,
        ruang_id: sched.ruang_id,
        nama_ruang: sched.nama_ruang,
        guru: guruList.map(g => g.kode_guru || g.nama_guru),
        guru_detail: guruList,
        color: sched.mapel_color || '#E5E7EB',
        jenis: sched.jenis_aktivitas
    };
};

const buildSpecialCell = (slot) => ({
    id: null,
    mapel: slot.label || slot.jenis.toUpperCase(),
    ruang: slot.jenis === 'istirahat' ? 'DZUHUR' : '',
    guru: [],
    color: slot.jenis === 'istirahat' ? '#FFA500' : '#87CEEB',
    jenis: slot.jenis,
    isSpecial: true
});

// 9. Helper: Build schedule for a single class
const buildClassSchedule = (kelas, HARI_LIST, jamSlotsByDay, allSchedules, multiGuruMap) => {
    const schedule = {};
    const tingkatMatch = kelas.nama_kelas.match(/^(X{1,3}I?)/);

    for (const hari of HARI_LIST) {
        schedule[hari] = {};
        const daySlots = jamSlotsByDay[hari] || [];

        for (const slot of daySlots) {
            const sched = allSchedules.find(s => 
                s.kelas_id === kelas.id_kelas && 
                s.hari === hari && 
                s.jam_ke === slot.jam_ke
            );

            if (sched) {
                schedule[hari][slot.jam_ke] = buildCellData(sched, multiGuruMap);
            } else if (slot.jenis !== 'pelajaran') {
                schedule[hari][slot.jam_ke] = buildSpecialCell(slot);
            } else {
                schedule[hari][slot.jam_ke] = null;
            }
        }
    }

    return {
        kelas_id: kelas.id_kelas,
        nama_kelas: kelas.nama_kelas,
        tingkat: tingkatMatch ? tingkatMatch[1] : '',
        schedule
    };
};

/**
 * Get schedule matrix data for Grid Editor
 * GET /api/admin/jadwal/matrix?hari=Senin&tingkat=XII
 * @returns {Object} { data: { hari, jam_slots, rows } }
 */
export const getScheduleMatrix = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { tingkat } = req.query;

    log.requestStart('GetScheduleMatrix', { tingkat });

    try {
        // 1. Fetch Basic Data
        const { jamSlotsByDay, HARI_LIST, hasData } = await fetchJamSlotsByDay();

        if (!hasData) {
            log.warn('No jam_pelajaran found');
            return sendSuccessResponse(res, {
                days: HARI_LIST,
                jamSlots: {},
                classes: [],
                message: 'Silakan seed tabel jam_pelajaran terlebih dahulu'
            });
        }

        // 2. Fetch Classes, Schedules, and Guru Data in Parallel
        const [classes, allSchedules, multiGuruMap] = await Promise.all([
            fetchClassesByTingkat(tingkat),
            fetchAllSchedules(),
            fetchMultiGuruMap()
        ]);

        // 3. Build Class Schedules
        const classData = classes.map(kelas => 
            buildClassSchedule(kelas, HARI_LIST, jamSlotsByDay, allSchedules, multiGuruMap)
        );

        // 4. Prepare Response
        const jamSlotsResponse = {};
        for (const hari of HARI_LIST) {
            jamSlotsResponse[hari] = (jamSlotsByDay[hari] || []).map(s => ({
                jam_ke: s.jam_ke,
                jam_mulai: s.jam_mulai,
                jam_selesai: s.jam_selesai,
                jenis: s.jenis,
                label: s.label
            }));
        }

        log.success('GetScheduleMatrix', { 
            classCount: classData.length,
            days: HARI_LIST.length
        });

        return sendSuccessResponse(res, {
            days: HARI_LIST,
            jamSlots: jamSlotsResponse,
            classes: classData
        });

    } catch (error) {
        log.dbError('getScheduleMatrix', error);
        return sendDatabaseError(res, error, 'Gagal memuat matrix jadwal');
    }
};
/**
 * Batch update multiple schedule cells
 * POST /api/admin/jadwal/matrix/batch
 * @param {Object} req.body - { hari, changes: [{ kelas_id, jam_ke, mapel_id, guru_id, ruang_id, action }] }
 */
export const batchUpdateMatrix = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { hari, changes } = req.body;

    log.requestStart('BatchUpdateMatrix', { hari, changesCount: changes?.length });

    if (!hari || !Array.isArray(changes) || changes.length === 0) {
        return sendValidationError(res, 'hari dan changes array diperlukan');
    }

    const connection = await globalThis.dbPool.getConnection();
    
    try {
        await connection.beginTransaction();

        let created = 0;
        let updated = 0;
        let deleted = 0;

        for (const change of changes) {
            const { kelas_id, jam_ke, mapel_id, guru_id, ruang_id, action } = change;

            // Check if schedule exists
            const [existing] = await connection.execute(
                'SELECT id_jadwal FROM jadwal WHERE kelas_id = ? AND hari = ? AND jam_ke = ? AND status = "aktif"',
                [kelas_id, hari, jam_ke]
            );

            // Get jam times from jam_pelajaran
            const [jamSlot] = await connection.execute(
                'SELECT jam_mulai, jam_selesai FROM jam_pelajaran WHERE hari = ? AND jam_ke = ? LIMIT 1',
                [hari, jam_ke]
            );

            const jam_mulai = jamSlot[0]?.jam_mulai || '07:00';
            const jam_selesai = jamSlot[0]?.jam_selesai || '07:45';

            if (action === 'delete') {
                if (existing.length > 0) {
                    await connection.execute(
                        'UPDATE jadwal SET status = "nonaktif" WHERE id_jadwal = ?',
                        [existing[0].id_jadwal]
                    );
                    deleted++;
                }
            } else if (existing.length > 0) {
                // Update existing
                await connection.execute(
                    `UPDATE jadwal 
                     SET mapel_id = ?, guru_id = ?, ruang_id = ?, jam_mulai = ?, jam_selesai = ?
                     WHERE id_jadwal = ?`,
                    [mapel_id, guru_id, ruang_id, jam_mulai, jam_selesai, existing[0].id_jadwal]
                );
                updated++;
            } else {
                // Create new
                await connection.execute(
                    `INSERT INTO jadwal 
                     (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', 'pelajaran')`,
                    [kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai]
                );
                created++;
            }
        }

        await connection.commit();

        log.success('BatchUpdateMatrix', { created, updated, deleted });
        return sendSuccessResponse(res, { created, updated, deleted }, 'Batch update berhasil');

    } catch (error) {
        await connection.rollback();
        log.dbError('batchUpdateMatrix', error);
        return sendDatabaseError(res, error, 'Gagal melakukan batch update');
    } finally {
        connection.release();
    }
};

/**
 * Get jam pelajaran configuration
 * GET /api/admin/jadwal/jam-pelajaran
 */
export const getJamPelajaran = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { tahun_ajaran = '2025/2026' } = req.query;

    log.requestStart('GetJamPelajaran', { tahun_ajaran });

    try {
        const [rows] = await globalThis.dbPool.execute(
            `SELECT id, hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label
             FROM jam_pelajaran 
             WHERE tahun_ajaran = ?
             ORDER BY FIELD(hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'), jam_ke`,
            [tahun_ajaran]
        );

        // Group by hari
        const grouped = {};
        for (const row of rows) {
            if (!grouped[row.hari]) grouped[row.hari] = [];
            grouped[row.hari].push(row);
        }

        log.success('GetJamPelajaran', { count: rows.length });
        return sendSuccessResponse(res, grouped);

    } catch (error) {
        log.dbError('getJamPelajaran', error);
        return sendDatabaseError(res, error, 'Gagal memuat jam pelajaran');
    }
};

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
