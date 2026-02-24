/**
 * BACKUP MANAGEMENT VIEW
 * UI Component for managing backup and archive operations
 * Phase 2: Backup & Archive System — Modernized with DataTable
 */

import React, { useState, useEffect, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getCurrentYearWIB, formatDateOnly } from '@/lib/time-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
    Calendar,
    Download,
    Archive,
    Trash2,
    RefreshCw,
    CheckCircle,
    Clock,
    Database,
    FileSpreadsheet,
    Settings,
    Play,
    Pause,
    RotateCcw,
    Info,
    Zap,
    MoreHorizontal,
    Shield,
    TrendingUp,
    HardDrive,
} from 'lucide-react';
import { getErrorMessage } from '@/utils/apiClient';
import { useToast } from '@/hooks/use-toast';
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

    // ─── Backup table column definitions ─────────────────────────────────────
    const backupColumns: ColumnDef<BackupInfo>[] = [
        {
            accessorKey: 'filename',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nama File" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 flex-shrink-0">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                    </div>
                    <span className="truncate font-medium text-sm">{row.original.filename}</span>
                </div>
            ),
        },
        {
            accessorKey: 'created',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Dibuat" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{formatDate(row.original.created)}</span>
                </div>
            ),
        },
        {
            accessorKey: 'size',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Ukuran" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 text-sm">
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono">{formatFileSize(row.original.size)}</span>
                </div>
            ),
        },
        {
            accessorKey: 'backupType',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipe" />
            ),
            cell: ({ row }) => {
                const type = row.original.backupType;
                return (
                    <Badge
                        variant={type === 'semester' ? 'default' : 'secondary'}
                        className="text-xs font-medium"
                    >
                        {type === 'semester' ? 'Semester' : 'Tanggal'}
                    </Badge>
                );
            },
        },
        {
            id: 'info',
            header: 'Info',
            cell: ({ row }) => {
                const backup = row.original;
                return backup.backupType === 'semester' ? (
                    <Badge variant="outline" className="text-xs">
                        {backup.semester} {backup.year}
                    </Badge>
                ) : (
                    <Badge variant="outline" className="text-xs">
                        Date Range
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
                <Badge variant="secondary" className="text-xs capitalize">
                    {row.original.status || 'Siap'}
                </Badge>
            ),
        },
        {
            id: 'actions',
            header: 'Aksi',
            cell: ({ row }) => {
                const backup = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Buka menu aksi</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                                onClick={() => downloadBackup(backup.id)}
                                className="gap-2 text-xs cursor-pointer"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => restoreBackup(backup.id)}
                                className="gap-2 text-xs cursor-pointer"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restore
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => deleteBackup(backup.id)}
                                className="gap-2 text-xs cursor-pointer text-destructive focus:text-destructive"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Hapus
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    // Mobile card renderer for backup list
    const renderMobileBackupRow = (backup: BackupInfo) => (
        <div key={backup.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 flex-shrink-0">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{backup.filename}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(backup.size)}</p>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                            onClick={() => downloadBackup(backup.id)}
                            className="gap-2 text-xs cursor-pointer"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => restoreBackup(backup.id)}
                            className="gap-2 text-xs cursor-pointer"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => deleteBackup(backup.id)}
                            className="gap-2 text-xs cursor-pointer text-destructive focus:text-destructive"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={backup.backupType === 'semester' ? 'default' : 'secondary'} className="text-xs">
                    {backup.backupType === 'semester' ? 'Semester' : 'Tanggal'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                    {backup.backupType === 'semester' ? `${backup.semester} ${backup.year}` : 'Date Range'}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize">
                    {backup.status || 'Siap'}
                </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDate(backup.created)}</span>
            </div>
        </div>
    );

    const renderSchedulesContent = () => {
        if (loadingStates.schedules) {
            return (
                <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            );
        }

        if (customSchedules.length === 0) {
            return (
                <div className="text-center py-10 text-muted-foreground">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto mb-3">
                        <Calendar className="h-6 w-6 opacity-60" />
                    </div>
                    <p className="text-sm font-medium">Belum ada jadwal custom</p>
                    <p className="text-xs mt-1">Tambah jadwal untuk mengotomatiskan backup</p>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {customSchedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-xl bg-card hover:bg-accent/5 transition-colors gap-3">
                        <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-sm">{schedule.name}</h4>
                                <Badge variant={getScheduleBadgeVariant(schedule)} className="text-xs">
                                    {getScheduleBadgeText(schedule)}
                                </Badge>
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground gap-4">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDateOnly(schedule.date)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {schedule.time}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {!schedule.lastRun && (
                                <>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => toggleCustomSchedule(schedule.id, !schedule.enabled)}
                                        title={schedule.enabled ? "Nonaktifkan" : "Aktifkan"}
                                        className="h-8 w-8 p-0"
                                    >
                                        {schedule.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => runCustomSchedule(schedule.id)}
                                        title="Jalankan Sekarang"
                                        className="h-8 w-8 p-0"
                                    >
                                        <Zap className="h-4 w-4 text-yellow-500" />
                                    </Button>
                                </>
                            )}
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                onClick={() => deleteCustomSchedule(schedule.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const schedulesContent = renderSchedulesContent();

    return (
        <div className="space-y-6">
            {/* ─── Header ────────────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                            <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Backup &amp; Archive</h2>
                            <p className="text-xs text-muted-foreground">Sistem manajemen backup &amp; arsip database</p>
                        </div>
                    </div>

                    {/* Status badges */}
                    <div className="mt-3 flex flex-wrap gap-2">
                        {pendingSchedules.length > 0 && (
                            <div className="flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 px-3 py-1 text-xs text-blue-700 dark:text-blue-300">
                                <Clock className="w-3 h-3" />
                                {pendingSchedules.length} jadwal aktif
                            </div>
                        )}
                        {completedSchedules.length > 0 && (
                            <div className="flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-950/40 px-3 py-1 text-xs text-green-700 dark:text-green-300">
                                <CheckCircle className="w-3 h-3" />
                                {completedSchedules.length} jadwal selesai
                            </div>
                        )}
                        {pendingSchedules.length > 0 && nextSchedule && (
                            <div className="flex items-center gap-1.5 rounded-full bg-orange-50 dark:bg-orange-950/40 px-3 py-1 text-xs text-orange-700 dark:text-orange-300">
                                <TrendingUp className="w-3 h-3" />
                                Berikutnya: {formatDateOnly(nextSchedule.date)} {nextSchedule.time}
                            </div>
                        )}
                        {customSchedules.length === 0 && (
                            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                Belum ada jadwal custom
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
                    <Button
                        onClick={loadBackups}
                        variant="outline"
                        size="sm"
                        disabled={loadingStates.backups}
                        data-testid="backup-refresh-button"
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${loadingStates.backups ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{loadingStates.backups ? 'Memuat...' : 'Refresh'}</span>
                    </Button>

                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Database className="h-4 w-4" />
                                <span className="hidden sm:inline">Buat Backup</span>
                                <span className="sm:hidden">Backup</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md mx-4 sm:mx-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Database className="h-5 w-5 text-primary" />
                                    Buat Backup
                                </DialogTitle>
                                <DialogDescription>
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
                                    className="w-full gap-2"
                                    disabled={
                                        (backupType === 'semester' && !selectedSemester) ||
                                        (backupType === 'date' && !selectedDate)
                                    }
                                >
                                    <Database className="h-4 w-4" />
                                    Buat Backup
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* ─── Backup Progress ───────────────────────────────────────────── */}
            {backupProgress.isRunning && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                <Clock className="h-4 w-4 text-primary animate-pulse" />
                            </div>
                            Backup Sedang Berjalan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{backupProgress.currentStep}</span>
                                    <span className="font-mono font-medium">{Math.round(backupProgress.progress)}%</span>
                                </div>
                                <Progress value={backupProgress.progress} className="h-2" />
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                Estimasi waktu: {backupProgress.estimatedTime}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Tabs ──────────────────────────────────────────────────────── */}
            <Tabs defaultValue="backups" className="space-y-4">
                <TabsList className="h-10 p-1 bg-muted/60">
                    <TabsTrigger value="backups" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Database className="h-3.5 w-3.5" />
                        <span>Backups</span>
                        {backups.length > 0 && (
                            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                                {backups.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="archive" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Settings className="h-3.5 w-3.5" />
                        Pengaturan
                    </TabsTrigger>
                </TabsList>

                {/* ── Backups Tab ── */}
                <TabsContent value="backups" className="space-y-4">
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="border-b pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Backup Tersedia</CardTitle>
                                    <CardDescription className="mt-0.5">
                                        Kelola backup database dan titik pemulihan
                                    </CardDescription>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                    <Database className="h-5 w-5 text-primary" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <DataTable
                                columns={backupColumns}
                                data={backups}
                                isLoading={loadingStates.backups}
                                searchColumn="filename"
                                searchPlaceholder="Cari nama file backup..."
                                emptyIcon={<Database className="h-10 w-10 text-muted-foreground/40" />}
                                emptyTitle="Belum ada backup"
                                emptyDescription="Buat backup pertama untuk melindungi data Anda"
                                emptyAction={
                                    <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                                        <Database className="h-4 w-4" />
                                        Buat Backup Pertama
                                    </Button>
                                }
                                renderMobileRow={renderMobileBackupRow}
                                pageSizeOptions={[10, 15, 20, 30]}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Archive Tab ── */}
                <TabsContent value="archive" className="space-y-4">
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="border-b pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Archive Management</CardTitle>
                                    <CardDescription className="mt-0.5">
                                        Kelola data arsip dan pembersihan record lama
                                    </CardDescription>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                                    <Archive className="h-5 w-5 text-amber-600" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-4">
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
                                        <strong>Info:</strong> Tidak ada data yang perlu diarsipkan saat ini.{' '}
                                        Data akan diarsipkan secara otomatis ketika berusia lebih dari {backupSettings.archiveAge} bulan.
                                        <br />
                                        <span className="text-sm text-muted-foreground">
                                            Data saat ini masih baru dan belum memenuhi kriteria arsip.
                                        </span>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Archive Stats Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Card className="border bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/10 border-blue-200/50 dark:border-blue-800/30">
                                    <CardContent className="p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">Arsip Siswa</p>
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                                                <Archive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            </div>
                                        </div>
                                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                                            {archiveStats.studentRecords.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                                            {archiveStats.studentRecords === 0
                                                ? 'Belum ada data yang diarsipkan'
                                                : 'Record siswa yang diarsipkan'}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="border bg-gradient-to-br from-green-50 to-green-50/50 dark:from-green-950/30 dark:to-green-950/10 border-green-200/50 dark:border-green-800/30">
                                    <CardContent className="p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wider">Arsip Guru</p>
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
                                                <Archive className="h-4 w-4 text-green-600 dark:text-green-400" />
                                            </div>
                                        </div>
                                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                            {archiveStats.teacherRecords.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                                            {archiveStats.teacherRecords === 0
                                                ? 'Belum ada data yang diarsipkan'
                                                : 'Record guru yang diarsipkan'}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {archiveStats.totalSize > 0 && (
                                <Card className="border">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <HardDrive className="h-4 w-4 text-muted-foreground" />
                                            Informasi Arsip
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Total Ukuran Arsip</p>
                                                <p className="text-base font-semibold font-mono">{formatFileSize(archiveStats.totalSize)}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Arsip Terakhir</p>
                                                <p className="text-base font-semibold">
                                                    {archiveStats.lastArchive ? formatDate(archiveStats.lastArchive) : 'Belum ada'}
                                                </p>
                                            </div>
                                            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                                                <p className="text-xs text-muted-foreground">Kriteria Arsip</p>
                                                <p className="text-base font-semibold">{backupSettings.archiveAge} bulan</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Archive Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                    onClick={archiveOldData}
                                    disabled={archiveLoading}
                                    variant="outline"
                                    className="flex-1 sm:flex-none sm:min-w-[200px] gap-2"
                                >
                                    {archiveLoading ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Archive className="h-4 w-4" />
                                    )}
                                    <span className="hidden sm:inline">Arsipkan Data Lama ({backupSettings.archiveAge} bulan)</span>
                                    <span className="sm:hidden">Arsipkan Data Lama</span>
                                </Button>
                                <Button
                                    onClick={loadArchiveStats}
                                    variant="outline"
                                    className="flex-1 sm:flex-none sm:min-w-[150px] gap-2"
                                    disabled={loadingStates.archive}
                                >
                                    <RefreshCw className={`h-4 w-4 ${loadingStates.archive ? 'animate-spin' : ''}`} />
                                    <span className="hidden sm:inline">{loadingStates.archive ? 'Memuat...' : 'Refresh Stats'}</span>
                                    <span className="sm:hidden">{loadingStates.archive ? '...' : 'Refresh'}</span>
                                </Button>
                                <Button
                                    onClick={createTestArchiveData}
                                    variant="outline"
                                    className="flex-1 sm:flex-none gap-2"
                                    disabled={archiveLoading}
                                >
                                    <Database className="h-4 w-4" />
                                    <span className="hidden sm:inline">Generate Test Data</span>
                                    <span className="sm:hidden">Test Data</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Settings Tab ── */}
                <TabsContent value="settings" className="space-y-4">
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="border-b pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Pengaturan Backup</CardTitle>
                                    <CardDescription className="mt-0.5">
                                        Konfigurasi jadwal backup otomatis dan retensi data
                                    </CardDescription>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                                    <Settings className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Jadwal Backup Otomatis</Label>
                                    <Select
                                        value={backupSettings.autoBackupSchedule}
                                        onValueChange={(value) => setBackupSettings({ ...backupSettings, autoBackupSchedule: value })}
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
                                        onValueChange={(value) => setBackupSettings({ ...backupSettings, maxBackups: Number.parseInt(value) })}
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
                                        onValueChange={(value) => setBackupSettings({ ...backupSettings, archiveAge: Number.parseInt(value) })}
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
                                            onChange={(e) => setBackupSettings({ ...backupSettings, compression: e.target.checked })}
                                        />
                                        <label htmlFor="compression" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Aktifkan Kompresi (ZIP)
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button onClick={saveBackupSettings} disabled={loadingStates.settings} className="gap-2">
                                    {loadingStates.settings ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Settings className="h-4 w-4" />
                                    )}
                                    Simpan Pengaturan
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Custom Schedule Section */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="border-b pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Jadwal Backup Custom</CardTitle>
                                    <CardDescription className="mt-0.5">
                                        Atur jadwal backup spesifik untuk kebutuhan khusus
                                    </CardDescription>
                                </div>
                                <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" variant="outline" className="gap-2">
                                            <Calendar className="h-4 w-4" />
                                            Tambah Jadwal
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2">
                                                <Calendar className="h-5 w-5 text-primary" />
                                                Tambah Jadwal Backup
                                            </DialogTitle>
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
                                                    onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Tanggal</Label>
                                                    <Input
                                                        type="date"
                                                        value={newSchedule.date}
                                                        onChange={(e) => setNewSchedule({ ...newSchedule, date: e.target.value })}
                                                        min={getTodayDateString()}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Waktu</Label>
                                                    <Input
                                                        type="time"
                                                        value={newSchedule.time}
                                                        onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <Button onClick={createCustomSchedule} className="w-full gap-2">
                                                <Calendar className="h-4 w-4" />
                                                Simpan Jadwal
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {schedulesContent}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default BackupManagementView;
