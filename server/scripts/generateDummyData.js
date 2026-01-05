/**
 * Generate Dummy Data for Absenta13
 * 
 * Usage: node server/scripts/generateDummyData.js
 * 
 * Generates:
 * - Mapel (Subjects)
 * - Classes (X/XI/XII - RPL/TKJ/AK - 1/2)
 * - Users (Guru & Siswa)
 * - Guru (Teachers)
 * - Siswa (Students)
 * - Jadwal (Schedules)
 * - Absensi (Attendance History)
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

dotenv.config();

// Configuration with fallbacks for local execution
const config = {
    host: process.env.DB_HOST === 'mysql' ? 'localhost' : (process.env.DB_HOST || 'localhost'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'absenta13',
    port: parseInt(process.env.DB_PORT) || 3306
};

// Override if password is empty in env but needed for local
if (config.user === 'root' && !config.password) {
    // Attempt standard empty password first, user can edit if needed
}

const saltRounds = 10;
const GLOBAL_PASSWORD = 'password123'; // Default password for all users

// Data Constants
const JURUSAN = ['RPL', 'TKJ', 'AK'];
const TINGKAT = ['X', 'XI', 'XII'];
const ROMBEL = ['1', '2'];

const MAPEL_UMUM = [
    { code: 'MTK', name: 'Matematika' },
    { code: 'BIN', name: 'Bahasa Indonesia' },
    { code: 'ING', name: 'Bahasa Inggris' },
    { code: 'PKN', name: 'PKN' },
    { code: 'PAI', name: 'Pendidikan Agama' },
    { code: 'SEJ', name: 'Sejarah' },
    { code: 'PJK', name: 'PJOK' }
];

const MAPEL_KEJURUAN = {
    'RPL': [
        { code: 'DDP', name: 'Pemrograman Dasar' },
        { code: 'PBO', name: 'Pemrograman Berorientasi Objek' },
        { code: 'PWD', name: 'Pemrograman Web' },
        { code: 'PKK', name: 'Produk Kreatif & Kewirausahaan' },
        { code: 'BD', name: 'Basis Data' }
    ],
    'TKJ': [
        { code: 'JRD', name: 'Jaringan Dasar' },
        { code: 'ASJ', name: 'Administrasi Sistem Jaringan' },
        { code: 'TLJ', name: 'Teknologi Layanan Jaringan' }
    ],
    'AK': [
        { code: 'KID', name: 'Kimia Dasar' },
        { code: 'MKB', name: 'Mikrobiologi' },
        { code: 'AIN', name: 'Analisis Instrumen' }
    ]
}

const NAMES_FIRST = ['Ahmad', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko', 'Kartika', 'Lina', 'Muhammad', 'Nur', 'Putri', 'Rizky', 'Siti', 'Tono', 'Umar', 'Vina', 'Wahyu', 'Yulia', 'Zainal'];
const NAMES_LAST = ['Saputra', 'Wijaya', 'Lestari', 'Santoso', 'Pratama', 'Hidayat', 'Kusuma', 'Sari', 'Nugraha', 'Wibowo', 'Ramadhan', 'Utami', 'Firmansyah', 'Permata', 'Setiawan', 'Anwar', 'Susanti'];

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateName() {
    return `${getRandomElement(NAMES_FIRST)} ${getRandomElement(NAMES_LAST)}`;
}

function generatePhone() {
    return `08${Math.floor(Math.random() * 10000000000)}`;
}

async function main() {
    console.log('🚀 Starting Dummy Data Generation...');
    console.log(`📡 Connecting to DB: ${config.user}@${config.host}:${config.port}/${config.database}`);
    
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('✅ Connected to database');

        // 1. Generate MAPEL (Table: mapel)
        console.log('📚 Generating Subjects (mapel)...');
        const mapelIds = [];
        const allSubjects = [...MAPEL_UMUM, ...Object.values(MAPEL_KEJURUAN).flat()];
        
        for (const m of allSubjects) {
            // Check existence by code
            const [existing] = await connection.execute('SELECT id_mapel FROM mapel WHERE kode_mapel = ?', [m.code]);
            if (existing.length === 0) {
                const [res] = await connection.execute(
                    'INSERT INTO mapel (kode_mapel, nama_mapel, deskripsi, status) VALUES (?, ?, ?, ?)', 
                    [m.code, m.name, `Mata Pelajaran ${m.name}`, 'aktif']
                );
                mapelIds.push(res.insertId);
            } else {
                mapelIds.push(existing[0].id_mapel);
            }
        }
        console.log(`   Processed ${allSubjects.length} subjects.`);

        // 2. Generate CLASSES (Table: kelas)
        console.log('🏫 Generating Classes (kelas)...');
        const classIds = [];
        for (const t of TINGKAT) {
            for (const j of JURUSAN) {
                for (const r of ROMBEL) {
                    const className = `${t} ${j} ${r}`;
                    const [existing] = await connection.execute('SELECT id_kelas FROM kelas WHERE nama_kelas = ?', [className]);
                    
                    let clsId;
                    if (existing.length === 0) {
                        const [res] = await connection.execute(
                            'INSERT INTO kelas (nama_kelas, tingkat, jumlah_siswa, status) VALUES (?, ?, 0, ?)',
                            [className, t, 'aktif']
                        );
                        clsId = res.insertId;
                    } else {
                        clsId = existing[0].id_kelas;
                    }
                    classIds.push({ id: clsId, name: className, jurusan: j });
                }
            }
        }
        console.log(`   Processed ${classIds.length} classes.`);

        // 3. Generate TEACHERS (Tables: users, guru)
        console.log('👨‍🏫 Generating Teachers (guru)...');
        const teacherIds = [];
        const passwordHash = await bcrypt.hash(GLOBAL_PASSWORD, saltRounds);
        
        // Generate 15 teachers
        for (let i = 0; i < 15; i++) {
            const name = generateName();
            const nip = `19${Math.floor(Math.random() * 80 + 10)}0101${Math.floor(Math.random() * 1000)}`;
            const username = `guru_${nip}`;
            
            // Check if user/guru exists
            const [existing] = await connection.execute('SELECT id FROM guru WHERE nip = ?', [nip]);
            if (existing.length > 0) {
                teacherIds.push(existing[0].id);
                continue;
            }

            // Create User (users table)
            const [userRes] = await connection.execute(
                'INSERT INTO users (username, password, role, nama, email, status) VALUES (?, ?, ?, ?, ?, ?)',
                [username, passwordHash, 'guru', name, `${username}@absenta.com`, 'aktif']
            );

            // Get next id_guru manually (as per schema logic)
            const [maxId] = await connection.execute('SELECT COALESCE(MAX(id_guru), 0) + 1 as next_id FROM guru');
            const nextGuruId = maxId[0].next_id;

            // Create Profile (guru table) - mapel_id should reference valid mapel
            const randomMapelId = getRandomElement(mapelIds);
            const [mapelData] = await connection.execute('SELECT nama_mapel FROM mapel WHERE id_mapel = ?', [randomMapelId]);
            const namaMapel = mapelData[0]?.nama_mapel || 'Umum';

            const [guruRes] = await connection.execute(
                `INSERT INTO guru (id_guru, user_id, username, nip, nama, mata_pelajaran, mapel_id, no_telp, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [nextGuruId, userRes.insertId, username, nip, name, namaMapel, randomMapelId, generatePhone(), 'aktif']
            );
            
            // id column in guru table is AI, but id_guru is manual. unique constraint on id_guru.
            // insertId returns the AI value (id).
            teacherIds.push(guruRes.insertId);
        }
        console.log(`   Ensured 15 teachers exist.`);

        // 4. Generate STUDENTS (Tables: users, siswa)
        console.log('🎓 Generating Students (siswa)...');
        for (const cls of classIds) {
            // Check current count
            const [countRes] = await connection.execute('SELECT COUNT(*) as cnt FROM siswa WHERE kelas_id = ?', [cls.id]);
            const currentCount = countRes[0].cnt;
            const target = 30;
            
            if (currentCount >= target) continue;

            const needed = target - currentCount;
            // Generate students one by one
            for (let i = 0; i < needed; i++) {
                const name = generateName();
                const nis = `2024${cls.id}${Math.floor(Math.random() * 9000 + 1000)}`;
                const username = `siswa_${nis}`;

                // Check duplicates (NIS or Username)
                const [check] = await connection.execute('SELECT id FROM siswa WHERE nis = ?', [nis]);
                const [checkUser] = await connection.execute('SELECT id FROM users WHERE username = ?', [username]);
                
                if (check.length > 0 || checkUser.length > 0) continue;

                // Create User
                const [userRes] = await connection.execute(
                    'INSERT INTO users (username, password, role, nama, email, status) VALUES (?, ?, ?, ?, ?, ?)',
                    [username, passwordHash, 'siswa', name, `${username}@student.com`, 'aktif']
                );

                // Get next id_siswa (manual logic like controller)
                const [maxId] = await connection.execute('SELECT COALESCE(MAX(id_siswa), 0) + 1 as next_id FROM siswa');
                const nextSiswaId = maxId[0].next_id;

                // Create Profile
                await connection.execute(
                    `INSERT INTO siswa (id, id_siswa, user_id, username, nis, nama, kelas_id, jenis_kelamin, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [nextSiswaId, nextSiswaId, userRes.insertId, username, nis, name, cls.id, Math.random() > 0.5 ? 'L' : 'P', 'aktif']
                );
            }
            
            // Update class count
            await connection.execute('UPDATE kelas SET jumlah_siswa = (SELECT COUNT(*) FROM siswa WHERE kelas_id = ?) WHERE id_kelas = ?', [cls.id, cls.id]);
            process.stdout.write('.');
        }
        console.log('\n   Students generation complete.');

        // 5. Generate SCHEDULE (Table: jadwal)
        console.log('📅 Generating Schedules (jadwal)...');
        const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
        const SESSIONS = [1, 2, 3, 4, 5, 6, 7, 8]; 
        
        for (const cls of classIds) {
            const [schedCount] = await connection.execute('SELECT COUNT(*) as cnt FROM jadwal WHERE kelas_id = ?', [cls.id]);
            if (schedCount[0].cnt > 0) continue;

            for (const day of DAYS) {
                // Fixed 8 sessions per day
                let currentTime = 7 * 60; // 07:00 in minutes
                
                for (const jam of SESSIONS) {
                    const startMin = currentTime;
                    const endMin = currentTime + 45; // 45 mins per session
                    currentTime = endMin;

                    const startTime = `${Math.floor(startMin/60).toString().padStart(2,'0')}:${(startMin%60).toString().padStart(2,'0')}:00`;
                    const endTime = `${Math.floor(endMin/60).toString().padStart(2,'0')}:${(endMin%60).toString().padStart(2,'0')}:00`;

                    const mapelId = getRandomElement(mapelIds);
                    const guruId = getRandomElement(teacherIds); // This refers to guru.id (AI)

                    await connection.execute(
                        `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif', 'pelajaran')`,
                        [cls.id, mapelId, guruId, day, jam, startTime, endTime]
                    );

                    // Also link in jadwal_guru (many-to-many)
                    // Need the inserted jadwal ID?
                    // Better to select MAX or do insert inside loop with result.
                    const [res] = await connection.execute('SELECT LAST_INSERT_ID() as id');
                    const jadwalId = res[0].id;
                    
                    await connection.execute(
                        `INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, 1)`,
                        [jadwalId, guruId]
                    );
                }
            }
        }
        console.log('   Schedules generated.');

        // 6. Generate ATTENDANCE (Table: absensi_siswa)
        console.log('📝 Generating Attendance History (absensi_siswa)...');
        const today = new Date();
        const dates = [];
        for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dayNum = d.getDay();
            if (dayNum !== 0 && dayNum !== 6) { 
                dates.push(d);
            }
        }
        
        const targetClasses = classIds.slice(0, 5); // Limit to 5 classes for speed
        const daysMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

        for (const cls of targetClasses) {
            const [students] = await connection.execute('SELECT id_siswa FROM siswa WHERE kelas_id = ?', [cls.id]);
            
            for (const date of dates) {
                const dateStr = date.toISOString().split('T')[0];
                const dayName = daysMap[date.getDay()];

                // Get first schedule of the day to simulate "Daily Attendance"
                // Or simply mark attendance regardless of schedule for now
                
                // Get valid schedules for this day
                const [schedules] = await connection.execute(
                    'SELECT id_jadwal, guru_id FROM jadwal WHERE kelas_id = ? AND hari = ? LIMIT 1', 
                    [cls.id, dayName]
                );
                
                // If no schedule, maybe skip?
                // Logic: absensi_siswa stores daily attendance often linked to first hour or NULL schedule.
                // Schema has jadwal_id DEFAULT NULL.
                
                const jadwalId = schedules.length > 0 ? schedules[0].id_jadwal : null;
                const guruId = schedules.length > 0 ? schedules[0].guru_id : null;

                if (!jadwalId) continue; // Skip if no school day

                for (const s of students) {
                     // Check existing
                     const [exist] = await connection.execute(
                         'SELECT id FROM absensi_siswa WHERE siswa_id = ? AND tanggal = ?',
                         [s.id_siswa, dateStr]
                     );
                     
                     if (exist.length > 0) continue;

                     // Determine status
                     const rand = Math.random();
                     let status = 'Hadir'; // ENUM values: 'Hadir','Izin','Sakit','Alpa','Dispen'
                     if (rand > 0.98) status = 'Alpa';
                     else if (rand > 0.95) status = 'Izin';
                     else if (rand > 0.90) status = 'Sakit';

                     const checkIn = status === 'Hadir' ? `${dateStr} 07:${Math.floor(Math.random()*59)}:00` : `${dateStr} 00:00:00`;

                     await connection.execute(
                         `INSERT INTO absensi_siswa (siswa_id, jadwal_id, tanggal, waktu_absen, status, guru_id, guru_pengabsen_id, terlambat)
                          VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
                         [s.id_siswa, jadwalId, dateStr, checkIn, status, guruId, guruId]
                     );
                }
            }
            process.stdout.write('.');
        }
        console.log('\n   Attendance generated.');
        console.log('✅ DONE! Dummy data generation finished.');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        if (connection) await connection.end();
    }
}

main();
