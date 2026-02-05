import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, Clock, AlertTriangle, CheckCircle2, FileText, X, Users, RefreshCw, Download, AlertCircle, Loader2 
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiCall } from '@/utils/apiClient';
import { getWIBTime, formatDateOnly, formatTime24WithSeconds, getCurrentDateWIB } from "@/lib/time-utils";
import { 
  createSessionExpiredHandler, 
  generatePageNumbers, 
  getAttendanceStatusColor, 
  getTimeStatusColor, 
  getPeriodColor 
} from '../utils/dashboardUtils';
import { LiveStudentRow } from '@/types/dashboard';

interface LiveStudentAttendanceViewProps {
  onBack: () => void;
  onLogout: () => void;
}

export const LiveStudentAttendanceView: React.FC<LiveStudentAttendanceViewProps> = ({ onBack, onLogout }) => {
  const [attendanceData, setAttendanceData] = useState<LiveStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(getWIBTime());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 45;
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('all');
  const [classes, setClasses] = useState<{id_kelas: number; nama_kelas: string}[]>([]);
  const [exporting, setExporting] = useState(false);

  // Update waktu setiap detik
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getWIBTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch classes for filter
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const token = localStorage.getItem('token');
        const data = await apiCall('/api/admin/classes', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        setClasses(data);
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    };
    fetchClasses();
  }, []);

  // Filter and search data
  const filteredData = attendanceData.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === '' || 
      String(item.nama ?? '').toLowerCase().includes(searchLower) ||
      String(item.nis ?? '').toLowerCase().includes(searchLower);
    
    const matchesKelas = selectedKelas === 'all' || 
      item.nama_kelas === selectedKelas;
    
    // Jika ada pencarian, tampilkan semua data yang sesuai
    // Jika tidak ada pencarian, hanya tampilkan yang sudah absen
    const hasAttended = item.status !== 'Belum Absen' && item.waktu_absen !== null;
    
    if (searchQuery) {
      return matchesSearch && matchesKelas;
    } else {
      return hasAttended && matchesKelas;
    }
  });

  // Reset to first page when filtered data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        setError('');
        const token = localStorage.getItem('token');
        const data = await apiCall('/api/admin/live-student-attendance', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          onLogout: createSessionExpiredHandler(onLogout, toast)
        });
        setAttendanceData(data);

      } catch (error: unknown) {
        console.error('❌ Error fetching live student attendance:', error);
        const message = error instanceof Error ? error.message : String(error);
        setError('Gagal memuat data absensi siswa: ' + message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
    
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchStudentData, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [onLogout, autoRefresh]);


  // Komponen statistik kehadiran - Modern Design
  const AttendanceStats = ({ data }: { data: LiveStudentRow[] }) => {
    const total = data.length;
    const hadir = data.filter(item => item.status === 'Hadir').length;
    const izin = data.filter(item => item.status === 'Izin').length;
    const sakit = data.filter(item => item.status === 'Sakit').length;
    const alpa = data.filter(item => item.status === 'Alpa').length;
    const dispen = data.filter(item => item.status === 'Dispen').length;
    
    const presentase = total > 0 ? Math.round((hadir / total) * 100) : 0;

    const stats = [
      { label: 'Hadir', value: hadir, color: 'emerald', icon: CheckCircle2, pct: total > 0 ? Math.round((hadir/total)*100) : 0 },
      { label: 'Izin', value: izin, color: 'amber', icon: FileText, pct: total > 0 ? Math.round((izin/total)*100) : 0 },
    { label: 'Sakit', value: sakit, color: 'blue', icon: AlertTriangle, pct: total > 0 ? Math.round((sakit/total)*100) : 0 },
      { label: 'Alpa', value: alpa, color: 'destructive', icon: X, pct: total > 0 ? Math.round((alpa/total)*100) : 0 },
      { label: 'Dispen', value: dispen, color: 'violet', icon: Clock, pct: total > 0 ? Math.round((dispen/total)*100) : 0 },
      { label: 'Total', value: total, color: 'slate', icon: Users, pct: presentase, pctLabel: '% Hadir' },
    ];

const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
      emerald: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', border: 'border-l-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', icon: 'text-emerald-500' },
      amber: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', border: 'border-l-amber-500', text: 'text-amber-700 dark:text-amber-400', icon: 'text-amber-500' },
  blue: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', border: 'border-l-blue-500', text: 'text-blue-700 dark:text-blue-400', icon: 'text-blue-500' },
      destructive: { bg: 'bg-destructive/15', border: 'border-l-destructive', text: 'text-destructive', icon: 'text-destructive' },
      violet: { bg: 'bg-violet-500/10 dark:bg-violet-500/20', border: 'border-l-violet-500', text: 'text-violet-700 dark:text-violet-400', icon: 'text-violet-500' },
      slate: { bg: 'bg-muted', border: 'border-l-slate-500 dark:border-l-slate-400', text: 'text-foreground', icon: 'text-muted-foreground' },
    };
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {stats.map((stat) => {
          const colors = colorMap[stat.color];
          const IconComponent = stat.icon;
          return (
            <div 
              key={stat.label}
              className={`${colors.bg} ${colors.border} border-l-4 rounded-lg p-4 transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-2">
                <IconComponent className={`w-5 h-5 ${colors.icon}`} />
                <span className={`text-xs font-medium ${colors.text} opacity-75`}>
                  {stat.pct}%{stat.pctLabel || ''}
                </span>
              </div>
              <p className={`text-2xl font-bold ${colors.text}`}>{stat.value}</p>
              <p className={`text-sm ${colors.text} opacity-80`}>{stat.label}</p>
            </div>
          );
        })}
      </div>
    );
  };

  // Komponen progress kehadiran - Modern Gauge Design
  const AttendanceProgress = ({ data }: { data: LiveStudentRow[] }) => {
    const total = data.length;
    const hadir = data.filter(item => item.status === 'Hadir').length;
    const izin = data.filter(item => item.status === 'Izin').length;
    const sakit = data.filter(item => item.status === 'Sakit').length;
    const alpa = data.filter(item => item.status === 'Alpa').length;
    
    const presentase = total > 0 ? Math.round((hadir / total) * 100) : 0;
    const circumference = 2 * Math.PI * 45; // radius 45
    const strokeDashoffset = circumference - (presentase / 100) * circumference;
    
    return (
      <div className="bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl p-6 mb-6 border border-emerald-500/20">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Circular Progress */}
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="currentColor"
                strokeWidth="10"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="url(#gradient)"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700 ease-out"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="currentColor" className="text-emerald-500 dark:text-emerald-400" />
                  <stop offset="100%" stopColor="currentColor" className="text-emerald-400 dark:text-emerald-300" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{presentase}%</span>
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex-1">
<h3 className="text-lg font-semibold text-foreground mb-1">Tingkat Kehadiran Hari Ini</h3>
            <p className="text-muted-foreground text-sm mb-4">{hadir} dari {total} siswa hadir</p>
            
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{hadir}</p>
                <p className="text-xs text-muted-foreground">Hadir</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{izin}</p>
                <p className="text-xs text-muted-foreground">Izin</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{sakit}</p>
                <p className="text-xs text-muted-foreground">Sakit</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-destructive">{alpa}</p>
                <p className="text-xs text-muted-foreground">Alpa</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Komponen pagination
  const Pagination = () => {
    if (totalPages <= 1 || totalPages === 0) return null;

    // Use shared generatePageNumbers helper to reduce cognitive complexity
    const pageNumbers = generatePageNumbers(currentPage, totalPages);

    return (
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredData.length)} dari {filteredData.length} data
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          
          {pageNumbers.map((page, index) => {
            const uniqueKey = typeof page === 'number' 
              ? `student-page-${page}` 
              : `student-ellipsis-${index}`;
            
            return (
              <Button
                key={uniqueKey}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => typeof page === 'number' && setCurrentPage(page)}
                disabled={page === '...'}
                className={page === '...' ? 'cursor-default' : ''}
              >
                {page}
              </Button>
            );
          })}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </Button>
        </div>
      </div>
    );
  };

  const handleExport = () => {
    try {
      // Check filteredData instead of attendanceData to ensure we export what user sees
      if (!filteredData || filteredData.length === 0) {
        toast({
          title: "Info",
          description: "Tidak ada data untuk diekspor. Coba nonaktifkan filter atau ubah kriteria pencarian."
        });
        return;
      }
      setExporting(true);

      // Prepare data for Excel export
      const exportData = filteredData.map((student: LiveStudentRow, index: number) => ({
        'No': index + 1,
        'Nama Siswa': student.nama || '',
        'NIS': student.nis || '',
        'Kelas': student.nama_kelas || '',
        'Status': student.status || '',
        'Waktu Absen': student.waktu_absen || '',
        'Ket. Waktu': student.keterangan_waktu || '',
        'Periode': student.periode_absen || '',
        'Keterangan': student.keterangan || ''
      }));

      // Create CSV content with UTF-8 BOM
      const BOM = '\uFEFF';
      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(row =>
        Object.values(row).map(value =>
          typeof value === 'string' && value.includes(',') ? `"${value}"` : 
          (typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? ''))
        ).join(',')
      );
      const csvContent = BOM + headers + '\n' + rows.join('\n');

      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `pemantauan_siswa_live_${getCurrentDateWIB()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Berhasil",
        description: "File CSV berhasil diunduh"
      });
    } catch (error: unknown) {
      console.error('❌ Error exporting live student attendance:', error);
      const message = error instanceof Error ? error.message : String(error);
        toast({
          title: "Error",
          description: "Gagal mengekspor data: " + message,
          variant: "destructive"
        });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Memuat data pemantauan siswa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={onBack} variant="outline">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Kembali ke Menu Laporan
      </Button>

      {/* Info Hari dan Waktu */}
<Card className="border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-semibold text-blue-800 dark:text-blue-300">
                  {formatDateOnly(currentTime)}
                </p>
<p className="text-sm text-blue-600 dark:text-blue-400">
                  Jam: {formatTime24WithSeconds(currentTime)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-600 dark:text-blue-400">Data Real-time</p>
              <p className="text-xs text-blue-500 dark:text-blue-300">Update setiap 30 detik</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
<Card className="border-destructive/20 bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-center text-destructive">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistik Kehadiran */}
      <AttendanceStats data={filteredData} />

      {/* Progress Bar Kehadiran */}
      <AttendanceProgress data={filteredData} />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Pemantauan Siswa Langsung
                {searchQuery === '' ? (
<Badge variant="secondary" className="ml-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    Mode: Hanya yang Sudah Absen
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="ml-2 bg-blue-500/15 text-blue-700 dark:text-blue-400">
                    Mode: Pencarian (Semua Data)
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Daftar absensi siswa secara realtime untuk hari ini. Data diperbarui setiap 30 detik.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => setAutoRefresh(!autoRefresh)} 
                size="sm" 
                variant={autoRefresh ? "default" : "outline"}
                className={autoRefresh ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
              </Button>
              <Button onClick={handleExport} size="sm" disabled={!filteredData?.length || exporting}>
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mengekspor...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export ke CSV
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter and Search Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
<label className="block text-sm font-medium text-foreground mb-2">
                Pencarian (Nama atau NIS)
                {searchQuery === '' && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (Kosongkan untuk melihat hanya yang sudah absen)
                  </span>
                )}
                {searchQuery !== '' && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                    (Menampilkan semua data termasuk yang belum absen)
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="Cari berdasarkan nama atau NIS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              />
            </div>
            <div className="sm:w-48">
              <label className="block text-sm font-medium text-foreground mb-2">
                Filter Kelas
              </label>
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              >
                <option value="all">Semua Kelas</option>
                {classes.map((kelas, index) => (
                  <option key={`kelas-${kelas.id_kelas}-${index}`} value={kelas.nama_kelas}>
                    {kelas.nama_kelas}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredData && filteredData.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Waktu Absen</TableHead>
                      <TableHead>Ket. Waktu</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentData.map((student: LiveStudentRow, index: number) => (
                      <TableRow key={`${student.nis}-${startIndex + index}`}>
                        <TableCell className="font-medium">{student.nama}</TableCell>
                        <TableCell>{student.nis}</TableCell>
                        <TableCell>{student.nama_kelas}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAttendanceStatusColor(student.status)}`}>
                            {student.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {student.waktu_absen ? (
                            <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                              {student.waktu_absen}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTimeStatusColor(student.keterangan_waktu)}`}>
                            {student.keterangan_waktu || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPeriodColor(student.periode_absen)}`}>
                            {student.periode_absen || '-'}
                          </span>
                        </TableCell>

                        <TableCell>{student.keterangan || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination />
            </>
            ) : (
<div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{filteredData.length === 0 && attendanceData.length > 0 ? 'Tidak ada data yang sesuai dengan filter' : 'Belum ada data absensi siswa'}</p>
                <p className="text-sm">{filteredData.length === 0 && attendanceData.length > 0 ? 'Coba ubah filter atau pencarian' : 'Data akan muncul saat siswa melakukan absensi'}</p>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveStudentAttendanceView;
