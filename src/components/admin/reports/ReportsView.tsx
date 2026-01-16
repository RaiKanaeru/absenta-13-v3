import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Users, BarChart3, FileText, Globe, GraduationCap, ClipboardList, Activity 
} from "lucide-react";
import LiveStudentAttendanceView from './LiveStudentAttendanceView';
import LiveTeacherAttendanceView from './LiveTeacherAttendanceView';
import StudentAttendanceSummaryView from './StudentAttendanceSummaryView';
import TeacherAttendanceSummaryView from './TeacherAttendanceSummaryView';
import BandingAbsenReportView from './BandingAbsenReportView';
import AnalyticsDashboardView from './AnalyticsDashboardView';

interface ReportsViewProps {
  onLogout: () => void;
}

type ReportType = 
  | 'menu' 
  | 'live_student' 
  | 'live_teacher' 
  | 'rekap_siswa' 
  | 'rekap_guru' 
  | 'banding' 
  | 'analytics';

export const ReportsView: React.FC<ReportsViewProps> = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState<ReportType>('menu');

  const menuItems = [
    {
      id: 'live_student',
      title: 'Pemantauan Siswa Live',
      description: 'Pantau kehadiran siswa secara realtime hari ini',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      id: 'live_teacher',
      title: 'Pemantauan Guru Live',
      description: 'Pantau kehadiran guru secara realtime hari ini',
      icon: GraduationCap,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100'
    },
    {
      id: 'rekap_siswa',
      title: 'Rekap Absensi Siswa',
      description: 'Laporan kehadiran siswa per kelas dan semester',
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      id: 'rekap_guru',
      title: 'Rekap Absensi Guru',
      description: 'Laporan kehadiran guru bulanan dan semester',
      icon: ClipboardList,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      id: 'banding',
      title: 'Laporan Banding',
      description: 'Kelola pengajuan banding absensi siswa',
      icon: Globe,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      id: 'analytics',
      title: 'Analitik Sistem',
      description: 'Dashboard statistik dan performa absensi',
      icon: BarChart3,
      color: 'text-rose-600',
      bgColor: 'bg-rose-100'
    }
  ];

  const handleBack = () => {
    setCurrentView('menu');
  };

  // Render sub-components based on currentView
  switch (currentView) {
    case 'live_student':
      return <LiveStudentAttendanceView onBack={handleBack} onLogout={onLogout} />;
    case 'live_teacher':
      return <LiveTeacherAttendanceView onBack={handleBack} onLogout={onLogout} />;
    case 'rekap_siswa':
      return <StudentAttendanceSummaryView onBack={handleBack} onLogout={onLogout} />;
    case 'rekap_guru':
      return <TeacherAttendanceSummaryView onBack={handleBack} onLogout={onLogout} />;
    case 'banding':
      return <BandingAbsenReportView onBack={handleBack} onLogout={onLogout} />;
    case 'analytics':
      return <AnalyticsDashboardView onBack={handleBack} onLogout={onLogout} />;
    case 'menu':
    default:
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Pusat Laporan & Analitik</h2>
            <p className="text-gray-500">Pilih jenis laporan yang ingin ditampilkan</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Card 
                  key={item.id} 
                  className="hover:shadow-lg transition-all cursor-pointer border-l-4 hover:-translate-y-1"
                  onClick={() => setCurrentView(item.id as ReportType)}
                  style={{ borderLeftColor: item.color.replace('text-', 'bg-').replace('600', '500') }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-xl ${item.bgColor}`}>
                        <Icon className={`w-8 h-8 ${item.color}`} />
                      </div>
                      <Activity className="w-5 h-5 text-gray-300" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-lg font-bold mb-2 text-gray-800">{item.title}</CardTitle>
                    <CardDescription className="text-gray-600">
                      {item.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      );
  }
};

export default ReportsView;
