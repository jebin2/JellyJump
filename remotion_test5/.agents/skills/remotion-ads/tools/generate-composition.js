#!/usr/bin/env node

/**
 * Remotion Composition Generator
 *
 * Generates TSX composition files from scenes.json with presets for:
 * - Video formats (instagram-reel, tiktok, youtube-short, etc.)
 * - Pacing (slow, medium, fast, dramatic, snappy)
 * - Visual styles (minimal, bold, playful, professional, etc.)
 * - Templates (problem-solution, hook-cta, tutorial, testimonial)
 *
 * Usage:
 *   node generate-composition.js \
 *     --scenes examples/focusflow/scenes.json \
 *     --format instagram-reel \
 *     --pacing medium \
 *     --style minimal \
 *     --template problem-solution \
 *     --output src/compositions/GeneratedAd.tsx
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Find skill directory
const SKILL_DIR = path.dirname(__dirname);

// ============================================
// EMOJI INTEGRATION
// ============================================

const EMOJI_CONFIG = {
  catalogFile: path.join(SKILL_DIR, '.emoji-catalog.json'),
  cacheDir: path.join(SKILL_DIR, 'public', 'assets', 'emoji'),
  downloadBaseUrl: 'https://fonts.gstatic.com/s/e/notoemoji/latest',
};

// Scene type to emoji suggestions mapping
const SCENE_EMOJI_MAP = {
  hook: ['fire', 'sparkles', 'zap', 'collision', 'eyes', 'exploding-head'],
  problem: ['worried-face', 'anxious-face-with-sweat', 'confounded-face', 'tired-face', 'cross-mark', 'prohibited'],
  solution: ['check-mark', 'light-bulb', 'rocket', 'star-struck', 'glowing-star', 'party-popper'],
  cta: ['backhand-index-pointing-right', 'backhand-index-pointing-down', 'wrapped-gift', 'money-with-wings', 'gem-stone', 'crown'],
  testimonial: ['star-struck', 'smiling-face-with-heart-eyes', 'clapping-hands', 'folded-hands', 'hundred-points'],
  feature: ['check-mark', 'white-heavy-check-mark', 'star', 'sparkles', 'gear'],
};

// Keyword to emoji mapping for text analysis
const KEYWORD_EMOJI_MAP = {
  // Positive emotions
  'happy': 'grinning-face',
  'love': 'red-heart',
  'amazing': 'star-struck',
  'great': 'thumbs-up',
  'awesome': 'fire',
  'perfect': 'ok-hand',
  'success': 'trophy',
  'win': 'trophy',
  'celebrate': 'party-popper',

  // Negative emotions (for problem scenes)
  'problem': 'worried-face',
  'stress': 'anxious-face-with-sweat',
  'frustrat': 'confounded-face',
  'tired': 'tired-face',
  'overwhelm': 'exploding-head',
  'confus': 'confused-face',
  'difficult': 'persevering-face',

  // Actions
  'fast': 'rocket',
  'quick': 'zap',
  'easy': 'ok-hand',
  'simple': 'sparkles',
  'save': 'money-bag',
  'money': 'money-with-wings',
  'time': 'hourglass-not-done',
  'focus': 'bullseye',
  'target': 'bullseye',

  // Objects
  'phone': 'mobile-phone',
  'notification': 'bell',
  'message': 'speech-balloon',
  'email': 'envelope',
  'video': 'clapper-board',
  'music': 'musical-notes',
  'book': 'books',
  'learn': 'graduation-cap',

  // CTA related
  'free': 'wrapped-gift',
  'try': 'backhand-index-pointing-right',
  'start': 'rocket',
  'join': 'handshake',
  'download': 'down-arrow',
  'click': 'backhand-index-pointing-down',
  'link': 'link',
};

// Load emoji catalog
function loadEmojiCatalog() {
  if (fs.existsSync(EMOJI_CONFIG.catalogFile)) {
    try {
      return JSON.parse(fs.readFileSync(EMOJI_CONFIG.catalogFile, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

// Check if emoji is downloaded
function isEmojiDownloaded(emojiName) {
  const filePath = path.join(EMOJI_CONFIG.cacheDir, 'lottie', `${emojiName}.json`);
  return fs.existsSync(filePath);
}

// Download emoji file
async function downloadEmoji(codepoint, emojiName) {
  const url = `${EMOJI_CONFIG.downloadBaseUrl}/${codepoint}/lottie.json`;
  const outputDir = path.join(EMOJI_CONFIG.cacheDir, 'lottie');
  const outputPath = path.join(outputDir, `${emojiName}.json`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 30000 }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const data = Buffer.concat(chunks);
        fs.writeFileSync(outputPath, data);
        resolve({ success: true, size: data.length });
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Find emoji in catalog by name
function findEmojiInCatalog(catalog, name) {
  if (!catalog || !catalog.emojis) return null;

  // Search by filename/tag
  for (const [codepoint, entry] of Object.entries(catalog.emojis)) {
    if (entry.filename === name || entry.primaryTag === name || entry.primaryTag === `:${name}:`) {
      return { codepoint, ...entry };
    }
    // Also check tags
    if (entry.tags && entry.tags.some(t => t === name || t === `:${name}:`)) {
      return { codepoint, ...entry };
    }
  }

  return null;
}

// Analyze scene and suggest emojis
function suggestEmojisForScene(scene, catalog) {
  const suggestions = new Set();

  // 1. Add emojis based on scene type
  const typeEmojis = SCENE_EMOJI_MAP[scene.type] || [];
  typeEmojis.slice(0, 2).forEach(e => suggestions.add(e));

  // 2. Scan text for keywords
  const text = (scene.text || '').toLowerCase();
  for (const [keyword, emoji] of Object.entries(KEYWORD_EMOJI_MAP)) {
    if (text.includes(keyword)) {
      suggestions.add(emoji);
    }
  }

  // 3. Check visual hints
  if (scene.visual) {
    const visualStr = JSON.stringify(scene.visual).toLowerCase();
    for (const [keyword, emoji] of Object.entries(KEYWORD_EMOJI_MAP)) {
      if (visualStr.includes(keyword)) {
        suggestions.add(emoji);
      }
    }
  }

  // Validate against catalog and return
  const validated = [];
  for (const emojiName of suggestions) {
    const found = findEmojiInCatalog(catalog, emojiName);
    if (found) {
      validated.push({
        name: found.filename || emojiName,
        codepoint: found.codepoint,
        emoji: found.emoji,
      });
    }
  }

  return validated.slice(0, 3); // Max 3 emojis per scene
}

// Ensure emojis are downloaded
async function ensureEmojisDownloaded(emojis, verbose = true) {
  const toDownload = emojis.filter(e => !isEmojiDownloaded(e.name));

  if (toDownload.length === 0) {
    if (verbose) console.log('   All emojis already downloaded');
    return;
  }

  if (verbose) console.log(`   Downloading ${toDownload.length} emojis...`);

  for (const emoji of toDownload) {
    try {
      if (verbose) process.stdout.write(`   ⬇️ ${emoji.emoji || emoji.name}...`);
      const result = await downloadEmoji(emoji.codepoint, emoji.name);
      if (verbose) console.log(` ✓ (${(result.size / 1024).toFixed(1)}KB)`);
    } catch (error) {
      if (verbose) console.log(` ✗ (${error.message})`);
    }
  }
}

// Load presets
function loadPreset(name) {
  const presetPath = path.join(SKILL_DIR, 'presets', `${name}.json`);
  if (!fs.existsSync(presetPath)) {
    console.error(`Preset file not found: ${presetPath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
}

// Parse arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    scenes: null,
    format: 'instagram-reel',
    pacing: 'medium',
    style: 'minimal',
    template: 'problem-solution',
    output: null,
    name: null,
    emojis: true, // Auto-detect and include emojis
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--scenes':
      case '-s':
        options.scenes = nextArg;
        i++;
        break;
      case '--format':
      case '-f':
        options.format = nextArg;
        i++;
        break;
      case '--pacing':
      case '-p':
        options.pacing = nextArg;
        i++;
        break;
      case '--style':
        options.style = nextArg;
        i++;
        break;
      case '--template':
      case '-t':
        options.template = nextArg;
        i++;
        break;
      case '--output':
      case '-o':
        options.output = nextArg;
        i++;
        break;
      case '--name':
      case '-n':
        options.name = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--emojis':
        options.emojis = true;
        break;
      case '--no-emojis':
        options.emojis = false;
        break;
    }
  }

  return options;
}

// Print help
function printHelp() {
  const formats = loadPreset('formats');
  const pacing = loadPreset('pacing');
  const styles = loadPreset('styles');

  console.log(`
Remotion Composition Generator

Usage:
  node generate-composition.js --scenes <file> [options]

Options:
  --scenes, -s     Path to scenes.json file (required)
  --format, -f     Video format preset (default: instagram-reel)
  --pacing, -p     Pacing preset (default: medium)
  --style          Visual style preset (default: minimal)
  --template, -t   Ad template (default: problem-solution)
  --output, -o     Output TSX file path
  --name, -n       Composition name (default: derived from scenes)
  --emojis         Include animated Lottie emojis (default: enabled)
  --no-emojis      Disable emoji integration
  --help, -h       Show this help

Available Formats:
  ${Object.keys(formats.video).join(', ')}

Available Pacing:
  ${Object.keys(pacing).filter(k => !k.startsWith('$')).join(', ')}

Available Styles:
  ${Object.keys(styles).filter(k => !k.startsWith('$')).join(', ')}

Templates:
  problem-solution  - Hook → Problem → Solution → CTA
  hook-cta          - Attention grab → Direct CTA
  tutorial          - Step-by-step how-to
  testimonial       - Social proof focused

Example:
  node generate-composition.js \\
    --scenes examples/focusflow/scenes.json \\
    --format instagram-reel \\
    --pacing medium \\
    --style minimal \\
    --output src/compositions/FocusFlowAd.tsx
`);
}

// Convert kebab-case to PascalCase
function toPascalCase(str) {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Convert kebab-case to camelCase
function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// Generate the TSX composition
function generateComposition(scenes, options, formats, pacingPresets, styles, sceneEmojis = {}) {
  const scenesConfig = JSON.parse(fs.readFileSync(scenes, 'utf-8'));

  // Get presets
  const format = formats.video[options.format];
  if (!format) {
    console.error(`Unknown format: ${options.format}`);
    console.error(`Available: ${Object.keys(formats.video).join(', ')}`);
    process.exit(1);
  }

  const pacing = pacingPresets[options.pacing];
  if (!pacing) {
    console.error(`Unknown pacing: ${options.pacing}`);
    console.error(`Available: ${Object.keys(pacingPresets).filter(k => !k.startsWith('$')).join(', ')}`);
    process.exit(1);
  }

  const style = styles[options.style];
  if (!style) {
    console.error(`Unknown style: ${options.style}`);
    console.error(`Available: ${Object.keys(styles).filter(k => !k.startsWith('$')).join(', ')}`);
    process.exit(1);
  }

  // Derive component name
  const projectName = options.name || scenesConfig.name || 'GeneratedAd';
  const componentName = toPascalCase(projectName);

  // Collect all unique emojis across scenes
  const allEmojis = new Set();
  for (const emojis of Object.values(sceneEmojis)) {
    for (const e of emojis) {
      allEmojis.add(e.name);
    }
  }
  const hasEmojis = allEmojis.size > 0;

  // Calculate scene durations from config
  const sceneTimingEntries = scenesConfig.scenes.map(scene => {
    return `  ${scene.id}: ${scene.duration},`;
  }).join('\n');

  // Generate scene components based on type (with emoji data)
  const sceneComponents = scenesConfig.scenes.map(scene => {
    const emojis = sceneEmojis[scene.id] || [];
    return generateSceneComponent(scene, style, pacing, emojis);
  }).join('\n\n');

  // Generate the main composition with Series
  const seriesSequences = scenesConfig.scenes.map(scene => {
    const frameExpr = `Math.round(SCENE_TIMING.${scene.id} * fps) + PADDING_FRAMES`;
    return `      <Series.Sequence durationInFrames={${frameExpr}} name="${scene.id}">
        <Scene${toPascalCase(scene.id)} />
      </Series.Sequence>`;
  }).join('\n');

  // Generate emoji imports
  const emojiImports = hasEmojis ? Array.from(allEmojis).map(name => {
    const varName = toCamelCase(name.replace(/-/g, '_')) + 'Emoji';
    return `import ${varName} from "../public/assets/emoji/lottie/${name}.json";`;
  }).join('\n') : '';

  // Generate emoji map constant
  const emojiMapEntries = hasEmojis ? Array.from(allEmojis).map(name => {
    const varName = toCamelCase(name.replace(/-/g, '_')) + 'Emoji';
    return `  "${name}": ${varName},`;
  }).join('\n') : '';

  const tsx = `/**
 * Auto-generated Remotion composition
 * Generated from: ${path.basename(scenes)}
 * Format: ${options.format} (${format.width}x${format.height})
 * Pacing: ${options.pacing}
 * Style: ${options.style}
 * Emojis: ${hasEmojis ? Array.from(allEmojis).join(', ') : 'none'}
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Series,
  Img,
  staticFile,
} from "remotion";
${hasEmojis ? 'import { Lottie } from "@remotion/lottie";' : ''}

${emojiImports}
${hasEmojis ? `
// Emoji animation data map
const EMOJI_DATA: Record<string, unknown> = {
${emojiMapEntries}
};` : ''}

// ============================================
// VIDEO CONFIGURATION
// ============================================

export const VIDEO_CONFIG = {
  width: ${format.width},
  height: ${format.height},
  fps: ${format.fps},
  durationInFrames: 0, // Calculated from scenes
};

// ============================================
// COLORS (${style.name})
// ============================================

const COLORS = {
  background: "${style.colors.suggestions.background}",
  text: "${style.colors.suggestions.text}",
  accent: "${style.colors.suggestions.accent}",
};

// ============================================
// ANIMATION CONFIG (${pacing.name})
// ============================================

const ANIMATION_CONFIG = {
  spring: {
    damping: ${pacing.spring.damping},
    stiffness: ${pacing.spring.stiffness},
    mass: ${pacing.spring.mass},
  },
  textAnimation: {
    entranceDelay: ${pacing.textAnimation.entranceDelay},
    staggerDelay: ${pacing.textAnimation.staggerDelay},
    holdAfterEntrance: ${pacing.textAnimation.holdAfterEntrance},
  },
};

// ============================================
// SAFE ZONES
// ============================================

const SAFE_ZONE = {
  top: ${format.safeZones.top},
  bottom: ${format.safeZones.bottom},
  left: ${format.safeZones.left},
  right: ${format.safeZones.right},
};

// ============================================
// SCENE TIMING (from scenes.json or voiceover metadata)
// ============================================

// Fallback durations from scenes.json
const DEFAULT_TIMING: Record<string, number> = {
${sceneTimingEntries}
};

// Padding frames between scenes
const PADDING_FRAMES = Math.round(${pacing.sceneHoldTime} * ${format.fps});

/**
 * Load actual scene timing from voiceover metadata if available
 * Falls back to scenes.json durations
 */
function loadSceneTiming(): Record<string, number> {
  try {
    // Try to load actual voiceover durations from info.json
    // This would be populated after running generate.js with --with-timestamps
    const infoData = require("../../public/audio/${projectName}-info.json");
    const timing: Record<string, number> = {};
    for (const scene of infoData.scenes) {
      timing[scene.id] = scene.actualDuration || scene.duration || DEFAULT_TIMING[scene.id];
    }
    return timing;
  } catch {
    // Fallback to default timing from scenes.json
    return DEFAULT_TIMING;
  }
}

const SCENE_TIMING = loadSceneTiming();

// ============================================
// REUSABLE COMPONENTS
// ============================================

interface SafeAreaProps {
  children: React.ReactNode;
}

const SafeArea: React.FC<SafeAreaProps> = ({ children }) => (
  <div
    style={{
      position: "absolute",
      top: SAFE_ZONE.top,
      bottom: SAFE_ZONE.bottom,
      left: SAFE_ZONE.left,
      right: SAFE_ZONE.right,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    {children}
  </div>
);

interface AnimatedTextProps {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}

const AnimatedText: React.FC<AnimatedTextProps> = ({
  children,
  delay = 0,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delayFrames = Math.round(delay * fps);
  const adjustedFrame = Math.max(0, frame - delayFrames);

  const opacity = interpolate(adjustedFrame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = spring({
    frame: adjustedFrame,
    fps,
    config: ANIMATION_CONFIG.spring,
  });

  const y = interpolate(translateY, [0, 1], [30, 0]);

  return (
    <div
      style={{
        opacity,
        transform: \`translateY(\${y}px)\`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

interface HighlightProps {
  children: React.ReactNode;
  color?: string;
}

const Highlight: React.FC<HighlightProps> = ({
  children,
  color = COLORS.accent,
}) => (
  <span
    style={{
      color,
      fontWeight: "bold",
    }}
  >
    {children}
  </span>
);

interface GradientBackgroundProps {
  colors?: string[];
}

const GradientBackground: React.FC<GradientBackgroundProps> = ({
  colors = [COLORS.background, COLORS.background],
}) => (
  <AbsoluteFill
    style={{
      background: colors.length > 1
        ? \`linear-gradient(180deg, \${colors.join(", ")})\`
        : colors[0],
    }}
  />
);
${hasEmojis ? `
interface AnimatedEmojiProps {
  name: string;
  size?: number;
  delay?: number;
}

const AnimatedEmoji: React.FC<AnimatedEmojiProps> = ({
  name,
  size = 80,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delayFrames = Math.round(delay * fps);
  const adjustedFrame = Math.max(0, frame - delayFrames);

  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { ...ANIMATION_CONFIG.spring, damping: 8 },
  });

  const animationData = EMOJI_DATA[name];
  if (!animationData) return null;

  return (
    <div
      style={{
        width: size,
        height: size,
        transform: \`scale(\${scale})\`,
      }}
    >
      <Lottie
        animationData={animationData}
        style={{ width: size, height: size }}
      />
    </div>
  );
};` : ''}

// ============================================
// SCENE COMPONENTS
// ============================================

${sceneComponents}

// ============================================
// MAIN COMPOSITION
// ============================================

export const ${componentName}: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
${seriesSequences}
    </AbsoluteFill>
  );
};

// Calculate total duration for video config
const calculateTotalFrames = (fps: number): number => {
  return Object.values(SCENE_TIMING).reduce(
    (total, duration) => total + Math.round(duration * fps) + PADDING_FRAMES,
    0
  );
};

// Export with calculated duration
export const getVideoConfig = () => ({
  ...VIDEO_CONFIG,
  durationInFrames: calculateTotalFrames(VIDEO_CONFIG.fps),
});

export default ${componentName};
`;

  return tsx;
}

// Generate individual scene component based on type
function generateSceneComponent(scene, style, pacing, emojis = []) {
  const componentName = `Scene${toPascalCase(scene.id)}`;
  const visual = scene.visual || {};

  switch (scene.type) {
    case 'hook':
      return generateHookScene(componentName, scene, visual, style, emojis);
    case 'problem':
      return generateProblemScene(componentName, scene, visual, style, emojis);
    case 'solution':
      return generateSolutionScene(componentName, scene, visual, style, emojis);
    case 'cta':
      return generateCtaScene(componentName, scene, visual, style, emojis);
    default:
      return generateGenericScene(componentName, scene, visual, style, emojis);
  }
}

function generateHookScene(componentName, scene, visual, style, emojis = []) {
  const headline = visual.headline || scene.text.split('.')[0];
  const highlightWord = visual.highlightWord || '';
  const subtitle = visual.subtitle || '';
  const primaryEmoji = emojis[0]?.name;

  return `const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill>
      <GradientBackground colors={["#0a0a0a", "#1a1a2e"]} />
      <SafeArea>
        ${primaryEmoji ? `<AnimatedEmoji name="${primaryEmoji}" size={100} delay={0} />` : ''}
        <AnimatedText delay={ANIMATION_CONFIG.textAnimation.entranceDelay${primaryEmoji ? ' + 0.2' : ''}}>
          <h1
            style={{
              fontSize: 72,
              fontWeight: "bold",
              color: COLORS.text,
              textAlign: "center",
              margin: 0,
              lineHeight: 1.1,
              ${primaryEmoji ? 'marginTop: 24,' : ''}
            }}
          >
            ${highlightWord ? `{/* Highlight: ${highlightWord} */}` : ''}
            ${headline}
          </h1>
        </AnimatedText>
        ${subtitle ? `<AnimatedText delay={ANIMATION_CONFIG.textAnimation.entranceDelay + ANIMATION_CONFIG.textAnimation.staggerDelay${primaryEmoji ? ' + 0.2' : ''}}>
          <p
            style={{
              fontSize: 32,
              color: COLORS.text,
              opacity: 0.8,
              textAlign: "center",
              marginTop: 20,
            }}
          >
            ${subtitle}
          </p>
        </AnimatedText>` : ''}
      </SafeArea>
    </AbsoluteFill>
  );
};`;
}

function generateProblemScene(componentName, scene, visual, style, emojis = []) {
  const headline = visual.headline || 'The Problem';
  const bulletPoints = visual.bulletPoints || [];
  const primaryEmoji = emojis[0]?.name;

  const bulletList = bulletPoints.length > 0
    ? bulletPoints.map((point, i) => {
        const icon = point.icon || 'circle';
        const text = point.text || point;
        // Use emoji for bullet if available
        const emojiForBullet = emojis[i + 1]?.name; // Skip first emoji (used for header)
        return `          <AnimatedText
            key={${i}}
            delay={ANIMATION_CONFIG.textAnimation.entranceDelay + ${i} * ANIMATION_CONFIG.textAnimation.staggerDelay}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              ${emojiForBullet ? `<div style={{ marginRight: 12, width: 32, height: 32 }}><AnimatedEmoji name="${emojiForBullet}" size={32} delay={ANIMATION_CONFIG.textAnimation.entranceDelay + ${i} * ANIMATION_CONFIG.textAnimation.staggerDelay} /></div>` : `<span style={{ marginRight: 12, fontSize: 24 }}>{/* ${icon} icon */}</span>`}
              <span style={{ fontSize: 24, color: COLORS.text }}>${typeof text === 'string' ? text : text}</span>
            </div>
          </AnimatedText>`;
      }).join('\n')
    : '';

  return `const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill>
      <GradientBackground colors={["#1a1a2e", "#0a0a0a"]} />
      <SafeArea>
        ${primaryEmoji ? `<AnimatedEmoji name="${primaryEmoji}" size={80} delay={0} />` : ''}
        <AnimatedText delay={${primaryEmoji ? '0.2' : '0'}}>
          <h2
            style={{
              fontSize: 48,
              fontWeight: "bold",
              color: COLORS.accent,
              textAlign: "center",
              marginBottom: 40,
              ${primaryEmoji ? 'marginTop: 16,' : ''}
            }}
          >
            ${headline}
          </h2>
        </AnimatedText>
        <div style={{ width: "100%", maxWidth: 600 }}>
${bulletList}
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};`;
}

function generateSolutionScene(componentName, scene, visual, style, emojis = []) {
  const headline = visual.headline || 'The Solution';
  const subtitle = visual.subtitle || '';
  const features = visual.features || [];
  const primaryEmoji = emojis[0]?.name;

  const featureList = features.length > 0
    ? features.map((feature, i) => {
        const featureEmoji = emojis[i + 1]?.name;
        return `          <AnimatedText
            key={${i}}
            delay={ANIMATION_CONFIG.textAnimation.entranceDelay + ANIMATION_CONFIG.textAnimation.staggerDelay * ${i + 2}}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(255,255,255,0.1)",
                padding: "12px 24px",
                borderRadius: 8,
                margin: "8px 0",
              }}
            >
              ${featureEmoji ? `<div style={{ marginRight: 12, width: 28, height: 28 }}><AnimatedEmoji name="${featureEmoji}" size={28} delay={ANIMATION_CONFIG.textAnimation.entranceDelay + ANIMATION_CONFIG.textAnimation.staggerDelay * ${i + 2}} /></div>` : ''}
              <span style={{ fontSize: 20, color: COLORS.text }}>${feature}</span>
            </div>
          </AnimatedText>`;
      }).join('\n')
    : '';

  return `const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill>
      <GradientBackground colors={[COLORS.accent + "33", COLORS.background]} />
      <SafeArea>
        ${primaryEmoji ? `<AnimatedEmoji name="${primaryEmoji}" size={100} delay={0} />` : ''}
        <AnimatedText delay={${primaryEmoji ? '0.2' : '0'}}>
          <h2
            style={{
              fontSize: 56,
              fontWeight: "bold",
              color: COLORS.text,
              textAlign: "center",
              marginBottom: 16,
              ${primaryEmoji ? 'marginTop: 16,' : ''}
            }}
          >
            ${headline}
          </h2>
        </AnimatedText>
        ${subtitle ? `<AnimatedText delay={ANIMATION_CONFIG.textAnimation.staggerDelay${primaryEmoji ? ' + 0.2' : ''}}>
          <p
            style={{
              fontSize: 28,
              color: COLORS.text,
              opacity: 0.9,
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            ${subtitle}
          </p>
        </AnimatedText>` : ''}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
${featureList}
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};`;
}

function generateCtaScene(componentName, scene, visual, style, emojis = []) {
  const headline = visual.headline || 'Get Started';
  const ctaButton = visual.ctaButton || 'Learn More';
  const linkText = visual.linkText || '';
  const trustBadge = visual.trustBadge || null;
  const primaryEmoji = emojis[0]?.name;
  const ctaEmoji = emojis[1]?.name;

  return `const ${componentName}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = spring({
    frame: frame % 30,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  const scale = interpolate(pulse, [0, 1], [1, 1.02]);

  return (
    <AbsoluteFill>
      <GradientBackground colors={[COLORS.background, COLORS.accent + "22"]} />
      <SafeArea>
        ${primaryEmoji ? `<AnimatedEmoji name="${primaryEmoji}" size={80} delay={0} />` : ''}
        <AnimatedText delay={${primaryEmoji ? '0.2' : '0'}}>
          <h2
            style={{
              fontSize: 52,
              fontWeight: "bold",
              color: COLORS.text,
              textAlign: "center",
              marginBottom: 32,
              ${primaryEmoji ? 'marginTop: 16,' : ''}
            }}
          >
            ${headline}
          </h2>
        </AnimatedText>
        ${trustBadge ? `<AnimatedText delay={ANIMATION_CONFIG.textAnimation.staggerDelay}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
              color: COLORS.text,
              opacity: 0.8,
            }}
          >
            <span style={{ fontSize: 24, marginRight: 8 }}>⭐</span>
            <span style={{ fontSize: 20 }}>${trustBadge.rating} (${trustBadge.reviews} reviews)</span>
          </div>
        </AnimatedText>` : ''}
        <AnimatedText delay={ANIMATION_CONFIG.textAnimation.staggerDelay * 2}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: \`scale(\${scale})\`,
              background: COLORS.accent,
              padding: "20px 48px",
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            ${ctaEmoji ? `<div style={{ marginRight: 12, width: 32, height: 32 }}><AnimatedEmoji name="${ctaEmoji}" size={32} delay={ANIMATION_CONFIG.textAnimation.staggerDelay * 2} /></div>` : ''}
            <span
              style={{
                fontSize: 28,
                fontWeight: "bold",
                color: "#FFFFFF",
              }}
            >
              ${ctaButton}
            </span>
          </div>
        </AnimatedText>
        ${linkText ? `<AnimatedText delay={ANIMATION_CONFIG.textAnimation.staggerDelay * 3}>
          <p
            style={{
              fontSize: 20,
              color: COLORS.text,
              opacity: 0.7,
            }}
          >
            ${linkText}
          </p>
        </AnimatedText>` : ''}
      </SafeArea>
    </AbsoluteFill>
  );
};`;
}

function generateGenericScene(componentName, scene, visual, style, emojis = []) {
  const text = scene.text || '';
  const primaryEmoji = emojis[0]?.name;

  return `const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill>
      <GradientBackground />
      <SafeArea>
        ${primaryEmoji ? `<AnimatedEmoji name="${primaryEmoji}" size={80} delay={0} />` : ''}
        <AnimatedText delay={ANIMATION_CONFIG.textAnimation.entranceDelay${primaryEmoji ? ' + 0.2' : ''}}>
          <p
            style={{
              fontSize: 36,
              color: COLORS.text,
              textAlign: "center",
              maxWidth: 800,
              ${primaryEmoji ? 'marginTop: 20,' : ''}
          >
            ${text}
          </p>
        </AnimatedText>
      </SafeArea>
    </AbsoluteFill>
  );
};`;
}

// Main
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (!options.scenes) {
    console.error('Error: --scenes is required');
    printHelp();
    process.exit(1);
  }

  if (!fs.existsSync(options.scenes)) {
    console.error(`Error: Scenes file not found: ${options.scenes}`);
    process.exit(1);
  }

  // Load presets
  const formats = loadPreset('formats');
  const pacingPresets = loadPreset('pacing');
  const styles = loadPreset('styles');

  // Generate output path if not provided
  const scenesConfig = JSON.parse(fs.readFileSync(options.scenes, 'utf-8'));
  const projectName = options.name || scenesConfig.name || 'GeneratedAd';

  if (!options.output) {
    options.output = `src/compositions/${toPascalCase(projectName)}.tsx`;
  }

  console.log(`\n🎬 Generating Remotion Composition`);
  console.log(`   Scenes: ${options.scenes}`);
  console.log(`   Format: ${options.format}`);
  console.log(`   Pacing: ${options.pacing}`);
  console.log(`   Style: ${options.style}`);
  console.log(`   Emojis: ${options.emojis ? 'enabled' : 'disabled'}`);
  console.log(`   Output: ${options.output}`);
  console.log('');

  // Emoji detection and download
  let sceneEmojis = {};

  if (options.emojis) {
    const catalog = loadEmojiCatalog();

    if (!catalog) {
      console.log('📦 No emoji catalog found. Run: node tools/emoji-manager.js --sync');
      console.log('   Continuing without emojis...\n');
    } else {
      console.log('🎨 Detecting emojis for scenes...');

      const allEmojisNeeded = [];

      for (const scene of scenesConfig.scenes) {
        const suggested = suggestEmojisForScene(scene, catalog);
        sceneEmojis[scene.id] = suggested;

        if (suggested.length > 0) {
          console.log(`   ${scene.id} (${scene.type}): ${suggested.map(e => e.emoji || e.name).join(' ')}`);
          allEmojisNeeded.push(...suggested);
        }
      }

      if (allEmojisNeeded.length > 0) {
        // Dedupe
        const uniqueEmojis = [];
        const seen = new Set();
        for (const e of allEmojisNeeded) {
          if (!seen.has(e.name)) {
            seen.add(e.name);
            uniqueEmojis.push(e);
          }
        }

        console.log(`\n   Total unique emojis: ${uniqueEmojis.length}`);
        await ensureEmojisDownloaded(uniqueEmojis);
      } else {
        console.log('   No relevant emojis detected for scenes\n');
      }
    }
  }

  // Generate composition
  const tsx = generateComposition(options.scenes, options, formats, pacingPresets, styles, sceneEmojis);

  // Ensure output directory exists
  const outputDir = path.dirname(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(options.output, tsx);

  console.log(`\n✅ Composition generated!`);
  console.log(`   File: ${options.output}`);

  // Show which emojis were included
  const allEmojis = new Set();
  for (const emojis of Object.values(sceneEmojis)) {
    for (const e of emojis) {
      allEmojis.add(e.emoji || e.name);
    }
  }
  if (allEmojis.size > 0) {
    console.log(`   Emojis: ${Array.from(allEmojis).join(' ')}`);
  }

  console.log('');
  console.log(`Next steps:`);
  console.log(`   1. Install @remotion/lottie: npm install @remotion/lottie`);
  console.log(`   2. Register in src/Root.tsx or remotion.config.ts`);
  console.log(`   3. Run: npx remotion preview`);
  console.log(`   4. Generate voiceover: node tools/generate.js --scenes ${options.scenes} --with-timestamps`);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
