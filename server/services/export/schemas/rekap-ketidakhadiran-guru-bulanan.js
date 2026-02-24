// Schema untuk laporan Rekap Ketidakhadiran Guru (Tahunan)
export default {
  title: 'REKAP KETIDAKHADIRAN GURU',
  subtitle: 'Laporan Ketidakhadiran Guru per Tahun Ajaran',
  columns: [
    { key: 'no', label: 'No', width: 5, align: 'center' },
    { key: 'nama', label: 'Nama Guru', width: 25, align: 'left' },
    { key: 'nip', label: 'NIP', width: 15, align: 'center' },
    { key: 'jul', label: 'Jul', width: 5, align: 'center' },
    { key: 'agt', label: 'Agu', width: 5, align: 'center' },
    { key: 'sep', label: 'Sep', width: 5, align: 'center' },
    { key: 'okt', label: 'Okt', width: 5, align: 'center' },
    { key: 'nov', label: 'Nov', width: 5, align: 'center' },
    { key: 'des', label: 'Des', width: 5, align: 'center' },
    { key: 'jan', label: 'Jan', width: 5, align: 'center' },
    { key: 'feb', label: 'Feb', width: 5, align: 'center' },
    { key: 'mar', label: 'Mar', width: 5, align: 'center' },
    { key: 'apr', label: 'Apr', width: 5, align: 'center' },
    { key: 'mei', label: 'Mei', width: 5, align: 'center' },
    { key: 'jun', label: 'Jun', width: 5, align: 'center' },
    { key: 'total_ketidakhadiran', label: 'Total', width: 8, align: 'center' },
    { key: 'persentase_ketidakhadiran', label: '% Tidak Hadir', width: 12, align: 'center', format: 'percentage' },
    { key: 'persentase_kehadiran', label: '% Hadir', width: 12, align: 'center', format: 'percentage' }
  ]
};
