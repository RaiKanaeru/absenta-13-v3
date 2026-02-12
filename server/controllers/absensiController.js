/**
 * Absensi Controller
 * Menangani semua operasi absensi untuk siswa dan guru
 * 
 * @description Controller ini mengelola:
 * - Pencatatan kehadiran siswa (oleh guru)
 * - Pencatatan kehadiran guru (oleh siswa perwakilan)
 * - Riwayat dan statistik absensi
 * - Dukungan jadwal multi-guru
 * 
 * @tables
 * - absensi_siswa: Catatan kehadiran siswa
 * - absensi_guru: Catatan kehadiran guru (dicatat siswa perwakilan)
 * - jadwal: Informasi jadwal dengan dukungan multi-guru
 * - jadwal_guru: Penugasan jadwal multi-guru
 */

import {
    sendDatabaseError,
    sendValidationError,
    sendNotFoundError,
    sendSuccessResponse,
    sendPermissionError,
    sendServiceUnavailableError
} from '../utils/errorHandler.js';
import {
    getMySQLDateWIB,
    getMySQLDateTimeWIB,
    formatWIBTimeWithSeconds,
    getWIBTime,
    getDaysDifferenceWIB
} from '../utils/timeUtils.js';
import { validateSelfAccess, validatePerwakilanAccess, validateUserContext } from '../utils/validationUtils.js';
import { createLogger } from '../utils/logger.js';
import db from '../config/db.js';

const logger = createLogger('Absensi');

// ===========================
// CONSTANTS
// ===========================

/** Valid status values for student attendance */
const VALID_STUDENT_STATUSES = ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispen'];

/** Valid status values for teacher attendance */
const VALID_TEACHER_STATUSES = new Set(['Hadir', 'Tidak Hadir', 'Izin', 'Sakit']);

/** Maximum days allowed for teacher to edit past attendance */
const TEACHER_EDIT_DAYS_LIMIT = 30;

/** Maximum days allowed for student (class rep) to edit past attendance */
const STUDENT_EDIT_DAYS_LIMIT = 7;

/** SQL query to find existing student attendance by guru */
const SQL_FIND_STUDENT_ATTENDANCE_BY_GURU = 
    'SELECT id FROM absensi_siswa WHERE siswa_id = ? AND jadwal_id = ? AND guru_pengabsen_id = ? AND tanggal = ?';

/** SQL query to find existing teacher attendance */
const SQL_FIND_TEACHER_ATTENDANCE = 
    'SELECT id_absensi FROM absensi_guru WHERE jadwal_id = ? AND guru_id = ? AND tanggal = ?';

// ===========================
// HELPER FUNCTIONS
// ===========================

/**
 * Validates if a date is within the allowed edit range
 */
function validateDateRange(targetDate, maxDaysAgo) {
    const todayStr = getMySQLDateWIB();
    const daysDiff = getDaysDifferenceWIB(targetDate, todayStr);

    if (daysDiff < 0) {
        return { valid: false, error: 'Tidak dapat mengubah absen untuk tanggal masa depan' };
    }

    if (daysDiff > maxDaysAgo) {
        return { valid: false, error: `Tidak dapat mengubah absen lebih dari ${maxDaysAgo} hari yang lalu` };
    }

    return { valid: true, error: null };
}

/**
 * Maps attendance status based on additional flags
 */
function mapAttendanceStatus(status, terlambat = false, ada_tugas = false) {
    let finalStatus = status;
    let isLate = 0;
    let hasTask = 0;

    if (terlambat && status === 'Hadir') {
        isLate = 1;
    } else if (ada_tugas && ['Alpa', 'Sakit', 'Izin', 'Tidak Hadir'].includes(status)) {
        hasTask = 1;
    }

    return { finalStatus, isLate, hasTask };
}

/**
 * Parses attendance data from request body
 */
function parseAttendanceData(attendanceData) {
    if (typeof attendanceData === 'string') {
        return { status: attendanceData, terlambat: false, ada_tugas: false };
    }

    if (typeof attendanceData === 'object' && attendanceData.status) {
        return {
            status: attendanceData.status,
            terlambat: attendanceData.terlambat || false,
            ada_tugas: attendanceData.ada_tugas || false
        };
    }

    return null;
}

/**
 * Validates required piket attendance submission data
 * @returns {Object|null} Error object or null if valid
 */
function validatePiketData(siswa_pencatat_id, jadwal_id, attendance_data) {
    if (!siswa_pencatat_id || !jadwal_id || !attendance_data) {
        return { error: 'siswa_pencatat_id, jadwal_id, dan attendance_data wajib diisi' };
    }
    return null;
}

/**
 * Validates if piket can access this schedule
 * @returns {Object|null} Error object or null if valid
 */
async function validatePiketAccess(pool, siswa_pencatat_id, jadwal_id) {
    // Get piket's class
    const [piketData] = await pool.execute(
        'SELECT kelas_id FROM siswa WHERE id_siswa = ?',
        [siswa_pencatat_id]
    );

    if (piketData.length === 0) {
        return { error: 'Siswa pencatat tidak ditemukan', notFound: true };
    }

    const kelasId = piketData[0].kelas_id;

    // Verify jadwal belongs to this class
    const [jadwalData] = await pool.execute(
        'SELECT kelas_id, jam_ke FROM jadwal WHERE id_jadwal = ?',
        [jadwal_id]
    );

    if (jadwalData.length === 0 || jadwalData[0].kelas_id !== kelasId) {
        return { error: 'Jadwal tidak valid untuk kelas ini' };
    }

    return { kelasId };
}

/**
 * Validates if guru is absent (required for piket to submit)
 * @returns {Object} Validation result with error or guruStatus
 */
async function validateGuruAbsentStatus(pool, jadwal_id, targetDate) {
    const [guruAbsen] = await pool.execute(`
        SELECT status FROM absensi_guru 
        WHERE jadwal_id = ? AND tanggal = ?
        LIMIT 1
    `, [jadwal_id, targetDate]);

    if (guruAbsen.length === 0) {
        return { error: 'Guru belum diabsen. Silakan absen guru terlebih dahulu.' };
    }

    const guruStatus = guruAbsen[0].status;
    const isGuruAbsent = ['Tidak Hadir', 'Izin', 'Sakit'].includes(guruStatus);

    if (!isGuruAbsent) {
        return { error: 'Guru hadir untuk jadwal ini. Absensi siswa dilakukan oleh guru.' };
    }

    return { guruStatus, isGuruAbsent };
}

/**
 * Process attendance record for a single student
 */
async function processStudentAttendanceRecord(connection, studentId, data, jadwal_id, targetDate, siswa_pencatat_id, waktuAbsen) {
    const { status, keterangan } = typeof data === 'string'
        ? { status: data, keterangan: null }
        : data;

    // Validate status
    if (!VALID_STUDENT_STATUSES.includes(status)) {
        return false; // Skip invalid status
    }

    // Check existing record
    const [existing] = await connection.execute(
        'SELECT id FROM absensi_siswa WHERE siswa_id = ? AND jadwal_id = ? AND tanggal = ?',
        [studentId, jadwal_id, targetDate]
    );

    if (existing.length > 0) {
        await connection.execute(`
            UPDATE absensi_siswa 
            SET status = ?, keterangan = ?, siswa_pencatat_id = ?, pencatat_type = 'siswa', waktu_absen = ?
            WHERE siswa_id = ? AND jadwal_id = ? AND tanggal = ?
        `, [status, keterangan || null, siswa_pencatat_id, waktuAbsen, studentId, jadwal_id, targetDate]);
    } else {
        await connection.execute(`
            INSERT INTO absensi_siswa 
            (siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, siswa_pencatat_id, pencatat_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'siswa')
        `, [studentId, jadwal_id, targetDate, status, keterangan || null, waktuAbsen, siswa_pencatat_id]);
    }

    return true;
}

/**
 * Gets the primary or first teacher for a multi-guru schedule
 */
async function getPrimaryTeacherForSchedule(connection, jadwalId) {
    const [guruDetails] = await connection.execute(
        'SELECT guru_id FROM jadwal_guru WHERE jadwal_id = ? AND is_primary = 1 LIMIT 1',
        [jadwalId]
    );

    if (guruDetails.length > 0) {
        return guruDetails[0].guru_id;
    }

    const [anyGuruDetails] = await connection.execute(
        'SELECT guru_id FROM jadwal_guru WHERE jadwal_id = ? LIMIT 1',
        [jadwalId]
    );

    return anyGuruDetails.length > 0 ? anyGuruDetails[0].guru_id : null;
}

// ===========================
// STUDENT ATTENDANCE OPERATIONS
// (Recorded by Teachers)
// ===========================

/**
 * Get students for a specific schedule with today's attendance
 * @route GET /api/schedule/:id/students
 */
export async function getStudentsForSchedule(req, res) {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    log.requestStart('GetStudentsForSchedule', { scheduleId: id });

    try {
        const [scheduleData] = await db.execute(
            'SELECT kelas_id, is_multi_guru FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [id]
        );

        if (scheduleData.length === 0) {
            log.warn('Schedule not found', { scheduleId: id });
            return sendNotFoundError(res, 'Jadwal tidak ditemukan');
        }

        const kelasId = scheduleData[0].kelas_id;
        const isMultiGuru = scheduleData[0].is_multi_guru === 1;
        const currentDate = getMySQLDateWIB();

        const multiGuruSelect = isMultiGuru
            ? `GROUP_CONCAT(
                CONCAT(
                    COALESCE(g2.nama, 'Unknown'), ':', 
                    COALESCE(a2.status, 'Belum'), ':', 
                    COALESCE(a2.keterangan, ''), ':', 
                    COALESCE(a2.waktu_absen, '')
                ) 
                ORDER BY a2.waktu_absen DESC 
                SEPARATOR '||'
            ) as other_teachers_attendance`
            : `NULL as other_teachers_attendance`;

        const multiGuruJoin = isMultiGuru
            ? `LEFT JOIN absensi_siswa a2 ON s.id_siswa = a2.siswa_id 
                AND a2.jadwal_id = ? 
                AND a2.tanggal = ?
                AND (a2.guru_pengabsen_id != ? OR a2.guru_pengabsen_id IS NULL)
            LEFT JOIN guru g2 ON a2.guru_pengabsen_id = g2.id_guru`
            : '';

        const query = `
            SELECT 
                s.id_siswa as id,
                s.nis,
                s.nama,
                s.jenis_kelamin,
                s.jabatan,
                s.status,
                k.nama_kelas,
                COALESCE(a.status, 'Hadir') as attendance_status,
                a.keterangan as attendance_note,
                a.waktu_absen,
                a.guru_pengabsen_id,
                g.nama as guru_pengabsen_nama,
                ${multiGuruSelect}
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND a.jadwal_id = ? 
                AND a.tanggal = ?
                AND a.guru_pengabsen_id = ?
            LEFT JOIN guru g ON a.guru_pengabsen_id = g.id_guru
            ${multiGuruJoin}
            WHERE s.kelas_id = ? AND s.status = 'aktif'
            GROUP BY s.id_siswa, s.nis, s.nama, s.jenis_kelamin, s.jabatan, s.status, 
                     k.nama_kelas, a.status, a.keterangan, a.waktu_absen, a.guru_pengabsen_id, g.nama
            ORDER BY s.nama ASC`;

        const params = isMultiGuru
            ? [id, currentDate, req.user.guru_id, id, currentDate, req.user.guru_id, kelasId]
            : [id, currentDate, req.user.guru_id, kelasId];

        const [students] = await db.execute(query, params);

        log.success('GetStudentsForSchedule', { scheduleId: id, count: students.length, kelasId });
        res.json(students);
    } catch (error) {
        log.dbError('getStudentsForSchedule', error, { scheduleId: id });
        return sendDatabaseError(res, error);
    }
}

/**
 * Get students for a specific schedule by date (for editing past attendance)
 * @route GET /api/schedule/:id/students-by-date?tanggal=YYYY-MM-DD
 */
export async function getStudentsForScheduleByDate(req, res) {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { tanggal } = req.query;
    log.requestStart('GetStudentsForScheduleByDate', { scheduleId: id, tanggal });

    try {
        // Use WIB-aware date utilities for proper timezone handling
        const todayStr = getMySQLDateWIB();
        const targetDateStr = tanggal || todayStr;
        
        // Validate date format
        if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
            log.validationFail('tanggal', tanggal, 'Invalid date format');
            return sendValidationError(res, 'Format tanggal tidak valid (gunakan YYYY-MM-DD)');
        }

        // Use getDaysDifferenceWIB for proper comparison
        const daysDiff = getDaysDifferenceWIB(targetDateStr, todayStr);
        
        if (daysDiff < 0) {
            log.validationFail('tanggal', tanggal, 'Future date not allowed');
            return sendValidationError(res, 'Tidak dapat melihat absen untuk tanggal masa depan');
        }

        if (daysDiff > TEACHER_EDIT_DAYS_LIMIT) {
            log.validationFail('tanggal', tanggal, 'Date too old');
            return sendValidationError(res, `Tidak dapat melihat absen lebih dari ${TEACHER_EDIT_DAYS_LIMIT} hari yang lalu`);
        }

        const [scheduleData] = await db.execute(
            'SELECT kelas_id FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [id]
        );

        if (scheduleData.length === 0) {
            log.warn('Schedule not found', { scheduleId: id });
            return sendNotFoundError(res, 'Jadwal tidak ditemukan');
        }

        const kelasId = scheduleData[0].kelas_id;
        // targetDateStr already defined above

        const [students] = await db.execute(`
            SELECT 
                s.id_siswa as id,
                s.nis,
                s.nama,
                s.jenis_kelamin,
                s.jabatan,
                s.status,
                k.nama_kelas,
                COALESCE(a.status, 'Hadir') as attendance_status,
                a.keterangan as attendance_note,
                a.waktu_absen
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND a.jadwal_id = ? 
                AND a.tanggal = ?
            WHERE s.kelas_id = ? AND s.status = 'aktif'
            ORDER BY s.nama ASC`,
            [id, targetDateStr, kelasId]
        );

        log.success('GetStudentsForScheduleByDate', { scheduleId: id, tanggal: targetDateStr, count: students.length });
        res.json(students);
    } catch (error) {
        log.dbError('getStudentsForScheduleByDate', error, { scheduleId: id });
        return sendDatabaseError(res, error);
    }
}

/**
 * Submit attendance for a schedule (by teacher)
 * @route POST /api/attendance/submit
 */
export async function submitStudentAttendance(req, res) {
    const log = logger.withRequest(req, res);
    const { scheduleId, attendance, notes = {}, guruId, tanggal_absen } = req.body;
    log.requestStart('SubmitStudentAttendance', { scheduleId, guruId, studentCount: Object.keys(attendance || {}).length });

        if (!db) {
            log.error('Database not available', null);
            return sendServiceUnavailableError(res, 'Koneksi database tidak tersedia');
        }


    const connection = await db.getConnection();

    try {
        if (!scheduleId || !attendance || !guruId) {
            log.validationFail('required_fields', null, 'Missing scheduleId, attendance, or guruId');
            return sendValidationError(res, 'Data absensi tidak lengkap');
        }

        const [scheduleData] = await connection.execute(
            'SELECT kelas_id, mapel_id, is_multi_guru FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [scheduleId]
        );

        if (scheduleData.length === 0) {
            log.warn('Schedule not found', { scheduleId });
            return sendNotFoundError(res, 'Jadwal tidak ditemukan');
        }

        const isMultiGuru = scheduleData[0].is_multi_guru === 1;
        const targetDate = tanggal_absen || getMySQLDateWIB();
        const dateValidation = validateDateRange(targetDate, TEACHER_EDIT_DAYS_LIMIT);

        if (!dateValidation.valid) {
            log.validationFail('tanggal', targetDate, dateValidation.error);
            return sendValidationError(res, dateValidation.error);
        }

        const attendanceEntries = Object.entries(attendance);
        const currentTime = formatWIBTimeWithSeconds();
        const processedStudents = [];
        const waktuAbsen = `${targetDate} ${currentTime}`;

        await connection.beginTransaction();

        try {
            // OPTIMIZATION: Batch processing instead of N+1 queries
            
            // 1. Get all existing attendance records for this teacher/schedule/date in ONE query
            const [existingRows] = await connection.execute(
                'SELECT id, siswa_id FROM absensi_siswa WHERE jadwal_id = ? AND guru_pengabsen_id = ? AND tanggal = ?',
                [scheduleId, guruId, targetDate]
            );
            
            const existingMap = new Map();
            existingRows.forEach(row => existingMap.set(row.siswa_id, row.id));

            const updates = [];
            const inserts = [];

            // 2. Classify actions (Insert vs Update)
            for (const [studentIdStr, attendanceData] of attendanceEntries) {
                const studentId = Number(studentIdStr);
                const parsed = parseAttendanceData(attendanceData);
                
                if (!parsed) {
                    log.validationFail('attendance_data', studentId, 'Invalid format');
                    throw new Error(`Format data absensi tidak valid untuk siswa ${studentId}`);
                }

                const { status, terlambat, ada_tugas } = parsed;

                if (!VALID_STUDENT_STATUSES.includes(status)) {
                    log.validationFail('status', status, 'Invalid status');
                    throw new Error(`Status tidak valid: ${status}`);
                }

                const { finalStatus, isLate, hasTask } = mapAttendanceStatus(status, terlambat, ada_tugas);
                const note = status === 'Hadir' ? '' : (notes[studentIdStr] || '');

                if (existingMap.has(studentId)) {
                    updates.push([finalStatus, note, waktuAbsen, guruId, isLate, hasTask, existingMap.get(studentId)]);
                } else {
                    inserts.push([studentId, scheduleId, targetDate, finalStatus, note, waktuAbsen, guruId, guruId, isLate, hasTask]);
                }

                processedStudents.push({ studentId, status: finalStatus });
            }

            // 3. Execute Updates (Parallel Promise.all)
            if (updates.length > 0) {
                const updatePromises = updates.map(params => 
                    connection.execute(
                        `UPDATE absensi_siswa 
                         SET status = ?, keterangan = ?, waktu_absen = ?, guru_id = ?, terlambat = ?, ada_tugas = ? 
                         WHERE id = ?`,
                        params
                    )
                );
                await Promise.all(updatePromises);
            }

            // 4. Execute Inserts (Bulk Insert)
            if (inserts.length > 0) {
                const placeholders = inserts.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
                const flatValues = inserts.flat();
                
                await connection.execute(
                    `INSERT INTO absensi_siswa 
                     (siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, guru_id, guru_pengabsen_id, terlambat, ada_tugas) 
                     VALUES ${placeholders}`,
                    flatValues
                );
            }

            if (isMultiGuru) {
                // Pass connection to syncMultiGuruAttendance to ensure same transaction
                // NOTE: syncMultiGuruAttendance currently uses db directly. 
                // Ideally, we should refactor it to accept a connection, but for now, 
                // since it mostly does INSERTS for OTHER teachers, keeping it outside this transaction 
                // might be acceptable if refactoring is too risky, BUT best practice is to include it.
                // Let's refactor syncMultiGuruAttendance as well to be safe.
                await syncMultiGuruAttendance(connection, scheduleId, guruId, attendance, notes, targetDate, currentTime);
            }

            await connection.commit();

            log.success('SubmitStudentAttendance', { scheduleId, processed: processedStudents.length, date: targetDate });
            res.json({
                message: 'Absensi berhasil disimpan',
                processed: processedStudents.length,
                date: targetDate,
                scheduleId,
                isMultiGuru
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        log.dbError('submitStudentAttendance', error, { scheduleId });
        if (error.message.startsWith('Status tidak valid') || error.message.startsWith('Format data')) {
             return sendValidationError(res, error.message);
        }
        return sendDatabaseError(res, error, 'Gagal menyimpan absensi');
    } finally {
        connection.release();
    }
}

/**
 * Build existing records map from database rows
 * @private
 */
function buildExistingRecordsMap(existingRows) {
    const existingMap = {};
    existingRows.forEach(row => {
        if (!existingMap[row.guru_pengabsen_id]) existingMap[row.guru_pengabsen_id] = {};
        existingMap[row.guru_pengabsen_id][row.siswa_id] = row.id;
    });
    return existingMap;
}

/**
 * Prepare insert and update operations for multi-guru attendance
 * @private
 */
function prepareMultiGuruOperations(otherGuruIds, attendance, notes, scheduleId, targetDate, currentTime, existingMap) {
    const updates = [];
    const inserts = [];
    const waktuAbsen = `${targetDate} ${currentTime}`;

    for (const otherGuruId of otherGuruIds) {
        for (const [studentIdStr, attendanceData] of Object.entries(attendance)) {
            const studentId = Number(studentIdStr);
            const parsed = parseAttendanceData(attendanceData);
            if (!parsed) continue;

            const { status, terlambat, ada_tugas } = parsed;
            const { finalStatus, isLate, hasTask } = mapAttendanceStatus(status, terlambat, ada_tugas);
            const note = status === 'Hadir' ? '' : (notes[studentIdStr] || '');
            const existingId = existingMap[otherGuruId]?.[studentId];

            if (existingId) {
                updates.push([finalStatus, note, waktuAbsen, otherGuruId, isLate, hasTask, existingId]);
            } else {
                inserts.push([studentId, scheduleId, targetDate, finalStatus, note, waktuAbsen, otherGuruId, otherGuruId, isLate, hasTask]);
            }
        }
    }

    return { updates, inserts };
}

/**
 * Syncs attendance data to other teachers in multi-guru schedules
 * Optimized to avoid N+1 queries
 * @private
 */
async function syncMultiGuruAttendance(connection, scheduleId, primaryGuruId, attendance, notes, targetDate, currentTime) {
    logger.debug('Multi-guru sync started', { scheduleId, primaryGuruId });

    const [allTeachers] = await connection.execute(
        'SELECT guru_id FROM jadwal_guru WHERE jadwal_id = ? AND guru_id != ?',
        [scheduleId, primaryGuruId]
    );

    if (allTeachers.length === 0) return;
    const otherGuruIds = allTeachers.map(t => t.guru_id);

    logger.debug('Syncing to other teachers', { count: otherGuruIds.length });

    // 1. Get existing attendance records for ALL other teachers in one query
    const placeholders = otherGuruIds.map(() => '?').join(',');
    const [existingRows] = await connection.execute(
        `SELECT id, guru_pengabsen_id, siswa_id 
         FROM absensi_siswa 
         WHERE jadwal_id = ? AND tanggal = ? AND guru_pengabsen_id IN (${placeholders})`,
        [scheduleId, targetDate, ...otherGuruIds]
    );

    // Build existing map
    const existingMap = buildExistingRecordsMap(existingRows);

    // 2. Prepare operations in memory
    const { updates, inserts } = prepareMultiGuruOperations(
        otherGuruIds,
        attendance,
        notes,
        scheduleId,
        targetDate,
        currentTime,
        existingMap
    );

    // 3. Execute Bulk Insert
    if (inserts.length > 0) {
        const valuePlaceholders = inserts.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const flatValues = inserts.flat();
        await connection.execute(
            `INSERT INTO absensi_siswa (siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, guru_id, guru_pengabsen_id, terlambat, ada_tugas) VALUES ${valuePlaceholders}`,
            flatValues
        );
    }

    // 4. Execute Updates (Parallel Promises)
    if (updates.length > 0) {
        const updatePromises = updates.map(params => connection.execute(
            `UPDATE absensi_siswa SET status = ?, keterangan = ?, waktu_absen = ?, guru_id = ?, terlambat = ?, ada_tugas = ? WHERE id = ?`,
            params
        ));
        await Promise.all(updatePromises);
    }

    logger.debug('Multi-guru sync completed', { 
        syncedTeachers: otherGuruIds.length,
        inserts: inserts.length,
        updates: updates.length 
    });
}

// ===========================
// TEACHER ATTENDANCE OPERATIONS
// (Recorded by Class Representatives)
// ===========================

/**
 * Record attendance (Simple version for siswa marking guru)
 * POST /api/absensi
 */
export async function recordTeacherAttendanceSimple(req, res) {
    const log = logger.withRequest(req, res);
    const { jadwal_id, guru_id, status, keterangan, terlambat, ada_tugas } = req.body;
    log.requestStart('RecordTeacherAttendanceSimple', { jadwal_id, guru_id, status });

    if (!validateUserContext(req, res) || !validatePerwakilanAccess(req, res)) {
        return;
    }

    if (!validateSelfAccess(req, res, req.user.siswa_id, 'siswa_id')) {
        return;
    }

    try {
        if (req.user.kelas_id) {
            const [jadwalRows] = await db.execute(
                'SELECT kelas_id FROM jadwal WHERE id_jadwal = ? LIMIT 1',
                [jadwal_id]
            );
            if (jadwalRows.length === 0) {
                log.warn('Schedule not found', { jadwal_id });
                return sendNotFoundError(res, 'Jadwal tidak ditemukan');
            }
            if (jadwalRows[0].kelas_id !== req.user.kelas_id) {
                log.warn('Schedule class mismatch', { jadwal_id, kelas_id: jadwalRows[0].kelas_id, user_kelas_id: req.user.kelas_id });
                return sendPermissionError(res, 'Jadwal tidak sesuai dengan kelas Anda');
            }
        }

        const todayWIB = getMySQLDateWIB();
        const [existing] = await db.execute(
            `SELECT id_absensi FROM absensi_guru WHERE jadwal_id = ? AND tanggal = ? LIMIT 1`,
            [jadwal_id, todayWIB]
        );

        if (existing.length > 0) {
            log.validationFail('duplicate', { jadwal_id, tanggal: todayWIB }, 'Already recorded');
            return sendValidationError(res, 'Absensi untuk jadwal ini sudah dicatat hari ini');
        }

        const [jadwalData] = await db.execute(
            'SELECT id_jadwal, kelas_id, guru_id, mapel_id, jam_mulai FROM jadwal WHERE id_jadwal = ? LIMIT 1',
            [jadwal_id]
        );

        if (jadwalData.length === 0) {
            log.warn('Schedule not found', { jadwal_id });
            return sendNotFoundError(res, 'Jadwal tidak ditemukan');
        }

        let finalStatus = status;
        let isLate = 0;
        let hasTask = 0;

        if (terlambat && status === 'Hadir') {
            isLate = 1;
            finalStatus = 'Hadir';
        } else if (ada_tugas && (status === 'Alpa' || status === 'Tidak Hadir')) {
            hasTask = 1;
            finalStatus = status;
        }

        await db.execute(
            `INSERT INTO absensi_guru (jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, jam_ke, status, keterangan, terlambat, ada_tugas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [jadwal_id, guru_id, req.user.kelas_id, req.user.siswa_id, todayWIB, jadwalData[0].jam_ke, finalStatus, keterangan, isLate, hasTask]
        );

        log.success('RecordTeacherAttendanceSimple', { jadwal_id, guru_id, status: finalStatus });
        res.json({ success: true, message: 'Absensi berhasil dicatat' });

    } catch (error) {
        log.dbError('recordTeacherAttendanceSimple', error, { jadwal_id, guru_id });
        return sendDatabaseError(res, error, 'Gagal mencatat absensi');
    }
}


/**
 * Submit teacher attendance (by class representative)
 * @route POST /api/siswa/submit-kehadiran-guru
 */
export async function submitTeacherAttendance(req, res) {
    const log = logger.withRequest(req, res);
    const { siswa_id, kehadiran_data, tanggal_absen } = req.body;
    log.requestStart('SubmitTeacherAttendance', { siswa_id, entryCount: Object.keys(kehadiran_data || {}).length });

    if (!validateUserContext(req, res) || !validatePerwakilanAccess(req, res)) {
        return;
    }

    try {
        if (!siswa_id) {
            log.validationFail('siswa_id', null, 'Required');
            return sendValidationError(res, 'siswa_id wajib diisi');
        }

        if (!kehadiran_data || typeof kehadiran_data !== 'object') {
            log.validationFail('kehadiran_data', null, 'Required object');
            return sendValidationError(res, 'kehadiran_data wajib diisi dan harus berupa objek');
        }

        if (!validateSelfAccess(req, res, siswa_id, 'siswa_id')) {
            return;
        }

        if (req.user.kelas_id) {
            const jadwalIds = Object.keys(kehadiran_data || {}).map((key) => key.split('-')[0]);
            if (jadwalIds.length > 0) {
                const placeholders = jadwalIds.map(() => '?').join(',');
                const [jadwalRows] = await db.execute(
                    `SELECT id_jadwal FROM jadwal WHERE id_jadwal IN (${placeholders}) AND kelas_id = ?`,
                    [...jadwalIds, req.user.kelas_id]
                );
                if (jadwalRows.length !== jadwalIds.length) {
                    return sendPermissionError(res, 'Beberapa jadwal tidak sesuai dengan kelas Anda');
                }
            }
        }

        const targetDate = tanggal_absen || getMySQLDateWIB();
        const dateValidation = validateDateRange(targetDate, STUDENT_EDIT_DAYS_LIMIT);

        if (!dateValidation.valid) {
            log.validationFail('tanggal', targetDate, dateValidation.error);
            return sendValidationError(res, dateValidation.error);
        }

        if (!db) {
            log.error('Database not available', null);
            return sendServiceUnavailableError(res, 'Koneksi database tidak tersedia');
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            for (const [key, data] of Object.entries(kehadiran_data)) {
                await processTeacherAttendanceEntry(connection, key, data, siswa_id, targetDate, req.user.kelas_id);
            }

            await connection.commit();
            log.success('SubmitTeacherAttendance', { siswa_id, targetDate, entries: Object.keys(kehadiran_data).length });

            res.json({
                success: true,
                message: `Data kehadiran guru berhasil disimpan untuk tanggal ${targetDate}`
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        log.dbError('submitTeacherAttendance', error, { siswa_id });
        return sendDatabaseError(res, error, 'Gagal menyimpan data kehadiran guru');
    }
}


/**
 * Get attendance history (Raw list for dashboard/widgets)
 * GET /api/absensi/history
 */
export async function getAbsensiHistory(req, res) {
    const log = logger.withRequest(req, res);
    const { date_start, date_end, limit = 50 } = req.query;
    log.requestStart('GetAbsensiHistory', { date_start, date_end, limit, role: req.user.role });

    if (req.user.role === 'siswa' && !validatePerwakilanAccess(req, res)) {
        return;
    }

    try {
        let query = `
            SELECT ag.*, j.jam_ke, j.jam_mulai, j.jam_selesai, j.hari,
                   COALESCE(g.nama, 'Sistem') as nama_guru, k.nama_kelas, COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                   s.nama as nama_pencatat
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON ag.guru_id = g.id_guru
            JOIN kelas k ON ag.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN siswa s ON ag.siswa_pencatat_id = s.id_siswa
        `;

        let params = [];
        let whereConditions = [];

        if (req.user.role === 'guru') {
            whereConditions.push('ag.guru_id = ?');
            params.push(req.user.guru_id);
        } else if (req.user.role === 'siswa') {
            whereConditions.push('ag.kelas_id = ?');
            params.push(req.user.kelas_id);
        }


        if (date_start) {
            whereConditions.push('ag.tanggal >= ?');
            params.push(date_start);
        }
        if (date_end) {
            whereConditions.push('ag.tanggal <= ?');
            params.push(date_end);
        }

        if (req.user.role === 'siswa') {
            // Calculate 7 days ago in WIB
            const wibNow = getWIBTime();
            const sevenDaysAgoDate = new Date(wibNow.getTime() - 7 * 24 * 60 * 60 * 1000);
            const sevenDaysAgoWIB = `${sevenDaysAgoDate.getFullYear()}-${String(sevenDaysAgoDate.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgoDate.getDate()).padStart(2, '0')}`;
            whereConditions.push('ag.tanggal >= ?');
            params.push(sevenDaysAgoWIB);
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY ag.tanggal DESC, ag.waktu_catat DESC LIMIT ?';
        params.push(Number.parseInt(limit));

        const [rows] = await db.execute(query, params);

        log.success('GetAbsensiHistory', { count: rows.length, role: req.user.role });
        res.json({ success: true, data: rows });

    } catch (error) {
        log.dbError('getAbsensiHistory', error, { role: req.user.role });
        return sendDatabaseError(res, error, 'Gagal memuat riwayat absensi');
    }
}

// ===========================
// STUDENT ATTENDANCE BY PIKET (SISWA PERWAKILAN)
// When teacher is absent, class representative can take student attendance
// ===========================

/**
 * Get students list for piket to take attendance (when guru absent)
 * @route GET /api/siswa/:siswa_id/daftar-siswa-absen
 */
export async function getStudentsForPiketAbsen(req, res) {
    const log = logger.withRequest(req, res);
    const { siswa_id } = req.params;
    const { jadwal_id, tanggal } = req.query;

    log.requestStart('GetStudentsForPiketAbsen', { siswa_id, jadwal_id, tanggal });

    if (!validateUserContext(req, res) || !validatePerwakilanAccess(req, res)) {
        return;
    }

    if (!validateSelfAccess(req, res, siswa_id, 'siswa_id')) {
        return;
    }

    try {
        // Get siswa's class
        const [siswaData] = await db.execute(
            'SELECT kelas_id FROM siswa WHERE id_siswa = ?',
            [siswa_id]
        );

        if (siswaData.length === 0) {
            return sendNotFoundError(res, 'Siswa tidak ditemukan');
        }


        const kelasId = siswaData[0].kelas_id;
        const targetDate = tanggal || getMySQLDateWIB();

        // Check if guru is marked as "Tidak Hadir" for this jadwal
        const [guruAbsen] = await db.execute(`
            SELECT ag.status, g.nama as nama_guru
            FROM absensi_guru ag
            JOIN guru g ON ag.guru_id = g.id_guru
            WHERE ag.jadwal_id = ? AND ag.tanggal = ?
            LIMIT 1
        `, [jadwal_id, targetDate]);

        if (guruAbsen.length === 0) {
            return sendValidationError(res, 'Guru belum diabsen untuk jadwal ini');
        }

        // Guru is absent if status is Tidak Hadir, Izin, or Sakit
        const guruStatus = guruAbsen[0].status;
        const isGuruAbsent = ['Tidak Hadir', 'Izin', 'Sakit'].includes(guruStatus);

        if (!isGuruAbsent) {
            return sendValidationError(res, 'Guru hadir, absensi siswa dilakukan oleh guru');
        }

        // Get students in the class with existing attendance
        const [students] = await db.execute(`
            SELECT 
                s.id_siswa,
                s.nis,
                s.nama,
                s.jenis_kelamin,
                s.jabatan,
                COALESCE(a.status, 'Hadir') as attendance_status,
                a.keterangan,
                a.pencatat_type,
                CASE 
                    WHEN a.pencatat_type = 'siswa' THEN sp.nama
                    WHEN a.pencatat_type = 'guru' THEN g.nama
                    ELSE NULL
                END as pencatat_nama
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND a.jadwal_id = ? AND a.tanggal = ?
            LEFT JOIN siswa sp ON a.siswa_pencatat_id = sp.id_siswa
            LEFT JOIN guru g ON a.guru_pengabsen_id = g.id_guru
            WHERE s.kelas_id = ? AND s.status = 'aktif'
            ORDER BY s.nama ASC
        `, [jadwal_id, targetDate, kelasId]);

        log.success('GetStudentsForPiketAbsen', { count: students.length, jadwal_id });
        res.json({
            success: true,
            data: students,
            guru_status: guruAbsen[0].status,
            guru_nama: guruAbsen[0].nama_guru
        });

    } catch (error) {
        log.dbError('getStudentsForPiketAbsen', error, { siswa_id, jadwal_id });
        return sendDatabaseError(res, error, 'Gagal memuat daftar siswa');
    }
}

/**
 * Submit student attendance by siswa perwakilan (piket)
 * Only allowed when guru is marked as "Tidak Hadir"
 * @route POST /api/siswa/submit-absensi-siswa
 */
export async function submitStudentAttendanceByPiket(req, res) {
    const log = logger.withRequest(req, res);
    const { siswa_pencatat_id, jadwal_id, tanggal_absen, attendance_data } = req.body;

    log.requestStart('SubmitStudentAttendanceByPiket', { 
        siswa_pencatat_id, 
        jadwal_id, 
        entryCount: Object.keys(attendance_data || {}).length 
    });

    if (!validateUserContext(req, res) || !validatePerwakilanAccess(req, res)) {
        return;
    }

    try {
        // Step 1: Validate required data
        const dataValidation = validatePiketData(siswa_pencatat_id, jadwal_id, attendance_data);
        if (dataValidation) {
            return sendValidationError(res, dataValidation.error);
        }

        if (!validateSelfAccess(req, res, siswa_pencatat_id, 'siswa_id')) {
            return;
        }

        if (req.user.kelas_id) {
            const [jadwalRows] = await db.execute(
                'SELECT kelas_id FROM jadwal WHERE id_jadwal = ? LIMIT 1',
                [jadwal_id]
            );
            if (jadwalRows.length === 0) {
                return sendNotFoundError(res, 'Jadwal tidak ditemukan');
            }
            if (jadwalRows[0].kelas_id !== req.user.kelas_id) {
                return sendPermissionError(res, 'Jadwal tidak sesuai dengan kelas Anda');
            }
        }

        const targetDate = tanggal_absen || getMySQLDateWIB();

        const todayStr = getMySQLDateWIB();

        // Step 2: Validate date (only today allowed for piket)
        if (targetDate !== todayStr) {
            return sendValidationError(res, `Absensi oleh piket hanya bisa dilakukan untuk hari ini (${todayStr}). Tanggal yang diminta: ${targetDate}`);
        }

        // Step 3: Validate piket access to this jadwal
        const accessResult = await validatePiketAccess(db, siswa_pencatat_id, jadwal_id);
        if (accessResult.error) {
            return accessResult.notFound 
                ? sendNotFoundError(res, accessResult.error)
                : sendValidationError(res, accessResult.error);
        }

        // Step 4: Validate guru is absent (required for piket to submit)
        const guruValidation = await validateGuruAbsentStatus(db, jadwal_id, targetDate);
        if (guruValidation.error) {
            return sendValidationError(res, guruValidation.error);
        }

        // Step 5: Process attendance records
        const connection = await db.getConnection();
        const waktuAbsen = getMySQLDateTimeWIB();
        let processed = 0;

        try {
            await connection.beginTransaction();

            for (const [studentId, data] of Object.entries(attendance_data)) {
                const success = await processStudentAttendanceRecord(
                    connection, studentId, data, jadwal_id, targetDate, siswa_pencatat_id, waktuAbsen
                );
                if (success) processed++;
            }

            await connection.commit();

            log.success('SubmitStudentAttendanceByPiket', { 
                siswa_pencatat_id, 
                jadwal_id, 
                processed, 
                targetDate 
            });

            res.json({
                success: true,
                message: `Absensi ${processed} siswa berhasil disimpan oleh piket`,
                processed,
                date: targetDate
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        log.dbError('submitStudentAttendanceByPiket', error, { siswa_pencatat_id, jadwal_id });
        return sendDatabaseError(res, error, 'Gagal menyimpan absensi siswa');
    }
}

/**
 * Update teacher attendance status (real-time update by class representative)
 * @route POST /api/siswa/update-status-guru
 * @description Allows class representative to update teacher attendance status in real-time
 */
export async function updateTeacherStatus(req, res) {
    const log = logger.withRequest(req, res);
    const { jadwal_id, guru_id, status, keterangan, tanggal_absen, ada_tugas, terlambat } = req.body;
    
    log.requestStart('UpdateTeacherStatus', { jadwal_id, guru_id, status });

    // Validate user context and perwakilan access
    if (!validateUserContext(req, res) || !validatePerwakilanAccess(req, res)) {
        return;
    }

    try {
        // Validate required fields
        if (!jadwal_id || !guru_id || !status) {
            log.validationFail('required_fields', { jadwal_id, guru_id, status }, 'Missing required fields');
            return sendValidationError(res, 'jadwal_id, guru_id, dan status wajib diisi');
        }

        // Validate status
        if (!VALID_TEACHER_STATUSES.has(status)) {
            log.validationFail('status', status, 'Invalid status');
            return sendValidationError(res, `Status tidak valid. Gunakan: ${[...VALID_TEACHER_STATUSES].join(', ')}`);
        }

        // Validate jadwal belongs to user's class
        if (req.user.kelas_id) {
            const [jadwalRows] = await db.execute(
                'SELECT kelas_id FROM jadwal WHERE id_jadwal = ? LIMIT 1',
                [jadwal_id]
            );
            if (jadwalRows.length === 0) {
                log.warn('Schedule not found', { jadwal_id });
                return sendNotFoundError(res, 'Jadwal tidak ditemukan');
            }
            if (jadwalRows[0].kelas_id !== req.user.kelas_id) {
                log.warn('Schedule class mismatch', { jadwal_id, kelas_id: jadwalRows[0].kelas_id });
                return sendPermissionError(res, 'Jadwal tidak sesuai dengan kelas Anda');
            }
        }

        const targetDate = tanggal_absen || getMySQLDateWIB();
        
        // Map status with flags
        let finalStatus = status;
        let isLate = 0;
        let hasTask = 0;

        if (terlambat && status === 'Hadir') {
            isLate = 1;
        }
        if (ada_tugas && ['Tidak Hadir', 'Alpa', 'Izin', 'Sakit'].includes(status)) {
            hasTask = 1;
        }

        // Check if record exists
        const [existing] = await db.execute(
            'SELECT id_absensi FROM absensi_guru WHERE jadwal_id = ? AND guru_id = ? AND tanggal = ? LIMIT 1',
            [jadwal_id, guru_id, targetDate]
        );

        if (existing.length > 0) {
            // Update existing record
            await db.execute(
                `UPDATE absensi_guru 
                 SET status = ?, keterangan = ?, terlambat = ?, ada_tugas = ?, updated_at = NOW()
                 WHERE id_absensi = ?`,
                [finalStatus, keterangan || null, isLate, hasTask, existing[0].id_absensi]
            );
            log.success('UpdateTeacherStatus', { action: 'update', jadwal_id, guru_id, status: finalStatus });
        } else {
            // Insert new record
            await db.execute(
                `INSERT INTO absensi_guru (jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, status, keterangan, terlambat, ada_tugas)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [jadwal_id, guru_id, req.user.kelas_id, req.user.siswa_id, targetDate, finalStatus, keterangan || null, isLate, hasTask]
            );
            log.success('UpdateTeacherStatus', { action: 'insert', jadwal_id, guru_id, status: finalStatus });
        }

        res.json({
            success: true,
            message: existing.length > 0 ? 'Status guru berhasil diperbarui' : 'Absensi guru berhasil dicatat',
            data: {
                jadwal_id,
                guru_id,
                status: finalStatus,
                tanggal: targetDate
            }
        });

    } catch (error) {
        log.dbError('updateTeacherStatus', error, { jadwal_id, guru_id });
        return sendDatabaseError(res, error, 'Gagal memperbarui status guru');
    }
}

/**
 * Get class attendance history with statistics
 * @route GET /api/siswa/:siswa_id/riwayat-kehadiran
 * @description Returns attendance history for the student's class
 */
export async function getClassAttendanceHistory(req, res) {
    const log = logger.withRequest(req, res);
    const { siswa_id } = req.params;
    const { start_date, end_date, limit = 30 } = req.query;
    
    log.requestStart('GetClassAttendanceHistory', { siswa_id, start_date, end_date });

    if (!validateUserContext(req, res)) {
        return;
    }

    // Validate self access
    if (!validateSelfAccess(req, res, parseInt(siswa_id), 'siswa_id')) {
        return;
    }

    try {
        // Get student's class
        const [siswaRows] = await db.execute(
            'SELECT kelas_id FROM siswa WHERE id_siswa = ? AND status = "aktif" LIMIT 1',
            [siswa_id]
        );

        if (siswaRows.length === 0) {
            log.warn('Student not found', { siswa_id });
            return sendNotFoundError(res, 'Siswa tidak ditemukan');
        }

        const kelasId = siswaRows[0].kelas_id;

        // Build date filter
        let dateFilter = '';
        const params = [kelasId];
        
        if (start_date && end_date) {
            dateFilter = 'AND ag.tanggal BETWEEN ? AND ?';
            params.push(start_date, end_date);
        } else {
            // Default: last 30 days
            dateFilter = 'AND ag.tanggal >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
        }

        // Get teacher attendance history for this class
        const [history] = await db.query(`
            SELECT 
                ag.tanggal,
                ag.status,
                ag.keterangan,
                ag.terlambat,
                ag.ada_tugas,
                g.nama as guru_nama,
                m.nama_mapel,
                j.hari,
                j.jam_mulai,
                j.jam_selesai
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            JOIN guru g ON ag.guru_id = g.id_guru
            JOIN mapel m ON j.mapel_id = m.id_mapel
            WHERE j.kelas_id = ? ${dateFilter}
            ORDER BY ag.tanggal DESC, j.jam_mulai ASC
            LIMIT ?
        `, [...params, parseInt(limit)]);

        // Calculate statistics
        const stats = {
            total: history.length,
            hadir: history.filter(h => h.status === 'Hadir').length,
            tidak_hadir: history.filter(h => h.status === 'Tidak Hadir').length,
            izin: history.filter(h => h.status === 'Izin').length,
            sakit: history.filter(h => h.status === 'Sakit').length,
            terlambat: history.filter(h => h.terlambat === 1).length
        };

        // Calculate percentage
        if (stats.total > 0) {
            stats.persentase_hadir = Math.round((stats.hadir / stats.total) * 100);
        } else {
            stats.persentase_hadir = 0;
        }

        log.success('GetClassAttendanceHistory', { kelasId, count: history.length });
        
        res.json({
            success: true,
            data: {
                history,
                statistics: stats,
                kelas_id: kelasId
            }
        });

    } catch (error) {
        log.dbError('getClassAttendanceHistory', error, { siswa_id });
        return sendDatabaseError(res, error, 'Gagal memuat riwayat kehadiran');
    }
}

/**
 * Get student's own attendance status for a specific date and schedule
 * @route GET /api/siswa/:siswaId/status-kehadiran
 * @description Returns the student's attendance status for specified date/schedule
 */
export async function getStudentAttendanceStatus(req, res) {
    const log = logger.withRequest(req, res);
    const { siswaId } = req.params;
    const { tanggal, jadwal_id } = req.query;
    
    log.requestStart('GetStudentAttendanceStatus', { siswaId, tanggal, jadwal_id });

    if (!validateUserContext(req, res)) {
        return;
    }

    // Validate self access
    if (!validateSelfAccess(req, res, parseInt(siswaId), 'siswa_id')) {
        return;
    }

    try {
        const targetDate = tanggal || getMySQLDateWIB();

        // Build query based on whether jadwal_id is provided
        let query;
        let params;

        if (jadwal_id) {
            // Get specific schedule attendance
            query = `
                SELECT 
                    a.id,
                    a.status,
                    a.keterangan,
                    a.tanggal,
                    a.waktu_absen,
                    a.terlambat,
                    j.id_jadwal,
                    j.hari,
                    j.jam_mulai,
                    j.jam_selesai,
                    m.nama_mapel,
                    g.nama as guru_nama,
                    CASE 
                        WHEN a.pencatat_type = 'guru' THEN gp.nama
                        WHEN a.pencatat_type = 'siswa' THEN sp.nama
                        ELSE NULL
                    END as pencatat_nama,
                    a.pencatat_type
                FROM siswa s
                LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                    AND a.jadwal_id = ? AND a.tanggal = ?
                LEFT JOIN jadwal j ON a.jadwal_id = j.id_jadwal
                LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
                LEFT JOIN guru g ON j.guru_id = g.id_guru
                LEFT JOIN guru gp ON a.guru_pengabsen_id = gp.id_guru
                LEFT JOIN siswa sp ON a.siswa_pencatat_id = sp.id_siswa
                WHERE s.id_siswa = ?
                LIMIT 1
            `;
            params = [jadwal_id, targetDate, siswaId];
        } else {
            // Get all attendance for the day
            query = `
                SELECT 
                    a.id,
                    a.status,
                    a.keterangan,
                    a.tanggal,
                    a.waktu_absen,
                    a.terlambat,
                    j.id_jadwal,
                    j.hari,
                    j.jam_mulai,
                    j.jam_selesai,
                    m.nama_mapel,
                    g.nama as guru_nama,
                    CASE 
                        WHEN a.pencatat_type = 'guru' THEN gp.nama
                        WHEN a.pencatat_type = 'siswa' THEN sp.nama
                        ELSE NULL
                    END as pencatat_nama,
                    a.pencatat_type
                FROM absensi_siswa a
                JOIN jadwal j ON a.jadwal_id = j.id_jadwal
                JOIN mapel m ON j.mapel_id = m.id_mapel
                LEFT JOIN guru g ON j.guru_id = g.id_guru
                LEFT JOIN guru gp ON a.guru_pengabsen_id = gp.id_guru
                LEFT JOIN siswa sp ON a.siswa_pencatat_id = sp.id_siswa
                WHERE a.siswa_id = ? AND a.tanggal = ?
                ORDER BY j.jam_mulai ASC
            `;
            params = [siswaId, targetDate];
        }

        const [results] = await db.execute(query, params);

        // Calculate daily statistics if getting all attendance
        let statistics = null;
        if (!jadwal_id && results.length > 0) {
            statistics = {
                total: results.length,
                hadir: results.filter(r => r.status === 'Hadir').length,
                izin: results.filter(r => r.status === 'Izin').length,
                sakit: results.filter(r => r.status === 'Sakit').length,
                alpa: results.filter(r => r.status === 'Alpa').length,
                dispen: results.filter(r => r.status === 'Dispen').length,
                terlambat: results.filter(r => r.terlambat === 1).length
            };
        }

        log.success('GetStudentAttendanceStatus', { siswaId, tanggal: targetDate, count: results.length });

        res.json({
            success: true,
            data: jadwal_id ? (results[0] || null) : results,
            statistics,
            tanggal: targetDate
        });

    } catch (error) {
        log.dbError('getStudentAttendanceStatus', error, { siswaId, tanggal, jadwal_id });
        return sendDatabaseError(res, error, 'Gagal memuat status kehadiran');
    }
}

