/**
 * AttendanceView - Component for taking student attendance
 * Extracted from TeacherDashboard_Modern.tsx
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { formatTime24, formatDateOnly, getCurrentDateWIB, formatDateWIB, getWIBTime } from "@/lib/time-utils";
import { ArrowLeft, Users, Calendar, Edit, XCircle } from "lucide-react";
import { Schedule, Student, AttendanceStatus, TeacherUserData } from "./types";
import { apiCall } from "./apiUtils";

interface AttendanceViewProps {
  schedule: Schedule;
  user: TeacherUserData;
  onBack: () => void;
}

export const AttendanceView = ({ schedule, user, onBack }: AttendanceViewProps) => {
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
  const [minDate] = useState<string>(() => {
    const wibNow = getWIBTime();
    const thirtyDaysAgo = new Date(wibNow.getTime() - 30 * 24 * 60 * 60 * 1000);
    return formatDateWIB(thirtyDaysAgo);
  });

  // Fetch students by date for edit mode
  const fetchStudentsByDate = async (tanggal: string) => {
    try {
      setLoading(true);
      const data = await apiCall(`/api/schedule/${schedule.id}/students-by-date?tanggal=${tanggal}`);
      setStudents(data);
      
      // Initialize attendance with existing data or default to 'Hadir'
      const initialAttendance: {[key: number]: AttendanceStatus} = {};
      const initialNotes: {[key: number]: string} = {};
      data.forEach((student: Student) => {
        initialAttendance[student.id] = (student.attendance_status as AttendanceStatus) || 'Hadir';
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

  useEffect(() => {
    // Fetch students for the class
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const data = await apiCall(`/api/schedule/${schedule.id}/students`);
        setStudents(data);
        
        // Initialize attendance with existing data or default to 'Hadir'
        const initialAttendance: {[key: number]: AttendanceStatus} = {};
        const initialNotes: {[key: number]: string} = {};
        data.forEach((student: Student) => {
          initialAttendance[student.id] = (student.attendance_status as AttendanceStatus) || 'Hadir';
          initialNotes[student.id] = student.attendance_note || '';
        });
        setAttendance(initialAttendance);
        setNotes(initialNotes);
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

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    if (!isEditMode) {
      setSelectedDate(getCurrentDateWIB());
    } else {
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
      const hasExistingAttendance = students.some(student => student.waktu_absen);
      
      if (!attendance || Object.keys(attendance).length === 0) {
        toast({ 
          title: "Error", 
          description: "Data absensi tidak boleh kosong", 
          variant: "destructive" 
        });
        return;
      }
      
      const missingAttendance = students.filter(student => !attendance[student.id]);
      if (missingAttendance.length > 0) {
        toast({ 
          title: "Error", 
          description: `Siswa ${missingAttendance.map(s => s.nama).join(', ')} belum diabsen`, 
          variant: "destructive" 
        });
        return;
      }
      
      const todayStr = getCurrentDateWIB();
      if (selectedDate > todayStr) {
        toast({ 
          title: "Error", 
          description: "Tidak dapat mengabsen untuk tanggal masa depan", 
          variant: "destructive" 
        });
        return;
      }
      
      const attendanceData: {[key: number]: { status: AttendanceStatus; terlambat: boolean; ada_tugas: boolean }} = {};
      Object.keys(attendance).forEach(studentId => {
        const studentIdNum = Number.parseInt(studentId);
        attendanceData[studentIdNum] = {
          status: attendance[studentIdNum],
          terlambat: terlambat[studentIdNum] || false,
          ada_tugas: adaTugas[studentIdNum] || false
        };
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

      let message = hasExistingAttendance 
        ? "Absensi berhasil diperbarui" 
        : "Absensi berhasil disimpan";
      
      if (response.isMultiGuru) {
        message += " - Semua guru lain otomatis ter-absensi dengan status yang sama";
      }
      
      toast({ 
        title: "Berhasil!", 
        description: message
      });
      
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
      {/* Header Section */}
      <div className="space-y-4">
        <Button onClick={onBack} variant="outline" className="w-full sm:w-auto">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Jadwal
        </Button>
        
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold">{isEditMode ? 'Edit Absensi Siswa' : 'Ambil Absensi'}</h2>
          <p className="text-sm sm:text-base text-gray-600 break-words">{schedule.nama_mapel} - {schedule.nama_kelas}</p>
          
          {schedule.kode_ruang && (
            <div className="text-sm text-blue-600">
              <Badge variant="outline" className="text-xs">
                {schedule.kode_ruang}
                {schedule.nama_ruang && ` - ${schedule.nama_ruang}`}
              </Badge>
            </div>
          )}
          
          <p className="text-xs sm:text-sm text-gray-500">{schedule.jam_mulai} - {schedule.jam_selesai}</p>
          
          {isEditMode && (
            <p className="text-xs sm:text-sm text-blue-600">
              Mengedit absensi untuk tanggal: {formatDateOnly(selectedDate)}
            </p>
          )}
        </div>
        
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
        
        {schedule.is_multi_guru && schedule.other_teachers && (
          <Alert className="mt-4">
            <Users className="h-4 w-4" />
            <AlertTitle className="text-sm sm:text-base">Jadwal Multi-Guru</AlertTitle>
            <AlertDescription className="text-xs sm:text-sm">
              Guru lain yang mengajar: {schedule.other_teachers.split('||').map(guru => guru.split(':')[1]).join(', ')}
              <br />
              <span className="text-xs text-green-600 font-medium">
                Auto-Absensi: Saat Anda input absensi, guru lain ikut terabsensi dengan status yang sama
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
