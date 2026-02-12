/**
 * HistoryView - Teacher attendance history view
 * Extracted from TeacherDashboard.tsx - EXACT COPY, no UI changes
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { formatDateWIB, formatDateOnly, formatTime24, toWIBTime } from "@/lib/time-utils";
import { History, ChevronLeft, ChevronRight } from "lucide-react";
import { TeacherUserData, HistoryData, FlatHistoryRow, AttendanceStatus } from "./types";
import { apiCall } from "./apiUtils";

interface HistoryViewProps {
  user: TeacherUserData;
}

export const HistoryView = ({ user }: HistoryViewProps) => {
  const [historyData, setHistoryData] = useState<HistoryData>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDays, setTotalDays] = useState(0);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const limit = 7; // 7 hari kebelakang

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: limit.toString()
        });
        
        const res = await apiCall(`/api/guru/student-attendance-history?${params}`);
        
        let flat: Array<FlatHistoryRow>;
        let totalDaysCount = 0;
        
        if (res && typeof res === 'object' && res.data) {
          flat = res.data;
          totalDaysCount = res.totalDays || 0;
          setTotalPages(res.totalPages || 1);
          setTotalDays(totalDaysCount);
        } else {
          flat = Array.isArray(res) ? res : [];
          const uniqueDates = new Set(flat.map(row => formatDateWIB(row.tanggal)));
          totalDaysCount = uniqueDates.size;
          setTotalPages(Math.ceil(totalDaysCount / limit));
          setTotalDays(totalDaysCount);
        }

        const normalizeStatus = (s: string): AttendanceStatus => {
          const v = (s || '').toLowerCase();
          if (v === 'hadir') return 'Hadir';
          if (v === 'izin') return 'Izin';
          if (v === 'dispen') return 'Dispen';
          if (v === 'sakit') return 'Sakit';
          if (v === 'alpa' || v === 'tidak hadir' || v === 'absen') return 'Alpa';
          return 'Lain';
        };

        const grouped: HistoryData = {};
        flat.forEach((row) => {
          const dateKey = formatDateWIB(row.tanggal);
          if (!grouped[dateKey]) grouped[dateKey] = {};
          const classKey = `${row.nama_mapel} - ${row.nama_kelas}`;
          if (!grouped[dateKey][classKey]) {
            grouped[dateKey][classKey] = {
              kelas: row.nama_kelas,
              mata_pelajaran: row.nama_mapel,
              jam: `${row.jam_mulai} - ${row.jam_selesai}`,
              hari: new Intl.DateTimeFormat('id-ID', { 
                weekday: 'long',
                timeZone: 'Asia/Jakarta'
              }).format(toWIBTime(row.tanggal)),
              jam_ke: row.jam_ke,
              kode_ruang: row.kode_ruang,
              nama_ruang: row.nama_ruang,
              lokasi: row.lokasi,
              status_guru: row.status_guru,
              keterangan_guru: row.keterangan_guru,
              siswa: [],
            };
          }
          grouped[dateKey][classKey].siswa.push({
            nama: row.nama_siswa,
            nis: row.nis,
            status: normalizeStatus(String(row.status_kehadiran)),
            waktu_absen: row.waktu_absen,
            alasan: row.keterangan || undefined,
          });
        });

        setHistoryData(grouped);
      } catch (error) {
        toast({ 
          title: "Error", 
          description: "Gagal memuat riwayat absensi", 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user.guru_id, user.id, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const toggleClassDetail = (classKey: string) => {
    const newExpanded = new Set(expandedClasses);
    if (newExpanded.has(classKey)) {
      newExpanded.delete(classKey);
    } else {
      newExpanded.add(classKey);
    }
    setExpandedClasses(newExpanded);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Riwayat Absensi
          </CardTitle>
          {!loading && totalDays > 0 && (
            <div className="text-xs sm:text-sm text-muted-foreground">
              <div className="sm:hidden">
                {totalDays} hari | {currentPage}/{totalPages}
              </div>
              <div className="hidden sm:block">
                Total: {totalDays} hari | Halaman {currentPage} dari {totalPages}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-muted h-32 rounded"></div>
            ))}
          </div>
        ) : Object.keys(historyData).length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Belum ada riwayat</h3>
            <p className="text-muted-foreground">Riwayat absensi akan muncul setelah Anda mengambil absensi</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(historyData)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([date, classes]) => (
              <div key={date} className="border-b border-border pb-4 last:border-b-0">
                <h4 className="font-medium mb-3">
                  {formatDateOnly(date)}
                </h4>
                <div className="space-y-3">
                  {Object.entries(classes).map(([classKey, classData]) => (
                    <div key={classKey} className="bg-muted/50 rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                            <h5 className="font-medium text-sm sm:text-base">{classData.mata_pelajaran}</h5>
                            <Badge variant="secondary" className="text-xs w-fit">
                              Jam ke-{classData.jam_ke}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{classData.kelas}</p>
                          <p className="text-xs text-muted-foreground">{classData.jam}</p>
                          
                          {classData.nama_ruang && (
                            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-1 text-xs text-muted-foreground">
                              <span className="font-medium">Ruang:</span>
                              <div className="flex flex-wrap items-center gap-1">
                                <span>{classData.nama_ruang}</span>
                                {classData.kode_ruang && (
                                  <span className="text-muted-foreground">({classData.kode_ruang})</span>
                                )}
                                {classData.lokasi && (
                                  <span className="text-muted-foreground">- {classData.lokasi}</span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {classData.status_guru && (
                            <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-1 text-xs">
                              <span className="font-medium text-muted-foreground">Status Guru:</span>
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge
                                  variant={
                                    classData.status_guru === 'hadir' ? 'default' :
                                    classData.status_guru === 'izin' || classData.status_guru === 'sakit' ? 'secondary' :
                                    'destructive'
                                  }
                                  className="text-xs"
                                >
                                  {classData.status_guru.charAt(0).toUpperCase() + classData.status_guru.slice(1)}
                                </Badge>
                                {classData.keterangan_guru && (
                                  <span className="text-muted-foreground">- {classData.keterangan_guru}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                          <Badge variant="outline" className="text-xs">{classData.siswa.length} siswa</Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleClassDetail(`${date}-${classKey}`)}
                            className="text-xs w-full sm:w-auto"
                          >
                            {expandedClasses.has(`${date}-${classKey}`) ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
                          </Button>
                        </div>
                      </div>
                      
                      {expandedClasses.has(`${date}-${classKey}`) && (
                        <div className="mt-4">
                          {/* Desktop Table View */}
                          <div className="hidden sm:block">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nama</TableHead>
                                  <TableHead>NIS</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Waktu Absen</TableHead>
                                  <TableHead>Keterangan</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {classData.siswa.map((siswa, siswaIndex) => (
                                  <TableRow key={siswaIndex}>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">{siswa.nama || 'Nama tidak tersedia'}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-muted-foreground">{siswa.nis || '-'}</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          siswa.status === 'Hadir' ? 'default' :
                                          siswa.status === 'Izin' || siswa.status === 'Sakit' ? 'secondary' :
                                          siswa.status === 'Dispen' ? 'outline' :
                                          'destructive'
                                        }
                                        className={
                                          siswa.status === 'Dispen' ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200' : ''
                                        }
                                      >
                                        {siswa.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {siswa.waktu_absen ? (
                                        <span className="text-sm">
                                          {formatTime24(siswa.waktu_absen)}
                                        </span>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {siswa.alasan ? (
                                        <span className="text-sm text-muted-foreground">{siswa.alasan}</span>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Mobile Card View */}
                          <div className="sm:hidden space-y-2">
                            {classData.siswa.map((siswa, siswaIndex) => (
                              <div key={siswaIndex} className="bg-card border border-border rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{siswa.nama || 'Nama tidak tersedia'}</p>
                                    <p className="text-xs text-muted-foreground">NIS: {siswa.nis || '-'}</p>
                                  </div>
                                  <Badge
                                    variant={
                                      siswa.status === 'Hadir' ? 'default' :
                                      siswa.status === 'Izin' || siswa.status === 'Sakit' ? 'secondary' :
                                      siswa.status === 'Dispen' ? 'outline' :
                                      'destructive'
                                    }
                                    className={`text-xs ${
                                      siswa.status === 'Dispen' ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200' : ''
                                    }`}
                                  >
                                    {siswa.status}
                                  </Badge>
                                </div>
                                <div className="space-y-1">
                                  {siswa.waktu_absen && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span className="font-medium">Waktu:</span>
                                      <span>{formatTime24(siswa.waktu_absen)}</span>
                                    </div>
                                  )}
                                  {siswa.alasan && (
                                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                      <span className="font-medium">Keterangan:</span>
                                      <span className="flex-1">{siswa.alasan}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {!loading && Object.keys(historyData).length > 0 && totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Menampilkan {Object.keys(historyData).length} hari dari {totalDays} total
              </div>
              
              {/* Mobile Pagination */}
              <div className="sm:hidden flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="text-xs"
                >
                  <ChevronLeft className="w-3 h-3" />
                  Prev
                </Button>
                
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
                        className={`text-xs px-2 ${
                          currentPage === pageNum ? "bg-blue-600 hover:bg-blue-700" : ""
                        }`}
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
                  className="text-xs"
                >
                  Next
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>

              {/* Desktop Pagination */}
              <div className="hidden sm:flex items-center gap-2">
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
