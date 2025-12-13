/**
 * Ruang Controller
 * CRUD operations for classroom/room management
 * Migrated from server_modern.js
 */

import { sendDatabaseError } from '../utils/errorHandler.js';

// ================================================
// RUANG CRUD ENDPOINTS
// ================================================

// Get all rooms
export const getRuang = async (req, res) => {
    try {
        console.log('🏢 Getting rooms for admin');

        const { search } = req.query;
        let query = `
            SELECT 
                id_ruang as id,
                kode_ruang,
                nama_ruang,
                lokasi,
                kapasitas,
                status,
                created_at
            FROM ruang_kelas
        `;

        const params = [];
        if (search) {
            query += ` WHERE kode_ruang LIKE ? OR nama_ruang LIKE ? OR lokasi LIKE ?`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ` ORDER BY kode_ruang`;

        const [rows] = await global.dbPool.execute(query, params);
        console.log(`✅ Rooms retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Get single room
export const getRuangById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🏢 Getting room ${id}`);

        const [rows] = await global.dbPool.execute(
            'SELECT * FROM ruang_kelas WHERE id_ruang = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Ruang tidak ditemukan' });
        }

        res.json(rows[0]);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Create new room
export const createRuang = async (req, res) => {
    try {
        const { kode_ruang, nama_ruang, lokasi, kapasitas, status } = req.body;
        console.log('➕ Creating room:', { kode_ruang, nama_ruang, lokasi, kapasitas, status });

        // Validation
        if (!kode_ruang) {
            return res.status(400).json({ error: 'Kode ruang wajib diisi' });
        }

        // Convert to uppercase and validate format
        const kodeUpper = kode_ruang.toUpperCase().trim();
        if (kodeUpper.length > 10) {
            return res.status(400).json({ error: 'Kode ruang maksimal 10 karakter' });
        }

        // Check for duplicate kode_ruang
        const [existing] = await global.dbPool.execute(
            'SELECT id_ruang FROM ruang_kelas WHERE kode_ruang = ?',
            [kodeUpper]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Kode ruang sudah digunakan' });
        }

        // Insert new room
        const [result] = await global.dbPool.execute(
            `INSERT INTO ruang_kelas (kode_ruang, nama_ruang, lokasi, kapasitas, status) 
             VALUES (?, ?, ?, ?, ?)`,
            [kodeUpper, nama_ruang || null, lokasi || null, kapasitas || null, status || 'aktif']
        );

        console.log(`✅ Room created with ID: ${result.insertId}`);
        res.status(201).json({
            success: true,
            message: 'Ruang berhasil ditambahkan',
            id: result.insertId
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Update room
export const updateRuang = async (req, res) => {
    try {
        const { id } = req.params;
        const { kode_ruang, nama_ruang, lokasi, kapasitas, status } = req.body;
        console.log('✏️ Updating room:', { id, kode_ruang, nama_ruang, lokasi, kapasitas, status });

        // Validation
        if (!kode_ruang) {
            return res.status(400).json({ error: 'Kode ruang wajib diisi' });
        }

        // Convert to uppercase and validate format
        const kodeUpper = kode_ruang.toUpperCase().trim();
        if (kodeUpper.length > 10) {
            return res.status(400).json({ error: 'Kode ruang maksimal 10 karakter' });
        }

        // Check for duplicate kode_ruang (excluding current room)
        const [existing] = await global.dbPool.execute(
            'SELECT id_ruang FROM ruang_kelas WHERE kode_ruang = ? AND id_ruang != ?',
            [kodeUpper, id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Kode ruang sudah digunakan' });
        }

        // Update room
        const [result] = await global.dbPool.execute(
            `UPDATE ruang_kelas 
             SET kode_ruang = ?, nama_ruang = ?, lokasi = ?, kapasitas = ?, status = ?
             WHERE id_ruang = ?`,
            [kodeUpper, nama_ruang || null, lokasi || null, kapasitas || null, status || 'aktif', id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ruang tidak ditemukan' });
        }

        console.log(`✅ Room updated: ${result.affectedRows} rows affected`);
        res.json({ success: true, message: 'Ruang berhasil diperbarui' });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Delete room
export const deleteRuang = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ Deleting room ${id}`);

        // Check if room is used in jadwal
        const [jadwalUsage] = await global.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal WHERE ruang_id = ?',
            [id]
        );

        if (jadwalUsage[0].count > 0) {
            return res.status(400).json({
                error: 'Tidak dapat menghapus ruang yang sedang digunakan dalam jadwal'
            });
        }

        // Delete room
        const [result] = await global.dbPool.execute(
            'DELETE FROM ruang_kelas WHERE id_ruang = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ruang tidak ditemukan' });
        }

        console.log(`✅ Room deleted: ${result.affectedRows} rows affected`);
        res.json({ success: true, message: 'Ruang berhasil dihapus' });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};
