
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'your_mysql_password', // Fallback to what was in README if env missing
    database: process.env.DB_NAME || 'absenta13',
    port: Number(process.env.DB_PORT) || 3306
};

// Override with values from generateDummyData.js if env is not set correctly in context
// In generateDummyData.js: password: process.env.DB_PASSWORD || ''
// But README says DB_PASSWORD=your_mysql_password.
// I'll try empty string if default fails, but let's assume env is set or defaults work.
// Actually, I should check if I can connect.

async function createAdmin() {
    let connection;
    try {
        console.log(`Connecting to ${config.user}@${config.host}:${config.port}/${config.database}`);
        connection = await mysql.createConnection(config);
        console.log('Connected.');

        const username = 'admin_playwright';
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Check if exists
        const [rows] = await connection.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            console.log('User admin_playwright already exists. Updating password.');
            await connection.execute('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username]);
        } else {
            console.log('Creating user admin_playwright.');
            await connection.execute(
                'INSERT INTO users (username, password, role, nama, email, status) VALUES (?, ?, ?, ?, ?, ?)',
                [username, hashedPassword, 'admin', 'Playwright Admin', 'admin@playwright.com', 'aktif']
            );
        }

        console.log('Admin user ready: admin_playwright / password123');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (connection) await connection.end();
    }
}

createAdmin();
