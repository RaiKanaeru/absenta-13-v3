import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, Search, Download, ArrowLeft, AlertCircle 
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiCall } from '@/utils/apiClient';
import { getCurrentDateWIB } from "@/lib/time-utils";
import { createSessionExpiredHandler, generatePageNumbers } from '../utils/dashboardUtils';
import { ReportDataRow } from '@/types/dashboard';

interface TeacherAttendanceSummaryViewProps {
  onBack: () => void;
  onLogout: () => void;
}

export const TeacherAttendanceSummaryView: React.FC<TeacherAttendanceSummaryViewProps> = ({ onBack, onLogout }) => {
    const [reportData, setReportData] = useState<ReportDataRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [periode, setPeriode] = useState('bulanan'); // bulanan | semester
    const [bulan, setBulan] = useState(new Date().getMonth() + 1);
    const [tahun, setTahun] = useState(new Date().getFullYear());
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Tambah state untuk sorting dan filtering
    const [searchValues, setSearchValues] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        fetchReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchReportData uses periode, bulan, tahun which are already in deps
    }, [periode, bulan, tahun, onLogout]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            // Calculate startDate and endDate from periode/bulan/tahun
            let startDate: string;
            let endDate: string;
            
            if (periode === 'bulanan') {
                // Start of month to end of month
                const start = new Date(tahun, bulan - 1, 1);
                const end = new Date(tahun, bulan, 0); // Last day of month
                startDate = start.toISOString().split('T')[0];
                endDate = end.toISOString().split('T')[0];
            } else if (periode === 'semester') {
                // Semester 1: Juli - Desember, Semester 2: Januari - Juni
                const isSemester1 = bulan >= 7; // If bulan >= 7, it's semester 1
                if (isSemester1) {
                    startDate = `${tahun}-07-01`;
                    endDate = `${tahun}-12-31`;
                } else {
                    startDate = `${tahun}-01-01`;
                    endDate = `${tahun}-06-30`;
                }
            } else {
                // Tahunan: full year
                startDate = `${tahun}-01-01`;
                endDate = `${tahun}-12-31`;
            }
            
            const data = await apiCall<ReportDataRow[]>(`/api/admin/teacher-summary?startDate=${startDate}&endDate=${endDate}`, {
                 onLogout: createSessionExpiredHandler(onLogout, toast as unknown as (opts: unknown) => void)
            });
            setReportData(data);
        } catch (error) {
            console.error("Error fetching teacher report data", error);
            toast({
                title: "Error",
                description: "Gagal memuat data laporan guru",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
      setSortConfig({ key, direction });
    };

    // Filter & Sort Logic
    const filteredData = React.useMemo(() => {
      let data = [...reportData];

      if (searchValues) {
        const lowerSearch = searchValues.toLowerCase();
        data = data.filter(item => 
          String(item.nama).toLowerCase().includes(lowerSearch) ||
          String(item.nip).toLowerCase().includes(lowerSearch)
        );
      }

      if (sortConfig) {
        data.sort((a, b) => {
          if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
          if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }

      return data;
    }, [reportData, searchValues, sortConfig]);

    // Pagination
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    
    // Page handler
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleExportReport = () => {
        if (!reportData.length) {
            toast({
                title: "Info",
                description: "Tidak ada data untuk diekspor",
            });
            return;
        }

        try {
            // Prepare CSV content
            const headers = ['No', 'Nama', 'NIP', 'Hadir', 'Izin', 'Sakit', 'Tidak Hadir', 'Persentase'];
            const rows = filteredData.map((item, index) => [
                index + 1,
                `"${item.nama}"`,
                `"${item.nip}"`,
                item.hadir,
                item.izin,
                item.sakit,
                item.alpa, // Menggunakan field 'alpa' untuk Tidak Hadir sesuai mapel
                `"${item.presentase}"`
            ]);

            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `rekap_absensi_guru_${periode}_${getCurrentDateWIB()}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Export error:', err);
            toast({
                title: "Error",
                description: "Gagal mengekspor laporan",
                variant: 'destructive'
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button onClick={onBack} variant="outline">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Kembali
                    </Button>
                    <h2 className="text-2xl font-bold text-foreground">Rekapitulasi Absensi Guru</h2>
                </div>
                <Button onClick={handleExportReport} variant="outline" disabled={!reportData.length}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Laporan Kehadiran Guru
                    </CardTitle>
                    <CardDescription>
                        Lihat ringkasan kehadiran guru berdasarkan periode waktu
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="w-full md:w-48">
                            <label className="text-sm font-medium mb-1 block">Periode</label>
                            <select
                                className="w-full px-4 py-2 border border-border rounded-md focus:ring-2 focus:ring-primary bg-background text-foreground"
                                value={periode}
                                onChange={(e) => {
                                    setPeriode(e.target.value);
                                    // Reset bulan jika pilih semester
                                    if(e.target.value === 'semester') setBulan(1); 
                                }}
                            >
                                <option value="bulanan">Bulanan</option>
                                <option value="semester">Semester</option>
                                <option value="tahunan">Tahunan</option>
                            </select>
                        </div>
                        
                        {periode === 'bulanan' && (
                            <div className="w-full md:w-48">
                                <label className="text-sm font-medium mb-1 block">Bulan</label>
                                <select
                                    className="w-full px-4 py-2 border border-border rounded-md focus:ring-2 focus:ring-primary bg-background text-foreground"
                                    value={bulan}
                                    onChange={(e) => setBulan(parseInt(e.target.value))}
                                >
                                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>
                                            {new Date(0, m - 1).toLocaleString('id-ID', { month: 'long' })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="w-full md:w-48">
                            <label className="text-sm font-medium mb-1 block">Tahun</label>
                            <select
                                className="w-full px-4 py-2 border border-border rounded-md focus:ring-2 focus:ring-primary bg-background text-foreground"
                                value={tahun}
                                onChange={(e) => setTahun(parseInt(e.target.value))}
                            >
                                {Array.from({length: 3}, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="w-full md:w-64">
                             <label className="text-sm font-medium mb-1 block">Cari Guru</label>
                             <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input 
                                    type="text" 
                                    placeholder="Nama atau NIP..." 
                                    className="w-full pl-10 pr-4 py-2 border border-border rounded-md focus:ring-2 focus:ring-primary bg-background text-foreground placeholder:text-muted-foreground"
                                    value={searchValues}
                                    onChange={(e) => setSearchValues(e.target.value)}
                                />
                             </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : reportData.length > 0 ? (
                        <>
                            <div className="overflow-x-auto border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">No</TableHead>
                                            <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('nama')}>
                                                Nama {sortConfig?.key === 'nama' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </TableHead>
                                            <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('nip')}>
                                                NIP {sortConfig?.key === 'nip' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </TableHead>
                                            <TableHead>Hadir</TableHead>
                                            <TableHead>Izin</TableHead>
                                            <TableHead>Sakit</TableHead>
                                            <TableHead>Tidak Hadir</TableHead>
                                            <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('presentase')}>
                                                % Kehadiran {sortConfig?.key === 'presentase' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentData.map((row, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>{(currentPage - 1) * itemsPerPage + idx + 1}</TableCell>
                                                <TableCell className="font-medium">{row.nama}</TableCell>
                                                <TableCell>{row.nip}</TableCell>
                                <TableCell className="text-emerald-600 dark:text-emerald-400 font-medium">{row.hadir}</TableCell>
                                                <TableCell className="text-blue-600 dark:text-blue-400">{row.izin}</TableCell>
                                                <TableCell className="text-amber-600 dark:text-amber-400">{row.sakit}</TableCell>
                                                <TableCell className="text-destructive font-bold">{row.alpa}</TableCell>
                                                <TableCell>
                                                    <Badge variant={
                                                        parseFloat(String(row.presentase).replace('%', '')) >= 85 ? 'default' : 
                                                        parseFloat(String(row.presentase).replace('%', '')) >= 70 ? 'secondary' : 'destructive'
                                                    }>
                                                        {row.presentase}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            
                            {/* Pagination using helper */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        Halaman {currentPage} dari {totalPages}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        {generatePageNumbers(currentPage, totalPages).map((p, i) => (
                                            <Button
                                                key={i}
                                                variant={p === currentPage ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => typeof p === 'number' && handlePageChange(p)}
                                                disabled={typeof p !== 'number'}
                                            >
                                                {p}
                                            </Button>
                                        ))}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Selanjutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Tidak ada data laporan untuk periode ini</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default TeacherAttendanceSummaryView;
