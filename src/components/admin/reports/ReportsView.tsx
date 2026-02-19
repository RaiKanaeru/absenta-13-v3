import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, Users, GraduationCap, Loader2, 
  FileSpreadsheet, ClipboardList, MessageSquare, 
  Activity, BarChart3, ArrowLeft, AlertCircle 
} from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from '@/hooks/use-toast';
import { downloadExcelFromApi } from '@/utils/exportUtils';
import BandingAbsenReportView from './BandingAbsenReportView';
import { TeacherAttendanceSummaryView } from './TeacherAttendanceSummaryView';
import { LaporanKehadiranSiswaView } from '@/components/teacher/LaporanKehadiranSiswaView';
import { PresensiSiswaSMKN13View } from '@/components/teacher/PresensiSiswaSMKN13View';
import { RekapKetidakhadiranView } from '@/components/teacher/RekapKetidakhadiranView';
import { LiveStudentAttendanceView } from './LiveStudentAttendanceView';
import { LiveTeacherAttendanceView } from './LiveTeacherAttendanceView';
import { AnalyticsDashboardView } from './AnalyticsDashboardView';


type ReportViewType =
  | 'menu' 
  | 'student_export' // Maps to RekapKetidakhadiranView
  | 'teacher_export' // Keep existing or map to something else if needed. Current mapping in menuItems is 'teacher_export'
  | 'teacher_summary' 
  | 'student_summary'
  | 'student_presence'
  | 'branding' 
  | 'history' 
  | 'monitor_student'
  | 'monitor_teacher'
  | 'analytics';

export const ReportsView: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState<ReportViewType>('menu');
  // ... (keep existing state for inline defined views if any, though we are replacing most)
  // We can remove the inline 'student_export' and 'teacher_export' handling logic if we replace them completely. 
  // However, the original code had inline UI for 'student_export' and 'teacher_export'.
  // The 'rekap ketidakhadiran' (student_export) is now RekapKetidakhadiranView.
  
  // Let's keep the existing logic for 'teacher_export' since we didn't find a component for it,
  // BUT for 'student_export', we should switch to `RekapKetidakhadiranView` as planned.

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selectedYearTeacher, setSelectedYearTeacher] = useState<string>(new Date().getFullYear().toString());


  // Handler for teacher export
  const handleExportTeacherRecap = async () => {
     if (!selectedYearTeacher) {
      toast({ title: "Data tidak lengkap", description: "Pilih tahun ajaran terlebih dahulu", variant: "destructive" });
      return;
    }
    try {
      setExporting(true);
      setExportError('');
      const params = new URLSearchParams({ tahun: selectedYearTeacher });
      await downloadExcelFromApi(
        '/api/export/rekap-ketidakhadiran-guru-template',
        `REKAP_KETIDAKHADIRAN_GURU_${selectedYearTeacher}.xlsx`,
        params
      );
      toast({ title: "Export Berhasil", description: "File Excel Guru sedang diunduh...", variant: "default" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(message);
      toast({ title: "Export Gagal", description: message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const menuItems = [
    {
      id: 'teacher_summary',
      title: 'Ringkasan Kehadiran Guru',
      desc: 'Tabel H/I/S/A/D dan persentase, filter kelas & tanggal',
      icon: ClipboardList,
      color: 'bg-indigo-600',
      border: 'border-l-indigo-600',
      action: () => setCurrentView('teacher_summary')
    },
    {
      id: 'student_summary',
      title: 'Ringkasan Kehadiran Siswa',
      desc: 'Tabel H/I/S/A/D dan persentase, filter kelas & tanggal',
      icon: Users,
      color: 'bg-emerald-600',
      border: 'border-l-emerald-600',
      action: () => setCurrentView('student_summary')
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
      action: () => setCurrentView('student_presence')
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
      action: () => setCurrentView('monitor_student')
    },
    {
      id: 'monitor_teacher',
      title: 'Pemantauan Guru Langsung',
      desc: 'Pantau absensi guru secara realtime',
      icon: GraduationCap,
      color: 'bg-purple-600',
      border: 'border-l-purple-600',
      action: () => setCurrentView('monitor_teacher')
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
        {/* Header — back navigation handled by parent SubView wrapper */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Menu Laporan</h1>
          <p className="text-muted-foreground text-sm">Pilih jenis laporan yang ingin Anda lihat</p>
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
                  <h3 className="font-semibold text-foreground mb-1 leading-tight">{item.title}</h3>
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
      
      {/* 
        NOTE: For custom components (LaporanKehadiranSiswaView etc), we don't need the default header 
        because they have their own or we'll wrap them. 
        Most have their own header/back button now.
        For inline views like 'teacher_export', we render them here.
      */}

      {currentView === 'student_export' && (
        <RekapKetidakhadiranView 
            user={{ id: 0, nama: 'Admin', nip: 'Admin', role: 'admin', username: 'admin' }} // Mock user data for admin
            onBack={() => setCurrentView('menu')}
        />
      )}

      {currentView === 'teacher_export' && (
         <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => setCurrentView('menu')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali
                </Button>
                <h2 className="text-2xl font-bold text-foreground">Rekap Ketidakhadiran Guru</h2>
            </div>
            <Card className="border-l-4 border-l-orange-600 shadow-sm max-w-3xl mx-auto">
            <CardContent className="p-6 space-y-6">
                <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    Rekap Ketidakhadiran Guru (Tahunan)
                </h3>
                <p className="text-muted-foreground text-sm mt-1">Download rekap kehadiran guru 1 tahun penuh.</p>
                </div>

                <div className="space-y-2 max-w-xs">
                <Label>Tahun Pelajaran (Awal)</Label>
                <Select value={selectedYearTeacher} onValueChange={setSelectedYearTeacher}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>

                {exportError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{exportError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end pt-4">
                <Button onClick={handleExportTeacherRecap} disabled={exporting} variant="outline" size="sm">
                    {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel</>}
                </Button>
                </div>
            </CardContent>
            </Card>
        </div>
      )}

      {currentView === 'history' && (
        <BandingAbsenReportView 
          onBack={() => setCurrentView('menu')}
          onLogout={onLogout}
        />
      )}
      
      {currentView === 'teacher_summary' && (
        <TeacherAttendanceSummaryView
            onBack={() => setCurrentView('menu')}
            onLogout={onLogout}
        />
      )}

      {currentView === 'student_summary' && (
        <LaporanKehadiranSiswaView
            user={{ id: 0, nama: 'Admin', nip: 'Admin', role: 'admin', username: 'admin' }}
            onBack={() => setCurrentView('menu')}
        />
      )}

      {currentView === 'student_presence' && (
        <PresensiSiswaSMKN13View 
             user={{ id: 0, nama: 'Admin', nip: 'Admin', role: 'admin', username: 'admin' }}
             onBack={() => setCurrentView('menu')}
        />
      )}

      {currentView === 'monitor_student' && (
          <LiveStudentAttendanceView 
             onBack={() => setCurrentView('menu')}
             onLogout={onLogout}
          />
      )}

      {currentView === 'monitor_teacher' && (
          <LiveTeacherAttendanceView
             onBack={() => setCurrentView('menu')}
             onLogout={onLogout}
          />
      )}

      {currentView === 'analytics' && (
         <AnalyticsDashboardView
             onBack={() => setCurrentView('menu')}
             onLogout={onLogout}
         />
      )}
    </div>
  );
};

export default ReportsView;
