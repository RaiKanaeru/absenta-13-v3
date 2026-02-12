/**
 * LaporanKehadiranSiswaView - Student attendance report view
 * Extracted from TeacherDashboard.tsx
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatDateOnly, formatDateWIB, getWIBTime, getMonthRangeWIB } from "@/lib/time-utils";
import { ArrowLeft, XCircle, Filter, Search, FileText } from "lucide-react";
import ExcelPreview from '../ExcelPreview';
import { VIEW_TO_REPORT_KEY } from '../../utils/reportKeys';
import { TeacherUserData } from "./types";
import { apiCall } from "./apiUtils";
import { downloadPdf } from '@/utils/exportUtils';

interface LaporanKehadiranSiswaViewProps {
  user: TeacherUserData;
  onBack?: () => void;
}

export const LaporanKehadiranSiswaView = ({ user, onBack }: LaporanKehadiranSiswaViewProps) => {
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [reportData, setReportData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [mapelInfo, setMapelInfo] = useState<{nama_mapel: string, nama_guru: string} | null>(null);
  const [pertemuanDates, setPertemuanDates] = useState<string[]>([]);
  const [periode, setPeriode] = useState<{startDate: string, endDate: string, total_days: number} | null>(null);
  
  // Filter state
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });


  useEffect(() => {
    (async ()=>{
      const res = await apiCall('/api/guru/classes');
      setKelasOptions(Array.isArray(res) ? res : []);
    })();
    
    // Set default month to current month
    const wibDate = getWIBTime();
    const currentMonth = wibDate.getFullYear() + '-' + String(wibDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(currentMonth);
  }, []);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (month) {
      const range = getMonthRangeWIB(month);
      setDateRange(range);
    }
  };

  const getDateRange = () => {
    if (filterMode === 'month' && selectedMonth) {
      return getMonthRangeWIB(selectedMonth);
    }
    return dateRange;
  };


  const fetchData = async () => {
    if (!selectedKelas) {
      setError('Mohon pilih kelas');
      return;
    }

    const { startDate, endDate } = getDateRange();
    
    if (!startDate || !endDate) {
      setError('Mohon pilih periode');
      return;
    }

    // Validasi rentang tanggal
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      setError('Tanggal akhir harus setelah tanggal mulai');
      return;
    }

    // Validasi rentang maksimal 62 hari
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 62) {
      setError('Rentang tanggal maksimal 62 hari');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiCall<{
        data: Record<string, string | number>[];
        mapel_info: { nama_mapel: string; nama_guru: string };
        pertemuan_dates: string[];
        periode: { startDate: string; endDate: string; total_days: number };
      }>(`/api/guru/laporan-kehadiran-siswa?kelas_id=${selectedKelas}&startDate=${startDate}&endDate=${endDate}`);
      
      setReportData(Array.isArray(res.data) ? res.data : []);
      setMapelInfo(res.mapel_info || null);
      setPertemuanDates(res.pertemuan_dates || []);
      setPeriode(res.periode || null);
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal memuat data laporan", description: err instanceof Error ? err.message : "Terjadi kesalahan" });
      setError(err instanceof Error ? err.message : 'Gagal memuat data laporan');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    const { startDate, endDate } = getDateRange();
    
    if (!startDate || !endDate || !selectedKelas) {
      const message = 'Mohon pilih kelas dan periode';
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      const message = 'Tanggal akhir harus setelah tanggal mulai';
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
      return;
    }

    try {
      setExporting(true);
      const blob = await apiCall<Blob>(`/api/guru/download-laporan-kehadiran-siswa?kelas_id=${selectedKelas}&startDate=${startDate}&endDate=${endDate}`, {
        responseType: 'blob'
      });
      
      const link = document.createElement('a');
      const url = globalThis.URL.createObjectURL(blob);
      link.href = url;
      link.download = `laporan-kehadiran-siswa-${startDate}-${endDate}.xlsx`;
      link.click();
      globalThis.URL.revokeObjectURL(url);
      
      toast({
        title: "Berhasil!",
        description: "File Excel berhasil diunduh"
      });
    } catch (err) {
      const message = 'Gagal mengunduh file Excel';
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    const { startDate, endDate } = getDateRange();
    if (!startDate || !endDate || !selectedKelas) {
      toast({
        title: "Error",
        description: "Mohon pilih kelas dan periode",
        variant: "destructive"
      });
      return;
    }

    try {
      setExportingPdf(true);
      await downloadPdf(
        '/api/export/pdf/laporan-kehadiran-siswa',
        `laporan-kehadiran-siswa-${startDate}-${endDate}.pdf`,
        { kelas_id: selectedKelas, startDate, endDate }
      );
      toast({
        title: "Berhasil!",
        description: "File PDF berhasil diunduh"
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Gagal mengunduh file PDF",
        variant: "destructive"
      });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <Button variant="outline" size="icon" onClick={() => onBack ? onBack() : globalThis.history.back()} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">Laporan Kehadiran Siswa</h1>
          <p className="text-sm sm:text-base text-muted-foreground break-words">Laporan kehadiran siswa berdasarkan jadwal pertemuan</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-destructive/20 bg-destructive/10">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        </Card>
      )}

      {/* Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
            Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Mode Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Label className="text-sm font-medium shrink-0">Periode:</Label>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
              <Button
                variant={filterMode === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('month')}
                className="w-full sm:w-auto"
              >
                Bulan
              </Button>
              <Button
                variant={filterMode === 'range' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('range')}
                className="w-full sm:w-auto"
              >
                Rentang Tanggal
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label className="text-sm font-medium">Kelas</Label>
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih Kelas"/>
                </SelectTrigger>
                <SelectContent>
                  {kelasOptions.map(k=> (<SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {filterMode === 'month' ? (
              <div className="sm:col-span-2 lg:col-span-1">
                <Label className="text-sm font-medium">Bulan</Label>
                <Input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="mt-1"
                />
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-sm font-medium">Tanggal Mulai</Label>
                  <Input 
                    type="date" 
                    value={dateRange.startDate} 
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Tanggal Selesai</Label>
                  <Input 
                    type="date" 
                    value={dateRange.endDate} 
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-2 lg:col-span-1 flex items-end">
              <Button 
                onClick={fetchData} 
                disabled={loading} 
                className="w-full"
                size="sm"
              >
                <Search className="w-4 h-4 mr-2"/>
                {loading ? 'Memuat...' : 'Tampilkan Laporan'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {reportData.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <FileText className="w-4 h-4 mr-2" />
              {exportingPdf ? 'Mengunduh PDF...' : 'Download PDF'}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <ExcelPreview
              title="Laporan Kehadiran Siswa"
              reportKey={VIEW_TO_REPORT_KEY['reports']}
              data={reportData.map((student, index) => {
                const rowData: Record<string, string | number> = {
                  no: index + 1,
                  nama: student.nama,
                  nis: student.nis || '-',
                  jenis_kelamin: student.jenis_kelamin,
                  hadir: student.total_hadir || 0,
                  izin: student.total_izin || 0,
                  sakit: student.total_sakit || 0,
                  alpa: student.total_alpa || 0,
                  dispen: student.total_dispen || 0,
                  presentase: student.persentase_kehadiran || '0%'
                };

                // Add dynamic columns for each meeting date
                pertemuanDates.forEach((date, dateIndex) => {
                  const attendance = student.attendance_by_date?.[date];
                  let statusCode = 'A'; // Default to Alpa
                  
                  if (attendance) {
                    const statusMap: Record<string, string> = {
                      'Hadir': 'H', 'Izin': 'I', 'Sakit': 'S', 'Alpa': 'A', 'Dispen': 'D', 'Tidak Hadir': 'A'
                    };
                    statusCode = statusMap[attendance] || 'A';
                  }
                  
                  rowData[`pertemuan_${dateIndex}`] = statusCode;
                });

                return rowData;
              })}
              columns={[
                { key: 'no', label: 'No', width: 50, align: 'center', format: 'number' },
                { key: 'nama', label: 'Nama', width: 150, align: 'left' },
                { key: 'nis', label: 'NIS', width: 120, align: 'left' },
                { key: 'jenis_kelamin', label: 'L/P', width: 50, align: 'center' },
                // Dynamic columns for meeting dates
                ...pertemuanDates.map((date, index) => ({
                  key: `pertemuan_${index}`,
                  label: `${new Date(date).getDate()}/${new Date(date).getMonth() + 1}`,
                  width: 50,
                  align: 'center' as const,
                  format: 'text' as const,
                  title: formatDateOnly(date)
                })),
                { key: 'hadir', label: 'H', width: 50, align: 'center', format: 'number' },
                { key: 'izin', label: 'I', width: 50, align: 'center', format: 'number' },
                { key: 'sakit', label: 'S', width: 50, align: 'center', format: 'number' },
                { key: 'alpa', label: 'A', width: 50, align: 'center', format: 'number' },
                { key: 'dispen', label: 'D', width: 50, align: 'center', format: 'number' },
                { key: 'presentase', label: '%', width: 80, align: 'center', format: 'percentage' }
              ]}
              onExport={downloadExcel}
              exporting={exporting}
              teacherName={mapelInfo?.nama_guru || 'Guru'}
              subjectName={mapelInfo?.nama_mapel || 'Mata Pelajaran'}
              reportPeriod={periode ? 
                `Periode: ${formatDateWIB(periode.startDate)} - ${formatDateWIB(periode.endDate)} | Total Pertemuan: ${pertemuanDates.length}` :
                'Periode: -'
              }
              showLetterhead={true}
            />
          </div>
        </div>
      )}

      {!loading && reportData.length === 0 && !error && selectedKelas && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
            <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-foreground mb-2 text-center">Belum ada data laporan</h3>
            <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md">Pilih kelas dan klik "Tampilkan Laporan" untuk melihat laporan kehadiran siswa</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
