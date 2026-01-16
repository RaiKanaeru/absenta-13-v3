import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, Search, Filter, Download, ArrowLeft, AlertCircle 
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiCall } from '@/utils/apiClient';
import { getCurrentDateWIB } from "@/lib/time-utils";
import { createSessionExpiredHandler, generatePageNumbers } from '../utils/dashboardHelpers';
import { ReportDataRow } from '@/types/dashboard';

interface StudentAttendanceSummaryViewProps {
  onBack: () => void;
  onLogout: () => void;
}

export const StudentAttendanceSummaryView: React.FC<StudentAttendanceSummaryViewProps> = ({ onBack, onLogout }) => {
    const [reportData, setReportData] = useState<ReportDataRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [kelasOptions, setKelasOptions] = useState<string[]>([]);
    const [selectedKelas, setSelectedKelas] = useState('');
    const [semester, setSemester] = useState('ganjil');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Tambah state untuk sorting dan filtering
    const [searchValues, setSearchValues] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        // Fetch kelas options
        const fetchClasses = async () => {
            try {
                const data = await apiCall('/api/admin/classes', {
                   onLogout: createSessionExpiredHandler(onLogout, toast)
                });
                const classNames = data.map((c: { nama_kelas: string }) => c.nama_kelas);
                setKelasOptions(classNames);
                if (classNames.length > 0) setSelectedKelas(classNames[0]);
            } catch (error) {
                console.error("Error fetching classes", error);
            }
        };
        fetchClasses();
    }, [onLogout]);

    useEffect(() => {
        if (selectedKelas) {
            fetchReportData();
        }
    }, [selectedKelas, semester]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const data = await apiCall(`/api/admin/reports/student-summary?kelas=${selectedKelas}&semester=${semester}`, {
                 onLogout: createSessionExpiredHandler(onLogout, toast)
            });
            setReportData(data);
        } catch (error) {
            console.error("Error fetching report data", error);
            toast({
                title: "Error",
                description: "Gagal memuat data laporan",
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
          String(item.nis).toLowerCase().includes(lowerSearch)
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
            const headers = ['No', 'Nama', 'NIS', 'Kelas', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispen', 'Persentase'];
            const rows = filteredData.map((item, index) => [
                index + 1,
                `"${item.nama}"`,
                `"${item.nis}"`,
                `"${item.kelas}"`,
                item.hadir,
                item.izin,
                item.sakit,
                item.alpa,
                item.dispen || 0,
                `"${item.presentase}"`
            ]);

            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `rekap_absensi_siswa_${selectedKelas}_${semester}_${getCurrentDateWIB()}.csv`);
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
                    <h2 className="text-2xl font-bold text-gray-800">Rekapitulasi Absensi Siswa</h2>
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
                        Laporan Per Kelas
                    </CardTitle>
                    <CardDescription>
                        Lihat ringkasan kehadiran siswa berdasarkan kelas dan semester
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="w-full md:w-64">
                            <label className="text-sm font-medium mb-1 block">Pilih Kelas</label>
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                                    value={selectedKelas}
                                    onChange={(e) => setSelectedKelas(e.target.value)}
                                >
                                    {kelasOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="w-full md:w-48">
                            <label className="text-sm font-medium mb-1 block">Semester</label>
                            <select
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                                value={semester}
                                onChange={(e) => setSemester(e.target.value)}
                            >
                                <option value="ganjil">Ganjil</option>
                                <option value="genap">Genap</option>
                            </select>
                        </div>
                        
                        <div className="w-full md:w-64">
                             <label className="text-sm font-medium mb-1 block">Cari Siswa</label>
                             <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Nama atau NIS..." 
                                    className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
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
                                            <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('nis')}>
                                                NIS {sortConfig?.key === 'nis' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </TableHead>
                                            <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('nama')}>
                                                Nama {sortConfig?.key === 'nama' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </TableHead>
                                            <TableHead>Hadir</TableHead>
                                            <TableHead>Izin</TableHead>
                                            <TableHead>Sakit</TableHead>
                                            <TableHead>Alpa</TableHead>
                                            <TableHead>Dispen</TableHead>
                                            <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('presentase')}>
                                                % Kehadiran {sortConfig?.key === 'presentase' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentData.map((row, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>{(currentPage - 1) * itemsPerPage + idx + 1}</TableCell>
                                                <TableCell>{row.nis}</TableCell>
                                                <TableCell className="font-medium">{row.nama}</TableCell>
                                                <TableCell className="text-green-600 font-medium">{row.hadir}</TableCell>
                                                <TableCell className="text-blue-600">{row.izin}</TableCell>
                                                <TableCell className="text-yellow-600">{row.sakit}</TableCell>
                                                <TableCell className="text-red-600 font-bold">{row.alpa}</TableCell>
                                                <TableCell className="text-purple-600">{row['dispen'] || 0}</TableCell>
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
                                    <div className="text-sm text-gray-600">
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
                        <div className="text-center py-12 text-gray-500">
                            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Tidak ada data laporan untuk kelas ini</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default StudentAttendanceSummaryView;
