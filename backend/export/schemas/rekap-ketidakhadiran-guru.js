// Schema untuk laporan Rekap Ketidakhadiran Guru
export default {
  title: 'Rekap Ketidakhadiran Guru',
  subtitle: 'Laporan Ketidakhadiran Guru per Periode',
  columns: [
    { key: 'no', label: 'No', width: 5, align: 'center' },
    { key: 'nama', label: 'Nama Guru', width: 25, align: 'left' },
    { key: 'nip', label: 'NIP', width: 15, align: 'center' },
    { key: 'mata_pelajaran', label: 'Mata Pelajaran', width: 20, align: 'left' },
    { key: 'ruang', label: 'Ruang', width: 10, align: 'center' },
    { key: 'periode', label: 'Periode', width: 15, align: 'center' },
    { key: 'hadir', label: 'Hadir', width: 8, align: 'center' },
    { key: 'izin', label: 'Izin', width: 8, align: 'center' },
    { key: 'sakit', label: 'Sakit', width: 8, align: 'center' },
    { key: 'alpa', label: 'Alpa', width: 8, align: 'center' },
    { key: 'total', label: 'Total', width: 8, align: 'center' },
    { key: 'presentase', label: 'Presentase', width: 12, align: 'center', format: 'percentage' }
  ]
};
