/**
 * Utility functions for consistent time formatting across the application
 * All functions use 24-hour format (no AM/PM) and WIB timezone (UTC+7)
 * 
 * IMPORTANT NOTES:
 * - WIB (Waktu Indonesia Barat) = UTC+7 = Asia/Jakarta timezone
 * - All functions use Intl.DateTimeFormat API for reliable timezone handling
 * - Input type="date" values should be passed as strings (YYYY-MM-DD) directly to backend
 * - NEVER use `new Date(dateString)` without explicit timezone - it defaults to UTC!
 * - These functions work correctly regardless of user's browser timezone
 * 
 * USAGE RULES:
 * 1. For current date/time: use getCurrentDateWIB(), getWIBTime()
 * 2. For formatting dates: use formatDateWIB(), formatDateOnly()
 * 3. For formatting times: use formatTime24(), formatTimeWIB()
 * 4. For date inputs: keep as string YYYY-MM-DD, use formatDateWIB() for display only
 * 5. For date calculations: use parseDateStringWIB() to create Date objects safely
 */

// Timezone configuration
const TIMEZONE = 'Asia/Jakarta';

/**
 * Get current time in WIB timezone
 * Uses Intl API to reliably get WIB time regardless of browser timezone
 * @returns Date object representing current WIB time
 */
export const getWIBTime = (): Date => {
  const now = new Date();
  
  // Use Intl API to format date in WIB timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  // Create date object with WIB values
  // Note: This creates a Date in local timezone but with WIB time values
  const wibDate = new Date(
    Number.parseInt(getValue('year')),
    Number.parseInt(getValue('month')) - 1,
    Number.parseInt(getValue('day')),
    Number.parseInt(getValue('hour')),
    Number.parseInt(getValue('minute')),
    Number.parseInt(getValue('second'))
  );
  
  return wibDate;
};

/**
 * Convert any date to WIB timezone representation
 * @param date - Date object or date string
 * @returns Date object with WIB time values
 */
export const toWIBTime = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(dateObj);
  const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  const wibDate = new Date(
    Number.parseInt(getValue('year')),
    Number.parseInt(getValue('month')) - 1,
    Number.parseInt(getValue('day')),
    Number.parseInt(getValue('hour')),
    Number.parseInt(getValue('minute')),
    Number.parseInt(getValue('second'))
  );
  
  return wibDate;
};

/**
 * Format time to 24-hour format (HH:mm)
 * @param date - Date object or date string
 * @returns Formatted time string in 24-hour format
 */
export const formatTime24 = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(dateObj);
};

/**
 * Format time to 24-hour format with seconds (HH:mm:ss)
 * @param date - Date object or date string
 * @returns Formatted time string in 24-hour format with seconds
 */
export const formatTime24WithSeconds = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(dateObj);
};

/**
 * Format date with time in 24-hour format
 * @param date - Date object or date string
 * @param includeTime - Whether to include time in the output
 * @returns Formatted date string with optional time
 */
export const formatDateTime24 = (date: Date | string, includeTime: boolean = false): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (includeTime) {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(dateObj);
  }
  
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(dateObj);
};

/**
 * Format date only (without time)
 * @param date - Date object or date string
 * @returns Formatted date string (e.g., "18 Oktober 2024")
 */
export const formatDateOnly = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(dateObj);
};

/**
 * Format time range in 24-hour format
 * @param startTime - Start time string (HH:mm)
 * @param endTime - End time string (HH:mm)
 * @returns Formatted time range string
 */
export const formatTimeRange24 = (startTime: string, endTime: string): string => {
  return `${startTime} - ${endTime}`;
};

/**
 * Get current time in 24-hour format
 * @returns Current time string in 24-hour format (HH:mm:ss)
 */
export const getCurrentTime24 = (): string => {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());
};

/**
 * Get current date and time in 24-hour format
 * @returns Current date and time string (e.g., "18 Oktober 2024 14:30")
 */
export const getCurrentDateTime24 = (): string => {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
};

/**
 * Get current date in WIB timezone (YYYY-MM-DD format)
 * This is the PREFERRED function for getting today's date for input type="date"
 * @returns Current date string in YYYY-MM-DD format
 */
export const getCurrentDateWIB = (): string => {
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  
  return `${year}-${month}-${day}`;
};

/**
 * Get current year in WIB timezone
 * @returns Current year as string
 */
export const getCurrentYearWIB = (): string => {
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric'
  });
  
  return formatter.format(now).split('-')[0];
};

/**
 * Format date to YYYY-MM-DD format in WIB timezone
 * USE THIS for converting Date objects to string format for API calls
 * @param date - Date object or date string
 * @returns Formatted date string in YYYY-MM-DD format
 */
export const formatDateWIB = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(dateObj);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  
  return `${year}-${month}-${day}`;
};

/**
 * Format time to HH:mm:ss format in WIB timezone
 * @param date - Date object or date string
 * @returns Formatted time string in HH:mm:ss format
 */
export const formatTimeWIB = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(dateObj);
  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';
  const second = parts.find(p => p.type === 'second')?.value || '00';
  
  return `${hour}:${minute}:${second}`;
};

/**
 * Get min date (X days ago from today in WIB)
 * @param daysAgo - Number of days to go back (default: 30)
 * @returns Date string in YYYY-MM-DD format
 */
export const getMinDateWIB = (daysAgo: number = 30): string => {
  // Get current date in WIB as YYYY-MM-DD
  const todayStr = getCurrentDateWIB();
  
  // Parse as WIB date and subtract days
  const todayDate = parseDateStringWIB(todayStr);
  const pastDate = new Date(todayDate.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
  
  return formatDateWIB(pastDate);
};

/**
 * Get max date (today in WIB)
 * @returns Date string in YYYY-MM-DD format
 */
export const getMaxDateWIB = (): string => {
  return getCurrentDateWIB();
};

/**
 * Parse date string (YYYY-MM-DD) to Date object with WIB timezone awareness
 * CRITICAL: Use this for input type="date" values to avoid timezone shift bugs!
 * 
 * This function treats "YYYY-MM-DD" as midnight in WIB timezone, not UTC.
 * Without this, "2024-10-18" could become October 17 or 19 depending on browser timezone!
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object representing midnight WIB on that date
 */
export const parseDateStringWIB = (dateStr: string): Date => {
  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  
  // Create a date string with explicit WIB timezone offset
  // This ensures the date is interpreted correctly regardless of browser timezone
  const dateTimeStr = `${dateStr}T00:00:00+07:00`;
  
  return new Date(dateTimeStr);
};

/**
 * Parse date string safely with WIB timezone awareness
 * Handles both "YYYY-MM-DD" and "YYYY-MM-DD HH:mm:ss" formats
 * @param dateStr - Date string or Date object
 * @returns Date object in WIB timezone
 */
export const parseDateWIB = (dateStr: string | Date): Date => {
  if (dateStr instanceof Date) {
    return dateStr;
  }
  
  // If date string is YYYY-MM-DD (no time), use parseDateStringWIB
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return parseDateStringWIB(dateStr);
  }
  
  // If it has timezone info, use it directly
  if (dateStr.includes('+') || dateStr.includes('Z')) {
    return new Date(dateStr);
  }
  
  // Otherwise, treat as WIB datetime
  // Assume format is YYYY-MM-DD HH:mm:ss
  const dateTimeStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  return new Date(dateTimeStr + '+07:00');
};

/**
 * Get day name in Indonesian for a WIB date
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @returns Day name in Indonesian (e.g., "Senin", "Selasa")
 */
export const getDayNameWIB = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? parseDateStringWIB(date) : date;
  
  return new Intl.DateTimeFormat('id-ID', { 
    weekday: 'long',
    timeZone: TIMEZONE
  }).format(dateObj);
};

/**
 * Get month start and end dates in WIB
 * @param yearMonth - Year-month string in YYYY-MM format
 * @returns Object with startDate and endDate in YYYY-MM-DD format
 */
export const getMonthRangeWIB = (yearMonth: string): { startDate: string, endDate: string } => {
  const [year, month] = yearMonth.split('-').map(Number);
  
  // Create start date (first day of month) in WIB
  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  
  // Calculate last day of month
  // Use next month's first day minus 1 day
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthFirstDay = parseDateStringWIB(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`);
  const lastDayOfMonth = new Date(nextMonthFirstDay.getTime() - (24 * 60 * 60 * 1000));
  
  const endDateStr = formatDateWIB(lastDayOfMonth);
  
  return {
    startDate: startDateStr,
    endDate: endDateStr
  };
};

/**
 * Calculate difference in days between two dates (in WIB timezone)
 * @param date1 - First date (YYYY-MM-DD string or Date object)
 * @param date2 - Second date (YYYY-MM-DD string or Date object)
 * @returns Number of days difference (positive if date2 > date1)
 */
export const getDaysDifferenceWIB = (date1: Date | string, date2: Date | string): number => {
  const d1 = typeof date1 === 'string' ? parseDateStringWIB(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseDateStringWIB(date2) : date2;
  
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Add or subtract days from a date in WIB timezone
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @param days - Number of days to add (negative to subtract)
 * @returns Date string in YYYY-MM-DD format
 */
export const addDaysWIB = (date: Date | string, days: number): string => {
  const dateObj = typeof date === 'string' ? parseDateStringWIB(date) : date;
  const newDate = new Date(dateObj.getTime() + (days * 24 * 60 * 60 * 1000));
  
  return formatDateWIB(newDate);
};
