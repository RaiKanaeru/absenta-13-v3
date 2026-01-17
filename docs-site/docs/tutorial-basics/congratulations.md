---
sidebar_position: 7
---

# Checklist Perubahan

Gunakan checklist ini sebelum merge atau rilis.

## Checklist Teknis

- Validasi input di backend untuk endpoint baru.
- Pastikan role dan auth diterapkan dengan benar.
- Update `.env.example` jika menambah env baru.
- Hindari hardcoded secret dan kredensial.

## Checklist Data

- Jika ada perubahan skema, buat migrasi SQL.
- Pastikan dump dan seeder tidak tertimpa tanpa alasan.
- Jangan menjalankan perintah destruktif tanpa konfirmasi.

## Checklist UI

- Pastikan error handling jelas di dashboard.
- Hindari duplikasi state dan util.
- Uji halaman utama untuk admin, guru, dan siswa.

## Checklist Test

Jalankan tes jika logika berubah:

```bash
npm test
```

Jika tidak menjalankan tes, jelaskan alasannya di catatan perubahan.
