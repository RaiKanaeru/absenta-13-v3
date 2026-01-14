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
  status: 'aktif' | 'nonaktif';
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
