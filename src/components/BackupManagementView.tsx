/**
 * BACKUP MANAGEMENT VIEW
 * UI Component for managing backup and archive operations
 * Phase 2: Backup & Archive System
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { formatDateTime24, getCurrentYearWIB } from '../lib/time-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Calendar, Download, Archive, Trash2, RefreshCw, AlertCircle, CheckCircle, Clock, Database, FileSpreadsheet, Settings, Play, Pause, RotateCcw, Info, Zap, AlertTriangle } from 'lucide-react';
import { apiCall } from '@/utils/apiClient';
import { getApiUrl } from '@/config/api';
import { useToast } from '../hooks/use-toast';

interface BackupInfo {
    id: string;
    filename: string;
    size: number;
    created: string;
    modified: string;
    semester?: string;
    year?: number;
    type?: string;
    status?: string;
    backupType?: 'semester' | 'date';
}

interface BackupProgress {
    isRunning: boolean;
    progress: number;
    currentStep: string;
    estimatedTime: string;
}

interface ArchiveStats {
    studentRecords: number;
    teacherRecords: number;
    totalSize: number;
    lastArchive: string;
}

interface BackupSettings {
    autoBackupSchedule: string;
    maxBackups: number;
    archiveAge: number;
    compression: boolean;
    emailNotifications: boolean;
    lastBackupDate?: string;
    nextBackupDate?: string;
    customScheduleDate?: string;
    customScheduleTime?: string;
    customScheduleEnabled?: boolean;
}

interface CustomSchedule {
    id: string;
    name: string;
    date: string;
    time: string;
    enabled: boolean;
    created: string;
    lastRun?: string;
}

// =============================================================================
// HELPER FUNCTIONS (extracted to reduce cognitive complexity)
// =============================================================================

const DEFAULT_LOADING_STATES = {
    backups: false,
    archive: false,
    settings: false,
    schedules: false
};

const DEFAULT_BACKUP_PROGRESS: BackupProgress = {
    isRunning: false,
    progress: 0,
    currentStep: '',
    estimatedTime: ''
};

const DEFAULT_ARCHIVE_STATS: ArchiveStats = {
    studentRecords: 0,
    teacherRecords: 0,
    totalSize: 0,
    lastArchive: ''
};

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
    autoBackupSchedule: 'weekly',
    maxBackups: 10,
    archiveAge: 24,
    compression: true,
    emailNotifications: false,
    customScheduleDate: '',
    customScheduleTime: '02:00',
    customScheduleEnabled: false
};

const DEFAULT_NEW_SCHEDULE: Partial<CustomSchedule> = {
    name: '',
    date: '',
    time: '02:00',
    enabled: true
};

/**
 * Get progress step description based on percentage
 */
function getProgressStep(progress: number): string {
    if (progress < 15) return 'Menginisialisasi backup...';
    if (progress < 25) return 'Membuat backup database...';
    if (progress < 35) return 'Mengekspor data absensi siswa...';
    if (progress < 45) return 'Mengekspor data absensi guru...';
    if (progress < 55) return 'Mengekspor data jadwal...';
    if (progress < 65) return 'Mengekspor data kelas...';
    if (progress < 75) return 'Membuat laporan Excel...';
    if (progress < 85) return 'Mengarsipkan data lama...';
    if (progress < 95) return 'Mengompresi file backup...';
    return 'Menyelesaikan backup...';
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate backup parameters based on type
 */
function validateBackupParams(
    backupType: 'semester' | 'date',
    selectedSemester: string,
    selectedDate: string
): { isValid: boolean; errorMessage: string } {
    if (backupType === 'semester' && !selectedSemester) {
        return { isValid: false, errorMessage: 'Pilih semester terlebih dahulu' };
    }
    if (backupType === 'date' && !selectedDate) {
        return { isValid: false, errorMessage: 'Pilih tanggal mulai backup terlebih dahulu' };
    }
    return { isValid: true, errorMessage: '' };
}

/**
 * Build backup API config based on type
 */
function buildBackupConfig(
    backupType: 'semester' | 'date',
    selectedSemester: string,
    selectedYear: number,
    selectedDate: string,
    selectedEndDate: string
): { endpoint: string; payload: object } {
    if (backupType === 'semester') {
        return {
            endpoint: getApiUrl('/api/admin/create-semester-backup'),
            payload: { semester: selectedSemester, year: selectedYear }
        };
    }
    return {
        endpoint: getApiUrl('/api/admin/create-date-backup'),
        payload: { startDate: selectedDate, endDate: selectedEndDate || selectedDate }
    };
}

/**
 * Calculate progress update values
 */
function calculateProgressUpdate(currentProgress: number): BackupProgress {
    if (currentProgress >= 95) {
        return {
            isRunning: true,
            progress: 100,
            currentStep: 'Backup selesai!',
            estimatedTime: '0 menit'
        };
    }
    const increment = Math.random() * 15 + 5;
    const newProgress = Math.min(currentProgress + increment, 95);
    return {
        isRunning: true,
        progress: newProgress,
        currentStep: getProgressStep(newProgress),
        estimatedTime: `${Math.max(0, Math.ceil((100 - newProgress) / 10))} menit`
    };
}

const BackupManagementView: React.FC = () => {
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingStates, setLoadingStates] = useState(DEFAULT_LOADING_STATES);
    const [backupProgress, setBackupProgress] = useState<BackupProgress>(DEFAULT_BACKUP_PROGRESS);
    const [selectedSemester, setSelectedSemester] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number>(Number.parseInt(getCurrentYearWIB()));
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [backupType, setBackupType] = useState<'semester' | 'date'>('semester');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedEndDate, setSelectedEndDate] = useState<string>('');
    const [archiveStats, setArchiveStats] = useState<ArchiveStats>(DEFAULT_ARCHIVE_STATS);
    const [backupSettings, setBackupSettings] = useState<BackupSettings>(DEFAULT_BACKUP_SETTINGS);
    const [customSchedules, setCustomSchedules] = useState<CustomSchedule[]>([]);
    const [showScheduleDialog, setShowScheduleDialog] = useState(false);
    const [newSchedule, setNewSchedule] = useState<Partial<CustomSchedule>>(DEFAULT_NEW_SCHEDULE);
    const [archiveLoading, setArchiveLoading] = useState(false);
    const { toast } = useToast();

    // Load backups on component mount
    useEffect(() => {
        loadBackups();
        loadArchiveStats();
        loadBackupSettings();
        loadCustomSchedules();
    }, []); // Intentional: Load only on component mount, no dependencies needed.

    // Auto-refresh custom schedules every minute to update countdown
    useEffect(() => {
        const interval = setInterval(() => {
            loadCustomSchedules();
        }, 60000); // Refresh every minute

        return () => clearInterval(interval);
    }, []);

    const loadBackups = async () => {
        try {
            setLoadingStates(prev => ({ ...prev, backups: true }));
            const token = localStorage.getItem('token');
            const data = await apiCall('/api/admin/backups', {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            setBackups(data.backups || []);
            toast({
                title: "Berhasil",
                description: "Daftar backup berhasil dimuat",
            });
        } catch (error) {
            console.error('Error loading backups:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal memuat daftar backup",
                variant: "destructive"
            });
        } finally {
            setLoadingStates(prev => ({ ...prev, backups: false }));
        }
    };

    const loadArchiveStats = async () => {
        try {
            setLoadingStates(prev => ({ ...prev, archive: true }));
            const token = localStorage.getItem('token');
            const data = await apiCall('/api/admin/archive-stats', {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            setArchiveStats(data.stats || {
                studentRecords: 0,
                teacherRecords: 0,
                totalSize: 0,
                lastArchive: ''
            });
        } catch (error) {
            console.error('Error loading archive stats:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal memuat statistik arsip",
                variant: "destructive"
            });
        } finally {
            setLoadingStates(prev => ({ ...prev, archive: false }));
        }
    };

    const loadBackupSettings = async () => {
        try {
            setLoadingStates(prev => ({ ...prev, settings: true }));
            const token = localStorage.getItem('token');
            const data = await apiCall('/api/admin/backup-settings', {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            setBackupSettings(data.settings || backupSettings);
        } catch (error) {
            console.error('Error loading backup settings:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal memuat pengaturan backup",
                variant: "destructive"
            });
        } finally {
            setLoadingStates(prev => ({ ...prev, settings: false }));
        }
    };

    const loadCustomSchedules = async () => {
        try {
            setLoadingStates(prev => ({ ...prev, schedules: true }));
            const token = localStorage.getItem('token');
            const data = await apiCall('/api/admin/custom-schedules', {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            setCustomSchedules(data.schedules || []);
        } catch (error) {
            console.error('Error loading custom schedules:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal memuat jadwal custom",
                variant: "destructive"
            });
        } finally {
            setLoadingStates(prev => ({ ...prev, schedules: false }));
        }
    };

    const createCustomSchedule = async () => {
        if (!newSchedule.name || !newSchedule.date || !newSchedule.time) {
            toast({
                title: "Error",
                description: "Isi semua field yang diperlukan",
                variant: "destructive"
            });
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await apiCall('/api/admin/custom-schedules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(newSchedule)
            });

            setShowScheduleDialog(false);
            setNewSchedule({
                name: '',
                date: '',
                time: '02:00',
                enabled: true
            });
            loadCustomSchedules();
            toast({
                title: "Berhasil",
                description: "Jadwal backup custom berhasil dibuat",
            });
        } catch (error) {
            console.error('Error creating custom schedule:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal membuat jadwal backup custom",
                variant: "destructive"
            });
        }
    };

    const deleteCustomSchedule = async (scheduleId: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus jadwal backup ini?')) {
            return;
        }

        try {
            await apiCall(`/api/admin/custom-schedules/${scheduleId}`, {
                method: 'DELETE'
            });

            loadCustomSchedules();
            toast({
                title: "Berhasil",
                description: "Jadwal backup berhasil dihapus",
            });
        } catch (error) {
            console.error('Error deleting custom schedule:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal menghapus jadwal backup",
                variant: "destructive"
            });
        }
    };

    const toggleCustomSchedule = async (scheduleId: string, enabled: boolean) => {
        try {
            await apiCall(`/api/admin/custom-schedules/${scheduleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ enabled })
            });

            loadCustomSchedules();
            toast({
                title: "Berhasil",
                description: `Jadwal backup ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`,
            });
        } catch (error) {
            console.error('Error toggling custom schedule:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal mengubah status jadwal backup",
                variant: "destructive"
            });
        }
    };

    const runCustomSchedule = async (scheduleId: string) => {
        try {
            await apiCall(`/api/admin/run-custom-schedule/${scheduleId}`, {
                method: 'POST'
            });

            loadCustomSchedules();
            loadBackups();
            toast({
                title: "Berhasil",
                description: "Jadwal backup berhasil dijalankan",
            });
        } catch (error) {
            console.error('Error running custom schedule:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal menjalankan jadwal backup",
                variant: "destructive"
            });
        }
    };

    const createBackup = async () => {
        // Use extracted validation helper
        const validation = validateBackupParams(backupType, selectedSemester, selectedDate);
        if (!validation.isValid) {
            toast({
                title: "Error",
                description: validation.errorMessage,
                variant: "destructive"
            });
            return;
        }

        try {
            setBackupProgress({
                isRunning: true,
                progress: 0,
                currentStep: 'Menginisialisasi backup...',
                estimatedTime: '5-10 menit'
            });

            // Use extracted config builder
            const { endpoint, payload } = buildBackupConfig(
                backupType, selectedSemester, selectedYear, selectedDate, selectedEndDate
            );

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Failed to create backup');
            }

            // Progress simulation using extracted calculator
            const progressInterval = setInterval(() => {
                setBackupProgress(prev => {
                    if (prev.progress >= 95) {
                        clearInterval(progressInterval);
                    }
                    return calculateProgressUpdate(prev.progress);
                });
            }, 1500);

            const result = await response.json() as { data?: { backupId?: string } };
            
            setTimeout(() => {
                setBackupProgress(DEFAULT_BACKUP_PROGRESS);
                setShowCreateDialog(false);
                loadBackups();
                toast({
                    title: "Berhasil",
                    description: `Backup berhasil dibuat: ${result.data?.backupId || 'Backup'}`,
                });
            }, 10000);

        } catch (error) {
            console.error('Error creating backup:', error);
            setBackupProgress(DEFAULT_BACKUP_PROGRESS);
            toast({
                title: "Error",
                description: "Gagal membuat backup",
                variant: "destructive"
            });
        }
    };

    const downloadBackup = async (backupId: string) => {
        try {
            const response = await fetch(getApiUrl(`/api/admin/download-backup/${backupId}`), {
                credentials: 'include'
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${backupId}.zip`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                toast({
                    title: "Berhasil",
                    description: "Backup berhasil diunduh",
                });
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to download backup');
            }
        } catch (error) {
            console.error('Error downloading backup:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal mengunduh backup",
                variant: "destructive"
            });
        }
    };

    const deleteBackup = async (backupId: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus backup ini? Tindakan ini tidak dapat dibatalkan.')) {
            return;
        }

        try {

            
            const data = await apiCall(`/api/admin/delete-backup/${backupId}`, {
                method: 'DELETE'
            });
            

            
            loadBackups();
            toast({
                title: "Berhasil",
                description: data.message || "Backup berhasil dihapus",
            });
        } catch (error) {
            console.error('Error deleting backup:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal menghapus backup",
                variant: "destructive"
            });
        }
    };

    const restoreBackup = async (backupId: string) => {
        if (!confirm('Apakah Anda yakin ingin memulihkan backup ini? Ini akan menimpa data saat ini.')) {
            return;
        }

        try {
            await apiCall(`/api/admin/restore-backup/${backupId}`, {
                method: 'POST'
            });

            toast({
                title: "Berhasil",
                description: "Backup berhasil dipulihkan",
            });
        } catch (error) {
            console.error('Error restoring backup:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal memulihkan backup",
                variant: "destructive"
            });
        }
    };

    const archiveOldData = async () => {
        try {
            setArchiveLoading(true);
            const token = localStorage.getItem('token');
            await apiCall('/api/admin/archive-old-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    monthsOld: backupSettings.archiveAge
                })
            });

            loadArchiveStats();
            toast({
                title: "Berhasil",
                description: "Data lama berhasil diarsipkan",
            });
        } catch (error) {
            console.error('Error archiving old data:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal mengarsipkan data lama",
                variant: "destructive"
            });
        } finally {
            setArchiveLoading(false);
        }
    };

    const createTestArchiveData = async () => {
        try {
            setArchiveLoading(true);
            const token = localStorage.getItem('token');
            const data = await apiCall('/api/admin/create-test-archive-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });

            loadArchiveStats();
            toast({
                title: "Berhasil",
                description: `Data test berhasil dibuat: ${data.data.studentRecordsCreated} siswa, ${data.data.teacherRecordsCreated} guru`,
            });
        } catch (error) {
            console.error('Error creating test archive data:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal membuat data test",
                variant: "destructive",
            });
        } finally {
            setArchiveLoading(false);
        }
    };

    const saveBackupSettings = async () => {
        try {
            setLoadingStates(prev => ({ ...prev, settings: true }));
            const token = localStorage.getItem('token');
            await apiCall('/api/admin/backup-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(backupSettings)
            });

            toast({
                title: "Berhasil",
                description: "Pengaturan backup berhasil disimpan",
            });
        } catch (error) {
            console.error('Error saving backup settings:', error);
            toast({
                title: "Error",
                description: error.message || "Gagal menyimpan pengaturan backup",
                variant: "destructive"
            });
        } finally {
            setLoadingStates(prev => ({ ...prev, settings: false }));
        }
    };

    const formatDate = (dateString: string): string => {
        return formatDateTime24(dateString, true);
    };



    return (
        <div className="space-y-6">
            {/* Header Section - Mobile Responsive */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Backup & Archive Management</h2>
                    <p className="text-sm lg:text-base text-muted-foreground mt-1">
                        Kelola backup database dan operasi arsip
                    </p>
                    
                    {/* Status Information - Mobile Optimized */}
                    <div className="mt-3 space-y-1">
                        {customSchedules.filter(s => s.enabled && !s.lastRun).length > 0 && (
                            <div className="text-xs lg:text-sm text-blue-600 flex items-center">
                                <Clock className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                                <span className="truncate">
                                    {customSchedules.filter(s => s.enabled && !s.lastRun).length} jadwal backup aktif menunggu waktu
                                </span>
                            </div>
                        )}
                        {customSchedules.filter(s => s.lastRun).length > 0 && (
                            <div className="text-xs lg:text-sm text-green-600 flex items-center">
                                <CheckCircle className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                                <span className="truncate">
                                    {customSchedules.filter(s => s.lastRun).length} jadwal backup sudah dijalankan
                                </span>
                            </div>
                        )}
                        {customSchedules.length === 0 && (
                            <div className="text-xs lg:text-sm text-gray-500 flex items-center">
                                <Calendar className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                                <span className="truncate">Belum ada jadwal backup custom yang dikonfigurasi</span>
                            </div>
                        )}
                        {customSchedules.filter(s => s.enabled && !s.lastRun).length > 0 && (
                            <div className="text-xs lg:text-sm text-orange-600 flex items-center">
                                <Clock className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                                <span className="truncate">
                                    Jadwal berikutnya: {(() => {
                                        const nextSchedule = customSchedules
                                            .filter(s => s.enabled && !s.lastRun)
                                            .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())[0];
                                        if (nextSchedule) {
                                            return formatDateTime24(`${nextSchedule.date}T${nextSchedule.time}`, true);
                                        }
                                        return '';
                                    })()}
                                </span>
                            </div>
                        )}
                        {customSchedules.filter(s => s.enabled && !s.lastRun).length > 0 && (
                            <div className="text-xs lg:text-sm text-blue-600 flex items-center">
                                <Info className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                                <span className="truncate">Server akan otomatis menjalankan backup pada waktu yang dijadwalkan</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Action Buttons - Mobile Responsive */}
                <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
                    <div className="flex gap-2">
                        <Button onClick={loadBackups} variant="outline" size="sm" disabled={loadingStates.backups} className="flex-1 sm:flex-none">
                            <RefreshCw className={`h-4 w-4 mr-2 ${loadingStates.backups ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">{loadingStates.backups ? 'Memuat...' : 'Refresh'}</span>
                            <span className="sm:hidden">{loadingStates.backups ? '...' : '↻'}</span>
                        </Button>

                    </div>
                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                        <DialogTrigger asChild>
                            <Button className="w-full sm:w-auto">
                                <Database className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Buat Backup</span>
                                <span className="sm:hidden">Backup</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md mx-4 sm:mx-auto">
                            <DialogHeader>
                                <DialogTitle className="text-lg sm:text-xl">Buat Backup</DialogTitle>
                                <DialogDescription className="text-sm">
                                    Pilih tipe backup yang ingin dibuat
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                {/* Tipe Backup */}
                                <div className="space-y-2">
                                    <Label>Tipe Backup</Label>
                                    <Select value={backupType} onValueChange={(value: 'semester' | 'date') => setBackupType(value)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="semester">Backup Semester</SelectItem>
                                            <SelectItem value="date">Backup Berdasarkan Tanggal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Form Semester Backup */}
                                {backupType === 'semester' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Semester</Label>
                                            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih semester" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Ganjil">Ganjil</SelectItem>
                                                    <SelectItem value="Genap">Genap</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tahun</Label>
                                            <Input 
                                                type="number" 
                                                value={selectedYear} 
                                                onChange={(e) => setSelectedYear(Number.parseInt(e.target.value))}
                                                min="2020"
                                                max="2030"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Form Date Backup */}
                                {backupType === 'date' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Tanggal Mulai</Label>
                                            <Input 
                                                type="date" 
                                                value={selectedDate} 
                                                onChange={(e) => setSelectedDate(e.target.value)}
                                                max={(() => {
                                                  const now = new Date();
                                                  const year = now.getFullYear();
                                                  const month = String(now.getMonth() + 1).padStart(2, '0');
                                                  const day = String(now.getDate()).padStart(2, '0');
                                                  return `${year}-${month}-${day}`;
                                                })()}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tanggal Selesai (Opsional)</Label>
                                            <Input 
                                                type="date" 
                                                value={selectedEndDate} 
                                                onChange={(e) => setSelectedEndDate(e.target.value)}
                                                min={selectedDate}
                                                max={(() => {
                                                  const now = new Date();
                                                  const year = now.getFullYear();
                                                  const month = String(now.getMonth() + 1).padStart(2, '0');
                                                  const day = String(now.getDate()).padStart(2, '0');
                                                  return `${year}-${month}-${day}`;
                                                })()}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Kosongkan untuk backup satu hari saja
                                            </p>
                                        </div>
                                    </>
                                )}

                                <Button 
                                    onClick={createBackup} 
                                    className="w-full" 
                                    disabled={
                                        (backupType === 'semester' && !selectedSemester) ||
                                        (backupType === 'date' && !selectedDate)
                                    }
                                >
                                    <Database className="h-4 w-4 mr-2" />
                                    Buat Backup
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Backup Progress */}
            {backupProgress.isRunning && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Backup Progress
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>{backupProgress.currentStep}</span>
                                    <span>{backupProgress.progress}%</span>
                                </div>
                                <Progress value={backupProgress.progress} className="w-full" />
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Estimasi waktu: {backupProgress.estimatedTime}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="backups" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-none lg:inline-flex">
                    <TabsTrigger value="backups" className="text-xs sm:text-sm">Backups</TabsTrigger>
                    <TabsTrigger value="archive" className="text-xs sm:text-sm">Archive</TabsTrigger>
                    <TabsTrigger value="settings" className="text-xs sm:text-sm">Pengaturan</TabsTrigger>
                </TabsList>

                <TabsContent value="backups" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Backup Tersedia</CardTitle>
                            <CardDescription>
                                Kelola backup database dan titik pemulihan
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingStates.backups ? (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                                    Memuat backup...
                                </div>
                            ) : backups.length === 0 ? (
                                <div className="text-center py-8">
                                    <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">Belum ada backup</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Buat backup pertama untuk melindungi data Anda
                                    </p>
                                    <Button onClick={() => setShowCreateDialog(true)}>
                                        <Database className="h-4 w-4 mr-2" />
                                        Buat Backup Pertama
                                    </Button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="min-w-[200px]">Nama File</TableHead>
                                                <TableHead className="min-w-[80px]">Ukuran</TableHead>
                                                <TableHead className="min-w-[120px]">Dibuat</TableHead>
                                                <TableHead className="min-w-[80px]">Tipe</TableHead>
                                                <TableHead className="min-w-[100px]">Info</TableHead>
                                                <TableHead className="min-w-[80px]">Status</TableHead>
                                                <TableHead className="min-w-[120px]">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {backups.map((backup) => (
                                                <TableRow key={backup.id}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <FileSpreadsheet className="h-4 w-4 flex-shrink-0" />
                                                            <span className="truncate">{backup.filename}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{formatFileSize(backup.size)}</TableCell>
                                                    <TableCell className="text-sm">{formatDate(backup.created)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={backup.backupType === 'semester' ? 'default' : 'secondary'} className="text-xs">
                                                            {backup.backupType === 'semester' ? 'Semester' : 'Tanggal'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {backup.backupType === 'semester' ? (
                                                            <Badge variant="outline" className="text-xs">
                                                                {backup.semester} {backup.year}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-xs">
                                                                Date Range
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {backup.status || 'Siap'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => downloadBackup(backup.id)}
                                                                className="h-8 w-8 p-0"
                                                                title="Download"
                                                            >
                                                                <Download className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => restoreBackup(backup.id)}
                                                                className="h-8 w-8 p-0"
                                                                title="Restore"
                                                            >
                                                                <RotateCcw className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => deleteBackup(backup.id)}
                                                                className="h-8 w-8 p-0"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="archive" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Archive Management</CardTitle>
                            <CardDescription>
                                Kelola data arsip dan pembersihan record lama
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert>
                                <CheckCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Sistem arsip secara otomatis memindahkan data lama ke tabel arsip untuk meningkatkan performa.
                                    Data yang lebih tua dari {backupSettings.archiveAge} bulan akan diarsipkan secara otomatis.
                                </AlertDescription>
                            </Alert>
                            
                            {archiveStats.studentRecords === 0 && archiveStats.teacherRecords === 0 && (
                                <Alert variant="default">
                                    <Info className="h-4 w-4" />
                                    <AlertDescription>
                                        <strong>Info:</strong> Tidak ada data yang perlu diarsipkan saat ini. 
                                        Data akan diarsipkan secara otomatis ketika berusia lebih dari {backupSettings.archiveAge} bulan.
                                        <br />
                                        <span className="text-sm text-muted-foreground">
                                            Data saat ini masih baru dan belum memenuhi kriteria arsip.
                                        </span>
                                    </AlertDescription>
                                </Alert>
                            )}
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                            <Archive className="h-4 w-4 sm:h-5 sm:w-5" />
                                            <span className="truncate">Arsip Siswa</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="text-xl sm:text-2xl font-bold text-blue-600">{archiveStats.studentRecords.toLocaleString()}</div>
                                        <p className="text-xs sm:text-sm text-muted-foreground">
                                            Record siswa yang diarsipkan
                                        </p>
                                        {archiveStats.studentRecords === 0 && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Belum ada data siswa yang diarsipkan
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                                
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                            <Archive className="h-4 w-4 sm:h-5 sm:w-5" />
                                            <span className="truncate">Arsip Guru</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="text-xl sm:text-2xl font-bold text-green-600">{archiveStats.teacherRecords.toLocaleString()}</div>
                                        <p className="text-xs sm:text-sm text-muted-foreground">
                                            Record guru yang diarsipkan
                                        </p>
                                        {archiveStats.teacherRecords === 0 && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Belum ada data guru yang diarsipkan
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                            
                            {archiveStats.totalSize > 0 && (
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base sm:text-lg">Informasi Arsip</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs sm:text-sm text-muted-foreground">Total Ukuran Arsip</p>
                                                <p className="text-base sm:text-lg font-semibold">{formatFileSize(archiveStats.totalSize)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs sm:text-sm text-muted-foreground">Arsip Terakhir</p>
                                                <p className="text-base sm:text-lg font-semibold">
                                                    {archiveStats.lastArchive ? formatDate(archiveStats.lastArchive) : 'Belum ada'}
                                                </p>
                                            </div>
                                            <div className="sm:col-span-2 lg:col-span-1">
                                                <p className="text-xs sm:text-sm text-muted-foreground">Kriteria Arsip</p>
                                                <p className="text-base sm:text-lg font-semibold">{backupSettings.archiveAge} bulan</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Archive Action Buttons - Mobile Responsive */}
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button 
                                    onClick={archiveOldData} 
                                    disabled={archiveLoading}
                                    variant="outline"
                                    className="flex-1 sm:flex-none sm:min-w-[200px]"
                                >
                                    {archiveLoading ? (
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Archive className="h-4 w-4 mr-2" />
                                    )}
                                    <span className="hidden sm:inline">Arsipkan Data Lama ({backupSettings.archiveAge} bulan)</span>
                                    <span className="sm:hidden">Arsipkan Data Lama</span>
                                </Button>
                                <Button 
                                    onClick={loadArchiveStats} 
                                    variant="outline" 
                                    className="flex-1 sm:flex-none sm:min-w-[150px]" 
                                    disabled={loadingStates.archive}
                                >
                                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingStates.archive ? 'animate-spin' : ''}`} />
                                    <span className="hidden sm:inline">{loadingStates.archive ? 'Memuat...' : 'Refresh Stats'}</span>
                                    <span className="sm:hidden">{loadingStates.archive ? '...' : 'Refresh'}</span>
                                </Button>
                                <Button 
                                    onClick={createTestArchiveData} 
                                    disabled={archiveLoading}
                                    variant="secondary"
                                    className="flex-1 sm:flex-none sm:min-w-[180px]"
                                >
                                    <Database className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Buat Data Test (25 bulan)</span>
                                    <span className="sm:hidden">Data Test</span>
                                </Button>
                            </div>
                            
                            <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
                                <p><strong>Catatan:</strong></p>
                                <ul className="list-disc list-inside space-y-1 mt-2">
                                    <li>Data yang berusia lebih dari {backupSettings.archiveAge} bulan akan dipindahkan ke tabel arsip</li>
                                    <li>Proses arsip akan memindahkan data dari tabel utama ke tabel arsip</li>
                                    <li>Data yang diarsipkan tetap dapat diakses melalui sistem backup</li>
                                    <li>Arsip otomatis berjalan setiap hari pada jam 02:00 WIB</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <Tabs defaultValue="general" className="space-y-4">
                        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-none lg:inline-flex">
                            <TabsTrigger value="general" className="text-xs sm:text-sm">Pengaturan Umum</TabsTrigger>
                            <TabsTrigger value="schedule" className="text-xs sm:text-sm">Jadwal Backup</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Pengaturan Backup</CardTitle>
                                    <CardDescription>
                                        Konfigurasi pengaturan backup dan arsip
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-sm">Jadwal Auto Backup</Label>
                                            <Select 
                                                value={backupSettings.autoBackupSchedule} 
                                                onValueChange={(value) => setBackupSettings(prev => ({ ...prev, autoBackupSchedule: value }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="daily">Harian</SelectItem>
                                                    <SelectItem value="weekly">Mingguan</SelectItem>
                                                    <SelectItem value="monthly">Bulanan</SelectItem>
                                                    <SelectItem value="disabled">Nonaktif</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                
                                        <div className="space-y-2">
                                            <Label className="text-sm">Max Backup yang Disimpan</Label>
                                            <Input 
                                                type="number" 
                                                value={backupSettings.maxBackups} 
                                                onChange={(e) => setBackupSettings(prev => ({ ...prev, maxBackups: Number.parseInt(e.target.value) }))}
                                                min="1" 
                                                max="50" 
                                            />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label className="text-sm">Usia Arsip (bulan)</Label>
                                            <Input 
                                                type="number" 
                                                value={backupSettings.archiveAge} 
                                                onChange={(e) => setBackupSettings(prev => ({ ...prev, archiveAge: Number.parseInt(e.target.value) }))}
                                                min="6" 
                                                max="60" 
                                            />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label className="text-sm">Kompresi</Label>
                                            <Select 
                                                value={backupSettings.compression ? 'enabled' : 'disabled'} 
                                                onValueChange={(value) => setBackupSettings(prev => ({ ...prev, compression: value === 'enabled' }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="enabled">Aktif</SelectItem>
                                                    <SelectItem value="disabled">Nonaktif</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                            
                            {/* Custom Schedule Section Removed - Use 'Jadwal Backup' tab instead */}
                            
                            {/* Informasi Tanggal Backup */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Informasi Tanggal Backup
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs sm:text-sm font-medium text-blue-800">Backup Terakhir</Label>
                                        <div className="p-3 bg-white border border-blue-200 rounded-lg">
                                            <p className="text-xs sm:text-sm text-gray-600">
                                                {backupSettings.lastBackupDate 
                                                    ? new Date(backupSettings.lastBackupDate).toLocaleDateString('id-ID', {
                                                        weekday: 'long',
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })
                                                    : 'Belum ada backup'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs sm:text-sm font-medium text-blue-800">Backup Berikutnya</Label>
                                        <div className="p-3 bg-white border border-blue-200 rounded-lg">
                                            <p className="text-xs sm:text-sm text-gray-600">
                                                {backupSettings.nextBackupDate 
                                                    ? new Date(backupSettings.nextBackupDate).toLocaleDateString('id-ID', {
                                                        weekday: 'long',
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })
                                                    : 'Tidak terjadwal'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Informasi Tambahan */}
                                <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-medium text-blue-800">Status Backup</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-blue-700">Total Backup:</span>
                                            <span className="font-medium text-blue-900">{backups.length} file</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-blue-700">Jadwal:</span>
                                            <span className="font-medium text-blue-900">
                                                {backupSettings.autoBackupSchedule === 'daily' ? 'Harian' :
                                                 backupSettings.autoBackupSchedule === 'weekly' ? 'Mingguan' :
                                                 backupSettings.autoBackupSchedule === 'monthly' ? 'Bulanan' : 'Nonaktif'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-blue-700">Usia Arsip:</span>
                                            <span className="font-medium text-blue-900">{backupSettings.archiveAge} bulan</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <Button onClick={saveBackupSettings} className="w-full" disabled={loadingStates.settings}>
                                <Settings className="h-4 w-4 mr-2" />
                                {loadingStates.settings ? 'Menyimpan...' : 'Simpan Pengaturan'}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="schedule" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Jadwal Backup Custom</CardTitle>
                            <CardDescription>
                                Kelola jadwal backup berdasarkan tanggal dan waktu spesifik
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-semibold">Jadwal Backup yang Dikonfigurasi</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                        Buat jadwal backup untuk tanggal dan waktu tertentu
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Button onClick={loadCustomSchedules} variant="outline" size="sm" disabled={loadingStates.schedules} className="w-full sm:w-auto">
                                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingStates.schedules ? 'animate-spin' : ''}`} />
                                        <span className="hidden sm:inline">{loadingStates.schedules ? 'Memuat...' : 'Refresh'}</span>
                                        <span className="sm:hidden">{loadingStates.schedules ? '...' : '↻'}</span>
                                    </Button>
                                    <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full sm:w-auto">
                                            <Calendar className="h-4 w-4 mr-2" />
                                            <span className="hidden sm:inline">Tambah Jadwal</span>
                                            <span className="sm:hidden">Tambah</span>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md mx-4 sm:mx-auto">
                                        <DialogHeader>
                                            <DialogTitle className="text-lg sm:text-xl">Tambah Jadwal Backup</DialogTitle>
                                            <DialogDescription className="text-sm">
                                                Buat jadwal backup untuk tanggal dan waktu tertentu
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Nama Jadwal</Label>
                                                <Input 
                                                    placeholder="Contoh: Backup Akhir Semester"
                                                    value={newSchedule.name || ''}
                                                    onChange={(e) => setNewSchedule(prev => ({ ...prev, name: e.target.value }))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Tanggal Backup</Label>
                                                <Input 
                                                    type="date" 
                                                    value={newSchedule.date || ''}
                                                    onChange={(e) => setNewSchedule(prev => ({ ...prev, date: e.target.value }))}
                                                    min={(() => {
                                                  const now = new Date();
                                                  const year = now.getFullYear();
                                                  const month = String(now.getMonth() + 1).padStart(2, '0');
                                                  const day = String(now.getDate()).padStart(2, '0');
                                                  return `${year}-${month}-${day}`;
                                                })()}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Waktu Backup</Label>
                                                <Input 
                                                    type="time" 
                                                    value={newSchedule.time || '02:00'}
                                                    onChange={(e) => setNewSchedule(prev => ({ ...prev, time: e.target.value }))}
                                                />
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id="enabled"
                                                    checked={newSchedule.enabled || false}
                                                    onChange={(e) => setNewSchedule(prev => ({ ...prev, enabled: e.target.checked }))}
                                                    className="rounded"
                                                />
                                                <Label htmlFor="enabled">Aktifkan jadwal ini</Label>
                                            </div>
                                            <Button onClick={createCustomSchedule} className="w-full">
                                                <Calendar className="h-4 w-4 mr-2" />
                                                Buat Jadwal
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                </div>
                            </div>

                            {/* Status Jadwal */}
                            {customSchedules.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Status Jadwal Backup
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="text-center">
                                            <div className="text-xl sm:text-2xl font-bold text-blue-600">
                                                {customSchedules.filter(s => s.enabled).length}
                                            </div>
                                            <p className="text-xs sm:text-sm text-blue-800">Jadwal Aktif</p>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl sm:text-2xl font-bold text-green-600">
                                                {customSchedules.filter(s => s.lastRun).length}
                                            </div>
                                            <p className="text-xs sm:text-sm text-green-800">Sudah Dijalankan</p>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl sm:text-2xl font-bold text-orange-600">
                                                {customSchedules.filter(s => s.enabled && !s.lastRun).length}
                                            </div>
                                            <p className="text-xs sm:text-sm text-orange-800">Menunggu Waktu</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {customSchedules.length === 0 ? (
                                <div className="text-center py-8">
                                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">Belum ada jadwal custom</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Buat jadwal backup untuk tanggal dan waktu tertentu
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="min-w-[150px]">Nama Jadwal</TableHead>
                                                <TableHead className="min-w-[120px]">Tanggal</TableHead>
                                                <TableHead className="min-w-[80px]">Waktu</TableHead>
                                                <TableHead className="min-w-[80px]">Status</TableHead>
                                                <TableHead className="min-w-[120px]">Terakhir Dijalankan</TableHead>
                                                <TableHead className="min-w-[100px]">Dibuat</TableHead>
                                                <TableHead className="min-w-[120px]">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {customSchedules.map((schedule) => (
                                                <TableRow key={schedule.id}>
                                                    <TableCell className="font-medium">
                                                        <span className="truncate block">{schedule.name}</span>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {(() => {
                                                            try {
                                                                const dateObj = new Date(schedule.date + 'T00:00:00');
                                                                if (Number.isNaN(dateObj.getTime())) return schedule.date;
                                                                return dateObj.toLocaleDateString('id-ID', {
                                                                    weekday: 'long',
                                                                    year: 'numeric',
                                                                    month: 'long',
                                                                    day: 'numeric'
                                                                });
                                                            } catch {
                                                                return schedule.date;
                                                            }
                                                        })()}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {schedule.time}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={schedule.enabled ? 'default' : 'secondary'} className="text-xs">
                                                            {schedule.enabled ? 'Aktif' : 'Nonaktif'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {schedule.lastRun 
                                                            ? new Date(schedule.lastRun).toLocaleDateString('id-ID', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })
                                                            : 'Belum pernah dijalankan'
                                                        }
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {(() => {
                                                            try {
                                                                const dateObj = new Date(schedule.created);
                                                                if (Number.isNaN(dateObj.getTime())) return 'N/A';
                                                                return dateObj.toLocaleDateString('id-ID');
                                                            } catch {
                                                                return 'N/A';
                                                            }
                                                        })()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => runCustomSchedule(schedule.id)}
                                                                title="Jalankan sekarang"
                                                                className="h-8 w-8 p-0"
                                                            >
                                                                <Zap className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => toggleCustomSchedule(schedule.id, !schedule.enabled)}
                                                                title={schedule.enabled ? "Nonaktifkan jadwal" : "Aktifkan jadwal"}
                                                                className="h-8 w-8 p-0"
                                                            >
                                                                {schedule.enabled ? (
                                                                    <Pause className="h-3 w-3" />
                                                                ) : (
                                                                    <Play className="h-3 w-3" />
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => deleteCustomSchedule(schedule.id)}
                                                                title="Hapus jadwal"
                                                                className="h-8 w-8 p-0"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* Jadwal yang Sudah Dijalankan */}
                            {customSchedules.filter(s => s.lastRun).length > 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" />
                                        Jadwal yang Sudah Dijalankan
                                    </h4>
                                    <div className="space-y-2">
                                        {customSchedules
                                            .filter(s => s.lastRun)
                                            .sort((a, b) => new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime())
                                            .slice(0, 3)
                                            .map((schedule) => (
                                                <div key={schedule.id} className="flex justify-between items-center p-2 bg-white rounded border">
                                                    <div>
                                                        <span className="font-medium">{schedule.name}</span>
                                                        <span className="text-sm text-gray-600 ml-2">
                                                            Dijalankan: {new Date(schedule.lastRun).toLocaleDateString('id-ID', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <Badge variant="default" className="text-green-700 bg-green-100">
                                                        Selesai
                                                    </Badge>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Jadwal Mendatang */}
                            {customSchedules.filter(s => s.enabled && !s.lastRun).length > 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        Jadwal Mendatang
                                    </h4>
                                    <div className="space-y-2">
                                        {customSchedules
                                            .filter(s => s.enabled && !s.lastRun)
                                            .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
                                            .slice(0, 3)
                                            .map((schedule) => (
                                                <div key={schedule.id} className="flex justify-between items-center p-2 bg-white rounded border">
                                                    <div>
                                                        <span className="font-medium">{schedule.name}</span>
                                                        <span className="text-sm text-gray-600 ml-2">
                                                            {new Date(`${schedule.date}T${schedule.time}`).toLocaleDateString('id-ID', {
                                                                weekday: 'long',
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {(() => {
                                                                const now = new Date();
                                                                const scheduleTime = new Date(`${schedule.date}T${schedule.time}`);
                                                                const diff = scheduleTime.getTime() - now.getTime();
                                                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                                
                                                                if (days > 0) {
                                                                    return `Tersisa ${days} hari ${hours} jam`;
                                                                } else if (hours > 0) {
                                                                    return `Tersisa ${hours} jam ${minutes} menit`;
                                                                } else if (minutes > 0) {
                                                                    return `Tersisa ${minutes} menit`;
                                                                } else {
                                                                    return 'Akan segera dijalankan';
                                                                }
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-green-700 border-green-300">
                                                        Menunggu
                                                    </Badge>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Info:</strong> Jadwal backup custom akan berjalan pada tanggal dan waktu yang ditentukan. 
                                    Pastikan server berjalan pada waktu yang dijadwalkan untuk memastikan backup berhasil dibuat.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </TabsContent>
            </Tabs>
        </div>
    );
};

export default BackupManagementView;