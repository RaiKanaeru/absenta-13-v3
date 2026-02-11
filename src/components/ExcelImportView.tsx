import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertTriangle } from "lucide-react";
import { apiCall, getErrorMessage } from '@/utils/apiClient';

interface ExcelImportViewProps {
  entityType: 'mapel' | 'kelas' | 'guru' | 'siswa' | 'jadwal' | 'teacher-account' | 'student-account' | 'ruang' | 'schedule-master';
  entityName: string;
  onBack: () => void;
}

interface ValidationError {
  index: number;
  errors: string[];
  data?: {
    nis?: string;
    nama?: string;
    kelas?: string;
    [key: string]: string | undefined;
  };
}

interface PreviewDataRow {
  [key: string]: string | number | boolean;
}

interface ImportResult {
  total: number;
  valid: number;
  invalid: number;
  errors: ValidationError[];
  previewData?: PreviewDataRow[];
}

const ExcelImportView: React.FC<ExcelImportViewProps> = ({ entityType, entityName, onBack }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewDataRow[]>([]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        toast({
          title: "Error",
          description: "File harus berformat .xlsx",
          variant: "destructive"
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error", 
          description: "Ukuran file maksimal 5MB",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
      setValidationResult(null);
      setImportResult(null);
      setShowPreview(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      // All entities now use user-friendly template
      let endpoint;
      if (entityType === 'guru') {
        endpoint = `/api/admin/guru/template-friendly`;
      } else if (entityType === 'teacher-account') {
        endpoint = `/api/admin/teacher-account/template-friendly`;
      } else if (entityType === 'student-account') {
        endpoint = `/api/admin/student-account/template-friendly`;
      } else if (entityType === 'ruang') {
        endpoint = `/api/admin/ruang/template-friendly`;
      } else {
        endpoint = `/api/admin/${entityType}/template-friendly`;
      }
      
      const blob = await apiCall<Blob>(endpoint, { responseType: 'blob' });
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Simplified filename
      const entityNames: Record<string, string> = {
        'guru': 'data-guru',
        'teacher-account': 'akun-guru',
        'student-account': 'akun-siswa',
        'siswa': 'data-siswa',
        'mapel': 'mata-pelajaran',
        'kelas': 'kelas',
        'ruang': 'ruang-kelas',
        'jadwal': 'jadwal-pelajaran',
        'schedule-master': 'master-schedule'
      };
      a.download = `template-${entityNames[entityType] || entityType}.xlsx`;
      
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
      
      toast({
        title: "Berhasil",
        description: "Template berhasil didownload"
      });
    } catch (error) {
      console.error('Download template error:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Gagal download template",
        variant: "destructive"
      });
    }
  };

  const validateFile = async () => {
    if (!selectedFile) return;

    setIsValidating(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const result = await apiCall<ImportResult>(`/api/admin/import/${entityType}?dryRun=true`, {
        method: 'POST',
        body: formData
      });
      
      setValidationResult(result);
      setShowPreview(true);
      
      // Tampilkan preview data yang akan diimport untuk semua tipe
      if (result.valid > 0 && result.previewData) {
        setPreviewData(result.previewData);
      }
      
      toast({
        title: "Validasi Selesai",
        description: `Ditemukan ${result.valid} baris valid dan ${result.invalid} baris invalid`
      });
    } catch (error) {
      console.error('Error validating file:', error);
      toast({
        title: "Error",
        description: "Gagal memvalidasi file",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const importFile = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const result = await apiCall<ImportResult & { processed?: number, inserted_or_updated?: number, inserted?: number }>(`/api/admin/import/${entityType}`, {
        method: 'POST',
        body: formData
      });

      setImportResult(result);
      toast({
        title: "Import Berhasil",
        description: `Berhasil memproses ${result.processed || result.inserted_or_updated || result.inserted} baris data`
      });
    } catch (error) {
      console.error('Error importing file:', error);
      toast({
        title: "Error",
        description: "Gagal mengimpor file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getEntityInstructions = () => {
    const instructions = {
      mapel: {
        title: "Template Mata Pelajaran",
        description: "Format: kode_mapel, nama_mapel, deskripsi (opsional), status (aktif/nonaktif)",
        example: "BING-01, Bahasa Inggris, Mata pelajaran bahasa asing, aktif"
      },
      kelas: {
        title: "Template Kelas", 
        description: "Format: nama_kelas, tingkat (opsional), status (aktif/nonaktif)",
        example: "X IPA 1, X, aktif"
      },
      guru: {
        title: "Template Data Guru",
        description: "Format: NIP (wajib), Nama Lengkap (wajib), Email (opsional), Mata Pelajaran (opsional), Telepon (opsional), Jenis Kelamin (L/P), Alamat (opsional), Status (aktif/nonaktif/pensiun). Template sudah disesuaikan dengan form CRUD Data Guru dan menyertakan referensi mata pelajaran.",
        example: "198001012005011001, Budi Santoso, budi@sekolah.id, Matematika, 081234567890, L, Jl. Mawar No. 1, aktif"
      },
      'teacher-account': {
        title: "Template Akun Guru",
        description: "Format: NIP (wajib), Nama Lengkap (wajib), Username (wajib), Email (opsional), Telepon (opsional), Jenis Kelamin (L/P), Alamat (opsional), Mata Pelajaran (opsional), Status (aktif/nonaktif), Password (wajib). Template sudah disesuaikan dengan form CRUD Akun Guru dan menyertakan referensi mata pelajaran.",
        example: "198001012005011001, Budi Santoso, budi.santoso, budi@sekolah.id, 081234567890, L, Jl. Mawar No. 1, Matematika, aktif, Guru123!"
      },
      'student-account': {
        title: "Template Akun Siswa",
        description: "Format: Nama Lengkap (wajib), Username (wajib), Password (wajib), NIS (wajib), Kelas (wajib), Jabatan (opsional), Jenis Kelamin (L/P), Email (opsional). Template sudah disesuaikan dengan form CRUD Akun Siswa dan menyertakan referensi kelas.",
        example: "Ahmad Rizki, ahmad.rizki, Siswa123!, 25001, X IPA 1, Ketua Kelas, L, ahmad@sekolah.id"
      },
      siswa: {
        title: "Template Data Siswa",
        description: "Format: NIS (wajib), Nama Lengkap (wajib), Kelas (wajib), Jenis Kelamin (L/P), Telepon Orang Tua (opsional), Nomor Telepon Siswa (opsional), Alamat (opsional), Status (opsional). Template sudah disesuaikan dengan form CRUD Data Siswa dan menyertakan referensi kelas.",
        example: "25001, Ahmad Rizki, X IPA 1, L, 0811223344, 0812334455, Jl. Melati No. 1, aktif"
      },
      jadwal: {
        title: "Template Jadwal Pelajaran",
        description: `Format: Kelas (wajib), Mata Pelajaran (wajib untuk pelajaran), Guru (wajib untuk pelajaran), Guru Tambahan (opsional), Kode Ruang (opsional), Hari (wajib), Jam Ke (wajib), Jam Mulai (wajib), Jam Selesai (wajib), Jenis Aktivitas (opsional), Keterangan Khusus (opsional).

CATATAN PENTING:
- Untuk Jenis Aktivitas "pelajaran": Mata Pelajaran dan Guru WAJIB diisi
- Untuk Jenis Aktivitas selain "pelajaran" (upacara, istirahat, dll):
  - Mata Pelajaran boleh KOSONG
  - Guru boleh KOSONG
  - Keterangan Khusus WAJIB diisi
- Multi-guru: Gunakan kolom 'Guru Tambahan' dengan format: 'Nama Guru 1,Nama Guru 2'
- Format waktu: HH:MM:SS (contoh: 07:00:00)`,
        example: "X IPA 1, Matematika, Budi Santoso, Siti Aminah|Ahmad Rizki, LAB-01, Senin, 1, 07:00:00, 07:45:00, pelajaran, Team Teaching"
      },
      ruang: {
        title: "Template Ruang Kelas",
        description: "Format: kode_ruang (wajib), nama_ruang (wajib), lokasi (opsional), kapasitas (opsional), status (aktif/nonaktif)",
        example: "LAB-01, Laboratorium Komputer, Lantai 2, 30, aktif"
      },
      'schedule-master': {
        title: "Template Master Schedule (CSV Matrix)",
        description: "Format Matrix: Kolom (Waktu), Baris (Kelas x 3). Baris 1: Mapel, Baris 2: Ruang, Baris 3: Guru. Mendukung format CSV dari aplikasi pembuat jadwal.",
        example: "Lihat dokumen analisis master schedule untuk detail."
      }
    };
    return instructions[entityType as keyof typeof instructions];
  };

  const instructions = getEntityInstructions();

  const getPreviewTableHeaders = () => {
    const headers = {
      'mapel': ['Kode Mapel', 'Nama Mapel', 'Deskripsi', 'Status'],
      'kelas': ['Nama Kelas', 'Tingkat', 'Status'],
      'ruang': ['Kode Ruang', 'Nama Ruang', 'Lokasi', 'Kapasitas', 'Status'],
      'jadwal': ['Kelas', 'Mata Pelajaran', 'Guru', 'Guru Tambahan', 'Kode Ruang', 'Hari', 'Jam Ke', 'Jam Mulai', 'Jam Selesai', 'Jenis Aktivitas', 'Keterangan Khusus', 'Status'],
      'guru': ['NIP', 'Nama', 'Email', 'Mata Pelajaran', 'No Telepon', 'Jenis Kelamin', 'Status'],
      'teacher-account': ['NIP', 'Nama', 'Username', 'Email', 'No Telepon', 'Jenis Kelamin', 'Alamat', 'Mata Pelajaran', 'Status'],
      'siswa': ['NIS', 'Nama', 'Kelas', 'Jenis Kelamin', 'Telepon Orang Tua', 'Status'],
      'student-account': ['Nama', 'Username', 'NIS', 'Kelas', 'Jabatan', 'Jenis Kelamin', 'Email', 'Status']
    };
    
    return headers[entityType]?.map(header => (
      <TableHead key={header}>{header}</TableHead>
    )) || [];
  };

  const getPreviewTableCells = (data: PreviewDataRow) => {
    const cells = {
      'mapel': [
        data.kode_mapel,
        data.nama_mapel,
        data.deskripsi || '-',
        <Badge key="status" variant={data.status === 'aktif' ? 'default' : 'secondary'}>{data.status}</Badge>
      ],
      'kelas': [
        data.nama_kelas,
        data.tingkat || '-',
        <Badge key="status" variant={data.status === 'aktif' ? 'default' : 'secondary'}>{data.status}</Badge>
      ],
      'ruang': [
        data.kode_ruang,
        data.nama_ruang,
        data.lokasi || '-',
        data.kapasitas || '-',
        <Badge key="status" variant={data.status === 'aktif' ? 'default' : 'secondary'}>{data.status}</Badge>
      ],
      'jadwal': [
        data.kelas || '-',
        data.mata_pelajaran || '-',
        data.guru || '-',
        data.guru_tambahan || '-',
        data.kode_ruang || '-',
        data.hari,
        data.jam_ke,
        data.jam_mulai,
        data.jam_selesai,
        data.jenis_aktivitas || 'pelajaran',
        data.keterangan_khusus || '-',
        <Badge key="status" variant={data.status === 'aktif' ? 'default' : 'secondary'}>{data.status}</Badge>
      ],
      'guru': [
        data.nip,
        data.nama,
        data.email || '-',
        data.mata_pelajaran || '-',
        data.no_telp || '-',
        data.jenis_kelamin || '-',
        <Badge key="status" variant={data.status === 'aktif' ? 'default' : 'secondary'}>{data.status}</Badge>
      ],
      'teacher-account': [
        data.nama,
        data.nip,
        data.username,
        data.email || '-',
        data.no_telp || '-',
        data.jenis_kelamin || '-',
        data.alamat || '-',
        data.mata_pelajaran || '-',
        <Badge key="status" variant={data.status === 'aktif' ? 'default' : 'secondary'}>{data.status}</Badge>
      ],
      'siswa': [
        data.nis,
        data.nama,
        data.kelas,
        data.jenis_kelamin || '-',
        data.telepon_orangtua || '-',
        <Badge key="status" variant={data.status === 'aktif' ? 'default' : 'secondary'}>{data.status}</Badge>
      ],
      'student-account': [
        data.nama,
        data.username,
        data.nis,
        data.kelas,
        data.jabatan || '-',
        data.jenis_kelamin || '-',
        data.email || '-',
        <Badge key="status" variant={data.status === 'aktif' ? 'default' : 'secondary'}>{data.status}</Badge>
      ]
    };
    
    return cells[entityType]?.map((cell, index) => (
      <TableCell key={index}>{cell}</TableCell>
    )) || [];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Import {entityName} via Excel</h2>
          <p className="text-muted-foreground">Upload file Excel untuk menambah data {entityName} secara massal</p>
        </div>
        <Button onClick={onBack} variant="outline">
          ← Kembali
        </Button>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {instructions.title}
          </CardTitle>
          <CardDescription>{instructions.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm font-medium">Contoh format:</p>
            <code className="block p-2 bg-muted rounded text-sm">{instructions.example}</code>
          </div>
        </CardContent>
      </Card>

      {/* Download Template */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Unduh Template
          </CardTitle>
          <CardDescription>Download template Excel yang sudah disesuaikan dengan format yang benar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-green-900 mb-1">Template Import</h4>
                <p className="text-sm text-green-700">
                  Template sudah disesuaikan dengan format yang benar dan mudah digunakan.
                  {entityType === 'jadwal' && ' Sheet ke-2 berisi referensi mata pelajaran, guru, dan kelas.'}
                  {(entityType === 'guru' || entityType === 'teacher-account') && ' Sheet ke-2 berisi referensi mata pelajaran.'}
                  {(entityType === 'siswa' || entityType === 'student-account') && ' Sheet ke-2 berisi referensi kelas.'}
                </p>
              </div>
              <Button 
                onClick={() => handleDownloadTemplate()}
                className="bg-green-600 hover:bg-green-700 ml-4"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
            {entityType === 'jadwal' && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm">
                <p className="font-medium text-yellow-800 mb-1">Catatan untuk Jadwal:</p>
                <ul className="text-yellow-700 space-y-1">
                  <li>• Untuk "pelajaran": Mata Pelajaran dan Guru WAJIB</li>
                  <li>• Untuk "upacara/istirahat": Mata Pelajaran dan Guru boleh KOSONG</li>
                  <li>• Keterangan Khusus WAJIB untuk non-pelajaran</li>
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload File Excel
          </CardTitle>
          <CardDescription>Pilih file Excel yang sudah diisi sesuai template</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {entityType === 'jadwal' && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Panduan Import Jadwal</h3>
              <div className="text-sm text-blue-700 space-y-2">
                <p><strong>Field Wajib untuk Semua Jenis Aktivitas:</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Kelas, Hari, Jam Ke, Jam Mulai, Jam Selesai</li>
                </ul>
                <p><strong>Field Wajib untuk "pelajaran":</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Mata Pelajaran, Guru</li>
                </ul>
                <p><strong>Field Wajib untuk "upacara/istirahat/kegiatan_khusus":</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Keterangan Khusus (Mata Pelajaran dan Guru boleh kosong)</li>
                </ul>
                <p><strong>Field Opsional:</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Guru Tambahan, Kode Ruang, Jenis Aktivitas (default: pelajaran)</li>
                </ul>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="file">Pilih File (.xlsx)</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="w-4 h-4" />
                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="flex gap-2">
              <Button 
                onClick={validateFile} 
                disabled={isValidating}
                variant="outline"
                className="flex-1"
              >
                {isValidating ? "Memvalidasi..." : "Validasi File"}
              </Button>
              {validationResult && validationResult.valid > 0 && (
                <Button 
                  onClick={importFile} 
                  disabled={isUploading}
                  className="flex-1"
                >
                  {isUploading ? "Mengimpor..." : "Import Data"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResult && showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Hasil Validasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{validationResult.total}</div>
                <div className="text-sm text-muted-foreground">Total Baris</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{validationResult.valid}</div>
                <div className="text-sm text-muted-foreground">Valid</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{validationResult.invalid}</div>
                <div className="text-sm text-muted-foreground">Invalid</div>
              </div>
            </div>

            {validationResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Error yang ditemukan:</h4>
                {entityType === 'jadwal' && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm">
                    <p className="font-medium text-yellow-800 mb-1">Tips untuk memperbaiki error:</p>
                    <ul className="text-yellow-700 space-y-1">
                      <li>• Pastikan nama kelas, mata pelajaran, dan guru sesuai dengan data yang ada</li>
                      <li>• Untuk upacara/istirahat: biarkan Mata Pelajaran dan Guru kosong, isi Keterangan Khusus</li>
                      <li>• Format waktu: HH:MM:SS (contoh: 07:00:00)</li>
                      <li>• Hari harus: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu</li>
                    </ul>
                  </div>
                )}
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Baris</TableHead>
                        <TableHead className="w-48">Data</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResult.errors.map((error) => (
                        <TableRow key={error.index}>
                          <TableCell className="font-medium">{error.index}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {error.data ? (
                              <div className="space-y-0.5">
                                {error.data.nis && <div><span className="font-medium">NIS:</span> {error.data.nis}</div>}
                                {error.data.nama && <div><span className="font-medium">Nama:</span> {error.data.nama}</div>}
                                {error.data.kelas && <div><span className="font-medium">Kelas:</span> {error.data.kelas}</div>}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {error.errors.map((err, i) => (
                                <Badge key={i} variant="destructive" className="mr-1">
                                  {err}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            
            {/* Preview Data untuk semua tipe */}
            {validationResult.valid > 0 && previewData.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-green-600">Preview Data yang Akan Diimport:</h4>
                {entityType === 'jadwal' && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-sm">
                    <p className="font-medium text-green-800 mb-1">Data yang akan diimport:</p>
                    <ul className="text-green-700 space-y-1">
                      <li>• Data dengan jenis "pelajaran" akan memiliki mata pelajaran dan guru</li>
                      <li>• Data dengan jenis "upacara/istirahat" akan memiliki keterangan khusus</li>
                      <li>• Field kosong akan diabaikan sesuai aturan validasi</li>
                    </ul>
                  </div>
                )}
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {getPreviewTableHeaders()}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.slice(0, 10).map((data, index) => (
                        <TableRow key={index}>
                          {getPreviewTableCells(data)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {previewData.length > 10 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Menampilkan 10 dari {previewData.length} data. Semua data akan diimport.
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Hasil Import
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Berhasil memproses {importResult.valid || importResult.total} baris data.
                {importResult.invalid > 0 && ` ${importResult.invalid} baris dilewati karena error.`}
              </AlertDescription>
            </Alert>
            {entityType === 'jadwal' && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm">
                <p className="font-medium text-blue-800 mb-1">Informasi Import Jadwal:</p>
                <ul className="text-blue-700 space-y-1">
                  <li>• Data pelajaran telah disimpan dengan mata pelajaran dan guru</li>
                  <li>• Data upacara/istirahat telah disimpan dengan keterangan khusus</li>
                  <li>• Field kosong telah diabaikan sesuai aturan validasi</li>
                  <li>• Multi-guru telah disimpan untuk data pelajaran</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progress Indicator */}
      {(isValidating || isUploading) && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {isValidating ? "Memvalidasi file..." : "Mengimpor data..."}
                </span>
                <span className="text-muted-foreground">Mohon tunggu...</span>
              </div>
              <Progress value={undefined} className="w-full" />
              <div className="text-xs text-muted-foreground">
                {(() => {
                  if (isValidating) return "Memeriksa format data dan validasi...";
                  if (entityType === 'jadwal') return "Menyimpan jadwal ke database dengan validasi jenis aktivitas...";
                  return "Menyimpan data ke database...";
                })()}
              </div>
              {entityType === 'jadwal' && (
                <div className="text-xs text-blue-600">
                  Validasi: Pelajaran memerlukan mata pelajaran dan guru, upacara/istirahat memerlukan keterangan khusus
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExcelImportView;


