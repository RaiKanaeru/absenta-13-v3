import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const hasSeedOverride = [
  'SEED_DB_HOST',
  'SEED_DB_PORT',
  'SEED_DB_USER',
  'SEED_DB_PASSWORD',
  'SEED_DB_NAME',
].some((key) => process.env[key] !== undefined);

const rawPassword = hasSeedOverride ? process.env.SEED_DB_PASSWORD : process.env.DB_PASSWORD;
const SEED_DB = {
  host: process.env.SEED_DB_HOST ?? (hasSeedOverride ? 'localhost' : process.env.DB_HOST ?? 'localhost'),
  port: Number(process.env.SEED_DB_PORT ?? (hasSeedOverride ? 3306 : process.env.DB_PORT ?? 3306)),
  user: process.env.SEED_DB_USER ?? (hasSeedOverride ? 'root' : process.env.DB_USER ?? 'root'),
  password: rawPassword === undefined || rawPassword === '' ? undefined : rawPassword,
  database: process.env.SEED_DB_NAME ?? (hasSeedOverride ? 'absenta13' : process.env.DB_NAME ?? 'absenta13'),
};

const CONFIG = {
  classCount: Number(process.env.SEED_CLASS_COUNT || 12),
  studentsPerClass: Number(process.env.SEED_STUDENTS_PER_CLASS || 30),
  teacherCount: Number(process.env.SEED_TEACHER_COUNT || 36),
  monthsBack: Number(process.env.SEED_MONTHS_BACK || 3),
  tahunAjaran: process.env.SEED_TAHUN_AJARAN || '2025/2026',
  includeSaturdays: process.env.SEED_INCLUDE_SATURDAY === '1',
  database: SEED_DB.database,
};

const PASSWORD_HASH =
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const EXTRA_MAPEL = [
  { kode: 'BIO', nama: 'Biologi', desc: 'Ilmu hayat' },
  { kode: 'FIS', nama: 'Fisika', desc: 'Ilmu fisika' },
  { kode: 'KIM', nama: 'Kimia', desc: 'Ilmu kimia' },
  { kode: 'SEN', nama: 'Seni Budaya', desc: 'Seni dan budaya' },
  { kode: 'PKWU', nama: 'Prakarya', desc: 'Keterampilan' },
];

const STATUS_SISWA = [
  { value: 'Hadir', weight: 0.86 },
  { value: 'Izin', weight: 0.05 },
  { value: 'Sakit', weight: 0.05 },
  { value: 'Alpa', weight: 0.03 },
  { value: 'Dispen', weight: 0.01 },
];

const STATUS_GURU = [
  { value: 'Hadir', weight: 0.9 },
  { value: 'Sakit', weight: 0.04 },
  { value: 'Izin', weight: 0.04 },
  { value: 'Tidak Hadir', weight: 0.02 },
];

const JAM_CONFIG = {
  Senin: [
    { jam_ke: 0, jam_mulai: '06:30', jam_selesai: '07:15', durasi: 45, jenis: 'pembiasaan', label: 'Upacara/Apel' },
    { jam_ke: 1, jam_mulai: '07:15', jam_selesai: '08:00', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 2, jam_mulai: '08:00', jam_selesai: '08:45', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 3, jam_mulai: '08:45', jam_selesai: '09:30', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 4, jam_mulai: '09:30', jam_selesai: '10:15', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 5, jam_mulai: '10:15', jam_selesai: '10:30', durasi: 15, jenis: 'istirahat', label: 'Istirahat 1' },
    { jam_ke: 6, jam_mulai: '10:30', jam_selesai: '11:15', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 7, jam_mulai: '11:15', jam_selesai: '12:00', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 8, jam_mulai: '12:00', jam_selesai: '12:45', durasi: 45, jenis: 'istirahat', label: 'Istirahat 2' },
    { jam_ke: 9, jam_mulai: '12:45', jam_selesai: '13:30', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 10, jam_mulai: '13:30', jam_selesai: '14:15', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 11, jam_mulai: '14:15', jam_selesai: '15:00', durasi: 45, jenis: 'pelajaran' },
  ],
  Selasa: [
    { jam_ke: 0, jam_mulai: '06:30', jam_selesai: '07:00', durasi: 30, jenis: 'pembiasaan', label: 'Tadarus' },
    { jam_ke: 1, jam_mulai: '07:00', jam_selesai: '07:45', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 2, jam_mulai: '07:45', jam_selesai: '08:30', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 3, jam_mulai: '08:30', jam_selesai: '09:15', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 4, jam_mulai: '09:15', jam_selesai: '10:00', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 5, jam_mulai: '10:00', jam_selesai: '10:15', durasi: 15, jenis: 'istirahat', label: 'Istirahat 1' },
    { jam_ke: 6, jam_mulai: '10:15', jam_selesai: '11:00', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 7, jam_mulai: '11:00', jam_selesai: '11:45', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 8, jam_mulai: '11:45', jam_selesai: '12:30', durasi: 45, jenis: 'istirahat', label: 'Istirahat 2' },
    { jam_ke: 9, jam_mulai: '12:30', jam_selesai: '13:15', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 10, jam_mulai: '13:15', jam_selesai: '14:00', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 11, jam_mulai: '14:00', jam_selesai: '14:45', durasi: 45, jenis: 'pelajaran' },
  ],
  Rabu: [
    { jam_ke: 0, jam_mulai: '06:30', jam_selesai: '07:00', durasi: 30, jenis: 'pembiasaan', label: 'Sholat Dhuha' },
    { jam_ke: 1, jam_mulai: '07:00', jam_selesai: '07:45', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 2, jam_mulai: '07:45', jam_selesai: '08:30', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 3, jam_mulai: '08:30', jam_selesai: '09:15', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 4, jam_mulai: '09:15', jam_selesai: '10:00', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 5, jam_mulai: '10:00', jam_selesai: '10:15', durasi: 15, jenis: 'istirahat', label: 'Istirahat 1' },
    { jam_ke: 6, jam_mulai: '10:15', jam_selesai: '11:00', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 7, jam_mulai: '11:00', jam_selesai: '11:45', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 8, jam_mulai: '11:45', jam_selesai: '12:30', durasi: 45, jenis: 'istirahat', label: 'Istirahat 2' },
    { jam_ke: 9, jam_mulai: '12:30', jam_selesai: '13:15', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 10, jam_mulai: '13:15', jam_selesai: '14:00', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 11, jam_mulai: '14:00', jam_selesai: '14:45', durasi: 45, jenis: 'pelajaran' },
  ],
  Kamis: [
    { jam_ke: 0, jam_mulai: '06:30', jam_selesai: '07:00', durasi: 30, jenis: 'pembiasaan', label: 'Literasi' },
    { jam_ke: 1, jam_mulai: '07:00', jam_selesai: '07:45', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 2, jam_mulai: '07:45', jam_selesai: '08:30', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 3, jam_mulai: '08:30', jam_selesai: '09:15', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 4, jam_mulai: '09:15', jam_selesai: '10:00', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 5, jam_mulai: '10:00', jam_selesai: '10:15', durasi: 15, jenis: 'istirahat', label: 'Istirahat 1' },
    { jam_ke: 6, jam_mulai: '10:15', jam_selesai: '11:00', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 7, jam_mulai: '11:00', jam_selesai: '11:45', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 8, jam_mulai: '11:45', jam_selesai: '12:30', durasi: 45, jenis: 'istirahat', label: 'Istirahat 2' },
    { jam_ke: 9, jam_mulai: '12:30', jam_selesai: '13:15', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 10, jam_mulai: '13:15', jam_selesai: '14:00', durasi: 45, jenis: 'pelajaran' },
    { jam_ke: 11, jam_mulai: '14:00', jam_selesai: '14:45', durasi: 45, jenis: 'pelajaran' },
  ],
  Jumat: [
    { jam_ke: 0, jam_mulai: '06:30', jam_selesai: '07:00', durasi: 30, jenis: 'pembiasaan', label: 'Jumat Bersih' },
    { jam_ke: 1, jam_mulai: '07:00', jam_selesai: '07:35', durasi: 35, jenis: 'pelajaran' },
    { jam_ke: 2, jam_mulai: '07:35', jam_selesai: '08:10', durasi: 35, jenis: 'pelajaran' },
    { jam_ke: 3, jam_mulai: '08:10', jam_selesai: '08:45', durasi: 35, jenis: 'pelajaran' },
    { jam_ke: 4, jam_mulai: '08:45', jam_selesai: '09:20', durasi: 35, jenis: 'pelajaran' },
    { jam_ke: 5, jam_mulai: '09:20', jam_selesai: '09:35', durasi: 15, jenis: 'istirahat', label: 'Istirahat 1' },
    { jam_ke: 6, jam_mulai: '09:35', jam_selesai: '10:10', durasi: 35, jenis: 'pelajaran' },
    { jam_ke: 7, jam_mulai: '10:10', jam_selesai: '10:45', durasi: 35, jenis: 'pelajaran' },
    { jam_ke: 8, jam_mulai: '10:45', jam_selesai: '12:30', durasi: 105, jenis: 'istirahat', label: 'Sholat Jumat' },
    { jam_ke: 9, jam_mulai: '12:30', jam_selesai: '13:05', durasi: 35, jenis: 'pelajaran' },
    { jam_ke: 10, jam_mulai: '13:05', jam_selesai: '13:40', durasi: 35, jenis: 'pelajaran' },
  ],
};

const JAM_CONFIG_SABTU = [
  { jam_ke: 1, jam_mulai: '07:00', jam_selesai: '07:45', durasi: 45, jenis: 'pelajaran' },
  { jam_ke: 2, jam_mulai: '07:45', jam_selesai: '08:30', durasi: 45, jenis: 'pelajaran' },
  { jam_ke: 3, jam_mulai: '08:30', jam_selesai: '09:15', durasi: 45, jenis: 'pelajaran' },
  { jam_ke: 4, jam_mulai: '09:15', jam_selesai: '10:00', durasi: 45, jenis: 'pelajaran' },
  { jam_ke: 5, jam_mulai: '10:00', jam_selesai: '10:15', durasi: 15, jenis: 'istirahat', label: 'Istirahat' },
  { jam_ke: 6, jam_mulai: '10:15', jam_selesai: '11:00', durasi: 45, jenis: 'pelajaran' },
];

const toDateString = (date) => date.toISOString().slice(0, 10);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const pickWeighted = (list) => {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of list) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return list[list.length - 1].value;
};

const randomItem = (list) => list[Math.floor(Math.random() * list.length)];

const chunkInsert = async (connection, table, columns, rows) => {
  if (!rows.length) return 0;
  const sql = `INSERT IGNORE INTO ${table} (${columns.join(',')}) VALUES ?`;
  const [result] = await connection.query(sql, [rows]);
  return result.affectedRows || 0;
};

const buildDayMap = (rows) => {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.hari)) {
      map.set(row.hari, []);
    }
    map.get(row.hari).push(row);
  }
  return map;
};

const getRunTag = () => {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:TZ]/g, '')
    .slice(0, 12);
  return stamp;
};

const mapStatusToLower = (status) => {
  switch (status) {
    case 'Hadir':
      return 'hadir';
    case 'Izin':
      return 'izin';
    case 'Sakit':
      return 'sakit';
    case 'Alpa':
      return 'alpa';
    case 'Dispen':
      return 'dispen';
    default:
      return 'hadir';
  }
};

async function main() {
  console.log('Connecting to database...');
  const connectionConfig = {
    host: SEED_DB.host,
    port: SEED_DB.port,
    user: SEED_DB.user,
    database: SEED_DB.database,
    multipleStatements: false,
  };
  if (SEED_DB.password !== undefined) {
    connectionConfig.password = SEED_DB.password;
  }
  const connection = await mysql.createConnection(connectionConfig);

  const runTag = getRunTag();

  try {
    await connection.execute('SELECT 1');
    console.log(`Connected to ${CONFIG.database}`);

    console.log('Loading reference data...');
    const [mapelRows] = await connection.execute(
      "SELECT id_mapel, kode_mapel, nama_mapel FROM mapel WHERE status='aktif'"
    );

    const mapelByCode = new Set(mapelRows.map((row) => row.kode_mapel));
    const newMapelRows = EXTRA_MAPEL.filter((item) => !mapelByCode.has(item.kode)).map(
      (item) => [item.kode, item.nama, item.desc, 'aktif']
    );
    if (newMapelRows.length) {
      await chunkInsert(connection, 'mapel', ['kode_mapel', 'nama_mapel', 'deskripsi', 'status'], newMapelRows);
      console.log(`Inserted ${newMapelRows.length} new mapel`);
    }

    const [mapelFinal] = await connection.execute(
      "SELECT id_mapel, kode_mapel, nama_mapel FROM mapel WHERE status='aktif' ORDER BY id_mapel"
    );

    const [kelasExisting] = await connection.execute('SELECT id_kelas, nama_kelas FROM kelas');
    const kelasNameSet = new Set(kelasExisting.map((row) => row.nama_kelas));

    const [ruangExisting] = await connection.execute('SELECT id_ruang, kode_ruang FROM ruang_kelas');
    const ruangCodeSet = new Set(ruangExisting.map((row) => row.kode_ruang));

    const [maxGuruRows] = await connection.execute('SELECT MAX(id_guru) AS max_id FROM guru');
    const [maxSiswaRows] = await connection.execute('SELECT MAX(id_siswa) AS max_id FROM siswa');
    const maxGuruId = Number(maxGuruRows[0]?.max_id || 0);
    const maxSiswaId = Number(maxSiswaRows[0]?.max_id || 0);

    console.log('Seeding jam_pelajaran...');
    const jamRows = [];
    for (const [hari, slots] of Object.entries(JAM_CONFIG)) {
      for (const slot of slots) {
        jamRows.push([
          hari,
          slot.jam_ke,
          slot.jam_mulai,
          slot.jam_selesai,
          slot.durasi,
          slot.jenis,
          slot.label || null,
          CONFIG.tahunAjaran,
        ]);
      }
    }
    if (CONFIG.includeSaturdays) {
      for (const slot of JAM_CONFIG_SABTU) {
        jamRows.push([
          'Sabtu',
          slot.jam_ke,
          slot.jam_mulai,
          slot.jam_selesai,
          slot.durasi,
          slot.jenis,
          slot.label || null,
          CONFIG.tahunAjaran,
        ]);
      }
    }
    await chunkInsert(
      connection,
      'jam_pelajaran',
      ['hari', 'jam_ke', 'jam_mulai', 'jam_selesai', 'durasi_menit', 'jenis', 'label', 'tahun_ajaran'],
      jamRows
    );

    console.log('Seeding ruang_kelas...');
    const ruangRows = [];
    for (let i = 1; i <= CONFIG.classCount; i += 1) {
      const kode = `D3M${String(i).padStart(2, '0')}`;
      if (ruangCodeSet.has(kode)) continue;
      ruangRows.push([kode, `Ruang D3M ${String(i).padStart(2, '0')}`, 'Lantai 1', 36, 'aktif']);
    }
    await chunkInsert(
      connection,
      'ruang_kelas',
      ['kode_ruang', 'nama_ruang', 'lokasi', 'kapasitas', 'status'],
      ruangRows
    );

    const [ruangFinal] = await connection.execute(
      "SELECT id_ruang, kode_ruang FROM ruang_kelas WHERE kode_ruang LIKE 'D3M%' ORDER BY id_ruang"
    );

    console.log('Seeding kelas...');
    const kelasRows = [];
    const tingkatList = ['X', 'XI', 'XII'];
    for (let i = 0; i < CONFIG.classCount; i += 1) {
      const tingkat = tingkatList[i % tingkatList.length];
      const nama = `D3M-${tingkat}-${String(i + 1).padStart(2, '0')}-${runTag}`;
      if (nama.length > 50) continue;
      if (kelasNameSet.has(nama)) continue;
      kelasRows.push([nama, tingkat, 0, 'aktif']);
    }
    let kelasIds = [];
    if (kelasRows.length) {
      const sql = 'INSERT INTO kelas (nama_kelas, tingkat, jumlah_siswa, status) VALUES ?';
      const [result] = await connection.query(sql, [kelasRows]);
      const firstId = result.insertId;
      kelasIds = kelasRows.map((_, idx) => firstId + idx);
    }

    const [kelasFinal] = await connection.execute(
      "SELECT id_kelas, nama_kelas FROM kelas WHERE nama_kelas LIKE 'D3M-%' AND nama_kelas LIKE ? ORDER BY id_kelas",
      [`%${runTag}`]
    );

    if (!kelasFinal.length) {
      throw new Error('No classes inserted. Check kelas naming constraints.');
    }

    console.log('Seeding users for guru...');
    const guruUserRows = [];
    for (let i = 0; i < CONFIG.teacherCount; i += 1) {
      const username = `guru.d3m.${runTag}.${String(i + 1).padStart(3, '0')}`;
      guruUserRows.push([username, PASSWORD_HASH, 'guru', `Guru Dummy ${i + 1}`, `${username}@dummy.local`, 'aktif']);
    }
    const [guruUserResult] = await connection.query(
      'INSERT INTO users (username, password, role, nama, email, status) VALUES ?',
      [guruUserRows]
    );
    const guruUserStartId = guruUserResult.insertId;
    const guruUserIds = guruUserRows.map((_, idx) => guruUserStartId + idx);

    console.log('Seeding guru...');
    const guruRows = [];
    const guruMapel = new Map();
    guruUserIds.forEach((userId, idx) => {
      const idGuru = maxGuruId + idx + 1;
      const mapel = mapelFinal[idx % mapelFinal.length];
      const username = guruUserRows[idx][0];
      const nip = `NIP${runTag}${String(idGuru).padStart(4, '0')}`;
      const noTelp = `08${String(1000000000 + idGuru).slice(0, 10)}`;
      const jenisKelamin = idx % 2 === 0 ? 'L' : 'P';
      guruRows.push([
        idGuru,
        userId,
        username,
        nip,
        `Guru Dummy ${idx + 1}`,
        `${username}@dummy.local`,
        mapel.nama_mapel,
        mapel.id_mapel,
        noTelp,
        'Alamat Dummy',
        jenisKelamin,
        'aktif',
        0,
      ]);
      if (!guruMapel.has(mapel.id_mapel)) {
        guruMapel.set(mapel.id_mapel, []);
      }
      guruMapel.get(mapel.id_mapel).push(idGuru);
    });
    await chunkInsert(
      connection,
      'guru',
      [
        'id_guru',
        'user_id',
        'username',
        'nip',
        'nama',
        'email',
        'mata_pelajaran',
        'mapel_id',
        'no_telp',
        'alamat',
        'jenis_kelamin',
        'status',
        'is_system_entity',
      ],
      guruRows
    );

    console.log('Seeding guru_availability...');
    const availabilityRows = [];
    const availabilityDays = CONFIG.includeSaturdays
      ? ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
      : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    for (const guru of guruRows) {
      const idGuru = guru[0];
      for (const hari of availabilityDays) {
        const isAvailable = Math.random() < 0.9 ? 1 : 0;
        availabilityRows.push([idGuru, hari, isAvailable, isAvailable ? 'OK' : 'Tidak tersedia', CONFIG.tahunAjaran]);
      }
    }
    await chunkInsert(
      connection,
      'guru_availability',
      ['guru_id', 'hari', 'is_available', 'keterangan', 'tahun_ajaran'],
      availabilityRows
    );

    console.log('Seeding users for siswa...');
    const siswaUserRows = [];
    const siswaPlan = [];
    let siswaIndex = 0;
    for (const kelas of kelasFinal) {
      for (let i = 0; i < CONFIG.studentsPerClass; i += 1) {
        siswaIndex += 1;
        const username = `siswa.d3m.${runTag}.${String(siswaIndex).padStart(4, '0')}`;
        siswaUserRows.push([username, PASSWORD_HASH, 'siswa', `Siswa Dummy ${siswaIndex}`, `${username}@dummy.local`, 'aktif']);
        siswaPlan.push({ kelasId: kelas.id_kelas, username });
      }
    }
    const [siswaUserResult] = await connection.query(
      'INSERT INTO users (username, password, role, nama, email, status) VALUES ?',
      [siswaUserRows]
    );
    const siswaUserStartId = siswaUserResult.insertId;
    const siswaUserIds = siswaUserRows.map((_, idx) => siswaUserStartId + idx);

    console.log('Seeding siswa...');
    const siswaRows = [];
    const siswaByClass = new Map();
    siswaUserIds.forEach((userId, idx) => {
      const idSiswa = maxSiswaId + idx + 1;
      const plan = siswaPlan[idx];
      const nis = `NIS${runTag}${String(idSiswa).padStart(4, '0')}`;
      const nomorTelp = `08${String(9000000000 + idSiswa).slice(0, 10)}`;
      const jenisKelamin = idx % 2 === 0 ? 'L' : 'P';
      siswaRows.push([
        idSiswa,
        userId,
        plan.username,
        nis,
        `Siswa Dummy ${idx + 1}`,
        plan.kelasId,
        'Siswa',
        jenisKelamin,
        `${plan.username}@dummy.local`,
        'Alamat Dummy',
        `08${String(7000000000 + idSiswa).slice(0, 10)}`,
        nomorTelp,
        'aktif',
      ]);
      if (!siswaByClass.has(plan.kelasId)) {
        siswaByClass.set(plan.kelasId, []);
      }
      siswaByClass.get(plan.kelasId).push(idSiswa);
    });
    await chunkInsert(
      connection,
      'siswa',
      [
        'id_siswa',
        'user_id',
        'username',
        'nis',
        'nama',
        'kelas_id',
        'jabatan',
        'jenis_kelamin',
        'email',
        'alamat',
        'telepon_orangtua',
        'nomor_telepon_siswa',
        'status',
      ],
      siswaRows
    );

    console.log('Updating jumlah_siswa per kelas...');
    for (const kelas of kelasFinal) {
      const jumlah = siswaByClass.get(kelas.id_kelas)?.length || 0;
      await connection.execute('UPDATE kelas SET jumlah_siswa = ? WHERE id_kelas = ?', [jumlah, kelas.id_kelas]);
    }

    console.log('Syncing mata_pelajaran with mapel...');
    const [mataExisting] = await connection.execute('SELECT kode_mapel FROM mata_pelajaran');
    const mataSet = new Set(mataExisting.map((row) => row.kode_mapel));
    const mataRows = mapelFinal
      .filter((row) => row.kode_mapel && !mataSet.has(row.kode_mapel))
      .map((row) => [row.id_mapel, row.nama_mapel, row.kode_mapel]);
    if (mataRows.length) {
      await chunkInsert(connection, 'mata_pelajaran', ['id', 'nama_mapel', 'kode_mapel'], mataRows);
    }

    console.log('Seeding jadwal...');
    const [jamPelajaranRows] = await connection.execute(
      "SELECT hari, jam_ke, jam_mulai, jam_selesai, jenis FROM jam_pelajaran WHERE tahun_ajaran = ? ORDER BY hari, jam_ke",
      [CONFIG.tahunAjaran]
    );
    const jamByDay = buildDayMap(jamPelajaranRows);

    const jadwalRows = [];
    const ruangMap = new Map();
    kelasFinal.forEach((kelas, idx) => {
      const ruang = ruangFinal[idx % (ruangFinal.length || 1)];
      if (ruang) ruangMap.set(kelas.id_kelas, ruang.id_ruang);
    });

    const targetDays = CONFIG.includeSaturdays
      ? ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
      : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

    kelasFinal.forEach((kelas, kelasIndex) => {
      for (const hari of targetDays) {
        const slots = (jamByDay.get(hari) || []).filter((slot) => slot.jenis === 'pelajaran');
        slots.forEach((slot, slotIndex) => {
          const mapel = mapelFinal[(kelasIndex + slotIndex) % mapelFinal.length];
          const guruList = guruMapel.get(mapel.id_mapel) || [];
          const guruId = guruList.length ? randomItem(guruList) : guruRows[0]?.[0];
          jadwalRows.push([
            kelas.id_kelas,
            mapel.id_mapel,
            guruId,
            ruangMap.get(kelas.id_kelas) || null,
            hari,
            slot.jam_ke,
            slot.jam_mulai,
            slot.jam_selesai,
            'aktif',
            'pelajaran',
            1,
            0,
          ]);
        });
      }
    });

    for (let i = 0; i < jadwalRows.length; i += 500) {
      const chunk = jadwalRows.slice(i, i + 500);
      await chunkInsert(
        connection,
        'jadwal',
        [
          'kelas_id',
          'mapel_id',
          'guru_id',
          'ruang_id',
          'hari',
          'jam_ke',
          'jam_mulai',
          'jam_selesai',
          'status',
          'jenis_aktivitas',
          'is_absenable',
          'is_multi_guru',
        ],
        chunk
      );
    }

    const kelasIdsList = kelasFinal.map((row) => row.id_kelas);
    const placeholders = kelasIdsList.map(() => '?').join(',');
    const [jadwalFinal] = await connection.execute(
      `SELECT id_jadwal, kelas_id, mapel_id, guru_id, hari, jam_ke, jam_mulai FROM jadwal WHERE kelas_id IN (${placeholders})`,
      kelasIdsList
    );

    console.log('Seeding jadwal_guru...');
    const jadwalGuruRows = jadwalFinal.map((row) => [row.id_jadwal, row.guru_id, 1]);
    for (let i = 0; i < jadwalGuruRows.length; i += 1000) {
      await chunkInsert(connection, 'jadwal_guru', ['jadwal_id', 'guru_id', 'is_primary'], jadwalGuruRows.slice(i, i + 1000));
    }

    console.log('Seeding ruang_mapel_binding...');
    const bindingRows = [];
    const bindingMapel = mapelFinal.slice(0, Math.min(3, mapelFinal.length));
    bindingMapel.forEach((mapel, idx) => {
      const ruang = ruangFinal[idx % (ruangFinal.length || 1)];
      if (!ruang) return;
      bindingRows.push([ruang.id_ruang, mapel.id_mapel, 1]);
    });
    await chunkInsert(connection, 'ruang_mapel_binding', ['ruang_id', 'mapel_id', 'is_exclusive'], bindingRows);

    console.log('Generating absensi (3 months)...');
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - CONFIG.monthsBack);
    const endDate = new Date();

    const jadwalByClassDay = new Map();
    for (const row of jadwalFinal) {
      const key = `${row.kelas_id}`;
      if (!jadwalByClassDay.has(key)) {
        jadwalByClassDay.set(key, new Map());
      }
      const dayMap = jadwalByClassDay.get(key);
      if (!dayMap.has(row.hari)) {
        dayMap.set(row.hari, []);
      }
      dayMap.get(row.hari).push(row);
    }

    const absensiSiswaBatch = [];
    const absensiGuruBatch = [];

    let current = new Date(startDate);
    while (current <= endDate) {
      const dayName = DAY_NAMES[current.getDay()];
      const isSchoolDay =
        (CONFIG.includeSaturdays && dayName !== 'Minggu') ||
        (!CONFIG.includeSaturdays && ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].includes(dayName));
      if (isSchoolDay) {
        const dateStr = toDateString(current);
        for (const kelas of kelasFinal) {
          const siswaList = siswaByClass.get(kelas.id_kelas) || [];
          if (!siswaList.length) continue;
          const dayMap = jadwalByClassDay.get(String(kelas.id_kelas));
          const schedules = dayMap?.get(dayName) || [];
          for (const sched of schedules) {
            const guruId = sched.guru_id;
            const siswaPencatat = randomItem(siswaList);
            const statusGuru = pickWeighted(STATUS_GURU);
            absensiGuruBatch.push([
              sched.id_jadwal,
              guruId,
              kelas.id_kelas,
              siswaPencatat,
              dateStr,
              sched.jam_ke,
              statusGuru,
              statusGuru === 'Hadir' ? 'Hadir' : 'Berhalangan',
              Math.random() < 0.05 ? 1 : 0,
              Math.random() < 0.1 ? 1 : 0,
            ]);

            const waktuAbsen = `${dateStr} ${sched.jam_mulai}:00`;
            for (const siswaId of siswaList) {
              const statusSiswa = pickWeighted(STATUS_SISWA);
              absensiSiswaBatch.push([
                siswaId,
                sched.id_jadwal,
                dateStr,
                statusSiswa,
                statusSiswa === 'Hadir' ? null : 'Keterangan dummy',
                waktuAbsen,
                guruId,
                guruId,
                Math.random() < 0.05 ? 1 : 0,
                Math.random() < 0.1 ? 1 : 0,
              ]);
              if (absensiSiswaBatch.length >= 1000) {
                await chunkInsert(
                  connection,
                  'absensi_siswa',
                  [
                    'siswa_id',
                    'jadwal_id',
                    'tanggal',
                    'status',
                    'keterangan',
                    'waktu_absen',
                    'guru_id',
                    'guru_pengabsen_id',
                    'terlambat',
                    'ada_tugas',
                  ],
                  absensiSiswaBatch.splice(0, absensiSiswaBatch.length)
                );
              }
            }

            if (absensiGuruBatch.length >= 500) {
              await chunkInsert(
                connection,
                'absensi_guru',
                [
                  'jadwal_id',
                  'guru_id',
                  'kelas_id',
                  'siswa_pencatat_id',
                  'tanggal',
                  'jam_ke',
                  'status',
                  'keterangan',
                  'terlambat',
                  'ada_tugas',
                ],
                absensiGuruBatch.splice(0, absensiGuruBatch.length)
              );
            }
          }
        }
      }
      current = addDays(current, 1);
    }

    if (absensiSiswaBatch.length) {
      await chunkInsert(
        connection,
        'absensi_siswa',
        [
          'siswa_id',
          'jadwal_id',
          'tanggal',
          'status',
          'keterangan',
          'waktu_absen',
          'guru_id',
          'guru_pengabsen_id',
          'terlambat',
          'ada_tugas',
        ],
        absensiSiswaBatch
      );
      absensiSiswaBatch.length = 0;
    }

    if (absensiGuruBatch.length) {
      await chunkInsert(
        connection,
        'absensi_guru',
        [
          'jadwal_id',
          'guru_id',
          'kelas_id',
          'siswa_pencatat_id',
          'tanggal',
          'jam_ke',
          'status',
          'keterangan',
          'terlambat',
          'ada_tugas',
        ],
        absensiGuruBatch
      );
      absensiGuruBatch.length = 0;
    }

    console.log('Seeding archive tables...');
    const midDate = addDays(startDate, Math.floor((endDate - startDate) / (2 * 24 * 60 * 60 * 1000)));
    await connection.execute(
      `
        INSERT IGNORE INTO absensi_siswa_archive
        (siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, guru_id, guru_pengabsen_id, terlambat, ada_tugas)
        SELECT siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, guru_id, guru_pengabsen_id, terlambat, ada_tugas
        FROM absensi_siswa
        WHERE tanggal < ?
        ORDER BY tanggal ASC
        LIMIT 5000
      `,
      [toDateString(midDate)]
    );

    await connection.execute(
      `
        INSERT IGNORE INTO absensi_guru_archive
        (jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, jam_ke, status, keterangan, terlambat, ada_tugas)
        SELECT jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, jam_ke, status, keterangan, terlambat, ada_tugas
        FROM absensi_guru
        WHERE tanggal < ?
        ORDER BY tanggal ASC
        LIMIT 2000
      `,
      [toDateString(midDate)]
    );

    console.log('Seeding pengajuan_banding_absen...');
    const kelasPlaceholders = kelasIdsList.map(() => '?').join(',');
    const [bandingCandidates] = await connection.execute(
      `
        SELECT a.siswa_id, a.jadwal_id, a.tanggal, s.kelas_id, a.status
        FROM absensi_siswa a
        JOIN siswa s ON s.id_siswa = a.siswa_id
        WHERE s.kelas_id IN (${kelasPlaceholders})
          AND a.status IN ('Alpa', 'Izin', 'Sakit')
        ORDER BY RAND()
        LIMIT 120
      `,
      kelasIdsList
    );

    const bandingRows = bandingCandidates.map((row) => [
      row.siswa_id,
      row.jadwal_id,
      row.tanggal,
      mapStatusToLower(row.status),
      'hadir',
      'Pengajuan dummy',
      Math.random() < 0.7 ? 'pending' : 'ditolak',
      row.kelas_id,
      'individual',
    ]);
    await chunkInsert(
      connection,
      'pengajuan_banding_absen',
      [
        'siswa_id',
        'jadwal_id',
        'tanggal_absen',
        'status_asli',
        'status_diajukan',
        'alasan_banding',
        'status_banding',
        'kelas_id',
        'jenis_banding',
      ],
      bandingRows
    );

    console.log('Seeding complete.');
  } catch (error) {
    console.error('Seed failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
