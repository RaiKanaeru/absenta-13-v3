// Schema untuk laporan Rekap Ketidakhadiran Guru (Bulanan)
export default {
  title: 'Rekap Ketidakhadiran Guru',
  subtitle: 'Laporan Ketidakhadiran Guru per Bulan',
  columns: [
    { key: 'no', label: 'No', width: 5, align: 'center' },
    { key: 'nama', label: 'Nama Guru', width: 25, align: 'left' },
    { key: 'nip', label: 'NIP', width: 15, align: 'center' },
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
    { key: 'persentase_ketidakhadiran', label: 'Persentase Ketidakhadiran (%)', width: 15, align: 'center', format: 'percentage' },
    { key: 'persentase_kehadiran', label: 'Persentase Kehadiran (%)', width: 15, align: 'center', format: 'percentage' }
  ]
};
