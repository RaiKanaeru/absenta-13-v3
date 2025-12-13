---
description: Development guidelines dan endpoint conventions untuk Absenta 13
---

# ABSENTA 13 Development Guidelines

## 📂 Project Structure

```
server/
├── routes/          # API route definitions (24 files)
├── controllers/     # Business logic handlers
├── services/        # Reusable services (export, email, etc)
├── middleware/      # Auth, error handling, rate limiting
├── config/          # Configuration files (exportConfig.js, etc)
├── templates/       # Excel templates for export
└── utils/           # Helper functions (timeUtils, errorHandler)

src/                 # React frontend (TypeScript)
├── components/      # React components
├── services/        # API service calls
└── hooks/           # Custom React hooks
```

---

## 🔗 API Endpoint Conventions

### Base URL Structure
```
/api/{role}/{resource}         # Role-specific endpoints
/api/admin/{resource}          # Admin only
/api/guru/{resource}           # Guru only
/api/siswa/{resource}          # Siswa only
/api/{resource}                # General endpoints (auth, etc)
```

### CRUD Operations
```
GET    /api/admin/{resource}          # List all
GET    /api/admin/{resource}/:id      # Get by ID
POST   /api/admin/{resource}          # Create
PUT    /api/admin/{resource}/:id      # Update
DELETE /api/admin/{resource}/:id      # Delete
```

### Export Endpoints
```
GET /api/admin/export/{report-name}   # Download Excel
GET /api/export/{report-name}         # Alternative path
```

**Template Export Routes (templateExportRoutes.js):**
- `/api/admin/export/rekap-kelas-gasal?kelas_id=X`
- `/api/admin/export/rekap-guru-tahunan`
- `/api/admin/export/rekap-guru-mingguan`
- `/api/admin/export/jadwal-matrix`
- `/api/admin/export/jadwal-grid`
- `/api/admin/export/jadwal-pelajaran`

---

## ⚠️ CRITICAL RULES

### 1. Frontend-Backend Sync
> **SELALU cek frontend sebelum membuat endpoint baru!**
```javascript
// Cari endpoint yang dipanggil frontend:
grep -r "getApiUrl\|fetch\|axios" src/
```
- Frontend calls: `/api/admin/export/jadwal-matrix`
- Backend harus: `router.get('/jadwal-matrix', handler)`

### 2. Import Path Rules
```javascript
// Dari server/services/export/ ke server/config/:
import { CONFIG } from '../../config/exportConfig.js';  // ✅ BENAR
import { CONFIG } from '../config/exportConfig.js';     // ❌ SALAH

// Dari server/controllers/ ke server/config/:
import { CONFIG } from '../config/exportConfig.js';     // ✅ BENAR
```

### 3. CORS Configuration
- Manual CORS headers HARUS di posisi paling awal di `server_modern.js`
- ALLOWED_ORIGINS di `.env` HARUS include frontend domain
- Docker: cek `docker-compose.yml` environment variables

### 4. Deploy Workflow
```bash
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker logs absenta13-app --tail 50  # Verify no errors
```

---

## 🎨 Excel Export Rules

### Template-Based Export
1. Load template dari `server/templates/excel/`
2. **JANGAN overwrite cell dengan rumus**
3. Preserve formatting, merge, borders
4. Gunakan `exportConfig.js` untuk mapping

### Color Convention
```javascript
// ARGB format untuk ExcelJS
const colors = {
    header: 'FF90EE90',    // Light green
    mapel1: 'FFFF6B6B',    // Red
    mapel2: 'FF4ECDC4',    // Teal
    empty: 'FFF5F5F5'      // Light gray
};
```

---

## 🔐 Authentication

### Middleware Order
```javascript
router.use(authenticateToken);           // 1. Verify JWT
router.use(requireRole(['admin']));      // 2. Check role
// 3. Then route handlers
```

### Roles
- `admin` - Full access
- `guru` - Teacher functions
- `siswa` - Student functions

---

## 🧪 Testing Commands

```bash
# Syntax check
node --check server_modern.js

# Test endpoint (with token)
curl -H "Authorization: Bearer TOKEN" \
     https://api.absenta13.my.id/api/admin/export/jadwal-matrix

# Check Docker logs
docker logs absenta13-app --tail 50
```

---

## 📝 Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ERR_MODULE_NOT_FOUND` | Wrong import path | Check relative path depth |
| `502 Bad Gateway` | Server crash | Check `docker logs` for error |
| `CORS blocked` | Missing headers | Check ALLOWED_ORIGINS |
| `Unauthorized` | Invalid/expired token | Re-login to get new token |
