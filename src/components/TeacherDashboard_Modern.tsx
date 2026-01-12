import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { formatTime24, formatDateTime24, formatDateOnly, getCurrentDateWIB, getCurrentYearWIB, formatDateWIB, getWIBTime, toWIBTime, getMonthRangeWIB, parseDateWIB, getDayNameWIB } from "@/lib/time-utils";
import { FontSizeControl } from "@/components/ui/font-size-control";
import { 
  Clock, Users, CheckCircle, LogOut, ArrowLeft, History, MessageCircle, Calendar,
  BookOpen, GraduationCap, Settings, Menu, X, Home, Bell, FileText, ClipboardList, Download, Search,
  Edit, XCircle, Filter, Eye, ChevronLeft, ChevronRight
} from "lucide-react";
import ExcelPreview from './ExcelPreview';
import { EditProfile } from './EditProfile';
import { VIEW_TO_REPORT_KEY } from '../utils/reportKeys';
import { getApiUrl } from '@/config/api';
import { ScheduleListView, STATUS_COLORS, AttendanceView, LaporanKehadiranSiswaView, RiwayatBandingAbsenView, PresensiSiswaSMKN13View, RekapKetidakhadiranView, TeacherReportsView, BandingAbsenView, HistoryView, TeacherUserData } from './teacher';

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
  onLogout: () => void;
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

// API utility function - using getApiUrl for all endpoints
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(getApiUrl(endpoint), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(errorData.error || `Error: ${response.status}`);
  }

  return response.json();
};

// Main TeacherDashboard Component
export const TeacherDashboard = ({ userData, onLogout }: TeacherDashboardProps) => {
  const [activeView, setActiveView] = useState<'schedule' | 'history' | 'banding-absen' | 'reports'>('schedule');
  const [activeReportView, setActiveReportView] = useState<string | null>(null);
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<TeacherDashboardProps['userData']>(userData);

  const user = currentUserData;

  const handleUpdateProfile = (updatedData: TeacherDashboardProps['userData']) => {
    setCurrentUserData(updatedData);
  };

  // Load latest profile data on component mount
  useEffect(() => {
    const loadLatestProfile = async () => {
      try {
        const profileResponse = await apiCall('/api/guru/info');
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
        console.error('Failed to load latest profile data:', error);
      }
    };

    loadLatestProfile();
  }, []);

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    if (!user.guru_id && !user.id) return;
    try {
      setIsLoading(true);
      // Gunakan endpoint backend yang tersedia: /api/guru/jadwal (auth user diambil dari token)
      const res = await apiCall(`/api/guru/jadwal`);
      const list: Schedule[] = Array.isArray(res) ? res : (res.data || []);

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
      console.error('Error fetching schedules:', error);
      toast({ title: 'Error', description: 'Gagal memuat jadwal', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user.guru_id, user.id]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-white shadow-xl transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-64' : 'w-16'
      } lg:w-64 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className={`flex items-center space-x-3 ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className="p-2 rounded-lg">
              <img src="/logo.png" alt="ABSENTA Logo" className="h-12 w-12" />
            </div>
            {(sidebarOpen || window.innerWidth >= 1024) && (
              <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
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
            variant={activeView === 'schedule' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'px-2'}`}
            onClick={() => {setActiveView('schedule'); setSidebarOpen(false);}}
          >
            <Clock className="h-4 w-4" />
            {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Jadwal Hari Ini</span>}
          </Button>
          <Button
            variant={activeView === 'banding-absen' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'px-2'}`}
            onClick={() => {setActiveView('banding-absen'); setSidebarOpen(false);}}
          >
            <MessageCircle className="h-4 w-4" />
            {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Banding Absen</span>}
          </Button>
          <Button
            variant={activeView === 'history' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'ml-2'}`}
            onClick={() => {setActiveView('history'); setSidebarOpen(false);}}
          >
            <History className="h-4 w-4" />
            {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Riwayat Absensi</span>}
          </Button>
          <Button
            variant={activeView === 'reports' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'px-2'}`}
            onClick={() => {setActiveView('reports'); setSidebarOpen(false);}}
          >
            <ClipboardList className="h-4 w-4" />
            {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Laporan</span>}
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
          
          <div className={`flex items-center space-x-3 mb-3 ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'justify-center'}`}>
            <div className="bg-emerald-100 p-2 rounded-full">
              <Settings className="h-4 w-4 text-emerald-600" />
            </div>
            {(sidebarOpen || window.innerWidth >= 1024) && (
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{user.nama}</p>
                <p className="text-xs text-gray-500">Guru</p>
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
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                Dashboard Guru
              </h1>
              <p className="text-gray-600 mt-2">Selamat datang, {user.nama}!</p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {formatDateOnly(getWIBTime())}
              </Badge>
            </div>
          </div>

          {/* Content */}
          {activeSchedule ? (
            <AttendanceView 
              schedule={activeSchedule} 
              user={user}
              onBack={() => setActiveSchedule(null)} 
            />
          ) : activeView === 'schedule' ? (
            <ScheduleListView 
              schedules={schedules.filter(s => s.hari === new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date()))} 
              onSelectSchedule={setActiveSchedule} 
              isLoading={isLoading}
            />
          ) : activeView === 'banding-absen' ? (
            <BandingAbsenView user={user} />
          ) : activeView === 'reports' ? (
            <LaporanKehadiranSiswaView user={user} />
          ) : (
            <HistoryView user={user} />
          )}
        </div>
      </div>
      
      {/* Floating Font Size Control for Mobile */}
      <FontSizeControl variant="floating" className="lg:hidden" />
      
      {/* Edit Profile Modal */}
      {showEditProfile && (
        <EditProfile
          userData={currentUserData}
          onUpdate={handleUpdateProfile}
          onClose={() => setShowEditProfile(false)}
          role="guru"
        />
      )}
    </div>
  );
};
