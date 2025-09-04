console.log('🚀 ABSENTA Modern Server Starting...');

import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import ExcelJS from 'exceljs';

const app = express();
const port = 3001;

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'absenta-super-secret-key-2025';
const saltRounds = 10;

// Middleware setup
app.use(cors({ 
    credentials: true, 
    origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:5173', 'http://localhost:3000'] 
}));
app.use(express.json());
app.use(cookieParser());

// ================================================
// DATABASE CONNECTION - MySQL Real Connection
// ================================================
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'absenta13',
    connectTimeout: 10000,
    acquireTimeout: 10000,
    timeout: 10000,
    reconnect: true
};

let connection;

async function connectToDatabase() {
    console.log('🔄 Connecting to MySQL database...');
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Successfully connected to MySQL database');

        // Test connection
        await connection.execute('SELECT 1');
        console.log('✅ Database connection test successful');

        connection.on('error', err => {
            console.error('❌ Database connection error:', err);
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                connectToDatabase();
            }
        });

    } catch (error) {
        console.error('❌ Failed to connect to database:', error.message);
        console.log('🔄 Retrying connection in 5 seconds...');
        setTimeout(connectToDatabase, 5000);
    }
}

// ================================================
// MIDDLEWARE - JWT Authentication & Authorization
// ================================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1] || req.cookies.token;
    
    if (!token) {
        console.log('❌ Access denied: No token provided');
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('❌ Token verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        console.log(`✅ Token verified for user: ${user.username} (${user.role})`);
        req.user = user;
        next();
    });
}

// Role-based access control middleware
function requireRole(roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

// ================================================
// AUTHENTICATION ENDPOINTS
// ================================================

// Login endpoint - Real authentication with MySQL
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log(`🔐 Login attempt for username: ${username}`);
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Query user from database
        const [rows] = await connection.execute(
            'SELECT * FROM users WHERE username = ? AND status = "aktif"',
            [username]
        );

        if (rows.length === 0) {
            console.log('❌ Login failed: User not found');
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = rows[0];
        
        // Verify password with bcrypt
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            console.log('❌ Login failed: Invalid password');
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Get additional user data based on role
        let additionalData = {};
        
        if (user.role === 'guru') {
            const [guruData] = await connection.execute(
                `SELECT g.*, m.nama_mapel 
                 FROM guru g 
                 JOIN mapel m ON g.mapel_id = m.id_mapel 
                 WHERE g.user_id = ?`,
                [user.id]
            );
            if (guruData.length > 0) {
                additionalData = {
                    guru_id: guruData[0].id_guru,
                    nip: guruData[0].nip,
                    mapel: guruData[0].nama_mapel
                };
            }
        } else if (user.role === 'siswa') {
            const [siswaData] = await connection.execute(
                `SELECT sp.*, k.nama_kelas 
                 FROM siswa_perwakilan sp 
                 JOIN kelas k ON sp.kelas_id = k.id_kelas 
                 WHERE sp.user_id = ?`,
                [user.id]
            );
            if (siswaData.length > 0) {
                additionalData = {
                    siswa_id: siswaData[0].id_siswa,
                    nis: siswaData[0].nis,
                    kelas: siswaData[0].nama_kelas,
                    kelas_id: siswaData[0].kelas_id
                };
            }
        }

        // Generate JWT token
        const tokenPayload = {
            id: user.id,
            username: user.username,
            nama: user.nama,
            role: user.role,
            ...additionalData
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        // Set cookie and return response
        res.cookie('token', token, { 
            httpOnly: true, 
            secure: false, // Set to true in production with HTTPS
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        console.log(`✅ Login successful for user: ${user.username} (${user.role})`);
        
        res.json({
            success: true,
            message: 'Login successful',
            user: tokenPayload,
            token
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    console.log('✅ User logged out successfully');
    res.json({ success: true, message: 'Logged out successfully' });
});

// Verify token endpoint
app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({ 
        success: true, 
        user: req.user,
        message: 'Token is valid'
    });
});

// ================================================
// DASHBOARD ENDPOINTS - Real Data from MySQL
// ================================================

// Lightweight master data for filters
// app.get('/api/admin/classes', authenticateToken, requireRole(['admin']), async (req, res) => {
//     try {
//         const [rows] = await connection.execute(
//             'SELECT id_kelas AS id, nama_kelas FROM kelas WHERE status = "aktif" ORDER BY nama_kelas'
//         );
//         res.json(rows);
//     } catch (error) {
//         console.error('❌ Error fetching classes:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// }); // DUPLICATE ENDPOINT - COMMENTED OUT

// Get dashboard statistics
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const stats = {};
        
        if (req.user.role === 'admin') {
            // Admin statistics
            const [totalSiswa] = await connection.execute(
                'SELECT COUNT(*) as count FROM siswa_perwakilan WHERE status = "aktif"'
            );
            
            const [totalGuru] = await connection.execute(
                'SELECT COUNT(*) as count FROM guru WHERE status = "aktif"'
            );
            
            const [totalKelas] = await connection.execute(
                'SELECT COUNT(*) as count FROM kelas WHERE status = "aktif"'
            );
            
            const [totalMapel] = await connection.execute(
                'SELECT COUNT(*) as count FROM mapel WHERE status = "aktif"'
            );
            
            const [absensiHariIni] = await connection.execute(
                'SELECT COUNT(*) as count FROM absensi_guru WHERE tanggal = CURDATE()'
            );
            
            const [persentaseKehadiran] = await connection.execute(
                `SELECT 
                    ROUND(
                        (SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
                    ) as persentase
                 FROM absensi_guru 
                 WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
            );

            stats.totalSiswa = totalSiswa[0].count;
            stats.totalGuru = totalGuru[0].count;
            stats.totalKelas = totalKelas[0].count;
            stats.totalMapel = totalMapel[0].count;
            stats.absensiHariIni = absensiHariIni[0].count;
            stats.persentaseKehadiran = persentaseKehadiran[0].persentase || 0;
            
        } else if (req.user.role === 'guru') {
            // Guru statistics
            const [jadwalHariIni] = await connection.execute(
                `SELECT COUNT(*) as count 
                 FROM jadwal 
                 WHERE guru_id = ? AND hari = DAYNAME(CURDATE()) AND status = 'aktif'`,
                [req.user.guru_id]
            );
            
            const [absensiMingguIni] = await connection.execute(
                `SELECT COUNT(*) as count 
                 FROM absensi_guru 
                 WHERE guru_id = ? AND tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
                [req.user.guru_id]
            );
            
            const [persentaseKehadiran] = await connection.execute(
                `SELECT 
                    ROUND(
                        (SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
                    ) as persentase
                 FROM absensi_guru 
                 WHERE guru_id = ? AND tanggal >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
                [req.user.guru_id]
            );

            stats.jadwalHariIni = jadwalHariIni[0].count;
            stats.absensiMingguIni = absensiMingguIni[0].count;
            stats.persentaseKehadiran = persentaseKehadiran[0].persentase || 0;
            
        } else if (req.user.role === 'siswa') {
            // Siswa statistics
            const [jadwalHariIni] = await connection.execute(
                `SELECT COUNT(*) as count 
                 FROM jadwal 
                 WHERE kelas_id = ? AND hari = DAYNAME(CURDATE()) AND status = 'aktif'`,
                [req.user.kelas_id]
            );
            
            const [absensiMingguIni] = await connection.execute(
                `SELECT COUNT(*) as count 
                 FROM absensi_guru 
                 WHERE kelas_id = ? AND tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
                [req.user.kelas_id]
            );

            stats.jadwalHariIni = jadwalHariIni[0].count;
            stats.absensiMingguIni = absensiMingguIni[0].count;
        }

        console.log(`📊 Dashboard stats retrieved for ${req.user.role}: ${req.user.username}`);
        res.json({ success: true, data: stats });

    } catch (error) {
        console.error('❌ Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
    }
});

// Get dashboard chart data
app.get('/api/dashboard/chart', authenticateToken, async (req, res) => {
    try {
        const { period = '7days' } = req.query;
        let chartData = [];

        if (req.user.role === 'admin') {
            // Admin chart - Weekly attendance overview
            const [weeklyData] = await connection.execute(
                `SELECT 
                    DATE(tanggal) as tanggal,
                    SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                    SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                 FROM absensi_guru 
                 WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                 GROUP BY DATE(tanggal)
                 ORDER BY tanggal`
            );

            chartData = weeklyData.map(row => ({
                date: row.tanggal,
                hadir: row.hadir,
                tidakHadir: row.tidak_hadir,
                total: row.hadir + row.tidak_hadir
            }));

        } else if (req.user.role === 'guru') {
            // Guru chart - Personal attendance
            const [personalData] = await connection.execute(
                `SELECT 
                    DATE(tanggal) as tanggal,
                    SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                    SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                 FROM absensi_guru 
                 WHERE guru_id = ? AND tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                 GROUP BY DATE(tanggal)
                 ORDER BY tanggal`,
                [req.user.guru_id]
            );

            chartData = personalData.map(row => ({
                date: row.tanggal,
                hadir: row.hadir,
                tidakHadir: row.tidak_hadir
            }));
        }

        console.log(`📈 Chart data retrieved for ${req.user.role}: ${req.user.username}`);
        res.json({ success: true, data: chartData });

    } catch (error) {
        console.error('❌ Chart data error:', error);
        res.status(500).json({ error: 'Failed to retrieve chart data' });
    }
});

// ================================================
// CRUD ENDPOINTS - ADMIN ONLY
// ================================================

// SISWA CRUD
app.get('/api/admin/siswa', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT sp.*, k.nama_kelas, u.username, u.status as user_status
            FROM siswa_perwakilan sp
            JOIN kelas k ON sp.kelas_id = k.id_kelas
            JOIN users u ON sp.user_id = u.id
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM siswa_perwakilan sp JOIN kelas k ON sp.kelas_id = k.id_kelas JOIN users u ON sp.user_id = u.id';
        let params = [];

        if (search) {
            query += ' WHERE (sp.nama LIKE ? OR sp.nis LIKE ? OR k.nama_kelas LIKE ?)';
            countQuery += ' WHERE (sp.nama LIKE ? OR sp.nis LIKE ? OR k.nama_kelas LIKE ?)';
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }

        query += ' ORDER BY sp.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await connection.execute(query, params);
        const [countResult] = await connection.execute(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);

        res.json({
            success: true,
            data: rows,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('❌ Get siswa error:', error);
        res.status(500).json({ error: 'Failed to retrieve student data' });
    }
});

app.post('/api/admin/siswa', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { nis, nama, kelas_id, username, password, jabatan } = req.body;

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Start transaction
        await connection.beginTransaction();

        // Create user account
        const [userResult] = await connection.execute(
            'INSERT INTO users (username, password, role, nama, status) VALUES (?, ?, "siswa", ?, "aktif")',
            [username, hashedPassword, nama]
        );

        // Create siswa_perwakilan record
        await connection.execute(
            'INSERT INTO siswa_perwakilan (nis, nama, kelas_id, user_id, jabatan, status) VALUES (?, ?, ?, ?, ?, "aktif")',
            [nis, nama, kelas_id, userResult.insertId, jabatan || 'Sekretaris Kelas']
        );

        await connection.commit();

        console.log(`✅ New siswa created: ${nama} (${nis})`);
        res.json({ success: true, message: 'Siswa berhasil ditambahkan' });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Create siswa error:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'NIS atau username sudah digunakan' });
        } else {
            res.status(500).json({ error: 'Failed to create student' });
        }
    }
});

// GURU CRUD
app.get('/api/admin/guru', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT g.*, m.nama_mapel, u.username, u.status as user_status
            FROM guru g
            JOIN mapel m ON g.mapel_id = m.id_mapel
            JOIN users u ON g.user_id = u.id
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM guru g JOIN mapel m ON g.mapel_id = m.id_mapel JOIN users u ON g.user_id = u.id';
        let params = [];

        if (search) {
            query += ' WHERE (g.nama LIKE ? OR g.nip LIKE ? OR m.nama_mapel LIKE ?)';
            countQuery += ' WHERE (g.nama LIKE ? OR g.nip LIKE ? OR m.nama_mapel LIKE ?)';
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }

        query += ' ORDER BY g.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await connection.execute(query, params);
        const [countResult] = await connection.execute(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);

        res.json({
            success: true,
            data: rows,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('❌ Get guru error:', error);
        res.status(500).json({ error: 'Failed to retrieve teacher data' });
    }
});

app.post('/api/admin/guru', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { nip, nama, mapel_id, username, password, no_telp, alamat } = req.body;

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Start transaction
        await connection.beginTransaction();

        // Create user account
        const [userResult] = await connection.execute(
            'INSERT INTO users (username, password, role, nama, status) VALUES (?, ?, "guru", ?, "aktif")',
            [username, hashedPassword, nama]
        );

        // Create guru record
        await connection.execute(
            'INSERT INTO guru (nip, nama, mapel_id, user_id, no_telp, alamat, status) VALUES (?, ?, ?, ?, ?, ?, "aktif")',
            [nip, nama, mapel_id, userResult.insertId, no_telp, alamat]
        );

        await connection.commit();

        console.log(`✅ New guru created: ${nama} (${nip})`);
        res.json({ success: true, message: 'Guru berhasil ditambahkan' });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Create guru error:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'NIP atau username sudah digunakan' });
        } else {
            res.status(500).json({ error: 'Failed to create teacher' });
        }
    }
});

// MAPEL CRUD
app.get('/api/admin/mapel', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Getting subjects for admin dashboard');
        
        const query = `
            SELECT id_mapel as id, kode_mapel, nama_mapel, deskripsi, status
            FROM mapel 
            ORDER BY nama_mapel
        `;
        
        const [rows] = await connection.execute(query);
        console.log(`✅ Subjects retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting subjects:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/mapel', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { kode_mapel, nama_mapel, deskripsi, status } = req.body;
        console.log('➕ Adding subject:', { kode_mapel, nama_mapel, deskripsi, status });

        if (!kode_mapel || !nama_mapel) {
            return res.status(400).json({ error: 'Kode dan nama mata pelajaran wajib diisi' });
        }

        // Check if kode_mapel already exists
        const [existing] = await connection.execute(
            'SELECT id_mapel FROM mapel WHERE kode_mapel = ?',
            [kode_mapel]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Kode mata pelajaran sudah digunakan' });
        }

        const insertQuery = `
            INSERT INTO mapel (kode_mapel, nama_mapel, deskripsi, status) 
            VALUES (?, ?, ?, ?)
        `;

        const [result] = await connection.execute(insertQuery, [
            kode_mapel, 
            nama_mapel, 
            deskripsi || null,
            status || 'aktif'
        ]);
        console.log('✅ Subject added successfully:', result.insertId);
        res.json({ message: 'Mata pelajaran berhasil ditambahkan', id: result.insertId });
    } catch (error) {
        console.error('❌ Error adding subject:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Kode mata pelajaran sudah digunakan' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Update subject
app.put('/api/admin/mapel/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { kode_mapel, nama_mapel, deskripsi, status } = req.body;
        console.log('📝 Updating subject:', { id, kode_mapel, nama_mapel, deskripsi, status });

        if (!kode_mapel || !nama_mapel) {
            return res.status(400).json({ error: 'Kode dan nama mata pelajaran wajib diisi' });
        }

        // Check if kode_mapel already exists for other records
        const [existing] = await connection.execute(
            'SELECT id_mapel FROM mapel WHERE kode_mapel = ? AND id_mapel != ?',
            [kode_mapel, id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Kode mata pelajaran sudah digunakan oleh mata pelajaran lain' });
        }

        const updateQuery = `
            UPDATE mapel 
            SET kode_mapel = ?, nama_mapel = ?, deskripsi = ?, status = ?
            WHERE id_mapel = ?
        `;

        const [result] = await connection.execute(updateQuery, [
            kode_mapel, 
            nama_mapel, 
            deskripsi || null,
            status || 'aktif',
            id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan' });
        }

        console.log('✅ Subject updated successfully');
        res.json({ message: 'Mata pelajaran berhasil diupdate' });
    } catch (error) {
        console.error('❌ Error updating subject:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete subject
app.delete('/api/admin/mapel/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting subject:', { id });

        const [result] = await connection.execute(
            'DELETE FROM mapel WHERE id_mapel = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan' });
        }

        console.log('✅ Subject deleted successfully');
        res.json({ message: 'Mata pelajaran berhasil dihapus' });
    } catch (error) {
        console.error('❌ Error deleting subject:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// KELAS CRUD
app.get('/api/admin/kelas', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Getting classes for admin dashboard');
        
        const query = `
            SELECT id_kelas as id, nama_kelas, tingkat, status
            FROM kelas 
            ORDER BY tingkat, nama_kelas
        `;
        
        const [rows] = await connection.execute(query);
        console.log(`✅ Classes retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting classes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/kelas', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { nama_kelas } = req.body;
        console.log('➕ Adding class:', { nama_kelas });

        if (!nama_kelas) {
            return res.status(400).json({ error: 'Nama kelas wajib diisi' });
        }

        // Extract tingkat from nama_kelas (contoh: "X IPA 1" -> tingkat = "X")
        const tingkat = nama_kelas.split(' ')[0];

        const insertQuery = `
            INSERT INTO kelas (nama_kelas, tingkat, status) 
            VALUES (?, ?, 'aktif')
        `;

        const [result] = await connection.execute(insertQuery, [nama_kelas, tingkat]);
        console.log('✅ Class added successfully:', result.insertId);
        res.json({ message: 'Kelas berhasil ditambahkan', id: result.insertId });
    } catch (error) {
        console.error('❌ Error adding class:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Nama kelas sudah ada' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Update class
app.put('/api/admin/kelas/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nama_kelas } = req.body;
        console.log('📝 Updating class:', { id, nama_kelas });

        if (!nama_kelas) {
            return res.status(400).json({ error: 'Nama kelas wajib diisi' });
        }

        // Extract tingkat from nama_kelas
        const tingkat = nama_kelas.split(' ')[0];

        const updateQuery = `
            UPDATE kelas 
            SET nama_kelas = ?, tingkat = ?
            WHERE id_kelas = ?
        `;

        const [result] = await connection.execute(updateQuery, [nama_kelas, tingkat, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Kelas tidak ditemukan' });
        }

        console.log('✅ Class updated successfully');
        res.json({ message: 'Kelas berhasil diupdate' });
    } catch (error) {
        console.error('❌ Error updating class:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete class
app.delete('/api/admin/kelas/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting class:', { id });

        const [result] = await connection.execute(
            'DELETE FROM kelas WHERE id_kelas = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Kelas tidak ditemukan' });
        }

        console.log('✅ Class deleted successfully');
        res.json({ message: 'Kelas berhasil dihapus' });
    } catch (error) {
        console.error('❌ Error deleting class:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// JADWAL ENDPOINTS - Schedule Management
// ================================================

// Get all schedules with join data
app.get('/api/admin/jadwal', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📅 Getting schedules for admin dashboard');
        
        const query = `
            SELECT 
                j.id_jadwal as id,
                j.kelas_id,
                j.mapel_id, 
                j.guru_id,
                j.hari,
                j.jam_ke,
                j.jam_mulai,
                j.jam_selesai,
                j.status,
                k.nama_kelas,
                m.nama_mapel,
                g.nama as nama_guru
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            JOIN mapel m ON j.mapel_id = m.id_mapel  
            JOIN guru g ON j.guru_id = g.id_guru
            WHERE j.status = 'aktif'
            ORDER BY 
                FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'),
                j.jam_ke, 
                k.nama_kelas
        `;
        
        const [rows] = await connection.execute(query);
        console.log(`✅ Schedules retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting schedules:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new schedule
app.post('/api/admin/jadwal', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { kelas_id, mapel_id, guru_id, hari, jam_ke, jam_mulai, jam_selesai } = req.body;
        console.log('➕ Adding schedule:', { kelas_id, mapel_id, guru_id, hari, jam_ke, jam_mulai, jam_selesai });

        // Validation
        if (!kelas_id || !mapel_id || !guru_id || !hari || !jam_ke || !jam_mulai || !jam_selesai) {
            return res.status(400).json({ error: 'Semua field wajib diisi' });
        }

        // Check for schedule conflicts - same class, day, and time slot
        const [conflicts] = await connection.execute(
            `SELECT id_jadwal FROM jadwal 
             WHERE kelas_id = ? AND hari = ? AND jam_ke = ? AND status = 'aktif'`,
            [kelas_id, hari, jam_ke]
        );

        if (conflicts.length > 0) {
            return res.status(400).json({ error: `Kelas sudah memiliki jadwal pada ${hari} jam ke-${jam_ke}` });
        }

        // Check teacher availability - same day and time slot
        const [teacherConflicts] = await connection.execute(
            `SELECT id_jadwal FROM jadwal 
             WHERE guru_id = ? AND hari = ? AND jam_ke = ? AND status = 'aktif'`,
            [guru_id, hari, jam_ke]
        );

        if (teacherConflicts.length > 0) {
            return res.status(400).json({ error: `Guru sudah memiliki jadwal mengajar pada ${hari} jam ke-${jam_ke}` });
        }

        const [result] = await connection.execute(
            `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, hari, jam_ke, jam_mulai, jam_selesai, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif')`,
            [kelas_id, mapel_id, guru_id, hari, jam_ke, jam_mulai, jam_selesai]
        );

        console.log('✅ Schedule added successfully');
        res.json({ 
            message: 'Jadwal berhasil ditambahkan',
            id: result.insertId 
        });
    } catch (error) {
        console.error('❌ Error adding schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update schedule
app.put('/api/admin/jadwal/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { kelas_id, mapel_id, guru_id, hari, jam_ke, jam_mulai, jam_selesai } = req.body;
        console.log('✏️ Updating schedule:', { id, kelas_id, mapel_id, guru_id, hari, jam_ke, jam_mulai, jam_selesai });

        // Validation
        if (!kelas_id || !mapel_id || !guru_id || !hari || !jam_ke || !jam_mulai || !jam_selesai) {
            return res.status(400).json({ error: 'Semua field wajib diisi' });
        }

        // Check for schedule conflicts (excluding current schedule)
        const [conflicts] = await connection.execute(
            `SELECT id_jadwal FROM jadwal 
             WHERE kelas_id = ? AND hari = ? AND jam_ke = ? AND status = 'aktif' AND id_jadwal != ?`,
            [kelas_id, hari, jam_ke, id]
        );

        if (conflicts.length > 0) {
            return res.status(400).json({ error: `Kelas sudah memiliki jadwal pada ${hari} jam ke-${jam_ke}` });
        }

        // Check teacher availability (excluding current schedule)
        const [teacherConflicts] = await connection.execute(
            `SELECT id_jadwal FROM jadwal 
             WHERE guru_id = ? AND hari = ? AND jam_ke = ? AND status = 'aktif' AND id_jadwal != ?`,
            [guru_id, hari, jam_ke, id]
        );

        if (teacherConflicts.length > 0) {
            return res.status(400).json({ error: `Guru sudah memiliki jadwal mengajar pada ${hari} jam ke-${jam_ke}` });
        }

        const [result] = await connection.execute(
            `UPDATE jadwal 
             SET kelas_id = ?, mapel_id = ?, guru_id = ?, hari = ?, jam_ke = ?, jam_mulai = ?, jam_selesai = ?
             WHERE id_jadwal = ?`,
            [kelas_id, mapel_id, guru_id, hari, jam_ke, jam_mulai, jam_selesai, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        console.log('✅ Schedule updated successfully');
        res.json({ message: 'Jadwal berhasil diperbarui' });
    } catch (error) {
        console.error('❌ Error updating schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete schedule  
app.delete('/api/admin/jadwal/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting schedule:', { id });

        const [result] = await connection.execute(
            'DELETE FROM jadwal WHERE id_jadwal = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        console.log('✅ Schedule deleted successfully');
        res.json({ message: 'Jadwal berhasil dihapus' });
    } catch (error) {
        console.error('❌ Error deleting schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get students for a specific schedule (class)
app.get('/api/schedule/:id/students', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`👥 Getting students for schedule ID: ${id}`);

        // First, get the schedule details to get the class ID
        const [scheduleData] = await connection.execute(
            'SELECT kelas_id FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [id]
        );

        if (scheduleData.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        const kelasId = scheduleData[0].kelas_id;
        const currentDate = new Date().toISOString().split('T')[0];

        // Get all students in the class with their existing attendance for today
        const [students] = await connection.execute(
            `SELECT 
                sp.id_siswa as id,
                sp.nis,
                sp.nama,
                sp.jenis_kelamin,
                sp.jabatan,
                sp.status,
                k.nama_kelas,
                COALESCE(a.status, 'Hadir') as attendance_status,
                a.keterangan as attendance_note,
                a.waktu_absen
            FROM siswa_perwakilan sp
            JOIN kelas k ON sp.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON sp.id_siswa = a.siswa_id 
                AND a.jadwal_id = ? 
                AND a.tanggal = ?
            WHERE sp.kelas_id = ? AND sp.status = 'aktif'
            ORDER BY sp.nama ASC`,
            [id, currentDate, kelasId]
        );

        console.log(`✅ Found ${students.length} students for schedule ${id} (class ${kelasId}) with attendance data`);
        res.json(students);
    } catch (error) {
        console.error('❌ Error getting students for schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit attendance for a schedule
app.post('/api/attendance/submit', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { scheduleId, attendance, notes, guruId } = req.body;
        
        if (!scheduleId || !attendance || !guruId) {
            return res.status(400).json({ error: 'Data absensi tidak lengkap' });
        }

        console.log(`📝 Submitting attendance for schedule ${scheduleId} by teacher ${guruId}`);
        console.log(`📊 Attendance data:`, JSON.stringify(attendance, null, 2));
        console.log(`📝 Notes data:`, JSON.stringify(notes, null, 2));

        // Get the schedule details to verify it exists
        const [scheduleData] = await connection.execute(
            'SELECT kelas_id, mapel_id FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [scheduleId]
        );

        if (scheduleData.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        const kelasId = scheduleData[0].kelas_id;
        const mapelId = scheduleData[0].mapel_id;

        // Insert attendance records for each student
        const attendanceEntries = Object.entries(attendance);
        const currentDate = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toISOString().slice(11, 19);

        for (const [studentId, status] of attendanceEntries) {
            const note = notes[studentId] || '';
            
            // Validate status
            const validStatuses = ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispen'];
            if (!validStatuses.includes(status)) {
                console.log(`❌ Invalid status "${status}" for student ${studentId}`);
                return res.status(400).json({ 
                    error: `Status tidak valid: ${status}. Status yang diperbolehkan: ${validStatuses.join(', ')}` 
                });
            }
            
            console.log(`👤 Processing student ${studentId}: status="${status}", note="${note}"`);
            
            // Check if attendance already exists for today
            const [existingAttendance] = await connection.execute(
                'SELECT id, status as current_status FROM absensi_siswa WHERE siswa_id = ? AND jadwal_id = ? AND tanggal = ?',
                [studentId, scheduleId, currentDate]
            );

            if (existingAttendance.length > 0) {
                const existingId = existingAttendance[0].id;
                const currentStatus = existingAttendance[0].current_status;
                console.log(`🔄 Updating existing attendance ID ${existingId} from "${currentStatus}" to "${status}"`);
                
                // Update existing attendance
                const [updateResult] = await connection.execute(
                    'UPDATE absensi_siswa SET status = ?, keterangan = ?, waktu_absen = ? WHERE id = ?',
                    [status, note, `${currentDate} ${currentTime}`, existingId]
                );
                
                console.log(`✅ Updated attendance for student ${studentId}: ${updateResult.affectedRows} rows affected`);
            } else {
                console.log(`➕ Inserting new attendance for student ${studentId}`);
                
                // Insert new attendance
                const [insertResult] = await connection.execute(
                    'INSERT INTO absensi_siswa (siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, guru_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [studentId, scheduleId, currentDate, status, note, `${currentDate} ${currentTime}`, guruId]
                );
                
                console.log(`✅ Inserted new attendance for student ${studentId}: ID ${insertResult.insertId}`);
            }
        }

        console.log(`✅ Attendance submitted successfully for ${attendanceEntries.length} students`);
        res.json({ 
            message: 'Absensi berhasil disimpan',
            processed: attendanceEntries.length,
            date: currentDate,
            scheduleId: scheduleId
        });
    } catch (error) {
        console.error('❌ Error submitting attendance:', error);
        res.status(500).json({ 
            error: 'Internal server error: ' + error.message,
            details: error.stack
        });
    }
});

// ================================================
// REPORTS ENDPOINTS - Teacher Attendance Reports
// ================================================

// Update permission request status
app.put('/api/admin/izin/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['disetujui', 'ditolak'].includes(status)) {
            return res.status(400).json({ error: 'Status harus disetujui atau ditolak' });
        }

        console.log(`🔄 Updating permission request ${id} to ${status}...`);

        const query = `
            UPDATE pengajuan_izin 
            SET status = ?, tanggal_disetujui = NOW() 
            WHERE id_izin = ?
        `;
        
        const [result] = await connection.execute(query, [status, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pengajuan izin tidak ditemukan' });
        }

        console.log(`✅ Permission request ${id} updated to ${status}`);
        res.json({ message: `Pengajuan berhasil ${status}` });
    } catch (error) {
        console.error('❌ Error updating permission request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get analytics data for dashboard
app.get('/api/admin/analytics', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Getting analytics dashboard data...');

        // Get student attendance statistics
        const studentAttendanceQuery = `
            SELECT 
                'Hari Ini' as periode,
                COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN a.status != 'Hadir' OR a.status IS NULL THEN 1 END) as tidak_hadir
            FROM siswa_perwakilan s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND a.tanggal = CURDATE()
            UNION ALL
            SELECT 
                'Minggu Ini' as periode,
                COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN a.status != 'Hadir' OR a.status IS NULL THEN 1 END) as tidak_hadir
            FROM siswa_perwakilan s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND YEARWEEK(a.tanggal, 1) = YEARWEEK(CURDATE(), 1)
            UNION ALL
            SELECT 
                'Bulan Ini' as periode,
                COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN a.status != 'Hadir' OR a.status IS NULL THEN 1 END) as tidak_hadir
            FROM siswa_perwakilan s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND YEAR(a.tanggal) = YEAR(CURDATE()) 
                AND MONTH(a.tanggal) = MONTH(CURDATE())
        `;

        // Get teacher attendance statistics  
        const teacherAttendanceQuery = `
            SELECT 
                'Hari Ini' as periode,
                COUNT(CASE WHEN ag.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN ag.status != 'Hadir' OR ag.status IS NULL THEN 1 END) as tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal = CURDATE()
            UNION ALL
            SELECT 
                'Minggu Ini' as periode,
                COUNT(CASE WHEN ag.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN ag.status != 'Hadir' OR ag.status IS NULL THEN 1 END) as tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
                AND YEARWEEK(ag.tanggal, 1) = YEARWEEK(CURDATE(), 1)
            UNION ALL
            SELECT 
                'Bulan Ini' as periode,
                COUNT(CASE WHEN ag.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN ag.status != 'Hadir' OR ag.status IS NULL THEN 1 END) as tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
                AND YEAR(ag.tanggal) = YEAR(CURDATE()) 
                AND MONTH(ag.tanggal) = MONTH(CURDATE())
        `;

        // Get top absent students
        const topAbsentStudentsQuery = `
            SELECT 
                s.nama,
                k.nama_kelas,
                COUNT(CASE WHEN a.status IN ('Alpa', 'Izin', 'Sakit', 'Dispen') THEN 1 END) as total_alpa
            FROM siswa_perwakilan s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id
            GROUP BY s.id_siswa, s.nama, k.nama_kelas
            HAVING total_alpa > 0
            ORDER BY total_alpa DESC
            LIMIT 5
        `;

        // Get top absent teachers
        const topAbsentTeachersQuery = `
            SELECT 
                g.nama,
                COUNT(CASE WHEN ag.status IN ('Tidak Hadir', 'Sakit', 'Izin', 'Dispen') THEN 1 END) as total_tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id
            GROUP BY g.id_guru, g.nama
            HAVING total_tidak_hadir > 0
            ORDER BY total_tidak_hadir DESC
            LIMIT 5
        `;

        // Get recent notifications/permission requests
        const notificationsQuery = `
            SELECT 
                pi.id_izin as id,
                CONCAT('Permohonan izin dari ', s.nama, ' (', k.nama_kelas, ')') as message,
                pi.tanggal_pengajuan as timestamp,
                pi.status,
                'permission_request' as type
            FROM pengajuan_izin pi
            JOIN siswa_perwakilan s ON pi.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE pi.status = 'pending'
            ORDER BY pi.tanggal_pengajuan DESC
            LIMIT 10
        `;

        const [studentAttendance] = await connection.execute(studentAttendanceQuery);
        const [teacherAttendance] = await connection.execute(teacherAttendanceQuery);
        const [topAbsentStudents] = await connection.execute(topAbsentStudentsQuery);
        const [topAbsentTeachers] = await connection.execute(topAbsentTeachersQuery);
        const [notifications] = await connection.execute(notificationsQuery);

        const analyticsData = {
            studentAttendance: studentAttendance || [],
            teacherAttendance: teacherAttendance || [],
            topAbsentStudents: topAbsentStudents || [],
            topAbsentTeachers: topAbsentTeachers || [],
            notifications: notifications || []
        };

        console.log(`✅ Analytics data retrieved successfully`);
        res.json(analyticsData);
    } catch (error) {
        console.error('❌ Error getting analytics data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get live teacher attendance
app.get('/api/admin/live-teacher-attendance', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Getting live teacher attendance...');

        const query = `
            SELECT 
                g.id_guru as id,
                g.nama,
                g.nip,
                m.nama_mapel,
                k.nama_kelas,
                j.jam_mulai,
                j.jam_selesai,
                COALESCE(ag.status, 'Belum Absen') as status,
                DATE_FORMAT(ag.waktu_catat, '%H:%i:%s') as waktu_absen,
                ag.keterangan
            FROM jadwal j
            JOIN guru g ON j.guru_id = g.id_guru
            JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND DATE(ag.tanggal) = CURDATE()
            WHERE j.hari = CASE WEEKDAY(CURDATE())
                WHEN 0 THEN 'Senin'
                WHEN 1 THEN 'Selasa'
                WHEN 2 THEN 'Rabu'
                WHEN 3 THEN 'Kamis'
                WHEN 4 THEN 'Jumat'
                WHEN 5 THEN 'Sabtu'
                ELSE 'Minggu'
            END
            ORDER BY k.nama_kelas, j.jam_mulai, g.nama
        `;
        
        const [rows] = await connection.execute(query);
        console.log(`✅ Live teacher attendance retrieved: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting live teacher attendance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get live student attendance
app.get('/api/admin/live-student-attendance', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Getting live student attendance...');

        const query = `
            SELECT 
                s.id_siswa as id,
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(a.status, 'Belum Absen') as status,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen,
                a.keterangan
            FROM siswa_perwakilan s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND DATE(a.waktu_absen) = CURDATE()
            ORDER BY k.nama_kelas, s.nama
        `;
        
        const [rows] = await connection.execute(query);
        console.log(`✅ Live student attendance retrieved: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting live student attendance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get teacher attendance report
app.get('/api/admin/teacher-attendance-report', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        console.log('📊 Getting teacher attendance report:', { startDate, endDate, kelas_id });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                DATE_FORMAT(ag.tanggal, '%Y-%m-%d') as tanggal,
                k.nama_kelas,
                g.nama as nama_guru,
                g.nip as nip_guru,
                m.nama_mapel,
                CASE 
                    WHEN ag.jam_ke IS NOT NULL THEN CONCAT('Jam ke-', ag.jam_ke)
                    ELSE CONCAT(j.jam_mulai, ' - ', j.jam_selesai)
                END as jam_hadir,
                j.jam_mulai,
                j.jam_selesai,
                COALESCE(ag.status, 'Tidak Ada Data') as status,
                COALESCE(ag.keterangan, '-') as keterangan,
                j.jam_ke
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            JOIN guru g ON j.guru_id = g.id_guru
            JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND ag.tanggal BETWEEN ? AND ?
            WHERE j.status = 'aktif'
        `;
        
        const params = [startDate, endDate];
        
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        
        query += ' ORDER BY ag.tanggal DESC, k.nama_kelas, j.jam_ke';
        
        const [rows] = await connection.execute(query, params);
        console.log(`✅ Teacher attendance report retrieved: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting teacher attendance report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download teacher attendance report as Excel
app.get('/api/admin/download-teacher-attendance', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        console.log('📊 Downloading teacher attendance report:', { startDate, endDate, kelas_id });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                COALESCE(DATE_FORMAT(ag.tanggal, '%d/%m/%Y'), DATE_FORMAT(CURDATE(), '%d/%m/%Y')) as tanggal,
                k.nama_kelas,
                g.nama as nama_guru,
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
                COALESCE(ag.keterangan, '-') as keterangan
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            JOIN guru g ON j.guru_id = g.id_guru
            JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND ag.tanggal BETWEEN ? AND ?
            WHERE j.status = 'aktif'
        `;
        
        const params = [startDate, endDate];
        
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        
        query += ' ORDER BY ag.tanggal DESC, k.nama_kelas, j.jam_ke';
        
        const [rows] = await connection.execute(query, params);

        // Enhanced CSV format with UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal,Kelas,Guru,NIP,Mata Pelajaran,Jam Hadir,Jam Mulai,Jam Selesai,Jadwal,Status,Keterangan\n';
        
        rows.forEach(row => {
            csvContent += `"${row.tanggal}","${row.nama_kelas}","${row.nama_guru}","${row.nip_guru || ''}","${row.nama_mapel}","${row.jam_hadir || ''}","${row.jam_mulai}","${row.jam_selesai}","${row.jadwal}","${row.status}","${row.keterangan || ''}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="laporan-kehadiran-guru-${startDate}-${endDate}.csv"`);
        res.send(csvContent);
        
        console.log(`✅ Teacher attendance report downloaded successfully: ${rows.length} records`);
    } catch (error) {
        console.error('❌ Error downloading teacher attendance report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get student attendance report
app.get('/api/admin/student-attendance-report', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        console.log('📊 Getting student attendance report:', { startDate, endDate, kelas_id });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                DATE_FORMAT(a.waktu_absen, '%Y-%m-%d') as tanggal,
                k.nama_kelas,
                s.nama as nama_siswa,
                s.nis as nis_siswa,
                'Absensi Harian' as nama_mapel,
                'Siswa Perwakilan' as nama_guru,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen,
                '07:00' as jam_mulai,
                '17:00' as jam_selesai,
                COALESCE(a.status, 'Tidak Hadir') as status,
                COALESCE(a.keterangan, '-') as keterangan,
                NULL as jam_ke
            FROM absensi_siswa a
            JOIN siswa_perwakilan s ON a.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE DATE(a.waktu_absen) BETWEEN ? AND ?
        `;
        
        const params = [startDate, endDate];
        
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        
        query += ' ORDER BY a.waktu_absen DESC, k.nama_kelas, s.nama';
        
        const [rows] = await connection.execute(query, params);
        console.log(`✅ Student attendance report retrieved: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting student attendance report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download student attendance report as CSV
app.get('/api/admin/download-student-attendance', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        console.log('📊 Downloading student attendance report:', { startDate, endDate, kelas_id });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                DATE_FORMAT(a.waktu_absen, '%d/%m/%Y') as tanggal,
                k.nama_kelas,
                s.nama as nama_siswa,
                s.nis as nis_siswa,
                'Absensi Harian' as nama_mapel,
                'Siswa Perwakilan' as nama_guru,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen,
                '07:00' as jam_mulai,
                '17:00' as jam_selesai,
                '07:00 - 17:00' as jadwal,
                COALESCE(a.status, 'Tidak Hadir') as status,
                COALESCE(a.keterangan, '-') as keterangan
            FROM absensi_siswa a
            JOIN siswa_perwakilan s ON a.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE DATE(a.waktu_absen) BETWEEN ? AND ?
        `;
        
        const params = [startDate, endDate];
        
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        
        query += ' ORDER BY a.waktu_absen DESC, k.nama_kelas, s.nama';
        
        const [rows] = await connection.execute(query, params);

        // Enhanced CSV format with UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal,Kelas,Nama Siswa,NIS,Mata Pelajaran,Guru,Waktu Absen,Jam Mulai,Jam Selesai,Jadwal,Status,Keterangan\n';
        
        rows.forEach(row => {
            csvContent += `"${row.tanggal}","${row.nama_kelas}","${row.nama_siswa}","${row.nis_siswa || ''}","${row.nama_mapel || ''}","${row.nama_guru || ''}","${row.waktu_absen || ''}","${row.jam_mulai || ''}","${row.jam_selesai || ''}","${row.jadwal || ''}","${row.status}","${row.keterangan || ''}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="laporan-kehadiran-siswa-${startDate}-${endDate}.csv"`);
        res.send(csvContent);
        
        console.log(`✅ Student attendance report downloaded successfully: ${rows.length} records`);
    } catch (error) {
        console.error('❌ Error downloading student attendance report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===================== NEW: SUMMARY REPORTS (ADMIN) =====================
// Student attendance summary (H/I/S/A/D + percentage) grouped by student
app.get('/api/admin/student-attendance-summary', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                s.id_siswa as siswa_id,
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(a.id), 0) AS total,
                CASE 
                    WHEN COUNT(a.id) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2)
                END AS presentase
            FROM siswa_perwakilan s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND DATE(a.waktu_absen) BETWEEN ? AND ?
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE s.status = 'aktif'
        `;
        const params = [startDate, endDate];
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';

        const [rows] = await connection.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting student attendance summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download student attendance summary as styled Excel
app.get('/api/admin/download-student-attendance-excel', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(a.id), 0) AS total,
                CASE 
                    WHEN COUNT(a.id) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2)
                END AS presentase
            FROM siswa_perwakilan s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND DATE(a.waktu_absen) BETWEEN ? AND ?
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE s.status = 'aktif'
        `;
        const params = [startDate, endDate];
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';

        const [rows] = await connection.execute(query, params);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Kehadiran Siswa');

        sheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Nama', key: 'nama', width: 28 },
            { header: 'NIS', key: 'nis', width: 14 },
            { header: 'Kelas', key: 'kelas', width: 14 },
            { header: 'H', key: 'H', width: 6 },
            { header: 'I', key: 'I', width: 6 },
            { header: 'S', key: 'S', width: 6 },
            { header: 'A', key: 'A', width: 6 },
            { header: 'D', key: 'D', width: 6 },
            { header: 'Presentase', key: 'presentase', width: 14 }
        ];

        // Header styling
        sheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { top: {style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        });

        rows.forEach((r, idx) => {
            sheet.addRow({
                no: idx + 1,
                nama: r.nama,
                nis: r.nis || '',
                kelas: r.nama_kelas,
                H: r.H || 0,
                I: r.I || 0,
                S: r.S || 0,
                A: r.A || 0,
                D: r.D || 0,
                presentase: r.presentase || 0
            });
        });

        // Color columns H I S A D
        const colorMap = { H: 'FF10B981', I: 'FF3B82F6', S: 'FFEF4444', A: 'FFF59E0B', D: 'FF8B5CF6' };
        ['H','I','S','A','D'].forEach((key, i) => {
            const col = sheet.getColumn(5 + i);
            col.eachCell((cell, rowNumber) => {
                if (rowNumber === 1) return; // skip header
                cell.alignment = { horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorMap[key] } };
                cell.font = { bold: true, color: { argb: 'FF000000' } };
            });
        });
        sheet.getColumn('presentase').numFmt = '0.00%';
        // But we wrote as 0-100, convert: set percentage by dividing by 100 using formula
        for (let r = 2; r <= sheet.rowCount; r++) {
            const cell = sheet.getCell(`J${r}`);
            const val = Number(cell.value || 0);
            cell.value = { formula: `${val}/100` };
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-ringkas-kehadiran-siswa-${startDate}-${endDate}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('❌ Error downloading student attendance summary excel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Teacher attendance summary grouped by teacher (H/I/S/A)
app.get('/api/admin/teacher-attendance-summary', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }
        let query = `
            SELECT 
                g.id_guru as guru_id,
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN ag.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN ag.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN ag.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN ag.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(COUNT(ag.id_absensi), 0) AS total,
                CASE 
                    WHEN COUNT(ag.id_absensi) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN ag.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(ag.id_absensi)), 2)
                END AS presentase
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal BETWEEN ? AND ?
            WHERE g.status = 'aktif'
        `;
        const params = [startDate, endDate];
        query += ' GROUP BY g.id_guru, g.nama, g.nip ORDER BY g.nama';
        const [rows] = await connection.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting teacher attendance summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/download-teacher-attendance-excel', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }
        let query = `
            SELECT 
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN ag.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN ag.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN ag.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN ag.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(COUNT(ag.id_absensi), 0) AS total,
                CASE 
                    WHEN COUNT(ag.id_absensi) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN ag.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(ag.id_absensi)), 2)
                END AS presentase
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal BETWEEN ? AND ?
            WHERE g.status = 'aktif'
        `;
        const params = [startDate, endDate];
        query += ' GROUP BY g.id_guru, g.nama, g.nip ORDER BY g.nama';
        const [rows] = await connection.execute(query, params);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Kehadiran Guru');
        sheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Nama', key: 'nama', width: 28 },
            { header: 'NIP', key: 'nip', width: 20 },
            { header: 'H', key: 'H', width: 6 },
            { header: 'I', key: 'I', width: 6 },
            { header: 'S', key: 'S', width: 6 },
            { header: 'A', key: 'A', width: 6 },
            { header: 'Presentase', key: 'presentase', width: 14 }
        ];
        sheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { top: {style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        });
        rows.forEach((r, idx) => {
            sheet.addRow({ no: idx + 1, nama: r.nama, nip: r.nip || '', H: r.H||0, I: r.I||0, S: r.S||0, A: r.A||0, presentase: r.presentase||0 });
        });
        const colorMap = { H: 'FF10B981', I: 'FF3B82F6', S: 'FFEF4444', A: 'FFF59E0B' };
        ['H','I','S','A'].forEach((key, i) => {
            const col = sheet.getColumn(4 + i);
            col.eachCell((cell, rowNumber) => {
                if (rowNumber === 1) return;
                cell.alignment = { horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorMap[key] } };
                cell.font = { bold: true, color: { argb: 'FF000000' } };
            });
        });
        sheet.getColumn('presentase').numFmt = '0.00%';
        for (let r = 2; r <= sheet.rowCount; r++) {
            const cell = sheet.getCell(`H${r}`);
            const val = Number(cell.value || 0);
            cell.value = { formula: `${val}/100` };
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-ringkas-kehadiran-guru-${startDate}-${endDate}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('❌ Error downloading teacher attendance summary excel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===================== NEW: SUMMARY REPORTS (GURU) =====================
// Classes taught by the logged-in teacher
app.get('/api/guru/classes', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const guruId = req.user.guru_id;
        const [rows] = await connection.execute(
            `SELECT DISTINCT k.id_kelas as id, k.nama_kelas 
             FROM jadwal j JOIN kelas k ON j.kelas_id = k.id_kelas 
             WHERE j.guru_id = ? AND j.status = 'aktif' ORDER BY k.nama_kelas`,
            [guruId]
        );
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting teacher classes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/guru/attendance-summary', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }
        let query = `
            SELECT 
                s.id_siswa as siswa_id,
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(a.id), 0) AS total,
                CASE 
                    WHEN COUNT(a.id) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2)
                END AS presentase
            FROM siswa_perwakilan s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND DATE(a.waktu_absen) BETWEEN ? AND ?
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON a.jadwal_id = j.id_jadwal
            WHERE s.status = 'aktif' AND (j.guru_id = ? OR j.guru_id IS NULL)
        `;
        const params = [startDate, endDate, guruId];
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';
        const [rows] = await connection.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting teacher attendance summary (guru):', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/guru/download-attendance-excel', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }
        let query = `
            SELECT 
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(a.id), 0) AS total,
                CASE 
                    WHEN COUNT(a.id) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2)
                END AS presentase
            FROM siswa_perwakilan s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND DATE(a.waktu_absen) BETWEEN ? AND ?
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON a.jadwal_id = j.id_jadwal
            WHERE s.status = 'aktif' AND (j.guru_id = ? OR j.guru_id IS NULL)
        `;
        const params = [startDate, endDate, guruId];
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';
        const [rows] = await connection.execute(query, params);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Kehadiran Siswa (Guru)');
        sheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Nama', key: 'nama', width: 28 },
            { header: 'NIS', key: 'nis', width: 14 },
            { header: 'Kelas', key: 'kelas', width: 14 },
            { header: 'H', key: 'H', width: 6 },
            { header: 'I', key: 'I', width: 6 },
            { header: 'S', key: 'S', width: 6 },
            { header: 'A', key: 'A', width: 6 },
            { header: 'D', key: 'D', width: 6 },
            { header: 'Presentase', key: 'presentase', width: 14 }
        ];
        sheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { top: {style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        });
        rows.forEach((r, idx) => {
            sheet.addRow({ no: idx + 1, nama: r.nama, nis: r.nis || '', kelas: r.nama_kelas, H: r.H||0, I: r.I||0, S: r.S||0, A: r.A||0, D: r.D||0, presentase: r.presentase||0 });
        });
        const colorMap = { H: 'FF10B981', I: 'FF3B82F6', S: 'FFEF4444', A: 'FFF59E0B', D: 'FF8B5CF6' };
        ['H','I','S','A','D'].forEach((key, i) => {
            const col = sheet.getColumn(5 + i);
            col.eachCell((cell, rowNumber) => {
                if (rowNumber === 1) return;
                cell.alignment = { horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorMap[key] } };
                cell.font = { bold: true, color: { argb: 'FF000000' } };
            });
        });
        sheet.getColumn('presentase').numFmt = '0.00%';
        for (let r = 2; r <= sheet.rowCount; r++) {
            const cell = sheet.getCell(`J${r}`);
            const val = Number(cell.value || 0);
            cell.value = { formula: `${val}/100` };
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-guru-ringkas-${startDate}-${endDate}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('❌ Error downloading guru attendance excel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ================================================
// BANDING ABSEN ENDPOINTS  
// ================================================

// Get banding absen history report
app.get('/api/admin/banding-absen-report', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;
        console.log('📊 Getting banding absen report:', { startDate, endDate, kelas_id, status });

        let query = `
            SELECT 
                pba.id_banding,
                DATE_FORMAT(pba.tanggal_pengajuan, '%Y-%m-%d') as tanggal_pengajuan,
                DATE_FORMAT(pba.tanggal_absen, '%Y-%m-%d') as tanggal_absen,
                sp.nama as nama_pengaju,
                k.nama_kelas,
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
                pba.jenis_banding,
                COALESCE(COUNT(bad.id_detail), 0) as jumlah_siswa_banding
            FROM pengajuan_banding_absen pba
            JOIN siswa_perwakilan sp ON pba.siswa_id = sp.id_siswa
            LEFT JOIN kelas k ON sp.kelas_id = k.id_kelas OR pba.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON pba.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru guru_proses ON pba.diproses_oleh = guru_proses.id_guru
            LEFT JOIN banding_absen_detail bad ON pba.id_banding = bad.banding_id
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
        
        query += ' GROUP BY pba.id_banding ORDER BY pba.tanggal_pengajuan DESC';
        
        const [rows] = await connection.execute(query, params);
        console.log(`✅ Banding absen report retrieved: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting banding absen report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download banding absen report as CSV
app.get('/api/admin/download-banding-absen', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;
        console.log('📊 Downloading banding absen report:', { startDate, endDate, kelas_id, status });

        let query = `
            SELECT 
                DATE_FORMAT(pba.tanggal_pengajuan, '%d/%m/%Y') as tanggal_pengajuan,
                DATE_FORMAT(pba.tanggal_absen, '%d/%m/%Y') as tanggal_absen,
                sp.nama as nama_pengaju,
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
                pba.jenis_banding,
                COALESCE(COUNT(bad.id_detail), 0) as jumlah_siswa_banding
            FROM pengajuan_banding_absen pba
            JOIN siswa_perwakilan sp ON pba.siswa_id = sp.id_siswa
            LEFT JOIN kelas k ON sp.kelas_id = k.id_kelas OR pba.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON pba.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru guru_proses ON pba.diproses_oleh = guru_proses.id_guru
            LEFT JOIN banding_absen_detail bad ON pba.id_banding = bad.banding_id
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
        
        query += ' GROUP BY pba.id_banding ORDER BY pba.tanggal_pengajuan DESC';
        
        const [rows] = await connection.execute(query, params);

        // Enhanced CSV format with UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal Pengajuan,Tanggal Absen,Pengaju,Kelas,Mata Pelajaran,Guru,Jadwal,Status Asli,Status Diajukan,Alasan Banding,Status Banding,Catatan Guru,Tanggal Keputusan,Diproses Oleh,Jenis Banding,Jumlah Siswa\n';
        
        rows.forEach(row => {
            csvContent += `"${row.tanggal_pengajuan}","${row.tanggal_absen}","${row.nama_pengaju}","${row.nama_kelas}","${row.nama_mapel}","${row.nama_guru}","${row.jadwal}","${row.status_asli}","${row.status_diajukan}","${row.alasan_banding}","${row.status_banding}","${row.catatan_guru}","${row.tanggal_keputusan}","${row.diproses_oleh}","${row.jenis_banding}","${row.jumlah_siswa_banding}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="riwayat-banding-absen-${startDate || 'all'}-${endDate || 'all'}.csv"`);
        res.send(csvContent);
        
        console.log(`✅ Banding absen report downloaded successfully: ${rows.length} records`);
    } catch (error) {
        console.error('❌ Error downloading banding absen report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// PENGAJUAN IZIN SISWA ENDPOINTS
// ================================================

// Get pengajuan izin by siswa ID (updated for class data)
app.get('/api/siswa/:siswaId/pengajuan-izin', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswaId } = req.params;
        console.log('📋 Getting pengajuan izin kelas for siswa:', siswaId);

        const query = `
            SELECT 
                pi.id_pengajuan,
                pi.jadwal_id,
                pi.tanggal_izin,
                pi.jenis_izin,
                pi.alasan,
                pi.bukti_pendukung,
                pi.status,
                pi.keterangan_guru,
                pi.tanggal_pengajuan,
                pi.tanggal_respon,
                COALESCE(j.jam_mulai, 'Izin Harian') as jam_mulai,
                COALESCE(j.jam_selesai, 'Izin Harian') as jam_selesai,
                COALESCE(m.nama_mapel, 'Izin Umum') as nama_mapel,
                COALESCE(g.nama, 'Menunggu Persetujuan') as nama_guru
            FROM pengajuan_izin_siswa pi
            LEFT JOIN jadwal j ON pi.jadwal_id = j.id_jadwal
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            WHERE pi.siswa_id = ?
            ORDER BY pi.tanggal_pengajuan DESC
        `;

        const [pengajuanRows] = await connection.execute(query, [siswaId]);

        // Get detail for each pengajuan (for class-based submissions)
        const pengajuanWithDetails = await Promise.all(
            pengajuanRows.map(async (pengajuan) => {
                if (pengajuan.jenis_izin === 'kelas') {
                    // Get detailed siswa data for this pengajuan
                    const [detailRows] = await connection.execute(
                        `SELECT nama_siswa as nama, jenis_izin, alasan, bukti_pendukung 
                         FROM pengajuan_izin_detail 
                         WHERE pengajuan_id = ?`,
                        [pengajuan.id_pengajuan]
                    );

                    return {
                        ...pengajuan,
                        siswa_izin: detailRows,
                        total_siswa_izin: detailRows.length
                    };
                } else {
                    // Individual pengajuan (legacy support)
                    return pengajuan;
                }
            })
        );

        console.log(`✅ Pengajuan izin kelas retrieved: ${pengajuanWithDetails.length} items`);
        res.json(pengajuanWithDetails);
    } catch (error) {
        console.error('❌ Error getting pengajuan izin kelas:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit new pengajuan izin
app.post('/api/siswa/:siswaId/pengajuan-izin', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswaId } = req.params;
        const { jadwal_id, tanggal_mulai, tanggal_selesai, jenis_izin, alasan } = req.body;
        console.log('📝 Submitting pengajuan izin:', { siswaId, jadwal_id, tanggal_mulai, tanggal_selesai, jenis_izin });

        // Validation
        if (!tanggal_mulai || !tanggal_selesai || !jenis_izin || !alasan) {
            return res.status(400).json({ error: 'Semua field wajib diisi' });
        }

        // Validate jenis izin
        const validJenisIzin = ['sakit', 'izin', 'urusan_keluarga', 'keperluan_pribadi', 'lainnya', 'kelas', 'dispen'];
        if (!validJenisIzin.includes(jenis_izin)) {
            return res.status(400).json({ 
                error: `Jenis izin tidak valid: ${jenis_izin}. Jenis yang diperbolehkan: ${validJenisIzin.join(', ')}` 
            });
        }

        // Validate date range
        if (new Date(tanggal_mulai) > new Date(tanggal_selesai)) {
            return res.status(400).json({ error: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai' });
        }

        // Check if pengajuan already exists for overlapping dates
        const [existing] = await connection.execute(
            `SELECT id_pengajuan FROM pengajuan_izin_siswa 
             WHERE siswa_id = ? AND (
                 (tanggal_mulai <= ? AND tanggal_selesai >= ?) OR
                 (tanggal_mulai <= ? AND tanggal_selesai >= ?) OR
                 (tanggal_mulai >= ? AND tanggal_selesai <= ?)
             )`,
            [siswaId, tanggal_mulai, tanggal_mulai, tanggal_selesai, tanggal_selesai, tanggal_mulai, tanggal_selesai]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Pengajuan izin untuk periode ini sudah ada atau bertumpang tindih' });
        }

        // Insert pengajuan izin
        const [result] = await connection.execute(
            `INSERT INTO pengajuan_izin_siswa (siswa_id, jadwal_id, tanggal_mulai, tanggal_selesai, jenis_izin, alasan)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [siswaId, jadwal_id || null, tanggal_mulai, tanggal_selesai, jenis_izin, alasan]
        );

        console.log('✅ Pengajuan izin submitted successfully');
        res.json({ 
            message: 'Pengajuan izin berhasil dikirim',
            id: result.insertId 
        });
    } catch (error) {
        console.error('❌ Error submitting pengajuan izin:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get pengajuan izin for guru to approve/reject
app.get('/api/guru/:guruId/pengajuan-izin', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { guruId } = req.params;
        console.log('📋 Getting pengajuan izin for guru:', guruId);

        const query = `
            SELECT 
                pi.id_pengajuan as id,
                pi.siswa_id,
                pi.jadwal_id,
                pi.tanggal_mulai,
                pi.tanggal_selesai,
                pi.jenis_izin,
                pi.alasan,
                pi.bukti_pendukung,
                pi.status as status_persetujuan,
                pi.keterangan_guru as catatan_guru,
                pi.tanggal_pengajuan,
                pi.tanggal_respon,
                sp.nama as nama_siswa,
                sp.nis,
                k.nama_kelas
            FROM pengajuan_izin_siswa pi
            JOIN siswa_perwakilan sp ON pi.siswa_id = sp.id_siswa
            LEFT JOIN kelas k ON sp.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON pi.jadwal_id = j.id_jadwal
            WHERE (j.guru_id = ? OR ? IN (
                SELECT DISTINCT j2.guru_id 
                FROM jadwal j2 
                JOIN kelas k2 ON j2.kelas_id = k2.id_kelas
                WHERE k2.id_kelas = sp.kelas_id
            ))
            ORDER BY pi.tanggal_pengajuan DESC, pi.status ASC
        `;

        const [rows] = await connection.execute(query, [guruId, guruId]);
        console.log(`✅ Pengajuan izin for guru retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting pengajuan izin for guru:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Approve or reject pengajuan izin by guru
app.put('/api/guru/pengajuan-izin/:pengajuanId', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { pengajuanId } = req.params;
        const { status, keterangan_guru } = req.body;
        const guruId = req.user.guru_id;
        
        console.log('📝 Guru responding to pengajuan izin:', { pengajuanId, status, guruId });

        // Validation
        if (!status || !['disetujui', 'ditolak'].includes(status)) {
            return res.status(400).json({ error: 'Status harus disetujui atau ditolak' });
        }

        // Update pengajuan izin
        const [result] = await connection.execute(
            `UPDATE pengajuan_izin_siswa 
             SET status = ?, keterangan_guru = ?, tanggal_respon = NOW(), guru_id = ?
             WHERE id_pengajuan = ?`,
            [status, keterangan_guru || '', guruId, pengajuanId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pengajuan izin tidak ditemukan' });
        }

        console.log('✅ Pengajuan izin response submitted successfully');
        res.json({ 
            message: `Pengajuan izin berhasil ${status === 'disetujui' ? 'disetujui' : 'ditolak'}`
        });
    } catch (error) {
        console.error('❌ Error responding to pengajuan izin:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Approve or reject pengajuan izin by ID (alternative endpoint for frontend compatibility)
app.put('/api/pengajuan-izin/:pengajuanId/approve', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { pengajuanId } = req.params;
        const { status_persetujuan, catatan_guru, disetujui_oleh } = req.body;
        const guruId = disetujui_oleh || req.user.guru_id || req.user.id;
        
        console.log('📝 Guru approving pengajuan izin:', { pengajuanId, status_persetujuan, guruId });

        // Validation
        if (!status_persetujuan || !['disetujui', 'ditolak'].includes(status_persetujuan)) {
            return res.status(400).json({ error: 'Status harus disetujui atau ditolak' });
        }

        // Update pengajuan izin
        const [result] = await connection.execute(
            `UPDATE pengajuan_izin_siswa 
             SET status = ?, keterangan_guru = ?, tanggal_respon = NOW(), guru_id = ?
             WHERE id_pengajuan = ?`,
            [status_persetujuan, catatan_guru || '', guruId, pengajuanId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pengajuan izin tidak ditemukan' });
        }

        console.log('✅ Pengajuan izin approval response submitted successfully');
        res.json({ 
            message: `Pengajuan izin berhasil ${status_persetujuan === 'disetujui' ? 'disetujui' : 'ditolak'}`,
            id: pengajuanId
        });
    } catch (error) {
        console.error('❌ Error responding to pengajuan izin approval:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// COMPATIBILITY ENDPOINTS FOR SCHEDULE MANAGEMENT
// ================================================

// Get subjects (alias for /api/admin/mapel)
app.get('/api/admin/subjects', authenticateToken, requireRole(['admin']), async (req, res) => {
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
        
        const [rows] = await connection.execute(query);
        console.log(`✅ Subjects retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting subjects:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get classes (alias for /api/admin/kelas)
app.get('/api/admin/classes', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('🏫 Getting classes for schedule management');
        
        const query = `
            SELECT id_kelas as id, nama_kelas, tingkat, status
            FROM kelas 
            ORDER BY tingkat, nama_kelas
        `;
        
        const [rows] = await connection.execute(query);
        console.log(`✅ Classes retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting classes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// ABSENSI ENDPOINTS - Real Time Data
// ================================================

// Get today's schedule for guru or siswa
app.get('/api/jadwal/today', authenticateToken, async (req, res) => {
    try {
        let query = '';
        let params = [];

        if (req.user.role === 'guru') {
            query = `
                SELECT j.*, k.nama_kelas, m.nama_mapel
                FROM jadwal j
                JOIN kelas k ON j.kelas_id = k.id_kelas
                JOIN mapel m ON j.mapel_id = m.id_mapel
                WHERE j.guru_id = ? AND j.hari = DAYNAME(CURDATE()) AND j.status = 'aktif'
                ORDER BY j.jam_ke
            `;
            params = [req.user.guru_id];
        } else if (req.user.role === 'siswa') {
            query = `
                SELECT j.*, g.nama as nama_guru, m.nama_mapel
                FROM jadwal j
                JOIN guru g ON j.guru_id = g.id_guru
                JOIN mapel m ON j.mapel_id = m.id_mapel
                WHERE j.kelas_id = ? AND j.hari = DAYNAME(CURDATE()) AND j.status = 'aktif'
                ORDER BY j.jam_ke
            `;
            params = [req.user.kelas_id];
        }

        const [rows] = await connection.execute(query, params);
        
        console.log(`📅 Today's schedule retrieved for ${req.user.role}: ${req.user.username}`);
        res.json({ success: true, data: rows });

    } catch (error) {
        console.error('❌ Get today schedule error:', error);
        res.status(500).json({ error: 'Failed to retrieve today schedule' });
    }
});

// Record attendance (siswa marking guru attendance)
app.post('/api/absensi', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { jadwal_id, guru_id, status, keterangan } = req.body;

        // Check if attendance already recorded for today
        const [existing] = await connection.execute(
            `SELECT * FROM absensi_guru 
             WHERE jadwal_id = ? AND tanggal = CURDATE()`,
            [jadwal_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Absensi untuk jadwal ini sudah dicatat hari ini' });
        }

        // Get jadwal details
        const [jadwalData] = await connection.execute(
            'SELECT * FROM jadwal WHERE id_jadwal = ?',
            [jadwal_id]
        );

        if (jadwalData.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        // Record attendance
        await connection.execute(
            `INSERT INTO absensi_guru (jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, jam_ke, status, keterangan)
             VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)`,
            [jadwal_id, guru_id, req.user.kelas_id, req.user.siswa_id, jadwalData[0].jam_ke, status, keterangan]
        );

        console.log(`✅ Attendance recorded by ${req.user.nama} for guru_id: ${guru_id}, status: ${status}`);
        res.json({ success: true, message: 'Absensi berhasil dicatat' });

    } catch (error) {
        console.error('❌ Record attendance error:', error);
        res.status(500).json({ error: 'Failed to record attendance' });
    }
});

// Get attendance history
app.get('/api/absensi/history', authenticateToken, async (req, res) => {
    try {
        const { date_start, date_end, limit = 50 } = req.query;
        
        let query = `
            SELECT ag.*, j.jam_ke, j.jam_mulai, j.jam_selesai, j.hari,
                   g.nama as nama_guru, k.nama_kelas, m.nama_mapel,
                   sp.nama as nama_pencatat
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            JOIN guru g ON ag.guru_id = g.id_guru
            JOIN kelas k ON ag.kelas_id = k.id_kelas
            JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN siswa_perwakilan sp ON ag.siswa_pencatat_id = sp.id_siswa
        `;
        
        let params = [];
        let whereConditions = [];

        // Filter by user role
        if (req.user.role === 'guru') {
            whereConditions.push('ag.guru_id = ?');
            params.push(req.user.guru_id);
        } else if (req.user.role === 'siswa') {
            whereConditions.push('ag.kelas_id = ?');
            params.push(req.user.kelas_id);
        }

        // Date filters
        if (date_start) {
            whereConditions.push('ag.tanggal >= ?');
            params.push(date_start);
        }
        if (date_end) {
            whereConditions.push('ag.tanggal <= ?');
            params.push(date_end);
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY ag.tanggal DESC, j.jam_ke ASC LIMIT ?';
        params.push(parseInt(limit));

        const [rows] = await connection.execute(query, params);
        
        console.log(`📊 Attendance history retrieved for ${req.user.role}: ${req.user.username}`);
        res.json({ success: true, data: rows });

    } catch (error) {
        console.error('❌ Get attendance history error:', error);
        res.status(500).json({ error: 'Failed to retrieve attendance history' });
    }
});

// ================================================
// EXPORT EXCEL ENDPOINTS
// ================================================

// Export attendance to Excel
app.get('/api/export/absensi', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { date_start, date_end } = req.query;
        
        let query = `
            SELECT ag.tanggal, ag.status, ag.keterangan, ag.waktu_catat,
                   j.jam_ke, j.jam_mulai, j.jam_selesai, j.hari,
                   g.nama as nama_guru, g.nip,
                   k.nama_kelas, m.nama_mapel,
                   sp.nama as nama_pencatat, sp.nis
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            JOIN guru g ON ag.guru_id = g.id_guru
            JOIN kelas k ON ag.kelas_id = k.id_kelas
            JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN siswa_perwakilan sp ON ag.siswa_pencatat_id = sp.id_siswa
        `;
        
        let params = [];
        let whereConditions = [];

        if (date_start) {
            whereConditions.push('ag.tanggal >= ?');
            params.push(date_start);
        }
        if (date_end) {
            whereConditions.push('ag.tanggal <= ?');
            params.push(date_end);
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY ag.tanggal DESC, k.nama_kelas, j.jam_ke';

        const [rows] = await connection.execute(query, params);

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data Absensi');

        // Add headers
        worksheet.columns = [
            { header: 'Tanggal', key: 'tanggal', width: 12 },
            { header: 'Hari', key: 'hari', width: 10 },
            { header: 'Jam Ke', key: 'jam_ke', width: 8 },
            { header: 'Waktu', key: 'waktu', width: 15 },
            { header: 'Kelas', key: 'nama_kelas', width: 15 },
            { header: 'Mata Pelajaran', key: 'nama_mapel', width: 20 },
            { header: 'Nama Guru', key: 'nama_guru', width: 25 },
            { header: 'NIP', key: 'nip', width: 20 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Keterangan', key: 'keterangan', width: 30 },
            { header: 'Pencatat', key: 'nama_pencatat', width: 20 }
        ];

        // Add data
        rows.forEach(row => {
            worksheet.addRow({
                tanggal: row.tanggal,
                hari: row.hari,
                jam_ke: row.jam_ke,
                waktu: `${row.jam_mulai} - ${row.jam_selesai}`,
                nama_kelas: row.nama_kelas,
                nama_mapel: row.nama_mapel,
                nama_guru: row.nama_guru,
                nip: row.nip,
                status: row.status,
                keterangan: row.keterangan || '-',
                nama_pencatat: row.nama_pencatat
            });
        });

        // Style headers
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '2563eb' }
        };

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=absensi-guru-${new Date().toISOString().split('T')[0]}.xlsx`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

        console.log('✅ Excel export completed');

    } catch (error) {
        console.error('❌ Excel export error:', error);
        res.status(500).json({ error: 'Failed to export data to Excel' });
    }
});

// ================================================
// GURU ENDPOINTS
// ================================================

// Get teacher schedule (uses modern schema: jadwal/mapel/kelas) & guru_id from token
app.get('/api/guru/jadwal', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    const guruId = req.user.guru_id; // correct mapping to guru.id_guru
    console.log(`📅 Getting schedule for authenticated guru_id: ${guruId} (user_id: ${req.user.id})`);

    if (!guruId) {
        return res.status(400).json({ error: 'guru_id tidak ditemukan pada token pengguna' });
    }

    try {
        const [jadwal] = await connection.execute(`
            SELECT 
                j.id_jadwal AS id,
                j.hari,
                j.jam_mulai,
                j.jam_selesai,
                j.jam_ke,
                j.status,
                mp.nama_mapel,
                mp.kode_mapel,
                k.nama_kelas
            FROM jadwal j
            JOIN mapel mp ON j.mapel_id = mp.id_mapel
            JOIN kelas k ON j.kelas_id = k.id_kelas
            WHERE j.guru_id = ? AND j.status = 'aktif'
            ORDER BY CASE j.hari 
                WHEN 'Senin' THEN 1
                WHEN 'Selasa' THEN 2
                WHEN 'Rabu' THEN 3
                WHEN 'Kamis' THEN 4
                WHEN 'Jumat' THEN 5
                WHEN 'Sabtu' THEN 6
                WHEN 'Minggu' THEN 7
            END, j.jam_mulai
        `, [guruId]);

        console.log(`✅ Found ${jadwal.length} schedule entries for guru_id: ${guruId}`);
        res.json({ success: true, data: jadwal });
    } catch (error) {
        console.error('❌ Error fetching teacher schedule:', error);
        res.status(500).json({ error: 'Gagal memuat jadwal guru.' });
    }
});

// Get teacher attendance history
app.get('/api/guru/history', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    const guruId = req.user.guru_id;
    console.log(`📊 Fetching teacher attendance history for guru_id: ${guruId} (user_id: ${req.user.id})`);

    if (!guruId) {
        return res.status(400).json({ error: 'guru_id tidak ditemukan pada token pengguna' });
    }

    try {
        const [history] = await connection.execute(`
            SELECT 
                ag.tanggal, 
                ag.status, 
                ag.keterangan, 
                k.nama_kelas, 
                mp.nama_mapel
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            JOIN kelas k ON j.kelas_id = k.id_kelas
            JOIN mapel mp ON j.mapel_id = mp.id_mapel
            WHERE j.guru_id = ?
            ORDER BY ag.tanggal DESC, j.jam_mulai ASC
            LIMIT 50
        `, [guruId]);

        console.log(`✅ Found ${history.length} attendance history records for guru_id ${guruId}`);
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('❌ Error fetching teacher attendance history:', error);
        res.status(500).json({ error: 'Gagal memuat riwayat absensi.' });
    }
});

// Get student attendance history for teacher (FIXED ENDPOINT)
app.get('/api/guru/student-attendance-history', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const guruId = req.user.guru_id;
        console.log(`📊 Fetching student attendance history for guru_id: ${guruId}`);

        if (!guruId) {
            return res.status(400).json({ error: 'guru_id tidak ditemukan pada token pengguna' });
        }

        // Fixed query - using table aliases properly
        const query = `
            SELECT 
                DATE(absensi.waktu_absen) as tanggal,
                jadwal.jam_ke,
                jadwal.jam_mulai,
                jadwal.jam_selesai,
                mapel.nama_mapel,
                kelas.nama_kelas,
                siswa.nama as nama_siswa,
                siswa.nis,
                absensi.status as status_kehadiran,
                absensi.keterangan,
                absensi.waktu_absen,
                guru_absen.status as status_guru,
                guru_absen.keterangan as keterangan_guru
            FROM absensi_siswa absensi
            INNER JOIN jadwal ON absensi.jadwal_id = jadwal.id_jadwal
            INNER JOIN mapel ON jadwal.mapel_id = mapel.id_mapel
            INNER JOIN kelas ON jadwal.kelas_id = kelas.id_kelas
            INNER JOIN siswa_perwakilan siswa ON absensi.siswa_id = siswa.id_siswa
            LEFT JOIN absensi_guru guru_absen ON jadwal.id_jadwal = guru_absen.jadwal_id 
                AND DATE(guru_absen.tanggal) = DATE(absensi.waktu_absen)
            WHERE jadwal.guru_id = ? 
                AND absensi.waktu_absen >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ORDER BY absensi.waktu_absen DESC, jadwal.jam_ke ASC
            LIMIT 1000`;

        const [history] = await connection.execute(query, [guruId]);

        console.log(`✅ Found ${history.length} student attendance records for guru_id ${guruId}`);
        
        // Debug: Log sample data
        if (history.length > 0) {
            console.log('📊 Sample history record:', history[0]);
        }
        
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('❌ Error fetching student attendance history:', error);
        res.status(500).json({ error: 'Gagal memuat riwayat absensi siswa.' });
    }
});

// Test endpoint untuk debugging
app.get('/api/guru/test', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        console.log('🧪 Test endpoint called');
        res.json({ success: true, message: 'Test endpoint working', user: req.user });
    } catch (error) {
        console.error('❌ Test endpoint error:', error);
        res.status(500).json({ error: 'Test endpoint error' });
    }
});

// Simple student attendance history endpoint
app.get('/api/guru/student-attendance-simple', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const guruId = req.user.guru_id;
        console.log(`📊 Simple endpoint called for guru_id: ${guruId}`);

        if (!guruId) {
            return res.status(400).json({ error: 'guru_id tidak ditemukan' });
        }

        // Simple query to test
        const [result] = await connection.execute(`
            SELECT COUNT(*) as total
            FROM jadwal j
            WHERE j.guru_id = ?
        `, [guruId]);

        console.log(`✅ Simple query result:`, result);
        res.json({ success: true, data: result, message: 'Simple endpoint working' });
    } catch (error) {
        console.error('❌ Simple endpoint error:', error);
        res.status(500).json({ error: 'Simple endpoint error' });
    }
});


// ================================================
// SISWA PERWAKILAN ENDPOINTS
// ================================================

// Get siswa perwakilan info
app.get('/api/siswa-perwakilan/info', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        console.log('📋 Getting siswa perwakilan info for user:', req.user.id);

        const [siswaData] = await connection.execute(
            `SELECT sp.id_siswa, sp.nis, sp.nama, sp.kelas_id, k.nama_kelas 
             FROM siswa_perwakilan sp 
             JOIN kelas k ON sp.kelas_id = k.id_kelas 
             WHERE sp.user_id = ?`,
            [req.user.id]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Data siswa perwakilan tidak ditemukan' });
        }

        const info = siswaData[0];
        console.log('✅ Siswa perwakilan info retrieved:', info);

        res.json({
            success: true,
            id_siswa: info.id_siswa,
            nis: info.nis,
            nama: info.nama,
            kelas_id: info.kelas_id,
            nama_kelas: info.nama_kelas
        });

    } catch (error) {
        console.error('❌ Error getting siswa perwakilan info:', error);
        res.status(500).json({ error: 'Gagal memuat informasi siswa perwakilan' });
    }
});

// Get jadwal hari ini untuk siswa
app.get('/api/siswa/:siswa_id/jadwal-hari-ini', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswa_id } = req.params;
        console.log('📅 Getting jadwal hari ini for siswa:', siswa_id);

        // Get current day in Indonesian
        const today = new Date();
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const currentDay = dayNames[today.getDay()];

        console.log('📅 Current day:', currentDay);

        // Get siswa's class
        const [siswaData] = await connection.execute(
            'SELECT kelas_id FROM siswa_perwakilan WHERE id_siswa = ?',
            [siswa_id]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        const kelasId = siswaData[0].kelas_id;

        // Get today's schedule for the class
        const [jadwalData] = await connection.execute(`
            SELECT 
                j.id_jadwal,
                j.jam_ke,
                j.jam_mulai,
                j.jam_selesai,
                mp.nama_mapel,
                mp.kode_mapel,
                g.nama as nama_guru,
                g.nip,
                k.nama_kelas,
                COALESCE(ag.status, 'belum_diambil') as status_kehadiran
            FROM jadwal j
            JOIN mapel mp ON j.mapel_id = mp.id_mapel
            JOIN guru g ON j.guru_id = g.id_guru
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND ag.tanggal = CURDATE()
            WHERE j.kelas_id = ? AND j.hari = ?
            ORDER BY j.jam_ke
        `, [kelasId, currentDay]);

        console.log('✅ Jadwal retrieved:', jadwalData.length, 'items');

        res.json(jadwalData);

    } catch (error) {
        console.error('❌ Error getting jadwal hari ini:', error);
        res.status(500).json({ error: 'Gagal memuat jadwal hari ini' });
    }
});

// Submit kehadiran guru
app.post('/api/siswa/submit-kehadiran-guru', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswa_id, kehadiran_data } = req.body;
        console.log('📝 Submitting kehadiran guru for siswa:', siswa_id);
        console.log('📝 Kehadiran data:', kehadiran_data);

        // Begin transaction
        await connection.execute('START TRANSACTION');

        const today = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toTimeString().split(' ')[0];

        // Insert/update attendance for each jadwal
        for (const [jadwalId, data] of Object.entries(kehadiran_data)) {
            const { status, keterangan } = data;

            // Check if attendance record already exists
            const [existingRecord] = await connection.execute(
                'SELECT id_absensi FROM absensi_guru WHERE jadwal_id = ? AND tanggal = ?',
                [jadwalId, today]
            );

            if (existingRecord.length > 0) {
                // Update existing record
                await connection.execute(`
                    UPDATE absensi_guru 
                    SET status = ?, keterangan = ?, waktu_pencatatan = ?, siswa_pencatat_id = ?
                    WHERE jadwal_id = ? AND tanggal = ?
                `, [status, keterangan || null, currentTime, siswa_id, jadwalId, today]);
            } else {
                // Insert new record
                await connection.execute(`
                    INSERT INTO absensi_guru 
                    (jadwal_id, tanggal, status, keterangan, waktu_pencatatan, siswa_pencatat_id) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [jadwalId, today, status, keterangan || null, currentTime, siswa_id]);
            }
        }

        // Commit transaction
        await connection.execute('COMMIT');

        console.log('✅ Kehadiran guru submitted successfully');

        res.json({
            success: true,
            message: 'Data kehadiran guru berhasil disimpan'
        });

    } catch (error) {
        // Rollback on error
        await connection.execute('ROLLBACK');
        console.error('❌ Error submitting kehadiran guru:', error);
        res.status(500).json({ error: 'Gagal menyimpan data kehadiran guru' });
    }
});

// Get riwayat kehadiran kelas (for siswa perwakilan)
app.get('/api/siswa/:siswa_id/riwayat-kehadiran', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswa_id } = req.params;
        console.log('📊 Getting riwayat kehadiran kelas for siswa:', siswa_id);

        // Get siswa's class
        const [siswaData] = await connection.execute(
            'SELECT kelas_id, nama FROM siswa_perwakilan WHERE id_siswa = ?',
            [siswa_id]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        const kelasId = siswaData[0].kelas_id;

        // Get total students in class
        const [totalSiswaResult] = await connection.execute(
            'SELECT COUNT(*) as total FROM siswa_perwakilan WHERE kelas_id = ?',
            [kelasId]
        );
        const totalSiswa = totalSiswaResult[0].total;

        // Get attendance history for the last 30 days with aggregated data
        const [riwayatData] = await connection.execute(`
            SELECT 
                ag.tanggal,
                j.id_jadwal,
                j.jam_ke,
                j.jam_mulai,
                j.jam_selesai,
                mp.nama_mapel,
                g.nama as nama_guru,
                ag.status as status_kehadiran,
                ag.keterangan,
                sp.nama as nama_pencatat,
                -- Get attendance data for this schedule
                (SELECT GROUP_CONCAT(
                    CONCAT(sp2.nama, ':', sp2.nis, ':', COALESCE(abs2.status, 'tidak_hadir'))
                    SEPARATOR '|'
                ) FROM siswa_perwakilan sp2 
                LEFT JOIN absensi_siswa abs2 ON sp2.id_siswa = abs2.siswa_id 
                    AND abs2.jadwal_id = j.id_jadwal 
                    AND DATE(abs2.waktu_absen) = ag.tanggal
                WHERE sp2.kelas_id = ?) as siswa_data
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            JOIN mapel mp ON j.mapel_id = mp.id_mapel
            JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN siswa_perwakilan sp ON ag.siswa_pencatat_id = sp.id_siswa
            WHERE j.kelas_id = ? 
                AND ag.tanggal >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ORDER BY ag.tanggal DESC, j.jam_ke ASC
        `, [kelasId, kelasId]);

        // Group by date and calculate statistics
        const groupedData = {};
        riwayatData.forEach(row => {
            const dateKey = row.tanggal;
            if (!groupedData[dateKey]) {
                groupedData[dateKey] = {
                    tanggal: dateKey,
                    jadwal: []
                };
            }

            // Parse student attendance data
            const siswaData = row.siswa_data ? row.siswa_data.split('|') : [];
            const siswaStats = {
                hadir: 0,
                izin: 0,
                sakit: 0,
                alpa: 0,
                tidak_hadir: []
            };

            siswaData.forEach(data => {
                const [nama, nis, status] = data.split(':');
                if (status === 'hadir') {
                    siswaStats.hadir++;
                } else if (status === 'izin') {
                    siswaStats.izin++;
                    siswaStats.tidak_hadir.push({ 
                        nama_siswa: nama, 
                        nis: nis || '', 
                        status: 'izin' 
                    });
                } else if (status === 'sakit') {
                    siswaStats.sakit++;
                    siswaStats.tidak_hadir.push({ 
                        nama_siswa: nama, 
                        nis: nis || '', 
                        status: 'sakit' 
                    });
                } else if (status === 'alpa') {
                    siswaStats.alpa++;
                    siswaStats.tidak_hadir.push({ 
                        nama_siswa: nama, 
                        nis: nis || '', 
                        status: 'alpa' 
                    });
                } else {
                    // tidak_hadir (no attendance record)
                    siswaStats.alpa++;
                    siswaStats.tidak_hadir.push({ 
                        nama_siswa: nama, 
                        nis: nis || '', 
                        status: 'alpa' 
                    });
                }
            });

            groupedData[dateKey].jadwal.push({
                jam_ke: row.jam_ke,
                jam_mulai: row.jam_mulai,
                jam_selesai: row.jam_selesai,
                nama_mapel: row.nama_mapel,
                nama_guru: row.nama_guru,
                status_kehadiran: row.status_kehadiran,
                keterangan: row.keterangan,
                nama_pencatat: row.nama_pencatat,
                total_siswa: totalSiswa,
                total_hadir: siswaStats.hadir,
                total_izin: siswaStats.izin,
                total_sakit: siswaStats.sakit,
                total_alpa: siswaStats.alpa,
                siswa_tidak_hadir: siswaStats.tidak_hadir
            });
        });

        const result = Object.values(groupedData);
        console.log('✅ Riwayat kehadiran kelas retrieved:', result.length, 'days');
        
        // Debug: Log sample data structure
        if (result.length > 0 && result[0].jadwal.length > 0) {
            console.log('📊 Sample jadwal data:', result[0].jadwal[0]);
            if (result[0].jadwal[0].siswa_tidak_hadir && result[0].jadwal[0].siswa_tidak_hadir.length > 0) {
                console.log('👥 Sample siswa tidak hadir:', result[0].jadwal[0].siswa_tidak_hadir[0]);
            }
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Error getting riwayat kehadiran:', error);
        res.status(500).json({ error: 'Gagal memuat riwayat kehadiran' });
    }
});

// ====================
// ADMIN DASHBOARD ENDPOINTS
// ====================

// Get teachers for admin dashboard
app.get('/api/admin/teachers', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Getting teachers for admin dashboard');
        
        const query = `
            SELECT 
                g.id_guru as id,
                u.username, 
                g.nama, 
                g.nip,
                g.email,
                g.alamat,
                g.no_telp,
                g.jenis_kelamin,
                g.status,
                m.nama_mapel as mata_pelajaran
            FROM users u
            LEFT JOIN guru g ON u.username = g.username
            LEFT JOIN mapel m ON g.mapel_id = m.id_mapel
            WHERE u.role = 'guru'
            ORDER BY g.nama ASC
        `;
        
        const [results] = await connection.execute(query);
        console.log(`✅ Teachers retrieved: ${results.length} items`);
        res.json(results);
    } catch (error) {
        console.error('❌ Error getting teachers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add teacher account
app.post('/api/admin/teachers', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { nama, username, password } = req.body;
        console.log('➕ Adding teacher account:', { nama, username });

        if (!nama || !username || !password) {
            return res.status(400).json({ error: 'Nama, username, dan password wajib diisi' });
        }

        // Check if username already exists
        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Start transaction
        await connection.beginTransaction();

        try {
            // Insert user account
            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                [username, hashedPassword, 'guru']
            );

            // Insert guru data with generated NIP
            const nip = `G${Date.now().toString().slice(-8)}`; // Generate simple NIP
            await connection.execute(
                'INSERT INTO guru (nip, nama, username, jenis_kelamin, status) VALUES (?, ?, ?, ?, ?)',
                [nip, nama, username, 'L', 'aktif']
            );

            await connection.commit();
            console.log('✅ Teacher account added successfully');
            res.json({ message: 'Akun guru berhasil ditambahkan' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error adding teacher:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update teacher account
app.put('/api/admin/teachers/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nama, username, password } = req.body;
        console.log('📝 Updating teacher account:', { id, nama, username });

        if (!nama || !username) {
            return res.status(400).json({ error: 'Nama dan username wajib diisi' });
        }

        // Check if username already exists (excluding current user)
        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, id]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan' });
        }

        await connection.beginTransaction();

        try {
            // Get current username
            const [currentUser] = await connection.execute(
                'SELECT username FROM users WHERE id = ?',
                [id]
            );

            if (currentUser.length === 0) {
                return res.status(404).json({ error: 'User tidak ditemukan' });
            }

            const oldUsername = currentUser[0].username;

            // Update user account
            if (password) {
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                await connection.execute(
                    'UPDATE users SET username = ?, password = ? WHERE id = ?',
                    [username, hashedPassword, id]
                );
            } else {
                await connection.execute(
                    'UPDATE users SET username = ? WHERE id = ?',
                    [username, id]
                );
            }

            // Update guru data
            await connection.execute(
                'UPDATE guru SET nama = ?, username = ? WHERE username = ?',
                [nama, username, oldUsername]
            );

            await connection.commit();
            console.log('✅ Teacher account updated successfully');
            res.json({ message: 'Akun guru berhasil diupdate' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error updating teacher:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete teacher account
app.delete('/api/admin/teachers/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting teacher account:', { id });

        await connection.beginTransaction();

        try {
            // Get username first
            const [userResult] = await connection.execute(
                'SELECT username FROM users WHERE id = ?',
                [id]
            );

            if (userResult.length === 0) {
                return res.status(404).json({ error: 'User tidak ditemukan' });
            }

            const username = userResult[0].username;

            // Delete from guru table first (foreign key constraint)
            await connection.execute(
                'DELETE FROM guru WHERE username = ?',
                [username]
            );

            // Delete from users table
            await connection.execute(
                'DELETE FROM users WHERE id = ?',
                [id]
            );

            await connection.commit();
            console.log('✅ Teacher account deleted successfully');
            res.json({ message: 'Akun guru berhasil dihapus' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error deleting teacher:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// === TEACHER DATA ENDPOINTS ===

// Get teachers data for admin dashboard
app.get('/api/admin/teachers-data', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Getting teachers data for admin dashboard');
        
        const query = `
            SELECT g.id, g.nip, g.nama, g.email, g.mata_pelajaran, 
                   g.alamat, g.no_telp as telepon, g.jenis_kelamin, 
                   COALESCE(g.status, 'aktif') as status
            FROM guru g
            ORDER BY g.nama ASC
        `;
        
        const [results] = await connection.execute(query);
        console.log(`✅ Teachers data retrieved: ${results.length} items`);
        res.json(results);
    } catch (error) {
        console.error('❌ Error getting teachers data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add teacher data
app.post('/api/admin/teachers-data', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { nip, nama, email, mata_pelajaran, alamat, telepon, jenis_kelamin, status } = req.body;
        console.log('➕ Adding teacher data:', { nip, nama, mata_pelajaran });

        if (!nip || !nama || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIP, nama, dan jenis kelamin wajib diisi' });
        }

        // Check if NIP already exists
        const [existing] = await connection.execute(
            'SELECT id FROM guru WHERE nip = ?',
            [nip]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'NIP sudah terdaftar' });
        }

        const query = `
            INSERT INTO guru (id_guru, nip, nama, email, mata_pelajaran, alamat, no_telp, jenis_kelamin, status)
            VALUES ((SELECT COALESCE(MAX(id_guru), 0) + 1 FROM guru g2), ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await connection.execute(query, [
            nip, nama, email || null, mata_pelajaran || null, 
            alamat || null, telepon || null, jenis_kelamin, status || 'aktif'
        ]);

        console.log('✅ Teacher data added successfully:', result.insertId);
        res.json({ message: 'Data guru berhasil ditambahkan', id: result.insertId });
    } catch (error) {
        console.error('❌ Error adding teacher data:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'NIP sudah terdaftar' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Update teacher data
app.put('/api/admin/teachers-data/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nip, nama, email, mata_pelajaran, alamat, telepon, jenis_kelamin, status } = req.body;
        console.log('📝 Updating teacher data:', { id, nip, nama });

        if (!nip || !nama || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIP, nama, dan jenis kelamin wajib diisi' });
        }

        // Check if NIP already exists for other records
        const [existing] = await connection.execute(
            'SELECT id FROM guru WHERE nip = ? AND id != ?',
            [nip, id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'NIP sudah digunakan oleh guru lain' });
        }

        const updateQuery = `
            UPDATE guru 
            SET nip = ?, nama = ?, email = ?, mata_pelajaran = ?, 
                alamat = ?, no_telp = ?, jenis_kelamin = ?, status = ?
            WHERE id = ?
        `;

        const [result] = await connection.execute(updateQuery, [
            nip, nama, email || null, mata_pelajaran || null,
            alamat || null, telepon || null, jenis_kelamin, status || 'aktif', id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Data guru tidak ditemukan' });
        }

        console.log('✅ Teacher data updated successfully');
        res.json({ message: 'Data guru berhasil diupdate' });
    } catch (error) {
        console.error('❌ Error updating teacher data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete teacher data
app.delete('/api/admin/teachers-data/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting teacher data:', { id });

        const [result] = await connection.execute(
            'DELETE FROM guru WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Data guru tidak ditemukan' });
        }

        console.log('✅ Teacher data deleted successfully');
        res.json({ message: 'Data guru berhasil dihapus' });
    } catch (error) {
        console.error('❌ Error deleting teacher data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get students for admin dashboard
app.get('/api/admin/students', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Getting students for admin dashboard');
        
        const query = `
            SELECT 
                u.id, 
                u.username, 
                COALESCE(sp.email, u.email) as email,
                sp.nis, 
                sp.nama, 
                sp.kelas_id, 
                k.nama_kelas,
                sp.jenis_kelamin,
                sp.jabatan,
                sp.status,
                sp.alamat,
                sp.telepon_orangtua
            FROM users u
            LEFT JOIN siswa_perwakilan sp ON u.username = sp.username
            LEFT JOIN kelas k ON sp.kelas_id = k.id_kelas
            WHERE u.role = 'siswa'
            ORDER BY sp.nama ASC
        `;
        
        const [results] = await connection.execute(query);
        console.log(`✅ Students retrieved: ${results.length} items`);
        res.json(results);
    } catch (error) {
        console.error('❌ Error getting students:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add student account
app.post('/api/admin/students', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { nama, username, password } = req.body;
        console.log('➕ Adding student account:', { nama, username });

        if (!nama || !username || !password) {
            return res.status(400).json({ error: 'Nama, username, dan password wajib diisi' });
        }

        // Check if username already exists
        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Start transaction
        await connection.beginTransaction();

        try {
            // Insert user account
            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                [username, hashedPassword, 'siswa']
            );

            // Insert siswa_perwakilan data with generated NIS
            const nis = `S${Date.now().toString().slice(-8)}`; // Generate simple NIS
            await connection.execute(
                'INSERT INTO siswa_perwakilan (nis, nama, username, kelas_id, jenis_kelamin, status) VALUES (?, ?, ?, ?, ?, ?)',
                [nis, nama, username, 1, 'L', 'aktif'] // Default to kelas_id = 1
            );

            await connection.commit();
            console.log('✅ Student account added successfully');
            res.json({ message: 'Akun siswa berhasil ditambahkan' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error adding student:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update student account
app.put('/api/admin/students/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nama, username, password } = req.body;
        console.log('📝 Updating student account:', { id, nama, username });

        if (!nama || !username) {
            return res.status(400).json({ error: 'Nama dan username wajib diisi' });
        }

        // Check if username already exists (excluding current user)
        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, id]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan' });
        }

        await connection.beginTransaction();

        try {
            // Get current username
            const [currentUser] = await connection.execute(
                'SELECT username FROM users WHERE id = ?',
                [id]
            );

            if (currentUser.length === 0) {
                return res.status(404).json({ error: 'User tidak ditemukan' });
            }

            const oldUsername = currentUser[0].username;

            // Update user account
            if (password) {
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                await connection.execute(
                    'UPDATE users SET username = ?, password = ? WHERE id = ?',
                    [username, hashedPassword, id]
                );
            } else {
                await connection.execute(
                    'UPDATE users SET username = ? WHERE id = ?',
                    [username, id]
                );
            }

            // Update siswa_perwakilan data
            await connection.execute(
                'UPDATE siswa_perwakilan SET nama = ?, username = ? WHERE username = ?',
                [nama, username, oldUsername]
            );

            await connection.commit();
            console.log('✅ Student account updated successfully');
            res.json({ message: 'Akun siswa berhasil diupdate' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error updating student:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete student account
app.delete('/api/admin/students/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting student account:', { id });

        await connection.beginTransaction();

        try {
            // Get username first
            const [userResult] = await connection.execute(
                'SELECT username FROM users WHERE id = ?',
                [id]
            );

            if (userResult.length === 0) {
                return res.status(404).json({ error: 'User tidak ditemukan' });
            }

            const username = userResult[0].username;

            // Delete from siswa_perwakilan table first (foreign key constraint)
            await connection.execute(
                'DELETE FROM siswa_perwakilan WHERE username = ?',
                [username]
            );

            // Delete from users table
            await connection.execute(
                'DELETE FROM users WHERE id = ?',
                [id]
            );

            await connection.commit();
            console.log('✅ Student account deleted successfully');
            res.json({ message: 'Akun siswa berhasil dihapus' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error deleting student:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// === STUDENT DATA ENDPOINTS ===

// Get students data for admin dashboard
app.get('/api/admin/students-data', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Getting students data for admin dashboard');
        
        const query = `
            SELECT sp.id, sp.nis, sp.nama, sp.kelas_id, k.nama_kelas, 
                   sp.jenis_kelamin, sp.alamat, sp.telepon_orangtua, 
                   COALESCE(sp.status, 'aktif') as status
            FROM siswa_perwakilan sp
            LEFT JOIN kelas k ON sp.kelas_id = k.id_kelas
            ORDER BY sp.nama ASC
        `;
        
        const [results] = await connection.execute(query);
        console.log(`✅ Students data retrieved: ${results.length} items`);
        res.json(results);
    } catch (error) {
        console.error('❌ Error getting students data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add student data
app.post('/api/admin/students-data', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, status } = req.body;
        console.log('➕ Adding student data:', { nis, nama, kelas_id });

        if (!nis || !nama || !kelas_id || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIS, nama, kelas, dan jenis kelamin wajib diisi' });
        }

        // Check if NIS already exists
        const [existing] = await connection.execute(
            'SELECT id FROM siswa_perwakilan WHERE nis = ?',
            [nis]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'NIS sudah terdaftar' });
        }

        const insertQuery = `
            INSERT INTO siswa_perwakilan (id_siswa, nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, status)
            VALUES ((SELECT COALESCE(MAX(id_siswa), 0) + 1 FROM siswa_perwakilan sp2), ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await connection.execute(insertQuery, [
            nis, nama, kelas_id, jenis_kelamin, 
            alamat || null, telepon_orangtua || null, status || 'aktif'
        ]);

        console.log('✅ Student data added successfully:', result.insertId);
        res.json({ message: 'Data siswa berhasil ditambahkan', id: result.insertId });
    } catch (error) {
        console.error('❌ Error adding student data:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'NIS sudah terdaftar' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Update student data
app.put('/api/admin/students-data/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, status } = req.body;
        console.log('📝 Updating student data:', { id, nis, nama });

        if (!nis || !nama || !kelas_id || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIS, nama, kelas, dan jenis kelamin wajib diisi' });
        }

        // Check if NIS already exists for other records
        const [existing] = await connection.execute(
            'SELECT id FROM siswa_perwakilan WHERE nis = ? AND id != ?',
            [nis, id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'NIS sudah digunakan oleh siswa lain' });
        }

        const updateQuery = `
            UPDATE siswa_perwakilan 
            SET nis = ?, nama = ?, kelas_id = ?, jenis_kelamin = ?, 
                alamat = ?, telepon_orangtua = ?, status = ?
            WHERE id = ?
        `;

        const [result] = await connection.execute(updateQuery, [
            nis, nama, kelas_id, jenis_kelamin,
            alamat || null, telepon_orangtua || null, status || 'aktif', id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
        }

        console.log('✅ Student data updated successfully');
        res.json({ message: 'Data siswa berhasil diupdate' });
    } catch (error) {
        console.error('❌ Error updating student data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete student data
app.delete('/api/admin/students-data/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting student data:', { id });

        const [result] = await connection.execute(
            'DELETE FROM siswa_perwakilan WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
        }

        console.log('✅ Student data deleted successfully');
        res.json({ message: 'Data siswa berhasil dihapus' });
    } catch (error) {
        console.error('❌ Error deleting student data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get live summary for admin dashboard
app.get('/api/admin/live-summary', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Getting live summary for admin dashboard');
        
        // Get current day and time
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-GB', { hour12: false }); // HH:mm:ss format
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const currentDay = days[now.getDay()];

        // Get ongoing classes (classes that are currently happening)
        const ongoingQuery = `
            SELECT 
                j.id_jadwal,
                j.jam_mulai, 
                j.jam_selesai,
                k.nama_kelas,
                m.nama_mapel,
                g.nama as nama_guru,
                COUNT(ag.id_absensi) as absensi_diambil
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            JOIN mapel m ON j.mapel_id = m.id_mapel  
            JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id AND DATE(ag.tanggal) = CURDATE()
            WHERE j.hari = ? 
            AND TIME(?) BETWEEN j.jam_mulai AND j.jam_selesai
            GROUP BY j.id_jadwal, j.jam_mulai, j.jam_selesai, k.nama_kelas, m.nama_mapel, g.nama
            ORDER BY j.jam_mulai
        `;

        const [ongoingClasses] = await connection.execute(ongoingQuery, [currentDay, currentTime]);
        
        // Calculate overall attendance percentage for today
        const attendanceQuery = `
            SELECT 
                COUNT(DISTINCT j.id_jadwal) as total_jadwal_today,
                COUNT(DISTINCT ag.jadwal_id) as jadwal_with_attendance
            FROM jadwal j
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id AND DATE(ag.tanggal) = CURDATE()  
            WHERE j.hari = ?
        `;
        
        const [attendanceResult] = await connection.execute(attendanceQuery, [currentDay]);
        const attendanceStats = attendanceResult[0];
        
        const attendancePercentage = attendanceStats.total_jadwal_today > 0 
            ? Math.round((attendanceStats.jadwal_with_attendance / attendanceStats.total_jadwal_today) * 100)
            : 0;

        // Format ongoing classes data
        const formattedOngoingClasses = ongoingClasses.map(kelas => ({
            kelas: kelas.nama_kelas,
            guru: kelas.nama_guru,
            mapel: kelas.nama_mapel,
            jam: `${kelas.jam_mulai.substring(0,5)} - ${kelas.jam_selesai.substring(0,5)}`,
            nama_kelas: kelas.nama_kelas,
            nama_mapel: kelas.nama_mapel,
            nama_guru: kelas.nama_guru,
            jam_mulai: kelas.jam_mulai.substring(0,5),
            jam_selesai: kelas.jam_selesai.substring(0,5),
            absensi_diambil: kelas.absensi_diambil
        }));

        const liveData = {
            ongoing_classes: formattedOngoingClasses,
            overall_attendance_percentage: attendancePercentage.toString()
        };

        console.log(`✅ Live summary retrieved: ${formattedOngoingClasses.length} ongoing classes, ${attendancePercentage}% attendance`);
        res.json(liveData);
    } catch (error) {
        console.error('❌ Error getting live summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// ENDPOINTS UNTUK PENGAJUAN IZIN KELAS
// ================================================

// Get daftar siswa in class for siswa perwakilan
app.get('/api/siswa/:siswaId/daftar-siswa', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswaId } = req.params;
        console.log('📋 Getting daftar siswa for class representative:', siswaId);

        // Get the class of the siswa perwakilan
        const [kelasData] = await connection.execute(
            'SELECT kelas_id FROM siswa_perwakilan WHERE id_siswa = ?',
            [siswaId]
        );

        if (kelasData.length === 0) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        const kelasId = kelasData[0].kelas_id;

        // Get all students in the same class
        const [siswaData] = await connection.execute(`
            SELECT id_siswa as id, nama 
            FROM siswa_perwakilan 
            WHERE kelas_id = ? 
            ORDER BY nama ASC
        `, [kelasId]);

        console.log(`✅ Daftar siswa retrieved: ${siswaData.length} students`);
        res.json(siswaData);
    } catch (error) {
        console.error('❌ Error getting daftar siswa:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit pengajuan izin kelas
app.post('/api/siswa/:siswaId/pengajuan-izin-kelas', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswaId } = req.params;
        const { jadwal_id, tanggal_izin, siswa_izin } = req.body;
        console.log('📝 Submitting pengajuan izin kelas:', { siswaId, jadwal_id, tanggal_izin, siswaCount: siswa_izin.length });

        // Validation
        if (!jadwal_id || !tanggal_izin || !siswa_izin || siswa_izin.length === 0) {
            return res.status(400).json({ error: 'Semua field wajib diisi dan minimal 1 siswa harus dipilih' });
        }

        // Validate all students have required fields
        const validJenisIzin = ['sakit', 'izin', 'alpa', 'dispen'];
        for (const siswa of siswa_izin) {
            if (!siswa.nama || !siswa.jenis_izin || !siswa.alasan) {
                return res.status(400).json({ error: 'Semua siswa harus memiliki nama, jenis izin, dan alasan' });
            }
            
            // Validate jenis izin for each student
            if (!validJenisIzin.includes(siswa.jenis_izin)) {
                return res.status(400).json({ 
                    error: `Jenis izin tidak valid untuk siswa ${siswa.nama}: ${siswa.jenis_izin}. Jenis yang diperbolehkan: ${validJenisIzin.join(', ')}` 
                });
            }
        }

        // Get siswa perwakilan's class
        const [kelasData] = await connection.execute(
            'SELECT kelas_id FROM siswa_perwakilan WHERE id_siswa = ?',
            [siswaId]
        );

        if (kelasData.length === 0) {
            return res.status(404).json({ error: 'Siswa perwakilan tidak ditemukan' });
        }

        const kelasId = kelasData[0].kelas_id;

        // Insert main pengajuan izin record
        const [pengajuanResult] = await connection.execute(
            `INSERT INTO pengajuan_izin_siswa (siswa_id, jadwal_id, tanggal_izin, jenis_izin, alasan, tanggal_pengajuan, status, kelas_id)
             VALUES (?, ?, ?, 'kelas', 'Pengajuan izin untuk kelas', NOW(), 'pending', ?)`,
            [siswaId, jadwal_id, tanggal_izin, kelasId]
        );

        const pengajuanId = pengajuanResult.insertId;

        // Insert individual student records
        for (const siswa of siswa_izin) {
            await connection.execute(
                `INSERT INTO pengajuan_izin_detail (pengajuan_id, nama_siswa, jenis_izin, alasan, bukti_pendukung)
                 VALUES (?, ?, ?, ?, ?)`,
                [pengajuanId, siswa.nama, siswa.jenis_izin, siswa.alasan, siswa.bukti_pendukung || null]
            );
        }

        console.log('✅ Pengajuan izin kelas submitted successfully');
        res.json({ 
            message: `Pengajuan izin untuk ${siswa_izin.length} siswa berhasil dikirim`,
            id: pengajuanId 
        });
    } catch (error) {
        console.error('❌ Error submitting pengajuan izin kelas:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// ENDPOINTS UNTUK BANDING ABSEN
// ================================================

// Get banding absen for student
app.get('/api/siswa/:siswaId/banding-absen', authenticateToken, requireRole(['siswa']), async (req, res) => {
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
                ba.bukti_pendukung,
                ba.status_banding,
                ba.catatan_guru,
                ba.tanggal_pengajuan,
                ba.tanggal_keputusan,
                COALESCE(j.jam_mulai, 'Umum') as jam_mulai,
                COALESCE(j.jam_selesai, 'Umum') as jam_selesai,
                COALESCE(m.nama_mapel, 'Banding Umum') as nama_mapel,
                COALESCE(g.nama, 'Menunggu Proses') as nama_guru,
                COALESCE(k.nama_kelas, '') as nama_kelas
            FROM pengajuan_banding_absen ba
            LEFT JOIN jadwal j ON ba.jadwal_id = j.id_jadwal
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON ba.diproses_oleh = g.id_guru
            LEFT JOIN siswa_perwakilan sp ON ba.siswa_id = sp.id_siswa
            LEFT JOIN kelas k ON sp.kelas_id = k.id_kelas
            WHERE ba.siswa_id = ?
            ORDER BY ba.tanggal_pengajuan DESC
        `;

        const [rows] = await connection.execute(query, [siswaId]);
        console.log(`✅ Banding absen retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting banding absen:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit banding absen
app.post('/api/siswa/:siswaId/banding-absen', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswaId } = req.params;
        const { jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding } = req.body;
        console.log('📝 Submitting banding absen:', { siswaId, jadwal_id, tanggal_absen, status_asli, status_diajukan });

        // Validation
        if (!jadwal_id || !tanggal_absen || !status_asli || !status_diajukan || !alasan_banding) {
            return res.status(400).json({ error: 'Semua field wajib diisi' });
        }

        if (status_asli === status_diajukan) {
            return res.status(400).json({ error: 'Status asli dan status yang diajukan tidak boleh sama' });
        }

        // Check if banding already exists for this combination
        const [existing] = await connection.execute(
            'SELECT id_banding FROM pengajuan_banding_absen WHERE siswa_id = ? AND jadwal_id = ? AND tanggal_absen = ? AND status_banding = "pending"',
            [siswaId, jadwal_id, tanggal_absen]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Banding untuk jadwal dan tanggal ini sudah pernah diajukan dan sedang diproses' });
        }

        // Insert banding absen
        const [result] = await connection.execute(
            `INSERT INTO pengajuan_banding_absen 
            (siswa_id, jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [siswaId, jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding]
        );

        console.log('✅ Banding absen submitted successfully');
        res.json({ 
            message: 'Banding absen berhasil dikirim',
            id: result.insertId 
        });
    } catch (error) {
        console.error('❌ Error submitting banding absen:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit banding absen kelas
app.post('/api/siswa/:siswaId/banding-absen-kelas', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswaId } = req.params;
        const { jadwal_id, tanggal_absen, siswa_banding } = req.body;
        console.log('📝 Submitting banding absen kelas:', { siswaId, jadwal_id, tanggal_absen, siswaCount: siswa_banding.length });

        // Validation
        if (!jadwal_id || !tanggal_absen || !siswa_banding || siswa_banding.length === 0) {
            return res.status(400).json({ error: 'Semua field wajib diisi dan minimal 1 siswa harus dipilih' });
        }

        // Validate all students have required fields
        for (const siswa of siswa_banding) {
            if (!siswa.nama || !siswa.status_asli || !siswa.status_diajukan || !siswa.alasan_banding) {
                return res.status(400).json({ error: 'Semua siswa harus memiliki nama, status asli, status diajukan, dan alasan banding' });
            }
        }

        // Get siswa perwakilan's class
        const [kelasData] = await connection.execute(
            'SELECT kelas_id FROM siswa_perwakilan WHERE id_siswa = ?',
            [siswaId]
        );

        if (kelasData.length === 0) {
            return res.status(404).json({ error: 'Siswa perwakilan tidak ditemukan' });
        }

        const kelasId = kelasData[0].kelas_id;

        // Insert main banding absen record
        const [bandingResult] = await connection.execute(
            `INSERT INTO pengajuan_banding_absen (siswa_id, jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding, tanggal_pengajuan, status_banding, kelas_id, jenis_banding)
             VALUES (?, ?, ?, 'kelas', 'kelas', 'Pengajuan banding absen untuk kelas', NOW(), 'pending', ?, 'kelas')`,
            [siswaId, jadwal_id, tanggal_absen, kelasId]
        );

        const bandingId = bandingResult.insertId;

        // Insert individual student records
        for (const siswa of siswa_banding) {
            await connection.execute(
                `INSERT INTO banding_absen_detail (banding_id, nama_siswa, status_asli, status_diajukan, alasan_banding, bukti_pendukung)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [bandingId, siswa.nama, siswa.status_asli, siswa.status_diajukan, siswa.alasan_banding, siswa.bukti_pendukung || null]
            );
        }

        console.log('✅ Banding absen kelas submitted successfully');
        res.json({ 
            message: `Pengajuan banding absen untuk ${siswa_banding.length} siswa berhasil dikirim`,
            id: bandingId 
        });
    } catch (error) {
        console.error('❌ Error submitting banding absen kelas:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get banding absen for teacher to process
app.get('/api/guru/:guruId/banding-absen', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { guruId } = req.params;
        console.log('📋 Getting banding absen for guru:', guruId);

        const query = `
            SELECT 
                ba.id_banding,
                ba.siswa_id,
                ba.jadwal_id,
                ba.tanggal_absen,
                ba.status_asli,
                ba.status_diajukan,
                ba.alasan_banding,
                ba.bukti_pendukung,
                ba.status_banding,
                ba.catatan_guru,
                ba.tanggal_pengajuan,
                ba.tanggal_keputusan,
                j.jam_mulai,
                j.jam_selesai,
                m.nama_mapel,
                sp.nama as nama_siswa,
                sp.nis,
                k.nama_kelas
            FROM pengajuan_banding_absen ba
            JOIN jadwal j ON ba.jadwal_id = j.id_jadwal
            JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN siswa_perwakilan sp ON ba.siswa_id = sp.id_siswa
            JOIN kelas k ON sp.kelas_id = k.id_kelas
            WHERE j.guru_id = ?
            ORDER BY ba.tanggal_pengajuan DESC, ba.status_banding ASC
        `;

        const [rows] = await connection.execute(query, [guruId]);
        console.log(`✅ Banding absen for guru retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting banding absen for guru:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Process banding absen by teacher
app.put('/api/banding-absen/:bandingId/respond', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { bandingId } = req.params;
        const { status_banding, catatan_guru, diproses_oleh } = req.body;
        const guruId = diproses_oleh || req.user.guru_id || req.user.id;
        
        console.log('📝 Guru processing banding absen:', { bandingId, status_banding, guruId });

        // Validation
        if (!status_banding || !['disetujui', 'ditolak'].includes(status_banding)) {
            return res.status(400).json({ error: 'Status harus disetujui atau ditolak' });
        }

        // Update banding absen
        const [result] = await connection.execute(
            `UPDATE pengajuan_banding_absen 
             SET status_banding = ?, catatan_guru = ?, tanggal_keputusan = NOW(), diproses_oleh = ?
             WHERE id_banding = ?`,
            [status_banding, catatan_guru || '', guruId, bandingId]
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
        console.error('❌ Error responding to banding absen:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// SERVER INITIALIZATION
// ================================================

// Initialize database connection and start server
connectToDatabase().then(() => {
    app.listen(port, () => {
        console.log(`🚀 ABSENTA Modern Server is running on http://localhost:${port}`);
        console.log(`📱 Frontend should connect to this server`);
        console.log(`🔑 Admin login: admin / admin123`);
        console.log(`👨‍🏫 Guru login: guru_matematika / guru123`);
        console.log(`👨‍🎓 Siswa login: perwakilan_x_ipa1 / siswa123`);
    });
}).catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});

// ================================================
// RIWAYAT PENGAJUAN IZIN ENDPOINTS (STEP 8)
// ================================================

// Get riwayat pengajuan izin for admin
app.get('/api/admin/riwayat-izin-report', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, jenis_izin, status } = req.query;
        console.log('📊 Getting riwayat pengajuan izin report:', { startDate, endDate, kelas_id, jenis_izin, status });

        let query = `
            SELECT 
                pi.id_pengajuan,
                DATE_FORMAT(pi.tanggal_pengajuan, '%d/%m/%Y %H:%i') as tanggal_pengajuan,
                DATE_FORMAT(pi.tanggal_izin, '%d/%m/%Y') as tanggal_izin,
                s.nama as nama_siswa,
                s.nis,
                k.nama_kelas,
                pi.jenis_izin,
                pi.alasan,
                pi.status,
                COALESCE(pi.keterangan_guru, '-') as keterangan_guru,
                COALESCE(DATE_FORMAT(pi.tanggal_respon, '%d/%m/%Y %H:%i'), '-') as tanggal_respon,
                COALESCE(m.nama_mapel, 'Izin Umum') as nama_mapel,
                CASE 
                    WHEN pi.guru_id IS NOT NULL THEN g_respon.nama
                    WHEN j.guru_id IS NOT NULL THEN g.nama
                    ELSE 'Menunggu Persetujuan'
                END as nama_guru,
                COALESCE(CONCAT(j.jam_mulai, ' - ', j.jam_selesai), 'Izin Harian') as jadwal,
                COALESCE(pi.bukti_pendukung, '-') as bukti_pendukung
            FROM pengajuan_izin_siswa pi
            JOIN siswa_perwakilan s ON pi.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON pi.jadwal_id = j.id_jadwal
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN guru g_respon ON pi.guru_id = g_respon.id_guru
            WHERE 1=1
        `;
        
        const params = [];
        
        if (startDate && endDate) {
            query += ' AND DATE(pi.tanggal_pengajuan) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }
        
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        
        if (jenis_izin && jenis_izin !== '') {
            query += ' AND pi.jenis_izin = ?';
            params.push(jenis_izin);
        }
        
        if (status && status !== '') {
            query += ' AND pi.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY pi.tanggal_pengajuan DESC';
        
        const [rows] = await connection.execute(query, params);
        console.log(`✅ Found ${rows.length} riwayat pengajuan izin records`);
        
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting riwayat pengajuan izin report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download riwayat pengajuan izin report as CSV
app.get('/api/admin/download-riwayat-izin', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, jenis_izin, status } = req.query;
        console.log('📊 Downloading riwayat pengajuan izin report:', { startDate, endDate, kelas_id, jenis_izin, status });

        let query = `
            SELECT 
                DATE_FORMAT(pi.tanggal_pengajuan, '%d/%m/%Y %H:%i') as tanggal_pengajuan,
                DATE_FORMAT(pi.tanggal_izin, '%d/%m/%Y') as tanggal_izin,
                s.nama as nama_siswa,
                s.nis,
                k.nama_kelas,
                pi.jenis_izin,
                pi.alasan,
                pi.status,
                COALESCE(pi.keterangan_guru, '-') as keterangan_guru,
                COALESCE(DATE_FORMAT(pi.tanggal_respon, '%d/%m/%Y %H:%i'), '-') as tanggal_respon,
                COALESCE(m.nama_mapel, 'Izin Umum') as nama_mapel,
                CASE 
                    WHEN pi.guru_id IS NOT NULL THEN g_respon.nama
                    WHEN j.guru_id IS NOT NULL THEN g.nama
                    ELSE 'Menunggu Persetujuan'
                END as nama_guru,
                COALESCE(CONCAT(j.jam_mulai, ' - ', j.jam_selesai), 'Izin Harian') as jadwal,
                COALESCE(pi.bukti_pendukung, '-') as bukti_pendukung
            FROM pengajuan_izin_siswa pi
            JOIN siswa_perwakilan s ON pi.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON pi.jadwal_id = j.id_jadwal
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN guru g_respon ON pi.guru_id = g_respon.id_guru
            WHERE 1=1
        `;
        
        const params = [];
        
        if (startDate && endDate) {
            query += ' AND DATE(pi.tanggal_pengajuan) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }
        
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        
        if (jenis_izin && jenis_izin !== '') {
            query += ' AND pi.jenis_izin = ?';
            params.push(jenis_izin);
        }
        
        if (status && status !== '') {
            query += ' AND pi.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY pi.tanggal_pengajuan DESC';
        
        const [rows] = await connection.execute(query, params);

        // Enhanced CSV format with UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal Pengajuan,Tanggal Izin,Nama Siswa,NIS,Kelas,Jenis Izin,Alasan,Status,Keterangan Guru,Tanggal Respon,Mata Pelajaran,Guru,Jadwal,Bukti Pendukung\n';
        
        rows.forEach(row => {
            csvContent += `"${row.tanggal_pengajuan}","${row.tanggal_izin}","${row.nama_siswa}","${row.nis}","${row.nama_kelas}","${row.jenis_izin}","${row.alasan}","${row.status}","${row.keterangan_guru}","${row.tanggal_respon}","${row.nama_mapel}","${row.nama_guru}","${row.jadwal}","${row.bukti_pendukung}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="riwayat-pengajuan-izin-${startDate || 'all'}-${endDate || 'all'}.csv"`);
        res.send(csvContent);
        
        console.log(`✅ Riwayat pengajuan izin report downloaded successfully: ${rows.length} records`);
    } catch (error) {
        console.error('❌ Error downloading riwayat pengajuan izin report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down server...');
    if (connection) {
        await connection.end();
        console.log('✅ Database connection closed');
    }
    process.exit(0);
});

export default app;
