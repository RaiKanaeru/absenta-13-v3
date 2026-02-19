/**
 * Guru Reports Controller
 * Handles teacher-specific attendance reports
 */

import { sendDatabaseError, sendValidationError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import { getDaysDifferenceWIB, parseDateStringWIB, HARI_INDONESIA } from '../utils/timeUtils.js';
import ExportService from '../services/ExportService.js';

const logger = createLogger('GuruReports');

// Get presensi siswa SMK 13 untuk laporan guru
export const getPresensiSiswaSmkn13 = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;
    const guruId = req.user.guru_id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin';

    log.requestStart('GetPresensiSiswaSmkn13', { startDate, endDate, kelas_id, guruId, isAdmin });

    try {
        if (!isAdmin && !guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        if (!startDate || !endDate) {
            log.validationFail('dates', { startDate, endDate }, 'Required fields missing');
            return sendValidationError(res, 'Tanggal mulai dan akhir harus diisi', { fields: ['startDate', 'endDate'] });
        }

        // Use Service Layer
        const rows = await ExportService.getPresensiSiswaSmkn13(
            startDate, 
            endDate, 
            isAdmin ? null : guruId, 
            kelas_id
        );

        log.success('GetPresensiSiswaSmkn13', { count: rows.length, guruId, isAdmin });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { startDate, endDate, kelas_id, guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil data presensi siswa');
    }
};

// Get rekap ketidakhadiran untuk laporan guru
export const getRekapKetidakhadiran = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id, reportType } = req.query;
    const guruId = req.user.guru_id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin';

    log.requestStart('GetRekapKetidakhadiran', { startDate, endDate, kelas_id, reportType, guruId, isAdmin });

    try {
        if (!isAdmin && !guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        if (!startDate || !endDate) {
            log.validationFail('dates', { startDate, endDate }, 'Required fields missing');
            return sendValidationError(res, 'Tanggal mulai dan akhir harus diisi', { fields: ['startDate', 'endDate'] });
        }

        // Use Service Layer
        const rows = await ExportService.getRekapKetidakhadiran(
            startDate,
            endDate,
            isAdmin ? null : guruId,
            kelas_id,
            reportType
        );

        log.success('GetRekapKetidakhadiran', { count: rows.length, reportType, isAdmin });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { startDate, endDate, kelas_id, reportType, guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil rekap ketidakhadiran');
    }
};

/**
 * Get teacher's classes
 * GET /api/guru/classes
 */
export const getGuruClasses = async (req, res) => {
    const log = logger.withRequest(req, res);
    const guruId = req.user.guru_id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin';
    
    log.requestStart('GetGuruClasses', { guruId, userRole, isAdmin });

    try {
        if (!isAdmin && !guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        // Use Service Layer
        const rows = await ExportService.getTeacherClasses(isAdmin ? null : guruId);
        
        log.success('GetGuruClasses', { count: rows.length, isAdmin });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { guruId, userRole });
        return sendDatabaseError(res, error, 'Gagal mengambil data kelas guru');
    }
};

/**
 * Get attendance summary for teacher's classes
 * GET /api/guru/attendance-summary
 */
export const getAttendanceSummary = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;
    const guruId = req.user.guru_id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin';
    
    log.requestStart('GetAttendanceSummary', { startDate, endDate, kelas_id, guruId, isAdmin });

    try {
        if (!isAdmin && !guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        if (!startDate || !endDate) {
            log.validationFail('dates', { startDate, endDate }, 'Required fields missing');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi', { fields: ['startDate', 'endDate'] });
        }

        // Use Service Layer
        const rows = await ExportService.getTeacherClassAttendanceSummary(
            startDate, 
            endDate, 
            isAdmin ? null : guruId, 
            kelas_id
        );
        
        log.success('GetAttendanceSummary', { count: rows.length, guruId, isAdmin });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { startDate, endDate, kelas_id, guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil summary kehadiran');
    }
};

/**
 * Get jadwal pertemuan dinamis untuk guru berdasarkan kelas dan periode
 * GET /api/guru/jadwal-pertemuan
 */
export const getJadwalPertemuan = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kelas_id, startDate, endDate } = req.query;
    const guruId = req.user.guru_id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin';

    log.requestStart('GetJadwalPertemuan', { kelas_id, startDate, endDate, guruId, isAdmin });

    try {
        if (!isAdmin && !guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        if (!kelas_id) {
            log.validationFail('kelas_id', null, 'Required field missing');
            return sendValidationError(res, 'Kelas ID wajib diisi', { field: 'kelas_id' });
        }
        if (!startDate || !endDate) {
            log.validationFail('dates', { startDate, endDate }, 'Required fields missing');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi', { fields: ['startDate', 'endDate'] });
        }

        // Parse dates using consistent utils
        const diffDays = getDaysDifferenceWIB(startDate, endDate);
        
        if (diffDays > 62) {
            log.validationFail('dateRange', { diffDays }, 'Exceeds max 62 days');
            return sendValidationError(res, 'Rentang tanggal maksimal 62 hari', { maxDays: 62, requestedDays: diffDays });
        }

        // Use Service Layer for Schedule Data
        const jadwalData = await ExportService.getJadwalPertemuanData(kelas_id, isAdmin ? null : guruId);

        const pertemuanDates = [];
        const start = parseDateStringWIB(startDate);
        const end = parseDateStringWIB(endDate);
        const endTime = end.getTime();
        const currentDate = new Date(start);

        while (currentDate.getTime() <= endTime) {
            // Get day name
            const dayName = HARI_INDONESIA[currentDate.getDay()]; // Using timeUtils HARI_INDONESIA
            const daySchedules = jadwalData.filter(j => j.hari === dayName);
            
            if (daySchedules.length > 0) {
                // Format date manually to avoid timezone shifts
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                const day = String(currentDate.getDate()).padStart(2, '0');
                
                pertemuanDates.push({
                    tanggal: `${year}-${month}-${day}`,
                    hari: dayName,
                    jadwal: daySchedules.map(s => ({
                        jam_ke: s.jam_ke, jam_mulai: s.jam_mulai, jam_selesai: s.jam_selesai,
                        nama_mapel: s.nama_mapel, kode_mapel: s.kode_mapel,
                        ruang: s.kode_ruang ? `${s.kode_ruang} - ${s.nama_ruang}` : '-',
                        ...(isAdmin && s.nama_guru ? { nama_guru: s.nama_guru } : {})
                    }))
                });
            }

            currentDate.setDate(currentDate.getDate() + 1);
            
            // Safety break for infinite loop
            if (currentDate.getTime() > endTime + (1000 * 60 * 60 * 24 * 7)) break; // Buffer 1 week
        }

        log.success('GetJadwalPertemuan', { totalPertemuan: pertemuanDates.length, guruId, isAdmin });
        
        res.json({
            success: true,
            data: {
                pertemuan_dates: pertemuanDates,
                total_pertemuan: pertemuanDates.length,
                periode: { startDate, endDate, total_days: diffDays },
                jadwal_info: jadwalData.length > 0 ? {
                    nama_kelas: jadwalData[0].nama_kelas,
                    mata_pelajaran: [...new Set(jadwalData.map(j => j.nama_mapel))]
                } : null
            }
        });
    } catch (error) {
        log.dbError('query', error, { kelas_id, startDate, endDate, guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil jadwal pertemuan');
    }
};

/**
 * Get laporan kehadiran siswa berdasarkan jadwal pertemuan guru
 * GET /api/guru/laporan-kehadiran-siswa
 */
export const getLaporanKehadiranSiswa = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kelas_id, startDate, endDate } = req.query;
    const guruId = req.user.guru_id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin';

    log.requestStart('GetLaporanKehadiranSiswa', { kelas_id, startDate, endDate, guruId, isAdmin });

    try {
        if (!isAdmin && !guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        if (!kelas_id) {
            log.validationFail('kelas_id', null, 'Required field missing');
            return sendValidationError(res, 'Kelas ID wajib diisi', { field: 'kelas_id' });
        }
        if (!startDate || !endDate) {
            log.validationFail('dates', { startDate, endDate }, 'Required fields missing');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi', { fields: ['startDate', 'endDate'] });
        }

        // Use Service Layer
        const { siswa: siswaData, absensi: absensiData } = await ExportService.getLaporanKehadiranSiswaData(
            kelas_id, 
            startDate, 
            endDate, 
            isAdmin ? null : guruId
        );

        const absensiMap = new Map();
        absensiData.forEach(a => {
            if (!absensiMap.has(a.siswa_id)) absensiMap.set(a.siswa_id, []);
            absensiMap.get(a.siswa_id).push(a);
        });

        const result = siswaData.map(s => {
            const riwayat = absensiMap.get(s.id_siswa) || [];
            return {
                ...s,
                rekap: {
                    H: riwayat.filter(r => ['Hadir', 'Dispen'].includes(r.status)).length,
                    I: riwayat.filter(r => r.status === 'Izin').length,
                    S: riwayat.filter(r => r.status === 'Sakit').length,
                    A: riwayat.filter(r => r.status === 'Alpa').length,
                    D: riwayat.filter(r => r.status === 'Dispen').length,
                    total: riwayat.length,
                    terlambat: riwayat.filter(r => r.terlambat === 1).length
                },
                riwayat_absensi: riwayat.map(r => ({
                    ...r,
                    is_late: r.terlambat === 1
                }))
            };
        });

        log.success('GetLaporanKehadiranSiswa', { siswaCount: result.length, guruId, isAdmin });
        res.json({ success: true, data: result, periode: { startDate, endDate } });
    } catch (error) {
        log.dbError('query', error, { kelas_id, startDate, endDate, guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil laporan kehadiran siswa');
    }
};
