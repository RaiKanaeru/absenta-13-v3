---
sidebar_position: 1
---

# Backup, Archive, dan Restore

absenta13 menyediakan fitur backup dan archive untuk menjaga data tetap aman.

## Lokasi File

- Backup tersimpan di folder `backups/`.
- Archive lama tersimpan di `archives/`.
- Restore menerima file `.sql` atau `.zip`.

## Backup

Dari menu admin, operator dapat:

- Membuat backup semester.
- Melihat daftar backup.
- Menjalankan archive data lama.

Catatan:

- Pastikan MySQL dan Redis aktif sebelum proses backup.
- Jalankan backup sebelum migrasi atau rilis besar.

## Restore

Restore dapat dilakukan melalui menu admin atau endpoint terkait. Proses ini
mungkin menimpa data yang ada, jadi gunakan dengan hati-hati.

Validasi file:

- Ekstensi hanya `.sql` atau `.zip`.
- Ukuran maksimum 100MB.
- Nama file tidak boleh mengandung path traversal.

## Konfigurasi Jadwal Backup

Jadwal backup disimpan di:

- `backup-settings.json`
- `custom-schedules.json`

Gunakan jadwal otomatis hanya jika server berjalan stabil pada waktu eksekusi.
