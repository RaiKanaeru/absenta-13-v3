// Schema untuk laporan Analytics Dashboard
export default {
  title: 'Dasbor Analitik',
  subtitle: 'Analisis dan Statistik Kehadiran',
  columns: [
    { key: 'no', label: 'No', width: 5, align: 'center' },
    { key: 'kategori', label: 'Kategori', width: 20, align: 'left' },
    { key: 'total_hadir', label: 'Total Hadir', width: 12, align: 'center' },
    { key: 'total_izin', label: 'Total Izin', width: 12, align: 'center' },
    { key: 'total_sakit', label: 'Total Sakit', width: 12, align: 'center' },
    { key: 'total_alpa', label: 'Total Alpa', width: 12, align: 'center' },
    { key: 'total_keseluruhan', label: 'Total Keseluruhan', width: 15, align: 'center' },
    { key: 'presentase_hadir', label: 'Presentase Hadir', width: 15, align: 'center', format: 'percentage' },
    { key: 'presentase_tidak_hadir', label: 'Presentase Tidak Hadir', width: 20, align: 'center', format: 'percentage' }
  ]
};
