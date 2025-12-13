/**
 * Banding Absen Controller
 * Attendance appeal report endpoints
 * Migrated from server_modern.js - EXACT CODE COPY
 */

import { sendDatabaseError } from '../utils/errorHandler.js';

// ================================================
// BANDING ABSEN ENDPOINTS
// ================================================

// Get banding absen history report
export const getBandingAbsenReport = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;
        console.log('📊 Getting banding absen report:', { startDate, endDate, kelas_id, status });

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

        const [rows] = await global.dbPool.execute(query, params);
        console.log(`✅ Banding absen report retrieved: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Download banding absen report as CSV
export const downloadBandingAbsen = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;
        console.log('📊 Downloading banding absen report:', { startDate, endDate, kelas_id, status });

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

        const [rows] = await global.dbPool.execute(query, params);

        // Enhanced CSV format with UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal Pengajuan,Tanggal Absen,Pengaju,Kelas,Mata Pelajaran,Guru,Jadwal,Status Asli,Status Diajukan,Alasan Banding,Status Banding,Catatan Guru,Tanggal Keputusan,Diproses Oleh,Jenis Banding\n';

        rows.forEach(row => {
            csvContent += `"${row.tanggal_pengajuan}","${row.tanggal_absen}","${row.nama_pengaju}","${row.nama_kelas}","${row.nama_mapel}","${row.nama_guru}","${row.jadwal}","${row.status_asli}","${row.status_diajukan}","${row.alasan_banding}","${row.status_banding}","${row.catatan_guru}","${row.tanggal_keputusan}","${row.diproses_oleh}","${row.jenis_banding}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="riwayat-banding-absen-${startDate || 'all'}-${endDate || 'all'}.csv"`);
        res.send(csvContent);

        console.log(`✅ Banding absen report downloaded successfully: ${rows.length} records`);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// COMPATIBILITY ENDPOINTS FOR SCHEDULE MANAGEMENT
// ================================================

// Get subjects (alias for /api/admin/mapel)
export const getSubjects = async (req, res) => {
    try {
        console.log('📚 Getting subjects for schedule management');

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

        const [rows] = await global.dbPool.execute(query);
        console.log(`✅ Subjects retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Get classes (alias for /api/admin/kelas)
export const getClasses = async (req, res) => {
    try {
        console.log('🏫 Getting classes for schedule management');

        const query = `
            SELECT id_kelas as id, nama_kelas, tingkat, status
            FROM kelas 
            ORDER BY tingkat, nama_kelas
        `;

        const [rows] = await global.dbPool.execute(query);
        console.log(`✅ Classes retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};
