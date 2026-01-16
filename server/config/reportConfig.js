/**
 * Constants for Reports Controller
 */

export const REPORT_STATUS = {
    HADIR: 'Hadir',
    IZIN: 'Izin',
    SAKIT: 'Sakit',
    ALPA: 'Alpa',
    DISPEN: 'Dispen',
    TIDAK_HADIR: 'Tidak Hadir',
    BELUM_ABSEN: 'Belum Absen',
    TEPAT_WAKTU: 'Tepat Waktu',
    TERLAMBAT: 'Terlambat',
    TERLAMBAT_RINGAN: 'Terlambat Ringan',
    TERLAMBAT_BERAT: 'Terlambat Berat',
    PAGI: 'Pagi',
    SIANG: 'Siang',
    SORE: 'Sore',
    TIDAK_ADA_DATA: 'Tidak Ada Data'
};

export const REPORT_MESSAGES = {
    DATE_RANGE_REQUIRED: 'Tanggal mulai dan tanggal selesai wajib diisi',
    INVALID_DATE_FORMAT: 'Format tanggal tidak valid (gunakan YYYY-MM-DD)',
    DB_ERROR_ANALYTICS: 'Gagal memuat data analytics',
    DB_ERROR_TEACHER_LIVE: 'Gagal memuat data kehadiran guru',
    DB_ERROR_STUDENT_LIVE: 'Gagal memuat data kehadiran siswa',
    DB_ERROR_TEACHER_REPORT: 'Gagal memuat laporan kehadiran guru',
    DB_ERROR_STUDENT_REPORT: 'Gagal memuat laporan kehadiran siswa',
    DB_ERROR_DOWNLOAD_TEACHER: 'Gagal mengunduh laporan kehadiran guru',
    DB_ERROR_DOWNLOAD_STUDENT: 'Gagal mengunduh laporan kehadiran siswa',
    DB_ERROR_STUDENT_SUMMARY: 'Gagal memuat ringkasan kehadiran siswa',
    DB_ERROR_TEACHER_SUMMARY: 'Gagal memuat ringkasan kehadiran guru',
    DB_ERROR_REKAP_GURU: 'Gagal memuat rekap ketidakhadiran guru',
    DB_ERROR_REKAP_SISWA: 'Gagal memuat rekap ketidakhadiran siswa',
    DB_ERROR_STUDENTS_CLASS: 'Gagal memuat data siswa',
    DB_ERROR_PRESENSI_SISWA: 'Gagal memuat data presensi siswa',
    INVALID_CLASS_ID: 'Format ID kelas tidak valid',
    MISSING_PARAMS: 'Kelas, bulan, dan tahun wajib diisi'
};

export const CSV_HEADERS = {
    TEACHER_REPORT: 'Tanggal,Kelas,Guru,NIP,Mata Pelajaran,Jam Hadir,Jam Mulai,Jam Selesai,Jadwal,Status,Keterangan\n',
    STUDENT_REPORT: 'Tanggal,Kelas,Nama Siswa,NIS,Mata Pelajaran,Guru,Waktu Absen,Jam Mulai,Jam Selesai,Jadwal,Status,Keterangan\n'
};

export const HARI_EFEKTIF_MAP = {
    1: 21, 2: 20, 3: 22, 4: 20, 5: 20, 6: 18,
    7: 21, 8: 21, 9: 21, 10: 22, 11: 21, 12: 18
};

export const HARI_EFEKTIF_SEMESTER = {
    GASAL: 95,
    GENAP: 142,
    TAHUNAN: 237
};
