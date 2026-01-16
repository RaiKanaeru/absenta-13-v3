import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { 
    getJadwal, 
    createJadwal, 
    updateJadwal, 
    deleteJadwal,
    getJadwalGuru,
    addJadwalGuru,
    removeJadwalGuru,
    getJadwalToday,
    bulkCreateJadwal,
    cloneJadwal,
    checkBulkConflicts,
    getJamPelajaran,
    getGuruAvailabilityList,
    checkGuruAvailabilityApi,
    getAppSettings,
    bulkUpdateGuruAvailability,
    getMatrixSchedule,
    updateMatrixSchedule,
    checkMatrixConflict,
    importMasterSchedule
} from '../controllers/jadwalController.js';
import multer from 'multer';
import path from 'path';

// Setup basic storage for CSV upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'), // Ensure this dir exists
    filename: (req, file, cb) => cb(null, `import-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });


const router = express.Router();

// Apply middleware to all routes
router.use(authenticateToken);

// Public/Shared Routes (Guru, Siswa, Admin)
router.get('/today', requireRole(['admin', 'guru', 'siswa']), getJadwalToday);
router.get('/jam-pelajaran', requireRole(['admin', 'guru']), getJamPelajaran);

// Admin-only Routes
router.use(requireRole(['admin']));

// Matrix/Grid Editor Routes
router.get('/matrix', getMatrixSchedule);
router.post('/matrix/update', updateMatrixSchedule);
router.get('/matrix/check-conflict', checkMatrixConflict);
router.post('/import-master', upload.single('file'), importMasterSchedule);


// Reference Data Routes
router.get('/guru-availability', getGuruAvailabilityList);
router.post('/guru-availability/bulk', bulkUpdateGuruAvailability);
router.post('/check-guru-availability', checkGuruAvailabilityApi);
router.get('/settings', getAppSettings);

// Bulk Operations (must be before /:id routes)
router.post('/bulk', bulkCreateJadwal);
router.post('/clone', cloneJadwal);
router.post('/check-conflicts', checkBulkConflicts);

// Main CRUD Routes
router.get('/', getJadwal);
router.post('/', createJadwal);
router.put('/:id', updateJadwal);
router.delete('/:id', deleteJadwal);

// Multi-Guru Routes
router.get('/:id/guru', getJadwalGuru);
router.post('/:id/guru', addJadwalGuru);
router.delete('/:id/guru/:guruId', removeJadwalGuru);

export default router;

