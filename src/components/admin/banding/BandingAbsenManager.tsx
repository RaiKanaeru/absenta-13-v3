/**
 * BandingAbsenManager - Admin view for monitoring student attendance appeals
 * Admin can only VIEW data, not process (that's the teacher's responsibility)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, FileText, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import { downloadPdf } from '@/utils/exportUtils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface BandingManagerProps {
  onLogout: () => void;
}

interface BandingRequest {
  id_banding: number;
  tanggal_pengajuan: string;
  tanggal_absen: string;
  nama_pengaju: string;
  nama_kelas: string;
  nama_mapel: string;
  nama_guru: string;
  status_asli: string;
  status_diajukan: string;
  alasan_banding: string;
  status_banding: 'pending' | 'disetujui' | 'ditolak';
  catatan_guru: string;
  diproses_oleh: string;
  jam_mulai: string;
  jam_selesai: string;
}

export const BandingAbsenManager: React.FC<BandingManagerProps> = ({ onLogout }) => {
  const [requests, setRequests] = useState<BandingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/admin/banding-absen?status=${filterStatus === 'all' ? '' : filterStatus}`;
      const data = await apiCall(url, { onLogout });
      setRequests(data as BandingRequest[]);
    } catch (error: unknown) {
      console.error('Failed to fetch banding requests:', error);
      toast({
        title: "Gagal memuat data",
        description: getErrorMessage(error) || "Terjadi kesalahan",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, onLogout]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleExportExcel = async () => {
    if (filteredRequests.length === 0) {
      toast({
        title: "Tidak ada data",
        description: "Tidak ada data banding untuk di-export",
        variant: "destructive"
      });
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      
      const blob = await apiCall<Blob>(`/api/export/banding-absen?${params.toString()}`, {
        responseType: 'blob',
        onLogout
      });
      
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-banding-absen-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Berhasil",
        description: "File Excel berhasil diunduh"
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Gagal Export",
        description: getErrorMessage(error) || "Gagal mengunduh file Excel",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (filteredRequests.length === 0) {
      toast({
        title: "Tidak ada data",
        description: "Tidak ada data banding untuk di-export PDF",
        variant: "destructive"
      });
      return;
    }

    setExportingPdf(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus && filterStatus !== 'all') {
        params.status = filterStatus;
      }
      await downloadPdf(
        '/api/export/pdf/banding-absen',
        `laporan-banding-absen-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        params,
        onLogout
      );
      toast({
        title: "Berhasil",
        description: "File PDF berhasil diunduh"
      });
    } catch (error) {
      console.error('Export PDF error:', error);
      toast({
        title: "Gagal Export PDF",
        description: getErrorMessage(error) || "Gagal mengunduh file PDF",
        variant: "destructive"
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'disetujui': return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0">Disetujui</Badge>;
      case 'ditolak': return <Badge className="bg-destructive/15 text-destructive border-0">Ditolak</Badge>;
      default: return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0">Menunggu</Badge>;
    }
  };

  const filteredRequests = requests.filter(req => 
    req.nama_pengaju.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.nama_kelas.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Laporan Banding Absen
          </h2>
          <p className="text-muted-foreground">Monitoring pengajuan banding absensi siswa (read-only)</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari Siswa / Kelas..."
              className="pl-9 w-[200px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Menunggu</SelectItem>
              <SelectItem value="disetujui">Disetujui</SelectItem>
              <SelectItem value="ditolak">Ditolak</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleExportExcel} 
            disabled={exporting || filteredRequests.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </Button>
          <Button
            onClick={handleExportPdf}
            disabled={exportingPdf || filteredRequests.length === 0}
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            {exportingPdf ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Daftar Pengajuan Banding
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({filteredRequests.length} data)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No</TableHead>
                  <TableHead>Siswa</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Tanggal Absen</TableHead>
                  <TableHead>Jadwal</TableHead>
                  <TableHead>Status Absen</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Status Banding</TableHead>
                  <TableHead>Diproses Oleh</TableHead>
                  <TableHead>Catatan Guru</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Tidak ada data banding ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((req, index) => (
                    <TableRow key={req.id_banding}>
                      <TableCell className="text-center">{index + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{req.nama_pengaju}</div>
                      </TableCell>
                      <TableCell>{req.nama_kelas}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm">{format(new Date(req.tanggal_absen), 'dd MMM yyyy', { locale: id })}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{req.nama_mapel}</div>
                        <div className="text-xs text-gray-500">{req.jam_mulai} - {req.jam_selesai}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-red-600 line-through">{req.status_asli}</span>
                          <span className="text-gray-400">{'->'}</span>
                          <span className="text-green-600 font-semibold">{req.status_diajukan}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="truncate" title={req.alasan_banding}>
                          {req.alasan_banding}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(req.status_banding)}</TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {req.diproses_oleh || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="text-sm text-gray-600 truncate" title={req.catatan_guru}>
                          {req.catatan_guru || '-'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
