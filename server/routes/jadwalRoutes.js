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
    getScheduleMatrix,
    batchUpdateMatrix,
    checkScheduleConflicts,
    bulkCreateJadwal,
    cloneJadwal,
    getGuruAvailability,
    bulkUpsertGuruAvailability,
    getJamPelajaran
} from '../controllers/jadwalController.js';

const router = express.Router();

// Apply middleware to all routes
router.use(authenticateToken);

// Public/Shared Routes (Guru, Siswa, Admin)
router.get('/today', requireRole(['admin', 'guru', 'siswa']), getJadwalToday);

// Admin-only Routes
router.use(requireRole(['admin']));

// Matrix Grid Routes (for Schedule Grid Editor)
router.get('/matrix', getScheduleMatrix);
router.post('/matrix/batch', batchUpdateMatrix);
router.post('/matrix/update', batchUpdateMatrix); // Compatibility alias
router.get('/jam-pelajaran', getJamPelajaran);
router.post('/check-conflicts', checkScheduleConflicts);
router.post('/bulk', bulkCreateJadwal);
router.post('/clone', cloneJadwal);
router.get('/guru-availability', getGuruAvailability);
router.post('/guru-availability/bulk', bulkUpsertGuruAvailability);

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

