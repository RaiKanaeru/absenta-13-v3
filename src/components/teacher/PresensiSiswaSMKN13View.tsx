/**
 * PresensiSiswaSMKN13View - Student attendance report SMKN13 format
 * Extracted from TeacherDashboard.tsx
 * Optimized with server-side pagination (50 rows/page) to reduce DOM load
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { formatDateWIB } from "@/lib/time-utils";
import { downloadExcelFromApi, downloadPdf } from "@/utils/exportUtils";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { FileText, Search, ArrowLeft, FileSpreadsheet, Loader2, AlertCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { getErrorMessage } from "@/utils/apiClient";
import { TeacherUserData } from "@/types/teacher";
import { apiCall } from "./apiUtils";

const PAGE_SIZE = 50;

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PresensiSmkn13Row {
  tanggal: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  mata_pelajaran: string;
  nama_kelas: string;
  nama_guru: string;
  total_siswa: number;
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
  dispen: number;
  terlambat_count: number;
}

interface PresensiSmkn13ApiResponse {
  data: PresensiSmkn13Row[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PresensiSiswaSMKN13ViewProps {
  user: TeacherUserData;
  onBack?: () => void;
}

export const PresensiSiswaSMKN13View = ({ user, onBack }: PresensiSiswaSMKN13ViewProps) => {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [kelasOptions, setKelasOptions] = useState<{id:number, nama_kelas:string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [reportData, setReportData] = useState<PresensiSmkn13Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    (async ()=>{
      const res = await apiCall('/api/guru/classes');
      setKelasOptions(Array.isArray(res) ? res : []);
    })();
  }, []);

  const fetchData = useCallback(async (page = 1) => {
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
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);
      
      const res = await apiCall<PresensiSmkn13ApiResponse | PresensiSmkn13Row[]>(`/api/guru/presensi-siswa-smkn13?${params.toString()}`);
      
      // Handle paginated response { data, total, page, limit, totalPages }
      if (res && !Array.isArray(res) && res.data) {
        setReportData(Array.isArray(res.data) ? res.data : []);
        setPagination({
          total: res.total,
          page: res.page,
          limit: res.limit,
          totalPages: res.totalPages,
        });
        setCurrentPage(res.page);
      } else {
        // Fallback: plain array (backward compat)
        setReportData(Array.isArray(res) ? res : []);
        setPagination(null);
        setCurrentPage(1);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal memuat data presensi", description: err instanceof Error ? err.message : "Terjadi kesalahan" });
      setError(getErrorMessage(err) || 'Gagal memuat data presensi siswa');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedKelas]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (pagination && newPage > pagination.totalPages)) return;
    fetchData(newPage);
  };

  const handleDownloadExcel = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      const message = 'Mohon pilih periode mulai dan akhir';
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
      return;
    }
    const params = new URLSearchParams({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);

    try {
      setExporting(true);
      await downloadExcelFromApi(
        '/api/export/presensi-siswa-smkn13',
        `presensi-siswa-smkn13-${dateRange.startDate}-${dateRange.endDate}.xlsx`,
        params
      );
      toast({ title: "Berhasil", description: "File Excel berhasil diunduh" });
    } catch (error) {
      const message = getErrorMessage(error) || 'Gagal mengunduh file Excel';
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      const message = 'Mohon pilih periode mulai dan akhir';
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
      return;
    }

    const params = new URLSearchParams({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    if (selectedKelas && selectedKelas !== 'all') params.append('kelas_id', selectedKelas);

    try {
      setExportingPdf(true);
      await downloadPdf(
        '/api/export/pdf/presensi-siswa-smkn13',
        `presensi-siswa-smkn13-${dateRange.startDate}-${dateRange.endDate}.pdf`,
        params
      );
      toast({ title: "Berhasil", description: "File PDF berhasil diunduh" });
    } catch (error) {
      const message = getErrorMessage(error) || 'Gagal mengunduh file PDF';
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  };

  // Calculate row number offset for paginated display
  const rowOffset = pagination ? (pagination.page - 1) * pagination.limit : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => onBack ? onBack() : globalThis.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>
        <h2 className="text-2xl font-bold text-foreground">Presensi Siswa (Format SMKN 13)</h2>
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
              <Button onClick={() => fetchData(1)} disabled={loading} className="flex-1">
                <Search className="w-4 h-4 mr-2"/>
                {loading ? 'Memuat...' : 'Tampilkan'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <ErrorAlert message={error} />
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {!loading && reportData.length === 0 && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Tidak ada data presensi untuk periode ini</p>
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
                  {pagination && (
                    <Badge variant="secondary" className="ml-2">
                      {pagination.total.toLocaleString()} data
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleDownloadPdf}
                    disabled={exportingPdf}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {exportingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        PDF...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Export PDF
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleDownloadExcel}
                    disabled={exporting}
                    variant="outline"
                    size="sm"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Mengekspor...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export Excel
                      </>
                    )}
                  </Button>
                </div>
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
                        <TableRow key={`${item.tanggal}-${item.jam_mulai}-${item.nama_kelas}-${index}`}>
                          <TableCell>{rowOffset + index + 1}</TableCell>
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
                            <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{item.hadir || 0}</Badge>
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
                            <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400">{item.terlambat_count || 0}</Badge>
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

              {/* Pagination Controls */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {rowOffset + 1}-{Math.min(rowOffset + pagination.limit, pagination.total)} dari {pagination.total.toLocaleString()} data
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage <= 1 || loading}
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || loading}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="px-3 py-1 text-sm font-medium">
                      {currentPage} / {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= pagination.totalPages || loading}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.totalPages)}
                      disabled={currentPage >= pagination.totalPages || loading}
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
