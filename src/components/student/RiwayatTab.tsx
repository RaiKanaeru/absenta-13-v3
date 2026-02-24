import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Users, Eye, X, CheckCircle2 } from 'lucide-react';
import { formatDateOnly } from '@/lib/time-utils';
import { getAttendanceBadgeClass as getAttendanceStatusBadgeClass } from '@/utils/statusMaps';
import { Pagination, StudentStatusBadge } from './StudentDashboardComponents';
import type { RiwayatData, RiwayatJadwal } from '@/types/student';

// =============================================================================
// PROPS
// =============================================================================

export interface RiwayatTabProps {
  riwayatData: RiwayatData[];
  riwayatPage: number;
  setRiwayatPage: (page: number) => void;
  detailRiwayat: RiwayatJadwal | null;
  setDetailRiwayat: (detail: RiwayatJadwal | null) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RIWAYAT_ITEMS_PER_PAGE = 5;

// =============================================================================
// HELPERS
// =============================================================================

/** De-duplicate jadwal by composite key */
function deduplicateJadwal(jadwalList: RiwayatJadwal[]): RiwayatJadwal[] {
  const seen = new Set<string>();
  return jadwalList.filter((jadwal) => {
    const key = `${jadwal.jadwal_id}-${jadwal.jam_ke}-${jadwal.jam_mulai}-${jadwal.jam_selesai}-${jadwal.nama_mapel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

export const RiwayatTab: React.FC<RiwayatTabProps> = ({
  riwayatData,
  riwayatPage,
  setRiwayatPage,
  detailRiwayat,
  setDetailRiwayat,
}) => {
  if (riwayatData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 sm:p-12 text-center">
          <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Belum Ada Riwayat</h3>
          <p className="text-sm sm:text-base text-muted-foreground">Riwayat kehadiran kelas akan muncul setelah ada data absensi.</p>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(riwayatData.length / RIWAYAT_ITEMS_PER_PAGE);
  const paginatedData = riwayatData.slice(
    (riwayatPage - 1) * RIWAYAT_ITEMS_PER_PAGE,
    riwayatPage * RIWAYAT_ITEMS_PER_PAGE,
  );

  const getJadwalKey = (hariTanggal: string, jadwal: RiwayatJadwal): string => {
    const jadwalId = jadwal.id_jadwal ?? `${jadwal.jam_ke}-${jadwal.jam_mulai}-${jadwal.jam_selesai}`;
    return `${hariTanggal}-${jadwalId}`;
  };

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Header yang mobile responsive */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <p className="text-blue-800 font-medium text-sm sm:text-base">Riwayat Kehadiran Kelas</p>
          </div>
          <p className="text-blue-700 text-xs sm:text-sm">Sebagai perwakilan kelas, Anda dapat melihat ringkasan kehadiran seluruh siswa</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm text-blue-600 font-medium">
              {riwayatData.length} hari riwayat
            </div>
            <div className="text-xs text-blue-500">
              Halaman {riwayatPage} dari {totalPages}
            </div>
          </div>
        </div>
      </div>

      {/* Card layout untuk mobile */}
      <div className="block lg:hidden">
        {paginatedData.map((hari) => {
          const uniqueJadwal = deduplicateJadwal(hari.jadwal);
          return (
            <Card key={hari.tanggal} className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="w-4 h-4" />
                  {formatDateOnly(hari.tanggal)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {uniqueJadwal.map((jadwal) => (
                  <div key={getJadwalKey(hari.tanggal, jadwal)} className="border rounded-lg p-3 space-y-3">
                    {/* Header jadwal */}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">Jam ke-{jadwal.jam_ke}</Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setDetailRiwayat(jadwal)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Detail
                      </Button>
                    </div>
                    
                    {/* Informasi mata pelajaran */}
                    <div>
                      <h4 className="font-medium text-sm mb-1">{jadwal.nama_mapel}</h4>
                      <p className="text-xs text-muted-foreground">{jadwal.jam_mulai} - {jadwal.jam_selesai}</p>
                    </div>
                    
                    {/* Informasi guru */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Guru:</p>
                      <p className="text-sm font-medium">{jadwal.nama_guru}</p>
                      {!!jadwal.is_multi_guru && jadwal.guru_list && jadwal.guru_list.length > 0 && (
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-xs mb-2">
                            <Users className="w-3 h-3 mr-1" />
                            Multi-Guru ({jadwal.guru_list.length})
                          </Badge>
                          <div className="space-y-1">
                            {jadwal.guru_list.map((guru) => (
                              <div key={`guru-multi-${guru.id_guru}-${guru.nama_guru}`} className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${getAttendanceStatusBadgeClass(guru.status_kehadiran)}`}
                                >
                                  {guru.nama_guru}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {guru.status_kehadiran || 'Belum'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Ruangan */}
                    {jadwal.kode_ruang && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Ruangan:</p>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-xs w-fit">
                            {jadwal.kode_ruang}
                          </Badge>
                          {jadwal.nama_ruang && (
                            <span className="text-xs text-muted-foreground">
                              {jadwal.nama_ruang}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Statistik kehadiran */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Total Hadir:</p>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          {jadwal.total_hadir}/{jadwal.total_siswa}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Tidak Hadir:</p>
                        <div className="flex flex-wrap gap-1">
                          {jadwal.total_izin > 0 && (
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                              Izin: {jadwal.total_izin}
                            </Badge>
                          )}
                          {jadwal.total_sakit > 0 && (
                            <Badge className="bg-blue-100 text-blue-800 text-xs">
                              Sakit: {jadwal.total_sakit}
                            </Badge>
                          )}
                          {jadwal.total_alpa > 0 && (
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              Alpa: {jadwal.total_alpa}
                            </Badge>
                          )}
                          {jadwal.total_tidak_hadir > 0 && (
                            <Badge className="bg-muted text-muted-foreground text-xs">
                              Tidak Hadir: {jadwal.total_tidak_hadir}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabel untuk desktop */}
      <div className="hidden lg:block">
        {paginatedData.map((hari) => {
          const uniqueJadwal = deduplicateJadwal(hari.jadwal);
          return (
            <Card key={hari.tanggal}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {formatDateOnly(hari.tanggal)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-w-full">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap w-20">Jam Ke</TableHead>
                        <TableHead className="whitespace-nowrap w-24">Waktu</TableHead>
                        <TableHead className="whitespace-nowrap w-32">Mata Pelajaran</TableHead>
                        <TableHead className="whitespace-nowrap w-28">Guru</TableHead>
                        <TableHead className="whitespace-nowrap w-20">Ruangan</TableHead>
                        <TableHead className="whitespace-nowrap w-24">Total Hadir</TableHead>
                        <TableHead className="whitespace-nowrap w-28">Tidak Hadir</TableHead>
                        <TableHead className="whitespace-nowrap w-20">Detail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uniqueJadwal.map((jadwal) => (
                        <TableRow key={getJadwalKey(hari.tanggal, jadwal)}>
                          <TableCell>
                            <Badge variant="outline">Jam ke-{jadwal.jam_ke}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm whitespace-nowrap">{jadwal.jam_mulai} - {jadwal.jam_selesai}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium block max-w-[120px] truncate text-xs" title={jadwal.nama_mapel}>{jadwal.nama_mapel}</span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <span className="block max-w-[100px] truncate text-xs" title={jadwal.nama_guru}>{jadwal.nama_guru}</span>
                              {!!jadwal.is_multi_guru && jadwal.guru_list && jadwal.guru_list.length > 0 && (
                                <div className="space-y-1">
                                  <div className="flex flex-wrap gap-1">
                                    <Badge variant="secondary" className="text-xs">
                                      <Users className="w-3 h-3 mr-1" />
                                      Multi-Guru ({jadwal.guru_list.length})
                                    </Badge>
                                  </div>
                                  <div className="space-y-1">
                                    {jadwal.guru_list.map((guru) => (
                                      <div key={`guru-table-${guru.id_guru}-${guru.nama_guru}`} className="flex items-center gap-2">
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${getAttendanceStatusBadgeClass(guru.status_kehadiran)}`}
                                        >
                                          {guru.nama_guru}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {guru.status_kehadiran || 'Belum'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {jadwal.kode_ruang ? (
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className="text-xs w-fit">
                                  {jadwal.kode_ruang}
                                </Badge>
                                {jadwal.nama_ruang && (
                                  <span className="text-xs text-muted-foreground max-w-[80px] truncate" title={jadwal.nama_ruang}>
                                    {jadwal.nama_ruang}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-100 text-green-800">
                                {jadwal.total_hadir}/{jadwal.total_siswa}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {jadwal.total_izin > 0 && (
                                <Badge className="bg-yellow-100 text-yellow-800 text-xs w-fit">
                                  I:{jadwal.total_izin}
                                </Badge>
                              )}
                              {jadwal.total_sakit > 0 && (
                                <Badge className="bg-blue-100 text-blue-800 text-xs w-fit">
                                  S:{jadwal.total_sakit}
                                </Badge>
                              )}
                              {jadwal.total_alpa > 0 && (
                                <Badge className="bg-red-100 text-red-800 text-xs w-fit">
                                  A:{jadwal.total_alpa}
                                </Badge>
                              )}
                              {jadwal.total_tidak_hadir > 0 && (
                                <Badge className="bg-muted text-muted-foreground text-xs w-fit">
                                  TH:{jadwal.total_tidak_hadir}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setDetailRiwayat(jadwal)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Detail
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination Card untuk Riwayat */}
      {riwayatData.length > 0 && totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <Pagination
              currentPage={riwayatPage}
              totalPages={totalPages}
              onPageChange={setRiwayatPage}
            />
          </CardContent>
        </Card>
      )}

      {/* Modal Detail Riwayat - Mobile Responsive */}
      {detailRiwayat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1 sm:p-4">
          <div className="bg-card rounded-lg p-3 sm:p-6 max-w-2xl w-full max-h-[95vh] sm:max-h-[80vh] overflow-y-auto mx-2 sm:mx-0">
            <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2 sm:gap-3">
              <h3 className="text-sm sm:text-lg font-semibold leading-tight flex-1 min-w-0">
                Detail Kehadiran - Jam ke-{detailRiwayat.jam_ke}
              </h3>
              <Button 
                variant="ghost" 
                size="sm"
                className="flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 p-0"
                onClick={() => setDetailRiwayat(null)}
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
            
            <div className="mb-3 sm:mb-4 space-y-2">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3">
                <p className="text-xs sm:text-sm text-foreground">
                  <span className="font-medium block sm:inline">{detailRiwayat.nama_mapel}</span>
                  <span className="text-xs text-muted-foreground block sm:inline sm:ml-2">
                    {detailRiwayat.jam_mulai} - {detailRiwayat.jam_selesai}
                  </span>
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  <span className="font-medium">Guru:</span> {detailRiwayat.nama_guru}
                </p>
              </div>
            </div>

            {detailRiwayat.siswa_tidak_hadir && Array.isArray(detailRiwayat.siswa_tidak_hadir) && detailRiwayat.siswa_tidak_hadir.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                <h4 className="font-medium text-xs sm:text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Siswa Tidak Hadir ({detailRiwayat.siswa_tidak_hadir.length})
                </h4>
                <div className="space-y-2 max-h-48 sm:max-h-60 overflow-y-auto">
                  {detailRiwayat.siswa_tidak_hadir.map((siswa, idx) => {
                    const namaSiswa = siswa.nama_siswa || 'Nama tidak tersedia';
                    const nisSiswa = siswa.nis || 'NIS tidak tersedia';
                    const statusSiswa = siswa.status || 'Status tidak tersedia';
                    
                    return (
                      <div key={`siswa-${siswa.nis || siswa.nama_siswa}-${idx}`} className="border rounded-lg p-2 sm:p-3 space-y-2 bg-muted">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-xs sm:text-sm truncate">
                                {namaSiswa}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                NIS: {nisSiswa}
                              </p>
                            </div>
                            <StudentStatusBadge status={statusSiswa} />
                          </div>
                          {siswa.keterangan && (
                            <div className="pt-1 border-t border-border">
                              <p className="text-xs text-muted-foreground break-words">
                                <span className="font-medium">Keterangan:</span> {siswa.keterangan}
                              </p>
                            </div>
                          )}
                          {siswa.nama_pencatat && (
                            <p className="text-xs text-muted-foreground">
                              Dicatat oleh: {siswa.nama_pencatat}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 sm:py-8">
                <CheckCircle2 className="w-8 h-8 sm:w-12 sm:h-12 mx-auto text-green-500 mb-2" />
                <p className="text-green-600 font-medium text-xs sm:text-base">Semua siswa hadir</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
