/**
 * Client-side Excel Export Utility
 * Uses the exceljs library to generate Excel files from in-memory data
 * Replaces CSV export for live monitoring data
 */

import ExcelJS from 'exceljs';

/**
 * Export an array of objects as an Excel (.xlsx) file download
 * 
 * @param data - Array of row objects (keys become headers)
 * @param filename - Download filename (without extension)
 * @param sheetName - Optional worksheet name (default: 'Data')
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Data'
): Promise<void> {
  if (!data || data.length === 0) {
    throw new Error('Tidak ada data untuk diekspor');
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Set columns from data keys with auto-width
  const headers = Object.keys(data[0]);
  worksheet.columns = headers.map(key => {
    const maxLen = Math.max(
      key.length,
      ...data.map(row => {
        const val = row[key];
        if (typeof val === 'string') return val.length;
        if (typeof val === 'number' || typeof val === 'boolean') return String(val).length;
        if (typeof val === 'object' && val !== null) return JSON.stringify(val).length;
        return 0;
      })
    );
    return {
      header: key,
      key,
      width: Math.min(maxLen + 2, 40),
    };
  });

  // Add data rows with safe value conversion
  for (const row of data) {
    const safeRow: Record<string, string | number | boolean | null> = {};
    for (const key of headers) {
      const val = row[key];
      if (val === null || val === undefined) {
        safeRow[key] = '';
      } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        safeRow[key] = val;
      } else if (typeof val === 'object') {
        safeRow[key] = JSON.stringify(val);
      } else {
        safeRow[key] = String(val);
      }
    }
    worksheet.addRow(safeRow);
  }

  // Generate buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const xlsxFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = xlsxFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
