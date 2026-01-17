import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  FileText, Download, Users, GraduationCap, ArrowLeft, Loader2, 
  AlertTriangle, FileSpreadsheet, ClipboardList, MessageSquare, 
  Activity, BarChart3, ChevronLeft 
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiCall } from '@/utils/apiClient';
import { getApiUrl } from '@/config/api';
import { Kelas } from '@/types/dashboard';

interface ReportsViewProps {
  onBack: () => void;
  onLogout: () => void;
}

type ReportViewType = 'menu' | 'student_export' | 'teacher_export' | 'schedule_export' | 'branding' | 'history' | 'analytics';

export const ReportsView: React.FC<ReportsViewProps> = ({ onBack, onLogout }) => {
  const [currentView, setCurrentView] = useState<ReportViewType>('menu');
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

      const response = await fetch(getApiUrl(`/api/export/rekap-ketidakhadiran-kelas-template?${params}`), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const className = classes.find(c => c.id.toString() === selectedClassId)?.nama_kelas || 'Kelas';
      a.download = `REKAP_KETIDAKHADIRAN_${className.replace(/ /g, '_')}_${selectedYearStudent}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: "Export Berhasil", description: "File Excel sedang diunduh...", variant: "default" });
    } catch (error: any) {
      toast({ title: "Export Gagal", description: error.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleExportTeacherRecap = async () => {
    if (!selectedYearTeacher) {
      toast({ title: "Data tidak lengkap", description: "Pilih tahun ajaran terlebih dahulu", variant: "destructive" });
      return;
    }
    try {
      setExporting(true);
      const params = new URLSearchParams({ tahun: selectedYearTeacher });
      const response = await fetch(getApiUrl(`/api/export/rekap-ketidakhadiran-guru-template?${params}`), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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

      toast({ title: "Export Berhasil", description: "File Excel Guru sedang diunduh...", variant: "default" });
    } catch (error: any) {
      toast({ title: "Export Gagal", description: error.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // --- MENU CONFIGURATION ---
  const menuItems = [
    {
      id: 'teacher_summary',
      title: 'Ringkasan Kehadiran Guru',
      desc: 'Tabel H/I/S/A/D dan persentase, filter kelas & tanggal',
      icon: ClipboardList,
      color: 'bg-indigo-600',
      border: 'border-l-indigo-600',
      action: () => toast({ title: "Fitur Segera Hadir", description: "Ringkasan Online Guru belum tersedia." })
    },
    {
      id: 'student_summary',
      title: 'Ringkasan Kehadiran Siswa',
      desc: 'Tabel H/I/S/A/D dan persentase, filter kelas & tanggal',
      icon: Users,
      color: 'bg-emerald-600',
      border: 'border-l-emerald-600',
      action: () => toast({ title: "Fitur Segera Hadir", description: "Ringkasan Online Siswa belum tersedia." })
    },
    {
      id: 'banding',
      title: 'Riwayat Pengajuan Banding Absen',
      desc: 'Laporan history pengajuan banding absensi',
      icon: MessageSquare,
      color: 'bg-red-600',
      border: 'border-l-red-600',
      action: () => setCurrentView('history')
    },
    {
      id: 'student_presence',
      title: 'Presensi Siswa',
      desc: 'Format presensi siswa SMKN 13',
      icon: FileText,
      color: 'bg-slate-700',
      border: 'border-l-slate-700',
      action: () => toast({ title: "Fitur Segera Hadir", description: "Gunakan Rekap Ketidakhadiran untuk export Excel." })
    },
    {
      id: 'student_export',
      title: 'Rekap Ketidakhadiran',
      desc: 'Rekap ketidakhadiran tahunan/bulanan',
      icon: BarChart3,
      color: 'bg-teal-600',
      border: 'border-l-teal-600',
      action: () => setCurrentView('student_export')
    },
    {
      id: 'teacher_export',
      title: 'Rekap Ketidakhadiran Guru',
      desc: 'Format rekap ketidakhadiran guru SMKN 13',
      icon: GraduationCap,
      color: 'bg-orange-600',
      border: 'border-l-orange-600',
      action: () => setCurrentView('teacher_export')
    },
    {
      id: 'monitor_student',
      title: 'Pemantauan Siswa Langsung',
      desc: 'Pantau absensi siswa secara realtime',
      icon: Users,
      color: 'bg-green-600',
      border: 'border-l-green-600',
      action: () => window.dispatchEvent(new CustomEvent('NAVIGATE_TO', { detail: 'monitoring' }))
    },
    {
      id: 'monitor_teacher',
      title: 'Pemantauan Guru Langsung',
      desc: 'Pantau absensi guru secara realtime',
      icon: GraduationCap,
      color: 'bg-purple-600',
      border: 'border-l-purple-600',
      action: () => window.dispatchEvent(new CustomEvent('NAVIGATE_TO', { detail: 'monitoring' }))
    },
    {
      id: 'analytics',
      title: 'Dasbor Analitik',
      desc: 'Analisis dan statistik kehadiran lengkap',
      icon: Activity,
      color: 'bg-orange-500', 
      border: 'border-l-orange-500',
      action: () => setCurrentView('analytics')
    }
  ];

  // --- RENDER MENU VIEW ---
  if (currentView === 'menu') {
    return (
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
           <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.dispatchEvent(new CustomEvent('NAVIGATE_TO', { detail: 'dashboard' }))}
            className="h-10 w-10 text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Menu Laporan</h1>
            <p className="text-muted-foreground text-sm">Pilih jenis laporan yang ingin Anda lihat</p>
          </div>
        </div>

        {/* Grid Menu */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Card 
              key={item.id} 
              className={`border-l-4 ${item.border} hover:shadow-md transition-shadow cursor-pointer group`}
              onClick={item.action}
            >
              <CardContent className="p-6 flex items-start gap-4">
                <div className={`${item.color} p-3 rounded-lg text-white shadow-sm group-hover:scale-105 transition-transform`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1 leading-tight">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // --- RENDER SUB VIEWS ---
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => setCurrentView('menu')} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          Kembali ke Menu Laporan
        </Button>
      </div>

      {currentView === 'student_export' && (
        <Card className="border-l-4 border-l-teal-600 shadow-sm max-w-3xl mx-auto">
          <CardContent className="p-6 space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-xl font-semibold text-teal-700 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Rekap Ketidakhadiran Semester (Official)
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Export data kehadiran siswa ke template Excel resmi sekolah.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Pilih Kelas</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger><SelectValue placeholder="-- Pilih Kelas --" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nama_kelas}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tahun Pelajaran (Awal)</Label>
                <Input type="number" value={selectedYearStudent} onChange={(e) => setSelectedYearStudent(e.target.value)} />
              </div>
            </div>

             <Alert className="bg-teal-50 border-teal-200">
              <AlertTriangle className="h-4 w-4 text-teal-600" />
              <AlertDescription className="text-teal-700 text-xs">
                Sistem otomatis memilih template berdasarkan tingkat kelas (X, XI, XII).
              </AlertDescription>
            </Alert>

            <div className="flex justify-end pt-4">
              <Button onClick={handleExportStudentRecap} disabled={exporting} className="bg-teal-600 hover:bg-teal-700 text-white min-w-[200px]">
                {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</> : <><Download className="w-4 h-4 mr-2" /> Download Excel</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentView === 'teacher_export' && (
         <Card className="border-l-4 border-l-orange-600 shadow-sm max-w-3xl mx-auto">
          <CardContent className="p-6 space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-xl font-semibold text-orange-700 flex items-center gap-2">
                 <GraduationCap className="w-5 h-5" />
                Rekap Ketidakhadiran Guru (Tahunan)
              </h2>
              <p className="text-gray-500 text-sm mt-1">Download rekap kehadiran guru 1 tahun penuh.</p>
            </div>

            <div className="space-y-2 max-w-xs">
              <Label>Tahun Pelajaran (Awal)</Label>
              <Input type="number" value={selectedYearTeacher} onChange={(e) => setSelectedYearTeacher(e.target.value)} />
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleExportTeacherRecap} disabled={exporting} className="bg-orange-600 hover:bg-orange-700 text-white min-w-[200px]">
                {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</> : <><Download className="w-4 h-4 mr-2" /> Download Excel</>}
              </Button>
            </div>
          </CardContent>
         </Card>
      )}

      {currentView === 'history' && (
        <Card className="max-w-3xl mx-auto text-center py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <MessageSquare className="w-16 h-16 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900">Riwayat Banding</h3>
              <p className="text-gray-500 max-w-md">Fitur history pengajuan banding akan ditampilkan di sini.</p>
            </div>
        </Card>
      )}

      {currentView === 'analytics' && (
         <Card className="max-w-3xl mx-auto text-center py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Activity className="w-16 h-16 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900">Dasbor Analitik</h3>
              <p className="text-gray-500 max-w-md">Statistik mendalam kehadiran akan segera tersedia.</p>
            </div>
        </Card>
      )}
    </div>
  );
};

export default ReportsView;
