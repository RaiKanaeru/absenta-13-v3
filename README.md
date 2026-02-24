<p align="center">
  <img src="https://img.shields.io/github/v/release/RaiKanaeru/absenta-13-v3?style=for-the-badge&logo=github&label=Version" alt="Version" />
  <img src="https://img.shields.io/github/last-commit/RaiKanaeru/absenta-13-v3?style=for-the-badge&logo=git&logoColor=white" alt="Last Commit" />
  <img src="https://img.shields.io/github/license/RaiKanaeru/absenta-13-v3?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/github/actions/workflow/status/RaiKanaeru/absenta-13-v3/sonarcloud.yml?branch=main&style=for-the-badge&logo=github&label=CI" alt="CI Status" />
</p>

# ABSENTA 13 — Sistem Absensi Digital Modern

**Sistem Absensi Digital untuk Sekolah** dengan teknologi modern dan optimasi performa tinggi.  
Mendukung **150+ concurrent users**, multi-role (Admin, Guru, Siswa), dan deployment Docker-first.

<p align="center">
  <img src="https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white" alt="shadcn/ui" />
  <br/>
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

---

### Code Quality

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=RaiKanaeru_absenta-13-v3&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=RaiKanaeru_absenta-13-v3)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=RaiKanaeru_absenta-13-v3&metric=bugs)](https://sonarcloud.io/summary/new_code?id=RaiKanaeru_absenta-13-v3)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=RaiKanaeru_absenta-13-v3&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=RaiKanaeru_absenta-13-v3)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=RaiKanaeru_absenta-13-v3&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=RaiKanaeru_absenta-13-v3)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=RaiKanaeru_absenta-13-v3&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=RaiKanaeru_absenta-13-v3)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=RaiKanaeru_absenta-13-v3&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=RaiKanaeru_absenta-13-v3)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=RaiKanaeru_absenta-13-v3&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=RaiKanaeru_absenta-13-v3)

---

## 📋 Table of Contents

- [Fitur Utama](#-fitur-utama)
- [Screenshots](#-screenshots)
- [Architecture](#%EF%B8%8F-architecture-overview)
- [Quick Start](#-quick-start)
- [Development Commands](#%EF%B8%8F-development-commands)
- [Environment Variables](#-environment-variables)
- [Testing](#-testing)
- [Struktur Project](#%EF%B8%8F-struktur-project)
- [User Roles & Permissions](#-user-roles--permissions)
- [API Endpoints](#-api-endpoints)
- [Security Features](#%EF%B8%8F-security-features)
- [Deployment Guide](#-deployment-guide)
- [Performance](#-performance-specifications)
- [Monitoring & Maintenance](#-monitoring--maintenance)
- [Troubleshooting](#%EF%B8%8F-troubleshooting)
- [Production Checklist](#-production-checklist)
- [Contributing](#-contributing)

---

## 🚀 Fitur Utama

### 🎯 Core Features
- 🎯 **Dashboard Admin Modern** — Kelola semua data sekolah dengan analytics real-time
- 👨‍🏫 **Dashboard Guru** — Rekap kehadiran dan manajemen kelas dengan export Excel
- 👨‍🎓 **Dashboard Siswa** — Input kehadiran dan monitoring dengan notifikasi
- 📊 **Analytics Real-time** — Laporan kehadiran otomatis dengan caching
- 🔐 **Authentication** — Sistem login multi-role dengan JWT security
- 📱 **Responsive Design** — Optimal di semua device dengan PWA support

### ⚡ Performance Features
- 🚀 **High Performance** — Support 150+ concurrent users
- 💾 **Redis Caching** — Response time < 2s untuk data cached
- 🔄 **Queue System** — Background processing untuk download Excel
- 📊 **Real-time Monitoring** — System metrics dan performance tracking
- 🛡️ **Security System** — Rate limiting, input validation, audit logging
- 🛡️ **Disaster Recovery** — Automated backup dan recovery procedures

---

## 📸 Screenshots

> **Coming soon** — Screenshot dashboard admin, guru, dan siswa akan ditambahkan di sini.
>
> Untuk melihat aplikasi secara langsung, jalankan project dengan `npm run dev:full` dan buka `http://localhost:5173`.

<!-- Uncomment dan ganti path ketika screenshot sudah tersedia:
<p align="center">
  <img src="docs/screenshots/admin-dashboard.png" width="45%" alt="Admin Dashboard" />
  <img src="docs/screenshots/teacher-dashboard.png" width="45%" alt="Teacher Dashboard" />
</p>
-->

---

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

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 atau lebih baru)
- **npm** atau **yarn**
- **MySQL** (v8.0 atau lebih baru) — standalone atau via Docker
- **Redis** (v6.0 atau lebih baru) — standalone atau via Docker

### Installation

1. **Clone atau download project ini**
```bash
git clone https://github.com/RaiKanaeru/absenta-13-v3.git
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

---

## 🛠️ Development Commands

| Task | Command | Deskripsi |
|------|---------|-----------|
| Start Dev | `npm run dev:full` | Jalankan Backend (3001) + Frontend (5173) sekaligus |
| Backend Only | `npm run start:modern` | Jalankan server Node.js saja |
| Frontend Only | `npm run dev` | Jalankan Vite dev server saja |
| Build | `npm run build` | Build frontend untuk production |
| Lint | `npm run lint` | Jalankan ESLint |
| Test | `npm test` | Jalankan semua test |

---

<details>
<summary><h2>🔐 Environment Variables</h2></summary>

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

</details>

---

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

---

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

---

## 👥 User Roles & Permissions

| Role | Fitur Utama |
|------|-------------|
| 🛡️ **Admin** | Dashboard analytics, kelola data guru/siswa/kelas/jadwal, export Excel, monitoring, backup, security logs |
| 👨‍🏫 **Guru** | Input & kelola kehadiran siswa, lihat jadwal, export Excel, rekap kehadiran |
| 👨‍🎓 **Siswa** | Input kehadiran mandiri, lihat riwayat, ajukan banding, notifikasi real-time |

---

<details>
<summary><h2>🔧 API Endpoints</h2></summary>

### Authentication
- `POST /api/login` — User login
- `POST /api/logout` — User logout
- `GET /api/verify-token` — Verify JWT token

### Admin Endpoints
- `GET /api/admin/dashboard-stats` — Dashboard analytics (cached)
- `GET /api/admin/system-metrics` — System performance metrics
- `GET /api/admin/load-balancer-stats` — Load balancer statistics
- `GET /api/admin/security-stats` — Security system statistics
- `GET /api/admin/disaster-recovery-status` — Disaster recovery status

### Backup & Recovery
- `POST /api/admin/create-semester-backup` — Create backup
- `GET /api/admin/backup-list` — List backups
- `POST /api/admin/archive-old-data` — Archive old data

### Queue System
- `POST /api/guru/request-excel-download` — Request Excel download
- `GET /api/guru/download-status/:jobId` — Check download status
- `GET /api/downloads/:filename` — Download file

</details>

---

<details>
<summary><h2>🛡️ Security Features</h2></summary>

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
- **No hardcoded secrets** — semua dari environment variables

</details>

---

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

<details>
<summary>Alternatif: Manual Deployment dengan PM2</summary>

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

</details>

---

## 📊 Performance Specifications

### 🎯 Target Performance
| Metric | Target |
|--------|--------|
| Concurrent Users | 150+ users |
| Database Records | 250K+ records |
| Response Time | < 2s (cached), < 5s (uncached) |
| Memory Usage | < 1.8GB |
| Database Query | < 100ms |
| Uptime | 99.9% |

### 📈 Actual Performance
| Metric | Result |
|--------|--------|
| Login Success Rate | 91.3% (137/150 users) |
| Average Response Time | 10.6s (login), 2-9ms (queries) |
| Memory Usage | 60.3% |
| CPU Usage | 11.0% |
| Cache Hit Ratio | High untuk dashboard data |
| Load Balancer | 183 requests processed |

---

## 📊 Monitoring & Maintenance

<details>
<summary>System Monitoring</summary>

- **Real-time Metrics** — Memory, CPU, Disk usage
- **Performance Tracking** — Response times, request counts
- **Alert System** — Threshold-based notifications
- **Health Checks** — Automated system health monitoring

</details>

<details>
<summary>Database Maintenance</summary>

- **Automated Backups** — Daily backups dengan retention
- **Index Optimization** — Automatic index maintenance
- **Query Performance** — Slow query monitoring
- **Archive Management** — Old data archiving

</details>

<details>
<summary>Security Monitoring</summary>

- **Rate Limiting** — Request throttling
- **Input Validation** — SQL injection & XSS protection
- **Audit Logging** — Security event tracking
- **IP Blocking** — Suspicious activity blocking

</details>

---

## 🛠️ Troubleshooting

<details>
<summary>Docker Issues</summary>

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

</details>

<details>
<summary>Server Not Starting</summary>

```bash
# Check port availability
netstat -an | findstr :3001

# Check Redis connection
redis-cli ping

# Check MySQL connection
mysql -u root -p
```

</details>

<details>
<summary>Performance Issues</summary>

```bash
# Check system metrics
curl http://localhost:3001/api/admin/system-metrics

# Check load balancer stats
curl http://localhost:3001/api/admin/load-balancer-stats

# Check cache stats
curl http://localhost:3001/api/admin/queue-stats
```

</details>

<details>
<summary>Database Issues</summary>

```bash
# Check connection pool
curl http://localhost:3001/api/admin/system-metrics

# Check query performance
# Monitor logs for slow queries

# Restart database optimization
# Restart server (node server/index.js)
```

</details>

---

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

---

## 🤝 Contributing

1. Fork project ini
2. Buat branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

---

## 📞 Support

Untuk bantuan dan pertanyaan:
- **GitHub Issues**: [Create Issue](https://github.com/RaiKanaeru/absenta-13-v3/issues)
- **Documentation**: Lihat folder `docs/`

---

## 📝 License

Copyright © 2025 ABSENTA Team. All rights reserved.

---

<p align="center">
  <strong>ABSENTA 13</strong> — Sistem Absensi Digital Modern dengan Performa Tinggi untuk Sekolah Indonesia 🇮🇩
  <br/><br/>
  <img src="https://img.shields.io/badge/Status-Production_Ready-brightgreen?style=flat-square" />
  <img src="https://img.shields.io/badge/Users-150+_Concurrent-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Security-Enterprise_Grade-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/Uptime-99.9%25_Target-purple?style=flat-square" />
</p>
