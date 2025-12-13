/**
 * Export Configuration
 * Configurable values for Excel export - matching school template requirements
 * 
 * PENTING: Nilai-nilai ini harus bisa diubah sesuai kebutuhan sekolah
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================================
// TAHUN PELAJARAN
// ================================================
export const TAHUN_PELAJARAN = '2025-2026';

// ================================================
// HARI EFEKTIF (untuk perhitungan persentase)
// ================================================
export const HARI_EFEKTIF = {
    // Semester Gasal (Juli - Desember)
    GASAL: 95,
    // Semester Genap (Januari - Juni)
    GENAP: 142,
    // Total Tahunan (untuk rekap guru)
    TAHUNAN: 237
};

// ================================================
// BULAN MAPPING
// ================================================
export const BULAN_GASAL = ['JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
export const BULAN_GENAP = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI'];
export const BULAN_TAHUNAN = [...BULAN_GASAL, ...BULAN_GENAP];

// Mapping bulan ke index (1-12)
export const BULAN_INDEX = {
    'JULI': 7, 'AGUSTUS': 8, 'SEPTEMBER': 9, 'OKTOBER': 10, 'NOVEMBER': 11, 'DESEMBER': 12,
    'JANUARI': 1, 'FEBRUARI': 2, 'MARET': 3, 'APRIL': 4, 'MEI': 5, 'JUNI': 6
};

// ================================================
// TEMPLATE PATHS
// ================================================
const TEMPLATE_BASE = path.join(__dirname, '..', 'templates', 'excel');

export const TEMPLATE_PATHS = {
    // Rekap Ketidakhadiran Kelas per tingkat
    REKAP_KELAS_X: path.join(TEMPLATE_BASE, 'REKAP KETIDAKHADIRAN KELAS X 2025-2026.xlsx'),
    REKAP_KELAS_XI: path.join(TEMPLATE_BASE, 'REKAP KETIDAKHADIRAN KELAS XI 2025-2026.xlsx'),
    REKAP_KELAS_XII: path.join(TEMPLATE_BASE, 'REKAP KETIDAKHADIRAN KELAS XII 2025-2026.xlsx'),
    REKAP_KELAS_XIII: path.join(TEMPLATE_BASE, 'REKAP KETIDAKHADIRAN KELAS XIII 2025-2026.xlsx'),
    
    // Rekap Guru Tahunan
    REKAP_GURU: path.join(TEMPLATE_BASE, 'REKAP KETIDAKHADIRAN GURU 2025-2026.xlsx'),
    
    // Presensi Siswa (optional)
    PRESENSI_SISWA: path.join(TEMPLATE_BASE, 'PRESENSI SISWA 2025-2026 edit1.xlsx'),
    
    // Jadwal (optional)
    JADWAL: path.join(TEMPLATE_BASE, 'JADWAL PELAJARAN 2025-2026 (REVISI 2) (1).xlsx')
};

// ================================================
// CELL MAPPING - REKAP KELAS GASAL
// Sesuai struktur template sekolah
// ================================================
export const REKAP_KELAS_MAPPING = {
    // Header info cells
    HEADER: {
        WALI_KELAS_CELL: 'D6',    // Cell untuk nama wali kelas
        KELAS_CELL: 'C5'          // Cell untuk nama kelas (biasanya sudah merge)
    },
    
    // Data start row (setelah header)
    DATA_START_ROW: 11,
    
    // Kolom identitas siswa
    KOLOM_IDENTITAS: {
        NO: 'A',      // Nomor urut
        NIS: 'B',     // NIS/NISN
        NAMA: 'C',    // Nama Peserta Didik
        LP: 'D'       // L/P (Jenis Kelamin)
    },
    
    // Kolom ketidakhadiran per bulan (S, I, A) - HANYA ISI CELL INI
    // Kolom JML (H, L, P, T, X, AB) sudah ada rumus, JANGAN DIISI
    KOLOM_BULAN: {
        JULI: { S: 'E', I: 'F', A: 'G' },       // JML di H (rumus)
        AGUSTUS: { S: 'I', I: 'J', A: 'K' },    // JML di L (rumus)
        SEPTEMBER: { S: 'M', I: 'N', A: 'O' },  // JML di P (rumus)
        OKTOBER: { S: 'Q', I: 'R', A: 'S' },    // JML di T (rumus)
        NOVEMBER: { S: 'U', I: 'V', A: 'W' },   // JML di X (rumus)
        DESEMBER: { S: 'Y', I: 'Z', A: 'AA' }   // JML di AB (rumus)
    },
    
    // Kolom total (AC-AH) - JANGAN DIISI, SUDAH ADA RUMUS
    // AC: total S, AD: total I, AE: total A, AF: JUMLAH, AG: % Tidak Hadir, AH: % Hadir
};

// ================================================
// CELL MAPPING - REKAP GURU TAHUNAN
// ================================================
export const REKAP_GURU_MAPPING = {
    // Data start row
    DATA_START_ROW: 8,
    
    // Kolom identitas
    KOLOM_IDENTITAS: {
        NO: 'A',
        NAMA: 'B'
    },
    
    // Kolom ketidakhadiran per bulan (Juli - Juni)
    // C=Juli, D=Agustus, ..., N=Juni
    KOLOM_BULAN: {
        JULI: 'C',
        AGUSTUS: 'D',
        SEPTEMBER: 'E',
        OKTOBER: 'F',
        NOVEMBER: 'G',
        DESEMBER: 'H',
        JANUARI: 'I',
        FEBRUARI: 'J',
        MARET: 'K',
        APRIL: 'L',
        MEI: 'M',
        JUNI: 'N'
    }
    
    // Kolom O, P, Q sudah ada rumus: JUMLAH, %, % Hadir - JANGAN DIISI
};

// ================================================
// STATUS KEHADIRAN MAPPING
// Kode yang disimpan di DB vs display
// ================================================
export const STATUS_KEHADIRAN = {
    // Status yang dihitung sebagai "hadir"
    HADIR: ['H', 'Hadir', 'T', 'Terlambat'],
    
    // Status ketidakhadiran (untuk rekap)
    SAKIT: ['S', 'Sakit'],
    IZIN: ['I', 'Izin'],
    ALPHA: ['A', 'Alpha', 'Alpa', 'Tanpa Keterangan']
};

// ================================================
// TINGKAT KELAS MAPPING
// ================================================
export const TINGKAT_KELAS = {
    'X': 'REKAP_KELAS_X',
    'XI': 'REKAP_KELAS_XI',
    'XII': 'REKAP_KELAS_XII',
    'XIII': 'REKAP_KELAS_XIII'
};

/**
 * Get template path berdasarkan tingkat kelas
 * @param {string} tingkat - X, XI, XII, atau XIII
 * @returns {string} - Path ke template
 */
export function getTemplatePathByTingkat(tingkat) {
    const key = TINGKAT_KELAS[tingkat.toUpperCase()];
    if (!key) {
        throw new Error(`Tingkat kelas tidak valid: ${tingkat}. Gunakan X, XI, XII, atau XIII.`);
    }
    return TEMPLATE_PATHS[key];
}

/**
 * Extract tingkat dari nama kelas
 * @param {string} namaKelas - Contoh: "XII RPL 1"
 * @returns {string} - Tingkat kelas (X, XI, XII, XIII)
 */
export function extractTingkatFromKelas(namaKelas) {
    if (!namaKelas) return null;
    const match = namaKelas.match(/^(X{1,3}I{0,2})/i);
    return match ? match[1].toUpperCase() : null;
}

export default {
    TAHUN_PELAJARAN,
    HARI_EFEKTIF,
    BULAN_GASAL,
    BULAN_GENAP,
    BULAN_TAHUNAN,
    BULAN_INDEX,
    TEMPLATE_PATHS,
    REKAP_KELAS_MAPPING,
    REKAP_GURU_MAPPING,
    STATUS_KEHADIRAN,
    TINGKAT_KELAS,
    getTemplatePathByTingkat,
    extractTingkatFromKelas
};
