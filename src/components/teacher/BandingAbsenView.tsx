/**
 * BandingAbsenView - Teacher view for processing student attendance appeals
 * Extracted from TeacherDashboard.tsx - EXACT COPY, no UI changes
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatDateWIB, formatTime24 } from "@/lib/time-utils";
import { getErrorMessage } from "@/lib/utils";
import { MessageCircle, Filter, Eye, CheckCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
import { getTeacherAttendanceBadgeClass as getAttendanceBadgeClass, getTeacherBandingStatusClass as getBandingStatusClass } from "@/utils/statusMaps";
import { TeacherUserData, BandingAbsenTeacher } from "./types";
import { apiCall } from "./apiUtils";

interface BandingAbsenViewProps {
  user: TeacherUserData;
}

const getBandingStatusLabel = (status: string): string => {
  switch (status) {
    case 'disetujui':
      return 'Disetujui';
    case 'ditolak':
      return 'Ditolak';
    default:
      return 'Menunggu';
  }
};

const getTextareaElement = (elementId: string): HTMLTextAreaElement | null => {
  const element = document.getElementById(elementId);
  return element instanceof HTMLTextAreaElement ? element : null;
};

export const BandingAbsenView = ({ user }: BandingAbsenViewProps) => {
  const [bandingList, setBandingList] = useState<BandingAbsenTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [filterPending, setFilterPending] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPending, setTotalPending] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const limit = 5;

  // getAttendanceBadgeClass and getBandingStatusClass are now imported from @/utils/statusMaps

  const renderStatusPair = (statusAsli: string, statusDiajukan: string) => (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant="outline" className={`text-xs px-1 py-0 ${getAttendanceBadgeClass(statusAsli)}`}>
        {statusAsli}
      </Badge>
      <span className="text-xs text-muted-foreground">→</span>
      <Badge variant="outline" className={`text-xs px-1 py-0 ${getAttendanceBadgeClass(statusDiajukan)}`}>
        {statusDiajukan}
      </Badge>
    </div>
  );

  useEffect(() => {
    const fetchBandingAbsen = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: limit.toString(),
          filter_pending: filterPending.toString()
        });
        
        const response = await apiCall(`/api/guru/${user.guru_id || user.id}/banding-absen?${params}`);
        
        if (response && typeof response === 'object') {
          setBandingList(response.data || []);
          setTotalPages(response.totalPages || 1);
          setTotalPending(response.totalPending || 0);
          setTotalAll(response.totalAll || 0);
         } else {
           setBandingList(Array.isArray(response) ? response : []);
         }
       } catch (error) {
         console.error('BandingAbsenView: Failed to load banding data', error);
         toast({ 
           title: "Error", 
           description: "Gagal memuat data banding absen", 
           variant: "destructive" 
         });
       } finally {
        setLoading(false);
      }
    };

    fetchBandingAbsen();
  }, [user.guru_id, user.id, currentPage, filterPending]);

  const handleFilterToggle = () => {
    setFilterPending(!filterPending);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleBandingResponse = async (bandingId: number, status: 'disetujui' | 'ditolak', catatan: string = '') => {
    if (processingId === bandingId) return;
    setProcessingId(bandingId);
    try {
      await apiCall(`/api/banding-absen/${bandingId}/respond`, {
        method: 'PUT',
        body: JSON.stringify({ 
          status_banding: status, 
          catatan_guru: catatan,
          diproses_oleh: user.guru_id || user.id
        }),
      });

      toast({ 
        title: "Berhasil!", 
        description: `Banding absen berhasil ${status}` 
      });
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        filter_pending: filterPending.toString()
      });
      
      const response = await apiCall(`/api/guru/${user.guru_id || user.id}/banding-absen?${params}`);
      
      if (response && typeof response === 'object') {
        setBandingList(response.data || []);
        setTotalPages(response.totalPages || 1);
        setTotalPending(response.totalPending || 0);
        setTotalAll(response.totalAll || 0);
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: getErrorMessage(error), 
        variant: "destructive" 
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            <span className="text-lg sm:text-xl">Pengajuan Banding Absen</span>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground font-medium">
              {filterPending ? `${totalPending} belum di-acc` : `${totalAll} total`}
            </div>
            <div className="text-xs text-muted-foreground">
              Halaman {currentPage} dari {totalPages}
            </div>
          </div>
        </CardTitle>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
          <div className="text-sm text-muted-foreground">
            <div className="block sm:hidden">
              Total: {totalAll} | Belum di-acc: {totalPending}
            </div>
            <div className="hidden sm:block">
              Total: {totalAll} | Belum di-acc: {totalPending}
            </div>
          </div>
          <Button
            variant={filterPending ? "default" : "outline"}
            size="sm"
            onClick={handleFilterToggle}
            className={`w-full sm:w-auto ${filterPending ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}`}
          >
            {filterPending ? (
              <>
                <Eye className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Tampilkan Semua</span>
                <span className="sm:hidden">Semua</span>
              </>
            ) : (
              <>
                <Filter className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Belum di-acc ({totalPending})</span>
                <span className="sm:hidden">Pending ({totalPending})</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-muted h-32 rounded"></div>
            ))}
          </div>
        ) : bandingList.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Tidak ada banding absen</h3>
            <p className="text-muted-foreground">Belum ada pengajuan banding absen dari siswa yang perlu diproses</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal Pengajuan</TableHead>
                    <TableHead>Tanggal Absen</TableHead>
                    <TableHead>Jadwal</TableHead>
                    <TableHead>Detail Siswa & Alasan</TableHead>
                    <TableHead>Status Banding</TableHead>
                    <TableHead>Respon Guru</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bandingList.map((banding) => (
                    <TableRow key={banding.id_banding} className="hover:bg-muted">
                      <TableCell>
                        <div className="text-sm font-medium">
                          {formatDateWIB(banding.tanggal_pengajuan)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime24(banding.tanggal_pengajuan)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {formatDateWIB(banding.tanggal_absen)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {banding.jam_mulai}-{banding.jam_selesai}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{banding.nama_mapel}</div>
                          <div className="text-xs text-muted-foreground">
                            {banding.nama_guru}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {banding.nama_kelas}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">
                              {banding.nama_siswa}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">NIS: {banding.nis}</span>
                              {renderStatusPair(banding.status_asli, banding.status_diajukan)}
                            </div>
                            <div className="text-muted-foreground">
                              {banding.alasan_banding}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                       <TableCell>
                         <Badge className={getBandingStatusClass(banding.status_banding)}>
                           {getBandingStatusLabel(banding.status_banding)}
                         </Badge>
                        {banding.tanggal_keputusan && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDateWIB(banding.tanggal_keputusan)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {banding.catatan_guru ? (
                            <div className="text-sm bg-muted p-2 rounded border-l-2 border-border">
                              <div className="font-medium text-foreground mb-1">Respon Guru:</div>
                              <div className="text-muted-foreground break-words">{banding.catatan_guru}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Belum ada respon</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {banding.status_banding === 'pending' ? (
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Setujui
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md mx-auto">
                                <DialogHeader>
                                  <DialogTitle>Setujui Banding Absen</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Banding dari: <strong>{banding.nama_siswa}</strong></p>
                                    <div className="text-sm text-muted-foreground">Status:</div>
                                    {renderStatusPair(banding.status_asli, banding.status_diajukan)}
                                    <p className="text-sm text-muted-foreground">Tanggal: {formatDateWIB(banding.tanggal_absen)}</p>
                                  </div>
                                  <Textarea 
                                    placeholder="Catatan persetujuan (opsional)" 
                                    id={`approve-banding-${banding.id_banding}`}
                                  />
                                   <Button 
                                     onClick={() => {
                                       const textarea = getTextareaElement(`approve-banding-${banding.id_banding}`);
                                       if (textarea) {
                                         handleBandingResponse(banding.id_banding, 'disetujui', textarea.value);
                                       }
                                     }}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                  >
                                    Setujui Banding Absen
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <X className="w-4 h-4 mr-1" />
                                  Tolak
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md mx-auto">
                                <DialogHeader>
                                  <DialogTitle>Tolak Banding Absen</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Banding dari: <strong>{banding.nama_siswa}</strong></p>
                                    <div className="text-sm text-muted-foreground">Status:</div>
                                    {renderStatusPair(banding.status_asli, banding.status_diajukan)}
                                  </div>
                                  <Textarea 
                                    placeholder="Alasan penolakan (wajib)" 
                                    id={`reject-banding-${banding.id_banding}`}
                                    required
                                  />
                                   <Button 
                                     onClick={() => {
                                       const textarea = getTextareaElement(`reject-banding-${banding.id_banding}`);
                                       if (textarea && textarea.value.trim()) {
                                         handleBandingResponse(banding.id_banding, 'ditolak', textarea.value);
                                       } else if (!textarea) {
                                         toast({ title: "Error", description: "Form error, please reload", variant: "destructive" });
                                       } else {
                                         toast({ title: "Error", description: "Alasan penolakan harus diisi", variant: "destructive" });
                                       }
                                    }}
                                    variant="destructive"
                                    className="w-full"
                                  >
                                    Tolak Banding Absen
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="text-xs"
                          >
                            Sudah Diproses
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {bandingList.map((banding) => (
                <Card key={banding.id_banding} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    {/* Header dengan status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground text-sm">
                          {banding.nama_siswa}
                        </h3>
                        <p className="text-xs text-muted-foreground">NIS: {banding.nis}</p>
                      </div>
                       <Badge className={getBandingStatusClass(banding.status_banding)}>
                         {getBandingStatusLabel(banding.status_banding)}
                       </Badge>
                    </div>

                    {/* Informasi tanggal dan jadwal */}
                    <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                      <div>
                        <p className="font-medium text-foreground">Tanggal Pengajuan</p>
                        <p className="text-muted-foreground">{formatDateWIB(banding.tanggal_pengajuan)}</p>
                        <p className="text-muted-foreground">{formatTime24(banding.tanggal_pengajuan)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Tanggal Absen</p>
                        <p className="text-muted-foreground">{formatDateWIB(banding.tanggal_absen)}</p>
                        <p className="text-muted-foreground">{banding.jam_mulai}-{banding.jam_selesai}</p>
                      </div>
                    </div>

                    {/* Jadwal dan kelas */}
                    <div className="mb-3">
                      <p className="font-medium text-foreground text-xs mb-1">Jadwal</p>
                      <p className="text-sm font-medium text-foreground">{banding.nama_mapel}</p>
                      <p className="text-xs text-muted-foreground">{banding.nama_guru}</p>
                      <p className="text-xs text-muted-foreground">{banding.nama_kelas}</p>
                    </div>

                    {/* Status perubahan */}
                    <div className="mb-3">
                      <p className="font-medium text-foreground text-xs mb-1">Perubahan Status</p>
                      {renderStatusPair(banding.status_asli, banding.status_diajukan)}
                    </div>

                    {/* Alasan banding */}
                    <div className="mb-3">
                      <p className="font-medium text-foreground text-xs mb-1">Alasan Banding</p>
                      <p className="text-sm text-muted-foreground bg-muted p-2 rounded text-xs">
                        {banding.alasan_banding}
                      </p>
                    </div>

                    {/* Respon guru */}
                    {banding.catatan_guru && (
                      <div className="mb-3">
                        <p className="font-medium text-foreground text-xs mb-1">Respon Guru</p>
                        <div className="text-sm bg-blue-500/10 dark:bg-blue-500/20 p-2 rounded border-l-2 border-blue-500/30">
                          <div className="text-muted-foreground text-xs">{banding.catatan_guru}</div>
                        </div>
                        {banding.tanggal_keputusan && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Diproses: {formatDateWIB(banding.tanggal_keputusan)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Tombol aksi untuk mobile */}
                    <div className="pt-3 border-t">
                      {banding.status_banding === 'pending' ? (
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 flex-1">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Setujui
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm mx-auto">
                              <DialogHeader>
                                <DialogTitle className="text-base">Setujui Banding Absen</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="text-sm">
                                  <p className="text-muted-foreground mb-1">Banding dari: <strong>{banding.nama_siswa}</strong></p>
                                  <div className="text-muted-foreground text-sm">Status:</div>
                                  {renderStatusPair(banding.status_asli, banding.status_diajukan)}
                                  <p className="text-muted-foreground">Tanggal: {formatDateWIB(banding.tanggal_absen)}</p>
                                </div>
                                <Textarea 
                                  placeholder="Catatan persetujuan (opsional)" 
                                  id={`approve-banding-mobile-${banding.id_banding}`}
                                  className="text-sm"
                                />
                                <Button 
                                  onClick={() => {
                                    const textarea = getTextareaElement(`approve-banding-mobile-${banding.id_banding}`);
                                    if (textarea) {
                                      handleBandingResponse(banding.id_banding, 'disetujui', textarea.value);
                                    }
                                  }}
                                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                                >
                                  Setujui Banding Absen
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="destructive" className="flex-1">
                                <X className="w-4 h-4 mr-1" />
                                Tolak
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm mx-auto">
                              <DialogHeader>
                                <DialogTitle className="text-base">Tolak Banding Absen</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="text-sm">
                                  <p className="text-muted-foreground mb-1">Banding dari: <strong>{banding.nama_siswa}</strong></p>
                                  <div className="text-muted-foreground text-sm">Status:</div>
                                  {renderStatusPair(banding.status_asli, banding.status_diajukan)}
                                </div>
                                <Textarea 
                                  placeholder="Alasan penolakan (wajib)" 
                                  id={`reject-banding-mobile-${banding.id_banding}`}
                                  required
                                  className="text-sm"
                                />
                                 <Button 
                                   onClick={() => {
                                     const textarea = getTextareaElement(`reject-banding-mobile-${banding.id_banding}`);
                                     if (textarea && textarea.value.trim()) {
                                       handleBandingResponse(banding.id_banding, 'ditolak', textarea.value);
                                     } else if (!textarea) {
                                       toast({ title: "Error", description: "Form error, please reload", variant: "destructive" });
                                     } else {
                                       toast({ title: "Error", description: "Alasan penolakan harus diisi", variant: "destructive" });
                                     }
                                  }}
                                  variant="destructive"
                                  className="w-full"
                                >
                                  Tolak Banding Absen
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="w-full text-xs"
                        >
                          Sudah Diproses
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
        
        {/* Pagination */}
        {!loading && bandingList.length > 0 && totalPages > 1 && (
          <div className="mt-6 pt-4 border-t">
            {/* Mobile Pagination */}
            <div className="lg:hidden">
              <div className="flex flex-col gap-3">
                <div className="text-center text-sm text-muted-foreground">
                  Halaman {currentPage} dari {totalPages}
                  <div className="text-xs text-muted-foreground mt-1">
                    {filterPending ? `${totalPending} belum di-acc` : `${totalAll} total`}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="flex-1 max-w-[120px]"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    <span className="hidden xs:inline">Sebelumnya</span>
                    <span className="xs:hidden">Prev</span>
                  </Button>
                  
                  {/* Page numbers - simplified for mobile */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage <= 2) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 1) {
                        pageNum = totalPages - 2 + i;
                      } else {
                        pageNum = currentPage - 1 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-8 h-8 p-0 ${currentPage === pageNum ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="flex-1 max-w-[120px]"
                  >
                    <span className="hidden xs:inline">Selanjutnya</span>
                    <span className="xs:hidden">Next</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Desktop Pagination */}
            <div className="hidden lg:flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Halaman {currentPage} dari {totalPages} 
                {filterPending ? ` (${totalPending} belum di-acc)` : ` (${totalAll} total)`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Sebelumnya
                </Button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className={currentPage === pageNum ? "bg-blue-600 hover:bg-blue-700" : ""}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Selanjutnya
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
