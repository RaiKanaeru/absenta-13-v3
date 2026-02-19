import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw, Clock, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateWIB, formatTime24 } from '@/lib/time-utils';
import { getErrorMessage } from '@/lib/utils';
import { getBandingStatusInteractiveClass as getBandingStatusClass, getBandingStatusLabel } from '@/utils/statusMaps';
import type { BandingAbsen, BandingStatusAsli, BandingStatusDiajukan } from './types';

// Re-export so existing consumers don't break
export type { BandingAbsen, BandingStatusAsli, BandingStatusDiajukan };

// Types extracted/adapted from parent
export interface EmptyScheduleViewProps {
  isEditMode: boolean;
  onRefresh: () => void;
}



// Renamed for clarity: This is just the empty state card
export const EmptyScheduleCard: React.FC<{ isEditMode: boolean; onRefresh: () => void }> = ({ isEditMode, onRefresh }) => (
  <Card>
    <CardContent className="p-6 sm:p-12 text-center">
      <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Tidak Ada Jadwal Hari Ini</h3>
      <p className="text-sm sm:text-base text-muted-foreground mb-4">
        Selamat beristirahat! Tidak ada mata pelajaran yang terjadwal untuk hari ini.
      </p>
      {!isEditMode && (
        <p className="text-xs sm:text-sm text-muted-foreground mb-4">
          Gunakan tombol "Edit Absen (30 Hari)" di atas untuk melihat jadwal hari lain.
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button 
          variant="outline" 
          onClick={onRefresh}
          className="flex items-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Jadwal
        </Button>
      </div>
    </CardContent>
  </Card>
);

interface EditModeHeaderProps {
  isEditMode: boolean;
  kelasInfo: string;
}

export const EditModeHeader: React.FC<EditModeHeaderProps> = ({ isEditMode, kelasInfo }) => (
  <CardHeader className="pb-3">
    <div className="flex flex-col gap-4">
      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
        <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="truncate">
          {isEditMode ? 'Edit Absen Guru' : 'Jadwal Hari Ini'} - {kelasInfo}
        </span>
      </CardTitle>
    </div>
  </CardHeader>
);

interface StudentStatusBadgeProps {
  status: string;
  className?: string;
}

export const StudentStatusBadge: React.FC<StudentStatusBadgeProps> = ({ status, className }) => {
  const getVariant = (s: string) => {
    switch(s?.toLowerCase()) {
      case 'hadir': return 'default'; // primary
      case 'izin': return 'secondary';
      case 'sakit': return 'outline';
      case 'alpa': return 'destructive';
      case 'dispen': return 'secondary'; // or custom
      default: return 'outline';
    }
  };

  return (
    <Badge 
      variant={getVariant(status)}
      className={`capitalize text-xs flex-shrink-0 w-fit ${className || ''}`}
    >
      {status || 'Unknown'}
    </Badge>
  );
};

interface BandingGuruResponseProps {
  catatanGuru?: string;
}

const BandingGuruResponse: React.FC<BandingGuruResponseProps> = ({ catatanGuru }) => {
  if (!catatanGuru) {
    return <span className="text-muted-foreground text-sm">Belum ada respon</span>;
  }
  
  return (
    <div className="text-sm bg-muted p-2 rounded border-l-2 border-border">
      <div className="font-medium text-foreground mb-1">Respon Guru:</div>
      <div className="text-muted-foreground break-words">{catatanGuru}</div>
    </div>
  );
};

const getDetailButtonLabel = (isExpanded: boolean): string => {
  return isExpanded ? 'Tutup Detail' : 'Lihat Detail';
};

export interface BandingItemProps {
  banding: {
    id_banding: number | string;
    tanggal_pengajuan: string;
    status_banding: string;
    nama_siswa?: string;
    alasan_banding: string;
    catatan_guru?: string;
    status_asli?: string;
    status_diajukan?: string;
    tanggal_absen?: string;
    jam_mulai?: string;
    jam_selesai?: string;
    nama_mapel?: string;
    nama_guru?: string;
    nama_kelas?: string;
  };
  isExpanded: boolean;
  onToggle: () => void;
}

export const BandingCardItem: React.FC<BandingItemProps> = ({ banding, isExpanded, onToggle }) => {
  const statusLabel = getBandingStatusLabel(banding.status_banding);


  return (
    <Card className="border-l-4 border-l-orange-500 mb-4">
      <CardContent className="p-4 space-y-3">
        {/* Header dengan tanggal */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">
              {formatDateWIB(banding.tanggal_pengajuan)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatTime24(banding.tanggal_pengajuan)}
            </div>
          </div>
          <Badge className={getBandingStatusClass(banding.status_banding)}>
            {statusLabel}
          </Badge>
        </div>

        {/* Informasi jadwal (Mobile View) */}
        <div className="bg-muted rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{formatDateWIB(banding.tanggal_absen || '')}</span>
            <span className="text-xs text-muted-foreground">({banding.jam_mulai}-{banding.jam_selesai})</span>
            </div>
            <div className="text-sm">
            <div className="font-medium">{banding.nama_mapel}</div>
            <div className="text-muted-foreground">{banding.nama_guru}</div>
            <div className="text-xs text-muted-foreground">{banding.nama_kelas}</div>
            </div>
        </div>

        {/* Detail Siswa & Toggle */}
        <div className="space-y-2">
            <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
                {banding.nama_siswa || 'Siswa Individual'}
            </span>
            <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="h-6 w-6 p-0"
            >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            </div>
            <div className="flex items-center gap-2">
            <Badge 
                variant="outline" 
                className="text-xs px-1 py-0"
            >
                {banding.status_asli} → {banding.status_diajukan}
            </Badge>
            </div>
        </div>

        {/* Respon guru */}
        {banding.catatan_guru && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Respon Guru:</div>
            <div className="text-xs text-blue-600 dark:text-blue-300 break-words">{banding.catatan_guru}</div>
            </div>
        )}

        {/* Expanded Detail */}
        {isExpanded && (
            <div className="border-t pt-3 space-y-3">
            <div className="bg-card rounded-lg border p-3">
                <h4 className="font-semibold text-foreground mb-3 text-sm">Detail Siswa Banding</h4>
                
                <div className="grid grid-cols-1 gap-3">
                <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Nama Siswa</div>
                    <div className="text-sm text-foreground">
                    {banding.nama_siswa || 'Siswa Individual'}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Status Tercatat</div>
                    <div className="text-sm text-foreground capitalize">{banding.status_asli}</div>
                    </div>
                    <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Status Diajukan</div>
                    <div className="text-sm text-foreground capitalize">{banding.status_diajukan}</div>
                    </div>
                </div>
                <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Alasan</div>
                    <div className="text-sm text-foreground">{banding.alasan_banding}</div>
                </div>
                </div>
            </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
};

// =============================================================================
// NEW: BandingList and Dependencies for Refactoring
// =============================================================================

// BandingAbsen, BandingStatusAsli, BandingStatusDiajukan are imported from ./types
// and re-exported above to preserve backward compatibility.

export const Pagination = React.memo(({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void; }) => {
  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
        range.push(i);
    }

    if (currentPage - delta > 2) {
        rangeWithDots.push(1, '...');
    } else {
        rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
        rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
        rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (totalPages <= 1 || totalPages === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-x-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2 mt-4 sm:mt-6 min-w-0">
        <div className="flex sm:hidden items-center gap-2 w-full justify-between px-2">
            <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center h-9 px-3 text-xs min-w-0 flex-shrink-0"
            >
            <ChevronLeft className="w-3 h-3 mr-1" />
            <span className="text-xs">Sebelumnya</span>
            </Button>
            
            <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
                {currentPage}/{totalPages}
            </span>
            </div>
            
            <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center h-9 px-3 text-xs min-w-0 flex-shrink-0"
            >
            <span className="text-xs">Selanjutnya</span>
            <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
        </div>

        <div className="hidden sm:flex items-center space-x-1 min-w-0">
            <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center h-8 px-2 text-xs"
            >
            <ChevronLeft className="w-3 h-3 mr-1" />
            <span className="text-xs">Sebelumnya</span>
            </Button>
            
            <div className="flex items-center space-x-1 overflow-x-auto">
            {getVisiblePages().map((page) => (
                <Button
                key={`page-${page}`}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => typeof page === 'number' && onPageChange(page)}
                disabled={page === '...'}
                className="w-8 h-8 p-0 text-xs min-w-8"
                >
                {page}
                </Button>
            ))}
            </div>
            
            <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center h-8 px-2 text-xs"
            >
            <span className="text-xs">Selanjutnya</span>
            <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
        </div>
        </div>
    </div>
  );
});

export const BandingList: React.FC<{
  bandingAbsen: BandingAbsen[];
  expandedBanding: number | null;
  setExpandedBanding: (id: number | null) => void;
  bandingAbsenPage: number;
  setBandingAbsenPage: (page: number) => void;
  itemsPerPage: number;
}> = ({ bandingAbsen, expandedBanding, setExpandedBanding, bandingAbsenPage, setBandingAbsenPage, itemsPerPage }) => {

  // Logic from original code for deduplication
  const uniqueBandingAbsen = bandingAbsen.filter((banding, index, self) => {
    const key = `${banding.id_banding}-${banding.tanggal_pengajuan}-${banding.siswa_id}`;
    return self.findIndex(b => 
      `${b.id_banding}-${b.tanggal_pengajuan}-${b.siswa_id}` === key
    ) === index;
  });
  
  const currentItems = uniqueBandingAbsen.slice(
      (bandingAbsenPage - 1) * itemsPerPage, 
      bandingAbsenPage * itemsPerPage
  );

  return (
    <div className="space-y-4">
        {/* Mobile View */}
        <div className="lg:hidden space-y-4">
             {currentItems.map((banding) => (
                <BandingCardItem 
                  key={banding.id_banding} 
                  banding={banding} 
                  isExpanded={expandedBanding === banding.id_banding}
                  onToggle={() => setExpandedBanding(expandedBanding === banding.id_banding ? null : banding.id_banding)}
                />
              ))}
              <Pagination
                currentPage={bandingAbsenPage}
                totalPages={Math.ceil(uniqueBandingAbsen.length / itemsPerPage)}
                onPageChange={setBandingAbsenPage}
              />
        </div>

        {/* Desktop View */}
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
               {currentItems.map((banding) => (
                 <React.Fragment key={banding.id_banding}>
                 <TableRow>
                    <TableCell>
                      <div className="font-medium">{formatDateWIB(banding.tanggal_pengajuan)}</div>
                      <div className="text-xs text-muted-foreground">{formatTime24(banding.tanggal_pengajuan)}</div>
                    </TableCell>
                    <TableCell>
                       <div>{formatDateWIB(banding.tanggal_absen)}</div>
                       <div className="text-xs text-muted-foreground">{banding.jam_mulai}-{banding.jam_selesai}</div>
                    </TableCell>
                    <TableCell>
                        <div className="text-sm">
                        <div className="font-medium">{banding.nama_mapel}</div>
                        <div className="text-muted-foreground">{banding.nama_guru}</div>
                        <div className="text-xs text-muted-foreground">{banding.nama_kelas}</div>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="max-w-xs space-y-1">
                        <div className="text-sm font-medium">{banding.nama_siswa || 'Siswa Individual'}</div>
                        <div className="flex items-center gap-1 text-xs">
                            <Badge variant="outline" className="px-1 py-0">{banding.status_asli}</Badge>
                            <span>→</span>
                            <Badge variant="outline" className="px-1 py-0">{banding.status_diajukan}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground italic truncate max-w-[200px]" title={banding.alasan_banding}>
                            "{banding.alasan_banding}"
                        </p>
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
                        <BandingGuruResponse catatanGuru={banding.catatan_guru} />
                        </div>
                    </TableCell>
                    <TableCell>
                        <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedBanding(
                            expandedBanding === banding.id_banding ? null : banding.id_banding
                        )}
                        className="text-xs"
                        >
                        {getDetailButtonLabel(expandedBanding === banding.id_banding)}
                        </Button>
                    </TableCell>
                 </TableRow>
                  {expandedBanding === banding.id_banding && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/50 p-0">
                        <div className="p-4">
                          <div className="bg-card rounded-lg border p-4">
                            <h4 className="font-semibold text-foreground mb-3">Detail Siswa Banding</h4>
                            <div className="border rounded-lg p-3">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                  <div className="text-sm font-medium text-muted-foreground mb-1">Nama Siswa</div>
                                  <div className="text-sm text-foreground">
                                    {banding.nama_siswa || 'Siswa Individual'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-muted-foreground mb-1">Status Tercatat</div>
                                  <div className="text-sm text-foreground capitalize">{banding.status_asli}</div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-muted-foreground mb-1">Status Diajukan</div>
                                  <div className="text-sm text-foreground capitalize">{banding.status_diajukan}</div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-muted-foreground mb-1">Alasan</div>
                                  <div className="text-sm text-foreground">{banding.alasan_banding}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                 )}
                 </React.Fragment>
               ))}
            </TableBody>
          </Table>
          <Pagination
             currentPage={bandingAbsenPage}
             totalPages={Math.ceil(uniqueBandingAbsen.length / itemsPerPage)}
             onPageChange={setBandingAbsenPage}
          />
        </div>
    </div>
  );
};
