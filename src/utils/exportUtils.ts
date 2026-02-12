/**
 * PDF Export Utility
 * Frontend utility for downloading PDF reports from the backend API
 * 
 * Pattern: Mirrors the existing Excel download pattern using apiCall + blob
 */

import { apiCall } from '@/utils/apiClient';

/**
 * Download a PDF file from a backend export endpoint
 * 
 * @param endpoint - API endpoint path (e.g., '/api/export/pdf/student-summary')
 * @param filename - Desired download filename (e.g., 'rekap-siswa.pdf')
 * @param params - Query parameters as URLSearchParams or Record
 * @param onLogout - Logout callback for auth errors
 */
export async function downloadPdf(
  endpoint: string,
  filename: string,
  params?: URLSearchParams | Record<string, string>,
  onLogout?: () => void
): Promise<void> {
  let queryString = '';
  if (params instanceof URLSearchParams) {
    queryString = params.toString();
  } else if (params) {
    queryString = new URLSearchParams(params).toString();
  }

  const url = queryString ? `${endpoint}?${queryString}` : endpoint;

  const blob = await apiCall<Blob>(url, {
    responseType: 'blob',
    onLogout
  });

  const blobUrl = globalThis.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = blobUrl;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.URL.revokeObjectURL(blobUrl);
}

/**
 * Download an Excel file from a backend export endpoint
 * Standardized version of the blob download pattern used across the app
 * 
 * @param endpoint - API endpoint path (e.g., '/api/export/student-summary')
 * @param filename - Desired download filename (e.g., 'rekap-siswa.xlsx')
 * @param params - Query parameters
 * @param onLogout - Logout callback for auth errors
 */
export async function downloadExcelFromApi(
  endpoint: string,
  filename: string,
  params?: URLSearchParams | Record<string, string>,
  onLogout?: () => void
): Promise<void> {
  let queryString = '';
  if (params instanceof URLSearchParams) {
    queryString = params.toString();
  } else if (params) {
    queryString = new URLSearchParams(params).toString();
  }

  const url = queryString ? `${endpoint}?${queryString}` : endpoint;

  const blob = await apiCall<Blob>(url, {
    responseType: 'blob',
    onLogout
  });

  const blobUrl = globalThis.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = blobUrl;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.URL.revokeObjectURL(blobUrl);
}
