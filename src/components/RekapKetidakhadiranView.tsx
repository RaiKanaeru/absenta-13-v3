import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Search, Users, Calendar, BarChart3, FileText } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useLetterhead } from '../hooks/useLetterhead';
import { useExcelDownload } from '@/hooks/useExcelDownload';
import { ExportButton } from '@/components/shared/ExportButton';
import { ErrorAlert } from '@/components/shared/ErrorAlert';

import { ReportLetterhead } from './ui/report-letterhead';
import { ReportSummary } from './ui/report-summary';
import { formatDateOnly } from '../lib/time-utils';
import { ACADEMIC_MONTHS, getMonthName } from '../lib/academic-constants';
import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { downloadPdf } from '@/utils/exportUtils';
import { Kelas, Siswa } from '@/types/school';

interface PresensiData {
  siswa_id: number;
  bulan: number;
  tahun: number;
  total_hari_efektif: number;
  total_ketidakhadiran: number;
  persentase_ketidakhadiran: string | number;
  persentase_kehadiran: string | number;
  detail_ketidakhadiran: {
    tanggal: string;
    status: 'S' | 'A' | 'I';
    keterangan?: string;
  }[];
}

const shouldShowRekapTable = (
  selectedKelas: string,
  selectedTahun: string,
  studentsLength: number,
  viewMode: 'tahunan' | 'bulanan' | 'tanggal',
  selectedBulan: string,
  selectedTanggalAwal: string,
  selectedTanggalAkhir: string,
) => {
  if (!selectedKelas || !selectedTahun || studentsLength === 0) {
    return false;
  }

  if (viewMode === 'tahunan') {
    return true;
  }

  if (viewMode === 'bulanan') {
    return Boolean(selectedBulan);
  }

  return Boolean(selectedTanggalAwal && selectedTanggalAkhir);
};

/**
 * Determine if presensi data fetch should occur based on view mode and selected values
 */
const shouldFetchPresensiData = (
  selectedKelas: string,
  selectedTahun: string,
  viewMode: 'tahunan' | 'bulanan' | 'tanggal',
  selectedBulan: string,
  selectedTanggalAwal: string,
  selectedTanggalAkhir: string,
): boolean => {
  if (!selectedKelas || !selectedTahun) return false;

  if (viewMode === 'bulanan') return Boolean(selectedBulan);
  if (viewMode === 'tanggal') return Boolean(selectedTanggalAwal && selectedTanggalAkhir);
  return true; // tahunan
};

/**
 * Build URL search params for presensi API based on view mode
 */
const buildPresensiParams = (
  kelasId: string,
  tahun: string,
  viewMode: 'tahunan' | 'bulanan' | 'tanggal',
  bulan?: string,
  tanggalAwal?: string,
  tanggalAkhir?: string,
): URLSearchParams => {
  const params = new URLSearchParams({
    kelas_id: kelasId,
    tahun: tahun,
  });

  if (viewMode === 'bulanan' && bulan) {
    params.append('bulan', bulan);
  }

  if (viewMode === 'tanggal' && tanggalAwal && tanggalAkhir) {
    params.append('tanggal_awal', tanggalAwal);
    params.append('tanggal_akhir', tanggalAkhir);
  }

  return params;
};

/**
 * Build export filename with class, year and period info
 */
const buildExportFileName = (
  baseFileName: string,
  kelasName: string,
  tahun: string,
  viewMode: 'tahunan' | 'bulanan' | 'tanggal',
  selectedBulan?: string,
  selectedTanggalAwal?: string,
  selectedTanggalAkhir?: string,
): string => {
  let fileName = `${baseFileName}_${kelasName}_${tahun}`;

  if (viewMode === 'bulanan' && selectedBulan) {
    fileName += `_${selectedBulan}`;
  } else if (viewMode === 'tanggal' && selectedTanggalAwal && selectedTanggalAkhir) {
    fileName += `_${selectedTanggalAwal}_${selectedTanggalAkhir}`;
  }

  return fileName;
};

const RekapKetidakhadiranView: React.FC<{ onBack: () => void; onLogout: () => void }> = ({ onBack, onLogout }) => {
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [selectedTahun, setSelectedTahun] = useState<string>(new Date().getFullYear().toString());
  const [selectedBulan, setSelectedBulan] = useState<string>('');
  const [selectedTanggalAwal, setSelectedTanggalAwal] = useState<string>('');
  const [selectedTanggalAkhir, setSelectedTanggalAkhir] = useState<string>('');
  const [viewMode, setViewMode] = useState<'tahunan' | 'bulanan' | 'tanggal'>('tahunan');
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [presensiData, setPresensiData] = useState<PresensiData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { downloadExcel, exporting } = useExcelDownload();

  // Use letterhead hook for consistent kop laporan
  const { letterhead } = useLetterhead('REPORT_REKAP_KETIDAKHADIRAN');

  // Use shared academic months constant


  // Fetch classes
  const fetchClasses = useCallback(async () => {
    try {
      setError(null);
      const data = await apiCall<Kelas[]>('/api/kelas');

      setClasses(data);
     } catch (error) {
       setError(error instanceof Error ? error.message : 'Gagal memuat data kelas');
     }
  }, []);

  // Fetch students by class
  const fetchStudents = useCallback(async (kelasId: string) => {
    if (!kelasId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall<Siswa[]>(`/api/admin/students-by-class/${kelasId}`);

      setStudents(data);
     } catch (error) {
       setError(error instanceof Error ? error.message : 'Gagal memuat data siswa');
     } finally {
      setLoading(false);
    }
  }, []);

   // Fetch presensi data
   const fetchPresensiData = useCallback(async (kelasId: string, tahun: string, bulan?: string, tanggalAwal?: string, tanggalAkhir?: string) => {
     if (!kelasId || !tahun) return;

     // Validasi urutan tanggal untuk mode tanggal
     if (tanggalAwal && tanggalAkhir && new Date(tanggalAkhir) < new Date(tanggalAwal)) {
       setError('Tanggal akhir harus setelah tanggal awal');
       return;
     }
     
     try {
       setLoading(true);
       setError(null);
       const params = buildPresensiParams(kelasId, tahun, viewMode, bulan, tanggalAwal, tanggalAkhir);

       const data = await apiCall<PresensiData[]>(`/api/admin/rekap-ketidakhadiran?${params}`);

        setPresensiData(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Gagal memuat data presensi');
      } finally {
       setLoading(false);
     }
   }, [viewMode]);

   useEffect(() => {
     fetchClasses();
   }, [fetchClasses]);

   useEffect(() => {
     if (selectedKelas) {
       fetchStudents(selectedKelas);
     }
   }, [selectedKelas, fetchStudents]);

   useEffect(() => {
     if (shouldFetchPresensiData(selectedKelas, selectedTahun, viewMode, selectedBulan, selectedTanggalAwal, selectedTanggalAkhir)) {
       fetchPresensiData(selectedKelas, selectedTahun, viewMode === 'bulanan' ? selectedBulan : undefined, viewMode === 'tanggal' ? selectedTanggalAwal : undefined, viewMode === 'tanggal' ? selectedTanggalAkhir : undefined);
     }
   }, [selectedKelas, selectedTahun, selectedBulan, selectedTanggalAwal, selectedTanggalAkhir, viewMode, fetchPresensiData]);

  // Get presensi data for specific student and month
  const getPresensiForStudent = (siswaId: number, monthNumber: number) => {
    return presensiData.find(p => p.siswa_id === siswaId && p.bulan === monthNumber);
  };


  // Get presensi data for specific student in date range
  const getPresensiForStudentByDate = (siswaId: number) => {
    return presensiData.find(p => p.siswa_id === siswaId);
  };

  // Get total ketidakhadiran for student
  const getTotalKetidakhadiran = (siswaId: number) => {
    const studentData = presensiData.filter(p => p.siswa_id === siswaId);
    return studentData.reduce((total, data) => total + data.total_ketidakhadiran, 0);
  };

  // Get total persentase ketidakhadiran for student
  const getTotalPersentaseKetidakhadiran = (siswaId: number) => {
    const studentData = presensiData.filter(p => p.siswa_id === siswaId);
    if (studentData.length === 0) return 0;
    const totalKetidakhadiran = getTotalKetidakhadiran(siswaId);
    const totalHariEfektif = studentData.reduce((total, data) => total + data.total_hari_efektif, 0);
    return totalHariEfektif > 0 ? (totalKetidakhadiran / totalHariEfektif) * 100 : 0;
  };

  // Get total persentase kehadiran for student
  const getTotalPersentaseKehadiran = (siswaId: number) => {
    return 100 - getTotalPersentaseKetidakhadiran(siswaId);
  };

   // Export to Excel
   const handleExportExcel = async () => {
     if (!selectedKelas || !selectedTahun) {
       toast({
         title: "Error",
         description: "Pilih kelas dan tahun terlebih dahulu",
         variant: "destructive",
       });
       return;
     }

     const params = buildPresensiParams(selectedKelas, selectedTahun, viewMode, selectedBulan, selectedTanggalAwal, selectedTanggalAkhir);
     const kelasName = classes.find(c => c.id.toString() === selectedKelas)?.nama_kelas || 'Unknown';
     const fileName = buildExportFileName('Rekap_Ketidakhadiran_Siswa', kelasName, selectedTahun, viewMode, selectedBulan, selectedTanggalAwal, selectedTanggalAkhir);

     await downloadExcel({
       endpoint: '/api/export/rekap-ketidakhadiran-siswa',
       params,
       fileName: `${fileName}.xlsx`,
       successMessage: 'Data berhasil diekspor ke Excel',
       fallbackErrorMessage: 'Gagal mengekspor data ke Excel',
       onLogout,
     });
   };

   const handleExportPdf = async () => {
     if (!selectedKelas || !selectedTahun) {
       toast({
         title: "Error",
         description: "Pilih kelas dan tahun terlebih dahulu",
         variant: "destructive",
       });
       return;
     }

     try {
       setLoading(true);
       const params = buildPresensiParams(selectedKelas, selectedTahun, viewMode, selectedBulan, selectedTanggalAwal, selectedTanggalAkhir);
       const kelasName = classes.find(c => c.id.toString() === selectedKelas)?.nama_kelas || 'Unknown';
       const fileName = buildExportFileName('Rekap_Ketidakhadiran_Siswa', kelasName, selectedTahun, viewMode, selectedBulan, selectedTanggalAwal, selectedTanggalAkhir);

       await downloadPdf('/api/export/pdf/rekap-ketidakhadiran-siswa', fileName, params, onLogout);

       toast({
         title: "Berhasil",
         description: "Data berhasil diekspor ke PDF",
       });
      } catch (error) {
        const message = getErrorMessage(error) || "Gagal mengekspor data ke PDF";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      } finally {
       setLoading(false);
     }
   };

  // Use the shared getEffectiveDays from academic-constants instead of local function

  const shouldRenderRekapTable = shouldShowRekapTable(
    selectedKelas,
    selectedTahun,
    students.length,
    viewMode,
    selectedBulan,
    selectedTanggalAwal,
    selectedTanggalAkhir,
  );

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
<h1 className="text-2xl font-bold text-foreground">Rekap Ketidakhadiran Siswa</h1>
              <p className="text-muted-foreground">Format rekap ketidakhadiran sesuai standar SMKN 13</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onClick={handleExportExcel}
            loading={exporting}
            disabled={loading || !selectedKelas || !selectedTahun}
            className="flex items-center gap-2"
            variant="outline"
            loadingLabel="Exporting..."
          />
          <Button
            onClick={handleExportPdf}
            disabled={loading || !selectedKelas || !selectedTahun}
            className="flex items-center gap-2"
            variant="outline"
          >
            <FileText className="w-4 h-4" />
            {loading ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Filter Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-1 gap-4 ${viewMode === 'tanggal' ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            <div className="space-y-2">
              <Label htmlFor="kelas">Kelas</Label>
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((kelas) => (
                    <SelectItem key={kelas.id} value={kelas.id.toString()}>
                      {kelas.nama_kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tahun">Tahun Pelajaran</Label>
              <Input
                id="tahun"
                type="number"
                value={selectedTahun}
                onChange={(e) => setSelectedTahun(e.target.value)}
                placeholder="Tahun"
                min="2020"
                max="2030"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="viewMode">Mode Tampilan</Label>
              <Select value={viewMode} onValueChange={(value: 'tahunan' | 'bulanan' | 'tanggal') => setViewMode(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tahunan">Tahunan (Juli-Juni)</SelectItem>
                  <SelectItem value="bulanan">Bulanan</SelectItem>
                  <SelectItem value="tanggal">Berdasarkan Tanggal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {viewMode === 'bulanan' && (
              <div className="space-y-2">
                <Label htmlFor="bulan">Bulan</Label>
                <Select value={selectedBulan} onValueChange={setSelectedBulan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACADEMIC_MONTHS.map((month) => (
                      <SelectItem key={month.number} value={month.number.toString()}>
                        {month.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {viewMode === 'tanggal' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tanggalAwal">Tanggal Awal</Label>
                  <Input
                    id="tanggalAwal"
                    type="date"
                    value={selectedTanggalAwal}
                    onChange={(e) => setSelectedTanggalAwal(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanggalAkhir">Tanggal Akhir</Label>
                  <Input
                    id="tanggalAkhir"
                    type="date"
                    value={selectedTanggalAkhir}
                    onChange={(e) => setSelectedTanggalAkhir(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="mb-6">
          <ErrorAlert message={error} />
        </div>
      )}

      {/* Rekap Table */}
      {shouldRenderRekapTable && (
        <Card>
          <CardHeader>
            <CardTitle>
              Rekap Ketidakhadiran - {classes.find(c => c.id.toString() === selectedKelas)?.nama_kelas}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {/* School Header - Using shared component */}
              <ReportLetterhead
                letterhead={letterhead}
                reportTitle="REKAP KETIDAKHADIRAN SISWA"
                selectedTahun={selectedTahun}
                className={classes.find(c => c.id.toString() === selectedKelas)?.nama_kelas}
                periodInfo={
                  viewMode === 'bulanan' && selectedBulan
                    ? `BULAN ${getMonthName(Number.parseInt(selectedBulan)).toUpperCase()}`
                    : viewMode === 'tanggal' && selectedTanggalAwal && selectedTanggalAkhir
                    ? `PERIODE ${formatDateOnly(selectedTanggalAwal)} - ${formatDateOnly(selectedTanggalAkhir)}`
                    : undefined
                }
              />

              {/* Rekap Table */}
              <div className="border-2 border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted border-b-2 border-border">
                      <th className="border border-border p-2 text-center w-12">NO.</th>
                      <th className="border border-border p-2 text-center w-48">NAMA SISWA</th>
                      {viewMode === 'tahunan' ? (
                        <>
                          {ACADEMIC_MONTHS.map((month) => (
                            <th key={month.key} className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">
                              {month.key}
                            </th>
                          ))}
                        </>
                      ) : viewMode === 'bulanan' ? (
                        <th className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">
                          {ACADEMIC_MONTHS.find(m => m.number.toString() === selectedBulan)?.key}
                        </th>
                      ) : (
                        <th className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">
                          PERIODE TANGGAL
                        </th>
                      )}
                      <th className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 w-24">JUMLAH KETIDAKHADIRAN</th>
                      <th className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 w-32">PERSENTASE KETIDAKHADIRAN (%)</th>
                      <th className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 w-32">PERSENTASE KEHADIRAN (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((siswa, index) => (
                      <tr key={siswa.id} className="hover:bg-muted">
                        <td className="border border-border p-2 text-center">{index + 1}</td>
                        <td className="border border-border p-2">{siswa.nama}</td>
                        {viewMode === 'tahunan' ? (
                          <>
                            {ACADEMIC_MONTHS.map((month) => {
                              const presensi = getPresensiForStudent(siswa.id, month.number);
                              return (
                                <td key={month.key} className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">
                                  {presensi ? presensi.total_ketidakhadiran : 0}
                                </td>
                              );
                            })}
                          </>
                        ) : viewMode === 'bulanan' ? (
                          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">
                            {getPresensiForStudent(siswa.id, Number.parseInt(selectedBulan))?.total_ketidakhadiran || 0}
                          </td>
                        ) : (
                          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">
                            {getPresensiForStudentByDate(siswa.id)?.total_ketidakhadiran || 0}
                          </td>
                        )}
                        <td className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 font-semibold">
                          {viewMode === 'tahunan' ? getTotalKetidakhadiran(siswa.id) : 
                           viewMode === 'bulanan' ? getPresensiForStudent(siswa.id, Number.parseInt(selectedBulan))?.total_ketidakhadiran || 0 :
                           getPresensiForStudentByDate(siswa.id)?.total_ketidakhadiran || 0}
                        </td>
                        <td className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 font-semibold">
                          {viewMode === 'tahunan' ? getTotalPersentaseKetidakhadiran(siswa.id).toFixed(2) : 
                           viewMode === 'bulanan' ? (Number.parseFloat(String(getPresensiForStudent(siswa.id, Number.parseInt(selectedBulan))?.persentase_ketidakhadiran || '0'))).toFixed(2) :
                           (Number.parseFloat(String(getPresensiForStudentByDate(siswa.id)?.persentase_ketidakhadiran || '0'))).toFixed(2)}
                        </td>
                        <td className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 font-semibold">
                          {viewMode === 'tahunan' ? getTotalPersentaseKehadiran(siswa.id).toFixed(2) : 
                           viewMode === 'bulanan' ? (Number.parseFloat(String(getPresensiForStudent(siswa.id, Number.parseInt(selectedBulan))?.persentase_kehadiran || '0'))).toFixed(2) :
                           (Number.parseFloat(String(getPresensiForStudentByDate(siswa.id)?.persentase_kehadiran || '0'))).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Section - Using shared component */}
              <ReportSummary
                viewMode={viewMode}
                selectedBulan={selectedBulan}
                selectedTanggalAwal={selectedTanggalAwal}
                selectedTanggalAkhir={selectedTanggalAkhir}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && (!selectedKelas || !selectedTahun) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
<Calendar className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Pilih Filter</h3>
            <p className="text-muted-foreground text-center">Pilih kelas dan tahun untuk melihat rekap ketidakhadiran</p>
          </CardContent>
        </Card>
      )}

      {!loading && selectedKelas && selectedTahun && students.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
<Users className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Tidak ada siswa</h3>
            <p className="text-muted-foreground text-center">Tidak ada siswa ditemukan untuk kelas yang dipilih</p>
          </CardContent>
        </Card>
      )}

      {!loading && selectedKelas && selectedTahun && students.length > 0 && presensiData.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
<Calendar className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Tidak ada data presensi</h3>
            <p className="text-muted-foreground text-center">Tidak ada data presensi untuk periode yang dipilih. Pastikan ada data absensi siswa untuk kelas dan periode yang dipilih.</p>
          </CardContent>
        </Card>
      )}

      {/* Letterhead Initialization Button */}
      <div className="mt-6">
        {/* SimpleLetterheadInit removed - logo initialization handled elsewhere */}
      </div>
    </div>
  );
};

export default RekapKetidakhadiranView;
