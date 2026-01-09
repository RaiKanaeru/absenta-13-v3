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
    createStudentRowPreview
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
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                // Validasi umum - perbaiki field mapping
                const kodeMapel = currentRow.kode_mapel || currentRow['Kode Mapel'] || currentRow['kode_mapel'];
                const namaMapel = currentRow.nama_mapel || currentRow['Nama Mapel'] || currentRow['nama_mapel'];
                const deskripsi = currentRow.deskripsi || currentRow.Deskripsi || currentRow['deskripsi'];
                const status = currentRow.status || currentRow.Status || currentRow['status'];

                if (!kodeMapel) rowErrors.push('kode_mapel wajib');
                if (!namaMapel) rowErrors.push('nama_mapel wajib');

                if (status && !['aktif', 'nonaktif'].includes(String(status))) {
                    rowErrors.push('status tidak valid');
                }

                if (kodeMapel) {
                    const normalizedCode = String(kodeMapel).trim();
                    if (seenKode.has(normalizedCode)) {
                        rowErrors.push('kode_mapel duplikat di file');
                    }
                    seenKode.add(normalizedCode);
                }

                if (rowErrors.length) {
                    const rowPreview = {
                        kode_mapel: kodeMapel || '(kosong)',
                        nama_mapel: namaMapel || '(kosong)'
                    };
                    errors.push({ index: rowNum, errors: rowErrors, data: rowPreview });
                } else {
                    valid.push({
                        kode_mapel: String(kodeMapel).trim(),
                        nama_mapel: String(namaMapel).trim(),
                        deskripsi: deskripsi ? String(deskripsi).trim() : null,
                        status: status ? String(status).trim() : 'aktif'
                    });
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
            const rowErrors = [];
            const rowNum = i + 2;

            try {
                const namaKelas = rowData.nama_kelas || rowData['Nama Kelas'];
                const tingkat = rowData.tingkat || rowData.Tingkat;
                const status = rowData.status || rowData.Status;

                if (!namaKelas) rowErrors.push('nama_kelas wajib');

                if (status && !['aktif', 'nonaktif'].includes(String(status))) {
                    rowErrors.push('status tidak valid');
                }

                if (namaKelas) {
                    const trimmedValue = String(namaKelas).trim();
                    if (seenNama.has(trimmedValue)) {
                        rowErrors.push('nama_kelas duplikat di file');
                    }
                    seenNama.add(trimmedValue);
                }

                if (rowErrors.length) {
                    const rowPreview = {
                        nama_kelas: namaKelas || '(kosong)',
                        tingkat: tingkat || '(kosong)'
                    };
                    errors.push({ index: rowNum, errors: rowErrors, data: rowPreview });
                } else {
                    valid.push({
                        nama_kelas: String(namaKelas).trim(),
                        tingkat: tingkat ? String(tingkat).trim() : null,
                        status: status ? String(status).trim() : 'aktif'
                    });
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
            const rowData = rows[i];
            const rowErrors = [];
            const rowNum = i + 2;

            try {
                const kodeRuang = rowData.kode_ruang || rowData['Kode Ruang'];
                const namaRuang = rowData.nama_ruang || rowData['Nama Ruang'];
                const lokasi = rowData.lokasi || rowData.Lokasi;
                const kapasitas = rowData.kapasitas || rowData.Kapasitas;
                const status = rowData.status || rowData.Status;

                if (!kodeRuang) rowErrors.push('kode_ruang wajib');
                if (!namaRuang) rowErrors.push('nama_ruang wajib');

                if (status && !['aktif', 'nonaktif'].includes(String(status))) {
                    rowErrors.push('status tidak valid');
                }

                if (kapasitas && isNaN(Number(kapasitas))) {
                    rowErrors.push('kapasitas harus berupa angka');
                }

                if (kodeRuang) {
                    const trimmedValue = String(kodeRuang).trim();
                    if (seenKode.has(trimmedValue)) {
                        rowErrors.push('kode_ruang duplikat di file');
                    }
                    seenKode.add(trimmedValue);
                }

                if (rowErrors.length) {
                    const rowPreview = {
                        kode_ruang: kodeRuang || '(kosong)',
                        nama_ruang: namaRuang || '(kosong)'
                    };
                    errors.push({ index: rowNum, errors: rowErrors, data: rowPreview });
                } else {
                    valid.push({
                        kode_ruang: String(kodeRuang).trim(),
                        nama_ruang: String(namaRuang).trim(),
                        lokasi: lokasi ? String(lokasi).trim() : null,
                        kapasitas: kapasitas ? Number(kapasitas) : null,
                        status: status ? String(status).trim() : 'aktif'
                    });
                }
            } catch (error) {
                const rowPreview = {
                    kode_ruang: rowData.kode_ruang || rowData['Kode Ruang'] || '(kosong)',
                    nama_ruang: rowData.nama_ruang || rowData['Nama Ruang'] || '(kosong)'
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
            const validGuruIds = v.guru_ids.filter(gid => gid && !isNaN(gid) && gid > 0);
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
const importTeacherAccount = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });
        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);
        const errors = [];
        const valid = [];
        const genderEnum = ['L', 'P'];

        // Cek duplikasi username dan NIP di database sebelum validasi
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

        for (let i = 0; i < rows.length; i++) {
            const rowData = rows[i];
            const rowErrors = [];
            const rowNum = i + 2;

            try {
                // Validasi field wajib
                if (!rowData.nama && !rowData['Nama Lengkap *']) rowErrors.push('Nama lengkap wajib diisi');
                if (!rowData.username && !rowData['Username *']) rowErrors.push('Username wajib diisi');
                if (!rowData.password && !rowData['Password *']) rowErrors.push('Password wajib diisi');
                if (!rowData.nip && !rowData['NIP *']) rowErrors.push('NIP wajib diisi');

                // Validasi NIP
                const nip = rowData.nip || rowData['NIP *'];
                if (nip) {
                    const nipValue = String(nip).trim();
                    if (nipValue.length < 8) rowErrors.push('NIP minimal 8 karakter');
                    if (nipValue.length > 20) rowErrors.push('NIP maksimal 20 karakter');

                    // Cek duplikasi NIP dalam file
                    const duplicateNip = valid.find(v => v.nip === nipValue);
                    if (duplicateNip) rowErrors.push('NIP duplikat dalam file');

                    // Cek duplikasi NIP di database
                    if (existingNips.has(nipValue)) rowErrors.push('NIP sudah digunakan di database');
                }

                // Validasi Username
                const username = rowData.username || rowData['Username *'];
                if (username) {
                    const usernameValue = String(username).trim();
                    if (usernameValue.length < 4) rowErrors.push('Username minimal 4 karakter');
                    if (usernameValue.length > 50) rowErrors.push('Username maksimal 50 karakter');
                    if (!/^[a-z0-9._-]+$/.test(usernameValue)) rowErrors.push('Username harus huruf kecil, angka, titik, underscore, strip');

                    // Cek duplikasi username dalam file
                    const duplicateUsername = valid.find(v => v.username === usernameValue);
                    if (duplicateUsername) rowErrors.push('Username duplikat dalam file');

                    // Cek duplikasi username di database
                    if (existingUsernames.has(usernameValue)) rowErrors.push('Username sudah digunakan di database');
                }

                // Validasi Password
                const password = rowData.password || rowData['Password *'];
                if (password && String(password).trim().length < 6) {
                    rowErrors.push('Password minimal 6 karakter');
                }

                // Validasi email
                const email = rowData.email || rowData.Email;
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                    rowErrors.push('Format email tidak valid');
                }

                // Validasi jenis kelamin
                const jenisKelamin = rowData.jenis_kelamin || rowData['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin).toUpperCase())) {
                    rowErrors.push('Jenis kelamin harus L atau P');
                }

                // Validasi no telepon
                const noTelp = rowData.no_telp || rowData['No. Telepon'];
                if (noTelp && String(noTelp).length < 10) {
                    rowErrors.push('Nomor telepon minimal 10 digit');
                }

                // Validasi status
                const status = rowData.status || rowData.Status;
                if (status && !['aktif', 'nonaktif'].includes(String(status).toLowerCase())) {
                    rowErrors.push('Status harus aktif atau nonaktif');
                }

                if (rowErrors.length) {
                    const rowPreview = {
                        nama: rowData.nama || rowData['Nama Lengkap *'] || '(kosong)',
                        username: rowData.username || rowData['Username *'] || '(kosong)',
                        nip: rowData.nip || rowData['NIP *'] || '(kosong)'
                    };
                    errors.push({ index: rowNum, errors: rowErrors, data: rowPreview });
                } else {
                    valid.push({
                        nama: String(rowData.nama || rowData['Nama Lengkap *']).trim(),
                        nip: String(nip).trim(),
                        username: String(username).trim(),
                        password: String(password).trim(),
                        email: email ? String(email).trim() : null,
                        no_telp: noTelp ? String(noTelp).trim() : null,
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
                        mata_pelajaran: (rowData.mata_pelajaran || rowData['Mata Pelajaran']) ? String(rowData.mata_pelajaran || rowData['Mata Pelajaran']).trim() : null,
                        alamat: (rowData.alamat || rowData.Alamat) ? String(rowData.alamat || rowData.Alamat).trim() : null,
                        status: status ? String(status) : 'aktif'
                    });
                }
            } catch (error) {
                const rowPreview = {
                    nama: rowData.nama || rowData['Nama Lengkap *'] || '(kosong)',
                    username: rowData.username || rowData['Username *'] || '(kosong)',
                    nip: rowData.nip || rowData['NIP *'] || '(kosong)'
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

            let successCount = 0;
            let duplicateCount = 0;

            for (const v of valid) {
                try {
                    // Cek apakah NIP sudah ada di database
                    const [existingGuru] = await conn.execute(
                        'SELECT id_guru, user_id FROM guru WHERE nip = ?',
                        [v.nip]
                    );

                    // Cek apakah username sudah ada di database
                    const [existingUser] = await conn.execute(
                        'SELECT id FROM users WHERE username = ?',
                        [v.username]
                    );

                    if (existingUser.length > 0 && !existingGuru.length) {
                        throw new Error(`Username '${v.username}' sudah digunakan oleh user lain`);
                    }

                    if (existingGuru.length > 0) {
                        // Update data guru yang sudah ada
                        await conn.execute(
                            `UPDATE guru SET 
                             nama = ?, jenis_kelamin = ?, email = ?, no_telepon = ?,
                             alamat = ?, jabatan = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                             WHERE nip = ?`,
                            [v.nama, v.jenis_kelamin, v.email, v.no_telp, v.alamat, v.mata_pelajaran, v.status, v.nip]
                        );

                        // Update data user yang sudah ada
                        const hashedPassword = await bcrypt.hash(v.password, 10);
                        await conn.execute(
                            `UPDATE users SET 
                             username = ?, password = ?, nama = ?, email = ?, 
                             updated_at = CURRENT_TIMESTAMP
                             WHERE id = ?`,
                            [v.username, hashedPassword, v.nama, v.email, existingGuru[0].user_id]
                        );

                        duplicateCount++;
                    } else {
                        // Insert user baru terlebih dahulu
                        const hashedPassword = await bcrypt.hash(v.password, 10);
                        const [userResult] = await conn.execute(
                            `INSERT INTO users (username, password, role, nama, email, status, created_at, updated_at)
                             VALUES (?, ?, 'guru', ?, ?, 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.username, hashedPassword, v.nama, v.email]
                        );

                        const userId = userResult.insertId;

                        // Insert guru baru dengan user_id
                        await conn.execute(
                            `INSERT INTO guru (nip, nama, jenis_kelamin, email, no_telepon, alamat, jabatan, user_id, status, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.nip, v.nama, v.jenis_kelamin, v.email, v.no_telp, v.alamat, v.mata_pelajaran, userId, v.status]
                        );

                        successCount++;
                    }
                } catch (insertError) {
                    logger.error('Error processing teacher account', { nama: v.nama, error: insertError.message });
                    throw insertError;
                }
            }

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
        const genderEnum = ['L', 'P'];

        // Cek duplikasi NIS di database sebelum validasi
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

        for (let i = 0; i < rows.length; i++) {
            const rowData = rows[i];
            const rowErrors = [];
            const rowNum = i + 2;

            try {
                // Validasi field wajib
                if (!rowData.nis && !rowData['NIS *']) rowErrors.push('NIS wajib diisi');
                if (!rowData.nama && !rowData['Nama Lengkap *']) rowErrors.push('Nama lengkap wajib diisi');
                if (!rowData.kelas && !rowData['Kelas *']) rowErrors.push('Kelas wajib diisi');

                // Validasi NIS
                const nis = rowData.nis || rowData['NIS *'];
                if (nis) {
                    const nisValue = String(nis).trim();
                    if (nisValue.length < 8) rowErrors.push('NIS minimal 8 karakter');
                    if (nisValue.length > 15) rowErrors.push('NIS maksimal 15 karakter');
                    if (!/^[0-9]+$/.test(nisValue)) rowErrors.push('NIS harus berupa angka');

                    // Cek duplikasi NIS dalam file
                    const duplicateNis = valid.find(v => v.nis === nisValue);
                    if (duplicateNis) rowErrors.push('NIS duplikat dalam file');

                    // Cek duplikasi NIS di database
                    if (existingNis.has(nisValue)) rowErrors.push('NIS sudah digunakan di database');
                }

                // Validasi email
                const email = rowData.email || rowData.Email;
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                    rowErrors.push('Format email tidak valid');
                }

                // Validasi jenis kelamin
                const jenisKelamin = rowData.jenis_kelamin || rowData['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin).toUpperCase())) {
                    rowErrors.push('Jenis kelamin harus L atau P');
                }

                if (rowErrors.length) {
                    // Include row data preview for easier identification
                    const rowPreview = {
                        nis: rowData.nis || rowData['NIS *'] || '(kosong)',
                        nama: rowData.nama || rowData['Nama Lengkap *'] || '(kosong)',
                        kelas: rowData.kelas || rowData['Kelas *'] || '(kosong)'
                    };
                    errors.push({ index: rowNum, errors: rowErrors, data: rowPreview });
                } else {
                    valid.push({
                        nis: String(nis).trim(),
                        nama: String(rowData.nama || rowData['Nama Lengkap *']).trim(),
                        kelas: String(rowData.kelas || rowData['Kelas *']).trim(),
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
                        telepon_orangtua: (rowData.telepon_orangtua || rowData['Telepon Orang Tua']) ? String(rowData.telepon_orangtua || rowData['Telepon Orang Tua']).trim() : null,
                        nomor_telepon_siswa: (rowData.nomor_telepon_siswa || rowData['Nomor Telepon Siswa']) ? String(rowData.nomor_telepon_siswa || rowData['Nomor Telepon Siswa']).trim() : null,
                        alamat: (rowData.alamat || rowData.Alamat) ? String(rowData.alamat || rowData.Alamat).trim() : null,
                        status: (rowData.status || rowData.Status) ? String(rowData.status || rowData.Status).trim() : 'aktif'
                    });
                }
            } catch (error) {
                const rowPreview = {
                    nis: rowData.nis || rowData['NIS *'] || '(kosong)',
                    nama: rowData.nama || rowData['Nama Lengkap *'] || '(kosong)',
                    kelas: rowData.kelas || rowData['Kelas *'] || '(kosong)'
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

        if (valid.length === 0) {
            return res.status(400).json({
                error: 'Tidak ada baris valid untuk diimpor',
                errors
            });
        }

        const conn = await globalThis.dbPool.getConnection();
        try {
            await conn.beginTransaction();

            let successCount = 0;
            let duplicateCount = 0;

            for (const v of valid) {
                try {
                    // Cari kelas_id berdasarkan nama kelas
                    const [kelasResult] = await conn.execute(
                        'SELECT id_kelas FROM kelas WHERE nama_kelas = ?',
                        [v.kelas]
                    );

                    if (kelasResult.length === 0) {
                        throw new Error(`Kelas '${v.kelas}' tidak ditemukan`);
                    }

                    const kelasId = kelasResult[0].id_kelas;

                    // Cek apakah NIS sudah ada
                    const [existingSiswa] = await conn.execute(
                        'SELECT id_siswa FROM siswa WHERE nis = ?',
                        [v.nis]
                    );

                    if (existingSiswa.length > 0) {
                        // Update data siswa yang sudah ada
                        await conn.execute(
                            `UPDATE siswa SET 
                             nama = ?, kelas_id = ?, jenis_kelamin = ?, 
                             telepon_orangtua = ?, nomor_telepon_siswa = ?, alamat = ?, status = ?, 
                             updated_at = CURRENT_TIMESTAMP
                             WHERE nis = ?`,
                            [v.nama, kelasId, v.jenis_kelamin, v.telepon_orangtua, v.nomor_telepon_siswa, v.alamat, v.status, v.nis]
                        );
                        duplicateCount++;
                    } else {
                        // Insert data siswa baru (data-only, no account)
                        await conn.execute(
                            `INSERT INTO siswa (nis, nama, kelas_id, jenis_kelamin, telepon_orangtua, nomor_telepon_siswa, alamat, status, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.nis, v.nama, kelasId, v.jenis_kelamin, v.telepon_orangtua, v.nomor_telepon_siswa, v.alamat, v.status]
                        );
                        successCount++;
                    }
                } catch (insertError) {
                    logger.error('Error processing student data', { nama: v.nama, error: insertError.message });
                    throw insertError;
                }
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
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });
        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);
        const errors = [];
        const valid = [];
        const genderEnum = ['L', 'P'];

        // Cek duplikasi NIP di database sebelum validasi
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

        for (let i = 0; i < rows.length; i++) {
            const rowData = rows[i];
            const rowErrors = [];
            const rowNum = i + 2;

            try {
                // Validasi field wajib
                if (!rowData.nip && !rowData['NIP *']) rowErrors.push('NIP wajib diisi');
                if (!rowData.nama && !rowData['Nama Lengkap *']) rowErrors.push('Nama lengkap wajib diisi');

                // Validasi NIP
                const nip = rowData.nip || rowData['NIP *'];
                if (nip) {
                    const nipValue = String(nip).trim();
                    if (nipValue.length < 8) rowErrors.push('NIP minimal 8 karakter');
                    if (nipValue.length > 20) rowErrors.push('NIP maksimal 20 karakter');

                    // Cek duplikasi NIP dalam file
                    const duplicateNip = valid.find(v => v.nip === nipValue);
                    if (duplicateNip) rowErrors.push('NIP duplikat dalam file');

                    // Cek duplikasi NIP di database
                    if (existingNips.has(nipValue)) rowErrors.push('NIP sudah digunakan di database');
                }

                // Validasi email
                const email = rowData.email || rowData.Email;
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                    rowErrors.push('Format email tidak valid');
                }

                // Validasi jenis kelamin
                const jenisKelamin = rowData.jenis_kelamin || rowData['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin).toUpperCase())) {
                    rowErrors.push('Jenis kelamin harus L atau P');
                }

                // Validasi no telepon
                const noTelp = rowData.no_telepon || rowData['No. Telepon'];
                if (noTelp && String(noTelp).length < 10) {
                    rowErrors.push('Nomor telepon minimal 10 digit');
                }

                if (rowErrors.length) {
                    const rowPreview = {
                        nip: nip || '(kosong)',
                        nama: rowData.nama || rowData['Nama Lengkap *'] || '(kosong)'
                    };
                    errors.push({ index: rowNum, errors: rowErrors, data: rowPreview });
                } else {
                    valid.push({
                        nip: String(nip).trim(),
                        nama: String(rowData.nama || rowData['Nama Lengkap *']).trim(),
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
                        email: email ? String(email).trim() : null,
                        no_telepon: noTelp ? String(noTelp).trim() : null,
                        alamat: (rowData.alamat || rowData.Alamat) ? String(rowData.alamat || rowData.Alamat).trim() : null,
                        jabatan: (rowData.jabatan || rowData.Jabatan) ? String(rowData.jabatan || rowData.Jabatan).trim() : null,
                        status: (rowData.status || rowData.Status) ? String(rowData.status || rowData.Status).trim() : 'aktif'
                    });
                }
            } catch (error) {
                const rowPreview = {
                    nip: rowData.nip || rowData['NIP *'] || '(kosong)',
                    nama: rowData.nama || rowData['Nama Lengkap *'] || '(kosong)'
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

        if (valid.length === 0) {
            return res.status(400).json({
                error: 'Tidak ada baris valid untuk diimpor',
                errors
            });
        }

        const conn = await globalThis.dbPool.getConnection();
        try {
            await conn.beginTransaction();

            let successCount = 0;
            let duplicateCount = 0;

            for (const v of valid) {
                try {
                    // Cek apakah NIP sudah ada
                    const [existingGuru] = await conn.execute(
                        'SELECT id_guru FROM guru WHERE nip = ?',
                        [v.nip]
                    );

                    if (existingGuru.length > 0) {
                        // Update data guru yang sudah ada
                        await conn.execute(
                            `UPDATE guru SET 
                             nama = ?, jenis_kelamin = ?, email = ?, no_telepon = ?,
                             alamat = ?, jabatan = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                             WHERE nip = ?`,
                            [v.nama, v.jenis_kelamin, v.email, v.no_telepon, v.alamat, v.jabatan, v.status, v.nip]
                        );
                        duplicateCount++;
                    } else {
                        // Insert data guru baru (data-only, no account)
                        await conn.execute(
                            `INSERT INTO guru (nip, nama, jenis_kelamin, email, no_telepon, alamat, jabatan, status, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.nip, v.nama, v.jenis_kelamin, v.email, v.no_telepon, v.alamat, v.jabatan, v.status]
                        );
                        successCount++;
                    }
                } catch (insertError) {
                    logger.error('Error processing guru data', insertError, { nama: v.nama });
                    throw insertError;
                }
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

