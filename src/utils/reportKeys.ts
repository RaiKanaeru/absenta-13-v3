// Report Keys untuk sinkronisasi KOP laporan
// Harus sinkron dengan backend/utils/letterheadService.js

export const REPORT_KEYS = {
  // Laporan Siswa
  KEHADIRAN_SISWA: 'REPORT_KEHADIRAN_SISWA',
  PRESENSI_SISWA: 'REPORT_PRESENSI_SISWA',
  REKAP_KETIDAKHADIRAN: 'REPORT_REKAP_KETIDAKHADIRAN',
  
  // Laporan Guru
  LAPORAN_GURU: 'REPORT_LAPORAN_GURU',
  REKAP_KETIDAKHADIRAN_GURU: 'REPORT_REKAP_KETIDAKHADIRAN_GURU',
  ABSENSI_GURU: 'REPORT_ABSENSI_GURU',
  
  // Laporan Pengajuan
  BANDING_ABSEN: 'REPORT_BANDING_ABSEN',
  
  // Laporan Live & Analytics
  LIVE_STUDENT_ATTENDANCE: 'REPORT_LIVE_STUDENT_ATTENDANCE',
  LIVE_TEACHER_ATTENDANCE: 'REPORT_LIVE_TEACHER_ATTENDANCE',
  ANALYTICS_DASHBOARD: 'REPORT_ANALYTICS_DASHBOARD',

  // Laporan Jadwal
  JADWAL_PELAJARAN: 'REPORT_JADWAL_PELAJARAN'
} as const;

// Mapping untuk dropdown di ReportLetterheadSettings
export const REPORT_KEYS_OPTIONS = [
  { value: REPORT_KEYS.KEHADIRAN_SISWA, label: 'Ringkasan Kehadiran Siswa' },
  { value: REPORT_KEYS.LAPORAN_GURU, label: 'Ringkasan Kehadiran Guru' },
  { value: REPORT_KEYS.BANDING_ABSEN, label: 'Riwayat Pengajuan Banding Absen' },
  { value: REPORT_KEYS.PRESENSI_SISWA, label: 'Presensi Siswa' },
  { value: REPORT_KEYS.REKAP_KETIDAKHADIRAN, label: 'Rekap Ketidakhadiran Siswa' },
  { value: REPORT_KEYS.REKAP_KETIDAKHADIRAN_GURU, label: 'Rekap Ketidakhadiran Guru' },
  { value: REPORT_KEYS.ABSENSI_GURU, label: 'Absensi Guru' },
  { value: REPORT_KEYS.JADWAL_PELAJARAN, label: 'Jadwal Pelajaran' },
  { value: REPORT_KEYS.LIVE_STUDENT_ATTENDANCE, label: 'Pemantauan Siswa Langsung' },
  { value: REPORT_KEYS.LIVE_TEACHER_ATTENDANCE, label: 'Pemantauan Guru Langsung' },
  { value: REPORT_KEYS.ANALYTICS_DASHBOARD, label: 'Dasbor Analitik' }
];

// Mapping dari view ID ke report key
export const VIEW_TO_REPORT_KEY: Record<string, string> = {
  // Backward compatibility for legacy teacher report views
  'reports': REPORT_KEYS.KEHADIRAN_SISWA,
  'student-attendance-summary': REPORT_KEYS.KEHADIRAN_SISWA,
  'teacher-attendance-summary': REPORT_KEYS.LAPORAN_GURU,
  'banding-absen-report': REPORT_KEYS.BANDING_ABSEN,
  'presensi-siswa': REPORT_KEYS.PRESENSI_SISWA,
  'rekap-ketidakhadiran': REPORT_KEYS.REKAP_KETIDAKHADIRAN,
  'rekap-ketidakhadiran-guru': REPORT_KEYS.REKAP_KETIDAKHADIRAN_GURU,
  'live-student-attendance': REPORT_KEYS.LIVE_STUDENT_ATTENDANCE,
  'live-teacher-attendance': REPORT_KEYS.LIVE_TEACHER_ATTENDANCE,
  'analytics-dashboard': REPORT_KEYS.ANALYTICS_DASHBOARD
};

export type ReportKey = typeof REPORT_KEYS[keyof typeof REPORT_KEYS];
