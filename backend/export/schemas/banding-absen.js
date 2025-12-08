// Schema untuk laporan Banding Absen
export default {
  title: 'Riwayat Pengajuan Banding Absen',
  subtitle: 'Laporan Pengajuan Banding Absensi',
  columns: [
    { key: 'no', label: 'No', width: 5, align: 'center' },
    { key: 'tanggal_pengajuan', label: 'Tanggal Pengajuan', width: 15, align: 'center' },
    { key: 'tanggal_absen', label: 'Tanggal Absen', width: 15, align: 'center' },
    { key: 'pengaju', label: 'Nama Pengaju', width: 25, align: 'left' },
    { key: 'kelas', label: 'Kelas', width: 12, align: 'center' },
    { key: 'mata_pelajaran', label: 'Mata Pelajaran', width: 20, align: 'left' },
    { key: 'guru', label: 'Guru', width: 20, align: 'left' },
    { key: 'jadwal', label: 'Jadwal', width: 15, align: 'center' },
    { key: 'status_asli', label: 'Status Asli', width: 12, align: 'center' },
    { key: 'status_diajukan', label: 'Status Diajukan', width: 15, align: 'center' },
    { key: 'status_banding', label: 'Status Banding', width: 15, align: 'center' },
    { key: 'jenis_banding', label: 'Jenis Banding', width: 12, align: 'center' },
    { key: 'alasan_banding', label: 'Alasan Banding', width: 30, align: 'left' },
    { key: 'catatan_guru', label: 'Catatan Guru', width: 25, align: 'left' },
    { key: 'tanggal_keputusan', label: 'Tanggal Keputusan', width: 18, align: 'center' },
    { key: 'diproses_oleh', label: 'Diproses Oleh', width: 20, align: 'left' }
  ]
};
