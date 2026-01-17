---
sidebar_position: 2
---

# Monitoring dan Keamanan

absenta13 menyediakan modul monitoring untuk metrik sistem dan keamanan.

## Monitoring

Monitoring menampilkan metrik berikut:

- CPU, memory, dan disk.
- Response time aplikasi dan database.
- Jumlah request, error, dan status cache.

Sumber implementasi berada di:

- `server/services/system/monitoring-system.js`
- `src/components/MonitoringDashboard.tsx`

## Keamanan

Lapisan keamanan utama:

- Rate limiting berbasis IP.
- Audit logging untuk aksi penting.
- Validasi input di controller.
- Auto blocking IP untuk aktivitas mencurigakan.

Implementasi ada di:

- `server/services/system/security-system.js`
- `server/middleware/auth.js`

## Praktik Operasional

- Tinjau error dengan filter waktu.
- Pastikan Redis aktif untuk cache dan queue.
- Pantau query lambat dan endpoint berat.
