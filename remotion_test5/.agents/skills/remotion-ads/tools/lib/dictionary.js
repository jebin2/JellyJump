/**
 * Pronunciation dictionary management
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { DICT_DIR, DICT_CACHE_FILE, getApiKey } = require('./env');
const { makeRequest } = require('./api');

/**
 * Load dictionary cache from file
 * @returns {Object} Dictionary cache
 */
function loadDictionaryCache() {
  if (fs.existsSync(DICT_CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DICT_CACHE_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Save dictionary cache to file
 * @param {Object} cache - Dictionary cache
 */
function saveDictionaryCache(cache) {
  fs.writeFileSync(DICT_CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Escape special regex characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse PLS dictionary file and extract grapheme->alias mappings
 * Used as fallback when API dictionary permissions are missing
 * @param {string} filePath - Path to PLS file
 * @returns {Array<{grapheme: string, alias: string}>} Mappings
 */
function parsePLSDictionary(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const mappings = [];

  // Simple regex to extract grapheme and alias pairs
  const lexemeRegex = /<lexeme>[\s\S]*?<grapheme>([^<]+)<\/grapheme>[\s\S]*?<alias>([^<]+)<\/alias>[\s\S]*?<\/lexeme>/gi;

  let match;
  while ((match = lexemeRegex.exec(content)) !== null) {
    mappings.push({
      grapheme: match[1].trim(),
      alias: match[2].trim(),
    });
  }

  // Sort by grapheme length descending to avoid partial replacements
  mappings.sort((a, b) => b.grapheme.length - a.grapheme.length);

  return mappings;
}

/**
 * Apply pronunciation dictionary as text preprocessing fallback
 * Used when dictionary API permissions are missing
 * @param {string} text - Text to process
 * @param {string} dictName - Dictionary name
 * @returns {string} Processed text
 */
function applyDictionaryFallback(text, dictName) {
  const dictPath = path.join(DICT_DIR, `${dictName}.pls`);
  if (!fs.existsSync(dictPath)) {
    return text;
  }

  const mappings = parsePLSDictionary(dictPath);
  let processedText = text;

  for (const { grapheme, alias } of mappings) {
    // Use case-insensitive replacement while preserving word boundaries where appropriate
    const regex = new RegExp(escapeRegex(grapheme), 'gi');
    processedText = processedText.replace(regex, alias);
  }

  return processedText;
}

/**
 * Upload a pronunciation dictionary file to ElevenLabs
 * @param {string} filePath - Path to dictionary file
 * @param {string} name - Dictionary name
 * @returns {Promise<Object>} Upload result
 */
async function uploadDictionary(filePath, name) {
  const API_KEY = getApiKey();
  const fileContent = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  // Create multipart form data boundary
  const boundary = '----ElevenLabsBoundary' + Date.now();

  // Build multipart body
  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="name"\r\n\r\n`;
  body += `${name}\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
  body += `Content-Type: application/xml\r\n\r\n`;

  const bodyStart = Buffer.from(body, 'utf-8');
  const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const fullBody = Buffer.concat([bodyStart, fileContent, bodyEnd]);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: '/v1/pronunciation-dictionaries/add-from-file',
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString();
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve(json);
          } else {
            reject(new Error(`Upload failed: ${json.detail?.message || json.detail || data}`));
          }
        } catch {
          reject(new Error(`Upload failed: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

/**
 * List all pronunciation dictionaries from ElevenLabs
 * @returns {Promise<Array>} List of dictionaries
 */
async function listDictionaries() {
  const API_KEY = getApiKey();

  const response = await makeRequest({
    hostname: 'api.elevenlabs.io',
    path: '/v1/pronunciation-dictionaries',
    method: 'GET',
    headers: { 'xi-api-key': API_KEY },
  });

  if (response.status !== 200) {
    throw new Error('Failed to list dictionaries');
  }

  return response.data.pronunciation_dictionaries || [];
}

/**
 * Get or create a dictionary, returns { id, versionId }
 * @param {string} dictName - Dictionary name
 * @returns {Promise<{id: string, versionId: string}>} Dictionary info
 */
async function getOrCreateDictionary(dictName) {
  // Check cache first
  const cache = loadDictionaryCache();
  if (cache[dictName]) {
    console.log(`   📖 Using cached dictionary: ${dictName}`);
    return cache[dictName];
  }

  // Check if dictionary file exists
  const dictPath = path.join(DICT_DIR, `${dictName}.pls`);
  if (!fs.existsSync(dictPath)) {
    throw new Error(`Dictionary file not found: ${dictPath}`);
  }

  // Check if already exists on ElevenLabs
  const existing = await listDictionaries();
  const found = existing.find(d => d.name === dictName);

  if (found) {
    const result = {
      id: found.id,
      versionId: found.latest_version_id,
    };
    cache[dictName] = result;
    saveDictionaryCache(cache);
    console.log(`   📖 Found existing dictionary: ${dictName}`);
    return result;
  }

  // Upload new dictionary
  console.log(`   📤 Uploading dictionary: ${dictName}`);
  const uploaded = await uploadDictionary(dictPath, dictName);

  const result = {
    id: uploaded.id,
    versionId: uploaded.version_id,
  };
  cache[dictName] = result;
  saveDictionaryCache(cache);

  return result;
}

/**
 * Display available dictionaries
 */
async function displayDictionaries() {
  const API_KEY = getApiKey();

  console.log('\n📖 Pronunciation Dictionaries\n');

  // Local dictionaries
  console.log('Local dictionaries (in dictionaries/):');
  if (fs.existsSync(DICT_DIR)) {
    const files = fs.readdirSync(DICT_DIR).filter(f => f.endsWith('.pls'));
    if (files.length === 0) {
      console.log('  (none)');
    } else {
      files.forEach(f => {
        const name = f.replace('.pls', '');
        console.log(`  - ${name} (${f})`);
      });
    }
  } else {
    console.log('  (directory not found)');
  }

  // Remote dictionaries
  if (API_KEY) {
    console.log('\nRemote dictionaries (on ElevenLabs):');
    try {
      const remote = await listDictionaries();
      if (remote.length === 0) {
        console.log('  (none)');
      } else {
        remote.forEach(d => {
          console.log(`  - ${d.name} (id: ${d.id})`);
        });
      }
    } catch (e) {
      console.log(`  (error: ${e.message})`);
    }
  }

  // Cache
  console.log('\nCached dictionary IDs:');
  const cache = loadDictionaryCache();
  const keys = Object.keys(cache);
  if (keys.length === 0) {
    console.log('  (none)');
  } else {
    keys.forEach(k => {
      console.log(`  - ${k}: ${cache[k].id}`);
    });
  }

  console.log('\nUsage:');
  console.log('  --dictionary vosslegal     # Use local dictionary by name');
  console.log('  --no-dictionary            # Disable default dictionary');
}

module.exports = {
  loadDictionaryCache,
  saveDictionaryCache,
  escapeRegex,
  parsePLSDictionary,
  applyDictionaryFallback,
  uploadDictionary,
  listDictionaries,
  getOrCreateDictionary,
  displayDictionaries,
};
