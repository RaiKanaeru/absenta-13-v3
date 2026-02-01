/**
 * Letterhead Controller
 * Menangani operasi kop surat/KOP
 */

import path from 'node:path';
import db from '../config/db.js';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendSuccessResponse } from '../utils/errorHandler.js';
import { promises as fs } from 'node:fs';
import { getLetterhead, getAllLetterheads, setLetterheadGlobal, setLetterheadForReport, deleteLetterhead, validateLetterhead, REPORT_KEYS } from '../../backend/utils/letterheadService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Letterhead');

const UPLOAD_URL_PREFIX = '/uploads/letterheads/';
const UPLOAD_FS_PATH = path.join('public', 'uploads', 'letterheads');
const DEFAULT_LOGO_LEFT = '/logo-kiri.png';
const DEFAULT_LOGO_RIGHT = '/logo-kanan.png';
const DEFAULT_LETTERHEAD_LINES = [
    { text: "PEMERINTAH DAERAH PROVINSI JAWA BARAT", fontWeight: "bold" },
    { text: "DINAS PENDIDIKAN", fontWeight: "bold" },
    { text: "SEKOLAH MENENGAH KEJURUAN NEGERI 13 BANDUNG", fontWeight: "bold" },
    { text: "Jl. Soekarno Hatta No. 10, Kota Bandung 40235", fontWeight: "normal" },
    { text: "Telepon: (022) 5204095 | Email: smkn13bandung@sch.id", fontWeight: "normal" }
];

// ================================================
// HELPER FUNCTIONS
// ================================================

async function getLetterheadGlobal() {
    try {
        return await getLetterhead({ reportKey: null });
    } catch (error) {
        logger.error('Error getting global letterhead', { error: error.message });
        return null;
    }
}

async function getLetterheadForReportKey(reportKey) {
    try {
        return await getLetterhead({ reportKey });
    } catch (error) {
        logger.error('Error getting report letterhead', { reportKey, error: error.message });
        return null;
    }
}

function getLogoFieldAndFile(config, type) {
    const logoMap = {
        'logo': { field: 'logo', file: config.logo },
        'logoLeft': { field: 'logoLeftUrl', file: config.logoLeftUrl },
        'logoRight': { field: 'logoRightUrl', file: config.logoRightUrl }
    };
    return logoMap[type] || { field: null, file: null };
}

// ================================================
// REPORT LETTERHEAD ENDPOINTS
// ================================================

/**
 * Get report letterhead configuration
 * GET /api/admin/report-letterhead
 */
export const getReportLetterhead = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetReportLetterhead', {});

    try {
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.LAPORAN_GURU });
        log.success('GetReportLetterhead', { found: !!letterhead });
        return sendSuccessResponse(res, letterhead);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal memuat konfigurasi kop laporan');
    }
};

/**
 * Update report letterhead configuration
 * PUT /api/admin/report-letterhead
 */
export const updateReportLetterhead = async (req, res) => {
    const log = logger.withRequest(req, res);
    const letterhead = req.body;
    
    log.requestStart('UpdateReportLetterhead', {});

    try {
        const validation = validateLetterhead(letterhead);
        if (!validation.isValid) {
            log.validationFail('letterhead', null, validation.errors.join(', '));
            return sendValidationError(res, 'Konfigurasi kop laporan tidak valid', { details: validation.errors });
        }

        const success = await setLetterheadForReport(REPORT_KEYS.LAPORAN_GURU, letterhead);
        if (!success) {
            log.error('UpdateReportLetterhead failed');
            return sendErrorResponse(res, null, 'Gagal menyimpan konfigurasi kop laporan');
        }

        log.success('UpdateReportLetterhead', {});
        return sendSuccessResponse(res, letterhead, 'Konfigurasi kop laporan berhasil disimpan');
    } catch (error) {
        log.dbError('update', error);
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
    const log = logger.withRequest(req, res);
    const { reportKey } = req.query;
    
    log.requestStart('GetLetterheadConfig', { reportKey });

    try {
        const letterhead = await getLetterhead({ reportKey });
        log.success('GetLetterheadConfig', { found: !!letterhead });
        return sendSuccessResponse(res, letterhead);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal memuat konfigurasi KOP');
    }
};

/**
 * Get all letterhead configurations (admin only)
 * GET /api/admin/letterhead/all
 */
export const getAllLetterheadConfigs = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetAllLetterheads', {});

    try {
        const letterheads = await getAllLetterheads();
        log.success('GetAllLetterheads', { count: letterheads?.length || 0 });
        return sendSuccessResponse(res, letterheads);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal memuat daftar KOP');
    }
};

/**
 * Set global letterhead configuration
 * PUT /api/admin/letterhead/global
 */
export const setGlobalLetterhead = async (req, res) => {
    const log = logger.withRequest(req, res);
    const letterhead = req.body;
    
    log.requestStart('SetGlobalLetterhead', {});

    try {
        const success = await setLetterheadGlobal(letterhead);

        if (!success) {
            log.error('SetGlobalLetterhead failed');
            return sendErrorResponse(res, null, 'Gagal menyimpan konfigurasi KOP global');
        }

        log.success('SetGlobalLetterhead', {});
        return sendSuccessResponse(res, letterhead, 'Konfigurasi KOP global berhasil disimpan');
    } catch (error) {
        log.dbError('update', error);
        return sendDatabaseError(res, error, 'Gagal memperbarui konfigurasi KOP global');
    }
};

/**
 * Set letterhead configuration for specific report
 * PUT /api/admin/letterhead/report/:reportKey
 */
export const setReportLetterhead = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { reportKey } = req.params;
    const letterhead = req.body;

    log.requestStart('SetReportLetterhead', { reportKey });

    try {
        if (!reportKey) {
            log.validationFail('reportKey', null, 'Required');
            return sendValidationError(res, 'Kode laporan wajib diisi', { field: 'reportKey' });
        }

        const success = await setLetterheadForReport(reportKey, letterhead);
        if (!success) {
            log.error('SetReportLetterhead failed', { reportKey });
            return sendErrorResponse(res, null, 'Gagal menyimpan konfigurasi KOP untuk laporan');
        }

        log.success('SetReportLetterhead', { reportKey });
        return sendSuccessResponse(res, letterhead, `Konfigurasi KOP untuk ${reportKey} berhasil disimpan`);
    } catch (error) {
        log.dbError('update', error, { reportKey });
        return sendDatabaseError(res, error, 'Gagal memperbarui konfigurasi KOP laporan');
    }
};

/**
 * Upload logo for letterhead
 * POST /api/admin/letterhead/upload
 */
export const uploadLogo = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('UploadLogo', { logoType: req.body?.logoType });

    try {
        if (!req.file) {
            log.validationFail('file', null, 'No file uploaded');
            return sendValidationError(res, 'File logo wajib diupload', { field: 'file' });
        }

        const logoUrl = `${UPLOAD_URL_PREFIX}${req.file.filename}`;

        log.success('UploadLogo', {
            filename: req.file.filename,
            size: req.file.size,
            logoType: req.body.logoType
        });

        return sendSuccessResponse(res, {
            url: logoUrl,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            logoType: req.body.logoType
        }, 'Logo berhasil diupload');
    } catch (error) {
        log.error('UploadLogo failed', { error: error.message });
        return sendDatabaseError(res, error, 'Gagal mengupload logo');
    }
};

/**
 * Delete physical file
 * DELETE /api/admin/letterhead/delete-file
 */
export const deleteFile = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { fileUrl } = req.body;
    
    log.requestStart('DeleteFile', { fileUrl });

    try {
        if (!fileUrl || !fileUrl.startsWith(UPLOAD_URL_PREFIX)) {
            log.validationFail('fileUrl', fileUrl, 'Invalid URL');
            return sendValidationError(res, 'URL file tidak valid', { field: 'fileUrl' });
        }

        // Sanitize: Extract only the filename to prevent path traversal attacks
        const filename = path.basename(fileUrl);
        
        // Validate filename doesn't contain dangerous patterns
        if (!filename || filename.includes('..') || filename.startsWith('.')) {
            log.validationFail('fileUrl', fileUrl, 'Invalid filename');
            return sendValidationError(res, 'Nama file tidak valid', { field: 'fileUrl' });
        }
        
        // Construct safe path using sanitized filename
        const filePath = path.join(UPLOAD_FS_PATH, filename);

        try {
            await fs.unlink(filePath);
            log.success('DeleteFile', { filePath });
            return sendSuccessResponse(res, null, 'File berhasil dihapus');
        } catch (fileError) {
            log.warn('DeleteFile - file not found', { filePath, error: fileError.message });
            return sendNotFoundError(res, 'File tidak ditemukan');
        }
    } catch (error) {
        log.error('DeleteFile failed', { error: error.message });
        return sendDatabaseError(res, error, 'Gagal menghapus file');
    }
};

/**
 * Delete logo for letterhead
 * DELETE /api/admin/letterhead/logo/:logoType
 */
export const deleteLogo = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { logoType } = req.params;
    const { scope, reportKey } = req.query;

    log.requestStart('DeleteLogo', { logoType, scope, reportKey });

    try {
        if (!logoType || !['logo', 'logoLeft', 'logoRight'].includes(logoType)) {
            log.validationFail('logoType', logoType, 'Invalid type');
            return sendValidationError(res, 'Tipe logo tidak valid. Gunakan: logo, logoLeft, atau logoRight', { field: 'logoType' });
        }

        // Get current letterhead config
        let currentConfig;
        if (scope === 'report' && reportKey) {
            currentConfig = await getLetterheadForReportKey(reportKey);
        } else {
            currentConfig = await getLetterheadGlobal();
        }

        if (!currentConfig) {
            log.warn('DeleteLogo - config not found', { scope, reportKey });
            return sendNotFoundError(res, 'Konfigurasi letterhead tidak ditemukan');
        }

        // Clear the specified logo and delete physical file
        const updateData = { ...currentConfig };
        const { field, file } = getLogoFieldAndFile(currentConfig, logoType);
        
        if (field) {
            updateData[field] = '';
        }

        // Delete physical file if it exists
        if (file && file.startsWith(UPLOAD_URL_PREFIX)) {
            try {
                const filePath = path.join('public', file);
                await fs.unlink(filePath);
                log.debug('Physical file deleted', { filePath });
            } catch (fileError) {
                log.warn('Could not delete physical file', { error: fileError.message });
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
            log.error('DeleteLogo - save failed', { logoType });
            return sendErrorResponse(res, null, 'Gagal menghapus logo');
        }

        log.success('DeleteLogo', { logoType });
        return sendSuccessResponse(res, updateData, `Logo ${logoType} berhasil dihapus`);
    } catch (error) {
        log.dbError('deleteLogo', error, { logoType });
        return sendDatabaseError(res, error, 'Gagal menghapus logo');
    }
};

/**
 * Delete letterhead configuration
 * DELETE /api/admin/letterhead/:id
 */
export const deleteLetterheadConfig = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('DeleteLetterhead', { id });

    try {
        const success = await deleteLetterhead(Number.parseInt(id));

        if (!success) {
            log.warn('DeleteLetterhead - not found', { id });
            return sendNotFoundError(res, 'Konfigurasi KOP tidak ditemukan');
        }

        log.success('DeleteLetterhead', { id });
        return sendSuccessResponse(res, null, 'Konfigurasi KOP berhasil dihapus');
    } catch (error) {
        log.dbError('delete', error, { id });
        return sendDatabaseError(res, error, 'Gagal menghapus konfigurasi KOP');
    }
};

/**
 * Initialize default letterhead
 * POST /api/admin/letterhead/init-defaults
 */
export const initializeDefaults = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('InitDefaults', {});

    try {
        // Check if letterhead already exists
        const [existingRows] = await db.execute(
            'SELECT id FROM kop_laporan WHERE cakupan = "global" AND kode_laporan IS NULL AND aktif = 1 LIMIT 1'
        );

        if (existingRows.length > 0) {
            log.info('Letterhead already exists, skipping init');
            return sendSuccessResponse(res, null, 'Letterhead sudah ada di database');
        }

        // Insert default letterhead matched with SMKN 13 Bandung
        const defaultLines = JSON.stringify(DEFAULT_LETTERHEAD_LINES);

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
            DEFAULT_LOGO_LEFT,
            DEFAULT_LOGO_RIGHT
        ];

        await db.execute(query, params);

        log.success('InitDefaults', {});
        return sendSuccessResponse(res, null, 'Letterhead default berhasil diinisialisasi');

    } catch (error) {
        log.dbError('initDefaults', error);
        return sendErrorResponse(res, error, 'Error menginisialisasi letterhead default');
    }
};
