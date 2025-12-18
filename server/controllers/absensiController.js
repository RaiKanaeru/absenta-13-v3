/**
 * Absensi Controller
 * Handles all attendance-related operations for both students and teachers
 * 
 * @description This controller manages:
 * - Student attendance tracking (recorded by teachers)
 * - Teacher attendance tracking (recorded by class representatives/siswa perwakilan)
 * - Attendance history and statistics
 * - Multi-guru schedule support
 * 
 * @tables
 * - absensi_siswa: Student attendance records
 * - absensi_guru: Teacher attendance records (recorded by class representatives)
 * - jadwal: Schedule information with multi-guru support
 * - jadwal_guru: Multi-teacher schedule assignments
 */

import {
    getWIBTime,
    getMySQLDateWIB,
    getMySQLDateTimeWIB,
    formatWIBDate,
    formatWIBTimeWithSeconds,
    getDaysDifferenceWIB
} from '../utils/timeUtils.js';
import { sendDatabaseError, sendValidationError, sendNotFoundError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Absensi');

// ===========================
// CONSTANTS
// ===========================

/** Valid status values for student attendance */
const VALID_STUDENT_STATUSES = ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispen'];

/** Valid status values for teacher attendance */
const VALID_TEACHER_STATUSES = ['Hadir', 'Tidak Hadir', 'Izin', 'Sakit'];

/** Maximum days allowed for teacher to edit past attendance */
const TEACHER_EDIT_DAYS_LIMIT = 30;

/** Maximum days allowed for student (class rep) to edit past attendance */
const STUDENT_EDIT_DAYS_LIMIT = 7;

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
        const [scheduleData] = await global.dbPool.execute(
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

        const [students] = await global.dbPool.execute(query, params);

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
        const today = getWIBTime();
        const thirtyDaysAgo = new Date(today.getTime() - (TEACHER_EDIT_DAYS_LIMIT * 24 * 60 * 60 * 1000));
        const targetDate = tanggal ? new Date(tanggal) : today;

        if (targetDate > today) {
            log.validationFail('tanggal', tanggal, 'Future date not allowed');
            return sendValidationError(res, 'Tidak dapat melihat absen untuk tanggal masa depan');
        }

        if (targetDate < thirtyDaysAgo) {
            log.validationFail('tanggal', tanggal, 'Date too old');
            return sendValidationError(res, `Tidak dapat melihat absen lebih dari ${TEACHER_EDIT_DAYS_LIMIT} hari yang lalu`);
        }

        const [scheduleData] = await global.dbPool.execute(
            'SELECT kelas_id FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [id]
        );

        if (scheduleData.length === 0) {
            log.warn('Schedule not found', { scheduleId: id });
            return sendNotFoundError(res, 'Jadwal tidak ditemukan');
        }

        const kelasId = scheduleData[0].kelas_id;
        const targetDateStr = tanggal || formatWIBDate();

        const [students] = await global.dbPool.execute(`
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

    try {
        if (!scheduleId || !attendance || !guruId) {
            log.validationFail('required_fields', null, 'Missing scheduleId, attendance, or guruId');
            return sendValidationError(res, 'Data absensi tidak lengkap');
        }

        const [scheduleData] = await global.dbPool.execute(
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

        for (const [studentId, attendanceData] of attendanceEntries) {
            const parsed = parseAttendanceData(attendanceData);
            if (!parsed) {
                log.validationFail('attendance_data', studentId, 'Invalid format');
                return sendValidationError(res, `Format data absensi tidak valid untuk siswa ${studentId}`);
            }

            const { status, terlambat, ada_tugas } = parsed;

            if (!VALID_STUDENT_STATUSES.includes(status)) {
                log.validationFail('status', status, 'Invalid status');
                return sendValidationError(res, `Status tidak valid: ${status}. Status yang diperbolehkan: ${VALID_STUDENT_STATUSES.join(', ')}`);
            }

            const { finalStatus, isLate, hasTask } = mapAttendanceStatus(status, terlambat, ada_tugas);
            const note = status === 'Hadir' ? '' : (notes[studentId] || '');

            const [existingAttendance] = await global.dbPool.execute(
                'SELECT id FROM absensi_siswa WHERE siswa_id = ? AND jadwal_id = ? AND guru_pengabsen_id = ? AND tanggal = ?',
                [studentId, scheduleId, guruId, targetDate]
            );

            const waktuAbsen = `${targetDate} ${currentTime}`;

            if (existingAttendance.length > 0) {
                await global.dbPool.execute(
                    `UPDATE absensi_siswa 
                     SET status = ?, keterangan = ?, waktu_absen = ?, guru_id = ?, terlambat = ?, ada_tugas = ? 
                     WHERE id = ?`,
                    [finalStatus, note, waktuAbsen, guruId, isLate, hasTask, existingAttendance[0].id]
                );
            } else {
                await global.dbPool.execute(
                    `INSERT INTO absensi_siswa 
                     (siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, guru_id, guru_pengabsen_id, terlambat, ada_tugas) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [studentId, scheduleId, targetDate, finalStatus, note, waktuAbsen, guruId, guruId, isLate, hasTask]
                );
            }

            processedStudents.push({ studentId, status: finalStatus });
        }

        if (isMultiGuru) {
            await syncMultiGuruAttendance(scheduleId, guruId, attendance, notes, targetDate, currentTime);
        }

        log.success('SubmitStudentAttendance', { scheduleId, processed: processedStudents.length, date: targetDate });
        res.json({
            message: 'Absensi berhasil disimpan',
            processed: processedStudents.length,
            date: targetDate,
            scheduleId,
            isMultiGuru
        });
    } catch (error) {
        log.dbError('submitStudentAttendance', error, { scheduleId });
        return sendDatabaseError(res, error, 'Gagal menyimpan absensi');
    }
}

/**
 * Syncs attendance data to other teachers in multi-guru schedules
 * @private
 */
async function syncMultiGuruAttendance(scheduleId, primaryGuruId, attendance, notes, targetDate, currentTime) {
    logger.debug('Multi-guru sync started', { scheduleId, primaryGuruId });

    const [allTeachers] = await global.dbPool.execute(
        'SELECT guru_id FROM jadwal_guru WHERE jadwal_id = ? AND guru_id != ?',
        [scheduleId, primaryGuruId]
    );

    if (allTeachers.length === 0) return;

    logger.debug('Syncing to other teachers', { count: allTeachers.length });

    for (const teacher of allTeachers) {
        const otherGuruId = teacher.guru_id;

        for (const [studentId, attendanceData] of Object.entries(attendance)) {
            const parsed = parseAttendanceData(attendanceData);
            if (!parsed) continue;

            const { status, terlambat, ada_tugas } = parsed;
            const { finalStatus, isLate, hasTask } = mapAttendanceStatus(status, terlambat, ada_tugas);
            const note = status === 'Hadir' ? '' : (notes[studentId] || '');
            const waktuAbsen = `${targetDate} ${currentTime}`;

            const [existing] = await global.dbPool.execute(
                'SELECT id FROM absensi_siswa WHERE siswa_id = ? AND jadwal_id = ? AND guru_pengabsen_id = ? AND tanggal = ?',
                [studentId, scheduleId, otherGuruId, targetDate]
            );

            if (existing.length > 0) {
                await global.dbPool.execute(
                    `UPDATE absensi_siswa 
                     SET status = ?, keterangan = ?, waktu_absen = ?, guru_id = ?, terlambat = ?, ada_tugas = ? 
                     WHERE id = ?`,
                    [finalStatus, note, waktuAbsen, otherGuruId, isLate, hasTask, existing[0].id]
                );
            } else {
                await global.dbPool.execute(
                    `INSERT INTO absensi_siswa 
                     (siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, guru_id, guru_pengabsen_id, terlambat, ada_tugas) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [studentId, scheduleId, targetDate, finalStatus, note, waktuAbsen, otherGuruId, otherGuruId, isLate, hasTask]
                );
            }
        }
    }

    logger.debug('Multi-guru sync completed', { syncedTeachers: allTeachers.length });
}

// ===========================
// TEACHER ATTENDANCE OPERATIONS
// (Recorded by Class Representatives)
// ===========================

/**
 * Submit teacher attendance (by class representative)
 * @route POST /api/siswa/submit-kehadiran-guru
 */
export async function submitTeacherAttendance(req, res) {
    const log = logger.withRequest(req, res);
    const { siswa_id, kehadiran_data, tanggal_absen } = req.body;
    log.requestStart('SubmitTeacherAttendance', { siswa_id, entryCount: Object.keys(kehadiran_data || {}).length });

    try {
        if (!siswa_id) {
            log.validationFail('siswa_id', null, 'Required');
            return sendValidationError(res, 'siswa_id is required');
        }

        if (!kehadiran_data || typeof kehadiran_data !== 'object') {
            log.validationFail('kehadiran_data', null, 'Required object');
            return sendValidationError(res, 'kehadiran_data is required and must be an object');
        }

        const targetDate = tanggal_absen || getMySQLDateWIB();
        const dateValidation = validateDateRange(targetDate, STUDENT_EDIT_DAYS_LIMIT);

        if (!dateValidation.valid) {
            log.validationFail('tanggal', targetDate, dateValidation.error);
            return sendValidationError(res, dateValidation.error);
        }

        if (!global.dbPool) {
            log.error('Database not available', null);
            return res.status(503).json({ error: 'Database connection not available' });
        }

        const connection = await global.dbPool.getConnection();

        try {
            await connection.beginTransaction();

            for (const [key, data] of Object.entries(kehadiran_data)) {
                await processTeacherAttendanceEntry(connection, key, data, siswa_id, targetDate);
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
 * Process a single teacher attendance entry
 * @private
 */
async function processTeacherAttendanceEntry(connection, key, data, siswa_id, targetDate) {
    const { status, keterangan, terlambat, ada_tugas, guru_id: specific_guru_id } = data;

    let jadwalId, guru_id;

    if (key.includes('-')) {
        [jadwalId, guru_id] = key.split('-');
        guru_id = parseInt(guru_id);
    } else {
        jadwalId = key;

        if (specific_guru_id) {
            guru_id = specific_guru_id;
        } else {
            const [jadwalDetails] = await connection.execute(
                'SELECT guru_id FROM jadwal WHERE id_jadwal = ?',
                [jadwalId]
            );

            if (jadwalDetails.length === 0) {
                throw new Error(`Jadwal dengan ID ${jadwalId} tidak ditemukan`);
            }

            guru_id = jadwalDetails[0].guru_id;

            if (!guru_id) {
                guru_id = await getPrimaryTeacherForSchedule(connection, jadwalId);
            }
        }
    }

    const [jadwalDetails] = await connection.execute(
        'SELECT kelas_id, jam_ke, is_absenable, jenis_aktivitas FROM jadwal WHERE id_jadwal = ?',
        [jadwalId]
    );

    if (jadwalDetails.length === 0) {
        throw new Error(`Jadwal dengan ID ${jadwalId} tidak ditemukan`);
    }

    const { kelas_id, jam_ke, is_absenable, jenis_aktivitas } = jadwalDetails[0];

    if (!is_absenable) {
        logger.debug('Skipping non-absenable schedule', { jadwalId, jenis_aktivitas });
        return;
    }

    if (!guru_id) {
        throw new Error(`Guru ID tidak ditemukan untuk jadwal ${jadwalId}`);
    }

    const { finalStatus, isLate, hasTask } = mapAttendanceStatus(status, terlambat, ada_tugas);

    const [existingRecord] = await connection.execute(
        'SELECT id_absensi FROM absensi_guru WHERE jadwal_id = ? AND guru_id = ? AND tanggal = ?',
        [jadwalId, guru_id, targetDate]
    );

    const waktuCatatWIB = getMySQLDateTimeWIB();

    if (existingRecord.length > 0) {
        await connection.execute(`
            UPDATE absensi_guru 
            SET status = ?, keterangan = ?, siswa_pencatat_id = ?, waktu_catat = ?, terlambat = ?, ada_tugas = ?
            WHERE jadwal_id = ? AND guru_id = ? AND tanggal = ?`,
            [finalStatus, keterangan || null, siswa_id, waktuCatatWIB, isLate, hasTask, jadwalId, guru_id, targetDate]
        );
    } else {
        await connection.execute(`
            INSERT INTO absensi_guru 
            (jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, jam_ke, status, keterangan, waktu_catat, terlambat, ada_tugas) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [jadwalId, guru_id, kelas_id, siswa_id, targetDate, jam_ke, finalStatus, keterangan || null, waktuCatatWIB, isLate, hasTask]
        );
    }
}

/**
 * Update single teacher status (real-time save by class representative)
 * @route POST /api/siswa/update-status-guru
 */
export async function updateTeacherStatus(req, res) {
    const log = logger.withRequest(req, res);
    const { jadwal_id, guru_id, status, keterangan, tanggal_absen, ada_tugas } = req.body;
    const siswa_id = req.user.siswa_id;
    log.requestStart('UpdateTeacherStatus', { jadwal_id, guru_id, status });

    try {
        if (!jadwal_id || !guru_id || !status || !tanggal_absen) {
            log.validationFail('required_fields', null, 'Missing jadwal_id, guru_id, status, or tanggal_absen');
            return sendValidationError(res, 'Jadwal ID, guru ID, status, dan tanggal absen wajib diisi');
        }

        if (!VALID_TEACHER_STATUSES.includes(status)) {
            log.validationFail('status', status, 'Invalid teacher status');
            return sendValidationError(res, 'Status tidak valid');
        }

        if (!global.dbPool) {
            log.error('Database not available', null);
            return res.status(503).json({ error: 'Database connection not available' });
        }

        const [jadwalRows] = await global.dbPool.execute(
            'SELECT kelas_id, jam_ke FROM jadwal WHERE id_jadwal = ? LIMIT 1',
            [jadwal_id]
        );

        if (jadwalRows.length === 0) {
            log.warn('Schedule not found', { jadwal_id });
            return sendNotFoundError(res, 'Jadwal tidak ditemukan');
        }

        const { kelas_id, jam_ke } = jadwalRows[0];
        const waktuCatatWIB = getMySQLDateTimeWIB();

        const [existing] = await global.dbPool.execute(
            'SELECT id_absensi FROM absensi_guru WHERE jadwal_id = ? AND guru_id = ? AND tanggal = ?',
            [jadwal_id, guru_id, tanggal_absen]
        );

        if (existing.length > 0) {
            await global.dbPool.execute(`
                UPDATE absensi_guru 
                SET status = ?, keterangan = ?, siswa_pencatat_id = ?, waktu_catat = ?, ada_tugas = ?
                WHERE jadwal_id = ? AND guru_id = ? AND tanggal = ?`,
                [status, keterangan || null, siswa_id, waktuCatatWIB, ada_tugas ? 1 : 0, jadwal_id, guru_id, tanggal_absen]
            );
            log.debug('Updated teacher status', { jadwal_id, guru_id, status });
        } else {
            await global.dbPool.execute(`
                INSERT INTO absensi_guru 
                (jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, jam_ke, status, keterangan, waktu_catat, ada_tugas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [jadwal_id, guru_id, kelas_id, siswa_id, tanggal_absen, jam_ke, status, keterangan || null, waktuCatatWIB, ada_tugas ? 1 : 0]
            );
            log.debug('Inserted teacher status', { jadwal_id, guru_id, status });
        }

        log.success('UpdateTeacherStatus', { jadwal_id, guru_id, status });
        res.json({ success: true, message: 'Status kehadiran guru berhasil diperbarui' });
    } catch (error) {
        log.dbError('updateTeacherStatus', error, { jadwal_id, guru_id });
        return sendDatabaseError(res, error);
    }
}

// ===========================
// ATTENDANCE HISTORY & REPORTS
// ===========================

/**
 * Get class attendance history (for class representative)
 * @route GET /api/siswa/:siswa_id/riwayat-kehadiran
 */
export async function getClassAttendanceHistory(req, res) {
    const log = logger.withRequest(req, res);
    const { siswa_id } = req.params;
    log.requestStart('GetClassAttendanceHistory', { siswa_id });

    try {
        const [siswaData] = await global.dbPool.execute(
            'SELECT kelas_id, nama FROM siswa WHERE id_siswa = ?',
            [siswa_id]
        );

        if (siswaData.length === 0) {
            log.warn('Student not found', { siswa_id });
            return sendNotFoundError(res, 'Siswa tidak ditemukan');
        }

        const kelasId = siswaData[0].kelas_id;

        const [totalSiswaResult] = await global.dbPool.execute(
            'SELECT COUNT(*) as total FROM siswa WHERE kelas_id = ?',
            [kelasId]
        );
        const totalSiswa = totalSiswaResult[0].total;

        const [riwayatData] = await global.dbPool.execute(`
            SELECT 
                ag.tanggal,
                j.id_jadwal,
                j.jam_ke,
                j.jam_mulai,
                j.jam_selesai,
                mp.nama_mapel,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                ag.status as status_kehadiran,
                ag.keterangan,
                s.nama as nama_pencatat,
                rk.kode_ruang,
                rk.nama_ruang,
                j.is_multi_guru,
                (SELECT GROUP_CONCAT(
                    CONCAT(g2.id_guru, ':', COALESCE(g2.nama, ''), ':', COALESCE(ag2.status, 'belum_diambil'), ':', COALESCE(ag2.keterangan, '')) 
                    ORDER BY jg2.is_primary DESC, g2.nama ASC 
                    SEPARATOR '||'
                ) FROM jadwal_guru jg2
                LEFT JOIN guru g2 ON jg2.guru_id = g2.id_guru
                LEFT JOIN absensi_guru ag2 ON j.id_jadwal = ag2.jadwal_id AND ag2.tanggal = ag.tanggal AND ag2.guru_id = g2.id_guru
                WHERE jg2.jadwal_id = j.id_jadwal) as guru_list,
                (SELECT GROUP_CONCAT(
                    CONCAT(s2.nama, ':', s2.nis, ':', COALESCE(LOWER(abs2.status), 'tidak_hadir'))
                    SEPARATOR '|'
                ) FROM siswa s2 
                LEFT JOIN absensi_siswa abs2 ON s2.id_siswa = abs2.siswa_id AND abs2.jadwal_id = j.id_jadwal AND DATE(abs2.waktu_absen) = ag.tanggal
                WHERE s2.kelas_id = ?) as siswa_data
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            LEFT JOIN mapel mp ON j.mapel_id = mp.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            LEFT JOIN siswa s ON ag.siswa_pencatat_id = s.id_siswa
            WHERE j.kelas_id = ? 
            ORDER BY ag.tanggal DESC, j.jam_ke ASC`,
            [kelasId, kelasId]
        );

        const groupedData = groupAttendanceByDate(riwayatData, totalSiswa);

        log.success('GetClassAttendanceHistory', { siswa_id, days: Object.keys(groupedData).length });
        res.json(Object.values(groupedData));
    } catch (error) {
        log.dbError('getClassAttendanceHistory', error, { siswa_id });
        return sendDatabaseError(res, error, 'Gagal memuat riwayat kehadiran');
    }
}

/**
 * Groups attendance data by date and calculates statistics
 * @private
 */
function groupAttendanceByDate(riwayatData, totalSiswa) {
    const groupedData = {};

    riwayatData.forEach(row => {
        const dateKey = row.tanggal;
        if (!groupedData[dateKey]) {
            groupedData[dateKey] = { tanggal: dateKey, jadwal: [] };
        }

        const siswaStats = parseStudentAttendanceStats(row.siswa_data);

        groupedData[dateKey].jadwal.push({
            jadwal_id: row.id_jadwal,
            jam_ke: row.jam_ke,
            jam_mulai: row.jam_mulai,
            jam_selesai: row.jam_selesai,
            nama_mapel: row.nama_mapel,
            nama_guru: row.nama_guru,
            kode_ruang: row.kode_ruang,
            nama_ruang: row.nama_ruang,
            status_kehadiran: row.status_kehadiran,
            keterangan: row.keterangan,
            nama_pencatat: row.nama_pencatat,
            total_siswa: totalSiswa,
            ...siswaStats
        });
    });

    return groupedData;
}

/**
 * Parses student attendance statistics from concatenated string
 * @private
 */
function parseStudentAttendanceStats(siswaDataStr) {
    const stats = {
        total_hadir: 0,
        total_izin: 0,
        total_sakit: 0,
        total_alpa: 0,
        total_tidak_hadir: 0,
        siswa_tidak_hadir: []
    };

    if (!siswaDataStr) return stats;

    const siswaDataRaw = siswaDataStr.split('|');

    siswaDataRaw.forEach(data => {
        const [nama, nis, statusRaw] = data.split(':');
        const normalizedStatus = statusRaw ? statusRaw.toLowerCase() : 'tidak_hadir';

        switch (normalizedStatus) {
            case 'hadir':
            case 'dispen':  // Dispen is considered Hadir (present with dispensation)
                stats.total_hadir++;
                break;
            case 'izin':
                stats.total_izin++;
                stats.siswa_tidak_hadir.push({ nama_siswa: nama, nis: nis || '', status: 'izin' });
                break;
            case 'sakit':
                stats.total_sakit++;
                stats.siswa_tidak_hadir.push({ nama_siswa: nama, nis: nis || '', status: 'sakit' });
                break;
            case 'alpa':
                stats.total_alpa++;
                stats.siswa_tidak_hadir.push({ nama_siswa: nama, nis: nis || '', status: 'alpa' });
                break;
            case 'tidak_hadir':
            default:
                stats.total_tidak_hadir++;
                stats.siswa_tidak_hadir.push({ nama_siswa: nama, nis: nis || '', status: normalizedStatus });
                break;
        }
    });

    return stats;
}

/**
 * Get student's own attendance status for a specific date and schedule
 * @route GET /api/siswa/:siswaId/status-kehadiran
 */
export async function getStudentAttendanceStatus(req, res) {
    const log = logger.withRequest(req, res);
    const { siswaId } = req.params;
    const { tanggal, jadwal_id } = req.query;
    log.requestStart('GetStudentAttendanceStatus', { siswaId, tanggal, jadwal_id });

    try {
        if (!tanggal || !jadwal_id) {
            log.validationFail('params', { tanggal, jadwal_id }, 'Missing required params');
            return sendValidationError(res, 'Tanggal dan jadwal_id wajib diisi');
        }

        const [rows] = await global.dbPool.execute(`
            SELECT 
                a.status,
                a.keterangan,
                a.tanggal,
                COALESCE(m.nama_mapel, 'Umum') as nama_mapel,
                COALESCE(g.nama, 'Sistem') as nama_guru
            FROM absensi_siswa a
            LEFT JOIN jadwal j ON a.jadwal_id = j.id_jadwal
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON a.guru_pengabsen_id = g.id_guru
            WHERE a.siswa_id = ? AND a.tanggal = ? AND a.jadwal_id = ?
            ORDER BY a.tanggal DESC
            LIMIT 1`,
            [siswaId, tanggal, jadwal_id]
        );

        if (rows.length === 0) {
            log.debug('No attendance data found', { siswaId, tanggal, jadwal_id });
            return res.json({
                status: 'alpa',
                message: 'Tidak ada data kehadiran untuk siswa pada tanggal dan jadwal tersebut'
            });
        }

        const statusData = rows[0];
        log.success('GetStudentAttendanceStatus', { siswaId, status: statusData.status });

        res.json({
            status: statusData.status || 'alpa',
            keterangan: statusData.keterangan || '',
            tanggal: statusData.tanggal,
            nama_mapel: statusData.nama_mapel,
            nama_guru: statusData.nama_guru
        });
    } catch (error) {
        log.dbError('getStudentAttendanceStatus', error, { siswaId });
        return sendDatabaseError(res, error);
    }
}

// ===========================
// MIGRATED FROM SERVER_MODERN.JS
// ===========================

/**
 * Record attendance (Simple version for siswa marking guru)
 * POST /api/absensi
 */
export async function recordTeacherAttendanceSimple(req, res) {
    const log = logger.withRequest(req, res);
    const { jadwal_id, guru_id, status, keterangan, terlambat, ada_tugas } = req.body;
    log.requestStart('RecordTeacherAttendanceSimple', { jadwal_id, guru_id, status });

    try {
        const todayWIB = getMySQLDateWIB();
        const [existing] = await global.dbPool.execute(
            `SELECT * FROM absensi_guru WHERE jadwal_id = ? AND tanggal = ?`,
            [jadwal_id, todayWIB]
        );

        if (existing.length > 0) {
            log.validationFail('duplicate', { jadwal_id, tanggal: todayWIB }, 'Already recorded');
            return sendValidationError(res, 'Absensi untuk jadwal ini sudah dicatat hari ini');
        }

        const [jadwalData] = await global.dbPool.execute(
            'SELECT * FROM jadwal WHERE id_jadwal = ?',
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

        await global.dbPool.execute(
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
 * Get attendance history (Raw list for dashboard/widgets)
 * GET /api/absensi/history
 */
export async function getAbsensiHistory(req, res) {
    const log = logger.withRequest(req, res);
    const { date_start, date_end, limit = 50 } = req.query;
    log.requestStart('GetAbsensiHistory', { date_start, date_end, limit, role: req.user.role });

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
            const todayWIB = getMySQLDateWIB();
            const sevenDaysAgoWIB = new Date(new Date(todayWIB).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            whereConditions.push('ag.tanggal >= ?');
            params.push(sevenDaysAgoWIB);
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY ag.tanggal DESC, ag.waktu_catat DESC LIMIT ?';
        params.push(parseInt(limit));

        const [rows] = await global.dbPool.execute(query, params);

        log.success('GetAbsensiHistory', { count: rows.length, role: req.user.role });
        res.json({ success: true, data: rows });

    } catch (error) {
        log.dbError('getAbsensiHistory', error, { role: req.user.role });
        return sendDatabaseError(res, error, 'Gagal memuat riwayat absensi');
    }
}
