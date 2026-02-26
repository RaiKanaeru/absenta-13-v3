/**
 * ScheduleGridTable - Master Grid View (Excel-style)
 *
 * Shows ALL classes simultaneously:
 * - Y-axis: Kelas (rowSpan=3) → Kategori (MAPEL | RUANG | GURU)
 * - X-axis: Hari (colSpan) → Jam Ke → Waktu
 * - Break/Istirahat/Pembiasaan slots span all 3 sub-rows (rowSpan=3)
 * - Click-to-edit via Dialog; Save all pending changes together.
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

  // Which class is selected (for dialog title)
  const selectedClassData = useMemo(() => {
    if (!matrixData || !selectedKelasId) return null;
    return matrixData.classes.find((c) => String(c.kelas_id) === selectedKelasId) ?? null;
  }, [matrixData, selectedKelasId]);

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
      // For master grid we fetch ALL classes — no kelas_id filter

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
  }, [selectedTingkat, onLogout]);

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

  // ─── Visible classes (filtered by tingkat) ──────────────────────────────────
  const visibleClasses = matrixData.classes.filter((cls) => {
    if (selectedTingkat === 'all') return true;
    return String(cls.nama_kelas || '').startsWith(selectedTingkat);
  });

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
              <h1 className="text-base font-bold hidden sm:block">Master Grid Jadwal</h1>
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

              {/* Copy/Paste actions — uses selectedKelasId for source */}
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

          {/* ── Master Grid Table ────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto max-h-[75vh]">
            <MasterGrid
              days={days}
              matrixJamSlots={matrixData.jamSlots}
              visibleClasses={visibleClasses}
              pendingChanges={pendingChanges}
              onCellClick={handleCellClick}
            />
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
                {matrixData.classes.find(c => c.kelas_id === editingCell.kelas_id)?.nama_kelas} ·{' '}
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

// ─── MasterGrid sub-component ─────────────────────────────────────────────────
// Excel-style: Y = Kelas × {MAPEL,RUANG,GURU}, X = Hari × JamKe

interface MasterGridProps {
  days: string[];
  matrixJamSlots: Record<string, JamSlot[]>;
  visibleClasses: ClassSchedule[];
  pendingChanges: PendingChange[];
  onCellClick: (
    kelas_id: number,
    hari: string,
    jam_ke: number,
    cell: ScheduleCell | null | undefined
  ) => void;
}

function MasterGrid({
  days,
  matrixJamSlots,
  visibleClasses,
  pendingChanges,
  onCellClick,
}: Readonly<MasterGridProps>) {
  // Build per-day slot lists for quick lookup
  const daySlotSets = useMemo(() => {
    const map: Record<string, Set<number>> = {};
    for (const day of days) {
      map[day] = new Set((matrixJamSlots[day] || []).map((s) => s.jam_ke));
    }
    return map;
  }, [days, matrixJamSlots]);

  // Slot colSpan per day: how many slots that day has
  const daySlotCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const day of days) {
      map[day] = (matrixJamSlots[day] || []).length;
    }
    return map;
  }, [days, matrixJamSlots]);

  const hasPending = (kelasId: number, hari: string, jamKe: number) =>
    pendingChanges.some(
      (p) =>
        p.kelas_id === kelasId &&
        p.hari === hari &&
        p.jam_ke === jamKe &&
        p.action !== 'delete'
    );

  const isPendingDelete = (kelasId: number, hari: string, jamKe: number) =>
    pendingChanges.some(
      (p) =>
        p.kelas_id === kelasId &&
        p.hari === hari &&
        p.jam_ke === jamKe &&
        p.action === 'delete'
    );

  // ── Row 1: Hari headers (colSpan = number of slots in that day × 1 col each)
  // ── Row 2: "Jam Ke" sub-headers per slot per day
  // ── Row 3: "Waktu" sub-headers per slot per day
  // Then for each kelas: 3 data rows (MAPEL / RUANG / GURU)

  // sticky offsets for left columns
  // Col 0 (Kelas): left-0, width 80px
  // Col 1 (Kategori): left-[80px], width 64px
  const KELAS_W = 80;
  const KAT_W = 64;

  return (
    <table
      className="border-collapse text-xs"
      style={{ tableLayout: 'fixed', minWidth: `${KELAS_W + KAT_W + days.length * 80}px` }}
    >
      <thead>
        {/* ── Row 1: Corner + Hari labels ──────────────────────────────── */}
        <tr>
          {/* Top-left corner — spans 2 header cols, 3 header rows */}
          <th
            rowSpan={3}
            colSpan={2}
            className="sticky left-0 z-40 border border-slate-300 bg-slate-800 text-white font-bold text-center align-middle"
            style={{ width: KELAS_W + KAT_W, minWidth: KELAS_W + KAT_W }}
          >
            Kelas
          </th>
          {days.map((day) => (
            <th
              key={day}
              colSpan={daySlotCounts[day] || 1}
              className="sticky top-0 z-30 border border-slate-300 bg-slate-700 text-white font-semibold text-center py-1 px-2"
              style={{ minWidth: (daySlotCounts[day] || 1) * 80 }}
            >
              {day.toUpperCase()}
            </th>
          ))}
        </tr>

        {/* ── Row 2: Jam Ke per slot ─────────────────────────────────────── */}
        <tr>
          {days.map((day) => {
            const daySlots = (matrixJamSlots[day] || []).sort(
              (a, b) => a.jam_ke - b.jam_ke
            );
            return daySlots.map((slot) => (
              <th
                key={`${day}-${slot.jam_ke}-ke`}
                className="sticky z-30 border border-slate-300 bg-slate-600 text-white font-medium text-center py-0.5 px-1 whitespace-nowrap"
                style={{
                  top: 28,
                  minWidth: 80,
                  width: 80,
                  backgroundColor:
                    slot.jenis === 'istirahat'
                      ? '#92400e'
                      : slot.jenis === 'pembiasaan'
                      ? '#1e40af'
                      : undefined,
                }}
              >
                {slot.jenis !== 'pelajaran'
                  ? (slot.label || slot.jenis).toUpperCase()
                  : `Jam ${slot.jam_ke}`}
              </th>
            ));
          })}
        </tr>

        {/* ── Row 3: Waktu per slot ─────────────────────────────────────── */}
        <tr>
          {days.map((day) => {
            const daySlots = (matrixJamSlots[day] || []).sort(
              (a, b) => a.jam_ke - b.jam_ke
            );
            return daySlots.map((slot) => (
              <th
                key={`${day}-${slot.jam_ke}-waktu`}
                className="sticky z-30 border border-slate-300 bg-slate-500 text-white font-normal text-center py-0.5 px-1 whitespace-nowrap"
                style={{ top: 56, minWidth: 80, width: 80 }}
              >
                {slot.jam_mulai}–{slot.jam_selesai}
              </th>
            ));
          })}
        </tr>
      </thead>

      <tbody>
        {visibleClasses.map((cls) => {
          return (
            <MasterGridClassRows
              key={cls.kelas_id}
              cls={cls}
              days={days}
              daySlotSets={daySlotSets}
              matrixJamSlots={matrixJamSlots}
              hasPending={hasPending}
              isPendingDelete={isPendingDelete}
              onCellClick={onCellClick}
              KELAS_W={KELAS_W}
              KAT_W={KAT_W}
            />
          );
        })}
      </tbody>
    </table>
  );
}

// ─── MasterGridClassRows ──────────────────────────────────────────────────────
// Renders 3 rows for one class: MAPEL / RUANG / GURU

interface MasterGridClassRowsProps {
  cls: ClassSchedule;
  days: string[];
  daySlotSets: Record<string, Set<number>>;
  matrixJamSlots: Record<string, JamSlot[]>;
  hasPending: (kelasId: number, hari: string, jamKe: number) => boolean;
  isPendingDelete: (kelasId: number, hari: string, jamKe: number) => boolean;
  onCellClick: (
    kelas_id: number,
    hari: string,
    jam_ke: number,
    cell: ScheduleCell | null | undefined
  ) => void;
  KELAS_W: number;
  KAT_W: number;
}

function MasterGridClassRows({
  cls,
  days,
  daySlotSets,
  matrixJamSlots,
  hasPending,
  isPendingDelete,
  onCellClick,
  KELAS_W,
  KAT_W,
}: Readonly<MasterGridClassRowsProps>) {
  // For each slot index, track which slots are special so we only render rowSpan=3 on row 0
  // and skip rows 1 & 2 for that slot.

  type SubRow = 'mapel' | 'ruang' | 'guru';
  const subRows: SubRow[] = ['mapel', 'ruang', 'guru'];
  const subRowLabels: Record<SubRow, string> = {
    mapel: 'MAPEL',
    ruang: 'RUANG',
    guru: 'GURU',
  };

  return (
    <>
      {subRows.map((subRow, subIdx) => (
        <tr key={`${cls.kelas_id}-${subRow}`} className="border-b border-slate-200">
          {/* ── Kelas label — only on first sub-row ── */}
          {subIdx === 0 && (
            <td
              rowSpan={3}
              className="sticky left-0 z-20 border border-slate-300 bg-slate-100 font-bold text-center align-middle text-slate-800 text-xs leading-tight p-1"
              style={{ width: KELAS_W, minWidth: KELAS_W }}
            >
              {cls.nama_kelas}
            </td>
          )}

          {/* ── Kategori label ── */}
          <td
            className="sticky z-20 border border-slate-300 bg-slate-50 text-slate-500 font-semibold text-center align-middle text-[10px] uppercase tracking-wide p-0.5"
            style={{ left: KELAS_W, width: KAT_W, minWidth: KAT_W }}
          >
            {subRowLabels[subRow]}
          </td>

          {/* ── Data cells for each day × slot ── */}
          {days.map((day) => {
            const daySlots = (matrixJamSlots[day] || []).sort(
              (a, b) => a.jam_ke - b.jam_ke
            );

            return daySlots.map((slot) => {
              const isSpecial = slot.jenis !== 'pelajaran';

              // For special slots: render a spanning td only on mapel row; skip ruang & guru rows
              if (isSpecial) {
                if (subRow === 'mapel') {
                  return (
                    <td
                      key={`${day}-${slot.jam_ke}`}
                      rowSpan={3}
                      className="border border-slate-300 text-center align-middle font-semibold text-slate-600 tracking-wide p-1"
                      style={{
                        backgroundColor:
                          slot.jenis === 'istirahat' ? '#FEF3C7' : '#DBEAFE',
                        minWidth: 80,
                        width: 80,
                      }}
                    >
                      <span className="text-[10px] uppercase leading-tight block">
                        {slot.label || slot.jenis}
                      </span>
                    </td>
                  );
                }
                // ruang & guru rows: cell was already covered by rowSpan — skip
                return null;
              }

              // Regular pelajaran slot
              // Check if this day even has this jam_ke slot
              if (!daySlotSets[day]?.has(slot.jam_ke)) {
                if (subRow === 'mapel') {
                  return (
                    <td
                      key={`${day}-${slot.jam_ke}`}
                      rowSpan={3}
                      className="border border-slate-200 bg-slate-50/50 text-center align-middle"
                      style={{ minWidth: 80, width: 80 }}
                    >
                      <span className="text-[10px] text-slate-300">–</span>
                    </td>
                  );
                }
                return null;
              }

              const cell = cls.schedule[day]?.[slot.jam_ke];
              const pending = hasPending(cls.kelas_id, day, slot.jam_ke);
              const deleted = isPendingDelete(cls.kelas_id, day, slot.jam_ke);
              const cellId = `${cls.kelas_id}-${day}-${slot.jam_ke}-cell`;

              const bgColor = cell && cell.mapel && !deleted
                ? getSubjectColor(cell.mapel, cell.color)
                : '#ffffff';

              let content: React.ReactNode = null;

              if (deleted) {
                if (subRow === 'mapel') content = <span className="text-red-400 line-through text-[10px]">Dihapus</span>;
              } else if (!cell || !cell.mapel) {
                if (subRow === 'mapel') {
                  content = (
                    <span className="flex items-center justify-center w-full h-full text-slate-300">
                      <Plus className="w-3 h-3" />
                    </span>
                  );
                }
              } else {
                if (subRow === 'mapel') {
                  content = (
                    <span className="font-bold text-slate-800 leading-tight truncate block text-center text-[10px]">
                      {cell.kode_mapel || cell.mapel}
                    </span>
                  );
                } else if (subRow === 'ruang') {
                  content = (
                    <span className="text-slate-700 leading-tight truncate block text-center text-[10px]">
                      {cell.ruang || '—'}
                    </span>
                  );
                } else {
                  const guruName =
                    cell.guru_detail && cell.guru_detail.length > 0
                      ? cell.guru_detail[0].kode_guru || cell.guru_detail[0].nama_guru
                      : cell.guru?.join(', ') || '—';
                  content = (
                    <span className="text-slate-700 leading-tight truncate block text-center text-[10px]">
                      {guruName}
                    </span>
                  );
                }
              }

              return (
                <td
                  key={`${day}-${slot.jam_ke}`}
                  className={`border border-slate-200 p-0 align-middle ${pending ? 'outline outline-2 outline-amber-400 outline-offset-[-2px]' : ''}`}
                  style={{
                    backgroundColor: bgColor,
                    minWidth: 80,
                    width: 80,
                    height: subRow === 'mapel' ? 28 : 22,
                  }}
                >
                  <DroppableCell
                    cellId={cellId}
                    isDisabled={false}
                    onClick={() => onCellClick(cls.kelas_id, day, slot.jam_ke, cell)}
                  >
                    <div className="w-full h-full flex items-center justify-center px-1 overflow-hidden">
                      {content}
                    </div>
                  </DroppableCell>
                </td>
              );
            });
          })}
        </tr>
      ))}
    </>
  );
}

export default ScheduleGridTable;
