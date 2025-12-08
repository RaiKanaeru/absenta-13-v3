# 🚀 Panduan Deploy ABSENTA 13 di aaPanel dengan Docker

## Prasyarat

- aaPanel terinstall
- Docker dan Docker Compose terinstall di server
- Akses SSH ke server

---

## Opsi 1: Deploy dengan Docker Compose (Recommended)

### Step 1: Clone/Update Repository

```bash
# SSH ke server
ssh user@server-ip

# Masuk ke direktori website
cd /www/wwwroot/absenta13.my.id

# Pull kode terbaru
git pull origin main
```

### Step 2: Setup Environment Variables

```bash
# Copy template environment
cp .env.docker.example .env

# Edit file .env sesuai konfigurasi
nano .env
```

**Isi .env:**
```
DB_HOST=mysql
DB_PORT=3306
DB_USER=absenta
DB_PASSWORD=password_anda
DB_NAME=absenta13
MYSQL_ROOT_PASSWORD=root_password_anda
JWT_SECRET=secret_jwt_anda
REDIS_HOST=redis
REDIS_PORT=6379
```

### Step 3: Build dan Run

```bash
# Build dan jalankan semua service
docker-compose up -d --build

# Cek status container
docker-compose ps

# Lihat logs
docker-compose logs -f absenta-app
```

### Step 4: Setup Reverse Proxy di aaPanel

1. Buka aaPanel → **Website** → **Add Site**
2. Domain: `absenta13.my.id`
3. Buka konfigurasi site → **Reverse Proxy** → Add:
   - Proxy Name: `absenta-backend`
   - Target URL: `http://127.0.0.1:3001`
   - Enable: ✅

---

## Opsi 2: Deploy Tanpa Docker (Menggunakan PM2)

Jika server sudah ada MySQL dan Redis native:

### Step 1: Update Kode

```bash
cd /www/wwwroot/absenta13.my.id
git pull origin main
```

### Step 2: Install Dependencies & Build

```bash
npm install --legacy-peer-deps
npm run build
```

### Step 3: Jalankan dengan PM2

```bash
# Stop PM2 jika sudah berjalan
pm2 stop absenta-backend

# Start dengan konfigurasi production
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup startup otomatis
pm2 startup
```

---

## Opsi 3: aaPanel Docker Manager

Jika menggunakan Docker Manager plugin di aaPanel:

1. Buka aaPanel → **Docker** → **Compose**
2. Upload file `docker-compose.yml` dan `.env`
3. Klik **Deploy**
4. Setup reverse proxy seperti Opsi 1 Step 4

---

## Verifikasi Deployment

```bash
# Cek container berjalan
docker ps

# Test endpoint API
curl http://localhost:3001/api/health

# Cek logs
docker-compose logs absenta-app
```

---

## Troubleshooting

### Container tidak start
```bash
docker-compose logs absenta-app
```

### Database connection error
```bash
# Pastikan MySQL container berjalan
docker-compose ps mysql

# Cek koneksi
docker exec -it absenta13-mysql mysql -u absenta -p
```

### Port sudah digunakan
```bash
# Cek port yang digunakan
netstat -tulpn | grep 3001

# Ubah port di docker-compose.yml jika perlu
```
