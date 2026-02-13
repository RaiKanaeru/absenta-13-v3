# Absenta 13 v3: Technical System Architecture

Dokumen ini merangkum arsitektur teknis, skema sistem, dan standar pengembangan yang telah ditingkatkan selama overhaul besar pada v3.

## 1. Core Architecture Overview

Sistem Absenta 13 v3 menggunakan arsitektur **Full-Stack Modular** dengan pemisahan tanggung jawab yang ketat antara Frontend dan Backend.

### Tech Stack
- **Frontend:** React 18 (Vite), TypeScript, Tailwind CSS, Shadcn UI.
- **Backend:** Node.js (ESM), Express.
- **Database:** MySQL 8+ (via `mysql2` dengan proxy pool).
- **Caching & Queue:** Redis (Bull MQ).
- **Infrastruktur:** Docker (Orkestrasi multi-container), Nginx (Reverse Proxy).

---

## 2. Frontend Architecture (React)

### 2.1 Single Source of Truth: Routing & Auth
Sistem telah bermigrasi dari *state-based dashboard* ke **React Router v6 Nested Routes**.
- **Path Guard:** Menggunakan `ProtectedRoute.tsx` untuk membatasi akses berdasarkan role (Admin, Guru, Siswa).
- **Auth Context:** Terpusat di `AuthContext.tsx`. Menyediakan state `user`, `loading`, dan fungsi `login`/`logout` secara global melalui hook `useAuth()`.
- **URL Pattern:** 
  - `/admin/*` -> Dashboard Admin & Management
  - `/guru/*` -> Management Kelas & Absensi
  - `/siswa/*` -> Absensi Mandiri & Riwayat

### 2.2 Komunikasi API
- Menggunakan utility `apiCall` dari `@/utils/apiClient`.
- Otomatis menyertakan `X-Client-ID` (UUID unik per perangkat) untuk tracking keamanan.
- Otomatis menangani header `Authorization: Bearer <token>`.

---

## 3. Backend Architecture (Node.js)

### 3.1 Design Pattern
Mengikuti pola **Routes → Controllers → Services**.
- **Routes:** Hanya mendefinisikan endpoint dan middleware (auth, rate limit).
- **Controllers:** Menangani validasi input HTTP, parsing parameter, dan pengiriman respons.
- **Services:** Berisi logika bisnis inti dan interaksi database.

### 3.2 Database Access Layer
- Terpusat di `server/config/db.js`.
- **db.query vs db.execute:** Menggunakan `db.query()` untuk operasi yang melibatkan `LIMIT` dan `OFFSET` karena keterbatasan MySQL Prepared Statements pada parameter integer.
- **Proxy Pattern:** Mengakses pool secara aman melalui `globalThis.dbPool`.

---

## 4. Security Framework (Hardened)

### 4.1 Multi-Key Lockout Strategy
Sistem mengamankan sekolah dari *brute-force* tanpa mengganggu akses satu jaringan WiFi:
1. **Account Key:** Lockout per `username` (Maks 5x gagal).
2. **Client Key:** Lockout per `clientId` / device (Maks 10x gagal).
3. **IP Key:** Lockout per IP address (Maks 20x gagal - Fallback).

### 4.2 Bot Verification (hCaptcha)
- Integrasi **hCaptcha** secara *end-to-end*.
- Captcha wajib muncul setelah 3x percobaan gagal pada akun tertentu.
- Verifikasi dilakukan di server-side sebelum validasi password.

---

## 5. Reporting Engine (Professional Reports)

Sistem laporan mendukung format **Excel (.xlsx)** dan **PDF (.pdf)** dengan standardisasi *letterhead* (Kop Surat).

### 5.1 Excel Builder
- Menggunakan `exceljs`.
- Mendukung template dinamis dan *streaming mode* untuk dataset besar.

### 5.2 PDF Builder
- Menggunakan `pdfmake`.
- Font Roboto dimuat secara lokal via absolute path.
- Layout otomatis menyesuaikan (Portrait/Landscape) dengan penomoran halaman otomatis.

---

## 6. Operasional & Deployment

### 6.1 Timezone & Date Handling
- Seluruh sistem berjalan pada zona waktu **WIB (Asia/Jakarta, UTC+7)**.
- Hindari `.toISOString()` untuk tanggal dari DB. Gunakan helper formatting `YYYY-MM-DD` untuk mencegah pergeseran tanggal akibat boundary UTC.

### 6.2 Docker Orchestration
Sistem berjalan dalam 4 container utama:
1. `absenta13-nginx`: Menangani static frontend dan reverse proxy API.
2. `absenta13-app`: Node.js backend server.
3. `absenta13-mysql`: Database persistence.
4. `absenta13-redis`: Cache layer dan message broker untuk queue.

### 6.3 Cleanup System
- **File Cleanup:** Scheduler otomatis menghapus file export di folder `downloads/` setiap jam jika usia file >24 jam untuk menghemat ruang disk.
- **Rate Limiting:** Export dibatasi 5 request per menit per user untuk mencegah penyalahgunaan resource server.

---

## 7. Standar Pengembangan (Bagi Developer/AI)
1. **Naming:** Frontend `PascalCase.tsx`, Backend `camelCase.js`.
2. **Icons:** Gunakan `lucide-react`.
3. **UI:** Gunakan Shadcn UI components dari `@/components/ui/`.
4. **Log:** Gunakan `createLogger` dari `server/utils/logger.js`.
5. **Errors:** Selalu gunakan `errorHandler.js` untuk respons API yang konsisten.
