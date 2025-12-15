---
trigger: always_on
---

# absenta13-guidelines.md — Development, Business Rules, & Export Specs

Dokumen ini adalah aturan main untuk pengembangan **ABSENTA 13 (v3)**. Fokusnya: konsistensi, keamanan, dan output laporan yang “serasa buatan TU”, bukan “serasa buatan AI”.

---

## 0) Prinsip Utama

- Jangan bikin fitur baru yang “bagus sendiri” tapi merusak format data/ekspor yang sudah dipakai sekolah.
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

Aturan mapping untuk laporan “ketidakhadiran”:
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
- Jangan “rebuild Excel dari nol” kalau tidak terpaksa.
- Pakai metode template:
  - simpan file `.xlsx` sebagai template
  - load -> isi data -> simpan output
- Kalau ada rumus di template, jangan diganti jadi angka statis kecuali diminta.

Rekomendasi library Node:
- ExcelJS (simple + cukup stabil untuk template-based)

---

## 6) Template Excel yang Jadi Standar

Gunakan template yang kamu sudah punya (file contoh dari sekolah) sebagai “golden template”. Nama folder yang disarankan:

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

Struktur (per sheet kelas, contoh: “XII RPL 1”):
- Header (jangan diubah strukturnya):
  - A1: label singkat jurusan/rombel (contoh: “RPL 1” / “KA 1”)
  - A2: “SMK NEGERI 13 BANDUNG”
  - A3: “TAHUN PELAJARAN 2025-2026”
  - A5: “KELAS”
  - C5: “: {NAMA_KELAS}”
  - A6: “NAMA WALI KELAS”
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
  - A1: “REKAP KETIDAKHADIRAN GURU”
  - A2: “SMK NEGERI 13 BANDUNG”
  - A3: “TAHUN PELAJARAN 2025-2026”
- Row 7: “JUMLAH HARI EFEKTIF” per bulan (Juli–Juni)
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
- Pastikan format angka P/Q mengikuti template (0.00) dan tampilan jadi “0,00” di Excel lokal.

---

## 9) Spesifikasi Export: Jadwal (Opsional, Kalau Mau 1:1 Template)

Template: `JADWAL PELAJARAN 2025-2026 (REVISI 2).xlsx`

Strategi paling waras:
- Isi hanya sheet “JADWAL”
- Biarkan sheet lain (JAM GURU, MASTER GURU HARIAN) tetap pakai rumus internal template

Karena:
- Warna, merge, dan layout “JADWAL” itu ribet kalau dibangun dari nol.
- Template sudah punya rumus untuk rekap guru per jam/hari.

---

## 10) Checklist QA Output Export (Wajib)

Setiap export harus lulus checklist ini:

- Format/Style
  - Merge cell di header tetap (tidak pecah)
  - Kolom “JML” tetap kuning (di rekap kelas)
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
