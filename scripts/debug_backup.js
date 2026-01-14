import dotenv from 'dotenv';
dotenv.config();
import { BackupSystem } from '../server/services/system/backup-system.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Using top-level await for cleaner async code
console.log('🧪 Testing Backup System...');
const backupSystem = new BackupSystem();
await backupSystem.initialize();

try {
    console.log('📂 Creating test semester backup...');
    const result = await backupSystem.createSemesterBackup('Ganjil', 2024);
    console.log('✅ Backup result:', result);

    // Verify folder content
    const files = await fs.readdir(result.path);
    console.log(`📂 Content of ${result.path}:`, files);

    if (files.length === 0) {
        console.error('❌ Backup folder is empty!');
    } else {
        console.log('✅ Backup folder has content.');
    }

    // Check if zip exists at root
    const zipPath = path.join(process.cwd(), 'backups', `${result.backupId}.zip`);
    try {
        await fs.access(zipPath);
        console.log(`✅ Zip file found at ${zipPath}`);
    } catch {
        console.warn(`⚠️ Zip file NOT found at ${zipPath}`);
    }

} catch (error) {
    console.error('❌ Test failed:', error);
}
process.exit(0);
