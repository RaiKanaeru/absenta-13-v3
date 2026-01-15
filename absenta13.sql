SET FOREIGN_KEY_CHECKS=0;
-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Waktu pembuatan: 25 Nov 2025 pada 11.15
-- Versi server: 10.11.10-MariaDB-log
-- Versi PHP: 8.3.25

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
CREATE DATABASE IF NOT EXISTS absenta13;
USE absenta13;

-- --------------------------------------------------------

--
-- Struktur dari tabel `absensi_guru`
--


CREATE TABLE IF NOT EXISTS `absensi_guru` (
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

-- --------------------------------------------------------

--
-- Struktur dari tabel `absensi_guru_archive`
--

CREATE TABLE IF NOT EXISTS `absensi_guru_archive` (
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

CREATE TABLE IF NOT EXISTS `absensi_siswa` (
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

-- --------------------------------------------------------

--
-- Struktur dari tabel `absensi_siswa_archive`
--

CREATE TABLE IF NOT EXISTS `absensi_siswa_archive` (
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

CREATE TABLE IF NOT EXISTS `guru` (
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
(100, 100, 100, 'otong.nugraha', '196506231991031007', 'Drs. Otong Nugraha, M.Si', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(101, 101, 101, 'oman.somana', '196608151991031009', 'Oman Somana, M.Pd', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(102, 102, 102, 'dadan.rukma', '196708281991031006', 'Dadan Rukma Dian Dawan, S.Pd', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(103, 103, 103, 'popong.wariati', '196808171991032015', 'Popong Wariati, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(104, 104, 104, 'ujang.suhara', '196609281995121001', 'Ujang Suhara, S.Pd', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(105, 105, 105, 'mimy.ardiany', '196905161996012001', 'Dra. Mimy Ardiany, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(106, 106, 106, 'sarinah.ginting', '196804061997022001', 'Sarinah Br Ginting, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(107, 107, 107, 'taufik.hidayat', '197101271999031004', 'Taufik Hidayat, M.Pd', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(108, 108, 108, 'rita.hartati', '197710252002122005', 'Rita Hartati, S.Pd, M.T', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(109, 109, 109, 'ade.hartono', '196708251991011004', 'Ade Hartono, S.Pd', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(110, 110, 110, 'tita.heriyanti', '197004251994032005', 'Tita Heriyanti, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(111, 111, 111, 'weni.asmaraeni', '196602281998022003', 'Dra. WENI ASMARAENI', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(112, 112, 112, 'octavina.sopamena', '197310272008012005', 'Octavina Sopamena, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(113, 113, 113, 'lia.yulianti', '197201052002122004', 'Lia Yulianti, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(114, 114, 114, 'santika', '198107172006042013', 'Santika, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(115, 115, 115, 'rina.daryani', '197203292006042004', 'Rina Daryani, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(116, 116, 116, 'rahmi.dalilah', '196801052008012006', 'Dra. Rahmi Dalilah Fitrianni', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(117, 117, 117, 'syafitri.kurniati', '197609262009022002', 'Syafitri Kurniati Arief, S.Pd, M.T', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(118, 118, 118, 'adiwiguna', '198012232009021001', 'Adiwiguna, S.Pd', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(119, 119, 119, 'rani.rabiussani', '198201282009022001', 'Rani Rabiussani, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(120, 120, 120, 'sudarmi', '197604242009022002', 'Dr. Sudarmi, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(121, 121, 121, 'iah.robiah', '197805262009022002', 'Iah Robiah, S.Pd. Kim.', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(122, 122, 122, 'maspuri.andewi', '197510122009042005', 'Maspuri Andewi, S.Kom', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(123, 123, 123, 'ruhya', '197005202010011006', 'Ruhya, S.Ag, M.M.Pd', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(124, 124, 124, 'maya.kusmayanti', '198105072010012015', 'Maya Kusmayanti, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(125, 125, 125, 'dini.karomna', '198707272010012011', 'Dini Karomna, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(126, 126, 126, 'nofa.nirawati', '198711132010012005', 'Nofa Nirawati, S.Pd, M.T', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(127, 127, 127, 'hasan.asari', '198312282011011001', 'Hasan As\'ari, M.Kom', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(128, 128, 128, 'cecep.suryana', '197404092014101001', 'Cecep Suryana, S.Si', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(129, 129, 129, 'nina.dewi', '197910172014112004', 'Nina Dewi Koswara, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(130, 130, 130, 'ina.marina', '197903092014112001', 'Ina Marina, S.T', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(131, 131, 131, 'danty', '198303222014082001', 'Danty, S.Pd.', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(132, 132, 132, 'sugiyatmi', '197809072014112003', 'Sugiyatmi, S.Si', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(133, 133, 133, 'uli.solihat', '197807162021212004', 'Uli Solihat Kamaluddin, S.Si, Gr', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(134, 134, 134, 'atep.aulia', '198312092022211004', 'Atep Aulia Rahman, S.T. M.Kom', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(135, 135, 135, 'endang.sunan', '198109102022211016', 'Endang Sunandar, S.Pd., M.Pkim', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(136, 136, 136, 'hazar.nurbani', '198010192022212007', 'Hazar Nurbani, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(137, 137, 137, 'tini.rosmayani', '198003032022212009', 'Tini Rosmayani, S.Si', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(138, 138, 138, 'priyo.hadisuryo', '197810232021211005', 'Priyo Hadisuryo, S.St', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(139, 139, 139, 'nogi.muharam', '198211012022211004', 'Nogi Muharam, S.Kom.', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(140, 140, 140, 'eva.zulva', '198602062022212026', 'Eva Zulva, S.Kom,i', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(141, 141, 141, 'neneng.suhartini', '198901262022212008', 'Neneng Suhartini, S.Si, S.Pd. Gr', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(142, 142, 142, 'halida.farhani', '198901022022212007', 'Halida Farhani, S.Psi', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(143, 143, 143, 'nur.fauziyah', '199307222022212008', 'Nur Fauziyah Rahmawati, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(144, 144, 144, 'muchamad.harry', '199205122022211004', 'Muchamad Harry Ismail, S.T.R.Kom, M.M', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(145, 145, 145, 'windawati.aisah', '199001192022212025', 'Windawati Aisah, S.Si, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(146, 146, 146, 'ermawati', '198201252022212012', 'Dr. Ermawati, M.Kom', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(147, 147, 147, 'kiki.aima', '199203152022212012', 'Kiki Aima Mu\'mina, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(148, 148, 148, 'nadia.afriliani', '199604122022212013', 'Nadia Afriliani, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(149, 149, 149, 'jaya.sumpena', '198602132022211008', 'Jaya Sumpena, M. Kom', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(150, 150, 150, 'regina.fitrie', '198609072022212012', 'Regina Fitrie, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(151, 151, 151, 'ariantonius.sagala', '197809272022211002', 'Ariantonius Sagala, S.Kom', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(152, 152, 152, 'pratiwi', '199206202022212023', 'Pratiwi, S.S.I', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(153, 153, 153, 'nurul.diningsih', '199311032022212020', 'Nurul Diningsih, S.Hum', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(154, 154, 154, 'dedi.efendi', '197009172022211006', 'Dedi Efendi, S.Kom', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(155, 155, 155, 'eti.arisanti', '197309042023212001', 'Eti Arisanti, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(156, 156, 156, 'nurlaela', '198401112023212009', 'Nurlaela, Sh', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(157, 157, 157, 'yeni.meilina', '198705192023212025', 'Yeni Meilina, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(158, 158, 158, 'rukmana', '197403162023211004', 'Rukmana, S.Pd.I', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(159, 159, 159, 'rini.dwiwahyuni', '197304102023212003', 'Rini Dwiwahyuni, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(160, 160, 160, 'desta.mulyanti', '198912062023212020', 'Desta Mulyanti, S.Sn', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(161, 161, 161, 'meli.novita', '198205102023212009', 'Meli Novita, M.M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(162, 162, 162, 'tessa.eka', '199206052024212025', 'Tessa Eka Yuniar, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(163, 163, 163, 'ela.nurlaela', '198310152024212010', 'Ela Nurlaela, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(164, 164, 164, 'shendy.antariksa', '198903272024211015', 'Shendy Antariksa, S.Hum', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(165, 165, 165, 'apriliani.hardiyanti', '199404032024212035', 'Apriliani Hardiyanti Hariyono, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(166, 166, 166, 'sukmawidi', '199703062024211009', 'Sukmawidi, S.Pd', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(167, 167, 167, 'fertika', '199407102024212025', 'Fertika, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(168, 168, 168, 'indira.sari', '198001222025212001', 'Indira Sari Paputungan, M.Ed. Gr', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(169, 169, 169, 'tubagus.saputra', '199311142025211012', 'Tubagus Saputra, M.Pd', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(170, 170, 170, 'anggita.septiani', '198809162024212011', 'Anggita Septiani, S.T.P, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(171, 171, 171, 'gina.urfah', '198806192023212011', 'Gina Urfah Mastur Sadili, S.Pd.', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(172, 172, 172, 'annisa.intikarusdiansari', '198212232025212004', 'Annisa Intikarusdiansari, S.Pd.', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(173, 173, 173, 'odang.supriatna', '197902162025211003', 'Odang Supriatna, S.E.', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(174, 174, 174, 'samsudin', '9958748652200002', 'Samsudin, S.Ag', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(175, 175, 175, 'kania.dewi', '8450767668230153', 'Kania Dewi Waluya, S.S.T', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(176, 176, 176, 'sabila.fauziyya', '8658775676230112', 'Sabila Fauziyya,S.Kom', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(177, 177, 177, 'dena.handriana', '8535769670130263', 'Dena Handriana, M.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(178, 178, 178, 'windy.novia', '9443771672230283', 'Windy Novia Anggraeni, S.Si', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(179, 179, 179, 'ar.fauzan', '198409182010011007', 'A.R Fauzan, S.Ip. M.M', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(180, 180, 180, 'heni.juhaeni', '9842756658300102', 'Heni Juhaeni, S.Pd', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(181, 181, 181, 'riska.fitriyanti', '5739770671230162', 'Riska Fitriyanti, A.Md', NULL, NULL, NULL, NULL, NULL, 'P', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53'),
(182, 182, 182, 'indra.adiguna', '6446772673130220', 'Indra Adiguna, ST', NULL, NULL, NULL, NULL, NULL, 'L', 'aktif', '2025-11-23 07:21:53', '2025-11-23 07:21:53');

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
(10, 'XI RPL 1', 'XI', 35, 'aktif', '2025-11-23 07:22:38'),
(11, 'XI RPL 2', 'XI', 35, 'aktif', '2025-11-23 07:22:38'),
(12, 'XII RPL 1', 'XII', 35, 'aktif', '2025-11-23 07:22:38'),
(13, 'XII RPL 2', 'XII', 33, 'aktif', '2025-11-23 07:22:38');

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
(100, 100, 200, '102419349', '102419349', 'ADELYA FAUZI ALFIAN', 10, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(101, 101, 201, '102419350', '102419350', 'ADLY SYAKIEB HAFIDZ GUSTIRA', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(102, 102, 202, '102419351', '102419351', 'ALFIZAR SAFIY HAMIZAN', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(103, 103, 203, '102419352', '102419352', 'ALIF YUSUF ANWAR', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(104, 104, 204, '102419353', '102419353', 'ALYA ALMIRA PUTRI', 10, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(105, 105, 205, '102419354', '102419354', 'ANNISA AGHNIYA FAZA', 10, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(106, 106, 206, '102419355', '102419355', 'ARBIANSYAH AKBAR', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(107, 107, 207, '102419356', '102419356', 'AYYAS HUSAYN', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(108, 108, 208, '102419357', '102419357', 'BINTANG PUTRA RASYA DIKA', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(109, 109, 209, '102419358', '102419358', 'DAFFA DERYAN RASHIF', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(110, 110, 210, '102419359', '102419359', 'DANIS FERDIANSYAH', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(111, 111, 211, '102419360', '102419360', 'DEAN SULTAN SADYA', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(112, 112, 212, '102419361', '102419361', 'DZIKRY FARERA LENGGANA', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(113, 113, 213, '102419362', '102419362', 'FARREL MUTTAQIN', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(114, 114, 214, '102419363', '102419363', 'FREGA TEGUH DWIGUNA', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(115, 115, 215, '102419364', '102419364', 'HANIF YANWAR WAHIDAN', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(116, 116, 216, '102419365', '102419365', 'IMEITA NATASHA', 10, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(117, 117, 217, '102419366', '102419366', 'IRHAM HADI AHSANU', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(118, 118, 218, '102419367', '102419367', 'KAISA VIDYA AMATULLAH', 10, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(119, 119, 219, '102419368', '102419368', 'KAKA ANDREA YAHYA', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(120, 120, 220, '102419369', '102419369', 'MARVA AULIA AHMAD', 10, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(121, 121, 221, '102419370', '102419370', 'MUHAMMAD RAFFA HARVANI', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(122, 122, 222, '102419371', '102419371', 'MUHAMMAD WILDAN TAUFIK', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(123, 123, 223, '102419372', '102419372', 'NABIL AKBAR FADHILLAH', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(124, 124, 224, '102419374', '102419374', 'NAUFAL RAUSYAN FIKRI', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(125, 125, 225, '102419375', '102419375', 'NESYA MEGA PUTRI', 10, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(126, 126, 226, '102419376', '102419376', 'PUTRI JASMINE AZZAHRA RAMADHANI', 10, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(127, 127, 227, '102419377', '102419377', 'RAFADITYA SYAHPUTRA', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(128, 128, 228, '102419378', '102419378', 'RAIKHANIA RIZKY PUTRI HERDIANA', 10, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(129, 129, 229, '102419379', '102419379', 'REFKY FAVIAN MAHARDIKA', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(130, 130, 230, '102419380', '102419380', 'RIZKY FAUZI RAHMAN', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(131, 131, 231, '102419381', '102419381', 'SASHYKIRANA ANANDITA SAHRONI', 10, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(132, 132, 232, '102419382', '102419382', 'SITUMORANG, GABRIELDO', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(133, 133, 233, '102419383', '102419383', 'TIFAYATUL HUSNA AZAHRA', 10, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(134, 134, 234, '102419384', '102419384', 'YUGA PUTRA NUGRAHA', 10, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(135, 135, 235, '102419385', '102419385', 'Raihan Ariansyah', 11, 'Siswa', 'L', NULL, 'jl.A.H Nasution/kp.Tagog No.63/198RT01/02 kel.cisaranten/binaharapan ARCAMANIK, KOTA BANDUNG, JAWA BARAT, ID, 40293', '087848705209', '087848705209', 'aktif', '2025-11-23 08:00:52', '2025-11-24 04:24:31'),
(136, 136, 236, '102419386', '102419386', 'AISYAH AGUSTINA RIYANTI', 11, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(137, 137, 237, '102419387', '102419387', 'ALDI FAIZAL', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(138, 138, 238, '102419388', '102419388', 'ANDRI YUDIANSAH', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(139, 139, 239, '102419389', '102419389', 'ARKANANTA WISALA ESHA\'AL', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(140, 140, 240, '102419390', '102419390', 'AUFA FADILAH', 11, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(141, 141, 241, '102419391', '102419391', 'BHAGAS ALAM SASTRO MIHARJO', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(142, 142, 242, '102419392', '102419392', 'CINDY STEVANI', 11, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(143, 143, 243, '102419393', '102419393', 'FAKHRIZA AHMAD DARAJAT', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(144, 144, 244, '102419394', '102419394', 'FARIDA DIANA NABILLA', 11, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(145, 145, 245, '102419395', '102419395', 'GHIATS ABDURAHMAN RASYID', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(146, 146, 246, '102419397', '102419397', 'HASNA SALSABILA', 11, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(147, 147, 247, '102419398', '102419398', 'HILMAN AMINUDIN', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(148, 148, 248, '102419399', '102419399', 'MARSYA RAIHANA FAZILA', 11, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(149, 149, 249, '102419400', '102419400', 'MUHAMAD AFGHAN PUTRA CAHYADI', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(150, 150, 250, '102419401', '102419401', 'MUHAMMAD DAFA RAMDHANI', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(151, 151, 251, '102419402', '102419402', 'MUHAMMAD DZAKWAN HAFIZH FADHILAH', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(152, 152, 252, '102419403', '102419403', 'MUHAMMAD GHOZI IDZHARUDIN', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(153, 153, 253, '102419404', '102419404', 'MUHAMMAD IKRAM RABBANI', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(154, 154, 254, '102419405', '102419405', 'MUHAMMAD LUTHFI ALGHIFARI', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(155, 155, 255, '102419406', '102419406', 'MUHAMMAD RAHLY HAIKAL FABIAN', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(156, 156, 256, '102419407', '102419407', 'MUHAMMAD RANGGA NUGRAHA', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(157, 157, 257, '102419408', '102419408', 'MUHAMMAD ZAIDAN AL-FATHIR', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(158, 158, 258, '102419409', '102419409', 'NABILA YUSTIKA AZZAHRA', 11, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(159, 159, 259, '102419410', '102419410', 'NADIRA PUTERI AULIA', 11, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(160, 160, 260, '102419412', '102419412', 'RANGGA', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(161, 161, 261, '102419413', '102419413', 'RESTU NOOR ADITIA RAE', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(162, 162, 262, '102419414', '102419414', 'RIZKI AULIA LINGGA', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(163, 163, 263, '102419415', '102419415', 'SACHIO FADIL TAUFIK', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(164, 164, 264, '102419416', '102419416', 'SAKINAH QUINNVASHA DARYANTO', 11, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(165, 165, 265, '102419417', '102419417', 'SATRIO FAWWAS FEBRIHARSONO', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(166, 166, 266, '102419418', '102419418', 'SATYA PAMBUDI', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(167, 167, 267, '102419419', '102419419', 'TUBAGUS RESTU BUDHI PRATAMA', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(168, 168, 268, '102419420', '102419420', 'YUDA INDRA MAULIDA', 11, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(169, 169, 269, '102318955', '102318955', 'ABIYU AFLAH', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(170, 170, 270, '102318956', '102318956', 'ADITYA SETIAWAN', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(171, 171, 271, '102318958', '102318958', 'ALISHA RUSMANA', 12, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(172, 172, 272, '102318959', '102318959', 'ANDITA ALIFIAH', 12, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(173, 173, 273, '102318960', '102318960', 'ARDIVAN NUR RAIHAN RAHMAN', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(174, 174, 274, '102318961', '102318961', 'ARSYA MAULANA FADILLAH', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(175, 175, 275, '102318962', '102318962', 'DEBIAN BUDI PANGARTI', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(176, 176, 276, '102318963', '102318963', 'FAJARRAHMAN AZHAR PUTRA', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(177, 177, 277, '102318964', '102318964', 'GHANIFRA SOBIA BASEL', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(178, 178, 278, '102318965', '102318965', 'HASNA ABIGAEL BELVA PRAMUDI', 12, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(179, 179, 279, '102318966', '102318966', 'HUDA SAPUTRA', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(180, 180, 280, '102318967', '102318967', 'ICA UTAMI EKA PUTRI', 12, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(181, 181, 281, '102318968', '102318968', 'IRSYAD MAULANA', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(182, 182, 282, '102318969', '102318969', 'IZZAN RAMADHAN', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(183, 183, 283, '102318970', '102318970', 'KAILA IBRAHIM HAKIM', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(184, 184, 284, '102318971', '102318971', 'KENNEZH NAZHILLA RAMADHANI PUTRI ARKHA', 12, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(185, 185, 285, '102318972', '102318972', 'KHUMAIRA AZZAHRA DENTA NURTIAS', 12, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(186, 186, 286, '102318973', '102318973', 'MELINDA PUTRI ELIANDI', 12, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(187, 187, 287, '102318974', '102318974', 'MUHAMAD BALYAN RAMADANI', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(188, 188, 288, '102318975', '102318975', 'MUHAMMAD ALIEF FADILAH', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(189, 189, 289, '102318977', '102318977', 'MUHAMMAD KEISYA FADILAH', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(190, 190, 290, '102318978', '102318978', 'NAUFAL FADIYAH IDRUS', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(191, 191, 291, '102318979', '102318979', 'NUR ALIF ABDILAH', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(192, 192, 292, '102318980', '102318980', 'PUTRA ADITYA PRATAMA', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(193, 193, 293, '102318981', '102318981', 'RAIFA JULIANA', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(194, 194, 294, '102318982', '102318982', 'RAIHAN ARIANSYAH', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(195, 195, 295, '102318983', '102318983', 'RAZZAN ILMAN ANWAR', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(196, 196, 296, '102318984', '102318984', 'RENATA MAHARANI REGITA SOMANTRI', 12, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(197, 197, 297, '102318985', '102318985', 'RIDHO AZRIA SAFARAN', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(198, 198, 298, '102318986', '102318986', 'SABIL KHALIFA TUL UMMAH', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(199, 199, 299, '102318987', '102318987', 'SYIFA NURAINI', 12, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(200, 200, 300, '102318988', '102318988', 'VELIA FITRI LARASATI', 12, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(201, 201, 301, '102318989', '102318989', 'YUSUF INDRA WIJAYA', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(202, 202, 302, '102318990', '102318990', 'ZAIDAN FAARIS ABIDI', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(203, 203, 303, '102318991', '102318991', 'ZOHAN PRAMADHANI', 12, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(204, 204, 304, '102318992', '102318992', 'ADIT RAHMAT HIDAYAT', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(205, 205, 305, '102318993', '102318993', 'ADLY FEBRYAN', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(206, 206, 306, '102318994', '102318994', 'ALYA MUTIA ZAHRA', 13, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(207, 207, 307, '102318995', '102318995', 'BAGUS SETIAWAN', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(208, 208, 308, '102318996', '102318996', 'DAFFA GHALIB NUR FAUZAN', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(209, 209, 309, '102318997', '102318997', 'DESTIA DWI ANGGRAENI', 13, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(210, 210, 310, '102318998', '102318998', 'DIAZ MUHAMAD ARKAAN SYAHTIAN', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(211, 211, 311, '102318999', '102318999', 'DZAKWAN NAHAREZKA PASHA', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(212, 212, 312, '102319000', '102319000', 'FA\'IQ HALUL DANENDRA', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(213, 213, 313, '102319001', '102319001', 'FAIZA RAHMAN GHANI', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(214, 214, 314, '102319002', '102319002', 'FITRIA RAMADANI', 13, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(215, 215, 315, '102319003', '102319003', 'KHANSA KHAIRUNNISA', 13, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(216, 216, 316, '102319004', '102319004', 'MARITZA RIEVANI WIBOWO', 13, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(217, 217, 317, '102319005', '102319005', 'MESSI ANASTASYA', 13, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(218, 218, 318, '102319006', '102319006', 'MIZWAR ADIARSA', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(219, 219, 319, '102319007', '102319007', 'MOCHAMAD DENDRA DWI PRATAMA PUTRA', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(220, 220, 320, '102319008', '102319008', 'MUHAMAD FARHAN FADILAH', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(221, 221, 321, '102319009', '102319009', 'MUHAMAD FIRDAUS AL GHAJALI', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(222, 222, 322, '102319010', '102319010', 'MUHAMMAD BILLAL NURFILDAN', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(223, 223, 323, '102319011', '102319011', 'MUHAMMAD ILHAM HIZAM', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(224, 224, 324, '102319012', '102319012', 'MUHAMMAD NASYWAN MUBAROK', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(225, 225, 325, '102319013', '102319013', 'NANDA AHMAD NURSHIDIQ', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(226, 226, 326, '102319014', '102319014', 'NAYLA AZKA FATIMA SOEHAYA', 13, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(227, 227, 327, '102319015', '102319015', 'NAZWA AZZAHRA', 13, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(228, 228, 328, '102319016', '102319016', 'RAIHAN FADHLURRASYAD', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(229, 229, 329, '102319017', '102319017', 'RAKHA PUTRA RIDWAN', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(230, 230, 330, '102319019', '102319019', 'REYKISHA RYTZKAYLA RIZALIA', 13, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(231, 231, 331, '102319020', '102319020', 'REYSA ANGGRAENI', 13, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(232, 232, 332, '102319021', '102319021', 'RIVAL KHOLQI FAJDUANI', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(233, 233, 333, '102319022', '102319022', 'SALSABILA APRILIANI SUBARNI', 13, 'Siswa', 'P', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(234, 234, 334, '102319024', '102319024', 'SELBINURIF ALFAKA', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(235, 235, 335, '102319025', '102319025', 'SETIAWAN DWI FEBRIANTO', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52'),
(236, 236, 336, '102319026', '102319026', 'VEREL KEEFI ALIE', 13, 'Siswa', 'L', NULL, NULL, NULL, NULL, 'aktif', '2025-11-23 08:00:52', '2025-11-23 08:00:52');

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
(100, 'otong.nugraha', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Drs. Otong Nugraha, M.Si', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(101, 'oman.somana', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Oman Somana, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(102, 'dadan.rukma', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Dadan Rukma Dian Dawan, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(103, 'popong.wariati', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Popong Wariati, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(104, 'ujang.suhara', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Ujang Suhara, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(105, 'mimy.ardiany', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Dra. Mimy Ardiany, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(106, 'sarinah.ginting', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Sarinah Br Ginting, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(107, 'taufik.hidayat', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Taufik Hidayat, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(108, 'rita.hartati', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Rita Hartati, S.Pd, M.T', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(109, 'ade.hartono', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Ade Hartono, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(110, 'tita.heriyanti', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Tita Heriyanti, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(111, 'weni.asmaraeni', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Dra. WENI ASMARAENI', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(112, 'octavina.sopamena', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Octavina Sopamena, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(113, 'lia.yulianti', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Lia Yulianti, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(114, 'santika', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Santika, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(115, 'rina.daryani', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Rina Daryani, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(116, 'rahmi.dalilah', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Dra. Rahmi Dalilah Fitrianni', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(117, 'syafitri.kurniati', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Syafitri Kurniati Arief, S.Pd, M.T', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(118, 'adiwiguna', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Adiwiguna, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(119, 'rani.rabiussani', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Rani Rabiussani, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(120, 'sudarmi', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Dr. Sudarmi, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(121, 'iah.robiah', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Iah Robiah, S.Pd. Kim.', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(122, 'maspuri.andewi', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Maspuri Andewi, S.Kom', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(123, 'ruhya', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Ruhya, S.Ag, M.M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(124, 'maya.kusmayanti', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Maya Kusmayanti, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(125, 'dini.karomna', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Dini Karomna, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(126, 'nofa.nirawati', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Nofa Nirawati, S.Pd, M.T', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(127, 'hasan.asari', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Hasan As\'ari, M.Kom', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(128, 'cecep.suryana', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Cecep Suryana, S.Si', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(129, 'nina.dewi', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Nina Dewi Koswara, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(130, 'ina.marina', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Ina Marina, S.T', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(131, 'danty', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Danty, S.Pd.', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(132, 'sugiyatmi', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Sugiyatmi, S.Si', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(133, 'uli.solihat', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Uli Solihat Kamaluddin, S.Si, Gr', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(134, 'atep.aulia', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Atep Aulia Rahman, S.T. M.Kom', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(135, 'endang.sunan', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Endang Sunandar, S.Pd., M.Pkim', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(136, 'hazar.nurbani', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Hazar Nurbani, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(137, 'tini.rosmayani', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Tini Rosmayani, S.Si', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(138, 'priyo.hadisuryo', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Priyo Hadisuryo, S.St', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(139, 'nogi.muharam', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Nogi Muharam, S.Kom.', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(140, 'eva.zulva', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Eva Zulva, S.Kom,i', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(141, 'neneng.suhartini', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Neneng Suhartini, S.Si, S.Pd. Gr', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(142, 'halida.farhani', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Halida Farhani, S.Psi', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(143, 'nur.fauziyah', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Nur Fauziyah Rahmawati, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(144, 'muchamad.harry', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Muchamad Harry Ismail, S.T.R.Kom, M.M', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(145, 'windawati.aisah', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Windawati Aisah, S.Si, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(146, 'ermawati', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Dr. Ermawati, M.Kom', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(147, 'kiki.aima', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Kiki Aima Mu\'mina, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(148, 'nadia.afriliani', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Nadia Afriliani, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(149, 'jaya.sumpena', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Jaya Sumpena, M. Kom', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(150, 'regina.fitrie', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Regina Fitrie, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(151, 'ariantonius.sagala', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Ariantonius Sagala, S.Kom', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(152, 'pratiwi', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Pratiwi, S.S.I', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(153, 'nurul.diningsih', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Nurul Diningsih, S.Hum', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(154, 'dedi.efendi', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Dedi Efendi, S.Kom', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(155, 'eti.arisanti', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Eti Arisanti, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(156, 'nurlaela', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Nurlaela, Sh', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(157, 'yeni.meilina', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Yeni Meilina, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(158, 'rukmana', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Rukmana, S.Pd.I', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(159, 'rini.dwiwahyuni', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Rini Dwiwahyuni, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(160, 'desta.mulyanti', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Desta Mulyanti, S.Sn', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(161, 'meli.novita', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Meli Novita, M.M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(162, 'tessa.eka', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Tessa Eka Yuniar, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(163, 'ela.nurlaela', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Ela Nurlaela, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(164, 'shendy.antariksa', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Shendy Antariksa, S.Hum', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(165, 'apriliani.hardiyanti', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Apriliani Hardiyanti Hariyono, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(166, 'sukmawidi', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Sukmawidi, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(167, 'fertika', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Fertika, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(168, 'indira.sari', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Indira Sari Paputungan, M.Ed. Gr', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(169, 'tubagus.saputra', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Tubagus Saputra, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(170, 'anggita.septiani', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Anggita Septiani, S.T.P, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(171, 'gina.urfah', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Gina Urfah Mastur Sadili, S.Pd.', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(172, 'annisa.intikarusdiansari', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Annisa Intikarusdiansari, S.Pd.', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(173, 'odang.supriatna', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Odang Supriatna, S.E.', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(174, 'samsudin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Samsudin, S.Ag', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(175, 'kania.dewi', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Kania Dewi Waluya, S.S.T', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(176, 'sabila.fauziyya', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Sabila Fauziyya,S.Kom', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(177, 'dena.handriana', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Dena Handriana, M.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(178, 'windy.novia', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Windy Novia Anggraeni, S.Si', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(179, 'ar.fauzan', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'A.R Fauzan, S.Ip. M.M', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(180, 'heni.juhaeni', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Heni Juhaeni, S.Pd', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(181, 'riska.fitriyanti', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Riska Fitriyanti, A.Md', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(182, 'indra.adiguna', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guru', 'Indra Adiguna, ST', NULL, 'aktif', '2025-11-23 07:19:18', '2025-11-23 07:19:18'),
(200, '102419349', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ADELYA FAUZI ALFIAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(201, '102419350', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ADLY SYAKIEB HAFIDZ GUSTIRA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(202, '102419351', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ALFIZAR SAFIY HAMIZAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(203, '102419352', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ALIF YUSUF ANWAR', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(204, '102419353', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ALYA ALMIRA PUTRI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(205, '102419354', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ANNISA AGHNIYA FAZA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(206, '102419355', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ARBIANSYAH AKBAR', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(207, '102419356', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'AYYAS HUSAYN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(208, '102419357', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'BINTANG PUTRA RASYA DIKA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(209, '102419358', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'DAFFA DERYAN RASHIF', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(210, '102419359', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'DANIS FERDIANSYAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(211, '102419360', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'DEAN SULTAN SADYA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(212, '102419361', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'DZIKRY FARERA LENGGANA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(213, '102419362', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'FARREL MUTTAQIN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(214, '102419363', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'FREGA TEGUH DWIGUNA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(215, '102419364', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'HANIF YANWAR WAHIDAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(216, '102419365', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'IMEITA NATASHA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(217, '102419366', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'IRHAM HADI AHSANU', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(218, '102419367', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'KAISA VIDYA AMATULLAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(219, '102419368', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'KAKA ANDREA YAHYA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(220, '102419369', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MARVA AULIA AHMAD', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(221, '102419370', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD RAFFA HARVANI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(222, '102419371', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD WILDAN TAUFIK', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(223, '102419372', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'NABIL AKBAR FADHILLAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(224, '102419374', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'NAUFAL RAUSYAN FIKRI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(225, '102419375', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'NESYA MEGA PUTRI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(226, '102419376', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'PUTRI JASMINE AZZAHRA RAMADHANI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(227, '102419377', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RAFADITYA SYAHPUTRA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(228, '102419378', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RAIKHANIA RIZKY PUTRI HERDIANA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(229, '102419379', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'REFKY FAVIAN MAHARDIKA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(230, '102419380', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RIZKY FAUZI RAHMAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(231, '102419381', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'SASHYKIRANA ANANDITA SAHRONI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(232, '102419382', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'SITUMORANG, GABRIELDO', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(233, '102419383', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'TIFAYATUL HUSNA AZAHRA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(234, '102419384', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'YUGA PUTRA NUGRAHA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(235, '102419385', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'Raihan Ariansyah', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-24 04:24:31'),
(236, '102419386', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'AISYAH AGUSTINA RIYANTI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(237, '102419387', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ALDI FAIZAL', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(238, '102419388', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ANDRI YUDIANSAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(239, '102419389', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ARKANANTA WISALA ESHA\'AL', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(240, '102419390', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'AUFA FADILAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(241, '102419391', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'BHAGAS ALAM SASTRO MIHARJO', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(242, '102419392', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'CINDY STEVANI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(243, '102419393', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'FAKHRIZA AHMAD DARAJAT', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(244, '102419394', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'FARIDA DIANA NABILLA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(245, '102419395', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'GHIATS ABDURAHMAN RASYID', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(246, '102419397', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'HASNA SALSABILA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(247, '102419398', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'HILMAN AMINUDIN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(248, '102419399', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MARSYA RAIHANA FAZILA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(249, '102419400', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMAD AFGHAN PUTRA CAHYADI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(250, '102419401', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD DAFA RAMDHANI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(251, '102419402', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD DZAKWAN HAFIZH FADHILAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(252, '102419403', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD GHOZI IDZHARUDIN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(253, '102419404', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD IKRAM RABBANI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(254, '102419405', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD LUTHFI ALGHIFARI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(255, '102419406', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD RAHLY HAIKAL FABIAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(256, '102419407', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD RANGGA NUGRAHA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(257, '102419408', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD ZAIDAN AL-FATHIR', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(258, '102419409', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'NABILA YUSTIKA AZZAHRA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(259, '102419410', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'NADIRA PUTERI AULIA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(260, '102419412', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RANGGA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(261, '102419413', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RESTU NOOR ADITIA RAE', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(262, '102419414', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RIZKI AULIA LINGGA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(263, '102419415', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'SACHIO FADIL TAUFIK', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(264, '102419416', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'SAKINAH QUINNVASHA DARYANTO', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(265, '102419417', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'SATRIO FAWWAS FEBRIHARSONO', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(266, '102419418', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'SATYA PAMBUDI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(267, '102419419', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'TUBAGUS RESTU BUDHI PRATAMA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(268, '102419420', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'YUDA INDRA MAULIDA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(269, '102318955', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ABIYU AFLAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(270, '102318956', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ADITYA SETIAWAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(271, '102318958', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ALISHA RUSMANA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(272, '102318959', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ANDITA ALIFIAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(273, '102318960', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ARDIVAN NUR RAIHAN RAHMAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(274, '102318961', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ARSYA MAULANA FADILLAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(275, '102318962', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'DEBIAN BUDI PANGARTI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(276, '102318963', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'FAJARRAHMAN AZHAR PUTRA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(277, '102318964', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'GHANIFRA SOBIA BASEL', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(278, '102318965', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'HASNA ABIGAEL BELVA PRAMUDI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(279, '102318966', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'HUDA SAPUTRA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(280, '102318967', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ICA UTAMI EKA PUTRI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(281, '102318968', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'IRSYAD MAULANA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(282, '102318969', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'IZZAN RAMADHAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(283, '102318970', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'KAILA IBRAHIM HAKIM', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(284, '102318971', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'KENNEZH NAZHILLA RAMADHANI PUTRI ARKHA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(285, '102318972', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'KHUMAIRA AZZAHRA DENTA NURTIAS', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(286, '102318973', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MELINDA PUTRI ELIANDI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(287, '102318974', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMAD BALYAN RAMADANI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(288, '102318975', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD ALIEF FADILAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(289, '102318977', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD KEISYA FADILAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(290, '102318978', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'NAUFAL FADIYAH IDRUS', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(291, '102318979', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'NUR ALIF ABDILAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(292, '102318980', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'PUTRA ADITYA PRATAMA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(293, '102318981', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RAIFA JULIANA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(294, '102318982', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RAIHAN ARIANSYAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(295, '102318983', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RAZZAN ILMAN ANWAR', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(296, '102318984', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RENATA MAHARANI REGITA SOMANTRI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(297, '102318985', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RIDHO AZRIA SAFARAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(298, '102318986', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'SABIL KHALIFA TUL UMMAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(299, '102318987', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'SYIFA NURAINI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(300, '102318988', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'VELIA FITRI LARASATI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(301, '102318989', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'YUSUF INDRA WIJAYA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(302, '102318990', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ZAIDAN FAARIS ABIDI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(303, '102318991', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ZOHAN PRAMADHANI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(304, '102318992', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ADIT RAHMAT HIDAYAT', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(305, '102318993', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ADLY FEBRYAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(306, '102318994', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'ALYA MUTIA ZAHRA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(307, '102318995', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'BAGUS SETIAWAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(308, '102318996', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'DAFFA GHALIB NUR FAUZAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(309, '102318997', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'DESTIA DWI ANGGRAENI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(310, '102318998', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'DIAZ MUHAMAD ARKAAN SYAHTIAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(311, '102318999', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'DZAKWAN NAHAREZKA PASHA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(312, '102319000', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'FA\'IQ HALUL DANENDRA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(313, '102319001', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'FAIZA RAHMAN GHANI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(314, '102319002', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'FITRIA RAMADANI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(315, '102319003', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'KHANSA KHAIRUNNISA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(316, '102319004', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MARITZA RIEVANI WIBOWO', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(317, '102319005', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MESSI ANASTASYA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(318, '102319006', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MIZWAR ADIARSA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(319, '102319007', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MOCHAMAD DENDRA DWI PRATAMA PUTRA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(320, '102319008', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMAD FARHAN FADILAH', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(321, '102319009', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMAD FIRDAUS AL GHAJALI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(322, '102319010', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD BILLAL NURFILDAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(323, '102319011', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD ILHAM HIZAM', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(324, '102319012', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'MUHAMMAD NASYWAN MUBAROK', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(325, '102319013', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'NANDA AHMAD NURSHIDIQ', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(326, '102319014', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'NAYLA AZKA FATIMA SOEHAYA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(327, '102319015', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'NAZWA AZZAHRA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(328, '102319016', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RAIHAN FADHLURRASYAD', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(329, '102319017', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RAKHA PUTRA RIDWAN', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(330, '102319019', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'REYKISHA RYTZKAYLA RIZALIA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(331, '102319020', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'REYSA ANGGRAENI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(332, '102319021', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'RIVAL KHOLQI FAJDUANI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(333, '102319022', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'SALSABILA APRILIANI SUBARNI', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(334, '102319024', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'SELBINURIF ALFAKA', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(335, '102319025', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'SETIAWAN DWI FEBRIANTO', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28'),
(336, '102319026', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'siswa', 'VEREL KEEFI ALIE', NULL, 'aktif', '2025-11-23 08:00:28', '2025-11-23 08:00:28');

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
  MODIFY `id_absensi` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `absensi_guru_archive`
--
ALTER TABLE `absensi_guru_archive`
  MODIFY `id_absensi` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `absensi_siswa`
--
ALTER TABLE `absensi_siswa`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `absensi_siswa_archive`
--
ALTER TABLE `absensi_siswa_archive`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `guru`
--
ALTER TABLE `guru`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=183;

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
  MODIFY `id_kelas` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT untuk tabel `kop_laporan`
--
ALTER TABLE `kop_laporan`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=237;

--
-- AUTO_INCREMENT untuk tabel `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=337;

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
