const studentSummarySchema = {
    title: 'RINGKASAN KEHADIRAN SISWA',
    subtitle: 'Laporan Kehadiran Harian Siswa',
    columns: [
        { key: 'no', label: 'No', width: 8, align: 'center' },
        { key: 'nama', label: 'Nama Siswa', width: 25, align: 'left' },
        { key: 'nis', label: 'NIS', width: 15, align: 'left' },
        { key: 'kelas', label: 'Kelas', width: 12, align: 'center' },
        { key: 'hadir', label: 'H', width: 8, align: 'center', format: 'number' },
        { key: 'izin', label: 'I', width: 8, align: 'center', format: 'number' },
        { key: 'sakit', label: 'S', width: 8, align: 'center', format: 'number' },
        { key: 'alpa', label: 'A', width: 8, align: 'center', format: 'number' },
        { key: 'dispen', label: 'D', width: 8, align: 'center', format: 'number' },
        { key: 'presentase', label: 'Presentase', width: 12, align: 'center', format: 'percentage' }
    ]
};

export default studentSummarySchema;
