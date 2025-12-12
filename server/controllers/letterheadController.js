/**
 * Letterhead Controller
 * Handles all letterhead/KOP related operations
 * Migrated from server_modern.js
 */

import path from 'path';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';

import { promises as fs } from 'fs';
import { getLetterhead, getAllLetterheads, setLetterheadGlobal, setLetterheadForReport, deleteLetterhead, validateLetterhead, REPORT_KEYS } from '../../backend/utils/letterheadService.js';

// ================================================
// HELPER FUNCTIONS
// ================================================

async function getLetterheadGlobal() {
    try {
        return await getLetterhead({ reportKey: null });
    } catch (error) {
        console.error('❌ Error getting global letterhead:', error);
        return null;
    }
}

async function getLetterheadForReport(reportKey) {
    try {
        return await getLetterhead({ reportKey });
    } catch (error) {
        console.error('❌ Error getting report letterhead:', error);
        return null;
    }
}

// ================================================
// REPORT LETTERHEAD ENDPOINTS
// ================================================

/**
 * Get report letterhead configuration
 * GET /api/admin/report-letterhead
 */
export const getReportLetterhead = async (req, res) => {
    try {
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.LAPORAN_GURU });
        res.json({ success: true, data: letterhead });
    } catch (error) {
        return sendDatabaseError(res, error, 'Gagal memuat konfigurasi kop laporan');
    }
};

/**
 * Update report letterhead configuration
 * PUT /api/admin/report-letterhead
 */
export const updateReportLetterhead = async (req, res) => {
    try {
        const letterhead = req.body;

        const validation = validateLetterhead(letterhead);
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Konfigurasi kop laporan tidak valid',
                details: validation.errors
            });
        }

        const success = await setLetterheadForReport(REPORT_KEYS.LAPORAN_GURU, letterhead);
        if (!success) {
            return res.status(500).json({ error: 'Gagal menyimpan konfigurasi kop laporan' });
        }

        res.json({ success: true, message: 'Konfigurasi kop laporan berhasil disimpan', data: letterhead });
    } catch (error) {
        return sendDatabaseError(res, error, 'Gagal memperbarui konfigurasi kop laporan');
    }
};

// ================================================
// LETTERHEAD SERVICE ENDPOINTS
// ================================================

/**
 * Get letterhead configuration (with optional reportKey)
 * GET /api/admin/letterhead
 */
export const getLetterheadConfig = async (req, res) => {
    try {
        const { reportKey } = req.query;
        const letterhead = await getLetterhead({ reportKey });
        res.json({ success: true, data: letterhead });
    } catch (error) {
        return sendDatabaseError(res, error, 'Gagal memuat konfigurasi KOP');
    }
};

/**
 * Get all letterhead configurations (admin only)
 * GET /api/admin/letterhead/all
 */
export const getAllLetterheadConfigs = async (req, res) => {
    try {
        const letterheads = await getAllLetterheads();
        res.json({ success: true, data: letterheads });
    } catch (error) {
        return sendDatabaseError(res, error, 'Gagal memuat daftar KOP');
    }
};

/**
 * Set global letterhead configuration
 * PUT /api/admin/letterhead/global
 */
export const setGlobalLetterhead = async (req, res) => {
    try {
        const letterhead = req.body;
        const success = await setLetterheadGlobal(letterhead);

        if (!success) {
            return res.status(500).json({ error: 'Gagal menyimpan konfigurasi KOP global' });
        }

        res.json({ success: true, message: 'Konfigurasi KOP global berhasil disimpan', data: letterhead });
    } catch (error) {
        return sendDatabaseError(res, error, 'Gagal memperbarui konfigurasi KOP global');
    }
};

/**
 * Set letterhead configuration for specific report
 * PUT /api/admin/letterhead/report/:reportKey
 */
export const setReportLetterhead = async (req, res) => {
    try {
        const { reportKey } = req.params;
        const letterhead = req.body;

        if (!reportKey) {
            return res.status(400).json({ error: 'Kode laporan wajib diisi' });
        }

        const success = await setLetterheadForReport(reportKey, letterhead);
        if (!success) {
            return res.status(500).json({ error: 'Gagal menyimpan konfigurasi KOP untuk laporan' });
        }

        res.json({ success: true, message: `Konfigurasi KOP untuk ${reportKey} berhasil disimpan`, data: letterhead });
    } catch (error) {
        return sendDatabaseError(res, error, 'Gagal memperbarui konfigurasi KOP laporan');
    }
};

/**
 * Upload logo for letterhead
 * POST /api/admin/letterhead/upload
 */
export const uploadLogo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File logo wajib diupload' });
        }

        const logoUrl = `/uploads/letterheads/${req.file.filename}`;

        console.log('✅ Logo uploaded successfully:', {
            filename: req.file.filename,
            url: logoUrl,
            size: req.file.size,
            mimetype: req.file.mimetype,
            logoType: req.body.logoType
        });

        res.json({
            success: true,
            message: 'Logo berhasil diupload',
            data: {
                url: logoUrl,
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype,
                logoType: req.body.logoType
            }
        });
    } catch (error) {
        return sendDatabaseError(res, error, 'Gagal mengupload logo');
    }
};

/**
 * Delete physical file
 * DELETE /api/admin/letterhead/delete-file
 */
export const deleteFile = async (req, res) => {
    try {
        const { fileUrl } = req.body;

        if (!fileUrl || !fileUrl.startsWith('/uploads/letterheads/')) {
            return res.status(400).json({ error: 'URL file tidak valid' });
        }

        const filePath = path.join('public', fileUrl);

        try {
            await fs.unlink(filePath);
            console.log('✅ Physical file deleted:', filePath);
            res.json({ success: true, message: 'File berhasil dihapus' });
        } catch (fileError) {
            console.warn('⚠️ Could not delete physical file:', fileError.message);
            res.status(404).json({ error: 'File tidak ditemukan' });
        }
    } catch (error) {
        return sendDatabaseError(res, error, 'Gagal menghapus file');
    }
};

/**
 * Delete logo for letterhead
 * DELETE /api/admin/letterhead/logo/:logoType
 */
export const deleteLogo = async (req, res) => {
    try {
        const { logoType } = req.params;
        const { scope, reportKey } = req.query;

        if (!logoType || !['logo', 'logoLeft', 'logoRight'].includes(logoType)) {
            return res.status(400).json({
                error: 'Tipe logo tidak valid. Gunakan: logo, logoLeft, atau logoRight'
            });
        }

        // Get current letterhead config
        let currentConfig;
        if (scope === 'report' && reportKey) {
            currentConfig = await getLetterheadForReport(reportKey);
        } else {
            currentConfig = await getLetterheadGlobal();
        }

        if (!currentConfig) {
            return res.status(404).json({ error: 'Konfigurasi letterhead tidak ditemukan' });
        }

        // Clear the specified logo and delete physical file
        const updateData = { ...currentConfig };
        let fileToDelete = null;

        if (logoType === 'logo') {
            fileToDelete = currentConfig.logo;
            updateData.logo = '';
        } else if (logoType === 'logoLeft') {
            fileToDelete = currentConfig.logoLeftUrl;
            updateData.logoLeftUrl = '';
        } else if (logoType === 'logoRight') {
            fileToDelete = currentConfig.logoRightUrl;
            updateData.logoRightUrl = '';
        }

        // Delete physical file if it exists
        if (fileToDelete && fileToDelete.startsWith('/uploads/letterheads/')) {
            try {
                const filePath = path.join('public', fileToDelete);
                await fs.unlink(filePath);
                console.log('✅ Physical file deleted:', filePath);
            } catch (fileError) {
                console.warn('⚠️ Could not delete physical file:', fileError.message);
            }
        }

        // Save updated config
        let success;
        if (scope === 'report' && reportKey) {
            success = await setLetterheadForReport(reportKey, updateData);
        } else {
            success = await setLetterheadGlobal(updateData);
        }

        if (!success) {
            return res.status(500).json({ error: 'Gagal menghapus logo' });
        }

        res.json({ success: true, message: `Logo ${logoType} berhasil dihapus`, data: updateData });
    } catch (error) {
        return sendDatabaseError(res, error, 'Gagal menghapus logo');
    }
};

/**
 * Delete letterhead configuration
 * DELETE /api/admin/letterhead/:id
 */
export const deleteLetterheadConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const success = await deleteLetterhead(parseInt(id));

        if (!success) {
            return res.status(404).json({ error: 'Konfigurasi KOP tidak ditemukan' });
        }

        res.json({ success: true, message: 'Konfigurasi KOP berhasil dihapus' });
    } catch (error) {
        return sendDatabaseError(res, error, 'Gagal menghapus konfigurasi KOP');
    }
};

/**
 * Initialize default letterhead
 * POST /api/admin/letterhead/init-defaults
 */
export const initializeDefaults = async (req, res) => {
    try {
        console.log('📝 Initializing default letterhead...');

        // Check if letterhead already exists
        const [existingRows] = await global.dbPool.execute(
            'SELECT id FROM kop_laporan WHERE cakupan = "global" AND kode_laporan IS NULL AND aktif = 1 LIMIT 1'
        );

        if (existingRows.length > 0) {
            console.log('ℹ️ Letterhead sudah ada, tidak perlu inisialisasi');
            return res.json({
                success: true,
                message: 'Letterhead sudah ada di database'
            });
        }

        // Insert default letterhead matched with SMKN 13 Bandung
        const defaultLines = JSON.stringify([
            { text: "PEMERINTAH DAERAH PROVINSI JAWA BARAT", fontWeight: "bold" },
            { text: "DINAS PENDIDIKAN", fontWeight: "bold" },
            { text: "SEKOLAH MENENGAH KEJURUAN NEGERI 13 BANDUNG", fontWeight: "bold" },
            { text: "Jl. Soekarno Hatta No. 10, Kota Bandung 40235", fontWeight: "normal" },
            { text: "Telepon: (022) 5204095 | Email: smkn13bandung@sch.id", fontWeight: "normal" }
        ]);

        const query = `
      INSERT INTO kop_laporan (
        cakupan, kode_laporan, aktif, perataan, baris_teks, 
        logo_tengah_url, logo_kiri_url, logo_kanan_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const params = [
            'global',
            null,
            1,
            'tengah',
            defaultLines,
            null,
            '/logo-kiri.png',
            '/logo-kanan.png'
        ];

        await global.dbPool.execute(query, params);

        console.log('✅ Letterhead default berhasil diinisialisasi');
        res.json({
            success: true,
            message: 'Letterhead default berhasil diinisialisasi'
        });

    } catch (error) {
        console.error('❌ Error initializing letterhead:', error);
        res.status(500).json({
            success: false,
            message: 'Error menginisialisasi letterhead default',
            error: error.message
        });
    }
};
