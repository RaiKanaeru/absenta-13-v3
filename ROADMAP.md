# ABSENTA 13 - Roadmap Perbaikan Sistem

> Dokumen ini berisi daftar tugas perbaikan yang teridentifikasi dari review codebase.

---

## 📊 Status Saat Ini

| Metric | Nilai |
|--------|-------|
| **Tests** | 56 passing |
| **Test Files** | 5 |
| **Documented Functions** | 30+ |

---

## 🔧 Tugas Perbaikan Fifth Round

### 1. 🔤 Typo/Comment Fix

| File | Issue | Priority |
|------|-------|----------|
| `siswaController.js` | English header "CRUD operations for student..." | Low |
| `adminDashboardController.js` | English comments throughout | Low |

### 2. 🐛 Bug Fix

| File | Issue | Priority |
|------|-------|----------|
| `adminDashboardController.js:14` | Menggunakan `BCRYPT_SALT_ROUNDS` bukan `SALT_ROUNDS` (inkonsisten) | Medium |
| `adminDashboardController.js:97` | Default `jenis_kelamin = 'L'` untuk guru baru (hardcoded) | Low |

### 3. 📝 Documentation Fix

| File | Issue |
|------|-------|
| `siswaController.js` | Missing JSDoc di 7 functions (getSiswa, createSiswa, updateSiswa, deleteSiswa, updateProfile, changePassword, validateSiswaPayload) |
| `adminDashboardController.js` | Missing JSDoc di 4 functions (getTeachers, addTeacher, updateTeacher, deleteTeacher) |

### 4. 🧪 Testing Improvement

| Test File | Coverage Needed |
|-----------|-----------------|
| `siswa.test.js` | Validation logic untuk NIS, username, email |
| `adminDashboard.test.js` | Teacher CRUD validation |

---

## 📋 Backlog Perbaikan Masa Depan

### High Priority
- [ ] Integration tests dengan database mock
- [ ] API endpoint testing dengan supertest
- [ ] Error handling consistency audit

### Medium Priority
- [ ] Performance optimization untuk queries dengan pagination
- [ ] Add request rate limiting per endpoint
- [ ] Implement request/response logging middleware

### Low Priority
- [ ] Convert remaining English comments to Indonesian
- [ ] Add JSDoc to utility functions
- [ ] Setup CI/CD pipeline untuk automated testing

---

## ✅ Completed (Previous Rounds)

| Round | Fixes |
|-------|-------|
| 1 | Bug fix getJadwalToday, JSDoc jadwalController, auth.test.js |
| 2 | Bug fix useEffect, JSDoc mapelController, studentData.test.js |
| 3 | Bug fix deleteKelas, connection leaks, kelasRuang.test.js, formatUtils.test.js |
| 4 | Bug fix getChart period, JSDoc bandingAbsenController, timeUtils.test.js |

---

## 🚀 How to Run Tests

```bash
# Run all tests
npm test

# Run specific test file
node --test server/__tests__/auth.test.js
```

---

## 📁 Test File Structure

```
server/
└── __tests__/
    ├── auth.test.js        # Rate limiting, time validation
    ├── studentData.test.js # Student validation, promotion rules
    ├── kelasRuang.test.js  # Kelas extraction, ruang validation
    ├── formatUtils.test.js # formatBytes, formatNumber, formatPercentage
    └── timeUtils.test.js   # WIB timezone functions
```
