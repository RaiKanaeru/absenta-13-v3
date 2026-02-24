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
 * 
 * Refactored: Reduced cognitive complexity from 72 to <15 per function
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

dotenv.config();

// ============================================
// CONFIGURATION
// ============================================

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'absenta13',
    port: Number.parseInt(process.env.DB_PORT) || 3306
};

const saltRounds = 10;
const DEFAULT_TEACHER_PASSWORD = process.env.DEFAULT_TEACHER_PASSWORD || 'password123';
const DEFAULT_STUDENT_PASSWORD = process.env.DEFAULT_STUDENT_PASSWORD || 'password123';

// ============================================
// DATA CONSTANTS
// ============================================

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
};

const NAMES_FIRST = ['Ahmad', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko', 'Kartika', 'Lina', 'Muhammad', 'Nur', 'Putri', 'Rizky', 'Siti', 'Tono', 'Umar', 'Vina', 'Wahyu', 'Yulia', 'Zainal'];
const NAMES_LAST = ['Saputra', 'Wijaya', 'Lestari', 'Santoso', 'Pratama', 'Hidayat', 'Kusuma', 'Sari', 'Nugraha', 'Wibowo', 'Ramadhan', 'Utami', 'Firmansyah', 'Permata', 'Setiawan', 'Anwar', 'Susanti'];

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const SESSIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const DAYS_MAP = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateName() {
    return `${getRandomElement(NAMES_FIRST)} ${getRandomElement(NAMES_LAST)}`;
}

function generatePhone() {
    return `08${Math.floor(Math.random() * 10000000000)}`;
}

function generateNIP() {
    return `19${Math.floor(Math.random() * 80 + 10)}0101${Math.floor(Math.random() * 1000)}`;
}

function generateNIS(classId) {
    return `2024${classId}${Math.floor(Math.random() * 9000 + 1000)}`;
}

function formatTime(minutes) {
    const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
    const mins = (minutes % 60).toString().padStart(2, '0');
    return `${hours}:${mins}:00`;
}

function getWeekdaysLast30Days() {
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
    return dates;
}

function determineAttendanceStatus() {
    const rand = Math.random();
    if (rand > 0.98) return 'Alpa';
    if (rand > 0.95) return 'Izin';
    if (rand > 0.9) return 'Sakit';
    return 'Hadir';
}

// ============================================
// DATA GENERATION FUNCTIONS
// ============================================

/**
 * Generate subject data (mapel)
 */
async function generateMapel(connection) {
    console.log('Generating Subjects (mapel)...');
    const mapelIds = [];
    const allSubjects = [...MAPEL_UMUM, ...Object.values(MAPEL_KEJURUAN).flat()];

    for (const m of allSubjects) {
        const [existing] = await connection.execute(
            'SELECT id_mapel FROM mapel WHERE kode_mapel = ?', 
            [m.code]
        );
        
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
    return mapelIds;
}

/**
 * Generate class data (kelas)
 */
async function generateClasses(connection) {
    console.log('Generating Classes (kelas)...');
    const classIds = [];

    for (const tingkat of TINGKAT) {
        for (const jurusan of JURUSAN) {
            for (const rombel of ROMBEL) {
                const className = `${tingkat} ${jurusan} ${rombel}`;
                const [existing] = await connection.execute(
                    'SELECT id_kelas FROM kelas WHERE nama_kelas = ?', 
                    [className]
                );

                let clsId;
                if (existing.length === 0) {
                    const [res] = await connection.execute(
                        'INSERT INTO kelas (nama_kelas, tingkat, jumlah_siswa, status) VALUES (?, ?, 0, ?)',
                        [className, tingkat, 'aktif']
                    );
                    clsId = res.insertId;
                } else {
                    clsId = existing[0].id_kelas;
                }
                classIds.push({ id: clsId, name: className, jurusan });
            }
        }
    }

    console.log(`   Processed ${classIds.length} classes.`);
    return classIds;
}

/**
 * Create a single teacher record
 */
async function createTeacher(connection, passwordHash, mapelIds) {
    const name = generateName();
    const nip = generateNIP();
    const username = `guru_${nip}`;

    // Check if exists
    const [existing] = await connection.execute(
        'SELECT id_guru FROM guru WHERE nip = ?', 
        [nip]
    );
    if (existing.length > 0) {
        return existing[0].id_guru;
    }

    // Create User
    const [userRes] = await connection.execute(
        'INSERT INTO users (username, password, role, nama, email, status) VALUES (?, ?, ?, ?, ?, ?)',
        [username, passwordHash, 'guru', name, `${username}@absenta.com`, 'aktif']
    );

    // Get next id_guru
    const [maxId] = await connection.execute(
        'SELECT COALESCE(MAX(id_guru), 0) + 1 as next_id FROM guru'
    );
    const nextGuruId = maxId[0].next_id;

    // Get random mapel
    const randomMapelId = getRandomElement(mapelIds);
    const [mapelData] = await connection.execute(
        'SELECT nama_mapel FROM mapel WHERE id_mapel = ?', 
        [randomMapelId]
    );
    const namaMapel = mapelData[0]?.nama_mapel || 'Umum';

    // Create guru profile
    await connection.execute(
        `INSERT INTO guru (id_guru, user_id, username, nip, nama, mata_pelajaran, mapel_id, no_telp, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nextGuruId, userRes.insertId, username, nip, name, namaMapel, randomMapelId, generatePhone(), 'aktif']
    );

    return nextGuruId;
}

/**
 * Generate teacher data (guru)
 */
async function generateTeachers(connection, mapelIds, count = 15) {
    console.log('Generating Teachers (guru)...');
    const teacherIds = [];
    const passwordHash = await bcrypt.hash(DEFAULT_TEACHER_PASSWORD, saltRounds);

    for (let i = 0; i < count; i++) {
        const teacherId = await createTeacher(connection, passwordHash, mapelIds);
        teacherIds.push(teacherId);
    }

    console.log(`   Ensured ${count} teachers exist.`);
    return { teacherIds };
}

/**
 * Create a single student record
 */
async function createStudent(connection, cls, passwordHash) {
    const name = generateName();
    const nis = generateNIS(cls.id);
    const username = `siswa_${nis}`;

    // Check duplicates
    const [checkNIS] = await connection.execute(
        'SELECT id FROM siswa WHERE nis = ?', 
        [nis]
    );
    const [checkUser] = await connection.execute(
        'SELECT id FROM users WHERE username = ?', 
        [username]
    );
    if (checkNIS.length > 0 || checkUser.length > 0) return false;

    // Create User
    const [userRes] = await connection.execute(
        'INSERT INTO users (username, password, role, nama, email, status) VALUES (?, ?, ?, ?, ?, ?)',
        [username, passwordHash, 'siswa', name, `${username}@student.com`, 'aktif']
    );

    // Get next id_siswa
    const [maxId] = await connection.execute(
        'SELECT COALESCE(MAX(id_siswa), 0) + 1 as next_id FROM siswa'
    );
    const nextSiswaId = maxId[0].next_id;

    // Create siswa profile
    await connection.execute(
        `INSERT INTO siswa (id_siswa, user_id, username, nis, nama, kelas_id, jenis_kelamin, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nextSiswaId, userRes.insertId, username, nis, name, cls.id, Math.random() > 0.5 ? 'L' : 'P', 'aktif']
    );

    return true;
}

/**
 * Generate students for a single class
 */
async function generateStudentsForClass(connection, cls, passwordHash, target = 30) {
    const [countRes] = await connection.execute(
        'SELECT COUNT(*) as cnt FROM siswa WHERE kelas_id = ?', 
        [cls.id]
    );
    const currentCount = countRes[0].cnt;
    if (currentCount >= target) return;

    const needed = target - currentCount;
    for (let i = 0; i < needed; i++) {
        await createStudent(connection, cls, passwordHash);
    }

    // Update class count
    await connection.execute(
        'UPDATE kelas SET jumlah_siswa = (SELECT COUNT(*) FROM siswa WHERE kelas_id = ?) WHERE id_kelas = ?',
        [cls.id, cls.id]
    );
    process.stdout.write('.');
}

/**
 * Generate all students (siswa)
 */
async function generateStudents(connection, classIds, passwordHash) {
    console.log('Generating Students (siswa)...');
    
    for (const cls of classIds) {
        await generateStudentsForClass(connection, cls, passwordHash);
    }
    
    console.log('\n   Students generation complete.');
}

/**
 * Generate schedule for a single day of a class
 */
async function generateScheduleForDay(connection, cls, day, mapelIds, teacherIds) {
    let currentTime = 7 * 60; // 07:00 in minutes

    for (const jam of SESSIONS) {
        const startMin = currentTime;
        const endMin = currentTime + 45;
        currentTime = endMin;

        const startTime = formatTime(startMin);
        const endTime = formatTime(endMin);
        const mapelId = getRandomElement(mapelIds);
        const guruId = getRandomElement(teacherIds);

        await connection.execute(
            `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif', 'pelajaran')`,
            [cls.id, mapelId, guruId, day, jam, startTime, endTime]
        );

        // Link in jadwal_guru
        const [res] = await connection.execute('SELECT LAST_INSERT_ID() as id');
        const jadwalId = res[0].id;

        await connection.execute(
            `INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, 1)`,
            [jadwalId, guruId]
        );
    }
}

/**
 * Generate schedules for all classes (jadwal)
 */
async function generateSchedules(connection, classIds, mapelIds, teacherIds) {
    console.log('Generating Schedules (jadwal)...');

    for (const cls of classIds) {
        const [schedCount] = await connection.execute(
            'SELECT COUNT(*) as cnt FROM jadwal WHERE kelas_id = ?', 
            [cls.id]
        );
        if (schedCount[0].cnt > 0) continue;

        for (const day of DAYS) {
            await generateScheduleForDay(connection, cls, day, mapelIds, teacherIds);
        }
    }

    console.log('   Schedules generated.');
}

/**
 * Generate attendance for a student on a date
 */
async function createAttendanceRecord(connection, student, dateStr, jadwalId, guruId) {
    // Check existing
    const [exist] = await connection.execute(
        'SELECT id FROM absensi_siswa WHERE siswa_id = ? AND tanggal = ?',
        [student.id_siswa, dateStr]
    );
    if (exist.length > 0) return;

    // Determine status
    const status = determineAttendanceStatus();
    const checkIn = status === 'Hadir'
        ? `${dateStr} 07:${Math.floor(Math.random() * 59)}:00`
        : `${dateStr} 00:00:00`;

    await connection.execute(
        `INSERT INTO absensi_siswa (siswa_id, jadwal_id, tanggal, waktu_absen, status, guru_id, guru_pengabsen_id, terlambat)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [student.id_siswa, jadwalId, dateStr, checkIn, status, guruId, guruId]
    );
}

/**
 * Generate attendance for a class on a date
 */
async function generateAttendanceForClassDate(connection, cls, date) {
    const dateStr = date.toISOString().split('T')[0];
    const dayName = DAYS_MAP[date.getDay()];

    // Get schedule for this day
    const [schedules] = await connection.execute(
        'SELECT id_jadwal, guru_id FROM jadwal WHERE kelas_id = ? AND hari = ? LIMIT 1',
        [cls.id, dayName]
    );
    if (schedules.length === 0) return;

    const jadwalId = schedules[0].id_jadwal;
    const guruId = schedules[0].guru_id;

    // Get students
    const [students] = await connection.execute(
        'SELECT id_siswa FROM siswa WHERE kelas_id = ?', 
        [cls.id]
    );

    for (const student of students) {
        await createAttendanceRecord(connection, student, dateStr, jadwalId, guruId);
    }
}

/**
 * Generate attendance history (absensi_siswa)
 */
async function generateAttendance(connection, classIds) {
    console.log('Generating Attendance History (absensi_siswa)...');
    
    const dates = getWeekdaysLast30Days();
    const targetClasses = classIds.slice(0, 5); // Limit to 5 classes for speed

    for (const cls of targetClasses) {
        for (const date of dates) {
            await generateAttendanceForClassDate(connection, cls, date);
        }
        process.stdout.write('.');
    }

    console.log('\n   Attendance generated.');
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================

console.log('Starting Dummy Data Generation...');
console.log(`Connecting to DB: ${config.user}@${config.host}:${config.port}/${config.database}`);

let connection;
try {
    connection = await mysql.createConnection(config);
    console.log('Connected to database');

    // Step 1: Generate Mapel
    const mapelIds = await generateMapel(connection);

    // Step 2: Generate Classes
    const classIds = await generateClasses(connection);

    // Step 3: Generate Teachers
    const { teacherIds } = await generateTeachers(connection, mapelIds);

    // Step 4: Generate Students
    const studentPasswordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, saltRounds);
    await generateStudents(connection, classIds, studentPasswordHash);

    // Step 5: Generate Schedules
    await generateSchedules(connection, classIds, mapelIds, teacherIds);

    // Step 6: Generate Attendance
    await generateAttendance(connection, classIds);

    console.log('DONE! Dummy data generation finished.');

} catch (err) {
    console.error('Error:', err);
} finally {
    if (connection) await connection.end();
}
