#!/usr/bin/env node

import os from 'node:os';
import fs from 'node:fs';

console.log('🌐 ABSENTA Network Setup Helper');
console.log('================================');

// Get network interfaces
const networkInterfaces = os.networkInterfaces();
let localIP = 'localhost';

console.log('\n📡 Available Network Interfaces:');
console.log('--------------------------------');

for (const [name, interfaces] of Object.entries(networkInterfaces)) {
  console.log(`\n${name}:`);
  for (const iface of interfaces) {
    if (iface.family === 'IPv4' && !iface.internal) {
      console.log(`  📍 ${iface.address} (${iface.netmask})`);
      if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
        localIP = iface.address;
      }
    }
  }
}

console.log(`\n🎯 Recommended IP for mobile access: ${localIP}`);
console.log(`\n📱 Mobile URL: http://${localIP}:3001`);
console.log(`💻 Desktop URL: http://localhost:3001`);

// Create .env file content
const envContent = `# ===========================================
# NETWORK ACCESS CONFIGURATION
# ===========================================
NODE_ENV=development
PORT=3001
FRONTEND_PORT=8080

# ===========================================
# API CONFIGURATION - IP KOMPUTER ANDA
# ===========================================
API_BASE_URL=http://${localIP}:3001
VITE_API_BASE_URL=http://${localIP}:3001

# ===========================================
# CORS CONFIGURATION - IP KOMPUTER ANDA
# ===========================================
ALLOWED_ORIGINS=http://${localIP}:8080,http://${localIP}:8081,http://${localIP}:5173,http://${localIP}:3000,http://localhost:8080,http://localhost:8081,http://localhost:5173,http://localhost:3000

# ===========================================
# DATABASE CONFIGURATION
# ===========================================
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=absenta13
DB_PORT=3306
DB_CONNECTION_LIMIT=50
DB_TIMEZONE=+07:00

# ===========================================
# SECURITY CONFIGURATION
# ===========================================
JWT_SECRET=absenta-super-secret-key-2025
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
  console.log('\n✅ .env file created successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Restart your server: npm run dev');
  console.log('2. Access from mobile: http://' + localIP + ':3001');
  console.log('3. Make sure both devices are on the same network');
  console.log('4. Check firewall settings if connection fails');
} catch (error) {
  console.error('\n❌ Error creating .env file:', error.message);
  console.log('\n📝 Please create .env file manually with the following content:');
  console.log(envContent);
}

console.log('\n🔧 Troubleshooting:');
console.log('- If mobile can\'t connect, check Windows Firewall');
console.log('- Make sure both devices are on the same WiFi network');
console.log('- Try accessing http://' + localIP + ':3001 from desktop browser first');
console.log('- Check if port 3001 is not blocked by antivirus');
