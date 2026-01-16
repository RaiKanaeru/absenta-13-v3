---
trigger: always_on
---

# ABSENTA 13 (v3) - Development & Operational Guidelines
Nama file: absenta13-guidelines.md
Tujuan: aturan pengembangan, standar operasional, dan logika bisnis untuk sistem Absenta13.

Catatan validitas:
- Identitas sekolah wajib mengacu ke informasisekolah13.md.
- Aturan bisnis Absenta13 bersifat kebijakan internal dan bisa berubah.
- Dokumen ini tidak boleh membuat asumsi file/komponen ada; semua rujukan file wajib diverifikasi di repo.

Dokumen terkait:
- .agent/rules/informasisekolah13.md (identitas sekolah dan kop surat)
- .agent/rules/absenta13-guidelines2.md (spesifikasi export dan QA)
- .agent/workflows/absenta13-development.md (konvensi endpoint dan deploy)

----------------------------------------------------------------

1) Konteks Sistem
Absenta13 adalah sistem absensi akademik untuk lingkungan SMKN 13 Bandung.
Target pengguna:
- Siswa: absensi harian, melihat rekap
- Guru/Piket/Wali kelas: monitoring, validasi, banding
- Admin/TU: master data, laporan, ekspor, pengaturan

Prinsip:
- Konfigurasi > hardcode
- Auditability: semua aksi penting tercatat
- Data correctness lebih penting daripada UI cantik

----------------------------------------------------------------

2) Repo Rules (Wajib sebelum kerja)
Sebelum membuat perubahan apa pun:
- jalankan helper repo init jika ada; jika tidak ada, lanjutkan dengan pengecekan manual
- baca struktur yang sudah ada (controller, routes, utils, scripts)
- cari pola yang sudah dipakai sebelum menambah file baru

Aturan perubahan:
- Minim diff, maksimal dampak
- Hindari refactor besar kalau tidak diminta
- Hindari duplikasi utilitas (jangan bikin versi kedua dari helper yang sudah ada)

----------------------------------------------------------------

3) Tech Stack & Arsitektur (Kebijakan, tapi harus cocok repo)
Stack ini adalah target kebijakan. Implementasi final harus mengikuti realitas repo.

Backend:
- Node.js + Express
- Pattern: Controller - Service - Repository (atau pola yang setara di repo)
- DB: MySQL
- Cache/Session: Redis (jika dipakai di repo)
- Auth: JWT (atau mekanisme auth yang sudah ada)

Frontend:
- React + Vite (TypeScript bila sudah dipakai)
- Tailwind CSS + komponen UI sesuai yang sudah ada
- State: Context/Hooks (atau solusi yang sudah dipakai)

Ops:
- Docker + docker-compose jika repo sudah mendukung
- Nginx sebagai reverse proxy jika dipakai
- PM2 jika dipakai
- Backup DB otomatis wajib aktif di environment produksi

Aturan penting:
- Jika dokumen menyebut file spesifik (mis. middleware, optimizer), agent wajib memastikan file itu benar-benar ada di repo sebelum digunakan.

----------------------------------------------------------------

4) Standar API & Response
Semua endpoint harus konsisten format response.
Contoh format yang disarankan (ikuti yang sudah ada di repo):
- Sukses: { ok: true, data, meta? }
- Gagal: { ok: false, error: { code, message, details? } }

HTTP status:
- 200/201 sukses
- 400 validasi gagal
- 401 belum login
- 403 tidak punya akses
- 404 data tidak ditemukan
- 409 konflik (duplikasi)
- 500 error server

----------------------------------------------------------------

5) Aturan Bisnis Absensi (Harus Configurable)
A. Zona waktu
- Semua perhitungan waktu memakai Asia/Jakarta (WIB)

B. Jam masuk & toleransi
Default kebijakan (boleh berubah lewat config):
- jam masuk default: 07:00
- toleransi hadir: 15 menit
- status:
  - H (Hadir): check-in <= batas toleransi
  - T (Terlambat): check-in > batas toleransi
  - I (Izin): input petugas, wajib bukti
  - S (Sakit): input petugas, wajib bukti
  - A (Alpha): tidak ada check-in sampai cutoff

Catatan implementasi:
- Jangan hardcode jam dan toleransi di controller.
- Semua harus berasal dari konfigurasi (database atau file config) agar bisa diubah tanpa deploy.

C. Cutoff alpha (cron/job)
- Sistem boleh menjalankan job harian untuk menetapkan Alpha untuk yang tidak punya log
- Job harus idempotent (jalan 2x tidak merusak data)

----------------------------------------------------------------

6) Sistem Banding Absen (Dispute)
Tujuan:
- Siswa bisa ajukan banding jika merasa hadir tapi tercatat Alpha/invalid.

Aturan minimum:
- Banding punya status: pending, approved, rejected
- Banding harus menyimpan:
  - identitas siswa
  - tanggal kejadian
  - alasan
  - bukti (file/link jika ada)
  - audit siapa yang memutuskan + waktu keputusan

Validasi:
- Hanya role tertentu yang bisa menyetujui/menolak (piket/wali kelas/admin sesuai kebijakan)

----------------------------------------------------------------

7) Struktur Data Akademik (Stabil, Tidak Baper sama Label)
Jurusan/kompetensi:
- Gunakan kode internal stabil (mis. rpl, tkj, ak)
- Label tampilan boleh berubah (mis. RPL vs PPLG), tapi kode tidak berubah
- Semua dropdown dan filter berbasis kode, bukan label

Kelas:
- Gunakan format konsisten (contoh: XII RPL 1, X AK 3)
- Simpan di DB: tingkat, jurusan_kode, rombel/nomor
- Label tampilan dapat di-generate dari field tersebut

----------------------------------------------------------------

8) Laporan, Ekspor, dan Administrasi
A. Kop surat
- Semua dokumen resmi yang diekspor wajib pakai kop surat standar
- Data kop surat wajib diambil dari informasisekolah13.md (atau config yang bersumber dari situ)
- Format visual kop surat mengikuti template resmi sekolah jika tersedia (scan)

B. Tanda tangan
- Dokumen rekap menyediakan slot:
  - Wali kelas
  - Kepala sekolah
- Nama/NIP/jabatan tidak boleh hardcode; harus dari config/admin setting.

C. Privasi di dokumen
- Jangan mempublikasikan data sensitif di ekspor umum
- Pastikan aturan akses ekspor (siapa boleh download)

----------------------------------------------------------------

9) Security & Compliance
Aturan wajib:
- Validasi input untuk semua endpoint (body/query/params)
- Jangan log password/token/secret
- Auth wajib untuk endpoint sensitif
- Role-based access control default: deny
- Query DB harus aman (parameterized), tidak boleh string concat liar

Audit log:
- Aksi penting harus tercatat:
  - login/logout
  - create/update/delete master data
  - approve/reject banding
  - ekspor laporan
  - perubahan konfigurasi

----------------------------------------------------------------

10) Error Handling & Logging
- Semua error harus menghasilkan response yang rapi dan konsisten
- Server log boleh menyimpan stack trace, tapi jangan bocorkan secret
- Untuk error yang bisa diprediksi (validasi/akses), jangan lempar 500

----------------------------------------------------------------

11) Operasional (Deploy, Env, Backup)
A. Environment variables
- Semua credential disimpan di env, bukan di source code
- Gunakan contoh file .env.example (tanpa nilai rahasia)

B. Backup
- Backup DB terjadwal wajib ada untuk production
- Backup tidak boleh menyertakan .env atau secret
- Harus ada prosedur restore yang jelas

C. Migrasi
- Perubahan skema DB wajib lewat migration
- Migration harus bisa dijalankan ulang (idempotent) atau punya guard

----------------------------------------------------------------

12) Quality Gate (Definition of Done)
Sebuah perubahan dianggap selesai jika:
- Tidak merusak fitur existing
- Endpoint baru punya validasi + auth + response format konsisten
- Tidak ada secret bocor
- Perubahan DB punya migration + update seeding bila perlu
- Ada ringkasan perubahan:
  - daftar file yang diubah
  - cara test singkat
  - catatan risiko/rollback jika menyentuh data
- Kode yang selesai WAJIB di-commit dan di-push ke repository remote (git push origin main)

----------------------------------------------------------------

13) Larangan Keras (Safety)
- Dilarang membuat fitur/kode untuk hacking, spam, credential theft, atau aktivitas ilegal
- Fokus sistem: absensi, administrasi, laporan, dan keamanan data sekolah

----------------------------------------------------------------

14) Referensi Internal
- informasisekolah13.md adalah sumber tunggal untuk identitas sekolah dan kop surat
- Jika ada dokumen template resmi (scan kop surat), tambahkan ke folder dokumentasi dan jadikan rujukan utama.
