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
import { toast } from "@/hooks/use-toast";
import { formatTime24, formatDateTime24 } from "@/lib/time-utils";
import { FontSizeControl } from "@/components/ui/font-size-control";
import { 
  Clock, Users, CheckCircle, LogOut, ArrowLeft, History, MessageCircle, Calendar,
  BookOpen, GraduationCap, Settings, Menu, X, Home, Bell, FileText, ClipboardList, Download, Search
} from "lucide-react";

interface TeacherDashboardProps {
  userData: {
    id: number;
    username: string;
    nama: string;
    role: string;
    guru_id?: number;
    nip?: string;
    mapel?: string;
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
  status?: ScheduleStatus;
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
  siswa: HistoryStudentData[];
}

interface HistoryData {
  [date: string]: {
    [classKey: string]: HistoryClassData;
  };
}

interface PengajuanIzin {
  id: number;
  siswa_id: number;
  nama_siswa: string;
  nis: string;
  nama_kelas: string;
  jenis_izin: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  alasan: string;
  tanggal_pengajuan: string;
  status_persetujuan: 'pending' | 'disetujui' | 'ditolak';
  disetujui_oleh?: number;
  catatan_guru?: string;
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
  bukti_pendukung?: string;
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

// API utility function
const apiCall = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, {
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
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Clock className="w-5 h-5" />
        Jadwal Hari Ini
      </CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 h-20 rounded"></div>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada jadwal hari ini</h3>
          <p className="text-gray-600">Selamat beristirahat!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onSelectSchedule(schedule)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {schedule.jam_mulai} - {schedule.jam_selesai}
                    </Badge>
                    <Badge className={statusColors[schedule.status || 'upcoming']}>
                      {schedule.status === 'current' ? 'Sedang Berlangsung' : 
                       schedule.status === 'completed' ? 'Selesai' : 'Akan Datang'}
                    </Badge>
                  </div>
                  <h4 className="font-medium text-gray-900">{schedule.nama_mapel}</h4>
                  <p className="text-sm text-gray-600">{schedule.nama_kelas}</p>
                </div>
                <Button variant="outline" size="sm">
                  {schedule.status === 'current' ? 'Ambil Absensi' : 'Lihat Detail'}
                </Button>
              </div>
            </div>
          ))}
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch students for the class
    const fetchStudents = async () => {
      try {
        setLoading(true);
        console.log(`🔍 Fetching students for schedule ID: ${schedule.id}`);
        const data = await apiCall(`/api/schedule/${schedule.id}/students`);
        console.log(`✅ Received ${data.length} students:`, data);
        setStudents(data);
        
        // Initialize attendance with existing data or default to 'Hadir'
        const initialAttendance: {[key: number]: AttendanceStatus} = {};
        const initialNotes: {[key: number]: string} = {};
        data.forEach((student: any) => {
          initialAttendance[student.id] = (student.attendance_status as AttendanceStatus) || 'Hadir';
          if (student.attendance_note) {
            initialNotes[student.id] = student.attendance_note;
          }
        });
        setAttendance(initialAttendance);
        setNotes(initialNotes);
        
        // Log attendance status for debugging
        console.log('📊 Initial attendance data:', initialAttendance);
        console.log('📝 Initial notes data:', initialNotes);
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
      
      console.log('📤 Submitting attendance data:', {
        scheduleId: schedule.id,
        attendance,
        notes,
        guruId: user.guru_id || user.id
      });
      
      const response = await apiCall(`/api/attendance/submit`, {
        method: 'POST',
        body: JSON.stringify({
          scheduleId: schedule.id,
          attendance,
          notes,
          guruId: user.guru_id || user.id
        }),
      });

      console.log('✅ Attendance submission response:', response);

      const message = hasExistingAttendance 
        ? "Absensi berhasil diperbarui" 
        : "Absensi berhasil disimpan";
      
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button onClick={onBack} variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Jadwal
          </Button>
          <h2 className="text-2xl font-bold">Ambil Absensi</h2>
          <p className="text-gray-600">{schedule.nama_mapel} - {schedule.nama_kelas}</p>
          <p className="text-sm text-gray-500">{schedule.jam_mulai} - {schedule.jam_selesai}</p>
        </div>
        <Button 
          onClick={() => window.location.reload()} 
          variant="outline" 
          size="sm"
          title="Refresh halaman untuk memuat data terbaru"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Siswa</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse bg-gray-200 h-16 rounded"></div>
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada siswa dalam kelas ini</h3>
              <p className="text-gray-600">Belum ada siswa yang terdaftar di kelas {schedule.nama_kelas}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {students.map((student, index) => (
                <div key={student.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">{student.nama}</p>
                      {student.nis && (
                        <p className="text-sm text-gray-600">NIS: {student.nis}</p>
                      )}
                      {student.waktu_absen && (
                        <p className="text-xs text-gray-500">
                          Absen terakhir: {formatTime24(student.waktu_absen)}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">#{index + 1}</Badge>
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
                      onValueChange={(value) => 
                        setAttendance(prev => ({ ...prev, [student.id]: value as AttendanceStatus }))
                      }
                    >
                      <div className="flex space-x-6">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Hadir" id={`hadir-${student.id}`} />
                          <Label htmlFor={`hadir-${student.id}`}>Hadir</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Izin" id={`izin-${student.id}`} />
                          <Label htmlFor={`izin-${student.id}`}>Izin</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Sakit" id={`sakit-${student.id}`} />
                          <Label htmlFor={`sakit-${student.id}`}>Sakit</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Alpa" id={`alpa-${student.id}`} />
                          <Label htmlFor={`alpa-${student.id}`}>Alpa</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Dispen" id={`dispen-${student.id}`} />
                          <Label htmlFor={`dispen-${student.id}`}>Dispen</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    
                    {attendance[student.id] !== 'Hadir' && (
                      <Textarea
                        placeholder="Keterangan (opsional)"
                        value={notes[student.id] || ''}
                        onChange={(e) => 
                          setNotes(prev => ({ ...prev, [student.id]: e.target.value }))
                        }
                        className="mt-2"
                      />
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
                        <div key={student.id} className="flex justify-between">
                          <span>{student.nama}:</span>
                          <span className={`font-medium ${
                            attendance[student.id] === 'Hadir' ? 'text-green-600' :
                            attendance[student.id] === 'Izin' ? 'text-yellow-600' :
                            attendance[student.id] === 'Sakit' ? 'text-blue-600' :
                            'text-red-600'
                          }`}>
                            {attendance[student.id]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleSubmit} 
                    disabled={submitting} 
                    className="w-full"
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

// Teacher Reports View (summary per kelas & rentang tanggal)
const TeacherReportsView = ({ user }: { user: TeacherDashboardProps['userData'] }) => {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async ()=>{
      const res = await apiCall('/api/guru/classes');
      setKelasOptions(res);
    })();
  }, []);

  const fetchData = async () => {
    const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
    if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
    const res = await apiCall(`/api/guru/attendance-summary?${params.toString()}`);
    setRows(res);
  };

  const downloadExcel = async () => {
    const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
    if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
    const url = `http://localhost:3001/api/guru/download-attendance-excel?${params.toString()}`;
    const resp = await fetch(url, { credentials: 'include' });
    const blob = await resp.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `laporan-kehadiran-guru-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Laporan Kehadiran (Ringkas)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div>
            <Label>Dari</Label>
            <Input type="date" value={dateRange.startDate} onChange={(e)=>setDateRange(p=>({...p,startDate:e.target.value}))} />
          </div>
          <div>
            <Label>Sampai</Label>
            <Input type="date" value={dateRange.endDate} onChange={(e)=>setDateRange(p=>({...p,endDate:e.target.value}))} />
          </div>
          <div>
            <Label>Kelas</Label>
            <Select value={selectedKelas} onValueChange={setSelectedKelas}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Pilih Kelas"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {kelasOptions.map(k=> (<SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchData}><Search className="w-4 h-4 mr-2"/>Tampilkan</Button>
            <Button variant="outline" onClick={downloadExcel}><Download className="w-4 h-4 mr-2"/>Excel</Button>
          </div>
        </div>

        <div className="overflow-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="w-28">NIS</TableHead>
                <TableHead className="w-28">Kelas</TableHead>
                <TableHead className="text-center">H</TableHead>
                <TableHead className="text-center">I</TableHead>
                <TableHead className="text-center">S</TableHead>
                <TableHead className="text-center">A</TableHead>
                <TableHead className="text-center">D</TableHead>
                <TableHead className="text-center">Presentase</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows?.length ? rows.map((r:any,idx:number)=> (
                <TableRow key={idx}>
                  <TableCell>{idx+1}</TableCell>
                  <TableCell className="font-medium">{r.nama}</TableCell>
                  <TableCell>{r.nis || '-'}</TableCell>
                  <TableCell>{r.nama_kelas || '-'}</TableCell>
                  <TableCell className="text-center bg-emerald-50 text-emerald-700 font-semibold">{r.H||0}</TableCell>
                  <TableCell className="text-center bg-blue-50 text-blue-700 font-semibold">{r.I||0}</TableCell>
                  <TableCell className="text-center bg-red-50 text-red-700 font-semibold">{r.S||0}</TableCell>
                  <TableCell className="text-center bg-yellow-50 text-yellow-700 font-semibold">{r.A||0}</TableCell>
                  <TableCell className="text-center bg-purple-50 text-purple-700 font-semibold">{r.D||0}</TableCell>
                  <TableCell className="text-center">{Number(r.presentase||0).toFixed(2)}%</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={10} className="text-center py-6 text-gray-500">Tidak ada data</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
// Pengajuan Izin View for Teachers - to approve/reject student leave requests
const PengajuanIzinView = ({ user }: { user: TeacherDashboardProps['userData'] }) => {
  const [pengajuanList, setPengajuanList] = useState<PengajuanIzin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPengajuanIzin = async () => {
      try {
        setLoading(true);
        // Fetch pengajuan izin for this teacher to approve
        const response = await apiCall(`/api/guru/${user.guru_id || user.id}/pengajuan-izin`);
        setPengajuanList(Array.isArray(response) ? response : (response.data || []));
      } catch (error) {
        console.error('Error fetching pengajuan izin:', error);
        toast({ 
          title: "Error", 
          description: "Gagal memuat data pengajuan izin", 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPengajuanIzin();
  }, [user.guru_id, user.id]);

  const handleApprovePengajuan = async (pengajuanId: number, status: 'disetujui' | 'ditolak', catatan: string = '') => {
    try {
      await apiCall(`/api/pengajuan-izin/${pengajuanId}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ 
          status_persetujuan: status, 
          catatan_guru: catatan,
          disetujui_oleh: user.guru_id || user.id
        }),
      });

      toast({ 
        title: "Berhasil!", 
        description: `Pengajuan izin berhasil ${status}` 
      });
      
      // Refresh the list
      setPengajuanList(prev => prev.map(p => 
        p.id === pengajuanId 
          ? { ...p, status_persetujuan: status, catatan_guru: catatan, disetujui_oleh: user.guru_id || user.id }
          : p
      ));
    } catch (error) {
      console.error('Error updating pengajuan izin:', error);
      toast({ 
        title: "Error", 
        description: (error as Error).message, 
        variant: "destructive" 
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Pengajuan Izin Siswa
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-200 h-32 rounded"></div>
            ))}
          </div>
        ) : pengajuanList.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada pengajuan izin</h3>
            <p className="text-gray-600">Belum ada pengajuan izin dari siswa yang perlu disetujui</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pengajuanList.map((pengajuan) => (
              <div key={pengajuan.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{pengajuan.nama_siswa}</h4>
                    <p className="text-sm text-gray-600">
                      NIS: {pengajuan.nis} - Kelas: {pengajuan.nama_kelas}
                    </p>
                                          <p className="text-xs text-gray-500">
                        Diajukan: {formatDateTime24(pengajuan.tanggal_pengajuan, true)}
                      </p>
                  </div>
                  <Badge 
                    variant={
                      pengajuan.status_persetujuan === 'disetujui' ? 'default' : 
                      pengajuan.status_persetujuan === 'ditolak' ? 'destructive' : 'secondary'
                    }
                  >
                    {pengajuan.status_persetujuan === 'pending' ? 'Menunggu Persetujuan' :
                     pengajuan.status_persetujuan === 'disetujui' ? 'Disetujui' : 'Ditolak'}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Tanggal Mulai:</span>
                      <p className="text-gray-600">{new Date(pengajuan.tanggal_mulai).toLocaleDateString('id-ID')}</p>
                    </div>
                    <div>
                      <span className="font-medium">Tanggal Selesai:</span>
                      <p className="text-gray-600">{new Date(pengajuan.tanggal_selesai).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Jenis Izin:</span>
                    <p className="text-gray-600">{pengajuan.jenis_izin}</p>
                  </div>
                  <div>
                    <span className="font-medium">Alasan:</span>
                    <p className="text-gray-600">{pengajuan.alasan}</p>
                  </div>
                  {pengajuan.catatan_guru && (
                    <div>
                      <span className="font-medium">Catatan Guru:</span>
                      <p className="text-gray-600">{pengajuan.catatan_guru}</p>
                    </div>
                  )}
                </div>

                {pengajuan.status_persetujuan === 'pending' && (
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Setujui
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Setujui Pengajuan Izin</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-600 mb-2">Pengajuan dari: <strong>{pengajuan.nama_siswa}</strong></p>
                            <p className="text-sm text-gray-600">Jenis: {pengajuan.jenis_izin}</p>
                            <p className="text-sm text-gray-600">Periode: {new Date(pengajuan.tanggal_mulai).toLocaleDateString('id-ID')} - {new Date(pengajuan.tanggal_selesai).toLocaleDateString('id-ID')}</p>
                          </div>
                          <Textarea 
                            placeholder="Catatan persetujuan (opsional)" 
                            id={`approve-note-${pengajuan.id}`}
                          />
                          <Button 
                            onClick={() => {
                              const textarea = document.getElementById(`approve-note-${pengajuan.id}`) as HTMLTextAreaElement;
                              handleApprovePengajuan(pengajuan.id, 'disetujui', textarea.value);
                            }}
                            className="w-full bg-green-600 hover:bg-green-700"
                          >
                            Setujui Pengajuan Izin
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
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Tolak Pengajuan Izin</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-600 mb-2">Pengajuan dari: <strong>{pengajuan.nama_siswa}</strong></p>
                            <p className="text-sm text-gray-600">Jenis: {pengajuan.jenis_izin}</p>
                          </div>
                          <Textarea 
                            placeholder="Alasan penolakan (wajib)" 
                            id={`reject-note-${pengajuan.id}`}
                            required
                          />
                          <Button 
                            onClick={() => {
                              const textarea = document.getElementById(`reject-note-${pengajuan.id}`) as HTMLTextAreaElement;
                              if (textarea.value.trim()) {
                                handleApprovePengajuan(pengajuan.id, 'ditolak', textarea.value);
                              } else {
                                toast({ title: "Error", description: "Alasan penolakan harus diisi", variant: "destructive" });
                              }
                            }}
                            variant="destructive"
                            className="w-full"
                          >
                            Tolak Pengajuan Izin
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Banding Absen View for Teachers - to process student attendance appeals
const BandingAbsenView = ({ user }: { user: TeacherDashboardProps['userData'] }) => {
  const [bandingList, setBandingList] = useState<BandingAbsenTeacher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBandingAbsen = async () => {
      try {
        setLoading(true);
        // Fetch banding absen for this teacher to process
        const response = await apiCall(`/api/guru/${user.guru_id || user.id}/banding-absen`);
        setBandingList(Array.isArray(response) ? response : (response.data || []));
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
  }, [user.guru_id, user.id]);

  const handleBandingResponse = async (bandingId: number, status: 'disetujui' | 'ditolak', catatan: string = '') => {
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
      
      // Refresh the list
      setBandingList(prev => prev.map(b => 
        b.id_banding === bandingId 
          ? { ...b, status_banding: status, catatan_guru: catatan, diproses_oleh: user.guru_id || user.id }
          : b
      ));
    } catch (error) {
      console.error('Error responding to banding absen:', error);
      toast({ 
        title: "Error", 
        description: (error as Error).message, 
        variant: "destructive" 
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Pengajuan Banding Absen
        </CardTitle>
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
          <div className="space-y-4">
            {bandingList.map((banding) => (
              <div key={banding.id_banding} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{banding.nama_siswa}</h4>
                    <p className="text-sm text-gray-600">
                      NIS: {banding.nis} - Kelas: {banding.nama_kelas}
                    </p>
                    <p className="text-xs text-gray-500">
                      Diajukan: {formatDateTime24(banding.tanggal_pengajuan, true)}
                    </p>
                  </div>
                  <Badge 
                    variant={
                      banding.status_banding === 'disetujui' ? 'default' : 
                      banding.status_banding === 'ditolak' ? 'destructive' : 'secondary'
                    }
                  >
                    {banding.status_banding === 'pending' ? 'Menunggu Proses' :
                     banding.status_banding === 'disetujui' ? 'Disetujui' : 'Ditolak'}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Tanggal Absen:</span>
                      <p className="text-gray-600">{new Date(banding.tanggal_absen).toLocaleDateString('id-ID')}</p>
                    </div>
                    <div>
                      <span className="font-medium">Mata Pelajaran:</span>
                      <p className="text-gray-600">{banding.nama_mapel}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Status Tercatat:</span>
                      <Badge variant="outline" className="capitalize ml-2">
                        {banding.status_asli}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">Status Diajukan:</span>
                      <Badge variant="outline" className="capitalize ml-2">
                        {banding.status_diajukan}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Alasan Banding:</span>
                    <p className="text-gray-600">{banding.alasan_banding}</p>
                  </div>
                  {banding.catatan_guru && (
                    <div>
                      <span className="font-medium">Catatan Guru:</span>
                      <p className="text-gray-600">{banding.catatan_guru}</p>
                    </div>
                  )}
                </div>

                {banding.status_banding === 'pending' && (
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="w-4 w-4 mr-1" />
                          Setujui
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Setujui Banding Absen</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-600 mb-2">Banding dari: <strong>{banding.nama_siswa}</strong></p>
                            <p className="text-sm text-gray-600">Status: {banding.status_asli} → {banding.status_diajukan}</p>
                            <p className="text-sm text-gray-600">Tanggal: {new Date(banding.tanggal_absen).toLocaleDateString('id-ID')}</p>
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
                      <DialogContent>
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
                )}
              </div>
            ))}
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

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        // Gunakan endpoint baru: /api/guru/student-attendance-history
        const res = await apiCall(`/api/guru/student-attendance-history`);
        console.log('📊 Raw response from API:', res);
        const flat: Array<FlatHistoryRow>
          = Array.isArray(res) ? res : (res.data || []);
        console.log('📊 Flattened data:', flat);

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
          console.log('📊 Processing row:', row);
          const dateKey = new Date(row.tanggal).toISOString().split('T')[0];
          if (!grouped[dateKey]) grouped[dateKey] = {};
          const classKey = `${row.nama_mapel} - ${row.nama_kelas}`;
          if (!grouped[dateKey][classKey]) {
            grouped[dateKey][classKey] = {
              kelas: row.nama_kelas,
              mata_pelajaran: row.nama_mapel,
              jam: `${row.jam_mulai} - ${row.jam_selesai}`,
              hari: new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date(row.tanggal)),
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

        console.log('📊 Grouped data:', grouped);
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
  }, [user.guru_id, user.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Riwayat Absensi
        </CardTitle>
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
                  {new Date(date).toLocaleDateString('id-ID', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h4>
                <div className="space-y-3">
                  {Object.values(classes).map((classData, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h5 className="font-medium">{classData.mata_pelajaran}</h5>
                          <p className="text-sm text-gray-600">{classData.kelas}</p>
                          <p className="text-xs text-gray-500">{classData.jam}</p>
                        </div>
                        <Badge variant="outline">{classData.siswa.length} siswa</Badge>
                      </div>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Waktu</TableHead>
                            <TableHead>Keterangan</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {console.log('📊 Rendering siswa for class:', classData.mata_pelajaran, 'siswa count:', classData.siswa.length)}
                          {classData.siswa.map((siswa, siswaIndex) => {
                            console.log('📊 Rendering siswa:', siswaIndex, siswa);
                            return (
                              <TableRow key={siswaIndex}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{siswa.nama || 'Nama tidak tersedia'}</p>
                                  {siswa.nis && (
                                    <p className="text-xs text-gray-500">NIS: {siswa.nis}</p>
                                  )}
                                </div>
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
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main TeacherDashboard Component
export const TeacherDashboard = ({ userData, onLogout }: TeacherDashboardProps) => {
  const [activeView, setActiveView] = useState<'schedule' | 'history' | 'pengajuan-izin' | 'banding-absen' | 'reports'>('schedule');
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const user = userData;

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    if (!user.guru_id && !user.id) return;
    try {
      setIsLoading(true);
      // Gunakan endpoint backend yang tersedia: /api/guru/jadwal (auth user diambil dari token)
      const res = await apiCall(`/api/guru/jadwal`);
      const list: Schedule[] = Array.isArray(res) ? res : (res.data || []);

      // Filter hanya jadwal hari ini dan hitung status berdasar waktu sekarang
      const todayName = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date());
      const todayList = (list as RawSchedule[]).filter((s) => (s.hari || '').toLowerCase() === todayName.toLowerCase());

      const now = new Date();
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
            variant={activeView === 'pengajuan-izin' ? "default" : "ghost"}
            className={`w-full justify-start ${sidebarOpen || window.innerWidth >= 1024 ? '' : 'px-2'}`}
            onClick={() => {setActiveView('pengajuan-izin'); setSidebarOpen(false);}}
          >
            <FileText className="h-4 w-4" />
            {(sidebarOpen || window.innerWidth >= 1024) && <span className="ml-2">Pengajuan Izin</span>}
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
              <p className="text-gray-600 mt-2">Selamat datang, {user.username}!</p>
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
          ) : activeView === 'pengajuan-izin' ? (
            <PengajuanIzinView user={user} />
          ) : activeView === 'banding-absen' ? (
            <BandingAbsenView user={user} />
          ) : activeView === 'reports' ? (
            <TeacherReportsView user={user} />
          ) : (
            <HistoryView user={user} />
          )}
        </div>
      </div>
      
      {/* Floating Font Size Control for Mobile */}
      <FontSizeControl variant="floating" className="lg:hidden" />
    </div>
  );
};
