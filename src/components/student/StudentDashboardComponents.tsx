import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw, Clock, User } from 'lucide-react';
import { formatDateWIB, formatTime24 } from '@/lib/time-utils';

// Types extracted/adapted from parent
export interface EmptyScheduleViewProps {
  isEditMode: boolean;
  onRefresh: () => void;
}

export const EmptyScheduleView: React.FC<EmptyScheduleViewProps> = ({ isEditMode, onRefresh }) => (
  <div className="space-y-4 sm:space-y-6">
    {isEditMode && (
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-sm text-blue-800">
              <p className="font-medium">Mode Edit Absen Aktif</p>
              <p>Anda dapat mengubah absen guru untuk tanggal yang dipilih (maksimal 7 hari yang lalu).</p>
            </div>
          </div>
        </CardHeader>
      </Card>
    )}

    <Card>
      <CardContent className="p-6 sm:p-12 text-center">
        <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Tidak Ada Jadwal Hari Ini</h3>
        <p className="text-sm sm:text-base text-gray-600 mb-4">
          Selamat beristirahat! Tidak ada mata pelajaran yang terjadwal untuk hari ini.
        </p>
        {!isEditMode && (
          <p className="text-xs sm:text-sm text-gray-500 mb-4">
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
  </div>
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
  };
}

export const BandingCardItem: React.FC<BandingItemProps> = ({ banding }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disetujui': return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'ditolak': return 'bg-red-100 text-red-800 hover:bg-red-200';
      default: return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    }
  };

  const statusLabel = 
    banding.status_banding === 'disetujui' ? 'Disetujui' :
    banding.status_banding === 'ditolak' ? 'Ditolak' : 'Menunggu';

  return (
    <Card className="border-l-4 border-l-orange-500 mb-4">
      <CardContent className="p-4 space-y-3">
        {/* Header dengan tanggal */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">
              {formatDateWIB(banding.tanggal_pengajuan)}
            </div>
            <div className="text-xs text-gray-500">
              {formatTime24(banding.tanggal_pengajuan)}
            </div>
          </div>
          <Badge className={getStatusColor(banding.status_banding)}>
            {statusLabel}
          </Badge>
        </div>

        {/* Info Siswa (jika ada) */}
        {banding.nama_siswa && (
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">{banding.nama_siswa}</span>
            </div>
        )}

        {/* Detail Banding */}
        <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2">
            <div>
            <p className="text-xs text-gray-500">Status Awal</p>
            <p className="font-medium capitalize">{banding.status_asli || '-'}</p>
            </div>
            <div>
            <p className="text-xs text-gray-500">Diajukan</p>
            <p className="font-medium capitalize">{banding.status_diajukan || '-'}</p>
            </div>
        </div>

        <div className="text-sm border-t pt-2">
            <p className="text-xs text-gray-500 mb-1">Alasan:</p>
            <p className="text-gray-700 italic">"{banding.alasan_banding}"</p>
        </div>

        {banding.catatan_guru && (
            <div className="text-sm bg-gray-50 p-2 rounded border border-gray-100 mt-2">
            <p className="text-xs text-gray-500 font-semibold mb-1">Catatan Guru:</p>
            <p className="text-gray-700">{banding.catatan_guru}</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
};
