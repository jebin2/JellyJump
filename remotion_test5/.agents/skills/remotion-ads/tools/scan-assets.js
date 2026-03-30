#!/usr/bin/env node

/**
 * Asset Scanner - Scans asset directories and generates/updates CSV manifests
 *
 * Usage:
 *   node scan-assets.js                    # Scan all asset types
 *   node scan-assets.js --images           # Scan images only
 *   node scan-assets.js --videos           # Scan videos only
 *   node scan-assets.js --audio            # Scan audio only
 *   node scan-assets.js --update           # Update existing manifests (preserve descriptions)
 *   node scan-assets.js --dry-run          # Show what would be added without writing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Detect project root (where public/ folder should be)
function findProjectRoot() {
  let dir = process.cwd();

  // Walk up looking for package.json with remotion or public folder
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (pkg.dependencies?.remotion || pkg.devDependencies?.remotion) {
        return dir;
      }
    }
    if (fs.existsSync(path.join(dir, 'public')) && fs.existsSync(path.join(dir, 'remotion'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fallback to cwd
  return process.cwd();
}

// Configuration
const PROJECT_ROOT = findProjectRoot();
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];

// Parse arguments
const args = process.argv.slice(2);
const shouldScanImages = args.includes('--images') || (!args.includes('--videos') && !args.includes('--audio'));
const shouldScanVideos = args.includes('--videos') || (!args.includes('--images') && !args.includes('--audio'));
const shouldScanAudio = args.includes('--audio') || (!args.includes('--images') && !args.includes('--videos'));
const updateMode = args.includes('--update');
const dryRun = args.includes('--dry-run');

// Helper: Get image dimensions using sips (macOS) or identify (ImageMagick)
function getImageDimensions(filePath) {
  try {
    // Try sips first (macOS)
    const sipsOutput = execSync(`sips -g pixelWidth -g pixelHeight "${filePath}" 2>/dev/null`, { encoding: 'utf8' });
    const widthMatch = sipsOutput.match(/pixelWidth:\s*(\d+)/);
    const heightMatch = sipsOutput.match(/pixelHeight:\s*(\d+)/);
    if (widthMatch && heightMatch) {
      return { width: parseInt(widthMatch[1]), height: parseInt(heightMatch[1]) };
    }
  } catch (e) {
    // sips not available, try identify
  }

  try {
    // Try identify (ImageMagick)
    const identifyOutput = execSync(`identify -format "%w %h" "${filePath}" 2>/dev/null`, { encoding: 'utf8' });
    const [width, height] = identifyOutput.trim().split(' ').map(Number);
    if (width && height) {
      return { width, height };
    }
  } catch (e) {
    // identify not available
  }

  try {
    // Try file command as fallback
    const fileOutput = execSync(`file "${filePath}" 2>/dev/null`, { encoding: 'utf8' });
    const dimMatch = fileOutput.match(/(\d+)\s*x\s*(\d+)/);
    if (dimMatch) {
      return { width: parseInt(dimMatch[1]), height: parseInt(dimMatch[2]) };
    }
  } catch (e) {
    // file command failed
  }

  return { width: '', height: '' };
}

// Helper: Get video metadata using ffprobe
function getVideoMetadata(filePath) {
  try {
    const ffprobeOutput = execSync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}" 2>/dev/null`,
      { encoding: 'utf8' }
    );
    const data = JSON.parse(ffprobeOutput);
    const videoStream = data.streams?.find(s => s.codec_type === 'video');
    const audioStream = data.streams?.find(s => s.codec_type === 'audio');

    return {
      width: videoStream?.width || '',
      height: videoStream?.height || '',
      duration: data.format?.duration ? parseFloat(data.format.duration).toFixed(1) : '',
      fps: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate).toFixed(0) : '',
      hasAudio: !!audioStream
    };
  } catch (e) {
    return { width: '', height: '', duration: '', fps: '', hasAudio: false };
  }
}

// Helper: Get audio metadata using ffprobe
function getAudioMetadata(filePath) {
  try {
    const ffprobeOutput = execSync(
      `ffprobe -v quiet -print_format json -show_format "${filePath}" 2>/dev/null`,
      { encoding: 'utf8' }
    );
    const data = JSON.parse(ffprobeOutput);

    return {
      duration: data.format?.duration ? parseFloat(data.format.duration).toFixed(1) : ''
    };
  } catch (e) {
    return { duration: '' };
  }
}

// Helper: Parse CSV file
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    return { headers: [], rows: [], comments: [] };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const comments = [];
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') {
      comments.push(line);
    } else {
      dataLines.push(line);
    }
  }

  if (dataLines.length === 0) {
    return { headers: [], rows: [], comments };
  }

  const headers = dataLines[0].split(',');
  const rows = dataLines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });

  return { headers, rows, comments };
}

// Helper: Write CSV file
function writeCSV(filePath, headers, rows, comments = []) {
  const lines = [...comments];
  lines.push(headers.join(','));

  for (const row of rows) {
    const values = headers.map(h => {
      const val = row[h] || '';
      // Quote values containing commas
      return String(val).includes(',') ? `"${val}"` : val;
    });
    lines.push(values.join(','));
  }

  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

// Helper: Recursively find files
function findFiles(dir, extensions, baseDir = dir) {
  const results = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...findFiles(fullPath, extensions, baseDir));
    } else if (extensions.includes(path.extname(item).toLowerCase())) {
      results.push({
        fullPath,
        relativePath: path.relative(baseDir, fullPath)
      });
    }
  }

  return results;
}

// Helper: Infer type from path
function inferTypeFromPath(relativePath, assetType) {
  const dir = path.dirname(relativePath).split(path.sep)[0];

  if (assetType === 'images') {
    const typeMap = {
      'photos': 'photo',
      '3d': '3d',
      '2d-illustrations': '2d',
      'transparent': '2d',
      'icons': 'icon',
      'backgrounds': 'background'
    };
    return typeMap[dir] || '2d';
  }

  if (assetType === 'videos') {
    const typeMap = {
      'clips': 'clip',
      'transparent': 'transparent'
    };
    return typeMap[dir] || 'clip';
  }

  if (assetType === 'audio') {
    const typeMap = {
      'music': 'music',
      'sfx': 'sfx',
      'voiceovers': 'voiceover'
    };
    return typeMap[dir] || 'sfx';
  }

  return '';
}

// Helper: Generate name from filename
function generateNameFromFile(filename) {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Scan and update image manifest
function scanImages() {
  console.log('\n📷 Scanning images...');
  const imagesDir = path.join(ASSETS_DIR, 'images');
  const manifestPath = path.join(imagesDir, 'manifest.csv');

  const { headers, rows, comments } = parseCSV(manifestPath);
  const existingPaths = new Set(rows.map(r => r.path));

  const files = findFiles(imagesDir, IMAGE_EXTENSIONS);
  let added = 0;

  for (const file of files) {
    if (file.relativePath === 'manifest.csv') continue;
    if (existingPaths.has(file.relativePath)) continue;

    const dims = getImageDimensions(file.fullPath);
    const ext = path.extname(file.relativePath).toLowerCase();
    const hasTransparency = ['.png', '.webp', '.gif'].includes(ext);

    const newRow = {
      path: file.relativePath,
      type: inferTypeFromPath(file.relativePath, 'images'),
      category: '',
      name: generateNameFromFile(file.relativePath),
      description: '',
      tags: '',
      width: dims.width,
      height: dims.height,
      transparent: hasTransparency ? 'true' : 'false',
      mood: '',
      usage_notes: ''
    };

    rows.push(newRow);
    added++;
    console.log(`  + ${file.relativePath} (${dims.width}x${dims.height})`);
  }

  if (!dryRun && added > 0) {
    writeCSV(manifestPath, headers.length ? headers : Object.keys(rows[0]), rows, comments);
  }

  console.log(`  Found ${files.length} images, added ${added} new entries`);
}

// Scan and update video manifest
function scanVideos() {
  console.log('\n🎬 Scanning videos...');
  const videosDir = path.join(ASSETS_DIR, 'videos');
  const manifestPath = path.join(videosDir, 'manifest.csv');

  const { headers, rows, comments } = parseCSV(manifestPath);
  const existingPaths = new Set(rows.map(r => r.path));

  const files = findFiles(videosDir, VIDEO_EXTENSIONS);
  let added = 0;

  for (const file of files) {
    if (existingPaths.has(file.relativePath)) continue;

    const meta = getVideoMetadata(file.fullPath);
    const ext = path.extname(file.relativePath).toLowerCase();
    const hasAlpha = ext === '.webm' || file.relativePath.includes('transparent');

    const newRow = {
      path: file.relativePath,
      type: inferTypeFromPath(file.relativePath, 'videos'),
      category: '',
      name: generateNameFromFile(file.relativePath),
      description: '',
      tags: '',
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
      fps: meta.fps,
      transparent: hasAlpha ? 'true' : 'false',
      has_audio: meta.hasAudio ? 'true' : 'false',
      mood: '',
      usage_notes: ''
    };

    rows.push(newRow);
    added++;
    console.log(`  + ${file.relativePath} (${meta.width}x${meta.height}, ${meta.duration}s)`);
  }

  if (!dryRun && added > 0) {
    writeCSV(manifestPath, headers.length ? headers : Object.keys(rows[0]), rows, comments);
  }

  console.log(`  Found ${files.length} videos, added ${added} new entries`);
}

// Scan and update audio manifest
function scanAudioFiles() {
  console.log('\n🎵 Scanning audio...');
  const audioDir = path.join(ASSETS_DIR, 'audio');
  const manifestPath = path.join(audioDir, 'manifest.csv');

  const { headers, rows, comments } = parseCSV(manifestPath);
  const existingPaths = new Set(rows.map(r => r.path));

  const files = findFiles(audioDir, AUDIO_EXTENSIONS);
  let added = 0;

  for (const file of files) {
    if (existingPaths.has(file.relativePath)) continue;

    const meta = getAudioMetadata(file.fullPath);

    const newRow = {
      path: file.relativePath,
      type: inferTypeFromPath(file.relativePath, 'audio'),
      category: '',
      name: generateNameFromFile(file.relativePath),
      description: '',
      tags: '',
      duration: meta.duration,
      bpm: '',
      key: '',
      mood: '',
      license: '',
      usage_notes: ''
    };

    rows.push(newRow);
    added++;
    console.log(`  + ${file.relativePath} (${meta.duration}s)`);
  }

  if (!dryRun && added > 0) {
    writeCSV(manifestPath, headers.length ? headers : Object.keys(rows[0]), rows, comments);
  }

  console.log(`  Found ${files.length} audio files, added ${added} new entries`);
}

// Main
console.log('🔍 Asset Scanner');
console.log('================');
console.log(`Assets directory: ${ASSETS_DIR}`);
if (dryRun) console.log('(Dry run - no files will be modified)');

if (shouldScanImages) scanImages();
if (shouldScanVideos) scanVideos();
if (shouldScanAudio) scanAudioFiles();

console.log('\n✅ Done!');
console.log('\nNext steps:');
console.log('1. Open the manifest.csv files in a spreadsheet editor');
console.log('2. Fill in description, tags, mood, and usage_notes for each asset');
console.log('3. Claude will use this information to suggest appropriate assets');
