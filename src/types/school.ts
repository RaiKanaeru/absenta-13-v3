/**
 * Shared Types for School Management Components
 * 
 * File ini berisi interface yang digunakan bersama oleh multiple components
 * untuk menghindari duplikasi kode
 */

/**
 * Interface untuk data Kelas
 */
export interface Kelas {
  id: number;
  nama_kelas: string;
}

/**
 * Interface untuk data Siswa
 */
export interface Siswa {
  id: number;
  nama: string;
  nis: string;
  nisn: string;
  jenis_kelamin: 'L' | 'P';
  kelas_id: number;
}

/**
 * Interface untuk data Guru
 */
export interface Guru {
  id: number;
  nama: string;
  nip: string;
  mata_pelajaran?: string;
}

/**
 * Interface untuk common view props
 */
export interface ViewProps {
  onBack: () => void;
  onLogout: () => void;
}
