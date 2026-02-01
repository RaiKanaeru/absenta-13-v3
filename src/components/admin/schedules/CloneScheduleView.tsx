import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, CheckCircle2, ArrowRight } from "lucide-react";
import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { Schedule, Teacher, Kelas } from '@/types/dashboard';

interface CloneScheduleViewProps {
  onBack: () => void;
  onLogout: () => void;
  schedules: Schedule[];
  teachers: Teacher[];
  classes: Kelas[];
  onSuccess: () => void;
}

interface CloneOptions {
  include_guru: boolean;
  include_ruang: boolean;
}

export function CloneScheduleView({ 
  onBack, 
  onLogout, 
  schedules,
  teachers,
  classes, 
  onSuccess 
}: Readonly<CloneScheduleViewProps>) {
  const [isLoading, setIsLoading] = useState(false);
  const [sourceClassId, setSourceClassId] = useState<string>('');
  const [targetClassIds, setTargetClassIds] = useState<number[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [options, setOptions] = useState<CloneOptions>({
    include_guru: true,
    include_ruang: true
  });

  // Get schedules for source class
  const sourceSchedules = schedules.filter(s => s.kelas_id === Number.parseInt(sourceClassId));

  // Group classes by tingkat for easier selection
  const groupedClasses = classes.reduce((acc, kelas) => {
    const tingkatRegex = /^(X{1,3}I{0,2})\s+/i;
    const match = tingkatRegex.exec(kelas.nama_kelas || '');
    const tingkat = match ? match[1].toUpperCase() : 'Lainnya';
    
    if (!acc[tingkat]) {
      acc[tingkat] = [];
    }
    acc[tingkat].push(kelas);
    return acc;
  }, {} as Record<string, Kelas[]>);

  const tingkatOrder = ['X', 'XI', 'XII', 'XIII', 'Lainnya'];
  const sortedTingkats = Object.keys(groupedClasses).sort((a, b) => {
    return tingkatOrder.indexOf(a) - tingkatOrder.indexOf(b);
  });

  // Note: availableTargetClasses filtering is done inline in the JSX

  const handleTargetToggle = (kelasId: number) => {
    setTargetClassIds(prev => 
      prev.includes(kelasId) 
        ? prev.filter(id => id !== kelasId)
        : [...prev, kelasId]
    );
    setShowPreview(false);
  };

  const handleSelectSimilar = () => {
    // Find classes with similar jurusan as source
    const sourceClass = classes.find(k => k.id === Number.parseInt(sourceClassId));
    if (!sourceClass) return;

    // Extract jurusan from class name (e.g., "RPL" from "X RPL 1")
    const jurusanRegex = /\s+(RPL|TKJ|TJKT|AK|KA)\s*/i;
    const jurusanMatch = jurusanRegex.exec(sourceClass.nama_kelas || '');
    const jurusan = jurusanMatch ? jurusanMatch[1].toUpperCase() : null;

    if (jurusan) {
      const similarClasses = classes
        .filter(k => k.id !== Number.parseInt(sourceClassId))
        .filter(k => k.nama_kelas?.toUpperCase().includes(jurusan))
        .map(k => k.id);
      
      setTargetClassIds(similarClasses);
      toast({
        title: "Info",
        description: `Memilih ${similarClasses.length} kelas dengan jurusan ${jurusan}`
      });
    }
  };

  const handlePreview = () => {
    if (!sourceClassId) {
      toast({ title: "Error", description: "Pilih kelas sumber", variant: "destructive" });
      return;
    }
    if (targetClassIds.length === 0) {
      toast({ title: "Error", description: "Pilih minimal 1 kelas target", variant: "destructive" });
      return;
    }
    if (sourceSchedules.length === 0) {
      toast({ title: "Peringatan", description: "Kelas sumber tidak memiliki jadwal", variant: "destructive" });
      return;
    }
    setShowPreview(true);
  };

  const handleClone = async () => {
    setIsLoading(true);
    try {
      const payload = {
        source_kelas_id: Number.parseInt(sourceClassId),
        target_kelas_ids: targetClassIds,
        include_guru: options.include_guru,
        include_ruang: options.include_ruang
      };

      const response = await apiCall('/api/admin/jadwal/clone', {
        method: 'POST',
        body: JSON.stringify(payload),
        onLogout
      }) as { data?: { created?: number; skipped?: number } };

      const fallbackTotal = sourceSchedules.length * targetClassIds.length;
      const created = response.data?.created ?? fallbackTotal;
      const skipped = response.data?.skipped ?? 0;

      toast({
        title: "Berhasil",
        description: skipped > 0
          ? `${created} jadwal disalin, ${skipped} jadwal dilewati karena konflik`
          : `${created} jadwal berhasil disalin`
      });

      onSuccess();
      onBack();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Error",
        description: errorMessage || "Gagal menyalin jadwal",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sourceClassName = classes.find(k => k.id === Number.parseInt(sourceClassId))?.nama_kelas || 'Belum dipilih';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Salin Jadwal</h1>
          <p className="text-sm text-gray-600">Salin seluruh jadwal dari satu kelas ke kelas lain</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Source Class Selection */}
        <Card className="p-4">
          <h3 className="text-base font-bold mb-3 flex items-center gap-2">
            <Copy className="w-4 h-4" />
            Kelas Sumber
          </h3>
          
          <Select value={sourceClassId} onValueChange={(val) => {
            setSourceClassId(val);
            setTargetClassIds([]);
            setShowPreview(false);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih kelas sumber..." />
            </SelectTrigger>
            <SelectContent>
              {classes.map(kelas => (
                <SelectItem key={kelas.id} value={kelas.id.toString()}>
                  {kelas.nama_kelas} ({schedules.filter(s => s.kelas_id === kelas.id).length} jadwal)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {sourceClassId && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Jadwal yang akan disalin:</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {sourceSchedules.length === 0 ? (
                  <p className="text-sm text-gray-500">Tidak ada jadwal</p>
                ) : (
                  sourceSchedules.map(schedule => (
                    <div key={schedule.id} className="text-xs p-2 bg-gray-50 rounded">
                      <div className="font-medium">{schedule.hari}, Jam {schedule.jam_ke}</div>
                      <div className="text-gray-600">
                        {schedule.nama_mapel} - {schedule.nama_guru}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Arrow */}
        <div className="hidden lg:flex items-center justify-center">
          <ArrowRight className="w-8 h-8 text-gray-400" />
        </div>

        {/* Target Class Selection */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold flex items-center gap-2">
              Kelas Target ({targetClassIds.length} dipilih)
            </h3>
            {sourceClassId && (
              <Button variant="outline" size="sm" onClick={handleSelectSimilar}>
                Pilih Jurusan Sama
              </Button>
            )}
          </div>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {sortedTingkats.map(tingkat => {
              const tingkatClasses = groupedClasses[tingkat]?.filter(k => k.id !== Number.parseInt(sourceClassId)) || [];
              if (tingkatClasses.length === 0) return null;

              return (
                <div key={tingkat} className="space-y-1">
                  <Label className="font-semibold text-sm">Tingkat {tingkat}</Label>
                  <div className="grid grid-cols-2 gap-1 ml-2">
                    {tingkatClasses.map(kelas => (
                      <div key={kelas.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`target-${kelas.id}`}
                          checked={targetClassIds.includes(kelas.id)}
                          onCheckedChange={() => handleTargetToggle(kelas.id)}
                          disabled={!sourceClassId}
                        />
                        <Label htmlFor={`target-${kelas.id}`} className="text-xs cursor-pointer">
                          {kelas.nama_kelas}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Options */}
      <Card className="p-4">
        <h3 className="text-base font-bold mb-3">Opsi Penyalinan</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-guru"
              checked={options.include_guru}
              onCheckedChange={(checked) => setOptions(prev => ({ ...prev, include_guru: !!checked }))}
            />
            <Label htmlFor="include-guru" className="text-sm cursor-pointer">
              Salin guru pengajar
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-ruang"
              checked={options.include_ruang}
              onCheckedChange={(checked) => setOptions(prev => ({ ...prev, include_ruang: !!checked }))}
            />
            <Label htmlFor="include-ruang" className="text-sm cursor-pointer">
              Salin ruang kelas
            </Label>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Jika tidak disalin, guru/ruang akan dikosongkan dan bisa diisi manual nanti
        </p>
      </Card>

      {/* Preview */}
      {showPreview && (
        <Card className="p-4">
          <h3 className="text-base font-bold mb-3">Preview Penyalinan</h3>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm">
              <strong>{sourceSchedules.length} jadwal</strong> dari <strong>{sourceClassName}</strong> akan disalin ke:
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {targetClassIds.map(id => (
                <Badge key={id} variant="secondary">
                  {classes.find(k => k.id === id)?.nama_kelas}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleClone} disabled={isLoading}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isLoading ? 'Menyalin...' : `Salin ${sourceSchedules.length * targetClassIds.length} Jadwal`}
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
          <Button 
            onClick={handlePreview} 
            disabled={isLoading || !sourceClassId || targetClassIds.length === 0}
          >
            Preview Penyalinan
          </Button>
          <Button variant="outline" onClick={onBack}>
            Batalkan
          </Button>
        </div>
      )}
    </div>
  );
}

export default CloneScheduleView;
