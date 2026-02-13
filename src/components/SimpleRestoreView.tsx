import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Progress } from './ui/progress';
import { 
  Upload, 
  FileText, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft,
  Shield,
  Download,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { getApiUrl } from '@/config/api';
import { apiCall } from '@/utils/apiClient';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from './ui/checkbox';

interface SimpleRestoreViewProps {
  onBack: () => void;
  onLogout: () => void;
}

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

const SimpleRestoreView: React.FC<SimpleRestoreViewProps> = ({ onBack }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'uploading' | 'restoring' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [availableBackups, setAvailableBackups] = useState<Array<{
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
  }>>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [selectedBackups, setSelectedBackups] = useState<Set<string>>(new Set());
  const [batchActionLoading, setBatchActionLoading] = useState(false);
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
      const result = await apiCall<{ success: boolean; data: typeof availableBackups }>('/api/admin/backups');
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
            setRestoreStatus('error');
            setError('Gagal memproses respon server');
          }
        } else {
          setRestoreStatus('error');
          try {
            const response = JSON.parse(xhr.responseText);
            setError(response.message || 'Gagal memulihkan database');
          } catch (e) {
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
      setRestoreStatus('error');
      setError('Terjadi kesalahan saat upload');
      setUploading(false);
    }
  };

  const toggleSelectId = (id: string) => {
    const newSelected = new Set(selectedBackups);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedBackups(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedBackups.size === availableBackups.length) {
      setSelectedBackups(new Set());
    } else {
      const allIds = availableBackups.map(b => b.id).filter((id): id is string => !!id);
      setSelectedBackups(new Set(allIds));
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

  const handleBatchDownload = () => {
    if (selectedBackups.size === 0) return;
    
    // Warn if too many files
    if (selectedBackups.size > 5) {
      const confirmed = globalThis.confirm(`Anda akan mendownload ${selectedBackups.size} file sekaligus. Browser mungkin akan memblokir popup. Lanjutkan?`);
      if (!confirmed) return;
    }

    selectedBackups.forEach(id => {
      downloadSingleBackup(id);
    });
  };

  const handleBatchDelete = async () => {
    if (selectedBackups.size === 0) return;

    const confirmed = globalThis.confirm(
      `Apakah Anda yakin ingin menghapus ${selectedBackups.size} backup yang dipilih? ` +
      'Tindakan ini tidak dapat dibatalkan.'
    );

    if (!confirmed) return;

    setBatchActionLoading(true);
    setMessage('');
    setError('');

    try {
      const result = await apiCall<{ success: boolean; message?: string; error?: string }>('/api/admin/delete-backups/batch', {
        method: 'DELETE',
        body: JSON.stringify({ backupIds: Array.from(selectedBackups) })
      });

      if (result.success) {
        setMessage(result.message || 'Backup terpilih berhasil dihapus');
        setSelectedBackups(new Set());
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

  // Load backups on component mount
  useEffect(() => {
    loadAvailableBackups();
  }, [loadAvailableBackups]);

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button variant="ghost" className="mb-2 pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Dashboard
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Shield className="h-6 w-6 text-primary" />
            Restore Database
          </h1>
          <p className="text-muted-foreground">
            Pulihkan database dari file backup atau upload file manual.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Upload Card - Mobile Responsive */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload & Restore
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div 
                role="button"
                tabIndex={0}
                aria-label="Area upload file backup. Klik atau drag & drop file .sql / .zip"
                className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors ${
                  selectedFile 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (restoreStatus !== 'restoring' && !uploading) {
                      fileInputRef.current?.click();
                    }
                  }
                }}
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
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
                    <p className="font-medium text-lg text-foreground">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={uploading}
                    >
                      Batal
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 cursor-pointer">
                    <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/50" />
                    <p className="font-medium sm:text-lg text-foreground">Klik untuk upload file backup</p>
                    <p className="text-sm text-muted-foreground">atau drag & drop file .sql / .zip disini</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {uploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{restoreStatus === 'uploading' ? 'Mengupload...' : 'Memulihkan database...'}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="w-full sm:w-auto"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      <span className="truncate">
                        {{
                          uploading: 'Mengupload...',
                          restoring: 'Memproses...'
                        }[restoreStatus] || 'Memulihkan...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
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

        {/* Status Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {message && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Berhasil</AlertTitle>
            <AlertDescription className="text-green-700">{message}</AlertDescription>
          </Alert>
        )}

        {/* Status Indicator - Mobile Responsive */}
        {restoreStatus === 'success' && (
          <div className="fixed top-2 right-2 sm:top-4 sm:right-4 bg-green-500 text-white px-3 py-2 sm:px-4 rounded-lg shadow-lg z-50 max-w-xs sm:max-w-none">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="text-sm sm:text-base">Restore berhasil!</span>
            </div>
          </div>
        )}

        {restoreStatus === 'error' && (
          <div className="fixed top-2 right-2 sm:top-4 sm:right-4 bg-red-500 text-white px-3 py-2 sm:px-4 rounded-lg shadow-lg z-50 max-w-xs sm:max-w-none">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="text-sm sm:text-base">Restore gagal!</span>
            </div>
          </div>
        )}

        {/* Available Backups - Mobile Responsive */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Backup yang Tersedia
                </CardTitle>
                <div className="flex gap-2 w-full sm:w-auto">
                   {selectedBackups.size > 0 && (
                      <>
                        <Button
                          onClick={handleBatchDelete}
                          disabled={batchActionLoading}
                          variant="destructive"
                          size="sm"
                          className="flex-1 sm:flex-none"
                        >
                           {batchActionLoading ? (
                             <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                           ) : (
                             <Trash2 className="w-4 h-4 mr-2" />
                           )}
                           Hapus ({selectedBackups.size})
                        </Button>
                        <Button
                          onClick={handleBatchDownload}
                          disabled={batchActionLoading}
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                        >
                           <Download className="w-4 h-4 mr-2" />
                           Download ({selectedBackups.size})
                        </Button>
                      </>
                   )}
                  <Button
                    onClick={loadAvailableBackups}
                    disabled={loadingBackups || batchActionLoading}
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${loadingBackups ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
              
              {/* Batch Selection Header */}
              {availableBackups.length > 0 && (
                 <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded border text-sm text-slate-600">
                    <Checkbox 
                       checked={selectedBackups.size === availableBackups.length && availableBackups.length > 0}
                       onCheckedChange={toggleSelectAll}
                       id="select-all"
                    />
                    <label htmlFor="select-all" className="cursor-pointer select-none font-medium">
                       Pilih Semua ({availableBackups.length} file)
                    </label>
                 </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingBackups ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Memuat daftar backup...</p>
              </div>
            ) : availableBackups.length > 0 ? (
              <div className="space-y-3">
                {availableBackups.map((backup) => (
                  <div key={backup?.id || Math.random()} className={`border rounded-lg p-3 sm:p-4 transition-colors ${
                    selectedBackups.has(backup.id!) 
                      ? 'bg-accent/50 border-primary/50' 
                      : 'bg-card hover:bg-muted/50 border-border'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className="pt-1">
                         <Checkbox 
                            checked={selectedBackups.has(backup.id!)}
                            onCheckedChange={() => toggleSelectId(backup.id!)}
                            id={`backup-${backup.id}`}
                         />
                      </div>
                      <div className="flex-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          <label htmlFor={`backup-${backup.id}`} className="cursor-pointer">
                             <h4 className="font-medium text-foreground break-words">{backup.name && backup.name !== 'Unknown Backup' ? backup.name : (backup.filename || 'Unknown Backup')}</h4>
                             <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                               {backup.date ? new Date(backup.date).toLocaleDateString('id-ID', {
                                 year: 'numeric',
                                 month: 'long',
                                 day: 'numeric',
                                 hour: '2-digit',
                                 minute: '2-digit'
                               }) : 'Unknown Date'}
                             </p>
                             <p className="text-xs text-muted-foreground">
                               Ukuran: {backup.size ? (backup.size / 1024 / 1024).toFixed(2) : '0'} MB
                             </p>
                             <div className="hidden sm:block text-xs text-muted-foreground/60 mt-1 truncate max-w-xs">
                               ID: {backup.id}
                             </div>
                          </label>
                          <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
                          {backup.files?.sql?.length > 0 && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {backup.files.sql.length} SQL
                            </span>
                          )}

                          {backup.files?.zip?.length > 0 && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {backup.files.zip.length} ZIP
                            </span>
                          )}
                          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded border border-border">
                            {backup?.type === 'scheduled' ? 'Scheduled' : 'Manual'}
                          </span>
                          <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">
                            Available
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          onClick={() => backup?.id && restoreFromBackup(backup.id)}
                          disabled={uploading || !backup?.id}
                          size="sm"
                          variant="secondary"
                          className="w-full sm:w-auto"
                        >
                          {uploading && restoreStatus === 'restoring' ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-1" />
                              <span className="truncate">Restoring...</span>
                            </>
                          ) : (
                            <>
                              <Database className="w-4 h-4 mr-1" />
                              <span className="truncate">Restore</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-2 text-muted-foreground/30" />
                <p>Tidak ada backup yang tersedia</p>
                <p className="text-sm">Buat backup terlebih dahulu di menu Backup & Archive</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SimpleRestoreView;
