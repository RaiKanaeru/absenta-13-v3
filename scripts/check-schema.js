import mysql from 'mysql2/promise';

const run = async () => {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: '',
            database: 'absenta13'
        });

        const [rows] = await connection.query('DESCRIBE jam_pelajaran');
        console.log(JSON.stringify(rows, null, 2));

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        if (connection) await connection.end();
    }
};

run();
