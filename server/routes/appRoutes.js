import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import guruRoutes from './guruRoutes.js';
import siswaRoutes from './siswaRoutes.js';
import mapelRoutes from './mapelRoutes.js';
import kelasRoutes from './kelasRoutes.js';
import jadwalRoutes from './jadwalRoutes.js';
import ruangRoutes from './ruangRoutes.js';
import userInfoRoutes from './userInfoRoutes.js';
import bandingAbsenRoutes from './bandingAbsenRoutes.js';
import adminDashboardRoutes from './adminDashboardRoutes.js';
import bandingAbsenSiswaGuruRoutes from './bandingAbsenSiswaGuruRoutes.js';
import reportsRoutes from './reportsRoutes.js';
import teacherDataRoutes from './teacherDataRoutes.js';
import studentDataRoutes from './studentDataRoutes.js';
import absensiRoutes from './absensiRoutes.js';
import exportRoutes from './exportRoutes.js';
import letterheadRoutes from './letterheadRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import backupRoutes from './backupRoutes.js';
import templateRoutes from './templateRoutes.js';
import importRoutes from './importRoutes.js';
import monitoringRoutes from './monitoringRoutes.js';
import jamPelajaranRoutes from './jamPelajaranRoutes.js';
import templateExportRoutes from './templateExportRoutes.js';
import kalenderAkademikRoutes from './kalenderAkademikRoutes.js';
import databaseFileRoutes from './databaseFileRoutes.js';
import downloadRoutes from './downloadRoutes.js';

export function setupRoutes(app) {
    // Auth Routes
    app.use('/api', authRoutes);

    // Admin Routes
    app.use('/api/admin', adminRoutes);

    // CRUD ENDPOINTS - ADMIN ONLY
    // BACKUP, TEMPLATE, IMPORT, MONITORING ROUTES
    app.use('/api/admin', backupRoutes); // Backup endpoints
    app.use('/api/admin', templateRoutes); // Template download endpoints
    app.use('/api/admin', importRoutes); // Import Excel endpoints
    app.use('/api/admin/database-files', databaseFileRoutes); // Database file manager
    app.use('/api/admin', monitoringRoutes); // Monitoring endpoints
    app.use('/api/admin/export', templateExportRoutes); // Template-based Excel export

    // SISWA CRUD
    app.use('/api/admin/siswa', siswaRoutes);
    app.use('/api/siswa', siswaRoutes); // Profile routes for self-service

    // GURU CRUD
    app.use('/api/admin/guru', guruRoutes);
    app.use('/api/guru', guruRoutes); // Profile routes for self-service

    // MAPEL CRUD
    app.use('/api/admin/mapel', mapelRoutes);

    // KELAS CRUD
    app.use('/api/kelas', kelasRoutes); // Public route for dropdown uses /public sub-route
    app.use('/api/admin/kelas', kelasRoutes);

    // JADWAL CRUD
    app.use('/api/admin/jadwal', jadwalRoutes);

    // JAM PELAJARAN (Dynamic Time Slots per Kelas)
    app.use('/api/admin/jam-pelajaran', jamPelajaranRoutes);

    // RUANG CRUD
    app.use('/api/admin/ruang', ruangRoutes);

    // USER INFO & BANDING
    app.use('/api', userInfoRoutes); // User self-service info endpoints
    app.use('/api', bandingAbsenRoutes);
    app.use('/api/admin', bandingAbsenRoutes); // Alias for frontend compatibility
    app.use('/api', bandingAbsenSiswaGuruRoutes); // Siswa & Guru banding endpoints

    // REPORTS & DASHBOARD
    app.use('/api/admin', reportsRoutes); // Analytics & Reports endpoints
    app.use('/api/admin', adminDashboardRoutes); // Admin dashboard teacher/student management (User Accounts)
    app.use('/api/admin/teachers-data', teacherDataRoutes); // Teacher Data Master
    app.use('/api/admin', studentDataRoutes); // Student Data Master & Promotion

    // ABSENSI CRUD
    app.use('/api/attendance', absensiRoutes); // Attendance submit endpoints
    app.use('/api', absensiRoutes); // Schedule and siswa endpoints (uses /schedule/:id/... and /siswa/...)

    // EXPORT ROUTES
    app.use('/api/export', exportRoutes); // All export endpoints
    app.use('/api/admin/export', exportRoutes); // Alias for frontend compatibility
    app.use('/api/downloads', downloadRoutes); // Secure download endpoints

    // LETTERHEAD & DASHBOARD STATS
    app.use('/api/admin', letterheadRoutes); // All letterhead endpoints
    app.use('/api/dashboard', dashboardRoutes); // Dashboard stats and chart
    app.use('/api/admin', dashboardRoutes); // Alias: /api/admin/live-summary
    app.use('/api/admin/kalender-akademik', kalenderAkademikRoutes); // Kalender akademik (hari efektif)

    // Route Aliases for Frontend Compatibility
    app.use('/api/admin/classes', kelasRoutes); // Alias: /api/admin/classes -> kelas
    app.use('/api/admin/subjects', mapelRoutes); // Alias: /api/admin/subjects -> mapel
    app.use('/api/admin/students', siswaRoutes); // Alias: /api/admin/students -> siswa
}
