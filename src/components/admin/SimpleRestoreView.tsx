import React, { useState, useRef, useEffect, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  Upload,
  FileText,
  Database,
  CheckCircle,
  AlertCircle,
  Shield,
  Download,
  RefreshCw,
  Trash2,
  MoreHorizontal,
  CloudUpload,
  HardDrive,
} from 'lucide-react';
import { getApiUrl } from '@/config/api';
import { apiCall } from '@/utils/apiClient';
import { toast } from '@/hooks/use-toast';

// =============================================================================
// VALIDATION HELPERS (extracted to reduce cognitive complexity)
// =============================================================================

const ALLOWED_FILE_TYPES = new Set(['.sql', '.zip']);
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function validateFileType(filename: string): string | null {
  const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (!ALLOWED_FILE_TYPES.has(fileExtension)) {
    return 'File harus berformat .sql atau .zip';
  }
  return null;
}

function validateFileSize(size: number): string | null {
  if (size > MAX_FILE_SIZE) {
    return 'Ukuran file maksimal 100MB';
  }
  return null;
}

function validateFileName(filename: string): string | null {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return 'Nama file tidak boleh mengandung karakter khusus';
  }
  return null;
}

/**
 * Validate uploaded file for restore operation
 */
function validateUploadFile(file: File): string | null {
  return validateFileType(file.name)
    || validateFileSize(file.size)
    || validateFileName(file.name);
}

// =============================================================================
// BACKUP TYPE
// =============================================================================

type BackupItem = {
  id?: string;
  filename?: string;
  name?: string;
  date?: string;
  size?: number;
  type?: string;
  files?: {
    sql?: string[];
    zip?: string[];
  };
};

// =============================================================================
// COMPONENT
// =============================================================================

const SimpleRestoreView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'uploading' | 'restoring' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [availableBackups, setAvailableBackups] = useState<BackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateUploadFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setError('');
    setMessage('');
    setRestoreStatus('idle');
  };

  const loadAvailableBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const result = await apiCall<{ success: boolean; data: BackupItem[] }>('/api/admin/backups');
      if (result.success) {
        setAvailableBackups(result.data);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal memuat backup", description: err instanceof Error ? err.message : "Terjadi kesalahan" });
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setRestoreStatus('uploading');
    setUploadProgress(0);
    setError('');
    setMessage('');

    const formData = new FormData();
    formData.append('backupFile', selectedFile);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            setRestoreStatus('success');
            setMessage(response.message || 'Database berhasil dipulihkan!');
            setUploadProgress(100);
            setSelectedFile(null);
            loadAvailableBackups();
          } catch (e) {
            console.error('Failed to parse restore response:', e instanceof Error ? e.message : String(e));
            setRestoreStatus('error');
            setError('Gagal memproses respon server');
          }
        } else {
          setRestoreStatus('error');
          try {
            const response = JSON.parse(xhr.responseText);
            setError(response.message || 'Gagal memulihkan database');
           } catch (e) {
             console.error('Failed to parse error response:', e instanceof Error ? e.message : String(e));
             setError(`Upload gagal: ${xhr.statusText}`);
           }
        }
        setUploading(false);
      });

      xhr.addEventListener('error', () => {
        setRestoreStatus('error');
        setError('Terjadi kesalahan jaringan');
        setUploading(false);
      });

      xhr.open('POST', getApiUrl('/api/admin/restore-backup'));
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
      xhr.withCredentials = true;
      xhr.send(formData);

    } catch (err) {
      console.error('Upload operation failed:', err instanceof Error ? err.message : String(err));
      setRestoreStatus('error');
      setError('Terjadi kesalahan saat upload');
      setUploading(false);
    }
  };

  const downloadSingleBackup = async (id: string): Promise<void> => {
    try {
      const blob = await apiCall<Blob>(`/api/admin/download-backup/${id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${id}.sql`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Individual download failure is non-critical
    }
  };

  const handleBatchDownload = (ids: string[]) => {
    if (ids.length === 0) return;

    // Warn if too many files
    if (ids.length > 5) {
      const confirmed = globalThis.confirm(`Anda akan mendownload ${ids.length} file sekaligus. Browser mungkin akan memblokir popup. Lanjutkan?`);
      if (!confirmed) return;
    }

    ids.forEach(id => {
      downloadSingleBackup(id);
    });
  };

  const handleBatchDelete = async (ids: string[]) => {
    if (ids.length === 0) return;

    const confirmed = globalThis.confirm(
      `Apakah Anda yakin ingin menghapus ${ids.length} backup yang dipilih? ` +
      'Tindakan ini tidak dapat dibatalkan.'
    );

    if (!confirmed) return;

    setBatchActionLoading(true);
    setMessage('');
    setError('');

    try {
      const result = await apiCall<{ success: boolean; message?: string; error?: string }>('/api/admin/delete-backups/batch', {
        method: 'DELETE',
        body: JSON.stringify({ backupIds: ids })
      });

      if (result.success) {
        setMessage(result.message || 'Backup terpilih berhasil dihapus');
        loadAvailableBackups();
      } else {
        setError(result.error || result.message || 'Gagal menghapus beberapa backup');
        loadAvailableBackups();
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal menghapus backup", description: err instanceof Error ? err.message : "Terjadi kesalahan" });
      setError('Terjadi kesalahan saat menghapus backup');
    } finally {
      setBatchActionLoading(false);
    }
  };

  const restoreFromBackup = async (backupId: string) => {
    const confirmed = globalThis.confirm(
      'Apakah Anda yakin ingin memulihkan backup ini? ' +
      'Semua data yang ada akan diganti dengan data dari backup. ' +
      'Proses ini tidak dapat dibatalkan.'
    );

    if (!confirmed) return;

    setUploading(true);
    setRestoreStatus('restoring');
    setError('');
    setMessage('');

    try {
      const result = await apiCall<{ success: boolean; message?: string; error?: string }>(`/api/admin/restore-backup/${backupId}`, {
        method: 'POST'
      });

      if (result.success) {
        setRestoreStatus('success');
        setMessage(result.message || 'Backup berhasil dipulihkan!');
        loadAvailableBackups();
      } else {
        setRestoreStatus('error');
        setError(result.error || result.message || 'Gagal memulihkan backup');
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal memulihkan backup", description: err instanceof Error ? err.message : "Terjadi kesalahan" });
      setRestoreStatus('error');
      setError('Terjadi kesalahan saat memulihkan backup');
    } finally {
      setUploading(false);
    }
  };

  const deleteSingleBackup = async (id: string) => {
    await handleBatchDelete([id]);
  };

  // Load backups on component mount
  useEffect(() => {
    loadAvailableBackups();
  }, [loadAvailableBackups]);

  // ─── DataTable Columns ────────────────────────────────────────────────────

  const backupColumns: ColumnDef<BackupItem>[] = [
    {
      id: 'name',
      accessorFn: (row) => row.name && row.name !== 'Unknown Backup' ? row.name : (row.filename || 'Unknown Backup'),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nama / File" />
      ),
      cell: ({ row }) => {
        const backup = row.original;
        const displayName = backup.name && backup.name !== 'Unknown Backup'
          ? backup.name
          : (backup.filename || 'Unknown Backup');
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 p-1.5 rounded-md bg-primary/10">
              <HardDrive className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-xs text-foreground truncate max-w-[200px]" title={displayName}>
                {displayName}
              </p>
              <p className="text-[10px] text-muted-foreground/60 truncate max-w-[160px]" title={backup.id}>
                {backup.id}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'date',
      accessorKey: 'date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tanggal" />
      ),
      cell: ({ row }) => {
        const date = row.original.date;
        if (!date) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(date).toLocaleDateString('id-ID', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        );
      },
    },
    {
      id: 'size',
      accessorKey: 'size',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ukuran" />
      ),
      cell: ({ row }) => {
        const size = row.original.size;
        return (
          <span className="text-xs text-muted-foreground">
            {size ? `${(size / 1024 / 1024).toFixed(2)} MB` : '—'}
          </span>
        );
      },
    },
    {
      id: 'type',
      accessorFn: (row) => row.type,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tipe" />
      ),
      cell: ({ row }) => {
        const backup = row.original;
        return (
          <div className="flex flex-wrap gap-1">
            {backup.files?.sql && backup.files.sql.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-600 border-blue-500/20">
                {backup.files.sql.length} SQL
              </Badge>
            )}
            {backup.files?.zip && backup.files.zip.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/20">
                {backup.files.zip.length} ZIP
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4"
            >
              {backup.type === 'scheduled' ? 'Scheduled' : 'Manual'}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            >
              Available
            </Badge>
          </div>
        );
      },
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      header: () => <span className="text-xs font-medium">Aksi</span>,
      cell: ({ row }) => {
        const backup = row.original;
        if (!backup.id) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={uploading || batchActionLoading}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Aksi</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => backup.id && restoreFromBackup(backup.id)}
                disabled={uploading}
                className="text-xs gap-2 cursor-pointer"
              >
                <Database className="h-3.5 w-3.5" />
                Restore
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => backup.id && downloadSingleBackup(backup.id)}
                className="text-xs gap-2 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => backup.id && deleteSingleBackup(backup.id)}
                disabled={batchActionLoading}
                className="text-xs gap-2 cursor-pointer text-destructive focus:text-destructive"
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

  const renderMobileRow = (backup: BackupItem, index: number) => {
    const displayName = backup.name && backup.name !== 'Unknown Backup'
      ? backup.name
      : (backup.filename || 'Unknown Backup');
    return (
      <div key={backup.id || index} className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex-shrink-0 p-1.5 rounded-md bg-primary/10">
              <HardDrive className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{displayName}</p>
              {backup.date && (
                <p className="text-xs text-muted-foreground">
                  {new Date(backup.date).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
          {backup.id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  disabled={uploading || batchActionLoading}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => backup.id && restoreFromBackup(backup.id)}
                  disabled={uploading}
                  className="text-xs gap-2 cursor-pointer"
                >
                  <Database className="h-3.5 w-3.5" />
                  Restore
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => backup.id && downloadSingleBackup(backup.id)}
                  className="text-xs gap-2 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => backup.id && deleteSingleBackup(backup.id)}
                  disabled={batchActionLoading}
                  className="text-xs gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {backup.size ? `${(backup.size / 1024 / 1024).toFixed(2)} MB` : '—'}
          </span>
          {backup.files?.sql && backup.files.sql.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-600 border-blue-500/20">
              {backup.files.sql.length} SQL
            </Badge>
          )}
          {backup.files?.zip && backup.files.zip.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/20">
              {backup.files.zip.length} ZIP
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {backup.type === 'scheduled' ? 'Scheduled' : 'Manual'}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            Available
          </Badge>
        </div>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Shield className="h-6 w-6 text-primary" />
            Restore Database
          </h1>
          <p className="text-muted-foreground mt-1">
            Pulihkan database dari file backup atau upload file manual.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* ── Upload Card ── */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-4 border-b bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-base">
              <CloudUpload className="w-5 h-5 text-primary" />
              Upload &amp; Restore
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-5">
              {/* Drag-and-drop zone */}
              <div
                className={[
                  'relative rounded-xl border-2 border-dashed transition-all duration-200',
                  isDragOver
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : selectedFile
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/60 hover:bg-muted/40',
                ].join(' ')}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".sql,.zip"
                  className="hidden"
                  disabled={uploading}
                />

                {selectedFile ? (
                  <div className="flex flex-col items-center gap-3 py-8 px-6">
                    <div className="p-3 rounded-full bg-primary/10">
                      <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-foreground">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                      disabled={uploading}
                    >
                      Batal pilihan
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex w-full flex-col items-center gap-3 py-10 px-6 cursor-pointer bg-transparent"
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (restoreStatus === 'restoring' || uploading) return;
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        const validationError = validateUploadFile(file);
                        if (validationError) {
                          setError(validationError);
                          return;
                        }
                        setSelectedFile(file);
                        setError('');
                      }
                    }}
                    onClick={() => {
                      if (restoreStatus !== 'restoring' && !uploading) {
                        fileInputRef.current?.click();
                      }
                    }}
                    disabled={uploading || restoreStatus === 'restoring'}
                    aria-label="Klik untuk upload file backup"
                  >
                    <div className={[
                      'p-4 rounded-full transition-colors duration-200',
                      isDragOver ? 'bg-primary/20' : 'bg-muted',
                    ].join(' ')}>
                      <Upload className={[
                        'w-8 h-8 transition-colors duration-200',
                        isDragOver ? 'text-primary' : 'text-muted-foreground/50',
                      ].join(' ')} />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-semibold text-foreground">
                        {isDragOver ? 'Lepaskan file di sini' : 'Klik atau drag & drop file backup'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Format yang didukung: <span className="font-medium">.sql</span> dan <span className="font-medium">.zip</span>
                      </p>
                      <p className="text-xs text-muted-foreground/60">Maksimal 100 MB</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {uploading && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary border-t-transparent" />
                      <span>
                        {restoreStatus === 'uploading' ? 'Mengupload file...' : 'Memulihkan database...'}
                      </span>
                    </div>
                    <span className="font-medium tabular-nums text-primary">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="w-full sm:w-auto gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span className="truncate">
                        {{
                          uploading: 'Mengupload...',
                          restoring: 'Memproses...',
                        }[restoreStatus] || 'Memulihkan...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      <span className="truncate">Restore Database</span>
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => {
                    setSelectedFile(null);
                    setError('');
                    setMessage('');
                    setRestoreStatus('idle');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  variant="outline"
                  disabled={uploading}
                  className="w-full sm:w-auto"
                >
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Status Messages ── */}
        {error && (
          <Alert variant="destructive" className="border-destructive/50">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-semibold">Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {message && (
          <Alert className="border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <AlertTitle className="text-emerald-800 dark:text-emerald-300 font-semibold">Berhasil</AlertTitle>
            <AlertDescription className="text-emerald-700 dark:text-emerald-400">{message}</AlertDescription>
          </Alert>
        )}

        {/* ── Floating Status Toast ── */}
        {restoreStatus === 'success' && (
          <div className="fixed top-2 right-2 sm:top-4 sm:right-4 bg-emerald-500 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/30 z-50 max-w-xs sm:max-w-none">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="text-sm sm:text-base font-medium">Restore berhasil!</span>
            </div>
          </div>
        )}

        {restoreStatus === 'error' && (
          <div className="fixed top-2 right-2 sm:top-4 sm:right-4 bg-red-500 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-red-500/30 z-50 max-w-xs sm:max-w-none">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="text-sm sm:text-base font-medium">Restore gagal!</span>
            </div>
          </div>
        )}

        {/* ── Available Backups Card ── */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-4 border-b bg-muted/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="w-5 h-5 text-primary" />
                Backup yang Tersedia
                {availableBackups.length > 0 && (
                  <Badge variant="secondary" className="text-xs font-normal ml-1">
                    {availableBackups.length}
                  </Badge>
                )}
              </CardTitle>
              <Button
                onClick={loadAvailableBackups}
                disabled={loadingBackups || batchActionLoading}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <DataTable
              columns={backupColumns}
              data={availableBackups}
              isLoading={loadingBackups}
              searchColumn="name"
              searchPlaceholder="Cari backup..."
              emptyIcon={<Database className="w-12 h-12 text-muted-foreground/30" />}
              emptyTitle="Tidak Ada Backup"
              emptyDescription="Buat backup terlebih dahulu di menu Backup & Archive"
              renderMobileRow={renderMobileRow}
              pageSizeOptions={[10, 20, 30]}
              toolbarContent={
                availableBackups.length > 0 ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-9 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800"
                      onClick={() => handleBatchDownload(availableBackups.map(b => b.id).filter((id): id is string => !!id))}
                      disabled={batchActionLoading || availableBackups.length === 0}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Semua
                    </Button>
                  </div>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SimpleRestoreView;
