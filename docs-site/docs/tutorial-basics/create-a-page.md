---
sidebar_position: 3
---

# Frontend: Halaman dan Komponen

Frontend Absenta 13 dibangun dengan React + TypeScript. Alur utama ditentukan di
`src/pages/Index_Modern.tsx` yang menangani login dan routing berdasarkan role.

## Entry Point dan Routing

- `src/main.tsx` memanggil `App` dan provider global.
- `src/App.tsx` mendefinisikan route utama:
  - `/` memuat `Index_Modern`.
  - Halaman error ada di `src/components/pages/`.

## Dashboard Berdasarkan Role

- Admin: `src/components/AdminDashboard_Modern.tsx`.
- Guru: `src/components/TeacherDashboard_Modern.tsx`.
- Siswa: `src/components/StudentDashboard_Modern.tsx`.

Komponen modular berada di:

- `src/components/admin/`
- `src/components/teacher/`
- `src/components/student/`

## Pola Akses API

Gunakan helper `getApiUrl` atau `apiClient` agar base URL konsisten:

- `src/config/api.ts` menentukan base URL otomatis.
- `src/utils/apiClient.ts` menangani header dan error.

Jika menambah endpoint baru, pastikan:

- Error handling menampilkan pesan yang jelas.
- Status HTTP non-200 tidak dianggap sukses.
- Data konsisten dengan bentuk response backend.

## Praktik UI

- Hindari hardcoded URL dan token.
- Gunakan komponen UI di `src/components/ui/`.
- Simpan state pada komponen terdekat dan hindari duplikasi.
