import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Search, Users, Calendar, BarChart3, Loader2, FileText } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useLetterhead } from '../hooks/useLetterhead';
import { useExcelDownload } from '@/hooks/useExcelDownload';
import { ExportButton } from '@/components/shared/ExportButton';
import { ErrorAlert } from '@/components/shared/ErrorAlert';

import { ReportLetterhead } from './ui/report-letterhead';
import { ReportSummary } from './ui/report-summary';
import { getCurrentYearWIB, formatDateOnly } from '../lib/time-utils';
import { ACADEMIC_MONTHS, getMonthName } from '../lib/academic-constants';
import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { downloadPdf } from '@/utils/exportUtils';

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
  const [exporting, setExporting] = useState(false);
  const { downloadExcel, exporting: excelExporting } = useExcelDownload();

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

      const data = await apiCall<RekapGuru[]>(`/api/admin/rekap-ketidakhadiran-guru?${params}`);

      setRekapData(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal memuat rekap", description: error instanceof Error ? error.message : "Terjadi kesalahan" });
      setError(error instanceof Error ? error.message : 'Gagal memuat data rekap');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExportExcel = async () => {
    const params = new URLSearchParams({ tahun: selectedTahun });
    await downloadExcel({
      endpoint: '/api/export/rekap-ketidakhadiran-guru',
      params,
      fileName: `REKAP_KETIDAKHADIRAN_GURU_${selectedTahun}.xlsx`,
      onLogout,
    });
  };

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({ tahun: selectedTahun });
      await downloadPdf('/api/export/pdf/rekap-ketidakhadiran-guru', `REKAP_KETIDAKHADIRAN_GURU_${selectedTahun}`, params, onLogout);

      toast({
        title: "Berhasil",
        description: "File PDF berhasil diunduh"
      });
    } catch (error) {
      const message = getErrorMessage(error) || "Gagal mengunduh file PDF";
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setExporting(false);
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

  // Use shared getEffectiveDays from academic-constants instead of local function

  let periodInfo: string | undefined;
  if (viewMode === 'bulanan' && selectedBulan) {
    periodInfo = `BULAN ${getMonthName(Number.parseInt(selectedBulan)).toUpperCase()}`;
  } else if (viewMode === 'tanggal' && selectedTanggalAwal && selectedTanggalAkhir) {
    periodInfo = `PERIODE ${formatDateOnly(selectedTanggalAwal)} - ${formatDateOnly(selectedTanggalAkhir)}`;
  }

  function renderPeriodHeader() {
    if (viewMode === 'tahunan') {
      return (
        <>
          {ACADEMIC_MONTHS.map((month) => (
            <th key={month.key} className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">
              {month.key}
            </th>
          ))}
        </>
      );
    }

    if (viewMode === 'bulanan') {
      return (
        <th className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">
          {ACADEMIC_MONTHS.find(m => m.number.toString() === selectedBulan)?.key}
        </th>
      );
    }

    return (
      <th className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">
        PERIODE TANGGAL
      </th>
    );
  }

  function renderPeriodValueCell(guru: RekapGuru) {
    if (viewMode === 'tahunan') {
      return (
        <>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.jul || 0}</td>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.agt || 0}</td>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.sep || 0}</td>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.okt || 0}</td>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.nov || 0}</td>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.des || 0}</td>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.jan || 0}</td>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.feb || 0}</td>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.mar || 0}</td>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.apr || 0}</td>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.mei || 0}</td>
          <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">{guru.jun || 0}</td>
        </>
      );
    }

    if (viewMode === 'bulanan') {
      const monthNumber = Number.parseInt(selectedBulan);
      const monthValue = (() => {
        switch (monthNumber) {
          case 7: return guru.jul;
          case 8: return guru.agt;
          case 9: return guru.sep;
          case 10: return guru.okt;
          case 11: return guru.nov;
          case 12: return guru.des;
          case 1: return guru.jan;
          case 2: return guru.feb;
          case 3: return guru.mar;
          case 4: return guru.apr;
          case 5: return guru.mei;
          case 6: return guru.jun;
          default: return 0;
        }
      })();

      return (
        <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">
          {monthValue || 0}
        </td>
      );
    }

    return (
      <td className="border border-border p-2 text-center bg-blue-500/10 dark:bg-blue-500/20">
        {guru.total_ketidakhadiran || 0}
      </td>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Rekap Ketidakhadiran Guru</h1>
              <p className="text-muted-foreground">Format rekap ketidakhadiran sesuai standar SMKN 13</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onClick={handleExportExcel}
            loading={excelExporting}
            disabled={loading || !selectedTahun || exporting}
            className="flex items-center gap-2"
            variant="outline"
          />
          <Button
            onClick={handleExportPdf}
            disabled={loading || !selectedTahun || exporting || excelExporting}
            className="flex items-center gap-2"
            variant="outline"
          >
            {exporting || excelExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengekspor...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Export PDF
              </>
            )}
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
        <div className="mb-6">
          <ErrorAlert message={error} />
        </div>
      )}

      {/* Rekap Table */}
      {selectedTahun && (
        (viewMode === 'tahunan') ||
        (viewMode === 'bulanan' && selectedBulan) ||
        (viewMode === 'tanggal' && selectedTanggalAwal && selectedTanggalAkhir)
      ) && (
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
                periodInfo={periodInfo}
              />

              {/* Rekap Table */}
              <div className="border-2 border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted border-b-2 border-border">
                      <th className="border border-border p-2 text-center w-12">NO.</th>
                      <th className="border border-border p-2 text-center w-48">NAMA GURU</th>
                      {renderPeriodHeader()}
                      <th className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 w-24">JUMLAH KETIDAKHADIRAN</th>
                      <th className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 w-32">PERSENTASE KETIDAKHADIRAN (%)</th>
                      <th className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 w-32">PERSENTASE KEHADIRAN (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapData.map((guru, index) => (
                      <tr key={guru.id} className="hover:bg-muted">
                        <td className="border border-border p-2 text-center">{index + 1}</td>
                        <td className="border border-border p-2">{guru.nama_guru}</td>
                        {renderPeriodValueCell(guru)}
                        <td className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 font-semibold">
                          {guru.total_ketidakhadiran || 0}
                        </td>
                        <td className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 font-semibold">
                          {Number.parseFloat(String(guru.persentase_ketidakhadiran || '0')).toFixed(2)}
                        </td>
                        <td className="border border-border p-2 text-center bg-emerald-500/10 dark:bg-emerald-500/20 font-semibold">
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
            <Calendar className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Pilih Filter</h3>
            <p className="text-muted-foreground text-center">Pilih tahun untuk melihat rekap ketidakhadiran guru</p>
          </CardContent>
        </Card>
      )}

      {!loading && selectedTahun && rekapData.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Tidak ada data rekap</h3>
            <p className="text-muted-foreground text-center">Tidak ada data rekap ketidakhadiran guru untuk periode yang dipilih. Pastikan ada data absensi guru untuk periode yang dipilih.</p>
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
