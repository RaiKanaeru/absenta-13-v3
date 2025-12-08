// Schema untuk laporan Rekap Ketidakhadiran Siswa
export default {
  title: 'Rekap Ketidakhadiran Siswa',
  subtitle: 'Laporan Ketidakhadiran Siswa per Periode',
  columns: [
    { key: 'no', label: 'No', width: 5, align: 'center' },
    { key: 'nama', label: 'Nama Siswa', width: 25, align: 'left' },
    { key: 'nis', label: 'NIS', width: 12, align: 'center' },
    { key: 'jenis_kelamin', label: 'JK', width: 8, align: 'center' },
    { key: 'jul', label: 'Jul', width: 8, align: 'center' },
    { key: 'agt', label: 'Agu', width: 8, align: 'center' },
    { key: 'sep', label: 'Sep', width: 8, align: 'center' },
    { key: 'okt', label: 'Okt', width: 8, align: 'center' },
    { key: 'nov', label: 'Nov', width: 8, align: 'center' },
    { key: 'des', label: 'Des', width: 8, align: 'center' },
    { key: 'jan', label: 'Jan', width: 8, align: 'center' },
    { key: 'feb', label: 'Feb', width: 8, align: 'center' },
    { key: 'mar', label: 'Mar', width: 8, align: 'center' },
    { key: 'apr', label: 'Apr', width: 8, align: 'center' },
    { key: 'mei', label: 'Mei', width: 8, align: 'center' },
    { key: 'jun', label: 'Jun', width: 8, align: 'center' },
    { key: 'total_ketidakhadiran', label: 'Total', width: 10, align: 'center' },
    { key: 'persentase_ketidakhadiran', label: 'Persentase', width: 12, align: 'center', format: 'percentage' }
  ]
};
