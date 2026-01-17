import express from 'express';
import { listDatabaseFiles, executeDatabaseFile } from '../controllers/databaseFileController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get list of database files
router.get('/', authenticateToken, requireRole(['admin']), listDatabaseFiles);

// Execute a specific file
router.post('/execute', authenticateToken, requireRole(['admin']), executeDatabaseFile);

export default router;
