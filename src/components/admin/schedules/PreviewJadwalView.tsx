import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Printer, RefreshCw, Eye } from "lucide-react";
import { useLetterhead } from "@/hooks/useLetterhead";
import { getCurrentDateWIB } from "@/lib/time-utils";
import { getApiUrl } from "@/config/api";
import { Schedule, Kelas } from "@/types/dashboard";

interface PreviewJadwalViewProps {
  onBack: () => void;
  schedules: Schedule[];
  classes: Kelas[];
}

type FilterState = {
  kelas: string;
  hari: string;
};

type DisplayMode = 'matrix' | 'grid';
type ExportType = 'matrix' | 'grid';

type LetterheadLine = {
  text: string;
  fontWeight?: string;
};

type LetterheadData = {
  enabled?: boolean;
  lines?: LetterheadLine[];
  logoLeftUrl?: string;
  logoRightUrl?: string;
  alignment?: string;
} | null | undefined;

const DAYS_OF_WEEK = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const ACTIVITY_LABELS: Record<string, string> = {
  pelajaran: 'Pelajaran',
  upacara: 'Upacara',
  istirahat: 'Istirahat',
  kegiatan_khusus: 'Kegiatan Khusus',
  ujian: 'Ujian'
};

const getActivityLabel = (jenisAktivitas: string): string => ACTIVITY_LABELS[jenisAktivitas] || 'Lainnya';

const getScheduleKey = (schedule: Schedule): string => {
  if (schedule.id) return `schedule-${schedule.id}`;
  return `schedule-${schedule.nama_mapel || schedule.keterangan_khusus || 'unknown'}-${schedule.jam_mulai || '00:00'}-${schedule.jam_selesai || '00:00'}`;
};

const shouldShowMultiGuru = (guruList?: string | null): guruList is string => Boolean(guruList && guruList.includes('||'));

const parseGuruName = (guru: string): string => {
  const parts = guru.split(':');
  return parts.length > 1 ? parts[1] : parts[0];
};

const getAuthToken = (): string => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Token tidak ditemukan');
  }
  return token;
};

const buildFilterParams = (filterState: FilterState): URLSearchParams => {
  const params = new URLSearchParams();
  if (filterState.kelas && filterState.kelas !== 'all') {
    params.append('kelas_id', filterState.kelas);
  }
  if (filterState.hari && filterState.hari !== 'all') {
    params.append('hari', filterState.hari);
  }
  return params;
};

const buildExportEndpoint = (type: ExportType, params: URLSearchParams): string => {
  const route = type === 'matrix' ? 'jadwal-matrix' : 'jadwal-grid';
  return `/api/admin/export/${route}?${params.toString()}`;
};

const extractFilenameFromHeader = (
  contentDisposition: string | null,
  defaultFilename: string
): string => {
  if (!contentDisposition) return defaultFilename;
  const match = /filename="(.+)"/.exec(contentDisposition);
  return match ? match[1] : defaultFilename;
};

const triggerBlobDownload = (blob: Blob, filename: string): void => {
  const url = globalThis.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  globalThis.URL.revokeObjectURL(url);
};

const validateExcelBlob = (blob: Blob): void => {
  if (blob.size === 0) {
    throw new Error('Server mengembalikan file kosong');
  }
  if (!blob.type.includes('spreadsheetml') && !blob.type.includes('excel')) {
    // Non-critical: unexpected blob type, skip silently
  }
};

const MultiGuruDisplay = ({
  guruList,
  className = 'text-xs text-emerald-600 dark:text-emerald-400 mt-1',
  itemClassName = 'text-xs text-emerald-700 dark:text-emerald-300 truncate'
}: {
  guruList: string;
  className?: string;
  itemClassName?: string;
}) => (
  <div className={className}>
    <div className="font-medium">Multi-Guru:</div>
    {guruList.split('||').map((guru) => (
      <div key={`guru-${guru}`} className={itemClassName}>• {parseGuruName(guru)}</div>
    ))}
  </div>
);

const LetterheadPreview = ({ letterhead }: { letterhead: LetterheadData }) => {
  if (!letterhead?.enabled || !letterhead.lines || letterhead.lines.length === 0) {
    return null;
  }

  return (
    <div className="text-center mb-4 lg:mb-6 p-3 lg:p-4 bg-card border-2 border-border">
      {(letterhead.logoLeftUrl || letterhead.logoRightUrl) && (
        <div className="flex justify-between items-center mb-3 lg:mb-4">
          {letterhead.logoLeftUrl && (
            <img
              src={letterhead.logoLeftUrl}
              alt="Logo Kiri"
              className="h-12 lg:h-16 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="flex-1"></div>
          {letterhead.logoRightUrl && (
            <img
              src={letterhead.logoRightUrl}
              alt="Logo Kanan"
              className="h-12 lg:h-16 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>
      )}

      {letterhead.lines.map((line) => (
        <div
          key={`letterhead-line-${line.text || 'empty'}-${line.fontWeight || 'normal'}-${(line.text || '').length}`}
          className={`text-xs lg:text-sm ${line.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}`}
          style={{ textAlign: letterhead.alignment as React.CSSProperties['textAlign'] }}
        >
          {line.text}
        </div>
      ))}

      <div className="text-base lg:text-lg font-bold mt-3 lg:mt-4">JADWAL PELAJARAN</div>
    </div>
  );
};

const EmptyScheduleState = ({
  schedules,
  filter
}: {
  schedules: Schedule[];
  filter: FilterState;
}) => {
  const emptyDescription = schedules.length === 0
    ? 'Belum ada jadwal yang tersedia. Silakan tambahkan jadwal terlebih dahulu.'
    : filter.kelas === 'all' && filter.hari === 'all'
      ? 'Belum ada jadwal yang tersedia'
      : `Tidak ada jadwal untuk ${filter.kelas === 'all' ? 'semua kelas' : `kelas ${filter.kelas}`} pada ${filter.hari === 'all' ? 'semua hari' : `hari ${filter.hari}`}`;

  return (
    <div className="text-center py-12">
      <div className="text-muted-foreground text-6xl mb-4">—</div>
      <h3 className="text-lg font-semibold text-muted-foreground mb-2">Tidak Ada Jadwal</h3>
      <p className="text-muted-foreground mb-4">{emptyDescription}</p>
      {schedules.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Total jadwal tersedia: {schedules.length}</p>
          <Button
            onClick={() => globalThis.location.reload()}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      )}
    </div>
  );
};

const MatrixScheduleCard = ({ schedule }: { schedule: Schedule }) => (
  <div key={getScheduleKey(schedule)} className="mb-1 p-1 bg-primary/10 rounded border border-primary/20">
    <div className="font-semibold text-xs text-primary truncate">{schedule.nama_guru || 'Sistem'}</div>
    <div className="text-xs font-medium text-foreground truncate">{schedule.nama_mapel || schedule.keterangan_khusus}</div>
    <div className="text-muted-foreground text-xs truncate">{schedule.kode_ruang || schedule.nama_ruang || 'Ruang TBD'}</div>
    <div className="text-muted-foreground text-xs font-mono">{schedule.jam_mulai} - {schedule.jam_selesai}</div>
    {shouldShowMultiGuru(schedule.guru_list) && <MultiGuruDisplay guruList={schedule.guru_list} />}
  </div>
);

const ScheduleMatrixTable = ({
  uniqueClassesForDisplay,
  filteredSchedules
}: {
  uniqueClassesForDisplay: string[];
  filteredSchedules: Schedule[];
}) => (
  <div className="overflow-x-auto -mx-4 lg:mx-0">
    <div className="min-w-full px-4 lg:px-0">
      <table className="w-full border-collapse border border-border text-xs lg:text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="border border-border px-2 lg:px-4 py-2 text-left font-semibold sticky left-0 bg-muted z-10 min-w-[80px] lg:min-w-[120px]">KELAS</th>
            {DAYS_OF_WEEK.map((day) => (
              <th key={`day-header-${day}`} className="border border-border px-1 lg:px-4 py-2 text-center font-semibold min-w-[100px] lg:min-w-[150px]">
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.substring(0, 3)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {uniqueClassesForDisplay.map((kelasName) => (
            <tr key={`schedule-class-${kelasName}`}>
              <td className="border border-border px-2 lg:px-4 py-2 font-medium sticky left-0 bg-card z-10 min-w-[80px] lg:min-w-[120px]">
                <span className="hidden sm:inline">{kelasName}</span>
                <span className="sm:hidden text-xs">{kelasName.length > 8 ? `${kelasName.substring(0, 8)}...` : kelasName}</span>
              </td>
              {DAYS_OF_WEEK.map((day) => {
                const daySchedules = filteredSchedules
                  .filter((s) => s.nama_kelas === kelasName && s.hari === day)
                  .sort((a, b) => (a.jam_ke || 0) - (b.jam_ke || 0));

                return (
                  <td key={`day-cell-${day}`} className="border border-border px-1 lg:px-2 py-1 text-xs min-w-[100px] lg:min-w-[150px]">
                    {daySchedules.map((schedule) => (
                      <MatrixScheduleCard key={getScheduleKey(schedule)} schedule={schedule} />
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const GridScheduleItem = ({ schedule }: { schedule: Schedule }) => (
  <div className="border rounded-lg p-3 lg:p-4 hover:bg-muted transition-colors">
    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
      <div className="flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
          <h4 className="font-semibold text-base lg:text-lg">{schedule.nama_kelas}</h4>
          <span className="px-2 py-1 bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs rounded-full w-fit">
            Jam ke-{schedule.jam_ke || 'N/A'}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">{schedule.nama_mapel || schedule.keterangan_khusus}</p>
        <p className="text-sm text-muted-foreground mb-1">Guru: {schedule.nama_guru || 'Sistem'}</p>
        {shouldShowMultiGuru(schedule.guru_list) && (
          <MultiGuruDisplay
            guruList={schedule.guru_list}
            className="text-xs text-emerald-600 dark:text-emerald-400 mb-1"
            itemClassName="text-xs text-emerald-700 dark:text-emerald-300"
          />
        )}
        <p className="text-xs text-muted-foreground">Ruang: {schedule.kode_ruang || schedule.nama_ruang || 'Ruang TBD'}</p>
      </div>
      <div className="flex flex-row lg:flex-col lg:text-right gap-3 lg:gap-0 lg:ml-4">
        <div>
          <p className="font-medium text-base lg:text-lg">{schedule.hari}</p>
          <p className="text-sm text-muted-foreground font-mono">{schedule.jam_mulai} - {schedule.jam_selesai}</p>
        </div>
        <div className="lg:mt-1">
          <p className="text-xs text-muted-foreground">{getActivityLabel(schedule.jenis_aktivitas)}</p>
          {schedule.is_absenable && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Dapat diabsen</p>}
        </div>
      </div>
    </div>
  </div>
);

const ScheduleGridList = ({ filteredSchedules }: { filteredSchedules: Schedule[] }) => (
  <div className="space-y-4">
    {filteredSchedules.map((schedule) => (
      <GridScheduleItem key={schedule.id} schedule={schedule} />
    ))}
  </div>
);

const ExportButton = ({
  onClick,
  isExporting,
  desktopText,
  mobileText
}: {
  onClick: () => void;
  isExporting: boolean;
  desktopText: string;
  mobileText: string;
}) => (
  <Button
    onClick={onClick}
    variant="outline"
    disabled={isExporting}
    size="sm"
    className="w-full sm:w-auto"
  >
    {isExporting ? (
      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-border border-t-blue-600"></div>
    ) : (
      <Download className="w-4 h-4 mr-2" />
    )}
    <span className="hidden sm:inline">{isExporting ? 'Exporting...' : desktopText}</span>
    <span className="sm:hidden">{isExporting ? 'Exporting...' : mobileText}</span>
  </Button>
);

const fetchExportFile = async (type: ExportType, filter: FilterState): Promise<{ blob: Blob; filename: string }> => {
  const params = buildFilterParams(filter);
  const endpoint = buildExportEndpoint(type, params);
  const response = await fetch(getApiUrl(endpoint), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText || 'Export gagal'}`);
  }

  const defaultFilename = `Jadwal_Pelajaran_${type === 'matrix' ? 'Matrix' : 'Grid'}_${getCurrentDateWIB()}.xlsx`;
  const filename = extractFilenameFromHeader(response.headers.get('Content-Disposition'), defaultFilename);
  const blob = await response.blob();
  validateExcelBlob(blob);

  return { blob, filename };
};

export const PreviewJadwalView = ({ onBack, schedules, classes }: PreviewJadwalViewProps) => {
  const [filter, setFilter] = useState<FilterState>({
    kelas: 'all',
    hari: 'all'
  });
  const [displayMode, setDisplayMode] = useState<DisplayMode>('matrix');
  const [isExporting, setIsExporting] = useState(false);
  const { letterhead } = useLetterhead('REPORT_JADWAL_PELAJARAN');

  const filteredSchedules = schedules
    .filter((schedule) => {
      const kelasMatch = filter.kelas === 'all'
        || schedule.kelas_id.toString() === filter.kelas
        || schedule.kelas_id === Number.parseInt(filter.kelas);
      const hariMatch = filter.hari === 'all' || schedule.hari === filter.hari;
      return kelasMatch && hariMatch;
    })
    .sort((a, b) => {
      const dayA = DAYS_OF_WEEK.indexOf(a.hari);
      const dayB = DAYS_OF_WEEK.indexOf(b.hari);
      if (dayA !== dayB) return dayA - dayB;
      return (a.jam_ke || 0) - (b.jam_ke || 0);
    });

  const uniqueClassesForDisplay = Array.from(new Set(filteredSchedules.map((s) => s.nama_kelas)))
    .sort((a, b) => a.localeCompare(b));

  const uniqueClasses = classes.filter((kelas, index, self) => index === self.findIndex((k) => k.id === kelas.id));

  const uniqueGuruCount = new Set(filteredSchedules.map((s) => s.nama_guru)).size;
  const uniqueRuangCount = new Set(filteredSchedules.map((s) => s.kode_ruang).filter(Boolean)).size;
  const uniqueMapelCount = new Set(filteredSchedules.map((s) => s.nama_mapel).filter(Boolean)).size;
  const absenableCount = filteredSchedules.filter((s) => s.is_absenable).length;

  const handleExportExcel = async (type: ExportType) => {
    try {
      setIsExporting(true);
      if (schedules.length === 0) {
        toast({ title: "Tidak Ada Data", description: "Tidak ada jadwal yang tersedia untuk diekspor", variant: "destructive" });
        return;
      }

      toast({ title: "Export Excel", description: `Sedang memproses export ${type}...`, variant: "default" });
      const { blob, filename } = await fetchExportFile(type, filter);
      triggerBlobDownload(blob, filename);
      toast({ title: "Export Berhasil", description: `File ${type} berhasil diunduh`, variant: "default" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Export gagal';
      toast({ title: "Export Gagal", description: `Terjadi kesalahan saat export: ${message}`, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsExporting(true);
      const params = buildFilterParams(filter);
      const printUrl = getApiUrl(`/api/admin/export/jadwal-print?${params.toString()}`);
      const printWindow = globalThis.open(printUrl, '_blank');
      if (!printWindow) {
        throw new Error('Tidak dapat membuka jendela print');
      }

      toast({
        title: "Print Berhasil",
        description: "Jendela print telah dibuka",
        variant: "default"
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Print gagal';
      toast({
        title: "Print Gagal",
        description: `Terjadi kesalahan saat print: ${message}`,
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreviewJadwal = () => {
    toast({
      title: "Preview Jadwal",
      description: `Menampilkan jadwal dengan filter: Kelas ${filter.kelas === 'all' ? 'Semua' : filter.kelas}, Hari ${filter.hari === 'all' ? 'Semua' : filter.hari}`,
      variant: "default"
    });
  };

  const showEmptyState = filteredSchedules.length === 0;
  const showMatrix = displayMode === 'matrix';

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">Preview Jadwal Pelajaran</h1>
            <div className="flex flex-wrap gap-1 lg:gap-2 text-xs lg:text-sm mt-2">
              <span className="px-2 py-1 bg-blue-500/15 text-blue-700 dark:text-blue-400 rounded-md font-medium">
                Format: {showMatrix ? 'Matrix' : 'Grid'}
              </span>
              <span className="px-2 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 rounded-md font-medium">
                Total: {filteredSchedules.length} jadwal
              </span>
              <span className="px-2 py-1 bg-purple-500/15 text-purple-700 dark:text-purple-400 rounded-md font-medium">
                Kelas: {filter.kelas === 'all' ? 'Semua' : filter.kelas}
              </span>
              <span className="px-2 py-1 bg-orange-500/15 text-orange-700 dark:text-orange-400 rounded-md font-medium">
                Hari: {filter.hari === 'all' ? 'Semua' : filter.hari}
              </span>
              {filteredSchedules.length > 0 && (
                <>
                  <span className="px-2 py-1 bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 rounded-md font-medium">
                    Guru: {uniqueGuruCount} orang
                  </span>
                  <span className="px-2 py-1 bg-pink-500/15 text-pink-700 dark:text-pink-400 rounded-md font-medium">
                    Ruang: {uniqueRuangCount} ruang
                  </span>
                  <span className="px-2 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-md font-medium">
                    Mapel: {uniqueMapelCount} mapel
                  </span>
                  <span className="px-2 py-1 bg-teal-500/15 text-teal-700 dark:text-teal-400 rounded-md font-medium">
                    Absen: {absenableCount} dapat diabsen
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <ExportButton
            onClick={() => handleExportExcel('matrix')}
            isExporting={isExporting}
            desktopText="Export Excel (Matrix)"
            mobileText="Export Matrix"
          />
          <ExportButton
            onClick={() => handleExportExcel('grid')}
            isExporting={isExporting}
            desktopText="Export Excel (Grid)"
            mobileText="Export Grid"
          />
          <Button onClick={handlePrint} variant="outline" disabled={isExporting} size="sm" className="w-full sm:w-auto">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <Card className="p-4 lg:p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Filter Jadwal</h3>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <Label htmlFor="kelas-filter">Kelas</Label>
              <Select value={filter.kelas} onValueChange={(value) => setFilter((prev) => ({ ...prev, kelas: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {uniqueClasses.map((kelas) => (
                    <SelectItem key={kelas.id} value={kelas.id.toString()}>
                      {kelas.nama_kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <Label htmlFor="hari-filter">Hari</Label>
              <Select value={filter.hari} onValueChange={(value) => setFilter((prev) => ({ ...prev, hari: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Hari" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Hari</SelectItem>
                  {DAYS_OF_WEEK.map((hari) => (
                    <SelectItem key={`day-${hari}`} value={hari}>
                      {hari}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handlePreviewJadwal} className="w-full lg:w-auto">
                <Eye className="w-4 h-4 mr-2" />
                Preview Jadwal
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant={showMatrix ? 'default' : 'outline'}
              onClick={() => setDisplayMode('matrix')}
              size="sm"
              className="w-full sm:w-auto"
            >
              <span className="hidden sm:inline">Matrix 3-Baris/Kelas</span>
              <span className="sm:hidden">Matrix</span>
            </Button>
            <Button
              variant={!showMatrix ? 'default' : 'outline'}
              onClick={() => setDisplayMode('grid')}
              size="sm"
              className="w-full sm:w-auto"
            >
              Grid Jam
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 lg:p-6">
        <LetterheadPreview letterhead={letterhead} />

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h3 className="text-base lg:text-lg font-semibold">
            <span className="hidden sm:inline">
              {showMatrix ? 'Jadwal Matrix (3-Baris per Kelas)' : 'Jadwal Grid Jam'}
            </span>
            <span className="sm:hidden">{showMatrix ? 'Jadwal Matrix' : 'Jadwal Grid'}</span>
          </h3>
          <span className="text-xs lg:text-sm text-muted-foreground">
            {filteredSchedules.length} jadwal dari {uniqueClassesForDisplay.length} kelas
          </span>
        </div>

        {showEmptyState && <EmptyScheduleState schedules={schedules} filter={filter} />}
        {!showEmptyState && showMatrix && (
          <ScheduleMatrixTable
            uniqueClassesForDisplay={uniqueClassesForDisplay}
            filteredSchedules={filteredSchedules}
          />
        )}
        {!showEmptyState && !showMatrix && <ScheduleGridList filteredSchedules={filteredSchedules} />}
      </Card>
    </div>
  );
};
