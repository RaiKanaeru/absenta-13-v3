import React, { useState, useRef } from 'react';
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
  RefreshCw
} from 'lucide-react';
import { getApiUrl } from '@/config/api';

interface SimpleRestoreViewProps {
  onBack: () => void;
  onLogout: () => void;
}

// =============================================================================
// VALIDATION HELPERS (extracted to reduce cognitive complexity)
// =============================================================================

const ALLOWED_FILE_TYPES = ['.sql', '.zip'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function validateFileType(filename: string): string | null {
  const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
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

const SimpleRestoreView: React.FC<SimpleRestoreViewProps> = ({ onBack, onLogout }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'uploading' | 'restoring' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [availableBackups, setAvailableBackups] = useState<Array<{
    id?: string;
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

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Pilih file terlebih dahulu');
      return;
    }

    setUploading(true);
    setRestoreStatus('uploading');
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('backupFile', selectedFile);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);

      const response = await fetch(getApiUrl('/api/admin/restore-backup'), {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (response.ok && result.success) {
        setRestoreStatus('success');
        setMessage(result.message || 'Restorasi database berhasil! Data telah dipulihkan.');
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setRestoreStatus('error');
        setError(result.error || result.message || 'Gagal melakukan restorasi database');
      }
    } catch (err) {
      console.error('Error during restore:', err);
      setRestoreStatus('error');
      setError('Terjadi kesalahan saat melakukan restorasi');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownloadTemplate = () => {
    // Create a comprehensive SQL template file
    const templateContent = `-- Template SQL untuk Backup Database Absenta
-- File ini adalah contoh struktur backup database
-- Ganti dengan file backup yang sebenarnya

-- Contoh struktur tabel utama
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'guru', 'siswa') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kelas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_kelas VARCHAR(50) NOT NULL,
    tingkat VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mapel (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kode_mapel VARCHAR(20) NOT NULL UNIQUE,
    nama_mapel VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guru (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_guru VARCHAR(100) NOT NULL,
    nip VARCHAR(20) UNIQUE,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS siswa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_siswa VARCHAR(100) NOT NULL,
    nis VARCHAR(20) UNIQUE,
    kelas_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kelas_id) REFERENCES kelas(id)
);

CREATE TABLE IF NOT EXISTS jadwal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kelas_id INT NOT NULL,
    mapel_id INT NOT NULL,
    guru_id INT NOT NULL,
    hari VARCHAR(10) NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    ruang_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kelas_id) REFERENCES kelas(id),
    FOREIGN KEY (mapel_id) REFERENCES mapel(id),
    FOREIGN KEY (guru_id) REFERENCES guru(id),
    FOREIGN KEY (ruang_id) REFERENCES ruang(id)
);

CREATE TABLE IF NOT EXISTS ruang (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kode_ruang VARCHAR(20) NOT NULL UNIQUE,
    nama_ruang VARCHAR(100) NOT NULL,
    kapasitas INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS presensi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    siswa_id INT NOT NULL,
    jadwal_id INT NOT NULL,
    tanggal DATE NOT NULL,
    status ENUM('hadir', 'tidak_hadir', 'izin', 'sakit') NOT NULL,
    keterangan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (siswa_id) REFERENCES siswa(id),
    FOREIGN KEY (jadwal_id) REFERENCES jadwal(id)
);

-- Untuk backup lengkap, gunakan perintah:
-- mysqldump -u username -p database_name > backup.sql
-- atau
-- mysqldump -u username -p --all-databases > full_backup.sql
`;

    const blob = new Blob([templateContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup_template.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setError('');
    setMessage('');
    setRestoreStatus('idle');
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadAvailableBackups = async () => {
    setLoadingBackups(true);
    try {
      const response = await fetch(getApiUrl('/api/admin/backups'), {
        credentials: 'include'
      });
      const result = await response.json();
      
      // Support both new (ok/backups) and old (success/data) formats
      if ((result.ok || result.success) && (Array.isArray(result.backups) || Array.isArray(result.data))) {
        setAvailableBackups(result.backups || result.data);
      } else {
        setAvailableBackups([]);
      }
    } catch (error) {
      console.error('Error loading backups:', error);
      setAvailableBackups([]);
    } finally {
      setLoadingBackups(false);
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
      const response = await fetch(getApiUrl(`/api/admin/restore-backup/${backupId}`), {
        method: 'POST',
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setRestoreStatus('success');
        setMessage(result.message || 'Backup berhasil dipulihkan!');
        // Reload backups after successful restore
        loadAvailableBackups();
      } else {
        setRestoreStatus('error');
        setError(result.error || result.message || 'Gagal memulihkan backup');
      }
    } catch (err) {
      console.error('Error restoring backup:', err);
      setRestoreStatus('error');
      setError('Terjadi kesalahan saat memulihkan backup');
    } finally {
      setUploading(false);
    }
  };

  // Load backups on component mount
  React.useEffect(() => {
    loadAvailableBackups();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 sm:p-6">
      {/* Header - Mobile Responsive */}
      <div className="mb-6 sm:mb-8">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
            <Shield className="w-6 h-6 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Restorasi Backup Database</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Upload file backup SQL atau ZIP untuk memulihkan database</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload File Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload Area - Mobile Responsive */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-8 text-center hover:border-gray-400 transition-colors">
              <Database className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <div className="space-y-2">
                <p className="text-base sm:text-lg font-medium text-gray-700 break-words">
                  {selectedFile ? selectedFile.name : 'Pilih file backup (.sql atau .zip)'}
                </p>
                {selectedFile && (
                  <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                    <p>Ukuran: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p>Format: {selectedFile.name.split('.').pop()?.toUpperCase()}</p>
                    <p>Terakhir diubah: {new Date(selectedFile.lastModified).toLocaleDateString('id-ID')}</p>
                    <div className="flex flex-wrap gap-1 sm:gap-2 mt-2 justify-center">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {selectedFile.name.split('.').pop()?.toUpperCase()}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                        Upload Manual
                      </span>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                        Ready to Restore
                      </span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Validated
                      </span>
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        {selectedFile.size > 1024 * 1024 ? 'Large File' : 'Small File'}
                      </span>
                      <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                        {selectedFile.name.includes('backup') ? 'Backup File' : 'Custom File'}
                      </span>
                      <span className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded">
                        {selectedFile.name.includes('test') ? 'Test File' : 'Production File'}
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-xs sm:text-sm text-gray-500">
                  Maksimal 100MB • Format: .sql, .zip
                </p>
              </div>
              
              <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sql,.zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="sm:mr-2"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Pilih File
                </Button>
                <Button
                  onClick={handleDownloadTemplate}
                  variant="ghost"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>
                    {{
                      uploading: 'Mengupload file...',
                      restoring: 'Memproses backup...'
                    }[restoreStatus] || 'Memulihkan database...'}
                  </span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
                {restoreStatus === 'restoring' && (
                  <div className="text-xs text-gray-500 text-center">
                    Proses restore sedang berjalan, harap tunggu...
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons - Mobile Responsive */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto"
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
                onClick={resetForm}
                variant="outline"
                disabled={uploading}
                className="w-full sm:w-auto"
              >
                Reset
              </Button>
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Backup yang Tersedia
              </CardTitle>
              <Button
                onClick={loadAvailableBackups}
                disabled={loadingBackups}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loadingBackups ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingBackups ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-600 border-t-transparent mx-auto mb-2" />
                <p className="text-sm text-gray-600">Memuat daftar backup...</p>
              </div>
            ) : availableBackups.length > 0 ? (
              <div className="space-y-3">
                {availableBackups.map((backup) => (
                  <div key={backup?.id || Math.random()} className="border rounded-lg p-3 sm:p-4 bg-gray-50">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 break-words">{backup?.name || 'Unknown Backup'}</h4>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                          {backup?.date ? new Date(backup.date).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'Unknown Date'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Ukuran: {backup?.size ? (backup.size / 1024 / 1024).toFixed(2) : '0'} MB
                        </p>
                        <p className="text-xs text-gray-500">
                          ID: {backup?.id || 'Unknown'}
                        </p>
                        <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
                          {backup.files?.sql?.length > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {backup.files.sql.length} SQL
                            </span>
                          )}
                          {backup.files?.zip?.length > 0 && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              {backup.files.zip.length} ZIP
                            </span>
                          )}
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            {backup?.type === 'scheduled' ? 'Scheduled' : 'Manual'}
                          </span>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Available
                          </span>
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                            Ready to Restore
                          </span>
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            {backup?.size && backup.size > 1024 * 1024 ? 'Large Backup' : 'Small Backup'}
                          </span>
                          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                            {backup?.name?.includes('backup') ? 'Backup File' : 'Custom File'}
                          </span>
                          <span className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded">
                            {backup?.name?.includes('test') ? 'Test File' : 'Production File'}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          onClick={() => backup?.id && restoreFromBackup(backup.id)}
                          disabled={uploading || !backup?.id}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
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
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Tidak ada backup yang tersedia</p>
                <p className="text-sm">Buat backup terlebih dahulu di menu Backup & Archive</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions - Mobile Responsive */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Petunjuk Penggunaan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 text-sm sm:text-base">Format File yang Didukung:</h4>
                <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
                  <li>• File SQL (.sql) - Backup database MySQL</li>
                  <li>• File ZIP (.zip) - Backup terkompresi</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 text-sm sm:text-base">Catatan Penting:</h4>
                <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
                  <li>• Backup akan mengganti data yang ada</li>
                  <li>• Pastikan file backup valid dan tidak rusak</li>
                  <li>• Proses restore tidak dapat dibatalkan</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SimpleRestoreView;

