# ABSENTA 13 - Server Deployment Guide

## Ringkasan Deployment

Stack deployment menggunakan Docker Compose dengan 4 services:
- **nginx**: Frontend (port 8080) - serves React SPA
- **app**: Backend Node.js (port 3001) - Express API
- **mysql**: Database (internal) - MySQL 8.0
- **redis**: Cache (internal) - Redis 7

---

## Prasyarat Server

1. **OS**: Ubuntu 20.04+ atau Debian 11+
2. **Docker**: Docker Engine 20.10+
3. **Docker Compose**: v2.0+
4. **RAM**: Minimum 2GB (4GB recommended)
5. **Storage**: 10GB+ untuk app + logs + backups

Install Docker (Ubuntu):
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

---

## Langkah Deploy

### 1. Upload Project ke Server

```bash
# Option A: Git clone
git clone https://github.com/YOUR_REPO/absenta13.my.id.git
cd absenta13.my.id

# Option B: Upload via SCP
scp -r ./absenta13.my.id user@server:/home/user/
```

### 2. Setup Environment

```bash
# Copy dan edit .env
cp .env.example .env
nano .env

# WAJIB GANTI:
# - DB_PASSWORD (ganti dari default)
# - JWT_SECRET (generate random 64 char)
# - MYSQL_ROOT_PASSWORD
```

Generate JWT Secret:
```bash
openssl rand -hex 32
```

### 3. Build & Run dengan Docker Compose

```bash
# Build semua images
docker-compose build

# Start semua services
docker-compose up -d

# Cek status
docker-compose ps
docker-compose logs -f
```

### 4. Verifikasi

```bash
# Check health endpoint
curl http://localhost:3001/api/health

# Check frontend
curl http://localhost:8080
```

---

## SSL/HTTPS dengan Cloudflare (Recommended)

1. Domain pointing ke server IP via Cloudflare
2. Set Cloudflare SSL mode: **Full**
3. Nginx tetap listen port 80, Cloudflare handle SSL

Atau gunakan certbot:
```bash
sudo apt install certbot
sudo certbot certonly --webroot -w /path/to/dist -d absenta13.my.id
```

---

## Database Management

### Backup Database
```bash
docker exec absenta13-mysql mysqldump -u absenta -p absenta13 > backup.sql
```

### Restore Database
```bash
docker exec -i absenta13-mysql mysql -u absenta -p absenta13 < backup.sql
```

### Access MySQL Shell
```bash
docker exec -it absenta13-mysql mysql -u absenta -p
```

---

## Useful Commands

```bash
# Lihat logs backend
docker-compose logs -f app

# Restart services
docker-compose restart

# Stop semua
docker-compose down

# Rebuild dan restart
docker-compose up -d --build

# Check disk usage
docker system df

# Cleanup unused images
docker system prune -a
```

---

## Ports yang Digunakan

| Service | Internal | External |
|---------|----------|----------|
| nginx | 80 | 8080 |
| app | 3001 | 3001 |
| mysql | 3306 | - |
| redis | 6379 | - |

---

## Troubleshooting

### App tidak start
```bash
docker-compose logs app
# Check: DB connection, file permissions
```

### Database connection error
```bash
docker-compose logs mysql
# Pastikan mysql sehat sebelum app start
docker-compose restart app
```

### Frontend 502 Bad Gateway
```bash
# Backend belum ready
docker-compose restart nginx
```

---

## Credentials Default

> ⚠️ **GANTI SEBELUM PRODUCTION!**

| User | Password | Role |
|------|----------|------|
| admin | admin | Administrator |
| guru1 | password | Guru |
| siswa1 | password | Siswa |

---

## Monitoring

Akses monitoring dashboard:
- URL: `http://your-domain:8080/admin/monitoring`
- Login sebagai admin

---

## Update Deployment

```bash
cd /path/to/absenta13.my.id

# Pull latest
git pull origin main

# Rebuild dan restart
docker-compose up -d --build
```
