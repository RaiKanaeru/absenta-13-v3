/**
 * Ruang Service
 * Handles database operations for room management
 */
import db from '../config/db.js';

// Custom Error Classes for Service Layer
export class ServiceError extends Error {
    constructor(message, code, details = null) {
        super(message);
        this.code = code;
        this.details = details;
    }
}

/**
 * Get all rooms
 */
export const getAllRuang = async (search = null) => {
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

    const [rows] = await db.execute(query, params);
    return rows;
};

/**
 * Get room by ID
 */
export const getRuangById = async (id) => {
    const [rows] = await db.execute(
        'SELECT id_ruang as id, kode_ruang, nama_ruang, lokasi, kapasitas, status, created_at FROM ruang_kelas WHERE id_ruang = ? LIMIT 1',
        [id]
    );
    return rows[0] || null;
};

/**
 * Create new room
 */
export const createRuang = async (data) => {
    const { kode_ruang, nama_ruang, lokasi, kapasitas, status } = data;
    
    // Normalize code
    const kodeUpper = kode_ruang.toUpperCase().trim();

    // Check duplicate
    const [existing] = await db.execute(
        'SELECT id_ruang FROM ruang_kelas WHERE kode_ruang = ?',
        [kodeUpper]
    );

    if (existing.length > 0) {
        throw new ServiceError('Kode ruang sudah digunakan', 'DUPLICATE_CODE');
    }

    // Insert
    const [result] = await db.execute(
        `INSERT INTO ruang_kelas (kode_ruang, nama_ruang, lokasi, kapasitas, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [kodeUpper, nama_ruang || null, lokasi || null, kapasitas || null, status || 'aktif']
    );

    return { id: result.insertId, kode_ruang: kodeUpper };
};

/**
 * Update room
 */
export const updateRuang = async (id, data) => {
    const { kode_ruang, nama_ruang, lokasi, kapasitas, status } = data;
    const kodeUpper = kode_ruang.toUpperCase().trim();

    // Check duplicate (excluding self)
    const [existing] = await db.execute(
        'SELECT id_ruang FROM ruang_kelas WHERE kode_ruang = ? AND id_ruang != ?',
        [kodeUpper, id]
    );

    if (existing.length > 0) {
        throw new ServiceError('Kode ruang sudah digunakan', 'DUPLICATE_CODE');
    }

    // Update
    const [result] = await db.execute(
        `UPDATE ruang_kelas 
         SET kode_ruang = ?, nama_ruang = ?, lokasi = ?, kapasitas = ?, status = ?
         WHERE id_ruang = ?`,
        [kodeUpper, nama_ruang || null, lokasi || null, kapasitas || null, status || 'aktif', id]
    );

    if (result.affectedRows === 0) {
        throw new ServiceError('Ruang tidak ditemukan', 'NOT_FOUND');
    }

    return true;
};

/**
 * Delete room
 */
export const deleteRuang = async (id) => {
    // Check usage in jadwal
    const [jadwalUsage] = await db.execute(
        'SELECT COUNT(*) as count FROM jadwal WHERE ruang_id = ?',
        [id]
    );

    if (jadwalUsage[0].count > 0) {
        throw new ServiceError(
            'Tidak dapat menghapus ruang yang sedang digunakan dalam jadwal', 
            'IN_USE',
            { jadwalCount: jadwalUsage[0].count }
        );
    }

    // Delete
    const [result] = await db.execute(
        'DELETE FROM ruang_kelas WHERE id_ruang = ?',
        [id]
    );

    if (result.affectedRows === 0) {
        throw new ServiceError('Ruang tidak ditemukan', 'NOT_FOUND');
    }

    return true;
};
