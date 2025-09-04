# ABSENTA 13 - Sistem Absensi Digital Modern

**Deskripsi**: Sistem Absensi Digital untuk Sekolah dengan teknologi modern  
**Versi**: 1.3.0  
**Platform**: Web Application (React + TypeScript + Node.js)

## 📋 Fitur Utama

- 🎯 **Dashboard Admin Modern**: Kelola semua data sekolah
- 👨‍🏫 **Dashboard Guru**: Rekap kehadiran dan manajemen kelas  
- 👨‍🎓 **Dashboard Siswa**: Input kehadiran dan monitoring
- 📊 **Analytics Real-time**: Laporan kehadiran otomatis
- 🔐 **Authentication**: Sistem login multi-role
- 📱 **Responsive Design**: Optimal di semua device

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 atau lebih baru)
- npm atau yarn
- XAMPP/server PHP (untuk backend)

### Installation

1. **Clone atau download project ini**

2. **Install dependencies**
```bash
npm install
```

3. **Setup Database**
```bash
# Import database_update.sql ke MySQL/phpMyAdmin
# Sesuaikan konfigurasi database di server_modern.js
```

4. **Jalankan Backend Server**
```bash
node server_modern.js
```

5. **Jalankan Frontend**
```bash
npm run dev
```

6. **Buka aplikasi di browser**
```
http://localhost:5173
```

## 🏗️ Struktur Project

```
absenta/
├── public/              # Assets statis (logo, favicon, dll)
├── src/
│   ├── components/      # React Components
│   │   ├── AdminDashboard_Modern.tsx
│   │   ├── TeacherDashboard_Modern.tsx
│   │   ├── StudentDashboard_Modern.tsx
│   │   └── ui/          # UI Components
│   ├── pages/           # Halaman utama
│   ├── hooks/           # Custom hooks
│   └── lib/             # Utilities
├── server_modern.js     # Backend API server
├── database_update.sql  # Database schema
└── package.json         # Project configuration
```

## 👥 User Roles

### 🛡️ Admin
- Kelola data guru, siswa, kelas
- Lihat laporan kehadiran lengkap
- Manajemen sistem

### 👨‍🏫 Guru  
- Input dan kelola kehadiran siswa
- Lihat jadwal mengajar
- Proses banding kehadiran

### 👨‍🎓 Siswa
- Input kehadiran mandiri
- Lihat riwayat kehadiran
- Ajukan banding kehadiran

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: MySQL
- **Build Tool**: Vite
- **UI Components**: Radix UI, Lucide React

## 📱 Screenshots

*(Tambahkan screenshots disini)*

## 🤝 Contributing

1. Fork project ini
2. Buat branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📞 Support

Untuk bantuan dan pertanyaan:
- Email: support@absenta13.com
- GitHub Issues: [Create Issue]

## 📝 License

Copyright © 2025 ABSENTA Team. All rights reserved.

---

**ABSENTA 13** - Sistem Absensi Digital Modern untuk Sekolah Indonesia 🇮🇩
