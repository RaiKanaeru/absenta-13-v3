import mysql from 'mysql2/promise';

const run = async () => {
    let connection;
    try {
        console.log('Connecting...');
        connection = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: '',
            database: 'absenta13',
            multipleStatements: true
        });

        console.log('Adding kelas_id to jam_pelajaran...');
        // Check if column exists first to avoid error
        const [cols] = await connection.query("SHOW COLUMNS FROM jam_pelajaran LIKE 'kelas_id'");
        if (cols.length === 0) {
            await connection.query("ALTER TABLE jam_pelajaran ADD COLUMN kelas_id INT DEFAULT NULL");
            await connection.query("ALTER TABLE jam_pelajaran ADD INDEX idx_kelas_id (kelas_id)");
            console.log('✅ Column kelas_id added.');
        } else {
            console.log('ℹ️ Column kelas_id already exists.');
        }

    } catch (err) {
        console.error('❌ Check failed:', err);
    } finally {
        if (connection) await connection.end();
    }
};

run();
