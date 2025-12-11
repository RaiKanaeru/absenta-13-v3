/**
 * Teacher Data Routes
 * CRUD operations for Teacher Data Profile
 * Mounted at /api/admin/teachers-data
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    getTeachersData,
    addTeacherData,
    updateTeacherData,
    deleteTeacherData
} from '../controllers/teacherDataController.js';

const router = express.Router();

// Middleware applied to all routes in this router
router.use(authenticateToken);
router.use(requireRole(['admin']));

// Routes
router.get('/', getTeachersData);
router.post('/', addTeacherData);
router.put('/:id', updateTeacherData);
router.delete('/:id', deleteTeacherData);

export default router;
