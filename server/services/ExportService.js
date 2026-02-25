/**
 * Export Service
 * Menangani pengambilan data (SQL Query) untuk keperluan export
 */

import db from '../config/db.js';

class ExportService {
    /**
     * Lazy getter for database pool
     * Uses centralized db module for consistent access
     */
    get pool() {
        return db;
    }

    /**
     * Get Teacher Attendance Report (Detail)
     * @param {string} startDate 
     * @param {string} endDate 
     * @param {string|number} kelasId 
     */
    async getTeacherReportData(startDate, endDate, kelasId) {
        let query = `
            SELECT 
                DATE_FORMAT(ag.tanggal, '%Y-%m-%d') as tanggal,
                DATE_FORMAT(ag.tanggal, '%d/%m/%Y') as tanggal_formatted,
                k.nama_kelas,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                g.nip as nip_guru,
                m.nama_mapel,
                CASE 
                    WHEN ag.jam_ke IS NOT NULL THEN CONCAT('Jam ke-', ag.jam_ke)
                    ELSE CONCAT(j.jam_mulai, ' - ', j.jam_selesai)
                END as jam_hadir,
                j.jam_mulai,
                j.jam_selesai,
                CONCAT(j.jam_mulai, ' - ', j.jam_selesai) as jadwal,
                COALESCE(ag.status, 'Tidak Ada Data') as status,
                ag.terlambat,
                COALESCE(ag.keterangan, '-') as keterangan,
                j.jam_ke
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND ag.tanggal BETWEEN ? AND ?
            WHERE j.status = 'aktif'
        `;

        const params = [startDate, endDate];

        if (kelasId && kelasId !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelasId);
        }

        query += ' ORDER BY ag.tanggal DESC, k.nama_kelas, j.jam_ke';

        const [rows] = await this.pool.execute(query, params);
        return rows;
    }

    /**
     * Get Student Attendance Report (Detail)
     * @param {string} startDate 
     * @param {string} endDate 
     * @param {string|number} kelasId 
     */
    async getStudentReportData(startDate, endDate, kelasId) {
        const cacheKey = `export:student-report:${startDate}:${endDate}:${kelasId || 'all'}`;
        const cacheSystem = globalThis.cacheSystem;
        if (cacheSystem?.isConnected) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) return cached;
        }
        let query = `
            SELECT 
                a.tanggal,
                DATE_FORMAT(a.tanggal, '%d/%m/%Y') as tanggal_formatted,
                k.nama_kelas,
                s.nama as nama_siswa,
                s.nis as nis_siswa,
                'Absensi Harian' as nama_mapel,
                'Siswa Perwakilan' as nama_guru,
                TIME_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen,
                '07:00' as jam_mulai,
                '17:00' as jam_selesai,
                '07:00 - 17:00' as jadwal,
                COALESCE(a.status, 'Tidak Hadir') as status,
                a.terlambat,
                COALESCE(a.keterangan, '-') as keterangan
            FROM absensi_siswa a
            JOIN siswa s ON a.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE a.tanggal BETWEEN ? AND ?
        `;

        const params = [startDate, endDate];

        if (kelasId && kelasId !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelasId);
        }

        query += ' ORDER BY a.waktu_absen DESC, k.nama_kelas, s.nama';

        const [rows] = await this.pool.execute(query, params);
        if (cacheSystem?.isConnected) {
            await cacheSystem.set(cacheKey, rows, 'attendance', 300);
        }
        return rows;
    }

    /**
     * Get Absensi Guru data
     * @param {string} dateStart 
     * @param {string} dateEnd 
     */
    async getAbsensiGuru(dateStart, dateEnd) {
        let query = `
            SELECT ag.tanggal, ag.status, ag.keterangan, ag.waktu_catat,
                   j.jam_ke, j.jam_mulai, j.jam_selesai, j.hari,
                   COALESCE(g.nama, 'Sistem') as nama_guru, g.nip,
                   k.nama_kelas, COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                   s.nama as nama_pencatat, s.nis
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON ag.guru_id = g.id_guru
            JOIN kelas k ON ag.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN siswa s ON ag.siswa_pencatat_id = s.id_siswa
        `;

        let params = [];
        let whereConditions = [];

        if (dateStart) {
            whereConditions.push('ag.tanggal >= ?');
            params.push(dateStart);
        }
        if (dateEnd) {
            whereConditions.push('ag.tanggal <= ?');
            params.push(dateEnd);
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY ag.tanggal DESC, k.nama_kelas, j.jam_ke';

        const [rows] = await this.pool.execute(query, params);
        return rows;
    }

    /**
     * Get Teacher Classes
     */
    async getTeacherClasses(guruId = null) {
        if (guruId) {
            // Guru: return only classes they teach
            const [rows] = await this.pool.execute(
                `SELECT DISTINCT k.id_kelas as id, k.nama_kelas 
                 FROM jadwal j JOIN kelas k ON j.kelas_id = k.id_kelas 
                 WHERE j.guru_id = ? AND j.status = 'aktif' ORDER BY k.nama_kelas`,
                [guruId]
            );
            return rows;
        }

        // Admin: return all active classes
        const [rows] = await this.pool.execute(
            `SELECT DISTINCT k.id_kelas as id, k.nama_kelas, k.tingkat 
             FROM kelas k 
             WHERE k.status = 'aktif' 
             ORDER BY k.tingkat, k.nama_kelas`
        );
        return rows;
    }

    /**
     * Get Teacher List
     */
    async getTeacherList() {
        const [teachers] = await this.pool.execute(`
            SELECT 
                nama,
                nip
            FROM guru 
            WHERE status = 'aktif'
            ORDER BY nama
        `);
        return teachers;
    }

    /**
     * Get Student Summary
     */
    async getStudentSummary(startDate, endDate, kelasId) {
        let query = `
            SELECT 
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN deduped.status = 'Hadir' THEN 1 ELSE 0 END), 0) as H,
                COALESCE(SUM(CASE WHEN deduped.status = 'Izin' THEN 1 ELSE 0 END), 0) as I,
                COALESCE(SUM(CASE WHEN deduped.status = 'Sakit' THEN 1 ELSE 0 END), 0) as S,
                COALESCE(SUM(CASE WHEN deduped.status = 'Alpa' THEN 1 ELSE 0 END), 0) as A,
                COALESCE(SUM(CASE WHEN deduped.status = 'Dispen' THEN 1 ELSE 0 END), 0) as D,
                COALESCE(
                    SUM(CASE WHEN deduped.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) * 100.0 
                    / NULLIF(COUNT(deduped.status), 0), 
                0) as presentase
            FROM siswa s
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN (
                SELECT DISTINCT siswa_id, tanggal, status
                FROM absensi_siswa
                WHERE tanggal BETWEEN ? AND ?
            ) deduped ON s.id_siswa = deduped.siswa_id
            WHERE s.status = 'aktif'
        `;

        const params = [startDate, endDate];

        if (kelasId && kelasId !== 'all') {
            query += ' AND k.id_kelas = ?';
            params.push(kelasId);
        }

        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';

        const [students] = await this.pool.execute(query, params);
        return students;
    }

    /**
     * Get Student Summary Counts (Raw Data for calculation)
     */
    async getStudentSummaryCounts(startDate, endDate, kelasId) {
        const cacheKey = `export:student-summary:${startDate}:${endDate}:${kelasId || 'all'}`;
        const cacheSystem = globalThis.cacheSystem;
        if (cacheSystem?.isConnected) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) return cached;
        }
        let query = `
            SELECT 
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN deduped.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN deduped.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN deduped.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN deduped.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN deduped.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(deduped.tgl), 0) AS total
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN (
                SELECT DISTINCT siswa_id, tanggal as tgl, status
                FROM absensi_siswa
                WHERE tanggal BETWEEN ? AND ?
            ) deduped ON s.id_siswa = deduped.siswa_id
            WHERE s.status = 'aktif'
        `;

        const params = [startDate, endDate];
        if (kelasId && kelasId !== '' && kelasId !== 'all') {
            query += ' AND k.id_kelas = ?';
            params.push(kelasId);
        }

        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';

        const [rows] = await this.pool.execute(query, params);
        if (cacheSystem?.isConnected) {
            await cacheSystem.set(cacheKey, rows, 'attendance', 300);
        }
        return rows;
    }

    /**
     * Get Schedule Matrix Data for Export
     */
    async getScheduleMatrixData() {
        // Fetch classes and schedules in parallel (independent queries)
        const [classesResult, schedulesResult] = await Promise.all([
            this.pool.execute(
                `SELECT id_kelas, nama_kelas, tingkat FROM kelas WHERE status = 'aktif' ORDER BY tingkat, nama_kelas`
            ),
            this.pool.execute(
                `SELECT j.*, g.nama as nama_guru, m.nama_mapel, r.nama_ruang, r.kode_ruang
                 FROM jadwal j
                 LEFT JOIN guru g ON j.guru_id = g.id_guru
                 LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
                 LEFT JOIN ruang_kelas r ON j.ruang_id = r.id_ruang
                 WHERE j.status = 'aktif'`
            )
        ]);
        const [classes] = classesResult;
        const [schedules] = schedulesResult;

        // Transform to convenient map: [kelas_id][hari][jam_ke] = array/object
        const scheduleMap = {};
        schedules.forEach(s => {
            if (!scheduleMap[s.kelas_id]) scheduleMap[s.kelas_id] = {};
            if (!scheduleMap[s.kelas_id][s.hari]) scheduleMap[s.kelas_id][s.hari] = {};
            scheduleMap[s.kelas_id][s.hari][s.jam_ke] = s;
        });

        return { classes, scheduleMap };
    }

    /**
     * Get Laporan Kehadiran Siswa Data (Siswa + Absensi)
     */
    async getLaporanKehadiranSiswaData(kelasId, startDate, endDate, guruId = null) {
        const cacheKey = `export:laporan-kehadiran:${kelasId}:${startDate}:${endDate}:${guruId || 'all'}`;
        const cacheSystem = globalThis.cacheSystem;
        if (cacheSystem?.isConnected) {
            const cached = await cacheSystem.get(cacheKey, 'attendance');
            if (cached !== null) return cached;
        }
        // Build absensi query based on guruId
        let absensiQuery;
        let absensiParams = [kelasId, startDate, endDate];

        if (guruId) {
            // Guru
            absensiQuery = `SELECT a.siswa_id, a.status, a.terlambat, a.tanggal, j.jam_ke
                FROM absensi_siswa a JOIN jadwal j ON a.jadwal_id = j.id_jadwal
                WHERE j.guru_id = ? AND j.kelas_id = ? AND a.tanggal BETWEEN ? AND ?`;
            absensiParams = [guruId, kelasId, startDate, endDate];
        } else {
            // Admin
            absensiQuery = `SELECT a.siswa_id, a.status, a.terlambat, a.tanggal, j.jam_ke
                FROM absensi_siswa a JOIN jadwal j ON a.jadwal_id = j.id_jadwal
                WHERE j.kelas_id = ? AND a.tanggal BETWEEN ? AND ?`;
        }

        // Run both queries in parallel (siswa list and absensi records are independent)
        const [siswaResult, absensiResult] = await Promise.all([
            this.pool.execute(
                `SELECT s.id_siswa, s.nis, s.nama, k.nama_kelas
                 FROM siswa s JOIN kelas k ON s.kelas_id = k.id_kelas
                 WHERE s.kelas_id = ? AND s.status = 'aktif' ORDER BY s.nama`,
                [kelasId]
            ),
            this.pool.execute(absensiQuery, absensiParams)
        ]);

        const [siswa] = siswaResult;
        const [absensi] = absensiResult;

        const result = { siswa, absensi };
        if (cacheSystem?.isConnected) {
            await cacheSystem.set(cacheKey, result, 'attendance', 300);
        }
        return result;
    }

    /**
     * Get Jadwal Pertemuan Data
     */
    async getJadwalPertemuanData(kelasId, guruId = null) {
        let query;
        let params;

        if (guruId) {
            // Guru: get only their schedules for the class
            query = `
                SELECT j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai,
                    COALESCE(mp.nama_mapel, j.keterangan_khusus) as nama_mapel,
                    mp.kode_mapel, k.nama_kelas, rk.kode_ruang, rk.nama_ruang
                FROM jadwal j
                LEFT JOIN mapel mp ON j.mapel_id = mp.id_mapel
                JOIN kelas k ON j.kelas_id = k.id_kelas
                LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
                WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
                ORDER BY CASE j.hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 
                    WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 WHEN 'Minggu' THEN 7 END, j.jam_ke
            `;
            params = [guruId, kelasId];
        } else {
            // Admin: get all schedules for the class
            query = `
                SELECT j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai,
                    COALESCE(mp.nama_mapel, j.keterangan_khusus) as nama_mapel,
                    mp.kode_mapel, k.nama_kelas, rk.kode_ruang, rk.nama_ruang,
                    g.nama as nama_guru
                FROM jadwal j
                LEFT JOIN mapel mp ON j.mapel_id = mp.id_mapel
                JOIN kelas k ON j.kelas_id = k.id_kelas
                LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
                LEFT JOIN guru g ON j.guru_id = g.id_guru
                WHERE j.kelas_id = ? AND j.status = 'aktif'
                ORDER BY CASE j.hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 
                    WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 WHEN 'Minggu' THEN 7 END, j.jam_ke
            `;
            params = [kelasId];
        }

        const [rows] = await this.pool.execute(query, params);
        return rows;
    }

    /**
     * Get Teacher Class Attendance Summary (Siswa)
     */
    async getTeacherClassAttendanceSummary(startDate, endDate, guruId = null, kelasId = null) {
        let query;
        let params = [startDate, endDate + ' 23:59:59'];

        if (guruId) {
            // Guru: can only see students in their classes
            query = `
                SELECT 
                    s.id_siswa as siswa_id, s.nama, s.nis, k.nama_kelas,
                    COALESCE(SUM(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END), 0) AS H,
                    COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                    COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                    COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                    COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                    COUNT(a.id_absensi) AS total
                FROM siswa s
                JOIN kelas k ON s.kelas_id = k.id_kelas
                LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                    AND a.waktu_absen BETWEEN ? AND ?
                JOIN jadwal j ON j.kelas_id = s.kelas_id AND j.guru_id = ? AND j.status = 'aktif'
                WHERE s.status = 'aktif'
            `;
            params.push(guruId);
        } else {
            // Admin: can see all students
            query = `
                SELECT 
                    s.id_siswa as siswa_id, s.nama, s.nis, k.nama_kelas,
                    COALESCE(SUM(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END), 0) AS H,
                    COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                    COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                    COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                    COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                    COUNT(a.id_absensi) AS total
                FROM siswa s
                JOIN kelas k ON s.kelas_id = k.id_kelas
                LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                    AND a.waktu_absen BETWEEN ? AND ?
                WHERE s.status = 'aktif'
            `;
        }

        if (kelasId && kelasId !== 'all') {
            query += ' AND s.kelas_id = ?';
            params.push(kelasId);
        }

        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';

        const [rows] = await this.pool.execute(query, params);
        return rows;
    }

    /**
     * Get Teacher Attendance Summary (Guru)
     */
    async getTeacherSummary(startDate, endDate) {
        const [teachers] = await this.pool.execute(`
            SELECT 
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN kg.status = 'Hadir' THEN 1 ELSE 0 END), 0) as H,
                COALESCE(SUM(CASE WHEN kg.status = 'Izin' THEN 1 ELSE 0 END), 0) as I,
                COALESCE(SUM(CASE WHEN kg.status = 'Sakit' THEN 1 ELSE 0 END), 0) as S,
                COALESCE(SUM(CASE WHEN kg.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as A,
                COALESCE(SUM(CASE WHEN kg.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(kg.id_absensi), 0), 0) as presentase
            FROM guru g
            LEFT JOIN absensi_guru kg ON g.id_guru = kg.guru_id 
                AND kg.tanggal BETWEEN ? AND ?
            WHERE g.status = 'aktif'
            GROUP BY g.id_guru, g.nama, g.nip
            ORDER BY g.nama
        `, [startDate, endDate]);
        return teachers;
    }

    /**
     * Get Banding Absen Data
     */
    async getBandingAbsen(startDate, endDate, kelasId, status) {
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
                COALESCE(CONCAT(j.jam_mulai, ' - ', j.jam_selesai), '-') as jadwal,
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

        if (kelasId && kelasId !== 'all') {
            query += ' AND k.id_kelas = ?';
            params.push(kelasId);
        }

        if (status && status !== 'all') {
            query += ' AND pba.status_banding = ?';
            params.push(status);
        }

        query += ' ORDER BY pba.tanggal_pengajuan DESC';

        const [bandingData] = await this.pool.execute(query, params);
        return bandingData;
    }

    /**
     * Get Riwayat Banding Absen
     */
    async getRiwayatBandingAbsen(startDate, endDate, guruId, kelasId, status) {
        const statusMap = {
            approved: 'disetujui',
            rejected: 'ditolak',
            pending: 'pending'
        };

        const normalizedStatus = status && statusMap[status] ? statusMap[status] : status;

        let query = `
            SELECT 
                ba.id_banding as id,
                DATE_FORMAT(ba.tanggal_pengajuan, '%Y-%m-%d') as tanggal_pengajuan,
                DATE_FORMAT(ba.tanggal_absen, '%Y-%m-%d') as tanggal_absen,
                ba.status_asli as status_absen,
                ba.alasan_banding,
                ba.status_banding,
                CASE ba.status_banding
                    WHEN 'disetujui' THEN 'approved'
                    WHEN 'ditolak' THEN 'rejected'
                    ELSE 'pending'
                END as status,
                DATE_FORMAT(ba.tanggal_keputusan, '%Y-%m-%d') as tanggal_disetujui,
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

        if (guruId) {
            query += ` AND (j.guru_id = ? OR EXISTS (
                SELECT 1 FROM jadwal_guru jg
                WHERE jg.jadwal_id = j.id_jadwal AND jg.guru_id = ?
            ))`;
            params.push(guruId, guruId);
        }

        if (kelasId && kelasId !== 'all') {
            query += ` AND s.kelas_id = ?`;
            params.push(kelasId);
        }

        if (normalizedStatus && normalizedStatus !== 'all') {
            query += ` AND ba.status_banding = ?`;
            params.push(normalizedStatus);
        }

        query += ` ORDER BY ba.tanggal_pengajuan DESC, s.nama`;

        const [rows] = await this.pool.execute(query, params);
        return rows;
    }

    /**
     * Get Presensi Siswa SMKN 13 Format
     */
    /**
     * Get Presensi Siswa SMKN13 with optional server-side pagination
     * Optimized: correlated subquery replaced with LEFT JOIN for total_siswa
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {number|null} guruId - Teacher ID filter
     * @param {string|null} kelasId - Class ID filter
     * @param {number|null} page - Page number (1-based) for pagination
     * @param {number|null} limit - Items per page
     * @returns {Array|Object} Array of rows (no pagination) or {data, total, page, limit, totalPages}
     */
    async getPresensiSiswaSmkn13(startDate, endDate, guruId = null, kelasId = null, page = null, limit = null) {
        let whereClause = `WHERE a.tanggal BETWEEN ? AND ?`;
        const params = [startDate, endDate];

        if (guruId) {
            whereClause += ` AND j.guru_id = ?`;
            params.push(guruId);
        }

        if (kelasId && kelasId !== 'all') {
            whereClause += ` AND j.kelas_id = ?`;
            params.push(kelasId);
        }

        // LEFT JOIN replaces correlated subquery for total_siswa (eliminates per-group re-execution)
        const fromClause = `
            FROM absensi_siswa a
            JOIN jadwal j ON a.jadwal_id = j.id_jadwal
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN (
                SELECT kelas_id, COUNT(*) as total_siswa
                FROM siswa WHERE status = 'aktif'
                GROUP BY kelas_id
            ) ts ON ts.kelas_id = k.id_kelas
            ${whereClause}
        `;

        const selectColumns = `
            SELECT 
                DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
                j.hari,
                j.jam_mulai,
                j.jam_selesai,
                COALESCE(m.nama_mapel, j.keterangan_khusus) as mata_pelajaran,
                k.nama_kelas,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                COALESCE(ts.total_siswa, 0) as total_siswa,
                SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as izin,
                SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
                SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END) as alpa,
                SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END) as dispen,
                SUM(CASE WHEN a.terlambat = 1 THEN 1 ELSE 0 END) as terlambat_count
        `;

        // Separate GROUP BY (for count) and ORDER BY (for data only)
        const groupClause = `
            GROUP BY a.tanggal, j.hari, j.jam_mulai, j.jam_selesai, m.nama_mapel,
                     j.keterangan_khusus, k.nama_kelas, k.id_kelas, g.nama, ts.total_siswa
        `;
        const orderClause = `ORDER BY a.tanggal DESC, j.jam_mulai`;

        // Paginated mode: return { data, total, page, limit, totalPages }
        if (page !== null && limit !== null) {
            // Optimized count: strip ORDER BY (useless for counting) and
            // unnecessary LEFT JOINs (guru, mapel, siswa count) to reduce CPU.
            // Only needs absensi_siswa + jadwal + kelas for the GROUP BY key columns.
            const countFromClause = `
                FROM absensi_siswa a
                JOIN jadwal j ON a.jadwal_id = j.id_jadwal
                JOIN kelas k ON j.kelas_id = k.id_kelas
                ${whereClause}
            `;
            const countGroupClause = `
                GROUP BY a.tanggal, j.hari, j.jam_mulai, j.jam_selesai,
                         j.keterangan_khusus, k.nama_kelas, k.id_kelas
            `;
            const countQuery = `SELECT COUNT(*) as total FROM (SELECT 1 ${countFromClause} ${countGroupClause}) as counted`;

            const offset = (page - 1) * limit;
            const dataQuery = `${selectColumns} ${fromClause} ${groupClause} ${orderClause} LIMIT ? OFFSET ?`;

            // Run count and data queries in parallel to halve response time
            const [countResult, dataResult] = await Promise.all([
                this.pool.execute(countQuery, params),
                this.pool.query(dataQuery, [...params, limit, offset])
            ]);

            const total = countResult[0][0].total;
            const rows = dataResult[0];

            return { data: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
        }

        // Non-paginated mode: return plain array (backward compatible for Excel export)
        const query = `${selectColumns} ${fromClause} ${groupClause} ${orderClause}`;
        const [rows] = await this.pool.execute(query, params);
        return rows;
    }

    /**
     * Get Rekap Ketidakhadiran (Bulanan/Tahunan) - Optimized
     * Uses pre-dedup subquery instead of COUNT(DISTINCT CONCAT(...)) for ~10x better performance.
     * The old pattern ran 5x CONCAT string operations per row which was the #1 MySQL CPU killer.
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {number|null} guruId - Teacher ID filter
     * @param {string|null} kelasId - Class ID filter
     * @param {string} reportType - 'bulanan' or 'tahunan'
     * @returns {Array} Aggregated attendance data per period per class
     */
    async getRekapKetidakhadiran(startDate, endDate, guruId = null, kelasId = null, reportType = 'bulanan') {
        const periodExpr = reportType === 'bulanan'
            ? "DATE_FORMAT(a.tanggal, '%Y-%m')"
            : "YEAR(a.tanggal)";

        let innerWhere = `WHERE a.tanggal BETWEEN ? AND ?`;
        const params = [startDate, endDate];

        if (guruId) {
            innerWhere += ` AND j.guru_id = ?`;
            params.push(guruId);
        }

        if (kelasId && kelasId !== 'all') {
            innerWhere += ` AND s.kelas_id = ?`;
            params.push(kelasId);
        }

        // Pre-deduplicate (siswa_id, date, status) in subquery, then aggregate with simple SUM.
        // This eliminates 5x COUNT(DISTINCT CONCAT(...)) which was the #1 CPU killer.
        const query = `
            SELECT 
                dedup.periode,
                k.nama_kelas,
                k.id_kelas,
                COALESCE(ts.total_siswa, 0) as total_siswa,
                SUM(CASE WHEN dedup.status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                SUM(CASE WHEN dedup.status = 'Izin' THEN 1 ELSE 0 END) as izin,
                SUM(CASE WHEN dedup.status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
                SUM(CASE WHEN dedup.status = 'Alpa' THEN 1 ELSE 0 END) as alpa,
                SUM(CASE WHEN dedup.status = 'Dispen' THEN 1 ELSE 0 END) as dispen
            FROM (
                SELECT DISTINCT
                    a.siswa_id,
                    DATE(a.tanggal) as tgl,
                    a.status,
                    s.kelas_id,
                    ${periodExpr} as periode
                FROM absensi_siswa a
                JOIN siswa s ON a.siswa_id = s.id_siswa
                JOIN jadwal j ON a.jadwal_id = j.id_jadwal
                ${innerWhere}
            ) dedup
            JOIN kelas k ON dedup.kelas_id = k.id_kelas
            LEFT JOIN (
                SELECT kelas_id, COUNT(*) as total_siswa
                FROM siswa WHERE status = 'aktif'
                GROUP BY kelas_id
            ) ts ON ts.kelas_id = k.id_kelas
            GROUP BY dedup.periode, k.nama_kelas, k.id_kelas, ts.total_siswa
            ORDER BY dedup.periode DESC, k.nama_kelas
        `;

        const [rows] = await this.pool.execute(query, params);
        return rows;
    }

    /**
     * Get Ringkasan Kehadiran Siswa SMKN 13
     */
    async getRingkasanKehadiranSiswaSmkn13(startDate, endDate, guruId, kelasId) {
        let query = `
            SELECT 
                s.id_siswa as id, s.nis, s.nama, k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) as H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) as I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) as S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) as A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) as D,
                COUNT(a.id) as total_absen
            FROM siswa s
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND a.tanggal BETWEEN ? AND ?
                AND a.jadwal_id IN (SELECT j.id_jadwal FROM jadwal j WHERE j.guru_id = ?)
            WHERE s.status = 'aktif'
        `;

        const params = [startDate, endDate, guruId];
        if (kelasId && kelasId !== 'all') {
            query += ` AND s.kelas_id = ?`;
            params.push(kelasId);
        }
        query += ` GROUP BY s.id_siswa, s.nis, s.nama, k.nama_kelas ORDER BY k.nama_kelas, s.nama`;

        const [rows] = await this.pool.execute(query, params);
        return rows;
    }

    /**
     * Get Rekap Ketidakhadiran Guru
     */
     async getRekapKetidakhadiranGuru(tahunAjaran) {
        const query = `
            SELECT 
                g.id_guru as id,
                g.nama,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 7 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as jul,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 8 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as agt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 9 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as sep,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 10 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as okt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 11 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as nov,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 12 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as des,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 1 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as jan,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 2 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as feb,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 3 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as mar,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 4 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as apr,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 5 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as mei,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 6 AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as jun
            FROM guru g
            LEFT JOIN absensi_guru a ON g.id_guru = a.guru_id 
                AND (
                    (MONTH(a.tanggal) >= 7 AND YEAR(a.tanggal) = ?)
                    OR (MONTH(a.tanggal) <= 6 AND YEAR(a.tanggal) = ? + 1)
                )
            WHERE g.status = 'aktif'
            GROUP BY g.id_guru, g.nama
            ORDER BY g.nama
        `;
        const [rows] = await this.pool.execute(query, [tahunAjaran, tahunAjaran]);
        return rows;
    }
    /**
     * Get Rekap Ketidakhadiran Guru SMKN 13
     */
    async getRekapKetidakhadiranGuruSmkn13(tahun) {
        const query = `
            SELECT 
                g.id_guru as id, g.nama, g.nip,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 7 THEN 1 ELSE 0 END), 0) as jul,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 8 THEN 1 ELSE 0 END), 0) as agt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 9 THEN 1 ELSE 0 END), 0) as sep,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 10 THEN 1 ELSE 0 END), 0) as okt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 11 THEN 1 ELSE 0 END), 0) as nov,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 12 THEN 1 ELSE 0 END), 0) as des,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 1 THEN 1 ELSE 0 END), 0) as jan,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 2 THEN 1 ELSE 0 END), 0) as feb,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 3 THEN 1 ELSE 0 END), 0) as mar,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 4 THEN 1 ELSE 0 END), 0) as apr,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 5 THEN 1 ELSE 0 END), 0) as mei,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 6 THEN 1 ELSE 0 END), 0) as jun,
                COALESCE(SUM(CASE WHEN a.status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END), 0) as total_ketidakhadiran
            FROM guru g
            LEFT JOIN absensi_guru a ON g.id_guru = a.guru_id 
                AND YEAR(a.tanggal) = ? 
                AND a.status IN ('Tidak Hadir', 'Sakit', 'Izin')
            GROUP BY g.id_guru, g.nama, g.nip
            ORDER BY g.nama
        `;
        const [rows] = await this.pool.execute(query, [tahun]);
        return rows;
    }

    /**
     * Get Rekap Ketidakhadiran Siswa (Semester)
     */
    async getRekapKetidakhadiranSiswa(tahun, kelasId, semester) {
        // Determine months based on semester
        const months = semester === 'gasal' 
            ? [7, 8, 9, 10, 11, 12] // Juli - Desember
            : [1, 2, 3, 4, 5, 6];   // Januari - Juni

        const query = `
            SELECT 
                a.siswa_id, 
                MONTH(a.tanggal) as bulan,
                SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as S,
                SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as I,
                SUM(CASE WHEN a.status IN ('Alpa', 'Alpha', 'Tanpa Keterangan') THEN 1 ELSE 0 END) as A
            FROM absensi_siswa a 
            INNER JOIN siswa s ON a.siswa_id = s.id_siswa 
            WHERE s.kelas_id = ? AND YEAR(a.tanggal) = ? AND MONTH(a.tanggal) IN (${months.join(',')})
            GROUP BY a.siswa_id, MONTH(a.tanggal)
        `;
        const [presensiData] = await this.pool.execute(query, [kelasId, tahun]);
        return presensiData;
    }

    /**
     * Get Presensi Siswa Detail (Bulanan)
     */
    async getPresensiSiswaDetail(tahun, bulan, kelasId) {
        const query = `
            SELECT a.siswa_id, DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal, a.status, a.keterangan
            FROM absensi_siswa a INNER JOIN siswa s ON a.siswa_id = s.id_siswa
            WHERE s.kelas_id = ? AND YEAR(a.tanggal) = ? AND MONTH(a.tanggal) = ?
            ORDER BY a.siswa_id, a.tanggal
        `;
        const [rows] = await this.pool.execute(query, [kelasId, tahun, bulan]);
        return rows;
    }

    /**
     * Get Admin Attendance
     */
    async getAdminAttendance() {
        const query = `
            SELECT 
                DATE_FORMAT(a.waktu_absen, '%d/%m/%Y') as tanggal,
                s.nama as nama_siswa, s.nis, k.nama_kelas, a.status,
                COALESCE(a.keterangan, '-') as keterangan,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen
            FROM absensi_siswa a
            JOIN siswa s ON a.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            ORDER BY a.tanggal DESC, k.nama_kelas, s.nama
        `;
        const [rows] = await this.pool.execute(query);
        return rows;
    }

    /**
     * Get Jadwal Matrix
     */
    async getJadwalMatrix(kelasId, hari) {
        let query = `
            SELECT j.id_jadwal, j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai, j.jenis_aktivitas,
                k.nama_kelas, k.id_kelas,
                COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                COALESCE(g.nama, 'Sistem') as nama_guru, 
                rk.kode_ruang
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            WHERE j.status = 'aktif'
        `;
        const params = [];
        if (kelasId && kelasId !== 'all') { query += ' AND j.kelas_id = ?'; params.push(kelasId); }
        if (hari && hari !== 'all') { query += ' AND j.hari = ?'; params.push(hari); }
        query += ` ORDER BY FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'), j.jam_ke, k.nama_kelas`;

        const [rows] = await this.pool.execute(query, params);
        return rows;
    }
}

export default new ExportService();
