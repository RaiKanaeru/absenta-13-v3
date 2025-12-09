import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import getMySQLDateTimeWIB from '../../database-optimization.js'; // Assuming we strictly need this or can use global helper? 
// global.dbPool is used, so we assume server_modern.js initializes it.
// Helpers like getMySQLDateTimeWIB might need to be imported or duplicated.
// Let's check imports in server_modern.js - it defines them locally.
// I should probably extract helpers to utils first, but for now I'll use the global helpers strategy 
// or duplicate small helpers if needed, OR export them from a utilities file.
// Ideally, helpers should be in server/utils/dateUtils.js. 
// For this step, I will stick to what's available or duplicate small logic to avoid circular deps or complex exports from root.
// Actually, `server_modern.js` has them as local functions. 
// I will create `server/utils/dateUtils.js` first to be clean? 
// No, let's keep it simple for now and maybe assume we can access them if they were global, 
// BUT they are NOT attached to global in server_modern.js.
// So I MUST Duplicate or Extract them. Extracting is better.
// I'll create `server/utils/time.js` for time helpers.

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'absenta-super-secret-key-2025';

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log(`🔐 Login attempt for username: ${username}`);

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Query user from database
        const [rows] = await global.dbPool.execute(
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
            const [guruData] = await global.dbPool.execute(
                `SELECT g.*, m.nama_mapel 
                 FROM guru g 
                 LEFT JOIN mapel m ON g.mapel_id = m.id_mapel 
                 WHERE g.user_id = ?`,
                [user.id]
            );
            if (guruData.length > 0) {
                additionalData = {
                    guru_id: guruData[0].id_guru,
                    nip: guruData[0].nip,
                    mapel: guruData[0].nama_mapel || null
                };
            }
        } else if (user.role === 'siswa') {
            const [siswaData] = await global.dbPool.execute(
                `SELECT s.*, k.nama_kelas 
                 FROM siswa s 
                 JOIN kelas k ON s.kelas_id = k.id_kelas 
                 WHERE s.user_id = ?`,
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
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'lax', 
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
};

export const logout = (req, res) => {
    res.clearCookie('token');
    console.log('✅ User logged out successfully');
    res.json({ success: true, message: 'Logged out successfully' });
};

export const verify = (req, res) => {
    res.json({
        success: true,
        user: req.user,
        message: 'Token is valid'
    });
};
