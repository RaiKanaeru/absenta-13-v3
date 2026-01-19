# Logic Perhitungan Absensi - Absenta13

Dokumentasi lengkap tentang bagaimana sistem Absenta13 menghitung dan memproses data kehadiran siswa dan guru.

---

## Daftar Isi

1. [Status Kehadiran](#status-kehadiran)
2. [Kategori Status](#kategori-status)
3. [Aturan Perhitungan](#aturan-perhitungan)
4. [Jam Masuk & Toleransi](#jam-masuk--toleransi)
5. [Izin di Tengah Pelajaran](#izin-di-tengah-pelajaran)
6. [Rumus Persentase](#rumus-persentase)
7. [Query SQL Reference](#query-sql-reference)
8. [Konfigurasi](#konfigurasi)

---

## Status Kehadiran

### Status Siswa (`absensi_siswa`)

| Kode | Status | Deskripsi |
|------|--------|-----------|
| H | Hadir | Siswa hadir di kelas |
| T | Terlambat | Hadir tapi melebihi toleransi waktu |
| I | Izin | Tidak hadir dengan izin resmi |
| S | Sakit | Tidak hadir karena sakit |
| A | Alpa | Tidak hadir tanpa keterangan |
| D | Dispen | Dispensasi (kegiatan sekolah) |

### Status Guru (`absensi_guru`)

| Kode | Status | Deskripsi |
|------|--------|-----------|
| H | Hadir | Guru hadir mengajar |
| TH | Tidak Hadir | Guru tidak hadir |
| I | Izin | Tidak hadir dengan izin |
| S | Sakit | Tidak hadir karena sakit |

---

## Kategori Status

### Status Dihitung HADIR

```javascript
const HADIR = ['Hadir', 'Dispen', 'Terlambat'];
```

- **Hadir** - Kehadiran normal
- **Dispen** - Dispensasi = dianggap HADIR (tidak merugikan siswa/guru)
- **Terlambat** - Tetap hadir, hanya flag tambahan

> Catatan: Status Dispen saat ini hanya berlaku untuk absensi siswa.

### Status Dihitung TIDAK HADIR (Ketidakhadiran)

```javascript
// Untuk Siswa
const TIDAK_HADIR_SISWA = ['Sakit', 'Izin', 'Alpa'];

// Untuk Guru
const TIDAK_HADIR_GURU = ['Tidak Hadir', 'Sakit', 'Izin'];
```

> ⚠️ **PENTING**: `Dispen` TIDAK dihitung sebagai ketidakhadiran!

---

## Aturan Perhitungan

### 1. Menghitung Kehadiran (H)

```sql
-- Siswa
SUM(CASE WHEN status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) AS hadir

-- Guru
SUM(CASE WHEN status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) AS hadir
```

### 2. Menghitung Ketidakhadiran

```sql
-- Siswa (S + I + A, TANPA Dispen)
SUM(CASE WHEN status IN ('Sakit', 'Izin', 'Alpa') THEN 1 ELSE 0 END) AS tidak_hadir

-- Guru
SUM(CASE WHEN status IN ('Tidak Hadir', 'Sakit', 'Izin') THEN 1 ELSE 0 END) AS tidak_hadir
```

### 3. Rekap per Kategori

```sql
-- Untuk siswa
SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) AS S,
SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) AS I,
SUM(CASE WHEN status = 'Alpa' THEN 1 ELSE 0 END) AS A,
SUM(CASE WHEN status = 'Dispen' THEN 1 ELSE 0 END) AS D
```

---

## Jam Masuk & Toleransi

> ⚠️ **SAAT INI DIMATIKAN** - Fitur deteksi terlambat di-disable secara default.

### Status Konfigurasi

| Parameter | Default | Keterangan |
|-----------|---------|------------|
| `enable_late_detection` | `false` | Deteksi terlambat OFF |
| `default_start_time` | `07:00` | Jam masuk default |
| `late_tolerance_minutes` | `15` | Toleransi (menit) |

Untuk mengaktifkan, ubah setting di tabel `attendance_settings` atau via Admin Panel.

---

## Aturan Kehadiran Harian (BARU)

### Prinsip Utama

> **1 Alpa = GUGUR seluruh kehadiran hari itu**

### Tabel Keputusan

| Jam 1-3 | Jam 4-5 | Status Hari |
|---------|---------|-------------|
| Hadir | Dispen | ✅ **HADIR** |
| Hadir | Izin | ✅ **HADIR** |
| Hadir | Sakit | ✅ **HADIR** |
| Hadir | **Alpa** | ❌ **ALPA** (gugur semua) |
| Izin semua | - | Izin |
| Sakit semua | - | Sakit |

### Logic Prioritas

```
1. Ada Alpa? → GUGUR (return Alpa)
2. Ada Hadir/Dispen? → return Hadir
3. Semua Izin/Sakit? → return Izin atau Sakit
4. Default → Alpa
```

### Function Perhitungan

```javascript
function calculateDailyStatus(records) {
    // RULE 1: Alpa voids entire day
    if (ALPHA_VOIDS_DAY && hasAlpa) {
        return { status: 'Alpa', reason: 'voided_by_alpha' };
    }
    
    // RULE 2: Any present = Hadir
    if (presentCount > 0) {
        return { status: 'Hadir', reason: 'has_present' };
    }
    
    // RULE 3: All excused
    if (izinCount > 0 || sakitCount > 0) {
        return { status: izinCount >= sakitCount ? 'Izin' : 'Sakit' };
    }
    
    return { status: 'Alpa' };
}
```

### Function Perhitungan

```javascript
function calculateDailyStatus(records) {
    const total = records.length;
    if (total === 0) return { status: 'Alpa' };
    
    const presentCount = records.filter(r => 
        ['Hadir', 'Dispen'].includes(r.status)
    ).length;
    
    const presentPercentage = presentCount / total;
    
    if (presentPercentage >= 0.5) {
        return { status: 'Hadir', presentPercentage };
    }
    
    // Jika < 50%, cek apakah ada izin/sakit
    const hasExcused = records.some(r => 
        ['Izin', 'Sakit'].includes(r.status)
    );
    
    return { 
        status: hasExcused ? 'Izin' : 'Alpa',
        presentPercentage 
    };
}
```

---

## Rumus Persentase

### Persentase Kehadiran

```
Persentase Hadir = (Hadir + Dispen) / Total × 100%
```

```sql
ROUND(
    (SUM(CASE WHEN status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) * 100.0) 
    / COUNT(*), 
    2
) AS persentase_hadir
```

### Persentase Ketidakhadiran

```
Persentase Tidak Hadir = (S + I + A) / Total × 100%
```

```sql
ROUND(
    (SUM(CASE WHEN status IN ('Sakit', 'Izin', 'Alpa') THEN 1 ELSE 0 END) * 100.0) 
    / COUNT(*), 
    2
) AS persentase_tidak_hadir
```

### Untuk Rekap Semester/Tahunan

```
Total Hari Efektif Gasal = 95 hari
Total Hari Efektif Genap = 142 hari
Total Hari Efektif Tahunan = 237 hari

% Ketidakhadiran = (S + I + A) / Total Hari Efektif × 100%
% Kehadiran = 100% - % Ketidakhadiran
```

---

## Query SQL Reference

### Rekap Kehadiran Siswa

```sql
SELECT 
    s.id_siswa,
    s.nama,
    s.nis,
    COALESCE(SUM(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END), 0) AS H,
    COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
    COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
    COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
    COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
    COUNT(a.id) AS total,
    ROUND(
        (SUM(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) * 100.0) 
        / NULLIF(COUNT(a.id), 0), 
        2
    ) AS presentase
FROM siswa s
LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id
WHERE a.tanggal BETWEEN ? AND ?
GROUP BY s.id_siswa
ORDER BY s.nama;
```

### Rekap Ketidakhadiran per Bulan

```sql
SELECT 
    a.siswa_id,
    MONTH(a.tanggal) as bulan,
    SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as S,
    SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as I,
    SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END) as A,
    SUM(CASE WHEN a.status IN ('Sakit', 'Izin', 'Alpa') THEN 1 ELSE 0 END) as total_ketidakhadiran
FROM absensi_siswa a
WHERE a.tanggal BETWEEN ? AND ?
GROUP BY a.siswa_id, MONTH(a.tanggal);
```

---

## Konfigurasi

### File: `server/config/attendanceConstants.js`

```javascript
// Status yang dihitung sebagai hadir
export const PRESENT_STATUSES = ['Hadir', 'Dispen'];

// Status ketidakhadiran
export const ABSENT_STATUSES = ['Sakit', 'Izin', 'Alpa'];

// Kategori ketidakhadiran
export const ABSENT_CATEGORIES = {
    SAKIT: 'Sakit',
    IZIN: 'Izin', 
    ALPA: 'Alpa'
};

// Aturan harian
export const DAILY_ATTENDANCE_RULES = {
    MIN_ATTENDANCE_PERCENTAGE: 0.5,
    PRESENT_STATUS_FOR_CALC: ['Hadir', 'Dispen'],
    EXCUSED_STATUS: ['Izin', 'Sakit'],
    UNEXCUSED_STATUS: ['Alpa']
};
```

### File: `server/config/exportConfig.js`

```javascript
export const STATUS_KEHADIRAN = {
    HADIR: ['H', 'Hadir', 'T', 'Terlambat', 'D', 'Dispen'],
    SAKIT: ['S', 'Sakit'],
    IZIN: ['I', 'Izin'],
    ALPHA: ['A', 'Alpha', 'Alpa', 'Tanpa Keterangan']
};

export const HARI_EFEKTIF = {
    GASAL: 95,    // Juli - Desember
    GENAP: 142,   // Januari - Juni
    TAHUNAN: 237  // Full year
};
```

---

## Catatan Penting

1. **Dispen = Hadir** - Jangan pernah hitung Dispen sebagai ketidakhadiran
2. **Terlambat = Flag** - Bukan status terpisah, tapi flag boolean
3. **Ada Tugas** - Guru tidak hadir tapi meninggalkan tugas (flag)
4. **Izin Tengah Hari** - Gunakan aturan 50% kehadiran
5. **Zona Waktu** - Semua perhitungan menggunakan WIB (Asia/Jakarta)

---

*Terakhir diperbarui: 2025-12-18*
