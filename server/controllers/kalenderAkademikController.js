/**
 * Kalender Akademik Controller
 * Manages effective school days per month for accurate attendance calculations
 */

import { sendDatabaseError, sendValidationError, sendNotFoundError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('KalenderAkademik');

// Default effective days map (fallback when no DB data)
const DEFAULT_HARI_EFEKTIF = {
    7: 21, 8: 21, 9: 21, 10: 22, 11: 21, 12: 18,
    1: 21, 2: 20, 3: 22, 4: 20, 5: 20, 6: 18
};

/**
 * Get all kalender akademik entries
 * @route GET /api/admin/kalender-akademik
 */
export const getKalenderAkademik = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { tahun_pelajaran } = req.query;
    
    log.requestStart('GetKalenderAkademik', { tahun_pelajaran });

    try {
        let query = 'SELECT * FROM kalender_akademik';
        let params = [];

        if (tahun_pelajaran) {
            query += ' WHERE tahun_pelajaran = ?';
            params.push(tahun_pelajaran);
        }

        query += ' ORDER BY tahun DESC, bulan ASC';

        const [rows] = await globalThis.dbPool.execute(query, params);

        log.success('GetKalenderAkademik', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal memuat kalender akademik');
    }
};

/**
 * Get effective days for a specific month
 * @route GET /api/admin/kalender-akademik/hari-efektif
 * @query bulan, tahun OR tahun_pelajaran, bulan
 */
export const getHariEfektif = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { bulan, tahun, tahun_pelajaran } = req.query;
    
    log.requestStart('GetHariEfektif', { bulan, tahun, tahun_pelajaran });

    try {
        if (!bulan) {
            return sendValidationError(res, 'Parameter bulan wajib diisi');
        }

        const bulanNum = Number.parseInt(bulan);
        
        let query, params;
        
        if (tahun_pelajaran) {
            query = 'SELECT hari_efektif, keterangan FROM kalender_akademik WHERE tahun_pelajaran = ? AND bulan = ?';
            params = [tahun_pelajaran, bulanNum];
        } else if (tahun) {
            query = 'SELECT hari_efektif, keterangan FROM kalender_akademik WHERE bulan = ? AND tahun = ?';
            params = [bulanNum, Number.parseInt(tahun)];
        } else {
            // Fallback to default
            const defaultDays = DEFAULT_HARI_EFEKTIF[bulanNum] || 20;
            return res.json({ 
                hari_efektif: defaultDays, 
                keterangan: 'Default (tidak ada data di database)',
                source: 'default'
            });
        }

        const [rows] = await globalThis.dbPool.execute(query, params);

        if (rows.length === 0) {
            const defaultDays = DEFAULT_HARI_EFEKTIF[bulanNum] || 20;
            log.debug('Using default effective days', { bulan: bulanNum, days: defaultDays });
            return res.json({ 
                hari_efektif: defaultDays, 
                keterangan: 'Default (tidak ada data di database)',
                source: 'default'
            });
        }

        log.success('GetHariEfektif', { bulan: bulanNum, days: rows[0].hari_efektif });
        res.json({ ...rows[0], source: 'database' });
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil hari efektif');
    }
};

/**
 * Create or update kalender akademik entry
 * @route POST /api/admin/kalender-akademik
 */
export const upsertKalenderAkademik = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { tahun_pelajaran, bulan, tahun, hari_efektif, is_libur_semester, keterangan } = req.body;
    
    log.requestStart('UpsertKalenderAkademik', { tahun_pelajaran, bulan, tahun });

    try {
        if (!tahun_pelajaran || !bulan || !tahun) {
            return sendValidationError(res, 'tahun_pelajaran, bulan, dan tahun wajib diisi');
        }

        if (hari_efektif < 0 || hari_efektif > 31) {
            return sendValidationError(res, 'hari_efektif harus antara 0-31');
        }

        const [result] = await globalThis.dbPool.execute(`
            INSERT INTO kalender_akademik 
                (tahun_pelajaran, bulan, tahun, hari_efektif, is_libur_semester, keterangan)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                hari_efektif = VALUES(hari_efektif),
                is_libur_semester = VALUES(is_libur_semester),
                keterangan = VALUES(keterangan)
        `, [
            tahun_pelajaran,
            Number.parseInt(bulan),
            Number.parseInt(tahun),
            Number.parseInt(hari_efektif) || 20,
            is_libur_semester ? 1 : 0,
            keterangan || null
        ]);

        log.success('UpsertKalenderAkademik', { affectedRows: result.affectedRows });
        res.json({ 
            message: 'Kalender akademik berhasil disimpan',
            id: result.insertId || null
        });
    } catch (error) {
        log.dbError('upsert', error);
        return sendDatabaseError(res, error, 'Gagal menyimpan kalender akademik');
    }
};

/**
 * Update kalender akademik entry by ID
 * @route PUT /api/admin/kalender-akademik/:id
 */
export const updateKalenderAkademik = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { hari_efektif, is_libur_semester, keterangan } = req.body;
    
    log.requestStart('UpdateKalenderAkademik', { id });

    try {
        if (hari_efektif !== undefined && (hari_efektif < 0 || hari_efektif > 31)) {
            return sendValidationError(res, 'hari_efektif harus antara 0-31');
        }

        const [result] = await globalThis.dbPool.execute(`
            UPDATE kalender_akademik 
            SET hari_efektif = COALESCE(?, hari_efektif),
                is_libur_semester = COALESCE(?, is_libur_semester),
                keterangan = COALESCE(?, keterangan)
            WHERE id = ?
        `, [
            hari_efektif !== undefined ? Number.parseInt(hari_efektif) : null,
            is_libur_semester !== undefined ? (is_libur_semester ? 1 : 0) : null,
            keterangan !== undefined ? keterangan : null,
            id
        ]);

        if (result.affectedRows === 0) {
            return sendNotFoundError(res, 'Data kalender akademik tidak ditemukan');
        }

        log.success('UpdateKalenderAkademik', { id });
        res.json({ message: 'Kalender akademik berhasil diupdate' });
    } catch (error) {
        log.dbError('update', error);
        return sendDatabaseError(res, error, 'Gagal mengupdate kalender akademik');
    }
};

/**
 * Delete kalender akademik entry
 * @route DELETE /api/admin/kalender-akademik/:id
 */
export const deleteKalenderAkademik = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('DeleteKalenderAkademik', { id });

    try {
        const [result] = await globalThis.dbPool.execute(
            'DELETE FROM kalender_akademik WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return sendNotFoundError(res, 'Data kalender akademik tidak ditemukan');
        }

        log.success('DeleteKalenderAkademik', { id });
        res.json({ message: 'Kalender akademik berhasil dihapus' });
    } catch (error) {
        log.dbError('delete', error);
        return sendDatabaseError(res, error, 'Gagal menghapus kalender akademik');
    }
};

/**
 * Seed default kalender for a tahun pelajaran
 * @route POST /api/admin/kalender-akademik/seed
 */
export const seedKalenderAkademik = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { tahun_pelajaran } = req.body;
    
    log.requestStart('SeedKalenderAkademik', { tahun_pelajaran });

    try {
        if (!tahun_pelajaran || !tahun_pelajaran.match(/^\d{4}\/\d{4}$/)) {
            return sendValidationError(res, 'Format tahun_pelajaran harus YYYY/YYYY (contoh: 2025/2026)');
        }

        const [startYear, endYear] = tahun_pelajaran.split('/').map(Number);

        const data = [
            // Semester Ganjil
            { bulan: 7, tahun: startYear, hari_efektif: 21, keterangan: 'Juli - Awal Semester Ganjil' },
            { bulan: 8, tahun: startYear, hari_efektif: 21, keterangan: 'Agustus' },
            { bulan: 9, tahun: startYear, hari_efektif: 21, keterangan: 'September' },
            { bulan: 10, tahun: startYear, hari_efektif: 22, keterangan: 'Oktober' },
            { bulan: 11, tahun: startYear, hari_efektif: 21, keterangan: 'November' },
            { bulan: 12, tahun: startYear, hari_efektif: 18, keterangan: 'Desember - Libur Semester Ganjil', is_libur: true },
            // Semester Genap
            { bulan: 1, tahun: endYear, hari_efektif: 21, keterangan: 'Januari - Awal Semester Genap' },
            { bulan: 2, tahun: endYear, hari_efektif: 20, keterangan: 'Februari' },
            { bulan: 3, tahun: endYear, hari_efektif: 22, keterangan: 'Maret' },
            { bulan: 4, tahun: endYear, hari_efektif: 20, keterangan: 'April' },
            { bulan: 5, tahun: endYear, hari_efektif: 20, keterangan: 'Mei' },
            { bulan: 6, tahun: endYear, hari_efektif: 18, keterangan: 'Juni - Libur Semester Genap', is_libur: true }
        ];

        let seeded = 0;
        for (const item of data) {
            await globalThis.dbPool.execute(`
                INSERT INTO kalender_akademik 
                    (tahun_pelajaran, bulan, tahun, hari_efektif, is_libur_semester, keterangan)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    hari_efektif = VALUES(hari_efektif),
                    is_libur_semester = VALUES(is_libur_semester),
                    keterangan = VALUES(keterangan)
            `, [
                tahun_pelajaran,
                item.bulan,
                item.tahun,
                item.hari_efektif,
                item.is_libur ? 1 : 0,
                item.keterangan
            ]);
            seeded++;
        }

        log.success('SeedKalenderAkademik', { tahun_pelajaran, seeded });
        res.json({ 
            message: `Kalender akademik ${tahun_pelajaran} berhasil di-seed`,
            seeded 
        });
    } catch (error) {
        log.dbError('seed', error);
        return sendDatabaseError(res, error, 'Gagal seed kalender akademik');
    }
};

/**
 * Helper function to get effective days (for use by other controllers)
 * @param {number} bulan - Month number (1-12)
 * @param {number} tahun - Year
 * @returns {Promise<number>} Effective days
 */
export const getEffectiveDays = async (bulan, tahun) => {
    try {
        const [rows] = await globalThis.dbPool.execute(
            'SELECT hari_efektif FROM kalender_akademik WHERE bulan = ? AND tahun = ?',
            [bulan, tahun]
        );

        if (rows.length > 0) {
            return rows[0].hari_efektif;
        }

        // Fallback to default
        return DEFAULT_HARI_EFEKTIF[bulan] || 20;
    } catch (error) {
        logger.error('getEffectiveDays error', { error: error.message, bulan, tahun });
        return DEFAULT_HARI_EFEKTIF[bulan] || 20;
    }
};

/**
 * Helper function to get effective days map for a year
 * @param {string} tahunPelajaran - Academic year (e.g., "2025/2026")
 * @returns {Promise<Object>} Map of month -> effective days
 */
export const getEffectiveDaysMap = async (tahunPelajaran) => {
    try {
        const [rows] = await globalThis.dbPool.execute(
            'SELECT bulan, hari_efektif FROM kalender_akademik WHERE tahun_pelajaran = ?',
            [tahunPelajaran]
        );

        if (rows.length === 0) {
            return { ...DEFAULT_HARI_EFEKTIF };
        }

        const map = { ...DEFAULT_HARI_EFEKTIF };
        rows.forEach(row => {
            map[row.bulan] = row.hari_efektif;
        });

        return map;
    } catch (error) {
        logger.error('getEffectiveDaysMap error', { error: error.message, tahunPelajaran });
        return { ...DEFAULT_HARI_EFEKTIF };
    }
};
