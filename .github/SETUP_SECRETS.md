# Setup Secrets untuk Docker Deploy

Buka: **GitHub Repo → Settings → Secrets and variables → Actions**

## Secrets yang Diperlukan

| Secret | Nilai | Contoh |
|--------|-------|--------|
| `DOCKER_USERNAME` | Username Docker Hub | `raikanaeru` |
| `DOCKER_PASSWORD` | Password/Token Docker Hub | `dckr_pat_xxxxx` |
| `SERVER_HOST` | IP/hostname server | `118.96.250.109` |
| `SSH_USER` | Username SSH | `root` |
| `SSH_PRIVATE_KEY` | Isi dari `~/.ssh/id_rsa` | (lihat bawah) |
| `DEPLOY_PATH` | Path folder di server | `/www/wwwroot/absenta13.my.id` |
| `SSH_PORT` | Port SSH (opsional) | `22` |

## Cara Dapat SSH Private Key

Di server:

```bash
cat ~/.ssh/id_rsa
```

Copy semua output termasuk `-----BEGIN RSA PRIVATE KEY-----`

## Cara Dapat Docker Hub Token

1. Buka https://hub.docker.com/settings/security
2. Klik "New Access Token"
3. Beri nama, copy token

## Alur Deploy

```
Push ke main → Build Docker image → Push ke Docker Hub → SSH ke server → docker-compose up
```
