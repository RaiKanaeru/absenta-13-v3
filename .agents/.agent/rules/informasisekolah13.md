---
trigger: always_on
---

# Informasi Sekolah (Single Source of Truth)
Nama file: informasisekolah13.md
Dipakai untuk: kop surat, footer dokumen, template PDF/Excel, halaman “Tentang Sekolah”, validasi identitas sekolah.

Aturan utama:
- Data identitas sekolah tidak boleh dikarang.
- Jika ada konflik antara dokumen ini vs dokumen fisik sekolah (kop surat resmi/scan), dokumen fisik menang.
- Nama pejabat (mis. kepala sekolah) tidak boleh di-hardcode; harus lewat konfigurasi/admin setting.

Terakhir diverifikasi: 2025-12-12

----------------------------------------------------------------

1) Identitas Resmi
- Nama resmi: SMKN 13 BANDUNG
- NPSN: 20219161
- Status: Negeri
- Bentuk/Jenjang: SMK / Dikmen

Sumber resmi:
- https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/20219161
- https://dapo.kemendikdasmen.go.id/sekolah/DC222FB87429719D22AC

----------------------------------------------------------------

2) Alamat Resmi (format data)
- Alamat jalan: JL. SOEKARNO-HATTA KM. 10 BANDUNG
- RT/RW: RT 6 RW 9
- Kelurahan: Jati Sari
- Kecamatan: Buahbatu
- Kota: Kota Bandung
- Provinsi: Jawa Barat
- Kode pos: 40286

Sumber resmi:
- https://referensi.data.kemendikdasmen.go.id/snpmb/site/sekolah?npsn=20219161
- https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/20219161

----------------------------------------------------------------

3) Kontak (untuk template & halaman kontak)
- Telepon: 0227318960
- Website (umum): http://www.smkn-13.sch.id

Catatan:
- Email sekolah sering muncul di berbagai sumber non-resmi. Jika mau dipakai untuk dokumen resmi, pastikan dari kanal sekolah (surat/website resmi/sosmed resmi) atau input via admin setting.

Sumber pendukung:
- https://simdik.bandung.go.id/npsn/20219161?s=20161

----------------------------------------------------------------

4) Koordinat (opsional, untuk peta)
- Latitude: -6.9384
- Longitude: 107.6569

Sumber:
- https://sekolah.data.kemendikdasmen.go.id/profil-sekolah/8F7F1FD4-B86A-43BF-90E0-5B40987B20CF

----------------------------------------------------------------

5) Akreditasi (untuk tampilan profil sekolah)
- Akreditasi: A
- Tahun: 2021
- Nomor SK: 1347/BAN-SM/SK/2021

Sumber:
- https://referensi.data.kemendikdasmen.go.id/snpmb/site/sekolah?npsn=20219161

----------------------------------------------------------------

6) Kepala Sekolah (dinamis, jangan hardcode)
- Nama kepala sekolah bisa berubah dan tidak stabil untuk jangka panjang.
- Mekanisme sistem:
  - simpan di tabel/config `signatories` (atau setting admin)
  - dokumen ekspor hanya ambil dari config, bukan string literal

Sumber (hanya sebagai referensi saat verifikasi, bukan untuk hardcode):
- https://referensi.data.kemendikdasmen.go.id/snpmb/site/sekolah?npsn=20219161

----------------------------------------------------------------

7) Default Kop Surat (Template Aman)
Tujuan: memberi baseline yang tidak salah provinsi/kota, namun tetap editable.

Susunan teks yang disarankan:
1) PEMERINTAH DAERAH PROVINSI JAWA BARAT
2) DINAS PENDIDIKAN (PROVINSI JAWA BARAT)
3) SMKN 13 BANDUNG
4) JL. SOEKARNO-HATTA KM. 10 BANDUNG, RT 6 RW 9, KEL. JATI SARI, KEC. BUAHBATU, KOTA BANDUNG, JAWA BARAT 40286
5) Telp 0227318960 • Website http://www.smkn-13.sch.id

Aturan:
- Tidak boleh menulis “DKI Jakarta” (auto blunder).
- Jika sekolah punya format kop surat resmi (scan), format itu harus diikuti 100%.

----------------------------------------------------------------

8) Program/Jurusan (untuk dropdown, filter, dan metadata)
Catatan penting:
- Nama jurusan/kompetensi dapat berubah istilah (contoh modern: RPL -> PPLG, TKJ -> TJKT).
- Data resmi sekolah (Pusdatin) tidak selalu menampilkan daftar kompetensi secara detail.
- Maka: gunakan kode internal stabil + label tampilan yang bisa diubah.

Saran kode internal:
- rpl (label default: Rekayasa Perangkat Lunak / PPLG)
- tkj (label default: Teknik Komputer & Jaringan / TJKT)
- ak  (label default: Analisis Kimia)

Aturan:
- Kode internal tidak boleh berubah karena label.
- Label bisa diubah lewat admin setting.

----------------------------------------------------------------

9) Variabel Template (untuk generator dokumen)
Gunakan placeholder ini di template:
- {NAMA_SEKOLAH} = SMKN 13 BANDUNG
- {NPSN} = 20219161
- {ALAMAT_LENGKAP}
- {TELEPON}
- {WEBSITE}
- {KODE_POS}
- {KOTA} / {PROVINSI}
- {NAMA_KEPSEK} / {NIP_KEPSEK} (dinamis)
- {NAMA_WALI_KELAS} / {NIP_WALI_KELAS} (dinamis)

----------------------------------------------------------------

10) Sumber Resmi yang Diprioritaskan
Prioritas 1 (paling resmi):
- https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/20219161
- https://referensi.data.kemendikdasmen.go.id/snpmb/site/sekolah?npsn=20219161
- https://dapo.kemendikdasmen.go.id/sekolah/DC222FB87429719D22AC
- https://sekolah.data.kemendikdasmen.go.id/profil-sekolah/8F7F1FD4-B86A-43BF-90E0-5B40987B20CF
