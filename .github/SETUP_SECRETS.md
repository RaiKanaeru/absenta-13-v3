# 🚀 Setup GitHub Actions Auto-Deploy

Panduan untuk mengaktifkan auto-deploy ABSENTA 13.

## 📋 Langkah Setup

### 1. Tambahkan Secrets di GitHub

Buka: **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Nilai | Contoh |
|------------|-------|--------|
| `SERVER_HOST` | IP/hostname server | `103.xxx.xxx.xxx` atau `absenta13.my.id` |
| `SSH_USER` | Username SSH | `root` atau `www` |
| `SSH_PRIVATE_KEY` | Private key SSH (isi lengkap) | isi dari `~/.ssh/id_rsa` |
| `DEPLOY_PATH` | Path folder website | `/www/wwwroot/absenta13.my.id` |

### 2. Buat SSH Key (jika belum ada)

**Di komputer lokal:**
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy"
```

**Copy public key ke server:**
```bash
ssh-copy-id -i ~/.ssh/id_rsa.pub user@server-ip
```

**Copy isi private key untuk secret:**
```bash
cat ~/.ssh/id_rsa
# Copy SEMUA output (termasuk -----BEGIN RSA PRIVATE KEY-----)
```

### 3. Test Deploy

Setelah secrets ditambahkan:
1. Push code ke branch `main`
2. Buka **GitHub → Actions** untuk melihat progress
3. Atau trigger manual: **Actions → Deploy → Run workflow**

## 🔧 Workflows yang Dibuat

| File | Fungsi |
|------|--------|
| `.github/workflows/deploy.yml` | Auto-deploy ke server via SSH |
| `.github/workflows/docker-build.yml` | Build & push Docker image |

## ⚙️ Cara Kerja

```
Push to main → Build frontend → SSH to server → Pull code → Restart PM2/Docker
```
