export interface Teacher {
  id: number;
  nip: string;
  nama: string;
  username: string;
  email?: string;
  no_telp?: string;
  jenis_kelamin?: 'L' | 'P';
  alamat?: string;
  address?: string;
  user_alamat?: string;
  user_address?: string;
  status: 'aktif' | 'nonaktif';
  mata_pelajaran?: string;
  mapel_id?: number;
  nama_mapel?: string;
  user_id?: number;
  user_username?: string;
  user_email?: string;
  user_status?: string;
}

export interface TeacherData {
  id: number;
  nip: string;
  nama: string;
  email?: string;
  mata_pelajaran?: string;
  alamat?: string;
  telepon?: string;
  jenis_kelamin: 'L' | 'P';
  status: 'aktif' | 'nonaktif';
}

export interface Student {
  id: number;
  nis: string;
  nama: string;
  kelas_id: number;
  nama_kelas: string;
  username?: string;
  email?: string;
  jenis_kelamin: 'L' | 'P';
  jabatan?: string;
  status: 'aktif' | 'tidak_aktif' | 'ditangguhkan';
  alamat?: string;
  telepon_orangtua?: string;
  nomor_telepon_siswa?: string;
}


export interface StudentData {
  id_siswa: number;
  nis: string;
  nama: string;
  kelas_id: number;
  nama_kelas?: string;
  jenis_kelamin: 'L' | 'P';
  alamat?: string;
  telepon_orangtua?: string;
  nomor_telepon_siswa?: string;
  status: 'aktif' | 'nonaktif';
  username?: string;
  password?: string;
  email?: string;
  jabatan?: string;
}

export interface Subject {
  id: number;
  kode_mapel: string;
  nama_mapel: string;
  deskripsi?: string;
  status: 'aktif' | 'tidak_aktif';
}

export interface Kelas {
  id: number;
  id_kelas?: number;
  nama_kelas: string;
  tingkat?: string;
  status?: 'aktif' | 'tidak_aktif';
}

export interface Schedule {
  id: number;
  kelas_id: number;
  mapel_id: number | null;
  guru_id: number | null;
  ruang_id?: number;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  jam_ke?: number;
  jenis_aktivitas: 'pelajaran' | 'upacara' | 'istirahat' | 'kegiatan_khusus' | 'libur' | 'ujian' | 'lainnya';
  is_absenable: boolean;
  keterangan_khusus: string | null;
  is_multi_guru: boolean;
  guru_list?: string; // Format: "1:Budi||2:Siti"
  guru_ids?: number[];
  guru_names?: string[];
  nama_kelas: string;
  nama_mapel: string;
  nama_guru: string;
  kode_ruang?: string;
  nama_ruang?: string;
  lokasi?: string;
}

export interface Room {
  id: number;
  kode_ruang: string;
  nama_ruang?: string;
  lokasi?: string;
  kapasitas?: number;
  status: 'aktif' | 'tidak_aktif';
  created_at: string;
}

export interface LiveData {
  ongoing_classes: Array<{
    id?: number;
    id_kelas?: number;
    kelas: string;
    guru: string;
    mapel: string;
    jam: string;
    nama_kelas?: string;
    nama_mapel?: string;
    nama_guru?: string;
    jam_mulai?: string;
    jam_selesai?: string;
    absensi_diambil?: number;
  }>;
  overall_attendance_percentage?: string;
}

export interface GuruInSchedule {
  id_guru: number;
  nama_guru: string;
  nip: string;
  is_primary?: boolean;
  status_kehadiran: string;
  keterangan_guru?: string;
  waktu_absen?: string;
  is_submitted?: boolean;
}

export interface LiveStudentRow {
  id?: number;
  nama: string;
  nis: string;
  nama_kelas: string;
  status: string;
  waktu_absen: string | null;
  keterangan: string | null;
  keterangan_waktu?: string;
  periode_absen?: string;
}

export interface LiveTeacherRow {
  id?: number;
  nama: string;
  nip: string;
  nama_mapel: string;
  nama_kelas: string;
  jam_mulai: string;
  jam_selesai: string;
  status: string;
  waktu_absen: string | null;
  keterangan: string | null;
  keterangan_waktu?: string;
  periode_absen?: string;
}

export type ReportDataRow = Record<string, string | number | boolean>;

// ============================================================
// NEW TYPES: Schedule Management Enhancement (2026-01-16)
// ============================================================

/**
 * Jam Pelajaran - Durasi jam per hari dengan variasi (Jumat lebih pendek)
 */
export interface JamPelajaran {
  id: number;
  hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
  jam_ke: number; // 0 = Pembiasaan, 1-12 = Jam pelajaran
  jam_mulai: string;
  jam_selesai: string;
  durasi_menit: number;
  jenis: 'pelajaran' | 'istirahat' | 'pembiasaan';
  label?: string; // 'Upacara', 'Tadarus', 'Istirahat Dzuhur', etc.
  tahun_ajaran: string;
}

/**
 * Guru Availability - Ketersediaan guru per hari
 */
export interface GuruAvailability {
  id: number;
  guru_id: number;
  nama_guru?: string;
  hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
  is_available: boolean;
  keterangan?: string;
  tahun_ajaran: string;
}

/**
 * App Settings - Config dinamis per tahun ajaran
 */
export interface AppSetting {
  setting_key: string;
  setting_value: unknown;
  category: string;
  description?: string;
}

/**
 * Ruang Mapel Binding - Lab terikat mapel tertentu
 */
export interface RuangMapelBinding {
  id: number;
  ruang_id: number;
  mapel_id: number;
  is_exclusive: boolean;
  kode_ruang?: string;
  nama_mapel?: string;
}

/**
 * Schedule Conflict Result
 */
export interface ScheduleConflict {
  type: 'guru' | 'ruang' | 'kelas';
  message: string;
  conflicting_schedule?: {
    id: number;
    nama_kelas: string;
    nama_mapel: string;
    jam_mulai: string;
    jam_selesai: string;
  };
}

