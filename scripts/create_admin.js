import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'absenta13',
    port: Number(process.env.DB_PORT) || 3306
};

let connection;
try {
    console.log(`Connecting to ${config.user}@${config.host}:${config.port}/${config.database}`);
    connection = await mysql.createConnection(config);
    console.log('Connected.');

    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin_playwright';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if exists
    const [rows] = await connection.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (rows.length > 0) {
        console.log(`User ${username} already exists. Updating password.`);
        await connection.execute('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username]);
    } else {
        console.log(`Creating user ${username}.`);
        await connection.execute(
            'INSERT INTO users (username, password, role, nama, email, status) VALUES (?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, 'admin', 'Playwright Admin', 'admin@playwright.com', 'aktif']
        );
    }

    console.log(`Admin user ready: ${username}`);
} catch (err) {
    console.error('Error:', err);
} finally {
    if (connection) {
        await connection.end();
    }
}
