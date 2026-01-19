/**
 * RiwayatBandingAbsenView - Attendance appeal history report
 * Extracted from TeacherDashboard_Modern.tsx
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
import { formatDateWIB, getMonthRangeWIB } from "@/lib/time-utils";
import { MessageCircle, Search, Download } from "lucide-react";
import { getErrorMessage } from "@/utils/apiClient";
import { TeacherUserData } from "./types";
import { apiCall } from "./apiUtils";

interface RiwayatBandingAbsenViewProps {
  user: TeacherUserData;
}

export const RiwayatBandingAbsenView = ({ user }: RiwayatBandingAbsenViewProps) => {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [selectedMonth, setSelectedMonth] = useState('');
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportData, setReportData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async ()=>{
      const res = await apiCall('/api/guru/classes');
      setKelasOptions(res);
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
        endDate: dateRange.endDate 
      });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      
      const res = await apiCall(`/api/guru/banding-absen-history?${params.toString()}`);
      setReportData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error fetching banding absen history:', err);
      setError(getErrorMessage(err) || 'Gagal memuat data riwayat banding absen');
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
      const params = new URLSearchParams({ 
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate 
      });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      
      const blob = await apiCall<Blob>(`/api/export/riwayat-banding-absen?${params.toString()}`, {
        responseType: 'blob'
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `riwayat-banding-absen-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Berhasil",
        description: "File Excel berhasil diunduh"
      });
    } catch (err) {
      console.error('Error downloading Excel:', err);
      setError(getErrorMessage(err) || 'Gagal mengunduh file Excel');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Filter Laporan Riwayat Banding Absen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Quick Month Selection */}
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
            
            {/* Manual Date Range Selection */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Atau Pilih Rentang Tanggal Manual</h4>
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
                  <Label className="text-sm font-medium">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih Status"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Disetujui</SelectItem>
                      <SelectItem value="rejected">Ditolak</SelectItem>
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {reportData.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Riwayat Pengajuan Banding Absen
                </CardTitle>
                <Button onClick={downloadExcel} className="bg-green-600 hover:bg-green-700">
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Tanggal Absen</TableHead>
                      <TableHead>Status Absen</TableHead>
                      <TableHead>Alasan Banding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal Disetujui</TableHead>
                      <TableHead>Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{formatDateWIB(String(item.tanggal_pengajuan))}</TableCell>
                        <TableCell>{item.nama_siswa}</TableCell>
                        <TableCell>{item.nis}</TableCell>
                        <TableCell>{item.nama_kelas}</TableCell>
                        <TableCell>{formatDateWIB(String(item.tanggal_absen))}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.status_absen}</Badge>
                        </TableCell>
                        <TableCell>{item.alasan_banding}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={item.status === 'approved' ? 'default' : 
                                   item.status === 'rejected' ? 'destructive' : 'secondary'}
                          >
                            {item.status === 'approved' ? 'Disetujui' : 
                             item.status === 'rejected' ? 'Ditolak' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.tanggal_disetujui ? 
                            formatDateWIB(String(item.tanggal_disetujui)) : 
                            '-'
                          }
                        </TableCell>
                        <TableCell>{item.catatan || '-'}</TableCell>
                      </TableRow>
                    ))}
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
