# CORS Troubleshooting Guide - Absenta 13

## Daftar Isi

1. [Pengenalan CORS](#1-pengenalan-cors)
2. [Arsitektur CORS di Absenta 13](#2-arsitektur-cors-di-absenta-13)
3. [Error CORS Umum dan Solusinya](#3-error-cors-umum-dan-solusinya)
4. [Debugging CORS](#4-debugging-cors)
5. [Konfigurasi CORS](#5-konfigurasi-cors)
6. [Checklist Troubleshooting](#6-checklist-troubleshooting)
7. [Quick Fix Commands](#7-quick-fix-commands)

---

## 1. Pengenalan CORS

### Apa itu CORS?

**Cross-Origin Resource Sharing (CORS)** adalah mekanisme keamanan browser yang membatasi request HTTP lintas domain. Ketika frontend di `https://absenta13.my.id` mencoba mengakses API di `https://api.absenta13.my.id`, browser akan melakukan pengecekan CORS.

### Flow Request CORS

```
[Browser @ absenta13.my.id]
        |
        v
[1] Preflight OPTIONS Request (jika diperlukan)
        |
        v
[2] Server merespons dengan CORS Headers
        |
        v
[3] Browser memeriksa headers
        |
        +-- Jika VALID --> Request asli dikirim
        +-- Jika INVALID --> Request DIBLOKIR, error muncul di console
```

### Kapan Preflight Diperlukan?

Preflight (OPTIONS request) diperlukan jika:
- Method bukan GET/HEAD/POST
- Ada custom headers (Authorization, Content-Type: application/json)
- Content-Type bukan text/plain, multipart/form-data, atau application/x-www-form-urlencoded

**Absenta 13 SELALU membutuhkan preflight** karena menggunakan `Authorization` header dan `Content-Type: application/json`.

---

## 2. Arsitektur CORS di Absenta 13

### 2.1 Flow Request Production

```
[Browser @ https://absenta13.my.id]
        |
        v
[Cloudflare/CDN] (opsional)
        |
        v
[Nginx @ Docker]
        |
        +-- location /api/* --> proxy ke http://app:3001
        |
        v
[Node.js Backend @ port 3001]
        |
        +-- Manual CORS Middleware (server_modern.js:155-203)
        |
        +-- Route Handlers
        |
        v
[Response dengan CORS Headers]
```

### 2.2 Komponen yang Menangani CORS

| Komponen | File | Fungsi |
|----------|------|--------|
| **Node.js CORS Middleware** | `server_modern.js:155-203` | Handler UTAMA CORS |
| **Nginx** | `docker/nginx/default.conf` | Proxy & backup CORS |
| **Allowed Origins Config** | `.env` → `ALLOWED_ORIGINS` | Daftar origin yang diizinkan |

### 2.3 CORS Headers yang Digunakan

| Header | Nilai | Fungsi |
|--------|-------|--------|
| `Access-Control-Allow-Origin` | Origin requester (dynamic) | Mengizinkan origin tertentu |
| `Access-Control-Allow-Methods` | `GET, POST, PUT, DELETE, OPTIONS, PATCH` | Methods yang diizinkan |
| `Access-Control-Allow-Headers` | `Content-Type, Authorization, X-Requested-With, Accept, Origin` | Headers yang diizinkan |
| `Access-Control-Allow-Credentials` | `true` | Mengizinkan cookies/auth |
| `Access-Control-Expose-Headers` | `Content-Disposition` | Headers yang bisa diakses JS |
| `Access-Control-Max-Age` | `86400` (24 jam) | Cache preflight |

---

## 3. Error CORS Umum dan Solusinya

### Error 1: No 'Access-Control-Allow-Origin' header present

```
Access to fetch at 'https://api.absenta13.my.id/api/verify' from origin 
'https://absenta13.my.id' has been blocked by CORS policy: No 
'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Kemungkinan Penyebab:**

| # | Penyebab | Cara Cek | Solusi |
|---|----------|----------|--------|
| 1 | Origin tidak ada di ALLOWED_ORIGINS | Cek `.env` | Tambahkan origin ke `ALLOWED_ORIGINS` |
| 2 | Server Node.js crash sebelum CORS middleware | Cek log server | Fix error startup |
| 3 | Nginx tidak forward request ke Node.js | Cek nginx error log | Fix nginx config |
| 4 | Cloudflare/proxy menghapus headers | Test bypass CDN | Konfigurasi CDN |

**Quick Fix:**
```bash
# 1. Cek apakah origin sudah ada di config
grep "absenta13.my.id" .env

# 2. Pastikan ALLOWED_ORIGINS berisi origin yang benar
# .env atau .env.production
ALLOWED_ORIGINS=https://absenta13.my.id,https://www.absenta13.my.id,https://api.absenta13.my.id

# 3. Restart server
docker-compose restart app
```

---

### Error 2: Response to preflight request doesn't pass access control check

```
Access to fetch at 'https://api.absenta13.my.id/api/login' from origin 
'https://absenta13.my.id' has been blocked by CORS policy: Response to 
preflight request doesn't pass access control check
```

**Kemungkinan Penyebab:**

| # | Penyebab | Cara Cek | Solusi |
|---|----------|----------|--------|
| 1 | OPTIONS request tidak ditangani | Test OPTIONS manual | Pastikan OPTIONS handler ada |
| 2 | Nginx menghandle OPTIONS tapi mengembalikan error | Cek nginx log | Fix nginx OPTIONS handling |
| 3 | Headers tidak lengkap | Inspect response headers | Tambahkan headers yang kurang |

**Quick Fix:**
```bash
# Test preflight manual
curl -X OPTIONS https://api.absenta13.my.id/api/login \
  -H "Origin: https://absenta13.my.id" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v

# Respons yang BENAR harus memiliki:
# - HTTP/2 204 atau 200
# - Access-Control-Allow-Origin: https://absenta13.my.id
# - Access-Control-Allow-Methods: POST
# - Access-Control-Allow-Headers: Content-Type, Authorization
```

---

### Error 3: The value of 'Access-Control-Allow-Origin' header must not be wildcard '*'

```
The value of the 'Access-Control-Allow-Origin' header in the response must 
not be the wildcard '*' when the request's credentials mode is 'include'.
```

**Penyebab:** Menggunakan `credentials: 'include'` di frontend tapi backend mengirim `Access-Control-Allow-Origin: *`

**Solusi:** Backend HARUS mengirim origin spesifik, bukan wildcard.

```javascript
// SALAH
res.header('Access-Control-Allow-Origin', '*');

// BENAR
res.header('Access-Control-Allow-Origin', req.headers.origin);
```

**Status di Absenta 13:** ✅ Sudah benar (dynamic origin)

---

### Error 4: Duplicate CORS Headers

**Gejala:** Response memiliki header CORS duplikat:
```
Access-Control-Allow-Origin: https://absenta13.my.id
Access-Control-Allow-Origin: https://absenta13.my.id
```

**Penyebab:** Nginx DAN Node.js sama-sama menambahkan CORS headers.

**Solusi:** Hapus CORS dari salah satu (rekomenasi: hapus dari Nginx, biarkan Node.js yang handle).

Lihat bagian [5.2 Nginx Configuration](#52-nginx-configuration-production).

---

### Error 5: net::ERR_FAILED

```
api.absenta13.my.id/api/login:1 Failed to load resource: net::ERR_FAILED
```

**Kemungkinan Penyebab:**

| # | Penyebab | Cara Cek | Solusi |
|---|----------|----------|--------|
| 1 | Server down | `curl https://api.absenta13.my.id/api/health` | Start server |
| 2 | DNS tidak resolve | `nslookup api.absenta13.my.id` | Fix DNS |
| 3 | SSL certificate error | Buka URL di browser baru | Renew SSL |
| 4 | Firewall blocking | `telnet api.absenta13.my.id 443` | Buka port |

---

## 4. Debugging CORS

### 4.1 Endpoint Debug CORS (Built-in)

Absenta 13 memiliki endpoint khusus untuk debug CORS:

```bash
# Test CORS dengan endpoint debug
curl -X GET "https://api.absenta13.my.id/api/health" \
  -H "Origin: https://absenta13.my.id" \
  -v 2>&1 | grep -i "access-control"
```

### 4.2 Cek CORS Headers di Browser

1. Buka **DevTools** (F12)
2. Pergi ke tab **Network**
3. Lakukan request yang gagal
4. Klik request tersebut
5. Lihat **Response Headers**

**Headers yang harus ada:**
- `Access-Control-Allow-Origin: https://absenta13.my.id`
- `Access-Control-Allow-Credentials: true`

### 4.3 Test Preflight Manual

```bash
#!/bin/bash
# Script: test-cors.sh

API_URL="https://api.absenta13.my.id"
ORIGIN="https://absenta13.my.id"

echo "=== Testing CORS Preflight ==="
curl -X OPTIONS "${API_URL}/api/login" \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v 2>&1 | grep -E "(< HTTP|< access-control|< Access-Control)"

echo ""
echo "=== Testing Actual Request ==="
curl -X GET "${API_URL}/api/health" \
  -H "Origin: ${ORIGIN}" \
  -v 2>&1 | grep -E "(< HTTP|< access-control|< Access-Control)"
```

### 4.4 Cek Log Server untuk CORS

```bash
# Cek log CORS di server
docker-compose logs app --lines 100 | grep -i "cors"

# Atau jika menggunakan Docker
docker logs absenta-app 2>&1 | grep -i "cors"
```

**Log yang menunjukkan CORS blocked:**
```
[CORS BLOCKED] Origin not allowed: https://unknown-domain.com
[CORS BLOCKED] Allowed origins: https://absenta13.my.id, https://www.absenta13.my.id
```

**Log yang menunjukkan CORS OK:**
```
[CORS] Preflight OK for origin: https://absenta13.my.id
```

---

## 5. Konfigurasi CORS

### 5.1 Environment Variables (.env)

```bash
# ===========================================
# CORS CONFIGURATION
# ===========================================
# Pisahkan dengan koma, TANPA spasi
ALLOWED_ORIGINS=https://absenta13.my.id,https://www.absenta13.my.id,https://api.absenta13.my.id

# Untuk development, tambahkan:
# ALLOWED_ORIGINS=https://absenta13.my.id,https://www.absenta13.my.id,https://api.absenta13.my.id,http://localhost:5173,http://localhost:3000
```

### 5.2 Nginx Configuration (Production)

**PENTING:** Untuk menghindari duplicate headers, pilih SATU tempat untuk CORS:

**Opsi A: CORS di Node.js saja (Recommended)**

```nginx
# docker/nginx/default.conf
location /api/ {
    # JANGAN tambahkan CORS headers di sini
    # Biarkan backend yang handle
    
    proxy_pass http://app:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Origin $http_origin;  # Forward origin header
}
```

**Opsi B: CORS di Nginx saja**

Jika memilih opsi ini, HAPUS CORS middleware di `server_modern.js` dan gunakan:

```nginx
location /api/ {
    # Handle preflight
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' $http_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PATCH' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With, Accept, Origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Max-Age' '86400' always;
        return 204;
    }
    
    # CORS untuk semua response
    add_header 'Access-Control-Allow-Origin' $http_origin always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
    proxy_pass http://app:3001;
    # ... proxy settings
}
```

### 5.3 Node.js CORS Middleware

Lokasi: `server_modern.js` lines 155-203

```javascript
// CORS Middleware - Menangani semua CORS logic
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const cleanOrigin = origin ? origin.replace(/\/$/, '') : null;
    
    const isAllowed = !origin || 
                      allowedOrigins.includes(origin) || 
                      allowedOrigins.includes(cleanOrigin) ||
                      allowedOrigins.includes('*');

    if (isAllowed && origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        res.header('Access-Control-Expose-Headers', 'Content-Disposition');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Max-Age', '86400');
    }
    
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    
    next();
});
```

---

## 6. Checklist Troubleshooting

Gunakan checklist ini saat menghadapi error CORS:

### Step 1: Verifikasi Konfigurasi

- [ ] Origin ada di `ALLOWED_ORIGINS` di `.env`?
- [ ] Server Node.js running (`docker-compose ps` atau `docker ps`)?
- [ ] Nginx running dan proxy berfungsi?

### Step 2: Test Endpoint

```bash
# Test health endpoint
curl -v https://api.absenta13.my.id/api/health

# Test dengan Origin header
curl -v https://api.absenta13.my.id/api/health \
  -H "Origin: https://absenta13.my.id"
```

- [ ] Response status 200?
- [ ] Ada `Access-Control-Allow-Origin` header?
- [ ] Value header sesuai dengan origin request?

### Step 3: Test Preflight

```bash
curl -X OPTIONS https://api.absenta13.my.id/api/login \
  -H "Origin: https://absenta13.my.id" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

- [ ] Response status 204 atau 200?
- [ ] Ada semua CORS headers?

### Step 4: Cek Logs

```bash
# PM2
docker-compose logs app --lines 50 | grep -i cors

# Docker
docker logs absenta-app 2>&1 | tail -50 | grep -i cors
```

- [ ] Ada log `[CORS BLOCKED]`?
- [ ] Ada error lain sebelum CORS middleware?

### Step 5: Browser Test

- [ ] Clear browser cache (Ctrl+Shift+Del)
- [ ] Disable browser extensions
- [ ] Test di Incognito mode
- [ ] Test di browser lain

---

## 7. Quick Fix Commands

### Menambah Origin Baru

```bash
# 1. Edit .env
nano .env

# 2. Tambahkan origin ke ALLOWED_ORIGINS
ALLOWED_ORIGINS=https://absenta13.my.id,https://www.absenta13.my.id,https://api.absenta13.my.id,https://new-domain.com

# 3. Restart server
docker-compose restart app
# atau
docker-compose restart app
```

### Reset CORS Cache Browser

```bash
# Browser akan cache preflight selama 24 jam
# Untuk force refresh:

# 1. Di DevTools, klik kanan tombol Refresh
# 2. Pilih "Empty Cache and Hard Reload"

# Atau di Chrome:
# 1. DevTools > Network > Disable cache (centang)
# 2. Refresh halaman
```

### Emergency: Allow All Origins (HANYA DEVELOPMENT!)

```bash
# .env - JANGAN gunakan di production!
ALLOWED_ORIGINS=*

# Restart server
docker-compose restart app
```

### Verify CORS Working

```bash
# One-liner test
curl -s -o /dev/null -w "%{http_code}" \
  -H "Origin: https://absenta13.my.id" \
  https://api.absenta13.my.id/api/health && echo " - OK"
```

---

## Appendix: CORS Error Decision Tree

```
ERROR CORS MUNCUL
       |
       v
[1] Apakah server bisa diakses?
    curl https://api.absenta13.my.id/api/health
       |
       +-- TIDAK --> Fix server (DNS, SSL, firewall, crash)
       |
       +-- YA
           |
           v
[2] Apakah ada Access-Control-Allow-Origin header?
    curl -v -H "Origin: https://absenta13.my.id" ...
       |
       +-- TIDAK --> Cek CORS middleware (server_modern.js)
       |             Cek nginx config (jika pakai nginx)
       |
       +-- YA
           |
           v
[3] Apakah value header sesuai origin request?
       |
       +-- TIDAK --> Tambahkan origin ke ALLOWED_ORIGINS
       |
       +-- YA (tapi masih error)
           |
           v
[4] Cek apakah ada duplicate headers
    Cek apakah credentials mode conflict dengan wildcard
    Cek preflight response (OPTIONS method)
```

---

## Kontak & Bantuan

Jika masih mengalami masalah CORS setelah mengikuti panduan ini:

1. Cek logs server untuk error spesifik
2. Sertakan output curl dengan flag -v
3. Sertakan screenshot DevTools Network tab

---

## Appendix B: CORS Error Codes Reference

Server Absenta 13 menggunakan error codes spesifik untuk membantu debugging. Error codes ini muncul di:
- Response header `X-CORS-Error-Code`
- Server logs
- Response body untuk preflight yang diblock
- Debug endpoint `/api/debug/cors`

### Daftar Error Codes

| Code | Title | Description | Severity | Fix |
|------|-------|-------------|----------|-----|
| **CORS_001** | Origin Not Whitelisted | Request origin tidak ada di allowed origins list | ERROR | Tambahkan origin ke `ALLOWED_ORIGINS` di `.env` |
| **CORS_002** | Missing Origin Header | Request tidak memiliki Origin header | INFO | Normal untuk server-to-server requests |
| **CORS_003** | Preflight Failed | OPTIONS preflight request ditolak | ERROR | Cek apakah origin whitelisted dan OPTIONS handler ada |
| **CORS_004** | Credentials Conflict | Tidak bisa menggunakan credentials dengan wildcard (*) origin | ERROR | Gunakan origin spesifik, bukan wildcard |
| **CORS_005** | Missing CORS Headers | Response tidak memiliki CORS headers | ERROR | Cek middleware order - CORS middleware harus jalan pertama |
| **CORS_006** | Duplicate CORS Headers | Multiple Access-Control-Allow-Origin headers terdeteksi | WARNING | Hapus CORS headers dari nginx jika backend handle CORS |
| **CORS_007** | Method Not Allowed | HTTP method tidak ada di Access-Control-Allow-Methods | ERROR | Tambahkan method ke allowed methods list |
| **CORS_008** | Header Not Allowed | Request header tidak ada di Access-Control-Allow-Headers | ERROR | Tambahkan header ke allowed headers list |
| **CORS_009** | SSL/Protocol Mismatch | Origin protocol (http/https) tidak match | ERROR | Pastikan frontend dan API menggunakan protocol yang sama |
| **CORS_010** | Subdomain Mismatch | Variasi subdomain tidak di-whitelist | ERROR | Tambahkan semua variasi subdomain ke ALLOWED_ORIGINS |

### Cara Menggunakan Error Codes

**1. Cek via Debug Endpoint:**
```bash
curl https://api.absenta13.my.id/api/debug/cors \
  -H "Origin: https://your-domain.com"
```

Response akan berisi:
```json
{
  "status": "blocked",
  "summary": {
    "origin": "https://your-domain.com",
    "allowed": false,
    "errorCode": "CORS_001",
    "errorTitle": "Origin Not Whitelisted",
    "fix": "Add the origin to ALLOWED_ORIGINS in .env file"
  },
  "diagnostic": {
    "checks": [
      {"check": "Exact Origin Match", "passed": false},
      {"check": "Clean Origin Match", "passed": false},
      {"check": "Wildcard Match", "passed": false}
    ],
    "suggestions": [
      "Add \"https://your-domain.com\" to ALLOWED_ORIGINS in .env file",
      "Format: ALLOWED_ORIGINS=https://domain1.com,https://domain2.com",
      "Restart server after changing .env: docker-compose restart app"
    ]
  }
}
```

**2. Test Origin Spesifik:**
```bash
curl "https://api.absenta13.my.id/api/debug/cors/test?origin=https://example.com"
```

**3. Cek Response Headers:**
```bash
curl -v https://api.absenta13.my.id/api/health \
  -H "Origin: https://blocked-domain.com" 2>&1 | grep -i "x-cors"

# Output jika blocked:
# X-CORS-Status: blocked
# X-CORS-Error-Code: CORS_001
# X-CORS-Fix: Add the origin to ALLOWED_ORIGINS in .env file
```

**4. Cek Server Logs:**
```bash
docker-compose logs app --lines 100 | grep "CORS"

# Output example:
# ╔══════════════════════════════════════════════════════════════╗
# ║                    CORS ERROR DETECTED                       ║
# ╠══════════════════════════════════════════════════════════════╣
# ║ Error Code: CORS_001                                         ║
# ║ Error: Origin Not Whitelisted                                ║
# ║ Severity: ERROR                                              ║
# ╠══════════════════════════════════════════════════════════════╣
# ║ Origin: https://blocked-domain.com                           ║
# ║ Method: GET                                                  ║
# ╠══════════════════════════════════════════════════════════════╣
# ║ Suggested Fixes:                                             ║
# ║   → Add "https://blocked-domain.com" to ALLOWED_ORIGINS      ║
# ╚══════════════════════════════════════════════════════════════╝
```

### Quick Fix per Error Code

| Error Code | Quick Fix Command |
|------------|-------------------|
| CORS_001 | `echo 'ALLOWED_ORIGINS=...,https://new-origin.com' >> .env && docker-compose restart app` |
| CORS_006 | Edit `docker/nginx/default.conf`, hapus `add_header 'Access-Control-*'` lines |
| CORS_009 | Ganti `http://` ke `https://` di ALLOWED_ORIGINS atau sebaliknya |
| CORS_010 | Tambahkan `https://www.domain.com,https://domain.com` ke ALLOWED_ORIGINS |

---

*Dokumentasi ini dibuat: Januari 2026*
*Last updated: Januari 2026*
