import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { getMySQLDateTimeWIB } from '../utils/timeUtils.js';

dotenv.config();

const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;

// Validasi payload guru untuk Create/Update
async function validateGuruPayload(body, { isUpdate = false, excludeGuruId = null, excludeUserId = null } = {}) {
    const errors = [];
    const { nip, nama, username, email, mapel_id, status, password } = body;

    console.log('🔍 Validating guru payload:', { isUpdate, excludeGuruId, excludeUserId, body });
    // console.log('🔍 Database pool status:', global.dbPool ? 'Available' : 'Not available');

    try {

        // Validasi NIP (wajib)
        if (!isUpdate || nip !== undefined) {
            if (!nip || typeof nip !== 'string') {
                errors.push('NIP wajib diisi');
            } else if (!/^[0-9]{10,20}$/.test(nip)) {
                errors.push('NIP harus berupa angka 10-20 digit');
            } else {
                // Cek unik NIP
                try {
                    // console.log('🔍 Checking NIP uniqueness for:', nip);
                    let sql = 'SELECT id FROM guru WHERE nip = ?';
                    const params = [nip];
                    if (isUpdate && excludeGuruId) {
                        sql += ' AND id != ?';
                        params.push(excludeGuruId);
                    }
                    // console.log('🔍 NIP query:', sql, params);
                    const [existingNip] = await global.dbPool.execute(sql, params);
                    // console.log('🔍 NIP query result:', existingNip);
                    if (existingNip.length > 0) {
                        errors.push('NIP sudah digunakan');
                    }
                } catch (error) {
                    console.error('Error checking NIP uniqueness:', error);
                    // Jangan tambahkan error ke array, biarkan validasi gagal dengan error yang lebih jelas
                    throw new Error('Gagal memvalidasi NIP: ' + error.message);
                }
            }
        }

        // Validasi nama (wajib)
        if (!isUpdate || nama !== undefined) {
            if (!nama || typeof nama !== 'string' || nama.trim().length < 2) {
                errors.push('Nama lengkap wajib diisi minimal 2 karakter');
            }
        }

        // Validasi username (wajib)
        if (!isUpdate || username !== undefined) {
            if (!username || typeof username !== 'string') {
                errors.push('Username wajib diisi');
            } else if (!/^[a-zA-Z0-9._-]{4,32}$/.test(username)) {
                errors.push('Username harus 4-32 karakter, hanya huruf, angka, titik, underscore, dan strip');
            } else {
                // Cek unik username di users
                try {
                    let sql = 'SELECT id FROM users WHERE username = ?';
                    const params = [username];
                    if (isUpdate && excludeUserId) {
                        sql += ' AND id != ?';
                        params.push(excludeUserId);
                    }
                    const [existingUsers] = await global.dbPool.execute(sql, params);
                    if (existingUsers.length > 0) {
                        errors.push('Username sudah digunakan');
                    }
                } catch (error) {
                    console.error('Error checking username uniqueness:', error);
                    throw new Error('Gagal memvalidasi username: ' + error.message);
                }
            }
        }

        // Validasi email (opsional)
        if (email !== undefined && email !== null && email !== '') {
            if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errors.push('Format email tidak valid');
            } else {
                // Cek unik email di users
                try {
                    let sql = 'SELECT id FROM users WHERE email = ?';
                    const params = [email];
                    if (isUpdate && excludeUserId) {
                        sql += ' AND id != ?';
                        params.push(excludeUserId);
                    }
                    const [existingUsers] = await global.dbPool.execute(sql, params);
                    if (existingUsers.length > 0) {
                        errors.push('Email sudah digunakan');
                    }
                } catch (error) {
                    console.error('Error checking email uniqueness:', error);
                    throw new Error('Gagal memvalidasi email: ' + error.message);
                }
            }
        }

        // Validasi mapel_id (opsional)
        if (mapel_id !== undefined && mapel_id !== null && mapel_id !== '' && mapel_id !== 0) {
            if (!Number.isInteger(Number(mapel_id)) || Number(mapel_id) <= 0) {
                errors.push('ID mata pelajaran harus berupa angka positif');
            } else {
                try {
                    const [existingMapel] = await global.dbPool.execute(
                        'SELECT id_mapel FROM mapel WHERE id_mapel = ? AND status = "aktif"',
                        [mapel_id]
                    );
                    if (existingMapel.length === 0) {
                        errors.push('Mata pelajaran tidak ditemukan atau tidak aktif');
                    }
                } catch (error) {
                    console.error('Error checking mapel existence:', error);
                    throw new Error('Gagal memvalidasi mata pelajaran: ' + error.message);
                }
            }
        }


        // Validasi status
        if (status !== undefined && status !== null && status !== '') {
            if (!['aktif', 'nonaktif', 'pensiun'].includes(status)) {
                errors.push('Status harus aktif, nonaktif, atau pensiun');
            }
        }

        // Validasi password (wajib untuk create, opsional untuk update)
        if (!isUpdate && (!password || typeof password !== 'string' || password.length < 6)) {
            errors.push('Password wajib diisi minimal 6 karakter');
        }
        if (isUpdate && password !== undefined && password !== null && password !== '' && (typeof password !== 'string' || password.length < 6)) {
            errors.push('Password minimal 6 karakter');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    } catch (error) {
        console.error('❌ Validation function error:', error);
        throw new Error('Gagal memvalidasi data: ' + error.message);
    }
}

// Get All Guru
export const getGuru = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT g.id, g.nip, g.nama, g.username, g.email, g.no_telp, g.jenis_kelamin, g.alamat,
                   g.mapel_id, COALESCE(m.nama_mapel, g.mata_pelajaran) AS nama_mapel,
                   g.status, u.id AS user_id, u.username AS user_username, u.email AS user_email, u.status AS user_status
            FROM guru g
            LEFT JOIN mapel m ON g.mapel_id = m.id_mapel
            LEFT JOIN users u ON g.user_id = u.id
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM guru g';
        let params = [];

        if (search) {
            query += ' WHERE (g.nama LIKE ? OR g.nip LIKE ? OR g.username LIKE ? OR COALESCE(m.nama_mapel, g.mata_pelajaran) LIKE ?)';
            countQuery += ' WHERE (g.nama LIKE ? OR g.nip LIKE ? OR g.username LIKE ?)';
            params = [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`];
        }

        query += ` ORDER BY g.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

        const [rows] = await global.dbPool.query(query, params);
        const [countResult] = await global.dbPool.query(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);

        res.json({
            success: true,
            data: rows,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('❌ Get guru error:', error);
        res.status(500).json({ error: 'Failed to retrieve teacher data' });
    }
};

// Create Guru
export const createGuru = async (req, res) => {
    console.log('🔍 Creating new guru with data:', req.body);

    const connection = await global.dbPool.getConnection();
    // console.log('✅ Database connection acquired');

    try {
        const { nip, nama, mapel_id, username, password, email, no_telp, jenis_kelamin, alamat, status = 'aktif' } = req.body;

        // Validasi payload
        // console.log('🔍 Validating guru payload...');
        const validation = await validateGuruPayload(req.body, { isUpdate: false });
        
        if (!validation.isValid) {
            // console.log('❌ Validation failed:', validation.errors);
            return res.status(400).json({
                error: 'Data tidak valid',
                details: validation.errors
            });
        }

        // console.log('✅ Validation passed');

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Start transaction
        // console.log('🔄 Starting database transaction...');
        await connection.beginTransaction();

        try {
            // Create user account
            // console.log('🔄 Creating user account...');
            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, role, nama, email, status) VALUES (?, ?, "guru", ?, ?, ?)',
                [username, hashedPassword, nama, email || null, status]
            );
            // console.log('✅ User account created with ID:', userResult.insertId);

            // Create guru record
            // console.log('🔄 Creating guru record...');
            const mapelIdValue = (mapel_id && mapel_id > 0) ? mapel_id : null;
            
            await connection.execute(
                'INSERT INTO guru (id_guru, nip, nama, username, email, no_telp, jenis_kelamin, alamat, mapel_id, user_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [userResult.insertId, nip, nama, username, email || null, no_telp || null, jenis_kelamin || null, alamat || null, mapelIdValue, userResult.insertId, status]
            );
            // console.log('✅ Guru record created');

            await connection.commit();
            console.log(`✅ New guru created: ${nama} (${nip})`);
            res.json({ success: true, message: 'Guru berhasil ditambahkan' });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('❌ Create guru error:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'NIP atau username sudah digunakan' });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ error: 'Mata pelajaran tidak ditemukan' });
        } else {
            res.status(500).json({
                error: 'Gagal membuat akun guru',
                details: error.message
            });
        }
    } finally {
        connection.release();
    }
};

// Update Guru
export const updateGuru = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        const { nip, nama, mapel_id, username, password, email, no_telp, jenis_kelamin, alamat, status } = req.body;

        console.log('📝 Updating guru:', { id, nip, nama, username, email });

        // Cek apakah guru ada
        const [existingGuru] = await connection.execute(
            'SELECT g.*, u.id as user_id FROM guru g LEFT JOIN users u ON g.user_id = u.id WHERE g.id = ?',
            [id]
        );

        if (existingGuru.length === 0) {
            return res.status(404).json({ error: 'Guru tidak ditemukan' });
        }

        const guru = existingGuru[0];

        // Validasi payload
        try {
            const validation = await validateGuruPayload(req.body, {
                isUpdate: true,
                excludeGuruId: guru.id,
                excludeUserId: guru.user_id
            });

            if (!validation.isValid) {
                return res.status(400).json({
                    error: 'Data tidak valid',
                    details: validation.errors
                });
            }

        } catch (validationError) {
            console.error('❌ Validation error:', validationError);
            return res.status(400).json({
                error: 'Gagal memvalidasi data',
                details: validationError.message
            });
        }

        // Start transaction
        await connection.beginTransaction();

        try {
            // Update guru record
            const updateFields = [];
            const updateValues = [];

            if (nip !== undefined) { updateFields.push('nip = ?'); updateValues.push(nip); }
            if (nama !== undefined) { updateFields.push('nama = ?'); updateValues.push(nama); }
            if (username !== undefined) { updateFields.push('username = ?'); updateValues.push(username); }
            if (email !== undefined) { updateFields.push('email = ?'); updateValues.push(email); }
            if (no_telp !== undefined) { updateFields.push('no_telp = ?'); updateValues.push(no_telp); }
            if (jenis_kelamin !== undefined) { updateFields.push('jenis_kelamin = ?'); updateValues.push(jenis_kelamin); }
            if (alamat !== undefined) { updateFields.push('alamat = ?'); updateValues.push(alamat); }
            if (mapel_id !== undefined) { updateFields.push('mapel_id = ?'); updateValues.push(mapel_id); }
            if (status !== undefined) { updateFields.push('status = ?'); updateValues.push(status); }

            if (updateFields.length > 0) {
                updateValues.push(id);
                // console.log('🔄 Updating guru with fields:', updateFields);
                await connection.execute(
                    `UPDATE guru SET ${updateFields.join(', ')} WHERE id = ?`,
                    updateValues
                );
            }

            // Update users record
            const userUpdateFields = [];
            const userUpdateValues = [];

            if (nama !== undefined) { userUpdateFields.push('nama = ?'); userUpdateValues.push(nama); }
            if (username !== undefined) { userUpdateFields.push('username = ?'); userUpdateValues.push(username); }
            if (email !== undefined) { userUpdateFields.push('email = ?'); userUpdateValues.push(email); }
            if (status !== undefined) { userUpdateFields.push('status = ?'); userUpdateValues.push(status); }
            if (password !== undefined && password !== '') {
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                userUpdateFields.push('password = ?');
                userUpdateValues.push(hashedPassword);
            }

            if (userUpdateFields.length > 0 && guru.user_id) {
                userUpdateValues.push(guru.user_id);
                // console.log('🔄 Updating users with fields:', userUpdateFields);
                await connection.execute(
                    `UPDATE users SET ${userUpdateFields.join(', ')} WHERE id = ?`,
                    userUpdateValues
                );
            }

            await connection.commit();
            console.log(`✅ Guru updated: ${nama || guru.nama} (${nip || guru.nip})`);
            res.json({ success: true, message: 'Guru berhasil diperbarui' });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('❌ Update guru error:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'NIP atau username sudah digunakan' });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ error: 'Referensi data tidak valid' });
        } else {
            res.status(500).json({
                error: 'Gagal memperbarui guru',
                details: error.message
            });
        }
    } finally {
        connection.release();
    }
};

// Delete Guru
export const deleteGuru = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;

        // Cek apakah guru ada
        const [existingGuru] = await connection.execute(
            'SELECT g.*, u.id as user_id FROM guru g LEFT JOIN users u ON g.user_id = u.id WHERE g.id = ?',
            [id]
        );

        if (existingGuru.length === 0) {
            return res.status(404).json({ error: 'Guru tidak ditemukan' });
        }

        const guru = existingGuru[0];

        // Start transaction
        await connection.beginTransaction();

        try {
            // Delete guru record (akan cascade ke users karena FK constraint)
            await connection.execute('DELETE FROM guru WHERE id = ?', [id]);

            // Delete user record jika masih ada
            if (guru.user_id) {
                await connection.execute('DELETE FROM users WHERE id = ?', [guru.user_id]);
            }

            await connection.commit();
            console.log(`✅ Guru deleted: ${guru.nama} (${guru.nip})`);
            res.json({ success: true, message: 'Guru berhasil dihapus' });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('❌ Delete guru error:', error);

        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({ error: 'Tidak dapat menghapus guru karena masih memiliki relasi dengan data lain' });
        } else {
            res.status(500).json({ error: 'Gagal menghapus guru' });
        }
    } finally {
        connection.release();
    }
};

// ================================================
// PROFILE UPDATE FUNCTIONS (Migrated from server_modern.js)
// ================================================

// Update profile for guru (self-service)
export const updateProfile = async (req, res) => {
    try {
        const { nama, username, email, alamat, no_telepon, jenis_kelamin, mata_pelajaran, jabatan } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!nama || !username) {
            return res.status(400).json({ error: 'Nama dan username wajib diisi' });
        }

        // Check if username is already taken by another user in users table
        const [existingUser] = await global.dbPool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, userId]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan oleh user lain' });
        }

        // Start transaction
        const connection = await global.dbPool.getConnection();
        await connection.beginTransaction();

        try {
            // Update profile in users table (username, email)
            await connection.execute(
                `UPDATE users SET 
                    nama = ?, 
                    username = ?, 
                    email = ?,
                    updated_at = ?
                WHERE id = ?`,
                [nama, username, email || null, getMySQLDateTimeWIB(), userId]
            );

            // Update additional profile data in guru table
            await connection.execute(
                `UPDATE guru SET 
                    nama = ?, 
                    alamat = ?, 
                    no_telp = ?,
                    jenis_kelamin = ?,
                    mata_pelajaran = ?,
                    updated_at = ?
                WHERE user_id = ?`,
                [nama, alamat || null, no_telepon || null, jenis_kelamin || null, mata_pelajaran || null, getMySQLDateTimeWIB(), userId]
            );

            await connection.commit();

            // Get updated user data
            const [updatedUser] = await global.dbPool.execute(
                `SELECT u.id, u.username, u.nama, u.email, u.role, g.alamat, g.no_telp as no_telepon, 
                        g.nip, g.jenis_kelamin, g.mata_pelajaran, u.created_at, u.updated_at 
                 FROM users u 
                 LEFT JOIN guru g ON u.id = g.user_id 
                 WHERE u.id = ?`,
                [userId]
            );

            res.json({
                success: true,
                message: 'Profil berhasil diperbarui',
                data: updatedUser[0]
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('❌ Error updating guru profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Change password for guru (self-service)
export const changePassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!newPassword) {
            return res.status(400).json({ error: 'Password baru wajib diisi' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password in users table
        await global.dbPool.execute(
            'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
            [hashedPassword, getMySQLDateTimeWIB(), userId]
        );

        res.json({
            success: true,
            message: 'Password berhasil diubah'
        });
    } catch (error) {
        console.error('❌ Error changing guru password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
