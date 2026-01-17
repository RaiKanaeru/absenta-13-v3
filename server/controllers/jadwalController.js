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
            j.jam_ke ASC
    `;

    return { query: baseQuery + whereClause + orderBy, params };
}
const checkGuruConflict = async (db, { guruIds, hari, sqlTime, qParams, excludeJadwalId }) => {
    if (!guruIds || guruIds.length === 0) return null;
    
    const guruPlaceholders = guruIds.map(() => '?').join(',');
    const guruQuery = `
        SELECT j.id_jadwal, k.nama_kelas, g.nama as nama_guru
        FROM jadwal j
        JOIN kelas k ON j.kelas_id = k.id_kelas
        LEFT JOIN guru g ON j.guru_id = g.id_guru
        WHERE j.status = 'aktif'
        AND j.hari = ?
        ${sqlTime}
        AND (
            j.guru_id IN (${guruPlaceholders})
            OR EXISTS (
                SELECT 1 FROM jadwal_guru jg 
                WHERE jg.jadwal_id = j.id_jadwal 
                AND jg.guru_id IN (${guruPlaceholders})
            )
        )
        ${excludeJadwalId ? `AND j.id_jadwal != ${excludeJadwalId}` : ''}
        LIMIT 1
    `;

    const [guruConflicts] = await db.execute(guruQuery, qParams);
    
    if (guruConflicts.length > 0) {
        const conflict = guruConflicts[0];
        return { 
            hasConflict: true, 
            error: `Guru ${conflict.nama_guru} bentrok dengan kelas ${conflict.nama_kelas}` 
        };
    }
    return null;
};

const checkRoomConflict = async (db, { ruang_id, hari, sqlTime, timeParams, excludeJadwalId }) => {
    if (!ruang_id) return null;

    const ruangQuery = `
        SELECT k.nama_kelas, rk.nama_ruang
        FROM jadwal j
        JOIN kelas k ON j.kelas_id = k.id_kelas
        JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
        WHERE j.status = 'aktif'
        AND j.hari = ?
        ${sqlTime}
        AND j.ruang_id = ?
        ${excludeJadwalId ? `AND j.id_jadwal != ${excludeJadwalId}` : ''}
        LIMIT 1
    `;
    
    const [ruangConflicts] = await db.execute(ruangQuery, [...timeParams, ruang_id]);
    
    if (ruangConflicts.length > 0) {
        return { 
            hasConflict: true, 
            error: `Ruang ${ruangConflicts[0].nama_ruang} sedang dipakai kelas ${ruangConflicts[0].nama_kelas}` 
        };
    }
    return null;
};

const checkClassConflict = async (db, { kelas_id, hari, sqlTime, timeParams, excludeJadwalId }) => {
    if (!kelas_id) return null;

    const kelasQuery = `
        SELECT m.nama_mapel
        FROM jadwal j
        LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
        WHERE j.status = 'aktif'
        AND j.hari = ?
        ${sqlTime}
        AND j.kelas_id = ?
        ${excludeJadwalId ? `AND j.id_jadwal != ${excludeJadwalId}` : ''}
        LIMIT 1
    `;
    
    const [kelasConflicts] = await db.execute(kelasQuery, [...timeParams, kelas_id]);
    
    if (kelasConflicts.length > 0) {
            return { 
            hasConflict: true, 
            error: `Kelas ini sudah ada jadwal mapel ${kelasConflicts[0].nama_mapel || 'Lain'}` 
        };
    }
    return null;
};

/**
 * Validasi konflik jadwal (Guru, Ruang, Kelas)
 * @param {Object} params - Parameter validasi
 * @returns {Promise<{hasConflict: boolean, error: string | null}>}
 */
const checkAllScheduleConflicts = async ({
    kelas_id,
    hari,
    jam_mulai,
    jam_selesai,
    ruang_id,
    guruIds,
    excludeJadwalId,
    connection 
}) => {
    if (!hari || !jam_mulai || !jam_selesai) {
        return { hasConflict: true, error: "Data waktu tidak lengkap" };
    }

    const db = connection || globalThis.dbPool;
    // Overlap: (start1 < end2) AND (end1 > start2)
    // SQL: j.jam_mulai < ? (newEnd) AND j.jam_selesai > ? (newStart)
    const timeOverlapCondition = `(jam_mulai < ? AND jam_selesai > ?)`;
    const sqlTime = `AND ${timeOverlapCondition}`; 
    const timeParams = [hari, jam_selesai, jam_mulai]; 

    // 1. Cek Konflik Guru
    if (guruIds && guruIds.length > 0) {
        const qParams = [hari, jam_selesai, jam_mulai, ...guruIds, ...guruIds];
        const conflict = await checkGuruConflict(db, { guruIds, hari, sqlTime, qParams, excludeJadwalId });
        if (conflict) return conflict;
    }

    // 2. Cek Konflik Ruang
    const roomConflict = await checkRoomConflict(db, { ruang_id, hari, sqlTime, timeParams, excludeJadwalId });
    if (roomConflict) return roomConflict;

    // 3. Cek Konflik Kelas
    const classConflict = await checkClassConflict(db, { kelas_id, hari, sqlTime, timeParams, excludeJadwalId });
    if (classConflict) return classConflict;

    return { hasConflict: false };
};

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

// 9. Helper: Index schedules for O(1) lookups
const buildScheduleIndex = (allSchedules) => {
    const index = new Map();
    for (const sched of allSchedules) {
        const key = `${sched.kelas_id}|${sched.hari}|${sched.jam_ke}`;
        index.set(key, sched);
    }
    return index;
};

// 9. Helper: Build schedule for a single class
const buildClassSchedule = (kelas, HARI_LIST, jamSlotsByDay, scheduleIndex, multiGuruMap) => {
    const schedule = {};
    const tingkatMatch = kelas.nama_kelas.match(/^(X{1,3}I?)/);

    for (const hari of HARI_LIST) {
        schedule[hari] = {};
        const daySlots = jamSlotsByDay[hari] || [];

        for (const slot of daySlots) {
            const sched = scheduleIndex.get(`${kelas.id_kelas}|${hari}|${slot.jam_ke}`);

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

// 10. Helper: Normalize and merge matrix changes by cell
const normalizeMatrixChanges = (changes, fallbackHari) => {
    const merged = new Map();

    for (const change of changes) {
        const kelasId = Number(change.kelas_id);
        const jamKe = Number(change.jam_ke);
        const hari = change.hari || fallbackHari;

        if (!Number.isFinite(kelasId) || !Number.isFinite(jamKe) || !hari) {
            continue;
        }

        const key = `${kelasId}|${hari}|${jamKe}`;
        const existing = merged.get(key) || { kelas_id: kelasId, hari, jam_ke: jamKe };

        if (change.action === 'delete') {
            existing.action = 'delete';
        }

        if (change.mapel_id !== undefined) existing.mapel_id = change.mapel_id;
        if (change.guru_id !== undefined) existing.guru_id = change.guru_id;
        if (change.ruang_id !== undefined) existing.ruang_id = change.ruang_id;

        merged.set(key, existing);
    }

    return Array.from(merged.values());
};

// 11. Helper: Ensure primary guru row matches jadwal.guru_id
const ensurePrimaryGuru = async (connection, jadwalId, guruId) => {
    const [rows] = await connection.execute(
        'SELECT id, guru_id, is_primary FROM jadwal_guru WHERE jadwal_id = ?',
        [jadwalId]
    );

    const primary = rows.find(row => row.is_primary === 1);
    if (primary) {
        if (primary.guru_id !== guruId) {
            const existingRow = rows.find(row => row.guru_id === guruId);
            if (existingRow) {
                await connection.execute(
                    'UPDATE jadwal_guru SET is_primary = 0 WHERE id = ?',
                    [primary.id]
                );
                await connection.execute(
                    'UPDATE jadwal_guru SET is_primary = 1 WHERE id = ?',
                    [existingRow.id]
                );
            } else {
                await connection.execute(
                    'UPDATE jadwal_guru SET guru_id = ? WHERE id = ?',
                    [guruId, primary.id]
                );
            }
        }
        return;
    }

    await connection.execute(
        'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, 1)',
        [jadwalId, guruId]
    );
};

const DEFAULT_TAHUN_AJARAN = '2025/2026';

const normalizeId = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
        return null;
    }
    return num;
};

const normalizeBoolean = (value, fallback) => {
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    if (typeof value === 'string') {
        return value === 'true' || value === '1';
    }
    return fallback;
};

const normalizeGuruIds = (payload) => {
    const rawIds = Array.isArray(payload.guru_ids) ? payload.guru_ids : [];
    let primaryGuruId = normalizeId(payload.guru_id) || normalizeId(payload.current_guru_id);
    const uniqueIds = [];

    if (primaryGuruId) {
        uniqueIds.push(primaryGuruId);
    }

    for (const id of rawIds) {
        const normalized = normalizeId(id);
        if (normalized && !uniqueIds.includes(normalized)) {
            uniqueIds.push(normalized);
        }
    }

    if (!primaryGuruId && uniqueIds.length > 0) {
        primaryGuruId = uniqueIds[0];
    }

    return { primaryGuruId, guruIds: uniqueIds };
};

const validateKelasExists = async (kelasId, connection = globalThis.dbPool) => {
    const [rows] = await connection.execute(
        'SELECT id_kelas FROM kelas WHERE id_kelas = ? AND status = "aktif"',
        [kelasId]
    );
    return rows.length > 0;
};

const validateMapelExists = async (mapelId, connection = globalThis.dbPool) => {
    const [rows] = await connection.execute(
        'SELECT id_mapel FROM mapel WHERE id_mapel = ? AND status = "aktif"',
        [mapelId]
    );
    return rows.length > 0;
};

const validateRuangExists = async (ruangId, connection = globalThis.dbPool) => {
    const [rows] = await connection.execute(
        'SELECT id_ruang FROM ruang_kelas WHERE id_ruang = ? AND status = "aktif"',
        [ruangId]
    );
    return rows.length > 0;
};

const validateGuruIdsExist = async (guruIds, connection = globalThis.dbPool) => {
    if (!guruIds || guruIds.length === 0) {
        return { valid: true };
    }

    const placeholders = guruIds.map(() => '?').join(',');
    const [rows] = await connection.execute(
        `SELECT id_guru FROM guru WHERE id_guru IN (${placeholders})`,
        guruIds
    );

    const foundIds = new Set(rows.map(row => row.id_guru));
    const missingIds = guruIds.filter(id => !foundIds.has(id));

    if (missingIds.length > 0) {
        return { valid: false, error: `Guru tidak ditemukan: ${missingIds.join(', ')}` };
    }

    return { valid: true };
};



const processJadwalData = async (payload, log, options = {}) => {
    const {
        kelas_id,
        mapel_id,
        ruang_id,
        hari,
        jam_ke,
        jam_mulai,
        jam_selesai,
        jenis_aktivitas = 'pelajaran'
    } = payload;

    const kelasId = normalizeId(kelas_id);
    const jamKe = Number(jam_ke);
    const normalizedHari = hari ? String(hari).trim() : '';

    if (!kelasId || !normalizedHari || !Number.isFinite(jamKe) || jam_mulai === undefined || jam_selesai === undefined) {
        log.validationFail('jadwal', payload, 'Missing required fields');
        return { success: false, error: 'Semua field wajib diisi' };
    }

    const timeValidation = validateTimeLogic(String(jam_mulai), String(jam_selesai));
    if (!timeValidation.valid) {
        log.validationFail('time', { jam_mulai, jam_selesai }, timeValidation.error);
        return { success: false, error: timeValidation.error };
    }

    const { primaryGuruId, guruIds } = normalizeGuruIds(payload);
    const finalMapelId = normalizeId(mapel_id);
    const finalRuangId = normalizeId(ruang_id);
    const isPelajaran = jenis_aktivitas === 'pelajaran';
    const isAbsenable = normalizeBoolean(payload.is_absenable, isPelajaran);

    if (isPelajaran && (!finalMapelId || guruIds.length === 0)) {
        log.validationFail('pelajaran', payload, 'Mapel and guru required');
        return { success: false, error: 'Mapel dan guru wajib diisi' };
    }

    const kelasExists = await validateKelasExists(kelasId);
    if (!kelasExists) {
        return { success: false, error: 'Kelas tidak ditemukan' };
    }

    if (finalMapelId) {
        const mapelExists = await validateMapelExists(finalMapelId);
        if (!mapelExists) {
            return { success: false, error: 'Mata pelajaran tidak ditemukan' };
        }
    }

    if (finalRuangId) {
        const ruangExists = await validateRuangExists(finalRuangId);
        if (!ruangExists) {
            return { success: false, error: 'Ruang tidak ditemukan' };
        }
    }

    const guruValidation = await validateGuruIdsExist(guruIds);
    if (!guruValidation.valid) {
        return { success: false, error: guruValidation.error };
    }

    const conflictCheck = await checkAllScheduleConflicts({
        kelas_id: kelasId,
        hari: normalizedHari,
        jam_mulai,
        jam_selesai,
        ruang_id: finalRuangId,
        guruIds,
        excludeJadwalId: options.excludeId || null
    });

    if (conflictCheck.hasConflict) {
        return { success: false, error: conflictCheck.error };
    }

    const primaryId = primaryGuruId || guruIds[0] || null;

    return {
        success: true,
        finalGuruIds: guruIds,
        finalMapelId,
        primaryGuruId: primaryId,
        isMultiGuru: guruIds.length > 1,
        normalized: {
            kelas_id: kelasId,
            ruang_id: finalRuangId,
            hari: normalizedHari,
            jam_ke: jamKe,
            jam_mulai: String(jam_mulai),
            jam_selesai: String(jam_selesai),
            jenis_aktivitas,
            is_absenable: isAbsenable,
            keterangan_khusus: payload.keterangan_khusus || null
        }
    };
};

const insertJadwalGuru = async (jadwalId, guruIds, connection = globalThis.dbPool) => {
    const uniqueIds = Array.from(new Set(guruIds || []))
        .map(id => normalizeId(id))
        .filter(Boolean);
    if (uniqueIds.length === 0) return;

    let isPrimary = true;
    for (const guruId of uniqueIds) {
        await connection.execute(
            'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, ?)',
            [jadwalId, guruId, isPrimary ? 1 : 0]
        );
        isPrimary = false;
    }
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
        const scheduleIndex = buildScheduleIndex(allSchedules);
        const classData = classes.map(kelas =>
            buildClassSchedule(kelas, HARI_LIST, jamSlotsByDay, scheduleIndex, multiGuruMap)
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

    const normalizedChanges = normalizeMatrixChanges(changes, hari);
    if (normalizedChanges.length === 0) {
        return sendValidationError(res, 'Tidak ada perubahan jadwal yang valid');
    }

    const connection = await globalThis.dbPool.getConnection();
    
    try {
        await connection.beginTransaction();

        const [jamSlots] = await connection.execute(
            'SELECT jam_ke, jam_mulai, jam_selesai FROM jam_pelajaran WHERE hari = ?',
            [hari]
        );
        const jamSlotMap = new Map(jamSlots.map(slot => [slot.jam_ke, slot]));

        let created = 0;
        let updated = 0;
        let deleted = 0;

        for (const change of normalizedChanges) {
            const { kelas_id, jam_ke, mapel_id, guru_id, ruang_id, action } = change;

            // Check if schedule exists
            const [existing] = await connection.execute(
                'SELECT id_jadwal, mapel_id, guru_id, ruang_id FROM jadwal WHERE kelas_id = ? AND hari = ? AND jam_ke = ? AND status = "aktif"',
                [kelas_id, hari, jam_ke]
            );

            if (action === 'delete') {
                if (existing.length > 0) {
                    await connection.execute(
                        'UPDATE jadwal SET status = "tidak_aktif" WHERE id_jadwal = ?',
                        [existing[0].id_jadwal]
                    );
                    deleted++;
                }
                continue;
            }

            const jamSlot = jamSlotMap.get(jam_ke);
            if (!jamSlot) {
                await connection.rollback();
                return sendValidationError(
                    res,
                    `Jam pelajaran untuk ${hari} jam ${jam_ke} tidak ditemukan`
                );
            }

            const existingRow = existing[0];
            const finalMapelId = mapel_id ?? existingRow?.mapel_id ?? null;
            const finalGuruId = guru_id ?? existingRow?.guru_id ?? null;
            const finalRuangId = ruang_id ?? existingRow?.ruang_id ?? null;

            if (!finalMapelId || !finalGuruId) {
                await connection.rollback();
                return sendValidationError(
                    res,
                    `Mapel dan guru wajib diisi untuk ${hari} jam ${jam_ke} kelas ${kelas_id}`
                );
            }

            // ⚡ PHASE 10 Strict Validation: Check for conflicts before saving
            // Use transaction connection to detect conflicts with committed data AND self-checks if isolation works
            const conflictCheck = await checkAllScheduleConflicts({
                kelas_id,
                hari,
                jam_mulai: jamSlot.jam_mulai,
                jam_selesai: jamSlot.jam_selesai,
                ruang_id: finalRuangId,
                guruIds: [finalGuruId],
                excludeJadwalId: existing.length > 0 ? existing[0].id_jadwal : null,
                connection // Pass transaction connection
            });

            if (conflictCheck.hasConflict) {
                await connection.rollback();
                return sendValidationError(res, conflictCheck.error);
            }

            if (existing.length > 0) {
                // Update existing
                await connection.execute(
                    `UPDATE jadwal 
                     SET mapel_id = ?, guru_id = ?, ruang_id = ?, jam_mulai = ?, jam_selesai = ?
                     WHERE id_jadwal = ?`,
                    [finalMapelId, finalGuruId, finalRuangId, jamSlot.jam_mulai, jamSlot.jam_selesai, existing[0].id_jadwal]
                );
                await ensurePrimaryGuru(connection, existing[0].id_jadwal, finalGuruId);
                updated++;
            } else {
                // Create new
                const [insertResult] = await connection.execute(
                    `INSERT INTO jadwal 
                     (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', 'pelajaran')`,
                    [kelas_id, finalMapelId, finalGuruId, finalRuangId, hari, jam_ke, jamSlot.jam_mulai, jamSlot.jam_selesai]
                );
                await ensurePrimaryGuru(connection, insertResult.insertId, finalGuruId);
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
 * Check schedule conflicts for bulk operations
 * POST /api/admin/jadwal/check-conflicts
 */
export const checkScheduleConflicts = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kelas_ids, guru_ids, hari, jam_mulai, jam_selesai, ruang_id, tahun_ajaran } = req.body;

    log.requestStart('CheckScheduleConflicts', { kelasCount: kelas_ids?.length, hari });

    if (!hari || jam_mulai === undefined || jam_selesai === undefined) {
        return sendValidationError(res, 'Hari dan waktu wajib diisi');
    }
    if (!Array.isArray(kelas_ids) || kelas_ids.length === 0) {
        return sendValidationError(res, 'Minimal satu kelas harus dipilih');
    }

    const timeValidation = validateTimeLogic(String(jam_mulai), String(jam_selesai));
    if (!timeValidation.valid) {
        return sendValidationError(res, timeValidation.error);
    }

    const classIds = Array.from(new Set(kelas_ids.map(normalizeId).filter(Boolean)));
    if (classIds.length === 0) {
        return sendValidationError(res, 'Kelas tidak valid');
    }

    const placeholders = classIds.map(() => '?').join(',');
    const [kelasRows] = await globalThis.dbPool.execute(
        `SELECT id_kelas, nama_kelas FROM kelas WHERE id_kelas IN (${placeholders})`,
        classIds
    );

    const kelasMap = new Map(kelasRows.map(row => [row.id_kelas, row.nama_kelas]));
    const missingIds = classIds.filter(id => !kelasMap.has(id));
    if (missingIds.length > 0) {
        return sendValidationError(res, 'Kelas tidak ditemukan', { missing: missingIds });
    }

    const { guruIds } = normalizeGuruIds({ guru_ids });
    const finalRuangId = normalizeId(ruang_id);

    const conflicts = [];
    for (const kelasId of classIds) {
        const conflictCheck = await checkAllScheduleConflicts({
            kelas_id: kelasId,
            hari: String(hari),
            jam_mulai: String(jam_mulai),
            jam_selesai: String(jam_selesai),
            ruang_id: finalRuangId,
            guruIds,
            collectConflicts: true,
            tahun_ajaran: tahun_ajaran || DEFAULT_TAHUN_AJARAN
        });

        if (conflictCheck.conflicts?.length) {
            for (const conflict of conflictCheck.conflicts) {
                conflicts.push({
                    kelas_id: kelasId,
                    kelas_name: kelasMap.get(kelasId) || String(kelasId),
                    conflict_type: conflict.type,
                    message: conflict.message
                });
            }
        }
    }

    log.success('CheckScheduleConflicts', { conflictCount: conflicts.length });
    return sendSuccessResponse(res, { conflicts }, 'Cek konflik selesai');
};

/**
 * Bulk create schedules
 * POST /api/admin/jadwal/bulk
 */
export const bulkCreateJadwal = async (req, res) => {
    const log = logger.withRequest(req, res);
    const {
        kelas_ids,
        mapel_id,
        guru_ids,
        ruang_id,
        hari,
        jam_ke,
        jam_mulai,
        jam_selesai,
        jenis_aktivitas = 'pelajaran',
        is_absenable,
        keterangan_khusus = null
    } = req.body;

    log.requestStart('BulkCreateJadwal', { kelasCount: kelas_ids?.length, hari, jam_ke });

    if (!Array.isArray(kelas_ids) || kelas_ids.length === 0) {
        return sendValidationError(res, 'Minimal satu kelas harus dipilih');
    }
    if (!hari || jam_ke === undefined || jam_mulai === undefined || jam_selesai === undefined) {
        return sendValidationError(res, 'Hari, jam ke, dan waktu wajib diisi');
    }

    const timeValidation = validateTimeLogic(String(jam_mulai), String(jam_selesai));
    if (!timeValidation.valid) {
        return sendValidationError(res, timeValidation.error);
    }

    const kelasIds = Array.from(new Set(kelas_ids.map(normalizeId).filter(Boolean)));
    if (kelasIds.length === 0) {
        return sendValidationError(res, 'Kelas tidak valid');
    }

    const jamKe = Number(jam_ke);
    if (!Number.isFinite(jamKe)) {
        return sendValidationError(res, 'Jam ke tidak valid');
    }

    const { primaryGuruId, guruIds } = normalizeGuruIds({ guru_ids });
    const finalMapelId = normalizeId(mapel_id);
    const finalRuangId = normalizeId(ruang_id);
    const isPelajaran = jenis_aktivitas === 'pelajaran';
    const isAbsenable = normalizeBoolean(is_absenable, isPelajaran);
    const primaryId = primaryGuruId || guruIds[0] || null;

    if (isPelajaran && (!finalMapelId || guruIds.length === 0)) {
        return sendValidationError(res, 'Mapel dan guru wajib diisi');
    }

    if (finalMapelId) {
        const mapelExists = await validateMapelExists(finalMapelId);
        if (!mapelExists) {
            return sendValidationError(res, 'Mata pelajaran tidak ditemukan');
        }
    }

    if (finalRuangId) {
        const ruangExists = await validateRuangExists(finalRuangId);
        if (!ruangExists) {
            return sendValidationError(res, 'Ruang tidak ditemukan');
        }
    }

    const guruValidation = await validateGuruIdsExist(guruIds);
    if (!guruValidation.valid) {
        return sendValidationError(res, guruValidation.error);
    }

    const placeholders = kelasIds.map(() => '?').join(',');
    const [kelasRows] = await globalThis.dbPool.execute(
        `SELECT id_kelas, nama_kelas FROM kelas WHERE id_kelas IN (${placeholders}) AND status = "aktif"`,
        kelasIds
    );

    const kelasMap = new Map(kelasRows.map(row => [row.id_kelas, row.nama_kelas]));
    const missingIds = kelasIds.filter(id => !kelasMap.has(id));
    if (missingIds.length > 0) {
        return sendValidationError(res, 'Kelas tidak ditemukan', { missing: missingIds });
    }

    const connection = await globalThis.dbPool.getConnection();
    try {
        await connection.beginTransaction();

        let created = 0;
        let skipped = 0;
        const conflicts = [];

        for (const kelasId of kelasIds) {
            const conflictCheck = await checkAllScheduleConflicts({
                kelas_id: kelasId,
                hari: String(hari),
                jam_mulai: String(jam_mulai),
                jam_selesai: String(jam_selesai),
                ruang_id: finalRuangId,
                guruIds,
                connection,
                collectConflicts: true
            });

            if (conflictCheck.hasConflict) {
                skipped++;
                for (const conflict of conflictCheck.conflicts) {
                    conflicts.push({
                        kelas_id: kelasId,
                        kelas_name: kelasMap.get(kelasId) || String(kelasId),
                        conflict_type: conflict.type,
                        message: conflict.message
                    });
                }
                continue;
            }

            const [insertResult] = await connection.execute(
                `INSERT INTO jadwal 
                 (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus, is_multi_guru)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?)`,
                [kelasId, finalMapelId, primaryId, finalRuangId, hari, jamKe, jam_mulai, jam_selesai, jenis_aktivitas, isAbsenable ? 1 : 0, keterangan_khusus, guruIds.length > 1 ? 1 : 0]
            );

            if (jenis_aktivitas === 'pelajaran' && guruIds.length > 0) {
                await insertJadwalGuru(insertResult.insertId, guruIds, connection);
            }

            created++;
        }

        await connection.commit();
        log.success('BulkCreateJadwal', { created, skipped });
        return sendSuccessResponse(res, { created, skipped, conflicts }, 'Bulk jadwal selesai');
    } catch (error) {
        await connection.rollback();
        log.dbError('bulkCreateJadwal', error);
        return sendDatabaseError(res, error, 'Gagal menambahkan jadwal massal');
    } finally {
        connection.release();
    }
};

/**
 * Clone schedules from one class to others
 * POST /api/admin/jadwal/clone
 */
export const cloneJadwal = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { source_kelas_id, target_kelas_ids, include_guru = true, include_ruang = true } = req.body;

    const sourceKelasId = normalizeId(source_kelas_id);
    if (!sourceKelasId) {
        return sendValidationError(res, 'Kelas sumber tidak valid');
    }

    if (!Array.isArray(target_kelas_ids) || target_kelas_ids.length === 0) {
        return sendValidationError(res, 'Minimal satu kelas target harus dipilih');
    }

    const targetIds = Array.from(new Set(target_kelas_ids.map(normalizeId).filter(Boolean)))
        .filter(id => id !== sourceKelasId);

    if (targetIds.length === 0) {
        return sendValidationError(res, 'Kelas target tidak valid');
    }

    const [sourceSchedules] = await globalThis.dbPool.execute(
        `SELECT id_jadwal, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai,
                jenis_aktivitas, is_absenable, keterangan_khusus
         FROM jadwal
         WHERE kelas_id = ? AND status = 'aktif'
         ORDER BY FIELD(hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'), jam_ke`,
        [sourceKelasId]
    );

    if (sourceSchedules.length === 0) {
        return sendNotFoundError(res, 'Kelas sumber tidak memiliki jadwal');
    }

    const scheduleIds = sourceSchedules.map(row => row.id_jadwal);
    const guruMap = new Map();
    if (scheduleIds.length > 0) {
        const placeholders = scheduleIds.map(() => '?').join(',');
        const [guruRows] = await globalThis.dbPool.execute(
            `SELECT jadwal_id, guru_id, is_primary
             FROM jadwal_guru
             WHERE jadwal_id IN (${placeholders})
             ORDER BY is_primary DESC`,
            scheduleIds
        );

        for (const row of guruRows) {
            if (!guruMap.has(row.jadwal_id)) {
                guruMap.set(row.jadwal_id, []);
            }
            guruMap.get(row.jadwal_id).push(row);
        }
    }

    const targetPlaceholders = targetIds.map(() => '?').join(',');
    const [targetRows] = await globalThis.dbPool.execute(
        `SELECT id_kelas, nama_kelas FROM kelas WHERE id_kelas IN (${targetPlaceholders}) AND status = "aktif"`,
        targetIds
    );

    const targetMap = new Map(targetRows.map(row => [row.id_kelas, row.nama_kelas]));
    const missingTargets = targetIds.filter(id => !targetMap.has(id));
    if (missingTargets.length > 0) {
        return sendValidationError(res, 'Kelas target tidak ditemukan', { missing: missingTargets });
    }

    const connection = await globalThis.dbPool.getConnection();
    try {
        await connection.beginTransaction();

        let created = 0;
        let skipped = 0;
        const conflicts = [];

        const buildGuruIds = (schedule) => {
            if (!include_guru) return [];
            const rows = guruMap.get(schedule.id_jadwal) || [];
            if (rows.length === 0 && schedule.guru_id) {
                return [schedule.guru_id];
            }
            const primary = rows.find(r => r.is_primary === 1);
            const ordered = [];
            if (primary) ordered.push(primary.guru_id);
            for (const row of rows) {
                if (!ordered.includes(row.guru_id)) {
                    ordered.push(row.guru_id);
                }
            }
            return ordered;
        };

        for (const targetId of targetIds) {
            for (const schedule of sourceSchedules) {
                const guruIds = buildGuruIds(schedule);
                const primaryGuruId = include_guru ? (schedule.guru_id || guruIds[0] || null) : null;
                const ruangId = include_ruang ? schedule.ruang_id : null;

                const conflictCheck = await checkAllScheduleConflicts({
                    kelas_id: targetId,
                    hari: schedule.hari,
                    jam_mulai: schedule.jam_mulai,
                    jam_selesai: schedule.jam_selesai,
                    ruang_id: ruangId,
                    guruIds,
                    connection,
                    collectConflicts: true
                });

                if (conflictCheck.hasConflict) {
                    skipped++;
                    for (const conflict of conflictCheck.conflicts) {
                        conflicts.push({
                            kelas_id: targetId,
                            kelas_name: targetMap.get(targetId) || String(targetId),
                            conflict_type: conflict.type,
                            message: conflict.message
                        });
                    }
                    continue;
                }

                const [insertResult] = await connection.execute(
                    `INSERT INTO jadwal 
                     (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus, is_multi_guru)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?)`,
                    [
                        targetId,
                        schedule.mapel_id,
                        primaryGuruId,
                        ruangId,
                        schedule.hari,
                        schedule.jam_ke,
                        schedule.jam_mulai,
                        schedule.jam_selesai,
                        schedule.jenis_aktivitas,
                        schedule.is_absenable ? 1 : 0,
                        schedule.keterangan_khusus,
                        include_guru && guruIds.length > 1 ? 1 : 0
                    ]
                );

                if (include_guru && guruIds.length > 0) {
                    await insertJadwalGuru(insertResult.insertId, guruIds, connection);
                }

                created++;
            }
        }

        await connection.commit();
        log.success('CloneJadwal', { created, skipped });
        return sendSuccessResponse(res, { created, skipped, conflicts }, 'Jadwal berhasil disalin');
    } catch (error) {
        await connection.rollback();
        log.dbError('cloneJadwal', error);
        return sendDatabaseError(res, error, 'Gagal menyalin jadwal');
    } finally {
        connection.release();
    }
};

/**
 * Get guru availability data
 * GET /api/admin/jadwal/guru-availability
 */
export const getGuruAvailability = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { tahun_ajaran = DEFAULT_TAHUN_AJARAN } = req.query;

    log.requestStart('GetGuruAvailability', { tahun_ajaran });

    try {
        const [rows] = await globalThis.dbPool.execute(
            `SELECT guru_id as id_guru, hari, is_available, keterangan
             FROM guru_availability
             WHERE tahun_ajaran = ?`,
            [tahun_ajaran]
        );

        log.success('GetGuruAvailability', { count: rows.length });
        return sendSuccessResponse(res, rows);
    } catch (error) {
        log.dbError('getGuruAvailability', error);
        return sendDatabaseError(res, error, 'Gagal memuat ketersediaan guru');
    }
};

/**
 * Bulk upsert guru availability data
 * POST /api/admin/jadwal/guru-availability/bulk
 */
export const bulkUpsertGuruAvailability = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { updates } = req.body;

    log.requestStart('BulkUpsertGuruAvailability', { count: updates?.length });

    if (!Array.isArray(updates) || updates.length === 0) {
        return sendValidationError(res, 'Data updates wajib diisi');
    }

    const cleanedUpdates = [];
    const errors = [];

    for (const update of updates) {
        const guruId = normalizeId(update.guru_id);
        const hari = update.hari ? String(update.hari).trim() : '';
        if (!guruId || !hari) {
            errors.push({ guru_id: update.guru_id, hari: update.hari, error: 'guru_id dan hari wajib diisi' });
            continue;
        }

        cleanedUpdates.push({
            guru_id: guruId,
            hari,
            is_available: normalizeBoolean(update.is_available, true) ? 1 : 0,
            keterangan: update.keterangan || null,
            tahun_ajaran: update.tahun_ajaran || DEFAULT_TAHUN_AJARAN
        });
    }

    if (errors.length > 0) {
        return sendValidationError(res, 'Validasi gagal', { errors });
    }

    const guruIds = Array.from(new Set(cleanedUpdates.map(u => u.guru_id)));
    const guruValidation = await validateGuruIdsExist(guruIds);
    if (!guruValidation.valid) {
        return sendValidationError(res, guruValidation.error);
    }

    const connection = await globalThis.dbPool.getConnection();
    try {
        await connection.beginTransaction();

        let upserted = 0;
        for (const update of cleanedUpdates) {
            await connection.execute(
                `INSERT INTO guru_availability (guru_id, hari, is_available, keterangan, tahun_ajaran)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    is_available = VALUES(is_available),
                    keterangan = VALUES(keterangan),
                    updated_at = CURRENT_TIMESTAMP`,
                [update.guru_id, update.hari, update.is_available, update.keterangan, update.tahun_ajaran]
            );
            upserted++;
        }

        await connection.commit();
        log.success('BulkUpsertGuruAvailability', { upserted });
        return sendSuccessResponse(res, { upserted }, 'Ketersediaan guru berhasil disimpan');
    } catch (error) {
        await connection.rollback();
        log.dbError('bulkUpsertGuruAvailability', error);
        return sendDatabaseError(res, error, 'Gagal menyimpan ketersediaan guru');
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
        kelas_id, mapel_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai,
        jenis_aktivitas = 'pelajaran', is_absenable = true, keterangan_khusus = null
    } = req.body;

    log.requestStart('CreateJadwal', { kelas_id, mapel_id, hari, jam_ke });

    try {
        const result = await processJadwalData(req.body, log);
        if (!result.success) {
            return sendValidationError(res, result.error);
        }

        const { finalGuruIds, finalMapelId, primaryGuruId, isMultiGuru, normalized } = result;
        const {
            kelas_id: kelasId,
            ruang_id: ruangId,
            hari: normalizedHari,
            jam_ke: jamKe,
            jam_mulai: jamMulai,
            jam_selesai: jamSelesai,
            jenis_aktivitas: jenisAktivitas,
            is_absenable: isAbsenable,
            keterangan_khusus: keteranganKhusus
        } = normalized;

        const [insertResult] = await globalThis.dbPool.execute(
            `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus, is_multi_guru)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?)`,
            [kelasId, finalMapelId, primaryGuruId, ruangId || null, normalizedHari, jamKe, jamMulai, jamSelesai, jenisAktivitas, isAbsenable ? 1 : 0, keteranganKhusus, isMultiGuru ? 1 : 0]
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
        kelas_id, mapel_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai,
        jenis_aktivitas = 'pelajaran', is_absenable = true, keterangan_khusus = null
    } = req.body;

    log.requestStart('UpdateJadwal', { id, kelas_id, hari, jam_ke });

    try {
        const result = await processJadwalData(req.body, log, { excludeId: id });
        if (!result.success) {
            return sendValidationError(res, result.error);
        }

        const { finalGuruIds, finalMapelId, primaryGuruId, isMultiGuru, normalized } = result;
        const {
            kelas_id: kelasId,
            ruang_id: ruangId,
            hari: normalizedHari,
            jam_ke: jamKe,
            jam_mulai: jamMulai,
            jam_selesai: jamSelesai,
            jenis_aktivitas: jenisAktivitas,
            is_absenable: isAbsenable,
            keterangan_khusus: keteranganKhusus
        } = normalized;

        const [updateResult] = await globalThis.dbPool.execute(
            `UPDATE jadwal 
             SET kelas_id = ?, mapel_id = ?, guru_id = ?, ruang_id = ?, hari = ?, jam_ke = ?, jam_mulai = ?, jam_selesai = ?, jenis_aktivitas = ?, is_absenable = ?, keterangan_khusus = ?, is_multi_guru = ?
             WHERE id_jadwal = ?`,
            [kelasId, finalMapelId, primaryGuruId, ruangId || null, normalizedHari, jamKe, jamMulai, jamSelesai, jenisAktivitas, isAbsenable ? 1 : 0, keteranganKhusus, isMultiGuru ? 1 : 0, id]
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
