/**
 * Template Controller (Refactored)
 * Handles Excel template generation for admin imports
 * 
 * Refactored to reduce code duplication using config-based approach
 */

import ExcelJS from 'exceljs';
import { sendDatabaseError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Template');

// ================================================
// CONSTANTS - Content Types
// ================================================

const EXCEL_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ================================================
// TEMPLATE CONFIGURATIONS
// ================================================

/**
 * Column definitions for different template types
 */
const COLUMN_CONFIGS = {
    mapel: {
        basic: [
            { header: 'kode_mapel', key: 'kode_mapel', width: 15 },
            { header: 'nama_mapel', key: 'nama_mapel', width: 25 },
            { header: 'deskripsi', key: 'deskripsi', width: 30 }
        ],
        friendly: [
            { header: 'Kode Mapel', key: 'kode_mapel', width: 15 },
            { header: 'Nama Mapel', key: 'nama_mapel', width: 25 },
            { header: 'Deskripsi', key: 'deskripsi', width: 30 }
        ],
        legacy: [
            { header: 'kode_mapel', key: 'kode_mapel', width: 20 },
            { header: 'nama_mapel', key: 'nama_mapel', width: 30 },
            { header: 'deskripsi', key: 'deskripsi', width: 40 },
            { header: 'status', key: 'status', width: 15 }
        ]
    },
    kelas: {
        basic: [
            { header: 'nama_kelas', key: 'nama_kelas', width: 25 },
            { header: 'tingkat', key: 'tingkat', width: 10 },
            { header: 'jurusan', key: 'jurusan', width: 20 }
        ],
        friendly: [
            { header: 'Nama Kelas', key: 'nama_kelas', width: 25 },
            { header: 'Tingkat', key: 'tingkat', width: 10 },
            { header: 'Jurusan', key: 'jurusan', width: 20 }
        ],
        legacy: [
            { header: 'nama_kelas', key: 'nama_kelas', width: 25 },
            { header: 'tingkat', key: 'tingkat', width: 10 },
            { header: 'status', key: 'status', width: 15 }
        ]
    },
    ruang: {
        basic: [
            { header: 'kode_ruang', key: 'kode_ruang', width: 15 },
            { header: 'nama_ruang', key: 'nama_ruang', width: 25 },
            { header: 'kapasitas', key: 'kapasitas', width: 12 },
            { header: 'lokasi', key: 'lokasi', width: 30 }
        ],
        friendly: [
            { header: 'Kode Ruang', key: 'kode_ruang', width: 15 },
            { header: 'Nama Ruang', key: 'nama_ruang', width: 25 },
            { header: 'Kapasitas', key: 'kapasitas', width: 12 },
            { header: 'Lokasi', key: 'lokasi', width: 30 }
        ],
        legacy: [
            { header: 'nama_ruang', key: 'nama_ruang', width: 30 },
            { header: 'kapasitas', key: 'kapasitas', width: 15 },
            { header: 'lokasi', key: 'lokasi', width: 30 },
            { header: 'status', key: 'status', width: 15 }
        ]
    },
    siswa: {
        basic: [
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Nomor Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ],
        friendly: [
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Nomor Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ]
    },
    guru: {
        basic: [
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telepon', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Status', key: 'status', width: 15 }
        ],
        friendly: [
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telepon', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Mata Pelajaran', key: 'mata_pelajaran', width: 25 },
            { header: 'Status', key: 'status', width: 15 }
        ],
        legacy: [
            { header: 'nip', key: 'nip', width: 20 },
            { header: 'nama', key: 'nama', width: 30 },
            { header: 'jenis_kelamin', key: 'jenis_kelamin', width: 15 },
            { header: 'email', key: 'email', width: 30 },
            { header: 'alamat', key: 'alamat', width: 40 },
            { header: 'no_telepon', key: 'no_telepon', width: 15 },
            { header: 'jabatan', key: 'jabatan', width: 20 },
            { header: 'status', key: 'status', width: 15 }
        ]
    },
    studentAccount: {
        basic: [
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
        ],
        friendly: [
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
        ]
    },
    teacherAccount: {
        basic: [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telp', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ],
        friendly: [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telp', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ]
    },
    jadwal: {
        basic: [
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
        ],
        friendly: [
            { header: 'Kelas', key: 'kelas', width: 20 },
            { header: 'Mata Pelajaran', key: 'mapel', width: 25 },
            { header: 'Guru', key: 'guru', width: 25 },
            { header: 'Ruang', key: 'ruang', width: 20 },
            { header: 'Hari', key: 'hari', width: 15 },
            { header: 'Jam Ke', key: 'jam_ke', width: 10 },
            { header: 'Jam Mulai', key: 'jam_mulai', width: 12 },
            { header: 'Jam Selesai', key: 'jam_selesai', width: 12 },
            { header: 'Guru Tambahan', key: 'guru_tambahan', width: 25 }
        ],
        legacy: [
            { header: 'hari', key: 'hari', width: 15 },
            { header: 'jam_ke', key: 'jam_ke', width: 10 },
            { header: 'jam_mulai', key: 'jam_mulai', width: 12 },
            { header: 'jam_selesai', key: 'jam_selesai', width: 12 },
            { header: 'kelas', key: 'kelas', width: 15 },
            { header: 'mapel', key: 'mapel', width: 25 },
            { header: 'guru', key: 'guru', width: 25 },
            { header: 'ruang', key: 'ruang', width: 20 }
        ]
    }
};

/**
 * Sample data for templates
 */
const SAMPLE_DATA = {
    mapel: { kode_mapel: 'BING-02', nama_mapel: 'Bahasa Inggris Wajib', deskripsi: 'Contoh deskripsi', status: 'aktif' },
    kelas: { nama_kelas: 'X IPA 3', tingkat: 'X', status: 'aktif' },
    ruang: { nama_ruang: 'Lab Komputer 1', kapasitas: 40, lokasi: 'Gedung A Lt. 2', status: 'aktif' },
    siswa: { nis: '25001', nama: 'Ahmad Rizki', kelas: 'X IPA 1', jenis_kelamin: 'L', telepon_orangtua: '0811223344', nomor_telepon_siswa: '0812334455', alamat: 'Jl. Melati No. 1', status: 'aktif' },
    guru: { nip: '198501012010011001', nama: 'Budi Santoso', jenis_kelamin: 'L', email: 'budi@sekolah.id', no_telepon: '081234567890', alamat: 'Jl. Pendidikan No. 1', jabatan: 'Guru Matematika', status: 'aktif' },
    studentAccount: { nama: 'Ahmad Rizki', username: 'ahmad.rizki', password: 'Siswa123!', nis: '25001', kelas: 'X IPA 1', jabatan: 'Ketua Kelas', jenis_kelamin: 'L', email: 'ahmad.rizki@sekolah.id', telepon_orangtua: '0811223344', nomor_telepon_siswa: '0812334455', alamat: 'Jl. Melati No. 1', status: 'aktif' },
    teacherAccount: { nama: 'Budi Santoso', username: 'budi.santoso', password: 'Guru123!', nip: '198501012010011001', jenis_kelamin: 'L', email: 'budi@sekolah.id', no_telp: '081234567890', alamat: 'Jl. Pendidikan No. 1', status: 'aktif' },
    jadwal: { hari: 'Senin', jam_ke: 1, jam_mulai: '07:00', jam_selesai: '07:45', kelas: 'X IPA 1', mapel: 'Matematika Wajib', guru: 'Budi Santoso', ruang: 'Ruang 101' }
};

/**
 * Guide data for templates
 */
const GUIDE_DATA = {
    studentAccount: [
        { kolom: 'nama', deskripsi: 'Nama lengkap siswa', contoh: 'Ahmad Rizki', wajib: 'Ya' },
        { kolom: 'username', deskripsi: 'Username untuk login (unik)', contoh: 'ahmad.rizki', wajib: 'Ya' },
        { kolom: 'password', deskripsi: 'Password untuk login (min 6 karakter)', contoh: 'Siswa123!', wajib: 'Ya' },
        { kolom: 'nis', deskripsi: 'Nomor Induk Siswa (unik)', contoh: '25001', wajib: 'Ya' },
        { kolom: 'kelas', deskripsi: 'Nama kelas siswa', contoh: 'X IPA 1', wajib: 'Ya' },
        { kolom: 'jenis_kelamin', deskripsi: 'L atau P', contoh: 'L', wajib: 'Ya' }
    ],
    teacherAccount: [
        { kolom: 'nama', deskripsi: 'Nama lengkap guru', wajib: 'Ya' },
        { kolom: 'username', deskripsi: 'Username untuk login (unik)', wajib: 'Ya' },
        { kolom: 'password', deskripsi: 'Password (min 6 karakter)', wajib: 'Ya' },
        { kolom: 'nip', deskripsi: 'Nomor Induk Pegawai (unik)', wajib: 'Ya' },
        { kolom: 'jenis_kelamin', deskripsi: 'L atau P', wajib: 'Ya' }
    ],
    siswa: [
        { kolom: 'nis', deskripsi: 'Nomor Induk Siswa (unik)', wajib: 'Ya' },
        { kolom: 'nama', deskripsi: 'Nama lengkap siswa', wajib: 'Ya' },
        { kolom: 'kelas', deskripsi: 'Nama kelas (lihat referensi)', wajib: 'Ya' },
        { kolom: 'jenis_kelamin', deskripsi: 'L atau P', wajib: 'Ya' }
    ],
    guru: [
        { kolom: 'nip', deskripsi: 'Nomor Induk Pegawai (unik)', wajib: 'Ya' },
        { kolom: 'nama', deskripsi: 'Nama lengkap guru', wajib: 'Ya' },
        { kolom: 'jenis_kelamin', deskripsi: 'L atau P', wajib: 'Ya' }
    ],
    jadwal: [
        { petunjuk: '1. Hari: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu' },
        { petunjuk: '2. jam_ke: Angka urutan jam pelajaran (1, 2, 3, dst)' },
        { petunjuk: '3. jam_mulai dan jam_selesai: Format HH:MM (contoh: 07:00)' },
        { petunjuk: '4. kelas: Nama kelas yang sudah terdaftar di sistem' },
        { petunjuk: '5. mapel: Nama mata pelajaran yang sudah terdaftar' },
        { petunjuk: '6. guru: Nama guru yang sudah terdaftar' },
        { petunjuk: '7. ruang: Nama ruang yang sudah terdaftar (opsional)' }
    ],
    guruLegacy: [
        { petunjuk: '1. nip: Nomor Induk Pegawai (wajib, harus unik)' },
        { petunjuk: '2. nama: Nama lengkap guru (wajib)' },
        { petunjuk: '3. jenis_kelamin: L (Laki-laki) atau P (Perempuan)' },
        { petunjuk: '4. email: Alamat email (opsional)' },
        { petunjuk: '5. alamat: Alamat tempat tinggal (opsional)' },
        { petunjuk: '6. no_telepon: Nomor telepon (opsional)' },
        { petunjuk: '7. jabatan: Jabatan guru (opsional)' },
        { petunjuk: '8. status: aktif atau nonaktif (default: aktif)' }
    ]
};

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Set Excel response headers
 */
function setExcelHeaders(res, filename) {
    res.setHeader('Content-Type', EXCEL_CONTENT_TYPE);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

/**
 * Add kelas reference sheet with database fallback
 */
async function addKelasReferenceSheet(workbook, sheetName = 'Ref Kelas') {
    const kelasSheet = workbook.addWorksheet(sheetName);
    kelasSheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Nama Kelas', key: 'nama', width: 30 },
        { header: 'Tingkat', key: 'tingkat', width: 15 },
        { header: 'Status', key: 'status', width: 15 }
    ];

    try {
        const [kelas] = await globalThis.dbPool.execute(
            'SELECT id_kelas, nama_kelas, tingkat, status FROM kelas WHERE status = "aktif" ORDER BY nama_kelas'
        );
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
}

/**
 * Add jadwal reference sheets (kelas, mapel, guru, ruang)
 */
async function addJadwalReferenceSheets(workbook) {
    try {
        // Kelas reference
        const [kelas] = await globalThis.dbPool.execute('SELECT id_kelas, nama_kelas FROM kelas WHERE status = "aktif"');
        const kelasSheet = workbook.addWorksheet('Ref Kelas');
        kelasSheet.addRow(['ID', 'Nama Kelas']);
        kelas.forEach(k => kelasSheet.addRow([k.id_kelas, k.nama_kelas]));

        // Mapel reference
        const [mapel] = await globalThis.dbPool.execute('SELECT id_mapel, nama_mapel FROM mapel WHERE status = "aktif"');
        const mapelSheet = workbook.addWorksheet('Ref Mapel');
        mapelSheet.addRow(['ID', 'Nama Mapel']);
        mapel.forEach(m => mapelSheet.addRow([m.id_mapel, m.nama_mapel]));

        // Guru reference
        const [guru] = await globalThis.dbPool.execute('SELECT id_guru, nama, nip FROM guru WHERE status = "aktif"');
        const guruSheet = workbook.addWorksheet('Ref Guru');
        guruSheet.addRow(['ID', 'Nama', 'NIP']);
        guru.forEach(g => guruSheet.addRow([g.id_guru, g.nama, g.nip]));

        // Ruang reference
        const [ruang] = await globalThis.dbPool.execute('SELECT id_ruang, kode_ruang, nama_ruang FROM ruang_kelas WHERE status = "aktif"');
        const ruangSheet = workbook.addWorksheet('Ref Ruang');
        ruangSheet.addRow(['ID', 'Kode Ruang', 'Nama Ruang']);
        ruang.forEach(r => ruangSheet.addRow([r.id_ruang, r.kode_ruang, r.nama_ruang]));
    } catch (error) {
        logger.warn('Jadwal reference sheets failed', { error: error.message });
    }
}

/**
 * Add guide sheet to workbook
 */
function addGuideSheet(workbook, guideData, hasContoh = true) {
    const guideSheet = workbook.addWorksheet('Panduan');
    
    if (guideData[0]?.petunjuk !== undefined) {
        // Single column guide (petunjuk style)
        guideSheet.columns = [{ header: 'Petunjuk Pengisian', key: 'petunjuk', width: 60 }];
        guideData.forEach(p => guideSheet.addRow(p));
    } else if (hasContoh) {
        // Multi-column guide with contoh
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Contoh', key: 'contoh', width: 30 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];
        guideData.forEach(p => guideSheet.addRow(p));
    } else {
        // Multi-column guide without contoh
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];
        guideData.forEach(p => guideSheet.addRow(p));
    }
    return guideSheet;
}

/**
 * Generic template generator
 */
async function generateTemplate(req, res, config) {
    const { 
        logName, 
        sheetName, 
        columns, 
        sampleData, 
        filename, 
        guideData, 
        hasContoh,
        addKelasRef,
        addJadwalRef
    } = config;

    const log = logger.withRequest(req, res);
    log.requestStart(logName, {});

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);
        worksheet.columns = columns;

        // Add sample data if provided
        if (sampleData) {
            worksheet.addRow(sampleData);
        }

        // Add reference sheets
        if (addKelasRef) {
            await addKelasReferenceSheet(workbook);
        }
        if (addJadwalRef) {
            await addJadwalReferenceSheets(workbook);
        }

        // Add guide sheet if provided
        if (guideData) {
            addGuideSheet(workbook, guideData, hasContoh);
        }

        setExcelHeaders(res, filename);
        await workbook.xlsx.write(res);
        res.end();
        log.success(logName, {});
    } catch (error) {
        log.dbError(`generate${logName}`, error);
        return sendDatabaseError(res, error, 'Gagal membuat template');
    }
}

// ================================================
// LEGACY TEMPLATE HANDLERS (for backward compatibility)
// ================================================

const getMapelTemplate = (req, res) => generateTemplate(req, res, {
    logName: 'GetMapelTemplate',
    sheetName: 'mapel',
    columns: COLUMN_CONFIGS.mapel.legacy,
    sampleData: SAMPLE_DATA.mapel,
    filename: 'template-mapel.xlsx'
});

const getKelasTemplate = (req, res) => generateTemplate(req, res, {
    logName: 'GetKelasTemplate',
    sheetName: 'kelas',
    columns: COLUMN_CONFIGS.kelas.legacy,
    sampleData: SAMPLE_DATA.kelas,
    filename: 'template-kelas.xlsx'
});

const getRuangTemplate = (req, res) => generateTemplate(req, res, {
    logName: 'GetRuangTemplate',
    sheetName: 'ruang',
    columns: COLUMN_CONFIGS.ruang.legacy,
    sampleData: SAMPLE_DATA.ruang,
    filename: 'template-ruang.xlsx'
});

const getJadwalTemplate = (req, res) => generateTemplate(req, res, {
    logName: 'GetJadwalTemplate',
    sheetName: 'jadwal',
    columns: COLUMN_CONFIGS.jadwal.legacy,
    sampleData: SAMPLE_DATA.jadwal,
    filename: 'template-jadwal.xlsx',
    guideData: GUIDE_DATA.jadwal
});

const getGuruTemplate = (req, res) => generateTemplate(req, res, {
    logName: 'GetGuruTemplate',
    sheetName: 'guru',
    columns: COLUMN_CONFIGS.guru.legacy,
    sampleData: SAMPLE_DATA.guru,
    filename: 'template-guru.xlsx',
    guideData: GUIDE_DATA.guruLegacy
});

// ================================================
// EXTENDED TEMPLATE HANDLERS
// ================================================

// Student Account Templates
const getStudentAccountTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetStudentAccountTemplateBasic',
    sheetName: 'Data Akun Siswa',
    columns: COLUMN_CONFIGS.studentAccount.basic,
    sampleData: SAMPLE_DATA.studentAccount,
    filename: 'template-akun-siswa-basic.xlsx',
    addKelasRef: true,
    guideData: GUIDE_DATA.studentAccount,
    hasContoh: true
});

const getStudentAccountTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetStudentAccountTemplateFriendly',
    sheetName: 'Data Akun Siswa',
    columns: COLUMN_CONFIGS.studentAccount.friendly,
    filename: 'template-akun-siswa-friendly.xlsx',
    addKelasRef: true
});

// Teacher Account Templates
const getTeacherAccountTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetTeacherAccountTemplateBasic',
    sheetName: 'Data Akun Guru',
    columns: COLUMN_CONFIGS.teacherAccount.basic,
    sampleData: SAMPLE_DATA.teacherAccount,
    filename: 'template-akun-guru-basic.xlsx',
    guideData: GUIDE_DATA.teacherAccount,
    hasContoh: false
});

const getTeacherAccountTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetTeacherAccountTemplateFriendly',
    sheetName: 'Data Akun Guru',
    columns: COLUMN_CONFIGS.teacherAccount.friendly,
    filename: 'template-akun-guru-friendly.xlsx'
});

// Siswa Data Templates
const getSiswaTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetSiswaTemplateBasic',
    sheetName: 'Data Siswa',
    columns: COLUMN_CONFIGS.siswa.basic,
    sampleData: SAMPLE_DATA.siswa,
    filename: 'template-data-siswa-basic.xlsx',
    addKelasRef: true
});

const getSiswaTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetSiswaTemplateFriendly',
    sheetName: 'Data Siswa',
    columns: COLUMN_CONFIGS.siswa.friendly,
    filename: 'template-data-siswa-friendly.xlsx',
    addKelasRef: true,
    guideData: GUIDE_DATA.siswa,
    hasContoh: false
});

// Guru Data Templates
const getGuruTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetGuruTemplateBasic',
    sheetName: 'Data Guru',
    columns: COLUMN_CONFIGS.guru.basic,
    sampleData: SAMPLE_DATA.guru,
    filename: 'template-data-guru-basic.xlsx'
});

const getGuruTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetGuruTemplateFriendly',
    sheetName: 'Data Guru',
    columns: COLUMN_CONFIGS.guru.friendly,
    filename: 'template-data-guru-friendly.xlsx',
    guideData: GUIDE_DATA.guru,
    hasContoh: false
});

// Mapel Templates
const getMapelTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetMapelTemplateBasic',
    sheetName: 'Data Mapel',
    columns: COLUMN_CONFIGS.mapel.basic,
    filename: 'template-mapel-basic.xlsx'
});

const getMapelTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetMapelTemplateFriendly',
    sheetName: 'Data Mapel',
    columns: COLUMN_CONFIGS.mapel.friendly,
    filename: 'template-mapel-friendly.xlsx'
});

// Kelas Templates
const getKelasTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetKelasTemplateBasic',
    sheetName: 'Data Kelas',
    columns: COLUMN_CONFIGS.kelas.basic,
    filename: 'template-kelas-basic.xlsx'
});

const getKelasTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetKelasTemplateFriendly',
    sheetName: 'Data Kelas',
    columns: COLUMN_CONFIGS.kelas.friendly,
    filename: 'template-kelas-friendly.xlsx'
});

// Ruang Templates
const getRuangTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetRuangTemplateBasic',
    sheetName: 'Data Ruang',
    columns: COLUMN_CONFIGS.ruang.basic,
    filename: 'template-ruang-basic.xlsx'
});

const getRuangTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetRuangTemplateFriendly',
    sheetName: 'Data Ruang',
    columns: COLUMN_CONFIGS.ruang.friendly,
    filename: 'template-ruang-friendly.xlsx'
});

// Jadwal Templates
const getJadwalTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetJadwalTemplateBasic',
    sheetName: 'Data Jadwal',
    columns: COLUMN_CONFIGS.jadwal.basic,
    filename: 'template-jadwal-basic.xlsx',
    addJadwalRef: true
});

const getJadwalTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetJadwalTemplateFriendly',
    sheetName: 'Data Jadwal',
    columns: COLUMN_CONFIGS.jadwal.friendly,
    filename: 'template-jadwal-friendly.xlsx',
    addJadwalRef: true
});

// ================================================
// EXPORTS
// ================================================

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
