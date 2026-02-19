import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FontSizeControl } from "@/components/ui/font-size-control";
import { ModeToggle } from "@/components/mode-toggle";
import ErrorBoundary from "./ErrorBoundary";
import { apiCall } from '@/utils/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from "@/hooks/use-toast";
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationBell } from '@/components/NotificationBell';
import {
  Users,
  GraduationCap,
  Calendar,
  Settings,
  Menu,
  X,
  LogOut,
  Database,
  FileText,
  Shield,
  BookOpen,
  UserPlus,
  Home,
  ChevronLeft,
  ArrowUpCircle,
  Monitor,
  BarChart3,
  User,
  ScrollText,
} from "lucide-react";

// Lazy-loaded views
const BackupManagementView = React.lazy(() => import("./BackupManagementView"));
const MonitoringDashboard = React.lazy(() => import("./MonitoringDashboard"));
const ManageStudentsView = React.lazy(() => import('./admin/students/ManageStudentsView').then(module => ({ default: module.ManageStudentsView })));
const ManageStudentDataView = React.lazy(() => import('./admin/students/ManageStudentDataView'));
const StudentPromotionView = React.lazy(() => import('./admin/students/StudentPromotionView').then(module => ({ default: module.StudentPromotionView })));
const ManageTeacherAccountsView = React.lazy(() => import('./admin/teachers/ManageTeacherAccountsView'));
const ManageTeacherDataView = React.lazy(() => import('./admin/teachers/ManageTeacherDataView'));
const ManageSubjectsView = React.lazy(() => import('./admin/subjects/ManageSubjectsView').then(module => ({ default: module.ManageSubjectsView })));
const ManageClassesView = React.lazy(() => import('./admin/classes/ManageClassesView').then(module => ({ default: module.ManageClassesView })));
const ManageRoomsView = React.lazy(() => import('./admin/rooms/ManageRoomsView').then(module => ({ default: module.ManageRoomsView })));
const ManageSchedulesView = React.lazy(() => import('./admin/schedules/ManageSchedulesView'));
const JamPelajaranConfig = React.lazy(() => import("./JamPelajaranConfig"));
const SimpleRestoreView = React.lazy(() => import("./SimpleRestoreView"));
const EditProfile = React.lazy(() => import('./EditProfile').then(module => ({ default: module.EditProfile })));
const ReportLetterheadSettings = React.lazy(() => import('./ReportLetterheadSettings'));
const ReportsView = React.lazy(() => import('./admin/reports/ReportsView').then(module => ({ default: module.ReportsView })));
const LiveSummaryView = React.lazy(() => import('./admin/dashboard/LiveSummaryView').then(module => ({ default: module.LiveSummaryView })));
const AuditLogView = React.lazy(() => import('./admin/AuditLogView'));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Profile data used for sidebar display and EditProfile modal */
interface AdminProfileData {
  id: number;
  username: string;
  nama: string;
  email?: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const menuItems = [
  { id: 'add-teacher', path: 'teachers', title: 'Tambah Akun Guru', icon: UserPlus, description: 'Kelola akun guru', gradient: 'from-blue-500 to-blue-700' },
  { id: 'add-student', path: 'students', title: 'Tambah Akun Siswa', icon: UserPlus, description: 'Kelola akun siswa perwakilan', gradient: 'from-green-500 to-green-700' },
  { id: 'add-teacher-data', path: 'teacher-data', title: 'Data Guru', icon: GraduationCap, description: 'Input dan kelola data guru', gradient: 'from-purple-500 to-purple-700' },
  { id: 'add-student-data', path: 'student-data', title: 'Data Siswa', icon: Users, description: 'Input dan kelola data siswa lengkap', gradient: 'from-orange-500 to-orange-700' },
  { id: 'student-promotion', path: 'promotions', title: 'Naik Kelas', icon: ArrowUpCircle, description: 'Kelola kenaikan kelas siswa', gradient: 'from-emerald-500 to-emerald-700' },
  { id: 'add-subject', path: 'subjects', title: 'Mata Pelajaran', icon: BookOpen, description: 'Kelola mata pelajaran', gradient: 'from-red-500 to-red-700' },
  { id: 'add-class', path: 'classes', title: 'Kelas', icon: Home, description: 'Kelola kelas', gradient: 'from-indigo-500 to-indigo-700' },
  { id: 'add-schedule', path: 'schedules', title: 'Jadwal', icon: Calendar, description: 'Atur jadwal pelajaran', gradient: 'from-teal-500 to-teal-700' },
  { id: 'add-room', path: 'rooms', title: 'Ruang Kelas', icon: Home, description: 'Kelola ruang kelas', gradient: 'from-amber-500 to-amber-700' },
  { id: 'backup-management', path: 'backups', title: 'Backup & Archive', icon: Database, description: 'Kelola backup dan arsip data', gradient: 'from-cyan-500 to-cyan-700' },
  { id: 'monitoring', path: 'monitoring', title: 'System Monitoring', icon: Monitor, description: 'Real-time monitoring & alerting', gradient: 'from-violet-500 to-violet-700' },
  { id: 'disaster-recovery', path: 'restore', title: 'Restorasi Backup', icon: Shield, description: 'Restorasi dan pemulihan backup', gradient: 'from-amber-500 to-amber-700' },
  { id: 'letterhead-settings', path: 'letterhead', title: 'Kop Laporan', icon: FileText, description: 'Kelola header/kop untuk semua laporan', gradient: 'from-slate-500 to-slate-700' },
  { id: 'reports', path: 'reports', title: 'Laporan', icon: BarChart3, description: 'Pemantau siswa & guru live', gradient: 'from-pink-500 to-pink-700' },
  { id: 'audit-log', path: 'audit-logs', title: 'Log Aktivitas', icon: ScrollText, description: 'Riwayat aktivitas admin', gradient: 'from-gray-500 to-gray-700' },
];

/** Wrapper for admin sub-views: adds back button + Suspense boundary */
const SubView = ({ children }: { children: React.ReactNode }) => {
  const nav = useNavigate();
  return (
    <div className="space-y-6">
      <Button variant="ghost" className="mb-4" onClick={() => nav('/admin')}>
        <ChevronLeft className="w-4 h-4 mr-2" />
        Kembali ke Menu
      </Button>
      <React.Suspense fallback={<div className="flex justify-center p-8">Loading...</div>}>
        {children}
      </React.Suspense>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Admin Dashboard Component
// ---------------------------------------------------------------------------

export const AdminDashboard = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [userData, setUserData] = useState<AdminProfileData | null>(null);

  const handleLogout = React.useCallback(() => {
    logout().catch((error) => {
      toast({
        variant: "destructive",
        title: "Gagal logout",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    });
  }, [logout]);

  // Notifications (admin — no userId needed)
  const { notifications, unreadCount, isLoading: notifLoading, refresh: notifRefresh } =
    useNotifications({ role: 'admin', onLogout: handleLogout });

  // Load detailed admin profile data for sidebar + EditProfile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileResponse = await apiCall<AdminProfileData & { success?: boolean }>('/api/admin/info', { onLogout: handleLogout });
        if (profileResponse.success !== false) {
          setUserData({
            id: profileResponse.id,
            username: profileResponse.username,
            nama: profileResponse.nama,
            email: profileResponse.email,
            role: profileResponse.role,
            created_at: profileResponse.created_at,
            updated_at: profileResponse.updated_at
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Gagal memuat profil admin",
          description: error instanceof Error ? error.message : "Terjadi kesalahan",
        });
        // Fallback to AuthContext user data
        if (user) {
          setUserData({
            id: user.id,
            username: user.username,
            nama: user.nama,
            role: user.role ?? 'admin',
          });
        }
      }
    };

    loadProfile();
  }, [handleLogout, user]);

  const handleUpdateProfile = (updatedData: AdminProfileData) => {
    setUserData(prevData => ({
      ...prevData,
      ...updatedData,
      updated_at: new Date().toISOString()
    }));
  };

  const handleBack = () => navigate('/admin');

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - with proper visibility handling */}
      <div className={`fixed left-0 top-0 h-full bg-card border-r border-border shadow-xl transition-all duration-300 z-40 flex flex-col ${
        sidebarOpen ? 'w-64' : 'w-16'
      } lg:w-64 lg:translate-x-0 lg:visible ${sidebarOpen ? 'translate-x-0 visible' : '-translate-x-full invisible lg:visible lg:translate-x-0'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className={`flex items-center space-x-3 ${sidebarOpen ? '' : 'justify-center lg:justify-start'}`}>
            <div className="p-2 rounded-lg">
              <img src="/logo.png" alt="ABSENTA Logo" className="h-12 w-12" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-xl text-foreground block lg:hidden">
                ABSENTA
              </span>
            )}
            <span className="font-bold text-xl text-foreground hidden lg:block">
              ABSENTA
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation - flex-1 with min-h-0 for proper flex shrinking */}
        <nav className="p-4 space-y-2 flex-1 min-h-0 overflow-y-auto">
          {menuItems.map((item) => {
            const itemPath = `/admin/${item.path}`;
            const isActive = location.pathname === itemPath;
            const buttonClassName = `w-full justify-start ${sidebarOpen ? '' : 'px-2 lg:px-3'} ${isActive ? '' : 'text-muted-foreground hover:text-foreground font-medium'}`;

            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                className={buttonClassName}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
              >
                <item.icon className="h-4 w-4" />
                {sidebarOpen && <span className="ml-2 block lg:hidden">{item.title}</span>}
                <span className="ml-2 hidden lg:block">{item.title}</span>
              </Button>
            );
          })}
        </nav>

        {/* User Info - shrink-0 to keep at bottom */}
        <div className="p-4 border-t border-border bg-card shrink-0">
          {/* Font Size Control - Above Profile Buttons */}
          {(sidebarOpen || window.innerWidth >= 1024) && (
            <div className="mb-4 flex items-center gap-2">
              <FontSizeControl variant="compact" />
              <ModeToggle />
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                isLoading={notifLoading}
                onRefresh={notifRefresh}
              />
            </div>
          )}

          {/* User Profile Info */}
          {userData && (
            <div className="mb-3 p-2 bg-muted/50 rounded-lg">
              <div className={`flex items-center ${sidebarOpen || window.innerWidth >= 1024 ? 'space-x-2' : 'justify-center'}`}>
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                {(sidebarOpen || window.innerWidth >= 1024) && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{userData.nama}</p>
                    <p className="text-xs text-muted-foreground">Administrator</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={() => setShowEditProfile(true)}
              variant="outline"
              size="sm"
              className={`w-full ${sidebarOpen ? '' : 'px-2 lg:px-3'}`}
            >
              <Settings className="h-4 w-4" />
              {sidebarOpen && <span className="ml-2 block lg:hidden">Edit Profil</span>}
              <span className="ml-2 hidden lg:block">Edit Profil</span>
            </Button>

            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className={`w-full ${sidebarOpen ? '' : 'px-2 lg:px-3'}`}
            >
              <LogOut className="h-4 w-4" />
              {sidebarOpen && <span className="ml-2 block lg:hidden">Keluar</span>}
              <span className="ml-2 hidden lg:block">Keluar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - with background to prevent sidebar text bleeding */}
      <div className="lg:ml-64 relative z-10 bg-background min-h-screen">
        <div className="p-4 lg:p-6">
          {/* Mobile Header */}
          <div className="flex items-center justify-between mb-6 lg:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Dashboard Admin</h1>
            <div className="w-10"></div>
          </div>

          {/* Content */}
          <Routes>
            <Route index element={
              <div className="space-y-8">
                {/* Desktop Header */}
                <div className="hidden lg:block">
                  <h1 className="text-4xl font-bold text-foreground">Dashboard Admin</h1>
                  <p className="text-muted-foreground mt-2">ABSENTA - Sistem Absensi Sekolah</p>
                </div>
                <React.Suspense fallback={<div className="flex justify-center p-8">Loading...</div>}>
                  <LiveSummaryView onLogout={handleLogout} />
                </React.Suspense>
                {/* Menu Grid */}
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-6">Menu Administrasi</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {menuItems.map((item) => (
                      <Card
                        key={item.id}
                        className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-border bg-card"
                        onClick={() => navigate(item.path)}
                      >
                        <CardContent className="p-6 text-center space-y-4">
                          <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r ${item.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                            <item.icon className="w-8 h-8 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-card-foreground mb-1">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            } />

            <Route path="teachers" element={<SubView><ManageTeacherAccountsView onBack={handleBack} onLogout={logout} /></SubView>} />
            <Route path="students" element={<SubView><ManageStudentsView onBack={handleBack} onLogout={logout} /></SubView>} />
            <Route path="teacher-data" element={<SubView><ManageTeacherDataView onBack={handleBack} onLogout={logout} /></SubView>} />
            <Route path="student-data" element={<SubView><ManageStudentDataView onBack={handleBack} onLogout={logout} /></SubView>} />
            <Route path="promotions" element={<SubView><StudentPromotionView onBack={handleBack} onLogout={logout} /></SubView>} />
            <Route path="subjects" element={<SubView><ManageSubjectsView onBack={handleBack} onLogout={logout} /></SubView>} />
            <Route path="classes" element={<SubView><ManageClassesView onBack={handleBack} onLogout={logout} /></SubView>} />
            <Route path="schedules" element={<SubView><ManageSchedulesView onBack={handleBack} onLogout={logout} /></SubView>} />
            <Route path="rooms" element={<SubView><ManageRoomsView onBack={handleBack} onLogout={logout} /></SubView>} />
            <Route path="backups" element={<SubView><ErrorBoundary><BackupManagementView /></ErrorBoundary></SubView>} />
            <Route path="monitoring" element={<SubView><ErrorBoundary><MonitoringDashboard /></ErrorBoundary></SubView>} />
            <Route path="restore" element={<SubView><ErrorBoundary><SimpleRestoreView onBack={handleBack} /></ErrorBoundary></SubView>} />
            <Route path="letterhead" element={<SubView><ErrorBoundary><ReportLetterheadSettings onBack={handleBack} onLogout={logout} /></ErrorBoundary></SubView>} />
            <Route path="reports" element={<SubView><ErrorBoundary><ReportsView onBack={handleBack} onLogout={logout} /></ErrorBoundary></SubView>} />
            <Route path="jam-pelajaran" element={<SubView><ErrorBoundary><JamPelajaranConfig /></ErrorBoundary></SubView>} />
            <Route path="audit-logs" element={<SubView><ErrorBoundary><AuditLogView /></ErrorBoundary></SubView>} />
          </Routes>
        </div>
      </div>

      {/* Floating Font Size Control for Mobile */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 lg:hidden z-50">
        <FontSizeControl variant="floating" />
        <ModeToggle />
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && userData && (
        <React.Suspense fallback={null}>
          <EditProfile
            userData={userData}
            onUpdate={handleUpdateProfile}
            onClose={() => setShowEditProfile(false)}
            role="admin"
          />
        </React.Suspense>
      )}
    </div>
  );
};
