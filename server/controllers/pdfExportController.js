/**
 * PDF Export Controller
 * Handles all PDF report generation endpoints
 * Mirrors Excel export patterns using buildPdf + streamPdfResponse
 */

import { createLogger } from '../utils/logger.js';
import ExportService from '../services/ExportService.js';
import db from '../config/db.js';
import { sendValidationError } from '../utils/errorHandler.js';
import { buildPdf } from '../../backend/export/pdfBuilder.js';
import { streamPdfResponse, generatePdfFilename, wrapPdfExport } from '../../backend/export/pdfHelpers.js';
import { getLetterhead, REPORT_KEYS } from '../../backend/utils/letterheadService.js';
import { ABSENT_STATUSES } from '../config/attendanceConstants.js';
import {
    getSemesterEffectiveDays,
    calculateAbsencePercentage,
    buildTahunPelajaran
} from '../utils/attendanceCalculator.js';

const logger = createLogger('PdfExport');

// ================================================
// STUDENT SUMMARY PDF
// GET /api/export/pdf/student-summary
// ================================================

/**
 * Export student attendance summary as PDF
 * @param {import('express').Request} req - Express request (query: startDate, endDate, kelas_id)
 * @param {import('express').Response} res - Express response
 */
export const exportStudentSummaryPdf = wrapPdfExport(async (req, res) => {
    const { startDate, endDate, kelas_id } = req.query;
    const students = await ExportService.getStudentSummary(startDate, endDate, kelas_id);

    const studentSummarySchema = await import('../../backend/export/schemas/student-summary.js');
    const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.KEHADIRAN_SISWA });

    const reportData = students.map((row, index) => ({
        no: index + 1,
        nama: row.nama,
        nis: row.nis,
        kelas: row.nama_kelas,
        hadir: row.H,
        izin: row.I,
        sakit: row.S,
        alpa: row.A,
        dispen: row.D,
        presentase: row.presentase / 100
    }));

    const buffer = await buildPdf({
        title: studentSummarySchema.default.title,
        subtitle: studentSummarySchema.default.subtitle,
        reportPeriod: `${startDate} - ${endDate}`,
        showLetterhead: true,
        letterhead,
        columns: studentSummarySchema.default.columns,
        rows: reportData,
        orientation: 'landscape'
    });

    const filename = generatePdfFilename('Ringkasan_Kehadiran_Siswa', startDate, endDate);
    streamPdfResponse(res, buffer, filename);
    logger.info('Student summary PDF exported', { startDate, endDate, kelas_id, rowCount: reportData.length });
}, 'Student Summary PDF');

// ================================================
// TEACHER SUMMARY PDF
// GET /api/export/pdf/teacher-summary
// ================================================

/**
 * Export teacher attendance summary as PDF
 * @param {import('express').Request} req - Express request (query: startDate, endDate)
 * @param {import('express').Response} res - Express response
 */
export const exportTeacherSummaryPdf = wrapPdfExport(async (req, res) => {
    const { startDate, endDate } = req.query;
    const teachers = await ExportService.getTeacherSummary(startDate, endDate);

    const teacherSummarySchema = await import('../../backend/export/schemas/teacher-summary.js');
    const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.LAPORAN_GURU });

    const reportData = teachers.map((row, index) => ({
        no: index + 1,
        nama: row.nama,
        nip: row.nip,
        hadir: row.H,
        izin: row.I,
        sakit: row.S,
        alpa: row.A,
        presentase: row.presentase / 100
    }));

    const buffer = await buildPdf({
        title: teacherSummarySchema.default.title,
        subtitle: teacherSummarySchema.default.subtitle,
        reportPeriod: `${startDate} - ${endDate}`,
        showLetterhead: true,
        letterhead,
        columns: teacherSummarySchema.default.columns,
        rows: reportData,
        orientation: 'landscape'
    });

    const filename = generatePdfFilename('Ringkasan_Kehadiran_Guru', startDate, endDate);
    streamPdfResponse(res, buffer, filename);
    logger.info('Teacher summary PDF exported', { startDate, endDate, rowCount: reportData.length });
}, 'Teacher Summary PDF');

// ================================================
// BANDING ABSEN PDF
// GET /api/export/pdf/banding-absen
// ================================================

/**
 * Export banding absen data as PDF
 * @param {import('express').Request} req - Express request (query: startDate, endDate, kelas_id, status)
 * @param {import('express').Response} res - Express response
 */
export const exportBandingAbsenPdf = wrapPdfExport(async (req, res) => {
    const { startDate, endDate, kelas_id, status } = req.query;
    const bandingData = await ExportService.getBandingAbsen(startDate, endDate, kelas_id, status);

    const bandingAbsenSchema = await import('../../backend/export/schemas/banding-absen.js');
    const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.BANDING_ABSEN });

    const reportData = bandingData.map((row, index) => ({
        no: index + 1,
        tanggal_pengajuan: row.tanggal_pengajuan,
        tanggal_absen: row.tanggal_absen,
        pengaju: row.nama_pengaju,
        kelas: row.nama_kelas,
        mata_pelajaran: row.nama_mapel,
        guru: row.nama_guru,
        jadwal: row.jadwal,
        status_asli: row.status_asli,
        status_diajukan: row.status_diajukan,
        status_banding: row.status_banding,
        jenis_banding: row.jenis_banding,
        alasan_banding: row.alasan_banding,
        catatan_guru: row.catatan_guru,
        tanggal_keputusan: row.tanggal_keputusan,
        diproses_oleh: row.diproses_oleh
    }));

    const reportPeriod = startDate && endDate ? `${startDate} - ${endDate}` : '';

    const buffer = await buildPdf({
        title: bandingAbsenSchema.default.title,
        subtitle: bandingAbsenSchema.default.subtitle,
        reportPeriod,
        showLetterhead: true,
        letterhead,
        columns: bandingAbsenSchema.default.columns,
        rows: reportData,
        orientation: 'landscape'
    });

    const filename = generatePdfFilename('Banding_Absen', startDate, endDate);
    streamPdfResponse(res, buffer, filename);
    logger.info('Banding absen PDF exported', { startDate, endDate, status, rowCount: reportData.length });
}, 'Banding Absen PDF');

// ================================================
// REKAP KETIDAKHADIRAN SISWA PDF
// GET /api/export/pdf/rekap-ketidakhadiran-siswa
// ================================================

/**
 * Export rekap ketidakhadiran siswa as PDF
 * @param {import('express').Request} req - Express request (query: kelas_id, tahun, semester)
 * @param {import('express').Response} res - Express response
 */
export const exportRekapKetidakhadiranSiswaPdf = wrapPdfExport(async (req, res) => {
    const { kelas_id, tahun, semester = 'gasal' } = req.query;

    const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN_SISWA });

    // Get class info
    const [kelasRows] = await db.execute(
        'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
        [kelas_id]
    );
    const kelasName = kelasRows.length > 0 ? kelasRows[0].nama_kelas : 'Unknown';

    // Get students
    const [studentsRows] = await db.execute(
        'SELECT s.id_siswa as id, s.nis, s.nama, s.jenis_kelamin FROM siswa s WHERE s.kelas_id = ? AND s.status = "aktif" ORDER BY s.nama ASC',
        [kelas_id]
    );

    // Get absence data
    const presensiData = await ExportService.getRekapKetidakhadiranSiswa(tahun, kelas_id, semester);

    // Get effective days
    const tahunPelajaran = buildTahunPelajaran(tahun);
    const { totalDays: TOTAL_HARI_EFEKTIF_RAW } = await getSemesterEffectiveDays(tahunPelajaran, semester);
    const TOTAL_HARI_EFEKTIF = Math.max(TOTAL_HARI_EFEKTIF_RAW, 1);

    const months = semester === 'gasal'
        ? [7, 8, 9, 10, 11, 12]
        : [1, 2, 3, 4, 5, 6];
    const monthKeys = ['jul', 'agt', 'sep', 'okt', 'nov', 'des', 'jan', 'feb', 'mar', 'apr', 'mei', 'jun'];

    // Build row data
    const reportData = studentsRows.map((student, index) => {
        const absData = presensiData.find(p => p.id === student.id) || {};
        const monthValues = {};
        let totalKetidakhadiran = 0;

        months.forEach((m, idx) => {
            const key = monthKeys[semester === 'gasal' ? idx : idx + 6] || monthKeys[idx];
            const val = absData[key] || 0;
            monthValues[key] = val;
            totalKetidakhadiran += val;
        });

        const persentase = calculateAbsencePercentage(totalKetidakhadiran, TOTAL_HARI_EFEKTIF);

        return {
            no: index + 1,
            nama: student.nama,
            nis: student.nis,
            jenis_kelamin: student.jenis_kelamin,
            ...monthValues,
            total_ketidakhadiran: totalKetidakhadiran,
            persentase_ketidakhadiran: persentase / 100
        };
    });

    const rekapSchema = await import('../../backend/export/schemas/rekap-ketidakhadiran-siswa.js');
    const semesterLabel = semester === 'gasal' ? 'Gasal' : 'Genap';

    const buffer = await buildPdf({
        title: rekapSchema.default.title,
        subtitle: `Kelas: ${kelasName} | Semester ${semesterLabel}`,
        reportPeriod: `Tahun Pelajaran ${tahunPelajaran}`,
        showLetterhead: true,
        letterhead,
        columns: rekapSchema.default.columns,
        rows: reportData,
        orientation: 'landscape'
    });

    const filename = generatePdfFilename(`Rekap_Ketidakhadiran_Siswa_${kelasName}`, tahun, semester);
    streamPdfResponse(res, buffer, filename);
    logger.info('Rekap ketidakhadiran siswa PDF exported', { kelas_id, tahun, semester, rowCount: reportData.length });
}, 'Rekap Ketidakhadiran Siswa PDF');

// ================================================
// REKAP KETIDAKHADIRAN GURU PDF
// GET /api/export/pdf/rekap-ketidakhadiran-guru
// ================================================

/**
 * Export rekap ketidakhadiran guru as PDF
 * @param {import('express').Request} req - Express request (query: tahun)
 * @param {import('express').Response} res - Express response
 */
export const exportRekapKetidakhadiranGuruPdf = wrapPdfExport(async (req, res) => {
    const { tahun } = req.query;
    if (!tahun) {
        return sendValidationError(res, 'Tahun harus diisi');
    }

    const tahunInput = String(tahun).trim();
    let tahunAwal;
    let tahunAkhir;

    if (/^\d{4}\s*-\s*\d{4}$/.test(tahunInput)) {
        const [awal, akhir] = tahunInput.split('-').map(v => Number.parseInt(v.trim(), 10));
        tahunAwal = awal;
        tahunAkhir = akhir;
    } else if (/^\d{4}$/.test(tahunInput)) {
        tahunAwal = Number.parseInt(tahunInput, 10);
        tahunAkhir = tahunAwal + 1;
    } else {
        return sendValidationError(res, 'Format tahun ajaran tidak valid');
    }

    const tahunAjaran = `${tahunAwal}-${tahunAkhir}`;
    const startDate = `${tahunAwal}-07-01`;
    const endDate = `${tahunAkhir}-06-30`;
    const statusPlaceholders = ABSENT_STATUSES.map(() => '?').join(', ');

    const query = `
        SELECT 
            g.id_guru as id,
            g.nama,
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
            COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 6 THEN 1 ELSE 0 END), 0) as jun
        FROM guru g
        LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
            AND ag.tanggal BETWEEN ? AND ?
            AND ag.status IN (${statusPlaceholders})
        WHERE g.status = 'aktif'
        GROUP BY g.id_guru, g.nama, g.nip
        ORDER BY g.nama
    `;

     const [rows] = await db.execute(query, [startDate, endDate, ...ABSENT_STATUSES]);
     const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN_GURU });
 
     // Build simplified rekap data — column schema has: no, nama, nip, mata_pelajaran, ruang, periode, hadir, izin, sakit, alpa, total, presentase
     // But the yearly report just uses monthly sums. We adapt the schema columns to match the actual data shape.
     // Use the rekap-ketidakhadiran-siswa style columns (monthly) instead:
    const monthlyColumns = [
        { key: 'no', label: 'No', width: 5, align: 'center' },
        { key: 'nama', label: 'Nama Guru', width: 25, align: 'left' },
        { key: 'nip', label: 'NIP', width: 15, align: 'center' },
        { key: 'jul', label: 'Jul', width: 6, align: 'center', format: 'number' },
        { key: 'agt', label: 'Agu', width: 6, align: 'center', format: 'number' },
        { key: 'sep', label: 'Sep', width: 6, align: 'center', format: 'number' },
        { key: 'okt', label: 'Okt', width: 6, align: 'center', format: 'number' },
        { key: 'nov', label: 'Nov', width: 6, align: 'center', format: 'number' },
        { key: 'des', label: 'Des', width: 6, align: 'center', format: 'number' },
        { key: 'jan', label: 'Jan', width: 6, align: 'center', format: 'number' },
        { key: 'feb', label: 'Feb', width: 6, align: 'center', format: 'number' },
        { key: 'mar', label: 'Mar', width: 6, align: 'center', format: 'number' },
        { key: 'apr', label: 'Apr', width: 6, align: 'center', format: 'number' },
        { key: 'mei', label: 'Mei', width: 6, align: 'center', format: 'number' },
        { key: 'jun', label: 'Jun', width: 6, align: 'center', format: 'number' },
        { key: 'total', label: 'Total', width: 8, align: 'center', format: 'number' }
    ];

    const reportData = rows.map((row, index) => {
        const total = (row.jul || 0) + (row.agt || 0) + (row.sep || 0) + (row.okt || 0) +
            (row.nov || 0) + (row.des || 0) + (row.jan || 0) + (row.feb || 0) +
            (row.mar || 0) + (row.apr || 0) + (row.mei || 0) + (row.jun || 0);
        return {
            no: index + 1,
            nama: row.nama,
            nip: row.nip || '-',
            jul: row.jul || 0,
            agt: row.agt || 0,
            sep: row.sep || 0,
            okt: row.okt || 0,
            nov: row.nov || 0,
            des: row.des || 0,
            jan: row.jan || 0,
            feb: row.feb || 0,
            mar: row.mar || 0,
            apr: row.apr || 0,
            mei: row.mei || 0,
            jun: row.jun || 0,
            total
        };
    });

    const buffer = await buildPdf({
        title: 'REKAP KETIDAKHADIRAN GURU',
        subtitle: `Tahun Pelajaran ${tahunAjaran}`,
        reportPeriod: `${startDate} s/d ${endDate}`,
        showLetterhead: true,
        letterhead,
        columns: monthlyColumns,
        rows: reportData,
        orientation: 'landscape'
    });

    const filename = generatePdfFilename('Rekap_Ketidakhadiran_Guru', tahunAwal.toString(), tahunAkhir.toString());
    streamPdfResponse(res, buffer, filename);
    logger.info('Rekap ketidakhadiran guru PDF exported', { tahunAjaran, rowCount: reportData.length });
}, 'Rekap Ketidakhadiran Guru PDF');

// ================================================
// PRESENSI SISWA PDF
// GET /api/export/pdf/presensi-siswa
// ================================================

/**
 * Export presensi siswa detail (daily) as PDF
 * @param {import('express').Request} req - Express request (query: kelas_id, bulan, tahun)
 * @param {import('express').Response} res - Express response
 */
export const exportPresensiSiswaPdf = wrapPdfExport(async (req, res) => {
    const { kelas_id, bulan, tahun } = req.query;

    // Get class name
    const [kelasRows] = await db.execute('SELECT nama_kelas FROM kelas WHERE id_kelas = ?', [kelas_id]);
    const namaKelas = kelasRows[0]?.nama_kelas || 'Unknown';

    // Get students
    const [studentsRows] = await db.execute(
        'SELECT s.id_siswa as id, s.nis, s.nama, s.jenis_kelamin FROM siswa s WHERE s.kelas_id = ? AND s.status = "aktif" ORDER BY s.nama ASC',
        [kelas_id]
    );

    // Get daily attendance data
    const presensiRows = await ExportService.getPresensiSiswaDetail(tahun, bulan, kelas_id);

    // Calculate days in month
    const daysInMonth = new Date(Number.parseInt(tahun), Number.parseInt(bulan), 0).getDate();

    const { generatePresensiColumns } = await import('../../backend/export/schemas/presensi-siswa-detail.js');
    const columns = generatePresensiColumns(daysInMonth);

    const exportData = studentsRows.map((student, index) => {
        const studentPresensi = presensiRows.filter(p => p.siswa_id === student.id);
        const attendanceRecord = {};
        const keteranganList = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${tahun}-${String(bulan).padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const presensi = studentPresensi.find(p => p.tanggal === dateStr);
            attendanceRecord[`hari_${day}`] = presensi ? presensi.status : '';
            if (presensi && presensi.keterangan) keteranganList.push(`${day}: ${presensi.keterangan}`);
        }

        return {
            no: index + 1,
            nis: student.nis,
            nama: student.nama,
            jenis_kelamin: student.jenis_kelamin,
            keterangan: keteranganList.join('; '),
            ...attendanceRecord
        };
    });

    const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.PRESENSI_SISWA });

    const buffer = await buildPdf({
        title: 'PRESENSI SISWA',
        subtitle: `Kelas: ${namaKelas}`,
        reportPeriod: `Bulan ${bulan}/${tahun}`,
        showLetterhead: true,
        letterhead,
        columns,
        rows: exportData,
        orientation: 'landscape'
    });

    const filename = generatePdfFilename(`Presensi_Siswa_${namaKelas}`, `${bulan}`, tahun);
    streamPdfResponse(res, buffer, filename);
    logger.info('Presensi siswa PDF exported', { kelas_id, bulan, tahun, rowCount: exportData.length });
}, 'Presensi Siswa PDF');

// ================================================
// LAPORAN KEHADIRAN SISWA (GURU VIEW) PDF
// GET /api/export/pdf/laporan-kehadiran-siswa
// ================================================

/**
 * Map attendance status to single-character code.
 * @param {string|undefined|null} status - Attendance status value
 * @returns {string} Status code for report table
 */
const mapStatusToCode = (status) => {
    const statusMap = {
        Hadir: 'H',
        Izin: 'I',
        Sakit: 'S',
        Alpa: 'A',
        Dispen: 'D',
        'Tidak Hadir': 'A'
    };

    return statusMap[status] || '-';
};

/**
 * Parse and validate date range for laporan kehadiran siswa export.
 * @param {string} startDate - Start date (yyyy-mm-dd)
 * @param {string} endDate - End date (yyyy-mm-dd)
 * @returns {{ start: Date, end: Date, diffDays: number }} Parsed date range details
 */
const parseLaporanDateRange = (startDate, endDate) => {
    const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
    const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay);
    const end = new Date(eYear, eMonth - 1, eDay);
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
    return { start, end, diffDays };
};

/**
 * Get mapel and guru information for subtitle in laporan kehadiran siswa export.
 * @param {boolean} isAdmin - Whether request comes from admin
 * @param {number|undefined} guruId - Guru id from auth context
 * @returns {Promise<Array<Object>>} Mapel and guru rows
 */
const getLaporanMapelInfo = async (isAdmin, guruId) => {
    if (isAdmin || !guruId) {
        return [];
    }

    const [mapelInfo] = await db.execute(`
        SELECT DISTINCT g.mata_pelajaran as nama_mapel, g.nama as nama_guru, g.nip
        FROM guru g WHERE g.id_guru = ? AND g.status = 'aktif' LIMIT 1
    `, [guruId]);

    return mapelInfo;
};

/**
 * Get jadwal day rows for laporan kehadiran siswa export.
 * @param {boolean} isAdmin - Whether request comes from admin
 * @param {number|undefined} guruId - Guru id from auth context
 * @param {string} kelasId - Class id
 * @returns {Promise<Array<Object>>} Jadwal rows containing hari
 */
const getLaporanJadwalData = async (isAdmin, guruId, kelasId) => {
    if (isAdmin) {
        const [jadwalData] = await db.execute(`
            SELECT DISTINCT j.hari FROM jadwal j WHERE j.kelas_id = ? AND j.status = 'aktif'
        `, [kelasId]);
        return jadwalData;
    }

    const [jadwalData] = await db.execute(`
        SELECT j.hari FROM jadwal j WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
    `, [guruId, kelasId]);

    return jadwalData;
};

/**
 * Build scheduled dates between start and end based on jadwal days.
 * @param {Date} start - Start date object
 * @param {Date} end - End date object
 * @param {Array<Object>} jadwalDays - Jadwal rows with hari field
 * @returns {string[]} Array of yyyy-mm-dd date strings
 */
const getScheduledDates = (start, end, jadwalDays) => {
    const dates = [];
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const endTime = end.getTime();
    let currentTime = start.getTime();

    while (currentTime <= endTime) {
        const currentDate = new Date(currentTime);
        const dayName = dayNames[currentDate.getDay()];
        if (jadwalDays.some((jadwal) => jadwal.hari === dayName)) {
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            dates.push(`${year}-${month}-${day}`);
        }
        currentTime += 24 * 60 * 60 * 1000;
    }

    return dates;
};

/**
 * Fetch actual attendance date rows for laporan kehadiran siswa export.
 * @param {boolean} isAdmin - Whether request comes from admin
 * @param {number|undefined} guruId - Guru id from auth context
 * @param {string} kelasId - Class id
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {Promise<Array<Object>>} Rows with tanggal values
 */
const getActualAttendanceDates = async (isAdmin, guruId, kelasId, startDate, endDate) => {
    if (isAdmin) {
        const [actualDates] = await db.execute(`
            SELECT DISTINCT DATE(a.tanggal) as tanggal
            FROM absensi_siswa a
            INNER JOIN jadwal j ON j.id_jadwal = a.jadwal_id
            WHERE j.kelas_id = ? AND j.status = 'aktif'
            AND DATE(a.tanggal) BETWEEN ? AND ?
            ORDER BY DATE(a.tanggal)
        `, [kelasId, startDate, endDate]);
        return actualDates;
    }

    const [actualDates] = await db.execute(`
        SELECT DISTINCT DATE(a.tanggal) as tanggal
        FROM absensi_siswa a
        WHERE a.jadwal_id IN (SELECT j.id_jadwal FROM jadwal j WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif')
        AND DATE(a.tanggal) BETWEEN ? AND ?
        ORDER BY DATE(a.tanggal)
    `, [guruId, kelasId, startDate, endDate]);

    return actualDates;
};

/**
 * Convert MySQL DATE value to yyyy-mm-dd safely.
 * @param {Date|string} value - Date-like value from DB
 * @returns {string} Formatted date string
 */
const toDateString = (value) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * Merge scheduled dates with actual attendance dates.
 * @param {string[]} scheduledDates - Scheduled date strings
 * @param {Array<Object>} actualDates - Actual rows from DB
 * @returns {string[]} Sorted unique date strings
 */
const buildFinalDates = (scheduledDates, actualDates) => {
    const allDates = new Set(scheduledDates);
    actualDates.forEach((row) => {
        if (row.tanggal) {
            allDates.add(toDateString(row.tanggal));
        }
    });
    return Array.from(allDates).sort();
};

/**
 * Fetch siswa summary rows for laporan kehadiran siswa export.
 * @param {boolean} isAdmin - Whether request comes from admin
 * @param {number|undefined} guruId - Guru id from auth context
 * @param {string} kelasId - Class id
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @param {number} totalDates - Count of effective dates
 * @returns {Promise<Array<Object>>} Summary rows per student
 */
const getLaporanSiswaData = async (isAdmin, guruId, kelasId, startDate, endDate, totalDates) => {
    if (isAdmin) {
        const [siswaData] = await db.execute(`
            SELECT s.id_siswa, s.nama, s.nis, s.jenis_kelamin,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS total_hadir,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS total_izin,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS total_sakit,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' OR a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) AS total_alpa,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS total_dispen,
                CASE
                    WHEN ? = 0 THEN '0%'
                    ELSE CONCAT(ROUND((SUM(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) * 100.0 / ?), 1), '%')
                END AS persentase_kehadiran
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id
                AND DATE(a.tanggal) BETWEEN ? AND ?
            LEFT JOIN jadwal j ON j.id_jadwal = a.jadwal_id
            WHERE s.kelas_id = ? AND s.status = 'aktif'
            GROUP BY s.id_siswa, s.nama, s.nis, s.jenis_kelamin
            ORDER BY s.nama
        `, [totalDates, totalDates, startDate, endDate, kelasId]);
        return siswaData;
    }

    const [siswaData] = await db.execute(`
        SELECT s.id_siswa, s.nama, s.nis, s.jenis_kelamin,
            COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS total_hadir,
            COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS total_izin,
            COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS total_sakit,
            COALESCE(SUM(CASE WHEN a.status = 'Alpa' OR a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) AS total_alpa,
            COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS total_dispen,
            CASE
                WHEN ? = 0 THEN '0%'
                ELSE CONCAT(ROUND((SUM(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) * 100.0 / ?), 1), '%')
            END AS persentase_kehadiran
        FROM siswa s
        LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id
            AND DATE(a.tanggal) BETWEEN ? AND ?
            AND a.jadwal_id IN (SELECT j.id_jadwal FROM jadwal j WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif')
        WHERE s.kelas_id = ? AND s.status = 'aktif'
        GROUP BY s.id_siswa, s.nama, s.nis, s.jenis_kelamin
        ORDER BY s.nama
    `, [totalDates, totalDates, startDate, endDate, guruId, kelasId, kelasId]);

    return siswaData;
};

/**
 * Fetch detailed attendance rows per student and date.
 * @param {boolean} isAdmin - Whether request comes from admin
 * @param {number|undefined} guruId - Guru id from auth context
 * @param {string} kelasId - Class id
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {Promise<Array<Object>>} Detail attendance rows
 */
const getLaporanDetailKehadiran = async (isAdmin, guruId, kelasId, startDate, endDate) => {
    if (isAdmin) {
        const [detailKehadiran] = await db.execute(`
            SELECT s.id_siswa, DATE(a.tanggal) as tanggal, a.status
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id
                AND DATE(a.tanggal) BETWEEN ? AND ?
            LEFT JOIN jadwal j ON j.id_jadwal = a.jadwal_id
            WHERE s.kelas_id = ? AND s.status = 'aktif'
        `, [startDate, endDate, kelasId]);
        return detailKehadiran;
    }

    const [detailKehadiran] = await db.execute(`
        SELECT s.id_siswa, DATE(a.tanggal) as tanggal, a.status
        FROM siswa s
        LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id
            AND DATE(a.tanggal) BETWEEN ? AND ?
            AND a.jadwal_id IN (SELECT j.id_jadwal FROM jadwal j WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif')
        WHERE s.kelas_id = ? AND s.status = 'aktif'
    `, [startDate, endDate, guruId, kelasId, kelasId]);

    return detailKehadiran;
};

/**
 * Create student-date attendance map from detailed rows.
 * @param {Array<Object>} detailKehadiran - Detail attendance rows
 * @returns {Object} Nested map keyed by siswa id and date string
 */
const buildAttendanceMap = (detailKehadiran) => {
    const attendanceMap = {};
    detailKehadiran.forEach((row) => {
        if (!attendanceMap[row.id_siswa]) {
            attendanceMap[row.id_siswa] = {};
        }
        if (row.tanggal && row.status) {
            attendanceMap[row.id_siswa][toDateString(row.tanggal)] = row.status;
        }
    });
    return attendanceMap;
};

/**
 * Build subtitle string for laporan kehadiran siswa export.
 * @param {boolean} isAdmin - Whether request comes from admin
 * @param {Array<Object>} kelasInfo - Class rows
 * @param {Array<Object>} mapelInfo - Mapel rows
 * @returns {string} Export subtitle
 */
const buildLaporanSubtitle = (isAdmin, kelasInfo, mapelInfo) => {
    if (isAdmin) {
        return `Kelas: ${kelasInfo[0]?.nama_kelas || 'Unknown'}`;
    }

    const subtitleParts = [];
    if (mapelInfo[0]?.nama_mapel) subtitleParts.push(`Mata Pelajaran: ${mapelInfo[0].nama_mapel}`);
    if (mapelInfo[0]?.nama_guru) subtitleParts.push(`Guru: ${mapelInfo[0].nama_guru}`);
    return subtitleParts.join(' | ');
};

/**
 * Build PDF columns for laporan kehadiran siswa.
 * @param {string[]} finalDates - Final attendance dates
 * @returns {Array<Object>} PDF column definitions
 */
const buildLaporanPdfColumns = (finalDates) => {
    const dateColumns = finalDates.map((dateStr) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const dayNumber = new Date(year, month - 1, day).getDate();
        return {
            key: `d_${dateStr.replaceAll('-', '_')}`,
            label: String(dayNumber),
            width: 4,
            align: 'center'
        };
    });

    return [
        { key: 'no', label: 'No', width: 5, align: 'center', format: 'number' },
        { key: 'nama', label: 'Nama', width: 20, align: 'left' },
        { key: 'nis', label: 'NIS', width: 11, align: 'center' },
        { key: 'lp', label: 'L/P', width: 5, align: 'center' },
        ...dateColumns,
        { key: 'hadir', label: 'H', width: 5, align: 'center', format: 'number' },
        { key: 'izin', label: 'I', width: 5, align: 'center', format: 'number' },
        { key: 'sakit', label: 'S', width: 5, align: 'center', format: 'number' },
        { key: 'alpa', label: 'A', width: 5, align: 'center', format: 'number' },
        { key: 'dispen', label: 'D', width: 5, align: 'center', format: 'number' },
        { key: 'persentase', label: '%', width: 8, align: 'center' }
    ];
};

/**
 * Build row data for laporan kehadiran siswa PDF.
 * @param {Array<Object>} siswaData - Student summary rows
 * @param {string[]} finalDates - Final attendance dates
 * @param {Object} attendanceMap - Student-date attendance map
 * @returns {Array<Object>} PDF rows
 */
const buildLaporanPdfRows = (siswaData, finalDates, attendanceMap) => siswaData.map((siswa, idx) => {
    const row = {
        no: idx + 1,
        nama: siswa.nama,
        nis: siswa.nis || '-',
        lp: siswa.jenis_kelamin || '-'
    };

    finalDates.forEach((dateStr) => {
        const attendanceStatus = attendanceMap[siswa.id_siswa]?.[dateStr];
        row[`d_${dateStr.replaceAll('-', '_')}`] = mapStatusToCode(attendanceStatus);
    });

    row.hadir = siswa.total_hadir;
    row.izin = siswa.total_izin;
    row.sakit = siswa.total_sakit;
    row.alpa = siswa.total_alpa;
    row.dispen = siswa.total_dispen;
    row.persentase = siswa.persentase_kehadiran;

    return row;
});

/**
 * Export teacher's student attendance report as PDF
 * @param {import('express').Request} req - Express request (query: kelas_id, startDate, endDate)
 * @param {import('express').Response} res - Express response
 */
export const exportLaporanKehadiranSiswaPdf = wrapPdfExport(async (req, res) => {
    const { kelas_id, startDate, endDate } = req.query;
    const guruId = req.user.guru_id;
    const isAdmin = req.user.role === 'admin';

    if (!kelas_id || !startDate || !endDate) {
        return sendValidationError(res, 'kelas_id, startDate, dan endDate harus diisi');
    }

    const { start, end, diffDays } = parseLaporanDateRange(startDate, endDate);
    if (diffDays > 62) {
        return sendValidationError(res, 'Rentang tanggal maksimal 62 hari');
    }

    const [kelasInfo] = await db.execute(
        'SELECT nama_kelas FROM kelas WHERE id_kelas = ? LIMIT 1',
        [kelas_id]
    );

    const mapelInfo = await getLaporanMapelInfo(isAdmin, guruId);
    const jadwalData = await getLaporanJadwalData(isAdmin, guruId, kelas_id);
    const pertemuanDates = getScheduledDates(start, end, jadwalData);
    const actualDates = await getActualAttendanceDates(isAdmin, guruId, kelas_id, startDate, endDate);
    const finalDates = buildFinalDates(pertemuanDates, actualDates);
    const siswaData = await getLaporanSiswaData(isAdmin, guruId, kelas_id, startDate, endDate, finalDates.length);
    const detailKehadiran = await getLaporanDetailKehadiran(isAdmin, guruId, kelas_id, startDate, endDate);
    const attendanceMap = buildAttendanceMap(detailKehadiran);

    const columns = buildLaporanPdfColumns(finalDates);
    const reportData = buildLaporanPdfRows(siswaData, finalDates, attendanceMap);
    const subtitle = buildLaporanSubtitle(isAdmin, kelasInfo, mapelInfo);
    const namaKelas = kelasInfo[0]?.nama_kelas || 'Unknown';

    const letterhead = await getLetterhead();

    const buffer = await buildPdf({
        title: 'LAPORAN KEHADIRAN SISWA',
        subtitle,
        reportPeriod: `${startDate} - ${endDate}`,
        showLetterhead: true,
        letterhead,
        columns,
        rows: reportData,
        orientation: 'landscape'
    });

    const filename = generatePdfFilename(`Laporan_Kehadiran_Siswa_${namaKelas}`, startDate, endDate);
    streamPdfResponse(res, buffer, filename);
    logger.info('Laporan kehadiran siswa PDF exported', { kelas_id, startDate, endDate, rowCount: reportData.length });
}, 'Laporan Kehadiran Siswa PDF');
