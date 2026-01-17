import fs from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get file from command line arg
const sqlFile = process.argv[2];

if (!sqlFile) {
    console.error('Please provide an SQL file path');
    process.exit(1);
}

const filePath = path.resolve(process.cwd(), sqlFile);

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const run = async () => {
    let connection;
    try {
        console.log(`Connecting to database...`);
        connection = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: '', // Empty password as per user
            database: 'absenta13',
            multipleStatements: true // Critical for importing dumps
        });

        console.log(`Reading SQL file: ${sqlFile}...`);
        let sql = fs.readFileSync(filePath, 'utf8');
        // Strip BOM if present
        sql = sql.replace(/^\uFEFF/, '');

        console.log(`Executing SQL... (this may take a moment)`);
        await connection.query(sql);

        console.log(`✅ Successfully imported ${sqlFile}`);

    } catch (err) {
        console.error('❌ Import failed:', err);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
};

run();
