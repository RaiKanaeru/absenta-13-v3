/**
 * Shared types for Student Dashboard components
 * Extracted from StudentDashboard_Modern.tsx to reduce file size
 */

// =============================================================================
// STATUS TYPES
// =============================================================================

export type BandingStatusAsli = 'Hadir' | 'hadir' | 'Izin' | 'izin' | 'Sakit' | 'sakit' | 'Alpa' | 'alpa' | 'Dispen' | 'dispen';
export type BandingStatusDiajukan = 'Hadir' | 'hadir' | 'Izin' | 'izin' | 'Sakit' | 'sakit';
export type BandingStatus = 'pending' | 'disetujui' | 'ditolak';
export type JenisAktivitas = 'pelajaran' | 'upacara' | 'istirahat' | 'kegiatan_khusus' | 'libur' | 'ujian' | 'lainnya';

// =============================================================================
// GURU TYPES
// =============================================================================

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

// =============================================================================
// JADWAL TYPES
// =============================================================================

export interface JadwalHariIni {
  id_jadwal: number;
  jam_ke: number;
  jam_mulai: string;
  jam_selesai: string;
  nama_mapel: string;
  kode_mapel: string;
  nama_guru: string;
  nip: string;
  nama_kelas: string;
  kode_ruang?: string;
  nama_ruang?: string;
  lokasi?: string;
  status_kehadiran: string;
  keterangan?: string;
  waktu_catat?: string;
  tanggal_target?: string;
  jenis_aktivitas?: JenisAktivitas;
  is_absenable?: boolean;
  keterangan_khusus?: string;
  is_multi_guru?: boolean;
  guru_list?: GuruInSchedule[];
  is_primary?: boolean;
  keterangan_guru?: string;
  id_guru?: number;
  guru_id?: number;
}

// =============================================================================
// DATA TYPES
// =============================================================================

export interface KehadiranData {
  [key: string]: {
    status: string;
    keterangan: string;
    guru_id?: number;
  };
}

export interface RiwayatJadwal {
  jadwal_id: number;
  jam_ke: number;
  jam_mulai: string;
  jam_selesai: string;
  nama_mapel: string;
  nama_guru: string;
  kode_ruang?: string;
  nama_ruang?: string;
  total_siswa: number;
  total_hadir: number;
  total_izin: number;
  total_sakit: number;
  total_alpa: number;
  total_tidak_hadir?: number;
  is_multi_guru?: boolean;
  guru_list?: GuruInSchedule[];
  siswa_tidak_hadir?: Array<{
    nama_siswa: string;
    nis: string;
    status: string;
    keterangan?: string;
    nama_pencatat?: string;
  }>;
}

export interface RiwayatData {
  tanggal: string;
  jadwal: RiwayatJadwal[];
}

// =============================================================================
// BANDING TYPES
// =============================================================================

export interface BandingAbsen {
  id_banding: number;
  siswa_id: number;
  jadwal_id: number;
  tanggal_absen: string;
  status_asli: BandingStatusAsli;
  status_diajukan: BandingStatusDiajukan;
  alasan_banding: string;
  status_banding: BandingStatus;
  catatan_guru?: string;
  tanggal_pengajuan: string;
  tanggal_keputusan?: string;
  nama_mapel?: string;
  nama_guru?: string;
  jam_mulai?: string;
  jam_selesai?: string;
  nama_kelas?: string;
  jenis_banding?: 'individual';
  nama_siswa?: string;
}

// =============================================================================
// FORM TYPES
// =============================================================================

export type StatusType = 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen';

export interface FormBanding {
  jadwal_id: string;
  tanggal_absen: string;
  siswa_banding: Array<{
    nama: string;
    status_asli: StatusType;
    status_diajukan: StatusType;
    alasan_banding: string;
  }>;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
