# 📘 Panduan Deployment ke AAPanel

## 🔍 Analisis Masalah yang Telah Diperbaiki

### Masalah Utama
Saat hosting ke AAPanel, frontend memanggil API ke domain yang salah:
- **Error**: `GET https://absenta13.my.id/api/verify 404 (Not Found)`
- **Penyebab**: Frontend menggunakan relative path `/api/*` yang selalu request ke domain yang sama dengan frontend
- **Solusi**: Semua hardcoded fetch telah diganti menggunakan `getApiUrl()` yang membaca `VITE_API_BASE_URL`

### File yang Telah Diperbaiki
1. ✅ `src/pages/Index_Modern.tsx` - Login, verify, logout
2. ✅ `src/components/StudentDashboard_Modern.tsx` - Submit kehadiran
3. ✅ `src/components/DisasterRecoveryView.tsx` - Backup management
4. ✅ `src/components/MonitoringDashboard.tsx` - Monitoring API
5. ✅ `src/components/SimpleRestoreView.tsx` - Restore backup
6. ✅ `src/components/ReportLetterheadSettings.tsx` - Upload logo
7. ✅ `src/services/jadwalService.ts` - Jadwal API calls
8. ✅ `src/components/InitLetterheadButton.tsx` - Init letterhead
9. ✅ `src/components/SimpleLetterheadInit.tsx` - Init letterhead
10. ✅ `src/config/api.ts` - Improved fallback untuk production

---

## 📋 Langkah-Langkah Deployment

### 1. Persiapan Environment Variables

#### A. File `.env.production` (untuk build frontend)
Pastikan file `.env.production` ada di root project dengan isi:
```env
VITE_API_BASE_URL=https://api.absenta13.my.id
```

#### B. File `.env` (untuk backend)
Pastikan file `.env` ada di root project dengan isi:
```env
NODE_ENV=production
PORT=3001
API_BASE_URL=https://api.absenta13.my.id
ALLOWED_ORIGINS=https://absenta13.my.id,https://www.absenta13.my.id
# ... konfigurasi database dan lainnya
```

### 2. Build Frontend dengan Environment Variable

**PENTING**: Saat build, Vite akan membaca `.env.production` dan menggabungkan `VITE_API_BASE_URL` ke dalam bundle.

```bash
# Build dengan mode production
npm run build

# Atau secara eksplisit
NODE_ENV=production npm run build
```

**Verifikasi**: Setelah build, cek file `dist/assets/index-*.js` dan pastikan ada string `api.absenta13.my.id` di dalamnya.

### 3. Setup Backend di PM2

Di AAPanel, setup PM2 dengan:
- **Command**: `node server_modern.js`
- **Working Directory**: Root folder project (F:\absenta13.my.id)
- **Environment**: Production (gunakan `.env` atau set di PM2)

**PM2 Ecosystem Config** (opsional, jika menggunakan `ecosystem.config.js`):
```javascript
{
  name: 'absenta-backend',
  script: 'server_modern.js',
  cwd: '/path/to/project',
  env: {
    NODE_ENV: 'production',
    PORT: 3001,
    API_BASE_URL: 'https://api.absenta13.my.id'
  }
}
```

### 4. Setup Subdomain di AAPanel

#### A. Backend (api.absenta13.my.id)
1. Di AAPanel, buat **Node App** atau **PM2 App**
2. **Domain**: `api.absenta13.my.id`
3. **Port**: `3001` (atau port yang digunakan backend)
4. **Root**: Root folder project (F:\absenta13.my.id)
5. **Startup File**: `server_modern.js`

#### B. Frontend (absenta13.my.id)
1. Di AAPanel, buat **Website** baru
2. **Domain**: `absenta13.my.id`
3. **Root**: Folder `dist` dari build (F:\absenta13.my.id\dist)
4. **PHP Version**: Tidak perlu (static files)
5. **SSL**: Aktifkan SSL untuk HTTPS

### 5. Konfigurasi Nginx (Otomatis oleh AAPanel)

AAPanel biasanya sudah mengatur Nginx. Pastikan:

#### Backend (api.absenta13.my.id)
```nginx
server {
    listen 80;
    server_name api.absenta13.my.id;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Frontend (absenta13.my.id)
```nginx
server {
    listen 80;
    server_name absenta13.my.id;
    root /path/to/project/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 6. Verifikasi Deployment

#### A. Cek Backend
```bash
# Test endpoint backend
curl https://api.absenta13.my.id/api/verify
```

#### B. Cek Frontend
1. Buka browser ke `https://absenta13.my.id`
2. Buka **Developer Console** (F12)
3. Cek **Network Tab**
4. Pastikan semua request API pergi ke `https://api.absenta13.my.id/api/*`
5. Tidak ada error 404 untuk `/api/verify`

#### C. Debugging
Jika masih ada masalah:
1. **Cek Console Browser**: Lihat error di console
2. **Cek Network Tab**: Lihat URL yang dipanggil
3. **Cek Build**: Pastikan `VITE_API_BASE_URL` ter-build dengan benar
4. **Cek Environment**: Pastikan `.env.production` ada dan benar

---

## 🔧 Troubleshooting

### Masalah: Frontend masih request ke absenta13.my.id/api/*
**Solusi**:
1. Pastikan build menggunakan `.env.production` dengan `VITE_API_BASE_URL=https://api.absenta13.my.id`
2. Rebuild frontend: `npm run build`
3. Clear cache browser
4. Cek file `dist/assets/index-*.js` apakah ada string `api.absenta13.my.id`

### Masalah: CORS Error
**Solusi**:
1. Pastikan `ALLOWED_ORIGINS` di `.env` backend mencakup `https://absenta13.my.id`
2. Restart backend setelah mengubah `.env`

### Masalah: 404 Not Found di Backend
**Solusi**:
1. Pastikan PM2 running: `pm2 list`
2. Cek log PM2: `pm2 logs absenta-backend`
3. Pastikan port backend sesuai dengan konfigurasi Nginx
4. Test backend langsung: `curl http://localhost:3001/api/verify`

### Masalah: SSL Certificate Error
**Solusi**:
1. Aktifkan SSL di AAPanel untuk kedua domain
2. Pastikan certificate valid untuk `absenta13.my.id` dan `api.absenta13.my.id`
3. Gunakan Let's Encrypt atau certificate yang valid

---

## 📝 Checklist Deployment

- [ ] File `.env.production` ada dengan `VITE_API_BASE_URL=https://api.absenta13.my.id`
- [ ] File `.env` ada dengan konfigurasi backend yang benar
- [ ] Frontend sudah di-build dengan `npm run build`
- [ ] Folder `dist` berisi file build yang benar
- [ ] PM2 running dengan `node server_modern.js`
- [ ] Subdomain `api.absenta13.my.id` mengarah ke backend
- [ ] Domain `absenta13.my.id` mengarah ke folder `dist`
- [ ] SSL aktif untuk kedua domain
- [ ] CORS dikonfigurasi dengan benar
- [ ] Test API endpoint berhasil
- [ ] Test frontend berhasil login

---

## 🎯 Kesimpulan

Masalah utama sudah diperbaiki dengan:
1. ✅ Mengganti semua hardcoded `/api/*` dengan `getApiUrl('/api/*')`
2. ✅ Menambahkan fallback production di `api.ts`
3. ✅ Membuat `.env.production` untuk build
4. ✅ Dokumentasi deployment lengkap

**PENTING**: Setiap kali rebuild frontend, pastikan:
- File `.env.production` ada dan benar
- Build menggunakan command yang benar
- Clear cache browser setelah deploy

