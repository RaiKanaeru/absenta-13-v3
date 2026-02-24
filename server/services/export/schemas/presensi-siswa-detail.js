// Schema untuk laporan Presensi Siswa Detail (per hari)
export default {
  title: 'Presensi Siswa',
  subtitle: 'Format Presensi Siswa SMKN 13',
  columns: [
    { key: 'no', label: 'No', width: 5, align: 'center' },
    { key: 'nama', label: 'Nama Siswa', width: 25, align: 'left' },
    { key: 'nis', label: 'NIS', width: 12, align: 'center' },
    { key: 'jenis_kelamin', label: 'JK', width: 8, align: 'center' }
  ]
};

// Helper function to generate dynamic columns for days of month
export function generatePresensiColumns(daysInMonth) {
  const columns = [
    { key: 'no', label: 'No', width: 5, align: 'center' },
    { key: 'nama', label: 'Nama Siswa', width: 25, align: 'left' },
    { key: 'nis', label: 'NIS', width: 12, align: 'center' },
    { key: 'jenis_kelamin', label: 'JK', width: 8, align: 'center' }
  ];
  
  // Add day columns
  for (let day = 1; day <= daysInMonth; day++) {
    columns.push({
      key: `hari_${day}`,
      label: day.toString(),
      width: 6,
      align: 'center'
    });
  }
  
  // Add KET column
  columns.push({
    key: 'keterangan',
    label: 'KET',
    width: 30,
    align: 'left'
  });
  
  return columns;
}
