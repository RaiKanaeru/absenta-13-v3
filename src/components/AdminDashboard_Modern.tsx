import { enterFullscreen, exitFullscreen, isFullscreen } from '@/utils/fullscreenHelper';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeInput } from "@/components/ui/time-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { formatTime24WithSeconds, formatDateOnly, getCurrentDateWIB, formatDateWIB, getWIBTime } from "@/lib/time-utils";
import { JadwalService } from "@/services/jadwalService";
import { FontSizeControl } from "@/components/ui/font-size-control";
import { Textarea } from "@/components/ui/textarea";

import ErrorBoundary from "./ErrorBoundary";
const BackupManagementView = React.lazy(() => import("./BackupManagementView"));
const MonitoringDashboard = React.lazy(() => import("./MonitoringDashboard"));
import { Teacher, TeacherData, StudentData, Subject, Kelas, Schedule, Room, LiveData } from '@/types/dashboard';
// Lazy load to avoid circular dependencies
// import { ManageStudentsView } from './admin/students/ManageStudentsView';
const ManageStudentsView = React.lazy(() => import('./admin/students/ManageStudentsView').then(module => ({ default: module.ManageStudentsView })));
const ManageStudentDataView = React.lazy(() => import('./admin/students/ManageStudentDataView'));
const StudentPromotionView = React.lazy(() => import('./admin/students/StudentPromotionView').then(module => ({ default: module.StudentPromotionView })));
const ManageTeacherAccountsView = React.lazy(() => import('./admin/teachers/ManageTeacherAccountsView'));
const ManageTeacherDataView = React.lazy(() => import('./admin/teachers/ManageTeacherDataView'));

const ManageSubjectsView = React.lazy(() => import('./admin/subjects/ManageSubjectsView'));
const ManageClassesView = React.lazy(() => import('./admin/classes/ManageClassesView'));
const ManageSchedulesView = React.lazy(() => import('./admin/schedules/ManageSchedulesView'));
const ManageRoomsView = React.lazy(() => import('./admin/rooms/ManageRoomsView'));
const PreviewJadwalView = React.lazy(() => import('./admin/schedules/PreviewJadwalView').then(module => ({ default: module.PreviewJadwalView })));
const RecapScheduleView = React.lazy(() => import('./admin/schedules/RecapScheduleView'));
const JamPelajaranConfig = React.lazy(() => import("./JamPelajaranConfig"));
const SimpleRestoreView = React.lazy(() => import("./SimpleRestoreView"));

const ExcelPreview = React.lazy(() => import('./ExcelPreview'));
const PresensiSiswaView = React.lazy(() => import('./PresensiSiswaView'));
const RekapKetidakhadiranView = React.lazy(() => import('./RekapKetidakhadiranView'));
const RekapKetidakhadiranGuruView = React.lazy(() => import('./RekapKetidakhadiranGuruView'));
const ExcelImportView = React.lazy(() => import('./ExcelImportView'));
import { VIEW_TO_REPORT_KEY } from '../utils/reportKeys';
import { MultiGuruDisplay, TeacherBadgeDisplay, getSubmitButtonLabel } from './admin/utils/dashboardHelpers';
const EditProfile = React.lazy(() => import('./EditProfile').then(module => ({ default: module.EditProfile })));
const ReportLetterheadSettings = React.lazy(() => import('./ReportLetterheadSettings'));
const LiveSummaryView = React.lazy(() => import('./admin/dashboard/LiveSummaryView'));
const ReportsView = React.lazy(() => import('@/components/admin/reports/ReportsView'));

import { apiCall } from '@/utils/apiClient';
import { getApiUrl } from '@/config/api';
import { 
  UserPlus, BookOpen, Calendar, BarChart3, LogOut, ArrowLeft, ArrowRight, Users, GraduationCap, 
  Eye, EyeOff, Download, FileText, Edit, Trash2, Plus, Search, Filter, Settings, Menu, X,
  TrendingUp, Home, Clock, CheckCircle, CheckCircle2, MessageCircle, ClipboardList, Activity,
  Database, Monitor, Shield, RefreshCw, ArrowUpCircle, User, FileText as FileTextIcon,
  Maximize2, Minimize2, AlertTriangle, ChevronLeft
} from "lucide-react";



// Types


interface AdminDashboardProps {
  onLogout: () => void;
}

type GenderType = 'L' | 'P' | '';
type AccountStatusType = 'aktif' | 'nonaktif';



const menuItems = [
  { id: 'add-teacher', title: 'Tambah Akun Guru', icon: UserPlus, description: 'Kelola akun guru', gradient: 'from-blue-500 to-blue-700' },
  { id: 'add-student', title: 'Tambah Akun Siswa', icon: UserPlus, description: 'Kelola akun siswa perwakilan', gradient: 'from-green-500 to-green-700' },
  { id: 'add-teacher-data', title: 'Data Guru', icon: GraduationCap, description: 'Input dan kelola data guru', gradient: 'from-purple-500 to-purple-700' },
  { id: 'add-student-data', title: 'Data Siswa', icon: Users, description: 'Input dan kelola data siswa lengkap', gradient: 'from-orange-500 to-orange-700' },
  { id: 'student-promotion', title: 'Naik Kelas', icon: ArrowUpCircle, description: 'Kelola kenaikan kelas siswa', gradient: 'from-emerald-500 to-emerald-700' },
  { id: 'add-subject', title: 'Mata Pelajaran', icon: BookOpen, description: 'Kelola mata pelajaran', gradient: 'from-red-500 to-red-700' },
  { id: 'add-class', title: 'Kelas', icon: Home, description: 'Kelola kelas', gradient: 'from-indigo-500 to-indigo-700' },
  { id: 'add-schedule', title: 'Jadwal', icon: Calendar, description: 'Atur jadwal pelajaran', gradient: 'from-teal-500 to-teal-700' },
  { id: 'recap-schedule', title: 'Rekap Jadwal', icon: Calendar, description: 'View detail 3 baris', gradient: 'from-blue-500 to-blue-700' },
  { id: 'add-room', title: 'Ruang Kelas', icon: Home, description: 'Kelola ruang kelas', gradient: 'from-amber-500 to-amber-700' },
  { id: 'backup-management', title: 'Backup & Archive', icon: Database, description: 'Kelola backup dan arsip data', gradient: 'from-cyan-500 to-cyan-700' },
  { id: 'monitoring', title: 'System Monitoring', icon: Monitor, description: 'Real-time monitoring & alerting', gradient: 'from-violet-500 to-violet-700' },
  { id: 'disaster-recovery', title: 'Restorasi Backup', icon: Shield, description: 'Restorasi dan pemulihan backup', gradient: 'from-amber-500 to-amber-700' },
  { id: 'letterhead-settings', title: 'Kop Laporan', icon: FileTextIcon, description: 'Kelola header/kop untuk semua laporan', gradient: 'from-slate-500 to-slate-700' },
  { id: 'reports', title: 'Laporan', icon: BarChart3, description: 'Pemantau siswa & guru live', gradient: 'from-pink-500 to-pink-700' }
];


// ManageClassesView Component


export const AdminDashboard = ({ onLogout }: AdminDashboardProps) => {
  const [activeView, setActiveView] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [userData, setUserData] = useState<{
    id: number;
    username: string;
    nama: string;
    email?: string;
    role: string;
    created_at?: string;
    updated_at?: string;
  } | null>(null);

  // Check token validity on component mount and load latest profile data
  useEffect(() => {
    const checkTokenValidity = async () => {
      try {
        const response = await apiCall('/api/verify-token', { onLogout }) as any;
        setUserData(response.user);
        
        // Load latest profile data from server
        try {
          const profileResponse = await apiCall('/api/admin/info', { onLogout }) as any;
          if (profileResponse.success) {
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
        } catch (error_) {
          console.error("Failed to load latest profile data:", error_);
        }
      } catch (err) {
        console.error("Token verification failed:", err);
      }
    };

    checkTokenValidity();
  }, [onLogout]);

  const handleUpdateProfile = (updatedData: {
    id: number;
    username: string;
    nama: string;
    email?: string;
    role: string;
    created_at?: string;
    updated_at?: string;
  }) => {
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
        return <ManageTeacherAccountsView onBack={handleBack} onLogout={onLogout} />;
      case 'add-student':
        return <ManageStudentsView onBack={handleBack} onLogout={onLogout} />;
      case 'add-teacher-data':
        return <ManageTeacherDataView onBack={handleBack} onLogout={onLogout} />;
      case 'add-student-data':
        return <ManageStudentDataView onBack={handleBack} onLogout={onLogout} />;
      case 'student-promotion':
        return <StudentPromotionView onBack={handleBack} onLogout={onLogout} />;
      case 'add-subject':
        return <ManageSubjectsView onBack={handleBack} onLogout={onLogout} />;
      case 'add-class':
        return <ManageClassesView onBack={handleBack} onLogout={onLogout} />;
      case 'add-schedule':
        return <ManageSchedulesView onBack={handleBack} onLogout={onLogout} />;
      case 'recap-schedule':
        return <ErrorBoundary><RecapScheduleView onBack={handleBack} /></ErrorBoundary>;
      case 'add-room':
        return <ManageRoomsView onBack={handleBack} onLogout={onLogout} />;
      case 'backup-management':
        return <ErrorBoundary><BackupManagementView /></ErrorBoundary>;
      case 'monitoring':
        return <ErrorBoundary><MonitoringDashboard /></ErrorBoundary>;
      case 'disaster-recovery':
        return <ErrorBoundary><SimpleRestoreView onBack={handleBack} onLogout={onLogout} /></ErrorBoundary>;
      case 'letterhead-settings':
        return <ErrorBoundary><ReportLetterheadSettings onBack={handleBack} onLogout={onLogout} /></ErrorBoundary>;
      case 'reports':
        return <ErrorBoundary><ReportsView onLogout={onLogout} /></ErrorBoundary>;
      case 'jam-pelajaran':
        return <ErrorBoundary><JamPelajaranConfig /></ErrorBoundary>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sidebar - with proper visibility handling */}
      <div className={`fixed left-0 top-0 h-full bg-white shadow-xl transition-all duration-300 z-40 flex flex-col ${
        sidebarOpen ? 'w-64' : 'w-16'
      } lg:w-64 lg:translate-x-0 lg:visible ${sidebarOpen ? 'translate-x-0 visible' : '-translate-x-full invisible lg:visible lg:translate-x-0'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className={`flex items-center space-x-3 ${sidebarOpen ? '' : 'justify-center lg:justify-start'}`}>
            <div className="p-2 rounded-lg">
              <img src="/logo.png" alt="ABSENTA Logo" className="h-12 w-12" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent block lg:hidden">
                ABSENTA
              </span>
            )}
            <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent hidden lg:block">
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
              className={`w-full justify-start ${sidebarOpen ? '' : 'px-2 lg:px-3'}`}
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
        <div className="p-4 border-t border-gray-200 bg-white shrink-0">
          {/* Font Size Control - Above Profile Buttons */}
          {(sidebarOpen || window.innerWidth >= 1024) && (
            <div className="mb-4">
              <FontSizeControl variant="compact" />
            </div>
          )}
          
          {/* User Profile Info */}
          {userData && (
            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
              <div className={`flex items-center ${sidebarOpen || window.innerWidth >= 1024 ? 'space-x-2' : 'justify-center'}`}>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                {(sidebarOpen || window.innerWidth >= 1024) && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{userData.nama}</p>
                    <p className="text-xs text-gray-500">Administrator</p>
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
              onClick={onLogout}
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
      <div className="lg:ml-64 relative z-10 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
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
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                  Dashboard Admin
                </h1>
                <p className="text-gray-600 mt-2">ABSENTA - Sistem Absensi Sekolah</p>
              </div>

              <React.Suspense fallback={<div className="h-64 flex items-center justify-center">Loading...</div>}>
                <LiveSummaryView onLogout={onLogout} />
              </React.Suspense>
              
              {/* Menu Grid */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Menu Administrasi</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {menuItems.map((item) => (
                    <Card
                      key={item.id}
                      className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 bg-gradient-to-br from-white to-gray-50"
                      onClick={() => setActiveView(item.id)}
                    >
                      <CardContent className="p-6 text-center space-y-4">
                        <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r ${item.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                          <item.icon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                          <p className="text-sm text-gray-600">{item.description}</p>
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
      <FontSizeControl variant="floating" className="lg:hidden" />
      
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

