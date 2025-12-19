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

const statusColors = {
  current: 'bg-green-100 text-green-800',
  upcoming: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-800',
};

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

// Schedule List View
const ScheduleListView = ({ schedules, onSelectSchedule, isLoading }: {
  schedules: Schedule[];
  onSelectSchedule: (schedule: Schedule) => void;
  isLoading: boolean;
}) => (
  <Card className="w-full">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
        <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
        Jadwal Hari Ini
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 h-16 sm:h-20 rounded"></div>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Tidak ada jadwal hari ini</h3>
          <p className="text-sm sm:text-base text-gray-600">Selamat beristirahat!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            // FIXED: Enhanced deduplication to prevent looping
            const uniqueSchedules = schedules.filter((schedule, index, self) => {
              // Use multiple fields to ensure uniqueness
              const key = `${schedule.id}-${schedule.jam_mulai}-${schedule.jam_selesai}-${schedule.nama_mapel}`;
              return self.findIndex(s => 
                `${s.id}-${s.jam_mulai}-${s.jam_selesai}-${s.nama_mapel}` === key
              ) === index;
            });
            
            return uniqueSchedules.map((schedule) => {
            // Conditional rendering untuk jadwal yang tidak bisa diabsen
            if (!schedule.is_absenable) {
              return (
                <div
                  key={schedule.id}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 bg-gray-50"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Badge row - responsive layout */}
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {schedule.jam_mulai} - {schedule.jam_selesai}
                        </Badge>
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">
                          {schedule.jenis_aktivitas === 'upacara' ? '🏳️ Upacara' :
                           schedule.jenis_aktivitas === 'istirahat' ? '☕ Istirahat' :
                           schedule.jenis_aktivitas === 'kegiatan_khusus' ? '🎯 Kegiatan Khusus' :
                           schedule.jenis_aktivitas === 'libur' ? '🏖️ Libur' :
                           schedule.jenis_aktivitas === 'ujian' ? '📝 Ujian' :
                           '📋 ' + (schedule.jenis_aktivitas || 'Khusus')}
                        </Badge>
                      </div>
                      
                      {/* Title and class info */}
                      <h4 className="font-medium text-gray-700 text-sm sm:text-base truncate">
                        {schedule.keterangan_khusus || schedule.nama_mapel}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{schedule.nama_kelas}</p>
                      
                      {/* Status badge */}
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                          Tidak perlu absen
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Jadwal normal yang bisa diabsen
            return (
              <div
                key={schedule.id}
                className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onSelectSchedule(schedule)}
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Badge row - responsive layout */}
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {schedule.jam_mulai} - {schedule.jam_selesai}
                      </Badge>
                      <Badge className={`${statusColors[schedule.status || 'upcoming']} text-xs whitespace-nowrap`}>
                        {schedule.status === 'current' ? 'Sedang Berlangsung' : 
                         schedule.status === 'completed' ? 'Selesai' : 'Akan Datang'}
                      </Badge>
                    </div>
                    
                    {/* Title and class info */}
                    <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">{schedule.nama_mapel}</h4>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">{schedule.nama_kelas}</p>
                    
                    {/* Multi-guru indicator */}
                    {schedule.is_multi_guru && schedule.other_teachers && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-xs mb-1">
                          🧑‍🏫 Team Teaching
                        </Badge>
                        <p className="text-xs text-gray-500 truncate">
                          {schedule.other_teachers.split('||').map(teacher => teacher.split(':')[1]).join(', ')}
                        </p>
                      </div>
                    )}
                    
                    {/* Room info */}
                    {schedule.kode_ruang && (
                      <div className="mt-1">
                        <Badge variant="outline" className="text-xs">
                          {schedule.kode_ruang}
                          {schedule.nama_ruang && ` - ${schedule.nama_ruang}`}
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  {/* Action button - responsive */}
                  <div className="flex-shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full sm:w-auto text-xs sm:text-sm"
                    >
                      {schedule.status === 'current' ? 'Ambil Absensi' : 'Lihat Detail'}
                    </Button>
                  </div>
                </div>
              </div>
            );
            });
          })()}
        </div>
      )}
    </CardContent>
  </Card>
);

// Attendance View (for taking attendance)
const AttendanceView = ({ schedule, user, onBack }: {
  schedule: Schedule;
  user: TeacherDashboardProps['userData'];
  onBack: () => void;
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<{[key: number]: AttendanceStatus}>({});
  const [notes, setNotes] = useState<{[key: number]: string}>({});
  const [terlambat, setTerlambat] = useState<{[key: number]: boolean}>({});
  const [adaTugas, setAdaTugas] = useState<{[key: number]: boolean}>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
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
    const thirtyDaysAgo = new Date(wibNow.getTime() - 30 * 24 * 60 * 60 * 1000);
    return formatDateWIB(thirtyDaysAgo);
  });

  useEffect(() => {
    // Fetch students for the class
    const fetchStudents = async () => {
      try {
        setLoading(true);
        // console.log();
        const data = await apiCall(`/api/schedule/${schedule.id}/students`);
        // console.log();
        setStudents(data);
        
        // Initialize attendance with existing data or default to 'Hadir'
        const initialAttendance: {[key: number]: AttendanceStatus} = {};
        const initialNotes: {[key: number]: string} = {};
        data.forEach((student: Student) => {
          initialAttendance[student.id] = (student.attendance_status as AttendanceStatus) || 'Hadir';
          // Always load keterangan, even if empty
          initialNotes[student.id] = student.attendance_note || '';
        });
        setAttendance(initialAttendance);
        setNotes(initialNotes);
        
        // Log attendance status for debugging
        // console.log();
        // console.log();
      } catch (error) {
        console.error('❌ Error fetching students:', error);
        let errorMessage = "Gagal memuat daftar siswa";
        
        if (error instanceof Error) {
          if (error.message.includes('404')) {
            errorMessage = "Jadwal tidak ditemukan atau tidak ada siswa dalam kelas ini";
          } else if (error.message.includes('500')) {
            errorMessage = "Terjadi kesalahan server. Silakan coba lagi";
          } else if (error.message.includes('Failed to fetch')) {
            errorMessage = "Tidak dapat terhubung ke server. Pastikan server backend sedang berjalan";
          }
        }
        
        toast({ 
          title: "Error", 
          description: errorMessage, 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [schedule.id]);

  // Fetch students by date for edit mode
  const fetchStudentsByDate = async (tanggal: string) => {
    try {
      setLoading(true);
      // console.log();
      const data = await apiCall(`/api/schedule/${schedule.id}/students-by-date?tanggal=${tanggal}`);
      // console.log();
      setStudents(data);
      
      // Initialize attendance with existing data or default to 'Hadir'
      const initialAttendance: {[key: number]: AttendanceStatus} = {};
      const initialNotes: {[key: number]: string} = {};
      data.forEach((student: Student) => {
        initialAttendance[student.id] = (student.attendance_status as AttendanceStatus) || 'Hadir';
        // Always load keterangan, even if empty
        initialNotes[student.id] = student.attendance_note || '';
      });
      setAttendance(initialAttendance);
      setNotes(initialNotes);
    } catch (error) {
      console.error('❌ Error fetching students by date:', error);
      toast({ 
        title: "Error", 
        description: "Gagal memuat data siswa untuk tanggal tersebut", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    if (!isEditMode) {
      // Switching to edit mode
      setSelectedDate(getCurrentDateWIB());
    } else {
      // Switching back to normal mode, reset selectedDate to today and reload today's data
      const todayStr = getCurrentDateWIB();
      setSelectedDate(todayStr);
      fetchStudentsByDate(todayStr);
    }
  };

  // Handle date change
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    fetchStudentsByDate(newDate);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Check if there are any students with existing attendance
      const hasExistingAttendance = students.some(student => student.waktu_absen);
      
      // Validate attendance data
      if (!attendance || Object.keys(attendance).length === 0) {
        toast({ 
          title: "Error", 
          description: "Data absensi tidak boleh kosong", 
          variant: "destructive" 
        });
        return;
      }
      
      // Check if all students have attendance status
      const missingAttendance = students.filter(student => !attendance[student.id]);
      if (missingAttendance.length > 0) {
        toast({ 
          title: "Error", 
          description: `Siswa ${missingAttendance.map(s => s.nama).join(', ')} belum diabsen`, 
          variant: "destructive" 
        });
        return;
      }
      
      // Validasi tanggal sebelum submit
      const todayStr = getCurrentDateWIB();
      
      console.log('🔍 Frontend date validation:', {
        selectedDate,
        todayStr,
        isEditMode,
        isFuture: selectedDate > todayStr
      });
      
      // Validasi selectedDate tidak boleh lebih dari hari ini
      if (selectedDate > todayStr) {
        // console.log();
        toast({ 
          title: "Error", 
          description: "Tidak dapat mengabsen untuk tanggal masa depan", 
          variant: "destructive" 
        });
        return;
      }
      
      // Prepare attendance data with terlambat and ada_tugas flags
      const attendanceData: {[key: number]: { status: AttendanceStatus; terlambat: boolean; ada_tugas: boolean }} = {};
      Object.keys(attendance).forEach(studentId => {
        const studentIdNum = parseInt(studentId);
        attendanceData[studentIdNum] = {
          status: attendance[studentIdNum],
          terlambat: terlambat[studentIdNum] || false,
          ada_tugas: adaTugas[studentIdNum] || false
        };
      });

      console.log('📤 Submitting attendance data:', {
        scheduleId: schedule.id,
        attendance: attendanceData,
        notes,
        guruId: user.guru_id || user.id
      });
      
      const response = await apiCall(`/api/attendance/submit`, {
        method: 'POST',
        body: JSON.stringify({
          scheduleId: schedule.id,
          attendance: attendanceData,
          notes,
          guruId: user.guru_id || user.id,
          tanggal_absen: isEditMode ? selectedDate : undefined
        }),
      });

      // console.log();

      let message = hasExistingAttendance 
        ? "Absensi berhasil diperbarui" 
        : "Absensi berhasil disimpan";
      
      // Add auto-attendance message for multi-guru schedules
      if (response.isMultiGuru) {
        message += " - Semua guru lain otomatis ter-absensi dengan status yang sama";
      }
      
      toast({ 
        title: "Berhasil!", 
        description: message
      });
      
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('❌ Error submitting attendance:', error);
      toast({ 
        title: "Error", 
        description: (error as Error).message, 
        variant: "destructive" 
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Section - Responsive */}
      <div className="space-y-4">
        {/* Back Button */}
        <Button onClick={onBack} variant="outline" className="w-full sm:w-auto">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Jadwal
        </Button>
        
        {/* Title and Info */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold">{isEditMode ? 'Edit Absensi Siswa' : 'Ambil Absensi'}</h2>
          <p className="text-sm sm:text-base text-gray-600 break-words">{schedule.nama_mapel} - {schedule.nama_kelas}</p>
          
          {/* Room Info */}
          {schedule.kode_ruang && (
            <div className="text-sm text-blue-600">
              <Badge variant="outline" className="text-xs">
                {schedule.kode_ruang}
                {schedule.nama_ruang && ` - ${schedule.nama_ruang}`}
              </Badge>
            </div>
          )}
          
          {/* Time Info */}
          <p className="text-xs sm:text-sm text-gray-500">{schedule.jam_mulai} - {schedule.jam_selesai}</p>
          
          {/* Edit Mode Info */}
          {isEditMode && (
            <p className="text-xs sm:text-sm text-blue-600">
              Mengedit absensi untuk tanggal: {formatDateOnly(selectedDate)}
            </p>
          )}
        </div>
        
        {/* Action Buttons - Responsive */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          <Button
            onClick={toggleEditMode}
            variant={isEditMode ? "destructive" : "default"}
            size="sm"
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {isEditMode ? (
              <>
                <XCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Keluar Edit Mode</span>
                <span className="sm:hidden">Keluar Edit</span>
              </>
            ) : (
              <>
                <Edit className="w-4 h-4" />
                <span className="hidden sm:inline">Edit Absen (30 Hari)</span>
                <span className="sm:hidden">Edit Absen</span>
              </>
            )}
          </Button>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            size="sm"
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
            title="Refresh halaman untuk memuat data terbaru"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>
        
        {/* Multi-Guru Alert */}
        {schedule.is_multi_guru && schedule.other_teachers && (
          <Alert className="mt-4">
            <Users className="h-4 w-4" />
            <AlertTitle className="text-sm sm:text-base">Jadwal Multi-Guru</AlertTitle>
            <AlertDescription className="text-xs sm:text-sm">
              Guru lain yang mengajar: {schedule.other_teachers.split('||').map(guru => guru.split(':')[1]).join(', ')}
              <br />
              <span className="text-xs text-green-600 font-medium">
                ✨ Auto-Absensi: Ketika Anda input absensi, semua guru lain akan otomatis ter-absensi dengan status yang sama
              </span>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Edit Mode Controls */}
      {isEditMode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              Pilih Tanggal Absensi
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <Label htmlFor="date-picker" className="text-sm font-medium flex-shrink-0">
                Tanggal:
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
              <div className="text-xs sm:text-sm text-gray-600">
                (Maksimal 30 hari yang lalu)
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Daftar Siswa</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-3 sm:space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse bg-gray-200 h-14 sm:h-16 rounded"></div>
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Tidak ada siswa dalam kelas ini</h3>
              <p className="text-sm sm:text-base text-gray-600">Belum ada siswa yang terdaftar di kelas {schedule.nama_kelas}</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {students.map((student, index) => (
                <div key={student.id} className="border rounded-lg p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{student.nama}</p>
                      {student.nis && (
                        <p className="text-xs sm:text-sm text-gray-600">NIS: {student.nis}</p>
                      )}
                      {student.waktu_absen && (
                        <p className="text-xs text-gray-500">
                          Absen terakhir: {formatTime24(student.waktu_absen)}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs self-start sm:self-center">#{index + 1}</Badge>
                  </div>
                  
                  <div className="space-y-3">
                    {student.waktu_absen && (
                      <div className="mb-2">
                        <Badge variant="secondary" className="text-xs">
                          ✓ Sudah diabsen sebelumnya
                        </Badge>
                      </div>
                    )}
                    <RadioGroup
                      value={attendance[student.id]}
                      onValueChange={(value) => {
                        const newStatus = value as AttendanceStatus;
                        setAttendance(prev => ({ ...prev, [student.id]: newStatus }));
                        
                        // Hapus keterangan jika status berubah ke Hadir
                        if (newStatus === 'Hadir') {
                          setNotes(prev => ({ ...prev, [student.id]: '' }));
                        }
                      }}
                    >
                      <div className="grid grid-cols-2 sm:flex sm:space-x-6 gap-2 sm:gap-0">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Hadir" id={`hadir-${student.id}`} />
                          <Label htmlFor={`hadir-${student.id}`} className="text-xs sm:text-sm">Hadir</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Izin" id={`izin-${student.id}`} />
                          <Label htmlFor={`izin-${student.id}`} className="text-xs sm:text-sm">Izin</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Sakit" id={`sakit-${student.id}`} />
                          <Label htmlFor={`sakit-${student.id}`} className="text-xs sm:text-sm">Sakit</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Alpa" id={`alpa-${student.id}`} />
                          <Label htmlFor={`alpa-${student.id}`} className="text-xs sm:text-sm">Alpa</Label>
                        </div>
                        <div className="flex items-center space-x-2 col-span-2 sm:col-span-1">
                          <RadioGroupItem value="Dispen" id={`dispen-${student.id}`} />
                          <Label htmlFor={`dispen-${student.id}`} className="text-xs sm:text-sm">Dispen</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    
                    {/* Opsi Terlambat dan Ada Tugas */}
                    <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-4">
                      {attendance[student.id] === 'Hadir' && (
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`terlambat-${student.id}`}
                            checked={terlambat[student.id] || false}
                            onChange={(e) => 
                              setTerlambat(prev => ({ ...prev, [student.id]: e.target.checked }))
                            }
                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          <Label htmlFor={`terlambat-${student.id}`} className="text-xs sm:text-sm text-orange-600">
                            Terlambat
                          </Label>
                        </div>
                      )}
                      
                      {(attendance[student.id] === 'Alpa' || attendance[student.id] === 'Sakit' || attendance[student.id] === 'Izin') && (
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`ada-tugas-${student.id}`}
                            checked={adaTugas[student.id] || false}
                            onChange={(e) => 
                              setAdaTugas(prev => ({ ...prev, [student.id]: e.target.checked }))
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <Label htmlFor={`ada-tugas-${student.id}`} className="text-xs sm:text-sm text-blue-600">
                            Ada Tugas
                          </Label>
                        </div>
                      )}
                    </div>
                    
                    {attendance[student.id] !== 'Hadir' && (
                      <div className="mt-3">
                        <Label htmlFor={`keterangan-${student.id}`} className="text-xs sm:text-sm font-medium text-gray-700">
                          Keterangan:
                        </Label>
                        <Textarea
                          id={`keterangan-${student.id}`}
                          placeholder="Masukkan keterangan jika diperlukan..."
                          value={notes[student.id] || ''}
                          onChange={(e) => 
                            setNotes(prev => ({ ...prev, [student.id]: e.target.value }))
                          }
                          className="mt-1 text-xs sm:text-sm"
                          rows={2}
                        />
                      </div>
                    )}

                    {/* Keterangan dari guru lain - hanya untuk jadwal multi-guru */}
                    {schedule.is_multi_guru && student.other_teachers_attendance && student.other_teachers_attendance !== '' && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">📋 Catatan dari Guru Lain:</h4>
                        <div className="space-y-1">
                          {student.other_teachers_attendance.split('||').map((teacherData, idx) => {
                            const [guruNama, status, keterangan, waktu] = teacherData.split(':');
                            if (guruNama === 'Unknown' || guruNama === '') return null;
                            
                            return (
                              <div key={idx} className="text-xs text-blue-700">
                                <span className="font-medium">{guruNama}:</span> {status}
                                {keterangan && keterangan !== '' && (
                                  <span className="ml-2 text-gray-600">- {keterangan}</span>
                                )}
                                {waktu && waktu !== '' && (
                                  <span className="ml-2 text-gray-500">({waktu})</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {students.length > 0 && (
                <div className="pt-4 border-t space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Preview Data Absensi:</h4>
                    <div className="text-xs space-y-1">
                      {students.map(student => (
                        <div key={student.id} className="space-y-1">
                          <div className="flex justify-between">
                            <span>{student.nama}:</span>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${
                                attendance[student.id] === 'Hadir' ? 'text-green-600' :
                                attendance[student.id] === 'Izin' ? 'text-yellow-600' :
                                attendance[student.id] === 'Sakit' ? 'text-blue-600' :
                                'text-red-600'
                              }`}>
                                {attendance[student.id]}
                              </span>
                              {terlambat[student.id] && (
                                <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                                  Terlambat
                                </span>
                              )}
                              {adaTugas[student.id] && (
                                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                  Ada Tugas
                                </span>
                              )}
                            </div>
                          </div>
                          {notes[student.id] && notes[student.id].trim() !== '' && (
                            <div className="text-gray-600 text-xs pl-2">
                              <span className="font-medium">Keterangan:</span> {notes[student.id]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleSubmit} 
                    disabled={submitting} 
                    className="w-full text-sm sm:text-base"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan Absensi'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Laporan Kehadiran Siswa View
const LaporanKehadiranSiswaView = ({ user }: { user: TeacherDashboardProps['userData'] }) => {
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [reportData, setReportData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapelInfo, setMapelInfo] = useState<{nama_mapel: string, nama_guru: string} | null>(null);
  const [pertemuanDates, setPertemuanDates] = useState<string[]>([]);
  const [periode, setPeriode] = useState<{startDate: string, endDate: string, total_days: number} | null>(null);
  
  // Filter state
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });


  useEffect(() => {
    (async ()=>{
      const res = await apiCall('/api/guru/classes');
      setKelasOptions(res);
    })();
    
    // Set default month to current month
    const wibDate = getWIBTime();
    const currentMonth = wibDate.getFullYear() + '-' + String(wibDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(currentMonth);
  }, []);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (month) {
      const range = getMonthRangeWIB(month);
      setDateRange(range);
    }
  };

  const getDateRange = () => {
    if (filterMode === 'month' && selectedMonth) {
      return getMonthRangeWIB(selectedMonth);
    }
    return dateRange;
  };


  const fetchData = async () => {
    if (!selectedKelas) {
      setError('Mohon pilih kelas');
      return;
    }

    const { startDate, endDate } = getDateRange();
    
    if (!startDate || !endDate) {
      setError('Mohon pilih periode');
      return;
    }

    // Validasi rentang maksimal 62 hari
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 62) {
      setError('Rentang tanggal maksimal 62 hari');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiCall(`/api/guru/laporan-kehadiran-siswa?kelas_id=${selectedKelas}&startDate=${startDate}&endDate=${endDate}`);
      setReportData(Array.isArray(res.data) ? res.data : []);
      setMapelInfo(res.mapel_info || null);
      setPertemuanDates(res.pertemuan_dates || []);
      setPeriode(res.periode || null);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Gagal memuat data laporan');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    const { startDate, endDate } = getDateRange();
    
    if (!startDate || !endDate) {
      setError('Mohon pilih periode');
      return;
    }

    try {
      const url = getApiUrl(`/api/guru/download-laporan-kehadiran-siswa?kelas_id=${selectedKelas}&startDate=${startDate}&endDate=${endDate}`);
      const resp = await fetch(url, { 
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      
      if (!resp.ok) {
        throw new Error('Gagal mengunduh file Excel');
      }
      
      const blob = await resp.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `laporan-kehadiran-siswa-${startDate}-${endDate}.xlsx`;
      link.click();
      
      toast({
        title: "Berhasil!",
        description: "File Excel berhasil diunduh"
      });
    } catch (err) {
      console.error('Error downloading excel:', err);
      setError('Gagal mengunduh file Excel');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <Button variant="outline" size="icon" onClick={() => window.history.back()} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">Laporan Kehadiran Siswa</h1>
          <p className="text-sm sm:text-base text-gray-600 break-words">Laporan kehadiran siswa berdasarkan jadwal pertemuan</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        </Card>
      )}

      {/* Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
            Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Mode Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Label className="text-sm font-medium shrink-0">Periode:</Label>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
              <Button
                variant={filterMode === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('month')}
                className="w-full sm:w-auto"
              >
                Bulan
              </Button>
              <Button
                variant={filterMode === 'range' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('range')}
                className="w-full sm:w-auto"
              >
                Rentang Tanggal
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label className="text-sm font-medium">Kelas</Label>
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih Kelas"/>
                </SelectTrigger>
                <SelectContent>
                  {kelasOptions.map(k=> (<SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {filterMode === 'month' ? (
              <div className="sm:col-span-2 lg:col-span-1">
                <Label className="text-sm font-medium">Bulan</Label>
                <Input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="mt-1"
                />
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-sm font-medium">Tanggal Mulai</Label>
                  <Input 
                    type="date" 
                    value={dateRange.startDate} 
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Tanggal Selesai</Label>
                  <Input 
                    type="date" 
                    value={dateRange.endDate} 
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-2 lg:col-span-1 flex items-end">
              <Button 
                onClick={fetchData} 
                disabled={loading} 
                className="w-full"
                size="sm"
              >
                <Search className="w-4 h-4 mr-2"/>
                {loading ? 'Memuat...' : 'Tampilkan Laporan'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {reportData.length > 0 && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <ExcelPreview
              title="Laporan Kehadiran Siswa"
              reportKey={VIEW_TO_REPORT_KEY['reports']}
              data={reportData.map((student, index) => {
                const rowData: Record<string, string | number> = {
                  no: index + 1,
                  nama: student.nama,
                  nis: student.nis || '-',
                  jenis_kelamin: student.jenis_kelamin,
                  hadir: student.total_hadir || 0,
                  izin: student.total_izin || 0,
                  sakit: student.total_sakit || 0,
                  alpa: student.total_alpa || 0,
                  dispen: student.total_dispen || 0,
                  presentase: student.persentase_kehadiran || '0%'
                };

                // Add dynamic columns for each meeting date
                pertemuanDates.forEach((date, dateIndex) => {
                  const attendance = student.attendance_by_date?.[date];
                  let statusCode = 'A'; // Default to Alpa
                  
                  if (attendance) {
                    statusCode = attendance === 'Hadir' ? 'H' : 
                               attendance === 'Izin' ? 'I' : 
                               attendance === 'Sakit' ? 'S' : 
                               attendance === 'Alpa' ? 'A' : 
                               attendance === 'Dispen' ? 'D' : 
                               attendance === 'Tidak Hadir' ? 'A' : 'A';
                  }
                  
                  rowData[`pertemuan_${dateIndex}`] = statusCode;
                });

                return rowData;
              })}
              columns={[
                { key: 'no', label: 'No', width: 50, align: 'center', format: 'number' },
                { key: 'nama', label: 'Nama', width: 150, align: 'left' },
                { key: 'nis', label: 'NIS', width: 120, align: 'left' },
                { key: 'jenis_kelamin', label: 'L/P', width: 50, align: 'center' },
                // Dynamic columns for meeting dates
                ...pertemuanDates.map((date, index) => ({
                  key: `pertemuan_${index}`,
                  label: `${new Date(date).getDate()}/${new Date(date).getMonth() + 1}`,
                  width: 50,
                  align: 'center' as const,
                  format: 'text' as const,
                  title: formatDateOnly(date)
                })),
                { key: 'hadir', label: 'H', width: 50, align: 'center', format: 'number' },
                { key: 'izin', label: 'I', width: 50, align: 'center', format: 'number' },
                { key: 'sakit', label: 'S', width: 50, align: 'center', format: 'number' },
                { key: 'alpa', label: 'A', width: 50, align: 'center', format: 'number' },
                { key: 'dispen', label: 'D', width: 50, align: 'center', format: 'number' },
                { key: 'presentase', label: '%', width: 80, align: 'center', format: 'percentage' }
              ]}
              onExport={downloadExcel}
              teacherName={mapelInfo?.nama_guru || 'Guru'}
              subjectName={mapelInfo?.nama_mapel || 'Mata Pelajaran'}
              reportPeriod={periode ? 
                `Periode: ${formatDateWIB(periode.startDate)} - ${formatDateWIB(periode.endDate)} | Total Pertemuan: ${pertemuanDates.length}` :
                'Periode: -'
              }
              showLetterhead={true}
            />
          </div>
        </div>
      )}

      {!loading && reportData.length === 0 && !error && selectedKelas && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
            <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 text-center">Belum ada data laporan</h3>
            <p className="text-sm sm:text-base text-gray-600 text-center max-w-md">Pilih kelas dan klik "Tampilkan Laporan" untuk melihat laporan kehadiran siswa</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};


// Riwayat Pengajuan Banding Absen Report View
const RiwayatBandingAbsenView = ({ user }: { user: TeacherDashboardProps['userData'] }) => {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [selectedMonth, setSelectedMonth] = useState('');
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportData, setReportData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async ()=>{
      const res = await apiCall('/api/guru/classes');
      setKelasOptions(res);
    })();
  }, []);

  // Handle month selection and auto-fill date range
  const handleMonthChange = (monthValue: string) => {
    setSelectedMonth(monthValue);
    if (monthValue) {
      const range = getMonthRangeWIB(monthValue);
      setDateRange(range);
    } else {
      setDateRange({ startDate: '', endDate: '' });
    }
  };

  const fetchData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Mohon pilih periode mulai dan akhir');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ 
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate 
      });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      
      const res = await apiCall(`/api/guru/banding-absen-history?${params.toString()}`);
      setReportData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error fetching banding absen history:', err);
      setError('Gagal memuat data riwayat banding absen');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    try {
      const params = new URLSearchParams({ 
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate 
      });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      
      const url = getApiUrl(`/api/export/riwayat-banding-absen?${params.toString()}`);
      const response = await fetch(url, { 
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Gagal mengunduh file Excel');
      }
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `riwayat-banding-absen-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      link.click();
      
      toast({
        title: "Berhasil!",
        description: "File Excel berhasil diunduh"
      });
    } catch (err) {
      console.error('Error downloading Excel:', err);
      setError('Gagal mengunduh file Excel');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Filter Laporan Riwayat Banding Absen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Quick Month Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Pilih Bulan (Cepat)</Label>
                <Input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="mt-1"
                  placeholder="Pilih bulan"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedMonth('');
                    setDateRange({ startDate: '', endDate: '' });
                  }}
                  className="w-full"
                >
                  Reset Filter
                </Button>
              </div>
            </div>
            
            {/* Manual Date Range Selection */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Atau Pilih Rentang Tanggal Manual</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div>
                  <Label className="text-sm font-medium">Periode Mulai</Label>
                  <Input 
                    type="date" 
                    value={dateRange.startDate} 
                    onChange={(e)=>setDateRange(p=>({...p,startDate:e.target.value}))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Periode Akhir</Label>
                  <Input 
                    type="date" 
                    value={dateRange.endDate} 
                    onChange={(e)=>setDateRange(p=>({...p,endDate:e.target.value}))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Kelas</Label>
                  <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih Kelas"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {kelasOptions.map(k=> (<SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih Status"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Disetujui</SelectItem>
                      <SelectItem value="rejected">Ditolak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={fetchData} disabled={loading} className="flex-1">
                    <Search className="w-4 h-4 mr-2"/>
                    {loading ? 'Memuat...' : 'Tampilkan'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {reportData.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Riwayat Pengajuan Banding Absen
                </CardTitle>
                <Button onClick={downloadExcel} className="bg-green-600 hover:bg-green-700">
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Tanggal Absen</TableHead>
                      <TableHead>Status Absen</TableHead>
                      <TableHead>Alasan Banding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal Disetujui</TableHead>
                      <TableHead>Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{formatDateWIB(String(item.tanggal_pengajuan))}</TableCell>
                        <TableCell>{item.nama_siswa}</TableCell>
                        <TableCell>{item.nis}</TableCell>
                        <TableCell>{item.nama_kelas}</TableCell>
                        <TableCell>{formatDateWIB(String(item.tanggal_absen))}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.status_absen}</Badge>
                        </TableCell>
                        <TableCell>{item.alasan_banding}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={item.status === 'approved' ? 'default' : 
                                   item.status === 'rejected' ? 'destructive' : 'secondary'}
                          >
                            {item.status === 'approved' ? 'Disetujui' : 
                             item.status === 'rejected' ? 'Ditolak' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.tanggal_disetujui ? 
                            formatDateWIB(String(item.tanggal_disetujui)) : 
                            '-'
                          }
                        </TableCell>
                        <TableCell>{item.catatan || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Presensi Siswa SMK 13 Report View
const PresensiSiswaSMKN13View = ({ user }: { user: TeacherDashboardProps['userData'] }) => {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [reportData, setReportData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async ()=>{
      const res = await apiCall('/api/guru/classes');
      setKelasOptions(res);
    })();
  }, []);

  const fetchData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Mohon pilih periode mulai dan akhir');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ 
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate 
      });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      
      const res = await apiCall(`/api/guru/presensi-siswa-smkn13?${params.toString()}`);
      setReportData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error fetching presensi siswa SMKN 13:', err);
      setError('Gagal memuat data presensi siswa');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    try {
      const params = new URLSearchParams({ 
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate 
      });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      
      const url = getApiUrl(`/api/export/presensi-siswa-smkn13?${params.toString()}`);
      const response = await fetch(url, { 
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Gagal mengunduh file Excel');
      }
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `presensi-siswa-smkn13-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      link.click();
      
      toast({
        title: "Berhasil!",
        description: "File Excel berhasil diunduh"
      });
    } catch (err) {
      console.error('Error downloading Excel:', err);
      setError('Gagal mengunduh file Excel');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Filter Laporan Presensi Siswa SMK 13
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <Label className="text-sm font-medium">Periode Mulai</Label>
              <Input 
                type="date" 
                value={dateRange.startDate} 
                onChange={(e)=>setDateRange(p=>({...p,startDate:e.target.value}))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Periode Akhir</Label>
              <Input 
                type="date" 
                value={dateRange.endDate} 
                onChange={(e)=>setDateRange(p=>({...p,endDate:e.target.value}))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Kelas</Label>
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih Kelas"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {kelasOptions.map(k=> (<SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchData} disabled={loading} className="flex-1">
                <Search className="w-4 h-4 mr-2"/>
                {loading ? 'Memuat...' : 'Tampilkan'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {reportData.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Presensi Siswa SMK 13
                </CardTitle>
                <Button onClick={downloadExcel} className="bg-blue-600 hover:bg-blue-700">
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Hari</TableHead>
                      <TableHead>Jam</TableHead>
                      <TableHead>Mata Pelajaran</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Guru</TableHead>
                      <TableHead>Total Siswa</TableHead>
                      <TableHead>Hadir</TableHead>
                      <TableHead>Izin</TableHead>
                      <TableHead>Sakit</TableHead>
                      <TableHead>Alpa</TableHead>
                      <TableHead>Dispen</TableHead>
                      <TableHead>Presentase</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, index) => {
                      const total = item.total_siswa || 0;
                      const hadir = item.hadir || 0;
                      const presentase = Number(total) > 0 ? ((Number(hadir) / Number(total)) * 100).toFixed(1) : '0.0';
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{formatDateWIB(String(item.tanggal))}</TableCell>
                          <TableCell>{item.hari}</TableCell>
                          <TableCell>{item.jam_mulai} - {item.jam_selesai}</TableCell>
                          <TableCell>{item.mata_pelajaran}</TableCell>
                          <TableCell>{item.nama_kelas}</TableCell>
                          <TableCell>{item.nama_guru}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{total}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-500">{item.hadir || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-yellow-500">{item.izin || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-orange-500">{item.sakit || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive">{item.alpa || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-purple-500">{item.dispen || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-100">
                              {presentase}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Rekap Ketidakhadiran Report View
const RekapKetidakhadiranView = ({ user }: { user: TeacherDashboardProps['userData'] }) => {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [selectedMonth, setSelectedMonth] = useState('');
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [reportType, setReportType] = useState('bulanan'); // bulanan atau tahunan
  const [reportData, setReportData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async ()=>{
      const res = await apiCall('/api/guru/classes');
      setKelasOptions(res);
    })();
  }, []);

  // Handle month selection and auto-fill date range
  const handleMonthChange = (monthValue: string) => {
    setSelectedMonth(monthValue);
    if (monthValue) {
      const range = getMonthRangeWIB(monthValue);
      setDateRange(range);
    } else {
      setDateRange({ startDate: '', endDate: '' });
    }
  };

  const fetchData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Mohon pilih periode mulai dan akhir');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ 
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate,
        reportType: reportType
      });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      
      const res = await apiCall(`/api/guru/rekap-ketidakhadiran?${params.toString()}`);
      setReportData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error fetching rekap ketidakhadiran:', err);
      setError('Gagal memuat data rekap ketidakhadiran');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    try {
      const params = new URLSearchParams({ 
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate,
        reportType: reportType
      });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      
      const url = getApiUrl(`/api/export/rekap-ketidakhadiran?${params.toString()}`);
      const response = await fetch(url, { 
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Gagal mengunduh file Excel');
      }
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `rekap-ketidakhadiran-${reportType}-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      link.click();
      
      toast({
        title: "Berhasil!",
        description: "File Excel berhasil diunduh"
      });
    } catch (err) {
      console.error('Error downloading Excel:', err);
      setError('Gagal mengunduh file Excel');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Filter Laporan Rekap Ketidakhadiran
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Quick Month Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Pilih Bulan (Cepat)</Label>
                <Input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="mt-1"
                  placeholder="Pilih bulan"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedMonth('');
                    setDateRange({ startDate: '', endDate: '' });
                  }}
                  className="w-full"
                >
                  Reset Filter
                </Button>
              </div>
            </div>
            
            {/* Manual Date Range Selection */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Atau Pilih Rentang Tanggal Manual</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div>
                  <Label className="text-sm font-medium">Periode Mulai</Label>
                  <Input 
                    type="date" 
                    value={dateRange.startDate} 
                    onChange={(e)=>setDateRange(p=>({...p,startDate:e.target.value}))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Periode Akhir</Label>
                  <Input 
                    type="date" 
                    value={dateRange.endDate} 
                    onChange={(e)=>setDateRange(p=>({...p,endDate:e.target.value}))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Kelas</Label>
                  <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih Kelas"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {kelasOptions.map(k=> (<SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Jenis Laporan</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih Jenis"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bulanan">Bulanan</SelectItem>
                      <SelectItem value="tahunan">Tahunan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={fetchData} disabled={loading} className="flex-1">
                    <Search className="w-4 h-4 mr-2"/>
                    {loading ? 'Memuat...' : 'Tampilkan'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {reportData.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Rekap Ketidakhadiran {reportType === 'bulanan' ? 'Bulanan' : 'Tahunan'}
                </CardTitle>
                <Button onClick={downloadExcel} className="bg-green-600 hover:bg-green-700">
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Total Siswa</TableHead>
                      <TableHead>Hadir</TableHead>
                      <TableHead>Izin</TableHead>
                      <TableHead>Sakit</TableHead>
                      <TableHead>Alpa</TableHead>
                      <TableHead>Dispen</TableHead>
                      <TableHead>Total Absen</TableHead>
                      <TableHead>Presentase Hadir</TableHead>
                      <TableHead>Presentase Absen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, index) => {
                      const totalSiswa = item.total_siswa || 0;
                      const hadir = item.hadir || 0;
                      const totalAbsen = (Number(item.izin) || 0) + (Number(item.sakit) || 0) + (Number(item.alpa) || 0) + (Number(item.dispen) || 0);
                      const presentaseHadir = Number(totalSiswa) > 0 ? ((Number(hadir) / Number(totalSiswa)) * 100).toFixed(1) : '0.0';
                      const presentaseAbsen = Number(totalSiswa) > 0 ? ((Number(totalAbsen) / Number(totalSiswa)) * 100).toFixed(1) : '0.0';
                      
                      return (
                        <TableRow key={item.id || index}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{item.periode}</TableCell>
                          <TableCell>{item.nama_kelas}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{totalSiswa}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-500">{hadir}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-yellow-500">{item.izin || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-orange-500">{item.sakit || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive">{item.alpa || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-purple-500">{item.dispen || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-red-100">{totalAbsen}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-100">
                              {presentaseHadir}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-red-100">
                              {presentaseAbsen}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Teacher Reports View (summary per kelas & rentang tanggal)
const TeacherReportsView = ({ user }: { user: TeacherDashboardProps['userData'] }) => {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [selectedMonth, setSelectedMonth] = useState('');
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [reportData, setReportData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async ()=>{
      const res = await apiCall('/api/guru/classes');
      setKelasOptions(res);
    })();
  }, []);

  // Handle month selection and auto-fill date range
  const handleMonthChange = (monthValue: string) => {
    setSelectedMonth(monthValue);
    if (monthValue) {
      const range = getMonthRangeWIB(monthValue);
      setDateRange(range);
    } else {
      setDateRange({ startDate: '', endDate: '' });
    }
  };

  const fetchData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Mohon pilih periode mulai dan akhir');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      const res = await apiCall(`/api/guru/attendance-summary?${params.toString()}`);
      setReportData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Gagal memuat data laporan');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    try {
      const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      const url = getApiUrl(`/api/guru/download-attendance-excel?${params.toString()}`);
      const resp = await fetch(url, { credentials: 'include' });
      const blob = await resp.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `laporan-kehadiran-siswa-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      link.click();
    } catch (err) {
      console.error('Error downloading excel:', err);
      setError('Gagal mengunduh file Excel');
    }
  };

  const downloadSMKN13Format = async () => {
    try {
      const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      
      const url = getApiUrl(`/api/export/ringkasan-kehadiran-siswa-smkn13?${params.toString()}`);
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
      link.download = `laporan-kehadiran-siswa-smkn13-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
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
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ringkasan Kehadiran Siswa</h1>
          <p className="text-gray-600">Download ringkasan kehadiran siswa dalam format Excel</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        </Card>
      )}

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Quick Month Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Pilih Bulan (Cepat)</Label>
                <Input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="mt-1"
                  placeholder="Pilih bulan"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedMonth('');
                    setDateRange({ startDate: '', endDate: '' });
                  }}
                  className="w-full"
                >
                  Reset Filter
                </Button>
              </div>
            </div>
            
            {/* Manual Date Range Selection */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Atau Pilih Rentang Tanggal Manual</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <Label className="text-sm font-medium">Periode Mulai</Label>
                  <Input 
                    type="date" 
                    value={dateRange.startDate} 
                    onChange={(e)=>setDateRange(p=>({...p,startDate:e.target.value}))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Periode Akhir</Label>
                  <Input 
                    type="date" 
                    value={dateRange.endDate} 
                    onChange={(e)=>setDateRange(p=>({...p,endDate:e.target.value}))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Kelas</Label>
                  <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih Kelas"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {kelasOptions.map(k=> (<SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={fetchData} disabled={loading} className="flex-1">
                    <Search className="w-4 h-4 mr-2"/>
                    {loading ? 'Memuat...' : 'Tampilkan'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData.length > 0 && (
        <div className="space-y-4">
          <ExcelPreview
            title="Ringkasan Kehadiran Siswa"
            reportKey={VIEW_TO_REPORT_KEY['reports']}
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
              { key: 'no', label: 'No', width: 60, align: 'center', format: 'number' },
              { key: 'nama', label: 'Nama Siswa', width: 200, align: 'left' },
              { key: 'nis', label: 'NIS', width: 120, align: 'left' },
              { key: 'kelas', label: 'Kelas', width: 100, align: 'center' },
              { key: 'hadir', label: 'H', width: 80, align: 'center', format: 'number' },
              { key: 'izin', label: 'I', width: 80, align: 'center', format: 'number' },
              { key: 'sakit', label: 'S', width: 80, align: 'center', format: 'number' },
              { key: 'alpa', label: 'A', width: 80, align: 'center', format: 'number' },
              { key: 'dispen', label: 'D', width: 80, align: 'center', format: 'number' },
              { key: 'presentase', label: 'Presentase', width: 100, align: 'center', format: 'percentage' }
            ]}
            onExport={downloadExcel}
            teacherName={user?.nama || 'Guru'}
            reportPeriod={selectedMonth ? 
              `Periode: ${formatDateOnly(selectedMonth + '-01')}` :
              `Periode: ${dateRange.startDate} - ${dateRange.endDate}`
            }
          />
          
          {/* SMK 13 Format Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Export Format SMK 13
              </CardTitle>
              <p className="text-sm text-gray-600">
                Download laporan dalam format resmi SMK Negeri 13 Bandung
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={downloadSMKN13Format}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Format SMK 13
                </Button>
                <div className="text-sm text-gray-500">
                  Format resmi dengan header sekolah dan styling profesional
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && reportData.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada data laporan</h3>
            <p className="text-gray-600 text-center">Pilih periode dan kelas, lalu klik "Tampilkan" untuk melihat laporan kehadiran siswa</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
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
