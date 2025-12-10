# � Manual Deploy Guide (Zero Trust Network)

Server ini menggunakan Zero Trust Network, jadi auto-deploy via SSH tidak tersedia.

## Setelah Push ke GitHub

Setiap kali Anda push code ke `main`, GitHub Actions akan:
1. ✅ Build Docker image
2. ✅ Push ke Docker Hub (`raikanaeru/absenta13:latest`)

## Deploy Manual ke Server

SSH ke server Anda, lalu jalankan:

```bash
cd /www/wwwroot/absenta13.my.id
docker-compose pull
docker-compose down && docker-compose up -d
```

## Verifikasi Deployment

```bash
# Cek container running
docker ps

# Cek logs aplikasi
docker logs absenta13-app --tail 50

# Test endpoint
curl http://localhost:3001/api/health
```

---

> 💡 **Tip:** Bookmark perintah deploy di atas. Jalankan setiap kali ada update code.
