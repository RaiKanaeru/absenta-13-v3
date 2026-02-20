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
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const formatTime = (hours, minutes) => `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

async function cleanupTables(connection) {
    console.log('\n[CLEAN] Cleaning up old data...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('TRUNCATE TABLE jadwal');
    await connection.execute('TRUNCATE TABLE ruang_kelas');
    await connection.execute('TRUNCATE TABLE mapel');
    await connection.execute('TRUNCATE TABLE kelas');
    await connection.execute("DELETE g FROM guru g JOIN users u ON g.user_id = u.id WHERE u.username LIKE 'guru%'");
    await connection.execute("DELETE FROM users WHERE username LIKE 'guru%' AND role='guru'");
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[OK] Cleanup done.');
}

async function seedRooms(connection, roomData) {
    console.log('\n[SCHOOL] Seeding Rooms...');
    const roomIds = [];
    for (const r of roomData) {
        const [res] = await connection.execute(
            'INSERT INTO ruang_kelas (kode_ruang, nama_ruang, lokasi, status) VALUES (?, ?, ?, ?)',
            [r.kode, r.nama, r.lokasi, 'aktif']
        );
        roomIds.push(res.insertId);
    }
    console.log(`[OK] Inserted ${roomIds.length} rooms.`);
    return roomIds;
}

function getScheduleConfig() {
    return {
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
}

function buildJamPelajaranInserts(scheduleConfig) {
    const jamInserts = [];
    for (const [hari, config] of Object.entries(scheduleConfig)) {
        let currentMinutes = config.startTime.hours * 60 + config.startTime.minutes;
        for (const slot of config.slots) {
            const jamMulai = formatTime(Math.floor(currentMinutes / 60), currentMinutes % 60);
            currentMinutes += slot.durasi;
            const jamSelesai = formatTime(Math.floor(currentMinutes / 60), currentMinutes % 60);
            if (slot.jam_ke >= 0) {
                jamInserts.push([hari, slot.jam_ke, jamMulai, jamSelesai, slot.durasi, slot.jenis, slot.label || null, TAHUN_AJARAN]);
            }
        }
    }
    return jamInserts;
}

async function ensureJamPelajaran(connection) {
    console.log('\n[TIME] Ensuring Jam Pelajaran...');
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
    await connection.execute('DELETE FROM jam_pelajaran WHERE tahun_ajaran = ?', [TAHUN_AJARAN]);

    const scheduleConfig = getScheduleConfig();
    const jamInserts = buildJamPelajaranInserts(scheduleConfig);

    if (jamInserts.length > 0) {
        await connection.query(
            'INSERT INTO jam_pelajaran (hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label, tahun_ajaran) VALUES ?',
            [jamInserts]
        );
        console.log(`   [OK] Inserted ${jamInserts.length} jam_pelajaran slots.`);
    }
}

async function seedMapel(connection, mapelData) {
    console.log('\n[BOOKS] Seeding Mapel...');
    const mapelIds = [];
    for (const m of mapelData) {
        const [res] = await connection.execute(
            'INSERT INTO mapel (kode_mapel, nama_mapel, status) VALUES (?, ?, ?)',
            [m.kode, m.nama, 'aktif']
        );
        mapelIds.push({ id: res.insertId, kode: m.kode });
    }
    console.log(`[OK] Inserted ${mapelIds.length} subjects.`);
    return mapelIds;
}

async function seedKelas(connection, kelasData) {
    console.log('\n[STUDENTS] Seeding Classes...');
    const kelasIds = [];
    for (const k of kelasData) {
        const [res] = await connection.execute(
            'INSERT INTO kelas (nama_kelas, tingkat, status) VALUES (?, ?, ?)',
            [k.nama, k.tingkat, 'aktif']
        );
        kelasIds.push(res.insertId);
    }
    console.log(`[OK] Inserted ${kelasIds.length} classes.`);
    return kelasIds;
}

function getMapelByKode(mapelIds, kode) {
    return mapelIds.find((m) => m.kode === kode);
}

async function seedGuruAndUsers(connection, guruNames, mapelIds) {
    console.log('\n[TEACHERS] Seeding Teachers...');
    const guruIds = [];
    const defaultPass = await bcrypt.hash('123456', 10);

    for (let i = 0; i < guruNames.length; i += 1) {
        const name = guruNames[i];
        const username = `guru${i + 1}`;
        const nip = `198001012025011${pad(i + 1)}`;
        const assignedMapel = assignMapelToGuru(i);
        const mapelObj = getMapelByKode(mapelIds, assignedMapel.kode);

        const [userRes] = await connection.execute(
            'INSERT INTO users (username, password, role, nama, status) VALUES (?, ?, ?, ?, ?)',
            [username, defaultPass, 'guru', name, 'aktif']
        );
        const userId = userRes.insertId;

        await connection.execute(
            'INSERT INTO guru (id_guru, user_id, nip, nama, mapel_id, status, jenis_kelamin) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId + 1000, userId, nip, name, mapelObj.id, 'aktif', i % 2 === 0 ? 'L' : 'P']
        );

        guruIds.push({
            id: userId + 1000,
            mapel_id: mapelObj.id,
            name
        });
    }

    console.log(`[OK] Inserted ${guruIds.length} teachers.`);
    return guruIds;
}

function groupSlotsByDay(slots) {
    const slotsByDay = {};
    for (const slot of slots) {
        if (!slotsByDay[slot.hari]) {
            slotsByDay[slot.hari] = [];
        }
        slotsByDay[slot.hari].push(slot);
    }
    return slotsByDay;
}

async function loadSlotsByDay(connection) {
    const [slots] = await connection.execute(
        'SELECT * FROM jam_pelajaran WHERE tahun_ajaran = ? ORDER BY jam_ke ASC',
        [TAHUN_AJARAN]
    );
    return groupSlotsByDay(slots);
}

function isTeacherBusy(busyTeachers, hari, jam, guruId) {
    if (!busyTeachers[hari]) return false;
    if (!busyTeachers[hari][jam]) return false;
    return busyTeachers[hari][jam].has(guruId);
}

function markTeacherBusy(busyTeachers, hari, jam, guruId) {
    if (!busyTeachers[hari]) busyTeachers[hari] = {};
    if (!busyTeachers[hari][jam]) busyTeachers[hari][jam] = new Set();
    busyTeachers[hari][jam].add(guruId);
}

function isRoomBusy(busyRooms, hari, jam, roomId) {
    if (!busyRooms[hari]) return false;
    if (!busyRooms[hari][jam]) return false;
    return busyRooms[hari][jam].has(roomId);
}

function markRoomBusy(busyRooms, hari, jam, roomId) {
    if (!busyRooms[hari]) busyRooms[hari] = {};
    if (!busyRooms[hari][jam]) busyRooms[hari][jam] = new Set();
    busyRooms[hari][jam].add(roomId);
}

function selectTeacherForSlot(eligibleTeachers, busyTeachers, hari, jam, allTeachers) {
    for (const teacher of eligibleTeachers) {
        if (!isTeacherBusy(busyTeachers, hari, jam, teacher.id)) {
            return teacher;
        }
    }
    return allTeachers.find((teacher) => !isTeacherBusy(busyTeachers, hari, jam, teacher.id)) || null;
}

function selectRoomForClass(kelasId, roomIds, busyRooms, hari, jam) {
    let selectedRoomId = roomIds[kelasId % roomIds.length];
    if (!isRoomBusy(busyRooms, hari, jam, selectedRoomId)) {
        return selectedRoomId;
    }
    selectedRoomId = roomIds.find((roomId) => !isRoomBusy(busyRooms, hari, jam, roomId));
    return selectedRoomId || null;
}

function pickMapelForSlot(mapelIds) {
    const forcedMapelIndex = Math.floor(Math.random() * mapelIds.length);
    return mapelIds[forcedMapelIndex];
}

async function insertScheduleRow(connection, kelasId, mapel, selectedGuru, selectedRoomId, day, slot) {
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
}

async function allocateScheduleSlot(
    { connection, kelasId, day, slot },
    { mapelIds, guruIds, roomIds },
    { busyTeachers, busyRooms }
) {
    if (slot.jenis !== 'pelajaran') {
        return false;
    }

    const mapel = pickMapelForSlot(mapelIds);
    const eligibleTeachers = guruIds.filter((g) => g.mapel_id === mapel.id);
    const selectedGuru = selectTeacherForSlot(eligibleTeachers, busyTeachers, day, slot.jam_ke, guruIds);
    if (!selectedGuru) {
        return false;
    }

    const selectedRoomId = selectRoomForClass(kelasId, roomIds, busyRooms, day, slot.jam_ke);
    if (!selectedRoomId) {
        return false;
    }

    await insertScheduleRow(connection, kelasId, mapel, selectedGuru, selectedRoomId, day, slot);
    markTeacherBusy(busyTeachers, day, slot.jam_ke, selectedGuru.id);
    markRoomBusy(busyRooms, day, slot.jam_ke, selectedRoomId);
    return true;
}

async function generateSchedule(connection, kelasIds, mapelIds, guruIds, slotsByDay, roomIds) {
    console.log('\n[SCHEDULE] Generating Conflict-Free Schedule...');
    const busyTeachers = {};
    const busyRooms = {};
    let jadwalCount = 0;

    for (const kelasId of kelasIds) {
        console.log(`   Processing Class ID ${kelasId}...`);
        for (const [day, slots] of Object.entries(slotsByDay)) {
            for (const slot of slots) {
                const wasInserted = await allocateScheduleSlot(
                    { connection, kelasId, day, slot },
                    { mapelIds, guruIds, roomIds },
                    { busyTeachers, busyRooms }
                );
                if (wasInserted) {
                    jadwalCount += 1;
                }
            }
        }
    }

    return jadwalCount;
}

// ============================================================================
// MAIN
// ============================================================================

async function seed() {
    console.log('[START] STARTING DUMMY SEEDER (FULL)...');
    
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST === 'mysql' ? '127.0.0.1' : (process.env.DB_HOST || 'localhost'),
        user: process.env.DB_HOST === 'mysql' ? 'root' : (process.env.DB_USER || 'root'),
        password: process.env.DB_HOST === 'mysql' ? '' : (process.env.DB_PASSWORD || ''),
        database: process.env.DB_NAME || 'absenta13',
    });

    try {
        await cleanupTables(connection);
        const roomIds = await seedRooms(connection, ROOMS);
        await ensureJamPelajaran(connection);
        const mapelIds = await seedMapel(connection, MAPEL_LIST);
        const kelasIds = await seedKelas(connection, KELAS_LIST);
        const guruIds = await seedGuruAndUsers(connection, GURU_NAMES, mapelIds);
        const slotsByDay = await loadSlotsByDay(connection);
        const jadwalCount = await generateSchedule(connection, kelasIds, mapelIds, guruIds, slotsByDay, roomIds);

        console.log(`\n[OK] Generated ${jadwalCount} schedule entries.`);
        console.log('[DONE] Seed Complete!');

    } catch (error) {
        console.error('[ERROR] Error seeding:', error);
    } finally {
        await connection.end();
    }
}

await seed();
