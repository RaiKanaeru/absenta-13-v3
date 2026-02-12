import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, Search, Download, ArrowLeft, AlertCircle, Loader2, FileSpreadsheet 
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiCall } from '@/utils/apiClient';
import { getCurrentDateWIB } from "@/lib/time-utils";
import { createSessionExpiredHandler, generatePageNumbers } from '../utils/dashboardUtils';
import { ReportDataRow } from '@/types/dashboard';
import { downloadExcelFromApi, downloadPdf } from '@/utils/exportUtils';

interface TeacherAttendanceSummaryViewProps {
  onBack: () => void;
  onLogout: () => void;
}

const getAttendanceBadgeVariant = (presentase: ReportDataRow['presentase']): 'default' | 'secondary' | 'destructive' => {
    const percentage = Number.parseFloat(String(presentase).replace('%', ''));

    if (percentage >= 85) {
        return 'default';
    }

    if (percentage >= 70) {
        return 'secondary';
    }

    return 'destructive';
};

const buildPaginationItems = (currentPage: number, totalPages: number) => {
    let ellipsisCount = 0;

    return generatePageNumbers(currentPage, totalPages).map((page) => {
        if (typeof page === 'number') {
            return { key: `page-${page}`, value: page };
        }

        ellipsisCount += 1;
        return { key: `ellipsis-${ellipsisCount}`, value: page };
    });
};

const calculateDateRange = (periode: string, bulan: number, tahun: number) => {
    let startDate: string;
    let endDate: string;

    if (periode === 'bulanan') {
        const start = new Date(tahun, bulan - 1, 1);
        const end = new Date(tahun, bulan, 0);
        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
    } else if (periode === 'semester') {
        const isSemester1 = bulan >= 7;
        startDate = isSemester1 ? `${tahun}-07-01` : `${tahun}-01-01`;
        endDate = isSemester1 ? `${tahun}-12-31` : `${tahun}-06-30`;
    } else {
        startDate = `${tahun}-01-01`;
        endDate = `${tahun}-12-31`;
    }

    return { startDate, endDate };
};

/**
 * Filter report data by search query (name or NIP)
 */
const filterReportData = (data: ReportDataRow[], searchQuery: string): ReportDataRow[] => {
    if (!searchQuery) return data;
    
    const lowerSearch = searchQuery.toLowerCase();
    return data.filter(item => 
        String(item.nama).toLowerCase().includes(lowerSearch) ||
        String(item.nip).toLowerCase().includes(lowerSearch)
    );
};

/**
 * Sort filtered data by key and direction
 */
const sortReportData = (
    data: ReportDataRow[],
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null
): ReportDataRow[] => {
    if (!sortConfig) return data;

    return data.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
};
 
export const TeacherAttendanceSummaryView: React.FC<TeacherAttendanceSummaryViewProps> = ({ onBack, onLogout }) => {
    const [reportData, setReportData] = useState<ReportDataRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [periode, setPeriode] = useState('bulanan'); // bulanan | semester
    const [bulan, setBulan] = useState(new Date().getMonth() + 1);
    const [tahun, setTahun] = useState(new Date().getFullYear());
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    const [exportingExcel, setExportingExcel] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);

    // Tambah state untuk sorting dan filtering
    const [searchValues, setSearchValues] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const fetchReportData = useCallback(async () => {
        setLoading(true);
        try {
            const { startDate, endDate } = calculateDateRange(periode, bulan, tahun);
            
            const data = await apiCall<ReportDataRow[]>(`/api/admin/teacher-summary?startDate=${startDate}&endDate=${endDate}`, {
                 onLogout: createSessionExpiredHandler(onLogout, toast as unknown as (opts: unknown) => void)
            });
            setReportData(data);
        } catch (error) {
            console.error('TeacherAttendanceSummaryView: Failed to load teacher report', error);
            toast({
                title: "Error",
                description: "Gagal memuat data laporan guru",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [periode, bulan, tahun, onLogout]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const handleSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
      setSortConfig({ key, direction });
    };

     // Filter & Sort Logic
     const filteredData = React.useMemo(() => {
       const filtered = filterReportData(reportData, searchValues);
       return sortReportData(filtered, sortConfig);
     }, [reportData, searchValues, sortConfig]);

    // Pagination
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const paginationItems = buildPaginationItems(currentPage, totalPages);
    
    // Page handler
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleExportExcel = async () => {
        if (!reportData.length) {
            toast({
                title: "Info",
                description: "Tidak ada data untuk diekspor",
            });
            return;
        }

        try {
            setExportingExcel(true);
            const { startDate, endDate } = calculateDateRange(periode, bulan, tahun);

            await downloadExcelFromApi(
                '/api/export/teacher-summary',
                `rekap_absensi_guru_${periode}_${getCurrentDateWIB()}.xlsx`,
                { startDate, endDate },
                createSessionExpiredHandler(onLogout, toast as unknown as (opts: unknown) => void)
            );

            toast({
                title: "Berhasil",
                description: "File Excel berhasil diunduh"
            });
        } catch (err) {
            console.error('TeacherAttendanceSummaryView: Failed to export Excel', err);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Gagal mengekspor laporan",
                variant: 'destructive'
            });
        } finally {
            setExportingExcel(false);
        }
    };

    const handleExportPdf = async () => {
        if (!reportData.length) {
            toast({
                title: "Info",
                description: "Tidak ada data untuk diekspor",
            });
            return;
        }

        try {
            setExportingPdf(true);
            const { startDate, endDate } = calculateDateRange(periode, bulan, tahun);

            await downloadPdf(
                '/api/export/pdf/teacher-summary',
                `rekap_absensi_guru_${periode}_${getCurrentDateWIB()}.pdf`,
                { startDate, endDate },
                createSessionExpiredHandler(onLogout, toast as unknown as (opts: unknown) => void)
            );

            toast({
                title: "Berhasil",
                description: "File PDF berhasil diunduh"
            });
        } catch (err) {
            console.error('TeacherAttendanceSummaryView: Failed to export PDF', err);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Gagal mengekspor PDF",
                variant: 'destructive'
            });
        } finally {
            setExportingPdf(false);
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
                <div className="flex gap-2">
                    <Button onClick={handleExportExcel} variant="outline" disabled={!reportData.length || exportingExcel}>
                        {exportingExcel ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Mengekspor...
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                Export Excel
                            </>
                        )}
                    </Button>
                    <Button onClick={handleExportPdf} variant="outline" disabled={!reportData.length || exportingPdf}>
                        {exportingPdf ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Mengekspor...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                Export PDF
                            </>
                        )}
                    </Button>
                </div>
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
                            <label htmlFor="periode-select" className="text-sm font-medium mb-1 block">Periode</label>
                            <select
                                id="periode-select"
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
                                <label htmlFor="bulan-select" className="text-sm font-medium mb-1 block">Bulan</label>
                                <select
                                    id="bulan-select"
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
                            <label htmlFor="tahun-select" className="text-sm font-medium mb-1 block">Tahun</label>
                            <select
                                id="tahun-select"
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
                             <label htmlFor="guru-search" className="text-sm font-medium mb-1 block">Cari Guru</label>
                             <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input 
                                    id="guru-search"
                                    type="text" 
                                    placeholder="Nama atau NIP..." 
                                    className="w-full pl-10 pr-4 py-2 border border-border rounded-md focus:ring-2 focus:ring-primary bg-background text-foreground placeholder:text-muted-foreground"
                                    value={searchValues}
                                    onChange={(e) => setSearchValues(e.target.value)}
                                />
                             </div>
                        </div>
                    </div>

                    {(() => {
                        if (loading) {
                            return (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            );
                        }
                        if (reportData.length > 0) {
                            return (
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
                                            <TableRow key={`${row.nip}-${row.nama}`}>
                                                <TableCell>{(currentPage - 1) * itemsPerPage + idx + 1}</TableCell>
                                                <TableCell className="font-medium">{row.nama}</TableCell>
                                                <TableCell>{row.nip}</TableCell>
                                                <TableCell className="text-emerald-600 dark:text-emerald-400 font-medium">{row.hadir}</TableCell>
                                                <TableCell className="text-amber-600 dark:text-amber-400">{row.izin}</TableCell>
                                                <TableCell className="text-blue-600 dark:text-blue-400">{row.sakit}</TableCell>
                                                <TableCell className="text-destructive font-bold">{row.alpa}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getAttendanceBadgeVariant(row.presentase)}>
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
                                        {paginationItems.map((item) => (
                                            <Button
                                                key={item.key}
                                                variant={item.value === currentPage ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => typeof item.value === 'number' && handlePageChange(item.value)}
                                                disabled={typeof item.value !== 'number'}
                                            >
                                                {item.value}
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
                            );
                        }

                        return (
                            <div className="text-center py-12 text-muted-foreground">
                                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Tidak ada data laporan untuk periode ini</p>
                            </div>
                        );
                    })()}
                </CardContent>
            </Card>
        </div>
    );
};

export default TeacherAttendanceSummaryView;
