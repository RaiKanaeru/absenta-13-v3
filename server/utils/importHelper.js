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

// ================================================
// STUDENT ACCOUNT IMPORT HELPER FUNCTIONS
// ================================================

const GENDER_ENUM = ['L', 'P'];

/**
 * Validate required fields for student account
 * @param {Object} rowData - Row data from Excel
 * @returns {string[]} Array of error messages
 */
function validateRequiredStudentFields(rowData) {
    const errors = [];
    if (!rowData.nama && !rowData['Nama Lengkap *']) errors.push('Nama lengkap wajib diisi');
    if (!rowData.username && !rowData['Username *']) errors.push('Username wajib diisi');
    if (!rowData.password && !rowData['Password *']) errors.push('Password wajib diisi');
    if (!rowData.nis && !rowData['NIS *']) errors.push('NIS wajib diisi');
    if (!rowData.kelas && !rowData['Kelas *']) errors.push('Kelas wajib diisi');
    return errors;
}

/**
 * Validate NIS field
 * @param {string|number} nis - NIS value
 * @param {Object[]} validRecords - Already validated records for file duplicate check
 * @param {Set} existingNis - Set of existing NIS from database
 * @returns {string[]} Array of error messages
 */
function validateNIS(nis, validRecords, existingNis) {
    const errors = [];
    if (!nis) return errors;
    
    const nisValue = String(nis).trim();
    if (nisValue.length < 8) errors.push('NIS minimal 8 karakter');
    if (nisValue.length > 15) errors.push('NIS maksimal 15 karakter');
    if (!/^\d+$/.test(nisValue)) errors.push('NIS harus berupa angka');
    
    // Check file duplicate
    if (validRecords.some(v => v.nis === nisValue)) {
        errors.push('NIS duplikat dalam file');
    }
    
    // Check database duplicate
    if (existingNis && existingNis.has(nisValue)) {
        errors.push('NIS sudah digunakan di database');
    }
    
    return errors;
}

/**
 * Validate username field
 * @param {string} username - Username value
 * @param {Object[]} validRecords - Already validated records for file duplicate check
 * @param {Set} existingUsernames - Set of existing usernames from database
 * @returns {string[]} Array of error messages
 */
function validateUsername(username, validRecords, existingUsernames) {
    const errors = [];
    if (!username) return errors;
    
    const usernameValue = String(username).trim();
    if (usernameValue.length < 4) errors.push('Username minimal 4 karakter');
    if (usernameValue.length > 50) errors.push('Username maksimal 50 karakter');
    if (!/^[a-z0-9._-]+$/.test(usernameValue)) {
        errors.push('Username harus huruf kecil, angka, titik, underscore, strip');
    }
    
    // Check file duplicate
    if (validRecords.some(v => v.username === usernameValue)) {
        errors.push('Username duplikat dalam file');
    }
    
    // Check database duplicate
    if (existingUsernames && existingUsernames.has(usernameValue)) {
        errors.push('Username sudah digunakan di database');
    }
    
    return errors;
}

/**
 * Validate password field
 * @param {string} password - Password value
 * @returns {string[]} Array of error messages
 */
function validatePassword(password) {
    const errors = [];
    if (password && String(password).trim().length < 6) {
        errors.push('Password minimal 6 karakter');
    }
    return errors;
}

/**
 * Validate email field
 * @param {string} email - Email value
 * @returns {string[]} Array of error messages
 */
function validateEmail(email) {
    const errors = [];
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        errors.push('Format email tidak valid');
    }
    return errors;
}

/**
 * Validate gender field
 * @param {string} jenisKelamin - Gender value
 * @returns {string[]} Array of error messages
 */
function validateGender(jenisKelamin) {
    const errors = [];
    if (jenisKelamin && !GENDER_ENUM.includes(String(jenisKelamin).toUpperCase())) {
        errors.push('Jenis kelamin harus L atau P');
    }
    return errors;
}

/**
 * Build student account object from validated row data
 * @param {Object} rowData - Row data from Excel
 * @returns {Object} Valid student account object
 */
function buildStudentObject(rowData) {
    const username = rowData.username || rowData['Username *'];
    const password = rowData.password || rowData['Password *'];
    const nis = rowData.nis || rowData['NIS *'];
    const jenisKelamin = rowData.jenis_kelamin || rowData['Jenis Kelamin'];
    const email = rowData.email || rowData.Email;
    
    return {
        nama: String(rowData.nama || rowData['Nama Lengkap *']).trim(),
        username: String(username).trim(),
        password: String(password).trim(),
        nis: String(nis).trim(),
        kelas: String(rowData.kelas || rowData['Kelas *']).trim(),
        jabatan: (rowData.jabatan || rowData.Jabatan) ? String(rowData.jabatan || rowData.Jabatan).trim() : null,
        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
        email: email ? String(email).trim() : null
    };
}

/**
 * Create row preview object for error reporting
 * @param {Object} rowData - Row data from Excel
 * @returns {Object} Preview object with key fields
 */
function createStudentRowPreview(rowData) {
    return {
        nama: rowData.nama || rowData['Nama Lengkap *'] || '(kosong)',
        username: rowData.username || rowData['Username *'] || '(kosong)',
        nis: rowData.nis || rowData['NIS *'] || '(kosong)',
        kelas: rowData.kelas || rowData['Kelas *'] || '(kosong)'
    };
}

/**
 * Validate a complete student account row
 * @param {Object} rowData - Row data from Excel
 * @param {Object[]} validRecords - Already validated records
 * @param {Set} existingNis - Set of existing NIS from database
 * @param {Set} existingUsernames - Set of existing usernames from database
 * @returns {{valid: boolean, errors: string[], data: Object|null}}
 */
function validateStudentAccountRow(rowData, validRecords, existingNis, existingUsernames) {
    const errors = [];
    
    // Validate required fields
    errors.push(...validateRequiredStudentFields(rowData));
    
    // Extract field values
    const nis = rowData.nis || rowData['NIS *'];
    const username = rowData.username || rowData['Username *'];
    const password = rowData.password || rowData['Password *'];
    const email = rowData.email || rowData.Email;
    const jenisKelamin = rowData.jenis_kelamin || rowData['Jenis Kelamin'];
    
    // Validate individual fields
    errors.push(
        ...validateNIS(nis, validRecords, existingNis),
        ...validateUsername(username, validRecords, existingUsernames),
        ...validatePassword(password),
        ...validateEmail(email),
        ...validateGender(jenisKelamin)
    );
    
    if (errors.length > 0) {
        return { valid: false, errors, data: null };
    }
    
    return { valid: true, errors: [], data: buildStudentObject(rowData) };
}

// ================================================
// TEACHER ACCOUNT IMPORT HELPER FUNCTIONS
// ================================================

/**
 * Validate required fields for teacher account
 * @param {Object} rowData - Row data from Excel
 * @returns {string[]} Array of error messages
 */
function validateRequiredTeacherFields(rowData) {
    const errors = [];
    if (!rowData.nama && !rowData['Nama Lengkap *']) errors.push('Nama lengkap wajib diisi');
    if (!rowData.username && !rowData['Username *']) errors.push('Username wajib diisi');
    if (!rowData.password && !rowData['Password *']) errors.push('Password wajib diisi');
    if (!rowData.nip && !rowData['NIP *']) errors.push('NIP wajib diisi');
    return errors;
}

/**
 * Validate NIP field
 * @param {string|number} nip - NIP value
 * @param {Object[]} validRecords - Already validated records for file duplicate check
 * @param {Set} existingNips - Set of existing NIPs from database
 * @returns {string[]} Array of error messages
 */
function validateNIP(nip, validRecords, existingNips) {
    const errors = [];
    if (!nip) return errors;
    
    const nipValue = String(nip).trim();
    if (nipValue.length < 8) errors.push('NIP minimal 8 karakter');
    if (nipValue.length > 20) errors.push('NIP maksimal 20 karakter');
    
    // Check file duplicate
    if (validRecords.some(v => v.nip === nipValue)) {
        errors.push('NIP duplikat dalam file');
    }
    
    // Check database duplicate
    if (existingNips && existingNips.has(nipValue)) {
        errors.push('NIP sudah digunakan di database');
    }
    
    return errors;
}

/**
 * Validate phone number field
 * @param {string} noTelp - Phone number value
 * @returns {string[]} Array of error messages
 */
function validatePhone(noTelp) {
    const errors = [];
    if (noTelp && String(noTelp).length < 10) {
        errors.push('Nomor telepon minimal 10 digit');
    }
    return errors;
}

/**
 * Validate status field
 * @param {string} status - Status value
 * @returns {string[]} Array of error messages
 */
function validateStatus(status) {
    const errors = [];
    if (status && !['aktif', 'nonaktif'].includes(String(status).toLowerCase())) {
        errors.push('Status harus aktif atau nonaktif');
    }
    return errors;
}

/**
 * Build teacher account object from validated row data
 * @param {Object} rowData - Row data from Excel
 * @returns {Object} Valid teacher account object
 */
function buildTeacherObject(rowData) {
    const username = rowData.username || rowData['Username *'];
    const password = rowData.password || rowData['Password *'];
    const nip = rowData.nip || rowData['NIP *'];
    const jenisKelamin = rowData.jenis_kelamin || rowData['Jenis Kelamin'];
    const email = rowData.email || rowData.Email;
    const noTelp = rowData.no_telp || rowData['No. Telepon'];
    const status = rowData.status || rowData.Status;
    
    return {
        nama: String(rowData.nama || rowData['Nama Lengkap *']).trim(),
        nip: String(nip).trim(),
        username: String(username).trim(),
        password: String(password).trim(),
        email: email ? String(email).trim() : null,
        no_telp: noTelp ? String(noTelp).trim() : null,
        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
        mata_pelajaran: (rowData.mata_pelajaran || rowData['Mata Pelajaran']) 
            ? String(rowData.mata_pelajaran || rowData['Mata Pelajaran']).trim() 
            : null,
        alamat: (rowData.alamat || rowData.Alamat) 
            ? String(rowData.alamat || rowData.Alamat).trim() 
            : null,
        status: status ? String(status) : 'aktif'
    };
}

/**
 * Create row preview object for teacher error reporting
 * @param {Object} rowData - Row data from Excel
 * @returns {Object} Preview object with key fields
 */
function createTeacherRowPreview(rowData) {
    return {
        nama: rowData.nama || rowData['Nama Lengkap *'] || '(kosong)',
        username: rowData.username || rowData['Username *'] || '(kosong)',
        nip: rowData.nip || rowData['NIP *'] || '(kosong)'
    };
}

/**
 * Validate a complete teacher account row
 * @param {Object} rowData - Row data from Excel
 * @param {Object[]} validRecords - Already validated records
 * @param {Set} existingNips - Set of existing NIPs from database
 * @param {Set} existingUsernames - Set of existing usernames from database
 * @returns {{valid: boolean, errors: string[], data: Object|null}}
 */
function validateTeacherAccountRow(rowData, validRecords, existingNips, existingUsernames) {
    const errors = [];
    
    // Validate required fields
    errors.push(...validateRequiredTeacherFields(rowData));
    
    // Extract field values
    const nip = rowData.nip || rowData['NIP *'];
    const username = rowData.username || rowData['Username *'];
    const password = rowData.password || rowData['Password *'];
    const email = rowData.email || rowData.Email;
    const jenisKelamin = rowData.jenis_kelamin || rowData['Jenis Kelamin'];
    const noTelp = rowData.no_telp || rowData['No. Telepon'];
    const status = rowData.status || rowData.Status;
    
    // Validate individual fields
    errors.push(
        ...validateNIP(nip, validRecords, existingNips),
        ...validateUsername(username, validRecords, existingUsernames),
        ...validatePassword(password),
        ...validateEmail(email),
        ...validateGender(jenisKelamin),
        ...validatePhone(noTelp),
        ...validateStatus(status)
    );
    
    if (errors.length > 0) {
        return { valid: false, errors, data: null };
    }
    
    return { valid: true, errors: [], data: buildTeacherObject(rowData) };
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
    // Jadwal helpers
    getFieldValue,
    parseGuruIdsFromString,
    parseGuruNamesFromString,
    validateRequiredJadwalFields,
    buildJadwalObject,
    ALLOWED_DAYS,
    // Student account helpers
    validateStudentAccountRow,
    createStudentRowPreview,
    buildStudentObject,
    GENDER_ENUM,
    // Teacher account helpers
    validateTeacherAccountRow,
    createTeacherRowPreview,
    buildTeacherObject
};

