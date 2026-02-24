import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
};

let conn;
try {
    conn = await mysql.createConnection(config);
    const pass = process.env.DEFAULT_ADMIN_PASSWORD || 'password123';
    const hash = await bcrypt.hash(pass, 10);
    
    // Check if admin exists
    const [rows] = await conn.execute('SELECT * FROM users WHERE username = "admin"');
    if (rows.length > 0) {
        await conn.execute('UPDATE users SET password = ? WHERE username = "admin"', [hash]);
        console.log('Updated admin password for admin user');
    } else {
        await conn.execute(
            'INSERT INTO users (username, password, role, nama, email, status) VALUES (?, ?, ?, ?, ?, ?)',
            ['admin', hash, 'admin', 'Admin', 'admin@example.com', 'aktif']
        );
        console.log('Created admin user with configured default password');
    }
    await conn.end();
} catch (error) {
    if (conn) {
        await conn.end();
    }
    console.error(error);
    process.exit(1);
}
