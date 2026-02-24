const teacherSummarySchema = {
    title: 'RINGKASAN KEHADIRAN GURU',
    subtitle: 'Laporan Kehadiran Harian Guru',
    columns: [
        { key: 'no', label: 'No', width: 8, align: 'center' },
        { key: 'nama', label: 'Nama Guru', width: 25, align: 'left' },
        { key: 'nip', label: 'NIP', width: 18, align: 'left' },
        { key: 'hadir', label: 'H', width: 8, align: 'center', format: 'number' },
        { key: 'izin', label: 'I', width: 8, align: 'center', format: 'number' },
        { key: 'sakit', label: 'S', width: 8, align: 'center', format: 'number' },
        { key: 'alpa', label: 'A', width: 8, align: 'center', format: 'number' },
        { key: 'presentase', label: 'Presentase', width: 12, align: 'center', format: 'percentage' }
    ]
};

export default teacherSummarySchema;
