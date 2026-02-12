import React, { useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeInput } from "@/components/ui/time-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getWIBTime } from "@/lib/time-utils";
import { JadwalService } from "@/services/jadwalService";
import { getActivityTypeLabel } from '@/utils/statusMaps';
import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { Teacher, Subject, Kelas, Schedule, Room } from '@/types/dashboard';
import {
  Users,
  Calendar,
  Search,
  Trash2,
  Edit,
  Download,
  ArrowLeft,
  LayoutGrid,
  Eye,
} from "lucide-react";

const ExcelImportView = React.lazy(() => import('../../ExcelImportView'));
const PreviewJadwalView = React.lazy(() => import('./PreviewJadwalView').then(module => ({ default: module.PreviewJadwalView })));
const ScheduleGridTable = React.lazy(() => import('./ScheduleGridTable').then(module => ({ default: module.ScheduleGridTable })));

/**
 * Helper component for displaying teacher badges (S3358 - extracted to reduce nested ternary)
 */
const TeacherBadgeDisplay = ({ guruList, namaGuru }: { guruList?: string; namaGuru?: string }) => {
  // Case 1: Multi-guru with || separator
  if (guruList?.includes('||')) {
    return (
      <>
        {guruList.split('||').map((guru) => {
          const guruId = guru.split(':')[0];
          return (
            <Badge key={`guru-${guruId}`} variant="outline" className="text-xs bg-blue-500/15 text-blue-700 dark:text-blue-400 border-0">
              {guru.split(':')[1]}
            </Badge>
          );
        })}
      </>
    );
  }
  // Case 2: Multiple teachers comma-separated
  if (namaGuru?.includes(',')) {
    return (
      <>
        {namaGuru.split(',').map((guru) => {
          const trimmedName = guru.trim();
          return (
            <Badge key={`name-${trimmedName}`} variant="outline" className="text-xs bg-blue-500/15 text-blue-700 dark:text-blue-400 border-0">
              {trimmedName}
            </Badge>
          );
        })}
      </>
    );
  }
  // Case 3: Single teacher
  if (namaGuru) {
    return (
      <Badge variant="outline" className="text-xs bg-blue-500/15 text-blue-700 dark:text-blue-400 border-0">
        {namaGuru}
      </Badge>
    );
  }
  // Case 4: No teacher
  return (
    <Badge variant="secondary" className="text-xs">
      Belum ada guru
    </Badge>
  );
};

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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  
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
    const matchesSearch = !searchTerm || 
      schedule.nama_kelas?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.nama_mapel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.nama_guru?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.nama_ruang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.keterangan_khusus?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesKelas = searchFilter.kelas === 'all' || 
      schedule.kelas_id.toString() === searchFilter.kelas;

    const matchesHari = searchFilter.hari === 'all' || 
      schedule.hari === searchFilter.hari;

    const matchesJenis = searchFilter.jenis === 'all' || 
      schedule.jenis_aktivitas === searchFilter.jenis;

    const matchesGuru = searchFilter.guru === 'all' || 
      schedule.guru_id?.toString() === searchFilter.guru;

    return matchesSearch && matchesKelas && matchesHari && matchesJenis && matchesGuru;
  });

  // Fetch all necessary data with better error handling
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        
        const [schedulesData, teachersData, subjectsData, classesData, roomsData] = await Promise.all([
          apiCall('/api/admin/jadwal', { onLogout }).catch(() => {
            return [];
          }),
          apiCall('/api/admin/guru', { onLogout }).then(response => {
            return response;
          }).catch(() => {
            return [];
          }),
          apiCall('/api/admin/mapel', { onLogout }).catch(() => {
            return [];
          }),
          apiCall('/api/admin/classes', { onLogout }).catch(() => {
            return [];
          }),
          apiCall('/api/admin/ruang', { onLogout }).catch(() => {
            return [];
          })
        ]);
        
        setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
        let normalizedTeachers: Teacher[] = [];
        if (Array.isArray(teachersData?.data)) {
          normalizedTeachers = teachersData.data;
        } else if (Array.isArray(teachersData)) {
          normalizedTeachers = teachersData;
        }
        setTeachers(normalizedTeachers);
        setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
        setClasses(Array.isArray(classesData) ? classesData : []);
        setRooms(Array.isArray(roomsData) ? roomsData : []);
        
       } catch (error) {
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

  const refreshSchedules = async () => {
    try {
      const data = await JadwalService.getJadwal('admin');
      setSchedules(Array.isArray(data) ? data : []);
     } catch (error) {
       try {
         const data = await apiCall('/api/admin/jadwal', { onLogout });
         setSchedules(Array.isArray(data) ? data : []);
       } catch (fallbackError) {
         console.error('ManageSchedulesView: Failed to load schedules', fallbackError);
       }
     }
  };

  const generateTimeSlots = (startTime: string, endTime: string, startJamKe: number, hours: number) => {
    const slots = [];
    
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const currentTime = getWIBTime();
    currentTime.setHours(startHour, startMinute, 0, 0);
    
    let duration = 40;
    if (endTime && hours === 1) {
      const [endHour, endMinute] = endTime.split(':').map(Number);
      const endTimeObj = getWIBTime();
      endTimeObj.setHours(endHour, endMinute, 0, 0);
      duration = (endTimeObj.getTime() - currentTime.getTime()) / (1000 * 60);
    }

    for (let i = 0; i < hours; i++) {
      const jamMulai = currentTime.toTimeString().slice(0, 5);
      currentTime.setMinutes(currentTime.getMinutes() + duration);
      const jamSelesai = currentTime.toTimeString().slice(0, 5);
      
      slots.push({
        jam_ke: startJamKe + i,
        jam_mulai: jamMulai,
        jam_selesai: jamSelesai
      });
      
      if (i < hours - 1) {
        currentTime.setMinutes(currentTime.getMinutes() + 5);
      }
    }
    
    return slots;
  };

  const validateJadwalForm = (data: Record<string, string | number | number[] | boolean>, hours: number) => {
    const errors: string[] = [];
    
    if (!data.jam_ke || Number.isNaN(Number.parseInt(String(data.jam_ke)))) {
      errors.push('Jam ke- harus diisi dengan angka');
    } else {
      const jamKe = Number.parseInt(String(data.jam_ke));
      if (jamKe < 1 || jamKe > 12) {
        errors.push('Jam ke- harus antara 1-12');
      }
    }
    
    if (data.jam_mulai && data.jam_selesai) {
      const start = new Date(`2000-01-01T${data.jam_mulai}`);
      const end = new Date(`2000-01-01T${data.jam_selesai}`);
      if (start >= end) {
        errors.push('Jam selesai harus lebih besar dari jam mulai');
      }
    }
    
    if (hours < 1 || hours > 6) {
      errors.push('Jumlah jam berurutan harus antara 1-6');
    }
    
    if (!data.kelas_id) errors.push('Kelas harus dipilih');
    if (!data.hari) errors.push('Hari harus dipilih');
    if (!data.jam_mulai) errors.push('Jam mulai harus diisi');
    if (!data.jam_selesai) errors.push('Jam selesai harus diisi');
    
    return errors;
  };

  const getValidGuruIds = (ids: number[]): number[] => ids.filter(id => id && !Number.isNaN(id) && id > 0);

  const buildJadwalPayload = (form: typeof formData, validGuruIds: number[], slot?: { jam_mulai: string; jam_selesai: string; jam_ke: number }) => ({
    kelas_id: Number.parseInt(form.kelas_id),
    mapel_id: form.jenis_aktivitas === 'pelajaran' ? Number.parseInt(form.mapel_id) : null,
    guru_id: form.jenis_aktivitas === 'pelajaran' && validGuruIds.length > 0 ? validGuruIds[0] : null,
    guru_ids: form.jenis_aktivitas === 'pelajaran' ? validGuruIds : [],
    ruang_id: form.ruang_id && form.ruang_id !== 'none' ? Number.parseInt(form.ruang_id) : null,
    hari: form.hari,
    jam_mulai: slot?.jam_mulai || form.jam_mulai,
    jam_selesai: slot?.jam_selesai || form.jam_selesai,
    jam_ke: slot?.jam_ke || Number.parseInt(form.jam_ke),
    jenis_aktivitas: form.jenis_aktivitas,
    is_absenable: form.jenis_aktivitas === 'pelajaran',
    keterangan_khusus: form.keterangan_khusus || null
  });

  const resetForm = () => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      const validGuruIds = getValidGuruIds(formData.guru_ids);
      if (formData.jenis_aktivitas === 'pelajaran' && validGuruIds.length === 0) {
        toast({
          title: "Error",
          description: "Minimal satu guru harus dipilih untuk jadwal pelajaran"
        });
        setIsLoading(false);
        return;
      }
      
      if (editingId) {
        await apiCall(`/api/admin/jadwal/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(buildJadwalPayload(formData, validGuruIds)),
          onLogout
      });

        toast({
          title: "Berhasil",
          description: "Jadwal berhasil diperbarui"
        });
      } else {
        const timeSlots = generateTimeSlots(
          formData.jam_mulai,
          formData.jam_selesai,
          Number.parseInt(formData.jam_ke),
          consecutiveHours
        );

        for (const slot of timeSlots) {
          await apiCall('/api/admin/jadwal', {
            method: 'POST',
            body: JSON.stringify(buildJadwalPayload(formData, validGuruIds, slot)),
            onLogout
        });
        }

        toast({
          title: "Berhasil",
          description: `${consecutiveHours} jam pelajaran berhasil ditambahkan`
        });
      }

      resetForm();
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
    let guru_ids: number[] = [];
    if (schedule.guru_list) {
      guru_ids = schedule.guru_list.split('||').map(guru => Number.parseInt(guru.split(':')[0]));
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

  const handleRemoveSelectedGuru = (guruIdToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      guru_ids: prev.guru_ids.filter(id => id !== guruIdToRemove),
      guru_id: prev.guru_ids.length === 1 ? '' : prev.guru_id
    }));
  };

  const handleAddSelectedGuru = (guruId: string) => {
    if (guruId && !formData.guru_ids.includes(Number.parseInt(guruId))) {
      setFormData(prev => ({
        ...prev,
        guru_ids: [...prev.guru_ids, Number.parseInt(guruId)],
        guru_id: prev.guru_ids.length === 0 ? guruId : prev.guru_id
      }));
    }
  };

  if (showImport) {
    return <ExcelImportView entityType="jadwal" entityName="Jadwal Pelajaran" onBack={() => setShowImport(false)} />;
  }

  if (showPreview) {
    return <PreviewJadwalView onBack={() => setShowPreview(false)} schedules={schedules} classes={classes} />;
  }

  if (viewMode === 'grid') {
    return (
      <ScheduleGridTable 
        onBack={() => setViewMode('list')}
        onLogout={onLogout}
        teachers={teachers}
        subjects={subjects}
        rooms={rooms}
        classes={classes}
      />
    );
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
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Kelola Jadwal</h1>
            <p className="text-sm text-muted-foreground">Atur jadwal pelajaran untuk setiap kelas</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setViewMode('grid')} variant="outline" size="sm" className="text-xs">
            <LayoutGrid className="w-3 h-3 mr-1" />
            Grid Jadwal
          </Button>
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
                  <Select                        value={formData.mapel_id} 
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
                          <div key={`selected-guru-${guruId}-${index}`} className="flex items-center gap-1 bg-blue-500/15 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-md text-sm">
                            <span>{teacher.nama}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSelectedGuru(guruId)}
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
                      onValueChange={handleAddSelectedGuru}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih guru (bisa lebih dari 1)" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
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
                    <p className="text-xs text-muted-foreground">
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
                <p className="text-xs text-muted-foreground mt-1">Format: HH:MM (24 jam) - Contoh: 08:30, 14:15</p>
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
                <p className="text-xs text-muted-foreground mt-1">Format: HH:MM (24 jam) - Contoh: 08:30, 14:15</p>
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
                  onValueChange={(value) => setConsecutiveHours(Number.parseInt(value))}
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
                {(() => {
                  if (isLoading) return 'Processing...';
                  if (editingId) return 'Update Jadwal';
                  return `Tambah ${consecutiveHours} Jam Pelajaran`;
                })()}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm} className="text-sm">
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
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Cari jadwal..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
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
          <div className="mb-3 text-sm text-muted-foreground">
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
          
          {(() => {
            if (schedules.length === 0) {
              return (
            <div className="text-center py-6">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Belum ada jadwal</p>
            </div>
              );
            }
            if (filteredSchedules.length === 0) {
              return (
            <div className="text-center py-6">
              <Search className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Tidak ada jadwal yang sesuai dengan filter</p>
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
              );
            }
            return (
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
                        {schedule.jenis_aktivitas === 'pelajaran' ? (
                          <Badge variant="default" className="text-xs">
                            Pelajaran
                          </Badge>
                        ) : (() => {
                          const activityMap: Record<string, string> = {
                            upacara: 'Upacara',
                            istirahat: 'Istirahat',
                            kegiatan_khusus: 'Kegiatan Khusus',
                            libur: 'Libur',
                            ujian: 'Ujian'
                          };
                          return (
                            <Badge variant="secondary" className="text-xs">
                              {activityMap[schedule.jenis_aktivitas] || schedule.jenis_aktivitas}
                            </Badge>
                          );
                        })()}
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
                            <div className="flex flex-wrap gap-1">
                              <TeacherBadgeDisplay guruList={schedule.guru_list} namaGuru={schedule.nama_guru} />
                            </div>
                            
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
                            Absen
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                            Tidak Absen
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
                        <p className="text-xs text-muted-foreground">{schedule.hari} - {schedule.jam_mulai} - {schedule.jam_selesai}</p>
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
                        <span className="text-muted-foreground">Jenis:</span>
                        <div className="mt-1">
                          <Badge 
                            variant={schedule.jenis_aktivitas === 'pelajaran' ? 'default' : 'secondary'} 
                            className="text-xs"
                          >
                            {getActivityTypeLabel(schedule.jenis_aktivitas)}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <div className="mt-1">
                          <Badge 
                            variant={schedule.is_absenable ? 'default' : 'secondary'}
                            className={`text-xs ${schedule.is_absenable ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}
                          >
                            {schedule.is_absenable ? 'Aktif' : 'Non-aktif'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs">
                      <span className="text-muted-foreground">Mata Pelajaran/Guru:</span>
                      <div className="mt-1">
                        {schedule.jenis_aktivitas === 'pelajaran' ? (
                          <div className="space-y-1">
                            <div className="font-medium">{schedule.nama_mapel || '-'}</div>
                            <div className="flex flex-wrap gap-1">
                              <TeacherBadgeDisplay guruList={schedule.guru_list} namaGuru={schedule.nama_guru} />
                            </div>
                            
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
                        <span className="text-muted-foreground">Ruang:</span>
                        <p className="mt-1 font-medium">{schedule.nama_ruang}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            </>
            );
          })()}
        </Card>
      </div>
    </div>
  );
};

export default ManageSchedulesView;
