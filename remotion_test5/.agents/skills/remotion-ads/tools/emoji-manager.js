#!/usr/bin/env node

/**
 * Noto Animated Emoji Manager
 *
 * Downloads and manages Google's Noto Animated Emojis for use in Remotion compositions.
 * Supports Lottie (best for Remotion), GIF, and WebP formats.
 *
 * Features:
 * - Fetch full emoji catalog from Google Fonts
 * - Search emojis by name/tag
 * - Download on-demand or bulk download
 * - Local caching to avoid re-downloads
 * - Generate TypeScript constants for easy imports
 *
 * Usage:
 *   node emoji-manager.js --sync                    # Sync emoji catalog
 *   node emoji-manager.js --search "happy"         # Search for emojis
 *   node emoji-manager.js --download "😀"          # Download specific emoji
 *   node emoji-manager.js --download-all           # Download all emojis
 *   node emoji-manager.js --list                   # List downloaded emojis
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // API endpoint for emoji catalog
  catalogUrl: 'https://googlefonts.github.io/noto-emoji-animation/data/api.json',

  // Base URL for downloading emojis
  downloadBaseUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest',

  // Supported formats
  formats: {
    lottie: 'lottie.json',
    gif: '512.gif',
    webp: '512.webp',
  },

  // Default format (Lottie is best for Remotion)
  defaultFormat: 'lottie',

  // Local paths
  cacheDir: path.join(__dirname, '..', 'public', 'assets', 'emoji'),
  catalogFile: path.join(__dirname, '..', '.emoji-catalog.json'),

  // Download settings
  timeout: 30000,
  retries: 3,
  concurrency: 5,
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: CONFIG.timeout }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        httpsGet(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function downloadFile(url, outputPath, retries = CONFIG.retries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const data = await httpsGet(url);
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath, data);
      return { success: true, size: data.length };
    } catch (error) {
      if (attempt === retries) {
        return { success: false, error: error.message };
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// Convert emoji character to codepoint string
function emojiToCodepoint(emoji) {
  const codepoints = [];
  for (const char of emoji) {
    codepoints.push(char.codePointAt(0).toString(16));
  }
  return codepoints.join('_');
}

// Convert codepoint string to emoji character
function codepointToEmoji(codepoint) {
  try {
    const codes = codepoint.split('_').map(c => parseInt(c, 16));
    return String.fromCodePoint(...codes);
  } catch {
    return null;
  }
}

// Sanitize tag for filename
function sanitizeTag(tag) {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============================================
// CATALOG MANAGEMENT
// ============================================

async function fetchCatalog() {
  console.log('📥 Fetching emoji catalog from Google Fonts...');

  try {
    const data = await httpsGet(CONFIG.catalogUrl);
    const catalog = JSON.parse(data.toString());

    if (!catalog.icons || !Array.isArray(catalog.icons)) {
      throw new Error('Invalid catalog format');
    }

    console.log(`   Found ${catalog.icons.length} animated emojis`);

    // Process and index the catalog
    const processed = {
      version: catalog.version || new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      count: catalog.icons.length,
      emojis: {},
      byTag: {},
      byEmoji: {},
    };

    for (const icon of catalog.icons) {
      const codepoint = icon.codepoint || icon.src || icon.id;
      if (!codepoint) continue;

      const tags = (icon.tags || []).map(t => t.replace(/^\[|\]$/g, '').toLowerCase());
      const primaryTag = tags[0] || codepoint;
      const emoji = codepointToEmoji(codepoint);

      const entry = {
        codepoint,
        emoji,
        tags,
        primaryTag,
        filename: sanitizeTag(primaryTag),
      };

      processed.emojis[codepoint] = entry;

      // Index by tag
      for (const tag of tags) {
        if (!processed.byTag[tag]) {
          processed.byTag[tag] = [];
        }
        processed.byTag[tag].push(codepoint);
      }

      // Index by emoji character
      if (emoji) {
        processed.byEmoji[emoji] = codepoint;
      }
    }

    return processed;
  } catch (error) {
    throw new Error(`Failed to fetch catalog: ${error.message}`);
  }
}

function loadCatalog() {
  if (fs.existsSync(CONFIG.catalogFile)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG.catalogFile, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

function saveCatalog(catalog) {
  fs.writeFileSync(CONFIG.catalogFile, JSON.stringify(catalog, null, 2));
}

async function syncCatalog() {
  const catalog = await fetchCatalog();
  saveCatalog(catalog);
  console.log(`✅ Catalog saved to ${CONFIG.catalogFile}`);
  console.log(`   Total emojis: ${catalog.count}`);
  console.log(`   Unique tags: ${Object.keys(catalog.byTag).length}`);
  return catalog;
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

function searchEmojis(catalog, query) {
  const queryLower = query.toLowerCase();
  const results = [];

  // Check if query is an emoji character
  if (catalog.byEmoji[query]) {
    const codepoint = catalog.byEmoji[query];
    results.push(catalog.emojis[codepoint]);
    return results;
  }

  // Search by tag
  for (const [tag, codepoints] of Object.entries(catalog.byTag)) {
    if (tag.includes(queryLower)) {
      for (const codepoint of codepoints) {
        if (!results.find(r => r.codepoint === codepoint)) {
          results.push(catalog.emojis[codepoint]);
        }
      }
    }
  }

  // Search in all tags
  for (const entry of Object.values(catalog.emojis)) {
    if (results.find(r => r.codepoint === entry.codepoint)) continue;

    for (const tag of entry.tags) {
      if (tag.includes(queryLower)) {
        results.push(entry);
        break;
      }
    }
  }

  return results;
}

// ============================================
// DOWNLOAD FUNCTIONS
// ============================================

function getDownloadUrl(codepoint, format = CONFIG.defaultFormat) {
  const formatFile = CONFIG.formats[format] || CONFIG.formats.lottie;
  return `${CONFIG.downloadBaseUrl}/${codepoint}/${formatFile}`;
}

function getLocalPath(entry, format = CONFIG.defaultFormat) {
  const ext = format === 'lottie' ? '.json' : format === 'gif' ? '.gif' : '.webp';
  return path.join(CONFIG.cacheDir, format, `${entry.filename}${ext}`);
}

function isDownloaded(entry, format = CONFIG.defaultFormat) {
  return fs.existsSync(getLocalPath(entry, format));
}

async function downloadEmoji(entry, format = CONFIG.defaultFormat, verbose = true) {
  const url = getDownloadUrl(entry.codepoint, format);
  const outputPath = getLocalPath(entry, format);

  if (fs.existsSync(outputPath)) {
    if (verbose) console.log(`   ⏭️ Already exists: ${entry.emoji || entry.primaryTag}`);
    return { success: true, skipped: true };
  }

  if (verbose) process.stdout.write(`   ⬇️ ${entry.emoji || entry.primaryTag}...`);

  const result = await downloadFile(url, outputPath);

  if (verbose) {
    if (result.success) {
      console.log(` ✓ (${(result.size / 1024).toFixed(1)}KB)`);
    } else {
      console.log(` ✗ (${result.error})`);
    }
  }

  return result;
}

async function downloadByQuery(catalog, query, format = CONFIG.defaultFormat) {
  // Check if it's an emoji character
  let codepoint = catalog.byEmoji[query];

  // Check if it's a codepoint directly
  if (!codepoint && catalog.emojis[query]) {
    codepoint = query;
  }

  // Search by tag
  if (!codepoint) {
    const results = searchEmojis(catalog, query);
    if (results.length === 0) {
      console.log(`❌ No emoji found for: ${query}`);
      return null;
    }
    if (results.length > 1) {
      console.log(`Found ${results.length} matches for "${query}":`);
      results.slice(0, 10).forEach(r => {
        console.log(`   ${r.emoji || '?'} ${r.primaryTag} [${r.codepoint}]`);
      });
      console.log(`\nUse a more specific query or the codepoint directly.`);
      return null;
    }
    codepoint = results[0].codepoint;
  }

  const entry = catalog.emojis[codepoint];
  console.log(`\n📥 Downloading: ${entry.emoji || ''} ${entry.primaryTag}`);

  const result = await downloadEmoji(entry, format);

  if (result.success && !result.skipped) {
    console.log(`\n✅ Downloaded to: ${getLocalPath(entry, format)}`);
  }

  return entry;
}

async function downloadAll(catalog, format = CONFIG.defaultFormat, categories = null) {
  const entries = Object.values(catalog.emojis);
  let filtered = entries;

  if (categories) {
    const categoryList = categories.split(',').map(c => c.trim().toLowerCase());
    filtered = entries.filter(e =>
      e.tags.some(t => categoryList.some(c => t.includes(c)))
    );
  }

  console.log(`\n📥 Downloading ${filtered.length} emojis (${format} format)...`);
  ensureDir(path.join(CONFIG.cacheDir, format));

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < filtered.length; i++) {
    const entry = filtered[i];
    process.stdout.write(`\r   [${i + 1}/${filtered.length}] `);

    const result = await downloadEmoji(entry, format, false);

    if (result.success) {
      if (result.skipped) {
        skipped++;
      } else {
        downloaded++;
      }
    } else {
      failed++;
    }

    // Small delay to be nice to the server
    if (!result.skipped) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log(`\n\n✅ Complete!`);
  console.log(`   Downloaded: ${downloaded}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
}

// ============================================
// LIST & INFO FUNCTIONS
// ============================================

function listDownloaded(format = CONFIG.defaultFormat) {
  const formatDir = path.join(CONFIG.cacheDir, format);

  if (!fs.existsSync(formatDir)) {
    console.log(`No emojis downloaded yet for format: ${format}`);
    return [];
  }

  const files = fs.readdirSync(formatDir);
  console.log(`\n📦 Downloaded emojis (${format}): ${files.length}`);

  files.forEach(file => {
    const stats = fs.statSync(path.join(formatDir, file));
    console.log(`   ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
  });

  return files;
}

function generateTypeScript(catalog, format = CONFIG.defaultFormat) {
  const formatDir = path.join(CONFIG.cacheDir, format);

  if (!fs.existsSync(formatDir)) {
    console.log('No emojis downloaded. Run --download-all first.');
    return;
  }

  const files = fs.readdirSync(formatDir);
  const entries = [];

  for (const file of files) {
    const name = path.basename(file, path.extname(file));
    const constName = name.toUpperCase().replace(/-/g, '_');
    const importPath = `@/assets/emoji/${format}/${file}`;

    entries.push({
      name,
      constName,
      importPath,
      file,
    });
  }

  const tsContent = `/**
 * Auto-generated Noto Animated Emoji constants
 * Generated: ${new Date().toISOString()}
 * Format: ${format}
 * Total: ${entries.length} emojis
 */

// Emoji paths for static imports
export const EMOJI = {
${entries.map(e => `  ${e.constName}: "${e.importPath}",`).join('\n')}
} as const;

// Emoji names for dynamic loading
export const EMOJI_NAMES = [
${entries.map(e => `  "${e.name}",`).join('\n')}
] as const;

export type EmojiName = typeof EMOJI_NAMES[number];

// Helper to get emoji path
export function getEmojiPath(name: EmojiName): string {
  const key = name.toUpperCase().replace(/-/g, '_') as keyof typeof EMOJI;
  return EMOJI[key];
}

// Helper for Remotion staticFile
export function getEmojiStaticFile(name: EmojiName): string {
  return \`/assets/emoji/${format}/\${name}.${format === 'lottie' ? 'json' : format}\`;
}
`;

  const outputPath = path.join(CONFIG.cacheDir, 'emoji-constants.ts');
  fs.writeFileSync(outputPath, tsContent);
  console.log(`\n✅ Generated: ${outputPath}`);
  console.log(`   Exported ${entries.length} emoji constants`);
}

// ============================================
// CLI
// ============================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    sync: false,
    search: null,
    download: null,
    downloadAll: false,
    downloadCategories: null,
    list: false,
    generateTs: false,
    format: CONFIG.defaultFormat,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--sync':
        options.sync = true;
        break;
      case '--search':
      case '-s':
        options.search = nextArg;
        i++;
        break;
      case '--download':
      case '-d':
        options.download = nextArg;
        i++;
        break;
      case '--download-all':
        options.downloadAll = true;
        break;
      case '--categories':
      case '-c':
        options.downloadCategories = nextArg;
        i++;
        break;
      case '--list':
      case '-l':
        options.list = true;
        break;
      case '--generate-ts':
        options.generateTs = true;
        break;
      case '--format':
      case '-f':
        options.format = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Noto Animated Emoji Manager

Downloads and manages Google's animated emojis for use in Remotion compositions.

Usage:
  node emoji-manager.js [options]

Options:
  --sync              Fetch/update emoji catalog from Google Fonts
  --search, -s        Search emojis by name or tag
  --download, -d      Download specific emoji (by name, tag, or emoji char)
  --download-all      Download all emojis
  --categories, -c    Filter download by categories (comma-separated)
  --list, -l          List downloaded emojis
  --generate-ts       Generate TypeScript constants file
  --format, -f        Format: lottie (default), gif, webp
  --help, -h          Show this help

Examples:
  # First, sync the catalog
  node emoji-manager.js --sync

  # Search for emojis
  node emoji-manager.js --search "happy"
  node emoji-manager.js --search "fire"

  # Download specific emoji
  node emoji-manager.js --download "😀"
  node emoji-manager.js --download "thumbs up"
  node emoji-manager.js --download "1f600"

  # Download all emojis (Lottie format, ~50MB)
  node emoji-manager.js --download-all

  # Download only face emojis
  node emoji-manager.js --download-all --categories "face,smile,happy"

  # Download as GIF instead
  node emoji-manager.js --download "fire" --format gif

  # Generate TypeScript constants
  node emoji-manager.js --generate-ts

Output Structure:
  public/assets/emoji/
    lottie/
      grinning-face.json
      fire.json
      ...
    gif/
      grinning-face.gif
      ...
    emoji-constants.ts    # TypeScript exports

Using in Remotion:
  import { Lottie } from "@remotion/lottie";
  import { staticFile } from "remotion";
  import grinningFace from "../public/assets/emoji/lottie/grinning-face.json";

  // Or with staticFile:
  <Lottie animationData={require(staticFile("/assets/emoji/lottie/fire.json"))} />

Formats:
  lottie  - Best for Remotion (@remotion/lottie), vector, small size
  gif     - Universal support, larger file size
  webp    - Good compression, wide browser support
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // Load or sync catalog
  let catalog = loadCatalog();

  if (options.sync) {
    catalog = await syncCatalog();
    return; // Exit after sync
  }

  if (!catalog) {
    console.log('No catalog found. Syncing...');
    catalog = await syncCatalog();
  }

  if (!catalog) {
    console.error('No catalog available. Run --sync first.');
    process.exit(1);
  }

  // Search
  if (options.search) {
    const results = searchEmojis(catalog, options.search);
    console.log(`\n🔍 Search results for "${options.search}": ${results.length} found\n`);

    if (results.length === 0) {
      console.log('   No matches. Try a different search term.');
    } else {
      results.slice(0, 20).forEach(r => {
        const downloaded = isDownloaded(r, options.format) ? '✓' : ' ';
        console.log(`   [${downloaded}] ${r.emoji || '?'} ${r.primaryTag.padEnd(25)} [${r.codepoint}]`);
      });
      if (results.length > 20) {
        console.log(`   ... and ${results.length - 20} more`);
      }
    }
    return;
  }

  // Download specific
  if (options.download) {
    await downloadByQuery(catalog, options.download, options.format);
    return;
  }

  // Download all
  if (options.downloadAll) {
    await downloadAll(catalog, options.format, options.downloadCategories);
    return;
  }

  // List downloaded
  if (options.list) {
    listDownloaded(options.format);
    return;
  }

  // Generate TypeScript
  if (options.generateTs) {
    generateTypeScript(catalog, options.format);
    return;
  }

  // Default: show help
  printHelp();
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
