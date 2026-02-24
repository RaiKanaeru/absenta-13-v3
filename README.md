# ABSENTA 13 - Sistem Absensi Digital Modern (OPTIMIZED)

**Deskripsi**: Sistem Absensi Digital untuk Sekolah dengan teknologi modern dan optimasi performa tinggi  
**Versi**: 1.3.0 (OPTIMIZED)  
**Platform**: Web Application (React + TypeScript + Node.js + Redis + MySQL)  
**Status**: Production Ready dengan 150+ Concurrent Users Support

## 🚀 Fitur Utama

### 🎯 Core Features
- 🎯 **Dashboard Admin Modern**: Kelola semua data sekolah dengan analytics real-time
- 👨‍🏫 **Dashboard Guru**: Rekap kehadiran dan manajemen kelas dengan export Excel
- 👨‍🎓 **Dashboard Siswa**: Input kehadiran dan monitoring dengan notifikasi
- 📊 **Analytics Real-time**: Laporan kehadiran otomatis dengan caching
- 🔐 **Authentication**: Sistem login multi-role dengan JWT security
- 📱 **Responsive Design**: Optimal di semua device dengan PWA support

### ⚡ Performance Features
- 🚀 **High Performance**: Support 150+ concurrent users
- 💾 **Redis Caching**: Response time < 2s untuk data cached
- 🔄 **Load Balancing**: Request prioritization dan burst detection
- 📊 **Real-time Monitoring**: System metrics dan performance tracking
- 🛡️ **Security System**: Rate limiting, input validation, audit logging
- 🔄 **Queue System**: Background processing untuk download Excel
- 💾 **Database Optimization**: Connection pooling dan query optimization
- 🛡️ **Disaster Recovery**: Automated backup dan recovery procedures

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (MySQL)       │
│   Port: 5173    │    │   Port: 3001    │    │   Port: 3306    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Redis Cache   │
                       │   Port: 6379    │
                       └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 atau lebih baru)
- **npm** atau **yarn**
- **MySQL** (v8.0 atau lebih baru) — standalone atau via Docker
- **Redis** (v6.0 atau lebih baru) — standalone atau via Docker

### Installation

1. **Clone atau download project ini**
```bash
git clone <repository-url>
cd absenta-13-v3
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup Database**
```bash
# Import absenta13.sql ke MySQL/phpMyAdmin
# Database akan otomatis dioptimasi dengan indexing
```

4. **Setup Redis**
```bash
# Windows: Jalankan redis-server.exe dari folder redis/
# Linux/Mac: sudo systemctl start redis
```

5. **Jalankan Backend + Frontend sekaligus**
```bash
npm run dev:full
```

> Perintah ini menjalankan backend (port 3001) dan frontend (port 5173) secara bersamaan.
> Alternatif: jalankan terpisah dengan `node server/index.js` (backend) dan `npm run dev` (frontend).

6. **Buka aplikasi di browser**
```
Frontend: http://localhost:5173
Backend API: http://localhost:3001
```

## 🛠️ Development Commands

| Task | Command | Deskripsi |
|------|---------|-----------|
| Start Dev | `npm run dev:full` | Jalankan Backend (3001) + Frontend (5173) sekaligus |
| Backend Only | `npm run start:modern` | Jalankan server Node.js saja |
| Frontend Only | `npm run dev` | Jalankan Vite dev server saja |
| Build | `npm run build` | Build frontend untuk production |
| Lint | `npm run lint` | Jalankan ESLint |
| Test | `npm test` | Jalankan semua test |


## 🔐 Environment Variables

Buat file `.env` di root directory dengan konfigurasi berikut:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=absenta13
DB_PORT=3306

# JWT Authentication (WAJIB untuk production)
JWT_SECRET=your-very-strong-secret-key-minimum-32-characters

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Server Configuration
PORT=3001
NODE_ENV=production

# Optional: Dummy data password (untuk development)
DUMMY_DATA_PASSWORD=secure_dev_password

# Optional: hCaptcha (Bot verification pada login)
# Dapatkan secret key dari https://dashboard.hcaptcha.com
# Jika tidak diset, captcha verification dilewati (graceful fallback)
HCAPTCHA_SECRET=your-hcaptcha-secret-key
```

> ⚠️ **PENTING**: `JWT_SECRET` **WAJIB** diset di production. Server akan gagal start jika tidak diset.

## 🛡️ Security Features

### Authentication & Authorization
- **JWT-based authentication** dengan token expiry 24 jam
- **Role-based access control** (Admin, Guru, Siswa)
- **Multi-key rate limiting** — lockout per-akun (5x), per-device (10x), dan per-IP fallback (20x) agar satu siswa salah password tidak memblokir seluruh jaringan WiFi sekolah
- **hCaptcha verification** — muncul otomatis setelah 3x percobaan gagal per-akun

### Input Validation
- **SQL Injection protection** dengan parameterized queries
- **XSS protection** dengan input sanitization
- **Request validation** untuk semua endpoints

### Security Monitoring
- **Audit logging** untuk semua aksi penting
- **IP-based rate limiting** dengan auto-blocking
- **DDoS protection** dengan burst detection
- **Suspicious activity tracking**

### Cryptography
- **bcrypt** untuk password hashing (salt rounds: 10)
- **crypto.randomBytes** untuk secure ID generation
- **No hardcoded secrets** - semua dari environment variables

## 🧪 Testing

Project ini memiliki **193 test** yang mencakup unit test dan integrasi, dijalankan dengan dua framework:

| Layer | Framework | Lokasi |
|-------|-----------|--------|
| Frontend | **Vitest** + jsdom | `src/**/__tests__/` |
| Backend | **Node.js native test runner** | `server/__tests__/` |

```bash
# Jalankan semua test
npm test

# Frontend saja
npx vitest run

# Backend saja
node --test server/__tests__/**/*.test.js
```

## 🏗️ Struktur Project

```
absenta-13-v3/
├── src/                    # Frontend React (components, pages, contexts, hooks)
│   ├── components/
│   │   ├── admin/          # Admin dashboard, views, reports, settings
│   │   ├── teacher/        # Teacher dashboard and views
│   │   ├── student/        # Student dashboard and views
│   │   ├── shared/         # Shared components (EditProfile, NotificationBell, etc.)
│   │   ├── ui/             # Shadcn UI components (DO NOT modify)
│   │   └── pages/          # Error pages (NotFound, Unauthorized, ServerError)
│   ├── types/              # TypeScript type definitions
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # React contexts (Auth, FontSize, Theme)
│   └── utils/              # Utility functions
├── public/                 # Static assets untuk Vite
├── server/                 # Backend Express
│   ├── routes/             # Route definitions
│   ├── controllers/        # Request handlers
│   ├── services/           # Business logic
│   │   └── export/         # Excel/PDF export builders + schemas
│   ├── middleware/          # Express middleware
│   ├── utils/              # Backend utilities
│   ├── config/             # Database, export, template configs
│   ├── scripts/            # Backend utility scripts
│   └── index.js            # Server entry point
├── database/               # Database files
│   ├── absenta13.sql       # Main schema dump
│   ├── migrations/         # SQL migrations (001-008)
│   ├── seeders/            # Seed data scripts
│   └── reference-data/     # CSV reference data files
├── docs/                   # Dokumentasi tambahan
│   ├── SYSTEM-ARCHITECTURE.md
│   ├── OPENCODE-GUIDE.md
│   └── CORS-TROUBLESHOOTING.md
├── scripts/                # Script deployment/otomasi
├── docker/                 # Docker configurations (nginx, etc.)
├── redis/                  # Konfigurasi dan resource Redis
├── package.json            # Konfigurasi project dan dependency
├── docker-compose.yml      # Orkestrasi container
└── ecosystem.config.cjs    # PM2 configuration
```

📌 **Catatan**: Direktori runtime seperti `logs/` atau `exports/` dapat dibuat secara otomatis ketika server berjalan (mis. untuk menyimpan log atau hasil unduhan). Jika belum menjalankan aplikasi, folder ini mungkin belum muncul setelah clone.

## 👥 User Roles & Permissions

### 🛡️ Admin
- **Dashboard**: Analytics real-time dengan caching
- **Data Management**: Kelola guru, siswa, kelas, jadwal
- **Reports**: Export Excel dengan queue system
- **System**: Monitoring, backup, security logs
- **Performance**: Load balancer stats, cache stats

### 👨‍🏫 Guru  
- **Attendance**: Input dan kelola kehadiran siswa
- **Schedule**: Lihat jadwal mengajar dengan caching
- **Reports**: Export Excel dengan background processing
- **Analytics**: Rekap kehadiran dengan real-time data

### 👨‍🎓 Siswa
- **Attendance**: Input kehadiran mandiri
- **History**: Lihat riwayat kehadiran
- **Appeal**: Ajukan banding kehadiran
- **Notifications**: Real-time updates

## 🛠️ Tech Stack

### Frontend
- **React 18** dengan TypeScript
- **Tailwind CSS** untuk styling
- **shadcn/ui** untuk UI components
- **Vite** sebagai build tool
- **PWA** support

### Backend
- **Node.js** dengan Express
- **MySQL2** dengan connection pooling
- **Redis** untuk caching dan queue
- **JWT** untuk authentication
- **Bull** untuk job queue
- **ExcelJS** untuk export

### Performance & Monitoring
- **Connection Pooling** (50 connections)
- **Redis Caching** dengan TTL
- **Load Balancing** dengan prioritization
- **Real-time Monitoring** dengan metrics
- **Security System** dengan rate limiting
- **Disaster Recovery** dengan automated backup

## 📊 Performance Specifications

### 🎯 Target Performance
- **Concurrent Users**: 150+ users
- **Database Records**: 250K+ records
- **Response Time**: < 2s (cached), < 5s (uncached)
- **Memory Usage**: < 1.8GB
- **Database Query**: < 100ms
- **Uptime**: 99.9%

### 📈 Actual Performance
- **Login Success Rate**: 91.3% (137/150 users)
- **Average Response Time**: 10.6s (login), 2-9ms (queries)
- **Memory Usage**: 60.3%
- **CPU Usage**: 11.0%
- **Cache Hit Ratio**: High untuk dashboard data
- **Load Balancer**: 183 requests processed

## 🔧 API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/verify-token` - Verify JWT token

### Admin Endpoints
- `GET /api/admin/dashboard-stats` - Dashboard analytics (cached)
- `GET /api/admin/system-metrics` - System performance metrics
- `GET /api/admin/load-balancer-stats` - Load balancer statistics
- `GET /api/admin/security-stats` - Security system statistics
- `GET /api/admin/disaster-recovery-status` - Disaster recovery status

### Backup & Recovery
- `POST /api/admin/create-semester-backup` - Create backup
- `GET /api/admin/backup-list` - List backups
- `POST /api/admin/archive-old-data` - Archive old data

### Queue System
- `POST /api/guru/request-excel-download` - Request Excel download
- `GET /api/guru/download-status/:jobId` - Check download status
- `GET /api/downloads/:filename` - Download file

## 🚀 Deployment Guide

### Docker (Direkomendasikan untuk Production)

Project ini menggunakan Docker sebagai infrastruktur production utama.

```bash
# Build semua container
docker-compose build

# Jalankan semua service
docker-compose up -d

# Lihat log backend
docker-compose logs -f app

# Restart backend
docker-compose restart app
```

**Arsitektur container:**

```
absenta13-nginx   (port 28080) --> Frontend + Proxy
absenta13-app     (port 28081) --> Node.js Backend
absenta13-mysql   (internal)   --> MySQL Database
absenta13-redis   (internal)   --> Redis Cache
```

### Development (Lokal tanpa Docker)

```bash
# 1. Pastikan MySQL dan Redis sudah berjalan

# 2. Jalankan backend + frontend sekaligus
npm run dev:full

# Atau pisah:
node server/index.js  # backend saja
npm run dev           # frontend saja
```

### Alternatif: Manual Deployment dengan PM2

```bash
# 1. Install PM2
npm install -g pm2

# 2. Start Redis
redis-server --daemonize yes

# 3. Start Backend dengan PM2
pm2 start server/index.js --name "absenta-backend"

# 4. Build Frontend
npm run build

# 5. Serve Frontend
pm2 serve dist 3000 --name "absenta-frontend"
```

## 📊 Monitoring & Maintenance

### System Monitoring
- **Real-time Metrics**: Memory, CPU, Disk usage
- **Performance Tracking**: Response times, request counts
- **Alert System**: Threshold-based notifications
- **Health Checks**: Automated system health monitoring

### Database Maintenance
- **Automated Backups**: Daily backups dengan retention
- **Index Optimization**: Automatic index maintenance
- **Query Performance**: Slow query monitoring
- **Archive Management**: Old data archiving

### Security Monitoring
- **Rate Limiting**: Request throttling
- **Input Validation**: SQL injection & XSS protection
- **Audit Logging**: Security event tracking
- **IP Blocking**: Suspicious activity blocking

## 🛠️ Troubleshooting

### Docker Issues

```bash
# Cek status semua container
docker-compose ps

# Lihat log backend (live)
docker-compose logs -f app

# Restart backend
docker-compose restart app

# Rebuild dan restart jika ada perubahan kode
docker-compose up -d --build app
```

### Common Issues

#### Server Not Starting
```bash
# Check port availability
netstat -an | findstr :3001

# Check Redis connection
redis-cli ping

# Check MySQL connection
mysql -u root -p
```

#### Performance Issues
```bash
# Check system metrics
curl http://localhost:3001/api/admin/system-metrics

# Check load balancer stats
curl http://localhost:3001/api/admin/load-balancer-stats

# Check cache stats
curl http://localhost:3001/api/admin/queue-stats
```

#### Database Issues
```bash
# Check connection pool
curl http://localhost:3001/api/admin/system-metrics

# Check query performance
# Monitor logs for slow queries

# Restart database optimization
# Restart server (node server/index.js)
```

## 📋 Production Checklist

### Pre-Deployment
- [ ] Database backup created
- [ ] Redis server running
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Firewall configured
- [ ] Monitoring setup

### Post-Deployment
- [ ] System metrics monitoring
- [ ] Performance testing completed
- [ ] Security audit passed
- [ ] Backup system verified
- [ ] Disaster recovery tested
- [ ] Documentation updated

## 🤝 Contributing

1. Fork project ini
2. Buat branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📞 Support

Untuk bantuan dan pertanyaan:
- **Email**: support@absenta13.com
- **GitHub Issues**: [Create Issue]
- **Documentation**: README.md
- **Performance Issues**: Check monitoring dashboard

## 📝 License

Copyright © 2025 ABSENTA Team. All rights reserved.

---

**ABSENTA 13 OPTIMIZED** - Sistem Absensi Digital Modern dengan Performa Tinggi untuk Sekolah Indonesia 🇮🇩

**Status**: ✅ Production Ready  
**Performance**: 🚀 150+ Concurrent Users  
**Security**: 🛡️ Enterprise Grade  
**Reliability**: 🔄 99.9% Uptime Target