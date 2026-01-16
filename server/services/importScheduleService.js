import fs from 'fs';
import csv from 'csv-parser';

import { createLogger } from '../utils/logger.js';

/**
 * Service to import Master Schedule from CSV
 * Format: 3 Rows per Class (Mapel, Ruang, Guru)
 * Handles "Senin" -> "Jumat" columns with specific Index mapping.
 */

const DAY_MAPPING = {
  'SENIN': { startCol: 4, endCol: 19, hari: 'Senin' }, // Cols E(4) to T(19) based on observation
  'SELASA': { startCol: 21, endCol: 36, hari: 'Selasa' },
  'RABU': { startCol: 38, endCol: 53, hari: 'Rabu' },
  'KAMIS': { startCol: 55, endCol: 70, hari: 'Kamis' },
  'JUM\'AT': { startCol: 72, endCol: 86, hari: 'Jumat' } // Check indices later
};

// Map column index relative to Day Start to "Jam Ke"
// Based on CSV header analysis
const COL_OFFSET_TO_JAM = {
  0: 0, // Pembiasaan
  1: 1, 
  2: 2,
  3: 3,
  4: 4,
  5: 5, // Istirahat 1 might be here
  6: 6,
  7: 7,
  8: 8, // Istirahat 2
  9: 9,
  10: 10,
  11: 11,
  12: 12, // Late slot 1
  13: 13  // Late slot 2
};

export const processMasterScheduleImport = async (filePath) => {
  const results = [];
  const log = createLogger('ScheduleImport');
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ headers: false })) // Read as array of strings
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const stats = await importDataToDB(results, log);
          resolve(stats);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
};

async function importDataToDB(rows, log) {
  const connection = await globalThis.dbPool.getConnection();
  await connection.beginTransaction();

  
  try {
    let currentKelasName = '';
    let currentMapelRow = null;
    let currentRuangRow = null;
    let currentGuruRow = null;
    
    let importedCount = 0;
    
    // Scan rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const col1 = row[1] ? row[1].trim() : ''; // Column B: KELAS
      const col2 = row[2] ? row[2].trim() : ''; // Column C: TYPE
      
      // Detect Class Block Start
      if (col1 && col1.length > 3 && col2 === 'MAPEL') {
        currentKelasName = col1;
        currentMapelRow = row;
        
        // Assume next 2 rows are Ruang and Guru
        currentRuangRow = rows[i+1];
        currentGuruRow = rows[i+2];
        
        if (currentRuangRow && currentGuruRow) {
          await processClassBlock(connection, currentKelasName, currentMapelRow, currentRuangRow, currentGuruRow);
          importedCount++;
        }
      }
    }
    
    await connection.commit();
    return { success: true, classesProcessed: importedCount };
    
  } catch (error) {
    await connection.rollback();
    log.error('Import failed', error);
    throw error;
  } finally {
    connection.release();
  }
}

async function processClassBlock(connection, kelasName, rowMapel, rowRuang, rowGuru) {
  // 1. Find or Create Kelas
  const [kelasRows] = await connection.execute('SELECT id_kelas FROM kelas WHERE nama_kelas = ?', [kelasName]);
  let kelasId;
  
  if (kelasRows.length > 0) {
    kelasId = kelasRows[0].id_kelas;
  } else {
    // Try to guess tingkat/jurusan/rombel from name "X KA 1"
    const parts = kelasName.split(' ');
    // Very basic fallback parsing
    const tingkat = parts[0] || 'X';
    const jurusan = parts[1] || 'UMUM';
    const rombel = parts[2] || '1';
    
    const [res] = await connection.execute(
      'INSERT INTO kelas (nama_kelas, tingkat, jurusan_kode, rombel, tahun_ajaran) VALUES (?, ?, ?, ?, ?)',
      [kelasName, tingkat, jurusan, rombel, '2025/2026']
    );
    kelasId = res.insertId;
  }
  
  // 2. Iterate Days
  for (const [dayName, config] of Object.entries(DAY_MAPPING)) {
    await processDayForClass(connection, kelasId, config, rowMapel, rowRuang, rowGuru);
  }
}

async function processDayForClass(connection, kelasId, dayConfig, mapelRow, ruangRow, guruRow) {
  const { startCol, endCol, hari } = dayConfig;
  
  // Iterate columns for this day
  // CSV-parser uses numerical keys '0', '1', '2'... for columns
  // startCol is 0-based index
  
  let colIndex = startCol;
  let jamInternal = 0; // Starts at 0 (Pembiasaan)
  
  while (colIndex <= endCol) {
    const mapelRaw = mapelRow[colIndex];
    if (shouldProcessSlot(mapelRaw)) {
       const mapelCode = cleanCell(mapelRaw);
       const ruangCode = cleanCell(ruangRow[colIndex]);
       const guruCode = cleanCell(guruRow[colIndex]);
       
       if (mapelCode && mapelCode !== 'ISTIRAHAT' && mapelCode !== 'DZUHUR' && mapelCode !== 'MESJID') {
         await insertScheduleSlot(connection, {
           kelasId,
           hari,
           jamKe: jamInternal,
           mapelCode,
           ruangCode,
           guruCode
         });
       }
    }
    
    // Increment counters
    colIndex++;
    jamInternal++;
    
    // Skip if we exceed 13 hours
    if (jamInternal > 15) break; 
  }
}

function shouldProcessSlot(val) {
   // Skip empty or purely structural columns if identifiable
   // For now process all, filter later
   return true; 
}

function cleanCell(val) {
  if (!val) return null;
  const s = val.trim();
  if (s === '-' || s === '') return null;
  return s;
}

async function insertScheduleSlot(connection, data) {
  const { kelasId, hari, jamKe, mapelCode, ruangCode, guruCode } = data;
  
  // 1. Resolve Guru
  let guruId = null;
  if (guruCode) {
    const [gRows] = await connection.execute('SELECT id_guru FROM guru WHERE kode_guru = ? OR nama LIKE ? LIMIT 1', [guruCode, `%${guruCode}%`]);
    if (gRows.length > 0) {
      guruId = gRows[0].id_guru;
    } else {
       // Auto-create stub guru? Or Map to 0?
       // For now, map to SYSTEM entity or leave null if strict
       // Let's create a stub for now to avoid data loss
       const [newG] = await connection.execute('INSERT INTO guru (nama, kode_guru, username, password, status) VALUES (?, ?, ?, ?, ?)', 
         [guruCode, guruCode, `guru_${Date.now()}_${Math.floor(Math.random()*1000)}`, '123456', 'aktif']);
       guruId = newG.insertId;
    }
  }
  
  // 2. Resolve Mapel
  let mapelId = null;
  if (mapelCode) {
    const [mRows] = await connection.execute('SELECT id_mapel FROM mapel WHERE kode_mapel = ? OR nama_mapel LIKE ? LIMIT 1', [mapelCode, `%${mapelCode}%`]);
    if (mRows.length > 0) mapelId = mRows[0].id_mapel;
    else {
       const [newM] = await connection.execute('INSERT INTO mapel (nama_mapel, kode_mapel, status) VALUES (?, ?, ?)', [mapelCode, mapelCode, 'aktif']);
       mapelId = newM.insertId;
    }
  }
  
  // 3. Resolve Ruang
  let ruangId = null;
  if (ruangCode) {
     const [rRows] = await connection.execute('SELECT id_ruang FROM ruang_kelas WHERE kode_ruang = ? LIMIT 1', [ruangCode]);
     if (rRows.length > 0) ruangId = rRows[0].id_ruang;
     else {
        const [newR] = await connection.execute('INSERT INTO ruang_kelas (nama_ruang, kode_ruang, kapasitas) VALUES (?, ?, ?)', [ruangCode, ruangCode, 36]);
        ruangId = newR.insertId;
     }
  }
  
  // 4. Upsert Jadwal
  // Delete existing for this slot first to be clean
  await connection.execute('DELETE FROM jadwal WHERE kelas_id=? AND hari=? AND jam_ke=?', [kelasId, hari, jamKe]);
  
  await connection.execute(
    'INSERT INTO jadwal (kelas_id, hari, jam_ke, mapel_id, guru_id, ruang_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [kelasId, hari, jamKe, mapelId, guruId, ruangId, 'aktif']
  );
}
