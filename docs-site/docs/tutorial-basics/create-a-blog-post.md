---
sidebar_position: 4
---

# Backend: Route, Controller, Service

Backend absenta13 menggunakan Express dengan pemisahan route dan controller.

## Struktur Backend

- `server_modern.js`: entrypoint dan wiring route.
- `server/routes/`: definisi endpoint.
- `server/controllers/`: handler request dan response.
- `server/services/`: logic bisnis dan proses data.
- `server/middleware/`: autentikasi dan error handler.

## Pola Endpoint

Contoh pola umum:

```
GET /api/admin/jadwal
POST /api/admin/jadwal
PUT /api/admin/jadwal/:id
DELETE /api/admin/jadwal/:id
```

## Autentikasi dan Role

Gunakan middleware:

- `authenticateToken` untuk validasi JWT.
- `requireRole` untuk membatasi akses role.

## Respons API

Gunakan format respons yang konsisten:

```
{
  "success": true,
  "data": [...],
  "message": "OK"
}
```

Untuk error, gunakan status HTTP yang tepat dan pesan yang jelas:

```
{
  "success": false,
  "error": "Pesan error"
}
```

## Validasi Input

- Validasi tipe dan range nilai di controller.
- Hindari query raw tanpa parameter.
- Jangan percaya data dari body atau query.

## Testing

Tes backend berada di `server/__tests__/`. Jalankan:

```bash
npm run test:server
```
