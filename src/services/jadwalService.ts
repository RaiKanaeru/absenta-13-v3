/**
 * JadwalService - Service untuk handle API calls jadwal
 * Menyediakan interface yang konsisten untuk semua role (admin, guru, siswa)
 */

import { apiCall } from '@/utils/apiClient';

type JadwalRole = 'admin' | 'guru' | 'siswa';
type JadwalArrayResponse = unknown[];
type JadwalEnvelopeResponse = { success?: boolean; data?: JadwalArrayResponse };

export class JadwalService {

  /**
   * Get jadwal berdasarkan role.
   *
   * Backend memberikan variasi bentuk respons:
   * - Admin/siswa: umumnya langsung mengembalikan array jadwal.
   * - Guru: dapat mengembalikan objek seperti `{ success: true, data: [...] }`,
   *   sehingga method ini mengekstrak `data` ketika tersedia, namun caller masih
   *   perlu mengantisipasi objek non-array jika backend berubah.
   *
   * @param role - 'admin', 'guru', atau 'siswa'
   * @returns Promise<JadwalArrayResponse | JadwalEnvelopeResponse>
   */
  static async getJadwal(role: JadwalRole): Promise<JadwalArrayResponse | JadwalEnvelopeResponse> {
    const endpoints = {
      admin: '/admin/jadwal',
      guru: '/guru/jadwal',
      siswa: '/jadwal/today' // Gunakan endpoint bersama untuk jadwal hari ini
    };
    
    const endpoint = endpoints[role as keyof typeof endpoints];
    if (!endpoint) {
      throw new Error(`Role '${role}' tidak valid. Gunakan: admin, guru, atau siswa`);
    }
    
    const data = await apiCall<JadwalArrayResponse | JadwalEnvelopeResponse>(`/api${endpoint}`);
    
    // Handle format response berbeda antara admin dan guru
    if (role === 'guru' && (data as JadwalEnvelopeResponse)?.success) {
      const envelope = data as JadwalEnvelopeResponse;
      return Array.isArray(envelope.data) ? envelope.data : data;
    }
    
    return data;
  }
  
  /**
   * Create jadwal baru
   * @param jadwalData - Data jadwal untuk dibuat
   * @returns Promise<any> - Response dari server
   */
  static async createJadwal(jadwalData: Record<string, unknown>): Promise<unknown> {
    return apiCall('/api/admin/jadwal', {
      method: 'POST',
      body: JSON.stringify(jadwalData)
    });
  }
  
  /**
   * Update jadwal yang sudah ada
   * @param id - ID jadwal yang akan diupdate
   * @param jadwalData - Data jadwal yang baru
   * @returns Promise<any> - Response dari server
   */
  static async updateJadwal(id: number, jadwalData: Record<string, unknown>): Promise<unknown> {
    return apiCall(`/api/admin/jadwal/${id}`, {
      method: 'PUT',
      body: JSON.stringify(jadwalData)
    });
  }
  
  /**
   * Delete jadwal
   * @param id - ID jadwal yang akan dihapus
   * @returns Promise<any> - Response dari server
   */
  static async deleteJadwal(id: number): Promise<unknown> {
    return apiCall(`/api/admin/jadwal/${id}`, {
      method: 'DELETE'
    });
  }
  
  /**
   * Get jadwal hari ini untuk siswa
   * @param siswaId - ID siswa
   * @returns Promise<any> - Response dari server
   */
  static async getJadwalHariIniSiswa(siswaId: number): Promise<unknown> {
    return apiCall(`/api/siswa/${siswaId}/jadwal-hari-ini`);
  }
  
  /**
   * Get jadwal rentang untuk siswa
   * @param siswaId - ID siswa
   * @param tanggal - Tanggal target
   * @returns Promise<any> - Response dari server
   */
  static async getJadwalRentangSiswa(siswaId: number, tanggal: string): Promise<unknown> {
    const encodedTanggal = encodeURIComponent(tanggal);
    return apiCall(`/api/siswa/${siswaId}/jadwal-rentang?tanggal=${encodedTanggal}`);
  }
}
