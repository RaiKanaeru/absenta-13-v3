/**
 * Run Jam Pelajaran Seeder
 * 
 * Usage: node database/seeders/run-seed-jam-pelajaran.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { seedJamPelajaran } from './seed_jam_pelajaran.js';

dotenv.config();

async function main() {
  console.log('🚀 Connecting to database...');
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'absenta13',
    waitForConnections: true,
    connectionLimit: 2
  });

  try {
    // Test connection
    const [rows] = await pool.execute('SELECT 1');
    console.log('✅ Database connected');

    // Run seeder
    const count = await seedJamPelajaran(pool);
    console.log(`🎉 Seeding complete! ${count} records inserted.`);

    // Verify
    const [result] = await pool.execute(
      'SELECT hari, COUNT(*) as count FROM jam_pelajaran GROUP BY hari'
    );
    console.log('📊 Summary:');
    for (const row of result) {
      console.log(`   ${row.hari}: ${row.count} jam slots`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('👋 Connection closed');
  }
}

main();
