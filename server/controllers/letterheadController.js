/**
 * Letterhead Controller
 * Handles all letterhead/KOP related operations
 * Migrated from server_modern.js
 */

import path from 'path';
import { promises as fs } from 'fs';
import { getLetterhead, getAllLetterheads, setLetterheadGlobal, setLetterheadForReport, deleteLetterhead, validateLetterhead, saveReportLetterhead, REPORT_KEYS } from '../../backend/utils/letterheadService.js';

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
        console.error('❌ Error loading report letterhead:', error);
        res.status(500).json({
            error: 'Gagal memuat konfigurasi kop laporan',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
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

        const success = await saveReportLetterhead(letterhead);
        if (!success) {
            return res.status(500).json({ error: 'Gagal menyimpan konfigurasi kop laporan' });
        }

        res.json({ success: true, message: 'Konfigurasi kop laporan berhasil disimpan', data: letterhead });
    } catch (error) {
        console.error('❌ Error updating report letterhead:', error);
        res.status(500).json({
            error: 'Gagal memperbarui konfigurasi kop laporan',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
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
        console.error('❌ Error loading letterhead:', error);
        res.status(500).json({
            error: 'Gagal memuat konfigurasi KOP',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
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
        console.error('❌ Error loading all letterheads:', error);
        res.status(500).json({
            error: 'Gagal memuat daftar KOP',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
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
        console.error('❌ Error updating global letterhead:', error);
        res.status(500).json({
            error: 'Gagal memperbarui konfigurasi KOP global',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
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
        console.error('❌ Error updating report letterhead:', error);
        res.status(500).json({
            error: 'Gagal memperbarui konfigurasi KOP laporan',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
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
        console.error('❌ Error uploading logo:', error);
        res.status(500).json({
            error: 'Gagal mengupload logo',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
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
        console.error('❌ Error deleting file:', error);
        res.status(500).json({
            error: 'Gagal menghapus file',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
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
        console.error('❌ Error deleting logo:', error);
        res.status(500).json({
            error: 'Gagal menghapus logo',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
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
        console.error('❌ Error deleting letterhead:', error);
        res.status(500).json({
            error: 'Gagal menghapus konfigurasi KOP',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
