import React from 'react';
import { Badge } from "@/components/ui/badge";

/**
 * Helper component for displaying multi-guru list (S2004 - extracted to reduce nesting)
 */
export const MultiGuruDisplay = ({ guruList }: { guruList: string }) => (
  <div className="text-xs text-green-600 mt-1">
    <div className="font-medium">Multi-Guru:</div>
    {guruList.split('||').map((guru) => {
      const [guruId, guruName] = guru.split(':');
      return (
        <div key={`guru-${guruId}`} className="text-xs text-green-700 truncate">- {guruName}</div>
      );
    })}
  </div>
);

/**
 * Helper component for displaying teacher badges (S3358 - extracted to reduce nested ternary)
 */
export const TeacherBadgeDisplay = ({ guruList, namaGuru }: { guruList?: string; namaGuru?: string }) => {
  // Case 1: Multi-guru with || separator
  if (guruList?.includes('||')) {
    return (
      <>
        {guruList.split('||').map((guru) => {
          const guruId = guru.split(':')[0];
          return (
            <Badge key={`guru-${guruId}`} variant="outline" className="text-xs bg-blue-50 text-blue-700">
              {guru.split(':')[1]}
            </Badge>
          );
        })}
      </>
    );
  }
  // Case 2: Multiple teachers comma-separated
  if (namaGuru?.includes(',')) {
    return (
      <>
        {namaGuru.split(',').map((guru) => {
          const trimmedName = guru.trim();
          return (
            <Badge key={`name-${trimmedName}`} variant="outline" className="text-xs bg-blue-50 text-blue-700">
              {trimmedName}
            </Badge>
          );
        })}
      </>
    );
  }
  // Case 3: Single teacher
  return (
    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
      {namaGuru || '-'}
    </Badge>
  );
};

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
 * Status color mappings for attendance badges (extracted to reduce nested ternaries)
 */
export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  'Hadir': 'bg-green-100 text-green-800',
  'Sakit': 'bg-yellow-100 text-yellow-800',
  'Izin': 'bg-yellow-100 text-yellow-800',
  'Dispen': 'bg-purple-100 text-purple-800',
  'Belum Absen': 'bg-gray-100 text-gray-800',
  'Alpa': 'bg-red-100 text-red-800',
  'Tidak Hadir': 'bg-red-100 text-red-800',
};

export const getAttendanceStatusColor = (status: string): string => {
  return ATTENDANCE_STATUS_COLORS[status] || 'bg-red-100 text-red-800';
};

/**
 * Time status color mappings
 */
export const TIME_STATUS_COLORS: Record<string, string> = {
  'Tepat Waktu': 'bg-green-100 text-green-800',
  'Terlambat Ringan': 'bg-yellow-100 text-yellow-800',
  'Terlambat': 'bg-orange-100 text-orange-800',
  'Terlambat Berat': 'bg-red-100 text-red-800',
};

export const getTimeStatusColor = (status: string | undefined): string => {
  if (!status) return 'bg-gray-100 text-gray-600';
  return TIME_STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
};

/**
 * Period color mappings
 */
export const PERIOD_COLORS: Record<string, string> = {
  'Pagi': 'bg-blue-100 text-blue-800',
  'Siang': 'bg-yellow-100 text-yellow-800',
  'Sore': 'bg-orange-100 text-orange-800',
};

export const getPeriodColor = (period: string | undefined): string => {
  if (!period) return 'bg-gray-100 text-gray-600';
  return PERIOD_COLORS[period] || 'bg-gray-100 text-gray-600';
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


