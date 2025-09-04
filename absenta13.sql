perbaiki, jika ada error di database rubah di database13.sql dengan benar-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 29 Agu 2025 pada 04.16
-- Versi server: 10.4.32-MariaDB
-- Versi PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `absenta13`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `absensi_guru`
--

CREATE TABLE `absensi_guru` (
  `id_absensi` int(11) NOT NULL,
  `jadwal_id` int(11) NOT NULL,
  `guru_id` int(11) NOT NULL,
  `kelas_id` int(11) NOT NULL,
  `siswa_pencatat_id` int(11) NOT NULL,
  `tanggal` date NOT NULL,
  `jam_ke` int(11) NOT NULL,
  `status` enum('Hadir','Tidak Hadir','Sakit','Izin','Dispen') NOT NULL,
  `keterangan` text DEFAULT NULL,
  `waktu_catat` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `absensi_guru`
--

INSERT INTO `absensi_guru` (`id_absensi`, `jadwal_id`, `guru_id`, `kelas_id`, `siswa_pencatat_id`, `tanggal`, `jam_ke`, `status`, `keterangan`, `waktu_catat`) VALUES
(1, 1, 1, 1, 1, '2025-08-26', 1, 'Hadir', 'Masuk tepat waktu', '2025-08-27 07:43:48'),
(2, 3, 4, 3, 2, '2025-08-26', 3, 'Tidak Hadir', 'Ada rapat dinas', '2025-08-27 07:43:48');

-- --------------------------------------------------------

--
-- Struktur dari tabel `absensi_siswa`
--

CREATE TABLE `absensi_siswa` (
  `id` int(11) NOT NULL,
  `siswa_id` int(11) NOT NULL COMMENT 'Relasi ke siswa_perwakilan.id_siswa',
  `jadwal_id` int(11) DEFAULT NULL COMMENT 'Relasi ke jadwal.id_jadwal (opsional untuk absensi harian)',
  `tanggal` date NOT NULL,
  `status` enum('Hadir','Izin','Sakit','Alpa','Dispen') NOT NULL COMMENT 'Status kehadiran siswa pada tanggal tersebut',
  `keterangan` text DEFAULT NULL,
  `waktu_absen` datetime NOT NULL DEFAULT current_timestamp(),
  `guru_id` int(11) DEFAULT NULL COMMENT 'ID guru yang mencatat absensi (opsional)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `absensi_siswa`
--

INSERT INTO `absensi_siswa` (`id`, `siswa_id`, `jadwal_id`, `tanggal`, `status`, `keterangan`, `waktu_absen`, `guru_id`) VALUES
(1, 1, 7, '2025-08-27', 'Hadir', '', '2025-08-27 07:59:37', 1),
(2, 3, 7, '2025-08-27', 'Izin', 'so', '2025-08-27 07:59:37', 1),
(3, 4, 7, '2025-08-27', 'Hadir', '', '2025-08-27 07:59:37', 1),
(4, 5, 7, '2025-08-27', 'Hadir', '', '2025-08-27 07:59:37', 1),
(5, 6, 7, '2025-08-27', 'Hadir', '', '2025-08-27 07:59:37', 1),
(6, 7, 7, '2025-08-27', 'Hadir', '', '2025-08-27 07:59:37', 1),
(7, 1, 11, '2025-08-28', 'Izin', '', '2025-08-28 01:20:07', 1),
(8, 3, 11, '2025-08-28', 'Izin', '', '2025-08-28 01:20:07', 1),
(9, 4, 11, '2025-08-28', 'Izin', '', '2025-08-28 01:20:07', 1),
(10, 5, 11, '2025-08-28', 'Sakit', '', '2025-08-28 01:20:07', 1),
(11, 6, 11, '2025-08-28', 'Hadir', '', '2025-08-28 01:20:07', 1),
(12, 7, 11, '2025-08-28', 'Hadir', '', '2025-08-28 01:20:07', 1);

-- --------------------------------------------------------

--
-- Struktur dari tabel `banding_absen_detail`
--

CREATE TABLE `banding_absen_detail` (
  `id_detail` int(11) NOT NULL,
  `banding_id` int(11) NOT NULL COMMENT 'ID banding utama',
  `nama_siswa` varchar(100) NOT NULL COMMENT 'Nama siswa yang banding',
  `status_asli` enum('hadir','izin','sakit','alpa','dispen') NOT NULL COMMENT 'Status asli siswa',
  `status_diajukan` enum('hadir','izin','sakit','alpa','dispen') NOT NULL COMMENT 'Status yang diajukan',
  `alasan_banding` text NOT NULL COMMENT 'Alasan spesifik siswa',
  `bukti_pendukung` varchar(255) DEFAULT NULL COMMENT 'Path file bukti untuk siswa ini'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `banding_absen_detail`
--

INSERT INTO `banding_absen_detail` (`id_detail`, `banding_id`, `nama_siswa`, `status_asli`, `status_diajukan`, `alasan_banding`, `bukti_pendukung`) VALUES
(1, 1, 'Ahmad Rizki', 'alpa', 'hadir', 'Hadir tapi lupa absen', NULL),
(2, 1, 'Siti Nurhaliza', 'alpa', 'hadir', 'Hadir dan sudah absen tapi tidak tercatat', NULL),
(3, 2, 'Budi Santoso', 'alpa', 'sakit', 'Sakit demam tidak bisa datang', NULL),
(4, 2, 'Rina Amelia', 'alpa', 'sakit', 'Sakit batuk pilek', NULL);

-- --------------------------------------------------------

--
-- Struktur dari tabel `banding_pengajuan_izin`
--

CREATE TABLE `banding_pengajuan_izin` (
  `id_banding` int(11) NOT NULL,
  `pengajuan_id` int(11) NOT NULL COMMENT 'ID pengajuan izin yang dibanding',
  `alasan_banding` text NOT NULL COMMENT 'Alasan pengajuan banding',
  `bukti_tambahan` varchar(255) DEFAULT NULL COMMENT 'Bukti tambahan untuk banding',
  `status_banding` enum('pending','dikabulkan','ditolak') NOT NULL DEFAULT 'pending',
  `keterangan_admin` text DEFAULT NULL COMMENT 'Keterangan dari admin saat review banding',
  `tanggal_banding` timestamp NOT NULL DEFAULT current_timestamp(),
  `tanggal_keputusan` timestamp NULL DEFAULT NULL COMMENT 'Waktu admin memberikan keputusan',
  `admin_id` int(11) DEFAULT NULL COMMENT 'ID admin yang memproses banding'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `guru`
--

CREATE TABLE `guru` (
  `id` int(11) NOT NULL,
  `id_guru` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `nip` varchar(30) NOT NULL,
  `nama` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `mata_pelajaran` varchar(100) DEFAULT NULL,
  `mapel_id` int(11) DEFAULT NULL,
  `no_telp` varchar(20) DEFAULT NULL,
  `alamat` text DEFAULT NULL,
  `jenis_kelamin` enum('L','P') DEFAULT NULL,
  `status` enum('aktif','tidak_aktif','pensiun') NOT NULL DEFAULT 'aktif',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `guru`
--

INSERT INTO `guru` (`id`, `id_guru`, `user_id`, `username`, `nip`, `nama`, `email`, `mata_pelajaran`, `mapel_id`, `no_telp`, `alamat`, `jenis_kelamin`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, 2, 'guru_matematika', '198001012005011001', 'Budi Santoso', NULL, NULL, 1, '081234567890', NULL, 'L', 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(2, 2, 3, 'guru_biologi', '198502022008012002', 'Citra Lestari', NULL, NULL, 2, '081234567891', NULL, 'P', 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(3, 3, 4, 'guru_fisika', '198203032006011003', 'Agus Wijaya', NULL, NULL, 3, '081234567892', NULL, 'L', 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(4, 4, 5, 'guru_sejarah', '198804042010012004', 'Dewi Anggraini', NULL, NULL, 4, '081234567893', NULL, 'P', 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47');

-- --------------------------------------------------------

--
-- Struktur dari tabel `jadwal`
--

CREATE TABLE `jadwal` (
  `id_jadwal` int(11) NOT NULL,
  `kelas_id` int(11) NOT NULL,
  `mapel_id` int(11) NOT NULL,
  `guru_id` int(11) NOT NULL,
  `hari` varchar(10) NOT NULL COMMENT 'Senin, Selasa, dst.',
  `jam_ke` int(11) NOT NULL,
  `jam_mulai` time NOT NULL,
  `jam_selesai` time NOT NULL,
  `status` enum('aktif','tidak_aktif') NOT NULL DEFAULT 'aktif',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `jadwal`
--

INSERT INTO `jadwal` (`id_jadwal`, `kelas_id`, `mapel_id`, `guru_id`, `hari`, `jam_ke`, `jam_mulai`, `jam_selesai`, `status`, `created_at`) VALUES
(1, 1, 1, 1, 'Senin', 1, '07:00:00', '07:45:00', 'aktif', '2025-08-27 07:43:47'),
(2, 1, 1, 1, 'Senin', 2, '07:45:00', '08:30:00', 'aktif', '2025-08-27 07:43:47'),
(3, 3, 4, 4, 'Senin', 3, '08:30:00', '09:15:00', 'aktif', '2025-08-27 07:43:47'),
(4, 1, 2, 2, 'Senin', 4, '09:30:00', '10:15:00', 'aktif', '2025-08-27 07:43:47'),
(5, 1, 3, 3, 'Selasa', 1, '07:00:00', '07:45:00', 'aktif', '2025-08-27 07:43:48'),
(6, 3, 5, 1, 'Selasa', 2, '07:45:00', '08:30:00', 'aktif', '2025-08-27 07:43:48'),
(7, 1, 1, 1, 'Rabu', 1, '07:00:00', '07:45:00', 'aktif', '2025-08-27 07:43:48'),
(8, 1, 2, 2, 'Rabu', 2, '07:45:00', '08:30:00', 'aktif', '2025-08-27 07:43:48'),
(9, 3, 3, 3, 'Rabu', 3, '08:30:00', '09:15:00', 'aktif', '2025-08-27 07:43:48'),
(10, 1, 4, 4, 'Kamis', 1, '07:00:00', '07:45:00', 'aktif', '2025-08-27 07:43:48'),
(11, 1, 5, 1, 'Kamis', 2, '07:45:00', '08:30:00', 'aktif', '2025-08-27 07:43:48'),
(12, 3, 1, 1, 'Kamis', 3, '08:30:00', '09:15:00', 'aktif', '2025-08-27 07:43:48'),
(13, 1, 5, 1, 'Jumat', 1, '07:00:00', '07:45:00', 'aktif', '2025-08-27 07:43:48'),
(14, 1, 4, 4, 'Jumat', 2, '07:45:00', '08:30:00', 'aktif', '2025-08-27 07:43:48'),
(15, 3, 2, 2, 'Jumat', 3, '08:30:00', '09:15:00', 'aktif', '2025-08-27 07:43:48');

-- --------------------------------------------------------

--
-- Stand-in struktur untuk tampilan `jadwal_pelajaran`
-- (Lihat di bawah untuk tampilan aktual)
--
CREATE TABLE `jadwal_pelajaran` (
`id` int(11)
,`hari` varchar(10)
,`jam_mulai` time
,`jam_selesai` time
,`jam_ke` int(11)
,`status` enum('aktif','tidak_aktif')
,`guru_id` int(11)
,`kelas_id` int(11)
,`mapel_id` int(11)
);

-- --------------------------------------------------------

--
-- Struktur dari tabel `kelas`
--

CREATE TABLE `kelas` (
  `id_kelas` int(11) NOT NULL,
  `nama_kelas` varchar(50) NOT NULL,
  `tingkat` varchar(10) DEFAULT NULL COMMENT 'Contoh: X, XI, XII',
  `jumlah_siswa` int(11) DEFAULT 0,
  `status` enum('aktif','tidak_aktif') NOT NULL DEFAULT 'aktif',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `kelas`
--

INSERT INTO `kelas` (`id_kelas`, `nama_kelas`, `tingkat`, `jumlah_siswa`, `status`, `created_at`) VALUES
(1, 'X IPA 1', 'X', 32, 'aktif', '2025-08-27 07:43:47'),
(2, 'X IPA 2', 'X', 31, 'aktif', '2025-08-27 07:43:47'),
(3, 'XI IPS 2', 'XI', 35, 'aktif', '2025-08-27 07:43:47'),
(4, 'XII Bahasa', 'XII', 28, 'aktif', '2025-08-27 07:43:47');

-- --------------------------------------------------------

--
-- Struktur dari tabel `mapel`
--

CREATE TABLE `mapel` (
  `id_mapel` int(11) NOT NULL,
  `kode_mapel` varchar(20) NOT NULL,
  `nama_mapel` varchar(100) NOT NULL,
  `deskripsi` text DEFAULT NULL,
  `status` enum('aktif','tidak_aktif') NOT NULL DEFAULT 'aktif',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `mapel`
--

INSERT INTO `mapel` (`id_mapel`, `kode_mapel`, `nama_mapel`, `deskripsi`, `status`, `created_at`) VALUES
(1, 'MTK-01', 'Matematika Wajib', 'Matematika untuk semua jurusan', 'aktif', '2025-08-27 07:43:46'),
(2, 'BIO-01', 'Biologi', 'Ilmu hayati dan makhluk hidup', 'aktif', '2025-08-27 07:43:46'),
(3, 'FIS-01', 'Fisika', 'Ilmu tentang materi dan energi', 'aktif', '2025-08-27 07:43:46'),
(4, 'SEJ-01', 'Sejarah Indonesia', 'Sejarah perjuangan bangsa Indonesia', 'aktif', '2025-08-27 07:43:46'),
(5, 'BING-01', 'Bahasa Inggris', 'Bahasa Inggris tingkat lanjut', 'aktif', '2025-08-27 07:43:46');

-- --------------------------------------------------------

--
-- Stand-in struktur untuk tampilan `mata_pelajaran`
-- (Lihat di bawah untuk tampilan aktual)
--
CREATE TABLE `mata_pelajaran` (
`id` int(11)
,`nama_mapel` varchar(100)
,`kode_mapel` varchar(20)
);

-- --------------------------------------------------------

--
-- Struktur dari tabel `pengajuan_banding_absen`
--

CREATE TABLE `pengajuan_banding_absen` (
  `id_banding` int(11) NOT NULL,
  `siswa_id` int(11) NOT NULL COMMENT 'ID siswa perwakilan yang mengajukan banding',
  `jadwal_id` int(11) NOT NULL COMMENT 'ID jadwal yang akan dibanding',
  `tanggal_absen` date NOT NULL COMMENT 'Tanggal absensi yang akan dibanding',
  `status_asli` enum('hadir','izin','sakit','alpa','kelas','dispen') NOT NULL COMMENT 'Status absensi yang tercatat saat ini',
  `status_diajukan` enum('hadir','izin','sakit','alpa','kelas','dispen') NOT NULL COMMENT 'Status yang diajukan siswa',
  `alasan_banding` text NOT NULL COMMENT 'Alasan mengajukan banding',
  `bukti_pendukung` varchar(255) DEFAULT NULL COMMENT 'Path file bukti (foto, surat, dll)',
  `status_banding` enum('pending','disetujui','ditolak') NOT NULL DEFAULT 'pending',
  `catatan_guru` text DEFAULT NULL COMMENT 'Catatan dari guru saat memproses banding',
  `tanggal_pengajuan` timestamp NOT NULL DEFAULT current_timestamp(),
  `tanggal_keputusan` timestamp NULL DEFAULT NULL COMMENT 'Waktu guru memberikan keputusan',
  `diproses_oleh` int(11) DEFAULT NULL COMMENT 'ID guru yang memproses banding',
  `kelas_id` int(11) DEFAULT NULL COMMENT 'ID kelas untuk banding kelas',
  `jenis_banding` enum('individual','kelas') NOT NULL DEFAULT 'kelas' COMMENT 'Jenis banding - siswa perwakilan selalu mengajukan untuk kelas'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `pengajuan_banding_absen`
--

INSERT INTO `pengajuan_banding_absen` (`id_banding`, `siswa_id`, `jadwal_id`, `tanggal_absen`, `status_asli`, `status_diajukan`, `alasan_banding`, `bukti_pendukung`, `status_banding`, `catatan_guru`, `tanggal_pengajuan`, `tanggal_keputusan`, `diproses_oleh`, `kelas_id`, `jenis_banding`) VALUES
(1, 1, 1, '2025-08-23', 'alpa', 'hadir', 'Sebenarnya siswa hadir tapi tidak tercatat karena sistem error', NULL, 'pending', NULL, '2025-08-24 03:00:00', NULL, NULL, 1, 'kelas'),
(2, 1, 2, '2025-08-22', 'alpa', 'sakit', 'Ada beberapa siswa yang sakit tapi tidak bisa mengajukan izin tepat waktu', NULL, 'pending', NULL, '2025-08-24 04:30:00', NULL, NULL, 1, 'kelas');

-- --------------------------------------------------------

--
-- Stand-in struktur untuk tampilan `pengajuan_izin`
-- (Lihat di bawah untuk tampilan aktual)
--
CREATE TABLE `pengajuan_izin` (
`id_izin` int(11)
,`siswa_id` int(11)
,`jadwal_id` int(11)
,`tanggal_izin` date
,`tanggal_mulai` date
,`tanggal_selesai` date
,`jenis_izin` enum('sakit','izin','urusan_keluarga','keperluan_pribadi','lainnya','kelas','dispen')
,`alasan` text
,`bukti_pendukung` varchar(255)
,`status` enum('pending','disetujui','ditolak')
,`keterangan_guru` text
,`tanggal_pengajuan` timestamp
,`tanggal_respon` timestamp
,`tanggal_disetujui` timestamp
,`guru_id` int(11)
,`kelas_id` int(11)
);

-- --------------------------------------------------------

--
-- Struktur dari tabel `pengajuan_izin_detail`
--

CREATE TABLE `pengajuan_izin_detail` (
  `id_detail` int(11) NOT NULL,
  `pengajuan_id` int(11) NOT NULL COMMENT 'ID pengajuan utama',
  `nama_siswa` varchar(100) NOT NULL COMMENT 'Nama siswa yang izin',
  `jenis_izin` enum('sakit','izin','alpa','dispen') NOT NULL DEFAULT 'izin',
  `alasan` text NOT NULL COMMENT 'Alasan spesifik siswa',
  `bukti_pendukung` varchar(255) DEFAULT NULL COMMENT 'Path file bukti untuk siswa ini'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `pengajuan_izin_detail`
--

INSERT INTO `pengajuan_izin_detail` (`id_detail`, `pengajuan_id`, `nama_siswa`, `jenis_izin`, `alasan`, `bukti_pendukung`) VALUES
(1, 1, 'Ahmad Rizki', 'sakit', 'Demam tinggi', 'surat_dokter_ahmad.jpg'),
(2, 1, 'Siti Nurhaliza', 'sakit', 'Flu berat', 'surat_dokter_siti.jpg'),
(3, 2, 'Budi Santoso', 'izin', 'Urusan keluarga', NULL),
(4, 3, 'Rina Amelia', '', 'Acara keluarga', 'foto_acara.jpg');

-- --------------------------------------------------------

--
-- Struktur dari tabel `pengajuan_izin_siswa`
--

CREATE TABLE `pengajuan_izin_siswa` (
  `id_pengajuan` int(11) NOT NULL,
  `siswa_id` int(11) NOT NULL COMMENT 'ID siswa yang mengajukan izin (dari tabel siswa_perwakilan)',
  `jadwal_id` int(11) DEFAULT NULL COMMENT 'ID jadwal yang tidak bisa dihadiri (optional untuk izin harian)',
  `tanggal_izin` date NOT NULL COMMENT 'Tanggal izin',
  `tanggal_mulai` date DEFAULT NULL COMMENT 'Untuk backward compatibility',
  `tanggal_selesai` date DEFAULT NULL COMMENT 'Untuk backward compatibility',
  `jenis_izin` enum('sakit','izin','urusan_keluarga','keperluan_pribadi','lainnya','kelas','dispen') NOT NULL DEFAULT 'izin',
  `alasan` text NOT NULL COMMENT 'Alasan pengajuan izin',
  `bukti_pendukung` varchar(255) DEFAULT NULL COMMENT 'Path file bukti (foto surat dokter, dll)',
  `status` enum('pending','disetujui','ditolak') NOT NULL DEFAULT 'pending',
  `keterangan_guru` text DEFAULT NULL COMMENT 'Keterangan dari guru saat approve/reject',
  `tanggal_pengajuan` timestamp NOT NULL DEFAULT current_timestamp(),
  `tanggal_respon` timestamp NULL DEFAULT NULL COMMENT 'Waktu guru memberikan respon',
  `tanggal_disetujui` timestamp NULL DEFAULT NULL COMMENT 'Alias untuk tanggal_respon untuk kompatibilitas server',
  `guru_id` int(11) DEFAULT NULL COMMENT 'ID guru yang memberikan respon',
  `kelas_id` int(11) DEFAULT NULL COMMENT 'ID kelas untuk pengajuan kelas'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `pengajuan_izin_siswa`
--

INSERT INTO `pengajuan_izin_siswa` (`id_pengajuan`, `siswa_id`, `jadwal_id`, `tanggal_izin`, `tanggal_mulai`, `tanggal_selesai`, `jenis_izin`, `alasan`, `bukti_pendukung`, `status`, `keterangan_guru`, `tanggal_pengajuan`, `tanggal_respon`, `tanggal_disetujui`, `guru_id`, `kelas_id`) VALUES
(1, 1, 1, '2025-08-25', NULL, NULL, 'sakit', 'Demam dan flu, tidak bisa mengikuti pelajaran matematika', NULL, 'pending', NULL, '2025-08-24 01:00:00', NULL, NULL, NULL, NULL),
(2, 1, 2, '2025-08-26', NULL, NULL, 'izin', 'Ada keperluan keluarga mendadak', NULL, 'disetujui', NULL, '2025-08-24 00:30:00', NULL, NULL, NULL, NULL),
(3, 1, NULL, '2025-08-27', NULL, NULL, 'urusan_keluarga', 'Menghadiri acara keluarga', NULL, 'pending', NULL, '2025-08-24 02:15:00', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Stand-in struktur untuk tampilan `siswa`
-- (Lihat di bawah untuk tampilan aktual)
--
CREATE TABLE `siswa` (
`id` int(11)
,`id_siswa` int(11)
,`user_id` int(11)
,`username` varchar(50)
,`nis` varchar(30)
,`nama` varchar(100)
,`kelas_id` int(11)
,`jabatan` varchar(50)
,`jenis_kelamin` enum('L','P')
,`email` varchar(100)
,`alamat` text
,`telepon_orangtua` varchar(20)
,`status` enum('aktif','tidak_aktif','lulus')
,`created_at` timestamp
,`updated_at` timestamp
);

-- --------------------------------------------------------

--
-- Struktur dari tabel `siswa_perwakilan`
--

CREATE TABLE `siswa_perwakilan` (
  `id` int(11) NOT NULL,
  `id_siswa` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `nis` varchar(30) NOT NULL,
  `nama` varchar(100) NOT NULL,
  `kelas_id` int(11) NOT NULL,
  `jabatan` varchar(50) DEFAULT 'Sekretaris Kelas',
  `jenis_kelamin` enum('L','P') DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL COMMENT 'Email siswa (opsional, bisa juga diambil dari tabel users)',
  `alamat` text DEFAULT NULL,
  `telepon_orangtua` varchar(20) DEFAULT NULL,
  `status` enum('aktif','tidak_aktif','lulus') NOT NULL DEFAULT 'aktif' COMMENT 'Status siswa (berbeda dengan status kehadiran di absensi_siswa)',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `siswa_perwakilan`
--

INSERT INTO `siswa_perwakilan` (`id`, `id_siswa`, `user_id`, `username`, `nis`, `nama`, `kelas_id`, `jabatan`, `jenis_kelamin`, `email`, `alamat`, `telepon_orangtua`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, 6, 'perwakilan_x_ipa1', '25001', 'Rina Amelia', 1, 'Sekretaris Kelas', 'P', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(2, 2, 7, 'perwakilan_xi_ips2', '25002', 'Doni Saputra', 3, 'Ketua Murid', 'L', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(3, 3, 8, 'siswa_x_ipa1', '25003', 'Ahmad Rizki', 1, 'Siswa', 'L', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-28 00:50:55'),
(4, 4, 9, 'siswa_x_ipa1_2', '25004', 'Siti Nurhaliza', 1, 'Siswa', 'P', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(5, 5, 10, 'siswa_x_ipa1_3', '25005', 'Budi Santoso', 1, 'Siswa', 'L', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(6, 6, 11, 'siswa_x_ipa1_4', '25006', 'Dewi Sartika', 1, 'Siswa', 'P', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(7, 7, 12, 'siswa_x_ipa1_5', '25007', 'Eko Prasetyo', 1, 'Siswa', 'L', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(8, 8, 13, 'siswa_xi_ips2_1', '25008', 'Maya Indah', 3, 'Siswa', 'P', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(9, 9, 14, 'siswa_xi_ips2_2', '25009', 'Rudi Hartono', 3, 'Siswa', 'L', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(10, 10, 15, 'siswa_xi_ips2_3', '25010', 'Nina Safitri', 3, 'Siswa', 'P', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(11, 11, 16, 'siswa_xi_ips2_4', '25011', 'Joko Widodo', 3, 'Siswa', 'L', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47'),
(12, 12, 17, 'siswa_xi_ips2_5', '25012', 'Sri Wahyuni', 3, 'Siswa', 'P', NULL, NULL, NULL, 'aktif', '2025-08-27 07:43:47', '2025-08-27 07:43:47');

-- --------------------------------------------------------

--
-- Struktur dari tabel `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','guru','siswa') NOT NULL,
  `nama` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `status` enum('aktif','tidak_aktif','ditangguhkan') NOT NULL DEFAULT 'aktif',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `role`, `nama`, `email`, `status`, `created_at`, `updated_at`) VALUES
(1, 'admin', '$2b$10$GXYzG70rioB780L8pQfP/O.Kibhi1.CJgPdI6POcO5uVMY27oPdfu', 'admin', 'Administrator', 'admin@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(2, 'guru_matematika', '$2b$10$XZDymBcqc.pjOGVCw4LXueZXiHxiKylpweuS3WuO3BzDHbZj/COZy', 'guru', 'Budi Santoso', 'budi.s@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(3, 'guru_biologi', '$2b$10$XZDymBcqc.pjOGVCw4LXueZXiHxiKylpweuS3WuO3BzDHbZj/COZy', 'guru', 'Citra Lestari', 'citra.l@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(4, 'guru_fisika', '$2b$10$XZDymBcqc.pjOGVCw4LXueZXiHxiKylpweuS3WuO3BzDHbZj/COZy', 'guru', 'Agus Wijaya', 'agus.w@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(5, 'guru_sejarah', '$2b$10$XZDymBcqc.pjOGVCw4LXueZXiHxiKylpweuS3WuO3BzDHbZj/COZy', 'guru', 'Dewi Anggraini', 'dewi.a@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(6, 'perwakilan_x_ipa1', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Rina Amelia', 'rina.a@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(7, 'perwakilan_xi_ips2', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Doni Saputra', 'doni.s@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(8, 'siswa_x_ipa1', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Ahmad Rizki', 'ahmad.r@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-28 00:50:55'),
(9, 'siswa_x_ipa1_2', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Siti Nurhaliza', 'siti.n@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(10, 'siswa_x_ipa1_3', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Budi Santoso', 'budi.s2@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(11, 'siswa_x_ipa1_4', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Dewi Sartika', 'dewi.s@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(12, 'siswa_x_ipa1_5', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Eko Prasetyo', 'eko.p@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(13, 'siswa_xi_ips2_1', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Maya Indah', 'maya.i@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(14, 'siswa_xi_ips2_2', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Rudi Hartono', 'rudi.h@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(15, 'siswa_xi_ips2_3', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Nina Safitri', 'nina.s@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(16, 'siswa_xi_ips2_4', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Joko Widodo', 'joko.w@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46'),
(17, 'siswa_xi_ips2_5', '$2b$10$nw4zU1itkUz2TvE4o1CqjuX0lpt4WVjhtT9WQxKfr5OtstAynnqJG', 'siswa', 'Sri Wahyuni', 'sri.w@sekolah.sch.id', 'aktif', '2025-08-27 07:43:46', '2025-08-27 07:43:46');

-- --------------------------------------------------------

--
-- Struktur untuk view `jadwal_pelajaran`
--
DROP TABLE IF EXISTS `jadwal_pelajaran`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `jadwal_pelajaran`  AS SELECT `j`.`id_jadwal` AS `id`, `j`.`hari` AS `hari`, `j`.`jam_mulai` AS `jam_mulai`, `j`.`jam_selesai` AS `jam_selesai`, `j`.`jam_ke` AS `jam_ke`, `j`.`status` AS `status`, `j`.`guru_id` AS `guru_id`, `j`.`kelas_id` AS `kelas_id`, `j`.`mapel_id` AS `mapel_id` FROM `jadwal` AS `j` ;

-- --------------------------------------------------------

--
-- Struktur untuk view `mata_pelajaran`
--
DROP TABLE IF EXISTS `mata_pelajaran`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `mata_pelajaran`  AS SELECT `m`.`id_mapel` AS `id`, `m`.`nama_mapel` AS `nama_mapel`, `m`.`kode_mapel` AS `kode_mapel` FROM `mapel` AS `m` ;

-- --------------------------------------------------------

--
-- Struktur untuk view `pengajuan_izin`
--
DROP TABLE IF EXISTS `pengajuan_izin`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `pengajuan_izin`  AS SELECT `pengajuan_izin_siswa`.`id_pengajuan` AS `id_izin`, `pengajuan_izin_siswa`.`siswa_id` AS `siswa_id`, `pengajuan_izin_siswa`.`jadwal_id` AS `jadwal_id`, `pengajuan_izin_siswa`.`tanggal_izin` AS `tanggal_izin`, `pengajuan_izin_siswa`.`tanggal_mulai` AS `tanggal_mulai`, `pengajuan_izin_siswa`.`tanggal_selesai` AS `tanggal_selesai`, `pengajuan_izin_siswa`.`jenis_izin` AS `jenis_izin`, `pengajuan_izin_siswa`.`alasan` AS `alasan`, `pengajuan_izin_siswa`.`bukti_pendukung` AS `bukti_pendukung`, `pengajuan_izin_siswa`.`status` AS `status`, `pengajuan_izin_siswa`.`keterangan_guru` AS `keterangan_guru`, `pengajuan_izin_siswa`.`tanggal_pengajuan` AS `tanggal_pengajuan`, coalesce(`pengajuan_izin_siswa`.`tanggal_disetujui`,`pengajuan_izin_siswa`.`tanggal_respon`) AS `tanggal_respon`, coalesce(`pengajuan_izin_siswa`.`tanggal_disetujui`,`pengajuan_izin_siswa`.`tanggal_respon`) AS `tanggal_disetujui`, `pengajuan_izin_siswa`.`guru_id` AS `guru_id`, `pengajuan_izin_siswa`.`kelas_id` AS `kelas_id` FROM `pengajuan_izin_siswa` ;

-- --------------------------------------------------------

--
-- Struktur untuk view `siswa`
--
DROP TABLE IF EXISTS `siswa`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `siswa`  AS SELECT `siswa_perwakilan`.`id` AS `id`, `siswa_perwakilan`.`id_siswa` AS `id_siswa`, `siswa_perwakilan`.`user_id` AS `user_id`, `siswa_perwakilan`.`username` AS `username`, `siswa_perwakilan`.`nis` AS `nis`, `siswa_perwakilan`.`nama` AS `nama`, `siswa_perwakilan`.`kelas_id` AS `kelas_id`, `siswa_perwakilan`.`jabatan` AS `jabatan`, `siswa_perwakilan`.`jenis_kelamin` AS `jenis_kelamin`, `siswa_perwakilan`.`email` AS `email`, `siswa_perwakilan`.`alamat` AS `alamat`, `siswa_perwakilan`.`telepon_orangtua` AS `telepon_orangtua`, `siswa_perwakilan`.`status` AS `status`, `siswa_perwakilan`.`created_at` AS `created_at`, `siswa_perwakilan`.`updated_at` AS `updated_at` FROM `siswa_perwakilan` ;

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `absensi_guru`
--
ALTER TABLE `absensi_guru`
  ADD PRIMARY KEY (`id_absensi`),
  ADD UNIQUE KEY `unique_absensi_harian` (`jadwal_id`,`tanggal`),
  ADD KEY `fk_absensi_guru_idx` (`guru_id`),
  ADD KEY `fk_absensi_kelas_idx` (`kelas_id`),
  ADD KEY `fk_absensi_siswa_idx` (`siswa_pencatat_id`);

--
-- Indeks untuk tabel `absensi_siswa`
--
ALTER TABLE `absensi_siswa`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_absensi_siswa_harian` (`siswa_id`,`tanggal`),
  ADD KEY `fk_absensi_siswa_siswa_idx` (`siswa_id`),
  ADD KEY `fk_absensi_siswa_jadwal_idx` (`jadwal_id`),
  ADD KEY `fk_absensi_siswa_guru_idx` (`guru_id`);

--
-- Indeks untuk tabel `banding_absen_detail`
--
ALTER TABLE `banding_absen_detail`
  ADD PRIMARY KEY (`id_detail`),
  ADD KEY `fk_detail_banding_idx` (`banding_id`);

--
-- Indeks untuk tabel `banding_pengajuan_izin`
--
ALTER TABLE `banding_pengajuan_izin`
  ADD PRIMARY KEY (`id_banding`),
  ADD KEY `fk_banding_pengajuan_idx` (`pengajuan_id`),
  ADD KEY `fk_banding_admin_idx` (`admin_id`);

--
-- Indeks untuk tabel `guru`
--
ALTER TABLE `guru`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id_guru_UNIQUE` (`id_guru`),
  ADD UNIQUE KEY `nip_UNIQUE` (`nip`),
  ADD UNIQUE KEY `username_UNIQUE_guru` (`username`),
  ADD KEY `fk_guru_users_idx` (`user_id`),
  ADD KEY `fk_guru_mapel_idx` (`mapel_id`);

--
-- Indeks untuk tabel `jadwal`
--
ALTER TABLE `jadwal`
  ADD PRIMARY KEY (`id_jadwal`),
  ADD KEY `fk_jadwal_kelas_idx` (`kelas_id`),
  ADD KEY `fk_jadwal_mapel_idx` (`mapel_id`),
  ADD KEY `fk_jadwal_guru_idx` (`guru_id`);

--
-- Indeks untuk tabel `kelas`
--
ALTER TABLE `kelas`
  ADD PRIMARY KEY (`id_kelas`),
  ADD UNIQUE KEY `nama_kelas_UNIQUE` (`nama_kelas`);

--
-- Indeks untuk tabel `mapel`
--
ALTER TABLE `mapel`
  ADD PRIMARY KEY (`id_mapel`),
  ADD UNIQUE KEY `kode_mapel_UNIQUE` (`kode_mapel`);

--
-- Indeks untuk tabel `pengajuan_banding_absen`
--
ALTER TABLE `pengajuan_banding_absen`
  ADD PRIMARY KEY (`id_banding`),
  ADD KEY `fk_banding_absen_siswa_idx` (`siswa_id`),
  ADD KEY `fk_banding_absen_jadwal_idx` (`jadwal_id`),
  ADD KEY `fk_banding_absen_guru_idx` (`diproses_oleh`),
  ADD KEY `fk_banding_absen_kelas_idx` (`kelas_id`);

--
-- Indeks untuk tabel `pengajuan_izin_detail`
--
ALTER TABLE `pengajuan_izin_detail`
  ADD PRIMARY KEY (`id_detail`),
  ADD KEY `fk_detail_pengajuan_idx` (`pengajuan_id`);

--
-- Indeks untuk tabel `pengajuan_izin_siswa`
--
ALTER TABLE `pengajuan_izin_siswa`
  ADD PRIMARY KEY (`id_pengajuan`),
  ADD KEY `fk_pengajuan_siswa_idx` (`siswa_id`),
  ADD KEY `fk_pengajuan_jadwal_idx` (`jadwal_id`),
  ADD KEY `fk_pengajuan_guru_idx` (`guru_id`),
  ADD KEY `fk_pengajuan_kelas_idx` (`kelas_id`);

--
-- Indeks untuk tabel `siswa_perwakilan`
--
ALTER TABLE `siswa_perwakilan`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id_siswa_UNIQUE` (`id_siswa`),
  ADD UNIQUE KEY `nis_UNIQUE` (`nis`),
  ADD UNIQUE KEY `username_UNIQUE_siswa` (`username`),
  ADD KEY `fk_siswa_users_idx` (`user_id`),
  ADD KEY `fk_siswa_kelas_idx` (`kelas_id`);

--
-- Indeks untuk tabel `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username_UNIQUE` (`username`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `absensi_guru`
--
ALTER TABLE `absensi_guru`
  MODIFY `id_absensi` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT untuk tabel `absensi_siswa`
--
ALTER TABLE `absensi_siswa`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT untuk tabel `banding_absen_detail`
--
ALTER TABLE `banding_absen_detail`
  MODIFY `id_detail` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT untuk tabel `banding_pengajuan_izin`
--
ALTER TABLE `banding_pengajuan_izin`
  MODIFY `id_banding` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `guru`
--
ALTER TABLE `guru`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT untuk tabel `jadwal`
--
ALTER TABLE `jadwal`
  MODIFY `id_jadwal` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT untuk tabel `kelas`
--
ALTER TABLE `kelas`
  MODIFY `id_kelas` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT untuk tabel `mapel`
--
ALTER TABLE `mapel`
  MODIFY `id_mapel` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT untuk tabel `pengajuan_banding_absen`
--
ALTER TABLE `pengajuan_banding_absen`
  MODIFY `id_banding` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT untuk tabel `pengajuan_izin_detail`
--
ALTER TABLE `pengajuan_izin_detail`
  MODIFY `id_detail` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT untuk tabel `pengajuan_izin_siswa`
--
ALTER TABLE `pengajuan_izin_siswa`
  MODIFY `id_pengajuan` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT untuk tabel `siswa_perwakilan`
--
ALTER TABLE `siswa_perwakilan`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT untuk tabel `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- Ketidakleluasaan untuk tabel pelimpahan (Dumped Tables)
--

--
-- Ketidakleluasaan untuk tabel `absensi_guru`
--
ALTER TABLE `absensi_guru`
  ADD CONSTRAINT `fk_absensi_guru` FOREIGN KEY (`guru_id`) REFERENCES `guru` (`id_guru`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_absensi_jadwal` FOREIGN KEY (`jadwal_id`) REFERENCES `jadwal` (`id_jadwal`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_absensi_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id_kelas`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_absensi_siswa` FOREIGN KEY (`siswa_pencatat_id`) REFERENCES `siswa_perwakilan` (`id_siswa`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `absensi_siswa`
--
ALTER TABLE `absensi_siswa`
  ADD CONSTRAINT `fk_absensi_siswa_guru` FOREIGN KEY (`guru_id`) REFERENCES `guru` (`id_guru`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_absensi_siswa_jadwal` FOREIGN KEY (`jadwal_id`) REFERENCES `jadwal` (`id_jadwal`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_absensi_siswa_siswa` FOREIGN KEY (`siswa_id`) REFERENCES `siswa_perwakilan` (`id_siswa`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `banding_absen_detail`
--
ALTER TABLE `banding_absen_detail`
  ADD CONSTRAINT `fk_detail_banding` FOREIGN KEY (`banding_id`) REFERENCES `pengajuan_banding_absen` (`id_banding`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `banding_pengajuan_izin`
--
ALTER TABLE `banding_pengajuan_izin`
  ADD CONSTRAINT `fk_banding_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_banding_pengajuan` FOREIGN KEY (`pengajuan_id`) REFERENCES `pengajuan_izin_siswa` (`id_pengajuan`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `guru`
--
ALTER TABLE `guru`
  ADD CONSTRAINT `fk_guru_mapel` FOREIGN KEY (`mapel_id`) REFERENCES `mapel` (`id_mapel`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_guru_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `jadwal`
--
ALTER TABLE `jadwal`
  ADD CONSTRAINT `fk_jadwal_guru` FOREIGN KEY (`guru_id`) REFERENCES `guru` (`id_guru`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_jadwal_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id_kelas`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_jadwal_mapel` FOREIGN KEY (`mapel_id`) REFERENCES `mapel` (`id_mapel`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `pengajuan_banding_absen`
--
ALTER TABLE `pengajuan_banding_absen`
  ADD CONSTRAINT `fk_banding_absen_guru` FOREIGN KEY (`diproses_oleh`) REFERENCES `guru` (`id_guru`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_banding_absen_jadwal` FOREIGN KEY (`jadwal_id`) REFERENCES `jadwal` (`id_jadwal`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_banding_absen_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id_kelas`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_banding_absen_siswa` FOREIGN KEY (`siswa_id`) REFERENCES `siswa_perwakilan` (`id_siswa`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `pengajuan_izin_detail`
--
ALTER TABLE `pengajuan_izin_detail`
  ADD CONSTRAINT `fk_detail_pengajuan` FOREIGN KEY (`pengajuan_id`) REFERENCES `pengajuan_izin_siswa` (`id_pengajuan`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `pengajuan_izin_siswa`
--
ALTER TABLE `pengajuan_izin_siswa`
  ADD CONSTRAINT `fk_pengajuan_guru` FOREIGN KEY (`guru_id`) REFERENCES `guru` (`id_guru`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pengajuan_jadwal` FOREIGN KEY (`jadwal_id`) REFERENCES `jadwal` (`id_jadwal`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pengajuan_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id_kelas`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pengajuan_siswa` FOREIGN KEY (`siswa_id`) REFERENCES `siswa_perwakilan` (`id_siswa`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `siswa_perwakilan`
--
ALTER TABLE `siswa_perwakilan`
  ADD CONSTRAINT `fk_siswa_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id_kelas`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_siswa_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
