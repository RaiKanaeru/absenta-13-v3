# 🔄 Panduan Setup Deployment (Fresh Start - PEM Format)

Error `ssh: no key found` terjadi karena format key terlalu baru. Kita harus pakai format **Legacy (PEM)**.

## 1️⃣ Di Server (Terminal)
Jalankan perintah ini (Copy-Paste semua):

```bash
# 1. Hapus kunci lama yang bermasalah
rm -f ~/.ssh/github_actions*

# 2. Generate Key Baru dengan Format PEM (PENTING: -m PEM)
ssh-keygen -t rsa -b 4096 -m PEM -f ~/.ssh/github_actions -N ""

# 3. Pasang Key ke Authorized Keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# 4. Tampilkan Private Key (COPY KODE INI)
cat ~/.ssh/github_actions
```

> ⚠️ **CEK FORMATNYA:**
> Hasilnya HARUS diawali: `-----BEGIN RSA PRIVATE KEY-----`
> (Jika diawali `-----BEGIN OPENSSH...` berarti SALAH, ulangi langkah 2 pakai `-m PEM`)

---

## 2️⃣ Di GitHub (Settings)
Update Secret `SSH_PRIVATE_KEY` dengan isi yang baru tadi (`-----BEGIN RSA...`).

---

## 3️⃣ Trigger Deploy
Re-run job actions. Pasti berhasil! 🚀
