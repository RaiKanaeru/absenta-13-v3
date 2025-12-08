/**
 * JadwalService - Service untuk handle API calls jadwal
 * Menyediakan interface yang konsisten untuk semua role (admin, guru, siswa)
 */

import { getApiUrl } from '@/config/api';

export class JadwalService {
  
  /**
   * Get jadwal berdasarkan role
   * @param role - 'admin', 'guru', atau 'siswa'
   * @returns Promise<any[]> - Array jadwal atau object dengan format {success: true, data: any[]}
   */
  static async getJadwal(role: string): Promise<any[]> {
    const endpoints = {
      admin: '/admin/jadwal',
      guru: '/guru/jadwal',
      siswa: '/siswa/jadwal' // Jika ada endpoint umum untuk siswa
    };
    
    const endpoint = endpoints[role as keyof typeof endpoints];
    if (!endpoint) {
      throw new Error(`Role '${role}' tidak valid. Gunakan: admin, guru, atau siswa`);
    }
    
    const response = await fetch(getApiUrl(`/api${endpoint}`), {
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Gagal memuat jadwal');
    }
    
    const data = await response.json();
    
    // Handle format response berbeda antara admin dan guru
    if (role === 'guru' && data.success) {
      return data.data;
    }
    
    return data;
  }
  
  /**
   * Create jadwal baru
   * @param jadwalData - Data jadwal untuk dibuat
   * @returns Promise<any> - Response dari server
   */
  static async createJadwal(jadwalData: any): Promise<any> {
    const response = await fetch(getApiUrl('/api/admin/jadwal'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(jadwalData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Gagal membuat jadwal');
    }
    
    return response.json();
  }
  
  /**
   * Update jadwal yang sudah ada
   * @param id - ID jadwal yang akan diupdate
   * @param jadwalData - Data jadwal yang baru
   * @returns Promise<any> - Response dari server
   */
  static async updateJadwal(id: number, jadwalData: any): Promise<any> {
    const response = await fetch(getApiUrl(`/api/admin/jadwal/${id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(jadwalData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Gagal mengupdate jadwal');
    }
    
    return response.json();
  }
  
  /**
   * Delete jadwal
   * @param id - ID jadwal yang akan dihapus
   * @returns Promise<any> - Response dari server
   */
  static async deleteJadwal(id: number): Promise<any> {
    const response = await fetch(getApiUrl(`/api/admin/jadwal/${id}`), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Gagal menghapus jadwal');
    }
    
    return response.json();
  }
  
  /**
   * Get jadwal hari ini untuk siswa
   * @param siswaId - ID siswa
   * @returns Promise<any> - Response dari server
   */
  static async getJadwalHariIniSiswa(siswaId: number): Promise<any> {
    const response = await fetch(getApiUrl(`/api/siswa/${siswaId}/jadwal-hari-ini`), {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Gagal memuat jadwal hari ini');
    }
    
    return response.json();
  }
  
  /**
   * Get jadwal rentang untuk siswa
   * @param siswaId - ID siswa
   * @param tanggal - Tanggal target
   * @returns Promise<any> - Response dari server
   */
  static async getJadwalRentangSiswa(siswaId: number, tanggal: string): Promise<any> {
    const response = await fetch(getApiUrl(`/api/siswa/${siswaId}/jadwal-rentang?tanggal=${tanggal}`), {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Gagal memuat jadwal rentang');
    }
    
    return response.json();
  }
}
