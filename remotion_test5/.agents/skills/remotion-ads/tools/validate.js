#!/usr/bin/env node

/**
 * Remotion Ads - Validation Script
 *
 * Checks if your project is properly configured to use the remotion-ads skill.
 *
 * Usage:
 *   node .claude/skills/remotion-ads/tools/validate.js
 *   # or after npm link:
 *   remotion-ads-validate
 *
 * Options:
 *   --fix    Attempt to fix issues (runs setup for missing items)
 *   --json   Output results as JSON
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Detect project root
function findProjectRoot() {
  let dir = process.cwd();
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
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();

// Parse arguments
const args = process.argv.slice(2);
const fixMode = args.includes('--fix');
const jsonOutput = args.includes('--json');

// Colors
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};

// Validation results
const results = {
  passed: [],
  warnings: [],
  errors: [],
};

function pass(msg, detail = '') {
  results.passed.push({ msg, detail });
  if (!jsonOutput) {
    console.log(`${c.green}✓${c.reset} ${msg}${detail ? c.dim + ' ' + detail + c.reset : ''}`);
  }
}

function warn(msg, detail = '', fix = '') {
  results.warnings.push({ msg, detail, fix });
  if (!jsonOutput) {
    console.log(`${c.yellow}⚠${c.reset} ${msg}${detail ? c.dim + ' ' + detail + c.reset : ''}`);
    if (fix && !fixMode) {
      console.log(`  ${c.dim}Fix: ${fix}${c.reset}`);
    }
  }
}

function fail(msg, detail = '', fix = '') {
  results.errors.push({ msg, detail, fix });
  if (!jsonOutput) {
    console.log(`${c.red}✗${c.reset} ${msg}${detail ? c.dim + ' ' + detail + c.reset : ''}`);
    if (fix && !fixMode) {
      console.log(`  ${c.dim}Fix: ${fix}${c.reset}`);
    }
  }
}

function section(title) {
  if (!jsonOutput) {
    console.log(`\n${c.blue}${title}${c.reset}`);
    console.log(c.dim + '─'.repeat(40) + c.reset);
  }
}

// Check if file exists and has content beyond template markers
function fileHasContent(filePath, markers = ['TODO', 'YOUR_', 'FILL', '[']) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  // Check if file has substantial content (not just template)
  const lines = content.split('\n').filter(l => !l.startsWith('#') && l.trim());
  return lines.length > 5;
}

// Check if manifest has entries
function manifestHasEntries(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  const dataLines = content.split('\n').filter(l => !l.startsWith('#') && l.trim() && !l.startsWith('path,'));
  return dataLines.length > 0;
}

// Check if command exists
function commandExists(cmd) {
  try {
    execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

// Get version of a command
function getCommandVersion(cmd) {
  try {
    const versionFlags = ['--version', '-version', '-v'];
    for (const flag of versionFlags) {
      try {
        const output = execSync(`${cmd} ${flag} 2>&1`, { encoding: 'utf8', timeout: 5000 });
        // Extract version number pattern (e.g., "5.1.2", "v18.17.0")
        const match = output.match(/v?(\d+\.\d+(?:\.\d+)?)/);
        if (match) {
          return match[1];
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Check for image processing tools (multi-fallback)
function checkImageTools() {
  // Try ImageMagick first (identify command)
  if (commandExists('identify')) {
    const version = getCommandVersion('identify');
    return { tool: 'ImageMagick', command: 'identify', version };
  }

  // Fallback to macOS sips
  if (commandExists('sips')) {
    return { tool: 'sips', command: 'sips', version: 'built-in' };
  }

  return null;
}

// Mask API key for display (show first 3 and last 3 chars)
function maskApiKey(key) {
  if (!key || key.length < 10) {
    return '(invalid key)';
  }
  const first = key.substring(0, 3);
  const last = key.substring(key.length - 3);
  return `${first}...${last}`;
}

// Validate folder structure
function validateFolders() {
  section('Folder Structure');

  const requiredFolders = [
    'public/brand',
    'public/assets/images',
    'public/assets/videos',
    'public/assets/audio',
  ];

  const optionalFolders = [
    'public/assets/images/photos',
    'public/assets/images/3d',
    'public/assets/images/icons',
    'public/assets/images/backgrounds',
    'public/assets/videos/clips',
    'public/assets/audio/music',
    'public/assets/audio/sfx',
  ];

  for (const folder of requiredFolders) {
    const fullPath = path.join(PROJECT_ROOT, folder);
    if (fs.existsSync(fullPath)) {
      pass(`${folder}/ exists`);
    } else {
      fail(`${folder}/ missing`, '', 'Run: node .claude/skills/remotion-ads/tools/setup.js');
    }
  }

  let optionalCount = 0;
  for (const folder of optionalFolders) {
    if (fs.existsSync(path.join(PROJECT_ROOT, folder))) {
      optionalCount++;
    }
  }
  if (optionalCount === optionalFolders.length) {
    pass(`All optional asset subfolders exist`, `(${optionalCount}/${optionalFolders.length})`);
  } else if (optionalCount > 0) {
    warn(`Some asset subfolders missing`, `(${optionalCount}/${optionalFolders.length})`, 'Run setup.js to create all');
  }
}

// Validate brand files
function validateBrand() {
  section('Brand Configuration');

  const brandAbout = path.join(PROJECT_ROOT, 'public/brand/about.md');
  const brandVoice = path.join(PROJECT_ROOT, 'public/brand/voice-guidelines.md');

  // Check about.md
  if (!fs.existsSync(brandAbout)) {
    fail('Brand brief missing', 'public/brand/about.md', 'Run setup.js or copy from examples/');
  } else if (!fileHasContent(brandAbout)) {
    warn('Brand brief exists but appears empty', 'Fill in your company/product details');
  } else {
    pass('Brand brief configured', 'public/brand/about.md');
  }

  // Check voice-guidelines.md
  if (!fs.existsSync(brandVoice)) {
    fail('Voice guidelines missing', 'public/brand/voice-guidelines.md', 'Run setup.js or copy from examples/');
  } else if (!fileHasContent(brandVoice)) {
    warn('Voice guidelines exists but appears empty', 'Fill in your tone and messaging');
  } else {
    pass('Voice guidelines configured', 'public/brand/voice-guidelines.md');
  }
}

// Validate asset manifests
function validateAssets() {
  section('Asset Manifests');

  const manifests = [
    { path: 'public/assets/images/manifest.csv', name: 'Images' },
    { path: 'public/assets/videos/manifest.csv', name: 'Videos' },
    { path: 'public/assets/audio/manifest.csv', name: 'Audio' },
  ];

  for (const manifest of manifests) {
    const fullPath = path.join(PROJECT_ROOT, manifest.path);
    if (!fs.existsSync(fullPath)) {
      warn(`${manifest.name} manifest missing`, manifest.path, 'Run setup.js to create');
    } else if (!manifestHasEntries(fullPath)) {
      warn(`${manifest.name} manifest empty`, 'Add assets and run scan-assets.js');
    } else {
      // Count entries
      const content = fs.readFileSync(fullPath, 'utf8');
      const entries = content.split('\n').filter(l => !l.startsWith('#') && l.trim() && !l.startsWith('path,')).length;
      pass(`${manifest.name} manifest has entries`, `(${entries} assets)`);
    }
  }
}

// Validate tools and dependencies
function validateTools() {
  section('Tools & Dependencies');

  // Check Node version
  const nodeVersion = process.version.match(/v(\d+)/)?.[1];
  const nodeMinor = process.version.match(/v\d+\.(\d+)/)?.[1];
  if (parseInt(nodeVersion) >= 18) {
    pass(`Node.js ${process.version}`, '(meets requirement >= 18)');
  } else {
    fail(`Node.js ${process.version}`, 'Requires Node 18+', 'Install Node.js 18 or later from https://nodejs.org');
  }

  // Check ffprobe (for video/audio metadata) with version
  if (commandExists('ffprobe')) {
    const ffprobeVersion = getCommandVersion('ffprobe');
    pass('ffprobe available', ffprobeVersion ? `v${ffprobeVersion}` : '(video/audio metadata)');
  } else {
    // Check if this is a video project (has video assets)
    const hasVideoAssets = fs.existsSync(path.join(PROJECT_ROOT, 'public/assets/videos')) &&
                           fs.readdirSync(path.join(PROJECT_ROOT, 'public/assets/videos')).some(f => /\.(mp4|mov|webm)$/i.test(f));
    if (hasVideoAssets) {
      fail('ffprobe not found', 'Required for video projects', 'brew install ffmpeg (macOS) or apt install ffmpeg (Linux)');
    } else {
      warn('ffprobe not found', 'Install FFmpeg for video/audio scanning', 'brew install ffmpeg (macOS) or apt install ffmpeg (Linux)');
    }
  }

  // Check for image processing tools (multi-fallback)
  const imageTools = checkImageTools();
  if (imageTools) {
    const versionInfo = imageTools.version ? `v${imageTools.version}` : '';
    pass(`Image tools: ${imageTools.tool}`, versionInfo);
  } else {
    warn('No image tools found', 'ImageMagick or sips recommended', 'brew install imagemagick (macOS) or apt install imagemagick (Linux)');
  }

  // Check remotion
  const pkgPath = path.join(PROJECT_ROOT, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.dependencies?.remotion || pkg.devDependencies?.remotion) {
      const version = pkg.dependencies?.remotion || pkg.devDependencies?.remotion;
      pass(`Remotion installed`, version);
    } else {
      fail('Remotion not installed', '', 'npm install remotion @remotion/cli');
    }
  }

  // Check ElevenLabs API key (for voiceover) with masking and length validation
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (apiKey) {
    const minKeyLength = 20;
    if (apiKey.length >= minKeyLength) {
      pass('ELEVENLABS_API_KEY set', `${maskApiKey(apiKey)} (${apiKey.length} chars)`);
    } else {
      warn('ELEVENLABS_API_KEY appears invalid', `Key too short (${apiKey.length} chars, expected >= ${minKeyLength})`, 'Check your API key at https://elevenlabs.io');
    }
  } else {
    warn('ELEVENLABS_API_KEY not set', 'Required for voiceover generation', 'Add ELEVENLABS_API_KEY=your_key to .env.local');
  }
}

// Validate skill files
function validateSkill() {
  section('Skill Files');

  const skillLocations = [
    '.claude/skills/remotion-ads',
    '.agents/skills/remotion-ads',
  ];

  let skillDir = null;
  for (const loc of skillLocations) {
    const fullPath = path.join(PROJECT_ROOT, loc);
    if (fs.existsSync(fullPath)) {
      skillDir = fullPath;
      break;
    }
  }

  if (!skillDir) {
    fail('Skill not found', 'Expected in .claude/skills/remotion-ads');
    return;
  }

  pass('Skill installed', path.relative(PROJECT_ROOT, skillDir));

  // Check key files
  const requiredFiles = ['SKILL.md', 'tools/generate.js', 'tools/scan-assets.js', 'presets/formats.json'];
  for (const file of requiredFiles) {
    if (fs.existsSync(path.join(skillDir, file))) {
      pass(`${file} exists`);
    } else {
      fail(`${file} missing`);
    }
  }
}

// Main
function validate() {
  if (!jsonOutput) {
    console.log('\n' + c.blue + '╔══════════════════════════════════════╗' + c.reset);
    console.log(c.blue + '║' + c.reset + '   Remotion Ads - Configuration Check ' + c.blue + '║' + c.reset);
    console.log(c.blue + '╚══════════════════════════════════════╝' + c.reset);
    console.log(`\n${c.dim}Project: ${PROJECT_ROOT}${c.reset}`);
  }

  validateFolders();
  validateBrand();
  validateAssets();
  validateSkill();
  validateTools();

  // Summary
  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('\n' + c.blue + '═══════════════════════════════════════' + c.reset);

    const total = results.passed.length + results.warnings.length + results.errors.length;
    console.log(`\n${c.green}✓ ${results.passed.length} passed${c.reset}  ${c.yellow}⚠ ${results.warnings.length} warnings${c.reset}  ${c.red}✗ ${results.errors.length} errors${c.reset}`);

    if (results.errors.length === 0 && results.warnings.length === 0) {
      console.log(`\n${c.green}All checks passed! Ready to create ads.${c.reset}`);
      console.log(`${c.dim}Ask Claude: "Create a 15-second Instagram Reel ad"${c.reset}\n`);
    } else if (results.errors.length === 0) {
      console.log(`\n${c.yellow}Setup mostly complete. Fix warnings for best results.${c.reset}\n`);
    } else {
      console.log(`\n${c.red}Setup incomplete. Fix errors before using the skill.${c.reset}`);
      console.log(`${c.dim}Run: node .claude/skills/remotion-ads/tools/setup.js${c.reset}\n`);
    }
  }

  // Exit code
  process.exit(results.errors.length > 0 ? 1 : 0);
}

validate();
