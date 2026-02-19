import dotenv from 'dotenv';
dotenv.config();

console.log('[TEST] Configuration Test');
console.log('═══════════════════════════════════════════════════════\n');

const required = [
    'NODE_ENV',
    'PORT',
    'DB_HOST',
    'DB_USER',
    'DB_NAME',
    'REDIS_HOST',
    'REDIS_PORT',
    'JWT_SECRET'
];

const optional = [
    'DB_PASSWORD',
    'REDIS_PASSWORD',
    'API_BASE_URL',
    'ALLOWED_ORIGINS',
    'UPLOAD_DIR',
    'BACKUP_DIR'
];

const warnings = [];
const errors = [];
let validCount = 0;

console.log('[LOG] Required Environment Variables:');
console.log('');

required.forEach(key => {
    const value = process.env[key];
    if (value) {
        validCount++;
        const displayValue = key.includes('PASSWORD') || key.includes('SECRET') 
            ? '***' 
            : value;
        console.log(`   [OK] ${key}: ${displayValue}`);
    } else {
        errors.push(`[ERROR] Missing required: ${key}`);
        console.log(`   [ERROR] ${key}: MISSING`);
    }
});

console.log('');
console.log('[LOG] Optional Environment Variables:');
console.log('');

optional.forEach(key => {
    const value = process.env[key];
    let displayValue = value || 'not set';
    
    if (key.includes('PASSWORD') || key.includes('SECRET')) {
        displayValue = value ? '***' : 'not set';
    }
    
    console.log(`   [INFO] ${key}: ${displayValue}`);
});

// Security checks for production
if (process.env.NODE_ENV === 'production') {
    console.log('');
    console.log('[SECURITY] Production Security Checks:');
    console.log('');
    
    if (process.env.JWT_SECRET === 'absenta-super-secret-key-2025') {
        warnings.push('[WARN] JWT_SECRET using default value in production!');
    }
    
    if (!process.env.DB_PASSWORD) {
        warnings.push('[WARN] DB_PASSWORD is empty in production!');
    }
    
    if (!process.env.REDIS_PASSWORD) {
        warnings.push('[WARN] REDIS_PASSWORD is empty (consider setting for security)');
    }
    
    if (process.env.API_BASE_URL && process.env.API_BASE_URL.includes('localhost')) {
        warnings.push('[WARN] API_BASE_URL still points to localhost in production!');
    }
}

// Display warnings and errors
console.log('\n═══════════════════════════════════════════════════════\n');

if (warnings.length > 0) {
    console.log('[WARN] WARNINGS:');
    console.log('');
    warnings.forEach((w) => {
        console.log(`   ${w}`);
    });
    console.log('');
}

if (errors.length > 0) {
    console.log('[ERROR] ERRORS:');
    console.log('');
    errors.forEach((e) => {
        console.log(`   ${e}`);
    });
    console.log('');
}

// Summary
console.log('═══════════════════════════════════════════════════════');
console.log(`[STATS] Summary: ${validCount}/${required.length} required variables set`);
console.log(`   Warnings: ${warnings.length}`);
console.log(`   Errors: ${errors.length}`);
console.log('═══════════════════════════════════════════════════════\n');

if (errors.length > 0) {
    console.log('[ERROR] Configuration validation FAILED!');
    console.log('');
    process.exit(1);
} else if (warnings.length > 0) {
    console.log('[WARN] Configuration validation passed with warnings.');
    console.log('');
    process.exit(0);
} else {
    console.log('[OK] Configuration validation PASSED!');
    console.log('');
    process.exit(0);
}


