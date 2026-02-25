/**
 * Attendance Constants
 * Centralized configuration for attendance status values
 * 
 * PENTING: Semua logic perhitungan kehadiran harus menggunakan konstanta dari file ini
 * untuk memastikan konsistensi di seluruh sistem.
 */

// ================================================
// STATUS KEHADIRAN - SISWA
// ================================================
export const STUDENT_STATUSES = {
    HADIR: 'Hadir',
    IZIN: 'Izin',
    SAKIT: 'Sakit',
    ALPA: 'Alpa',
    DISPEN: 'Dispen'
};

// Valid statuses array for validation
export const VALID_STUDENT_STATUSES = Object.values(STUDENT_STATUSES);

// ================================================
// STATUS KEHADIRAN - GURU
// ================================================
export const TEACHER_STATUSES = {
    HADIR: 'Hadir',
    TIDAK_HADIR: 'Tidak Hadir',
    IZIN: 'Izin',
    SAKIT: 'Sakit'
};

export const VALID_TEACHER_STATUSES = Object.values(TEACHER_STATUSES);

// ================================================
// KATEGORI STATUS (untuk perhitungan rekap)
// ================================================

/**
 * Status yang dihitung sebagai HADIR dalam rekap
 * - Hadir: kehadiran normal
 * - Dispen: dispensasi untuk kegiatan resmi sekolah (dihitung hadir)
 */
export const PRESENT_STATUSES = ['Hadir', 'H', 'Dispen', 'D'];

/**
 * Status yang dihitung sebagai HADIR tapi dengan catatan khusus
 * - Terlambat: hadir tapi lewat dari jam masuk
 */
export const PRESENT_WITH_NOTE_STATUSES = ['Terlambat', 'T'];

/**
 * Status ketidakhadiran yang masuk rekap (S, I, A)
 * - Sakit: tidak hadir karena sakit
 * - Izin: tidak hadir dengan izin
 * - Alpa/Alpha: tidak hadir tanpa keterangan
 */
export const ABSENT_STATUSES = ['Sakit', 'S', 'Izin', 'I', 'Alpa', 'Alpha', 'A', 'Tidak Hadir'];

/**
 * Breakdown status ketidakhadiran per kategori
 */
export const ABSENT_CATEGORIES = {
    SAKIT: ['Sakit', 'S'],
    IZIN: ['Izin', 'I'],
    ALPHA: ['Alpa', 'Alpha', 'A', 'Tanpa Keterangan']
};

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Check if status counts as present (hadir)
 * @param {string} status - Status to check
 * @returns {boolean}
 */
export function isPresent(status) {
    if (!status) return false;
    const normalized = status.trim();
    return PRESENT_STATUSES.includes(normalized) || 
           PRESENT_WITH_NOTE_STATUSES.includes(normalized);
}

/**
 * Check if status counts as absent (ketidakhadiran)
 * @param {string} status - Status to check
 * @returns {boolean}
 */
export function isAbsent(status) {
    if (!status) return false;
    return ABSENT_STATUSES.includes(status.trim());
}

/**
 * Get absence category (S, I, or A)
 * @param {string} status - Status to categorize
 * @returns {'S' | 'I' | 'A' | null}
 */
export function getAbsenceCategory(status) {
    if (!status) return null;
    const normalized = status.trim();
    
    if (ABSENT_CATEGORIES.SAKIT.includes(normalized)) return 'S';
    if (ABSENT_CATEGORIES.IZIN.includes(normalized)) return 'I';
    if (ABSENT_CATEGORIES.ALPHA.includes(normalized)) return 'A';
    
    return null;
}

/**
 * Normalize status to standard format
 * @param {string} status - Raw status
 * @returns {string} - Normalized status
 */
export function normalizeStatus(status) {
    if (!status) return null;
    const s = status.trim().toUpperCase();
    
    // Map short codes to full names
    const mapping = {
        'H': 'Hadir',
        'T': 'Terlambat', 
        'S': 'Sakit',
        'I': 'Izin',
        'A': 'Alpa',
        'D': 'Dispen'
    };
    
    return mapping[s] || status.trim();
}

// ================================================
// DAILY ATTENDANCE CALCULATION RULES
// ================================================

/**
 * Rules untuk perhitungan status akhir per hari
 * 
 * ATURAN BARU (2024-12):
 * - Jika ada 1 Alpa di jam manapun → GUGUR seluruh kehadiran hari itu
 * - Hadir + Dispen = Hadir
 * - Hadir + Izin/Sakit = Hadir
 * - Hadir + Alpa = ALPA (gugur semua)
 */
export const DAILY_ATTENDANCE_RULES = {
    // Jika true: 1 Alpa = gugurkan semua kehadiran hari itu
    ALPHA_VOIDS_DAY: true,
    
    // Status yang dihitung sebagai hadir
    PRESENT_STATUS: ['Hadir', 'Dispen'],
    
    // Status excused (tidak menggugurkan kehadiran)
    EXCUSED_STATUS: ['Izin', 'Sakit'],
    
    // Status yang menggugurkan seluruh hari (jika ALPHA_VOIDS_DAY = true)
    VOID_STATUS: ['Alpa'],
    
    // Toleransi waktu - DEFAULT OFF (configurable via admin)
    ENABLE_LATE_DETECTION: false,
    DEFAULT_START_TIME: '07:00',
    LATE_TOLERANCE_MINUTES: 15
};

/**
 * Calculate final daily status based on all attendance records for that day
 * 
 * LOGIC:
 * 1. Jika ada Alpa (dan ALPHA_VOIDS_DAY = true) → return Alpa
 * 2. Jika ada Hadir/Dispen → return Hadir
 * 3. Jika semua Izin/Sakit → return Izin atau Sakit
 * 4. Default → Alpa
 * 
 * @param {Array} attendanceRecords - Array of {status: string} for each class period
 * @returns {Object} - { status, reason, details }
 */
export function calculateDailyStatus(attendanceRecords) {
    if (!attendanceRecords || attendanceRecords.length === 0) {
        return { 
            status: 'Alpa', 
            reason: 'no_records',
            message: 'Tidak ada data absensi'
        };
    }
    
    const total = attendanceRecords.length;
    let presentCount = 0;
    let izinCount = 0;
    let sakitCount = 0;
    let alpaCount = 0;
    
    attendanceRecords.forEach(record => {
        const status = record.status || record;
        if (DAILY_ATTENDANCE_RULES.PRESENT_STATUS.includes(status)) {
            presentCount++;
        } else if (status === 'Izin') {
            izinCount++;
        } else if (status === 'Sakit') {
            sakitCount++;
        } else {
            alpaCount++;
        }
    });
    
    // RULE 1: Jika ada Alpa dan ALPHA_VOIDS_DAY aktif → GUGUR semua
    if (DAILY_ATTENDANCE_RULES.ALPHA_VOIDS_DAY && alpaCount > 0) {
        return { 
            status: 'Alpa', 
            reason: 'voided_by_alpha',
            message: `Kehadiran digugurkan karena ada ${alpaCount} jam Alpa`,
            details: { presentCount, izinCount, sakitCount, alpaCount, total }
        };
    }
    
    // RULE 2: Jika ada Hadir/Dispen → Hadir
    if (presentCount > 0) {
        return { 
            status: 'Hadir', 
            reason: 'has_present',
            message: `Hadir ${presentCount}/${total} jam`,
            details: { presentCount, izinCount, sakitCount, alpaCount, total }
        };
    }
    
    // RULE 3: Jika semua excused → return yang paling banyak
    if (izinCount > 0 || sakitCount > 0) {
        const status = izinCount >= sakitCount ? 'Izin' : 'Sakit';
        return { 
            status, 
            reason: 'all_excused',
            message: `${status} seluruh hari (${izinCount + sakitCount}/${total} jam)`,
            details: { presentCount, izinCount, sakitCount, alpaCount, total }
        };
    }
    
    // RULE 4: Default Alpa
    return { 
        status: 'Alpa', 
        reason: 'no_present_records',
        message: 'Tidak ada kehadiran tercatat',
        details: { presentCount, izinCount, sakitCount, alpaCount, total }
    };
}

// ================================================
// SQL FRAGMENTS (untuk digunakan di query)
// ================================================

/**
 * SQL CASE untuk menghitung kehadiran
 * Termasuk: Hadir, Dispen
 */
export const SQL_COUNT_PRESENT = `
    COALESCE(SUM(CASE WHEN status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END), 0)
`;

/**
 * SQL CASE untuk menghitung ketidakhadiran total
 * Termasuk: Sakit, Izin, Alpa (TIDAK termasuk Dispen)
 */
export const SQL_COUNT_ABSENT = `
    COALESCE(SUM(CASE WHEN status IN ('Sakit', 'Izin', 'Alpa') THEN 1 ELSE 0 END), 0)
`;

/**
 * SQL CASE untuk rekap ketidakhadiran per kategori
 */
export const SQL_COUNT_PER_CATEGORY = {
    SAKIT: `COALESCE(SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END), 0)`,
    IZIN: `COALESCE(SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END), 0)`,
    ALPA: `COALESCE(SUM(CASE WHEN status = 'Alpa' THEN 1 ELSE 0 END), 0)`,
    DISPEN: `COALESCE(SUM(CASE WHEN status = 'Dispen' THEN 1 ELSE 0 END), 0)`
};

export default {
    STUDENT_STATUSES,
    TEACHER_STATUSES,
    VALID_STUDENT_STATUSES,
    VALID_TEACHER_STATUSES,
    PRESENT_STATUSES,
    PRESENT_WITH_NOTE_STATUSES,
    ABSENT_STATUSES,
    ABSENT_CATEGORIES,
    DAILY_ATTENDANCE_RULES,
    isPresent,
    isAbsent,
    getAbsenceCategory,
    normalizeStatus,
    calculateDailyStatus,
    SQL_COUNT_PRESENT,
    SQL_COUNT_ABSENT,
    SQL_COUNT_PER_CATEGORY
};

