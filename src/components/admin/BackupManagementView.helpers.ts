import { apiCall } from '@/utils/apiClient';
import { formatDateTime24 } from '@/lib/time-utils';

// =============================================================================
// INTERFACES
// =============================================================================

export interface BackupInfo {
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

export interface BackupProgress {
    isRunning: boolean;
    progress: number;
    currentStep: string;
    estimatedTime: string;
}

export interface ArchiveStats {
    studentRecords: number;
    teacherRecords: number;
    totalSize: number;
    lastArchive: string;
}

export interface BackupSettings {
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

export interface CustomSchedule {
    id: string;
    name: string;
    date: string;
    time: string;
    enabled: boolean;
    created: string;
    lastRun?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const DEFAULT_LOADING_STATES = {
    backups: false,
    archive: false,
    settings: false,
    schedules: false
};

export const DEFAULT_BACKUP_PROGRESS: BackupProgress = {
    isRunning: false,
    progress: 0,
    currentStep: '',
    estimatedTime: ''
};

export const DEFAULT_ARCHIVE_STATS: ArchiveStats = {
    studentRecords: 0,
    teacherRecords: 0,
    totalSize: 0,
    lastArchive: ''
};

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
    autoBackupSchedule: 'weekly',
    maxBackups: 10,
    archiveAge: 24,
    compression: true,
    emailNotifications: false,
    customScheduleDate: '',
    customScheduleTime: '02:00',
    customScheduleEnabled: false
};

export const DEFAULT_NEW_SCHEDULE: Partial<CustomSchedule> = {
    name: '',
    date: '',
    time: '02:00',
    enabled: true
};

// =============================================================================
// PURE HELPER FUNCTIONS
// =============================================================================

/**
 * Get today's date in YYYY-MM-DD format for date input max attribute
 */
export const getTodayDateString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Get progress step description based on percentage
 */
export function getProgressStep(progress: number): string {
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
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date string using standard format
 */
export const formatDate = (dateString: string): string => {
    return formatDateTime24(dateString, true);
};

/**
 * Validate backup parameters based on type
 */
export function validateBackupParams(
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
export function buildBackupConfig(
    backupType: 'semester' | 'date',
    selectedSemester: string,
    selectedYear: number,
    selectedDate: string,
    selectedEndDate: string
): { endpoint: string; payload: object } {
    if (backupType === 'semester') {
        return {
            endpoint: '/api/admin/create-semester-backup',
            payload: { semester: selectedSemester, year: selectedYear }
        };
    }
    return {
        endpoint: '/api/admin/create-date-backup',
        payload: { startDate: selectedDate, endDate: selectedEndDate || selectedDate }
    };
}

/**
 * Calculate progress update values
 */
export function calculateProgressUpdate(currentProgress: number): BackupProgress {
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

// =============================================================================
// API SERVICE FUNCTIONS
// =============================================================================

export const BackupService = {
    async fetchBackups(): Promise<BackupInfo[]> {
        const data = await apiCall<{ backups: BackupInfo[] }>('/api/admin/backups');
        return data.backups || [];
    },

    async fetchArchiveStats(): Promise<ArchiveStats> {
        const data = await apiCall<{ stats: ArchiveStats }>('/api/admin/archive-stats');
        return data.stats || DEFAULT_ARCHIVE_STATS;
    },

    async fetchSettings(): Promise<BackupSettings> {
        const data = await apiCall<{ settings: BackupSettings }>('/api/admin/backup-settings');
        return data.settings || DEFAULT_BACKUP_SETTINGS;
    },

    async saveSettings(settings: BackupSettings): Promise<void> {
        await apiCall('/api/admin/backup-settings', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
    },

    async fetchCustomSchedules(): Promise<CustomSchedule[]> {
        const data = await apiCall<{ schedules: CustomSchedule[] }>('/api/admin/custom-schedules');
        return data.schedules || [];
    },

    async createCustomSchedule(schedule: Partial<CustomSchedule>): Promise<void> {
        await apiCall('/api/admin/custom-schedules', {
            method: 'POST',
            body: JSON.stringify(schedule)
        });
    },

    async deleteCustomSchedule(scheduleId: string): Promise<void> {
        await apiCall(`/api/admin/custom-schedules/${scheduleId}`, {
            method: 'DELETE'
        });
    },

    async toggleCustomSchedule(scheduleId: string, enabled: boolean): Promise<void> {
        await apiCall(`/api/admin/custom-schedules/${scheduleId}`, {
            method: 'PUT',
            body: JSON.stringify({ enabled })
        });
    },

    async runCustomSchedule(scheduleId: string): Promise<void> {
        await apiCall(`/api/admin/run-custom-schedule/${scheduleId}`, {
            method: 'POST'
        });
    },

    async createBackup(endpoint: string, payload: object): Promise<{ backupId?: string }> {
        const result = await apiCall<{ data?: { backupId?: string } }>(
            endpoint,
            {
                method: 'POST',
                body: JSON.stringify(payload)
            }
        );
        return result.data || {};
    },

    async downloadBackup(backupId: string): Promise<void> {
        const blob = await apiCall<Blob>(`/api/admin/download-backup/${backupId}`, {
            responseType: 'blob'
        });
        
        const url = globalThis.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${backupId}.zip`;
        document.body.appendChild(a);
        a.click();
        globalThis.URL.revokeObjectURL(url);
        a.remove();
    },

    async deleteBackup(backupId: string): Promise<string> {
        const data = await apiCall<{ message: string }>(`/api/admin/delete-backup/${backupId}`, {
            method: 'DELETE'
        });
        return data.message;
    },

    async restoreBackup(backupId: string): Promise<void> {
        await apiCall(`/api/admin/restore-backup/${backupId}`, {
            method: 'POST'
        });
    },

    async archiveOldData(monthsOld: number): Promise<void> {
        await apiCall('/api/admin/archive-old-data', {
            method: 'POST',
            body: JSON.stringify({
                monthsOld
            })
        });
    },

    async createTestArchiveData(): Promise<{ studentRecordsCreated: number, teacherRecordsCreated: number }> {
        const data = await apiCall<{ data: { studentRecordsCreated: number, teacherRecordsCreated: number } }>('/api/admin/create-test-archive-data', {
            method: 'POST'
        });
        return data.data;
    }
};
