/**
 * Teacher Data Controller
 * Handles CRUD operations for Teacher Data (Profile + User Account Sync)
 * Migrated from server_modern.js
 */

import bcrypt from 'bcrypt';

import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';

const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;

// Get teachers data for admin dashboard
export const getTeachersData = async (req, res) => {
    try {
        console.log('📋 Getting teachers data for admin dashboard');

        const query = `
            SELECT g.id, g.nip, g.nama, g.email, g.mata_pelajaran, 
                   g.alamat, g.no_telp as telepon, g.jenis_kelamin, 
                   COALESCE(g.status, 'aktif') as status
            FROM guru g
            ORDER BY g.nama ASC
        `;

        const [results] = await global.dbPool.execute(query);
        console.log(`✅ Teachers data retrieved: ${results.length} items`);
        res.json(results);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Add teacher data
export const addTeacherData = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { nip, nama, email, mata_pelajaran, alamat, telepon, jenis_kelamin, status } = req.body;
        console.log('➕ Adding teacher data:', { nip, nama, mata_pelajaran });

        if (!nip || !nama || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIP, nama, dan jenis kelamin wajib diisi' });
        }

        // Check if NIP already exists
        const [existing] = await global.dbPool.execute(
            'SELECT id FROM guru WHERE nip = ?',
            [nip]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'NIP sudah terdaftar' });
        }

        // Start transaction
        await connection.beginTransaction();

        try {
            // Create a dummy user account for data-only records
            const dummyUsername = `guru_${nip}_${Date.now()}`;
            const dummyPassword = await bcrypt.hash('dummy123', saltRounds);

            const [userResult] = await global.dbPool.execute(
                'INSERT INTO users (username, password, role, nama, status) VALUES (?, ?, ?, ?, ?)',
                [dummyUsername, dummyPassword, 'guru', nama, 'aktif']
            );

            // Insert guru data with user_id
            const query = `
                INSERT INTO guru (id_guru, user_id, username, nip, nama, email, mata_pelajaran, alamat, no_telp, jenis_kelamin, status)
                VALUES ((SELECT COALESCE(MAX(id_guru), 0) + 1 FROM guru g2), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await global.dbPool.execute(query, [
                userResult.insertId, dummyUsername, nip, nama, email || null, mata_pelajaran || null,
                alamat || null, telepon || null, jenis_kelamin, status || 'aktif'
            ]);

            await connection.commit();
            console.log('✅ Teacher data added successfully:', result.insertId);
            res.json({ message: 'Data guru berhasil ditambahkan', id: result.insertId });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error adding teacher data:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'NIP sudah terdaftar' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    } finally {
        connection.release();
    }
};

// Update teacher data
export const updateTeacherData = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        const { nip, nama, email, mata_pelajaran, alamat, telepon, jenis_kelamin, status } = req.body;
        console.log('📝 Updating teacher data:', { id, nip, nama });

        if (!nip || !nama || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIP, nama, dan jenis kelamin wajib diisi' });
        }

        // Check if NIP already exists for other records
        const [existing] = await global.dbPool.execute(
            'SELECT id FROM guru WHERE nip = ? AND id != ?',
            [nip, id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'NIP sudah digunakan oleh guru lain' });
        }

        await connection.beginTransaction();

        try {
            // Update user account name if it exists
            const [guruData] = await global.dbPool.execute(
                'SELECT user_id FROM guru WHERE id = ?',
                [id]
            );

            if (guruData.length > 0 && guruData[0].user_id) {
                await global.dbPool.execute(
                    'UPDATE users SET nama = ? WHERE id = ?',
                    [nama, guruData[0].user_id]
                );
            }

            // Update guru data
            const updateQuery = `
                UPDATE guru 
                SET nip = ?, nama = ?, email = ?, mata_pelajaran = ?, 
                    alamat = ?, no_telp = ?, jenis_kelamin = ?, status = ?
                WHERE id = ?
            `;

            const [result] = await global.dbPool.execute(updateQuery, [
                nip, nama, email || null, mata_pelajaran || null,
                alamat || null, telepon || null, jenis_kelamin, status || 'aktif', id
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Data guru tidak ditemukan' });
            }

            await connection.commit();
            console.log('✅ Teacher data updated successfully');
            res.json({ message: 'Data guru berhasil diupdate' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    } finally {
        connection.release();
    }
};

// Delete teacher data
export const deleteTeacherData = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        console.log('🗑️ Deleting teacher data:', { id });

        await connection.beginTransaction();

        try {
            // Get user_id first
            const [guruData] = await global.dbPool.execute(
                'SELECT user_id FROM guru WHERE id = ?',
                [id]
            );

            if (guruData.length === 0) {
                return res.status(404).json({ error: 'Data guru tidak ditemukan' });
            }

            // Delete guru data first (foreign key constraint)
            const [result] = await global.dbPool.execute(
                'DELETE FROM guru WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                // Should be unreachable given select above, but safe
                await connection.rollback();
                return res.status(404).json({ error: 'Data guru tidak ditemukan' });
            }

            // Delete from users table (CASCADE should handle this, but let's be explicit)
            if (guruData[0].user_id) {
                await global.dbPool.execute(
                    'DELETE FROM users WHERE id = ?',
                    [guruData[0].user_id]
                );
            }

            // Commit transaction
            await connection.commit();

            console.log('✅ Teacher data deleted successfully');
            res.json({ message: 'Data guru berhasil dihapus' });
        } catch (error) {
            // Rollback transaction on error
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    } finally {
        connection.release();
    }
};
