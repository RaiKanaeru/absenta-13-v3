/**
 * Import Controller
 * Handles Excel import for mapel, kelas, ruang, jadwal, students, teachers
 * Migrated from server_modern.js - Batch 16
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
    validateTimeFormat,
    validateTimeLogic
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
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kode_mapel');

        const errors = [];
        const valid = [];
        const seenKode = new Set();

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                // Validasi umum - perbaiki field mapping
                const kodeMapel = r.kode_mapel || r['Kode Mapel'] || r['kode_mapel'];
                const namaMapel = r.nama_mapel || r['Nama Mapel'] || r['nama_mapel'];
                const deskripsi = r.deskripsi || r.Deskripsi || r['deskripsi'];
                const status = r.status || r.Status || r['status'];

                if (!kodeMapel) rowErrors.push('kode_mapel wajib');
                if (!namaMapel) rowErrors.push('nama_mapel wajib');

                if (status && !['aktif', 'nonaktif'].includes(String(status))) {
                    rowErrors.push('status tidak valid');
                }

                if (kodeMapel) {
                    const k = String(kodeMapel).trim();
                    if (seenKode.has(k)) {
                        rowErrors.push('kode_mapel duplikat di file');
                    }
                    seenKode.add(k);
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        kode_mapel: String(kodeMapel).trim(),
                        nama_mapel: String(namaMapel).trim(),
                        deskripsi: deskripsi ? String(deskripsi).trim() : null,
                        status: status ? String(status).trim() : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
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

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const v of valid) {
                await conn.execute(
                    `INSERT INTO mapel (kode_mapel, nama_mapel, deskripsi, status)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE nama_mapel = VALUES(nama_mapel), deskripsi = VALUES(deskripsi), status = VALUES(status)`,
                    [v.kode_mapel, v.nama_mapel, v.deskripsi, v.status]
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
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('nama_kelas');

        const errors = [];
        const valid = [];
        const seenNama = new Set();

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2;

            try {
                const namaKelas = r.nama_kelas || r['Nama Kelas'];
                const tingkat = r.tingkat || r.Tingkat;
                const status = r.status || r.Status;

                if (!namaKelas) rowErrors.push('nama_kelas wajib');

                if (status && !['aktif', 'nonaktif'].includes(String(status))) {
                    rowErrors.push('status tidak valid');
                }

                if (namaKelas) {
                    const k = String(namaKelas).trim();
                    if (seenNama.has(k)) {
                        rowErrors.push('nama_kelas duplikat di file');
                    }
                    seenNama.add(k);
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        nama_kelas: String(namaKelas).trim(),
                        tingkat: tingkat ? String(tingkat).trim() : null,
                        status: status ? String(status).trim() : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
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

        const conn = await global.dbPool.getConnection();
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
        console.error('❌ Import kelas error:', err);
        res.status(500).json({ error: 'Gagal impor kelas' });
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
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kode_ruang');

        const errors = [];
        const valid = [];
        const seenKode = new Set();

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2;

            try {
                const kodeRuang = r.kode_ruang || r['Kode Ruang'];
                const namaRuang = r.nama_ruang || r['Nama Ruang'];
                const lokasi = r.lokasi || r.Lokasi;
                const kapasitas = r.kapasitas || r.Kapasitas;
                const status = r.status || r.Status;

                if (!kodeRuang) rowErrors.push('kode_ruang wajib');
                if (!namaRuang) rowErrors.push('nama_ruang wajib');

                if (status && !['aktif', 'nonaktif'].includes(String(status))) {
                    rowErrors.push('status tidak valid');
                }

                if (kapasitas && isNaN(Number(kapasitas))) {
                    rowErrors.push('kapasitas harus berupa angka');
                }

                if (kodeRuang) {
                    const k = String(kodeRuang).trim();
                    if (seenKode.has(k)) {
                        rowErrors.push('kode_ruang duplikat di file');
                    }
                    seenKode.add(k);
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
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
                errors.push({ index: rowNum, errors: [error.message] });
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

        const conn = await global.dbPool.getConnection();
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
        console.error('❌ Import ruang error:', err);
        res.status(500).json({ error: 'Gagal impor ruang' });
    }
};

// ================================================
// IMPORT JADWAL (Schedule) - Complex Multi-Guru Support
// ================================================

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
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kelas_id');

        const errors = [];
        const valid = [];
        const allowedDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                let kelas_id, mapel_id, guru_id, ruang_id;
                let guru_ids_array = [];

                if (isBasicFormat) {
                    // Format biasa - langsung pakai ID
                    kelas_id = r.kelas_id;
                    mapel_id = r.mapel_id || null;
                    guru_id = r.guru_id || null;
                    ruang_id = r.ruang_id || null;

                    // Dukungan multi-guru via kolom guru_ids (comma-separated IDs)
                    if (r.guru_ids) {
                        const raw = String(r.guru_ids).split(',');
                        guru_ids_array = raw
                            .map(v => Number(String(v).trim()))
                            .filter(v => Number.isFinite(v));
                    }
                } else {
                    // Format friendly - mapping nama ke ID
                    kelas_id = await mapKelasByName(r.Kelas || r.kelas);
                    mapel_id = await mapMapelByName(r['Mata Pelajaran'] || r.mapel);
                    
                    // Bisa multi nama guru dipisah koma dari kolom Guru
                    if (r.Guru || r.guru) {
                        const guruNames = String(r.Guru || r.guru)
                            .split(',')
                            .map(s => s.trim())
                            .filter(s => s.length > 0);
                        for (const name of guruNames) {
                            const gid = await mapGuruByName(name);
                            if (gid) guru_ids_array.push(Number(gid));
                        }
                    }

                    // Dukungan guru tambahan dari kolom "Guru Tambahan"
                    if (r['Guru Tambahan'] || r.guru_tambahan) {
                        const guruTambahanNames = String(r['Guru Tambahan'] || r.guru_tambahan)
                            .split(',')
                            .map(s => s.trim())
                            .filter(s => s.length > 0);
                        for (const name of guruTambahanNames) {
                            const gid = await mapGuruByName(name);
                            if (gid && !guru_ids_array.includes(Number(gid))) {
                                guru_ids_array.push(Number(gid));
                            }
                        }
                    }
                    
                    // Jika tidak ada daftar, fallback single guru
                    if (guru_ids_array.length === 0) {
                        guru_id = await mapGuruByName(r.Guru || r.guru);
                    } else {
                        guru_id = guru_ids_array[0];
                    }
                    ruang_id = await mapRuangByKode(r['Kode Ruang'] || r.ruang);

                    // Validasi mapping
                    if (!kelas_id) {
                        rowErrors.push(`Kelas "${r.Kelas || r.kelas}" tidak ditemukan`);
                    }

                    const jenisAktivitas = r.jenis_aktivitas || r['Jenis Aktivitas'] || 'pelajaran';
                    if (jenisAktivitas === 'pelajaran') {
                        // Untuk pelajaran, mata pelajaran dan guru wajib
                        if (!mapel_id) {
                            rowErrors.push(`Mata pelajaran "${r['Mata Pelajaran'] || r.mapel}" tidak ditemukan`);
                        }
                        // Minimal 1 guru (dari guru_id atau guru_ids)
                        if (!guru_id && guru_ids_array.length === 0) {
                            rowErrors.push(`Guru "${r.Guru || r.guru || r.guru_ids}" tidak ditemukan`);
                        }
                    } else {
                        // Untuk non-pelajaran, mata pelajaran dan guru opsional
                        // Keterangan khusus wajib untuk non-pelajaran
                        const keteranganKhusus = r.keterangan_khusus || r['Keterangan Khusus'] || r['keterangan_khusus'];
                        if (!keteranganKhusus || keteranganKhusus.trim() === '') {
                            rowErrors.push(`Keterangan khusus wajib untuk jenis aktivitas "${jenisAktivitas}"`);
                        }
                    }
                }

                // Validasi umum - perbaiki field mapping
                if (!r.hari && !r.Hari && !r['hari']) rowErrors.push('hari wajib');
                if (!r.jam_ke && !r['Jam Ke'] && !r['jam_ke']) rowErrors.push('jam_ke wajib');
                if (!r.jam_mulai && !r['Jam Mulai'] && !r['jam_mulai']) rowErrors.push('jam_mulai wajib');
                if (!r.jam_selesai && !r['Jam Selesai'] && !r['jam_selesai']) rowErrors.push('jam_selesai wajib');

                const hari = r.hari || r.Hari || r['hari'];
                if (hari && !allowedDays.includes(String(hari))) {
                    rowErrors.push('hari tidak valid');
                }

                // Validasi format jam 24 jam
                const jamMulai = r.jam_mulai || r['Jam Mulai'] || r['jam_mulai'];
                const jamSelesai = r.jam_selesai || r['Jam Selesai'] || r['jam_selesai'];

                if (jamMulai && !validateTimeFormat(String(jamMulai))) {
                    rowErrors.push(`Format jam mulai "${jamMulai}" tidak valid. Gunakan format 24 jam (HH:MM)`);
                }

                if (jamSelesai && !validateTimeFormat(String(jamSelesai))) {
                    rowErrors.push(`Format jam selesai "${jamSelesai}" tidak valid. Gunakan format 24 jam (HH:MM)`);
                }

                // Validasi logika waktu
                if (jamMulai && jamSelesai && validateTimeFormat(String(jamMulai)) && validateTimeFormat(String(jamSelesai))) {
                    const timeValidation = validateTimeLogic(String(jamMulai), String(jamSelesai));
                    if (!timeValidation.valid) {
                        rowErrors.push(timeValidation.error);
                    }
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    const jenisAktivitas = r.jenis_aktivitas || r['Jenis Aktivitas'] || r['jenis_aktivitas'] || 'pelajaran';
                    const isAbsenable = jenisAktivitas === 'pelajaran' ? 1 : 0;
                    const keteranganKhusus = r.keterangan_khusus || r['Keterangan Khusus'] || r['keterangan_khusus'] || null;
                    
                    // Normalisasi guru_ids untuk kedua format
                    if (guru_ids_array.length === 0 && r.guru_ids) {
                        const raw = String(r.guru_ids).split(',');
                        guru_ids_array = raw
                            .map(v => Number(String(v).trim()))
                            .filter(v => Number.isFinite(v));
                    }
                    
                    // Hilangkan duplikasi & pastikan primary di index 0 jika ada
                    const uniqueGuruIds = Array.from(new Set(guru_ids_array));
                    const primaryGuru = (guru_id ? Number(guru_id) : (uniqueGuruIds[0] || null));

                    valid.push({
                        kelas_id: Number(kelas_id),
                        mapel_id: mapel_id ? Number(mapel_id) : null,
                        guru_id: primaryGuru ? Number(primaryGuru) : null,
                        ruang_id: ruang_id ? Number(ruang_id) : null,
                        hari: String(hari),
                        jam_ke: Number(r.jam_ke || r['Jam Ke'] || r['jam_ke']),
                        jam_mulai: String(r.jam_mulai || r['Jam Mulai'] || r['jam_mulai']),
                        jam_selesai: String(r.jam_selesai || r['Jam Selesai'] || r['jam_selesai']),
                        jenis_aktivitas: jenisAktivitas,
                        is_absenable: isAbsenable,
                        keterangan_khusus: keteranganKhusus,
                        status: 'aktif',
                        guru_ids: uniqueGuruIds
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
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

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const v of valid) {
                const [insertRes] = await conn.execute(
                    `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [v.kelas_id, v.mapel_id, v.guru_id, v.ruang_id, v.hari, v.jam_ke, v.jam_mulai, v.jam_selesai, v.status, v.jenis_aktivitas, v.is_absenable, v.keterangan_khusus]
                );
                const jadwalId = insertRes && insertRes.insertId ? insertRes.insertId : null;
                
                // Jika pelajaran dan ada guru_ids, isi tabel relasi jadwal_guru
                if (jadwalId && v.jenis_aktivitas === 'pelajaran' && Array.isArray(v.guru_ids) && v.guru_ids.length > 0) {
                    for (let idx = 0; idx < v.guru_ids.length; idx++) {
                        const gid = v.guru_ids[idx];
                        await conn.execute(
                            'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, ?)',
                            [jadwalId, gid, idx === 0 ? 1 : 0]
                        );
                    }
                    if (v.guru_ids.length > 1) {
                        await conn.execute('UPDATE jadwal SET is_multi_guru = 1 WHERE id_jadwal = ?', [jadwalId]);
                    }
                }
            }
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted: valid.length, invalid: errors.length, errors });
    } catch (err) {
        console.error('❌ Import jadwal error:', err);
        res.status(500).json({ error: 'Gagal impor jadwal' });
    }
};

// ================================================
// IMPORT STUDENT ACCOUNT (with bcrypt password hashing)
// ================================================

/**
 * Import student accounts from Excel file
 * POST /api/admin/import/student-account
 */
const importStudentAccount = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        // console.log();

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // console.log();

        const errors = [];
        const valid = [];
        const genderEnum = ['L', 'P'];

        // Cek duplikasi username dan NIS di database sebelum validasi
        const existingUsernames = new Set();
        const existingNis = new Set();

        try {
            const [dbUsernames] = await global.dbPool.execute('SELECT username FROM users WHERE role = "siswa"');
            const [dbNis] = await global.dbPool.execute('SELECT nis FROM siswa');

            dbUsernames.forEach(row => existingUsernames.add(row.username));
            dbNis.forEach(row => existingNis.add(row.nis));
        } catch (dbError) {
            console.error('Error checking existing data:', dbError);
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                // Validasi field wajib
                if (!r.nama && !r['Nama Lengkap *']) rowErrors.push('Nama lengkap wajib diisi');
                if (!r.username && !r['Username *']) rowErrors.push('Username wajib diisi');
                if (!r.password && !r['Password *']) rowErrors.push('Password wajib diisi');
                if (!r.nis && !r['NIS *']) rowErrors.push('NIS wajib diisi');
                if (!r.kelas && !r['Kelas *']) rowErrors.push('Kelas wajib diisi');

                // Validasi NIS
                const nis = r.nis || r['NIS *'];
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

                // Validasi Username
                const username = r.username || r['Username *'];
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
                const password = r.password || r['Password *'];
                if (password && String(password).trim().length < 6) {
                    rowErrors.push('Password minimal 6 karakter');
                }

                // Validasi email
                const email = r.email || r.Email;
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                    rowErrors.push('Format email tidak valid');
                }

                // Validasi jenis kelamin
                const jenisKelamin = r.jenis_kelamin || r['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin).toUpperCase())) {
                    rowErrors.push('Jenis kelamin harus L atau P');
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        nama: String(r.nama || r['Nama Lengkap *']).trim(),
                        username: String(username).trim(),
                        password: String(password).trim(),
                        nis: String(nis).trim(),
                        kelas: String(r.kelas || r['Kelas *']).trim(),
                        jabatan: (r.jabatan || r.Jabatan) ? String(r.jabatan || r.Jabatan).trim() : null,
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
                        email: email ? String(email).trim() : null
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
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

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();

            let successCount = 0;
            let duplicateCount = 0;

            for (const v of valid) {
                try {
                    // Cek apakah NIS sudah ada di database
                    const [existingSiswa] = await conn.execute(
                        'SELECT id_siswa, user_id FROM siswa WHERE nis = ?',
                        [v.nis]
                    );

                    // Cek apakah username sudah ada di database
                    const [existingUser] = await conn.execute(
                        'SELECT id FROM users WHERE username = ?',
                        [v.username]
                    );

                    if (existingUser.length > 0 && !existingSiswa.length) {
                        throw new Error(`Username '${v.username}' sudah digunakan oleh user lain`);
                    }

                    // Cari kelas_id berdasarkan nama kelas
                    const [kelasResult] = await conn.execute(
                        'SELECT id_kelas FROM kelas WHERE nama_kelas = ?',
                        [v.kelas]
                    );

                    if (kelasResult.length === 0) {
                        throw new Error(`Kelas '${v.kelas}' tidak ditemukan`);
                    }

                    const kelasId = kelasResult[0].id_kelas;

                    if (existingSiswa.length > 0) {
                        // Update data siswa yang sudah ada
                        await conn.execute(
                            `UPDATE siswa SET 
                             nama = ?, kelas_id = ?, jenis_kelamin = ?, email = ?, 
                             jabatan = ?, updated_at = CURRENT_TIMESTAMP
                             WHERE nis = ?`,
                            [v.nama, kelasId, v.jenis_kelamin, v.email, v.jabatan, v.nis]
                        );

                        // Update data user yang sudah ada
                        const hashedPassword = await bcrypt.hash(v.password, 10);
                        await conn.execute(
                            `UPDATE users SET 
                             username = ?, password = ?, nama = ?, email = ?, 
                             updated_at = CURRENT_TIMESTAMP
                             WHERE id = ?`,
                            [v.username, hashedPassword, v.nama, v.email, existingSiswa[0].user_id]
                        );

                        duplicateCount++;
                    } else {
                        // Insert user baru terlebih dahulu
                        const hashedPassword = await bcrypt.hash(v.password, 10);
                        const [userResult] = await conn.execute(
                            `INSERT INTO users (username, password, role, nama, email, status, created_at, updated_at)
                             VALUES (?, ?, 'siswa', ?, ?, 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.username, hashedPassword, v.nama, v.email]
                        );

                        const userId = userResult.insertId;

                        // Insert siswa baru dengan user_id
                        await conn.execute(
                            `INSERT INTO siswa (nis, nama, kelas_id, jenis_kelamin, email, jabatan, user_id, status, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.nis, v.nama, kelasId, v.jenis_kelamin, v.email, v.jabatan, userId]
                        );

                        successCount++;
                    }
                } catch (insertError) {
                    console.error(`❌ Error processing student account ${v.nama}:`, insertError);
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

        // console.log();

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // console.log();

        const errors = [];
        const valid = [];
        const genderEnum = ['L', 'P'];

        // Cek duplikasi username dan NIP di database sebelum validasi
        const existingUsernames = new Set();
        const existingNips = new Set();

        try {
            const [dbUsernames] = await global.dbPool.execute('SELECT username FROM users WHERE role = "guru"');
            const [dbNips] = await global.dbPool.execute('SELECT nip FROM guru');

            dbUsernames.forEach(row => existingUsernames.add(row.username));
            dbNips.forEach(row => existingNips.add(row.nip));
        } catch (dbError) {
            console.error('Error checking existing data:', dbError);
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2;

            try {
                // Validasi field wajib
                if (!r.nama && !r['Nama Lengkap *']) rowErrors.push('Nama lengkap wajib diisi');
                if (!r.username && !r['Username *']) rowErrors.push('Username wajib diisi');
                if (!r.password && !r['Password *']) rowErrors.push('Password wajib diisi');
                if (!r.nip && !r['NIP *']) rowErrors.push('NIP wajib diisi');

                // Validasi NIP
                const nip = r.nip || r['NIP *'];
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
                const username = r.username || r['Username *'];
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
                const password = r.password || r['Password *'];
                if (password && String(password).trim().length < 6) {
                    rowErrors.push('Password minimal 6 karakter');
                }

                // Validasi email
                const email = r.email || r.Email;
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                    rowErrors.push('Format email tidak valid');
                }

                // Validasi jenis kelamin
                const jenisKelamin = r.jenis_kelamin || r['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin).toUpperCase())) {
                    rowErrors.push('Jenis kelamin harus L atau P');
                }

                // Validasi no telepon
                const noTelp = r.no_telp || r['No. Telepon'];
                if (noTelp && String(noTelp).length < 10) {
                    rowErrors.push('Nomor telepon minimal 10 digit');
                }

                // Validasi status
                const status = r.status || r.Status;
                if (status && !['aktif', 'nonaktif'].includes(String(status).toLowerCase())) {
                    rowErrors.push('Status harus aktif atau nonaktif');
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        nama: String(r.nama || r['Nama Lengkap *']).trim(),
                        nip: String(nip).trim(),
                        username: String(username).trim(),
                        password: String(password).trim(),
                        email: email ? String(email).trim() : null,
                        no_telp: noTelp ? String(noTelp).trim() : null,
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
                        mata_pelajaran: (r.mata_pelajaran || r['Mata Pelajaran']) ? String(r.mata_pelajaran || r['Mata Pelajaran']).trim() : null,
                        alamat: (r.alamat || r.Alamat) ? String(r.alamat || r.Alamat).trim() : null,
                        status: status ? String(status) : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
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

        const conn = await global.dbPool.getConnection();
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
                    console.error(`❌ Error processing teacher account ${v.nama}:`, insertError);
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

        // console.log();

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // console.log();

        const errors = [];
        const valid = [];
        const genderEnum = ['L', 'P'];

        // Cek duplikasi NIS di database sebelum validasi
        const existingNis = new Set();

        try {
            const [dbNis] = await global.dbPool.execute('SELECT nis FROM siswa');
            dbNis.forEach(row => existingNis.add(row.nis));
        } catch (dbError) {
            console.error('Error checking existing data:', dbError);
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2;

            try {
                // Validasi field wajib
                if (!r.nis && !r['NIS *']) rowErrors.push('NIS wajib diisi');
                if (!r.nama && !r['Nama Lengkap *']) rowErrors.push('Nama lengkap wajib diisi');
                if (!r.kelas && !r['Kelas *']) rowErrors.push('Kelas wajib diisi');

                // Validasi NIS
                const nis = r.nis || r['NIS *'];
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
                const email = r.email || r.Email;
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                    rowErrors.push('Format email tidak valid');
                }

                // Validasi jenis kelamin
                const jenisKelamin = r.jenis_kelamin || r['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin).toUpperCase())) {
                    rowErrors.push('Jenis kelamin harus L atau P');
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        nis: String(nis).trim(),
                        nama: String(r.nama || r['Nama Lengkap *']).trim(),
                        kelas: String(r.kelas || r['Kelas *']).trim(),
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
                        telepon_orangtua: (r.telepon_orangtua || r['Telepon Orang Tua']) ? String(r.telepon_orangtua || r['Telepon Orang Tua']).trim() : null,
                        nomor_telepon_siswa: (r.nomor_telepon_siswa || r['Nomor Telepon Siswa']) ? String(r.nomor_telepon_siswa || r['Nomor Telepon Siswa']).trim() : null,
                        alamat: (r.alamat || r.Alamat) ? String(r.alamat || r.Alamat).trim() : null,
                        status: (r.status || r.Status) ? String(r.status || r.Status).trim() : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
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

        const conn = await global.dbPool.getConnection();
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
                    console.error(`❌ Error processing student data ${v.nama}:`, insertError);
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

        // console.log();

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // console.log();

        const errors = [];
        const valid = [];
        const genderEnum = ['L', 'P'];

        // Cek duplikasi NIP di database sebelum validasi
        const existingNips = new Set();

        try {
            const [dbNips] = await global.dbPool.execute('SELECT nip FROM guru');
            dbNips.forEach(row => existingNips.add(row.nip));
        } catch (dbError) {
            console.error('Error checking existing data:', dbError);
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2;

            try {
                // Validasi field wajib
                if (!r.nip && !r['NIP *']) rowErrors.push('NIP wajib diisi');
                if (!r.nama && !r['Nama Lengkap *']) rowErrors.push('Nama lengkap wajib diisi');

                // Validasi NIP
                const nip = r.nip || r['NIP *'];
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
                const email = r.email || r.Email;
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                    rowErrors.push('Format email tidak valid');
                }

                // Validasi jenis kelamin
                const jenisKelamin = r.jenis_kelamin || r['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin).toUpperCase())) {
                    rowErrors.push('Jenis kelamin harus L atau P');
                }

                // Validasi no telepon
                const noTelp = r.no_telepon || r['No. Telepon'];
                if (noTelp && String(noTelp).length < 10) {
                    rowErrors.push('Nomor telepon minimal 10 digit');
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        nip: String(nip).trim(),
                        nama: String(r.nama || r['Nama Lengkap *']).trim(),
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
                        email: email ? String(email).trim() : null,
                        no_telepon: noTelp ? String(noTelp).trim() : null,
                        alamat: (r.alamat || r.Alamat) ? String(r.alamat || r.Alamat).trim() : null,
                        jabatan: (r.jabatan || r.Jabatan) ? String(r.jabatan || r.Jabatan).trim() : null,
                        status: (r.status || r.Status) ? String(r.status || r.Status).trim() : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
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

        const conn = await global.dbPool.getConnection();
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

