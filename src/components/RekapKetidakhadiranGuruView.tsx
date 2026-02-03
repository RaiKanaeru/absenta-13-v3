import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ArrowLeft, Download, Search, Users, Calendar, BarChart3 } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useLetterhead } from '../hooks/useLetterhead';

import { ReportLetterhead } from './ui/report-letterhead';
import { ReportSummary } from './ui/report-summary';
import { getCurrentYearWIB, formatDateOnly } from '../lib/time-utils';
import { ACADEMIC_MONTHS, getMonthName } from '../lib/academic-constants';
import { apiCall, getErrorMessage } from '@/utils/apiClient';

interface Kelas {
  id: number;
  nama_kelas: string;
}

interface RekapGuru {
  id: number;
  nama_guru: string;
  nip: string;
  bulan?: number;
  tahun?: number;
  total_ketidakhadiran: number;
  total_kehadiran: number;
  total_hari_efektif: number;
  persentase_ketidakhadiran: string | number;
  persentase_kehadiran: string | number;
  jul?: number;
  agt?: number;
  sep?: number;
  okt?: number;
  nov?: number;
  des?: number;
  jan?: number;
  feb?: number;
  mar?: number;
  apr?: number;
  mei?: number;
  jun?: number;
  detail_ketidakhadiran?: {
    tanggal: string;
    status: 'S' | 'A' | 'I';
    keterangan?: string;
  }[];
}

interface RekapKetidakhadiranGuruViewProps {
  onBack: () => void;
  onLogout: () => void;
}

const RekapKetidakhadiranGuruView: React.FC<RekapKetidakhadiranGuruViewProps> = ({
  onBack,
  onLogout
}) => {
  const [selectedTahun, setSelectedTahun] = useState<string>(getCurrentYearWIB());
  const [selectedBulan, setSelectedBulan] = useState<string>('');
  const [selectedTanggalAwal, setSelectedTanggalAwal] = useState<string>('');
  const [selectedTanggalAkhir, setSelectedTanggalAkhir] = useState<string>('');
  const [viewMode, setViewMode] = useState<'tahunan' | 'bulanan' | 'tanggal'>('tahunan');
  const [rekapData, setRekapData] = useState<RekapGuru[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use letterhead hook for consistent kop laporan
  const { letterhead } = useLetterhead('REPORT_REKAP_KETIDAKHADIRAN_GURU');

  // Use shared academic months constant


  // Fetch rekap data
  const fetchRekapData = useCallback(async (tahun: string, bulan?: string, tanggalAwal?: string, tanggalAkhir?: string) => {
    if (!tahun) return;
    
    
    try {
      setError(null);
      setLoading(true);
      const params = new URLSearchParams({
        tahun: tahun
      });

      if (bulan) {
        params.append('bulan', bulan);
      }

      if (tanggalAwal && tanggalAkhir) {
        params.append('tanggal_awal', tanggalAwal);
        params.append('tanggal_akhir', tanggalAkhir);
      }

      const data = await apiCall<RekapGuru[]>(`/api/admin/rekap-ketidakhadiran-guru?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      setRekapData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching rekap data:', error);
      setError(error instanceof Error ? error.message : 'Gagal memuat data rekap');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExportExcel = async () => {
    try {
      const blob = await apiCall<Blob>(`/api/export/rekap-ketidakhadiran-guru?tahun=${selectedTahun}`, {
        responseType: 'blob',
        onLogout
      });
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `REKAP_KETIDAKHADIRAN_GURU_${selectedTahun}.xlsx`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Berhasil",
        description: "File Excel berhasil diunduh"
      });
    } catch (error) {
      console.error('Export error:', error);
      const message = getErrorMessage(error) || "Gagal mengunduh file Excel";
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    }
  };

  const handleExportSMKN13 = async () => {
    try {
      const blob = await apiCall<Blob>(`/api/export/rekap-ketidakhadiran-guru-smkn13?tahun=${selectedTahun}`, {
        responseType: 'blob',
        onLogout
      });
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `REKAP_KETIDAKHADIRAN_GURU_${selectedTahun}.xlsx`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Berhasil",
        description: "File Excel SMKN 13 berhasil diunduh"
      });
    } catch (error) {
      console.error('Export error:', error);
      const message = getErrorMessage(error) || "Gagal mengunduh file Excel SMKN 13";
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    }
  };


  useEffect(() => {
    if (selectedTahun) {
      if (viewMode === 'bulanan' && selectedBulan) {
        fetchRekapData(selectedTahun, selectedBulan);
      } else if (viewMode === 'tanggal' && selectedTanggalAwal && selectedTanggalAkhir) {
        fetchRekapData(selectedTahun, undefined, selectedTanggalAwal, selectedTanggalAkhir);
      } else if (viewMode === 'tahunan') {
        fetchRekapData(selectedTahun);
      }
    }
  }, [selectedTahun, selectedBulan, selectedTanggalAwal, selectedTanggalAkhir, viewMode, fetchRekapData]);

  // Get rekap data for specific teacher and month
  const getRekapForTeacher = (guruId: number, monthNumber: number) => {
    return rekapData.find(p => p.id === guruId && p.bulan === monthNumber);
  };

  // Get rekap data for specific teacher in date range
  const getRekapForTeacherByDate = (guruId: number) => {
    return rekapData.find(p => p.id === guruId);
  };

  // Get total ketidakhadiran for teacher
  const getTotalKetidakhadiran = (guruId: number) => {
    const teacherData = rekapData.filter(p => p.id === guruId);
    return teacherData.reduce((total, data) => total + data.total_ketidakhadiran, 0);
  };

  // Get total persentase ketidakhadiran for teacher
  const getTotalPersentaseKetidakhadiran = (guruId: number) => {
    const teacherData = rekapData.filter(p => p.id === guruId);
    if (teacherData.length === 0) return 0;
    
    // Gunakan persentase yang sudah dihitung dari API
    const data = teacherData[0];
    return data ? (data.persentase_ketidakhadiran || 0) : 0;
  };

  // Get total persentase kehadiran for teacher
  const getTotalPersentaseKehadiran = (guruId: number) => {
    const teacherData = rekapData.filter(p => p.id === guruId);
    if (teacherData.length === 0) return 100;
    
    // Gunakan persentase yang sudah dihitung dari API
    const data = teacherData[0];
    return data ? (data.persentase_kehadiran || 100) : 100;
  };

  // Use shared getEffectiveDays from academic-constants instead of local function

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rekap Ketidakhadiran Guru</h1>
              <p className="text-gray-600">Format rekap ketidakhadiran sesuai standar SMKN 13</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportExcel}
            disabled={loading || !selectedTahun}
            className="flex items-center gap-2"
            variant="outline"
          >
            <Download className="w-4 h-4" />
            {loading ? 'Exporting...' : 'Export Excel'}
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Filter Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-1 gap-4 ${viewMode === 'tanggal' ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            <div className="space-y-2">
              <Label htmlFor="tahun">Tahun Pelajaran</Label>
              <Input
                id="tahun"
                type="number"
                value={selectedTahun}
                onChange={(e) => setSelectedTahun(e.target.value)}
                placeholder="Tahun"
                min="2020"
                max="2030"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="viewMode">Mode Tampilan</Label>
              <Select value={viewMode} onValueChange={(value: 'tahunan' | 'bulanan' | 'tanggal') => setViewMode(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tahunan">Tahunan (Juli-Juni)</SelectItem>
                  <SelectItem value="bulanan">Bulanan</SelectItem>
                  <SelectItem value="tanggal">Berdasarkan Tanggal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {viewMode === 'bulanan' && (
              <div className="space-y-2">
                <Label htmlFor="bulan">Bulan</Label>
                <Select value={selectedBulan} onValueChange={setSelectedBulan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACADEMIC_MONTHS.map((month) => (
                      <SelectItem key={month.number} value={month.number.toString()}>
                        {month.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {viewMode === 'tanggal' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tanggalAwal">Tanggal Awal</Label>
                  <Input
                    id="tanggalAwal"
                    type="date"
                    value={selectedTanggalAwal}
                    onChange={(e) => setSelectedTanggalAwal(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanggalAkhir">Tanggal Akhir</Label>
                  <Input
                    id="tanggalAkhir"
                    type="date"
                    value={selectedTanggalAkhir}
                    onChange={(e) => setSelectedTanggalAkhir(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Rekap Table */}
      {selectedTahun && (viewMode === 'tahunan' || (viewMode === 'bulanan' && selectedBulan) || (viewMode === 'tanggal' && selectedTanggalAwal && selectedTanggalAkhir)) && (
        <Card>
          <CardHeader>
            <CardTitle>
              Rekap Ketidakhadiran Guru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {/* School Header - Using shared component */}
              <ReportLetterhead
                letterhead={letterhead}
                reportTitle="REKAP KETIDAKHADIRAN GURU"
                selectedTahun={selectedTahun}
                periodInfo={
                  viewMode === 'bulanan' && selectedBulan
                    ? `BULAN ${getMonthName(Number.parseInt(selectedBulan)).toUpperCase()}`
                    : viewMode === 'tanggal' && selectedTanggalAwal && selectedTanggalAkhir
                    ? `PERIODE ${formatDateOnly(selectedTanggalAwal)} - ${formatDateOnly(selectedTanggalAkhir)}`
                    : undefined
                }
              />

              {/* Rekap Table */}
              <div className="border-2 border-gray-400">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-400">
                      <th className="border border-gray-300 p-2 text-center w-12">NO.</th>
                      <th className="border border-gray-300 p-2 text-center w-48">NAMA GURU</th>
                      {viewMode === 'tahunan' ? (
                        <>
                          {ACADEMIC_MONTHS.map((month) => (
                            <th key={month.key} className="border border-gray-300 p-2 text-center bg-blue-100">
                              {month.key}
                            </th>
                          ))}
                        </>
                      ) : viewMode === 'bulanan' ? (
                        <th className="border border-gray-300 p-2 text-center bg-blue-100">
                          {ACADEMIC_MONTHS.find(m => m.number.toString() === selectedBulan)?.key}
                        </th>
                      ) : (
                        <th className="border border-gray-300 p-2 text-center bg-blue-100">
                          PERIODE TANGGAL
                        </th>
                      )}
                      <th className="border border-gray-300 p-2 text-center bg-green-100 w-24">JUMLAH KETIDAKHADIRAN</th>
                      <th className="border border-gray-300 p-2 text-center bg-green-100 w-32">PERSENTASE KETIDAKHADIRAN (%)</th>
                      <th className="border border-gray-300 p-2 text-center bg-green-100 w-32">PERSENTASE KEHADIRAN (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapData.map((guru, index) => (
                      <tr key={guru.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                        <td className="border border-gray-300 p-2">{guru.nama_guru}</td>
                        {viewMode === 'tahunan' ? (
                          <>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.jul || 0}
                            </td>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.agt || 0}
                            </td>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.sep || 0}
                            </td>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.okt || 0}
                            </td>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.nov || 0}
                            </td>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.des || 0}
                            </td>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.jan || 0}
                            </td>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.feb || 0}
                            </td>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.mar || 0}
                            </td>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.apr || 0}
                            </td>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.mei || 0}
                            </td>
                            <td className="border border-gray-300 p-2 text-center bg-blue-50">
                              {guru.jun || 0}
                            </td>
                          </>
                        ) : viewMode === 'bulanan' ? (
                          <td className="border border-gray-300 p-2 text-center bg-blue-50">
                            {(() => {
                              const monthNumber = Number.parseInt(selectedBulan);
                              const monthData = {
                                7: guru.jul, 8: guru.agt, 9: guru.sep, 10: guru.okt, 11: guru.nov, 12: guru.des,
                                1: guru.jan, 2: guru.feb, 3: guru.mar, 4: guru.apr, 5: guru.mei, 6: guru.jun
                              };
                              return monthData[monthNumber] || 0;
                            })()}
                          </td>
                        ) : (
                          <td className="border border-gray-300 p-2 text-center bg-blue-50">
                            {guru.total_ketidakhadiran || 0}
                          </td>
                        )}
                        <td className="border border-gray-300 p-2 text-center bg-green-50 font-semibold">
                          {guru.total_ketidakhadiran || 0}
                        </td>
                        <td className="border border-gray-300 p-2 text-center bg-green-50 font-semibold">
                          {Number.parseFloat(String(guru.persentase_ketidakhadiran || '0')).toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center bg-green-50 font-semibold">
                          {Number.parseFloat(String(guru.persentase_kehadiran || '100')).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Section - Using shared component */}
              <ReportSummary
                viewMode={viewMode}
                selectedBulan={selectedBulan}
                selectedTanggalAwal={selectedTanggalAwal}
                selectedTanggalAkhir={selectedTanggalAkhir}
              />
            </div>
          </CardContent>
        </Card>
      )}


      {/* Empty State */}
      {!loading && !selectedTahun && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Pilih Filter</h3>
            <p className="text-gray-500 text-center">Pilih tahun untuk melihat rekap ketidakhadiran guru</p>
          </CardContent>
        </Card>
      )}

      {!loading && selectedTahun && rekapData.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada data rekap</h3>
            <p className="text-gray-500 text-center">Tidak ada data rekap ketidakhadiran guru untuk periode yang dipilih. Pastikan ada data absensi guru untuk periode yang dipilih.</p>
          </CardContent>
        </Card>
      )}

      {/* Letterhead Initialization Button */}
      <div className="mt-6">
        {/* SimpleLetterheadInit removed - logo initialization handled elsewhere */}
      </div>
    </div>
  );
};

export default RekapKetidakhadiranGuruView;
