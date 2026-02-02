/**
 * PresensiSiswaSMKN13View - Student attendance report SMKN13 format
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
import { formatDateWIB } from "@/lib/time-utils";
import { FileText, Search, Download, ArrowLeft } from "lucide-react";
import { getErrorMessage } from "@/utils/apiClient";
import { TeacherUserData } from "./types";
import { apiCall } from "./apiUtils";

interface PresensiSiswaSMKN13ViewProps {
  user: TeacherUserData;
  onBack?: () => void;
}

export const PresensiSiswaSMKN13View = ({ user, onBack }: PresensiSiswaSMKN13ViewProps) => {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [reportData, setReportData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async ()=>{
      const res = await apiCall('/api/guru/classes');
      setKelasOptions(res);
    })();
  }, []);

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
      
      const res = await apiCall(`/api/guru/presensi-siswa-smkn13?${params.toString()}`);
      setReportData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error fetching presensi siswa SMKN 13:', err);
      setError(getErrorMessage(err) || 'Gagal memuat data presensi siswa');
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
      
      const blob = await apiCall<Blob>(`/api/export/presensi-siswa-smkn13?${params.toString()}`, {
        responseType: 'blob'
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `presensi-siswa-smkn13-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
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
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => onBack ? onBack() : globalThis.history.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold">Presensi Siswa (Format SMKN 13)</h2>
      </div>
      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Filter Laporan Presensi Siswa SMK 13
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                  <FileText className="w-5 h-5" />
                  Presensi Siswa SMK 13
                </CardTitle>
                <Button onClick={downloadExcel} className="bg-blue-600 hover:bg-blue-700">
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
                      <TableHead>Hari</TableHead>
                      <TableHead>Jam</TableHead>
                      <TableHead>Mata Pelajaran</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Guru</TableHead>
                      <TableHead>Total Siswa</TableHead>
                      <TableHead>Hadir</TableHead>
                      <TableHead>Izin</TableHead>
                      <TableHead>Sakit</TableHead>
                      <TableHead>Alpa</TableHead>
                      <TableHead>Dispen</TableHead>
                      <TableHead>Terlambat</TableHead>
                      <TableHead>Presentase</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, index) => {
                      const total = item.total_siswa || 0;
                      const hadir = item.hadir || 0;
                      const presentase = Number(total) > 0 ? ((Number(hadir) / Number(total)) * 100).toFixed(1) : '0.0';
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{formatDateWIB(String(item.tanggal))}</TableCell>
                          <TableCell>{item.hari}</TableCell>
                          <TableCell>{item.jam_mulai} - {item.jam_selesai}</TableCell>
                          <TableCell>{item.mata_pelajaran}</TableCell>
                          <TableCell>{item.nama_kelas}</TableCell>
                          <TableCell>{item.nama_guru}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{total}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-500">{item.hadir || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-yellow-500">{item.izin || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-orange-500">{item.sakit || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive">{item.alpa || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-purple-500">{item.dispen || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-orange-400 text-white border-orange-500">{item.terlambat_count || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-500/15 text-blue-700 dark:text-blue-400">
                              {presentase}%
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
