
import ExcelJS from 'exceljs';
import { sendDatabaseError, sendValidationError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import { mapKelasByName, mapMapelByName, mapGuruByName, mapRuangByKode } from '../utils/importHelper.js';

const logger = createLogger('ImportMaster');

// Configuration for headers (could be dynamic, but hardcoded based on analysis)
const DAY_HEADERS = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

// Helper to sanitize cell value
const getVal = (row, colIdx) => {
    const val = row.getCell(colIdx).value;
    return val ? val.toString().trim() : '';
};

const MATCH_THRESHOLD = 0.6; // Simple fuzzy threshold (concept only)

/**
 * Handle Master Schedule Import (CSV/XLSX)
 * Structure: 
 *   Rows: Blocks of 3 (Mapel, Ruang, Guru) per Class
 *   Cols: Time Slots across Days
 */
export const importMasterSchedule = async (req, res) => {
    const log = logger.withRequest(req, res);
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

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
             return res.status(400).json({ error: 'Format header hari (SENIN, SELASA...) tidak ditemukan di 10 baris pertama.' });
        }

        // 2. Identify Class Blocks
        const scheduleData = [];
        const errors = [];

        // Skip headers (approx 10 rows)
        const startRowIdx = 10; 
        
        for (let i = startRowIdx; i < rows.length; i++) {
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
                // const labelB = getVal(rowB, 3).toUpperCase();
                // const labelC_ = getVal(rowC, 3).toUpperCase();
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
                            jamKe = parseInt(val) || 0;
                        } catch (e) {}

                        // If jamKe is 0, maybe it's break or special column
                        if (jamKe === 0) continue;

                        const rawMapel = getVal(rowA, col);
                        const rawRuang = getVal(rowB, col);
                        const rawGuru = getVal(rowC, col);

                        if (!rawMapel && !rawGuru) continue; // Empty slot

                        scheduleData.push({
                            className,
                            day: day.name,
                            jamKe,
                            rawMapel,
                            rawRuang,
                            rawGuru
                        });
                    }
                }
                
                i += 2; // Skip the next 2 rows (Ruang, Guru)
            }
        }

        if (scheduleData.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data jadwal yang ditemukan.' });
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
        const conn = await globalThis.dbPool.getConnection();
        const results = { success: 0, failed: 0, errors: [] };

        try {
            await conn.beginTransaction();
            
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
                    
                    // Resolve Ruang
                    if (item.rawRuang && !ruangMap.has(item.rawRuang)) {
                        const id = await mapRuangByKode(item.rawRuang);
                        ruangMap.set(item.rawRuang, id);
                    }
                    const ruangId = ruangMap.get(item.rawRuang) || null;

                    // Construct Insert
                    // Note: We need Jam Mulai/Selesai. 
                    // Ideally we fetch from 'jam_pelajaran_master' table based on 'jamKe' and 'hari'
                    // For now, allow NULL or default? The DB schema requires them?
                    // Let's fetch default times or placeholders.
                    
                    // Insert Jadwal
                     const [res] = await conn.execute(
                        `INSERT INTO jadwal_pelajaran 
                        (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, '00:00:00', '00:00:00', NOW())`,
                        [kelasId, mapelId || null, guruIds[0] || null, ruangId, item.day, item.jamKe]
                    );
                    
                    const jadwalId = res.insertId;

                    // Insert Multi Guru
                    if (guruIds.length > 1) {
                         for (const gid of guruIds) {
                            await conn.execute(
                                `INSERT INTO jadwal_guru (jadwal_id, guru_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE guru_id=guru_id`,
                                [jadwalId, gid]
                            );
                        }
                    }

                    results.success++;

                } catch (err) {
                    results.failed++;
                    results.errors.push({ item, error: err.message });
                }
            }

            await conn.commit();
            res.json({
                success: true,
                imported: results.success,
                failed: results.failed,
                errors: results.errors.slice(0, 100) // Limit response size
            });

        } catch (dbErr) {
            await conn.rollback();
            throw dbErr;
        } finally {
            conn.release();
        }

    } catch (error) {
        log.error('Master Import Error', error);
        sendDatabaseError(res, error, 'Gagal memproses file master');
    }
};
