/**
 * Import Persistence Service
 * Handles database operations for Excel imports
 */
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Bulk upsert Mapel records
 * @param {Object} conn - Database connection
 * @param {Array} records - Validated records
 * @returns {Promise<number>} Count of inserted/updated records
 */
export const persistMapel = async (conn, records) => {
    let count = 0;
    for (const record of records) {
        await conn.execute(
            `INSERT INTO mapel (kode_mapel, nama_mapel, deskripsi, status)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE nama_mapel = VALUES(nama_mapel), deskripsi = VALUES(deskripsi), status = VALUES(status)`,
            [record.kode_mapel, record.nama_mapel, record.deskripsi, record.status]
        );
        count++;
    }
    return count;
};

/**
 * Bulk upsert Kelas records
 * @param {Object} conn - Database connection
 * @param {Array} records - Validated records
 * @returns {Promise<number>} Count of inserted/updated records
 */
export const persistKelas = async (conn, records) => {
    let count = 0;
    for (const record of records) {
        await conn.execute(
            `INSERT INTO kelas (nama_kelas, tingkat, status)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE tingkat = VALUES(tingkat), status = VALUES(status)`,
            [record.nama_kelas, record.tingkat, record.status]
        );
        count++;
    }
    return count;
};

/**
 * Bulk upsert Ruang records
 * @param {Object} conn - Database connection
 * @param {Array} records - Validated records
 * @returns {Promise<number>} Count of inserted/updated records
 */
export const persistRuang = async (conn, records) => {
    let count = 0;
    for (const record of records) {
        await conn.execute(
            `INSERT INTO ruang_kelas (kode_ruang, nama_ruang, lokasi, kapasitas, status)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE nama_ruang = VALUES(nama_ruang), lokasi = VALUES(lokasi), kapasitas = VALUES(kapasitas), status = VALUES(status)`,
            [record.kode_ruang, record.nama_ruang, record.lokasi, record.kapasitas, record.status]
        );
        count++;
    }
    return count;
};

/**
 * Process a single siswa data record (insert or update)
 * @param {Object} conn - Database connection
 * @param {Object} record - Validated record
 * @returns {Promise<'new'|'updated'>} Status of the operation
 */
export const processSiswaData = async (conn, record) => {
    // Find kelas_id by class name
    const [kelasResult] = await conn.execute(
        'SELECT id_kelas FROM kelas WHERE nama_kelas = ?',
        [record.kelas]
    );

    if (kelasResult.length === 0) {
        throw new Error(`Kelas '${record.kelas}' tidak ditemukan`);
    }

    const kelasId = kelasResult[0].id_kelas;

    // Check if NIS already exists
    const [existingSiswa] = await conn.execute(
        'SELECT id_siswa FROM siswa WHERE nis = ?',
        [record.nis]
    );

    if (existingSiswa.length > 0) {
        // Update existing student
        await conn.execute(
            `UPDATE siswa SET 
             nama = ?, kelas_id = ?, jenis_kelamin = ?, 
             telepon_orangtua = ?, nomor_telepon_siswa = ?, alamat = ?, status = ?, 
             updated_at = CURRENT_TIMESTAMP
             WHERE nis = ?`,
            [record.nama, kelasId, record.jenis_kelamin, record.telepon_orangtua, record.nomor_telepon_siswa, record.alamat, record.status, record.nis]
        );
        return 'updated';
    }

    // Insert new student
    await conn.execute(
        `INSERT INTO siswa (nis, nama, kelas_id, jenis_kelamin, telepon_orangtua, nomor_telepon_siswa, alamat, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [record.nis, record.nama, kelasId, record.jenis_kelamin, record.telepon_orangtua, record.nomor_telepon_siswa, record.alamat, record.status]
    );
    return 'new';
};

/**
 * Process a single guru data record (insert or update)
 * @param {Object} conn - Database connection
 * @param {Object} record - Validated record
 * @returns {Promise<'new'|'updated'>} Status of the operation
 */
export const processGuruData = async (conn, record) => {
    // Check if NIP already exists
    const [existingGuru] = await conn.execute(
        'SELECT id_guru FROM guru WHERE nip = ?',
        [record.nip]
    );

    if (existingGuru.length > 0) {
        // Update existing teacher
        await conn.execute(
            `UPDATE guru SET 
             nama = ?, jenis_kelamin = ?, email = ?, no_telepon = ?,
             alamat = ?, jabatan = ?, status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE nip = ?`,
            [record.nama, record.jenis_kelamin, record.email, record.nomor_telepon, record.alamat, record.jabatan, record.status, record.nip]
        );
        return 'updated';
    }

    // Insert new teacher
    await conn.execute(
        `INSERT INTO guru (nip, nama, jenis_kelamin, email, no_telepon, alamat, jabatan, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [record.nip, record.nama, record.jenis_kelamin, record.email, record.nomor_telepon, record.alamat, record.jabatan, record.status]
    );
    return 'new';
};

/**
 * Process teacher account (create/update user & guru)
 */
export const processTeacherAccount = async (conn, record) => {
    const [existingGuru] = await conn.execute('SELECT id_guru, user_id FROM guru WHERE nip = ?', [record.nip]);
    const [existingUser] = await conn.execute('SELECT id FROM users WHERE username = ?', [record.username]);

    if (existingUser.length > 0 && !existingGuru.length) {
        throw new Error(`Username '${record.username}' sudah digunakan oleh user lain`);
    }

    if (existingGuru.length > 0) {
        // Update Existing
        await conn.execute(
            `UPDATE guru SET 
             nama = ?, jenis_kelamin = ?, email = ?, no_telepon = ?,
             alamat = ?, jabatan = ?, status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE nip = ?`,
            [record.nama, record.jenis_kelamin, record.email, record.no_telp, record.alamat, record.mata_pelajaran, record.status, record.nip]
        );

        const hashedPassword = await bcrypt.hash(record.password, SALT_ROUNDS);
        await conn.execute(
            `UPDATE users SET 
             username = ?, password = ?, nama = ?, email = ?, 
             updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [record.username, hashedPassword, record.nama, record.email, existingGuru[0].user_id]
        );
        return 'updated';
    } else {
        // Insert New
        const hashedPassword = await bcrypt.hash(record.password, SALT_ROUNDS);
        const [userResult] = await conn.execute(
            `INSERT INTO users (username, password, role, nama, email, status, created_at, updated_at)
             VALUES (?, ?, 'guru', ?, ?, 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [record.username, hashedPassword, record.nama, record.email]
        );

        const userId = userResult.insertId;

        await conn.execute(
            `INSERT INTO guru (nip, nama, jenis_kelamin, email, no_telepon, alamat, jabatan, user_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [record.nip, record.nama, record.jenis_kelamin, record.email, record.no_telp, record.alamat, record.mata_pelajaran, userId, record.status]
        );
        return 'new';
    }
};

/**
 * Process student account (create/update user & siswa)
 */
export const processStudentAccount = async (conn, record) => {
    // Check if NIS already exists
    const [existingSiswa] = await conn.execute('SELECT id_siswa, nis FROM siswa WHERE nis = ?', [record.nis]);
    const [existingUser] = await conn.execute('SELECT id FROM users WHERE username = ?', [record.username]);

    if (existingUser.length > 0) {
        // If user exists, check if linked to this siswa?
        // Simplification: Don't allow username reuse unless it's update logic (not handled here fully)
        // For import, we might throw error if username taken by someone else
        // But if we want to update password:
        const hashedPassword = await bcrypt.hash(record.password, SALT_ROUNDS);
        await conn.execute(
            `UPDATE users SET password = ?, nama = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [hashedPassword, record.nama, record.email, existingUser[0].id]
        );
        
        // Ensure siswa exists or update it?
        // Check linkage?
        // For now, assume update valid.
    } else {
        // New User
        const hashedPassword = await bcrypt.hash(record.password, SALT_ROUNDS);
        await conn.execute(
            `INSERT INTO users (username, password, role, nama, email, status, created_at, updated_at)
             VALUES (?, ?, 'siswa', ?, ?, 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [record.username, hashedPassword, record.nama, record.email]
        );
    }

    // Upsert Siswa
    // We need map from username/user to siswa?
    // Actually Siswa Import usually doesn't link user_id explicitly in schema shown before?
    // Let's check schema.
    // In `importController.js`, `importSiswa` (Data) didn't use `user_id`.
    // But `importStudentAccount` implies creating account.
    // If schema has `user_id` in siswa table, we should set it.
    // Let's assume it does (like guru).
    
    // Get user id
    const [user] = await conn.execute('SELECT id FROM users WHERE username = ?', [record.username]);
    const userId = user[0].id;
    
    // Map Kelas ID
    const [kelas] = await conn.execute('SELECT id_kelas FROM kelas WHERE nama_kelas = ?', [record.kelas]);
    if (!kelas.length) throw new Error(`Kelas ${record.kelas} tidak ditemukan`);
    const kelasId = kelas[0].id_kelas;

    if (existingSiswa.length > 0) {
        // Update Siswa
        await conn.execute(
            `UPDATE siswa SET 
             nama = ?, kelas_id = ?, email = ?, jenis_kelamin = ?, 
             user_id = ?, updated_at = CURRENT_TIMESTAMP
             WHERE nis = ?`,
            [record.nama, kelasId, record.email, record.jenis_kelamin, userId, record.nis]
        );
        return 'updated';
    } else {
        // Insert Siswa
        await conn.execute(
            `INSERT INTO siswa (nis, nama, kelas_id, jenis_kelamin, email, user_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [record.nis, record.nama, kelasId, record.jenis_kelamin, record.email, userId]
        );
        return 'new';
    }
};
