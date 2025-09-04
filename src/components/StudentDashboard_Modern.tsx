import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { FontSizeControl } from '@/components/ui/font-size-control';
import { 
  LogOut, Clock, User, BookOpen, CheckCircle2, XCircle, Calendar, Save,
  GraduationCap, Settings, Menu, X, Home, Users, FileText, Send, AlertCircle, MessageCircle, Eye, Plus
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

interface PengajuanIzin {
  id_pengajuan: number;
  jadwal_id: number;
  tanggal_izin: string;
  jenis_izin: 'sakit' | 'izin' | 'alpa' | 'dispen';
  alasan: string;
  bukti_pendukung?: string;
  status: 'pending' | 'disetujui' | 'ditolak';
  keterangan_guru?: string;
  tanggal_pengajuan: string;
  tanggal_respon?: string;
  nama_mapel: string;
  nama_guru: string;
  jam_mulai: string;
  jam_selesai: string;
  // Data untuk kelas
  siswa_izin?: Array<{
    nama: string;
    jenis_izin: 'sakit' | 'izin' | 'alpa' | 'dispen';
    alasan: string;
    bukti_pendukung?: string;
  }>;
  total_siswa_izin?: number;
}

interface BandingAbsen {
  id_banding: number;
  siswa_id: number;
  jadwal_id: number;
  tanggal_absen: string;
  status_asli: 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen';
  status_diajukan: 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen';
  alasan_banding: string;
  bukti_pendukung?: string;
  status_banding: 'pending' | 'disetujui' | 'ditolak';
  catatan_guru?: string;
  tanggal_pengajuan: string;
  tanggal_keputusan?: string;
  nama_mapel?: string;
  nama_guru?: string;
  jam_mulai?: string;
  jam_selesai?: string;
  nama_kelas?: string;
  // Data untuk banding kelas
  siswa_banding?: Array<{
    nama: string;
    status_asli: 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen';
    status_diajukan: 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen';
    alasan_banding: string;
    bukti_pendukung?: string;
  }>;
  total_siswa_banding?: number;
}

interface StudentDashboardProps {
  userData: {
    id: number;
    username: string;
    nama: string;
    role: string;
  };
  onLogout: () => void;
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
  status_kehadiran: string;
}

interface KehadiranData {
  [jadwal_id: number]: {
    status: string;
    keterangan: string;
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
    total_siswa: number;
    total_hadir: number;
    total_izin: number;
    total_sakit: number;
    total_alpa: number;
    siswa_tidak_hadir?: Array<{
      nama_siswa: string;
      nis: string;
      status: string;
      keterangan?: string;
      nama_pencatat?: string;
    }>;
  }>;
}

export const StudentDashboard = ({ userData, onLogout }: StudentDashboardProps) => {
  console.log('StudentDashboard: Component mounting/rendering with user:', userData);
  
  const [activeTab, setActiveTab] = useState('kehadiran');
  const [jadwalHariIni, setJadwalHariIni] = useState<JadwalHariIni[]>([]);
  const [kehadiranData, setKehadiranData] = useState<KehadiranData>({});
  const [riwayatData, setRiwayatData] = useState<RiwayatData[]>([]);
  const [pengajuanIzin, setPengajuanIzin] = useState<PengajuanIzin[]>([]);
  const [bandingAbsen, setBandingAbsen] = useState<BandingAbsen[]>([]);
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
  
  // State untuk form pengajuan izin kelas
  const [formIzin, setFormIzin] = useState({
    jadwal_id: '',
    tanggal_izin: '',
    siswa_izin: [] as Array<{
      nama: string;
      jenis_izin: 'sakit' | 'izin' | 'alpa' | 'dispen';
      alasan: string;
      bukti_pendukung?: string;
    }>
  });
  const [showFormIzin, setShowFormIzin] = useState(false);
  const [showFormBanding, setShowFormBanding] = useState(false);
  const [daftarSiswa, setDaftarSiswa] = useState<Array<{id: number; nama: string}>>([]);
  
  // State untuk form banding absen kelas
  const [formBanding, setFormBanding] = useState({
    jadwal_id: '',
    tanggal_absen: '',
    siswa_banding: [] as Array<{
      nama: string;
      status_asli: 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen';
      status_diajukan: 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen';
      alasan_banding: string;
      bukti_pendukung?: string;
    }>
  });

  console.log('StudentDashboard: Current state - siswaId:', siswaId, 'initialLoading:', initialLoading, 'error:', error);

  // Get siswa perwakilan info
  useEffect(() => {
    console.log('StudentDashboard: Starting to fetch siswa info...');
    
    const getSiswaInfo = async () => {
      try {
        setInitialLoading(true);
        setError(null);
        
        console.log('StudentDashboard: Making fetch request to /api/siswa-perwakilan/info');
        
        const response = await fetch('http://localhost:3001/api/siswa-perwakilan/info', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        console.log('StudentDashboard: Response status:', response.status);
        console.log('StudentDashboard: Response ok:', response.ok);
        
        if (response.ok) {
          const data = await response.json();
          console.log('StudentDashboard: Received data:', data);
          
          if (data.success) {
            setSiswaId(data.id_siswa);
            setKelasInfo(data.nama_kelas);
            console.log('StudentDashboard: Set siswaId to:', data.id_siswa, 'kelasInfo to:', data.nama_kelas);
          } else {
            setError(data.error || 'Data siswa tidak valid');
          }
        } else {
          let errorMessage = 'Gagal memuat informasi siswa';
          
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.log('Could not parse error response');
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
          errorMessage += 'Tidak dapat terhubung ke server. Pastikan server backend sedang berjalan di http://localhost:3001';
        } else {
          errorMessage += 'Silakan periksa koneksi internet Anda dan coba lagi.';
        }
        
        setError(errorMessage);
      } finally {
        setInitialLoading(false);
        console.log('StudentDashboard: Finished loading initial data');
      }
    };

    getSiswaInfo();
  }, [onLogout]);

  // Load jadwal hari ini
  const loadJadwalHariIni = useCallback(async () => {
    if (!siswaId) return;

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/siswa/${siswaId}/jadwal-hari-ini`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('StudentDashboard: Loaded jadwal hari ini:', data);
        setJadwalHariIni(data);
        
        // Initialize kehadiran data
        const initialKehadiran: KehadiranData = {};
        data.forEach((jadwal: JadwalHariIni) => {
          if (jadwal.status_kehadiran && jadwal.status_kehadiran !== 'belum_diambil') {
            initialKehadiran[jadwal.id_jadwal] = {
              status: jadwal.status_kehadiran,
              keterangan: ''
            };
          } else {
            initialKehadiran[jadwal.id_jadwal] = {
              status: 'hadir',
              keterangan: ''
            };
          }
        });
        setKehadiranData(initialKehadiran);
      } else {
        const errorData = await response.json();
        toast({
          title: "Error memuat jadwal",
          description: errorData.error || 'Failed to load schedule',
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

  // Load daftar siswa kelas
  const loadDaftarSiswa = useCallback(async () => {
    if (!siswaId) return;

    try {
      const response = await fetch(`http://localhost:3001/api/siswa/${siswaId}/daftar-siswa`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('StudentDashboard: Loaded daftar siswa:', data);
        setDaftarSiswa(data);
      } else {
        const errorData = await response.json();
        console.error('Error loading daftar siswa:', errorData);
      }
    } catch (error) {
      console.error('Error loading daftar siswa:', error);
    }
  }, [siswaId]);

  // Load riwayat data
  const loadRiwayatData = useCallback(async () => {
    if (!siswaId) return;

    try {
      const response = await fetch(`http://localhost:3001/api/siswa/${siswaId}/riwayat-kehadiran`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('StudentDashboard: Loaded riwayat data:', data);
        setRiwayatData(data);
      } else {
        const errorData = await response.json();
        console.error('Error loading riwayat:', errorData);
      }
    } catch (error) {
      console.error('Error loading riwayat:', error);
    }
  }, [siswaId]);

  // Load pengajuan izin data
  const loadPengajuanIzin = useCallback(async () => {
    if (!siswaId) return;

    try {
      const response = await fetch(`http://localhost:3001/api/siswa/${siswaId}/pengajuan-izin`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('StudentDashboard: Loaded pengajuan izin data:', data);
        setPengajuanIzin(data);
      } else {
        const errorData = await response.json();
        console.error('Error loading pengajuan izin:', errorData);
      }
    } catch (error) {
      console.error('Error loading pengajuan izin:', error);
    }
  }, [siswaId]);

  // Submit pengajuan izin kelas
  const submitPengajuanIzin = async () => {
    if (!siswaId || formIzin.siswa_izin.length === 0) return;

    try {
      const response = await fetch(`http://localhost:3001/api/siswa/${siswaId}/pengajuan-izin-kelas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          jadwal_id: parseInt(formIzin.jadwal_id),
          tanggal_izin: formIzin.tanggal_izin,
          siswa_izin: formIzin.siswa_izin
        })
      });

      if (response.ok) {
        toast({
          title: "Berhasil",
          description: "Pengajuan izin kelas berhasil dikirim"
        });
        
        // Reset form dan reload data
        setFormIzin({
          jadwal_id: '',
          tanggal_izin: '',
          siswa_izin: []
        });
        setShowFormIzin(false);
        loadPengajuanIzin();
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Gagal mengirim pengajuan izin",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error submitting pengajuan izin:', error);
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat mengirim pengajuan",
        variant: "destructive"
      });
    }
  };

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

  useEffect(() => {
    if (siswaId && activeTab === 'pengajuan-izin') {
      loadPengajuanIzin();
      loadDaftarSiswa();
    }
  }, [siswaId, activeTab, loadPengajuanIzin, loadDaftarSiswa]);

  // Load Banding Absen
  const loadBandingAbsen = useCallback(async () => {
    if (!siswaId) return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/siswa/${siswaId}/banding-absen`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBandingAbsen(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading banding absen:', error);
    }
  }, [siswaId]);

  useEffect(() => {
    if (siswaId && activeTab === 'banding-absen') {
      loadBandingAbsen();
      loadDaftarSiswa();
    }
  }, [siswaId, activeTab, loadBandingAbsen, loadDaftarSiswa]);

  // Submit kehadiran guru
  const submitKehadiran = async () => {
    if (!siswaId) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/siswa/submit-kehadiran-guru', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          siswa_id: siswaId,
          kehadiran_data: kehadiranData
        })
      });

      if (response.ok) {
        toast({
          title: "Berhasil!",
          description: "Data kehadiran guru berhasil disimpan"
        });
        
        // Reload jadwal to get updated status
        loadJadwalHariIni();
      } else {
        const errorData = await response.json();
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

  const updateKehadiranStatus = (jadwalId: number, status: string) => {
    setKehadiranData(prev => ({
      ...prev,
      [jadwalId]: {
        ...prev[jadwalId],
        status: status
      }
    }));
  };

  const updateKehadiranKeterangan = (jadwalId: number, keterangan: string) => {
    setKehadiranData(prev => ({
      ...prev,
      [jadwalId]: {
        ...prev[jadwalId],
        keterangan: keterangan
      }
    }));
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'hadir': return 'bg-green-100 text-green-800';
      case 'tidak_hadir': return 'bg-red-100 text-red-800';
      case 'izin': return 'bg-yellow-100 text-yellow-800';
      case 'sakit': return 'bg-blue-100 text-blue-800';
      case 'belum_diambil': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderKehadiranContent = () => {
    if (loading) {
      return (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse bg-gray-200 h-24 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (jadwalHariIni.length === 0) {
      return (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Tidak Ada Jadwal Hari Ini</h3>
            <p className="text-gray-600">Selamat beristirahat! Tidak ada mata pelajaran yang terjadwal untuk hari ini.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Jadwal Hari Ini - {kelasInfo}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jadwalHariIni.map((jadwal, index) => (
                <div key={jadwal.id_jadwal} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">Jam ke-{jadwal.jam_ke}</Badge>
                        <Badge variant="outline">{jadwal.jam_mulai} - {jadwal.jam_selesai}</Badge>
                        <Badge className={getStatusBadgeColor(kehadiranData[jadwal.id_jadwal]?.status || jadwal.status_kehadiran || 'belum_diambil')}>
                          {(() => {
                            const status = kehadiranData[jadwal.id_jadwal]?.status || jadwal.status_kehadiran || 'belum_diambil';
                            switch (status.toLowerCase()) {
                              case 'hadir': return 'Hadir';
                              case 'tidak_hadir': return 'Tidak Hadir';
                              case 'izin': return 'Izin';
                              case 'sakit': return 'Sakit';
                              case 'belum_diambil': return 'Belum Diambil';
                              default: return status;
                            }
                          })()}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-lg text-gray-900">{jadwal.nama_mapel}</h4>
                      <p className="text-gray-600">{jadwal.nama_guru}</p>
                      <p className="text-sm text-gray-500">NIP: {jadwal.nip}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-3 block">
                        Status Kehadiran Guru:
                      </Label>
                      <RadioGroup 
                        value={kehadiranData[jadwal.id_jadwal]?.status || 'hadir'} 
                        onValueChange={(value) => updateKehadiranStatus(jadwal.id_jadwal, value)}
                        disabled={jadwal.status_kehadiran && jadwal.status_kehadiran !== 'belum_diambil'}
                      >
                        <div className="flex flex-wrap gap-6">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="hadir" id={`hadir-${jadwal.id_jadwal}`} />
                            <Label htmlFor={`hadir-${jadwal.id_jadwal}`} className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              Hadir
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="tidak_hadir" id={`tidak_hadir-${jadwal.id_jadwal}`} />
                            <Label htmlFor={`tidak_hadir-${jadwal.id_jadwal}`} className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-red-600" />
                              Tidak Hadir
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="izin" id={`izin-${jadwal.id_jadwal}`} />
                            <Label htmlFor={`izin-${jadwal.id_jadwal}`} className="flex items-center gap-2">
                              <User className="w-4 h-4 text-yellow-600" />
                              Izin
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="sakit" id={`sakit-${jadwal.id_jadwal}`} />
                            <Label htmlFor={`sakit-${jadwal.id_jadwal}`} className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-blue-600" />
                              Sakit
                            </Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    {kehadiranData[jadwal.id_jadwal]?.status !== 'hadir' && (
                      <div>
                        <Label htmlFor={`keterangan-${jadwal.id_jadwal}`} className="text-sm font-medium text-gray-700">
                          Keterangan:
                        </Label>
                        <Textarea
                          id={`keterangan-${jadwal.id_jadwal}`}
                          placeholder="Masukkan keterangan jika diperlukan..."
                          value={kehadiranData[jadwal.id_jadwal]?.keterangan || ''}
                          onChange={(e) => updateKehadiranKeterangan(jadwal.id_jadwal, e.target.value)}
                          disabled={jadwal.status_kehadiran && jadwal.status_kehadiran !== 'belum_diambil'}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t">
              <Button 
                onClick={submitKehadiran} 
                disabled={loading} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Menyimpan...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Simpan Data Kehadiran
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
          <CardContent className="p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Belum Ada Riwayat</h3>
            <p className="text-gray-600">Riwayat kehadiran kelas akan muncul setelah ada data absensi.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <p className="text-blue-800 font-medium">Riwayat Kehadiran Kelas</p>
          </div>
          <p className="text-blue-700 text-sm mt-1">Sebagai perwakilan kelas, Anda dapat melihat ringkasan kehadiran seluruh siswa</p>
        </div>

        {riwayatData.map((hari, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {new Date(hari.tanggal).toLocaleDateString('id-ID', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jam Ke</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Mata Pelajaran</TableHead>
                    <TableHead>Guru</TableHead>
                    <TableHead>Total Hadir</TableHead>
                    <TableHead>Tidak Hadir</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hari.jadwal.map((jadwal, jadwalIndex) => (
                    <TableRow key={jadwalIndex}>
                      <TableCell>
                        <Badge variant="outline">Jam ke-{jadwal.jam_ke}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{jadwal.jam_mulai} - {jadwal.jam_selesai}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{jadwal.nama_mapel}</span>
                      </TableCell>
                      <TableCell>
                        <span>{jadwal.nama_guru}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800">
                            {jadwal.total_hadir}/{jadwal.total_siswa}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
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
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            console.log('Detail jadwal:', jadwal);
                            console.log('Jadwal keys:', Object.keys(jadwal));
                            console.log('Jadwal.siswa_tidak_hadir:', jadwal.siswa_tidak_hadir);
                            if (jadwal.siswa_tidak_hadir && jadwal.siswa_tidak_hadir.length > 0) {
                              console.log('Contoh siswa pertama:', jadwal.siswa_tidak_hadir[0]);
                              console.log('Siswa pertama keys:', Object.keys(jadwal.siswa_tidak_hadir[0]));
                            }
                            setDetailRiwayat(jadwal);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

        {/* Modal Detail Riwayat */}
        {detailRiwayat && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              {console.log('Modal detailRiwayat:', detailRiwayat)}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Detail Kehadiran - Jam ke-{detailRiwayat.jam_ke}</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setDetailRiwayat(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  {detailRiwayat.nama_mapel} ({detailRiwayat.jam_mulai} - {detailRiwayat.jam_selesai})
                </p>
                <p className="text-sm text-gray-600">Guru: {detailRiwayat.nama_guru}</p>
              </div>

              {detailRiwayat.siswa_tidak_hadir && Array.isArray(detailRiwayat.siswa_tidak_hadir) && detailRiwayat.siswa_tidak_hadir.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-medium">Siswa Tidak Hadir:</h4>
                  {console.log('Siswa tidak hadir:', detailRiwayat.siswa_tidak_hadir)}
                  {detailRiwayat.siswa_tidak_hadir.map((siswa, idx) => {
                    console.log('Siswa individual:', siswa);
                    console.log('Siswa keys:', Object.keys(siswa));
                    console.log('Siswa.nama_siswa:', siswa.nama_siswa);
                    console.log('Siswa.nis:', siswa.nis);
                    console.log('Siswa.status:', siswa.status);
                    
                    // Coba berbagai kemungkinan field untuk nama dan NIS
                    const namaSiswa = siswa.nama_siswa || siswa.nama || siswa.nama_lengkap || siswa.nama_siswa_lengkap || 'Nama tidak tersedia';
                    const nisSiswa = siswa.nis || siswa.nis_siswa || siswa.nomor_induk || siswa.nomor_induk_siswa || siswa.nis_lengkap || 'NIS tidak tersedia';
                    const statusSiswa = siswa.status || siswa.status_kehadiran || 'Status tidak tersedia';
                    
                    return (
                      <div key={idx} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">
                              {namaSiswa}
                            </p>
                            <p className="text-sm text-gray-600">
                              NIS: {nisSiswa}
                            </p>
                          </div>
                          <Badge 
                            variant={
                              statusSiswa === 'izin' ? 'secondary' :
                              statusSiswa === 'sakit' ? 'outline' : 'destructive'
                            }
                            className="capitalize"
                          >
                            {statusSiswa}
                          </Badge>
                        </div>
                        {siswa.keterangan && (
                          <p className="text-sm text-gray-600 mt-2">
                            <strong>Keterangan:</strong> {siswa.keterangan}
                          </p>
                        )}
                        {siswa.nama_pencatat && (
                          <p className="text-xs text-gray-500 mt-1">
                            Dicatat oleh: {siswa.nama_pencatat}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-2" />
                  <p className="text-green-600 font-medium">Semua siswa hadir</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Pengajuan Izin Content untuk Kelas
  const renderPengajuanIzinContent = () => {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pengajuan Izin Kelas</h2>
            <p className="text-gray-600">Ajukan izin ketidakhadiran untuk siswa-siswa dalam kelas</p>
          </div>
          <Button 
            onClick={() => setShowFormIzin(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4 mr-2" />
            Ajukan Izin Kelas
          </Button>
        </div>

        {/* Form Pengajuan Izin Kelas */}
        {showFormIzin && (
          <Card>
            <CardHeader>
              <CardTitle>Form Pengajuan Izin Kelas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="jadwal">Jadwal Pelajaran</Label>
                  <select 
                    id="jadwal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formIzin.jadwal_id}
                    onChange={(e) => setFormIzin({...formIzin, jadwal_id: e.target.value})}
                  >
                    <option value="">Pilih jadwal pelajaran...</option>
                    {jadwalHariIni.map((jadwal) => (
                      <option key={jadwal.id_jadwal} value={jadwal.id_jadwal}>
                        {jadwal.nama_mapel} - {jadwal.nama_guru} (Jam {jadwal.jam_ke}: {jadwal.jam_mulai}-{jadwal.jam_selesai})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="tanggal_izin">Tanggal Izin</Label>
                  <input
                    id="tanggal_izin"
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formIzin.tanggal_izin}
                    onChange={(e) => setFormIzin({...formIzin, tanggal_izin: e.target.value})}
                  />
                </div>
              </div>

              {/* Pilihan Siswa */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-lg font-semibold">Siswa yang Izin</Label>
                  <Button
                    type="button"
                    onClick={() => {
                      setFormIzin({
                        ...formIzin,
                        siswa_izin: [...formIzin.siswa_izin, {
                          nama: '',
                          jenis_izin: 'izin',
                          alasan: '',
                          bukti_pendukung: ''
                        }]
                      });
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Siswa
                  </Button>
                </div>

                <div className="space-y-3">
                  {formIzin.siswa_izin.map((siswa, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Siswa {index + 1}</span>
                        <Button
                          type="button"
                          onClick={() => {
                            const newSiswaIzin = formIzin.siswa_izin.filter((_, i) => i !== index);
                            setFormIzin({...formIzin, siswa_izin: newSiswaIzin});
                          }}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label>Nama Siswa</Label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            value={siswa.nama}
                            onChange={(e) => {
                              const newSiswaIzin = [...formIzin.siswa_izin];
                              newSiswaIzin[index] = {...newSiswaIzin[index], nama: e.target.value};
                              setFormIzin({...formIzin, siswa_izin: newSiswaIzin});
                            }}
                          >
                            <option value="">Pilih siswa...</option>
                            {daftarSiswa.map((s) => (
                              <option key={s.id} value={s.nama}>
                                {s.nama}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label>Jenis Izin</Label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            value={siswa.jenis_izin}
                            onChange={(e) => {
                              const newSiswaIzin = [...formIzin.siswa_izin];
                              newSiswaIzin[index] = {...newSiswaIzin[index], jenis_izin: e.target.value as 'sakit' | 'izin' | 'alpa' | 'dispen'};
                              setFormIzin({...formIzin, siswa_izin: newSiswaIzin});
                            }}
                          >
                            <option value="izin">Izin</option>
                            <option value="sakit">Sakit</option>
                            <option value="alpa">Alpa</option>
                            <option value="dispen">Dispen</option>
                          </select>
                        </div>

                        <div>
                          <Label>Alasan</Label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Alasan izin..."
                            value={siswa.alasan}
                            onChange={(e) => {
                              const newSiswaIzin = [...formIzin.siswa_izin];
                              newSiswaIzin[index] = {...newSiswaIzin[index], alasan: e.target.value};
                              setFormIzin({...formIzin, siswa_izin: newSiswaIzin});
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {formIzin.siswa_izin.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Belum ada siswa yang dipilih untuk izin.
                      <br />
                      Klik "Tambah Siswa" untuk menambahkan siswa.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={submitPengajuanIzin}
                  disabled={!formIzin.jadwal_id || !formIzin.tanggal_izin || formIzin.siswa_izin.length === 0 || formIzin.siswa_izin.some(s => !s.nama || !s.alasan)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Kirim Pengajuan ({formIzin.siswa_izin.length} siswa)
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowFormIzin(false);
                    setFormIzin({
                      jadwal_id: '',
                      tanggal_izin: '',
                      siswa_izin: []
                    });
                  }}
                >
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daftar Pengajuan Izin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Riwayat Pengajuan Izin Kelas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pengajuanIzin.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Belum Ada Pengajuan</h3>
                <p className="text-gray-600">Kelas belum memiliki riwayat pengajuan izin</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal Pengajuan</TableHead>
                      <TableHead>Tanggal Izin</TableHead>
                      <TableHead>Jadwal</TableHead>
                      <TableHead>Siswa Izin</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pengajuanIzin.map((izin) => (
                      <TableRow key={izin.id_pengajuan}>
                        <TableCell>
                          {new Date(izin.tanggal_pengajuan).toLocaleDateString('id-ID')}
                        </TableCell>
                        <TableCell>
                          {new Date(izin.tanggal_izin).toLocaleDateString('id-ID')}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="font-medium">{izin.nama_mapel}</span>
                            <div className="text-sm text-gray-600">
                              {izin.nama_guru} • {izin.jam_mulai}-{izin.jam_selesai}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {izin.siswa_izin && izin.siswa_izin.length > 0 ? (
                            <div className="space-y-1">
                              <div className="font-medium text-sm">
                                {izin.total_siswa_izin || izin.siswa_izin.length} siswa
                              </div>
                              <div className="text-xs text-gray-600 max-w-xs">
                                {izin.siswa_izin.slice(0, 3).map((s, idx) => (
                                  <div key={idx}>
                                    {s.nama} ({s.jenis_izin})
                                  </div>
                                ))}
                                {izin.siswa_izin.length > 3 && (
                                  <div className="text-blue-600">
                                    +{izin.siswa_izin.length - 3} lainnya
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline" className={
                              izin.jenis_izin === 'sakit' ? 'bg-red-50 text-red-700' :
                              izin.jenis_izin === 'izin' ? 'bg-blue-50 text-blue-700' :
                              izin.jenis_izin === 'dispen' ? 'bg-purple-50 text-purple-700' :
                              'bg-gray-50 text-gray-700'
                            }>
                              {izin.jenis_izin.charAt(0).toUpperCase() + izin.jenis_izin.slice(1)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            izin.status === 'disetujui' ? 'bg-green-100 text-green-800' :
                            izin.status === 'ditolak' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }>
                            {izin.status === 'disetujui' ? 'Disetujui' :
                             izin.status === 'ditolak' ? 'Ditolak' : 'Menunggu'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 max-w-sm">
                            {izin.siswa_izin && izin.siswa_izin.length > 0 ? (
                              <div className="text-sm space-y-1">
                                {izin.siswa_izin.slice(0, 2).map((s, idx) => (
                                  <div key={idx} className="text-xs bg-gray-50 p-1 rounded">
                                    <strong>{s.nama}:</strong> {s.alasan}
                                  </div>
                                ))}
                                {izin.siswa_izin.length > 2 && (
                                  <div className="text-xs text-blue-600">
                                    +{izin.siswa_izin.length - 2} alasan lainnya
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm">{izin.alasan}</div>
                            )}
                            {izin.keterangan_guru && (
                              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                <strong>Respon Guru:</strong> {izin.keterangan_guru}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render Banding Absen Content
  // Render Banding Absen Content untuk Kelas
  const renderBandingAbsenContent = () => {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pengajuan Banding Absen Kelas</h2>
            <p className="text-gray-600">Ajukan banding absensi untuk siswa-siswa dalam kelas</p>
          </div>
          <Button 
            onClick={() => setShowFormBanding(true)}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Ajukan Banding Kelas
          </Button>
        </div>

        {/* Form Pengajuan Banding Kelas */}
        {showFormBanding && (
          <Card>
            <CardHeader>
              <CardTitle>Form Pengajuan Banding Absen Kelas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="jadwal_banding">Jadwal Pelajaran</Label>
                  <select 
                    id="jadwal_banding"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formBanding.jadwal_id}
                    onChange={(e) => setFormBanding({...formBanding, jadwal_id: e.target.value})}
                  >
                    <option value="">Pilih jadwal pelajaran...</option>
                    {riwayatData.flatMap(hari => 
                      hari.jadwal.map(j => (
                        <option key={`${hari.tanggal}-${j.jam_ke}`} value={j.jadwal_id || `${hari.tanggal}-${j.jam_ke}`}>
                          {hari.tanggal} - {j.nama_mapel} ({j.jam_mulai}-{j.jam_selesai}) - {j.nama_guru}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="tanggal_banding">Tanggal Absen</Label>
                  <input
                    id="tanggal_banding"
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formBanding.tanggal_absen}
                    onChange={(e) => setFormBanding({...formBanding, tanggal_absen: e.target.value})}
                  />
                </div>
              </div>

              {/* Pilihan Siswa untuk Banding */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-lg font-semibold">Siswa yang Ajukan Banding</Label>
                  <Button
                    type="button"
                    onClick={() => {
                      setFormBanding({
                        ...formBanding,
                        siswa_banding: [...formBanding.siswa_banding, {
                          nama: '',
                          status_asli: 'alpa',
                          status_diajukan: 'hadir',
                          alasan_banding: '',
                          bukti_pendukung: ''
                        }]
                      });
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Siswa
                  </Button>
                </div>

                <div className="space-y-3">
                  {formBanding.siswa_banding.map((siswa, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Siswa {index + 1}</span>
                        <Button
                          type="button"
                          onClick={() => {
                            const newSiswaBanding = formBanding.siswa_banding.filter((_, i) => i !== index);
                            setFormBanding({...formBanding, siswa_banding: newSiswaBanding});
                          }}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <Label>Nama Siswa</Label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Masukkan nama siswa..."
                            value={siswa.nama}
                            onChange={(e) => {
                              const newSiswaBanding = [...formBanding.siswa_banding];
                              newSiswaBanding[index] = {...newSiswaBanding[index], nama: e.target.value};
                              setFormBanding({...formBanding, siswa_banding: newSiswaBanding});
                            }}
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            Masukkan nama siswa dari kelas untuk pengajuan banding absen
                          </div>
                        </div>

                        <div>
                          <Label>Status Tercatat</Label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            value={siswa.status_asli}
                            onChange={(e) => {
                              const newSiswaBanding = [...formBanding.siswa_banding];
                              newSiswaBanding[index] = {...newSiswaBanding[index], status_asli: e.target.value as 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen'};
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

                        <div>
                          <Label>Status Diajukan</Label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            value={siswa.status_diajukan}
                            onChange={(e) => {
                              const newSiswaBanding = [...formBanding.siswa_banding];
                              newSiswaBanding[index] = {...newSiswaBanding[index], status_diajukan: e.target.value as 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dispen'};
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

                        <div>
                          <Label>Alasan Banding</Label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Alasan banding..."
                            value={siswa.alasan_banding}
                            onChange={(e) => {
                              const newSiswaBanding = [...formBanding.siswa_banding];
                              newSiswaBanding[index] = {...newSiswaBanding[index], alasan_banding: e.target.value};
                              setFormBanding({...formBanding, siswa_banding: newSiswaBanding});
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {formBanding.siswa_banding.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Belum ada siswa yang dipilih untuk banding absen.
                      <br />
                      Klik "Tambah Siswa" untuk menambahkan siswa.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={submitBandingAbsen}
                  disabled={!formBanding.jadwal_id || !formBanding.tanggal_absen || formBanding.siswa_banding.length === 0 || formBanding.siswa_banding.some(s => !s.nama || !s.alasan_banding)}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Kirim Banding ({formBanding.siswa_banding.length} siswa)
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowFormBanding(false);
                    setFormBanding({
                      jadwal_id: '',
                      tanggal_absen: '',
                      siswa_banding: []
                    });
                  }}
                >
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daftar Banding Absen Kelas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Riwayat Pengajuan Banding Absen Kelas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bandingAbsen.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Belum Ada Banding</h3>
                <p className="text-gray-600">Kelas belum memiliki riwayat pengajuan banding absen</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal Pengajuan</TableHead>
                      <TableHead>Tanggal Absen</TableHead>
                      <TableHead>Jadwal</TableHead>
                      <TableHead>Siswa Banding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bandingAbsen.map((banding) => (
                      <TableRow key={banding.id_banding}>
                        <TableCell>
                          {new Date(banding.tanggal_pengajuan).toLocaleDateString('id-ID')}
                        </TableCell>
                        <TableCell>
                          {new Date(banding.tanggal_absen).toLocaleDateString('id-ID')}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="font-medium">{banding.nama_mapel}</span>
                            <div className="text-sm text-gray-600">
                              {banding.nama_guru} • {banding.jam_mulai}-{banding.jam_selesai}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {banding.siswa_banding && banding.siswa_banding.length > 0 ? (
                            <div className="space-y-1">
                              <div className="font-medium text-sm">
                                {banding.total_siswa_banding || banding.siswa_banding.length} siswa
                              </div>
                              <div className="text-xs text-gray-600 max-w-xs">
                                {banding.siswa_banding.slice(0, 3).map((s, idx) => (
                                  <div key={idx}>
                                    {s.nama} ({s.status_asli} → {s.status_diajukan})
                                  </div>
                                ))}
                                {banding.siswa_banding.length > 3 && (
                                  <div className="text-orange-600">
                                    +{banding.siswa_banding.length - 3} lainnya
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm space-y-1">
                              <Badge variant="outline" className="capitalize">
                                {banding.status_asli} → {banding.status_diajukan}
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            banding.status_banding === 'disetujui' ? 'bg-green-100 text-green-800' :
                            banding.status_banding === 'ditolak' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }>
                            {banding.status_banding === 'disetujui' ? 'Disetujui' :
                             banding.status_banding === 'ditolak' ? 'Ditolak' : 'Menunggu'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 max-w-sm">
                            {banding.siswa_banding && banding.siswa_banding.length > 0 ? (
                              <div className="text-sm space-y-1">
                                {banding.siswa_banding.slice(0, 2).map((s, idx) => (
                                  <div key={idx} className="text-xs bg-gray-50 p-1 rounded">
                                    <strong>{s.nama}:</strong> {s.alasan_banding}
                                  </div>
                                ))}
                                {banding.siswa_banding.length > 2 && (
                                  <div className="text-xs text-orange-600">
                                    +{banding.siswa_banding.length - 2} alasan lainnya
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm">{banding.alasan_banding}</div>
                            )}
                            {banding.catatan_guru && (
                              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                <strong>Respon Guru:</strong> {banding.catatan_guru}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Submit Banding Absen Kelas
  const submitBandingAbsen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siswaId || formBanding.siswa_banding.length === 0) return;

    try {
      const response = await fetch(`http://localhost:3001/api/siswa/${siswaId}/banding-absen-kelas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          jadwal_id: parseInt(formBanding.jadwal_id),
          tanggal_absen: formBanding.tanggal_absen,
          siswa_banding: formBanding.siswa_banding
        })
      });

      if (response.ok) {
        toast({
          title: "Berhasil",
          description: "Pengajuan banding absen kelas berhasil dikirim"
        });
        
        // Reset form dan reload data
        setFormBanding({
          jadwal_id: '',
          tanggal_absen: '',
          siswa_banding: []
        });
        setShowFormBanding(false);
        loadBandingAbsen();
      } else {
        const errorData = await response.json();
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
                  window.location.reload();
                }} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                🔄 Coba Lagi
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
                    💡 <strong>Tips:</strong> Pastikan server backend sudah berjalan di port 3001
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-white shadow-xl transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-64' : 'w-16'
      } lg:w-64 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className={`flex items-center space-x-3 ${sidebarOpen ? '' : 'justify-center lg:justify-start'}`}>
            <div className="p-2 rounded-lg">
              <img src="/logo.png" alt="ABSENTA Logo" className="h-12 w-12" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent block lg:hidden">
                ABSENTA
              </span>
            )}
            <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent hidden lg:block">
              ABSENTA
            </span>
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
            className={`w-full justify-start ${sidebarOpen ? '' : 'px-2 lg:px-3'}`}
            onClick={() => {setActiveTab('kehadiran'); setSidebarOpen(false);}}
          >
            <Clock className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2 block lg:hidden">Menu Kehadiran</span>}
            <span className="ml-2 hidden lg:block">Menu Kehadiran</span>
          </Button>
          <Button
            variant={activeTab === 'riwayat' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen ? '' : 'px-2 lg:px-3'}`}
            onClick={() => {setActiveTab('riwayat'); setSidebarOpen(false);}}
          >
            <Calendar className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2 block lg:hidden">Riwayat</span>}
            <span className="ml-2 hidden lg:block">Riwayat</span>
          </Button>
          <Button
            variant={activeTab === 'pengajuan-izin' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen ? '' : 'px-2 lg:px-3'}`}
            onClick={() => {setActiveTab('pengajuan-izin'); setSidebarOpen(false);}}
          >
            <FileText className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2 block lg:hidden">Pengajuan Izin</span>}
            <span className="ml-2 hidden lg:block">Pengajuan Izin</span>
          </Button>
          <Button
            variant={activeTab === 'banding-absen' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen ? '' : 'px-2 lg:px-3'}`}
            onClick={() => {setActiveTab('banding-absen'); setSidebarOpen(false);}}
          >
            <MessageCircle className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2 block lg:hidden">Banding Absen</span>}
            <span className="ml-2 hidden lg:block">Banding Absen</span>
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
          
          <div className={`flex items-center space-x-3 mb-3 ${sidebarOpen ? '' : 'justify-center lg:justify-start'}`}>
            <div className="bg-emerald-100 p-2 rounded-full">
              <Settings className="h-4 w-4 text-emerald-600" />
            </div>
            {sidebarOpen && (
              <div className="flex-1 block lg:hidden">
                <p className="text-sm font-medium text-gray-900">{userData.nama}</p>
                <p className="text-xs text-gray-500">Siswa Perwakilan</p>
              </div>
            )}
            <div className="flex-1 hidden lg:block">
              <p className="text-sm font-medium text-gray-900">{userData.nama}</p>
              <p className="text-xs text-gray-500">Siswa Perwakilan</p>
            </div>
          </div>
          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className={`w-full ${sidebarOpen ? '' : 'px-2 lg:px-3'}`}
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2 block lg:hidden">Keluar</span>}
            <span className="ml-2 hidden lg:block">Keluar</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        <div className="p-4 lg:p-6">
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
          <div className="hidden lg:flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                Dashboard Siswa
              </h1>
              <p className="text-gray-600 mt-2">Selamat datang, {userData.nama}!</p>
              {kelasInfo && (
                <p className="text-sm text-gray-500">Perwakilan Kelas {kelasInfo}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {new Date().toLocaleDateString('id-ID', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Badge>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'kehadiran' && renderKehadiranContent()}
          {activeTab === 'riwayat' && renderRiwayatContent()}
          {activeTab === 'pengajuan-izin' && renderPengajuanIzinContent()}
          {activeTab === 'banding-absen' && renderBandingAbsenContent()}
        </div>
      </div>
      
      {/* Floating Font Size Control for Mobile */}
      <FontSizeControl variant="floating" className="lg:hidden" />
    </div>
  );
};
