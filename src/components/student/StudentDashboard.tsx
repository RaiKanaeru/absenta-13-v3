import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { formatDateOnly, getCurrentDateWIB, formatDateWIB, getWIBTime } from '@/lib/time-utils';
import { FontSizeControl } from '@/components/shared/font-size-control';
import { ModeToggle } from '@/components/mode-toggle';
import { EditProfile } from '@/components/shared/EditProfile';
import { apiCall } from '@/utils/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { getStatusButtonClass } from '@/utils/statusMaps';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationBell } from '@/components/shared/NotificationBell';
import {
  LogOut, Clock, User, XCircle, Save,
  Settings, Menu, X, Users, MessageCircle, History
} from 'lucide-react';

// Student module imports
import type { JadwalHariIni, KehadiranData, RiwayatData, RiwayatJadwal, BandingAbsen, StatusType } from '@/types/student';
import { parseGuruList, parseJadwalKey, resolveErrorMessage, isFailureResponse, getResponseErrorText, resolveGuruIdForUpdate, type ResolveGuruIdResult } from './utils';
import { KehadiranTab } from './KehadiranTab';
import { RiwayatTab } from './RiwayatTab';
import { BandingAbsenTab } from './BandingAbsenTab';

interface StudentDashboardProps {
  userData: {
    id: number;
    username: string;
    nama: string;
    role: string;
  };
}

type AbsenKelasStudent = {
  id_siswa: number;
  nis: string;
  nama: string;
  jenis_kelamin: string;
  jabatan: string;
  attendance_status: string;
  keterangan: string;
};

type AbsenSiswaDataMap = { [key: number]: { status: string; keterangan: string } };

const ABSEN_STATUS_OPTIONS = ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispen'] as const;

const isDesktopViewport = (): boolean => window.innerWidth >= 1024;

interface StudentSidebarProps {
  locationPathname: string;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  navigate: ReturnType<typeof useNavigate>;
  userName: string;
  onLogout: () => void;
  onEditProfile: () => void;
  notifications: ReturnType<typeof useNotifications>['notifications'];
  unreadCount: number;
  notifLoading: boolean;
  notifRefresh: ReturnType<typeof useNotifications>['refresh'];
}

const StudentSidebar = ({
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
}: StudentSidebarProps): React.ReactElement => {
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
        <Button
          variant={locationPathname === '/siswa' ? 'default' : 'ghost'}
          className={`w-full justify-start ${showLabel ? '' : 'px-2'} ${locationPathname === '/siswa' ? '' : 'text-muted-foreground hover:text-foreground font-medium'}`}
          onClick={() => {
            navigate('/siswa');
            setSidebarOpen(false);
          }}
        >
          <Clock className="h-4 w-4" />
          {showLabel && <span className="ml-2">Kehadiran</span>}
        </Button>
        <Button
          variant={locationPathname === '/siswa/banding' ? 'default' : 'ghost'}
          className={`w-full justify-start ${showLabel ? '' : 'px-2'} ${locationPathname === '/siswa/banding' ? '' : 'text-muted-foreground hover:text-foreground font-medium'}`}
          onClick={() => {
            navigate('/siswa/banding');
            setSidebarOpen(false);
          }}
        >
          <MessageCircle className="h-4 w-4" />
          {showLabel && <span className="ml-2">Banding Absen</span>}
        </Button>
        <Button
          variant={locationPathname === '/siswa/riwayat' ? 'default' : 'ghost'}
          className={`w-full justify-start ${showLabel ? '' : 'px-2'} ${locationPathname === '/siswa/riwayat' ? '' : 'text-muted-foreground hover:text-foreground font-medium'}`}
          onClick={() => {
            navigate('/siswa/riwayat');
            setSidebarOpen(false);
          }}
        >
          <History className="h-4 w-4" />
          {showLabel && <span className="ml-2">Riwayat</span>}
        </Button>
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
            <User className="h-4 w-4 text-primary" />
          </div>
          {showLabel && (
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground">Perwakilan Kelas</p>
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

interface StudentMainHeaderProps {
  userName: string;
  onOpenSidebar: () => void;
}

const StudentMainHeader = ({ userName, onOpenSidebar }: StudentMainHeaderProps): React.ReactElement => (
  <>
    <div className="flex items-center justify-between mb-6 lg:hidden">
      <Button variant="outline" size="sm" onClick={onOpenSidebar}>
        <Menu className="h-4 w-4" />
      </Button>
      <h1 className="text-xl font-bold">Dashboard Siswa</h1>
      <div className="w-10"></div>
    </div>

    <div className="hidden lg:flex justify-between items-center mb-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Dashboard Siswa</h1>
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

interface StudentDashboardRoutesProps {
  loading: boolean;
  isEditMode: boolean;
  kelasInfo: string;
  selectedDate: string;
  minDate: string;
  maxDate: string;
  jadwalHariIni: JadwalHariIni[];
  jadwalBerdasarkanTanggal: JadwalHariIni[];
  kehadiranData: KehadiranData;
  adaTugasData: { [key: number]: boolean };
  isUpdatingStatus: string | null;
  toggleEditMode: () => void;
  handleDateChange: (newDate: string) => void;
  updateKehadiranStatus: (key: string | number, status: string) => Promise<void>;
  updateKehadiranKeterangan: (key: string | number, keterangan: string) => void;
  setAdaTugasData: React.Dispatch<React.SetStateAction<{ [key: number]: boolean }>>;
  submitKehadiran: () => Promise<void>;
  openAbsenKelasModal: (jadwalId: number, guruNama: string) => Promise<void>;
  riwayatData: RiwayatData[];
  riwayatPage: number;
  setRiwayatPage: React.Dispatch<React.SetStateAction<number>>;
  detailRiwayat: RiwayatJadwal | null;
  setDetailRiwayat: React.Dispatch<React.SetStateAction<RiwayatJadwal | null>>;
  bandingAbsen: BandingAbsen[];
  expandedBanding: number | null;
  setExpandedBanding: React.Dispatch<React.SetStateAction<number | null>>;
  showFormBanding: boolean;
  setShowFormBanding: React.Dispatch<React.SetStateAction<boolean>>;
  formBanding: {
    jadwal_id: string;
    tanggal_absen: string;
    siswa_banding: {
      nama: string;
      status_asli: StatusType;
      status_diajukan: StatusType;
      alasan_banding: string;
    }[];
  };
  setFormBanding: React.Dispatch<React.SetStateAction<{
    jadwal_id: string;
    tanggal_absen: string;
    siswa_banding: {
      nama: string;
      status_asli: StatusType;
      status_diajukan: StatusType;
      alasan_banding: string;
    }[];
  }>>;
  setJadwalBerdasarkanTanggal: React.Dispatch<React.SetStateAction<JadwalHariIni[]>>;
  loadingJadwal: boolean;
  selectedSiswaId: number | null;
  setSelectedSiswaId: React.Dispatch<React.SetStateAction<number | null>>;
  daftarSiswa: Array<{ id?: number; id_siswa?: number; nama: string }>;
  bandingAbsenPage: number;
  setBandingAbsenPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
  submitBandingAbsen: (e: React.FormEvent) => Promise<void>;
  loadJadwalBandingByDate: (tanggal: string) => Promise<void>;
  loadSiswaStatusById: (idSiswa: number, tanggal: string, jadwalId: string) => Promise<void>;
}

const StudentDashboardRoutes = (props: StudentDashboardRoutesProps): React.ReactElement => (
  <Routes>
    <Route
      index
      element={
        <KehadiranTab
          loading={props.loading}
          isEditMode={props.isEditMode}
          kelasInfo={props.kelasInfo}
          selectedDate={props.selectedDate}
          minDate={props.minDate}
          maxDate={props.maxDate}
          jadwalHariIni={props.jadwalHariIni}
          jadwalBerdasarkanTanggal={props.jadwalBerdasarkanTanggal}
          kehadiranData={props.kehadiranData}
          adaTugasData={props.adaTugasData}
          isUpdatingStatus={props.isUpdatingStatus}
          toggleEditMode={props.toggleEditMode}
          handleDateChange={props.handleDateChange}
          updateKehadiranStatus={props.updateKehadiranStatus}
          updateKehadiranKeterangan={props.updateKehadiranKeterangan}
          setAdaTugasData={props.setAdaTugasData}
          submitKehadiran={props.submitKehadiran}
          openAbsenKelasModal={props.openAbsenKelasModal}
        />
      }
    />
    <Route
      path="riwayat"
      element={
        <RiwayatTab
          riwayatData={props.riwayatData}
          riwayatPage={props.riwayatPage}
          setRiwayatPage={props.setRiwayatPage}
          detailRiwayat={props.detailRiwayat}
          setDetailRiwayat={props.setDetailRiwayat}
        />
      }
    />
    <Route
      path="banding"
      element={
        <BandingAbsenTab
          bandingAbsen={props.bandingAbsen}
          expandedBanding={props.expandedBanding}
          setExpandedBanding={props.setExpandedBanding}
          showFormBanding={props.showFormBanding}
          setShowFormBanding={props.setShowFormBanding}
          formBanding={props.formBanding}
          setFormBanding={props.setFormBanding}
          jadwalBerdasarkanTanggal={props.jadwalBerdasarkanTanggal}
          setJadwalBerdasarkanTanggal={props.setJadwalBerdasarkanTanggal}
          loadingJadwal={props.loadingJadwal}
          selectedSiswaId={props.selectedSiswaId}
          setSelectedSiswaId={props.setSelectedSiswaId}
          daftarSiswa={props.daftarSiswa}
          bandingAbsenPage={props.bandingAbsenPage}
          setBandingAbsenPage={props.setBandingAbsenPage}
          itemsPerPage={props.itemsPerPage}
          submitBandingAbsen={props.submitBandingAbsen}
          loadJadwalBandingByDate={props.loadJadwalBandingByDate}
          loadSiswaStatusById={props.loadSiswaStatusById}
        />
      }
    />
  </Routes>
);

interface AbsenStatusButtonsProps {
  selectedStatus?: string;
  onSelectStatus: (status: string) => void;
}

const AbsenStatusButtons = ({ selectedStatus, onSelectStatus }: AbsenStatusButtonsProps): React.ReactElement => (
  <div className="grid grid-cols-5 gap-1">
    {ABSEN_STATUS_OPTIONS.map((status) => (
      <button
        type="button"
        key={status}
        onClick={() => onSelectStatus(status)}
        className={`px-2 py-1 text-xs rounded border ${getStatusButtonClass(status, selectedStatus === status)}`}
      >
        {status}
      </button>
    ))}
  </div>
);

interface AbsenKelasStudentRowProps {
  siswa: AbsenKelasStudent;
  index: number;
  selectedStatus?: string;
  onUpdateStatus: (idSiswa: number, status: string) => void;
}

const AbsenKelasStudentRow = ({
  siswa,
  index,
  selectedStatus,
  onUpdateStatus,
}: AbsenKelasStudentRowProps): React.ReactElement => (
  <div className="border border-border rounded-lg p-3 bg-muted/20">
    <div className="flex items-center justify-between mb-2">
      <div>
        <span className="text-xs text-muted-foreground mr-2">{index + 1}.</span>
        <span className="font-medium text-foreground">{siswa.nama}</span>
        <span className="text-xs text-muted-foreground ml-2">({siswa.nis})</span>
        {siswa.jabatan && <Badge variant="secondary" className="ml-2 text-xs">{siswa.jabatan}</Badge>}
      </div>
      <Badge
        className={`text-xs ${
          siswa.jenis_kelamin === 'L'
            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
            : 'bg-pink-500/15 text-pink-700 dark:text-pink-400'
        } border-0`}
      >
        {siswa.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
      </Badge>
    </div>

    <AbsenStatusButtons
      selectedStatus={selectedStatus}
      onSelectStatus={(status) => onUpdateStatus(siswa.id_siswa, status)}
    />
  </div>
);

interface StudentAbsenKelasModalProps {
  show: boolean;
  loadingAbsenKelas: boolean;
  daftarSiswaKelas: AbsenKelasStudent[];
  absenSiswaData: AbsenSiswaDataMap;
  absenKelasGuruNama: string;
  onClose: () => void;
  onSetSemuaSiswaHadir: () => void;
  onUpdateStatus: (idSiswa: number, status: string) => void;
  onSubmit: () => Promise<void>;
}

const StudentAbsenKelasModal = ({
  show,
  loadingAbsenKelas,
  daftarSiswaKelas,
  absenSiswaData,
  absenKelasGuruNama,
  onClose,
  onSetSemuaSiswaHadir,
  onUpdateStatus,
  onSubmit,
}: StudentAbsenKelasModalProps): React.ReactElement | null => {
  if (!show) {
    return null;
  }

  const hasStudents = daftarSiswaKelas.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="bg-orange-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Absensi Siswa</h2>
              <p className="text-sm text-orange-100">Guru {absenKelasGuruNama} tidak hadir - Diabsen oleh Piket</p>
            </div>
            <button type="button" onClick={onClose} className="p-1 hover:bg-orange-700 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-4">
          {loadingAbsenKelas && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
              <span className="ml-2">Memuat daftar siswa...</span>
            </div>
          )}

          {!loadingAbsenKelas && !hasStudents && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
              <p>Tidak ada siswa ditemukan</p>
            </div>
          )}

          {!loadingAbsenKelas && hasStudents && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                <span>Total: {daftarSiswaKelas.length} siswa</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={onSetSemuaSiswaHadir} className="text-xs">
                    Semua Hadir
                  </Button>
                </div>
              </div>

              {daftarSiswaKelas.map((siswa, index) => (
                <AbsenKelasStudentRow
                  key={siswa.id_siswa}
                  siswa={siswa}
                  index={index}
                  selectedStatus={absenSiswaData[siswa.id_siswa]?.status}
                  onUpdateStatus={onUpdateStatus}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-muted/20">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button
              onClick={onSubmit}
              disabled={loadingAbsenKelas || !hasStudents}
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
  );
};


type KehadiranDataWithFlags = {
  [key: string]: { status: string; keterangan: string; ada_tugas: boolean; guru_id?: number };
};

const validateMultiGuruAttendanceCompleteness = (
  jadwalData: JadwalHariIni[],
  kehadiranData: KehadiranData
): string | null => {
  const multiGuruJadwal = jadwalData.filter((jadwal) => jadwal.is_multi_guru && jadwal.is_absenable);
  const providedKeys = Object.keys(kehadiranData);

  for (const jadwal of multiGuruJadwal) {
    if (!jadwal.guru_list || jadwal.guru_list.length === 0) {
      continue;
    }

    const expectedKeys = jadwal.guru_list.map((guru) => `${jadwal.id_jadwal}-${guru.id_guru}`);
    const missingTeachers = expectedKeys.filter((key) => !providedKeys.includes(key));

    if (missingTeachers.length > 0) {
      return jadwal.nama_mapel;
    }
  }

  return null;
};

const buildKehadiranDataWithFlags = (
  kehadiranData: KehadiranData,
  adaTugasData: { [key: number]: boolean }
): KehadiranDataWithFlags => {
  const kehadiranDataWithFlags: KehadiranDataWithFlags = {};

  Object.keys(kehadiranData).forEach((key) => {
    if (key.includes('-')) {
      const [, guruId] = key.split('-');
      kehadiranDataWithFlags[key] = {
        status: kehadiranData[key].status,
        keterangan: kehadiranData[key].keterangan,
        ada_tugas: adaTugasData[key] || false,
        guru_id: Number.parseInt(guruId)
      };
      return;
    }

    const jadwalIdNum = Number.parseInt(key);
    kehadiranDataWithFlags[jadwalIdNum] = {
      status: kehadiranData[jadwalIdNum].status,
      keterangan: kehadiranData[jadwalIdNum].keterangan,
      ada_tugas: adaTugasData[jadwalIdNum] || false,
      guru_id: kehadiranData[jadwalIdNum].guru_id
    };
  });

  return kehadiranDataWithFlags;
};

const handleKehadiranStatusUpdateError = (
  key: string | number,
  previousState: KehadiranData[string] | undefined,
  message: string,
  setKehadiranData: React.Dispatch<React.SetStateAction<KehadiranData>>
): void => {
  setKehadiranData((prev) => ({
    ...prev,
    [key]: previousState || {
      status: 'Hadir',
      keterangan: ''
    }
  }));

  toast({
    title: 'Gagal Menyimpan',
    description: message,
    variant: 'destructive',
    duration: 4000
  });
};

export const StudentDashboard = ({ userData }: StudentDashboardProps) => {
  const { logout } = useAuth();
  const onLogout = useCallback(() => {
    logout();
  }, [logout]);

  // Notifications (siswa — uses userData.id since siswaId is derived later)
  const { notifications, unreadCount, isLoading: notifLoading, refresh: notifRefresh } =
    useNotifications({ role: 'siswa', userId: userData?.id ?? null, onLogout });

  const navigate = useNavigate();
  const location = useLocation();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(userData);
  const [jadwalHariIni, setJadwalHariIni] = useState<JadwalHariIni[]>([]);
  const [kehadiranData, setKehadiranData] = useState<KehadiranData>({});
  const [adaTugasData, setAdaTugasData] = useState<{[key: number]: boolean}>({});
  const [riwayatData, setRiwayatData] = useState<RiwayatData[]>([]);
  const [bandingAbsen, setBandingAbsen] = useState<BandingAbsen[]>([]);
   const [expandedBanding, setExpandedBanding] = useState<number | null>(null);
   const [detailRiwayat, setDetailRiwayat] = useState<RiwayatJadwal | null>(null);
   const [loading, setLoading] = useState(false);
   const [siswaId] = useState<number | null>(userData?.id ?? null);
   const [kelasInfo] = useState<string>('');
   const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  const [maxDate] = useState<string>(() => {
    return getCurrentDateWIB();
  });
  const [minDate] = useState<string>(() => {
    const wibNow = getWIBTime();
    const sevenDaysAgo = new Date(wibNow.getTime() - 7 * 24 * 60 * 60 * 1000);
    return formatDateWIB(sevenDaysAgo);
  });

  // State untuk form banding absen kelas
  const [formBanding, setFormBanding] = useState({
    jadwal_id: '',
    tanggal_absen: '',
    siswa_banding: [{
      nama: '',
      status_asli: 'alpa' as StatusType,
      status_diajukan: 'hadir' as StatusType,
      alasan_banding: ''
    }] as Array<{
      nama: string;
      status_asli: StatusType;
      status_diajukan: StatusType;
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
  
  // State untuk menyimpan data status kehadiran siswa (only setter used)
  const [, setSiswaStatusData] = useState<{[key: string]: string}>({});
  
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

  // Note: toggleRowExpansion removed - was unused (only defined, never called)

  // -- MISSING STATES ADDED BY QA ANALYST --
  const [, setSiswaInfo] = useState<{
    nis: string;
    kelas: string;
    nama: string;
    kelas_id: number;
   } | null>(null);
   
   const [riwayatPage, setRiwayatPage] = useState(1);
   const [showFormBanding, setShowFormBanding] = useState(false);
  
  // Pagination Banding Absen
  const [bandingAbsenPage, setBandingAbsenPage] = useState(1);
  const itemsPerPage = 5; // Untuk banding absen pagination
  // -----------------------------------------

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
        const data = await apiRequest<{
          nis: string;
          kelas: string;
          nama: string;
          kelas_id: number;
        }>(`/api/siswa/${userData.id}/info`);
        
        if (data) {
          setSiswaInfo(data);
          // Set kelas_id di userData lokal untuk konteks validasi
          if (data.kelas_id) {
            // Check if user needs to update password (default password check)
            // Implementation specific
          }
        }
      } catch {
         // Silent fail - siswa info is supplementary
       }
    };

    getSiswaInfo();
  }, [apiRequest, userData.id]);

  // Load jadwal hari ini
  const loadJadwalHariIni = useCallback(async () => {
    if (!siswaId) return;

    setLoading(true);
    try {
      const data = await apiRequest<JadwalHariIni[]>(`/api/siswa/${siswaId}/jadwal-hari-ini`);

      if (!Array.isArray(data)) {
        toast({
          title: "Error memuat jadwal",
          description: "Format data jadwal tidak valid.",
          variant: "destructive"
        });
        setJadwalHariIni([]);
        return;
      }

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
    } catch (error) {
      const message = resolveErrorMessage(error, 'Gagal memuat jadwal hari ini.');
      toast({
        title: "Error memuat jadwal",
        description: message,
        variant: "destructive"
      });
      setJadwalHariIni([]);
    } finally {
      setLoading(false);
    }
  }, [siswaId, apiRequest]);


  // Load jadwal untuk banding absen berdasarkan tanggal yang dipilih
  const loadJadwalBandingByDate = useCallback(async (tanggal: string) => {
    if (!siswaId) return;

    setLoadingJadwal(true);
    try {
      const result = await apiRequest<{ success?: boolean; data?: JadwalHariIni[]; error?: unknown; message?: unknown }>(
        `/api/siswa/${siswaId}/jadwal-rentang?tanggal=${tanggal}`
      );

      if (isFailureResponse(result)) {
        toast({
          title: "Error memuat jadwal",
          description: getResponseErrorText(result, "Data jadwal tidak ditemukan"),
          variant: "destructive"
        });
        setJadwalBerdasarkanTanggal([]);
        setKehadiranData({});
        setAdaTugasData({});
        return;
      }

      const rawData = (result as { data?: unknown }).data;
      if (!Array.isArray(rawData)) {
        toast({
          title: "Error memuat jadwal",
          description: "Format data jadwal tidak valid.",
          variant: "destructive"
        });
        setJadwalBerdasarkanTanggal([]);
        setKehadiranData({});
        setAdaTugasData({});
        return;
      }

      // Proses guru_list dari string ke array
      const processedData = rawData.map((jadwal: JadwalHariIni & { guru_list?: string }) => ({
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
    } catch (error) {
      const message = resolveErrorMessage(error, 'Gagal memuat jadwal berdasarkan tanggal.');
      toast({
        title: "Error memuat jadwal",
        description: message,
        variant: "destructive"
      });
      setJadwalBerdasarkanTanggal([]);
    } finally {
      setLoadingJadwal(false);
    }
  }, [siswaId, apiRequest]);


  // Load riwayat data
  const loadRiwayatData = useCallback(async () => {
    if (!siswaId) return;

    try {
      const data = await apiRequest<RiwayatData[]>(`/api/siswa/${siswaId}/riwayat-kehadiran`);
      if (!Array.isArray(data)) {
        toast({
          title: "Error memuat riwayat",
          description: "Format data riwayat tidak valid.",
          variant: "destructive"
        });
        setRiwayatData([]);
        return;
      }
      setRiwayatData(data);
    } catch (error) {
      const message = resolveErrorMessage(error, 'Gagal memuat riwayat kehadiran.');
      toast({
        title: "Error memuat riwayat",
        description: message,
        variant: "destructive"
      });
      setRiwayatData([]);
    }
  }, [siswaId, apiRequest]);



  useEffect(() => {
    if (siswaId && location.pathname === '/siswa') {
      loadJadwalHariIni();
    }
  }, [siswaId, location.pathname, loadJadwalHariIni]);

  useEffect(() => {
    if (siswaId && location.pathname === '/siswa/riwayat') {
      loadRiwayatData();
    }
  }, [siswaId, location.pathname, loadRiwayatData]);


  // Load Banding Absen
  const loadBandingAbsen = useCallback(async () => {
    if (!siswaId) return;
    
    try {
      const data = await apiRequest<BandingAbsen[]>(`/api/siswa/${siswaId}/banding-absen`, {
        method: 'GET'
      });
      if (!Array.isArray(data)) {
        toast({
          title: "Error memuat banding",
          description: "Format data banding tidak valid.",
          variant: "destructive"
        });
        setBandingAbsen([]);
        return;
      }
      setBandingAbsen(data);
    } catch (error) {
      const message = resolveErrorMessage(error, 'Gagal memuat data banding absen.');
      toast({
        title: "Error memuat banding",
        description: message,
        variant: "destructive"
      });
      setBandingAbsen([]);
    }
  }, [siswaId, apiRequest]);

  // Load daftar siswa untuk banding absen
  const loadDaftarSiswa = useCallback(async () => {
    if (!siswaId) return;
    
    try {
      const data = await apiRequest(`/api/siswa/${siswaId}/daftar-siswa`, {
        method: 'GET'
      });
      if (!Array.isArray(data)) {
        toast({
          title: "Error memuat data siswa",
          description: "Format data siswa tidak valid.",
          variant: "destructive"
        });
        setDaftarSiswa([]);
        return;
      }
      setDaftarSiswa(data);
    } catch (error) {
      const message = resolveErrorMessage(error, 'Gagal memuat data siswa.');
      toast({
        title: "Error memuat data siswa",
        description: message,
        variant: "destructive"
      });
      setDaftarSiswa([]);
    }
  }, [siswaId, apiRequest]);

  // Note: loadSiswaStatus removed - was unused (replaced by loadSiswaStatusById)

  // Versi by-id: Load status kehadiran siswa menggunakan id_siswa (menghindari duplikasi nama)
  const loadSiswaStatusById = useCallback(async (idSiswa: number, tanggal: string, jadwalId: string) => {
    if (!siswaId || !idSiswa || !tanggal || !jadwalId) return;

    try {
      const data = await apiRequest<{ status?: string }>(
        `/api/siswa/${idSiswa}/status-kehadiran?tanggal=${tanggal}&jadwal_id=${jadwalId}`
      );

      const statusValue = typeof data?.status === 'string' ? data.status : 'alpa';

      const chosen = daftarSiswa.find(s => (s.id ?? s.id_siswa) === idSiswa);
      const siswaNama = chosen?.nama || '';

      // Update status data
      const statusKey = `${idSiswa}_${tanggal}_${jadwalId}`;
      setSiswaStatusData(prev => ({
        ...prev,
        [statusKey]: statusValue
      }));

      // Update form dengan status yang ditemukan
      const newSiswaBanding = [{
        nama: siswaNama,
        status_asli: statusValue as StatusType,
        status_diajukan: (formBanding.siswa_banding[0]?.status_diajukan || 'hadir') as StatusType,
        alasan_banding: formBanding.siswa_banding[0]?.alasan_banding || ''
      }];
      setFormBanding(prev => ({ ...prev, siswa_banding: newSiswaBanding }));
    } catch (error) {
      const message = resolveErrorMessage(error, 'Gagal memuat status kehadiran siswa.');
      toast({
        title: "Error memuat status",
        description: message,
        variant: "destructive"
      });
    }
  }, [siswaId, daftarSiswa, formBanding, apiRequest]);


  useEffect(() => {
    if (siswaId && location.pathname === '/siswa/banding') {
      loadBandingAbsen();
      loadRiwayatData();
      loadDaftarSiswa();
    }
  }, [siswaId, location.pathname, loadBandingAbsen, loadRiwayatData, loadDaftarSiswa]);

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
      const jadwalData = isEditMode ? jadwalBerdasarkanTanggal : jadwalHariIni;
      const missingAttendanceMapel = validateMultiGuruAttendanceCompleteness(jadwalData, kehadiranData);

      if (missingAttendanceMapel) {
        toast({
          title: 'Validasi Gagal',
          description: `Jadwal ${missingAttendanceMapel} memerlukan absensi untuk semua guru. Silakan lengkapi absensi untuk semua guru terlebih dahulu.`,
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      const requestData = {
        siswa_id: siswaId,
        kehadiran_data: buildKehadiranDataWithFlags(kehadiranData, adaTugasData),
        tanggal_absen: selectedDate
      };

      const result = await apiRequest<{ success?: boolean; message?: string; error?: unknown }>(
        '/api/siswa/submit-kehadiran-guru',
        {
          method: 'POST',
          body: JSON.stringify(requestData)
        }
      );

      if (isFailureResponse(result)) {
        toast({
          title: 'Gagal menyimpan',
          description: getResponseErrorText(result, 'Gagal menyimpan kehadiran guru.'),
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Berhasil',
        description: result?.message || 'Data kehadiran guru berhasil disimpan'
      });

      loadJadwalHariIni();
    } catch (error) {
      const message = resolveErrorMessage(error, 'Gagal menyimpan kehadiran guru.');
      toast({
        title: 'Gagal menyimpan',
        description: message,
        variant: 'destructive'
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
      const data = await apiRequest<{
        success?: boolean;
        data?: Array<{
          id_siswa: number;
          nis: string;
          nama: string;
          jenis_kelamin: string;
          jabatan: string;
          attendance_status?: string;
          keterangan?: string;
        }>;
        message?: string;
        error?: unknown;
      }>(`/api/siswa/${siswaId}/daftar-siswa-absen?jadwal_id=${jadwalId}`, {
        method: 'GET'
      });

      if (isFailureResponse(data)) {
        toast({
          title: "Error",
          description: getResponseErrorText(data, "Gagal memuat daftar siswa"),
          variant: "destructive"
        });
        setShowAbsenKelasModal(false);
        return;
      }

      if (data?.success) {
        const cleanData = (data.data || []).map(item => ({
          ...item,
          attendance_status: item.attendance_status || '',
          keterangan: item.keterangan || ''
        }));
        setDaftarSiswaKelas(cleanData);
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
          description: data?.message || "Gagal memuat daftar siswa",
          variant: "destructive"
        });
        setShowAbsenKelasModal(false);
      }
    } catch (error) {
      const message = resolveErrorMessage(error, 'Gagal memuat daftar siswa.');
      toast({
        title: "Error",
        description: message,
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
      const data = await apiRequest<{
        success?: boolean;
        message?: string;
        processed?: number;
        error?: unknown;
      }>('/api/siswa/submit-absensi-siswa', {
        method: 'POST',
        body: JSON.stringify({
          siswa_pencatat_id: siswaId,
          jadwal_id: absenKelasJadwalId,
          attendance_data: absenSiswaData
        })
      });

      if (isFailureResponse(data) || !data?.success) {
        toast({
          title: "Gagal",
          description: getResponseErrorText(data, "Gagal menyimpan absensi siswa"),
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: `Absensi ${data.processed || Object.keys(absenSiswaData).length} siswa berhasil disimpan`,
      });
      setShowAbsenKelasModal(false);
      setAbsenKelasJadwalId(null);
      setDaftarSiswaKelas([]);
      setAbsenSiswaData({});
    } catch (error) {
      const message = resolveErrorMessage(error, 'Gagal menyimpan absensi siswa.');
      toast({
        title: "Error",
        description: message,
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
      // Tentukan jadwal_id dan guru_id dari key menggunakan helper
      const parsedKey = parseJadwalKey(key);
      const { jadwalId } = parsedKey;
      const jadwalData = isEditMode ? jadwalBerdasarkanTanggal : jadwalHariIni;
      
      // Use extracted helper to resolve guru ID (reduces CC)
      const guruIdResult: ResolveGuruIdResult = resolveGuruIdForUpdate(
        jadwalId,
        parsedKey.guruId,
        parsedKey.isMultiGuru,
        jadwalData,
        kehadiranData[key]
      );

      if (guruIdResult.success === false) {
        const errorType = guruIdResult.error; // TypeScript narrow to error type
        const errorMessages: Record<'not_found' | 'multi_guru' | 'invalid_id', { title: string; desc: string }> = {
          'not_found': { title: 'Error', desc: 'Jadwal tidak ditemukan' },
          'multi_guru': { title: 'Pilih Guru', desc: 'Jadwal ini multi-guru. Silakan set status per guru.' },
          'invalid_id': { title: 'Error', desc: 'Jadwal ID atau Guru ID tidak valid' }
        };
        const msg = errorMessages[errorType];
        toast({ title: msg.title, description: msg.desc, variant: 'destructive' });
        setKehadiranData(prev => ({ ...prev, [key]: previousState }));
        return;
      }

      const guruId = guruIdResult.guruId;

      const tanggalTarget = isEditMode ? selectedDate : getCurrentDateWIB();
      
    
      await apiRequest('/api/siswa/update-status-guru', {
        method: 'POST',
        body: JSON.stringify({
          jadwal_id: jadwalId,
          guru_id: guruId,
          status,
          keterangan: kehadiranData[key]?.keterangan || '',
          tanggal_absen: tanggalTarget,
          ada_tugas: adaTugasData[key] || false
        })
      });

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
      const message = resolveErrorMessage(error, 'Gagal menyimpan status kehadiran.');
      handleKehadiranStatusUpdateError(key, previousState, message, setKehadiranData);
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
    if (isEditMode) {
      // Switching back to normal mode, load today's schedule
      loadJadwalHariIni();
    } else {
      // Switching to edit mode, load today's schedule
      const today = getCurrentDateWIB();
      setSelectedDate(today);
    }
  };

  // Handle date change
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
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
      const requestData = {
        jadwal_id: formBanding.jadwal_id ? Number.parseInt(formBanding.jadwal_id) : null,
        tanggal_absen: formBanding.tanggal_absen,
        status_asli: formBanding.siswa_banding[0]?.status_asli,
        status_diajukan: formBanding.siswa_banding[0]?.status_diajukan,
        alasan_banding: formBanding.siswa_banding[0]?.alasan_banding
      };
      
  
  
      
      const result = await apiRequest<{ success?: boolean; message?: string; error?: unknown }>(
        `/api/siswa/${selectedSiswaId}/banding-absen`,
        {
          method: 'POST',
          body: JSON.stringify(requestData)
        }
      );

      if (isFailureResponse(result) || !result?.success) {
        toast({
          title: "Gagal mengirim",
          description: getResponseErrorText(result, "Gagal mengirim pengajuan banding absen"),
          variant: "destructive"
        });
        return;
      }

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
    } catch (error) {
      const message = resolveErrorMessage(error, 'Gagal mengirim pengajuan banding absen.');
      toast({
        title: "Gagal mengirim",
        description: message,
        variant: "destructive"
      });
    }
  };

  const resetAbsenKelasModalState = useCallback((): void => {
    setShowAbsenKelasModal(false);
    setAbsenKelasJadwalId(null);
    setDaftarSiswaKelas([]);
    setAbsenSiswaData({});
  }, []);

  const handleSetSemuaSiswaHadir = useCallback((): void => {
    const newData: { [key: number]: { status: string; keterangan: string } } = {};
    daftarSiswaKelas.forEach((siswa) => {
      newData[siswa.id_siswa] = { status: 'Hadir', keterangan: '' };
    });
    setAbsenSiswaData(newData);
  }, [daftarSiswaKelas]);

  const handleUpdateAbsenSiswaStatus = useCallback((idSiswa: number, status: string): void => {
    setAbsenSiswaData((prev) => ({
      ...prev,
      [idSiswa]: { ...prev[idSiswa], status }
    }));
  }, []);

  const handleRetryInitialLoad = useCallback((): void => {
    setError(null);
    setInitialLoading(true);
    globalThis.location.reload();
  }, []);

  const renderInitialLoadingState = (): React.ReactElement => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <Card className="w-96">
        <CardContent className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Memuat Data...</h3>
          <p className="text-muted-foreground">Sedang memuat informasi siswa</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderErrorState = (errorMessage: string): React.ReactElement => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <XCircle className="w-16 h-16 mx-auto text-red-500 mb-6" />
          <h3 className="text-xl font-bold text-foreground mb-3">Terjadi Kesalahan</h3>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm font-medium mb-2">Pesan Error:</p>
            <p className="text-red-600 text-sm">{errorMessage}</p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleRetryInitialLoad}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Coba Lagi
            </Button>

            <Button
              onClick={onLogout}
              variant="outline"
              className="w-full"
            >
              Kembali ke Login
            </Button>

            {errorMessage.includes('server backend') && (
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

  const renderDashboardLayout = (): React.ReactElement => (
    <div className="min-h-screen bg-background">
      <StudentSidebar
        locationPathname={location.pathname}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        navigate={navigate}
        userName={currentUserData.nama}
        onLogout={onLogout}
        onEditProfile={() => setShowEditProfile(true)}
        notifications={notifications}
        unreadCount={unreadCount}
        notifLoading={notifLoading}
        notifRefresh={notifRefresh}
      />

      <div className="lg:ml-64">
        <div className="p-4 lg:p-6">
          <StudentMainHeader userName={currentUserData.nama} onOpenSidebar={() => setSidebarOpen(true)} />
          <StudentDashboardRoutes
            loading={loading}
            isEditMode={isEditMode}
            kelasInfo={kelasInfo}
            selectedDate={selectedDate}
            minDate={minDate}
            maxDate={maxDate}
            jadwalHariIni={jadwalHariIni}
            jadwalBerdasarkanTanggal={jadwalBerdasarkanTanggal}
            kehadiranData={kehadiranData}
            adaTugasData={adaTugasData}
            isUpdatingStatus={isUpdatingStatus}
            toggleEditMode={toggleEditMode}
            handleDateChange={handleDateChange}
            updateKehadiranStatus={updateKehadiranStatus}
            updateKehadiranKeterangan={updateKehadiranKeterangan}
            setAdaTugasData={setAdaTugasData}
            submitKehadiran={submitKehadiran}
            openAbsenKelasModal={openAbsenKelasModal}
            riwayatData={riwayatData}
            riwayatPage={riwayatPage}
            setRiwayatPage={setRiwayatPage}
            detailRiwayat={detailRiwayat}
            setDetailRiwayat={setDetailRiwayat}
            bandingAbsen={bandingAbsen}
            expandedBanding={expandedBanding}
            setExpandedBanding={setExpandedBanding}
            showFormBanding={showFormBanding}
            setShowFormBanding={setShowFormBanding}
            formBanding={formBanding}
            setFormBanding={setFormBanding}
            setJadwalBerdasarkanTanggal={setJadwalBerdasarkanTanggal}
            loadingJadwal={loadingJadwal}
            selectedSiswaId={selectedSiswaId}
            setSelectedSiswaId={setSelectedSiswaId}
            daftarSiswa={daftarSiswa}
            bandingAbsenPage={bandingAbsenPage}
            setBandingAbsenPage={setBandingAbsenPage}
            itemsPerPage={itemsPerPage}
            submitBandingAbsen={submitBandingAbsen}
            loadJadwalBandingByDate={loadJadwalBandingByDate}
            loadSiswaStatusById={loadSiswaStatusById}
          />
        </div>
      </div>

      <div className="fixed bottom-4 right-4 flex items-center gap-2 lg:hidden z-50">
        <FontSizeControl variant="floating" />
        <ModeToggle />
      </div>

      <StudentAbsenKelasModal
        show={showAbsenKelasModal}
        loadingAbsenKelas={loadingAbsenKelas}
        daftarSiswaKelas={daftarSiswaKelas}
        absenSiswaData={absenSiswaData}
        absenKelasGuruNama={absenKelasGuruNama}
        onClose={resetAbsenKelasModalState}
        onSetSemuaSiswaHadir={handleSetSemuaSiswaHadir}
        onUpdateStatus={handleUpdateAbsenSiswaStatus}
        onSubmit={submitAbsenKelas}
      />

      {showEditProfile && (
        <EditProfile
          userData={currentUserData}
          onUpdate={handleUpdateProfile}
          onClose={() => setShowEditProfile(false)}
          {...{ role: 'siswa' }}
        />
      )}
    </div>
  );

  // Show loading or error states
  if (initialLoading) {
    return renderInitialLoadingState();
  }

  if (error) {
    return renderErrorState(error);
  }

  return renderDashboardLayout();
};
