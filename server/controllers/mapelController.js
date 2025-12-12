import dotenv from 'dotenv';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';

dotenv.config();

// Get All Mapel
export const getMapel = async (req, res) => {
    try {
        console.log('📋 Getting subjects for admin dashboard');

        const query = `
            SELECT id_mapel as id, kode_mapel, nama_mapel, deskripsi, status
            FROM mapel 
            ORDER BY nama_mapel
        `;

        const [rows] = await global.dbPool.execute(query);
        console.log(`✅ Subjects retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Create Mapel
export const createMapel = async (req, res) => {
    try {
        const { kode_mapel, nama_mapel, deskripsi, status } = req.body;
        console.log('➕ Adding subject:', { kode_mapel, nama_mapel, deskripsi, status });

        if (!kode_mapel || !nama_mapel) {
            return res.status(400).json({ error: 'Kode dan nama mata pelajaran wajib diisi' });
        }

        // Check if kode_mapel already exists
        const [existing] = await global.dbPool.execute(
            'SELECT id_mapel FROM mapel WHERE kode_mapel = ?',
            [kode_mapel]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Kode mata pelajaran sudah digunakan' });
        }

        const insertQuery = `
            INSERT INTO mapel (kode_mapel, nama_mapel, deskripsi, status) 
            VALUES (?, ?, ?, ?)
        `;

        const [result] = await global.dbPool.execute(insertQuery, [
            kode_mapel,
            nama_mapel,
            deskripsi || null,
            status || 'aktif'
        ]);
        console.log('✅ Subject added successfully:', result.insertId);
        res.json({ message: 'Mata pelajaran berhasil ditambahkan', id: result.insertId });
    } catch (error) {
        console.error('❌ Error adding subject:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Kode mata pelajaran sudah digunakan' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

// Update Mapel
export const updateMapel = async (req, res) => {
    try {
        const { id } = req.params;
        const { kode_mapel, nama_mapel, deskripsi, status } = req.body;
        console.log('📝 Updating subject:', { id, kode_mapel, nama_mapel, deskripsi, status });

        if (!kode_mapel || !nama_mapel) {
            return res.status(400).json({ error: 'Kode dan nama mata pelajaran wajib diisi' });
        }

        // Check if kode_mapel already exists for other records
        const [existing] = await global.dbPool.execute(
            'SELECT id_mapel FROM mapel WHERE kode_mapel = ? AND id_mapel != ?',
            [kode_mapel, id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Kode mata pelajaran sudah digunakan oleh mata pelajaran lain' });
        }

        const updateQuery = `
            UPDATE mapel 
            SET kode_mapel = ?, nama_mapel = ?, deskripsi = ?, status = ?
            WHERE id_mapel = ?
        `;

        const [result] = await global.dbPool.execute(updateQuery, [
            kode_mapel,
            nama_mapel,
            deskripsi || null,
            status || 'aktif',
            id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan' });
        }

        console.log('✅ Subject updated successfully');
        res.json({ message: 'Mata pelajaran berhasil diupdate' });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Delete Mapel
export const deleteMapel = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting subject:', { id });

        const [result] = await global.dbPool.execute(
            'DELETE FROM mapel WHERE id_mapel = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan' });
        }

        console.log('✅ Subject deleted successfully');
        res.json({ message: 'Mata pelajaran berhasil dihapus' });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};
