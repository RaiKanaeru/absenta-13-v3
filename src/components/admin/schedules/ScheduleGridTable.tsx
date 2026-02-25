/**
 * ScheduleGridTable - Class-Focused Schedule Grid View
 *
 * Shows 1 class at a time with Days (columns) × Jam Ke (rows) layout.
 * Each cell is a stacked card: Mapel + Guru + Ruang.
 * Click-to-edit via Dialog; Drag-and-drop from sidebar as secondary.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  useSensors,
  useSensor,
  PointerSensor,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  Save,
  RefreshCw,
  GripVertical,
  User,
  BookOpen,
  Search,
  Loader2,
  Plus,
  Copy,
  ClipboardPaste,
  MoreHorizontal,
} from 'lucide-react';
import { apiCall } from '@/utils/apiClient';
import { Teacher, Subject, Room, Kelas } from '@/types/dashboard';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JamSlot {
  jam_ke: number;
  jam_mulai: string;
  jam_selesai: string;
  jenis: 'pelajaran' | 'istirahat' | 'pembiasaan';
  label?: string;
}

interface ScheduleCell {
  id: number | null;
  mapel: string;
  mapel_id?: number;
  nama_mapel?: string;
  ruang: string;
  ruang_id?: number;
  nama_ruang?: string;
  guru: string[];
  guru_detail?: Array<{ guru_id: number; nama_guru: string; kode_guru: string }>;
  color: string;
  jenis?: string;
  isSpecial?: boolean;
}

interface ClassSchedule {
  kelas_id: number;
  nama_kelas: string;
  tingkat: string;
  schedule: Record<string, Record<number, ScheduleCell | null>>;
}

interface MatrixResponse {
  days: string[];
  jamSlots: Record<string, JamSlot[]>;
  classes: ClassSchedule[];
  message?: string;
}

interface ScheduleGridTableProps {
  onBack: () => void;
  onLogout: () => void;
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  classes: Kelas[];
}

interface PendingChange {
  kelas_id: number;
  hari: string;
  jam_ke: number;
  mapel_id?: number | null;
  guru_id?: number | null;
  ruang_id?: number | null;
  rowType?: string;
  action?: 'delete';
  [key: string]: string | number | null | undefined;
}

type TeacherWithLegacyId = Teacher & { id_guru?: number };
type SubjectWithLegacyId = Subject & { id_mapel?: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, string> = {
  DPK: '#FFD700',
  UPACARA: '#87CEEB',
  ISTIRAHAT: '#FFA500',
  PEMBIASAAN: '#87CEEB',
  PJOK: '#32CD32',
  KIMIA: '#FF69B4',
  MATH: '#00CED1',
  BIND: '#90EE90',
  BING: '#DDA0DD',
  PABP: '#FFB6C1',
  IPAS: '#98FB98',
  SJRH: '#F0E68C',
  SBDY: '#E6E6FA',
  PPAN: '#FFDAB9',
  BSUN: '#B0E0E6',
  INFR: '#DEB887',
};

const TINGKAT_LIST = ['X', 'XI', 'XII'];

const getSubjectColor = (mapel: string, defaultColor?: string): string => {
  const upperMapel = mapel?.toUpperCase() || '';
  for (const [key, color] of Object.entries(SUBJECT_COLORS)) {
    if (upperMapel.includes(key)) return color;
  }
  return defaultColor || '#E5E7EB';
};

// ─── Helper functions ─────────────────────────────────────────────────────────

const isTeacherItem = (item: Teacher | Subject): item is Teacher =>
  'nip' in item || 'nama' in item;

const hasLegacyTeacherId = (item: Teacher | Subject): item is TeacherWithLegacyId =>
  'id_guru' in item && typeof (item as TeacherWithLegacyId).id_guru === 'number';

const hasLegacySubjectId = (item: Teacher | Subject): item is SubjectWithLegacyId =>
  'id_mapel' in item && typeof (item as SubjectWithLegacyId).id_mapel === 'number';

const getTeacherId = (teacher: Teacher): number | undefined => {
  if (typeof teacher.id === 'number') return teacher.id;
  return hasLegacyTeacherId(teacher) ? teacher.id_guru : undefined;
};

const getSubjectId = (subject: Subject): number | undefined => {
  if (typeof subject.id === 'number') return subject.id;
  return hasLegacySubjectId(subject) ? subject.id_mapel : undefined;
};

const getKelasId = (kelas: Kelas) => kelas.id_kelas ?? kelas.id;

// ─── DraggableItem ────────────────────────────────────────────────────────────

function DraggableItem({
  id,
  type,
  data,
  isDisabled,
}: Readonly<{
  id: string;
  type: 'guru' | 'mapel';
  data: Teacher | Subject;
  isDisabled?: boolean;
}>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type, item: data },
    disabled: isDisabled,
  });

  const style = { opacity: isDragging ? 0.3 : 1 };
  const isGuru = type === 'guru';
  const displayName = isTeacherItem(data) ? data.nama : data.nama_mapel;
  const displayCode = isTeacherItem(data)
    ? data.nip || '-'
    : (data as Subject).kode_mapel || '-';

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      disabled={isDisabled}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-2 p-2 rounded-lg border bg-background w-full text-left
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab hover:border-blue-400 hover:bg-blue-500/10'}
        ${isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''}
      `}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      {isGuru ? (
        <User className="w-4 h-4 text-blue-500 flex-shrink-0" />
      ) : (
        <BookOpen className="w-4 h-4 text-green-500 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate">{displayCode}</p>
      </div>
    </button>
  );
}

// ─── DroppableCell ────────────────────────────────────────────────────────────

function DroppableCell({
  cellId,
  children,
  isDisabled,
  onClick,
}: Readonly<{
  cellId: string;
  children: React.ReactNode;
  isDisabled: boolean;
  onClick?: () => void;
}>) {
  const { isOver, setNodeRef } = useDroppable({ id: cellId, disabled: isDisabled });

  return (
    <button
      type="button"
      ref={setNodeRef}
      disabled={isDisabled}
      onClick={onClick}
      className={`h-full w-full cursor-pointer text-left ${isOver ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScheduleGridTable({
  onBack,
  onLogout,
  teachers,
  subjects,
  rooms,
  classes,
}: Readonly<ScheduleGridTableProps>) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTingkat, setSelectedTingkat] = useState<string>('all');
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [matrixData, setMatrixData] = useState<MatrixResponse | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('guru');

  // Edit state
  const [editingCell, setEditingCell] = useState<{
    kelas_id: number;
    hari: string;
    jam_ke: number;
  } | null>(null);
  const [editMapelId, setEditMapelId] = useState<number | null>(null);
  const [editGuruId, setEditGuruId] = useState<number | null>(null);
  const [editRuangId, setEditRuangId] = useState<number | null>(null);
  const [copiedRow, setCopiedRow] = useState<{
    kelas_id: number;
    schedule: Record<string, Record<number, ScheduleCell | null>>;
  } | null>(null);

  // Drag state
  const [activeDragItem, setActiveDragItem] = useState<{
    id: string;
    type: 'guru' | 'mapel';
    item: Teacher | Subject;
  } | null>(null);

  // ── Derived state ──────────────────────────────────────────────────────────
  const filteredClasses = useMemo(() => {
    if (!classes.length) return [];
    const validClasses = classes.filter((kelas) => Number.isFinite(getKelasId(kelas)));
    if (selectedTingkat === 'all') return validClasses;
    return validClasses.filter((kelas) =>
      String(kelas.nama_kelas || '').startsWith(selectedTingkat)
    );
  }, [classes, selectedTingkat]);

  useEffect(() => {
    if (filteredClasses.length === 0) {
      setSelectedKelasId('');
      return;
    }
    const firstId = String(getKelasId(filteredClasses[0]));
    if (
      !selectedKelasId ||
      !filteredClasses.some((kelas) => String(getKelasId(kelas)) === selectedKelasId)
    ) {
      setSelectedKelasId(firstId);
    }
  }, [filteredClasses, selectedKelasId]);

  // Selected class data from matrix
  const selectedClassData = useMemo(() => {
    if (!matrixData || !selectedKelasId) return null;
    return matrixData.classes.find((c) => String(c.kelas_id) === selectedKelasId) ?? null;
  }, [matrixData, selectedKelasId]);

  // Union of all jam_ke values across all days for the selected class
  const allJamSlots = useMemo<JamSlot[]>(() => {
    if (!matrixData) return [];

    const seenJamKe = new Set<number>();
    const slots: JamSlot[] = [];

    for (const day of matrixData.days) {
      for (const slot of matrixData.jamSlots[day] || []) {
        if (!seenJamKe.has(slot.jam_ke)) {
          seenJamKe.add(slot.jam_ke);
          slots.push(slot);
        }
      }
    }

    return slots.sort((a, b) => a.jam_ke - b.jam_ke);
  }, [matrixData]);

  // Days from API
  const days = useMemo(() => matrixData?.days ?? [], [matrixData]);

  // ── Palette filtering ──────────────────────────────────────────────────────
  const filteredTeachers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return teachers
      .filter((t) => t.status === 'aktif')
      .filter(
        (t) =>
          t.nama.toLowerCase().includes(term) || t.nip?.includes(term)
      )
      .slice(0, 30);
  }, [teachers, searchTerm]);

  const filteredSubjects = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return subjects
      .filter((s) => s.status === 'aktif')
      .filter(
        (s) =>
          s.nama_mapel.toLowerCase().includes(term) ||
          s.kode_mapel?.toLowerCase().includes(term)
      )
      .slice(0, 30);
  }, [subjects, searchTerm]);

  // ── Sensors ────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Fetch matrix data ──────────────────────────────────────────────────────
  const fetchMatrix = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTingkat !== 'all') params.append('tingkat', selectedTingkat);
      if (selectedKelasId) params.append('kelas_id', selectedKelasId);

      const response = await apiCall<{ data?: MatrixResponse }>(
        `/api/admin/jadwal/matrix?${params}`,
        { method: 'GET', onLogout }
      );

      setMatrixData(response.data || null);
      setPendingChanges([]);
    } catch {
      toast({
        title: 'Error',
        description: 'Gagal memuat data jadwal',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTingkat, selectedKelasId, onLogout]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  // ── Conflict detection ─────────────────────────────────────────────────────
  const checkTeacherConflict = useCallback(
    (guruId: number, hari: string, jamKe: number, excludeKelasId: number) => {
      if (!matrixData) return null;
      for (const cls of matrixData.classes) {
        if (cls.kelas_id === excludeKelasId) continue;
        const cell = cls.schedule[hari]?.[jamKe];
        if (cell?.guru_detail?.some((g) => g.guru_id === guruId)) {
          return { kelas: cls.nama_kelas };
        }
      }
      return null;
    },
    [matrixData]
  );

  // ── Drag helpers ───────────────────────────────────────────────────────────
  const extractDragItemId = useCallback(
    (dragItem: Teacher | Subject, dragType: 'guru' | 'mapel'): number | undefined => {
      if (dragType === 'guru') return getTeacherId(dragItem as Teacher);
      return getSubjectId(dragItem as Subject);
    },
    []
  );

  const updateScheduleCellWithDragItem = useCallback(
    (
      existingCell: ScheduleCell,
      dragItem: Teacher | Subject,
      dragType: 'guru' | 'mapel'
    ): ScheduleCell => {
      const updatedCell = { ...existingCell };
      if (dragType === 'guru') {
        const g = dragItem as Teacher;
        updatedCell.guru = [g.nama];
        updatedCell.guru_detail = [
          { guru_id: getTeacherId(g) ?? 0, nama_guru: g.nama, kode_guru: g.nip || '' },
        ];
      } else {
        const m = dragItem as Subject;
        updatedCell.mapel = m.kode_mapel || m.nama_mapel;
        updatedCell.mapel_id = getSubjectId(m) ?? 0;
        updatedCell.nama_mapel = m.nama_mapel;
        updatedCell.color = getSubjectColor(m.kode_mapel);
      }
      return updatedCell;
    },
    []
  );

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const { type, item } = active.data.current as {
      type: 'guru' | 'mapel';
      item: Teacher | Subject;
    };
    setActiveDragItem({ id: active.id as string, type, item });
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !matrixData) return;

      // Cell ID format: `{kelas_id}-{hari}-{jam_ke}-cell`
      const parts = (over.id as string).split('-');
      const kelasId = Number.parseInt(parts[0]);
      const hari = parts[1];
      const jamKe = Number.parseInt(parts[2]);

      const dragType = active.data.current?.type as 'guru' | 'mapel';
      const dragItem = active.data.current?.item as Teacher | Subject | undefined;
      if (!dragItem) return;

      if (dragType === 'guru') {
        const currentTeacher = dragItem as Teacher;
        const guruId = getTeacherId(currentTeacher) ?? 0;
        const conflict = checkTeacherConflict(guruId, hari, jamKe, kelasId);
        if (conflict) {
          toast({
            title: 'Potensi Bentrok Jadwal',
            description: `Guru ${currentTeacher.nama} sudah mengajar di ${conflict.kelas} pada jam ini!`,
            variant: 'destructive',
            duration: 5000,
          });
        }
      }

      const dragItemId = extractDragItemId(dragItem, dragType);
      const change: PendingChange = {
        kelas_id: kelasId,
        hari,
        jam_ke: jamKe,
        [dragType === 'guru' ? 'guru_id' : 'mapel_id']: dragItemId ?? null,
      };

      setPendingChanges((prev) => {
        const filtered = prev.filter(
          (p) => !(p.kelas_id === kelasId && p.hari === hari && p.jam_ke === jamKe)
        );
        return [...filtered, change];
      });

      setMatrixData((prev) => {
        if (!prev) return null;
        const newClasses = prev.classes.map((cls) => {
          if (cls.kelas_id === kelasId) {
            const newSchedule = { ...cls.schedule };
            if (!newSchedule[hari]) newSchedule[hari] = {};
            const existingCell = newSchedule[hari][jamKe] || {
              id: null,
              mapel: '',
              mapel_id: 0,
              ruang: '',
              ruang_id: 0,
              guru: [],
              guru_detail: [],
              color: '#fff',
              jenis: 'pelajaran',
            };
            newSchedule[hari][jamKe] = updateScheduleCellWithDragItem(
              existingCell,
              dragItem,
              dragType
            );
            return { ...cls, schedule: newSchedule };
          }
          return cls;
        });
        return { ...prev, classes: newClasses };
      });

      const itemLabel = isTeacherItem(dragItem) ? dragItem.nama : dragItem.nama_mapel;
      toast({
        title: 'Jadwal Diupdate (Draft)',
        description: `${itemLabel} → ${hari} Jam ${jamKe}. Klik Simpan untuk permanen.`,
      });
    },
    [matrixData, checkTeacherConflict, extractDragItemId, updateScheduleCellWithDragItem]
  );

  // ── Save all ───────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (pendingChanges.length === 0) {
      toast({ title: 'Info', description: 'Tidak ada perubahan untuk disimpan' });
      return;
    }

    setIsSaving(true);
    try {
      const changesByHari: Record<string, PendingChange[]> = {};
      for (const change of pendingChanges) {
        if (!changesByHari[change.hari]) changesByHari[change.hari] = [];
        changesByHari[change.hari].push(change);
      }

      for (const [hari, changes] of Object.entries(changesByHari)) {
        await apiCall('/api/admin/jadwal/matrix/batch', {
          method: 'POST',
          body: JSON.stringify({ hari, changes }),
          onLogout,
        });
      }

      toast({ title: 'Sukses', description: `${pendingChanges.length} perubahan disimpan` });
      setPendingChanges([]);
      fetchMatrix();
    } catch (error: unknown) {
      let message = 'Gagal menyimpan perubahan';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error !== null) {
        message = (error as { message?: string }).message || 'Terjadi kesalahan yang tidak diketahui';
      } else if (
        typeof error === 'string' ||
        typeof error === 'number' ||
        typeof error === 'boolean'
      ) {
        message = String(error);
      }
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Cell click/edit/delete ─────────────────────────────────────────────────
  const handleCellClick = useCallback(
    (
      kelas_id: number,
      hari: string,
      jam_ke: number,
      currentData: ScheduleCell | null | undefined
    ) => {
      setEditingCell({ kelas_id, hari, jam_ke });
      setEditMapelId(currentData?.mapel_id || null);
      setEditGuruId(
        currentData?.guru_detail && currentData.guru_detail.length > 0
          ? currentData.guru_detail[0].guru_id
          : null
      );
      setEditRuangId(currentData?.ruang_id || null);
    },
    []
  );

  const handleCellSave = () => {
    if (!editingCell || !editMapelId || !editGuruId) return;
    const { kelas_id, hari, jam_ke } = editingCell;

    const filtered = pendingChanges.filter(
      (c) => !(c.kelas_id === kelas_id && c.hari === hari && c.jam_ke === jam_ke)
    );
    filtered.push({ kelas_id, hari, jam_ke, mapel_id: editMapelId, guru_id: editGuruId, ruang_id: editRuangId });
    setPendingChanges(filtered);

    if (matrixData) {
      const newClasses = matrixData.classes.map((cls) => {
        if (cls.kelas_id === kelas_id) {
          const selectedMapel = subjects.find((s) => s.id === editMapelId);
          const selectedGuru = teachers.find((t) => t.id === editGuruId);
          const selectedRoom = rooms.find((r) => r.id === editRuangId);
          const newSchedule = { ...cls.schedule };
          if (!newSchedule[hari]) newSchedule[hari] = {};
          newSchedule[hari][jam_ke] = {
            id: 0,
            mapel: selectedMapel?.kode_mapel || '',
            mapel_id: editMapelId,
            nama_mapel: selectedMapel?.nama_mapel || '',
            ruang: selectedRoom?.kode_ruang || '',
            ruang_id: editRuangId,
            guru: [selectedGuru?.nama || ''],
            guru_detail: [
              {
                guru_id: editGuruId,
                nama_guru: selectedGuru?.nama || '',
                kode_guru: '',
              },
            ],
            color: getSubjectColor(selectedMapel?.kode_mapel || ''),
            jenis: 'pelajaran',
          };
          return { ...cls, schedule: newSchedule };
        }
        return cls;
      });
      setMatrixData({ ...matrixData, classes: newClasses });
    }
    setEditingCell(null);
  };

  const handleCellDelete = () => {
    if (!editingCell) return;
    const { kelas_id, hari, jam_ke } = editingCell;
    const filtered = pendingChanges.filter(
      (c) => !(c.kelas_id === kelas_id && c.hari === hari && c.jam_ke === jam_ke)
    );
    filtered.push({ kelas_id, hari, jam_ke, action: 'delete' });
    setPendingChanges(filtered);

    if (matrixData) {
      const newClasses = matrixData.classes.map((cls) => {
        if (cls.kelas_id === kelas_id) {
          const newSchedule = { ...cls.schedule };
          if (newSchedule[hari]) delete newSchedule[hari][jam_ke];
          return { ...cls, schedule: newSchedule };
        }
        return cls;
      });
      setMatrixData({ ...matrixData, classes: newClasses });
    }
    setEditingCell(null);
  };

  // ── Copy/Paste handlers ────────────────────────────────────────────────────
  const handleCopyRow = (kelasId: number) => {
    const cls = matrixData?.classes.find((c) => c.kelas_id === kelasId);
    if (cls) {
      setCopiedRow({ kelas_id: kelasId, schedule: structuredClone(cls.schedule) });
      toast({ title: 'Copied', description: `Jadwal ${cls.nama_kelas} disalin` });
    }
  };

  const handlePasteRow = (targetKelasId: number) => {
    if (!copiedRow || !matrixData) {
      toast({ title: 'Info', description: 'Tidak ada jadwal yang disalin' });
      return;
    }

    const newChanges: PendingChange[] = [];
    const sourceClass = matrixData.classes.find((c) => c.kelas_id === copiedRow.kelas_id);

    for (const [hari, slots] of Object.entries(copiedRow.schedule)) {
      for (const [jamKeStr, cell] of Object.entries(slots)) {
        if (cell) {
          const jamKe = Number(jamKeStr);
          newChanges.push({
            kelas_id: targetKelasId,
            hari,
            jam_ke: jamKe,
            mapel_id: cell.mapel_id,
            guru_id: cell.guru_detail?.[0]?.guru_id,
            ruang_id: cell.ruang_id,
          });
        }
      }
    }

    setPendingChanges([...pendingChanges, ...newChanges]);

    const newClasses = matrixData.classes.map((cls) => {
      if (cls.kelas_id === targetKelasId) {
        return { ...cls, schedule: structuredClone(copiedRow.schedule) };
      }
      return cls;
    });
    setMatrixData({ ...matrixData, classes: newClasses });

    toast({
      title: 'Pasted',
      description: `Jadwal dari ${sourceClass?.nama_kelas || 'kelas'} ditempel`,
    });
  };

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-sm text-muted-foreground">Memuat data jadwal...</span>
      </div>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (!matrixData || matrixData.classes.length === 0) {
    return (
      <div className="p-6">
        <Button onClick={onBack} variant="ghost" className="mb-4">
          <ChevronLeft className="w-4 h-4 mr-2" /> Kembali
        </Button>
        <Card className="p-8 text-center">
          <CardContent>
            <p className="text-muted-foreground">
              {matrixData?.message ||
                'Tidak ada data jadwal. Silakan seed tabel jam_pelajaran terlebih dahulu.'}
            </p>
            <Button onClick={fetchMatrix} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────────
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full flex-col sm:flex-row overflow-hidden">
        {/* ── Main Grid Area ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b bg-background">
            <div className="flex items-center gap-3">
              <Button onClick={onBack} variant="ghost" size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" /> Kembali
              </Button>
              <h1 className="text-base font-bold hidden sm:block">Grid Editor Jadwal</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tingkat filter */}
              <Select value={selectedTingkat} onValueChange={setSelectedTingkat}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="Tingkat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {TINGKAT_LIST.map((t) => (
                    <SelectItem key={t} value={t}>
                      Kelas {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Class selector */}
              <Select value={selectedKelasId} onValueChange={setSelectedKelasId}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  {filteredClasses.map((kelas) => {
                    const kelasId = String(getKelasId(kelas));
                    return (
                      <SelectItem key={kelasId} value={kelasId}>
                        {kelas.nama_kelas}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Button
                onClick={fetchMatrix}
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="h-8"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {/* Copy/Paste actions for selected class */}
              {selectedKelasId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleCopyRow(Number(selectedKelasId))}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Salin Jadwal Kelas Ini
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handlePasteRow(Number(selectedKelasId))}
                      disabled={!copiedRow}
                    >
                      <ClipboardPaste className="w-4 h-4 mr-2" />
                      Tempel Jadwal{copiedRow ? ` dari ${matrixData.classes.find(c => c.kelas_id === copiedRow.kelas_id)?.nama_kelas || ''}` : ''}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                onClick={handleSaveAll}
                disabled={pendingChanges.length === 0 || isSaving}
                size="sm"
                className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Simpan{pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ''}
              </Button>
            </div>
          </div>

          {/* Pending changes banner */}
          {pendingChanges.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                {pendingChanges.length} draft
              </Badge>
              <span>Perubahan belum disimpan — klik Simpan untuk menerapkan</span>
            </div>
          )}

          {/* Class-Focused Grid */}
          <div className="flex-1 overflow-auto">
            {selectedClassData ? (
              <ScheduleGrid
                classData={selectedClassData}
                days={days}
                jamSlots={allJamSlots}
                matrixJamSlots={matrixData.jamSlots}
                onCellClick={handleCellClick}
                pendingChanges={pendingChanges}
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                Pilih kelas untuk melihat jadwal
              </div>
            )}
          </div>
        </div>

        {/* ── Palette Sidebar ────────────────────────────────────────────── */}
        <Card className="hidden sm:flex w-60 border-l rounded-none flex-col shrink-0">
          <div className="p-3 border-b">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
              <GripVertical className="w-4 h-4" />
              Palette (Drag ke Grid)
            </h3>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="guru" className="flex-1 text-xs">
                <User className="w-3 h-3 mr-1" />
                Guru ({filteredTeachers.length})
              </TabsTrigger>
              <TabsTrigger value="mapel" className="flex-1 text-xs">
                <BookOpen className="w-3 h-3 mr-1" />
                Mapel ({filteredSubjects.length})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="guru" className="p-2 space-y-1 m-0">
                {filteredTeachers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Tidak ada guru ditemukan
                  </p>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <DraggableItem
                      key={`guru-${teacher.id}`}
                      id={`guru-${teacher.id}`}
                      type="guru"
                      data={teacher}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="mapel" className="p-2 space-y-1 m-0">
                {filteredSubjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Tidak ada mapel ditemukan
                  </p>
                ) : (
                  filteredSubjects.map((subject) => (
                    <DraggableItem
                      key={`mapel-${subject.id}`}
                      id={`mapel-${subject.id}`}
                      type="mapel"
                      data={subject}
                    />
                  ))
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {pendingChanges.length > 0 && (
            <div className="p-2 border-t bg-muted">
              <Badge variant="secondary" className="w-full justify-center text-xs">
                {pendingChanges.length} perubahan tertunda
              </Badge>
            </div>
          )}
        </Card>
      </div>

      {/* ── Edit Dialog ──────────────────────────────────────────────────────── */}
      {editingCell && (
        <Dialog
          open={!!editingCell}
          onOpenChange={(open) => !open && setEditingCell(null)}
        >
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="text-base">
                Edit Jadwal —{' '}
                {selectedClassData?.nama_kelas} ·{' '}
                {editingCell.hari} Jam {editingCell.jam_ke}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Mapel */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="mapel" className="text-right text-sm">
                  Mapel
                </Label>
                <Select
                  value={editMapelId ? editMapelId.toString() : '0'}
                  onValueChange={(v) => setEditMapelId(v === '0' ? null : Number(v))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Pilih Mapel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Pilih Mapel...</SelectItem>
                    {subjects
                      .filter((s) => s.status === 'aktif' && s.id)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.nama_mapel}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Guru */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="guru" className="text-right text-sm">
                  Guru
                </Label>
                <Select
                  value={editGuruId ? editGuruId.toString() : '0'}
                  onValueChange={(v) => setEditGuruId(v === '0' ? null : Number(v))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Pilih Guru" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Pilih Guru...</SelectItem>
                    {teachers
                      .filter((t) => t.status === 'aktif' && t.id)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.nama}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ruang */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ruang" className="text-right text-sm">
                  Ruang
                </Label>
                <Select
                  value={editRuangId ? editRuangId.toString() : '0'}
                  onValueChange={(v) => setEditRuangId(v === '0' ? null : Number(v))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Default</SelectItem>
                    {rooms
                      .filter((r) => r.status === 'aktif' && r.id)
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id.toString()}>
                          {r.kode_ruang}
                          {r.nama_ruang ? ` — ${r.nama_ruang}` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="destructive" size="sm" onClick={handleCellDelete}>
                Hapus
              </Button>
              <Button
                size="sm"
                onClick={handleCellSave}
                disabled={!editMapelId || !editGuruId}
              >
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Drag Overlay ─────────────────────────────────────────────────────── */}
      <DragOverlay>
        {activeDragItem ? (
          <div className="flex items-center gap-2 p-2 rounded-lg border bg-background/90 shadow-xl w-48 pointer-events-none ring-2 ring-blue-500">
            <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            {activeDragItem.type === 'guru' ? (
              <User className="w-4 h-4 text-blue-500 flex-shrink-0" />
            ) : (
              <BookOpen className="w-4 h-4 text-green-500 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {activeDragItem.type === 'guru'
                  ? (activeDragItem.item as Teacher).nama
                  : (activeDragItem.item as Subject).nama_mapel}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {activeDragItem.type === 'guru'
                  ? (activeDragItem.item as Teacher).nip || '-'
                  : (activeDragItem.item as Subject).kode_mapel || '-'}
              </p>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─── ScheduleGrid sub-component ───────────────────────────────────────────────

interface ScheduleGridProps {
  classData: ClassSchedule;
  days: string[];
  jamSlots: JamSlot[];
  matrixJamSlots: Record<string, JamSlot[]>;
  onCellClick: (
    kelas_id: number,
    hari: string,
    jam_ke: number,
    cell: ScheduleCell | null | undefined
  ) => void;
  pendingChanges: PendingChange[];
}

function ScheduleGrid({
  classData,
  days,
  jamSlots,
  matrixJamSlots,
  onCellClick,
  pendingChanges,
}: Readonly<ScheduleGridProps>) {
  const hasPending = (hari: string, jamKe: number) =>
    pendingChanges.some(
      (p) =>
        p.kelas_id === classData.kelas_id &&
        p.hari === hari &&
        p.jam_ke === jamKe &&
        p.action !== 'delete'
    );

  const isPendingDelete = (hari: string, jamKe: number) =>
    pendingChanges.some(
      (p) =>
        p.kelas_id === classData.kelas_id &&
        p.hari === hari &&
        p.jam_ke === jamKe &&
        p.action === 'delete'
    );

  return (
    <div className="overflow-auto">
      <table className="border-collapse w-full min-w-[600px]">
        <thead className="sticky top-0 z-20 bg-background">
          <tr>
            {/* Jam Ke header */}
            <th className="sticky left-0 z-30 bg-slate-800 text-white text-xs font-semibold p-2 border w-20 min-w-[80px]">
              <div className="text-center">
                <div>Jam</div>
                <div className="text-slate-300 font-normal">Waktu</div>
              </div>
            </th>
            {/* Day headers */}
            {days.map((day) => (
              <th
                key={day}
                className="bg-slate-700 text-white text-xs font-semibold p-2 border text-center min-w-[120px]"
              >
                {day.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {jamSlots.map((slot) => {
            const isSpecialSlot = slot.jenis !== 'pelajaran';

            return (
              <tr key={slot.jam_ke} className="border-b">
                {/* Jam Ke column */}
                <td className="sticky left-0 z-10 bg-muted border-r p-2 text-center w-20 min-w-[80px]">
                  <div className="flex flex-col items-center gap-0.5">
                    {isSpecialSlot ? (
                      <span className="text-xs font-medium text-muted-foreground">—</span>
                    ) : (
                      <span className="text-sm font-bold text-foreground">{slot.jam_ke}</span>
                    )}
                    <span className="text-xs text-muted-foreground leading-tight">
                      {slot.jam_mulai}
                    </span>
                    <span className="text-xs text-muted-foreground leading-tight">
                      {slot.jam_selesai}
                    </span>
                  </div>
                </td>

                {/* Day cells */}
                {days.map((day) => {
                  // Check if this day even has this jam_ke slot
                  const dayHasSlot = (matrixJamSlots[day] || []).some(
                    (s) => s.jam_ke === slot.jam_ke
                  );

                  if (!dayHasSlot) {
                    return (
                      <td
                        key={day}
                        className="border p-0 bg-muted/30"
                      >
                        <div className="h-16 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground/40">–</span>
                        </div>
                      </td>
                    );
                  }

                  if (isSpecialSlot) {
                    return (
                      <td
                        key={day}
                        className="border p-0"
                        style={{ backgroundColor: slot.jenis === 'istirahat' ? '#FFF3CD' : '#DBEAFE' }}
                      >
                        <div className="h-10 flex items-center justify-center">
                          <span className="text-xs font-semibold text-slate-600 tracking-wide">
                            {slot.label?.toUpperCase() || slot.jenis.toUpperCase()}
                          </span>
                        </div>
                      </td>
                    );
                  }

                  const cell = classData.schedule[day]?.[slot.jam_ke];
                  const cellId = `${classData.kelas_id}-${day}-${slot.jam_ke}-cell`;
                  const isPending = hasPending(day, slot.jam_ke);
                  const isDeleted = isPendingDelete(day, slot.jam_ke);

                  return (
                    <td key={day} className="border p-0">
                      <DroppableCell
                        cellId={cellId}
                        isDisabled={false}
                        onClick={() => onCellClick(classData.kelas_id, day, slot.jam_ke, cell)}
                      >
                        <ScheduleCellCard
                          cell={isDeleted ? null : cell}
                          isPending={isPending}
                          isDeleted={isDeleted}
                        />
                      </DroppableCell>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── ScheduleCellCard sub-component ──────────────────────────────────────────

interface ScheduleCellCardProps {
  cell: ScheduleCell | null | undefined;
  isPending?: boolean;
  isDeleted?: boolean;
}

function ScheduleCellCard({ cell, isPending, isDeleted }: Readonly<ScheduleCellCardProps>) {
  if (isDeleted) {
    return (
      <div className="h-16 flex items-center justify-center group transition-colors hover:bg-red-50">
        <span className="text-xs text-red-400 line-through">Dihapus</span>
      </div>
    );
  }

  if (!cell || !cell.mapel) {
    return (
      <div className="h-16 flex items-center justify-center group transition-colors hover:bg-muted/60">
        <Plus className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
      </div>
    );
  }

  const bgColor = cell.isSpecial
    ? cell.color
    : getSubjectColor(cell.mapel, cell.color);

  const guruName =
    cell.guru_detail && cell.guru_detail.length > 0
      ? cell.guru_detail[0].nama_guru
      : cell.guru?.join(', ') || '';

  return (
    <div
      className={`
        h-16 p-1.5 flex flex-col justify-between overflow-hidden transition-all
        hover:brightness-95 cursor-pointer relative
        ${isPending ? 'ring-2 ring-amber-400 ring-inset' : ''}
      `}
      style={{ backgroundColor: bgColor }}
      title={`${cell.nama_mapel || cell.mapel} — ${guruName} — ${cell.ruang || ''}`}
    >
      {/* Mapel name */}
      <span className="text-xs font-bold text-slate-800 truncate leading-tight">
        {cell.nama_mapel || cell.mapel}
      </span>

      {/* Guru name */}
      <span className="text-xs text-slate-700 truncate leading-tight opacity-90">
        {guruName}
      </span>

      {/* Room badge */}
      {cell.ruang && (
        <span className="inline-flex self-start items-center rounded bg-black/10 px-1 py-0 text-xs text-slate-800 font-medium leading-tight mt-0.5 truncate max-w-full">
          {cell.ruang}
        </span>
      )}

      {/* Pending indicator */}
      {isPending && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
      )}
    </div>
  );
}

export default ScheduleGridTable;
