// TIMEZONE CONFIGURATION (UTC+7 / Asia/Jakarta)
const TIMEZONE = 'Asia/Jakarta';

// Day name constants (centralized to avoid duplication)
export const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const HARI_SEKOLAH = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Get Indonesian day name from date
 * @param {Date} date - Date object (default: now)
 * @returns Indonesian day name (e.g., "Senin", "Selasa")
 */
export function getHariFromDate(date = new Date()) {
    return HARI_INDONESIA[date.getDay()];
}

/**
 * Get current time in WIB timezone
 * Uses Intl API to reliably get WIB time regardless of server timezone
 * @returns Date object representing current WIB time
 */
export function getWIBTime() {
    const now = new Date();

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
    const getValue = (type) => {
        const part = parts.find(p => p.type === type);
        return part ? part.value : '0';
    };

    // Create date object with WIB values
    const wibDate = new Date(
        Number.parseInt(getValue('year')),
        Number.parseInt(getValue('month')) - 1,
        Number.parseInt(getValue('day')),
        Number.parseInt(getValue('hour')),
        Number.parseInt(getValue('minute')),
        Number.parseInt(getValue('second'))
    );

    return wibDate;
}

/**
 * Format waktu WIB ke ISO string
 * @param {Date} date - Date object to format (default: now)
 * @returns ISO string in WIB timezone
 */
export function formatWIBTime(date = null) {
    const targetDate = date || new Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(targetDate);
    const getValue = (type) => {
        const part = parts.find(p => p.type === type);
        return part ? part.value : '00';
    };

    return `${getValue('year')}-${getValue('month')}-${getValue('day')}T${getValue('hour')}:${getValue('minute')}:${getValue('second')}+07:00`;
}

/**
 * Format tanggal WIB (YYYY-MM-DD)
 * @param {Date} date - Date object to format (default: now)
 * @returns Date string in YYYY-MM-DD format
 */
export function formatWIBDate(date = null) {
    const targetDate = date || new Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(targetDate);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';

    return `${year}-${month}-${day}`;
}

/**
 * Format waktu WIB dengan detik (HH:mm:ss)
 * @param {Date} date - Date object to format (default: now)
 * @returns Time string in HH:mm:ss format
 */
export function formatWIBTimeWithSeconds(date = null) {
    const targetDate = date || new Date();

    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(targetDate);
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const second = parts.find(p => p.type === 'second')?.value || '00';

    return `${hour}:${minute}:${second}`;
}

/**
 * Get timestamp WIB
 * @returns Current timestamp
 */
export function getWIBTimestamp() {
    return new Date().getTime();
}

/**
 * Get current date in WIB for MySQL (YYYY-MM-DD)
 * USE THIS for getting today's date for database operations
 * @returns Current date string in YYYY-MM-DD format
 */
export function getMySQLDateWIB() {
    return formatWIBDate();
}

/**
 * Get current datetime in WIB for MySQL (YYYY-MM-DD HH:mm:ss)
 * USE THIS for datetime fields in database
 * @returns Current datetime string in MySQL format
 */
export function getMySQLDateTimeWIB() {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
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
    const getValue = (type) => {
        const part = parts.find(p => p.type === type);
        return part ? part.value : '00';
    };

    return `${getValue('year')}-${getValue('month')}-${getValue('day')} ${getValue('hour')}:${getValue('minute')}:${getValue('second')}`;
}

/**
 * Parse date string (YYYY-MM-DD) to Date object with WIB timezone
 * CRITICAL: Use this for date strings from frontend to avoid timezone bugs!
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns Date object
 */
export function parseDateStringWIB(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
    }

    // Add explicit WIB timezone offset
    const dateTimeStr = `${dateStr}T00:00:00+07:00`;
    return new Date(dateTimeStr);
}

/**
 * Calculate difference in days between two dates
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @returns Number of days difference
 */
export function getDaysDifferenceWIB(date1, date2) {
    const d1 = typeof date1 === 'string' ? parseDateStringWIB(date1) : date1;
    const d2 = typeof date2 === 'string' ? parseDateStringWIB(date2) : date2;

    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
}

/**
 * Get day name in English for WIB date (for MySQL DAYNAME compatibility)
 * MySQL DAYNAME returns English day names: Sunday, Monday, etc.
 * @param {Date} date - Date object (default: now in WIB)
 * @returns Day name in English (e.g., "Monday", "Tuesday")
 */
export function getDayNameWIB(date = null) {
    const targetDate = date || new Date();

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        weekday: 'long'
    });

    return formatter.format(targetDate);
}
