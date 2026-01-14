
import dotenv from 'dotenv';
dotenv.config();
import BackupSystem from '../server/services/system/backup-system.js';

console.log('🧪 Testing Backup List...');
const backupSystem = new BackupSystem();

try {
    console.log('📋 Listing backups...');
    const backups = await backupSystem.listBackups();
    console.log(`✅ Found ${backups.length} backups:`);
    backups.forEach(b => console.log(` - ${b.filename} (${b.type}) [Size: ${b.size}]`));
} catch (error) {
    console.error('❌ Listing failed:', error);
}

process.exit(0);
