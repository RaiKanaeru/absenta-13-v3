/**
 * Backup Routes
 * Routes for backup, restore, archive, and schedule operations
 * Migrated from server_modern.js - Batch 15
 */

import express from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as backupController from '../controllers/backupController.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// ================================================
// BACKUP CRUD ROUTES
// ================================================

// Create semester backup
router.post('/create-semester-backup', authenticateToken, requireRole(['admin']), backupController.createSemesterBackup);

// Create date-based backup
router.post('/create-date-backup', authenticateToken, requireRole(['admin']), backupController.createDateBackup);

// Get backup list (via BackupSystem)
router.get('/backup-list', authenticateToken, requireRole(['admin']), backupController.getBackupList);

// Get backups (directory-based listing)
router.get('/backups', authenticateToken, requireRole(['admin']), backupController.getBackups);

// Delete backup
router.delete('/delete-backup/:backupId', authenticateToken, requireRole(['admin']), backupController.deleteBackup);

// Delete multiple backups
router.delete('/delete-backups/batch', authenticateToken, requireRole(['admin']), backupController.deleteBackupBatch);

// Download backup
router.get('/download-backup/:backupId', authenticateToken, requireRole(['admin']), backupController.downloadBackup);

// Manual database backup
router.get('/backup', authenticateToken, requireRole(['admin']), backupController.createManualBackup);

// ================================================
// RESTORE ROUTES
// ================================================

// Restore backup by ID
router.post('/restore-backup/:backupId', authenticateToken, requireRole(['admin']), backupController.restoreBackupById);

// Restore backup from uploaded file
router.post('/restore-backup', authenticateToken, requireRole(['admin']), upload.single('backupFile'), backupController.restoreBackupFromFile);

// ================================================
// ARCHIVE ROUTES
// ================================================

// Create test archive data (for testing purposes)
router.post('/create-test-archive-data', authenticateToken, requireRole(['admin']), backupController.createTestArchiveData);

// Archive old data
router.post('/archive-old-data', authenticateToken, requireRole(['admin']), backupController.archiveOldData);

// Get archive statistics
router.get('/archive-stats', authenticateToken, requireRole(['admin']), backupController.getArchiveStats);

// ================================================
// STATUS & SETTINGS ROUTES
// ================================================

// Get database status
router.get('/database-status', authenticateToken, requireRole(['admin']), backupController.getDatabaseStatus);

// Get backup directory status
router.get('/backup-directory-status', authenticateToken, requireRole(['admin']), backupController.getBackupDirectoryStatus);

// Get backup settings
router.get('/backup-settings', authenticateToken, requireRole(['admin']), backupController.getBackupSettings);

// Save backup settings
router.post('/backup-settings', authenticateToken, requireRole(['admin']), backupController.saveBackupSettings);

// ================================================
// CUSTOM SCHEDULE ROUTES
// ================================================

// Get custom schedules
router.get('/custom-schedules', authenticateToken, requireRole(['admin']), backupController.getCustomSchedules);

// Create custom schedule
router.post('/custom-schedules', authenticateToken, requireRole(['admin']), backupController.createCustomSchedule);

// Update custom schedule
router.put('/custom-schedules/:id', authenticateToken, requireRole(['admin']), backupController.updateCustomSchedule);

// Delete custom schedule
router.delete('/custom-schedules/:id', authenticateToken, requireRole(['admin']), backupController.deleteCustomSchedule);

// Run custom schedule manually
router.post('/run-custom-schedule/:id', authenticateToken, requireRole(['admin']), backupController.runCustomSchedule);

// ================================================
// DISASTER RECOVERY ROUTES - Migrated from server_modern.js Batch 17D
// ================================================

// Get disaster recovery status
router.get('/disaster-recovery-status', authenticateToken, requireRole(['admin']), backupController.getDisasterRecoveryStatus);

// Setup backup schedule
router.post('/setup-backup-schedule', authenticateToken, requireRole(['admin']), backupController.setupBackupSchedule);

// Verify backup
router.post('/verify-backup', authenticateToken, requireRole(['admin']), backupController.verifyBackup);

// Test backup restoration
router.post('/test-backup-restoration', authenticateToken, requireRole(['admin']), backupController.testBackupRestoration);

// Get disaster recovery docs
router.get('/disaster-recovery-docs', authenticateToken, requireRole(['admin']), backupController.getDisasterRecoveryDocs);

// Create disaster backup
router.post('/create-disaster-backup', authenticateToken, requireRole(['admin']), backupController.createDisasterBackup);

// Get disaster backup list
router.get('/disaster-backup-list', authenticateToken, requireRole(['admin']), backupController.getDisasterBackupList);

// Verify backup by ID
router.get('/verify-backup/:backupId', authenticateToken, requireRole(['admin']), backupController.verifyBackupById);

// Test recovery procedure
router.post('/test-recovery/:procedureId', authenticateToken, requireRole(['admin']), backupController.testRecoveryProcedure);

// Get recovery procedures
router.get('/recovery-procedures', authenticateToken, requireRole(['admin']), backupController.getRecoveryProcedures);

export default router;
