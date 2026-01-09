/**
 * Attendance Settings Controller
 * Manages configurable attendance rules via admin API
 */

import { sendDatabaseError, sendValidationError, sendSuccessResponse, sendNotFoundError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AttendanceSettings');

// ================================================
// GET ALL SETTINGS
// ================================================

/**
 * Get all attendance settings
 * GET /api/admin/attendance-settings
 */
export const getAttendanceSettings = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetAttendanceSettings');

    try {
        const [rows] = await globalThis.dbPool.execute(
            'SELECT setting_key, setting_value, description, updated_at FROM attendance_settings ORDER BY setting_key'
        );

        // Convert to object for easier access
        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = {
                value: row.setting_value,
                description: row.description,
                updated_at: row.updated_at
            };
        });

        log.success('GetAttendanceSettings', { count: rows.length });
        return sendSuccessResponse(res, settings, 'Settings berhasil diambil');
    } catch (error) {
        // If table doesn't exist, return defaults
        if (error.code === 'ER_NO_SUCH_TABLE') {
            log.warn('attendance_settings table not found, returning defaults');
            return sendSuccessResponse(res, getDefaultSettings(), 'Using default settings');
        }
        log.dbError('getAttendanceSettings', error);
        return sendDatabaseError(res, error, 'Gagal mengambil settings');
    }
};

/**
 * Get single setting by key
 * GET /api/admin/attendance-settings/:key
 */
export const getSettingByKey = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { key } = req.params;
    log.requestStart('GetSettingByKey', { key });

    try {
        const [rows] = await globalThis.dbPool.execute(
            'SELECT setting_key, setting_value, description, updated_at FROM attendance_settings WHERE setting_key = ?',
            [key]
        );

        if (rows.length === 0) {
            // Check if it's a valid default key
            const defaults = getDefaultSettings();
            if (defaults[key]) {
                return sendSuccessResponse(res, defaults[key], 'Using default setting');
            }
            return sendNotFoundError(res, `Setting '${key}' tidak ditemukan`);
        }

        log.success('GetSettingByKey', { key });
        return sendSuccessResponse(res, {
            key: rows[0].setting_key,
            value: rows[0].setting_value,
            description: rows[0].description,
            updated_at: rows[0].updated_at
        });
    } catch (error) {
        log.dbError('getSettingByKey', error, { key });
        return sendDatabaseError(res, error, 'Gagal mengambil setting');
    }
};

// ================================================
// UPDATE SETTINGS
// ================================================

/**
 * Update a single setting
 * PUT /api/admin/attendance-settings/:key
 */
export const updateSetting = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { key } = req.params;
    const { value, description } = req.body;
    log.requestStart('UpdateSetting', { key, value });

    try {
        if (value === undefined || value === null) {
            return sendValidationError(res, 'Value wajib diisi');
        }

        // Validate known keys
        const validKeys = [
            'enable_late_detection',
            'default_start_time',
            'late_tolerance_minutes',
            'alpha_voids_day'
        ];

        if (!validKeys.includes(key)) {
            return sendValidationError(res, `Setting key '${key}' tidak valid. Valid keys: ${validKeys.join(', ')}`);
        }

        // Type validation based on key
        if (key === 'enable_late_detection' || key === 'alpha_voids_day') {
            if (!['true', 'false'].includes(String(value).toLowerCase())) {
                return sendValidationError(res, `${key} harus 'true' atau 'false'`);
            }
        }

        if (key === 'late_tolerance_minutes') {
            const numVal = Number.parseInt(value);
            if (Number.isNaN(numVal) || numVal < 0 || numVal > 60) {
                return sendValidationError(res, 'late_tolerance_minutes harus angka 0-60');
            }
        }

        if (key === 'default_start_time') {
            if (!/^\d{2}:\d{2}$/.test(value)) {
                return sendValidationError(res, 'default_start_time harus format HH:MM');
            }
        }

        // Upsert
        await globalThis.dbPool.execute(`
            INSERT INTO attendance_settings (setting_key, setting_value, description)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                setting_value = VALUES(setting_value),
                description = COALESCE(VALUES(description), description),
                updated_at = CURRENT_TIMESTAMP
        `, [key, String(value), description || null]);

        log.success('UpdateSetting', { key, value });
        return sendSuccessResponse(res, { key, value }, `Setting '${key}' berhasil diupdate`);
    } catch (error) {
        log.dbError('updateSetting', error, { key, value });
        return sendDatabaseError(res, error, 'Gagal update setting');
    }
};

/**
 * Bulk update multiple settings
 * PUT /api/admin/attendance-settings
 */
export const updateMultipleSettings = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { settings } = req.body;
    log.requestStart('UpdateMultipleSettings', { count: Object.keys(settings || {}).length });

    try {
        if (!settings || typeof settings !== 'object') {
            return sendValidationError(res, 'Settings object wajib diisi');
        }

        const connection = await globalThis.dbPool.getConnection();
        try {
            await connection.beginTransaction();

            for (const [key, value] of Object.entries(settings)) {
                await connection.execute(`
                    INSERT INTO attendance_settings (setting_key, setting_value)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE 
                        setting_value = VALUES(setting_value),
                        updated_at = CURRENT_TIMESTAMP
                `, [key, String(value)]);
            }

            await connection.commit();
            log.success('UpdateMultipleSettings', { count: Object.keys(settings).length });
            return sendSuccessResponse(res, settings, 'Settings berhasil diupdate');
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        log.dbError('updateMultipleSettings', error);
        return sendDatabaseError(res, error, 'Gagal update settings');
    }
};

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Get default settings (for when table doesn't exist)
 */
function getDefaultSettings() {
    return {
        enable_late_detection: { value: 'false', description: 'Aktifkan deteksi terlambat' },
        default_start_time: { value: '07:00', description: 'Jam masuk default' },
        late_tolerance_minutes: { value: '15', description: 'Toleransi terlambat (menit)' },
        alpha_voids_day: { value: 'true', description: 'Alpa menggugurkan kehadiran hari itu' }
    };
}

/**
 * Get setting value from database or default
 * Utility function for other controllers to use
 */
export async function getSettingValue(key, defaultValue = null) {
    try {
        const [rows] = await globalThis.dbPool.execute(
            'SELECT setting_value FROM attendance_settings WHERE setting_key = ?',
            [key]
        );
        if (rows.length > 0) {
            return rows[0].setting_value;
        }
    } catch (error) {
        logger.warn('Failed to get setting', { key, error: error.message });
    }
    
    // Return default
    const defaults = getDefaultSettings();
    return defaults[key]?.value || defaultValue;
}

/**
 * Check if late detection is enabled
 */
export async function isLateDetectionEnabled() {
    const value = await getSettingValue('enable_late_detection', 'false');
    return value === 'true';
}

/**
 * Check if alpha voids day is enabled
 */
export async function isAlphaVoidsDayEnabled() {
    const value = await getSettingValue('alpha_voids_day', 'true');
    return value === 'true';
}

export default {
    getAttendanceSettings,
    getSettingByKey,
    updateSetting,
    updateMultipleSettings,
    getSettingValue,
    isLateDetectionEnabled,
    isAlphaVoidsDayEnabled
};
