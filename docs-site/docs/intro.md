---
sidebar_position: 1
---

# Pengantar Absenta 13

Absenta 13 adalah sistem absensi sekolah berbasis web yang memisahkan frontend dan backend
untuk mendukung kinerja, skalabilitas, dan pemeliharaan jangka panjang. Dokumentasi ini
menjelaskan arsitektur, alur utama, dan panduan teknis untuk pengembang serta operator.

## Arsitektur Sistem

Komponen utama:

- Frontend: React + TypeScript + Vite.
- Backend: Node.js + Express.
- Database: MySQL.
- Cache dan queue: Redis.

Port default:

- Frontend: 5173
- Backend: 3001
- MySQL: 3306
- Redis: 6379

## Alur Login dan Role

1. Pengguna login melalui endpoint `POST /api/login`.
2. Backend mengirim token JWT dan session cookie.
3. Frontend memverifikasi token dengan `GET /api/verify-token`.
4. Role menentukan dashboard yang ditampilkan: admin, guru, atau siswa.

## Peran Pengguna

- Admin: mengelola master data, jadwal, jam pelajaran, ruang, laporan, monitoring, dan backup.
- Guru: melihat jadwal mengajar, input absensi siswa, memproses banding, dan membuat laporan.
- Siswa perwakilan: mengisi absensi guru, melihat riwayat kelas, dan mengajukan banding.

## Data Model Utama

Tabel penting yang sering digunakan:

- users, guru, siswa, kelas, mapel, ruang_kelas
- jadwal, jadwal_guru, jam_pelajaran
- absensi_siswa, absensi_guru, pengajuan_banding_absen
- kop_laporan, app_settings, guru_availability

## Alur Absensi

1. Jadwal dibentuk dari `jadwal` dan detail jam dari `jam_pelajaran`.
2. Guru mengisi absensi siswa pada jadwal yang aktif dan dapat diabsen.
3. Siswa perwakilan mengisi status kehadiran guru jika diperlukan.
4. Banding absen diajukan siswa dan diproses oleh guru.
5. Rekap dan laporan dihasilkan dari data absensi yang sudah tervalidasi.

## Laporan dan Export

Laporan menggunakan template Excel dan mendukung kop laporan:

- Template berada di `server/templates/excel/` dan schema ekspor di `backend/export/`.
- Konfigurasi kop laporan tersimpan di `kop_laporan` dan diatur melalui menu admin.
- Export dapat dipicu dari halaman laporan guru atau admin.

## Operasional Sistem

Fitur operasional utama:

- Backup dan archive data melalui menu admin.
- Monitoring metrik sistem, database, dan aplikasi.
- Rate limit, audit logging, dan validasi input di backend.

## Menjalankan Lokal

Prasyarat:

- Node.js v18+
- MySQL v8+
- Redis v6+

Langkah singkat:

```bash
npm install
```

Import database:

- Gunakan `database/absenta13.sql` melalui MySQL atau phpMyAdmin.

Jalankan Redis dan server:

```bash
redis\redis-server.exe
node server_modern.js
npm run dev
```

Atau jalankan bersamaan:

```bash
npm run dev:full
```

Akses:

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Environment Variables

Buat file `.env` di root proyek. Contoh konfigurasi minimum:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=absenta13
DB_PORT=3306
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3001
JWT_SECRET=minimum_32_characters_secret
```

Jika menambah env baru, update `.env.example` agar konsisten.
