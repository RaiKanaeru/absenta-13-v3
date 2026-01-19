/**
 * Batch Error Handler Update Script
 * Updates all controllers to use centralized error handling
 * 
 * Usage: node update-error-handlers.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const controllersDir = path.join(__dirname, 'server', 'controllers');

// Patterns to find and replace
const patterns = [
    {
        // Generic 500 error
        find: /console\.error\([^)]+error[^)]*\);?\s+res\.status\(500\)\.json\(\{\s*error:\s*['"]Internal server error['"]\s*\}\);?/g,
        replace: "return sendDatabaseError(res, error);"
    },
    {
        // Specific error messages
        find: /console\.error\([^)]+\);?\s+res\.status\(500\)\.json\(\{\s*error:\s*(['"][^'"]+['"]),?\s*details:[^}]*\}\);?/g,
        replace: "return sendDatabaseError(res, error, $1);"
    }
];

// Note: Add filenames here to skip during batch update (e.g., ['auth.js', 'admin.js'])

// Import statement to add if missing
const importStatement = `import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';`;

function updateFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Check if already has errorHandler import
    if (!content.includes('errorHandler.js')) {
        // Find the import section (usually at top after dotenv)
        const importMatch = content.match(/(import.*?from.*?;)\n/);
        if (importMatch) {
            const insertPos = content.indexOf(importMatch[0]) + importMatch[0].length;
            content = content.slice(0, insertPos) + importStatement + '\n' + content.slice(insertPos);
            modified = true;
        }
    }

    // Apply replacement patterns
    patterns.forEach(pattern => {
        const before = content;
        content = content.replace(pattern.find, pattern.replace);
        if (content !== before) {
            modified = true;
        }
    });

    // Save if modified
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[OK] Updated: ${path.basename(filePath)}`);
        return true;
    }
    
    return false;
}

// Main execution
try {
    const files = fs.readdirSync(controllersDir);
    let updatedCount = 0;

    files.forEach(file => {
        if (file.endsWith('.js')) {
            const filePath = path.join(controllersDir, file);
            if (updateFile(filePath)) {
                updatedCount++;
            }
        }
    });

    console.log(`\\n[DONE] Batch update complete!`);
    console.log(`[STATS] Updated ${updatedCount} controller files`);
    console.log(`\\n[WARN] Note: Please review the changes and test thoroughly`);

} catch (error) {
    console.error('[ERROR] Error during batch update:', error);
    process.exit(1);
}
