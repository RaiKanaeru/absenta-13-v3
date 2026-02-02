import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ArrowLeft, Download, Search, FileText, Users, Calendar } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useLetterhead } from '../hooks/useLetterhead';

import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { Kelas, Siswa } from '@/types/school';

interface PresensiData {
  siswa_id: number;
  tanggal: string;
  status: 'Hadir' | 'Sakit' | 'Alpa' | 'Izin' | 'Dispen';
  keterangan?: string;
}

const PresensiSiswaView: React.FC<{ onBack: () => void; onLogout: () => void }> = ({ onBack, onLogout }) => {
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [selectedBulan, setSelectedBulan] = useState<string>('');
  const [selectedTahun, setSelectedTahun] = useState<string>(new Date().getFullYear().toString());
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [students, setStudents] = useState<Siswa[]>([]);
  const [presensiData, setPresensiData] = useState<PresensiData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use letterhead hook for consistent kop laporan
  const { letterhead } = useLetterhead('REPORT_PRESENSI_SISWA');


  // Fetch classes
  const fetchClasses = useCallback(async () => {
    try {
      setError(null);
      const data = await apiCall('/api/kelas', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      setError(error instanceof Error ? error.message : 'Gagal memuat data kelas');
    }
  }, []);

  // Fetch students by class
  const fetchStudents = useCallback(async (kelasId: string) => {
    if (!kelasId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall(`/api/admin/students-by-class/${kelasId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
      setError(error instanceof Error ? error.message : 'Gagal memuat data siswa');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch presensi data
  const fetchPresensiData = useCallback(async (kelasId: string, bulan: string, tahun: string) => {
    if (!kelasId || !bulan || !tahun) return;
    
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        kelas_id: kelasId,
        bulan: bulan,
        tahun: tahun
      });

      const data = await apiCall(`/api/admin/presensi-siswa?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      setPresensiData(data);
    } catch (error) {
      console.error('Error fetching presensi data:', error);
      setError(error instanceof Error ? error.message : 'Gagal memuat data presensi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (selectedKelas) {
      fetchStudents(selectedKelas);
    }
  }, [selectedKelas, fetchStudents]);

  useEffect(() => {
    if (selectedKelas && selectedBulan && selectedTahun) {
      fetchPresensiData(selectedKelas, selectedBulan, selectedTahun);
    }
  }, [selectedKelas, selectedBulan, selectedTahun, fetchPresensiData]);

  // Get presensi status for specific student and date
  const getPresensiStatus = (siswaId: number, tanggal: number): string => {
    const dateStr = `${selectedTahun}-${selectedBulan.padStart(2, '0')}-${tanggal.toString().padStart(2, '0')}`;
    
    // Find presensi by matching date string (database returns ISO string, we need to extract date part)
    const presensi = presensiData.find(p => {
      const presensiDate = new Date(p.tanggal).toISOString().split('T')[0];
      return p.siswa_id === siswaId && presensiDate === dateStr;
    });
    
    
    if (!presensi) return '';
    
    // Convert full status to short format
    const statusMap: { [key: string]: string } = {
      'Hadir': 'H',
      'Sakit': 'S', 
      'Alpa': 'A',
      'Izin': 'I',
      'Dispen': 'D'
    };
    
    return statusMap[presensi.status] || presensi.status;
  };

  // Get keterangan for specific student and date
  const getKeterangan = (siswaId: number, tanggal: number): string => {
    const dateStr = `${selectedTahun}-${selectedBulan.padStart(2, '0')}-${tanggal.toString().padStart(2, '0')}`;
    
    // Find presensi by matching date string (database returns ISO string, we need to extract date part)
    const presensi = presensiData.find(p => {
      const presensiDate = new Date(p.tanggal).toISOString().split('T')[0];
      return p.siswa_id === siswaId && presensiDate === dateStr;
    });
    
    return presensi ? (presensi.keterangan || '') : '';
  };


  // Count students by gender
  const countByGender = () => {
    const lakiLaki = students.filter(s => s.jenis_kelamin === 'L').length;
    const perempuan = students.filter(s => s.jenis_kelamin === 'P').length;
    return { lakiLaki, perempuan };
  };

  // Generate days in month
  const getDaysInMonth = (month: string, year: string): number[] => {
    if (!month || !year) return [];
    const daysInMonth = new Date(Number.parseInt(year), Number.parseInt(month), 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (!selectedKelas || !selectedBulan || !selectedTahun) {
      toast({
        title: "Error",
        description: "Pilih kelas, bulan, dan tahun terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        kelas_id: selectedKelas,
        bulan: selectedBulan,
        tahun: selectedTahun,
      });

      const blob = await apiCall<Blob>(`/api/export/presensi-siswa?${params.toString()}`, {
        responseType: 'blob',
        onLogout
      });
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const kelasName = classes.find(c => c.id.toString() === selectedKelas)?.nama_kelas || 'Unknown';
      const bulanName = new Date(Number.parseInt(selectedTahun), Number.parseInt(selectedBulan) - 1).toLocaleDateString('id-ID', { month: 'long' });
      const fileName = `Presensi_Siswa_${kelasName}_${bulanName}_${selectedTahun}.xlsx`;
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Berhasil",
        description: "Data presensi berhasil diekspor ke Excel",
      });
    } catch (error) {
      console.error('Export error:', error);
      const message = getErrorMessage(error) || "Gagal mengekspor data presensi ke Excel";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = getDaysInMonth(selectedBulan, selectedTahun);
  const { lakiLaki, perempuan } = countByGender();

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={onBack}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Presensi Siswa</h1>
              <p className="text-muted-foreground">Format presensi siswa sesuai standar SMKN 13</p>
            </div>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kelas">Kelas</Label>
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((kelas) => (
                    <SelectItem key={kelas.id} value={kelas.id.toString()}>
                      {kelas.nama_kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bulan">Bulan</Label>
              <Select value={selectedBulan} onValueChange={setSelectedBulan}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Bulan" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = (i + 1).toString();
                    const monthName = new Date(2024, i).toLocaleString('id-ID', { month: 'long' });
                    return (
                      <SelectItem key={month} value={month}>
                        {monthName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tahun">Tahun</Label>
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

      {/* Presensi Table */}
      {selectedKelas && selectedBulan && selectedTahun && students.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Presensi Siswa - {classes.find(c => c.id.toString() === selectedKelas)?.nama_kelas}</span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleExportExcel}
                  disabled={loading || !selectedKelas || !selectedBulan || !selectedTahun}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {loading ? 'Exporting...' : 'Export Excel'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {/* School Header */}
              <div className="text-center mb-6 p-4 bg-card border-2 border-border">
                {letterhead && letterhead.enabled && letterhead.lines && letterhead.lines.length > 0 ? (
                  <>
                    {/* Logo kiri dan kanan jika tersedia */}
                    {(letterhead.logoLeftUrl || letterhead.logoRightUrl) && (
                      <div className="flex justify-between items-center mb-4">
                        {letterhead.logoLeftUrl && (
                          <img 
                            src={letterhead.logoLeftUrl} 
                            alt="Logo Kiri" 
                            className="h-16 object-contain"
                          />
                        )}
                        <div className="flex-1"></div>
                        {letterhead.logoRightUrl && (
                          <img 
                            src={letterhead.logoRightUrl} 
                            alt="Logo Kanan" 
                            className="h-16 object-contain"
                          />
                        )}
                      </div>
                    )}
                    
                    {/* Baris teks kop laporan */}
                    {letterhead.lines.map((line, index) => (
                      <div 
                        key={index} 
                        className={`text-sm ${line.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}`}
                        style={{ textAlign: letterhead.alignment }}
                      >
                        {line.text}
                      </div>
                    ))}
                    
                    <div className="text-lg font-bold mt-4">
                      PRESENSI SISWA
                    </div>
                    <div className="text-sm">
                      TAHUN PELAJARAN {selectedTahun}/{Number.parseInt(selectedTahun) + 1}
                    </div>
                    <div className="text-sm font-bold">
                      KELAS {classes.find(c => c.id.toString() === selectedKelas)?.nama_kelas}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-bold">
                      PEMERINTAH DAERAH PROVINSI JAWA BARAT<br />
                      DINAS PENDIDIKAN<br />
                      CABANG DINAS PENDIDIKAN WILAYAH VII<br />
                      SEKOLAH MENENGAH KEJURUAN NEGERI 13
                    </div>
                    <div className="text-xs mt-2">
                      Jalan Soekarno - Hatta Km.10 Telepon (022) 7318960: Ext. 114<br />
                      Telepon/Faksimil: (022) 7332252 – Bandung 40286<br />
                      Email: smk13bdg@gmail.com Home page: http://www.smkn13.sch.id
                    </div>
                    <div className="text-lg font-bold mt-4">
                      PRESENSI SISWA
                    </div>
                    <div className="text-sm">
                      TAHUN PELAJARAN {selectedTahun}/{Number.parseInt(selectedTahun) + 1}
                    </div>
                    <div className="text-sm font-bold">
                      KELAS {classes.find(c => c.id.toString() === selectedKelas)?.nama_kelas}
                    </div>
                  </>
                )}
              </div>

              {/* Presensi Table */}
              <div className="border-2 border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted border-b-2 border-border">
                      <th className="border border-border p-2 text-center w-12">NO</th>
                      <th className="border border-border p-2 text-center w-32">NIS / NISN</th>
                      <th className="border border-border p-2 text-center w-48">NAMA</th>
                      <th className="border border-border p-2 text-center w-8">L/P</th>
                      <th className="border border-border p-2 text-center" colSpan={daysInMonth.length}>
                        PERTEMUAN
                      </th>
                      <th className="border border-border p-2 text-center w-20">KET</th>
                    </tr>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="border border-border p-1"></th>
                      <th className="border border-border p-1"></th>
                      <th className="border border-border p-1"></th>
                      <th className="border border-border p-1"></th>
                      {daysInMonth.map((day) => (
                        <th key={day} className="border border-border p-1 text-center w-8">
                          {day}
                        </th>
                      ))}
                      <th className="border border-border p-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((siswa, index) => (
                      <tr key={siswa.id} className="hover:bg-muted/50">
                        <td className="border border-border p-2 text-center">{index + 1}</td>
                        <td className="border border-border p-2 text-center">
                          {siswa.nis} / {siswa.nisn}
                        </td>
                        <td className="border border-border p-2">{siswa.nama}</td>
                        <td className="border border-border p-2 text-center">{siswa.jenis_kelamin}</td>
                        {daysInMonth.map((day) => {
                          const status = getPresensiStatus(siswa.id, day);
                          return (
                            <td key={day} className="border border-border p-1 text-center">
                              {status && (
                                <span className={`px-1 py-0.5 text-xs rounded ${
                                  status === 'H' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                                  status === 'S' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400' :
                                  status === 'A' ? 'bg-destructive/15 text-destructive' :
                                  status === 'I' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' :
                                  status === 'D' ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {status}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="border border-border p-2 text-center">
                          {(() => {
                            // Collect all keterangan for this student
                            const keteranganList = daysInMonth
                              .map(day => {
                                const keterangan = getKeterangan(siswa.id, day);
                                return keterangan ? { day, keterangan } : null;
                              })
                              .filter(Boolean);
                            
                            return keteranganList.length > 0 ? (
                              <div className="text-xs text-muted-foreground text-left max-w-32">
                                {keteranganList.map((item, idx) => (
                                  <div key={idx} className="mb-1">
                                    <span className="font-semibold text-primary">{item.day}:</span> {item.keterangan}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Section */}
              <div className="mt-4 flex justify-between">
                <div className="text-sm">
                  <div className="font-bold">JUMLAH</div>
                  <div>LAKI-LAKI = {lakiLaki}</div>
                  <div>PEREMPUAN = {perempuan}</div>
                  <div className="mt-2">
                    <div className="font-bold">KETERANGAN:</div>
                    <div>H: Hadir</div>
                    <div>S: Sakit</div>
                    <div>A: Alpa</div>
                    <div>I: Izin</div>
                    <div>D: Dispen</div>
                  </div>
                </div>
                <div className="text-sm text-right">
                  <div>Guru Mata Pelajaran</div>
                  <div className="mt-8">
                    <div className="border-b border-border w-32 mb-1"></div>
                    <div className="text-xs">(___________________)</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && (!selectedKelas || !selectedBulan || !selectedTahun) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Pilih Filter</h3>
            <p className="text-muted-foreground text-center">Pilih kelas, bulan, dan tahun untuk melihat presensi siswa</p>
          </CardContent>
        </Card>
      )}

      {!loading && selectedKelas && selectedBulan && selectedTahun && students.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Tidak ada siswa</h3>
            <p className="text-muted-foreground text-center">Tidak ada siswa ditemukan untuk kelas yang dipilih</p>
          </CardContent>
        </Card>
      )}

      {!loading && selectedKelas && selectedBulan && selectedTahun && students.length > 0 && presensiData.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Tidak ada data presensi</h3>
            <p className="text-muted-foreground text-center">Tidak ada data presensi untuk periode yang dipilih. Pastikan ada data absensi siswa untuk kelas dan periode yang dipilih.</p>
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

export default PresensiSiswaView;
