/**
 * BACKUP MANAGEMENT VIEW
 * UI Component for managing backup and archive operations
 * Phase 2: Backup & Archive System
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { getCurrentYearWIB } from '../lib/time-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Calendar, Download, Archive, Trash2, RefreshCw, CheckCircle, Clock, Database, FileSpreadsheet, Settings, Play, Pause, RotateCcw, Info, Zap } from 'lucide-react';
import { getErrorMessage } from '@/utils/apiClient';
import { useToast } from '../hooks/use-toast';
import {
    BackupInfo,
    BackupProgress,
    ArchiveStats,
    BackupSettings,
    CustomSchedule,
    DEFAULT_LOADING_STATES,
    DEFAULT_BACKUP_PROGRESS,
    DEFAULT_ARCHIVE_STATS,
    DEFAULT_BACKUP_SETTINGS,
    DEFAULT_NEW_SCHEDULE,
    getTodayDateString,
    formatFileSize,
    formatDate,
    validateBackupParams,
    buildBackupConfig,
    calculateProgressUpdate,
    BackupService
} from './BackupManagementView.helpers';

const BackupManagementView: React.FC = () => {
    const [backups, setBackups] = useState<BackupInfo[]>([]);

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

    // Derived state for performance optimization (SonarQube)
    const pendingSchedules = customSchedules.filter(s => s.enabled && !s.lastRun);
    const completedSchedules = customSchedules.filter(s => s.lastRun);
    const nextSchedule = pendingSchedules.sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())[0];

    // Helper functions to extract nested ternaries (SonarQube code smell cleanup)
    const getScheduleBadgeVariant = (schedule: CustomSchedule): 'default' | 'secondary' | 'outline' => {
        if (schedule.enabled) {
            return schedule.lastRun ? 'secondary' : 'default';
        }
        return 'outline';
    };

    const getScheduleBadgeText = (schedule: CustomSchedule): string => {
        if (schedule.lastRun) {
            return 'Selesai';
        }
        if (schedule.enabled) {
            return 'Aktif';
        }
        return 'Nonaktif';
    };

    const loadBackups = useCallback(async () => {
        try {
            setLoadingStates(prev => ({ ...prev, backups: true }));
            const data = await BackupService.fetchBackups();
            setBackups(data);
            toast({ title: "Berhasil", description: "Daftar backup berhasil dimuat" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal memuat daftar backup", variant: "destructive" });
        } finally {
            setLoadingStates(prev => ({ ...prev, backups: false }));
        }
    }, [toast]);

    const loadArchiveStats = useCallback(async () => {
        try {
            setLoadingStates(prev => ({ ...prev, archive: true }));
            const stats = await BackupService.fetchArchiveStats();
            setArchiveStats(stats);
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal memuat statistik arsip", variant: "destructive" });
        } finally {
            setLoadingStates(prev => ({ ...prev, archive: false }));
        }
    }, [toast]);

    const loadBackupSettings = useCallback(async () => {
        try {
            setLoadingStates(prev => ({ ...prev, settings: true }));
            const settings = await BackupService.fetchSettings();
            setBackupSettings(settings);
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal memuat pengaturan backup", variant: "destructive" });
        } finally {
            setLoadingStates(prev => ({ ...prev, settings: false }));
        }
    }, [toast]);

    const loadCustomSchedules = useCallback(async () => {
        try {
            setLoadingStates(prev => ({ ...prev, schedules: true }));
            const schedules = await BackupService.fetchCustomSchedules();
            setCustomSchedules(schedules);
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal memuat jadwal custom", variant: "destructive" });
        } finally {
            setLoadingStates(prev => ({ ...prev, schedules: false }));
        }
    }, [toast]);

    // Load backups on component mount
    useEffect(() => {
        loadBackups();
        loadArchiveStats();
        loadBackupSettings();
        loadCustomSchedules();
    }, [loadBackups, loadArchiveStats, loadBackupSettings, loadCustomSchedules]);

    // Auto-refresh custom schedules every minute to update countdown
    useEffect(() => {
        const interval = setInterval(() => {
            loadCustomSchedules();
        }, 60000); // Refresh every minute

        return () => clearInterval(interval);
    }, [loadCustomSchedules]);

    const createCustomSchedule = async () => {
        if (!newSchedule.name || !newSchedule.date || !newSchedule.time) {
            toast({ title: "Error", description: "Isi semua field yang diperlukan", variant: "destructive" });
            return;
        }

        try {
            await BackupService.createCustomSchedule(newSchedule);
            setShowScheduleDialog(false);
            setNewSchedule(DEFAULT_NEW_SCHEDULE);
            loadCustomSchedules();
            toast({ title: "Berhasil", description: "Jadwal backup custom berhasil dibuat" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal membuat jadwal backup custom", variant: "destructive" });
        }
    };

    const deleteCustomSchedule = async (scheduleId: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus jadwal backup ini?')) return;

        try {
            await BackupService.deleteCustomSchedule(scheduleId);
            loadCustomSchedules();
            toast({ title: "Berhasil", description: "Jadwal backup berhasil dihapus" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal menghapus jadwal backup", variant: "destructive" });
        }
    };

    const toggleCustomSchedule = async (scheduleId: string, enabled: boolean) => {
        try {
            await BackupService.toggleCustomSchedule(scheduleId, enabled);
            loadCustomSchedules();
            toast({ title: "Berhasil", description: `Jadwal backup ${enabled ? 'diaktifkan' : 'dinonaktifkan'}` });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal mengubah status jadwal backup", variant: "destructive" });
        }
    };

    const runCustomSchedule = async (scheduleId: string) => {
        try {
            await BackupService.runCustomSchedule(scheduleId);
            loadCustomSchedules();
            loadBackups();
            toast({ title: "Berhasil", description: "Jadwal backup berhasil dijalankan" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal menjalankan jadwal backup", variant: "destructive" });
        }
    };

    const createBackup = async () => {
        const validation = validateBackupParams(backupType, selectedSemester, selectedDate);
        if (!validation.isValid) {
            toast({ title: "Error", description: validation.errorMessage, variant: "destructive" });
            return;
        }

        try {
            setBackupProgress({
                isRunning: true,
                progress: 0,
                currentStep: 'Menginisialisasi backup...',
                estimatedTime: '5-10 menit'
            });

            const { endpoint, payload } = buildBackupConfig(
                backupType, selectedSemester, selectedYear, selectedDate, selectedEndDate
            );

            const result = await BackupService.createBackup(endpoint, payload);

            const progressInterval = setInterval(() => {
                setBackupProgress(prev => {
                    const shouldStop = prev.progress >= 95;
                    if (shouldStop) clearInterval(progressInterval);
                    return calculateProgressUpdate(prev.progress);
                });
            }, 1500);

            setTimeout(() => {
                setBackupProgress(DEFAULT_BACKUP_PROGRESS);
                setShowCreateDialog(false);
                loadBackups();
                toast({ title: "Berhasil", description: `Backup berhasil dibuat: ${result.backupId || 'Backup'}` });
            }, 10000);

        } catch (error) {
            setBackupProgress(DEFAULT_BACKUP_PROGRESS);
            console.error('BackupManagementView: Failed to create backup', error);
            toast({ title: "Error", description: "Gagal membuat backup", variant: "destructive" });
        }
    };

    const downloadBackup = async (backupId: string) => {
        try {
            await BackupService.downloadBackup(backupId);
            toast({ title: "Berhasil", description: "Backup berhasil diunduh" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal mengunduh backup", variant: "destructive" });
        }
    };

    const deleteBackup = async (backupId: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus backup ini? Tindakan ini tidak dapat dibatalkan.')) return;

        try {
            const message = await BackupService.deleteBackup(backupId);
            loadBackups();
            toast({ title: "Berhasil", description: message || "Backup berhasil dihapus" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal menghapus backup", variant: "destructive" });
        }
    };

    const restoreBackup = async (backupId: string) => {
        if (!confirm('Apakah Anda yakin ingin memulihkan backup ini? Ini akan menimpa data saat ini.')) return;

        try {
            await BackupService.restoreBackup(backupId);
            toast({ title: "Berhasil", description: "Backup berhasil dipulihkan" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal memulihkan backup", variant: "destructive" });
        }
    };

    const archiveOldData = async () => {
        try {
            setArchiveLoading(true);
            await BackupService.archiveOldData(backupSettings.archiveAge);
            loadArchiveStats();
            toast({ title: "Berhasil", description: "Data lama berhasil diarsipkan" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal mengarsipkan data lama", variant: "destructive" });
        } finally {
            setArchiveLoading(false);
        }
    };

    const createTestArchiveData = async () => {
        try {
            setArchiveLoading(true);
            const data = await BackupService.createTestArchiveData();
            loadArchiveStats();
            toast({ title: "Berhasil", description: `Data test berhasil dibuat: ${data.studentRecordsCreated} siswa, ${data.teacherRecordsCreated} guru` });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal membuat data test", variant: "destructive" });
        } finally {
            setArchiveLoading(false);
        }
    };

    const saveBackupSettings = async () => {
        try {
            setLoadingStates(prev => ({ ...prev, settings: true }));
            await BackupService.saveSettings(backupSettings);
            toast({ title: "Berhasil", description: "Pengaturan backup berhasil disimpan" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error) || "Gagal menyimpan pengaturan backup", variant: "destructive" });
        } finally {
            setLoadingStates(prev => ({ ...prev, settings: false }));
        }
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
                        {pendingSchedules.length > 0 && (
                            <div className="text-xs lg:text-sm text-blue-600 flex items-center">
                                <Clock className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                                <span className="truncate">
                                    {pendingSchedules.length} jadwal backup aktif menunggu waktu
                                </span>
                            </div>
                        )}
                        {completedSchedules.length > 0 && (
                            <div className="text-xs lg:text-sm text-green-600 flex items-center">
                                <CheckCircle className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                                <span className="truncate">
                                    {completedSchedules.length} jadwal backup sudah dijalankan
                                </span>
                            </div>
                        )}
                        {customSchedules.length === 0 && (
                            <div className="text-xs lg:text-sm text-muted-foreground flex items-center">
                                <Calendar className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                                <span className="truncate">Belum ada jadwal backup custom yang dikonfigurasi</span>
                            </div>
                        )}
                        {pendingSchedules.length > 0 && (
                            <div className="text-xs lg:text-sm text-orange-600 flex items-center">
                                <Clock className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                                <span className="truncate">
                                    Jadwal berikutnya: {nextSchedule ? formatDate(`${nextSchedule.date}T${nextSchedule.time}`) : ''}
                                </span>
                            </div>
                        )}
                        {pendingSchedules.length > 0 && (
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
                        <Button onClick={loadBackups} variant="outline" size="sm" disabled={loadingStates.backups} className="flex-1 sm:flex-none" data-testid="backup-refresh-button">
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
                                                max={getTodayDateString()}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tanggal Selesai (Opsional)</Label>
                                            <Input 
                                                type="date" 
                                                value={selectedEndDate} 
                                                onChange={(e) => setSelectedEndDate(e.target.value)}
                                                min={selectedDate}
                                                max={getTodayDateString()}
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
                            {(() => {
                                if (loadingStates.backups) {
                                    return (
                                        <div className="flex items-center justify-center py-8">
                                            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                                            Memuat backup...
                                        </div>
                                    );
                                }

                                if (backups.length === 0) {
                                    return (
                                        <div className="text-center py-8" data-testid="backup-error-alert">
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
                                    );
                                }

                                return (
                                    <div className="overflow-x-auto">
                                        <Table data-testid="backup-table">
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
                                );
                            })()}
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
                                    <span className="sm:hidden">{loadingStates.archive ? '...' : '↻'}</span>
                                </Button>
                                <Button 
                                    onClick={createTestArchiveData} 
                                    variant="outline" 
                                    className="flex-1 sm:flex-none" 
                                    disabled={archiveLoading}
                                >
                                    <Database className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Generate Test Data</span>
                                    <span className="sm:hidden">Test Data</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pengaturan Backup</CardTitle>
                            <CardDescription>
                                Konfigurasi jadwal backup otomatis dan retensi data
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Jadwal Backup Otomatis</Label>
                                    <Select 
                                        value={backupSettings.autoBackupSchedule} 
                                        onValueChange={(value) => setBackupSettings({...backupSettings, autoBackupSchedule: value})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="daily">Harian (Setiap 00:00)</SelectItem>
                                            <SelectItem value="weekly">Mingguan (Setiap Minggu 00:00)</SelectItem>
                                            <SelectItem value="monthly">Bulanan (Tanggal 1 00:00)</SelectItem>
                                            <SelectItem value="disabled">Nonaktif</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Maksimal Backup Disimpan</Label>
                                    <Select 
                                        value={backupSettings.maxBackups.toString()} 
                                        onValueChange={(value) => setBackupSettings({...backupSettings, maxBackups: Number.parseInt(value)})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5 Backup Terakhir</SelectItem>
                                            <SelectItem value="10">10 Backup Terakhir</SelectItem>
                                            <SelectItem value="20">20 Backup Terakhir</SelectItem>
                                            <SelectItem value="50">50 Backup Terakhir</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Umur Arsip (Bulan)</Label>
                                    <Select 
                                        value={backupSettings.archiveAge.toString()} 
                                        onValueChange={(value) => setBackupSettings({...backupSettings, archiveAge: Number.parseInt(value)})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="6">Lebih dari 6 Bulan</SelectItem>
                                            <SelectItem value="12">Lebih dari 1 Tahun</SelectItem>
                                            <SelectItem value="24">Lebih dari 2 Tahun</SelectItem>
                                            <SelectItem value="36">Lebih dari 3 Tahun</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Data yang lebih tua dari ini akan otomatis dipindahkan ke arsip
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Kompresi Backup</Label>
                                    <div className="flex items-center space-x-2 mt-2">
                                        <input 
                                            type="checkbox" 
                                            id="compression" 
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={backupSettings.compression}
                                            onChange={(e) => setBackupSettings({...backupSettings, compression: e.target.checked})}
                                        />
                                        <label htmlFor="compression" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Aktifkan Kompresi (ZIP)
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end mt-4">
                                <Button onClick={saveBackupSettings} disabled={loadingStates.settings}>
                                    {loadingStates.settings ? (
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Settings className="h-4 w-4 mr-2" />
                                    )}
                                    Simpan Pengaturan
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Custom Schedule Section */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Jadwal Backup Custom</CardTitle>
                                <CardDescription>
                                    Atur jadwal backup spesifik untuk kebutuhan khusus
                                </CardDescription>
                            </div>
                            <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                                <DialogTrigger asChild>
                                    <Button size="sm" variant="outline">
                                        <Calendar className="h-4 w-4 mr-2" />
                                        Tambah Jadwal
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Tambah Jadwal Backup</DialogTitle>
                                        <DialogDescription>
                                            Buat jadwal backup otomatis untuk waktu tertentu
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Nama Jadwal</Label>
                                            <Input 
                                                placeholder="Contoh: Backup Sebelum Ujian" 
                                                value={newSchedule.name}
                                                onChange={(e) => setNewSchedule({...newSchedule, name: e.target.value})}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Tanggal</Label>
                                                <Input 
                                                    type="date" 
                                                    value={newSchedule.date}
                                                    onChange={(e) => setNewSchedule({...newSchedule, date: e.target.value})}
                                                    min={getTodayDateString()}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Waktu</Label>
                                                <Input 
                                                    type="time" 
                                                    value={newSchedule.time}
                                                    onChange={(e) => setNewSchedule({...newSchedule, time: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                        <Button onClick={createCustomSchedule} className="w-full">
                                            Simpan Jadwal
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            {loadingStates.schedules ? (
                                <div className="flex justify-center py-4">
                                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : customSchedules.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground">
                                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                    <p>Belum ada jadwal custom</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {customSchedules.map((schedule) => (
                                        <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                                            <div className="space-y-1">
                                                 <div className="flex items-center gap-2">
                                                    <h4 className="font-medium">{schedule.name}</h4>
                                                    <Badge variant={getScheduleBadgeVariant(schedule)}>
                                                        {getScheduleBadgeText(schedule)}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center text-sm text-muted-foreground gap-4">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {formatDate(schedule.date)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {schedule.time}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!schedule.lastRun && (
                                                    <>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            onClick={() => toggleCustomSchedule(schedule.id, !schedule.enabled)}
                                                            title={schedule.enabled ? "Nonaktifkan" : "Aktifkan"}
                                                        >
                                                            {schedule.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            onClick={() => runCustomSchedule(schedule.id)}
                                                            title="Jalankan Sekarang"
                                                        >
                                                            <Zap className="h-4 w-4 text-yellow-500" />
                                                        </Button>
                                                    </>
                                                )}
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => deleteCustomSchedule(schedule.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default BackupManagementView;
