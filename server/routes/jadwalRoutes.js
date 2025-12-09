import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { 
    getJadwal, 
    createJadwal, 
    updateJadwal, 
    deleteJadwal,
    getJadwalGuru,
    addJadwalGuru,
    removeJadwalGuru
} from '../controllers/jadwalController.js';

const router = express.Router();

// Apply middleware to all routes
router.use(authenticateToken);
router.use(requireRole(['admin']));

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
