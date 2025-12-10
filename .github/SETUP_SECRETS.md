# � Panduan Setup Deployment (Fresh Start)

Jika Auto-Deploy gagal, ikuti **3 langkah** ini untuk reset konfigurasi.

## 1️⃣ Di Server (Terminal)
Jalankan perintah ini untuk membuat folder & SSH Key baru:

```bash
# 1. Buat folder project
mkdir -p /www/wwwroot/absenta13.my.id

# 2. Generate SSH Key baru (tekan Enter terus sampai selesai)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions -N ""

# 3. Pasang Key agar valid
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 4. Tampilkan Private Key (COPY KODE INI)
cat ~/.ssh/github_actions
```

> ⚠️ **PENTING:** Copy semua isi mulai dari `-----BEGIN OPENSSH PRIVATE KEY-----` sampai `-----END OPENSSH PRIVATE KEY-----`.

---

## 2️⃣ Di GitHub (Settings)
Buka [Settings > Secrets > Actions](https://github.com/RaiKanaeru/absenta-13-v3/settings/secrets/actions) dan hapus secrets lama, lalu buat baru:

| Name | Value (Isi) |
| :--- | :--- |
| `SERVER_HOST` | `103.127.132.89` |
| `SSH_USER` | `root` |
| `SSH_PRIVATE_KEY` | *(Paste Key yang tadi di-copy dari Langkah 1)* |
| `DOCKER_USERNAME` | `raikanaeru` |
| `DOCKER_PASSWORD` | *(Token Docker Hub Anda)* |

---

## 3️⃣ Trigger Deploy Ulang
Setelah secrets diisi:
1. Masuk ke menu **Actions** di GitHub.
2. Pilih workflow yang gagal (merah).
3. Klik tombol **Re-run jobs** 🔄.

---

### ✅ Checklist Manual (Jika Auto Gagal)
Jika masih error, gunakan cara manual ini di server:
```bash
cd /www/wwwroot/absenta13.my.id
docker-compose pull
docker-compose down && docker-compose up -d
```
