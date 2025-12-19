/**
 * Academic Constants
 * Shared constants for academic year, months, and effective days calculations
 */

/**
 * Academic months following Indonesian school year (July - June)
 * Ordered for academic year display
 */
export const ACADEMIC_MONTHS = [
  { key: 'JUL', name: 'Juli', number: 7 },
  { key: 'AGT', name: 'Agustus', number: 8 },
  { key: 'SEP', name: 'September', number: 9 },
  { key: 'OKT', name: 'Oktober', number: 10 },
  { key: 'NOV', name: 'November', number: 11 },
  { key: 'DES', name: 'Desember', number: 12 },
  { key: 'JAN', name: 'Januari', number: 1 },
  { key: 'FEB', name: 'Februari', number: 2 },
  { key: 'MAR', name: 'Maret', number: 3 },
  { key: 'APR', name: 'April', number: 4 },
  { key: 'MEI', name: 'Mei', number: 5 },
  { key: 'JUN', name: 'Juni', number: 6 }
] as const;

export type AcademicMonth = typeof ACADEMIC_MONTHS[number];

/**
 * Default effective working days per month
 * Can be adjusted based on actual academic calendar
 */
export const EFFECTIVE_DAYS_PER_MONTH: Record<number, number> = {
  7: 14,  // Juli
  8: 21,  // Agustus
  9: 22,  // September
  10: 23, // Oktober
  11: 20, // November
  12: 17, // Desember
  1: 15,  // Januari
  2: 20,  // Februari
  3: 22,  // Maret
  4: 22,  // April
  5: 21,  // Mei
  6: 20   // Juni
};

/**
 * Get effective working days for a given month
 * @param monthNumber - Month number (1-12)
 * @returns Number of effective working days
 */
export const getEffectiveDays = (monthNumber: number): number => {
  return EFFECTIVE_DAYS_PER_MONTH[monthNumber] || 20;
};

/**
 * Calculate total effective days for an academic year
 * @returns Total effective days from July to June
 */
export const getTotalAcademicYearDays = (): number => {
  return ACADEMIC_MONTHS.reduce((total, month) => total + getEffectiveDays(month.number), 0);
};

/**
 * Calculate effective days for a date range
 * This is a rough estimate - actual calculation should account for weekends and holidays
 * @param startDate - Start date string (YYYY-MM-DD)
 * @param endDate - End date string (YYYY-MM-DD)
 * @returns Estimated number of effective days
 */
export const calculateDateRangeEffectiveDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

/**
 * Get month name by number
 * @param monthNumber - Month number (1-12)
 * @returns Month name in Indonesian
 */
export const getMonthName = (monthNumber: number): string => {
  const month = ACADEMIC_MONTHS.find(m => m.number === monthNumber);
  return month?.name || '';
};

/**
 * Get month key by number
 * @param monthNumber - Month number (1-12)
 * @returns Short month key (e.g., 'JUL', 'AGT')
 */
export const getMonthKey = (monthNumber: number): string => {
  const month = ACADEMIC_MONTHS.find(m => m.number === monthNumber);
  return month?.key || '';
};

/**
 * Default school header information for SMKN 13
 * Used as fallback when letterhead is not configured
 */
export const DEFAULT_SCHOOL_HEADER = {
  government: 'PEMERINTAH DAERAH PROVINSI JAWA BARAT',
  department: 'DINAS PENDIDIKAN',
  branch: 'CABANG DINAS PENDIDIKAN WILAYAH VII',
  school: 'SEKOLAH MENENGAH KEJURUAN NEGERI 13',
  address: 'Jalan Soekarno - Hatta Km.10 Telepon (022) 7318960: Ext. 114',
  contact: 'Telepon/Faksimil: (022) 7332252 – Bandung 40286',
  email: 'smk13bdg@gmail.com',
  website: 'http://www.smkn13.sch.id'
} as const;
