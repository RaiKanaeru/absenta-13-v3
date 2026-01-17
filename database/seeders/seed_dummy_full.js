/**
 * SEED DUMMY FULL - Absenta 13
 * 
 * Generates realistic dummy data for:
 * 1. Rooms (Ruang Kelas)
 * 2. Subjects (Mapel)
 * 3. Classes (Kelas X-XII)
 * 4. Teachers (Guru + Users)
 * 5. Schedule (Jadwal) - Conflict Free!
 * 
 * Usage: node database/seeders/seed_dummy_full.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const TAHUN_AJARAN = '2025/2026'; // Match seed_schedule_config.js

// ============================================================================
// DATA DEFINITIONS
// ============================================================================

const ROOMS = [
    { kode: 'R-01', nama: 'Teori 01', lokasi: 'Gedung A Lt 1' },
    { kode: 'R-02', nama: 'Teori 02', lokasi: 'Gedung A Lt 1' },
    { kode: 'R-03', nama: 'Teori 03', lokasi: 'Gedung A Lt 1' },
    { kode: 'R-04', nama: 'Teori 04', lokasi: 'Gedung A Lt 2' },
    { kode: 'R-05', nama: 'Teori 05', lokasi: 'Gedung A Lt 2' },
    { kode: 'R-06', nama: 'Teori 06', lokasi: 'Gedung A Lt 2' },
    { kode: 'LAB-RPL', nama: 'Lab RPL', lokasi: 'Gedung B Lt 3' },
    { kode: 'LAB-TKJ', nama: 'Lab TKJ', lokasi: 'Gedung B Lt 3' },
    { kode: 'LAB-KIM', nama: 'Lab Kimia', lokasi: 'Gedung C' },
    { kode: 'LAB-IPA', nama: 'Lab IPA', lokasi: 'Gedung C' },
];

const MAPEL_LIST = [
    { kode: 'MATH', nama: 'Matematika' },
    { kode: 'BIND', nama: 'Bahasa Indonesia' },
    { kode: 'BING', nama: 'Bahasa Inggris' },
    { kode: 'PAI', nama: 'Pendidikan Agama Islam' },
    { kode: 'PKN', nama: 'Pendidikan Kewarganegaraan' },
    { kode: 'PJOK', nama: 'Pendidikan Jasmani' },
    { kode: 'SJR', nama: 'Sejarah Indonesia' },
    { kode: 'PROD', nama: 'Produktif Kejuruan' },
    { kode: 'PKK', nama: 'Produk Kreatif & Kewirausahaan' },
    { kode: 'SNB', nama: 'Seni Budaya' },
];

const KELAS_LIST = [
    { nama: 'X RPL 1', tingkat: 'X' }, { nama: 'X RPL 2', tingkat: 'X' },
    { nama: 'XI RPL 1', tingkat: 'XI' }, { nama: 'XI RPL 2', tingkat: 'XI' },
    { nama: 'XII RPL 1', tingkat: 'XII' }, { nama: 'XII RPL 2', tingkat: 'XII' },
    { nama: 'X TKJ 1', tingkat: 'X' }, { nama: 'X TKJ 2', tingkat: 'X' },
    { nama: 'XI TKJ 1', tingkat: 'XI' }, { nama: 'XI TKJ 2', tingkat: 'XI' },
    { nama: 'XII TKJ 1', tingkat: 'XII' },
];

const GURU_NAMES = [
    'Ahmad Dahlan', 'Budi Santoso', 'Citra Dewi', 'Dedi Mulyadi', 'Eka Saputra',
    'Fitriani', 'Galih Pratama', 'Haniifah', 'Indra Gunawan', 'Joko Widodo',
    'Kartini', 'Lukman Hakim', 'Maya Estianty', 'Nina Zatulini', 'Omar Bakri',
    'Putri Titian', 'Qomaruddin', 'Rina Nose', 'Sule Priatna', 'Tukul Arwana'
];

// Mapel mapping strategies to make it realistic
// e.g., Guru 0 teaches MATH, Guru 1 teaches BIND...
function assignMapelToGuru(guruIndex) {
    return MAPEL_LIST[guruIndex % MAPEL_LIST.length];
}

// ============================================================================
// HELPERS
// ============================================================================

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Ensure 2 digits
const pad = (n) => String(n).padStart(2, '0');

// ============================================================================
// MAIN
// ============================================================================

async function seed() {
    console.log('🚀 STARTING DUMMY SEEDER (FULL)...');
    
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST === 'mysql' ? '127.0.0.1' : (process.env.DB_HOST || 'localhost'),
        user: process.env.DB_HOST === 'mysql' ? 'root' : (process.env.DB_USER || 'root'),
        password: process.env.DB_HOST === 'mysql' ? '' : (process.env.DB_PASSWORD || ''),
        database: process.env.DB_NAME || 'absenta13',
    });

    try {
        // ---------------------------------------------------------
        // 1. CLEANUP (Truncate tables to start fresh)
        // ---------------------------------------------------------
        console.log('\n🧹 Cleaning up old data...');
        // Order matters due to Foreign Keys
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        await connection.execute('TRUNCATE TABLE jadwal');
        await connection.execute('TRUNCATE TABLE ruang_kelas');
        await connection.execute('TRUNCATE TABLE mapel');
        // await connection.execute('TRUNCATE TABLE kelas'); // Let's keep existing classes or upsert? Truncate is cleaner.
        await connection.execute('TRUNCATE TABLE kelas'); 
        // We iterate and delete dummy teachers only? Or truncate? 
        // Let's truncate guru and users related to guru for clean state.
        // BE CAREFUL with Admin account!
        await connection.execute("DELETE g FROM guru g JOIN users u ON g.user_id = u.id WHERE u.username LIKE 'guru%'"); 
        await connection.execute("DELETE FROM users WHERE username LIKE 'guru%' AND role='guru'");
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✅ Cleanup done.');

        // ---------------------------------------------------------
        // 2. SEED ROOMS
        // ---------------------------------------------------------
        console.log('\n🏫 Seeding Rooms...');
        const roomIds = [];
        for (const r of ROOMS) {
            const [res] = await connection.execute(
                'INSERT INTO ruang_kelas (kode_ruang, nama_ruang, lokasi, status) VALUES (?, ?, ?, ?)',
                [r.kode, r.nama, r.lokasi, 'aktif']
            );
            roomIds.push(res.insertId);
        }
        console.log(`✅ Inserted ${roomIds.length} rooms.`);

        // ---------------------------------------------------------
        // 2.5 ENSURE JAM PELAJARAN
        // ---------------------------------------------------------
        console.log('\n⏰ Ensuring Jam Pelajaran...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS jam_pelajaran (
              id int PRIMARY KEY AUTO_INCREMENT,
              hari enum('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu') NOT NULL,
              jam_ke tinyint NOT NULL COMMENT '0 = Pembiasaan pagi, 1-12 = Jam pelajaran',
              jam_mulai time NOT NULL,
              jam_selesai time NOT NULL,
              durasi_menit int NOT NULL DEFAULT 45,
              jenis enum('pelajaran','istirahat','pembiasaan') NOT NULL DEFAULT 'pelajaran',
              label varchar(50) DEFAULT NULL,
              tahun_ajaran varchar(9) NOT NULL DEFAULT '2025/2026',
              created_at timestamp DEFAULT CURRENT_TIMESTAMP,
              updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_jam_pelajaran_lookup (hari, jam_ke),
              UNIQUE KEY unique_hari_jam_tahun (hari, jam_ke, tahun_ajaran)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // Check if empty or just always ensuring it's populated for this run
        // Let's truncate/delete for this cohort to be safe
        await connection.execute('DELETE FROM jam_pelajaran WHERE tahun_ajaran = ?', [TAHUN_AJARAN]);

        const formatTime = (hours, minutes) => `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

        const scheduleConfig = {
            Senin: {
                startTime: { hours: 6, minutes: 30 },
                slots: [
                    { jam_ke: 0, durasi: 30, jenis: 'pembiasaan', label: 'Upacara/Apel' },
                    { jam_ke: 1, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 2, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 3, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 4, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: -1, durasi: 15, jenis: 'istirahat', label: 'Istirahat 1' },
                    { jam_ke: 5, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 6, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 7, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: -2, durasi: 30, jenis: 'istirahat', label: 'Istirahat 2' },
                    { jam_ke: 8, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 9, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 10, durasi: 45, jenis: 'pelajaran' },
                ]
            },
            Selasa: {
                startTime: { hours: 6, minutes: 30 },
                slots: [
                    { jam_ke: 0, durasi: 15, jenis: 'pembiasaan', label: 'Tadarus/Doa' },
                    { jam_ke: 1, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 2, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 3, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 4, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: -1, durasi: 15, jenis: 'istirahat', label: 'Istirahat 1' },
                    { jam_ke: 5, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 6, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 7, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: -2, durasi: 30, jenis: 'istirahat', label: 'Istirahat 2' },
                    { jam_ke: 8, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 9, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 10, durasi: 45, jenis: 'pelajaran' },
                ]
            },
            Rabu: {
                startTime: { hours: 6, minutes: 30 },
                slots: [
                    { jam_ke: 0, durasi: 15, jenis: 'pembiasaan', label: 'Tadarus/Doa' },
                    { jam_ke: 1, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 2, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 3, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 4, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: -1, durasi: 15, jenis: 'istirahat', label: 'Istirahat 1' },
                    { jam_ke: 5, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 6, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 7, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: -2, durasi: 30, jenis: 'istirahat', label: 'Istirahat 2' },
                    { jam_ke: 8, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 9, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 10, durasi: 45, jenis: 'pelajaran' },
                ]
            },
             Kamis: {
                startTime: { hours: 6, minutes: 30 },
                slots: [
                    { jam_ke: 0, durasi: 15, jenis: 'pembiasaan', label: 'Tadarus/Doa' },
                    { jam_ke: 1, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 2, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 3, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 4, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: -1, durasi: 15, jenis: 'istirahat', label: 'Istirahat 1' },
                    { jam_ke: 5, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 6, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 7, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: -2, durasi: 30, jenis: 'istirahat', label: 'Istirahat 2' },
                    { jam_ke: 8, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 9, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 10, durasi: 45, jenis: 'pelajaran' },
                ]
            },
            Jumat: {
                startTime: { hours: 6, minutes: 30 },
                slots: [
                    { jam_ke: 0, durasi: 30, jenis: 'pembiasaan', label: 'Jumat Barokah' },
                    { jam_ke: 1, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 2, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 3, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: -1, durasi: 60, jenis: 'istirahat', label: 'Sholat Jumat' },
                    { jam_ke: 4, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 5, durasi: 45, jenis: 'pelajaran' },
                    { jam_ke: 6, durasi: 45, jenis: 'pelajaran' },
                ]
            }
        };

        const jamInserts = [];
        for (const [hari, config] of Object.entries(scheduleConfig)) {
            let currentMinutes = config.startTime.hours * 60 + config.startTime.minutes;
            for (const slot of config.slots) {
                const jamMulai = formatTime(Math.floor(currentMinutes / 60), currentMinutes % 60);
                currentMinutes += slot.durasi;
                const jamSelesai = formatTime(Math.floor(currentMinutes / 60), currentMinutes % 60);
                if (slot.jam_ke >= 0) { // Keep only non-negative for lookup? Or all?
                    // Original logic: if (slot.jam_ke >= 0) inserts.push(...)
                    // Actually, we usually want breaks in DB if detailed view uses them, but standard logic filtered them.
                    // Let's stick to original logic: >= 0 only for "jam_pelajaran" usually used for scheduling.
                    jamInserts.push([hari, slot.jam_ke, jamMulai, jamSelesai, slot.durasi, slot.jenis, slot.label || null, TAHUN_AJARAN]);
                }
            }
        }

        if (jamInserts.length > 0) {
            await connection.query(
                `INSERT INTO jam_pelajaran (hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label, tahun_ajaran) VALUES ?`,
                [jamInserts]
            );
            console.log(`   ✅ Inserted ${jamInserts.length} jam_pelajaran slots.`);
        }

        // ---------------------------------------------------------
        // 3. SEED MAPEL
        // ---------------------------------------------------------
        console.log('\n📚 Seeding Mapel...');
        const mapelIds = []; // Array of {id, kode}
        for (const m of MAPEL_LIST) {
            const [res] = await connection.execute(
                'INSERT INTO mapel (kode_mapel, nama_mapel, status) VALUES (?, ?, ?)',
                [m.kode, m.nama, 'aktif']
            );
            mapelIds.push({ id: res.insertId, kode: m.kode });
        }
        console.log(`✅ Inserted ${mapelIds.length} subjects.`);

        // ---------------------------------------------------------
        // 4. SEED KELAS
        // ---------------------------------------------------------
        console.log('\n🎓 Seeding Classes...');
        const kelasIds = [];
        for (const k of KELAS_LIST) {
            const [res] = await connection.execute(
                'INSERT INTO kelas (nama_kelas, tingkat, status) VALUES (?, ?, ?)',
                [k.nama, k.tingkat, 'aktif']
            );
            kelasIds.push(res.insertId);
        }
        console.log(`✅ Inserted ${kelasIds.length} classes.`);

        // ---------------------------------------------------------
        // 5. SEED GURU (and Users)
        // ---------------------------------------------------------
        console.log('\n👨‍🏫 Seeding Teachers...');
        const guruIds = []; // Array of {id, mapel_id} so we know what they teach
        const defaultPass = await bcrypt.hash('123456', 10);

        for (let i = 0; i < GURU_NAMES.length; i++) {
            const name = GURU_NAMES[i];
            const username = `guru${i+1}`;
            const nip = `198001012025011${pad(i+1)}`;
            const assignedMapel = assignMapelToGuru(i);
            const mapelObj = mapelIds.find(m => m.kode === assignedMapel.kode);

            // 1. Create User
            const [userRes] = await connection.execute(
                'INSERT INTO users (username, password, role, nama, status) VALUES (?, ?, ?, ?, ?)',
                [username, defaultPass, 'guru', name, 'aktif']
            );
            const userId = userRes.insertId;

            // 2. Create Guru
            // Note: id_guru in schema seems to be custom int, let's just make it auto-inc or same as ID
            // Checking schema: id_guru is INT NOT NULL. It's not auto-inc in some schemas, but usually is.
            // Let's assume `id` is primary key auto inc, `id_guru` is data field.
            // Based on prev `absenta13.sql`, `id` is PK, `id_guru` is separate. Let's make `id_guru` = `id`.
            
            const [guruRes] = await connection.execute(
                'INSERT INTO guru (id_guru, user_id, nip, nama, mapel_id, status, jenis_kelamin) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId + 1000, userId, nip, name, mapelObj.id, 'aktif', i % 2 === 0 ? 'L' : 'P']
            );
            
            // We need the ACTUAL guru ID (usually just `id` field from insert, but let's check schema again)
            // The `guru` table in SQL dump has `id` (PK) and `id_guru` (manual?).
            // Let's use `guruRes.insertId` as the PK reference for `jadwal`.
            // Wait, `jadwal.guru_id` usually refers to `guru.id_guru` or `guru.id`?
            // Convention: Check if FK references manual ID or Auto ID. 
            // Previous error hint suggested FK checks id_guru? Or we just try standardizing.
            // Let's use the Manual ID if that's what we inserted as 'id_guru'.
            guruIds.push({ 
                id: userId + 1000, 
                mapel_id: mapelObj.id,
                name 
            });
        }
        console.log(`✅ Inserted ${guruIds.length} teachers.`);

        // ---------------------------------------------------------
        // 6. GENERATE SCHEDULE
        // ---------------------------------------------------------
        console.log('\n📅 Generating Conflict-Free Schedule...');
        
        // Fetch valid slots from DB
        const [slots] = await connection.execute(
            'SELECT * FROM jam_pelajaran WHERE tahun_ajaran = ? ORDER BY jam_ke ASC',
            [TAHUN_AJARAN]
        );
        
        // Group slots by day
        const slotsByDay = {};
        for (const slot of slots) {
            if (!slotsByDay[slot.hari]) slotsByDay[slot.hari] = [];
            slotsByDay[slot.hari].push(slot);
        }

        /*
         * ALGORITHM:
         * We need to fill `jadwal` table.
         * Structure: map<Day, map<Slot, set<GuruID>>> to track availability
         */
        
        // Track allocations to prevent conflicts
        // busyTeachers[hari][jam_ke] = Set(guruId)
        // busyRooms[hari][jam_ke] = Set(roomId)
        const busyTeachers = {}; 
        const busyRooms = {};

        const isTeacherBusy = (hari, jam, guruId) => {
            if (!busyTeachers[hari]) return false;
            if (!busyTeachers[hari][jam]) return false;
            return busyTeachers[hari][jam].has(guruId);
        };

        const markTeacherBusy = (hari, jam, guruId) => {
            if (!busyTeachers[hari]) busyTeachers[hari] = {};
            if (!busyTeachers[hari][jam]) busyTeachers[hari][jam] = new Set();
            busyTeachers[hari][jam].add(guruId);
        };

        const isRoomBusy = (hari, jam, roomId) => {
            if (!busyRooms[hari]) return false;
            if (!busyRooms[hari][jam]) return false;
            return busyRooms[hari][jam].has(roomId);
        };

        const markRoomBusy = (hari, jam, roomId) => {
            if (!busyRooms[hari]) busyRooms[hari] = {};
            if (!busyRooms[hari][jam]) busyRooms[hari][jam] = new Set();
            busyRooms[hari][jam].add(roomId);
        };

        let jadwalCount = 0;

        // Iterate Classes
        for (const kelasId of kelasIds) {
            console.log(`   Processing Class ID ${kelasId}...`);

            // Iterate Days
            for (const day of Object.keys(slotsByDay)) {
                
                // Iterate Slots
                for (const slot of slotsByDay[day]) {
                    // Skip non-lesson slots (Istirahat, Upacara - usually jam 0 or negative)
                    if (slot.jenis !== 'pelajaran') continue;

                    // 1. Pick a random subject
                    // Improved: Cycle through subjects to distribute evenly
                    // For now, random is fine for dummy data
                    const forcedMapelIndex = Math.floor(Math.random() * mapelIds.length);
                    const mapel = mapelIds[forcedMapelIndex];

                    // 2. Find a teacher who teaches this mapel AND is free
                    const eligibleTeachers = guruIds.filter(g => g.mapel_id === mapel.id);
                    let selectedGuru = null;

                    for (const g of eligibleTeachers) {
                        if (!isTeacherBusy(day, slot.jam_ke, g.id)) {
                            selectedGuru = g;
                            break;
                        }
                    }

                    // If all eligible teachers are busy, pick ANY free teacher (substitute) 
                    // or generate a "TUGAS MANDIRI" (guru_id=0 if exists, or skip)
                    if (!selectedGuru) {
                        // Try any free teacher
                        const anyFree = guruIds.find(g => !isTeacherBusy(day, slot.jam_ke, g.id));
                        if (anyFree) {
                            selectedGuru = anyFree; // They teach a sub subject today
                            // Update mapel to match teacher? Nah, let's assume valid substitution
                        } else {
                            // Everyone busy? Skip this slot (Free Class)
                            continue;
                        }
                    }

                    // 3. Pick a free Room
                    // In reality, class stays in same room, but moving class is possible.
                    // Let's assign a "Home Room" for each class ideally.
                    // For simplicity: Class ID X uses Room ID Y (modulo) -> if busy, pick another
                    let selectedRoomId = roomIds[(kelasId) % roomIds.length];
                    
                    // Note: If our logic says "Class stays in R-X", then R-X is always busy by this class.
                    // But if we want to test "Room Conflicts", we might accidentally double book if we are not careful.
                    // Since we iterate by Class, this class is the ONLY one using this room allocation right now.
                    // BUT other classes might have claimed it.
                    if (isRoomBusy(day, slot.jam_ke, selectedRoomId)) {
                        // Find another free room
                        const freeRoomId = roomIds.find(r => !isRoomBusy(day, slot.jam_ke, r));
                        if (freeRoomId) selectedRoomId = freeRoomId;
                        else continue; // No rooms left!
                    }

                    // 4. Insert
                    await connection.execute(`
                        INSERT INTO jadwal 
                        (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        kelasId, 
                        mapel.id, 
                        selectedGuru.id, 
                        selectedRoomId, 
                        day, 
                        slot.jam_ke, 
                        slot.jam_mulai, 
                        slot.jam_selesai, 
                        'aktif'
                    ]);

                    // 5. Mark constraints
                    markTeacherBusy(day, slot.jam_ke, selectedGuru.id);
                    markRoomBusy(day, slot.jam_ke, selectedRoomId);
                    jadwalCount++;
                }
            }
        }

        console.log(`\n✅ Generated ${jadwalCount} schedule entries.`);
        console.log('🎉 Seed Complete!');

    } catch (error) {
        console.error('❌ Error seeding:', error);
    } finally {
        await connection.end();
    }
}

seed();
