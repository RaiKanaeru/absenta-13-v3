/**
 * Guru Attendance Card Component
 * Extracted from StudentDashboard_Modern.tsx to reduce nesting depth (S3776 compliance)
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle2, XCircle, User, BookOpen, AlertCircle } from 'lucide-react';
import { formatDateTime24 } from '@/lib/time-utils';

interface GuruData {
  id_guru: number;
  nama_guru: string;
  nip: string;
  is_primary?: boolean;
  status_kehadiran: string;
  keterangan_guru?: string;
  waktu_absen?: string;
}

interface GuruAttendanceCardProps {
  guru: GuruData;
  jadwalId: number;
  kehadiranStatus: string;
  kehadiranKeterangan: string;
  isUpdating: boolean;
  onStatusChange: (key: string, status: string) => void;
  onKeteranganChange: (key: string, keterangan: string) => void;
}

/**
 * Card component for individual guru attendance in multi-guru schedules
 * Reduces nesting depth by extracting the map item to its own component
 */
export const GuruAttendanceCard: React.FC<GuruAttendanceCardProps> = ({
  guru,
  jadwalId,
  kehadiranStatus,
  kehadiranKeterangan,
  isUpdating,
  onStatusChange,
  onKeteranganChange,
}) => {
  const guruKey = `${jadwalId}-${guru.id_guru}`;
  const currentStatus = kehadiranStatus || guru.status_kehadiran || 'belum_diambil';
  const isSubmitted = guru.status_kehadiran && guru.status_kehadiran !== 'belum_diambil';

  return (
    <div className={`border rounded-lg p-3 sm:p-4 ${isSubmitted ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
      {/* Header: Guru name and status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          <h5 className="font-medium text-foreground text-sm sm:text-base">{guru.nama_guru}</h5>
          {isSubmitted ? (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-600" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          {guru.is_primary && (
            <Badge variant="secondary" className="text-xs">
              Guru Utama
            </Badge>
          )}
          <Badge variant={isSubmitted ? 'default' : 'outline'} className="text-xs">
            {isSubmitted ? 'Sudah Diabsen' : 'Belum Diabsen'}
          </Badge>
        </div>
      </div>

      {/* NIP */}
      <p className="text-xs sm:text-sm text-muted-foreground mb-2">NIP: {guru.nip}</p>

      {/* Waktu absen if exists */}
      {guru.waktu_absen && (
        <p className="text-xs text-muted-foreground mb-2 sm:mb-3">
          Waktu absen: {formatDateTime24(guru.waktu_absen, true)}
        </p>
      )}

      {/* Radio group for status */}
      <RadioGroup 
        value={currentStatus} 
        onValueChange={(value) => onStatusChange(guruKey, value)}
        disabled={!guru.id_guru || guru.id_guru === 0 || isUpdating}
      >
        {isUpdating && (
          <div className="text-xs text-blue-600 flex items-center gap-1 mb-2">
            <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            Menyimpan...
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Hadir" id={`hadir-${guruKey}`} />
            <Label htmlFor={`hadir-${guruKey}`} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Hadir
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Tidak Hadir" id={`tidak_hadir-${guruKey}`} />
            <Label htmlFor={`tidak_hadir-${guruKey}`} className="flex items-center gap-2 text-sm">
              <XCircle className="w-4 h-4 text-red-600" />
              Tidak Hadir
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Izin" id={`izin-${guruKey}`} />
            <Label htmlFor={`izin-${guruKey}`} className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-yellow-600" />
              Izin
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Sakit" id={`sakit-${guruKey}`} />
            <Label htmlFor={`sakit-${guruKey}`} className="flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Sakit
            </Label>
          </div>
        </div>
      </RadioGroup>

      {/* Keterangan textarea - only show for non-Hadir status */}
      {kehadiranStatus && kehadiranStatus !== 'Hadir' && (
        <div className="mt-2 sm:mt-3">
          <Label htmlFor={`keterangan-${guruKey}`} className="text-xs sm:text-sm font-medium text-foreground">
            Keterangan untuk {guru.nama_guru}:
          </Label>
          <Textarea
            id={`keterangan-${guruKey}`}
            placeholder="Masukkan keterangan jika diperlukan..."
            value={kehadiranKeterangan || guru.keterangan_guru || ''}
            onChange={(e) => onKeteranganChange(guruKey, e.target.value)}
            className="mt-1 text-sm"
            rows={2}
          />
        </div>
      )}
    </div>
  );
};
