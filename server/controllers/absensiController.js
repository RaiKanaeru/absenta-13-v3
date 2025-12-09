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
 * @param {string} targetDate - Date to validate (YYYY-MM-DD)
 * @param {number} maxDaysAgo - Maximum days in the past allowed
 * @returns {{ valid: boolean, error: string | null }}
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
 * @param {string} status - Original status
 * @param {boolean} terlambat - Is late flag
 * @param {boolean} ada_tugas - Has task flag
 * @returns {{ finalStatus: string, isLate: number, hasTask: number }}
 */
function mapAttendanceStatus(status, terlambat = false, ada_tugas = false) {
    let finalStatus = status;
    let isLate = 0;
    let hasTask = 0;

    if (terlambat && status === 'Hadir') {
        isLate = 1;
        // Status remains 'Hadir' but marked as late
    } else if (ada_tugas && ['Alpa', 'Sakit', 'Izin', 'Tidak Hadir'].includes(status)) {
        hasTask = 1;
        // Status remains original but marked with task
    }

    return { finalStatus, isLate, hasTask };
}

/**
 * Parses attendance data from request body
 * Handles both old format (string) and new format (object with status, terlambat, ada_tugas)
 * @param {string|object} attendanceData - Attendance data from request
 * @returns {{ status: string, terlambat: boolean, ada_tugas: boolean } | null}
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
 * @param {object} connection - Database connection
 * @param {number} jadwalId - Schedule ID
 * @returns {Promise<number|null>} - Guru ID or null
 */
async function getPrimaryTeacherForSchedule(connection, jadwalId) {
    // Try to get primary teacher
    const [guruDetails] = await connection.execute(
        'SELECT guru_id FROM jadwal_guru WHERE jadwal_id = ? AND is_primary = 1 LIMIT 1',
        [jadwalId]
    );

    if (guruDetails.length > 0) {
        return guruDetails[0].guru_id;
    }

    // Fallback: get any teacher
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
 * @access Teacher, Admin
 */
export async function getStudentsForSchedule(req, res) {
    try {
        const { id } = req.params;
        console.log(`👥 Getting students for schedule ID: ${id}`);

        // Get schedule details
        const [scheduleData] = await global.dbPool.execute(
            'SELECT kelas_id, is_multi_guru FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [id]
        );

        if (scheduleData.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        const kelasId = scheduleData[0].kelas_id;
        const isMultiGuru = scheduleData[0].is_multi_guru === 1;
        const currentDate = getMySQLDateWIB();

        // Build dynamic query based on multi-guru status
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

        console.log(`✅ Found ${students.length} students for schedule ${id} (class ${kelasId})`);
        res.json(students);
    } catch (error) {
        console.error('❌ Error getting students for schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Get students for a specific schedule by date (for editing past attendance)
 * @route GET /api/schedule/:id/students-by-date?tanggal=YYYY-MM-DD
 * @access Teacher, Admin
 */
export async function getStudentsForScheduleByDate(req, res) {
    try {
        const { id } = req.params;
        const { tanggal } = req.query;
        console.log(`👥 Getting students for schedule ID: ${id} on date: ${tanggal}`);

        // Validate date range
        const today = getWIBTime();
        const thirtyDaysAgo = new Date(today.getTime() - (TEACHER_EDIT_DAYS_LIMIT * 24 * 60 * 60 * 1000));
        const targetDate = tanggal ? new Date(tanggal) : today;

        if (targetDate > today) {
            return res.status(400).json({ error: 'Tidak dapat melihat absen untuk tanggal masa depan' });
        }

        if (targetDate < thirtyDaysAgo) {
            return res.status(400).json({ 
                error: `Tidak dapat melihat absen lebih dari ${TEACHER_EDIT_DAYS_LIMIT} hari yang lalu` 
            });
        }

        // Get schedule details
        const [scheduleData] = await global.dbPool.execute(
            'SELECT kelas_id FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [id]
        );

        if (scheduleData.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
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

        console.log(`✅ Found ${students.length} students for schedule ${id} on date ${targetDateStr}`);
        res.json(students);
    } catch (error) {
        console.error('❌ Error getting students by date for schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Submit attendance for a schedule (by teacher)
 * Handles multi-guru auto-assignment for team teaching schedules
 * @route POST /api/attendance/submit
 * @access Teacher, Admin
 */
export async function submitStudentAttendance(req, res) {
    try {
        const { scheduleId, attendance, notes = {}, guruId, tanggal_absen } = req.body;

        // Validate required fields
        if (!scheduleId || !attendance || !guruId) {
            return res.status(400).json({ error: 'Data absensi tidak lengkap' });
        }

        console.log(`📝 Submitting attendance for schedule ${scheduleId} by teacher ${guruId}`);

        // Verify schedule exists
        const [scheduleData] = await global.dbPool.execute(
            'SELECT kelas_id, mapel_id, is_multi_guru FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [scheduleId]
        );

        if (scheduleData.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        const isMultiGuru = scheduleData[0].is_multi_guru === 1;

        // Validate date range
        const targetDate = tanggal_absen || getMySQLDateWIB();
        const dateValidation = validateDateRange(targetDate, TEACHER_EDIT_DAYS_LIMIT);

        if (!dateValidation.valid) {
            return res.status(400).json({ error: dateValidation.error });
        }

        // Process attendance records
        const attendanceEntries = Object.entries(attendance);
        const currentTime = formatWIBTimeWithSeconds();
        const processedStudents = [];

        for (const [studentId, attendanceData] of attendanceEntries) {
            // Parse attendance data
            const parsed = parseAttendanceData(attendanceData);
            if (!parsed) {
                return res.status(400).json({
                    error: `Format data absensi tidak valid untuk siswa ${studentId}`
                });
            }

            const { status, terlambat, ada_tugas } = parsed;

            // Validate status
            if (!VALID_STUDENT_STATUSES.includes(status)) {
                return res.status(400).json({
                    error: `Status tidak valid: ${status}. Status yang diperbolehkan: ${VALID_STUDENT_STATUSES.join(', ')}`
                });
            }

            // Map status with flags
            const { finalStatus, isLate, hasTask } = mapAttendanceStatus(status, terlambat, ada_tugas);

            // Clear note if status is Hadir
            const note = status === 'Hadir' ? '' : (notes[studentId] || '');

            // Upsert attendance record
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

        // Handle Multi-Guru auto-assignment
        if (isMultiGuru) {
            await syncMultiGuruAttendance(scheduleId, guruId, attendance, notes, targetDate, currentTime);
        }

        console.log(`✅ Attendance submitted successfully for ${processedStudents.length} students`);
        res.json({
            message: 'Absensi berhasil disimpan',
            processed: processedStudents.length,
            date: targetDate,
            scheduleId,
            isMultiGuru
        });
    } catch (error) {
        console.error('❌ Error submitting attendance:', error);
        res.status(500).json({
            error: 'Internal server error: ' + error.message
        });
    }
}

/**
 * Syncs attendance data to other teachers in multi-guru schedules
 * @private
 */
async function syncMultiGuruAttendance(scheduleId, primaryGuruId, attendance, notes, targetDate, currentTime) {
    console.log(`🔄 Syncing attendance to other teachers in multi-guru schedule...`);

    const [allTeachers] = await global.dbPool.execute(
        'SELECT guru_id FROM jadwal_guru WHERE jadwal_id = ? AND guru_id != ?',
        [scheduleId, primaryGuruId]
    );

    if (allTeachers.length === 0) return;

    console.log(`👥 Found ${allTeachers.length} other teachers to sync`);

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

    console.log(`✅ Multi-guru sync completed for ${allTeachers.length} teachers`);
}

// ===========================
// TEACHER ATTENDANCE OPERATIONS
// (Recorded by Class Representatives)
// ===========================

/**
 * Submit teacher attendance (by class representative/siswa perwakilan)
 * Supports multi-guru schedules and date range editing (up to 7 days)
 * @route POST /api/siswa/submit-kehadiran-guru
 * @access Siswa (Class Representative)
 */
export async function submitTeacherAttendance(req, res) {
    try {
        const { siswa_id, kehadiran_data, tanggal_absen } = req.body;
        console.log('📝 Submitting kehadiran guru for siswa:', siswa_id);

        // Validation
        if (!siswa_id) {
            return res.status(400).json({ error: 'siswa_id is required' });
        }

        if (!kehadiran_data || typeof kehadiran_data !== 'object') {
            return res.status(400).json({ error: 'kehadiran_data is required and must be an object' });
        }

        // Validate date range
        const targetDate = tanggal_absen || getMySQLDateWIB();
        const dateValidation = validateDateRange(targetDate, STUDENT_EDIT_DAYS_LIMIT);

        if (!dateValidation.valid) {
            return res.status(400).json({ error: dateValidation.error });
        }

        if (!global.dbPool) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

        // Get connection for transaction
        const connection = await global.dbPool.getConnection();

        try {
            await connection.beginTransaction();

            // Process each attendance entry
            for (const [key, data] of Object.entries(kehadiran_data)) {
                await processTeacherAttendanceEntry(connection, key, data, siswa_id, targetDate);
            }

            await connection.commit();
            console.log('✅ Kehadiran guru submitted successfully');

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
        console.error('❌ Error submitting kehadiran guru:', error);
        res.status(500).json({
            error: 'Gagal menyimpan data kehadiran guru',
            details: error.message
        });
    }
}

/**
 * Process a single teacher attendance entry
 * @private
 */
async function processTeacherAttendanceEntry(connection, key, data, siswa_id, targetDate) {
    const { status, keterangan, terlambat, ada_tugas, guru_id: specific_guru_id } = data;

    let jadwalId, guru_id;

    // Check if this is a multi-guru key (format: "jadwalId-guruId")
    if (key.includes('-')) {
        [jadwalId, guru_id] = key.split('-');
        guru_id = parseInt(guru_id);
    } else {
        jadwalId = key;

        if (specific_guru_id) {
            guru_id = specific_guru_id;
        } else {
            // Get guru_id from jadwal table
            const [jadwalDetails] = await connection.execute(
                'SELECT guru_id FROM jadwal WHERE id_jadwal = ?',
                [jadwalId]
            );

            if (jadwalDetails.length === 0) {
                throw new Error(`Jadwal dengan ID ${jadwalId} tidak ditemukan`);
            }

            guru_id = jadwalDetails[0].guru_id;

            // If guru_id is NULL (multi-guru system), get the primary teacher
            if (!guru_id) {
                guru_id = await getPrimaryTeacherForSchedule(connection, jadwalId);
            }
        }
    }

    // Get jadwal details
    const [jadwalDetails] = await connection.execute(
        'SELECT kelas_id, jam_ke, is_absenable, jenis_aktivitas FROM jadwal WHERE id_jadwal = ?',
        [jadwalId]
    );

    if (jadwalDetails.length === 0) {
        throw new Error(`Jadwal dengan ID ${jadwalId} tidak ditemukan`);
    }

    const { kelas_id, jam_ke, is_absenable, jenis_aktivitas } = jadwalDetails[0];

    // Skip non-absenable schedules
    if (!is_absenable) {
        console.log(`⚠️ Skipping non-absenable schedule ${jadwalId} (${jenis_aktivitas})`);
        return;
    }

    // Validate guru_id
    if (!guru_id) {
        throw new Error(`Guru ID tidak ditemukan untuk jadwal ${jadwalId}`);
    }

    // Map status
    const { finalStatus, isLate, hasTask } = mapAttendanceStatus(status, terlambat, ada_tugas);

    // Upsert record
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
        console.log(`✅ Updated attendance for jadwal ${jadwalId}, guru ${guru_id}`);
    } else {
        await connection.execute(`
            INSERT INTO absensi_guru 
            (jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, jam_ke, status, keterangan, waktu_catat, terlambat, ada_tugas) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [jadwalId, guru_id, kelas_id, siswa_id, targetDate, jam_ke, finalStatus, keterangan || null, waktuCatatWIB, isLate, hasTask]
        );
        console.log(`✅ Inserted attendance for jadwal ${jadwalId}, guru ${guru_id}`);
    }
}

/**
 * Update single teacher status (real-time save by class representative)
 * @route POST /api/siswa/update-status-guru
 * @access Siswa (Class Representative)
 */
export async function updateTeacherStatus(req, res) {
    try {
        const { jadwal_id, guru_id, status, keterangan, tanggal_absen, ada_tugas } = req.body;
        const siswa_id = req.user.siswa_id;

        // Validate input
        if (!jadwal_id || !guru_id || !status || !tanggal_absen) {
            return res.status(400).json({ 
                error: 'Jadwal ID, guru ID, status, dan tanggal absen wajib diisi' 
            });
        }

        // Validate status
        if (!VALID_TEACHER_STATUSES.includes(status)) {
            return res.status(400).json({ error: 'Status tidak valid' });
        }

        if (!global.dbPool) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

        // Get jadwal info
        const [jadwalRows] = await global.dbPool.execute(
            'SELECT kelas_id, jam_ke FROM jadwal WHERE id_jadwal = ? LIMIT 1',
            [jadwal_id]
        );

        if (jadwalRows.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        const { kelas_id, jam_ke } = jadwalRows[0];
        const waktuCatatWIB = getMySQLDateTimeWIB();

        // Upsert absensi_guru
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
            console.log('✅ Updated absensi_guru:', { jadwal_id, guru_id, status });
        } else {
            await global.dbPool.execute(`
                INSERT INTO absensi_guru 
                (jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, jam_ke, status, keterangan, waktu_catat, ada_tugas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [jadwal_id, guru_id, kelas_id, siswa_id, tanggal_absen, jam_ke, status, keterangan || null, waktuCatatWIB, ada_tugas ? 1 : 0]
            );
            console.log('✅ Inserted absensi_guru:', { jadwal_id, guru_id, status });
        }

        res.json({ success: true, message: 'Status kehadiran guru berhasil diperbarui' });
    } catch (error) {
        console.error('❌ Error updating guru status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ===========================
// ATTENDANCE HISTORY & REPORTS
// ===========================

/**
 * Get class attendance history (for class representative)
 * @route GET /api/siswa/:siswa_id/riwayat-kehadiran
 * @access Siswa
 */
export async function getClassAttendanceHistory(req, res) {
    try {
        const { siswa_id } = req.params;
        console.log('📊 Getting riwayat kehadiran kelas for siswa:', siswa_id);

        // Get siswa's class
        const [siswaData] = await global.dbPool.execute(
            'SELECT kelas_id, nama FROM siswa WHERE id_siswa = ?',
            [siswa_id]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        const kelasId = siswaData[0].kelas_id;

        // Get total students in class
        const [totalSiswaResult] = await global.dbPool.execute(
            'SELECT COUNT(*) as total FROM siswa WHERE kelas_id = ?',
            [kelasId]
        );
        const totalSiswa = totalSiswaResult[0].total;

        // Get attendance history with multi-guru support
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

        // Group by date and calculate statistics
        const groupedData = groupAttendanceByDate(riwayatData, totalSiswa);

        console.log('✅ Riwayat kehadiran kelas retrieved:', Object.keys(groupedData).length, 'days');
        res.json(Object.values(groupedData));
    } catch (error) {
        console.error('❌ Error getting riwayat kehadiran:', error);
        res.status(500).json({ error: 'Gagal memuat riwayat kehadiran' });
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

        // Parse student attendance data
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
                stats.total_hadir++;
                break;
            case 'izin':
            case 'dispen':
                stats.total_izin++;
                stats.siswa_tidak_hadir.push({ nama_siswa: nama, nis: nis || '', status: normalizedStatus });
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
 * @route GET /api/siswa/:siswaId/status-kehadiran?tanggal=YYYY-MM-DD&jadwal_id=XX
 * @access Siswa
 */
export async function getStudentAttendanceStatus(req, res) {
    try {
        const { siswaId } = req.params;
        const { tanggal, jadwal_id } = req.query;

        console.log('📊 Getting status kehadiran siswa:', { siswaId, tanggal, jadwal_id });

        if (!tanggal || !jadwal_id) {
            return res.status(400).json({ error: 'Tanggal dan jadwal_id wajib diisi' });
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
            return res.json({
                status: 'alpa',
                message: 'Tidak ada data kehadiran untuk siswa pada tanggal dan jadwal tersebut'
            });
        }

        const statusData = rows[0];
        console.log('✅ Status kehadiran siswa retrieved');

        res.json({
            status: statusData.status || 'alpa',
            keterangan: statusData.keterangan || '',
            tanggal: statusData.tanggal,
            nama_mapel: statusData.nama_mapel,
            nama_guru: statusData.nama_guru
        });
    } catch (error) {
        console.error('❌ Error getting status kehadiran siswa:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
