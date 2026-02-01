import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, Clock, AlertTriangle, CheckCircle2, FileText, X, GraduationCap, RefreshCw, Download 
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
import { LiveTeacherRow } from '@/types/dashboard';

interface LiveTeacherAttendanceViewProps {
  onBack: () => void;
  onLogout: () => void;
}

export const LiveTeacherAttendanceView: React.FC<LiveTeacherAttendanceViewProps> = ({ onBack, onLogout }) => {
    const [attendanceData, setAttendanceData] = useState<LiveTeacherRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentTime, setCurrentTime] = useState(getWIBTime());
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 45;
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMapel, setSelectedMapel] = useState('all');
    const [mapelList, setMapelList] = useState<{id_mapel: number; nama_mapel: string}[]>([]);

    // Update waktu setiap detik
    useEffect(() => {
      const timer = setInterval(() => setCurrentTime(getWIBTime()), 1000);
      return () => clearInterval(timer);
    }, []);

    // Fetch mapel list for filter
    useEffect(() => {
      const fetchMapelList = async () => {
        try {
          const token = localStorage.getItem('token');
          const data = await apiCall('/api/admin/mapel', {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            }
          });
          setMapelList(data);
        } catch (error) {
          console.error('Error fetching mapel list:', error);
        }
      };
      fetchMapelList();
    }, []);

    // Filter and search data
    const filteredData = attendanceData.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nama_mapel?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesMapel = selectedMapel === 'all' || 
        item.nama_mapel?.includes(selectedMapel);
      
      // Selalu tampilkan semua data yang sesuai dengan filter pencarian dan mata pelajaran
      // Tidak perlu membedakan antara ada/tidak ada pencarian
      return matchesSearch && matchesMapel;
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
      const fetchTeacherData = async () => {
        try {
          setError('');
          const token = localStorage.getItem('token');
          const data = await apiCall('/api/admin/live-teacher-attendance', {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            onLogout: createSessionExpiredHandler(onLogout, toast)
          });
          setAttendanceData(data);
        } catch (error: unknown) {
          console.error('❌ Error fetching live teacher attendance:', error);
          const message = error instanceof Error ? error.message : String(error);
          setError('Gagal memuat data absensi guru: ' + message);
        } finally {
          setLoading(false);
        }
      };

      fetchTeacherData();
      
      let interval: NodeJS.Timeout | null = null;
      if (autoRefresh) {
        interval = setInterval(fetchTeacherData, 30000); // Refresh every 30 seconds
      }
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }, [onLogout, autoRefresh]);

    // Komponen statistik kehadiran guru - Modern Design
    const TeacherAttendanceStats = ({ data }: { data: LiveTeacherRow[] }) => {
      const total = data.length;
      const hadir = data.filter(item => item.status === 'Hadir').length;
      const tidakHadir = data.filter(item => item.status === 'Tidak Hadir').length;
      const sakit = data.filter(item => item.status === 'Sakit').length;
      const izin = data.filter(item => item.status === 'Izin').length;
      const dispen = data.filter(item => item.status === 'Dispen').length;
      const belumAbsen = data.filter(item => item.status === 'Belum Absen').length;
      
      const presentase = total > 0 ? Math.round((hadir / total) * 100) : 0;

      const stats = [
        { label: 'Hadir', value: hadir, color: 'emerald', icon: CheckCircle2, pct: total > 0 ? Math.round((hadir/total)*100) : 0 },
        { label: 'Tidak Hadir', value: tidakHadir, color: 'rose', icon: X, pct: total > 0 ? Math.round((tidakHadir/total)*100) : 0 },
        { label: 'Sakit', value: sakit, color: 'sky', icon: AlertTriangle, pct: total > 0 ? Math.round((sakit/total)*100) : 0 },
        { label: 'Izin', value: izin, color: 'amber', icon: FileText, pct: total > 0 ? Math.round((izin/total)*100) : 0 },
        { label: 'Dispen', value: dispen, color: 'violet', icon: Clock, pct: total > 0 ? Math.round((dispen/total)*100) : 0 },
        { label: 'Belum Absen', value: belumAbsen, color: 'slate', icon: Clock, pct: total > 0 ? Math.round((belumAbsen/total)*100) : 0 },
        { label: 'Total', value: total, color: 'indigo', icon: GraduationCap, pct: presentase, pctLabel: '% Hadir' },
      ];

      const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
        emerald: { bg: 'bg-emerald-50', border: 'border-l-emerald-500', text: 'text-emerald-700', icon: 'text-emerald-500' },
        rose: { bg: 'bg-rose-50', border: 'border-l-rose-500', text: 'text-rose-700', icon: 'text-rose-500' },
        sky: { bg: 'bg-sky-50', border: 'border-l-sky-500', text: 'text-sky-700', icon: 'text-sky-500' },
        amber: { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700', icon: 'text-amber-500' },
        violet: { bg: 'bg-violet-50', border: 'border-l-violet-500', text: 'text-violet-700', icon: 'text-violet-500' },
        slate: { bg: 'bg-slate-50', border: 'border-l-slate-500', text: 'text-slate-700', icon: 'text-slate-500' },
        indigo: { bg: 'bg-indigo-50', border: 'border-l-indigo-500', text: 'text-indigo-700', icon: 'text-indigo-500' },
      };
      
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
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

    // Komponen progress kehadiran guru - Modern Gauge Design
    const TeacherAttendanceProgress = ({ data }: { data: LiveTeacherRow[] }) => {
      const total = data.length;
      const hadir = data.filter(item => item.status === 'Hadir').length;
      const sakit = data.filter(item => item.status === 'Sakit').length;
      const izin = data.filter(item => item.status === 'Izin').length;
      const tidakHadir = data.filter(item => item.status === 'Tidak Hadir').length;
      
      const presentase = total > 0 ? Math.round((hadir / total) * 100) : 0;
      const circumference = 2 * Math.PI * 45;
      const strokeDashoffset = circumference - (presentase / 100) * circumference;
      
      return (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 mb-6 border border-indigo-100">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="45" stroke="#e5e7eb" strokeWidth="10" fill="none" />
                <circle
                  cx="64" cy="64" r="45"
                  stroke="url(#gradientTeacher)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="gradientTeacher" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-indigo-700">{presentase}%</span>
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Tingkat Kehadiran Guru Hari Ini</h3>
              <p className="text-slate-600 text-sm mb-4">{hadir} dari {total} guru hadir</p>
              
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-indigo-600">{hadir}</p>
                  <p className="text-xs text-slate-500">Hadir</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-600">{izin}</p>
                  <p className="text-xs text-slate-500">Izin</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-sky-600">{sakit}</p>
                  <p className="text-xs text-slate-500">Sakit</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-rose-600">{tidakHadir}</p>
                  <p className="text-xs text-slate-500">Tidak Hadir</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    // Komponen pagination untuk guru
    const TeacherPagination = () => {
      if (totalPages <= 1) return null;

      // Use shared generatePageNumbers helper to reduce cognitive complexity
      const pageNumbers = generatePageNumbers(currentPage, totalPages);

      return (
        <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600">
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
                ? `teacher-page-${page}` 
                : `teacher-ellipsis-${index}`;

              
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
        
        // Prepare data for Excel export
        const exportData = filteredData.map((teacher, index) => ({
          'No': index + 1,
          'Nama Guru': teacher.nama || '',
          'NIP': teacher.nip || '',
          'Mata Pelajaran': teacher.nama_mapel || '',
          'Kelas': teacher.nama_kelas || '',
          'Jadwal': `${teacher.jam_mulai || ''} - ${teacher.jam_selesai || ''}`,
          'Status': teacher.status || '',
          'Waktu Absen': teacher.waktu_absen || '',
          'Ket. Waktu': teacher.keterangan_waktu || '',
          'Periode': teacher.periode_absen || '',
          'Keterangan': teacher.keterangan || ''
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
        link.href = URL.createObjectURL(blob);
        link.download = `pemantauan_guru_live_${getCurrentDateWIB()}.csv`;
        link.click();
        
        toast({
          title: "Berhasil",
          description: "Data guru berhasil diekspor ke CSV"
        });
      } catch (error: unknown) {
        console.error('❌ Error exporting live teacher attendance:', error);
        const message = error instanceof Error ? error.message : String(error);
        toast({
          title: "Error",
          description: "Gagal mengekspor data: " + message,
          variant: "destructive"
        });
      }
    };

    if (loading) {
      return (
        <div className="space-y-4">
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Menu Laporan
          </Button>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Memuat data pemantauan guru...</p>
            </div>
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
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Clock className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="font-semibold text-indigo-800">
                    {formatDateOnly(currentTime)}
                  </p>
                  <p className="text-sm text-indigo-600">
                    Jam: {formatTime24WithSeconds(currentTime)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-indigo-600">Data Real-time</p>
                <p className="text-xs text-indigo-500">Update setiap 30 detik</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center text-red-800">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistik Kehadiran Guru */}
        <TeacherAttendanceStats data={filteredData} />

        {/* Progress Bar Kehadiran Guru */}
        <TeacherAttendanceProgress data={filteredData} />

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center">
                  <GraduationCap className="w-5 h-5 mr-2" />
                  Pemantauan Guru Langsung
                  {searchQuery === '' ? (
                    <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                      Mode: Hanya yang Sudah Absen
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                      Mode: Pencarian (Semua Data)
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Daftar validasi kehadiran guru secara realtime untuk hari ini. Data diperbarui setiap 30 detik.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setAutoRefresh(!autoRefresh)} 
                  size="sm" 
                  variant={autoRefresh ? "default" : "outline"}
                  className={autoRefresh ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                  Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
                </Button>
                <Button onClick={handleExport} size="sm" disabled={filteredData?.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export ke CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filter and Search Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pencarian (Nama, NIP, atau Mata Pelajaran){' '}
                  <span className="text-xs text-gray-500 ml-2">
                    (Menampilkan semua guru yang sesuai kriteria pencarian)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama, NIP, atau mata pelajaran..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:w-48">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter Mata Pelajaran
                </label>
                <select
                  value={selectedMapel}
                  onChange={(e) => setSelectedMapel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Semua Mata Pelajaran</option>
                  {mapelList.map((mapel, index) => (
                    <option key={`mapel-${mapel.id_mapel}-${index}`} value={mapel.nama_mapel}>
                      {mapel.nama_mapel}
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
                        <TableHead>Nama Guru</TableHead>
                        <TableHead>NIP</TableHead>
                        <TableHead>Mata Pelajaran</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead>Jadwal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Waktu Absen</TableHead>
                        <TableHead>Ket. Waktu</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead>Keterangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentData.map((teacher, index) => (
                        <TableRow key={`${teacher.nip}-${startIndex + index}`}>
                          <TableCell className="font-medium">{teacher.nama}</TableCell>
                          <TableCell>{teacher.nip}</TableCell>
                          <TableCell>{teacher.nama_mapel}</TableCell>
                          <TableCell>{teacher.nama_kelas}</TableCell>
                          <TableCell>{teacher.jam_mulai} - {teacher.jam_selesai}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAttendanceStatusColor(teacher.status)}`}>
                              {teacher.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {teacher.waktu_absen ? (
                              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                                {teacher.waktu_absen}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTimeStatusColor(teacher.keterangan_waktu)}`}>
                              {teacher.keterangan_waktu || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPeriodColor(teacher.periode_absen)}`}>
                              {teacher.periode_absen || '-'}
                            </span>
                          </TableCell>

                          <TableCell>{teacher.keterangan || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TeacherPagination />
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{filteredData.length === 0 && attendanceData.length > 0 ? 'Tidak ada data yang sesuai dengan filter' : 'Belum ada data absensi guru hari ini'}</p>
                <p className="text-sm">{filteredData.length === 0 && attendanceData.length > 0 ? 'Coba ubah filter atau pencarian' : 'Data akan muncul saat guru melakukan absensi'}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
};

export default LiveTeacherAttendanceView;
