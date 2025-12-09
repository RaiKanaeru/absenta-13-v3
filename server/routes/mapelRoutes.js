import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getMapel, createMapel, updateMapel, deleteMapel } from '../controllers/mapelController.js';

const router = express.Router();

// Apply middleware to all routes
router.use(authenticateToken);
router.use(requireRole(['admin']));

// Routes
router.get('/', getMapel);
router.post('/', createMapel);
router.put('/:id', updateMapel);
router.delete('/:id', deleteMapel);

export default router;
