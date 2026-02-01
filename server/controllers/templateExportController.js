/**
 * Template Export Controller
 * Handles Excel export using school templates
 */

import db from '../config/db.js';
import {
    exportRekapKelasGasal,
    exportRekapGuruTahunan,
    exportRekapGuruMingguan,
    exportJadwalPelajaranComplex,
    fetchRekapSiswaByKelas,
    fetchRekapGuru,
    fetchGuruJadwalMingguan,
    getWaliKelas,
    getKelasInfo
} from '../services/export/templateExcelService.js';
import { TAHUN_PELAJARAN } from '../config/exportConfig.js';
import { sendErrorResponse, sendValidationError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TemplateExport');

// ================================================
// REKAP KELAS GASAL EXPORT
// ================================================

/**
 * Export rekap ketidakhadiran kelas semester gasal
 * GET /api/admin/export/rekap-kelas-gasal?kelas_id=123
 */
export const downloadRekapKelasGasal = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kelas_id, tahun_ajaran } = req.query;
    
    log.requestStart('RekapKelasGasal', { kelas_id, tahun_ajaran });

    try {
        if (!kelas_id) {
            log.validationFail('kelas_id', null, 'Required');
            return sendValidationError(res, 'Parameter kelas_id wajib diisi', { field: 'kelas_id' });
        }
        
        const tahunAjaran = tahun_ajaran || TAHUN_PELAJARAN;
        
        // Get class info
        const kelasInfo = await getKelasInfo(db, kelas_id);
        if (!kelasInfo) {
            log.warn('RekapKelasGasal - kelas not found', { kelas_id });
            return sendValidationError(res, `Kelas dengan ID ${kelas_id} tidak ditemukan`);
        }
        
        // Get wali kelas
        const waliKelas = await getWaliKelas(db, kelas_id);
        
        // Fetch rekap data
        const siswaData = await fetchRekapSiswaByKelas(db, kelas_id, 'gasal', tahunAjaran);
        
        log.debug('Fetched data for export', { studentCount: siswaData.length, kelas: kelasInfo.nama_kelas });
        
        // Generate Excel
        const buffer = await exportRekapKelasGasal({
            namaKelas: kelasInfo.nama_kelas,
            waliKelas: waliKelas,
            siswaData: siswaData
        });
        
        // Set response headers
        const filename = `REKAP_KETIDAKHADIRAN_${kelasInfo.nama_kelas.replaceAll(' ', '_')}_${tahunAjaran}_GASAL.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        res.send(buffer);
        
        log.success('RekapKelasGasal', { filename, studentCount: siswaData.length });
        
    } catch (error) {
        log.error('RekapKelasGasal failed', { error: error.message, kelas_id });
        return sendErrorResponse(res, error, 'Gagal mengexport rekap kelas');
    }
};

// ================================================
// REKAP GURU TAHUNAN EXPORT
// ================================================

/**
 * Export rekap ketidakhadiran guru tahunan
 * GET /api/admin/export/rekap-guru-tahunan
 */
export const downloadRekapGuruTahunan = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { tahun_ajaran } = req.query;
    const tahunAjaran = tahun_ajaran || TAHUN_PELAJARAN;
    
    log.requestStart('RekapGuruTahunan', { tahunAjaran });

    try {
        // Fetch rekap data
        const guruData = await fetchRekapGuru(db, tahunAjaran);
        
        log.debug('Fetched guru data', { guruCount: guruData.length });
        
        // Generate Excel
        const buffer = await exportRekapGuruTahunan({
            guruData: guruData
        });
        
        // Set response headers
        const filename = `REKAP_KETIDAKHADIRAN_GURU_${tahunAjaran}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        res.send(buffer);
        
        log.success('RekapGuruTahunan', { filename, guruCount: guruData.length });
        
    } catch (error) {
        log.error('RekapGuruTahunan failed', { error: error.message });
        return sendErrorResponse(res, error, 'Gagal mengexport rekap guru');
    }
};

// ================================================
// REKAP GURU MINGGUAN EXPORT
// ================================================

/**
 * Export rekap jadwal guru mingguan
 * GET /api/admin/export/rekap-guru-mingguan
 */
export const downloadRekapGuruMingguan = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('RekapGuruMingguan', {});

    try {
        // Fetch guru jadwal data
        const guruData = await fetchGuruJadwalMingguan(db);
        
        log.debug('Fetched guru jadwal data', { guruCount: guruData.length });
        
        // Generate Excel
        const buffer = await exportRekapGuruMingguan({
            guruData: guruData
        });
        
        // Set response headers
        const filename = `REKAP_JADWAL_GURU_MINGGUAN_${TAHUN_PELAJARAN}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        res.send(buffer);
        
        log.success('RekapGuruMingguan', { filename, guruCount: guruData.length });
        
    } catch (error) {
        log.error('RekapGuruMingguan failed', { error: error.message });
        return sendErrorResponse(res, error, 'Gagal mengexport rekap guru mingguan');
    }
};

// ================================================
// JADWAL PELAJARAN EXPORT
// ================================================

/**
 * Export jadwal pelajaran matrix dengan warna per mapel
 * GET /api/admin/export/jadwal-pelajaran
 */
export const downloadJadwalPelajaran = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('JadwalPelajaran', {});

    try {
        // Fetch jadwal data from DB
        const { fetchJadwalForExport } = await import('../services/export/templateExcelService.js');
        const jadwalData = await fetchJadwalForExport(db);
        
        log.debug('Fetched jadwal data', { jadwalCount: jadwalData.length });
        
        // Generate Excel matrix with colors
        const buffer = await exportJadwalPelajaranComplex({
            jadwalData: jadwalData
        });
        
        // Set response headers
        const filename = `JADWAL_PELAJARAN_MATRIX_${TAHUN_PELAJARAN}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        res.send(buffer);
        
        log.success('JadwalPelajaran', { filename, jadwalCount: jadwalData.length });
        
    } catch (error) {
        log.error('JadwalPelajaran export failed', { error: error.message });
        return sendErrorResponse(res, error, 'Gagal mengexport jadwal pelajaran');
    }
};

// ================================================
// LIST AVAILABLE TEMPLATES
// ================================================

/**
 * Get list of available export templates
 * GET /api/admin/export/templates
 */
export const getExportTemplates = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetTemplates', {});

    try {
        const templates = [
            {
                id: 'rekap-kelas-gasal',
                name: 'Rekap Ketidakhadiran Kelas (Semester Gasal)',
                description: 'Rekap ketidakhadiran siswa per kelas untuk semester Juli-Desember',
                endpoint: '/api/admin/export/rekap-kelas-gasal',
                params: ['kelas_id', 'tahun_ajaran (optional)']
            },
            {
                id: 'rekap-guru-tahunan',
                name: 'Rekap Ketidakhadiran Guru (Tahunan)',
                description: 'Rekap ketidakhadiran guru untuk satu tahun ajaran',
                endpoint: '/api/admin/export/rekap-guru-tahunan',
                params: ['tahun_ajaran (optional)']
            },
            {
                id: 'rekap-guru-mingguan',
                name: 'Rekap Jadwal Guru (Mingguan)',
                description: 'Rekap guru yang mengajar per hari (Senin-Jumat)',
                endpoint: '/api/admin/export/rekap-guru-mingguan',
                params: []
            },
            {
                id: 'jadwal-pelajaran',
                name: 'Jadwal Pelajaran',
                description: 'Export jadwal pelajaran dengan warna per mapel',
                endpoint: '/api/admin/export/jadwal-pelajaran',
                params: []
            }
        ];
        
        log.success('GetTemplates', { count: templates.length });
        return sendSuccessResponse(res, {
            templates,
            tahunAjaranDefault: TAHUN_PELAJARAN
        });
    } catch (error) {
        log.error('GetTemplates failed', { error: error.message });
        return sendErrorResponse(res, error);
    }
};

export default {
    downloadRekapKelasGasal,
    downloadRekapGuruTahunan,
    downloadRekapGuruMingguan,
    downloadJadwalPelajaran,
    getExportTemplates
};
