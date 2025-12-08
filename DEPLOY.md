# � ABSENTA 13 - Docker Deployment Guide

Panduan lengkap untuk deploy ABSENTA 13 menggunakan Docker di aaPanel atau server Linux.

## 📋 Arsitektur Container

```
┌─────────────────────────────────────────────────────────────┐
│                         NGINX                                │
│                    (Reverse Proxy)                           │
│                    Port: 80, 443                             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                    ABSENTA-APP                               │
│                 (Node.js + PM2)                              │
│                    Port: 3001                                │
└───────────────┬─────────────────────┬───────────────────────┘
                │                     │
┌───────────────┴───────┐   ┌─────────┴────────────────────┐
│        MYSQL          │   │          REDIS               │
│    (Database)         │   │        (Cache)               │
│    Port: 3306         │   │       Port: 6379             │
└───────────────────────┘   └──────────────────────────────┘
```

## 📁 Struktur File Docker

```
absenta13.my.id/
├── docker/
│   ├── mysql/
│   │   ├── conf/my.cnf          # MySQL configuration
│   │   └── init/01-init-db.sh   # Database initialization
│   ├── redis/
│   │   └── redis.conf           # Redis configuration
│   └── nginx/
│       ├── conf.d/absenta.conf  # Nginx site config
│       └── ssl/                 # SSL certificates
├── Dockerfile                   # App container build
├── docker-compose.yml           # All services definition
├── docker.sh                    # Helper script
├── .env.docker.example          # Environment template
└── .dockerignore                # Build exclusions
```

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/RaiKanaeru/absenta-13-v3.git
cd absenta-13-v3
```

### 2. Setup Environment

```bash
# Copy template
cp .env.docker.example .env

# Edit dan isi password
nano .env
```

**Wajib diisi di `.env`:**
```env
DB_PASSWORD=password_database_anda
MYSQL_ROOT_PASSWORD=password_root_mysql
JWT_SECRET=secret_jwt_minimal_64_karakter
```

### 3. Start Containers

```bash
# Buat executable
chmod +x docker.sh

# Start semua container
./docker.sh start
```

### 4. Verifikasi

```bash
# Cek status
./docker.sh status

# Cek health
./docker.sh health

# Lihat logs
./docker.sh logs
```

---

## 📖 Command Reference

| Command | Deskripsi |
|---------|-----------|
| `./docker.sh start` | Build dan start semua container |
| `./docker.sh stop` | Stop semua container |
| `./docker.sh restart` | Restart semua container |
| `./docker.sh rebuild` | Rebuild app container saja |
| `./docker.sh logs [service]` | Lihat logs (default: app) |
| `./docker.sh status` | Status dan resource usage |
| `./docker.sh shell [service]` | Masuk ke shell container |
| `./docker.sh db shell` | Masuk MySQL shell |
| `./docker.sh db backup` | Backup database |
| `./docker.sh db restore <file>` | Restore database |
| `./docker.sh tools` | Start Adminer & Redis Commander |
| `./docker.sh update` | Pull code & rebuild |
| `./docker.sh clean` | Hapus semua container & volume |
| `./docker.sh health` | Cek kesehatan container |

---

## 🔧 Konfigurasi aaPanel

### Setup Reverse Proxy

1. Buka **aaPanel** → **Website** → **Add Site**
2. Domain: `absenta13.my.id`
3. Buka konfigurasi site → **Reverse Proxy**
4. Tambah:
   - **Proxy Name:** `absenta`
   - **Target URL:** `http://127.0.0.1:80`
   - **Enable:** ✅

### Setup SSL

1. Buka **aaPanel** → **Website** → pilih site
2. **SSL** → **Let's Encrypt** → Apply
3. Copy certificate ke folder docker:
```bash
cp /www/server/panel/vhost/ssl/absenta13.my.id/* ./docker/nginx/ssl/
```
4. Uncomment HTTPS server di `docker/nginx/conf.d/absenta.conf`

---

## 🛠 Admin Tools (Opsional)

```bash
# Start admin tools
./docker.sh tools
```

Akses:
- **Adminer (Database):** http://localhost:8080
- **Redis Commander:** http://localhost:8081

---

## 🔄 Update Aplikasi

```bash
# Pull code terbaru dan rebuild
./docker.sh update

# Atau manual:
git pull origin main
./docker.sh rebuild
```

---

## 💾 Backup & Restore

### Backup Database

```bash
# Backup
./docker.sh db backup
# Output: backups/backup_20251208_153000.sql
```

### Restore Database

```bash
./docker.sh db restore backups/backup_20251208_153000.sql
```

### Backup Volumes

```bash
# Backup semua data
docker run --rm \
  -v absenta13_mysql_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar cvf /backup/mysql_data.tar /data
```

---

## 🔍 Troubleshooting

### Container tidak start

```bash
# Lihat logs detail
docker-compose logs --tail=100 absenta-app

# Cek konfigurasi
docker-compose config
```

### Database connection error

```bash
# Cek MySQL running
docker-compose ps mysql

# Test koneksi
docker-compose exec mysql mysql -u absenta -p -e "SELECT 1"
```

### Port sudah digunakan

```bash
# Cek port
netstat -tlnp | grep -E "(80|3001|3306)"

# Ubah port di docker-compose.yml
ports:
  - "3002:3001"  # Ganti host port
```

### Reset password MySQL

```bash
docker-compose exec mysql mysql -u root -p << EOF
ALTER USER 'absenta'@'%' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
EOF
```

---

## 📊 Resource Requirements

| Service | CPU | Memory | Storage |
|---------|-----|--------|---------|
| App | 2 cores | 2 GB | 1 GB |
| MySQL | 2 cores | 1 GB | 5 GB |
| Redis | 1 core | 512 MB | 1 GB |
| Nginx | 0.5 core | 256 MB | 100 MB |
| **Total** | **5.5 cores** | **3.8 GB** | **7 GB** |

**Minimum Server:** 2 vCPU, 4 GB RAM, 20 GB SSD
