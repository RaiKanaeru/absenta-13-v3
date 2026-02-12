import { useState, useEffect, useCallback } from 'react';
import { JadwalService } from '../services/jadwalService';

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
      let data;
      
      if (role === 'siswa' && siswaId) {
        if (tanggal) {
          // Untuk jadwal rentang siswa
          data = await JadwalService.getJadwalRentangSiswa(siswaId, tanggal);
        } else {
          // Untuk jadwal hari ini siswa
          data = await JadwalService.getJadwalHariIniSiswa(siswaId);
        }
        
        // Handle format response siswa
        if (data.success && data.data) {
          setJadwal(data.data);
        } else {
          setJadwal([]);
        }
      } else {
        // Untuk admin dan guru
        data = await JadwalService.getJadwal(role);
        setJadwal(Array.isArray(data) ? data : []);
      }
     } catch (err: unknown) {
       const message = err instanceof Error ? err.message : String(err);
       setError(message || 'Gagal memuat jadwal');
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
