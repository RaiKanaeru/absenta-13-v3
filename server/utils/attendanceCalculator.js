/**
 * Attendance Calculator Utility
 * Centralized helper for calculating effective days and attendance percentages
 * 
 * This module fetches effective days from kalender_akademik table
 * and provides consistent calculation methods across the application.
 */

import { createLogger } from './logger.js';

const logger = createLogger('AttendanceCalculator');

// Simple in-memory cache
const CACHE = {
    effectiveDays: {}, // Key: tahunPelajaran, Value: { data: map, timestamp: number }
    ttl: 3600 * 1000 // 1 hour
};

// Default fallback values when database is unavailable
const DEFAULT_HARI_EFEKTIF_MAP = {
    1: 21, 2: 20, 3: 22, 4: 20, 5: 20, 6: 18,
    7: 21, 8: 21, 9: 21, 10: 22, 11: 21, 12: 18
};

// Semester month definitions
const SEMESTER_MONTHS = {
    gasal: [7, 8, 9, 10, 11, 12],  // Juli - Desember
    genap: [1, 2, 3, 4, 5, 6]       // Januari - Juni
};

/**
 * Get effective days map from kalender_akademik for a tahun pelajaran
 * Uses in-memory caching to reduce DB hits
 * @param {string} tahunPelajaran - Academic year (e.g., "2025/2026")
 * @returns {Promise<Object>} Map of month -> effective days
 */
export const getEffectiveDaysMapFromDB = async (tahunPelajaran) => {
    // Check cache first
    const now = Date.now();
    const cached = CACHE.effectiveDays[tahunPelajaran];
    
    if (cached && (now - cached.timestamp < CACHE.ttl)) {
        logger.debug('Using cached effective days', { tahunPelajaran });
        return cached.data;
    }

    try {
        const [rows] = await globalThis.dbPool.execute(
            'SELECT bulan, hari_efektif FROM kalender_akademik WHERE tahun_pelajaran = ?',
            [tahunPelajaran]
        );

        if (rows.length === 0) {
            logger.warn('No kalender_akademik data found, using defaults', { tahunPelajaran });
            return { ...DEFAULT_HARI_EFEKTIF_MAP };
        }

        const map = { ...DEFAULT_HARI_EFEKTIF_MAP };
        rows.forEach(row => {
            map[row.bulan] = row.hari_efektif;
        });

        // Update cache
        CACHE.effectiveDays[tahunPelajaran] = {
            data: map,
            timestamp: now
        };

        logger.debug('Fetched effective days from DB', { tahunPelajaran, source: 'database' });
        return map;
    } catch (error) {
        logger.error('Failed to fetch effective days from DB', { 
            error: error.message, 
            tahunPelajaran 
        });
        return { ...DEFAULT_HARI_EFEKTIF_MAP };
    }
};

/**
 * Get effective days for a specific month
 * @param {number} bulan - Month number (1-12)
 * @param {number} tahun - Year
 * @returns {Promise<number>} Effective days for the month
 */
export const getEffectiveDaysForMonth = async (bulan, tahun) => {
    try {
        const [rows] = await globalThis.dbPool.execute(
            'SELECT hari_efektif FROM kalender_akademik WHERE bulan = ? AND tahun = ?',
            [bulan, tahun]
        );

        if (rows.length > 0) {
            return rows[0].hari_efektif;
        }

        // Fallback to default
        return DEFAULT_HARI_EFEKTIF_MAP[bulan] || 20;
    } catch (error) {
        logger.error('getEffectiveDaysForMonth error', { error: error.message, bulan, tahun });
        return DEFAULT_HARI_EFEKTIF_MAP[bulan] || 20;
    }
};

/**
 * Calculate total effective days for a semester
 * @param {string} tahunPelajaran - Academic year (e.g., "2025/2026")
 * @param {string} semester - 'gasal' or 'genap'
 * @returns {Promise<{totalDays: number, monthlyBreakdown: Object, source: string}>}
 */
export const getSemesterEffectiveDays = async (tahunPelajaran, semester = 'gasal') => {
    const months = SEMESTER_MONTHS[semester] || SEMESTER_MONTHS.gasal;
    const hariEfektifMap = await getEffectiveDaysMapFromDB(tahunPelajaran);
    
    let totalDays = 0;
    const monthlyBreakdown = {};
    
    months.forEach(month => {
        const days = hariEfektifMap[month] || DEFAULT_HARI_EFEKTIF_MAP[month] || 20;
        monthlyBreakdown[month] = days;
        totalDays += days;
    });

    logger.info('Calculated semester effective days', {
        tahunPelajaran,
        semester,
        totalDays,
        monthlyBreakdown
    });

    return {
        totalDays,
        monthlyBreakdown,
        source: 'kalender_akademik'
    };
};

/**
 * Calculate total effective days for a full academic year
 * @param {string} tahunPelajaran - Academic year (e.g., "2025/2026")
 * @returns {Promise<{totalDays: number, semesterGasal: number, semesterGenap: number, monthlyBreakdown: Object}>}
 */
export const getYearlyEffectiveDays = async (tahunPelajaran) => {
    const hariEfektifMap = await getEffectiveDaysMapFromDB(tahunPelajaran);
    
    let semesterGasal = 0;
    let semesterGenap = 0;
    const monthlyBreakdown = {};

    // Gasal (Jul-Dec)
    SEMESTER_MONTHS.gasal.forEach(month => {
        const days = hariEfektifMap[month] || DEFAULT_HARI_EFEKTIF_MAP[month] || 20;
        monthlyBreakdown[month] = days;
        semesterGasal += days;
    });

    // Genap (Jan-Jun)
    SEMESTER_MONTHS.genap.forEach(month => {
        const days = hariEfektifMap[month] || DEFAULT_HARI_EFEKTIF_MAP[month] || 20;
        monthlyBreakdown[month] = days;
        semesterGenap += days;
    });

    const totalDays = semesterGasal + semesterGenap;

    logger.info('Calculated yearly effective days', {
        tahunPelajaran,
        totalDays,
        semesterGasal,
        semesterGenap
    });

    return {
        totalDays,
        semesterGasal,
        semesterGenap,
        monthlyBreakdown
    };
};

/**
 * Calculate effective days for a date range
 * Uses kalender_akademik for accurate calculation
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} [tahunPelajaran] - Optional academic year for lookup
 * @returns {Promise<number>} Total effective days
 */
export const calculateEffectiveDaysForRange = async (startDate, endDate, tahunPelajaran = null) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // For very short ranges (< 15 days), use business days calculation
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays < 15) {
        let businessDays = 0;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) businessDays++; // Exclude Sun (0) and Sat (6)
        }
        logger.debug('Short range - using business days calculation', { 
            startDate, 
            endDate, 
            businessDays 
        });
        return businessDays || 1; // Prevent zero division
    }

    // For longer ranges, use kalender_akademik
    let hariEfektifMap;
    if (tahunPelajaran) {
        hariEfektifMap = await getEffectiveDaysMapFromDB(tahunPelajaran);
    } else {
        // Derive tahun pelajaran from date range
        const startYear = start.getFullYear();
        const startMonth = start.getMonth() + 1;
        const derivedTahunPelajaran = startMonth >= 7 
            ? `${startYear}/${startYear + 1}` 
            : `${startYear - 1}/${startYear}`;
        hariEfektifMap = await getEffectiveDaysMapFromDB(derivedTahunPelajaran);
    }

    let totalDays = 0;
    const MAX_ITERATIONS = 60; // Max 5 years
    let safetyCounter = 0;

    for (
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        current <= end && safetyCounter < MAX_ITERATIONS;
        current.setMonth(current.getMonth() + 1), safetyCounter++
    ) {
        const monthIndex = current.getMonth() + 1; // 1-12
        
        // Check if this month is fully within range
        const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        
        if (monthStart >= start && monthEnd <= end) {
            // Full month - use map value
            totalDays += hariEfektifMap[monthIndex] || DEFAULT_HARI_EFEKTIF_MAP[monthIndex] || 20;
        } else {
            // Partial month - calculate proportionally
            const daysInMonth = monthEnd.getDate();
            const effectiveStart = monthStart < start ? start.getDate() : 1;
            const effectiveEnd = monthEnd > end ? end.getDate() : daysInMonth;
            const proportion = (effectiveEnd - effectiveStart + 1) / daysInMonth;
            const monthEffectiveDays = hariEfektifMap[monthIndex] || DEFAULT_HARI_EFEKTIF_MAP[monthIndex] || 20;
            totalDays += Math.round(monthEffectiveDays * proportion);
        }
    }

    if (safetyCounter >= MAX_ITERATIONS) {
        logger.warn('Safety breaker triggered in calculateEffectiveDaysForRange', {
            startDate,
            endDate,
            iterations: safetyCounter
        });
    }

    logger.debug('Calculated effective days for range', {
        startDate,
        endDate,
        totalDays
    });

    return totalDays || 1; // Prevent zero division
};

/**
 * Calculate attendance percentage with validation
 * @param {number} hadirCount - Number of days present (including dispen)
 * @param {number} totalEffectiveDays - Total effective days
 * @param {Object} [options] - Options
 * @param {boolean} [options.logWarning=true] - Log warning if percentage > 100
 * @param {string} [options.context=''] - Context for logging
 * @returns {{percentage: number, capped: boolean, raw: number}}
 */
export const calculateAttendancePercentage = (hadirCount, totalEffectiveDays, options = {}) => {
    const { logWarning = true, context = '' } = options;
    
    if (totalEffectiveDays <= 0) {
        logger.warn('Total effective days is zero or negative', {
            totalEffectiveDays,
            context
        });
        return { percentage: 100, capped: false, raw: 100 };
    }

    const rawPercentage = (hadirCount / totalEffectiveDays) * 100;
    let capped = false;

    if (rawPercentage > 100) {
        if (logWarning) {
            logger.warn('Attendance percentage exceeds 100% - possible data inconsistency', {
                hadirCount,
                totalEffectiveDays,
                rawPercentage: rawPercentage.toFixed(2),
                context
            });
        }
        capped = true;
    }

    const percentage = Math.min(rawPercentage, 100);

    return {
        percentage: Number(percentage.toFixed(2)),
        capped,
        raw: Number(rawPercentage.toFixed(2))
    };
};

/**
 * Calculate absence percentage with validation
 * @param {number} absenceCount - Number of days absent (S + I + A)
 * @param {number} totalEffectiveDays - Total effective days
 * @param {Object} [options] - Options for logging
 * @returns {{ketidakhadiran: number, kehadiran: number, capped: boolean}}
 */
export const calculateAbsencePercentage = (absenceCount, totalEffectiveDays, options = {}) => {
    const { context = '' } = options;
    
    if (totalEffectiveDays <= 0) {
        logger.warn('Total effective days is zero or negative', {
            totalEffectiveDays,
            context
        });
        return { ketidakhadiran: 0, kehadiran: 100, capped: false };
    }

    const persenKetidakhadiran = (absenceCount / totalEffectiveDays) * 100;
    const persenKehadiran = 100 - persenKetidakhadiran;
    
    let capped = false;
    if (persenKetidakhadiran > 100 || persenKehadiran < 0) {
        logger.warn('Absence calculation anomaly detected', {
            absenceCount,
            totalEffectiveDays,
            persenKetidakhadiran: persenKetidakhadiran.toFixed(2),
            context
        });
        capped = true;
    }

    return {
        ketidakhadiran: Number(Math.min(persenKetidakhadiran, 100).toFixed(2)),
        kehadiran: Number(Math.max(persenKehadiran, 0).toFixed(2)),
        capped
    };
};

/**
 * Build tahun pelajaran string from year
 * @param {number} year - Starting year (e.g., 2025)
 * @returns {string} Tahun pelajaran (e.g., "2025/2026")
 */
export const buildTahunPelajaran = (year) => {
    const yearNum = Number.parseInt(year);
    return `${yearNum}/${yearNum + 1}`;
};

/**
 * Parse tahun pelajaran string to start/end years
 * @param {string} tahunPelajaran - e.g., "2025/2026" or "2025-2026"
 * @returns {{startYear: number, endYear: number}}
 */
export const parseTahunPelajaran = (tahunPelajaran) => {
    const parts = tahunPelajaran.split(/[\/\-]/);
    return {
        startYear: Number.parseInt(parts[0]),
        endYear: Number.parseInt(parts[1])
    };
};

/**
 * Clear internal cache (useful when calendar is updated)
 * @param {string} [tahunPelajaran] - Optional specific year to clear
 */
export const clearAttendanceCache = (tahunPelajaran = null) => {
    if (tahunPelajaran) {
        delete CACHE.effectiveDays[tahunPelajaran];
        logger.info('Cleared attendance cache for year', { tahunPelajaran });
    } else {
        CACHE.effectiveDays = {};
        logger.info('Cleared all attendance cache');
    }
};

// Export default map for backward compatibility
export const DEFAULT_EFFECTIVE_DAYS = { ...DEFAULT_HARI_EFEKTIF_MAP };

// Export semester definitions
export { SEMESTER_MONTHS };

export default {
    getEffectiveDaysMapFromDB,
    getEffectiveDaysForMonth,
    getSemesterEffectiveDays,
    getYearlyEffectiveDays,
    calculateEffectiveDaysForRange,
    calculateAttendancePercentage,
    calculateAbsencePercentage,
    buildTahunPelajaran,
    parseTahunPelajaran,
    clearAttendanceCache,
    DEFAULT_EFFECTIVE_DAYS,
    SEMESTER_MONTHS
};
