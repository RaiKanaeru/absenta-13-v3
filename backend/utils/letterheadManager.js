import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '../config/report-letterhead.json');

const DEFAULT_LETTERHEAD = {
  enabled: true,
  logo: "",
  logoKiri: "",
  logoKanan: "",
  lines: [
    "PEMERINTAH DAERAH PROVINSI DKI JAKARTA",
    "DINAS PENDIDIKAN", 
    "SMK NEGERI 13 JAKARTA",
    "Jl. Raya Bekasi Km. 18, Cakung, Jakarta Timur 13910"
  ],
  alignment: "center"
};

/**
 * Load letterhead configuration from file
 * @returns {Promise<Object>} Letterhead configuration
 */
async function loadReportLetterhead() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf8');
    const config = JSON.parse(data);
    
    // Validate and merge with defaults
    return {
      enabled: typeof config.enabled === 'boolean' ? config.enabled : DEFAULT_LETTERHEAD.enabled,
      logo: typeof config.logo === 'string' ? config.logo : DEFAULT_LETTERHEAD.logo,
      logoKiri: typeof config.logoKiri === 'string' ? config.logoKiri : DEFAULT_LETTERHEAD.logoKiri,
      logoKanan: typeof config.logoKanan === 'string' ? config.logoKanan : DEFAULT_LETTERHEAD.logoKanan,
      lines: Array.isArray(config.lines) ? config.lines : DEFAULT_LETTERHEAD.lines,
      alignment: ['left', 'center', 'right'].includes(config.alignment) ? config.alignment : DEFAULT_LETTERHEAD.alignment
    };
  } catch (error) {
    console.warn('⚠️ Failed to load letterhead config, using defaults:', error.message);
    return DEFAULT_LETTERHEAD;
  }
}

/**
 * Save letterhead configuration to file
 * @param {Object} letterhead - Letterhead configuration to save
 * @returns {Promise<boolean>} Success status
 */
async function saveReportLetterhead(letterhead) {
  try {
    // Validate input
    if (!letterhead || typeof letterhead !== 'object') {
      throw new Error('Invalid letterhead configuration');
    }

    const config = {
      enabled: typeof letterhead.enabled === 'boolean' ? letterhead.enabled : DEFAULT_LETTERHEAD.enabled,
      logo: typeof letterhead.logo === 'string' ? letterhead.logo.trim() : DEFAULT_LETTERHEAD.logo,
      logoKiri: typeof letterhead.logoKiri === 'string' ? letterhead.logoKiri.trim() : DEFAULT_LETTERHEAD.logoKiri,
      logoKanan: typeof letterhead.logoKanan === 'string' ? letterhead.logoKanan.trim() : DEFAULT_LETTERHEAD.logoKanan,
      lines: Array.isArray(letterhead.lines) ? letterhead.lines.filter(line => typeof line === 'string' && line.trim().length > 0) : DEFAULT_LETTERHEAD.lines,
      alignment: ['left', 'center', 'right'].includes(letterhead.alignment) ? letterhead.alignment : DEFAULT_LETTERHEAD.alignment
    };

    // Ensure config directory exists
    const configDir = path.dirname(CONFIG_PATH);
    await fs.mkdir(configDir, { recursive: true });

    // Write to file
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    
    console.log('✅ Letterhead configuration saved successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to save letterhead configuration:', error.message);
    return false;
  }
}

/**
 * Validate letterhead configuration
 * @param {Object} letterhead - Letterhead configuration to validate
 * @returns {Object} Validation result with isValid and errors
 */
function validateLetterhead(letterhead) {
  const errors = [];

  if (!letterhead || typeof letterhead !== 'object') {
    errors.push('Invalid letterhead configuration');
    return { isValid: false, errors };
  }

  // Validate enabled
  if (typeof letterhead.enabled !== 'boolean') {
    errors.push('Enabled must be a boolean value');
  }

  // Validate logo
  if (letterhead.logo && typeof letterhead.logo !== 'string') {
    errors.push('Logo must be a string (base64 data URL or public URL)');
  }

  // Validate logoKiri
  if (letterhead.logoKiri && typeof letterhead.logoKiri !== 'string') {
    errors.push('Logo Kiri must be a string (base64 data URL or public URL)');
  }

  // Validate logoKanan
  if (letterhead.logoKanan && typeof letterhead.logoKanan !== 'string') {
    errors.push('Logo Kanan must be a string (base64 data URL or public URL)');
  }

  // Validate lines
  if (!Array.isArray(letterhead.lines)) {
    errors.push('Lines must be an array');
  } else {
    if (letterhead.lines.length === 0) {
      errors.push('At least one line is required');
    }
    if (letterhead.lines.length > 10) {
      errors.push('Maximum 10 lines allowed');
    }
    letterhead.lines.forEach((line, index) => {
      if (typeof line !== 'string') {
        errors.push(`Line ${index + 1} must be a string`);
      } else if (line.trim().length === 0) {
        errors.push(`Line ${index + 1} cannot be empty`);
      } else if (line.length > 200) {
        errors.push(`Line ${index + 1} exceeds maximum length of 200 characters`);
      }
    });
  }

  // Validate alignment
  if (!['left', 'center', 'right'].includes(letterhead.alignment)) {
    errors.push('Alignment must be left, center, or right');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export {
  loadReportLetterhead,
  saveReportLetterhead,
  validateLetterhead,
  DEFAULT_LETTERHEAD
};
