// Schema untuk laporan Absensi Guru
export default {
  title: 'Laporan Absensi Guru',
  subtitle: 'Data Absensi Guru per Periode',
  columns: [
    { key: 'no', label: 'No', width: 5, align: 'center' },
    { key: 'tanggal', label: 'Tanggal', width: 12, align: 'center' },
    { key: 'hari', label: 'Hari', width: 10, align: 'center' },
    { key: 'jam_ke', label: 'Jam Ke', width: 8, align: 'center' },
    { key: 'waktu', label: 'Waktu', width: 15, align: 'center' },
    { key: 'nama_kelas', label: 'Kelas', width: 15, align: 'center' },
    { key: 'nama_mapel', label: 'Mata Pelajaran', width: 20, align: 'left' },
    { key: 'nama_guru', label: 'Nama Guru', width: 25, align: 'left' },
    { key: 'nip', label: 'NIP', width: 20, align: 'center' },
    { key: 'status', label: 'Status', width: 12, align: 'center' },
    { key: 'keterangan', label: 'Keterangan', width: 30, align: 'left' },
    { key: 'nama_pencatat', label: 'Pencatat', width: 20, align: 'left' }
  ]
};
