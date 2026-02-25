import { useState, useEffect, useCallback } from 'react';
import { JadwalService } from '../services/jadwalService';
import type { JadwalRole, JadwalEnvelopeResponse } from '../services/jadwalService';

/**
 * Extract a readable error message from an unknown error value
 */
const extractErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'number' || typeof err === 'boolean') return String(err);
  if (typeof err === 'object' && err !== null) {
    return (err as { message?: string }).message || fallback;
  }
  return fallback;
};

/**
 * Fetch jadwal data based on role
 */
const fetchJadwalByRole = async (role: string, siswaId?: number, tanggal?: string): Promise<unknown[]> => {
  if (role === 'siswa' && siswaId) {
    const res: JadwalEnvelopeResponse = tanggal
      ? await JadwalService.getJadwalRentangSiswa(siswaId, tanggal) as JadwalEnvelopeResponse
      : await JadwalService.getJadwalHariIniSiswa(siswaId) as JadwalEnvelopeResponse;
    return res?.success && res?.data ? res.data : [];
  }

  if (role !== 'siswa') {
    const adminGuruData = await JadwalService.getJadwal(role as JadwalRole);
    return Array.isArray(adminGuruData) ? adminGuruData : [];
  }

  return [];
};

/**
 * Custom hook untuk sinkronisasi jadwal dengan auto-refresh
 * @param role - Role pengguna ('admin', 'guru', 'siswa')
 * @param siswaId - ID siswa (opsional, hanya untuk role siswa)
 * @param tanggal - Tanggal target (opsional, untuk siswa)
 * @returns Object dengan jadwal, loading state, error, dan fungsi refresh
 */
export const useJadwalSync = (role: string, siswaId?: number, tanggal?: string) => {
  const [jadwal, setJadwal] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Function untuk refresh jadwal
   */
  const refreshJadwal = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const newData = await fetchJadwalByRole(role, siswaId, tanggal);
      setJadwal(newData);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Gagal memuat jadwal'));
    } finally {
      setIsLoading(false);
    }
  }, [role, siswaId, tanggal]);
  
  /**
   * Auto refresh jadwal setiap 30 detik
   */
  useEffect(() => {
    // Initial load
    refreshJadwal();
    
    // Set interval untuk auto refresh
    const interval = setInterval(refreshJadwal, 30000); // 30 detik
    
    return () => clearInterval(interval);
  }, [refreshJadwal]);
  
  /**
   * Manual refresh function
   */
  const manualRefresh = useCallback(() => {
    refreshJadwal();
  }, [refreshJadwal]);
  
  return { 
    jadwal, 
    isLoading, 
    error, 
    refreshJadwal: manualRefresh 
  };
};

/**
 * Hook khusus untuk admin dashboard
 */
export const useAdminJadwalSync = () => {
  return useJadwalSync('admin');
};

/**
 * Hook khusus untuk guru dashboard
 */
export const useGuruJadwalSync = () => {
  return useJadwalSync('guru');
};

/**
 * Hook khusus untuk siswa dashboard
 */
export const useSiswaJadwalSync = (siswaId: number, tanggal?: string) => {
  return useJadwalSync('siswa', siswaId, tanggal);
};
