import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FontSizeControl } from "@/components/ui/font-size-control";
import { ModeToggle } from "@/components/mode-toggle";
import ErrorBoundary from "./ErrorBoundary";
import { apiCall } from '@/utils/apiClient';
import { useAuth } from '@/contexts/AuthContext';
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
  { id: 'add-teacher', title: 'Tambah Akun Guru', icon: UserPlus, description: 'Kelola akun guru', gradient: 'from-blue-500 to-blue-700' },
  { id: 'add-student', title: 'Tambah Akun Siswa', icon: UserPlus, description: 'Kelola akun siswa perwakilan', gradient: 'from-green-500 to-green-700' },
  { id: 'add-teacher-data', title: 'Data Guru', icon: GraduationCap, description: 'Input dan kelola data guru', gradient: 'from-purple-500 to-purple-700' },
  { id: 'add-student-data', title: 'Data Siswa', icon: Users, description: 'Input dan kelola data siswa lengkap', gradient: 'from-orange-500 to-orange-700' },
  { id: 'student-promotion', title: 'Naik Kelas', icon: ArrowUpCircle, description: 'Kelola kenaikan kelas siswa', gradient: 'from-emerald-500 to-emerald-700' },
  { id: 'add-subject', title: 'Mata Pelajaran', icon: BookOpen, description: 'Kelola mata pelajaran', gradient: 'from-red-500 to-red-700' },
  { id: 'add-class', title: 'Kelas', icon: Home, description: 'Kelola kelas', gradient: 'from-indigo-500 to-indigo-700' },
  { id: 'add-schedule', title: 'Jadwal', icon: Calendar, description: 'Atur jadwal pelajaran', gradient: 'from-teal-500 to-teal-700' },
  { id: 'add-room', title: 'Ruang Kelas', icon: Home, description: 'Kelola ruang kelas', gradient: 'from-amber-500 to-amber-700' },
  { id: 'backup-management', title: 'Backup & Archive', icon: Database, description: 'Kelola backup dan arsip data', gradient: 'from-cyan-500 to-cyan-700' },
  { id: 'monitoring', title: 'System Monitoring', icon: Monitor, description: 'Real-time monitoring & alerting', gradient: 'from-violet-500 to-violet-700' },
  { id: 'disaster-recovery', title: 'Restorasi Backup', icon: Shield, description: 'Restorasi dan pemulihan backup', gradient: 'from-amber-500 to-amber-700' },
  { id: 'letterhead-settings', title: 'Kop Laporan', icon: FileText, description: 'Kelola header/kop untuk semua laporan', gradient: 'from-slate-500 to-slate-700' },
  { id: 'reports', title: 'Laporan', icon: BarChart3, description: 'Pemantau siswa & guru live', gradient: 'from-pink-500 to-pink-700' },
];

// ---------------------------------------------------------------------------
// Main Admin Dashboard Component
// ---------------------------------------------------------------------------

export const AdminDashboard = () => {
  const { logout, user } = useAuth();
  const [activeView, setActiveView] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [userData, setUserData] = useState<AdminProfileData | null>(null);

  // Notifications (admin — no userId needed)
  const { notifications, unreadCount, isLoading: notifLoading, refresh: notifRefresh } =
    useNotifications({ role: 'admin', onLogout: logout });

  // Load detailed admin profile data for sidebar + EditProfile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileResponse = await apiCall('/api/admin/info', { onLogout: logout }) as
          AdminProfileData & { success?: boolean };
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
        console.error("Failed to load admin profile:", error);
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
  }, [logout, user]);

  const handleUpdateProfile = (updatedData: AdminProfileData) => {
    setUserData(prevData => ({
      ...prevData,
      ...updatedData,
      updated_at: new Date().toISOString()
    }));
  };

  const renderActiveView = () => {
    const handleBack = () => setActiveView(null);

    switch (activeView) {
      case 'add-teacher':
        return <ManageTeacherAccountsView onBack={handleBack} onLogout={logout} />;
      case 'add-student':
        return <ManageStudentsView onBack={handleBack} onLogout={logout} />;
      case 'add-teacher-data':
        return <ManageTeacherDataView onBack={handleBack} onLogout={logout} />;
      case 'add-student-data':
        return <ManageStudentDataView onBack={handleBack} onLogout={logout} />;
      case 'student-promotion':
        return <StudentPromotionView onBack={handleBack} onLogout={logout} />;
      case 'add-subject':
        return <ManageSubjectsView onBack={handleBack} onLogout={logout} />;
      case 'add-class':
        return <ManageClassesView onBack={handleBack} onLogout={logout} />;
      case 'add-schedule':
        return <ManageSchedulesView onBack={handleBack} onLogout={logout} />;
      case 'add-room':
        return <ManageRoomsView onBack={handleBack} onLogout={logout} />;
      case 'backup-management':
        return <ErrorBoundary><BackupManagementView /></ErrorBoundary>;
      case 'monitoring':
        return <ErrorBoundary><MonitoringDashboard /></ErrorBoundary>;
      case 'disaster-recovery':
        return <ErrorBoundary><SimpleRestoreView onBack={handleBack} onLogout={logout} /></ErrorBoundary>;
      case 'letterhead-settings':
        return <ErrorBoundary><ReportLetterheadSettings onBack={handleBack} onLogout={logout} /></ErrorBoundary>;
      case 'reports':
        return <ErrorBoundary><ReportsView onBack={handleBack} onLogout={logout} /></ErrorBoundary>;
      case 'jam-pelajaran':
        return <ErrorBoundary><JamPelajaranConfig /></ErrorBoundary>;
      default:
        return null;
    }
  };

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
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={activeView === item.id ? "default" : "ghost"}
              className={`w-full justify-start ${sidebarOpen ? '' : 'px-2 lg:px-3'} ${activeView !== item.id ? 'text-muted-foreground hover:text-foreground font-medium' : ''}`}
              onClick={() => {
                setActiveView(item.id);
                setSidebarOpen(false);
              }}
            >
              <item.icon className="h-4 w-4" />
              {sidebarOpen && <span className="ml-2 block lg:hidden">{item.title}</span>}
              <span className="ml-2 hidden lg:block">{item.title}</span>
            </Button>
          ))}
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
              onClick={logout}
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
          {activeView ? (
             <div className="space-y-6">
                <Button variant="ghost" className="mb-4" onClick={() => setActiveView(null)}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Kembali ke Menu
                </Button>

                <React.Suspense fallback={<div className="flex justify-center p-8">Loading...</div>}>
                  {renderActiveView()}
                </React.Suspense>
             </div>
          ) : (
            <div className="space-y-8">
              {/* Desktop Header */}
              <div className="hidden lg:block">
                <h1 className="text-4xl font-bold text-foreground">
                  Dashboard Admin
                </h1>
                <p className="text-muted-foreground mt-2">ABSENTA - Sistem Absensi Sekolah</p>
              </div>

              <React.Suspense fallback={<div className="flex justify-center p-8">Loading...</div>}>
                <LiveSummaryView onLogout={logout} />
              </React.Suspense>

              {/* Menu Grid */}
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-6">Menu Administrasi</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {menuItems.map((item) => (
                    <Card
                      key={item.id}
                      className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-border bg-card"
                      onClick={() => setActiveView(item.id)}
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
          )}
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
