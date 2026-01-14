import readline from 'readline';
import fs from 'node:fs';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🛠️  ABSENTA Manual Setup Helper');
console.log('================================');
console.log('Script ini akan membantu Anda membuat file .env secara manual.');
console.log('Anda perlu memasukkan IP Address atau Hostname komputer ini.');
console.log('--------------------------------');

rl.question('\n📝 Masukkan IP Address / Hostname (contoh: 192.168.1.5): ', (inputIP) => {
    const ip = inputIP.trim();

    if (!ip) {
        console.log('❌ IP Address tidak boleh kosong!');
        rl.close();
        return;
    }

    console.log(`\n✅ Menggunakan IP: ${ip}`);

    // Create .env file content
    const envContent = `# ===========================================
# NETWORK ACCESS CONFIGURATION - MANUAL
# ===========================================
NODE_ENV=development
PORT=3001
FRONTEND_PORT=8080

# ===========================================
# API CONFIGURATION
# ===========================================
API_BASE_URL=http://${ip}:3001
VITE_API_BASE_URL=http://${ip}:3001

# ===========================================
# CORS CONFIGURATION
# ===========================================
ALLOWED_ORIGINS=http://${ip}:8080,http://${ip}:8081,http://${ip}:5173,http://${ip}:3000,http://localhost:8080,http://localhost:8081,http://localhost:5173,http://localhost:3000

# ===========================================
# DATABASE CONFIGURATION
# ===========================================
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=absenta13
DB_PORT=3306
DB_CONNECTION_LIMIT=50
DB_TIMEZONE=+07:00

# ===========================================
# SECURITY CONFIGURATION
# ===========================================
JWT_SECRET=c7f199d6d61fcb73bf62642a2550c3bb2e8e3fa53d852854acf8d69774ff28ae
SALT_ROUNDS=10
SESSION_EXPIRY=86400

# ===========================================
# FILE PATHS
# ===========================================
UPLOAD_DIR=public/uploads
BACKUP_DIR=backups
ARCHIVE_DIR=archives
REPORTS_DIR=reports
LOG_DIR=logs
`;

    // Write .env file
    try {
        fs.writeFileSync('.env', envContent);
        console.log('\n✅ File .env berhasil dibuat!');
        console.log('\n📋 Konfigurasi:');
        console.log(`   Backend URL: http://${ip}:3001`);
        console.log(`   Frontend URL: http://${ip}:8080`);
        console.log('\n🚀 Langkah selanjutnya:');
        console.log('1. Restart server: npm run dev');
        console.log(`2. Akses dari browser: http://${ip}:8080`);
    } catch (error) {
        console.error('\n❌ Gagal membuat file .env:', error.message);
    }

    rl.close();
});
