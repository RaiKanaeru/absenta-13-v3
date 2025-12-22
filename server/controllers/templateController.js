/**
 * Template Controller
 * Handles Excel template generation for admin imports
 */

import ExcelJS from 'exceljs';
import { sendErrorResponse, sendDatabaseError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Template');

// ================================================
// TEMPLATE GENERATORS - Excel templates for admin imports
// ================================================

/**
 * Generate Mapel (Subject) template
 * GET /api/admin/templates/mapel
 */
const getMapelTemplate = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetMapelTemplate', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('mapel');
        
        worksheet.columns = [
            { header: 'kode_mapel', key: 'kode_mapel', width: 20 },
            { header: 'nama_mapel', key: 'nama_mapel', width: 30 },
            { header: 'deskripsi', key: 'deskripsi', width: 40 },
            { header: 'status', key: 'status', width: 15 },
        ];
        
        worksheet.addRow({ kode_mapel: 'BING-02', nama_mapel: 'Bahasa Inggris Wajib', deskripsi: 'Contoh deskripsi', status: 'aktif' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template-mapel.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetMapelTemplate', {});
    } catch (error) {
        log.dbError('generateMapelTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template mapel' });
    }
};

/**
 * Generate Kelas (Class) template
 * GET /api/admin/templates/kelas
 */
const getKelasTemplate = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetKelasTemplate', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('kelas');
        
        worksheet.columns = [
            { header: 'nama_kelas', key: 'nama_kelas', width: 25 },
            { header: 'tingkat', key: 'tingkat', width: 10 },
            { header: 'status', key: 'status', width: 15 },
        ];
        
        worksheet.addRow({ nama_kelas: 'X IPA 3', tingkat: 'X', status: 'aktif' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template-kelas.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetKelasTemplate', {});
    } catch (error) {
        log.dbError('generateKelasTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template kelas' });
    }
};

/**
 * Generate Ruang (Room) template
 * GET /api/admin/templates/ruang
 */
const getRuangTemplate = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetRuangTemplate', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('ruang');
        
        worksheet.columns = [
            { header: 'nama_ruang', key: 'nama_ruang', width: 30 },
            { header: 'kapasitas', key: 'kapasitas', width: 15 },
            { header: 'lokasi', key: 'lokasi', width: 30 },
            { header: 'status', key: 'status', width: 15 },
        ];
        
        worksheet.addRow({ nama_ruang: 'Lab Komputer 1', kapasitas: 40, lokasi: 'Gedung A Lt. 2', status: 'aktif' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template-ruang.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetRuangTemplate', {});
    } catch (error) {
        log.dbError('generateRuangTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template ruang' });
    }
};

/**
 * Generate Jadwal (Schedule) template
 * GET /api/admin/templates/jadwal
 */
const getJadwalTemplate = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetJadwalTemplate', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('jadwal');
        
        worksheet.columns = [
            { header: 'hari', key: 'hari', width: 15 },
            { header: 'jam_ke', key: 'jam_ke', width: 10 },
            { header: 'jam_mulai', key: 'jam_mulai', width: 12 },
            { header: 'jam_selesai', key: 'jam_selesai', width: 12 },
            { header: 'kelas', key: 'kelas', width: 15 },
            { header: 'mapel', key: 'mapel', width: 25 },
            { header: 'guru', key: 'guru', width: 25 },
            { header: 'ruang', key: 'ruang', width: 20 },
        ];
        
        worksheet.addRow({ hari: 'Senin', jam_ke: 1, jam_mulai: '07:00', jam_selesai: '07:45', kelas: 'X IPA 1', mapel: 'Matematika Wajib', guru: 'Budi Santoso', ruang: 'Ruang 101' });
        
        const instruksi = workbook.addWorksheet('Instruksi');
        instruksi.columns = [{ header: 'Petunjuk Pengisian', key: 'petunjuk', width: 60 }];
        instruksi.addRow({ petunjuk: '1. Hari: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu' });
        instruksi.addRow({ petunjuk: '2. jam_ke: Angka urutan jam pelajaran (1, 2, 3, dst)' });
        instruksi.addRow({ petunjuk: '3. jam_mulai dan jam_selesai: Format HH:MM (contoh: 07:00)' });
        instruksi.addRow({ petunjuk: '4. kelas: Nama kelas yang sudah terdaftar di sistem' });
        instruksi.addRow({ petunjuk: '5. mapel: Nama mata pelajaran yang sudah terdaftar' });
        instruksi.addRow({ petunjuk: '6. guru: Nama guru yang sudah terdaftar' });
        instruksi.addRow({ petunjuk: '7. ruang: Nama ruang yang sudah terdaftar (opsional)' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template-jadwal.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetJadwalTemplate', {});
    } catch (error) {
        log.dbError('generateJadwalTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template jadwal' });
    }
};

/**
 * Generate Guru (Teacher) template
 * GET /api/admin/templates/guru
 */
const getGuruTemplate = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetGuruTemplate', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('guru');
        
        worksheet.columns = [
            { header: 'nip', key: 'nip', width: 20 },
            { header: 'nama', key: 'nama', width: 30 },
            { header: 'jenis_kelamin', key: 'jenis_kelamin', width: 15 },
            { header: 'email', key: 'email', width: 30 },
            { header: 'alamat', key: 'alamat', width: 40 },
            { header: 'no_telepon', key: 'no_telepon', width: 15 },
            { header: 'jabatan', key: 'jabatan', width: 20 },
            { header: 'status', key: 'status', width: 15 },
        ];
        
        worksheet.addRow({ nip: '198501012010011001', nama: 'Dr. Budi Santoso, M.Pd.', jenis_kelamin: 'L', email: 'budi.santoso@school.id', alamat: 'Jl. Pendidikan No. 123', no_telepon: '08123456789', jabatan: 'Guru Matematika', status: 'aktif' });
        
        const instruksi = workbook.addWorksheet('Instruksi');
        instruksi.columns = [{ header: 'Petunjuk Pengisian', key: 'petunjuk', width: 60 }];
        instruksi.addRow({ petunjuk: '1. nip: Nomor Induk Pegawai (wajib, harus unik)' });
        instruksi.addRow({ petunjuk: '2. nama: Nama lengkap guru (wajib)' });
        instruksi.addRow({ petunjuk: '3. jenis_kelamin: L (Laki-laki) atau P (Perempuan)' });
        instruksi.addRow({ petunjuk: '4. email: Alamat email (opsional)' });
        instruksi.addRow({ petunjuk: '5. alamat: Alamat tempat tinggal (opsional)' });
        instruksi.addRow({ petunjuk: '6. no_telepon: Nomor telepon (opsional)' });
        instruksi.addRow({ petunjuk: '7. jabatan: Jabatan guru (opsional)' });
        instruksi.addRow({ petunjuk: '8. status: aktif atau nonaktif (default: aktif)' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template-guru.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetGuruTemplate', {});
    } catch (error) {
        log.dbError('generateGuruTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template guru' });
    }
};

// ================================================
// EXTENDED TEMPLATES - With Reference Sheets & Guides
// ================================================

/**
 * Helper function to add kelas reference sheet with fallback
 */
const addKelasReferenceSheet = async (workbook, sheetName = 'Ref Kelas') => {
    const kelasSheet = workbook.addWorksheet(sheetName);
    kelasSheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Nama Kelas', key: 'nama', width: 30 },
        { header: 'Tingkat', key: 'tingkat', width: 15 },
        { header: 'Status', key: 'status', width: 15 }
    ];

    try {
        const [kelas] = await global.dbPool.execute('SELECT id_kelas, nama_kelas, tingkat, status FROM kelas WHERE status = "aktif" ORDER BY nama_kelas');
        kelas.forEach(k => {
            kelasSheet.addRow({ id: k.id_kelas, nama: k.nama_kelas, tingkat: k.tingkat || '', status: k.status });
        });
    } catch (dbError) {
        logger.warn('Kelas reference fallback used', { error: dbError.message });
        kelasSheet.addRow({ id: 1, nama: 'X IPA 1', tingkat: 'X', status: 'aktif' });
        kelasSheet.addRow({ id: 2, nama: 'X IPA 2', tingkat: 'X', status: 'aktif' });
        kelasSheet.addRow({ id: 3, nama: 'XI IPA 1', tingkat: 'XI', status: 'aktif' });
    }
    return kelasSheet;
};

/**
 * Student Account Template - Basic
 */
const getStudentAccountTemplateBasic = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetStudentAccountTemplateBasic', {});

    try {
        const workbook = new ExcelJS.Workbook();

        const inputSheet = workbook.addWorksheet('Data Akun Siswa');
        inputSheet.columns = [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];
        inputSheet.addRow({ nama: 'Ahmad Rizki', username: 'ahmad.rizki', password: 'Siswa123!', nis: '25001', kelas: 'X IPA 1', jabatan: 'Ketua Kelas', jenis_kelamin: 'L', email: 'ahmad.rizki@sekolah.id', telepon_orangtua: '0811223344', nomor_telepon_siswa: '0812334455', alamat: 'Jl. Melati No. 1', status: 'aktif' });

        await addKelasReferenceSheet(workbook);

        const guideSheet = workbook.addWorksheet('Panduan');
        guideSheet.columns = [{ header: 'Kolom', key: 'kolom', width: 20 }, { header: 'Deskripsi', key: 'deskripsi', width: 50 }, { header: 'Contoh', key: 'contoh', width: 30 }, { header: 'Wajib', key: 'wajib', width: 10 }];
        [{ kolom: 'nama', deskripsi: 'Nama lengkap siswa', contoh: 'Ahmad Rizki', wajib: 'Ya' },
         { kolom: 'username', deskripsi: 'Username untuk login (unik)', contoh: 'ahmad.rizki', wajib: 'Ya' },
         { kolom: 'password', deskripsi: 'Password untuk login (min 6 karakter)', contoh: 'Siswa123!', wajib: 'Ya' },
         { kolom: 'nis', deskripsi: 'Nomor Induk Siswa (unik)', contoh: '25001', wajib: 'Ya' },
         { kolom: 'kelas', deskripsi: 'Nama kelas siswa', contoh: 'X IPA 1', wajib: 'Ya' },
         { kolom: 'jenis_kelamin', deskripsi: 'L atau P', contoh: 'L', wajib: 'Ya' }
        ].forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-akun-siswa-basic.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetStudentAccountTemplateBasic', {});
    } catch (error) {
        log.dbError('generateStudentAccountTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Student Account Template - Friendly
 */
const getStudentAccountTemplateFriendly = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetStudentAccountTemplateFriendly', {});

    try {
        const workbook = new ExcelJS.Workbook();

        const inputSheet = workbook.addWorksheet('Data Akun Siswa');
        inputSheet.columns = [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        await addKelasReferenceSheet(workbook);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-akun-siswa-friendly.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetStudentAccountTemplateFriendly', {});
    } catch (error) {
        log.dbError('generateStudentAccountFriendlyTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Teacher Account Template - Basic
 */
const getTeacherAccountTemplateBasic = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetTeacherAccountTemplateBasic', {});

    try {
        const workbook = new ExcelJS.Workbook();

        const inputSheet = workbook.addWorksheet('Data Akun Guru');
        inputSheet.columns = [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telp', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];
        inputSheet.addRow({ nama: 'Budi Santoso', username: 'budi.santoso', password: 'Guru123!', nip: '198501012010011001', jenis_kelamin: 'L', email: 'budi@sekolah.id', no_telp: '081234567890', alamat: 'Jl. Pendidikan No. 1', status: 'aktif' });

        const guideSheet = workbook.addWorksheet('Panduan');
        guideSheet.columns = [{ header: 'Kolom', key: 'kolom', width: 20 }, { header: 'Deskripsi', key: 'deskripsi', width: 50 }, { header: 'Wajib', key: 'wajib', width: 10 }];
        [{ kolom: 'nama', deskripsi: 'Nama lengkap guru', wajib: 'Ya' },
         { kolom: 'username', deskripsi: 'Username untuk login (unik)', wajib: 'Ya' },
         { kolom: 'password', deskripsi: 'Password (min 6 karakter)', wajib: 'Ya' },
         { kolom: 'nip', deskripsi: 'Nomor Induk Pegawai (unik)', wajib: 'Ya' },
         { kolom: 'jenis_kelamin', deskripsi: 'L atau P', wajib: 'Ya' }
        ].forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-akun-guru-basic.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetTeacherAccountTemplateBasic', {});
    } catch (error) {
        log.dbError('generateTeacherAccountTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Teacher Account Template - Friendly
 */
const getTeacherAccountTemplateFriendly = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetTeacherAccountTemplateFriendly', {});

    try {
        const workbook = new ExcelJS.Workbook();

        const inputSheet = workbook.addWorksheet('Data Akun Guru');
        inputSheet.columns = [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telp', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-akun-guru-friendly.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetTeacherAccountTemplateFriendly', {});
    } catch (error) {
        log.dbError('generateTeacherAccountFriendlyTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Siswa Data Template - Basic (no account)
 */
const getSiswaTemplateBasic = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetSiswaTemplateBasic', {});

    try {
        const workbook = new ExcelJS.Workbook();

        const inputSheet = workbook.addWorksheet('Data Siswa');
        inputSheet.columns = [
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Nomor Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];
        inputSheet.addRow({ nis: '25001', nama: 'Ahmad Rizki', kelas: 'X IPA 1', jenis_kelamin: 'L', telepon_orangtua: '0811223344', nomor_telepon_siswa: '0812334455', alamat: 'Jl. Melati No. 1', status: 'aktif' });

        await addKelasReferenceSheet(workbook);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-data-siswa-basic.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetSiswaTemplateBasic', {});
    } catch (error) {
        log.dbError('generateSiswaTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Siswa Data Template - Friendly (no account)
 */
const getSiswaTemplateFriendly = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetSiswaTemplateFriendly', {});

    try {
        const workbook = new ExcelJS.Workbook();

        const inputSheet = workbook.addWorksheet('Data Siswa');
        inputSheet.columns = [
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Nomor Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        await addKelasReferenceSheet(workbook);

        const guideSheet = workbook.addWorksheet('Panduan');
        guideSheet.columns = [{ header: 'Kolom', key: 'kolom', width: 20 }, { header: 'Deskripsi', key: 'deskripsi', width: 50 }, { header: 'Wajib', key: 'wajib', width: 10 }];
        [{ kolom: 'nis', deskripsi: 'Nomor Induk Siswa (unik)', wajib: 'Ya' },
         { kolom: 'nama', deskripsi: 'Nama lengkap siswa', wajib: 'Ya' },
         { kolom: 'kelas', deskripsi: 'Nama kelas (lihat referensi)', wajib: 'Ya' },
         { kolom: 'jenis_kelamin', deskripsi: 'L atau P', wajib: 'Ya' }
        ].forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-data-siswa-friendly.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetSiswaTemplateFriendly', {});
    } catch (error) {
        log.dbError('generateSiswaFriendlyTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Guru Data Template - Basic (no account)
 */
const getGuruTemplateBasic = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetGuruTemplateBasic', {});

    try {
        const workbook = new ExcelJS.Workbook();

        const inputSheet = workbook.addWorksheet('Data Guru');
        inputSheet.columns = [
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telepon', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Status', key: 'status', width: 15 }
        ];
        inputSheet.addRow({ nip: '198501012010011001', nama: 'Budi Santoso', jenis_kelamin: 'L', email: 'budi@sekolah.id', no_telepon: '081234567890', alamat: 'Jl. Pendidikan No. 1', jabatan: 'Guru Matematika', status: 'aktif' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-data-guru-basic.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetGuruTemplateBasic', {});
    } catch (error) {
        log.dbError('generateGuruTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Guru Data Template - Friendly (no account)
 */
const getGuruTemplateFriendly = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetGuruTemplateFriendly', {});

    try {
        const workbook = new ExcelJS.Workbook();

        const inputSheet = workbook.addWorksheet('Data Guru');
        inputSheet.columns = [
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telepon', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Mata Pelajaran', key: 'mata_pelajaran', width: 25 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        const guideSheet = workbook.addWorksheet('Panduan');
        guideSheet.columns = [{ header: 'Kolom', key: 'kolom', width: 20 }, { header: 'Deskripsi', key: 'deskripsi', width: 50 }, { header: 'Wajib', key: 'wajib', width: 10 }];
        [{ kolom: 'nip', deskripsi: 'Nomor Induk Pegawai (unik)', wajib: 'Ya' },
         { kolom: 'nama', deskripsi: 'Nama lengkap guru', wajib: 'Ya' },
         { kolom: 'jenis_kelamin', deskripsi: 'L atau P', wajib: 'Ya' }
        ].forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-data-guru-friendly.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetGuruTemplateFriendly', {});
    } catch (error) {
        log.dbError('generateGuruFriendlyTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Mapel Template - Basic
 */
const getMapelTemplateBasic = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetMapelTemplateBasic', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const inputSheet = workbook.addWorksheet('Data Mapel');
        inputSheet.columns = [
            { header: 'kode_mapel', key: 'kode_mapel', width: 15 },
            { header: 'nama_mapel', key: 'nama_mapel', width: 25 },
            { header: 'deskripsi', key: 'deskripsi', width: 30 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-mapel-basic.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetMapelTemplateBasic', {});
    } catch (error) {
        log.dbError('generateMapelBasicTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Mapel Template - Friendly
 */
const getMapelTemplateFriendly = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetMapelTemplateFriendly', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const inputSheet = workbook.addWorksheet('Data Mapel');
        inputSheet.columns = [
            { header: 'Kode Mapel', key: 'kode_mapel', width: 15 },
            { header: 'Nama Mapel', key: 'nama_mapel', width: 25 },
            { header: 'Deskripsi', key: 'deskripsi', width: 30 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-mapel-friendly.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetMapelTemplateFriendly', {});
    } catch (error) {
        log.dbError('generateMapelFriendlyTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Kelas Template - Basic
 */
const getKelasTemplateBasic = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetKelasTemplateBasic', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const inputSheet = workbook.addWorksheet('Data Kelas');
        inputSheet.columns = [
            { header: 'nama_kelas', key: 'nama_kelas', width: 25 },
            { header: 'tingkat', key: 'tingkat', width: 10 },
            { header: 'jurusan', key: 'jurusan', width: 20 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-kelas-basic.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetKelasTemplateBasic', {});
    } catch (error) {
        log.dbError('generateKelasBasicTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Kelas Template - Friendly
 */
const getKelasTemplateFriendly = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetKelasTemplateFriendly', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const inputSheet = workbook.addWorksheet('Data Kelas');
        inputSheet.columns = [
            { header: 'Nama Kelas', key: 'nama_kelas', width: 25 },
            { header: 'Tingkat', key: 'tingkat', width: 10 },
            { header: 'Jurusan', key: 'jurusan', width: 20 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-kelas-friendly.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetKelasTemplateFriendly', {});
    } catch (error) {
        log.dbError('generateKelasFriendlyTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Ruang Template - Basic
 */
const getRuangTemplateBasic = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetRuangTemplateBasic', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const inputSheet = workbook.addWorksheet('Data Ruang');
        inputSheet.columns = [
            { header: 'kode_ruang', key: 'kode_ruang', width: 15 },
            { header: 'nama_ruang', key: 'nama_ruang', width: 25 },
            { header: 'kapasitas', key: 'kapasitas', width: 12 },
            { header: 'lokasi', key: 'lokasi', width: 30 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-ruang-basic.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetRuangTemplateBasic', {});
    } catch (error) {
        log.dbError('generateRuangBasicTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Ruang Template - Friendly
 */
const getRuangTemplateFriendly = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetRuangTemplateFriendly', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const inputSheet = workbook.addWorksheet('Data Ruang');
        inputSheet.columns = [
            { header: 'Kode Ruang', key: 'kode_ruang', width: 15 },
            { header: 'Nama Ruang', key: 'nama_ruang', width: 25 },
            { header: 'Kapasitas', key: 'kapasitas', width: 12 },
            { header: 'Lokasi', key: 'lokasi', width: 30 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-ruang-friendly.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetRuangTemplateFriendly', {});
    } catch (error) {
        log.dbError('generateRuangFriendlyTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Helper to add reference sheets for jadwal template
 */
const addJadwalReferenceSheets = async (workbook) => {
    try {
        const [kelas] = await global.dbPool.execute('SELECT id_kelas, nama_kelas FROM kelas WHERE status = "aktif"');
        const kelasSheet = workbook.addWorksheet('Ref Kelas');
        kelasSheet.addRow(['ID', 'Nama Kelas']);
        kelas.forEach(k => kelasSheet.addRow([k.id_kelas, k.nama_kelas]));

        const [mapel] = await global.dbPool.execute('SELECT id_mapel, nama_mapel FROM mapel WHERE status = "aktif"');
        const mapelSheet = workbook.addWorksheet('Ref Mapel');
        mapelSheet.addRow(['ID', 'Nama Mapel']);
        mapel.forEach(m => mapelSheet.addRow([m.id_mapel, m.nama_mapel]));

        const [guru] = await global.dbPool.execute('SELECT id_guru, nama, nip FROM guru WHERE status = "aktif"');
        const guruSheet = workbook.addWorksheet('Ref Guru');
        guruSheet.addRow(['ID', 'Nama', 'NIP']);
        guru.forEach(g => guruSheet.addRow([g.id_guru, g.nama, g.nip]));

        const [ruang] = await global.dbPool.execute('SELECT id_ruang, kode_ruang, nama_ruang FROM ruang_kelas WHERE status = "aktif"');
        const ruangSheet = workbook.addWorksheet('Ref Ruang');
        ruangSheet.addRow(['ID', 'Kode Ruang', 'Nama Ruang']);
        ruang.forEach(r => ruangSheet.addRow([r.id_ruang, r.kode_ruang, r.nama_ruang]));
    } catch (error) {
        logger.warn('Jadwal reference sheets failed', { error: error.message });
    }
};

/**
 * Jadwal Template - Basic
 */
const getJadwalTemplateBasic = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetJadwalTemplateBasic', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const inputSheet = workbook.addWorksheet('Data Jadwal');
        inputSheet.columns = [
            { header: 'kelas_id', key: 'kelas_id', width: 12 },
            { header: 'mapel_id', key: 'mapel_id', width: 12 },
            { header: 'guru_id', key: 'guru_id', width: 12 },
            { header: 'ruang_id', key: 'ruang_id', width: 12 },
            { header: 'hari', key: 'hari', width: 15 },
            { header: 'jam_ke', key: 'jam_ke', width: 10 },
            { header: 'jam_mulai', key: 'jam_mulai', width: 12 },
            { header: 'jam_selesai', key: 'jam_selesai', width: 12 },
            { header: 'jenis_aktivitas', key: 'jenis_aktivitas', width: 18 },
            { header: 'keterangan_khusus', key: 'keterangan_khusus', width: 25 }
        ];

        await addJadwalReferenceSheets(workbook);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-jadwal-basic.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetJadwalTemplateBasic', {});
    } catch (error) {
        log.dbError('generateJadwalBasicTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

/**
 * Jadwal Template - Friendly
 */
const getJadwalTemplateFriendly = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetJadwalTemplateFriendly', {});

    try {
        const workbook = new ExcelJS.Workbook();
        const inputSheet = workbook.addWorksheet('Data Jadwal');
        inputSheet.columns = [
            { header: 'Kelas', key: 'kelas', width: 20 },
            { header: 'Mata Pelajaran', key: 'mapel', width: 25 },
            { header: 'Guru', key: 'guru', width: 25 },
            { header: 'Ruang', key: 'ruang', width: 20 },
            { header: 'Hari', key: 'hari', width: 15 },
            { header: 'Jam Ke', key: 'jam_ke', width: 10 },
            { header: 'Jam Mulai', key: 'jam_mulai', width: 12 },
            { header: 'Jam Selesai', key: 'jam_selesai', width: 12 },
            { header: 'Guru Tambahan', key: 'guru_tambahan', width: 25 }
        ];

        await addJadwalReferenceSheets(workbook);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-jadwal-friendly.xlsx');
        await workbook.xlsx.write(res);
        res.end();
        log.success('GetJadwalTemplateFriendly', {});
    } catch (error) {
        log.dbError('generateJadwalFriendlyTemplate', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

// ES Module exports
export {
    // Original simple templates
    getMapelTemplate,
    getKelasTemplate,
    getRuangTemplate,
    getJadwalTemplate,
    getGuruTemplate,
    // Extended templates with reference sheets
    getStudentAccountTemplateBasic,
    getStudentAccountTemplateFriendly,
    getTeacherAccountTemplateBasic,
    getTeacherAccountTemplateFriendly,
    getSiswaTemplateBasic,
    getSiswaTemplateFriendly,
    getGuruTemplateBasic,
    getGuruTemplateFriendly,
    getMapelTemplateBasic,
    getMapelTemplateFriendly,
    getKelasTemplateBasic,
    getKelasTemplateFriendly,
    getRuangTemplateBasic,
    getRuangTemplateFriendly,
    getJadwalTemplateBasic,
    getJadwalTemplateFriendly
};
