/**
 * TeacherReportsView - Teacher attendance summary reports
 * Extracted from TeacherDashboard_Modern.tsx
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatDateOnly, getMonthRangeWIB } from "@/lib/time-utils";
import { ArrowLeft, Filter, FileText, Search, Download, XCircle } from "lucide-react";
import { TeacherUserData } from "./types";
import { apiCall } from "./apiUtils";
import { getErrorMessage } from "@/utils/apiClient";
import ExcelPreview from '../ExcelPreview';
import { VIEW_TO_REPORT_KEY } from '../../utils/reportKeys';

interface TeacherReportsViewProps {
  user: TeacherUserData;
}

export const TeacherReportsView = ({ user }: TeacherReportsViewProps) => {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [selectedMonth, setSelectedMonth] = useState('');
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [reportData, setReportData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async ()=>{
      const res = await apiCall('/api/guru/classes');
      setKelasOptions(Array.isArray(res) ? res : []);
    })();
  }, []);

  const handleMonthChange = (monthValue: string) => {
    setSelectedMonth(monthValue);
    if (monthValue) {
      const range = getMonthRangeWIB(monthValue);
      setDateRange(range);
    } else {
      setDateRange({ startDate: '', endDate: '' });
    }
  };

  const fetchData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Mohon pilih periode mulai dan akhir');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      const res = await apiCall(`/api/guru/attendance-summary?${params.toString()}`);
      setReportData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Gagal memuat data laporan');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Mohon pilih periode mulai dan akhir');
      return;
    }
    try {
      const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      const blob = await apiCall<Blob>(`/api/guru/download-attendance-excel?${params.toString()}`, {
        responseType: 'blob'
      });
      const link = document.createElement('a');
      const url = globalThis.URL.createObjectURL(blob);
      link.href = url;
      link.download = `laporan-kehadiran-siswa-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      link.click();
      globalThis.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading excel:', err);
      setError(getErrorMessage(err) || 'Gagal mengunduh file Excel');
    }
  };

  const downloadSMKN13Format = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Mohon pilih periode mulai dan akhir');
      return;
    }
    try {
      const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      
      const blob = await apiCall<Blob>(`/api/export/ringkasan-kehadiran-siswa-smkn13?${params.toString()}`, {
        responseType: 'blob'
      });
      const link = document.createElement('a');
      const url = globalThis.URL.createObjectURL(blob);
      link.href = url;
      link.download = `laporan-kehadiran-siswa-smkn13-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      link.click();
      globalThis.URL.revokeObjectURL(url);
      
      toast({
        title: "Berhasil",
        description: "File format SMKN 13 berhasil diunduh"
      });
    } catch (err) {
      console.error('Error downloading SMKN 13 format:', err);
      setError(getErrorMessage(err) || 'Gagal mengunduh file format SMKN 13');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => globalThis.history.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ringkasan Kehadiran Siswa</h1>
          <p className="text-muted-foreground">Download ringkasan kehadiran siswa dalam format Excel</p>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Pilih Bulan (Cepat)</Label>
                <Input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="mt-1"
                  placeholder="Pilih bulan"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedMonth('');
                    setDateRange({ startDate: '', endDate: '' });
                  }}
                  className="w-full"
                >
                  Reset Filter
                </Button>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Atau Pilih Rentang Tanggal Manual</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <Label className="text-sm font-medium">Periode Mulai</Label>
                  <Input 
                    type="date" 
                    value={dateRange.startDate} 
                    onChange={(e)=>setDateRange(p=>({...p,startDate:e.target.value}))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Periode Akhir</Label>
                  <Input 
                    type="date" 
                    value={dateRange.endDate} 
                    onChange={(e)=>setDateRange(p=>({...p,endDate:e.target.value}))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Kelas</Label>
                  <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih Kelas"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {kelasOptions.map(k=> (<SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={fetchData} disabled={loading} className="flex-1">
                    <Search className="w-4 h-4 mr-2"/>
                    {loading ? 'Memuat...' : 'Tampilkan'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData.length > 0 && (
        <div className="space-y-4">
          <ExcelPreview
            title="Ringkasan Kehadiran Siswa"
            reportKey={VIEW_TO_REPORT_KEY['reports']}
            data={reportData.map((record, index) => ({
              no: index + 1,
              nama: record.nama,
              nis: record.nis || '-',
              kelas: record.nama_kelas || '-',
              hadir: record.H || 0,
              izin: record.I || 0,
              sakit: record.S || 0,
              alpa: record.A || 0,
              dispen: record.D || 0,
              presentase: Number(record.presentase || 0).toFixed(2) + '%'
            }))}
            columns={[
              { key: 'no', label: 'No', width: 60, align: 'center', format: 'number' },
              { key: 'nama', label: 'Nama Siswa', width: 200, align: 'left' },
              { key: 'nis', label: 'NIS', width: 120, align: 'left' },
              { key: 'kelas', label: 'Kelas', width: 100, align: 'center' },
              { key: 'hadir', label: 'H', width: 80, align: 'center', format: 'number' },
              { key: 'izin', label: 'I', width: 80, align: 'center', format: 'number' },
              { key: 'sakit', label: 'S', width: 80, align: 'center', format: 'number' },
              { key: 'alpa', label: 'A', width: 80, align: 'center', format: 'number' },
              { key: 'dispen', label: 'D', width: 80, align: 'center', format: 'number' },
              { key: 'presentase', label: 'Presentase', width: 100, align: 'center', format: 'percentage' }
            ]}
            onExport={downloadExcel}
            teacherName={user?.nama || 'Guru'}
            reportPeriod={selectedMonth ? 
              `Periode: ${formatDateOnly(selectedMonth + '-01')}` :
              `Periode: ${dateRange.startDate} - ${dateRange.endDate}`
            }
          />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Export Format SMK 13
              </CardTitle>
<p className="text-sm text-muted-foreground">
                Download laporan dalam format resmi SMK Negeri 13 Bandung
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={downloadSMKN13Format}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Format SMK 13
                </Button>
<div className="text-sm text-muted-foreground">
                  Format resmi dengan header sekolah dan styling profesional
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && reportData.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
<FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Belum ada data laporan</h3>
            <p className="text-muted-foreground text-center">Pilih periode dan kelas, lalu klik "Tampilkan" untuk melihat laporan kehadiran siswa</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
