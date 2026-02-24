import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime24, formatDateOnly } from '@/lib/time-utils';
import {
  getAttendanceStatusLabel,
  getActivityTypeLabel,
  getAttendanceBadgeClass as getAttendanceStatusBadgeClass,
} from '@/utils/statusMaps';
import {
  Clock, Calendar, CheckCircle2, XCircle, User, BookOpen, Users, Edit, Save
} from 'lucide-react';
import { GuruAttendanceCard } from './GuruAttendanceCard';
import { GuruInSchedule } from '@/types/dashboard';
import type { JadwalHariIni, KehadiranData } from '@/types/student';

// =============================================================================
// PROPS
// =============================================================================

export interface KehadiranTabProps {
  loading: boolean;
  isEditMode: boolean;
  kelasInfo: string;
  selectedDate: string;
  minDate: string;
  maxDate: string;
  jadwalHariIni: JadwalHariIni[];
  jadwalBerdasarkanTanggal: JadwalHariIni[];
  kehadiranData: KehadiranData;
  adaTugasData: { [key: number]: boolean };
  isUpdatingStatus: string | null;
  toggleEditMode: () => void;
  handleDateChange: (date: string) => void;
  updateKehadiranStatus: (key: string | number, status: string) => Promise<void>;
  updateKehadiranKeterangan: (key: string | number, keterangan: string) => void;
  submitKehadiran: () => Promise<void>;
  openAbsenKelasModal: (jadwalId: number, guruNama: string) => Promise<void>;
  setAdaTugasData: React.Dispatch<React.SetStateAction<{ [key: number]: boolean }>>;
}

// =============================================================================
// HELPERS
// =============================================================================

const getStatusBadgeColor = (status: string) => {
  const colorMap: Record<string, string> = {
    hadir: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0',
    'tidak hadir': 'bg-destructive/15 text-destructive border-0',
    izin: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0',
    sakit: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-0',
    belum_diambil: 'bg-muted text-muted-foreground border-0'
  };
  return colorMap[status.toLowerCase()] || 'bg-muted text-muted-foreground';
};

type GroupedJadwal = JadwalHariIni & { guru_list: GuruInSchedule[] };

const groupJadwalByKey = (jadwalData: JadwalHariIni[]): GroupedJadwal[] => {
  const groupedJadwal = jadwalData.reduce((acc, jadwal) => {
    const key = jadwal.id_jadwal;
    if (!acc[key]) {
      acc[key] = {
        ...jadwal,
        guru_list: []
      };
    }

    if (Array.isArray(jadwal.guru_list) && jadwal.guru_list.length > 0) {
      acc[key].guru_list = jadwal.guru_list;
    } else if (jadwal.guru_id || jadwal.id_guru) {
      const resolvedGuruId = jadwal.guru_id || jadwal.id_guru;
      acc[key].guru_list.push({
        id_guru: resolvedGuruId || 0,
        nama_guru: jadwal.nama_guru,
        nip: jadwal.nip,
        is_primary: true,
        status_kehadiran: jadwal.status_kehadiran,
        keterangan_guru: jadwal.keterangan ?? ''
      });
    } else if (jadwal.is_multi_guru && typeof jadwal.nama_guru === 'string' && acc[key].guru_list.length === 0) {
      const raw = jadwal.nama_guru;
      const parts = raw.split(/,|&| dan /gi).map((namaPart) => namaPart.trim()).filter(Boolean);
      if (parts.length > 1) {
        parts.forEach((nama, idx) => {
          acc[key].guru_list.push({
            id_guru: 0,
            nama_guru: nama,
            nip: '',
            is_primary: idx === 0,
            status_kehadiran: 'belum_diambil',
            keterangan_guru: ''
          });
        });
      }
    }

    return acc;
  }, {} as Record<number, GroupedJadwal>);

  return Object.values(groupedJadwal);
};

interface JadwalCardProps {
  jadwal: GroupedJadwal;
  kehadiranData: KehadiranData;
  isUpdatingStatus: string | null;
  updateKehadiranStatus: (key: string | number, status: string) => Promise<void>;
  updateKehadiranKeterangan: (key: string | number, keterangan: string) => void;
  adaTugasData: { [key: number]: boolean };
  updateAdaTugasCheckboxState: (jadwalId: number, isChecked: boolean) => void;
  openAbsenKelasModal: (jadwalId: number, guruNama: string) => Promise<void>;
  isEditMode: boolean;
}

const JadwalCard: React.FC<JadwalCardProps> = ({
  jadwal,
  kehadiranData,
  isUpdatingStatus,
  updateKehadiranStatus,
  updateKehadiranKeterangan,
  adaTugasData,
  updateAdaTugasCheckboxState,
  openAbsenKelasModal,
  isEditMode,
}) => {
  if (!jadwal.is_absenable) {
    return (
      <div key={jadwal.id_jadwal} className="border-2 border-dashed border-border rounded-lg p-3 sm:p-4 bg-muted">
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
            <Badge variant="outline" className="text-xs">Jam ke-{jadwal.jam_ke}</Badge>
            <Badge variant="outline" className="text-xs">{jadwal.jam_mulai} - {jadwal.jam_selesai}</Badge>
            <Badge variant="secondary" className="text-xs">
              {getActivityTypeLabel(jadwal.jenis_aktivitas)}
            </Badge>
            <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
              Tidak perlu absen
            </Badge>
          </div>
          <h4 className="font-semibold text-base sm:text-lg text-muted-foreground break-words mb-1">
            {jadwal.keterangan_khusus || jadwal.nama_mapel}
          </h4>
          <p className="text-sm sm:text-base text-muted-foreground break-words">Aktivitas Khusus</p>
        </div>
      </div>
    );
  }

  let guruAttendanceForm: React.ReactNode;
  if (jadwal.is_multi_guru) {
    if (jadwal.guru_list && jadwal.guru_list.length > 0) {
      guruAttendanceForm = (
        <div className="space-y-3 sm:space-y-4">
          <Label className="text-sm font-medium text-foreground mb-3 block">
            Status Kehadiran Guru (Multi-Guru):
          </Label>
          {jadwal.guru_list.map((guru) => {
            const guruKey = `${jadwal.id_jadwal}-${guru.id_guru}`;
            return (
              <GuruAttendanceCard
                key={guruKey}
                guru={guru}
                jadwalId={jadwal.id_jadwal}
                kehadiranStatus={kehadiranData[guruKey]?.status || ''}
                kehadiranKeterangan={kehadiranData[guruKey]?.keterangan || ''}
                isUpdating={isUpdatingStatus === guruKey}
                onStatusChange={updateKehadiranStatus}
                onKeteranganChange={updateKehadiranKeterangan}
              />
            );
          })}
        </div>
      );
    } else {
      guruAttendanceForm = (
        <div className="p-3 border rounded bg-yellow-50 border-yellow-200 text-sm text-yellow-800">
          Jadwal ini multi-guru namun daftar guru belum tersedia. Silakan refresh/ulang sampai daftar guru tampil.
        </div>
      );
    }
  } else {
    guruAttendanceForm = (
      <div>
        <Label className="text-sm font-medium text-foreground mb-3 block">
          Status Kehadiran Guru:
        </Label>
        <RadioGroup
          value={kehadiranData[jadwal.id_jadwal]?.status || jadwal.status_kehadiran || ''}
          onValueChange={(value) => updateKehadiranStatus(jadwal.id_jadwal, value)}
          disabled={isUpdatingStatus === String(jadwal.id_jadwal)}
        >
          {isUpdatingStatus === String(jadwal.id_jadwal) && (
            <div className="text-xs text-blue-600 flex items-center gap-1 mb-2">
              <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              Menyimpan...
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Hadir" id={`hadir-${jadwal.id_jadwal}`} />
              <Label htmlFor={`hadir-${jadwal.id_jadwal}`} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Hadir
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Tidak Hadir" id={`tidak_hadir-${jadwal.id_jadwal}`} />
              <Label htmlFor={`tidak_hadir-${jadwal.id_jadwal}`} className="flex items-center gap-2 text-sm">
                <XCircle className="w-4 h-4 text-red-600" />
                Tidak Hadir
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Izin" id={`izin-${jadwal.id_jadwal}`} />
              <Label htmlFor={`izin-${jadwal.id_jadwal}`} className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-yellow-600" />
                Izin
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Sakit" id={`sakit-${jadwal.id_jadwal}`} />
              <Label htmlFor={`sakit-${jadwal.id_jadwal}`} className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-blue-600" />
                Sakit
              </Label>
            </div>
          </div>
        </RadioGroup>
      </div>
    );
  }

  return (
    <div key={jadwal.id_jadwal} className="border rounded-lg p-3 sm:p-4">
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
          <Badge variant="outline" className="text-xs">Jam ke-{jadwal.jam_ke}</Badge>
          <Badge variant="outline" className="text-xs">{jadwal.jam_mulai} - {jadwal.jam_selesai}</Badge>
          <Badge className={`text-xs ${getStatusBadgeColor(kehadiranData[jadwal.id_jadwal]?.status || jadwal.status_kehadiran || 'belum_diambil')}`}>
            {getAttendanceStatusLabel(kehadiranData[jadwal.id_jadwal]?.status || jadwal.status_kehadiran || 'belum_diambil')}
          </Badge>
          {jadwal.waktu_catat && (
            <Badge variant="secondary" className="text-xs">
              Waktu: {formatDateTime24(jadwal.waktu_catat, true)}
            </Badge>
          )}
        </div>
        <h4 className="font-semibold text-base sm:text-lg text-foreground break-words mb-2">{jadwal.nama_mapel}</h4>
        <div className="space-y-1">
          {!(jadwal.is_multi_guru && jadwal.guru_list && jadwal.guru_list.length > 0) && (
            <>
              <p className="text-sm sm:text-base text-muted-foreground break-words">{jadwal.nama_guru}</p>
              {jadwal.nip && <p className="text-xs sm:text-sm text-muted-foreground">NIP: {jadwal.nip}</p>}
            </>
          )}
          {jadwal.is_multi_guru && jadwal.guru_list && jadwal.guru_list.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-xs">
                <Users className="w-3 h-3 mr-1" />
                Multi-Guru ({jadwal.guru_list.length} guru)
              </Badge>
              {jadwal.guru_list.slice(1).map((guru) => (
                <Badge key={`guru-${guru.id_guru}-${guru.nama_guru}`} variant="outline" className="text-xs">
                  {guru.nama_guru}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {jadwal.kode_ruang && (
          <div className="text-xs sm:text-sm text-blue-600 mt-2">
            <Badge variant="outline" className="text-xs">
              {jadwal.kode_ruang}
            </Badge>
            {jadwal.nama_ruang && ` - ${jadwal.nama_ruang}`}
          </div>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {guruAttendanceForm}

        {(kehadiranData[jadwal.id_jadwal]?.status === 'Tidak Hadir' ||
          kehadiranData[jadwal.id_jadwal]?.status === 'Izin' ||
          kehadiranData[jadwal.id_jadwal]?.status === 'Sakit') && (
          <div className="mt-2 sm:mt-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`ada-tugas-${jadwal.id_jadwal}`}
                checked={adaTugasData[jadwal.id_jadwal] || false}
                onChange={(e) => updateAdaTugasCheckboxState(jadwal.id_jadwal, e.target.checked)}
                className="rounded border-border text-blue-600 focus:ring-ring"
              />
              <Label htmlFor={`ada-tugas-${jadwal.id_jadwal}`} className="text-sm text-blue-600">
                Ada Tugas
              </Label>
            </div>
          </div>
        )}

        {['Tidak Hadir', 'Izin', 'Sakit'].includes(kehadiranData[jadwal.id_jadwal]?.status || '') && !isEditMode && (
          <div className="mt-3">
            <Button
              onClick={() => openAbsenKelasModal(jadwal.id_jadwal, jadwal.nama_guru || 'Guru')}
              variant="outline"
              className="w-full bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <Users className="w-4 h-4 mr-2" />
              Absen Kelas (Guru Tidak Hadir)
            </Button>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Klik untuk mengabsen siswa karena guru tidak hadir/izin/sakit
            </p>
          </div>
        )}

        {!jadwal.is_multi_guru && (
          <div>
            <Label htmlFor={`keterangan-${jadwal.id_jadwal}`} className="text-xs sm:text-sm font-medium text-foreground">
              Keterangan:
            </Label>
            <Textarea
              id={`keterangan-${jadwal.id_jadwal}`}
              placeholder="Masukkan keterangan jika diperlukan..."
              value={kehadiranData[jadwal.id_jadwal]?.keterangan || ''}
              onChange={(e) => updateKehadiranKeterangan(jadwal.id_jadwal, e.target.value)}
              disabled={false}
              className="mt-1 text-sm"
              rows={2}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// COMPONENT
// =============================================================================

export const KehadiranTab: React.FC<KehadiranTabProps> = ({
  loading,
  isEditMode,
  kelasInfo,
  selectedDate,
  minDate,
  maxDate,
  jadwalHariIni,
  jadwalBerdasarkanTanggal,
  kehadiranData,
  adaTugasData,
  isUpdatingStatus,
  toggleEditMode,
  handleDateChange,
  updateKehadiranStatus,
  updateKehadiranKeterangan,
  submitKehadiran,
  openAbsenKelasModal,
  setAdaTugasData,
}) => {
  const updateAdaTugasCheckboxState = (jadwalId: number, isChecked: boolean): void => {
    setAdaTugasData((prev) => ({ ...prev, [jadwalId]: isChecked }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-3 sm:p-6">
          <div className="space-y-3 sm:space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse bg-muted h-20 sm:h-24 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Edit Mode Toggle and Date Picker */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="truncate">
                {isEditMode ? 'Edit Absen Guru' : 'Jadwal Hari Ini'} - {kelasInfo}
              </span>
            </CardTitle>
            
            <div className="flex flex-col gap-3">
              {isEditMode && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Label htmlFor="date-picker" className="text-sm font-medium">
                    Pilih Tanggal:
                  </Label>
                  <input
                    id="date-picker"
                    type="date"
                    value={selectedDate}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-auto"
                  />
                </div>
              )}
              
              <Button
                onClick={toggleEditMode}
                variant={isEditMode ? "destructive" : "default"}
                size="sm"
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                {isEditMode ? (
                  <>
                    <XCircle className="w-4 h-4" />
                    Keluar Edit Mode
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4" />
                    Edit Absen (30 Hari)
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {isEditMode && (
            <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 text-primary mt-0.5">
                  <svg fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-sm text-foreground">
                  <p className="font-medium">Mode Edit Absen Aktif</p>
                  <p className="text-muted-foreground">Anda dapat mengubah absen guru untuk tanggal yang dipilih (maksimal 7 hari yang lalu).</p>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="min-w-0">
          <CardTitle className="flex items-center gap-2 min-w-0">
            <Calendar className="w-5 h-5" />
            <span className="truncate" title={isEditMode ? `Jadwal ${formatDateOnly(selectedDate)}` : 'Jadwal Hari Ini'}>
              {isEditMode ? `Jadwal ${formatDateOnly(selectedDate)}` : 'Jadwal Hari Ini'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {(() => {
              if (loading && isEditMode) {
                return (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-muted-foreground">Memuat jadwal...</span>
                  </div>
                );
              }
              if (isEditMode && jadwalBerdasarkanTanggal.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Tidak ada jadwal untuk tanggal {selectedDate}</p>
                  </div>
                );
              }
              const jadwalData = isEditMode ? jadwalBerdasarkanTanggal : jadwalHariIni;
              const groupedJadwal = groupJadwalByKey(jadwalData);

              return groupedJadwal.map((jadwal) => (
                <JadwalCard
                  key={jadwal.id_jadwal}
                  jadwal={jadwal}
                  kehadiranData={kehadiranData}
                  isUpdatingStatus={isUpdatingStatus}
                  updateKehadiranStatus={updateKehadiranStatus}
                  updateKehadiranKeterangan={updateKehadiranKeterangan}
                  adaTugasData={adaTugasData}
                  updateAdaTugasCheckboxState={updateAdaTugasCheckboxState}
                  openAbsenKelasModal={openAbsenKelasModal}
                  isEditMode={isEditMode}
                />
              ));
            })()}
          </div>

          <div className="mt-6 pt-6 border-t">
            {/* Preview Data Absensi untuk Multi Guru */}
            {(() => {
              const jadwalData = isEditMode ? jadwalBerdasarkanTanggal : jadwalHariIni;
              const multiGuruJadwal = jadwalData.filter(jadwal => jadwal.is_multi_guru && jadwal.is_absenable);
              
              if (multiGuruJadwal.length > 0) {
                return (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-5 h-5 text-blue-600" />
                      <h4 className="font-medium text-blue-800">Preview Data Absensi Multi Guru</h4>
                    </div>
                    <div className="space-y-3">
                      {multiGuruJadwal.map((jadwal) => (
                        <div key={jadwal.id_jadwal} className="bg-card p-3 rounded border">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-foreground">{jadwal.nama_mapel}</span>
                            <Badge variant="secondary" className="text-xs">
                              Multi-Guru ({jadwal.guru_list?.length || 0})
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {jadwal.guru_list?.map((guru) => {
                              const guruKey = `${jadwal.id_jadwal}-${guru.id_guru}`;
                              const status = kehadiranData[guruKey]?.status || guru.status_kehadiran || 'belum_diambil';
                              return (
                                <div key={guruKey} className="flex items-center justify-between text-sm">
                                  <span className="text-foreground">{guru.nama_guru}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      className={`text-xs ${getAttendanceStatusBadgeClass(status)}`}
                                    >
                                      {status}
                                    </Badge>
                                    {kehadiranData[guruKey]?.keterangan && (
                                      <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={kehadiranData[guruKey].keterangan}>
                                        {kehadiranData[guruKey].keterangan}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {isEditMode && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 text-yellow-600 mt-0.5">
                    <svg fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Perhatian!</p>
                    <p>Anda sedang mengedit absen untuk tanggal {formatDateOnly(selectedDate)}. Perubahan akan disimpan dan menggantikan data sebelumnya.</p>
                  </div>
                </div>
              </div>
            )}
            
            <Button 
              onClick={submitKehadiran} 
              disabled={loading} 
              className={`w-full ${isEditMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Menyimpan...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {isEditMode ? 'Simpan Perubahan Absen' : 'Simpan Data Kehadiran'}
                </div>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
