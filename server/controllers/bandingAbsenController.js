/**
 * Banding Absen Controller
 * Endpoint untuk laporan banding absensi
 */

import { sendDatabaseError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('BandingAbsen');

/**
 * Mengambil laporan riwayat banding absen
 * GET /api/laporan/banding-absen
 * @param {Object} req.query - Filter: startDate, endDate, kelas_id, status
 * @returns {Array} Daftar banding absen
 */
export const getBandingAbsenReport = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id, status } = req.query;
    
    log.requestStart('GetReport', { startDate, endDate, kelas_id, status });

    try {
        let query = `
            SELECT 
                pba.id_banding,
                DATE_FORMAT(pba.tanggal_pengajuan, '%Y-%m-%d') as tanggal_pengajuan,
                DATE_FORMAT(pba.tanggal_absen, '%Y-%m-%d') as tanggal_absen,
                s.nama as nama_pengaju,
                COALESCE(k.nama_kelas, '-') as nama_kelas,
                COALESCE(m.nama_mapel, 'Umum') as nama_mapel,
                COALESCE(g.nama, 'Belum Ditentukan') as nama_guru,
                COALESCE(j.jam_mulai, '00:00') as jam_mulai,
                COALESCE(j.jam_selesai, '00:00') as jam_selesai,
                pba.status_asli,
                pba.status_diajukan,
                pba.alasan_banding,
                pba.status_banding,
                COALESCE(pba.catatan_guru, '-') as catatan_guru,
                COALESCE(DATE_FORMAT(pba.tanggal_keputusan, '%Y-%m-%d %H:%i'), '-') as tanggal_keputusan,
                COALESCE(guru_proses.nama, 'Belum Diproses') as diproses_oleh,
                pba.jenis_banding
            FROM pengajuan_banding_absen pba
            JOIN siswa s ON pba.siswa_id = s.id_siswa
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas OR pba.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON pba.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru guru_proses ON pba.diproses_oleh = guru_proses.id_guru
            WHERE 1=1
        `;

        const params = [];

        if (startDate && endDate) {
            query += ' AND DATE(pba.tanggal_pengajuan) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        if (status && status !== '') {
            query += ' AND pba.status_banding = ?';
            params.push(status);
        }

        query += ' ORDER BY pba.tanggal_pengajuan DESC';

        const [rows] = await globalThis.dbPool.execute(query, params);
        log.success('GetReport', { count: rows.length, filters: { startDate, endDate, kelas_id, status } });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { startDate, endDate, kelas_id, status });
        return sendDatabaseError(res, error, 'Gagal mengambil laporan banding absen');
    }
};

/**
 * Download laporan banding absen sebagai CSV
 * GET /api/laporan/banding-absen/download
 * @param {Object} req.query - Filter: startDate, endDate, kelas_id, status
 * @returns {CSV} File CSV dengan data banding absen
 */
export const downloadBandingAbsen = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id, status } = req.query;
    
    log.requestStart('Download', { startDate, endDate, kelas_id, status });

    try {
        let query = `
            SELECT 
                DATE_FORMAT(pba.tanggal_pengajuan, '%d/%m/%Y') as tanggal_pengajuan,
                DATE_FORMAT(pba.tanggal_absen, '%d/%m/%Y') as tanggal_absen,
                s.nama as nama_pengaju,
                COALESCE(k.nama_kelas, '-') as nama_kelas,
                COALESCE(m.nama_mapel, 'Umum') as nama_mapel,
                COALESCE(g.nama, 'Belum Ditentukan') as nama_guru,
                COALESCE(CONCAT(j.jam_mulai, ' - ', j.jam_selesai), '-') as jadwal,
                pba.status_asli,
                pba.status_diajukan,
                pba.alasan_banding,
                pba.status_banding,
                COALESCE(pba.catatan_guru, '-') as catatan_guru,
                COALESCE(DATE_FORMAT(pba.tanggal_keputusan, '%d/%m/%Y %H:%i'), '-') as tanggal_keputusan,
                COALESCE(guru_proses.nama, 'Belum Diproses') as diproses_oleh,
                pba.jenis_banding
            FROM pengajuan_banding_absen pba
            JOIN siswa s ON pba.siswa_id = s.id_siswa
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas OR pba.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON pba.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru guru_proses ON pba.diproses_oleh = guru_proses.id_guru
            WHERE 1=1
        `;

        const params = [];

        if (startDate && endDate) {
            query += ' AND DATE(pba.tanggal_pengajuan) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        if (status && status !== '') {
            query += ' AND pba.status_banding = ?';
            params.push(status);
        }

        query += ' ORDER BY pba.tanggal_pengajuan DESC';

        const [rows] = await globalThis.dbPool.execute(query, params);

        // Enhanced CSV format with UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal Pengajuan,Tanggal Absen,Pengaju,Kelas,Mata Pelajaran,Guru,Jadwal,Status Asli,Status Diajukan,Alasan Banding,Status Banding,Catatan Guru,Tanggal Keputusan,Diproses Oleh,Jenis Banding\n';

        rows.forEach(row => {
            csvContent += `"${row.tanggal_pengajuan}","${row.tanggal_absen}","${row.nama_pengaju}","${row.nama_kelas}","${row.nama_mapel}","${row.nama_guru}","${row.jadwal}","${row.status_asli}","${row.status_diajukan}","${row.alasan_banding}","${row.status_banding}","${row.catatan_guru}","${row.tanggal_keputusan}","${row.diproses_oleh}","${row.jenis_banding}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="riwayat-banding-absen-${startDate || 'all'}-${endDate || 'all'}.csv"`);
        res.send(csvContent);

        log.success('Download', { count: rows.length, filename: `riwayat-banding-absen-${startDate || 'all'}-${endDate || 'all'}.csv` });
    } catch (error) {
        log.dbError('download', error, { startDate, endDate, kelas_id, status });
        return sendDatabaseError(res, error, 'Gagal mengunduh laporan banding absen');
    }
};

/**
 * Mengambil daftar mata pelajaran (alias endpoint)
 * GET /api/mapel
 * @returns {Array} Daftar mata pelajaran
 */
export const getSubjects = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetSubjects');

    try {
        const query = `
            SELECT 
                id_mapel as id, 
                kode_mapel, 
                nama_mapel, 
                deskripsi,
                status
            FROM mapel 
            ORDER BY nama_mapel
        `;

        const [rows] = await globalThis.dbPool.execute(query);
        log.success('GetSubjects', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data mata pelajaran');
    }
};

/**
 * Mengambil daftar kelas (alias endpoint)
 * GET /api/kelas
 * @returns {Array} Daftar kelas
 */
export const getClasses = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetClasses');

    try {
        const query = `
            SELECT id_kelas as id, nama_kelas, tingkat, status
            FROM kelas 
            ORDER BY tingkat, nama_kelas
        `;

        const [rows] = await globalThis.dbPool.execute(query);
        log.success('GetClasses', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data kelas');
    }
};
