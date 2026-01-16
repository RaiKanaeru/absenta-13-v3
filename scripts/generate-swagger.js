
import fs from 'fs';
import path from 'path';
import swaggerSpec from '../server/config/swaggerConfig.js';

const outputPath = path.join(process.cwd(), 'docs-site/specs/swagger.json');

// Ensure directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));

console.log(`✅ Swagger JSON generated at: ${outputPath}`);
