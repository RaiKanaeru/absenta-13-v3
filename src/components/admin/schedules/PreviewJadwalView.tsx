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

/**
 * Helper component for displaying multi-guru list (S2004 - extracted to reduce nesting)
 */
const MultiGuruDisplay = ({ guruList }: { guruList: string }) => (
  <div className="text-xs text-green-600 mt-1">
    <div className="font-medium">Multi-Guru:</div>
    {guruList.split('||').map((guru) => {
      const parts = guru.split(':');
      // Handle potential malformed strings
      const guruName = parts.length > 1 ? parts[1] : parts[0];
      return (
        <div key={`guru-${guru}`} className="text-xs text-green-700 truncate">• {guruName}</div>
      );
    })}
  </div>
);

/**
 * Extracts filename from Content-Disposition header
 */
const extractFilenameFromHeader = (
  contentDisposition: string | null,
  defaultFilename: string
): string => {
  if (!contentDisposition) return defaultFilename;
  const match = /filename="(.+)"/.exec(contentDisposition);
  return match ? match[1] : defaultFilename;
};

/**
 * Creates a download for a blob
 */
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

/**
 * Validates blob response for Excel export
 */
const validateExcelBlob = (blob: Blob): void => {
  if (blob.size === 0) {
    throw new Error('Server mengembalikan file kosong');
  }
  if (!blob.type.includes('spreadsheetml') && !blob.type.includes('excel')) {
    console.warn('Unexpected blob type:', blob.type);
  }
};

export const PreviewJadwalView = ({ onBack, schedules, classes }: PreviewJadwalViewProps) => {
  const [filter, setFilter] = useState({
    kelas: 'all',
    hari: 'all'
  });
  const [displayMode, setDisplayMode] = useState<'matrix' | 'grid'>('matrix');
  const [isExporting, setIsExporting] = useState(false);

  // Import letterhead hook
  const { letterhead } = useLetterhead('REPORT_JADWAL_PELAJARAN');

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // Filter schedules based on selected filters
  const filteredSchedules = schedules.filter(schedule => {
    const kelasMatch = filter.kelas === 'all' || 
      schedule.kelas_id.toString() === filter.kelas ||
      schedule.kelas_id === Number.parseInt(filter.kelas);
    const hariMatch = filter.hari === 'all' || schedule.hari === filter.hari;
    return kelasMatch && hariMatch;
  }).sort((a, b) => {
    // Sort by day first, then by jam_ke
    const dayOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayA = dayOrder.indexOf(a.hari);
    const dayB = dayOrder.indexOf(b.hari);
    if (dayA !== dayB) return dayA - dayB;
    return (a.jam_ke || 0) - (b.jam_ke || 0);
  });

  // Get unique classes for display - using localeCompare for reliable sorting
  const uniqueClassesForDisplay = Array.from(new Set(filteredSchedules.map(s => s.nama_kelas))).sort((a, b) => a.localeCompare(b));

  // Get unique classes for filter
  const uniqueClasses = classes.filter((kelas, index, self) => 
    index === self.findIndex(k => k.id === kelas.id)
  );

  // Helper to build filter query params
  const buildFilterParams = (filterState: typeof filter): URLSearchParams => {
    const params = new URLSearchParams();
    if (filterState.kelas && filterState.kelas !== 'all') {
      params.append('kelas_id', filterState.kelas);
    }
    if (filterState.hari && filterState.hari !== 'all') {
      params.append('hari', filterState.hari);
    }
    return params;
  };

  // Helper to get and validate auth token
  const getAuthToken = (): string => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Token tidak ditemukan');
    }
    return token;
  };

  const handleExportExcel = async (type: 'matrix' | 'grid') => {
    try {
      setIsExporting(true);
      
      // Check if there's data to export
      if (schedules.length === 0) {
        toast({ title: "Tidak Ada Data", description: "Tidak ada jadwal yang tersedia untuk diekspor", variant: "destructive" });
        return;
      }
      
      // Show loading toast
      toast({ title: "Export Excel", description: `Sedang memproses export ${type}...`, variant: "default" });

      // Build endpoint URL
      const params = buildFilterParams(filter);
      const endpoint = type === 'matrix' 
        ? `/api/admin/export/jadwal-matrix?${params.toString()}`
        : `/api/admin/export/jadwal-grid?${params.toString()}`;

      // Fetch Excel file
      const response = await fetch(getApiUrl(endpoint), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || 'Export gagal'}`);
      }

      // Get filename and blob
      const defaultFilename = `Jadwal_Pelajaran_${type === 'matrix' ? 'Matrix' : 'Grid'}_${getCurrentDateWIB()}.xlsx`;
      const filename = extractFilenameFromHeader(response.headers.get('Content-Disposition'), defaultFilename);
      const blob = await response.blob();
      
      // Validate and download
      validateExcelBlob(blob);
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
      
      // Build query parameters using helper
      const params = buildFilterParams(filter);

      // Open print endpoint in new window using getApiUrl
      const printUrl = getApiUrl(`/api/admin/export/jadwal-print?${params.toString()}`);
      const printWindow = globalThis.open(printUrl, '_blank');
      
      if (!printWindow) {
        throw new Error('Tidak dapat membuka jendela print');
      }

      // Show success toast
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
    // Trigger re-render with current filters
    toast({
      title: "Preview Jadwal",
      description: `Menampilkan jadwal dengan filter: Kelas ${filter.kelas === 'all' ? 'Semua' : filter.kelas}, Hari ${filter.hari === 'all' ? 'Semua' : filter.hari}`,
      variant: "default"
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Preview Jadwal Pelajaran</h1>
            <div className="flex flex-wrap gap-1 lg:gap-2 text-xs lg:text-sm mt-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md font-medium">
                Format: {displayMode === 'matrix' ? 'Matrix' : 'Grid'}
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md font-medium">
                Total: {filteredSchedules.length} jadwal
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md font-medium">
                Kelas: {filter.kelas === 'all' ? 'Semua' : filter.kelas}
              </span>
              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md font-medium">
                Hari: {filter.hari === 'all' ? 'Semua' : filter.hari}
              </span>
              {filteredSchedules.length > 0 && (
                <>
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-md font-medium">
                    Guru: {new Set(filteredSchedules.map(s => s.nama_guru)).size} orang
                  </span>
                  <span className="px-2 py-1 bg-pink-100 text-pink-800 rounded-md font-medium">
                    Ruang: {new Set(filteredSchedules.map(s => s.kode_ruang).filter(Boolean)).size} ruang
                  </span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md font-medium">
                    Mapel: {new Set(filteredSchedules.map(s => s.nama_mapel).filter(Boolean)).size} mapel
                  </span>
                  <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-md font-medium">
                    Absen: {filteredSchedules.filter(s => s.is_absenable).length} dapat diabsen
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={() => handleExportExcel('matrix')} 
            variant="outline"
            disabled={isExporting}
            size="sm"
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
            ) : (
            <Download className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export Excel (Matrix)'}</span>
            <span className="sm:hidden">{isExporting ? 'Exporting...' : 'Export Matrix'}</span>
          </Button>
          <Button 
            onClick={() => handleExportExcel('grid')} 
            variant="outline"
            disabled={isExporting}
            size="sm"
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
            ) : (
            <Download className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export Excel (Grid)'}</span>
            <span className="sm:hidden">{isExporting ? 'Exporting...' : 'Export Grid'}</span>
          </Button>
          <Button onClick={handlePrint} variant="outline" disabled={isExporting} size="sm" className="w-full sm:w-auto">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="p-4 lg:p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Filter Jadwal</h3>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <Label htmlFor="kelas-filter">Kelas</Label>
              <Select value={filter.kelas} onValueChange={(value) => setFilter(prev => ({ ...prev, kelas: value }))}>
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
              <Select value={filter.hari} onValueChange={(value) => setFilter(prev => ({ ...prev, hari: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Hari" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Hari</SelectItem>
                  {daysOfWeek.map((hari, index) => (
                    <SelectItem key={`day-${hari}-${index}`} value={hari}>
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
          
          {/* Display Mode Toggle */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant={displayMode === 'matrix' ? 'default' : 'outline'}
              onClick={() => setDisplayMode('matrix')}
              size="sm"
              className="w-full sm:w-auto"
            >
              <span className="hidden sm:inline">Matrix 3-Baris/Kelas</span>
              <span className="sm:hidden">Matrix</span>
            </Button>
            <Button
              variant={displayMode === 'grid' ? 'default' : 'outline'}
              onClick={() => setDisplayMode('grid')}
              size="sm"
              className="w-full sm:w-auto"
            >
              Grid Jam
            </Button>
          </div>
        </div>
      </Card>

      {/* Schedule Display */}
      <Card className="p-4 lg:p-6">
        {/* Letterhead Preview */}
        {letterhead && letterhead.enabled && letterhead.lines && letterhead.lines.length > 0 && (
          <div className="text-center mb-4 lg:mb-6 p-3 lg:p-4 bg-white border-2 border-gray-300">
            {/* Logo kiri dan kanan jika tersedia */}
            {(letterhead.logoLeftUrl || letterhead.logoRightUrl) && (
              <div className="flex justify-between items-center mb-3 lg:mb-4">
                {letterhead.logoLeftUrl && (
                  <img 
                    src={letterhead.logoLeftUrl} 
                    alt="Logo Kiri" 
                    className="h-12 lg:h-16 object-contain"
                    onError={(e) => {
                      console.warn('⚠️ Logo kiri gagal dimuat:', letterhead.logoLeftUrl);
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
                      console.warn('⚠️ Logo kanan gagal dimuat:', letterhead.logoRightUrl);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>
            )}
            
            {/* Baris teks kop laporan */}
            {letterhead.lines.map((line: { text: string; fontWeight?: string }, index: number) => (
              <div 
                key={index} 
                className={`text-xs lg:text-sm ${line.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}`}
                style={{ textAlign: letterhead.alignment as React.CSSProperties['textAlign'] }}
              >
                {line.text}
              </div>
            ))}
            
            <div className="text-base lg:text-lg font-bold mt-3 lg:mt-4">
              JADWAL PELAJARAN
            </div>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h3 className="text-base lg:text-lg font-semibold">
            <span className="hidden sm:inline">
              {displayMode === 'matrix' ? 'Jadwal Matrix (3-Baris per Kelas)' : 'Jadwal Grid Jam'}
            </span>
            <span className="sm:hidden">
              {displayMode === 'matrix' ? 'Jadwal Matrix' : 'Jadwal Grid'}
            </span>
          </h3>
          <span className="text-xs lg:text-sm text-gray-500">
            {filteredSchedules.length} jadwal dari {uniqueClassesForDisplay.length} kelas
          </span>
        </div>
        
        {filteredSchedules.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">—</div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Tidak Ada Jadwal</h3>
            <p className="text-gray-500 mb-4">
              {schedules.length === 0 
                ? 'Belum ada jadwal yang tersedia. Silakan tambahkan jadwal terlebih dahulu.'
                : filter.kelas === 'all' && filter.hari === 'all' 
                  ? 'Belum ada jadwal yang tersedia' 
                  : `Tidak ada jadwal untuk ${filter.kelas === 'all' ? 'semua kelas' : `kelas ${filter.kelas}`} pada ${filter.hari === 'all' ? 'semua hari' : `hari ${filter.hari}`}`
              }
            </p>
            {schedules.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  Total jadwal tersedia: {schedules.length}
                </p>
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
        ) : displayMode === 'matrix' ? (
          <div className="overflow-x-auto -mx-4 lg:mx-0">
            <div className="min-w-full px-4 lg:px-0">
              <table className="w-full border-collapse border border-gray-300 text-xs lg:text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-2 lg:px-4 py-2 text-left font-semibold sticky left-0 bg-gray-50 z-10 min-w-[80px] lg:min-w-[120px]">KELAS</th>
                    {daysOfWeek.map((day, index) => (
                      <th key={`day-header-${day}-${index}`} className="border border-gray-300 px-1 lg:px-4 py-2 text-center font-semibold min-w-[100px] lg:min-w-[150px]">
                        <span className="hidden sm:inline">{day}</span>
                        <span className="sm:hidden">{day.substring(0, 3)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uniqueClassesForDisplay.map((kelasName, index) => (
                    <tr key={`schedule-class-${kelasName}-${index}`}>
                      <td className="border border-gray-300 px-2 lg:px-4 py-2 font-medium sticky left-0 bg-white z-10 min-w-[80px] lg:min-w-[120px]">
                        <span className="hidden sm:inline">{kelasName}</span>
                        <span className="sm:hidden text-xs">{kelasName.length > 8 ? kelasName.substring(0, 8) + '...' : kelasName}</span>
                      </td>
                      {daysOfWeek.map((day, dayIndex) => {
                        const daySchedules = filteredSchedules
                          .filter(s => s.nama_kelas === kelasName && s.hari === day)
                          .sort((a, b) => (a.jam_ke || 0) - (b.jam_ke || 0));
                        return (
                          <td key={`day-cell-${day}-${dayIndex}`} className="border border-gray-300 px-1 lg:px-2 py-1 text-xs min-w-[100px] lg:min-w-[150px]">
                            {daySchedules.map((schedule, idx) => (
                              <div key={`schedule-${schedule.id}-${idx}`} className="mb-1 p-1 bg-blue-50 rounded border border-blue-200">
                                <div className="font-semibold text-xs text-blue-800 truncate">
                                  {schedule.nama_guru || 'Sistem'}
                                </div>
                                <div className="text-xs font-medium text-gray-700 truncate">
                                  {schedule.nama_mapel || schedule.keterangan_khusus}
                                </div>
                                <div className="text-gray-500 text-xs truncate">
                                  {schedule.kode_ruang || schedule.nama_ruang || 'Ruang TBD'}
                                </div>
                                <div className="text-gray-400 text-xs font-mono">
                                  {schedule.jam_mulai} - {schedule.jam_selesai}
                                </div>
                                {schedule.guru_list && schedule.guru_list.includes('||') && (
                                  <MultiGuruDisplay guruList={schedule.guru_list} />
                                )}
                              </div>
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
        ) : (
          <div className="space-y-4">
            {filteredSchedules.map((schedule) => (
              <div key={schedule.id} className="border rounded-lg p-3 lg:p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h4 className="font-semibold text-base lg:text-lg">{schedule.nama_kelas}</h4>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full w-fit">
                        Jam ke-{schedule.jam_ke || 'N/A'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      {schedule.nama_mapel || schedule.keterangan_khusus}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      👨‍🏫 {schedule.nama_guru || 'Sistem'}
                    </p>
                    {schedule.guru_list && schedule.guru_list.includes('||') && (
                      <div className="text-xs text-green-600 mb-1">
                        <div className="font-medium">Multi-Guru:</div>
                        {schedule.guru_list.split('||').map((guru, guruIdx) => (
                          <div key={`guru-list-${guru.split(':')[0]}-${guruIdx}`} className="text-xs text-green-700">
                            • {guru.split(':')[1]}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      📍 {schedule.kode_ruang || schedule.nama_ruang || 'Ruang TBD'}
                    </p>
                  </div>
                  <div className="flex flex-row lg:flex-col lg:text-right gap-3 lg:gap-0 lg:ml-4">
                    <div>
                      <p className="font-medium text-base lg:text-lg">{schedule.hari}</p>
                      <p className="text-sm text-gray-600 font-mono">
                        {schedule.jam_mulai} - {schedule.jam_selesai}
                      </p>
                    </div>
                    <div className="lg:mt-1">
                      <p className="text-xs text-gray-500">
                        {{
                          pelajaran: 'Pelajaran',
                          upacara: 'Upacara', 
                          istirahat: 'Istirahat',
                          kegiatan_khusus: 'Kegiatan Khusus',
                          ujian: 'Ujian'
                        }[schedule.jenis_aktivitas] || 'Lainnya'}
                      </p>
                      {schedule.is_absenable && (
                        <p className="text-xs text-green-600 mt-1">Dapat diabsen</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
