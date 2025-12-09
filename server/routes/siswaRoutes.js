import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getSiswa, createSiswa, updateSiswa, deleteSiswa } from '../controllers/siswaController.js';

const router = express.Router();

// Apply middleware to all routes in this router
router.use(authenticateToken);
router.use(requireRole(['admin'])); // Only admin can manage students

// Routes
router.get('/', getSiswa);
router.post('/', createSiswa);
router.put('/:id', updateSiswa);
router.delete('/:id', deleteSiswa);

export default router;
