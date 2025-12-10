# 🐳 Tutorial Lengkap: Setup Docker Deployment

## 📋 Overview

Workflow ini akan:
1. Build Docker image dari code
2. Push ke Docker Hub
3. SSH ke server dan deploy container

---

## 🔑 Step 1: Buat Docker Hub Account & Token

### 1.1 Buat Account Docker Hub
1. Buka https://hub.docker.com
2. Klik **Sign Up** (atau **Sign In** jika sudah punya)
3. Catat **username** Anda

### 1.2 Buat Access Token
1. Klik **Account Settings** (icon avatar → Account Settings)
2. Pilih **Security** di sidebar kiri
3. Klik **New Access Token**
4. Isi:
   - **Access Token Description**: `absenta-github-actions`
   - **Access Permissions**: `Read, Write, Delete`
5. Klik **Generate**
6. **COPY TOKEN INI SEKARANG!** (tidak bisa dilihat lagi)

---

## 🔐 Step 2: Setup SSH Key di Server

### 2.1 Generate SSH Key (jika belum ada)
SSH ke server Anda, lalu jalankan:

```bash
# Cek apakah sudah ada key
ls -la ~/.ssh/

# Jika belum ada id_rsa, generate baru:
ssh-keygen -t rsa -b 4096 -C "github-actions"
# Tekan Enter 3x (gunakan default)

# Tambahkan ke authorized_keys
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 2.2 Copy Private Key
```bash
cat ~/.ssh/id_rsa
```

**Copy SEMUA output**, termasuk:
```
-----BEGIN RSA PRIVATE KEY-----
(isi key)
-----END RSA PRIVATE KEY-----
```

---

## ⚙️ Step 3: Tambahkan Secrets di GitHub

### 3.1 Buka Settings Repository
1. Buka: https://github.com/RaiKanaeru/absenta-13-v3
2. Klik **Settings** (tab paling kanan)
3. Di sidebar kiri: **Secrets and variables** → **Actions**
4. Klik **New repository secret**

### 3.2 Tambahkan Secrets Ini:

| Secret Name | Value | Contoh |
|-------------|-------|--------|
| `DOCKER_USERNAME` | Username Docker Hub | `raikanaeru` |
| `DOCKER_PASSWORD` | Token dari Step 1.2 | `dckr_pat_xxxxx...` |
| `SERVER_HOST` | IP atau domain server | `118.96.250.109` |
| `SSH_USER` | Username SSH | `root` |
| `SSH_PRIVATE_KEY` | Isi dari Step 2.2 | (paste semua termasuk BEGIN/END) |
| `DEPLOY_PATH` | Path folder di server | `/www/wwwroot/absenta13.my.id` |
| `SSH_PORT` | Port SSH (opsional) | `22` |

### 3.3 Cara Menambahkan Secret:
1. Klik **New repository secret**
2. Isi **Name**: (contoh: `DOCKER_USERNAME`)
3. Isi **Secret**: (contoh: `raikanaeru`)
4. Klik **Add secret**
5. Ulangi untuk semua secrets di tabel

---

## 📁 Step 4: Persiapan di Server

### 4.1 Pastikan Docker Terinstall
```bash
docker --version
docker-compose --version
```

Jika belum:
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4.2 Buat Folder & docker-compose.yml
```bash
mkdir -p /www/wwwroot/absenta13.my.id
cd /www/wwwroot/absenta13.my.id
```

Buat file `docker-compose.yml`:
```yaml
version: '3.8'

services:
  app:
    image: ${DOCKER_USERNAME}/absenta13:latest
    container_name: absenta13
    restart: unless-stopped
    ports:
      - "3001:3001"
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
      - ./backups:/app/backups
```

### 4.3 Buat file .env di server
```bash
nano .env
```

Isi dengan environment variables yang diperlukan (DB connection, dll)

---

## 🚀 Step 5: Re-run Workflow

### 5.1 Dari GitHub Actions
1. Buka: https://github.com/RaiKanaeru/absenta-13-v3/actions
2. Klik workflow yang gagal
3. Klik **Re-run all jobs**

### 5.2 Atau Push Baru
```bash
git commit --allow-empty -m "chore: trigger deploy"
git push
```

---

## ✅ Verifikasi Deployment

Setelah workflow selesai:

```bash
# Di server, cek container running
docker ps

# Cek logs
docker logs absenta13

# Test endpoint
curl http://localhost:3001/health
```

---

## ❓ Troubleshooting

### Error: "Username and password required"
✅ Pastikan `DOCKER_USERNAME` dan `DOCKER_PASSWORD` sudah ditambahkan

### Error: "Permission denied (publickey)"
✅ Pastikan `SSH_PRIVATE_KEY` lengkap termasuk BEGIN/END lines
✅ Pastikan public key sudah di `~/.ssh/authorized_keys`

### Error: "No such file or directory"
✅ Pastikan `DEPLOY_PATH` sudah dibuat di server

---

## 📊 Alur Deployment

```
Push ke main
    ↓
GitHub Actions: Build Docker Image
    ↓
Push ke Docker Hub
    ↓
SSH ke Server
    ↓
docker pull image
    ↓
docker-compose up -d
    ↓
✅ Deployment Complete!
```
