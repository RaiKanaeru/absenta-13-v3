#!/usr/bin/env node

import fs from 'node:fs';

console.log('[HOME] ABSENTA Localhost Setup Helper');
console.log('==================================');

console.log('\\n[LOG] Setting up configuration for localhost development...');

// Create .env file content for localhost
const envContent = `# ===========================================
# NETWORK ACCESS CONFIGURATION - LOCALHOST
# ===========================================
NODE_ENV=development
PORT=3001
FRONTEND_PORT=8080

# ===========================================
# API CONFIGURATION - LOCALHOST
# ===========================================
API_BASE_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001

# ===========================================
# CORS CONFIGURATION - LOCALHOST
# ===========================================
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:8081,http://localhost:5173,http://localhost:3000,http://127.0.0.1:8080,http://127.0.0.1:8081,http://127.0.0.1:5173,http://127.0.0.1:3000

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
  console.log('\\n[OK] .env file created successfully for localhost!');
  console.log('\\n[LOG] Configuration Summary:');
  console.log('   Backend URL: http://localhost:3001');
  console.log('   Frontend URL: http://localhost:8080');
  console.log('   API Base URL: http://localhost:3001');
  console.log('\\n[LOG] Next steps:');
  console.log('1. Restart your server: npm run dev');
  console.log('2. Access from browser: http://localhost:8080');
  console.log('3. Backend API: http://localhost:3001');
} catch (error) {
  console.error('\\n[ERROR] Error creating .env file:', error.message);
  console.log('\\n[NOTE] Please create .env file manually with the following content:');
  console.log(envContent);
}

console.log('\\n[TIP] Tips:');
console.log('- This configuration is for local development only');
console.log('- Use setup-network.js if you need mobile/network access');
console.log('- Make sure MySQL is running on localhost:3306');
console.log('- Check if ports 3001 and 8080 are available');

