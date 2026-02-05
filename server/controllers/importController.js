/**
 * Import Controller
 * Menangani impor Excel untuk mapel, kelas, ruang, jadwal, siswa, guru
 * Dimigrasi dari server_modern.js - Batch 16
 */

import ExcelJS from 'exceljs';

import { AppError, ERROR_CODES, sendDatabaseError, sendErrorResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import db from '../config/db.js';
import {
    persistMapel,
    persistKelas,
    persistRuang,
    processSiswaData,
    processGuruData,
    processStudentAccount,
    processTeacherAccount
} from '../services/importPersistence.js';
import {
    sheetToJsonByHeader,
    validateBatchRows,
    mapKelasByName,
    mapMapelByName,
    mapGuruByName,
    mapRuangByKode,
    parseGuruIdsFromString,
    parseGuruNamesFromString,
    validateRequiredJadwalFields,
    buildJadwalObject,
    validateStudentAccountRow,
    validateTeacherAccountRow,
    validateMapelRow,
    validateKelasRow,
    validateRuangRow,
    validateSiswaDataRow,
    validateGuruDataRow
} from '../utils/importHelper.js';

const logger = createLogger('Import');

// Constants to avoid duplicate literals
const ERROR_FILE_NOT_FOUND = 'File tidak ditemukan';
const ERROR_NO_VALID_ROWS = 'Tidak ada baris valid untuk diimpor';
const ERROR_DB_CHECK_FAILED = 'Gagal memeriksa data yang sudah ada';
const ERROR_TEMPLATE_MISMATCH = 'Format file tidak sesuai template';
const MSG_DRY_RUN_COMPLETED = 'Dry run completed. No data was imported.';

const DEFAULT_TAHUN_AJARAN = '2025/2026';

const sendImportValidationError = (res, message, errors = null) => {
    const error = new AppError(ERROR_CODES.VALIDATION_FAILED, message, errors);
    const extra = errors ? { errors } : null;
    return sendErrorResponse(res, error, null, null, extra);
};


/**
 * Normalize text value for comparison.
 * @param {unknown} value
 * @returns {string}
 */
const normalizeText = (value) => String(value || '').trim();

const normalizeKey = (value) => normalizeText(value).toUpperCase().replace(/\s+/g, ' ');

const normalizeCompactKey = (value) => normalizeText(value).toUpperCase().replace(/[\s.]+/g, '');

const extractDayName = (value) => {
    const raw = normalizeText(value).toUpperCase();
    if (!raw) return '';
    if (raw.includes('SENIN')) return 'Senin';
    if (raw.includes('SELASA')) return 'Selasa';
    if (raw.includes('RABU')) return 'Rabu';
    if (raw.includes('KAMIS')) return 'Kamis';
    if (raw.includes("JUM'AT") || raw.includes('JUMAT')) return 'Jumat';
    if (raw.includes('SABTU')) return 'Sabtu';
    return '';
};

const getCellText = (cell) => {
    if (!cell) return '';
    if (typeof cell.text === 'string' && cell.text.trim()) return cell.text.trim();
    const value = cell.value;
    if (value == null) return '';
    if (typeof value === 'object' && value.text) return String(value.text).trim();
    if (typeof value === 'object' && Array.isArray(value.richText)) {
        return value.richText.map(part => part.text).join('').trim();
    }
    if (typeof value === 'object' && value.formula && value.result != null) {
        return String(value.result).trim();
    }
    return String(value).trim();
};

const parseTimePart = (value) => {
    const raw = normalizeText(value).replace(/\./g, ':');
    const match = raw.match(/(\d{1,2})[:](\d{2})/);
    if (!match) return '';
    const hour = String(match[1]).padStart(2, '0');
    const minute = match[2];
    return `${hour}:${minute}`;
};

const parseTimeRange = (value) => {
    const raw = normalizeText(value).replace(/–/g, '-');
    if (!raw || !raw.includes('-')) return null;
    const parts = raw.split('-').map(part => parseTimePart(part));
    if (!parts[0] || !parts[1]) return null;
    return { start: parts[0], end: parts[1] };
};

const toTimeWithSeconds = (time) => `${time}:00`;

const computeDurationMinutes = (start, end) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) return 0;
    return (eh * 60 + em) - (sh * 60 + sm);
};

const extractPrimaryGuruName = (value) => {
    const raw = normalizeText(value);
    if (!raw) return '';
    const separators = [' / ', ' & ', ' DAN ', ' dan ', '/'];
    for (const sep of separators) {
        if (raw.includes(sep)) {
            return normalizeText(raw.split(sep)[0]);
        }
    }
    return raw;
};

const detectSlotType = (mapelRaw) => {
    const upper = normalizeText(mapelRaw).toUpperCase();
    if (!upper) return { jenis: 'pelajaran', label: null };
    if (upper.includes('ISTIRAHAT') || upper.includes('DZUHUR')) {
        return { jenis: 'istirahat', label: normalizeText(mapelRaw) || 'Istirahat' };
    }
    if (
        upper.includes('PEMBIASAAN') ||
        upper.includes('UPACARA') ||
        upper.includes('TADARUS') ||
        upper.includes('LITERASI') ||
        upper.includes('SHOLAT') ||
        upper.includes('SALAT')
    ) {
        return { jenis: 'pembiasaan', label: normalizeText(mapelRaw) || 'Pembiasaan' };
    }
    return { jenis: 'pelajaran', label: null };
};

const buildReferenceMaps = async (conn) => {
    const [kelasRows] = await conn.execute('SELECT id_kelas, nama_kelas FROM kelas WHERE status = "aktif"');
    const [mapelRows] = await conn.execute('SELECT id_mapel, kode_mapel, nama_mapel FROM mapel WHERE status = "aktif"');
    const [guruRows] = await conn.execute('SELECT id_guru, nama FROM guru WHERE status = "aktif"');
    const [ruangRows] = await conn.execute('SELECT id_ruang, kode_ruang FROM ruang_kelas WHERE status = "aktif"');

    const kelasMap = new Map();
    for (const row of kelasRows) {
        kelasMap.set(normalizeCompactKey(row.nama_kelas), row.id_kelas);
    }

    const mapelCodeMap = new Map();
    const mapelNameMap = new Map();
    for (const row of mapelRows) {
        if (row.kode_mapel) mapelCodeMap.set(normalizeCompactKey(row.kode_mapel), row.id_mapel);
        if (row.nama_mapel) mapelNameMap.set(normalizeKey(row.nama_mapel), row.id_mapel);
    }

    const guruMap = new Map();
    for (const row of guruRows) {
        guruMap.set(normalizeKey(row.nama), row.id_guru);
    }

    const ruangMap = new Map();
    for (const row of ruangRows) {
        ruangMap.set(normalizeCompactKey(row.kode_ruang), row.id_ruang);
    }

    return { kelasMap, mapelCodeMap, mapelNameMap, guruMap, ruangMap };
};

const findMapelId = (mapelRaw, mapelCodeMap, mapelNameMap) => {
    const raw = normalizeText(mapelRaw);
    if (!raw) return null;
    const token = raw.split('/')[0].split('&')[0].split(' dan ')[0].trim();
    const codeKey = normalizeCompactKey(token);
    if (mapelCodeMap.has(codeKey)) return mapelCodeMap.get(codeKey);
    const nameKey = normalizeKey(raw);
    return mapelNameMap.get(nameKey) || null;
};

const findRuangId = (ruangRaw, ruangMap) => {
    const raw = normalizeText(ruangRaw);
    if (!raw) return null;
    const key = normalizeCompactKey(raw);
    return ruangMap.get(key) || null;
};

const findGuruId = (guruRaw, guruMap) => {
    const primary = extractPrimaryGuruName(guruRaw);
    if (!primary) return null;
    const key = normalizeKey(primary);
    return guruMap.get(key) || null;
};

/**
 * Detect manual schedule layout (matrix) in worksheet.
 * @param {ExcelJS.Worksheet} worksheet
 * @returns {object|null}
 */
const detectManualScheduleLayout = (worksheet) => {
    const rowCount = worksheet.rowCount || 0;
    let headerRowIndex = null;
    for (let i = 1; i <= Math.min(rowCount, 30); i++) {
        const row = worksheet.getRow(i);
        let hasKelas = false;
        let hasJamKe = false;
        row.eachCell((cell) => {
            const value = normalizeText(getCellText(cell)).toUpperCase();
            if (value === 'KELAS') hasKelas = true;
            if (value.includes('JAM KE')) hasJamKe = true;
        });
        if (hasKelas && hasJamKe) {
            headerRowIndex = i;
            break;
        }
    }

    if (!headerRowIndex) return null;

    const headerRow = worksheet.getRow(headerRowIndex);
    let kelasCol = null;
    let jamKeLabelCol = null;
    headerRow.eachCell((cell, col) => {
        const value = normalizeText(getCellText(cell)).toUpperCase();
        if (value === 'KELAS') kelasCol = col;
        if (value.includes('JAM KE')) jamKeLabelCol = col;
    });

    if (!kelasCol || !jamKeLabelCol) return null;

    let timeRowIndex = null;
    for (let i = headerRowIndex + 1; i <= Math.min(rowCount, headerRowIndex + 5); i++) {
        const row = worksheet.getRow(i);
        let hasWaktu = false;
        row.eachCell((cell) => {
            const value = normalizeText(getCellText(cell)).toUpperCase();
            if (value === 'WAKTU') hasWaktu = true;
        });
        if (hasWaktu) {
            timeRowIndex = i;
            break;
        }
    }

    if (!timeRowIndex) return null;

    let dayRowIndex = null;
    for (let i = headerRowIndex - 1; i >= Math.max(1, headerRowIndex - 6); i--) {
        const row = worksheet.getRow(i);
        let hasDay = false;
        row.eachCell((cell) => {
            if (extractDayName(getCellText(cell))) hasDay = true;
        });
        if (hasDay) {
            dayRowIndex = i;
            break;
        }
    }

    if (!dayRowIndex) return null;

    return { headerRowIndex, timeRowIndex, dayRowIndex, kelasCol, jamKeLabelCol };
};

/**
 * Parse manual schedule sheet into jam slots and jadwal rows.
 * @param {ExcelJS.Worksheet} worksheet
 * @param {object} refMaps
 * @param {string} tahunAjaran
 * @returns {{ jamSlots: Array, jadwalRows: Array, errors: Array }|null}
 */
const parseManualScheduleSheet = (worksheet, refMaps, tahunAjaran = DEFAULT_TAHUN_AJARAN) => {
    const layout = detectManualScheduleLayout(worksheet);
    if (!layout) return null;

    const { headerRowIndex, timeRowIndex, dayRowIndex, kelasCol, jamKeLabelCol } = layout;
    const headerRow = worksheet.getRow(headerRowIndex);
    const timeRow = worksheet.getRow(timeRowIndex);
    const dayRow = worksheet.getRow(dayRowIndex);

    const columnCount = worksheet.columnCount || headerRow.cellCount || 0;
    const columnMeta = [];
    const lastJamKeByDay = {};

    let currentDay = '';
    for (let col = jamKeLabelCol + 1; col <= columnCount; col++) {
        const dayCell = getCellText(dayRow.getCell(col));
        const detectedDay = extractDayName(dayCell);
        if (detectedDay) currentDay = detectedDay;
        if (!currentDay) continue;

        const headerValue = getCellText(headerRow.getCell(col));
        const parsedNumber = Number.parseInt(headerValue, 10);
        let jamKe = Number.isFinite(parsedNumber) ? parsedNumber : null;
        if (!jamKe && jamKe !== 0) {
            const last = lastJamKeByDay[currentDay];
            jamKe = Number.isFinite(last) ? last + 1 : 0;
        }

        lastJamKeByDay[currentDay] = jamKe;

        const timeValue = getCellText(timeRow.getCell(col));
        const timeRange = parseTimeRange(timeValue);
        if (!timeRange) continue;

        columnMeta.push({
            col,
            day: currentDay,
            jam_ke: jamKe,
            jam_mulai: timeRange.start,
            jam_selesai: timeRange.end
        });
    }

    const jamSlotMap = new Map();
    const jadwalList = [];
    const errors = [];

    const rowCount = worksheet.rowCount || 0;
    for (let rowIdx = timeRowIndex + 1; rowIdx <= rowCount; rowIdx++) {
        const row = worksheet.getRow(rowIdx);
        const kelasName = normalizeText(getCellText(row.getCell(kelasCol)));
        const marker = normalizeText(getCellText(row.getCell(jamKeLabelCol))).toUpperCase();

        if (!kelasName || marker !== 'MAPEL') continue;

        const kelasKey = normalizeCompactKey(kelasName);
        const kelasId = refMaps.kelasMap.get(kelasKey);
        if (!kelasId) {
            errors.push({ index: rowIdx, errors: [`Kelas tidak ditemukan: ${kelasName}`], data: { kelas: kelasName } });
            continue;
        }

        const mapelRow = row;
        const ruangRow = worksheet.getRow(rowIdx + 1);
        const guruRow = worksheet.getRow(rowIdx + 2);

        for (const meta of columnMeta) {
            const mapelRaw = normalizeText(getCellText(mapelRow.getCell(meta.col)));
            const ruangRaw = normalizeText(getCellText(ruangRow.getCell(meta.col)));
            const guruRaw = normalizeText(getCellText(guruRow.getCell(meta.col)));

            const slotType = detectSlotType(mapelRaw);
            const slotKey = `${kelasId}|${meta.day}|${meta.jam_ke}`;
            const existingSlot = jamSlotMap.get(slotKey);
            if (!existingSlot || (existingSlot.jenis === 'pelajaran' && slotType.jenis !== 'pelajaran')) {
                jamSlotMap.set(slotKey, {
                    kelas_id: kelasId,
                    hari: meta.day,
                    jam_ke: meta.jam_ke,
                    jam_mulai: meta.jam_mulai,
                    jam_selesai: meta.jam_selesai,
                    jenis: slotType.jenis,
                    label: slotType.label,
                    tahun_ajaran: tahunAjaran
                });
            }

            if (!mapelRaw) continue;
            if (slotType.jenis !== 'pelajaran') continue;

            const mapelId = findMapelId(mapelRaw, refMaps.mapelCodeMap, refMaps.mapelNameMap);
            if (!mapelId) {
                errors.push({ index: rowIdx, errors: [`Mapel tidak ditemukan: ${mapelRaw}`], data: { kelas: kelasName, mapel: mapelRaw, hari: meta.day, jam_ke: meta.jam_ke } });
                continue;
            }

            const guruId = findGuruId(guruRaw, refMaps.guruMap);
            if (!guruId) {
                errors.push({ index: rowIdx, errors: [`Guru tidak ditemukan: ${guruRaw || '-'}`], data: { kelas: kelasName, mapel: mapelRaw, hari: meta.day, jam_ke: meta.jam_ke } });
                continue;
            }

            const ruangId = findRuangId(ruangRaw, refMaps.ruangMap);

            jadwalList.push({
                kelas_id: kelasId,
                mapel_id: mapelId,
                guru_id: guruId,
                ruang_id: ruangId,
                hari: meta.day,
                jam_ke: meta.jam_ke,
                jam_mulai: meta.jam_mulai,
                jam_selesai: meta.jam_selesai,
                jenis_aktivitas: 'pelajaran',
                is_absenable: 1,
                keterangan_khusus: null,
                status: 'aktif',
                guru_ids: [guruId]
            });
        }

        rowIdx += 2;
    }

    return {
        jamSlots: Array.from(jamSlotMap.values()),
        jadwalRows: jadwalList,
        errors
    };
};

/**
 * Persist jam_pelajaran_kelas slots with upsert.
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {Array} jamSlots
 * @returns {Promise<void>}
 */
const persistJamPelajaranKelas = async (conn, jamSlots) => {
    for (const slot of jamSlots) {
        const durasi = computeDurationMinutes(slot.jam_mulai, slot.jam_selesai);
        await conn.execute(
            `INSERT INTO jam_pelajaran_kelas
                (kelas_id, hari, jam_ke, jam_mulai, jam_selesai, durasi_menit, jenis, label, tahun_ajaran)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                jam_mulai = VALUES(jam_mulai),
                jam_selesai = VALUES(jam_selesai),
                durasi_menit = VALUES(durasi_menit),
                jenis = VALUES(jenis),
                label = VALUES(label)`,
            [
                slot.kelas_id,
                slot.hari,
                slot.jam_ke,
                toTimeWithSeconds(slot.jam_mulai),
                toTimeWithSeconds(slot.jam_selesai),
                durasi > 0 ? durasi : 45,
                slot.jenis,
                slot.label,
                slot.tahun_ajaran
            ]
        );
    }
};


// ================================================
// IMPORT MAPEL (Subject)
// ================================================

/**
 * Import mapel from Excel file
 * POST /api/admin/import/mapel
 */
const importMapel = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);


        const seenKode = new Set();
        
        // Use generic batch validator
        const { valid, errors } = validateBatchRows(rows, validateMapelRow, seenKode);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }
        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await persistMapel(conn, valid);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted_or_updated: valid.length, invalid: errors.length, errors });
    } catch (err) {
        logger.error('Import mapel failed', err);
        return sendDatabaseError(res, err, 'Gagal impor mapel');
    }
};

// ================================================
// IMPORT KELAS (Class)
// ================================================

/**
 * Import kelas from Excel file
 * POST /api/admin/import/kelas
 */
const importKelas = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);


        const seenNama = new Set();
        
        // Use generic batch validator
        const { valid, errors } = validateBatchRows(rows, validateKelasRow, seenNama);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }
        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await persistKelas(conn, valid);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted_or_updated: valid.length, invalid: errors.length, errors });
    } catch (err) {
        logger.error('Import kelas error', { error: err.message });
        return sendDatabaseError(res, err, 'Gagal impor kelas');
    }
};

// ================================================
// IMPORT RUANG (Room)
// ================================================

/**
 * Import ruang from Excel file
 * POST /api/admin/import/ruang
 */
const importRuang = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);


        const seenKode = new Set();
        
        // Use generic batch validator
        const { valid, errors } = validateBatchRows(rows, validateRuangRow, seenKode);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }
        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await persistRuang(conn, valid);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted_or_updated: valid.length, invalid: errors.length, errors });
    } catch (err) {
        logger.error('Import ruang error', { error: err.message });
        return sendDatabaseError(res, err, 'Gagal impor ruang');
    }
};

// ================================================
// IMPORT JADWAL (Schedule) - Complex Multi-Guru Support
// ================================================

/**
 * Parse jadwal row in basic format (uses IDs directly)
 */
async function parseJadwalBasicFormat(rowData) {
    const kelas_id = rowData.kelas_id;
    const mapel_id = rowData.mapel_id || null;
    const guru_id = rowData.guru_id || null;
    const ruang_id = rowData.ruang_id || null;
    const guru_ids_array = parseGuruIdsFromString(rowData.guru_ids);
    
    return {
        kelas_id, mapel_id, guru_id, ruang_id, guru_ids_array
    };
}

/**
 * Parse jadwal row in friendly format (uses names/codes)
 */
async function parseJadwalFriendlyFormat(rowData) {
    const rawClass = rowData.kelas || rowData.Kelas;
    const rawMapel = rowData.mapel || rowData.Mapel || rowData['Mata Pelajaran'];
    const rawGuru = rowData.guru || rowData.Guru || rowData['Nama Guru'];
    const rawGuruPendamping = rowData.guru_pendamping || rowData['Guru Pendamping'];
    const rawRuang = rowData.ruang || rowData.Ruang || rowData['Kode Ruang'];

    const kelas_id = await mapKelasByName(rawClass);
    const mapel_id = await mapMapelByName(rawMapel);
    const guru_id = await mapGuruByName(rawGuru);
    const ruang_id = await mapRuangByKode(rawRuang);
    
    // Handle multi-guru from friendly format (comma separated in guru column or guru_pendamping)
    let guru_ids_array = [];
    if (guru_id) guru_ids_array.push(guru_id);
    
    // Check if guru column has multiple names
    if (rawGuru && rawGuru.includes(',')) {
        const ids = await parseGuruNamesFromString(rawGuru);
        guru_ids_array = [...new Set([...guru_ids_array, ...ids])];
    }
    
    // Add guru pendamping
    if (rawGuruPendamping) {
        const ids = await parseGuruNamesFromString(rawGuruPendamping);
        guru_ids_array = [...new Set([...guru_ids_array, ...ids])];
    }

    return {
        kelas_id, mapel_id, guru_id, ruang_id, guru_ids_array
    };
}

/**
 * Process a single jadwal row and return parsed data or error
 */
async function processJadwalRow(rowData, rowNum, isBasicFormat) {
    const fieldErrors = validateRequiredJadwalFields(rowData);
    if (fieldErrors.length > 0) {
        return { error: { index: rowNum, errors: fieldErrors, data: rowData } };
    }

    const parsedIds = isBasicFormat
        ? await parseJadwalBasicFormat(rowData)
        : await parseJadwalFriendlyFormat(rowData);
    
    const { kelas_id, mapel_id, guru_id, ruang_id, guru_ids_array } = parsedIds;

    if (!kelas_id) {
        return { error: { index: rowNum, errors: ['Kelas tidak ditemukan'], data: rowData } };
    }

    const jadwalObj = buildJadwalObject(rowData, kelas_id, mapel_id, guru_id, ruang_id, guru_ids_array);
    return { valid: jadwalObj };
}

/**
 * Persist jadwal batch to database
 */
async function persistJadwalBatch(conn, validItems) {
    for (const v of validItems) {
        const isMultiGuru = Array.isArray(v.guru_ids) && v.guru_ids.length > 1 ? 1 : 0;
        const [result] = await conn.execute(
            `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable, keterangan_khusus, status, is_multi_guru)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [v.kelas_id, v.mapel_id, v.guru_id, v.ruang_id, v.hari, v.jam_ke, v.jam_mulai, v.jam_selesai, v.jenis_aktivitas, v.is_absenable, v.keterangan_khusus, v.status, isMultiGuru]
        );
        
        const jadwalId = result.insertId;

        // Insert guru pendamping / multi-guru
        if (v.guru_ids && v.guru_ids.length > 0) {
            for (const gid of v.guru_ids) {
                await conn.execute(
                    `INSERT INTO jadwal_guru (jadwal_id, guru_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE guru_id=guru_id`,
                    [jadwalId, gid]
                );
            }
        }
    }
}

/**
 * Import jadwal from Excel file
 * POST /api/admin/import/jadwal
 */
const importJadwal = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const manualLayout = detectManualScheduleLayout(worksheet);
        if (manualLayout) {
            const refMaps = await buildReferenceMaps(db);
            const manualParsed = parseManualScheduleSheet(worksheet, refMaps, DEFAULT_TAHUN_AJARAN);
            if (!manualParsed) {
                return sendImportValidationError(res, ERROR_TEMPLATE_MISMATCH);
            }
            const { jamSlots, jadwalRows, errors } = manualParsed;

            if (req.query.dryRun === 'true') {
                return res.json({
                    total: jadwalRows.length,
                    valid: jadwalRows.length,
                    invalid: errors.length,
                    errors,
                    previewData: jadwalRows.slice(0, 20),
                    message: MSG_DRY_RUN_COMPLETED
                });
            }

            if (jadwalRows.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

            const conn = await db.getConnection();
            try {
                await conn.beginTransaction();
                if (jamSlots.length > 0) {
                    await persistJamPelajaranKelas(conn, jamSlots);
                }
                await persistJadwalBatch(conn, jadwalRows);
                await conn.commit();
            } catch (e) {
                await conn.rollback();
                throw e;
            } finally {
                conn.release();
            }

            return res.json({ success: true, inserted: jadwalRows.length, invalid: errors.length, errors });
        }

        const rows = sheetToJsonByHeader(worksheet);

        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kelas_id');
        const errors = [];
        const valid = [];

        // Process each row using extracted helper
        for (let i = 0; i < rows.length; i++) {
            try {
                const result = await processJadwalRow(rows[i], i + 2, isBasicFormat);
                if (result.error) errors.push(result.error);
                else valid.push(result.valid);
            } catch (err) {
                errors.push({ index: i + 2, errors: [err.message], data: rows[i] });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }
        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await persistJadwalBatch(conn, valid);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted: valid.length, invalid: errors.length, errors });
    } catch (err) {
        logger.error('Import jadwal error', { error: err.message });
        return sendDatabaseError(res, err, 'Gagal impor jadwal');
    }
};


// ================================================
// IMPORT SISWA (Student Data)
// ================================================

/**
 * Import siswa data from Excel file (without account creation)
 * POST /api/admin/import/siswa
 */
const importSiswa = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);
        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);

        // Check for existing NIS in database
        const existingNis = new Set();

        try {
            const [dbNis] = await db.execute('SELECT nis FROM siswa');
            dbNis.forEach(row => existingNis.add(row.nis));
        } catch (dbError) {
            logger.error('Error checking existing data', { error: dbError.message });
            return sendDatabaseError(res, dbError, ERROR_DB_CHECK_FAILED);
        }

        // Use generic batch validator (wrapped to match signature)
        const validatorWrapper = (rowData, { existingSet }) => {
             return validateSiswaDataRow(rowData, [], existingSet); 
        };
        
        const { valid, errors } = validateBatchRows(rows, validatorWrapper, { existingSet: existingNis });

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }

        if (valid.length === 0) {
            return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);
        }

        // Process records with helper function
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            let successCount = 0;
            let duplicateCount = 0;

            for (const record of valid) {
                const status = await processSiswaData(conn, record);
                if (status === 'new') successCount++;
                else duplicateCount++;
            }

            await conn.commit();

            res.json({
                success: true,
                processed: valid.length,
                new: successCount,
                updated: duplicateCount,
                invalid: errors.length,
                errors,
                message: `Import data siswa berhasil! ${successCount} baru, ${duplicateCount} diupdate.`
            });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        logger.error('Import siswa failed', err);
        return sendDatabaseError(res, err, 'Terjadi kesalahan saat memproses file');
    }
};

// ================================================
// IMPORT GURU DATA (data-only, no password)
// ================================================

/**
 * Import guru data from Excel file (without account creation)
 * POST /api/admin/import/guru
 */
const importGuru = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);
        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);
        
        // Check existing NIPs
        const existingNips = new Set();
        try {
             const [dbNips] = await db.execute('SELECT nip FROM guru');
             dbNips.forEach(r => existingNips.add(r.nip));
        } catch (e) {
             logger.warn('Failed to fetch existing NIPs', e);
        }

        const validatorWrapper = (rowData, existingSet) => {
             return validateGuruDataRow(rowData, [], existingSet);
        };

        const { valid, errors } = validateBatchRows(rows, validatorWrapper, existingNips);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }

        if (valid.length === 0) {
            return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            let successCount = 0;
            let duplicateCount = 0;

            for (const record of valid) {
                const status = await processGuruData(conn, record);
                if (status === 'new') successCount++;
                else duplicateCount++;
            }

            await conn.commit();
            res.json({
                success: true,
                processed: valid.length,
                new: successCount,
                updated: duplicateCount,
                invalid: errors.length,
                errors,
                message: `Import data guru berhasil! ${successCount} baru, ${duplicateCount} diupdate.`
            });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        logger.error('Import guru failed', err);
        return sendDatabaseError(res, err, 'Gagal import guru');
    }
};

// ================================================
// IMPORT ACCOUNT (Student & Teacher)
// ================================================

/**
 * Import student account from Excel file
 * POST /api/admin/import/student-account
 */
const importStudentAccount = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);

        // Validate
        const { valid, errors } = validateBatchRows(rows, validateStudentAccountRow, {});

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20),
                message: MSG_DRY_RUN_COMPLETED
            });
        }

        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            let successCount = 0;
            let duplicateCount = 0;

            for (const record of valid) {
                 const status = await processStudentAccount(conn, record);
                 if (status === 'new') successCount++;
                 else duplicateCount++;
            }
            await conn.commit();
            res.json({ success: true, processed: valid.length, new: successCount, updated: duplicateCount, invalid: errors.length, errors });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        logger.error('Import student account failed', err);
        return sendDatabaseError(res, err, 'Gagal import akun siswa');
    }
};

/**
 * Import teacher account from Excel file
 * POST /api/admin/import/teacher-account
 */
const importTeacherAccount = async (req, res) => {
    try {
        if (!req.file) return sendImportValidationError(res, ERROR_FILE_NOT_FOUND);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(worksheet);

        // Validate
        const { valid, errors } = validateBatchRows(rows, validateTeacherAccountRow, {});

        if (req.query.dryRun === 'true') {
             return res.json({
                 total: rows.length,
                 valid: valid.length,
                 invalid: errors.length,
                 errors,
                 previewData: valid.slice(0, 20),
                 message: MSG_DRY_RUN_COMPLETED
             });
        }

        if (valid.length === 0) return sendImportValidationError(res, ERROR_NO_VALID_ROWS, errors);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            let successCount = 0;
            let duplicateCount = 0;

            for (const record of valid) {
                 const status = await processTeacherAccount(conn, record);
                 if (status === 'new') successCount++;
                 else duplicateCount++;
            }
            await conn.commit();
            res.json({ success: true, processed: valid.length, new: successCount, updated: duplicateCount, invalid: errors.length, errors });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        logger.error('Import teacher account failed', err);
        return sendDatabaseError(res, err, 'Gagal import akun guru');
    }
};

// ES Module exports
export {
    importMapel,
    importKelas,
    importRuang,
    importJadwal,
    importStudentAccount,
    importTeacherAccount,
    importSiswa,
    importGuru
};
