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
      ...data.map(row => String(row[key] ?? '').length)
    );
    return {
      header: key,
      key,
      width: Math.min(maxLen + 2, 40),
    };
  });

  // Add data rows
  for (const row of data) {
    worksheet.addRow(row);
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
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
