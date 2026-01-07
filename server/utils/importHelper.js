/**
 * Import Helper Functions
 * Shared utilities for Excel import operations
 * Migrated from server_modern.js - Batch 16
 */

/**
 * Convert Excel worksheet to JSON array using header row
 * @param {ExcelJS.Worksheet} worksheet - The worksheet to parse
 * @returns {Object[]} Array of row objects with header keys
 */
function sheetToJsonByHeader(worksheet) {
    const rows = [];
    const header = [];
    
    // Extract header from first row
    worksheet.getRow(1).eachCell((cell, col) => {
        header[col] = String((cell.value || '').toString().trim());
    });
    
    // Process data rows
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        
        const obj = {};
        header.forEach((key, col) => {
            if (!key) return;
            const cell = row.getCell(col);
            obj[key] = cell && cell.value != null 
                ? (typeof cell.value === 'object' && cell.value.text ? cell.value.text : cell.value) 
                : '';
        });
        
        // Skip completely empty rows
        const allEmpty = Object.values(obj).every(v => v === '' || v == null);
        if (!allEmpty) rows.push(obj);
    });
    
    return rows;
}

// ================================================
// MAPPING FUNCTIONS - Convert names to IDs
// ================================================

/**
 * Map kelas name to ID
 */
const mapKelasByName = async (namaKelas) => {
    if (!namaKelas || namaKelas === '-') return null;
    const [rows] = await global.dbPool.execute(
        'SELECT id_kelas FROM kelas WHERE nama_kelas = ? AND status = "aktif"',
        [namaKelas.trim()]
    );
    return rows[0]?.id_kelas || null;
};

/**
 * Map mapel name to ID
 */
const mapMapelByName = async (namaMapel) => {
    if (!namaMapel || namaMapel === '-') return null;
    const [rows] = await global.dbPool.execute(
        'SELECT id_mapel FROM mapel WHERE nama_mapel = ? AND status = "aktif"',
        [namaMapel.trim()]
    );
    return rows[0]?.id_mapel || null;
};

/**
 * Map guru name to ID
 */
const mapGuruByName = async (namaGuru) => {
    if (!namaGuru || namaGuru === '-') return null;
    const [rows] = await global.dbPool.execute(
        'SELECT id_guru FROM guru WHERE nama = ? AND status = "aktif"',
        [namaGuru.trim()]
    );
    return rows[0]?.id_guru || null;
};

/**
 * Map ruang code to ID
 */
const mapRuangByKode = async (kodeRuang) => {
    if (!kodeRuang || kodeRuang === '-') return null;
    const [rows] = await global.dbPool.execute(
        'SELECT id_ruang FROM ruang_kelas WHERE kode_ruang = ? AND status = "aktif"',
        [kodeRuang.trim()]
    );
    return rows[0]?.id_ruang || null;
};

// ================================================
// TIME VALIDATION FUNCTIONS
// ================================================

/**
 * Validate 24-hour time format (HH:MM)
 */
function validateTimeFormat(timeString) {
    if (!timeString || typeof timeString !== 'string') {
        return false;
    }
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString.trim());
}

/**
 * Convert time string to minutes for comparison
 */
function timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Validate time logic (start must be before end)
 */
function validateTimeLogic(startTime, endTime) {
    if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
        return { valid: false, error: 'Format waktu tidak valid. Gunakan format 24 jam (HH:MM)' };
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
        return { valid: false, error: 'Jam selesai harus setelah jam mulai' };
    }

    return { valid: true };
}

// ================================================
// JADWAL IMPORT HELPER FUNCTIONS
// ================================================

const ALLOWED_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Get field value from row with multiple possible keys
 * @param {Object} rowData - The row data
 * @param {string[]} keys - Possible key names
 * @returns {any} The field value or null
 */
function getFieldValue(rowData, keys) {
    for (const key of keys) {
        if (rowData[key] !== undefined && rowData[key] !== '') {
            return rowData[key];
        }
    }
    return null;
}

/**
 * Parse comma-separated guru IDs from basic format
 * @param {string} guruIdsString - Comma-separated IDs
 * @returns {number[]} Array of guru IDs
 */
function parseGuruIdsFromString(guruIdsString) {
    if (!guruIdsString) return [];
    const raw = String(guruIdsString).split(',');
    return raw
        .map(v => Number(String(v).trim()))
        .filter(v => Number.isFinite(v) && v > 0);
}

/**
 * Parse guru names and map to IDs
 * @param {string} guruNamesString - Comma-separated names
 * @returns {Promise<number[]>} Array of guru IDs
 */
async function parseGuruNamesFromString(guruNamesString) {
    if (!guruNamesString) return [];
    const guruNames = String(guruNamesString)
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    const guruIds = [];
    for (const name of guruNames) {
        const gid = await mapGuruByName(name);
        if (gid && !guruIds.includes(Number(gid))) {
            guruIds.push(Number(gid));
        }
    }
    return guruIds;
}

/**
 * Validate required jadwal fields
 * @param {Object} rowData - Row data
 * @returns {string[]} Array of error messages
 */
function validateRequiredJadwalFields(rowData) {
    const errors = [];
    
    const hari = getFieldValue(rowData, ['hari', 'Hari']);
    const jamKe = getFieldValue(rowData, ['jam_ke', 'Jam Ke']);
    const jamMulai = getFieldValue(rowData, ['jam_mulai', 'Jam Mulai']);
    const jamSelesai = getFieldValue(rowData, ['jam_selesai', 'Jam Selesai']);
    
    if (!hari) errors.push('hari wajib');
    if (!jamKe) errors.push('jam_ke wajib');
    if (!jamMulai) errors.push('jam_mulai wajib');
    if (!jamSelesai) errors.push('jam_selesai wajib');
    
    if (hari && !ALLOWED_DAYS.includes(String(hari))) {
        errors.push('hari tidak valid (harus Senin-Sabtu)');
    }
    
    if (jamMulai && !validateTimeFormat(String(jamMulai))) {
        errors.push(`Format jam mulai "${jamMulai}" tidak valid. Gunakan format 24 jam (HH:MM)`);
    }
    
    if (jamSelesai && !validateTimeFormat(String(jamSelesai))) {
        errors.push(`Format jam selesai "${jamSelesai}" tidak valid. Gunakan format 24 jam (HH:MM)`);
    }
    
    if (jamMulai && jamSelesai && validateTimeFormat(String(jamMulai)) && validateTimeFormat(String(jamSelesai))) {
        const timeValidation = validateTimeLogic(String(jamMulai), String(jamSelesai));
        if (!timeValidation.valid) {
            errors.push(timeValidation.error);
        }
    }
    
    return errors;
}

/**
 * Build jadwal object from validated row data
 * @param {Object} params - Parameters
 * @returns {Object} Jadwal object for insertion
 */
function buildJadwalObject(rowData, kelas_id, mapel_id, guru_id, ruang_id, guru_ids_array) {
    const hari = getFieldValue(rowData, ['hari', 'Hari']);
    const jamKe = getFieldValue(rowData, ['jam_ke', 'Jam Ke']);
    const jamMulai = getFieldValue(rowData, ['jam_mulai', 'Jam Mulai']);
    const jamSelesai = getFieldValue(rowData, ['jam_selesai', 'Jam Selesai']);
    const jenisAktivitas = getFieldValue(rowData, ['jenis_aktivitas', 'Jenis Aktivitas']) || 'pelajaran';
    const keteranganKhusus = getFieldValue(rowData, ['keterangan_khusus', 'Keterangan Khusus']);
    const isAbsenable = jenisAktivitas === 'pelajaran' ? 1 : 0;
    
    // Normalize guru_ids
    const uniqueGuruIds = Array.from(new Set(guru_ids_array));
    const primaryGuru = guru_id ? Number(guru_id) : (uniqueGuruIds[0] || null);
    
    return {
        kelas_id: Number(kelas_id),
        mapel_id: mapel_id ? Number(mapel_id) : null,
        guru_id: primaryGuru ? Number(primaryGuru) : null,
        ruang_id: ruang_id ? Number(ruang_id) : null,
        hari: String(hari),
        jam_ke: Number(jamKe),
        jam_mulai: String(jamMulai),
        jam_selesai: String(jamSelesai),
        jenis_aktivitas: jenisAktivitas,
        is_absenable: isAbsenable,
        keterangan_khusus: keteranganKhusus || null,
        status: 'aktif',
        guru_ids: uniqueGuruIds
    };
}

// ES Module exports
export {
    sheetToJsonByHeader,
    mapKelasByName,
    mapMapelByName,
    mapGuruByName,
    mapRuangByKode,
    validateTimeFormat,
    validateTimeLogic,
    timeToMinutes,
    // New jadwal helpers
    getFieldValue,
    parseGuruIdsFromString,
    parseGuruNamesFromString,
    validateRequiredJadwalFields,
    buildJadwalObject,
    ALLOWED_DAYS
};

