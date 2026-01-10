import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konstanta untuk kode laporan
export const REPORT_KEYS = {
  // Laporan Siswa
  KEHADIRAN_SISWA: 'REPORT_KEHADIRAN_SISWA',
  PRESENSI_SISWA: 'REPORT_PRESENSI_SISWA',
  REKAP_KETIDAKHADIRAN: 'REPORT_REKAP_KETIDAKHADIRAN',
  
  // Laporan Guru
  LAPORAN_GURU: 'REPORT_LAPORAN_GURU',
  REKAP_KETIDAKHADIRAN_GURU: 'REPORT_REKAP_KETIDAKHADIRAN_GURU',
  ABSENSI_GURU: 'REPORT_ABSENSI_GURU',
  
  // Laporan Pengajuan
  BANDING_ABSEN: 'REPORT_BANDING_ABSEN',
  RIWAYAT_IZIN: 'REPORT_RIWAYAT_IZIN',
  
  // Laporan Live & Analytics
  LIVE_STUDENT_ATTENDANCE: 'REPORT_LIVE_STUDENT_ATTENDANCE',
  LIVE_TEACHER_ATTENDANCE: 'REPORT_LIVE_TEACHER_ATTENDANCE',
  ANALYTICS_DASHBOARD: 'REPORT_ANALYTICS_DASHBOARD',
  
  // Laporan Jadwal
  JADWAL_PELAJARAN: 'REPORT_JADWAL_PELAJARAN'
};

// Default letterhead configuration
const DEFAULT_LETTERHEAD = {
  enabled: true,
  logo: "",
  logoLeftUrl: "",
  logoRightUrl: "",
  lines: [
    { text: "PEMERINTAH DAERAH PROVINSI DKI JAKARTA", fontWeight: "bold" },
    { text: "DINAS PENDIDIKAN", fontWeight: "bold" },
    { text: "SMK NEGERI 13 JAKARTA", fontWeight: "bold" },
    { text: "Jl. Raya Bekasi Km. 18, Cakung, Jakarta Timur 13910", fontWeight: "normal" }
  ],
  alignment: "center"
};

/**
 * Ambil konfigurasi KOP dari database
 * @param {Object} options - Opsi query
 * @param {string} options.reportKey - Kode laporan spesifik (opsional)
 * @returns {Promise<Object>} Konfigurasi KOP
 */
export async function getLetterhead({ reportKey = null } = {}) {
  try {
    if (!globalThis.dbPool) {
      console.warn('⚠️ Database pool tidak tersedia, menggunakan default letterhead');
      return DEFAULT_LETTERHEAD;
    }

    let query, params;

    if (reportKey) {
      // Cari KOP spesifik untuk jenis laporan, fallback ke global
      query = `
        SELECT 
          id, cakupan, kode_laporan, aktif, perataan, baris_teks,
          logo_tengah_url, logo_kiri_url, logo_kanan_url, dibuat_pada, diubah_pada
        FROM kop_laporan 
        WHERE aktif = 1 AND (
          (cakupan = 'jenis_laporan' AND kode_laporan = ?) OR
          (cakupan = 'global' AND kode_laporan IS NULL)
        )
        ORDER BY 
          CASE WHEN cakupan = 'jenis_laporan' THEN 0 ELSE 1 END,
          dibuat_pada DESC
        LIMIT 1
      `;
      params = [reportKey];
    } else {
      // Ambil KOP global
      query = `
        SELECT 
          id, cakupan, kode_laporan, aktif, perataan, baris_teks,
          logo_tengah_url, logo_kiri_url, logo_kanan_url, dibuat_pada, diubah_pada
        FROM kop_laporan 
        WHERE cakupan = 'global' AND kode_laporan IS NULL AND aktif = 1
        ORDER BY dibuat_pada DESC
        LIMIT 1
      `;
      params = [];
    }

    const [rows] = await global.dbPool.execute(query, params);
    
    if (rows.length === 0) {
      console.warn('⚠️ Tidak ada KOP ditemukan, menggunakan default');
      return DEFAULT_LETTERHEAD;
    }

    const dbConfig = rows[0];
    
    // Konversi dari format database ke format API
    let lines = Array.isArray(dbConfig.baris_teks) ? dbConfig.baris_teks : JSON.parse(dbConfig.baris_teks || '[]');
    
    // Handle backward compatibility - convert old format to new format
    if (lines.length > 0 && typeof lines[0] === 'string') {
      // Convert old format (string array) to new format (object array)
      lines = lines.map((line, index) => ({
        text: line,
        fontWeight: index === 0 ? 'bold' : 'normal' // First line is bold by default
      }));
    }
    
    return {
      enabled: Boolean(dbConfig.aktif),
      logo: dbConfig.logo_tengah_url || "",
      logoLeftUrl: dbConfig.logo_kiri_url || "",
      logoRightUrl: dbConfig.logo_kanan_url || "",
      lines: lines,
      alignment: mapAlignmentFromDB(dbConfig.perataan)
    };

  } catch (error) {
    console.error('❌ Error fetching letterhead from database:', error);
    return DEFAULT_LETTERHEAD;
  }
}

/**
 * Simpan konfigurasi KOP global
 * @param {Object} letterhead - Konfigurasi KOP
 * @returns {Promise<boolean>} Status keberhasilan
 */
export async function setLetterheadGlobal(letterhead) {
  try {
    if (!global.dbPool) {
      throw new Error('Database pool tidak tersedia');
    }

    const validation = validateLetterhead(letterhead);
    if (!validation.isValid) {
      throw new Error(`Konfigurasi KOP tidak valid: ${validation.errors.join(', ')}`);
    }

    const query = `
      INSERT INTO kop_laporan (
        cakupan, kode_laporan, aktif, perataan, baris_teks, 
        logo_tengah_url, logo_kiri_url, logo_kanan_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        aktif = VALUES(aktif),
        perataan = VALUES(perataan),
        baris_teks = VALUES(baris_teks),
        logo_tengah_url = VALUES(logo_tengah_url),
        logo_kiri_url = VALUES(logo_kiri_url),
        logo_kanan_url = VALUES(logo_kanan_url),
        diubah_pada = CURRENT_TIMESTAMP
    `;

    const params = [
      'global',
      null,
      letterhead.enabled ? 1 : 0,
      mapAlignmentToDB(letterhead.alignment),
      JSON.stringify(letterhead.lines || []),
      letterhead.logo || null,
      letterhead.logoLeftUrl || null,
      letterhead.logoRightUrl || null
    ];

    await global.dbPool.execute(query, params);
    return true;

  } catch (error) {
    console.error('❌ Error saving global letterhead:', error);
    return false;
  }
}

/**
 * Simpan konfigurasi KOP untuk jenis laporan spesifik
 * @param {string} reportKey - Kode laporan
 * @param {Object} letterhead - Konfigurasi KOP
 * @returns {Promise<boolean>} Status keberhasilan
 */
export async function setLetterheadForReport(reportKey, letterhead) {
  try {
    if (!global.dbPool) {
      throw new Error('Database pool tidak tersedia');
    }

    if (!reportKey) {
      throw new Error('Kode laporan wajib diisi');
    }

    const validation = validateLetterhead(letterhead);
    if (!validation.isValid) {
      throw new Error(`Konfigurasi KOP tidak valid: ${validation.errors.join(', ')}`);
    }

    const query = `
      INSERT INTO kop_laporan (
        cakupan, kode_laporan, aktif, perataan, baris_teks, 
        logo_tengah_url, logo_kiri_url, logo_kanan_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        aktif = VALUES(aktif),
        perataan = VALUES(perataan),
        baris_teks = VALUES(baris_teks),
        logo_tengah_url = VALUES(logo_tengah_url),
        logo_kiri_url = VALUES(logo_kiri_url),
        logo_kanan_url = VALUES(logo_kanan_url),
        diubah_pada = CURRENT_TIMESTAMP
    `;

    const params = [
      'jenis_laporan',
      reportKey,
      letterhead.enabled ? 1 : 0,
      mapAlignmentToDB(letterhead.alignment),
      JSON.stringify(letterhead.lines || []),
      letterhead.logo || null,
      letterhead.logoLeftUrl || null,
      letterhead.logoRightUrl || null
    ];

    await global.dbPool.execute(query, params);
    return true;

  } catch (error) {
    console.error('❌ Error saving report letterhead:', error);
    return false;
  }
}

/**
 * Dapatkan daftar semua konfigurasi KOP
 * @returns {Promise<Array>} Daftar konfigurasi KOP
 */
export async function getAllLetterheads() {
  try {
    if (!global.dbPool) {
      return [];
    }

    const query = `
      SELECT 
        id, cakupan, kode_laporan, aktif, perataan, baris_teks,
        logo_tengah_url, logo_kiri_url, logo_kanan_url, dibuat_pada, diubah_pada
      FROM kop_laporan 
      ORDER BY cakupan, kode_laporan
    `;

    const [rows] = await global.dbPool.execute(query);
    return rows;

  } catch (error) {
    console.error('❌ Error fetching all letterheads:', error);
    return [];
  }
}

/**
 * Hapus konfigurasi KOP
 * @param {number} id - ID konfigurasi KOP
 * @returns {Promise<boolean>} Status keberhasilan
 */
export async function deleteLetterhead(id) {
  try {
    if (!global.dbPool) {
      throw new Error('Database pool tidak tersedia');
    }

    const query = 'DELETE FROM kop_laporan WHERE id = ?';
    const [result] = await global.dbPool.execute(query, [id]);
    
    return result.affectedRows > 0;

  } catch (error) {
    console.error('❌ Error deleting letterhead:', error);
    return false;
  }
}

/**
 * Validasi konfigurasi KOP
 * @param {Object} letterhead - Konfigurasi KOP
 * @returns {Object} Hasil validasi
 */
export function validateLetterhead(letterhead) {
  const errors = [];

  if (typeof letterhead.enabled !== 'boolean') {
    errors.push('Status aktif harus boolean');
  }

  if (!Array.isArray(letterhead.lines)) {
    errors.push('Baris teks harus berupa array');
  } else if (letterhead.lines.length > 10) {
    errors.push('Maksimal 10 baris teks');
  } else {
    letterhead.lines.forEach((line, index) => {
      // Handle both old format (string) and new format (object)
      if (typeof line === 'string') {
        // Old format - validate as string
        if (line.length > 100) {
          errors.push(`Baris teks ke-${index + 1} maksimal 100 karakter`);
        }
      } else if (typeof line === 'object' && line !== null) {
        // New format - validate as object
        if (typeof line.text !== 'string') {
          errors.push(`Baris teks ke-${index + 1} harus memiliki properti 'text' berupa string`);
        } else if (line.text.length > 100) {
          errors.push(`Baris teks ke-${index + 1} maksimal 100 karakter`);
        }
        
        if (line.fontWeight && !['normal', 'bold'].includes(line.fontWeight)) {
          errors.push(`Baris teks ke-${index + 1} fontWeight harus 'normal' atau 'bold'`);
        }
      } else {
        errors.push(`Baris teks ke-${index + 1} harus berupa string atau object dengan properti 'text' dan 'fontWeight'`);
      }
    });
  }

  const validAlignments = ['left', 'center', 'right'];
  if (!validAlignments.includes(letterhead.alignment)) {
    errors.push('Perataan harus left, center, atau right');
  }

  if (letterhead.logo && typeof letterhead.logo !== 'string') {
    errors.push('URL logo tengah harus berupa string');
  }

  if (letterhead.logoLeftUrl && typeof letterhead.logoLeftUrl !== 'string') {
    errors.push('URL logo kiri harus berupa string');
  }

  if (letterhead.logoRightUrl && typeof letterhead.logoRightUrl !== 'string') {
    errors.push('URL logo kanan harus berupa string');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Konversi perataan dari database ke API
 * @param {string} dbAlignment - Perataan dari database
 * @returns {string} Perataan untuk API
 */
function mapAlignmentFromDB(dbAlignment) {
  const mapping = {
    'kiri': 'left',
    'tengah': 'center',
    'kanan': 'right'
  };
  return mapping[dbAlignment] || 'center';
}

/**
 * Konversi perataan dari API ke database
 * @param {string} apiAlignment - Perataan dari API
 * @returns {string} Perataan untuk database
 */
function mapAlignmentToDB(apiAlignment) {
  const mapping = {
    'left': 'kiri',
    'center': 'tengah',
    'right': 'kanan'
  };
  return mapping[apiAlignment] || 'tengah';
}
