# absenta13-guidelines.md — Development, Business Rules, & Export Specs

Dokumen ini adalah aturan main untuk pengembangan **ABSENTA 13 (v3)**. Fokusnya: konsistensi, keamanan, dan output laporan yang "serasa buatan TU", bukan "serasa buatan AI".

---

## 0) Prinsip Utama

- Jangan bikin fitur baru yang "bagus sendiri" tapi merusak format data/ekspor yang sudah dipakai sekolah.
- Kalau ada konflik antara:
  - Template Excel yang dipakai sekolah vs ide baru developer
  - Maka: template sekolah menang.
- Semua angka/format yang dipakai laporan harus bisa dijelaskan ke guru/TU (transparan).

---

## 1) Batasan & Peran Pengguna

Peran minimum:
- Admin/TU
  - CRUD master (siswa, guru, kelas, jadwal), rekap & export, kop surat, periode aktif
- Guru / Piket / Wali Kelas
  - monitoring, validasi banding, input izin/sakit (dengan bukti)
- Siswa
  - check-in, lihat status, ajukan banding

---

## 2) Status Kehadiran: Kode & Makna

Kode yang disimpan di DB (wajib konsisten):
- H — Hadir
- T — Terlambat
- I — Izin
- S — Sakit
- A — Alpha

Aturan mapping untuk laporan "ketidakhadiran":
- Rekap ketidakhadiran hanya menghitung: S, I, A
- H dan T tidak masuk ketidakhadiran

---

## 3) Aturan Jam Masuk (Default)

Default:
- Jam masuk: 07:00 WIB
- Toleransi: 15 menit
  - 07:00–07:15 -> H
  - >07:15 -> T

Catatan:
- Jangan hardcode permanen. Buat configurable di settings (mis. `custom-schedules.json` / tabel DB).

---

## 4) Struktur Kelas & Jurusan

- Ikuti file `informasisekolah13.md` sebagai rujukan identitas sekolah, nama jurusan, format kelas, dan kop surat.

---

## 5) Export Excel: Filosofi Implementasi (Penting)

Target: hasil export harus mirip 1:1 dengan file template sekolah (warna, merge, border, rumus, print layout).

Aturan keras:
- Jangan "rebuild Excel dari nol" kalau tidak terpaksa.
- Pakai metode template:
  - simpan file `.xlsx` sebagai template
  - load -> isi data -> simpan output
- Kalau ada rumus di template, jangan diganti jadi angka statis kecuali diminta.

Rekomendasi library Node:
- ExcelJS (simple + cukup stabil untuk template-based)

---

## 6) Template Excel yang Jadi Standar

Gunakan template yang kamu sudah punya (file contoh dari sekolah) sebagai "golden template". Nama folder yang disarankan:

- `/server/templates/excel/`
  - `PRESENSI SISWA 2025-2026 edit1.xlsx`
  - `REKAP KETIDAKHADIRAN KELAS X 2025-2026.xlsx`
  - `REKAP KETIDAKHADIRAN KELAS XI 2025-2026.xlsx`
  - `REKAP KETIDAKHADIRAN KELAS XII 2025-2026.xlsx`
  - `REKAP KETIDAKHADIRAN KELAS XIII 2025-2026.xlsx`
  - `REKAP KETIDAKHADIRAN GURU 2025-2026.xlsx`
  - `JADWAL PELAJARAN 2025-2026 (REVISI 2).xlsx` (opsional kalau mau export jadwal)

---

## 7) Spesifikasi Export: Rekap Ketidakhadiran Kelas (Semester Gasal)

Template: `REKAP KETIDAKHADIRAN KELAS {X|XI|XII|XIII} 2025-2026.xlsx`

Struktur (per sheet kelas, contoh: "XII RPL 1"):
- Header (jangan diubah strukturnya):
  - A1: label singkat jurusan/rombel (contoh: "RPL 1" / "KA 1")
  - A2: "SMK NEGERI 13 BANDUNG"
  - A3: "TAHUN PELAJARAN 2025-2026"
  - A5: "KELAS"
  - C5: ": {NAMA_KELAS}"
  - A6: "NAMA WALI KELAS"
  - D6: isi nama wali kelas dari DB/settings (dynamic)

Tabel data mulai:
- Start row data: 11
- Kolom identitas:
  - A: NO.
  - B: NIS/NISN (string, format bebas tapi konsisten)
  - C: NAMA PESERTA DIDIK
  - D: L/P

Kolom ketidakhadiran per bulan (Gasal = Juli s/d Desember):
- JULI
  - E: S
  - F: I
  - G: A
  - H: JML (rumus, biasanya =SUM(E:F:G))
- AGUSTUS
  - I: S
  - J: I
  - K: A
  - L: JML
- SEPTEMBER
  - M: S
  - N: I
  - O: A
  - P: JML
- OKTOBER
  - Q: S
  - R: I
  - S: A
  - T: JML
- NOVEMBER
  - U: S
  - V: I
  - W: A
  - X: JML
- DESEMBER
  - Y: S
  - Z: I
  - AA: A
  - AB: JML

Rekap total:
- AC: total S
- AD: total I
- AE: total A
- AF: JUMLAH TOTAL (AC+AD+AE)
- AG: JUMLAH TIDAK HADIR (%) = (AF / TOTAL_HARI_EFEKTIF) * 100
- AH: JUMLAH PROSENTASE HADIR (%) = 100 - AG

Catatan template:
- Di template sekarang, `TOTAL_HARI_EFEKTIF` gasal = 95 (dipakai sebagai pembagi).
  - Idealnya jadikan configurable via settings, tapi output harus tetap sama.

Aturan pengisian:
- Jangan overwrite cell yang berisi rumus (H, L, P, T, X, AB, AC-AH biasanya sudah punya rumus).
- Isi hanya cell input: A, B, C, D, dan cell S/I/A per bulan.
- Kalau data kosong, isi 0 (bukan null), supaya rumus jalan.

---

## 8) Spesifikasi Export: Rekap Ketidakhadiran Guru (Tahunan)

Template: `REKAP KETIDAKHADIRAN GURU 2025-2026.xlsx`

Struktur:
- Header:
  - A1: "REKAP KETIDAKHADIRAN GURU"
  - A2: "SMK NEGERI 13 BANDUNG"
  - A3: "TAHUN PELAJARAN 2025-2026"
- Row 7: "JUMLAH HARI EFEKTIF" per bulan (Juli–Juni)
- Data mulai row 8:
  - A: NO.
  - B: NAMA GURU
  - C-N: JULI..JUNI (angka ketidakhadiran per bulan)
  - O: JUMLAH (SUM(C:N))
  - P: JUMLAH TIDAK HADIR (%) = (O / TOTAL_HARI_EFEKTIF_TAHUNAN) * 100
  - Q: JUMLAH PROSENTASE HADIR (%) = 100 - P

Catatan template:
- TOTAL_HARI_EFEKTIF_TAHUNAN sekarang 237 (dihardcode di rumus).
- Kalau tahun pelajaran baru -> pembagi harus bisa berubah (pakai settings).
  - Cara gampang:
    - update semua rumus di kolom P/Q saat export (replace 237 -> totalHariAktif)

Aturan pengisian:
- Utamakan template list guru (biar format konsisten).
- Jika daftar guru di DB lebih panjang:
  - tambah row baru dengan clone style row contoh (row 8).
- Pastikan format angka P/Q mengikuti template (0.00) dan tampilan jadi "0,00" di Excel lokal.

---

## 9) Spesifikasi Export: Jadwal (Opsional, Kalau Mau 1:1 Template)

Template: `JADWAL PELAJARAN 2025-2026 (REVISI 2).xlsx`

Strategi paling waras:
- Isi hanya sheet "JADWAL"
- Biarkan sheet lain (JAM GURU, MASTER GURU HARIAN) tetap pakai rumus internal template

Karena:
- Warna, merge, dan layout "JADWAL" itu ribet kalau dibangun dari nol.
- Template sudah punya rumus untuk rekap guru per jam/hari.

---

## 10) Checklist QA Output Export (Wajib)

Setiap export harus lulus checklist ini:

- Format/Style
  - Merge cell di header tetap (tidak pecah)
  - Kolom "JML" tetap kuning (di rekap kelas)
  - Border tabel tetap
  - Header sekolah tetap

- Data/Logika
  - Total per bulan (JML) benar
  - Total S/I/A benar
  - Persentase tidak hadir/hadir sesuai pembagi (95 gasal / 237 tahunan) dan tampil 0,00 / 100,00

- Konsistensi
  - Nama kelas sesuai format (X..XIII + KA/TKJ/RPL + nomor)
  - Nama sekolah dan alamat tidak salah provinsi

---

## 11) Prompt Siap Pakai untuk AI Agent (Copy-Paste)

Tugas kamu:
1) Implement fitur export Excel berbasis template untuk ABSENTA 13.
2) Output harus match file template sekolah (merge, warna, border, rumus).

Constraints:
- Jangan bikin workbook dari nol.
- Load template `.xlsx`, isi data ke cell input, simpan output.
- Jangan overwrite cell rumus.

Deliverables:
- Service `exportExcelService` (atau sejenis) yang menerima parameter:
  - type: `rekap_kelas_gasal` | `rekap_guru_tahunan` | (opsional) `jadwal`
  - tahunPelajaran, kelas, waliKelas, dataRows
- Unit test / smoke test yang cek minimal:
  - beberapa cell kunci (header, startRow, kolom JML kuning, rumus total/persen)
  - file bisa dibuka di Excel tanpa warning rusak

Data mapping:
- Rekap kelas gasal:
  - Start row 11, isi A-D + kolom S/I/A per bulan (E-G, I-K, M-O, Q-S, U-W, Y-AA)
- Rekap guru tahunan:
  - Start row 8, isi A-B + C-N

Output:
- Return sebagai buffer (download) + nama file yang jelas:
  - `REKAP_KETIDAKHADIRAN_{KELAS}_{TAHUN}_GASAL.xlsx`
  - `REKAP_KETIDAKHADIRAN_GURU_{TAHUN}.xlsx`

---

## 12) Deployment Workflow (Production Server)

### Prinsip Deployment

1. **Jangan langsung edit di server** — Semua perubahan melalui Git.
2. **Push dulu, pull kemudian** — Commit dan push ke GitHub, lalu pull di server.
3. **SELALU REBUILD setelah pull** — Perubahan kode backend butuh rebuild, bukan restart!

### ⚠️ ATURAN PENTING: Restart vs Rebuild

| Situasi | Command | Alasan |
|---------|---------|--------|
| Perubahan file `.js`, `.ts`, `.tsx` | `docker-compose up -d --build` | Kode di-copy ke image saat build |
| Perubahan `package.json` | `docker-compose down && docker-compose up -d --build` | Dependencies berubah |
| Perubahan `.env` saja | `docker-compose restart app` | Env dibaca saat runtime |
| Container crash/hang | `docker-compose restart app` | Quick fix tanpa rebuild |

**INGAT:** `docker-compose restart` TIDAK mengambil perubahan kode baru!

### Workflow Standard

```bash
# Di LOKAL (development):
git add -A
git commit -m "fix: deskripsi singkat"
git push origin main

# Di SERVER (production) - SELALU PAKAI INI:
cd /www/wwwroot/absenta13.my.id
git pull origin main
docker-compose up -d --build
```

### Checklist Deployment

- [ ] Semua file sudah di-commit (`git status` clean)
- [ ] Sudah di-push ke GitHub (`git push origin main`)
- [ ] Server sudah `git pull origin main`
- [ ] Container sudah di-rebuild (`docker-compose up -d --build`)
- [ ] Verifikasi di browser (login, dashboard, fitur utama)

### Debugging Production Issues

1. **Cek logs backend:**
   ```bash
   docker-compose logs --tail=200 app
   ```

2. **Cek status container:**
   ```bash
   docker-compose ps
   ```

3. **Restart jika stuck:**
   ```bash
   docker-compose restart app
   ```

4. **Full rebuild jika ada masalah dependencies:**
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

### Common Issues & Fixes

| Error | Penyebab | Solusi |
|-------|----------|--------|
| 502 Bad Gateway | Backend crash/not running | Cek logs, restart container |
| CORS Error | Origin tidak diizinkan | Tambahkan origin ke `allowedOrigins` di `server_modern.js` |
| 500 Internal Error | `global.dbPool` undefined | Pastikan `global.dbPool = dbOptimization.pool` |
| Monitoring 0/UNKNOWN | Global system vars undefined | Pastikan semua system di-assign ke `global.*` |

### Environment Variables (Production)

File `.env` di server harus berisi:
```env
NODE_ENV=production
DB_HOST=absenta13-mysql
DB_USER=root
DB_PASSWORD=<password>
DB_NAME=absenta13
DB_PORT=3306
JWT_SECRET=<secret>
PORT=3001
```

### Important Paths

- **Backend entry:** `server_modern.js`
- **Routes:** `server/routes/*.js`
- **Controllers:** `server/controllers/*.js`
- **System services:** `server/services/system/*.js`
- **Templates:** `server/templates/excel/*.xlsx`

---

## 13) Global Variables Reference

Backend menggunakan variabel global untuk sistem-sistem berikut:

```javascript
// Di initializeDatabase() - server_modern.js
global.dbPool = dbOptimization.pool;          // MySQL connection pool
global.dbOptimization = dbOptimization;       // Full class instance
global.queryOptimizer = queryOptimizer;
global.performanceOptimizer = performanceOptimizer;
global.backupSystem = backupSystem;
global.downloadQueue = downloadQueue;
global.cacheSystem = cacheSystem;
global.loadBalancer = loadBalancer;
global.systemMonitor = systemMonitor;
global.securitySystem = securitySystem;
global.disasterRecoverySystem = disasterRecoverySystem;
global.testAlerts = [];
```

**PENTING:** Jika controller menggunakan `global.xxx` tapi nilainya `undefined`, periksa apakah assignment di `initializeDatabase()` sudah benar.

---

## 14) Jam Pelajaran Dinamis per Kelas

Fitur untuk konfigurasi jam pelajaran (waktu mulai/selesai) per kelas.

### Database Table

```sql
CREATE TABLE jam_pelajaran (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kelas_id INT NOT NULL,
    jam_ke INT NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    keterangan VARCHAR(100) DEFAULT NULL,
    FOREIGN KEY (kelas_id) REFERENCES kelas(id_kelas) ON DELETE CASCADE
);
```

### API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/admin/jam-pelajaran` | Get all (grouped by kelas) |
| GET | `/api/admin/jam-pelajaran/:kelasId` | Get for specific class |
| POST | `/api/admin/jam-pelajaran/:kelasId` | Bulk upsert |
| POST | `/api/admin/jam-pelajaran/copy` | Copy to other classes |
| GET | `/api/admin/jam-pelajaran/default` | Get default template |
| DELETE | `/api/admin/jam-pelajaran/:kelasId` | Reset to default |

### Default Jam (10 periode)

| Jam | Mulai | Selesai | Keterangan |
|-----|-------|---------|------------|
| 1 | 07:00 | 07:45 | Pelajaran 1 |
| 2 | 07:45 | 08:30 | Pelajaran 2 |
| 3 | 08:30 | 09:15 | Pelajaran 3 |
| 4 | 09:15 | 10:00 | Pelajaran 4 |
| 5 | 10:15 | 11:00 | Pelajaran 5 |
| 6 | 11:00 | 11:45 | Pelajaran 6 |
| 7 | 12:30 | 13:15 | Pelajaran 7 |
| 8 | 13:15 | 14:00 | Pelajaran 8 |
| 9 | 14:00 | 14:45 | Pelajaran 9 |
| 10 | 14:45 | 15:30 | Pelajaran 10 |

### Frontend Component

- File: `src/components/JamPelajaranConfig.tsx`
- Access: `setActiveView('jam-pelajaran')` di AdminDashboard

---

## 15) Hari Efektif per Bulan (Guru)

Konstanta hari efektif untuk perhitungan % ketidakhadiran guru:

| Bulan | Hari Efektif |
|-------|-------------|
| Juli | 14 |
| Agustus | 21 |
| September | 22 |
| Oktober | 23 |
| November | 20 |
| Desember | 17 |
| Januari | 15 |
| Februari | 20 |
| Maret | 22 |
| April | 22 |
| Mei | 21 |
| Juni | 20 |
| **TOTAL** | **237** |

Catatan: Nilai ini dipakai di header export REKAP KETIDAKHADIRAN GURU.

