-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 26 Okt 2025 pada 22.53
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
  `waktu_catat` timestamp NOT NULL DEFAULT current_timestamp(),
  `terlambat` tinyint(1) NOT NULL DEFAULT 0,
  `ada_tugas` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `absensi_guru`
--

INSERT INTO `absensi_guru` (`id_absensi`, `jadwal_id`, `guru_id`, `kelas_id`, `siswa_pencatat_id`, `tanggal`, `jam_ke`, `status`, `keterangan`, `waktu_catat`, `terlambat`, `ada_tugas`) VALUES
(2, 2, 2, 1, 1, '2024-01-15', 2, 'Hadir', '', '2025-10-04 11:48:19', 0, 0),
(3, 3, 3, 1, 1, '2024-01-15', 3, 'Hadir', '', '2025-10-04 11:48:19', 0, 1),
(4, 4, 1, 2, 3, '2024-01-15', 1, 'Hadir', '', '2025-10-04 11:48:19', 0, 1),
(6, 6, 1, 3, 5, '2024-01-16', 1, 'Hadir', '', '2025-10-04 11:48:19', 0, 1),
(7, 7, 2, 3, 5, '2024-01-16', 2, 'Hadir', '', '2025-10-04 11:48:19', 0, 0),
(8, 8, 2, 1, 1, '2024-01-16', 3, 'Hadir', '', '2025-10-04 11:48:19', 0, 1),
(9, 9, 3, 2, 3, '2024-01-16', 3, 'Hadir', '', '2025-10-04 11:48:19', 0, 0),
(10, 10, 3, 3, 5, '2024-01-16', 4, 'Hadir', '', '2025-10-04 11:48:19', 0, 1),
(11, 11, 1, 1, 1, '2025-10-04', 1, 'Tidak Hadir', 'Halo', '2025-10-04 14:30:21', 0, 0),
(12, 11, 1, 1, 1, '2025-10-11', 1, 'Tidak Hadir', 'tidak tahu', '2025-10-11 13:06:13', 0, 0),
(13, 8, 2, 1, 1, '2025-10-14', 3, 'Izin', 'Tidak Tahu', '2025-10-17 01:00:27', 0, 0),
(19, 2, 2, 1, 1, '2025-10-13', 2, 'Izin', 'qdqwdq', '2025-10-14 16:07:45', 0, 0),
(20, 3, 3, 1, 1, '2025-10-13', 3, 'Sakit', 'dqwdqwd', '2025-10-14 16:07:46', 0, 0),
(21, 15, 1, 1, 1, '2025-10-17', 1, 'Izin', NULL, '2025-10-20 11:04:19', 0, 0),
(22, 16, 1, 1, 1, '2025-10-17', 1, 'Tidak Hadir', NULL, '2025-10-20 11:04:19', 0, 0),
(23, 15, 3, 1, 1, '2025-10-17', 1, 'Izin', NULL, '2025-10-20 11:04:19', 0, 0),
(24, 16, 3, 1, 1, '2025-10-17', 1, 'Tidak Hadir', NULL, '2025-10-20 11:04:19', 0, 0),
(25, 11, 1, 1, 1, '2025-10-17', 1, 'Tidak Hadir', 'tidak tahu', '2025-10-18 00:20:46', 0, 0),
(26, 18, 1, 2, 3, '2025-10-18', 1, 'Hadir', NULL, '2025-10-18 16:05:32', 0, 0),
(27, 18, 3, 2, 3, '2025-10-18', 1, 'Hadir', NULL, '2025-10-18 16:05:32', 0, 0),
(28, 18, 1, 2, 3, '2025-10-13', 1, 'Hadir', NULL, '2025-10-18 13:39:52', 0, 0),
(29, 18, 3, 2, 3, '2025-10-13', 1, 'Hadir', NULL, '2025-10-18 13:39:52', 0, 0),
(30, 11, 1, 1, 1, '2025-10-18', 1, 'Hadir', NULL, '2025-10-19 05:33:50', 0, 0),
(31, 11, 3, 1, 1, '2025-10-18', 1, 'Hadir', NULL, '2025-10-19 05:33:50', 0, 0),
(32, 2, 2, 1, 1, '2025-10-20', 2, 'Sakit', 'tidak tahu tapi izin', '2025-10-21 14:12:36', 0, 0),
(33, 3, 3, 1, 1, '2025-10-20', 3, 'Tidak Hadir', 'tidak tahu', '2025-10-21 14:12:35', 0, 0),
(34, 2, 11, 1, 1, '2025-10-20', 2, 'Izin', 'ada tapi izin', '2025-10-21 14:12:36', 0, 0),
(35, 3, 3, 1, 1, '2025-10-17', 3, 'Tidak Hadir', 'halo', '2025-10-20 11:04:33', 0, 0),
(36, 2, 2, 1, 1, '2025-10-17', 2, 'Izin', NULL, '2025-10-20 11:04:33', 0, 0),
(37, 2, 11, 1, 1, '2025-10-17', 2, 'Izin', NULL, '2025-10-20 11:04:33', 0, 0),
(38, 8, 2, 1, 1, '2025-10-21', 3, 'Izin', 'Kata\n', '2025-10-21 14:11:44', 0, 0),
(39, 8, 2, 1, 1, '2025-10-19', 3, 'Sakit', 'Kataa\n', '2025-10-21 13:25:48', 0, 0),
(40, 19, 1, 1, 1, '2025-10-22', 1, 'Tidak Hadir', 'Tidak Ada Keterangan ', '2025-10-22 12:46:32', 0, 0),
(41, 11, 1, 1, 1, '2025-10-25', 1, 'Hadir', NULL, '2025-10-25 02:06:23', 0, 0);

-- --------------------------------------------------------

--
-- Struktur dari tabel `absensi_guru_archive`
--

CREATE TABLE `absensi_guru_archive` (
  `id_absensi` int(11) NOT NULL,
  `jadwal_id` int(11) NOT NULL,
  `guru_id` int(11) NOT NULL,
  `kelas_id` int(11) NOT NULL,
  `siswa_pencatat_id` int(11) NOT NULL,
  `tanggal` date NOT NULL,
  `jam_ke` int(11) NOT NULL,
  `status` enum('Hadir','Tidak Hadir','Sakit','Izin','Dispen') NOT NULL,
  `keterangan` text DEFAULT NULL,
  `waktu_catat` timestamp NOT NULL DEFAULT current_timestamp(),
  `terlambat` tinyint(1) NOT NULL DEFAULT 0,
  `ada_tugas` tinyint(1) NOT NULL DEFAULT 0,
  `archived_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `absensi_siswa`
--

CREATE TABLE `absensi_siswa` (
  `id` int(11) NOT NULL,
  `siswa_id` int(11) NOT NULL COMMENT 'Relasi ke siswa.id_siswa',
  `jadwal_id` int(11) DEFAULT NULL COMMENT 'Relasi ke jadwal.id_jadwal (opsional untuk absensi harian)',
  `tanggal` date NOT NULL,
  `status` enum('Hadir','Izin','Sakit','Alpa','Dispen') NOT NULL COMMENT 'Status kehadiran siswa pada tanggal tersebut',
  `keterangan` text DEFAULT NULL,
  `waktu_absen` datetime NOT NULL DEFAULT current_timestamp(),
  `guru_id` int(11) DEFAULT NULL COMMENT 'ID guru yang mencatat absensi (opsional) - backward compatibility',
  `guru_pengabsen_id` int(11) DEFAULT NULL COMMENT 'ID guru yang mengabsen siswa (untuk multi-guru support)',
  `terlambat` tinyint(1) NOT NULL DEFAULT 0,
  `ada_tugas` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `absensi_siswa`
--

INSERT INTO `absensi_siswa` (`id`, `siswa_id`, `jadwal_id`, `tanggal`, `status`, `keterangan`, `waktu_absen`, `guru_id`, `guru_pengabsen_id`, `terlambat`, `ada_tugas`) VALUES
(1, 1, NULL, '2024-01-15', 'Hadir', '', '2025-10-04 11:48:19', 1, 1, 0, 1),
(2, 2, NULL, '2024-01-15', 'Hadir', '', '2025-10-04 11:48:19', 1, 1, 0, 1),
(4, 4, 4, '2024-01-15', 'Hadir', '', '2025-10-04 11:48:19', 1, 1, 0, 1),
(5, 5, 6, '2024-01-16', 'Hadir', '', '2025-10-04 11:48:19', 1, 1, 0, 1),
(6, 6, 6, '2024-01-16', 'Hadir', '', '2025-10-04 11:48:19', 1, 1, 0, 1),
(7, 1, 2, '2024-01-16', 'Hadir', '', '2025-10-04 11:48:19', 2, 2, 0, 0),
(8, 2, 2, '2024-01-16', 'Hadir', '', '2025-10-04 11:48:19', 2, 2, 0, 0),
(10, 4, NULL, '2024-01-16', 'Hadir', '', '2025-10-04 11:48:19', 2, 2, 0, 0),
(17, 1, 2, '2025-10-07', 'Hadir', '', '0000-00-00 00:00:00', NULL, 2, 0, 0),
(18, 2, 2, '2025-10-07', 'Izin', 'Izin sakit', '0000-00-00 00:00:00', NULL, 2, 0, 0),
(20, 1, 2, '2025-10-07', 'Hadir', '', '2025-10-07 03:25:14', 11, 11, 0, 0),
(21, 2, 2, '2025-10-07', 'Izin', 'Izin sakit', '2025-10-07 03:25:14', 11, 11, 0, 0),
(23, 1, 11, '2025-10-11', 'Izin', 'acara keluarga', '2025-10-11 13:32:10', 1, 1, 0, 0),
(24, 2, 11, '2025-10-11', 'Hadir', '', '2025-10-11 13:32:10', 1, 1, 0, 0),
(25, 7, 11, '2025-10-11', 'Hadir', '', '2025-10-11 13:32:10', 1, 1, 0, 0),
(26, 1, NULL, '2025-10-13', 'Izin', 'sda', '2025-10-13 07:42:49', 1, 1, 0, 0),
(27, 2, NULL, '2025-10-13', 'Hadir', '', '2025-10-13 07:42:49', 1, 1, 0, 0),
(28, 7, NULL, '2025-10-13', 'Hadir', '', '2025-10-13 07:42:49', 1, 1, 0, 0),
(29, 5, 6, '2025-10-14', 'Izin', 'Acara Keluarga', '2025-10-14 15:20:19', 1, 1, 0, 0),
(30, 6, 6, '2025-10-14', 'Hadir', '', '2025-10-14 15:20:19', 1, 1, 0, 0),
(31, 1, 15, '2025-10-17', 'Izin', 'Ke rumah duluu', '2025-10-17 01:02:15', 1, 1, 0, 0),
(32, 2, 15, '2025-10-17', 'Hadir', '', '2025-10-17 01:02:15', 1, 1, 0, 0),
(33, 7, 15, '2025-10-17', 'Hadir', '', '2025-10-17 01:02:15', 1, 1, 0, 0),
(34, 1, 15, '2025-10-17', 'Izin', 'Ke rumah duluu', '2025-10-17 01:02:15', 3, 3, 0, 0),
(35, 2, 15, '2025-10-17', 'Hadir', '', '2025-10-17 01:02:15', 3, 3, 0, 0),
(36, 7, 15, '2025-10-17', 'Hadir', '', '2025-10-17 01:02:15', 3, 3, 0, 0),
(37, 1, 16, '2025-10-17', 'Izin', 'tidak tahu', '2025-10-17 11:49:41', 1, 1, 0, 0),
(38, 2, 16, '2025-10-17', 'Hadir', '', '2025-10-17 11:49:41', 1, 1, 0, 0),
(39, 7, 16, '2025-10-17', 'Hadir', '', '2025-10-17 11:49:41', 1, 1, 0, 0),
(40, 1, 16, '2025-10-17', 'Izin', 'tidak tahu', '2025-10-17 11:49:41', 3, 3, 0, 0),
(41, 2, 16, '2025-10-17', 'Hadir', '', '2025-10-17 11:49:41', 3, 3, 0, 0),
(42, 7, 16, '2025-10-17', 'Hadir', '', '2025-10-17 11:49:41', 3, 3, 0, 0),
(43, 1, 11, '2025-10-18', 'Izin', '.', '2025-10-18 16:06:34', 1, 1, 0, 0),
(44, 2, 11, '2025-10-18', 'Izin', '.', '2025-10-18 16:06:34', 1, 1, 0, 0),
(45, 7, 11, '2025-10-18', 'Izin', '.', '2025-10-18 16:06:34', 1, 1, 0, 0),
(46, 1, 11, '2025-10-18', 'Izin', '.', '2025-10-18 16:06:34', 3, 3, 0, 0),
(47, 2, 11, '2025-10-18', 'Izin', '.', '2025-10-18 16:06:34', 3, 3, 0, 0),
(48, 7, 11, '2025-10-18', 'Izin', '.', '2025-10-18 16:06:34', 3, 3, 0, 0),
(49, 3, 4, '2025-10-20', 'Hadir', '', '2025-10-20 11:08:36', 1, 1, 0, 0),
(50, 4, 4, '2025-10-20', 'Izin', 'ada acara', '2025-10-20 11:08:36', 1, 1, 0, 0),
(51, 5, 6, '2025-10-21', 'Izin', 'fdf', '2025-10-21 19:01:30', 1, 1, 0, 0),
(52, 1, 19, '2025-10-22', 'Izin', 'Acara Keluarga', '2025-10-22 19:48:07', 1, 1, 0, 0),
(53, 2, 19, '2025-10-22', 'Hadir', '', '2025-10-22 19:48:07', 1, 1, 0, 0),
(54, 7, 19, '2025-10-22', 'Hadir', '', '2025-10-22 19:48:07', 1, 1, 0, 0);

-- --------------------------------------------------------

--
-- Struktur dari tabel `absensi_siswa_archive`
--

CREATE TABLE `absensi_siswa_archive` (
  `id` int(11) NOT NULL,
  `siswa_id` int(11) NOT NULL COMMENT 'Relasi ke siswa.id_siswa',
  `jadwal_id` int(11) DEFAULT NULL COMMENT 'Relasi ke jadwal.id_jadwal (opsional untuk absensi harian)',
  `tanggal` date NOT NULL,
  `status` enum('Hadir','Izin','Sakit','Alpa','Dispen') NOT NULL COMMENT 'Status kehadiran siswa pada tanggal tersebut',
  `keterangan` text DEFAULT NULL,
  `waktu_absen` datetime NOT NULL DEFAULT current_timestamp(),
  `guru_id` int(11) DEFAULT NULL COMMENT 'ID guru yang mencatat absensi (opsional) - backward compatibility',
  `guru_pengabsen_id` int(11) DEFAULT NULL COMMENT 'ID guru yang mengabsen siswa (untuk multi-guru support)',
  `terlambat` tinyint(1) NOT NULL DEFAULT 0,
  `ada_tugas` tinyint(1) NOT NULL DEFAULT 0,
  `archived_at` timestamp NOT NULL DEFAULT current_timestamp()
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
(1, 1, 2, 'guru1', '196501011990031001', 'Budi Santoso', 'budi@absenta13.com', 'Matematika', 1, '081234567891', 'Cibiru', 'L', 'aktif', '2025-10-04 11:48:18', '2025-10-19 15:32:10'),
(2, 2, 3, 'guru2', '196502021990032002', 'Siti Nurhaliza', 'siti@absenta.com', 'Fisika', 2, '081234567891', 'Jl. Sudirman No. 2', 'P', 'aktif', '2025-10-04 11:48:18', '2025-10-04 11:48:18'),
(3, 3, 4, 'guru3', '196503031990033003', 'Ahmad Wijaya', 'ahmad@absenta.com', 'Kimia', 3, '081234567892', 'Jl. Thamrin No. 3', 'L', 'aktif', '2025-10-04 11:48:18', '2025-10-04 11:48:18'),
(4, 11, 11, 'asep1', '756766464678', 'Ahmad Rizki', 'asep1@gmail.com', 'Sejarah', 7, '081234567892', 'Halooo', 'L', 'aktif', '2025-10-05 01:09:24', '2025-10-13 14:09:08'),
(5, 13, 13, 'geral00', '756766464674', 'Ahmad Rizkiiiiiiiiiiiiii', 'asepsolanaa@gmail.com', 'Sejarah', 6, '081234567891', 'bandung x4', 'L', 'aktif', '2025-10-13 06:51:07', '2025-10-24 11:58:33'),
(6, 15, 15, 'Sukses034', '198203032006011003', 'Sukses', 'sukses8299@gmail.com', NULL, 11, '081234567890', 'halo', 'L', 'aktif', '2025-10-24 12:03:28', '2025-10-24 12:03:28');

-- --------------------------------------------------------

--
-- Struktur dari tabel `jadwal`
--

CREATE TABLE `jadwal` (
  `id_jadwal` int(11) NOT NULL,
  `kelas_id` int(11) NOT NULL,
  `mapel_id` int(11) DEFAULT NULL,
  `guru_id` int(11) DEFAULT NULL,
  `ruang_id` int(11) DEFAULT NULL,
  `hari` varchar(10) NOT NULL COMMENT 'Senin, Selasa, dst.',
  `jam_ke` int(11) NOT NULL,
  `jam_mulai` time NOT NULL,
  `jam_selesai` time NOT NULL,
  `status` enum('aktif','tidak_aktif') NOT NULL DEFAULT 'aktif',
  `jenis_aktivitas` enum('pelajaran','upacara','istirahat','kegiatan_khusus','libur','ujian','lainnya') NOT NULL DEFAULT 'pelajaran' COMMENT 'Jenis aktivitas jadwal',
  `is_absenable` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Apakah bisa diabsen (0=tidak, 1=ya)',
  `keterangan_khusus` text DEFAULT NULL COMMENT 'Keterangan untuk aktivitas khusus',
  `is_multi_guru` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Apakah jadwal ini memiliki multiple guru (0=tidak, 1=ya)',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `jadwal`
--

INSERT INTO `jadwal` (`id_jadwal`, `kelas_id`, `mapel_id`, `guru_id`, `ruang_id`, `hari`, `jam_ke`, `jam_mulai`, `jam_selesai`, `status`, `jenis_aktivitas`, `is_absenable`, `keterangan_khusus`, `is_multi_guru`, `created_at`) VALUES
(2, 1, 2, 2, 1, 'Senin', 2, '07:45:00', '08:30:00', 'aktif', 'pelajaran', 1, NULL, 1, '2025-10-04 11:48:19'),
(3, 1, 3, 3, 1, 'Senin', 3, '08:30:00', '09:15:00', 'aktif', 'pelajaran', 1, NULL, 0, '2025-10-04 11:48:19'),
(4, 2, 1, 1, 2, 'Senin', 1, '07:00:00', '07:45:00', 'aktif', 'pelajaran', 1, NULL, 0, '2025-10-04 11:48:19'),
(6, 3, 1, 1, 3, 'Selasa', 1, '07:00:00', '07:45:00', 'aktif', 'pelajaran', 1, NULL, 0, '2025-10-04 11:48:19'),
(7, 3, 2, 2, 3, 'Selasa', 2, '07:45:00', '08:30:00', 'aktif', 'pelajaran', 1, NULL, 0, '2025-10-04 11:48:19'),
(8, 1, 4, 2, 1, 'Selasa', 3, '08:30:00', '09:15:00', 'aktif', 'pelajaran', 1, NULL, 0, '2025-10-04 11:48:19'),
(9, 2, 3, 3, 2, 'Selasa', 3, '08:30:00', '09:15:00', 'aktif', 'pelajaran', 1, NULL, 0, '2025-10-04 11:48:19'),
(10, 3, 3, 3, 3, 'Selasa', 4, '09:15:00', '10:00:00', 'aktif', 'pelajaran', 1, NULL, 0, '2025-10-04 11:48:19'),
(11, 1, 5, 1, 6, 'Sabtu', 1, '19:41:00', '22:41:00', 'aktif', 'pelajaran', 1, NULL, 1, '2025-10-04 12:41:53'),
(12, 1, NULL, NULL, NULL, 'Senin', 4, '17:31:00', '18:31:00', 'aktif', 'kegiatan_khusus', 0, '-', 0, '2025-10-14 03:31:53'),
(15, 1, 5, 1, 1, 'Jumat', 1, '06:06:00', '07:30:00', 'aktif', 'pelajaran', 1, NULL, 1, '2025-10-16 23:07:26'),
(16, 1, 1, 1, 2, 'Jumat', 2, '14:31:00', '17:31:00', 'aktif', 'pelajaran', 1, NULL, 1, '2025-10-17 07:32:01'),
(17, 2, 3, 3, 6, 'Jumat', 1, '17:32:00', '23:00:00', 'aktif', 'pelajaran', 1, NULL, 0, '2025-10-17 11:02:46'),
(18, 2, 8, 1, 2, 'Sabtu', 1, '07:20:00', '08:20:00', 'aktif', 'pelajaran', 1, NULL, 1, '2025-10-18 00:23:20'),
(19, 1, 1, 1, 3, 'Rabu', 1, '07:30:00', '10:50:00', 'aktif', 'pelajaran', 1, NULL, 0, '2025-10-22 12:43:37');

-- --------------------------------------------------------

--
-- Struktur dari tabel `jadwal_guru`
--

CREATE TABLE `jadwal_guru` (
  `id` int(11) NOT NULL,
  `jadwal_id` int(11) NOT NULL,
  `guru_id` int(11) NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1=primary guru, 0=additional guru',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Relasi many-to-many antara jadwal dan guru untuk support multi-guru';

--
-- Dumping data untuk tabel `jadwal_guru`
--

INSERT INTO `jadwal_guru` (`id`, `jadwal_id`, `guru_id`, `is_primary`, `created_at`) VALUES
(3, 3, 3, 1, '2025-10-06 10:54:34'),
(4, 4, 1, 1, '2025-10-06 10:54:34'),
(6, 6, 1, 1, '2025-10-06 10:54:34'),
(7, 7, 2, 1, '2025-10-06 10:54:34'),
(8, 8, 2, 1, '2025-10-06 10:54:34'),
(9, 9, 3, 1, '2025-10-06 10:54:34'),
(10, 10, 3, 1, '2025-10-06 10:54:34'),
(16, 2, 2, 1, '2025-10-06 11:33:48'),
(17, 2, 11, 0, '2025-10-06 11:33:49'),
(18, 15, 1, 1, '2025-10-16 23:07:28'),
(19, 15, 3, 0, '2025-10-16 23:07:28'),
(20, 16, 1, 1, '2025-10-17 07:32:02'),
(21, 16, 3, 0, '2025-10-17 07:32:02'),
(22, 17, 3, 1, '2025-10-17 11:02:46'),
(23, 18, 1, 1, '2025-10-18 00:23:21'),
(24, 18, 3, 0, '2025-10-18 00:23:21'),
(29, 11, 1, 1, '2025-10-19 15:16:49'),
(30, 11, 3, 0, '2025-10-19 15:16:49'),
(31, 19, 1, 1, '2025-10-22 12:43:38');

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
(1, 'X IPA 1', 'X', 30, 'aktif', '2025-10-04 11:48:17'),
(2, 'X IPA 2', 'X', 28, 'aktif', '2025-10-04 11:48:17'),
(3, 'X IPS 1', 'X', 32, 'aktif', '2025-10-04 11:48:17'),
(4, 'XI IPA 1', 'XI', 29, 'aktif', '2025-10-04 11:48:17'),
(5, 'XI IPA 2', 'XI', 31, 'aktif', '2025-10-04 11:48:17'),
(6, 'XI IPS 1', 'XI', 27, 'aktif', '2025-10-04 11:48:17'),
(7, 'XII IPA 1', 'XII', 30, 'aktif', '2025-10-04 11:48:17'),
(8, 'XII IPA 2', 'XII', 28, 'aktif', '2025-10-04 11:48:17'),
(9, 'XII IPS 1', 'XII', 33, 'aktif', '2025-10-04 11:48:17');

-- --------------------------------------------------------

--
-- Struktur dari tabel `kop_laporan`
--

CREATE TABLE `kop_laporan` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `cakupan` enum('global','jenis_laporan') NOT NULL COMMENT 'Cakupan KOP: global atau per jenis laporan',
  `kode_laporan` varchar(100) DEFAULT NULL COMMENT 'Kode laporan spesifik (NULL untuk global)',
  `aktif` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Status aktif KOP',
  `perataan` enum('kiri','tengah','kanan') NOT NULL DEFAULT 'tengah' COMMENT 'Perataan teks KOP',
  `baris_teks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Array baris teks KOP' CHECK (json_valid(`baris_teks`)),
  `logo_tengah_url` varchar(255) DEFAULT NULL COMMENT 'URL logo tengah',
  `logo_kiri_url` varchar(255) DEFAULT NULL COMMENT 'URL logo kiri',
  `logo_kanan_url` varchar(255) DEFAULT NULL COMMENT 'URL logo kanan',
  `dibuat_pada` datetime DEFAULT current_timestamp() COMMENT 'Waktu pembuatan',
  `diubah_pada` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Waktu perubahan terakhir',
  `unique_key` varchar(200) GENERATED ALWAYS AS (concat(`cakupan`,'|',coalesce(`kode_laporan`,''))) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Tabel konfigurasi KOP/letterhead laporan';

--
-- Dumping data untuk tabel `kop_laporan`
--

INSERT INTO `kop_laporan` (`id`, `cakupan`, `kode_laporan`, `aktif`, `perataan`, `baris_teks`, `logo_tengah_url`, `logo_kiri_url`, `logo_kanan_url`, `dibuat_pada`, `diubah_pada`) VALUES
(7, 'global', NULL, 1, 'tengah', '[{\"text\":\"PEMERINTAH DAERAH PROVINSI JAWA BARAt\",\"fontWeight\":\"bold\"},{\"text\":\"DINAS PENDIDIKAN\",\"fontWeight\":\"bold\"},{\"text\":\"SMK NEGERI 13 JAKARTA\",\"fontWeight\":\"bold\"},{\"text\":\"Jl. Raya Bekasi Km. 18, Cakung, Jakarta Timur 13910\",\"fontWeight\":\"normal\"}]', NULL, '/uploads/letterheads/logo_1760244968082.png', '/uploads/letterheads/logo_1760244968277.png', '2025-10-10 08:15:06', '2025-10-18 12:36:15');

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
(1, 'MTK', 'Matematika', 'Mata pelajaran matematika', 'aktif', '2025-10-04 11:48:17'),
(2, 'FIS', 'Fisika', 'Mata pelajaran fisika', 'aktif', '2025-10-04 11:48:17'),
(3, 'KIM', 'Kimia', 'Mata pelajaran kimia', 'aktif', '2025-10-04 11:48:17'),
(4, 'BIO', 'Biologi', 'Mata pelajaran biologi', 'aktif', '2025-10-04 11:48:17'),
(5, 'BHS', 'Bahasa Indonesia', 'Mata pelajaran bahasa Indonesiaa', 'aktif', '2025-10-04 11:48:17'),
(6, 'ING', 'Bahasa Inggris', 'Mata pelajaran bahasa Inggris', 'aktif', '2025-10-04 11:48:17'),
(7, 'SEJ', 'Sejarah', 'Mata pelajaran sejarah', 'aktif', '2025-10-04 11:48:17'),
(8, 'GEO', 'Geografi', 'Mata pelajaran geografi', 'aktif', '2025-10-04 11:48:17'),
(9, 'EKO', 'Ekonomi', 'Mata pelajaran ekonomi', 'aktif', '2025-10-04 11:48:17'),
(10, 'PKN', 'Pendidikan Kewarganegaraan', 'Mata pelajaran PKN', 'aktif', '2025-10-04 11:48:17'),
(11, 'PJOK', 'Pendidikan Jasmani', 'Mata pelajaran PJOK', 'aktif', '2025-10-04 11:48:17'),
(12, 'SENI', 'Seni Budaya', 'Mata pelajaran seni budaya', 'aktif', '2025-10-04 11:48:17');

-- --------------------------------------------------------

--
-- Struktur dari tabel `mata_pelajaran`
--

CREATE TABLE `mata_pelajaran` (
  `id` int(11) DEFAULT NULL,
  `nama_mapel` varchar(100) DEFAULT NULL,
  `kode_mapel` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `pengajuan_banding_absen`
--

CREATE TABLE `pengajuan_banding_absen` (
  `id_banding` int(11) NOT NULL,
  `siswa_id` int(11) NOT NULL COMMENT 'ID siswa yang mengajukan banding',
  `jadwal_id` int(11) NOT NULL COMMENT 'ID jadwal yang akan dibanding',
  `tanggal_absen` date NOT NULL COMMENT 'Tanggal absensi yang akan dibanding',
  `status_asli` enum('hadir','izin','sakit','alpa','kelas','dispen') NOT NULL,
  `status_diajukan` enum('hadir','izin','sakit','alpa','kelas','dispen') NOT NULL,
  `alasan_banding` text NOT NULL COMMENT 'Alasan mengajukan banding',
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

INSERT INTO `pengajuan_banding_absen` (`id_banding`, `siswa_id`, `jadwal_id`, `tanggal_absen`, `status_asli`, `status_diajukan`, `alasan_banding`, `status_banding`, `catatan_guru`, `tanggal_pengajuan`, `tanggal_keputusan`, `diproses_oleh`, `kelas_id`, `jenis_banding`) VALUES
(2, 2, 2, '2024-01-15', 'alpa', 'izin', 'Saya sudah izin sebelumnya', 'disetujui', 'Berdasarkan bukti yang ada, banding dikabulkan', '2025-10-04 11:48:20', '2025-10-04 11:48:20', 1, 1, 'kelas'),
(3, 1, 8, '2025-10-14', 'alpa', 'hadir', 'Olawjda', 'pending', NULL, '2025-10-14 13:34:23', NULL, NULL, NULL, 'individual'),
(4, 1, 2, '2025-10-14', 'alpa', 'hadir', 'sdas', 'disetujui', 'iya', '2025-10-16 14:02:12', '2025-10-19 15:18:33', 2, NULL, 'individual'),
(5, 3, 18, '2025-10-18', 'alpa', 'hadir', 'y', 'disetujui', 'iya', '2025-10-18 01:23:51', '2025-10-18 16:07:16', 1, NULL, 'individual'),
(6, 1, 11, '2025-10-18', 'alpa', 'hadir', 'w', 'pending', NULL, '2025-10-19 15:51:13', NULL, NULL, NULL, 'individual'),
(7, 1, 2, '2025-10-13', 'alpa', 'hadir', 'wd', 'pending', NULL, '2025-10-19 16:15:14', NULL, NULL, NULL, 'individual'),
(8, 1, 16, '2025-10-18', 'alpa', 'hadir', 'jkhu', 'pending', NULL, '2025-10-20 11:07:27', NULL, NULL, NULL, 'individual'),
(9, 7, 8, '2025-10-14', 'alpa', 'hadir', 'qsq', 'pending', NULL, '2025-10-20 12:20:22', NULL, NULL, NULL, 'individual'),
(10, 2, 8, '2025-10-21', 'alpa', 'hadir', 'klhikj', 'pending', NULL, '2025-10-21 05:37:05', NULL, NULL, NULL, 'individual');

-- --------------------------------------------------------

--
-- Struktur dari tabel `ruang_kelas`
--

CREATE TABLE `ruang_kelas` (
  `id_ruang` int(11) NOT NULL,
  `kode_ruang` varchar(10) NOT NULL,
  `nama_ruang` varchar(100) DEFAULT NULL,
  `lokasi` varchar(100) DEFAULT NULL COMMENT 'Gedung/lantai (opsional)',
  `kapasitas` int(11) DEFAULT NULL,
  `status` enum('aktif','tidak_aktif') NOT NULL DEFAULT 'aktif',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Tabel ruang kelas untuk manajemen ruangan';

--
-- Dumping data untuk tabel `ruang_kelas`
--

INSERT INTO `ruang_kelas` (`id_ruang`, `kode_ruang`, `nama_ruang`, `lokasi`, `kapasitas`, `status`, `created_at`, `updated_at`) VALUES
(1, 'A101', 'Ruang A101', 'Gedung A Lantai 1', 30, 'aktif', '2025-10-04 11:48:17', '2025-10-04 11:48:17'),
(2, 'A102', 'Ruang A102', 'Gedung A Lantai 1', 30, 'aktif', '2025-10-04 11:48:17', '2025-10-04 11:48:17'),
(3, 'A103', 'Ruang A103', 'Gedung A Lantai 1', 30, 'aktif', '2025-10-04 11:48:17', '2025-10-04 11:48:17'),
(4, 'A201', 'Ruang A201', 'Gedung A Lantai 2', 30, 'aktif', '2025-10-04 11:48:17', '2025-10-04 11:48:17'),
(5, 'A202', 'Ruang A202', 'Gedung A Lantai 2', 30, 'aktif', '2025-10-04 11:48:17', '2025-10-04 11:48:17'),
(6, 'LAB1', 'Laboratorium Komputer', 'Gedung B Lantai 1', 25, 'aktif', '2025-10-04 11:48:17', '2025-10-04 11:48:17'),
(7, 'LAB2', 'Laboratorium Kimia', 'Gedung B Lantai 1', 20, 'aktif', '2025-10-04 11:48:17', '2025-10-04 11:48:17'),
(8, 'LAB3', 'Laboratorium Fisika', 'Gedung B Lantai 2', 20, 'aktif', '2025-10-04 11:48:17', '2025-10-13 12:37:56'),
(9, 'AUD', 'Aula', 'Gedung C Lantai 1', 100, 'aktif', '2025-10-04 11:48:17', '2025-10-04 11:48:17');

-- --------------------------------------------------------

--
-- Struktur dari tabel `siswa`
--

CREATE TABLE `siswa` (
  `id` int(11) NOT NULL,
  `id_siswa` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `username` varchar(50) DEFAULT NULL,
  `nis` varchar(30) NOT NULL,
  `nama` varchar(100) NOT NULL,
  `kelas_id` int(11) NOT NULL,
  `jabatan` varchar(50) DEFAULT 'Siswa',
  `jenis_kelamin` enum('L','P') DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `alamat` text DEFAULT NULL,
  `telepon_orangtua` varchar(20) DEFAULT NULL,
  `nomor_telepon_siswa` varchar(15) DEFAULT NULL,
  `status` enum('aktif','tidak_aktif','lulus') NOT NULL DEFAULT 'aktif',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `siswa`
--

INSERT INTO `siswa` (`id`, `id_siswa`, `user_id`, `username`, `nis`, `nama`, `kelas_id`, `jabatan`, `jenis_kelamin`, `email`, `alamat`, `telepon_orangtua`, `nomor_telepon_siswa`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, 5, 'siswa1', '2024001234', 'Andi Pratama', 1, 'Sekretaris Kelas', 'L', 'andi@absenta.com', 'JL . SOETA', '089736538746', '098327328237', 'aktif', '2025-10-04 11:48:18', '2025-10-26 05:38:08'),
(2, 2, 6, 'siswa2', '2024002', 'Sari Dewi', 1, 'Siswa', 'P', 'sari@absenta.com', 'Jl. Mawar No. 2', '081234567002', '081234567102', 'aktif', '2025-10-04 11:48:18', '2025-10-04 11:48:18'),
(3, 3, 7, 'siswa3', '2024003', 'Rizki Ramadhan', 2, 'Siswa', 'L', 'rizki@absenta.com', 'Jl. Melati No. 3', '081234567003', '081234567103', 'aktif', '2025-10-04 11:48:18', '2025-10-04 11:48:18'),
(4, 4, 8, 'siswa4', '2024004', 'Maya Sari', 2, 'Wakil Ketua Kelas', 'P', 'maya@absenta.com', 'Jl. Anggrek No. 4', '081234567004', '081234567104', 'aktif', '2025-10-04 11:48:18', '2025-10-04 11:48:18'),
(5, 5, 9, 'siswa5', '2024005', 'Dedi Kurniawan', 3, 'Sekretaris Kelas', 'L', 'dedi@absenta.com', 'Jl. Tulip No. 5', '081234567005', '081234567105', 'aktif', '2025-10-04 11:48:18', '2025-10-05 00:27:50'),
(6, 6, 10, 'siswa6', '2024006', 'Lina Marlina', 6, 'Sekretaris Kelas', 'P', 'lina@absenta.com', 'Jl. Lavender No. 6', '081234567006', '081234567106', 'aktif', '2025-10-04 11:48:18', '2025-10-15 13:47:24'),
(7, 7, 12, 'siswa01', '8246234784', 'Racing', 1, 'Sekretaris Kelas', 'L', NULL, 'racing', '08971571349', '09867564534', 'aktif', '2025-10-05 01:13:36', '2025-10-13 12:33:04');

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
(1, 'admin', '$2b$10$daZyKBkOIM6e694WJBGDaeViqxq1c8/KRm9qavr3kwu8hG8hVCt.e', 'admin', 'Administratorr', 'admin@absenta.com', 'aktif', '2025-10-04 11:48:16', '2025-10-17 07:10:48'),
(2, 'guru1', '$2b$10$17vhtsgWWX1quKSZRoAgmuFUnZ.HPvqYTrg6VWg1S1zpz7FBraLau', 'guru', 'Budi Santoso', 'budi@absenta13.com', 'aktif', '2025-10-04 11:48:16', '2025-10-19 15:32:10'),
(3, 'guru2', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Siti Nurhaliza', 'siti@absenta.com', 'aktif', '2025-10-04 11:48:16', '2025-10-04 11:48:16'),
(4, 'guru3', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Ahmad Wijaya', 'ahmad@absenta.com', 'aktif', '2025-10-04 11:48:16', '2025-10-04 11:48:16'),
(5, 'siswa1', '$2b$10$tnW4mgUedIC/aelMVEbVfO3mxOuulb/gehpJ8WhaJLZJ93yiZ8kqC', 'siswa', 'Andi Pratama', 'adminbaru@example.com', 'aktif', '2025-10-04 11:48:16', '2025-10-26 05:38:08'),
(6, 'siswa2', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'Sari Dewi', 'sari@absenta.com', 'aktif', '2025-10-04 11:48:16', '2025-10-04 11:48:16'),
(7, 'siswa3', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'Rizki Ramadhan', 'rizki@absenta.com', 'aktif', '2025-10-04 11:48:16', '2025-10-04 11:48:16'),
(8, 'siswa4', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'Maya Sari', 'maya@absenta.com', 'aktif', '2025-10-04 11:48:16', '2025-10-04 11:48:16'),
(9, 'siswa5', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'Dedi Kurniawan', 'dedi@absenta.com', 'aktif', '2025-10-04 11:48:16', '2025-10-04 11:48:16'),
(10, 'siswa6', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'Lina Marlina', 'lina@absenta.com', 'aktif', '2025-10-04 11:48:16', '2025-10-04 11:48:16'),
(11, 'asep1', '$2b$10$j4T1unvaO9N9fX696VontOwBadUeYrS50Aw83BwOCycGzRsF3s2Z.', 'guru', 'Ahmad Rizki', 'asep@gmail.com', 'aktif', '2025-10-05 01:09:24', '2025-10-13 14:09:07'),
(12, 'siswa01', '$2b$10$Bk.db0H6fcK8Fvfo/8MNVOjRnMfKZukwC2TUvzm6.xDkbAIfTyMGW', 'siswa', 'Racing', 'raihanariansyah160307@gmail.com', 'aktif', '2025-10-05 01:13:36', '2025-10-05 02:32:02'),
(13, 'geral00', '$2b$10$Ap9seZQMU7QIc9Q8wmykOeLEi4Lxh7IGFploysZJaYidmXbBiwrOu', 'guru', 'Ahmad Rizkiiiiiiiiiiiiii', 'asepsolanaa@gmail.com', 'aktif', '2025-10-13 06:51:07', '2025-10-22 19:12:38'),
(15, 'Sukses034', '$2b$10$gnqmf5f5manNprBxErL2iu0D7yF61njC7zXVL7DItls6GvMl1pfS6', 'guru', 'Sukses', 'sukses8299@gmail.com', 'aktif', '2025-10-24 12:03:28', '2025-10-24 12:03:28');

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `absensi_guru`
--
ALTER TABLE `absensi_guru`
  ADD PRIMARY KEY (`id_absensi`),
  ADD UNIQUE KEY `unique_absensi_harian` (`jadwal_id`,`guru_id`,`tanggal`),
  ADD KEY `fk_absensi_guru_idx` (`guru_id`),
  ADD KEY `fk_absensi_kelas_idx` (`kelas_id`),
  ADD KEY `fk_absensi_siswa_idx` (`siswa_pencatat_id`),
  ADD KEY `idx_tanggal_guru` (`tanggal`,`guru_id`),
  ADD KEY `idx_jadwal_tanggal` (`jadwal_id`,`tanggal`),
  ADD KEY `idx_absensi_guru_tanggal_status` (`tanggal`,`status`,`terlambat`,`ada_tugas`),
  ADD KEY `idx_absensi_guru_tanggal` (`guru_id`,`tanggal`),
  ADD KEY `idx_absensi_guru_jadwal_guru` (`jadwal_id`,`guru_id`),
  ADD KEY `idx_absensi_guru_tanggal_guru` (`tanggal`,`guru_id`);

--
-- Indeks untuk tabel `absensi_guru_archive`
--
ALTER TABLE `absensi_guru_archive`
  ADD PRIMARY KEY (`id_absensi`),
  ADD UNIQUE KEY `unique_absensi_harian` (`jadwal_id`,`guru_id`,`tanggal`),
  ADD KEY `fk_absensi_guru_idx` (`guru_id`),
  ADD KEY `fk_absensi_kelas_idx` (`kelas_id`),
  ADD KEY `fk_absensi_siswa_idx` (`siswa_pencatat_id`),
  ADD KEY `idx_tanggal_guru` (`tanggal`,`guru_id`),
  ADD KEY `idx_jadwal_tanggal` (`jadwal_id`,`tanggal`),
  ADD KEY `idx_guru_id` (`guru_id`),
  ADD KEY `idx_tanggal` (`tanggal`),
  ADD KEY `idx_archived_at` (`archived_at`),
  ADD KEY `idx_absensi_guru_archive_jadwal_guru` (`jadwal_id`,`guru_id`),
  ADD KEY `idx_absensi_guru_archive_tanggal_guru` (`tanggal`,`guru_id`);

--
-- Indeks untuk tabel `absensi_siswa`
--
ALTER TABLE `absensi_siswa`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_absensi_siswa_harian` (`siswa_id`,`jadwal_id`,`guru_pengabsen_id`,`tanggal`),
  ADD KEY `fk_absensi_siswa_siswa_idx` (`siswa_id`),
  ADD KEY `fk_absensi_siswa_jadwal_idx` (`jadwal_id`),
  ADD KEY `fk_absensi_siswa_guru_idx` (`guru_id`),
  ADD KEY `idx_tanggal_siswa` (`tanggal`,`siswa_id`),
  ADD KEY `idx_tanggal_status` (`tanggal`,`status`),
  ADD KEY `idx_waktu_absen` (`waktu_absen`),
  ADD KEY `idx_siswa_tanggal_jadwal` (`siswa_id`,`tanggal`,`jadwal_id`),
  ADD KEY `idx_status_tanggal` (`status`,`tanggal`),
  ADD KEY `idx_absensi_siswa_tanggal_status` (`tanggal`,`status`,`terlambat`,`ada_tugas`),
  ADD KEY `idx_absensi_siswa_tanggal` (`siswa_id`,`tanggal`),
  ADD KEY `fk_absensi_siswa_guru_pengabsen_idx` (`guru_pengabsen_id`),
  ADD KEY `idx_absensi_siswa_jadwal_guru` (`jadwal_id`,`guru_pengabsen_id`),
  ADD KEY `idx_absensi_siswa_tanggal_guru` (`tanggal`,`guru_pengabsen_id`);

--
-- Indeks untuk tabel `absensi_siswa_archive`
--
ALTER TABLE `absensi_siswa_archive`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_absensi_siswa_harian` (`siswa_id`,`jadwal_id`,`guru_pengabsen_id`,`tanggal`),
  ADD KEY `fk_absensi_siswa_siswa_idx` (`siswa_id`),
  ADD KEY `fk_absensi_siswa_jadwal_idx` (`jadwal_id`),
  ADD KEY `fk_absensi_siswa_guru_idx` (`guru_id`),
  ADD KEY `idx_tanggal_siswa` (`tanggal`,`siswa_id`),
  ADD KEY `idx_tanggal_status` (`tanggal`,`status`),
  ADD KEY `idx_waktu_absen` (`waktu_absen`),
  ADD KEY `idx_siswa_tanggal_jadwal` (`siswa_id`,`tanggal`,`jadwal_id`),
  ADD KEY `idx_status_tanggal` (`status`,`tanggal`),
  ADD KEY `idx_siswa_id` (`siswa_id`),
  ADD KEY `idx_tanggal` (`tanggal`),
  ADD KEY `idx_archived_at` (`archived_at`),
  ADD KEY `fk_absensi_siswa_archive_guru_pengabsen_idx` (`guru_pengabsen_id`),
  ADD KEY `idx_absensi_siswa_archive_jadwal_guru` (`jadwal_id`,`guru_pengabsen_id`),
  ADD KEY `idx_absensi_siswa_archive_tanggal_guru` (`tanggal`,`guru_pengabsen_id`);

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
  ADD KEY `fk_jadwal_guru_idx` (`guru_id`),
  ADD KEY `idx_jadwal_guru_waktu` (`hari`,`guru_id`,`jam_mulai`,`jam_selesai`),
  ADD KEY `idx_jadwal_kelas_waktu` (`hari`,`kelas_id`,`jam_mulai`,`jam_selesai`),
  ADD KEY `fk_jadwal_ruang_idx` (`ruang_id`),
  ADD KEY `idx_jadwal_kelas_hari_jamke` (`kelas_id`,`hari`,`jam_ke`),
  ADD KEY `idx_jadwal_guru_hari_jamke` (`guru_id`,`hari`,`jam_ke`);

--
-- Indeks untuk tabel `jadwal_guru`
--
ALTER TABLE `jadwal_guru`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_jadwal_guru` (`jadwal_id`,`guru_id`),
  ADD KEY `fk_jadwal_guru_jadwal_idx` (`jadwal_id`),
  ADD KEY `fk_jadwal_guru_guru_idx` (`guru_id`),
  ADD KEY `idx_is_primary` (`is_primary`);

--
-- Indeks untuk tabel `kelas`
--
ALTER TABLE `kelas`
  ADD PRIMARY KEY (`id_kelas`),
  ADD UNIQUE KEY `nama_kelas_UNIQUE` (`nama_kelas`);

--
-- Indeks untuk tabel `kop_laporan`
--
ALTER TABLE `kop_laporan`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_global_fixed` (`unique_key`),
  ADD KEY `idx_cakupan_kode` (`cakupan`,`kode_laporan`);

--
-- Indeks untuk tabel `mapel`
--
ALTER TABLE `mapel`
  ADD PRIMARY KEY (`id_mapel`),
  ADD UNIQUE KEY `kode_mapel_UNIQUE` (`kode_mapel`),
  ADD UNIQUE KEY `uniq_mapel_kode` (`kode_mapel`),
  ADD KEY `idx_mapel_status` (`status`);

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
-- Indeks untuk tabel `ruang_kelas`
--
ALTER TABLE `ruang_kelas`
  ADD PRIMARY KEY (`id_ruang`),
  ADD UNIQUE KEY `kode_ruang_UNIQUE` (`kode_ruang`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_kode_ruang` (`kode_ruang`);

--
-- Indeks untuk tabel `siswa`
--
ALTER TABLE `siswa`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id_siswa_UNIQUE` (`id_siswa`),
  ADD UNIQUE KEY `nis_UNIQUE` (`nis`),
  ADD UNIQUE KEY `username_UNIQUE_siswa` (`username`),
  ADD UNIQUE KEY `uq_siswa_nomor_telepon` (`nomor_telepon_siswa`),
  ADD KEY `fk_siswa_users_idx` (`user_id`),
  ADD KEY `fk_siswa_kelas_idx` (`kelas_id`),
  ADD KEY `idx_siswa_status` (`status`);

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
  MODIFY `id_absensi` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT untuk tabel `absensi_guru_archive`
--
ALTER TABLE `absensi_guru_archive`
  MODIFY `id_absensi` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `absensi_siswa`
--
ALTER TABLE `absensi_siswa`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=55;

--
-- AUTO_INCREMENT untuk tabel `absensi_siswa_archive`
--
ALTER TABLE `absensi_siswa_archive`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `guru`
--
ALTER TABLE `guru`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT untuk tabel `jadwal`
--
ALTER TABLE `jadwal`
  MODIFY `id_jadwal` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT untuk tabel `jadwal_guru`
--
ALTER TABLE `jadwal_guru`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT untuk tabel `kelas`
--
ALTER TABLE `kelas`
  MODIFY `id_kelas` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT untuk tabel `kop_laporan`
--
ALTER TABLE `kop_laporan`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT untuk tabel `mapel`
--
ALTER TABLE `mapel`
  MODIFY `id_mapel` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT untuk tabel `pengajuan_banding_absen`
--
ALTER TABLE `pengajuan_banding_absen`
  MODIFY `id_banding` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT untuk tabel `ruang_kelas`
--
ALTER TABLE `ruang_kelas`
  MODIFY `id_ruang` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT untuk tabel `siswa`
--
ALTER TABLE `siswa`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT untuk tabel `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

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
  ADD CONSTRAINT `fk_absensi_siswa` FOREIGN KEY (`siswa_pencatat_id`) REFERENCES `siswa` (`id_siswa`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `absensi_siswa`
--
ALTER TABLE `absensi_siswa`
  ADD CONSTRAINT `fk_absensi_siswa_guru` FOREIGN KEY (`guru_id`) REFERENCES `guru` (`id_guru`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_absensi_siswa_guru_pengabsen` FOREIGN KEY (`guru_pengabsen_id`) REFERENCES `guru` (`id_guru`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_absensi_siswa_jadwal` FOREIGN KEY (`jadwal_id`) REFERENCES `jadwal` (`id_jadwal`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_absensi_siswa_siswa` FOREIGN KEY (`siswa_id`) REFERENCES `siswa` (`id_siswa`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `absensi_siswa_archive`
--
ALTER TABLE `absensi_siswa_archive`
  ADD CONSTRAINT `fk_absensi_siswa_archive_guru_pengabsen` FOREIGN KEY (`guru_pengabsen_id`) REFERENCES `guru` (`id_guru`) ON DELETE SET NULL ON UPDATE CASCADE;

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
  ADD CONSTRAINT `fk_jadwal_guru` FOREIGN KEY (`guru_id`) REFERENCES `guru` (`id_guru`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_jadwal_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id_kelas`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_jadwal_mapel` FOREIGN KEY (`mapel_id`) REFERENCES `mapel` (`id_mapel`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_jadwal_ruang` FOREIGN KEY (`ruang_id`) REFERENCES `ruang_kelas` (`id_ruang`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `jadwal_guru`
--
ALTER TABLE `jadwal_guru`
  ADD CONSTRAINT `fk_jadwal_guru_guru` FOREIGN KEY (`guru_id`) REFERENCES `guru` (`id_guru`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_jadwal_guru_jadwal` FOREIGN KEY (`jadwal_id`) REFERENCES `jadwal` (`id_jadwal`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `pengajuan_banding_absen`
--
ALTER TABLE `pengajuan_banding_absen`
  ADD CONSTRAINT `fk_banding_absen_guru` FOREIGN KEY (`diproses_oleh`) REFERENCES `guru` (`id_guru`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_banding_absen_jadwal` FOREIGN KEY (`jadwal_id`) REFERENCES `jadwal` (`id_jadwal`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_banding_absen_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id_kelas`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_banding_absen_siswa` FOREIGN KEY (`siswa_id`) REFERENCES `siswa` (`id_siswa`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `siswa`
--
ALTER TABLE `siswa`
  ADD CONSTRAINT `fk_siswa_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id_kelas`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_siswa_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
