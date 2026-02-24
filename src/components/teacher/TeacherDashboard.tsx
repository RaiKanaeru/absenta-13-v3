import { useState, useEffect, useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import { Routes, Route, useNavigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatDateOnly, getWIBTime } from "@/lib/time-utils";
import { FontSizeControl } from "@/components/shared/font-size-control";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Clock, LogOut, History, MessageCircle, ClipboardList, Menu, X, Settings,
  type LucideIcon
} from "lucide-react";
import { EditProfile } from '@/components/shared/EditProfile';
import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { ScheduleListView, AttendanceView, LaporanKehadiranSiswaView, BandingAbsenView, HistoryView, RiwayatBandingAbsenView } from '.';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationBell } from '@/components/shared/NotificationBell';

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

type TeacherApiRequest = <T,>(endpoint: string, options?: Parameters<typeof apiCall>[1]) => Promise<T>;

type SetSchedules = Dispatch<SetStateAction<Schedule[]>>;
type SetLoading = Dispatch<SetStateAction<boolean>>;

const isDesktopViewport = (): boolean => window.innerWidth >= 1024;

const parseScheduleResponse = (response: unknown): Schedule[] | null => {
  if (Array.isArray(response)) {
    return response as Schedule[];
  }

  const data = (response as { data?: unknown })?.data;
  if (Array.isArray(data)) {
    return data as Schedule[];
  }

  return null;
};

const getScheduleStatus = (currentTime: number, jamMulai: string, jamSelesai: string): ScheduleStatus => {
  const [startHour, startMinute] = String(jamMulai).split(':').map(Number);
  const [endHour, endMinute] = String(jamSelesai).split(':').map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  if (currentTime < startTime) return 'upcoming';
  if (currentTime <= endTime) return 'current';
  return 'completed';
};

const buildTodaySchedules = (list: RawSchedule[]): Schedule[] => {
  const now = getWIBTime();
  const todayName = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    timeZone: 'Asia/Jakarta'
  }).format(now);
  const currentTime = now.getHours() * 60 + now.getMinutes();

  return list
    .filter((schedule) => (schedule.hari || '').toLowerCase() === todayName.toLowerCase())
    .map((schedule) => ({
      id: schedule.id ?? schedule.id_jadwal ?? schedule.jadwal_id ?? 0,
      nama_mapel: schedule.nama_mapel ?? schedule.mapel ?? '',
      hari: schedule.hari,
      jam_mulai: schedule.jam_mulai,
      jam_selesai: schedule.jam_selesai,
      nama_kelas: schedule.nama_kelas ?? schedule.kelas ?? '',
      status: getScheduleStatus(currentTime, schedule.jam_mulai, schedule.jam_selesai),
      jenis_aktivitas: schedule.jenis_aktivitas,
      is_absenable: schedule.is_absenable,
      keterangan_khusus: schedule.keterangan_khusus,
      is_multi_guru: schedule.is_multi_guru,
      other_teachers: schedule.other_teachers,
      kode_ruang: schedule.kode_ruang,
      nama_ruang: schedule.nama_ruang,
      lokasi: schedule.lokasi,
    }));
};

const loadLatestTeacherProfile = async (
  apiRequest: TeacherApiRequest,
  setCurrentUserData: Dispatch<SetStateAction<TeacherDashboardProps['userData']>>
): Promise<void> => {
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
        title: 'Gagal memuat profil',
        description: profileResponse?.message || 'Data profil guru tidak tersedia.',
        variant: 'destructive'
      });
      return;
    }

    setCurrentUserData({
      id: profileResponse.id,
      username: profileResponse.username,
      nama: profileResponse.nama,
      role: profileResponse.role,
      guru_id: profileResponse.guru_id,
      nip: profileResponse.nip,
      mapel: profileResponse.mata_pelajaran,
      alamat: profileResponse.alamat,
      no_telepon: profileResponse.no_telepon,
      jenis_kelamin: profileResponse.jenis_kelamin as 'L' | 'P',
      mata_pelajaran: profileResponse.mata_pelajaran,
      email: profileResponse.email
    } as TeacherDashboardProps['userData']);
  } catch (error) {
    toast({
      title: 'Gagal memuat profil',
      description: getErrorMessage(error),
      variant: 'destructive'
    });
  }
};

const showSessionExpiredToast = (): void => {
  toast({
    title: 'Sesi Berakhir',
    description: 'Sesi login Anda telah berakhir. Silakan login kembali.',
    variant: 'destructive'
  });
};

const createTeacherApiRequest = (handleSessionExpired: () => void): TeacherApiRequest => {
  return async <T,>(endpoint: string, options: Parameters<typeof apiCall>[1] = {}) => {
    return apiCall<T>(endpoint, { onLogout: handleSessionExpired, ...options });
  };
};

const showInvalidScheduleToast = (): void => {
  toast({
    title: 'Error memuat jadwal',
    description: 'Format data jadwal tidak valid.',
    variant: 'destructive'
  });
};

const showScheduleFetchErrorToast = (error: unknown): void => {
  toast({
    title: 'Error memuat jadwal',
    description: getErrorMessage(error),
    variant: 'destructive'
  });
};

const fetchTeacherSchedules = async (
  apiRequest: TeacherApiRequest,
  hasTeacherIdentity: boolean,
  setIsLoading: SetLoading,
  setSchedules: SetSchedules
): Promise<void> => {
  if (!hasTeacherIdentity) return;

  try {
    setIsLoading(true);
    const res = await apiRequest<unknown>('/api/guru/jadwal');
    const list = parseScheduleResponse(res);

    if (!list) {
      showInvalidScheduleToast();
      setSchedules([]);
      return;
    }

    setSchedules(buildTodaySchedules(list as RawSchedule[]));
  } catch (error) {
    showScheduleFetchErrorToast(error);
    setSchedules([]);
  } finally {
    setIsLoading(false);
  }
};

interface TeacherAttendanceRouteWrapperProps {
  isLoading: boolean;
  schedules: Schedule[];
  user: TeacherDashboardProps['userData'];
}

const TeacherAttendanceRouteWrapper = ({
  isLoading,
  schedules,
  user,
}: TeacherAttendanceRouteWrapperProps) => {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const schedule = schedules.find((item) => item.id === Number(scheduleId));

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

interface TeacherSidebarProps {
  locationPathname: string;
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  navigate: ReturnType<typeof useNavigate>;
  userName: string;
  onLogout: () => void;
  onEditProfile: () => void;
  notifications: ReturnType<typeof useNotifications>['notifications'];
  unreadCount: number;
  notifLoading: boolean;
  notifRefresh: ReturnType<typeof useNotifications>['refresh'];
}

interface TeacherSidebarNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  collapsedClassName?: string;
  matches?: (pathname: string) => boolean;
}

const TEACHER_SIDEBAR_NAV_ITEMS: TeacherSidebarNavItem[] = [
  {
    path: '/guru',
    label: 'Jadwal Hari Ini',
    icon: Clock,
    matches: (pathname) => pathname === '/guru' || pathname.startsWith('/guru/schedule'),
  },
  {
    path: '/guru/banding',
    label: 'Banding Absen',
    icon: MessageCircle,
  },
  {
    path: '/guru/banding-history',
    label: 'Riwayat Banding',
    icon: History,
  },
  {
    path: '/guru/history',
    label: 'Riwayat Absensi',
    icon: History,
    collapsedClassName: 'ml-2',
  },
  {
    path: '/guru/reports',
    label: 'Laporan',
    icon: ClipboardList,
  },
];

const isTeacherSidebarNavItemActive = (pathname: string, item: TeacherSidebarNavItem): boolean => {
  if (item.matches) {
    return item.matches(pathname);
  }
  return pathname === item.path;
};

const getTeacherSidebarNavButtonClassName = (
  showLabel: boolean,
  isActive: boolean,
  collapsedClassName: string = 'px-2'
): string => {
  return `w-full justify-start ${showLabel ? '' : collapsedClassName} ${isActive ? '' : 'text-muted-foreground hover:text-foreground font-medium'}`;
};

const TeacherSidebar = ({
  locationPathname,
  sidebarOpen,
  setSidebarOpen,
  navigate,
  userName,
  onLogout,
  onEditProfile,
  notifications,
  unreadCount,
  notifLoading,
  notifRefresh,
}: TeacherSidebarProps) => {
  const showLabel = sidebarOpen || isDesktopViewport();

  return (
    <div className={`fixed left-0 top-0 h-full bg-card border-r border-border shadow-xl transition-all duration-300 z-40 ${
      sidebarOpen ? 'w-64' : 'w-16'
    } lg:w-64 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className={`flex items-center space-x-3 ${sidebarOpen ? '' : 'justify-center'}`}>
          <div className="p-2 rounded-lg">
            <img src="/logo.png" alt="ABSENTA Logo" className="h-12 w-12" />
          </div>
          {showLabel && <span className="font-bold text-xl text-foreground">ABSENTA</span>}
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

      <nav className="p-4 space-y-2">
        {TEACHER_SIDEBAR_NAV_ITEMS.map((item) => {
          const isActive = isTeacherSidebarNavItemActive(locationPathname, item);
          const Icon = item.icon;

          return (
            <Button
              key={item.path}
              variant={isActive ? 'default' : 'ghost'}
              className={getTeacherSidebarNavButtonClassName(showLabel, isActive, item.collapsedClassName)}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
            >
              <Icon className="h-4 w-4" />
              {showLabel && <span className="ml-2">{item.label}</span>}
            </Button>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
        {showLabel && (
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

        <div className={`flex items-center space-x-3 mb-3 ${showLabel ? '' : 'justify-center'}`}>
          <div className="bg-primary/10 p-2 rounded-full">
            <Settings className="h-4 w-4 text-primary" />
          </div>
          {showLabel && (
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground">Guru</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Button
            onClick={onEditProfile}
            variant="outline"
            size="sm"
            className={`w-full ${showLabel ? '' : 'px-2'}`}
          >
            <Settings className="h-4 w-4" />
            {showLabel && <span className="ml-2">Edit Profil</span>}
          </Button>

          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className={`w-full ${showLabel ? '' : 'px-2'}`}
          >
            <LogOut className="h-4 w-4" />
            {showLabel && <span className="ml-2">Keluar</span>}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface TeacherMainHeaderProps {
  userName: string;
  onOpenSidebar: () => void;
}

const TeacherMainHeader = ({ userName, onOpenSidebar }: TeacherMainHeaderProps) => (
  <>
    <div className="flex items-center justify-between mb-6 lg:hidden">
      <Button variant="outline" size="sm" onClick={onOpenSidebar}>
        <Menu className="h-4 w-4" />
      </Button>
      <h1 className="text-xl font-bold">Dashboard Guru</h1>
      <div className="w-10"></div>
    </div>

    <div className="hidden lg:flex justify-between items-center mb-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Dashboard Guru</h1>
        <p className="text-muted-foreground mt-2">Selamat datang, {userName}!</p>
      </div>
      <div className="flex items-center space-x-2">
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          {formatDateOnly(getWIBTime())}
        </Badge>
      </div>
    </div>
  </>
);

interface TeacherDashboardRoutesProps {
  schedules: Schedule[];
  isLoading: boolean;
  user: TeacherDashboardProps['userData'];
}

const TeacherDashboardRoutes = ({ schedules, isLoading, user }: TeacherDashboardRoutesProps) => {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        index
        element={
          <ScheduleListView
            schedules={schedules.filter((schedule) => schedule.hari === new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date()))}
            onSelectSchedule={(schedule) => navigate(`/guru/schedule/${schedule.id}`)}
            isLoading={isLoading}
          />
        }
      />
      <Route path="schedule/:scheduleId" element={<TeacherAttendanceRouteWrapper isLoading={isLoading} schedules={schedules} user={user} />} />
      <Route path="banding" element={<BandingAbsenView user={user} />} />
      <Route path="reports" element={<LaporanKehadiranSiswaView user={user} />} />
      <Route path="banding-history" element={<RiwayatBandingAbsenView user={user} />} />
      <Route path="history" element={<HistoryView user={user} />} />
    </Routes>
  );
};

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
    showSessionExpiredToast();
    onLogout();
  }, [onLogout]);

  const apiRequest = useMemo(() => createTeacherApiRequest(handleSessionExpired), [handleSessionExpired]);

  const user = currentUserData;

  const handleUpdateProfile = (updatedData: TeacherDashboardProps['userData']) => {
    setCurrentUserData(updatedData);
  };

  useEffect(() => {
    void loadLatestTeacherProfile(apiRequest, setCurrentUserData);
  }, [apiRequest]);

  const hasTeacherIdentity = Boolean(user.guru_id || user.id);

  const fetchSchedules = useCallback(async () => {
    await fetchTeacherSchedules(apiRequest, hasTeacherIdentity, setIsLoading, setSchedules);
  }, [apiRequest, hasTeacherIdentity]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return (
    <div className="min-h-screen bg-background">
      <TeacherSidebar
        locationPathname={location.pathname}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        navigate={navigate}
        userName={user.nama}
        onLogout={onLogout}
        onEditProfile={() => setShowEditProfile(true)}
        notifications={notifications}
        unreadCount={unreadCount}
        notifLoading={notifLoading}
        notifRefresh={notifRefresh}
      />

      <div className="lg:ml-64">
        <div className="p-4 lg:p-6">
          <TeacherMainHeader userName={user.nama} onOpenSidebar={() => setSidebarOpen(true)} />
          <TeacherDashboardRoutes schedules={schedules} isLoading={isLoading} user={user} />
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
