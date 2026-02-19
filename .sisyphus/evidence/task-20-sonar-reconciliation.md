# Sonar Cleanup Reconciliation Matrix

## Summary
- **Total Findings Listed**: All user-listed SonarQube findings across T2-T19
- **Resolution Status**: ALL RESOLVED
- **Date**: 2026-02-19

## Legend
- ✅ FIXED — Code modified to resolve finding
- 🔄 PRE-RESOLVED — Already fixed before plan execution (commit 0dd49c73 or earlier)
- ℹ️ FALSE-POSITIVE — Finding does not apply to current code

---

## Wave 1: Backend Hygiene (T2-T6)

### T2: Unused Backend Imports
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| Unused `sendNotFoundError` import | guruReportsController.js | ✅ FIXED | f94cba75 |
| Unused `sendDatabaseError` import | importMasterScheduleController.js | ✅ FIXED | f94cba75 |
| Unused import | pdfExportController.js | ✅ FIXED | f94cba75 |

### T3: System Services Hygiene
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| Unused import in initializer | initializer.js | ✅ FIXED | 39dc4f17 |
| Regex duplicate characters | security-system (via queue-system) | ✅ FIXED | 39dc4f17 |
| TypeError in queue-system | queue-system.js | ✅ FIXED | 39dc4f17 |

### T4: Async/Export Conventions
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| globalErrorMiddleware re-exports | globalErrorMiddleware.js | ✅ FIXED | da5ad7c1 |
| run_migrations top-level await | server_modern.js | ✅ FIXED | da5ad7c1 |
| server_modern.js conventions | server_modern.js | ✅ FIXED | da5ad7c1 |

### T5: Quick Controller Smells
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| jamPelajaran `daysToInsert` dead assignment | jamPelajaranController.js | ✅ FIXED | 97d8077a |
| siswa ternary + unused `nis` | siswaController.js | ✅ FIXED | 97d8077a |

### T6: Jadwal Non-Complex Smells
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| Set.has conversion | jadwalController.js | ✅ FIXED | 9189c6e7 |
| Catch naming conventions | jadwalController.js | ✅ FIXED | 9189c6e7 |
| Negated condition readability | jadwalController.js | ✅ FIXED | 9189c6e7 |
| Unused variables | jadwalController.js | ✅ FIXED | 9189c6e7 |

---

## Wave 2: Backend Complexity Refactors (T7-T12)

### T7: Unattributed Finding Cluster
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| Findings at L42/L46/L92/L152 etc. | importMasterScheduleController.js | ✅ FIXED | 144ec9ba |

### T8: Jadwal Complexity Group A
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| L264 complexity 16→≤15 | jadwalController.js | ✅ FIXED | (Wave 2) |
| L713 complexity 19→≤15 | jadwalController.js | ✅ FIXED | (Wave 2) |

### T9: Jadwal Complexity Group B
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| L954 complexity 27→≤15 | jadwalController.js | ✅ FIXED | (Wave 2) |

### T10: Jadwal Complexity Group C (bulkCreateJadwal)
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| L1205 complexity 37→≤15 | jadwalController.js | ✅ FIXED | d51d55c9 |

### T11: Jadwal Complexity Group D (cloneJadwal)
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| L1367 complexity 50→≤15 | jadwalController.js | ✅ FIXED | 468d063f |

### T12: Utilities Complexity Pack
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| Set conversion in importHelper | importHelper.js | ✅ FIXED | c48163f6 |
| validateJadwalTimeFields extraction | importHelper.js | ✅ FIXED | c48163f6 |
| Number() fix | importHelper.js | ✅ FIXED | c48163f6 |
| sqlParser full rewrite (complexity 94→~5) | sqlParser.js | ✅ FIXED | c48163f6 |

---

## Wave 3: Frontend Remediation (T13-T18)

### T13: Frontend Quick Smells
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| AdminDashboard unused import | AdminDashboard.tsx | ✅ FIXED | a2dee617 |
| NotificationBell readonly props | NotificationBell.tsx | ✅ FIXED | a2dee617 |
| NotificationPanel readonly props | NotificationPanel.tsx | ✅ FIXED | a2dee617 |

### T14: BackupManagementView Refactor
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| Complexity 28→≤15 at L216 | BackupManagementView.tsx | ✅ FIXED | 8698933f |
| removeChild at L505 | BackupManagementView.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |
| Nested ternary at L860 | BackupManagementView.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |
| Nested ternaries at L1245/L1246 | BackupManagementView.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |

### T15: EditProfile + ExcelPreview
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| EditProfile complexity 22 at L189 | EditProfile.tsx | ✅ FIXED | cd661267 |
| ExcelPreview nested ternary at L232 | ExcelPreview.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |
| ExcelPreview index keys at L236/L318 | ExcelPreview.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |

### T16: ExcelImportView + MonitoringDashboard
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| ExcelImportView index keys at L352 | ExcelImportView.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |
| ExcelImportView index key at L569 | ExcelImportView.tsx | ℹ️ FALSE-POSITIVE | — |
| ExcelImportView index key at L606 | ExcelImportView.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |
| MonitoringDashboard `testAlert` at L141 | MonitoringDashboard.tsx | ℹ️ FALSE-POSITIVE | — |
| MonitoringDashboard nested ternaries L373/409/431/462/486 | MonitoringDashboard.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |

**FALSE-POSITIVE Notes:**
- `key={error.index}` at L559: `error.index` is a data property (row number), NOT an array iteration index. It serves as a stable, unique key.
- `testAlert` at L141: No such variable exists in MonitoringDashboard.tsx. `testAlert` is an exported controller function in monitoringController.js, not a frontend variable.

### T17: PresensiSiswaView
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| removeChild at L197 | PresensiSiswaView.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |
| Optional chain at L386 | PresensiSiswaView.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |
| Index keys at L412/L524 | PresensiSiswaView.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |
| Nested ternaries at L499-502 | PresensiSiswaView.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |

### T18: Rekap Views
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| RekapGuruView useless assignments L124/172/177/182/188/198 | RekapKetidakhadiranGuruView.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |
| RekapGuruView nested ternaries L367/388/446 | RekapKetidakhadiranGuruView.tsx | 🔄 PRE-RESOLVED | 0dd49c73 |
| RekapView nested ternaries L539-555 | RekapKetidakhadiranView.tsx | ✅ FIXED | c6ac6a48 |
| RekapView nested ternaries L566-585 | RekapKetidakhadiranView.tsx | ✅ FIXED | c6ac6a48 |

---

## Wave 4: Backend Completion (T19)

### T19: Monitoring Controller Complexity
| Finding | File | Status | Commit |
|---------|------|--------|--------|
| getMonitoringDashboard complexity/else-branch | monitoringController.js | ✅ FIXED | b55cd199 |

---

## Final Regression Results

| Check | Result |
|-------|--------|
| `npm run test:server` | ✅ 185 pass, 0 fail |
| `npm run test:client` | ✅ 13 pass, 0 fail |
| `npx tsc --noEmit` | ✅ Clean (0 errors) |
| `npm run build` | ✅ Built in ~8.5s |
| `npm run lint` | ✅ Clean (0 errors in app scope) |

## Scope Fidelity

All changed source files map to planned task targets:
- Backend: 7 controllers, 1 middleware, 2 services, 2 utils, 1 entry point
- Frontend: 6 components (main), 3 companion files (.components/.helpers), 2 test files, 1 hook, 1 config
- No unplanned files modified
