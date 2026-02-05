import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, CheckCircle, XCircle, AlertTriangle, Search, Filter, Calendar, ArrowLeft, Download, Loader2 
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiCall } from '@/utils/apiClient';
import { formatDateWIB, getCurrentDateWIB } from "@/lib/time-utils";
import { createSessionExpiredHandler, generatePageNumbers } from '../utils/dashboardUtils';

interface BandingAbsenReportViewProps {
  onBack: () => void;
  onLogout: () => void;
}

interface BandingRequest {
  id: number;
  siswa_id: number;
  nama_siswa: string;
  kelas: string;
  tanggal_absen: string;
  keterangan: string;
  status: 'pending' | 'disetujui' | 'ditolak';
  bukti_url?: string;
  alasan_penolakan?: string;
  created_at: string;
  tanggal: string; // Alias for tanggal_absen in some responses
}

// Helper component for banding status badge
const StatusBandingBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'disetujui':
      return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25"><CheckCircle className="w-3 h-3 mr-1" /> Disetujui</Badge>;
    case 'ditolak':
      return <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/25"><XCircle className="w-3 h-3 mr-1" /> Ditolak</Badge>;
    default:
      return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25"><AlertTriangle className="w-3 h-3 mr-1" /> Menunggu</Badge>;
  }
};

export const BandingAbsenReportView: React.FC<BandingAbsenReportViewProps> = ({ onBack, onLogout }) => {
  const [bandingData, setBandingData] = useState<BandingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [exporting, setExporting] = useState(false);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedBanding, setSelectedBanding] = useState<BandingRequest | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);

  const handleSessionExpiredToast = (opts: { title: string; description: string; variant?: string }) => toast(opts);

  const fetchBandingData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiCall<BandingRequest[]>('/api/admin/banding-absen', {
        onLogout: createSessionExpiredHandler(onLogout, handleSessionExpiredToast)
      });
      setBandingData(data);
    } catch (error: unknown) {
      console.error('Error fetching banding data:', error);
      const message = error instanceof Error ? error.message : String(error);
      setError('Gagal memuat data banding: ' + message);
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchBandingData();
  }, [fetchBandingData]);

  const handleReviewBanding = async () => {
    if (!selectedBanding || !reviewAction) return;
    
    try {
      await apiCall(`/api/admin/banding-absen/${selectedBanding.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          status: reviewAction === 'approve' ? 'disetujui' : 'ditolak',
          keterangan: reviewNote
        }),
        onLogout: createSessionExpiredHandler(onLogout, handleSessionExpiredToast)
      });
      
      toast({
        title: "Berhasil",
        description: `Pengajuan banding berhasil ${reviewAction === 'approve' ? 'disetujui' : 'ditolak'}`
      });
      
      setIsReviewOpen(false);
      fetchBandingData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Gagal",
        description: message,
        variant: "destructive"
      });
    }
  };

  const openReviewModal = (banding: BandingRequest, action: 'approve' | 'reject') => {
    setSelectedBanding(banding);
    setReviewAction(action);
    setReviewNote('');
    setIsReviewOpen(true);
  };

  const handleExport = () => {
    try {
      if (!filteredData || filteredData.length === 0) {
        toast({
          title: "Info",
          description: "Tidak ada data untuk diekspor."
        });
        return;
      }
      setExporting(true);

      const exportData = filteredData.map((item, index) => ({
        'No': index + 1,
        'Nama Siswa': item.nama_siswa,
        'Kelas': item.kelas,
        'Tanggal Absen': formatDateWIB(item.tanggal || item.tanggal_absen),
        'Alasan Banding': item.keterangan,
        'Status': item.status,
        'Tanggal Pengajuan': formatDateWIB(item.created_at)
      }));

      const BOM = '\uFEFF';
      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' && value.includes(',') ? `"${value}"` : value
        ).join(',')
      );
      
      const csvContent = BOM + headers + '\n' + rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `laporan_banding_absen_${getCurrentDateWIB()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Berhasil",
        description: "File CSV berhasil diunduh"
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Gagal mengekspor data",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  // Filter logic
  const filteredData = bandingData.filter(item => {
    const matchesSearch = item.nama_siswa.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.kelas.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentPageData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const pageNumbers = generatePageNumbers(currentPage, totalPages);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <h2 className="text-2xl font-bold text-foreground">Laporan Banding Absen</h2>
        </div>
        <Button onClick={handleExport} variant="outline" disabled={exporting}>
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Mengekspor...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Daftar Pengajuan Banding
          </CardTitle>
          <CardDescription>
            Kelola pengajuan banding absensi dari siswa
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Cari nama siswa atau kelas..."
                className="pl-10 pr-4 py-2 border border-border rounded-lg w-full focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
<div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                className="border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="pending">Menunggu</option>
                <option value="disetujui">Disetujui</option>
                <option value="ditolak">Ditolak</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Siswa</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Tanggal Absen</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Bukti</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPageData.length > 0 ? (
                  currentPageData.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                      <TableCell className="font-medium">{item.nama_siswa}</TableCell>
                      <TableCell>{item.kelas}</TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDateWIB(item.tanggal || item.tanggal_absen)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={item.keterangan}>
                        {item.keterangan}
                      </TableCell>
                      <TableCell>
                        {item.bukti_url ? (
                          <a 
                            href={item.bukti_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm flex items-center"
                          >
                            Listing Bukti 
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBandingBadge status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {item.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              className="bg-emerald-600 hover:bg-emerald-700 h-8"
                              onClick={() => openReviewModal(item, 'approve')}
                            >
                              Setujui
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              className="h-8"
                              onClick={() => openReviewModal(item, 'reject')}
                            >
                              Tolak
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Tidak ada data banding ditemukan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Halaman {currentPage} dari {totalPages}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  «
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  ‹
                </Button>
                
                {pageNumbers.map((page, idx) => (
                   <Button
                     key={idx}
                     variant={currentPage === page ? "default" : "outline"}
                     size="sm"
                     onClick={() => typeof page === 'number' && setCurrentPage(page)}
                     disabled={typeof page !== 'number'}
                   >
                     {page}
                   </Button>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  ›
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  »
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Setujui Banding' : 'Tolak Banding'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve' 
                ? 'Anda akan menyetujui pengajuan banding ini. Kehadiran siswa akan diperbarui.' 
                : 'Anda akan menolak pengajuan banding ini. Berikan alasan penolakan.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Detail Pengajuan:</p>
<div className="bg-muted p-3 rounded-md text-sm">
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-muted-foreground">Siswa:</span>
                  <span className="col-span-2 font-medium">{selectedBanding?.nama_siswa}</span>
                  
                  <span className="text-muted-foreground">Kelas:</span>
                  <span className="col-span-2">{selectedBanding?.kelas}</span>
                  
                  <span className="text-muted-foreground">Tanggal:</span>
                  <span className="col-span-2">{selectedBanding && formatDateWIB(selectedBanding.tanggal || selectedBanding.tanggal_absen)}</span>
                  
                  <span className="text-muted-foreground">Alasan:</span>
                  <span className="col-span-2">{selectedBanding?.keterangan}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="note" className="text-sm font-medium">
                {reviewAction === 'approve' ? 'Catatan (Opsional)' : 'Alasan Penolakan (Wajib)'}
              </label>
              <Textarea
                id="note"
                placeholder={reviewAction === 'approve' ? 'Tambahkan catatan...' : 'Jelaskan alasan penolakan...'}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className={reviewAction === 'reject' && !reviewNote ? 'border-red-300' : ''}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewOpen(false)}>
              Batal
            </Button>
            <Button 
              disabled={reviewAction === 'reject' && !reviewNote}
              className={reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-destructive hover:bg-destructive/90'}
              onClick={handleReviewBanding}
            >
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BandingAbsenReportView;
