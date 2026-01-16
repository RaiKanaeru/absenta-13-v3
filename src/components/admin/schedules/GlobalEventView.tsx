/**
 * GlobalEventView - Manage pembiasaan pagi dan aktivitas khusus untuk semua kelas
 * 
 * Fitur:
 * - Bulk insert upacara/tadarus/sholat dhuha ke semua kelas
 * - Preview sebelum eksekusi
 * - Support jam ke-0 (pembiasaan) dan jam ke-1 (upacara Senin)
 */

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { TimeInput } from "@/components/ui/time-input";
import { apiCall } from '@/utils/apiClient';
import { Kelas } from '@/types/dashboard';

interface GlobalEventViewProps {
  onBack: () => void;
  onLogout: () => void;
  classes: Kelas[];
  onSuccess: () => void;
}

interface EventTemplate {
  hari: string;
  jam_ke: number;
  label: string;
  jam_mulai: string;
  jam_selesai: string;
  jenis_aktivitas: string;
}

// Preset aktivitas khusus berdasarkan hasil diskusi
const EVENT_PRESETS: EventTemplate[] = [
  { hari: 'Senin', jam_ke: 1, label: 'UPACARA/PERWALIAN', jam_mulai: '06:30', jam_selesai: '07:15', jenis_aktivitas: 'upacara' },
  { hari: 'Selasa', jam_ke: 0, label: 'TADARUS & SARAPAN', jam_mulai: '06:30', jam_selesai: '07:00', jenis_aktivitas: 'kegiatan_khusus' },
  { hari: 'Rabu', jam_ke: 0, label: 'SHOLAT DHUHA', jam_mulai: '06:30', jam_selesai: '07:00', jenis_aktivitas: 'kegiatan_khusus' },
  { hari: 'Kamis', jam_ke: 0, label: 'TADARUS & LITERASI', jam_mulai: '06:30', jam_selesai: '07:00', jenis_aktivitas: 'kegiatan_khusus' },
  { hari: 'Jumat', jam_ke: 0, label: 'JUMAT BERSIH', jam_mulai: '06:30', jam_selesai: '07:00', jenis_aktivitas: 'kegiatan_khusus' },
];

export function GlobalEventView({ 
  onBack, 
  onLogout, 
  classes, 
  onSuccess 
}: Readonly<GlobalEventViewProps>) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<EventTemplate | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customJamMulai, setCustomJamMulai] = useState('06:30');
  const [customJamSelesai, setCustomJamSelesai] = useState('07:00');
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [existingEvents, setExistingEvents] = useState<Record<string, number>>({});

  // Group classes by tingkat
  const groupedClasses = classes.reduce((acc, kelas) => {
    const tingkat = kelas.tingkat || 'Lainnya';
    if (!acc[tingkat]) acc[tingkat] = [];
    acc[tingkat].push(kelas);
    return acc;
  }, {} as Record<string, Kelas[]>);

  const tingkatOrder = ['X', 'XI', 'XII', 'XIII', 'Lainnya'];
  const sortedTingkats = Object.keys(groupedClasses).sort((a, b) => 
    tingkatOrder.indexOf(a) - tingkatOrder.indexOf(b)
  );

  // Auto-select all classes on mount
  useEffect(() => {
    if (selectAll) {
      setSelectedClassIds(classes.map(k => k.id));
    }
  }, [classes, selectAll]);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setSelectedClassIds(checked ? classes.map(k => k.id) : []);
  };

  const handleClassToggle = (kelasId: number) => {
    setSelectedClassIds(prev => 
      prev.includes(kelasId) 
        ? prev.filter(id => id !== kelasId)
        : [...prev, kelasId]
    );
    setSelectAll(false);
  };

  const handlePresetSelect = (preset: EventTemplate) => {
    setSelectedPreset(preset);
    setCustomLabel(preset.label);
    setCustomJamMulai(preset.jam_mulai);
    setCustomJamSelesai(preset.jam_selesai);
    setShowPreview(false);
  };

  const handlePreview = async () => {
    if (!selectedPreset) {
      toast({ title: "Error", description: "Pilih jenis aktivitas dulu", variant: "destructive" });
      return;
    }
    if (selectedClassIds.length === 0) {
      toast({ title: "Error", description: "Pilih minimal 1 kelas", variant: "destructive" });
      return;
    }

    // Check for existing events
    setIsLoading(true);
    try {
      const response = await apiCall('/api/admin/jadwal', {
        method: 'GET',
        onLogout
      }) as { data?: Array<{ kelas_id: number; hari: string; jam_ke: number }> };

      const schedules = response.data || [];
      const existing: Record<string, number> = {};

      for (const kelasId of selectedClassIds) {
        const hasEvent = schedules.some((s: { kelas_id: number; hari: string; jam_ke: number }) => 
          s.kelas_id === kelasId && 
          s.hari === selectedPreset.hari && 
          s.jam_ke === selectedPreset.jam_ke
        );
        if (hasEvent) {
          existing[kelasId] = 1;
        }
      }

      setExistingEvents(existing);
      setShowPreview(true);
    } catch (error) {
      console.error('Error checking existing events:', error);
      setShowPreview(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPreset) return;

    setIsLoading(true);
    try {
      // Filter out classes that already have events
      const classesToInsert = selectedClassIds.filter(id => !existingEvents[id]);

      if (classesToInsert.length === 0) {
        toast({ 
          title: "Info", 
          description: "Semua kelas sudah memiliki jadwal pada waktu tersebut",
          variant: "destructive"
        });
        return;
      }

      const payload = {
        kelas_ids: classesToInsert,
        hari: selectedPreset.hari,
        jam_ke: selectedPreset.jam_ke,
        jam_mulai: customJamMulai,
        jam_selesai: customJamSelesai,
        jenis_aktivitas: selectedPreset.jenis_aktivitas,
        keterangan_khusus: customLabel,
        is_absenable: false, // Global events tidak diabsen
        mapel_id: null,
        guru_ids: []
      };

      await apiCall('/api/admin/jadwal/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
        onLogout
      });

      toast({
        title: "Berhasil",
        description: `${customLabel} ditambahkan ke ${classesToInsert.length} kelas`
      });

      onSuccess();
      onBack();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal menambahkan jadwal';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const skippedCount = Object.keys(existingEvents).length;
  const insertCount = selectedClassIds.length - skippedCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kelola Aktivitas Global</h1>
          <p className="text-sm text-gray-600">Tambahkan upacara, tadarus, atau pembiasaan ke semua kelas sekaligus</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preset Selection */}
        <Card className="p-4">
          <h3 className="text-base font-bold mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Pilih Aktivitas
          </h3>
          
          <div className="space-y-2">
            {EVENT_PRESETS.map((preset) => (
              <button
                type="button"
                key={`${preset.hari}-${preset.jam_ke}`}
                onClick={() => handlePresetSelect(preset)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  selectedPreset?.hari === preset.hari && selectedPreset?.jam_ke === preset.jam_ke
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant={preset.jam_ke === 0 ? 'secondary' : 'default'} className="mb-1">
                      {preset.hari} - Jam {preset.jam_ke}
                    </Badge>
                    <p className="font-medium">{preset.label}</p>
                    <p className="text-xs text-gray-500">{preset.jam_mulai} - {preset.jam_selesai}</p>
                  </div>
                  {selectedPreset?.hari === preset.hari && selectedPreset?.jam_ke === preset.jam_ke && (
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {selectedPreset && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div>
                <Label>Label/Nama Aktivitas</Label>
                <Input 
                  value={customLabel} 
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Contoh: UPACARA BENDERA"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Jam Mulai</Label>
                  <TimeInput value={customJamMulai} onChange={setCustomJamMulai} />
                </div>
                <div>
                  <Label>Jam Selesai</Label>
                  <TimeInput value={customJamSelesai} onChange={setCustomJamSelesai} />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Class Selection */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Kelas Target ({selectedClassIds.length}/{classes.length})
            </h3>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="select-all"
                checked={selectAll}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
              />
              <Label htmlFor="select-all" className="text-sm cursor-pointer">Semua</Label>
            </div>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {sortedTingkats.map(tingkat => (
              <div key={tingkat} className="space-y-1">
                <Label className="font-semibold text-sm text-gray-600">Tingkat {tingkat}</Label>
                <div className="grid grid-cols-2 gap-1 ml-2">
                  {groupedClasses[tingkat]?.map(kelas => (
                    <div key={kelas.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`class-${kelas.id}`}
                        checked={selectedClassIds.includes(kelas.id)}
                        onCheckedChange={() => handleClassToggle(kelas.id)}
                      />
                      <Label htmlFor={`class-${kelas.id}`} className="text-xs cursor-pointer">
                        {kelas.nama_kelas}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Preview */}
      {showPreview && selectedPreset && (
        <Card className="p-4">
          <h3 className="text-base font-bold mb-3">Preview</h3>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm">
              <strong>{customLabel}</strong> pada <strong>{selectedPreset.hari}</strong> jam <strong>{customJamMulai} - {customJamSelesai}</strong>
            </p>
            <p className="text-sm mt-1">
              Akan ditambahkan ke <strong>{insertCount}</strong> kelas
            </p>
          </div>

          {skippedCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-800">
                <strong>{skippedCount} kelas</strong> sudah memiliki jadwal pada waktu tersebut dan akan dilewati
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={isLoading || insertCount === 0}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isLoading ? 'Menambahkan...' : `Tambahkan ke ${insertCount} Kelas`}
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Batal
            </Button>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      {!showPreview && (
        <div className="flex gap-2">
          <Button 
            onClick={handlePreview} 
            disabled={isLoading || !selectedPreset || selectedClassIds.length === 0}
          >
            Preview
          </Button>
          <Button variant="outline" onClick={onBack}>
            Batal
          </Button>
        </div>
      )}
    </div>
  );
}

export default GlobalEventView;
