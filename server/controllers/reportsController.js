/**
 * Reports Controller
 * Handles analytics dashboard and attendance reports (CSV/Excel)
 */

import { getMySQLDateWIB, getWIBTime, HARI_INDONESIA } from '../utils/timeUtils.js';
import { sendErrorResponse, sendDatabaseError, sendDeprecatedError, sendValidationError } from '../utils/errorHandler.js';
import { getLetterhead, REPORT_KEYS } from '../utils/letterheadService.js';
import { REPORT_STATUS, REPORT_MESSAGES, CSV_HEADERS, HARI_EFEKTIF_MAP } from '../config/reportConfig.js';
import { createLogger } from '../utils/logger.js';
import ExportService from '../services/ExportService.js';
import { 
    calculateEffectiveDaysForRange, 
    calculateAttendancePercentage,
    DEFAULT_EFFECTIVE_DAYS
} from '../utils/attendanceCalculator.js';
import db from '../config/db.js';

const logger = createLogger('Reports');

// ================================================
// HELPER FUNCTIONS
// ================================================



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
        item.persentase_kehadiran = (100 - Number.parseFloat(item.persentase_ketidakhadiran)).toFixed(2);
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

/**
 * Calculate date range from legacy parameters (periode, bulan, tahun)
 * Used for backward compatibility with old frontend bundles
 * @param {string} periode - 'bulanan' | 'semester' | 'tahunan'
 * @param {string|number} bulan - Month number (1-12)
 * @param {string|number} tahun - Year
 * @returns {{startDate: string, endDate: string}}
 */
function calculateDateRangeFromLegacyParams(periode, bulan, tahun) {
    const yearInt = Number.parseInt(tahun) || new Date().getFullYear();
    const monthInt = Number.parseInt(bulan) || new Date().getMonth() + 1;
    
    if (periode === 'bulanan' || (!periode && bulan)) {
        // Monthly: start of month to end of month
        const monthEnd = new Date(yearInt, monthInt, 0); // Last day of month
        return {
            startDate: `${yearInt}-${String(monthInt).padStart(2, '0')}-01`,
            endDate: `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`
        };
    }
    
    if (periode === 'semester') {
        // Semester 1: July - December, Semester 2: January - June
        const isSemester1 = monthInt >= 7;
        if (isSemester1) {
            return { startDate: `${yearInt}-07-01`, endDate: `${yearInt}-12-31` };
        }
        return { startDate: `${yearInt}-01-01`, endDate: `${yearInt}-06-30` };
    }
    
    if (periode === 'tahunan') {
        // Full year
        return { startDate: `${yearInt}-01-01`, endDate: `${yearInt}-12-31` };
    }
    
    // Default fallback: current month
    const monthEnd = new Date(yearInt, monthInt, 0);
    return {
        startDate: `${yearInt}-${String(monthInt).padStart(2, '0')}-01`,
        endDate: `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`
    };
}


// ================================================
// REPORTS & ANALYTICS HELPER EXTENSIONS
// ================================================

/**
 * Calculate total effective days - SYNC fallback using HARI_EFEKTIF_MAP

 * @deprecated Use calculateEffectiveDaysForRange from attendanceCalculator.js for DB-backed calculation
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {number} Total effective days (sync fallback)
 */
function calculateEffectiveDaysSync(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // For very short ranges (< 15 days), use business days calculation
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays < 15) {
        let businessDays = 0;
        const startMs = start.getTime();
        const endMs = end.getTime();
        const ONE_DAY_MS = 86400000;
        for (let ts = startMs; ts <= endMs; ts += ONE_DAY_MS) {
            const d = new Date(ts);
            const day = d.getDay();
            if (day !== 0 && day !== 6) businessDays++;
        }
        return businessDays || 1;
    }
    
    // Use HARI_EFEKTIF_MAP for longer ranges (fallback)
    let totalDays = 0;
    const MAX_ITERATIONS = 60;

    // Use explicit month counter to avoid SonarQube S2189 false positive
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();
    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    const iterationCount = Math.min(totalMonths, MAX_ITERATIONS);

    for (let i = 0; i < iterationCount; i++) {
        const current = new Date(startYear, startMonth + i, 1);
        if (current > end) break;
        
        const monthIndex = current.getMonth() + 1;
        totalDays += HARI_EFEKTIF_MAP[monthIndex] || DEFAULT_EFFECTIVE_DAYS[monthIndex] || 20;
    }
    
    return totalDays || 1;
}

/**
 * Calculate total effective days - ASYNC version with DB lookup
 * Fetches from kalender_akademik for accurate data
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {string} [tahunPelajaran] - Optional academic year
 * @returns {Promise<number>} Total effective days
 */
async function calculateEffectiveDays(startDate, endDate, tahunPelajaran = null) {
    try {
        return await calculateEffectiveDaysForRange(startDate, endDate, tahunPelajaran);
    } catch (error) {
        logger.warn('Failed to calculate effective days from DB, using sync fallback', {
            error: error.message,
            startDate,
            endDate
        });
        return calculateEffectiveDaysSync(startDate, endDate);
    }
}

function generateCSV(res, filename, headerInfo, rows, rowMapper) {
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += headerInfo;

    rows.forEach(row => {
        csvContent += rowMapper(row) + '\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
}

// ================================================
// REPORTS & ANALYTICS ENDPOINTS
// ================================================


// Helper to build analytics queries
function buildAnalyticsQueries(todayWIB, currentYear, currentMonth) {
    const studentAttendanceQuery = `
        SELECT 
            'Hari Ini' as periode,
            COUNT(CASE WHEN a.status IN ('${REPORT_STATUS.HADIR}', '${REPORT_STATUS.DISPEN}') THEN 1 END) as hadir,
            COUNT(CASE WHEN a.status IN ('${REPORT_STATUS.SAKIT}', '${REPORT_STATUS.IZIN}', '${REPORT_STATUS.ALPA}') THEN 1 END) as tidak_hadir
        FROM siswa s
        LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND a.tanggal = ?
        UNION ALL
        SELECT 
            'Minggu Ini' as periode,
            COUNT(CASE WHEN a.status IN ('${REPORT_STATUS.HADIR}', '${REPORT_STATUS.DISPEN}') THEN 1 END) as hadir,
            COUNT(CASE WHEN a.status IN ('${REPORT_STATUS.SAKIT}', '${REPORT_STATUS.IZIN}', '${REPORT_STATUS.ALPA}') THEN 1 END) as tidak_hadir
        FROM siswa s
        LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
            AND YEARWEEK(a.tanggal, 1) = YEARWEEK(?, 1)
        UNION ALL
        SELECT 
            'Bulan Ini' as periode,
            COUNT(CASE WHEN a.status IN ('${REPORT_STATUS.HADIR}', '${REPORT_STATUS.DISPEN}') THEN 1 END) as hadir,
            COUNT(CASE WHEN a.status IN ('${REPORT_STATUS.SAKIT}', '${REPORT_STATUS.IZIN}', '${REPORT_STATUS.ALPA}') THEN 1 END) as tidak_hadir
        FROM siswa s
        LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
            AND YEAR(a.tanggal) = ? 
            AND MONTH(a.tanggal) = ?
    `;

    const teacherAttendanceQuery = `
        SELECT 
            'Hari Ini' as periode,
            COUNT(CASE WHEN ag.status IN ('${REPORT_STATUS.HADIR}', '${REPORT_STATUS.DISPEN}') THEN 1 END) as hadir,
            COUNT(CASE WHEN ag.status IN ('${REPORT_STATUS.TIDAK_HADIR}', '${REPORT_STATUS.SAKIT}', '${REPORT_STATUS.IZIN}') THEN 1 END) as tidak_hadir
        FROM guru g
        LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal = ?
        UNION ALL
        SELECT 
            'Minggu Ini' as periode,
            COUNT(CASE WHEN ag.status IN ('${REPORT_STATUS.HADIR}', '${REPORT_STATUS.DISPEN}') THEN 1 END) as hadir,
            COUNT(CASE WHEN ag.status IN ('${REPORT_STATUS.TIDAK_HADIR}', '${REPORT_STATUS.SAKIT}', '${REPORT_STATUS.IZIN}') THEN 1 END) as tidak_hadir
        FROM guru g
        LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
            AND YEARWEEK(ag.tanggal, 1) = YEARWEEK(?, 1)
        UNION ALL
        SELECT 
            'Bulan Ini' as periode,
            COUNT(CASE WHEN ag.status IN ('${REPORT_STATUS.HADIR}', '${REPORT_STATUS.DISPEN}') THEN 1 END) as hadir,
            COUNT(CASE WHEN ag.status IN ('${REPORT_STATUS.TIDAK_HADIR}', '${REPORT_STATUS.SAKIT}', '${REPORT_STATUS.IZIN}') THEN 1 END) as tidak_hadir
        FROM guru g
        LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
            AND YEAR(ag.tanggal) = ? 
            AND MONTH(ag.tanggal) = ?
    `;

    const topAbsentStudentsQuery = `
        SELECT 
            s.nama,
            k.nama_kelas,
            COUNT(CASE WHEN a.status IN ('${REPORT_STATUS.ALPA}', '${REPORT_STATUS.IZIN}', '${REPORT_STATUS.SAKIT}') THEN 1 END) as total_alpa
        FROM siswa s
        JOIN kelas k ON s.kelas_id = k.id_kelas
        LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id
        GROUP BY s.id_siswa, s.nama, k.nama_kelas
        HAVING total_alpa > 0
        ORDER BY total_alpa DESC
        LIMIT 5
    `;

    const topAbsentTeachersQuery = `
        SELECT 
            g.nama,
            COUNT(CASE WHEN ag.status IN ('${REPORT_STATUS.TIDAK_HADIR}', '${REPORT_STATUS.SAKIT}', '${REPORT_STATUS.IZIN}') THEN 1 END) as total_tidak_hadir
        FROM guru g
        LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id
        GROUP BY g.id_guru, g.nama
        HAVING total_tidak_hadir > 0
        ORDER BY total_tidak_hadir DESC
        LIMIT 5
    `;

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

    return {
        studentAttendanceQuery,
        teacherAttendanceQuery,
        topAbsentStudentsQuery,
        topAbsentTeachersQuery,
        notificationsQuery
    };
}

// Helper to format analytics data
function formatAnalyticsData(results) {
    const [
        [totalStudentsResult],
        [totalTeachersResult],
        [studentAttendance],
        [teacherAttendance],
        [topAbsentStudents],
        [topAbsentTeachers],
        [notifications]
    ] = results;
    
    return {
        studentAttendance: studentAttendance || [],
        teacherAttendance: teacherAttendance || [],
        topAbsentStudents: topAbsentStudents || [],
        topAbsentTeachers: topAbsentTeachers || [],
        notifications: notifications || [],
        totalStudents: totalStudentsResult[0]?.total || 0,
        totalTeachers: totalTeachersResult[0]?.total || 0
    };
}

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

        const cacheKey = `report:analytics:dashboard:${todayWIB}`;
        const cacheSystem = globalThis.cacheSystem;
        let analyticsData;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'analytics');
            if (cached !== null) {
                analyticsData = cached;
                wasCached = true;
            } else {
                const queries = buildAnalyticsQueries(todayWIB, currentYear, currentMonth);

                // Execute all queries in parallel
                const results = await Promise.all([
                    db.execute('SELECT COUNT(*) as total FROM siswa WHERE status = "aktif"'),
                    db.execute('SELECT COUNT(*) as total FROM guru WHERE status = "aktif"'),
                    db.execute(queries.studentAttendanceQuery, [todayWIB, todayWIB, currentYear, currentMonth]),
                    db.execute(queries.teacherAttendanceQuery, [todayWIB, todayWIB, currentYear, currentMonth]),
                    db.execute(queries.topAbsentStudentsQuery),
                    db.execute(queries.topAbsentTeachersQuery),
                    db.execute(queries.notificationsQuery)
                ]);

                analyticsData = formatAnalyticsData(results);
                await cacheSystem.set(cacheKey, analyticsData, 'analytics', 300);
            }
        } else {
            const queries = buildAnalyticsQueries(todayWIB, currentYear, currentMonth);

            // Execute all queries in parallel
            const results = await Promise.all([
                db.execute('SELECT COUNT(*) as total FROM siswa WHERE status = "aktif"'),
                db.execute('SELECT COUNT(*) as total FROM guru WHERE status = "aktif"'),
                db.execute(queries.studentAttendanceQuery, [todayWIB, todayWIB, currentYear, currentMonth]),
                db.execute(queries.teacherAttendanceQuery, [todayWIB, todayWIB, currentYear, currentMonth]),
                db.execute(queries.topAbsentStudentsQuery),
                db.execute(queries.topAbsentTeachersQuery),
                db.execute(queries.notificationsQuery)
            ]);

            analyticsData = formatAnalyticsData(results);
        }

        log.success('GetAnalyticsDashboard', { 
            totalStudents: analyticsData.totalStudents, 
            notificationCount: analyticsData.notifications.length,
            cached: wasCached
        });
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

        const cacheKey = `report:live-teacher:${todayWIB}:${currentDayWIB}`;
        const cacheSystem = globalThis.cacheSystem;
        let rows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                rows = cached;
                wasCached = true;
            } else {
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
                            WHEN ag.terlambat = 1 THEN '${REPORT_STATUS.TERLAMBAT}'
                            WHEN ag.waktu_catat IS NOT NULL THEN
                                CASE 
                                    WHEN TIME(ag.waktu_catat) < '07:00:00' THEN '${REPORT_STATUS.TEPAT_WAKTU}'
                                    WHEN TIME(ag.waktu_catat) BETWEEN '07:00:00' AND '07:15:00' THEN '${REPORT_STATUS.TERLAMBAT_RINGAN}'
                                    WHEN TIME(ag.waktu_catat) BETWEEN '07:15:00' AND '08:00:00' THEN '${REPORT_STATUS.TERLAMBAT}'
                                    ELSE '${REPORT_STATUS.TERLAMBAT_BERAT}'
                                END
                            ELSE '-'
                        END as keterangan_waktu,
                        CASE 
                            WHEN ag.waktu_catat IS NOT NULL THEN
                                CASE 
                                    WHEN HOUR(ag.waktu_catat) < 12 THEN '${REPORT_STATUS.PAGI}'
                                    WHEN HOUR(ag.waktu_catat) < 15 THEN '${REPORT_STATUS.SIANG}'
                                    ELSE '${REPORT_STATUS.SORE}'
                                END
                            ELSE '${REPORT_STATUS.BELUM_ABSEN}'
                        END as periode_absen
                    FROM jadwal j
                    LEFT JOIN guru g ON j.guru_id = g.id_guru
                    LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
                    JOIN kelas k ON j.kelas_id = k.id_kelas
                    LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                        AND DATE(ag.tanggal) = ?
                    WHERE j.hari = ?
                    GROUP BY g.id_guru, g.nama, g.nip, ag.status, ag.waktu_catat, ag.keterangan, ag.terlambat
                    ORDER BY 
                        CASE WHEN ag.waktu_catat IS NOT NULL THEN 0 ELSE 1 END,
                        ag.waktu_catat DESC,
                        g.nama
                `;
                const [dbRows] = await db.execute(query, [todayWIB, currentDayWIB]);
                rows = dbRows;
                await cacheSystem.set(cacheKey, rows, 'attendance', 30);
            }
        } else {
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
                        WHEN ag.terlambat = 1 THEN '${REPORT_STATUS.TERLAMBAT}'
                        WHEN ag.waktu_catat IS NOT NULL THEN
                            CASE 
                                WHEN TIME(ag.waktu_catat) < '07:00:00' THEN '${REPORT_STATUS.TEPAT_WAKTU}'
                                WHEN TIME(ag.waktu_catat) BETWEEN '07:00:00' AND '07:15:00' THEN '${REPORT_STATUS.TERLAMBAT_RINGAN}'
                                WHEN TIME(ag.waktu_catat) BETWEEN '07:15:00' AND '08:00:00' THEN '${REPORT_STATUS.TERLAMBAT}'
                                ELSE '${REPORT_STATUS.TERLAMBAT_BERAT}'
                            END
                        ELSE '-'
                    END as keterangan_waktu,
                    CASE 
                        WHEN ag.waktu_catat IS NOT NULL THEN
                            CASE 
                                WHEN HOUR(ag.waktu_catat) < 12 THEN '${REPORT_STATUS.PAGI}'
                                WHEN HOUR(ag.waktu_catat) < 15 THEN '${REPORT_STATUS.SIANG}'
                                ELSE '${REPORT_STATUS.SORE}'
                            END
                        ELSE '${REPORT_STATUS.BELUM_ABSEN}'
                    END as periode_absen
                FROM jadwal j
                LEFT JOIN guru g ON j.guru_id = g.id_guru
                LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
                JOIN kelas k ON j.kelas_id = k.id_kelas
                LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                    AND DATE(ag.tanggal) = ?
                WHERE j.hari = ?
                GROUP BY g.id_guru, g.nama, g.nip, ag.status, ag.waktu_catat, ag.keterangan, ag.terlambat
                ORDER BY 
                    CASE WHEN ag.waktu_catat IS NOT NULL THEN 0 ELSE 1 END,
                    ag.waktu_catat DESC,
                    g.nama
            `;
            const [dbRows] = await db.execute(query, [todayWIB, currentDayWIB]);
            rows = dbRows;
        }

        log.success('GetLiveTeacherAttendance', { count: rows.length, day: currentDayWIB, cached: wasCached });
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

        const cacheKey = `report:live-student:${todayWIB}`;
        const cacheSystem = globalThis.cacheSystem;
        let rows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                rows = cached;
                wasCached = true;
            } else {
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
                            WHEN a.terlambat = 1 THEN '${REPORT_STATUS.TERLAMBAT}'
                            WHEN a.waktu_absen IS NOT NULL THEN
                                CASE 
                                    WHEN TIME(a.waktu_absen) < '07:00:00' THEN '${REPORT_STATUS.TEPAT_WAKTU}'
                                    WHEN TIME(a.waktu_absen) BETWEEN '07:00:00' AND '07:15:00' THEN '${REPORT_STATUS.TERLAMBAT_RINGAN}'
                                    WHEN TIME(a.waktu_absen) BETWEEN '07:15:00' AND '08:00:00' THEN '${REPORT_STATUS.TERLAMBAT}'
                                    ELSE '${REPORT_STATUS.TERLAMBAT_BERAT}'
                                END
                            ELSE '-'
                        END as keterangan_waktu,
                        CASE 
                            WHEN a.waktu_absen IS NOT NULL THEN
                                CASE 
                                    WHEN HOUR(a.waktu_absen) < 12 THEN '${REPORT_STATUS.PAGI}'
                                    WHEN HOUR(a.waktu_absen) < 15 THEN '${REPORT_STATUS.SIANG}'
                                    ELSE '${REPORT_STATUS.SORE}'
                                END
                            ELSE '${REPORT_STATUS.BELUM_ABSEN}'
                        END as periode_absen
                    FROM siswa s
                    JOIN kelas k ON s.kelas_id = k.id_kelas
                    LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                        AND a.tanggal = ?
                    WHERE s.status = 'aktif'
                    ORDER BY 
                        CASE WHEN a.waktu_absen IS NOT NULL THEN 0 ELSE 1 END,
                        a.waktu_absen DESC,
                        k.nama_kelas,
                        s.nama
                `;
                const [dbRows] = await db.execute(query, [todayWIB]);
                rows = dbRows;
                await cacheSystem.set(cacheKey, rows, 'attendance', 30);
            }
        } else {
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
                        WHEN a.terlambat = 1 THEN '${REPORT_STATUS.TERLAMBAT}'
                        WHEN a.waktu_absen IS NOT NULL THEN
                            CASE 
                                WHEN TIME(a.waktu_absen) < '07:00:00' THEN '${REPORT_STATUS.TEPAT_WAKTU}'
                                WHEN TIME(a.waktu_absen) BETWEEN '07:00:00' AND '07:15:00' THEN '${REPORT_STATUS.TERLAMBAT_RINGAN}'
                                WHEN TIME(a.waktu_absen) BETWEEN '07:15:00' AND '08:00:00' THEN '${REPORT_STATUS.TERLAMBAT}'
                                ELSE '${REPORT_STATUS.TERLAMBAT_BERAT}'
                            END
                        ELSE '-'
                    END as keterangan_waktu,
                    CASE 
                        WHEN a.waktu_absen IS NOT NULL THEN
                            CASE 
                                WHEN HOUR(a.waktu_absen) < 12 THEN '${REPORT_STATUS.PAGI}'
                                WHEN HOUR(a.waktu_absen) < 15 THEN '${REPORT_STATUS.SIANG}'
                                ELSE '${REPORT_STATUS.SORE}'
                            END
                        ELSE '${REPORT_STATUS.BELUM_ABSEN}'
                    END as periode_absen
                FROM siswa s
                JOIN kelas k ON s.kelas_id = k.id_kelas
                LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                    AND a.tanggal = ?
                WHERE s.status = 'aktif'
                ORDER BY 
                    CASE WHEN a.waktu_absen IS NOT NULL THEN 0 ELSE 1 END,
                    a.waktu_absen DESC,
                    k.nama_kelas,
                    s.nama
            `;
            const [dbRows] = await db.execute(query, [todayWIB]);
            rows = dbRows;
        }

        log.success('GetLiveStudentAttendance', { count: rows.length, cached: wasCached });
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
            return sendValidationError(res, REPORT_MESSAGES.DATE_RANGE_REQUIRED, { fields: ['startDate', 'endDate'] });
        }

        const cacheKey = `report:teacher:${startDate}:${endDate}:${kelas_id || 'all'}`;
        const cacheSystem = globalThis.cacheSystem;
        let rows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                rows = cached;
                wasCached = true;
            } else {
                rows = await ExportService.getTeacherReportData(startDate, endDate, kelas_id);
                await cacheSystem.set(cacheKey, rows, 'attendance', 300);
            }
        } else {
            rows = await ExportService.getTeacherReportData(startDate, endDate, kelas_id);
        }

        log.success('GetTeacherReport', { count: rows.length, startDate, endDate, cached: wasCached });
        res.json(rows);
    } catch (error) {
        log.dbError('teacherReport', error);
        return sendDatabaseError(res, error, REPORT_MESSAGES.DB_ERROR_TEACHER_REPORT);
    }
};

export const downloadTeacherAttendanceReport = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;
    
    log.requestStart('DownloadTeacherReport', { startDate, endDate, kelas_id });

    try {
        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, REPORT_MESSAGES.DATE_RANGE_REQUIRED);
        }

        const cacheKey = `report:teacher:${startDate}:${endDate}:${kelas_id || 'all'}`;
        const cacheSystem = globalThis.cacheSystem;
        let rows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                rows = cached;
                wasCached = true;
            } else {
                rows = await ExportService.getTeacherReportData(startDate, endDate, kelas_id);
                await cacheSystem.set(cacheKey, rows, 'attendance', 300);
            }
        } else {
            rows = await ExportService.getTeacherReportData(startDate, endDate, kelas_id);
        }

        const rowMapper = (row) => 
            `"${row.tanggal_formatted}","${row.nama_kelas}","${row.nama_guru}","${row.nip_guru || ''}","${row.nama_mapel}","${row.jam_hadir || ''}","${row.jam_mulai}","${row.jam_selesai}","${row.jadwal}","${row.status}","${row.keterangan || ''}"`;

        generateCSV(res, `laporan-kehadiran-guru-${startDate}-${endDate}.csv`, CSV_HEADERS.TEACHER_REPORT, rows, rowMapper);

        log.success('DownloadTeacherReport', { recordCount: rows.length, cached: wasCached });
    } catch (error) {
        log.dbError('downloadTeacher', error);
        return sendDatabaseError(res, error, REPORT_MESSAGES.DB_ERROR_DOWNLOAD_TEACHER);
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
            return sendValidationError(res, REPORT_MESSAGES.DATE_RANGE_REQUIRED, { fields: ['startDate', 'endDate'] });
        }

        const cacheKey = `report:student:${startDate}:${endDate}:${kelas_id || 'all'}`;
        const cacheSystem = globalThis.cacheSystem;
        let rows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                rows = cached;
                wasCached = true;
            } else {
                rows = await ExportService.getStudentReportData(startDate, endDate, kelas_id);
                await cacheSystem.set(cacheKey, rows, 'attendance', 300);
            }
        } else {
            rows = await ExportService.getStudentReportData(startDate, endDate, kelas_id);
        }

        log.success('GetStudentReport', { count: rows.length, cached: wasCached });
        res.json(rows);
    } catch (error) {
        log.dbError('studentReport', error);
        return sendDatabaseError(res, error, REPORT_MESSAGES.DB_ERROR_STUDENT_REPORT);
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
            return sendValidationError(res, REPORT_MESSAGES.DATE_RANGE_REQUIRED);
        }

        const cacheKey = `report:student:${startDate}:${endDate}:${kelas_id || 'all'}`;
        const cacheSystem = globalThis.cacheSystem;
        let rows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                rows = cached;
                wasCached = true;
            } else {
                rows = await ExportService.getStudentReportData(startDate, endDate, kelas_id);
                await cacheSystem.set(cacheKey, rows, 'attendance', 300);
            }
        } else {
            rows = await ExportService.getStudentReportData(startDate, endDate, kelas_id);
        }

        const rowMapper = (row) => 
            `"${row.tanggal_formatted}","${row.nama_kelas}","${row.nama_siswa}","${row.nis_siswa || ''}","${row.nama_mapel || ''}","${row.nama_guru || ''}","${row.waktu_absen || ''}","${row.jam_mulai || ''}","${row.jam_selesai || ''}","${row.jadwal || ''}","${row.status}","${row.keterangan || ''}"`;

        generateCSV(res, `laporan-kehadiran-siswa-${startDate}-${endDate}.csv`, CSV_HEADERS.STUDENT_REPORT, rows, rowMapper);

        log.success('DownloadStudentReport', { recordCount: rows.length, cached: wasCached });
    } catch (error) {
        log.dbError('downloadStudent', error);
        return sendDatabaseError(res, error, REPORT_MESSAGES.DB_ERROR_DOWNLOAD_STUDENT);
    }
};

// Get student attendance summary
// Get student attendance summary
export const getStudentAttendanceSummary = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;
    
    log.requestStart('GetStudentSummary', { startDate, endDate, kelas_id });

    try {
        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, REPORT_MESSAGES.DATE_RANGE_REQUIRED);
        }

        const cacheKey = `report:student-summary:${startDate}:${endDate}:${kelas_id || 'all'}`;
        const cacheSystem = globalThis.cacheSystem;
        let processedRows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                processedRows = cached;
                wasCached = true;
            } else {
                const rows = await ExportService.getStudentSummaryCounts(startDate, endDate, kelas_id);
                
                // Calculate effective days for percentage using DB-backed calculation
                const effectiveDays = await calculateEffectiveDays(startDate, endDate);
                
                // Post-process rows to add percentage with warning for anomalies
                processedRows = rows.map(row => {
                    const hadir = Number(row.H) || 0;
                    const dispen = Number(row.D) || 0;
                    const totalPresent = hadir + dispen;
                    
                    // Use centralized calculation with warning
                    const { percentage, capped, raw } = calculateAttendancePercentage(
                        totalPresent, 
                        effectiveDays, 
                        { 
                            logWarning: true, 
                            context: `Student: ${row.nama || 'Unknown'} (${row.nis || 'N/A'})` 
                        }
                    );
                    
                    return {
                        ...row,
                        total: effectiveDays, // Show effective days as total expectation
                        actual_total: row.total, // Keep separate record count
                        presentase: percentage.toFixed(2),
                        _raw_percentage: capped ? raw : undefined // Include raw only if capped for debugging
                    };
                });
                await cacheSystem.set(cacheKey, processedRows, 'attendance', 300);
            }
        } else {
            const rows = await ExportService.getStudentSummaryCounts(startDate, endDate, kelas_id);
            
            // Calculate effective days for percentage using DB-backed calculation
            const effectiveDays = await calculateEffectiveDays(startDate, endDate);
            
            // Post-process rows to add percentage with warning for anomalies
            processedRows = rows.map(row => {
                const hadir = Number(row.H) || 0;
                const dispen = Number(row.D) || 0;
                const totalPresent = hadir + dispen;
                
                // Use centralized calculation with warning
                const { percentage, capped, raw } = calculateAttendancePercentage(
                    totalPresent, 
                    effectiveDays, 
                    { 
                        logWarning: true, 
                        context: `Student: ${row.nama || 'Unknown'} (${row.nis || 'N/A'})` 
                    }
                );
                
                return {
                    ...row,
                    total: effectiveDays, // Show effective days as total expectation
                    actual_total: row.total, // Keep separate record count
                    presentase: percentage.toFixed(2),
                    _raw_percentage: capped ? raw : undefined // Include raw only if capped for debugging
                };
            });
        }

        log.success('GetStudentSummary', { count: processedRows.length, cached: wasCached });
        res.json(processedRows);
    } catch (error) {
        log.dbError('studentSummary', error);
        return sendDatabaseError(res, error, REPORT_MESSAGES.DB_ERROR_STUDENT_SUMMARY);
    }
};

// Helper to validate export params
function validateExportParams(startDate, endDate) {
    if (!startDate || !endDate) {
        return { valid: false, error: 'Tanggal mulai dan tanggal selesai wajib diisi', type: 'dates' };
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
        return { valid: false, error: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD', type: 'dateFormat' };
    }

    if (startDateObj > endDateObj) {
        return { valid: false, error: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai', type: 'dateRange' };
    }

    const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
    if (daysDiff > 366) {
        return { valid: false, error: 'Rentang tanggal tidak boleh lebih dari 366 hari', type: 'dateRange', data: daysDiff };
    }

    return { valid: true };
}

// Download student attendance summary as styled Excel (Streamed)
export const downloadStudentAttendanceExcel = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;

    log.requestStart('DownloadStudentExcel', { startDate, endDate, kelas_id });

    try {
        // Validasi input
        const validation = validateExportParams(startDate, endDate);
        if (!validation.valid) {
            log.validationFail(validation.type, validation.data, validation.error);
            return sendValidationError(res, validation.error);
        }

        const cacheKey = `report:student-summary:${startDate}:${endDate}:${kelas_id || 'all'}`;
        const cacheSystem = globalThis.cacheSystem;
        let rows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                rows = cached;
                wasCached = true;
            } else {
                rows = await ExportService.getStudentSummaryCounts(startDate, endDate, kelas_id);
                await cacheSystem.set(cacheKey, rows, 'attendance', 300);
            }
        } else {
            rows = await ExportService.getStudentSummaryCounts(startDate, endDate, kelas_id);
        }

        log.debug('Building Excel export (streaming)', { studentCount: rows.length });

        // Calculate effective days outside the loop (DB-backed)
        const effectiveDays = await calculateEffectiveDays(startDate, endDate);

        // Define row mapper for streaming
        const rowMapper = (r, idx) => {
            const hadir = Number(r.H) || 0;
            const dispen = Number(r.D) || 0;
            const totalPresent = hadir + dispen;
            
            // Use centralized calculation with warning
            const { percentage } = calculateAttendancePercentage(
                totalPresent, 
                effectiveDays, 
                { 
                    logWarning: true, 
                    context: `Excel Export - Student: ${r.nama || 'Unknown'}` 
                }
            );

            return {
                no: idx + 1,
                nama: r.nama || '',
                nis: r.nis || '',
                kelas: r.nama_kelas || '',
                hadir: hadir,
                izin: Number(r.I) || 0,
                sakit: Number(r.S) || 0,
                alpa: Number(r.A) || 0,
                dispen: dispen,
                presentase: percentage / 100 // Convert to decimal
            };
        };

        // Use Streaming Builder
        const { streamExcel } = await import('../services/export/excelStreamingBuilder.js');
        const studentSchemaModule = await import('../services/export/schemas/student-summary.js');
        const studentSchema = studentSchemaModule.default;
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.KEHADIRAN_SISWA });

        await streamExcel(res, {
            filename: `ringkasan-kehadiran-siswa-${startDate}-${endDate}.xlsx`,
            title: studentSchema.title,
            subtitle: studentSchema.subtitle,
            reportPeriod: `${startDate} - ${endDate}`,
            letterhead: letterhead.enabled ? letterhead : {},
            columns: studentSchema.columns,
            dataIterator: rows, // Array as iterator
            rowMapper: rowMapper
        });

        log.success('DownloadStudentExcel', { count: rows.length, effectiveDays, cached: wasCached, filename: `ringkasan-kehadiran-siswa-${startDate}-${endDate}.xlsx` });
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
    let { startDate, endDate, periode, bulan, tahun } = req.query;
    
    log.requestStart('GetTeacherSummary', { startDate, endDate, periode, bulan, tahun });

    try {
        // Backward compatibility: calculate startDate/endDate from periode/bulan/tahun if provided
        if (!startDate || !endDate) {
            if (periode || bulan || tahun) {
                const calculated = calculateDateRangeFromLegacyParams(periode, bulan, tahun);
                startDate = calculated.startDate;
                endDate = calculated.endDate;
                log.debug('Calculated dates from legacy params', { startDate, endDate, periode, bulan, tahun });
            }
        }


        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, REPORT_MESSAGES.DATE_RANGE_REQUIRED);
        }

        const cacheKey = `report:teacher-summary:${startDate}:${endDate}`;
        const cacheSystem = globalThis.cacheSystem;
        let rows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                rows = cached;
                wasCached = true;
            } else {
                let query = `
                    SELECT 
                        g.id_guru as guru_id,
                        g.nama,
                        g.nip,
                        COALESCE(SUM(CASE WHEN ag.status IN ('${REPORT_STATUS.HADIR}', '${REPORT_STATUS.DISPEN}') THEN 1 ELSE 0 END), 0) AS H,
                        COALESCE(SUM(CASE WHEN ag.status = '${REPORT_STATUS.IZIN}' THEN 1 ELSE 0 END), 0) AS I,
                        COALESCE(SUM(CASE WHEN ag.status = '${REPORT_STATUS.SAKIT}' THEN 1 ELSE 0 END), 0) AS S,
                        COALESCE(SUM(CASE WHEN ag.status = '${REPORT_STATUS.TIDAK_HADIR}' THEN 1 ELSE 0 END), 0) AS A,
                        COALESCE(SUM(CASE WHEN ag.status = '${REPORT_STATUS.DISPEN}' THEN 1 ELSE 0 END), 0) AS D,
                        COALESCE(COUNT(ag.id_absensi), 0) AS total,
                        CASE 
                            WHEN COUNT(ag.id_absensi) = 0 THEN 0
                            ELSE ROUND((SUM(CASE WHEN ag.status IN ('${REPORT_STATUS.HADIR}', '${REPORT_STATUS.DISPEN}') THEN 1 ELSE 0 END) * 100.0 / COUNT(ag.id_absensi)), 2)
                        END AS presentase
                    FROM guru g
                    LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal BETWEEN ? AND ?
                    WHERE g.status = 'aktif'
                `;
                const params = [startDate, endDate];
                query += ' GROUP BY g.id_guru, g.nama, g.nip ORDER BY g.nama';
                
                const [dbRows] = await db.execute(query, params);
                rows = dbRows;
                await cacheSystem.set(cacheKey, rows, 'attendance', 300);
            }
        } else {
            let query = `
                SELECT 
                    g.id_guru as guru_id,
                    g.nama,
                    g.nip,
                    COALESCE(SUM(CASE WHEN ag.status IN ('${REPORT_STATUS.HADIR}', '${REPORT_STATUS.DISPEN}') THEN 1 ELSE 0 END), 0) AS H,
                    COALESCE(SUM(CASE WHEN ag.status = '${REPORT_STATUS.IZIN}' THEN 1 ELSE 0 END), 0) AS I,
                    COALESCE(SUM(CASE WHEN ag.status = '${REPORT_STATUS.SAKIT}' THEN 1 ELSE 0 END), 0) AS S,
                    COALESCE(SUM(CASE WHEN ag.status = '${REPORT_STATUS.TIDAK_HADIR}' THEN 1 ELSE 0 END), 0) AS A,
                    COALESCE(SUM(CASE WHEN ag.status = '${REPORT_STATUS.DISPEN}' THEN 1 ELSE 0 END), 0) AS D,
                    COALESCE(COUNT(ag.id_absensi), 0) AS total,
                    CASE 
                        WHEN COUNT(ag.id_absensi) = 0 THEN 0
                        ELSE ROUND((SUM(CASE WHEN ag.status IN ('${REPORT_STATUS.HADIR}', '${REPORT_STATUS.DISPEN}') THEN 1 ELSE 0 END) * 100.0 / COUNT(ag.id_absensi)), 2)
                    END AS presentase
                FROM guru g
                LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal BETWEEN ? AND ?
                WHERE g.status = 'aktif'
            `;
            const params = [startDate, endDate];
            query += ' GROUP BY g.id_guru, g.nama, g.nip ORDER BY g.nama';
            
            const [dbRows] = await db.execute(query, params);
            rows = dbRows;
        }

        log.success('GetTeacherSummary', { count: rows.length, cached: wasCached });
        res.json(rows);
    } catch (error) {
        log.dbError('teacherSummary', error);
        return sendDatabaseError(res, error, REPORT_MESSAGES.DB_ERROR_TEACHER_SUMMARY);
    }
};

// Helper to build guru attendance query
function buildGuruAttendanceQuery(isAnnual, selectedYear, start, end, startDate, endDate) {
    if (isAnnual) {
        // Annual Report based on Academic Year (July - June)
        const query = `
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
                AND ag.status IN ('${REPORT_STATUS.SAKIT}', '${REPORT_STATUS.IZIN}', '${REPORT_STATUS.TIDAK_HADIR}')
            WHERE g.status = 'aktif'
            GROUP BY g.id_guru, g.nama, g.nip
            ORDER BY g.nama
        `;
        return { query, params: [startDate, endDate] };
    } else {
        // Monthly or Date Range Report
        const query = `
            SELECT 
                g.id_guru as id,
                g.nama as nama_guru,
                g.nip,
                COALESCE(COUNT(ag.id_absensi), 0) as total_ketidakhadiran
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
                AND ag.tanggal BETWEEN ? AND ?
                AND ag.status IN ('${REPORT_STATUS.SAKIT}', '${REPORT_STATUS.IZIN}', '${REPORT_STATUS.TIDAK_HADIR}')
            WHERE g.status = 'aktif'
            GROUP BY g.id_guru, g.nama, g.nip
            ORDER BY g.nama
        `;
        return { query, params: [start, end] };
    }
}

// Get rekap ketidakhadiran guru (Pivot per bulan)
export const getRekapKetidakhadiranGuru = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { year, tahun, bulan, tanggal_awal, tanggal_akhir } = req.query;
    
    // Support both 'year' and 'tahun' params with validation
    const selectedYear = Number.parseInt(year || tahun) || new Date().getFullYear();
    
    log.requestStart('GetRekapKetidakhadiranGuru', { selectedYear, bulan, tanggal_awal, tanggal_akhir });

    try {
        const isAnnual = !tanggal_awal && !tanggal_akhir && selectedYear;
        const startDate = `${selectedYear}-07-01`;
        const endDate = `${selectedYear + 1}-06-30`;

        const start = tanggal_awal || `${selectedYear}-${String(bulan || 1).padStart(2, '0')}-01`;
        // Calculate end of month without timezone issues
        const monthIndex = bulan ? Number.parseInt(bulan) : 1;
        const monthEndDate = new Date(selectedYear, monthIndex, 0);
        const end = tanggal_akhir || `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

        const cacheKey = `report:rekap-guru:${selectedYear}:${bulan || 'all'}:${tanggal_awal || 'none'}:${tanggal_akhir || 'none'}`;
        const cacheSystem = globalThis.cacheSystem;
        let processedRows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                processedRows = cached;
                wasCached = true;
            } else {
                const { query, params } = buildGuruAttendanceQuery(isAnnual, selectedYear, start, end, startDate, endDate);

                const [rows] = await db.execute(query, params);

                // Fetch hari efektif from kalender_akademik for accurate calculation
                const tahunPelajaran = `${selectedYear}/${selectedYear + 1}`;
                const { getEffectiveDaysMap } = await import('./kalenderAkademikController.js');
                const hariEfektifMap = await getEffectiveDaysMap(tahunPelajaran);
                
                // Calculate total effective days from map
                const totalHariEfektif = Object.values(hariEfektifMap).reduce((sum, val) => sum + val, 0);
                
                log.info('Fetched hari efektif from kalender_akademik', { 
                    tahunPelajaran, 
                    totalHariEfektif,
                    isAnnual
                });

                processedRows = rows.map(row => {
                    const absences = Number.parseInt(row.total_ketidakhadiran) || 0;
                    
                    // For annual view, use total hari efektif; for monthly, use specific month
                    let effectiveDays;
                    if (isAnnual) {
                        effectiveDays = totalHariEfektif;
                    } else if (bulan) {
                        effectiveDays = hariEfektifMap[Number.parseInt(bulan)] || 20;
                    } else {
                        // Date range mode - estimate based on days
                        const startD = new Date(start);
                        const endD = new Date(end);
                        const daysDiff = Math.ceil((endD - startD) / (1000 * 60 * 60 * 24)) + 1;
                        effectiveDays = Math.round(daysDiff * 0.7); // Approx 70% are working days
                    }
                    
                    const presence = Math.max(0, effectiveDays - absences);
                    
                    return {
                        ...row,
                        total_hari_efektif: effectiveDays,
                        total_kehadiran: presence,
                        persentase_ketidakhadiran: effectiveDays > 0 ? ((absences / effectiveDays) * 100).toFixed(2) : '0.00',
                        persentase_kehadiran: effectiveDays > 0 ? ((presence / effectiveDays) * 100).toFixed(2) : '100.00'
                    };
                });
                await cacheSystem.set(cacheKey, processedRows, 'attendance', 300);
            }
        } else {
            const { query, params } = buildGuruAttendanceQuery(isAnnual, selectedYear, start, end, startDate, endDate);

            const [rows] = await db.execute(query, params);

            // Fetch hari efektif from kalender_akademik for accurate calculation
            const tahunPelajaran = `${selectedYear}/${selectedYear + 1}`;
            const { getEffectiveDaysMap } = await import('./kalenderAkademikController.js');
            const hariEfektifMap = await getEffectiveDaysMap(tahunPelajaran);
            
            // Calculate total effective days from map
            const totalHariEfektif = Object.values(hariEfektifMap).reduce((sum, val) => sum + val, 0);
            
            log.info('Fetched hari efektif from kalender_akademik', { 
                tahunPelajaran, 
                totalHariEfektif,
                isAnnual
            });

            processedRows = rows.map(row => {
                const absences = Number.parseInt(row.total_ketidakhadiran) || 0;
                
                // For annual view, use total hari efektif; for monthly, use specific month
                let effectiveDays;
                if (isAnnual) {
                    effectiveDays = totalHariEfektif;
                } else if (bulan) {
                    effectiveDays = hariEfektifMap[Number.parseInt(bulan)] || 20;
                } else {
                    // Date range mode - estimate based on days
                    const startD = new Date(start);
                    const endD = new Date(end);
                    const daysDiff = Math.ceil((endD - startD) / (1000 * 60 * 60 * 24)) + 1;
                    effectiveDays = Math.round(daysDiff * 0.7); // Approx 70% are working days
                }
                
                const presence = Math.max(0, effectiveDays - absences);
                
                return {
                    ...row,
                    total_hari_efektif: effectiveDays,
                    total_kehadiran: presence,
                    persentase_ketidakhadiran: effectiveDays > 0 ? ((absences / effectiveDays) * 100).toFixed(2) : '0.00',
                    persentase_kehadiran: effectiveDays > 0 ? ((presence / effectiveDays) * 100).toFixed(2) : '100.00'
                };
            });
        }

        log.success('GetRekapKetidakhadiranGuru', { count: processedRows.length, cached: wasCached });
        res.json(processedRows);

    } catch (error) {
        log.dbError('rekapGuru', error);
        return sendDatabaseError(res, error, REPORT_MESSAGES.DB_ERROR_REKAP_GURU);
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
            return sendValidationError(res, REPORT_MESSAGES.INVALID_CLASS_ID, { field: 'kelas_id' });
        }

        // Calculate date range
        const { startDate, endDate } = calculateDateRange(tahun, bulan, tanggal_awal, tanggal_akhir);

        const cacheKey = `report:rekap-siswa:${kelas_id}:${tahun || 'none'}:${bulan || 'all'}:${tanggal_awal || 'none'}:${tanggal_akhir || 'none'}`;
        const cacheSystem = globalThis.cacheSystem;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                wasCached = true;
                log.success('GetRekapKetidakhadiranSiswa', { count: cached.length, cached: wasCached });
                return res.json(cached);
            }
        }

        // Fetch rekap data per siswa per bulan
        const query = `
            SELECT 
                a.siswa_id,
                MONTH(a.tanggal) as bulan,
                YEAR(a.tanggal) as tahun_absen,
                SUM(CASE WHEN a.status IN ('${REPORT_STATUS.SAKIT}', '${REPORT_STATUS.IZIN}', '${REPORT_STATUS.ALPA}') THEN 1 ELSE 0 END) as total_ketidakhadiran,
                GROUP_CONCAT(
                    CASE WHEN a.status IN ('${REPORT_STATUS.SAKIT}', '${REPORT_STATUS.IZIN}', '${REPORT_STATUS.ALPA}') 
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

        const [rows] = await db.execute(query, [kelas_id, startDate, endDate]);

        // Map rows to result objects using helper function
        const result = rows.map(mapAttendanceRow);

        // Aggregate if filtering by date range
        if (tanggal_awal && tanggal_akhir) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
            
            const finalResult = aggregateAttendanceByStudent(result, diffDays);
            
            if (cacheSystem) {
                await cacheSystem.set(cacheKey, finalResult, 'attendance', 300);
            }
            log.success('GetRekapKetidakhadiranSiswa', { count: finalResult.length, mode: 'range', cached: wasCached });
            return res.json(finalResult);
        }

        if (cacheSystem) {
            await cacheSystem.set(cacheKey, result, 'attendance', 300);
        }
        log.success('GetRekapKetidakhadiranSiswa', { count: result.length, cached: wasCached });
        res.json(result);

    } catch (error) {
        log.dbError('rekapSiswa', error, { kelas_id });
        return sendDatabaseError(res, error, REPORT_MESSAGES.DB_ERROR_REKAP_SISWA);
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
        return sendValidationError(res, REPORT_MESSAGES.INVALID_CLASS_ID, { received: kelasId });
    }

    log.requestStart('GetStudentsByClass', { kelasId });

    try {
        const cacheKey = `report:students-by-class:${kelasId}`;
        const cacheSystem = globalThis.cacheSystem;
        let rows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'students');
            if (cached !== null) {
                rows = cached;
                wasCached = true;
            } else {
                const query = `
                    SELECT id_siswa as id, nama, nis, jenis_kelamin, kelas_id 
                    FROM siswa 
                    WHERE kelas_id = ? AND status = 'aktif'
                    ORDER BY nama ASC
                `;
                const [dbRows] = await db.execute(query, [kelasId]);
                rows = dbRows;
                await cacheSystem.set(cacheKey, rows, 'students');
            }
        } else {
            const query = `
                SELECT id_siswa as id, nama, nis, jenis_kelamin, kelas_id 
                FROM siswa 
                WHERE kelas_id = ? AND status = 'aktif'
                ORDER BY nama ASC
            `;
            const [dbRows] = await db.execute(query, [kelasId]);
            rows = dbRows;
        }
        
        log.success('GetStudentsByClass', { count: rows.length, cached: wasCached });
        res.json(rows);
    } catch (error) {
        log.dbError('studentsByClass', error);
        return sendDatabaseError(res, error, REPORT_MESSAGES.DB_ERROR_STUDENTS_CLASS);
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
            return sendValidationError(res, REPORT_MESSAGES.MISSING_PARAMS);
        }

        // Validate kelas_id is numeric
        if (Number.isNaN(Number.parseInt(kelas_id))) {
            log.validationFail('kelas_id', kelas_id, 'Invalid format');
            return sendValidationError(res, REPORT_MESSAGES.INVALID_CLASS_ID);
        }

        const tahunInt = Number.parseInt(tahun) || new Date().getFullYear();
        const bulanInt = Number.parseInt(bulan) || 1;
        const startDate = `${tahunInt}-${String(bulanInt).padStart(2, '0')}-01`;
        // Calculate end of month without timezone issues
        const monthEndDate = new Date(tahunInt, bulanInt, 0);
        const endDate = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

        const cacheKey = `report:presensi:${kelas_id}:${bulan}:${tahun}`;
        const cacheSystem = globalThis.cacheSystem;
        let rows;
        let wasCached = false;

        if (cacheSystem) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) {
                rows = cached;
                wasCached = true;
            } else {
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
                const [dbRows] = await db.execute(query, [kelas_id, startDate, endDate]);
                rows = dbRows;
                await cacheSystem.set(cacheKey, rows, 'attendance', 300);
            }
        } else {
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
            const [dbRows] = await db.execute(query, [kelas_id, startDate, endDate]);
            rows = dbRows;
        }

        log.success('GetPresensiSiswa', { count: rows.length, cached: wasCached });
        res.json(rows);
    } catch (error) {
        log.dbError('presensiSiswa', error);
        return sendDatabaseError(res, error, REPORT_MESSAGES.DB_ERROR_PRESENSI_SISWA);
    }
};
