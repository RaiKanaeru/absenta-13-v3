/**
 * Seeder: Schedule Management Configuration
 * 
 * Mengisi data awal untuk:
 * 1. Guru MANDIRI (system entity)
 * 2. jam_pelajaran (Senin-Jumat dengan durasi berbeda)
 * 3. app_settings (config default)
 * 
 * Usage: node database/seeders/seed_schedule_config.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const TAHUN_AJARAN = '2025/2026';

// ============================================================
// DATA: Struktur Jam Pelajaran
// ============================================================

// Jam pelajaran Senin-Kamis (45 menit per JP)
const JAM_BIASA = [
  { jam_ke: 1, jam_mulai: '07:15', jam_selesai: '08:00', durasi: 45, jenis: 'pelajaran' },
  { jam_ke: 2, jam_mulai: '08:00', jam_selesai: '08:45', durasi: 45, jenis: 'pelajaran' },
  { jam_ke: 3, jam_mulai: '08:45', jam_selesai: '09:30', durasi: 45, jenis: 'pelajaran' },
  { jam_ke: 4, jam_mulai: '09:30', jam_selesai: '10:15', durasi: 45, jenis: 'pelajaran' },
  // Istirahat 1
  { jam_ke: 5, jam_mulai: '10:15', jam_selesai: '10:30', durasi: 15, jenis: 'istirahat', label: 'Istirahat 1' },
  { jam_ke: 6, jam_mulai: '10:30', jam_selesai: '11:15', durasi: 45, jenis: 'pelajaran' },
  { jam_ke: 7, jam_mulai: '11:15', jam_selesai: '12:00', durasi: 45, jenis: 'pelajaran' },
  // Istirahat 2 (Dzuhur)
  { jam_ke: 8, jam_mulai: '12:00', jam_selesai: '12:45', durasi: 45, jenis: 'istirahat', label: 'Istirahat Dzuhur' },
  { jam_ke: 9, jam_mulai: '12:45', jam_selesai: '13:30', durasi: 45, jenis: 'pelajaran' },
  { jam_ke: 10, jam_mulai: '13:30', jam_selesai: '14:15', durasi: 45, jenis: 'pelajaran' },
  { jam_ke: 11, jam_mulai: '14:15', jam_selesai: '15:00', durasi: 45, jenis: 'pelajaran' },
  { jam_ke: 12, jam_mulai: '15:00', jam_selesai: '15:45', durasi: 45, jenis: 'pelajaran' },
];

// Jam pelajaran Jumat (35 menit per JP)
const JAM_JUMAT = [
  { jam_ke: 1, jam_mulai: '07:00', jam_selesai: '07:35', durasi: 35, jenis: 'pelajaran' },
  { jam_ke: 2, jam_mulai: '07:35', jam_selesai: '08:10', durasi: 35, jenis: 'pelajaran' },
  { jam_ke: 3, jam_mulai: '08:10', jam_selesai: '08:45', durasi: 35, jenis: 'pelajaran' },
  { jam_ke: 4, jam_mulai: '08:45', jam_selesai: '09:20', durasi: 35, jenis: 'pelajaran' },
  { jam_ke: 5, jam_mulai: '09:20', jam_selesai: '09:35', durasi: 15, jenis: 'istirahat', label: 'Istirahat 1' },
  { jam_ke: 6, jam_mulai: '09:35', jam_selesai: '10:10', durasi: 35, jenis: 'pelajaran' },
  { jam_ke: 7, jam_mulai: '10:10', jam_selesai: '10:45', durasi: 35, jenis: 'pelajaran' },
  // Jumatan
  { jam_ke: 8, jam_mulai: '10:45', jam_selesai: '12:30', durasi: 105, jenis: 'istirahat', label: 'Sholat Jumat' },
  { jam_ke: 9, jam_mulai: '12:30', jam_selesai: '13:05', durasi: 35, jenis: 'pelajaran' },
  { jam_ke: 10, jam_mulai: '13:05', jam_selesai: '13:40', durasi: 35, jenis: 'pelajaran' },
];

// Aktivitas pembiasaan pagi (Jam ke-0)
const PEMBIASAAN = {
  'Senin': { label: 'UPACARA/PERWALIAN', jam_mulai: '06:30', jam_selesai: '07:15', durasi: 45 },
  'Selasa': { label: 'TADARUS & SARAPAN', jam_mulai: '06:30', jam_selesai: '07:00', durasi: 30 },
  'Rabu': { label: 'SHOLAT DHUHA', jam_mulai: '06:30', jam_selesai: '07:00', durasi: 30 },
  'Kamis': { label: 'TADARUS & LITERASI', jam_mulai: '06:30', jam_selesai: '07:00', durasi: 30 },
  'Jumat': { label: 'JUMAT BERSIH', jam_mulai: '06:30', jam_selesai: '07:00', durasi: 30 },
};

// App Settings Default
const APP_SETTINGS = [
  {
    key: 'TAHUN_AJARAN_AKTIF',
    value: TAHUN_AJARAN,
    category: 'academic',
    description: 'Tahun ajaran yang sedang aktif'
  },
  {
    key: 'EMPTY_SLOT_POLICY',
    value: 'TUGAS_MANDIRI',
    category: 'schedule',
    description: 'Policy untuk slot jadwal tanpa guru: TUGAS_MANDIRI | FREE_PERIOD | GURU_PIKET'
  },
  {
    key: 'SPECIAL_ACTIVITIES',
    value: { SENIN_1: 'UPACARA', SELASA_0: 'TADARUS', RABU_0: 'SHOLAT_DHUHA', KAMIS_0: 'LITERASI', JUMAT_0: 'JUMAT_BERSIH' },
    category: 'schedule',
    description: 'Mapping hari_jam ke aktivitas khusus'
  },
  {
    key: 'CONSTRAINT_TEACHER_COLLISION',
    value: 'STRICT',
    category: 'schedule',
    description: 'Level constraint bentrok guru: STRICT | WARN | IGNORE'
  },
  {
    key: 'CONSTRAINT_ROOM_COLLISION',
    value: 'STRICT',
    category: 'schedule',
    description: 'Level constraint bentrok ruang: STRICT | WARN | IGNORE'
  },
];

// ============================================================
// MAIN SEEDER FUNCTION
// ============================================================

async function runSeeder() {
  console.log('[START] Starting Schedule Config Seeder...\n');

  // Create connection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'absenta13',
    multipleStatements: true
  });

  try {
    // 1. Insert Guru MANDIRI (System Entity)
    console.log('[PIN] Inserting Guru MANDIRI (System Entity)...');
    await connection.execute(`
      INSERT IGNORE INTO guru (id_guru, user_id, username, nip, nama, status, is_system_entity)
      VALUES (0, 0, 'MANDIRI', 'SYSTEM-001', 'TUGAS MANDIRI', 'aktif', 1)
    `);
    console.log('   [OK] Guru MANDIRI inserted\n');

    // 2. Insert Jam Pelajaran
    console.log('[PIN] Inserting Jam Pelajaran...');
    const hariList = ['Senin', 'Selasa', 'Rabu', 'Kamis'];
    
    for (const hari of hariList) {
      // Insert pembiasaan (jam ke-0)
      const pembiasaan = PEMBIASAAN[hari];
      await connection.execute(`
        INSERT IGNORE INTO jam_pelajaran (hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label, tahun_ajaran)
        VALUES (?, 0, ?, ?, ?, 'pembiasaan', ?, ?)
      `, [hari, pembiasaan.jam_mulai, pembiasaan.jam_selesai, pembiasaan.durasi, pembiasaan.label, TAHUN_AJARAN]);

      // Insert jam reguler
      for (const jam of JAM_BIASA) {
        await connection.execute(`
          INSERT IGNORE INTO jam_pelajaran (hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label, tahun_ajaran)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [hari, jam.jam_ke, jam.jam_mulai, jam.jam_selesai, jam.durasi, jam.jenis, jam.label || null, TAHUN_AJARAN]);
      }
      console.log(`   [OK] ${hari}: ${JAM_BIASA.length + 1} jam inserted`);
    }

    // Insert Jumat (durasi berbeda)
    const pembiasaanJumat = PEMBIASAAN['Jumat'];
    await connection.execute(`
      INSERT IGNORE INTO jam_pelajaran (hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label, tahun_ajaran)
      VALUES ('Jumat', 0, ?, ?, ?, 'pembiasaan', ?, ?)
    `, [pembiasaanJumat.jam_mulai, pembiasaanJumat.jam_selesai, pembiasaanJumat.durasi, pembiasaanJumat.label, TAHUN_AJARAN]);

    for (const jam of JAM_JUMAT) {
      await connection.execute(`
        INSERT IGNORE INTO jam_pelajaran (hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label, tahun_ajaran)
        VALUES ('Jumat', ?, ?, ?, ?, ?, ?, ?)
      `, [jam.jam_ke, jam.jam_mulai, jam.jam_selesai, jam.durasi, jam.jenis, jam.label || null, TAHUN_AJARAN]);
    }
    console.log(`   [OK] Jumat: ${JAM_JUMAT.length + 1} jam inserted (35 menit/JP)\n`);

    // 3. Insert App Settings
    console.log('[PIN] Inserting App Settings...');
    for (const setting of APP_SETTINGS) {
      await connection.execute(`
        INSERT INTO app_settings (setting_key, setting_value, category, description)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `, [setting.key, JSON.stringify(setting.value), setting.category, setting.description]);
      console.log(`   [OK] ${setting.key}`);
    }

    console.log('\n[OK] Seeder completed successfully!');
    console.log('\n[STATS] Summary:');
    
    const [jamCount] = await connection.execute('SELECT COUNT(*) as count FROM jam_pelajaran');
    const [settingCount] = await connection.execute('SELECT COUNT(*) as count FROM app_settings');
    
    console.log(`   - jam_pelajaran: ${jamCount[0].count} records`);
    console.log(`   - app_settings: ${settingCount[0].count} records`);

  } catch (error) {
    console.error('[ERROR] Seeder failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run seeder
try {
  await runSeeder();
} catch (error) {
  console.error(error);
  process.exit(1);
}
