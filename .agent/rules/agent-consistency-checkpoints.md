# Absenta13 - Agent Consistency Checkpoints

Dokumen ini adalah kontrak konsistensi antara Codex dan Anti-gravity untuk proyek Absenta13.
Tujuannya mencegah ketidakselarasan API, data, dan perilaku fitur antara frontend, backend,
serta dokumentasi.

## 1) Checkpoint Log (Perubahan Kritis)

### CP-2026-01-18-01
- Tanggal/Waktu: 2026-01-18 01:15:46
- Area: Admin (Kelola Akun Siswa), Restore/Database Manager, Laporan
- Ringkas Masalah:
  - Update/delete siswa memakai NIS di frontend, tapi backend hanya menerima id.
  - Restore SQL gagal untuk dump dengan DELIMITER/procedure atau SQL lowercase.
  - Header Authorization dikirim kosong (Bearer '') ketika token tidak ada di localStorage.
- Keputusan:
  - Standarkan update/delete siswa berdasarkan NIS.
  - Gunakan parser SQL yang paham DELIMITER dan komentar.
  - Jangan override Authorization kosong; pakai apiCall default.
- Implementasi (ringkas):
  - API siswa: route param diubah ke `/:nis`, query by NIS, update/delete by id internal.
  - SQL restore & execute memakai `splitSqlStatements`, validasi SQL case-insensitive.
  - Admin reports export menggunakan token bersih jika ada + credentials.
- Dampak:
  - Frontend tetap pakai NIS pada URL (tidak perlu ubah).
  - Restore menerima dump yang lebih variatif tanpa error parsing.
  - Auth tidak gagal karena header kosong.
- File Tersentuh (referensi):
  - `server/routes/siswaRoutes.js`
  - `server/controllers/siswaController.js`
  - `server/utils/sqlParser.js`
  - `server/controllers/backupController.js`
  - `server/controllers/databaseFileController.js`
  - `src/components/admin/database/DatabaseManagerView.tsx`
  - `src/components/BackupManagementView.tsx`
  - `src/components/admin/reports/ReportsView.tsx`
- Status Test: belum dijalankan (butuh uji manual di UI Admin).
- Risiko Sisa:
  - Dump SQL sangat besar masih bisa berat di single-transaction.
  - Endpoint lain yang masih pakai token manual perlu audit lanjutan.

## 2) Kontrak Konsistensi (Codex x Anti-gravity)

Urutan sumber kebenaran (prioritas tertinggi ke terendah):
1. `AGENTS.md` dan dokumen sistem resmi Absenta13.
2. Skema DB dan route backend nyata (kode di server).
3. Konfigurasi frontend yang dipakai produksi.
4. Dokumentasi dan catatan perubahan.

Aturan wajib:
- Identitas siswa: gunakan NIS di endpoint admin untuk update/delete siswa.
- Identitas guru: gunakan NIP di endpoint admin jika disediakan (jika tidak, gunakan id).
- Route dinamis harus ditempatkan setelah route statis (contoh: `/update-profile`).
- Authorization header:
  - Gunakan util `apiCall` default.
  - Jangan kirim `Authorization: Bearer ` kosong.
  - Jika token tidak ada, biarkan cookie yang bekerja.
- Restore/Execute SQL:
  - Dilarang split SQL dengan `;` mentah.
  - Wajib pakai `splitSqlStatements` (DELIMITER-aware).
- Database Manager:
  - Folder `database/` harus ada di repo dan ter-mount ke container jika pakai Docker.
  - Jika file SQL baru ditambahkan, update dokumentasi.

## 3) Checklist Konsistensi Perubahan

Sebelum merge:
- Cek kontrak API (FE <-> BE) untuk identifier (NIS/NIP/id).
- Pastikan perubahan di backend tidak mematahkan route alias di frontend.
- Pastikan auth header tidak di-override kosong.
- Jika menyentuh restore/backup, gunakan parser SQL standar.
- Update dokumentasi jika API berubah.

Sesudah merge:
- Update `docs-site` jika ada perubahan endpoint.
- Buat checkpoint baru di file ini jika perubahan berdampak sistemik.

## 4) Template Checkpoint Baru

```
### CP-YYYY-MM-DD-XX
- Tanggal/Waktu: YYYY-MM-DD HH:mm:ss
- Area:
- Ringkas Masalah:
- Keputusan:
- Implementasi (ringkas):
- Dampak:
- File Tersentuh (referensi):
- Status Test:
- Risiko Sisa:
```

## 5) Catatan Komunikasi Agen

Jika instruksi berbeda antara Codex dan Anti-gravity:
- Hentikan eksekusi.
- Bandingkan dengan urutan sumber kebenaran.
- Ajukan klarifikasi ke user dan catat hasilnya sebagai checkpoint baru.

## 6) Protokol Evaluasi Permintaan Fitur (Jangan Telan Mentah)

Tujuan: setiap permintaan fitur harus dianalisis dulu agar logis, konsisten, dan sesuai scope Absenta13.

Langkah wajib saat user minta fitur baru:
1. Pahami tujuan bisnis: apa masalah yang diselesaikan dan siapa pengguna utamanya.
2. Cek scope: pastikan masih dalam sistem Absenta13 dan tidak melanggar guardrails proyek.
3. Audit fitur yang sudah ada: mungkin sudah ada atau cukup diperbaiki tanpa fitur baru.
4. Validasi logika: cek apakah permintaan masuk akal dengan alur data, aturan sekolah, dan struktur DB.
5. Cek dampak teknis:
   - API route dan kontrak FE-BE
   - Perubahan DB (migrasi, indeks, relasi)
   - Kinerja (query berat, caching, queue)
   - Keamanan (auth, role, audit log)
6. Cek risiko dan biaya:
   - Risiko bug/regresi
   - Kompleksitas implementasi
   - Waktu uji dan dokumentasi
7. Putuskan sikap:
   - Setuju: jelaskan rencana kecil dan risiko.
   - Perlu revisi: minta klarifikasi atau ubah requirement.
   - Tidak perlu: jelaskan alasan teknis/bisnis dan alternatif.

Output wajib ke user (ringkas):
- Ringkasan pemahaman kebutuhan.
- Temuan kekurangan/ketidaklogisan (jika ada).
- Rekomendasi: lanjut, revisi, atau batalkan.
- Jika lanjut: rencana singkat + file target + risiko.

Catatan: kalau permintaan bertentangan dengan instruksi proyek (misal dilarang menambah fitur di dashboard admin), jawab dengan penolakan yang jelas dan tawarkan solusi perbaikan tanpa fitur baru.
