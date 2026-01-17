---
sidebar_position: 6
---

# Menjalankan Lokal dan Deployment

Dokumen ini menjelaskan cara menjalankan absenta13 secara lokal dan opsi deployment.

## Menjalankan Lokal

Instal dependensi:

```bash
npm install
```

Jalankan backend:

```bash
node server_modern.js
```

Jalankan frontend:

```bash
npm run dev
```

Atau jalankan bersamaan:

```bash
npm run dev:full
```

## Environment

Pastikan file `.env` berisi konfigurasi database, Redis, dan JWT.

## Deployment Dengan PM2

```bash
npm run build
pm2 start ecosystem.config.cjs --env production
pm2 status
```

## Deployment Dengan Docker

Jika tersedia `docker-compose.yml`:

```
docker-compose up -d --build
```

Gunakan `docker-compose logs --tail=200 app` untuk inspeksi.

## Catatan Operasional

- Selalu backup sebelum perubahan besar.
- Pastikan Redis dan MySQL aktif sebelum server dijalankan.
- Periksa port 3001 dan 5173 tidak bentrok.
