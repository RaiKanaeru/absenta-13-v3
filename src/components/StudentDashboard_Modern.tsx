import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { formatTime24, formatDateTime24, formatDateOnly, getCurrentDateWIB, getCurrentYearWIB, formatDateWIB, getWIBTime } from '@/lib/time-utils';
import { FontSizeControl } from '@/components/ui/font-size-control';
import { EditProfile } from './EditProfile';

import { getApiUrl } from '@/config/api';
import { getCleanToken } from '@/utils/authUtils';
import { GuruInSchedule } from '@/types/dashboard';
import {
  LogOut, Clock, User, BookOpen, CheckCircle2, XCircle, Calendar, Save,
  Settings, Menu, X, Users, AlertCircle, MessageCircle, Eye, Edit,
  ChevronLeft, ChevronRight, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';

interface StudentDashboardProps {
  userData: {
    id: number;
    username: string;
    nama: string;
    role: string;
  };
  onLogout: () => void;
}

// Fungsi untuk memproses guru_list dari string ke array
const parseGuruList = (guruListString: string) => {
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

/**
 * Parse jadwal key to extract jadwal_id and guru_id
 * Supports formats: "jadwalId-guruId" (multi-guru) or just "jadwalId" (single guru)
 */
const parseJadwalKey = (key: string | number): { jadwalId: number | null; guruId: number | null; isMultiGuru: boolean } => {
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

/**
 * Get guru_id from jadwal object, trying multiple field names
 */
const getGuruIdFromJadwal = (
  jadwal: { guru_id?: number; id_guru?: number } | null,
  kehadiranDataEntry: { guru_id?: number } | null
): number | null => {
  // Try guru_id first, then id_guru
  const guruId = jadwal?.guru_id || jadwal?.id_guru || kehadiranDataEntry?.guru_id;
  return guruId || null;
};

interface BandingAbsen {
  id_banding: number;
  siswa_id: number;
  jadwal_id: number;
  tanggal_absen: string;
  status_asli: 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen';
  status_diajukan: 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen';
  alasan_banding: string;
  status_banding: 'pending' | 'disetujui' | 'ditolak';
  catatan_guru?: string;
  tanggal_pengajuan: string;
  tanggal_keputusan?: string;
  nama_mapel?: string;
  nama_guru?: string;
  jam_mulai?: string;
  jam_selesai?: string;
  nama_kelas?: string;
  jenis_banding?: 'individual';
  nama_siswa?: string;
}

interface JadwalHariIni {
  id_jadwal: number;
  jam_ke: number;
  jam_mulai: string;
  jam_selesai: string;
  nama_mapel: string;
  kode_mapel: string;
  nama_guru: string;
  nip: string;
  nama_kelas: string;
  kode_ruang?: string;
  nama_ruang?: string;
  lokasi?: string;
  status_kehadiran: string;
  keterangan?: string;
  waktu_catat?: string;
  tanggal_target?: string;
  jenis_aktivitas?: 'pelajaran' | 'upacara' | 'istirahat' | 'kegiatan_khusus' | 'libur' | 'ujian' | 'lainnya';
  is_absenable?: boolean;
  keterangan_khusus?: string;
  is_multi_guru?: boolean;
  guru_list?: Array<{
    id_guru: number;
    nama_guru: string;
    nip: string;
    is_primary?: boolean;
    status_kehadiran: string;
    keterangan_guru?: string;
    waktu_absen?: string; // NEW
    is_submitted?: boolean; // NEW
  }>;
  is_primary?: boolean; // New field for multi-guru support
  keterangan_guru?: string; // New field for individual guru notes
  id_guru?: number; // New field for guru ID
  guru_id?: number; // Alias for id_guru (API compatibility)
}

interface KehadiranData {
  [key: string]: { // Support both jadwal_id and jadwal_id-guru_id format
    status: string;
    keterangan: string;
    guru_id?: number;
  };
}

interface RiwayatData {
  tanggal: string;
  jadwal: Array<{
    jadwal_id: number;
    jam_ke: number;
    jam_mulai: string;
    jam_selesai: string;
    nama_mapel: string;
    nama_guru: string;
    kode_ruang?: string;
    nama_ruang?: string;
    total_siswa: number;
    total_hadir: number;
    total_izin: number;
    total_sakit: number;
    total_alpa: number;
    total_tidak_hadir?: number;
    is_multi_guru?: boolean;
    guru_list?: Array<{
      id_guru: number;
      nama_guru: string;
      nip: string;
      is_primary?: boolean;
      status_kehadiran: string;
      keterangan_guru?: string;
    }>;
    siswa_tidak_hadir?: Array<{
      nama_siswa: string;
      nis: string;
      status: string;
      keterangan?: string;
      nama_pencatat?: string;
    }>;
  }>;
}

// Komponen Pagination
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination = React.memo(({ currentPage, totalPages, onPageChange }: PaginationProps) => {
  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  // FIXED: Don't show pagination if no data or only one page
  if (totalPages <= 1 || totalPages === 0) {
    return null; // Don't render pagination if no data
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2 mt-4 sm:mt-6 min-w-0">
        {/* Mobile: Show only prev/next with page info */}
        <div className="flex sm:hidden items-center gap-2 w-full justify-between px-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center h-9 px-3 text-xs min-w-0 flex-shrink-0"
          >
            <ChevronLeft className="w-3 h-3 mr-1" />
            <span className="text-xs">Sebelumnya</span>
          </Button>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-600 whitespace-nowrap">
              {currentPage}/{totalPages}
            </span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center h-9 px-3 text-xs min-w-0 flex-shrink-0"
          >
            <span className="text-xs">Selanjutnya</span>
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {/* Desktop: Show full pagination */}
        <div className="hidden sm:flex items-center space-x-1 min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center h-8 px-2 text-xs"
          >
            <ChevronLeft className="w-3 h-3 mr-1" />
            <span className="text-xs">Sebelumnya</span>
          </Button>
          
          <div className="flex items-center space-x-1 overflow-x-auto">
            {getVisiblePages().map((page, index) => (
              <Button
                key={index}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => typeof page === 'number' && onPageChange(page)}
                disabled={page === '...'}
                className="w-8 h-8 p-0 text-xs min-w-8"
              >
                {page}
              </Button>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center h-8 px-2 text-xs"
          >
            <span className="text-xs">Selanjutnya</span>
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
});

export const StudentDashboard = ({ userData, onLogout }: StudentDashboardProps) => {

  const [activeTab, setActiveTab] = useState('kehadiran');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(userData);
  const [jadwalHariIni, setJadwalHariIni] = useState<JadwalHariIni[]>([]);
  const [kehadiranData, setKehadiranData] = useState<KehadiranData>({});
  const [adaTugasData, setAdaTugasData] = useState<{[key: number]: boolean}>({});
  const [riwayatData, setRiwayatData] = useState<RiwayatData[]>([]);
  const [bandingAbsen, setBandingAbsen] = useState<BandingAbsen[]>([]);
  const [expandedBanding, setExpandedBanding] = useState<number | null>(null);
  const [detailRiwayat, setDetailRiwayat] = useState<{ 
    jadwal_id: number;
    jam_ke: number;
    jam_mulai: string;
    jam_selesai: string;
    nama_mapel: string;
    nama_guru: string;
    total_siswa: number;
    total_hadir: number;
    total_izin: number;
    total_sakit: number;
    total_alpa: number;
    siswa_tidak_hadir?: Array<{ nama_siswa: string; nis: string; status: string; keterangan?: string; nama_pencatat?: string; }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [siswaId, setSiswaId] = useState<number | null>(null);
  const [kelasInfo, setKelasInfo] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = originalOverflow || '';
    }
    return () => {
      document.body.style.overflow = originalOverflow || '';
    };
  }, [sidebarOpen]);
  
  // State untuk edit absen dengan rentang tanggal
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return getCurrentDateWIB();
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [maxDate, setMaxDate] = useState<string>(() => {
    return getCurrentDateWIB();
  });
  const [minDate, setMinDate] = useState<string>(() => {
    const wibNow = getWIBTime();
    const sevenDaysAgo = new Date(wibNow.getTime() - 7 * 24 * 60 * 60 * 1000);
    return formatDateWIB(sevenDaysAgo);
  });
  
  const [showFormBanding, setShowFormBanding] = useState(false);
  
  // State untuk pagination
  const [bandingAbsenPage, setBandingAbsenPage] = useState(1);
  const [riwayatPage, setRiwayatPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [riwayatItemsPerPage] = useState(7);
  
  // State untuk expandable rows
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // State untuk form banding absen kelas
  const [formBanding, setFormBanding] = useState({
    jadwal_id: '',
    tanggal_absen: '',
    siswa_banding: [{
      nama: '',
      status_asli: 'alpa' as 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen',
      status_diajukan: 'hadir' as 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen',
      alasan_banding: ''
    }] as Array<{
      nama: string;
      status_asli: 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen';
      status_diajukan: 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen';
      alasan_banding: string;
    }>
  });

  // State untuk daftar siswa yang bisa dipilih untuk banding
  const [daftarSiswa, setDaftarSiswa] = useState<Array<{
    id?: number;
    id_siswa?: number;
    nama: string;
  }>>([]);
  // State untuk menyimpan siswa yang dipilih (berbasis id)
  const [selectedSiswaId, setSelectedSiswaId] = useState<number | null>(null);
  
  // State untuk menyimpan data status kehadiran siswa
  const [siswaStatusData, setSiswaStatusData] = useState<{[key: string]: string}>({});
  
  const [loadingJadwal, setLoadingJadwal] = useState(false);
  
  // State untuk menyimpan jadwal berdasarkan tanggal yang dipilih untuk banding absen
  const [jadwalBerdasarkanTanggal, setJadwalBerdasarkanTanggal] = useState<JadwalHariIni[]>([]);

    // State untuk track updating status dan prevent race condition
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
    const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());

  // State untuk Absen Kelas (ketika guru tidak hadir)
  const [showAbsenKelasModal, setShowAbsenKelasModal] = useState(false);
  const [absenKelasJadwalId, setAbsenKelasJadwalId] = useState<number | null>(null);
  const [absenKelasGuruNama, setAbsenKelasGuruNama] = useState<string>('');
  const [daftarSiswaKelas, setDaftarSiswaKelas] = useState<Array<{
    id_siswa: number;
    nis: string;
    nama: string;
    jenis_kelamin: string;
    jabatan: string;
    attendance_status: string;
    keterangan: string;
  }>>([]);
  const [absenSiswaData, setAbsenSiswaData] = useState<{[key: number]: {status: string; keterangan: string}}>({});
  const [loadingAbsenKelas, setLoadingAbsenKelas] = useState(false);

  // Memoized computed values for performance
  const jadwalData = useMemo(() => 
    isEditMode ? jadwalBerdasarkanTanggal : jadwalHariIni,
    [isEditMode, jadwalBerdasarkanTanggal, jadwalHariIni]
  );

  // Helper functions for expandable rows
  const toggleRowExpansion = (rowId: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(rowId)) {
      newExpandedRows.delete(rowId);
    } else {
      newExpandedRows.add(rowId);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleUpdateProfile = (updatedData: {
    id: number;
    username: string;
    nama: string;
    role: string;
    email?: string;
    alamat?: string;
    telepon_orangtua?: string;
    nomor_telepon_siswa?: string;
    jenis_kelamin?: string;
    nis?: string;
    kelas?: string;
  }) => {
    setCurrentUserData(prevData => ({
      ...prevData,
      ...updatedData
    }));
  };

  // Get siswa perwakilan info
  useEffect(() => {
  
    
    const getSiswaInfo = async () => {
      try {
        setInitialLoading(true);
        setError(null);
        
        // Get clean token using centralized utility
        const cleanToken = getCleanToken();
        
        if (!cleanToken) {
          console.error('❌ Token tidak ditemukan');
          setError('Token tidak ditemukan. Silakan login kembali.');
          setInitialLoading(false);
          return;
        }
        
      
        
        const response = await fetch(getApiUrl('/api/siswa-perwakilan/info'), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cleanToken}`
          },
          credentials: 'include'
        });
        
      
      
        
        if (response.ok) {
          const data = await response.json();
        
          
          if (data.success) {
            setSiswaId(data.id_siswa);
            setKelasInfo(data.nama_kelas);
            // Update currentUserData with latest data from server
            setCurrentUserData(prevData => ({
              ...prevData,
              id: data.id,
              username: data.username,
              nama: data.nama,
              role: data.role,
              email: data.email,
              alamat: data.alamat,
              telepon_orangtua: data.telepon_orangtua,
              nomor_telepon_siswa: data.nomor_telepon_siswa,
              jenis_kelamin: data.jenis_kelamin,
              nis: data.nis,
              kelas: data.nama_kelas
            }));
          
          } else {
            setError(data.error || 'Data siswa tidak valid');
          }
        } else {
          let errorMessage = 'Gagal memuat informasi siswa';
          
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            // Ignore JSON parse errors for error responses
            console.debug('Error parsing error response:', parseError);
          }
          
          if (response.status === 401) {
            errorMessage = 'Sesi login Anda telah berakhir. Silakan login kembali.';
            // Redirect to login after showing error
            setTimeout(() => {
              onLogout();
            }, 2000);
          } else if (response.status === 403) {
            errorMessage = 'Akses ditolak. Anda tidak memiliki izin untuk mengakses halaman ini.';
          } else if (response.status === 404) {
            errorMessage = 'Data siswa perwakilan tidak ditemukan. Silakan hubungi administrator.';
          } else if (response.status >= 500) {
            errorMessage = 'Server sedang mengalami gangguan. Silakan coba lagi nanti.';
          }
          
          setError(errorMessage);
          console.error('StudentDashboard: API error:', response.status, errorMessage);
        }
      } catch (error) {
        console.error('StudentDashboard: Network error getting siswa info:', error);
        
        let errorMessage = 'Koneksi bermasalah. ';
        
        if (error instanceof TypeError && error.message.includes('fetch')) {
          errorMessage += 'Tidak dapat terhubung ke server. Pastikan server backend sedang berjalan.';
        } else {
          errorMessage += 'Silakan periksa koneksi internet Anda dan coba lagi.';
        }
        
        setError(errorMessage);
      } finally {
        setInitialLoading(false);
      
      }
    };

    getSiswaInfo();
  }, [onLogout]);

  // Load jadwal hari ini
  const loadJadwalHariIni = useCallback(async () => {
    if (!siswaId) return;

    setLoading(true);
    try {
      // Get clean token using centralized utility
      const cleanToken = getCleanToken();
      
      if (!cleanToken) {
        console.error('❌ Token tidak ditemukan');
        setLoading(false);
        return;
      }

      const response = await fetch(getApiUrl(`/api/siswa/${siswaId}/jadwal-hari-ini`), {
        headers: {
          'Authorization': `Bearer ${cleanToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
      
        
        // Proses guru_list dari string ke array
        const processedData = data.map((jadwal: JadwalHariIni & { guru_list?: string }) => ({
          ...jadwal,
          guru_list: jadwal.is_multi_guru && jadwal.guru_list 
            ? parseGuruList(jadwal.guru_list) 
            : []
        }));
        
        setJadwalHariIni(processedData);
        
        // Initialize kehadiran data only for absenable schedules
        const initialKehadiran: KehadiranData = {};
        processedData.forEach((jadwal: JadwalHariIni) => {
          // Only initialize kehadiran data for schedules that can be attended
          if (jadwal.is_absenable) {
            if (jadwal.is_multi_guru && jadwal.guru_list && jadwal.guru_list.length > 0) {
              // Handle multi-guru schedules
              jadwal.guru_list.forEach((guru) => {
                const guruKey = `${jadwal.id_jadwal}-${guru.id_guru}`;
                if (guru.status_kehadiran && guru.status_kehadiran !== 'belum_diambil') {
                  initialKehadiran[guruKey] = {
                    status: guru.status_kehadiran,
                    keterangan: guru.keterangan_guru || '',
                    guru_id: guru.id_guru
                  };
                } else {
                  // Default to 'Hadir' for new entries
                  initialKehadiran[guruKey] = {
                    status: 'Hadir',
                    keterangan: '',
                    guru_id: guru.id_guru
                  };
                }
              });
            } else {
              // Handle single-guru schedules
              const guruId = jadwal.guru_id || jadwal.id_guru;
              if (jadwal.status_kehadiran && jadwal.status_kehadiran !== 'belum_diambil') {
                initialKehadiran[jadwal.id_jadwal] = {
                  status: jadwal.status_kehadiran,
                  keterangan: jadwal.keterangan || '',
                  guru_id: guruId
                };
              } else {
                // Default to 'Hadir' for new entries, but allow user to change
                initialKehadiran[jadwal.id_jadwal] = {
                  status: 'Hadir',
                  keterangan: '',
                  guru_id: guruId
                };
              }
            }
          }
        });
        setKehadiranData(initialKehadiran);
        
        // Initialize ada_tugas data from loaded jadwal
        const initialAdaTugas: {[key: number]: boolean} = {};
        processedData.forEach((jadwal: JadwalHariIni) => {
          if (jadwal.is_absenable) {
            // For single guru, use jadwal.ada_tugas
            // For multi-guru, we'd need per-guru ada_tugas (future enhancement)
            initialAdaTugas[jadwal.id_jadwal] = Boolean((jadwal as JadwalHariIni & {ada_tugas?: number}).ada_tugas);
          }
        });
        setAdaTugasData(initialAdaTugas);
      } else {
        const errorData = await response.json();
        toast({
          title: "Error memuat jadwal",
          description: (typeof errorData.error === 'string' ? errorData.error : errorData.error?.message) || 'Failed to load schedule',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading jadwal hari ini:', error);
      toast({
        title: "Error",
        description: "Network error while loading schedule",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [siswaId]);


  // Load jadwal untuk banding absen berdasarkan tanggal yang dipilih
  const loadJadwalBandingByDate = useCallback(async (tanggal: string) => {
    if (!siswaId) return;

    setLoadingJadwal(true);
    try {
      const cleanToken = getCleanToken();
      
      const response = await fetch(getApiUrl(`/api/siswa/${siswaId}/jadwal-rentang?tanggal=${tanggal}`), {
        headers: {
          'Authorization': `Bearer ${cleanToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
      
        
        if (result.success && result.data) {
          // Proses guru_list dari string ke array
          const processedData = result.data.map((jadwal: JadwalHariIni & { guru_list?: string }) => ({
            ...jadwal,
            guru_list: jadwal.is_multi_guru && jadwal.guru_list 
              ? parseGuruList(jadwal.guru_list) 
              : []
          }));
          
          setJadwalBerdasarkanTanggal(processedData);
          
          // Initialize kehadiranData for banding mode
          const initialKehadiran: KehadiranData = {};
          processedData.forEach((jadwal: JadwalHariIni) => {
            if (jadwal.is_multi_guru && jadwal.guru_list && jadwal.guru_list.length > 0) {
              // Handle multi-guru schedules
              jadwal.guru_list.forEach((guru) => {
                const guruKey = `${jadwal.id_jadwal}-${guru.id_guru}`;
                if (guru.status_kehadiran && guru.status_kehadiran !== 'belum_diambil') {
                  initialKehadiran[guruKey] = {
                    status: guru.status_kehadiran,
                    keterangan: guru.keterangan_guru || '',
                    guru_id: guru.id_guru
                  };
                } else {
                  // Default to 'Hadir' for new entries
                  initialKehadiran[guruKey] = {
                    status: 'Hadir',
                    keterangan: '',
                    guru_id: guru.id_guru
                  };
                }
              });
            } else {
              // Handle single-guru schedules
              const guruId = jadwal.guru_id || jadwal.id_guru;
              if (jadwal.status_kehadiran && jadwal.status_kehadiran !== 'belum_diambil') {
                initialKehadiran[jadwal.id_jadwal] = {
                  status: jadwal.status_kehadiran,
                  keterangan: jadwal.keterangan || '',
                  guru_id: guruId
                };
              } else {
                // Default to 'Hadir' for new entries
                initialKehadiran[jadwal.id_jadwal] = {
                  status: 'Hadir',
                  keterangan: '',
                  guru_id: guruId
                };
              }
            }
          });
          setKehadiranData(initialKehadiran);
          
          // Initialize ada_tugas data from loaded jadwal (edit mode)
          const initialAdaTugas: {[key: number]: boolean} = {};
          processedData.forEach((jadwal: JadwalHariIni) => {
            if (jadwal.is_absenable) {
              initialAdaTugas[jadwal.id_jadwal] = Boolean((jadwal as JadwalHariIni & {ada_tugas?: number}).ada_tugas);
            }
          });
          setAdaTugasData(initialAdaTugas);
        } else {
          setJadwalBerdasarkanTanggal([]);
          setKehadiranData({});
          setAdaTugasData({});
        }
      } else {
        // Check if response is JSON before trying to parse
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          toast({
            title: "Error memuat jadwal",
            description: (typeof errorData.error === 'string' ? errorData.error : errorData.error?.message) || 'Failed to load schedule',
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error memuat jadwal",
            description: `HTTP ${response.status}: ${response.statusText}`,
            variant: "destructive"
          });
        }
        setJadwalBerdasarkanTanggal([]);
      }
    } catch (error) {
      console.error('Error loading jadwal banding by date:', error);
      toast({
        title: "Error",
        description: "Network error while loading schedule",
        variant: "destructive"
      });
      setJadwalBerdasarkanTanggal([]);
    } finally {
      setLoadingJadwal(false);
    }
  }, [siswaId]);


  // Load riwayat data
  const loadRiwayatData = useCallback(async () => {
    if (!siswaId) return;

    try {
      // Get clean token using centralized utility
      const cleanToken = getCleanToken();
      
      if (!cleanToken) {
        console.error('❌ Token tidak ditemukan');
        return;
      }

      const response = await fetch(getApiUrl(`/api/siswa/${siswaId}/riwayat-kehadiran`), {
        headers: {
          'Authorization': `Bearer ${cleanToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
      
        setRiwayatData(data);
      } else {
        const errorData = await response.json();
        console.error('Error loading riwayat:', errorData);
      }
    } catch (error) {
      console.error('Error loading riwayat:', error);
    }
  }, [siswaId]);



  useEffect(() => {
    if (siswaId && activeTab === 'kehadiran') {
      loadJadwalHariIni();
    }
  }, [siswaId, activeTab, loadJadwalHariIni]);

  useEffect(() => {
    if (siswaId && activeTab === 'riwayat') {
      loadRiwayatData();
    }
  }, [siswaId, activeTab, loadRiwayatData]);


  // Load Banding Absen
  const loadBandingAbsen = useCallback(async () => {
    if (!siswaId) return;
    
    try {
      // Get and clean token with mobile fallback
      const rawToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.trim() : '';
      
      if (!cleanToken) {
        console.error('❌ Token tidak ditemukan');
        return;
      }
      
      const response = await fetch(getApiUrl(`/api/siswa/${siswaId}/banding-absen`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setBandingAbsen(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading banding absen:', error);
    }
  }, [siswaId]);

  // Load daftar siswa untuk banding absen
  const loadDaftarSiswa = useCallback(async () => {
    if (!siswaId) return;
    
    try {
      const rawToken = localStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.trim() : '';
      
      if (!cleanToken) {
        console.error('❌ Token tidak ditemukan');
        return;
      }
      
      const response = await fetch(getApiUrl(`/api/siswa/${siswaId}/daftar-siswa`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setDaftarSiswa(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading daftar siswa:', error);
    }
  }, [siswaId]);

  // Load status kehadiran siswa untuk banding absen
  const loadSiswaStatus = useCallback(async (siswaNama: string, tanggal: string, jadwalId: string) => {
    if (!siswaId || !siswaNama || !tanggal || !jadwalId) return;
    
    try {
      const rawToken = localStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.trim() : '';
      
      if (!cleanToken) {
        console.error('❌ Token tidak ditemukan');
        return;
      }
      
      // Cari ID siswa berdasarkan nama
      const siswa = daftarSiswa.find(s => s.nama === siswaNama);
      if (!siswa) {
        console.error('❌ Siswa tidak ditemukan');
        return;
      }
      
      const response = await fetch(getApiUrl(`/api/siswa/${siswa.id}/status-kehadiran?tanggal=${tanggal}&jadwal_id=${jadwalId}`), {
        headers: {
          'Authorization': `Bearer ${cleanToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
      
        
        // Update status data
        const statusKey = `${siswaNama}_${tanggal}_${jadwalId}`;
        setSiswaStatusData(prev => ({
          ...prev,
          [statusKey]: data.status || 'alpa'
        }));
        
        // Update form dengan status yang ditemukan
        const newSiswaBanding = [{
          nama: siswaNama,
          status_asli: data.status || 'alpa',
          status_diajukan: formBanding.siswa_banding[0]?.status_diajukan || 'hadir',
          alasan_banding: formBanding.siswa_banding[0]?.alasan_banding || ''
        }];
        setFormBanding({...formBanding, siswa_banding: newSiswaBanding});
      } else {
        console.error('Error loading status kehadiran siswa:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading status kehadiran siswa:', error);
    }
  }, [siswaId, daftarSiswa, formBanding]);

  // Versi by-id: Load status kehadiran siswa menggunakan id_siswa (menghindari duplikasi nama)
  const loadSiswaStatusById = useCallback(async (idSiswa: number, tanggal: string, jadwalId: string) => {
    if (!siswaId || !idSiswa || !tanggal || !jadwalId) return;

    try {
      const rawToken = localStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.trim() : '';

      if (!cleanToken) {
        console.error('❌ Token tidak ditemukan');
        return;
      }

      const response = await fetch(getApiUrl(`/api/siswa/${idSiswa}/status-kehadiran?tanggal=${tanggal}&jadwal_id=${jadwalId}`), {
        headers: {
          'Authorization': `Bearer ${cleanToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
      

        const chosen = daftarSiswa.find(s => (s.id ?? s.id_siswa) === idSiswa);
        const siswaNama = chosen?.nama || '';

        // Update status data
        const statusKey = `${idSiswa}_${tanggal}_${jadwalId}`;
        setSiswaStatusData(prev => ({
          ...prev,
          [statusKey]: data.status || 'alpa'
        }));

        // Update form dengan status yang ditemukan
        const newSiswaBanding = [{
          nama: siswaNama,
          status_asli: data.status || 'alpa',
          status_diajukan: formBanding.siswa_banding[0]?.status_diajukan || 'hadir',
          alasan_banding: formBanding.siswa_banding[0]?.alasan_banding || ''
        }];
        setFormBanding(prev => ({ ...prev, siswa_banding: newSiswaBanding }));
      }
    } catch (error) {
      console.error('Error loading siswa status by id:', error);
    }
  }, [siswaId, daftarSiswa, formBanding]);


  useEffect(() => {
    if (siswaId && activeTab === 'banding-absen') {
      loadBandingAbsen();
      loadRiwayatData();
      loadDaftarSiswa();
    }
  }, [siswaId, activeTab, loadBandingAbsen, loadRiwayatData, loadDaftarSiswa]);

  // useEffect untuk load jadwal ketika selectedDate berubah atau masuk edit mode
  useEffect(() => {
    if (isEditMode && selectedDate && siswaId && pendingUpdates.size === 0) {
      loadJadwalBandingByDate(selectedDate);
    }
  }, [selectedDate, isEditMode, siswaId, loadJadwalBandingByDate, pendingUpdates.size]);


  // Submit kehadiran guru
  const submitKehadiran = async () => {
    if (!siswaId) return;

    setLoading(true);
    try {
      // Validate multi-guru schedules - check if all teachers are being attended
      const jadwalData = isEditMode ? jadwalBerdasarkanTanggal : jadwalHariIni;
      const multiGuruJadwal = jadwalData.filter(jadwal => jadwal.is_multi_guru && jadwal.is_absenable);
      
      for (const jadwal of multiGuruJadwal) {
        if (jadwal.guru_list && jadwal.guru_list.length > 0) {
          const expectedKeys = jadwal.guru_list.map(guru => `${jadwal.id_jadwal}-${guru.id_guru}`);
          const providedKeys = Object.keys(kehadiranData);
          const missingTeachers = expectedKeys.filter(key => !providedKeys.includes(key));
          
          if (missingTeachers.length > 0) {
            toast({
              title: "Validasi Gagal",
              description: `Jadwal ${jadwal.nama_mapel} memerlukan absensi untuk semua guru. Silakan lengkapi absensi untuk semua guru terlebih dahulu.`,
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
        }
      }

      // Prepare kehadiran data with ada_tugas flags for multi-guru support
      const kehadiranDataWithFlags: {[key: string]: {status: string; keterangan: string; ada_tugas: boolean; guru_id?: number}} = {};
      Object.keys(kehadiranData).forEach(key => {
        // Check if this is a multi-guru key (format: "jadwalId-guruId")
        if (key.includes('-')) {
          const [jadwalId, guruId] = key.split('-');
          kehadiranDataWithFlags[key] = {
            status: kehadiranData[key].status,
            keterangan: kehadiranData[key].keterangan,
            ada_tugas: adaTugasData[key] || false,
            guru_id: Number.parseInt(guruId)
          };
        } else {
          // Single guru format
          const jadwalIdNum = Number.parseInt(key);
          kehadiranDataWithFlags[jadwalIdNum] = {
            status: kehadiranData[jadwalIdNum].status,
            keterangan: kehadiranData[jadwalIdNum].keterangan,
            ada_tugas: adaTugasData[jadwalIdNum] || false,
            guru_id: kehadiranData[jadwalIdNum].guru_id // Include guru_id if available
          };
        }
      });

      const requestData = {
        siswa_id: siswaId,
        kehadiran_data: kehadiranDataWithFlags,
        tanggal_absen: selectedDate
      };
      
    
    
    
      
      // Get and clean token with mobile fallback
      const rawToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.trim() : '';
      
      if (!cleanToken) {
        toast({
          title: "Error",
          description: "Token tidak ditemukan. Silakan login ulang.",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch(getApiUrl('/api/siswa/submit-kehadiran-guru'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanToken}`
        },
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Berhasil!",
          description: result.message || "Data kehadiran guru berhasil disimpan"
        });
        
        // Reload jadwal to get updated status
        loadJadwalHariIni();
      } else {
        const errorData = await response.json();
        console.error('❌ Error submitting kehadiran:', errorData);
        toast({
          title: "Error",
          description: errorData.error || 'Failed to submit attendance',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error submitting kehadiran:', error);
      toast({
        title: "Error",
        description: "Network error while submitting attendance",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Open Absen Kelas modal (when guru is absent)
  const openAbsenKelasModal = async (jadwalId: number, guruNama: string) => {
    if (!siswaId) return;
    
    setAbsenKelasJadwalId(jadwalId);
    setAbsenKelasGuruNama(guruNama);
    setLoadingAbsenKelas(true);
    setShowAbsenKelasModal(true);
    
    try {
      const rawToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.trim() : '';
      
      const response = await fetch(getApiUrl(`/api/siswa/${siswaId}/daftar-siswa-absen?jadwal_id=${jadwalId}`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDaftarSiswaKelas(data.data || []);
        // Initialize default status for all students
        const initialData: {[key: number]: {status: string; keterangan: string}} = {};
        (data.data || []).forEach((siswa: { id_siswa: number; attendance_status?: string; keterangan?: string }) => {
          initialData[siswa.id_siswa] = {
            status: siswa.attendance_status || 'Hadir',
            keterangan: siswa.keterangan || ''
          };
        });
        setAbsenSiswaData(initialData);
      } else {
        toast({
          title: "Error",
          description: data.message || "Gagal memuat daftar siswa",
          variant: "destructive"
        });
        setShowAbsenKelasModal(false);
      }
    } catch (error) {
      console.error('Error loading students for piket attendance:', error);
      toast({
        title: "Error",
        description: "Gagal memuat daftar siswa",
        variant: "destructive"
      });
      setShowAbsenKelasModal(false);
    } finally {
      setLoadingAbsenKelas(false);
    }
  };

  // Submit student attendance by piket
  const submitAbsenKelas = async () => {
    if (!siswaId || !absenKelasJadwalId) return;
    
    setLoadingAbsenKelas(true);
    
    try {
      const rawToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.trim() : '';
      
      const response = await fetch(getApiUrl('/api/siswa/submit-absensi-siswa'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          siswa_pencatat_id: siswaId,
          jadwal_id: absenKelasJadwalId,
          attendance_data: absenSiswaData
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Berhasil!",
          description: `Absensi ${data.processed || Object.keys(absenSiswaData).length} siswa berhasil disimpan`,
        });
        setShowAbsenKelasModal(false);
        setAbsenKelasJadwalId(null);
        setDaftarSiswaKelas([]);
        setAbsenSiswaData({});
      } else {
        toast({
          title: "Gagal",
          description: data.message || "Gagal menyimpan absensi siswa",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error submitting piket attendance:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan absensi siswa",
        variant: "destructive"
      });
    } finally {
      setLoadingAbsenKelas(false);
    }
  };


  const updateKehadiranStatus = async (key: string | number, status: string) => {
    const keyStr = String(key);
    
    // Prevent multiple updates pada key yang sama
    if (pendingUpdates.has(keyStr)) {
    
      return;
    }

    // Mark as updating
    setIsUpdatingStatus(keyStr);
    setPendingUpdates(prev => new Set([...prev, keyStr]));

    // Simpan state lama untuk rollback
    const previousState = kehadiranData[key];

    // Update state lokal terlebih dahulu untuk responsif UI (Optimistic Update)
    setKehadiranData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        status: status,
        keterangan: status === 'Hadir' ? '' : (prev[key]?.keterangan || '')
      }
    }));

    try {
      const rawToken = localStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.trim() : '';
      if (!cleanToken) {
        throw new Error('Token tidak ditemukan');
      }

      // Tentukan jadwal_id dan guru_id dari key menggunakan helper
      const parsedKey = parseJadwalKey(key);
      const { jadwalId } = parsedKey;
      let { guruId } = parsedKey;

      // Jika bukan multi-guru key, cari jadwal dan guru_id
      if (!parsedKey.isMultiGuru) {
        const jadwalData = isEditMode ? jadwalBerdasarkanTanggal : jadwalHariIni;
        const jadwal = jadwalData.find(j => j.id_jadwal === jadwalId);
        
        if (!jadwal) {
          throw new Error('Jadwal tidak ditemukan');
        }
        
        // Check if multi-guru jadwal requires specific guru selection
        if (jadwal.is_multi_guru && Array.isArray(jadwal.guru_list) && jadwal.guru_list.length > 0) {
          toast({
            title: "Pilih Guru",
            description: "Jadwal ini multi-guru. Silakan set status per guru.",
            variant: "destructive"
          });
          setKehadiranData(prev => ({ ...prev, [key]: previousState }));
          return;
        }
        
        // Get guru_id from jadwal object using helper
        guruId = getGuruIdFromJadwal(jadwal, kehadiranData[key]);
      }

      if (!jadwalId || !guruId) {
        console.error('❌ Invalid IDs:', { jadwalId, guruId, key, kehadiranData: kehadiranData[key] });
        throw new Error('Jadwal ID atau Guru ID tidak valid');
      }

      const tanggalTarget = isEditMode ? selectedDate : getCurrentDateWIB();
      
    

      const resp = await fetch(getApiUrl('/api/siswa/update-status-guru'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          jadwal_id: jadwalId,
          guru_id: guruId,
          status,
          keterangan: kehadiranData[key]?.keterangan || '',
          tanggal_absen: tanggalTarget,
          ada_tugas: adaTugasData[key] || false
        })
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Gagal menyimpan status');
      }

      const result = await resp.json();
    

      // Tampilkan notifikasi sukses
      toast({
        title: "Berhasil",
        description: `Status berhasil diubah menjadi ${status}`,
        variant: "default",
        duration: 2000
      });

      // Tunggu 600ms untuk memastikan database sudah commit, baru reload
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Reload data untuk sinkronisasi dengan server
      if (isEditMode) {
      
        await loadJadwalBandingByDate(selectedDate);
      } else {
        await loadJadwalHariIni();
      }

    } catch (error) {
      const err = error as Error;
      console.error('❌ Error updating status:', err);
      
      // Rollback ke state sebelumnya
      setKehadiranData(prev => ({
        ...prev,
        [key]: previousState || {
          status: 'Hadir',
          keterangan: ''
        }
      }));

      // Tampilkan error notification
      toast({
        title: "Gagal Menyimpan",
        description: error.message || "Terjadi kesalahan saat menyimpan status. Silakan coba lagi.",
        variant: "destructive",
        duration: 4000
      });
    } finally {
      // Clear updating state
      setIsUpdatingStatus(null);
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(keyStr);
        return newSet;
      });
    }
  };

  const updateKehadiranKeterangan = (key: string | number, keterangan: string) => {
    setKehadiranData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        keterangan: keterangan
      }
    }));
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    if (!isEditMode) {
      // Switching to edit mode, load today's schedule
      const today = getCurrentDateWIB();
      setSelectedDate(today);
    } else {
      // Switching back to normal mode, load today's schedule
      loadJadwalHariIni();
    }
  };

  // Handle date change
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  const getStatusBadgeColor = (status: string) => {
    const colorMap: Record<string, string> = {
      hadir: 'bg-green-100 text-green-800',
      'tidak hadir': 'bg-red-100 text-red-800',
      izin: 'bg-yellow-100 text-yellow-800',
      sakit: 'bg-blue-100 text-blue-800',
      belum_diambil: 'bg-gray-100 text-gray-800'
    };
    return colorMap[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const renderKehadiranContent = () => {
    if (loading) {
      return (
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse bg-gray-200 h-20 sm:h-24 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (jadwalHariIni.length === 0) {
      return (
        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {isEditMode ? 'Edit Absen Guru' : 'Jadwal Hari Ini'} - {kelasInfo}
                </CardTitle>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {isEditMode && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="date-picker" className="text-sm font-medium">
                        Pilih Tanggal:
                      </Label>
                      <input
                        id="date-picker"
                        type="date"
                        value={selectedDate}
                        min={minDate}
                        max={maxDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                  
                  <Button
                    onClick={toggleEditMode}
                    variant={isEditMode ? "destructive" : "default"}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {isEditMode ? (
                      <>
                        <XCircle className="w-4 h-4" />
                        Keluar Edit Mode
                      </>
                    ) : (
                      <>
                        <Edit className="w-4 h-4" />
                        Edit Absen (7 Hari)
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {isEditMode && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 text-blue-600 mt-0.5">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">Mode Edit Absen Aktif</p>
                      <p>Anda dapat mengubah absen guru untuk tanggal yang dipilih (maksimal 7 hari yang lalu).</p>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="p-6 sm:p-12 text-center">
              <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Tidak Ada Jadwal Hari Ini</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4">Selamat beristirahat! Tidak ada mata pelajaran yang terjadwal untuk hari ini.</p>
              {!isEditMode && (
                <p className="text-xs sm:text-sm text-gray-500 mb-4">
                  Gunakan tombol "Edit Absen (30 Hari)" di atas untuk melihat jadwal hari lain.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => globalThis.location.reload()}
                  className="flex items-center gap-2 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Jadwal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Edit Mode Toggle and Date Picker */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="truncate">
                  {isEditMode ? 'Edit Absen Guru' : 'Jadwal Hari Ini'} - {kelasInfo}
                </span>
              </CardTitle>
              
              <div className="flex flex-col gap-3">
                {isEditMode && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Label htmlFor="date-picker" className="text-sm font-medium">
                      Pilih Tanggal:
                    </Label>
                    <input
                      id="date-picker"
                      type="date"
                      value={selectedDate}
                      min={minDate}
                      max={maxDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
                    />
                  </div>
                )}
                
                <Button
                  onClick={toggleEditMode}
                  variant={isEditMode ? "destructive" : "default"}
                  size="sm"
                  className="flex items-center gap-2 w-full sm:w-auto"
                >
                  {isEditMode ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      Keluar Edit Mode
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4" />
                      Edit Absen (30 Hari)
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {isEditMode && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 text-blue-600 mt-0.5">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Mode Edit Absen Aktif</p>
                    <p>Anda dapat mengubah absen guru untuk tanggal yang dipilih (maksimal 7 hari yang lalu).</p>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="min-w-0">
            <CardTitle className="flex items-center gap-2 min-w-0">
              <Calendar className="w-5 h-5" />
              <span className="truncate" title={isEditMode ? `Jadwal ${formatDateOnly(selectedDate)}` : 'Jadwal Hari Ini'}>
                {isEditMode ? `Jadwal ${formatDateOnly(selectedDate)}` : 'Jadwal Hari Ini'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:space-y-4">
              {loading && isEditMode ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Memuat jadwal...</span>
                </div>
              ) : isEditMode && jadwalBerdasarkanTanggal.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Tidak ada jadwal untuk tanggal {selectedDate}</p>
                </div>
              ) : (() => {
                // Group by jadwal_id to handle multi-guru properly
                const jadwalData = isEditMode ? jadwalBerdasarkanTanggal : jadwalHariIni;
                
                const groupedJadwal = jadwalData.reduce((acc, jadwal) => {
                  const key = jadwal.id_jadwal;
                  if (!acc[key]) {
                    acc[key] = {
                      ...jadwal,
                      guru_list: []
                    };
                  }
                  
                  // Sumber prioritas guru_list:
                  // 1) Jika jadwal.guru_list sudah array (hasil parsing), pakai itu
                  if (Array.isArray(jadwal.guru_list) && jadwal.guru_list.length > 0) {
                    acc[key].guru_list = jadwal.guru_list as GuruInSchedule[];
                  } else {
                    // 2) Jika ada id_guru di record ini, dorong satu guru
                    if (jadwal.id_guru) {
                    acc[key].guru_list!.push({
                        id_guru: jadwal.id_guru as number,
                        nama_guru: jadwal.nama_guru as string,
                        nip: jadwal.nip as string,
                        is_primary: (jadwal.is_primary ?? false) as boolean,
                        status_kehadiran: jadwal.status_kehadiran as string,
                        keterangan_guru: (jadwal.keterangan_guru ?? '') as string
                      } as GuruInSchedule);
                    } else if (jadwal.is_multi_guru && typeof jadwal.nama_guru === 'string' && acc[key].guru_list!.length === 0) {
                      // 3) Fallback: pecah nama_guru menjadi beberapa nama jika dipisah delimiter umum
                      const raw = jadwal.nama_guru as string;
                      const parts = raw.split(/,|&| dan /gi).map(s => s.trim()).filter(Boolean);
                      if (parts.length > 1) {
                        parts.forEach((nama: string, idx: number) => {
                          acc[key].guru_list!.push({
                            id_guru: 0, // placeholder, belum bisa diupdate ke server
                            nama_guru: nama,
                            nip: '',
                            is_primary: idx === 0,
                            status_kehadiran: 'belum_diambil',
                            keterangan_guru: ''
                          } as {
                            id_guru: number;
                            nama_guru: string;
                            nip: string;
                            is_primary?: boolean;
                            status_kehadiran: string;
                            keterangan_guru?: string;
                          });
                        });
                      }
                    }
                  }
                  
                  return acc;
                }, {} as Record<number, JadwalHariIni & { guru_list: GuruInSchedule[] }>);
                
                const uniqueJadwal = Object.values(groupedJadwal);
                
                return uniqueJadwal.map((jadwal, index) => {
                // Conditional rendering untuk jadwal yang tidak bisa diabsen
                if (!jadwal.is_absenable) {
                  return (
                    <div key={jadwal.id_jadwal} className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 bg-gray-50">
                      <div className="mb-4">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">Jam ke-{jadwal.jam_ke}</Badge>
                          <Badge variant="outline" className="text-xs">{jadwal.jam_mulai} - {jadwal.jam_selesai}</Badge>
                          <Badge variant="secondary" className="text-xs">
                            {jadwal.jenis_aktivitas === 'upacara' ? 'Upacara' :
                             jadwal.jenis_aktivitas === 'istirahat' ? 'Istirahat' :
                             jadwal.jenis_aktivitas === 'kegiatan_khusus' ? 'Kegiatan Khusus' :
                             jadwal.jenis_aktivitas === 'libur' ? 'Libur' :
                             jadwal.jenis_aktivitas === 'ujian' ? 'Ujian' :
                             (jadwal.jenis_aktivitas || 'Khusus')}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                            Tidak perlu absen
                          </Badge>
                        </div>
                        <h4 className="font-semibold text-base sm:text-lg text-gray-700 break-words mb-1">
                          {jadwal.keterangan_khusus || jadwal.nama_mapel}
                        </h4>
                        <p className="text-sm sm:text-base text-gray-600 break-words">Aktivitas Khusus</p>
                      </div>
                    </div>
                  );
                }

                // Jadwal normal yang bisa diabsen
                return (
                  <div key={jadwal.id_jadwal} className="border rounded-lg p-3 sm:p-4">
                    <div className="mb-4">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">Jam ke-{jadwal.jam_ke}</Badge>
                        <Badge variant="outline" className="text-xs">{jadwal.jam_mulai} - {jadwal.jam_selesai}</Badge>
                        <Badge className={`text-xs ${getStatusBadgeColor(kehadiranData[jadwal.id_jadwal]?.status || jadwal.status_kehadiran || 'belum_diambil')}`}>
                          {(() => {
                            const status = kehadiranData[jadwal.id_jadwal]?.status || jadwal.status_kehadiran || 'belum_diambil';
                            const labelMap: Record<string, string> = {
                              hadir: 'Hadir',
                              'tidak hadir': 'Tidak Hadir',
                              izin: 'Izin',
                              sakit: 'Sakit',
                              belum_diambil: 'Belum Diambil'
                            };
                            return labelMap[status.toLowerCase()] || status;
                          })()}
                        </Badge>
                        {jadwal.waktu_catat && (
                          <Badge variant="secondary" className="text-xs">
                            ✓ {formatDateTime24(jadwal.waktu_catat, true)}
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-semibold text-base sm:text-lg text-gray-900 break-words mb-2">{jadwal.nama_mapel}</h4>
                      <div className="space-y-1">
                        {!(jadwal.is_multi_guru && jadwal.guru_list && jadwal.guru_list.length > 0) && (
                          <>
                            <p className="text-sm sm:text-base text-gray-600 break-words">{jadwal.nama_guru}</p>
                            {jadwal.nip && <p className="text-xs sm:text-sm text-gray-500">NIP: {jadwal.nip}</p>}
                          </>
                        )}
                        {jadwal.is_multi_guru && jadwal.guru_list && jadwal.guru_list.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              Multi-Guru ({jadwal.guru_list.length} guru)
                            </Badge>
                            {jadwal.guru_list.slice(1).map((guru, idx: number) => (
                              <Badge key={guru.id_guru || idx} variant="outline" className="text-xs">
                                {guru.nama_guru}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {jadwal.kode_ruang && (
                        <div className="text-xs sm:text-sm text-blue-600 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {jadwal.kode_ruang}
                          </Badge>
                          {jadwal.nama_ruang && ` - ${jadwal.nama_ruang}`}
                        </div>
                      )}
                    </div>

                  <div className="space-y-3 sm:space-y-4">
                    {/* Multi-guru form */}
                    {jadwal.is_multi_guru ? (
                      (jadwal.guru_list && jadwal.guru_list.length > 0) ? (
                      <div className="space-y-3 sm:space-y-4">
                        <Label className="text-sm font-medium text-gray-700 mb-3 block">
                          Status Kehadiran Guru (Multi-Guru):
                        </Label>
                        {jadwal.guru_list.map((guru, guruIdx) => {
                          const guruKey = `${jadwal.id_jadwal}-${guru.id_guru}`;
                          const currentStatus = kehadiranData[guruKey]?.status || guru.status_kehadiran || 'belum_diambil';
                          
                          // Fix: isSubmitted should mainly rely on server data, NOT client form state (which defaults to 'Hadir')
                          const isSubmitted = guru.status_kehadiran && guru.status_kehadiran !== 'belum_diambil';
                          
                          return (
                            <div key={guruKey} className={`border rounded-lg p-3 sm:p-4 ${isSubmitted ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 sm:mb-3">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-medium text-gray-800 text-sm sm:text-base">{guru.nama_guru}</h5>
                                  {isSubmitted ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                  {guru.is_primary && (
                                    <Badge variant="secondary" className="text-xs">
                                      Guru Utama
                                    </Badge>
                                  )}
                                  <Badge variant={isSubmitted ? "default" : "outline"} className="text-xs">
                                    {isSubmitted ? 'Sudah Diabsen' : 'Belum Diabsen'}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-xs sm:text-sm text-gray-600 mb-2">NIP: {guru.nip}</p>
                              {guru.waktu_absen && (
                                <p className="text-xs text-gray-500 mb-2 sm:mb-3">
                                  Waktu absen: {formatDateTime24(guru.waktu_absen, true)}
                                </p>
                              )}
                              <RadioGroup 
                                value={kehadiranData[guruKey]?.status || guru.status_kehadiran || ''} 
                                onValueChange={(value) => updateKehadiranStatus(guruKey, value)}
                                disabled={!guru.id_guru || guru.id_guru === 0 || isUpdatingStatus === guruKey}
                              >
                                {isUpdatingStatus === guruKey && (
                                  <div className="text-xs text-blue-600 flex items-center gap-1 mb-2">
                                    <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                    Menyimpan...
                                  </div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Hadir" id={`hadir-${guruKey}`} />
                                    <Label htmlFor={`hadir-${guruKey}`} className="flex items-center gap-2 text-sm">
                                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                                      Hadir
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Tidak Hadir" id={`tidak_hadir-${guruKey}`} />
                                    <Label htmlFor={`tidak_hadir-${guruKey}`} className="flex items-center gap-2 text-sm">
                                      <XCircle className="w-4 h-4 text-red-600" />
                                      Tidak Hadir
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Izin" id={`izin-${guruKey}`} />
                                    <Label htmlFor={`izin-${guruKey}`} className="flex items-center gap-2 text-sm">
                                      <User className="w-4 h-4 text-yellow-600" />
                                      Izin
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Sakit" id={`sakit-${guruKey}`} />
                                    <Label htmlFor={`sakit-${guruKey}`} className="flex items-center gap-2 text-sm">
                                      <BookOpen className="w-4 h-4 text-blue-600" />
                                      Sakit
                                    </Label>
                                  </div>
                                </div>
                              </RadioGroup>
                              
                              {/* Keterangan untuk guru ini */}
                              {kehadiranData[guruKey]?.status && kehadiranData[guruKey]?.status !== 'Hadir' && (
                                <div className="mt-2 sm:mt-3">
                                  <Label htmlFor={`keterangan-${guruKey}`} className="text-xs sm:text-sm font-medium text-gray-700">
                                    Keterangan untuk {guru.nama_guru}:
                                  </Label>
                                  <Textarea
                                    id={`keterangan-${guruKey}`}
                                    placeholder="Masukkan keterangan jika diperlukan..."
                                    value={kehadiranData[guruKey]?.keterangan || guru.keterangan_guru || ''}
                                    onChange={(e) => updateKehadiranKeterangan(guruKey, e.target.value)}
                                    className="mt-1 text-sm"
                                    rows={2}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      ) : (
                        <div className="p-3 border rounded bg-yellow-50 border-yellow-200 text-sm text-yellow-800">
                          Jadwal ini multi-guru namun daftar guru belum tersedia. Silakan refresh/ulang sampai daftar guru tampil.
                        </div>
                      )
                    ) : (
                      /* Single guru form */
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-3 block">
                          Status Kehadiran Guru:
                        </Label>
                        <RadioGroup 
                          value={kehadiranData[jadwal.id_jadwal]?.status || jadwal.status_kehadiran || ''} 
                          onValueChange={(value) => updateKehadiranStatus(jadwal.id_jadwal, value)}
                          disabled={isUpdatingStatus === String(jadwal.id_jadwal)}
                        >
                          {isUpdatingStatus === String(jadwal.id_jadwal) && (
                            <div className="text-xs text-blue-600 flex items-center gap-1 mb-2">
                              <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                              Menyimpan...
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="Hadir" id={`hadir-${jadwal.id_jadwal}`} />
                              <Label htmlFor={`hadir-${jadwal.id_jadwal}`} className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                Hadir
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="Tidak Hadir" id={`tidak_hadir-${jadwal.id_jadwal}`} />
                              <Label htmlFor={`tidak_hadir-${jadwal.id_jadwal}`} className="flex items-center gap-2 text-sm">
                                <XCircle className="w-4 h-4 text-red-600" />
                                Tidak Hadir
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="Izin" id={`izin-${jadwal.id_jadwal}`} />
                              <Label htmlFor={`izin-${jadwal.id_jadwal}`} className="flex items-center gap-2 text-sm">
                                <User className="w-4 h-4 text-yellow-600" />
                                Izin
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="Sakit" id={`sakit-${jadwal.id_jadwal}`} />
                              <Label htmlFor={`sakit-${jadwal.id_jadwal}`} className="flex items-center gap-2 text-sm">
                                <BookOpen className="w-4 h-4 text-blue-600" />
                                Sakit
                              </Label>
                            </div>
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    {/* Opsi Ada Tugas */}
                    {(kehadiranData[jadwal.id_jadwal]?.status === 'Tidak Hadir' || 
                      kehadiranData[jadwal.id_jadwal]?.status === 'Izin' || 
                      kehadiranData[jadwal.id_jadwal]?.status === 'Sakit') && (
                      <div className="mt-2 sm:mt-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`ada-tugas-${jadwal.id_jadwal}`}
                            checked={adaTugasData[jadwal.id_jadwal] || false}
                            onChange={(e) => 
                              setAdaTugasData(prev => ({ ...prev, [jadwal.id_jadwal]: e.target.checked }))
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <Label htmlFor={`ada-tugas-${jadwal.id_jadwal}`} className="text-sm text-blue-600">
                            Ada Tugas
                          </Label>
                        </div>
                      </div>
                    )}

                    {/* Tombol Absen Kelas - Muncul ketika guru Tidak Hadir */}
                    {kehadiranData[jadwal.id_jadwal]?.status === 'Tidak Hadir' && !isEditMode && (
                      <div className="mt-3">
                        <Button
                          onClick={() => openAbsenKelasModal(jadwal.id_jadwal, jadwal.nama_guru || 'Guru')}
                          variant="outline"
                          className="w-full bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
                        >
                          <Users className="w-4 h-4 mr-2" />
                          Absen Kelas (Guru Tidak Hadir)
                        </Button>
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          Klik untuk mengabsen siswa karena guru tidak hadir
                        </p>
                      </div>
                    )}

                    {/* Keterangan untuk single guru */}
                    {!jadwal.is_multi_guru && (
                      <div>
                        <Label htmlFor={`keterangan-${jadwal.id_jadwal}`} className="text-xs sm:text-sm font-medium text-gray-700">
                          Keterangan:
                        </Label>
                        <Textarea
                          id={`keterangan-${jadwal.id_jadwal}`}
                          placeholder="Masukkan keterangan jika diperlukan..."
                          value={kehadiranData[jadwal.id_jadwal]?.keterangan || ''}
                          onChange={(e) => updateKehadiranKeterangan(jadwal.id_jadwal, e.target.value)}
                          disabled={false}
                          className="mt-1 text-sm"
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                </div>
                );
                });
              })()}
            </div>

            <div className="mt-6 pt-6 border-t">
              {/* Preview Data Absensi untuk Multi Guru */}
              {(() => {
                const jadwalData = isEditMode ? jadwalBerdasarkanTanggal : jadwalHariIni;
                const multiGuruJadwal = jadwalData.filter(jadwal => jadwal.is_multi_guru && jadwal.is_absenable);
                
                if (multiGuruJadwal.length > 0) {
                  return (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-5 h-5 text-blue-600" />
                        <h4 className="font-medium text-blue-800">Preview Data Absensi Multi Guru</h4>
                      </div>
                      <div className="space-y-3">
                        {multiGuruJadwal.map((jadwal) => (
                          <div key={jadwal.id_jadwal} className="bg-white p-3 rounded border">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-gray-800">{jadwal.nama_mapel}</span>
                              <Badge variant="secondary" className="text-xs">
                                Multi-Guru ({jadwal.guru_list?.length || 0})
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {jadwal.guru_list?.map((guru) => {
                                const guruKey = `${jadwal.id_jadwal}-${guru.id_guru}`;
                                const status = kehadiranData[guruKey]?.status || guru.status_kehadiran || 'belum_diambil';
                                return (
                                  <div key={guruKey} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">{guru.nama_guru}</span>
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        className={`text-xs ${
                                          status === 'Hadir' ? 'bg-green-100 text-green-800' :
                                          status === 'Tidak Hadir' ? 'bg-red-100 text-red-800' :
                                          status === 'Izin' ? 'bg-yellow-100 text-yellow-800' :
                                          status === 'Sakit' ? 'bg-blue-100 text-blue-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}
                                      >
                                        {status}
                                      </Badge>
                                      {kehadiranData[guruKey]?.keterangan && (
                                        <span className="text-xs text-gray-500 truncate max-w-[100px]" title={kehadiranData[guruKey].keterangan}>
                                          {kehadiranData[guruKey].keterangan}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {isEditMode && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 text-yellow-600 mt-0.5">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">Perhatian!</p>
                      <p>Anda sedang mengedit absen untuk tanggal {formatDateOnly(selectedDate)}. Perubahan akan disimpan dan menggantikan data sebelumnya.</p>
                    </div>
                  </div>
                </div>
              )}
              
              <Button 
                onClick={submitKehadiran} 
                disabled={loading} 
                className={`w-full ${isEditMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Menyimpan...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {isEditMode ? 'Simpan Perubahan Absen' : 'Simpan Data Kehadiran'}
                  </div>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderRiwayatContent = () => {
    if (riwayatData.length === 0) {
      return (
        <Card>
          <CardContent className="p-6 sm:p-12 text-center">
            <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Belum Ada Riwayat</h3>
            <p className="text-sm sm:text-base text-gray-600">Riwayat kehadiran kelas akan muncul setelah ada data absensi.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
        {/* Header yang mobile responsive */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              <p className="text-blue-800 font-medium text-sm sm:text-base">Riwayat Kehadiran Kelas</p>
            </div>
            <p className="text-blue-700 text-xs sm:text-sm">Sebagai perwakilan kelas, Anda dapat melihat ringkasan kehadiran seluruh siswa</p>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm text-blue-600 font-medium">
                {riwayatData.length} hari riwayat
              </div>
              <div className="text-xs text-blue-500">
                Halaman {riwayatPage} dari {Math.ceil(riwayatData.length / riwayatItemsPerPage)}
              </div>
            </div>
          </div>
        </div>

        {/* Card layout untuk mobile, tabel untuk desktop */}
        <div className="block lg:hidden">
          {riwayatData
            .slice((riwayatPage - 1) * riwayatItemsPerPage, riwayatPage * riwayatItemsPerPage)
            .map((hari, index) => {
              const seenJadwal = new Set();
              const uniqueJadwal = hari.jadwal.filter((jadwal) => {
                const key = `${jadwal.jadwal_id}-${jadwal.jam_ke}-${jadwal.jam_mulai}-${jadwal.jam_selesai}-${jadwal.nama_mapel}`;
                if (seenJadwal.has(key)) {
                  return false;
                }
                seenJadwal.add(key);
                return true;
              });
              
              return (
                <Card key={index} className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="w-4 h-4" />
                      {formatDateOnly(hari.tanggal)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {uniqueJadwal.map((jadwal, jadwalIndex) => (
                      <div key={jadwalIndex} className="border rounded-lg p-3 space-y-3">
                        {/* Header jadwal */}
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">Jam ke-{jadwal.jam_ke}</Badge>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setDetailRiwayat(jadwal)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Detail
                          </Button>
                        </div>
                        
                        {/* Informasi mata pelajaran */}
                        <div>
                          <h4 className="font-medium text-sm mb-1">{jadwal.nama_mapel}</h4>
                          <p className="text-xs text-gray-600">{jadwal.jam_mulai} - {jadwal.jam_selesai}</p>
                        </div>
                        
                        {/* Informasi guru */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Guru:</p>
                          <p className="text-sm font-medium">{jadwal.nama_guru}</p>
                          {!!jadwal.is_multi_guru && jadwal.guru_list && jadwal.guru_list.length > 0 && (
                            <div className="mt-2">
                              <Badge variant="secondary" className="text-xs mb-2">
                                <Users className="w-3 h-3 mr-1" />
                                Multi-Guru ({jadwal.guru_list.length})
                              </Badge>
                              <div className="space-y-1">
                                {jadwal.guru_list.map((guru, idx: number) => (
                                  <div key={guru.id_guru || idx} className="flex items-center gap-2">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${
                                        guru.status_kehadiran === 'Hadir' ? 'bg-green-100 text-green-800' :
                                        guru.status_kehadiran === 'Tidak Hadir' ? 'bg-red-100 text-red-800' :
                                        guru.status_kehadiran === 'Izin' ? 'bg-yellow-100 text-yellow-800' :
                                        guru.status_kehadiran === 'Sakit' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {guru.nama_guru}
                                    </Badge>
                                    <span className="text-xs text-gray-500">
                                      {guru.status_kehadiran || 'Belum'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Ruangan */}
                        {jadwal.kode_ruang && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Ruangan:</p>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className="text-xs w-fit">
                                {jadwal.kode_ruang}
                              </Badge>
                              {jadwal.nama_ruang && (
                                <span className="text-xs text-gray-600">
                                  {jadwal.nama_ruang}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Statistik kehadiran */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Total Hadir:</p>
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              {jadwal.total_hadir}/{jadwal.total_siswa}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Tidak Hadir:</p>
                            <div className="flex flex-wrap gap-1">
                              {jadwal.total_izin > 0 && (
                                <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                  Izin: {jadwal.total_izin}
                                </Badge>
                              )}
                              {jadwal.total_sakit > 0 && (
                                <Badge className="bg-blue-100 text-blue-800 text-xs">
                                  Sakit: {jadwal.total_sakit}
                                </Badge>
                              )}
                              {jadwal.total_alpa > 0 && (
                                <Badge className="bg-red-100 text-red-800 text-xs">
                                  Alpa: {jadwal.total_alpa}
                                </Badge>
                              )}
                              {jadwal.total_tidak_hadir && jadwal.total_tidak_hadir > 0 && (
                                <Badge className="bg-gray-100 text-gray-800 text-xs">
                                  Tidak Hadir: {jadwal.total_tidak_hadir}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
        </div>

        {/* Tabel untuk desktop */}
        <div className="hidden lg:block">
          {riwayatData
            .slice((riwayatPage - 1) * riwayatItemsPerPage, riwayatPage * riwayatItemsPerPage)
            .map((hari, index) => {
              const seenJadwal = new Set();
              const uniqueJadwal = hari.jadwal.filter((jadwal) => {
                const key = `${jadwal.jadwal_id}-${jadwal.jam_ke}-${jadwal.jam_mulai}-${jadwal.jam_selesai}-${jadwal.nama_mapel}`;
                if (seenJadwal.has(key)) {
                  return false;
                }
                seenJadwal.add(key);
                return true;
              });
              
              return (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      {formatDateOnly(hari.tanggal)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto max-w-full">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap w-20">Jam Ke</TableHead>
                            <TableHead className="whitespace-nowrap w-24">Waktu</TableHead>
                            <TableHead className="whitespace-nowrap w-32">Mata Pelajaran</TableHead>
                            <TableHead className="whitespace-nowrap w-28">Guru</TableHead>
                            <TableHead className="whitespace-nowrap w-20">Ruangan</TableHead>
                            <TableHead className="whitespace-nowrap w-24">Total Hadir</TableHead>
                            <TableHead className="whitespace-nowrap w-28">Tidak Hadir</TableHead>
                            <TableHead className="whitespace-nowrap w-20">Detail</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uniqueJadwal.map((jadwal, jadwalIndex) => (
                            <TableRow key={jadwalIndex}>
                              <TableCell>
                                <Badge variant="outline">Jam ke-{jadwal.jam_ke}</Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm whitespace-nowrap">{jadwal.jam_mulai} - {jadwal.jam_selesai}</span>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium block max-w-[120px] truncate text-xs" title={jadwal.nama_mapel}>{jadwal.nama_mapel}</span>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <span className="block max-w-[100px] truncate text-xs" title={jadwal.nama_guru}>{jadwal.nama_guru}</span>
                                  {!!jadwal.is_multi_guru && jadwal.guru_list && jadwal.guru_list.length > 0 && (
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap gap-1">
                                        <Badge variant="secondary" className="text-xs">
                                          <Users className="w-3 h-3 mr-1" />
                                          Multi-Guru ({jadwal.guru_list.length})
                                        </Badge>
                                      </div>
                                      <div className="space-y-1">
                                        {jadwal.guru_list.map((guru, idx: number) => (
                                          <div key={guru.id_guru || idx} className="flex items-center gap-2">
                                            <Badge 
                                              variant="outline" 
                                              className={`text-xs ${
                                                guru.status_kehadiran === 'Hadir' ? 'bg-green-100 text-green-800' :
                                                guru.status_kehadiran === 'Tidak Hadir' ? 'bg-red-100 text-red-800' :
                                                guru.status_kehadiran === 'Izin' ? 'bg-yellow-100 text-yellow-800' :
                                                guru.status_kehadiran === 'Sakit' ? 'bg-blue-100 text-blue-800' :
                                                'bg-gray-100 text-gray-800'
                                              }`}
                                            >
                                              {guru.nama_guru}
                                            </Badge>
                                            <span className="text-xs text-gray-500">
                                              {guru.status_kehadiran || 'Belum'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {jadwal.kode_ruang ? (
                                  <div className="flex flex-col gap-1">
                                    <Badge variant="outline" className="text-xs w-fit">
                                      {jadwal.kode_ruang}
                                    </Badge>
                                    {jadwal.nama_ruang && (
                                      <span className="text-xs text-gray-600 max-w-[80px] truncate" title={jadwal.nama_ruang}>
                                        {jadwal.nama_ruang}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-green-100 text-green-800">
                                    {jadwal.total_hadir}/{jadwal.total_siswa}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {jadwal.total_izin > 0 && (
                                    <Badge className="bg-yellow-100 text-yellow-800 text-xs w-fit">
                                      I:{jadwal.total_izin}
                                    </Badge>
                                  )}
                                  {jadwal.total_sakit > 0 && (
                                    <Badge className="bg-blue-100 text-blue-800 text-xs w-fit">
                                      S:{jadwal.total_sakit}
                                    </Badge>
                                  )}
                                  {jadwal.total_alpa > 0 && (
                                    <Badge className="bg-red-100 text-red-800 text-xs w-fit">
                                      A:{jadwal.total_alpa}
                                    </Badge>
                                  )}
                                  {jadwal.total_tidak_hadir && jadwal.total_tidak_hadir > 0 && (
                                    <Badge className="bg-gray-100 text-gray-800 text-xs w-fit">
                                      TH:{jadwal.total_tidak_hadir}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setDetailRiwayat(jadwal)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Detail
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>

        {/* Pagination Card untuk Riwayat - FIXED: Only show if there's data and more than 1 page */}
        {riwayatData.length > 0 && Math.ceil(riwayatData.length / riwayatItemsPerPage) > 1 && (
          <Card>
            <CardContent className="p-4">
              <Pagination
                currentPage={riwayatPage}
                totalPages={Math.ceil(riwayatData.length / riwayatItemsPerPage)}
                onPageChange={setRiwayatPage}
              />
            </CardContent>
          </Card>
        )}

        {/* Modal Detail Riwayat - Mobile Responsive */}
        {detailRiwayat && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1 sm:p-4">
            <div className="bg-white rounded-lg p-3 sm:p-6 max-w-2xl w-full max-h-[95vh] sm:max-h-[80vh] overflow-y-auto mx-2 sm:mx-0">
              <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2 sm:gap-3">
                <h3 className="text-sm sm:text-lg font-semibold leading-tight flex-1 min-w-0">
                  Detail Kehadiran - Jam ke-{detailRiwayat.jam_ke}
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 p-0"
                  onClick={() => setDetailRiwayat(null)}
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
              
              <div className="mb-3 sm:mb-4 space-y-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3">
                  <p className="text-xs sm:text-sm text-gray-700">
                    <span className="font-medium block sm:inline">{detailRiwayat.nama_mapel}</span>
                    <span className="text-xs text-gray-500 block sm:inline sm:ml-2">
                      {detailRiwayat.jam_mulai} - {detailRiwayat.jam_selesai}
                    </span>
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    <span className="font-medium">Guru:</span> {detailRiwayat.nama_guru}
                  </p>
                </div>
              </div>

              {detailRiwayat.siswa_tidak_hadir && Array.isArray(detailRiwayat.siswa_tidak_hadir) && detailRiwayat.siswa_tidak_hadir.length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  <h4 className="font-medium text-xs sm:text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Siswa Tidak Hadir ({detailRiwayat.siswa_tidak_hadir.length})
                  </h4>
                  <div className="space-y-2 max-h-48 sm:max-h-60 overflow-y-auto">
                    {detailRiwayat.siswa_tidak_hadir.map((siswa, idx) => {
                      const namaSiswa = siswa.nama_siswa || 'Nama tidak tersedia';
                      const nisSiswa = siswa.nis || 'NIS tidak tersedia';
                      const statusSiswa = siswa.status || 'Status tidak tersedia';
                      
                      return (
                        <div key={idx} className="border rounded-lg p-2 sm:p-3 space-y-2 bg-gray-50">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-xs sm:text-sm truncate">
                                  {namaSiswa}
                                </p>
                                <p className="text-xs text-gray-500">
                                  NIS: {nisSiswa}
                                </p>
                              </div>
                              <Badge 
                                variant={
                                  statusSiswa === 'izin' ? 'secondary' :
                                  statusSiswa === 'sakit' ? 'outline' : 'destructive'
                                }
                                className="capitalize text-xs flex-shrink-0 w-fit"
                              >
                                {statusSiswa}
                              </Badge>
                            </div>
                            {siswa.keterangan && (
                              <div className="pt-1 border-t border-gray-200">
                                <p className="text-xs text-gray-600 break-words">
                                  <span className="font-medium">Keterangan:</span> {siswa.keterangan}
                                </p>
                              </div>
                            )}
                            {siswa.nama_pencatat && (
                              <p className="text-xs text-gray-500">
                                Dicatat oleh: {siswa.nama_pencatat}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 sm:py-8">
                  <CheckCircle2 className="w-8 h-8 sm:w-12 sm:h-12 mx-auto text-green-500 mb-2" />
                  <p className="text-green-600 font-medium text-xs sm:text-base">Semua siswa hadir</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };


  // Render Banding Absen Content
  // Render Banding Absen Content untuk Kelas
  const renderBandingAbsenContent = () => {
    return (
      <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
        {/* Header - Mobile Responsive */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
              <h2 className="text-orange-800 font-medium text-sm sm:text-lg">Pengajuan Banding Absen</h2>
            </div>
            <p className="text-orange-700 text-xs sm:text-sm">Ajukan banding absensi untuk satu siswa</p>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm text-orange-600 font-medium">
                {bandingAbsen.length} banding tersimpan
              </div>
              <Button 
                onClick={() => setShowFormBanding(true)}
                className="bg-orange-600 hover:bg-orange-700 text-xs sm:text-sm h-8 sm:h-10"
              >
                <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Ajukan Banding
              </Button>
            </div>
          </div>
        </div>

        {/* Form Pengajuan Banding - Mobile Responsive */}
        {showFormBanding && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Form Pengajuan Banding Absen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="tanggal_banding" className="text-sm font-medium">Tanggal Absen</Label>
                  <input
                    id="tanggal_banding"
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={formBanding.tanggal_absen}
                    max={getCurrentDateWIB()}
                    onChange={(e) => {
                      const tanggal = e.target.value;
                      setFormBanding({...formBanding, tanggal_absen: tanggal, jadwal_id: ''});
                      if (tanggal) {
                        loadJadwalBandingByDate(tanggal);
                      } else {
                        setJadwalBerdasarkanTanggal([]);
                      }
                      
                      // Load status kehadiran siswa dari database ketika tanggal dipilih
                      if (tanggal && formBanding.jadwal_id && selectedSiswaId) {
                        loadSiswaStatusById(selectedSiswaId, tanggal, formBanding.jadwal_id);
                      }
                    }}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Pilih tanggal absen terlebih dahulu untuk melihat jadwal pelajaran (hanya hari ini dan masa lalu)</p>
                </div>
                
                <div>
                  <Label htmlFor="jadwal_banding" className="text-sm font-medium">Jadwal Pelajaran</Label>
                  <select 
                    id="jadwal_banding"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={formBanding.jadwal_id}
                    onChange={(e) => {
                      setFormBanding({...formBanding, jadwal_id: e.target.value});
                      
                      // Load status kehadiran siswa dari database ketika jadwal dipilih
                      if (e.target.value && formBanding.tanggal_absen && selectedSiswaId) {
                        loadSiswaStatusById(selectedSiswaId, formBanding.tanggal_absen, e.target.value);
                      }
                    }}
                    disabled={!formBanding.tanggal_absen || loadingJadwal}
                  >
                    <option value="">
                      {!formBanding.tanggal_absen 
                        ? "Pilih tanggal absen terlebih dahulu..." 
                        : loadingJadwal 
                          ? "Memuat jadwal..." 
                          : "Pilih jadwal pelajaran..."
                      }
                    </option>
                    {jadwalBerdasarkanTanggal && jadwalBerdasarkanTanggal.length > 0 ? jadwalBerdasarkanTanggal.map(j => (
                      <option key={j.id_jadwal} value={j.id_jadwal}>
                        {j.nama_mapel} ({j.jam_mulai}-{j.jam_selesai}) - {j.nama_guru}
                      </option>
                    )) : formBanding.tanggal_absen && !loadingJadwal ? (
                      <option value="" disabled>Tidak ada jadwal untuk tanggal ini</option>
                    ) : null}
                  </select>
                </div>
              </div>

              {/* Pilihan Siswa untuk Banding - Mobile Responsive */}
              <div className="border-t pt-4">
                <div className="mb-3">
                    <Label className="text-base sm:text-lg font-semibold">Siswa yang Ajukan Banding</Label>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">
                    Pilih satu siswa untuk pengajuan banding absen
                    </div>
                  </div>

                <div className="p-3 sm:p-4 border rounded-lg bg-gray-50 space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Nama Siswa</Label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            value={selectedSiswaId ?? ''}
                            onChange={(e) => {
                              const val = e.target.value ? Number.parseInt(e.target.value, 10) : Number.NaN;
                              const chosen = daftarSiswa.find(s => (s.id ?? s.id_siswa) === val) || undefined;

                              setSelectedSiswaId(Number.isNaN(val) ? null : val);

                              // Simpan nama ke form untuk tampilan (backend tidak memakai ini)
                              const newSiswaBanding = [{
                                nama: chosen?.nama || '',
                                status_asli: formBanding.siswa_banding[0]?.status_asli || 'alpa',
                                status_diajukan: formBanding.siswa_banding[0]?.status_diajukan || 'hadir',
                                alasan_banding: formBanding.siswa_banding[0]?.alasan_banding || ''
                              }];
                              setFormBanding({ ...formBanding, siswa_banding: newSiswaBanding });

                              // Load status kehadiran siswa dari database
                              if (!Number.isNaN(val) && formBanding.tanggal_absen && formBanding.jadwal_id) {
                                loadSiswaStatusById(val, formBanding.tanggal_absen, formBanding.jadwal_id);
                              }
                            }}
                          >
                            <option value="">Pilih siswa...</option>
                            {daftarSiswa.map((s) => {
                              const optionId = (s.id ?? s.id_siswa) as number;
                              return (
                                <option key={optionId} value={optionId}>
                                  {s.nama}
                                </option>
                              );
                            })}
                          </select>
                          <div className="text-xs text-gray-500 mt-1">
                            Pilih nama siswa dari kelas untuk pengajuan banding absen
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Status Tercatat</Label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-sm"
                              value={formBanding.siswa_banding[0]?.status_asli ? 
                                formBanding.siswa_banding[0].status_asli.charAt(0).toUpperCase() + 
                                formBanding.siswa_banding[0].status_asli.slice(1) : 'Belum dipilih'}
                              readOnly
                              disabled
                            />
                            <p className="text-xs text-gray-500 mt-1">Status tercatat diambil dari database dan tidak bisa diubah</p>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Status Diajukan</Label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        value={formBanding.siswa_banding[0]?.status_diajukan || 'hadir'}
                            onChange={(e) => {
                          const newSiswaBanding = [{
                            nama: formBanding.siswa_banding[0]?.nama || '',
                            status_asli: formBanding.siswa_banding[0]?.status_asli || 'alpa',
                            status_diajukan: e.target.value as 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen',
                            alasan_banding: formBanding.siswa_banding[0]?.alasan_banding || ''
                          }];
                              setFormBanding({...formBanding, siswa_banding: newSiswaBanding});
                            }}
                          >
                            <option value="hadir">Hadir</option>
                            <option value="izin">Izin</option>
                            <option value="sakit">Sakit</option>
                            <option value="alpa">Alpa</option>
                            <option value="dispen">Dispen</option>
                          </select>
                        </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Alasan Banding</Label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            placeholder="Alasan banding..."
                        value={formBanding.siswa_banding[0]?.alasan_banding || ''}
                            onChange={(e) => {
                          const newSiswaBanding = [{
                            nama: formBanding.siswa_banding[0]?.nama || '',
                            status_asli: formBanding.siswa_banding[0]?.status_asli || 'alpa',
                            status_diajukan: formBanding.siswa_banding[0]?.status_diajukan || 'hadir',
                            alasan_banding: e.target.value
                          }];
                              setFormBanding({...formBanding, siswa_banding: newSiswaBanding});
                            }}
                          />
                        </div>
                      </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button 
                  onClick={submitBandingAbsen}
                  disabled={!formBanding.tanggal_absen || !formBanding.jadwal_id || !selectedSiswaId || !formBanding.siswa_banding[0]?.alasan_banding || loadingJadwal}
                  className="bg-orange-600 hover:bg-orange-700 text-sm h-9 sm:h-10"
                >
                  <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Kirim Banding
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowFormBanding(false);
                    setFormBanding({
                      jadwal_id: '',
                      tanggal_absen: '',
                      siswa_banding: [{
                        nama: '',
                        status_asli: 'alpa',
                        status_diajukan: 'hadir',
                        alasan_banding: ''
                      }]
                    });
                    setJadwalBerdasarkanTanggal([]);
                  }}
                  className="text-sm h-9 sm:h-10"
                >
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daftar Banding Absen - Mobile Responsive */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">Riwayat Pengajuan Banding Absen</span>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs sm:text-sm text-gray-600 font-medium">
                  {bandingAbsen.length} banding
                </div>
                <div className="text-xs text-gray-500">
                  Halaman {bandingAbsenPage} dari {Math.ceil(bandingAbsen.length / itemsPerPage)}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bandingAbsen.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <MessageCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Belum Ada Banding</h3>
                <p className="text-sm sm:text-base text-gray-600">Kelas belum memiliki riwayat pengajuan banding absen</p>
              </div>
            ) : (
              <>
                {/* Mobile Card Layout */}
                <div className="block lg:hidden space-y-4">
                  {(() => {
                    // FIXED: Enhanced deduplication to prevent looping
                    const uniqueBandingAbsen = bandingAbsen.filter((banding, index, self) => {
                      // Use multiple fields to ensure uniqueness
                      const key = `${banding.id_banding}-${banding.tanggal_pengajuan}-${banding.siswa_id}`;
                      return self.findIndex(b => 
                        `${b.id_banding}-${b.tanggal_pengajuan}-${b.siswa_id}` === key
                      ) === index;
                    });
                    
                    return uniqueBandingAbsen
                      .slice((bandingAbsenPage - 1) * itemsPerPage, bandingAbsenPage * itemsPerPage)
                      .map((banding) => (
                        <Card key={banding.id_banding} className="border-l-4 border-l-orange-500">
                          <CardContent className="p-4 space-y-3">
                            {/* Header dengan tanggal */}
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {formatDateWIB(banding.tanggal_pengajuan)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatTime24(banding.tanggal_pengajuan)}
                                </div>
                              </div>
                              <Badge className={
                                banding.status_banding === 'disetujui' ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                                banding.status_banding === 'ditolak' ? 'bg-red-100 text-red-800 hover:bg-red-200' :
                                'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                              }>
                                {banding.status_banding === 'disetujui' ? 'Disetujui' :
                                 banding.status_banding === 'ditolak' ? 'Ditolak' : 'Menunggu'}
                              </Badge>
                            </div>

                            {/* Informasi jadwal */}
                            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">{formatDateWIB(banding.tanggal_absen)}</span>
                                <span className="text-xs text-gray-500">({banding.jam_mulai}-{banding.jam_selesai})</span>
                              </div>
                              <div className="text-sm">
                                <div className="font-medium">{banding.nama_mapel}</div>
                                <div className="text-gray-600">{banding.nama_guru}</div>
                                <div className="text-xs text-gray-500">{banding.nama_kelas}</div>
                              </div>
                            </div>

                            {/* Detail siswa */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">
                                  {banding.nama_siswa || 'Siswa Individual'}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedBanding(
                                    expandedBanding === banding.id_banding ? null : banding.id_banding
                                  )}
                                  className="h-6 w-6 p-0"
                                >
                                  {expandedBanding === banding.id_banding ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className="text-xs px-1 py-0"
                                >
                                  {banding.status_asli} → {banding.status_diajukan}
                                </Badge>
                              </div>
                            </div>

                            {/* Respon guru */}
                            {banding.catatan_guru && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="text-xs font-medium text-blue-700 mb-1">Respon Guru:</div>
                                <div className="text-xs text-blue-600 break-words">{banding.catatan_guru}</div>
                              </div>
                            )}

                            {/* Expanded Detail */}
                            {expandedBanding === banding.id_banding && (
                              <div className="border-t pt-3 space-y-3">
                                <div className="bg-white rounded-lg border p-3">
                                  <h4 className="font-semibold text-gray-800 mb-3 text-sm">Detail Siswa Banding</h4>
                                  
                                  <div className="grid grid-cols-1 gap-3">
                                    <div>
                                      <div className="text-xs font-medium text-gray-600 mb-1">Nama Siswa</div>
                                      <div className="text-sm text-gray-800">
                                        {banding.nama_siswa || 'Siswa Individual'}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <div className="text-xs font-medium text-gray-600 mb-1">Status Tercatat</div>
                                        <div className="text-sm text-gray-800 capitalize">{banding.status_asli}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs font-medium text-gray-600 mb-1">Status Diajukan</div>
                                        <div className="text-sm text-gray-800 capitalize">{banding.status_diajukan}</div>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-gray-600 mb-1">Alasan</div>
                                      <div className="text-sm text-gray-800">{banding.alasan_banding}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ));
                  })()}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal Pengajuan</TableHead>
                        <TableHead>Tanggal Absen</TableHead>
                        <TableHead>Jadwal</TableHead>
                        <TableHead>Detail Siswa & Alasan</TableHead>
                        <TableHead>Status Banding</TableHead>
                        <TableHead>Respon Guru</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        // FIXED: Enhanced deduplication to prevent looping
                        const uniqueBandingAbsen = bandingAbsen.filter((banding, index, self) => {
                          // Use multiple fields to ensure uniqueness
                          const key = `${banding.id_banding}-${banding.tanggal_pengajuan}-${banding.siswa_id}`;
                          return self.findIndex(b => 
                            `${b.id_banding}-${b.tanggal_pengajuan}-${b.siswa_id}` === key
                          ) === index;
                        });
                        
                        return uniqueBandingAbsen
                          .slice((bandingAbsenPage - 1) * itemsPerPage, bandingAbsenPage * itemsPerPage)
                          .map((banding) => (
                          <React.Fragment key={banding.id_banding}>
                          <TableRow className="hover:bg-gray-50">
                          <TableCell>
                              <div className="text-sm font-medium">
                            {formatDateWIB(banding.tanggal_pengajuan)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatTime24(banding.tanggal_pengajuan)}
                              </div>
                          </TableCell>
                          <TableCell>
                              <div className="text-sm font-medium">
                            {formatDateWIB(banding.tanggal_absen)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {banding.jam_mulai}-{banding.jam_selesai}
                            </div>
                          </TableCell>
                          <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium text-sm">{banding.nama_mapel}</div>
                                <div className="text-xs text-gray-600">
                                  {banding.nama_guru}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {banding.nama_kelas}
                                    </div>
                                    </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-700">
                                    1 siswa
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setExpandedBanding(
                                      expandedBanding === banding.id_banding ? null : banding.id_banding
                                    )}
                                    className="h-6 w-6 p-0"
                                  >
                                    {expandedBanding === banding.id_banding ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                <div className="text-xs text-gray-600 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {banding.nama_siswa || 'Siswa Individual'}
                                    </span>
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs px-1 py-0"
                                    >
                                      {banding.status_asli} → {banding.status_diajukan}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                                banding.status_banding === 'disetujui' ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                                banding.status_banding === 'ditolak' ? 'bg-red-100 text-red-800 hover:bg-red-200' :
                                'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            }>
                              {banding.status_banding === 'disetujui' ? 'Disetujui' :
                               banding.status_banding === 'ditolak' ? 'Ditolak' : 'Menunggu'}
                            </Badge>
                              {banding.tanggal_keputusan && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatDateWIB(banding.tanggal_keputusan)}
                                </div>
                              )}
                          </TableCell>
                          <TableCell>
                              <div className="max-w-xs">
                                {banding.catatan_guru ? (
                                  <div className="text-sm bg-gray-50 p-2 rounded border-l-2 border-gray-300">
                                    <div className="font-medium text-gray-700 mb-1">Respon Guru:</div>
                                    <div className="text-gray-600 break-words">{banding.catatan_guru}</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-sm">Belum ada respon</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpandedBanding(
                                  expandedBanding === banding.id_banding ? null : banding.id_banding
                                )}
                                className="text-xs"
                              >
                                {expandedBanding === banding.id_banding ? 'Tutup Detail' : 'Lihat Detail'}
                              </Button>
                            </TableCell>
                          </TableRow>
                          
                          {/* Expanded Detail Row */}
                          {expandedBanding === banding.id_banding && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-gray-50 p-0">
                                <div className="p-4">
                                  <div className="bg-white rounded-lg border p-4">
                                    <h4 className="font-semibold text-gray-800 mb-3">Detail Siswa Banding</h4>
                                    
                                    <div className="border rounded-lg p-3">
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div>
                                          <div className="text-sm font-medium text-gray-600 mb-1">Nama Siswa</div>
                                          <div className="text-sm text-gray-800">
                                            {banding.nama_siswa || 'Siswa Individual'}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-sm font-medium text-gray-600 mb-1">Status Tercatat</div>
                                          <div className="text-sm text-gray-800 capitalize">{banding.status_asli}</div>
                                        </div>
                                        <div>
                                          <div className="text-sm font-medium text-gray-600 mb-1">Status Diajukan</div>
                                          <div className="text-sm text-gray-800 capitalize">{banding.status_diajukan}</div>
                                        </div>
                                        <div>
                                          <div className="text-sm font-medium text-gray-600 mb-1">Alasan</div>
                                          <div className="text-sm text-gray-800">{banding.alasan_banding}</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          </React.Fragment>
                          ));
                        })()}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Pagination untuk Banding Absen - FIXED: Only show if there's data */}
                {bandingAbsen.length > 0 && (
                  <Pagination
                    currentPage={bandingAbsenPage}
                    totalPages={Math.ceil(bandingAbsen.length / itemsPerPage)}
                    onPageChange={setBandingAbsenPage}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Submit Banding Absen Kelas
  const submitBandingAbsen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siswaId) return;
    if (!selectedSiswaId) {
      toast({
        title: "Error",
        description: "Pilih siswa terlebih dahulu.",
        variant: "destructive"
      });
      return;
    }

    // Validasi field terisi
    if (!formBanding.jadwal_id || !formBanding.tanggal_absen || !formBanding.siswa_banding[0]?.status_asli || !formBanding.siswa_banding[0]?.status_diajukan || !formBanding.siswa_banding[0]?.alasan_banding) {
      toast({
        title: "Error",
        description: "Semua field wajib diisi.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Get and clean token with mobile fallback
      const rawToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      const cleanToken = rawToken ? rawToken.trim() : '';
      
      if (!cleanToken) {
        toast({
          title: "Error",
          description: "Token tidak ditemukan. Silakan login ulang.",
          variant: "destructive"
        });
        return;
      }
      
      const requestData = {
        jadwal_id: formBanding.jadwal_id ? Number.parseInt(formBanding.jadwal_id) : null,
        tanggal_absen: formBanding.tanggal_absen,
        status_asli: formBanding.siswa_banding[0]?.status_asli,
        status_diajukan: formBanding.siswa_banding[0]?.status_diajukan,
        alasan_banding: formBanding.siswa_banding[0]?.alasan_banding
      };
      
  
  
      
      const response = await fetch(getApiUrl(`/api/siswa/${selectedSiswaId}/banding-absen`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanToken}`
        },
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        toast({
          title: "Berhasil",
          description: "Pengajuan banding absen berhasil dikirim"
        });
        
        // Reset form dan reload data
        setFormBanding({
          jadwal_id: '',
          tanggal_absen: '',
          siswa_banding: [{
            nama: '',
            status_asli: 'alpa',
            status_diajukan: 'hadir',
            alasan_banding: ''
          }]
        });
        setSelectedSiswaId(null);
        setShowFormBanding(false);
        loadBandingAbsen();
      } else {
        const errorData = await response.json();
        console.error('❌ Error submitting banding absen:', errorData);
        toast({
          title: "Error",
          description: errorData.error || "Gagal mengirim pengajuan banding absen",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error submitting banding absen:', error);
      toast({
        title: "Error",
        description: "Terjadi kesalahan jaringan",
        variant: "destructive"
      });
    }
  };

  // Show loading or error states
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Memuat Data...</h3>
            <p className="text-gray-600">Sedang memuat informasi siswa</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 mx-auto text-red-500 mb-6" />
            <h3 className="text-xl font-bold text-gray-900 mb-3">Terjadi Kesalahan</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 text-sm font-medium mb-2">Pesan Error:</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={() => {
                  setError(null);
                  setInitialLoading(true);
                  // Retry the initial data fetch
                  globalThis.location.reload();
                }} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Coba Lagi
              </Button>
              
              <Button 
                onClick={onLogout} 
                variant="outline" 
                className="w-full"
              >
                🚪 Kembali ke Login
              </Button>
              
              {error.includes('server backend') && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-700 text-xs">
                    <strong>Tips:</strong> Pastikan server backend sudah berjalan di port 3001
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 overflow-x-hidden">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 bg-white shadow-xl transition-transform duration-300 z-40 w-64 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:w-64`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className={`flex items-center space-x-3`}>
            <div className="p-2 rounded-lg">
              <img src="/logo.png" alt="ABSENTA Logo" className="h-12 w-12" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent hidden lg:block">
              ABSENTA
            </span>
            {sidebarOpen && (
              <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent block lg:hidden">
                ABSENTA
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          <Button
            variant={activeTab === 'kehadiran' ? "default" : "ghost"}
            className={`w-full justify-start`}
            onClick={() => {setActiveTab('kehadiran'); setSidebarOpen(false);}}
          >
            <Clock className="h-4 w-4" />
            <span className="ml-2">Menu Kehadiran</span>
          </Button>
          <Button
            variant={activeTab === 'riwayat' ? "default" : "ghost"}
            className={`w-full justify-start`}
            onClick={() => {setActiveTab('riwayat'); setSidebarOpen(false);}}
          >
            <Calendar className="h-4 w-4" />
            <span className="ml-2">Riwayat</span>
          </Button>
          <Button
            variant={activeTab === 'banding-absen' ? "default" : "ghost"}
            className={`w-full justify-start`}
            onClick={() => {setActiveTab('banding-absen'); setSidebarOpen(false);}}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="ml-2">Banding Absen</span>
          </Button>
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          {/* Font Size Control - Above Profile */}
          {(sidebarOpen || window.innerWidth >= 1024) && (
            <div className="mb-4">
              <FontSizeControl variant="compact" />
            </div>
          )}
          
          <div className={`flex items-center space-x-3 mb-3`}>
            <div className="bg-emerald-100 p-2 rounded-full">
              <Settings className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{currentUserData.nama}</p>
              <p className="text-xs text-gray-500">Siswa Perwakilan</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Button
              onClick={() => setShowEditProfile(true)}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Settings className="h-4 w-4" />
              <span className="ml-2">Edit Profil</span>
            </Button>
            
            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-2">Keluar</span>
            </Button>
          </div>
        </div>
      </div>
 
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <div className="lg:ml-64 overflow-x-hidden">
        <div className="p-4 lg:p-6 min-w-0">
          {/* Mobile Header */}
          <div className="flex items-center justify-between mb-6 lg:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Dashboard Siswa</h1>
            <div className="w-10"></div> {/* Spacer for alignment */}
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:flex justify-between items-center mb-8 min-w-0">
            <div className="min-w-0">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent truncate">
                Dashboard Siswa
              </h1>
              <p className="text-gray-600 mt-2 truncate">Selamat datang, {currentUserData.nama}!</p>
              {kelasInfo && (
                <p className="text-sm text-gray-500 truncate">Perwakilan Kelas {kelasInfo}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {formatDateOnly(getWIBTime())}
              </Badge>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'kehadiran' && renderKehadiranContent()}
          {activeTab === 'riwayat' && renderRiwayatContent()}
          {activeTab === 'banding-absen' && renderBandingAbsenContent()}
        </div>
      </div>
      
      {/* Floating Font Size Control for Mobile */}
      <FontSizeControl variant="floating" className="lg:hidden" />
      
      {/* Absen Kelas Modal (Piket mengabsen siswa ketika guru tidak hadir) */}
      {showAbsenKelasModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-orange-600 text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Absensi Siswa</h2>
                  <p className="text-sm text-orange-100">
                    Guru {absenKelasGuruNama} tidak hadir - Diabsen oleh Piket
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAbsenKelasModal(false);
                    setAbsenKelasJadwalId(null);
                    setDaftarSiswaKelas([]);
                    setAbsenSiswaData({});
                  }}
                  className="p-1 hover:bg-orange-700 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {loadingAbsenKelas ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                  <span className="ml-2">Memuat daftar siswa...</span>
                </div>
              ) : daftarSiswaKelas.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Tidak ada siswa ditemukan</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <span>Total: {daftarSiswaKelas.length} siswa</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newData: {[key: number]: {status: string; keterangan: string}} = {};
                          daftarSiswaKelas.forEach(siswa => {
                            newData[siswa.id_siswa] = { status: 'Hadir', keterangan: '' };
                          });
                          setAbsenSiswaData(newData);
                        }}
                        className="text-xs"
                      >
                        Semua Hadir
                      </Button>
                    </div>
                  </div>
                  
                  {daftarSiswaKelas.map((siswa, index) => (
                    <div key={siswa.id_siswa} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs text-gray-500 mr-2">{index + 1}.</span>
                          <span className="font-medium">{siswa.nama}</span>
                          <span className="text-xs text-gray-500 ml-2">({siswa.nis})</span>
                          {siswa.jabatan && (
                            <Badge variant="secondary" className="ml-2 text-xs">{siswa.jabatan}</Badge>
                          )}
                        </div>
                        <Badge className={`text-xs ${
                          siswa.jenis_kelamin === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                        }`}>
                          {siswa.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-5 gap-1">
                        {['Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispen'].map(status => (
                          <button
                            key={status}
                            onClick={() => setAbsenSiswaData(prev => ({
                              ...prev,
                              [siswa.id_siswa]: { ...prev[siswa.id_siswa], status }
                            }))}
                            className={`px-2 py-1 text-xs rounded border ${
                              absenSiswaData[siswa.id_siswa]?.status === status
                                ? status === 'Hadir' ? 'bg-green-500 text-white border-green-500'
                                : status === 'Alpa' ? 'bg-red-500 text-white border-red-500'
                                : 'bg-yellow-500 text-white border-yellow-500'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t p-4 bg-gray-50">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAbsenKelasModal(false);
                    setAbsenKelasJadwalId(null);
                    setDaftarSiswaKelas([]);
                    setAbsenSiswaData({});
                  }}
                >
                  Batal
                </Button>
                <Button
                  onClick={submitAbsenKelas}
                  disabled={loadingAbsenKelas || daftarSiswaKelas.length === 0}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {loadingAbsenKelas ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Simpan Absensi
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <EditProfile
          userData={currentUserData}
          onUpdate={handleUpdateProfile}
          onClose={() => setShowEditProfile(false)}
          role="siswa"
        />
      )}
    </div>
  );
};
