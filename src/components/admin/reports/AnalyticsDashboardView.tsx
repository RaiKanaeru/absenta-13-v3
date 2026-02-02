import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, BarChart3, Minimize2, Maximize2, Users, Activity, GraduationCap, AlertTriangle 
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiCall } from '@/utils/apiClient';
import { formatTime24WithSeconds, getCurrentDateWIB } from "@/lib/time-utils";
import { enterFullscreen, exitFullscreen, isFullscreen } from '@/utils/fullscreenHelper';
import { createSessionExpiredHandler } from '../utils/dashboardUtils';

interface AnalyticsDashboardViewProps {
  onBack: () => void;
  onLogout: () => void;
}

interface AnalyticsData {
  studentAttendance: Array<{ periode: string; hadir: number; tidak_hadir: number }>;
  teacherAttendance: Array<{ periode: string; hadir: number; tidak_hadir: number }>;
  topAbsentStudents: Array<{ nama: string; nama_kelas: string; total_alpa: number }>;
  topAbsentTeachers: Array<{ nama: string; total_tidak_hadir: number }>;
  totalStudents: number;
  totalTeachers: number;
  notifications: Array<{ id: number; status: string }>;
}

export const AnalyticsDashboardView: React.FC<AnalyticsDashboardViewProps> = ({ onBack, onLogout }) => {
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [processingNotif, setProcessingNotif] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [fullscreenMode, setFullscreenMode] = useState(false);
    const dashboardRef = useRef<HTMLDivElement>(null);

    // Fullscreen toggle handler with cross-browser compatibility
    const toggleFullscreen = useCallback(async () => {
      const elem = dashboardRef.current;
      if (!elem) return;

      if (!isFullscreen()) {
        await enterFullscreen(elem);
      } else {
        await exitFullscreen();
      }
    }, []);

    // Listen for fullscreen changes
    useEffect(() => {
      const handleFullscreenChange = () => {
        setFullscreenMode(isFullscreen());
      };
      
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('msfullscreenchange', handleFullscreenChange);
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      };
    }, []);

    useEffect(() => {
      const fetchAnalyticsData = async () => {
        try {
          setError('');
          const token = localStorage.getItem('token');
          const data = await apiCall('/api/admin/analytics', {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            onLogout: createSessionExpiredHandler(onLogout, toast)
          });
          setAnalyticsData(data);
        } catch (error: unknown) {
          console.error('❌ Error fetching analytics data:', error);
          const message = error instanceof Error ? error.message : String(error);
          setError('Gagal memuat data analitik: ' + message);
        } finally {
          setLoading(false);
        }
      };

      fetchAnalyticsData();
    }, [onLogout]);

    const handlePermissionRequest = async (notificationId: number, newStatus: 'disetujui' | 'ditolak') => {
      setProcessingNotif(notificationId);
      try {
        await apiCall(`/api/admin/izin/${notificationId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({ status: newStatus }),
        });
        
        toast({
          title: "Berhasil",
          description: `Permintaan berhasil ${newStatus}`
        });
        setAnalyticsData(prevData => {
          if (!prevData) return null;
          const updatedNotifications = prevData.notifications.map(notif =>
            notif.id === notificationId ? { ...notif, status: newStatus } : notif
          );
          return { ...prevData, notifications: updatedNotifications };
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Tidak dapat terhubung ke server",
          variant: "destructive"
        });
      } finally {
        setProcessingNotif(null);
      }
    };

    if (loading) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Menu Laporan
            </Button>
            <div>
<h1 className="text-2xl font-bold text-foreground">Dasbor Analitik</h1>
              <p className="text-muted-foreground">Memuat data analitik...</p>
            </div>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Memuat data analitik...</p>
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="space-y-4">
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Menu Laporan
          </Button>
<Card className="border-destructive/20 bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-center text-destructive">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!analyticsData) {
      return (
        <div className="space-y-4">
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Menu Laporan
          </Button>
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Gagal memuat data analitik</p>
          </div>
        </div>
      );
    }

    const { studentAttendance, teacherAttendance, topAbsentStudents, topAbsentTeachers } = analyticsData;

    return (
<div ref={dashboardRef} className={`space-y-6 ${fullscreenMode ? 'fixed inset-0 z-50 bg-background p-6 overflow-auto' : ''}`}>
        {/* Header - Modern */}
        <div className="bg-orange-500/10 dark:bg-orange-500/20 rounded-xl p-6 border border-orange-500/20">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="outline" className="bg-background">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground flex items-center">
                <BarChart3 className="w-6 h-6 mr-2 text-orange-500" />
                Dasbor Analitik
              </h1>
              <p className="text-muted-foreground">Analisis dan statistik kehadiran siswa dan guru</p>
            </div>
            <div className="hidden md:flex items-center gap-3 text-right">
              <div>
<p className="text-sm text-muted-foreground">Tanggal</p>
                <p className="font-mono text-foreground">{getCurrentDateWIB()}</p>
              </div>
              <Button onClick={toggleFullscreen} variant="outline" size="sm" className="bg-white">
                {fullscreenMode ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
                {fullscreenMode ? 'Keluar' : 'Fullscreen'}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Student Attendance Chart - Modern */}
          <Card className="lg:col-span-2 border-0 shadow-sm">
<CardHeader className="border-b bg-emerald-500/10 dark:bg-emerald-500/20">
              <CardTitle className="text-emerald-700 dark:text-emerald-400 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Kehadiran Siswa
              </CardTitle>
              <CardDescription>Statistik kehadiran siswa per periode</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {studentAttendance && studentAttendance.length > 0 ? (
                <div className="space-y-4">
                  {studentAttendance.map((item, index) => {
                    const total = item.hadir + item.tidak_hadir;
                    const pct = total > 0 ? Math.round((item.hadir / total) * 100) : 0;
                    return (
                      <div key={`student-attendance-${item.periode}-${index}`} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground">{item.periode}</span>
                          <span className="text-sm font-semibold text-emerald-600">{pct}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-emerald-400 to-teal-500 h-3 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                              {item.hadir}
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-rose-400 rounded-full" />
                              {item.tidak_hadir}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
<div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada data kehadiran siswa</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats Card - Modern */}
          <Card className="border-0 shadow-sm bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground flex items-center text-lg">
                <Activity className="w-5 h-5 mr-2 text-muted-foreground" />
                Ringkasan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-background rounded-lg border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-emerald-700">Sistem</span>
                    </div>
                    <p className="text-lg font-bold text-emerald-600">Aktif</p>
                  </div>
                  <div className="p-3 bg-background rounded-lg border border-sky-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-sky-700">Database</span>
                    </div>
                    <p className="text-lg font-bold text-sky-600">OK</p>
                  </div>
                </div>

<div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Siswa</span>
                    <span className="text-sm font-semibold text-foreground">{analyticsData?.totalStudents || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Guru</span>
                    <span className="text-sm font-semibold text-foreground">{analyticsData?.totalTeachers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Server Time</span>
                    <span className="text-xs font-mono text-muted-foreground">{formatTime24WithSeconds(new Date())}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Teacher Attendance Chart - Modern */}
          <Card className="lg:col-span-3 border-0 shadow-sm">
<CardHeader className="border-b bg-indigo-500/10 dark:bg-indigo-500/20">
              <CardTitle className="text-indigo-700 dark:text-indigo-400 flex items-center">
                <GraduationCap className="w-5 h-5 mr-2" />
                Kehadiran Guru
              </CardTitle>
              <CardDescription>Statistik kehadiran guru per periode</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {teacherAttendance && teacherAttendance.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {teacherAttendance.map((item, index) => {
                    const total = item.hadir + item.tidak_hadir;
                    const pct = total > 0 ? Math.round((item.hadir / total) * 100) : 0;
                    return (
                      <div key={`teacher-attendance-${item.periode}-${index}`} className="bg-muted rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-foreground">{item.periode}</span>
                          <span className="text-sm font-semibold text-indigo-600">{pct}%</span>
                        </div>
                        <div className="bg-muted/50 rounded-full h-2 overflow-hidden mb-3">
                          <div 
                            className="bg-gradient-to-r from-indigo-400 to-violet-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                            Hadir: {item.hadir}
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-rose-400 rounded-full" />
                            Tidak: {item.tidak_hadir}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
<div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada data kehadiran guru</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Absent Students - Modern List */}
          <Card className="border-0 shadow-sm">
<CardHeader className="border-b bg-rose-500/10 dark:bg-rose-500/20">
              <CardTitle className="text-rose-700 dark:text-rose-400 flex items-center text-base">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Siswa Sering Alpa
              </CardTitle>
              <CardDescription className="text-xs">5 siswa dengan tingkat alpa tertinggi</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {topAbsentStudents && topAbsentStudents.length > 0 ? (
                <div className="space-y-3">
                  {topAbsentStudents.map((student, index) => (
                    <div key={`top-absent-student-${student.nama}-${index}`} 
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white
                        ${['bg-rose-500', 'bg-rose-400', 'bg-rose-300'][index] || 'bg-rose-300'}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
<p className="font-medium text-foreground truncate">{student.nama}</p>
                        <p className="text-xs text-muted-foreground">{student.nama_kelas}</p>
                      </div>
                      <span className="bg-rose-500/15 text-rose-700 dark:text-rose-400 px-2 py-1 rounded-full text-xs font-semibold">
                        {student.total_alpa}x
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
<div className="text-center py-6 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Tidak ada data siswa alpa</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Absent Teachers - Modern List */}
          <Card className="border-0 shadow-sm">
<CardHeader className="border-b bg-amber-500/10 dark:bg-amber-500/20">
              <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center text-base">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Guru Sering Tidak Hadir
              </CardTitle>
              <CardDescription className="text-xs">5 guru dengan tingkat tidak hadir tertinggi</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {topAbsentTeachers && topAbsentTeachers.length > 0 ? (
                <div className="space-y-3">
                  {topAbsentTeachers.map((teacher, index) => (
                    <div key={`top-absent-teacher-${teacher.nama}-${index}`} 
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white
                        ${['bg-amber-500', 'bg-amber-400', 'bg-amber-300'][index] || 'bg-amber-300'}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{teacher.nama}</p>
                      </div>
                      <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full text-xs font-semibold">
                        {teacher.total_tidak_hadir}x
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
<div className="text-center py-6 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Tidak ada data guru tidak hadir</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
};

export default AnalyticsDashboardView;
