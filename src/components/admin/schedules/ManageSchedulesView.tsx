import React, { useMemo, useState, useEffect } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeInput } from "@/components/shared/time-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { toast } from "@/hooks/use-toast";
import { getWIBTime } from "@/lib/time-utils";
import { JadwalService } from "@/services/jadwalService";
import { getActivityTypeLabel } from '@/utils/statusMaps';
import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { Teacher, Subject, Kelas, Schedule, Room } from '@/types/dashboard';
import {
  Users,
  Calendar,
  Trash2,
  Edit,
  Download,
  LayoutGrid,
  Eye,
  Plus,
  CheckCircle2,
  XCircle,
  Activity,
  BookOpen,
  Clock,
  MapPin,
  MoreHorizontal,
} from "lucide-react";

const ExcelImportView = React.lazy(() => import('@/components/admin/ExcelImportView'));
const PreviewJadwalView = React.lazy(() => import('./PreviewJadwalView').then(module => ({ default: module.PreviewJadwalView })));
const ScheduleGridTable = React.lazy(() => import('./ScheduleGridTable').then(module => ({ default: module.ScheduleGridTable })));

const TeacherBadgeDisplay = ({ guruList, namaGuru }: { guruList?: string; namaGuru?: string }) => {
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
  if (namaGuru) {
    return (
      <Badge variant="outline" className="text-xs bg-blue-500/15 text-blue-700 dark:text-blue-400 border-0">
        {namaGuru}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      Belum ada guru
    </Badge>
  );
};

type StatusFilter = "semua" | "bisa_diabsen" | "tidak_bisa_diabsen";

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
      
      slots.push({ jam_ke: startJamKe + i, jam_mulai: jamMulai, jam_selesai: jamSelesai });
      
      if (i < hours - 1) {
        currentTime.setMinutes(currentTime.getMinutes() + 5);
      }
    }
    return slots;
  };

const getValidGuruIds = (ids: number[]): number[] => ids.filter(id => id && !Number.isNaN(id) && id > 0);

const buildJadwalPayload = (form: Record<string, string | number | boolean>, validGuruIds: number[], slot?: { jam_mulai: string; jam_selesai: string; jam_ke: number }) => ({
    kelas_id: Number.parseInt(String(form.kelas_id)),
    mapel_id: form.jenis_aktivitas === 'pelajaran' ? Number.parseInt(String(form.mapel_id)) : null,
    guru_id: form.jenis_aktivitas === 'pelajaran' && validGuruIds.length > 0 ? validGuruIds[0] : null,
    guru_ids: form.jenis_aktivitas === 'pelajaran' ? validGuruIds : [],
    ruang_id: form.ruang_id && form.ruang_id !== 'none' ? Number.parseInt(String(form.ruang_id)) : null,
    hari: form.hari,
    jam_mulai: slot?.jam_mulai || form.jam_mulai,
    jam_selesai: slot?.jam_selesai || form.jam_selesai,
    jam_ke: slot?.jam_ke || Number.parseInt(String(form.jam_ke)),
    jenis_aktivitas: form.jenis_aktivitas,
    is_absenable: form.is_absenable,
    keterangan_khusus: form.keterangan_khusus || null
  });

const ManageSchedulesView = ({ onLogout }: { onLogout: () => void }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [consecutiveHours, setConsecutiveHours] = useState(1);
  const [showImport, setShowImport] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua');

  const [searchFilter, setSearchFilter] = useState({
    kelas: 'all',
    hari: 'all',
    jenis: 'all',
    guru: 'all'
  });
  
  const [formData, setFormData] = useState({
    kelas_id: '',
    mapel_id: '',
    guru_id: '', 
    guru_ids: [] as number[],
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

  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        const [schedulesData, teachersData, subjectsData, classesData, roomsData] = await Promise.all([
          apiCall('/api/admin/jadwal', { onLogout }).catch((e) => { console.error(e); return []; }),
          apiCall('/api/admin/guru', { onLogout }).catch((e) => { console.error(e); return []; }),
          apiCall('/api/admin/mapel', { onLogout }).catch((e) => { console.error(e); return []; }),
          apiCall('/api/admin/classes', { onLogout }).catch((e) => { console.error(e); return []; }),
          apiCall('/api/admin/ruang', { onLogout }).catch((e) => { console.error(e); return []; })
        ]);
        
        setSchedules(Array.isArray(schedulesData) ? (schedulesData as unknown as Schedule[]) : []);
        let normalizedTeachers: Teacher[] = [];
        if (teachersData && typeof teachersData === 'object' && 'data' in teachersData && Array.isArray((teachersData as Record<string, unknown>).data)) {
          normalizedTeachers = (teachersData as Record<string, unknown>).data as Teacher[];
        } else if (Array.isArray(teachersData)) {
          normalizedTeachers = teachersData as Teacher[];
        }
        setTeachers(normalizedTeachers);
        setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
        setClasses(Array.isArray(classesData) ? classesData : []);
        setRooms(Array.isArray(roomsData) ? roomsData : []);
      } catch (error) {
        toast({ title: "Error", description: "Gagal memuat data", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, [onLogout]);

  const refreshSchedules = async () => {
    try {
      const data = await JadwalService.getJadwal('admin');
      setSchedules(Array.isArray(data) ? (data as unknown as Schedule[]) : []);
    } catch (error) {
      try {
        const data = await apiCall('/api/admin/jadwal', { onLogout });
        setSchedules(Array.isArray(data) ? (data as unknown as Schedule[]) : []);
      } catch (fallbackError) {
        console.error(fallbackError);
      }
    }
  };

  const stats = useMemo(() => {
    const total = schedules.length;
    const aktif = schedules.filter(s => s.is_absenable).length;
    const nonaktif = total - aktif;
    return { total, aktif, nonaktif };
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    let result = schedules;

    // Status filter
    if (statusFilter === 'bisa_diabsen') {
      result = result.filter(s => s.is_absenable);
    } else if (statusFilter === 'tidak_bisa_diabsen') {
      result = result.filter(s => !s.is_absenable);
    }

    // Advanced search filters
    result = result.filter(schedule => {
      const matchesSearch = !searchTerm || 
        schedule.nama_kelas?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.nama_mapel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.nama_guru?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.nama_ruang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.keterangan_khusus?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesKelas = searchFilter.kelas === 'all' || schedule.kelas_id.toString() === searchFilter.kelas;
      const matchesHari = searchFilter.hari === 'all' || schedule.hari === searchFilter.hari;
      const matchesJenis = searchFilter.jenis === 'all' || schedule.jenis_aktivitas === searchFilter.jenis;
      const matchesGuru = searchFilter.guru === 'all' || schedule.guru_id?.toString() === searchFilter.guru;

      return matchesSearch && matchesKelas && matchesHari && matchesJenis && matchesGuru;
    });

    return result;
  }, [schedules, searchTerm, searchFilter, statusFilter]);

  const openAddSheet = () => {
    setFormData({
      kelas_id: '', mapel_id: '', guru_id: '', guru_ids: [], ruang_id: 'none', hari: '', jam_mulai: '', jam_selesai: '', jam_ke: '', jenis_aktivitas: 'pelajaran', is_absenable: true, keterangan_khusus: ''
    });
    setEditingId(null);
    setConsecutiveHours(1);
    setSheetOpen(true);
  };

  const openEditSheet = (schedule: Schedule) => {
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
    setConsecutiveHours(1);
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.kelas_id || !formData.hari || !formData.jam_mulai || !formData.jam_selesai) {
      toast({ title: "Error Validasi", description: "Lengkapi semua field wajib", variant: "destructive" });
      return;
    }
    
    setIsSaving(true);
    try {
      const validGuruIds = getValidGuruIds(formData.guru_ids);
      if (formData.jenis_aktivitas === 'pelajaran' && validGuruIds.length === 0) {
        toast({ title: "Error", description: "Minimal satu guru harus dipilih untuk pelajaran", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      
      if (editingId) {
        await apiCall(`/api/admin/jadwal/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(buildJadwalPayload(formData, validGuruIds)),
          onLogout
        });
        toast({ title: "Berhasil", description: "Jadwal berhasil diperbarui" });
      } else {
        const timeSlots = generateTimeSlots(formData.jam_mulai, formData.jam_selesai, Number.parseInt(formData.jam_ke), consecutiveHours);
        for (const slot of timeSlots) {
          await apiCall('/api/admin/jadwal', {
            method: 'POST',
            body: JSON.stringify(buildJadwalPayload(formData, validGuruIds, slot)),
            onLogout
          });
        }
        toast({ title: "Berhasil", description: `${consecutiveHours} jam pelajaran ditambahkan` });
      }
      setSheetOpen(false);
      refreshSchedules();
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiCall(`/api/admin/jadwal/${id}`, { method: 'DELETE', onLogout });
      toast({ title: "Berhasil", description: "Jadwal berhasil dihapus" });
      refreshSchedules();
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleToggleAbsenable = async (schedule: Schedule) => {
    try {
      await apiCall(`/api/admin/jadwal/${schedule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...schedule,
          is_absenable: !schedule.is_absenable
        }),
        onLogout
      });
      toast({ title: "Status diperbarui", description: "Status absen jadwal berhasil diubah" });
      refreshSchedules();
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  // ── Column Definitions ──────────────────────────────────────────────────────
  const columns: ColumnDef<Schedule>[] = useMemo(() => [
    {
      accessorKey: 'nama_kelas',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kelas" />
      ),
      cell: ({ row }) => (
        <span className="font-medium text-xs">{row.original.nama_kelas}</span>
      ),
    },
    {
      accessorKey: 'hari',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Hari" />
      ),
      cell: ({ row }) => (
        <div className="text-xs">
          <span>{row.original.hari}</span>
          <br />
          <span className="text-muted-foreground">Jam ke-{row.original.jam_ke}</span>
        </div>
      ),
    },
    {
      accessorKey: 'jam_mulai',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Jam" />
      ),
      cell: ({ row }) => (
        <span className="text-xs font-mono">
          {row.original.jam_mulai} - {row.original.jam_selesai}
        </span>
      ),
    },
    {
      accessorKey: 'nama_mapel',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Mata Pelajaran" />
      ),
      cell: ({ row }) => {
        const schedule = row.original;
        return (
          <div className="text-xs">
            <Badge
              variant={schedule.jenis_aktivitas === 'pelajaran' ? 'default' : 'secondary'}
              className="text-[10px] mb-1"
            >
              {getActivityTypeLabel(schedule.jenis_aktivitas)}
            </Badge>
            <div className="text-muted-foreground">
              {schedule.jenis_aktivitas === 'pelajaran'
                ? (schedule.nama_mapel || '-')
                : (schedule.keterangan_khusus || '-')}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'nama_guru',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Guru" />
      ),
      cell: ({ row }) => {
        const schedule = row.original;
        if (schedule.jenis_aktivitas !== 'pelajaran') return <span className="text-xs">-</span>;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap gap-1">
              <TeacherBadgeDisplay guruList={schedule.guru_list} namaGuru={schedule.nama_guru} />
            </div>
            {schedule.is_multi_guru && (
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> Multi
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'kode_ruang',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ruang" />
      ),
      cell: ({ row }) => (
        <span className="text-xs">{row.original.kode_ruang || '-'}</span>
      ),
    },
    {
      accessorKey: 'jenis_aktivitas',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Jenis" />
      ),
      cell: ({ row }) => (
        <Badge
          variant={row.original.jenis_aktivitas === 'pelajaran' ? 'default' : 'secondary'}
          className="text-[10px]"
        >
          {getActivityTypeLabel(row.original.jenis_aktivitas)}
        </Badge>
      ),
    },
    {
      accessorKey: 'is_absenable',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const schedule = row.original;
        return (
          <button onClick={() => handleToggleAbsenable(schedule)} className="cursor-pointer">
            <Badge
              variant={schedule.is_absenable ? 'default' : 'outline'}
              className={`text-[10px] hover:opacity-80 ${schedule.is_absenable ? 'bg-emerald-500/15 text-emerald-700' : 'text-orange-600 border-orange-200'}`}
            >
              {schedule.is_absenable ? 'Bisa Diabsen' : 'Tidak Absen'}
            </Badge>
          </button>
        );
      },
    },
    {
      id: 'aksi',
      header: () => <div className="text-right text-xs">Aksi</div>,
      cell: ({ row }) => {
        const schedule = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Buka menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditSheet(schedule)}>
                  <Edit className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Hapus
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus Jadwal</AlertDialogTitle>
                      <AlertDialogDescription>Apakah Anda yakin ingin menghapus jadwal ini?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(schedule.id)} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [teachers, handleToggleAbsenable, handleDelete, openEditSheet]);

  // ── Toolbar Content ─────────────────────────────────────────────────────────
  const toolbarContent = (
    <div className="flex flex-col sm:flex-row gap-2 flex-1">
      <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
        <Button
          variant={statusFilter === "semua" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("semua")}
          className="text-xs h-9 px-3 whitespace-nowrap"
        >
          Semua
        </Button>
        <Button
          variant={statusFilter === "bisa_diabsen" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("bisa_diabsen")}
          className="text-xs h-9 px-3 whitespace-nowrap"
        >
          Bisa Diabsen
        </Button>
        <Button
          variant={statusFilter === "tidak_bisa_diabsen" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("tidak_bisa_diabsen")}
          className="text-xs h-9 px-3 whitespace-nowrap"
        >
          Tidak Bisa Diabsen
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Select value={searchFilter.kelas} onValueChange={(v) => setSearchFilter({ ...searchFilter, kelas: v })}>
          <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {classes.map((k) => <SelectItem key={k.id} value={k.id.toString()}>{k.nama_kelas}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={searchFilter.hari} onValueChange={(v) => setSearchFilter({ ...searchFilter, hari: v })}>
          <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Hari" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Hari</SelectItem>
            {daysOfWeek.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={searchFilter.jenis} onValueChange={(v) => setSearchFilter({ ...searchFilter, jenis: v })}>
          <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Jenis" /></SelectTrigger>
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
        <Select value={searchFilter.guru} onValueChange={(v) => setSearchFilter({ ...searchFilter, guru: v })}>
          <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Guru" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Guru</SelectItem>
            {teachers.map((t) => <SelectItem key={t.id} value={t.id.toString()}>{t.nama}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  // ── Mobile Row Renderer ─────────────────────────────────────────────────────
  const renderMobileRow = (schedule: Schedule) => (
    <div key={schedule.id} className="p-4">
      <div className="flex justify-between mb-2">
        <div>
          <h3 className="font-medium text-sm">{schedule.nama_kelas}</h3>
          <p className="text-xs text-muted-foreground">{schedule.hari} • Jam ke-{schedule.jam_ke} • {schedule.jam_mulai}-{schedule.jam_selesai}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => openEditSheet(schedule)} className="h-7 w-7 p-0">
            <Edit className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus Jadwal</AlertDialogTitle>
                <AlertDialogDescription>Yakin ingin menghapus jadwal ini?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(schedule.id)} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">Jenis:</span> <Badge variant="secondary" className="text-[10px] ml-1">{getActivityTypeLabel(schedule.jenis_aktivitas)}</Badge></div>
        <div>
          <span className="text-muted-foreground">Status:</span>
          <button onClick={() => handleToggleAbsenable(schedule)} className="ml-1 cursor-pointer">
            <Badge variant={schedule.is_absenable ? 'default' : 'outline'} className={`text-[10px] ${schedule.is_absenable ? 'bg-emerald-500/15 text-emerald-700' : 'text-orange-600 border-orange-200'}`}>
              {schedule.is_absenable ? 'Absen' : 'Tidak Absen'}
            </Badge>
          </button>
        </div>
      </div>
      <div className="mt-2 text-xs">
        <span className="text-muted-foreground">Info:</span>{' '}
        <span className="ml-1 font-medium">
          {schedule.jenis_aktivitas === 'pelajaran' ? schedule.nama_mapel : schedule.keterangan_khusus}
        </span>
      </div>
    </div>
  );

  // ── Early Returns ────────────────────────────────────────────────────────────
  if (showImport) {
    return <ExcelImportView entityType="jadwal" entityName="Jadwal Pelajaran" onBack={() => { setShowImport(false); refreshSchedules(); }} />;
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Kelola Jadwal</h2>
          <p className="text-sm text-muted-foreground">Atur jadwal pelajaran untuk setiap kelas</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Button onClick={openAddSheet} size="sm" className="text-xs">
            <Plus className="w-3 h-3 mr-1" />
            Tambah Jadwal
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={`stat-skeleton-${i}`}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-7 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium">Total Jadwal</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Bisa Diabsen</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.aktif}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Tidak Bisa Diabsen</span>
              </div>
              <p className="text-2xl font-bold text-red-500">{stats.nonaktif}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredSchedules}
        isLoading={isLoading}
        searchPlaceholder="Cari kelas, mapel, guru, atau ruang..."
        globalFilter={searchTerm}
        onGlobalFilterChange={setSearchTerm}
        toolbarContent={toolbarContent}
        renderMobileRow={renderMobileRow}
        emptyIcon={<Calendar className="w-12 h-12 text-muted-foreground/40" />}
        emptyTitle="Belum Ada Jadwal"
        emptyDescription="Tidak ada jadwal yang sesuai dengan filter yang dipilih."
        emptyAction={
          <Button onClick={openAddSheet} size="sm">
            <Plus className="w-3 h-3 mr-1" />
            Tambah Jadwal
          </Button>
        }
        pageSizeOptions={[10, 15, 20, 30, 50]}
      />

      {/* Add/Edit Sheet (Sidebar) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto w-[90vw]">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Jadwal" : "Tambah Jadwal"}</SheetTitle>
            <SheetDescription>
              {editingId ? "Perbarui informasi jadwal pelajaran" : "Tambahkan jadwal pelajaran baru"}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-6 pb-6">
            
            {/* Section 1: Informasi Aktivitas */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Informasi Aktivitas</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-sm font-medium">Jenis Aktivitas <span className="text-destructive">*</span></Label>
                  <Select 
                    value={formData.jenis_aktivitas} 
                    onValueChange={(value) => {
                      const newJenis = value;
                      setFormData({
                        ...formData, jenis_aktivitas: newJenis, is_absenable: newJenis === 'pelajaran',
                        mapel_id: newJenis === 'pelajaran' ? formData.mapel_id : '',
                        guru_ids: newJenis === 'pelajaran' ? formData.guru_ids : []
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pilih Jenis" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pelajaran">Pelajaran</SelectItem>
                      <SelectItem value="upacara">Upacara</SelectItem>
                      <SelectItem value="istirahat">Istirahat</SelectItem>
                      <SelectItem value="kegiatan_khusus">Kegiatan Khusus</SelectItem>
                      <SelectItem value="libur">Libur</SelectItem>
                      <SelectItem value="ujian">Ujian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-1">
                  <Label className="text-sm font-medium">Kelas <span className="text-destructive">*</span></Label>
                  <Select value={formData.kelas_id} onValueChange={(v) => setFormData({...formData, kelas_id: v})}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pilih" /></SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nama_kelas}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-1">
                  <Label className="text-sm font-medium">Ruang <span className="text-muted-foreground font-normal">(Opsional)</span></Label>
                  <Select value={formData.ruang_id} onValueChange={(v) => setFormData({...formData, ruang_id: v})}>
                    <SelectTrigger className="mt-1.5 pl-8 relative">
                      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak Ada</SelectItem>
                      {rooms.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.kode_ruang}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section 2: Detail Aktivitas */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Detail Aktivitas</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {formData.jenis_aktivitas === 'pelajaran' ? (
                  <>
                    <div>
                      <Label className="text-sm font-medium">Mata Pelajaran <span className="text-destructive">*</span></Label>
                      <Select value={formData.mapel_id} onValueChange={(v) => setFormData({...formData, mapel_id: v})}>
                        <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
                        <SelectContent>
                          {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.nama_mapel}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Guru Pengajar <span className="text-destructive">*</span></Label>
                      <Select value="" onValueChange={(v) => {
                        if (v && !formData.guru_ids.includes(Number(v))) {
                          setFormData(prev => ({...prev, guru_ids: [...prev.guru_ids, Number(v)]}));
                        }
                      }}>
                        <SelectTrigger className="mt-1.5"><SelectValue placeholder="Tambah Guru..." /></SelectTrigger>
                        <SelectContent>
                          {teachers.filter(t => t.id && !formData.guru_ids.includes(t.id)).map(t => (
                            <SelectItem key={t.id} value={t.id.toString()}>{t.nama}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {formData.guru_ids.map(id => {
                          const t = teachers.find(x => x.id === id);
                          return t ? (
                            <Badge key={id} variant="secondary" className="text-xs">
                              {t.nama} <button type="button" className="ml-1 text-destructive hover:font-bold" onClick={() => setFormData(prev => ({...prev, guru_ids: prev.guru_ids.filter(gid => gid !== id)}))}>×</button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <Label className="text-sm font-medium">Keterangan Khusus</Label>
                    <Input value={formData.keterangan_khusus} onChange={e => setFormData({...formData, keterangan_khusus: e.target.value})} placeholder="Contoh: Upacara Bendera" className="mt-1.5" />
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Waktu Pelaksanaan */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Waktu Pelaksanaan</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-sm font-medium">Hari <span className="text-destructive">*</span></Label>
                  <Select value={formData.hari} onValueChange={(v) => setFormData({...formData, hari: v})}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pilih Hari" /></SelectTrigger>
                    <SelectContent>
                      {daysOfWeek.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-sm font-medium">Jam ke- <span className="text-destructive">*</span></Label>
                  <Input type="number" min="1" value={formData.jam_ke} onChange={e => setFormData({...formData, jam_ke: e.target.value})} className="mt-1.5" />
                </div>
                
                <div className="col-span-1 relative">
                  <Label className="text-sm font-medium">Mulai <span className="text-destructive">*</span></Label>
                  <TimeInput value={formData.jam_mulai} onChange={v => setFormData({...formData, jam_mulai: v})} className="mt-1.5" />
                </div>
                
                <div className="col-span-1 relative">
                  <Label className="text-sm font-medium">Selesai <span className="text-destructive">*</span></Label>
                  <TimeInput value={formData.jam_selesai} onChange={v => setFormData({...formData, jam_selesai: v})} className="mt-1.5" disabled={!editingId && consecutiveHours > 1} />
                </div>
              </div>

              {!editingId && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <Label className="text-sm font-medium">Pelajaran Berurutan</Label>
                  <Select value={consecutiveHours.toString()} onValueChange={(v) => setConsecutiveHours(Number(v))}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6].map(n => <SelectItem key={n} value={n.toString()}>{n} Jam Pelajaran Sengaligus</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1 text-left">Otomatis buat jadwal dengan selang 40 menit per jam</p>
                </div>
              )}
            </div>

            <div className="rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-3">
                <input
                  id="is_absenable"
                  type="checkbox"
                  checked={formData.is_absenable}
                  onChange={(e) => setFormData({ ...formData, is_absenable: e.target.checked })}
                  className="rounded border-border text-emerald-600 focus:ring-ring w-4 h-4 mt-0.5"
                />
                <div>
                  <Label htmlFor="is_absenable" className="text-sm font-medium cursor-pointer">
                    Bisa Diabsen
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Guru dapat membuka form absensi pada jadwal ini</p>
                </div>
              </div>
            </div>

            <SheetFooter className="pt-6 mt-6 border-t">
              <div className="flex w-full sm:justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="w-full sm:w-auto text-sm">
                  Batal
                </Button>
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto text-sm">
                  {isSaving ? "Menyimpan..." : (
                    <>
                      {editingId ? <Edit className="mr-2 w-4 h-4" /> : <Plus className="mr-2 w-4 h-4" />}
                      {editingId ? "Perbarui Data" : "Simpan Data"}
                    </>
                  )}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ManageSchedulesView;
