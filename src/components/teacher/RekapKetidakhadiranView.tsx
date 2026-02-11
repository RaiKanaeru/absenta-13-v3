/**
 * RekapKetidakhadiranView - Absence recap report view
 * Extracted from TeacherDashboard.tsx
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { getMonthRangeWIB } from "@/lib/time-utils";
import { ClipboardList, Search, Download, ArrowLeft, Loader2 } from "lucide-react";
import { TeacherUserData } from "./types";
import { apiCall } from "./apiUtils";

interface RekapKetidakhadiranViewProps {
  user: TeacherUserData;
  onBack?: () => void;
}

export const RekapKetidakhadiranView = ({ user, onBack }: RekapKetidakhadiranViewProps) => {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [selectedMonth, setSelectedMonth] = useState('');
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [reportType, setReportType] = useState('bulanan');
  const [reportData, setReportData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

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
      const params = new URLSearchParams({ 
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate,
        reportType: reportType
      });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      
      const res = await apiCall(`/api/guru/rekap-ketidakhadiran?${params.toString()}`);
      setReportData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error fetching rekap ketidakhadiran:', err);
      setError(err instanceof Error ? err.message : 'Gagal memuat data rekap ketidakhadiran');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({ 
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate,
        reportType: reportType
      });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      
      const blob = await apiCall<Blob>(`/api/export/rekap-ketidakhadiran?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `rekap-ketidakhadiran-${reportType}-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      link.click();
      
      toast({
        title: "Berhasil!",
        description: "File Excel berhasil diunduh"
      });
    } catch (err) {
      console.error('Error downloading Excel:', err);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" size="icon" onClick={() => onBack ? onBack() : globalThis.history.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold">Rekap Ketidakhadiran</h2>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Filter Laporan Rekap Ketidakhadiran
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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
                <div>
                  <Label className="text-sm font-medium">Jenis Laporan</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih Jenis"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bulanan">Bulanan</SelectItem>
                      <SelectItem value="tahunan">Tahunan</SelectItem>
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

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {reportData.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Rekap Ketidakhadiran {reportType === 'bulanan' ? 'Bulanan' : 'Tahunan'}
                </CardTitle>
                <Button onClick={downloadExcel} className="bg-emerald-600 hover:bg-emerald-700" disabled={exporting}>
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Mengekspor...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Export Excel
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Total Siswa</TableHead>
                      <TableHead>Hadir</TableHead>
                      <TableHead>Izin</TableHead>
                      <TableHead>Sakit</TableHead>
                      <TableHead>Alpa</TableHead>
                      <TableHead>Dispen</TableHead>
                      <TableHead>Total Absen</TableHead>
                      <TableHead>Presentase Hadir</TableHead>
                      <TableHead>Presentase Absen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, index) => {
                      const totalSiswa = item.total_siswa || 0;
                      const hadir = item.hadir || 0;
                      const totalAbsen = (Number(item.izin) || 0) + (Number(item.sakit) || 0) + (Number(item.alpa) || 0) + (Number(item.dispen) || 0);
                      const presentaseHadir = Number(totalSiswa) > 0 ? ((Number(hadir) / Number(totalSiswa)) * 100).toFixed(1) : '0.0';
                      const presentaseAbsen = Number(totalSiswa) > 0 ? ((Number(totalAbsen) / Number(totalSiswa)) * 100).toFixed(1) : '0.0';
                      
                      return (
                        <TableRow key={item.id || index}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{item.periode}</TableCell>
                          <TableCell>{item.nama_kelas}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{totalSiswa}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{hadir}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400">{item.izin || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-400">{item.sakit || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="bg-destructive/15 text-destructive">{item.alpa || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-400">{item.dispen || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-destructive/15 text-destructive">{totalAbsen}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                              {presentaseHadir}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-destructive/15 text-destructive">
                              {presentaseAbsen}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
