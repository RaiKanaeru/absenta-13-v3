/**
 * Jam Pelajaran Controller
 * CRUD operations for dynamic jam pelajaran per kelas
 */

import { sendDatabaseError, sendValidationError, sendNotFoundError } from '../utils/responseHelper.js';

/**
 * Get all jam pelajaran for a specific kelas
 * GET /api/admin/jam-pelajaran/:kelasId
 */
export const getJamPelajaranByKelas = async (req, res) => {
    try {
        const { kelasId } = req.params;
        
        const [rows] = await global.dbPool.execute(`
            SELECT jp.*, k.nama_kelas
            FROM jam_pelajaran jp
            JOIN kelas k ON jp.kelas_id = k.id_kelas
            WHERE jp.kelas_id = ?
            ORDER BY jp.jam_ke ASC
        `, [kelasId]);
        
        res.json({ success: true, data: rows });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get jam pelajaran for all kelas (for export/overview)
 * GET /api/admin/jam-pelajaran
 */
export const getAllJamPelajaran = async (req, res) => {
    try {
        const [rows] = await global.dbPool.execute(`
            SELECT jp.*, k.nama_kelas, k.tingkat
            FROM jam_pelajaran jp
            JOIN kelas k ON jp.kelas_id = k.id_kelas
            WHERE jp.status = 'aktif' AND k.status = 'aktif'
            ORDER BY k.tingkat, k.nama_kelas, jp.jam_ke ASC
        `);
        
        // Group by kelas
        const grouped = rows.reduce((acc, row) => {
            if (!acc[row.kelas_id]) {
                acc[row.kelas_id] = {
                    kelas_id: row.kelas_id,
                    nama_kelas: row.nama_kelas,
                    tingkat: row.tingkat,
                    jam_pelajaran: []
                };
            }
            acc[row.kelas_id].jam_pelajaran.push({
                id: row.id,
                jam_ke: row.jam_ke,
                jam_mulai: row.jam_mulai,
                jam_selesai: row.jam_selesai,
                keterangan: row.keterangan
            });
            return acc;
        }, {});
        
        res.json({ success: true, data: Object.values(grouped) });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Create or update jam pelajaran for a kelas (bulk upsert)
 * POST /api/admin/jam-pelajaran/:kelasId
 * Body: { jam_pelajaran: [{ jam_ke, jam_mulai, jam_selesai, keterangan? }] }
 */
export const upsertJamPelajaran = async (req, res) => {
    try {
        const { kelasId } = req.params;
        const { jam_pelajaran } = req.body;
        
        if (!jam_pelajaran || !Array.isArray(jam_pelajaran)) {
            return sendValidationError(res, 'Data jam_pelajaran harus berupa array');
        }
        
        // Verify kelas exists
        const [kelas] = await global.dbPool.execute(
            'SELECT id_kelas FROM kelas WHERE id_kelas = ?',
            [kelasId]
        );
        
        if (kelas.length === 0) {
            return sendNotFoundError(res, 'Kelas tidak ditemukan');
        }
        
        // Validate each jam pelajaran
        for (const jam of jam_pelajaran) {
            if (!jam.jam_ke || !jam.jam_mulai || !jam.jam_selesai) {
                return sendValidationError(res, 'Setiap jam harus memiliki jam_ke, jam_mulai, dan jam_selesai');
            }
            
            if (jam.jam_ke < 1 || jam.jam_ke > 15) {
                return sendValidationError(res, 'jam_ke harus antara 1 dan 15');
            }
        }
        
        // Upsert jam pelajaran
        const upsertedIds = [];
        for (const jam of jam_pelajaran) {
            const [result] = await global.dbPool.execute(`
                INSERT INTO jam_pelajaran (kelas_id, jam_ke, jam_mulai, jam_selesai, keterangan)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    jam_mulai = VALUES(jam_mulai),
                    jam_selesai = VALUES(jam_selesai),
                    keterangan = VALUES(keterangan),
                    updated_at = CURRENT_TIMESTAMP
            `, [kelasId, jam.jam_ke, jam.jam_mulai, jam.jam_selesai, jam.keterangan || null]);
            
            upsertedIds.push(result.insertId || jam.jam_ke);
        }
        
        res.json({
            success: true,
            message: `${jam_pelajaran.length} jam pelajaran berhasil disimpan`,
            data: { upsertedCount: jam_pelajaran.length }
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Delete jam pelajaran for a specific kelas (reset to default)
 * DELETE /api/admin/jam-pelajaran/:kelasId
 */
export const deleteJamPelajaranByKelas = async (req, res) => {
    try {
        const { kelasId } = req.params;
        
        const [result] = await global.dbPool.execute(
            'DELETE FROM jam_pelajaran WHERE kelas_id = ?',
            [kelasId]
        );
        
        res.json({
            success: true,
            message: `${result.affectedRows} jam pelajaran dihapus`,
            data: { deletedCount: result.affectedRows }
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Copy jam pelajaran from one kelas to another
 * POST /api/admin/jam-pelajaran/copy
 * Body: { sourceKelasId, targetKelasIds: [] }
 */
export const copyJamPelajaran = async (req, res) => {
    try {
        const { sourceKelasId, targetKelasIds } = req.body;
        
        if (!sourceKelasId || !targetKelasIds || !Array.isArray(targetKelasIds)) {
            return sendValidationError(res, 'sourceKelasId dan targetKelasIds diperlukan');
        }
        
        // Get source jam pelajaran
        const [sourceJam] = await global.dbPool.execute(
            'SELECT jam_ke, jam_mulai, jam_selesai, keterangan FROM jam_pelajaran WHERE kelas_id = ?',
            [sourceKelasId]
        );
        
        if (sourceJam.length === 0) {
            return sendNotFoundError(res, 'Jam pelajaran sumber tidak ditemukan');
        }
        
        // Copy to each target kelas
        let copiedCount = 0;
        for (const targetId of targetKelasIds) {
            for (const jam of sourceJam) {
                await global.dbPool.execute(`
                    INSERT INTO jam_pelajaran (kelas_id, jam_ke, jam_mulai, jam_selesai, keterangan)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        jam_mulai = VALUES(jam_mulai),
                        jam_selesai = VALUES(jam_selesai),
                        keterangan = VALUES(keterangan),
                        updated_at = CURRENT_TIMESTAMP
                `, [targetId, jam.jam_ke, jam.jam_mulai, jam.jam_selesai, jam.keterangan]);
            }
            copiedCount++;
        }
        
        res.json({
            success: true,
            message: `Jam pelajaran berhasil disalin ke ${copiedCount} kelas`,
            data: { copiedToCount: copiedCount, jamCount: sourceJam.length }
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get default jam pelajaran template (for new kelas or reset)
 * GET /api/admin/jam-pelajaran/default
 */
export const getDefaultJamPelajaran = async (req, res) => {
    const defaultJam = [
        { jam_ke: 1, jam_mulai: '06:30', jam_selesai: '07:15', keterangan: null },
        { jam_ke: 2, jam_mulai: '07:15', jam_selesai: '08:00', keterangan: null },
        { jam_ke: 3, jam_mulai: '08:00', jam_selesai: '08:45', keterangan: null },
        { jam_ke: 4, jam_mulai: '08:45', jam_selesai: '09:30', keterangan: null },
        { jam_ke: 5, jam_mulai: '09:45', jam_selesai: '10:30', keterangan: 'Setelah Istirahat 1' },
        { jam_ke: 6, jam_mulai: '10:30', jam_selesai: '11:15', keterangan: null },
        { jam_ke: 7, jam_mulai: '11:15', jam_selesai: '12:00', keterangan: null },
        { jam_ke: 8, jam_mulai: '12:00', jam_selesai: '12:45', keterangan: null },
        { jam_ke: 9, jam_mulai: '13:00', jam_selesai: '13:45', keterangan: 'Setelah Istirahat 2' },
        { jam_ke: 10, jam_mulai: '13:45', jam_selesai: '14:30', keterangan: null }
    ];
    
    res.json({ success: true, data: defaultJam });
};
