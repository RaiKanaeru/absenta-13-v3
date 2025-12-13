/**
 * Template Export Controller
 * Handles Excel export using school templates
 */

import {
    exportRekapKelasGasal,
    exportRekapGuruTahunan,
    exportRekapGuruMingguan,
    exportJadwalPelajaran,
    fetchRekapSiswaByKelas,
    fetchRekapGuru,
    fetchGuruJadwalMingguan,
    getWaliKelas,
    getKelasInfo
} from '../services/export/templateExcelService.js';
import { TAHUN_PELAJARAN } from '../config/exportConfig.js';
import { sendErrorResponse, sendValidationError } from '../utils/errorHandler.js';

// ================================================
// REKAP KELAS GASAL EXPORT
// ================================================

/**
 * Export rekap ketidakhadiran kelas semester gasal
 * GET /api/admin/export/rekap-kelas-gasal?kelas_id=123
 */
export const downloadRekapKelasGasal = async (req, res) => {
    try {
        const { kelas_id, tahun_ajaran } = req.query;
        
        if (!kelas_id) {
            return sendValidationError(res, 'Parameter kelas_id wajib diisi');
        }
        
        const tahunAjaran = tahun_ajaran || TAHUN_PELAJARAN;
        
        console.log(`📊 Generating rekap kelas gasal for kelas_id: ${kelas_id}`);
        
        // Get class info
        const kelasInfo = await getKelasInfo(global.dbPool, kelas_id);
        if (!kelasInfo) {
            return sendValidationError(res, `Kelas dengan ID ${kelas_id} tidak ditemukan`);
        }
        
        // Get wali kelas
        const waliKelas = await getWaliKelas(global.dbPool, kelas_id);
        
        // Fetch rekap data
        const siswaData = await fetchRekapSiswaByKelas(global.dbPool, kelas_id, 'gasal', tahunAjaran);
        
        console.log(`📄 Found ${siswaData.length} students for export`);
        
        // Generate Excel
        const buffer = await exportRekapKelasGasal({
            namaKelas: kelasInfo.nama_kelas,
            waliKelas: waliKelas,
            siswaData: siswaData
        });
        
        // Set response headers
        const filename = `REKAP_KETIDAKHADIRAN_${kelasInfo.nama_kelas.replace(/ /g, '_')}_${tahunAjaran}_GASAL.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        res.send(buffer);
        
        console.log(`✅ Rekap kelas gasal exported: ${filename}`);
        
    } catch (error) {
        console.error('❌ Error exporting rekap kelas gasal:', error);
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
    try {
        const { tahun_ajaran } = req.query;
        const tahunAjaran = tahun_ajaran || TAHUN_PELAJARAN;
        
        console.log(`📊 Generating rekap guru tahunan for ${tahunAjaran}`);
        
        // Fetch rekap data
        const guruData = await fetchRekapGuru(global.dbPool, tahunAjaran);
        
        console.log(`📄 Found ${guruData.length} teachers for export`);
        
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
        
        console.log(`✅ Rekap guru tahunan exported: ${filename}`);
        
    } catch (error) {
        console.error('❌ Error exporting rekap guru tahunan:', error);
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
    try {
        console.log(`📊 Generating rekap guru mingguan`);
        
        // Fetch guru jadwal data
        const guruData = await fetchGuruJadwalMingguan(global.dbPool);
        
        console.log(`📄 Found ${guruData.length} teachers for export`);
        
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
        
        console.log(`✅ Rekap guru mingguan exported: ${filename}`);
        
    } catch (error) {
        console.error('❌ Error exporting rekap guru mingguan:', error);
        return sendErrorResponse(res, error, 'Gagal mengexport rekap guru mingguan');
    }
};

// ================================================
// JADWAL PELAJARAN EXPORT
// ================================================

/**
 * Export jadwal pelajaran
 * GET /api/admin/export/jadwal-pelajaran
 */
export const downloadJadwalPelajaran = async (req, res) => {
    try {
        console.log(`📊 Generating jadwal pelajaran export`);
        
        // Generate Excel (uses template with formatting preserved)
        const buffer = await exportJadwalPelajaran({
            jadwalData: [] // Template is pre-filled, just export as-is
        });
        
        // Set response headers
        const filename = `JADWAL_PELAJARAN_${TAHUN_PELAJARAN}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        res.send(buffer);
        
        console.log(`✅ Jadwal pelajaran exported: ${filename}`);
        
    } catch (error) {
        console.error('❌ Error exporting jadwal pelajaran:', error);
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
    try {
        res.json({
            success: true,
            data: [
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
            ],
            tahunAjaranDefault: TAHUN_PELAJARAN
        });
    } catch (error) {
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

