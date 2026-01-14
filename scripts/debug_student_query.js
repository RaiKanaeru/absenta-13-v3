
import dotenv from 'dotenv';
dotenv.config();

import DatabaseOptimization from '../server/services/system/database-optimization.js';

console.log('Testing student query...');
const dbOptimization = new DatabaseOptimization();

try {
    await dbOptimization.initialize();
    console.log('DB Initialized.');
    
    // Simulating the environment in siswaController
    // global.dbPool is the instance in server_modern.js
    // But here we can just use dbOptimization directly as the controller uses global.dbPool.execute which maps to dbOptimization.execute
    
    const limit = 10;
    const offset = 0;
    const search = '';
    
    let query = `
        SELECT s.*, k.nama_kelas, u.username, u.email as user_email, u.status as user_status
        FROM siswa s
        JOIN kelas k ON s.kelas_id = k.id_kelas
        JOIN users u ON s.user_id = u.id
    `;
    let params = [];

    if (search) {
        query += ' WHERE (s.nama LIKE ? OR s.nis LIKE ? OR k.nama_kelas LIKE ?)';
        params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }

    query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number.parseInt(limit), Number.parseInt(offset));

    console.log('Executing query:', query);
    console.log('Params:', params);

    const [rows] = await dbOptimization.execute(query, params);
    console.log('Query successful!');
    console.log('Rows found:', rows.length);
    if (rows.length > 0) {
        console.log('First row:', rows[0]);
    }

} catch (error) {
    console.error('❌ Query failed:', error);
} finally {
    await dbOptimization.close();
}
