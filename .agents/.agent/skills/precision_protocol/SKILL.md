---
name: Precision Protocol
description: Protocol untuk meningkatkan kecerdasan, presisi, dan keamanan dalam coding dan debugging.
---

# Precision Protocol (Upgrade Otak Agent)

Skill ini adalah "upgrade firmware" untuk meningkatkan cara kerja agent agar lebih teliti, tidak ceroboh, dan tepat sasaran.

## 1. Aturan Suci UI (The Sanctity of UI)
**Prinsip:** "Use it, don't break it."
- **DILARANG** mengubah layout, padding, margin, atau struktur visual komponen React KECUALI diminta secara eksplisit.
- **DILARANG** menghapus tombol navigasi (seperti "Kembali") dengan alasan "pembersihan", kecuali user meminta.
- **HUKUMAN:** Jika user komplain UI berubah, segera revert ke commit sebelumnya tanpa debat.

## 2. Global Awareness Protocol (Node.js)
**Prinsip:** "Dependency Check First."
- Sebelum menggunakan variable global (seperti `globalThis.dbPool`, `globalThis.backupSystem`) di Controller:
  - **WAJIB** cek di mana variable itu di-init (biasanya `server_modern.js` atau `app.js`).
  - **WAJIB** pastikan urutan load file server benar (apakah `server_modern.js` yang dijalankan atau `server.js` lama?).
  - **JANGAN ASUMSI** variable ada hanya karena code editor tidak merah. Runtime > Static Analysis.

## 3. Debugging: The "No-Guess" Policy
**Prinsip:** "Data over Assumption."
- Jika terjadi Error 500:
  - **JANGAN** hanya menebak satu penyebab.
  - **WAJIB** ubah endpoint agar me-return `error.message` dan `Stack Trace` ke JSON response (environment dev).
  - **WAJIB** tambahkan `logger.info` granular (Checkpoint 1, 2, 3) untuk melacak di baris mana code berhenti.
- Jangan minta user tes ulang tanpa mengubah logging atau error handling—itu sia-sia.

## 4. Root Cause Analysis (RCA)
- Sebelum fix, tanya: "Kenapa ini error SEKARANG? Apa yang berubah?"
- Jika error muncul setelah refactor, revert refactor tersebut dulu untuk isolasi.
- Jika backup restore gagal, cek dulu: File masuk? Koneksi DB hidup? SQL valid?

## 5. Verifikasi Bertingkat
- Fix tidak selesai saat code ditulis.
- Fix selesai saat:
  1. Linter pass.
  2. Build pass.
  3. Logika diverifikasi (misal: trace ulang flow code secara mental).

## 6. Komunikasi
- Jangan pusingkan user dengan teknikal berlebihan, tapi beri data yang mereka butuhkan untuk bantu debug (seperti: "Tolong kirim respons JSON tab Network").
