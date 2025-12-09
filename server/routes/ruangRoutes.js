import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getRuang, getRuangById, createRuang, updateRuang, deleteRuang } from '../controllers/ruangController.js';

const router = express.Router();

// Apply middleware to all routes
router.use(authenticateToken);
router.use(requireRole(['admin']));

// Routes
router.get('/', getRuang);
router.get('/:id', getRuangById);
router.post('/', createRuang);
router.put('/:id', updateRuang);
router.delete('/:id', deleteRuang);

export default router;
