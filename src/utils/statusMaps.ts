// =============================================================================
// Shared Status Maps & Color Utilities
// Centralized definitions for attendance, activity, banding status styling.
// Previously duplicated across AdminDashboard, StudentDashboard, BandingAbsenView,
// RiwayatBandingAbsenView, and StudentDashboardComponents.
// =============================================================================

// -----------------------------------------------------------------------------
// Attendance Status
// -----------------------------------------------------------------------------

/** Badge colors for attendance status (case-insensitive lookup) */
const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  'Hadir': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'hadir': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'Sakit': 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  'sakit': 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  'Izin': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'izin': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'Dispen': 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  'dispen': 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  'Belum Absen': 'bg-muted text-muted-foreground',
  'belum_diambil': 'bg-muted text-muted-foreground',
  'Alpa': 'bg-destructive/15 text-destructive',
  'alpa': 'bg-destructive/15 text-destructive',
  'Tidak Hadir': 'bg-destructive/15 text-destructive',
  'tidak hadir': 'bg-destructive/15 text-destructive',
  'tidak_hadir': 'bg-destructive/15 text-destructive',
};

/** Get attendance status color class. Fallback: destructive. */
export const getAttendanceStatusColor = (status: string): string => {
  return ATTENDANCE_STATUS_COLORS[status] || 'bg-destructive/15 text-destructive';
};

/** Badge colors with border-0 variant (used in StudentDashboard, BandingAbsenView) */
const ATTENDANCE_BADGE_COLORS: Record<string, string> = {
  'Hadir': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0',
  'hadir': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0',
  'Tidak Hadir': 'bg-destructive/15 text-destructive border-0',
  'tidak hadir': 'bg-destructive/15 text-destructive border-0',
  'Alpa': 'bg-destructive/15 text-destructive border-0',
  'alpa': 'bg-destructive/15 text-destructive border-0',
  'Izin': 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0',
  'izin': 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0',
  'Sakit': 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-0',
  'sakit': 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-0',
  'Dispen': 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-0',
  'dispen': 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-0',
};

/** Get attendance badge class with border-0. Fallback: muted. */
export const getAttendanceBadgeClass = (status: string): string => {
  return ATTENDANCE_BADGE_COLORS[status] || 'bg-muted text-muted-foreground';
};

/** Attendance status label normalization */
const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  'Hadir': 'Hadir',
  'hadir': 'Hadir',
  'Izin': 'Izin',
  'izin': 'Izin',
  'Sakit': 'Sakit',
  'sakit': 'Sakit',
  'Alpa': 'Alpa',
  'alpa': 'Alpa',
  'Dispen': 'Dispen',
  'dispen': 'Dispen',
  'belum_diambil': 'Belum Diabsen',
  'Tidak Hadir': 'Tidak Hadir',
  'tidak hadir': 'Tidak Hadir',
  'tidak_hadir': 'Tidak Hadir',
  'terlambat': 'Terlambat',
};

/** Get normalized attendance status label */
export const getAttendanceStatusLabel = (status: string): string => {
  return ATTENDANCE_STATUS_LABELS[status] || status;
};

/** Button class for attendance status selection in student view */
export const getStatusButtonClass = (status: string, isSelected: boolean): string => {
  if (!isSelected) return 'bg-background text-foreground border-input hover:bg-accent';
  const colorMap: Record<string, string> = {
    'Hadir': 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700',
    'hadir': 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700',
    'Alpa': 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90',
    'alpa': 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90',
  };
  return colorMap[status] || 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600';
};

/**
 * Teacher view variant for attendance badge classes.
 * Matches the original teacher components (no border-0 and muted fallback uses text-foreground).
 */
export const getTeacherAttendanceBadgeClass = (status: string): string => {
  const normalized = status.toLowerCase();
  if (normalized === 'hadir') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
  if (normalized === 'izin') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  if (normalized === 'sakit') return 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
  if (normalized === 'alpa' || normalized === 'tidak hadir' || normalized === 'tidak_hadir') {
    return 'bg-destructive/15 text-destructive';
  }
  return 'bg-muted text-foreground';
};

// -----------------------------------------------------------------------------
// Activity Type
// -----------------------------------------------------------------------------

/** Activity type display labels */
const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  upacara: 'Upacara',
  istirahat: 'Istirahat',
  kegiatan_khusus: 'Kegiatan Khusus',
  libur: 'Libur',
  ujian: 'Ujian',
  pelajaran: 'Pelajaran',
  lainnya: 'Lainnya',
};

/** Get activity type display label */
export const getActivityTypeLabel = (jenisAktivitas: string | undefined): string => {
  if (!jenisAktivitas) return 'Khusus';
  return ACTIVITY_TYPE_LABELS[jenisAktivitas] || jenisAktivitas;
};

// -----------------------------------------------------------------------------
// Banding (Appeal) Status
// -----------------------------------------------------------------------------

/** Banding status labels */
const BANDING_STATUS_LABELS: Record<string, string> = {
  'pending': 'Menunggu',
  'disetujui': 'Disetujui',
  'ditolak': 'Ditolak',
};

/** Get banding status label */
export const getBandingStatusLabel = (status: string): string => {
  return BANDING_STATUS_LABELS[status] || status;
};

/** Banding status badge colors */
const BANDING_STATUS_COLORS: Record<string, string> = {
  'pending': 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0',
  'disetujui': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0',
  'ditolak': 'bg-destructive/15 text-destructive border-0',
};

/** Get banding status badge class (non-interactive base). */
export const getBandingStatusClass = (status: string): string => {
  return BANDING_STATUS_COLORS[status] || 'bg-muted text-muted-foreground';
};

/** Banding status badge colors for interactive elements (adds hover classes) */
const BANDING_STATUS_COLORS_INTERACTIVE: Record<string, string> = {
  'pending': 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 hover:bg-amber-500/25',
  'disetujui': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0 hover:bg-emerald-500/25',
  'ditolak': 'bg-destructive/15 text-destructive border-0 hover:bg-destructive/25',
};

/** Get banding status badge class for interactive elements (hover). */
export const getBandingStatusInteractiveClass = (status: string): string => {
  return BANDING_STATUS_COLORS_INTERACTIVE[status] || BANDING_STATUS_COLORS_INTERACTIVE.pending;
};

/**
 * Teacher view variant for banding badge classes.
 * Matches the original teacher components (no border-0, no hover).
 */
export const getTeacherBandingStatusClass = (status: string): string => {
  if (status === 'disetujui') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
  if (status === 'ditolak') return 'bg-destructive/15 text-destructive';
  return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
};

// -----------------------------------------------------------------------------
// Time / Period (Admin Dashboard specific but shared for consistency)
// -----------------------------------------------------------------------------

/** Time status color classes */
const TIME_STATUS_COLORS: Record<string, string> = {
  'Tepat Waktu': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'Terlambat Ringan': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'Terlambat': 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  'Terlambat Berat': 'bg-destructive/15 text-destructive',
};

/** Get time status color class */
export const getTimeStatusColor = (status: string | undefined): string => {
  if (!status) return 'bg-muted text-muted-foreground';
  return TIME_STATUS_COLORS[status] || 'bg-muted text-muted-foreground';
};

/** Period color classes */
const PERIOD_COLORS: Record<string, string> = {
  'Pagi': 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  'Siang': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'Sore': 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
};

/** Get period color class */
export const getPeriodColor = (period: string | undefined): string => {
  if (!period) return 'bg-muted text-muted-foreground';
  return PERIOD_COLORS[period] || 'bg-muted text-muted-foreground';
};
