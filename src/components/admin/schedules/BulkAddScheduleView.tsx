import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { TimeInput } from "@/components/ui/time-input";
import { apiCall } from '@/utils/apiClient';
import { Teacher, Subject, Kelas, Room } from '@/types/dashboard';

interface BulkAddScheduleViewProps {
  onBack: () => void;
  onLogout: () => void;
  teachers: Teacher[];
  subjects: Subject[];
  classes: Kelas[];
  rooms: Room[];
  onSuccess: () => void;
}

interface ConflictInfo {
  kelas_id: number;
  kelas_name: string;
  conflict_type: string;
  message: string;
}

export function BulkAddScheduleView({ 
  onBack, 
  onLogout, 
  teachers, 
  subjects, 
  classes, 
  rooms,
  onSuccess 
}: Readonly<BulkAddScheduleViewProps>) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    mapel_id: '',
    guru_ids: [] as number[],
    ruang_id: 'none',
    hari: '',
    jam_mulai: '',
    jam_selesai: '',
    jam_ke: '',
    jenis_aktivitas: 'pelajaran' as const,
    is_absenable: true,
    keterangan_khusus: ''
  });

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // Group classes by tingkat and jurusan for easier selection
  const groupedClasses = classes.reduce((acc, kelas) => {
    // Extract tingkat (X, XI, XII, XIII) from nama_kelas
    const match = kelas.nama_kelas?.match(/^(X{1,3}I{0,2})\s+/i);
    const tingkat = match ? match[1].toUpperCase() : 'Lainnya';
    
    if (!acc[tingkat]) {
      acc[tingkat] = [];
    }
    acc[tingkat].push(kelas);
    return acc;
  }, {} as Record<string, Kelas[]>);

  // Sort tingkat keys
  const tingkatOrder = ['X', 'XI', 'XII', 'Lainnya'];
  const sortedTingkats = Object.keys(groupedClasses).sort((a, b) => {
    return tingkatOrder.indexOf(a) - tingkatOrder.indexOf(b);
  });

  const handleClassToggle = (kelasId: number) => {
    setSelectedClasses(prev => 
      prev.includes(kelasId) 
        ? prev.filter(id => id !== kelasId)
        : [...prev, kelasId]
    );
    setShowPreview(false);
    setConflicts([]);
  };

  const handleSelectAllTingkat = (tingkat: string) => {
    const tingkatClasses = groupedClasses[tingkat]?.map(k => k.id) || [];
    const allSelected = tingkatClasses.every(id => selectedClasses.includes(id));
    
    if (allSelected) {
      setSelectedClasses(prev => prev.filter(id => !tingkatClasses.includes(id)));
    } else {
      setSelectedClasses(prev => [...new Set([...prev, ...tingkatClasses])]);
    }
    setShowPreview(false);
    setConflicts([]);
  };

  const handleAddGuru = (guruId: string) => {
    if (guruId && !formData.guru_ids.includes(Number.parseInt(guruId))) {
      setFormData(prev => ({
        ...prev,
        guru_ids: [...prev.guru_ids, Number.parseInt(guruId)]
      }));
    }
  };

  const handleRemoveGuru = (guruId: number) => {
    setFormData(prev => ({
      ...prev,
      guru_ids: prev.guru_ids.filter(id => id !== guruId)
    }));
  };

  const handlePreview = async () => {
    // Validate form
    if (selectedClasses.length === 0) {
      toast({ title: "Error", description: "Pilih minimal 1 kelas", variant: "destructive" });
      return;
    }
    if (!formData.mapel_id) {
      toast({ title: "Error", description: "Pilih mata pelajaran", variant: "destructive" });
      return;
    }
    if (formData.guru_ids.length === 0) {
      toast({ title: "Error", description: "Pilih minimal 1 guru", variant: "destructive" });
      return;
    }
    if (!formData.hari || !formData.jam_mulai || !formData.jam_selesai || !formData.jam_ke) {
      toast({ title: "Error", description: "Lengkapi semua field waktu", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Check for conflicts via API
      const response = await apiCall<{ data?: { conflicts?: ConflictInfo[] }; conflicts?: ConflictInfo[] }>('/api/admin/jadwal/check-conflicts', {
        method: 'POST',
        body: JSON.stringify({
          kelas_ids: selectedClasses,
          guru_ids: formData.guru_ids,
          hari: formData.hari,
          jam_mulai: formData.jam_mulai,
          jam_selesai: formData.jam_selesai,
          ruang_id: formData.ruang_id === 'none' ? null : Number.parseInt(formData.ruang_id)
        }),
        onLogout
      });

      const conflictList = response.data?.conflicts ?? response.conflicts ?? [];
      setConflicts(conflictList);
      setShowPreview(true);
    } catch (error) {
      // If API doesn't exist yet, just show preview without conflict check
      console.warn('Conflict check API not available, proceeding without check');
      setShowPreview(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const payload = {
        kelas_ids: selectedClasses,
        mapel_id: Number.parseInt(formData.mapel_id),
        guru_ids: formData.guru_ids,
        ruang_id: formData.ruang_id === 'none' ? null : Number.parseInt(formData.ruang_id),
        hari: formData.hari,
        jam_mulai: formData.jam_mulai,
        jam_selesai: formData.jam_selesai,
        jam_ke: Number.parseInt(formData.jam_ke),
        jenis_aktivitas: formData.jenis_aktivitas,
        is_absenable: formData.is_absenable,
        keterangan_khusus: formData.keterangan_khusus
      };

      const response = await apiCall<{ data?: { created?: number; skipped?: number } }>('/api/admin/jadwal/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
        onLogout
      });

      const created = response.data?.created ?? selectedClasses.length;
      const skipped = response.data?.skipped ?? 0;

      toast({
        title: "Berhasil",
        description: skipped > 0
          ? `${created} jadwal ditambahkan, ${skipped} kelas dilewati karena konflik`
          : `Jadwal berhasil ditambahkan ke ${created} kelas`
      });

      onSuccess();
      onBack();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Error",
        description: message || "Gagal menambahkan jadwal",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tambah Jadwal Massal</h1>
          <p className="text-sm text-gray-600">Tambah jadwal yang sama ke beberapa kelas sekaligus</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Selection */}
        <Card className="p-4">
          <h3 className="text-base font-bold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Pilih Kelas ({selectedClasses.length} dipilih)
          </h3>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {sortedTingkats.map(tingkat => (
              <div key={tingkat} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`tingkat-${tingkat}`}
                    checked={groupedClasses[tingkat]?.every(k => selectedClasses.includes(k.id))}
                    onCheckedChange={() => handleSelectAllTingkat(tingkat)}
                  />
                  <Label htmlFor={`tingkat-${tingkat}`} className="font-semibold text-sm cursor-pointer">
                    Tingkat {tingkat} ({groupedClasses[tingkat]?.length || 0} kelas)
                  </Label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 ml-6">
                  {groupedClasses[tingkat]?.map(kelas => (
                    <div key={kelas.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`kelas-${kelas.id}`}
                        checked={selectedClasses.includes(kelas.id)}
                        onCheckedChange={() => handleClassToggle(kelas.id)}
                      />
                      <Label htmlFor={`kelas-${kelas.id}`} className="text-sm cursor-pointer">
                        {kelas.nama_kelas}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Form */}
        <Card className="p-4">
          <h3 className="text-base font-bold mb-3">Detail Jadwal</h3>
          
          <div className="space-y-4">
            {/* Mata Pelajaran */}
            <div>
              <Label className="text-sm font-medium">Mata Pelajaran *</Label>
              <Select 
                value={formData.mapel_id} 
                onValueChange={(value) => setFormData({...formData, mapel_id: value})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih Mata Pelajaran" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.filter(s => s.id).map((subject) => (
                    <SelectItem key={subject.id} value={subject.id.toString()}>
                      {subject.nama_mapel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Guru */}
            <div>
              <Label className="text-sm font-medium">Guru Pengajar *</Label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {formData.guru_ids.map((guruId) => {
                    const teacher = teachers.find(t => t.id === guruId);
                    return teacher ? (
                      <Badge key={guruId} variant="secondary" className="flex items-center gap-1">
                        {teacher.nama}
                        <button
                          type="button"
                          onClick={() => handleRemoveGuru(guruId)}
                          className="ml-1 hover:text-red-600"
                        >
                          ×
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
                <Select value="__placeholder__" onValueChange={handleAddGuru}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tambah guru..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__placeholder__" disabled>Tambah guru...</SelectItem>
                    {teachers.filter(t => t.id && t.status === 'aktif' && !formData.guru_ids.includes(t.id)).map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hari */}
            <div>
              <Label className="text-sm font-medium">Hari *</Label>
              <Select 
                value={formData.hari} 
                onValueChange={(value) => setFormData({...formData, hari: value})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih Hari" />
                </SelectTrigger>
                <SelectContent>
                  {daysOfWeek.map((day) => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Jam */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Jam Mulai *</Label>
                <TimeInput
                  value={formData.jam_mulai}
                  onChange={(val) => setFormData({...formData, jam_mulai: val})}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Jam Selesai *</Label>
                <TimeInput
                  value={formData.jam_selesai}
                  onChange={(val) => setFormData({...formData, jam_selesai: val})}
                />
              </div>
            </div>

            {/* Jam Ke */}
            <div>
              <Label className="text-sm font-medium">Jam Ke- *</Label>
              <Input
                type="number"
                min="1"
                max="12"
                value={formData.jam_ke}
                onChange={(e) => setFormData({...formData, jam_ke: e.target.value})}
                placeholder="Contoh: 1"
                className="mt-1"
              />
            </div>

            {/* Ruang (Optional) */}
            <div>
              <Label className="text-sm font-medium">Ruang (Opsional)</Label>
              <Select 
                value={formData.ruang_id} 
                onValueChange={(value) => setFormData({...formData, ruang_id: value})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih Ruang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada ruang</SelectItem>
                  {rooms.filter(r => r.status === 'aktif').map((room) => (
                    <SelectItem key={room.id} value={room.id.toString()}>
                      {room.kode_ruang} - {room.nama_ruang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      </div>

      {/* Preview Section */}
      {showPreview && (
        <Card className="p-4">
          <h3 className="text-base font-bold mb-3">Preview</h3>
          
          {conflicts.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">Konflik Terdeteksi ({conflicts.length})</span>
              </div>
              <ul className="text-sm text-yellow-700 space-y-1">
                {conflicts.map((conflict, idx) => (
                  <li key={idx}>• {conflict.kelas_name}: {conflict.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm">
              <strong>Kelas:</strong> {selectedClasses.map(id => classes.find(k => k.id === id)?.nama_kelas).join(', ')}
            </p>
            <p className="text-sm">
              <strong>Mapel:</strong> {subjects.find(s => s.id === Number.parseInt(formData.mapel_id))?.nama_mapel}
            </p>
            <p className="text-sm">
              <strong>Guru:</strong> {formData.guru_ids.map(id => teachers.find(t => t.id === id)?.nama).join(', ')}
            </p>
            <p className="text-sm">
              <strong>Waktu:</strong> {formData.hari}, Jam ke-{formData.jam_ke} ({formData.jam_mulai} - {formData.jam_selesai})
            </p>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSubmit} disabled={isLoading}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isLoading ? 'Menyimpan...' : `Tambah ke ${selectedClasses.length} Kelas`}
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Batalkan
            </Button>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      {!showPreview && (
        <div className="flex gap-2">
          <Button onClick={handlePreview} disabled={isLoading || selectedClasses.length === 0}>
            {isLoading ? 'Memproses...' : 'Preview & Cek Konflik'}
          </Button>
          <Button variant="outline" onClick={onBack}>
            Batalkan
          </Button>
        </div>
      )}
    </div>
  );
}

export default BulkAddScheduleView;
