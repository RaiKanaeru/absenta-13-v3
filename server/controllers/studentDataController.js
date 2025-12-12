/**
 * Student Data Controller
 * Handles CRUD operations for Student Data (Profile + User Account Sync) and Promotion
 * Migrated from server_modern.js
 */

import bcrypt from 'bcrypt';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';

import { getMySQLDateTimeWIB } from '../utils/timeUtils.js';

const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;

// Get students data for admin dashboard
export const getStudentsData = async (req, res) => {
    try {
        console.log('📋 Getting students data for admin dashboard');

        const query = `
            SELECT 
                s.id_siswa as id_siswa,
                s.id,
                s.nis, 
                s.nama, 
                s.kelas_id, 
                k.nama_kelas,
                s.jenis_kelamin,
                s.alamat,
                s.telepon_orangtua,
                s.nomor_telepon_siswa,
                COALESCE(s.status, 'aktif') as status
            FROM siswa s
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
            ORDER BY s.nama ASC
        `;

        const [results] = await global.dbPool.execute(query);
        console.log(`✅ Students data retrieved: ${results.length} items`);
        res.json(results);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Add student data
export const addStudentData = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, nomor_telepon_siswa, status } = req.body;
        console.log('➕ Adding student data:', { nis, nama, kelas_id });

        if (!nis || !nama || !kelas_id || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIS, nama, kelas, dan jenis kelamin wajib diisi' });
        }

        // Start transaction
        await connection.beginTransaction();

        // Check if NIS already exists
        const [existing] = await connection.execute(
            'SELECT id FROM siswa WHERE nis = ?',
            [nis]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({ error: 'NIS sudah terdaftar' });
        }

        // Generate username from NIS
        const username = `siswa_${nis}`;
        const email = `${nis}@student.absenta.com`;

        // First, insert into users table
        const createdAtWIB = getMySQLDateTimeWIB();
        const dummyPassword = await bcrypt.hash('Siswa123!', saltRounds);

        const userInsertQuery = `
            INSERT INTO users (username, password, email, role, nama, status, created_at)
            VALUES (?, ?, ?, 'siswa', ?, 'aktif', ?)
        `;

        const [userResult] = await connection.execute(userInsertQuery, [
            username, dummyPassword, email, nama, createdAtWIB // nama will be used for the nama field
        ]);

        const userId = userResult.insertId;
        console.log('✅ User created with ID:', userId);

        // Get next id_siswa
        const [maxIdResult] = await connection.execute(
            'SELECT COALESCE(MAX(id_siswa), 0) + 1 as next_id FROM siswa'
        );
        const nextIdSiswa = maxIdResult[0].next_id;

        // Then, insert into siswa table
        const studentInsertQuery = `
            INSERT INTO siswa (id, id_siswa, user_id, username, nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, nomor_telepon_siswa, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [studentResult] = await connection.execute(studentInsertQuery, [
            nextIdSiswa, // id (primary key)
            nextIdSiswa, // id_siswa
            userId,      // user_id (foreign key)
            username,    // username
            nis,         // nis
            nama,        // nama
            kelas_id,    // kelas_id
            jenis_kelamin, // jenis_kelamin
            alamat || null, // alamat
            telepon_orangtua || null, // telepon_orangtua
            nomor_telepon_siswa || null, // nomor_telepon_siswa
            status || 'aktif', // status
            createdAtWIB // created_at
        ]);

        // Commit transaction
        await connection.commit();

        console.log('✅ Student data added successfully:', studentResult.insertId);
        res.json({
            message: 'Data siswa berhasil ditambahkan',
            id: studentResult.insertId,
            userId: userId,
            username: username
        });
    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        console.error('❌ Error adding student data:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'NIS atau username sudah terdaftar' });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ error: 'Kelas tidak ditemukan' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    } finally {
        connection.release();
    }
};

// Update student data
export const updateStudentData = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        const { nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, status, nomor_telepon_siswa } = req.body;
        console.log('📝 Updating student data:', { id, nis, nama });

        if (!nis || !nama || !kelas_id || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIS, nama, kelas, dan jenis kelamin wajib diisi' });
        }

        // Validasi nomor telepon jika diisi
        if (nomor_telepon_siswa && !/^[0-9]{10,15}$/.test(nomor_telepon_siswa)) {
            return res.status(400).json({ error: 'Nomor telepon harus berupa angka 10-15 digit' });
        }

        // Cek unik nomor telepon jika diisi
        if (nomor_telepon_siswa) {
            const [existingPhone] = await connection.execute(
                'SELECT id FROM siswa WHERE nomor_telepon_siswa = ? AND id != ?',
                [nomor_telepon_siswa, id]
            );
            if (existingPhone.length > 0) {
                return res.status(400).json({ error: 'Nomor telepon siswa sudah digunakan' });
            }
        }

        // Start transaction
        await connection.beginTransaction();

        // Check if student exists
        const [studentExists] = await connection.execute(
            'SELECT user_id, username FROM siswa WHERE id = ?',
            [id]
        );

        if (studentExists.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
        }

        // Check if NIS already exists for other records
        const [existing] = await connection.execute(
            'SELECT id FROM siswa WHERE nis = ? AND id != ?',
            [nis, id]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({ error: 'NIS sudah digunakan oleh siswa lain' });
        }

        // Update siswa table
        // FIX: Use WIB timezone for updated_at
        const updatedAtWIB = getMySQLDateTimeWIB();
        const updateQuery = `
            UPDATE siswa 
            SET nis = ?, nama = ?, kelas_id = ?, jenis_kelamin = ?, 
                alamat = ?, telepon_orangtua = ?, nomor_telepon_siswa = ?, status = ?, updated_at = ?
            WHERE id = ?
        `;

        const [result] = await connection.execute(updateQuery, [
            nis, nama, kelas_id, jenis_kelamin,
            alamat || null, telepon_orangtua || null, nomor_telepon_siswa || null, status || 'aktif', updatedAtWIB, id
        ]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
        }

        // Update users table with nama (since siswa is a view)
        await connection.execute(
            'UPDATE users SET nama = ?, updated_at = ? WHERE id = ?',
            [nama, updatedAtWIB, studentExists[0].user_id]
        );

        // Commit transaction
        await connection.commit();

        console.log('✅ Student data updated successfully');
        res.json({ message: 'Data siswa berhasil diupdate' });
    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        console.error('❌ Error updating student data:', error);

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ error: 'Kelas tidak ditemukan' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    } finally {
        connection.release();
    }
};

// Delete student data
export const deleteStudentData = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        console.log('🗑️ Deleting student data:', { id });

        // Start transaction
        await connection.beginTransaction();

        // Get user_id before deleting
        const [studentData] = await connection.execute(
            'SELECT user_id FROM siswa WHERE id = ?',
            [id]
        );

        if (studentData.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
        }

        const userId = studentData[0].user_id;

        // Delete from siswa first (due to foreign key constraint)
        const [studentResult] = await connection.execute(
            'DELETE FROM siswa WHERE id = ?',
            [id]
        );

        if (studentResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
        }

        // Delete from users table (CASCADE should handle this, but let's be explicit)
        if (userId) {
            await connection.execute(
                'DELETE FROM users WHERE id = ?',
                [userId]
            );
        }

        // Commit transaction
        await connection.commit();

        console.log('✅ Student data deleted successfully');
        res.json({ message: 'Data siswa berhasil dihapus' });
    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        return sendDatabaseError(res, error);
    } finally {
        connection.release();
    }
};

// Student promotion (naik kelas)
export const promoteStudents = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { fromClassId, toClassId, studentIds } = req.body;
        console.log('🎓 Student promotion request:', { fromClassId, toClassId, studentIds });

        // Validasi input yang lebih ketat
        if (!fromClassId || !toClassId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({
                error: 'fromClassId, toClassId, dan studentIds wajib diisi',
                details: 'studentIds harus berupa array yang tidak kosong'
            });
        }

        // Validasi tipe data
        if (typeof fromClassId !== 'string' && typeof fromClassId !== 'number') {
            return res.status(400).json({ error: 'fromClassId harus berupa string atau number' });
        }
        if (typeof toClassId !== 'string' && typeof toClassId !== 'number') {
            return res.status(400).json({ error: 'toClassId harus berupa string atau number' });
        }
        if (!studentIds.every(id => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
            return res.status(400).json({ error: 'Semua studentIds harus berupa integer positif' });
        }

        // Start transaction
        await connection.beginTransaction();

        // Verify classes exist and get detailed info
        const [fromClass] = await connection.execute(
            'SELECT id_kelas, nama_kelas, tingkat FROM kelas WHERE id_kelas = ? AND status = "aktif"',
            [fromClassId]
        );

        const [toClass] = await connection.execute(
            'SELECT id_kelas, nama_kelas, tingkat FROM kelas WHERE id_kelas = ? AND status = "aktif"',
            [toClassId]
        );

        if (fromClass.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Kelas asal tidak ditemukan atau tidak aktif' });
        }

        if (toClass.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Kelas tujuan tidak ditemukan atau tidak aktif' });
        }

        // Validasi aturan bisnis: kelas XII tidak bisa dinaikkan
        if (fromClass[0].tingkat === 'XII') {
            await connection.rollback();
            return res.status(400).json({
                error: 'Kelas XII tidak dapat dinaikkan',
                details: 'Siswa kelas XII sudah lulus dan tidak dapat dipromosikan'
            });
        }

        // Validasi tingkat promosi (X->XI, XI->XII)
        const validPromotions = {
            'X': 'XI',
            'XI': 'XII'
        };

        if (validPromotions[fromClass[0].tingkat] !== toClass[0].tingkat) {
            await connection.rollback();
            return res.status(400).json({
                error: 'Promosi tidak valid',
                details: `Kelas ${fromClass[0].tingkat} hanya bisa dinaikkan ke kelas ${validPromotions[fromClass[0].tingkat]}`
            });
        }

        // Verify students exist and belong to fromClass
        const placeholders = studentIds.map(() => '?').join(',');
        const [students] = await connection.execute(
            `SELECT id_siswa, nama, nis, kelas_id FROM siswa 
             WHERE id_siswa IN (${placeholders}) AND kelas_id = ? AND status = 'aktif'`,
            [...studentIds, fromClassId]
        );

        if (students.length !== studentIds.length) {
            await connection.rollback();
            return res.status(400).json({
                error: 'Beberapa siswa tidak ditemukan atau tidak berada di kelas asal',
                details: `Ditemukan ${students.length} siswa dari ${studentIds.length} yang diminta`
            });
        }

        // Perform promotion (update class)
        const updatePlaceholders = studentIds.map(() => '?').join(',');
        const [updateResult] = await connection.execute(
            `UPDATE siswa SET kelas_id = ? WHERE id_siswa IN (${updatePlaceholders})`,
            [toClassId, ...studentIds]
        );

        // Commit transaction
        await connection.commit();

        console.log(`✅ Promoted ${updateResult.affectedRows} students from ${fromClass[0].nama_kelas} to ${toClass[0].nama_kelas}`);
        res.json({
            message: 'Siswa berhasil dinaikkan kelas',
            promotedCount: updateResult.affectedRows,
            fromClass: fromClass[0].nama_kelas,
            toClass: toClass[0].nama_kelas
        });
    } catch (error) {
        await connection.rollback();
        return sendDatabaseError(res, error);
    } finally {
        connection.release();
    }
};
