/**
 * Client-side Excel Export Utility
 * Uses the xlsx library to generate Excel files from in-memory data
 * Replaces CSV export for live monitoring data
 */

import * as XLSX from 'xlsx';

/**
 * Export an array of objects as an Excel (.xlsx) file download
 * 
 * @param data - Array of row objects (keys become headers)
 * @param filename - Download filename (without extension)
 * @param sheetName - Optional worksheet name (default: 'Data')
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Data'
): void {
  if (!data || data.length === 0) {
    throw new Error('Tidak ada data untuk diekspor');
  }

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-width columns based on content
  const colWidths = Object.keys(data[0]).map(key => {
    const maxLen = Math.max(
      key.length,
      ...data.map(row => String(row[key] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  worksheet['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate and download
  const xlsxFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, xlsxFilename);
}
