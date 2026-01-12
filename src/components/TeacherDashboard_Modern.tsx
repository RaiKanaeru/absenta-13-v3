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
import { ScheduleListView, STATUS_COLORS, AttendanceView, LaporanKehadiranSiswaView, RiwayatBandingAbsenView, PresensiSiswaSMKN13View, RekapKetidakhadiranView, TeacherReportsView, TeacherUserData } from './teacher';

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

// Banding Absen View for Teachers - to process student attendance appeals
const BandingAbsenView = ({ user }: { user: TeacherDashboardProps['userData'] }) => {
  const [bandingList, setBandingList] = useState<BandingAbsenTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [filterPending, setFilterPending] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPending, setTotalPending] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const limit = 5;

  useEffect(() => {
    const fetchBandingAbsen = async () => {
      try {
        setLoading(true);
        // Fetch banding absen for this teacher to process with pagination and filter
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: limit.toString(),
          filter_pending: filterPending.toString()
        });
        
        const response = await apiCall(`/api/guru/${user.guru_id || user.id}/banding-absen?${params}`);
        
        if (response && typeof response === 'object') {
          setBandingList(response.data || []);
          setTotalPages(response.totalPages || 1);
          setTotalPending(response.totalPending || 0);
          setTotalAll(response.totalAll || 0);
        } else {
          setBandingList(Array.isArray(response) ? response : []);
        }
      } catch (error) {
        console.error('Error fetching banding absen:', error);
        toast({ 
          title: "Error", 
          description: "Gagal memuat data banding absen", 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBandingAbsen();
  }, [user.guru_id, user.id, currentPage, filterPending]);

  const handleFilterToggle = () => {
    setFilterPending(!filterPending);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleBandingResponse = async (bandingId: number, status: 'disetujui' | 'ditolak', catatan: string = '') => {
    if (processingId === bandingId) return; // Prevent double-click
    setProcessingId(bandingId);
    try {
      await apiCall(`/api/banding-absen/${bandingId}/respond`, {
        method: 'PUT',
        body: JSON.stringify({ 
          status_banding: status, 
          catatan_guru: catatan,
          diproses_oleh: user.guru_id || user.id
        }),
      });

      toast({ 
        title: "Berhasil!", 
        description: `Banding absen berhasil ${status}` 
      });
      
      // Refresh the list by refetching data
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        filter_pending: filterPending.toString()
      });
      
      const response = await apiCall(`/api/guru/${user.guru_id || user.id}/banding-absen?${params}`);
      
      if (response && typeof response === 'object') {
        setBandingList(response.data || []);
        setTotalPages(response.totalPages || 1);
        setTotalPending(response.totalPending || 0);
        setTotalAll(response.totalAll || 0);
      }
    } catch (error) {
      console.error('Error responding to banding absen:', error);
      toast({ 
        title: "Error", 
        description: (error as Error).message, 
        variant: "destructive" 
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            <span className="text-lg sm:text-xl">Pengajuan Banding Absen</span>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600 font-medium">
              {filterPending ? `${totalPending} belum di-acc` : `${totalAll} total`}
            </div>
            <div className="text-xs text-gray-500">
              Halaman {currentPage} dari {totalPages}
            </div>
          </div>
        </CardTitle>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
          <div className="text-sm text-gray-600">
            <div className="block sm:hidden">
              Total: {totalAll} | Belum di-acc: {totalPending}
            </div>
            <div className="hidden sm:block">
              Total: {totalAll} | Belum di-acc: {totalPending}
            </div>
          </div>
          <Button
            variant={filterPending ? "default" : "outline"}
            size="sm"
            onClick={handleFilterToggle}
            className={`w-full sm:w-auto ${filterPending ? "bg-orange-600 hover:bg-orange-700" : ""}`}
          >
            {filterPending ? (
              <>
                <Eye className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Tampilkan Semua</span>
                <span className="sm:hidden">Semua</span>
              </>
            ) : (
              <>
                <Filter className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Belum di-acc ({totalPending})</span>
                <span className="sm:hidden">Pending ({totalPending})</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-200 h-32 rounded"></div>
            ))}
          </div>
        ) : bandingList.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada banding absen</h3>
            <p className="text-gray-600">Belum ada pengajuan banding absen dari siswa yang perlu diproses</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
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
                  {bandingList.map((banding) => (
                    <TableRow key={banding.id_banding} className="hover:bg-gray-50">
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
                              {banding.nama_siswa}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">NIS: {banding.nis}</span>
                              <Badge 
                                variant="outline" 
                                className="text-xs px-1 py-0"
                              >
                                {banding.status_asli} → {banding.status_diajukan}
                              </Badge>
                            </div>
                            <div className="text-gray-600">
                              {banding.alasan_banding}
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
                        {banding.status_banding === 'pending' ? (
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Setujui
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md mx-auto">
                                <DialogHeader>
                                  <DialogTitle>Setujui Banding Absen</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-sm text-gray-600 mb-2">Banding dari: <strong>{banding.nama_siswa}</strong></p>
                                    <p className="text-sm text-gray-600">Status: {banding.status_asli} → {banding.status_diajukan}</p>
                                    <p className="text-sm text-gray-600">Tanggal: {formatDateWIB(banding.tanggal_absen)}</p>
                                  </div>
                                  <Textarea 
                                    placeholder="Catatan persetujuan (opsional)" 
                                    id={`approve-banding-${banding.id_banding}`}
                                  />
                                  <Button 
                                    onClick={() => {
                                      const textarea = document.getElementById(`approve-banding-${banding.id_banding}`) as HTMLTextAreaElement;
                                      handleBandingResponse(banding.id_banding, 'disetujui', textarea.value);
                                    }}
                                    className="w-full bg-green-600 hover:bg-green-700"
                                  >
                                    Setujui Banding Absen
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <X className="w-4 h-4 mr-1" />
                                  Tolak
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md mx-auto">
                                <DialogHeader>
                                  <DialogTitle>Tolak Banding Absen</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-sm text-gray-600 mb-2">Banding dari: <strong>{banding.nama_siswa}</strong></p>
                                    <p className="text-sm text-gray-600">Status: {banding.status_asli} → {banding.status_diajukan}</p>
                                  </div>
                                  <Textarea 
                                    placeholder="Alasan penolakan (wajib)" 
                                    id={`reject-banding-${banding.id_banding}`}
                                    required
                                  />
                                  <Button 
                                    onClick={() => {
                                      const textarea = document.getElementById(`reject-banding-${banding.id_banding}`) as HTMLTextAreaElement;
                                      if (textarea.value.trim()) {
                                        handleBandingResponse(banding.id_banding, 'ditolak', textarea.value);
                                      } else {
                                        toast({ title: "Error", description: "Alasan penolakan harus diisi", variant: "destructive" });
                                      }
                                    }}
                                    variant="destructive"
                                    className="w-full"
                                  >
                                    Tolak Banding Absen
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="text-xs"
                          >
                            Sudah Diproses
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {bandingList.map((banding) => (
                <Card key={banding.id_banding} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    {/* Header dengan status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {banding.nama_siswa}
                        </h3>
                        <p className="text-xs text-gray-600">NIS: {banding.nis}</p>
                      </div>
                      <Badge className={
                          banding.status_banding === 'disetujui' ? 'bg-green-100 text-green-800' :
                          banding.status_banding === 'ditolak' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                      }>
                        {banding.status_banding === 'disetujui' ? 'Disetujui' :
                         banding.status_banding === 'ditolak' ? 'Ditolak' : 'Menunggu'}
                      </Badge>
                    </div>

                    {/* Informasi tanggal dan jadwal */}
                    <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                      <div>
                        <p className="font-medium text-gray-700">Tanggal Pengajuan</p>
                        <p className="text-gray-600">{formatDateWIB(banding.tanggal_pengajuan)}</p>
                        <p className="text-gray-500">{formatTime24(banding.tanggal_pengajuan)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Tanggal Absen</p>
                        <p className="text-gray-600">{formatDateWIB(banding.tanggal_absen)}</p>
                        <p className="text-gray-500">{banding.jam_mulai}-{banding.jam_selesai}</p>
                      </div>
                    </div>

                    {/* Jadwal dan kelas */}
                    <div className="mb-3">
                      <p className="font-medium text-gray-700 text-xs mb-1">Jadwal</p>
                      <p className="text-sm font-medium text-gray-900">{banding.nama_mapel}</p>
                      <p className="text-xs text-gray-600">{banding.nama_guru}</p>
                      <p className="text-xs text-gray-500">{banding.nama_kelas}</p>
                    </div>

                    {/* Status perubahan */}
                    <div className="mb-3">
                      <p className="font-medium text-gray-700 text-xs mb-1">Perubahan Status</p>
                      <Badge variant="outline" className="text-xs">
                        {banding.status_asli} → {banding.status_diajukan}
                      </Badge>
                    </div>

                    {/* Alasan banding */}
                    <div className="mb-3">
                      <p className="font-medium text-gray-700 text-xs mb-1">Alasan Banding</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded text-xs">
                        {banding.alasan_banding}
                      </p>
                    </div>

                    {/* Respon guru */}
                    {banding.catatan_guru && (
                      <div className="mb-3">
                        <p className="font-medium text-gray-700 text-xs mb-1">Respon Guru</p>
                        <div className="text-sm bg-blue-50 p-2 rounded border-l-2 border-blue-300">
                          <div className="text-gray-600 text-xs">{banding.catatan_guru}</div>
                        </div>
                        {banding.tanggal_keputusan && (
                          <p className="text-xs text-gray-500 mt-1">
                            Diproses: {formatDateWIB(banding.tanggal_keputusan)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Tombol aksi untuk mobile */}
                    <div className="pt-3 border-t">
                      {banding.status_banding === 'pending' ? (
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 flex-1">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Setujui
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm mx-auto">
                              <DialogHeader>
                                <DialogTitle className="text-base">Setujui Banding Absen</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="text-sm">
                                  <p className="text-gray-600 mb-1">Banding dari: <strong>{banding.nama_siswa}</strong></p>
                                  <p className="text-gray-600 mb-1">Status: {banding.status_asli} → {banding.status_diajukan}</p>
                                  <p className="text-gray-600">Tanggal: {formatDateWIB(banding.tanggal_absen)}</p>
                                </div>
                                <Textarea 
                                  placeholder="Catatan persetujuan (opsional)" 
                                  id={`approve-banding-mobile-${banding.id_banding}`}
                                  className="text-sm"
                                />
                                <Button 
                                  onClick={() => {
                                    const textarea = document.getElementById(`approve-banding-mobile-${banding.id_banding}`) as HTMLTextAreaElement;
                                    handleBandingResponse(banding.id_banding, 'disetujui', textarea.value);
                                  }}
                                  className="w-full bg-green-600 hover:bg-green-700"
                                >
                                  Setujui Banding Absen
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="destructive" className="flex-1">
                                <X className="w-4 h-4 mr-1" />
                                Tolak
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm mx-auto">
                              <DialogHeader>
                                <DialogTitle className="text-base">Tolak Banding Absen</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="text-sm">
                                  <p className="text-gray-600 mb-1">Banding dari: <strong>{banding.nama_siswa}</strong></p>
                                  <p className="text-gray-600">Status: {banding.status_asli} → {banding.status_diajukan}</p>
                                </div>
                                <Textarea 
                                  placeholder="Alasan penolakan (wajib)" 
                                  id={`reject-banding-mobile-${banding.id_banding}`}
                                  required
                                  className="text-sm"
                                />
                                <Button 
                                  onClick={() => {
                                    const textarea = document.getElementById(`reject-banding-mobile-${banding.id_banding}`) as HTMLTextAreaElement;
                                    if (textarea.value.trim()) {
                                      handleBandingResponse(banding.id_banding, 'ditolak', textarea.value);
                                    } else {
                                      toast({ title: "Error", description: "Alasan penolakan harus diisi", variant: "destructive" });
                                    }
                                  }}
                                  variant="destructive"
                                  className="w-full"
                                >
                                  Tolak Banding Absen
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="w-full text-xs"
                        >
                          Sudah Diproses
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
        
        {/* Pagination */}
        {!loading && bandingList.length > 0 && totalPages > 1 && (
          <div className="mt-6 pt-4 border-t">
            {/* Mobile Pagination */}
            <div className="lg:hidden">
              <div className="flex flex-col gap-3">
                <div className="text-center text-sm text-gray-600">
                  Halaman {currentPage} dari {totalPages}
                  <div className="text-xs text-gray-500 mt-1">
                    {filterPending ? `${totalPending} belum di-acc` : `${totalAll} total`}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="flex-1 max-w-[120px]"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    <span className="hidden xs:inline">Sebelumnya</span>
                    <span className="xs:hidden">Prev</span>
                  </Button>
                  
                  {/* Page numbers - simplified for mobile */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage <= 2) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 1) {
                        pageNum = totalPages - 2 + i;
                      } else {
                        pageNum = currentPage - 1 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-8 h-8 p-0 ${currentPage === pageNum ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="flex-1 max-w-[120px]"
                  >
                    <span className="hidden xs:inline">Selanjutnya</span>
                    <span className="xs:hidden">Next</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Desktop Pagination */}
            <div className="hidden lg:flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Halaman {currentPage} dari {totalPages} 
                {filterPending ? ` (${totalPending} belum di-acc)` : ` (${totalAll} total)`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Sebelumnya
                </Button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className={currentPage === pageNum ? "bg-blue-600 hover:bg-blue-700" : ""}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Selanjutnya
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// History View
const HistoryView = ({ user }: { user: TeacherDashboardProps['userData'] }) => {
  const [historyData, setHistoryData] = useState<HistoryData>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDays, setTotalDays] = useState(0);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const limit = 7; // 7 hari kebelakang

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        // Gunakan endpoint dengan pagination: /api/guru/student-attendance-history
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: limit.toString()
        });
        
        const res = await apiCall(`/api/guru/student-attendance-history?${params}`);
        // console.log();
        
        let flat: Array<FlatHistoryRow>;
        let totalDaysCount = 0;
        
        if (res && typeof res === 'object' && res.data) {
          flat = res.data;
          totalDaysCount = res.totalDays || 0;
          setTotalPages(res.totalPages || 1);
          setTotalDays(totalDaysCount);
        } else {
          flat = Array.isArray(res) ? res : [];
          // Fallback: hitung total days dari data yang ada
          const uniqueDates = new Set(flat.map(row => formatDateWIB(row.tanggal)));
          totalDaysCount = uniqueDates.size;
          setTotalPages(Math.ceil(totalDaysCount / limit));
          setTotalDays(totalDaysCount);
        }
        
        // console.log();

        const normalizeStatus = (s: string): AttendanceStatus => {
          const v = (s || '').toLowerCase();
          if (v === 'hadir') return 'Hadir';
          if (v === 'izin') return 'Izin';
          if (v === 'dispen') return 'Dispen';
          if (v === 'sakit') return 'Sakit';
          if (v === 'alpa' || v === 'tidak hadir' || v === 'absen') return 'Alpa';
          return 'Lain';
        };

        // Bentuk ulang menjadi HistoryData terkelompok per tanggal dan kelas
        const grouped: HistoryData = {};
        flat.forEach((row) => {
          // console.log();
          const dateKey = formatDateWIB(row.tanggal);
          if (!grouped[dateKey]) grouped[dateKey] = {};
          const classKey = `${row.nama_mapel} - ${row.nama_kelas}`;
          if (!grouped[dateKey][classKey]) {
            grouped[dateKey][classKey] = {
              kelas: row.nama_kelas,
              mata_pelajaran: row.nama_mapel,
              jam: `${row.jam_mulai} - ${row.jam_selesai}`,
              hari: new Intl.DateTimeFormat('id-ID', { 
                weekday: 'long',
                timeZone: 'Asia/Jakarta'
              }).format(toWIBTime(row.tanggal)),
              jam_ke: row.jam_ke,
              kode_ruang: row.kode_ruang,
              nama_ruang: row.nama_ruang,
              lokasi: row.lokasi,
              status_guru: row.status_guru,
              keterangan_guru: row.keterangan_guru,
              siswa: [],
            };
          }
          grouped[dateKey][classKey].siswa.push({
            nama: row.nama_siswa,
            nis: row.nis,
            status: normalizeStatus(String(row.status_kehadiran)),
            waktu_absen: row.waktu_absen,
            alasan: row.keterangan || undefined,
          });
        });

        // console.log();
        setHistoryData(grouped);
      } catch (error) {
        console.error('Error fetching history:', error);
        toast({ 
          title: "Error", 
          description: "Gagal memuat riwayat absensi", 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user.guru_id, user.id, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const toggleClassDetail = (classKey: string) => {
    const newExpanded = new Set(expandedClasses);
    if (newExpanded.has(classKey)) {
      newExpanded.delete(classKey);
    } else {
      newExpanded.add(classKey);
    }
    setExpandedClasses(newExpanded);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Riwayat Absensi
          </CardTitle>
          {!loading && totalDays > 0 && (
            <div className="text-xs sm:text-sm text-gray-600">
              <div className="sm:hidden">
                {totalDays} hari | {currentPage}/{totalPages}
              </div>
              <div className="hidden sm:block">
                Total: {totalDays} hari | Halaman {currentPage} dari {totalPages}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-200 h-32 rounded"></div>
            ))}
          </div>
        ) : Object.keys(historyData).length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada riwayat</h3>
            <p className="text-gray-600">Riwayat absensi akan muncul setelah Anda mengambil absensi</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(historyData)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([date, classes]) => (
              <div key={date} className="border-b pb-4 last:border-b-0">
                <h4 className="font-medium mb-3">
                  {formatDateOnly(date)}
                </h4>
                <div className="space-y-3">
                  {Object.entries(classes).map(([classKey, classData]) => (
                    <div key={classKey} className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                            <h5 className="font-medium text-sm sm:text-base">{classData.mata_pelajaran}</h5>
                            <Badge variant="secondary" className="text-xs w-fit">
                              Jam ke-{classData.jam_ke}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{classData.kelas}</p>
                          <p className="text-xs text-gray-500">{classData.jam}</p>
                          
                          {/* Informasi Ruang */}
                          {classData.nama_ruang && (
                            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-1 text-xs text-gray-600">
                              <span className="font-medium">Ruang:</span>
                              <div className="flex flex-wrap items-center gap-1">
                                <span>{classData.nama_ruang}</span>
                                {classData.kode_ruang && (
                                  <span className="text-gray-500">({classData.kode_ruang})</span>
                                )}
                                {classData.lokasi && (
                                  <span className="text-gray-500">- {classData.lokasi}</span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Status Guru */}
                          {classData.status_guru && (
                            <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-1 text-xs">
                              <span className="font-medium text-gray-600">Status Guru:</span>
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge
                                  variant={
                                    classData.status_guru === 'hadir' ? 'default' :
                                    classData.status_guru === 'izin' || classData.status_guru === 'sakit' ? 'secondary' :
                                    'destructive'
                                  }
                                  className="text-xs"
                                >
                                  {classData.status_guru.charAt(0).toUpperCase() + classData.status_guru.slice(1)}
                                </Badge>
                                {classData.keterangan_guru && (
                                  <span className="text-gray-500">- {classData.keterangan_guru}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                          <Badge variant="outline" className="text-xs">{classData.siswa.length} siswa</Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleClassDetail(`${date}-${classKey}`)}
                            className="text-xs w-full sm:w-auto"
                          >
                            {expandedClasses.has(`${date}-${classKey}`) ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
                          </Button>
                        </div>
                      </div>
                      
                      {expandedClasses.has(`${date}-${classKey}`) && (
                        <div className="mt-4">
                          {/* Desktop Table View */}
                          <div className="hidden sm:block">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nama</TableHead>
                                  <TableHead>NIS</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Waktu Absen</TableHead>
                                  <TableHead>Keterangan</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(() => {
                                  // console.log();
                                  return null;
                                })()}
                                {classData.siswa.map((siswa, siswaIndex) => {
                                  // console.log();
                                  return (
                                    <TableRow key={siswaIndex}>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">{siswa.nama || 'Nama tidak tersedia'}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-gray-600">{siswa.nis || '-'}</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          siswa.status === 'Hadir' ? 'default' :
                                          siswa.status === 'Izin' || siswa.status === 'Sakit' ? 'secondary' :
                                          siswa.status === 'Dispen' ? 'outline' :
                                          'destructive'
                                        }
                                        className={
                                          siswa.status === 'Dispen' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''
                                        }
                                      >
                                        {siswa.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {siswa.waktu_absen ? (
                                        <span className="text-sm">
                                          {formatTime24(siswa.waktu_absen)}
                                        </span>
                                      ) : (
                                        <span className="text-sm text-gray-400">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {siswa.alasan ? (
                                        <span className="text-sm text-gray-600">{siswa.alasan}</span>
                                      ) : (
                                        <span className="text-sm text-gray-400">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Mobile Card View */}
                          <div className="sm:hidden space-y-2">
                            {classData.siswa.map((siswa, siswaIndex) => (
                              <div key={siswaIndex} className="bg-white border rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{siswa.nama || 'Nama tidak tersedia'}</p>
                                    <p className="text-xs text-gray-600">NIS: {siswa.nis || '-'}</p>
                                  </div>
                                  <Badge
                                    variant={
                                      siswa.status === 'Hadir' ? 'default' :
                                      siswa.status === 'Izin' || siswa.status === 'Sakit' ? 'secondary' :
                                      siswa.status === 'Dispen' ? 'outline' :
                                      'destructive'
                                    }
                                    className={`text-xs ${
                                      siswa.status === 'Dispen' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''
                                    }`}
                                  >
                                    {siswa.status}
                                  </Badge>
                                </div>
                                <div className="space-y-1">
                                  {siswa.waktu_absen && (
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      <span className="font-medium">Waktu:</span>
                                      <span>{formatTime24(siswa.waktu_absen)}</span>
                                    </div>
                                  )}
                                  {siswa.alasan && (
                                    <div className="flex items-start gap-2 text-xs text-gray-600">
                                      <span className="font-medium">Keterangan:</span>
                                      <span className="flex-1">{siswa.alasan}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {!loading && Object.keys(historyData).length > 0 && totalPages > 1 && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                Menampilkan {Object.keys(historyData).length} hari dari {totalDays} total
              </div>
              
              {/* Mobile Pagination */}
              <div className="sm:hidden flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="text-xs"
                >
                  <ChevronLeft className="w-3 h-3" />
                  Prev
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage <= 2) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 1) {
                      pageNum = totalPages - 2 + i;
                    } else {
                      pageNum = currentPage - 1 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className={`text-xs px-2 ${
                          currentPage === pageNum ? "bg-blue-600 hover:bg-blue-700" : ""
                        }`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="text-xs"
                >
                  Next
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>

              {/* Desktop Pagination */}
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Sebelumnya
                </Button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className={currentPage === pageNum ? "bg-blue-600 hover:bg-blue-700" : ""}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Selanjutnya
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
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
