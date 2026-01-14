// ===================================================================
// ABSENTA Export System - Terintegrasi dengan Sistem Existing
// Format Export sesuai SMKN 13 Bandung
// ===================================================================

import ExcelJS from 'exceljs';

// WIB Timezone Helper Functions
const TIMEZONE_OFFSET = 7 * 60; // 7 hours in minutes

function getWIBTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (TIMEZONE_OFFSET * 60000));
  return wib;
}

function getCurrentYearWIB() {
  const wibDate = getWIBTime();
  return wibDate.getFullYear().toString();
}

function formatDateWIB(date) {
  const dateObj = date ? new Date(date) : getWIBTime();
  const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (TIMEZONE_OFFSET * 60000));
  const year = wib.getFullYear();
  const month = String(wib.getMonth() + 1).padStart(2, '0');
  const day = String(wib.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ===================================================================
// 1. SCHEMA MAPPING UNTUK SISTEM ABSENTA
// ===================================================================

const ABSENTA_SCHEMA_MAPPING = {
  // Format Daftar Guru (untuk Rapat Pleno)
  TEACHER_LIST: {
    headers: ['NO', 'NAMA', 'NIP/NUPTK'],
    fields: {
      NO: 'row_number',
      NAMA: 'nama', 
      'NIP/NUPTK': 'nip'
    }
  },

  // Format Rekap Ketidakhadiran Guru
  TEACHER_ABSENCE: {
    headers: ['NO', 'NAMA GURU', 'NIP', 'MATA PELAJARAN', 'KELAS', 
              'TANGGAL', 'JAM KE', 'KETERANGAN', 'STATUS'],
    fields: {
      NO: 'row_number',
      'NAMA GURU': 'nama_guru',
      NIP: 'nip',
      'MATA PELAJARAN': 'nama_mapel',
      KELAS: 'nama_kelas',
      TANGGAL: 'tanggal_absen',
      'JAM KE': 'jam_ke',
      KETERANGAN: 'keterangan',
      STATUS: 'status'
    }
  },

  // Format Presensi Siswa
  STUDENT_ATTENDANCE: {
    headers: ['NO', 'NAMA SISWA', 'NIS', 'KELAS', 'TANGGAL', 
              'JAM MASUK', 'JAM KELUAR', 'STATUS', 'KETERANGAN'],
    fields: {
      NO: 'row_number',
      'NAMA SISWA': 'nama_siswa',
      NIS: 'nis',
      KELAS: 'nama_kelas',
      TANGGAL: 'tanggal_absen',
      'JAM MASUK': 'jam_mulai',
      'JAM KELUAR': 'jam_selesai',
      STATUS: 'status',
      KETERANGAN: 'keterangan'
    }
  },

  // Format Ringkasan Kehadiran Siswa
  STUDENT_SUMMARY: {
    headers: ['NO', 'NAMA SISWA', 'NIS', 'KELAS', 'HADIR', 'IZIN', 'SAKIT', 'ALPA', 'DISPEN', 'PRESENTASE'],
    fields: {
      NO: 'row_number',
      'NAMA SISWA': 'nama',
      NIS: 'nis',
      KELAS: 'nama_kelas',
      HADIR: 'H',
      IZIN: 'I',
      SAKIT: 'S',
      ALPA: 'A',
      DISPEN: 'D',
      PRESENTASE: 'presentase'
    }
  },

  // Format Ringkasan Kehadiran Guru
  TEACHER_SUMMARY: {
    headers: ['NO', 'NAMA GURU', 'NIP', 'HADIR', 'IZIN', 'SAKIT', 'ALPA', 'PRESENTASE'],
    fields: {
      NO: 'row_number',
      'NAMA GURU': 'nama',
      NIP: 'nip',
      HADIR: 'H',
      IZIN: 'I',
      SAKIT: 'S',
      ALPA: 'A',
      PRESENTASE: 'presentase'
    }
  },

  // Format Banding Absen
  BANDING_ABSEN: {
    headers: ['NO', 'TANGGAL PENGAJUAN', 'TANGGAL ABSEN', 'PENGAJU', 'KELAS', 'MATA PELAJARAN', 
              'GURU', 'JADWAL', 'STATUS ASLI', 'STATUS DIAJUKAN', 'ALASAN BANDING', 
              'STATUS BANDING', 'CATATAN GURU', 'TANGGAL KEPUTUSAN'],
    fields: {
      NO: 'row_number',
      'TANGGAL PENGAJUAN': 'tanggal_pengajuan',
      'TANGGAL ABSEN': 'tanggal_absen',
      PENGAJU: 'nama_pengaju',
      KELAS: 'nama_kelas',
      'MATA PELAJARAN': 'nama_mapel',
      GURU: 'nama_guru',
      JADWAL: 'jadwal',
      'STATUS ASLI': 'status_asli',
      'STATUS DIAJUKAN': 'status_diajukan',
      'ALASAN BANDING': 'alasan_banding',
      'STATUS BANDING': 'status_banding',
      'CATATAN GURU': 'catatan_guru',
      'TANGGAL KEPUTUSAN': 'tanggal_keputusan'
    }
  },

};

// ===================================================================
// 2. ABSENTA EXPORT SYSTEM CLASS
// ===================================================================

class AbsentaExportSystem {
  constructor() {
    this.exportFormats = ABSENTA_SCHEMA_MAPPING;
  }

  // ================================================================
  // Export Daftar Guru (Format Rapat Pleno)
  // ================================================================
  async exportTeacherList(data, academicYear = '2025-2026') {
    try {
      console.log('🎯 Generating Teacher List Export...');
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Daftar Guru');
      
      // Header sekolah
      this.addSchoolHeader(worksheet, {
        title: `DAFTAR PESERTA RAPAT PLENO SPMB TAHAP 2`,
        subtitle: `Tahun Ajaran ${academicYear}`,
        documentNumber: `1709/HUB.04.15.06/SMKN13BDG`,
        date: formatDateWIB(new Date())
      });
      
      // Table headers
      const headerRow = 15;
      const headers = this.exportFormats.TEACHER_LIST.headers;
      
      this.addTableHeaders(worksheet, headerRow, headers);
      
      // Data rows
      let currentRow = headerRow + 1;
      data.forEach((teacher, index) => {
        worksheet.getCell(currentRow, 1).value = index + 1;
        worksheet.getCell(currentRow, 2).value = teacher.nama;
        worksheet.getCell(currentRow, 3).value = teacher.nip;
        
        this.addTableRowStyling(worksheet, currentRow, headers.length);
        currentRow++;
      });
      
      // Footer signature
      this.addSignatureFooter(worksheet, currentRow + 3);
      
      // Column widths
      worksheet.getColumn(1).width = 5;
      worksheet.getColumn(2).width = 40;
      worksheet.getColumn(3).width = 20;
      
      return workbook;
      
    } catch (error) {
      console.error('❌ Error exporting teacher list:', error);
      throw error;
    }
  }

  // ================================================================
  // Export Ringkasan Kehadiran Siswa
  // ================================================================
  async exportStudentSummary(data, dateRange) {
    try {
      console.log('📊 Generating Student Summary Export...');
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Ringkasan Kehadiran Siswa');
      
      // Header sekolah
      this.addSchoolHeader(worksheet, {
        title: 'RINGKASAN KEHADIRAN SISWA',
        subtitle: `Periode: ${dateRange.startDate} s/d ${dateRange.endDate}`,
        documentNumber: `RINGKASAN/SISWA/${getCurrentYearWIB()}`,
        date: formatDateWIB(new Date())
      });
      
      // Table headers
      const headerRow = 15;
      const headers = this.exportFormats.STUDENT_SUMMARY.headers;
      
      this.addTableHeaders(worksheet, headerRow, headers);
      
      // Data rows
      let currentRow = headerRow + 1;
      data.forEach((student, index) => {
        worksheet.getCell(currentRow, 1).value = index + 1;
        worksheet.getCell(currentRow, 2).value = student.nama;
        worksheet.getCell(currentRow, 3).value = student.nis;
        worksheet.getCell(currentRow, 4).value = student.nama_kelas || '-';
        worksheet.getCell(currentRow, 5).value = student.H || 0;
        worksheet.getCell(currentRow, 6).value = student.I || 0;
        worksheet.getCell(currentRow, 7).value = student.S || 0;
        worksheet.getCell(currentRow, 8).value = student.A || 0;
        worksheet.getCell(currentRow, 9).value = student.D || 0;
        worksheet.getCell(currentRow, 10).value = `${Number(student.presentase || 0).toFixed(2)}%`;
        
        this.addTableRowStyling(worksheet, currentRow, headers.length);
        currentRow++;
      });
      
      // Summary statistics
      this.addSummarySection(worksheet, currentRow + 2, data, 'siswa');
      
      // Column widths
      const columnWidths = [5, 30, 15, 12, 8, 8, 8, 8, 8, 12];
      columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
      });
      
      return workbook;
      
    } catch (error) {
      console.error('❌ Error exporting student summary:', error);
      throw error;
    }
  }

  // ================================================================
  // Export Ringkasan Kehadiran Guru
  // ================================================================
  async exportTeacherSummary(data, dateRange) {
    try {
      console.log('👨‍🏫 Generating Teacher Summary Export...');
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Ringkasan Kehadiran Guru');
      
      // Header sekolah
      this.addSchoolHeader(worksheet, {
        title: 'RINGKASAN KEHADIRAN GURU',
        subtitle: `Periode: ${dateRange.startDate} s/d ${dateRange.endDate}`,
        documentNumber: `RINGKASAN/GURU/${getCurrentYearWIB()}`,
        date: formatDateWIB(new Date())
      });
      
      // Table headers
      const headerRow = 15;
      const headers = this.exportFormats.TEACHER_SUMMARY.headers;
      
      this.addTableHeaders(worksheet, headerRow, headers);
      
      // Data rows
      let currentRow = headerRow + 1;
      data.forEach((teacher, index) => {
        worksheet.getCell(currentRow, 1).value = index + 1;
        worksheet.getCell(currentRow, 2).value = teacher.nama;
        worksheet.getCell(currentRow, 3).value = teacher.nip || '-';
        worksheet.getCell(currentRow, 4).value = teacher.H || 0;
        worksheet.getCell(currentRow, 5).value = teacher.I || 0;
        worksheet.getCell(currentRow, 6).value = teacher.S || 0;
        worksheet.getCell(currentRow, 7).value = teacher.A || 0;
        worksheet.getCell(currentRow, 8).value = `${Number(teacher.presentase || 0).toFixed(2)}%`;
        
        this.addTableRowStyling(worksheet, currentRow, headers.length);
        currentRow++;
      });
      
      // Summary statistics
      this.addSummarySection(worksheet, currentRow + 2, data, 'guru');
      
      // Column widths
      const columnWidths = [5, 30, 18, 8, 8, 8, 8, 12];
      columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
      });
      
      return workbook;
      
    } catch (error) {
      console.error('❌ Error exporting teacher summary:', error);
      throw error;
    }
  }

  // ================================================================
  // Export Banding Absen
  // ================================================================
  async exportBandingAbsen(data, dateRange) {
    try {
      console.log('📋 Generating Banding Absen Export...');
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Banding Absen');
      
      // Header sekolah
      this.addSchoolHeader(worksheet, {
        title: 'LAPORAN BANDING ABSEN',
        subtitle: `Periode: ${dateRange.startDate} s/d ${dateRange.endDate}`,
        documentNumber: `BANDING/ABSEN/${getCurrentYearWIB()}`,
        date: formatDateWIB(new Date())
      });
      
      // Table headers
      const headerRow = 15;
      const headers = this.exportFormats.BANDING_ABSEN.headers;
      
      this.addTableHeaders(worksheet, headerRow, headers);
      
      // Data rows
      let currentRow = headerRow + 1;
      data.forEach((banding, index) => {
        worksheet.getCell(currentRow, 1).value = index + 1;
        worksheet.getCell(currentRow, 2).value = banding.tanggal_pengajuan;
        worksheet.getCell(currentRow, 3).value = banding.tanggal_absen;
        worksheet.getCell(currentRow, 4).value = banding.nama_pengaju;
        worksheet.getCell(currentRow, 5).value = banding.nama_kelas;
        worksheet.getCell(currentRow, 6).value = banding.nama_mapel;
        worksheet.getCell(currentRow, 7).value = banding.nama_guru;
        worksheet.getCell(currentRow, 8).value = banding.jadwal;
        worksheet.getCell(currentRow, 9).value = banding.status_asli;
        worksheet.getCell(currentRow, 10).value = banding.status_diajukan;
        worksheet.getCell(currentRow, 11).value = banding.alasan_banding;
        worksheet.getCell(currentRow, 12).value = banding.status_banding;
        worksheet.getCell(currentRow, 13).value = banding.catatan_guru || '-';
        worksheet.getCell(currentRow, 14).value = banding.tanggal_keputusan || '-';
        
        this.addTableRowStyling(worksheet, currentRow, headers.length);
        currentRow++;
      });
      
      // Column widths
      const columnWidths = [5, 15, 15, 20, 12, 20, 20, 15, 12, 12, 25, 12, 25, 15];
      columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
      });
      
      return workbook;
      
    } catch (error) {
      console.error('❌ Error exporting banding absen:', error);
      throw error;
    }
  }


  // ================================================================
  // UTILITY METHODS
  // ================================================================
  
  addSchoolHeader(worksheet, options) {
    // Logo dan header sekolah
    worksheet.mergeCells('A1:N4');
    const headerCell = worksheet.getCell('A1');
    headerCell.value = `PEMERINTAH DAERAH PROVINSI JAWA BARAT
DINAS PENDIDIKAN
CABANG DINAS PENDIDIKAN WILAYAH VII
SEKOLAH MENENGAH KEJURUAN NEGERI 13

Jalan Soekarno - Hatta Km.10 Telepon (022) 7318960: Ext. 114
Telepon/Faksimil: (022) 7332252 – Bandung 40286
Email: smk13bdg@gmail.com Home page: http://www.smkn13.sch.id`;
    
    headerCell.style = {
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      font: { bold: true, size: 12 }
    };
    
    // Document info
    worksheet.mergeCells('A6:N7');
    const docInfoCell = worksheet.getCell('A6');
    docInfoCell.value = `Nomor : ${options.documentNumber}                    Bandung, ${options.date}
Lampiran : -
Hal : ${options.title}`;
    
    docInfoCell.style = {
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
      font: { size: 10 }
    };
    
    // Title
    worksheet.mergeCells('A10:N12');
    const titleCell = worksheet.getCell('A10');
    titleCell.value = `${options.title}\n${options.subtitle || ''}`;
    titleCell.style = {
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      font: { bold: true, size: 14 }
    };
  }
  
  addTableHeaders(worksheet, headerRow, headers) {
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(headerRow, index + 1);
      cell.value = header;
      cell.style = {
        font: { bold: true, size: 11 },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: this.getBorderStyle(),
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }
      };
    });
  }
  
  addTableRowStyling(worksheet, row, columnCount) {
    for (let col = 1; col <= columnCount; col++) {
      const cell = worksheet.getCell(row, col);
      cell.style = {
        border: this.getBorderStyle(),
        alignment: { 
          horizontal: col === 1 ? 'center' : 'left', 
          vertical: 'middle',
          wrapText: true
        }
      };
    }
  }
  
  addSignatureFooter(worksheet, startRow) {
    try {
      worksheet.mergeCells(`G${startRow}:I${startRow+3}`);
    } catch (error) {
      // Cell sudah di-merge, skip
      console.log('Cells already merged, skipping...', error);
    }
    
    const signatureCell = worksheet.getCell(`G${startRow}`);
    signatureCell.value = `Plt. Kepala SMKN 13 Bandung




Dr. Hj. Yani Heryani, M.M.Pd
NIP. 196602281997022002`;
    
    signatureCell.style = {
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      font: { size: 10 }
    };
  }
  
  addSummarySection(worksheet, startRow, data, type) {
    const summary = this.calculateSummary(data, type);
    
    worksheet.getCell(startRow, 1).value = 'RINGKASAN:';
    worksheet.getCell(startRow, 1).style = { font: { bold: true, size: 12 } };
    
    Object.entries(summary).forEach(([key, value], index) => {
      worksheet.getCell(startRow + index + 1, 1).value = `${key}:`;
      worksheet.getCell(startRow + index + 1, 2).value = value;
    });
  }
  
  calculateSummary(data, type) {
    const summary = {
      [`Total ${type === 'siswa' ? 'Siswa' : 'Guru'}`]: data.length
    };
    
    if (type === 'siswa') {
      const totalH = data.reduce((sum, item) => sum + (item.H || 0), 0);
      const totalI = data.reduce((sum, item) => sum + (item.I || 0), 0);
      const totalS = data.reduce((sum, item) => sum + (item.S || 0), 0);
      const totalA = data.reduce((sum, item) => sum + (item.A || 0), 0);
      const totalD = data.reduce((sum, item) => sum + (item.D || 0), 0);
      const avgPresentase = data.reduce((sum, item) => sum + (item.presentase || 0), 0) / data.length;
      
      summary['Total Hadir'] = totalH;
      summary['Total Izin'] = totalI;
      summary['Total Sakit'] = totalS;
      summary['Total Alpa'] = totalA;
      summary['Total Dispen'] = totalD;
      summary['Rata-rata Presentase'] = `${avgPresentase.toFixed(2)}%`;
    } else {
      const totalKetidakhadiran = data.reduce((sum, item) => sum + (item.total_ketidakhadiran || 0), 0);
      const avgPresentaseKetidakhadiran = data.reduce((sum, item) => sum + (Number.parseFloat(item.persentase_ketidakhadiran) || 0), 0) / data.length;
      const avgPresentaseKehadiran = data.reduce((sum, item) => sum + (Number.parseFloat(item.persentase_kehadiran) || 0), 0) / data.length;
      
      summary['Total Ketidakhadiran'] = totalKetidakhadiran;
      summary['Rata-rata Presentase Ketidakhadiran'] = `${avgPresentaseKetidakhadiran.toFixed(2)}%`;
      summary['Rata-rata Presentase Kehadiran'] = `${avgPresentaseKehadiran.toFixed(2)}%`;
    }
    
    return summary;
  }
  
  // Export rekap ketidakhadiran guru
  async exportRekapKetidakhadiranGuru(data, options = {}) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekap Ketidakhadiran Guru');

    // Header sekolah
    this.addSchoolHeader(worksheet, {
      title: 'REKAP KETIDAKHADIRAN GURU',
      subtitle: `Tahun: ${options.tahun}`,
      documentNumber: `REKAP/GURU/${getCurrentYearWIB()}`,
      date: new Date().toLocaleDateString('id-ID')
    });

    // Header tabel
    const headerRow = 6;
    const headers = [
      'NO.', 'NAMA GURU', 'JUL', 'AGT', 'SEP', 'OKT', 'NOV', 'DES',
      'JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN',
      'JUMLAH KETIDAKHADIRAN', 'PERSENTASE KETIDAKHADIRAN (%)', 'PERSENTASE KEHADIRAN (%)'
    ];

    headers.forEach((header, index) => {
      const cell = worksheet.getCell(headerRow, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.getBorderStyle();
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });

    // Data rows
    data.forEach((guru, index) => {
      const row = headerRow + 1 + index;
      const rowData = [
        index + 1,
        guru.nama,
        guru.jul || 0,
        guru.agt || 0,
        guru.sep || 0,
        guru.okt || 0,
        guru.nov || 0,
        guru.des || 0,
        guru.jan || 0,
        guru.feb || 0,
        guru.mar || 0,
        guru.apr || 0,
        guru.mei || 0,
        guru.jun || 0,
        guru.total_ketidakhadiran || 0,
        guru.persentase_ketidakhadiran || 0,
        guru.persentase_kehadiran || 0
      ];

      rowData.forEach((value, colIndex) => {
        const cell = worksheet.getCell(row, colIndex + 1);
        cell.value = value;
        cell.border = this.getBorderStyle();
        cell.alignment = { horizontal: colIndex === 1 ? 'left' : 'center', vertical: 'middle' };
      });
    });

    // Set column widths
    worksheet.getColumn(1).width = 8;  // NO
    worksheet.getColumn(2).width = 30; // NAMA GURU
    for (let i = 3; i <= 14; i++) {
      worksheet.getColumn(i).width = 10; // Bulan columns
    }
    worksheet.getColumn(15).width = 20; // JUMLAH KETIDAKHADIRAN
    worksheet.getColumn(16).width = 25; // PERSENTASE KETIDAKHADIRAN
    worksheet.getColumn(17).width = 25; // PERSENTASE KEHADIRAN

    // Footer
    this.addSignatureFooter(worksheet, data.length + 8);

    return workbook;
  }

  // Export rekap ketidakhadiran guru SMKN 13
  async exportRekapKetidakhadiranGuruSMKN13(data, options = {}) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('REKAP KETIDAKHADIRAN GURU');

    // Header SMKN 13
    this.addSchoolHeader(worksheet, {
      title: 'REKAP KETIDAKHADIRAN GURU',
      subtitle: `Tahun: ${options.tahun}`,
      documentNumber: `REKAP/GURU/SMKN13/${getCurrentYearWIB()}`,
      date: new Date().toLocaleDateString('id-ID')
    });

    // Header tabel dengan format SMKN 13
    const headerRow = 6;
    
    // Row 1: Main header
    worksheet.mergeCells(headerRow, 1, headerRow, 17);
    const mainHeader = worksheet.getCell(headerRow, 1);
    mainHeader.value = 'REKAP KETIDAKHADIRAN GURU';
    mainHeader.font = { bold: true, size: 14 };
    mainHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    mainHeader.border = this.getBorderStyle();
    mainHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB0E0E6' } };

    // Row 2: Sub headers
    const subHeaders = [
      'NO.', 'NAMA GURU', 'BULAN/JUMLAH HARI EFEKTIF KERJA', '', '', '', '', '', '', '', '', '', '', '', 'JUMLAH KETIDAKHADIRAN', 'PERSENTASE KETIDAKHADIRAN (%)', 'PERSENTASE KEHADIRAN (%)'
    ];

    subHeaders.forEach((header, index) => {
      const cell = worksheet.getCell(headerRow + 1, index + 1);
      if (index === 2) {
        worksheet.mergeCells(headerRow + 1, 3, headerRow + 1, 14);
        cell.value = 'BULAN/JUMLAH HARI EFEKTIF KERJA';
      } else if (index >= 3 && index <= 13) {
        // Skip merged cells
      } else {
        cell.value = header;
      }
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.getBorderStyle();
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });

    // Row 3: Month headers with effective days
    const monthHeaders = [
      'JUL (14)', 'AGT (21)', 'SEP (22)', 'OKT (23)', 'NOV (20)', 'DES (17)',
      'JAN (15)', 'FEB (20)', 'MAR (22)', 'APR (22)', 'MEI (21)', 'JUN (20)'
    ];

    monthHeaders.forEach((header, index) => {
      const cell = worksheet.getCell(headerRow + 2, index + 3);
      cell.value = header;
      cell.font = { bold: true, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.getBorderStyle();
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index < 6 ? 'FFB0E0E6' : 'FFB0F0B0' } };
    });

    // Data rows
    data.forEach((guru, index) => {
      const row = headerRow + 3 + index;
      const rowData = [
        index + 1,
        guru.nama,
        guru.jul || 0,
        guru.agt || 0,
        guru.sep || 0,
        guru.okt || 0,
        guru.nov || 0,
        guru.des || 0,
        guru.jan || 0,
        guru.feb || 0,
        guru.mar || 0,
        guru.apr || 0,
        guru.mei || 0,
        guru.jun || 0,
        guru.total_ketidakhadiran || 0,
        guru.persentase_ketidakhadiran || 0,
        guru.persentase_kehadiran || 0
      ];

      rowData.forEach((value, colIndex) => {
        const cell = worksheet.getCell(row, colIndex + 1);
        cell.value = value;
        cell.border = this.getBorderStyle();
        cell.alignment = { horizontal: colIndex === 1 ? 'left' : 'center', vertical: 'middle' };
        
        // Color coding for month columns
        if (colIndex >= 2 && colIndex <= 13) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colIndex < 8 ? 'FFE6F3FF' : 'FFE6FFE6' } };
        }
      });
    });

    // Set column widths
    worksheet.getColumn(1).width = 8;  // NO
    worksheet.getColumn(2).width = 30; // NAMA GURU
    for (let i = 3; i <= 14; i++) {
      worksheet.getColumn(i).width = 12; // Bulan columns
    }
    worksheet.getColumn(15).width = 20; // JUMLAH KETIDAKHADIRAN
    worksheet.getColumn(16).width = 25; // PERSENTASE KETIDAKHADIRAN
    worksheet.getColumn(17).width = 25; // PERSENTASE KEHADIRAN

    // Footer
    this.addSignatureFooter(worksheet, data.length + 10);

    return workbook;
  }

  // Export ringkasan kehadiran siswa SMKN 13 (untuk guru)
  async exportRingkasanKehadiranSiswaSMKN13(data, options = {}) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('RINGKASAN KEHADIRAN SISWA');

    // Header SMKN 13
    this.addSchoolHeader(worksheet, {
      title: 'RINGKASAN KEHADIRAN SISWA',
      subtitle: `Periode: ${options.startDate} s/d ${options.endDate} - Kelas: ${options.className}`,
      documentNumber: `RINGKASAN/SISWA/SMKN13/${getCurrentYearWIB()}`,
      date: new Date().toLocaleDateString('id-ID')
    });

    // Header tabel dengan format SMKN 13
    const headerRow = 6;
    
    // Row 1: Main header
    worksheet.mergeCells(headerRow, 1, headerRow, 11);
    const mainHeader = worksheet.getCell(headerRow, 1);
    mainHeader.value = 'RINGKASAN KEHADIRAN SISWA';
    mainHeader.font = { bold: true, size: 14 };
    mainHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    mainHeader.border = this.getBorderStyle();
    mainHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB0E0E6' } };

    // Row 2: Sub headers
    const subHeaders = [
      'NO.', 'NAMA SISWA', 'NIS', 'KELAS', 'HADIR', 'IZIN', 'SAKIT', 'ALPA', 'DISPEN', 'TOTAL', 'PERSENTASE (%)'
    ];

    subHeaders.forEach((header, index) => {
      const cell = worksheet.getCell(headerRow + 1, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.getBorderStyle();
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });

    // Data rows
    data.forEach((siswa, index) => {
      const row = headerRow + 2 + index;
      const total = siswa.H + siswa.I + siswa.S + siswa.A + siswa.D;
      const rowData = [
        index + 1,
        siswa.nama,
        siswa.nis,
        siswa.nama_kelas,
        siswa.H || 0,
        siswa.I || 0,
        siswa.S || 0,
        siswa.A || 0,
        siswa.D || 0,
        total,
        `${Number.parseFloat(siswa.presentase || 0).toFixed(2)}%`
      ];

      rowData.forEach((value, colIndex) => {
        const cell = worksheet.getCell(row, colIndex + 1);
        cell.value = value;
        cell.border = this.getBorderStyle();
        cell.alignment = { 
          horizontal: colIndex === 1 ? 'left' : 'center', 
          vertical: 'middle' 
        };
        
        // Color coding for status columns
        if (colIndex >= 4 && colIndex <= 8) {
          const colors = ['FFE6FFE6', 'FFFFE6CC', 'FFFFCCCC', 'FFFFB3B3', 'FFE6CCFF'];
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[colIndex - 4] } };
        }
      });
    });

    // Set column widths
    const columnWidths = [8, 30, 15, 15, 10, 10, 10, 10, 10, 10, 15];
    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    // Summary statistics
    const totalStudents = data.length;
    const totalHadir = data.reduce((sum, siswa) => sum + (siswa.H || 0), 0);
    const totalIzin = data.reduce((sum, siswa) => sum + (siswa.I || 0), 0);
    const totalSakit = data.reduce((sum, siswa) => sum + (siswa.S || 0), 0);
    const totalAlpa = data.reduce((sum, siswa) => sum + (siswa.A || 0), 0);
    const totalDispen = data.reduce((sum, siswa) => sum + (siswa.D || 0), 0);
    const totalAbsen = totalHadir + totalIzin + totalSakit + totalAlpa + totalDispen;
    const rataRataPresentase = totalAbsen > 0 ? ((totalHadir / totalAbsen) * 100).toFixed(2) : '0.00';

    const summaryRow = headerRow + 3 + data.length + 2;
    const summaryData = [
      'TOTAL',
      `${totalStudents} Siswa`,
      '',
      '',
      totalHadir,
      totalIzin,
      totalSakit,
      totalAlpa,
      totalDispen,
      totalAbsen,
      `${rataRataPresentase}%`
    ];

    summaryData.forEach((value, colIndex) => {
      const cell = worksheet.getCell(summaryRow, colIndex + 1);
      cell.value = value;
      cell.font = { bold: true };
      cell.border = this.getBorderStyle();
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB0E0E6' } };
    });

    // Footer
    this.addSignatureFooter(worksheet, summaryRow + 5);

    return workbook;
  }

  // Export rekap ketidakhadiran siswa
  async exportRekapKetidakhadiranSiswa(data, options = {}) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekap Ketidakhadiran Siswa');

    // Header sekolah
    this.addSchoolHeader(worksheet, {
      title: 'REKAP KETIDAKHADIRAN SISWA',
      subtitle: `Kelas: ${options.kelasName} - Tahun: ${options.tahun}` + (options.bulan === 'Tahunan' ? '' : ` - Bulan: ${options.bulan}`),
      documentNumber: `REKAP/SISWA/${getCurrentYearWIB()}`,
      date: new Date().toLocaleDateString('id-ID')
    });

    // Header tabel
    const headerRow = 15;
    const headers = [
      'NO.', 'NIS', 'NAMA SISWA', 'JENIS KELAMIN', 
      'TOTAL KETIDAKHADIRAN', 'TOTAL KEHADIRAN', 'TOTAL HARI EFEKTIF',
      'PERSENTASE KETIDAKHADIRAN (%)', 'PERSENTASE KEHADIRAN (%)'
    ];

    this.addTableHeaders(worksheet, headerRow, headers);

    // Data rows
    let currentRow = headerRow + 1;
    data.forEach((siswa, index) => {
      worksheet.getCell(currentRow, 1).value = index + 1;
      worksheet.getCell(currentRow, 2).value = siswa.nis;
      worksheet.getCell(currentRow, 3).value = siswa.nama;
      worksheet.getCell(currentRow, 4).value = siswa.jenis_kelamin;
      worksheet.getCell(currentRow, 5).value = siswa.total_ketidakhadiran;
      worksheet.getCell(currentRow, 6).value = siswa.total_kehadiran;
      worksheet.getCell(currentRow, 7).value = siswa.total_hari_efektif;
      worksheet.getCell(currentRow, 8).value = `${Number.parseFloat(siswa.persentase_ketidakhadiran).toFixed(2)}%`;
      worksheet.getCell(currentRow, 9).value = `${Number.parseFloat(siswa.persentase_kehadiran).toFixed(2)}%`;
      
      this.addTableRowStyling(worksheet, currentRow, headers.length);
      currentRow++;
    });

    // Summary statistics
    this.addSummarySection(worksheet, currentRow + 2, data, 'siswa');

    // Column widths
    const columnWidths = [8, 15, 30, 15, 20, 15, 15, 25, 25];
    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    // Footer
    this.addSignatureFooter(worksheet, currentRow + 8);

    return workbook;
  }

  // Export presensi siswa
  async exportPresensiSiswa(data, options = {}) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Presensi Siswa');

    // Header sekolah
    this.addSchoolHeader(worksheet, {
      title: 'PRESENSI SISWA',
      subtitle: `Kelas: ${options.kelasName} - Bulan: ${options.bulan} - Tahun: ${options.tahun}`,
      documentNumber: `PRESENSI/SISWA/${getCurrentYearWIB()}`,
      date: new Date().toLocaleDateString('id-ID')
    });

    // Generate days in month
    const daysInMonth = new Date(Number.parseInt(options.tahun), Number.parseInt(options.bulan), 0).getDate();
    
    // Header tabel
    const headerRow = 15;
    const headers = ['NO.', 'NIS', 'NAMA SISWA', 'L/P'];
    
    // Add day headers
    for (let day = 1; day <= daysInMonth; day++) {
      headers.push(day.toString());
    }
    
    headers.push('KET');

    this.addTableHeaders(worksheet, headerRow, headers);

    // Data rows
    let currentRow = headerRow + 1;
    data.forEach((siswa, index) => {
      const rowData = [
        index + 1,
        siswa.nis,
        siswa.nama,
        siswa.jenis_kelamin
      ];
      
      // Add attendance data for each day
      for (let day = 1; day <= daysInMonth; day++) {
        rowData.push(siswa[`hari_${day}`] || '');
      }
      
      // Add keterangan data
      rowData.push(siswa.keterangan || ''); // KET column with actual data

      rowData.forEach((value, colIndex) => {
        const cell = worksheet.getCell(currentRow, colIndex + 1);
        cell.value = value;
        cell.style = {
          border: this.getBorderStyle(),
          alignment: { 
            horizontal: colIndex === 2 ? 'left' : 'center', 
            vertical: 'middle',
            wrapText: true
          }
        };
      });
      
      currentRow++;
    });

    // Summary section
    const summaryStartRow = currentRow + 2;
    worksheet.getCell(summaryStartRow, 1).value = 'JUMLAH:';
    worksheet.getCell(summaryStartRow, 1).style = { font: { bold: true, size: 12 } };
    
    const lakiLaki = data.filter(s => s.jenis_kelamin === 'L').length;
    const perempuan = data.filter(s => s.jenis_kelamin === 'P').length;
    
    worksheet.getCell(summaryStartRow + 1, 1).value = 'LAKI-LAKI =';
    worksheet.getCell(summaryStartRow + 1, 2).value = lakiLaki;
    worksheet.getCell(summaryStartRow + 2, 1).value = 'PEREMPUAN =';
    worksheet.getCell(summaryStartRow + 2, 2).value = perempuan;
    
    worksheet.getCell(summaryStartRow + 4, 1).value = 'KETERANGAN:';
    worksheet.getCell(summaryStartRow + 4, 1).style = { font: { bold: true, size: 12 } };
    worksheet.getCell(summaryStartRow + 5, 1).value = 'S: Sakit, A: Alpa, I: Izin';

    // Column widths
    const columnWidths = [8, 15, 30, 8];
    for (let day = 1; day <= daysInMonth; day++) {
      columnWidths.push(8);
    }
    columnWidths.push(10);
    
    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    // Footer
    this.addSignatureFooter(worksheet, currentRow + 10);

    return workbook;
  }

  getBorderStyle() {
    return {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    };
  }
}

export default AbsentaExportSystem;
