import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeInput } from "@/components/ui/time-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { formatTime24WithSeconds, formatDateTime24, formatDateOnly, getCurrentDateWIB, getCurrentYearWIB, formatDateWIB, getWIBTime } from "@/lib/time-utils";
import { JadwalService } from "@/services/jadwalService";
import { FontSizeControl } from "@/components/ui/font-size-control";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorBoundary from "./ErrorBoundary";
import BackupManagementView from "./BackupManagementView";
import MonitoringDashboard from "./MonitoringDashboard";
import JamPelajaranConfig from "./JamPelajaranConfig";
import SimpleRestoreView from "./SimpleRestoreView";
import { printReport } from "../utils/printLayouts";
import ExcelPreview from './ExcelPreview';
// import ReportHeader from './ReportHeader';
import PresensiSiswaView from './PresensiSiswaView';
import RekapKetidakhadiranView from './RekapKetidakhadiranView';
import RekapKetidakhadiranGuruView from './RekapKetidakhadiranGuruView';
import ExcelImportView from './ExcelImportView';
import { VIEW_TO_REPORT_KEY } from '../utils/reportKeys';
import { EditProfile } from './EditProfile';
import ReportLetterheadSettings from './ReportLetterheadSettings';
import { useLetterhead } from '../hooks/useLetterhead';
import { apiCall } from '@/utils/apiClient';
import { getApiUrl } from '@/config/api';
import { 
  UserPlus, BookOpen, Calendar, BarChart3, LogOut, ArrowLeft, ArrowRight, Users, GraduationCap, 
  Eye, EyeOff, Download, FileText, Edit, Trash2, Plus, Search, Filter, Settings, Bell, Menu, X,
  TrendingUp, BookPlus, Home, Clock, CheckCircle, CheckCircle2, XCircle, AlertCircle, AlertTriangle, MessageCircle, ClipboardList, Activity,
  Database, Archive, Activity, Server, Monitor, Shield, RefreshCw, ArrowUpCircle, User, FileText as FileTextIcon,
  Printer, Maximize2, Minimize2, Award, Star
} from "lucide-react";

// Types
interface Teacher {
  id: number;
  nip: string;
  nama: string;
  username: string;
  email?: string;
  no_telp?: string;
  jenis_kelamin?: 'L' | 'P';
  alamat?: string;
  address?: string;
  user_alamat?: string;
  user_address?: string;
  status: 'aktif' | 'nonaktif';
  mata_pelajaran?: string;
  mapel_id?: number;
  nama_mapel?: string;
  user_id?: number;
  user_username?: string;
  user_email?: string;
  user_status?: string;
}

interface TeacherData {
  id: number;
  nip: string;
  nama: string;
  email?: string;
  mata_pelajaran?: string;
  alamat?: string;
  telepon?: string;
  jenis_kelamin: 'L' | 'P';
  status: 'aktif' | 'nonaktif';
}

interface Student {
  id: number;
  nis: string;
  nama: string;
  kelas_id: number;
  nama_kelas: string;
  username?: string;
  email?: string;
  jenis_kelamin: 'L' | 'P';
  jabatan?: string;
  status: 'aktif' | 'nonaktif';
  alamat?: string;
  telepon_orangtua?: string;
  nomor_telepon_siswa?: string;
}

interface StudentData {
  id_siswa: number;
  nis: string;
  nama: string;
  kelas_id: number;
  nama_kelas?: string;
  jenis_kelamin: 'L' | 'P';
  alamat?: string;
  telepon_orangtua?: string;
  nomor_telepon_siswa?: string;
  status: 'aktif' | 'nonaktif';
  username?: string;
  password?: string;
  email?: string;
  jabatan?: string;
}

interface Subject {
  id: number;
  kode_mapel: string;
  nama_mapel: string;
  deskripsi?: string;
  status: 'aktif' | 'tidak_aktif';
}

interface Kelas {
  id: number;
  id_kelas?: number;
  nama_kelas: string;
  tingkat?: string;
  status?: 'aktif' | 'tidak_aktif';
}

interface Schedule {
  id: number;
  kelas_id: number;
  mapel_id: number | null;
  guru_id: number | null;
  ruang_id?: number;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  jam_ke?: number;
  jenis_aktivitas: 'pelajaran' | 'upacara' | 'istirahat' | 'kegiatan_khusus' | 'libur' | 'ujian' | 'lainnya';
  is_absenable: boolean;
  keterangan_khusus: string | null;
  is_multi_guru: boolean;
  guru_list?: string; // Format: "1:Budi||2:Siti"
  guru_ids?: number[];
  guru_names?: string[];
  nama_kelas: string;
  nama_mapel: string;
  nama_guru: string;
  kode_ruang?: string;
  nama_ruang?: string;
  lokasi?: string;
}

interface Room {
  id: number;
  kode_ruang: string;
  nama_ruang?: string;
  lokasi?: string;
  kapasitas?: number;
  status: 'aktif' | 'tidak_aktif';
  created_at: string;
}

interface LiveData {
  ongoing_classes: Array<{
    id?: number;
    id_kelas?: number;
    kelas: string;
    guru: string;
    mapel: string;
    jam: string;
    nama_kelas?: string;
    nama_mapel?: string;
    nama_guru?: string;
    jam_mulai?: string;
    jam_selesai?: string;
    absensi_diambil?: number;
  }>;
  overall_attendance_percentage?: string;
}

interface AdminDashboardProps {
  onLogout: () => void;
}

const menuItems = [
  { id: 'add-teacher', title: 'Tambah Akun Guru', icon: UserPlus, description: 'Kelola akun guru', gradient: 'from-blue-500 to-blue-700' },
  { id: 'add-student', title: 'Tambah Akun Siswa', icon: UserPlus, description: 'Kelola akun siswa perwakilan', gradient: 'from-green-500 to-green-700' },
  { id: 'add-teacher-data', title: 'Data Guru', icon: GraduationCap, description: 'Input dan kelola data guru', gradient: 'from-purple-500 to-purple-700' },
  { id: 'add-student-data', title: 'Data Siswa', icon: Users, description: 'Input dan kelola data siswa lengkap', gradient: 'from-orange-500 to-orange-700' },
  { id: 'student-promotion', title: 'Naik Kelas', icon: ArrowUpCircle, description: 'Kelola kenaikan kelas siswa', gradient: 'from-emerald-500 to-emerald-700' },
  { id: 'add-subject', title: 'Mata Pelajaran', icon: BookOpen, description: 'Kelola mata pelajaran', gradient: 'from-red-500 to-red-700' },
  { id: 'add-class', title: 'Kelas', icon: Home, description: 'Kelola kelas', gradient: 'from-indigo-500 to-indigo-700' },
  { id: 'add-schedule', title: 'Jadwal', icon: Calendar, description: 'Atur jadwal pelajaran', gradient: 'from-teal-500 to-teal-700' },
  { id: 'add-room', title: 'Ruang Kelas', icon: Home, description: 'Kelola ruang kelas', gradient: 'from-amber-500 to-amber-700' },
  { id: 'backup-management', title: 'Backup & Archive', icon: Database, description: 'Kelola backup dan arsip data', gradient: 'from-cyan-500 to-cyan-700' },
  { id: 'monitoring', title: 'System Monitoring', icon: Monitor, description: 'Real-time monitoring & alerting', gradient: 'from-violet-500 to-violet-700' },
  { id: 'disaster-recovery', title: 'Restorasi Backup', icon: Shield, description: 'Restorasi dan pemulihan backup', gradient: 'from-amber-500 to-amber-700' },
  { id: 'letterhead-settings', title: 'Kop Laporan', icon: FileTextIcon, description: 'Kelola header/kop untuk semua laporan', gradient: 'from-slate-500 to-slate-700' },
  { id: 'reports', title: 'Laporan', icon: BarChart3, description: 'Pemantau siswa & guru live', gradient: 'from-pink-500 to-pink-700' }
];

// ManageTeacherAccountsView Component
const ManageTeacherAccountsView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [formData, setFormData] = useState({
    nama: '', 
    username: '', 
    password: '', 
    nip: '', 
    mapel_id: '', 
    email: '', 
    no_telp: '', 
    jenis_kelamin: '' as 'L' | 'P' | '', 
    alamat: '', 
    status: 'aktif' as 'aktif' | 'nonaktif'
  });
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fetchTeachers = useCallback(async () => {
    try {
      const response = await apiCall('/api/admin/guru', { onLogout });
      // console.log();
      console.log('🔍 Response structure:', {
        hasData: !!response.data,
        hasSuccess: !!response.success,
        dataLength: response.data?.length || 0,
        directLength: Array.isArray(response) ? response.length : 0
      });
      // console.log();
      
      // Handle both response structures
      const teachersData = response.data || response;
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast({ title: "Error memuat data guru", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);

  const fetchSubjects = useCallback(async () => {
    try {
      const response = await apiCall('/api/admin/subjects', { onLogout });
      setSubjects(response.data || response);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      // Don't show error toast for subjects as it's not critical
    }
  }, [onLogout]);

  useEffect(() => {
    fetchTeachers();
    fetchSubjects();
  }, [fetchTeachers, fetchSubjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi client-side
    if (!formData.nama || !formData.username || !formData.nip) {
      toast({ title: "Error", description: "Nama, username, dan NIP wajib diisi!", variant: "destructive" });
      return;
    }

    if (!editingId && !formData.password) {
      toast({ title: "Error", description: "Password wajib diisi untuk akun baru!", variant: "destructive" });
      return;
    }

    // Validasi format NIP (lebih fleksibel untuk format NIP Indonesia)
    if (!/^[0-9]{10,20}$/.test(formData.nip)) {
      toast({ title: "Error", description: "NIP harus berupa angka 10-20 digit!", variant: "destructive" });
      return;
    }

    // Validasi format username
    if (!/^[a-zA-Z0-9._-]{4,32}$/.test(formData.username)) {
      toast({ title: "Error", description: "Username harus 4-32 karakter, hanya huruf, angka, titik, underscore, dan strip!", variant: "destructive" });
      return;
    }

    // Validasi format email jika diisi
    if (formData.email && formData.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({ title: "Error", description: "Format email tidak valid!", variant: "destructive" });
      return;
    }

    // Validasi no_telp jika diisi
    if (formData.no_telp && formData.no_telp.trim() !== '' && !/^[\d+]{1,20}$/.test(formData.no_telp.trim())) {
      toast({ title: "Error", description: "Nomor telepon harus berupa angka dan plus, maksimal 20 karakter!", variant: "destructive" });
      return;
    }

    // Validasi mapel_id jika diisi
    if (formData.mapel_id && formData.mapel_id !== '' && (!Number.isInteger(Number(formData.mapel_id)) || Number(formData.mapel_id) <= 0)) {
      toast({ title: "Error", description: "ID mata pelajaran harus berupa angka positif!", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const url = editingId ? `/api/admin/guru/${editingId}` : '/api/admin/guru';
      const method = editingId ? 'PUT' : 'POST';
      
      const submitData = {
        nip: formData.nip.trim(),
        nama: formData.nama.trim(),
        username: formData.username.trim(),
        password: formData.password || undefined, // Jangan kirim password kosong untuk update
        email: formData.email && formData.email.trim() !== '' ? formData.email.trim() : null,
        no_telp: formData.no_telp && formData.no_telp.trim() !== '' ? formData.no_telp.trim() : null,
        jenis_kelamin: formData.jenis_kelamin ? formData.jenis_kelamin : null,
        alamat: formData.alamat && formData.alamat.trim() !== '' ? formData.alamat.trim() : null,
        mapel_id: formData.mapel_id && formData.mapel_id !== '' ? parseInt(formData.mapel_id) : null,
        status: formData.status
      };

      // console.log();

      await apiCall(url, {
        method,
        body: JSON.stringify(submitData),
        onLogout
      });

      toast({ title: editingId ? "Akun guru berhasil diupdate!" : "Akun guru berhasil ditambahkan!" });
      setFormData({ 
        nama: '', 
        username: '', 
        password: '', 
        nip: '', 
        mapel_id: '', 
        email: '', 
        no_telp: '', 
        jenis_kelamin: '' as 'L' | 'P' | '', 
        alamat: '', 
        status: 'aktif' as 'aktif' | 'nonaktif'
      });
      setEditingId(null);
      setDialogOpen(false);
      fetchTeachers();
    } catch (error) {
      console.error('Error submitting teacher:', error);
      
      // Tampilkan error detail dari server jika ada
      if (error.details) {
        const errorMessage = Array.isArray(error.details) ? error.details.join(', ') : error.details;
        toast({ 
          title: "Error Validasi", 
          description: errorMessage, 
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Error", 
          description: error.message || "Gagal menyimpan data guru", 
          variant: "destructive" 
        });
      }
    }

    setIsLoading(false);
  };

  const handleEdit = (teacher: Teacher) => {
    setFormData({
      nama: teacher.nama || '',
      username: teacher.username || teacher.user_username || '',
      password: '',
      nip: teacher.nip || '',
      mapel_id: teacher.mapel_id ? String(teacher.mapel_id) : '',
      email: teacher.email || teacher.user_email || '',
      no_telp: teacher.no_telp || '',
      jenis_kelamin: teacher.jenis_kelamin || '' as 'L' | 'P' | '',
      alamat: teacher.alamat || teacher.address || teacher.user_alamat || teacher.user_address || '',
      status: teacher.status || 'aktif' as 'aktif' | 'nonaktif'
    });
    setEditingId(teacher.id);
    setDialogOpen(true);
  };  const handleDelete = async (id: number, nama: string) => {
    // Confirmation dialog
    if (!window.confirm(`Yakin ingin menghapus akun guru "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    
    try {
      await apiCall(`/api/admin/guru/${id}`, {
        method: 'DELETE',
        onLogout
      });

      toast({ title: `Akun guru ${nama} berhasil dihapus` });
      fetchTeachers();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      toast({ title: "Error menghapus akun guru", description: error.message, variant: "destructive" });
    }
  };

  const filteredTeachers = teachers.filter(teacher => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (teacher.nama && teacher.nama.toLowerCase().includes(searchLower)) ||
      (teacher.username && teacher.username.toLowerCase().includes(searchLower)) ||
      (teacher.nip && teacher.nip.toLowerCase().includes(searchLower))
    );
  });

  if (showImport) {
    return <ExcelImportView entityType="teacher-account" entityName="Akun Guru" onBack={() => setShowImport(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button onClick={onBack} variant="outline" size="sm" className="self-start">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              Kelola Akun Guru
            </h1>
            <p className="text-sm text-gray-600">Tambah, edit, dan hapus akun login guru</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="w-full sm:w-auto text-xs">
            <Download className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Import Excel</span>
            <span className="sm:hidden">Import</span>
          </Button>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingId(null);
                setFormData({ 
                  nama: '', username: '', password: '', nip: '', mapel_id: '', email: '', no_telp: '', jenis_kelamin: '' as 'L' | 'P' | '', alamat: '', status: 'aktif' as 'aktif' | 'nonaktif'
                });
              }}
              size="sm"
              className="w-full sm:w-auto text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Tambah Akun Guru</span>
              <span className="sm:hidden">Tambah Guru</span>
            </Button>
          </DialogTrigger>
          <DialogContent 
            className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 50,
              width: '95vw',
              maxWidth: '42rem',
              margin: '0',
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              boxSizing: 'border-box'
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-base">{editingId ? 'Edit Akun Guru' : 'Tambah Akun Guru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Field 1: NIP - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="nip" className="text-sm font-medium">NIP *</Label>
                  <Input
                    id="nip"
                    value={formData.nip}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    placeholder="Masukkan NIP"
                    className="mt-1"
                    required
                  />
                </div>
                {/* Field 2: Nama Lengkap - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="nama" className="text-sm font-medium">Nama Lengkap *</Label>
                  <Input
                    id="nama"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    placeholder="Masukkan nama lengkap"
                    className="mt-1"
                    required
                  />
                </div>
                {/* Field 3: Username - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Masukkan username"
                    required
                  />
                </div>
                {/* Field 4: Email - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Masukkan email"
                  />
                </div>
                {/* Field 5: No. Telepon - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="no_telp">No. Telepon</Label>
                  <Input
                    id="no_telp"
                    value={formData.no_telp}
                    onChange={(e) => setFormData({ ...formData, no_telp: e.target.value })}
                    placeholder="Masukkan nomor telepon"
                  />
                </div>
                {/* Field 6: Jenis Kelamin - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="jenis_kelamin">Jenis Kelamin</Label>
                  <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value as 'L' | 'P' | '' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Field 7: Alamat - sesuai urutan tabel */}
                <div className="sm:col-span-2">
                  <Label htmlFor="alamat">Alamat</Label>
                  <Input
                    id="alamat"
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                    placeholder="Masukkan alamat lengkap"
                  />
                </div>
                {/* Field 8: Mata Pelajaran - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="mapel_id">Mata Pelajaran</Label>
                  <Select value={formData.mapel_id} onValueChange={(value) => setFormData({ ...formData, mapel_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih mata pelajaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        // FIXED: Enhanced deduplication to prevent looping
                        const uniqueSubjects = subjects.filter((subject, index, self) => {
                          // Use multiple fields to ensure uniqueness
                          const key = `${subject.id}-${subject.nama_mapel}-${subject.kode_mapel}`;
                          return self.findIndex(s => 
                            `${s.id}-${s.nama_mapel}-${s.kode_mapel}` === key
                          ) === index;
                        });
                        
                        return uniqueSubjects.map((subject) => (
                          <SelectItem key={subject.id} value={String(subject.id)}>
                            {subject.nama_mapel}
                          </SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                {/* Field 9: Status - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as 'aktif' | 'nonaktif' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aktif">Aktif</SelectItem>
                      <SelectItem value="nonaktif">Non-aktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Field Password - untuk keamanan, tidak ditampilkan di tabel tapi tetap diperlukan */}
                <div className="sm:col-span-2">
                  <Label htmlFor="password">
                    Password {editingId ? '(Kosongkan jika tidak ingin mengubah)' : '*'}
                  </Label>
                  <div className="relative">
                  <Input
                    id="password"
                      type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Masukkan password"
                    required={!editingId}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isLoading}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  Batal
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full sm:w-auto order-1 sm:order-2"
                >
                  {isLoading ? 'Menyimpan...' : editingId ? 'Update' : 'Simpan'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cari berdasarkan nama, username, atau NIP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 self-start sm:self-center">
              {filteredTeachers.length} guru ditemukan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            Daftar Akun Guru
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTeachers.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
              <p className="text-sm text-gray-600 mb-4">
                {searchTerm ? 'Tidak ada guru yang sesuai dengan pencarian' : 'Belum ada akun guru yang ditambahkan'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setDialogOpen(true)} size="sm" className="w-full sm:w-auto text-xs">
                  <Plus className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Tambah Akun Guru Pertama</span>
                  <span className="sm:hidden">Tambah Guru Pertama</span>
                </Button>
              )}
            </div>
          ) : (
            <>
            {/* Desktop Table View - hidden on mobile and tablet */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-xs">#</TableHead>
                    <TableHead className="text-xs">NIP</TableHead>
                    <TableHead className="text-xs">Nama Lengkap</TableHead>
                    <TableHead className="text-xs">Username</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">No. Telepon</TableHead>
                    <TableHead className="text-xs">Jenis Kelamin</TableHead>
                    <TableHead className="text-xs">Alamat</TableHead>
                    <TableHead className="text-xs">Mata Pelajaran</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-center text-xs">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.map((teacher, index) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="text-gray-500 text-xs sm:text-sm">{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm">{teacher.nip || '-'}</TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm">{teacher.nama || '-'}</TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm">{teacher.username || teacher.user_username || '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{teacher.email || teacher.user_email || '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{teacher.no_telp || '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{teacher.jenis_kelamin === 'L' ? 'Laki-laki' : teacher.jenis_kelamin === 'P' ? 'Perempuan' : '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm max-w-24 sm:max-w-32 truncate" title={teacher.alamat || teacher.address || teacher.user_alamat || teacher.user_address || 'Tidak ada alamat'}>
                        {teacher.alamat || teacher.address || teacher.user_alamat || teacher.user_address || '-'}
                        {/* Debug: {JSON.stringify(teacher)} */}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{teacher.nama_mapel || '-'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={teacher.status === 'aktif' ? 'default' : 'destructive'}
                          className={`text-xs px-1 py-0.5 ${teacher.status === 'aktif' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                        >
                          {teacher.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(teacher)}
                            className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                          >
                            <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline ml-1">Edit</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700 h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                              >
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline ml-1">Hapus</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Akun Guru</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus akun guru <strong>{teacher.nama}</strong>?
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(teacher.id, teacher.nama)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile & Tablet Card View */}
            <div className="lg:hidden space-y-3">
              {filteredTeachers.map((teacher, index) => (
                <Card key={teacher.id} className="p-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{teacher.nama || '-'}</h3>
                        <p className="text-xs text-gray-500 font-mono">{teacher.nip || '-'}</p>
                        <p className="text-xs text-gray-500">@{teacher.username || teacher.user_username || '-'}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(teacher)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 h-7 w-7 p-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Akun Guru</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus akun guru <strong>{teacher.nama}</strong>?
                                Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(teacher.id, teacher.nama)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Email:</span>
                        <p className="truncate">{teacher.email || teacher.user_email || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Telepon:</span>
                        <p>{teacher.no_telp || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Jenis Kelamin:</span>
                        <p>{teacher.jenis_kelamin === 'L' ? 'Laki-laki' : teacher.jenis_kelamin === 'P' ? 'Perempuan' : '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <Badge 
                          variant={teacher.status === 'aktif' ? 'default' : 'destructive'}
                          className={`text-xs ${teacher.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {teacher.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </div>
                    </div>
                    
                    {teacher.nama_mapel && (
                      <div>
                        <span className="text-gray-500 text-xs">Mata Pelajaran:</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs ml-1">
                          {teacher.nama_mapel}
                        </Badge>
                      </div>
                    )}
                    
                    {teacher.alamat && (
                      <div>
                        <span className="text-gray-500 text-xs">Alamat:</span>
                        <p className="text-xs mt-1">{teacher.alamat}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ManageStudentDataView Component
const ManageStudentDataView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [formData, setFormData] = useState({ 
    nis: '', 
    nama: '', 
    kelas_id: '',
    jenis_kelamin: '' as 'L' | 'P' | '',
    alamat: '',
    telepon_orangtua: '',
    nomor_telepon_siswa: '',
    status: 'aktif' as 'aktif' | 'nonaktif',
    username: '',
    password: '',
    email: '',
    jabatan: 'Siswa'
  });
  const [studentsData, setStudentsData] = useState<StudentData[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);

  const fetchStudentsData = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/students-data', { onLogout });
      setStudentsData(data);
    } catch (error) {
      console.error('Error fetching students data:', error);
      toast({ title: "Error memuat data siswa", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);

  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/kelas', { onLogout });
      setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast({ title: "Error memuat data kelas", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);

  useEffect(() => {
    fetchStudentsData();
    fetchClasses();
  }, [fetchStudentsData, fetchClasses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // === VALIDASI CLIENT-SIDE (konsisten dengan Tambah Akun Siswa) ===
    // Required fields
    if (!formData.nis || !formData.nama) {
      toast({ title: "Error", description: "NIS dan Nama wajib diisi!", variant: "destructive" });
      return;
    }

    // NIS format: 8-20 digit angka
    if (!/^[0-9]{8,20}$/.test(formData.nis)) {
      toast({ title: "Error", description: "NIS harus berupa angka 8-20 digit!", variant: "destructive" });
      return;
    }

    // Email format (jika diisi)
    if (formData.email && formData.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({ title: "Error", description: "Format email tidak valid!", variant: "destructive" });
      return;
    }

    // Telepon siswa format (jika diisi)
    if (formData.nomor_telepon_siswa && formData.nomor_telepon_siswa.trim() !== '' && !/^[\d+]{1,20}$/.test(formData.nomor_telepon_siswa.trim())) {
      toast({ title: "Error", description: "Nomor telepon siswa harus berupa angka, maksimal 20 karakter!", variant: "destructive" });
      return;
    }

    // Telepon orangtua format (jika diisi)
    if (formData.telepon_orangtua && formData.telepon_orangtua.trim() !== '' && !/^[\d+]{1,20}$/.test(formData.telepon_orangtua.trim())) {
      toast({ title: "Error", description: "Nomor telepon orangtua harus berupa angka, maksimal 20 karakter!", variant: "destructive" });
      return;
    }

    // Username format (jika diisi - untuk perwakilan kelas)
    if (formData.username && formData.username.trim() !== '' && !/^[a-zA-Z0-9._-]{4,32}$/.test(formData.username)) {
      toast({ title: "Error", description: "Username harus 4-32 karakter, hanya huruf, angka, titik, underscore, dan strip!", variant: "destructive" });
      return;
    }
    // === END VALIDASI ===

    setIsLoading(true);

    try {
      const url = editingId ? `/api/admin/students-data/${editingId}` : '/api/admin/students-data';
      const method = editingId ? 'PUT' : 'POST';
      
      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout
      });

      toast({ title: editingId ? "Data siswa berhasil diupdate!" : "Data siswa berhasil ditambahkan!" });
      setFormData({ 
        nis: '', 
        nama: '', 
        kelas_id: '',
        jenis_kelamin: '' as 'L' | 'P' | '',
        alamat: '',
        telepon_orangtua: '',
        nomor_telepon_siswa: '',
        status: 'aktif' as 'aktif' | 'nonaktif',
        username: '',
        password: '',
        email: '',
        jabatan: 'Siswa'
      });
      setEditingId(null);
      fetchStudentsData();
    } catch (error) {
      console.error('Error submitting student data:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsLoading(false);
  };

  const handleEdit = (student: StudentData) => {
    setFormData({ 
      nis: student.nis, 
      nama: student.nama, 
      kelas_id: student.kelas_id.toString(),
      jenis_kelamin: student.jenis_kelamin,
      alamat: student.alamat || '',
      telepon_orangtua: student.telepon_orangtua || '',
      nomor_telepon_siswa: student.nomor_telepon_siswa || '',
      status: student.status,
      username: student.username || '',
      password: '',
      email: student.email || '',
      jabatan: student.jabatan || 'Siswa'
    });
    setEditingId(student.id_siswa);
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!window.confirm(`Yakin ingin menghapus data siswa "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      await apiCall(`/api/admin/students-data/${id}`, {
        method: 'DELETE',
        onLogout
      });

      toast({ title: `Data siswa ${nama} berhasil dihapus` });
      fetchStudentsData();
    } catch (error) {
      console.error('Error deleting student data:', error);
      toast({ title: "Error menghapus data siswa", description: error.message, variant: "destructive" });
    }
  };

  const filteredStudents = studentsData.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (student.nama && student.nama.toLowerCase().includes(searchLower)) ||
      (student.nis && student.nis.toLowerCase().includes(searchLower)) ||
      (student.nama_kelas && student.nama_kelas.toLowerCase().includes(searchLower))
    );
  });

  if (showImport) {
    return <ExcelImportView entityType="siswa" entityName="Data Siswa" onBack={() => setShowImport(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button onClick={onBack} variant="outline" size="sm" className="self-start">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent">
              Kelola Data Siswa
            </h1>
            <p className="text-sm text-muted-foreground">Tambah dan kelola data lengkap siswa</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Import Excel
          </Button>
        </div>
      </div>

      {/* Add Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            {editingId ? 'Edit Data Siswa' : 'Tambah Data Siswa'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="student-nis" className="text-sm font-medium">NIS *</Label>
                <Input 
                  id="student-nis" 
                  value={formData.nis} 
                  onChange={(e) => setFormData({...formData, nis: e.target.value})} 
                  placeholder="Nomor Induk Siswa"
                  className="mt-1"
                  required 
                />
              </div>
              <div>
                <Label htmlFor="student-nama" className="text-sm font-medium">Nama Lengkap *</Label>
                <Input 
                  id="student-nama" 
                  value={formData.nama} 
                  onChange={(e) => setFormData({...formData, nama: e.target.value})} 
                  placeholder="Nama lengkap siswa"
                  className="mt-1"
                  required 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="student-class" className="text-sm font-medium">Kelas *</Label>
                <Select value={formData.kelas_id} onValueChange={(value) => setFormData({...formData, kelas_id: value})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.filter(cls => cls.id).map((cls, index) => (
                      <SelectItem key={`class-filter-${cls.id}-${index}`} value={cls.id.toString()}>
                        {cls.nama_kelas}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="student-gender" className="text-sm font-medium">Jenis Kelamin *</Label>
                <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({...formData, jenis_kelamin: value as 'L' | 'P'})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih jenis kelamin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="student-telp" className="text-sm font-medium">Telepon Orang Tua</Label>
                <Input 
                  id="student-telp" 
                  value={formData.telepon_orangtua} 
                  onChange={(e) => setFormData({...formData, telepon_orangtua: e.target.value})} 
                  placeholder="Nomor telepon orang tua"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="student-phone" className="text-sm font-medium">Nomor Telepon Siswa</Label>
                <Input 
                  id="student-phone" 
                  value={formData.nomor_telepon_siswa || ''} 
                  onChange={(e) => setFormData({...formData, nomor_telepon_siswa: e.target.value})} 
                  placeholder="Nomor telepon pribadi siswa (10-15 digit)"
                  pattern="[0-9]{10,15}"
                  title="Nomor telepon harus berupa angka 10-15 digit"
                  className="mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="student-alamat" className="text-sm font-medium">Alamat</Label>
              <Textarea 
                id="student-alamat" 
                value={formData.alamat} 
                onChange={(e) => setFormData({...formData, alamat: e.target.value})} 
                placeholder="Alamat lengkap siswa"
                rows={2}
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="student-status" className="text-sm font-medium">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value as 'aktif' | 'nonaktif'})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="nonaktif">Non-aktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <Button type="submit" disabled={isLoading} className="bg-orange-600 hover:bg-orange-700 text-sm">
                {isLoading ? 'Menyimpan...' : (editingId ? 'Update' : 'Tambah')}
              </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={() => {
                      setEditingId(null);
                      setFormData({ 
                        nis: '', 
                        nama: '', 
                        kelas_id: '',
                        jenis_kelamin: '' as 'L' | 'P' | '',
                        alamat: '',
                        telepon_orangtua: '',
                        nomor_telepon_siswa: '',
                        status: 'aktif' as 'aktif' | 'nonaktif',
                        username: '',
                        password: '',
                        email: '',
                        jabatan: 'Siswa'
                      });
                    }} className="text-sm">
                      Batal
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cari berdasarkan nama, NIS, atau kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Badge variant="secondary" className="px-2 py-1 text-xs whitespace-nowrap">
              {filteredStudents.length} siswa ditemukan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            Daftar Data Siswa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
              <p className="text-sm text-gray-600">
                {searchTerm ? 'Tidak ada siswa yang cocok dengan pencarian' : 'Belum ada data siswa yang ditambahkan'}
              </p>
            </div>
          ) : (
            <>
            {/* Desktop Table View - hidden on mobile and tablet */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-xs">#</TableHead>
                    <TableHead className="text-xs">NIS</TableHead>
                    <TableHead className="text-xs">Nama</TableHead>
                    <TableHead className="text-xs">Kelas</TableHead>
                    <TableHead className="text-xs">Jenis Kelamin</TableHead>
                    <TableHead className="text-xs">Alamat</TableHead>
                    <TableHead className="text-xs">Telepon Ortu</TableHead>
                    <TableHead className="text-xs">Telepon Siswa</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-center text-xs">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student, index) => (
                    <TableRow key={student.id_siswa}>
                      <TableCell className="text-gray-500 text-sm">{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{student.nis}</TableCell>
                      <TableCell className="font-medium">{student.nama}</TableCell>
                      <TableCell>
                        {student.nama_kelas ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {student.nama_kelas}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {student.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-32 truncate" title={student.alamat}>
                        {student.alamat || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {student.telepon_orangtua || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {student.nomor_telepon_siswa || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={student.status === 'aktif' ? 'default' : 'secondary'}
                          className={student.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                        >
                          {student.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(student)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Data Siswa</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus data siswa <strong>{student.nama}</strong>?
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(student.id_siswa, student.nama)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile & Tablet Card View */}
            <div className="lg:hidden space-y-3">
              {filteredStudents.map((student, index) => (
                <Card key={student.id_siswa} className="p-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{student.nama}</h3>
                        <p className="text-xs text-gray-500 font-mono">NIS: {student.nis}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(student)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 h-7 w-7 p-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Data Siswa</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus data siswa <strong>{student.nama}</strong>?
                                Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(student.id_siswa, student.nama)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Jenis Kelamin:</span>
                        <p>{student.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <Badge 
                          variant={student.status === 'aktif' ? 'default' : 'secondary'}
                          className={`text-xs ${student.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                        >
                          {student.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </div>
                    </div>
                    
                    {student.nama_kelas && (
                      <div>
                        <span className="text-gray-500 text-xs">Kelas:</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs ml-1">
                          {student.nama_kelas}
                        </Badge>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Telepon Ortu:</span>
                        <p className="font-mono">{student.telepon_orangtua || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Telepon Siswa:</span>
                        <p className="font-mono">{student.nomor_telepon_siswa || '-'}</p>
                      </div>
                    </div>
                    
                    {student.alamat && (
                      <div>
                        <span className="text-gray-500 text-xs">Alamat:</span>
                        <p className="text-xs mt-1">{student.alamat}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ManageTeacherDataView Component  
const ManageTeacherDataView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [formData, setFormData] = useState({ 
    nip: '', 
    nama: '', 
    email: '', 
    mata_pelajaran: '',
    alamat: '',
    telepon: '',
    jenis_kelamin: '' as 'L' | 'P' | '',
    status: 'aktif' as 'aktif' | 'nonaktif'
  });
  const [teachersData, setTeachersData] = useState<TeacherData[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);

  const fetchTeachersData = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/teachers-data', { onLogout });
      setTeachersData(data);
    } catch (error) {
      console.error('Error fetching teachers data:', error);
      toast({ title: "Error memuat data guru", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);

  const fetchSubjects = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/mapel', { onLogout });
      setSubjects(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchTeachersData();
    fetchSubjects();
  }, [fetchTeachersData, fetchSubjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // === VALIDASI CLIENT-SIDE (konsisten dengan Tambah Akun Guru) ===
    // Required fields
    if (!formData.nip || !formData.nama) {
      toast({ title: "Error", description: "NIP dan Nama wajib diisi!", variant: "destructive" });
      return;
    }

    // NIP format: 10-20 digit angka
    if (!/^[0-9]{10,20}$/.test(formData.nip)) {
      toast({ title: "Error", description: "NIP harus berupa angka 10-20 digit!", variant: "destructive" });
      return;
    }

    // Email format (jika diisi)
    if (formData.email && formData.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({ title: "Error", description: "Format email tidak valid!", variant: "destructive" });
      return;
    }

    // Telepon format (jika diisi)
    if (formData.telepon && formData.telepon.trim() !== '' && !/^[\d+]{1,20}$/.test(formData.telepon.trim())) {
      toast({ title: "Error", description: "Nomor telepon harus berupa angka, maksimal 20 karakter!", variant: "destructive" });
      return;
    }
    // === END VALIDASI ===

    setIsLoading(true);

    try {
      const url = editingId ? `/api/admin/teachers-data/${editingId}` : '/api/admin/teachers-data';
      const method = editingId ? 'PUT' : 'POST';
      
      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout
      });

      toast({ title: editingId ? "Data guru berhasil diupdate!" : "Data guru berhasil ditambahkan!" });
      setFormData({ 
        nip: '', 
        nama: '', 
        email: '', 
        mata_pelajaran: '',
        alamat: '',
        telepon: '',
        jenis_kelamin: '' as 'L' | 'P' | '',
        status: 'aktif'
      });
      setEditingId(null);
      fetchTeachersData();
    } catch (error) {
      console.error('Error submitting teacher data:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsLoading(false);
  };

  const handleEdit = (teacher: TeacherData) => {
    setFormData({ 
      nip: teacher.nip, 
      nama: teacher.nama, 
      email: teacher.email || '',
      mata_pelajaran: teacher.mata_pelajaran || '',
      alamat: teacher.alamat || '',
      telepon: teacher.telepon || '',
      jenis_kelamin: teacher.jenis_kelamin,
      status: teacher.status
    });
    setEditingId(teacher.id);
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!window.confirm(`Yakin ingin menghapus data guru "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      await apiCall(`/api/admin/teachers-data/${id}`, {
        method: 'DELETE',
        onLogout
      });

      toast({ title: `Data guru ${nama} berhasil dihapus` });
      fetchTeachersData();
    } catch (error) {
      console.error('Error deleting teacher data:', error);
      toast({ title: "Error menghapus data guru", description: error.message, variant: "destructive" });
    }
  };

  const filteredTeachers = teachersData.filter(teacher => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (teacher.nama && teacher.nama.toLowerCase().includes(searchLower)) ||
      (teacher.nip && teacher.nip.toLowerCase().includes(searchLower)) ||
      (teacher.mata_pelajaran && teacher.mata_pelajaran.toLowerCase().includes(searchLower))
    );
  });

  if (showImport) {
    return <ExcelImportView entityType="guru" entityName="Data Guru" onBack={() => setShowImport(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button onClick={onBack} variant="outline" size="sm" className="self-start">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
              Kelola Data Guru
            </h1>
            <p className="text-sm text-muted-foreground">Tambah dan kelola data lengkap guru</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Import Excel
          </Button>
        </div>
      </div>

      {/* Add Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="w-4 h-4" />
            {editingId ? 'Edit Data Guru' : 'Tambah Data Guru'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="teacher-nip" className="text-sm font-medium">NIP *</Label>
                <Input 
                  id="teacher-nip" 
                  value={formData.nip} 
                  onChange={(e) => setFormData({...formData, nip: e.target.value})} 
                  placeholder="Nomor Induk Pegawai"
                  className="mt-1"
                  required 
                />
              </div>
            </div>
              <div>
                <Label htmlFor="teacher-nama" className="text-sm font-medium">Nama Lengkap *</Label>
                <Input 
                  id="teacher-nama" 
                  value={formData.nama} 
                  onChange={(e) => setFormData({...formData, nama: e.target.value})} 
                  placeholder="Nama lengkap guru"
                  className="mt-1"
                  required 
                />
              </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="teacher-email" className="text-sm font-medium">Email</Label>
                <Input 
                  id="teacher-email" 
                  type="email"
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  placeholder="Email guru"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="teacher-telepon" className="text-sm font-medium">Telepon</Label>
                <Input 
                  id="teacher-telepon" 
                  value={formData.telepon} 
                  onChange={(e) => setFormData({...formData, telepon: e.target.value})} 
                  placeholder="Nomor telepon"
                  className="mt-1"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="teacher-mapel" className="text-sm font-medium">Mata Pelajaran</Label>
                <Select value={formData.mata_pelajaran} onValueChange={(value) => setFormData({...formData, mata_pelajaran: value})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih mata pelajaran" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.filter(s => s.status === 'aktif').map((subject) => (
                      <SelectItem key={subject.id} value={subject.nama_mapel}>
                        {subject.nama_mapel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="teacher-gender" className="text-sm font-medium">Jenis Kelamin *</Label>
                <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({...formData, jenis_kelamin: value as 'L' | 'P'})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih jenis kelamin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="teacher-alamat" className="text-sm font-medium">Alamat</Label>
              <Textarea 
                id="teacher-alamat" 
                value={formData.alamat} 
                onChange={(e) => setFormData({...formData, alamat: e.target.value})} 
                placeholder="Alamat lengkap"
                rows={2}
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="teacher-status" className="text-sm font-medium">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value as 'aktif' | 'nonaktif'})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="nonaktif">Non-aktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <Button type="submit" disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-sm">
                    {isLoading ? 'Menyimpan...' : (editingId ? 'Update' : 'Tambah')}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={() => {
                      setEditingId(null);
                      setFormData({ 
                        nip: '', 
                        nama: '', 
                        email: '', 
                        mata_pelajaran: '',
                        alamat: '',
                        telepon: '',
                        jenis_kelamin: '' as 'L' | 'P' | '',
                        status: 'aktif'
                      });
                    }} className="text-sm">
                      Batal
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cari berdasarkan nama, NIP, atau mata pelajaran..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Badge variant="secondary" className="px-2 py-1 text-xs whitespace-nowrap">
              {filteredTeachers.length} guru ditemukan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="w-4 h-4" />
            Daftar Data Guru
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTeachers.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
              <p className="text-sm text-gray-600">
                {searchTerm ? 'Tidak ada guru yang cocok dengan pencarian' : 'Belum ada data guru yang ditambahkan'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View - hidden on mobile and tablet */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-xs">#</TableHead>
                      <TableHead className="text-xs">NIP</TableHead>
                      <TableHead className="text-xs">Nama</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Telepon</TableHead>
                      <TableHead className="text-xs">Alamat</TableHead>
                      <TableHead className="text-xs">Mata Pelajaran</TableHead>
                      <TableHead className="text-xs">Jenis Kelamin</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-center text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeachers.map((teacher, index) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="text-gray-500 text-xs">{index + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{teacher.nip}</TableCell>
                        <TableCell className="font-medium text-xs">{teacher.nama}</TableCell>
                        <TableCell className="text-xs">{teacher.email || '-'}</TableCell>
                        <TableCell className="text-xs">{teacher.telepon || '-'}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={teacher.alamat || ''}>
                          {teacher.alamat || '-'}
                        </TableCell>
                        <TableCell>
                          {teacher.mata_pelajaran ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                              {teacher.mata_pelajaran}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {teacher.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={teacher.status === 'aktif' ? 'default' : 'secondary'}
                            className={`text-xs ${teacher.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                          >
                            {teacher.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(teacher)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 h-7 w-7 p-0">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Data Guru</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus data guru <strong>{teacher.nama}</strong>?
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(teacher.id, teacher.nama)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile & Tablet Card View */}
            <div className="lg:hidden space-y-3">
              {filteredTeachers.map((teacher, index) => (
                <Card key={teacher.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{teacher.nama}</h3>
                        <p className="text-xs text-gray-500 font-mono">{teacher.nip}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(teacher)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 h-7 w-7 p-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Data Guru</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus data guru <strong>{teacher.nama}</strong>?
                                Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(teacher.id, teacher.nama)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Email:</span>
                        <p className="font-medium">{teacher.email || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Telepon:</span>
                        <p className="font-medium">{teacher.telepon || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Jenis Kelamin:</span>
                        <p className="font-medium">{teacher.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <Badge 
                          variant={teacher.status === 'aktif' ? 'default' : 'secondary'}
                          className={`text-xs ${teacher.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                        >
                          {teacher.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </div>
                    </div>
                    
                    {teacher.mata_pelajaran && (
                      <div>
                        <span className="text-gray-500 text-xs">Mata Pelajaran:</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs mt-1">
                          {teacher.mata_pelajaran}
                        </Badge>
                      </div>
                    )}
                    
                    {teacher.alamat && (
                      <div>
                        <span className="text-gray-500 text-xs">Alamat:</span>
                        <p className="text-xs mt-1">{teacher.alamat}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ManageSubjectsView Component  
const ManageSubjectsView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [formData, setFormData] = useState({ 
    kode_mapel: '', 
    nama_mapel: '', 
    deskripsi: '',
    status: 'aktif' as 'aktif' | 'tidak_aktif'
  });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);

  const fetchSubjects = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/mapel', { onLogout });
      setSubjects(data);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast({ title: "Error memuat mata pelajaran", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.kode_mapel || formData.kode_mapel.trim() === '') {
      toast({ title: "Error", description: "Kode mata pelajaran wajib diisi!", variant: "destructive" });
      return;
    }
    if (!formData.nama_mapel || formData.nama_mapel.trim() === '') {
      toast({ title: "Error", description: "Nama mata pelajaran wajib diisi!", variant: "destructive" });
      return;
    }
    if (!/^[A-Za-z0-9]{2,10}$/.test(formData.kode_mapel.trim())) {
      toast({ title: "Error", description: "Kode mapel harus 2-10 karakter alfanumerik!", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);

    try {
      const url = editingId ? `/api/admin/mapel/${editingId}` : '/api/admin/mapel';
      const method = editingId ? 'PUT' : 'POST';
      
      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout
      });

      toast({ title: editingId ? "Mata pelajaran berhasil diupdate!" : "Mata pelajaran berhasil ditambahkan!" });
      setFormData({ 
        kode_mapel: '', 
        nama_mapel: '', 
        deskripsi: '',
        status: 'aktif'
      });
      setEditingId(null);
      fetchSubjects();
    } catch (error) {
      console.error('Error submitting subject:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsLoading(false);
  };

  const handleEdit = (subject: Subject) => {
    setFormData({ 
      kode_mapel: subject.kode_mapel, 
      nama_mapel: subject.nama_mapel,
      deskripsi: subject.deskripsi || '',
      status: subject.status || 'aktif'
    });
    setEditingId(subject.id);
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!window.confirm(`Yakin ingin menghapus mata pelajaran "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      await apiCall(`/api/admin/mapel/${id}`, {
        method: 'DELETE',
        onLogout
      });

      toast({ title: `Mata pelajaran ${nama} berhasil dihapus` });
      fetchSubjects();
    } catch (error) {
      console.error('Error deleting subject:', error);
      toast({ title: "Error menghapus mata pelajaran", description: error.message, variant: "destructive" });
    }
  };

  const filteredSubjects = subjects.filter(subject => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (subject.nama_mapel && subject.nama_mapel.toLowerCase().includes(searchLower)) ||
      (subject.kode_mapel && subject.kode_mapel.toLowerCase().includes(searchLower)) ||
      (subject.deskripsi && subject.deskripsi.toLowerCase().includes(searchLower))
    );
  });

  if (showImport) {
    return <ExcelImportView entityType="mapel" entityName="Mata Pelajaran" onBack={() => setShowImport(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button onClick={onBack} variant="outline" size="sm" className="self-start">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">
              Kelola Mata Pelajaran
            </h1>
            <p className="text-sm text-muted-foreground">Tambah dan kelola mata pelajaran sekolah</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Import Excel
          </Button>
        </div>
      </div>

      {/* Add Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4" />
            {editingId ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="subject-code" className="text-sm font-medium">Kode Mata Pelajaran *</Label>
                <Input 
                  id="subject-code" 
                  value={formData.kode_mapel} 
                  onChange={(e) => setFormData({...formData, kode_mapel: e.target.value})} 
                  placeholder="Misal: MAT, FIS, BIO"
                  className="mt-1"
                  required 
                />
              </div>
              <div>
                <Label htmlFor="subject-name" className="text-sm font-medium">Nama Mata Pelajaran *</Label>
                <Input 
                  id="subject-name" 
                  value={formData.nama_mapel} 
                  onChange={(e) => setFormData({...formData, nama_mapel: e.target.value})} 
                  placeholder="Nama lengkap mata pelajaran"
                  className="mt-1"
                  required 
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="subject-desc" className="text-sm font-medium">Deskripsi</Label>
              <textarea
                id="subject-desc"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none mt-1"
                value={formData.deskripsi} 
                onChange={(e) => setFormData({...formData, deskripsi: e.target.value})} 
                placeholder="Deskripsi mata pelajaran (opsional)"
              />
            </div>
            
            <div>
              <Label htmlFor="subject-status" className="text-sm font-medium">Status *</Label>
              <select
                id="subject-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as 'aktif' | 'tidak_aktif'})}
                required
              >
                <option value="aktif">Aktif</option>
                <option value="tidak_aktif">Tidak Aktif</option>
              </select>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button type="submit" disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-sm">
                {isLoading ? 'Menyimpan...' : (editingId ? 'Update' : 'Tambah')}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => {
                  setEditingId(null);
                  setFormData({ 
                    kode_mapel: '', 
                    nama_mapel: '', 
                    deskripsi: '',
                    status: 'aktif'
                  });
                }} className="text-sm">
                  Batal
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cari berdasarkan nama, kode, atau deskripsi mata pelajaran..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Badge variant="secondary" className="px-2 py-1 text-xs whitespace-nowrap">
              {filteredSubjects.length} mata pelajaran ditemukan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4" />
            Daftar Mata Pelajaran
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSubjects.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
              <p className="text-sm text-gray-600">
                {searchTerm ? 'Tidak ada mata pelajaran yang cocok dengan pencarian' : 'Belum ada mata pelajaran yang ditambahkan'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View - hidden on mobile and tablet */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-xs">#</TableHead>
                      <TableHead className="text-xs">Kode</TableHead>
                      <TableHead className="text-xs">Nama Mata Pelajaran</TableHead>
                      <TableHead className="text-xs">Deskripsi</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-center text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubjects.map((subject, index) => (
                      <TableRow key={subject.id}>
                        <TableCell className="text-gray-500 text-xs">{index + 1}</TableCell>
                        <TableCell className="font-mono text-xs bg-gray-50 rounded px-2 py-1 max-w-20">
                          {subject.kode_mapel}
                        </TableCell>
                        <TableCell className="font-medium text-xs">{subject.nama_mapel}</TableCell>
                        <TableCell className="text-xs max-w-40 truncate" title={subject.deskripsi}>
                          {subject.deskripsi || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={subject.status === 'aktif' ? 'default' : 'secondary'}
                            className={`text-xs ${subject.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                          >
                            {subject.status === 'aktif' ? 'Aktif' : 'Tidak Aktif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(subject)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 h-7 w-7 p-0">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Mata Pelajaran</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin menghapus mata pelajaran <strong>{subject.nama_mapel}</strong>?
                                    Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(subject.id, subject.nama_mapel)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile & Tablet Card View */}
              <div className="lg:hidden space-y-3">
                {filteredSubjects.map((subject, index) => (
                  <Card key={subject.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">{subject.nama_mapel}</h3>
                          <p className="text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 inline-block mt-1">
                            {subject.kode_mapel}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(subject)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 h-7 w-7 p-0">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Mata Pelajaran</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus mata pelajaran <strong>{subject.nama_mapel}</strong>?
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(subject.id, subject.nama_mapel)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Status:</span>
                          <Badge 
                            variant={subject.status === 'aktif' ? 'default' : 'secondary'}
                            className={`text-xs mt-1 ${subject.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                          >
                            {subject.status === 'aktif' ? 'Aktif' : 'Tidak Aktif'}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-gray-500">No:</span>
                          <p className="font-medium">#{index + 1}</p>
                        </div>
                      </div>
                      
                      {subject.deskripsi && (
                        <div>
                          <span className="text-gray-500 text-xs">Deskripsi:</span>
                          <p className="text-xs mt-1">{subject.deskripsi}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ManageClassesView Component
// ManageClassesView Component
const ManageClassesView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [formData, setFormData] = useState({ nama_kelas: '' });
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/kelas', { onLogout });
      setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast({ title: "Error memuat kelas", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.nama_kelas || formData.nama_kelas.trim() === '') {
      toast({ title: "Error", description: "Nama kelas wajib diisi!", variant: "destructive" });
      return;
    }
    if (!/^[A-Za-z0-9\s-]{2,30}$/.test(formData.nama_kelas.trim())) {
      toast({ title: "Error", description: "Nama kelas harus 2-30 karakter, hanya huruf, angka, spasi, dan strip!", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);

    try {
      const url = editingId ? `/api/admin/kelas/${editingId}` : '/api/admin/kelas';
      const method = editingId ? 'PUT' : 'POST';
      
      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout
      });

      toast({ title: editingId ? "Kelas berhasil diupdate!" : "Kelas berhasil ditambahkan!" });
      setFormData({ nama_kelas: '' });
      setEditingId(null);
      fetchClasses();
    } catch (error) {
      console.error('Error submitting class:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsLoading(false);
  };

  const handleEdit = (kelas: Kelas) => {
    setFormData({ nama_kelas: kelas.nama_kelas });
    setEditingId(kelas.id);
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!window.confirm(`Yakin ingin menghapus kelas "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      await apiCall(`/api/admin/kelas/${id}`, {
        method: 'DELETE',
        onLogout
      });

      toast({ title: `Kelas ${nama} berhasil dihapus` });
      fetchClasses();
    } catch (error) {
      console.error('Error deleting class:', error);
      toast({ title: "Error menghapus kelas", description: error.message, variant: "destructive" });
    }
  };

  const filteredClasses = classes.filter(kelas => {
    const searchLower = searchTerm.toLowerCase();
    return (
      kelas.nama_kelas && kelas.nama_kelas.toLowerCase().includes(searchLower)
    );
  });

  if (showImport) {
    return <ExcelImportView entityType="kelas" entityName="Kelas" onBack={() => setShowImport(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button onClick={onBack} variant="outline" size="sm" className="self-start">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 bg-clip-text text-transparent">
              Kelola Kelas
            </h1>
            <p className="text-sm text-muted-foreground">Tambah dan kelola kelas sekolah</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Import Excel
          </Button>
        </div>
      </div>

      {/* Add Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="w-4 h-4" />
            {editingId ? 'Edit Kelas' : 'Tambah Kelas'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="class-name" className="text-sm font-medium">Nama Kelas *</Label>
              <Input 
                id="class-name" 
                value={formData.nama_kelas} 
                onChange={(e) => setFormData({...formData, nama_kelas: e.target.value})} 
                placeholder="Contoh: X IPA 1, XI IPS 2, XII IPA 3"
                className="mt-1"
                required 
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: [Tingkat] [Jurusan] [Nomor] - contoh: X IPA 1
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-sm">
                {isLoading ? 'Menyimpan...' : (editingId ? 'Update' : 'Tambah')}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => {
                  setEditingId(null);
                  setFormData({ nama_kelas: '' });
                }} className="text-sm">
                  Batal
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cari berdasarkan nama kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Badge variant="secondary" className="px-2 py-1 text-xs whitespace-nowrap">
              {filteredClasses.length} kelas ditemukan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="w-4 h-4" />
            Daftar Kelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClasses.length === 0 ? (
            <div className="text-center py-8">
              <Home className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
              <p className="text-sm text-gray-600">
                {searchTerm ? 'Tidak ada kelas yang cocok dengan pencarian' : 'Belum ada kelas yang ditambahkan'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View - hidden on mobile and tablet */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-xs">#</TableHead>
                      <TableHead className="text-xs">Nama Kelas</TableHead>
                      <TableHead className="text-xs">Tingkat</TableHead>
                      <TableHead className="text-center text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClasses.map((kelas, index) => (
                      <TableRow key={kelas.id}>
                        <TableCell className="text-gray-500 text-xs">{index + 1}</TableCell>
                        <TableCell className="font-medium text-xs">{kelas.nama_kelas}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {kelas.tingkat || 'Belum diatur'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(kelas)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 h-7 w-7 p-0">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Kelas</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin menghapus kelas <strong>{kelas.nama_kelas}</strong>?
                                    Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(kelas.id, kelas.nama_kelas)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile & Tablet Card View */}
              <div className="lg:hidden space-y-3">
                {filteredClasses.map((kelas, index) => (
                  <Card key={kelas.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">{kelas.nama_kelas}</h3>
                          <p className="text-xs text-gray-500">#{index + 1}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(kelas)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 h-7 w-7 p-0">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Kelas</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus kelas <strong>{kelas.nama_kelas}</strong>?
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(kelas.id, kelas.nama_kelas)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-gray-500 text-xs">Tingkat:</span>
                        <Badge variant="outline" className="text-xs mt-1">
                          {kelas.tingkat || 'Belum diatur'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ManageStudentsView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [formData, setFormData] = useState({ 
    nama: '', 
    nis: '', 
    kelas_id: '', 
    jenis_kelamin: '', 
    telepon_orangtua: '', 
    nomor_telepon_siswa: '', 
    alamat: '', 
    status: 'aktif',
    username: '',
    password: '',
    email: '',
    jabatan: 'Siswa'
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingNis, setEditingNis] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      const response = await apiCall('/api/admin/students', { onLogout });
      // Backend returns { success, data, pagination } - extract the data array
      const studentsArray = response?.data || response || [];
      setStudents(Array.isArray(studentsArray) ? studentsArray : []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({ title: "Error memuat data siswa", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);


  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/classes', { onLogout });
      setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      // Don't show error toast for classes as it's not critical
    }
  }, [onLogout]);

  // Validasi form
  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.nis || !/^\d{8,20}$/.test(formData.nis)) {
      errors.nis = 'NIS harus berupa angka 8-20 digit';
    }
    
    if (!formData.nama || formData.nama.trim().length < 2) {
      errors.nama = 'Nama lengkap wajib diisi minimal 2 karakter';
    }
    
    if (!formData.kelas_id) {
      errors.kelas_id = 'Kelas wajib dipilih';
    }
    
    if (!formData.jenis_kelamin) {
      errors.jenis_kelamin = 'Jenis kelamin wajib dipilih';
    }
    
    // Validasi username (wajib untuk akun)
    if (!formData.username || formData.username.trim().length < 3) {
      errors.username = 'Username wajib diisi minimal 3 karakter';
    }
    
    // Validasi password (wajib untuk create, opsional untuk update)
    if (!editingId && (!formData.password || formData.password.length < 6)) {
      errors.password = 'Password wajib diisi minimal 6 karakter';
    }
    
    // Validasi email format jika diisi
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Format email tidak valid';
    }
    
    if (formData.telepon_orangtua && !/^[\d+]{1,20}$/.test(formData.telepon_orangtua)) {
      errors.telepon_orangtua = 'Nomor telepon orang tua harus berupa angka dan plus, maksimal 20 karakter';
    }
    
    if (formData.nomor_telepon_siswa && !/^[\d+]{1,20}$/.test(formData.nomor_telepon_siswa)) {
      errors.nomor_telepon_siswa = 'Nomor telepon siswa harus berupa angka dan plus, maksimal 20 karakter';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, [fetchStudents, fetchClasses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({ title: "Error", description: "Mohon perbaiki error pada form", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const url = editingId ? `/api/admin/students/${editingNis}` : '/api/admin/students';
      const method = editingId ? 'PUT' : 'POST';
      
      const submitData = {
        ...formData,
        kelas_id: parseInt(formData.kelas_id),
      };

      await apiCall(url, {
        method,
        body: JSON.stringify(submitData),
        onLogout
      });

      toast({ title: editingId ? "Data siswa berhasil diupdate!" : "Data siswa berhasil ditambahkan!" });
      setFormData({ 
        nama: '', 
        nis: '', 
        kelas_id: '', 
        jenis_kelamin: '', 
        telepon_orangtua: '', 
        nomor_telepon_siswa: '', 
        alamat: '', 
        status: 'aktif',
        username: '',
        password: '',
        email: '',
        jabatan: 'Siswa'
      });
      setFormErrors({});
      setEditingId(null);
      setEditingNis(null);
      setDialogOpen(false);
      fetchStudents();
    } catch (error) {
      console.error('Error submitting student:', error);
      if (error.details) {
        const errorMessage = Array.isArray(error.details) ? error.details.join(', ') : error.details;
        toast({ title: "Error Validasi", description: errorMessage, variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }

    setIsLoading(false);
  };

  const handleEdit = (student: Student) => {
    setFormData({ 
      nama: student.nama, 
      nis: student.nis || '',
      kelas_id: String(student.kelas_id || ''),
      jenis_kelamin: student.jenis_kelamin || '',
      telepon_orangtua: student.telepon_orangtua || '',
      nomor_telepon_siswa: student.nomor_telepon_siswa || '',
      alamat: student.alamat || '',
      status: student.status || 'aktif',
      username: student.username || '',
      password: '', // Kosongkan password saat edit
      email: student.email || '',
      jabatan: student.jabatan || 'Siswa'
    });
    setEditingId(student.id);
    setEditingNis(student.nis || null);
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleDelete = async (id: number, nama: string, nis: string) => {
    if (!window.confirm(`Yakin ingin menghapus akun siswa "${nama}" (NIS: ${nis})? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      await apiCall(`/api/admin/students/${nis}`, {
        method: 'DELETE',
        onLogout
      });

      toast({ title: `Data siswa ${nama} (NIS: ${nis}) berhasil dihapus` });
      fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({ title: "Error menghapus data siswa", description: error.message, variant: "destructive" });
    }
  };

  const filteredStudents = students.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (student.nama && student.nama.toLowerCase().includes(searchLower)) ||
      (student.nis && student.nis.toLowerCase().includes(searchLower)) ||
      (student.nama_kelas && student.nama_kelas.toLowerCase().includes(searchLower))
    );
  });

  if (showImport) {
    return <ExcelImportView entityType="siswa" entityName="Data Siswa" onBack={() => setShowImport(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button onClick={onBack} variant="outline" size="sm" className="self-start">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">
              Kelola Akun Siswa
            </h1>
            <p className="text-sm text-gray-600">Tambah, edit, dan hapus akun login siswa perwakilan</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="w-full sm:w-auto text-xs">
            <Download className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Import Excel</span>
            <span className="sm:hidden">Import</span>
          </Button>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingId(null);
                setFormData({ 
                  nama: '', 
                  nis: '', 
                  kelas_id: '', 
                  jenis_kelamin: '', 
                  telepon_orangtua: '', 
                  nomor_telepon_siswa: '', 
                  alamat: '', 
                  status: 'aktif',
                  username: '',
                  password: '',
                  email: '',
                  jabatan: 'Siswa'
                });
                setFormErrors({});
              }} 
              size="sm"
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Tambah Akun Siswa</span>
              <span className="sm:hidden">Tambah Siswa</span>
            </Button>
          </DialogTrigger>
          <DialogContent 
            className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 50,
              width: '95vw',
              maxWidth: '42rem',
              margin: '0',
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              boxSizing: 'border-box'
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-base">{editingId ? 'Edit Akun Siswa' : 'Tambah Akun Siswa'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nama">Nama Lengkap *</Label>
                  <Input
                    id="nama"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    placeholder="Masukkan nama lengkap"
                    className={formErrors.nama ? 'border-red-500' : ''}
                  />
                  {formErrors.nama && <p className="text-sm text-red-500 mt-1">{formErrors.nama}</p>}
                </div>
                <div>
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Masukkan username"
                    className={formErrors.username ? 'border-red-500' : ''}
                  />
                  {formErrors.username && <p className="text-sm text-red-500 mt-1">{formErrors.username}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="password">
                    Password {editingId ? '(Kosongkan jika tidak ingin mengubah)' : '*'}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingId ? "Kosongkan jika tidak ingin mengubah" : "Masukkan password"}
                      className={`pr-10 ${formErrors.password ? 'border-red-500' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {formErrors.password && <p className="text-sm text-red-500 mt-1">{formErrors.password}</p>}
                </div>
                <div>
                  <Label htmlFor="nis">NIS *</Label>
                  <Input
                    id="nis"
                    value={formData.nis}
                    onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                    placeholder="Masukkan NIS (8-15 digit)"
                    className={formErrors.nis ? 'border-red-500' : ''}
                  />
                  {formErrors.nis && <p className="text-sm text-red-500 mt-1">{formErrors.nis}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="kelas_id">Kelas *</Label>
                  <Select value={formData.kelas_id} onValueChange={(value) => setFormData({ ...formData, kelas_id: value })}>
                    <SelectTrigger className={formErrors.kelas_id ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.filter(kelas => kelas.id).map((kelas, index) => (
                        <SelectItem key={`class-select-${kelas.id}-${index}`} value={kelas.id.toString()}>
                          {kelas.nama_kelas} {kelas.tingkat ? `(${kelas.tingkat})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.kelas_id && <p className="text-sm text-red-500 mt-1">{formErrors.kelas_id}</p>}
                </div>
                <div>
                  <Label htmlFor="jabatan">Jabatan</Label>
                  <Select value={formData.jabatan} onValueChange={(value) => setFormData({ ...formData, jabatan: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jabatan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Siswa">Siswa</SelectItem>
                      <SelectItem value="Ketua Kelas">Ketua Kelas</SelectItem>
                      <SelectItem value="Wakil Ketua Kelas">Wakil Ketua Kelas</SelectItem>
                      <SelectItem value="Sekretaris Kelas">Sekretaris Kelas</SelectItem>
                      <SelectItem value="Bendahara Kelas">Bendahara Kelas</SelectItem>
                      <SelectItem value="Perwakilan Siswa">Perwakilan Siswa</SelectItem>
                      <SelectItem value="Ketua Murid">Ketua Murid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="jenis_kelamin">Jenis Kelamin *</Label>
                  <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value })}>
                    <SelectTrigger className={formErrors.jenis_kelamin ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.jenis_kelamin && <p className="text-sm text-red-500 mt-1">{formErrors.jenis_kelamin}</p>}
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Masukkan email (opsional)"
                    className={formErrors.email ? 'border-red-500' : ''}
                  />
                  {formErrors.email && <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="telepon_orangtua">Telepon Orang Tua</Label>
                  <Input
                    id="telepon_orangtua"
                    value={formData.telepon_orangtua}
                    onChange={(e) => setFormData({ ...formData, telepon_orangtua: e.target.value })}
                    placeholder="Masukkan nomor telepon orang tua"
                    className={formErrors.telepon_orangtua ? 'border-red-500' : ''}
                  />
                  {formErrors.telepon_orangtua && <p className="text-sm text-red-500 mt-1">{formErrors.telepon_orangtua}</p>}
                </div>
                <div>
                  <Label htmlFor="nomor_telepon_siswa">Telepon Siswa</Label>
                  <Input
                    id="nomor_telepon_siswa"
                    value={formData.nomor_telepon_siswa}
                    onChange={(e) => setFormData({ ...formData, nomor_telepon_siswa: e.target.value })}
                    placeholder="Masukkan nomor telepon siswa"
                    className={formErrors.nomor_telepon_siswa ? 'border-red-500' : ''}
                  />
                  {formErrors.nomor_telepon_siswa && <p className="text-sm text-red-500 mt-1">{formErrors.nomor_telepon_siswa}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="alamat">Alamat</Label>
                <Textarea
                  id="alamat"
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  placeholder="Masukkan alamat lengkap"
                  className={formErrors.alamat ? 'border-red-500' : ''}
                  rows={3}
                />
                {formErrors.alamat && <p className="text-sm text-red-500 mt-1">{formErrors.alamat}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger className={formErrors.status ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aktif">Aktif</SelectItem>
                      <SelectItem value="nonaktif">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.status && <p className="text-sm text-red-500 mt-1">{formErrors.status}</p>}
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isLoading}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  Batal
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="bg-green-600 hover:bg-green-700 w-full sm:w-auto order-1 sm:order-2"
                >
                  {isLoading ? 'Menyimpan...' : editingId ? 'Update' : 'Simpan'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cari berdasarkan nama, username, NIS, atau kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 self-start sm:self-center">
              {filteredStudents.length} siswa ditemukan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            Daftar Akun Siswa Perwakilan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
              <p className="text-sm text-gray-600 mb-4">
                {searchTerm ? 'Tidak ada siswa yang sesuai dengan pencarian' : 'Belum ada akun siswa yang ditambahkan'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-green-600 hover:bg-green-700 w-full sm:w-auto text-xs">
                  <Plus className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Tambah Akun Siswa Pertama</span>
                  <span className="sm:hidden">Tambah Siswa Pertama</span>
                </Button>
              )}
            </div>
          ) : (
            <>
            {/* Desktop Table View - hidden on mobile and tablet */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-xs">#</TableHead>
                    <TableHead className="text-xs">NIS</TableHead>
                    <TableHead className="text-xs">Nama Lengkap</TableHead>
                    <TableHead className="text-xs">Kelas</TableHead>
                    <TableHead className="text-xs">Username</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Jenis Kelamin</TableHead>
                    <TableHead className="text-xs">Jabatan</TableHead>
                    <TableHead className="text-xs">Telepon Orang Tua</TableHead>
                    <TableHead className="text-xs">Telepon Siswa</TableHead>
                    <TableHead className="text-xs">Alamat</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-center text-xs">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student, index) => (
                    <TableRow key={student.id}>
                      <TableCell className="text-gray-500 text-xs sm:text-sm">{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm">{student.nis || '-'}</TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm">{student.nama || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50 text-green-700 text-xs px-1 py-0.5">
                          {student.nama_kelas || 'Belum ada kelas'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm">{student.username || '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{student.email || '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {student.jenis_kelamin === 'L' ? 'Laki-laki' : student.jenis_kelamin === 'P' ? 'Perempuan' : '-'}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{student.jabatan || '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{student.telepon_orangtua || '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{student.nomor_telepon_siswa || '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm max-w-24 sm:max-w-32 truncate" title={student.alamat || ''}>
                        {student.alamat || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={student.status === 'aktif' ? 'default' : 'secondary'}
                          className="text-xs px-1 py-0.5"
                        >
                          {student.status === 'aktif' ? 'Aktif' : 'Non Aktif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(student)}
                            className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                          >
                            <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline ml-1">Edit</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700 h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                              >
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline ml-1">Hapus</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Akun Siswa</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus akun siswa <strong>{student.nama}</strong> (NIS: {student.nis})?
                                  Tindakan ini tidak dapat dibatalkan dan akan menghapus semua data terkait.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(student.id, student.nama, student.nis)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile & Tablet Card View */}
            <div className="lg:hidden space-y-3">
              {filteredStudents.map((student, index) => (
                <Card key={student.id} className="p-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{student.nama || '-'}</h3>
                        <p className="text-xs text-gray-500 font-mono">NIS: {student.nis || '-'}</p>
                        <p className="text-xs text-gray-500">@{student.username || '-'}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(student)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 h-7 w-7 p-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Akun Siswa</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus akun siswa <strong>{student.nama}</strong> (NIS: {student.nis})?
                                Tindakan ini tidak dapat dibatalkan dan akan menghapus semua data terkait.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(student.id, student.nama, student.nis)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Email:</span>
                        <p className="truncate">{student.email || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Jenis Kelamin:</span>
                        <p>{student.jenis_kelamin === 'L' ? 'Laki-laki' : student.jenis_kelamin === 'P' ? 'Perempuan' : '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Jabatan:</span>
                        <p>{student.jabatan || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <Badge 
                          variant={student.status === 'aktif' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {student.status === 'aktif' ? 'Aktif' : 'Non Aktif'}
                        </Badge>
                      </div>
                    </div>
                    
                    {student.nama_kelas && (
                      <div>
                        <span className="text-gray-500 text-xs">Kelas:</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 text-xs ml-1">
                          {student.nama_kelas}
                        </Badge>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Telepon Orang Tua:</span>
                        <p>{student.telepon_orangtua || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Telepon Siswa:</span>
                        <p>{student.nomor_telepon_siswa || '-'}</p>
                      </div>
                    </div>
                    
                    {student.alamat && (
                      <div>
                        <span className="text-gray-500 text-xs">Alamat:</span>
                        <p className="text-xs mt-1">{student.alamat}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Live Summary View Component
const LiveSummaryView = ({ onLogout }: { onLogout: () => void }) => {
  const [liveData, setLiveData] = useState<LiveData>({ ongoing_classes: [] });
  const [currentTime, setCurrentTime] = useState(getWIBTime());

  const fetchLiveData = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/live-summary', { onLogout });
      setLiveData(data);
    } catch (error) {
      console.error('Error fetching live data:', error);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getWIBTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Live Clock & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Waktu Sekarang</p>
                                  <p className="text-2xl font-bold">
                    {formatTime24WithSeconds(currentTime)}
                  </p>
                <p className="text-blue-100 text-sm">
                  {formatDateOnly(currentTime)}
                </p>
              </div>
              <Clock className="w-12 h-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Kelas Berlangsung</p>
                <p className="text-3xl font-bold">{liveData.ongoing_classes.length}</p>
                <p className="text-green-100 text-sm">Kelas aktif saat ini</p>
              </div>
              <BookOpen className="w-12 h-12 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Tingkat Kehadiran</p>
                <p className="text-3xl font-bold">{liveData.overall_attendance_percentage || '0'}%</p>
                <p className="text-purple-100 text-sm">Kehadiran hari ini</p>
              </div>
              <TrendingUp className="w-12 h-12 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ongoing Classes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Kelas yang Sedang Berlangsung

          </CardTitle>
        </CardHeader>
        <CardContent>
          {liveData.ongoing_classes.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Tidak Ada Kelas Berlangsung</h3>
              <p className="text-gray-600">Saat ini tidak ada kelas yang sedang berlangsung.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveData.ongoing_classes.map((kelas, index) => (
                <Card key={`live-class-${kelas.id_kelas || index}`} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          {kelas.nama_kelas || kelas.kelas}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {kelas.jam_mulai} - {kelas.jam_selesai}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-gray-900">
                        {kelas.nama_mapel || kelas.mapel}
                      </h4>
                      <p className="text-sm text-gray-600">
                        👨‍🏫 {kelas.nama_guru || kelas.guru}
                      </p>
                      {kelas.absensi_diambil !== undefined && (
                        <div className="flex items-center gap-2">
                          {kelas.absensi_diambil > 0 ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Absensi Diambil
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Menunggu Absensi
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Preview Jadwal Component
const PreviewJadwalView = ({ onBack, schedules, classes }: { onBack: () => void; schedules: Schedule[]; classes: Kelas[] }) => {
  const [filter, setFilter] = useState({
    kelas: 'all',
    hari: 'all'
  });
  const [displayMode, setDisplayMode] = useState<'matrix' | 'grid'>('matrix');
  const [isExporting, setIsExporting] = useState(false);

  // Import letterhead hook
  const { letterhead, loading: letterheadLoading } = useLetterhead('REPORT_JADWAL_PELAJARAN');

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // Filter schedules based on selected filters
  const filteredSchedules = schedules.filter(schedule => {
    // Improved filtering logic with better type handling
    const kelasMatch = filter.kelas === 'all' || 
      schedule.kelas_id.toString() === filter.kelas ||
      schedule.kelas_id === parseInt(filter.kelas);
    const hariMatch = filter.hari === 'all' || schedule.hari === filter.hari;
    
    // Debug logging for troubleshooting
    if (schedules.length > 0 && classes.length > 0) {
      console.log(`🔍 Filtering schedule ${schedule.id}:`, {
        scheduleKelasId: schedule.kelas_id,
        filterKelas: filter.kelas,
        kelasMatch,
        scheduleHari: schedule.hari,
        filterHari: filter.hari,
        hariMatch
      });
    }
    
    return kelasMatch && hariMatch;
  }).sort((a, b) => {
    // Sort by day first, then by jam_ke
    const dayOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayA = dayOrder.indexOf(a.hari);
    const dayB = dayOrder.indexOf(b.hari);
    if (dayA !== dayB) return dayA - dayB;
    return (a.jam_ke || 0) - (b.jam_ke || 0);
  });

  // Enhanced debug logging for better troubleshooting
  // console.log();
  // console.log();
  // console.log();
  // console.log();
  // console.log();
  
  // Check data consistency
  if (schedules.length > 0 && classes.length > 0) {
    // console.log();
    console.log('📊 Sample schedule:', {
      id: schedules[0].id,
      kelas_id: schedules[0].kelas_id,
      nama_kelas: schedules[0].nama_kelas,
      hari: schedules[0].hari
    });
    console.log('📊 Sample class:', {
      id: classes[0].id,
      id_kelas: classes[0].id_kelas,
      nama_kelas: classes[0].nama_kelas
    });
    console.log('📊 ID consistency check:', {
      scheduleKelasId: schedules[0].kelas_id,
      classId: classes[0].id,
      classIdKelas: classes[0].id_kelas,
      matchWithId: schedules[0].kelas_id === classes[0].id,
      matchWithIdKelas: schedules[0].kelas_id === classes[0].id_kelas
    });
  }
  
  if (filteredSchedules.length > 0) {
    // console.log();
  } else {
    // console.log();
  }

  // Group schedules by class and day for matrix view
  const groupedSchedules = filteredSchedules.reduce((acc, schedule) => {
    const key = `${schedule.kelas_id}-${schedule.hari}`;
    if (!acc[key]) {
      acc[key] = {
        kelas: schedule.nama_kelas,
        hari: schedule.hari,
        schedules: []
      };
    }
    acc[key].schedules.push(schedule);
    return acc;
  }, {} as Record<string, { kelas: string; hari: string; schedules: Schedule[] }>);

  // Get unique classes for display
  const uniqueClassesForDisplay = Array.from(new Set(filteredSchedules.map(s => s.nama_kelas))).sort();

  // Get unique classes for filter
  const uniqueClasses = classes.filter((kelas, index, self) => 
    index === self.findIndex(k => k.id === kelas.id)
  );

  // Debug logging for classes
  // console.log();
  // console.log();
  // console.log();
  // console.log();

  const handleExportExcel = async (type: 'matrix' | 'grid') => {
    try {
      setIsExporting(true);
      // console.log();
      // console.log();
      // console.log();
      
      // Check if there's data to export
      if (schedules.length === 0) {
        toast({
          title: "Tidak Ada Data",
          description: "Tidak ada jadwal yang tersedia untuk diekspor",
          variant: "destructive"
        });
        return;
      }
      
      // Show loading toast
      const loadingToast = toast({
        title: "Export Excel",
        description: `Sedang memproses export ${type}...`,
        variant: "default"
      });

      // Build query parameters
      const params = new URLSearchParams();
      if (filter.kelas && filter.kelas !== 'all') {
        params.append('kelas_id', filter.kelas);
      }
      if (filter.hari && filter.hari !== 'all') {
        params.append('hari', filter.hari);
      }

      // Determine endpoint based on type
      const endpoint = type === 'matrix' 
        ? `/api/admin/export/jadwal-matrix?${params.toString()}`
        : `/api/admin/export/jadwal-grid?${params.toString()}`;

      // console.log();

      // Get auth token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token tidak ditemukan');
      }

      // Make API call using getApiUrl
      const response = await fetch(getApiUrl(endpoint), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`HTTP ${response.status}: ${errorText || 'Export gagal'}`);
      }

      // Get filename from response headers or create default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Jadwal_Pelajaran_${type === 'matrix' ? 'Matrix' : 'Grid'}_${getCurrentDateWIB()}.xlsx`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Convert response to blob
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Server mengembalikan file kosong');
      }
      console.log('Blob created:', {
        size: blob.size,
        type: blob.type,
        filename: filename
      });
      
      // Validate blob type
      if (!blob.type.includes('spreadsheetml') && !blob.type.includes('excel')) {
        console.warn('Unexpected blob type:', blob.type);
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Show success toast
      toast({
        title: "Export Berhasil",
        description: `File ${type} berhasil diunduh`,
        variant: "default"
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Gagal",
        description: `Terjadi kesalahan saat export: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsExporting(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (filter.kelas && filter.kelas !== 'all') {
        params.append('kelas_id', filter.kelas);
      }
      if (filter.hari && filter.hari !== 'all') {
        params.append('hari', filter.hari);
      }

      // Get auth token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token tidak ditemukan');
      }

      // Open print endpoint in new window using getApiUrl
      const printUrl = getApiUrl(`/api/admin/export/jadwal-print?${params.toString()}`);
      const printWindow = window.open(printUrl, '_blank');
      
      if (!printWindow) {
        throw new Error('Tidak dapat membuka jendela print');
      }

      // Show success toast
      toast({
        title: "Print Berhasil",
        description: "Jendela print telah dibuka",
        variant: "default"
      });

    } catch (error) {
      console.error('Print error:', error);
      toast({
        title: "Print Gagal",
        description: `Terjadi kesalahan saat print: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreviewJadwal = () => {
    // Trigger re-render with current filters
    // console.log();
    toast({
      title: "Preview Jadwal",
      description: `Menampilkan jadwal dengan filter: Kelas ${filter.kelas === 'all' ? 'Semua' : filter.kelas}, Hari ${filter.hari === 'all' ? 'Semua' : filter.hari}`,
      variant: "default"
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Preview Jadwal Pelajaran</h1>
            <div className="flex flex-wrap gap-1 lg:gap-2 text-xs lg:text-sm mt-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md font-medium">
                Format: {displayMode === 'matrix' ? 'Matrix' : 'Grid'}
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md font-medium">
                Total: {filteredSchedules.length} jadwal
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md font-medium">
                Kelas: {filter.kelas === 'all' ? 'Semua' : filter.kelas}
              </span>
              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md font-medium">
                Hari: {filter.hari === 'all' ? 'Semua' : filter.hari}
              </span>
              {filteredSchedules.length > 0 && (
                <>
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-md font-medium">
                    Guru: {new Set(filteredSchedules.map(s => s.nama_guru)).size} orang
                  </span>
                  <span className="px-2 py-1 bg-pink-100 text-pink-800 rounded-md font-medium">
                    Ruang: {new Set(filteredSchedules.map(s => s.kode_ruang).filter(Boolean)).size} ruang
                  </span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md font-medium">
                    Mapel: {new Set(filteredSchedules.map(s => s.nama_mapel).filter(Boolean)).size} mapel
                  </span>
                  <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-md font-medium">
                    Absen: {filteredSchedules.filter(s => s.is_absenable).length} dapat diabsen
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={() => handleExportExcel('matrix')} 
            variant="outline"
            disabled={isExporting}
            size="sm"
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
            ) : (
            <Download className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export Excel (Matrix)'}</span>
            <span className="sm:hidden">{isExporting ? 'Exporting...' : 'Export Matrix'}</span>
          </Button>
          <Button 
            onClick={() => handleExportExcel('grid')} 
            variant="outline"
            disabled={isExporting}
            size="sm"
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
            ) : (
            <Download className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export Excel (Grid)'}</span>
            <span className="sm:hidden">{isExporting ? 'Exporting...' : 'Export Grid'}</span>
          </Button>
          <Button onClick={handlePrint} variant="outline" disabled={isExporting} size="sm" className="w-full sm:w-auto">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="p-4 lg:p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Filter Jadwal</h3>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <Label htmlFor="kelas-filter">Kelas</Label>
              <Select value={filter.kelas} onValueChange={(value) => setFilter(prev => ({ ...prev, kelas: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {uniqueClasses.map((kelas) => (
                    <SelectItem key={kelas.id} value={kelas.id.toString()}>
                      {kelas.nama_kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <Label htmlFor="hari-filter">Hari</Label>
              <Select value={filter.hari} onValueChange={(value) => setFilter(prev => ({ ...prev, hari: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Hari" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Hari</SelectItem>
                  {daysOfWeek.map((hari, index) => (
                    <SelectItem key={`day-${hari}-${index}`} value={hari}>
                      {hari}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handlePreviewJadwal} className="w-full lg:w-auto">
                <Eye className="w-4 h-4 mr-2" />
                Preview Jadwal
              </Button>
            </div>
          </div>
          
          {/* Display Mode Toggle */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant={displayMode === 'matrix' ? 'default' : 'outline'}
              onClick={() => setDisplayMode('matrix')}
              size="sm"
              className="w-full sm:w-auto"
            >
              <span className="hidden sm:inline">Matrix 3-Baris/Kelas</span>
              <span className="sm:hidden">Matrix</span>
            </Button>
            <Button
              variant={displayMode === 'grid' ? 'default' : 'outline'}
              onClick={() => setDisplayMode('grid')}
              size="sm"
              className="w-full sm:w-auto"
            >
              Grid Jam
            </Button>
          </div>
        </div>
      </Card>

      {/* Schedule Display */}
      <Card className="p-4 lg:p-6">
        {/* Letterhead Preview */}
        {letterhead && letterhead.enabled && letterhead.lines && letterhead.lines.length > 0 && (
          <div className="text-center mb-4 lg:mb-6 p-3 lg:p-4 bg-white border-2 border-gray-300">
            {/* Logo kiri dan kanan jika tersedia */}
            {(letterhead.logoLeftUrl || letterhead.logoRightUrl) && (
              <div className="flex justify-between items-center mb-3 lg:mb-4">
                {letterhead.logoLeftUrl && (
                  <img 
                    src={letterhead.logoLeftUrl} 
                    alt="Logo Kiri" 
                    className="h-12 lg:h-16 object-contain"
                    onError={(e) => {
                      console.warn('⚠️ Logo kiri gagal dimuat:', letterhead.logoLeftUrl);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1"></div>
                {letterhead.logoRightUrl && (
                  <img 
                    src={letterhead.logoRightUrl} 
                    alt="Logo Kanan" 
                    className="h-12 lg:h-16 object-contain"
                    onError={(e) => {
                      console.warn('⚠️ Logo kanan gagal dimuat:', letterhead.logoRightUrl);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>
            )}
            
            {/* Baris teks kop laporan */}
            {letterhead.lines.map((line, index) => (
              <div 
                key={index} 
                className={`text-xs lg:text-sm ${line.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}`}
                style={{ textAlign: letterhead.alignment }}
              >
                {line.text}
              </div>
            ))}
            
            <div className="text-base lg:text-lg font-bold mt-3 lg:mt-4">
              JADWAL PELAJARAN
            </div>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h3 className="text-base lg:text-lg font-semibold">
            <span className="hidden sm:inline">
              {displayMode === 'matrix' ? 'Jadwal Matrix (3-Baris per Kelas)' : 'Jadwal Grid Jam'}
            </span>
            <span className="sm:hidden">
              {displayMode === 'matrix' ? 'Jadwal Matrix' : 'Jadwal Grid'}
            </span>
          </h3>
          <span className="text-xs lg:text-sm text-gray-500">
            {filteredSchedules.length} jadwal dari {uniqueClassesForDisplay.length} kelas
          </span>
        </div>
        
        {filteredSchedules.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📅</div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Tidak Ada Jadwal</h3>
            <p className="text-gray-500 mb-4">
              {schedules.length === 0 
                ? 'Belum ada jadwal yang tersedia. Silakan tambahkan jadwal terlebih dahulu.'
                : filter.kelas === 'all' && filter.hari === 'all' 
                  ? 'Belum ada jadwal yang tersedia' 
                  : `Tidak ada jadwal untuk ${filter.kelas === 'all' ? 'semua kelas' : `kelas ${filter.kelas}`} pada ${filter.hari === 'all' ? 'semua hari' : `hari ${filter.hari}`}`
              }
            </p>
            {schedules.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  Total jadwal tersedia: {schedules.length}
                </p>
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
            )}
          </div>
        ) : displayMode === 'matrix' ? (
          <div className="overflow-x-auto -mx-4 lg:mx-0">
            <div className="min-w-full px-4 lg:px-0">
              <table className="w-full border-collapse border border-gray-300 text-xs lg:text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-2 lg:px-4 py-2 text-left font-semibold sticky left-0 bg-gray-50 z-10 min-w-[80px] lg:min-w-[120px]">KELAS</th>
                    {daysOfWeek.map((day, index) => (
                      <th key={`day-header-${day}-${index}`} className="border border-gray-300 px-1 lg:px-4 py-2 text-center font-semibold min-w-[100px] lg:min-w-[150px]">
                        <span className="hidden sm:inline">{day}</span>
                        <span className="sm:hidden">{day.substring(0, 3)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uniqueClassesForDisplay.map((kelasName, index) => (
                    <tr key={`schedule-class-${kelasName}-${index}`}>
                      <td className="border border-gray-300 px-2 lg:px-4 py-2 font-medium sticky left-0 bg-white z-10 min-w-[80px] lg:min-w-[120px]">
                        <span className="hidden sm:inline">{kelasName}</span>
                        <span className="sm:hidden text-xs">{kelasName.length > 8 ? kelasName.substring(0, 8) + '...' : kelasName}</span>
                      </td>
                      {daysOfWeek.map((day, dayIndex) => {
                        const daySchedules = filteredSchedules
                          .filter(s => s.nama_kelas === kelasName && s.hari === day)
                          .sort((a, b) => (a.jam_ke || 0) - (b.jam_ke || 0));
                        return (
                          <td key={`day-cell-${day}-${dayIndex}`} className="border border-gray-300 px-1 lg:px-2 py-1 text-xs min-w-[100px] lg:min-w-[150px]">
                            {daySchedules.map((schedule, idx) => (
                              <div key={`schedule-${schedule.id}-${idx}`} className="mb-1 p-1 bg-blue-50 rounded border border-blue-200">
                                <div className="font-semibold text-xs text-blue-800 truncate">
                                  {schedule.nama_guru || 'Sistem'}
                                </div>
                                <div className="text-xs font-medium text-gray-700 truncate">
                                  {schedule.nama_mapel || schedule.keterangan_khusus}
                                </div>
                                <div className="text-gray-500 text-xs truncate">
                                  {schedule.kode_ruang || schedule.nama_ruang || 'Ruang TBD'}
                                </div>
                                <div className="text-gray-400 text-xs font-mono">
                                  {schedule.jam_mulai} - {schedule.jam_selesai}
                                </div>
                                {schedule.guru_list && schedule.guru_list.includes('||') && (
                                  <div className="text-xs text-green-600 mt-1">
                                    <div className="font-medium">Multi-Guru:</div>
                                    {schedule.guru_list.split('||').map((guru, guruIdx) => {
                                      const [guruId, guruName] = guru.split(':');
                                      return (
                                        <div key={`guru-${guruId}-${guruIdx}`} className="text-xs text-green-700 truncate">
                                          • {guruName}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSchedules.map((schedule) => (
              <div key={schedule.id} className="border rounded-lg p-3 lg:p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h4 className="font-semibold text-base lg:text-lg">{schedule.nama_kelas}</h4>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full w-fit">
                        Jam ke-{schedule.jam_ke || 'N/A'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      {schedule.nama_mapel || schedule.keterangan_khusus}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      👨‍🏫 {schedule.nama_guru || 'Sistem'}
                    </p>
                    {schedule.guru_list && schedule.guru_list.includes('||') && (
                      <div className="text-xs text-green-600 mb-1">
                        <div className="font-medium">Multi-Guru:</div>
                        {schedule.guru_list.split('||').map((guru, guruIdx) => {
                          const [guruId, guruName] = guru.split(':');
                          return (
                            <div key={`guru-list-${guruId}-${guruIdx}`} className="text-xs text-green-700">
                              • {guruName}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      📍 {schedule.kode_ruang || schedule.nama_ruang || 'Ruang TBD'}
                    </p>
                  </div>
                  <div className="flex flex-row lg:flex-col lg:text-right gap-3 lg:gap-0 lg:ml-4">
                    <div>
                      <p className="font-medium text-base lg:text-lg">{schedule.hari}</p>
                      <p className="text-sm text-gray-600 font-mono">
                        {schedule.jam_mulai} - {schedule.jam_selesai}
                      </p>
                    </div>
                    <div className="lg:mt-1">
                      <p className="text-xs text-gray-500">
                        {schedule.jenis_aktivitas === 'pelajaran' ? '📚 Pelajaran' : 
                         schedule.jenis_aktivitas === 'upacara' ? '🏛️ Upacara' :
                         schedule.jenis_aktivitas === 'istirahat' ? '☕ Istirahat' :
                         schedule.jenis_aktivitas === 'kegiatan_khusus' ? '🎯 Kegiatan Khusus' :
                         schedule.jenis_aktivitas === 'ujian' ? '📝 Ujian' :
                         '📋 Lainnya'}
                      </p>
                      {schedule.is_absenable && (
                        <p className="text-xs text-green-600 mt-1">✅ Dapat diabsen</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// Schedule Management Component
const ManageSchedulesView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [consecutiveHours, setConsecutiveHours] = useState(1);
  const [showImport, setShowImport] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFilter, setPreviewFilter] = useState({
    kelas: 'all',
    hari: 'all'
  });
  
  // State untuk pencarian
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFilter, setSearchFilter] = useState({
    kelas: 'all',
    hari: 'all',
    jenis: 'all',
    guru: 'all'
  });
  
  const [formData, setFormData] = useState({
    kelas_id: '',
    mapel_id: '',
    guru_id: '', // Keep for backward compatibility
    guru_ids: [] as number[], // New array for multi-guru support
    ruang_id: 'none',
    hari: '',
    jam_mulai: '',
    jam_selesai: '',
    jam_ke: '',
    jenis_aktivitas: 'pelajaran',
    is_absenable: true,
    keterangan_khusus: ''
  });

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // Fungsi untuk memfilter jadwal berdasarkan pencarian
  const filteredSchedules = schedules.filter(schedule => {
    // Filter berdasarkan search term (nama kelas, mata pelajaran, guru, ruang)
    const matchesSearch = !searchTerm || 
      schedule.nama_kelas?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.nama_mapel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.nama_guru?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.nama_ruang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.keterangan_khusus?.toLowerCase().includes(searchTerm.toLowerCase());

    // Filter berdasarkan kelas
    const matchesKelas = searchFilter.kelas === 'all' || 
      schedule.kelas_id.toString() === searchFilter.kelas;

    // Filter berdasarkan hari
    const matchesHari = searchFilter.hari === 'all' || 
      schedule.hari === searchFilter.hari;

    // Filter berdasarkan jenis aktivitas
    const matchesJenis = searchFilter.jenis === 'all' || 
      schedule.jenis_aktivitas === searchFilter.jenis;

    // Filter berdasarkan guru
    const matchesGuru = searchFilter.guru === 'all' || 
      schedule.guru_id?.toString() === searchFilter.guru;

    return matchesSearch && matchesKelas && matchesHari && matchesJenis && matchesGuru;
  });

  // Fetch all necessary data with better error handling
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        // console.log();
        
        // Load all data in parallel for better performance
        const [schedulesData, teachersData, subjectsData, classesData, roomsData] = await Promise.all([
          apiCall('/api/admin/jadwal', { onLogout }).catch(err => {
            console.error('❌ Error fetching schedules:', err);
            return [];
          }),
          apiCall('/api/admin/guru', { onLogout }).then(response => {
            // console.log();
            return response;
          }).catch(err => {
            console.error('❌ Error fetching teachers:', err);
            return [];
          }),
          apiCall('/api/admin/mapel', { onLogout }).catch(err => {
            console.error('❌ Error fetching subjects:', err);
            return [];
          }),
          apiCall('/api/admin/classes', { onLogout }).catch(err => {
            console.error('❌ Error fetching classes:', err);
            return [];
          }),
          apiCall('/api/admin/ruang', { onLogout }).catch(err => {
            console.error('❌ Error fetching rooms:', err);
            return [];
          })
        ]);
        
        // Set all data with proper response handling
        setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
        setTeachers(Array.isArray(teachersData?.data) ? teachersData.data : Array.isArray(teachersData) ? teachersData : []);
        setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
        setClasses(Array.isArray(classesData) ? classesData : []);
        setRooms(Array.isArray(roomsData) ? roomsData : []);
        
        console.log('✅ All data loaded successfully:', {
          schedules: schedulesData?.length || 0,
          teachers: teachersData?.data?.length || teachersData?.length || 0,
          subjects: subjectsData?.length || 0,
          classes: classesData?.length || 0,
          rooms: roomsData?.length || 0
        });
        
        // Debug teachers data structure
        // console.log();
        // console.log();
        
      } catch (error) {
        console.error('❌ Error loading data:', error);
        toast({
          title: "Error",
          description: "Gagal memuat data. Silakan refresh halaman.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAllData();
  }, [onLogout]);

  // Individual fetch functions for specific updates (e.g., after CRUD operations)
  const refreshSchedules = async () => {
    try {
      // Menggunakan JadwalService untuk konsistensi
      const data = await JadwalService.getJadwal('admin');
      setSchedules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('❌ Error refreshing schedules:', error);
      // Fallback ke apiCall jika JadwalService gagal
      try {
        const data = await apiCall('/api/admin/jadwal', { onLogout });
        setSchedules(Array.isArray(data) ? data : []);
      } catch (fallbackError) {
        console.error('❌ Fallback error:', fallbackError);
      }
    }
  };

  const generateTimeSlots = (startTime: string, endTime: string, startJamKe: number, consecutiveHours: number) => {
    const slots = [];
    
    // Parse start time using WIB timezone
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const currentTime = getWIBTime();
    currentTime.setHours(startHour, startMinute, 0, 0);
    
    // If end time is provided for single hour, calculate duration
    let duration = 40; // default 40 minutes
    if (endTime && consecutiveHours === 1) {
      const [endHour, endMinute] = endTime.split(':').map(Number);
      const endTimeObj = getWIBTime();
      endTimeObj.setHours(endHour, endMinute, 0, 0);
      duration = (endTimeObj.getTime() - currentTime.getTime()) / (1000 * 60);
    }

    for (let i = 0; i < consecutiveHours; i++) {
      const jamMulai = currentTime.toTimeString().slice(0, 5);
      currentTime.setMinutes(currentTime.getMinutes() + duration);
      const jamSelesai = currentTime.toTimeString().slice(0, 5);
      
      slots.push({
        jam_ke: startJamKe + i, // FIX: Gunakan startJamKe + i untuk jam_ke yang benar
        jam_mulai: jamMulai,
        jam_selesai: jamSelesai
      });
      
      // Add 5 minutes break between classes
      if (i < consecutiveHours - 1) {
        currentTime.setMinutes(currentTime.getMinutes() + 5);
      }
    }
    
    return slots;
  };

  const validateJadwalForm = (formData: Record<string, string | number | number[] | boolean>, consecutiveHours: number) => {
    const errors: string[] = [];
    
    // Validasi jam_ke
    if (!formData.jam_ke || isNaN(parseInt(String(formData.jam_ke)))) {
      errors.push('Jam ke- harus diisi dengan angka');
    } else {
      const jamKe = parseInt(String(formData.jam_ke));
      if (jamKe < 1 || jamKe > 12) {
        errors.push('Jam ke- harus antara 1-12');
      }
    }
    
    // Validasi jam_mulai < jam_selesai
    if (formData.jam_mulai && formData.jam_selesai) {
      const start = new Date(`2000-01-01T${formData.jam_mulai}`);
      const end = new Date(`2000-01-01T${formData.jam_selesai}`);
      if (start >= end) {
        errors.push('Jam selesai harus lebih besar dari jam mulai');
      }
    }
    
    // Validasi consecutive hours
    if (consecutiveHours < 1 || consecutiveHours > 6) {
      errors.push('Jumlah jam berurutan harus antara 1-6');
    }
    
    // Validasi field wajib
    if (!formData.kelas_id) errors.push('Kelas harus dipilih');
    if (!formData.hari) errors.push('Hari harus dipilih');
    if (!formData.jam_mulai) errors.push('Jam mulai harus diisi');
    if (!formData.jam_selesai) errors.push('Jam selesai harus diisi');
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi form sebelum proses
    const errors = validateJadwalForm(formData, consecutiveHours);
    if (errors.length > 0) {
      toast({
        title: "Error Validasi",
        description: errors.join(', '),
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);

    try {
      // Validasi guru_ids untuk aktivitas pelajaran
      if (formData.jenis_aktivitas === 'pelajaran') {
        const validGuruIds = formData.guru_ids.filter(id => id && !isNaN(id) && id > 0);
        
        if (validGuruIds.length === 0) {
          toast({
            title: "Error",
            description: "Minimal satu guru harus dipilih untuk jadwal pelajaran"
          });
          setIsLoading(false);
          return;
        }
        
        if (validGuruIds.length !== formData.guru_ids.length) {
          console.warn('⚠️ Some invalid guru IDs filtered out:', 
            formData.guru_ids.filter(id => !validGuruIds.includes(id))
          );
        }
      }
      
      if (editingId) {
        // Update existing schedule
        const validGuruIds = formData.guru_ids.filter(id => id && !isNaN(id) && id > 0);
        
        await apiCall(`/api/admin/jadwal/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({
            kelas_id: parseInt(formData.kelas_id),
            mapel_id: formData.jenis_aktivitas === 'pelajaran' ? parseInt(formData.mapel_id) : null,
            guru_id: formData.jenis_aktivitas === 'pelajaran' && validGuruIds.length > 0 ? validGuruIds[0] : null,
            guru_ids: formData.jenis_aktivitas === 'pelajaran' ? validGuruIds : [],
            ruang_id: formData.ruang_id && formData.ruang_id !== 'none' ? parseInt(formData.ruang_id) : null,
            hari: formData.hari,
            jam_mulai: formData.jam_mulai,
            jam_selesai: formData.jam_selesai,
            jam_ke: parseInt(formData.jam_ke),
            jenis_aktivitas: formData.jenis_aktivitas,
            is_absenable: formData.jenis_aktivitas === 'pelajaran',
            keterangan_khusus: formData.keterangan_khusus || null
          }),
          onLogout
      });

        toast({
          title: "Berhasil",
          description: "Jadwal berhasil diperbarui"
        });
      } else {
        // Create new schedule(s)
        const timeSlots = generateTimeSlots(
          formData.jam_mulai,
          formData.jam_selesai,
          parseInt(formData.jam_ke), // FIX: Gunakan parseInt() untuk jam_ke
          consecutiveHours
        );

        for (const slot of timeSlots) {
          // Validasi dan filter guru_ids sebelum dikirim
          const validGuruIds = formData.guru_ids.filter(id => id && !isNaN(id) && id > 0);
          
          console.log('🔍 Frontend Debug - Guru Data:', {
            original_guru_ids: formData.guru_ids,
            valid_guru_ids: validGuruIds,
            jenis_aktivitas: formData.jenis_aktivitas
          });
          
          await apiCall('/api/admin/jadwal', {
            method: 'POST',
            body: JSON.stringify({
              kelas_id: parseInt(formData.kelas_id),
              mapel_id: formData.jenis_aktivitas === 'pelajaran' ? parseInt(formData.mapel_id) : null,
              guru_id: formData.jenis_aktivitas === 'pelajaran' && validGuruIds.length > 0 ? validGuruIds[0] : null, // Primary guru
              guru_ids: formData.jenis_aktivitas === 'pelajaran' ? validGuruIds : [], // All valid guru IDs
              ruang_id: formData.ruang_id && formData.ruang_id !== 'none' ? parseInt(formData.ruang_id) : null,
              hari: formData.hari,
              jam_mulai: slot.jam_mulai,
              jam_selesai: slot.jam_selesai,
              jam_ke: slot.jam_ke,
              jenis_aktivitas: formData.jenis_aktivitas,
              is_absenable: formData.jenis_aktivitas === 'pelajaran',
              keterangan_khusus: formData.keterangan_khusus || null
            }),
            onLogout
      });
        }

        toast({
          title: "Berhasil",
          description: `${consecutiveHours} jam pelajaran berhasil ditambahkan`
        });
      }

      // Reset form
      setFormData({
        kelas_id: '',
        mapel_id: '',
        guru_id: '',
        guru_ids: [],
        ruang_id: 'none',
        hari: '',
        jam_mulai: '',
        jam_selesai: '',
        jam_ke: '',
        jenis_aktivitas: 'pelajaran',
        is_absenable: true,
        keterangan_khusus: ''
      });
      setConsecutiveHours(1);
      setEditingId(null);
      refreshSchedules();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal menyimpan jadwal",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    // Parse guru_list to get guru_ids
    let guru_ids: number[] = [];
    if (schedule.guru_list) {
      guru_ids = schedule.guru_list.split('||').map(guru => parseInt(guru.split(':')[0]));
    } else if (schedule.guru_id) {
      guru_ids = [schedule.guru_id];
    }

    setFormData({
      kelas_id: schedule.kelas_id?.toString() || '',
      mapel_id: schedule.mapel_id?.toString() || '',
      guru_id: schedule.guru_id?.toString() || '',
      guru_ids: guru_ids,
      ruang_id: schedule.ruang_id?.toString() || 'none',
      hari: schedule.hari,
      jam_mulai: schedule.jam_mulai,
      jam_selesai: schedule.jam_selesai,
      jam_ke: schedule.jam_ke?.toString() || '',
      jenis_aktivitas: schedule.jenis_aktivitas || 'pelajaran',
      is_absenable: schedule.is_absenable !== false,
      keterangan_khusus: schedule.keterangan_khusus || ''
    });
    setEditingId(schedule.id);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) {
      try {
        await apiCall(`/api/admin/jadwal/${id}`, {
          method: 'DELETE',
          onLogout
      });

        toast({
          title: "Berhasil",
          description: "Jadwal berhasil dihapus"
        });
        
        refreshSchedules();
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Gagal menghapus jadwal",
          variant: "destructive"
        });
      }
    }
  };

  if (showImport) {
    return <ExcelImportView entityType="jadwal" entityName="Jadwal Pelajaran" onBack={() => setShowImport(false)} />;
  }

  if (showPreview) {
    // console.log();
    // console.log();
    // console.log();
    // console.log();
    // console.log();
    return <PreviewJadwalView onBack={() => setShowPreview(false)} schedules={schedules} classes={classes} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack} className="self-start">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Kelola Jadwal</h1>
            <p className="text-sm text-gray-600">Atur jadwal pelajaran untuk setiap kelas</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setShowPreview(true)} variant="default" size="sm" className="text-xs">
            <Eye className="w-3 h-3 mr-1" />
            Preview Jadwal
          </Button>
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Import Excel
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Form */}
        <Card className="p-4">
          <h3 className="text-base font-bold mb-3">
            {editingId ? 'Edit Jadwal' : 'Tambah Jadwal'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Jenis Aktivitas</Label>
              <Select 
                value={formData.jenis_aktivitas} 
                onValueChange={(value) => {
                  const newJenis = value as 'pelajaran' | 'upacara' | 'istirahat' | 'kegiatan_khusus' | 'libur' | 'ujian' | 'lainnya';
                  setFormData({
                    ...formData,
                    jenis_aktivitas: newJenis,
                    is_absenable: newJenis === 'pelajaran',
                    mapel_id: newJenis === 'pelajaran' ? formData.mapel_id : '',
                    guru_id: newJenis === 'pelajaran' ? formData.guru_id : '',
                    guru_ids: newJenis === 'pelajaran' ? formData.guru_ids : []
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih Jenis Aktivitas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pelajaran">Pelajaran</SelectItem>
                  <SelectItem value="upacara">Upacara</SelectItem>
                  <SelectItem value="istirahat">Istirahat</SelectItem>
                  <SelectItem value="kegiatan_khusus">Kegiatan Khusus</SelectItem>
                  <SelectItem value="libur">Libur</SelectItem>
                  <SelectItem value="ujian">Ujian</SelectItem>
                  <SelectItem value="lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Kelas</Label>
                <Select 
                  value={formData.kelas_id} 
                  onValueChange={(value) => setFormData({...formData, kelas_id: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.filter(kelas => kelas.id).map((kelas, index) => (
                      <SelectItem key={`class-${kelas.id}-${index}`} value={kelas.id.toString()}>
                        {kelas.nama_kelas}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.jenis_aktivitas === 'pelajaran' && (
                <div>
                  <Label className="text-sm font-medium">Mata Pelajaran</Label>
                  <Select 
                    value={formData.mapel_id} 
                    onValueChange={(value) => setFormData({...formData, mapel_id: value})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih Mata Pelajaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.filter(subject => subject.id).map((subject, index) => (
                        <SelectItem key={`subject-${subject.id}-${index}`} value={subject.id.toString()}>
                          {subject.nama_mapel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.jenis_aktivitas !== 'pelajaran' && (
                <div>
                  <Label className="text-sm font-medium">Keterangan Khusus</Label>
                  <Input
                    value={formData.keterangan_khusus}
                    onChange={(e) => setFormData({...formData, keterangan_khusus: e.target.value})}
                    placeholder="Contoh: Upacara Bendera, Istirahat Pagi, dll"
                    className="mt-1"
                    required
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {formData.jenis_aktivitas === 'pelajaran' && (
                <div>
                  <Label className="text-sm font-medium">Guru Pengajar *</Label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {formData.guru_ids.map((guruId, index) => {
                        const teacher = teachers.find(t => t.id === guruId);
                        return teacher ? (
                          <div key={`selected-guru-${guruId}-${index}`} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm">
                            <span>{teacher.nama}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  guru_ids: prev.guru_ids.filter(id => id !== guruId),
                                  guru_id: prev.guru_ids.length === 1 ? '' : prev.guru_id
                                }));
                              }}
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                    <Select 
                      value="" 
                      onValueChange={(value) => {
                        if (value && !formData.guru_ids.includes(parseInt(value))) {
                          setFormData(prev => ({
                            ...prev,
                            guru_ids: [...prev.guru_ids, parseInt(value)],
                            guru_id: prev.guru_ids.length === 0 ? value : prev.guru_id
                          }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih guru (bisa lebih dari 1)" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          // console.log();
                          // console.log();
                          // console.log();
                          
                          const filteredTeachers = teachers.filter(teacher => teacher.id && teacher.status === 'aktif' && !formData.guru_ids.includes(teacher.id));
                          
                          if (filteredTeachers.length === 0) {
                            return (
                              <SelectItem value="no-teachers" disabled>
                                {teachers.length === 0 ? 'Tidak ada guru tersedia' : 'Semua guru sudah dipilih'}
                              </SelectItem>
                            );
                          }
                          
                          return filteredTeachers.map((teacher, index) => (
                            <SelectItem key={`teacher-${teacher.id}-${index}`} value={teacher.id.toString()}>
                              {teacher.nama} - {teacher.nama_mapel || teacher.mata_pelajaran || 'Tidak ada mata pelajaran'}
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Pilih satu atau lebih guru. Guru pertama menjadi guru utama.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Ruang Kelas</Label>
                <Select 
                  value={formData.ruang_id} 
                  onValueChange={(value) => setFormData({...formData, ruang_id: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih Ruang (Opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada ruang</SelectItem>
                    {rooms.filter(room => room.status === 'aktif').map((room, index) => (
                      <SelectItem key={`room-${room.id}-${index}`} value={room.id.toString()}>
                        {room.kode_ruang} - {room.nama_ruang || 'Ruang'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Hari</Label>
                <Select 
                  value={formData.hari} 
                  onValueChange={(value) => setFormData({...formData, hari: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih Hari" />
                  </SelectTrigger>
                  <SelectContent>
                    {daysOfWeek.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="jam-mulai" className="text-sm font-medium">Jam Mulai (Format 24 Jam)</Label>
                <TimeInput
                  value={formData.jam_mulai} 
                  onChange={(value) => setFormData({...formData, jam_mulai: value})}
                  placeholder="08:30"
                  required 
                />
                <p className="text-xs text-gray-500 mt-1">Format: HH:MM (24 jam) - Contoh: 08:30, 14:15</p>
              </div>
              <div>
                <Label htmlFor="jam-selesai" className="text-sm font-medium">Jam Selesai (Format 24 Jam)</Label>
                <TimeInput
                  value={formData.jam_selesai} 
                  onChange={(value) => setFormData({...formData, jam_selesai: value})}
                  placeholder="09:30"
                  required={editingId !== null || consecutiveHours === 1}
                  disabled={!editingId && consecutiveHours > 1}
                />
                <p className="text-xs text-gray-500 mt-1">Format: HH:MM (24 jam) - Contoh: 08:30, 14:15</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="jam-ke" className="text-sm font-medium">Jam ke-</Label>
                <Input 
                  id="jam-ke"
                  type="number" 
                  value={formData.jam_ke} 
                  onChange={(e) => setFormData({...formData, jam_ke: e.target.value})} 
                  placeholder="1, 2, 3, dst"
                  min="1"
                  required={editingId !== null || consecutiveHours === 1}
                  disabled={!editingId && consecutiveHours > 1}
                />
              </div>
            </div>

            {!editingId && (
              <div>
                <Label htmlFor="consecutive-hours">Jumlah Jam Berurutan</Label>
                <Select 
                  value={consecutiveHours?.toString() || '1'} 
                  onValueChange={(value) => setConsecutiveHours(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <SelectItem key={num} value={num?.toString() || '1'}>
                        {num} Jam
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Pilih lebih dari 1 untuk menambahkan jam berurutan secara otomatis
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button type="submit" disabled={isLoading} className="text-sm">
                {isLoading ? 'Processing...' : (editingId ? 'Update Jadwal' : `Tambah ${consecutiveHours} Jam Pelajaran`)}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => {
                  setEditingId(null);
                  setFormData({
                    kelas_id: '',
                    mapel_id: '',
                    guru_id: '',
                    guru_ids: [],
                    ruang_id: 'none',
                    hari: '',
                    jam_mulai: '',
                    jam_selesai: '',
                    jam_ke: '',
                    jenis_aktivitas: 'pelajaran',
                    is_absenable: true,
                    keterangan_khusus: ''
                  });
                  setConsecutiveHours(1);
                }} className="text-sm">
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* Schedule List - Table Format */}
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <h3 className="text-base font-bold">Daftar Jadwal</h3>
            
            {/* Search and Filter Controls */}
            <div className="flex flex-col gap-3 w-full lg:w-auto">
              {/* Search Input */}
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Cari jadwal..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Filter Controls */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Select value={searchFilter.kelas} onValueChange={(value) => setSearchFilter({...searchFilter, kelas: value})}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kelas</SelectItem>
                    {classes.map((kelas) => (
                      <SelectItem key={kelas.id} value={kelas.id.toString()}>
                        {kelas.nama_kelas}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={searchFilter.hari} onValueChange={(value) => setSearchFilter({...searchFilter, hari: value})}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Hari" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Hari</SelectItem>
                    {daysOfWeek.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={searchFilter.jenis} onValueChange={(value) => setSearchFilter({...searchFilter, jenis: value})}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Jenis</SelectItem>
                    <SelectItem value="pelajaran">Pelajaran</SelectItem>
                    <SelectItem value="upacara">Upacara</SelectItem>
                    <SelectItem value="istirahat">Istirahat</SelectItem>
                    <SelectItem value="kegiatan_khusus">Kegiatan Khusus</SelectItem>
                    <SelectItem value="ujian">Ujian</SelectItem>
                    <SelectItem value="libur">Libur</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={searchFilter.guru} onValueChange={(value) => setSearchFilter({...searchFilter, guru: value})}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Guru" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Guru</SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Results Count */}
          <div className="mb-3 text-sm text-gray-600">
            Menampilkan {filteredSchedules.length} dari {schedules.length} jadwal
            {(searchTerm || searchFilter.kelas !== 'all' || searchFilter.hari !== 'all' || searchFilter.jenis !== 'all' || searchFilter.guru !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSearchTerm('');
                  setSearchFilter({kelas: 'all', hari: 'all', jenis: 'all', guru: 'all'});
                }}
                className="ml-2 h-6 px-2 text-xs"
              >
                Reset Filter
              </Button>
            )}
          </div>
          
          {schedules.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600">Belum ada jadwal</p>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="text-center py-6">
              <Search className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600">Tidak ada jadwal yang sesuai dengan filter</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setSearchTerm('');
                  setSearchFilter({kelas: 'all', hari: 'all', jenis: 'all', guru: 'all'});
                }}
                className="mt-2"
              >
                Reset Filter
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Kelas</TableHead>
                      <TableHead className="text-xs">Jenis</TableHead>
                      <TableHead className="text-xs">Mata Pelajaran</TableHead>
                      <TableHead className="text-xs">Guru</TableHead>
                      <TableHead className="text-xs">Ruang</TableHead>
                      <TableHead className="text-xs">Hari</TableHead>
                      <TableHead className="text-xs">Jam</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-right text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredSchedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {schedule.nama_kelas}
                      </TableCell>
                      <TableCell>
                        {schedule.jenis_aktivitas !== 'pelajaran' ? (
                          <Badge variant="secondary" className="text-xs">
                            {schedule.jenis_aktivitas === 'upacara' ? '🏳️ Upacara' :
                             schedule.jenis_aktivitas === 'istirahat' ? '☕ Istirahat' :
                             schedule.jenis_aktivitas === 'kegiatan_khusus' ? '🎯 Kegiatan Khusus' :
                             schedule.jenis_aktivitas === 'libur' ? '🏖️ Libur' :
                             schedule.jenis_aktivitas === 'ujian' ? '📝 Ujian' :
                             '📋 ' + schedule.jenis_aktivitas}
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            📚 Pelajaran
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {schedule.jenis_aktivitas === 'pelajaran' ? (
                          schedule.nama_mapel || '-'
                        ) : (
                          schedule.keterangan_khusus || '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {schedule.jenis_aktivitas === 'pelajaran' ? (
                          <div className="space-y-1">
                            {/* Display teachers - handle multiple formats */}
                            <div className="flex flex-wrap gap-1">
                              {/* Check for guru_list format first (multi-guru with IDs) */}
                              {schedule.guru_list && schedule.guru_list.includes('||') ? (
                                schedule.guru_list.split('||').map((guru, index) => {
                                  const [guruId, guruName] = guru.split(':');
                                  return (
                                    <Badge key={index} variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                      {guruName}
                                    </Badge>
                                  );
                                })
                              ) : schedule.nama_guru && schedule.nama_guru.includes(',') ? (
                                // Multiple teachers separated by comma
                                schedule.nama_guru.split(',').map((guru, index) => (
                                  <Badge key={index} variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                    {guru.trim()}
                                  </Badge>
                                ))
                              ) : schedule.nama_guru ? (
                                // Single teacher
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                  {schedule.nama_guru}
                                </Badge>
                              ) : (
                                // No teacher assigned
                                <span className="text-sm text-gray-500">-</span>
                              )}
                            </div>
                            
                            {/* Show multi-guru indicator if applicable */}
                            {schedule.is_multi_guru && (
                              <div className="flex items-center gap-1 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  <Users className="w-3 h-3 mr-1" />
                                  Multi-Guru
                                </Badge>
                              </div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {schedule.kode_ruang ? (
                          <div className="text-sm">
                            <Badge variant="outline" className="text-xs">
                              {schedule.kode_ruang}
                            </Badge>
                            {schedule.nama_ruang && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {schedule.nama_ruang}
                              </div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {schedule.hari}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Jam ke-{schedule.jam_ke}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {schedule.jam_mulai} - {schedule.jam_selesai}
                        </div>
                      </TableCell>
                      <TableCell>
                        {schedule.is_absenable ? (
                          <Badge variant="default" className="text-xs">
                            ✅ Absen
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                            ❌ Tidak Absen
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(schedule)}>
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(schedule.id)}>
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
              {filteredSchedules.map((schedule) => (
                <Card key={schedule.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{schedule.nama_kelas}</h3>
                        <p className="text-xs text-gray-500">{schedule.hari} • {schedule.jam_mulai} - {schedule.jam_selesai}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(schedule)} className="h-7 w-7 p-0">
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(schedule.id)} className="h-7 w-7 p-0">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Jenis:</span>
                        <div className="mt-1">
                          {schedule.jenis_aktivitas !== 'pelajaran' ? (
                            <Badge variant="secondary" className="text-xs">
                              {schedule.jenis_aktivitas === 'upacara' ? '🏳️ Upacara' :
                               schedule.jenis_aktivitas === 'istirahat' ? '☕ Istirahat' :
                               schedule.jenis_aktivitas === 'kegiatan_khusus' ? '🎯 Kegiatan Khusus' :
                               schedule.jenis_aktivitas === 'libur' ? '🏖️ Libur' :
                               schedule.jenis_aktivitas === 'ujian' ? '📝 Ujian' :
                               '📋 ' + schedule.jenis_aktivitas}
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs">
                              📚 Pelajaran
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <div className="mt-1">
                          <Badge 
                            variant={schedule.is_absenable ? 'default' : 'secondary'}
                            className={`text-xs ${schedule.is_absenable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                          >
                            {schedule.is_absenable ? 'Aktif' : 'Non-aktif'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs">
                      <span className="text-gray-500">Mata Pelajaran/Guru:</span>
                      <div className="mt-1">
                        {schedule.jenis_aktivitas === 'pelajaran' ? (
                          <div className="space-y-1">
                            <div className="font-medium">{schedule.nama_mapel || '-'}</div>
                            
                            {/* Display teachers - handle multiple formats */}
                            <div className="flex flex-wrap gap-1">
                              {/* Check for guru_list format first (multi-guru with IDs) */}
                              {schedule.guru_list && schedule.guru_list.includes('||') ? (
                                schedule.guru_list.split('||').map((guru, index) => {
                                  const [guruId, guruName] = guru.split(':');
                                  return (
                                    <Badge key={index} variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                      {guruName}
                                    </Badge>
                                  );
                                })
                              ) : schedule.nama_guru && schedule.nama_guru.includes(',') ? (
                                // Multiple teachers separated by comma
                                schedule.nama_guru.split(',').map((guru, index) => (
                                  <Badge key={index} variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                    {guru.trim()}
                                  </Badge>
                                ))
                              ) : schedule.nama_guru ? (
                                // Single teacher
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                  {schedule.nama_guru}
                                </Badge>
                              ) : (
                                // No teacher assigned
                                <Badge variant="secondary" className="text-xs">
                                  Belum ada guru
                                </Badge>
                              )}
                            </div>
                            
                            {/* Show multi-guru indicator if applicable */}
                            {schedule.is_multi_guru && (
                              <div className="flex items-center gap-1 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  <Users className="w-3 h-3 mr-1" />
                                  Multi-Guru
                                </Badge>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="font-medium">{schedule.keterangan_khusus || '-'}</span>
                        )}
                      </div>
                    </div>
                    
                    {schedule.nama_ruang && (
                      <div className="text-xs">
                        <span className="text-gray-500">Ruang:</span>
                        <p className="mt-1 font-medium">{schedule.nama_ruang}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

// ManageRoomsView Component
const ManageRoomsView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] = useState({
    kode_ruang: '',
    nama_ruang: '',
    lokasi: '',
    kapasitas: '',
    status: 'aktif'
  });

  const fetchRooms = useCallback(async () => {
    try {
      const response = await apiCall('/api/admin/ruang', { onLogout });
      setRooms(response);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast({ title: "Error memuat data ruang", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.kode_ruang || formData.kode_ruang.trim() === '') {
      toast({ title: "Error", description: "Kode ruang wajib diisi!", variant: "destructive" });
      return;
    }
    if (!/^[A-Za-z0-9]{2,20}$/.test(formData.kode_ruang.trim())) {
      toast({ title: "Error", description: "Kode ruang harus 2-20 karakter alfanumerik!", variant: "destructive" });
      return;
    }
    if (formData.kapasitas && (isNaN(parseInt(formData.kapasitas)) || parseInt(formData.kapasitas) <= 0)) {
      toast({ title: "Error", description: "Kapasitas harus berupa angka positif!", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);

    try {
      if (editingId) {
        // Update existing room
        await apiCall(`/api/admin/ruang/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({
            kode_ruang: formData.kode_ruang,
            nama_ruang: formData.nama_ruang,
            lokasi: formData.lokasi,
            kapasitas: formData.kapasitas ? parseInt(formData.kapasitas) : null,
            status: formData.status
          }),
          onLogout
      });

        toast({
          title: "Berhasil",
          description: "Ruang berhasil diperbarui"
        });
      } else {
        // Create new room
        await apiCall('/api/admin/ruang', {
          method: 'POST',
          body: JSON.stringify({
            kode_ruang: formData.kode_ruang,
            nama_ruang: formData.nama_ruang,
            lokasi: formData.lokasi,
            kapasitas: formData.kapasitas ? parseInt(formData.kapasitas) : null,
            status: formData.status
          }),
          onLogout
      });

        toast({
          title: "Berhasil",
          description: "Ruang berhasil ditambahkan"
        });
      }

      // Reset form
      setFormData({
        kode_ruang: '',
        nama_ruang: '',
        lokasi: '',
        kapasitas: '',
        status: 'aktif'
      });
      setEditingId(null);
      setDialogOpen(false);
      fetchRooms();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (room: Room) => {
    setFormData({
      kode_ruang: room.kode_ruang,
      nama_ruang: room.nama_ruang || '',
      lokasi: room.lokasi || '',
      kapasitas: room.kapasitas?.toString() || '',
      status: room.status
    });
    setEditingId(room.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus ruang ini? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }
    try {
      await apiCall(`/api/admin/ruang/${id}`, {
        method: 'DELETE',
        onLogout
      });

      toast({
        title: "Berhasil",
        description: "Ruang berhasil dihapus"
      });
      fetchRooms();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.kode_ruang.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (room.nama_ruang && room.nama_ruang.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (room.lokasi && room.lokasi.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (showImport) {
    return <ExcelImportView entityType="ruang" entityName="Ruang Kelas" onBack={() => setShowImport(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Kelola Ruang Kelas</h2>
          <p className="text-sm text-gray-600">Tambah, edit, dan hapus data ruang kelas</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={onBack} variant="outline" size="sm" className="text-xs">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Kembali
          </Button>
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Import Excel
          </Button>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Tambah Ruang
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cari ruang kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Badge variant="secondary" className="px-2 py-1 text-xs whitespace-nowrap">
              {filteredRooms.length} ruang ditemukan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="w-4 h-4" />
            Daftar Ruang Kelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRooms.length === 0 ? (
            <div className="text-center py-8">
              <Home className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
              <p className="text-sm text-gray-600">
                {searchTerm ? 'Tidak ada ruang yang cocok dengan pencarian' : 'Belum ada ruang kelas yang ditambahkan'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View - hidden on mobile and tablet */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Kode Ruang</TableHead>
                      <TableHead className="text-xs">Nama Ruang</TableHead>
                      <TableHead className="text-xs">Lokasi</TableHead>
                      <TableHead className="text-xs">Kapasitas</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-right text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRooms.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell className="font-medium text-xs">{room.kode_ruang}</TableCell>
                        <TableCell className="text-xs">{room.nama_ruang || '-'}</TableCell>
                        <TableCell className="text-xs">{room.lokasi || '-'}</TableCell>
                        <TableCell className="text-xs">{room.kapasitas || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={room.status === 'aktif' ? 'default' : 'secondary'} className="text-xs">
                            {room.status === 'aktif' ? 'Aktif' : 'Tidak Aktif'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(room)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin menghapus ruang {room.kode_ruang}? 
                                    Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(room.id)}>
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile & Tablet Card View */}
              <div className="lg:hidden space-y-3">
                {filteredRooms.map((room) => (
                  <Card key={room.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">{room.kode_ruang}</h3>
                          <p className="text-xs text-gray-500">{room.nama_ruang || 'Tidak ada nama'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(room)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus ruang {room.kode_ruang}? 
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(room.id)}>
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Lokasi:</span>
                          <p className="font-medium">{room.lokasi || '-'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Kapasitas:</span>
                          <p className="font-medium">{room.kapasitas || '-'}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Status:</span>
                          <div className="mt-1">
                            <Badge variant={room.status === 'aktif' ? 'default' : 'secondary'} className="text-xs">
                              {room.status === 'aktif' ? 'Aktif' : 'Tidak Aktif'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingId ? 'Edit Ruang Kelas' : 'Tambah Ruang Kelas'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingId ? 'Perbarui informasi ruang kelas' : 'Tambahkan ruang kelas baru'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="kode_ruang" className="text-sm font-medium">Kode Ruang *</Label>
                <Input
                  id="kode_ruang"
                  value={formData.kode_ruang}
                  onChange={(e) => setFormData({ ...formData, kode_ruang: e.target.value.toUpperCase() })}
                  placeholder="R34"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="nama_ruang" className="text-sm font-medium">Nama Ruang</Label>
                <Input
                  id="nama_ruang"
                  value={formData.nama_ruang}
                  onChange={(e) => setFormData({ ...formData, nama_ruang: e.target.value })}
                  placeholder="Ruang 34"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lokasi" className="text-sm font-medium">Lokasi</Label>
                <Input
                  id="lokasi"
                  value={formData.lokasi}
                  onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                  placeholder="Gedung A Lantai 3"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="kapasitas" className="text-sm font-medium">Kapasitas</Label>
                <Input
                  id="kapasitas"
                  type="number"
                  value={formData.kapasitas}
                  onChange={(e) => setFormData({ ...formData, kapasitas: e.target.value })}
                  placeholder="30"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="status" className="text-sm font-medium">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="tidak_aktif">Tidak Aktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="text-sm">
                Batal
              </Button>
              <Button type="submit" disabled={isLoading} className="text-sm">
                {isLoading ? 'Menyimpan...' : (editingId ? 'Perbarui' : 'Tambah')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Live Student Attendance View
interface LiveStudentRow {
  id?: number;
  nama: string;
  nis: string;
  nama_kelas: string;
  status: string;
  waktu_absen: string | null;
  keterangan: string | null;
  keterangan_waktu?: string;
  periode_absen?: string;
}

const LiveStudentAttendanceView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [attendanceData, setAttendanceData] = useState<LiveStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(getWIBTime());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 45;
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('all');
  const [classes, setClasses] = useState<{id_kelas: number; nama_kelas: string}[]>([]);

  // Update waktu setiap detik
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getWIBTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch classes for filter
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const token = localStorage.getItem('token');
        const data = await apiCall('/api/admin/classes', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        setClasses(data);
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    };
    fetchClasses();
  }, []);

  // Filter and search data
  const filteredData = attendanceData.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nis.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesKelas = selectedKelas === 'all' || 
      item.nama_kelas === selectedKelas;
    
    // Jika ada pencarian, tampilkan semua data yang sesuai
    // Jika tidak ada pencarian, hanya tampilkan yang sudah absen
    const hasAttended = item.status !== 'Belum Absen' && item.waktu_absen !== null;
    
    if (searchQuery !== '') {
      return matchesSearch && matchesKelas;
    } else {
      return hasAttended && matchesKelas;
    }
  });

  // Reset to first page when filtered data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        setError('');
        // console.log();
        const token = localStorage.getItem('token');
        const data = await apiCall('/api/admin/live-student-attendance', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          onLogout: () => {
            toast({
              title: "Error",
              description: "Sesi Anda telah berakhir. Silakan login ulang.",
              variant: "destructive"
            });
            setTimeout(() => onLogout(), 2000);
          }
        });

        // console.log();
        setAttendanceData(data);
      } catch (error: unknown) {
        console.error('❌ Error fetching live student attendance:', error);
        const message = error instanceof Error ? error.message : String(error);
        setError('Gagal memuat data absensi siswa: ' + message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
    
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchStudentData, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [onLogout, autoRefresh]);

  // Fungsi untuk mengelompokkan data berdasarkan waktu
  const groupAttendanceByTime = (data: LiveStudentRow[]) => {
    const groups = {
      pagi: data.filter(item => {
        if (!item.waktu_absen) return false;
        const hour = parseInt(item.waktu_absen.split(':')[0]);
        return hour >= 6 && hour < 12;
      }),
      siang: data.filter(item => {
        if (!item.waktu_absen) return false;
        const hour = parseInt(item.waktu_absen.split(':')[0]);
        return hour >= 12 && hour < 15;
      }),
      sore: data.filter(item => {
        if (!item.waktu_absen) return false;
        const hour = parseInt(item.waktu_absen.split(':')[0]);
        return hour >= 15 && hour < 18;
      }),
      belumAbsen: data.filter(item => !item.waktu_absen)
    };
    return groups;
  };

  // Komponen statistik kehadiran - Modern Design
  const AttendanceStats = ({ data }: { data: LiveStudentRow[] }) => {
    const total = data.length;
    const hadir = data.filter(item => item.status === 'Hadir').length;
    const izin = data.filter(item => item.status === 'Izin').length;
    const sakit = data.filter(item => item.status === 'Sakit').length;
    const alpa = data.filter(item => item.status === 'Alpa').length;
    const dispen = data.filter(item => item.status === 'Dispen').length;
    
    const presentase = total > 0 ? Math.round((hadir / total) * 100) : 0;

    const stats = [
      { label: 'Hadir', value: hadir, color: 'emerald', icon: CheckCircle2, pct: total > 0 ? Math.round((hadir/total)*100) : 0 },
      { label: 'Izin', value: izin, color: 'amber', icon: FileText, pct: total > 0 ? Math.round((izin/total)*100) : 0 },
      { label: 'Sakit', value: sakit, color: 'sky', icon: AlertTriangle, pct: total > 0 ? Math.round((sakit/total)*100) : 0 },
      { label: 'Alpa', value: alpa, color: 'rose', icon: X, pct: total > 0 ? Math.round((alpa/total)*100) : 0 },
      { label: 'Dispen', value: dispen, color: 'violet', icon: Clock, pct: total > 0 ? Math.round((dispen/total)*100) : 0 },
      { label: 'Total', value: total, color: 'slate', icon: Users, pct: presentase, pctLabel: '% Hadir' },
    ];

    const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
      emerald: { bg: 'bg-emerald-50', border: 'border-l-emerald-500', text: 'text-emerald-700', icon: 'text-emerald-500' },
      amber: { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700', icon: 'text-amber-500' },
      sky: { bg: 'bg-sky-50', border: 'border-l-sky-500', text: 'text-sky-700', icon: 'text-sky-500' },
      rose: { bg: 'bg-rose-50', border: 'border-l-rose-500', text: 'text-rose-700', icon: 'text-rose-500' },
      violet: { bg: 'bg-violet-50', border: 'border-l-violet-500', text: 'text-violet-700', icon: 'text-violet-500' },
      slate: { bg: 'bg-slate-50', border: 'border-l-slate-500', text: 'text-slate-700', icon: 'text-slate-500' },
    };
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {stats.map((stat) => {
          const colors = colorMap[stat.color];
          const IconComponent = stat.icon;
          return (
            <div 
              key={stat.label}
              className={`${colors.bg} ${colors.border} border-l-4 rounded-lg p-4 transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-2">
                <IconComponent className={`w-5 h-5 ${colors.icon}`} />
                <span className={`text-xs font-medium ${colors.text} opacity-75`}>
                  {stat.pct}%{stat.pctLabel || ''}
                </span>
              </div>
              <p className={`text-2xl font-bold ${colors.text}`}>{stat.value}</p>
              <p className={`text-sm ${colors.text} opacity-80`}>{stat.label}</p>
            </div>
          );
        })}
      </div>
    );
  };

  // Komponen progress kehadiran - Modern Gauge Design
  const AttendanceProgress = ({ data }: { data: LiveStudentRow[] }) => {
    const total = data.length;
    const hadir = data.filter(item => item.status === 'Hadir').length;
    const izin = data.filter(item => item.status === 'Izin').length;
    const sakit = data.filter(item => item.status === 'Sakit').length;
    const alpa = data.filter(item => item.status === 'Alpa').length;
    
    const presentase = total > 0 ? Math.round((hadir / total) * 100) : 0;
    const circumference = 2 * Math.PI * 45; // radius 45
    const strokeDashoffset = circumference - (presentase / 100) * circumference;
    
    return (
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 mb-6 border border-emerald-100">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Circular Progress */}
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="#e5e7eb"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="url(#gradient)"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700 ease-out"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="text-3xl font-bold text-emerald-700">{presentase}%</span>
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Tingkat Kehadiran Hari Ini</h3>
            <p className="text-slate-600 text-sm mb-4">{hadir} dari {total} siswa hadir</p>
            
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{hadir}</p>
                <p className="text-xs text-slate-500">Hadir</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-amber-600">{izin}</p>
                <p className="text-xs text-slate-500">Izin</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-sky-600">{sakit}</p>
                <p className="text-xs text-slate-500">Sakit</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-rose-600">{alpa}</p>
                <p className="text-xs text-slate-500">Alpa</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Komponen pagination - FIXED: Don't show if no data
  const Pagination = () => {
    if (totalPages <= 1 || totalPages === 0) return null;

    const getPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5;
      
      if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= 4; i++) {
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1);
          pages.push('...');
          for (let i = totalPages - 3; i <= totalPages; i++) {
            pages.push(i);
          }
        } else {
          pages.push(1);
          pages.push('...');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        }
      }
      
      return pages;
    };

    return (
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600">
          Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredData.length)} dari {filteredData.length} data
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          
          {getPageNumbers().map((page, index) => {
            const uniqueKey = typeof page === 'number' 
              ? `student-page-${page}` 
              : `student-ellipsis-${index}`;
            
            return (
              <Button
                key={uniqueKey}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => typeof page === 'number' && setCurrentPage(page)}
                disabled={page === '...'}
                className={page === '...' ? 'cursor-default' : ''}
              >
                {page}
              </Button>
            );
          })}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </Button>
        </div>
      </div>
    );
  };

  const handleExport = () => {
    try {
      // Check filteredData instead of attendanceData to ensure we export what user sees
      if (!filteredData || filteredData.length === 0) {
        toast({
          title: "Info",
          description: "Tidak ada data untuk diekspor. Coba nonaktifkan filter atau ubah kriteria pencarian."
        });
        return;
      }

      // console.log();

      // Prepare data for Excel export
      const exportData = filteredData.map((student: LiveStudentRow, index: number) => ({
        'No': index + 1,
        'Nama Siswa': student.nama || '',
        'NIS': student.nis || '',
        'Kelas': student.nama_kelas || '',
        'Status': student.status || '',
        'Waktu Absen': student.waktu_absen || '',
        'Ket. Waktu': student.keterangan_waktu || '',
        'Periode': student.periode_absen || '',
        'Keterangan': student.keterangan || ''
      }));

      // Create CSV content with UTF-8 BOM
      const BOM = '\uFEFF';
      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(row =>
        Object.values(row).map(value =>
          typeof value === 'string' && value.includes(',') ? `"${value}"` : value
        ).join(',')
      );
      const csvContent = BOM + headers + '\n' + rows.join('\n');

      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `pemantauan_siswa_live_${getCurrentDateWIB()}.csv`;
      link.click();

      // console.log();
    } catch (error: unknown) {
      console.error('❌ Error exporting live student attendance:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert('Gagal mengekspor data: ' + message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Memuat data pemantauan siswa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={onBack} variant="outline">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Kembali ke Menu Laporan
      </Button>

      {/* Info Hari dan Waktu */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-800">
                  {formatDateOnly(currentTime)}
                </p>
                <p className="text-sm text-blue-600">
                  Jam: {formatTime24WithSeconds(currentTime)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-600">Data Real-time</p>
              <p className="text-xs text-blue-500">Update setiap 30 detik</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center text-red-800">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistik Kehadiran */}
      <AttendanceStats data={filteredData} />

      {/* Progress Bar Kehadiran */}
      <AttendanceProgress data={filteredData} />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Pemantauan Siswa Langsung
                {searchQuery === '' ? (
                  <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                    Mode: Hanya yang Sudah Absen
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                    Mode: Pencarian (Semua Data)
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Daftar absensi siswa secara realtime untuk hari ini. Data diperbarui setiap 30 detik.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => setAutoRefresh(!autoRefresh)} 
                size="sm" 
                variant={autoRefresh ? "default" : "outline"}
                className={autoRefresh ? "bg-green-600 hover:bg-green-700" : ""}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
              </Button>
              <Button onClick={handleExport} size="sm" disabled={!filteredData?.length}>
                <Download className="w-4 h-4 mr-2" />
                Export ke CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter and Search Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pencarian (Nama atau NIS)
                {searchQuery === '' && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Kosongkan untuk melihat hanya yang sudah absen)
                  </span>
                )}
                {searchQuery !== '' && (
                  <span className="text-xs text-blue-600 ml-2">
                    (Menampilkan semua data termasuk yang belum absen)
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="Cari berdasarkan nama atau NIS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter Kelas
              </label>
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Kelas</option>
                {classes.map((kelas, index) => (
                  <option key={`kelas-${kelas.id_kelas}-${index}`} value={kelas.nama_kelas}>
                    {kelas.nama_kelas}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredData && filteredData.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Waktu Absen</TableHead>
                      <TableHead>Ket. Waktu</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentData.map((student: LiveStudentRow, index: number) => (
                      <TableRow key={`${student.nis}-${startIndex + index}`}>
                        <TableCell className="font-medium">{student.nama}</TableCell>
                        <TableCell>{student.nis}</TableCell>
                        <TableCell>{student.nama_kelas}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            student.status === 'Hadir'
                              ? 'bg-green-100 text-green-800'
                              : student.status === 'Sakit' || student.status === 'Izin'
                              ? 'bg-yellow-100 text-yellow-800'
                              : student.status === 'Dispen'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {student.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {student.waktu_absen ? (
                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                              {student.waktu_absen}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            student.keterangan_waktu === 'Tepat Waktu' ? 'bg-green-100 text-green-800' :
                            student.keterangan_waktu === 'Terlambat Ringan' ? 'bg-yellow-100 text-yellow-800' :
                            student.keterangan_waktu === 'Terlambat' ? 'bg-orange-100 text-orange-800' :
                            student.keterangan_waktu === 'Terlambat Berat' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {student.keterangan_waktu || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            student.periode_absen === 'Pagi' ? 'bg-blue-100 text-blue-800' :
                            student.periode_absen === 'Siang' ? 'bg-yellow-100 text-yellow-800' :
                            student.periode_absen === 'Sore' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {student.periode_absen || '-'}
                          </span>
                        </TableCell>
                        <TableCell>{student.keterangan || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination />
            </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{filteredData.length === 0 && attendanceData.length > 0 ? 'Tidak ada data yang sesuai dengan filter' : 'Belum ada data absensi siswa'}</p>
                <p className="text-sm">{filteredData.length === 0 && attendanceData.length > 0 ? 'Coba ubah filter atau pencarian' : 'Data akan muncul saat siswa melakukan absensi'}</p>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
};



// Banding Absen Report Component
const BandingAbsenReportView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
    const [reportData, setReportData] = useState<{
      id_banding: number;
      tanggal_pengajuan: string;
      tanggal_absen: string;
      nama_pengaju: string;
      nama_kelas: string;
      nama_mapel: string;
      nama_guru: string;
      jam_mulai: string;
      jam_selesai: string;
      status_asli: string;
      status_diajukan: string;
      alasan_banding: string;
      status_banding: string;
      catatan_guru: string;
      tanggal_keputusan: string;
      diproses_oleh: string;
      jenis_banding: string;
    }[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateRange, setDateRange] = useState(() => {
      const today = getCurrentDateWIB();
      return {
        startDate: today,
        endDate: today
      };
    });
    const [selectedKelas, setSelectedKelas] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [classes, setClasses] = useState<Kelas[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchClasses = useCallback(async () => {
      try {
        setError(null);
        const data = await apiCall('/api/admin/classes', { onLogout });
        if (Array.isArray(data)) {
          setClasses(data);
        } else {
          setClasses([]);
        }
      } catch (error) {
        console.error('Error fetching classes:', error);
        setError('Gagal memuat data kelas');
        setClasses([]);
      }
    }, [onLogout]);

    useEffect(() => {
      fetchClasses();
    }, [fetchClasses]);

    const fetchReportData = async () => {
      if (!dateRange.startDate || !dateRange.endDate) {
        setError('Mohon pilih tanggal mulai dan tanggal selesai');
        toast({
          title: "Error",
          description: "Mohon pilih tanggal mulai dan tanggal selesai",
          variant: "destructive"
        });
        return;
      }

      setLoading(true);
      setError(null);
      setReportData([]); // Reset data sebelum load ulang
      
      try {
        const params = new URLSearchParams();
        
        params.append('startDate', dateRange.startDate);
        params.append('endDate', dateRange.endDate);
        
        if (selectedKelas && selectedKelas !== "all") {
          params.append('kelas_id', selectedKelas);
        }
        
        if (selectedStatus && selectedStatus !== "all") {
          params.append('status', selectedStatus);
        }

        // console.log();

        const data = await apiCall(`/api/admin/banding-absen-report?${params}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          }
        });
        
        // console.log();
        
        if (Array.isArray(data)) {
          setReportData(data);
          if (data.length > 0) {
            toast({
              title: "Berhasil",
              description: `Data laporan berhasil dimuat (${data.length} record)`
            });
          } else {
            toast({
              title: "Info",
              description: "Tidak ada data banding absen ditemukan untuk periode yang dipilih"
            });
          }
        } else {
          setReportData([]);
          toast({
            title: "Info",
            description: "Tidak ada data ditemukan untuk periode yang dipilih"
          });
        }
      } catch (error) {
        console.error('Network error:', error);
        setError('Terjadi kesalahan jaringan. Pastikan server berjalan.');
        toast({
          title: "Error",
          description: "Terjadi kesalahan jaringan. Pastikan server berjalan.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    const downloadExcel = async () => {
      try {
        const params = new URLSearchParams();
        
        if (dateRange.startDate && dateRange.endDate) {
          params.append('startDate', dateRange.startDate);
          params.append('endDate', dateRange.endDate);
        }
        
        if (selectedKelas && selectedKelas !== "all") {
          params.append('kelas_id', selectedKelas);
        }
        
        if (selectedStatus) {
          params.append('status', selectedStatus);
        }

        // console.log();

        // UBAH ENDPOINT KE EXCEL FORMAT
        const response = await fetch(getApiUrl(`/api/export/banding-absen?${params}`), {
          credentials: 'include',
          headers: {
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          }
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          // UBAH EXTENSION KE .xlsx
          a.download = `riwayat-banding-absen-${dateRange.startDate || 'all'}-${dateRange.endDate || 'all'}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          
          toast({
            title: "Berhasil",
            description: "Laporan berhasil didownload dalam format Excel"
          });
        } else {
          if (response.status === 401) {
            toast({
              title: "Error",
              description: "Sesi Anda telah berakhir. Silakan login ulang.",
              variant: "destructive"
            });
            setTimeout(() => onLogout(), 2000);
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Gagal mendownload laporan' }));
            console.error('Download error:', errorData);
            toast({
              title: "Error",
              description: errorData.error || "Gagal mendownload laporan", 
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        console.error('Download network error:', error);
        toast({
          title: "Error",
          description: "Terjadi kesalahan jaringan saat download. Pastikan server berjalan.",
          variant: "destructive" 
        });
      }
    };

    const downloadSMKN13Format = async (exportType) => {
      if (reportData.length === 0) {
        setError('Tidak ada data untuk diunduh');
        return;
      }

      if (!dateRange.startDate || !dateRange.endDate) {
        setError('Mohon pilih tanggal mulai dan tanggal selesai');
        toast({
          title: "Error",
          description: "Mohon pilih tanggal mulai dan tanggal selesai",
          variant: "destructive"
        });
        return;
      }

      try {
        const params = new URLSearchParams();
        
        if (dateRange.startDate) {
          params.append('startDate', dateRange.startDate);
        }
        
        if (dateRange.endDate) {
          params.append('endDate', dateRange.endDate);
        }
        
        if (selectedKelas && selectedKelas !== "all") {
          params.append('kelas_id', selectedKelas);
        }
        
        if (selectedStatus && selectedStatus !== "all") {
          params.append('status', selectedStatus);
        }

        const url = getApiUrl(`/api/export/${exportType}?${params.toString()}`);
        const response = await fetch(url, { 
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Gagal mengunduh file format SMKN 13');
        }
        
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `banding-absen-smkn13-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
        link.click();
        
        toast({
          title: "Berhasil!",
          description: "File format SMKN 13 berhasil diunduh"
        });
      } catch (err) {
        console.error('Error downloading SMKN 13 format:', err);
        setError('Gagal mengunduh file format SMKN 13');
        toast({
          title: "Error",
          description: "Gagal mengunduh file format SMKN 13",
          variant: "destructive"
        });
      }
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Riwayat Pengajuan Banding Absen</h1>
            <p className="text-gray-600">Laporan dan history pengajuan banding absensi</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="p-4 border-red-200 bg-red-50">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">{error}</p>
            </div>
          </Card>
        )}

        {/* Filter */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Filter Laporan</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="start-date">Tanggal Mulai</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="end-date">Tanggal Selesai</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
              />
            </div>
            <div>
              <Label>Kelas (Opsional)</Label>
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {classes.filter(kelas => kelas.id).map((kelas) => (
                    <SelectItem key={kelas.id} value={kelas.id.toString()}>
                      {kelas.nama_kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status Banding</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="disetujui">Disetujui</SelectItem>
                  <SelectItem value="ditolak">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={fetchReportData} disabled={loading}>
              {loading ? 'Memuat...' : 'Tampilkan Laporan'}
            </Button>
          </div>
        </Card>

        {/* Report Data */}
        {loading && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Sedang memuat data laporan...</p>
            </CardContent>
          </Card>
        )}

        {!loading && reportData.length === 0 && !error && (
          <Card>
            <CardContent className="p-12 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Belum ada data banding absen untuk ditampilkan</p>
              <p className="text-sm text-gray-500">Pilih filter dan klik "Tampilkan Laporan" untuk melihat data</p>
              <p className="text-xs text-gray-400 mt-2">Pastikan ada pengajuan banding absen dalam periode yang dipilih</p>
            </CardContent>
          </Card>
        )}

        {reportData.length > 0 && (
          <ExcelPreview
            title="Laporan Banding Absen"
            reportKey={VIEW_TO_REPORT_KEY['banding-absen-report']}
            data={reportData.map((record) => ({
              tanggal_pengajuan: record.tanggal_pengajuan,
              tanggal_absen: record.tanggal_absen,
              pengaju: record.nama_pengaju,
              kelas: record.nama_kelas,
              mata_pelajaran: record.nama_mapel || '-',
              guru: record.nama_guru || '-',
              jadwal: `${record.jam_mulai || '00:00'} - ${record.jam_selesai || '00:00'}`,
              status_asli: record.status_asli,
              status_diajukan: record.status_diajukan,
              status_banding: record.status_banding,
              jenis_banding: record.jenis_banding,
              alasan: record.alasan_banding || '-',
              catatan_guru: record.catatan_guru || '-',
              tanggal_keputusan: record.tanggal_keputusan || '-',
              diproses_oleh: record.diproses_oleh || '-'
            }))}
            columns={[
              { key: 'tanggal_pengajuan', label: 'Tanggal Pengajuan', width: 15, align: 'center', format: 'date' },
              { key: 'tanggal_absen', label: 'Tanggal Absen', width: 15, align: 'center', format: 'date' },
              { key: 'pengaju', label: 'Pengaju', width: 20, align: 'left' },
              { key: 'kelas', label: 'Kelas', width: 12, align: 'center' },
              { key: 'mata_pelajaran', label: 'Mata Pelajaran', width: 20, align: 'left' },
              { key: 'guru', label: 'Guru', width: 20, align: 'left' },
              { key: 'jadwal', label: 'Jadwal', width: 15, align: 'center' },
              { key: 'status_asli', label: 'Status Asli', width: 12, align: 'center' },
              { key: 'status_diajukan', label: 'Status Diajukan', width: 15, align: 'center' },
              { key: 'status_banding', label: 'Status Banding', width: 15, align: 'center' },
              { key: 'jenis_banding', label: 'Jenis Banding', width: 12, align: 'center' },
              { key: 'alasan', label: 'Alasan', width: 25, align: 'left' },
              { key: 'catatan_guru', label: 'Catatan Guru', width: 25, align: 'left' },
              { key: 'tanggal_keputusan', label: 'Tanggal Keputusan', width: 15, align: 'center', format: 'date' },
              { key: 'diproses_oleh', label: 'Diproses Oleh', width: 20, align: 'left' }
            ]}
            onExport={downloadExcel}
            onExportSMKN13={() => downloadSMKN13Format('banding-absen')}
            showLetterhead={true}
          />
        )}
      </div>
    );
};

// Live Teacher Attendance View
interface LiveTeacherRow {
  id?: number;
  nama: string;
  nip: string;
  nama_mapel: string;
  nama_kelas: string;
  jam_mulai: string;
  jam_selesai: string;
  status: string;
  waktu_absen: string | null;
  keterangan: string | null;
  keterangan_waktu?: string;
  periode_absen?: string;
}

const LiveTeacherAttendanceView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
    const [attendanceData, setAttendanceData] = useState<LiveTeacherRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentTime, setCurrentTime] = useState(getWIBTime());
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 45;
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMapel, setSelectedMapel] = useState('all');
    const [mapelList, setMapelList] = useState<{id_mapel: number; nama_mapel: string}[]>([]);

    // Update waktu setiap detik
    useEffect(() => {
      const timer = setInterval(() => setCurrentTime(getWIBTime()), 1000);
      return () => clearInterval(timer);
    }, []);

    // Fetch mapel list for filter
    useEffect(() => {
      const fetchMapelList = async () => {
        try {
          const token = localStorage.getItem('token');
          const data = await apiCall('/api/admin/mapel', {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            }
          });
          setMapelList(data);
        } catch (error) {
          console.error('Error fetching mapel list:', error);
        }
      };
      fetchMapelList();
    }, []);

    // Filter and search data
    const filteredData = attendanceData.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.nama_mapel && item.nama_mapel.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesMapel = selectedMapel === 'all' || 
        (item.nama_mapel && item.nama_mapel.includes(selectedMapel));
      
      // Selalu tampilkan semua data yang sesuai dengan filter pencarian dan mata pelajaran
      // Tidak perlu membedakan antara ada/tidak ada pencarian
      return matchesSearch && matchesMapel;
    });

    // Reset to first page when filtered data changes
    useEffect(() => {
      setCurrentPage(1);
    }, [filteredData]);

    // Calculate pagination
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentData = filteredData.slice(startIndex, endIndex);

    useEffect(() => {
      const fetchTeacherData = async () => {
        try {
          setError('');
          // console.log();
          const token = localStorage.getItem('token');
          const data = await apiCall('/api/admin/live-teacher-attendance', {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            onLogout: () => {
              toast({
                title: "Error",
                description: "Sesi Anda telah berakhir. Silakan login ulang.",
                variant: "destructive"
              });
              setTimeout(() => onLogout(), 2000);
            }
          });
          // console.log();
          setAttendanceData(data);
        } catch (error) {
          console.error('❌ Error fetching live teacher attendance:', error);
          setError('Gagal memuat data absensi guru: ' + error.message);
        } finally {
          setLoading(false);
        }
      };

      fetchTeacherData();
      
      let interval: NodeJS.Timeout | null = null;
      if (autoRefresh) {
        interval = setInterval(fetchTeacherData, 30000); // Refresh every 30 seconds
      }
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }, [onLogout, autoRefresh]);

    // Komponen statistik kehadiran guru - Modern Design
    const TeacherAttendanceStats = ({ data }: { data: LiveTeacherRow[] }) => {
      const total = data.length;
      const hadir = data.filter(item => item.status === 'Hadir').length;
      const tidakHadir = data.filter(item => item.status === 'Tidak Hadir').length;
      const sakit = data.filter(item => item.status === 'Sakit').length;
      const izin = data.filter(item => item.status === 'Izin').length;
      const dispen = data.filter(item => item.status === 'Dispen').length;
      const belumAbsen = data.filter(item => item.status === 'Belum Absen').length;
      
      const presentase = total > 0 ? Math.round((hadir / total) * 100) : 0;

      const stats = [
        { label: 'Hadir', value: hadir, color: 'emerald', icon: CheckCircle2, pct: total > 0 ? Math.round((hadir/total)*100) : 0 },
        { label: 'Tidak Hadir', value: tidakHadir, color: 'rose', icon: X, pct: total > 0 ? Math.round((tidakHadir/total)*100) : 0 },
        { label: 'Sakit', value: sakit, color: 'sky', icon: AlertTriangle, pct: total > 0 ? Math.round((sakit/total)*100) : 0 },
        { label: 'Izin', value: izin, color: 'amber', icon: FileText, pct: total > 0 ? Math.round((izin/total)*100) : 0 },
        { label: 'Dispen', value: dispen, color: 'violet', icon: Clock, pct: total > 0 ? Math.round((dispen/total)*100) : 0 },
        { label: 'Belum Absen', value: belumAbsen, color: 'slate', icon: Clock, pct: total > 0 ? Math.round((belumAbsen/total)*100) : 0 },
        { label: 'Total', value: total, color: 'indigo', icon: GraduationCap, pct: presentase, pctLabel: '% Hadir' },
      ];

      const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
        emerald: { bg: 'bg-emerald-50', border: 'border-l-emerald-500', text: 'text-emerald-700', icon: 'text-emerald-500' },
        rose: { bg: 'bg-rose-50', border: 'border-l-rose-500', text: 'text-rose-700', icon: 'text-rose-500' },
        sky: { bg: 'bg-sky-50', border: 'border-l-sky-500', text: 'text-sky-700', icon: 'text-sky-500' },
        amber: { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700', icon: 'text-amber-500' },
        violet: { bg: 'bg-violet-50', border: 'border-l-violet-500', text: 'text-violet-700', icon: 'text-violet-500' },
        slate: { bg: 'bg-slate-50', border: 'border-l-slate-500', text: 'text-slate-700', icon: 'text-slate-500' },
        indigo: { bg: 'bg-indigo-50', border: 'border-l-indigo-500', text: 'text-indigo-700', icon: 'text-indigo-500' },
      };
      
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {stats.map((stat) => {
            const colors = colorMap[stat.color];
            const IconComponent = stat.icon;
            return (
              <div 
                key={stat.label}
                className={`${colors.bg} ${colors.border} border-l-4 rounded-lg p-4 transition-all hover:shadow-md`}
              >
                <div className="flex items-center justify-between mb-2">
                  <IconComponent className={`w-5 h-5 ${colors.icon}`} />
                  <span className={`text-xs font-medium ${colors.text} opacity-75`}>
                    {stat.pct}%{stat.pctLabel || ''}
                  </span>
                </div>
                <p className={`text-2xl font-bold ${colors.text}`}>{stat.value}</p>
                <p className={`text-sm ${colors.text} opacity-80`}>{stat.label}</p>
              </div>
            );
          })}
        </div>
      );
    };

    // Komponen progress kehadiran guru - Modern Gauge Design
    const TeacherAttendanceProgress = ({ data }: { data: LiveTeacherRow[] }) => {
      const total = data.length;
      const hadir = data.filter(item => item.status === 'Hadir').length;
      const sakit = data.filter(item => item.status === 'Sakit').length;
      const izin = data.filter(item => item.status === 'Izin').length;
      const tidakHadir = data.filter(item => item.status === 'Tidak Hadir').length;
      
      const presentase = total > 0 ? Math.round((hadir / total) * 100) : 0;
      const circumference = 2 * Math.PI * 45;
      const strokeDashoffset = circumference - (presentase / 100) * circumference;
      
      return (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 mb-6 border border-indigo-100">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="45" stroke="#e5e7eb" strokeWidth="10" fill="none" />
                <circle
                  cx="64" cy="64" r="45"
                  stroke="url(#gradientTeacher)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="gradientTeacher" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-indigo-700">{presentase}%</span>
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Tingkat Kehadiran Guru Hari Ini</h3>
              <p className="text-slate-600 text-sm mb-4">{hadir} dari {total} guru hadir</p>
              
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-indigo-600">{hadir}</p>
                  <p className="text-xs text-slate-500">Hadir</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-600">{izin}</p>
                  <p className="text-xs text-slate-500">Izin</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-sky-600">{sakit}</p>
                  <p className="text-xs text-slate-500">Sakit</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-rose-600">{tidakHadir}</p>
                  <p className="text-xs text-slate-500">Tidak Hadir</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    // Komponen pagination untuk guru
    const TeacherPagination = () => {
      if (totalPages <= 1) return null;

      const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;
        
        if (totalPages <= maxVisiblePages) {
          for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
          }
        } else {
          if (currentPage <= 3) {
            for (let i = 1; i <= 4; i++) {
              pages.push(i);
            }
            pages.push('...');
            pages.push(totalPages);
          } else if (currentPage >= totalPages - 2) {
            pages.push(1);
            pages.push('...');
            for (let i = totalPages - 3; i <= totalPages; i++) {
              pages.push(i);
            }
          } else {
            pages.push(1);
            pages.push('...');
            for (let i = currentPage - 1; i <= currentPage + 1; i++) {
              pages.push(i);
            }
            pages.push('...');
            pages.push(totalPages);
          }
        }
        
        return pages;
      };

      return (
        <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600">
          Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredData.length)} dari {filteredData.length} data
        </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            
            {getPageNumbers().map((page, index) => {
              const uniqueKey = typeof page === 'number' 
                ? `teacher-page-${page}` 
                : `teacher-ellipsis-${index}`;
              
              return (
                <Button
                  key={uniqueKey}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => typeof page === 'number' && setCurrentPage(page)}
                  disabled={page === '...'}
                  className={page === '...' ? 'cursor-default' : ''}
                >
                  {page}
                </Button>
              );
            })}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      );
    };

    const handleExport = () => {
      try {
        // Check filteredData instead of attendanceData to ensure we export what user sees
        if (!filteredData || filteredData.length === 0) {
          toast({
            title: "Info",
            description: "Tidak ada data untuk diekspor. Coba nonaktifkan filter atau ubah kriteria pencarian."
          });
          return;
        }

        // console.log();
        
        // Prepare data for Excel export
        const exportData = filteredData.map((teacher, index) => ({
          'No': index + 1,
          'Nama Guru': teacher.nama || '',
          'NIP': teacher.nip || '',
          'Mata Pelajaran': teacher.nama_mapel || '',
          'Kelas': teacher.nama_kelas || '',
          'Jadwal': `${teacher.jam_mulai || ''} - ${teacher.jam_selesai || ''}`,
          'Status': teacher.status || '',
          'Waktu Absen': teacher.waktu_absen || '',
          'Ket. Waktu': teacher.keterangan_waktu || '',
          'Periode': teacher.periode_absen || '',
          'Keterangan': teacher.keterangan || ''
        }));

        // Create CSV content with UTF-8 BOM
        const BOM = '\uFEFF';
        const headers = Object.keys(exportData[0]).join(',');
        const rows = exportData.map(row => 
          Object.values(row).map(value => 
            typeof value === 'string' && value.includes(',') ? `"${value}"` : value
          ).join(',')
        );
        const csvContent = BOM + headers + '\n' + rows.join('\n');

        // Download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pemantauan_guru_live_${getCurrentDateWIB()}.csv`;
        link.click();
        
        toast({
          title: "Berhasil",
          description: "Data guru berhasil diekspor ke CSV"
        });
        // console.log();
      } catch (error) {
        console.error('❌ Error exporting live teacher attendance:', error);
        toast({
          title: "Error",
          description: "Gagal mengekspor data: " + error.message,
          variant: "destructive"
        });
      }
    };

    if (loading) {
      return (
        <div className="space-y-4">
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Menu Laporan
          </Button>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Memuat data pemantauan guru...</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Menu Laporan
        </Button>

        {/* Info Hari dan Waktu */}
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Clock className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="font-semibold text-indigo-800">
                    {formatDateOnly(currentTime)}
                  </p>
                  <p className="text-sm text-indigo-600">
                    Jam: {formatTime24WithSeconds(currentTime)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-indigo-600">Data Real-time</p>
                <p className="text-xs text-indigo-500">Update setiap 30 detik</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center text-red-800">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistik Kehadiran Guru */}
        <TeacherAttendanceStats data={filteredData} />

        {/* Progress Bar Kehadiran Guru */}
        <TeacherAttendanceProgress data={filteredData} />

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center">
                  <GraduationCap className="w-5 h-5 mr-2" />
                  Pemantauan Guru Langsung
                  {searchQuery === '' ? (
                    <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                      Mode: Hanya yang Sudah Absen
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                      Mode: Pencarian (Semua Data)
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Daftar validasi kehadiran guru secara realtime untuk hari ini. Data diperbarui setiap 30 detik.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setAutoRefresh(!autoRefresh)} 
                  size="sm" 
                  variant={autoRefresh ? "default" : "outline"}
                  className={autoRefresh ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                  Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
                </Button>
                <Button onClick={handleExport} size="sm" disabled={!filteredData?.length}>
                  <Download className="w-4 h-4 mr-2" />
                  Export ke CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filter and Search Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pencarian (Nama, NIP, atau Mata Pelajaran)
                  <span className="text-xs text-gray-500 ml-2">
                    (Menampilkan semua guru yang sesuai kriteria pencarian)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama, NIP, atau mata pelajaran..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:w-48">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter Mata Pelajaran
                </label>
                <select
                  value={selectedMapel}
                  onChange={(e) => setSelectedMapel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Semua Mata Pelajaran</option>
                  {mapelList.map((mapel, index) => (
                    <option key={`mapel-${mapel.id_mapel}-${index}`} value={mapel.nama_mapel}>
                      {mapel.nama_mapel}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredData && filteredData.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Guru</TableHead>
                        <TableHead>NIP</TableHead>
                        <TableHead>Mata Pelajaran</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead>Jadwal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Waktu Absen</TableHead>
                        <TableHead>Ket. Waktu</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead>Keterangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentData.map((teacher, index) => (
                        <TableRow key={`${teacher.nip}-${startIndex + index}`}>
                          <TableCell className="font-medium">{teacher.nama}</TableCell>
                          <TableCell>{teacher.nip}</TableCell>
                          <TableCell>{teacher.nama_mapel}</TableCell>
                          <TableCell>{teacher.nama_kelas}</TableCell>
                          <TableCell>{teacher.jam_mulai} - {teacher.jam_selesai}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              teacher.status === 'Hadir' 
                                ? 'bg-green-100 text-green-800' 
                                : teacher.status === 'Sakit' || teacher.status === 'Izin'
                                ? 'bg-yellow-100 text-yellow-800'
                                : teacher.status === 'Dispen'
                                ? 'bg-purple-100 text-purple-800'
                                : teacher.status === 'Belum Absen'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {teacher.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {teacher.waktu_absen ? (
                              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                                {teacher.waktu_absen}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              teacher.keterangan_waktu === 'Tepat Waktu' ? 'bg-green-100 text-green-800' :
                              teacher.keterangan_waktu === 'Terlambat Ringan' ? 'bg-yellow-100 text-yellow-800' :
                              teacher.keterangan_waktu === 'Terlambat' ? 'bg-orange-100 text-orange-800' :
                              teacher.keterangan_waktu === 'Terlambat Berat' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {teacher.keterangan_waktu || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              teacher.periode_absen === 'Pagi' ? 'bg-blue-100 text-blue-800' :
                              teacher.periode_absen === 'Siang' ? 'bg-yellow-100 text-yellow-800' :
                              teacher.periode_absen === 'Sore' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {teacher.periode_absen || '-'}
                            </span>
                          </TableCell>
                          <TableCell>{teacher.keterangan || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TeacherPagination />
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{filteredData.length === 0 && attendanceData.length > 0 ? 'Tidak ada data yang sesuai dengan filter' : 'Belum ada data absensi guru hari ini'}</p>
                <p className="text-sm">{filteredData.length === 0 && attendanceData.length > 0 ? 'Coba ubah filter atau pencarian' : 'Data akan muncul saat guru melakukan absensi'}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
};

// Analytics Dashboard View
const AnalyticsDashboardView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
    const [analyticsData, setAnalyticsData] = useState(null);
    const [processingNotif, setProcessingNotif] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const dashboardRef = useRef<HTMLDivElement>(null);

    // Fullscreen toggle handler with cross-browser compatibility
    const toggleFullscreen = useCallback(() => {
      const elem = dashboardRef.current;
      if (!elem) return;

      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement && !(document as any).msFullscreenElement) {
        // Enter fullscreen
        if (elem.requestFullscreen) {
          elem.requestFullscreen();
        } else if ((elem as any).webkitRequestFullscreen) {
          (elem as any).webkitRequestFullscreen();
        } else if ((elem as any).msRequestFullscreen) {
          (elem as any).msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      }
    }, []);

    // Listen for fullscreen changes
    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement || !!(document as any).msFullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('msfullscreenchange', handleFullscreenChange);
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      };
    }, []);

    useEffect(() => {
      const fetchAnalyticsData = async () => {
        try {
          setError('');
          // console.log();
          const token = localStorage.getItem('token');
          const data = await apiCall('/api/admin/analytics', {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            onLogout: () => {
              toast({
                title: "Error",
                description: "Sesi Anda telah berakhir. Silakan login ulang.",
                variant: "destructive"
              });
              setTimeout(() => onLogout(), 2000);
            }
          });
          // console.log();
          setAnalyticsData(data);
        } catch (error) {
          console.error('❌ Error fetching analytics data:', error);
          setError('Gagal memuat data analitik: ' + error.message);
        } finally {
          setLoading(false);
        }
      };

      fetchAnalyticsData();
    }, [onLogout]);

    const handlePermissionRequest = async (notificationId: number, newStatus: 'disetujui' | 'ditolak') => {
      setProcessingNotif(notificationId);
      try {
        const data = await apiCall(`/api/admin/izin/${notificationId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({ status: newStatus }),
        });
        
        toast({
          title: "Berhasil",
          description: `Permintaan berhasil ${newStatus}`
        });
        setAnalyticsData(prevData => {
          if (!prevData) return null;
          const updatedNotifications = prevData.notifications.map(notif =>
            notif.id === notificationId ? { ...notif, status: newStatus } : notif
          );
          return { ...prevData, notifications: updatedNotifications };
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Tidak dapat terhubung ke server",
          variant: "destructive"
        });
      } finally {
        setProcessingNotif(null);
      }
    };

    if (loading) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Menu Laporan
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dasbor Analitik</h1>
              <p className="text-gray-600">Memuat data analitik...</p>
            </div>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Memuat data analitik...</p>
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="space-y-4">
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Menu Laporan
          </Button>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center text-red-800">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!analyticsData) {
      return (
        <div className="space-y-4">
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Menu Laporan
          </Button>
          <div className="text-center py-12 text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Gagal memuat data analitik</p>
          </div>
        </div>
      );
    }

    const { studentAttendance, teacherAttendance, topAbsentStudents, topAbsentTeachers, notifications } = analyticsData;

    return (
      <div ref={dashboardRef} className={`space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-gradient-to-br from-slate-50 to-blue-50 p-6 overflow-auto' : ''}`}>
        {/* Header - Modern */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-100">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="outline" className="bg-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                <BarChart3 className="w-6 h-6 mr-2 text-orange-500" />
                Dasbor Analitik
              </h1>
              <p className="text-slate-600">Analisis dan statistik kehadiran siswa dan guru</p>
            </div>
            <div className="hidden md:flex items-center gap-3 text-right">
              <div>
                <p className="text-sm text-slate-500">Tanggal</p>
                <p className="font-mono text-slate-700">{getCurrentDateWIB()}</p>
              </div>
              <Button onClick={toggleFullscreen} variant="outline" size="sm" className="bg-white">
                {isFullscreen ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
                {isFullscreen ? 'Keluar' : 'Fullscreen'}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Student Attendance Chart - Modern */}
          <Card className="lg:col-span-2 border-0 shadow-sm">
            <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-teal-50">
              <CardTitle className="text-emerald-800 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Kehadiran Siswa
              </CardTitle>
              <CardDescription>Statistik kehadiran siswa per periode</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {studentAttendance && studentAttendance.length > 0 ? (
                <div className="space-y-4">
                  {studentAttendance.map((item, index) => {
                    const total = item.hadir + item.tidak_hadir;
                    const pct = total > 0 ? Math.round((item.hadir / total) * 100) : 0;
                    return (
                      <div key={`student-attendance-${item.periode}-${index}`} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-700">{item.periode}</span>
                          <span className="text-sm font-semibold text-emerald-600">{pct}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-emerald-400 to-teal-500 h-3 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                              {item.hadir}
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-rose-400 rounded-full" />
                              {item.tidak_hadir}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada data kehadiran siswa</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats Card - Modern */}
          <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-700 flex items-center text-lg">
                <Activity className="w-5 h-5 mr-2 text-slate-500" />
                Ringkasan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-emerald-700">Sistem</span>
                    </div>
                    <p className="text-lg font-bold text-emerald-600">Aktif</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-sky-100">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-sky-700">Database</span>
                    </div>
                    <p className="text-lg font-bold text-sky-600">OK</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Total Siswa</span>
                    <span className="text-sm font-semibold text-slate-700">{analyticsData?.totalStudents || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Total Guru</span>
                    <span className="text-sm font-semibold text-slate-700">{analyticsData?.totalTeachers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Server Time</span>
                    <span className="text-xs font-mono text-slate-600">{formatTime24WithSeconds(new Date())}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Teacher Attendance Chart - Modern */}
          <Card className="lg:col-span-3 border-0 shadow-sm">
            <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-violet-50">
              <CardTitle className="text-indigo-800 flex items-center">
                <GraduationCap className="w-5 h-5 mr-2" />
                Kehadiran Guru
              </CardTitle>
              <CardDescription>Statistik kehadiran guru per periode</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {teacherAttendance && teacherAttendance.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {teacherAttendance.map((item, index) => {
                    const total = item.hadir + item.tidak_hadir;
                    const pct = total > 0 ? Math.round((item.hadir / total) * 100) : 0;
                    return (
                      <div key={`teacher-attendance-${item.periode}-${index}`} className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-slate-700">{item.periode}</span>
                          <span className="text-sm font-semibold text-indigo-600">{pct}%</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden mb-3">
                          <div 
                            className="bg-gradient-to-r from-indigo-400 to-violet-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                            Hadir: {item.hadir}
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-rose-400 rounded-full" />
                            Tidak: {item.tidak_hadir}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada data kehadiran guru</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Absent Students - Modern List */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-pink-50">
              <CardTitle className="text-rose-800 flex items-center text-base">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Siswa Sering Alpa
              </CardTitle>
              <CardDescription className="text-xs">5 siswa dengan tingkat alpa tertinggi</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {topAbsentStudents && topAbsentStudents.length > 0 ? (
                <div className="space-y-3">
                  {topAbsentStudents.map((student, index) => (
                    <div key={`top-absent-student-${student.nama}-${index}`} 
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white
                        ${index === 0 ? 'bg-rose-500' : index === 1 ? 'bg-rose-400' : 'bg-rose-300'}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 truncate">{student.nama}</p>
                        <p className="text-xs text-slate-500">{student.nama_kelas}</p>
                      </div>
                      <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-full text-xs font-semibold">
                        {student.total_alpa}x
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Tidak ada data siswa alpa</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Absent Teachers - Modern List */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50">
              <CardTitle className="text-amber-800 flex items-center text-base">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Guru Sering Tidak Hadir
              </CardTitle>
              <CardDescription className="text-xs">5 guru dengan tingkat tidak hadir tertinggi</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {topAbsentTeachers && topAbsentTeachers.length > 0 ? (
                <div className="space-y-3">
                  {topAbsentTeachers.map((teacher, index) => (
                    <div key={`top-absent-teacher-${teacher.nama}-${index}`} 
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white
                        ${index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-amber-400' : 'bg-amber-300'}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 truncate">{teacher.nama}</p>
                      </div>
                      <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-semibold">
                        {teacher.total_tidak_hadir}x
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Tidak ada data guru tidak hadir</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  


// Student Attendance Summary Component
const StudentAttendanceSummaryView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [reportData, setReportData] = useState<Record<string, string | number | boolean>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const today = getCurrentDateWIB();
    return {
      startDate: today,
      endDate: today
    };
  });
  const [selectedKelas, setSelectedKelas] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [classes, setClasses] = useState<Kelas[]>([]);

  const fetchClasses = useCallback(async () => {
    try {
      setError(null);
      const data = await apiCall('/api/admin/classes', { onLogout });
      if (Array.isArray(data)) {
        setClasses(data);
      } else {
        console.error('Invalid classes data:', data);
        setClasses([]);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
      setError('Gagal memuat data kelas');
    }
  }, [onLogout]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = `${year}-${monthNum}-01`;
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const endDate = `${year}-${monthNum}-${lastDay}`;
      setDateRange({ startDate, endDate });
    }
  };

  const fetchReportData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Mohon pilih tanggal mulai dan tanggal selesai');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      
      if (selectedKelas && selectedKelas !== 'all') {
        params.append('kelas_id', selectedKelas);
      }

      const data = await apiCall(`/api/admin/student-attendance-summary?${params.toString()}`, { method: 'GET', onLogout });
      
      if (Array.isArray(data)) {
        setReportData(data);
      } else {
        console.error('Invalid report data:', data);
        setReportData([]);
        setError('Format data tidak valid');
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Gagal memuat data laporan');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    if (reportData.length === 0) {
      setError('Tidak ada data untuk diunduh');
      return;
    }

    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      
      if (selectedKelas && selectedKelas !== 'all') {
        params.append('kelas_id', selectedKelas);
      }

      const url = getApiUrl(`/api/admin/download-student-attendance-excel?${params.toString()}`);
      const response = await fetch(url, { 
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      
      if (!response.ok) {
        // Coba baca error message dari response
        let errorMessage = 'Gagal mengunduh file';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          }
        } catch (parseError) {
          console.warn('Could not parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ringkasan-kehadiran-siswa-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      link.click();
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
      console.error('Error downloading excel:', err);
      setError(`Gagal mengunduh file Excel: ${err.message}`);
    }
  };

  const downloadSMKN13Format = async (exportType) => {
    if (reportData.length === 0) {
      setError('Tidak ada data untuk diunduh');
      return;
    }

    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      
      if (selectedKelas && selectedKelas !== 'all') {
        params.append('kelas_id', selectedKelas);
      }

      const url = getApiUrl(`/api/export/${exportType}?${params.toString()}`);
      const response = await fetch(url, { 
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Gagal mengunduh file format SMKN 13');
      }
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${exportType}-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      link.click();
      
      toast({
        title: "Berhasil!",
        description: "File format SMKN 13 berhasil diunduh"
      });
    } catch (err) {
      console.error('Error downloading SMKN 13 format:', err);
      setError('Gagal mengunduh file format SMKN 13');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ringkasan Kehadiran Siswa</h1>
          <p className="text-gray-600">Download ringkasan kehadiran siswa dalam format CSV</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        </Card>
      )}

      {/* Filter */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Filter Laporan</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="month">Bulan (Opsional)</Label>
            <Input
              id="month"
              type="month"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              placeholder="Pilih bulan"
            />
          </div>
          <div>
            <Label htmlFor="start-date">Tanggal Mulai</Label>
            <Input
              id="start-date"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="end-date">Tanggal Selesai</Label>
            <Input
              id="end-date"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
            />
          </div>
          <div>
            <Label>Kelas (Opsional)</Label>
            <Select value={selectedKelas} onValueChange={setSelectedKelas}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {classes.filter(kelas => kelas.id).map((kelas) => (
                  <SelectItem key={kelas.id} value={kelas.id.toString()}>
                    {kelas.nama_kelas}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={fetchReportData} disabled={loading}>
            {loading ? 'Memuat...' : 'Tampilkan Laporan'}
          </Button>
        </div>
      </Card>

      {/* Report Data */}
      {loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Sedang memuat data laporan...</p>
          </CardContent>
        </Card>
      )}

      {!loading && reportData.length === 0 && !error && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Belum ada data untuk ditampilkan</p>
            <p className="text-sm text-gray-500">Pilih tanggal dan klik "Tampilkan Laporan" untuk melihat data</p>
          </CardContent>
        </Card>
      )}

      {reportData.length > 0 && (
        <ExcelPreview
          title="Ringkasan Kehadiran Siswa"
          reportKey={VIEW_TO_REPORT_KEY['student-attendance-summary']}
          data={reportData.map((record, index) => ({
            no: index + 1,
            nama: record.nama,
            nis: record.nis || '-',
            kelas: record.nama_kelas || '-',
            hadir: record.H || 0,
            izin: record.I || 0,
            sakit: record.S || 0,
            alpa: record.A || 0,
            dispen: record.D || 0,
            presentase: Number(record.presentase || 0).toFixed(2) + '%'
          }))}
          columns={[
            { key: 'no', label: 'No', width: 8, align: 'center', format: 'number' },
            { key: 'nama', label: 'Nama Siswa', width: 25, align: 'left' },
            { key: 'nis', label: 'NIS', width: 15, align: 'left' },
            { key: 'kelas', label: 'Kelas', width: 12, align: 'center' },
            { key: 'hadir', label: 'H', width: 8, align: 'center', format: 'number' },
            { key: 'izin', label: 'I', width: 8, align: 'center', format: 'number' },
            { key: 'sakit', label: 'S', width: 8, align: 'center', format: 'number' },
            { key: 'alpa', label: 'A', width: 8, align: 'center', format: 'number' },
            { key: 'dispen', label: 'D', width: 8, align: 'center', format: 'number' },
            { key: 'presentase', label: 'Presentase', width: 12, align: 'center', format: 'percentage' }
          ]}
          onExport={downloadExcel}
          onExportSMKN13={() => downloadSMKN13Format('student-summary')}
        />
      )}
    </div>
  );
};

// Teacher Attendance Summary Component
const TeacherAttendanceSummaryView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [reportData, setReportData] = useState<Record<string, string | number | boolean>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const today = getCurrentDateWIB();
    return {
      startDate: today,
      endDate: today
    };
  });
  const [selectedMonth, setSelectedMonth] = useState('');

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = `${year}-${monthNum}-01`;
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const endDate = `${year}-${monthNum}-${lastDay}`;
      setDateRange({ startDate, endDate });
    }
  };

  const fetchReportData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Mohon pilih tanggal mulai dan tanggal selesai');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      const data = await apiCall(`/api/admin/teacher-attendance-summary?${params.toString()}`, { method: 'GET', onLogout });
      
      if (Array.isArray(data)) {
        setReportData(data);
      } else {
        console.error('Invalid report data:', data);
        setReportData([]);
        setError('Format data tidak valid');
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Gagal memuat data laporan');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    if (reportData.length === 0) {
      setError('Tidak ada data untuk diunduh');
      return;
    }

    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      const url = getApiUrl(`/api/admin/download-teacher-attendance-excel?${params.toString()}`);
      const response = await fetch(url, { 
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      
      if (!response.ok) {
        // Coba baca error message dari response
        let errorMessage = 'Gagal mengunduh file';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          }
        } catch (parseError) {
          console.warn('Could not parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ringkasan-kehadiran-guru-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      link.click();
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
      console.error('Error downloading excel:', err);
      setError(`Gagal mengunduh file Excel: ${err.message}`);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ringkasan Kehadiran Guru</h1>
              <p className="text-gray-600">Download ringkasan kehadiran guru dalam format CSV</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="month">Bulan (Opsional)</Label>
              <Input
                id="month"
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                placeholder="Pilih bulan"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">Tanggal Akhir</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={fetchReportData} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Memuat...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Tampilkan Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {reportData.length > 0 && (
        <ExcelPreview
          title="Ringkasan Kehadiran Guru"
          reportKey={VIEW_TO_REPORT_KEY['teacher-attendance-summary']}
          data={reportData.map((item, index) => ({
            no: index + 1,
            nama: item.nama,
            nip: item.nip || '-',
            hadir: item.H || 0,
            izin: item.I || 0,
            sakit: item.S || 0,
            alpa: item.A || 0,
            presentase: Number(item.presentase || 0).toFixed(2) + '%'
          }))}
          columns={[
            { key: 'no', label: 'No', width: 8, align: 'center', format: 'number' },
            { key: 'nama', label: 'Nama Guru', width: 25, align: 'left' },
            { key: 'nip', label: 'NIP', width: 18, align: 'left' },
            { key: 'hadir', label: 'H', width: 8, align: 'center', format: 'number' },
            { key: 'izin', label: 'I', width: 8, align: 'center', format: 'number' },
            { key: 'sakit', label: 'S', width: 8, align: 'center', format: 'number' },
            { key: 'alpa', label: 'A', width: 8, align: 'center', format: 'number' },
            { key: 'presentase', label: 'Presentase', width: 12, align: 'center', format: 'percentage' }
          ]}
          onExport={downloadExcel}
          showLetterhead={true}
          reportPeriod={`${formatDateWIB(dateRange.startDate)} - ${formatDateWIB(dateRange.endDate)}`}
        />
      )}

      {!loading && reportData.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada data</h3>
            <p className="text-gray-500 text-center">Klik "Tampilkan Data" untuk melihat ringkasan kehadiran guru</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Student Promotion View Component
const StudentPromotionView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [fromClassId, setFromClassId] = useState<string>('');
  const [toClassId, setToClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentData[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/kelas', { onLogout });
      setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast({ title: "Error memuat data kelas", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);

  const fetchStudents = useCallback(async (classId: string) => {
    if (!classId) {
      // console.log();
      return;
    }
    
    // console.log();
    setIsLoading(true);
    try {
      const data = await apiCall('/api/admin/students-data', { onLogout });
      // console.log();
      // console.log();
      
      const filteredStudents = data.filter((student: StudentData) => {
        // Convert both to string for comparison
        const studentClassId = student.kelas_id?.toString();
        const targetClassId = classId.toString();
        const matches = studentClassId === targetClassId;
        // console.log();
        return matches;
      });
      
      // console.log();
      setStudents(filteredStudents);
      setSelectedStudents(new Set()); // Reset selection
    } catch (error) {
      console.error('❌ Error fetching students:', error);
      toast({ title: "Error memuat data siswa", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    // console.log();
    if (fromClassId) {
      // console.log();
      fetchStudents(fromClassId);
    } else {
      // console.log();
      setStudents([]);
      setSelectedStudents(new Set());
    }
  }, [fromClassId, fetchStudents]);

  // 🧠 SMART CLASS PARSER - Parsing nama kelas secara cerdas dan fleksibel
  const parseClassName = useCallback((className: string) => {
    // console.log();
    const cleanName = className.trim().toUpperCase();
    // console.log();
    
    // Pattern yang lebih fleksibel untuk berbagai format kelas
    const patterns = [
      // Format standar: X IPA 1, XI IPS 2, XII BAHASA 1
      /^(X|XI|XII)\s+(IPA|IPS|BAHASA|AGAMA|UMUM|TEKNIK|MULTIMEDIA|TKJ|RPL|AKUNTANSI|PEMASARAN|ADMINISTRASI|KEBIDANAN|KEPERAWATAN|FARMASI|KIMIA|FISIKA|BIOLOGI|MATEMATIKA|BHS|BAHASA|SOSIAL|EKONOMI|SEJARAH|GEOGRAFI|SENI|OLAHRAGA|PENDIDIKAN|GURU|SISWA|KA|KEJURUAN|KEJURUANAN|KEJURUAN_AN|KEJURUAN-AN|AK)\s*(\d+)?$/,
      // Format dengan angka: 10 IPA 1, 11 IPS 2, 12 BAHASA 1
      /^(10|11|12)\s+(IPA|IPS|BAHASA|AGAMA|UMUM|TEKNIK|MULTIMEDIA|TKJ|RPL|AKUNTANSI|PEMASARAN|ADMINISTRASI|KEBIDANAN|KEPERAWATAN|FARMASI|KIMIA|FISIKA|BIOLOGI|MATEMATIKA|BHS|BAHASA|SOSIAL|EKONOMI|SEJARAH|GEOGRAFI|SENI|OLAHRAGA|PENDIDIKAN|GURU|SISWA|KA|KEJURUAN|KEJURUANAN|KEJURUAN_AN|KEJURUAN-AN|AK)\s*(\d+)?$/,
      // Format tanpa nomor: X IPA, XI IPS, XII BAHASA
      /^(X|XI|XII)\s+(IPA|IPS|BAHASA|AGAMA|UMUM|TEKNIK|MULTIMEDIA|TKJ|RPL|AKUNTANSI|PEMASARAN|ADMINISTRASI|KEBIDANAN|KEPERAWATAN|FARMASI|KIMIA|FISIKA|BIOLOGI|MATEMATIKA|BHS|BAHASA|SOSIAL|EKONOMI|SEJARAH|GEOGRAFI|SENI|OLAHRAGA|PENDIDIKAN|GURU|SISWA|KA|KEJURUAN|KEJURUANAN|KEJURUAN_AN|KEJURUAN-AN|AK)$/,
      // Format dengan dash: X-IPA-1, XI-IPS-2
      /^(X|XI|XII)[\s\-_]+(IPA|IPS|BAHASA|AGAMA|UMUM|TEKNIK|MULTIMEDIA|TKJ|RPL|AKUNTANSI|PEMASARAN|ADMINISTRASI|KEBIDANAN|KEPERAWATAN|FARMASI|KIMIA|FISIKA|BIOLOGI|MATEMATIKA|BHS|BAHASA|SOSIAL|EKONOMI|SEJARAH|GEOGRAFI|SENI|OLAHRAGA|PENDIDIKAN|GURU|SISWA|KA|KEJURUAN|KEJURUANAN|KEJURUAN_AN|KEJURUAN-AN|AK)[\s\-_]*(\d+)?$/,
      // Format dengan underscore: X_IPA_1, XI_IPS_2
      /^(X|XI|XII)[\s\-_]+(IPA|IPS|BAHASA|AGAMA|UMUM|TEKNIK|MULTIMEDIA|TKJ|RPL|AKUNTANSI|PEMASARAN|ADMINISTRASI|KEBIDANAN|KEPERAWATAN|FARMASI|KIMIA|FISIKA|BIOLOGI|MATEMATIKA|BHS|BAHASA|SOSIAL|EKONOMI|SEJARAH|GEOGRAFI|SENI|OLAHRAGA|PENDIDIKAN|GURU|SISWA|KA|KEJURUAN|KEJURUANAN|KEJURUAN_AN|KEJURUAN-AN|AK)[\s\-_]*(\d+)?$/,
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = cleanName.match(pattern);
      // console.log();
      
      if (match) {
        let level = match[1];
        // Konversi angka ke romawi
        if (level === '10') level = 'X';
        if (level === '11') level = 'XI';
        if (level === '12') level = 'XII';
        
        let major = match[2];
        const number = match[3] ? parseInt(match[3]) : 1;
        
        // Mapping jurusan untuk kompatibilitas
        const majorMapping = {
          'KA': 'AK',  // KA -> AK (Akuntansi)
          'KEJURUAN': 'AK',
          'KEJURUANAN': 'AK',
          'KEJURUAN_AN': 'AK',
          'KEJURUAN-AN': 'AK'
        };
        
        if (majorMapping[major]) {
          major = majorMapping[major];
          // console.log();
        }
        
        const result = { level, major, number, fullName: className };
        // console.log();
        return result;
      }
    }
    
    // Fallback: coba ekstrak tingkat dari awal string
    // console.log();
    const fallbackPatterns = [
      /^(X|XI|XII)/,
      /^(10|11|12)/
    ];
    
    for (const pattern of fallbackPatterns) {
      const match = cleanName.match(pattern);
      if (match) {
        let level = match[1];
        if (level === '10') level = 'X';
        if (level === '11') level = 'XI';
        if (level === '12') level = 'XII';
        
        // Coba ekstrak jurusan dari sisa string
        const remaining = cleanName.replace(pattern, '').trim();
        const majorMatch = remaining.match(/(IPA|IPS|BAHASA|AGAMA|UMUM|TEKNIK|MULTIMEDIA|TKJ|RPL|AKUNTANSI|PEMASARAN|ADMINISTRASI|KEBIDANAN|KEPERAWATAN|FARMASI|KIMIA|FISIKA|BIOLOGI|MATEMATIKA|BHS|BAHASA|SOSIAL|EKONOMI|SEJARAH|GEOGRAFI|SENI|OLAHRAGA|PENDIDIKAN|GURU|SISWA|KA|KEJURUAN|KEJURUANAN|KEJURUAN_AN|KEJURUAN-AN|AK)/);
        let major = majorMatch ? majorMatch[1] : 'UMUM';
        
        // Mapping jurusan untuk kompatibilitas
        const majorMapping = {
          'KA': 'AK',  // KA -> AK (Akuntansi)
          'KEJURUAN': 'AK',
          'KEJURUANAN': 'AK',
          'KEJURUAN_AN': 'AK',
          'KEJURUAN-AN': 'AK'
        };
        
        if (majorMapping[major]) {
          major = majorMapping[major];
          // console.log();
        }
        
        // Coba ekstrak nomor
        const numberMatch = remaining.match(/(\d+)/);
        const number = numberMatch ? parseInt(numberMatch[1]) : 1;
        
        const result = { level, major, number, fullName: className };
        // console.log();
        return result;
      }
    }
    
    // console.log();
    return null;
  }, []);

  // 🎯 AUTO-DETECT TARGET CLASS - Otomatis cari kelas tujuan berdasarkan kelas asal
  const findTargetClass = useCallback((fromClassId: string) => {
    // console.log();
    // console.log();
    
    const sourceClass = classes.find(c => c.id?.toString() === fromClassId);
    if (!sourceClass) {
      // console.log();
      return null;
    }
    
    // console.log();
    
    const parsed = parseClassName(sourceClass.nama_kelas || '');
    if (!parsed) {
      // console.log();
      return null;
    }
    
    // console.log();
    
    // Tentukan tingkat tujuan
    let targetLevel = '';
    if (parsed.level === 'X') targetLevel = 'XI';
    else if (parsed.level === 'XI') targetLevel = 'XII';
    else {
      // console.log();
      return null; // XII tidak bisa dinaikkan
    }
    
    // console.log();
    
    // Cari kelas dengan tingkat tujuan, jurusan sama, nomor sama
    const targetClass = classes.find(cls => {
      const targetParsed = parseClassName(cls.nama_kelas || '');
      const isMatch = targetParsed &&
             targetParsed.level === targetLevel &&
             targetParsed.major === parsed.major &&
             targetParsed.number === parsed.number;
      
      if (targetParsed) {
        // console.log();
      }
      
      return isMatch;
    });
    
    // console.log();
    return targetClass || null;
  }, [classes, parseClassName]);

  // Auto-detect dan set kelas tujuan saat kelas asal dipilih
  useEffect(() => {
    if (fromClassId && classes.length > 0) {
      // console.log();
      
      const targetClass = findTargetClass(fromClassId);
      
      if (targetClass) {
        // console.log();
        setToClassId(targetClass.id?.toString() || '');
        
        // Parsing untuk notifikasi
        const sourceClass = classes.find(c => c.id?.toString() === fromClassId);
        const sourceParsed = parseClassName(sourceClass?.nama_kelas || '');
        const targetParsed = parseClassName(targetClass.nama_kelas || '');
        
        if (sourceParsed && targetParsed) {
          toast({
            title: "✓ Kelas Tujuan Terdeteksi",
            description: `${sourceParsed.level} ${sourceParsed.major} ${sourceParsed.number} → ${targetParsed.level} ${targetParsed.major} ${targetParsed.number}`,
            variant: "default"
          });
        }
      } else {
        // console.log();
        
        // Jika tidak ditemukan, coba cari manual berdasarkan tingkat dan jurusan
        const sourceClass = classes.find(c => c.id?.toString() === fromClassId);
        const sourceParsed = parseClassName(sourceClass?.nama_kelas || '');
        
        if (sourceParsed) {
          // Validasi kelas XII tidak bisa dinaikkan
          if (sourceParsed.level === 'XII') {
            // console.log();
            setToClassId('');
            toast({
              title: "❌ Tidak Dapat Dipromosikan",
              description: "Siswa kelas XII sudah lulus dan tidak dapat dinaikkan kelas",
              variant: "destructive"
            });
            return;
          }
          
          let targetLevel = '';
          if (sourceParsed.level === 'X') targetLevel = 'XI';
          else if (sourceParsed.level === 'XI') targetLevel = 'XII';
          
          // console.log();
          
          // Cari kelas dengan tingkat tujuan dan jurusan sama (abaikan nomor)
          const fallbackClass = classes.find(cls => {
            if ((cls as Record<string, string | number | boolean>).status !== 'aktif') return false;
            
            const name = cls.nama_kelas?.toUpperCase() || '';
            const isMatch = name.includes(targetLevel) && name.includes(sourceParsed.major);
            // console.log();
            return isMatch;
          });
          
          if (fallbackClass) {
            // console.log();
            setToClassId(fallbackClass.id?.toString() || '');
            toast({
              title: "⚠ Kelas Tujuan Ditemukan (Parsial)",
              description: `Nomor kelas mungkin berbeda. Mohon periksa: ${fallbackClass.nama_kelas}`,
              variant: "default"
            });
          } else {
            // console.log();
            setToClassId('');
            toast({
              title: "❌ Kelas Tujuan Tidak Ditemukan",
              description: `Kelas ${targetLevel} ${sourceParsed.major} belum dibuat di sistem`,
              variant: "destructive"
            });
          }
        } else {
          // console.log();
          setToClassId('');
          
          // Coba fallback sederhana: cari kelas dengan tingkat yang lebih tinggi
          const sourceClass = classes.find(c => c.id?.toString() === fromClassId);
          if (sourceClass?.nama_kelas) {
            const className = sourceClass.nama_kelas.toUpperCase();
            
            // Coba deteksi tingkat sederhana
            let targetLevel = '';
            if (className.includes('X ') && !className.includes('XI') && !className.includes('XII')) {
              targetLevel = 'XI';
            } else if (className.includes('XI ') && !className.includes('XII')) {
              targetLevel = 'XII';
            }
            
            if (targetLevel) {
              // Cari kelas dengan tingkat target
              const fallbackClass = classes.find(cls => {
                if ((cls as Record<string, string | number | boolean>).status !== 'aktif') return false;
                return cls.nama_kelas?.toUpperCase().includes(targetLevel);
              });
              
              if (fallbackClass) {
                // console.log();
                setToClassId(fallbackClass.id?.toString() || '');
                toast({
                  title: "⚠ Kelas Tujuan Ditemukan (Sederhana)",
                  description: `Ditemukan kelas ${targetLevel}: ${fallbackClass.nama_kelas}`,
                  variant: "default"
                });
                return;
              }
            }
          }
          
          toast({
            title: "⚠ Kelas Tujuan Tidak Ditemukan",
            description: "Tidak dapat mendeteksi kelas tujuan. Silakan buat kelas yang sesuai terlebih dahulu.",
            variant: "destructive"
          });
        }
      }
    } else if (!fromClassId) {
      setToClassId('');
    }
  }, [fromClassId, classes, findTargetClass, parseClassName]);

  // Reset states when fromClassId changes
  useEffect(() => {
    if (!fromClassId) {
      setStudents([]);
      setSelectedStudents(new Set());
      setToClassId('');
    }
  }, [fromClassId]);

  const handleSelectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map(student => student.id_siswa)));
    }
  };

  const handleSelectStudent = (studentId: number) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudents(newSelection);
  };

  const handlePromotion = async () => {
    // Validasi state yang lebih ketat
    if (!fromClassId) {
      toast({ title: "Peringatan", description: "Pilih kelas asal terlebih dahulu", variant: "destructive" });
      return;
    }

    if (!toClassId) {
      toast({ title: "Peringatan", description: "Kelas tujuan tidak ditemukan atau tidak valid", variant: "destructive" });
      return;
    }

    if (selectedStudents.size === 0) {
      toast({ title: "Peringatan", description: "Pilih minimal satu siswa untuk dinaikkan kelas", variant: "destructive" });
      return;
    }

    // Validasi kelas asal tidak boleh kelas XII
    const sourceClass = classes.find(c => c.id?.toString() === fromClassId);
    if (sourceClass?.nama_kelas?.includes('XII')) {
      toast({ 
        title: "Tidak Dapat Dipromosikan", 
        description: "Siswa kelas XII sudah lulus dan tidak dapat dinaikkan kelas", 
        variant: "destructive" 
      });
      return;
    }

    // Validasi kelas tujuan harus berbeda dari kelas asal
    if (fromClassId === toClassId) {
      toast({ 
        title: "Peringatan", 
        description: "Kelas tujuan harus berbeda dari kelas asal", 
        variant: "destructive" 
      });
      return;
    }

    setIsProcessing(true);
    try {
      const studentIds = Array.from(selectedStudents);
      // console.log();
      
      const response = await apiCall('/api/admin/student-promotion', {
        method: 'POST',
        body: JSON.stringify({
          fromClassId,
          toClassId,
          studentIds
        }),
        onLogout
      });

      // console.log();

      toast({ 
        title: "Berhasil", 
        description: response.message || `${studentIds.length} siswa berhasil dinaikkan dari ${fromClass?.nama_kelas} ke ${toClass?.nama_kelas}`, 
        variant: "default" 
      });

      // Reset state setelah sukses
      setSelectedStudents(new Set());
      setShowPreview(false);
      
      // Refresh data siswa kelas asal
      await fetchStudents(fromClassId);
      
    } catch (error) {
      console.error('❌ Error promoting students:', error);
      
      // Error handling yang lebih spesifik
      let errorMessage = 'Terjadi kesalahan saat memproses promosi siswa';
      
      if (error.message) {
        try {
          const errorData = JSON.parse(error.message);
          errorMessage = errorData.error || error.message;
        } catch {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Error", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const fromClass = classes.find(c => c.id?.toString() === fromClassId);
  const toClass = classes.find(c => c.id?.toString() === toClassId);

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Naik Kelas Siswa</h1>
            <p className="text-sm sm:text-base text-gray-600">Kelola kenaikan kelas siswa secara massal</p>
          </div>
        </div>
        {fromClassId && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setFromClassId('');
              setToClassId('');
              setStudents([]);
              setSelectedStudents(new Set());
            }}
            className="w-fit"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        )}
      </div>

      {/* Progress Indicator */}
      {fromClassId && (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-2">
              <div className="flex items-center gap-2 text-blue-600">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-blue-600 text-white">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-xs sm:text-sm font-medium">Pilih Kelas</span>
              </div>
              <div className={`w-8 h-0.5 sm:w-8 sm:h-0.5 ${selectedStudents.size > 0 ? 'bg-blue-600' : 'bg-gray-200'} hidden sm:block`}></div>
              <div className={`w-0.5 h-8 sm:w-8 sm:h-0.5 ${selectedStudents.size > 0 ? 'bg-blue-600' : 'bg-gray-200'} block sm:hidden`}></div>
              <div className={`flex items-center gap-2 ${selectedStudents.size > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${selectedStudents.size > 0 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-xs sm:text-sm font-medium">Pilih Siswa</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class Selection - SMART AUTO-DETECT */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <ArrowUpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            Pilih Kelas Asal
          </CardTitle>
          <CardDescription className="text-sm">
            Sistem akan otomatis mendeteksi kelas tujuan berdasarkan tingkat dan jurusan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="from-class" className="text-sm font-medium">Kelas Asal *</Label>
              <Select value={fromClassId} onValueChange={setFromClassId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kelas asal (contoh: X IPA 1)" />
                </SelectTrigger>
                <SelectContent>
                  {classes.filter(cls => (cls as Record<string, string | number | boolean>).status === 'aktif').map((cls) => (
                    <SelectItem key={cls.id} value={cls.id?.toString() || '0'}>
                      {cls.nama_kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {toClassId && (
              <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-2 border-blue-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      🧠 Auto-Detected Target Class
                    </p>
                    <p className="text-sm sm:text-lg font-bold text-gray-900 break-words">
                      {fromClass?.nama_kelas} → <span className="text-green-700">{toClass?.nama_kelas}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Message */}
      {!fromClassId && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Home className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">🧠 Sistem Promosi Cerdas</h3>
              <p className="text-sm sm:text-base text-gray-500 mb-2 px-2">Pilih kelas asal, sistem akan otomatis mendeteksi kelas tujuan</p>
              <p className="text-xs sm:text-sm text-gray-400 break-words">Contoh: X IPA 1 → XI IPA 1</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Students Message */}
      {fromClassId && students.length === 0 && !isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak Ada Siswa</h3>
              <p className="text-gray-500">Tidak ada siswa ditemukan di kelas yang dipilih</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Info */}
      {fromClassId && (
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-gray-600">
              <p><strong>Status:</strong></p>
              <p>Kelas Asal: {fromClass?.nama_kelas || 'Tidak dipilih'}</p>
              <p>Kelas Tujuan: {toClass?.nama_kelas || 'Belum terdeteksi'}</p>
              <p>Siswa Tersedia: {students.length} siswa</p>
              <p>Siswa Terpilih: {selectedStudents.size} siswa</p>
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                  <p><strong>Debug Info:</strong></p>
                  <p>fromClassId: {fromClassId}</p>
                  <p>toClassId: {toClassId}</p>
                  <p>isLoading: {isLoading.toString()}</p>
                  <p>isProcessing: {isProcessing.toString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Students List */}
      {students.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  Daftar Siswa ({students.length} siswa)
                </CardTitle>
                <CardDescription className="text-sm">
                  Pilih siswa yang akan dinaikkan kelas
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {selectedStudents.size === students.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </Button>
                {selectedStudents.size > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowPreview(true)}
                    disabled={!toClassId || !fromClassId || isProcessing}
                    className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                  >
                    Preview ({selectedStudents.size} siswa)
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {students.map((student) => (
                  <div
                    key={student.id_siswa}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-3 ${
                      selectedStudents.has(student.id_siswa) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(student.id_siswa)}
                        onChange={() => handleSelectStudent(student.id_siswa)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{student.nama}</p>
                        <p className="text-sm text-gray-500">NIS: {student.nis}</p>
                      </div>
                    </div>
                    <div className="flex justify-end sm:justify-start">
                      <Badge variant={student.status === 'aktif' ? 'default' : 'secondary'} className="text-xs">
                        {student.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <ArrowUpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              Preview Naik Kelas
            </DialogTitle>
            <DialogDescription className="text-sm">
              Konfirmasi data siswa yang akan dinaikkan kelas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border">
              <div className="text-center">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Dari Kelas</p>
                <p className="text-sm sm:text-lg font-semibold text-blue-700 break-words">{fromClass?.nama_kelas}</p>
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Ke Kelas</p>
                <p className="text-sm sm:text-lg font-semibold text-green-700 break-words">{toClass?.nama_kelas}</p>
              </div>
            </div>
            
            <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-gray-500" />
                <p className="text-xs sm:text-sm font-medium text-gray-500">
                  Siswa yang akan dinaikkan ({selectedStudents.size} siswa):
                </p>
              </div>
              <div className="max-h-48 sm:max-h-60 overflow-y-auto space-y-1">
                {students
                  .filter(student => selectedStudents.has(student.id_siswa))
                  .map((student) => (
                    <div key={student.id_siswa} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-white border rounded-lg hover:bg-gray-50 gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs sm:text-sm font-medium text-blue-700">
                            {student.nama.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-gray-900 text-sm sm:text-base truncate block">{student.nama}</span>
                          <p className="text-xs sm:text-sm text-gray-500">NIS: {student.nis}</p>
                        </div>
                      </div>
                      <div className="flex justify-end sm:justify-start">
                        <Badge variant="outline" className="text-xs">
                          {student.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button 
              onClick={handlePromotion}
              disabled={isProcessing || !toClassId || !fromClassId || selectedStudents.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Memproses...
                </>
              ) : (
                <>
                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                  Konfirmasi Naik Kelas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Action Button */}
      {selectedStudents.size > 0 && toClassId && (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">Siap untuk Naik Kelas</h3>
                <p className="text-sm text-gray-500 break-words">
                  {selectedStudents.size} siswa siap dinaikkan dari {fromClass?.nama_kelas} ke {toClass?.nama_kelas}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                  className="w-full sm:w-auto"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button
                  onClick={handlePromotion}
                  disabled={isProcessing || !toClassId || !fromClassId || selectedStudents.size === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-4 h-4 mr-2" />
                      Naik Kelas Sekarang
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Reports Main Menu Component
const ReportsView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [reportView, setReportView] = useState<string | null>(null);

  if (reportView === 'banding-absen-report') {
    return <BandingAbsenReportView onBack={() => setReportView(null)} onLogout={onLogout} />;
  }


  if (reportView === 'student-attendance-summary') {
    return <StudentAttendanceSummaryView onBack={() => setReportView(null)} onLogout={onLogout} />;
  }

  if (reportView === 'teacher-attendance-summary') {
    return <TeacherAttendanceSummaryView onBack={() => setReportView(null)} onLogout={onLogout} />;
  }

  if (reportView === 'live-teacher-attendance') {
    return <LiveTeacherAttendanceView onBack={() => setReportView(null)} onLogout={onLogout} />;
  }

  if (reportView === 'live-student-attendance') {
    return <LiveStudentAttendanceView onBack={() => setReportView(null)} onLogout={onLogout} />;
  }

  if (reportView === 'analytics-dashboard') {
    return <AnalyticsDashboardView onBack={() => setReportView(null)} onLogout={onLogout} />;
  }

  if (reportView === 'presensi-siswa') {
    return <PresensiSiswaView onBack={() => setReportView(null)} onLogout={onLogout} />;
  }

  if (reportView === 'rekap-ketidakhadiran') {
    return <RekapKetidakhadiranView onBack={() => setReportView(null)} onLogout={onLogout} />;
  }

  if (reportView === 'rekap-ketidakhadiran-guru') {
    return <RekapKetidakhadiranGuruView onBack={() => setReportView(null)} onLogout={onLogout} />;
  }

  const reportItems = [
    {
      id: 'teacher-attendance-summary',
      title: 'Ringkasan Kehadiran Guru',
      description: 'Tabel H/I/S/A/D dan persentase, filter kelas & tanggal',
      icon: ClipboardList,
      gradient: 'from-indigo-500 to-indigo-700'
    },
    {
      id: 'student-attendance-summary',
      title: 'Ringkasan Kehadiran Siswa', 
      description: 'Tabel H/I/S/A/D dan persentase, filter kelas & tanggal',
      icon: ClipboardList,
      gradient: 'from-emerald-500 to-emerald-700'
    },
    {
      id: 'banding-absen-report',
      title: 'Riwayat Pengajuan Banding Absen', 
      description: 'Laporan history pengajuan banding absensi',
      icon: MessageCircle,
      gradient: 'from-red-500 to-red-700'
    },
    {
      id: 'presensi-siswa',
      title: 'Presensi Siswa', 
      description: 'Format presensi siswa SMKN 13',
      icon: FileText,
      gradient: 'from-slate-500 to-slate-700'
    },
    {
      id: 'rekap-ketidakhadiran',
      title: 'Rekap Ketidakhadiran', 
      description: 'Rekap ketidakhadiran tahunan/bulanan',
      icon: BarChart3,
      gradient: 'from-emerald-500 to-emerald-700'
    },
    {
      id: 'rekap-ketidakhadiran-guru',
      title: 'Rekap Ketidakhadiran Guru', 
      description: 'Format rekap ketidakhadiran guru SMKN 13',
      icon: Users,
      gradient: 'from-orange-500 to-orange-700'
    },
    {
      id: 'live-student-attendance',
      title: 'Pemantauan Siswa Langsung',
      description: 'Pantau absensi siswa secara realtime',
      icon: Users,
      gradient: 'from-green-500 to-green-700'
    },
    {
      id: 'live-teacher-attendance',
      title: 'Pemantauan Guru Langsung',
      description: 'Pantau absensi guru secara realtime',
      icon: GraduationCap,
      gradient: 'from-purple-500 to-purple-700'
    },
    {
      id: 'analytics-dashboard',
      title: 'Dasbor Analitik',
      description: 'Analisis dan statistik kehadiran lengkap',
      icon: BarChart3,
      gradient: 'from-orange-500 to-orange-700'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Laporan</h1>
          <p className="text-gray-600">Pilih jenis laporan yang ingin Anda lihat</p>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <Card 
              key={item.id}
              className="group cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden"
              onClick={() => setReportView(item.id)}
            >
              <div className={`h-2 bg-gradient-to-r ${item.gradient}`} />
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-gradient-to-r ${item.gradient} text-white`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// Main Admin Dashboard Component
export const AdminDashboard = ({ onLogout }: AdminDashboardProps) => {
  const [activeView, setActiveView] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [userData, setUserData] = useState<{
    id: number;
    username: string;
    nama: string;
    email?: string;
    role: string;
    created_at?: string;
    updated_at?: string;
  } | null>(null);

  // Check token validity on component mount and load latest profile data
  useEffect(() => {
    const checkTokenValidity = async () => {
      try {
        const response = await apiCall('/api/verify-token', { onLogout });
        setUserData(response.user);
        
        // Load latest profile data from server
        try {
          const profileResponse = await apiCall('/api/admin/info', { onLogout });
          if (profileResponse.success) {
            setUserData({
              id: profileResponse.id,
              username: profileResponse.username,
              nama: profileResponse.nama,
              email: profileResponse.email,
              role: profileResponse.role,
              created_at: profileResponse.created_at,
              updated_at: profileResponse.updated_at
            });
          }
        } catch (profileErr) {
          console.error("Failed to load latest profile data:", profileErr);
        }
      } catch (err) {
        console.error("Token verification failed:", err);
      }
    };

    checkTokenValidity();
  }, [onLogout]);

  const handleUpdateProfile = (updatedData: {
    id: number;
    username: string;
    nama: string;
    email?: string;
    role: string;
    created_at?: string;
    updated_at?: string;
  }) => {
    // console.log();
    setUserData(prevData => ({
      ...prevData,
      ...updatedData,
      updated_at: new Date().toISOString()
    }));
  };

  const renderActiveView = () => {
    const handleBack = () => setActiveView(null);
    
    switch (activeView) {
      case 'add-teacher':
        return <ManageTeacherAccountsView onBack={handleBack} onLogout={onLogout} />;
      case 'add-student':
        return <ManageStudentsView onBack={handleBack} onLogout={onLogout} />;
      case 'add-teacher-data':
        return <ManageTeacherDataView onBack={handleBack} onLogout={onLogout} />;
      case 'add-student-data':
        return <ManageStudentDataView onBack={handleBack} onLogout={onLogout} />;
      case 'student-promotion':
        return <StudentPromotionView onBack={handleBack} onLogout={onLogout} />;
      case 'add-subject':
        return <ManageSubjectsView onBack={handleBack} onLogout={onLogout} />;
      case 'add-class':
        return <ManageClassesView onBack={handleBack} onLogout={onLogout} />;
      case 'add-schedule':
        return <ManageSchedulesView onBack={handleBack} onLogout={onLogout} />;
      case 'add-room':
        return <ManageRoomsView onBack={handleBack} onLogout={onLogout} />;
      case 'backup-management':
        return <ErrorBoundary><BackupManagementView /></ErrorBoundary>;
      case 'monitoring':
        return <ErrorBoundary><MonitoringDashboard /></ErrorBoundary>;
      case 'disaster-recovery':
        return <ErrorBoundary><SimpleRestoreView onBack={handleBack} onLogout={onLogout} /></ErrorBoundary>;
      case 'letterhead-settings':
        return <ErrorBoundary><ReportLetterheadSettings onBack={handleBack} onLogout={onLogout} /></ErrorBoundary>;
      case 'reports':
        return <ErrorBoundary><ReportsView onBack={handleBack} onLogout={onLogout} /></ErrorBoundary>;
      case 'jam-pelajaran':
        return <ErrorBoundary><JamPelajaranConfig /></ErrorBoundary>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sidebar - with proper visibility handling */}
      <div className={`fixed left-0 top-0 h-full bg-white shadow-xl transition-all duration-300 z-40 flex flex-col ${
        sidebarOpen ? 'w-64' : 'w-16'
      } lg:w-64 lg:translate-x-0 lg:visible ${sidebarOpen ? 'translate-x-0 visible' : '-translate-x-full invisible lg:visible lg:translate-x-0'}`}>
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

        {/* Navigation - flex-1 with min-h-0 for proper flex shrinking */}
        <nav className="p-4 space-y-2 flex-1 min-h-0 overflow-y-auto">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={activeView === item.id ? "default" : "ghost"}
              className={`w-full justify-start ${sidebarOpen ? '' : 'px-2 lg:px-3'}`}
              onClick={() => {
                setActiveView(item.id);
                setSidebarOpen(false);
              }}
            >
              <item.icon className="h-4 w-4" />
              {sidebarOpen && <span className="ml-2 block lg:hidden">{item.title}</span>}
              <span className="ml-2 hidden lg:block">{item.title}</span>
            </Button>
          ))}
        </nav>

        {/* User Info - shrink-0 to keep at bottom */}
        <div className="p-4 border-t border-gray-200 bg-white shrink-0">
          {/* Font Size Control - Above Profile Buttons */}
          {(sidebarOpen || window.innerWidth >= 1024) && (
            <div className="mb-4">
              <FontSizeControl variant="compact" />
            </div>
          )}
          
          {/* User Profile Info */}
          {userData && (
            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
              <div className={`flex items-center ${sidebarOpen || window.innerWidth >= 1024 ? 'space-x-2' : 'justify-center'}`}>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                {(sidebarOpen || window.innerWidth >= 1024) && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{userData.nama}</p>
                    <p className="text-xs text-gray-500">Administrator</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Button
              onClick={() => setShowEditProfile(true)}
              variant="outline"
              size="sm"
              className={`w-full ${sidebarOpen ? '' : 'px-2 lg:px-3'}`}
            >
              <Settings className="h-4 w-4" />
              {sidebarOpen && <span className="ml-2 block lg:hidden">Edit Profil</span>}
              <span className="ml-2 hidden lg:block">Edit Profil</span>
            </Button>
            
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
      </div>

      {/* Main Content - with background to prevent sidebar text bleeding */}
      <div className="lg:ml-64 relative z-10 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
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
            <h1 className="text-xl font-bold">Dashboard Admin</h1>
            <div className="w-10"></div>
          </div>

          {/* Content */}
          {!activeView ? (
            <div className="space-y-8">
              {/* Desktop Header */}
              <div className="hidden lg:block">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                  Dashboard Admin
                </h1>
                <p className="text-gray-600 mt-2">ABSENTA - Sistem Absensi Sekolah</p>
              </div>

              <LiveSummaryView onLogout={onLogout} />
              
              {/* Menu Grid */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Menu Administrasi</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {menuItems.map((item) => (
                    <Card
                      key={item.id}
                      className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 bg-gradient-to-br from-white to-gray-50"
                      onClick={() => setActiveView(item.id)}
                    >
                      <CardContent className="p-6 text-center space-y-4">
                        <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r ${item.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                          <item.icon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                          <p className="text-sm text-gray-600">{item.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            renderActiveView()
          )}
        </div>
      </div>
      
      {/* Floating Font Size Control for Mobile */}
      <FontSizeControl variant="floating" className="lg:hidden" />
      
      {/* Edit Profile Modal */}
      {showEditProfile && userData && (
        <EditProfile
          userData={userData}
          onUpdate={handleUpdateProfile}
          onClose={() => setShowEditProfile(false)}
          role="admin"
        />
      )}
    </div>
  );
};

