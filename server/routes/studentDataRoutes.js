/**
 * Student Data Routes
 * CRUD operations for Student Data Profile and Promotion
 * Mounted at /api/admin
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    getStudentsData,
    addStudentData,
    updateStudentData,
    deleteStudentData,
    promoteStudents
} from '../controllers/studentDataController.js';

const router = express.Router();

// Middleware applied to all routes in this router
router.use(authenticateToken);
router.use(requireRole(['admin']));

// Students CRUD
router.get('/students-data', getStudentsData);
router.post('/students-data', addStudentData);
router.put('/students-data/:id', updateStudentData);
router.delete('/students-data/:id', deleteStudentData);

// Promotion
router.post('/student-promotion', promoteStudents);

export default router;
