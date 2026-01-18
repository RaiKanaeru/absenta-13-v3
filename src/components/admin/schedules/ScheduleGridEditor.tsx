/**
 * ScheduleGridEditor - Interactive Matrix Grid untuk edit jadwal
 * 
 * Features:
 * - Visual grid seperti spreadsheet (Kelas × Jam)
 * - Click cell untuk add/edit jadwal
 * - Drag & Drop dari palette
 * - Filter by hari, tingkat, jurusan
 * - Batch save dengan tombol "Simpan"
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable, DragStartEvent } from '@dnd-kit/core';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, RefreshCw, Calendar, Filter, PanelRightOpen, PanelRightClose, GripVertical, User, BookOpen } from "lucide-react";
import { apiCall } from '@/utils/apiClient';
import { Teacher, Subject, Room } from '@/types/dashboard';
import { DragPalette } from './DragPalette';

// Types
interface JamSlot {
  jam_ke: number;
  jenis: 'pelajaran' | 'istirahat' | 'pembiasaan';
  label?: string;
  jam_mulai: string;
  jam_selesai: string;
}

interface CellData {
  id: number;
  mapel_id: number | null;
  guru_id: number | null;
  ruang_id: number | null;
  kode_mapel: string;
  nama_mapel: string;
  kode_guru: string;
  nama_guru: string;
  kode_ruang: string;
  jenis_aktivitas: string;
}

interface GridRow {
  kelas_id: number;
  nama_kelas: string;
  tingkat: string;
  cells: Record<number, CellData>;
}

interface MatrixData {
  hari: string;
  jam_slots: JamSlot[];
  rows: GridRow[];
}

interface Change {
  kelas_id: number;
  jam_ke: number;
  mapel_id?: number | null;
  guru_id?: number | null;
  ruang_id?: number | null;
  action?: 'delete';
}

interface ScheduleGridEditorProps {
  onBack: () => void;
  onLogout: () => void;
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
}

// Droppable Cell Component
function DroppableCell({ 
  kelasId, 
  jamKe, 
  children, 
  isDisabled 
}: { 
  kelasId: number; 
  jamKe: number; 
  children: React.ReactNode;
  isDisabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${kelasId}-${jamKe}`,
    data: { kelasId, jamKe },
    disabled: isDisabled
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`h-full ${isOver && !isDisabled ? 'ring-2 ring-blue-500 bg-blue-100' : ''}`}
    >
      {children}
    </div>
  );
}

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const TINGKAT_LIST = ['X', 'XI', 'XII', 'XIII'];

export function ScheduleGridEditor({ 
  onBack, 
  onLogout,
  teachers,
  subjects,
  rooms
}: Readonly<ScheduleGridEditorProps>) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedHari, setSelectedHari] = useState('Senin');
  const [selectedTingkat, setSelectedTingkat] = useState<string>('all');
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Change[]>([]);
  const [editingCell, setEditingCell] = useState<{kelas_id: number; jam_ke: number} | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  
  // Copy-paste state
  const [copiedRow, setCopiedRow] = useState<{kelas_id: number; cells: Record<number, CellData>} | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; kelasId: number} | null>(null);
  
  // Edit modal state
  const [editMapelId, setEditMapelId] = useState<number | null>(null);
  const [editGuruId, setEditGuruId] = useState<number | null>(null);
  const [editRuangId, setEditRuangId] = useState<number | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Build conflict map for palette (which guru is busy at which jam)
  const conflictMap = useMemo(() => {
    const map: Record<number, number[]> = {};
    if (!matrixData) return map;

    for (const row of matrixData.rows) {
      for (const [jamKeStr, cell] of Object.entries(row.cells)) {
        if (cell.guru_id) {
          if (!map[cell.guru_id]) map[cell.guru_id] = [];
          map[cell.guru_id].push(Number(jamKeStr));
        }
      }
    }
    return map;
  }, [matrixData]);

  const fetchMatrix = useCallback(async () => {
    setIsLoading(true);
/**
 * ScheduleGridEditor - Interactive Matrix Grid untuk edit jadwal
 * 
 * Features:
 * - Visual grid seperti spreadsheet (Kelas × Jam)
 * - Click cell untuk add/edit jadwal
 * - Drag & Drop dari palette
 * - Filter by hari, tingkat, jurusan
 * - Batch save dengan tombol "Simpan"
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable, DragStartEvent } from '@dnd-kit/core';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, RefreshCw, Calendar, Filter, PanelRightOpen, PanelRightClose, GripVertical, User, BookOpen } from "lucide-react";
import { apiCall } from '@/utils/apiClient';
import { Teacher, Subject, Room } from '@/types/dashboard';
import { DragPalette } from './DragPalette';

// Types
interface JamSlot {
  jam_ke: number;
  jenis: 'pelajaran' | 'istirahat' | 'pembiasaan';
  label?: string;
  jam_mulai: string;
  jam_selesai: string;
}

interface CellData {
  id: number;
  mapel_id: number | null;
  guru_id: number | null;
  ruang_id: number | null;
  kode_mapel: string;
  nama_mapel: string;
  kode_guru: string;
  nama_guru: string;
  kode_ruang: string;
  jenis_aktivitas: string;
}

interface GridRow {
  kelas_id: number;
  nama_kelas: string;
  tingkat: string;
  cells: Record<number, CellData>;
}

interface MatrixData {
  hari: string;
  jam_slots: JamSlot[];
  rows: GridRow[];
}

interface Change {
  kelas_id: number;
  jam_ke: number;
  mapel_id?: number | null;
  guru_id?: number | null;
  ruang_id?: number | null;
  action?: 'delete';
}

interface ScheduleGridEditorProps {
  onBack: () => void;
  onLogout: () => void;
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
}

// Droppable Cell Component
function DroppableCell({ 
  kelasId, 
  jamKe, 
  children, 
  isDisabled 
}: { 
  kelasId: number; 
  jamKe: number; 
  children: React.ReactNode;
  isDisabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${kelasId}-${jamKe}`,
    data: { kelasId, jamKe },
    disabled: isDisabled
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`h-full ${isOver && !isDisabled ? 'ring-2 ring-blue-500 bg-blue-100' : ''}`}
    >
      {children}
    </div>
  );
}

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const TINGKAT_LIST = ['X', 'XI', 'XII', 'XIII'];

export function ScheduleGridEditor({ 
  onBack, 
  onLogout,
  teachers,
  subjects,
  rooms
}: Readonly<ScheduleGridEditorProps>) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedHari, setSelectedHari] = useState('Senin');
  const [selectedTingkat, setSelectedTingkat] = useState<string>('all');
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Change[]>([]);
  const [editingCell, setEditingCell] = useState<{kelas_id: number; jam_ke: number} | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  
  // Copy-paste state
  const [copiedRow, setCopiedRow] = useState<{kelas_id: number; cells: Record<number, CellData>} | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; kelasId: number} | null>(null);
  
  // Edit modal state
  const [editMapelId, setEditMapelId] = useState<number | null>(null);
  const [editGuruId, setEditGuruId] = useState<number | null>(null);
  const [editRuangId, setEditRuangId] = useState<number | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Build conflict map for palette (which guru is busy at which jam)
  const conflictMap = useMemo(() => {
    const map: Record<number, number[]> = {};
    if (!matrixData) return map;

    for (const row of matrixData.rows) {
      for (const [jamKeStr, cell] of Object.entries(row.cells)) {
        if (cell.guru_id) {
          if (!map[cell.guru_id]) map[cell.guru_id] = [];
          map[cell.guru_id].push(Number(jamKeStr));
        }
      }
    }
    return map;
  }, [matrixData]);

  const fetchMatrix = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ hari: selectedHari });
      if (selectedTingkat !== 'all') {
        params.append('tingkat', selectedTingkat);
      }

      const response = await apiCall<{ data?: MatrixData }>(`/api/admin/jadwal/matrix?${params}`, {
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
  }, [selectedHari, selectedTingkat, onLogout]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  // Drag State
  const [activeDragItem, setActiveDragItem] = useState<{ id: string; type: 'guru' | 'mapel'; item: Teacher | Subject } | null>(null);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const { type, item } = active.data.current || {};
    if (type && item) {
      setActiveDragItem({ id: active.id as string, type, item });
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null); // Reset
    const { active, over } = event;
    
    if (!over || !active.data.current) return;

    const dropData = over.data.current as { kelasId: number; jamKe: number };
    const dragData = active.data.current as { type: 'guru' | 'mapel'; item: Teacher | Subject };

    if (!dropData.kelasId || dropData.jamKe === undefined) return;

    // Open edit modal with pre-filled data
    setEditingCell({ kelas_id: dropData.kelasId, jam_ke: dropData.jamKe });
    
    if (dragData.type === 'guru') {
      const guru = dragData.item as Teacher;
      setEditGuruId(guru.id);
      setEditMapelId(null);
      setEditRuangId(null);
    } else {
      const mapel = dragData.item as Subject;
      setEditMapelId(mapel.id);
      setEditGuruId(null);
      setEditRuangId(null);
    }

    toast({ title: "Info", description: "Lengkapi data jadwal di modal" });
  };

  const handleCellClick = (kelas_id: number, jam_ke: number, currentData?: CellData) => {
    setEditingCell({ kelas_id, jam_ke });
    setEditMapelId(currentData?.mapel_id || null);
    setEditGuruId(currentData?.guru_id || null);
    setEditRuangId(currentData?.ruang_id || null);
  };

  const handleCellSave = () => {
    if (!editingCell) return;

    const { kelas_id, jam_ke } = editingCell;

    const filtered = pendingChanges.filter(c => !(c.kelas_id === kelas_id && c.jam_ke === jam_ke));

    if (editMapelId && editGuruId) {
      filtered.push({
        kelas_id,
        jam_ke,
        mapel_id: editMapelId,
        guru_id: editGuruId,
        ruang_id: editRuangId
      });
    }

    setPendingChanges(filtered);

    // Optimistic UI update
    if (matrixData) {
      const newRows = matrixData.rows.map(row => {
        if (row.kelas_id === kelas_id) {
          const selectedMapel = subjects.find(s => s.id === editMapelId);
          const selectedGuru = teachers.find(t => t.id === editGuruId);
          const selectedRoom = rooms.find(r => r.id === editRuangId);

          const newCells = { ...row.cells };
          if (editMapelId && editGuruId) {
            newCells[jam_ke] = {
              id: 0,
              mapel_id: editMapelId,
              guru_id: editGuruId,
              ruang_id: editRuangId,
              kode_mapel: selectedMapel?.kode_mapel || '',
              nama_mapel: selectedMapel?.nama_mapel || '',
              kode_guru: selectedGuru?.nama?.substring(0, 4) || '',
              nama_guru: selectedGuru?.nama || '',
              kode_ruang: selectedRoom?.kode_ruang || '',
              jenis_aktivitas: 'pelajaran'
            };
          }
          return { ...row, cells: newCells };
        }
        return row;
      });
      setMatrixData({ ...matrixData, rows: newRows });
    }

    setEditingCell(null);
  };

  const handleCellDelete = () => {
    if (!editingCell) return;

    const { kelas_id, jam_ke } = editingCell;

    const filtered = pendingChanges.filter(c => !(c.kelas_id === kelas_id && c.jam_ke === jam_ke));
    filtered.push({ kelas_id, jam_ke, action: 'delete' });
    setPendingChanges(filtered);

    if (matrixData) {
      const newRows = matrixData.rows.map(row => {
        if (row.kelas_id === kelas_id) {
          const newCells = { ...row.cells };
          delete newCells[jam_ke];
          return { ...row, cells: newCells };
        }
        return row;
      });
      setMatrixData({ ...matrixData, rows: newRows });
    }

    setEditingCell(null);
  };

  const handleSaveAll = async () => {
    if (pendingChanges.length === 0) {
      toast({ title: "Info", description: "Tidak ada perubahan untuk disimpan" });
      return;
    }

    setIsSaving(true);
    try {
      await apiCall('/api/admin/jadwal/matrix/update', {
        method: 'POST',
        body: JSON.stringify({ hari: selectedHari, changes: pendingChanges }),
        onLogout
      });

      toast({ title: "Berhasil", description: `${pendingChanges.length} perubahan disimpan` });
      setPendingChanges([]);
      fetchMatrix();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal menyimpan';
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Copy row handler
  const handleCopyRow = (kelasId: number) => {
    const row = matrixData?.rows.find(r => r.kelas_id === kelasId);
    if (row) {
      setCopiedRow({ kelas_id: kelasId, cells: { ...row.cells } });
      toast({ title: "Copied", description: `Jadwal ${row.nama_kelas} disalin` });
    }
    setContextMenu(null);
  };

  // Paste row handler
  const handlePasteRow = (targetKelasId: number) => {
    if (!copiedRow || !matrixData) {
      toast({ title: "Info", description: "Tidak ada jadwal yang disalin" });
      return;
    }

    const newChanges: Change[] = [];
    const sourceRow = matrixData.rows.find(r => r.kelas_id === copiedRow.kelas_id);
    
    // Create changes for each cell in copied row
    for (const [jamKeStr, cell] of Object.entries(copiedRow.cells)) {
      const jamKe = Number(jamKeStr);
      newChanges.push({
        kelas_id: targetKelasId,
        jam_ke: jamKe,
        mapel_id: cell.mapel_id,
        guru_id: cell.guru_id,
        ruang_id: cell.ruang_id
      });
    }

    setPendingChanges([...pendingChanges, ...newChanges]);

    // Optimistic UI update
    const newRows = matrixData.rows.map(row => {
      if (row.kelas_id === targetKelasId) {
        return { ...row, cells: { ...copiedRow.cells } };
      }
      return row;
    });
    setMatrixData({ ...matrixData, rows: newRows });

    toast({ 
      title: "Pasted", 
      description: `Jadwal dari ${sourceRow?.nama_kelas || 'kelas'} ditempel` 
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

  const getCellBgColor = (cell: CellData | undefined, jamSlot: JamSlot) => {
    if (jamSlot.jenis === 'istirahat') return 'bg-gray-200';
    if (jamSlot.jenis === 'pembiasaan') return 'bg-purple-100';
    if (!cell) return 'bg-white hover:bg-blue-50';
    if (cell.jenis_aktivitas === 'upacara') return 'bg-yellow-100';
    return 'bg-green-50';
  };

  const renderEmptyState = () => (
    <div className="p-8 text-center text-gray-500">Tidak ada data kelas</div>
  );

  const renderLoadingState = () => (
    <div className="p-8 text-center text-gray-500">Memuat data...</div>
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-[calc(100vh-120px)]">
        {/* Main Content */}
        <div className={`flex-1 flex flex-col space-y-4 ${showPalette ? 'mr-64' : ''}`}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Grid Editor Jadwal</h1>
                <p className="text-sm text-gray-600">Klik cell atau drag dari palette</p>
              </div>
            </div>
            <div className="flex gap-2">
              {pendingChanges.length > 0 && (
                <Badge variant="secondary" className="animate-pulse">
                  {pendingChanges.length} pending
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowPalette(!showPalette)}>
                {showPalette ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={fetchMatrix} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={handleSaveAll} disabled={isSaving || pendingChanges.length === 0}>
                <Save className="w-4 h-4 mr-2" />
                Simpan
              </Button>
            </div>
          </div>

          {/* Toolbar */}
          <Card className="p-3 flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <Select value={selectedHari} onValueChange={setSelectedHari}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HARI_LIST.map(h => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={selectedTingkat} onValueChange={setSelectedTingkat}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {TINGKAT_LIST.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto text-xs">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-50 border rounded" /><span>Pelajaran</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-100 border rounded" /><span>Pembiasaan</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-200 border rounded" /><span>Istirahat</span></div>
            </div>
          </Card>

          {/* Grid */}
          <Card className="flex-1 overflow-hidden">
            <div ref={containerRef} className="h-full overflow-auto">
              {isLoading && renderLoadingState()}
              {!isLoading && (!matrixData || matrixData.rows.length === 0) && renderEmptyState()}
              {!isLoading && matrixData && matrixData.rows.length > 0 && (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-gray-100">
                      <th className="border p-2 sticky left-0 bg-gray-100 z-30 min-w-28">Kelas</th>
                      {matrixData.jam_slots.map(slot => (
                        <th 
                          key={slot.jam_ke} 
                          className={`border p-2 min-w-16 ${slot.jenis === 'istirahat' ? 'bg-gray-300' : ''}`}
                        >
                          {slot.jenis === 'istirahat' ? (
                            <span className="text-gray-600 text-xs">{slot.label || 'Ist.'}</span>
                          ) : (
                            <>
                              <div>J{slot.jam_ke}</div>
                              <div className="text-gray-500 font-normal text-xs">{slot.jam_mulai?.slice(0,5)}</div>
                            </>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.rows.map(row => (
                      <tr key={row.kelas_id} className="hover:bg-gray-50">
                        <td 
                          className="border p-1 font-medium sticky left-0 bg-white z-10 text-xs cursor-context-menu"
                          onContextMenu={(e) => handleRowContextMenu(e, row.kelas_id)}
                          title="Klik kanan untuk Copy/Paste"
                        >
                          {row.nama_kelas}
                          {copiedRow?.kelas_id === row.kelas_id && (
                            <span className="ml-1 text-blue-500">Copy</span>
                          )}
                        </td>
                        {matrixData.jam_slots.map(slot => {
                          const cell = row.cells[slot.jam_ke];
                          return (
                            <td 
                              key={slot.jam_ke}
                              className={`border p-0 relative min-w-16 h-16 transition-colors ${getCellBgColor(cell, slot)}`}
                              onClick={() => handleCellClick(row.kelas_id, slot.jam_ke, cell)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleCellClick(row.kelas_id, slot.jam_ke, cell);
                                }
                              }}
                            >
                              <DroppableCell kelasId={row.kelas_id} jamKe={slot.jam_ke} isDisabled={slot.jenis !== 'pelajaran'}>
                                {cell && cell.jenis_aktivitas === 'pelajaran' && (
                                  <div className="p-1 text-[10px] leading-tight space-y-1">
                                    <div className="font-bold truncate text-blue-700">{cell.nama_mapel}</div>
                                    <div className="text-gray-600 truncate">{cell.nama_guru}</div>
                                    {cell.kode_ruang && <div className="text-gray-400">{cell.kode_ruang}</div>}
                                  </div>
                                )}
                              </DroppableCell>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        {/* Palette Sidebar */}
        {showPalette && (
          <div className="fixed right-0 top-0 h-full pt-16">
            <DragPalette
              teachers={teachers}
              subjects={subjects}
              selectedHari={selectedHari}
              conflictMap={conflictMap}
            />
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-4 w-80 space-y-4">
            <h3 className="font-bold">
              {matrixData?.rows.find(r => r.kelas_id === editingCell.kelas_id)?.nama_kelas} - J{editingCell.jam_ke}
            </h3>
            
            <div>
              <label htmlFor="edit-mapel" className="text-sm font-medium">Mapel *</label>
              <Select value={editMapelId?.toString() || ''} onValueChange={(v) => setEditMapelId(Number(v))}>
                <SelectTrigger id="edit-mapel">
                  <SelectValue placeholder="Pilih Mapel" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.filter(s => s.status === 'aktif').map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.nama_mapel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="edit-guru" className="text-sm font-medium">Guru *</label>
              <Select value={editGuruId?.toString() || ''} onValueChange={(v) => setEditGuruId(Number(v))}>
                <SelectTrigger id="edit-guru">
                  <SelectValue placeholder="Pilih Guru" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.filter(t => t.status === 'aktif').map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="edit-ruang" className="text-sm font-medium">Ruang</label>
              <Select value={editRuangId?.toString() || ''} onValueChange={(v) => setEditRuangId(v ? Number(v) : null)}>
                <SelectTrigger id="edit-ruang">
                  <SelectValue placeholder="Ruang Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Default</SelectItem>
                  {rooms.filter(r => r.status === 'aktif').map(r => (
                    <SelectItem key={r.id} value={r.id.toString()}>{r.kode_ruang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleCellSave} disabled={!editMapelId || !editGuruId} className="flex-1">
                Simpan
              </Button>
              <Button variant="destructive" onClick={handleCellDelete}>
                Hapus
              </Button>
              <Button variant="outline" onClick={() => setEditingCell(null)}>
                Batal
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => handleCopyRow(contextMenu.kelasId)}
          >
            Copy Jadwal
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
            onClick={() => handlePasteRow(contextMenu.kelasId)}
            disabled={!copiedRow}
          >
            Paste Jadwal
          </button>
        </div>
      )}

      <DragOverlay>
        {activeDragItem ? (
          <div className="flex items-center gap-2 p-2 rounded-lg border bg-white shadow-xl opacity-90 w-48 pointer-events-none ring-2 ring-blue-500">
            <GripVertical className="w-3 h-3 text-gray-400 flex-shrink-0" />
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
              <p className="text-xs text-gray-500 truncate">
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

export default ScheduleGridEditor;
