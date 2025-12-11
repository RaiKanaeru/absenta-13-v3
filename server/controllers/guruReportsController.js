/**
 * Guru Reports Controller
 * Handles teacher-specific attendance reports
 * Migrated from server_modern.js
 */

// Get presensi siswa SMK 13 untuk laporan guru
export const getPresensiSiswaSmkn13 = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Fetching presensi siswa SMKN 13:', { startDate, endDate, kelas_id, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query = `
      SELECT 
        a.tanggal,
        j.hari,
        j.jam_mulai,
        j.jam_selesai,
        COALESCE(m.nama_mapel, j.keterangan_khusus) as mata_pelajaran,
        k.nama_kelas,
        COALESCE(g.nama, 'Sistem') as nama_guru,
        COUNT(DISTINCT s.id_siswa) as total_siswa,
        COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
        COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
        COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
        COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
        COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
      FROM absensi_siswa a
      JOIN jadwal j ON a.jadwal_id = j.id_jadwal
      JOIN kelas k ON j.kelas_id = k.id_kelas
      LEFT JOIN guru g ON j.guru_id = g.id_guru
      LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
      LEFT JOIN siswa s ON j.kelas_id = s.kelas_id AND s.status = 'aktif'
      WHERE a.tanggal BETWEEN ? AND ?
        AND j.guru_id = ?
    `;

        const params = [startDate, endDate, guruId];

        if (kelas_id && kelas_id !== 'all') {
            query += ` AND j.kelas_id = ?`;
            params.push(kelas_id);
        }

        query += `
      GROUP BY a.tanggal, j.hari, j.jam_mulai, j.jam_selesai, m.nama_mapel, k.nama_kelas, g.nama
      ORDER BY a.tanggal DESC, j.jam_mulai
    `;

        const [rows] = await global.dbPool.execute(query, params);

        console.log(`✅ Presensi siswa SMKN 13 fetched: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching presensi siswa SMKN 13:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get rekap ketidakhadiran untuk laporan guru
export const getRekapKetidakhadiran = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, reportType } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Fetching rekap ketidakhadiran:', { startDate, endDate, kelas_id, reportType, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query;
        let params;

        if (reportType === 'bulanan') {
            // Laporan bulanan - grup berdasarkan bulan dan kelas
            query = `
        SELECT 
          DATE_FORMAT(a.tanggal, '%Y-%m') as periode,
          k.nama_kelas,
          COUNT(DISTINCT s.id_siswa) as total_siswa,
          COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
          COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
          COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
          COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
          COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
        FROM absensi_siswa a
        JOIN siswa s ON a.siswa_id = s.id_siswa
        JOIN kelas k ON s.kelas_id = k.id_kelas
        JOIN jadwal j ON a.jadwal_id = j.id_jadwal
        WHERE a.tanggal BETWEEN ? AND ?
          AND j.guru_id = ?
      `;

            params = [startDate, endDate, guruId];

            if (kelas_id && kelas_id !== 'all') {
                query += ` AND s.kelas_id = ?`;
                params.push(kelas_id);
            }

            query += `
        GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m'), k.nama_kelas
        ORDER BY periode DESC, k.nama_kelas
      `;
        } else {
            // Laporan tahunan - grup berdasarkan tahun dan kelas
            query = `
        SELECT 
          YEAR(a.tanggal) as periode,
          k.nama_kelas,
          COUNT(DISTINCT s.id_siswa) as total_siswa,
          COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
          COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
          COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
          COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
          COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
        FROM absensi_siswa a
        JOIN siswa s ON a.siswa_id = s.id_siswa
        JOIN kelas k ON s.kelas_id = k.id_kelas
        JOIN jadwal j ON a.jadwal_id = j.id_jadwal
        WHERE a.tanggal BETWEEN ? AND ?
          AND j.guru_id = ?
      `;

            params = [startDate, endDate, guruId];

            if (kelas_id && kelas_id !== 'all') {
                query += ` AND s.kelas_id = ?`;
                params.push(kelas_id);
            }

            query += `
        GROUP BY YEAR(a.tanggal), k.nama_kelas
        ORDER BY periode DESC, k.nama_kelas
      `;
        }

        const [rows] = await global.dbPool.execute(query, params);

        console.log(`✅ Rekap ketidakhadiran fetched: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching rekap ketidakhadiran:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
