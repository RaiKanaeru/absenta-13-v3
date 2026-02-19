/**
 * DragPalette - Sidebar palette untuk drag guru/mapel ke grid
 * 
 * Features:
 * - Search guru/mapel
 * - Draggable items
 * - Filter by mapel type
 */

import React, { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, GripVertical, User, BookOpen } from "lucide-react";
import { Teacher, Subject } from '@/types/dashboard';

interface DragPaletteProps {
  teachers: Teacher[];
  subjects: Subject[];
  selectedHari: string;
  conflictMap: Record<number, number[]>; // guru_id -> [jam_ke yang bentrok]
}

interface DraggableItemProps {
  id: string;
  type: 'guru' | 'mapel';
  data: Teacher | Subject;
  isDisabled?: boolean;
}

function DraggableItem({ id, type, data, isDisabled }: Readonly<DraggableItemProps>) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { type, item: data },
    disabled: isDisabled
  });

  const style = {
    opacity: isDragging ? 0.3 : 1,
  };

  const isGuru = type === 'guru';
  const itemData = data as (Teacher & Subject);

  const renderIcon = () => {
    const iconClass = "w-4 h-4 flex-shrink-0";
    if (isGuru) {
      return <User className={`${iconClass} text-blue-500`} />;
    }
    return <BookOpen className={`${iconClass} text-green-500`} />;
  };

  const getDisplayName = () => (isGuru ? itemData.nama : itemData.nama_mapel);
  const getDisplayCode = () => (isGuru ? (itemData.nip || '-') : (itemData.kode_mapel || '-'));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-2 p-2 rounded-lg border border-border bg-background
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab hover:border-primary hover:bg-primary/5'}
        ${isDragging ? 'shadow-lg ring-2 ring-primary' : ''}
      `}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      {renderIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">
          {getDisplayName()}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {getDisplayCode()}
        </p>
      </div>
    </div>
  );
}

export function DragPalette({ 
  teachers, 
  subjects,
  selectedHari,
  conflictMap 
}: Readonly<DragPaletteProps>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('guru');

  const filteredTeachers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return teachers
      .filter(t => t.status === 'aktif')
      .filter(t => 
        t.nama.toLowerCase().includes(term) || 
        (t.nip && t.nip.includes(term))
      )
      .slice(0, 30); // Limit for performance
  }, [teachers, searchTerm]);

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

  return (
    <Card className="w-64 h-full flex flex-col border-l">
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

        <TabsContent value="guru" className="flex-1 overflow-y-auto p-2 space-y-1 m-0">
          {filteredTeachers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Tidak ada guru ditemukan</p>
          ) : (
            filteredTeachers.map(teacher => {
              const hasConflict = conflictMap[teacher.id]?.length > 0;
              return (
                <DraggableItem
                  key={`guru-${teacher.id}`}
                  id={`guru-${teacher.id}`}
                  type="guru"
                  data={teacher}
                  isDisabled={hasConflict}
                />
              );
            })
          )}
        </TabsContent>

        <TabsContent value="mapel" className="flex-1 overflow-y-auto p-2 space-y-1 m-0">
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
      </Tabs>

      <div className="p-2 border-t bg-muted/50">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {selectedHari}
          </Badge>
          <span>• Drag item ke cell</span>
        </div>
      </div>
    </Card>
  );
}

export default DragPalette;
