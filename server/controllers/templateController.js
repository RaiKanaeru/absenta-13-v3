/**
 * Template Controller (Refactored)
 * Handles Excel template generation for admin imports
 * 
 * Refactored to reduce code duplication using config-based approach
 */

import ExcelJS from 'exceljs';
import { sendDatabaseError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import { COLUMN_CONFIGS, SAMPLE_DATA, GUIDE_DATA } from '../config/templateConfig.js';

const logger = createLogger('Template');

// ================================================
// CONSTANTS - Content Types
// ================================================

const EXCEL_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ================================================
// TEMPLATE CONFIGURATIONS
// ================================================







// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Set Excel response headers
 */
function setExcelHeaders(res, filename) {
    res.setHeader('Content-Type', EXCEL_CONTENT_TYPE);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

/**
 * Add kelas reference sheet with database fallback
 */
async function addKelasReferenceSheet(workbook, sheetName = 'Ref Kelas') {
    const kelasSheet = workbook.addWorksheet(sheetName);
    kelasSheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Nama Kelas', key: 'nama', width: 30 },
        { header: 'Tingkat', key: 'tingkat', width: 15 },
        { header: 'Status', key: 'status', width: 15 }
    ];

    try {
        const [kelas] = await globalThis.dbPool.execute(
            'SELECT id_kelas, nama_kelas, tingkat, status FROM kelas WHERE status = "aktif" ORDER BY nama_kelas'
        );
        kelas.forEach(k => {
            kelasSheet.addRow({ id: k.id_kelas, nama: k.nama_kelas, tingkat: k.tingkat || '', status: k.status });
        });
    } catch (dbError) {
        logger.warn('Kelas reference fallback used', { error: dbError.message });
        kelasSheet.addRow({ id: 1, nama: 'X IPA 1', tingkat: 'X', status: 'aktif' });
        kelasSheet.addRow({ id: 2, nama: 'X IPA 2', tingkat: 'X', status: 'aktif' });
        kelasSheet.addRow({ id: 3, nama: 'XI IPA 1', tingkat: 'XI', status: 'aktif' });
    }
    return kelasSheet;
}

/**
 * Add jadwal reference sheets (kelas, mapel, guru, ruang)
 */
async function addJadwalReferenceSheets(workbook) {
    try {
        // Kelas reference
        const [kelas] = await globalThis.dbPool.execute('SELECT id_kelas, nama_kelas FROM kelas WHERE status = "aktif"');
        const kelasSheet = workbook.addWorksheet('Ref Kelas');
        kelasSheet.addRow(['ID', 'Nama Kelas']);
        kelas.forEach(k => kelasSheet.addRow([k.id_kelas, k.nama_kelas]));

        // Mapel reference
        const [mapel] = await globalThis.dbPool.execute('SELECT id_mapel, nama_mapel FROM mapel WHERE status = "aktif"');
        const mapelSheet = workbook.addWorksheet('Ref Mapel');
        mapelSheet.addRow(['ID', 'Nama Mapel']);
        mapel.forEach(m => mapelSheet.addRow([m.id_mapel, m.nama_mapel]));

        // Guru reference
        const [guru] = await globalThis.dbPool.execute('SELECT id_guru, nama, nip FROM guru WHERE status = "aktif"');
        const guruSheet = workbook.addWorksheet('Ref Guru');
        guruSheet.addRow(['ID', 'Nama', 'NIP']);
        guru.forEach(g => guruSheet.addRow([g.id_guru, g.nama, g.nip]));

        // Ruang reference
        const [ruang] = await globalThis.dbPool.execute('SELECT id_ruang, kode_ruang, nama_ruang FROM ruang_kelas WHERE status = "aktif"');
        const ruangSheet = workbook.addWorksheet('Ref Ruang');
        ruangSheet.addRow(['ID', 'Kode Ruang', 'Nama Ruang']);
        ruang.forEach(r => ruangSheet.addRow([r.id_ruang, r.kode_ruang, r.nama_ruang]));
    } catch (error) {
        logger.warn('Jadwal reference sheets failed', { error: error.message });
    }
}

/**
 * Add guide sheet to workbook
 */
function addGuideSheet(workbook, guideData, hasContoh = true) {
    const guideSheet = workbook.addWorksheet('Panduan');
    
    if (guideData[0]?.petunjuk !== undefined) {
        // Single column guide (petunjuk style)
        guideSheet.columns = [{ header: 'Petunjuk Pengisian', key: 'petunjuk', width: 60 }];
        guideData.forEach(p => guideSheet.addRow(p));
    } else if (hasContoh) {
        // Multi-column guide with contoh
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Contoh', key: 'contoh', width: 30 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];
        guideData.forEach(p => guideSheet.addRow(p));
    } else {
        // Multi-column guide without contoh
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];
        guideData.forEach(p => guideSheet.addRow(p));
    }
    return guideSheet;
}

/**
 * Generic template generator
 */
async function generateTemplate(req, res, config) {
    const { 
        logName, 
        sheetName, 
        columns, 
        sampleData, 
        filename, 
        guideData, 
        hasContoh,
        addKelasRef,
        addJadwalRef
    } = config;

    const log = logger.withRequest(req, res);
    log.requestStart(logName, {});

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);
        worksheet.columns = columns;

        // Add sample data if provided
        if (sampleData) {
            worksheet.addRow(sampleData);
        }

        // Add reference sheets
        if (addKelasRef) {
            await addKelasReferenceSheet(workbook);
        }
        if (addJadwalRef) {
            await addJadwalReferenceSheets(workbook);
        }

        // Add guide sheet if provided
        if (guideData) {
            addGuideSheet(workbook, guideData, hasContoh);
        }

        setExcelHeaders(res, filename);
        await workbook.xlsx.write(res);
        res.end();
        log.success(logName, {});
    } catch (error) {
        log.dbError(`generate${logName}`, error);
        return sendDatabaseError(res, error, 'Gagal membuat template');
    }
}

// ================================================
// LEGACY TEMPLATE HANDLERS (for backward compatibility)
// ================================================

const getMapelTemplate = (req, res) => generateTemplate(req, res, {
    logName: 'GetMapelTemplate',
    sheetName: 'mapel',
    columns: COLUMN_CONFIGS.mapel.legacy,
    sampleData: SAMPLE_DATA.mapel,
    filename: 'template-mapel.xlsx'
});

const getKelasTemplate = (req, res) => generateTemplate(req, res, {
    logName: 'GetKelasTemplate',
    sheetName: 'kelas',
    columns: COLUMN_CONFIGS.kelas.legacy,
    sampleData: SAMPLE_DATA.kelas,
    filename: 'template-kelas.xlsx'
});

const getRuangTemplate = (req, res) => generateTemplate(req, res, {
    logName: 'GetRuangTemplate',
    sheetName: 'ruang',
    columns: COLUMN_CONFIGS.ruang.legacy,
    sampleData: SAMPLE_DATA.ruang,
    filename: 'template-ruang.xlsx'
});

const getJadwalTemplate = (req, res) => generateTemplate(req, res, {
    logName: 'GetJadwalTemplate',
    sheetName: 'jadwal',
    columns: COLUMN_CONFIGS.jadwal.legacy,
    sampleData: SAMPLE_DATA.jadwal,
    filename: 'template-jadwal.xlsx',
    guideData: GUIDE_DATA.jadwal
});

const getGuruTemplate = (req, res) => generateTemplate(req, res, {
    logName: 'GetGuruTemplate',
    sheetName: 'guru',
    columns: COLUMN_CONFIGS.guru.legacy,
    sampleData: SAMPLE_DATA.guru,
    filename: 'template-guru.xlsx',
    guideData: GUIDE_DATA.guruLegacy
});

// ================================================
// EXTENDED TEMPLATE HANDLERS
// ================================================

// Student Account Templates
const getStudentAccountTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetStudentAccountTemplateBasic',
    sheetName: 'Data Akun Siswa',
    columns: COLUMN_CONFIGS.studentAccount.basic,
    sampleData: SAMPLE_DATA.studentAccount,
    filename: 'template-akun-siswa-basic.xlsx',
    addKelasRef: true,
    guideData: GUIDE_DATA.studentAccount,
    hasContoh: true
});

const getStudentAccountTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetStudentAccountTemplateFriendly',
    sheetName: 'Data Akun Siswa',
    columns: COLUMN_CONFIGS.studentAccount.friendly,
    filename: 'template-akun-siswa-friendly.xlsx',
    addKelasRef: true
});

// Teacher Account Templates
const getTeacherAccountTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetTeacherAccountTemplateBasic',
    sheetName: 'Data Akun Guru',
    columns: COLUMN_CONFIGS.teacherAccount.basic,
    sampleData: SAMPLE_DATA.teacherAccount,
    filename: 'template-akun-guru-basic.xlsx',
    guideData: GUIDE_DATA.teacherAccount,
    hasContoh: false
});

const getTeacherAccountTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetTeacherAccountTemplateFriendly',
    sheetName: 'Data Akun Guru',
    columns: COLUMN_CONFIGS.teacherAccount.friendly,
    filename: 'template-akun-guru-friendly.xlsx'
});

// Siswa Data Templates
const getSiswaTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetSiswaTemplateBasic',
    sheetName: 'Data Siswa',
    columns: COLUMN_CONFIGS.siswa.basic,
    sampleData: SAMPLE_DATA.siswa,
    filename: 'template-data-siswa-basic.xlsx',
    addKelasRef: true
});

const getSiswaTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetSiswaTemplateFriendly',
    sheetName: 'Data Siswa',
    columns: COLUMN_CONFIGS.siswa.friendly,
    filename: 'template-data-siswa-friendly.xlsx',
    addKelasRef: true,
    guideData: GUIDE_DATA.siswa,
    hasContoh: false
});

// Guru Data Templates
const getGuruTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetGuruTemplateBasic',
    sheetName: 'Data Guru',
    columns: COLUMN_CONFIGS.guru.basic,
    sampleData: SAMPLE_DATA.guru,
    filename: 'template-data-guru-basic.xlsx'
});

const getGuruTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetGuruTemplateFriendly',
    sheetName: 'Data Guru',
    columns: COLUMN_CONFIGS.guru.friendly,
    filename: 'template-data-guru-friendly.xlsx',
    guideData: GUIDE_DATA.guru,
    hasContoh: false
});

// Mapel Templates
const getMapelTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetMapelTemplateBasic',
    sheetName: 'Data Mapel',
    columns: COLUMN_CONFIGS.mapel.basic,
    filename: 'template-mapel-basic.xlsx'
});

const getMapelTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetMapelTemplateFriendly',
    sheetName: 'Data Mapel',
    columns: COLUMN_CONFIGS.mapel.friendly,
    filename: 'template-mapel-friendly.xlsx'
});

// Kelas Templates
const getKelasTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetKelasTemplateBasic',
    sheetName: 'Data Kelas',
    columns: COLUMN_CONFIGS.kelas.basic,
    filename: 'template-kelas-basic.xlsx'
});

const getKelasTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetKelasTemplateFriendly',
    sheetName: 'Data Kelas',
    columns: COLUMN_CONFIGS.kelas.friendly,
    filename: 'template-kelas-friendly.xlsx'
});

// Ruang Templates
const getRuangTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetRuangTemplateBasic',
    sheetName: 'Data Ruang',
    columns: COLUMN_CONFIGS.ruang.basic,
    filename: 'template-ruang-basic.xlsx'
});

const getRuangTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetRuangTemplateFriendly',
    sheetName: 'Data Ruang',
    columns: COLUMN_CONFIGS.ruang.friendly,
    filename: 'template-ruang-friendly.xlsx'
});

// Jadwal Templates
const getJadwalTemplateBasic = (req, res) => generateTemplate(req, res, {
    logName: 'GetJadwalTemplateBasic',
    sheetName: 'Data Jadwal',
    columns: COLUMN_CONFIGS.jadwal.basic,
    filename: 'template-jadwal-basic.xlsx',
    addJadwalRef: true
});

const getJadwalTemplateFriendly = (req, res) => generateTemplate(req, res, {
    logName: 'GetJadwalTemplateFriendly',
    sheetName: 'Data Jadwal',
    columns: COLUMN_CONFIGS.jadwal.friendly,
    filename: 'template-jadwal-friendly.xlsx',
    addJadwalRef: true
});

// ================================================
// EXPORTS
// ================================================

export {
    // Original simple templates
    getMapelTemplate,
    getKelasTemplate,
    getRuangTemplate,
    getJadwalTemplate,
    getGuruTemplate,
    // Extended templates with reference sheets
    getStudentAccountTemplateBasic,
    getStudentAccountTemplateFriendly,
    getTeacherAccountTemplateBasic,
    getTeacherAccountTemplateFriendly,
    getSiswaTemplateBasic,
    getSiswaTemplateFriendly,
    getGuruTemplateBasic,
    getGuruTemplateFriendly,
    getMapelTemplateBasic,
    getMapelTemplateFriendly,
    getKelasTemplateBasic,
    getKelasTemplateFriendly,
    getRuangTemplateBasic,
    getRuangTemplateFriendly,
    getJadwalTemplateBasic,
    getJadwalTemplateFriendly
};
