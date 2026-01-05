# ABSENTA 13 - Roadmap Perbaikan Sistem

> Dokumen ini berisi daftar tugas perbaikan yang teridentifikasi dari review codebase.

---

## 📊 Status Saat Ini

| Metric | Nilai |
|--------|-------|
| Tests | 119 passing |
| Test Files | 8 |
| Documented Functions | 40+ |

---

## ✅ Completed Fixes

### Sixth Round (Latest)

| Category | Fix |
|----------|-----|
| 🐛 Bug | Fixed undefined vars in `importController.js` (line 508) |
| � Docs | JSDoc for 4 `guruController` functions |
| 🔤 Typos | Indonesian headers (guruController, importController) |
| 🧪 Tests | Added `guru.test.js` (22 tests), `authLogin.test.js` (17 tests) |

### Previous Rounds

| Round | Fixes |
|-------|-------|
| 1 | Bug fix getJadwalToday, JSDoc jadwalController |
| 2 | Bug fix useEffect, JSDoc mapelController |
| 3 | Bug fix deleteKelas, connection leaks |
| 4 | Bug fix getChart period, JSDoc bandingAbsenController |
| 5 | SALT_ROUNDS bug, JSDoc adminDashboardController |

---

## 📋 Backlog (Future)

### High Priority

- Integration tests dengan database mock
- API endpoint testing dengan supertest

### Medium Priority

- JSDoc untuk remaining 50+ functions
- Performance optimization untuk pagination queries

### Low Priority

- Convert remaining English comments
- Setup CI/CD pipeline

---

## 🚀 How to Run Tests

```bash
npm test
```

## 📁 Test Files

| File | Tests | Area |
|------|-------|------|
| auth.test.js | 6 | Rate limiting |
| authLogin.test.js | 17 | Login logic, JWT |
| studentData.test.js | 11 | Student validation |
| kelasRuang.test.js | 10 | Kelas/Ruang |
| formatUtils.test.js | 15 | Format utilities |
| timeUtils.test.js | 14 | WIB timezone |
| siswa.test.js | 23 | Siswa validation |
| guru.test.js | 22 | Guru validation |
