
import dotenv from 'dotenv';
dotenv.config();
import BackupSystem from '../server/services/system/backup-system.js';

async function listBackupsTest() {
    console.log('🧪 Testing Backup List...');
    const backupSystem = new BackupSystem();
    // await backupSystem.initialize(); // Skip DB init for FS-only test

    try {
        console.log('📋 Listing backups...');
        const backups = await backupSystem.listBackups();
        console.log(`✅ Found ${backups.length} backups:`);
        backups.forEach(b => console.log(` - ${b.filename} (${b.type}) [Size: ${b.size}]`));
    } catch (error) {
        console.error('❌ Listing failed:', error);
    }
    
    // await backupSystem.close();
    process.exit(0);
}

listBackupsTest();
