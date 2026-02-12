/**
 * Banding Absen Siswa Guru Controller
 * Attendance appeal endpoints for students and teachers
 * 
 * NOTE: /api/siswa/:siswaId/status-kehadiran NOT included - already in absensiController.js
 */

import { getMySQLDateTimeWIB } from '../utils/timeUtils.js';
import { sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse, sendPermissionError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import { validateSelfAccess, validatePerwakilanAccess, validateUserContext } from '../utils/validationUtils.js';
import db from '../config/db.js';

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
        if (!validateUserContext(req, res)) {
            return;
        }

        if (!validateSelfAccess(req, res, siswaId, 'siswa_id')) {
            return;
        }

        if (!validatePerwakilanAccess(req, res)) {
            return;
        }

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

        const [rows] = await db.execute(query, [siswaId]);
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
        if (!validateUserContext(req, res)) {
            return;
        }

        if (!validateSelfAccess(req, res, siswaId, 'siswa_id')) {
            return;
        }

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

        const [jadwalRows] = await db.execute(
            `SELECT j.id_jadwal
             FROM jadwal j
             JOIN siswa s ON s.id_siswa = ? AND s.kelas_id = j.kelas_id
             WHERE j.id_jadwal = ? AND j.status = 'aktif'
             LIMIT 1`,
            [siswaId, jadwal_id]
        );

        if (jadwalRows.length === 0) {
            log.validationFail('jadwal_id', jadwal_id, 'Invalid schedule for student');
            return sendValidationError(res, 'Jadwal tidak valid untuk siswa ini', { field: 'jadwal_id' });
        }

        const [existing] = await db.execute(
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

        const [result] = await db.execute(
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
        if (!validateUserContext(req, res)) {
            return;
        }

        if (!validateSelfAccess(req, res, siswaId, 'siswa_id')) {
            return;
        }

        if (!validatePerwakilanAccess(req, res)) {
            return;
        }

        const [siswaData] = await db.execute(
            'SELECT kelas_id FROM siswa WHERE id_siswa = ? AND status = "aktif"',
            [siswaId]
        );

        if (siswaData.length === 0) {
            log.warn('GetDaftarSiswa - siswa not found', { siswaId });
            return sendNotFoundError(res, 'Siswa tidak ditemukan');
        }

        const kelasId = siswaData[0].kelas_id;

        const [rows] = await db.execute(`
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
        if (!validateUserContext(req, res)) {
            return;
        }

        if (!validateSelfAccess(req, res, guruId, 'guru_id')) {
            return;
        }

        const offset = (Number.parseInt(page) - 1) * Number.parseInt(limit);
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
        const [countResult] = await db.execute(countQuery, [guruId]);
        const totalRecords = countResult[0].total;

        const pendingCountQuery = `SELECT COUNT(*) as total ${baseQuery} AND ba.status_banding = 'pending'`;
        const [pendingCountResult] = await db.execute(pendingCountQuery, [guruId]);
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

        const [rows] = await db.execute(mainQuery, [guruId, Number.parseInt(limit), offset]);
        const totalPages = Math.ceil(totalRecords / Number.parseInt(limit));

        log.success('GetGuruBanding', { count: rows.length, totalRecords, totalPending, guruId });
        res.json({
            data: rows,
            pagination: { currentPage: Number.parseInt(page), totalPages, totalRecords, totalPending, limit: Number.parseInt(limit) },
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
    const { status_banding, catatan_guru } = req.body;
    const guruId = req.user?.guru_id;

    log.requestStart('RespondBanding', { bandingId, status_banding, guruId });

    const connection = await db.getConnection();
    
    try {
        if (!validateUserContext(req, res)) {
            return;
        }

        if (!guruId) {
            log.validationFail('guru_id', null, 'Missing guru_id in token');
            return sendPermissionError(res, 'Data guru tidak ditemukan pada token pengguna');
        }

        if (!status_banding || !['disetujui', 'ditolak'].includes(status_banding)) {
            log.validationFail('status_banding', status_banding, 'Invalid status');
            return sendValidationError(res, 'Status harus disetujui atau ditolak', { field: 'status_banding' });
        }

        const tanggalKeputusanWIB = getMySQLDateTimeWIB();

        await connection.beginTransaction();

        // Check access and get banding details
        const [bandingRows] = await connection.execute(
            `SELECT ba.id_banding, ba.siswa_id, ba.jadwal_id, ba.tanggal_absen, ba.status_diajukan, ba.status_banding
             FROM pengajuan_banding_absen ba
             JOIN jadwal j ON ba.jadwal_id = j.id_jadwal
             WHERE ba.id_banding = ?
               AND (j.guru_id = ? OR EXISTS (
                   SELECT 1 FROM jadwal_guru jg
                   WHERE jg.jadwal_id = j.id_jadwal AND jg.guru_id = ?
               ))
             LIMIT 1`,
            [bandingId, guruId, guruId]
        );

        if (bandingRows.length === 0) {
            await connection.rollback();
            log.warn('RespondBanding - forbidden', { bandingId, guruId });
            return sendPermissionError(res, 'Anda tidak diizinkan memproses banding ini');
        }

        const banding = bandingRows[0];

        // Prevent re-processing already decided banding
        if (banding.status_banding !== 'pending') {
            await connection.rollback();
            log.warn('RespondBanding - already processed', { bandingId, currentStatus: banding.status_banding });
            return sendValidationError(res, `Banding ini sudah ${banding.status_banding}. Tidak dapat diubah lagi.`);
        }

        // 1. Update banding status
        const [updateBandingResult] = await connection.execute(
            `UPDATE pengajuan_banding_absen 
             SET status_banding = ?, catatan_guru = ?, tanggal_keputusan = ?, diproses_oleh = ?
             WHERE id_banding = ?`,
            [status_banding, catatan_guru || '', tanggalKeputusanWIB, guruId, bandingId]
        );

        if (updateBandingResult.affectedRows === 0) {
            await connection.rollback();
            log.warn('RespondBanding - update failed', { bandingId });
            return sendNotFoundError(res, 'Gagal memperbarui status banding');
        }

        // 2. If approved, sync attendance status to absensi_siswa
        if (status_banding === 'disetujui') {
            const [updateAbsensiResult] = await connection.execute(
                `UPDATE absensi_siswa
                 SET status_kehadiran = ?
                 WHERE siswa_id = ? AND jadwal_id = ? AND tanggal = ?`,
                [banding.status_diajukan, banding.siswa_id, banding.jadwal_id, banding.tanggal_absen]
            );

            if (updateAbsensiResult.affectedRows === 0) {
                log.warn('RespondBanding - absensi record not found, will create new', { 
                    siswaId: banding.siswa_id, 
                    jadwalId: banding.jadwal_id, 
                    tanggal: banding.tanggal_absen 
                });

                // If no existing attendance record, insert one with approved status
                await connection.execute(
                    `INSERT INTO absensi_siswa (siswa_id, jadwal_id, tanggal, status_kehadiran)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE status_kehadiran = VALUES(status_kehadiran)`,
                    [banding.siswa_id, banding.jadwal_id, banding.tanggal_absen, banding.status_diajukan]
                );

                log.info('RespondBanding - created new absensi record', { 
                    siswaId: banding.siswa_id, 
                    newStatus: banding.status_diajukan 
                });
            } else {
                log.info('RespondBanding - synced attendance status', { 
                    siswaId: banding.siswa_id, 
                    newStatus: banding.status_diajukan 
                });
            }
        }

        await connection.commit();

        log.success('RespondBanding', { bandingId, status_banding, syncedToAbsensi: status_banding === 'disetujui' });
        return sendSuccessResponse(res, { id: bandingId }, `Banding absen berhasil ${status_banding === 'disetujui' ? 'disetujui' : 'ditolak'}${status_banding === 'disetujui' ? ' dan status kehadiran telah diperbarui' : ''}`);
    } catch (error) {
        await connection.rollback();
        log.dbError('transaction', error, { bandingId });
        return sendDatabaseError(res, error, 'Gagal memproses banding absen');
    } finally {
        connection.release();
    }
};

// Get riwayat banding absen untuk laporan
export const getGuruBandingAbsenHistory = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id, status, guru_id } = req.query;
    const role = req.user?.role;
    const guruId = req.user?.guru_id;
    const isAdmin = role === 'admin';

    log.requestStart('GetBandingHistory', { startDate, endDate, kelas_id, status, guruId });

    try {
        if (!isAdmin && !validateUserContext(req, res)) {
            return;
        }

        if (!startDate || !endDate) {
            log.validationFail('dates', null, 'Date range required');
            return sendValidationError(res, 'Tanggal mulai dan akhir harus diisi', { fields: ['startDate', 'endDate'] });
        }

        const statusMap = {
            approved: 'disetujui',
            rejected: 'ditolak',
            pending: 'pending'
        };

        const normalizedStatus = status && statusMap[status] ? statusMap[status] : status;

        let query = `
            SELECT 
                ba.id_banding as id,
                ba.tanggal_pengajuan,
                ba.tanggal_absen,
                ba.status_asli as status_absen,
                ba.alasan_banding,
                ba.status_banding,
                CASE ba.status_banding
                    WHEN 'disetujui' THEN 'approved'
                    WHEN 'ditolak' THEN 'rejected'
                    ELSE 'pending'
                END as status,
                ba.tanggal_keputusan as tanggal_disetujui,
                ba.catatan_guru as catatan,
                s.nama as nama_siswa,
                s.nis,
                k.nama_kelas
            FROM pengajuan_banding_absen ba
            JOIN siswa s ON ba.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            JOIN jadwal j ON ba.jadwal_id = j.id_jadwal
            WHERE ba.tanggal_pengajuan BETWEEN ? AND ?
        `;

        const params = [startDate, endDate];

        if (isAdmin && guru_id) {
            const parsedGuruId = Number(guru_id);
            if (Number.isNaN(parsedGuruId)) {
                return sendValidationError(res, 'guru_id tidak valid', { field: 'guru_id' });
            }
            query += ` AND (j.guru_id = ? OR EXISTS (
                SELECT 1 FROM jadwal_guru jg
                WHERE jg.jadwal_id = j.id_jadwal AND jg.guru_id = ?
            ))`;
            params.push(parsedGuruId, parsedGuruId);
        } else if (!isAdmin) {
            query += ` AND (j.guru_id = ? OR EXISTS (
                SELECT 1 FROM jadwal_guru jg
                WHERE jg.jadwal_id = j.id_jadwal AND jg.guru_id = ?
            ))`;
            params.push(guruId, guruId);
        }

        if (kelas_id && kelas_id !== 'all') {
            query += ` AND s.kelas_id = ?`;
            params.push(kelas_id);
        }

        if (normalizedStatus && normalizedStatus !== 'all') {
            query += ` AND ba.status_banding = ?`;
            params.push(normalizedStatus);
        }

        query += ` ORDER BY ba.tanggal_pengajuan DESC, s.nama`;

        const [rows] = await db.execute(query, params);
        log.success('GetBandingHistory', { count: rows.length, guruId });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { guruId, startDate, endDate });
        return sendDatabaseError(res, error, 'Gagal mengambil riwayat banding absen');
    }
};
