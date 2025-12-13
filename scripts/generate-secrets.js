import crypto from 'crypto';

console.log('🔐 Security Keys Generator');
console.log('═══════════════════════════════════════════════════════\n');

// Generate JWT Secret (64 bytes = 128 hex characters)
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('JWT_SECRET=');
console.log(jwtSecret);
console.log('\n');

// Generate Redis Password (32 bytes = 64 hex characters)
const redisPassword = crypto.randomBytes(32).toString('hex');
console.log('REDIS_PASSWORD=');
console.log(redisPassword);
console.log('\n');

// Generate Session Secret
const sessionSecret = crypto.randomBytes(32).toString('hex');
console.log('SESSION_SECRET=');
console.log(sessionSecret);
console.log('\n');

console.log('═══════════════════════════════════════════════════════');
console.log('💡 INSTRUCTIONS:');
console.log('   1. Copy these values to your .env.production file');
console.log('   2. NEVER commit these secrets to git!');
console.log('   3. Keep these secrets secure and backed up safely');
console.log('═══════════════════════════════════════════════════════\n');


