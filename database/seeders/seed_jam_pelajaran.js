/**
 * Seeder untuk tabel jam_pelajaran
 * 
 * Jadwal default berdasarkan struktur sekolah:
 * - Senin: Upacara/Apel pagi, kemudian pelajaran
 * - Selasa-Kamis: Pembiasaan + pelajaran standar
 * - Jumat: Jadwal pendek (Jumat schedule)
 */

const TAHUN_AJARAN = '2025/2026';

// Helper untuk format waktu
const formatTime = (hours, minutes) => {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Konfigurasi jadwal per hari
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

// Generate SQL untuk setiap hari
function generateInserts() {
  const inserts = [];
  
  for (const [hari, config] of Object.entries(scheduleConfig)) {
    let currentMinutes = config.startTime.hours * 60 + config.startTime.minutes;
    
    for (const slot of config.slots) {
      // Hitung jam mulai dan selesai
      const jamMulai = formatTime(Math.floor(currentMinutes / 60), currentMinutes % 60);
      currentMinutes += slot.durasi;
      const jamSelesai = formatTime(Math.floor(currentMinutes / 60), currentMinutes % 60);
      
      // Skip istirahat (jam_ke negatif) untuk tabel jam_pelajaran
      if (slot.jam_ke >= 0) {
        inserts.push({
          hari,
          jam_ke: slot.jam_ke,
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          durasi_menit: slot.durasi,
          jenis: slot.jenis,
          label: slot.label || null,
          tahun_ajaran: TAHUN_AJARAN
        });
      }
    }
  }
  
  return inserts;
}

// Main seeder function
async function seedJamPelajaran(pool) {
  console.log('🌱 Seeding jam_pelajaran table...');
  
  const inserts = generateInserts();
  
  // Clear existing data for this tahun ajaran
  await pool.execute(
    'DELETE FROM jam_pelajaran WHERE tahun_ajaran = ?',
    [TAHUN_AJARAN]
  );
  
  // Insert new data
  const insertQuery = `
    INSERT INTO jam_pelajaran 
    (hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label, tahun_ajaran)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  for (const row of inserts) {
    await pool.execute(insertQuery, [
      row.hari,
      row.jam_ke,
      row.jam_mulai,
      row.jam_selesai,
      row.durasi_menit,
      row.jenis,
      row.label,
      row.tahun_ajaran
    ]);
  }
  
  console.log(`✅ Inserted ${inserts.length} jam_pelajaran records`);
  return inserts.length;
}

// Export for use in other scripts
export { seedJamPelajaran, generateInserts, scheduleConfig };
export default seedJamPelajaran;
