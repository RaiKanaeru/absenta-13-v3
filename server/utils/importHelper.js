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

// ES Module exports
export {
    sheetToJsonByHeader,
    mapKelasByName,
    mapMapelByName,
    mapGuruByName,
    mapRuangByKode,
    validateTimeFormat,
    validateTimeLogic,
    timeToMinutes
};
