import { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatDateOnly, getWIBTime } from "@/lib/time-utils";
import { FontSizeControl } from "@/components/ui/font-size-control";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, LogOut, History, MessageCircle, ClipboardList, Menu, X, Settings
} from "lucide-react";
import { EditProfile } from './EditProfile';
import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { ScheduleListView, AttendanceView, LaporanKehadiranSiswaView, BandingAbsenView, HistoryView, RiwayatBandingAbsenView } from './teacher';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationBell } from '@/components/NotificationBell';

interface TeacherDashboardProps {
  userData: {
    id: number;
    username: string;
    nama: string;
    role: string;
    guru_id?: number;
    nip?: string;
    mapel?: string;
    alamat?: string;
    no_telepon?: string;
    jenis_kelamin?: 'L' | 'P';
    mata_pelajaran?: string;
    email?: string;
  };
}

type ScheduleStatus = 'upcoming' | 'current' | 'completed';
type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa' | 'Dispen' | 'Lain';

interface Schedule {
  id: number;
  nama_mapel: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  nama_kelas: string;
  kode_ruang?: string;
  nama_ruang?: string;
  lokasi?: string;
  status?: ScheduleStatus;
  jenis_aktivitas?: 'pelajaran' | 'upacara' | 'istirahat' | 'kegiatan_khusus' | 'libur' | 'ujian' | 'lainnya';
  is_absenable?: boolean;
  keterangan_khusus?: string;
  is_multi_guru?: boolean;
  other_teachers?: string; // Format: "1:Budi||2:Siti"
  other_teacher_list?: Array<{ id: number; nama: string }>;
}

// Tipe data mentah dari backend (bisa id atau id_jadwal, dst.)
type RawSchedule = {
  id?: number;
  id_jadwal?: number;
  jadwal_id?: number;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  jam_ke?: number;
  status?: string;
  nama_mapel?: string;
  kode_mapel?: string;
  mapel?: string;
  nama_kelas?: string;
  kelas?: string;
  jenis_aktivitas?: 'pelajaran' | 'upacara' | 'istirahat' | 'kegiatan_khusus' | 'libur' | 'ujian' | 'lainnya';
  is_absenable?: boolean;
  keterangan_khusus?: string;
  is_multi_guru?: boolean;
  other_teachers?: string;
  kode_ruang?: string;
  nama_ruang?: string;
  lokasi?: string;
};

// Baris riwayat datar dari backend /api/guru/student-attendance-history
type FlatHistoryRow = {
  tanggal: string;
  jam_ke: number;
  jam_mulai: string;
  jam_selesai: string;
  nama_mapel: string;
  nama_kelas: string;
  nama_siswa: string;
  nis: string;
  status_kehadiran: string;
  keterangan?: string;
  waktu_absen: string;
  status_guru?: string;
  keterangan_guru?: string;
  kode_ruang?: string;
  nama_ruang?: string;
  lokasi?: string;
};

interface Student {
  id: number;
  nama: string;
  nis?: string;
  jenis_kelamin?: string;
  jabatan?: string;
  status?: string;
  nama_kelas?: string;
  attendance_status?: AttendanceStatus;
  attendance_note?: string;
  waktu_absen?: string;
  guru_pengabsen_id?: number;
  guru_pengabsen_nama?: string;
  other_teachers_attendance?: string;
}

interface HistoryStudentData {
  nama: string;
  nis: string;
  status: AttendanceStatus;
  waktu_absen?: string;
  alasan?: string;
}

interface HistoryClassData {
  kelas: string;
  mata_pelajaran: string;
  jam: string;
  hari: string;
  jam_ke: number;
  kode_ruang?: string;
  nama_ruang?: string;
  lokasi?: string;
  status_guru?: string;
  keterangan_guru?: string;
  siswa: HistoryStudentData[];
}

interface HistoryData {
  [date: string]: {
    [classKey: string]: HistoryClassData;
  };
}


interface BandingAbsenTeacher {
  id_banding: number;
  siswa_id: number;
  nama_siswa: string;
  nis: string;
  nama_kelas: string;
  jadwal_id: number;
  tanggal_absen: string;
  status_asli: 'hadir' | 'izin' | 'sakit' | 'alpa';
  status_diajukan: 'hadir' | 'izin' | 'sakit' | 'alpa';
  alasan_banding: string;
  status_banding: 'pending' | 'disetujui' | 'ditolak';
  catatan_guru?: string;
  tanggal_pengajuan: string;
  tanggal_keputusan?: string;
  diproses_oleh?: number;
  nama_mapel?: string;
  nama_guru?: string;
  jam_mulai?: string;
  jam_selesai?: string;
}

// Main TeacherDashboard Component
export const TeacherDashboard = ({ userData }: TeacherDashboardProps) => {
  const { logout } = useAuth();
  const onLogout = useCallback(() => {
    void logout();
  }, [logout]);

  const navigate = useNavigate();
  const location = useLocation();

  // Notifications (guru — needs userId)
  const { notifications, unreadCount, isLoading: notifLoading, refresh: notifRefresh } =
    useNotifications({ role: 'guru', userId: userData?.guru_id ?? null, onLogout });

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<TeacherDashboardProps['userData']>(userData);

  const handleSessionExpired = useCallback(() => {
    toast({
      title: "Sesi Berakhir",
      description: "Sesi login Anda telah berakhir. Silakan login kembali.",
      variant: "destructive"
    });
    onLogout();
  }, [onLogout]);

  const apiRequest = useCallback(
    async <T,>(endpoint: string, options: Parameters<typeof apiCall>[1] = {}) => {
      return apiCall<T>(endpoint, { onLogout: handleSessionExpired, ...options });
    },
    [handleSessionExpired]
  );

  const user = currentUserData;

  const handleUpdateProfile = (updatedData: TeacherDashboardProps['userData']) => {
    setCurrentUserData(updatedData);
  };

  const AttendanceRouteWrapper = () => {
    const { scheduleId } = useParams();
    const schedule = schedules.find(s => s.id === Number(scheduleId));

    if (isLoading) {
      return <div className="flex justify-center p-8">Loading...</div>;
    }

    if (!schedule) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Jadwal tidak ditemukan</p>
          <Button onClick={() => navigate('/guru')}>Kembali ke Jadwal</Button>
        </div>
      );
    }

    return <AttendanceView schedule={schedule} user={user} onBack={() => navigate('/guru')} />;
  };

  // Load latest profile data on component mount
  useEffect(() => {
    const loadLatestProfile = async () => {
      try {
        const profileResponse = await apiRequest<{
          success?: boolean;
          id?: number;
          username?: string;
          nama?: string;
          role?: string;
          guru_id?: number;
          nip?: string;
          mata_pelajaran?: string;
          alamat?: string;
          no_telepon?: string;
          jenis_kelamin?: string;
          email?: string;
          message?: string;
          error?: unknown;
        }>('/api/guru/info');

        if (!profileResponse?.success) {
          toast({
            title: "Gagal memuat profil",
            description: profileResponse?.message || "Data profil guru tidak tersedia.",
            variant: "destructive"
          });
          return;
        }

        if (profileResponse.success) {
          setCurrentUserData({
            id: profileResponse.id,
            username: profileResponse.username,
            nama: profileResponse.nama,
            role: profileResponse.role,
            guru_id: profileResponse.guru_id,
            nip: profileResponse.nip,
            mapel: profileResponse.mata_pelajaran,
            // Tambahkan field yang hilang untuk form edit profil
            alamat: profileResponse.alamat,
            no_telepon: profileResponse.no_telepon,
            jenis_kelamin: profileResponse.jenis_kelamin as 'L' | 'P',
            mata_pelajaran: profileResponse.mata_pelajaran,
            email: profileResponse.email
          } as TeacherDashboardProps['userData']);
        }
      } catch (error) {
        const message = getErrorMessage(error);
        console.error('Failed to load latest profile data:', message);
        toast({
          title: "Gagal memuat profil",
          description: message,
          variant: "destructive"
        });
      }
    };

    loadLatestProfile();
  }, [apiRequest]);

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    if (!user.guru_id && !user.id) return;
    try {
      setIsLoading(true);
      // Gunakan endpoint backend yang tersedia: /api/guru/jadwal (auth user diambil dari token)
      const res = await apiRequest(`/api/guru/jadwal`);
      const list: Schedule[] = Array.isArray(res)
        ? res
        : (Array.isArray((res as { data?: unknown })?.data) ? (res as { data: Schedule[] }).data : []);

      if (!Array.isArray(res) && !Array.isArray((res as { data?: unknown })?.data)) {
        toast({
          title: "Error memuat jadwal",
          description: "Format data jadwal tidak valid.",
          variant: "destructive"
        });
        setSchedules([]);
        return;
      }

      // Filter hanya jadwal hari ini dan hitung status berdasar waktu sekarang
      const now = getWIBTime();
      const todayName = new Intl.DateTimeFormat('id-ID', { 
        weekday: 'long',
        timeZone: 'Asia/Jakarta'
      }).format(now);
      const todayList = (list as RawSchedule[]).filter((s) => (s.hari || '').toLowerCase() === todayName.toLowerCase());

      const currentTime = now.getHours() * 60 + now.getMinutes();

      const schedulesWithStatus = todayList.map((schedule: RawSchedule) => {
        const [startHour, startMinute] = String(schedule.jam_mulai).split(':').map(Number);
        const [endHour, endMinute] = String(schedule.jam_selesai).split(':').map(Number);
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        let status: ScheduleStatus;
        if (currentTime < startTime) status = 'upcoming';
        else if (currentTime <= endTime) status = 'current';
        else status = 'completed';

        return {
          id: schedule.id ?? schedule.id_jadwal ?? schedule.jadwal_id ?? 0,
          nama_mapel: schedule.nama_mapel ?? schedule.mapel ?? '',
          hari: schedule.hari,
          jam_mulai: schedule.jam_mulai,
          jam_selesai: schedule.jam_selesai,
          nama_kelas: schedule.nama_kelas ?? schedule.kelas ?? '',
          status,
          jenis_aktivitas: schedule.jenis_aktivitas,
          is_absenable: schedule.is_absenable,
          keterangan_khusus: schedule.keterangan_khusus,
          is_multi_guru: schedule.is_multi_guru,
          other_teachers: schedule.other_teachers,
          kode_ruang: schedule.kode_ruang,
          nama_ruang: schedule.nama_ruang,
          lokasi: schedule.lokasi,
        } as Schedule;
      });

      setSchedules(schedulesWithStatus);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error('Error fetching schedules:', message);
      toast({ title: 'Error memuat jadwal', description: message, variant: 'destructive' });
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, [user.guru_id, user.id, apiRequest]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-card border-r border-border shadow-xl transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-64' : 'w-16'
      } lg:w-64 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className={`flex items-center space-x-3 ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className="p-2 rounded-lg">
              <img src="/logo.png" alt="ABSENTA Logo" className="h-12 w-12" />
            </div>
            {(sidebarOpen || window.innerWidth >= 1024) && (
              <span className="font-bold text-xl text-foreground">
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
            variant={location.pathname === '/guru' || location.pathname.startsWith('/guru/schedule') ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'px-2'} ${location.pathname !== '/guru' && !location.pathname.startsWith('/guru/schedule') ? 'text-muted-foreground hover:text-foreground font-medium' : ''}`}
            onClick={() => { navigate('/guru'); setSidebarOpen(false); }}
          >
            <Clock className="h-4 w-4" />
            {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Jadwal Hari Ini</span>}
          </Button>
          <Button
            variant={location.pathname === '/guru/banding' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'px-2'} ${location.pathname !== '/guru/banding' ? 'text-muted-foreground hover:text-foreground font-medium' : ''}`}
            onClick={() => { navigate('/guru/banding'); setSidebarOpen(false); }}
          >
            <MessageCircle className="h-4 w-4" />
            {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Banding Absen</span>}
          </Button>
          <Button
            variant={location.pathname === '/guru/banding-history' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'px-2'} ${location.pathname !== '/guru/banding-history' ? 'text-muted-foreground hover:text-foreground font-medium' : ''}`}
            onClick={() => { navigate('/guru/banding-history'); setSidebarOpen(false); }}
          >
            <History className="h-4 w-4" />
            {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Riwayat Banding</span>}
          </Button>
          <Button
            variant={location.pathname === '/guru/history' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'ml-2'} ${location.pathname !== '/guru/history' ? 'text-muted-foreground hover:text-foreground font-medium' : ''}`}
            onClick={() => { navigate('/guru/history'); setSidebarOpen(false); }}
          >
            <History className="h-4 w-4" />
            {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Riwayat Absensi</span>}
          </Button>
          <Button
            variant={location.pathname === '/guru/reports' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'px-2'} ${location.pathname !== '/guru/reports' ? 'text-muted-foreground hover:text-foreground font-medium' : ''}`}
            onClick={() => { navigate('/guru/reports'); setSidebarOpen(false); }}
          >
            <ClipboardList className="h-4 w-4" />
            {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Laporan</span>}
          </Button>
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
{/* Font Size Control - Above Profile */}
           {(sidebarOpen || window.innerWidth >= 1024) && (
            <div className="mb-4 flex items-center gap-2">
              <FontSizeControl variant="compact" />
              <ModeToggle />
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                isLoading={notifLoading}
                onRefresh={notifRefresh}
              />
            </div>
          )}
          
          <div className={`flex items-center space-x-3 mb-3 ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'justify-center'}`}>
            <div className="bg-primary/10 p-2 rounded-full">
              <Settings className="h-4 w-4 text-primary" />
            </div>
            {(sidebarOpen || window.innerWidth >= 1024) && (
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{user.nama}</p>
                <p className="text-xs text-muted-foreground">Guru</p>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Button
              onClick={() => setShowEditProfile(true)}
              variant="outline"
              size="sm"
              className={`w-full ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'px-2'}`}
            >
              <Settings className="h-4 w-4" />
              {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Edit Profil</span>}
            </Button>
            
            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className={`w-full ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'px-2'}`}
            >
              <LogOut className="h-4 w-4" />
              {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Keluar</span>}
            </Button>
          </div>
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
            <h1 className="text-xl font-bold">Dashboard Guru</h1>
            <div className="w-10"></div> {/* Spacer for alignment */}
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                Dashboard Guru
              </h1>
              <p className="text-muted-foreground mt-2">Selamat datang, {user.nama}!</p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {formatDateOnly(getWIBTime())}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <Routes>
            <Route
              index
              element={
                <ScheduleListView
                  schedules={schedules.filter(s => s.hari === new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date()))}
                  onSelectSchedule={(schedule) => navigate(`/guru/schedule/${schedule.id}`)}
                  isLoading={isLoading}
                />
              }
            />
            <Route path="schedule/:scheduleId" element={<AttendanceRouteWrapper />} />
            <Route path="banding" element={<BandingAbsenView user={user} />} />
            <Route path="reports" element={<LaporanKehadiranSiswaView user={user} />} />
            <Route path="banding-history" element={<RiwayatBandingAbsenView user={user} />} />
            <Route path="history" element={<HistoryView user={user} />} />
          </Routes>
        </div>
      </div>
      
{/* Floating Font Size Control for Mobile */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 lg:hidden z-50">
        <FontSizeControl variant="floating" />
        <ModeToggle />
      </div>
      
      {/* Edit Profile Modal */}
      {showEditProfile && (
        <EditProfile
          userData={currentUserData}
          onUpdate={handleUpdateProfile}
          onClose={() => setShowEditProfile(false)}
          {...{ role: "guru" }}
        />
      )}
    </div>
  );
};
