/**
 * Banding Absen Siswa Guru Controller
 * Attendance appeal endpoints for students and teachers
 * 
 * NOTE: /api/siswa/:siswaId/status-kehadiran NOT included - already in absensiController.js
 */

import { getMySQLDateTimeWIB } from '../utils/timeUtils.js';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('BandingAbsenSiswaGuru');

// ================================================
// SISWA BANDING ENDPOINTS
// ================================================

// Get banding absen for siswa (class view)
export const getSiswaBandingAbsen = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { siswaId } = req.params;
    
    log.requestStart('GetSiswaBanding', { siswaId });

    try {
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

        const [rows] = await globalThis.dbPool.execute(query, [siswaId]);
        log.success('GetSiswaBanding', { count: rows.length, siswaId });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { siswaId });
        return sendDatabaseError(res, error, 'Gagal mengambil data banding absen');
    }
};

// Submit banding absen (single student only)
export const submitSiswaBandingAbsen = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { siswaId } = req.params;
    const { jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding } = req.body;
    
    log.requestStart('SubmitBanding', { siswaId, jadwal_id, tanggal_absen, status_asli, status_diajukan });

    try {
        if (!jadwal_id || !tanggal_absen || !status_asli || !status_diajukan || !alasan_banding) {
            log.validationFail('required_fields', null, 'All fields required');
            return sendValidationError(res, 'Semua field wajib diisi', { fields: ['jadwal_id', 'tanggal_absen', 'status_asli', 'status_diajukan', 'alasan_banding'] });
        }

        if (req.body.siswa_banding || Array.isArray(req.body.siswa_banding)) {
            log.validationFail('mode', 'class_mode', 'Class mode not allowed');
            return sendValidationError(res, 'Mode kelas tidak diperbolehkan. Gunakan endpoint per-siswa untuk banding absen individual');
        }

        if (status_asli === status_diajukan) {
            log.validationFail('status', null, 'Same status');
            return sendValidationError(res, 'Status asli dan status yang diajukan tidak boleh sama');
        }

        const validStatuses = ['hadir', 'izin', 'sakit', 'alpa', 'dispen'];
        if (!validStatuses.includes(status_asli) || !validStatuses.includes(status_diajukan)) {
            log.validationFail('status', { status_asli, status_diajukan }, 'Invalid status');
            return sendValidationError(res, `Status harus salah satu dari: ${validStatuses.join(', ')}`);
        }

        const [existing] = await globalThis.dbPool.execute(
            'SELECT id_banding, status_banding FROM pengajuan_banding_absen WHERE siswa_id = ? AND jadwal_id = ? AND tanggal_absen = ?',
            [siswaId, jadwal_id, tanggal_absen]
        );

        if (existing.length > 0) {
            const existingStatus = existing[0].status_banding;
            log.warn('SubmitBanding - already exists', { siswaId, jadwal_id, existingStatus });
            if (existingStatus === 'pending') {
                return sendDuplicateError(res, 'Banding untuk jadwal dan tanggal ini sudah pernah diajukan dan sedang diproses');
            } else {
                return sendDuplicateError(res, `Banding untuk jadwal dan tanggal ini sudah pernah diajukan dan ${existingStatus}`);
            }
        }

        const [result] = await globalThis.dbPool.execute(
            `INSERT INTO pengajuan_banding_absen 
            (siswa_id, jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding, jenis_banding)
             VALUES (?, ?, ?, ?, ?, ?, 'individual')`,
            [siswaId, jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding]
        );

        log.success('SubmitBanding', { siswaId, bandingId: result.insertId });
        return sendSuccessResponse(res, { id: result.insertId }, 'Banding absen berhasil dikirim', 201);
    } catch (error) {
        log.dbError('insert', error, { siswaId });
        return sendDatabaseError(res, error, 'Gagal mengajukan banding absen');
    }
};

// Get daftar siswa untuk banding absen
export const getDaftarSiswa = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { siswaId } = req.params;
    
    log.requestStart('GetDaftarSiswa', { siswaId });

    try {
        const [siswaData] = await globalThis.dbPool.execute(
            'SELECT kelas_id FROM siswa WHERE id_siswa = ? AND status = "aktif"',
            [siswaId]
        );

        if (siswaData.length === 0) {
            log.warn('GetDaftarSiswa - siswa not found', { siswaId });
            return sendNotFoundError(res, 'Siswa tidak ditemukan');
        }

        const kelasId = siswaData[0].kelas_id;

        const [rows] = await globalThis.dbPool.execute(`
            SELECT s.id_siswa, s.nama, s.nis, s.jenis_kelamin, k.nama_kelas, u.username, u.status as user_status
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            JOIN users u ON s.user_id = u.id
            WHERE s.kelas_id = ? AND s.status = "aktif"
            ORDER BY s.nama ASC
        `, [kelasId]);

        log.success('GetDaftarSiswa', { count: rows.length, kelasId });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { siswaId });
        return sendDatabaseError(res, error, 'Gagal mengambil daftar siswa');
    }
};

// ================================================
// GURU BANDING ENDPOINTS
// ================================================

// Get banding absen for teacher to process
export const getGuruBandingAbsen = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { guruId } = req.params;
    const { page = 1, limit = 5, filter_pending = 'false' } = req.query;
    
    log.requestStart('GetGuruBanding', { guruId, page, limit, filter_pending });

    try {
        const offset = .parseInt(page) - 1) *.parseInt(limit);
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
        const [countResult] = await globalThis.dbPool.execute(countQuery, [guruId]);
        const totalRecords = countResult[0].total;

        const pendingCountQuery = `SELECT COUNT(*) as total ${baseQuery} AND ba.status_banding = 'pending'`;
        const [pendingCountResult] = await globalThis.dbPool.execute(pendingCountQuery, [guruId]);
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

        const [rows] = await globalThis.dbPool.execute(mainQuery, [guruId,.parseInt(limit), offset]);
        const totalPages = Math.ceil(totalRecords /.parseInt(limit));

        log.success('GetGuruBanding', { count: rows.length, totalRecords, totalPending, guruId });
        res.json({
            data: rows,
            pagination: { currentPage:.parseInt(page), totalPages, totalRecords, totalPending, limit:.parseInt(limit) },
            totalPages, totalPending, totalAll: totalRecords
        });
    } catch (error) {
        log.dbError('query', error, { guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil data banding absen');
    }
};

// Process banding absen by teacher
export const respondBandingAbsen = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { bandingId } = req.params;
    const { status_banding, catatan_guru, diproses_oleh } = req.body;
    const guruId = diproses_oleh || req.user.guru_id || req.user.id;

    log.requestStart('RespondBanding', { bandingId, status_banding, guruId });

    try {
        if (!status_banding || !['disetujui', 'ditolak'].includes(status_banding)) {
            log.validationFail('status_banding', status_banding, 'Invalid status');
            return sendValidationError(res, 'Status harus disetujui atau ditolak', { field: 'status_banding' });
        }

        const tanggalKeputusanWIB = getMySQLDateTimeWIB();

        const [result] = await globalThis.dbPool.execute(
            `UPDATE pengajuan_banding_absen 
             SET status_banding = ?, catatan_guru = ?, tanggal_keputusan = ?, diproses_oleh = ?
             WHERE id_banding = ?`,
            [status_banding, catatan_guru || '', tanggalKeputusanWIB, guruId, bandingId]
        );

        if (result.affectedRows === 0) {
            log.warn('RespondBanding - not found', { bandingId });
            return sendNotFoundError(res, 'Banding absen tidak ditemukan');
        }

        log.success('RespondBanding', { bandingId, status_banding });
        return sendSuccessResponse(res, { id: bandingId }, `Banding absen berhasil ${status_banding === 'disetujui' ? 'disetujui' : 'ditolak'}`);
    } catch (error) {
        log.dbError('update', error, { bandingId });
        return sendDatabaseError(res, error, 'Gagal memproses banding absen');
    }
};

// Get riwayat banding absen untuk laporan
export const getGuruBandingAbsenHistory = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id, status } = req.query;
    const guruId = req.user.guru_id;

    log.requestStart('GetBandingHistory', { startDate, endDate, kelas_id, status, guruId });

    try {
        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, 'Tanggal mulai dan akhir harus diisi', { fields: ['startDate', 'endDate'] });
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

        const [rows] = await globalThis.dbPool.execute(query, params);
        log.success('GetBandingHistory', { count: rows.length, guruId });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { guruId, startDate, endDate });
        return sendDatabaseError(res, error, 'Gagal mengambil riwayat banding absen');
    }
};
