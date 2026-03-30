#!/usr/bin/env node

/**
 * Website Screenshot & Video Capture Tool
 *
 * Captures screenshots and videos from websites for use in Remotion compositions.
 * Uses Playwright for reliable rendering of modern websites.
 *
 * Features:
 * - Desktop, tablet, mobile viewport screenshots
 * - Element-specific captures (by CSS selector)
 * - Region captures (specific coordinates)
 * - Video recording of page interactions
 * - Multiple device presets
 * - Dark mode support
 * - Scroll captures (long pages)
 *
 * Usage:
 *   node capture-screenshots.js --url https://example.com --devices desktop,mobile
 *   node capture-screenshots.js --url https://example.com --element ".hero-section"
 *   node capture-screenshots.js --url https://example.com --video --duration 5
 */

const fs = require('fs');
const path = require('path');

// Check for Playwright
let playwright;
try {
  playwright = require('playwright');
} catch {
  console.error('Error: Playwright is not installed.');
  console.error('Install it with: npm install playwright');
  console.error('Then install browsers: npx playwright install chromium');
  process.exit(1);
}

// ============================================
// DEVICE PRESETS
// ============================================

const DEVICES = {
  // Desktop
  'desktop': {
    name: 'Desktop (1920x1080)',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  'desktop-hd': {
    name: 'Desktop HD (2560x1440)',
    viewport: { width: 2560, height: 1440 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  'desktop-4k': {
    name: 'Desktop 4K (3840x2160)',
    viewport: { width: 3840, height: 2160 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  'laptop': {
    name: 'Laptop (1366x768)',
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  'macbook-pro': {
    name: 'MacBook Pro (1440x900)',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
  },

  // Tablets
  'ipad': {
    name: 'iPad (768x1024)',
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  'ipad-pro': {
    name: 'iPad Pro (1024x1366)',
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  'ipad-landscape': {
    name: 'iPad Landscape (1024x768)',
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
  },

  // Mobile phones
  'iphone-14': {
    name: 'iPhone 14 (390x844)',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  'iphone-14-pro-max': {
    name: 'iPhone 14 Pro Max (430x932)',
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  'iphone-se': {
    name: 'iPhone SE (375x667)',
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  'pixel-7': {
    name: 'Pixel 7 (412x915)',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
  },
  'samsung-galaxy': {
    name: 'Samsung Galaxy S21 (360x800)',
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36',
  },

  // Social media formats (for ad mockups)
  'instagram-post': {
    name: 'Instagram Post (1080x1080)',
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  'instagram-story': {
    name: 'Instagram Story (1080x1920)',
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  },
  'facebook-post': {
    name: 'Facebook Post (1200x630)',
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
};

// Device groups for quick selection
const DEVICE_GROUPS = {
  'all-desktop': ['desktop', 'laptop', 'macbook-pro'],
  'all-mobile': ['iphone-14', 'pixel-7', 'samsung-galaxy'],
  'all-tablet': ['ipad', 'ipad-pro', 'ipad-landscape'],
  'responsive': ['desktop', 'ipad', 'iphone-14'],
  'social': ['instagram-post', 'instagram-story', 'facebook-post'],
};

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  outputDir: path.join(process.cwd(), 'public', 'assets', 'screenshots'),
  timeout: 30000,
  waitForNetworkIdle: true,
  defaultQuality: 90,
  formats: ['png', 'jpeg', 'webp'],
};

// ============================================
// ARGUMENT PARSING
// ============================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    output: CONFIG.outputDir,
    devices: ['desktop'],
    element: null,
    elements: [],
    region: null,
    fullPage: false,
    video: false,
    videoDuration: 5,
    videoFps: 30,
    scroll: false,
    scrollSpeed: 500,
    darkMode: false,
    hideSelectors: [],
    waitFor: null,
    delay: 0,
    format: 'png',
    quality: CONFIG.defaultQuality,
    name: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--url':
      case '-u':
        options.url = nextArg;
        i++;
        break;
      case '--output':
      case '-o':
        options.output = nextArg;
        i++;
        break;
      case '--devices':
      case '-d':
        const deviceInput = nextArg;
        // Check if it's a group
        if (DEVICE_GROUPS[deviceInput]) {
          options.devices = DEVICE_GROUPS[deviceInput];
        } else {
          options.devices = deviceInput.split(',').map(d => d.trim());
        }
        i++;
        break;
      case '--element':
      case '-e':
        options.element = nextArg;
        i++;
        break;
      case '--elements':
        options.elements = nextArg.split(',').map(e => e.trim());
        i++;
        break;
      case '--region':
        // Format: x,y,width,height
        const [x, y, width, height] = nextArg.split(',').map(Number);
        options.region = { x, y, width, height };
        i++;
        break;
      case '--full-page':
        options.fullPage = true;
        break;
      case '--video':
        options.video = true;
        break;
      case '--video-duration':
        options.videoDuration = parseInt(nextArg, 10);
        i++;
        break;
      case '--video-fps':
        options.videoFps = parseInt(nextArg, 10);
        i++;
        break;
      case '--scroll':
        options.scroll = true;
        break;
      case '--scroll-speed':
        options.scrollSpeed = parseInt(nextArg, 10);
        i++;
        break;
      case '--dark-mode':
        options.darkMode = true;
        break;
      case '--hide':
        options.hideSelectors = nextArg.split(',').map(s => s.trim());
        i++;
        break;
      case '--wait-for':
        options.waitFor = nextArg;
        i++;
        break;
      case '--delay':
        options.delay = parseInt(nextArg, 10);
        i++;
        break;
      case '--format':
      case '-f':
        options.format = nextArg;
        i++;
        break;
      case '--quality':
      case '-q':
        options.quality = parseInt(nextArg, 10);
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
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Website Screenshot & Video Capture Tool

Captures screenshots and videos from websites for use in Remotion compositions.

Usage:
  node capture-screenshots.js --url <website> [options]

Options:
  --url, -u           Target URL (required)
  --output, -o        Output directory (default: public/assets/screenshots)
  --devices, -d       Device presets or group (default: desktop)
  --element, -e       CSS selector for element capture
  --elements          Multiple CSS selectors (comma-separated)
  --region            Capture region: x,y,width,height
  --full-page         Capture full scrollable page
  --video             Record video instead of screenshot
  --video-duration    Video duration in seconds (default: 5)
  --video-fps         Video framerate (default: 30)
  --scroll            Capture while scrolling
  --scroll-speed      Scroll speed in ms per 100px (default: 500)
  --dark-mode         Enable dark mode / prefers-color-scheme: dark
  --hide              CSS selectors to hide (comma-separated)
  --wait-for          Wait for selector before capture
  --delay             Delay in ms before capture (default: 0)
  --format, -f        Image format: png, jpeg, webp (default: png)
  --quality, -q       JPEG/WebP quality 0-100 (default: 90)
  --name, -n          Custom filename prefix
  --help, -h          Show this help

Device Presets:
  Desktop:  desktop, desktop-hd, desktop-4k, laptop, macbook-pro
  Tablet:   ipad, ipad-pro, ipad-landscape
  Mobile:   iphone-14, iphone-14-pro-max, iphone-se, pixel-7, samsung-galaxy
  Social:   instagram-post, instagram-story, facebook-post

Device Groups:
  responsive    Desktop + iPad + iPhone (recommended)
  all-desktop   All desktop sizes
  all-mobile    All mobile phones
  all-tablet    All tablets
  social        Social media formats

Examples:
  # Basic desktop screenshot
  node capture-screenshots.js --url https://example.com

  # Responsive screenshots (desktop, tablet, mobile)
  node capture-screenshots.js --url https://example.com --devices responsive

  # Capture specific element
  node capture-screenshots.js --url https://example.com --element ".hero-section"

  # Full page screenshot
  node capture-screenshots.js --url https://example.com --full-page

  # Record 5-second video of page
  node capture-screenshots.js --url https://example.com --video --video-duration 5

  # Dark mode mobile screenshot
  node capture-screenshots.js --url https://example.com --devices iphone-14 --dark-mode

  # Hide cookie banner and capture
  node capture-screenshots.js --url https://example.com --hide ".cookie-banner,.popup"

  # Wait for element and capture
  node capture-screenshots.js --url https://example.com --wait-for ".loaded" --delay 1000

Output Structure:
  public/assets/screenshots/
    example-com/
      desktop.png
      iphone-14.png
      hero-section-desktop.png
      recording-desktop.webm

Using in Remotion:
  import { Img, staticFile, Video } from "remotion";

  // Screenshot
  <Img src={staticFile("/assets/screenshots/example-com/desktop.png")} />

  // Video recording
  <Video src={staticFile("/assets/screenshots/example-com/recording-desktop.webm")} />
`);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function urlToFolderName(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/\./g, '-').replace(/[^a-z0-9-]/gi, '');
  } catch {
    return 'screenshot';
  }
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9-_.]/gi, '-').replace(/-+/g, '-');
}

// ============================================
// CAPTURE CLASS
// ============================================

class ScreenshotCapture {
  constructor(options) {
    this.options = options;
    this.browser = null;
    this.outputDir = path.join(options.output, urlToFolderName(options.url));
    this.results = [];
  }

  async init() {
    console.log('🚀 Launching browser...');
    this.browser = await playwright.chromium.launch({
      headless: true,
    });
    ensureDir(this.outputDir);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async createContext(device) {
    const deviceConfig = DEVICES[device];
    if (!deviceConfig) {
      console.error(`Unknown device: ${device}`);
      console.error(`Available: ${Object.keys(DEVICES).join(', ')}`);
      return null;
    }

    const contextOptions = {
      viewport: deviceConfig.viewport,
      deviceScaleFactor: deviceConfig.deviceScaleFactor,
      isMobile: deviceConfig.isMobile,
      hasTouch: deviceConfig.hasTouch,
      colorScheme: this.options.darkMode ? 'dark' : 'light',
    };

    if (deviceConfig.userAgent) {
      contextOptions.userAgent = deviceConfig.userAgent;
    }

    // Video recording context
    if (this.options.video) {
      contextOptions.recordVideo = {
        dir: this.outputDir,
        size: deviceConfig.viewport,
      };
    }

    return await this.browser.newContext(contextOptions);
  }

  async preparePage(page) {
    // Navigate to URL
    console.log(`   Loading: ${this.options.url}`);
    await page.goto(this.options.url, {
      waitUntil: this.options.waitForNetworkIdle ? 'networkidle' : 'load',
      timeout: CONFIG.timeout,
    });

    // Wait for specific selector if requested
    if (this.options.waitFor) {
      console.log(`   Waiting for: ${this.options.waitFor}`);
      await page.waitForSelector(this.options.waitFor, { timeout: CONFIG.timeout });
    }

    // Hide unwanted elements
    if (this.options.hideSelectors.length > 0) {
      console.log(`   Hiding: ${this.options.hideSelectors.join(', ')}`);
      for (const selector of this.options.hideSelectors) {
        await page.addStyleTag({
          content: `${selector} { display: none !important; visibility: hidden !important; }`,
        });
      }
    }

    // Apply delay
    if (this.options.delay > 0) {
      console.log(`   Waiting ${this.options.delay}ms...`);
      await page.waitForTimeout(this.options.delay);
    }
  }

  async captureScreenshot(page, device, suffix = '') {
    const deviceConfig = DEVICES[device];
    const prefix = this.options.name || '';
    const filename = sanitizeFilename(
      `${prefix}${prefix ? '-' : ''}${suffix}${suffix ? '-' : ''}${device}.${this.options.format}`
    );
    const filepath = path.join(this.outputDir, filename);

    const screenshotOptions = {
      path: filepath,
      type: this.options.format === 'jpeg' ? 'jpeg' : this.options.format === 'webp' ? 'png' : 'png',
      fullPage: this.options.fullPage,
    };

    if (this.options.format === 'jpeg' || this.options.format === 'webp') {
      screenshotOptions.quality = this.options.quality;
    }

    await page.screenshot(screenshotOptions);

    // Convert to WebP if needed (Playwright doesn't support WebP directly)
    // For now, just save as PNG and note it

    const stats = fs.statSync(filepath);
    console.log(`   ✓ ${filename} (${(stats.size / 1024).toFixed(1)}KB)`);

    this.results.push({
      device,
      type: 'screenshot',
      file: filename,
      path: filepath,
      size: stats.size,
      viewport: deviceConfig.viewport,
    });

    return filepath;
  }

  async captureElement(page, selector, device) {
    const element = await page.$(selector);
    if (!element) {
      console.log(`   ⚠️ Element not found: ${selector}`);
      return null;
    }

    const selectorName = sanitizeFilename(selector.replace(/[.#\[\]=]/g, ''));
    const prefix = this.options.name || '';
    const filename = sanitizeFilename(
      `${prefix}${prefix ? '-' : ''}${selectorName}-${device}.${this.options.format}`
    );
    const filepath = path.join(this.outputDir, filename);

    await element.screenshot({
      path: filepath,
      type: this.options.format === 'jpeg' ? 'jpeg' : 'png',
    });

    const stats = fs.statSync(filepath);
    console.log(`   ✓ ${filename} (${(stats.size / 1024).toFixed(1)}KB)`);

    this.results.push({
      device,
      type: 'element',
      selector,
      file: filename,
      path: filepath,
      size: stats.size,
    });

    return filepath;
  }

  async captureRegion(page, region, device) {
    const prefix = this.options.name || '';
    const filename = sanitizeFilename(
      `${prefix}${prefix ? '-' : ''}region-${region.x}-${region.y}-${device}.${this.options.format}`
    );
    const filepath = path.join(this.outputDir, filename);

    await page.screenshot({
      path: filepath,
      type: this.options.format === 'jpeg' ? 'jpeg' : 'png',
      clip: region,
    });

    const stats = fs.statSync(filepath);
    console.log(`   ✓ ${filename} (${(stats.size / 1024).toFixed(1)}KB)`);

    this.results.push({
      device,
      type: 'region',
      region,
      file: filename,
      path: filepath,
      size: stats.size,
    });

    return filepath;
  }

  async captureVideo(page, context, device) {
    const deviceConfig = DEVICES[device];
    console.log(`   Recording ${this.options.videoDuration}s video...`);

    // Perform actions during recording
    if (this.options.scroll) {
      // Scroll down slowly
      const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = deviceConfig.viewport.height;
      const scrollSteps = Math.ceil(scrollHeight / viewportHeight);

      for (let i = 0; i < scrollSteps; i++) {
        await page.evaluate(({ step, vh }) => {
          window.scrollTo({ top: step * vh, behavior: 'smooth' });
        }, { step: i, vh: viewportHeight });
        await page.waitForTimeout(this.options.scrollSpeed);
      }

      // Scroll back up
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      await page.waitForTimeout(1000);
    } else {
      // Just wait for the duration
      await page.waitForTimeout(this.options.videoDuration * 1000);
    }

    // Get video object before closing page
    const video = page.video();

    // Close page to finalize video
    await page.close();

    if (video) {
      // Wait for video to be saved (saveAs waits internally)
      const prefix = this.options.name || 'recording';
      const filename = sanitizeFilename(`${prefix}-${device}.webm`);
      const newPath = path.join(this.outputDir, filename);

      try {
        await video.saveAs(newPath);
        const stats = fs.statSync(newPath);
        console.log(`   ✓ ${filename} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);

        this.results.push({
          device,
          type: 'video',
          file: filename,
          path: newPath,
          size: stats.size,
          duration: this.options.videoDuration,
        });
      } catch (err) {
        console.error(`   ⚠ Failed to save video: ${err.message}`);
      }
    }
  }

  async captureScrollingPage(page, device) {
    const deviceConfig = DEVICES[device];
    const prefix = this.options.name || '';

    // Get full page height
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = deviceConfig.viewport.height;
    const scrollSteps = Math.ceil(scrollHeight / viewportHeight);

    console.log(`   Capturing ${scrollSteps} scroll positions...`);

    for (let i = 0; i < scrollSteps; i++) {
      await page.evaluate(({ step, vh }) => {
        window.scrollTo({ top: step * vh, behavior: 'instant' });
      }, { step: i, vh: viewportHeight });

      await page.waitForTimeout(300); // Wait for any lazy-loaded content

      const filename = sanitizeFilename(
        `${prefix}${prefix ? '-' : ''}scroll-${i + 1}-${device}.${this.options.format}`
      );
      const filepath = path.join(this.outputDir, filename);

      await page.screenshot({
        path: filepath,
        type: this.options.format === 'jpeg' ? 'jpeg' : 'png',
      });

      const stats = fs.statSync(filepath);
      console.log(`   ✓ ${filename} (${(stats.size / 1024).toFixed(1)}KB)`);

      this.results.push({
        device,
        type: 'scroll',
        scrollPosition: i,
        file: filename,
        path: filepath,
        size: stats.size,
      });
    }
  }

  async capture() {
    console.log(`\n📸 Capturing: ${this.options.url}`);
    console.log(`   Output: ${this.outputDir}`);
    console.log(`   Devices: ${this.options.devices.join(', ')}`);
    if (this.options.darkMode) console.log(`   Dark mode: enabled`);
    if (this.options.video) console.log(`   Mode: Video recording (${this.options.videoDuration}s)`);
    if (this.options.fullPage) console.log(`   Mode: Full page`);
    if (this.options.scroll) console.log(`   Mode: Scroll capture`);
    console.log('');

    for (const device of this.options.devices) {
      const deviceConfig = DEVICES[device];
      if (!deviceConfig) {
        console.log(`⚠️ Unknown device: ${device}, skipping`);
        continue;
      }

      console.log(`\n📱 ${deviceConfig.name}`);

      const context = await this.createContext(device);
      if (!context) continue;

      const page = await context.newPage();

      try {
        await this.preparePage(page);

        if (this.options.video) {
          await this.captureVideo(page, context, device);
        } else if (this.options.scroll && !this.options.fullPage) {
          await this.captureScrollingPage(page, device);
        } else if (this.options.element) {
          await this.captureElement(page, this.options.element, device);
        } else if (this.options.elements.length > 0) {
          for (const selector of this.options.elements) {
            await this.captureElement(page, selector, device);
          }
        } else if (this.options.region) {
          await this.captureRegion(page, this.options.region, device);
        } else {
          await this.captureScreenshot(page, device);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } finally {
        if (!this.options.video) {
          await page.close();
        }
        await context.close();
      }
    }
  }

  generateManifest() {
    const manifest = {
      url: this.options.url,
      capturedAt: new Date().toISOString(),
      darkMode: this.options.darkMode,
      files: this.results,
      totalSize: this.results.reduce((sum, r) => sum + r.size, 0),
    };

    const manifestPath = path.join(this.outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\n📄 Manifest: ${manifestPath}`);

    return manifest;
  }

  printSummary() {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 CAPTURE SUMMARY');
    console.log('═'.repeat(50));

    const screenshots = this.results.filter(r => r.type === 'screenshot' || r.type === 'scroll');
    const elements = this.results.filter(r => r.type === 'element');
    const videos = this.results.filter(r => r.type === 'video');

    if (screenshots.length > 0) {
      console.log(`\n📸 Screenshots: ${screenshots.length}`);
      screenshots.forEach(r => console.log(`   ${r.file}`));
    }

    if (elements.length > 0) {
      console.log(`\n🎯 Element captures: ${elements.length}`);
      elements.forEach(r => console.log(`   ${r.file} (${r.selector})`));
    }

    if (videos.length > 0) {
      console.log(`\n🎬 Videos: ${videos.length}`);
      videos.forEach(r => console.log(`   ${r.file} (${r.duration}s)`));
    }

    const totalSize = this.results.reduce((sum, r) => sum + r.size, 0);
    console.log(`\n📁 Total: ${this.results.length} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`📂 Output: ${this.outputDir}`);
    console.log('═'.repeat(50));
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (!options.url) {
    console.error('Error: --url is required');
    printHelp();
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(options.url);
  } catch {
    console.error('Error: Invalid URL');
    process.exit(1);
  }

  const capture = new ScreenshotCapture(options);

  try {
    await capture.init();
    await capture.capture();
    capture.generateManifest();
    capture.printSummary();

    console.log('\n✅ Capture complete!');
    console.log('\nUsage in Remotion:');
    console.log(`  <Img src={staticFile("/assets/screenshots/${urlToFolderName(options.url)}/desktop.png")} />`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await capture.close();
  }
}

main();
