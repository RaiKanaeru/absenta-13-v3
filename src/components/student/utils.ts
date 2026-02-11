/**
 * Student Dashboard utility functions
 * Extracted from StudentDashboard.tsx to reduce file size
 */

import { getErrorMessage } from '@/utils/apiClient';

// =============================================================================
// GURU LIST PARSING
// =============================================================================

/**
 * Parse guru_list string into structured array
 * Format: "id_guru:nama_guru:nip:status:keterangan:waktu:is_primary:ada_tugas||..."
 */
export const parseGuruList = (guruListString: string) => {
  if (!guruListString || typeof guruListString !== 'string') {
    return [];
  }
  
  return guruListString.split('||').map(guruString => {
    const [id_guru, nama_guru, nip, status_kehadiran, keterangan_guru, waktu_catat, is_primary, ada_tugas] = guruString.split(':');
    return {
      id_guru: Number.parseInt(id_guru) || 0,
      nama_guru: nama_guru || '',
      nip: nip || '',
      status_kehadiran: status_kehadiran || 'belum_diambil',
      keterangan_guru: keterangan_guru || '',
      waktu_catat: waktu_catat || '',
      is_primary: Number.parseInt(is_primary) === 1,
      ada_tugas: Number.parseInt(ada_tugas) === 1
    };
  });
};

// =============================================================================
// JADWAL KEY PARSING
// =============================================================================

/**
 * Parse jadwal key to extract jadwal_id and guru_id
 * Supports formats: "jadwalId-guruId" (multi-guru) or just "jadwalId" (single guru)
 */
export const parseJadwalKey = (key: string | number): { jadwalId: number | null; guruId: number | null; isMultiGuru: boolean } => {
  const keyStr = String(key);
  
  if (keyStr.includes('-')) {
    const [jid, gid] = keyStr.split('-');
    return {
      jadwalId: Number.parseInt(jid, 10) || null,
      guruId: Number.parseInt(gid, 10) || null,
      isMultiGuru: true
    };
  }
  
  return {
    jadwalId: typeof key === 'number' ? key : Number.parseInt(keyStr, 10) || null,
    guruId: null,
    isMultiGuru: false
  };
};

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Normalize error messages for consistent UX
 */
export const resolveErrorMessage = (error: unknown, fallback: string): string => {
  const message = getErrorMessage(error);
  return message === 'Terjadi kesalahan yang tidak diketahui' ? fallback : message;
};

/**
 * Check API success flag for non-standard responses
 */
export const isFailureResponse = (payload: unknown): payload is { success: false; error?: unknown; message?: unknown } => {
  return Boolean(payload && typeof payload === 'object' && 'success' in payload && (payload as { success?: boolean }).success === false);
};

/**
 * Extract error text from API payloads
 */
export const getResponseErrorText = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }
  const data = payload as { error?: unknown; message?: unknown };
  if (typeof data.error === 'string') return data.error;
  if (data.error && typeof data.error === 'object' && 'message' in data.error) {
    return String((data.error as { message?: unknown }).message || fallback);
  }
  if (typeof data.message === 'string') return data.message;
  return fallback;
};

// =============================================================================
// GURU ID RESOLUTION
// =============================================================================

/**
 * Get guru_id from jadwal object, trying multiple field names
 */
export const getGuruIdFromJadwal = (
  jadwal: { guru_id?: number; id_guru?: number } | null,
  kehadiranDataEntry: { guru_id?: number } | null
): number | null => {
  // Try guru_id first, then id_guru
  const guruId = jadwal?.guru_id || jadwal?.id_guru || kehadiranDataEntry?.guru_id;
  return guruId || null;
};

/** Result type for resolveGuruIdForUpdate helper */
export type ResolveGuruIdResult = 
  | { success: true; guruId: number }
  | { success: false; error: 'not_found' | 'multi_guru' | 'invalid_id' };

/**
 * Resolve guru ID for status update - extracted to reduce CC (S3776 compliance)
 * @returns ResolveGuruIdResult with either guruId or error type
 */
export const resolveGuruIdForUpdate = (
  jadwalId: number | null,
  initialGuruId: number | null,
  isMultiGuru: boolean,
  jadwalList: Array<{ id_jadwal: number; is_multi_guru?: boolean; guru_list?: unknown[]; guru_id?: number; id_guru?: number }>,
  kehadiranDataEntry: { guru_id?: number } | null
): ResolveGuruIdResult => {
  // If already multi-guru key, use provided guruId
  if (isMultiGuru && initialGuruId) {
    return { success: true, guruId: initialGuruId };
  }

  // Find jadwal
  const jadwal = jadwalList.find(j => j.id_jadwal === jadwalId);
  if (!jadwal) {
    return { success: false, error: 'not_found' };
  }

  // Check if multi-guru jadwal requires specific guru selection
  if (jadwal.is_multi_guru && Array.isArray(jadwal.guru_list) && jadwal.guru_list.length > 0) {
    return { success: false, error: 'multi_guru' };
  }

  // Get guru_id from jadwal
  const guruId = getGuruIdFromJadwal(jadwal, kehadiranDataEntry);
  if (!jadwalId || !guruId) {
    return { success: false, error: 'invalid_id' };
  }

  return { success: true, guruId };
};
