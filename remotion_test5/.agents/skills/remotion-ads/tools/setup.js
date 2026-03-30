#!/usr/bin/env node

/**
 * Remotion Ads - Setup Script
 *
 * Initializes your project with the required folder structure and template files.
 *
 * Usage:
 *   node .claude/skills/remotion-ads/tools/setup.js
 *   # or after npm link:
 *   remotion-ads-setup
 *
 * Options:
 *   --example    Also copy the FocusFlow example files
 *   --force      Overwrite existing files
 *   --dry-run    Show what would be created without creating
 */

const fs = require('fs');
const path = require('path');

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

// Get skill directory
function getSkillDir() {
  // Check if we're running from within the skill
  if (__dirname.includes('.claude/skills/remotion-ads')) {
    return path.resolve(__dirname, '..');
  }
  // Check common locations
  const locations = [
    path.join(process.cwd(), '.claude/skills/remotion-ads'),
    path.join(process.cwd(), '.agents/skills/remotion-ads'),
    path.join(findProjectRoot(), '.claude/skills/remotion-ads'),
  ];
  for (const loc of locations) {
    if (fs.existsSync(loc)) return loc;
  }
  return path.resolve(__dirname, '..');
}

const PROJECT_ROOT = findProjectRoot();
const SKILL_DIR = getSkillDir();

// Parse arguments
const args = process.argv.slice(2);
const includeExample = args.includes('--example');
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logStep(msg) {
  console.log(`\n${colors.blue}▶${colors.reset} ${msg}`);
}

function logCreate(filePath) {
  const rel = path.relative(PROJECT_ROOT, filePath);
  console.log(`  ${colors.green}✓${colors.reset} ${rel}`);
}

function logSkip(filePath, reason) {
  const rel = path.relative(PROJECT_ROOT, filePath);
  console.log(`  ${colors.yellow}○${colors.reset} ${rel} ${colors.dim}(${reason})${colors.reset}`);
}

function logError(msg) {
  console.log(`  ${colors.red}✗${colors.reset} ${msg}`);
}

// Create directory if it doesn't exist
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    if (!dryRun) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  }
  return false;
}

// Copy file if it doesn't exist (or force)
function copyTemplate(src, dest) {
  if (fs.existsSync(dest) && !force) {
    logSkip(dest, 'already exists');
    return false;
  }
  if (!dryRun) {
    fs.copyFileSync(src, dest);
  }
  logCreate(dest);
  return true;
}

// Create file with content if it doesn't exist
function createFile(filePath, content) {
  if (fs.existsSync(filePath) && !force) {
    logSkip(filePath, 'already exists');
    return false;
  }
  if (!dryRun) {
    fs.writeFileSync(filePath, content);
  }
  logCreate(filePath);
  return true;
}

// Main setup
function setup() {
  console.log('\n' + colors.blue + '╔══════════════════════════════════════╗' + colors.reset);
  console.log(colors.blue + '║' + colors.reset + '     Remotion Ads - Setup Wizard      ' + colors.blue + '║' + colors.reset);
  console.log(colors.blue + '╚══════════════════════════════════════╝' + colors.reset);

  console.log(`\n${colors.dim}Project root: ${PROJECT_ROOT}${colors.reset}`);
  console.log(`${colors.dim}Skill dir: ${SKILL_DIR}${colors.reset}`);

  if (dryRun) {
    log('\n[DRY RUN] No files will be created\n', 'yellow');
  }

  // 1. Create folder structure
  logStep('Creating folder structure...');

  const folders = [
    'public/brand',
    'public/assets/images/photos',
    'public/assets/images/3d',
    'public/assets/images/2d-illustrations',
    'public/assets/images/transparent',
    'public/assets/images/icons',
    'public/assets/images/backgrounds',
    'public/assets/videos/clips',
    'public/assets/videos/transparent',
    'public/assets/audio/music',
    'public/assets/audio/sfx',
    'public/assets/audio/voiceovers',
  ];

  for (const folder of folders) {
    const fullPath = path.join(PROJECT_ROOT, folder);
    if (ensureDir(fullPath)) {
      logCreate(fullPath);
    }
  }

  // 2. Copy brand templates
  logStep('Creating brand brief templates...');

  const brandAboutSrc = path.join(SKILL_DIR, 'examples/focusflow/brand-about.md');
  const brandVoiceSrc = path.join(SKILL_DIR, 'examples/focusflow/brand-voice.md');

  // Create empty templates if example files don't exist
  const brandAboutTemplate = fs.existsSync(brandAboutSrc)
    ? fs.readFileSync(brandAboutSrc, 'utf8').replace(/FocusFlow/g, 'YourBrand').replace(/focusflow/g, 'yourbrand')
    : '# Brand Brief\n\n> Fill out this file with your brand information.\n> See SKILL.md for the complete template.\n';

  const brandVoiceTemplate = fs.existsSync(brandVoiceSrc)
    ? fs.readFileSync(brandVoiceSrc, 'utf8').replace(/FocusFlow/g, 'YourBrand').replace(/focusflow/g, 'yourbrand')
    : '# Voice Guidelines\n\n> Fill out this file with your voice and messaging guidelines.\n> See SKILL.md for the complete template.\n';

  createFile(path.join(PROJECT_ROOT, 'public/brand/about.md'), brandAboutTemplate);
  createFile(path.join(PROJECT_ROOT, 'public/brand/voice-guidelines.md'), brandVoiceTemplate);

  // 3. Copy asset manifests
  logStep('Creating asset manifest templates...');

  const manifests = [
    { src: 'public/assets/images/manifest.csv', dest: 'public/assets/images/manifest.csv' },
    { src: 'public/assets/videos/manifest.csv', dest: 'public/assets/videos/manifest.csv' },
    { src: 'public/assets/audio/manifest.csv', dest: 'public/assets/audio/manifest.csv' },
  ];

  for (const manifest of manifests) {
    const srcPath = path.join(PROJECT_ROOT, manifest.src);
    const destPath = path.join(PROJECT_ROOT, manifest.dest);

    // Check if manifest already exists in project
    if (fs.existsSync(srcPath) && srcPath !== destPath) {
      logSkip(destPath, 'already exists');
    } else if (!fs.existsSync(destPath)) {
      // Create from skill templates or create empty
      const skillManifest = path.join(SKILL_DIR, '..', '..', '..', 'public/assets', path.basename(path.dirname(manifest.dest)), 'manifest.csv');
      if (fs.existsSync(skillManifest)) {
        copyTemplate(skillManifest, destPath);
      } else {
        // Create minimal manifest
        const headers = manifest.dest.includes('images')
          ? 'path,type,category,name,description,tags,width,height,transparent,mood,usage_notes'
          : manifest.dest.includes('videos')
          ? 'path,type,category,name,description,tags,width,height,duration,fps,transparent,has_audio,mood,usage_notes'
          : 'path,type,category,name,description,tags,duration,bpm,key,mood,license,usage_notes';
        createFile(destPath, `${headers}\n# Add your assets below. Run 'node .claude/skills/remotion-ads/tools/scan-assets.js' to auto-populate.\n`);
      }
    }
  }

  // 4. Copy example if requested
  if (includeExample) {
    logStep('Copying FocusFlow example...');

    const exampleDir = path.join(SKILL_DIR, 'examples/focusflow');
    const destDir = path.join(PROJECT_ROOT, 'remotion/compositions/examples');

    ensureDir(destDir);

    if (fs.existsSync(path.join(exampleDir, 'FocusFlowAd.tsx'))) {
      copyTemplate(
        path.join(exampleDir, 'FocusFlowAd.tsx'),
        path.join(destDir, 'FocusFlowAd.tsx')
      );
    }

    if (fs.existsSync(path.join(exampleDir, 'scenes.json'))) {
      copyTemplate(
        path.join(exampleDir, 'scenes.json'),
        path.join(destDir, 'focusflow-scenes.json')
      );
    }
  }

  // 5. Summary
  console.log('\n' + colors.green + '═══════════════════════════════════════' + colors.reset);
  console.log(colors.green + '✓ Setup complete!' + colors.reset);
  console.log(colors.green + '═══════════════════════════════════════' + colors.reset);

  console.log('\n' + colors.blue + 'Next steps:' + colors.reset);
  console.log('  1. Edit ' + colors.yellow + 'public/brand/about.md' + colors.reset + ' with your brand info');
  console.log('  2. Edit ' + colors.yellow + 'public/brand/voice-guidelines.md' + colors.reset + ' with your messaging');
  console.log('  3. Add assets to ' + colors.yellow + 'public/assets/' + colors.reset + ' folders');
  console.log('  4. Run ' + colors.yellow + 'node .claude/skills/remotion-ads/tools/scan-assets.js' + colors.reset);
  console.log('  5. Run ' + colors.yellow + 'node .claude/skills/remotion-ads/tools/validate.js' + colors.reset + ' to check setup');

  if (!includeExample) {
    console.log('\n' + colors.dim + 'Tip: Run with --example to also copy the FocusFlow demo' + colors.reset);
  }

  console.log('\n' + colors.dim + 'Ask Claude: "Create a 15-second Instagram Reel ad for my product"' + colors.reset + '\n');
}

// Run
setup();
