/**
 * ScheduleGridTable - Horizontal scrollable schedule grid
 * 
 * Matches spreadsheet format:
 * - 3 rows per class (MAPEL, RUANG, GURU)
 * - All 5 days horizontal
 * - Color-coded by subject
 * - Sticky class column
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, useSensors, useSensor, PointerSensor, DragOverlay, useDroppable, useDraggable } from '@dnd-kit/core';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, Save, RefreshCw, GripVertical, User, BookOpen, Search, Loader2 } from "lucide-react";
import { apiCall } from '@/utils/apiClient';
import { Teacher, Subject, Room, Kelas } from '@/types/dashboard';
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Types
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

// Color palette for subjects
const SUBJECT_COLORS: Record<string, string> = {
  'DPK': '#FFD700',
  'UPACARA': '#87CEEB',
  'ISTIRAHAT': '#FFA500',
  'PEMBIASAAN': '#87CEEB',
  'PJOK': '#32CD32',
  'KIMIA': '#FF69B4',
  'MATH': '#00CED1',
  'BIND': '#90EE90',
  'BING': '#DDA0DD',
  'PABP': '#FFB6C1',
  'IPAS': '#98FB98',
  'SJRH': '#F0E68C',
  'SBDY': '#E6E6FA',
  'PPAN': '#FFDAB9',
  'BSUN': '#B0E0E6',
  'INFR': '#DEB887',
};

const getSubjectColor = (mapel: string, defaultColor?: string): string => {
  const upperMapel = mapel?.toUpperCase() || '';
  for (const [key, color] of Object.entries(SUBJECT_COLORS)) {
    if (upperMapel.includes(key)) return color;
  }
  return defaultColor || '#E5E7EB';
};

const TINGKAT_LIST = ['X', 'XI', 'XII'];
const ROW_TYPES = ['MAPEL', 'RUANG', 'GURU'] as const;

const isTeacherItem = (item: Teacher | Subject): item is Teacher => 'nip' in item || 'nama' in item;

const getKelasId = (kelas: Kelas) => kelas.id_kelas ?? kelas.id;

// Draggable Item Component
function DraggableItem({ id, type, data, isDisabled }: {
  id: string;
  type: 'guru' | 'mapel';
  data: Teacher | Subject;
  isDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type, item: data },
    disabled: isDisabled
  });

  const style = {
    opacity: isDragging ? 0.3 : 1,
  };

  const isGuru = type === 'guru';
  const displayName = isTeacherItem(data) ? data.nama : data.nama_mapel;
  const displayCode = isTeacherItem(data) ? (data.nip || '-') : (data.kode_mapel || '-');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-2 p-2 rounded-lg border bg-background
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
        <p className="text-xs font-medium truncate">
          {displayName}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {displayCode}
        </p>
      </div>
    </div>
  );
}

// Droppable Cell Component
function DroppableCell({
  cellId,
  children,
  isDisabled,
  onClick
}: {
  cellId: string;
  children: React.ReactNode;
  isDisabled: boolean;
  onClick?: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: cellId,
    disabled: isDisabled
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`
        h-full cursor-pointer
        ${isOver ? 'ring-2 ring-blue-500 ring-inset' : ''}
      `}
    >
      {children}
    </div>
  );
}

export function ScheduleGridTable({
  onBack,
  onLogout,
  teachers,
  subjects,
  rooms,
  classes
}: Readonly<ScheduleGridTableProps>) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTingkat, setSelectedTingkat] = useState<string>('all');
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [matrixData, setMatrixData] = useState<MatrixResponse | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('guru');

  // Edit State
  const [editingCell, setEditingCell] = useState<{kelas_id: number; hari: string; jam_ke: number} | null>(null);
  const [editMapelId, setEditMapelId] = useState<number | null>(null);
  const [editGuruId, setEditGuruId] = useState<number | null>(null);
  const [editRuangId, setEditRuangId] = useState<number | null>(null);
  const [copiedRow, setCopiedRow] = useState<{kelas_id: number; schedule: Record<string, Record<number, ScheduleCell | null>>} | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; kelasId: number} | null>(null);

  const filteredClasses = useMemo(() => {
    if (!classes.length) return [];
    const validClasses = classes.filter(kelas => Number.isFinite(getKelasId(kelas)));
    if (selectedTingkat === 'all') return validClasses;
    return validClasses.filter(kelas => String(kelas.nama_kelas || '').startsWith(selectedTingkat));
  }, [classes, selectedTingkat]);

  useEffect(() => {
    if (filteredClasses.length === 0) {
      setSelectedKelasId('');
      return;
    }
    const firstId = String(getKelasId(filteredClasses[0]));
    if (!selectedKelasId || !filteredClasses.some(kelas => String(getKelasId(kelas)) === selectedKelasId)) {
      setSelectedKelasId(firstId);
    }
  }, [filteredClasses, selectedKelasId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  // Fetch matrix data
  const fetchMatrix = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTingkat !== 'all') {
        params.append('tingkat', selectedTingkat);
      }
      if (selectedKelasId) {
        params.append('kelas_id', selectedKelasId);
      }

      const response = await apiCall<{ data?: MatrixResponse }>(`/api/admin/jadwal/matrix?${params}`, {
        method: 'GET',
        onLogout
      });

      setMatrixData(response.data || null);
      setPendingChanges([]);
    } catch (error) {
      console.error('Error fetching matrix:', error);
      toast({ title: "Error", description: "Gagal memuat data jadwal", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTingkat, selectedKelasId, onLogout]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  // Filter teachers for palette
  const filteredTeachers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return teachers
      .filter(t => t.status === 'aktif')
      .filter(t => 
        t.nama.toLowerCase().includes(term) || 
        (t.nip && t.nip.includes(term))
      )
      .slice(0, 30);
  }, [teachers, searchTerm]);

  // Filter subjects for palette
  const filteredSubjects = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return subjects
      .filter(s => s.status === 'aktif')
      .filter(s => 
        s.nama_mapel.toLowerCase().includes(term) || 
        (s.kode_mapel && s.kode_mapel.toLowerCase().includes(term))
      )
      .slice(0, 30);
  }, [subjects, searchTerm]);

  // Drag State
  const [activeDragItem, setActiveDragItem] = useState<{ id: string; type: 'guru' | 'mapel'; item: Teacher | Subject } | null>(null);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const { type, item } = active.data.current as { type: 'guru' | 'mapel'; item: Teacher | Subject };
    setActiveDragItem({ id: active.id as string, type, item });
  };



  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !matrixData) return;

    // Parse drop target: format is "kelas_id-hari-jam_ke-rowType"
    const [kelasIdStr, hari, jamKeStr, rowType] = (over.id as string).split('-');
    const kelasId = Number.parseInt(kelasIdStr);
    const jamKe = Number.parseInt(jamKeStr);

    const dragType = active.data.current?.type as 'guru' | 'mapel';
    const dragItem = active.data.current?.item as Teacher | Subject | undefined;

    if (!dragItem) return;

    // CONFLICT DETECTION LOGIC (Client-Side)
    if (dragType === 'guru') {
      const currentTeacher = dragItem as Teacher;
      const guruId = currentTeacher.id || currentTeacher.id_guru;
      
      // Check ALL classes in matrix for this Day & Jam
      let conflictFound = null;
      
      for (const cls of matrixData.classes) {
        if (cls.kelas_id === kelasId) continue; // Skip current class (self)
        
        const cell = cls.schedule[hari]?.[jamKe];
        // Check if primary guru matches
        if (cell?.guru_detail?.some(g => g.guru_id === guruId)) {
          conflictFound = {
            kelas: cls.nama_kelas,
            guru: currentTeacher.nama
          };
          break;
        }
      }

      if (conflictFound) {
        toast({
          title: "Potensi Bentrok Jadwal",
          description: `Guru ${conflictFound.guru} sudah mengajar di ${conflictFound.kelas} pada jam ini!`,
          variant: "destructive",
          duration: 5000
        });
      }
    }

    // Add to pending changes
    const dragItemId = dragType === 'guru'
      ? ('id' in dragItem ? dragItem.id : ('id_guru' in dragItem ? dragItem.id_guru : undefined))
      : ('id' in dragItem ? dragItem.id : ('id_mapel' in dragItem ? dragItem.id_mapel : undefined));

    const change: PendingChange = {
      kelas_id: kelasId,
      hari,
      jam_ke: jamKe,
      rowType,
      [dragType === 'guru' ? 'guru_id' : 'mapel_id']: dragItemId ?? null
    };

    setPendingChanges(prev => {
        // Remove existing change for same slot/type to avoid duplicates in pending
        const filtered = prev.filter(p => !(p.kelas_id === kelasId && p.hari === hari && p.jam_ke === jamKe && p.rowType === rowType));
        return [...filtered, change];
    });
    
    // OPTIMISTIC UPDATE for Visual Feedback
    setMatrixData(prev => {
        if (!prev) return null;
        const newClasses = prev.classes.map(cls => {
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
                    jenis: 'pelajaran'
                };

                // Update specific field based on Drag Type
                if (dragType === 'guru') {
                    const g = dragItem as Teacher;
                    existingCell.guru = [g.nama];
                    existingCell.guru_detail = [{ 
                        guru_id: g.id || g.id_guru || 0, 
                        nama_guru: g.nama, 
                        kode_guru: g.nip || '' 
                    }];
                } else if (dragType === 'mapel') {
                    const m = dragItem as Subject;
                    existingCell.mapel = m.kode_mapel || m.nama_mapel;
                    existingCell.mapel_id = m.id || m.id_mapel;
                    existingCell.nama_mapel = m.nama_mapel;
                    existingCell.color = getSubjectColor(m.kode_mapel); // Auto config color
                }
                
                newSchedule[hari][jamKe] = existingCell;
                return { ...cls, schedule: newSchedule };
            }
            return cls;
        });
        return { ...prev, classes: newClasses };
    });

    const itemLabel = isTeacherItem(dragItem) ? dragItem.nama : dragItem.nama_mapel;
    toast({
      title: "Jadwal Diupdate (Draft)",
      description: `${itemLabel} → ${hari} Jam ${jamKe}. Klik Simpan untuk permanen.`,
    });
  }, [matrixData]);

  // Save all changes
  const handleSaveAll = async () => {
    if (pendingChanges.length === 0) {
      toast({ title: "Info", description: "Tidak ada perubahan untuk disimpan" });
      return;
    }

    setIsSaving(true);
    try {
      // Group changes by hari
      const changesByHari: Record<string, PendingChange[]> = {};
      for (const change of pendingChanges) {
        if (!changesByHari[change.hari]) changesByHari[change.hari] = [];
        changesByHari[change.hari].push(change);
      }

      // Send batch updates per day
      for (const [hari, changes] of Object.entries(changesByHari)) {
        await apiCall('/api/admin/jadwal/matrix/batch', {
          method: 'POST',
          body: JSON.stringify({ hari, changes }),
          onLogout
        });
      }

      toast({ title: "Sukses", description: `${pendingChanges.length} perubahan disimpan` });
      setPendingChanges([]);
      fetchMatrix();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ 
        title: "Error", 
        description: message || "Gagal menyimpan perubahan", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Render cell content
  const renderCellContent = (cell: ScheduleCell | null, rowType: typeof ROW_TYPES[number]) => {
    if (!cell) return null;

    const bgColor = cell.isSpecial 
      ? cell.color 
      : getSubjectColor(cell.mapel, cell.color);

    const content = rowType === 'MAPEL' 
      ? cell.mapel 
      : rowType === 'RUANG' 
        ? cell.ruang 
        : cell.guru?.join(', ') || '';

    return (
      <div 
        className="w-full h-full flex items-center justify-center text-[9px] font-medium p-0.5 truncate"
        style={{ backgroundColor: bgColor }}
        title={content}
      >
        {content}
      </div>
    );
  };

  // Copy row handler
  const handleCopyRow = (kelasId: number) => {
    const cls = matrixData?.classes.find(c => c.kelas_id === kelasId);
    if (cls) {
      // Use structuredClone for deep copy instead of JSON parse/stringify
      setCopiedRow({ kelas_id: kelasId, schedule: structuredClone(cls.schedule) });
      toast({ title: "Copied", description: `Jadwal ${cls.nama_kelas} disalin` });
    }
    setContextMenu(null);
  };

  // Paste row handler
  const handlePasteRow = (targetKelasId: number) => {
    if (!copiedRow || !matrixData) {
      toast({ title: "Info", description: "Tidak ada jadwal yang disalin" });
      return;
    }

    const newChanges: PendingChange[] = [];
    const sourceClass = matrixData.classes.find(c => c.kelas_id === copiedRow.kelas_id);
    
    // Create changes for each cell in copied row
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
            ruang_id: cell.ruang_id
          });
        }
      }
    }

    setPendingChanges([...pendingChanges, ...newChanges]);

    // Optimistic UI update
    const newClasses = matrixData.classes.map(cls => {
      if (cls.kelas_id === targetKelasId) {
        return { ...cls, schedule: structuredClone(copiedRow.schedule) };
      }
      return cls;
    });
    setMatrixData({ ...matrixData, classes: newClasses });

    toast({ 
      title: "Pasted", 
      description: `Jadwal dari ${sourceClass?.nama_kelas || 'kelas'} ditempel` 
    });
    setContextMenu(null);
  };

  // Context menu handler
  const handleRowContextMenu = (e: React.MouseEvent, kelasId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, kelasId });
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleCellClick = (kelas_id: number, hari: string, jam_ke: number, currentData: ScheduleCell | null | undefined) => {
    setEditingCell({ kelas_id, hari, jam_ke });
    setEditMapelId(currentData?.mapel_id || null);
    setEditGuruId(currentData?.guru_detail && currentData.guru_detail.length > 0 ? currentData.guru_detail[0].guru_id : null);
    setEditRuangId(currentData?.ruang_id || null);
  };

  const handleCellSave = () => {
    if (!editingCell || !editMapelId || !editGuruId) return;
    const { kelas_id, hari, jam_ke } = editingCell;

    const filtered = pendingChanges.filter(c => !(c.kelas_id === kelas_id && c.hari === hari && c.jam_ke === jam_ke));
    
    filtered.push({
      kelas_id,
      hari,
      jam_ke,
      mapel_id: editMapelId,
      guru_id: editGuruId,
      ruang_id: editRuangId
    });
    
    setPendingChanges(filtered);

    // Optimistic Update
    if (matrixData) {
        const newClasses = matrixData.classes.map(cls => {
            if (cls.kelas_id === kelas_id) {
                const selectedMapel = subjects.find(s => s.id === editMapelId);
                const selectedGuru = teachers.find(t => t.id === editGuruId);
                const selectedRoom = rooms.find(r => r.id === editRuangId);
                
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
                    guru_detail: [{ guru_id: editGuruId!, nama_guru: selectedGuru?.nama || '', kode_guru: '' }], 
                    color: getSubjectColor(selectedMapel?.kode_mapel || ''),
                    jenis: 'pelajaran'
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
     const filtered = pendingChanges.filter(c => !(c.kelas_id === kelas_id && c.hari === hari && c.jam_ke === jam_ke));
     filtered.push({ kelas_id, hari, jam_ke, action: 'delete' });
     setPendingChanges(filtered);

     // Optimistic Update (Delete)
     if (matrixData) {
        const newClasses = matrixData.classes.map(cls => {
             if (cls.kelas_id === kelas_id) {
                 const newSchedule = { ...cls.schedule };
                 if (newSchedule[hari]) {
                     delete newSchedule[hari][jam_ke];
                 }
                 return { ...cls, schedule: newSchedule };
             }
             return cls;
        });
        setMatrixData({ ...matrixData, classes: newClasses });
     }
     setEditingCell(null);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2">Memuat data jadwal...</span>
      </div>
    );
  }

  // Render empty state
  if (!matrixData || matrixData.classes.length === 0) {
    return (
      <div className="p-6">
        <Button onClick={onBack} variant="ghost" className="mb-4">
          <ChevronLeft className="w-4 h-4 mr-2" /> Kembali
        </Button>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {matrixData?.message || 'Tidak ada data jadwal. Silakan seed tabel jam_pelajaran terlebih dahulu.'}
          </p>
          <Button onClick={fetchMatrix} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full">
        {/* Main Grid Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-background">
            <div className="flex items-center gap-4">
              <Button onClick={onBack} variant="ghost" size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" /> Kembali
              </Button>
              <h1 className="text-lg font-bold">Grid Editor Jadwal</h1>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedTingkat} onValueChange={setSelectedTingkat}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Tingkat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {TINGKAT_LIST.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedKelasId} onValueChange={setSelectedKelasId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  {filteredClasses.map(kelas => {
                    const kelasId = String(getKelasId(kelas));
                    return (
                      <SelectItem key={kelasId} value={kelasId}>
                        {kelas.nama_kelas}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button onClick={fetchMatrix} variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <Button 
                onClick={handleSaveAll} 
                disabled={pendingChanges.length === 0 || isSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-1" />
                Simpan {pendingChanges.length > 0 && `(${pendingChanges.length})`}
              </Button>
            </div>
          </div>

          {/* Grid Table */}
          <div className="flex-1 overflow-auto">
            <table className="border-collapse text-xs min-w-max">
              <thead className="sticky top-0 z-20 bg-background">
                {/* Day headers */}
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-800 text-white p-2 border min-w-[80px]" rowSpan={2}>KELAS</th>
                  <th className="sticky left-[80px] z-30 bg-slate-800 text-white p-2 border min-w-[50px]" rowSpan={2}>JAM KE</th>
                  {matrixData.days.map(day => {
                    const slots = matrixData.jamSlots[day] || [];
                    return (
                      <th 
                        key={day} 
                        colSpan={slots.length} 
                        className="bg-slate-700 text-white p-2 border text-center"
                      >
                        {day.toUpperCase()}
                      </th>
                    );
                  })}
                </tr>
                {/* Jam headers */}
                <tr>
                  {matrixData.days.map(day => (
                    (matrixData.jamSlots[day] || []).map(slot => (
                      <th 
                        key={`${day}-${slot.jam_ke}`} 
                        className="bg-slate-600 text-white p-1 border text-center min-w-[60px]"
                        title={`${slot.jam_mulai} - ${slot.jam_selesai}`}
                      >
                        {slot.label || slot.jam_ke}
                      </th>
                    ))
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.classes.map(kelas => (
                  <React.Fragment key={kelas.kelas_id}>
                    {ROW_TYPES.map((rowType, rowIdx) => (
                      <tr key={`${kelas.kelas_id}-${rowType}`} className="border">
                        {/* Class name - only show on first row */}
                        {rowIdx === 0 && (
                          <td 
                            className="sticky left-0 z-10 bg-amber-500/15 font-bold p-1 border text-center cursor-context-menu"
                            rowSpan={3}
                            onContextMenu={(e) => handleRowContextMenu(e, kelas.kelas_id)}
                          >
                            {kelas.nama_kelas}
                          </td>
                        )}
                        {/* Row type label */}
                        <td className="sticky left-[80px] z-10 bg-muted p-1 border text-center font-medium">
                          {rowType}
                        </td>
                        {/* Schedule cells for each day */}
                        {matrixData.days.map(day => (
                          (matrixData.jamSlots[day] || []).map(slot => {
                            const cell = kelas.schedule[day]?.[slot.jam_ke];
                            const cellId = `${kelas.kelas_id}-${day}-${slot.jam_ke}-${rowType}`;
                            
                            // Check if this slot is a special event (Upacara, Istirahat, etc.)
                            // Special events come from the slot type OR explicit cell data
                            const isSlotSpecial = slot.jenis !== 'pelajaran';
                            const isCellSpecial = cell?.isSpecial;
                            const isSpecial = isSlotSpecial || isCellSpecial;

                            // LOGIC FOR ROW SPANNING (MATCHING EXCEL IMAGE)
                            // If special event:
                            // - Row 0 (MAPEL): Render cell with rowSpan=3
                            // - Row 1 & 2 (RUANG, GURU): Render NOTHING (null)
                            
                            if (isSpecial) {
                              if (rowIdx === 0) {
                                return (
                                  <td 
                                    key={cellId}
                                    rowSpan={3}
                                    className="border p-0 h-full text-center align-middle font-bold text-xs"
                                    style={{ 
                                      backgroundColor: cell ? getSubjectColor(cell.mapel, cell.color) : (isSlotSpecial ? 'hsl(var(--primary) / 0.18)' : undefined) 
                                      // Default orange for breaks if no specific color
                                    }}
                                  >
                                    <div className="flex items-center justify-center h-full w-full p-2 writing-mode-vertical?">
                                      {/* Show Label from Slot (e.g., ISTIRAHAT) or Cell */}
                                      {slot.label?.toUpperCase() || cell?.mapel || slot.jenis.toUpperCase()}
                                    </div>
                                  </td>
                                );
                              } else {
                                // Skip rendering for rows 1 and 2
                                return null;
                              }
                            }

                            // Normal Lesson Cell (Not Special)
                            return (
                              <td 
                                key={cellId}
                                className="border p-0 h-6"
                                style={{ backgroundColor: cell ? getSubjectColor(cell.mapel, cell.color) : undefined }}
                                role="gridcell"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleCellClick(kelas.kelas_id, day, slot.jam_ke, cell);
                                  }
                                }}
                              >
                                <DroppableCell 
                                  cellId={cellId} 
                                  isDisabled={false}
                                  onClick={() => handleCellClick(kelas.kelas_id, day, slot.jam_ke, cell)}
                                >
                                  {renderCellContent(cell, rowType)}
                                </DroppableCell>
                              </td>
                            );
                          })

                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Palette Sidebar */}
        <Card className="w-64 border-l flex flex-col">
          <div className="p-3 border-b">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
              <GripVertical className="w-4 h-4" />
              Palette (Drag ke Grid)
            </h3>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                  <p className="text-xs text-muted-foreground text-center py-4">Tidak ada guru ditemukan</p>
                ) : (
                  filteredTeachers.map(teacher => (
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
                  <p className="text-xs text-muted-foreground text-center py-4">Tidak ada mapel ditemukan</p>
                ) : (
                  filteredSubjects.map(subject => (
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

          <div className="p-2 border-t bg-muted">
            {pendingChanges.length > 0 && (
              <Badge variant="secondary" className="w-full justify-center">
                {pendingChanges.length} perubahan tertunda
              </Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Edit Modal */}
      {editingCell && (
        <Dialog open={!!editingCell} onOpenChange={(open) => !open && setEditingCell(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Jadwal</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               {/* Mapel Select */}
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="mapel" className="text-right">Mapel</Label>
                <Select value={editMapelId ? editMapelId.toString() : "0"} onValueChange={(v) => setEditMapelId(v === "0" ? null : Number(v))}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Pilih Mapel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Pilih Mapel...</SelectItem>
                    {subjects.filter(s => s.status === 'aktif' && s.id).map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.nama_mapel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Guru Select */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="guru" className="text-right">Guru</Label>
                <Select value={editGuruId ? editGuruId.toString() : "0"} onValueChange={(v) => setEditGuruId(v === "0" ? null : Number(v))}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Pilih Guru" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Pilih Guru...</SelectItem>
                     {teachers.filter(t => t.status === 'aktif' && t.id).map(t => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.nama}</SelectItem>
                     ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Ruang Select */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ruang" className="text-right">Ruang</Label>
<Select value={editRuangId ? editRuangId.toString() : "0"} onValueChange={(v) => setEditRuangId(v === "0" ? null : Number(v))}>
                   <SelectTrigger className="col-span-3">
                     <SelectValue placeholder="Default" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="0">Default</SelectItem>
                    {rooms.filter(r => r.status === 'aktif' && r.id).map(r => (
                      <SelectItem key={r.id} value={r.id.toString()}>{r.kode_ruang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="destructive" onClick={handleCellDelete}>Hapus</Button>
              <Button onClick={handleCellSave}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-background border rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
            onClick={() => handleCopyRow(contextMenu.kelasId)}
          >
            Copy Jadwal
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 disabled:opacity-50"
            onClick={() => handlePasteRow(contextMenu.kelasId)}
            disabled={!copiedRow}
          >
            Paste Jadwal
          </button>
        </div>
      )}
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
                  ? ((activeDragItem.item as Teacher).nip || '-') 
                  : ((activeDragItem.item as Subject).kode_mapel || '-')}
              </p>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default ScheduleGridTable;
