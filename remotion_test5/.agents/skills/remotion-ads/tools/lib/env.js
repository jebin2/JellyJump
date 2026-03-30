/**
 * Environment configuration and paths
 */

const fs = require('fs');
const path = require('path');

// Paths
const SKILL_DIR = path.dirname(path.dirname(__dirname)); // Go up from tools/lib/ to skill root
const DICT_DIR = path.join(SKILL_DIR, 'dictionaries');
const DICT_CACHE_FILE = path.join(SKILL_DIR, '.dictionary-cache.json');

// Default dictionary (set to null to disable, or specify your brand dictionary name)
const DEFAULT_DICTIONARY = null;

/**
 * Load environment variables from .env.local
 */
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
}

/**
 * Get the ElevenLabs API key from environment
 * @returns {string|undefined} The API key or undefined if not set
 */
function getApiKey() {
  return process.env.ELEVENLABS_API_KEY;
}

/**
 * Check if API key is available, exit if required and missing
 * @param {boolean} required - Whether to exit if missing
 * @returns {string|undefined} The API key
 */
function requireApiKey(required = true) {
  const key = getApiKey();
  if (!key && required) {
    console.error('Error: ELEVENLABS_API_KEY not found in .env.local');
    process.exit(1);
  }
  return key;
}

module.exports = {
  SKILL_DIR,
  DICT_DIR,
  DICT_CACHE_FILE,
  DEFAULT_DICTIONARY,
  loadEnv,
  getApiKey,
  requireApiKey,
};
