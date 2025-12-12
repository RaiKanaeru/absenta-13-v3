import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { sendErrorResponse, sendValidationError } from '../utils/errorHandler.js';

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
        return sendErrorResponse(
            res, 
            error, 
            'Terjadi kesalahan saat memproses login Anda. Silakan coba lagi dalam beberapa saat atau hubungi administrator jika masalah berlanjut.',
            500
        );
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
