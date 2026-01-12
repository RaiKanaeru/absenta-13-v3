/**
 * Reports Controller
 * Handles analytics dashboard and attendance reports (CSV/Excel)
 */

import { getMySQLDateWIB, getWIBTime, HARI_INDONESIA } from '../utils/timeUtils.js';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendSuccessResponse } from '../utils/errorHandler.js';
import { getLetterhead, REPORT_KEYS } from '../../backend/utils/letterheadService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Reports');

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Map of effective working days per month
 */
const HARI_EFEKTIF_MAP = {
    1: 21, 2: 20, 3: 22, 4: 20, 5: 20, 6: 18,
    7: 21, 8: 21, 9: 21, 10: 22, 11: 21, 12: 18
};

/**
 * Calculate date range based on query parameters
 * @returns {Object} startDate and endDate
 */
function calculateDateRange(tahun, bulan, tanggal_awal, tanggal_akhir) {
    const selectedYear = Number.parseInt(tahun) || new Date().getFullYear();

    if (tanggal_awal && tanggal_akhir) {
        return { startDate: tanggal_awal, endDate: tanggal_akhir };
    }

    if (bulan) {
        const monthIndex = Number.parseInt(bulan) || 1;
        let targetYear = selectedYear;
        // If month is Jan-Jun, use next year
        if (monthIndex <= 6) {
            targetYear = selectedYear + 1;
        }
        const startDate = `${targetYear}-${String(bulan).padStart(2, '0')}-01`;
        const monthEndDate = new Date(targetYear, monthIndex, 0);
        const endDate = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;
        return { startDate, endDate };
    }

    // Default: Academic year (July - June)
    return {
        startDate: `${selectedYear}-07-01`,
        endDate: `${selectedYear + 1}-06-30`
    };
}

/**
 * Parse detail string from DB into structured array
 */
function parseAttendanceDetails(detailString) {
    if (!detailString) return [];
    return detailString.split(';').map(item => {
        const [date, status] = item.split(':');
        return { tanggal: date, status };
    });
}

/**
 * Map raw attendance row to result object
 */
function mapAttendanceRow(row) {
    const effectiveDays = HARI_EFEKTIF_MAP[row.bulan] || 20;
    const absences = Number.parseInt(row.total_ketidakhadiran) || 0;
    const presencePk = Math.max(0, effectiveDays - absences);
    const details = parseAttendanceDetails(row.detail_string);

    return {
        siswa_id: row.siswa_id,
        bulan: row.bulan,
        tahun: row.tahun_absen,
        total_hari_efektif: effectiveDays,
        total_ketidakhadiran: absences,
        persentase_ketidakhadiran: ((absences / effectiveDays) * 100).toFixed(2),
        persentase_kehadiran: ((presencePk / effectiveDays) * 100).toFixed(2),
        detail_ketidakhadiran: details
    };
}

/**
 * Aggregate attendance results by student for date range queries
 */
function aggregateAttendanceByStudent(results, diffDays) {
    const aggregated = {};

    results.forEach(r => {
        if (!aggregated[r.siswa_id]) {
            aggregated[r.siswa_id] = {
                siswa_id: r.siswa_id,
                bulan: 0,
                tahun: 0,
                total_hari_efektif: diffDays,
                total_ketidakhadiran: 0,
                detail_ketidakhadiran: []
            };
        }
        aggregated[r.siswa_id].total_ketidakhadiran += r.total_ketidakhadiran;
        aggregated[r.siswa_id].detail_ketidakhadiran.push(...r.detail_ketidakhadiran);
    });

    return Object.values(aggregated).map(item => {
        const effDays = item.total_hari_efektif;
        item.persentase_ketidakhadiran = ((item.total_ketidakhadiran / effDays) * 100).toFixed(2);
        item.persentase_kehadiran = (100 - parseFloat(item.persentase_ketidakhadiran)).toFixed(2);
        return item;
    });
}

/**
 * Extract kelas_id from potentially compound format (e.g., "2:1" -> "2")
 */
function extractKelasId(kelasId) {
    if (kelasId && kelasId.includes(':')) {
        return kelasId.split(':')[0];
    }
    return kelasId;
}

// ================================================
// REPORTS & ANALYTICS ENDPOINTS
// ================================================

// Update permission request status (Deprecated but kept for compatibility)
export const updatePermissionStatus = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { status } = req.body;

    log.requestStart('UpdatePermissionStatus', { id, status });

    try {
        if (!status || !['disetujui', 'ditolak'].includes(status)) {
            log.validationFail('status', status, 'Invalid status');
            return sendValidationError(res, 'Status harus disetujui atau ditolak', { field: 'status' });
        }

        // Endpoint deprecated - pengajuan izin sudah dihapus
        log.warn('Deprecated endpoint called', { id });
        return res.status(410).json({
            error: 'Endpoint deprecated',
            message: 'Pengajuan izin sudah dihapus dari sistem'
        });
    } catch (error) {
        log.dbError('updatePermission', error, { id });
        return sendDatabaseError(res, error);
    }
};

// Get analytics data for dashboard
export const getAnalyticsDashboard = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetAnalyticsDashboard', {});

    try {
        // Get current WIB date components
        const todayWIB = getMySQLDateWIB();
        const wibNow = getWIBTime();
        const currentYear = wibNow.getFullYear();
        const currentMonth = wibNow.getMonth() + 1;

        // Get student attendance statistics (including Dispen as Hadir)
        const studentAttendanceQuery = `
            SELECT 
                'Hari Ini' as periode,
                COUNT(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 END) as hadir,
                COUNT(CASE WHEN a.status IN ('Sakit', 'Izin', 'Alpa') THEN 1 END) as tidak_hadir
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND a.tanggal = ?
            UNION ALL
            SELECT 
                'Minggu Ini' as periode,
                COUNT(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 END) as hadir,
                COUNT(CASE WHEN a.status IN ('Sakit', 'Izin', 'Alpa') THEN 1 END) as tidak_hadir
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND YEARWEEK(a.tanggal, 1) = YEARWEEK(?, 1)
            UNION ALL
            SELECT 
                'Bulan Ini' as periode,
                COUNT(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 END) as hadir,
                COUNT(CASE WHEN a.status IN ('Sakit', 'Izin', 'Alpa') THEN 1 END) as tidak_hadir
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND YEAR(a.tanggal) = ? 
                AND MONTH(a.tanggal) = ?
        `;

        // Get teacher attendance statistics (including Dispen as Hadir)
        const teacherAttendanceQuery = `
            SELECT 
                'Hari Ini' as periode,
                COUNT(CASE WHEN ag.status IN ('Hadir', 'Dispen') THEN 1 END) as hadir,
                COUNT(CASE WHEN ag.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 END) as tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal = ?
            UNION ALL
            SELECT 
                'Minggu Ini' as periode,
                COUNT(CASE WHEN ag.status IN ('Hadir', 'Dispen') THEN 1 END) as hadir,
                COUNT(CASE WHEN ag.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 END) as tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
                AND YEARWEEK(ag.tanggal, 1) = YEARWEEK(?, 1)
            UNION ALL
            SELECT 
                'Bulan Ini' as periode,
                COUNT(CASE WHEN ag.status IN ('Hadir', 'Dispen') THEN 1 END) as hadir,
                COUNT(CASE WHEN ag.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 END) as tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
                AND YEAR(ag.tanggal) = ? 
                AND MONTH(ag.tanggal) = ?
        `;

        // Get top absent students
        const topAbsentStudentsQuery = `
            SELECT 
                s.nama,
                k.nama_kelas,
                COUNT(CASE WHEN a.status IN ('Alpa', 'Izin', 'Sakit', 'Dispen') THEN 1 END) as total_alpa
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id
            GROUP BY s.id_siswa, s.nama, k.nama_kelas
            HAVING total_alpa > 0
            ORDER BY total_alpa DESC
            LIMIT 5
        `;

        // Get top absent teachers
        const topAbsentTeachersQuery = `
            SELECT 
                g.nama,
                COUNT(CASE WHEN ag.status IN ('Tidak Hadir', 'Sakit', 'Izin', 'Dispen') THEN 1 END) as total_tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id
            GROUP BY g.id_guru, g.nama
            HAVING total_tidak_hadir > 0
            ORDER BY total_tidak_hadir DESC
            LIMIT 5
        `;

        // Get recent notifications/banding absen requests
        const notificationsQuery = `
            SELECT 
                ba.id_banding as id,
                CONCAT('Banding absen dari ', s.nama, ' (', k.nama_kelas, ')') as message,
                ba.tanggal_pengajuan as timestamp,
                ba.status_banding as status,
                'attendance_appeal' as type
            FROM pengajuan_banding_absen ba
            JOIN siswa s ON ba.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE ba.status_banding = 'pending'
            ORDER BY ba.tanggal_pengajuan DESC
            LIMIT 10
        `;

        // Execute all queries in parallel for better performance
        const [
            [totalStudentsResult],
            [totalTeachersResult],
            [studentAttendance],
            [teacherAttendance],
            [topAbsentStudents],
            [topAbsentTeachers],
            [notifications]
        ] = await Promise.all([
            globalThis.dbPool.execute('SELECT COUNT(*) as total FROM siswa WHERE status = "aktif"'),
            globalThis.dbPool.execute('SELECT COUNT(*) as total FROM guru WHERE status = "aktif"'),
            globalThis.dbPool.execute(studentAttendanceQuery, [todayWIB, todayWIB, currentYear, currentMonth]),
            globalThis.dbPool.execute(teacherAttendanceQuery, [todayWIB, todayWIB, currentYear, currentMonth]),
            globalThis.dbPool.execute(topAbsentStudentsQuery),
            globalThis.dbPool.execute(topAbsentTeachersQuery),
            globalThis.dbPool.execute(notificationsQuery)
        ]);
        const totalStudents = totalStudentsResult[0]?.total || 0;
        const totalTeachers = totalTeachersResult[0]?.total || 0;

        const analyticsData = {
            studentAttendance: studentAttendance || [],
            teacherAttendance: teacherAttendance || [],
            topAbsentStudents: topAbsentStudents || [],
            topAbsentTeachers: topAbsentTeachers || [],
            notifications: notifications || [],
            totalStudents: totalStudents,
            totalTeachers: totalTeachers
        };

        log.success('GetAnalyticsDashboard', { totalStudents, notificationCount: notifications.length });
        res.json(analyticsData);
    } catch (error) {
        log.dbError('analytics', error);
        return sendDatabaseError(res, error, 'Gagal memuat data analytics');
    }
};

// Get live teacher attendance
export const getLiveTeacherAttendance = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetLiveTeacherAttendance', {});

    try {
        const todayWIB = getMySQLDateWIB();
        const wibNow = getWIBTime();
        const currentDayWIB = HARI_INDONESIA[wibNow.getDay()];

        const query = `
            SELECT DISTINCT
                g.id_guru as id,
                g.nama,
                g.nip,
                GROUP_CONCAT(DISTINCT m.nama_mapel ORDER BY m.nama_mapel SEPARATOR ', ') as nama_mapel,
                GROUP_CONCAT(DISTINCT k.nama_kelas ORDER BY k.nama_kelas SEPARATOR ', ') as nama_kelas,
                MIN(j.jam_mulai) as jam_mulai,
                MAX(j.jam_selesai) as jam_selesai,
                COALESCE(ag.status, 'Belum Absen') as status,
                DATE_FORMAT(ag.waktu_catat, '%H:%i:%s') as waktu_absen,
                ag.keterangan,
                ag.waktu_catat as waktu_absen_full,
                CASE 
                    WHEN ag.waktu_catat IS NOT NULL THEN
                        CASE 
                            WHEN TIME(ag.waktu_catat) < '07:00:00' THEN 'Tepat Waktu'
                            WHEN TIME(ag.waktu_catat) BETWEEN '07:00:00' AND '07:15:00' THEN 'Terlambat Ringan'
                            WHEN TIME(ag.waktu_catat) BETWEEN '07:15:00' AND '08:00:00' THEN 'Terlambat'
                            ELSE 'Terlambat Berat'
                        END
                    ELSE '-'
                END as keterangan_waktu,
                CASE 
                    WHEN ag.waktu_catat IS NOT NULL THEN
                        CASE 
                            WHEN HOUR(ag.waktu_catat) < 12 THEN 'Pagi'
                            WHEN HOUR(ag.waktu_catat) < 15 THEN 'Siang'
                            ELSE 'Sore'
                        END
                    ELSE 'Belum Absen'
                END as periode_absen
            FROM jadwal j
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND DATE(ag.tanggal) = ?
            WHERE j.hari = ?
            GROUP BY g.id_guru, g.nama, g.nip, ag.status, ag.waktu_catat, ag.keterangan
            ORDER BY 
                CASE WHEN ag.waktu_catat IS NOT NULL THEN 0 ELSE 1 END,
                ag.waktu_catat DESC,
                g.nama
        `;

        const [rows] = await globalThis.dbPool.execute(query, [todayWIB, currentDayWIB]);
        log.success('GetLiveTeacherAttendance', { count: rows.length, day: currentDayWIB });
        res.json(rows);
    } catch (error) {
        log.dbError('liveTeacher', error);
        return sendDatabaseError(res, error, 'Gagal memuat data kehadiran guru');
    }
};

// Get live student attendance
export const getLiveStudentAttendance = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetLiveStudentAttendance', {});

    try {
        const todayWIB = getMySQLDateWIB();

        const query = `
            SELECT 
                s.id_siswa as id,
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(a.status, 'Belum Absen') as status,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen,
                a.keterangan,
                a.waktu_absen as waktu_absen_full,
                CASE 
                    WHEN a.waktu_absen IS NOT NULL THEN
                        CASE 
                            WHEN TIME(a.waktu_absen) < '07:00:00' THEN 'Tepat Waktu'
                            WHEN TIME(a.waktu_absen) BETWEEN '07:00:00' AND '07:15:00' THEN 'Terlambat Ringan'
                            WHEN TIME(a.waktu_absen) BETWEEN '07:15:00' AND '08:00:00' THEN 'Terlambat'
                            ELSE 'Terlambat Berat'
                        END
                    ELSE '-'
                END as keterangan_waktu,
                CASE 
                    WHEN a.waktu_absen IS NOT NULL THEN
                        CASE 
                            WHEN HOUR(a.waktu_absen) < 12 THEN 'Pagi'
                            WHEN HOUR(a.waktu_absen) < 15 THEN 'Siang'
                            ELSE 'Sore'
                        END
                    ELSE 'Belum Absen'
                END as periode_absen
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND DATE(a.waktu_absen) = ?
            WHERE s.status = 'aktif'
            ORDER BY 
                CASE WHEN a.waktu_absen IS NOT NULL THEN 0 ELSE 1 END,
                a.waktu_absen DESC,
                k.nama_kelas,
                s.nama
        `;

        const [rows] = await globalThis.dbPool.execute(query, [todayWIB]);
        log.success('GetLiveStudentAttendance', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('liveStudent', error);
        return sendDatabaseError(res, error, 'Gagal memuat data kehadiran siswa');
    }
};

// Get teacher attendance report
export const getTeacherAttendanceReport = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;
    
    log.requestStart('GetTeacherReport', { startDate, endDate, kelas_id });

    try {
        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi', { fields: ['startDate', 'endDate'] });
        }

        let query = `
            SELECT 
                DATE_FORMAT(ag.tanggal, '%Y-%m-%d') as tanggal,
                k.nama_kelas,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                g.nip as nip_guru,
                m.nama_mapel,
                CASE 
                    WHEN ag.jam_ke IS NOT NULL THEN CONCAT('Jam ke-', ag.jam_ke)
                    ELSE CONCAT(j.jam_mulai, ' - ', j.jam_selesai)
                END as jam_hadir,
                j.jam_mulai,
                j.jam_selesai,
                COALESCE(ag.status, 'Tidak Ada Data') as status,
                COALESCE(ag.keterangan, '-') as keterangan,
                j.jam_ke
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND ag.tanggal BETWEEN ? AND ?
            WHERE j.status = 'aktif'
        `;

        const params = [startDate, endDate];

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        query += ' ORDER BY ag.tanggal DESC, k.nama_kelas, j.jam_ke';

        const [rows] = await globalThis.dbPool.execute(query, params);
        log.success('GetTeacherReport', { count: rows.length, startDate, endDate });
        res.json(rows);
    } catch (error) {
        log.dbError('teacherReport', error);
        return sendDatabaseError(res, error, 'Gagal memuat laporan kehadiran guru');
    }
};

// Download teacher attendance report as Excel (CSV)
export const downloadTeacherAttendanceReport = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;
    
    log.requestStart('DownloadTeacherReport', { startDate, endDate, kelas_id });

    try {
        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi');
        }

        let query = `
            SELECT 
                COALESCE(DATE_FORMAT(ag.tanggal, '%d/%m/%Y'), DATE_FORMAT(DATE(NOW()), '%d/%m/%Y')) as tanggal,
                k.nama_kelas,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                g.nip as nip_guru,
                m.nama_mapel,
                CASE 
                    WHEN ag.jam_ke IS NOT NULL THEN CONCAT('Jam ke-', ag.jam_ke)
                    ELSE CONCAT(j.jam_mulai, ' - ', j.jam_selesai)
                END as jam_hadir,
                j.jam_mulai,
                j.jam_selesai,
                CONCAT(j.jam_mulai, ' - ', j.jam_selesai) as jadwal,
                COALESCE(ag.status, 'Tidak Ada Data') as status,
                COALESCE(ag.keterangan, '-') as keterangan
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND ag.tanggal BETWEEN ? AND ?
            WHERE j.status = 'aktif'
        `;

        const params = [startDate, endDate];

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        query += ' ORDER BY ag.tanggal DESC, k.nama_kelas, j.jam_ke';

        const [rows] = await globalThis.dbPool.execute(query, params);

        // Enhanced CSV format with UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal,Kelas,Guru,NIP,Mata Pelajaran,Jam Hadir,Jam Mulai,Jam Selesai,Jadwal,Status,Keterangan\n';

        rows.forEach(row => {
            csvContent += `"${row.tanggal}","${row.nama_kelas}","${row.nama_guru}","${row.nip_guru || ''}","${row.nama_mapel}","${row.jam_hadir || ''}","${row.jam_mulai}","${row.jam_selesai}","${row.jadwal}","${row.status}","${row.keterangan || ''}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="laporan-kehadiran-guru-${startDate}-${endDate}.csv"`);
        res.send(csvContent);

        log.success('DownloadTeacherReport', { recordCount: rows.length, filename: `laporan-kehadiran-guru-${startDate}-${endDate}.csv` });
    } catch (error) {
        log.dbError('downloadTeacher', error);
        return sendDatabaseError(res, error, 'Gagal mengunduh laporan kehadiran guru');
    }
};

// Get student attendance report
export const getStudentAttendanceReport = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;
    
    log.requestStart('GetStudentReport', { startDate, endDate, kelas_id });

    try {
        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi');
        }

        let query = `
            SELECT 
                DATE_FORMAT(a.waktu_absen, '%Y-%m-%d') as tanggal,
                k.nama_kelas,
                s.nama as nama_siswa,
                s.nis as nis_siswa,
                'Absensi Harian' as nama_mapel,
                'Siswa Perwakilan' as nama_guru,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen,
                '07:00' as jam_mulai,
                '17:00' as jam_selesai,
                COALESCE(a.status, 'Tidak Hadir') as status,
                COALESCE(a.keterangan, '-') as keterangan,
                NULL as jam_ke
            FROM absensi_siswa a
            JOIN siswa s ON a.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE DATE(a.waktu_absen) BETWEEN ? AND ?
        `;

        const params = [startDate, endDate];

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        query += ' ORDER BY a.waktu_absen DESC, k.nama_kelas, s.nama';

        const [rows] = await globalThis.dbPool.execute(query, params);
        log.success('GetStudentReport', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('studentReport', error);
        return sendDatabaseError(res, error, 'Gagal memuat laporan kehadiran siswa');
    }
};

// Download student attendance report as CSV
export const downloadStudentAttendanceReport = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;
    
    log.requestStart('DownloadStudentReport', { startDate, endDate, kelas_id });

    try {
        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi');
        }

        let query = `
            SELECT 
                DATE_FORMAT(a.waktu_absen, '%d/%m/%Y') as tanggal,
                k.nama_kelas,
                s.nama as nama_siswa,
                s.nis as nis_siswa,
                'Absensi Harian' as nama_mapel,
                'Siswa Perwakilan' as nama_guru,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen,
                '07:00' as jam_mulai,
                '17:00' as jam_selesai,
                '07:00 - 17:00' as jadwal,
                COALESCE(a.status, 'Tidak Hadir') as status,
                COALESCE(a.keterangan, '-') as keterangan
            FROM absensi_siswa a
            JOIN siswa s ON a.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE DATE(a.waktu_absen) BETWEEN ? AND ?
        `;

        const params = [startDate, endDate];

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        query += ' ORDER BY a.waktu_absen DESC, k.nama_kelas, s.nama';

        const [rows] = await globalThis.dbPool.execute(query, params);

        // Enhanced CSV format with UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal,Kelas,Nama Siswa,NIS,Mata Pelajaran,Guru,Waktu Absen,Jam Mulai,Jam Selesai,Jadwal,Status,Keterangan\n';

        rows.forEach(row => {
            csvContent += `"${row.tanggal}","${row.nama_kelas}","${row.nama_siswa}","${row.nis_siswa || ''}","${row.nama_mapel || ''}","${row.nama_guru || ''}","${row.waktu_absen || ''}","${row.jam_mulai || ''}","${row.jam_selesai || ''}","${row.jadwal || ''}","${row.status}","${row.keterangan || ''}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="laporan-kehadiran-siswa-${startDate}-${endDate}.csv"`);
        res.send(csvContent);

        log.success('DownloadStudentReport', { recordCount: rows.length });
    } catch (error) {
        log.dbError('downloadStudent', error);
        return sendDatabaseError(res, error, 'Gagal mengunduh laporan kehadiran siswa');
    }
};

// Get student attendance summary
export const getStudentAttendanceSummary = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;
    
    log.requestStart('GetStudentSummary', { startDate, endDate, kelas_id });

    try {
        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi');
        }

        let query = `
            SELECT 
                s.id_siswa as siswa_id,
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(a.id), 0) AS total,
                CASE 
                    WHEN COUNT(a.id) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2)
                END AS presentase
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND DATE(a.waktu_absen) BETWEEN ? AND ?
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE s.status = 'aktif'
        `;
        const params = [startDate, endDate];
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';

        const [rows] = await globalThis.dbPool.execute(query, params);
        log.success('GetStudentSummary', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('studentSummary', error);
        return sendDatabaseError(res, error, 'Gagal memuat ringkasan kehadiran siswa');
    }
};

// Download student attendance summary as styled Excel
export const downloadStudentAttendanceExcel = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;

    log.requestStart('DownloadStudentExcel', { startDate, endDate, kelas_id });

    try {
        // Validasi input
        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi');
        }

        // Validasi format tanggal
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
            log.validationFail('dateFormat', { startDate, endDate }, 'Invalid format');
            return sendValidationError(res, 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD');
        }

        // Validasi rentang tanggal
        if (startDateObj > endDateObj) {
            log.validationFail('dateRange', null, 'Start after end');
            return sendValidationError(res, 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai');
        }

        // Validasi batas rentang (maksimal 1 tahun)
        const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
        if (daysDiff > 366) {
            log.validationFail('dateRange', daysDiff, 'Range exceeds 366 days');
            return sendValidationError(res, 'Rentang tanggal tidak boleh lebih dari 366 hari');
        }

        let query = `
            SELECT 
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(a.id), 0) AS total,
                CASE 
                    WHEN COUNT(a.id) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2)
                END AS presentase
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND DATE(a.waktu_absen) BETWEEN ? AND ?
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE s.status = 'aktif'
        `;

        const params = [startDate, endDate];
        if (kelas_id && kelas_id !== '' && kelas_id !== 'all') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';

        const [rows] = await globalThis.dbPool.execute(query, params);

        log.debug('Building Excel export', { studentCount: rows.length });

        // Build schema-aligned rows
        const exportRows = rows.map((r, idx) => ({
            no: idx + 1,
            nama: r.nama || '',
            nis: r.nis || '',
            kelas: r.nama_kelas || '',
            hadir: Number(r.H) || 0,
            izin: Number(r.I) || 0,
            sakit: Number(r.S) || 0,
            alpa: Number(r.A) || 0,
            dispen: Number(r.D) || 0,
            presentase: Number(r.presentase) / 100 || 0 // Convert to decimal for percentage format
        }));

        // Dynamic imports for backend utilities
        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        const studentSchemaModule = await import('../../backend/export/schemas/student-summary.js');
        const studentSchema = studentSchemaModule.default;

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.LAPORAN_SISWA });

        const reportPeriod = `${startDate} - ${endDate}`;
        const workbook = await buildExcel({
            title: studentSchema.title,
            subtitle: studentSchema.subtitle,
            reportPeriod,
            showLetterhead: letterhead.enabled,
            letterhead: letterhead,
            columns: studentSchema.columns,
            rows: exportRows
        });

        // Set headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=ringkasan-kehadiran-siswa-${startDate}-${endDate}.xlsx`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        await workbook.xlsx.write(res);
        res.end();

        log.success('DownloadStudentExcel', { studentCount: exportRows.length, filename: `ringkasan-kehadiran-siswa-${startDate}-${endDate}.xlsx` });
    } catch (error) {
        log.error('DownloadStudentExcel failed', { error: error.message, stack: error.stack });

        if (!res.headersSent) {
            return sendErrorResponse(res, error, 'Gagal membuat file Excel');
        }
    }
};

// Teacher attendance summary
export const getTeacherAttendanceSummary = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate } = req.query;
    
    log.requestStart('GetTeacherSummary', { startDate, endDate });

    try {
        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi');
        }
        
        let query = `
            SELECT 
                g.id_guru as guru_id,
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN ag.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN ag.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN ag.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN ag.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN ag.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(ag.id_absensi), 0) AS total,
                CASE 
                    WHEN COUNT(ag.id_absensi) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN ag.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) * 100.0 / COUNT(ag.id_absensi)), 2)
                END AS presentase
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal BETWEEN ? AND ?
            WHERE g.status = 'aktif'
        `;
        const params = [startDate, endDate];
        query += ' GROUP BY g.id_guru, g.nama, g.nip ORDER BY g.nama';
        
        const [rows] = await globalThis.dbPool.execute(query, params);
        log.success('GetTeacherSummary', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('teacherSummary', error);
        return sendDatabaseError(res, error, 'Gagal memuat ringkasan kehadiran guru');
    }
};
// Get rekap ketidakhadiran guru (Pivot per bulan)
export const getRekapKetidakhadiranGuru = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { year, tahun, bulan, tanggal_awal, tanggal_akhir } = req.query;
    
    // Support both 'year' and 'tahun' params with validation
    const selectedYear = Number.parseInt(year || tahun) || new Date().getFullYear();
    
    log.requestStart('GetRekapKetidakhadiranGuru', { selectedYear, bulan, tanggal_awal, tanggal_akhir });

    try {
        let query = '';
        let params = [];
        const isAnnual = !tanggal_awal && !tanggal_akhir && selectedYear;

        if (isAnnual) {
            // Annual Report based on Academic Year (July - June)
            const startDate = `${selectedYear}-07-01`;
            const endDate = `${selectedYear + 1}-06-30`;

            query = `
                SELECT 
                    g.id_guru as id,
                    g.nama as nama_guru,
                    g.nip,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 7 THEN 1 ELSE 0 END), 0) as jul,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 8 THEN 1 ELSE 0 END), 0) as agt,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 9 THEN 1 ELSE 0 END), 0) as sep,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 10 THEN 1 ELSE 0 END), 0) as okt,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 11 THEN 1 ELSE 0 END), 0) as nov,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 12 THEN 1 ELSE 0 END), 0) as des,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 1 THEN 1 ELSE 0 END), 0) as jan,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 2 THEN 1 ELSE 0 END), 0) as feb,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 3 THEN 1 ELSE 0 END), 0) as mar,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 4 THEN 1 ELSE 0 END), 0) as apr,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 5 THEN 1 ELSE 0 END), 0) as mei,
                    COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 6 THEN 1 ELSE 0 END), 0) as jun,
                    COUNT(ag.id_absensi) as total_ketidakhadiran,
                    
                    /* Calculate totals */
                    (SELECT COUNT(*) FROM jadwal j WHERE j.guru_id = g.id_guru AND j.status = 'aktif') * 20 as total_hari_efektif_est,
                    
                    0 as total_kehadiran /* To be calculated or fetched if needed */
                FROM guru g
                LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
                    AND ag.tanggal BETWEEN ? AND ?
                    AND ag.status IN ('Sakit', 'Izin', 'Alpa', 'Tidak Hadir')
                WHERE g.status = 'aktif'
                GROUP BY g.id_guru, g.nama, g.nip
                ORDER BY g.nama
            `;
            params = [startDate, endDate];
        } else {
            // Monthly or Date Range Report
            const start = tanggal_awal || `${selectedYear}-${bulan.padStart(2, '0')}-01`;
            // Calculate end of month without timezone issues
            const monthEndDate = new Date(selectedYear, Number.parseInt(bulan), 0);
            const end = tanggal_akhir || `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

            query = `
                SELECT 
                    g.id_guru as id,
                    g.nama as nama_guru,
                    g.nip,
                    COALESCE(COUNT(ag.id_absensi), 0) as total_ketidakhadiran
                FROM guru g
                LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
                    AND ag.tanggal BETWEEN ? AND ?
                    AND ag.status IN ('Sakit', 'Izin', 'Alpa', 'Tidak Hadir')
                WHERE g.status = 'aktif'
                GROUP BY g.id_guru, g.nama, g.nip
                ORDER BY g.nama
            `;
            params = [start, end];
        }

        const [rows] = await globalThis.dbPool.execute(query, params);

        // Post-processing for percentages (since we can't easily get total effective days dynamically in SQL without a calendar table)
        // Default assumption: ~240 effective days/year or ~20 days/month
        const effectiveDays = isAnnual ? 240 : 20;

        const processedRows = rows.map(row => {
            const absences = Number.parseInt(row.total_ketidakhadiran) || 0;
            const presence = Math.max(0, effectiveDays - absences);
            
            return {
                ...row,
                total_hari_efektif: effectiveDays,
                total_kehadiran: presence,
                persentase_ketidakhadiran: ((absences / effectiveDays) * 100).toFixed(2),
                persentase_kehadiran: ((presence / effectiveDays) * 100).toFixed(2)
            };
        });

        log.success('GetRekapKetidakhadiranGuru', { count: processedRows.length });
        res.json(processedRows);

    } catch (error) {
        log.dbError('rekapGuru', error);
        return sendDatabaseError(res, error, 'Gagal memuat rekap ketidakhadiran guru');
    }
};

// Get rekap ketidakhadiran siswa (Per siswa per bulan/periode)
export const getRekapKetidakhadiranSiswa = async (req, res) => {
    const log = logger.withRequest(req, res);
    let { kelas_id, tahun, bulan, tanggal_awal, tanggal_akhir } = req.query;
    
    // Handle compound ID format (e.g., "2:1") - extract just the ID
    const originalKelasId = kelas_id;
    kelas_id = extractKelasId(kelas_id);
    if (originalKelasId !== kelas_id) {
        log.warn('GetRekapKetidakhadiranSiswa received compound ID, extracted', { original: originalKelasId, extracted: kelas_id });
    }
    
    log.requestStart('GetRekapKetidakhadiranSiswa', { kelas_id, tahun, bulan, tanggal_awal, tanggal_akhir });

    try {
        // Validate kelas_id
        if (!kelas_id || Number.isNaN(Number.parseInt(kelas_id))) {
            log.validationFail('kelas_id', kelas_id, 'Invalid or missing kelas_id');
            return sendValidationError(res, 'Kelas wajib dipilih dengan format yang valid', { field: 'kelas_id' });
        }

        // Calculate date range
        const { startDate, endDate } = calculateDateRange(tahun, bulan, tanggal_awal, tanggal_akhir);

        // Fetch rekap data per siswa per bulan
        const query = `
            SELECT 
                a.siswa_id,
                MONTH(a.tanggal) as bulan,
                YEAR(a.tanggal) as tahun_absen,
                SUM(CASE WHEN a.status IN ('Sakit', 'Izin', 'Alpa') THEN 1 ELSE 0 END) as total_ketidakhadiran,
                GROUP_CONCAT(
                    CASE WHEN a.status IN ('Sakit', 'Izin', 'Alpa') 
                    THEN CONCAT(a.tanggal, ':', a.status) 
                    ELSE NULL END 
                    SEPARATOR ';'
                ) as detail_string
            FROM absensi_siswa a
            JOIN siswa s ON a.siswa_id = s.id_siswa
            WHERE s.kelas_id = ? 
              AND a.tanggal BETWEEN ? AND ?
            GROUP BY a.siswa_id, YEAR(a.tanggal), MONTH(a.tanggal)
            ORDER BY a.siswa_id, YEAR(a.tanggal), MONTH(a.tanggal)
        `;

        const [rows] = await globalThis.dbPool.execute(query, [kelas_id, startDate, endDate]);

        // Map rows to result objects using helper function
        const result = rows.map(mapAttendanceRow);

        // Aggregate if filtering by date range
        if (tanggal_awal && tanggal_akhir) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
            
            const finalResult = aggregateAttendanceByStudent(result, diffDays);
            
            log.success('GetRekapKetidakhadiranSiswa', { count: finalResult.length, mode: 'range' });
            return res.json(finalResult);
        }

        log.success('GetRekapKetidakhadiranSiswa', { count: result.length });
        res.json(result);

    } catch (error) {
        log.dbError('rekapSiswa', error, { kelas_id });
        return sendDatabaseError(res, error, 'Gagal memuat rekap ketidakhadiran siswa');
    }
};

// Get students by class (for report filters)
export const getStudentsByClass = async (req, res) => {
    const log = logger.withRequest(req, res);
    let { kelasId } = req.params;

    // Handle cases where kelasId might be in format "id:something" - extract just the ID
    if (kelasId && kelasId.includes(':')) {
        kelasId = kelasId.split(':')[0];
        log.warn('GetStudentsByClass received compound ID, extracted', { original: req.params.kelasId, extracted: kelasId });
    }

    // Validate kelasId is numeric
    if (!kelasId || Number.isNaN(Number.parseInt(kelasId))) {
        log.validationFail('kelasId', kelasId, 'Invalid class ID format');
        return sendValidationError(res, 'Format ID kelas tidak valid', { received: kelasId });
    }

    log.requestStart('GetStudentsByClass', { kelasId });

    try {
        const query = `
            SELECT id_siswa as id, nama, nis, jenis_kelamin, kelas_id 
            FROM siswa 
            WHERE kelas_id = ? AND status = 'aktif'
            ORDER BY nama ASC
        `;
        const [rows] = await globalThis.dbPool.execute(query, [kelasId]);
        
        log.success('GetStudentsByClass', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('studentsByClass', error);
        return sendDatabaseError(res, error, 'Gagal memuat data siswa');
    }
};

// Get presensi siswa (Detailed daily log)
export const getPresensiSiswa = async (req, res) => {
    const log = logger.withRequest(req, res);
    let { kelas_id, bulan, tahun } = req.query;

    // Handle compound ID format (e.g., "2:1") - extract just the ID
    if (kelas_id && kelas_id.includes(':')) {
        kelas_id = kelas_id.split(':')[0];
        log.warn('GetPresensiSiswa received compound ID, extracted', { original: req.query.kelas_id, extracted: kelas_id });
    }

    log.requestStart('GetPresensiSiswa', { kelas_id, bulan, tahun });

    try {
        if (!kelas_id || !bulan || !tahun) {
            log.validationFail('params', { kelas_id, bulan, tahun }, 'Missing required params');
            return sendValidationError(res, 'Kelas, bulan, dan tahun wajib diisi');
        }

        // Validate kelas_id is numeric
        if (Number.isNaN(Number.parseInt(kelas_id))) {
            log.validationFail('kelas_id', kelas_id, 'Invalid format');
            return sendValidationError(res, 'Format ID kelas tidak valid');
        }

        const tahunInt = Number.parseInt(tahun) || new Date().getFullYear();
        const bulanInt = Number.parseInt(bulan) || 1;
        const startDate = `${tahunInt}-${String(bulanInt).padStart(2, '0')}-01`;
        // Calculate end of month without timezone issues
        const monthEndDate = new Date(tahunInt, bulanInt, 0);
        const endDate = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;


        const query = `
            SELECT 
                a.siswa_id,
                a.tanggal,
                a.status,
                a.keterangan
            FROM absensi_siswa a
            JOIN siswa s ON a.siswa_id = s.id_siswa
            WHERE s.kelas_id = ? 
              AND a.tanggal BETWEEN ? AND ?
            ORDER BY a.tanggal ASC
        `;

        const [rows] = await globalThis.dbPool.execute(query, [kelas_id, startDate, endDate]);

        log.success('GetPresensiSiswa', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('presensiSiswa', error);
        return sendDatabaseError(res, error, 'Gagal memuat data presensi siswa');
    }
};
