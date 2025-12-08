// Schema untuk laporan Live Attendance
export default {
  title: 'Pemantauan Kehadiran Langsung',
  subtitle: 'Laporan Kehadiran Real-time',
  columns: [
    { key: 'no', label: 'No', width: 5, align: 'center' },
    { key: 'nama', label: 'Nama', width: 25, align: 'left' },
    { key: 'nis_nip', label: 'NIS/NIP', width: 15, align: 'center' },
    { key: 'kelas', label: 'Kelas', width: 12, align: 'center' },
    { key: 'mata_pelajaran', label: 'Mata Pelajaran', width: 20, align: 'left' },
    { key: 'ruang', label: 'Ruang', width: 10, align: 'center' },
    { key: 'status', label: 'Status', width: 12, align: 'center' },
    { key: 'waktu_absen', label: 'Waktu Absen', width: 18, align: 'center' },
    { key: 'keterangan', label: 'Keterangan', width: 25, align: 'left' }
  ]
};
