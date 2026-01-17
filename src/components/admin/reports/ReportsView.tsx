import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileText, Download, Users, GraduationCap, ArrowLeft, Loader2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiCall } from '@/utils/apiClient';
import { getApiUrl } from '@/config/api';
import { Kelas } from '@/types/dashboard';

interface ReportsViewProps {
  onBack: () => void;
  onLogout: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onBack, onLogout }) => {
  const [activeTab, setActiveTab] = useState('siswa');
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Student Report State
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedYearStudent, setSelectedYearStudent] = useState<string>(new Date().getFullYear().toString());
  
  // Teacher Report State
  const [selectedYearTeacher, setSelectedYearTeacher] = useState<string>(new Date().getFullYear().toString());

  // Fetch classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoading(true);
        const data = await apiCall('/api/kelas', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        setClasses(data);
      } catch (error) {
        console.error('Error fetching classes:', error);
        toast({
          title: "Gagal memuat data kelas",
          description: "Periksa koneksi internet anda",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, []);

  const handleExportStudentRecap = async () => {
    if (!selectedClassId || !selectedYearStudent) {
      toast({
        title: "Data tidak lengkap",
        description: "Pilih kelas dan tahun ajaran terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    try {
      setExporting(true);
      const params = new URLSearchParams({
        kelas_id: selectedClassId,
        tahun: selectedYearStudent
      });

      // Use the new TEMPLATE-based endpoint
      const response = await fetch(getApiUrl(`/api/export/rekap-ketidakhadiran-kelas-template?${params}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Filename will be set by Content-Disposition header typically, or we fallback
      const className = classes.find(c => c.id.toString() === selectedClassId)?.nama_kelas || 'Kelas';
      a.download = `REKAP_KETIDAKHADIRAN_${className.replace(/ /g, '_')}_${selectedYearStudent}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Berhasil",
        description: "File Excel sedang diunduh...",
        variant: "default" // success
      });

    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export Gagal",
        description: error.message || "Terjadi kesalahan saat mengunduh file",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportTeacherRecap = async () => {
    if (!selectedYearTeacher) {
      toast({
        title: "Data tidak lengkap",
        description: "Pilih tahun ajaran terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    try {
      setExporting(true);
      const params = new URLSearchParams({
        tahun: selectedYearTeacher
      });

      // Use the new TEMPLATE-based endpoint
      const response = await fetch(getApiUrl(`/api/export/rekap-ketidakhadiran-guru-template?${params}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `REKAP_KETIDAKHADIRAN_GURU_${selectedYearTeacher}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Berhasil",
        description: "File Excel Guru sedang diunduh...",
        variant: "default"
      });

    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export Gagal",
        description: error.message || "Terjadi kesalahan saat mengunduh file",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Pusat Laporan & Export
          </h1>
          <p className="text-muted-foreground mt-1">
            Unduh laporan absensi dalam format Excel resmi.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => window.dispatchEvent(new CustomEvent('NAVIGATE_TO', { detail: 'dashboard' }))}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Menu
        </Button>
      </div>

      <Tabs defaultValue="siswa" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="siswa" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Laporan Siswa
          </TabsTrigger>
          <TabsTrigger value="guru" className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            Laporan Guru
          </TabsTrigger>
          <TabsTrigger value="jadwal" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Laporan Jadwal
          </TabsTrigger>
        </TabsList>

        {/* --- STUDENT REPORT TAB --- */}
        <TabsContent value="siswa" className="mt-6 space-y-6">
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-blue-700">
                <FileSpreadsheet className="w-5 h-5" />
                Rekap Ketidakhadiran Semester (Official)
              </CardTitle>
              <CardDescription>
                Export data kehadiran siswa ke format Excel resmi sekolah (Template Kuning/Hijau). 
                Data akan diisikan otomatis ke kolom bulanan, dan total/persentase dihitung oleh rumus Excel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Pilih Kelas</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="-- Pilih Kelas --" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.nama_kelas}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tahun Pelajaran (Awal)</Label>
                  <Input 
                    type="number" 
                    placeholder="2025" 
                    value={selectedYearStudent}
                    onChange={(e) => setSelectedYearStudent(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Contoh: Masukkan 2025 untuk TP 2025-2026</p>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button 
                  onClick={handleExportStudentRecap} 
                  disabled={exporting || !selectedClassId || !selectedYearStudent}
                  className="bg-green-600 hover:bg-green-700 text-white min-w-[200px]"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Memproses Excel...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download Excel (Template)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Informasi Template</AlertTitle>
            <AlertDescription className="text-blue-700">
              Sistem akan otomatis memilih template berdasarkan tingkat kelas (X, XI, XII, XIII). 
              Pastikan file template <code>REKAP KETIDAKHADIRAN KELAS [X/XI/XII] 2025-2026.xlsx</code> sudah tersedia di server.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* --- TEACHER REPORT TAB --- */}
        <TabsContent value="guru" className="mt-6 space-y-6">
          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-amber-700">
                <FileSpreadsheet className="w-5 h-5" />
                Rekap Ketidakhadiran Guru (Tahunan)
              </CardTitle>
              <CardDescription>
                Export rekap kehadiran guru 1 tahun penuh (Juli s/d Juni) menggunakan template resmi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                  <Label>Tahun Pelajaran (Awal)</Label>
                  <Input 
                    type="number" 
                    placeholder="2025" 
                    value={selectedYearTeacher}
                    onChange={(e) => setSelectedYearTeacher(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Contoh: Masukkan 2025 untuk TP 2025-2026</p>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button 
                  onClick={handleExportTeacherRecap} 
                  disabled={exporting || !selectedYearTeacher}
                  className="bg-green-600 hover:bg-green-700 text-white min-w-[200px]"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Memproses Excel...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download Excel (Template)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- SCHEDULE REPORT TAB --- */}
        <TabsContent value="jadwal" className="mt-6 space-y-6">
          <Card className="border-l-4 border-l-indigo-500 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-indigo-700">
                <FileSpreadsheet className="w-5 h-5" />
                Export Matriks Jadwal Pelajaran
              </CardTitle>
              <CardDescription>
                Export seluruh jadwal pelajaran dalam format matriks (3 baris per kelas: Mapel, Ruang, Guru). 
                Format sesuai dengan display di papan informasi/Excel plotting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-indigo-50 border-indigo-200 mb-4">
                <AlertTriangle className="h-4 w-4 text-indigo-600" />
                <AlertTitle className="text-indigo-800">Auto-Generated</AlertTitle>
                <AlertDescription className="text-indigo-700">
                  File ini digenerate langsung dari sistem menggunakan data jadwal aktif. Tidak menggunakan template statis.
                </AlertDescription>
              </Alert>

              <div className="pt-4 flex justify-end">
                <Button 
                  onClick={async () => {
                    try {
                      setExporting(true);
                      const response = await fetch(getApiUrl('/api/export/checklist-jadwal'), {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                      });
                      
                      if (!response.ok) throw new Error('Export failed');
                      
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `JADWAL_MATRIKS_${new Date().getFullYear()}.xlsx`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                      
                      toast({ title: "Export Berhasil", description: "File sedang diunduh...", variant: "default" });
                    } catch (err: any) {
                      toast({ title: "Export Gagal", description: err.message, variant: "destructive" });
                    } finally {
                      setExporting(false);
                    }
                  }}
                  disabled={exporting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[200px]"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Matrix...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download Matriks Excel
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default ReportsView;
