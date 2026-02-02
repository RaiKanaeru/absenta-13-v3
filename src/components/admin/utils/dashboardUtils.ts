/**
 * Creates a session expired handler for API calls (S2004 - extracted to reduce nesting depth)
 * @param onLogout - The logout callback function
 * @param toast - The toast function for notifications
 */
export const createSessionExpiredHandler = (
  onLogout: () => void,
  toast: (opts: { title: string; description: string; variant?: string }) => void
) => {
  return () => {
    toast({
      title: "Sesi Berakhir",
      description: "Sesi login Anda telah berakhir. Silakan login kembali.",
      variant: "destructive"
    });
    onLogout();
  };
};

/**
 * Activity type labels for schedule display (S3776 - extracted to reduce CC)
 */
export const ACTIVITY_EMOJI_MAP: Record<string, string> = {
  upacara: "Upacara",
  istirahat: "Istirahat",
  kegiatan_khusus: "Kegiatan Khusus",
  libur: "Libur",
  ujian: "Ujian",
  pelajaran: "Pelajaran",
  lainnya: "Lainnya"
};

/**
 * Get activity label
 */
export const getActivityEmojiLabel = (jenisAktivitas: string): string => {
  return ACTIVITY_EMOJI_MAP[jenisAktivitas] || jenisAktivitas;
};

/**
 * Generates page numbers for pagination (extracted to reduce cognitive complexity)
 * @param currentPage - Current active page
 * @param totalPages - Total number of pages
 * @param maxVisiblePages - Maximum visible page buttons (default 5)
 */
export const generatePageNumbers = (
  currentPage: number,
  totalPages: number,
  maxVisiblePages = 5
): (number | string)[] => {
  const pages: (number | string)[] = [];
  
  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }
  
  if (currentPage <= 3) {
    for (let i = 1; i <= 4; i++) pages.push(i);
    pages.push('...', totalPages);
    return pages;
  }
  
  if (currentPage >= totalPages - 2) {
    pages.push(1, '...');
    for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
    return pages;
  }
  
  pages.push(1, '...');
  for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
  pages.push('...', totalPages);
  return pages;
};

/**
 * Status color mappings for attendance badges (dark mode compatible)
 * Uses subtle opacity backgrounds with semantic text colors
 */
export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  'Hadir': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'hadir': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'Sakit': 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  'sakit': 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  'Izin': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'izin': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'Dispen': 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  'dispen': 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  'Belum Absen': 'bg-muted text-muted-foreground',
  'Alpa': 'bg-destructive/15 text-destructive',
  'alpa': 'bg-destructive/15 text-destructive',
  'Tidak Hadir': 'bg-destructive/15 text-destructive',
};

export const getAttendanceStatusColor = (status: string): string => {
  return ATTENDANCE_STATUS_COLORS[status] || 'bg-destructive/15 text-destructive';
};

/**
 * Time status color mappings (dark mode compatible)
 */
export const TIME_STATUS_COLORS: Record<string, string> = {
  'Tepat Waktu': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'Terlambat Ringan': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'Terlambat': 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  'Terlambat Berat': 'bg-destructive/15 text-destructive',
};

export const getTimeStatusColor = (status: string | undefined): string => {
  if (!status) return 'bg-muted text-muted-foreground';
  return TIME_STATUS_COLORS[status] || 'bg-muted text-muted-foreground';
};

/**
 * Period color mappings (dark mode compatible)
 */
export const PERIOD_COLORS: Record<string, string> = {
  'Pagi': 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  'Siang': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'Sore': 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
};

export const getPeriodColor = (period: string | undefined): string => {
  if (!period) return 'bg-muted text-muted-foreground';
  return PERIOD_COLORS[period] || 'bg-muted text-muted-foreground';
};

/**
 * Activity type display mapping for schedules
 */
export const ACTIVITY_DISPLAY_MAP: Record<string, string> = {
  upacara: "Upacara",
  istirahat: "Istirahat",
  kegiatan_khusus: "Kegiatan Khusus",
  libur: "Libur",
  ujian: "Ujian",
};


export const getActivityDisplay = (activity: string): string => {
  return ACTIVITY_DISPLAY_MAP[activity] || activity;
};

/**
 * Helper to get submit button label (avoids nested ternary S3358)
 */
export const getSubmitButtonLabel = (
  isLoading: boolean, 
  editingId: number | null | undefined, 
  loadingText = 'Menyimpan...', 
  updateText = 'Update', 
  addText = 'Tambah'
): string => {
  if (isLoading) return loadingText;
  if (editingId) return updateText;
  return addText;
};
