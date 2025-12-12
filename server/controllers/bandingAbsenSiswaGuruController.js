/**
 * Banding Absen Siswa Guru Controller
 * Attendance appeal endpoints for students and teachers
 * Migrated from server_modern.js - EXACT CODE COPY
 * 
 * NOTE: /api/siswa/:siswaId/status-kehadiran NOT included - already in absensiController.js
 */

import { getMySQLDateTimeWIB } from '../utils/timeUtils.js';

import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';

// ================================================
// SISWA BANDING ENDPOINTS
// ================================================

// Get banding absen for siswa (class view)
export const getSiswaBandingAbsen = async (req, res) => {
    try {
        const { siswaId } = req.params;
        console.log('📋 Getting banding absen for siswa:', siswaId);

        const query = `
            SELECT 
                ba.id_banding,
                ba.siswa_id,
                ba.jadwal_id,
                ba.tanggal_absen,
                ba.status_asli,
                ba.status_diajukan,
                ba.alasan_banding,
                ba.status_banding,
                ba.catatan_guru,
                ba.tanggal_pengajuan,
                ba.tanggal_keputusan,
                ba.jenis_banding,
                COALESCE(j.jam_mulai, 'Umum') as jam_mulai,
                COALESCE(j.jam_selesai, 'Umum') as jam_selesai,
                COALESCE(m.nama_mapel, 'Banding Umum') as nama_mapel,
                COALESCE(g.nama, 'Menunggu Proses') as nama_guru,
                COALESCE(k.nama_kelas, '') as nama_kelas,
                s.nama AS nama_siswa
            FROM pengajuan_banding_absen ba
            LEFT JOIN jadwal j ON ba.jadwal_id = j.id_jadwal
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON ba.diproses_oleh = g.id_guru
            LEFT JOIN siswa s ON ba.siswa_id = s.id_siswa
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE s.kelas_id = (SELECT kelas_id FROM siswa WHERE id_siswa = ?)
            ORDER BY ba.tanggal_pengajuan DESC
        `;

        const [rows] = await global.dbPool.execute(query, [siswaId]);
        console.log(`✅ Banding absen retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Submit banding absen (single student only)
export const submitSiswaBandingAbsen = async (req, res) => {
    try {
        const { siswaId } = req.params;
        const { jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding } = req.body;
        console.log('📝 Submitting banding absen:', { siswaId, jadwal_id, tanggal_absen, status_asli, status_diajukan });

        if (!jadwal_id || !tanggal_absen || !status_asli || !status_diajukan || !alasan_banding) {
            return res.status(400).json({ error: 'Semua field wajib diisi' });
        }

        if (req.body.siswa_banding || Array.isArray(req.body.siswa_banding)) {
            return res.status(400).json({
                error: 'Mode kelas tidak diperbolehkan',
                message: 'Gunakan endpoint per-siswa untuk banding absen individual'
            });
        }

        if (status_asli === status_diajukan) {
            return res.status(400).json({ error: 'Status asli dan status yang diajukan tidak boleh sama' });
        }

        const validStatuses = ['hadir', 'izin', 'sakit', 'alpa', 'dispen'];
        if (!validStatuses.includes(status_asli) || !validStatuses.includes(status_diajukan)) {
            return res.status(400).json({
                error: 'Status tidak valid',
                message: `Status harus salah satu dari: ${validStatuses.join(', ')}`
            });
        }

        const [existing] = await global.dbPool.execute(
            'SELECT id_banding, status_banding FROM pengajuan_banding_absen WHERE siswa_id = ? AND jadwal_id = ? AND tanggal_absen = ?',
            [siswaId, jadwal_id, tanggal_absen]
        );

        if (existing.length > 0) {
            const existingStatus = existing[0].status_banding;
            if (existingStatus === 'pending') {
                return res.status(400).json({ error: 'Banding untuk jadwal dan tanggal ini sudah pernah diajukan dan sedang diproses' });
            } else {
                return res.status(400).json({ error: `Banding untuk jadwal dan tanggal ini sudah pernah diajukan dan ${existingStatus}` });
            }
        }

        const [result] = await global.dbPool.execute(
            `INSERT INTO pengajuan_banding_absen 
            (siswa_id, jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding, jenis_banding)
             VALUES (?, ?, ?, ?, ?, ?, 'individual')`,
            [siswaId, jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding]
        );

        console.log('✅ Banding absen submitted successfully');
        res.json({ message: 'Banding absen berhasil dikirim', id: result.insertId });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Get daftar siswa untuk banding absen
export const getDaftarSiswa = async (req, res) => {
    try {
        const { siswaId } = req.params;
        console.log('📋 Getting daftar siswa untuk banding absen:', { siswaId });

        const [siswaData] = await global.dbPool.execute(
            'SELECT kelas_id FROM siswa WHERE id_siswa = ? AND status = "aktif"',
            [siswaId]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        const kelasId = siswaData[0].kelas_id;

        const [rows] = await global.dbPool.execute(`
            SELECT s.id_siswa, s.nama, s.nis, s.jenis_kelamin, k.nama_kelas, u.username, u.status as user_status
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            JOIN users u ON s.user_id = u.id
            WHERE s.kelas_id = ? AND s.status = "aktif"
            ORDER BY s.nama ASC
        `, [kelasId]);

        console.log(`✅ Daftar siswa retrieved: ${rows.length} students`);
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// GURU BANDING ENDPOINTS
// ================================================

// Get banding absen for teacher to process
export const getGuruBandingAbsen = async (req, res) => {
    try {
        const { guruId } = req.params;
        const { page = 1, limit = 5, filter_pending = 'false' } = req.query;
        console.log('📋 Getting banding absen for guru:', guruId);

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const isFilterPending = filter_pending === 'true';

        let baseQuery = `
            FROM pengajuan_banding_absen ba
            JOIN jadwal j ON ba.jadwal_id = j.id_jadwal
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN siswa s ON ba.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE j.guru_id = ?
        `;

        if (isFilterPending) {
            baseQuery += ` AND ba.status_banding = 'pending'`;
        }

        const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
        const [countResult] = await global.dbPool.execute(countQuery, [guruId]);
        const totalRecords = countResult[0].total;

        const pendingCountQuery = `SELECT COUNT(*) as total ${baseQuery} AND ba.status_banding = 'pending'`;
        const [pendingCountResult] = await global.dbPool.execute(pendingCountQuery, [guruId]);
        const totalPending = pendingCountResult[0].total;

        const mainQuery = `
            SELECT ba.id_banding, ba.siswa_id, ba.jadwal_id, ba.tanggal_absen, ba.status_asli,
                   ba.status_diajukan, ba.alasan_banding, ba.status_banding, ba.catatan_guru,
                   ba.tanggal_pengajuan, ba.tanggal_keputusan, j.jam_mulai, j.jam_selesai,
                   m.nama_mapel, s.nama as nama_siswa, s.nis, k.nama_kelas
            ${baseQuery}
            ORDER BY ba.tanggal_pengajuan DESC, ba.status_banding ASC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await global.dbPool.execute(mainQuery, [guruId, parseInt(limit), offset]);
        const totalPages = Math.ceil(totalRecords / parseInt(limit));

        console.log(`✅ Banding absen for guru retrieved: ${rows.length} items`);
        res.json({
            data: rows,
            pagination: { currentPage: parseInt(page), totalPages, totalRecords, totalPending, limit: parseInt(limit) },
            totalPages, totalPending, totalAll: totalRecords
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Process banding absen by teacher
export const respondBandingAbsen = async (req, res) => {
    try {
        const { bandingId } = req.params;
        const { status_banding, catatan_guru, diproses_oleh } = req.body;
        const guruId = diproses_oleh || req.user.guru_id || req.user.id;

        console.log('📝 Guru processing banding absen:', { bandingId, status_banding, guruId });

        if (!status_banding || !['disetujui', 'ditolak'].includes(status_banding)) {
            return res.status(400).json({ error: 'Status harus disetujui atau ditolak' });
        }

        const tanggalKeputusanWIB = getMySQLDateTimeWIB();

        const [result] = await global.dbPool.execute(
            `UPDATE pengajuan_banding_absen 
             SET status_banding = ?, catatan_guru = ?, tanggal_keputusan = ?, diproses_oleh = ?
             WHERE id_banding = ?`,
            [status_banding, catatan_guru || '', tanggalKeputusanWIB, guruId, bandingId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Banding absen tidak ditemukan' });
        }

        console.log('✅ Banding absen response submitted successfully');
        res.json({
            message: `Banding absen berhasil ${status_banding === 'disetujui' ? 'disetujui' : 'ditolak'}`,
            id: bandingId
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Get riwayat banding absen untuk laporan
export const getGuruBandingAbsenHistory = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Fetching banding absen history:', { startDate, endDate, kelas_id, status, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query = `
            SELECT ba.id, ba.tanggal_pengajuan, ba.tanggal_absen, ba.status_absen, ba.alasan_banding,
                   ba.status, ba.tanggal_disetujui, ba.catatan, s.nama as nama_siswa, s.nis, k.nama_kelas
            FROM pengajuan_banding_absen ba
            JOIN siswa s ON ba.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE ba.tanggal_pengajuan BETWEEN ? AND ? AND ba.guru_id = ?
        `;

        const params = [startDate, endDate, guruId];

        if (kelas_id && kelas_id !== 'all') {
            query += ` AND s.kelas_id = ?`;
            params.push(kelas_id);
        }

        if (status && status !== 'all') {
            query += ` AND ba.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY ba.tanggal_pengajuan DESC, s.nama`;

        const [rows] = await global.dbPool.execute(query, params);
        console.log(`✅ Banding absen history fetched: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};
