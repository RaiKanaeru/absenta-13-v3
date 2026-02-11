// =============================================================================
// Auth Types
// Extracted from Index.tsx for reuse across the application.
// =============================================================================

export type AppState = 'login' | 'dashboard';
export type UserRole = 'admin' | 'guru' | 'siswa' | null;

export interface UserData {
  id: number;
  username: string;
  nama: string;
  role: UserRole;
  // Admin specific — no additional fields
  // Guru specific
  guru_id?: number;
  nip?: string;
  mapel?: string;
  // Siswa specific
  siswa_id?: number;
  nis?: string;
  kelas?: string;
  kelas_id?: number;
}

/** UserData with required guru fields */
export type GuruUserData = UserData & {
  guru_id: number;
  nip: string;
  mapel: string;
};

/** UserData with required siswa fields */
export type SiswaUserData = UserData & {
  siswa_id: number;
  nis: string;
  kelas: string;
  kelas_id: number;
};
