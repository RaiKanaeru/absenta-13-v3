import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MessageCircle } from 'lucide-react';
import { getCurrentDateWIB } from '@/lib/time-utils';
import { BandingList } from './StudentDashboardComponents';
import type { BandingAbsen, FormBanding, StatusType, JadwalHariIni } from '@/types/student';

// =============================================================================
// PROPS
// =============================================================================

export interface BandingAbsenTabProps {
  bandingAbsen: BandingAbsen[];
  expandedBanding: number | null;
  setExpandedBanding: (id: number | null) => void;
  showFormBanding: boolean;
  setShowFormBanding: (show: boolean) => void;
  formBanding: FormBanding;
  setFormBanding: (form: FormBanding) => void;
  jadwalBerdasarkanTanggal: JadwalHariIni[];
  setJadwalBerdasarkanTanggal: (jadwal: JadwalHariIni[]) => void;
  loadingJadwal: boolean;
  selectedSiswaId: number | null;
  setSelectedSiswaId: (id: number | null) => void;
  daftarSiswa: Array<{ id?: number; id_siswa?: number; nama: string }>;
  bandingAbsenPage: number;
  setBandingAbsenPage: (page: number) => void;
  itemsPerPage: number;
  submitBandingAbsen: (e: React.FormEvent | React.MouseEvent) => void;
  loadJadwalBandingByDate: (tanggal: string) => void;
  loadSiswaStatusById: (siswaId: number, tanggal: string, jadwalId: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const BandingAbsenTab: React.FC<BandingAbsenTabProps> = ({
  bandingAbsen,
  expandedBanding,
  setExpandedBanding,
  showFormBanding,
  setShowFormBanding,
  formBanding,
  setFormBanding,
  jadwalBerdasarkanTanggal,
  setJadwalBerdasarkanTanggal,
  loadingJadwal,
  selectedSiswaId,
  setSelectedSiswaId,
  daftarSiswa,
  bandingAbsenPage,
  setBandingAbsenPage,
  itemsPerPage,
  submitBandingAbsen,
  loadJadwalBandingByDate,
  loadSiswaStatusById,
}) => {
  let jadwalPlaceholder = "Pilih jadwal pelajaran...";
  if (formBanding.tanggal_absen === '') {
    jadwalPlaceholder = "Pilih tanggal absen terlebih dahulu...";
  } else if (loadingJadwal) {
    jadwalPlaceholder = "Memuat jadwal...";
  }

  let jadwalOptions: React.ReactNode = null;
  if (jadwalBerdasarkanTanggal && jadwalBerdasarkanTanggal.length > 0) {
    jadwalOptions = jadwalBerdasarkanTanggal.map((j) => (
      <option key={j.id_jadwal} value={j.id_jadwal}>
        {j.nama_mapel} ({j.jam_mulai}-{j.jam_selesai}) - {j.nama_guru}
      </option>
    ));
  } else if (formBanding.tanggal_absen && !loadingJadwal) {
    jadwalOptions = <option value="" disabled>Tidak ada jadwal untuk tanggal ini</option>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Header - Mobile Responsive */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            <h2 className="text-orange-800 font-medium text-sm sm:text-lg">Pengajuan Banding Absen</h2>
          </div>
          <p className="text-orange-700 text-xs sm:text-sm">Ajukan banding absensi untuk satu siswa</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm text-orange-600 font-medium">
              {bandingAbsen.length} banding tersimpan
            </div>
            <Button 
              onClick={() => setShowFormBanding(true)}
              className="bg-orange-600 hover:bg-orange-700 text-xs sm:text-sm h-8 sm:h-10"
            >
              <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Ajukan Banding
            </Button>
          </div>
        </div>
      </div>

      {/* Form Pengajuan Banding - Mobile Responsive */}
      {showFormBanding && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Form Pengajuan Banding Absen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="tanggal_banding" className="text-sm font-medium">Tanggal Absen</Label>
                <input
                  id="tanggal_banding"
                  type="date"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm"
                  value={formBanding.tanggal_absen}
                  max={getCurrentDateWIB()}
                  onChange={(e) => {
                    const tanggal = e.target.value;
                    setFormBanding({...formBanding, tanggal_absen: tanggal, jadwal_id: ''});
                    if (tanggal) {
                      loadJadwalBandingByDate(tanggal);
                    } else {
                      setJadwalBerdasarkanTanggal([]);
                    }
                    
                    // Load status kehadiran siswa dari database ketika tanggal dipilih
                    if (tanggal && formBanding.jadwal_id && selectedSiswaId) {
                      loadSiswaStatusById(selectedSiswaId, tanggal, formBanding.jadwal_id);
                    }
                  }}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">Pilih tanggal absen terlebih dahulu untuk melihat jadwal pelajaran (hanya hari ini dan masa lalu)</p>
              </div>
              
              <div>
                <Label htmlFor="jadwal_banding" className="text-sm font-medium">Jadwal Pelajaran</Label>
                <select 
                  id="jadwal_banding"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm"
                  value={formBanding.jadwal_id}
                  onChange={(e) => {
                    setFormBanding({...formBanding, jadwal_id: e.target.value});
                    
                    // Load status kehadiran siswa dari database ketika jadwal dipilih
                    if (e.target.value && formBanding.tanggal_absen && selectedSiswaId) {
                      loadSiswaStatusById(selectedSiswaId, formBanding.tanggal_absen, e.target.value);
                    }
                  }}
                  disabled={formBanding.tanggal_absen === '' || loadingJadwal}
                >
                  <option value="">{jadwalPlaceholder}</option>
                  {jadwalOptions}
                </select>
              </div>
            </div>

            {/* Pilihan Siswa untuk Banding - Mobile Responsive */}
            <div className="border-t pt-4">
              <div className="mb-3">
                  <Label className="text-base sm:text-lg font-semibold">Siswa yang Ajukan Banding</Label>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Pilih satu siswa untuk pengajuan banding absen
                  </div>
                </div>

              <div className="p-3 sm:p-4 border rounded-lg bg-muted space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Nama Siswa</Label>
                        <select
                          className="w-full px-3 py-2 border border-border rounded-md text-sm"
                          value={selectedSiswaId ?? ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number.parseInt(e.target.value, 10) : Number.NaN;
                            const chosen = daftarSiswa.find(s => (s.id ?? s.id_siswa) === val) || undefined;

                            setSelectedSiswaId(Number.isNaN(val) ? null : val);

                            // Simpan nama ke form untuk tampilan (backend tidak memakai ini)
                            const newSiswaBanding = [{
                              nama: chosen?.nama || '',
                              status_asli: formBanding.siswa_banding[0]?.status_asli || 'alpa' as StatusType,
                              status_diajukan: formBanding.siswa_banding[0]?.status_diajukan || 'hadir' as StatusType,
                              alasan_banding: formBanding.siswa_banding[0]?.alasan_banding || ''
                            }];
                            setFormBanding({ ...formBanding, siswa_banding: newSiswaBanding });

                            // Load status kehadiran siswa dari database
                            if (!Number.isNaN(val) && formBanding.tanggal_absen && formBanding.jadwal_id) {
                              loadSiswaStatusById(val, formBanding.tanggal_absen, formBanding.jadwal_id);
                            }
                          }}
                        >
                          <option value="">Pilih siswa...</option>
                          {daftarSiswa.map((s) => {
                            const optionId = (s.id ?? s.id_siswa) as number;
                            return (
                              <option key={optionId} value={optionId}>
                                {s.nama}
                              </option>
                            );
                          })}
                        </select>
                        <div className="text-xs text-muted-foreground mt-1">
                          Pilih nama siswa dari kelas untuk pengajuan banding absen
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Status Tercatat</Label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-border rounded-md bg-muted text-sm"
                            value={formBanding.siswa_banding[0]?.status_asli ? 
                              formBanding.siswa_banding[0].status_asli.charAt(0).toUpperCase() + 
                              formBanding.siswa_banding[0].status_asli.slice(1) : 'Belum dipilih'}
                            readOnly
                            disabled
                          />
                          <p className="text-xs text-muted-foreground mt-1">Status tercatat diambil dari database dan tidak bisa diubah</p>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Status Diajukan</Label>
                          <select
                            className="w-full px-3 py-2 border border-border rounded-md text-sm"
                      value={formBanding.siswa_banding[0]?.status_diajukan || 'hadir'}
                          onChange={(e) => {
                        const newSiswaBanding = [{
                          nama: formBanding.siswa_banding[0]?.nama || '',
                          status_asli: formBanding.siswa_banding[0]?.status_asli || 'alpa' as StatusType,
                          status_diajukan: e.target.value as StatusType,
                          alasan_banding: formBanding.siswa_banding[0]?.alasan_banding || ''
                        }];
                            setFormBanding({...formBanding, siswa_banding: newSiswaBanding});
                          }}
                        >
                          <option value="hadir">Hadir</option>
                          <option value="izin">Izin</option>
                          <option value="sakit">Sakit</option>
                          <option value="alpa">Alpa</option>
                          <option value="dispen">Dispen</option>
                        </select>
                      </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Alasan Banding</Label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-border rounded-md text-sm"
                          placeholder="Alasan banding..."
                      value={formBanding.siswa_banding[0]?.alasan_banding || ''}
                          onChange={(e) => {
                        const newSiswaBanding = [{
                          nama: formBanding.siswa_banding[0]?.nama || '',
                          status_asli: formBanding.siswa_banding[0]?.status_asli || 'alpa' as StatusType,
                          status_diajukan: formBanding.siswa_banding[0]?.status_diajukan || 'hadir' as StatusType,
                          alasan_banding: e.target.value
                        }];
                            setFormBanding({...formBanding, siswa_banding: newSiswaBanding});
                          }}
                        />
                      </div>
                    </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button 
                onClick={submitBandingAbsen}
                disabled={!formBanding.tanggal_absen || !formBanding.jadwal_id || !selectedSiswaId || !formBanding.siswa_banding[0]?.alasan_banding || loadingJadwal}
                className="bg-orange-600 hover:bg-orange-700 text-sm h-9 sm:h-10"
              >
                <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Kirim Banding
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowFormBanding(false);
                  setFormBanding({
                    jadwal_id: '',
                    tanggal_absen: '',
                    siswa_banding: [{
                      nama: '',
                      status_asli: 'alpa',
                      status_diajukan: 'hadir',
                      alasan_banding: ''
                    }]
                  });
                  setJadwalBerdasarkanTanggal([]);
                }}
                className="text-sm h-9 sm:h-10"
              >
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daftar Banding Absen - Mobile Responsive */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Riwayat Pengajuan Banding Absen</span>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs sm:text-sm text-muted-foreground font-medium">
                {bandingAbsen.length} banding
              </div>
              <div className="text-xs text-muted-foreground">
                Halaman {bandingAbsenPage} dari {Math.ceil(bandingAbsen.length / itemsPerPage)}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bandingAbsen.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <MessageCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Belum Ada Banding</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Kelas belum memiliki riwayat pengajuan banding absen</p>
            </div>
          ) : (
              <BandingList
                bandingAbsen={bandingAbsen}
                expandedBanding={expandedBanding}
                setExpandedBanding={setExpandedBanding}
                bandingAbsenPage={bandingAbsenPage}
                setBandingAbsenPage={setBandingAbsenPage}
                itemsPerPage={itemsPerPage}
              />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
