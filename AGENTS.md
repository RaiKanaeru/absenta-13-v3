# AGENTS.md — Absenta 13 v3 (Project Instructions for Codex)

## 0) Ringkasan Sistem
Absenta-13-v3 adalah web app absensi sekolah:
- Frontend: React + TypeScript + Vite (port 5173)
- Backend: Node.js + Express (port 3001)
- Database: MySQL (3306)
- Cache/Queue: Redis (6379)

Repo ini sudah mengandung sistem caching, queue untuk export Excel, monitoring, dan security (rate limiting, audit logging, dsb).

## 1) Cara Menjalankan (Local Dev)
### Prasyarat
- Node.js v18+
- MySQL v8+
- Redis v6+

### Quick start (manual)
1) Install dependency:
   - npm install
2) Database:
   - Import file `absenta13.sql` ke MySQL (phpMyAdmin/XAMPP).
3) Redis:
   - Windows: jalankan `redis-server.exe` dari folder `redis/`
   - Linux/Mac: start redis service
4) Jalankan backend:
   - node server_modern.js
5) Jalankan frontend:
   - npm run dev
6) Akses:
   - Frontend: http://localhost:5173
   - Backend:  http://localhost:3001

## 2) Environment Variables (.env)
Buat file `.env` di root. Minimal wajib:
- DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
- REDIS_HOST, REDIS_PORT
- PORT (default 3001)
- JWT_SECRET (WAJIB untuk production; minimal 32 karakter)

Catatan:
- Jangan pernah commit `.env` atau secrets.
- Kalau menambah env var baru, update `.env.example` dan dokumentasi.

## 3) Struktur Folder (Peta Navigasi)
- src/        : Frontend React (components/pages/contexts/hooks)
- server/     : Backend Express (routes/controllers/services/middleware)
- backend/    : utilitas pendukung backend (config/export/scripts/utils)
- migrations/ : migrasi/seed DB
- scripts/    : script deployment/otomasi
- redis/      : resource redis (untuk Windows juga)
- docs/       : dokumentasi tambahan

## 4) Aturan Kerja untuk Codex
Sebelum coding:
1) Identifikasi lokasi perubahan (frontend vs backend vs DB).
2) Sebutkan file target yang akan diubah.
3) Jelaskan rencana singkat (2–5 langkah) dan risiko.

Saat implementasi:
- Jaga perubahan tetap kecil dan fokus.
- Hindari duplikasi logic (tarik ke util/service bila perlu).
- Selalu validasi input di backend (jangan percaya body/query).
- Untuk endpoint berat: pertimbangkan caching/queue sesuai pola yang sudah ada.

Setelah implementasi:
- Jalankan test/lint bila tersedia.
- Pastikan port, env, dan dokumentasi tetap konsisten.
- Kalau mengubah API, update dokumentasi endpoint yang relevan.

## 5) Guardrails (Wajib)
- Tidak boleh menambahkan secrets hardcoded.
- Tidak boleh menjalankan perintah destruktif (rm -rf, drop DB, deploy) tanpa meminta approval.
- Jika ada aksi menyentuh data nyata/produksi: STOP dan minta konfirmasi.
