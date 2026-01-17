---
sidebar_position: 2
---

# Struktur Repositori

Dokumen ini menjelaskan struktur utama repo absenta13 dan fungsi tiap folder.

## Root

```
absenta13/
  src/            Frontend React
  server/         Backend Express
  backend/        Utilitas export dan letterhead
  database/       Dump dan seeder SQL
  migrations/     Migrasi SQL tingkat repo
  docs/           Dokumentasi internal project
  docs-site/      Dokumentasi absenta13
  scripts/        Script setup dan utilitas
  public/         Aset statis frontend
  server_modern.js Entrypoint backend
```

## Frontend (`src/`)

- `src/main.tsx`: entrypoint React.
- `src/App.tsx`: router dan boundary.
- `src/pages/Index_Modern.tsx`: login dan switch dashboard.
- `src/components/`: dashboard dan komponen UI.
- `src/services/`: service API khusus (contoh jadwal).
- `src/utils/`: utilitas client (api client, auth, format).

## Backend (`server/`)

- `server/routes/`: definisi route.
- `server/controllers/`: handler API.
- `server/services/`: business logic dan system services.
- `server/middleware/`: auth dan error handler.
- `server/utils/`: utilitas time, logging, dan helper.

## Data dan Operasional

- `database/`: dump dan seeder untuk data awal atau dummy.
- `migrations/`: migrasi SQL terpisah dari seeder.
- `backups/`, `archives/`, `reports/`: hasil backup, arsip, dan laporan.

Gunakan struktur ini sebagai acuan saat menambah fitur atau memperbaiki bug.
