/**
 * Import Controller
 * Menangani impor Excel untuk mapel, kelas, ruang, jadwal, siswa, guru
 * Dimigrasi dari server_modern.js - Batch 16
 */

import ExcelJS from 'exceljs';
import bcrypt from 'bcrypt';
import { sendErrorResponse, sendDatabaseError, sendValidationError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Import');
import {
    sheetToJsonByHeader,
    mapKelasByName,
    mapMapelByName,
    mapGuruByName,
    mapRuangByKode,
    getFieldValue,
    parseGuruIdsFromString,
    parseGuruNamesFromString,
    validateRequiredJadwalFields,
    buildJadwalObject,
    validateStudentAccountRow,
    createStudentRowPreview,
    validateTeacherAccountRow,
    createTeacherRowPreview,
    validateMapelRow,
    validateKelasRow,
    validateRuangRow,
    validateSiswaDataRow,
    validateGuruDataRow
} from '../utils/importHelper.js';

// ================================================
// IMPORT MAPEL (Subject)
// ================================================

/**
 * Import mapel from Excel file
 * POST /api/admin/import/mapel
 */
const importMapel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kode_mapel');

        const errors = [];
        const valid = [];
        const seenKode = new Set();

        for (let i = 0; i < rows.length; i++) {
            const currentRow = rows[i];
            const rowNum = i + 2; // Excel row number

            try {
                const result = validateMapelRow(currentRow, seenKode);
                
                if (!result.valid) {
                    errors.push({ index: rowNum, errors: result.errors, data: result.preview });
                } else {
                    valid.push(result.data);
                }
            } catch (error) {
                const rowPreview = {
                    kode_mapel: currentRow.kode_mapel || currentRow['Kode Mapel'] || '(kosong)',
                    nama_mapel: currentRow.nama_mapel || currentRow['Nama Mapel'] || '(kosong)'
                };
                errors.push({ index: rowNum, errors: [error.message], data: rowPreview });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: 'Dry run completed. No data was imported.'
            });
        }
        if (valid.length === 0) return res.status(400).json({ error: 'Tidak ada baris valid untuk diimpor', errors });

        const conn = await globalThis.dbPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const validRecord of valid) {
                await conn.execute(
                    `INSERT INTO mapel (kode_mapel, nama_mapel, deskripsi, status)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE nama_mapel = VALUES(nama_mapel), deskripsi = VALUES(deskripsi), status = VALUES(status)`,
                    [validRecord.kode_mapel, validRecord.nama_mapel, validRecord.deskripsi, validRecord.status]
                );
            }
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
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('nama_kelas');

        const errors = [];
        const valid = [];
        const seenNama = new Set();

        for (let i = 0; i < rows.length; i++) {
            const rowData = rows[i];
            const rowNum = i + 2;

            try {
                const result = validateKelasRow(rowData, seenNama);
                
                if (!result.valid) {
                    errors.push({ index: rowNum, errors: result.errors, data: result.preview });
                } else {
                    valid.push(result.data);
                }
            } catch (error) {
                const rowPreview = {
                    nama_kelas: rowData.nama_kelas || rowData['Nama Kelas'] || '(kosong)',
                    tingkat: rowData.tingkat || rowData.Tingkat || '(kosong)'
                };
                errors.push({ index: rowNum, errors: [error.message], data: rowPreview });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: 'Dry run completed. No data was imported.'
            });
        }
        if (valid.length === 0) return res.status(400).json({ error: 'Tidak ada baris valid untuk diimpor', errors });

        const conn = await globalThis.dbPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const v of valid) {
                await conn.execute(
                    `INSERT INTO kelas (nama_kelas, tingkat, status)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE tingkat = VALUES(tingkat), status = VALUES(status)`,
                    [v.nama_kelas, v.tingkat, v.status]
                );
            }
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
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kode_ruang');

        const errors = [];
        const valid = [];
        const seenKode = new Set();

        for (let i = 0; i < rows.length; i++) {
            const rowNum = i + 2;
            try {
                const result = validateRuangRow(rows[i], seenKode);
                if (result.valid) {
                    valid.push(result.data);
                } else {
                    errors.push({ index: rowNum, errors: result.errors, data: result.preview });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message], data: { kode_ruang: '(error)', nama_ruang: '(error)' } });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: 'Dry run completed. No data was imported.'
            });
        }
        if (valid.length === 0) return res.status(400).json({ error: 'Tidak ada baris valid untuk diimpor', errors });

        const conn = await globalThis.dbPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const v of valid) {
                await conn.execute(
                    `INSERT INTO ruang_kelas (kode_ruang, nama_ruang, lokasi, kapasitas, status)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE nama_ruang = VALUES(nama_ruang), lokasi = VALUES(lokasi), kapasitas = VALUES(kapasitas), status = VALUES(status)`,
                    [v.kode_ruang, v.nama_ruang, v.lokasi, v.kapasitas, v.status]
                );
            }
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
    
    return { kelas_id, mapel_id, guru_id, ruang_id, guru_ids_array, errors: [] };
}

/**
 * Parse jadwal row in friendly format (maps names to IDs)
 */
async function parseJadwalFriendlyFormat(rowData) {
    const errors = [];
    
    const kelas_id = await mapKelasByName(getFieldValue(rowData, ['Kelas', 'kelas']));
    const mapel_id = await mapMapelByName(getFieldValue(rowData, ['Mata Pelajaran', 'mapel']));
    const ruang_id = await mapRuangByKode(getFieldValue(rowData, ['Kode Ruang', 'ruang']));
    
    // Parse primary guru(s)
    let guru_ids_array = await parseGuruNamesFromString(getFieldValue(rowData, ['Guru', 'guru']));
    
    // Parse additional gurus
    const guruTambahan = await parseGuruNamesFromString(getFieldValue(rowData, ['Guru Tambahan', 'guru_tambahan']));
    for (const gid of guruTambahan) {
        if (!guru_ids_array.includes(gid)) {
            guru_ids_array.push(gid);
        }
    }
    
    // Set primary guru_id
    const guru_id = guru_ids_array.length > 0 ? guru_ids_array[0] : await mapGuruByName(getFieldValue(rowData, ['Guru', 'guru']));
    
    // Validation
    if (!kelas_id) {
        errors.push(`Kelas "${getFieldValue(rowData, ['Kelas', 'kelas'])}" tidak ditemukan`);
    }
    
    const jenisAktivitas = getFieldValue(rowData, ['jenis_aktivitas', 'Jenis Aktivitas']) || 'pelajaran';
    if (jenisAktivitas === 'pelajaran') {
        if (!mapel_id) {
            errors.push(`Mata pelajaran "${getFieldValue(rowData, ['Mata Pelajaran', 'mapel'])}" tidak ditemukan`);
        }
        if (!guru_id && guru_ids_array.length === 0) {
            errors.push(`Guru "${getFieldValue(rowData, ['Guru', 'guru'])}" tidak ditemukan`);
        }
    } else {
        const keteranganKhusus = getFieldValue(rowData, ['keterangan_khusus', 'Keterangan Khusus']);
        if (!keteranganKhusus || keteranganKhusus.toString().trim() === '') {
            errors.push(`Keterangan khusus wajib untuk jenis aktivitas "${jenisAktivitas}"`);
        }
    }
    
    return { kelas_id, mapel_id, guru_id, ruang_id, guru_ids_array, errors };
}

/**
 * Process single jadwal row and validate
 */
async function processJadwalRow(rowData, isBasicFormat) {
    // Parse based on format
    const parsed = isBasicFormat 
        ? await parseJadwalBasicFormat(rowData)
        : await parseJadwalFriendlyFormat(rowData);
    
    // Validate required fields
    const fieldErrors = validateRequiredJadwalFields(rowData);
    const allErrors = [...parsed.errors, ...fieldErrors];
    
    if (allErrors.length > 0) {
        return { valid: false, errors: allErrors, data: null };
    }
    
    // Build valid jadwal object
    const jadwalObj = buildJadwalObject(
        rowData, 
        parsed.kelas_id, 
        parsed.mapel_id, 
        parsed.guru_id, 
        parsed.ruang_id, 
        parsed.guru_ids_array
    );
    
    return { valid: true, errors: [], data: jadwalObj };
}

/**
 * Insert jadwal records with multi-guru support
 */
async function insertJadwalRecords(conn, validRecords) {
    for (const v of validRecords) {
        const [insertRes] = await conn.execute(
            `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [v.kelas_id, v.mapel_id, v.guru_id, v.ruang_id, v.hari, v.jam_ke, v.jam_mulai, v.jam_selesai, v.status, v.jenis_aktivitas, v.is_absenable, v.keterangan_khusus]
        );
        
        const jadwalId = insertRes?.insertId;
        if (!jadwalId) continue;
        
        // Insert jadwal_guru relations for pelajaran with guru_ids
        if (v.jenis_aktivitas === 'pelajaran' && Array.isArray(v.guru_ids) && v.guru_ids.length > 0) {
            const validGuruIds = v.guru_ids.filter(gid => gid && !Number.isNaN(gid) && gid > 0);
            if (validGuruIds.length > 0) {
                const values = validGuruIds.map((gid, idx) => [jadwalId, gid, idx === 0 ? 1 : 0]);
                const placeholders = values.map(() => '(?, ?, ?)').join(', ');
                const flatValues = values.flat();
                await conn.execute(
                    `INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES ${placeholders}`,
                    flatValues
                );
                
                if (validGuruIds.length > 1) {
                    await conn.execute('UPDATE jadwal SET is_multi_guru = 1 WHERE id_jadwal = ?', [jadwalId]);
                }
            }
        }
    }
}

/**
 * Import jadwal from Excel file with multi-guru support
 * POST /api/admin/import/jadwal
 */
const importJadwal = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);

        // Detect format
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kelas_id');
        const errors = [];
        const valid = [];

        // Process each row
        for (let i = 0; i < rows.length; i++) {
            const rowNum = i + 2;
            try {
                const result = await processJadwalRow(rows[i], isBasicFormat);
                
                if (result.valid) {
                    valid.push(result.data);
                } else {
                    const rowPreview = {
                        kelas: getFieldValue(rows[i], ['Kelas', 'kelas', 'kelas_id']) || '(kosong)',
                        hari: getFieldValue(rows[i], ['hari', 'Hari']) || '(kosong)',
                        jam_ke: getFieldValue(rows[i], ['jam_ke', 'Jam Ke']) || '(kosong)'
                    };
                    errors.push({ index: rowNum, errors: result.errors, data: rowPreview });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message], data: {} });
            }
        }

        // Dry run mode
        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: 'Dry run completed. No data was imported.'
            });
        }
        
        if (valid.length === 0) {
            return res.status(400).json({ error: 'Tidak ada baris valid untuk diimpor', errors });
        }

        // Insert to database
        const conn = await globalThis.dbPool.getConnection();
        try {
            await conn.beginTransaction();
            await insertJadwalRecords(conn, valid);
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
// IMPORT STUDENT ACCOUNT (with bcrypt password hashing)
// ================================================

/**
 * Import student accounts from Excel file
 * POST /api/admin/import/student-account
 */
/**
 * Process student account records to database
 * @param {Object} conn - Database connection
 * @param {Object[]} validRecords - Valid student records
 * @returns {Promise<{successCount: number, duplicateCount: number}>}
 */
async function processStudentAccountRecords(conn, validRecords) {
    let successCount = 0;
    let duplicateCount = 0;

    for (const v of validRecords) {
        const [existingSiswa] = await conn.execute(
            'SELECT id_siswa, user_id FROM siswa WHERE nis = ?',
            [v.nis]
        );

        const [existingUser] = await conn.execute(
            'SELECT id FROM users WHERE username = ?',
            [v.username]
        );

        if (existingUser.length > 0 && !existingSiswa.length) {
            throw new Error(`Username '${v.username}' sudah digunakan oleh user lain`);
        }

        const [kelasResult] = await conn.execute(
            'SELECT id_kelas FROM kelas WHERE nama_kelas = ?',
            [v.kelas]
        );

        if (kelasResult.length === 0) {
            throw new Error(`Kelas '${v.kelas}' tidak ditemukan`);
        }

        const kelasId = kelasResult[0].id_kelas;

        if (existingSiswa.length > 0) {
            await updateExistingStudent(conn, v, kelasId, existingSiswa[0].user_id);
            duplicateCount++;
        } else {
            await insertNewStudent(conn, v, kelasId);
            successCount++;
        }
    }

    return { successCount, duplicateCount };
}

/**
 * Update existing student record
 */
async function updateExistingStudent(conn, v, kelasId, userId) {
    await conn.execute(
        `UPDATE siswa SET 
         nama = ?, kelas_id = ?, jenis_kelamin = ?, email = ?, 
         jabatan = ?, updated_at = CURRENT_TIMESTAMP
         WHERE nis = ?`,
        [v.nama, kelasId, v.jenis_kelamin, v.email, v.jabatan, v.nis]
    );

    const hashedPassword = await bcrypt.hash(v.password, 10);
    await conn.execute(
        `UPDATE users SET 
         username = ?, password = ?, nama = ?, email = ?, 
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [v.username, hashedPassword, v.nama, v.email, userId]
    );
}

/**
 * Insert new student record
 */
async function insertNewStudent(conn, v, kelasId) {
    const hashedPassword = await bcrypt.hash(v.password, 10);
    const [userResult] = await conn.execute(
        `INSERT INTO users (username, password, role, nama, email, status, created_at, updated_at)
         VALUES (?, ?, 'siswa', ?, ?, 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [v.username, hashedPassword, v.nama, v.email]
    );

    const userId = userResult.insertId;

    await conn.execute(
        `INSERT INTO siswa (nis, nama, kelas_id, jenis_kelamin, email, jabatan, user_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [v.nis, v.nama, kelasId, v.jenis_kelamin, v.email, v.jabatan, userId]
    );
}

const importStudentAccount = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);
        const errors = [];
        const valid = [];

        // Get existing data from database
        const existingUsernames = new Set();
        const existingNis = new Set();

        try {
            const [dbUsernames] = await globalThis.dbPool.execute('SELECT username FROM users WHERE role = "siswa"');
            const [dbNis] = await globalThis.dbPool.execute('SELECT nis FROM siswa');
            dbUsernames.forEach(row => existingUsernames.add(row.username));
            dbNis.forEach(row => existingNis.add(row.nis));
        } catch (dbError) {
            logger.error('Error checking existing data', { error: dbError.message });
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        // Validate each row using helper function
        for (let i = 0; i < rows.length; i++) {
            const rowData = rows[i];
            const rowNum = i + 2;

            const result = validateStudentAccountRow(rowData, valid, existingNis, existingUsernames);
            
            if (result.valid) {
                valid.push(result.data);
            } else {
                errors.push({ index: rowNum, errors: result.errors, data: createStudentRowPreview(rowData) });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: 'Dry run completed. No data was imported.'
            });
        }

        if (valid.length === 0) {
            return res.status(400).json({
                error: 'Tidak ada baris valid untuk diimpor',
                errors,
                message: 'Semua data memiliki error. Perbaiki error terlebih dahulu.'
            });
        }

        const conn = await globalThis.dbPool.getConnection();
        try {
            await conn.beginTransaction();

            const { successCount, duplicateCount } = await processStudentAccountRecords(conn, valid);

            await conn.commit();

            res.json({
                success: true,
                processed: valid.length,
                new: successCount,
                updated: duplicateCount,
                invalid: errors.length,
                errors,
                message: `Import akun siswa berhasil! ${successCount} akun baru, ${duplicateCount} akun diupdate.`
            });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        logger.error('Import student account failed', err);
        return sendDatabaseError(res, err, 'Terjadi kesalahan saat memproses file');
    }
};

// ================================================
// IMPORT TEACHER ACCOUNT (with bcrypt password hashing)
// ================================================

/**
 * Import teacher accounts from Excel file
 * POST /api/admin/import/teacher-account
 */
/**
 * Process teacher account records to database
 */
async function processTeacherAccountRecords(conn, validRecords) {
    let successCount = 0;
    let duplicateCount = 0;

    for (const v of validRecords) {
        const [existingGuru] = await conn.execute(
            'SELECT id_guru, user_id FROM guru WHERE nip = ?',
            [v.nip]
        );

        const [existingUser] = await conn.execute(
            'SELECT id FROM users WHERE username = ?',
            [v.username]
        );

        if (existingUser.length > 0 && !existingGuru.length) {
            throw new Error(`Username '${v.username}' sudah digunakan oleh user lain`);
        }

        if (existingGuru.length > 0) {
            await updateExistingTeacher(conn, v, existingGuru[0].user_id);
            duplicateCount++;
        } else {
            await insertNewTeacher(conn, v);
            successCount++;
        }
    }

    return { successCount, duplicateCount };
}

/**
 * Update existing teacher record
 */
async function updateExistingTeacher(conn, v, userId) {
    await conn.execute(
        `UPDATE guru SET 
         nama = ?, jenis_kelamin = ?, email = ?, no_telepon = ?,
         alamat = ?, jabatan = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE nip = ?`,
        [v.nama, v.jenis_kelamin, v.email, v.no_telp, v.alamat, v.mata_pelajaran, v.status, v.nip]
    );

    const hashedPassword = await bcrypt.hash(v.password, 10);
    await conn.execute(
        `UPDATE users SET 
         username = ?, password = ?, nama = ?, email = ?, 
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [v.username, hashedPassword, v.nama, v.email, userId]
    );
}

/**
 * Insert new teacher record
 */
async function insertNewTeacher(conn, v) {
    const hashedPassword = await bcrypt.hash(v.password, 10);
    const [userResult] = await conn.execute(
        `INSERT INTO users (username, password, role, nama, email, status, created_at, updated_at)
         VALUES (?, ?, 'guru', ?, ?, 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [v.username, hashedPassword, v.nama, v.email]
    );

    const userId = userResult.insertId;

    await conn.execute(
        `INSERT INTO guru (nip, nama, jenis_kelamin, email, no_telepon, alamat, jabatan, user_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [v.nip, v.nama, v.jenis_kelamin, v.email, v.no_telp, v.alamat, v.mata_pelajaran, userId, v.status]
    );
}

const importTeacherAccount = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);
        const errors = [];
        const valid = [];

        // Get existing data from database
        const existingUsernames = new Set();
        const existingNips = new Set();

        try {
            const [dbUsernames] = await globalThis.dbPool.execute('SELECT username FROM users WHERE role = "guru"');
            const [dbNips] = await globalThis.dbPool.execute('SELECT nip FROM guru');
            dbUsernames.forEach(row => existingUsernames.add(row.username));
            dbNips.forEach(row => existingNips.add(row.nip));
        } catch (dbError) {
            logger.error('Error checking existing data', { error: dbError.message });
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        // Validate each row using helper function
        for (let i = 0; i < rows.length; i++) {
            const rowData = rows[i];
            const rowNum = i + 2;

            const result = validateTeacherAccountRow(rowData, valid, existingNips, existingUsernames);
            
            if (result.valid) {
                valid.push(result.data);
            } else {
                errors.push({ index: rowNum, errors: result.errors, data: createTeacherRowPreview(rowData) });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: 'Dry run completed. No data was imported.'
            });
        }

        if (valid.length === 0) {
            return res.status(400).json({
                error: 'Tidak ada baris valid untuk diimpor',
                errors,
                message: 'Semua data memiliki error. Perbaiki error terlebih dahulu.'
            });
        }

        const conn = await globalThis.dbPool.getConnection();
        try {
            await conn.beginTransaction();

            const { successCount, duplicateCount } = await processTeacherAccountRecords(conn, valid);

            await conn.commit();

            res.json({
                success: true,
                processed: valid.length,
                new: successCount,
                updated: duplicateCount,
                invalid: errors.length,
                errors,
                message: `Import akun guru berhasil! ${successCount} akun baru, ${duplicateCount} akun diupdate.`
            });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        logger.error('Import teacher account failed', err);
        return sendDatabaseError(res, err, 'Terjadi kesalahan saat memproses file');
    }
};

// ================================================
// IMPORT SISWA DATA (data-only, no password)
// ================================================

/**
 * Process a single siswa data record (insert or update)
 * @private
 * @returns {Promise<'new'|'updated'>} Status of the operation
 */
async function processSiswaDataRecord(conn, record) {
    // Find kelas_id by class name
    const [kelasResult] = await conn.execute(
        'SELECT id_kelas FROM kelas WHERE nama_kelas = ?',
        [record.kelas]
    );

    if (kelasResult.length === 0) {
        throw new Error(`Kelas '${record.kelas}' tidak ditemukan`);
    }

    const kelasId = kelasResult[0].id_kelas;

    // Check if NIS already exists
    const [existingSiswa] = await conn.execute(
        'SELECT id_siswa FROM siswa WHERE nis = ?',
        [record.nis]
    );

    if (existingSiswa.length > 0) {
        // Update existing student
        await conn.execute(
            `UPDATE siswa SET 
             nama = ?, kelas_id = ?, jenis_kelamin = ?, 
             telepon_orangtua = ?, nomor_telepon_siswa = ?, alamat = ?, status = ?, 
             updated_at = CURRENT_TIMESTAMP
             WHERE nis = ?`,
            [record.nama, kelasId, record.jenis_kelamin, record.telepon_orangtua, record.nomor_telepon_siswa, record.alamat, record.status, record.nis]
        );
        return 'updated';
    }

    // Insert new student (data-only, no account)
    await conn.execute(
        `INSERT INTO siswa (nis, nama, kelas_id, jenis_kelamin, telepon_orangtua, nomor_telepon_siswa, alamat, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [record.nis, record.nama, kelasId, record.jenis_kelamin, record.telepon_orangtua, record.nomor_telepon_siswa, record.alamat, record.status]
    );
    return 'new';
}

/**
 * Import siswa data from Excel file (without account creation)
 * POST /api/admin/import/siswa
 */
const importSiswa = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });
        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);
        const errors = [];
        const valid = [];

        // Check for existing NIS in database
        const existingNis = new Set();

        try {
            const [dbNis] = await globalThis.dbPool.execute('SELECT nis FROM siswa');
            dbNis.forEach(row => existingNis.add(row.nis));
        } catch (dbError) {
            logger.error('Error checking existing data', { error: dbError.message });
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        // Validate each row
        for (let i = 0; i < rows.length; i++) {
            const rowNum = i + 2;
            try {
                const result = validateSiswaDataRow(rows[i], valid, existingNis);
                if (result.valid) {
                    valid.push(result.data);
                } else {
                    errors.push({ index: rowNum, errors: result.errors, data: result.preview });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message], data: { nis: '(error)', nama: '(error)', kelas: '(error)' } });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: 'Dry run completed. No data was imported.'
            });
        }

        if (valid.length === 0) {
            return res.status(400).json({
                error: 'Tidak ada baris valid untuk diimpor',
                errors
            });
        }

        // Process records with helper function
        const conn = await globalThis.dbPool.getConnection();
        try {
            await conn.beginTransaction();

            let successCount = 0;
            let duplicateCount = 0;

            for (const record of valid) {
                const status = await processSiswaDataRecord(conn, record);
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
 * Process a single guru data record (insert or update)
 * @private
 * @returns {Promise<'new'|'updated'>} Status of the operation
 */
async function processGuruDataRecord(conn, record) {
    // Check if NIP already exists
    const [existingGuru] = await conn.execute(
        'SELECT id_guru FROM guru WHERE nip = ?',
        [record.nip]
    );

    if (existingGuru.length > 0) {
        // Update existing teacher
        await conn.execute(
            `UPDATE guru SET 
             nama = ?, jenis_kelamin = ?, email = ?, no_telepon = ?,
             alamat = ?, jabatan = ?, status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE nip = ?`,
            [record.nama, record.jenis_kelamin, record.email, record.nomor_telepon, record.alamat, record.jabatan, record.status, record.nip]
        );
        return 'updated';
    }

    // Insert new teacher (data-only, no account)
    await conn.execute(
        `INSERT INTO guru (nip, nama, jenis_kelamin, email, no_telepon, alamat, jabatan, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [record.nip, record.nama, record.jenis_kelamin, record.email, record.nomor_telepon, record.alamat, record.jabatan, record.status]
    );
    return 'new';
}

/**
 * Import guru data from Excel file (without account creation)
 * POST /api/admin/import/guru
 */
const importGuru = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });
        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);
        const errors = [];
        const valid = [];

        // Check for existing NIP in database
        const existingNips = new Set();

        try {
            const [dbNips] = await globalThis.dbPool.execute('SELECT nip FROM guru');
            dbNips.forEach(row => existingNips.add(row.nip));
        } catch (dbError) {
            logger.error('Error checking existing data', { error: dbError.message });
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        // Validate each row
        for (let i = 0; i < rows.length; i++) {
            const rowNum = i + 2;
            try {
                const result = validateGuruDataRow(rows[i], valid, existingNips);
                if (result.valid) {
                    // Add additional fields not in helper
                    const rowData = rows[i];
                    result.data.jabatan = (rowData.jabatan || rowData.Jabatan) ? String(rowData.jabatan || rowData.Jabatan).trim() : null;
                    valid.push(result.data);
                } else {
                    errors.push({ index: rowNum, errors: result.errors, data: result.preview });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message], data: { nip: '(error)', nama: '(error)' } });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: 'Dry run completed. No data was imported.'
            });
        }

        if (valid.length === 0) {
            return res.status(400).json({
                error: 'Tidak ada baris valid untuk diimpor',
                errors
            });
        }

        // Process records with helper function
        const conn = await globalThis.dbPool.getConnection();
        try {
            await conn.beginTransaction();

            let successCount = 0;
            let duplicateCount = 0;

            for (const record of valid) {
                const status = await processGuruDataRecord(conn, record);
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
        return sendDatabaseError(res, err, 'Terjadi kesalahan saat memproses file');
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

