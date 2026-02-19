
import ExcelJS from 'exceljs';
import { sendDatabaseError, sendValidationError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import { mapKelasByName, mapMapelByName, mapGuruByName, mapRuangByKode } from '../utils/importHelper.js';
import db from '../config/db.js';

const logger = createLogger('ImportMaster');

// Configuration for headers (could be dynamic, but hardcoded based on analysis)
const DAY_HEADERS = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const DAY_NAME_MAP = {
    SENIN: 'Senin',
    SELASA: 'Selasa',
    RABU: 'Rabu',
    KAMIS: 'Kamis',
    JUMAT: 'Jumat',
    SABTU: 'Sabtu'
};

// Helper to sanitize cell value
const getVal = (row, colIdx) => {
    const val = row.getCell(colIdx).value;
    return val ? val.toString().trim() : '';
};

const MATCH_THRESHOLD = 0.6; // Simple fuzzy threshold (concept only)

const normalizeDayName = (value) => {
    if (!value) return value;
    const key = value.toString().toUpperCase();
    return DAY_NAME_MAP[key] || value;
};

const parseSettingValue = (value) => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw) return null;
     try {
         const parsed = JSON.parse(raw);
         if (typeof parsed === 'string') return parsed;
     } catch (_error) {
         // Ignore JSON parse errors, fall back to raw value. Expected when cell contains non-JSON string.
         logger.debug('Setting value is not valid JSON, using raw value', _error);
     }
    // Fix: Regex precedence ambiguity S5850 - Group the alternatives
    return raw.replaceAll(/(^")|("$)/g, '');
};

const getActiveAcademicYear = async (conn) => {
    const [rows] = await conn.execute(
        `SELECT setting_key, setting_value
         FROM app_settings
         WHERE setting_key IN ('TAHUN_AJARAN_AKTIF', 'active_academic_year')`
    );
    const preferred = rows.find(row => row.setting_key === 'TAHUN_AJARAN_AKTIF')
        || rows.find(row => row.setting_key === 'active_academic_year');
    return preferred ? parseSettingValue(preferred.setting_value) : null;
};

const loadJamPelajaranMap = async (conn, tahunAjaran) => {
    let rows = [];
    if (tahunAjaran) {
        const [tahunRows] = await conn.execute(
            'SELECT hari, jam_ke, jam_mulai, jam_selesai FROM jam_pelajaran WHERE tahun_ajaran = ?',
            [tahunAjaran]
        );
        rows = tahunRows;
    }
    if (rows.length === 0) {
        const [fallbackRows] = await conn.execute(
            'SELECT hari, jam_ke, jam_mulai, jam_selesai FROM jam_pelajaran'
        );
        rows = fallbackRows;
    }
    const map = new Map();
    for (const row of rows) {
        map.set(`${row.hari}:${row.jam_ke}`, {
            jam_mulai: row.jam_mulai,
            jam_selesai: row.jam_selesai
        });
    }
    return map;
};

/**
 * Handle Master Schedule Import (CSV/XLSX)
 * Structure: 
 *   Rows: Blocks of 3 (Mapel, Ruang, Guru) per Class
 *   Cols: Time Slots across Days
 */

export const importMasterSchedule = async (req, res) => {
    const log = logger.withRequest(req, res);
    try {
        if (!req.file) return sendValidationError(res, 'File tidak ditemukan');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer); // Works for CSV too if format is correct
        const sheet = workbook.worksheets[0];

        const rows = [];
        sheet.eachRow((row, rowNumber) => {
            rows.push({ row, rowNumber });
        });

        // 1. Identify Day Columns
        // Scan standard header rows (e.g. 1-5) to find Day names
        const dayRanges = [];
        let currentDay = null;
        
        // Naive scan of first 10 rows, first 100 cols
        for (let r = 0; r < Math.min(rows.length, 10); r++) {
            const rowWrapper = rows[r];
            const row = rowWrapper.row;
            
            row.eachCell((cell, colNumber) => {
                const val = cell.value?.toString().toUpperCase().trim();
                // Check if value matches a day name
                const matchedDay = DAY_HEADERS.find(d => val && val.includes(d));
                if (matchedDay) {
                    if (currentDay) {
                        // Close previous day range
                        currentDay.endCol = colNumber - 1;
                        dayRanges.push(currentDay);
                    }
                    currentDay = { name: matchedDay, startCol: colNumber, endCol: colNumber }; // Will extend endCol
                } else if (currentDay && val) {
                    // extend if we see "JAM KE" or numbers? 
                    // Actually, usually headers are merged or sparse. 
                    // Let's assume day covers columns until next day.
                    currentDay.endCol = colNumber;
                }
            });
        }
        if (currentDay) dayRanges.push(currentDay);

        // Fallback if no headers found (e.g. CSV without headers?)
        // Assuming standard layout from analysis if detection fails?
        // Let's rely on column mapping from analysis if dynamic fails.
        // SENIN starts around col 5 (E).
        
        if (dayRanges.length === 0) {
            log.warn('No day headers found, using default mapping from analysis');
            // Manual mapping based on analysis
            // SENIN: E(5) - S(19) ??
            // This is risky. Let's error if no days found for now.
             return sendValidationError(res, 'Format header hari (SENIN, SELASA...) tidak ditemukan di 10 baris pertama.');
        }

        // 2. Identify Class Blocks
        const scheduleData = [];

        // Skip headers (approx 10 rows)
        const startRowIdx = 10; 
        
        let i = startRowIdx;
        while (i < rows.length) {
            const rowA = rows[i].row;
            const className = getVal(rowA, 2); // Col B is Class
            
            // Check if this row looks like a Class Start Row
            // It must have "MAPEL" in Col C (3) or just be the first row of a block
            const labelC = getVal(rowA, 3).toUpperCase();
            
            if (className && (labelC.includes('MAPEL') || getVal(rowA, 1))) {
                // Found a class block
                // Row A: Mapel
                // Row B: Ruang (i+1)
                // Row C: Guru (i+2)
                
                if (i + 2 >= rows.length) break; // Not enough rows

                const rowB = rows[i+1].row;
                const rowC = rows[i+2].row;

                // Validate Block Structure
                // We trust the structure: Mapel, Ruang, Guru
                
                // Parse Columns for each Day
                for (const day of dayRanges) {
                    for (let col = day.startCol; col <= day.endCol; col++) {
                        // Determine Jam Ke based on column index relative to start?
                        // Or look at specific header row for "Jam Ke"?
                        // Analysis: "Header Row 4 (Jam Ke)"
                        // Let's try to read Jam Ke from Row 4 (1-indexed) => rows[3]
                        let jamKe = 0;
                        try {
                            const jamRow = sheet.getRow(4); // Row 4 has Jam numbers
                            const val = jamRow.getCell(col).value;
                            jamKe = Number.parseInt(val, 10) || 0;
                        } catch (e) {
                            // Ignore parsing errors for individual cells, jamKe remains 0
                            log.debug(`Error parsing jamKe for column ${col}: ${e.message}`);
                        }

                        // If jamKe is 0, maybe it's break or special column
                        if (jamKe === 0) continue;

                        const rawMapel = getVal(rowA, col);
                        const rawRuang = getVal(rowB, col);
                        const rawGuru = getVal(rowC, col);

                        if (!rawMapel && !rawGuru) continue; // Empty slot

                        scheduleData.push({
                            className,
                            day: normalizeDayName(day.name),
                            jamKe,
                            rawMapel,
                            rawRuang,
                            rawGuru
                        });
                    }
                }
                
                i += 3; // Skip all 3 rows of this block (Mapel, Ruang, Guru)
            } else {
                i++;
            }
        }

        if (scheduleData.length === 0) {
            return sendValidationError(res, 'Tidak ada data jadwal yang ditemukan.');
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                message: 'Dry run parsing success',
                totalSlots: scheduleData.length,
                preview: scheduleData.slice(0, 10),
                dayRanges
            });
        }

        // 3. Resolve & Persist
        const conn = await db.getConnection();
        const results = { success: 0, failed: 0, errors: [] };
        let transactionStarted = false;

        try {
            const activeYear = await getActiveAcademicYear(conn);
            const jamSlotMap = await loadJamPelajaranMap(conn, activeYear);
            if (jamSlotMap.size === 0) {
                return sendValidationError(
                    res,
                    'Jam pelajaran belum dikonfigurasi. Jalankan seeder jam_pelajaran sebelum import jadwal.'
                );
            }

            await conn.beginTransaction();
            transactionStarted = true;
            
            // Cache Maps to reduce DB calls
            const classMap = new Map();
            const mapelMap = new Map();
            const guruMap = new Map();
            const ruangMap = new Map();

            for (const item of scheduleData) {
                try {
                    // Resolve Class
                    if (!classMap.has(item.className)) {
                        const id = await mapKelasByName(item.className);
                        classMap.set(item.className, id);
                    }
                    const kelasId = classMap.get(item.className);
                    if (!kelasId) throw new Error(`Kelas tidak ditemukan: ${item.className}`);

                    // Resolve Mapel
                    if (!mapelMap.has(item.rawMapel)) {
                        const id = await mapMapelByName(item.rawMapel); // Need robust fuzzy
                        mapelMap.set(item.rawMapel, id);
                    }
                    const mapelId = mapelMap.get(item.rawMapel);
                    
                    // Resolve Guru
                    // Support Multi Guru "Guru1, Guru2"
                    const guruNames = item.rawGuru.split(',').map(s => s.trim());
                    const guruIds = [];
                    for (const name of guruNames) {
                        const cacheKey = name;
                        if (!guruMap.has(cacheKey)) {
                            const id = await mapGuruByName(name);
                            guruMap.set(cacheKey, id);
                        }
                        const gid = guruMap.get(cacheKey);
                        if (gid) guruIds.push(gid);
                    }
                    const uniqueGuruIds = Array.from(new Set(guruIds));
                    
                    // Resolve Ruang
                    if (item.rawRuang && !ruangMap.has(item.rawRuang)) {
                        const id = await mapRuangByKode(item.rawRuang);
                        ruangMap.set(item.rawRuang, id);
                    }
                    const ruangId = ruangMap.get(item.rawRuang) || null;
                    const jamSlot = jamSlotMap.get(`${item.day}:${item.jamKe}`);
                    if (!jamSlot) {
                        throw new Error(`Jam pelajaran tidak ditemukan untuk ${item.day} jam ke-${item.jamKe}`);
                    }
                    
                    // Insert Jadwal
                     const [res] = await conn.execute(
                        `INSERT INTO jadwal 
                        (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus, is_multi_guru, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', 'pelajaran', 1, NULL, ?, NOW())`,
                        [kelasId, mapelId || null, uniqueGuruIds[0] || null, ruangId, item.day, item.jamKe, jamSlot.jam_mulai, jamSlot.jam_selesai, uniqueGuruIds.length > 1 ? 1 : 0]
                    );
                    
                    const jadwalId = res.insertId;

                    // Insert Multi Guru
                    if (uniqueGuruIds.length > 1) {
                        for (const gid of uniqueGuruIds) {
                            await conn.execute(
                                `INSERT INTO jadwal_guru (jadwal_id, guru_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE guru_id=guru_id`,
                                [jadwalId, gid]
                            );
                        }
                    }
                } catch (error_) {
                   // Correctly handle individual row errors if we want partial success?
                   // Current logic seems to prefer throwing to rollback everything.
                   // Or we can collect errors. Let's throw for now to support the transaction.
                   results.failed++;
                   results.errors.push(`Row error: ${error_.message}`);
                   throw error_;
                }
                
                results.success++;
            } // End main loop

            await conn.commit();
            
            res.json({
                success: true,
                imported: results.success,
                failed: results.failed,
                errors: results.errors.slice(0, 100) // Limit response size
            });

        } catch (error_) {
             if (transactionStarted) {
                 await conn.rollback();
             }
             throw error_;
        } finally {
            conn.release();
        }

    } catch (error) {
        log.error('Master Import Error', error);
        sendDatabaseError(res, error, 'Gagal memproses file master');
    }
};
