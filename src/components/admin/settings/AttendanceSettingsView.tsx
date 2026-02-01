
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Clock, AlertTriangle, Save, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiCall, getErrorMessage } from "@/utils/apiClient";

interface AttendanceSettingsViewProps {
  onLogout: () => void;
}

interface SettingsState {
  default_start_time: string;
  late_tolerance_minutes: number;
  enable_late_detection: boolean;
  alpha_voids_day: boolean;
}

export const AttendanceSettingsView: React.FC<Readonly<AttendanceSettingsViewProps>> = ({ onLogout }) => {
  const [settings, setSettings] = useState<SettingsState>({
    default_start_time: '07:00',
    late_tolerance_minutes: 15,
    enable_late_detection: true,
    alpha_voids_day: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: load only on mount
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await apiCall('/api/admin/attendance-settings', { onLogout });
      // Transform API response to state
      // Expected API format: { key: { value: "...", ... }, ... }
      setSettings({
        default_start_time: data.default_start_time?.value || '07:00',
        late_tolerance_minutes: Number.parseInt(data.late_tolerance_minutes?.value || '15'),
        enable_late_detection: data.enable_late_detection?.value === 'true',
        alpha_voids_day: data.alpha_voids_day?.value === 'true'
      });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast({
        title: "Gagal memuat pengaturan",
        description: getErrorMessage(error) || "Terjadi kesalahan saat mengambil data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // API expects object with values as strings/booleans
      // Endpoint: PUT /api/admin/attendance-settings
      // Body: { settings: { key: value, ... } }
      const payload = {
        settings: {
          default_start_time: settings.default_start_time,
          late_tolerance_minutes: settings.late_tolerance_minutes,
          enable_late_detection: settings.enable_late_detection, // API controller converts to string
          alpha_voids_day: settings.alpha_voids_day
        }
      };

      await apiCall('/api/admin/attendance-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
        onLogout
      });

      toast({
        title: "Pengaturan disimpan",
        description: "Perubahan aturan absensi telah diterapkan",
        variant: "default" // Success green usually default or specific success variant depending on theme
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: "Gagal menyimpang",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Pengaturan Absensi
          </h2>
          <p className="text-gray-500">Konfigurasi aturan jam masuk, keterlambatan, dan sanksi sistem.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSettings} disabled={isLoading || isSaving}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-indigo-600" />
            Aturan Waktu & Keterlambatan
          </CardTitle>
          <CardDescription>
            Menentukan batas waktu kehadiran siswa dan toleransi keterlambatan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Deteksi Keterlambatan</Label>
              <p className="text-sm text-gray-500">
                Otomatis tandai siswa sebagai "Terlambat" jika melewati batas toleransi
              </p>
            </div>
            <Switch 
              checked={settings.enable_late_detection}
              onCheckedChange={(checked) => setSettings({...settings, enable_late_detection: checked})}
            />
          </div>
          
          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="start-time">Jam Masuk Default (WIB)</Label>
              <Input 
                id="start-time" 
                type="time" 
                value={settings.default_start_time}
                onChange={(e) => setSettings({...settings, default_start_time: e.target.value})}
                disabled={!settings.enable_late_detection}
              />
              <p className="text-xs text-gray-500">
                Waktu acuan dimulainya jam pelajaran pertama.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tolerance">Toleransi Keterlambatan (Menit)</Label>
              <Input 
                id="tolerance" 
                type="number" 
                min="0"
                max="60"
                value={settings.late_tolerance_minutes}
                onChange={(e) => setSettings({...settings, late_tolerance_minutes: Number.parseInt(e.target.value) || 0})}
                disabled={!settings.enable_late_detection}
              />
              <p className="text-xs text-gray-500">
                Batas waktu tambahan sebelum siswa dianggap terlambat.
                (Contoh: 07:00 + 15 menit = 07:15)
              </p>
            </div>
          </div>

        </CardContent>
      </Card>

      <Card className="border-red-100">
        <CardHeader className="bg-red-50/50">
          <CardTitle className="flex items-center gap-2 text-lg text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Aturan Sanksi & Ketidakhadiran
          </CardTitle>
          <CardDescription className="text-red-700/80">
            Konfigurasi logika sistem saat menangani ketidakhadiran.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base text-red-900">Alpha Menggugurkan Harian</Label>
              <p className="text-sm text-red-700/80">
                Jika siswa memiliki status Alpha di jam pertama/akhir, 
                anggap seluruh hari sebagai Alpha (tidak hadir).
              </p>
            </div>
            <Switch 
              checked={settings.alpha_voids_day}
              onCheckedChange={(checked) => setSettings({...settings, alpha_voids_day: checked})}
              className="data-[state=checked]:bg-red-600"
            />
          </div>

        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button size="lg" onClick={handleSave} disabled={isSaving} className="min-w-[150px]">
          {isSaving ? (
            <>Menyimpan...</>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Simpan Perubahan
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
