/**
 * Import Controller
 * Menangani impor Excel untuk mapel, kelas, ruang, jadwal, siswa, guru
 * Dimigrasi dari server_modern.js - Batch 16
 */

import ExcelJS from 'exceljs';

import { AppError, ERROR_CODES, sendDatabaseError, sendErrorResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import db from '../config/db.js';

const logger = createLogger('Import');

// Constants to avoid duplicate literals
const ERROR_FILE_NOT_FOUND = 'File tidak ditemukan';
const ERROR_NO_VALID_ROWS = 'Tidak ada baris valid untuk diimpor';
const ERROR_DB_CHECK_FAILED = 'Gagal memeriksa data yang sudah ada';
const ERROR_TEMPLATE_MISMATCH = 'Format file tidak sesuai template';
const MSG_DRY_RUN_COMPLETED = 'Dry run completed. No data was imported.';

const sendImportValidationError = (res, message, errors = null) => {
    const error = new AppError(ERROR_CODES.VALIDATION_FAILED, message, errors);
    const extra = errors ? { errors } : null;
    return sendErrorResponse(res, error, null, null, extra);
};

import {
    sheetToJsonByHeader,
    validateBatchRows,
    mapKelasByName,
    mapMapelByName,
    mapGuruByName,
    mapRuangByKode,
    parseGuruIdsFromString,
    parseGuruNamesFromString,
    validateRequiredJadwalFields,
    buildJadwalObject,
    validateStudentAccountRow,
    validateTeacherAccountRow,
    validateMapelRow,
    validateKelasRow,
    validateRuangRow,
    validateSiswaDataRow,
    validateGuruDataRow
} from '../utils/importHelper.js';

import {
    persistMapel,
    persistKelas,
    persistRuang,
    processSiswaData,
    processGuruData,
    processStudentAccount,
    processTeacherAccount
} from '../services/importPersistence.js';

// ================================================
// IMPORT MAPEL (Subject)
// ================================================

/**
 * Import mapel from Excel file
 * POST /api/admin/import/mapel
 */
const importMapel = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);


        const seenKode = new Set();
        
        // Use generic batch validator
        const { valid, errors } = validateBatchRows(rows, validateMapelRow, seenKode);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }
        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await persistMapel(conn, valid);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted_or_updated: valid.length, invalid: errors.length, errors });
    } catch (err) {
        logger.error('Import mapel failed', err);
        return sendDatabaseError(res, err, 'Gagal impor mapel');
    }
};

// ================================================
// IMPORT KELAS (Class)
// ================================================

/**
 * Import kelas from Excel file
 * POST /api/admin/import/kelas
 */
const importKelas = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);


        const seenNama = new Set();
        
        // Use generic batch validator
        const { valid, errors } = validateBatchRows(rows, validateKelasRow, seenNama);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }
        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await persistKelas(conn, valid);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted_or_updated: valid.length, invalid: errors.length, errors });
    } catch (err) {
        logger.error('Import kelas error', { error: err.message });
        return sendDatabaseError(res, err, 'Gagal impor kelas');
    }
};

// ================================================
// IMPORT RUANG (Room)
// ================================================

/**
 * Import ruang from Excel file
 * POST /api/admin/import/ruang
 */
const importRuang = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);


        const seenKode = new Set();
        
        // Use generic batch validator
        const { valid, errors } = validateBatchRows(rows, validateRuangRow, seenKode);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }
        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await persistRuang(conn, valid);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted_or_updated: valid.length, invalid: errors.length, errors });
    } catch (err) {
        logger.error('Import ruang error', { error: err.message });
        return sendDatabaseError(res, err, 'Gagal impor ruang');
    }
};

// ================================================
// IMPORT JADWAL (Schedule) - Complex Multi-Guru Support
// ================================================

/**
 * Parse jadwal row in basic format (uses IDs directly)
 */
async function parseJadwalBasicFormat(rowData) {
    const kelas_id = rowData.kelas_id;
    const mapel_id = rowData.mapel_id || null;
    const guru_id = rowData.guru_id || null;
    const ruang_id = rowData.ruang_id || null;
    const guru_ids_array = parseGuruIdsFromString(rowData.guru_ids);
    
    return {
        kelas_id, mapel_id, guru_id, ruang_id, guru_ids_array
    };
}

/**
 * Parse jadwal row in friendly format (uses names/codes)
 */
async function parseJadwalFriendlyFormat(rowData) {
    const rawClass = rowData.kelas || rowData.Kelas;
    const rawMapel = rowData.mapel || rowData.Mapel || rowData['Mata Pelajaran'];
    const rawGuru = rowData.guru || rowData.Guru || rowData['Nama Guru'];
    const rawGuruPendamping = rowData.guru_pendamping || rowData['Guru Pendamping'];
    const rawRuang = rowData.ruang || rowData.Ruang || rowData['Kode Ruang'];

    const kelas_id = await mapKelasByName(rawClass);
    const mapel_id = await mapMapelByName(rawMapel);
    const guru_id = await mapGuruByName(rawGuru);
    const ruang_id = await mapRuangByKode(rawRuang);
    
    // Handle multi-guru from friendly format (comma separated in guru column or guru_pendamping)
    let guru_ids_array = [];
    if (guru_id) guru_ids_array.push(guru_id);
    
    // Check if guru column has multiple names
    if (rawGuru && rawGuru.includes(',')) {
        const ids = await parseGuruNamesFromString(rawGuru);
        guru_ids_array = [...new Set([...guru_ids_array, ...ids])];
    }
    
    // Add guru pendamping
    if (rawGuruPendamping) {
        const ids = await parseGuruNamesFromString(rawGuruPendamping);
        guru_ids_array = [...new Set([...guru_ids_array, ...ids])];
    }

    return {
        kelas_id, mapel_id, guru_id, ruang_id, guru_ids_array
    };
}

/**
 * Process a single jadwal row and return parsed data or error
 */
async function processJadwalRow(rowData, rowNum, isBasicFormat) {
    const fieldErrors = validateRequiredJadwalFields(rowData);
    if (fieldErrors.length > 0) {
        return { error: { index: rowNum, errors: fieldErrors, data: rowData } };
    }

    const parsedIds = isBasicFormat
        ? await parseJadwalBasicFormat(rowData)
        : await parseJadwalFriendlyFormat(rowData);
    
    const { kelas_id, mapel_id, guru_id, ruang_id, guru_ids_array } = parsedIds;

    if (!kelas_id) {
        return { error: { index: rowNum, errors: ['Kelas tidak ditemukan'], data: rowData } };
    }

    const jadwalObj = buildJadwalObject(rowData, kelas_id, mapel_id, guru_id, ruang_id, guru_ids_array);
    return { valid: jadwalObj };
}

/**
 * Persist jadwal batch to database
 */
async function persistJadwalBatch(conn, validItems) {
    for (const v of validItems) {
        const isMultiGuru = Array.isArray(v.guru_ids) && v.guru_ids.length > 1 ? 1 : 0;
        const [result] = await conn.execute(
            `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable, keterangan_khusus, status, is_multi_guru)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [v.kelas_id, v.mapel_id, v.guru_id, v.ruang_id, v.hari, v.jam_ke, v.jam_mulai, v.jam_selesai, v.jenis_aktivitas, v.is_absenable, v.keterangan_khusus, v.status, isMultiGuru]
        );
        
        const jadwalId = result.insertId;

        // Insert guru pendamping / multi-guru
        if (v.guru_ids && v.guru_ids.length > 0) {
            for (const gid of v.guru_ids) {
                await conn.execute(
                    `INSERT INTO jadwal_guru (jadwal_id, guru_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE guru_id=guru_id`,
                    [jadwalId, gid]
                );
            }
        }
    }
}

/**
 * Import jadwal from Excel file
 * POST /api/admin/import/jadwal
 */
const importJadwal = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);

        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kelas_id');
        const errors = [];
        const valid = [];

        // Process each row using extracted helper
        for (let i = 0; i < rows.length; i++) {
            try {
                const result = await processJadwalRow(rows[i], i + 2, isBasicFormat);
                if (result.error) errors.push(result.error);
                else valid.push(result.valid);
            } catch (err) {
                errors.push({ index: i + 2, errors: [err.message], data: rows[i] });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }
        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await persistJadwalBatch(conn, valid);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted: valid.length, invalid: errors.length, errors });
    } catch (err) {
        logger.error('Import jadwal error', { error: err.message });
        return sendDatabaseError(res, err, 'Gagal impor jadwal');
    }
};


// ================================================
// IMPORT SISWA (Student Data)
// ================================================

/**
 * Import siswa data from Excel file (without account creation)
 * POST /api/admin/import/siswa
 */
const importSiswa = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);
        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);

        // Check for existing NIS in database
        const existingNis = new Set();

        try {
            const [dbNis] = await db.execute('SELECT nis FROM siswa');
            dbNis.forEach(row => existingNis.add(row.nis));
        } catch (dbError) {
            logger.error('Error checking existing data', { error: dbError.message });
            return sendDatabaseError(res, dbError, ERROR_DB_CHECK_FAILED);
        }

        // Use generic batch validator (wrapped to match signature)
        const validatorWrapper = (rowData, { existingSet }) => {
             return validateSiswaDataRow(rowData, [], existingSet); 
        };
        
        const { valid, errors } = validateBatchRows(rows, validatorWrapper, { existingSet: existingNis });

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }

        if (valid.length === 0) {
            return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);
        }

        // Process records with helper function
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            let successCount = 0;
            let duplicateCount = 0;

            for (const record of valid) {
                const status = await processSiswaData(conn, record);
                if (status === 'new') successCount++;
                else duplicateCount++;
            }

            await conn.commit();

            res.json({
                success: true,
                processed: valid.length,
                new: successCount,
                updated: duplicateCount,
                invalid: errors.length,
                errors,
                message: `Import data siswa berhasil! ${successCount} baru, ${duplicateCount} diupdate.`
            });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        logger.error('Import siswa failed', err);
        return sendDatabaseError(res, err, 'Terjadi kesalahan saat memproses file');
    }
};

// ================================================
// IMPORT GURU DATA (data-only, no password)
// ================================================

/**
 * Import guru data from Excel file (without account creation)
 * POST /api/admin/import/guru
 */
const importGuru = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);
        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);
        
        // Check existing NIPs
        const existingNips = new Set();
        try {
             const [dbNips] = await db.execute('SELECT nip FROM guru');
             dbNips.forEach(r => existingNips.add(r.nip));
        } catch (e) {
             logger.warn('Failed to fetch existing NIPs', e);
        }

        const validatorWrapper = (rowData, existingSet) => {
             return validateGuruDataRow(rowData, [], existingSet);
        };

        const { valid, errors } = validateBatchRows(rows, validatorWrapper, existingNips);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }

        if (valid.length === 0) {
            return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            let successCount = 0;
            let duplicateCount = 0;

            for (const record of valid) {
                const status = await processGuruData(conn, record);
                if (status === 'new') successCount++;
                else duplicateCount++;
            }

            await conn.commit();
            res.json({
                success: true,
                processed: valid.length,
                new: successCount,
                updated: duplicateCount,
                invalid: errors.length,
                errors,
                message: `Import data guru berhasil! ${successCount} baru, ${duplicateCount} diupdate.`
            });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        logger.error('Import guru failed', err);
        return sendDatabaseError(res, err, 'Gagal import guru');
    }
};

// ================================================
// IMPORT ACCOUNT (Student & Teacher)
// ================================================

/**
 * Import student account from Excel file
 * POST /api/admin/import/student-account
 */
const importStudentAccount = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);

        // Validate
        const { valid, errors } = validateBatchRows(rows, validateStudentAccountRow, {});

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }

        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            let successCount = 0;
            let duplicateCount = 0;

            for (const record of valid) {
                 const status = await processStudentAccount(conn, record);
                 if (status === 'new') successCount++;
                 else duplicateCount++;
            }
            await conn.commit();
            res.json({ success: true, processed: valid.length, new: successCount, updated: duplicateCount, invalid: errors.length, errors });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        logger.error('Import student account failed', err);
        return sendDatabaseError(res, err, 'Gagal import akun siswa');
    }
};

/**
 * Import teacher account from Excel file
 * POST /api/admin/import/teacher-account
 */
const importTeacherAccount = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);

        // Validate
        const { valid, errors } = validateBatchRows(rows, validateTeacherAccountRow, {});

        if (req.query.dryRun === 'true') {
             return res.json({
                 total: rows.length,
                 valid: valid.length,
                 invalid: errors.length,
                 errors,
                 previewData: valid.slice(0, 20),
                 message: MSG_DRY_RUN_COMPLETED
             });
        }

        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            let successCount = 0;
            let duplicateCount = 0;

            for (const record of valid) {
                 const status = await processTeacherAccount(conn, record);
                 if (status === 'new') successCount++;
                 else duplicateCount++;
            }
            await conn.commit();
            res.json({ success: true, processed: valid.length, new: successCount, updated: duplicateCount, invalid: errors.length, errors });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        logger.error('Import teacher account failed', err);
        return sendDatabaseError(res, err, 'Gagal import akun guru');
    }
};

// ES Module exports
export {
    importMapel,
    importKelas,
    importRuang,
    importJadwal,
    importStudentAccount,
    importTeacherAccount,
    importSiswa,
    importGuru
};
