import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Setup dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from root
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runMigrations() {
    console.log('🚀 Starting Database Migration...');

    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'absenta13',
        port: Number(process.env.DB_PORT) || 3306,
        multipleStatements: true // Allow running multiple SQL statements
    };

    console.log(`🔌 Connecting to database: ${config.database} @ ${config.host}`);

    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('✅ Connected successfully.');

        // Read the SQL file
        const sqlPath = path.join(__dirname, 'create_admin_activity_logs.sql');
        const sql = await fs.readFile(sqlPath, 'utf8');

        console.log('📜 Executing migration SQL...');
        
        // Execute the SQL
        await connection.query(sql);
        
        console.log('✅ Migration completed successfully! Table `admin_activity_logs` is ready.');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('👋 Connection closed.');
        }
    }
}

runMigrations();
