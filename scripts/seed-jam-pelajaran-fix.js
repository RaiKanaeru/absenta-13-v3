
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
    // Force localhost for running script from host machine (outside docker)
    host: '127.0.0.1', 
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'absenta13'
};

const JAM_SLOTS_NORMAL = [
    { jam_ke: 0, mulai: '07:00', selesai: '07:15', jenis: 'upacara', label: 'LITERASI (Senin Upacara)', durasi: 15 },
    { jam_ke: 1, mulai: '07:15', selesai: '08:00', jenis: 'pelajaran', durasi: 45 },
    { jam_ke: 2, mulai: '08:00', selesai: '08:45', jenis: 'pelajaran', durasi: 45 },
    { jam_ke: 3, mulai: '08:45', selesai: '09:30', jenis: 'pelajaran', durasi: 45 },
    { jam_ke: 4, mulai: '09:30', selesai: '10:15', jenis: 'pelajaran', durasi: 45 },
    { jam_ke: 5, mulai: '10:15', selesai: '10:30', jenis: 'istirahat', label: 'ISTIRAHAT 1', durasi: 15 },
    { jam_ke: 6, mulai: '10:30', selesai: '11:15', jenis: 'pelajaran', durasi: 45 },
    { jam_ke: 7, mulai: '11:15', selesai: '12:00', jenis: 'pelajaran', durasi: 45 },
    { jam_ke: 8, mulai: '12:00', selesai: '12:30', jenis: 'istirahat', label: 'ISTIRAHAT 2 (SHOLAT)', durasi: 30 },
    { jam_ke: 9, mulai: '12:30', selesai: '13:15', jenis: 'pelajaran', durasi: 45 },
    { jam_ke: 10, mulai: '13:15', selesai: '14:00', jenis: 'pelajaran', durasi: 45 },
    { jam_ke: 11, mulai: '14:00', selesai: '14:45', jenis: 'pelajaran', durasi: 45 },
    { jam_ke: 12, mulai: '14:45', selesai: '15:30', jenis: 'pelajaran', durasi: 45 },
];

const JAM_SLOTS_JUMAT = [
    { jam_ke: 0, mulai: '07:00', selesai: '07:15', jenis: 'upacara', label: 'LITERASI/QURAN', durasi: 15 },
    { jam_ke: 1, mulai: '07:15', selesai: '07:50', jenis: 'pelajaran', durasi: 35 },
    { jam_ke: 2, mulai: '07:50', selesai: '08:25', jenis: 'pelajaran', durasi: 35 },
    { jam_ke: 3, mulai: '08:25', selesai: '09:00', jenis: 'pelajaran', durasi: 35 },
    { jam_ke: 4, mulai: '09:00', selesai: '09:35', jenis: 'pelajaran', durasi: 35 },
    { jam_ke: 5, mulai: '09:35', selesai: '09:50', jenis: 'istirahat', label: 'ISTIRAHAT 1', durasi: 15 },
    { jam_ke: 6, mulai: '09:50', selesai: '10:25', jenis: 'pelajaran', durasi: 35 },
    { jam_ke: 7, mulai: '10:25', selesai: '11:00', jenis: 'pelajaran', durasi: 35 },
    { jam_ke: 8, mulai: '11:00', selesai: '13:00', jenis: 'istirahat', label: 'SHOLAT JUMAT', durasi: 120 },
    { jam_ke: 9, mulai: '13:00', selesai: '13:40', jenis: 'pelajaran', durasi: 40 },
    { jam_ke: 10, mulai: '13:40', selesai: '14:20', jenis: 'pelajaran', durasi: 40 },
];

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

(async () => {
    let conn;
    try {
        console.log('Connecting to DB...', { host: dbConfig.host, database: dbConfig.database });
        conn = await mysql.createConnection(dbConfig);
        console.log('Connected!');

        console.log('Truncating jam_pelajaran...');
        await conn.execute('TRUNCATE TABLE jam_pelajaran');

        console.log('Seeding data...');
        for (const hari of DAYS) {
            const slots = hari === 'Jumat' ? JAM_SLOTS_JUMAT : JAM_SLOTS_NORMAL;
            
            for (const slot of slots) {
                // Check if kelas_id is required via describe?
                // Assuming global for now as per error message context
                // Insert: hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label
                
                await conn.execute(
                    `INSERT INTO jam_pelajaran 
                    (hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        hari, 
                        slot.jam_ke, 
                        slot.mulai, 
                        slot.selesai, 
                        slot.durasi, 
                        slot.jenis, 
                        slot.label || null
                    ]
                );
            }
            console.log(`Seeded ${hari} (${slots.length} slots)`);
        }
        console.log('Done!');
        process.exit(0);

    } catch (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR' && err.sqlMessage.includes('Unknown column')) {
             console.error('Schema mismatch! Table columns do not match script.', err.sqlMessage);
             // Logic to handle fallback if needed
        }
        console.error('Error:', err);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
})();
