/**
 * Fix Missing Imports Script
 * Adds errorHandler imports to files that use it but don't import it
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const controllersDir = path.join(__dirname, 'server', 'controllers');
const importStatement = `import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';\n`;

function fixImports(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file uses error handler functions
    const usesErrorHandler = /send(Database|Validation|NotFound|Duplicate|Permission|Error|Success)/.test(content);
    
    // Check if already has import
    const hasImport = content.includes('errorHandler.js');
    
    if (usesErrorHandler && !hasImport) {
        // Find first import statement
        const importMatch = content.match(/^(import\s+.*?from\s+['"].*?['"];?\s*$)/m);
        
        if (importMatch) {
            const insertPos = content.indexOf(importMatch[0]) + importMatch[0].length;
            // Insert after the match with newline
            content = content.slice(0, insertPos) + '\n' + importStatement + content.slice(insertPos);
            
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`[OK] Fixed imports in: ${path.basename(filePath)}`);
            return true;
        }
    }
    
    return false;
}

// Main
try {
    const files = fs.readdirSync(controllersDir);
    let fixedCount = 0;

    files.forEach(file => {
        if (file.endsWith('.js')) {
            const filePath = path.join(controllersDir, file);
            if (fixImports(filePath)) {
                fixedCount++;
            }
        }
    });

    console.log(`\\n[DONE] Import fix complete! Fixed ${fixedCount} files`);
} catch (error) {
    console.error('[ERROR] Error:', error);
}
